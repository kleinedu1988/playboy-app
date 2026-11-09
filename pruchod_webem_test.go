package main

import (
	"sync/atomic"
	"testing"
	"time"
)

func pockatNaPruchod(t *testing.T, a *App) StavPruchoduWebem {
	t.Helper()
	for i := 0; i < 500; i++ {
		if st := a.GetStavPruchoduWebem(); !st.Bezi {
			return st
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("průchod neskončil")
	return StavPruchoduWebem{}
}

// Kritérium: po průchodu jsou rozdíly proti zdrojům ve frontě, nic se nezapsalo bez potvrzení; přerušený
// průchod pokračuje, kde skončil; odmítnuté se znovu nenabízí
func TestPruchodWebem(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna Webová", Tetovani: -1, Piercing: -1, VyskaCm: 170})
	a.AddModelka(Modelka{Jmeno: "Bára Webová", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna Webová"), idModelky(t, a, "Bára Webová")

	var dotazu atomic.Int32
	brzda := make(chan struct{})
	puvodni := hledatUdajeModelky
	t.Cleanup(func() { hledatUdajeModelky = puvodni })
	hledatUdajeModelky = func(a *App, id int) NalezUdaju {
		dotazu.Add(1)
		<-brzda
		m, _ := a.modelkaPodleID(id)
		n := NalezUdaju{ModelkaID: id, Jmeno: m.Jmeno, Zdroje: []ZdrojUdaju{{Klic: zdrojWikidata, Nazev: "Wikidata", URL: "https://www.wikidata.org/wiki/Q1", Stav: "nalezeno"}}}
		n.Pole = []PoleZeZdroju{
			{Klic: "narozeniDatum", Nazev: "Narození", Navrhy: []NavrhUdaje{{Zdroj: zdrojWikidata, Hodnota: "1970-01-0" + string(rune('0'+id%9+1))}}},
			{Klic: "vyskaCm", Nazev: "Výška (cm)", Stavajici: "170", Navrhy: []NavrhUdaje{{Zdroj: zdrojWikidata, Hodnota: "175"}}},
		}
		return n
	}

	if !a.SpustitPruchodWebem(false, false) {
		t.Fatal("start")
	}
	if a.SpustitPruchodWebem(false, false) {
		t.Fatal("druhý souběžný průchod")
	}
	// První modelka hotová, druhá rozpracovaná → přerušit
	brzda <- struct{}{}
	for dotazu.Load() < 2 {
		time.Sleep(5 * time.Millisecond)
	}
	go func() { time.Sleep(20 * time.Millisecond); close(brzda) }()
	a.PrerusitPruchodWebem()
	st := pockatNaPruchod(t, a)
	if st.Hotovo != 1 || st.Zbyva != 1 || st.Celkem != 2 {
		t.Fatalf("po přerušení: %+v", st)
	}
	// Pokračování (i po restartu: stav je v nastaveni)
	a.pruchod = nil
	if !a.SpustitPruchodWebem(false, true) {
		t.Fatal("pokračování")
	}
	st = pockatNaPruchod(t, a)
	if st.Hotovo != 2 || st.Zbyva != 0 || st.Konec == "" || st.Navrhu != 4 {
		t.Fatalf("po dokončení: %+v", st)
	}
	m, _ := a.modelkaPodleID(anna)
	if m.NarozeniDatum != "" || m.VyskaCm != 170 {
		t.Fatal("průchod něco zapsal bez potvrzení")
	}

	navrhy := a.GetNavrhyZWebu()
	var vyskaAnny, datumBary NavrhZWebu
	for _, n := range navrhy {
		if n.ModelkaID == anna && n.Pole == "vyskaCm" {
			vyskaAnny = n
		}
		if n.ModelkaID == bara && n.Pole == "narozeniDatum" {
			datumBary = n
		}
	}
	if vyskaAnny.Stavajici != "170" || vyskaAnny.URL == "" {
		t.Fatalf("návrh výšky: %+v", vyskaAnny)
	}
	// Odmítnutí: zmizí, po dalším průchodu se nevrátí; zrušení ho vrátí
	a.OdmitnoutNavrhyZWebu([]NavrhZWebu{vyskaAnny}, true)
	if len(a.GetNavrhyZWebu()) != 3 {
		t.Fatal("odmítnutý ve frontě")
	}
	// Přijetí: zapíše se hodnota i odkaz na zdroj
	if a.PrijmoutNavrhyZWebu([]NavrhZWebu{datumBary}) != 1 {
		t.Fatal("přijetí")
	}
	m, _ = a.modelkaPodleID(bara)
	if m.NarozeniDatum != datumBary.Hodnota || m.Odkazy != "https://www.wikidata.org/wiki/Q1" {
		t.Fatalf("po přijetí: %q %q", m.NarozeniDatum, m.Odkazy)
	}
	if len(a.GetNavrhyZWebu()) != 2 {
		t.Fatalf("po přijetí zbývá %d", len(a.GetNavrhyZWebu()))
	}
	// Nový průchod jen s chybějícími: Bára má datum, ale chybí jí jiné údaje → obě
	if !a.SpustitPruchodWebem(true, false) {
		t.Fatal("nový průchod")
	}
	pockatNaPruchod(t, a)
	for _, n := range a.GetNavrhyZWebu() {
		if n.ModelkaID == anna && n.Pole == "vyskaCm" {
			t.Fatal("odmítnutý se po průchodu vrátil")
		}
	}
	if a.PocetOdmitnutychZWebu() != 1 || !a.ZrusitOdmitnutiZWebu() || a.PocetOdmitnutychZWebu() != 0 {
		t.Fatal("zrušení odmítnutí")
	}
	// Hromadné přijetí víc modelek dělá zálohu
	pred := len(a.SeznamZaloh())
	if a.PrijmoutNavrhyZWebu(a.GetNavrhyZWebu()) != 2 || len(a.SeznamZaloh()) != pred+1 {
		t.Fatal("hromadné přijetí se zálohou")
	}
	if n := len(a.GetNavrhyZWebu()); n != 0 {
		t.Fatalf("po přijetí všech zbývá %d", n)
	}
}
