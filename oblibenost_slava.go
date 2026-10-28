package main

import (
	"math"
	"sort"
	"time"
)

// Síň slávy (popis v docs/UCENI.md, oddíl Síň slávy): kronika potvrzené top 10 – kdo kdy vstoupil, vypadl, obhájil
// místo a kdo byl jedničkou. Události vznikají po přepočtu oblíbenosti z rozdílu proti uloženým držitelkám úrovní
// (oblibenost_urovne.go) a zapisují se do trvalé tabulky kronika_slavy (denní snímky historie se po čase mažou,
// kronika ne). Vrácení porovnání smaže i události po něm. Z kroniky se počítá vitrína (současná top 10 s délkou
// pobytu), rekordy a legendy (bývalé top 10).

const (
	udalostZacatek       = "zacatek"  // kronika začala (modelka 0)
	udalostPocatek       = "pocatek"  // v top 10 už byla, když kronika začala
	udalostVstup         = "vstup"    // potvrdila se v top 10
	udalostVystup        = "vystup"   // z potvrzené top 10 vypadla
	udalostObhajoba      = "obhajoba" // vyhrála souboj o obhajobu místa v top 10
	udalostJednicka      = "jednicka" // nová jednička potvrzeného pořadí (i na začátku kroniky)
	udalostKonecJednicky = "konec"    // jednička přestala být potvrzená a nikdo ji nevystřídal
)

// Kolik nejnovějších událostí kroniky se posílá do rozhraní
const udalostiKroniky = 300

type udalostUrovne struct {
	modelka, misto, souperka int
	druh                     string
}

func jeVTop10(uroven int) bool { return uroven > 0 && uroven <= 10 }

// Události po přepočtu: stare = držitelky z uloženého stavu, m = nový model, obhajobyPred = kdo obhajoval v minulém
// modelu (v paměti; po spuštění programu není), nove = porovnání od uloženého stavu, zacatek = kronika ještě nezačala
// (zapíše se začátek a kdo už v top 10 je), jednicka = poslední zapsaná jednička (0 = žádná).
//
// Soupeřka u vstupu je poslední porazená z nových porovnání (přednost má ta, která zároveň z top 10 vypadla), u výpadku
// poslední vítězka (přednost má ta, která vstoupila), u obhajoby vyzyvatelka.
func udalostiSlavy(stare map[int]int, m *modelOblibenosti, obhajobyPred map[int]ObhajobaUrovne, nove []porovnaniZaznam, zacatek bool, jednicka int) []udalostUrovne {
	podleMista := func(ids []int) {
		sort.Slice(ids, func(i, j int) bool {
			if m.poradi[ids[i]] != m.poradi[ids[j]] {
				return m.poradi[ids[i]] < m.poradi[ids[j]]
			}
			return ids[i] < ids[j]
		})
	}
	var top []int
	jeTed := map[int]bool{}
	for id, u := range m.uroven {
		if jeVTop10(u) {
			top = append(top, id)
			jeTed[id] = true
		}
	}
	podleMista(top)
	prvni := 0
	if len(top) > 0 && m.poradi[top[0]] == 1 {
		prvni = top[0]
	}
	var v []udalostUrovne
	if zacatek {
		v = append(v, udalostUrovne{druh: udalostZacatek})
		for _, id := range top {
			v = append(v, udalostUrovne{modelka: id, druh: udalostPocatek, misto: m.poradi[id]})
		}
		if prvni > 0 {
			v = append(v, udalostUrovne{modelka: prvni, druh: udalostJednicka, misto: 1})
		}
		return v
	}
	vstoupila := func(id int) bool { return jeTed[id] && !jeVTop10(stare[id]) }
	vypadla := func(id int) bool { return jeVTop10(stare[id]) && !jeTed[id] }
	souperka := func(id int, vyhra bool, prednost func(int) bool) int {
		nalez := 0
		for i := len(nove) - 1; i >= 0; i-- {
			p := nove[i]
			if (p.a != id && p.b != id) || p.vysledek == "remiza" {
				continue
			}
			druha, vyhrala := p.b, p.vysledek == "a"
			if p.b == id {
				druha, vyhrala = p.a, p.vysledek == "b"
			}
			if vyhrala != vyhra {
				continue
			}
			if prednost(druha) {
				return druha
			}
			if nalez == 0 {
				nalez = druha
			}
		}
		return nalez
	}
	var vystupy, obhajeny []int
	for id, u := range stare {
		if jeVTop10(u) && !jeTed[id] {
			vystupy = append(vystupy, id)
		}
	}
	podleMista(vystupy)
	for _, id := range vystupy {
		v = append(v, udalostUrovne{modelka: id, druh: udalostVystup, misto: m.poradi[id], souperka: souperka(id, false, vstoupila)})
	}
	for _, id := range top {
		if vstoupila(id) {
			v = append(v, udalostUrovne{modelka: id, druh: udalostVstup, misto: m.poradi[id], souperka: souperka(id, true, vypadla)})
		}
	}
	// Obhajoba: od minulého stavu porazila vyzyvatelku (poslední rozhodnuté vzájemné porovnání) a v top 10 zůstala
	for id, o := range obhajobyPred {
		if o.Uroven != 10 || !jeTed[id] {
			continue
		}
		vitezka := 0
		for _, p := range nove {
			if klicDvojice(p.a, p.b) != klicDvojice(id, o.Vyzyvatelka) {
				continue
			}
			switch p.vysledek {
			case "a":
				vitezka = p.a
			case "b":
				vitezka = p.b
			}
		}
		if vitezka == id {
			obhajeny = append(obhajeny, id)
		}
	}
	podleMista(obhajeny)
	for _, id := range obhajeny {
		v = append(v, udalostUrovne{modelka: id, druh: udalostObhajoba, misto: m.poradi[id], souperka: obhajobyPred[id].Vyzyvatelka})
	}
	switch {
	case prvni == jednicka:
	case prvni > 0:
		v = append(v, udalostUrovne{modelka: prvni, druh: udalostJednicka, misto: 1, souperka: jednicka})
	default:
		v = append(v, udalostUrovne{modelka: jednicka, druh: udalostKonecJednicky})
	}
	return v
}

// Zápis událostí po porovnání posledni; volá se se zámkem
func (u *uceni) zapsatUdalostiSlavy(posledni int64, udalosti []udalostUrovne, nyni time.Time) {
	db := u.zajistit()
	if db == nil {
		return
	}
	tx, err := db.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()
	prikaz, err := tx.Prepare("INSERT INTO kronika_slavy (cas, porovnani_id, modelka_id, druh, misto, souperka) VALUES (?, ?, ?, ?, ?, ?)")
	if err != nil {
		return
	}
	defer prikaz.Close()
	cas := nyni.Format("2006-01-02 15:04:05")
	for _, x := range udalosti {
		if _, err := prikaz.Exec(cas, posledni, x.modelka, x.druh, x.misto, x.souperka); err != nil {
			varovatUceni("kronika síně slávy se nezapsala: %v", err)
			return
		}
	}
	tx.Commit()
}

type zaznamKroniky struct {
	cas                      time.Time
	casText                  string
	porovnani                int64
	modelka, misto, souperka int
	druh                     string
}

// Celá kronika od nejstarší; volá se se zámkem
func (u *uceni) nacistKroniku() []zaznamKroniky {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	radky, err := db.Query("SELECT cas, porovnani_id, modelka_id, druh, misto, souperka FROM kronika_slavy ORDER BY id")
	if err != nil {
		return nil
	}
	defer radky.Close()
	var v []zaznamKroniky
	for radky.Next() {
		var z zaznamKroniky
		if radky.Scan(&z.casText, &z.porovnani, &z.modelka, &z.druh, &z.misto, &z.souperka) == nil {
			z.cas, _ = time.ParseInLocation("2006-01-02 15:04:05", z.casText, time.Local)
			v = append(v, z)
		}
	}
	return v
}

// ---------------------------------------------------------------------------------------------------------
// Rozhraní

// Událost kroniky pro rozhraní (druh: zacatek, pocatek, vstup, vystup, obhajoba, jednicka, konec)
type UdalostSlavy struct {
	Cas       string `json:"cas"` // RRRR-MM-DD HH:MM:SS
	Druh      string `json:"druh"`
	ModelkaID int    `json:"modelkaId"`
	Misto     int    `json:"misto"`
	Souperka  int    `json:"souperka"` // 0 = žádná (nebo smazaná)
	// Druh "odznak": který odznak a stupeň (1 bronz, 2 stříbro, 3 zlato, 0 = jednorázový)
	Odznak string `json:"odznak,omitempty"`
	Stupen int    `json:"stupen,omitempty"`
}

// Modelka v síni slávy: současná top 10 (vitrína) nebo bývalá (legenda). Dny se počítají po celých 24 hodinách;
// odZacatku = pobyt začal už před kronikou, dny jsou „aspoň“.
type SlavaModelky struct {
	ModelkaID     int    `json:"modelkaId"` // 0 = modelka v kronice není
	Misto         int    `json:"misto"`     // současné potvrzené místo (0 = mimo pořadí)
	VTop          bool   `json:"vTop"`      // teď v potvrzené top 10
	Od            string `json:"od"`        // začátek současného pobytu (mimo top 10 prvního)
	Do            string `json:"do"`        // konec posledního pobytu (jen mimo top 10)
	OdZacatku     bool   `json:"odZacatku"`
	DniTed        int    `json:"dniTed"` // současný pobyt
	DniCelkem     int    `json:"dniCelkem"`
	DniNejdele    int    `json:"dniNejdele"`
	DniNaPrvnim   int    `json:"dniNaPrvnim"`
	Pobytu        int    `json:"pobytu"`
	Obhajob       int    `json:"obhajob"`
	NejlepsiMisto int    `json:"nejlepsiMisto"`
}

// Rekord síně slávy: nejdele (dny v top 10 celkem), vlada (nejdelší vláda jedničky ve dnech), obhajoby (počet),
// rychlost (vlastních porovnání do prvního vstupu do top 10), navrat (dny mimo top 10 před návratem)
type RekordSlavy struct {
	Druh      string `json:"druh"`
	ModelkaID int    `json:"modelkaId"`
	Hodnota   int    `json:"hodnota"`
	OdZacatku bool   `json:"odZacatku"` // započítaný pobyt začal před kronikou (hodnota je „aspoň“)
	Cas       string `json:"cas"`       // začátek vlády, první vstup, návrat (u ostatních prázdné)
	Trva      bool   `json:"trva"`      // rekord dál roste (vláda trvá, rekordmanka je v top 10)
}

type SinSlavy struct {
	Od      string          `json:"od"` // začátek kroniky ("" = ještě nezačala)
	Vitrina []SlavaModelky  `json:"vitrina"`
	Legendy []SlavaModelky  `json:"legendy"`
	Rekordy []RekordSlavy   `json:"rekordy"`
	Odznaky []OdznakModelky `json:"odznaky"` // získané odznaky a postup k dalším (oblibenost_odznaky.go)
	Kronika []UdalostSlavy  `json:"kronika"` // od nejnovější (i zisky odznaků)
}

// Síň slávy celé sbírky (přepočte oblíbenost, aby kronika byla aktuální)
func (a *App) GetSinSlavy() SinSlavy {
	prazdna := SinSlavy{Vitrina: []SlavaModelky{}, Legendy: []SlavaModelky{}, Rekordy: []RekordSlavy{}, Odznaky: []OdznakModelky{}, Kronika: []UdalostSlavy{}}
	if a.uc == nil {
		return prazdna
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	u := a.uc
	u.mu.Lock()
	kronika := u.nacistKroniku()
	porovnani := u.nacistPorovnani()
	snimky := u.nacistSnimkyPoradi()
	u.mu.Unlock()
	existuje := make(map[int]bool, len(modelky))
	for _, m := range modelky {
		existuje[m.ID] = true
	}
	return spocitatSinSlavy(kronika, model, porovnani, existuje, snimky, time.Now())
}

type pobytVTop struct {
	od, do    time.Time
	otevreny  bool
	odZacatku bool
}

// Dny mezi dvěma okamžiky podle kalendáře (včera večer → dnes ráno = 1 den; dřív po celých 24 hodinách, takže
// jednička od včerejška byla „od dneška“)
func dniMezi(od, do time.Time) int {
	if do.Before(od) {
		return 0
	}
	d0 := time.Date(od.Year(), od.Month(), od.Day(), 12, 0, 0, 0, time.Local)
	d1 := time.Date(do.Year(), do.Month(), do.Day(), 12, 0, 0, 0, time.Local)
	return int(math.Round(d1.Sub(d0).Hours() / 24))
}

// Denní snímek potvrzeného pořadí z historie oblíbenosti (jen snímky se značkou potvrzeného pořadí)
type snimekPoradi struct {
	den    time.Time
	poradi map[int]int
}

// Všechny snímky potvrzeného pořadí, od nejstaršího; volá se se zámkem
func (u *uceni) nacistSnimkyPoradi() []snimekPoradi {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	radky, err := db.Query("SELECT den, modelka_id, poradi FROM historie_oblibenosti ORDER BY den")
	if err != nil {
		return nil
	}
	defer radky.Close()
	var v []snimekPoradi
	potvrzeny := map[string]bool{}
	for radky.Next() {
		var den string
		var id, poradi int
		if radky.Scan(&den, &id, &poradi) != nil {
			continue
		}
		if len(v) == 0 || v[len(v)-1].den.Format("2006-01-02") != den {
			t, err := time.ParseInLocation("2006-01-02", den, time.Local)
			if err != nil {
				continue
			}
			v = append(v, snimekPoradi{den: t, poradi: map[int]int{}})
		}
		if id == znackaPotvrzenehoPoradi {
			potvrzeny[den] = poradi == 1
			continue
		}
		v[len(v)-1].poradi[id] = poradi
	}
	vysledek := v[:0]
	for _, s := range v {
		if potvrzeny[s.den.Format("2006-01-02")] {
			vysledek = append(vysledek, s)
		}
	}
	return vysledek
}

// Začátek souvislé řady snímků před kronikou, ve kterých modelka splňovala podminka(místo); zacatek, když žádný
// (mezery mezi snímky – dny, kdy program neběžel – řadu nepřeruší)
func pocatekZeSnimku(snimky []snimekPoradi, id int, zacatek time.Time, podminka func(int) bool) time.Time {
	od := zacatek
	den0 := time.Date(zacatek.Year(), zacatek.Month(), zacatek.Day(), 0, 0, 0, 0, time.Local)
	for i := len(snimky) - 1; i >= 0; i-- {
		if !snimky[i].den.Before(den0) {
			continue
		}
		if !podminka(snimky[i].poradi[id]) {
			break
		}
		od = snimky[i].den
	}
	return od
}

// snimky = denní snímky potvrzeného pořadí (i před začátkem kroniky): kdo byl v top 10 (jedničkou) už na začátku, má
// pobyt (vládu) od začátku souvislé řady snímků, kde byl v top 10 (první) – kronika mohla začít později než pobyt
func spocitatSinSlavy(kronika []zaznamKroniky, model *modelOblibenosti, porovnani []porovnaniZaznam, existuje map[int]bool, snimky []snimekPoradi, nyni time.Time) SinSlavy {
	s := SinSlavy{Vitrina: []SlavaModelky{}, Legendy: []SlavaModelky{}, Rekordy: []RekordSlavy{}, Odznaky: []OdznakModelky{}, Kronika: []UdalostSlavy{}}
	pobyty := map[int][]pobytVTop{}
	var vlady []vladaJednicky
	obhajobyCasy := map[int][]time.Time{}
	obhajob, nejlepsi := map[int]int{}, map[int]int{}
	naPrvnim := map[int]int{}
	var zacatek time.Time
	// Vláda jedničky: kdo, od kdy, jestli od začátku kroniky
	vladne, vladaOd, vladaOdZacatku := 0, time.Time{}, false
	vlada := RekordSlavy{Druh: "vlada", Hodnota: -1}
	ukoncitVladu := func(do time.Time) {
		if vladne == 0 {
			return
		}
		dni := dniMezi(vladaOd, do)
		naPrvnim[vladne] += dni
		vlady = append(vlady, vladaJednicky{modelka: vladne, od: vladaOd, do: do})
		if dni > vlada.Hodnota {
			vlada = RekordSlavy{Druh: "vlada", ModelkaID: vladne, Hodnota: dni, OdZacatku: vladaOdZacatku, Cas: vladaOd.Format("2006-01-02 15:04:05"), Trva: do.Equal(nyni)}
		}
		vladne = 0
	}
	zlepsit := func(id, misto int) {
		if misto > 0 && (nejlepsi[id] == 0 || misto < nejlepsi[id]) {
			nejlepsi[id] = misto
		}
	}
	navrat := RekordSlavy{Druh: "navrat", Hodnota: -1}
	rychlost := RekordSlavy{Druh: "rychlost", Hodnota: -1}
	prvniVstup := map[int]bool{}
	for _, z := range kronika {
		switch z.druh {
		case udalostZacatek:
			zacatek = z.cas
			s.Od = z.casText
		case udalostPocatek, udalostVstup:
			p := pobyty[z.modelka]
			if len(p) > 0 && p[len(p)-1].otevreny {
				continue
			}
			if len(p) > 0 && z.druh == udalostVstup {
				if dni := dniMezi(p[len(p)-1].do, z.cas); dni > navrat.Hodnota && existuje[z.modelka] {
					navrat = RekordSlavy{Druh: "navrat", ModelkaID: z.modelka, Hodnota: dni, Cas: z.casText}
				}
			}
			if z.druh == udalostVstup && len(p) == 0 && !prvniVstup[z.modelka] && existuje[z.modelka] {
				// Vlastní porovnání do prvního vstupu
				n := 0
				for _, q := range porovnani {
					if q.id <= z.porovnani && (q.a == z.modelka || q.b == z.modelka) {
						n++
					}
				}
				if rychlost.Hodnota < 0 || n < rychlost.Hodnota {
					rychlost = RekordSlavy{Druh: "rychlost", ModelkaID: z.modelka, Hodnota: n, Cas: z.casText}
				}
			}
			prvniVstup[z.modelka] = true
			od := z.cas
			if z.druh == udalostPocatek {
				od = pocatekZeSnimku(snimky, z.modelka, z.cas, func(m int) bool { return m > 0 && m <= 10 })
			}
			pobyty[z.modelka] = append(p, pobytVTop{od: od, otevreny: true, odZacatku: z.druh == udalostPocatek})
			zlepsit(z.modelka, z.misto)
		case udalostVystup:
			if p := pobyty[z.modelka]; len(p) > 0 && p[len(p)-1].otevreny {
				p[len(p)-1].otevreny, p[len(p)-1].do = false, z.cas
			}
		case udalostObhajoba:
			obhajob[z.modelka]++
			obhajobyCasy[z.modelka] = append(obhajobyCasy[z.modelka], z.cas)
			zlepsit(z.modelka, z.misto)
		case udalostJednicka:
			ukoncitVladu(z.cas)
			vladne, vladaOd, vladaOdZacatku = z.modelka, z.cas, z.cas.Equal(zacatek)
			if vladaOdZacatku {
				vladaOd = pocatekZeSnimku(snimky, z.modelka, z.cas, func(m int) bool { return m == 1 })
			}
			zlepsit(z.modelka, 1)
		case udalostKonecJednicky:
			ukoncitVladu(z.cas)
		}
	}
	ukoncitVladu(nyni)

	slava := func(id int) SlavaModelky {
		x := SlavaModelky{ModelkaID: id, Misto: model.poradi[id], VTop: jeVTop10(model.uroven[id]), Obhajob: obhajob[id],
			NejlepsiMisto: nejlepsi[id], DniNaPrvnim: naPrvnim[id]}
		if x.VTop {
			zlepsit(id, x.Misto)
			x.NejlepsiMisto = nejlepsi[id]
		}
		p := pobyty[id]
		x.Pobytu = len(p)
		for i, q := range p {
			do := q.do
			if q.otevreny {
				do = nyni
			}
			dni := dniMezi(q.od, do)
			x.DniCelkem += dni
			x.DniNejdele = max(x.DniNejdele, dni)
			if i == len(p)-1 {
				x.Od, x.OdZacatku = q.od.Format("2006-01-02 15:04:05"), q.odZacatku
				if q.otevreny {
					x.DniTed = dni
				} else {
					x.Do = q.do.Format("2006-01-02 15:04:05")
				}
			}
		}
		if !x.VTop && len(p) > 0 {
			x.Od, x.OdZacatku = p[0].od.Format("2006-01-02 15:04:05"), p[0].odZacatku
		}
		return x
	}
	// Vitrína: současná potvrzená top 10 podle místa
	var top []int
	for id, u := range model.uroven {
		if jeVTop10(u) && existuje[id] {
			top = append(top, id)
		}
	}
	sort.Slice(top, func(i, j int) bool { return model.poradi[top[i]] < model.poradi[top[j]] })
	for _, id := range top {
		s.Vitrina = append(s.Vitrina, slava(id))
	}
	// Legendy: bývalé top 10, nejdéle v top 10 napřed
	ids := make([]int, 0, len(pobyty))
	for id := range pobyty {
		if existuje[id] && !jeVTop10(model.uroven[id]) {
			ids = append(ids, id)
		}
	}
	sort.Ints(ids)
	for _, id := range ids {
		s.Legendy = append(s.Legendy, slava(id))
	}
	sort.SliceStable(s.Legendy, func(i, j int) bool {
		if s.Legendy[i].DniCelkem != s.Legendy[j].DniCelkem {
			return s.Legendy[i].DniCelkem > s.Legendy[j].DniCelkem
		}
		return s.Legendy[i].NejlepsiMisto < s.Legendy[j].NejlepsiMisto
	})
	// Rekordy (jen ty, které už něco mají; při shodě dřívější číslo modelky)
	vsechny := append(append([]SlavaModelky(nil), s.Vitrina...), s.Legendy...)
	sort.Slice(vsechny, func(i, j int) bool { return vsechny[i].ModelkaID < vsechny[j].ModelkaID })
	nejdele, obhajoby := RekordSlavy{Druh: "nejdele", Hodnota: -1}, RekordSlavy{Druh: "obhajoby", Hodnota: 0}
	for _, x := range vsechny {
		if x.Pobytu > 0 && x.DniCelkem > nejdele.Hodnota {
			nejdele = RekordSlavy{Druh: "nejdele", ModelkaID: x.ModelkaID, Hodnota: x.DniCelkem, OdZacatku: pobyty[x.ModelkaID][0].odZacatku, Trva: x.VTop}
		}
		if x.Obhajob > obhajoby.Hodnota {
			obhajoby = RekordSlavy{Druh: "obhajoby", ModelkaID: x.ModelkaID, Hodnota: x.Obhajob}
		}
	}
	// Odznaky a rekordy z porovnání a snímků (oblibenost_odznaky.go); pobyty s koncem (otevřený do teď)
	vstup := vstupOdznaku{pobyty: map[int][]pobytVTop{}, vlady: vlady, obhajobyCasy: obhajobyCasy, porovnani: porovnani,
		snimky: snimky, vTop: map[int]bool{}, existuje: existuje, nyni: nyni}
	for id, p := range pobyty {
		for _, q := range p {
			if q.otevreny {
				q.do = nyni
			}
			vstup.pobyty[id] = append(vstup.pobyty[id], q)
		}
	}
	for _, id := range top {
		vstup.vTop[id] = true
	}
	odznaky, zisky, dalsiRekordy := spocitatOdznaky(vstup)
	s.Odznaky = odznaky
	for _, r := range append([]RekordSlavy{nejdele, vlada, obhajoby, rychlost, navrat}, dalsiRekordy...) {
		if r.ModelkaID > 0 && existuje[r.ModelkaID] && r.Hodnota >= 0 {
			s.Rekordy = append(s.Rekordy, r)
		}
	}
	// Kronika od nejnovější (bez událostí smazaných modelek; smazaná soupeřka = 0), zisky odznaků zařazené podle času
	var udalosti []UdalostSlavy
	var casy []time.Time
	for _, z := range kronika {
		if z.druh != udalostZacatek && !existuje[z.modelka] {
			continue
		}
		souperka := z.souperka
		if !existuje[souperka] {
			souperka = 0
		}
		udalosti = append(udalosti, UdalostSlavy{Cas: z.casText, Druh: z.druh, ModelkaID: z.modelka, Misto: z.misto, Souperka: souperka})
		casy = append(casy, z.cas)
	}
	for _, z := range zisky {
		souperka := z.souperka
		if !existuje[souperka] {
			souperka = 0
		}
		udalosti = append(udalosti, UdalostSlavy{Cas: z.cas.Format("2006-01-02 15:04:05"), Druh: "odznak", ModelkaID: z.modelka, Souperka: souperka, Odznak: z.odznak, Stupen: z.stupen})
		casy = append(casy, z.cas)
	}
	poradi := make([]int, len(udalosti))
	for i := range poradi {
		poradi[i] = i
	}
	// Stabilně podle času: události kroniky ve stejné vteřině zůstanou v pořadí zápisu
	sort.SliceStable(poradi, func(i, j int) bool { return casy[poradi[i]].Before(casy[poradi[j]]) })
	for i := len(poradi) - 1; i >= 0 && len(s.Kronika) < udalostiKroniky; i-- {
		s.Kronika = append(s.Kronika, udalosti[poradi[i]])
	}
	return s
}
