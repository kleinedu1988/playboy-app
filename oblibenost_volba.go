package main

// Volba sezóny na jejím začátku: tři navržená témata (bez témat posledních sezón), Klasická a všechna témata
// pro los, každé s odhadem délky. Odhad: soutěžící by měly mít zhruba 6 soubojů (o titul soutěží od 3), tedy
// potřeba ≈ soutěžících × 3 soubojů; dělí se tempem uživatele (souboje za den za posledních 30 dní) a zaokrouhlí
// nahoru na nabízenou délku. Málo fotek tématu na modelku délku zkrátí (pásy by se brzy opakovaly).

import (
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"slices"
	"time"
)

const (
	soubojuNaSoutezici = 3   // potřeba soubojů sezóny na soutěžící (každý souboj má dvě)
	tempoBezHistorie   = 5.0 // soubojů za den, když ještě není z čeho počítat
	navrhuTemat        = 3
	poslednichBezOpak  = 3 // témata tolika posledních sezón se znovu nenavrhnou
)

// Téma s odhadem pro volbu sezóny
type NavrhTematu struct {
	InfoTematu
	Dni     int    `json:"dni"`     // doporučená délka
	Souboju int    `json:"souboju"` // kolik soubojů by sezóna potřebovala
	Duvod   string `json:"duvod"`   // proč téma nejde (málo soutěžících) nebo proč je délka zkrácená
	Ukazky  []int  `json:"ukazky"`  // až 4 soutěžící pro ukázkové fotky (nejvíc fotek tématu, v Klasické nejvýš v pořadí)
}

const ukazekTematu = 4

type NavrhSezony struct {
	Klic     string        `json:"klic"`     // sezóna, pro kterou se volí
	Den      int           `json:"den"`      // kolikátý den sezóny je dnes (delší než uplynulé dny volit nejde)
	Tempo    float64       `json:"tempo"`    // tvých soubojů za den
	Navrhy   []NavrhTematu `json:"navrhy"`   // tři navržená témata
	Klasicka NavrhTematu   `json:"klasicka"` // bez tématu
	Vsechna  []NavrhTematu `json:"vsechna"`  // celý katalog (los, jiné téma)
	Delky    []int         `json:"delky"`    // délky, které jde zvolit
}

// Tempo soubojů za den za posledních 30 dní (od prvního porovnání, je-li mladší)
func tempoSoubojuZa30(porovnani []porovnaniZaznam, nyni time.Time) float64 {
	if len(porovnani) == 0 {
		return tempoBezHistorie
	}
	od := nyni.AddDate(0, 0, -30)
	dni := 30.0
	if prvni := porovnani[0].cas; prvni.After(od) {
		od = prvni
		dni = max(1, nyni.Sub(prvni).Hours()/24)
	}
	n := 0
	for _, p := range porovnani {
		if !p.cas.Before(od) && p.cas.Before(nyni) {
			n++
		}
	}
	if n == 0 {
		return 1
	}
	return math.Round(float64(n)/dni*10) / 10
}

// Doporučená délka z nabídky: potřeba soubojů / tempo, nejvýš podle fotek na soutěžící (fotek 0 = bez omezení)
func doporucenaDelka(soutezicich, fotek int, tempo float64) (dni, souboju int, duvod string) {
	souboju = max(soutezicich, 1) * soubojuNaSoutezici
	potreba := int(math.Ceil(float64(souboju) / max(tempo, 0.1)))
	dni = delkySezon[len(delkySezon)-1]
	for _, d := range delkySezon {
		if d >= potreba {
			dni = d
			break
		}
	}
	if fotek > 0 && soutezicich > 0 {
		naModelku := fotek / soutezicich
		strop := 0
		switch {
		case naModelku < 10:
			strop = 14
		case naModelku < 20:
			strop = 21
		}
		if strop > 0 && dni > strop {
			dni = strop
			duvod = "kratší – málo fotek tématu na modelku"
		}
	}
	return dni, souboju, duvod
}

func navrhTematu(info InfoTematu, tempo float64) NavrhTematu {
	n := NavrhTematu{InfoTematu: info}
	n.Dni, n.Souboju, n.Duvod = doporucenaDelka(info.Soutezicich, info.Fotek, tempo)
	if !info.Plati {
		n.Duvod = fmt.Sprintf("jen %d %s, potřeba %d", info.Soutezicich, sklonovatSlovo(info.Soutezicich, "modelka", "modelky", "modelek"), minModelekTematu)
	}
	return n
}

// Návrh volby pro probíhající sezónu
func (a *App) GetNavrhSezony() NavrhSezony {
	nyni := time.Now()
	vysledek := NavrhSezony{Navrhy: []NavrhTematu{}, Vsechna: []NavrhTematu{}, Delky: delkySezon}
	if a.uc == nil {
		return vysledek
	}
	obdobi, o := a.obdobiSezon(nyni)
	vysledek.Klic = o.klic()
	vysledek.Den = int(zacatekDne(nyni).Sub(o.od).Hours()/24+0.5) + 1
	porovnani, poradi, _ := a.podkladySezon()
	vysledek.Tempo = tempoSoubojuZa30(porovnani, nyni)

	vPoradi := 0
	for _, m := range poradi {
		if m > 0 {
			vPoradi++
		}
	}
	vysledek.Klasicka = navrhTematu(InfoTematu{Tema: *temaZKlice(""), Soutezicich: vPoradi, Plati: true}, vysledek.Tempo)
	vysledek.Klasicka.Ukazky = nejlepsiUkazky(poradi, func(x, y int) bool { return x < y })

	// Témata posledních sezón před probíhající se nenavrhují
	nedavna := map[string]bool{}
	for i := len(obdobi) - 1; i >= 0 && len(nedavna) < poslednichBezOpak; i-- {
		if obdobi[i].od.Before(o.od) && obdobi[i].tema != "" {
			nedavna[obdobi[i].tema] = true
		}
	}
	var kandidati []NavrhTematu
	modelky, _ := a.nactiModelky("", false)
	fotky := a.fotkyProTemata()
	for i := range katalogTemat {
		t := katalogTemat[i]
		soutezici, fotek := souteziciTematu(&t, modelky, fotky)
		n := navrhTematu(InfoTematu{Tema: t, Soutezicich: len(soutezici), Fotek: fotek, Plati: len(soutezici) >= minModelekTematu}, vysledek.Tempo)
		n.Ukazky = nejlepsiUkazky(soutezici, func(x, y int) bool { return x > y })
		vysledek.Vsechna = append(vysledek.Vsechna, n)
		if n.Plati && !nedavna[n.Klic] {
			kandidati = append(kandidati, n)
		}
	}
	// Stejné návrhy při každém otevření téže sezóny
	h := fnv.New64a()
	h.Write([]byte(vysledek.Klic))
	r := rand.New(rand.NewSource(int64(h.Sum64())))
	r.Shuffle(len(kandidati), func(i, j int) { kandidati[i], kandidati[j] = kandidati[j], kandidati[i] })
	vysledek.Navrhy = append(vysledek.Navrhy, kandidati[:min(navrhuTemat, len(kandidati))]...)
	slices.SortStableFunc(vysledek.Vsechna, func(x, y NavrhTematu) int {
		if x.Plati != y.Plati {
			if x.Plati {
				return -1
			}
			return 1
		}
		return y.Soutezicich - x.Soutezicich
	})
	return vysledek
}

// Až ukazekTematu modelek s nejlepší hodnotou (lepsi), při shodě nižší id; hodnota 0 se nebere
func nejlepsiUkazky(hodnoty map[int]int, lepsi func(x, y int) bool) []int {
	ids := []int{}
	for id, h := range hodnoty {
		if h > 0 {
			ids = append(ids, id)
		}
	}
	slices.SortFunc(ids, func(x, y int) int {
		switch {
		case hodnoty[x] == hodnoty[y]:
			return x - y
		case lepsi(hodnoty[x], hodnoty[y]):
			return -1
		}
		return 1
	})
	return ids[:min(ukazekTematu, len(ids))]
}
