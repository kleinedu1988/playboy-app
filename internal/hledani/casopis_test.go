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

// Číslo z textu vystoupení (0.02.036): Heide Mann „Penthouse říjen 1970“, vydání 1970-10, album bez čísla
func TestCisloZTextuVystoupeni(t *testing.T) {
	nazvy := map[string]string{"PB": "Playboy", "PH": "Penthouse", "HU": "Hustler"}
	if v := CasopisPodleTextu("1970-10", "Penthouse říjen 1970", nazvy); v != "1970-10@PH" {
		t.Errorf("Heide Mann: %q", v)
	}
	if v := CasopisPodleTextu("1970-10", "Playboy říjen 1970", nazvy); v != "1970-10" {
		t.Errorf("Playboy: %q", v)
	}
	if v := CasopisPodleTextu("1970-11", "Penthouse říjen 1970", nazvy); v != "1970-11" {
		t.Errorf("jiný měsíc: %q", v)
	}
	if v := CasopisPodleTextu("2016-04", "Penthouse duben 2016", nazvy); v != "2016-04@PH" {
		t.Errorf("Jenna Sativa: %q", v)
	}
	if v := CasopisPodleTextu("1990-01", "Hustler, Penthouse 1990", nazvy); v != "1990-01" {
		t.Errorf("dva časopisy: %q", v)
	}
	if v := JedinoCisloModelky("1970-10", "Penthouse říjen 1970", nazvy); v != "1970-10@PH" {
		t.Errorf("jediné číslo: %q", v)
	}
	if v := JedinoCisloModelky("", "Penthouse October 1970", nazvy); v != "1970-10@PH" {
		t.Errorf("z textu: %q", v)
	}
	if v := JedinoCisloModelky("1970-10\n1971-02", "Penthouse 1970", nazvy); v != "" {
		t.Errorf("dvě čísla: %q", v)
	}
}
