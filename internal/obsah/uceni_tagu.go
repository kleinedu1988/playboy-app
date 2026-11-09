package obsah

// Učení tagů z voleb v Průvodci: fotky, které uživatel v Průvodci prošel, jsou příklady – v zodpovězené skupině je
// zvolený tag „ano“ a ostatní tagy skupiny „ne“. Nad příznaky z obrazových modelů (vektor CLIP a jistoty detektoru,
// stejně jako odhad srdíček) se pro každý tag naučí lineární klasifikátor (hřebenová regrese na 0/1; jedna
// matice XᵀX pro všechny tagy, takže učení trvá zlomek sekundy). Samotné modely CLIP a NudeNet se nemění.
//
// Naučený tag nahradí výchozí návrh (zero-shot CLIP, pravidla detektoru) jen tehdy, když na křížovém ověření
// (5 částí) rozhoduje lépe: vyvážená přesnost (průměr podílu poznaných „ano“ a poznaných „ne“) aspoň o
// minZlepseniUceni vyšší než výchozí návrhy na týchž fotkách a aspoň minPrikladuUceni příkladů „ano“ i „ne“.
// S přibývajícími fotkami z Průvodce tak program přechází tag po tagu na to, jak taguje uživatel.

import (
	"sort"
	"sync"
)

const (
	minPrikladuUceni = 5    // příkladů „ano“ i „ne“, než se tag učí
	minZlepseniUceni = 0.02 // o kolik musí naučený tag rozhodovat lépe než výchozí návrh (vyvážená přesnost)
	castiUceni       = 5
	prahUceni        = 0.5 // naučený tag se navrhne od této hodnoty výstupu (0/1 regrese)
)

// Síly hřebene, ze kterých ověření vybere pro každý tag
var lambdyUceni = []float64{3, 30, 300}

// Příklad z Průvodce: fotka, zodpovězené skupiny katalogu a její tagy
type PrikladTagu struct {
	ID      string
	Skupiny []string
	Tagy    []string
}

// Tag pro učení: klíč a skupina katalogu
type TagUceni struct {
	Klic, Skupina string
	Vylucna       bool
}

// Výsledek ověření jednoho tagu
type HodnoceniTagu struct {
	Tag     string  `json:"tag"`
	Ano     int     `json:"ano"`     // příkladů s tagem
	Ne      int     `json:"ne"`      // příkladů bez tagu (skupina zodpovězená)
	Naucene float64 `json:"naucene"` // vyvážená přesnost naučeného na ověření
	Vychozi float64 `json:"vychozi"` // vyvážená přesnost výchozích návrhů na týchž fotkách
	Pouzito bool    `json:"pouzito"` // naučený nahrazuje výchozí návrh
	lambda  float64
	vahy    []float64
}

// Naučené tagy
type UceniTagu struct {
	Fotek  int             `json:"fotek"` // příkladů s obsahem
	Tagy   []HodnoceniTagu `json:"tagy"`
	otisk  uint64
	podle  map[string]*HodnoceniTagu
	skupin map[string]TagUceni
	p      priznaky
}

var (
	uceniMu       sync.Mutex
	posledniUceni *UceniTagu
)

// NaucitTagy z příkladů; vychozi = výchozí návrhy pro fotku (pro srovnání na ověření). Bez obsahu nil.
func (s *Sluzba) NaucitTagy(priklady []PrikladTagu, tagy []TagUceni, vychozi func(id string) []NavrhTagu) *UceniTagu {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	v, pa := s.vektory, s.partie
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	return naucitTagy(v, pa, priklady, tagy, vychozi)
}

func naucitTagy(v *Vektory, pa *Partie, priklady []PrikladTagu, tagy []TagUceni, vychozi func(id string) []NavrhTagu) *UceniTagu {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if pa != nil {
		pa.mu.RLock()
		defer pa.mu.RUnlock()
		if len(pa.m) < len(v.ids)/2 {
			pa = nil
		}
	}
	p := priznaky{v, pa}
	d := p.rozmer()

	// Příklady s obsahem; otisk pro paměť
	var X [][]float64
	var pouzite []PrikladTagu
	otisk := uint64(14695981039346656037)
	pridat := func(x uint64) { otisk = (otisk ^ x) * 1099511628211 }
	pridat(uint64(len(v.ids))<<20 | uint64(d))
	for _, pr := range priklady {
		r := make([]float64, d)
		if !p.radek(pr.ID, r) {
			continue
		}
		X = append(X, r)
		pouzite = append(pouzite, pr)
		pridat(uint64(v.index[pr.ID]))
		for _, t := range pr.Tagy {
			for _, z := range t {
				pridat(uint64(z))
			}
		}
		pridat(uint64(len(pr.Skupiny)))
	}
	uceniMu.Lock()
	defer uceniMu.Unlock()
	if posledniUceni != nil && posledniUceni.otisk == otisk {
		posledniUceni.p = p
		return posledniUceni
	}
	u := &UceniTagu{Fotek: len(pouzite), otisk: otisk, podle: map[string]*HodnoceniTagu{}, skupin: map[string]TagUceni{}, p: p}
	for _, t := range tagy {
		u.skupin[t.Klic] = t
	}
	n := len(pouzite)
	if n == 0 {
		posledniUceni = u
		return u
	}

	// Cíle: 1 = tag, 0 = skupina zodpovězená bez tagu, -1 = nevíme (skupina nezodpovězená)
	cile := map[string][]float64{}
	vhodne := map[string]bool{}
	poctyAno := map[string]int{}
	poctyNe := map[string]int{}
	for _, t := range tagy {
		c := make([]float64, n)
		var ano, ne int
		for i, pr := range pouzite {
			c[i] = -1
			for _, s := range pr.Skupiny {
				if s == t.Skupina {
					c[i] = 0
				}
			}
			for _, x := range pr.Tagy {
				if x == t.Klic {
					c[i] = 1
				}
			}
			switch c[i] {
			case 1:
				ano++
			case 0:
				ne++
			}
		}
		cile[t.Klic] = c
		poctyAno[t.Klic] = ano
		poctyNe[t.Klic] = ne
		if ano >= minPrikladuUceni && ne >= minPrikladuUceni {
			vhodne[t.Klic] = true
		}
	}
	vych := make([]map[string]bool, n)
	var vBuf [Rozmer]float32
	var pBuf [TridDetektoru]float32
	for i, pr := range pouzite {
		vych[i] = map[string]bool{}
		var navrhy []NavrhTagu
		if vychozi != nil {
			navrhy = vychozi(pr.ID)
		} else {
			var vs, ps []float32
			if idx, ok := v.index[pr.ID]; ok {
				m := v.meritka[idx]
				for k, q := range v.data[idx*Rozmer : (idx+1)*Rozmer] {
					vBuf[k] = float32(q) * m
				}
				vs = vBuf[:]
			}
			if pa != nil {
				if b, ok := pa.m[pr.ID]; ok {
					for k, q := range b {
						pBuf[k] = float32(q) / 255
					}
					ps = pBuf[:]
				}
			}
			navrhy = NavrhnoutTagy(vs, ps)
		}
		for _, x := range navrhy {
			vych[i][x.Tag] = true
		}
	}

	// Křížové ověření: části podle pořadí příkladů (fotky téhož alba jsou v Průvodci za sebou → různé části by
	// sdílely focení; proto souvislé bloky, ne střídání).
	// Místo 15–18× opakovaného skládání XᵀX přes příklady spočítáme XᵀX jednou pro každou z 5 částí, součtem
	// získáme plnou matici XᵀX a pro trénovací část c jen odečteme část c.
	cast := func(i int) int { return i * castiUceni / n }
	var castXtX [castiUceni][]float64
	plnaXtX := make([]float64, d*d)
	if len(vhodne) > 0 {
		for c := range castiUceni {
			castXtX[c] = make([]float64, d*d)
		}
		for i, r := range X {
			mat := castXtX[cast(i)]
			for q := range d {
				rq := r[q]
				if rq == 0 {
					continue
				}
				radek := mat[q*d : q*d+q+1]
				for k := range radek {
					radek[k] += rq * r[k]
				}
			}
		}
		for c := range castiUceni {
			for j, val := range castXtX[c] {
				plnaXtX[j] += val
			}
		}
	}

	predikce := map[string]map[float64][]float64{} // tag → λ → výstup na ověření
	for _, t := range tagy {
		if !vhodne[t.Klic] {
			continue
		}
		predikce[t.Klic] = map[float64][]float64{}
		for _, l := range lambdyUceni {
			predikce[t.Klic][l] = make([]float64, n)
		}
	}
	if len(vhodne) > 0 {
		ucXtX := make([]float64, d*d)
		for c := range castiUceni {
			var uc []int
			for i := range n {
				if cast(i) != c {
					uc = append(uc, i)
				}
			}
			if len(uc) == 0 {
				continue
			}
			for j := range plnaXtX {
				ucXtX[j] = plnaXtX[j] - castXtX[c][j]
			}
			// Pravé strany X_ucᵀ y pro vhodné tagy spočítáme jednou pro danou část c (nezávisí na λ)
			praveStrany := map[string][]float64{}
			for _, t := range tagy {
				if !vhodne[t.Klic] {
					continue
				}
				praveStrany[t.Klic] = pravaStrana(X, uc, cile[t.Klic], d)
			}
			for _, l := range lambdyUceni {
				ch := choleskyZMatice(ucXtX, d, l)
				if ch == nil {
					continue
				}
				for _, t := range tagy {
					if !vhodne[t.Klic] {
						continue
					}
					w := vyresitCholesky(ch, praveStrany[t.Klic], d)
					if w == nil {
						continue
					}
					for i := range n {
						if cast(i) == c {
							predikce[t.Klic][l][i] = skalar(w, X[i])
						}
					}
				}
			}
		}
	}
	vsechny := make([]int, n)
	for i := range vsechny {
		vsechny[i] = i
	}
	plne := map[float64][]float64{}
	for _, t := range tagy {
		h := &HodnoceniTagu{Tag: t.Klic, Ano: poctyAno[t.Klic], Ne: poctyNe[t.Klic]}
		c := cile[t.Klic]
		h.Vychozi = vyvazena(c, func(i int) bool { return vych[i][t.Klic] })
		if vhodne[t.Klic] {
			for _, l := range lambdyUceni {
				pr := predikce[t.Klic][l]
				if b := vyvazena(c, func(i int) bool { return pr[i] >= prahUceni }); b > h.Naucene || h.lambda == 0 {
					h.Naucene, h.lambda = b, l
				}
			}
			h.Pouzito = h.Naucene >= h.Vychozi+minZlepseniUceni
			if h.Pouzito {
				if plne[h.lambda] == nil {
					plne[h.lambda] = choleskyZMatice(plnaXtX, d, h.lambda)
				}
				h.vahy = vyresitCholesky(plne[h.lambda], pravaStrana(X, vsechny, c, d), d)
				h.Pouzito = h.vahy != nil
			}
		}
		u.Tagy = append(u.Tagy, *h)
	}
	for i := range u.Tagy {
		u.podle[u.Tagy[i].Tag] = &u.Tagy[i]
	}
	posledniUceni = u
	return u
}

// Vyvážená přesnost rozhodnutí na příkladech se známým cílem (0/1): průměr podílu poznaných „ano“ a „ne“
func vyvazena(c []float64, ano func(i int) bool) float64 {
	var tp, p, tn, nn float64
	for i, y := range c {
		switch y {
		case 1:
			p++
			if ano(i) {
				tp++
			}
		case 0:
			nn++
			if !ano(i) {
				tn++
			}
		}
	}
	if p == 0 || nn == 0 {
		return 0
	}
	return (tp/p + tn/nn) / 2
}

func skalar(w, x []float64) float64 {
	var s0, s1, s2, s3 float64
	n := len(x)
	k := 0
	for ; k+3 < n; k += 4 {
		s0 += w[k] * x[k]
		s1 += w[k+1] * x[k+1]
		s2 += w[k+2] * x[k+2]
		s3 += w[k+3] * x[k+3]
	}
	s := (s0 + s1) + (s2 + s3)
	for ; k < n; k++ {
		s += w[k] * x[k]
	}
	return s
}

// Choleskyho rozklad předpočítané matice XᵀX + λI (bez trestu posunu)
func choleskyZMatice(xtx []float64, d int, lambda float64) []float64 {
	a := make([]float64, len(xtx))
	copy(a, xtx)
	if !rozlozitCholeskyV(a, d, lambda, 1e-6) {
		return nil
	}
	return a
}

// Pravá strana Xᵀy pro cíl y (jen řádky se známým cílem 1; ostatní jsou 0)
func pravaStrana(X [][]float64, radky []int, y []float64, d int) []float64 {
	b := make([]float64, d)
	for _, i := range radky {
		if y[i] != 1 {
			continue
		}
		for k, v := range X[i] {
			b[k] += v
		}
	}
	return b
}

// Upravit výchozí návrhy fotky podle naučených tagů: naučený tag rozhodne sám (navrhne, nebo návrh zruší);
// ve výlučné skupině zůstane jen nejjistější návrh
func (u *UceniTagu) Upravit(id string, navrhy []NavrhTagu) []NavrhTagu {
	if u == nil || len(u.podle) == 0 {
		return navrhy
	}
	pouzite := false
	for _, h := range u.podle {
		if h.Pouzito {
			pouzite = true
			break
		}
	}
	if !pouzite {
		return navrhy
	}
	u.p.v.mu.RLock()
	defer u.p.v.mu.RUnlock()
	if u.p.pa != nil {
		u.p.pa.mu.RLock()
		defer u.p.pa.mu.RUnlock()
	}
	r := make([]float64, u.p.rozmer())
	if !u.p.radek(id, r) {
		return navrhy
	}
	var v []NavrhTagu
	for _, n := range navrhy {
		if h := u.podle[n.Tag]; h == nil || !h.Pouzito {
			v = append(v, n)
		}
	}
	for _, h := range u.podle {
		if !h.Pouzito {
			continue
		}
		if x := skalar(h.vahy, r); x >= prahUceni {
			v = append(v, NavrhTagu{Tag: h.Tag, Jistota: float32(min(x, 1)), Naucene: true})
		}
	}
	sort.SliceStable(v, func(i, j int) bool { return v[i].Jistota > v[j].Jistota })
	videne := map[string]bool{}
	k := 0
	for _, n := range v {
		if t, ok := u.skupin[n.Tag]; ok && t.Vylucna {
			if videne[t.Skupina] {
				continue
			}
			videne[t.Skupina] = true
		}
		v[k] = n
		k++
	}
	return v[:k]
}

// Pouzito: kolik tagů už rozhoduje podle uživatele
func (u *UceniTagu) Pouzito() int {
	if u == nil {
		return 0
	}
	n := 0
	for _, h := range u.Tagy {
		if h.Pouzito {
			n++
		}
	}
	return n
}
