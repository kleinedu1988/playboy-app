package main

import (
	"fmt"
	"strings"
	"testing"
)

// Export 14: časopisy a čísla s „@“ projdou exportem a importem beze změny (0.02.008)
func TestExportCasopisuTamAZpet(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	if _, err := a.db.Exec(`INSERT INTO casopisy (klic, nazev, barva, edice, modelka_mesice, modelka_roku, poradi) VALUES ('OU', 'Oui', '#00897b', 'US,FR', 'Girl of the Month', '', 4)`); err != nil {
		t.Fatal(err)
	}
	a.AddModelka(Modelka{Jmeno: "Pet", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	odkaz := func(z string) string { return "https://drive.google.com/file/d/" + strings.Repeat(z, 29) + "/view" }
	a.AddBulkPhotos(id, "1985-09@PH", "Centerfold", odkaz("P"))
	a.AddBulkPhotos(id, "Londýn", "Pictorial", odkaz("L"))
	a.AddBulkPhotos(id, "Paříž", "Pictorial", odkaz("O"))
	if !a.SetVydaniAlba(id, "Londýn", "Pictorial", "1986-03-UK@PH") || !a.SetVydaniAlba(id, "Paříž", "Pictorial", "1980-05-FR@OU") {
		t.Fatal("vydání pictorialů se neuložilo")
	}
	a.AddCover("1985-09@PH", odkaz("C"))
	a.SetVydaniInfo("1985-09@PH", "Pet of the Month", "nezajima", id, "")

	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	text := string(export)
	for _, s := range []string{"verze: 15\n", "casopisy:", "klic: OU", "edice: [US, FR]", "1985-09@PH", "1986-03-UK@PH", "1980-05-FR@OU"} {
		if !strings.Contains(text, s) {
			t.Fatalf("v exportu chybí %q:\n%s", s, text)
		}
	}

	b := novaTestovaciApp(t, nil)
	if v := b.importovat(export); v.Selhalo != "" || len(v.Chyby) != 0 {
		t.Fatalf("import: %+v", v)
	}
	dotaz := func(x *App, sql string) string {
		var radky []string
		rows, err := x.db.Query(sql)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		cols, _ := rows.Columns()
		for rows.Next() {
			hodnoty := make([]any, len(cols))
			ukazatele := make([]any, len(cols))
			for i := range hodnoty {
				ukazatele[i] = &hodnoty[i]
			}
			rows.Scan(ukazatele...)
			casti := []string{}
			for _, h := range hodnoty {
				casti = append(casti, fmtHodnota(h))
			}
			radky = append(radky, strings.Join(casti, "|"))
		}
		return strings.Join(radky, "\n")
	}
	for _, sql := range []string{
		"SELECT klic, nazev, barva, edice, modelka_mesice, modelka_roku, poradi FROM casopisy ORDER BY klic",
		"SELECT album, typ, COALESCE(vydani, '') FROM alba ORDER BY album, typ",
		"SELECT vydani, COALESCE(poznamka, ''), COALESCE(stav, '') FROM vydani ORDER BY vydani",
	} {
		if x, y := dotaz(a, sql), dotaz(b, sql); x != y || x == "" {
			t.Fatalf("%s\npůvodní:\n%s\npo importu:\n%s", sql, x, y)
		}
	}
	if f := b.GetVydani("1985-09@PH"); len(f) != 2 {
		t.Fatalf("číslo Penthouse po importu: %d fotek", len(f))
	}
}

// Starší export (verze 13, bez časopisů) se načte: čísla bez „@“ jsou Playboy, výchozí časopisy zůstanou
func TestStarsiExportBezCasopisu(t *testing.T) {
	b := novaTestovaciApp(t, nil)
	v := b.importovat([]byte("verze: 13\ncovery:\n  - vydani: 1985-09\n    fotky:\n      - id: " + strings.Repeat("Q", 29) + "\n"))
	if v.Selhalo != "" || len(v.Chyby) != 0 {
		t.Fatalf("import: %+v", v)
	}
	if len(b.GetCasopisy()) != 3 || len(b.GetVydani("1985-09")) != 1 || len(b.GetVydani("1985-09@PH")) != 0 {
		t.Fatal("starší export se nenačetl jako Playboy")
	}
}

// Import nepřepíše edice, které sbírka má, a ohlásí chybný časopis
func TestImportCasopisuChyby(t *testing.T) {
	b := novaTestovaciApp(t, nil)
	v := b.importovat([]byte("verze: 14\ncasopisy:\n  - {klic: PH, nazev: Penthouse, edice: [US]}\n  - {klic: X, nazev: Nic, edice: [US]}\n  - {klic: HU, nazev: Hustler, barva: modrá, edice: [US, Kanada]}\n"))
	if len(v.Chyby) != 3 {
		t.Fatalf("chyby: %v", v.Chyby)
	}
	if !b.znamaRada("PH/UK") || b.znamaRada("HU/KANADA") {
		t.Fatal("edice po importu")
	}
}

func fmtHodnota(h any) string {
	switch x := h.(type) {
	case nil:
		return ""
	case []byte:
		return string(x)
	default:
		return fmt.Sprint(x)
	}
}
