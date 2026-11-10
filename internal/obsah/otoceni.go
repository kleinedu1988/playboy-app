package obsah

// Otočené fotky a návrh výřezu (ROADMAP 1.45).
//
// Otočení: náhled se otočí o 90°, 180° a 270° (po směru hodinových ručiček, jako CSS rotate a sloupec
// fotky.rotace) a každá varianta dostane vektor CLIP. Varianta nejpodobnější středu vektorů sbírky (většina fotek
// je rovně, střed tedy říká „takhle vypadá rovná fotka ze sbírky“) je nejspíš správná orientace.
//
// Výřez: detektor NudeNet vrací pro každé místo mřížky box (střed, šířka, výška v bodech vstupu 320 × 320)
// a jistoty tříd. Sjednocení boxů ženských tříd nad prahem je postava, obličej se drží v horní části výřezu.
// Obličeje se nerozpoznávají (kdo to je), jen se najde, kde na fotce obličej je.

import (
	"errors"
	"image"
	"math"
)

// Úhly otočení v pořadí skóre
var UhlyOtoceni = [4]int{0, 90, 180, 270}

// OtocitObrazek otočí obrázek o uhel stupňů po směru hodinových ručiček (0, 90, 180, 270)
func OtocitObrazek(img image.Image, uhel int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	uhel = ((uhel % 360) + 360) % 360
	if uhel == 0 {
		return img
	}
	var cil *image.RGBA
	if uhel == 180 {
		cil = image.NewRGBA(image.Rect(0, 0, w, h))
	} else {
		cil = image.NewRGBA(image.Rect(0, 0, h, w))
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := img.At(b.Min.X+x, b.Min.Y+y)
			switch uhel {
			case 90:
				cil.Set(h-1-y, x, c)
			case 180:
				cil.Set(w-1-x, h-1-y, c)
			case 270:
				cil.Set(y, w-1-x, c)
			}
		}
	}
	return cil
}

// SkoreOtoceni: podobnost vektorů variant (0°, 90°, 180°, 270°) se středem sbírky
func SkoreOtoceni(vektory [4][]float32, stred []float32) [4]float64 {
	var s [4]float64
	for i, v := range vektory {
		if len(v) == len(stred) {
			s[i] = float64(skalarni(v, stred))
		}
	}
	return s
}

// NavrhOtoceni: úhel s nejvyšším skóre a o kolik je lepší než současná orientace (rotace fotky ve sbírce)
func NavrhOtoceni(skore [4]float64, soucasna int) (uhel int, rozdil float64) {
	soucasna = ((soucasna % 360) + 360) % 360 / 90
	nej := 0
	for i := range skore {
		if skore[i] > skore[nej] {
			nej = i
		}
	}
	return UhlyOtoceni[nej], skore[nej] - skore[soucasna]
}

// Box postavy nebo partie v podílech obrázku (0–1)
type Box struct {
	X, Y, S, V float64 // levý horní roh, šířka, výška
	Trida      int
	Jistota    float32
}

// Třídy, které tvoří postavu (bez mužských); obličej zvlášť
var tridyPostavy = map[string]bool{
	"FEMALE_GENITALIA_COVERED": true, "FACE_FEMALE": true, "BUTTOCKS_EXPOSED": true, "FEMALE_BREAST_EXPOSED": true,
	"FEMALE_GENITALIA_EXPOSED": true, "FEET_EXPOSED": true, "BELLY_COVERED": true, "FEET_COVERED": true,
	"ARMPITS_COVERED": true, "ARMPITS_EXPOSED": true, "BELLY_EXPOSED": true, "ANUS_COVERED": true,
	"FEMALE_BREAST_COVERED": true, "BUTTOCKS_COVERED": true,
}

const prahBoxu = 0.35

// boxyZVystupu: boxy nad prahem z výstupu YOLOv8 [4+tříd, kotev] pro obrázek sirka × vyska
func boxyZVystupu(out []float32, kotev, sirka, vyska int) []Box {
	k := float64(max(sirka, vyska)) / stranaDetektoru
	var boxy []Box
	for i := range kotev {
		nejT, nejJ := -1, float32(prahBoxu)
		for t := range TridyDetektoru {
			if j := out[(4+t)*kotev+i]; j >= nejJ && tridyPostavy[TridyDetektoru[t]] {
				nejT, nejJ = t, j
			}
		}
		if nejT < 0 {
			continue
		}
		cx, cy, w, h := float64(out[i])*k, float64(out[kotev+i])*k, float64(out[2*kotev+i])*k, float64(out[3*kotev+i])*k
		x0, y0 := math.Max(0, (cx-w/2)/float64(sirka)), math.Max(0, (cy-h/2)/float64(vyska))
		x1, y1 := math.Min(1, (cx+w/2)/float64(sirka)), math.Min(1, (cy+h/2)/float64(vyska))
		if x1 <= x0 || y1 <= y0 {
			continue
		}
		boxy = append(boxy, Box{X: x0, Y: y0, S: x1 - x0, V: y1 - y0, Trida: nejT, Jistota: nejJ})
	}
	return boxy
}

// BoxyObrazku: boxy ženských tříd nad prahem (bez potlačení překryvů – pro sjednocení postavy netřeba)
func (d *Detektor) BoxyObrazku(img image.Image) ([]Box, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.sezeni == nil {
		return nil, errors.New("detektor je zavřený")
	}
	predzpracovatDetektorDo(img, d.rgba, d.vstup.GetData())
	if err := d.sezeni.Run(); err != nil {
		return nil, err
	}
	b := img.Bounds()
	return boxyZVystupu(d.vystup.GetData(), kotevDetektoru, b.Dx(), b.Dy()), nil
}

// Výřez titulní fotky jako ve sbírce: přiblížení 1–4 a poloha 0–100 % (object-position a transform-origin)
type Vyrez struct {
	Zoom float64 `json:"zoom"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}

const (
	maxZoomNavrhu = 2.5
	okrajPostavy  = 1.12 // postava zabere nejvýš 1/1,12 výřezu
)

var indexObliceje = func() int {
	for i, t := range TridyDetektoru {
		if t == "FACE_FEMALE" {
			return i
		}
	}
	return -1
}()

// NavrhVyrezu: výřez pro rám s poměrem stran pomerRamu (šířka/výška, karta 3/4) a obrázek s poměrem pomerObrazku.
// Viditelný podíl obrázku při přiblížení z a poloze p je v každé ose [p·(1−f/z), p·(1−f/z) + f/z], kde f je
// viditelný podíl bez přiblížení (object-fit: cover). ok = false, když detektor postavu nenašel.
func NavrhVyrezu(boxy []Box, pomerObrazku, pomerRamu float64) (Vyrez, bool) {
	if len(boxy) == 0 || pomerObrazku <= 0 || pomerRamu <= 0 {
		return Vyrez{Zoom: 1, X: 50, Y: 50}, false
	}
	x0, y0, x1, y1 := 1.0, 1.0, 0.0, 0.0
	tvar := -1.0 // horní okraj obličeje
	for _, b := range boxy {
		x0, y0 = math.Min(x0, b.X), math.Min(y0, b.Y)
		x1, y1 = math.Max(x1, b.X+b.S), math.Max(y1, b.Y+b.V)
		if b.Trida == indexObliceje && (tvar < 0 || b.Y < tvar) {
			tvar = b.Y
		}
	}
	fw, fh := math.Min(1, pomerRamu/pomerObrazku), math.Min(1, pomerObrazku/pomerRamu)
	z := math.Min(fw/((x1-x0)*okrajPostavy), fh/((y1-y0)*okrajPostavy))
	z = math.Max(1, math.Min(maxZoomNavrhu, z))
	wz, hz := fw/z, fh/z
	// Vodorovně na střed postavy, svisle taky – jen obličej musí zůstat ve výřezu s kouskem místa nad hlavou
	zacX := (x0+x1)/2 - wz/2
	zacY := (y0+y1)/2 - hz/2
	if tvar >= 0 && tvar < zacY+0.06*hz {
		zacY = tvar - 0.06*hz
	}
	poloha := func(zac, viditelne float64) float64 {
		if viditelne >= 1 {
			return 50
		}
		return math.Round(math.Max(0, math.Min(1, zac/(1-viditelne)))*1000) / 10
	}
	return Vyrez{Zoom: math.Round(z*100) / 100, X: poloha(zacX, wz), Y: poloha(zacY, hz)}, true
}

// StredVsech: střed vektorů všech fotek sbírky (reference „rovné fotky“ pro otočení); nil bez vektorů
func (s *Sluzba) StredVsech() []float32 {
	if s == nil || s.slozka == "" {
		return nil
	}
	s.mu.Lock()
	if s.vektory == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	v.mu.RLock()
	ids := make([]string, 0, len(v.index))
	for id := range v.index {
		ids = append(ids, id)
	}
	v.mu.RUnlock()
	return v.Stred(ids)
}

// Slozka obsahu (modely pro otočení a výřez otevírá aplikace sama)
func (s *Sluzba) Slozka() string {
	if s == nil {
		return ""
	}
	return s.slozka
}
