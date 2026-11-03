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
