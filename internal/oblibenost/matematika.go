package oblibenost

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// Řešení soustavy A·x = b se symetrickou pozitivně definitní A Choleského rozkladem (A se přepíše);
// nil, když A pozitivně definitní není.
func ResitCholesky(a [][]float64, b []float64) []float64 {
	d := len(a)
	for i := range d {
		for j := 0; j <= i; j++ {
			s := a[i][j]
			for k := range j {
				s -= a[i][k] * a[j][k]
			}
			if i == j {
				if s <= 1e-12 {
					return nil
				}
				a[i][i] = math.Sqrt(s)
			} else {
				a[i][j] = s / a[j][j]
			}
		}
	}
	x := make([]float64, d)
	for i := range d {
		s := b[i]
		for k := range i {
			s -= a[i][k] * x[k]
		}
		x[i] = s / a[i][i]
	}
	for i := d - 1; i >= 0; i-- {
		s := x[i]
		for k := i + 1; k < d; k++ {
			s -= a[k][i] * x[k]
		}
		x[i] = s / a[i][i]
	}
	return x
}

func ZaokrouhlitNaPul(x float64) float64 { return math.Round(x*2) / 2 }

func Zaokrouhlit3(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return 0
	}
	return math.Round(x*1000) / 1000
}

// „4 srdíčka“, „3½ srdíčka“, „5 srdíček“, „1 srdíčko“, „½ srdíčka“
func TextSrdicek(h float64) string {
	cela := int(h)
	pul := h-float64(cela) >= 0.5
	cislo := fmt.Sprint(cela)
	switch {
	case pul && cela == 0:
		return "½ srdíčka"
	case pul:
		return cislo + "½ srdíčka"
	case cela == 1:
		return "1 srdíčko"
	case cela >= 2 && cela <= 4:
		return cislo + " srdíčka"
	}
	return cislo + " srdíček"
}

// Sedmý pád: „s 4 srdíčky“, „s 3½ srdíčka“
func TextSrdicek7(h float64) string {
	cela := int(h)
	if h-float64(cela) >= 0.5 {
		if cela == 0 {
			return "½ srdíčka"
		}
		return fmt.Sprintf("%d½ srdíčka", cela)
	}
	if cela == 1 {
		return "1 srdíčkem"
	}
	return fmt.Sprintf("%d srdíčky", cela)
}

// „4½“, „4“, „½“
func KratceSrdicka(h float64) string {
	cela := int(h)
	pul := h-float64(cela) >= 0.5
	switch {
	case pul && cela == 0:
		return "½"
	case pul:
		return fmt.Sprintf("%d½", cela)
	}
	return fmt.Sprint(cela)
}

// „4,3“
func CisloCesky(x float64, mist int) string {
	return strings.Replace(fmt.Sprintf("%.*f", mist, x), ".", ",", 1)
}

// „srdíčka 3,5“, „bez srdíček“
func TextSlozkySrdicek(h float64) string {
	if h <= 0 {
		return "bez srdíček"
	}
	return "srdíčka " + strings.TrimSuffix(CisloCesky(h, 1), ",0")
}

// „70. léta“, „léta 2000–2009“
func TextDesetileti(desetileti int) string {
	if desetileti >= 1900 && desetileti < 2000 {
		return fmt.Sprintf("%d. léta", desetileti-1900)
	}
	return fmt.Sprintf("léta %d–%d", desetileti, desetileti+9)
}

func klicKalendarnihoDne(t time.Time) int {
	r, m, d := t.Date()
	return r*10000 + int(m)*100 + d
}

// Série dní v řadě s aspoň jedním porovnáním (místní kalendářní dny): počítá se zpět od dneška; když dnes ještě
// žádné porovnání není, od včerejška (série ještě nepropadla). Vrací délku a zda je v ní dnešek.
func SerieDni(casy []time.Time, ted time.Time) (int, bool) {
	loc := ted.Location()
	dny := make(map[int]bool, min(len(casy), 400))
	for _, c := range casy {
		if !c.IsZero() {
			dny[klicKalendarnihoDne(c.In(loc))] = true
		}
	}
	den := ted
	dnes := dny[klicKalendarnihoDne(den)]
	if !dnes {
		den = den.AddDate(0, 0, -1)
	}
	n := 0
	for dny[klicKalendarnihoDne(den)] {
		n++
		den = den.AddDate(0, 0, -1)
	}
	return n, dnes
}

// Dny mezi dvěma okamžiky podle kalendáře (včera večer → dnes ráno = 1 den)
func DniMezi(od, do time.Time) int {
	if do.Before(od) {
		return 0
	}
	d0 := time.Date(od.Year(), od.Month(), od.Day(), 12, 0, 0, 0, time.Local)
	d1 := time.Date(do.Year(), do.Month(), do.Day(), 12, 0, 0, 0, time.Local)
	return int(math.Round(d1.Sub(d0).Hours() / 24))
}

// Stálá náhodná hodnota pro klíč a semínko (0–1); stejný výpočet jako nahodaKlice v lib/hodnoceni.js
func NahodaKlice(klic int, seed int) float64 {
	t := uint32(int32(klic))*0x9e3779b1 ^ uint32(int64(seed))*0x85ebca6b
	t = (t ^ t>>16) * 0x7feb352d
	t = (t ^ t>>15) * 0x846ca68b
	return float64(t^t>>16) / 4294967296
}

func KlicDvojice(a, b int) [2]int {
	if a > b {
		a, b = b, a
	}
	return [2]int{a, b}
}
