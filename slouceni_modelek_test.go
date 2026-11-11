package main

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

// Výpis tabulek dotčených sloučením (bez fulltextu), seřazený
func vypisSbirky(t *testing.T, a *App) map[string][]string {
	t.Helper()
	v := map[string][]string{}
	for _, tab := range []string{"modelky", "alba", "fotky", "fotky_tagy", "fotky_pruvodce", "alba_modelky", "vybery_fotky", "vydani", "clanky"} {
		rows, err := a.db.Query("SELECT * FROM " + tab + " ORDER BY 1, 2")
		if err != nil {
			t.Fatal(tab, err)
		}
		sl, _ := rows.Columns()
		for rows.Next() {
			r := make([]any, len(sl))
			u := make([]any, len(sl))
			for i := range r {
				u[i] = &r[i]
			}
			rows.Scan(u...)
			v[tab] = append(v[tab], fmt.Sprint(r...))
		}
		rows.Close()
	}
	db := a.uc.zajistit()
	for _, dotaz := range []string{"SELECT id, a, b, vysledek FROM porovnani ORDER BY id", "SELECT id, modelka_id, druh FROM zajem ORDER BY id"} {
		rows, err := db.Query(dotaz)
		if err != nil {
			t.Fatal(dotaz, err)
		}
		for rows.Next() {
			var x, y, z, w any
			rows.Scan(&x, &y, &z, &w)
			v[dotaz[:20]] = append(v[dotaz[:20]], fmt.Sprint(x, y, z, w))
		}
		rows.Close()
	}
	return v
}

// Sloučení a Vrátit vrátí obě modelky beze ztráty (0.02.033): alba (i stejnojmenné sloučené), fotky s tagy,
// další modelka alba, obálka, článek, údaje, srdíčka, porovnání a zájem
func TestSlouceniAVratit(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Sylvie Novak", NarozeniDatum: "1965-03-12", VyskaCm: 170, Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Jane Doe", NarozeniDatum: "1965-03-12", VlasyBarva: "blond", VyskaCm: 168, Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Třetí", Tetovani: -1, Piercing: -1})
	m := a.GetModelky("")
	id := map[string]int{}
	for _, x := range m {
		id[x.Jmeno] = x.ID
	}
	cil, zdroj, treti := id["Sylvie Novak"], id["Jane Doe"], id["Třetí"]
	odkaz := func(c string) string { return "https://drive.google.com/file/d/" + strings.Repeat(c, 29) + "/view" }
	a.AddBulkPhotos(cil, "1985-09", "Centerfold", odkaz("A"))
	a.AddBulkPhotos(zdroj, "1986-01@PH", "Centerfold", odkaz("B")+"\n"+odkaz("C"))
	a.AddBulkPhotos(zdroj, "1985-09", "Centerfold", odkaz("A")+"\n"+odkaz("D")) // stejnojmenné album se sloučí
	a.AddBulkPhotos(treti, "1990-01", "Pictorial", odkaz("E"))
	a.db.Exec(`INSERT INTO fotky_tagy (fotka_id, tag) SELECT id, 'pláž' FROM fotky`)
	a.db.Exec(`INSERT INTO alba_modelky (album_id, modelka_id) SELECT id, ? FROM alba WHERE modelka_id = ?`, zdroj, treti)
	a.db.Exec(`INSERT INTO vydani (vydani, modelka_obalky) VALUES ('1986-01@PH', ?)`, zdroj)
	a.AddClanek(Clanek{Vydani: "1986-01@PH", Nazev: "Rozhovor", ModelkaID: zdroj})
	a.SetHodnoceni(zdroj, 4)
	a.PorovnatModelky(cil, zdroj, "a")
	a.PorovnatModelky(zdroj, treti, "a")
	a.PorovnatModelky(treti, cil, "remiza")
	a.ZaznamenatZajem(zdroj, "profil", 30)

	nahled := a.NahledSlouceniModelek(cil, zdroj)
	if len(nahled.Alba) != 2 || nahled.DalsiJmeno != "Jane Doe" || nahled.Porovnani != 1 || nahled.Obalek != 1 || nahled.Clanku != 1 ||
		len(nahled.Doplni) != 1 || nahled.Doplni[0].Pole != "vlasy" || len(nahled.Ponecha) != 1 || nahled.Ponecha[0].Pole != "výška" {
		t.Fatalf("náhled: %+v", nahled)
	}
	pred := vypisSbirky(t, a)
	if chyba := a.SloucitModelky(cil, zdroj); chyba != "" {
		t.Fatal(chyba)
	}
	po := vypisSbirky(t, a)
	if reflect.DeepEqual(pred, po) {
		t.Fatal("sloučení nic nezměnilo")
	}
	for _, r := range po["SELECT id, a, b, vy"] {
		if strings.Contains(" "+r+" ", fmt.Sprintf(" %d ", zdroj)) {
			t.Errorf("porovnání se zdrojovou zůstalo: %s", r)
		}
	}
	if chyba := a.VratitSlouceniModelek(cil, zdroj); chyba != "" {
		t.Fatal(chyba)
	}
	zpet := vypisSbirky(t, a)
	for k := range pred {
		if !reflect.DeepEqual(pred[k], zpet[k]) {
			t.Errorf("%s po vrácení:\n%v\nchci\n%v", k, zpet[k], pred[k])
		}
	}
	if a.VratitSlouceniModelek(cil, zdroj) == "" {
		t.Error("vrácení podruhé")
	}
	// Fotka přidaná po sloučení: Vrátit odmítne (smazal by ji)
	if chyba := a.SloucitModelky(cil, zdroj); chyba != "" {
		t.Fatal(chyba)
	}
	a.AddBulkPhotos(cil, "1987-03", "Pictorial", odkaz("F"))
	if a.VratitSlouceniModelek(cil, zdroj) == "" {
		t.Error("vrácení smazalo novou fotku")
	}
}
