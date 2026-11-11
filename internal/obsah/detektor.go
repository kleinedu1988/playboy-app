package obsah

// Detektor partií NudeNet 320n (YOLOv8, 18 tříd: odhalená a zakrytá prsa, klín, zadeček, chodidla…). Obecný CLIP
// stupeň odhalení nepozná (docs/MODEL-CLIP-B32.md, oddíl 7); detektor je na to naučený. Pro tagy stačí nejvyšší
// jistota každé třídy na fotce, boxy ani potlačení překryvů (NMS) potřeba nejsou.
// Předzpracování jako v NudeNet: doplnit na čtverec černou vpravo a dole, zmenšit na 320 × 320, RGB / 255, CHW.

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"path/filepath"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
	xdraw "golang.org/x/image/draw"
)

// Počet tříd výstupu detektoru NudeNet
const TridDetektoru = 18

// Třídy NudeNet v pořadí výstupu modelu
var TridyDetektoru = []string{
	"FEMALE_GENITALIA_COVERED", "FACE_FEMALE", "BUTTOCKS_EXPOSED", "FEMALE_BREAST_EXPOSED",
	"FEMALE_GENITALIA_EXPOSED", "MALE_BREAST_EXPOSED", "ANUS_EXPOSED", "FEET_EXPOSED", "BELLY_COVERED",
	"FEET_COVERED", "ARMPITS_COVERED", "ARMPITS_EXPOSED", "FACE_MALE", "BELLY_EXPOSED", "MALE_GENITALIA_EXPOSED",
	"ANUS_COVERED", "FEMALE_BREAST_COVERED", "BUTTOCKS_COVERED",
}

const (
	stranaDetektoru = 320
	kotevDetektoru  = 2100 // 40² + 20² + 10² míst mřížky YOLOv8 při 320 × 320
)

var tabulkaDetektoru [256]float32

func init() {
	for b := range 256 {
		tabulkaDetektoru[b] = float32(b) / 255
	}
}

// Detektor partií; jeden výpočet najednou
type Detektor struct {
	mu     sync.Mutex
	sezeni *ort.AdvancedSession
	vstup  *ort.Tensor[float32]
	vystup *ort.Tensor[float32]
	rgba   *image.RGBA
}

// OtevritDetektor načte model detektoru ze složky obsah/ (knihovnu ONNX Runtime sdílí s CLIP)
func OtevritDetektor(slozka, soubor string) (*Detektor, error) {
	if err := pripravitProstredi(filepath.Join(slozka, Soubory[1].Nazev)); err != nil {
		return nil, err
	}
	opt, err := ort.NewSessionOptions()
	if err != nil {
		return nil, err
	}
	defer opt.Destroy()
	opt.SetIntraOpNumThreads(vlaken)
	opt.SetInterOpNumThreads(1)
	d := &Detektor{rgba: image.NewRGBA(image.Rect(0, 0, stranaDetektoru, stranaDetektoru))}
	if d.vstup, err = ort.NewTensor(ort.NewShape(1, 3, stranaDetektoru, stranaDetektoru), make([]float32, 3*stranaDetektoru*stranaDetektoru)); err == nil {
		d.vystup, err = ort.NewEmptyTensor[float32](ort.NewShape(1, int64(4+len(TridyDetektoru)), kotevDetektoru))
	}
	if err == nil {
		vstupy, vystupy, e := ort.GetInputOutputInfo(filepath.Join(slozka, soubor))
		if e != nil || len(vstupy) != 1 || len(vystupy) != 1 {
			err = fmt.Errorf("detektor: nečekané vstupy modelu (%v)", e)
		} else {
			d.sezeni, err = ort.NewAdvancedSession(filepath.Join(slozka, soubor), []string{vstupy[0].Name}, []string{vystupy[0].Name},
				[]ort.Value{d.vstup}, []ort.Value{d.vystup}, opt)
		}
	}
	if err != nil {
		d.Zavrit()
		return nil, fmt.Errorf("detektor: %w", err)
	}
	return d, nil
}

func (d *Detektor) Zavrit() {
	if d == nil {
		return
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sezeni != nil {
		d.sezeni.Destroy()
	}
	for _, v := range []interface{ Destroy() error }{d.vstup, d.vystup} {
		if v != nil {
			v.Destroy()
		}
	}
	d.sezeni, d.vstup, d.vystup, d.rgba = nil, nil, nil, nil
}

// Partie: nejvyšší jistota každé třídy na fotce (0–1, pořadí TridyDetektoru)
func (d *Detektor) Partie(obrazek []byte) ([]float32, error) {
	img, _, err := image.Decode(bytes.NewReader(obrazek))
	if err != nil {
		return nil, fmt.Errorf("obrázek: %w", err)
	}
	return d.PartieObrazku(img)
}

// PartieObrazku: nejvyšší jistota každé třídy na již dekódovaném obrázku (0–1, pořadí TridyDetektoru)
func (d *Detektor) PartieObrazku(img image.Image) ([]float32, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sezeni == nil {
		return nil, errors.New("detektor je zavřený")
	}
	predzpracovatDetektorDo(img, d.rgba, d.vstup.GetData())
	if err := d.sezeni.Run(); err != nil {
		return nil, err
	}
	return jistotyZVystupu(d.vystup.GetData()), nil
}

// PartieABoxy (0.02.049): jistoty tříd i boxy postavy z jednoho běhu detektoru (výpočet obsahu fotek potřebuje obojí)
func (d *Detektor) PartieABoxy(img image.Image) ([]float32, []Box, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sezeni == nil {
		return nil, nil, errors.New("detektor je zavřený")
	}
	predzpracovatDetektorDo(img, d.rgba, d.vstup.GetData())
	if err := d.sezeni.Run(); err != nil {
		return nil, nil, err
	}
	out := d.vystup.GetData()
	b := img.Bounds()
	return jistotyZVystupu(out), boxyZVystupu(out, kotevDetektoru, b.Dx(), b.Dy()), nil
}

func jistotyZVystupu(out []float32) []float32 {
	nej := make([]float32, len(TridyDetektoru))
	for t := range TridyDetektoru {
		radek := out[(4+t)*kotevDetektoru : (5+t)*kotevDetektoru]
		for _, x := range radek {
			nej[t] = max(nej[t], x)
		}
	}
	return nej
}

func predzpracovatDetektor(img image.Image, cil []float32) {
	predzpracovatDetektorDo(img, image.NewRGBA(image.Rect(0, 0, stranaDetektoru, stranaDetektoru)), cil)
}

func predzpracovatDetektorDo(img image.Image, m *image.RGBA, cil []float32) {
	b := img.Bounds()
	k := max(b.Dx(), b.Dy())
	if k <= 0 {
		clear(cil)
		return
	}
	clear(m.Pix)
	cilRect := image.Rect(0, 0, max(1, b.Dx()*stranaDetektoru/k), max(1, b.Dy()*stranaDetektoru/k))
	xdraw.BiLinear.Scale(m, cilRect, img, b, xdraw.Src, nil)
	const plocha = stranaDetektoru * stranaDetektoru
	pix := m.Pix[:plocha*4]
	cr, cg, cb := cil[:plocha], cil[plocha:2*plocha], cil[2*plocha:3*plocha]
	for p := range plocha {
		i := p * 4
		cr[p] = tabulkaDetektoru[pix[i]]
		cg[p] = tabulkaDetektoru[pix[i+1]]
		cb[p] = tabulkaDetektoru[pix[i+2]]
	}
}
