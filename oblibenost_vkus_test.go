package main

import (
	"fmt"
	"math"
	"math/rand"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------------------------------------
// Vyhodnocení modelu vkusu na umělých sbírkách (go test -run TestVyhodnoceniVkusu -v; v rychlém běhu -short se
// přeskočí). Sbírka má realistická rozložení údajů a hodně prázdných polí, simulovaný uživatel hodnotí podle
// skutečných údajů (i těch, které ve sbírce chybí) nelineárně (éra × vlasy, rozmezí výšky, oblíbení fotografové…)
// se šumem a vlastní nevysvětlitelnou složkou, často dává jedno srdíčko a srdíčka fotek souvisí s vkusem.
// Každá modelka má „pravdivé“ hodnocení (to, které by jí uživatel dal); model se učí jen z hodnocených
// a vyhodnocuje se na nehodnocených, které nikdy neviděl (čisté ověření mimo trénovací data).

// Okamžik vyhodnocení (stáří porovnání)
var nyniHarness = time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)

// Umělá sbírka s pravdou
type sbirkaHarness struct {
	modelky   []Modelka
	pravda    map[int]float64 // hodnocení, které by modelce dal uživatel (po polovinách)
	vysvetl   map[int]float64 // vkus ze skutečných údajů bez vlastní složky (strop toho, co jde z údajů vyčíst)
	porovnani []porovnaniZaznam
}

var (
	jmenaFotografuHarness = []string{"Pompeo Posar", "Mario Casilli", "Arny Freytag", "Stephen Wayda", "Richard Fegley", "Ken Marcus",
		"Dwight Hooker", "Bunny Yeager", "Russ Meyer", "Ron Vogel", "David Mecey", "Phillip Dixon", "Craig Ellis", "Byron Newman",
		"Holly Randall", "Michael Bernard", "Sasha Eisenman", "Josh Ryan", "Jarmo Pohjaniemi", "Tony Kelly", "James Imbrogno",
		"Mike Vellemure", "Ellen von Unwerth", "Tom Kelley", "Ed DeLong", "Hal Adams", "Chris Elliott", "Ana Dias", "Cameron Hammond",
		"Riker Brothers", "Gavin Bond", "Derek Kettela", "Rick Schell", "Kevin Ryan", "Mark Ashley", "Ralph Martin", "Peter Gowland",
		"Earl Leaf", "Larry Gordon", "Frank Eck"}
	narodnostiHarness = []struct {
		z string
		p float64
	}{{"USA", 0.70}, {"Kanada", 0.07}, {"Německo", 0.04}, {"Velká Británie", 0.04}, {"Austrálie", 0.03}, {"Švédsko", 0.02},
		{"Česko", 0.02}, {"Francie", 0.02}, {"Brazílie", 0.015}, {"Mexiko", 0.015}, {"Japonsko", 0.01}, {"Rusko", 0.01},
		{"Itálie", 0.01}, {"Dánsko", 0.01}, {"Norsko", 0.01}, {"Kolumbie", 0.01}, {"Nizozemsko", 0.01}}
)

func vybratVazene[T any](r *rand.Rand, polozky []T, vaha func(T) float64) T {
	soucet := 0.0
	for _, p := range polozky {
		soucet += vaha(p)
	}
	x := r.Float64() * soucet
	for _, p := range polozky {
		if x -= vaha(p); x < 0 {
			return p
		}
	}
	return polozky[len(polozky)-1]
}

type volba struct {
	s string
	p float64
}

func vybrat(r *rand.Rand, v ...volba) string {
	return vybratVazene(r, v, func(x volba) float64 { return x.p }).s
}

// n modelek, z nich podíl hodnocených; nahodnyVkus = hodnocení na údajích nezávisí (kontrola, že model mlčí)
// Vkus závisí i na věku při prvním vydání a poměru hrudník/pas (scénář „i věk a proporce“); jinak sbírka i vkus
// beze změny, datum narození se losuje z vlastního generátoru, aby se ostatní údaje nezměnily
var harnessVekProporce = false

func harnessVkusu(n int, podilHodnocenych float64, seed int64, nahodnyVkus bool) sbirkaHarness {
	r := rand.New(rand.NewSource(seed))
	r2 := rand.New(rand.NewSource(seed*7919 + 1))
	s := sbirkaHarness{pravda: map[int]float64{}, vysvetl: map[int]float64{}}
	chut := map[int]float64{}
	// Uživatel: dva oblíbení fotografové a jeden neoblíbený (z aktivních v různých dobách)
	oblibeni := map[int]float64{2: 0.5, 13: 0.5, 9: -0.6}
	nyni := nyniHarness
	for i := range n {
		m := Modelka{ID: i + 1, Jmeno: fmt.Sprintf("Modelka %04d", i+1), Tetovani: -1, Piercing: -1}
		// Skutečné údaje (uživatel je vidí na fotkách, i když ve sbírce chybí)
		dekada := vybratVazene(r, []int{1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020}, func(d int) float64 {
			return map[int]float64{1950: 4, 1960: 12, 1970: 15, 1980: 15, 1990: 15, 2000: 18, 2010: 15, 2020: 6}[d]
		})
		rok := dekada + r.Intn(10)
		if rok > 2025 {
			rok = 2025
		}
		vlasy := vybrat(r, volba{"blond", 0.38}, volba{"hnědá", 0.35}, volba{"černá", 0.15}, volba{"zrzavá", 0.07}, volba{"světle hnědá", 0.05})
		oci := vybrat(r, volba{"modrá", 0.35}, volba{"hnědá", 0.4}, volba{"zelená", 0.15}, volba{"oříšková", 0.1})
		etnicita := vybrat(r, volba{"kavkazská", 0.8}, volba{"latinskoamerická", 0.07}, volba{"afroamerická", 0.06}, volba{"asijská", 0.04}, volba{"smíšená", 0.03})
		narodnost := vybratVazene(r, narodnostiHarness, func(x struct {
			z string
			p float64
		}) float64 {
			return x.p
		}).z
		vyska := int(math.Round(168 + 6*r.NormFloat64()))
		vaha := int(math.Round(52 + 0.5*float64(vyska-168) + 4*r.NormFloat64()))
		hrudnik := int(math.Round(88 + 5*r.NormFloat64()))
		pas := int(math.Round(60 + 3*r.NormFloat64()))
		boky := int(math.Round(88 + 4*r.NormFloat64()))
		silikon := r.Float64() < map[bool]float64{true: 0.45, false: 0.12}[rok >= 1990 && rok < 2012]
		tetovani := r.Float64() < map[bool]float64{true: 0.45, false: 0.08}[rok >= 2000]
		piercing := r.Float64() < map[bool]float64{true: 0.3, false: 0.05}[rok >= 2000]
		centerfold := r.Float64() < 0.45
		// Fotografové: z aktivních v její době (fotograf k je aktivní od 1950 + 2k let 25 let), oblíbenější častěji
		var fotografove []int
		if r.Float64() < 0.7 {
			pocet := 1 + r.Intn(3)
			for range pocet * 4 {
				if len(fotografove) == pocet {
					break
				}
				k := int(math.Abs(r.NormFloat64()*6)) + max(0, (rok-1950)/2-12)
				if k >= len(jmenaFotografuHarness) || rok < 1950+2*k-3 || rok > 1950+2*k+25 {
					continue
				}
				nove := true
				for _, f := range fotografove {
					nove = nove && f != k
				}
				if nove {
					fotografove = append(fotografove, k)
				}
			}
		}
		vek := 18 + int(math.Abs(r2.NormFloat64())*4)
		maNarozeni := r2.Float64() < 0.6
		// Vkus uživatele: nelineární, s interakcemi a vlastní složkou
		t := 2.7
		if harnessVekProporce {
			switch {
			case vek <= 20:
				t += 0.35
			case vek >= 26:
				t -= 0.35
			}
			if float64(hrudnik)/float64(pas) >= 1.5 {
				t += 0.35
			}
		}
		switch {
		case vlasy == "blond" && rok < 1990:
			t += 0.9
		case vlasy == "blond":
			t += 0.1
		case vlasy == "černá" && rok >= 2000:
			t += 0.6
		case vlasy == "černá":
			t -= 0.4
		case vlasy == "zrzavá":
			t += 0.3
		}
		switch {
		case vyska >= 165 && vyska <= 173:
			t += 0.4
		case vyska > 178:
			t -= 0.5
		}
		nejlepsiF, nejhorsiF := 0.0, 0.0
		for _, f := range fotografove {
			nejlepsiF, nejhorsiF = max(nejlepsiF, oblibeni[f]), min(nejhorsiF, oblibeni[f])
		}
		t += nejlepsiF + nejhorsiF
		if silikon {
			t -= 0.4
		}
		if tetovani {
			t -= 0.3
		}
		if float64(pas)/float64(boky) < 0.67 {
			t += 0.3
		}
		if narodnost == "Česko" || narodnost == "Švédsko" || narodnost == "Norsko" || narodnost == "Dánsko" {
			t += 0.4
		}
		if centerfold {
			t += 0.2
		}
		if dekada == 1990 {
			t += 0.2
		}
		if dekada == 1950 {
			t -= 0.5
		}
		s.vysvetl[m.ID] = t
		t += 0.55 * r.NormFloat64()
		if nahodnyVkus {
			t = 2.7 + 1.1*r.NormFloat64()
			s.vysvetl[m.ID] = 2.7
		}
		chut[m.ID] = t
		// Hodnocení: šum, jedno srdíček pro „nic pro mě“, většinou celá srdíčka
		h := t + 0.25*r.NormFloat64()
		switch {
		case h < 2 && r.Float64() < 0.85:
			h = 1
		case r.Float64() < 0.7:
			h = math.Round(h)
		default:
			h = zaokrouhlitNaPul(h)
		}
		s.pravda[m.ID] = min(max(h, 0.5), 5)

		// Co je ve sbírce vyplněné (hodně prázdných polí)
		if r.Float64() < 0.92 {
			m.Vydani = []string{fmt.Sprintf("%d-%02d", rok, 1+r.Intn(12))}
			if centerfold {
				m.Centerfoldy = m.Vydani
			}
			if r.Float64() < 0.12 {
				m.Obalky = m.Vydani
			}
		}
		if rok >= 2000 && r.Float64() < 0.3 {
			m.OnlineAlba = []string{fmt.Sprintf("%d-%02d-15", min(rok+1, 2025), 1+r.Intn(12))}
			if r.Float64() < 0.4 {
				m.CyberGirl = vybrat(r, volba{"týdne", 0.7}, volba{"měsíce", 0.3})
			}
		}
		var role []string
		if centerfold && r.Float64() < 0.08 {
			role = append(role, fmt.Sprintf("Playmate roku %d", rok+1))
		}
		if r.Float64() < 0.06 {
			role = append(role, "Jen ve speciálu")
		}
		if r.Float64() < 0.03 {
			role = append(role, "Celebrita")
		}
		m.Role = strings.Join(role, ", ")
		if r.Float64() < 0.85 {
			m.VlasyBarva = vlasy
			if vlasy == "blond" && r.Float64() < 0.2 {
				m.VlasyBarva = "Blond"
			}
		}
		if r.Float64() < 0.55 {
			m.OciBarva = oci
		}
		if maNarozeni {
			m.NarozeniDatum = fmt.Sprintf("%d-%02d-%02d", rok-vek, 1+r2.Intn(12), 1+r2.Intn(28))
		}
		if r.Float64() < 0.7 {
			m.Etnicita = etnicita
		}
		if r.Float64() < 0.8 {
			m.Narodnost = narodnost
		}
		if r.Float64() < 0.7 {
			m.VyskaCm = vyska
		}
		if r.Float64() < 0.55 {
			m.VahaKg = vaha
		}
		if r.Float64() < 0.5 {
			m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm = hrudnik, pas, boky
		}
		if r.Float64() < 0.4 {
			m.VelikostPrsou = fmt.Sprintf("%d%s", 32+2*r.Intn(3), vybrat(r, volba{"B", 0.3}, volba{"C", 0.35}, volba{"D", 0.2}, volba{"DD", 0.1}, volba{"A", 0.05}))
		}
		if r.Float64() < 0.4 {
			m.PrsaTyp = map[bool]string{true: "silikonová", false: "přírodní"}[silikon]
		}
		if r.Float64() < 0.15 {
			m.Ochlupeni = vybrat(r, volba{"oholená", 0.5}, volba{"upravené", 0.3}, volba{"přírodní", 0.2})
		}
		if r.Float64() < 0.3 {
			m.Tetovani = map[bool]int{true: 1, false: 0}[tetovani]
		}
		if r.Float64() < 0.25 {
			m.Piercing = map[bool]int{true: 1, false: 0}[piercing]
		}
		for _, f := range fotografove {
			m.fotografoveAlb += jmenaFotografuHarness[f] + "\n"
		}
		s.modelky = append(s.modelky, m)
	}
	// Kdo je hodnocená (modelky s fotkami o něco častěji) a srdíčka fotek (souvisí s vkusem i s vlastní složkou)
	for i := range s.modelky {
		m := &s.modelky[i]
		hodnocena := r.Float64() < podilHodnocenych*map[bool]float64{true: 1.2, false: 0.8}[m.fotografoveAlb != ""]
		if hodnocena {
			m.Hodnoceni = s.pravda[m.ID]
		}
		if m.fotografoveAlb == "" || r.Float64() >= map[bool]float64{true: 0.5, false: 0.12}[hodnocena] {
			continue
		}
		urovenFotek := 3.2 + 0.6*(chut[m.ID]-2.9) + 0.35*r.NormFloat64()
		if nahodnyVkus {
			urovenFotek = 3.2 + 0.7*r.NormFloat64()
		}
		for range strings.Count(m.fotografoveAlb, "\n") {
			var c srdickaAlba
			album := urovenFotek + 0.4*r.NormFloat64()
			for range 6 + r.Intn(30) {
				h := int(math.Round(min(max(album+0.9*r.NormFloat64(), 1), 5)))
				c[h-1]++
				m.fotekHodnocenych++
				m.srdciFotek += h
			}
			m.srdickaAlb = append(m.srdickaAlb, c)
		}
	}
	// Porovnání dvojic hodnocených modelek stejné nebo sousední úrovně (polovina počtu hodnocených)
	var hodnocene []int
	for i, m := range s.modelky {
		if m.Hodnoceni > 0 {
			hodnocene = append(hodnocene, i)
		}
	}
	for k := 0; k < len(hodnocene)/2 && len(hodnocene) > 1; {
		a, b := s.modelky[hodnocene[r.Intn(len(hodnocene))]], s.modelky[hodnocene[r.Intn(len(hodnocene))]]
		if a.ID == b.ID || math.Abs(a.Hodnoceni-b.Hodnoceni) > 0.5 {
			continue
		}
		k++
		vysledek := "b"
		switch p := 1 / (1 + math.Exp(-2*(chut[a.ID]-chut[b.ID]))); {
		case r.Float64() < 0.1:
			vysledek = "remiza"
		case r.Float64() < p:
			vysledek = "a"
		}
		s.porovnani = append(s.porovnani, porovnaniZaznam{id: int64(k), cas: nyni.AddDate(0, 0, -r.Intn(400)), a: a.ID, b: b.ID,
			vysledek: vysledek, ha: a.Hodnoceni, hb: b.Hodnoceni})
	}
	return s
}

// Metriky jednoho běhu (na nehodnocených modelkách s pravdou)
type metrikyVkusu struct {
	hodnocenych, nehodnocenych int
	platny                     bool
	// Všechny nehodnocené bez ohledu na ověření: chyba odhadu zaokrouhleného na poloviny, chyba průměru, Spearman
	maeVse, rmseVse, maePrumer, rho float64
	rhoStrop                        float64 // Spearman vkusu ze skutečných údajů (bez vlastní složky) s pravdou
	p10Vse                          float64 // podíl modelek s pravdou ≥ 4 mezi deseti nejvyššími odhady
	// Ukázané odhady (ověření a pokrytí)
	pokryti, maeUkazane, rmseUkazane, presnostUkazane float64
	// Co model o sobě tvrdí (křížové ověření na hodnocených)
	chybaCV, presnostCV float64
	// „Mohlo by se ti líbit“: počet tipů, přesnost deseti prvních (pravda ≥ 4), tvrzená a skutečná přesnost
	// (pravda aspoň na prahu vysokých) všech tipů
	tipu                               int
	p10Tipy, tvrzenaTipy, skutecnaTipy float64
	cas                                time.Duration
}

func vyhodnotitVkus(s sbirkaHarness) metrikyVkusu {
	var mt metrikyVkusu
	zacatek := time.Now()
	model := spocitatOblibenost(s.modelky, s.porovnani, nyniHarness)
	mt.cas = time.Since(zacatek)
	v := model.vkus
	prumer := 0.0
	for _, m := range s.modelky {
		if m.Hodnoceni > 0 {
			mt.hodnocenych++
			prumer += m.Hodnoceni
		}
	}
	prumer /= float64(max(1, mt.hodnocenych))
	mt.platny = v != nil && v.platny
	if v != nil {
		mt.chybaCV, mt.presnostCV = v.chybaCV, v.presnost
	}
	type par struct{ odhad, pravda float64 }
	var vse, ukazane, strop []par
	for _, m := range s.modelky {
		if m.Hodnoceni > 0 {
			continue
		}
		mt.nehodnocenych++
		p := s.pravda[m.ID]
		mt.maePrumer += math.Abs(zaokrouhlitNaPul(prumer) - p)
		strop = append(strop, par{s.vysvetl[m.ID], p})
		if v != nil && v.surove != nil {
			vse = append(vse, par{v.surove[m.ID], p})
		}
		if o, ok := model.odhad[m.ID]; ok && mt.platny {
			ukazane = append(ukazane, par{o, p})
		}
	}
	mt.maePrumer /= float64(max(1, mt.nehodnocenych))
	sx, sy := make([]float64, len(strop)), make([]float64, len(strop))
	for i, p := range strop {
		sx[i], sy[i] = p.odhad, p.pravda
	}
	mt.rhoStrop = spearman(sx, sy)
	chyby := func(pary []par) (mae, rmse, presnost float64) {
		for _, x := range pary {
			d := math.Abs(zaokrouhlitNaPul(x.odhad) - x.pravda)
			mae += d
			rmse += d * d
			if d <= 0.5 {
				presnost++
			}
		}
		n := float64(max(1, len(pary)))
		return mae / n, math.Sqrt(rmse / n), presnost / n
	}
	if len(vse) > 0 {
		mt.maeVse, mt.rmseVse, _ = chyby(vse)
		x, y := make([]float64, len(vse)), make([]float64, len(vse))
		for i, p := range vse {
			x[i], y[i] = p.odhad, p.pravda
		}
		mt.rho = spearman(x, y)
		sort.SliceStable(vse, func(i, j int) bool { return vse[i].odhad > vse[j].odhad })
		for _, p := range vse[:min(10, len(vse))] {
			if p.pravda >= 4 {
				mt.p10Vse += 0.1
			}
		}
	}
	mt.pokryti = float64(len(ukazane)) / float64(max(1, mt.nehodnocenych))
	mt.maeUkazane, mt.rmseUkazane, mt.presnostUkazane = chyby(ukazane)
	tipy := vybratTipy(s.modelky, model)
	mt.tipu = len(tipy)
	if len(tipy) > 0 {
		for i, t := range tipy {
			if i < 10 && s.pravda[t.m.ID] >= 4 {
				mt.p10Tipy++
			}
			if s.pravda[t.m.ID] >= v.prahVysokych {
				mt.skutecnaTipy++
			}
		}
		mt.p10Tipy /= float64(min(10, len(tipy)))
		mt.skutecnaTipy /= float64(len(tipy))
		if v.vysokych > 0 {
			mt.tvrzenaTipy = float64(v.trefVysokych) / float64(v.vysokych)
		}
	}
	return mt
}

// Průměr metrik přes semínka (přesnost tipů jen z běhů s tipy)
func prumerMetrik(behy []metrikyVkusu) (p metrikyVkusu, platnych, sTipy int) {
	for _, m := range behy {
		p.hodnocenych += m.hodnocenych
		p.nehodnocenych += m.nehodnocenych
		p.maeVse += m.maeVse
		p.rmseVse += m.rmseVse
		p.maePrumer += m.maePrumer
		p.rho += m.rho
		p.rhoStrop += m.rhoStrop
		p.p10Vse += m.p10Vse
		p.pokryti += m.pokryti
		p.chybaCV += m.chybaCV
		p.presnostCV += m.presnostCV
		p.cas += m.cas
		p.tipu += m.tipu
		if m.platny {
			platnych++
			p.maeUkazane += m.maeUkazane
			p.rmseUkazane += m.rmseUkazane
			p.presnostUkazane += m.presnostUkazane
		}
		if m.tipu > 0 {
			sTipy++
			p.p10Tipy += m.p10Tipy
			p.tvrzenaTipy += m.tvrzenaTipy
			p.skutecnaTipy += m.skutecnaTipy
		}
	}
	n := float64(len(behy))
	p.hodnocenych, p.nehodnocenych, p.tipu = p.hodnocenych/len(behy), p.nehodnocenych/len(behy), p.tipu/len(behy)
	p.maeVse, p.rmseVse, p.maePrumer, p.rho, p.p10Vse, p.pokryti = p.maeVse/n, p.rmseVse/n, p.maePrumer/n, p.rho/n, p.p10Vse/n, p.pokryti/n
	p.rhoStrop /= n
	p.chybaCV, p.presnostCV, p.cas = p.chybaCV/n, p.presnostCV/n, p.cas/time.Duration(len(behy))
	if platnych > 0 {
		k := float64(platnych)
		p.maeUkazane, p.rmseUkazane, p.presnostUkazane = p.maeUkazane/k, p.rmseUkazane/k, p.presnostUkazane/k
	}
	if sTipy > 0 {
		k := float64(sTipy)
		p.p10Tipy, p.tvrzenaTipy, p.skutecnaTipy = p.p10Tipy/k, p.tvrzenaTipy/k, p.skutecnaTipy/k
	}
	return p, platnych, sTipy
}

type scenarHarness struct {
	nazev       string
	n           int
	podil       float64
	semen       int
	nahodnyVkus bool
}

var scenareHarness = []scenarHarness{
	{"400 modelek, ~50 % hodnocených", 400, 0.5, 6, false},
	{"400 modelek, ~15 % hodnocených", 400, 0.15, 6, false},
	{"3000 modelek, ~30 % hodnocených", 3000, 0.3, 3, false},
	{"400 modelek, náhodný vkus", 400, 0.5, 6, true},
}

func TestVyhodnoceniVkusu(t *testing.T) {
	if testing.Short() {
		t.Skip("vyhodnocení modelu vkusu se v rychlém běhu nespouští")
	}
	for _, sc := range scenareHarness {
		var behy []metrikyVkusu
		for semeno := range sc.semen {
			behy = append(behy, vyhodnotitVkus(harnessVkusu(sc.n, sc.podil, int64(1000+semeno), sc.nahodnyVkus)))
		}
		p, platnych, sTipy := prumerMetrik(behy)
		t.Logf("%s (%d hodnocených, %d nehodnocených, %d semínek):", sc.nazev, p.hodnocenych, p.nehodnocenych, sc.semen)
		t.Logf("  vše: MAE %.3f (průměr %.3f), RMSE %.3f, ρ %.3f (strop z úplných údajů %.3f), P@10 %.2f", p.maeVse, p.maePrumer, p.rmseVse, p.rho, p.rhoStrop, p.p10Vse)
		t.Logf("  platný %d/%d, pokrytí %.3f, ukázané MAE %.3f RMSE %.3f přesnost %.3f (CV tvrdí MAE %.3f, přesnost %.3f)",
			platnych, sc.semen, p.pokryti, p.maeUkazane, p.rmseUkazane, p.presnostUkazane, p.chybaCV, p.presnostCV)
		t.Logf("  tipy: %d (běhů s tipy %d), P@10 %.2f, tvrzená přesnost %.2f, skutečná %.2f; čas %v",
			p.tipu, sTipy, p.p10Tipy, p.tvrzenaTipy, p.skutecnaTipy, p.cas.Round(time.Millisecond))
		// Pojistky (semínka jsou pevná, výsledek je opakovatelný): náhodný vkus se nikdy neodhaduje, jinak model
		// řadí lépe než náhoda a ukázané odhady i tipy většinou sedí
		switch {
		case sc.nahodnyVkus && platnych > 0:
			t.Errorf("%s: náhodný vkus prošel ověřením", sc.nazev)
		case !sc.nahodnyVkus && (p.rho < 0.15 || p.presnostUkazane < 0.55 || p.p10Tipy < 0.5 || platnych < sc.semen/2):
			t.Errorf("%s: model vkusu je slabší, než má být", sc.nazev)
		}
	}
}

// Vkus, který závisí i na věku při prvním vydání a poměru hrudník/pas (go test -run TestVyhodnoceniVkusuVekProporce -v)
func TestVyhodnoceniVkusuVekProporce(t *testing.T) {
	if testing.Short() {
		t.Skip("vyhodnocení modelu vkusu se v rychlém běhu nespouští")
	}
	harnessVekProporce = true
	defer func() { harnessVekProporce = false }()
	for _, sc := range []scenarHarness{{"400/50 %, i věk a proporce", 400, 0.5, 12, false}, {"3000/30 %, i věk a proporce", 3000, 0.3, 3, false}} {
		var behy []metrikyVkusu
		for semeno := range sc.semen {
			behy = append(behy, vyhodnotitVkus(harnessVkusu(sc.n, sc.podil, int64(1000+semeno), false)))
		}
		p, platnych, _ := prumerMetrik(behy)
		t.Logf("%s: MAE %.3f (průměr %.3f) ρ %.3f P@10 %.2f | platný %d/%d pokrytí %.2f ukázané MAE %.3f přesnost %.2f | tipů %d P@10 %.2f",
			sc.nazev, p.maeVse, p.maePrumer, p.rho, p.p10Vse, platnych, sc.semen, p.pokryti, p.maeUkazane, p.presnostUkazane, p.tipu, p.p10Tipy)
	}
}

// Porovnání variant modelu (go test -run TestVyhodnoceniVariantVkusu -v)
func TestVyhodnoceniVariantVkusu(t *testing.T) {
	if testing.Short() {
		t.Skip("vyhodnocení modelu vkusu se v rychlém běhu nespouští")
	}
	puvodni := nastaveniVkusuVychozi
	defer func() { nastaveniVkusuVychozi = puvodni }()
	varianty := []struct {
		nazev string
		nast  nastaveniVkusu
	}{
		{"hřeben bez pětin", nastaveniVkusu{hreben: true, fotky: fotkyPrumer, vahaStromu: -1}},
		{"hřeben s pětinami", nastaveniVkusu{hreben: true, kose: true, fotky: fotkyObe, vahaStromu: -1}},
		{"stromy", nastaveniVkusu{stromy: true, fotky: fotkyObe, vahaStromu: -1}},
		{"průměr (váha z CV)", nastaveniVkusu{hreben: true, stromy: true, kose: true, fotky: fotkyObe, vahaStromu: -1}},
		{"průměr, jen skóre fotek", nastaveniVkusu{hreben: true, stromy: true, kose: true, fotky: fotkySkore, vahaStromu: -1}},
		{"hřeben + skupiny bohatosti", nastaveniVkusu{hreben: true, kose: true, fotky: fotkyObe, vahaStromu: -1, poSkupinach: true}},
		{"průměr + skupiny (výchozí)", nastaveniVkusuVychozi},
	}
	scenare := []scenarHarness{
		{"400/50 %", 400, 0.5, 12, false},
		{"400/15 %", 400, 0.15, 12, false},
		{"3000/30 %", 3000, 0.3, 3, false},
	}
	for _, sc := range scenare {
		var data []sbirkaHarness
		for semeno := range sc.semen {
			data = append(data, harnessVkusu(sc.n, sc.podil, int64(1000+semeno), sc.nahodnyVkus))
		}
		t.Logf("%s:", sc.nazev)
		for _, va := range varianty {
			nastaveniVkusuVychozi = va.nast
			var behy []metrikyVkusu
			for _, d := range data {
				behy = append(behy, vyhodnotitVkus(d))
			}
			p, platnych, _ := prumerMetrik(behy)
			t.Logf("  %-28s MAE %.3f RMSE %.3f ρ %.3f P@10 %.2f | CV MAE %.3f | platný %2d/%d pokrytí %.2f ukázané MAE %.3f přesnost %.2f (CV %.2f) | tipů %d P@10 %.2f sedí %.2f (tvrdí %.2f) | %v",
				va.nazev, p.maeVse, p.rmseVse, p.rho, p.p10Vse, p.chybaCV, platnych, sc.semen, p.pokryti, p.maeUkazane, p.presnostUkazane, p.presnostCV, p.tipu, p.p10Tipy, p.skutecnaTipy, p.tvrzenaTipy, p.cas.Round(time.Millisecond))
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Jednotkové testy modelu vkusu

// Stromy najdou souvislost, kterou přímka nevidí (líbí se jen blond z jedné éry nebo jiná z druhé: „xor“),
// a příspěvky po cestě stromem dají sečtené s kořeny přesně odhad
func TestStromyVkusuSouvislost(t *testing.T) {
	r := rand.New(rand.NewSource(1))
	var kosy [][]uint8
	var y []float64
	for range 400 {
		a, b := uint8(1+r.Intn(2)), uint8(1+r.Intn(2))
		vyska := uint8(r.Intn(5)) // 0 = chybí, 1–4 koše; na výšce nezáleží
		kosy = append(kosy, []uint8{a, b, vyska})
		h := 2.0
		if (a == 2) != (b == 2) {
			h = 4
		}
		y = append(y, h+0.3*r.NormFloat64())
	}
	d := novaDataStromu(kosy, []int{3, 3, 5})
	vse := make([]int, len(kosy))
	for i := range vse {
		vse[i] = i
	}
	les := naucitLes(d, y, vse, maxStromu, 7, nil)
	for _, x := range [][]uint8{{1, 1, 0}, {2, 2, 3}, {1, 2, 1}, {2, 1, 0}} {
		odhad := les.predikce(x, len(les.stromy))
		chce := 2.0
		if (x[0] == 2) != (x[1] == 2) {
			chce = 4
		}
		if math.Abs(odhad-chce) > 0.35 {
			t.Errorf("koše %v: odhad %.2f, chce %.0f", x, odhad, chce)
		}
		soucet := les.prispevky(x, func(int, float64) {})
		les.prispevky(x, func(_ int, c float64) { soucet += c })
		if math.Abs(soucet-odhad) > 1e-9 {
			t.Errorf("koše %v: součet příspěvků %.6f ≠ odhad %.6f", x, soucet, odhad)
		}
	}
}

// Kategorie s rokem se počítá bez roku, poměr pas/boky a rok prvního výskytu jsou mezi číselnými údaji
func TestUdajeVkusuKategorieARok(t *testing.T) {
	udaje := pripravitUdajeVkusu([]Modelka{
		{ID: 1, Role: "Playmate roku 1998, Celebrita", Vydani: []string{"1997-05"}, ObvodPasCm: 60, ObvodBokyCm: 90},
		{ID: 2, Role: "Playmate roku 2003", Vydani: []string{"2002-11"}},
	})
	pmoy := "kategorie=" + klicHodnoty("kategorie", "Playmate roku")
	for id := 1; id <= 2; id++ {
		if !slices.Contains(udaje[id].kat, pmoy) {
			t.Errorf("modelka %d: kategorie %v bez %q", id, udaje[id].kat, pmoy)
		}
	}
	u := udaje[1]
	if !u.ma[cvRok] || u.cis[cvRok] != 1997 || !u.ma[cvPomer] || math.Abs(u.cis[cvPomer]-2.0/3) > 1e-9 {
		t.Errorf("číselné údaje: %+v", u)
	}
	if textCislaVkusu(cvRok, 1997) != "90. léta" || textCislaVkusu(cvVyska, 170.4) != "výška 170 cm" || textCislaVkusu(cvBmi, 19.46) != "BMI 19,5" {
		t.Error("zápis číselných údajů do důvodu")
	}
	if textKoseVkusu(cvVyska, 165, 170) != "výška 165–169 cm" || textKoseVkusu(cvVyska, math.Inf(-1), 160) != "výška pod 160 cm" {
		t.Error("zápis rozmezí do důvodu")
	}
}

// Když o vkusu říkají jen srdíčka fotek, odhad se ukáže jen u modelek se srdíčky fotek; u ostatních by na
// ověření průměr nepřekonal
func TestVkusJenSkupinySFotkami(t *testing.T) {
	r := rand.New(rand.NewSource(5))
	var modelky []Modelka
	for i := range 400 {
		m := Modelka{ID: i + 1, Jmeno: fmt.Sprintf("Modelka %03d", i+1), VlasyBarva: vlasyVkus[r.Intn(4)], Etnicita: "kavkazská",
			Narodnost: "USA", VyskaCm: 160 + r.Intn(20), Vydani: []string{fmt.Sprintf("%d-06", 1960+r.Intn(50))},
			fotografoveAlb: fotografoveVkus[r.Intn(4)] + "\n", Tetovani: -1, Piercing: -1}
		vkus := 1 + 4*r.Float64()
		if i%2 == 0 {
			var c srdickaAlba
			for range 12 {
				h := int(math.Round(min(max(vkus+0.6*r.NormFloat64(), 1), 5)))
				c[h-1]++
				m.fotekHodnocenych++
				m.srdciFotek += h
			}
			m.srdickaAlb = []srdickaAlba{c}
		}
		if i < 300 {
			m.Hodnoceni = min(max(math.Round(vkus+0.3*r.NormFloat64()), 1), 5)
		}
		modelky = append(modelky, m)
	}
	model := spocitatOblibenost(modelky, nil, nyniHarness)
	v := model.vkus
	if !v.platny {
		t.Fatalf("model neprošel: chyba %.3f, průměr %.3f, přesnost %.3f", v.chybaCV, v.chybaZaklad, v.presnost)
	}
	sFotkami, bez := 0, 0
	for _, m := range modelky[300:] {
		if _, ok := model.odhad[m.ID]; ok {
			if m.fotekHodnocenych > 0 {
				sFotkami++
			} else {
				bez++
			}
		}
	}
	if sFotkami < 40 || bez > 0 {
		t.Fatalf("odhady: se srdíčky fotek %d, bez nich %d (skupiny %v)", sFotkami, bez, v.ukazatKos)
	}
	t.Logf("odhady u %d modelek se srdíčky fotek, skupiny %v, váha stromů %.2f", sFotkami, v.ukazatKos, v.vahaStromu)
	// Důvod vysokého odhadu je ze srdíček fotek a jmenuje podobné hodnocené
	duvod := ""
	for _, m := range modelky[300:] {
		if o, ok := model.odhad[m.ID]; ok && o >= 4 && duvod == "" {
			duvod = v.textOdhadu(m.ID, o, true, true)
		}
	}
	if !strings.HasPrefix(duvod, "Odhad 4") || !strings.Contains(duvod, "srdíčka jejích fotek") || !strings.Contains(duvod, "podobně jako Modelka") {
		t.Fatalf("důvod: %q", duvod)
	}
	t.Log(duvod)
}

// Poměr hrudník/pas a věk při prvním vydání (z data narození); nevěrohodný věk se nepočítá
func TestUdajeVkusuHrudPasAVek(t *testing.T) {
	klic := func(pole, text string) string { return text }
	m := Modelka{ID: 1, ObvodHrudnikCm: 90, ObvodPasCm: 60, ObvodBokyCm: 88, NarozeniDatum: "1975-03-12", Vydani: []string{"1997-06"}, Tetovani: -1, Piercing: -1}
	u := udajeModelkyVkus(m, klic)
	if !u.ma[cvHrudPas] || math.Abs(u.cis[cvHrudPas]-1.5) > 1e-9 || !u.ma[cvVek] || u.cis[cvVek] != 22 {
		t.Fatalf("hrudník/pas %v (%v), věk %v (%v)", u.cis[cvHrudPas], u.ma[cvHrudPas], u.cis[cvVek], u.ma[cvVek])
	}
	if textCislaVkusu(cvVek, 22) != "věk 22 let" || textCislaVkusu(cvHrudPas, 1.5) != "poměr hrudník/pas 1,50" {
		t.Fatalf("texty: %q, %q", textCislaVkusu(cvVek, 22), textCislaVkusu(cvHrudPas, 1.5))
	}
	m.NarozeniDatum = "1990-01-01" // „věk“ 7 let: překlep v datu, nepočítá se
	if u := udajeModelkyVkus(m, klic); u.ma[cvVek] {
		t.Fatalf("nevěrohodný věk %v", u.cis[cvVek])
	}
}
