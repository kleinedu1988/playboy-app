package main

import (
	"math/rand"
	"sort"
)

// Gradientní posilování mělkých regresních stromů pro model vkusu (oblibenost_vkus.go), čistě v Go.
//
// Každý údaj je rozdělený do košů: koš 0 = údaj chybí, 1… = hodnoty vzestupně (číselný údaj po kvantilech,
// hodnota údaje jako 1 = nemá, 2 = má). Strom se staví po patrech do hloubky hloubkaStromu; v každém uzlu se
// hledá dělení „koše 1…k vlevo, ostatní vpravo“ s chybějícími vlevo nebo vpravo (co sedí lépe), které nejvíc sníží
// součet čtverců reziduí (zisk G_L²/(n_L+λ) + G_R²/(n_R+λ) − G²/(n+λ)). Každý strom se učí na náhodných 80 %
// řádků (opakovatelné semínko) a přispívá krokem krokStromu; list i vnitřní uzel mají hodnotu
// krok·G/(n + λ), takže příspěvek údaje k odhadu jde spočítat po cestě stromem (rozdíl hodnot uzlu a jeho
// potomka připadne údaji, podle kterého se dělilo; součet po cestě = list − kořen).
//
// Histogramy se sčítají jen z košů, které nejsou nejčastější (u hodnot údajů skoro vždy „nemá“), nejčastější
// koš se dopočítá z celku uzlu; patro stromu tak stojí úměrně počtu vyplněných údajů, ne všech sloupců.

// Parametry stromů
const (
	krokStromu       = 0.15
	hloubkaStromu    = 3
	maxStromu        = 80  // počet stromů vybere křížové ověření (nejvýš tolik)
	minListStromu    = 8   // nejméně modelek v listu
	lambdaStromu     = 4.0 // smrštění hodnoty uzlu (jako λ modelek s průměrným reziduem navíc)
	podilRadkuStromu = 0.8
	maxKosuStromu    = 16 // číselný údaj nejvýš do tolika košů (kvantily hodnocených)
	trpelivostStromu = 20 // ověření: les přestane růst, když se chyba tolik stromů nezlepšila
)

type uzelStromu struct {
	priznak    int32 // −1 = list
	kos        uint8 // vlevo jdou koše 1…kos
	chybiVlevo bool
	levy       int32
	pravy      int32
	hodnota    float64 // krok·G/(n + λ): odhad, kdyby strom skončil tady
}

type stromVkusu []uzelStromu

// Index listu, do kterého řádek s danými koši padne
func (s stromVkusu) list(kosy []uint8) int {
	i := 0
	for s[i].priznak >= 0 {
		u := &s[i]
		k := kosy[u.priznak]
		if (k == 0 && u.chybiVlevo) || (k != 0 && k <= u.kos) {
			i = int(u.levy)
		} else {
			i = int(u.pravy)
		}
	}
	return i
}

type lesVkusu struct {
	zaklad float64
	stromy []stromVkusu
}

// Odhad z prvních pocet stromů
func (l *lesVkusu) predikce(kosy []uint8, pocet int) float64 {
	y := l.zaklad
	for _, s := range l.stromy[:min(pocet, len(l.stromy))] {
		y += s[s.list(kosy)].hodnota
	}
	return y
}

// Listy, do kterých řádek padne v jednotlivých stromech (podobnost modelek)
func (l *lesVkusu) listy(kosy []uint8) []uint8 {
	listy := make([]uint8, len(l.stromy))
	for t, s := range l.stromy {
		listy[t] = uint8(s.list(kosy))
	}
	return listy
}

// Příspěvky údajů k odhadu (cesta stromem): prispevek(priznak, hodnota); vrací základ (průměr + kořeny)
func (l *lesVkusu) prispevky(kosy []uint8, prispevek func(priznak int, c float64)) float64 {
	zaklad := l.zaklad
	for _, s := range l.stromy {
		zaklad += s[0].hodnota
		i := 0
		for s[i].priznak >= 0 {
			u := &s[i]
			k := kosy[u.priznak]
			dalsi := u.pravy
			if (k == 0 && u.chybiVlevo) || (k != 0 && k <= u.kos) {
				dalsi = u.levy
			}
			prispevek(int(u.priznak), s[dalsi].hodnota-u.hodnota)
			i = int(dalsi)
		}
	}
	return zaklad
}

type prvekKosu struct {
	p int32
	k uint8
}

// Data pro stromy: koše všech řádků, řídce jen koše jiné než nejčastější
type dataStromu struct {
	kosy       [][]uint8
	ridke      [][]prvekKosu
	vychozi    []uint8 // nejčastější koš příznaku
	pocetKosu  []int
	posun      []int // začátek příznaku v histogramu
	kosuCelkem int
	// Pracovní histogramy patra a jeho potomků (souběžné učení potřebuje vlastní kopii dataStromu)
	hg, hn, hg2, hn2 []float64
}

func novaDataStromu(kosy [][]uint8, pocetKosu []int) *dataStromu {
	p := len(pocetKosu)
	d := &dataStromu{kosy: kosy, pocetKosu: pocetKosu, vychozi: make([]uint8, p), posun: make([]int, p)}
	for j := range p {
		d.posun[j] = d.kosuCelkem
		d.kosuCelkem += pocetKosu[j]
		cetnost := make([]int, pocetKosu[j])
		for _, r := range kosy {
			cetnost[r[j]]++
		}
		for k, c := range cetnost {
			if c > cetnost[d.vychozi[j]] {
				d.vychozi[j] = uint8(k)
			}
		}
	}
	d.ridke = make([][]prvekKosu, len(kosy))
	for i, r := range kosy {
		for j, k := range r {
			if k != d.vychozi[j] {
				d.ridke[i] = append(d.ridke[i], prvekKosu{int32(j), k})
			}
		}
	}
	return d
}

// Les na řádcích trenink (cíl y podle indexu řádku); poStromu se volá po každém stromu a false les zastaví
func naucitLes(d *dataStromu, y []float64, trenink []int, pocet int, semeno int64, poStromu func(t int, s stromVkusu) bool) *lesVkusu {
	l := &lesVkusu{}
	if len(trenink) == 0 {
		return l
	}
	for _, i := range trenink {
		l.zaklad += y[i]
	}
	l.zaklad /= float64(len(trenink))
	f := make([]float64, len(d.kosy))
	for _, i := range trenink {
		f[i] = l.zaklad
	}
	nahoda := rand.New(rand.NewSource(semeno))
	g := make([]float64, len(d.kosy))
	uzel := make([]int32, len(d.kosy))
	vybrane := make([]int, 0, len(trenink))
	for t := range pocet {
		vybrane = vybrane[:0]
		for _, i := range trenink {
			if nahoda.Float64() < podilRadkuStromu {
				vybrane = append(vybrane, i)
				g[i] = y[i] - f[i]
			}
		}
		s := postavitStrom(d, vybrane, g, uzel)
		l.stromy = append(l.stromy, s)
		for _, i := range trenink {
			f[i] += s[s.list(d.kosy[i])].hodnota
		}
		if poStromu != nil && !poStromu(t, s) {
			break
		}
	}
	return l
}

// Jeden strom na vybraných řádcích s rezidui g (uzel = pracovní pole)
func postavitStrom(d *dataStromu, radky []int, g []float64, uzel []int32) stromVkusu {
	K := d.kosuCelkem
	type souhrn struct{ g, n float64 }
	// Histogram (součet reziduí a počet po koších všech příznaků) uzlu na pozici slot v bufferu
	pricist := func(hg, hn []float64, slot int, i int) {
		z := slot * K
		for _, x := range d.ridke[i] {
			hg[z+d.posun[x.p]+int(x.k)] += g[i]
			hn[z+d.posun[x.p]+int(x.k)]++
		}
	}
	// Nejčastější koš každého příznaku = celek uzlu bez ostatních košů
	doplnit := func(hg, hn []float64, slot int, c souhrn) {
		z := slot * K
		for j, b := range d.pocetKosu {
			o := z + d.posun[j]
			sg, sn := 0.0, 0.0
			for x := range b {
				sg += hg[o+x]
				sn += hn[o+x]
			}
			v := int(d.vychozi[j])
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
	s := stromVkusu{{priznak: -1, hodnota: krokStromu * G / (N + lambdaStromu)}}
	celkem := []souhrn{{G, N}}
	patro := []int32{0}
	hg, hn := buffer(&d.hg, K), buffer(&d.hn, K)
	for _, i := range radky {
		pricist(hg, hn, 0, i)
	}
	doplnit(hg, hn, 0, celkem[0])
	for hloubka := 0; hloubka < hloubkaStromu && len(patro) > 0; hloubka++ {
		var dalsi []int32
		rodic := make([]int, 0, len(patro)) // pozice rozděleného uzlu v histogramech patra
		for k, u := range patro {
			c := celkem[u]
			o0 := k * K
			nejlepsi, zisk := uzelStromu{priznak: -1}, 1e-9
			var nejL, nejR souhrn
			zakladZisk := c.g * c.g / (c.n + lambdaStromu)
			for j, b := range d.pocetKosu {
				o := o0 + d.posun[j]
				cg, cn := hg[o], hn[o] // chybí
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
						if nl < minListStromu || nr < minListStromu {
							continue
						}
						if zz := gl*gl/(nl+lambdaStromu) + gr*gr/(nr+lambdaStromu) - zakladZisk; zz > zisk {
							zisk = zz
							nejlepsi = uzelStromu{priznak: int32(j), kos: uint8(t), chybiVlevo: vlevo}
							nejL, nejR = souhrn{gl, nl}, souhrn{gr, nr}
						}
					}
				}
			}
			if nejlepsi.priznak < 0 {
				continue
			}
			nejlepsi.hodnota = s[u].hodnota
			nejlepsi.levy, nejlepsi.pravy = int32(len(s)), int32(len(s)+1)
			s[u] = nejlepsi
			s = append(s, uzelStromu{priznak: -1, hodnota: krokStromu * nejL.g / (nejL.n + lambdaStromu)},
				uzelStromu{priznak: -1, hodnota: krokStromu * nejR.g / (nejR.n + lambdaStromu)})
			celkem = append(celkem, nejL, nejR)
			dalsi = append(dalsi, nejlepsi.levy, nejlepsi.pravy)
			rodic = append(rodic, k)
		}
		posledni := hloubka == hloubkaStromu-1 || len(dalsi) == 0
		// Histogramy potomků: menší z dvojice se sečte z řádků, větší = rodič − menší
		var dg, dn []float64
		slot := make([]int, len(s)) // pozice potomka v histogramech dalšího patra, −1 = nepočítá se z řádků
		for u := range slot {
			slot[u] = -1
		}
		if !posledni {
			dg, dn = buffer(&d.hg2, len(dalsi)*K), buffer(&d.hn2, len(dalsi)*K)
			for x := 0; x < len(dalsi); x += 2 {
				l, p := dalsi[x], dalsi[x+1]
				if celkem[l].n <= celkem[p].n {
					slot[l] = x
				} else {
					slot[p] = x + 1
				}
			}
		}
		// Řádky do potomků rozdělených uzlů
		for _, i := range radky {
			u := &s[uzel[i]]
			if u.priznak < 0 {
				continue
			}
			k := d.kosy[i][u.priznak]
			if (k == 0 && u.chybiVlevo) || (k != 0 && k <= u.kos) {
				uzel[i] = u.levy
			} else {
				uzel[i] = u.pravy
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
		// Histogramy potomků se stanou histogramy patra (prohození bufferů)
		d.hg, d.hg2 = d.hg2, d.hg
		d.hn, d.hn2 = d.hn2, d.hn
		hg, hn = dg, dn
		patro = dalsi
	}
	return s
}

// Hranice košů číselného údaje z hodnot hodnocených modelek: nejvýš maxKosuStromu košů po kvantilech
// (hranice mezi různými hodnotami); koš hodnoty x = 1 + počet hranic ≤ x
func hraniceKosu(hodnoty []float64) []float64 {
	if len(hodnoty) == 0 {
		return nil
	}
	s := append([]float64(nil), hodnoty...)
	sort.Float64s(s)
	var hranice []float64
	for k := 1; k < maxKosuStromu; k++ {
		i := k * len(s) / maxKosuStromu
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

func kosHodnoty(hranice []float64, x float64) uint8 {
	k := 1
	for _, h := range hranice {
		if x >= h {
			k++
		}
	}
	return uint8(k)
}
