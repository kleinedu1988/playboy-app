package main

import (
	"sort"
	"time"
)

// Odznaky síně slávy (popis v docs/UCENI.md, oddíl Odznaky): osobní úspěchy modelek, které může mít víc modelek
// naráz. Stupňové (bronz, stříbro, zlato) za dny v Top 10, dny na 1. místě, obhajoby, sérii výher a počet
// porovnání; jednorázové za příběhy (raketa, comeback, David a Goliáš, přeskočená laťka, neporazitelná). Počítají se
// při každém čtení síně slávy z kroniky, porovnání a denních snímků pořadí – nic se neukládá, takže vrácení porovnání
// odznak zase vezme. Zisk každého stupně je v kronice událostí „odznak“ s časem, kdy modelka práh překročila.

// Prahy stupňových odznaků (bronz, stříbro, zlato)
var prahyOdznaku = map[string][3]int{
	"stalice":   {30, 100, 365}, // dní v Top 10 celkem
	"kralovna":  {7, 30, 100},   // dní na 1. místě celkem
	"hradba":    {3, 5, 10},     // obhajob místa v Top 10
	"serie":     {5, 10, 20},    // výher v porovnání za sebou (remíza sérii nepřeruší ani neprodlouží)
	"zasluzena": {25, 50, 100},  // porovnání
	"favoritka": {1, 3, 6},      // titulů Favoritka sezóny (oblibenost_sezony.go)
}

const (
	dnyRakety          = 30 // raketa: do Top 10 z místa za 100 (nebo mimo pořadí) do tolika dní
	mistoRakety        = 100
	dnyComebacku       = 30 // comeback: návrat do Top 10 po aspoň tolika dnech venku
	mistoDavida        = 20 // David a Goliáš: porazila jedničku z místa za 20 (nebo mimo pořadí)
	dnyNeporazitelne   = 30 // neporazitelná: tolik dní v Top 10 bez prohry…
	porovnaniNeporazit = 3  // …a aspoň tolik rozhodnutých porovnání za tu dobu
	dnySkoku           = 7  // rekord skok: největší posun v pořadí do týdne
)

// Odznak modelky: Stupen 1–3 u stupňových (0 = zatím nezískaný, jen postup), 0 u jednorázových (Ziskan říká, jestli
// ho má). Hodnota = dnešní hodnota (dny, počet), Dalsi = práh dalšího stupně (0 = nejvyšší nebo jednorázový).
// Souperka = koho porazila (David a Goliáš, laťka). Cas = zisk posledního stupně.
type OdznakModelky struct {
	ModelkaID int    `json:"modelkaId"`
	Odznak    string `json:"odznak"`
	Stupen    int    `json:"stupen"`
	Ziskan    bool   `json:"ziskan"`
	Hodnota   int    `json:"hodnota"`
	Dalsi     int    `json:"dalsi"`
	Souperka  int    `json:"souperka"`
	Cas       string `json:"cas"`
}

type vladaJednicky struct {
	modelka int
	od, do  time.Time
}

// Zisk odznaku pro kroniku
type ziskOdznaku struct {
	cas      time.Time
	modelka  int
	odznak   string
	stupen   int
	souperka int
}

// Vstupy do výpočtu odznaků (z výpočtu síně slávy)
type vstupOdznaku struct {
	pobyty       map[int][]pobytVTop // otevřený pobyt má do = nyni
	vlady        []vladaJednicky
	obhajobyCasy map[int][]time.Time
	porovnani    []porovnaniZaznam
	snimky       []snimekPoradi
	vTop         map[int]bool // dnes v potvrzené top 10
	existuje     map[int]bool
	favoritky    map[int][]time.Time // tituly Favoritka sezóny od nejstaršího
	nyni         time.Time
}

// Kdy součet intervalů [od, do) poprvé dosáhne práh dní (podle kalendáře jako dniMezi); nulový čas = nedosáhne
func kdyDniDosahnou(intervaly [][2]time.Time, prah int) time.Time {
	soucet := 0
	for _, iv := range intervaly {
		dni := dniMezi(iv[0], iv[1])
		if soucet+dni >= prah {
			return iv[0].AddDate(0, 0, prah-soucet)
		}
		soucet += dni
	}
	return time.Time{}
}

// Místo modelky v posledním snímku pořadí ke dni cas (0 = mimo pořadí; ok false = snímek není)
func mistoVeSnimku(snimky []snimekPoradi, id int, cas time.Time) (int, bool) {
	k := sort.Search(len(snimky), func(i int) bool { return snimky[i].den.After(cas) })
	if k == 0 {
		return 0, false
	}
	return snimky[k-1].poradi[id], true
}

func spocitatOdznaky(v vstupOdznaku) (odznaky []OdznakModelky, zisky []ziskOdznaku, rekordy []RekordSlavy) {
	odznaky = []OdznakModelky{}
	// Stupňový odznak: časy dosažení prahů → zisky, odznak (i nezískaný s postupem u modelek v top 10)
	stupnovy := func(id int, druh string, hodnota int, kdy func(prah int) time.Time) {
		prahy := prahyOdznaku[druh]
		o := OdznakModelky{ModelkaID: id, Odznak: druh, Hodnota: hodnota}
		for i, prah := range prahy {
			if hodnota < prah {
				o.Dalsi = prah
				break
			}
			cas := kdy(prah)
			if cas.IsZero() || cas.After(v.nyni) {
				cas = v.nyni
			}
			o.Stupen, o.Ziskan, o.Cas = i+1, true, cas.Format("2006-01-02 15:04:05")
			zisky = append(zisky, ziskOdznaku{cas: cas, modelka: id, odznak: druh, stupen: i + 1})
		}
		// Nezískaný: jen u modelek v top 10, aspoň v polovině cesty k bronzu
		if o.Ziskan || (v.vTop[id] && hodnota*2 >= prahy[0]) {
			odznaky = append(odznaky, o)
		}
	}
	jednorazovy := func(id int, druh string, cas time.Time, souperka int) {
		odznaky = append(odznaky, OdznakModelky{ModelkaID: id, Odznak: druh, Ziskan: true, Souperka: souperka, Cas: cas.Format("2006-01-02 15:04:05")})
		zisky = append(zisky, ziskOdznaku{cas: cas, modelka: id, odznak: druh, souperka: souperka})
	}
	ids := map[int]bool{}
	for id := range v.pobyty {
		ids[id] = true
	}
	for _, p := range v.porovnani {
		ids[p.a], ids[p.b] = true, true
	}
	serazene := make([]int, 0, len(ids))
	for id := range ids {
		if v.existuje[id] {
			serazene = append(serazene, id)
		}
	}
	sort.Ints(serazene)

	// Porovnání každé modelky podle čísla (pořadí, ve kterém vznikla)
	porovnaniModelky := map[int][]porovnaniZaznam{}
	for _, p := range v.porovnani {
		if p.a == p.b {
			continue
		}
		porovnaniModelky[p.a] = append(porovnaniModelky[p.a], p)
		porovnaniModelky[p.b] = append(porovnaniModelky[p.b], p)
	}
	casPorovnani := func(p porovnaniZaznam) time.Time {
		if p.cas.IsZero() {
			return v.nyni
		}
		return p.cas
	}
	// Výsledek pro modelku: 1 výhra, 0 prohra, -1 remíza; soupeřka a srdíčka obou v okamžiku porovnání
	vysledek := func(id int, p porovnaniZaznam) (y, souperka int, h, hS float64) {
		y, souperka, h, hS = -1, p.b, p.ha, p.hb
		if p.b == id {
			souperka, h, hS = p.a, p.hb, p.ha
		}
		switch {
		case p.vysledek == "a" && p.a == id, p.vysledek == "b" && p.b == id:
			y = 1
		case p.vysledek == "a" || p.vysledek == "b":
			y = 0
		}
		return
	}
	jednickaV := func(cas time.Time) int {
		for _, x := range v.vlady {
			if !cas.Before(x.od) && cas.Before(x.do) {
				return x.modelka
			}
		}
		return 0
	}

	rekordSerie := RekordSlavy{Druh: "serie", Hodnota: -1}
	rekordPorovnani := RekordSlavy{Druh: "porovnani", Hodnota: -1}
	for _, id := range serazene {
		// Stálice a královna
		var vTop, naPrvnim [][2]time.Time
		dniTop, dniPrvni := 0, 0
		for _, p := range v.pobyty[id] {
			vTop = append(vTop, [2]time.Time{p.od, p.do})
			dniTop += dniMezi(p.od, p.do)
		}
		for _, x := range v.vlady {
			if x.modelka == id {
				naPrvnim = append(naPrvnim, [2]time.Time{x.od, x.do})
				dniPrvni += dniMezi(x.od, x.do)
			}
		}
		stupnovy(id, "stalice", dniTop, func(prah int) time.Time { return kdyDniDosahnou(vTop, prah) })
		stupnovy(id, "kralovna", dniPrvni, func(prah int) time.Time { return kdyDniDosahnou(naPrvnim, prah) })
		obh := v.obhajobyCasy[id]
		stupnovy(id, "hradba", len(obh), func(prah int) time.Time { return obh[prah-1] })

		// Série, zasloužená, David a Goliáš, laťka
		pm := porovnaniModelky[id]
		serie, nejdelsi := 0, 0
		var casySerie []time.Time // čas, kdy nejdelší série poprvé dosáhla délky i+1
		var david, latka *porovnaniZaznam
		for i := range pm {
			p := pm[i]
			y, souperka, h, hS := vysledek(id, p)
			switch y {
			case 1:
				serie++
				if serie > nejdelsi {
					nejdelsi = serie
					casySerie = append(casySerie, casPorovnani(p))
				}
				if latka == nil && h > 0 && hS-h >= 1 {
					latka = &pm[i]
				}
				if david == nil && souperka == jednickaV(casPorovnani(p)) {
					if misto, ok := mistoVeSnimku(v.snimky, id, casPorovnani(p)); ok && (misto == 0 || misto > mistoDavida) {
						david = &pm[i]
					}
				}
			case 0:
				serie = 0
			}
		}
		stupnovy(id, "serie", nejdelsi, func(prah int) time.Time { return casySerie[prah-1] })
		stupnovy(id, "zasluzena", len(pm), func(prah int) time.Time { return casPorovnani(pm[prah-1]) })
		if david != nil {
			_, souperka, _, _ := vysledek(id, *david)
			jednorazovy(id, "david", casPorovnani(*david), souperka)
		}
		if latka != nil {
			_, souperka, _, _ := vysledek(id, *latka)
			jednorazovy(id, "latka", casPorovnani(*latka), souperka)
		}
		if nejdelsi > rekordSerie.Hodnota {
			rekordSerie = RekordSlavy{Druh: "serie", ModelkaID: id, Hodnota: nejdelsi, Trva: serie == nejdelsi && nejdelsi > 0}
			if len(casySerie) > 0 {
				rekordSerie.Cas = casySerie[len(casySerie)-1].Format("2006-01-02 15:04:05")
			}
		}
		if len(pm) > rekordPorovnani.Hodnota {
			rekordPorovnani = RekordSlavy{Druh: "porovnani", ModelkaID: id, Hodnota: len(pm)}
		}

		// Raketa a comeback: u každého vstupu (ne pobytu od začátku kroniky)
		pobyty := v.pobyty[id]
		raketa, comeback := false, false
		for i, p := range pobyty {
			if p.odZacatku {
				continue
			}
			if !comeback && i > 0 && dniMezi(pobyty[i-1].do, p.od) >= dnyComebacku {
				comeback = true
				jednorazovy(id, "comeback", p.od, 0)
			}
			if !raketa {
				od := p.od.AddDate(0, 0, -dnyRakety)
				for _, s := range v.snimky {
					if s.den.Before(od) || !s.den.Before(p.od) {
						continue
					}
					if m := s.poradi[id]; m == 0 || m > mistoRakety {
						raketa = true
						jednorazovy(id, "raketa", p.od, 0)
						break
					}
				}
			}
		}

		// Neporazitelná: 30 dní v jednom pobytu v Top 10 bez prohry a s aspoň 3 rozhodnutými porovnáními
	neporazitelna:
		for _, p := range pobyty {
			start, rozhodnutych := p.od, 0
			zkusit := func(do time.Time) bool {
				konec := start.AddDate(0, 0, dnyNeporazitelne)
				if rozhodnutych >= porovnaniNeporazit && !konec.After(do) {
					jednorazovy(id, "neporazitelna", konec, 0)
					return true
				}
				return false
			}
			for _, q := range pm {
				c := casPorovnani(q)
				if c.Before(p.od) || !c.Before(p.do) {
					continue
				}
				if zkusit(c) {
					break neporazitelna
				}
				switch y, _, _, _ := vysledek(id, q); y {
				case 1:
					rozhodnutych++
				case 0:
					start, rozhodnutych = c, 0
				}
			}
			if zkusit(p.do) {
				break
			}
		}
	}

	// Rekord skok: největší posun v potvrzeném pořadí mezi snímky nejvýš týden od sebe (jen modelky v obou)
	skok := RekordSlavy{Druh: "skok", Hodnota: 0}
	for j, s := range v.snimky {
		for i := j - 1; i >= 0 && dniMezi(v.snimky[i].den, s.den) <= dnySkoku; i-- {
			for id, m := range s.poradi {
				if m0 := v.snimky[i].poradi[id]; m0 > 0 && m > 0 && m0-m > skok.Hodnota && v.existuje[id] {
					skok = RekordSlavy{Druh: "skok", ModelkaID: id, Hodnota: m0 - m, Cas: s.den.Format("2006-01-02 15:04:05")}
				}
			}
		}
	}
	rekordy = []RekordSlavy{rekordSerie, rekordPorovnani}
	if skok.Hodnota > 0 {
		rekordy = append(rekordy, skok)
	}
	// Favoritka sezóny: tituly z uzavřených sezón (kronika)
	idsFavoritek := make([]int, 0, len(v.favoritky))
	for id := range v.favoritky {
		if v.existuje[id] {
			idsFavoritek = append(idsFavoritek, id)
		}
	}
	sort.Ints(idsFavoritek)
	for _, id := range idsFavoritek {
		casy := v.favoritky[id]
		stupnovy(id, "favoritka", len(casy), func(prah int) time.Time { return casy[prah-1] })
	}
	sort.SliceStable(odznaky, func(i, j int) bool {
		if odznaky[i].ModelkaID != odznaky[j].ModelkaID {
			return odznaky[i].ModelkaID < odznaky[j].ModelkaID
		}
		return odznaky[i].Odznak < odznaky[j].Odznak
	})
	return odznaky, zisky, rekordy
}

// Získané odznaky jedné modelky (profil); spočítá celou síň slávy
func (a *App) GetOdznakyModelky(modelkaID int) []OdznakModelky {
	v := []OdznakModelky{}
	for _, o := range a.GetSinSlavy().Odznaky {
		if o.ModelkaID == modelkaID && o.Ziskan {
			v = append(v, o)
		}
	}
	return v
}
