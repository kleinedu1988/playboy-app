package obsah

import (
	"fmt"
	"math/rand/v2"
	"testing"
)

// Srdíčka závisí na jednom směru obsahu: odhad nehodnocených fotek ho má poznat; album se známou odchylkou ji přenese
func TestOdhadyFotek(t *testing.T) {
	r := rand.New(rand.NewPCG(7, 8))
	v := NoveVektory()
	smer := nahodnyVektor(r)
	var fotky []HodnoceniFotky
	slozka := func(x []float32) float64 { return float64(skalarni(x, smer)) }
	for i := range 600 {
		x := nahodnyVektor(r)
		// přimíchat směr: „líbivý obsah“
		k := float32(r.Float64())
		for j := range x {
			x[j] += k * smer[j]
		}
		Normalizovat(x)
		id := fmt.Sprintf("f%03d", i)
		v.Pridat(id, x)
		h := 0.0
		if i < 400 {
			h = 1 + 4*slozka(x)
		}
		fotky = append(fotky, HodnoceniFotky{ID: id, Album: int64(i % 50), Hodnoceni: h})
	}
	odhad := v.OdhadyFotek(fotky)
	if len(odhad) != 200 {
		t.Fatalf("odhadů %d", len(odhad))
	}
	var sk, od []float64
	for _, f := range fotky[400:] {
		j := v.index[f.ID]
		x := make([]float32, Rozmer)
		for k := range x {
			x[k] = float32(v.data[j*Rozmer+k]) * v.meritka[j]
		}
		sk = append(sk, slozka(x))
		od = append(od, odhad[f.ID])
	}
	if s := spearmanTest(sk, od); s < 0.8 {
		t.Fatalf("odhad nepoznal směr: Spearman %.2f", s)
	}
	if v.OdhadyFotek(fotky[:100]) != nil {
		t.Fatal("s málo hodnocenými se nemá odhadovat")
	}
}

// Pořadová korelace (bez shod)
func spearmanTest(a, b []float64) float64 {
	poradi := func(x []float64) []float64 {
		o := make([]float64, len(x))
		for i := range x {
			for j := range x {
				if x[j] < x[i] {
					o[i]++
				}
			}
		}
		return o
	}
	ra, rb := poradi(a), poradi(b)
	n := float64(len(a))
	var d float64
	for i := range ra {
		d += (ra[i] - rb[i]) * (ra[i] - rb[i])
	}
	return 1 - 6*d/(n*(n*n-1))
}
