package main

import "testing"

// Všechny kroky, které rozhraní volá, existují a doběhnou; neznámý krok nic nedělá
func TestPredpripravit(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka"})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	for _, krok := range []string{"temata", "sbirka", "kalendar", "texty", "statistiky"} {
		if !a.Predpripravit(krok) {
			t.Errorf("krok %s", krok)
		}
	}
	if a.Predpripravit("neni") {
		t.Error("neznámý krok")
	}
	zamekPredpripravy.Lock()
	if a.Predpripravit("kalendar") {
		t.Error("souběžný krok se má odmítnout")
	}
	zamekPredpripravy.Unlock()
}
