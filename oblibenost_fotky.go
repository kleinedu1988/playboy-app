package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// Skóre fotek, naučená váha fotek v předpokladu Bradley–Terry a náhledy alb pro porovnání (celkový popis
// v docs/UCENI.md, oddíly Skóre fotek, Předpoklad a naučená váha fotek a Náhledy alb):
//
//   - Skóre fotek: z hodnocených fotek modelky po albech. Album hodnotí průměr jeho nejlepších fotek (bez slabší
//     čtvrtiny, nejvýš pět), každé album je jeden hlas (velké album nepřehlasuje ostatní) a odhad se smršťuje
//     k průměru sbírky podle toho, kolik alb a fotek modelka má (empirický Bayes: hierarchický normální model
//     fotka → album → modelka, rozptyly odhadnuté ze sbírky). Nehodnocené fotky a alba bez hodnocených fotek se
//     nepočítají; typ alba (centerfold, pictorial, online) se nerozlišuje.
//   - Předpoklad síly v Bradley–Terry: srdíčka modelky smíchaná se skóre fotek převedeným na stupnici srdíček
//     modelek (lineární kalibrace). Váhu směsi se program učí z porovnání: vybere tu, která porovnání předpovídá
//     nejlépe, smrštěnou k výchozí váze tím silněji, čím méně porovnání je (sílu smrštění vybírá křížové ověření).
//   - Náhledy alb: pro porovnání několik nejlepších fotek modelky, z každého alba aspoň jedna.

// Parametry skóre fotek
const (
	topFotekAlba       = 5    // album hodnotí průměr nejvýš tolika jeho nejlepších fotek
	vychoziRozptylFoto = 0.5  // rozptyl srdíček fotek uvnitř alba, dokud ho sbírka neurčí (σ_w²)
	vychoziRozptylAlb  = 0.1  // rozptyl skóre alb jedné modelky kolem její úrovně (τ_a²)
	vychoziRozptylMod  = 0.3  // rozptyl úrovní modelek kolem průměru sbírky (τ_m²)
	minRozptylFoto     = 0.05 // dolní meze odhadnutých rozptylů (odhad momentovou metodou může vyjít i záporný)
	minRozptylAlb      = 0.02
	minRozptylMod      = 0.05
	minStupnuVolnosti  = 10 // rozptyl se ze sbírky odhaduje až z tolika stupňů volnosti (modelek, alb)
)

// Parametry předpokladu a naučené váhy fotek
const (
	vychoziVahaFotek    = 0.3  // váha skóre fotek v předpokladu, dokud porovnání neřeknou jinak
	maxVahaFotek        = 0.8  // strop naučené váhy: vlastní srdíčka modelky váží vždy aspoň pětinou
	minPorovnaniVahy    = 10   // z méně porovnání, na kterých váha něco mění, se neučí
	minSigmaPredpokladu = 0.2  // směrodatná odchylka předpokladu hodnocené modelky nejméně (porovnání ji musí umět posunout)
	vychoziRozptylKalib = 0.5  // nejistota převodu skóre fotek na srdíčka modelek, dokud ji sbírka neurčí
	minKalibrace        = 10   // převod skóre fotek na srdíčka se počítá z aspoň tolika hodnocených modelek s fotkami
	krokVahy            = 0.05 // mřížka vah 0; 0,05; … 1
)

// Síla smrštění naučené váhy k výchozí (v počtu porovnání); vybere ji křížové ověření
var silyPredpokladuVahy = []float64{10, 40, 160}

// ---------------------------------------------------------------------------------------------------------
// Skóre fotek
//
// Fotka h v albu a modelky m: h ~ N(θₐ, σ_w²), album θₐ ~ N(φₘ, τₐ²), modelka φₘ ~ N(μ, τₘ²).
// Album se shrne průměrem mₐ svých k nejlepších hodnocených fotek, k = min(5, n − ⌊n/4⌋): slabší čtvrtina alba
// a fotky za pátou nejlepší výsledek nezhorší (album s pěti fotkami za 5 srdíček a třiceti průměrnými je
// výborné album), ale album s jedinou dobrou fotkou mezi slabými zůstane slabé. Rozptyl mₐ kolem φₘ je
// vₐ = σ_w²/kₐ + τₐ² (skóre alba stojí na kₐ fotkách), takže váha alba 1/vₐ přestane růst od šesti hodnocených
// fotek: album je jeden hlas a čtyřicet fotek ho neudělá silnějším; album s jednou dvěma fotkami je jen částečný
// hlas (je nejisté). Aposteriorní odhad modelky:
//
//	φ̂ = (μ/τₘ² + Σ mₐ/vₐ) / (1/τₘ² + Σ 1/vₐ),   Var φ̂ = 1 / (1/τₘ² + Σ 1/vₐ)
//
// σ_w² se odhadne ze srdíček fotek uvnitř alb, τₐ² z rozdílů alb téže modelky a τₘ² z rozdílů modelek (vždy
// pozorovaný rozptyl minus část, kterou vysvětlí nejistota odhadů; empirický Bayes momentovou metodou).

type skoreFotek struct {
	skore   float64 // odhad na stupnici srdíček fotek (smrštěný k průměru sbírky)
	rozptyl float64 // Var φ̂
	surove  float64 // průměr skóre alb bez smrštění
	alb     int     // alba s hodnocenými fotkami
	fotek   int     // hodnocené fotky
}

type parametryFotek struct {
	stred                   float64 // μ: průměr úrovní modelek s hodnocenými fotkami
	rozptylFoto, rozptylAlb float64 // σ_w², τₐ²
	rozptylModelek          float64 // τₘ²
	modelek                 int     // modelky s hodnocenými fotkami
}

// Průměr k nejlepších hodnocených fotek alba (k = min(5, n − ⌊n/4⌋)), k, počet hodnocených fotek n a jejich
// součet čtverců odchylek od průměru alba (rozptyl uvnitř alba)
func skoreAlba(c srdickaAlba) (prumer float64, k, n int, ctverce float64) {
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
	k = min(topFotekAlba, n-n/4)
	zbyva, vybrano := k, 0
	for h := 4; h >= 0 && zbyva > 0; h-- {
		vzit := min(zbyva, c[h])
		vybrano += vzit * (h + 1)
		zbyva -= vzit
	}
	return float64(vybrano) / float64(k), k, n, ctverce
}

func spocitatSkoreFotek(modelky []Modelka) (map[int]skoreFotek, parametryFotek) {
	type album struct {
		m    float64
		k, n int
	}
	par := parametryFotek{rozptylFoto: vychoziRozptylFoto, rozptylAlb: vychoziRozptylAlb, rozptylModelek: vychoziRozptylMod}
	alba := map[int][]album{}
	var ids []int
	ctverce, stupne := 0.0, 0
	for i := range modelky {
		m := &modelky[i]
		for _, c := range m.srdickaAlb {
			prumer, k, n, q := skoreAlba(c)
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
	vysledek := make(map[int]skoreFotek, len(ids))
	if len(ids) == 0 {
		return vysledek, par
	}
	// σ_w²: srdíčka fotek uvnitř alb
	if stupne >= minStupnuVolnosti {
		par.rozptylFoto = max(minRozptylFoto, ctverce/float64(stupne))
	}
	// τₐ²: alba téže modelky kolem jejího průměru, bez části vysvětlené nejistotou alb
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
			nejistota += par.rozptylFoto / float64(x.k)
			pocet++
		}
		st += len(a) - 1
	}
	if st >= minStupnuVolnosti {
		par.rozptylAlb = max(minRozptylAlb, q/float64(st)-nejistota/float64(pocet))
	}
	// μ a τₘ²: průměry modelek kolem průměru sbírky, bez části vysvětlené nejistotou průměrů
	surove := make([]float64, len(ids))
	nejistoty := make([]float64, len(ids))
	stred := 0.0
	for i, id := range ids {
		a := alba[id]
		for _, x := range a {
			surove[i] += x.m
			nejistoty[i] += par.rozptylFoto/float64(x.k) + par.rozptylAlb
		}
		surove[i] /= float64(len(a))
		nejistoty[i] /= float64(len(a) * len(a))
		stred += surove[i]
	}
	stred /= float64(len(ids))
	par.stred, par.modelek = stred, len(ids)
	if len(ids) >= minStupnuVolnosti {
		rozptyl, prumernaNejistota := 0.0, 0.0
		for i := range ids {
			rozptyl += (surove[i] - stred) * (surove[i] - stred)
			prumernaNejistota += nejistoty[i]
		}
		par.rozptylModelek = max(minRozptylMod, rozptyl/float64(len(ids)-1)-prumernaNejistota/float64(len(ids)))
	}
	for i, id := range ids {
		presnost, soucet := 1/par.rozptylModelek, par.stred/par.rozptylModelek
		fotek := 0
		for _, x := range alba[id] {
			v := par.rozptylFoto/float64(x.k) + par.rozptylAlb
			presnost += 1 / v
			soucet += x.m / v
			fotek += x.n
		}
		vysledek[id] = skoreFotek{skore: soucet / presnost, rozptyl: 1 / presnost, surove: surove[i], alb: len(alba[id]), fotek: fotek}
	}
	return vysledek, par
}

// ---------------------------------------------------------------------------------------------------------
// Převod skóre fotek na stupnici srdíček modelek
//
// Srdíčka fotek a modelek jsou různé stupnice (fotky se třeba hodnotí štědřeji a v užším rozsahu). Pro hodnocené
// modelky se skóre převede jen na stejnou stupnici, posunem a natažením podle průměru a rozptylu obou u hodnocených
// modelek s fotkami: F̂ = H̄ + (F − F̄)·sd_H/sd_F (natažení v mezích 0,25–4; z méně než 10 modelek nebo bez rozptylu
// jen posun průměrů). Kolik má převedené skóre vážit, neurčuje převod (to by byla korelace fotek se srdíčky,
// kterou sbírka hodnocená jen srdíčky nevidí), ale naučená váha z porovnání. Nejistota F̂ je natažení²·Var φ̂.
//
// Nehodnocená modelka žádná srdíčka nemá, předpoklad jejích srdíček je předpověď ze skóre: lineární regrese
// srdíček hodnocených modelek na jejich skóre, F̃ = α + β·F (β v mezích 0–3). Skóre je aposteriorní odhad
// (smrštěný), takže regrese na něj je kalibrovaná a neutlumí se šumem. Nejistota je r₀² + β²·Var φ̂, kde r₀² je
// rozptyl reziduí bez části vysvětlené nejistotou skóre. Z méně než 10 modelek: β = 1 a posun průměrů, r₀² = 0,5.

type kalibraceFotek struct {
	posun, meritko      float64 // stupnice pro hodnocené
	alfa, beta, rozptyl float64 // regrese pro nehodnocené
	modelek             int
}

func kalibrovatFotky(modelky []Modelka, skore map[int]skoreFotek) kalibraceFotek {
	k := kalibraceFotek{meritko: 1, beta: 1, rozptyl: vychoziRozptylKalib}
	var x, y, v []float64
	for i := range modelky {
		m := &modelky[i]
		if s, ok := skore[m.ID]; ok && m.Hodnoceni > 0 {
			x, y, v = append(x, s.skore), append(y, m.Hodnoceni), append(v, s.rozptyl)
		}
	}
	k.modelek = len(x)
	if len(x) == 0 {
		return k
	}
	mx, my, mv := 0.0, 0.0, 0.0
	for i := range x {
		mx, my, mv = mx+x[i], my+y[i], mv+v[i]
	}
	n := float64(len(x))
	mx, my, mv = mx/n, my/n, mv/n
	k.posun, k.alfa = my-mx, my-mx
	if len(x) < minKalibrace {
		return k
	}
	sxx, syy, sxy := 0.0, 0.0, 0.0
	for i := range x {
		sxx += (x[i] - mx) * (x[i] - mx)
		syy += (y[i] - my) * (y[i] - my)
		sxy += (x[i] - mx) * (y[i] - my)
	}
	if sdx, sdy := math.Sqrt(sxx/n), math.Sqrt(syy/n); sdx > 0.05 && sdy > 0.05 {
		k.meritko = min(max(sdy/sdx, 0.25), 4)
		k.posun = my - k.meritko*mx
	}
	if sxx < 1e-9 {
		return k
	}
	k.beta = min(max(sxy/sxx, 0), 3)
	k.alfa = my - k.beta*mx
	rezidua := 0.0
	for i := range x {
		r := y[i] - k.alfa - k.beta*x[i]
		rezidua += r * r
	}
	k.rozptyl = max(0.05, rezidua/max(1, n-2)-k.beta*k.beta*mv)
	return k
}

// Skóre na stupnici srdíček (pro hodnocené modelky) a jeho nejistota
func (k kalibraceFotek) naSrdicka(s skoreFotek) (stred, rozptyl float64) {
	return min(max(k.posun+k.meritko*s.skore, 0.5), 5), k.meritko * k.meritko * s.rozptyl
}

// Předpověď srdíček ze skóre (pro nehodnocené modelky) a její nejistota
func (k kalibraceFotek) predpovedSrdicek(s skoreFotek) (stred, rozptyl float64) {
	return min(max(k.alfa+k.beta*s.skore, 0.5), 5), k.rozptyl + k.beta*k.beta*s.rozptyl
}

// ---------------------------------------------------------------------------------------------------------
// Naučená váha fotek
//
// Předpoklad síly hodnocené modelky se skóre fotek je μ(w) = (1 − w)·srdíčka + w·F̂. Pro každou váhu w z mřížky
// 0; 0,05; … 1 se spočítá, jak dobře rozdíl předpokladů předpovídá výsledky porovnání (log-věrohodnost
// Σ t·log σ(±k·(μᵢ − μⱼ)), t = váha podle stáří, remíza půl), se srdíčky obou v okamžiku porovnání. Počítají se
// jen porovnání modelek se stejnými srdíčky, kde aspoň jedna má skóre fotek: tam je rozdíl předpokladů přesně
// w·(F̂ᵢ − F̂ⱼ) a věrohodnost měří, jak silně mají fotky modelky jedné úrovně rozlišit. Porovnání různých úrovní
// by váhu zkreslila: váha zároveň zmenšuje rozdíl srdíček, takže kdyby uživatel občas dal přednost modelce
// s méně srdíčky, vyšší váha by vypadala lépe, i když fotky nic neříkají. Nejlepší ŵ se smrští k výchozí váze:
// w = (n·ŵ + n₀·w₀)/(n + n₀), n = počet těch porovnání. Sílu n₀ ∈ {10, 40, 160} vybere křížové ověření na pěti částech (učí se na čtyřech, měří
// log-ztrátu na páté). Pod 10 takových porovnání platí výchozí váha 0,3.

type porovnaniVahy struct {
	hi, hj, fi, fj float64 // srdíčka v okamžiku porovnání a převedené skóre fotek (0 = není)
	y, t           float64 // výsledek z pohledu i (1, 0,5, 0) a váha podle stáří
}

type vysledekVahy struct {
	vaha            float64
	naucena         bool // z porovnání (jinak výchozí)
	porovnani       int  // porovnání, na kterých váha něco mění
	silaPredpokladu float64
	// Průměrná log-ztráta na ověření: předpoklad jen ze srdíček a s naučenou vahou (na týchž porovnáních)
	ztrataSrdicka, ztrataVahy float64
}

// Předpoklad jedné strany porovnání při váze w
func predpokladStrany(h, f, w, prumer float64) float64 {
	switch {
	case h > 0 && f > 0:
		return (1-w)*h + w*f
	case h > 0:
		return h
	case f > 0:
		return f
	}
	return prumer
}

// Učí se z dvojice váha? (obě hodnocené stejně, aspoň jedna se skóre fotek a skóre se liší)
func (p porovnaniVahy) informativni() bool {
	if p.hi <= 0 || p.hi != p.hj {
		return false
	}
	d := func(h, f float64) float64 {
		if h > 0 && f > 0 {
			return f - h
		}
		return 0
	}
	return math.Abs(d(p.hi, p.fi)-d(p.hj, p.fj)) > 1e-9
}

func logZtrata(p porovnaniVahy, w, prumer float64) float64 {
	d := skalaBT * (predpokladStrany(p.hi, p.fi, w, prumer) - predpokladStrany(p.hj, p.fj, w, prumer))
	// −[y·log σ(d) + (1 − y)·log σ(−d)], stabilně: log σ(d) = −log(1 + e^(−d))
	return p.t * (p.y*math.Log1p(math.Exp(-d)) + (1-p.y)*math.Log1p(math.Exp(d)))
}

func naucitVahuFotek(data []porovnaniVahy, prumer float64) vysledekVahy {
	v := vysledekVahy{vaha: vychoziVahaFotek}
	var info []porovnaniVahy
	for _, p := range data {
		if p.informativni() && p.t > 0 {
			info = append(info, p)
		}
	}
	v.porovnani = len(info)
	if len(info) < minPorovnaniVahy {
		return v
	}
	mrizka := make([]float64, 0, int(1/krokVahy)+1)
	for i := 0; i <= int(math.Round(maxVahaFotek/krokVahy)); i++ {
		mrizka = append(mrizka, float64(i)*krokVahy)
	}
	// Nejlepší váha na podmnožině (bez části vynech; -1 = všechna) a počet jejích porovnání
	nejlepsi := func(vynech int) (float64, int) {
		ztraty := make([]float64, len(mrizka))
		n := 0
		for i, p := range info {
			if i%pocetSkupinCV == vynech {
				continue
			}
			n++
			for g, w := range mrizka {
				ztraty[g] += logZtrata(p, w, prumer)
			}
		}
		g := 0
		for x := range mrizka {
			// Při shodě váha blíž výchozí
			if ztraty[x] < ztraty[g]-1e-12 || (math.Abs(ztraty[x]-ztraty[g]) <= 1e-12 && math.Abs(mrizka[x]-vychoziVahaFotek) < math.Abs(mrizka[g]-vychoziVahaFotek)) {
				g = x
			}
		}
		return mrizka[g], n
	}
	smrstit := func(w float64, n int, n0 float64) float64 {
		return (float64(n)*w + n0*vychoziVahaFotek) / (float64(n) + n0)
	}
	ztratyN0 := make([]float64, len(silyPredpokladuVahy))
	for s := range pocetSkupinCV {
		w, n := nejlepsi(s)
		for x, n0 := range silyPredpokladuVahy {
			ws := smrstit(w, n, n0)
			for i, p := range info {
				if i%pocetSkupinCV == s {
					ztratyN0[x] += logZtrata(p, ws, prumer)
				}
			}
		}
	}
	vyber := len(silyPredpokladuVahy) - 1
	for x := len(silyPredpokladuVahy) - 1; x >= 0; x-- {
		if ztratyN0[x] < ztratyN0[vyber]-1e-12 {
			vyber = x
		}
	}
	celkem := 0.0
	for _, p := range info {
		v.ztrataSrdicka += logZtrata(p, 0, prumer)
		celkem += p.t
	}
	v.ztrataSrdicka /= celkem
	v.ztrataVahy = ztratyN0[vyber] / celkem
	w, n := nejlepsi(-1)
	v.silaPredpokladu = silyPredpokladuVahy[vyber]
	v.vaha = smrstit(w, n, v.silaPredpokladu)
	v.naucena = true
	return v
}

// Zlepšení předpovědi porovnání proti předpokladu jen ze srdíček (na ověření), 0 = neučeno
func (v vysledekVahy) zlepseni() float64 {
	if !v.naucena || v.ztrataSrdicka <= 0 {
		return 0
	}
	return 1 - v.ztrataVahy/v.ztrataSrdicka
}

// Předpoklad síly modelky: střed a směrodatná odchylka. Hodnocená se skóre fotek: (1 − w)·srdíčka + w·F̂,
// rozptyl (1 − w)²·0,25² + w²·Var F̂ (nejméně 0,2²); hodnocená bez fotek: srdíčka, 0,25; nehodnocená se skóre:
// předpověď srdíček ze skóre F̃ s její nejistotou (nejvýš 1,25). ok = false: modelka nemá srdíčka ani skóre fotek
// (předpoklad dostane, jen když byla porovnávaná: průměr sbírky, sigmaNehodnocene).
func predpokladModelky(h float64, sf skoreFotek, maF bool, k kalibraceFotek, w float64) (stred, sigma float64, ok bool) {
	switch {
	case h > 0 && maF:
		f, vf := k.naSrdicka(sf)
		rozptyl := (1-w)*(1-w)*sigmaHodnocene*sigmaHodnocene + w*w*vf
		return (1-w)*h + w*f, max(minSigmaPredpokladu, math.Sqrt(rozptyl)), true
	case h > 0:
		return h, sigmaHodnocene, true
	case maF:
		f, vf := k.predpovedSrdicek(sf)
		return f, min(sigmaNehodnocene, math.Sqrt(vf)), true
	}
	return 0, 0, false
}

// ---------------------------------------------------------------------------------------------------------
// Texty

// „4,3“
func cisloCesky(x float64, mist int) string {
	return strings.Replace(fmt.Sprintf("%.*f", mist, x), ".", ",", 1)
}

// „srdíčka 3,5“, „bez srdíček“
func textSlozkySrdicek(h float64) string {
	if h <= 0 {
		return "bez srdíček"
	}
	return "srdíčka " + strings.TrimSuffix(cisloCesky(h, 1), ",0")
}

// „fotky 4,3 (3 alba, 41 hodnocených fotek)“
func textSkoreFotek(s skoreFotek) string {
	return fmt.Sprintf("fotky %s (%d %s, %d %s)", cisloCesky(s.skore, 1), s.alb, sklonovatSlovo(s.alb, "album", "alba", "alb"),
		s.fotek, sklonovatSlovo(s.fotek, "hodnocená fotka", "hodnocené fotky", "hodnocených fotek"))
}

// ---------------------------------------------------------------------------------------------------------
// Náhledy alb pro porovnání
//
// K velké titulní fotce každé modelky v porovnání patří řada několika fotek z jejích alb: nejlépe hodnocené,
// z každého alba aspoň jedna. Alba se seřadí podle skóre (průměr nejlepších fotek, alba bez hodnocených fotek
// nakonec, při shodě v pořadí přidání), fotky v albu podle srdíček a pak podle pořadí v albu (ruční pořadí, jinak
// vložení). Napřed nejlepší fotka každého alba (při víc albech než náhledech nejlepších alb), zbylá místa
// dostanou ostatní fotky podle srdíček (při shodě ta výš ve svém albu, pak z lepšího alba); vybrané se nakonec
// seřadí podle srdíček (stabilně), takže 1. náhled je nejlepší fotka. Titulní fotka se neopakuje. Fotky se čtou
// jedním dotazem pro všechna alba žádaných modelek a výsledek se pamatuje se snímkem sbírky (změna fotek snímek
// zneplatní).

// Náhled fotky modelky v porovnání
type NahledFotky struct {
	ID        int    `json:"id"` // číslo fotky
	URL       string `json:"url"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
	Hodnoceni int    `json:"hodnoceni"` // srdíčka fotky 0–5
	Rotace    int    `json:"rotace"`
}

type nahledyModelky struct {
	pocet int
	fotky []NahledFotky
}

type fotkaNahledu struct {
	id, rotace, hodnoceni, poradi int
	drive                         string
}

const maxNahledu = 24

// Náhledy fotek modelek (nejvýš pocet na modelku) podle čísel modelek; neznámá modelka nebo modelka bez fotek
// má prázdný seznam
func (a *App) GetNahledyModelek(ids []int, pocet int) map[int][]NahledFotky {
	vysledek := map[int][]NahledFotky{}
	pocet = min(max(pocet, 1), maxNahledu)
	ids = ids[:min(len(ids), 2*maxDvojicNaVolani)]
	s := a.snimekSbirky()
	var chybi []int
	s.mu.Lock()
	for _, id := range ids {
		if _, hotovo := vysledek[id]; hotovo {
			continue
		}
		if n, ok := s.nahledy[id]; ok && n.pocet == pocet {
			vysledek[id] = n.fotky
			continue
		}
		vysledek[id] = nil
		chybi = append(chybi, id)
	}
	s.mu.Unlock()
	if len(chybi) == 0 {
		return vysledek
	}
	spocitane := a.spocitatNahledy(s, chybi, pocet)
	s.mu.Lock()
	if s.nahledy == nil {
		s.nahledy = map[int]nahledyModelky{}
	}
	for _, id := range chybi {
		f := spocitane[id]
		if f == nil {
			f = []NahledFotky{}
		}
		s.nahledy[id] = nahledyModelky{pocet, f}
		vysledek[id] = f
	}
	s.mu.Unlock()
	return vysledek
}

func (a *App) spocitatNahledy(s *snimek, ids []int, pocet int) map[int][]NahledFotky {
	vysledek := map[int][]NahledFotky{}
	var alba []any
	for _, id := range ids {
		for _, al := range s.albaModelek[id] {
			alba = append(alba, al.id)
		}
	}
	fotky := map[int64][]fotkaNahledu{}
	const davka = 500
	for od := 0; od < len(alba); od += davka {
		cast := alba[od:min(len(alba), od+davka)]
		radky, err := a.db.Query("SELECT id, album_id, drive_file_id, rotace, hodnoceni, COALESCE(poradi, 0) FROM fotky WHERE album_id IN (?"+
			strings.Repeat(", ?", len(cast)-1)+")", cast...)
		if err != nil {
			a.chyba("náhledy fotek", err)
			return vysledek
		}
		for radky.Next() {
			var f fotkaNahledu
			var album int64
			if radky.Scan(&f.id, &album, &f.drive, &f.rotace, &f.hodnoceni, &f.poradi) == nil {
				fotky[album] = append(fotky[album], f)
			}
		}
		radky.Close()
	}
	for _, id := range ids {
		cover := ""
		if i, ok := s.indexModelky[id]; ok {
			cover = s.modelky[i].CoverID
		}
		vysledek[id] = vybratNahledy(s.albaModelek[id], fotky, pocet, cover)
	}
	return vysledek
}

// Výběr náhledů: po kolech přes alba seřazená podle skóre, v albu nejlepší fotky napřed (viz výše)
func vybratNahledy(alba []albumModelky, fotky map[int64][]fotkaNahledu, pocet int, cover string) []NahledFotky {
	type albumVyberu struct {
		al    albumModelky
		skore float64
		fotky []fotkaNahledu
	}
	var serazena []albumVyberu
	for _, al := range alba {
		var f []fotkaNahledu
		for _, x := range fotky[al.id] {
			if cover == "" || x.drive != cover {
				f = append(f, x)
			}
		}
		if len(f) == 0 {
			continue
		}
		sort.SliceStable(f, func(i, j int) bool {
			x, y := f[i], f[j]
			if x.hodnoceni != y.hodnoceni {
				return x.hodnoceni > y.hodnoceni
			}
			if (x.poradi > 0) != (y.poradi > 0) {
				return x.poradi > 0
			}
			if x.poradi != y.poradi {
				return x.poradi < y.poradi
			}
			return x.id < y.id
		})
		skore, _, _, _ := skoreAlba(al.pocty)
		serazena = append(serazena, albumVyberu{al, skore, f})
	}
	sort.SliceStable(serazena, func(i, j int) bool {
		if serazena[i].skore != serazena[j].skore {
			return serazena[i].skore > serazena[j].skore
		}
		return serazena[i].al.id < serazena[j].al.id
	})
	// Nejlepší fotka každého alba, pak ostatní podle srdíček (při shodě dřív ta, která je ve svém albu výš,
	// a z lepšího alba); kandidáti jsou už v pořadí alb a fotek, takže stačí stabilní řazení
	type kandidat struct {
		a      *albumVyberu
		f      fotkaNahledu
		poradi int // pořadí fotky v jejím albu
	}
	var prvni, dalsi []kandidat
	for i := range serazena {
		for x, f := range serazena[i].fotky {
			k := kandidat{&serazena[i], f, x}
			if x == 0 {
				prvni = append(prvni, k)
			} else {
				dalsi = append(dalsi, k)
			}
		}
	}
	sort.SliceStable(dalsi, func(i, j int) bool {
		if dalsi[i].f.hodnoceni != dalsi[j].f.hodnoceni {
			return dalsi[i].f.hodnoceni > dalsi[j].f.hodnoceni
		}
		return dalsi[i].poradi < dalsi[j].poradi
	})
	vybrane := append(prvni[:min(pocet, len(prvni)):min(pocet, len(prvni))], dalsi[:min(max(0, pocet-len(prvni)), len(dalsi))]...)
	sort.SliceStable(vybrane, func(i, j int) bool { return vybrane[i].f.hodnoceni > vybrane[j].f.hodnoceni })
	vysledek := make([]NahledFotky, 0, len(vybrane))
	for _, k := range vybrane {
		vysledek = append(vysledek, NahledFotky{ID: k.f.id, URL: adresaObrazku(k.f.drive), Album: k.a.al.nazev, Typ: k.a.al.typ, Hodnoceni: k.f.hodnoceni, Rotace: k.f.rotace})
	}
	return vysledek
}
