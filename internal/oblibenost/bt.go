package oblibenost

import (
	"math"
	"playboy-app/internal/uceni"
	"sort"
	"time"
)

const (
	SkalaBT          = 2.0  // P(A víc než B) = σ(SkalaBT·(sA − sB)): o půl srdíčka silnější vyhraje v 73 %
	SigmaHodnocene   = 0.25 // předpoklad síly hodnocené modelky: N(srdíčka, 0,25²)
	SigmaNehodnocene = 1.25 // nehodnocená porovnávaná modelka bez hodnocených fotek: N(průměr srdíček sbírky, 1,25²)
	RozpetiUrovne    = 0.49
	RozpetiCileVkusu = 0.24
	MaxIteraciBT     = 2000
)

type HranaBT struct {
	I, J int
	Y, W float64 // Y: výsledek z pohledu I (1 výhra, 0,5 remíza, 0 prohra)
}

type VysledekBT struct {
	Sila, Rozptyl map[int]float64
	Pocet         map[int]int
	Vyhry         map[int]float64
}

// Řeší aposteriorní maximum modelu Bradley–Terry pomocí MM iterací nad připravenou sítí porovnání.
func ResitBT(ids []int, s, mu, prec []float64, hrany []HranaBT, sousede [][]int, v *VysledekBT) {
	k := SkalaBT
	k2_4 := k * k / 4
	mezV := make([]float64, len(ids))
	for x := range ids {
		mez := prec[x]
		for _, e := range sousede[x] {
			mez += hrany[e].W * k2_4
		}
		mezV[x] = mez
	}
	for iterace := 0; iterace < MaxIteraciBT && len(hrany) > 0; iterace++ {
		maxZmena := 0.0
		for x := range ids {
			if len(sousede[x]) == 0 {
				continue
			}
			sx := s[x]
			g := -prec[x] * (sx - mu[x])
			for _, e := range sousede[x] {
				h := hrany[e]
				y, jiny := h.Y, h.J
				if h.J == x {
					y, jiny = 1-h.Y, h.I
				}
				p := uceni.ZLogitu(k * (sx - s[jiny]))
				g += h.W * k * (y - p)
			}
			krok := g / mezV[x]
			s[x] = sx + krok
			maxZmena = max(maxZmena, math.Abs(krok))
		}
		if maxZmena < 1e-9 {
			break
		}
	}
	k2 := k * k
	for x, id := range ids {
		info := prec[x]
		for _, e := range sousede[x] {
			h := hrany[e]
			p := uceni.ZLogitu(k * (s[h.I] - s[h.J]))
			info += h.W * k2 * p * (1 - p)
		}
		v.Sila[id], v.Rozptyl[id] = s[x], 1/info
	}
}

type ZaznamPorovnani struct {
	ID       int64
	Cas      time.Time
	A, B     int
	Vysledek string
	HA, HB   float64
	Tema     string
}

func SpocitatBT(stred, sigma map[int]float64, porovnani []ZaznamPorovnani, nyni time.Time) VysledekBT {
	v := VysledekBT{Sila: make(map[int]float64, len(stred)), Rozptyl: make(map[int]float64, len(stred)), Pocet: map[int]int{}, Vyhry: map[int]float64{}}
	ids := make([]int, 0, len(stred))
	for id := range stred {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	index := make(map[int]int, len(ids))
	s, mu, prec := make([]float64, len(ids)), make([]float64, len(ids)), make([]float64, len(ids))
	for i, id := range ids {
		index[id] = i
		s[i], mu[i] = stred[id], stred[id]
		prec[i] = 1 / (sigma[id] * sigma[id])
	}
	var hrany []HranaBT
	sousede := make([][]int, len(ids))
	for _, p := range porovnani {
		i, okA := index[p.A]
		j, okB := index[p.B]
		if !okA || !okB || i == j {
			continue
		}
		y := 0.5
		switch p.Vysledek {
		case "a":
			y = 1
		case "b":
			y = 0
		}
		w := 1.0
		if !p.Cas.IsZero() {
			w = uceni.VahaStari(p.Cas, nyni)
		}
		sousede[i] = append(sousede[i], len(hrany))
		sousede[j] = append(sousede[j], len(hrany))
		hrany = append(hrany, HranaBT{I: i, J: j, Y: y, W: w})
		v.Pocet[p.A]++
		v.Pocet[p.B]++
		v.Vyhry[p.A] += y
		v.Vyhry[p.B] += 1 - y
	}
	ResitBT(ids, s, mu, prec, hrany, sousede, &v)
	return v
}
