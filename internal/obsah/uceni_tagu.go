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
	"math"
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
	for _, t := range tagy {
		c := make([]float64, n)
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
		}
		cile[t.Klic] = c
	}
	vych := make([]map[string]bool, n)
	for i, pr := range pouzite {
		vych[i] = map[string]bool{}
		for _, x := range vychozi(pr.ID) {
			vych[i][x.Tag] = true
		}
	}

	// Křížové ověření: části podle pořadí příkladů (fotky téhož alba jsou v Průvodci za sebou → různé části by
	// sdílely focení; proto souvislé bloky, ne střídání)
	cast := func(i int) int { return i * castiUceni / n }
	predikce := map[string]map[float64][]float64{} // tag → λ → výstup na ověření
	for _, t := range tagy {
		predikce[t.Klic] = map[float64][]float64{}
		for _, l := range lambdyUceni {
			predikce[t.Klic][l] = make([]float64, n)
		}
	}
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
		for _, l := range lambdyUceni {
			ch := cholesky(X, uc, d, l)
			if ch == nil {
				continue
			}
			for _, t := range tagy {
				w := vyresit(ch, X, uc, cile[t.Klic], d)
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
	vsechny := make([]int, n)
	for i := range vsechny {
		vsechny[i] = i
	}
	plne := map[float64][]float64{}
	for _, t := range tagy {
		h := &HodnoceniTagu{Tag: t.Klic}
		c := cile[t.Klic]
		for _, y := range c {
			switch y {
			case 1:
				h.Ano++
			case 0:
				h.Ne++
			}
		}
		h.Vychozi = vyvazena(c, func(i int) bool { return vych[i][t.Klic] })
		if h.Ano >= minPrikladuUceni && h.Ne >= minPrikladuUceni {
			for _, l := range lambdyUceni {
				pr := predikce[t.Klic][l]
				if b := vyvazena(c, func(i int) bool { return pr[i] >= prahUceni }); b > h.Naucene || h.lambda == 0 {
					h.Naucene, h.lambda = b, l
				}
			}
			h.Pouzito = h.Naucene >= h.Vychozi+minZlepseniUceni
			if h.Pouzito {
				if plne[h.lambda] == nil {
					plne[h.lambda] = cholesky(X, vsechny, d, h.lambda)
				}
				h.vahy = vyresit(plne[h.lambda], X, vsechny, c, d)
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
	s := 0.0
	for k, v := range x {
		s += w[k] * v
	}
	return s
}

// Choleskyho rozklad XᵀX + λI (bez trestu posunu) nad vybranými řádky
func cholesky(X [][]float64, radky []int, d int, lambda float64) []float64 {
	a := make([]float64, d*d)
	for _, i := range radky {
		r := X[i]
		for q := range d {
			rq := r[q]
			if rq == 0 {
				continue
			}
			radek := a[q*d : q*d+q+1]
			for k := range radek {
				radek[k] += rq * r[k]
			}
		}
	}
	for q := 1; q < d; q++ {
		a[q*d+q] += lambda
	}
	a[0] += 1e-6
	for q := range d {
		for k := 0; k <= q; k++ {
			s := a[q*d+k]
			for l := range k {
				s -= a[q*d+l] * a[k*d+l]
			}
			if q == k {
				if s <= 0 {
					return nil
				}
				a[q*d+q] = math.Sqrt(s)
			} else {
				a[q*d+k] = s / a[k*d+k]
			}
		}
	}
	return a
}

// Řešení pro cíl y (jen řádky se známým cílem 0/1; neznámé se berou jako 0 – rozklad je společný pro všechny
// tagy, proto se neznámé nevynechávají; u výlučných skupin je fotka bez zodpovězené skupiny vzácná)
func vyresit(ch []float64, X [][]float64, radky []int, y []float64, d int) []float64 {
	if ch == nil {
		return nil
	}
	b := make([]float64, d)
	for _, i := range radky {
		if y[i] != 1 {
			continue
		}
		for k, v := range X[i] {
			b[k] += v
		}
	}
	z := make([]float64, d)
	for q := range d {
		s := b[q]
		for l := range q {
			s -= ch[q*d+l] * z[l]
		}
		z[q] = s / ch[q*d+q]
	}
	w := make([]float64, d)
	for q := d - 1; q >= 0; q-- {
		s := z[q]
		for l := q + 1; l < d; l++ {
			s -= ch[l*d+q] * w[l]
		}
		w[q] = s / ch[q*d+q]
	}
	return w
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
