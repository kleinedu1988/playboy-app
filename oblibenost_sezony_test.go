package main

import (
	"testing"
	"time"
)

func TestBodySezony(t *testing.T) {
	od := time.Date(2026, 11, 1, 0, 0, 0, 0, time.Local)
	do := od.AddDate(0, 1, 0)
	cas := func(den, hodina int) time.Time { return time.Date(2026, 11, den, hodina, 0, 0, 0, time.Local) }
	existuje := map[int]bool{1: true, 2: true, 3: true, 4: true}
	poradi := map[int]int{1: 1, 2: 5, 3: 0}
	porovnani := []porovnaniZaznam{
		{cas: cas(2, 10), a: 2, b: 1, vysledek: "a"},                                       // 2 porazila silnější 1: 3 + 2
		{cas: cas(2, 11), a: 1, b: 2, vysledek: "a"},                                       // 1 porazila slabší: 3
		{cas: cas(3, 10), a: 1, b: 3, vysledek: "remiza"},                                  // 1 a 3 po 1
		{cas: cas(4, 10), a: 2, b: 3, vysledek: "a"},                                       // 2 porazila 3 (mimo pořadí): 3
		{cas: cas(5, 10), a: 1, b: 3, vysledek: "a"},                                       // 1: 3
		{cas: time.Date(2026, 10, 31, 23, 0, 0, 0, time.Local), a: 3, b: 1, vysledek: "a"}, // jiný měsíc
		{cas: cas(6, 10), a: 4, b: 9, vysledek: "a"},                                       // 9 není ve sbírce
	}
	zajem := []zaznamZajmu{
		{cas: cas(2, 9), id: 1, profil: true},  // +1
		{cas: cas(2, 20), id: 1, profil: true}, // týž den, nic navíc
		{cas: cas(3, 9), id: 1, sekund: 600},   // 5 → strop 4 za den
		{cas: cas(3, 9), id: 3, sekund: 1200},  // 10 → 4, ale strop zájmu = body ze soubojů (1)
		{cas: cas(4, 9), id: 4, profil: true},  // modelka bez soubojů: zájem nejvýš 0
	}
	b := spocitatBodySezony(porovnani, zajem, poradi, existuje, od, do)
	podle := map[int]BodySezony{}
	for _, x := range b {
		podle[x.ModelkaID] = x
	}
	if x := podle[2]; x.ZaSouboje != 8 || x.Vyhry != 2 || x.Prohry != 1 || x.Body != 8 || !x.Soutezi {
		t.Errorf("modelka 2: %+v", x)
	}
	if x := podle[1]; x.ZaSouboje != 7 || x.ZaZajem != 5 || x.Body != 12 || x.Souboju != 4 {
		t.Errorf("modelka 1: %+v", x)
	}
	if x := podle[3]; x.ZaSouboje != 1 || x.ZaZajem != 1 || x.Souboju != 3 || x.Prohry != 2 {
		t.Errorf("modelka 3 (strop zájmu): %+v", x)
	}
	if x, ok := podle[4]; ok && (x.Body != 0 || x.Soutezi) {
		t.Errorf("modelka 4 bez soubojů s modelkou ve sbírce: %+v", x)
	}
	if b[0].ModelkaID != 1 || b[0].Misto != 1 || b[1].ModelkaID != 2 || b[1].Misto != 2 {
		t.Errorf("pořadí: %+v", b)
	}
}

func TestBodySezonyJenSoutezici(t *testing.T) {
	od := time.Date(2026, 11, 1, 0, 0, 0, 0, time.Local)
	cas := time.Date(2026, 11, 2, 10, 0, 0, 0, time.Local)
	existuje := map[int]bool{1: true, 2: true, 3: true}
	// 1 má 2 souboje (nesoutěží), 2 a 3 po 3
	porovnani := []porovnaniZaznam{
		{cas: cas, a: 1, b: 2, vysledek: "a"}, {cas: cas, a: 1, b: 3, vysledek: "a"},
		{cas: cas, a: 2, b: 3, vysledek: "a"}, {cas: cas, a: 2, b: 3, vysledek: "remiza"},
	}
	b := spocitatBodySezony(porovnani, nil, map[int]int{}, existuje, od, od.AddDate(0, 1, 0))
	if b[0].ModelkaID != 2 || b[0].Misto != 1 || b[1].ModelkaID != 3 || b[1].Misto != 2 {
		t.Errorf("soutěžící napřed: %+v", b)
	}
	if b[2].ModelkaID != 1 || b[2].Misto != 0 || b[2].Soutezi || b[2].Body != 6 {
		t.Errorf("nesoutěžící na konci bez místa: %+v", b[2])
	}
}

func TestTrendSezony(t *testing.T) {
	ted := []BodySezony{{ModelkaID: 1, Misto: 1}, {ModelkaID: 2, Misto: 2}, {ModelkaID: 3, Misto: 3}}
	predtim := []BodySezony{{ModelkaID: 2, Misto: 1}, {ModelkaID: 1, Misto: 3}}
	doplnitTrend(ted, predtim)
	if ted[0].Trend != 2 || ted[1].Trend != -1 || ted[2].Trend != 0 {
		t.Errorf("trend: %+v", ted)
	}
}

func TestUzavreniSezony(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"A", "B", "C"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), 4)
	}
	ida, idb, idc := idModelky(t, a, "A"), idModelky(t, a, "B"), idModelky(t, a, "C")
	// Souboje minulý měsíc: A třikrát vyhraje
	minuly := zacatekMesice(time.Now()).AddDate(0, -1, 3).Format("2006-01-02 15:04:05")
	a.uc.mu.Lock()
	db := a.uc.zajistit()
	for _, d := range [][3]any{{ida, idb, "a"}, {ida, idc, "a"}, {ida, idb, "a"}, {idb, idc, "a"}, {idb, idc, "remiza"}} {
		db.Exec("INSERT INTO porovnani (cas, a, b, vysledek) VALUES (?, ?, ?, ?)", minuly, d[0], d[1], d[2])
	}
	a.uc.ob.nacteno, a.uc.ob.porovnani, a.uc.ob.model = false, nil, nil
	a.uc.mu.Unlock()

	s := a.GetSezona()
	if s.KUzavreni == nil || len(s.KUzavreni.Poradi) == 0 || s.KUzavreni.Poradi[0].ModelkaID != ida || s.KUzavreni.Souboju != 5 {
		t.Fatalf("k uzavření: %+v", s.KUzavreni)
	}
	if !a.UzavritSezonu(s.KUzavreni.Mesic, idc) {
		t.Fatal("uzavření")
	}
	s = a.GetSezona()
	if s.KUzavreni != nil || len(s.Minule) != 1 || s.Minule[0].Favoritka != ida || s.Minule[0].Milacek != idc {
		t.Fatalf("po uzavření: %+v %+v", s.KUzavreni, s.Minule)
	}
	// Podruhé se tatáž sezóna nezapíše
	a.UzavritSezonu(s.Minule[0].Mesic, idb)
	if m := a.GetSezona().Minule; len(m) != 1 || m[0].Milacek != idc {
		t.Errorf("druhé uzavření: %+v", m)
	}
	// Kronika a odznak Favoritky; vrácení porovnání je nesmaže
	slava := a.GetSinSlavy()
	druhy := map[string]int{}
	for _, u := range slava.Kronika {
		druhy[u.Druh] = u.ModelkaID
	}
	if druhy[udalostFavoritka] != ida || druhy[udalostMilacek] != idc {
		t.Errorf("kronika: %+v", slava.Kronika)
	}
	odznak := false
	for _, o := range slava.Odznaky {
		if o.ModelkaID == ida && o.Odznak == "favoritka" && o.Stupen == 1 {
			odznak = true
		}
	}
	if !odznak {
		t.Errorf("odznak Favoritka: %+v", slava.Odznaky)
	}
	a.VratitPorovnani()
	if k := a.GetSinSlavy().Kronika; len(k) == 0 {
		t.Error("vrácení porovnání smazalo kroniku sezóny")
	}
}
