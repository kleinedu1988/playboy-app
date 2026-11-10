package oblibenost

import (
	"fmt"
	"pinup-katalog/internal/hledani"
)

const (
	TopFotekAlba       = 5    // album hodnotí průměr nejvýš tolika jeho nejlepších fotek
	VychoziRozptylFoto = 0.5  // rozptyl srdíček fotek uvnitř alba, dokud ho sbírka neurčí (σ_w²)
	VychoziRozptylAlb  = 0.1  // rozptyl skóre alb jedné modelky kolem její úrovně (τ_a²)
	VychoziRozptylMod  = 0.3  // rozptyl úrovní modelek kolem průměru sbírky (τ_m²)
	MinRozptylFoto     = 0.05 // dolní meze odhadnutých rozptylů
	MinRozptylAlb      = 0.02
	MinRozptylMod      = 0.05
	MinStupnuVolnosti  = 10 // rozptyl se ze sbírky odhaduje až z tolika stupňů volnosti
)

type SkoreFotek struct {
	Skore   float64 // odhad na stupnici srdíček fotek (smrštěný k průměru sbírky)
	Rozptyl float64 // Var φ̂
	Surove  float64 // průměr skóre alb bez smrštění
	Alb     int     // alba s hodnocenými fotkami
	Fotek   int     // hodnocené fotky
}

type ParametryFotek struct {
	Stred                   float64 // μ: průměr úrovní modelek s hodnocenými fotkami
	RozptylFoto, RozptylAlb float64 // σ_w², τₐ²
	RozptylModelek          float64 // τₘ²
	Modelek                 int     // modelky s hodnocenými fotkami
}

// Průměr k nejlepších hodnocených fotek alba (k = min(5, n − ⌊n/4⌋)), k, počet hodnocených fotek n a jejich
// součet čtverců odchylek od průměru alba (rozptyl uvnitř alba)
func SkoreAlba(c [5]int) (prumer float64, k, n int, ctverce float64) {
	soucet := 0
	for h, pocet := range c {
		n += pocet
		soucet += (h + 1) * pocet
	}
	if n == 0 {
		return 0, 0, 0, 0
	}
	stred := float64(soucet) / float64(n)
	for h, pocet := range c {
		ctverce += float64(pocet) * (float64(h+1) - stred) * (float64(h+1) - stred)
	}
	k = min(TopFotekAlba, n-n/4)
	zbyva, vybrano := k, 0
	for h := 4; h >= 0 && zbyva > 0; h-- {
		vzit := min(zbyva, c[h])
		vybrano += vzit * (h + 1)
		zbyva -= vzit
	}
	return float64(vybrano) / float64(k), k, n, ctverce
}

func SpocitatSkoreFotek(modelky []hledani.Modelka) (map[int]SkoreFotek, ParametryFotek) {
	type album struct {
		m    float64
		k, n int
	}
	par := ParametryFotek{RozptylFoto: VychoziRozptylFoto, RozptylAlb: VychoziRozptylAlb, RozptylModelek: VychoziRozptylMod}
	alba := map[int][]album{}
	var ids []int
	ctverce, stupne := 0.0, 0
	for i := range modelky {
		m := &modelky[i]
		for _, c := range m.SrdickaAlb {
			prumer, k, n, q := SkoreAlba(c)
			if n == 0 {
				continue
			}
			if len(alba[m.ID]) == 0 {
				ids = append(ids, m.ID)
			}
			alba[m.ID] = append(alba[m.ID], album{prumer, k, n})
			ctverce += q
			stupne += n - 1
		}
	}
	vysledek := make(map[int]SkoreFotek, len(ids))
	if len(ids) == 0 {
		return vysledek, par
	}
	if stupne >= MinStupnuVolnosti {
		par.RozptylFoto = max(MinRozptylFoto, ctverce/float64(stupne))
	}
	q, st, nejistota, pocet := 0.0, 0, 0.0, 0
	for _, id := range ids {
		a := alba[id]
		if len(a) < 2 {
			continue
		}
		stred := 0.0
		for _, x := range a {
			stred += x.m
		}
		stred /= float64(len(a))
		for _, x := range a {
			q += (x.m - stred) * (x.m - stred)
			nejistota += par.RozptylFoto / float64(x.k)
			pocet++
		}
		st += len(a) - 1
	}
	if st >= MinStupnuVolnosti {
		par.RozptylAlb = max(MinRozptylAlb, q/float64(st)-nejistota/float64(pocet))
	}
	surove := make([]float64, len(ids))
	nejistoty := make([]float64, len(ids))
	stred := 0.0
	for i, id := range ids {
		a := alba[id]
		for _, x := range a {
			surove[i] += x.m
			nejistoty[i] += par.RozptylFoto/float64(x.k) + par.RozptylAlb
		}
		surove[i] /= float64(len(a))
		nejistoty[i] /= float64(len(a) * len(a))
		stred += surove[i]
	}
	stred /= float64(len(ids))
	par.Stred, par.Modelek = stred, len(ids)
	if len(ids) >= MinStupnuVolnosti {
		rozptyl, prumernaNejistota := 0.0, 0.0
		for i := range ids {
			rozptyl += (surove[i] - stred) * (surove[i] - stred)
			prumernaNejistota += nejistoty[i]
		}
		par.RozptylModelek = max(MinRozptylMod, rozptyl/float64(len(ids)-1)-prumernaNejistota/float64(len(ids)))
	}
	for i, id := range ids {
		presnost, soucet := 1/par.RozptylModelek, par.Stred/par.RozptylModelek
		fotek := 0
		for _, x := range alba[id] {
			v := par.RozptylFoto/float64(x.k) + par.RozptylAlb
			presnost += 1 / v
			soucet += x.m / v
			fotek += x.n
		}
		vysledek[id] = SkoreFotek{Skore: soucet / presnost, Rozptyl: 1 / presnost, Surove: surove[i], Alb: len(alba[id]), Fotek: fotek}
	}
	return vysledek, par
}

func sklonovatSlovo(n int, jedna, dveCtyri, petAVic string) string {
	switch {
	case n == 1:
		return jedna
	case n >= 2 && n <= 4:
		return dveCtyri
	}
	return petAVic
}

// „fotky 4,3 (3 alba, 41 hodnocených fotek)“
func TextSkoreFotek(s SkoreFotek) string {
	return fmt.Sprintf("fotky %s (%d %s, %d %s)", CisloCesky(s.Skore, 1), s.Alb, sklonovatSlovo(s.Alb, "album", "alba", "alb"),
		s.Fotek, sklonovatSlovo(s.Fotek, "hodnocená fotka", "hodnocené fotky", "hodnocených fotek"))
}
