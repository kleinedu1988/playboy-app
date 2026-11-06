package obsah

// Odhad srdíček nehodnocených fotek z obsahu: hřebenová regrese nad vektory hodnocených fotek (co je na fotkách,
// které hodnotíš výš) a doladění podle ostatních hodnocených fotek téhož alba (o kolik je album lepší, než by
// řekl obsah). Na vzorku sbírky (6. 11. 2026, docs/MODEL-CLIP-B32.md oddíl 7) seřadil fotky podle srdíček líp
// než průměr alba: Spearman 0,46 proti 0,34. Odhad je na řazení („nejdřív, co se ti asi bude líbit“), ne na
// přesné číslo.

import (
	"math"
	"sync"
)

// Od kolika hodnocených fotek s vektorem se odhaduje
const minHodnocenychFotek = 200

// Síla hřebene (zvolená křížovým ověřením na vzorku sbírky)
const lambdaOdhadu = 100

// Smrštění odchylky alba: odchylka se počítá, jako by album mělo o tolik fotek s nulovou odchylkou víc
const smrsteniAlba = 3

// Měřítko vstupu regrese (složky vektoru délky 1 jsou kolem ±0,05)
const meritkoVstupu = 10

// Fotka pro odhad: ID souboru, album a srdíčka (0 = nehodnocená)
type HodnoceniFotky struct {
	ID        string
	Album     int64
	Hodnoceni float64
}

// Naučený odhad (váhy) pro jeden stav hodnocení
type odhadSrdicek struct {
	otisk uint64
	vahy  []float64
}

var (
	odhadMu       sync.Mutex
	posledniOdhad *odhadSrdicek
)

// OdhadyFotek: odhad srdíček (1–5) pro nehodnocené fotky s vektorem; nil, když je hodnocených fotek s vektorem
// málo. Model se učí znovu jen po změně hodnocení nebo vektorů.
func (s *Sluzba) OdhadyFotek(fotky []HodnoceniFotky) map[string]float64 {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	return v.OdhadyFotek(fotky)
}

func (v *Vektory) OdhadyFotek(fotky []HodnoceniFotky) map[string]float64 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	var hodnocene []int // indexy do fotky
	otisk := uint64(14695981039346656037)
	pridat := func(x uint64) { otisk = (otisk ^ x) * 1099511628211 }
	pridat(uint64(len(v.ids)))
	for i, f := range fotky {
		if f.Hodnoceni <= 0 {
			continue
		}
		if _, ok := v.index[f.ID]; ok {
			hodnocene = append(hodnocene, i)
			pridat(uint64(v.index[f.ID])<<8 | uint64(f.Hodnoceni*2))
		}
	}
	if len(hodnocene) < minHodnocenychFotek {
		return nil
	}

	odhadMu.Lock()
	o := posledniOdhad
	if o == nil || o.otisk != otisk {
		o = &odhadSrdicek{otisk: otisk, vahy: v.naucit(fotky, hodnocene)}
		posledniOdhad = o
	}
	odhadMu.Unlock()
	if o.vahy == nil {
		return nil
	}

	// Odchylka alba: průměrný rozdíl skutečných a odhadnutých srdíček hodnocených fotek alba
	type odchylka struct{ soucet, pocet float64 }
	alba := map[int64]*odchylka{}
	for _, i := range hodnocene {
		f := fotky[i]
		a := alba[f.Album]
		if a == nil {
			a = &odchylka{}
			alba[f.Album] = a
		}
		a.soucet += f.Hodnoceni - v.predikce(o.vahy, v.index[f.ID])
		a.pocet++
	}
	vysledek := map[string]float64{}
	for _, f := range fotky {
		j, ok := v.index[f.ID]
		if f.Hodnoceni > 0 || !ok {
			continue
		}
		x := v.predikce(o.vahy, j)
		if a := alba[f.Album]; a != nil {
			x += a.soucet / (a.pocet + smrsteniAlba)
		}
		vysledek[f.ID] = math.Min(5, math.Max(1, x))
	}
	return vysledek
}

func (v *Vektory) radek(j int, r []float64) {
	m := v.meritka[j] * meritkoVstupu
	r[0] = 1
	for k, x := range v.data[j*Rozmer : (j+1)*Rozmer] {
		r[k+1] = float64(x) * float64(m)
	}
}

func (v *Vektory) predikce(w []float64, j int) float64 {
	m := float64(v.meritka[j] * meritkoVstupu)
	s := 0.0
	for k, x := range v.data[j*Rozmer : (j+1)*Rozmer] {
		s += w[k+1] * float64(x)
	}
	return w[0] + s*m
}

// Hřebenová regrese (XᵀX + λI) w = Xᵀy Choleskyho rozkladem; posun (w[0]) se netrestá
func (v *Vektory) naucit(fotky []HodnoceniFotky, hodnocene []int) []float64 {
	const d = Rozmer + 1
	a := make([]float64, d*d)
	b := make([]float64, d)
	r := make([]float64, d)
	for _, i := range hodnocene {
		v.radek(v.index[fotky[i].ID], r)
		y := fotky[i].Hodnoceni
		for p := range d {
			rp := r[p]
			b[p] += rp * y
			radek := a[p*d : p*d+p+1]
			for q := range radek {
				radek[q] += rp * r[q]
			}
		}
	}
	for p := 1; p < d; p++ {
		a[p*d+p] += lambdaOdhadu
	}
	a[0] += 1e-9
	for p := range d {
		for q := 0; q <= p; q++ {
			s := a[p*d+q]
			for k := range q {
				s -= a[p*d+k] * a[q*d+k]
			}
			if p == q {
				if s <= 0 {
					return nil
				}
				a[p*d+p] = math.Sqrt(s)
			} else {
				a[p*d+q] = s / a[q*d+q]
			}
		}
	}
	z := make([]float64, d)
	for p := range d {
		s := b[p]
		for k := range p {
			s -= a[p*d+k] * z[k]
		}
		z[p] = s / a[p*d+p]
	}
	w := make([]float64, d)
	for p := d - 1; p >= 0; p-- {
		s := z[p]
		for k := p + 1; k < d; k++ {
			s -= a[k*d+p] * w[k]
		}
		w[p] = s / a[p*d+p]
	}
	return w
}
