package obsah

import (
	"image"
	"image/color"
	"math"
	"testing"
)

func TestOtocitObrazek(t *testing.T) {
	// 3 × 2, červený bod vlevo nahoře
	img := image.NewRGBA(image.Rect(0, 0, 3, 2))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	cervena := func(m image.Image, x, y int) bool { r, _, _, _ := m.At(x, y).RGBA(); return r > 0 }
	o := OtocitObrazek(img, 90)
	if o.Bounds().Dx() != 2 || o.Bounds().Dy() != 3 || !cervena(o, 1, 0) {
		t.Error("90° po směru: levý horní roh má být vpravo nahoře")
	}
	o = OtocitObrazek(img, 180)
	if !cervena(o, 2, 1) {
		t.Error("180°")
	}
	o = OtocitObrazek(img, 270)
	if o.Bounds().Dx() != 2 || !cervena(o, 0, 2) {
		t.Error("270°: levý horní roh má být vlevo dole")
	}
	if OtocitObrazek(img, 360) != image.Image(img) {
		t.Error("360° = beze změny")
	}
}

func TestNavrhOtoceni(t *testing.T) {
	skore := [4]float64{0.60, 0.72, 0.55, 0.58}
	if u, r := NavrhOtoceni(skore, 0); u != 90 || math.Abs(r-0.12) > 1e-9 {
		t.Errorf("%d %f", u, r)
	}
	// Už otočená ve sbírce: rozdíl nulový
	if u, r := NavrhOtoceni(skore, 90); u != 90 || r != 0 {
		t.Errorf("otočená %d %f", u, r)
	}
	v := [4][]float32{{1, 0}, {0, 1}, {-1, 0}, {0, -1}}
	if s := SkoreOtoceni(v, []float32{0, 1}); s[1] != 1 || s[3] != -1 {
		t.Errorf("skóre %v", s)
	}
}

func TestBoxyZVystupu(t *testing.T) {
	kotev := 2
	out := make([]float32, (4+TridDetektoru)*kotev)
	// Kotva 0: obličej ve středu (160, 80), 40 × 40 bodů vstupu; kotva 1 pod prahem
	out[0], out[kotev], out[2*kotev], out[3*kotev] = 160, 80, 40, 40
	out[(4+indexObliceje)*kotev] = 0.9
	out[(4+indexObliceje)*kotev+1] = 0.1
	// Obrázek 400 × 800 → měřítko 800/320 = 2,5; obličej x 350–450 (oříznuto na 400), y 150–250 bodů obrázku
	boxy := boxyZVystupu(out, kotev, 400, 800)
	if len(boxy) != 1 {
		t.Fatalf("boxů %d", len(boxy))
	}
	b := boxy[0]
	if math.Abs(b.X-0.875) > 1e-6 || math.Abs(b.S-0.125) > 1e-6 || math.Abs(b.Y-0.1875) > 1e-6 || math.Abs(b.V-0.125) > 1e-6 || b.Trida != indexObliceje {
		t.Errorf("%+v", b)
	}
}

func TestNavrhVyrezu(t *testing.T) {
	if _, ok := NavrhVyrezu(nil, 1, 0.75); ok {
		t.Error("bez boxů nic")
	}
	// Široká fotka 3:2, postava vpravo (x 0,6–0,9, y 0,1–0,9) s obličejem nahoře: výška postavy s okrajem
	// 0,896 → přiblížení 1,12; viditelná šířka 0,5/1,12 se posune doprava ke středu postavy 0,75
	boxy := []Box{{X: 0.6, Y: 0.1, S: 0.3, V: 0.8}, {X: 0.7, Y: 0.1, S: 0.1, V: 0.1, Trida: indexObliceje}}
	v, ok := NavrhVyrezu(boxy, 1.5, 0.75)
	if !ok || v.Zoom != 1.12 || v.X < 90 {
		t.Errorf("široká: %+v", v)
	}
	vidiZac := func(p, f, z float64) float64 { return p / 100 * (1 - f/z) }
	if zac := vidiZac(v.X, 0.5, v.Zoom); zac > 0.6 || zac+0.5/v.Zoom < 0.9 {
		t.Errorf("postava není celá ve výřezu: %+v", v)
	}
	// Malá postava (y 0,3–0,8) uprostřed fotky s poměrem rámu: přiblížit, obličej ve výřezu s místem nad hlavou
	boxy = []Box{{X: 0.4, Y: 0.5, S: 0.2, V: 0.3}, {X: 0.45, Y: 0.3, S: 0.1, V: 0.08, Trida: indexObliceje}}
	v, _ = NavrhVyrezu(boxy, 0.75, 0.75)
	if v.Zoom < 1.7 || v.Zoom > 1.85 || v.X != 50 {
		t.Errorf("přiblížení %+v", v)
	}
	if zac := vidiZac(v.Y, 1, v.Zoom); zac > 0.3 || zac < 0.2 {
		t.Errorf("obličej mimo výřez: %+v (začátek %f)", v, zac)
	}
}
