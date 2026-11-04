package main

import (
	"reflect"
	"testing"
)

// Srdíčko u fotky paměť témat nezahodí (fotky i výsledky přejdou na nový snímek); tag, album a údaj modelky ano
func TestPametTematPrezijeSrdicko(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka", VlasyBarva: "Blond"})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA+" "+odkazB)
	fotky := a.GetFotografieModelky(1)
	a.GetNavrhSezony()
	p := a.pametTemat()
	puvodni := a.fotkyProTemata()
	if len(puvodni) != 2 {
		t.Fatalf("fotek pro témata %d", len(puvodni))
	}
	vysledku := len(p.soutez)

	a.SetHodnoceniFotek([]int{fotky[0].ID}, 5)
	a.GetNavrhSezony()
	if po := a.fotkyProTemata(); reflect.ValueOf(po).Pointer() != reflect.ValueOf(puvodni).Pointer() {
		t.Fatal("po srdíčku se fotky pro témata načetly znovu")
	}
	if len(p.soutez) != vysledku || vysledku == 0 {
		t.Fatalf("po srdíčku se výsledky témat zahodily (%d → %d)", vysledku, len(p.soutez))
	}

	// Tag fotky: fotky se načtou znovu a tag je vidět
	a.SetTagyFotek([]int{fotky[0].ID}, []string{"podpatky"}, nil)
	if f := a.fotkyProTemata()[fotky[0].ID]; f == nil || !f.maTag("podpatky") {
		t.Fatal("po tagu se fotky pro témata nenačetly znovu")
	}
	// Údaj modelky: výsledky se zahodí
	p.mu.Lock()
	p.soutez["test"] = vysledekSouteze{}
	p.mu.Unlock()
	m := a.GetModelky("")[0]
	m.VlasyBarva = "Zrzavá"
	a.UpdateModelka(m)
	a.GetNavrhSezony()
	p.mu.Lock()
	_, zustal := p.soutez["test"]
	p.mu.Unlock()
	if zustal {
		t.Fatal("po změně modelky zůstaly staré výsledky témat")
	}
}
