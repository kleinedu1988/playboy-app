package main

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Skóre fotek (album jako jeden hlas, průměr nejlepších fotek, smrštění), naučená váha fotek, náhledy alb

// Album ze srdíček jednotlivých fotek
func albumFotek(srdicka ...int) srdickaAlba {
	var c srdickaAlba
	for _, h := range srdicka {
		c[h-1]++
	}
	return c
}

// Album n fotek se stejnými srdíčky
func albumStejnych(n, h int) srdickaAlba {
	var c srdickaAlba
	c[h-1] = n
	return c
}

// Pozadí sbírky: modelky s několika alby různé kvality, aby se rozptyly odhadly ze sbírky
func pozadiFotek(n int, r *rand.Rand) []Modelka {
	var modelky []Modelka
	for i := range n {
		uroven := 2 + 2.5*r.Float64()
		m := Modelka{ID: 1000 + i, Jmeno: fmt.Sprintf("Pozadí %d", i), Hodnoceni: min(max(zaokrouhlitNaPul(uroven+r.NormFloat64()*0.3), 0.5), 5)}
		for range 1 + r.Intn(4) {
			album := uroven + r.NormFloat64()*0.4
			var srdicka []int
			for range 1 + r.Intn(12) {
				srdicka = append(srdicka, min(max(int(math.Round(album+r.NormFloat64()*0.7)), 1), 5))
			}
			m.srdickaAlb = append(m.srdickaAlb, albumFotek(srdicka...))
		}
		modelky = append(modelky, m)
	}
	return modelky
}

func TestSkoreAlbaNejlepsiFotky(t *testing.T) {
	for _, p := range []struct {
		album srdickaAlba
		chci  float64
		k     int
	}{
		// Pět výborných a třicet průměrných: výborné album
		{albumFotek(5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3), 5, 5},
		// Slabší čtvrtina se nepočítá
		{albumFotek(5, 5, 5, 1), 5, 3},
		// Jediná dobrá fotka mezi slabými album nespasí
		{albumFotek(5, 2, 2, 2, 2, 2, 2, 2), (5 + 2*4) / 5.0, 5},
		{albumFotek(4), 4, 1},
		{albumFotek(5, 1), 3, 2},
	} {
		prumer, k, _, _ := skoreAlba(p.album)
		if math.Abs(prumer-p.chci) > 1e-9 || k != p.k {
			t.Errorf("%v: %v (k %d), chci %v (k %d)", p.album, prumer, k, p.chci, p.k)
		}
	}
}

// Album je jeden hlas: čtyřicet průměrných fotek nepřehlasuje album s pěti výbornými (průměr fotek by to udělal)
func TestSkoreFotekAlbumJedenHlas(t *testing.T) {
	modelky := pozadiFotek(60, rand.New(rand.NewSource(1)))
	modelky = append(modelky,
		Modelka{ID: 1, srdickaAlb: []srdickaAlba{albumStejnych(40, 3), albumStejnych(6, 5)}},
		Modelka{ID: 2, srdickaAlb: []srdickaAlba{albumStejnych(6, 3), albumStejnych(40, 5)}})
	skore, par := spocitatSkoreFotek(modelky)
	x, y := skore[1], skore[2]
	t.Logf("parametry %+v; X %+v; Y %+v", par, x, y)
	if math.Abs(x.skore-y.skore) > 1e-9 {
		t.Fatalf("počet fotek v albu rozhodl: %v proti %v", x.skore, y.skore)
	}
	if x.skore < 3.5 || x.skore > 4.5 || x.alb != 2 || x.fotek != 46 {
		t.Fatalf("skóre dvou alb (3 a 5): %+v", x)
	}
}

// Smrštění: jedna fotka za 5 srdíček není jistá pětka; tři alba plná pětek jsou blízko 5 a s menší nejistotou
func TestSkoreFotekSmrsteni(t *testing.T) {
	modelky := pozadiFotek(60, rand.New(rand.NewSource(2)))
	modelky = append(modelky,
		Modelka{ID: 1, srdickaAlb: []srdickaAlba{albumFotek(5)}},
		Modelka{ID: 2, srdickaAlb: []srdickaAlba{albumStejnych(10, 5), albumStejnych(10, 5), albumStejnych(10, 5)}},
		Modelka{ID: 3, srdickaAlb: []srdickaAlba{albumFotek(1)}})
	skore, par := spocitatSkoreFotek(modelky)
	jedna, tri, slaba := skore[1], skore[2], skore[3]
	t.Logf("μ %.2f, σ_w² %.2f, τₐ² %.2f, τₘ² %.2f; jedna %+v; tři alba %+v", par.stred, par.rozptylFoto, par.rozptylAlb, par.rozptylModelek, jedna, tri)
	if !(jedna.skore < tri.skore && jedna.skore > par.stred && jedna.skore < 4.6) {
		t.Fatalf("jedna fotka: %v, tři alba %v, průměr %v", jedna.skore, tri.skore, par.stred)
	}
	if tri.skore < 4.4 || tri.rozptyl >= jedna.rozptyl {
		t.Fatalf("tři alba pětek: %+v (jedna fotka %+v)", tri, jedna)
	}
	// Symetricky dolů
	if slaba.skore > par.stred || slaba.skore < 1.5 {
		t.Fatalf("jedna fotka za 1 srdíčko: %v", slaba.skore)
	}
	// Bez hodnocených fotek skóre není
	if _, ok := skore[1000+999]; ok {
		t.Fatal("skóre bez fotek")
	}
}

// Srdíčka fotek sílu modelky neposouvají: bez porovnání je oblíbenost přesně její srdíčka, skóre fotek je jen údaj
func TestFotkyNeposouvajiOblibenost(t *testing.T) {
	modelky := pozadiFotek(40, rand.New(rand.NewSource(3)))
	vyborne := []srdickaAlba{albumStejnych(8, 5), albumStejnych(8, 5), albumStejnych(8, 5)}
	slabe := []srdickaAlba{albumStejnych(8, 2), albumStejnych(8, 2), albumStejnych(8, 2)}
	modelky = append(modelky,
		Modelka{ID: 1, Hodnoceni: 4, srdickaAlb: vyborne},
		Modelka{ID: 2, Hodnoceni: 4.5, srdickaAlb: slabe},
		Modelka{ID: 5, Hodnoceni: 4})
	model := spocitatOblibenost(modelky, nil, time.Now())
	ob := model.oblibenost
	if ob[1] != 4 || ob[2] != 4.5 || ob[5] != 4 {
		t.Fatalf("oblíbenost se odchýlila od srdíček: %v %v %v", ob[1], ob[2], ob[5])
	}
	if _, ok := model.skore[1]; !ok {
		t.Fatal("skóre fotek jako údaj chybí")
	}
	if d := model.duvodOblibenosti(Modelka{ID: 1, Hodnoceni: 4}, ""); !strings.HasPrefix(d, "srdíčka 4 · fotky ") || !strings.HasSuffix(d, " (3 alba, 24 hodnocených fotek)") {
		t.Fatalf("důvod: %q", d)
	}
}

func TestVyberNahledu(t *testing.T) {
	alba := []albumModelky{
		{id: 10, nazev: "Slabší", typ: "Pictorial", fotek: 3, pocty: albumFotek(3, 2)},
		{id: 11, nazev: "Nejlepší", typ: "Centerfold", fotek: 4, pocty: albumFotek(5, 5, 4)},
		{id: 12, nazev: "Nehodnocené", typ: "Pictorial online", fotek: 2},
	}
	fotky := map[int64][]fotkaNahledu{
		10: {{id: 100, hodnoceni: 2, drive: "a"}, {id: 101, hodnoceni: 3, drive: "b"}, {id: 102, drive: "c"}},
		11: {{id: 110, hodnoceni: 4, drive: "d"}, {id: 111, hodnoceni: 5, drive: "titulni"}, {id: 112, hodnoceni: 5, drive: "e", poradi: 2}, {id: 113, hodnoceni: 5, drive: "f", poradi: 1}, {id: 114, drive: "g"}},
		12: {{id: 121, drive: "h"}, {id: 120, drive: "i"}},
	}
	cisla := func(n []NahledFotky) []int {
		var v []int
		for _, f := range n {
			v = append(v, f.ID)
		}
		return v
	}
	// Tři náhledy: z každého alba nejlepší (titulní fotka se neopakuje, ruční pořadí rozhodne shodu), seřazené podle srdíček
	if v := cisla(vybratNahledy(alba, fotky, 3, "titulni")); fmt.Sprint(v) != "[113 101 120]" {
		t.Fatalf("tři náhledy: %v", v)
	}
	// Šest: zbylá místa podle srdíček (nehodnocená druhá fotka třetího alba nepředběhne fotku za 4)
	if v := cisla(vybratNahledy(alba, fotky, 6, "titulni")); fmt.Sprint(v) != "[113 112 110 101 100 120]" {
		t.Fatalf("šest náhledů: %v", v)
	}
	// Méně náhledů než alb: nejlepší alba
	if v := cisla(vybratNahledy(alba, fotky, 2, "")); fmt.Sprint(v) != "[113 101]" {
		t.Fatalf("dva náhledy: %v", v)
	}
	// Víc, než je fotek: všechny
	if v := vybratNahledy(alba, fotky, 24, ""); len(v) != 10 || v[0].Album != "Nejlepší" || v[0].Typ != "Centerfold" || !strings.Contains(v[2].URL, "titulni") || v[9].Hodnoceni != 0 {
		t.Fatalf("všechny: %+v", v)
	}
	if v := vybratNahledy(nil, nil, 8, ""); v == nil || len(v) != 0 {
		t.Fatalf("bez alb: %#v", v)
	}
}

// Přes aplikaci: skóre fotek v pořadí (nehodnocené fotky a alba se nepočítají, sdílené album ano) a náhledy
func TestSkoreANahledyVAplikaci(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	a.SetHodnoceni(anna, 4)
	album := func(modelka int, nazev, typ string, srdicka ...int) int64 {
		res, err := a.db.Exec("INSERT INTO alba (modelka_id, album, typ, vydani) VALUES (?, ?, ?, '')", modelka, nazev, typ)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		for i, h := range srdicka {
			a.db.Exec("INSERT INTO fotky (album_id, drive_file_id, hodnoceni) VALUES (?, ?, ?)", id, fmt.Sprintf("F%d-%d-xxxxxxxxxxxxxxxxxxxxxxxx", id, i), h)
		}
		return id
	}
	album(anna, "První", "Pictorial", 5, 5, 4)
	album(anna, "Nehodnocené", "Pictorial", 0, 0, 0, 0)
	sdilene := album(bara, "Spolu", "Pictorial", 3, 3)
	a.db.Exec("INSERT INTO alba_modelky (album_id, modelka_id) VALUES (?, ?)", sdilene, anna)
	stav := a.GetOblibenost()
	// Nehodnocená Bára jen s hodnocenými fotkami v pořadí není, Anna má skóre fotek jako údaj
	if len(stav.Poradi) != 1 || stav.Poradi[0].JenOdhad {
		t.Fatalf("pořadí: %+v", stav.Poradi)
	}
	p := stav.Poradi[0]
	if p.ModelkaID != anna || p.AlbFotek != 2 || p.FotekHodnocenych != 5 || p.SkoreFotek <= 3 || p.SkoreFotek >= 5 || !strings.Contains(p.Duvod, "fotky ") {
		t.Fatalf("Anna v pořadí: %+v, stav %+v", p, stav)
	}
	nahledy := a.GetNahledyModelek([]int{anna, bara, 9999}, 8)
	if len(nahledy[anna]) != 8 || nahledy[anna][0].Hodnoceni != 5 || len(nahledy[bara]) != 2 || nahledy[9999] == nil || len(nahledy[9999]) != 0 {
		t.Fatalf("náhledy: %+v", nahledy)
	}
	// Z každého alba aspoň jeden i při malém počtu
	alb := map[string]bool{}
	for _, f := range a.GetNahledyModelek([]int{anna}, 3)[anna] {
		alb[f.Album] = true
	}
	if len(alb) != 3 {
		t.Fatalf("tři náhledy ze tří alb: %v", alb)
	}
	// Změna srdíček fotky se projeví (nový snímek)
	a.db.Exec("UPDATE fotky SET hodnoceni = 5 WHERE album_id = ?", sdilene)
	if n := a.GetNahledyModelek([]int{bara}, 8)[bara]; n[0].Hodnoceni != 5 {
		t.Fatalf("po změně srdíček: %+v", n)
	}
}

// Výkon na umělé sbírce 3000 modelek: náhledy pro dvojice (bez paměti i z ní) a výpočet oblíbenosti se skóre fotek
func TestVykonNahleduASkore(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	a := novaTestovaciApp(t, nil)
	naplnitSbirkuNavrhu(t, a, 3000)
	a.db.Exec("UPDATE modelky SET hodnoceni_pul = 1 + id % 10, hodnoceni = (1 + id % 10) / 2 WHERE id % 3 = 0")
	a.db.Exec("UPDATE fotky SET hodnoceni = 1 + id % 5 WHERE id % 2 = 0")
	r := rand.New(rand.NewSource(5))
	for range 300 {
		x, y := 3*(1+r.Intn(999)), 3*(1+r.Intn(999))
		if x != y {
			a.PorovnatModelky(x, y, []string{"a", "b"}[r.Intn(2)])
		}
	}
	a.GetModelky("")
	ids := func() []int {
		var v []int
		for range 6 {
			v = append(v, 1+r.Intn(3000))
		}
		return v
	}
	zacatek := time.Now()
	n := a.GetNahledyModelek(ids(), 8)
	studene := time.Since(zacatek)
	dvojice := ids()
	a.GetNahledyModelek(dvojice, 8)
	zacatek = time.Now()
	a.GetNahledyModelek(dvojice, 8)
	teple := time.Since(zacatek)
	zacatek = time.Now()
	stav := a.GetOblibenost()
	oblibenost := time.Since(zacatek)
	model := a.uc.ob.model
	t.Logf("náhledy 6 modelek bez paměti %v, z paměti %v; GetOblibenost %v (skóre fotek u %d modelek, %d v pořadí, model vkusu ze skóre %v)",
		studene, teple, oblibenost, len(model.skore), len(stav.Poradi), model.vkusZeSkore)
	zmerit := func(f func()) time.Duration {
		nejlepsi := time.Duration(math.MaxInt64)
		for range 3 {
			z := time.Now()
			f()
			nejlepsi = min(nejlepsi, time.Since(z))
		}
		return nejlepsi
	}
	modelky, _ := a.nactiModelky("", false)
	a.uc.mu.Lock()
	p := a.uc.nacistPorovnani()
	a.uc.mu.Unlock()
	t.Logf("spocitatOblibenost %v, spocitatSkoreFotek %v", zmerit(func() { spocitatOblibenost(modelky, p, time.Now()) }), zmerit(func() { spocitatSkoreFotek(modelky) }))
	if len(n) != 6 || studene > 100*time.Millisecond || teple > 5*time.Millisecond {
		t.Errorf("náhledy: %d modelek, bez paměti %v, z paměti %v", len(n), studene, teple)
	}
}

// Celý výpočet: modelky jedné úrovně srdíček, porovnání podle kvality fotek → váha fotek se naučí výš než výchozí
// a pořadí sleduje fotky; z porovnání proti fotkám váha klesne
// Nehodnocená a neporovnaná modelka jen s hodnocenými fotkami do Pořadí nepatří (fotky o síle modelky neříkají nic)
func TestPoradiBezOdhaduZFotek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Hodnocená", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Jen fotky", Tetovani: -1, Piercing: -1})
	hodnocena, fotky := idModelky(t, a, "Hodnocená"), idModelky(t, a, "Jen fotky")
	a.SetHodnoceni(hodnocena, 3)
	a.AddBulkPhotos(fotky, "Pláž", "Pictorial", odkazA+" "+odkazB)
	for _, f := range a.GetFotografieModelky(fotky) {
		a.SetHodnoceniFotek([]int{f.ID}, 5)
	}
	poradi := a.GetOblibenost().Poradi
	if len(poradi) != 1 || poradi[0].ModelkaID != hodnocena || poradi[0].JenOdhad || poradi[0].Sila != 3 {
		t.Fatalf("pořadí: %+v", poradi)
	}
}
