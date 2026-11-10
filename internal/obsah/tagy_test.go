package obsah

import (
	"testing"

	"pinup-katalog/internal/sbirka"
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
	navrhy := NavrhnoutTagy(v, nil)
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
	for _, n := range NavrhnoutTagy(v, nil) {
		if n.Tag == "poprsi" {
			t.Fatal("tag jen jako možnost se navrhl")
		}
	}
	if NavrhnoutTagy(nil, nil) != nil {
		t.Fatal("bez vektoru nic")
	}
}

// Detektor: odhalený klín = akt a vagina, odhalená prsa = nahoře bez; nic odhaleného = oblečená nebo prádlo
func TestNavrhyZDetektoru(t *testing.T) {
	partie := func(j map[string]float32) []float32 {
		p := make([]float32, len(TridyDetektoru))
		for i, tr := range TridyDetektoru {
			p[i] = j[tr]
		}
		return p
	}
	tagy := func(n []NavrhTagu) map[string]bool {
		m := map[string]bool{}
		for _, x := range n {
			m[x.Tag] = true
		}
		return m
	}
	akt := tagy(NavrhnoutTagy(nil, partie(map[string]float32{"FEMALE_GENITALIA_EXPOSED": 0.7, "FEMALE_BREAST_EXPOSED": 0.8})))
	if !akt["akt"] || !akt["vagina"] || !akt["prsa"] || akt["nahore_bez"] {
		t.Fatalf("akt: %v", akt)
	}
	bez := tagy(NavrhnoutTagy(nil, partie(map[string]float32{"FEMALE_BREAST_EXPOSED": 0.6, "FEMALE_GENITALIA_EXPOSED": 0.3})))
	if !bez["nahore_bez"] || bez["akt"] || bez["vagina"] {
		t.Fatalf("nahoře bez: %v", bez)
	}
	v := append([]float32(nil), vektoryTagu["oblecena"]...)
	Normalizovat(v)
	obl := tagy(NavrhnoutTagy(v, partie(map[string]float32{"FACE_FEMALE": 0.9})))
	if !obl["oblecena"] || obl["pradlo"] {
		t.Fatalf("oblečená: %v", obl)
	}
	// Napůl jistá prsa: odhalení se nenavrhuje vůbec
	nejiste := tagy(NavrhnoutTagy(v, partie(map[string]float32{"FEMALE_BREAST_EXPOSED": 0.35})))
	for _, x := range []string{"oblecena", "pradlo", "nahore_bez", "akt"} {
		if nejiste[x] {
			t.Fatalf("nejisté odhalení navrhlo %s", x)
		}
	}
}
