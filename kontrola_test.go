package main

import (
	"strings"
	"testing"
)

// Nálezy kontroly jako „jméno: klíč“ (seřazené podle pořadí kontroly)
func nalezyKontroly(a *App, vcetneSkrytych bool) map[string]PodezrelyUdaj {
	nalezy := map[string]PodezrelyUdaj{}
	for _, u := range a.GetPrehled(vcetneSkrytych).Podezrele {
		nalezy[u.Jmeno+": "+u.Klic] = u
	}
	return nalezy
}

func TestKontrolaSbirky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	odkazC := "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view"
	// Šestnáctiletá playmate (pravdivý údaj), překlepy v postavě, dvě modelky stejného jména
	a.AddModelka(Modelka{Jmeno: "Mladá", NarozeniDatum: "1964-05", VyskaCm: 210, VahaKg: 75,
		ObvodHrudnikCm: 90, ObvodPasCm: 92, ObvodBokyCm: 88, Role: "Playmate roku 1975"})
	a.AddModelka(Modelka{Jmeno: "Druhá", DalsiJmena: "Mladá"})
	a.AddModelka(Modelka{Jmeno: "Běžná", NarozeniDatum: "1960-01", VyskaCm: 170, VahaKg: 55})
	id := map[string]int{}
	for _, m := range a.GetModelky("") {
		id[m.Jmeno] = m.ID
	}
	mlada, druha, bezna := id["Mladá"], id["Druhá"], id["Běžná"]
	a.AddBulkPhotos(mlada, "1980-10", "Centerfold", odkazA)
	a.AddBulkPhotos(druha, "1980-10", "Centerfold", odkazB)
	a.AddBulkPhotos(bezna, "1982-01", "Centerfold", odkazC)
	// Album s jednou fotkou: s podobným názvem jako jiné album je podezřelé, samostatné ne
	a.AddBulkPhotos(bezna, "Na pláži", "Pictorial", odkazA+" "+odkazB)
	a.AddBulkPhotos(bezna, "Na plázi", "Pictorial", odkazC)
	a.AddBulkPhotos(bezna, "Ateliér", "Pictorial", odkazC)

	nalezy := nalezyKontroly(a, false)
	for _, cekany := range []string{"Mladá: ok-vek", "Mladá: ok-vyska", "Mladá: ok-miry", "Mladá: ok-pmoy", "Mladá: ok-jmeno",
		"Mladá: ok-cislo", "Druhá: ok-cislo", "Běžná: ok-album", "Běžná: ok-dvojice"} {
		if _, ok := nalezy[cekany]; !ok {
			t.Errorf("chybí nález %s; nálezy: %v", cekany, nalezy)
		}
	}
	if u := nalezy["Mladá: ok-vek"]; !strings.Contains(u.Popis, "16 let") || u.Pole != "inputNarozeniDatum" {
		t.Errorf("věk: %+v", u)
	}
	if u := nalezy["Běžná: ok-album"]; u.Album != "Na plázi" || !strings.Contains(u.Popis, "Na pláži") {
		t.Errorf("album: %+v", u)
	}
	if len(nalezy) != 9 {
		t.Errorf("čekáno 9 nálezů, jsou %d: %v", len(nalezy), nalezy)
	}

	// „V pořádku“: nález se skryje a ukáže se jen mezi skrytými (s příznakem); zrušení ho vrátí
	if !a.SetNetykaSe(mlada, "ok-vek", true) || !a.SetNetykaSeAlba(bezna, "Na plázi", "Pictorial", "ok-album", true) {
		t.Fatal("označení v pořádku se neuložilo")
	}
	if a.SetNetykaSe(mlada, "ok-neznamy", true) {
		t.Fatal("neznámý klíč se nemá uložit")
	}
	nalezy = nalezyKontroly(a, false)
	if _, ok := nalezy["Mladá: ok-vek"]; ok {
		t.Fatal("nález označený v pořádku se má skrýt")
	}
	if _, ok := nalezy["Běžná: ok-album"]; ok {
		t.Fatal("album označené v pořádku se má skrýt")
	}
	if u := nalezyKontroly(a, true)["Mladá: ok-vek"]; !u.NetykaSe {
		t.Fatalf("mezi skrytými má být s příznakem: %+v", u)
	}
	a.SetNetykaSe(mlada, "ok-vek", false)
	if _, ok := nalezyKontroly(a, false)["Mladá: ok-vek"]; !ok {
		t.Fatal("po zrušení označení se má nález vrátit")
	}

	// Označení je mezi „netýká se“ modelky, takže ho nese i export
	a.SetNetykaSe(mlada, "ok-vek", true)
	for _, m := range a.GetModelky("") {
		if m.ID == mlada && !obsahujeKlic(m.NetykaSe, "ok-vek") {
			t.Fatalf("netýká se: %q", m.NetykaSe)
		}
	}
}

func TestKontrolaDat(t *testing.T) {
	var hlaseni []string
	pridat := func(m Modelka, klic, pole, popis string) { hlaseni = append(hlaseni, klic+" "+popis) }
	for _, pripad := range []struct {
		m      Modelka
		cekano string
	}{
		{Modelka{NarozeniDatum: "1990-05", Vydani: []string{"1985-03"}}, "ok-narozeni"},
		{Modelka{NarozeniDatum: "1960-05", UmrtiDatum: "1950", Vydani: []string{"1985-03"}}, "ok-umrti"},
		{Modelka{NarozeniDatum: "1960-05", UmrtiDatum: "1984-01", Vydani: []string{"1985-03"}}, "ok-umrti"},
		{Modelka{NarozeniDatum: "1930-05", Vydani: []string{"1985-03", "1979-02"}}, "ok-vek věk při prvním vydání (1979-02) vychází na 48 let"},
		{Modelka{NarozeniDatum: "1960-05", Vydani: []string{"1985-S01", "1981-03"}}, ""},
	} {
		hlaseni = nil
		kontrolovatData(pripad.m, vychoziRozsahy(), pridat)
		vysledek := strings.Join(hlaseni, " | ")
		if pripad.cekano == "" && vysledek != "" || !strings.HasPrefix(vysledek, pripad.cekano) {
			t.Errorf("%+v: %q, čekáno %q", pripad.m, vysledek, pripad.cekano)
		}
	}
	hlaseni = nil
	kontrolovatPostavu(Modelka{VyskaCm: 170, VahaKg: 95}, vychoziRozsahy(), pridat)
	if len(hlaseni) != 1 || !strings.HasPrefix(hlaseni[0], "ok-bmi BMI z výšky a váhy vychází 32,9") {
		t.Errorf("BMI: %v", hlaseni)
	}
}
