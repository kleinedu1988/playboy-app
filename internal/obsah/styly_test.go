package obsah

import (
	"fmt"
	"math/rand/v2"
	"os"
	"path/filepath"
	"testing"
)

// Shluky kolem vektorů popisů stylů dostanou jejich názvy; styly.json se uloží a načte
func TestShlukovaniAPojmenovaniStylu(t *testing.T) {
	r := rand.New(rand.NewPCG(5, 6))
	v := NoveVektory()
	ocekavane := []string{"auto", "bikiny", "cernobile", "snih"}
	for _, klic := range ocekavane {
		for i := range 80 {
			v.Pridat(fmt.Sprintf("%s-%d", klic, i), blizky(r, vektoryStylu[klic], 0.03))
		}
	}
	prirazeni, stredy := v.Shlukovat(len(ocekavane), 25)
	nazvy, shody := pojmenovat(stredy)
	nalezene := map[string]bool{}
	for c, n := range nazvy {
		if shody[c] < 0.5 {
			t.Fatalf("shoda %v", shody)
		}
		nalezene[n] = true
	}
	for _, k := range ocekavane {
		if !nalezene[k] {
			t.Fatalf("chybí %s, názvy %v", k, nazvy)
		}
	}
	// Fotky jednoho stylu v jednom shluku
	if prirazeni[0] != prirazeni[79] || prirazeni[0] == prirazeni[80] {
		t.Fatalf("přiřazení %v", prirazeni[:2])
	}

	slozka := t.TempDir()
	s := NovaSluzba(slozka, nil, Zdroje{})
	s.vektory = v
	if err := s.SpocitatStyly(); err != nil {
		t.Fatal(err)
	}
	st := s.Styly()
	if len(st) != len(ocekavane) || len(st[0].Fotky) != 80 || st[0].Nazev == "" {
		t.Fatalf("uložené styly %+v", st)
	}
	if _, err := os.Stat(filepath.Join(slozka, nazevStylu)); err != nil {
		t.Fatal(err)
	}
}

// Každý popis stylu má vestavěný vektor (po změně PopisyStylu spustit generátor)
func TestVektoryPopisuStylu(t *testing.T) {
	for _, p := range PopisyStylu {
		if len(vektoryStylu[p.Klic]) != Rozmer {
			t.Errorf("styl %s nemá vektor ve styly.bin", p.Klic)
		}
	}
}
