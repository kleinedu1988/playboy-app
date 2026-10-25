package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync"
	"testing"
)

// Nálezy revize Údržby a učení (docs/REVIZE-UDRZBA-UCENI.md)

// Přehled volá GetPrehled, GetNavrhyDoplneni a GetStavUceni souběžně a rozhraní mezitím může odmítat, opravovat
// i zapomínat; nic z toho nesmí závodit (go test -race) a oprava nálezu se zapíše jen jednou
func TestSoubeznePrehledAUceni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for i := range 6 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("Míry %d", i), Miry: "90-60-90", Tetovani: -1, Piercing: -1})
	}
	a.AddModelka(Modelka{Jmeno: "Vysoká", VyskaCm: 250, Tetovani: -1, Piercing: -1})
	a.GetPrehled(false)
	m := modelkaPodleJmena(t, a, "Vysoká")
	m.VyskaCm = 170
	a.UpdateModelka(m)

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(3)
		go func() { defer wg.Done(); a.GetPrehled(false) }()
		go func() { defer wg.Done(); a.GetNavrhyDoplneni(true) }()
		go func() { defer wg.Done(); a.GetStavUceni() }()
	}
	wg.Wait()
	opravy := 0
	for _, u := range udalostiUceni(t, a) {
		if strings.HasPrefix(u, udalostNalezOpraveny+" ") {
			opravy++
		}
	}
	if opravy != 1 {
		t.Errorf("oprava nálezu zapsaná %d×, čekám jednou", opravy)
	}

	navrhy := a.GetNavrhyDoplneni(false)
	for i, n := range navrhy {
		wg.Add(2)
		go func() { defer wg.Done(); a.OdmitnoutNavrh(n, true) }()
		go func() {
			defer wg.Done()
			if i%5 == 0 {
				a.ZapomenoutUceni()
			}
			a.ZaznamenatOpravu(n.ModelkaID, n.Pole, n.Hodnota, n.Hodnota)
			a.GetPrehled(true)
		}()
	}
	wg.Wait()
	a.GetStavUceni()
}

// Obnovení sbírky ze zálohy vrátí údaje; nález, který tím zmizí, není oprava od uživatele
func TestObnoveniZalohyNeniOpravaNalezu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Vysoká", VyskaCm: 170, Tetovani: -1, Piercing: -1})
	if err := a.zalohovat("test"); err != nil {
		t.Fatal(err)
	}
	m := modelkaPodleJmena(t, a, "Vysoká")
	m.VyskaCm = 250
	a.UpdateModelka(m)
	if _, ok := nalezyKontroly(a, false)["Vysoká: ok-vyska"]; !ok {
		t.Fatal("nález výšky chybí")
	}
	var soubor string
	for _, z := range a.SeznamZaloh() {
		if z.Duvod == "test" {
			soubor = z.Soubor
		}
	}
	if chyba := a.ObnovitZalohu(soubor); chyba != "" {
		t.Fatal(chyba)
	}
	if _, ok := nalezyKontroly(a, false)["Vysoká: ok-vyska"]; ok {
		t.Fatal("po obnovení se nález pořád hlásí")
	}
	if u := udalostiUceni(t, a); len(u) != 0 {
		t.Errorf("obnovení ze zálohy se zapsalo jako oprava: %v", u)
	}
	// Další oprava po obnovení se už zase pozná
	m = modelkaPodleJmena(t, a, "Vysoká")
	m.VyskaCm = 250
	a.UpdateModelka(m)
	a.GetPrehled(false)
	m.VyskaCm = 171
	a.UpdateModelka(m)
	a.GetPrehled(false)
	if u := strings.Join(udalostiUceni(t, a), ","); u != "nalez-opraveny ok-vyska vyska" {
		t.Errorf("oprava po obnovení: %s", u)
	}
}

// Otisk pro poznání opravy nálezu nezávisí na srdíčkách, titulní fotce, tazích ani poznámce
func TestOtiskUdajuKontroly(t *testing.T) {
	m := Modelka{ID: 1, Jmeno: "Anna", VyskaCm: 170}
	otisk := otiskUdajuKontroly(m)
	jine := m
	jine.Hodnoceni, jine.CoverID, jine.Tags, jine.Poznamka = 5, "abc", "x", "poznámka"
	if otiskUdajuKontroly(jine) != otisk {
		t.Error("srdíčka nebo titulní fotka změnily otisk údajů kontroly")
	}
	jine.VyskaCm = 171
	if otiskUdajuKontroly(jine) == otisk || !strings.HasPrefix(otisk, predponaOtiskuKontroly) {
		t.Error("změna výšky otisk nezměnila")
	}
}

// Jistota, kterou pošle rozhraní, se do deníku dostane jen v mezích 0–1; nekonečno by GetStavUceni rozbilo
// převod na JSON (Wails by Přehledu nevrátil nic)
func TestJistotaZRozhraniVMezich(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	n := NavrhDoplneni{ModelkaID: idModelky(t, a, "Anna"), Pole: "narodnost", Klic: klicNavrhu("narodnost"), Hodnota: "USA",
		Zdroj: "misto", Jistota: math.Inf(1)}
	if !a.OdmitnoutNavrh(n, true) {
		t.Fatal("odmítnutí selhalo")
	}
	stav := a.GetStavUceni()
	if _, err := json.Marshal(stav); err != nil {
		t.Fatalf("stav učení nejde převést na JSON: %v", err)
	}
	for _, z := range stav.Zdroje {
		if math.IsNaN(z.Presnost) || math.IsInf(z.Presnost, 0) || z.Presnost < 0 || z.Presnost > 1 {
			t.Errorf("přesnost zdroje %s: %v", z.Zdroj, z.Presnost)
		}
	}
}
