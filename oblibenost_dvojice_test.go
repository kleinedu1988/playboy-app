package main

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Výchozí výběr (1.3.1) míchá i dvojice napříč úrovněmi srdíček, objevování málo porovnaných a útoky na top 10:
// v sbírce s modelkami na pěti úrovních a rozjetým porovnáváním se každý druh objeví a modelky s různými srdíčky
// se porovnávají často, ne jen stejná úroveň proti stejné
func TestVyberDvojicMix(t *testing.T) {
	var modelky []Modelka
	var porovnani []porovnaniZaznam
	pridat := func(a, b int, v string) {
		porovnani = append(porovnani, porovnaniZaznam{id: int64(len(porovnani) + 1), a: a, b: b, vysledek: v})
	}
	// 60 modelek po 12 na úrovních 5, 4, 3, 2 a 1 srdíčko; posledních 8 je bez porovnání (objevování)
	for i := range 60 {
		modelky = append(modelky, Modelka{ID: i + 1, Jmeno: fmt.Sprintf("M%02d", i+1), Hodnoceni: float64(5 - i/12), CoverID: "x"})
	}
	r := rand.New(rand.NewSource(7))
	for k := 0; k < 400; k++ {
		a, b := 1+r.Intn(52), 1+r.Intn(52)
		if a == b {
			continue
		}
		v := "a"
		if b < a {
			v = "b"
		}
		pridat(a, b, v)
	}
	model := spocitatOblibenost(modelky, porovnani, time.Now())
	podleId := map[int]Modelka{}
	for _, m := range modelky {
		podleId[m.ID] = m
	}
	druhy := map[string]int{}
	napric, celkem := 0, 0
	for k := range 30 {
		for _, d := range vybratDvojice(modelky, model, nil, nil, 10, "", rand.New(rand.NewSource(int64(k)))) {
			celkem++
			if math.Abs(podleId[d.A].Hodnoceni-podleId[d.B].Hodnoceni) >= 1 {
				napric++
			}
			switch {
			case d.Druh == "utok":
				druhy["utok"]++
				if !strings.HasPrefix(d.Duvod, "Útok na top 10") {
					t.Fatalf("důvod útoku: %q", d.Duvod)
				}
				if model.poradi[d.A] > 10 && model.poradi[d.B] > 10 {
					t.Fatalf("útok bez modelky z top 10: %+v", d)
				}
			case strings.HasPrefix(d.Duvod, "Napříč úrovněmi"):
				druhy["napric"]++
			case strings.HasPrefix(d.Duvod, "Nová v porovnávání"):
				druhy["objev"]++
				if model.pocet[d.A] > maxPorovnaniObjevu && model.pocet[d.B] > maxPorovnaniObjevu {
					t.Fatalf("objevování bez málo porovnané modelky: %+v", d)
				}
			}
		}
	}
	t.Logf("z %d dvojic: útoky %d, napříč %d, objevování %d; srdíčka liší o 1 a víc u %d", celkem, druhy["utok"], druhy["napric"], druhy["objev"], napric)
	for _, druh := range []string{"utok", "napric", "objev"} {
		if druhy[druh] == 0 {
			t.Errorf("ve výběru chybí dvojice druhu %s (%v)", druh, druhy)
		}
	}
	// Aspoň pětina dvojic má srdíčka lišící se o celé srdíčko a víc
	if float64(napric) < 0.2*float64(celkem) {
		t.Errorf("napříč úrovněmi jen %d z %d dvojic", napric, celkem)
	}
}
