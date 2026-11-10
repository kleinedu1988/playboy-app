package main

import "testing"

func TestVkusVCase(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	a.SetHodnoceni(anna, 4)
	a.SetHodnoceni(anna, 4) // beze změny se nezapíše
	a.SetHodnoceni(anna, 3.5)
	a.PorovnatModelky(anna, bara, "b")
	v := a.GetVkusVCase()
	if len(v.Srdicka) != 2 || v.Srdicka[0].Pred != 0 || v.Srdicka[0].Po != 4 || v.Srdicka[1].Po != 3.5 || v.Srdicka[1].Modelka != anna {
		t.Fatalf("srdíčka: %+v", v.Srdicka)
	}
	if len(v.Porovnani) != 1 || v.Porovnani[0].Vitez != bara || v.Porovnani[0].Porazena != anna || len(v.Porovnani[0].Den) != 10 {
		t.Fatalf("porovnání: %+v", v.Porovnani)
	}
}
