package main

import "testing"

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
		if g := odpovidaHledani(a, p.dotaz); g != p.a {
			t.Errorf("%s: Anna %v, čekáno %v", p.dotaz, g, p.a)
		}
		if g := odpovidaHledani(b, p.dotaz); g != p.b {
			t.Errorf("%s: Bára %v, čekáno %v", p.dotaz, g, p.b)
		}
	}
}
