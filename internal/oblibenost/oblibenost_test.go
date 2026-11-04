package oblibenost

import (
	"math"
	"playboy-app/internal/hledani"
	"testing"
	"time"
)

func TestMatematikaASerieDni(t *testing.T) {
	a := [][]float64{{4, 2}, {2, 3}}
	b := []float64{10, 8}
	x := ResitCholesky(a, b)
	if len(x) != 2 || math.Abs(x[0]-1.75) > 1e-9 || math.Abs(x[1]-1.5) > 1e-9 {
		t.Fatalf("Cholesky: %v", x)
	}
	nyni := time.Date(2026, 11, 3, 14, 0, 0, 0, time.Local)
	casy := []time.Time{
		nyni.AddDate(0, 0, -2),
		nyni.AddDate(0, 0, -1),
		nyni,
	}
	if n, dnes := SerieDni(casy, nyni); n != 3 || !dnes {
		t.Fatalf("SerieDni: %d, %v", n, dnes)
	}
	if TextSrdicek(3.5) != "3½ srdíčka" || TextSrdicek7(1) != "1 srdíčkem" || KratceSrdicka(0.5) != "½" {
		t.Fatal("formát srdíček")
	}
}

func TestSkoreFotekABT(t *testing.T) {
	prumer, k, n, _ := SkoreAlba([5]int{0, 0, 2, 2, 1})
	if n != 5 || k != 4 || math.Abs(prumer-4.0) > 1e-9 {
		t.Fatalf("SkoreAlba: %v, %d, %d", prumer, k, n)
	}
	modelky := []hledani.Modelka{
		{ID: 1, SrdickaAlb: []hledani.SrdickaAlba{{0, 0, 0, 2, 3}}},
		{ID: 2, SrdickaAlb: []hledani.SrdickaAlba{{2, 2, 0, 0, 0}}},
	}
	skore, _ := SpocitatSkoreFotek(modelky)
	if skore[1].Skore <= skore[2].Skore {
		t.Fatalf("SpocitatSkoreFotek: %+v", skore)
	}
	stred := map[int]float64{1: 4.0, 2: 4.0}
	sigma := map[int]float64{1: SigmaHodnocene, 2: SigmaHodnocene}
	bt := SpocitatBT(stred, sigma, []ZaznamPorovnani{{ID: 1, A: 1, B: 2, Vysledek: "a"}}, time.Now())
	if bt.Sila[1] <= bt.Sila[2] || bt.Pocet[1] != 1 {
		t.Fatalf("SpocitatBT: %+v", bt)
	}
}

func TestStromyVkusu(t *testing.T) {
	kosy := make([][]uint8, 20)
	y := make([]float64, 20)
	trenink := make([]int, 20)
	for i := range 20 {
		trenink[i] = i
		if i < 10 {
			kosy[i] = []uint8{1}
			y[i] = 2.0
		} else {
			kosy[i] = []uint8{2}
			y[i] = 4.5
		}
	}
	d := NovaDataStromu(kosy, []int{3})
	les := NaucitLes(d, y, trenink, 10, 42, nil)
	if les.Predikce([]uint8{2}, 10) <= les.Predikce([]uint8{1}, 10) {
		t.Fatal("očekávána vyšší predikce pro koš 2")
	}
}
