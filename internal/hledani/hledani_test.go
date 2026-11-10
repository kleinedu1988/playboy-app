package hledani

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
)

func testOdpovidaHledani(m Modelka, vyhledavani string) bool {
	return Pripravit(vyhledavani).Odpovida(&m, nil)
}

// Rozbor dotazu: NEBO s hodnotami v uvozovkách, desetinná srdíčka, edice i podle obálek
func TestHledaniDotazy(t *testing.T) {
	a := Modelka{Jmeno: "Anna", VlasyBarva: "strawberry blond", Hodnoceni: 3.5, Vydani: []string{"1995-03"}, Obalky: []string{"1997-12-CZ"}}
	b := Modelka{Jmeno: "Bára", VlasyBarva: "černá", Hodnoceni: 4, Vydani: []string{"1971-02"}}
	pripady := []struct {
		dotaz string
		a, b  bool
	}{
		{`vlasy:černá,"strawberry blond"`, true, true},
		{`vlasy:"strawberry blond",černá`, true, true},
		{`vlasy:"strawberry blond"`, true, false},
		{`-vlasy:"strawberry blond",černá`, false, false},
		{`hodnoceni:>=3,5`, true, true},
		{`hodnoceni:>3,5`, false, true},
		{`hodnoceni:3,5`, true, false},
		{`hodnoceni:4`, false, true},
		{`edice:CZ`, true, false},
		{`edice:US rok:1971`, false, true},
	}
	for _, p := range pripady {
		if g := testOdpovidaHledani(a, p.dotaz); g != p.a {
			t.Errorf("%s: Anna %v, čekáno %v", p.dotaz, g, p.a)
		}
		if g := testOdpovidaHledani(b, p.dotaz); g != p.b {
			t.Errorf("%s: Bára %v, čekáno %v", p.dotaz, g, p.b)
		}
	}
}

// Shoda s frontendem: stejné dotazy nad stejnými modelkami (testdata/hledani-shoda.json, frontend/test/filtr.test.js)
func TestHledaniShodaSFrontendem(t *testing.T) {
	data, err := os.ReadFile("../../testdata/hledani-shoda.json")
	if err != nil {
		t.Fatal(err)
	}
	var shoda struct {
		Modelky []Modelka `json:"modelky"`
		Dotazy  []struct {
			Dotaz string `json:"dotaz"`
			Najde []int  `json:"najde"`
		} `json:"dotazy"`
	}
	if err := json.Unmarshal(data, &shoda); err != nil {
		t.Fatal(err)
	}
	for _, d := range shoda.Dotazy {
		var nalezene []int
		for _, m := range shoda.Modelky {
			if testOdpovidaHledani(m, d.Dotaz) {
				nalezene = append(nalezene, m.ID)
			}
		}
		if fmt.Sprint(nalezene) != fmt.Sprint(d.Najde) {
			t.Errorf("%s: našlo %v, čekáno %v", d.Dotaz, nalezene, d.Najde)
		}
	}
}

// Rychlá cesta COLLATE BEZDIAKRITIKY dává stejné pořadí jako porovnání zjednodušených textů
func TestPorovnatBezDiakritiky(t *testing.T) {
	texty := []string{"", "a", "A", "ab", "Ab", "abc", "b", "Anna", "anna", "Anna Nováková", "Anna Novakova", "Žaneta", "zaneta", "Čestmír",
		"cestmir", "Zoe", "zoe ", "Z", "_x", "1", "Ann", "Annb", "ANNA", "Éva", "Eva"}
	znamenko := func(n int) int {
		switch {
		case n < 0:
			return -1
		case n > 0:
			return 1
		}
		return 0
	}
	for _, a := range texty {
		for _, b := range texty {
			if x, y := znamenko(PorovnatBezDiakritiky(a, b)), znamenko(strings.Compare(Zjednodusit(a), Zjednodusit(b))); x != y {
				t.Errorf("%q vs %q: %d, čekáno %d", a, b, x, y)
			}
		}
	}
}

// Chytré hledání: obvody, BMI, poměr pas : boky, věk v prvním čísle a počet fotek, i s desetinnou čárkou
func TestDesetinnaPole(t *testing.T) {
	m := &Modelka{VyskaCm: 170, VahaKg: 52, ObvodHrudnikCm: 90, ObvodPasCm: 60, ObvodBokyCm: 88, NarozeniDatum: "1975-08-02",
		Vydani: []string{"1999-01", "1997-05-CZ"}, PocetFotek: 0}
	bez := &Modelka{PocetFotek: 3}
	pripady := []struct {
		dotaz      string
		m, bezUdaj bool
	}{
		{"pas:<=60", true, false}, {"pas:>60", false, false}, {"hrudnik:85-95", true, false}, {"boky:88", true, false},
		{"bmi:<18", true, false}, {"bmi:17..18", true, false}, {"bmi:17,9", true, false}, {"bmi:18", false, false},
		{"whr:<0,7", true, false}, {"whr:0,68", true, false}, {"whr:0.6-0.65", false, false},
		{"vek:21", true, false}, {"vek:<22", true, false}, {"vek:>21", false, false},
		{"fotek:0", true, false}, {"fotek:>0", false, true}, {"-fotek:0", false, true},
	}
	for _, p := range pripady {
		h := Pripravit(p.dotaz)
		if got := h.Odpovida(m, nil); got != p.m {
			t.Errorf("%s: modelka %v, chci %v", p.dotaz, got, p.m)
		}
		if got := h.Odpovida(bez, nil); got != p.bezUdaj {
			t.Errorf("%s: bez údajů %v, chci %v", p.dotaz, got, p.bezUdaj)
		}
	}
	// Věk: narozena v srpnu, první číslo v květnu 1997 → 21 let
	if v, ok := VekVPrvnimCisle(m); !ok || v != 21 {
		t.Fatalf("věk v prvním čísle %d %v", v, ok)
	}
}

func TestNeboAZavorky(t *testing.T) {
	anna := Modelka{ID: 1, Jmeno: "Anna", VlasyBarva: "blond", VyskaCm: 178, Vydani: []string{"1975-03"}}
	bara := Modelka{ID: 2, Jmeno: "Bára", VlasyBarva: "zrzavá", VyskaCm: 165, Vydani: []string{"1986-07"}}
	cecil := Modelka{ID: 3, Jmeno: "Cecílie", VlasyBarva: "černá", VyskaCm: 180, Vydani: []string{"1995-01"}}
	najdi := func(dotaz string) string {
		h := Pripravit(dotaz)
		v := ""
		for _, m := range []Modelka{anna, bara, cecil} {
			if h.Odpovida(&m, nil) {
				v += m.Jmeno[:1]
			}
		}
		return v
	}
	pripady := map[string]string{
		"vlasy:blond | vlasy:zrz":                       "AB",
		"(rok:1970-1979 | rok:1980-1989) vyska:>175":    "A",
		"(rok:1970-1979 | rok:1990-1999) vyska:>175":    "AC",
		"-(vlasy:blond | vlasy:zrz)":                    "C",
		"vlasy:blond |":                                 "A",
		"(rok:1980-1989":                                "B",
		`jmeno:"Anna | Bára"`:                           "",
		"vyska:>170 (vlasy:cern | jmeno:anna) rok:1995": "C",
	}
	for dotaz, cekam := range pripady {
		if v := najdi(dotaz); v != cekam {
			t.Errorf("%q: %q, čekám %q", dotaz, v, cekam)
		}
	}
}

func TestFotoVDotazu(t *testing.T) {
	anna := Modelka{ID: 1, Jmeno: "Anna"}
	bara := Modelka{ID: 2, Jmeno: "Bára"}
	h := Pripravit(`foto:"na pláži" | jmeno:bara`)
	if texty := h.TextyFotek(); len(texty) != 1 || texty[0] != "na pláži" {
		t.Fatalf("texty foto: %v", texty)
	}
	// Bez shod (obsah fotek není): foto: neomezuje, alternativa jmeno: dál platí
	if !Pripravit(`foto:"na pláži"`).Odpovida(&anna, nil) {
		t.Fatal("foto: bez shod má neomezovat")
	}
	h.NastavitShodyFotek("na pláži", map[int]float64{1: 4.2})
	if !h.Odpovida(&anna, nil) || !h.Odpovida(&bara, nil) {
		t.Fatal("anna podle fotek, bára podle jména")
	}
	h2 := Pripravit(`foto:"na pláži"`)
	h2.NastavitShodyFotek("na pláži", map[int]float64{1: 4.2})
	if !h2.Odpovida(&anna, nil) || h2.Odpovida(&bara, nil) {
		t.Fatal("foto: má najít jen annu")
	}
}
