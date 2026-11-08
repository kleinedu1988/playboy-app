package main

import (
	"fmt"
	"testing"
)

// Čtveřice: různé modelky, volba zapíše tři porovnání (vítězka vyhrává), vrácení je smaže; lákadlo a pořadí
func TestCtverice(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	urovne := []float64{2, 3, 3, 3, 3.5, 3.5, 4, 4, 4, 4, 5, 5, 4.5, 4.5, 3, 2.5}
	for i, h := range urovne {
		j := fmt.Sprintf("M%02d", i)
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), h)
	}
	ctverice := a.GetCtvericeKPorovnani(3)
	if len(ctverice) == 0 {
		t.Fatal("žádná čtveřice")
	}
	pouzite := map[int]bool{}
	for _, c := range ctverice {
		if len(c.Modelky) < 3 || len(c.Modelky) > 4 || c.Duvod == "" {
			t.Fatalf("čtveřice %+v", c)
		}
		for _, id := range c.Modelky {
			if pouzite[id] {
				t.Fatalf("modelka %d ve dvou čtveřicích: %+v", id, ctverice)
			}
			pouzite[id] = true
		}
	}
	c := ctverice[0]
	predtim := len(a.uc.nacistPorovnani())
	if !a.PorovnatCtverici(c.Modelky, c.Modelky[1]) {
		t.Fatal("volba se nezapsala")
	}
	po := a.uc.nacistPorovnani()
	if len(po)-predtim != len(c.Modelky)-1 {
		t.Fatalf("zapsáno %d porovnání", len(po)-predtim)
	}
	for _, p := range po[predtim:] {
		if p.a != c.Modelky[1] || p.vysledek != "a" {
			t.Fatalf("porovnání %+v", p)
		}
	}
	if a.PorovnatCtverici(c.Modelky, 999999) {
		t.Fatal("vítězka mimo čtveřici se nemá zapsat")
	}
	if !a.VratitCtverici(c.Modelky, c.Modelky[1]) || len(a.uc.nacistPorovnani()) != predtim {
		t.Fatal("vrácení volby")
	}
	if len(a.GetPoradiModelek(c.Modelky)) != len(c.Modelky) {
		t.Fatal("pořadí modelek")
	}
	if a.GetLakadloPorovnani() == "" {
		t.Fatal("lákadlo")
	}
}
