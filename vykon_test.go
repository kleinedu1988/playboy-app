package main

import (
	"fmt"
	"testing"
	"time"
)

// Umělá sbírka: 500 modelek, 20 000 fotek, 600 coverů, 100 sdílených alb
func naplnitVelkouSbirku(t testing.TB, a *App) {
	t.Helper()
	tx, err := a.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for m := 1; m <= 500; m++ {
		tx.Exec("INSERT INTO modelky (id, jmeno) VALUES (?, ?)", m, fmt.Sprintf("Modelka %03d", m))
		for al := 0; al < 4; al++ {
			album := fmt.Sprintf("Album %d", al)
			typ := "Pictorial"
			vydani := fmt.Sprintf("%d-%02d", 1960+m%60, 1+al*3)
			if al == 0 {
				album, typ, vydani = vydani, "Centerfold", ""
			}
			for f := 0; f < 10; f++ {
				tx.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id, vydani) VALUES (?, ?, ?, ?, ?)",
					m, album, typ, fmt.Sprintf("ID%06d%03d%02dxxxxxxxxxxxxxxxx", m, al, f), vydani)
			}
		}
	}
	for c := 0; c < 600; c++ {
		tx.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id) VALUES (0, ?, 'Cover', ?)",
			fmt.Sprintf("%d-%02d", 1960+c/12, 1+c%12), fmt.Sprintf("COVER%06dxxxxxxxxxxxxxxxxxxxx", c))
	}
	for s := 1; s <= 100; s++ {
		tx.Exec("INSERT INTO alba (modelka_id, album, typ) VALUES (?, 'Album 1', 'Pictorial')", s)
		tx.Exec("INSERT INTO alba_modelky (album_id, modelka_id) SELECT id, ? FROM alba WHERE modelka_id = ? AND album = 'Album 1'", s+100, s)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
}

// Hlavní čtení musí i u velké sbírky trvat nejvýš zlomek sekundy (dřív desítky sekund)
func TestVykonVelkeSbirky(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	a := novaTestovaciApp(t, nil)
	naplnitVelkouSbirku(t, a)

	limit := 2 * time.Second
	for nazev, volani := range map[string]func(){
		"GetModelky":           func() { a.GetModelky("") },
		"GetFotografieModelky": func() { a.GetFotografieModelky(150) },
		"GetKalendar":          func() { a.GetKalendar() },
		"GetPrehled":           func() { a.GetPrehled(false) },
		"hledání":              func() { a.GetModelky("vlasy:blond") },
	} {
		zacatek := time.Now()
		volani()
		if trvalo := time.Since(zacatek); trvalo > limit {
			t.Errorf("%s trvalo %v (limit %v)", nazev, trvalo, limit)
		} else {
			t.Logf("%s: %v", nazev, trvalo)
		}
	}
	if m := a.GetModelky("Modelka 150")[0]; m.PocetFotek != 50 {
		t.Errorf("modelka 150 má %d fotek, čekám 50 (vlastní i sdílené album)", m.PocetFotek)
	}
	if n := len(a.GetFotografieModelky(150)); n != 50 {
		t.Errorf("profil modelky 150 má %d fotek, čekám 50", n)
	}
}
