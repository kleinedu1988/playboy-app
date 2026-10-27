package main

import (
	"fmt"
	"testing"
	"time"
)

// Fronta rychlého hodnocení: nově přidané napřed, pak užitek (odhad + ½ nejistoty), bez fotek nakonec, nesoulad za
// nehodnocenými
func TestFrontaHodnoceni(t *testing.T) {
	nyni := time.Date(2026, 10, 27, 12, 0, 0, 0, time.Local)
	m := &modelOblibenosti{prumer: 3, pocet: map[int]int{1: 6}, jenOdhad: map[int]bool{}, oblibenost: map[int]float64{1: 4},
		rozptyl: map[int]float64{1: 0.04}, zdrojOdhadu: map[int]int{2: urovenFotky}, predpoklad: map[int]float64{2: 3.8},
		odhad: map[int]float64{}, nesoulad: map[int]NesouladSrdicek{9: {ModelkaID: 9, Hodnoceni: 4, Navrh: 3, vaha: 1}}}
	modelky := []Modelka{
		{ID: 1, PocetFotek: 10, Pridano: "2025-01-01 10:00:00"},               // porovnávaná: 4 ± 0,2 → užitek 4,1
		{ID: 2, PocetFotek: 10, Pridano: "2025-01-01 10:00:00"},               // fotky: 3,8 ± 0,8 → 4,2
		{ID: 3, PocetFotek: 10},                                               // bez odhadu: 3 + ½·1,25
		{ID: 4},                                                               // bez fotek i titulky
		{ID: 5, PocetFotek: 3, Pridano: "2026-10-25 09:00:00"},                // nová
		{ID: 6, PocetFotek: 3, Pridano: "2026-10-20 09:00:00", CoverURL: "x"}, // nová, starší
		{ID: 9, Hodnoceni: 4, PocetFotek: 3},                                  // nesoulad
		{ID: 10, Hodnoceni: 5, PocetFotek: 3},                                 // hodnocená bez nesouladu
	}
	f := m.frontaHodnoceni(modelky, nyni)
	var s string
	for _, p := range f {
		s += fmt.Sprintf("%d:%s ", p.ModelkaID, p.Druh)
	}
	if s != "5:nova 6:nova 2:nehodnocena 1:nehodnocena 3:nehodnocena 4:nehodnocena 9:nesedi " {
		t.Fatalf("fronta: %s", s)
	}
	if p := f[3]; p.Odhad != 4 || p.Nejistota != 0.2 || p.Duvod != "Po 6 porovnáních vychází na 4 srdíčka" {
		t.Errorf("porovnávaná: %+v", p)
	}
	if p := f[2]; p.Odhad != 3.8 || p.Nejistota != nejistotaFotek || p.Duvod == "" {
		t.Errorf("z fotek: %+v", p)
	}
	if p := f[4]; p.Odhad != 0 || p.Duvod != "" {
		t.Errorf("bez odhadu: %+v", p)
	}
	if p := f[6]; p.Hodnoceni != 4 || p.Navrh != 3 || p.Nesoulad == nil {
		t.Errorf("nesoulad: %+v", p)
	}
}

// Model vkusu: srdíčka převzatá z odhadu se do učení nepočítají (dokud je nepotvrdí tři porovnání), nehodnocená se
// třemi porovnáními a jistou silou učí, ale neověřuje se a není mezi podobnými
func TestVkusPrevzateAPorovnani(t *testing.T) {
	s := harnessVkusu(260, 0.6, 3, false)
	nyni := nyniHarness
	zaklad := spocitatOblibenost(s.modelky, nil, nyni)
	if zaklad.vkus == nil || zaklad.vkus.n < minHodnocenychVkus {
		t.Fatalf("harness bez modelu vkusu: %+v", zaklad.vkus)
	}
	var hodnocena, nehodnocena int
	for _, m := range s.modelky {
		if m.Hodnoceni > 0 && hodnocena == 0 {
			hodnocena = m.ID
		}
		if m.Hodnoceni == 0 && nehodnocena == 0 {
			nehodnocena = m.ID
		}
	}
	jePodobna := func(v *modelVkusu, id int) bool {
		for _, h := range v.hodnocene {
			if h.id == id {
				return true
			}
		}
		return false
	}
	// Převzatý odhad: z učení pryč
	h := s.modelky[hodnocena-1].Hodnoceni
	m := spocitatOblibenostUplne(s.modelky, nil, stavZajmu{}, vstupOblibenosti{prevzate: map[int]float64{hodnocena: h}}, nyni)
	if m.vkus.n != zaklad.vkus.n-1 || jePodobna(m.vkus, hodnocena) {
		t.Errorf("převzatý odhad v učení: n %d (bez %d), mezi podobnými %v", m.vkus.n, zaklad.vkus.n, jePodobna(m.vkus, hodnocena))
	}
	// Srdíčka od převzetí změněná: zase v učení
	m = spocitatOblibenostUplne(s.modelky, nil, stavZajmu{}, vstupOblibenosti{prevzate: map[int]float64{hodnocena: h + 0.5}}, nyni)
	if m.vkus.n != zaklad.vkus.n {
		t.Errorf("změněná srdíčka nejsou v učení: n %d", m.vkus.n)
	}
	// Nehodnocená se čtyřmi porovnáními: v učení, ne mezi podobnými, a odhad má dál
	var porovnani []porovnaniZaznam
	for i := range 4 {
		porovnani = append(porovnani, porovnaniZaznam{id: int64(i + 1), a: nehodnocena, b: hodnocena, vysledek: "remiza", cas: nyni})
	}
	sPorovnanim := spocitatOblibenost(s.modelky, porovnani, nyni)
	if sPorovnanim.vkus.n != zaklad.vkus.n+1 || jePodobna(sPorovnanim.vkus, nehodnocena) {
		t.Errorf("porovnávaná nehodnocená: n %d (bez %d), mezi podobnými %v", sPorovnanim.vkus.n, zaklad.vkus.n, jePodobna(sPorovnanim.vkus, nehodnocena))
	}
	if _, ok := sPorovnanim.vkus.surove[nehodnocena]; !ok {
		t.Error("porovnávaná nehodnocená bez odhadu vkusu")
	}
}

// Převzatý odhad se zapíše do databáze učení a výpočet ho načte
func TestSetHodnoceniOdhadem(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "A", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "A")
	if !a.SetHodnoceniOdhadem(id, 3.5) || modelkaPodleJmena(t, a, "A").Hodnoceni != 3.5 {
		t.Fatal("uložení odhadem")
	}
	if a.SetHodnoceniOdhadem(id, 3.3) {
		t.Error("neplatná srdíčka prošla")
	}
	a.uc.mu.Lock()
	p := a.uc.nacistPrevzate()
	a.uc.mu.Unlock()
	if p[id] != 3.5 || len(p) != 1 {
		t.Errorf("převzaté: %v", p)
	}
	if f := a.GetFrontaHodnoceni(); len(f) != 0 {
		t.Errorf("fronta bez nehodnocených: %+v", f)
	}
}
