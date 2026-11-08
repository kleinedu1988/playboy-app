package main

import (
	"fmt"
	"strings"
	"testing"
)

// Ideální modelka: zrzka, kterou hodnotíš ♥5, vychází v profilu vlasů; bez dost srdíček „málo“
func TestIdealniModelka(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	if v := a.GetIdealniModelka(); !v.Malo {
		t.Fatal("bez srdíček má být málo")
	}
	pridat := func(jmeno, vlasy, predpona string, pocet, srdicka int) {
		a.AddModelka(Modelka{Jmeno: jmeno, VlasyBarva: vlasy, Tetovani: -1, Piercing: -1})
		id := idModelky(t, a, jmeno)
		var ids []string
		for i := range pocet {
			ids = append(ids, fmt.Sprintf("%s%028d", predpona, i))
		}
		a.AddBulkPhotos(id, "Album "+jmeno, "Pictorial", strings.Join(ids, " "))
		if srdicka > 0 {
			var f []int
			for _, x := range a.GetFotografieModelky(id) {
				f = append(f, x.ID)
			}
			a.SetHodnoceniFotek(f, srdicka)
		}
	}
	pridat("Zrzka", "zrzavé", "Z", 40, 5)
	pridat("Blondýnka", "blond", "B", 60, 0)
	pridat("Brunetka", "hnědé", "H", 60, 0)
	v := a.GetIdealniModelka()
	if v.Malo || v.Oblibenych != 40 || len(v.Profil) == 0 || v.Profil[0].Skupina != "Vlasy" || v.Profil[0].Hodnota != "Zrzky" || v.Profil[0].Pomer < 3 {
		t.Fatalf("profil %+v", v)
	}
	if b := bezPodobnych([]VlastnostVkusu{{Hodnota: "Auta"}, {Hodnota: "Auta a motorky"}, {Hodnota: "Latex"}}); len(b) != 2 {
		t.Fatalf("bez podobných %v", b)
	}
}
