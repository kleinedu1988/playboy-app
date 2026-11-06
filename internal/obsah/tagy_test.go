package obsah

import (
	"testing"

	"playboy-app/internal/sbirka"
)

// Každý tag katalogu má popis i vestavěný vektor (po změně katalogu nebo popisů spustit generátor tagy-clip)
func TestTagyMajiVektory(t *testing.T) {
	popsane := map[string]bool{}
	for _, p := range PopisyTagu {
		popsane[p.Klic] = true
		if len(vektoryTagu[p.Klic]) != Rozmer {
			t.Errorf("popis %s nemá vektor v tagy.bin (spustit tagy-clip)", p.Klic)
		}
		if p.Klic[0] != zadnyTag[0] && sbirka.SkupinaTaguMap[p.Klic] == nil {
			t.Errorf("popis %s nepatří žádnému tagu katalogu", p.Klic)
		}
	}
	for _, sk := range sbirka.KatalogTagu {
		for _, tag := range sk.Tagy {
			if !popsane[tag.Klic] && !bezNavrhu[tag.Klic] {
				t.Errorf("tag %s nemá popis v PopisyTagu ani není v bezNavrhu", tag.Klic)
			}
		}
	}
}

// Vektor rovný popisu tagu dostane ten tag; ze sady nejvýš jeden
func TestNavrhnoutTagy(t *testing.T) {
	v := append([]float32(nil), vektoryTagu["plaz"]...)
	Normalizovat(v)
	navrhy := NavrhnoutTagy(v)
	ma := map[string]bool{}
	for _, n := range navrhy {
		if ma[n.Tag] || bezNavrhu[n.Tag] || jenMoznost[n.Tag] {
			t.Fatalf("návrh %s: %+v", n.Tag, navrhy)
		}
		ma[n.Tag] = true
	}
	if !ma["plaz"] {
		t.Fatalf("pláž chybí: %+v", navrhy)
	}
	v = append([]float32(nil), vektoryTagu["poprsi"]...)
	Normalizovat(v)
	for _, n := range NavrhnoutTagy(v) {
		if n.Tag == "poprsi" {
			t.Fatal("tag jen jako možnost se navrhl")
		}
	}
	if NavrhnoutTagy(nil) != nil {
		t.Fatal("bez vektoru nic")
	}
}
