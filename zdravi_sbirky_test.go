package main

import (
	"strings"
	"testing"
)

// Kritérium hotovo: před obnovením je vidět, co přibude, ubude a změní se; databáze zůstane beze změny
func TestRozdilZalohy(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	a.AddBulkPhotos(anna, "1995-06", "Centerfold", odkazA)
	if err := a.zalohovat("test"); err != nil {
		t.Fatal(err)
	}
	zalohy := a.SeznamZaloh()
	if len(zalohy) != 1 {
		t.Fatalf("zálohy: %+v", zalohy)
	}

	// Po záloze: Anna změní výšku, Bára zmizí, přibude Cecílie a fotka
	m, _ := a.modelkaPodleID(anna)
	m.VyskaCm = 170
	m.CoverID = ""
	if !a.UpdateModelka(m) {
		t.Fatal("úprava")
	}
	if !a.DeleteModelka(bara) {
		t.Fatal("smazání")
	}
	a.AddModelka(Modelka{Jmeno: "Cecílie", Tetovani: -1, Piercing: -1})
	a.AddBulkPhotos(anna, "1995-06", "Centerfold", odkazB)
	// Ověření souboru změnou sbírky není
	a.db.Exec("UPDATE fotky SET overeno = '2026-11-01'")

	r := a.RozdilZalohy(zalohy[0].Soubor)
	if r.Chyba != "" {
		t.Fatal(r.Chyba)
	}
	k := map[string]KategorieRozdilu{}
	for _, x := range r.Kategorie {
		k[x.Nazev] = x
	}
	mod := k["Modelky"]
	if mod.Pribude != 1 || mod.Ubude != 1 || mod.Zmeni != 1 {
		t.Fatalf("modelky: %+v", mod)
	}
	priklady := strings.Join(mod.Priklady, " | ")
	if !strings.Contains(priklady, "+ Bára") || !strings.Contains(priklady, "− Cecílie") || !strings.Contains(priklady, "~ Anna (vyska_cm)") {
		t.Errorf("příklady: %s", priklady)
	}
	if f := k["Fotky"]; f.Ubude != 1 || f.Pribude != 0 || f.Zmeni != 0 {
		t.Errorf("fotky: %+v", f)
	}
	if r.Celkem != 4 {
		t.Errorf("celkem %d", r.Celkem)
	}
	// Nanečisto: databáze se nezměnila
	if _, ok := a.modelkaPodleID(bara); ok {
		t.Error("porovnání změnilo databázi")
	}
	if r := a.RozdilZalohy("../playboy.db"); r.Chyba == "" {
		t.Error("cesta mimo složku záloh")
	}

	// Zdraví: záloha (smazání modelky zazálohovalo samo), ověření fotek, připomínka exportu (nikdy neexportováno, ale málo záznamů)
	z := a.GetZdraviSbirky()
	if z.PocetZaloh != 2 || z.DuvodZalohy != "pred-smazanim-modelky" || z.Fotek != 2 || z.Overenych != 2 || z.PosledniKontrola != "2026-11-01" || z.DniOdExportu != -1 || z.PripomenoutExport {
		t.Fatalf("zdraví: %+v", z)
	}
	a.ulozitNastaveni("posledni_export", "2026-01-01")
	for i := 0; i < 25; i++ {
		a.AddModelka(Modelka{Jmeno: "Nová " + string(rune('A'+i)), Tetovani: -1, Piercing: -1})
	}
	if z := a.GetZdraviSbirky(); !z.PripomenoutExport || z.ZmenOdExportu < 25 {
		t.Fatalf("připomínka: %+v", z)
	}
}
