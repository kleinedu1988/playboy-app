package main

import (
	"testing"
	"time"
)

func TestDoporucenaDelka(t *testing.T) {
	for _, c := range []struct {
		soutezicich, fotek int
		tempo              float64
		dni                int
		zkraceno           bool
	}{
		{14, 0, 3, 14, false},     // 42 soubojů / 3 = 14 dní
		{14, 0, 5, 10, false},     // 42 / 5 = 8,4 → 10
		{8, 0, 20, 7, false},      // rychlé tempo: nejkratší
		{100, 0, 3, 30, false},    // hodně modelek: nejdelší
		{100, 500, 3, 14, true},   // 5 fotek na modelku: nejvýš 14
		{100, 1500, 3, 21, true},  // 15 fotek na modelku: nejvýš 21
		{100, 5000, 3, 30, false}, // dost fotek
	} {
		dni, souboju, duvod := doporucenaDelka(c.soutezicich, c.fotek, c.tempo)
		if dni != c.dni || souboju != c.soutezicich*soubojuNaSoutezici || (duvod != "") != c.zkraceno {
			t.Errorf("%+v: %d dní, %d soubojů, %q", c, dni, souboju, duvod)
		}
	}
}

func TestTempoSouboju(t *testing.T) {
	nyni := den(2026, 11, 30)
	if x := tempoSoubojuZa30(nil, nyni); x != tempoBezHistorie {
		t.Errorf("bez historie %v", x)
	}
	var p []porovnaniZaznam
	for i := 0; i < 90; i++ {
		p = append(p, porovnaniZaznam{cas: nyni.AddDate(0, 0, -60).Add(time.Duration(i) * 16 * time.Hour)})
	}
	// 90 soubojů po 16 hodinách od -60 dní: v posledních 30 dnech jich je 45 → 1,5 za den
	if x := tempoSoubojuZa30(p, nyni); x != 1.5 {
		t.Errorf("tempo %v", x)
	}
	// Mladší historie: dělí se jen dny od prvního porovnání
	if x := tempoSoubojuZa30([]porovnaniZaznam{{cas: nyni.AddDate(0, 0, -2)}, {cas: nyni.AddDate(0, 0, -1)}}, nyni); x != 1 {
		t.Errorf("krátká historie %v", x)
	}
}

// Návrhy: jen platná témata, bez tématu minulé sezóny, při každém otevření stejné
func TestNavrhSezony(t *testing.T) {
	puvodniFotek, puvodniModelek := minFotekTematu, minModelekTematu
	minFotekTematu, minModelekTematu = 1, 2
	defer func() { minFotekTematu, minModelekTematu = puvodniFotek, puvodniModelek }()

	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Anna", "Bára", "Cecílie"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		id := idModelky(t, a, j)
		a.SetHodnoceni(id, 4)
		a.AddBulkPhotos(id, "Album", "Pictorial", odkazA+" "+odkazB)
		f := a.GetFotografieModelky(id)
		a.SetTagyFotek([]int{f[0].ID}, []string{"podpatky", "loznice"}, nil)
		a.SetTagyFotek([]int{f[1].ID}, []string{"prsa", "akt", "plaz"}, nil)
	}
	n := a.GetNavrhSezony()
	if n.Klic == "" || n.Den < 1 || n.Tempo != tempoBezHistorie || n.Klasicka.Klic != "" || n.Klasicka.Dni == 0 {
		t.Fatalf("návrh: %+v", n)
	}
	if len(n.Navrhy) == 0 || len(n.Navrhy) > navrhuTemat || len(n.Vsechna) != len(katalogTemat) {
		t.Fatalf("návrhů %d, všech %d", len(n.Navrhy), len(n.Vsechna))
	}
	videne := map[string]bool{}
	for _, x := range n.Navrhy {
		if !x.Plati || videne[x.Klic] || x.Dni == 0 {
			t.Errorf("návrh %+v", x)
		}
		videne[x.Klic] = true
	}
	for _, x := range n.Vsechna {
		if !x.Plati && x.Duvod == "" {
			t.Errorf("neplatné téma bez důvodu: %+v", x)
		}
	}
	if znovu := a.GetNavrhSezony(); znovu.Navrhy[0].Klic != n.Navrhy[0].Klic {
		t.Error("návrhy se při dalším otevření změnily")
	}
	if a.GetSezona().Zvoleno || !a.SetObdobiSezony(n.Klic, n.Navrhy[0].Klic, 0) || !a.GetSezona().Zvoleno {
		t.Error("příznak zvolené sezóny")
	}
}
