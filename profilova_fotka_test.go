package main

import (
	"strconv"
	"strings"
	"testing"
)

func modelkaPodleJmenaApp(t *testing.T, a *App, jmeno string) Modelka {
	t.Helper()
	for _, x := range a.GetModelky("") {
		if x.Jmeno == jmeno {
			return x
		}
	}
	t.Fatalf("modelka %q chybí", jmeno)
	return Modelka{}
}

// Profilová fotka je oddělená od titulní i se svým výřezem (úprava schématu č. 16)
func TestProfilovaFotka(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Profil Test", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Cizí", Tetovani: -1, Piercing: -1})
	m, cizi := modelkaPodleJmenaApp(t, a, "Profil Test"), modelkaPodleJmenaApp(t, a, "Cizí")
	a.AddBulkPhotos(m.ID, "Album", "Pictorial", odkazA+" "+odkazB)
	fotky := a.GetFotografieModelky(m.ID)
	a.SetTitulniFotka(m.ID, fotky[0].ID)
	a.SetCoverVyrez(m.ID, 2, 10, 20)

	if a.GetProfilovaFotka(m.ID) != nil {
		t.Fatal("modelka bez profilové fotky ji má")
	}
	if a.SetProfilovaFotka(cizi.ID, fotky[1].ID) {
		t.Fatal("cizí fotka se stala profilovou")
	}
	if a.SetProfilovyVyrez(m.ID, 2, 30, 40) {
		t.Fatal("výřez se uložil modelce bez profilové fotky")
	}
	if !a.SetProfilovaFotka(m.ID, fotky[1].ID) {
		t.Fatal("profilovou fotku se nepodařilo nastavit")
	}
	if p := a.GetProfilovaFotka(m.ID); p == nil || !strings.Contains(p.URL, idB) || p.CoverZoom != 1 || p.CoverY != vychoziProfilovaY {
		t.Fatalf("profilová fotka: %+v", p)
	}
	if !a.SetProfilovyVyrez(m.ID, 9, 30, -5) {
		t.Fatal("výřez profilové fotky se neuložil")
	}
	if p := a.GetProfilovaFotka(m.ID); p.CoverZoom != 4 || p.CoverX != 30 || p.CoverY != 0 {
		t.Fatalf("výřez profilové fotky: %+v", p)
	}
	// Titulní fotka i její výřez zůstaly
	if x := modelkaPodleJmenaApp(t, a, "Profil Test"); x.CoverID != idA || x.CoverZoom != 2 || x.CoverX != 10 {
		t.Fatalf("profilová fotka změnila titulní: %+v", x)
	}
	// Nová profilová fotka začíná s výchozím výřezem
	if !a.SetProfilovaFotka(m.ID, fotky[1].ID) || a.GetProfilovaFotka(m.ID).CoverZoom != 1 {
		t.Fatal("opětovné nastavení profilové fotky selhalo nebo nechalo starý výřez")
	}

	// Export a import přenesou profilovou fotku i výřez
	a.SetProfilovyVyrez(m.ID, 1.5, 40, 10)
	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	if text := string(export); !strings.Contains(text, "profilova_fotka: ") || !strings.Contains(text, "profilovy_vyrez:") {
		t.Fatalf("export bez profilové fotky:\n%s", text)
	}
	b := novaTestovaciApp(t, nil)
	if v := b.importovat(export); v.Selhalo != "" || len(v.Chyby) != 0 {
		t.Fatalf("import: %+v", v)
	}
	mb := modelkaPodleJmenaApp(t, b, "Profil Test")
	if p := b.GetProfilovaFotka(mb.ID); p == nil || !strings.Contains(p.URL, idB) || p.CoverZoom != 1.5 || p.CoverX != 40 || p.CoverY != 10 {
		t.Fatalf("profilová fotka po importu: %+v", p)
	}
	if mb.CoverID != idA {
		t.Fatalf("titulní fotka po importu: %q", mb.CoverID)
	}

	// Smazaná fotka profilovou fotku zruší
	a.DeleteFotografie(fotky[1].ID)
	if a.GetProfilovaFotka(m.ID) != nil {
		t.Fatal("smazaná fotka zůstala profilovou")
	}
	a.SetProfilovaFotka(m.ID, fotky[0].ID)
	if !a.SetProfilovaFotka(m.ID, 0) || a.GetProfilovaFotka(m.ID) != nil {
		t.Fatal("profilovou fotku se nepodařilo zrušit")
	}
}

// Přechod z 1.2.63–1.2.64: profilové fotky a výřezy z nastavení se přenesou do sloupců
func TestPrechodProfiloveFotkyZNastaveni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Stará", Tetovani: -1, Piercing: -1})
	m := modelkaPodleJmenaApp(t, a, "Stará")
	a.AddBulkPhotos(m.ID, "Album", "Pictorial", odkazA)
	foto := a.GetFotografieModelky(m.ID)[0].ID
	a.db.Exec(`INSERT INTO nastaveni (klic, hodnota) VALUES (?, ?), (?, ?), ('profilova:999', '12345')`,
		"profilova:"+strconv.Itoa(m.ID), strconv.Itoa(foto), "profilova-vyrez:"+strconv.Itoa(m.ID), "2.5;33.5;12")
	for _, krok := range krokyProfilovaFotka[4:] {
		if _, err := a.db.Exec(krok); err != nil {
			t.Fatal(err)
		}
	}
	if p := a.GetProfilovaFotka(m.ID); p == nil || p.CoverZoom != 2.5 || p.CoverX != 33.5 || p.CoverY != 12 {
		t.Fatalf("profilová fotka po přechodu: %+v", p)
	}
	var zbylo int
	a.db.QueryRow(`SELECT COUNT(*) FROM nastaveni WHERE klic LIKE 'profilova%'`).Scan(&zbylo)
	if zbylo != 0 {
		t.Fatalf("v nastavení zbylo %d klíčů profilové fotky", zbylo)
	}
}
