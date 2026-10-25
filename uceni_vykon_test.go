package main

import (
	"fmt"
	"testing"
	"time"
)

// Umělá sbírka návrhů (velkaSbirkaNavrhu) zapsaná do databáze: modelky, alba a u každého alba pár fotek
func naplnitSbirkuNavrhu(t testing.TB, a *App, n int) {
	t.Helper()
	modelky, alba := velkaSbirkaNavrhu(n)
	tx, err := a.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for i, m := range modelky {
		narozeni := ""
		if i%3 == 0 {
			narozeni = fmt.Sprintf("%d-%02d-%02d", 1938+i%60, 1+i%12, 1+i%28)
		}
		if _, err := tx.Exec(`INSERT INTO modelky (id, jmeno, narozeni_datum, narozeni_misto, narodnost, etnicita, vyska_cm, vaha_kg,
			vlasy_barva, oci_barva, miry, obvod_hrudnik_cm, obvod_pas_cm, obvod_boky_cm, poznamka, pridano)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			m.ID, m.Jmeno, narozeni, m.NarozeniMisto, m.Narodnost, m.Etnicita, m.VyskaCm, m.VahaKg, m.VlasyBarva, m.OciBarva,
			m.Miry, m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm, m.Poznamka, ted()); err != nil {
			t.Fatal(err)
		}
	}
	for i, al := range alba {
		vydani := al.vydani
		if al.typ == "Centerfold" {
			vydani = al.nazev
		}
		datum := ""
		if jeOnlineTyp(al.typ) && i%2 == 0 {
			datum = al.nazev[len(al.nazev)-10:]
		}
		res, err := tx.Exec("INSERT INTO alba (modelka_id, album, typ, vydani, fotograf, datum) VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''))",
			al.modelkaID, al.nazev, al.typ, vydani, al.fotograf, datum)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		for f := range min(al.fotek, 3) {
			if _, err := tx.Exec("INSERT INTO fotky (album_id, drive_file_id) VALUES (?, ?)", id, fmt.Sprintf("U%07d%02dxxxxxxxxxxxxxxxxxxxx", i, f)); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

// Časy hlavních výpočtů Údržby nad 3000 modelkami: první výpočet, z mezipaměti, po změně dat a po restartu
func TestVykonUceni(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	a := novaTestovaciApp(t, nil)
	naplnitSbirkuNavrhu(t, a, 3000)
	zmerit := func(nazev string, f func()) time.Duration {
		zacatek := time.Now()
		f()
		trvalo := time.Since(zacatek)
		t.Logf("%s: %v", nazev, trvalo)
		return trvalo
	}
	var modelky []Modelka
	zmerit("GetModelky", func() { modelky = a.GetModelky("") })
	zmerit("kontrolovatSbirku", func() { a.kontrolovatSbirku(modelky, false) })
	zmerit("GetNavrhyDoplneni", func() { a.GetNavrhyDoplneni(false) })
	prvni := zmerit("GetPrehled (první)", func() { a.GetPrehled(false) })
	druhy := zmerit("GetPrehled (znovu)", func() { a.GetPrehled(false) })
	m := modelky[0]
	m.VyskaCm++
	a.UpdateModelka(m)
	zmerit("GetPrehled (po změně údaje)", func() { a.GetPrehled(false) })
	restartovatUceni(a)
	zmerit("GetPrehled (po restartu, z mezipaměti v souboru)", func() { a.GetPrehled(false) })
	if prvni > 3*time.Second || druhy > 3*time.Second {
		t.Errorf("Přehled 3000 modelek trval %v a %v", prvni, druhy)
	}
}
