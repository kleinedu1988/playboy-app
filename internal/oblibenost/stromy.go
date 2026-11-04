package oblibenost

import (
	"math/rand"
	"sort"
)

// Gradientní posilování mělkých regresních stromů pro model vkusu, čistě v Go.

const (
	KrokStromu       = 0.15
	HloubkaStromu    = 3
	MaxStromu        = 80  // počet stromů vybere křížové ověření (nejvýš tolik)
	MinListStromu    = 8   // nejméně modelek v listu
	LambdaStromu     = 4.0 // smrštění hodnoty uzlu (jako λ modelek s průměrným reziduem navíc)
	PodilRadkuStromu = 0.8
	MaxKosuStromu    = 16 // číselný údaj nejvýš do tolika košů (kvantily hodnocených)
	TrpelivostStromu = 20 // ověření: les přestane růst, když se chyba tolik stromů nezlepšila
)

type UzelStromu struct {
	Priznak    int32 // −1 = list
	Kos        uint8 // vlevo jdou koše 1…Kos
	ChybiVlevo bool
	Levy       int32
	Pravy      int32
	Hodnota    float64 // krok·G/(n + λ): odhad, kdyby strom skončil tady
}

type StromVkusu []UzelStromu

// Index listu, do kterého řádek s danými koši padne
func (s StromVkusu) List(kosy []uint8) int {
	i := 0
	for s[i].Priznak >= 0 {
		u := &s[i]
		k := kosy[u.Priznak]
		if (k == 0 && u.ChybiVlevo) || (k != 0 && k <= u.Kos) {
			i = int(u.Levy)
		} else {
			i = int(u.Pravy)
		}
	}
	return i
}

type LesVkusu struct {
	Zaklad float64
	Stromy []StromVkusu
}

// Odhad z prvních pocet stromů
func (l *LesVkusu) Predikce(kosy []uint8, pocet int) float64 {
	y := l.Zaklad
	for _, s := range l.Stromy[:min(pocet, len(l.Stromy))] {
		y += s[s.List(kosy)].Hodnota
	}
	return y
}

// Listy, do kterých řádek padne v jednotlivých stromech (podobnost modelek)
func (l *LesVkusu) Listy(kosy []uint8) []uint8 {
	listy := make([]uint8, len(l.Stromy))
	for t, s := range l.Stromy {
		listy[t] = uint8(s.List(kosy))
	}
	return listy
}

// Příspěvky údajů k odhadu (cesta stromem): prispevek(priznak, hodnota); vrací základ (průměr + kořeny)
func (l *LesVkusu) Prispevky(kosy []uint8, prispevek func(priznak int, c float64)) float64 {
	zaklad := l.Zaklad
	for _, s := range l.Stromy {
		zaklad += s[0].Hodnota
		i := 0
		for s[i].Priznak >= 0 {
			u := &s[i]
			k := kosy[u.Priznak]
			dalsi := u.Pravy
			if (k == 0 && u.ChybiVlevo) || (k != 0 && k <= u.Kos) {
				dalsi = u.Levy
			}
			prispevek(int(u.Priznak), s[dalsi].Hodnota-u.Hodnota)
			i = int(dalsi)
		}
	}
	return zaklad
}

type PrvekKosu struct {
	P int32
	K uint8
}

// Data pro stromy: koše všech řádků, řídce jen koše jiné než nejčastější
type DataStromu struct {
	Kosy       [][]uint8
	Ridke      [][]PrvekKosu
	Vychozi    []uint8 // nejčastější koš příznaku
	PocetKosu  []int
	Posun      []int // začátek příznaku v histogramu
	KosuCelkem int
	// Pracovní histogramy patra a jeho potomků (souběžné učení potřebuje vlastní kopii DataStromu)
	Hg, Hn, Hg2, Hn2 []float64
}

func NovaDataStromu(kosy [][]uint8, pocetKosu []int) *DataStromu {
	p := len(pocetKosu)
	d := &DataStromu{Kosy: kosy, PocetKosu: pocetKosu, Vychozi: make([]uint8, p), Posun: make([]int, p)}
	for j := range p {
		d.Posun[j] = d.KosuCelkem
		d.KosuCelkem += pocetKosu[j]
		cetnost := make([]int, pocetKosu[j])
		for _, r := range kosy {
			cetnost[r[j]]++
		}
		for k, c := range cetnost {
			if c > cetnost[d.Vychozi[j]] {
				d.Vychozi[j] = uint8(k)
			}
		}
	}
	d.Ridke = make([][]PrvekKosu, len(kosy))
	for i, r := range kosy {
		for j, k := range r {
			if k != d.Vychozi[j] {
				d.Ridke[i] = append(d.Ridke[i], PrvekKosu{int32(j), k})
			}
		}
	}
	return d
}

// Les na řádcích trenink (cíl y podle indexu řádku); poStromu se volá po každém stromu a false les zastaví
func NaucitLes(d *DataStromu, y []float64, trenink []int, pocet int, semeno int64, poStromu func(t int, s StromVkusu) bool) *LesVkusu {
	l := &LesVkusu{}
	if len(trenink) == 0 {
		return l
	}
	for _, i := range trenink {
		l.Zaklad += y[i]
	}
	l.Zaklad /= float64(len(trenink))
	f := make([]float64, len(d.Kosy))
	for _, i := range trenink {
		f[i] = l.Zaklad
	}
	nahoda := rand.New(rand.NewSource(semeno))
	g := make([]float64, len(d.Kosy))
	uzel := make([]int32, len(d.Kosy))
	vybrane := make([]int, 0, len(trenink))
	for t := range pocet {
		vybrane = vybrane[:0]
		for _, i := range trenink {
			if nahoda.Float64() < PodilRadkuStromu {
				vybrane = append(vybrane, i)
				g[i] = y[i] - f[i]
			}
		}
		s := PostavitStrom(d, vybrane, g, uzel)
		l.Stromy = append(l.Stromy, s)
		for _, i := range trenink {
			f[i] += s[s.List(d.Kosy[i])].Hodnota
		}
		if poStromu != nil && !poStromu(t, s) {
			break
		}
	}
	return l
}

// Jeden strom na vybraných řádcích s rezidui g (uzel = pracovní pole)
func PostavitStrom(d *DataStromu, radky []int, g []float64, uzel []int32) StromVkusu {
	K := d.KosuCelkem
	type souhrn struct{ g, n float64 }
	pricist := func(hg, hn []float64, slot int, i int) {
		z := slot * K
		for _, x := range d.Ridke[i] {
			hg[z+d.Posun[x.P]+int(x.K)] += g[i]
			hn[z+d.Posun[x.P]+int(x.K)]++
		}
	}
	doplnit := func(hg, hn []float64, slot int, c souhrn) {
		z := slot * K
		for j, b := range d.PocetKosu {
			o := z + d.Posun[j]
			sg, sn := 0.0, 0.0
			for x := range b {
				sg += hg[o+x]
				sn += hn[o+x]
			}
			v := int(d.Vychozi[j])
			hg[o+v] += c.g - sg
			hn[o+v] += c.n - sn
		}
	}
	buffer := func(b *[]float64, n int) []float64 {
		if cap(*b) < n {
			*b = make([]float64, n)
		}
		x := (*b)[:n]
		clear(x)
		return x
	}
	G, N := 0.0, 0.0
	for _, i := range radky {
		G += g[i]
		N++
		uzel[i] = 0
	}
	s := StromVkusu{{Priznak: -1, Hodnota: KrokStromu * G / (N + LambdaStromu)}}
	celkem := []souhrn{{G, N}}
	patro := []int32{0}
	hg, hn := buffer(&d.Hg, K), buffer(&d.Hn, K)
	for _, i := range radky {
		pricist(hg, hn, 0, i)
	}
	doplnit(hg, hn, 0, celkem[0])
	for hloubka := 0; hloubka < HloubkaStromu && len(patro) > 0; hloubka++ {
		var dalsi []int32
		rodic := make([]int, 0, len(patro))
		for k, u := range patro {
			c := celkem[u]
			o0 := k * K
			nejlepsi, zisk := UzelStromu{Priznak: -1}, 1e-9
			var nejL, nejR souhrn
			zakladZisk := c.g * c.g / (c.n + LambdaStromu)
			for j, b := range d.PocetKosu {
				o := o0 + d.Posun[j]
				cg, cn := hg[o], hn[o]
				lg, ln := 0.0, 0.0
				for t := 1; t < b-1; t++ {
					lg += hg[o+t]
					ln += hn[o+t]
					for _, vlevo := range [2]bool{false, true} {
						if vlevo && cn == 0 {
							continue
						}
						gl, nl := lg, ln
						if vlevo {
							gl, nl = gl+cg, nl+cn
						}
						gr, nr := c.g-gl, c.n-nl
						if nl < MinListStromu || nr < MinListStromu {
							continue
						}
						if zz := gl*gl/(nl+LambdaStromu) + gr*gr/(nr+LambdaStromu) - zakladZisk; zz > zisk {
							zisk = zz
							nejlepsi = UzelStromu{Priznak: int32(j), Kos: uint8(t), ChybiVlevo: vlevo}
							nejL, nejR = souhrn{gl, nl}, souhrn{gr, nr}
						}
					}
				}
			}
			if nejlepsi.Priznak < 0 {
				continue
			}
			nejlepsi.Hodnota = s[u].Hodnota
			nejlepsi.Levy, nejlepsi.Pravy = int32(len(s)), int32(len(s)+1)
			s[u] = nejlepsi
			s = append(s, UzelStromu{Priznak: -1, Hodnota: KrokStromu * nejL.g / (nejL.n + LambdaStromu)},
				UzelStromu{Priznak: -1, Hodnota: KrokStromu * nejR.g / (nejR.n + LambdaStromu)})
			celkem = append(celkem, nejL, nejR)
			dalsi = append(dalsi, nejlepsi.Levy, nejlepsi.Pravy)
			rodic = append(rodic, k)
		}
		posledni := hloubka == HloubkaStromu-1 || len(dalsi) == 0
		var dg, dn []float64
		var slotPole [16]int
		slot := slotPole[:len(s)]
		for u := range slot {
			slot[u] = -1
		}
		if !posledni {
			dg, dn = buffer(&d.Hg2, len(dalsi)*K), buffer(&d.Hn2, len(dalsi)*K)
			for x := 0; x < len(dalsi); x += 2 {
				l, p := dalsi[x], dalsi[x+1]
				if celkem[l].n <= celkem[p].n {
					slot[l] = x
				} else {
					slot[p] = x + 1
				}
			}
		}
		for _, i := range radky {
			u := &s[uzel[i]]
			if u.Priznak < 0 {
				continue
			}
			k := d.Kosy[i][u.Priznak]
			if (k == 0 && u.ChybiVlevo) || (k != 0 && k <= u.Kos) {
				uzel[i] = u.Levy
			} else {
				uzel[i] = u.Pravy
			}
			if !posledni && slot[uzel[i]] >= 0 {
				pricist(dg, dn, slot[uzel[i]], i)
			}
		}
		if posledni {
			break
		}
		for x := 0; x < len(dalsi); x += 2 {
			mensi, vetsi := x, x+1
			if slot[dalsi[x]] < 0 {
				mensi, vetsi = x+1, x
			}
			doplnit(dg, dn, mensi, celkem[dalsi[mensi]])
			r, m, v := rodic[x/2]*K, mensi*K, vetsi*K
			for b := range K {
				dg[v+b] = hg[r+b] - dg[m+b]
				dn[v+b] = hn[r+b] - dn[m+b]
			}
		}
		d.Hg, d.Hg2 = d.Hg2, d.Hg
		d.Hn, d.Hn2 = d.Hn2, d.Hn
		hg, hn = dg, dn
		patro = dalsi
	}
	return s
}

func HraniceKosu(hodnoty []float64) []float64 {
	if len(hodnoty) == 0 {
		return nil
	}
	s := append([]float64(nil), hodnoty...)
	sort.Float64s(s)
	var hranice []float64
	for k := 1; k < MaxKosuStromu; k++ {
		i := k * len(s) / MaxKosuStromu
		if i <= 0 || i >= len(s) || s[i] == s[i-1] {
			continue
		}
		h := (s[i] + s[i-1]) / 2
		if len(hranice) == 0 || h > hranice[len(hranice)-1] {
			hranice = append(hranice, h)
		}
	}
	return hranice
}

func KosHodnoty(hranice []float64, x float64) uint8 {
	k := 1
	for _, h := range hranice {
		if x >= h {
			k++
		}
	}
	return uint8(k)
}
