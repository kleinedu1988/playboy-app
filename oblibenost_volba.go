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
	Stitek  string `json:"stitek"`  // „vzácné“ (málo soutěžících), „poprvé“ (ještě neběželo)
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

	// Témata posledních sezón před probíhající se nenavrhují; skupina minulé sezóny má menší váhu
	nedavna := map[string]bool{}
	behla := map[string]bool{}
	skupinaMinule := ""
	for i := len(obdobi) - 1; i >= 0; i-- {
		tm := temaZKlice(obdobi[i].tema)
		if !obdobi[i].od.Before(o.od) || tm == nil || tm.Klic == "" {
			continue
		}
		// Témata posledních zvolených tematických sezón (Klasické se nepočítají)
		behla[tm.Klic] = true
		if len(nedavna) < poslednichBezOpak {
			nedavna[tm.Klic] = true
		}
		if skupinaMinule == "" {
			skupinaMinule = tm.Skupina
		}
	}
	var kandidati []NavrhTematu
	for i := range katalogTemat {
		t := katalogTemat[i]
		soutezici, fotek := a.souteziciTematuSbirky(&t)
		n := navrhTematu(InfoTematu{Tema: t, Soutezicich: len(soutezici), Fotek: fotek, Plati: len(soutezici) >= minModelekTematu}, vysledek.Tempo)
		n.Ukazky = nejlepsiUkazky(soutezici, func(x, y int) bool { return x > y })
		vysledek.Vsechna = append(vysledek.Vsechna, n)
		// Téma, ve kterém by soutěžila skoro celá sbírka (přes 70 % pořadí), je prakticky Klasická
		if n.Plati && !nedavna[n.Klic] && (vPoradi < 20 || n.Soutezicich*10 <= vPoradi*7) {
			if !behla[n.Klic] {
				n.Stitek = "poprvé"
			}
			kandidati = append(kandidati, n)
		}
	}
	// Stejné návrhy při každém otevření téže sezóny
	h := fnv.New64a()
	h.Write([]byte(vysledek.Klic))
	r := rand.New(rand.NewSource(int64(h.Sum64())))
	vysledek.Navrhy = append(vysledek.Navrhy, vybratNavrhyTemat(kandidati, skupinaMinule, r)...)
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

// Tři návrhy po slotech: éra nebo kalendář · styl nebo místo · původ, půvab nebo kombinace (zhruba ve třetině
// sezón místo něj „vzácné“ téma z dolní třetiny podle soutěžících). Uvnitř slotu losem s váhou √soutěžících ×
// novost (téma, které ještě neběželo, ×1,5; skupina minulé sezóny ×0,6). Prázdný slot doplní zbylá témata.
var slotyNavrhu = [][]string{{skupinaEra, skupinaKalendar}, {skupinaStyl, skupinaMisto}, {skupinaPuvod, skupinaPuvab, skupinaKombinace}}

func vybratNavrhyTemat(kandidati []NavrhTematu, skupinaMinule string, r *rand.Rand) []NavrhTematu {
	vaha := func(n NavrhTematu) float64 {
		v := math.Sqrt(float64(max(n.Soutezicich, 1)))
		if n.Stitek == "poprvé" {
			v *= 1.5
		}
		if skupinaMinule != "" && n.Skupina == skupinaMinule {
			v *= 0.6
		}
		return v
	}
	vybrane := map[string]bool{}
	losovat := func(seznam []NavrhTematu) (NavrhTematu, bool) {
		celkem := 0.0
		for _, n := range seznam {
			celkem += vaha(n)
		}
		if celkem == 0 {
			return NavrhTematu{}, false
		}
		x := r.Float64() * celkem
		for _, n := range seznam {
			if x -= vaha(n); x <= 0 {
				return n, true
			}
		}
		return seznam[len(seznam)-1], true
	}
	volne := func(ok func(NavrhTematu) bool) []NavrhTematu {
		var v []NavrhTematu
		for _, n := range kandidati {
			if !vybrane[n.Klic] && ok(n) {
				v = append(v, n)
			}
		}
		return v
	}
	// Vzácné: dolní třetina platných témat podle počtu soutěžících
	pocty := make([]int, 0, len(kandidati))
	for _, n := range kandidati {
		pocty = append(pocty, n.Soutezicich)
	}
	slices.Sort(pocty)
	hraniceVzacnych := 0
	if len(pocty) >= 6 {
		hraniceVzacnych = pocty[len(pocty)/3]
	}
	navrhy := []NavrhTematu{}
	for i, skupiny := range slotyNavrhu {
		seznam := volne(func(n NavrhTematu) bool { return slices.Contains(skupiny, n.Skupina) })
		vzacne := i == len(slotyNavrhu)-1 && hraniceVzacnych > 0 && r.Intn(3) == 0
		if vzacne {
			if v := volne(func(n NavrhTematu) bool { return n.Soutezicich < hraniceVzacnych }); len(v) > 0 {
				seznam = v
			} else {
				vzacne = false
			}
		}
		if len(seznam) == 0 {
			seznam = volne(func(NavrhTematu) bool { return true })
		}
		if n, ok := losovat(seznam); ok {
			if vzacne {
				n.Stitek = "vzácné"
			}
			vybrane[n.Klic] = true
			navrhy = append(navrhy, n)
		}
	}
	return navrhy
}
