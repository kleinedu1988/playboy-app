package obsah

import (
	"math"
	"testing"
)

// Výřezy fotek (0.02.049): rámeček postavy ze sjednocení boxů, obličej s nejvyšší jistotou, uložení a načtení,
// fotka bez postavy je spočítaná (Ma), ale bez rámečku
func TestVyrezyFotek(t *testing.T) {
	v := NoveVyrezy()
	v.Pridat("a", []Box{
		{X: 0.30, Y: 0.20, S: 0.20, V: 0.30, Trida: 0, Jistota: 0.8},
		{X: 0.25, Y: 0.10, S: 0.10, V: 0.08, Trida: indexObliceje, Jistota: 0.6},
		{X: 0.40, Y: 0.12, S: 0.08, V: 0.08, Trida: indexObliceje, Jistota: 0.9},
	})
	v.Pridat("bez", nil)
	slozka := t.TempDir()
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}
	n, err := NacistVyrezy(slozka)
	if err != nil || n.Pocet() != 2 || !n.Ma("bez") {
		t.Fatalf("načtení: %v, %d", err, n.Pocet())
	}
	r, ok := n.Ramecek("a")
	blizko := func(a, b float64) bool { return math.Abs(a-b) < 0.005 }
	if !ok || !r.MaPostavu || !r.MaOblicej || !blizko(r.Postava[0], 0.25) || !blizko(r.Postava[1], 0.10) || !blizko(r.Postava[3], 0.50) || !blizko(r.Oblicej[0], 0.40) {
		t.Errorf("rámeček a: %+v", r)
	}
	if r, ok := n.Ramecek("bez"); !ok || r.MaPostavu {
		t.Errorf("bez postavy: %+v %v", r, ok)
	}
	if _, ok := n.Ramecek("neni"); ok {
		t.Error("nespočítaná fotka nemá rámeček")
	}
	// Postava v horní polovině fotky na výšku: výřez pro čtvercovou dlaždici jde nahoru, ne na střed
	if vy, ok := r.VyrezRamu(3.0/4, 1); !ok || vy.Y >= 50 {
		t.Errorf("výřez pro čtverec: %+v %v", vy, ok)
	}
	if _, ok := (RamecekFotky{}).VyrezRamu(3.0/4, 1); ok {
		t.Error("bez postavy není výřez")
	}
}
