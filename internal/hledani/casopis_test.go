package hledani

import "testing"

// rok:1985-09@PH najde jen Penthouse, rok:1985-09 obě čísla toho měsíce (předpona vydání, jako u edice CZ)
func TestHledaniRokMesicSCasopisem(t *testing.T) {
	pet := Modelka{ID: 1, Jmeno: "Pet", Vydani: []string{"1985-09@PH"}}
	pm := Modelka{ID: 2, Jmeno: "Playmate", Vydani: []string{"1985-09"}}
	for dotaz, cekano := range map[string][]int{"rok:1985-09@PH": {1}, "rok:1985-09": {1, 2}} {
		var nalezene []int
		d := Pripravit(dotaz)
		for _, m := range []Modelka{pet, pm} {
			if d.Odpovida(&m, nil) {
				nalezene = append(nalezene, m.ID)
			}
		}
		if len(nalezene) != len(cekano) || nalezene[0] != cekano[0] {
			t.Errorf("%s: %v, čekáno %v", dotaz, nalezene, cekano)
		}
	}
}
