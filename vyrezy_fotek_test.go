package main

import (
	"strings"
	"testing"
)

// Výřezy fotek bez spočítaného obsahu (0.02.049): každá fotka „čeká“, stav zná počet souborů sbírky
func TestVyrezyFotekBezObsahu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	v := a.GetVyrezyFotek([]string{"soubor1", "soubor2"})
	if len(v) != 2 || v[0].Zdroj != "ceka" || v[1].DriveID != "soubor2" || v[0].Postava != nil {
		t.Fatalf("výřezy: %+v", v)
	}
	if s := a.GetStavVyrezu(); s.Spocitano != 0 {
		t.Errorf("stav: %+v", s)
	}
}

// Ruční výřez fotky (úprava schématu č. 18, export verze 15): podle souboru, s mezemi, přednost před automatickým,
// export a import ho zachovají
func TestRucniVyrezFotky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Výřez Test", Tetovani: -1, Piercing: -1})
	m := modelkaPodleJmenaApp(t, a, "Výřez Test")
	a.AddBulkPhotos(m.ID, "Album", "Pictorial", odkazA+" "+odkazB)

	if a.SetRucniVyrez("neni-ve-sbirce-123", 50, 50, 1) {
		t.Fatal("výřez se uložil souboru mimo sbírku")
	}
	if !a.SetRucniVyrez(idA, 130, -4, 9) {
		t.Fatal("výřez se neuložil")
	}
	v := a.GetVyrezyFotek([]string{idA, idB})
	if len(v) != 2 || v[0].Zdroj != "rucni" || v[0].Bod[0] != 1 || v[0].Bod[1] != 0 || v[0].Zoom != maxZoomVyrezu {
		t.Fatalf("ruční výřez s mezemi: %+v", v)
	}
	if v[1].Zdroj == "rucni" {
		t.Fatalf("výřez se přenesl na jinou fotku: %+v", v[1])
	}
	a.SetRucniVyrez(idA, 35.5, 20, 1.5)

	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	if text := string(export); strings.Count(text, "vyrez:") != 1 || !strings.Contains(text, "poloha_x: 35.5") {
		t.Fatalf("export ručního výřezu:\n%s", text)
	}
	b := novaTestovaciApp(t, nil)
	if r := b.importovat(export); r.Selhalo != "" || len(r.Chyby) != 0 {
		t.Fatalf("import: %+v", r)
	}
	if v := b.GetVyrezyFotek([]string{idA}); v[0].Zdroj != "rucni" || v[0].Bod[0] != 0.355 || v[0].Bod[1] != 0.2 || v[0].Zoom != 1.5 {
		t.Fatalf("výřez po importu: %+v", v[0])
	}
	// Import bez výřezu ruční výřez nesmaže
	if r := b.importovat([]byte(strings.ReplaceAll(string(export), "vyrez:", "x_vyrez:"))); r.Selhalo != "" {
		t.Fatalf("import bez výřezu: %+v", r)
	}
	if v := b.GetVyrezyFotek([]string{idA}); v[0].Zdroj != "rucni" {
		t.Fatalf("import bez výřezu ho smazal: %+v", v[0])
	}

	if !a.SmazatRucniVyrez(idA) || a.GetVyrezyFotek([]string{idA})[0].Zdroj == "rucni" {
		t.Fatal("ruční výřez se nesmazal")
	}
}
