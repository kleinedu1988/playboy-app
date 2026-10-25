package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Online pictorialy (typ Pictorial online s datem nafocení): úprava schématu č. 12 a export verze 8

const (
	odkazOnline1 = "https://drive.google.com/file/d/OOOOOOOOOOOOOOOOOOOOOOOOOOOO1/view"
	odkazOnline2 = "https://drive.google.com/file/d/OOOOOOOOOOOOOOOOOOOOOOOOOOOO2/view"
)

func idModelky(t *testing.T, a *App, jmeno string) int {
	t.Helper()
	for _, m := range a.GetModelky("") {
		if m.Jmeno == jmeno {
			return m.ID
		}
	}
	t.Fatalf("modelka %s není", jmeno)
	return 0
}

func modelkaPodleJmena(t *testing.T, a *App, jmeno string) Modelka {
	t.Helper()
	for _, m := range a.GetModelky("") {
		if m.Jmeno == jmeno {
			return m
		}
	}
	t.Fatalf("modelka %s není", jmeno)
	return Modelka{}
}

func jmenaNalezu(a *App, dotaz string) string {
	var jmena []string
	for _, m := range a.GetModelky(dotaz) {
		jmena = append(jmena, m.Jmeno)
	}
	return strings.Join(jmena, ",")
}

// Databáze ve schématu 11 přejde na úpravu č. 12 se zálohou předem a beze ztráty; starší program (schéma 11)
// otevře databázi ve schématu 12 jen pro čtení a nic v ní nezmění
func TestPrechodNaDatumAlba(t *testing.T) {
	puvodni := migrace
	migrace = puvodni[:11]
	a := novaTestovaciApp(t, nil)
	migrace = puvodni
	var schema int
	a.db.QueryRow("PRAGMA user_version").Scan(&schema)
	if schema != 11 || a.maSloupec("alba", "datum") {
		t.Fatalf("výchozí databáze: schéma %d, sloupec datum %v", schema, a.maSloupec("alba", "datum"))
	}
	a.AddModelka(Modelka{Jmeno: "Stará", Tetovani: -1, Piercing: -1})
	if v := a.AddBulkPhotos(1, "Les", "Pictorial", odkazA); v.Vlozeno != 1 {
		t.Fatalf("vložení: %+v", v)
	}
	a.db.Exec("UPDATE alba SET vydani = '1995-03', popis = 'Text' WHERE album = 'Les'")
	a.db.Close()

	b := NewApp()
	b.startup(context.Background())
	if b.chybaStartu != "" {
		t.Fatal(b.chybaStartu)
	}
	b.db.QueryRow("PRAGMA user_version").Scan(&schema)
	if schema != 12 || !b.maSloupec("alba", "datum") {
		t.Fatalf("po úpravě: schéma %d, sloupec datum %v", schema, b.maSloupec("alba", "datum"))
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*-pred-migraci.db")); len(zalohy) != 1 {
		t.Fatalf("záloha před úpravou: %v", zalohy)
	}
	fotky := b.GetFotografieModelky(1)
	if len(fotky) != 1 || fotky[0].Vydani != "1995-03" || fotky[0].Popis != "Text" || fotky[0].DatumAlba != "" {
		t.Fatalf("fotky po úpravě: %+v", fotky)
	}
	b.AddBulkPhotos(1, "Web", typOnline, odkazB)
	if !b.SetDatumAlba(1, "Web", typOnline, "2004-06") {
		t.Fatal("datum nafocení se neuložilo")
	}
	b.db.Close()

	// Starší program zná jen 11 úprav: databázi ve schématu 12 neupraví a běží jen pro čtení
	migrace = puvodni[:11]
	c := NewApp()
	c.startup(context.Background())
	migrace = puvodni
	defer c.db.Close()
	if !strings.Contains(c.StavDatabaze(), "novější verze") || !strings.Contains(c.StavDatabaze(), "jen pro čtení") || !c.jenProCteni {
		t.Fatalf("stav databáze ve starším programu: %q", c.StavDatabaze())
	}
	if c.AddModelka(Modelka{Jmeno: "Nová"}) {
		t.Fatal("starší program zapsal do novější databáze")
	}
	c.db.QueryRow("PRAGMA user_version").Scan(&schema)
	var datum string
	c.db.QueryRow("SELECT COALESCE(datum, '') FROM alba WHERE album = 'Web'").Scan(&datum)
	if schema != 12 || datum != "2004-06" || len(c.GetModelky("")) != 1 {
		t.Fatalf("starší program změnil databázi: schéma %d, datum %q", schema, datum)
	}
}

// Uložení online alba: datum ve tvaru data narození, nikdy vydání; do kalendáře, vydání ani Údržby
// („alba bez vydání“) nepatří a titulní fotku modelky nemění
func TestUlozeniOnlineAlba(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Cyber", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "Cyber")
	if v := a.AddBulkPhotos(id, "Cyber Girl týdne", typOnline, odkazOnline1); v.Vlozeno != 1 {
		t.Fatalf("vložení do online alba: %+v", v)
	}
	a.AddBulkPhotos(id, "Pláž", "Pictorial", odkazA)

	for _, spatne := range []string{"2004-13", "6/2004", "04", "2004-06-31x"} {
		if a.SetDatumAlba(id, "Cyber Girl týdne", typOnline, spatne) {
			t.Errorf("chybné datum %q prošlo", spatne)
		}
	}
	if a.SetDatumAlba(id, "Pláž", "Pictorial", "2004") {
		t.Error("datum nafocení u obyčejného pictorialu prošlo")
	}
	if !a.SetDatumAlba(id, "Cyber Girl týdne", typOnline, " 2004-06 ") {
		t.Fatal("platné datum neprošlo")
	}
	// Online album k vydání nepatří
	if a.SetVydaniAlba(id, "Cyber Girl týdne", typOnline, "2004-06") {
		t.Error("online album dostalo vydání")
	}
	if !a.SetVydaniAlba(id, "Cyber Girl týdne", typOnline, "") {
		t.Error("prázdné vydání online alba neprošlo")
	}

	var online Fotografie
	for _, f := range a.GetFotografieModelky(id) {
		if f.Typ == typOnline {
			online = f
		}
	}
	if online.DatumAlba != "2004-06" || online.Vydani != "" {
		t.Fatalf("online album: datum %q, vydání %q", online.DatumAlba, online.Vydani)
	}
	m := modelkaPodleJmena(t, a, "Cyber")
	if fmt.Sprint(m.OnlineAlba) != "[2004-06]" || len(m.Vydani) != 0 || m.CoverID != "" {
		t.Fatalf("modelka: online %v, vydání %v, titulní %q", m.OnlineAlba, m.Vydani, m.CoverID)
	}
	if len(a.GetPrehledVydani()) != 0 || len(a.GetKalendar()) != 0 || len(a.GetVydani("2004-06")) != 0 || len(a.GetVydani("2004")) != 0 {
		t.Fatal("online album se ukázalo ve vydání nebo kalendáři")
	}
	bezVydani := []string{}
	for _, p := range a.GetPrehled(true).AlbaBezVydani {
		bezVydani = append(bezVydani, p.Album)
	}
	if fmt.Sprint(bezVydani) != "[Pláž]" {
		t.Fatalf("Údržba – alba bez vydání: %v", bezVydani)
	}

	// Další fotky datum nemění; datum zůstane i přes odebrání a vrácení jediné fotky
	a.AddBulkPhotos(id, "Cyber Girl týdne", typOnline, odkazOnline2)
	var ids []int
	for _, f := range a.GetFotografieModelky(id) {
		if f.Typ == typOnline {
			ids = append(ids, f.ID)
		}
	}
	obnova := a.OdebratFotky(ids)
	if len(obnova) != 2 || obnova[0].Datum != "2004-06" {
		t.Fatalf("údaje pro vrácení: %+v", obnova)
	}
	if n := a.ObnovitFotky(obnova); n != 2 {
		t.Fatalf("vráceno %d fotek", n)
	}
	if m := modelkaPodleJmena(t, a, "Cyber"); fmt.Sprint(m.OnlineAlba) != "[2004-06]" {
		t.Fatalf("po vrácení fotek: %v", m.OnlineAlba)
	}

	// Změna typu: z online alba datum zmizí, do online alba vydání
	if !a.UpdateAlbum(id, "Cyber Girl týdne", typOnline, "Cyber Girl týdne", "Pictorial") {
		t.Fatal("změna typu na Pictorial")
	}
	var datum, vydani string
	a.db.QueryRow("SELECT COALESCE(datum, ''), vydani FROM alba WHERE album = 'Cyber Girl týdne'").Scan(&datum, &vydani)
	if datum != "" {
		t.Fatalf("pictorial si nechal datum nafocení %q", datum)
	}
	a.SetVydaniAlba(id, "Cyber Girl týdne", "Pictorial", "2004-06")
	if !a.UpdateAlbum(id, "Cyber Girl týdne", "Pictorial", "Cyber Girl týdne", typOnline) || !a.SetDatumAlba(id, "Cyber Girl týdne", typOnline, "2004-06-15") {
		t.Fatal("změna typu na Pictorial online")
	}
	a.db.QueryRow("SELECT COALESCE(datum, ''), vydani FROM alba WHERE album = 'Cyber Girl týdne'").Scan(&datum, &vydani)
	if datum != "2004-06-15" || vydani != "" {
		t.Fatalf("online album po změně typu: datum %q, vydání %q", datum, vydani)
	}

	// Sloučení: cílové online album bez data převezme datum zdrojového
	a.AddBulkPhotos(id, "Coed", typOnline, odkazB)
	if chyba := a.SloucitAlba(id, "Cyber Girl týdne", typOnline, "Coed", typOnline); chyba != "" {
		t.Fatal(chyba)
	}
	a.db.QueryRow("SELECT COALESCE(datum, '') FROM alba WHERE album = 'Coed'").Scan(&datum)
	if datum != "2004-06-15" {
		t.Fatalf("po sloučení: datum %q", datum)
	}
}

// Výskyt „jen online“ i bez online kategorie a hledání nafoceno: (předpona data, čárka = nebo)
func TestVyskytANafoceno(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, jmeno := range []string{"Online", "Casopis", "Bez data", "Nic", "Další"} {
		a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1})
	}
	online, casopis, bezData, dalsi := idModelky(t, a, "Online"), idModelky(t, a, "Casopis"), idModelky(t, a, "Bez data"), idModelky(t, a, "Další")
	a.AddBulkPhotos(online, "Web", typOnline, odkazOnline1)
	a.SetDatumAlba(online, "Web", typOnline, "2004-06-15")
	// Další modelka sdíleného online alba ho má také
	a.PridatModelkuKAlbu(online, "Web", typOnline, dalsi)
	a.AddBulkPhotos(casopis, "Web", typOnline, odkazOnline2)
	a.SetDatumAlba(casopis, "Web", typOnline, "2003")
	a.AddBulkPhotos(casopis, "2005-03", "Centerfold", odkazA)
	a.AddBulkPhotos(bezData, "Web", typOnline, odkazB)

	if m := modelkaPodleJmena(t, a, "Bez data"); fmt.Sprintf("%q", m.OnlineAlba) != `[""]` {
		t.Fatalf("album bez data: %q", m.OnlineAlba)
	}
	pripady := map[string]string{
		"vyskyt:online":           "Bez data,Další,Online",
		"vyskyt:casopis":          "Casopis",
		"vyskyt:neurceno":         "Nic",
		"nafoceno:2004":           "Další,Online",
		"nafoceno:2004-06":        "Další,Online",
		"nafoceno:2004-06-15":     "Další,Online",
		"nafoceno:2004-07":        "",
		"nafoceno:06":             "",
		"nafoceno:2003,2004":      "Casopis,Další,Online",
		"nafoceno:2003":           "Casopis",
		"-nafoceno:2004":          "Bez data,Casopis,Nic",
		"vyskyt:online nafoceno:": "Bez data,Další,Online",
		// Obyčejné online album kategorii Cyber Girl nedává (jen album Cyber Girl týdne či měsíce, viz TestCyberGirlTydne)
		`kategorie:"cyber girl"`: "",
	}
	for dotaz, chci := range pripady {
		if jmena := jmenaNalezu(a, dotaz); jmena != chci {
			t.Errorf("%s: %q, chci %q", dotaz, jmena, chci)
		}
	}
}

// Export verze 8 přenese typ i datum online alba (i alba bez fotek); import přijme verze 7 i 8, novější
// odmítne a chybné datum či vydání u online alba ohlásí
func TestExportOnlineAlb(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Cyber", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "Cyber")
	a.AddBulkPhotos(id, "Cyber Girl týdne", typOnline, odkazOnline1)
	a.SetDatumAlba(id, "Cyber Girl týdne", typOnline, "2004-06")
	// Album, kterému zbyl jen text a datum
	a.AddBulkPhotos(id, "Zákulisí", typOnline, odkazOnline2)
	a.SetDatumAlba(id, "Zákulisí", typOnline, "2004")
	a.SetPopisAlba(id, "Zákulisí", typOnline, "Text", "")
	for _, f := range a.GetFotografieModelky(id) {
		if f.Album == "Zákulisí" {
			a.DeleteFotografie(f.ID)
		}
	}

	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	text := string(export)
	if !strings.Contains(text, "verze: 8") || !strings.Contains(text, "typ: Pictorial online") || strings.Count(text, "datum: ") != 2 || !strings.Contains(text, "2004-06") {
		t.Fatalf("export:\n%s", text)
	}
	b := novaTestovaciApp(t, nil)
	if v := b.importovat(export); v.Selhalo != "" || len(v.Chyby) != 0 {
		t.Fatalf("import: %+v", v)
	}
	alba := func(x *App) string {
		var radky []string
		rows, _ := x.db.Query("SELECT album, typ, vydani, COALESCE(datum, ''), COALESCE(popis, '') FROM alba ORDER BY album")
		defer rows.Close()
		for rows.Next() {
			var album, typ, vydani, datum, popis string
			rows.Scan(&album, &typ, &vydani, &datum, &popis)
			radky = append(radky, strings.Join([]string{album, typ, vydani, datum, popis}, "|"))
		}
		return strings.Join(radky, "\n")
	}
	if alba(a) != alba(b) || !strings.Contains(alba(b), "Zákulisí|Pictorial online||2004|Text") {
		t.Fatalf("alba po importu:\n%s\n---\n%s", alba(b), alba(a))
	}
	if m := modelkaPodleJmena(t, b, "Cyber"); fmt.Sprint(m.OnlineAlba) != "[2004-06]" {
		t.Fatalf("online alba po importu: %v", m.OnlineAlba)
	}

	// Novější formát se odmítne celý
	if v := b.importovat([]byte("verze: 9\nmodelky:\n  - jmeno: Novější\n")); !strings.Contains(v.Selhalo, "z novější verze programu (formát 9, tato verze umí nejvýš 8)") {
		t.Fatalf("formát 9: %+v", v)
	}

	// Export verze 7 (bez online alb) se načte jako dřív
	v7 := `verze: 7
modelky:
  - jmeno: "Stará"
    alba:
      - nazev: "Pláž"
        typ: Pictorial
        vydani: "1995-03"
        fotky:
          - id: "` + idA + `"
`
	c := novaTestovaciApp(t, nil)
	if v := c.importovat([]byte(v7)); v.Selhalo != "" || len(v.Chyby) != 0 || v.NoveFotky != 1 {
		t.Fatalf("import verze 7: %+v", v)
	}
	if f := c.GetFotografieModelky(idModelky(t, c, "Stará")); len(f) != 1 || f[0].Vydani != "1995-03" || f[0].DatumAlba != "" {
		t.Fatalf("po importu verze 7: %+v", f)
	}

	// Datum jen u online alba a v platném tvaru, vydání online album nemá; „datum: -“ datum smaže
	spatne := `verze: 8
modelky:
  - jmeno: "Stará"
    alba:
      - nazev: "Pláž"
        typ: Pictorial
        datum: "2004"
        fotky: []
      - nazev: "Web"
        typ: Pictorial online
        vydani: "2004-06"
        datum: "6/2004"
        fotky:
          - id: "` + idB + `"
`
	v := c.importovat([]byte(spatne))
	if v.Selhalo != "" || len(v.Chyby) != 3 {
		t.Fatalf("chybná data online alba: %+v", v)
	}
	var vydani, datum string
	c.db.QueryRow("SELECT vydani, COALESCE(datum, '') FROM alba WHERE album = 'Web'").Scan(&vydani, &datum)
	if vydani != "" || datum != "" {
		t.Fatalf("online album z chybného souboru: vydání %q, datum %q", vydani, datum)
	}
	c.SetDatumAlba(idModelky(t, c, "Stará"), "Web", typOnline, "2004-06")
	if v := c.importovat([]byte("verze: 8\nmodelky:\n  - jmeno: Stará\n    alba:\n      - nazev: Web\n        typ: Pictorial online\n        datum: -\n        fotky: []\n")); v.Selhalo != "" || len(v.Chyby) != 0 {
		t.Fatalf("smazání data: %+v", v)
	}
	c.db.QueryRow("SELECT COALESCE(datum, '') FROM alba WHERE album = 'Web'").Scan(&datum)
	if datum != "" {
		t.Fatalf("datum: - nesmazalo datum (%q)", datum)
	}
}

// Vzorový soubor (vzor-exportu.yaml) je ve formátu, který program zapisuje, a online album z něj projde
func TestVzorExportuVerze8(t *testing.T) {
	data, err := os.ReadFile("vzor-exportu.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), fmt.Sprintf("\nverze: %d\n", verzeExportu)) {
		t.Fatalf("vzor není ve verzi %d", verzeExportu)
	}
	a := novaTestovaciApp(t, nil)
	if v := a.importovat(data); v.Selhalo != "" {
		t.Fatalf("import vzoru: %+v", v)
	}
	var datum string
	a.db.QueryRow("SELECT COALESCE(datum, '') FROM alba WHERE typ = ?", typOnline).Scan(&datum)
	if datum != "2004-06" {
		t.Fatalf("online album ze vzoru: datum %q", datum)
	}
}

// Cyber Girl týdne: online album (bez vydání, s datem), odvozená kategorie Cyber Girl týdne, změna typu zachová datum
func TestCyberGirlTydne(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Týdenní", Role: "Online", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "Týdenní")
	a.AddBulkPhotos(id, "Web", typOnline, odkazOnline1)
	if !a.SetDatumAlba(id, "Web", typOnline, "2004-06-12") || !a.UpdateAlbum(id, "Web", typOnline, "Web", typCGTydne) {
		t.Fatal("změna na Cyber Girl týdne se neuložila")
	}
	if a.SetVydaniAlba(id, "Web", typCGTydne, "2004-06") {
		t.Fatal("Cyber Girl týdne nemá mít vydání")
	}
	m := modelkaPodleJmena(t, a, "Týdenní")
	if m.CyberGirl != "týdne" || fmt.Sprintf("%q", m.OnlineAlba) != `["2004-06-12"]` {
		t.Fatalf("modelka: %q %q", m.CyberGirl, m.OnlineAlba)
	}
	for dotaz, chci := range map[string]string{
		`kategorie:"cyber girl týdne"`: "Týdenní",
		"vyskyt:online":                "Týdenní",
		"nafoceno:2004-06":             "Týdenní",
	} {
		if jmena := jmenaNalezu(a, dotaz); jmena != chci {
			t.Errorf("%s: %q, chci %q", dotaz, jmena, chci)
		}
	}
	// Druhé album Cyber Girl měsíce: vyšší úroveň má přednost
	a.AddBulkPhotos(id, "Měsíc", typCGMesice, odkazOnline2)
	if !a.SetDatumAlba(id, "Měsíc", typCGMesice, "2004-09") {
		t.Fatal("datum alba Cyber Girl měsíce se neuložilo")
	}
	if m := modelkaPodleJmena(t, a, "Týdenní"); m.CyberGirl != "měsíce" {
		t.Fatalf("úroveň: %q", m.CyberGirl)
	}
	if jmena := jmenaNalezu(a, `kategorie:"cyber girl měsíce"`); jmena != "Týdenní" {
		t.Errorf("kategorie měsíce: %q", jmena)
	}
	// Zpět na Pictorial online: datum zůstane, kategorie zmizí
	a.UpdateAlbum(id, "Web", typCGTydne, "Web", typOnline)
	a.UpdateAlbum(id, "Měsíc", typCGMesice, "Měsíc", typOnline)
	if m := modelkaPodleJmena(t, a, "Týdenní"); m.CyberGirl != "" || fmt.Sprintf("%q", m.OnlineAlba) != `["2004-06-12" "2004-09"]` {
		t.Fatalf("po vrácení typu: %q %q", m.CyberGirl, m.OnlineAlba)
	}
}
