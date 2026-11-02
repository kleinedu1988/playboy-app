package main

import "testing"

func TestPodminkyModelky(t *testing.T) {
	ceska := &Modelka{Narodnost: "Česká", OciBarva: "Modrozelené", Piercing: 1, Tetovani: 0, PlaymateRoku: "1998"}
	americka := &Modelka{Narodnost: "American", Centerfoldy: []string{"1995-06"}, CyberGirl: "týdne", Obalky: []string{"1996-01"}, Piercing: 0}
	nezname := &Modelka{Narodnost: "Atlantida", Piercing: -1, Tetovani: -1}
	for _, c := range []struct {
		m       *Modelka
		klic, h string
		ano     bool
	}{
		{ceska, "narodnost", "cesko", true}, {ceska, "narodnost", "slovensko", false},
		{americka, "narodnost", "usa", true}, {nezname, "narodnost", "usa", false},
		{ceska, "oci", "modr", true}, {ceska, "oci", "zelen", true}, {americka, "oci", "modr", false},
		{ceska, "piercing", "ano", true}, {americka, "piercing", "ne", true}, {nezname, "piercing", "ne", false},
		{ceska, "tetovani", "ne", true}, {nezname, "tetovani", "ne", false},
		{ceska, "kategorie", "pmr", true}, {americka, "kategorie", "pmr", false},
		{americka, "kategorie", "pmm", true}, {americka, "kategorie", "cg", true}, {americka, "kategorie", "obalka", true},
		{ceska, "kategorie", "obalka", false},
	} {
		if modelkaMaHodnotu(c.m, c.klic, c.h) != c.ano {
			t.Errorf("%s=%s u %q: čekáno %v", c.klic, c.h, c.m.Narodnost, c.ano)
		}
	}
	for _, spatny := range []string{"modelka:narodnost=atlantida", "modelka:kategorie=kralovna", "modelka:piercing=asi", "modelka:vyska=170"} {
		if temaZKlice(spatny) != nil {
			t.Errorf("neplatný klíč %q prošel", spatny)
		}
	}
	for klic, nazev := range map[string]string{
		"modelka:narodnost=cesko,slovensko":                "Krásky od nás",
		"modelka:narodnost=japonsko":                       "Japonsko",
		"modelka:kategorie=cg+tag:podpatky":                "Cyber Girls · Podpatky",
		"modelka:piercing=ano":                             "S piercingem",
		"fotka:edice=CZ+modelka:narodnost=cesko,slovensko": "Domácí scéna",
	} {
		if tm := temaZKlice(klic); tm == nil || tm.Nazev != nazev {
			t.Errorf("%q: %+v, čekáno %q", klic, tm, nazev)
		}
	}
}
