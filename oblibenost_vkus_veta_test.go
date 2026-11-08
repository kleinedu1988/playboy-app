package main

import "testing"

// Slovník údajů: tvary frází a skladba věty
func TestSlovnikVety(t *testing.T) {
	for _, x := range []struct{ dostal, chci string }{
		{jmenoPodleVlasu("zrzavá"), "Zrzka"}, {jmenoPodleVlasu("kaštanová"), "Brunetka"}, {jmenoPodleVlasu("blond"), "Blondýnka"},
		{barvaMnozne("modrá"), "modré"}, {zDesetileti(1990), "z 90. let"}, {zDesetileti(2010), "z desátých let"},
		{frazeRole("PMOTM"), "byla Playmate měsíce"}, {frazeRole("Herčka"), "hraje i ve filmech"}, {frazeRole("Model"), ""},
		{zemeVkusu[zjednodusit("Norsko")], "z Norska"}, {zemeVkusu[zjednodusit("maltská")], "z Malty"},
		{vycet([]string{"a", "b", "c"}), "a, b a c"}, {castostSlovy(158, 207), "zhruba ve 3 ze 4 případů"},
		{frazeCisla(cvVyska, 170).text, "měří 170 cm"}, {frazeCisla(cvVek, 21).text, "Na prvních fotkách jí bylo 21 let."},
	} {
		if x.dostal != x.chci {
			t.Errorf("%q, chci %q", x.dostal, x.chci)
		}
	}
}
