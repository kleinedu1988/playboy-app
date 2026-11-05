package main

import (
	"strings"
	"testing"
)

// Profilová fotka je oddělená od titulní: nastavení ani zrušení titulní fotku nemění
func TestProfilovaFotka(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Profil Test", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Cizí", Tetovani: -1, Piercing: -1})
	var m, cizi Modelka
	for _, x := range a.GetModelky("") {
		if x.Jmeno == "Profil Test" {
			m = x
		} else {
			cizi = x
		}
	}
	a.AddBulkPhotos(m.ID, "Album", "Pictorial", odkazA)
	foto := a.GetFotografieModelky(m.ID)[0].ID

	if a.GetProfilovaFotka(m.ID) != "" {
		t.Fatal("modelka bez profilové fotky ji má")
	}
	if a.SetProfilovaFotka(cizi.ID, foto) {
		t.Fatal("cizí fotka se stala profilovou")
	}
	if !a.SetProfilovaFotka(m.ID, foto) || !strings.Contains(a.GetProfilovaFotka(m.ID), idA) {
		t.Fatalf("profilovou fotku se nepodařilo nastavit: %q", a.GetProfilovaFotka(m.ID))
	}
	// Podruhé (přepis) projde také
	if !a.SetProfilovaFotka(m.ID, foto) {
		t.Fatal("opětovné nastavení profilové fotky selhalo")
	}
	for _, x := range a.GetModelky("") {
		if x.ID == m.ID && x.CoverID != "" {
			t.Fatal("profilová fotka změnila titulní")
		}
	}
	if !a.SetProfilovaFotka(m.ID, 0) || a.GetProfilovaFotka(m.ID) != "" {
		t.Fatal("profilovou fotku se nepodařilo zrušit")
	}
}
