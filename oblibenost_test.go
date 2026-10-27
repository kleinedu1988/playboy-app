package main

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"math/rand"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"
)

// Hodnocení modelky po polovinách srdíčka (úprava schématu č. 13, export verze 9), porovnání dvojic,
// Bradley–Terry, výběr dvojic a model vkusu

// Databáze ve schématu 12 přejde na úpravu č. 13 se zálohou předem; srdíčka zůstanou (× 2 v polovinách).
// Starší program (12 úprav) otevře databázi ve schématu 13 jen pro čtení, nic nezmění a vidí celá srdíčka.
func TestPrechodNaPolovinySrdicek(t *testing.T) {
	puvodni := migrace
	migrace = puvodni[:12]
	a := novaTestovaciApp(t, nil)
	migrace = puvodni
	var schema int
	a.db.QueryRow("PRAGMA user_version").Scan(&schema)
	if schema != 12 || a.maSloupec("modelky", "hodnoceni_pul") {
		t.Fatalf("výchozí databáze: schéma %d", schema)
	}
	a.AddModelka(Modelka{Jmeno: "Pětka", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Trojka", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bez", Tetovani: -1, Piercing: -1})
	a.db.Exec("UPDATE modelky SET hodnoceni = 5 WHERE jmeno = 'Pětka'")
	a.db.Exec("UPDATE modelky SET hodnoceni = 3 WHERE jmeno = 'Trojka'")
	a.db.Close()

	b := NewApp()
	b.startup(context.Background())
	if b.chybaStartu != "" {
		t.Fatal(b.chybaStartu)
	}
	b.db.QueryRow("PRAGMA user_version").Scan(&schema)
	if schema != 13 || !b.maSloupec("modelky", "hodnoceni_pul") {
		t.Fatalf("po úpravě: schéma %d", schema)
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*-pred-migraci.db")); len(zalohy) != 1 {
		t.Fatalf("záloha před úpravou: %v", zalohy)
	}
	pul := func(jmeno string) (int, int) {
		var p, c int
		b.db.QueryRow("SELECT COALESCE(hodnoceni_pul, -1), COALESCE(hodnoceni, 0) FROM modelky WHERE jmeno = ?", jmeno).Scan(&p, &c)
		return p, c
	}
	if p, _ := pul("Pětka"); p != 10 {
		t.Fatalf("Pětka: %d polovin", p)
	}
	if p, _ := pul("Trojka"); p != 6 {
		t.Fatalf("Trojka: %d polovin", p)
	}
	if p, _ := pul("Bez"); p != 0 {
		t.Fatalf("Bez: %d polovin", p)
	}
	if m := modelkaPodleJmena(t, b, "Trojka"); m.Hodnoceni != 3 {
		t.Fatalf("Trojka po úpravě: %v", m.Hodnoceni)
	}
	// Poloviny: do starého sloupce celá srdíčka dolů
	trojka := idModelky(t, b, "Trojka")
	if !b.SetHodnoceni(trojka, 3.5) {
		t.Fatal("3,5 se neuložilo")
	}
	if p, c := pul("Trojka"); p != 7 || c != 3 {
		t.Fatalf("3,5: %d polovin, %d celých", p, c)
	}
	// Spouštěče: zápis jen do jednoho sloupce druhý dorovná
	b.db.Exec("UPDATE modelky SET hodnoceni = 4 WHERE jmeno = 'Pětka'")
	if p, c := pul("Pětka"); p != 8 || c != 4 {
		t.Fatalf("zápis celých srdíček: %d polovin, %d celých", p, c)
	}
	b.db.Exec("UPDATE modelky SET hodnoceni_pul = 9 WHERE jmeno = 'Pětka'")
	if p, c := pul("Pětka"); p != 9 || c != 4 {
		t.Fatalf("zápis polovin: %d polovin, %d celých", p, c)
	}
	b.db.Close()

	// Starší program zná jen 12 úprav: databázi ve schématu 13 neupraví, běží jen pro čtení
	migrace = puvodni[:12]
	c := NewApp()
	c.startup(context.Background())
	migrace = puvodni
	defer c.db.Close()
	if !strings.Contains(c.StavDatabaze(), "novější verze") || !c.jenProCteni {
		t.Fatalf("stav databáze ve starším programu: %q", c.StavDatabaze())
	}
	if c.SetHodnoceni(trojka, 5) || c.AddModelka(Modelka{Jmeno: "Nová"}) {
		t.Fatal("starší program zapsal do novější databáze")
	}
	// Starší program čte sloupec hodnoceni: celá srdíčka
	var cela int
	c.db.QueryRow("SELECT hodnoceni FROM modelky WHERE id = ?", trojka).Scan(&cela)
	c.db.QueryRow("PRAGMA user_version").Scan(&schema)
	if schema != 13 || cela != 3 || len(c.GetModelky("")) != 3 {
		t.Fatalf("starší program: schéma %d, hodnocení %d", schema, cela)
	}
}

// SetHodnoceni přijme jen poloviny srdíčka; mimo rozsah ořízne, jiné hodnoty odmítne beze změny
func TestSetHodnoceniPoloviny(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "Anna")
	if !a.SetHodnoceni(id, 4.5) {
		t.Fatal("4,5 neprošlo")
	}
	for _, spatne := range []float64{3.3, 0.25, math.NaN(), 4.75} {
		if a.SetHodnoceni(id, spatne) {
			t.Errorf("%v prošlo", spatne)
		}
	}
	if m := modelkaPodleJmena(t, a, "Anna"); m.Hodnoceni != 4.5 {
		t.Fatalf("po odmítnutých hodnotách %v", m.Hodnoceni)
	}
	if !a.SetHodnoceni(id, 0) || modelkaPodleJmena(t, a, "Anna").Hodnoceni != 0 {
		t.Fatal("0 hodnocení nezrušilo")
	}
}

// Hledání srdíček po polovinách: 3.5, 3,5, porovnání, rozsah i výčet
func TestHledaniPolovinySrdicek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, h := range []float64{3, 3.5, 4, 5, 0} {
		jmeno := fmt.Sprintf("M%v", h)
		a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, jmeno), h)
	}
	for dotaz, chci := range map[string]string{
		"hodnoceni:3.5":     "M3.5",
		"srdicka:3,5":       "M3.5",
		"hodnoceni:>=3,5":   "M3.5,M4,M5",
		"hodnoceni:>3":      "M3.5,M4,M5",
		"hodnoceni:<3.5":    "M3",
		"hodnoceni:3..4":    "M3,M3.5,M4",
		"hodnoceni:3,4":     "M3,M4",
		"hodnoceni:4,5":     "",
		"hodnoceni:3":       "M3",
		"-hodnoceni:3.5":    "M0,M3,M4,M5",
		"hodnoceni:3.5..5":  "M3.5,M4,M5",
		"srdicka:>= 3.5":    "M3.5,M4,M5",
		"hodnoceni:3,5,5.0": "M3,M5",
	} {
		if mam := jmenaNalezu(a, dotaz); mam != chci {
			t.Errorf("%s: %s, chci %s", dotaz, mam, chci)
		}
	}
}

// Export verze 9: poloviny s tečkou, celá čísla bez .0; import verze 9 i 8, desetinná čárka, chybné hodnoty s hláškou
func TestExportPolovinySrdicek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Půlka", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Celá", Tetovani: -1, Piercing: -1})
	a.SetHodnoceni(idModelky(t, a, "Půlka"), 3.5)
	a.SetHodnoceni(idModelky(t, a, "Celá"), 4)
	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	text := string(export)
	if !strings.Contains(text, "verze: 9") || !strings.Contains(text, "hodnoceni: 3.5\n") || !strings.Contains(text, "hodnoceni: 4\n") || strings.Contains(text, "4.0") {
		t.Fatalf("export:\n%s", text)
	}
	b := novaTestovaciApp(t, nil)
	if v := b.importovat(export); v.Selhalo != "" || len(v.Chyby) != 0 {
		t.Fatalf("import: %+v", v)
	}
	if modelkaPodleJmena(t, b, "Půlka").Hodnoceni != 3.5 || modelkaPodleJmena(t, b, "Celá").Hodnoceni != 4 {
		t.Fatal("hodnocení po importu se liší")
	}
	// Starší formát s celými srdíčky a desetinná čárka
	if v := b.importovat([]byte("verze: 8\nmodelky:\n  - jmeno: Osmička\n    hodnoceni: 2\n  - jmeno: Čárka\n    hodnoceni: 4,5\n")); v.Selhalo != "" {
		t.Fatalf("import verze 8: %+v", v)
	}
	if modelkaPodleJmena(t, b, "Osmička").Hodnoceni != 2 || modelkaPodleJmena(t, b, "Čárka").Hodnoceni != 4.5 {
		t.Fatal("verze 8 nebo desetinná čárka")
	}
	for _, spatne := range []string{"3.3", "7", "hodně", "-1"} {
		v := b.importovat([]byte("verze: 9\nmodelky:\n  - jmeno: Půlka\n    hodnoceni: " + spatne + "\n"))
		if !strings.Contains(v.Selhalo, "není hodnocení modelky") {
			t.Errorf("hodnoceni: %s: %+v", spatne, v)
		}
	}
	if modelkaPodleJmena(t, b, "Půlka").Hodnoceni != 3.5 {
		t.Fatal("chybný soubor změnil hodnocení")
	}
	// Pomlčka smaže
	if v := b.importovat([]byte("verze: 9\nmodelky:\n  - jmeno: Půlka\n    hodnoceni: \"-\"\n")); v.Selhalo != "" || modelkaPodleJmena(t, b, "Půlka").Hodnoceni != 0 {
		t.Fatalf("smazání hodnocení: %+v", v)
	}
}

// ---------------------------------------------------------------------------------------------------------
// Porovnání v databázi učení

func TestPorovnaniVratitAZapomenout(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"A", "B", "C"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), 4)
	}
	ida, idb, idc := idModelky(t, a, "A"), idModelky(t, a, "B"), idModelky(t, a, "C")
	for _, spatne := range [][3]any{{ida, ida, "a"}, {ida, idb, "x"}, {ida, 999, "a"}} {
		if a.PorovnatModelky(spatne[0].(int), spatne[1].(int), spatne[2].(string)) {
			t.Errorf("neplatné porovnání %v prošlo", spatne)
		}
	}
	if a.VratitPorovnani() {
		t.Fatal("vrácení bez porovnání prošlo")
	}
	if !a.PorovnatModelky(ida, idb, "a") || !a.PorovnatModelky(idb, idc, "remiza") || !a.PorovnatModelky(ida, idc, "b") {
		t.Fatal("platné porovnání neprošlo")
	}
	if n := a.GetStavUceni().Porovnani; n != 3 {
		t.Fatalf("porovnání ve stavu učení: %d", n)
	}
	// Ve sbírce nic, v souboru učení se srdíčky v tu chvíli
	var tabulek int
	a.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE name = 'porovnani'").Scan(&tabulek)
	if tabulek != 0 {
		t.Fatal("porovnání je ve sbírce")
	}
	if !a.VratitPorovnani() || a.GetStavUceni().Porovnani != 2 {
		t.Fatal("vrácení posledního porovnání")
	}
	restartovatUceni(a)
	if n := a.GetStavUceni().Porovnani; n != 2 {
		t.Fatalf("po restartu %d porovnání", n)
	}
	a.uc.mu.Lock()
	var vysledek string
	var ha float64
	a.uc.zajistit().QueryRow("SELECT vysledek, hodnoceni_a FROM porovnani ORDER BY id DESC LIMIT 1").Scan(&vysledek, &ha)
	a.uc.mu.Unlock()
	if vysledek != "remiza" || ha != 4 {
		t.Fatalf("poslední porovnání: %s, %v", vysledek, ha)
	}
	// Zapomenutí učení porovnání nechá, zapomenutí porovnání je smaže (se zálohou)
	if !a.ZapomenoutUceni() || a.GetStavUceni().Porovnani != 2 {
		t.Fatal("ZapomenoutUceni smazalo porovnání")
	}
	if !a.ZapomenoutPorovnani() || a.GetStavUceni().Porovnani != 0 {
		t.Fatal("ZapomenoutPorovnani")
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "uceni-*.db")); len(zalohy) != 2 {
		t.Fatalf("zálohy učení: %v", zalohy)
	}
}

// Databáze učení ve schématu 1 přejde na 2 (tabulka porovnání) a naučené zůstane; starší program (schéma 1)
// databázi učení ve schématu 2 nečte ani nemění
func TestPrechodDatabazeUceniNaPorovnani(t *testing.T) {
	puvodni := migraceUceni
	migraceUceni = puvodni[:1]
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "A", Tetovani: -1, Piercing: -1})
	a.uc.zapsat(udalostPrijato, 1, "", "", "narodnost", "USA", "USA", "misto", 0.9, 0.9)
	restartovatUceni(a)
	migraceUceni = puvodni
	a.AddModelka(Modelka{Jmeno: "B", Tetovani: -1, Piercing: -1})
	if !a.PorovnatModelky(1, 2, "a") {
		t.Fatal("porovnání po úpravě databáze učení")
	}
	stav := a.GetStavUceni()
	if stav.Prijato != 1 || stav.Porovnani != 1 {
		t.Fatalf("stav po úpravě: %+v", stav)
	}
	restartovatUceni(a)
	migraceUceni = puvodni[:1]
	defer func() { migraceUceni = puvodni }()
	if stav := a.GetStavUceni(); stav.Prijato != 0 {
		t.Fatalf("starší program přečetl novější databázi učení: %+v", stav)
	}
	restartovatUceni(a)
	migraceUceni = puvodni
	db, _ := sql.Open("sqlite", souborUceni(a.cestaDb))
	defer db.Close()
	var verze, porovnani int
	db.QueryRow("PRAGMA user_version").Scan(&verze)
	db.QueryRow("SELECT COUNT(*) FROM porovnani").Scan(&porovnani)
	if verze != len(migraceUceni) || porovnani != 1 {
		t.Fatalf("databáze učení: schéma %d, porovnání %d", verze, porovnani)
	}
}

// ---------------------------------------------------------------------------------------------------------
// Bradley–Terry

func spearman(x, y []float64) float64 {
	poradi := func(v []float64) []float64 {
		idx := make([]int, len(v))
		for i := range idx {
			idx[i] = i
		}
		sort.Slice(idx, func(a, b int) bool { return v[idx[a]] < v[idx[b]] })
		r := make([]float64, len(v))
		for p, i := range idx {
			r[i] = float64(p)
		}
		return r
	}
	rx, ry := poradi(x), poradi(y)
	n := float64(len(x))
	d := 0.0
	for i := range rx {
		d += (rx[i] - ry[i]) * (rx[i] - ry[i])
	}
	return 1 - 6*d/(n*(n*n-1))
}

// Na umělých datech z modelu BT odhad vrátí skutečné pořadí; bez porovnání zůstane síla na srdíčkách
func TestBradleyTerryNajdePoradi(t *testing.T) {
	r := rand.New(rand.NewSource(7))
	n := 30
	stred, sigma := map[int]float64{}, map[int]float64{}
	skutecna := make([]float64, n)
	for i := range n {
		stred[i+1], sigma[i+1] = 3, sigmaHodnocene
		skutecna[i] = 3 + 0.4*(float64(i)/float64(n-1)-0.5) // uvnitř úrovně 3 srdíček
	}
	var porovnani []porovnaniZaznam
	for k := 0; k < 1500; k++ {
		i, j := r.Intn(n), r.Intn(n)
		if i == j {
			continue
		}
		vysledek := "b"
		if r.Float64() < zLogitu(skalaBT*4*(skutecna[i]-skutecna[j])) {
			vysledek = "a"
		}
		porovnani = append(porovnani, porovnaniZaznam{id: int64(k + 1), a: i + 1, b: j + 1, vysledek: vysledek})
	}
	bt := spocitatBT(stred, sigma, porovnani, time.Now())
	odhad := make([]float64, n)
	for i := range n {
		odhad[i] = bt.sila[i+1]
	}
	if rho := spearman(skutecna, odhad); rho < 0.9 {
		t.Fatalf("Spearmanovo ρ = %.3f, odhad %v", rho, odhad)
	}
	if bt.rozptyl[1] >= sigmaHodnocene*sigmaHodnocene {
		t.Fatalf("porovnání nezmenšila nejistotu: %v", bt.rozptyl[1])
	}
	// Bez porovnání
	bez := spocitatBT(map[int]float64{1: 4.5}, map[int]float64{1: sigmaHodnocene}, nil, time.Now())
	if bez.sila[1] != 4.5 || math.Abs(bez.rozptyl[1]-sigmaHodnocene*sigmaHodnocene) > 1e-12 {
		t.Fatalf("bez porovnání: %v %v", bez.sila[1], bez.rozptyl[1])
	}
}

// Oblíbenost drží srdíčka: o celé srdíčko se pořadí nepřehodí (nejvýš ±0,49), i když modelka vyhrává nad vyšší úrovní
func TestOblibenostZustavaVUrovni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for j, h := range map[string]float64{"Trojka": 3, "Čtyřka": 4, "Druhá trojka": 3} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), h)
	}
	a.AddModelka(Modelka{Jmeno: "Nehodnocená", Tetovani: -1, Piercing: -1})
	trojka, ctyrka, druha := idModelky(t, a, "Trojka"), idModelky(t, a, "Čtyřka"), idModelky(t, a, "Druhá trojka")
	for range 15 {
		a.PorovnatModelky(trojka, ctyrka, "a")
		a.PorovnatModelky(trojka, druha, "a")
	}
	ob := map[string]Modelka{}
	for _, m := range a.GetModelky("") {
		ob[m.Jmeno] = m
	}
	if o := ob["Trojka"].Oblibenost; o <= 3 || o > 3+rozpetiUrovne+1e-9 {
		t.Fatalf("Trojka: oblíbenost %v", o)
	}
	if o := ob["Čtyřka"].Oblibenost; o >= 4 || o < 4-rozpetiUrovne-1e-9 {
		t.Fatalf("Čtyřka: oblíbenost %v", o)
	}
	if ob["Druhá trojka"].Oblibenost >= ob["Trojka"].Oblibenost || ob["Nehodnocená"].Oblibenost != 0 {
		t.Fatalf("oblíbenost: %v %v", ob["Druhá trojka"].Oblibenost, ob["Nehodnocená"].Oblibenost)
	}
	stav := a.GetOblibenost()
	if stav.Porovnani != 30 || stav.Modelek != 3 || stav.Poradi[0].ModelkaID != ctyrka || stav.Poradi[1].ModelkaID != trojka || stav.Poradi[0].Poradi != 1 {
		t.Fatalf("pořadí: %+v", stav)
	}
	if p := stav.Poradi[1]; p.Porovnani != 30 || p.Sila <= 3.35 || !strings.Contains(p.Duvod, "výš než její srdíčka") {
		t.Fatalf("Trojka v pořadí: %+v", p)
	}
	// Vrácení porovnání se projeví hned (otisk podle počtu a posledního čísla)
	for range 30 {
		a.VratitPorovnani()
	}
	if o := modelkaPodleJmena(t, a, "Trojka").Oblibenost; o != 3 {
		t.Fatalf("po vrácení všech porovnání: %v", o)
	}
}

// ---------------------------------------------------------------------------------------------------------
// Výběr dvojic

func TestVyberDvojic(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	urovne := []float64{2, 3, 3, 3, 3.5, 3.5, 4, 4, 4, 4, 5, 5}
	for i, h := range urovne {
		j := fmt.Sprintf("M%02d", i)
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), h)
	}
	for i := range 3 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("N%d", i), Tetovani: -1, Piercing: -1})
	}
	srdicka := map[int]float64{}
	for _, m := range a.GetModelky("") {
		srdicka[m.ID] = m.Hodnoceni
	}
	overit := func(okruh string, dvojice []DvojicePorovnani) {
		t.Helper()
		pouzite := map[int]bool{}
		for _, d := range dvojice {
			if d.A == d.B || pouzite[d.A] || pouzite[d.B] || d.Duvod == "" {
				t.Fatalf("%s: opakovaná modelka nebo bez důvodu: %+v", okruh, dvojice)
			}
			pouzite[d.A], pouzite[d.B] = true, true
			ha, hb := srdicka[d.A], srdicka[d.B]
			switch okruh {
			case "stejne":
				if ha != hb || ha == 0 {
					t.Fatalf("stejne: %v a %v", ha, hb)
				}
			case "nehodnocene":
				if (ha == 0) == (hb == 0) {
					t.Fatalf("nehodnocene: %v a %v", ha, hb)
				}
			default:
				// Výchozí výběr míchá hodnocené dvojice (nejvýš o srdíčko) a nehodnocenou proti hodnocené
				if (ha == 0 && hb == 0) || (ha > 0 && hb > 0 && math.Abs(ha-hb) > 1) {
					t.Fatalf("výchozí okruh: %v a %v", ha, hb)
				}
			}
		}
	}
	for _, okruh := range []string{"", "stejne", "nehodnocene"} {
		d := a.GetDvojiceKPorovnani(4, okruh)
		if len(d) == 0 {
			t.Fatalf("%s: žádná dvojice", okruh)
		}
		overit(okruh, d)
	}
	// Porovnaná dvojice se hned znovu nenabídne a nejistota se přesune jinam
	prvni := a.GetDvojiceKPorovnani(1, "stejne")[0]
	a.PorovnatModelky(prvni.A, prvni.B, "a")
	for range 5 {
		for _, d := range a.GetDvojiceKPorovnani(3, "stejne") {
			if klicDvojice(d.A, d.B) == klicDvojice(prvni.A, prvni.B) {
				t.Fatal("právě porovnaná dvojice se nabídla znovu")
			}
		}
	}
}

// Skóre dvojic dá přednost nejistému pořadí: dvojice, které je porovnaná mnohokrát, ustoupí neporovnané
func TestVyberDvojicNejistota(t *testing.T) {
	modelky := []Modelka{{ID: 1, Hodnoceni: 4, CoverID: "x"}, {ID: 2, Hodnoceni: 4, CoverID: "x"}, {ID: 3, Hodnoceni: 4, CoverID: "x"}, {ID: 4, Hodnoceni: 4, CoverID: "x"}}
	var porovnani []porovnaniZaznam
	for k := range 40 {
		v := "a"
		if k%2 == 0 {
			v = "b"
		}
		porovnani = append(porovnani, porovnaniZaznam{id: int64(k + 1), a: 1, b: 2, vysledek: v})
	}
	model := spocitatOblibenost(modelky, porovnani, time.Now())
	// Bez paměti nedávných porovnání (jen nejistota): první dvojice je z neporovnaných 3 a 4
	d := vybratDvojice(modelky, model, nil, nil, 1, "", rand.New(rand.NewSource(1)))
	if len(d) != 1 || klicDvojice(d[0].A, d[0].B) != [2]int{3, 4} {
		t.Fatalf("dvojice: %+v", d)
	}
}

// ---------------------------------------------------------------------------------------------------------
// Model vkusu

var vlasyVkus = []string{"blond", "hnědá", "zrzavá", "černá"}
var fotografoveVkus = []string{"Pompeo Posar", "Arny Freytag", "Stephen Wayda", "Richard Fegley"}

// Umělá sbírka: hodnocení podle vlasů, desetiletí a fotografa (s šumem), nebo náhodné
func sbirkaVkusu(n, hodnocenych int, nahodne bool) []Modelka {
	r := rand.New(rand.NewSource(42))
	var modelky []Modelka
	for i := range n {
		vlasy := vlasyVkus[r.Intn(len(vlasyVkus))]
		rok := 1960 + 10*r.Intn(4) + r.Intn(10)
		fotograf := fotografoveVkus[r.Intn(len(fotografoveVkus))]
		m := Modelka{ID: i + 1, Jmeno: fmt.Sprintf("Modelka %03d", i), VlasyBarva: vlasy, VyskaCm: 160 + r.Intn(20), VahaKg: 48 + r.Intn(12),
			Etnicita: "kavkazská", Narodnost: "USA", Vydani: []string{fmt.Sprintf("%d-06", rok)}, Centerfoldy: []string{fmt.Sprintf("%d-06", rok)},
			fotografoveAlb: fotograf + "\n", Tetovani: -1, Piercing: -1}
		if i < hodnocenych {
			h := 2.5 + r.NormFloat64()*0.3
			if vlasy == "blond" {
				h += 1.5
			}
			if vlasy == "černá" {
				h -= 0.5
			}
			if rok/10 == 197 {
				h += 0.7
			}
			if fotograf == "Pompeo Posar" {
				h += 0.5
			}
			if nahodne {
				h = 0.5 + 4.5*r.Float64()
			}
			m.Hodnoceni = min(max(zaokrouhlitNaPul(h), 0.5), 5)
		}
		modelky = append(modelky, m)
	}
	return modelky
}

func TestModelVkusuOvereni(t *testing.T) {
	modelky := sbirkaVkusu(260, 200, false)
	model := spocitatOblibenost(modelky, nil, time.Now())
	v := model.vkus
	if v == nil || !v.platny || v.presnost < 0.6 || v.chybaCV > 0.7*v.chybaZaklad {
		t.Fatalf("model vkusu: %+v", v)
	}
	t.Logf("vkus: %d hodnocených, %d sloupců, λ %v, chyba CV %.3f (průměr %.3f), přesnost %.3f, vysoké %d/%d",
		v.n, len(v.sloupce), v.lambda, v.chybaCV, v.chybaZaklad, v.presnost, v.trefVysokych, v.vysokych)
	// Blond ze 70. let od Posara má vysoký odhad a důvod to řekne
	var nejlepsi Modelka
	for _, m := range modelky[200:] {
		if m.VlasyBarva == "blond" && strings.HasPrefix(m.Vydani[0], "197") && m.fotografoveAlb == "Pompeo Posar\n" {
			nejlepsi = m
		}
	}
	if nejlepsi.ID == 0 {
		t.Skip("v umělé sbírce není nehodnocená blond ze 70. let od Posara")
	}
	odhad, duvod, ok := model.odhadModelky(nejlepsi, true)
	if !ok || odhad < 4.5 || !strings.Contains(duvod, "blond") || !strings.Contains(duvod, "70. léta") {
		t.Fatalf("odhad %v, důvod %q", odhad, duvod)
	}
	// Náhodné hodnocení: model ověřením neprojde a nic neodhaduje
	nahodne := spocitatOblibenost(sbirkaVkusu(260, 200, true), nil, time.Now())
	if nahodne.vkus.platny || len(nahodne.odhad) != 0 {
		t.Fatalf("náhodné hodnocení prošlo: %+v", nahodne.vkus)
	}
	// Málo hodnocených: bez odhadů
	malo := spocitatOblibenost(sbirkaVkusu(60, 20, false), nil, time.Now())
	if malo.vkus.platny || len(malo.odhad) != 0 {
		t.Fatal("model z 20 hodnocených prošel")
	}
}

// Odhad hodnocení v GetModelky, „Mohlo by se ti líbit“ a přesnost v GetOblibenost přes celou aplikaci
func TestMohloByTeLibit(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	tx, _ := a.db.Begin()
	for _, m := range sbirkaVkusu(200, 150, false) {
		pul := m.hodnoceniPul()
		tx.Exec(`INSERT INTO modelky (id, jmeno, vlasy_barva, etnicita, narodnost, vyska_cm, vaha_kg, hodnoceni_pul, hodnoceni) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			m.ID, m.Jmeno, m.VlasyBarva, m.Etnicita, m.Narodnost, m.VyskaCm, m.VahaKg, pul, pul/2)
		res, _ := tx.Exec(`INSERT INTO alba (modelka_id, album, typ, vydani, fotograf) VALUES (?, ?, 'Centerfold', ?, ?)`, m.ID, m.Vydani[0], m.Vydani[0], strings.TrimSpace(m.fotografoveAlb))
		album, _ := res.LastInsertId()
		tx.Exec(`INSERT INTO fotky (album_id, drive_file_id) VALUES (?, ?)`, album, fmt.Sprintf("V%07dxxxxxxxxxxxxxxxxxxxxxxx", m.ID))
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	stav := a.GetOblibenost()
	if !stav.Odhady || stav.Presnost < 0.6 || stav.Modelek != 150 {
		t.Fatalf("stav oblíbenosti: odhady %v, přesnost %v, modelek %d", stav.Odhady, stav.Presnost, stav.Modelek)
	}
	odhadu := 0
	for _, m := range a.GetModelky("") {
		if m.Hodnoceni > 0 && m.OdhadHodnoceni != 0 {
			t.Fatalf("hodnocená modelka má odhad: %+v", m)
		}
		if m.OdhadHodnoceni > 0 {
			odhadu++
			if m.OdhadHodnoceni*2 != math.Round(m.OdhadHodnoceni*2) {
				t.Fatalf("odhad mimo poloviny: %v", m.OdhadHodnoceni)
			}
		}
	}
	if odhadu != 50 {
		t.Fatalf("odhadů u nehodnocených: %d", odhadu)
	}
	tipy := a.GetMohloByTeLibit(5)
	if len(tipy) == 0 {
		t.Fatal("žádný tip")
	}
	for i, tip := range tipy {
		m := modelkaPodleJmena(t, a, tip.Jmeno)
		if m.Hodnoceni != 0 || tip.Odhad < 3 || tip.Duvod == "" || (i > 0 && tip.Sila > tipy[i-1].Sila) {
			t.Fatalf("tip %d: %+v (hodnocení %v)", i, tip, m.Hodnoceni)
		}
	}
	if !strings.Contains(tipy[0].Duvod, "blond") {
		t.Fatalf("důvod nejlepšího tipu: %q", tipy[0].Duvod)
	}
	// Ohodnocená modelka z tipů zmizí
	a.SetHodnoceni(tipy[0].ModelkaID, 2)
	for _, tip := range a.GetMohloByTeLibit(5) {
		if tip.ModelkaID == tipy[0].ModelkaID {
			t.Fatal("ohodnocená modelka zůstala v tipech")
		}
	}
}

// GetModelky nad 3000 modelkami s oblíbeností: bez ní, první výpočet modelů, z paměti a po změně hodnocení
func TestVykonOblibenosti(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	a := novaTestovaciApp(t, nil)
	naplnitSbirkuNavrhu(t, a, 3000)
	a.db.Exec("UPDATE modelky SET hodnoceni_pul = 1 + id % 10, hodnoceni = (1 + id % 10) / 2 WHERE id % 3 = 0")
	a.db.Exec("UPDATE fotky SET hodnoceni = 1 + id % 5 WHERE id % 2 = 0")
	r := rand.New(rand.NewSource(3))
	for range 500 {
		x, y := 3*(1+r.Intn(999)), 3*(1+r.Intn(999))
		if x != y {
			a.PorovnatModelky(x, y, []string{"a", "b", "remiza"}[r.Intn(3)])
		}
	}
	zmerit := func(nazev string, f func()) time.Duration {
		nejlepsi := time.Duration(math.MaxInt64)
		for range 3 {
			zacatek := time.Now()
			f()
			nejlepsi = min(nejlepsi, time.Since(zacatek))
		}
		t.Logf("%s: %v", nazev, nejlepsi)
		return nejlepsi
	}
	bez := zmerit("načtení modelek bez oblíbenosti (dřívější GetModelky)", func() { a.nactiModelky("", false) })
	zacatek := time.Now()
	a.GetModelky("")
	prvni := time.Since(zacatek)
	t.Logf("GetModelky, první výpočet modelů: %v", prvni)
	s := zmerit("GetModelky z paměti", func() { a.GetModelky("") })
	zmerit("GetModelky s hledáním z paměti", func() { a.GetModelky("vlasy:blond") })
	a.SetHodnoceni(3, 4.5)
	zacatek = time.Now()
	a.GetModelky("")
	t.Logf("GetModelky po změně hodnocení: %v", time.Since(zacatek))
	zmerit("výpočet modelů (spocitatOblibenost)", func() {
		modelky, _ := a.nactiModelky("", false)
		a.uc.mu.Lock()
		p := a.uc.nacistPorovnani()
		a.uc.mu.Unlock()
		spocitatOblibenost(modelky, p, time.Now())
	})
	zmerit("GetDvojiceKPorovnani(10)", func() { a.GetDvojiceKPorovnani(10, "") })
	v := a.uc.ob.model.vkus
	t.Logf("vkus: %d hodnocených, %d sloupců, přesnost %.3f, platný %v", v.n, len(v.sloupce), v.presnost, v.platny)
	if s > bez+bez/2+20*time.Millisecond || prvni > 2*time.Second {
		t.Errorf("GetModelky z paměti %v (bez oblíbenosti %v), první výpočet %v", s, bez, prvni)
	}
}

// Nehodnocená se porovnává s modelkou, která má tolik srdíček, kolik vychází její odhad (po polovinách); bez modelky
// na té úrovni s nejbližší; po porovnáních podle síly z nich (výhry posunou kotvu výš)
func TestNehodnocenaProtiUrovniOdhadu(t *testing.T) {
	var modelky []Modelka
	id := 0
	for _, h := range []float64{2, 2, 3, 3, 3.5, 3.5, 3.5, 4, 4, 5} {
		id++
		modelky = append(modelky, Modelka{ID: id, Jmeno: fmt.Sprintf("M%d", id), Hodnoceni: h, CoverID: "x"})
	}
	modelky = append(modelky, Modelka{ID: 100, Jmeno: "Nová", CoverID: "x"})
	srdicka := map[int]float64{}
	for _, m := range modelky {
		srdicka[m.ID] = m.Hodnoceni
	}
	kotvy := func(model *modelOblibenosti, porovnani []porovnaniZaznam) map[float64]bool {
		urovne := map[float64]bool{}
		for range 6 {
			for _, d := range vybratDvojice(modelky, model, porovnani, nil, 3, "nehodnocene", rand.New(rand.NewSource(int64(len(urovne))))) {
				jina := d.A
				if jina == 100 {
					jina = d.B
				}
				urovne[srdicka[jina]] = true
				if !strings.Contains(d.Duvod, "srdíč") {
					t.Fatalf("důvod bez úrovně: %q", d.Duvod)
				}
			}
		}
		return urovne
	}
	model := spocitatOblibenost(modelky, nil, time.Now())
	model.odhad[100] = 3.6 // odhad 3½
	if u := kotvy(model, nil); len(u) != 1 || !u[3.5] {
		t.Fatalf("odhad 3½: kotvy s %v srdíčky", u)
	}
	model.odhad[100] = 4.6 // 4½ nikdo nemá: nejbližší (při shodě vyšší) je 5
	if u := kotvy(model, nil); len(u) != 1 || !u[5] {
		t.Fatalf("odhad 4½: kotvy s %v srdíčky", u)
	}
	// Výhry nad modelkami se 3½ posunou sílu a s ní kotvu výš
	var porovnani []porovnaniZaznam
	for k, kotva := range []int{5, 6, 7, 5, 6, 7} {
		porovnani = append(porovnani, porovnaniZaznam{id: int64(k + 1), a: 100, b: kotva, vysledek: "a", ha: 0, hb: 3.5})
	}
	model = spocitatOblibenost(modelky, porovnani, time.Now())
	model.odhad[100] = 3.6
	if u := kotvy(model, porovnani[len(porovnani):]); u[3.5] || u[2] || u[3] {
		t.Fatalf("po výhrách nad 3½ mají být kotvy výš: %v (síla %.2f)", u, model.sila[100])
	}
}

// Návrh srdíček nehodnocené: výhry nad 3½ a prohra s 4½ (jak je nabízí výběr dvojic) dají 3½–4½, dřív (dvě
// porovnání) nic; samé výhry nad jednou úrovní nic (ví se jen „výš“, ne o kolik); hodnocená nic
func TestNavrhSrdicekNehodnocene(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for i, h := range []float64{3.5, 3.5, 3.5, 4, 4, 4.5} {
		j := fmt.Sprintf("M%d", i)
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), h)
	}
	a.AddModelka(Modelka{Jmeno: "Nová", Tetovani: -1, Piercing: -1})
	nova := idModelky(t, a, "Nová")
	kotvy := []int{idModelky(t, a, "M0"), idModelky(t, a, "M1"), idModelky(t, a, "M2")}
	a.PorovnatModelky(nova, kotvy[0], "a")
	a.PorovnatModelky(nova, kotvy[1], "a")
	if n := a.GetNavrhSrdicek(nova); n.Hodnoceni != 0 || n.Porovnani != 2 {
		t.Fatalf("po dvou porovnáních: %+v", n)
	}
	a.PorovnatModelky(kotvy[2], nova, "b")
	if n := a.GetNavrhSrdicek(nova); n.Hodnoceni != 0 || n.Vyhry != 3 {
		t.Fatalf("po třech výhrách nad 3½ je nejistota velká: %+v", n)
	}
	a.PorovnatModelky(nova, idModelky(t, a, "M5"), "b")
	a.PorovnatModelky(nova, idModelky(t, a, "M3"), "remiza")
	n := a.GetNavrhSrdicek(nova)
	if n.Porovnani != 5 || n.Hodnoceni < 3.5 || n.Hodnoceni > 4.5 || n.Nejistota > maxNejistotaNavrhu {
		t.Fatalf("po výhrách nad 3½, prohře s 4½ a remíze se 4: %+v", n)
	}
	if h := a.GetNavrhSrdicek(kotvy[0]); h.Hodnoceni != 0 {
		t.Fatalf("hodnocená nemá dostat návrh: %+v", h)
	}
}

// Výchozí výběr sám přimíchá nehodnocené (asi třetinu dvojic), aniž by se přepínal okruh
func TestVyberDvojicMichaNehodnocene(t *testing.T) {
	var modelky []Modelka
	for i := range 40 {
		h := 0.0
		if i < 24 {
			h = float64(2 + i%4)
		}
		modelky = append(modelky, Modelka{ID: i + 1, Hodnoceni: h, CoverID: "x"})
	}
	model := spocitatOblibenost(modelky, nil, time.Now())
	nehodnocenych, celkem := 0, 0
	for k := range 30 {
		for _, d := range vybratDvojice(modelky, model, nil, nil, 6, "", rand.New(rand.NewSource(int64(k)))) {
			celkem++
			if modelky[d.A-1].Hodnoceni == 0 || modelky[d.B-1].Hodnoceni == 0 {
				nehodnocenych++
			}
		}
	}
	if podil := float64(nehodnocenych) / float64(celkem); podil < 0.15 || podil > 0.55 {
		t.Fatalf("podíl dvojic s nehodnocenou %.2f (%d z %d)", podil, nehodnocenych, celkem)
	}
}

// Nesoulad se srdíčky: modelka se 4½, která prohrává se slabšími, má návrh 4; se 3, která vyhrává se silnějšími, 3½;
// vyrovnané výsledky nic
func TestNesouladSrdicek(t *testing.T) {
	modelky := []Modelka{{ID: 1, Jmeno: "Silná", Hodnoceni: 4.5}, {ID: 2, Jmeno: "Slabá", Hodnoceni: 3}, {ID: 3, Hodnoceni: 4}, {ID: 4, Hodnoceni: 3.5}, {ID: 5, Hodnoceni: 4}}
	nyni := time.Now()
	var porovnani []porovnaniZaznam
	pridat := func(a, b int, v string) {
		porovnani = append(porovnani, porovnaniZaznam{id: int64(len(porovnani) + 1), cas: nyni, a: a, b: b, vysledek: v})
	}
	pridat(1, 3, "b")
	pridat(4, 1, "a")
	pridat(1, 5, "b")
	pridat(2, 3, "a")
	pridat(5, 2, "b")
	pridat(2, 4, "a")
	pridat(3, 4, "a") // 4 proti 3½: podle očekávání
	n := spocitatNesoulad(modelky, porovnani, nyni)
	if s, ok := n[1]; !ok || s.Smer != "mene" || s.Navrh != 4 || s.Porovnani != 3 || s.Vysledky != 3 {
		t.Fatalf("silná: %+v", n[1])
	}
	if s, ok := n[2]; !ok || s.Smer != "vice" || s.Navrh != 3.5 || s.Vysledky != 3 {
		t.Fatalf("slabá: %+v", n[2])
	}
	if _, ok := n[4]; ok {
		t.Fatalf("modelka se 3½ s jednou výhrou a dvěma prohrami nemá mít nesoulad: %+v", n[4])
	}
}
