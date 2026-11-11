package main

import (
	"fmt"
	"math"
	"slices"
	"sort"
	"sync"
)

// Učení modelu vkusu (hřebenová regrese + gradientní stromy, křížové ověření).

// Standardizovaný číselný údaj pro regresi (robustně, oříznutý na ±3)
func (v *modelVkusu) z(c int, x float64) float64 {
	return min(max((x-v.stredCis[c])/v.sdCis[c], -3), 3)
}

// Řídký řádek regrese
func (v *modelVkusu) radekHrebene(u udajeVkusu) []prvekVkusu {
	r := make([]prvekVkusu, 0, len(u.kat)+12)
	for _, k := range u.kat {
		if j, ok := v.index[k]; ok {
			r = append(r, prvekVkusu{j, 1})
		}
	}
	for j := v.hodnot; j < len(v.sloupce); j++ {
		s := &v.sloupce[j]
		ma, x := u.ma[s.c], u.cis[s.c]
		switch {
		case s.druh == slCislo && ma:
			r = append(r, prvekVkusu{j, v.z(s.c, x)})
		case s.druh == slKos && ma && x >= s.od && x < s.do:
			r = append(r, prvekVkusu{j, 1})
		}
	}
	return r
}

// Koše příznaků stromů (hodnota údaje: 1 nemá, 2 má; číselný: 0 chybí, 1… podle hranic)
func (v *modelVkusu) kosyStromu(u udajeVkusu) []uint8 {
	k := make([]uint8, len(v.stromove))
	for p, j := range v.stromove {
		s := &v.sloupce[j]
		switch {
		case s.druh == slHodnota:
			k[p] = 1
		case u.ma[s.c]:
			k[p] = kosHodnoty(v.hranice[s.c], u.cis[s.c])
		}
	}
	for _, kl := range u.kat {
		if j, ok := v.index[kl]; ok {
			k[j] = 2 // hodnoty údajů jsou první sloupce i první příznaky stromů
		}
	}
	return k
}

// Odhad regrese z řádku
func predikceHrebene(r []prvekVkusu, w, stred []float64, prumer float64) float64 {
	y := prumer
	for j := range stred {
		y -= w[j] * stred[j]
	}
	for _, a := range r {
		y += w[a.j] * a.x
	}
	return y
}

func oriznoutSrdicka(x float64) float64 { return min(max(x, 0.5), 5) }

// Rozmezí pětin číselného údaje z hodnot hodnocených (různé hranice, celé hodnoty u celých čísel)
func patinyUdaje(hodnoty []float64, c int) []float64 {
	s := append([]float64(nil), hodnoty...)
	sort.Float64s(s)
	var hranice []float64
	for k := 1; k < kosuHrebene; k++ {
		h := kvantil(s, float64(k)/kosuHrebene)
		if popisCisVkusu[c].desetiny == 0 {
			h = math.Round(h)
		}
		if h > s[0] && (len(hranice) == 0 || h > hranice[len(hranice)-1]) {
			hranice = append(hranice, h)
		}
	}
	return hranice
}

// oblibenost: cíl hodnocených modelek (chybí = srdíčka); udaje z pripravitUdajeVkusu (případně se skóre fotek)
func naucitVkus(modelky []Modelka, oblibenost map[int]float64, udaje map[int]udajeVkusu, nast nastaveniVkusu) *modelVkusu {
	v := &modelVkusu{udaje: udaje, odhady: map[int]float64{}, index: map[string]int{}}
	var hodnocene []int // indexy modelek
	podpora := map[string]int{}
	zapisy := map[string]map[string]int{}
	for i, m := range modelky {
		if m.Hodnoceni <= 0 {
			continue
		}
		u := udaje[m.ID]
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
	var klice []string
	for k, n := range podpora {
		if n >= minPodporaVkus && n < v.n {
			klice = append(klice, k)
		}
	}
	sort.Slice(klice, func(i, j int) bool {
		if podpora[klice[i]] != podpora[klice[j]] {
			return podpora[klice[i]] > podpora[klice[j]]
		}
		return klice[i] < klice[j]
	})
	for _, k := range klice[:min(len(klice), maxKategoriiVkus)] {
		// Nejčastější zápis hodnoty (při shodě abecedně první)
		nejlepsi, pocet := "", 0
		for z, n := range zapisy[k] {
			if n > pocet || (n == pocet && z < nejlepsi) {
				nejlepsi, pocet = z, n
			}
		}
		v.index[k] = len(v.sloupce)
		v.stromove = append(v.stromove, len(v.sloupce))
		v.sloupce = append(v.sloupce, sloupecVkusu{klic: k, popis: nejlepsi, druh: slHodnota})
	}
	v.hodnot = len(v.sloupce)
	// Číselné údaje z hodnocených (aspoň 10 hodnot, odvozené poměr hrudník/pas a věk aspoň minPodporaOdvozenych):
	// robustní střed a rozptyl, koše stromů a pětiny
	for c := range pocetCisVkusu {
		if (c == cvFotky && nast.fotky == fotkySkore) || (c == cvSkore && nast.fotky == fotkyPrumer) {
			continue
		}
		var hodnoty []float64
		for _, i := range hodnocene {
			if u := udaje[modelky[i].ID]; u.ma[c] {
				hodnoty = append(hodnoty, u.cis[c])
			}
		}
		if len(hodnoty) < 10 || ((c == cvHrudPas || c == cvVek) && len(hodnoty) < minPodporaOdvozenych) {
			continue
		}
		serazene := append([]float64(nil), hodnoty...)
		sort.Float64s(serazene)
		med := kvantil(serazene, 0.5)
		odchylky := make([]float64, len(serazene))
		prumer, rozptyl := 0.0, 0.0
		for i, x := range serazene {
			odchylky[i] = math.Abs(x - med)
			prumer += x
		}
		prumer /= float64(len(serazene))
		for _, x := range serazene {
			rozptyl += (x - prumer) * (x - prumer)
		}
		sort.Float64s(odchylky)
		sd := 1.4826 * kvantil(odchylky, 0.5)
		if sd < 1e-9 {
			sd = math.Sqrt(rozptyl / float64(len(serazene)))
		}
		if sd < 1e-9 {
			continue
		}
		v.stredCis[c], v.sdCis[c] = med, sd
		v.hranice[c] = hraniceKosu(hodnoty)
		klic := fmt.Sprintf("#%d", c)
		v.stromove = append(v.stromove, len(v.sloupce))
		v.sloupce = append(v.sloupce, sloupecVkusu{klic: klic, popis: popisCisVkusu[c].nazev, druh: slCislo, c: c})
		if nast.kose {
			hranice := append(append([]float64{math.Inf(-1)}, patinyUdaje(hodnoty, c)...), math.Inf(1))
			for k := 1; k < len(hranice); k++ {
				od, do := hranice[k-1], hranice[k]
				n := 0
				for _, x := range hodnoty {
					if x >= od && x < do {
						n++
					}
				}
				if n >= minPodporaVkus && n < len(hodnoty) {
					v.sloupce = append(v.sloupce, sloupecVkusu{klic: klic, popis: textKoseVkusu(c, od, do), druh: slKos, c: c, od: od, do: do})
				}
			}
		}
	}
	p := len(v.sloupce)

	// Řádky hodnocených, cíl a části křížového ověření
	n := len(hodnocene)
	radky := make([][]prvekVkusu, n)
	kosy := make([][]uint8, n)
	cil := make([]float64, n)
	srdicka := make([]float64, n)
	skupina := make([]int, n)
	for r, i := range hodnocene {
		m := modelky[i]
		u := udaje[m.ID]
		if nast.hreben {
			radky[r] = v.radekHrebene(u)
		}
		if nast.stromy {
			kosy[r] = v.kosyStromu(u)
		}
		cil[r] = oblibenost[m.ID]
		if cil[r] == 0 {
			cil[r] = m.Hodnoceni
		}
		srdicka[r] = m.Hodnoceni
		skupina[r] = int(uint32(m.ID)*2654435761>>8) % pocetSkupinCV
	}
	trenink := func(vynech int) []int {
		var t []int
		for r := range n {
			if skupina[r] != vynech {
				t = append(t, r)
			}
		}
		return t
	}
	// Chyba prostého průměru (průměr cíle trénovacích částí)
	zaklad := 0.0
	zakladR := make([]float64, n)
	for s := range pocetSkupinCV {
		t := trenink(s)
		if len(t) == 0 {
			continue
		}
		prumer := 0.0
		for _, r := range t {
			prumer += cil[r]
		}
		prumer /= float64(len(t))
		for r := range n {
			if skupina[r] == s {
				zakladR[r] = oriznoutSrdicka(prumer)
				zaklad += math.Abs(zakladR[r] - srdicka[r])
			}
		}
	}
	mae := func(odhady []float64) float64 {
		chyba := 0.0
		for r, o := range odhady {
			chyba += math.Abs(oriznoutSrdicka(o) - srdicka[r])
		}
		return chyba / float64(n)
	}

	// Regrese: Gramova matice a součty po částech, ověření pro každou λ
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
	var casti []*cast
	// Řešení pro trénovací data bez části vynech (−1 = všechna) pro každou λ: váhy (nil = nevyřešeno), průměry
	// sloupců a průměr cíle. Centrovaná soustava (XᵀX − n·x̄x̄ᵀ + λI)·w = Xᵀy − n·x̄·ȳ se sestaví jednou.
	resit := func(vynech int, lambdy []float64) (w [][]float64, stred []float64, prumer float64) {
		w = make([][]float64, len(lambdy))
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
			return w, nil, 0
		}
		nt := float64(t.n)
		prumer = t.sy / nt
		stred = make([]float64, p)
		for j := range p {
			stred[j] = t.soucet[j] / nt
		}
		b := make([]float64, p)
		for j := range p {
			for l := range p {
				t.gram[j][l] -= nt * stred[j] * stred[l]
			}
			b[j] = t.xy[j] - nt*stred[j]*prumer
		}
		for x, lambda := range lambdy {
			a := make([][]float64, p)
			for j := range p {
				a[j] = append([]float64(nil), t.gram[j]...)
				a[j][j] += lambda
			}
			w[x] = resitCholesky(a, append([]float64(nil), b...))
		}
		return w, stred, prumer
	}
	// Stromy souběžně s regresí: na každé části les s nejvýš maxStromu stromy, odhady ověření po každém stromu
	// (počet stromů s nejmenší chybou vybere ověření), a les ze všech hodnocených (pak se zkrátí)
	var data *dataStromu
	var odhadyStromy []float64
	var prubeh [][]float64 // odhad ověření po t+1 stromech
	var lesVse *lesVkusu
	var cekat sync.WaitGroup
	if nast.stromy {
		data = novaDataStromu(kosy, v.pocetKosu())
		prubeh = make([][]float64, maxStromu)
		for t := range prubeh {
			prubeh[t] = make([]float64, n)
		}
		cekat.Add(1)
		go func() {
			defer cekat.Done()
			kopie := *data
			kopie.Hg, kopie.Hn, kopie.Hg2, kopie.Hn2 = nil, nil, nil, nil
			lesVse = naucitLes(&kopie, cil, trenink(-1), maxStromu, 0, nil)
		}()
		for s := range pocetSkupinCV {
			t := trenink(s)
			if len(t) < 5 {
				continue
			}
			cekat.Add(1)
			go func() {
				defer cekat.Done()
				var overit []int
				for r := range n {
					if skupina[r] == s {
						overit = append(overit, r)
					}
				}
				// Vlastní kopie dat (pracovní histogramy); les přestane růst, když se chyba ověření části
				// trpelivostStromu stromů nezlepšila
				kopie := *data
				kopie.Hg, kopie.Hn, kopie.Hg2, kopie.Hn2 = nil, nil, nil, nil
				zaklad := 0.0
				for _, r := range t {
					zaklad += cil[r]
				}
				zaklad /= float64(len(t))
				odhad := make([]float64, n)
				nejlepsi, nejlepsiK, posledni := math.Inf(1), 0, 0
				naucitLes(&kopie, cil, t, maxStromu, int64(s+1), func(k int, strom stromVkusu) bool {
					chyba := 0.0
					for _, r := range overit {
						odhad[r] += strom[strom.List(data.Kosy[r])].Hodnota
						prubeh[k][r] = zaklad + odhad[r]
						chyba += math.Abs(oriznoutSrdicka(prubeh[k][r]) - srdicka[r])
					}
					if chyba < nejlepsi {
						nejlepsi, nejlepsiK = chyba, k
					}
					posledni = k
					return k-nejlepsiK < trpelivostStromu
				})
				for k := posledni + 1; k < maxStromu; k++ {
					for _, r := range overit {
						prubeh[k][r] = prubeh[posledni][r]
					}
				}
			}()
		}
	}

	var odhadyHreben []float64
	if nast.hreben {
		casti = make([]*cast, pocetSkupinCV)
		for i := range casti {
			casti[i] = novaCast()
		}
		for r := range n {
			c := casti[skupina[r]]
			radek := radky[r]
			for ia, a := range radek {
				c.soucet[a.j] += a.x
				c.xy[a.j] += a.x * cil[r]
				gRow := c.gram[a.j]
				for ib := 0; ib <= ia; ib++ {
					b := radek[ib]
					gRow[b.j] += a.x * b.x
				}
			}
			c.sy += cil[r]
			c.n++
		}
		// Symetrické doplnění horního trojúhelníku Gramovy matice
		for _, c := range casti {
			for j := range p {
				for l := 0; l < j; l++ {
					s := c.gram[j][l] + c.gram[l][j]
					c.gram[j][l] = s
					c.gram[l][j] = s
				}
			}
		}
		// Části souběžně, pro každou λ odhady ověření
		odhadyL := make([][]float64, len(lambdyVkusu))
		for x := range odhadyL {
			odhadyL[x] = make([]float64, n)
		}
		vyreseno := make([]bool, pocetSkupinCV*len(lambdyVkusu))
		var cekatHreben sync.WaitGroup
		for s := range pocetSkupinCV {
			cekatHreben.Add(1)
			go func() {
				defer cekatHreben.Done()
				w, stred, prumer := resit(s, lambdyVkusu)
				for x := range lambdyVkusu {
					if w[x] == nil {
						continue
					}
					vyreseno[s*len(lambdyVkusu)+x] = true
					for r := range n {
						if skupina[r] == s {
							odhadyL[x][r] = predikceHrebene(radky[r], w[x], stred, prumer)
						}
					}
				}
			}()
		}
		cekatHreben.Wait()
		nejlepsi := math.Inf(1)
		for x, lambda := range lambdyVkusu {
			ok := true
			for s := range pocetSkupinCV {
				ok = ok && vyreseno[s*len(lambdyVkusu)+x]
			}
			if chyba := mae(odhadyL[x]); ok && chyba < nejlepsi {
				nejlepsi, v.lambda, odhadyHreben = chyba, lambda, odhadyL[x]
			}
		}
	}
	if nast.stromy {
		cekat.Wait()
		nejlepsi := math.Inf(1)
		for k := range prubeh {
			if chyba := mae(prubeh[k]); chyba < nejlepsi-1e-9 {
				nejlepsi, v.pocetStromu, odhadyStromy = chyba, k+1, prubeh[k]
			}
		}
	}

	// Váha stromů v průměru
	var odhadyCV []float64
	switch {
	case odhadyHreben != nil && odhadyStromy != nil:
		vahy := vahyStromuVkusu
		if nast.vahaStromu >= 0 {
			vahy = []float64{nast.vahaStromu}
		}
		nejlepsi := math.Inf(1)
		for _, a := range vahy {
			odhady := make([]float64, n)
			for r := range n {
				odhady[r] = (1-a)*odhadyHreben[r] + a*odhadyStromy[r]
			}
			if chyba := mae(odhady); chyba < nejlepsi-1e-9 {
				nejlepsi, v.vahaStromu, odhadyCV = chyba, a, odhady
			}
		}
	case odhadyHreben != nil:
		odhadyCV = odhadyHreben
	case odhadyStromy != nil:
		odhadyCV, v.vahaStromu = odhadyStromy, 1
	default:
		return v
	}
	serazena := append([]float64(nil), srdicka...)
	sort.Float64s(serazena)
	v.prahVysokych = max(2.5, zaokrouhlitNaPul(kvantil(serazena, 0.5)))
	// Ověření na modelkách ze skupin podle bohatosti údajů: chyba, chyba průměru, přesnost a vysoké odhady
	type souhrnOvereni struct {
		n                       int
		chyba, zaklad, presnost float64
		vysokych, trefVysokych  int
	}
	overit := func(kose ...int) souhrnOvereni {
		var o souhrnOvereni
		for r, i := range hodnocene {
			if nast.jenTrenink[modelky[i].ID] || (kose != nil && !slices.Contains(kose, kosBohatosti(udaje[modelky[i].ID]))) {
				continue
			}
			o.n++
			o.chyba += math.Abs(oriznoutSrdicka(odhadyCV[r]) - srdicka[r])
			o.zaklad += math.Abs(zakladR[r] - srdicka[r])
			if math.Abs(oriznoutSrdicka(zaokrouhlitNaPul(odhadyCV[r]))-srdicka[r]) <= 0.5 {
				o.presnost++
			}
			if zaokrouhlitNaPul(odhadyCV[r]) >= v.prahVysokych {
				o.vysokych++
				if srdicka[r] >= v.prahVysokych {
					o.trefVysokych++
				}
			}
		}
		if o.n > 0 {
			o.chyba, o.zaklad, o.presnost = o.chyba/float64(o.n), o.zaklad/float64(o.n), o.presnost/float64(o.n)
		}
		return o
	}
	prosel := func(o souhrnOvereni) bool {
		return o.n >= minOverenychVkus && o.chyba <= podilZlepseni*o.zaklad && o.presnost >= minPresnostVkus
	}
	o := overit()
	// Vysoké odhady (pro „Mohlo by se ti líbit“) ze všech hodnocených
	v.vysokych, v.trefVysokych = o.vysokych, o.trefVysokych
	if v.vysokych > 0 {
		v.presnostVysokych = float64(v.trefVysokych) / float64(v.vysokych)
	}
	nalezen := prosel(o)
	if nast.poSkupinach {
		// Skupina se ukazuje, když v ní (s málo modelkami spolu s chudšími skupinami téhož druhu, pak s celým
		// druhem) odhady na ověření jasně překonají průměr. Souhrn ověření je ze všech ukázaných skupin.
		var ukazane []int
		for k := range pocetKosuBohatosti {
			fotky, uroven := k/3, k%3
			druh := []int{fotky * 3, fotky*3 + 1, fotky*3 + 2}
			for _, kose := range [][]int{{k}, druh[:uroven+1], druh} {
				if ok := overit(kose...); ok.n >= minOverenychVkus {
					v.chybaKose[k] = ok.chyba
					if prosel(ok) {
						v.ukazatKos[k] = true
						ukazane = append(ukazane, k)
					}
					break
				}
			}
		}
		nalezen = len(ukazane) > 0
		if nalezen {
			o = overit(ukazane...)
		}
	}
	v.chybaCV, v.chybaZaklad, v.presnost = o.chyba, o.zaklad, o.presnost
	v.platny = v.n >= minHodnocenychVkus && nalezen

	// Modely ze všech hodnocených
	for r := range n {
		v.prumer += cil[r]
	}
	v.prumer /= float64(n)
	if v.vahaStromu < 1 {
		w, stred, _ := resit(-1, []float64{v.lambda})
		if w[0] == nil {
			v.platny = false
			return v
		}
		v.w, v.stred = w[0], stred
	}
	if nast.stromy {
		// Les zůstane i s váhou 0: podle společných listů hledá podobné hodnocené modelky do důvodu
		v.les = &lesVkusu{Zaklad: lesVse.Zaklad, Stromy: lesVse.Stromy[:min(v.pocetStromu, len(lesVse.Stromy))]}
		v.hodnocene = make([]hodnocenaVkusu, 0, n)
		for r, i := range hodnocene {
			if !nast.jenTrenink[modelky[i].ID] {
				v.hodnocene = append(v.hodnocene, hodnocenaVkusu{id: modelky[i].ID, jmeno: modelky[i].Jmeno, srdicka: srdicka[r], listy: v.les.Listy(kosy[r])})
			}
		}
	}
	v.surove = make(map[int]float64, len(modelky))
	for _, m := range modelky {
		u := udaje[m.ID]
		odhad := oriznoutSrdicka(v.predikce(u))
		v.surove[m.ID] = odhad
		if v.platny && u.skupin >= minPokrytiVkus && maFotkyKOdhadu(u) && (!nast.poSkupinach || v.ukazatKos[kosBohatosti(u)]) {
			v.odhady[m.ID] = odhad
		}
	}
	return v
}

// Počty košů příznaků stromů
func (v *modelVkusu) pocetKosu() []int {
	pocty := make([]int, len(v.stromove))
	for p, j := range v.stromove {
		if s := v.sloupce[j]; s.druh == slHodnota {
			pocty[p] = 3
		} else {
			pocty[p] = 2 + len(v.hranice[s.c])
		}
	}
	return pocty
}

// Neoříznutý odhad hotového modelu
func (v *modelVkusu) predikce(u udajeVkusu) float64 {
	y := 0.0
	if v.vahaStromu < 1 {
		y += (1 - v.vahaStromu) * predikceHrebene(v.radekHrebene(u), v.w, v.stred, v.prumer)
	}
	if v.vahaStromu > 0 {
		y += v.vahaStromu * v.les.Predikce(v.kosyStromu(u), v.pocetStromu)
	}
	return y
}
