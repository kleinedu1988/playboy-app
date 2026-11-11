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

// Textová vydání bez časopisu podle alb (0.02.032)
func TestCasopisPodleAlb(t *testing.T) {
	for _, p := range []struct {
		text string
		alba []string
		chci string
	}{
		{"1969-11", []string{"1969-11@PH"}, "1969-11@PH"},
		{"1969-11", []string{"1969-11@PH", "1969-11"}, "1969-11"},
		{"1969-11", []string{"1969-11@PH", "1969-11@HU"}, "1969-11"},
		{"1969-11\n1970-02", []string{"1969-11@PH", "1970-02"}, "1969-11@PH\n1970-02"},
		{"1969-11@PH", []string{"1969-11@PH"}, "1969-11@PH"},
		{"1985-09", nil, "1985-09"},
	} {
		if v := CasopisPodleAlb(p.text, p.alba); v != p.chci {
			t.Errorf("%q %v: %q, chci %q", p.text, p.alba, v, p.chci)
		}
	}
}
