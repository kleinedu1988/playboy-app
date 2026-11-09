package obsah

// Obrazová věž CLIP ViT-B/32 v ONNX Runtime (docs/MODEL-CLIP-B32.md). Knihovna libonnxruntime.so se otevírá až
// za běhu (dlopen) ze složky obsah/, takže sestavení programu ji nepotřebuje; když chybí, funkce je jen vypnutá.
// Předzpracování musí odpovídat měření v dokumentu: celá fotka zmenšená na 224 × 224 bez ořezu, normalizace CLIP,
// tenzor CHW. Výstup je vektor délky 1 (podobnost = skalární součin).

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"path/filepath"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// Rozměr vektoru obrazové věže CLIP B/32
const Rozmer = 512

// Strana vstupního obrázku modelu
const strana = 224

// Vlákna ONNX Runtime pro jeden výpočet: víc skoro nezrychlí (MODEL-CLIP-B32.md, oddíl 2) a počítač zůstane volný
const vlaken = 2

// Normalizace CLIP po kanálech RGB a předpočtená tabulka pro hodnoty bajtů 0–255
var (
	prumer      = [3]float32{0.48145466, 0.4578275, 0.40821073}
	odchylka    = [3]float32{0.26862954, 0.26130258, 0.27577711}
	tabulkaCLIP [3][256]float32
)

func init() {
	for c := range 3 {
		for b := range 256 {
			tabulkaCLIP[c][b] = (float32(b)/255 - prumer[c]) / odchylka[c]
		}
	}
}

// ErrBezKnihovny: ONNX Runtime se nepodařilo načíst (chybí nebo je pro jiný systém)
var ErrBezKnihovny = errors.New("knihovnu ONNX Runtime se nepodařilo načíst")

// Prostředí ONNX Runtime je jedno na proces; knihovna se načte při prvním otevření modelu
var (
	prostrediMu  sync.Mutex
	prostrediErr error
)

func pripravitProstredi(knihovna string) error {
	prostrediMu.Lock()
	defer prostrediMu.Unlock()
	if ort.IsInitialized() {
		return nil
	}
	if prostrediErr != nil {
		return prostrediErr // druhý pokus by v procesu zůstal napůl načtený
	}
	ort.SetSharedLibraryPath(knihovna)
	if err := ort.InitializeEnvironment(); err != nil {
		prostrediErr = fmt.Errorf("%w: %v", ErrBezKnihovny, err)
		return prostrediErr
	}
	return nil
}

// UkoncitProstredi uvolní ONNX Runtime (konec programu); modely musí být zavřené
func UkoncitProstredi() {
	prostrediMu.Lock()
	defer prostrediMu.Unlock()
	if ort.IsInitialized() {
		ort.DestroyEnvironment()
	}
}

// Otevřený model; jeden výpočet najednou (vstupní a výstupní tenzor jsou sdílené)
type Model struct {
	mu     sync.Mutex
	sezeni *ort.DynamicAdvancedSession
	vstup  *ort.Tensor[float32]
	vystup *ort.Tensor[float32]
	rgba   *image.RGBA
}

// OtevritModel načte knihovnu a model ze složky obsah/ (soubory podle Soubory)
func OtevritModel(slozka string) (*Model, error) {
	if err := pripravitProstredi(filepath.Join(slozka, Soubory[1].Nazev)); err != nil {
		return nil, err
	}
	opt, err := ort.NewSessionOptions()
	if err != nil {
		return nil, err
	}
	defer opt.Destroy()
	if err := opt.SetIntraOpNumThreads(vlaken); err != nil {
		return nil, err
	}
	if err := opt.SetInterOpNumThreads(1); err != nil {
		return nil, err
	}
	m := &Model{rgba: image.NewRGBA(image.Rect(0, 0, strana, strana))}
	m.sezeni, err = ort.NewDynamicAdvancedSession(filepath.Join(slozka, Soubory[0].Nazev), []string{"pixel_values"}, []string{"image_embeds"}, opt)
	if err != nil {
		return nil, fmt.Errorf("model: %w", err)
	}
	if m.vstup, err = ort.NewTensor(ort.NewShape(1, 3, strana, strana), make([]float32, 3*strana*strana)); err == nil {
		m.vystup, err = ort.NewEmptyTensor[float32](ort.NewShape(1, Rozmer))
	}
	if err != nil {
		m.Zavrit()
		return nil, err
	}
	return m, nil
}

// Zavrit uvolní model (~200 MB paměti); zavřený model už nejde použít
func (m *Model) Zavrit() {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, v := range []interface{ Destroy() error }{m.vstup, m.vystup} {
		if v != nil {
			v.Destroy()
		}
	}
	if m.sezeni != nil {
		m.sezeni.Destroy()
	}
	m.sezeni, m.vstup, m.vystup, m.rgba = nil, nil, nil, nil
}

// Vektor obrázku (JPEG, PNG, GIF, WebP) délky 1
func (m *Model) Vektor(obrazek []byte) ([]float32, error) {
	img, _, err := image.Decode(bytes.NewReader(obrazek))
	if err != nil {
		return nil, fmt.Errorf("obrázek: %w", err)
	}
	return m.VektorObrazku(img)
}

// VektorObrazku spočítá vektor již dekódovaného obrázku délky 1
func (m *Model) VektorObrazku(img image.Image) ([]float32, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sezeni == nil {
		return nil, errors.New("model je zavřený")
	}
	predzpracovatDo(img, m.rgba, m.vstup.GetData())
	if err := m.sezeni.Run([]ort.Value{m.vstup}, []ort.Value{m.vystup}); err != nil {
		return nil, err
	}
	v := append([]float32(nil), m.vystup.GetData()...)
	if !Normalizovat(v) {
		return nil, errors.New("model vrátil nulový vektor")
	}
	return v, nil
}

// Predzpracovat zmenší celou fotku na 224 × 224 (bez ořezu, CatmullRom jako při měření kvality: bilineární
// zmenšení je rychlejší o ~20 ms, ale vektory se od změřených liší) a zapíše normalizované kanály CHW do cil
// (3 × 224 × 224 čísel)
func Predzpracovat(img image.Image, cil []float32) {
	predzpracovatDo(img, image.NewRGBA(image.Rect(0, 0, strana, strana)), cil)
}

func predzpracovatDo(img image.Image, m *image.RGBA, cil []float32) {
	draw.CatmullRom.Scale(m, m.Bounds(), img, img.Bounds(), draw.Src, nil)
	const plocha = strana * strana
	pix := m.Pix[:plocha*4]
	r, g, b := cil[:plocha], cil[plocha:2*plocha], cil[2*plocha:3*plocha]
	tr, tg, tb := &tabulkaCLIP[0], &tabulkaCLIP[1], &tabulkaCLIP[2]
	for p := range plocha {
		i := p * 4
		r[p] = tr[pix[i]]
		g[p] = tg[pix[i+1]]
		b[p] = tb[pix[i+2]]
	}
}

// Normalizovat vydělí vektor jeho délkou; false u nulového nebo neplatného vektoru
func Normalizovat(v []float32) bool {
	var n float64
	for _, x := range v {
		n += float64(x) * float64(x)
	}
	if n == 0 || math.IsNaN(n) || math.IsInf(n, 0) {
		return false
	}
	k := float32(1 / math.Sqrt(n))
	for i := range v {
		v[i] *= k
	}
	return true
}
