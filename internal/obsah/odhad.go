package obsah

// Odhad srdíček z obsahu fotek: hřebenová regrese nad vektory CLIP a jistotami detektoru partií hodnocených fotek
// (co je na fotkách, které hodnotíš výš) a u nehodnocených doladění podle ostatních hodnocených fotek téhož alba
// (o kolik je album lepší, než by řekl obsah). Na vzorku sbírky (docs/MODEL-CLIP-B32.md, oddíly 7 a 9) seřadil
// fotky podle srdíček líp než průměr alba (Spearman 0,58 proti 0,41); detektor k CLIP přidal málo (0,44 → 0,46
// u fotek cizích modelek). Čistý odhad z obsahu (bez alba) dává i „obsah fotek“ modelky pro model vkusu.

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

// Měřítko vstupu regrese (složky vektoru délky 1 jsou kolem ±0,05; jistoty detektoru 0–1 zůstávají)
const meritkoVstupu = 10

// Fotka pro odhad: ID souboru, album a srdíčka (0 = nehodnocená)
type HodnoceniFotky struct {
	ID        string
	Album     int64
	Hodnoceni float64
}

// Výsledek odhadu: Nehodnocene = odhad srdíček (1–5) nehodnocených fotek včetně odchylky alba; Obsah = čistý
// odhad z obsahu u všech fotek s příznaky (i hodnocených, bez alba)
type Odhady struct {
	Nehodnocene map[string]float64
	Obsah       map[string]float64
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

// OdhadyFotek: odhady z obsahu (vektor CLIP a partie z detektoru); nil, když je hodnocených fotek s obsahem málo.
// Model se učí znovu jen po změně hodnocení nebo spočítaného obsahu.
func (s *Sluzba) OdhadyFotek(fotky []HodnoceniFotky) *Odhady {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	v, pa := s.vektory, s.partie
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	return odhadnout(v, pa, fotky)
}

// Příznaky fotek: vektor CLIP (×meritkoVstupu) a s partiemi i jistoty detektoru; fotka bez nich se neodhaduje
type priznaky struct {
	v  *Vektory
	pa *Partie
}

func (p priznaky) rozmer() int {
	d := 1 + Rozmer
	if p.pa != nil {
		d += len(TridyDetektoru)
	}
	return d
}

// Vyplní řádek příznaků fotky (r[0] = 1 pro posun); false, když fotka příznaky nemá
func (p priznaky) radek(id string, r []float64) bool {
	j, ok := p.v.index[id]
	if !ok {
		return false
	}
	m := float64(p.v.meritka[j] * meritkoVstupu)
	r[0] = 1
	for k, x := range p.v.data[j*Rozmer : (j+1)*Rozmer] {
		r[k+1] = float64(x) * m
	}
	if p.pa != nil {
		b, ok := p.pa.m[id]
		if !ok {
			return false
		}
		for k, x := range b {
			r[1+Rozmer+k] = float64(x) / 255
		}
	}
	return true
}

func odhadnout(v *Vektory, pa *Partie, fotky []HodnoceniFotky) *Odhady {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if pa != nil {
		pa.mu.RLock()
		defer pa.mu.RUnlock()
		// Partie ještě nespočítané u většiny fotek s vektorem (detektor se doplňuje): zatím jen CLIP
		if len(pa.m) < len(v.ids)/2 {
			pa = nil
		}
	}
	p := priznaky{v, pa}
	d := p.rozmer()
	r := make([]float64, d)
	var hodnocene []int // indexy do fotky
	otisk := uint64(14695981039346656037)
	pridat := func(x uint64) { otisk = (otisk ^ x) * 1099511628211 }
	pridat(uint64(len(v.ids))<<20 | uint64(d))
	if pa != nil {
		pridat(uint64(len(pa.m)))
	}
	for i, f := range fotky {
		if f.Hodnoceni <= 0 || !p.radek(f.ID, r) {
			continue
		}
		hodnocene = append(hodnocene, i)
		pridat(uint64(v.index[f.ID])<<8 | uint64(f.Hodnoceni*2))
	}
	if len(hodnocene) < minHodnocenychFotek {
		return nil
	}

	odhadMu.Lock()
	o := posledniOdhad
	if o == nil || o.otisk != otisk {
		o = &odhadSrdicek{otisk: otisk, vahy: naucit(p, fotky, hodnocene)}
		posledniOdhad = o
	}
	odhadMu.Unlock()
	if o.vahy == nil {
		return nil
	}
	predikce := func(id string) (float64, bool) {
		if !p.radek(id, r) {
			return 0, false
		}
		s := 0.0
		for k, x := range r {
			s += o.vahy[k] * x
		}
		return s, true
	}

	vysledek := &Odhady{Nehodnocene: map[string]float64{}, Obsah: map[string]float64{}}
	// Odchylka alba: průměrný rozdíl skutečných a odhadnutých srdíček hodnocených fotek alba
	type odchylka struct{ soucet, pocet float64 }
	alba := map[int64]*odchylka{}
	for _, i := range hodnocene {
		f := fotky[i]
		x, _ := predikce(f.ID)
		vysledek.Obsah[f.ID] = x
		a := alba[f.Album]
		if a == nil {
			a = &odchylka{}
			alba[f.Album] = a
		}
		a.soucet += f.Hodnoceni - x
		a.pocet++
	}
	for _, f := range fotky {
		if f.Hodnoceni > 0 {
			continue
		}
		x, ok := predikce(f.ID)
		if !ok {
			continue
		}
		vysledek.Obsah[f.ID] = x
		if a := alba[f.Album]; a != nil {
			x += a.soucet / (a.pocet + smrsteniAlba)
		}
		vysledek.Nehodnocene[f.ID] = math.Min(5, math.Max(1, x))
	}
	return vysledek
}

// Hřebenová regrese (XᵀX + λI) w = Xᵀy Choleskyho rozkladem; posun (w[0]) se netrestá
func naucit(p priznaky, fotky []HodnoceniFotky, hodnocene []int) []float64 {
	d := p.rozmer()
	a := make([]float64, d*d)
	b := make([]float64, d)
	r := make([]float64, d)
	for _, i := range hodnocene {
		p.radek(fotky[i].ID, r)
		y := fotky[i].Hodnoceni
		for q := range d {
			rq := r[q]
			b[q] += rq * y
			radek := a[q*d : q*d+q+1]
			for k := range radek {
				radek[k] += rq * r[k]
			}
		}
	}
	for q := 1; q < d; q++ {
		a[q*d+q] += lambdaOdhadu
	}
	a[0] += 1e-9
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
	z := make([]float64, d)
	for q := range d {
		s := b[q]
		for l := range q {
			s -= a[q*d+l] * z[l]
		}
		z[q] = s / a[q*d+q]
	}
	w := make([]float64, d)
	for q := d - 1; q >= 0; q-- {
		s := z[q]
		for l := q + 1; l < d; l++ {
			s -= a[l*d+q] * w[l]
		}
		w[q] = s / a[q*d+q]
	}
	return w
}
