package main

import (
	"math/rand"
	"testing"
	"time"
)

// Testovací sbírka: modelky se srdíčky (pořadí podle jména), vrací id podle jména
func sbirkaZajmu(t *testing.T, a *App, srdicka map[string]float64) map[string]int {
	t.Helper()
	ids := map[string]int{}
	for jmeno, h := range srdicka {
		a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1})
		ids[jmeno] = idModelky(t, a, jmeno)
		if h > 0 {
			a.SetHodnoceni(ids[jmeno], h)
		}
	}
	return ids
}

func poradiPodleJmena(a *App) map[string]OblibenostModelky {
	podle := map[string]OblibenostModelky{}
	for _, p := range a.GetOblibenost().Poradi {
		podle[p.Jmeno] = p
	}
	return podle
}

// Zájem (profil a fotky) posune modelku v pořadí uvnitř její úrovně srdíček, ale ne přes vyšší úroveň
func TestZajemPosouvaPoradiUvnitrUrovne(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	ids := sbirkaZajmu(t, a, map[string]float64{"Anna": 4, "Bára": 4, "Cecílie": 4.5, "Dana": 3})
	if !a.ZaznamenatZajem(ids["Bára"], "profil", 0) || !a.ZaznamenatZajem(ids["Bára"], "fotky", 600) {
		t.Fatal("zápis zájmu")
	}
	a.ZaznamenatZajem(ids["Dana"], "profil", 0)
	podle := poradiPodleJmena(a)
	if !(podle["Bára"].Poradi < podle["Anna"].Poradi) {
		t.Fatalf("zájem Báru neposunul nad Annu: %+v", podle)
	}
	if !(podle["Cecílie"].Poradi < podle["Bára"].Poradi) || !(podle["Anna"].Poradi < podle["Dana"].Poradi) {
		t.Fatalf("zájem přebil srdíčka: %+v", podle)
	}
	if podle["Bára"].Zajem <= 0 || podle["Anna"].Zajem != 0 {
		t.Fatalf("posun zájmem: Bára %v, Anna %v", podle["Bára"].Zajem, podle["Anna"].Zajem)
	}
	stav := a.GetOblibenost()
	if stav.VahaZajmu != vychoziVahaZajmu || stav.ZajemNaucen {
		t.Fatalf("bez porovnání má být výchozí váha zájmu: %+v", stav)
	}
	// Seznam modelek nese pořadí
	modelky, _ := a.nactiModelky("", true)
	for _, m := range modelky {
		if m.Poradi != podle[m.Jmeno].Poradi {
			t.Fatalf("pořadí v seznamu modelek %s: %d, v Oblíbenosti %d", m.Jmeno, m.Poradi, podle[m.Jmeno].Poradi)
		}
	}
}

// Otevření profilu téže modelky se zapíše nejvýš jednou za 10 minut; krátké prohlížení a neznámý druh vůbec
func TestZajemPauzaProfilu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	ids := sbirkaZajmu(t, a, map[string]float64{"Anna": 4})
	for range 3 {
		a.ZaznamenatZajem(ids["Anna"], "profil", 0)
	}
	if a.ZaznamenatZajem(ids["Anna"], "fotky", 1) || a.ZaznamenatZajem(ids["Anna"], "jine", 10) || a.ZaznamenatZajem(0, "profil", 0) {
		t.Fatal("zapsal se neplatný zájem")
	}
	a.ZaznamenatZajem(ids["Anna"], "fotky", 99999)
	a.uc.mu.Lock()
	st := a.uc.nacistZajem(time.Now())
	a.uc.mu.Unlock()
	z := st.modelky[ids["Anna"]]
	if z.profil != 1 || z.sekund != maxSekundZaznamu {
		t.Fatalf("zájem: %+v", z)
	}
}

// Váha zájmu se naučí z porovnání: když vyhrává modelka s větším zájmem, váha stoupne nad výchozí, když zájem
// výsledek nepředpovídá, zůstane u výchozí nebo pod ní
func TestNaucitVahuZajmu(t *testing.T) {
	r := rand.New(rand.NewSource(3))
	data := func(predpovida bool) []porovnaniZajmu {
		var d []porovnaniZajmu
		for range 400 {
			zi, zj := 2*r.Float64(), 2*r.Float64()
			y := 0.0
			if r.Float64() < 0.5 || (predpovida && zi > zj && r.Float64() < 0.8) {
				y = 1
			}
			if predpovida && zi < zj && r.Float64() < 0.8 {
				y = 0
			}
			d = append(d, porovnaniZajmu{pi: 4, pj: 4, zi: zi, zj: zj, y: y, t: 1})
		}
		return d
	}
	s := naucitVahuZajmu(data(true))
	if !s.naucena || s.vaha <= vychoziVahaZajmu+0.05 {
		t.Fatalf("zájem předpovídá výsledek, váha %+v", s)
	}
	bez := naucitVahuZajmu(data(false))
	if bez.vaha > vychoziVahaZajmu+0.01 {
		t.Fatalf("zájem nepředpovídá výsledek, váha %+v", bez)
	}
	if malo := naucitVahuZajmu(data(true)[:5]); malo.naucena || malo.vaha != vychoziVahaZajmu {
		t.Fatalf("z pěti porovnání se nemá učit: %+v", malo)
	}
}

// Trend: proti snímku před 30 dny modelka, která tehdy byla poslední, stoupla; dnešní snímek se zapíše a stará
// historie se uklidí (po 60 dnech jen pondělí, po 400 dnech nic)
func TestTrendAHistorie(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	ids := sbirkaZajmu(t, a, map[string]float64{"Anna": 5, "Bára": 4, "Cecílie": 3})
	a.uc.mu.Lock()
	db := a.uc.zajistit()
	nyni := time.Now()
	den := nyni.AddDate(0, 0, -31).Format("2006-01-02")
	// Tehdy: Cecílie první, Anna druhá, Bára třetí
	for jmeno, s := range map[string][2]float64{"Cecílie": {4.9, 1}, "Anna": {4.5, 2}, "Bára": {3.5, 3}} {
		db.Exec("INSERT INTO historie_oblibenosti (den, modelka_id, oblibenost, poradi) VALUES (?, ?, ?, ?)", den, ids[jmeno], s[0], int(s[1]))
	}
	// Stará historie: nepondělní snímek starší 60 dnů a jakýkoli starší 400 dnů zmizí
	stary := nyni.AddDate(0, 0, -90)
	for stary.Weekday() == time.Monday {
		stary = stary.AddDate(0, 0, 1)
	}
	db.Exec("INSERT INTO historie_oblibenosti VALUES (?, ?, 1, 1)", stary.Format("2006-01-02"), ids["Anna"])
	db.Exec("INSERT INTO historie_oblibenosti VALUES (?, ?, 1, 1)", nyni.AddDate(0, 0, -500).Format("2006-01-02"), ids["Anna"])
	// Snímek se zapisuje nejvýš jednou za hodinu: při zakládání sbírky už se jeden zapsal
	a.uc.ob.historieCas = time.Time{}
	a.uc.mu.Unlock()

	podle := poradiPodleJmena(a)
	if podle["Anna"].ZmenaPoradi != 1 || podle["Bára"].ZmenaPoradi != 1 || podle["Cecílie"].ZmenaPoradi != -2 {
		t.Fatalf("změny pořadí: %+v", podle)
	}
	stav := a.GetOblibenost()
	if stav.TrendDni != 31 {
		t.Fatalf("stáří srovnávacího snímku %d", stav.TrendDni)
	}
	modelky, _ := a.nactiModelky("", true)
	for _, m := range modelky {
		if m.Jmeno == "Cecílie" && (m.ZmenaPoradi != -2 || m.TrendDni != 31) {
			t.Fatalf("trend v seznamu modelek: %+v", m)
		}
	}
	a.uc.mu.Lock()
	var dnes, celkem int
	db.QueryRow("SELECT COUNT(*) FROM historie_oblibenosti WHERE den = ?", nyni.Format("2006-01-02")).Scan(&dnes)
	db.QueryRow("SELECT COUNT(*) FROM historie_oblibenosti").Scan(&celkem)
	a.uc.mu.Unlock()
	if dnes != 3 || celkem != 6 {
		t.Fatalf("historie: dnes %d snímků, celkem %d (čekáno 3 a 6)", dnes, celkem)
	}
	// Prahy přehledu: ze tří modelek stačí posun o 3 místa, žádná tolik nestoupla
	p := a.GetPrehledOblibenosti()
	if len(p.Top) != 3 || p.Top[0].Jmeno != "Anna" || len(p.Stoupaji) != 0 || p.TrendDni != 31 {
		t.Fatalf("přehled: %+v", p)
	}
}

// Dlouho neviděné: z oblíbených ty, které jsi 30 dní neotevřel, až se zájem sleduje aspoň 30 dní
func TestDlouhoNevidene(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	ids := sbirkaZajmu(t, a, map[string]float64{"Anna": 5, "Bára": 4.5, "Cecílie": 4})
	if p := a.GetPrehledOblibenosti(); len(p.DlouhoNevidene) != 0 || p.ZajemDni != 0 {
		t.Fatalf("bez sledování zájmu nemá být nic dlouho neviděné: %+v", p)
	}
	a.uc.mu.Lock()
	db := a.uc.zajistit()
	db.Exec("INSERT INTO zajem (cas, modelka_id, druh, sekund) VALUES (?, ?, 'profil', 0)", time.Now().AddDate(0, 0, -45).Format("2006-01-02 15:04:05"), ids["Bára"])
	db.Exec("INSERT INTO zajem (cas, modelka_id, druh, sekund) VALUES (?, ?, 'profil', 0)", time.Now().AddDate(0, 0, -2).Format("2006-01-02 15:04:05"), ids["Anna"])
	a.uc.ob.model = nil
	a.uc.mu.Unlock()
	p := a.GetPrehledOblibenosti()
	if p.ZajemDni != 45 || len(p.DlouhoNevidene) != 2 {
		t.Fatalf("dlouho neviděné: %+v", p)
	}
	// Nikdy neotevřená napřed, pak nejdéle neviděná
	if p.DlouhoNevidene[0].Jmeno != "Cecílie" || p.DlouhoNevidene[0].Dni != -1 || p.DlouhoNevidene[1].Jmeno != "Bára" || p.DlouhoNevidene[1].Dni != 45 {
		t.Fatalf("pořadí dlouho neviděných: %+v", p.DlouhoNevidene)
	}
}

// Zapomenutí oblíbenosti smaže porovnání, zájem i historii
func TestZapomenoutPorovnaniMazeZajem(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	ids := sbirkaZajmu(t, a, map[string]float64{"Anna": 4, "Bára": 4})
	a.ZaznamenatZajem(ids["Anna"], "profil", 0)
	a.PorovnatModelky(ids["Anna"], ids["Bára"], "a")
	a.GetOblibenost()
	if !a.ZapomenoutPorovnani() {
		t.Fatal("zapomenutí")
	}
	a.uc.mu.Lock()
	db := a.uc.zajistit()
	var zajem, historie int
	db.QueryRow("SELECT COUNT(*) FROM zajem").Scan(&zajem)
	db.QueryRow("SELECT COUNT(*) FROM historie_oblibenosti").Scan(&historie)
	a.uc.mu.Unlock()
	if zajem != 0 || historie != 0 {
		t.Fatalf("po zapomenutí: zájem %d, historie %d", zajem, historie)
	}
	if podle := poradiPodleJmena(a); podle["Anna"].Zajem != 0 {
		t.Fatalf("zájem po zapomenutí: %+v", podle["Anna"])
	}
	// Po zapomenutí se profil hned zapíše znovu (pauza se zapomněla taky)
	if !a.ZaznamenatZajem(ids["Anna"], "profil", 0) {
		t.Fatal("zápis po zapomenutí")
	}
}
