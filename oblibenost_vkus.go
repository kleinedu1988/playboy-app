package main

import (
	"fmt"
	"maps"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Model vkusu: odhad hodnocení nehodnocených modelek z jejich údajů (celkový popis v docs/UCENI.md, oddíl Model
// vkusu). Pořadí oblíbenosti, Bradley–Terry a výběr dvojic jsou v oblibenost.go, skóre fotek v oblibenost_fotky.go.

// Parametry modelu vkusu
const (
	minHodnocenychVkus  = 30  // z méně hodnocených modelek se vkus neodhaduje
	minHodnocenychCV    = 15  // od tolika se aspoň spočítá přesnost (pro přehled)
	minPodporaVkus      = 3   // hodnota údaje (blond, fotograf…) se počítá, když ji má aspoň tolik hodnocených modelek
	maxKategoriiVkus    = 150 // nejvíc hodnot údajů v modelu (nejčastější)
	pocetSkupinCV       = 5   // křížové ověření na pěti částech
	podilZlepseni       = 0.9 // odhad musí mít na ověření chybu nejvýš 90 % chyby prostého průměru
	minPresnostVkus     = 0.5 // a trefit hodnocení ± půl srdíčka aspoň u poloviny modelek
	minPokrytiVkus      = 4   // odhad jen u modelky, která má aspoň tolik skupin údajů
	minPresnostVysokych = 0.6 // „Mohlo by se ti líbit“: z vysokých odhadů na ověření musí sedět aspoň 60 %
)

var lambdyVkusu = []float64{0.5, 2, 8, 32}

// Nehodnocené modelky s nejvyšším jistým odhadem modelu vkusu (s důvodem); jen odhady aspoň na mediánu srdíček
// sbírky a jen když vysoké odhady na ověření opravdu sedí
func (a *App) GetMohloByTeLibit(pocet int) []OblibenostModelky {
	vysledek := []OblibenostModelky{}
	if a.uc == nil {
		return vysledek
	}
	pocet = min(max(pocet, 1), 200)
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	v := model.vkus
	if v == nil || !v.platny || (v.vysokych >= 5 && v.presnostVysokych < minPresnostVysokych) {
		return vysledek
	}
	type kandidatka struct {
		m      Modelka
		presny float64
	}
	var kandidatky []kandidatka
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			continue
		}
		if odhad, ok := model.odhad[m.ID]; ok && zaokrouhlitNaPul(odhad) >= v.prahVysokych {
			kandidatky = append(kandidatky, kandidatka{m, odhad})
		}
	}
	sort.SliceStable(kandidatky, func(i, j int) bool {
		if kandidatky[i].presny != kandidatky[j].presny {
			return kandidatky[i].presny > kandidatky[j].presny
		}
		return kandidatky[i].m.ID < kandidatky[j].m.ID
	})
	for i, k := range kandidatky[:min(pocet, len(kandidatky))] {
		odhad, duvod, _ := model.odhadModelky(k.m, true)
		if v.vysokych >= 5 {
			duvod += fmt.Sprintf(" (na ověření sedělo %d z %d podobně vysokých odhadů)", v.trefVysokych, v.vysokych)
		}
		vysledek = append(vysledek, OblibenostModelky{ModelkaID: k.m.ID, Jmeno: k.m.Jmeno, Odhad: odhad, Poradi: i + 1,
			Sila: zaokrouhlit3(k.presny), Nejistota: zaokrouhlit3(v.chybaCV), Porovnani: model.pocet[k.m.ID], Duvod: duvod})
	}
	return vysledek
}

// Model vkusu do modelu oblíbenosti: cíl ze srdíček upřesněných porovnáním (Bradley–Terry s předpokladem jen ze
// srdíček), učení obou variant údaje o fotkách a odhady platného modelu
func (model *modelOblibenosti) naucitModelVkusu(modelky []Modelka, porovnani []porovnaniZaznam, stredSrdicka, sigmaSrdicka map[int]float64, nyni time.Time) {
	// Model vkusu se učí na srdíčkách upřesněných porovnáním bez skóre fotek: fotky jsou mezi jeho údaji, v cíli by
	// se počítaly podruhé. Údaj o fotkách je průměr srdíček fotek, nebo skóre fotek, podle toho, co vyjde lépe na ověření.
	cil := map[int]float64{}
	if len(porovnani) > 0 {
		btSrdicka := spocitatBT(stredSrdicka, sigmaSrdicka, porovnani, nyni)
		for _, m := range modelky {
			if s, ok := btSrdicka.sila[m.ID]; ok && m.Hodnoceni > 0 {
				cil[m.ID] = m.Hodnoceni + min(max(s-m.Hodnoceni, -rozpetiCileVkusu), rozpetiCileVkusu)
			}
		}
	}
	udaje := pripravitUdajeVkusu(modelky)
	model.vkus = naucitVkus(modelky, cil, udaje)
	if v := model.vkus; len(model.skore) > 0 && v.chybaCV > 0 {
		udajeSkore := make(map[int]udajeVkusu, len(udaje))
		for id, u := range udaje {
			sf, ok := model.skore[id]
			u.cis[cvFotky], u.ma[cvFotky] = sf.skore, ok
			udajeSkore[id] = u
		}
		if s := naucitVkus(modelky, cil, udajeSkore); s.chybaCV > 0 && s.chybaCV < v.chybaCV-1e-9 {
			model.vkus, model.vkusZeSkore = s, true
		}
	}
	if v := model.vkus; v != nil && v.platny {
		maps.Copy(model.odhad, v.odhady)
	}
}

// ---------------------------------------------------------------------------------------------------------
// Model vkusu
//
// Hřebenová regrese oblíbenosti hodnocených modelek (srdíčka upřesněná porovnáním) na údaje modelky: hodnoty
// údajů jako 0/1 (etnicita, národnost, vlasy, oči, typ a košíček prsou, ochlupení, tetování, piercing, desetiletí
// prvního vydání, kategorie, fotografové alb), postava a průměr srdíček jejích fotek standardizované (chybějící
// = průměr). Hodnota údaje se počítá, když ji má aspoň minPodporaVkus hodnocených modelek (nejvýš maxKategoriiVkus
// nejčastějších). Síla penalizace λ se vybere křížovým ověřením na pěti částech (rozdělení podle čísla modelky,
// opakovatelné). Na ověření se měří chyba odhadu (průměrná odchylka od srdíček), chyba prostého průměru a přesnost
// (zaokrouhlený odhad do ± půl srdíčka). Odhady se ukazují, jen když je hodnocených aspoň minHodnocenychVkus, chyba
// je nejvýš podilZlepseni chyby průměru a přesnost aspoň minPresnostVkus; u modelky jen s aspoň minPokrytiVkus
// skupinami údajů. Důvod jsou nejsilnější příspěvky wⱼ·(xⱼ − x̄ⱼ) ve směru odhadu.

// Číselné údaje modelu vkusu
const (
	cvVyska = iota
	cvVaha
	cvHrudnik
	cvPas
	cvBoky
	cvBmi
	cvFotky
	pocetCisVkusu
)

var popisCisVkusu = [pocetCisVkusu]struct{ nazev, jednotka string }{
	{"výška", "cm"}, {"váha", "kg"}, {"hrudník", "cm"}, {"pas", "cm"}, {"boky", "cm"}, {"BMI", ""}, {"srdíčka jejích fotek", ""},
}

type udajeVkusu struct {
	kat    []string // klíče hodnot „vlasy=blond“
	zapisy []string // zápis hodnoty k důvodu (stejné pořadí)
	cis    [pocetCisVkusu]float64
	ma     [pocetCisVkusu]bool
	skupin int // počet skupin údajů, které modelka má
}

type modelVkusu struct {
	sloupce  []string // klíče hodnot údajů (pak číselné údaje)
	popisy   []string // zápis do důvodu
	index    map[string]int
	stredCis [pocetCisVkusu]float64
	sdCis    [pocetCisVkusu]float64
	maCis    [pocetCisVkusu]bool
	stred    []float64 // průměr sloupce v trénovacích datech
	w        []float64
	prumer   float64
	lambda   float64
	n        int

	chybaCV, chybaZaklad, presnost float64
	prahVysokych                   float64 // medián srdíček hodnocených: od něj je odhad „vysoký“
	vysokych, trefVysokych         int     // vysoké odhady na ověření a kolik z nich mělo srdíčka aspoň prahVysokych
	presnostVysokych               float64
	platny                         bool
	odhady                         map[int]float64 // odhad u modelek s dost údaji
	udaje                          map[int]udajeVkusu
}

// Košíček z velikosti prsou („34C“, „C“, „34 DD“)
var vzorKosicku = regexp.MustCompile(`^\s*\d*\s*([A-H]{1,4})\s*$`)

// Údaje modelky pro model vkusu; klic = mezipaměť zjednodušených textů (stejné hodnoty se opakují)
func udajeModelkyVkus(m Modelka, klic func(pole, text string) string) udajeVkusu {
	var u udajeVkusu
	pridat := func(skupina, hodnota, zapis string) {
		if hodnota == "" {
			return
		}
		k := skupina + "=" + hodnota
		for _, x := range u.kat {
			if x == k {
				return
			}
		}
		u.kat = append(u.kat, k)
		u.zapisy = append(u.zapisy, zapis)
	}
	skupiny := 0
	jednoducha := func(skupina, pole, text, predpona string) {
		if t := strings.TrimSpace(text); t != "" {
			pridat(skupina, klic(pole, t), predpona+t)
			skupiny++
		}
	}
	jednoducha("etnicita", "etnicita", m.Etnicita, "")
	jednoducha("narodnost", "narodnost", m.Narodnost, "")
	jednoducha("vlasy", "vlasy", m.VlasyBarva, "")
	jednoducha("oci", "oci", m.OciBarva, "oči: ")
	jednoducha("prsa", "prsa", m.PrsaTyp, "prsa: ")
	jednoducha("ochlupeni", "ochlupeni", m.Ochlupeni, "ochlupení: ")
	if k := vzorKosicku.FindStringSubmatch(strings.ToUpper(m.VelikostPrsou)); k != nil {
		kosicek := k[1]
		if len(kosicek) > 1 || kosicek > "D" {
			kosicek = "DD+"
		}
		pridat("kosicek", kosicek, "košíček "+kosicek)
	}
	if m.Tetovani == 1 || m.Tetovani == 0 || m.Piercing == 1 || m.Piercing == 0 {
		skupiny++
	}
	switch m.Tetovani {
	case 1:
		pridat("tetovani", "ano", "tetování")
	case 0:
		pridat("tetovani", "ne", "bez tetování")
	}
	switch m.Piercing {
	case 1:
		pridat("piercing", "ano", "piercing")
	case 0:
		pridat("piercing", "ne", "bez piercingu")
	}
	if rok := prvniRokModelky(m); rok > 0 {
		desetileti := rok / 10 * 10
		pridat("era", fmt.Sprint(desetileti), textDesetileti(desetileti))
		skupiny++
	}
	kategorie := strings.Split(m.Role, ",")
	if len(m.Centerfoldy) > 0 {
		kategorie = append(kategorie, "Playmate měsíce")
	}
	if m.CyberGirl != "" {
		kategorie = append(kategorie, "Cyber Girl "+m.CyberGirl)
	}
	if len(m.Obalky) > 0 {
		kategorie = append(kategorie, "Modelka obálky")
	}
	maKategorii := false
	for _, k := range kategorie {
		if k = strings.TrimSpace(k); k != "" {
			pridat("kategorie", klic("kategorie", k), k)
			maKategorii = true
		}
	}
	if maKategorii {
		skupiny++
	}
	maFotografa := false
	for _, f := range strings.Split(m.fotografoveAlb, "\n") {
		if f = strings.TrimSpace(f); f != "" {
			pridat("fotograf", klic("fotograf", f), f)
			maFotografa = true
		}
	}
	if maFotografa {
		skupiny++
	}
	postava := priznakyModelky(m)
	for j, cv := range map[int]int{prVyska: cvVyska, prVaha: cvVaha, prHrudnik: cvHrudnik, prPas: cvPas, prBoky: cvBoky, prBmi: cvBmi} {
		u.cis[cv], u.ma[cv] = postava.x[j], postava.ma[j]
	}
	if postava.ma[prVyska] || postava.ma[prVaha] || postava.ma[prHrudnik] {
		skupiny++
	}
	if m.fotekHodnocenych >= 2 {
		u.cis[cvFotky], u.ma[cvFotky] = float64(m.srdciFotek)/float64(m.fotekHodnocenych), true
		skupiny++
	}
	u.skupin = skupiny
	return u
}

// Rok prvního výskytu modelky (vydání, centerfold, online album); 0 = neznámý
func prvniRokModelky(m Modelka) int {
	prvni := 0
	for _, seznam := range [][]string{m.Vydani, m.Centerfoldy, m.OnlineAlba, m.Obalky} {
		for _, v := range seznam {
			if len(v) < 4 {
				continue
			}
			rok := 0
			if _, err := fmt.Sscanf(v[:4], "%d", &rok); err == nil && rok > 1900 && (prvni == 0 || rok < prvni) {
				prvni = rok
			}
		}
	}
	return prvni
}

// „70. léta“, „léta 2000–2009“
func textDesetileti(desetileti int) string {
	if desetileti >= 1900 && desetileti < 2000 {
		return fmt.Sprintf("%d. léta", desetileti-1900)
	}
	return fmt.Sprintf("léta %d–%d", desetileti, desetileti+9)
}

// Údaje všech modelek pro model vkusu (počítají se jednou pro obě varianty údaje o fotkách)
func pripravitUdajeVkusu(modelky []Modelka) map[int]udajeVkusu {
	pamet := map[string]string{}
	klic := func(pole, text string) string {
		k := pole + "\x00" + text
		if v, ok := pamet[k]; ok {
			return v
		}
		v := klicHodnoty(pole, text)
		pamet[k] = v
		return v
	}
	udaje := make(map[int]udajeVkusu, len(modelky))
	for _, m := range modelky {
		udaje[m.ID] = udajeModelkyVkus(m, klic)
	}
	return udaje
}

// oblibenost: cíl hodnocených modelek (chybí = srdíčka); udaje z pripravitUdajeVkusu
func naucitVkus(modelky []Modelka, oblibenost map[int]float64, udaje map[int]udajeVkusu) *modelVkusu {
	v := &modelVkusu{udaje: udaje, odhady: map[int]float64{}, index: map[string]int{}}
	var hodnocene []int // indexy modelek
	podpora := map[string]int{}
	zapisy := map[string]map[string]int{}
	for i, m := range modelky {
		u := udaje[m.ID]
		if m.Hodnoceni <= 0 {
			continue
		}
		hodnocene = append(hodnocene, i)
		for x, k := range u.kat {
			podpora[k]++
			if zapisy[k] == nil {
				zapisy[k] = map[string]int{}
			}
			zapisy[k][u.zapisy[x]]++
		}
	}
	v.n = len(hodnocene)
	if v.n < minHodnocenychCV {
		return v
	}
	// Hodnoty údajů s dost modelkami, nejčastější napřed
	for k, n := range podpora {
		if n >= minPodporaVkus && n < v.n {
			v.sloupce = append(v.sloupce, k)
		}
	}
	sort.Slice(v.sloupce, func(i, j int) bool {
		if podpora[v.sloupce[i]] != podpora[v.sloupce[j]] {
			return podpora[v.sloupce[i]] > podpora[v.sloupce[j]]
		}
		return v.sloupce[i] < v.sloupce[j]
	})
	v.sloupce = v.sloupce[:min(len(v.sloupce), maxKategoriiVkus)]
	for _, k := range v.sloupce {
		// Nejčastější zápis hodnoty (při shodě abecedně první)
		nejlepsi, pocet := "", 0
		for z, n := range zapisy[k] {
			if n > pocet || (n == pocet && z < nejlepsi) {
				nejlepsi, pocet = z, n
			}
		}
		v.popisy = append(v.popisy, nejlepsi)
	}
	// Číselné údaje: průměr a směrodatná odchylka z hodnocených (aspoň 10 hodnot)
	for c := range pocetCisVkusu {
		var hodnoty []float64
		for _, i := range hodnocene {
			if u := v.udaje[modelky[i].ID]; u.ma[c] {
				hodnoty = append(hodnoty, u.cis[c])
			}
		}
		if len(hodnoty) < 10 {
			continue
		}
		prumer, rozptyl := 0.0, 0.0
		for _, x := range hodnoty {
			prumer += x
		}
		prumer /= float64(len(hodnoty))
		for _, x := range hodnoty {
			rozptyl += (x - prumer) * (x - prumer)
		}
		sd := math.Sqrt(rozptyl / float64(len(hodnoty)))
		if sd < 1e-9 {
			continue
		}
		v.stredCis[c], v.sdCis[c], v.maCis[c] = prumer, sd, true
		v.sloupce = append(v.sloupce, fmt.Sprintf("#%d", c))
		v.popisy = append(v.popisy, popisCisVkusu[c].nazev)
	}
	for j, k := range v.sloupce {
		v.index[k] = j
	}
	p := len(v.sloupce)

	// Řídké řádky hodnocených modelek; Gramova matice a součty po částech křížového ověření
	type prvek struct {
		j int
		x float64
	}
	radek := func(m Modelka) []prvek {
		u := v.udaje[m.ID]
		var r []prvek
		for _, k := range u.kat {
			if j, ok := v.index[k]; ok {
				r = append(r, prvek{j, 1})
			}
		}
		for c := range pocetCisVkusu {
			if v.maCis[c] && u.ma[c] {
				r = append(r, prvek{v.index[fmt.Sprintf("#%d", c)], (u.cis[c] - v.stredCis[c]) / v.sdCis[c]})
			}
		}
		return r
	}
	type cast struct {
		gram   [][]float64
		soucet []float64 // Σ x
		xy     []float64 // Σ x·y
		sy     float64
		n      int
	}
	novaCast := func() *cast {
		c := &cast{gram: make([][]float64, p), soucet: make([]float64, p), xy: make([]float64, p)}
		for j := range c.gram {
			c.gram[j] = make([]float64, p)
		}
		return c
	}
	casti := make([]*cast, pocetSkupinCV)
	for i := range casti {
		casti[i] = novaCast()
	}
	radky := make([][]prvek, len(hodnocene))
	cil := make([]float64, len(hodnocene))
	skupina := make([]int, len(hodnocene))
	for r, i := range hodnocene {
		m := modelky[i]
		radky[r] = radek(m)
		cil[r] = oblibenost[m.ID]
		if cil[r] == 0 {
			cil[r] = m.Hodnoceni
		}
		skupina[r] = int(uint32(m.ID)*2654435761>>8) % pocetSkupinCV
		c := casti[skupina[r]]
		for _, a := range radky[r] {
			c.soucet[a.j] += a.x
			c.xy[a.j] += a.x * cil[r]
			for _, b := range radky[r] {
				c.gram[a.j][b.j] += a.x * b.x
			}
		}
		c.sy += cil[r]
		c.n++
	}
	// Řešení pro trénovací data bez části vynech (-1 = všechna): w a průměry sloupců
	resit := func(vynech int, lambda float64) (w, stred []float64, prumer float64, ok bool) {
		t := novaCast()
		for s, c := range casti {
			if s == vynech {
				continue
			}
			for j := range p {
				t.soucet[j] += c.soucet[j]
				t.xy[j] += c.xy[j]
				for l := range p {
					t.gram[j][l] += c.gram[j][l]
				}
			}
			t.sy += c.sy
			t.n += c.n
		}
		if t.n < 5 {
			return nil, nil, 0, false
		}
		n := float64(t.n)
		prumer = t.sy / n
		stred = make([]float64, p)
		for j := range p {
			stred[j] = t.soucet[j] / n
		}
		// Centrovaná soustava (XᵀX − n·x̄x̄ᵀ + λI)·w = Xᵀy − n·x̄·ȳ
		a := make([][]float64, p)
		b := make([]float64, p)
		for j := range p {
			a[j] = make([]float64, p)
			for l := range p {
				a[j][l] = t.gram[j][l] - n*stred[j]*stred[l]
			}
			a[j][j] += lambda
			b[j] = t.xy[j] - n*stred[j]*prumer
		}
		w = resitCholesky(a, b)
		if w == nil {
			return nil, nil, 0, false
		}
		return w, stred, prumer, true
	}
	predikce := func(r []prvek, w, stred []float64, prumer float64) float64 {
		y := prumer
		for j := range stred {
			y -= w[j] * stred[j]
		}
		for _, a := range r {
			y += w[a.j] * a.x
		}
		return y
	}
	// Křížové ověření pro každou λ
	type overeni struct{ chyba, zaklad, presnost float64 }
	overit := func(lambda float64) (overeni, []float64, bool) {
		var o overeni
		odhady := make([]float64, len(radky))
		for s := range pocetSkupinCV {
			w, stred, prumer, ok := resit(s, lambda)
			if !ok {
				return o, nil, false
			}
			for r := range radky {
				if skupina[r] != s {
					continue
				}
				h := modelky[hodnocene[r]].Hodnoceni
				odhady[r] = predikce(radky[r], w, stred, prumer)
				o.chyba += math.Abs(odhady[r] - h)
				o.zaklad += math.Abs(prumer - h)
				if math.Abs(min(max(zaokrouhlitNaPul(odhady[r]), 0.5), 5)-h) <= 0.5 {
					o.presnost++
				}
			}
		}
		n := float64(len(radky))
		return overeni{o.chyba / n, o.zaklad / n, o.presnost / n}, odhady, true
	}
	nejlepsi, nejlepsiLambda := overeni{chyba: math.Inf(1)}, 0.0
	var odhadyCV []float64
	for _, lambda := range lambdyVkusu {
		if o, odhady, ok := overit(lambda); ok && o.chyba < nejlepsi.chyba {
			nejlepsi, nejlepsiLambda, odhadyCV = o, lambda, odhady
		}
	}
	if odhadyCV == nil {
		return v
	}
	v.chybaCV, v.chybaZaklad, v.presnost, v.lambda = nejlepsi.chyba, nejlepsi.zaklad, nejlepsi.presnost, nejlepsiLambda
	// Vysoké odhady na ověření: od mediánu srdíček hodnocených
	srdicka := make([]float64, len(hodnocene))
	for r, i := range hodnocene {
		srdicka[r] = modelky[i].Hodnoceni
	}
	sort.Float64s(srdicka)
	v.prahVysokych = max(2.5, zaokrouhlitNaPul(kvantil(srdicka, 0.5)))
	for r, i := range hodnocene {
		if zaokrouhlitNaPul(odhadyCV[r]) >= v.prahVysokych {
			v.vysokych++
			if modelky[i].Hodnoceni >= v.prahVysokych {
				v.trefVysokych++
			}
		}
	}
	if v.vysokych > 0 {
		v.presnostVysokych = float64(v.trefVysokych) / float64(v.vysokych)
	}
	v.platny = v.n >= minHodnocenychVkus && v.chybaCV <= podilZlepseni*v.chybaZaklad && v.presnost >= minPresnostVkus
	w, stred, prumer, ok := resit(-1, nejlepsiLambda)
	if !ok {
		v.platny = false
		return v
	}
	v.w, v.stred, v.prumer = w, stred, prumer
	if !v.platny {
		return v
	}
	for _, m := range modelky {
		u := v.udaje[m.ID]
		if u.skupin < minPokrytiVkus {
			continue
		}
		v.odhady[m.ID] = min(max(predikce(radek(m), w, stred, prumer), 0.5), 5)
	}
	return v
}

// Příspěvky údajů modelky k odhadu (wⱼ·(xⱼ − x̄ⱼ)) jako text: nejsilnější tři ve směru odchylky od průměru
func (v *modelVkusu) duvodOdhadu(id int, odhad float64) string {
	u := v.udaje[id]
	type prispevek struct {
		popis string
		c     float64
	}
	var prispevky []prispevek
	pritomne := map[int]bool{}
	for _, k := range u.kat {
		if j, ok := v.index[k]; ok {
			pritomne[j] = true
			prispevky = append(prispevky, prispevek{v.popisy[j], v.w[j] * (1 - v.stred[j])})
		}
	}
	for c := range pocetCisVkusu {
		if !v.maCis[c] || !u.ma[c] {
			continue
		}
		j := v.index[fmt.Sprintf("#%d", c)]
		z := (u.cis[c] - v.stredCis[c]) / v.sdCis[c]
		popis := popisCisVkusu[c].nazev + " " + strings.Replace(fmt.Sprintf("%.3g", u.cis[c]), ".", ",", 1)
		if popisCisVkusu[c].jednotka != "" {
			popis = fmt.Sprintf("%s %d %s", popisCisVkusu[c].nazev, int(math.Round(u.cis[c])), popisCisVkusu[c].jednotka)
		}
		prispevky = append(prispevky, prispevek{popis, v.w[j] * (z - v.stred[j])})
	}
	smer := 1.0
	if odhad < v.prumer {
		smer = -1
	}
	sort.SliceStable(prispevky, func(i, j int) bool { return prispevky[i].c*smer > prispevky[j].c*smer })
	var casti []string
	for _, p := range prispevky {
		if p.c*smer < 0.05 || len(casti) == 3 {
			break
		}
		casti = append(casti, p.popis)
	}
	return strings.Join(casti, ", ")
}

// Odhad hodnocení modelky po polovinách s důvodem; ok = false bez platného modelu nebo s málo údaji.
// sDuvodem = false vynechá text (rychlejší).
func (m *modelOblibenosti) odhadModelky(x Modelka, sDuvodem bool) (float64, string, bool) {
	odhad, ok := m.odhad[x.ID]
	if !ok || m.vkus == nil {
		return 0, "", false
	}
	zaokrouhleny := zaokrouhlitNaPul(odhad)
	duvod := "Odhad " + textSrdicek(zaokrouhleny)
	if sDuvodem {
		if d := m.vkus.duvodOdhadu(x.ID, odhad); d != "" {
			duvod += ": " + d
		}
	}
	return zaokrouhleny, duvod, true
}
