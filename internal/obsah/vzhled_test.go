package obsah

import (
	"image"
	"image/color"
	"math/rand/v2"
	"testing"
)

func jednobarevny(c color.RGBA) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, 300, 400))
	for i := 0; i < len(img.Pix); i += 4 {
		img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = c.R, c.G, c.B, 255
	}
	return img
}

// Odstíny, barevnost, teplota a ostrost z jednoduchých obrázků
func TestVzhledObrazku(t *testing.T) {
	cervena := vzhledObrazku(jednobarevny(color.RGBA{220, 20, 30, 255}))
	if cervena.Odstiny[0] < 0.99 || cervena.Barevnost < 0.99 || cervena.Teplota < 0.8 || cervena.Ostrost > 0.05 {
		t.Fatalf("červená %+v", cervena)
	}
	modra := vzhledObrazku(jednobarevny(color.RGBA{20, 60, 220, 255}))
	if modra.Odstiny[8] < 0.99 || modra.Teplota > 0.2 {
		t.Fatalf("modrá %+v", modra)
	}
	seda := vzhledObrazku(jednobarevny(color.RGBA{128, 128, 128, 255}))
	if seda.Barevnost != 0 || seda.Sytost != 0 || seda.Jas < 0.49 || seda.Jas > 0.52 {
		t.Fatalf("šedá %+v", seda)
	}
	sum := jednobarevny(color.RGBA{128, 128, 128, 255})
	r := rand.New(rand.NewPCG(1, 2))
	for i := 0; i < len(sum.Pix); i += 4 {
		x := uint8(r.IntN(256))
		sum.Pix[i], sum.Pix[i+1], sum.Pix[i+2] = x, x, x
	}
	if o := vzhledObrazku(sum); o.Ostrost < 0.7 || o.Kontrast < 0.3 {
		t.Fatalf("šum %+v", o)
	}
}

// Uložení a načtení vzhled.bin
func TestUlozitNacistVzhled(t *testing.T) {
	slozka := t.TempDir()
	v := NovyVzhled()
	x := vzhledObrazku(jednobarevny(color.RGBA{220, 20, 30, 255}))
	v.Pridat("a", x)
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}
	n, err := NacistVzhled(slozka)
	if err != nil {
		t.Fatal(err)
	}
	y, ok := n.Fotky("a")
	if !ok || y.Odstiny[0] < 0.99 || y.Barevnost < 0.99 || n.Pocet() != 1 {
		t.Fatalf("načteno %+v", y)
	}
}
