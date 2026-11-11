package main

import (
	"slices"
	"strings"
	"testing"
)

// Stejná data ve všech pohledech (0.02.046): vzorová sbírka s Playboyem, Penthouse a Hustlerem. Časopisy modelky
// v hledání (casopis:) odpovídají kariéře v profilu (čísla alb, centerfoldy, obálky, textová vydání pictorialů,
// online alba = Playboy), titul jiného časopisu je v kategoriích i v kalendáři čísla
func TestStejnaDataVePohledech(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, m := range []Modelka{
		{Jmeno: "Pb Centerfold"}, {Jmeno: "Ph Pet"}, {Jmeno: "Hu Honey"}, {Jmeno: "Jen Online"},
		{Jmeno: "Text Penthouse", PictorialVydani: "1992-03@PH"},
	} {
		m.Tetovani, m.Piercing = -1, -1
		a.AddModelka(m)
	}
	id := map[string]int{}
	for _, m := range a.GetModelky("") {
		id[m.Jmeno] = m.ID
	}
	odkaz := func(z string) string { return "https://drive.google.com/file/d/" + strings.Repeat(z, 29) + "/view" }
	a.AddBulkPhotos(id["Pb Centerfold"], "1975-01", "Centerfold", odkaz("A"))
	a.AddBulkPhotos(id["Ph Pet"], "1985-09@PH", "Centerfold", odkaz("B"))
	a.AddBulkPhotos(id["Hu Honey"], "Honey of the Month May 1990", typPMMesice, odkaz("C"))
	a.AddBulkPhotos(id["Jen Online"], "Beach Day", typOnline, odkaz("D"))
	a.db.Exec(`UPDATE alba SET vydani = album WHERE typ = 'Centerfold'`)
	a.db.Exec(`UPDATE alba SET vydani = '1990-05@HU' WHERE album LIKE 'Honey of the Month%'`)
	a.db.Exec(`UPDATE alba SET vydani = '2015-06-01' WHERE album = 'Beach Day'`)

	jmena := func(dotaz string) []string {
		var v []string
		for _, m := range a.GetModelky(dotaz) {
			v = append(v, m.Jmeno)
		}
		slices.Sort(v)
		return v
	}
	for dotaz, chci := range map[string][]string{
		"casopis:pb":                     {"Jen Online", "Pb Centerfold"},
		"casopis:ph":                     {"Ph Pet", "Text Penthouse"},
		"casopis:hu":                     {"Hu Honey"},
		`kategorie:"pet of the month"`:   {"Ph Pet"},
		`kategorie:"honey of the month"`: {"Hu Honey"},
		`kategorie:"playmate měsíce"`:    {"Pb Centerfold"},
	} {
		if v := jmena(dotaz); !slices.Equal(v, chci) {
			t.Errorf("%s: %v, chci %v", dotaz, v, chci)
		}
	}
	k := map[string]VydaniKalendare{}
	for _, v := range a.GetKalendar() {
		k[v.Vydani] = v
	}
	for cislo, chci := range map[string]string{"1975-01": "Pb Centerfold", "1985-09@PH": "Ph Pet", "1990-05@HU": "Hu Honey"} {
		if v := k[cislo]; v.ModelkaCisla != chci {
			t.Errorf("kalendář %s: %+v, chci %s", cislo, v, chci)
		}
	}
}
