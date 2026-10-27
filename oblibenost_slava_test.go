package main

import (
	"fmt"
	"testing"
	"time"
)

// Síň slávy: události z rozdílu držitelek, výpočet vitríny, legend a rekordů z kroniky, zápis a vrácení

// Model jen s pořadím a úrovní: top = id v potvrzené top 10 podle místa, ostatní dál
func modelSlavy(top []int, ostatni ...int) *modelOblibenosti {
	m := &modelOblibenosti{poradi: map[int]int{}, uroven: map[int]int{}}
	for i, id := range top {
		m.poradi[id], m.uroven[id] = i+1, 10
	}
	for i, id := range ostatni {
		m.poradi[id], m.uroven[id] = len(top)+i+1, 20
	}
	return m
}

func TestUdalostiSlavy(t *testing.T) {
	text := func(v []udalostUrovne) string {
		s := ""
		for _, x := range v {
			s += fmt.Sprintf("%s:%d@%d/%d ", x.druh, x.modelka, x.misto, x.souperka)
		}
		return s
	}
	// Začátek kroniky: kdo v top 10 už je a jednička
	if s := text(udalostiSlavy(nil, modelSlavy([]int{5, 3}, 7), nil, nil, true, 0)); s != "zacatek:0@0/0 pocatek:5@1/0 pocatek:3@2/0 jednicka:5@1/0 " {
		t.Errorf("začátek: %s", s)
	}
	stare := map[int]int{5: 10, 3: 10, 7: 20}
	// Beze změny nic
	if s := text(udalostiSlavy(stare, modelSlavy([]int{5, 3}, 7), nil, nil, false, 5)); s != "" {
		t.Errorf("beze změny: %s", s)
	}
	// Sedmička porazila trojku a vystřídala ji; soupeřky z nových porovnání (přednost má ta, která šla opačně)
	nove := []porovnaniZaznam{{a: 7, b: 5, vysledek: "b"}, {a: 7, b: 3, vysledek: "a"}, {a: 3, b: 9, vysledek: "b"}, {a: 1, b: 2, vysledek: "remiza"}}
	if s := text(udalostiSlavy(stare, modelSlavy([]int{5, 7}, 3), nil, nove, false, 5)); s != "vystup:3@3/7 vstup:7@2/3 " {
		t.Errorf("vystřídání: %s", s)
	}
	// Nová jednička a konec jedničky
	if s := text(udalostiSlavy(stare, modelSlavy([]int{3, 5}, 7), nil, nil, false, 5)); s != "jednicka:3@1/5 " {
		t.Errorf("nová jednička: %s", s)
	}
	if s := text(udalostiSlavy(stare, modelSlavy(nil, 5, 3, 7), nil, nil, false, 5)); s != "vystup:5@1/0 vystup:3@2/0 konec:5@0/0 " {
		t.Errorf("konec jedničky: %s", s)
	}
	// Obhajoba: trojka obhajovala proti sedmičce a v posledním vzájemném porovnání vyhrála (remíza nic nemění)
	obhajoby := map[int]ObhajobaUrovne{3: {Uroven: 10, Vyzyvatelka: 7}}
	vyhra := []porovnaniZaznam{{a: 7, b: 3, vysledek: "b"}, {a: 3, b: 7, vysledek: "remiza"}}
	if s := text(udalostiSlavy(stare, modelSlavy([]int{5, 3}, 7), obhajoby, vyhra, false, 5)); s != "obhajoba:3@2/7 " {
		t.Errorf("obhajoba: %s", s)
	}
	prohra := []porovnaniZaznam{{a: 7, b: 3, vysledek: "b"}, {a: 3, b: 7, vysledek: "b"}}
	if s := text(udalostiSlavy(stare, modelSlavy([]int{5, 3}, 7), obhajoby, prohra, false, 5)); s != "" {
		t.Errorf("obhajoba po prohře: %s", s)
	}
	// Obhajoba top 20 se do kroniky top 10 nepíše
	if s := text(udalostiSlavy(stare, modelSlavy([]int{5, 3}, 7), map[int]ObhajobaUrovne{7: {Uroven: 20, Vyzyvatelka: 9}}, []porovnaniZaznam{{a: 7, b: 9, vysledek: "a"}}, false, 5)); s != "" {
		t.Errorf("obhajoba top 20: %s", s)
	}
}

func TestSpocitatSinSlavy(t *testing.T) {
	den0 := time.Date(2026, 1, 1, 12, 0, 0, 0, time.Local)
	nyni := den0.AddDate(0, 0, 100)
	z := func(den int, druh string, modelka, misto, souperka int, porovnani int64) zaznamKroniky {
		c := den0.AddDate(0, 0, den)
		return zaznamKroniky{cas: c, casText: c.Format("2006-01-02 15:04:05"), druh: druh, modelka: modelka, misto: misto, souperka: souperka, porovnani: porovnani}
	}
	kronika := []zaznamKroniky{
		z(0, udalostZacatek, 0, 0, 0, 0),
		z(0, udalostPocatek, 1, 1, 0, 0), z(0, udalostPocatek, 2, 2, 0, 0),
		z(0, udalostJednicka, 1, 1, 0, 0),
		z(10, udalostVstup, 3, 5, 2, 4), z(10, udalostVystup, 2, 11, 3, 4),
		z(20, udalostObhajoba, 3, 4, 4, 6), z(25, udalostObhajoba, 3, 3, 4, 7),
		z(40, udalostJednicka, 3, 1, 1, 9),
		z(70, udalostVstup, 2, 9, 0, 12),
		z(80, udalostVystup, 9, 0, 0, 13), // smazaná modelka
	}
	porovnani := []porovnaniZaznam{{id: 1, a: 3, b: 4}, {id: 2, a: 3, b: 5}, {id: 3, a: 1, b: 2}, {id: 4, a: 3, b: 2}, {id: 5, a: 3, b: 6}}
	model := modelSlavy([]int{3, 1, 2})
	existuje := map[int]bool{1: true, 2: true, 3: true, 4: true}
	s := spocitatSinSlavy(kronika, model, porovnani, existuje, nyni)
	if s.Od != kronika[0].casText || len(s.Vitrina) != 3 || len(s.Legendy) != 0 {
		t.Fatalf("síň: od %q, vitrína %d, legendy %d", s.Od, len(s.Vitrina), len(s.Legendy))
	}
	v := map[int]SlavaModelky{}
	for _, x := range s.Vitrina {
		v[x.ModelkaID] = x
	}
	if x := v[1]; x.DniCelkem != 100 || x.DniTed != 100 || !x.OdZacatku || x.DniNaPrvnim != 40 || x.NejlepsiMisto != 1 || x.Misto != 2 || x.Pobytu != 1 {
		t.Errorf("jednička od začátku: %+v", x)
	}
	if x := v[3]; x.DniCelkem != 90 || x.Obhajob != 2 || x.DniNaPrvnim != 60 || x.OdZacatku || x.Misto != 1 {
		t.Errorf("trojka: %+v", x)
	}
	if x := v[2]; x.Pobytu != 2 || x.DniCelkem != 40 || x.DniTed != 30 || x.DniNejdele != 30 || x.NejlepsiMisto != 2 || x.OdZacatku {
		t.Errorf("dvojka s návratem: %+v", x)
	}
	rekordy := map[string]RekordSlavy{}
	for _, r := range s.Rekordy {
		rekordy[r.Druh] = r
	}
	for druh, chci := range map[string]RekordSlavy{
		"nejdele":  {ModelkaID: 1, Hodnota: 100, OdZacatku: true, Trva: true},
		"vlada":    {ModelkaID: 3, Hodnota: 60, Trva: true},
		"obhajoby": {ModelkaID: 3, Hodnota: 2},
		"rychlost": {ModelkaID: 3, Hodnota: 3},
		"navrat":   {ModelkaID: 2, Hodnota: 60},
	} {
		r := rekordy[druh]
		if r.ModelkaID != chci.ModelkaID || r.Hodnota != chci.Hodnota || r.OdZacatku != chci.OdZacatku || r.Trva != chci.Trva {
			t.Errorf("rekord %s: %+v, chci %+v", druh, r, chci)
		}
	}
	if len(s.Kronika) != len(kronika)-1 || s.Kronika[0].Druh != udalostVstup || s.Kronika[0].ModelkaID != 2 || s.Kronika[len(s.Kronika)-1].Druh != udalostZacatek {
		t.Errorf("kronika: %+v", s.Kronika)
	}
	// Trojka vypadla: legenda
	s = spocitatSinSlavy(append(kronika, z(90, udalostVystup, 3, 12, 1, 15)), modelSlavy([]int{1, 2}, 3), porovnani, existuje, nyni)
	if len(s.Legendy) != 1 || s.Legendy[0].ModelkaID != 3 || s.Legendy[0].DniCelkem != 80 || s.Legendy[0].Do == "" || s.Legendy[0].VTop {
		t.Errorf("legendy: %+v", s.Legendy)
	}
	// Prázdná kronika
	if s := spocitatSinSlavy(nil, modelSlavy(nil), nil, existuje, nyni); s.Od != "" || len(s.Rekordy) != 0 || s.Kronika == nil {
		t.Errorf("prázdná: %+v", s)
	}
}

// Kronika v databázi učení: zápis, čtení, vrácení porovnání smaže události po něm, zapomenutí všechny
func TestKronikaVDatabazi(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"A", "B"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), 4)
	}
	ida, idb := idModelky(t, a, "A"), idModelky(t, a, "B")
	// Výpočet bez porovnání začne kroniku (nikdo potvrzený)
	if s := a.GetSinSlavy(); s.Od == "" || len(s.Kronika) != 1 || s.Kronika[0].Druh != udalostZacatek {
		t.Fatalf("začátek kroniky: %+v", s)
	}
	if !a.PorovnatModelky(ida, idb, "a") {
		t.Fatal("porovnání")
	}
	// Přepočet po porovnání napřed (z paměti se pak už nic nepřipíše)
	a.GetOblibenost()
	u := a.uc
	var posledni int64
	func() {
		u.mu.Lock()
		defer u.mu.Unlock()
		posledni = posledniPorovnani(u.nacistPorovnani())
		u.zapsatUdalostiSlavy(posledni, []udalostUrovne{{modelka: ida, druh: udalostVstup, misto: 1, souperka: idb}, {modelka: ida, druh: udalostJednicka, misto: 1}}, time.Now())
	}()
	s := a.GetSinSlavy()
	if len(s.Kronika) != 3 || s.Kronika[0].Druh != udalostJednicka || s.Kronika[1].Souperka != idb {
		t.Fatalf("po zápisu: %+v", s.Kronika)
	}
	if sl := a.GetSlavaModelky(ida); sl.ModelkaID != ida || sl.Pobytu != 1 || sl.NejlepsiMisto != 1 {
		t.Errorf("sláva modelky: %+v", sl)
	}
	if sl := a.GetSlavaModelky(idb); sl.ModelkaID != 0 {
		t.Errorf("modelka mimo kroniku: %+v", sl)
	}
	if !a.VratitPorovnani() {
		t.Fatal("vrácení")
	}
	if s := a.GetSinSlavy(); len(s.Kronika) != 1 {
		t.Errorf("po vrácení: %+v", s.Kronika)
	}
	if !a.ZapomenoutPorovnani() {
		t.Fatal("zapomenutí")
	}
	func() {
		u.mu.Lock()
		defer u.mu.Unlock()
		if k := u.nacistKroniku(); len(k) != 0 {
			t.Errorf("po zapomenutí: %+v", k)
		}
	}()
}
