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

	if a.GetProfilovaFotka(m.ID) != nil {
		t.Fatal("modelka bez profilové fotky ji má")
	}
	if a.SetProfilovaFotka(cizi.ID, foto) {
		t.Fatal("cizí fotka se stala profilovou")
	}
	if a.SetProfilovyVyrez(m.ID, 2, 30, 40) {
		t.Fatal("výřez se uložil modelce bez profilové fotky")
	}
	if !a.SetProfilovaFotka(m.ID, foto) {
		t.Fatal("profilovou fotku se nepodařilo nastavit")
	}
	if p := a.GetProfilovaFotka(m.ID); p == nil || !strings.Contains(p.URL, idA) || p.CoverZoom != 1 || p.CoverY != vychoziProfilovaY {
		t.Fatalf("profilová fotka: %+v", p)
	}
	if !a.SetProfilovyVyrez(m.ID, 9, 30, -5) {
		t.Fatal("výřez profilové fotky se neuložil")
	}
	if p := a.GetProfilovaFotka(m.ID); p.CoverZoom != 4 || p.CoverX != 30 || p.CoverY != 0 {
		t.Fatalf("výřez profilové fotky: %+v", p)
	}
	// Podruhé (přepis) projde také a starý výřez zruší
	if !a.SetProfilovaFotka(m.ID, foto) || a.GetProfilovaFotka(m.ID).CoverZoom != 1 {
		t.Fatal("opětovné nastavení profilové fotky selhalo nebo nechalo starý výřez")
	}
	for _, x := range a.GetModelky("") {
		if x.ID == m.ID && (x.CoverZoom != 1 || x.CoverX != 50) {
			t.Fatal("výřez profilové fotky změnil výřez titulní")
		}
	}
	if !a.SetProfilovaFotka(m.ID, 0) || a.GetProfilovaFotka(m.ID) != nil {
		t.Fatal("profilovou fotku se nepodařilo zrušit")
	}
}
