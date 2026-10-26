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

// Srdíčka po půlce se mohou přeskupit podle fotek, celé srdíčko ne
func TestSkoreFotekPreskupiPulSrdicka(t *testing.T) {
	modelky := pozadiFotek(40, rand.New(rand.NewSource(3)))
	vyborne := []srdickaAlba{albumStejnych(8, 5), albumStejnych(8, 5), albumStejnych(8, 5)}
	slabe := []srdickaAlba{albumStejnych(8, 2), albumStejnych(8, 2), albumStejnych(8, 2)}
	modelky = append(modelky,
		Modelka{ID: 1, Hodnoceni: 4, srdickaAlb: vyborne},
		Modelka{ID: 2, Hodnoceni: 4.5, srdickaAlb: slabe},
		Modelka{ID: 3, Hodnoceni: 3, srdickaAlb: vyborne},
		Modelka{ID: 4, Hodnoceni: 4, srdickaAlb: slabe},
		Modelka{ID: 5, Hodnoceni: 4})
	model := spocitatOblibenost(modelky, nil, time.Now())
	ob := model.oblibenost
	t.Logf("váha %.2f, převod α %.2f β %.2f; oblíbenost %v %v %v %v %v", model.vaha.vaha, model.kalibrace.alfa, model.kalibrace.beta, ob[1], ob[2], ob[3], ob[4], ob[5])
	if model.vaha.naucena || model.vaha.vaha != vychoziVahaFotek {
		t.Fatalf("bez porovnání má platit výchozí váha: %+v", model.vaha)
	}
	if ob[1] <= ob[2] {
		t.Fatalf("čtyřka s výbornými fotkami (%v) nepředběhla 4½ se slabými (%v)", ob[1], ob[2])
	}
	if ob[3] >= ob[4] || ob[3] >= 3.5 || ob[4] <= 3.5 {
		t.Fatalf("o celé srdíčko se pořadí přehodilo: trojka %v, čtyřka %v", ob[3], ob[4])
	}
	// Bez fotek zůstává na srdíčkách
	if ob[5] != 4 {
		t.Fatalf("bez fotek: %v", ob[5])
	}
	if d := model.duvodOblibenosti(Modelka{ID: 1, Hodnoceni: 4}, ""); !strings.HasPrefix(d, "srdíčka 4 · fotky ") || !strings.HasSuffix(d, " (3 alba, 24 hodnocených fotek)") {
		t.Fatalf("důvod: %q", d)
	}
}

// Umělá porovnání: skutečná síla t, srdíčka = t zaokrouhlené na půlky se šumem, skóre fotek přesné nebo náhodné
func porovnaniProVahu(n int, presneFotky bool, seed int64) []porovnaniVahy {
	r := rand.New(rand.NewSource(seed))
	type modelka struct{ t, h, f float64 }
	modelky := make([]modelka, 80)
	for i := range modelky {
		t := 2 + 3*r.Float64()
		f := t + r.NormFloat64()*0.15
		if !presneFotky {
			f = 2 + 3*r.Float64()
		}
		modelky[i] = modelka{t, min(max(zaokrouhlitNaPul(t+r.NormFloat64()*0.4), 0.5), 5), f}
	}
	var data []porovnaniVahy
	for len(data) < n {
		i, j := r.Intn(len(modelky)), r.Intn(len(modelky))
		a, b := modelky[i], modelky[j]
		if i == j || a.h != b.h {
			continue
		}
		y := 0.0
		if r.Float64() < zLogitu(4*(a.t-b.t)) {
			y = 1
		}
		data = append(data, porovnaniVahy{hi: a.h, hj: b.h, fi: a.f, fj: b.f, y: y, t: 1})
	}
	return data
}

func TestVahaFotekZPorovnani(t *testing.T) {
	presne := naucitVahuFotek(porovnaniProVahu(400, true, 1), 3)
	t.Logf("přesné fotky: %+v, zlepšení %.3f", presne, presne.zlepseni())
	if !presne.naucena || presne.vaha < 0.5 || presne.zlepseni() <= 0 {
		t.Fatalf("přesné skóre fotek: %+v", presne)
	}
	nahodne := naucitVahuFotek(porovnaniProVahu(400, false, 2), 3)
	t.Logf("náhodné fotky: %+v, zlepšení %.3f", nahodne, nahodne.zlepseni())
	if !nahodne.naucena || nahodne.vaha > 0.2 {
		t.Fatalf("náhodné skóre fotek: %+v", nahodne)
	}
	// Málo porovnání: výchozí váha
	malo := naucitVahuFotek(porovnaniProVahu(8, true, 3), 3)
	if malo.naucena || malo.vaha != vychoziVahaFotek {
		t.Fatalf("z osmi porovnání: %+v", malo)
	}
	// Málo porovnání (ale nad prahem) se smrští k výchozí víc než mnoho
	nekolik := naucitVahuFotek(porovnaniProVahu(25, true, 4), 3)
	t.Logf("25 porovnání: %+v", nekolik)
	if !nekolik.naucena || math.Abs(nekolik.vaha-vychoziVahaFotek) > math.Abs(presne.vaha-vychoziVahaFotek)+1e-9 {
		t.Fatalf("25 porovnání se smrštila méně než 400: %v proti %v", nekolik.vaha, presne.vaha)
	}
	// Porovnání bez skóre fotek váhu nemění
	var bez []porovnaniVahy
	for _, p := range porovnaniProVahu(100, true, 5) {
		p.fi, p.fj = 0, 0
		bez = append(bez, p)
	}
	if v := naucitVahuFotek(bez, 3); v.porovnani != 0 || v.naucena {
		t.Fatalf("bez skóre fotek: %+v", v)
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
	// Nehodnocená Bára s hodnocenými fotkami je v pořadí jen odhadem z fotek, pod hodnocenou Annou
	if len(stav.Poradi) != 2 || stav.Poradi[1].ModelkaID != bara || !stav.Poradi[1].OdhadZFotek || stav.Poradi[0].OdhadZFotek {
		t.Fatalf("pořadí: %+v", stav.Poradi)
	}
	p := stav.Poradi[0]
	if p.ModelkaID != anna || p.AlbFotek != 2 || p.FotekHodnocenych != 5 || p.SkoreFotek <= 3 || p.SkoreFotek >= 5 || !strings.Contains(p.Duvod, "fotky ") || stav.VahaFotek != vychoziVahaFotek {
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
	t.Logf("náhledy 6 modelek bez paměti %v, z paměti %v; GetOblibenost %v (skóre fotek u %d modelek, váha %.2f z %d porovnání, model vkusu ze skóre %v)",
		studene, teple, oblibenost, len(model.skore), stav.VahaFotek, stav.PorovnaniVahy, model.vkusZeSkore)
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
func TestVahaFotekVOblibenosti(t *testing.T) {
	r := rand.New(rand.NewSource(9))
	sestavit := func(protiFotkam bool) *modelOblibenosti {
		var modelky []Modelka
		uroven := map[int]float64{}
		for i := range 40 {
			u := 1 + r.Intn(5)
			uroven[i+1] = float64(u)
			modelky = append(modelky, Modelka{ID: i + 1, Hodnoceni: 4, srdickaAlb: []srdickaAlba{albumStejnych(6, u), albumStejnych(6, u)}})
		}
		var porovnani []porovnaniZaznam
		for k := 0; len(porovnani) < 300; k++ {
			i, j := 1+r.Intn(40), 1+r.Intn(40)
			if i == j || uroven[i] == uroven[j] {
				continue
			}
			lepsi := uroven[i] > uroven[j]
			if protiFotkam {
				lepsi = !lepsi
			}
			v := "b"
			if lepsi {
				v = "a"
			}
			porovnani = append(porovnani, porovnaniZaznam{id: int64(k + 1), a: i, b: j, vysledek: v, ha: 4, hb: 4})
		}
		return spocitatOblibenost(modelky, porovnani, time.Now())
	}
	podle := sestavit(false)
	proti := sestavit(true)
	t.Logf("podle fotek: %+v; proti fotkám: %+v", podle.vaha, proti.vaha)
	if !podle.vaha.naucena || podle.vaha.vaha <= vychoziVahaFotek || proti.vaha.vaha >= vychoziVahaFotek {
		t.Fatalf("váha podle fotek %v, proti fotkám %v", podle.vaha.vaha, proti.vaha.vaha)
	}
}

// Nehodnocená a neporovnaná modelka s hodnocenými fotkami je v Pořadí s příznakem odhadu z fotek
func TestPoradiOdhadZFotek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Hodnocená", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Jen fotky", Tetovani: -1, Piercing: -1})
	hodnocena, fotky := idModelky(t, a, "Hodnocená"), idModelky(t, a, "Jen fotky")
	a.SetHodnoceni(hodnocena, 3)
	a.AddBulkPhotos(fotky, "Pláž", "Pictorial", odkazA+" "+odkazB)
	for _, f := range a.GetFotografieModelky(fotky) {
		a.SetHodnoceniFotek([]int{f.ID}, 5)
	}
	var nasla bool
	for _, p := range a.GetOblibenost().Poradi {
		if p.ModelkaID == fotky {
			nasla = true
			if !p.OdhadZFotek || p.Hodnoceni != 0 || !strings.Contains(p.Duvod, "odhad z fotek") {
				t.Fatalf("položka: %+v", p)
			}
		}
		if p.ModelkaID == hodnocena && p.OdhadZFotek {
			t.Fatalf("hodnocená nemá být odhad z fotek: %+v", p)
		}
	}
	if !nasla {
		t.Fatal("nehodnocená modelka s fotkami v pořadí chybí")
	}
}
