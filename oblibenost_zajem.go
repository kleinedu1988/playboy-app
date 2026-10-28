package main

import (
	"fmt"
	"math"
	"sort"
	"time"
)

// Zájem o modelky a vývoj oblíbenosti v čase (popis v docs/UCENI.md, oddíl Zájem a trend):
//
//   - Zájem: otevření profilu modelky (stejná modelka nejvýš jednou za 10 minut) a čas prohlížení jejích fotek
//     v prohlížeči. Ukládá se do databáze učení (tabulka zajem), nikdy do sbírky. Každý záznam váží podle stáří
//     0,5^(dny/60), takže oblíbenost sleduje, o koho se zajímáš teď, ne před rokem.
//   - Zájem posouvá předpoklad síly modelky v Bradley–Terry o v·z: z ∈ [0, 2] je zájem modelky proti mediánu
//     sbírky (logaritmicky, aby desítky otevření nepřeválcovaly všechno), v se program učí z porovnání modelek se
//     stejnými srdíčky (výchozí 0,1, nejvýš 0,3 srdíčka na jednotku z). Oblíbenost hodnocené modelky dál zůstává
//     do ±0,49 od jejích srdíček: zájem přeskupí pořadí uvnitř úrovně, srdíčka nepřebije.
//   - Historie: snímek oblíbenosti a pořadí jednou denně (dnešní se přepíše nejvýš jednou za hodinu). Po 60 dnech
//     zůstane jeden snímek na týden (pondělí), po 400 dnech nic. Trend = posun proti snímku z doby před 30 dny,
//     dokud není, proti nejstaršímu aspoň 7 dní starému. Pořadí ve snímku je potvrzené (s úrovněmi Top N); snímek
//     ze starší verze (bez značky potvrzeného pořadí) se srovnává podle oblíbenosti, aby úrovně po přechodu
//     nevypadaly jako pád nepotvrzených.
//
// Nové záznamy zájmu výsledek v paměti nezneplatní každý zvlášť (přepočet modelu vkusu stojí desítky ms): projeví
// se po každých 20 záznamech, po změně dat nebo druhý den.

const (
	minPorovnaniZajmu    = 10   // z méně porovnání, na kterých váha zájmu něco mění, se neučí
	polocasZajmu         = 60.0 // dny: zájem starý dva měsíce váží polovinou
	pauzaProfilu         = 10 * time.Minute
	maxSekundZaznamu     = 1800  // jeden záznam prohlížení fotek nejvýš půl hodiny
	minSekundZaznamu     = 3     // kratší prohlížení se nezapisuje
	sekundNaProfil       = 120.0 // dvě minuty prohlížení fotek váží jako jedno otevření profilu
	maxZajmu             = 2.0   // z nejvýš dvojnásobek mediánu sbírky
	vychoziVahaZajmu     = 0.1
	maxVahaZajmu         = 0.3
	krokVahyZajmu        = 0.025
	silaPredpokladuZajmu = 20.0 // naučená váha se stahuje k výchozí, jako by výchozí potvrdilo 20 porovnání
	zaznamuNaPrepocet    = 20
	dnyNedavnehoZajmu    = 60
	dnyTrendu            = 30
	minDnyTrendu         = 7
	dnyDennichSnimku     = 60
	dnyHistorie          = 400
	dnyZaznamuZajmu      = 730 // starší záznamy zájmu váží pod 0,02 % a mažou se
	dnyDlouhoNevidene    = 30
	modelekPrehledu      = 10
	// Značka ve snímku historie (řádek s modelka_id 0 a poradi 1): pořadí ve snímku je potvrzené s úrovněmi Top N
	znackaPotvrzenehoPoradi = 0
)

// Zájem o jednu modelku z databáze učení
type zajemModelky struct {
	skore    float64 // součet vah podle stáří (otevření profilu = 1, dvě minuty fotek = 1)
	profil   int     // otevření profilu za posledních 60 dní
	sekund   int     // sekund prohlížení fotek za posledních 60 dní
	posledni time.Time
}

type stavZajmu struct {
	modelky map[int]zajemModelky
	od      time.Time // nejstarší záznam: od kdy se zájem sleduje
}

// Snímek oblíbenosti modelky ze dne
type snimekOblibenosti struct {
	oblibenost float64
	poradi     int
}

// Naučená váha zájmu v předpokladu síly
type vysledekZajmu struct {
	vaha      float64
	naucena   bool
	porovnani int // porovnání modelek se stejnými srdíčky a různým zájmem
}

// Porovnání pro učení váhy zájmu: předpoklady stran bez zájmu, jejich zájem, výsledek a váha podle stáří
type porovnaniZajmu struct {
	pi, pj, zi, zj, y, t float64
}

// ---------------------------------------------------------------------------------------------------------
// Rozhraní

// Zápis zájmu o modelku: druh "profil" (otevření profilu) nebo "fotky" (sekund prohlížení jejích fotek)
func (a *App) ZaznamenatZajem(modelkaID int, druh string, sekund int) bool {
	u := a.uc
	if u == nil || modelkaID <= 0 {
		return false
	}
	switch druh {
	case "profil":
		sekund = 0
	case "fotky":
		if sekund < minSekundZaznamu {
			return false
		}
		sekund = min(sekund, maxSekundZaznamu)
	default:
		return false
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	nyni := time.Now()
	if druh == "profil" {
		if t, ok := u.ob.profily[modelkaID]; ok && nyni.Sub(t) < pauzaProfilu {
			return true
		}
	}
	db := u.zajistit()
	if db == nil {
		return false
	}
	if _, err := db.Exec("INSERT INTO zajem (cas, modelka_id, druh, sekund) VALUES (?, ?, ?, ?)",
		nyni.Format("2006-01-02 15:04:05"), modelkaID, druh, sekund); err != nil {
		varovatUceni("zájem se nezapsal: %v", err)
		return false
	}
	if druh == "profil" {
		if u.ob.profily == nil {
			u.ob.profily = map[int]time.Time{}
		}
		u.ob.profily[modelkaID] = nyni
	}
	u.ob.zaznamuZajmu++
	return true
}

// Přehled oblíbenosti pro úvod Přehledu a část Oblíbenost: nejoblíbenější, stoupající a klesající modelky
// a oblíbené, které uživatel dlouho neotevřel
type PrehledOblibenosti struct {
	Top            []PolozkaOblibenosti `json:"top"`
	Stoupaji       []PolozkaOblibenosti `json:"stoupaji"`
	Klesaji        []PolozkaOblibenosti `json:"klesaji"`
	DlouhoNevidene []PolozkaOblibenosti `json:"dlouhoNevidene"`
	TrendDni       int                  `json:"trendDni"` // stáří srovnávacího snímku; 0 = historie zatím chybí
	ZajemDni       int                  `json:"zajemDni"` // jak dlouho se zájem sleduje (dny)
}

type PolozkaOblibenosti struct {
	ModelkaID   int     `json:"modelkaId"`
	Jmeno       string  `json:"jmeno"`
	Hodnoceni   float64 `json:"hodnoceni"`
	Poradi      int     `json:"poradi"`      // potvrzené pořadí
	ZmenaPoradi int     `json:"zmenaPoradi"` // o kolik míst výš než ve srovnávacím snímku (záporné = níž)
	Dni         int     `json:"dni"`         // dlouho neviděné: dní od posledního zájmu, −1 = od začátku sledování nikdy
	Uroven      int     `json:"uroven"`      // potvrzená úroveň Top N (10, 20, 50, 100; 0 = mimo top 100)
}

func (a *App) GetPrehledOblibenosti() PrehledOblibenosti {
	p := PrehledOblibenosti{Top: []PolozkaOblibenosti{}, Stoupaji: []PolozkaOblibenosti{}, Klesaji: []PolozkaOblibenosti{}, DlouhoNevidene: []PolozkaOblibenosti{}}
	if a.uc == nil {
		return p
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	nyni := time.Now()
	p.TrendDni = model.trendDni
	if !model.zajemOd.IsZero() {
		p.ZajemDni = int(nyni.Sub(model.zajemOd).Hours() / 24)
	}
	podleId := make(map[int]*Modelka, len(modelky))
	for i := range modelky {
		podleId[modelky[i].ID] = &modelky[i]
	}
	polozka := func(id int) PolozkaOblibenosti {
		m := podleId[id]
		return PolozkaOblibenosti{ModelkaID: id, Jmeno: m.Jmeno, Hodnoceni: m.Hodnoceni, Poradi: model.poradi[id], ZmenaPoradi: model.zmenaPoradi[id], Uroven: model.uroven[id]}
	}
	poradi := model.seznamPoradi()
	// Top: jen potvrzené v top 10 (dokud jich není deset, je jich méně, i žádná)
	for _, id := range poradi[:min(len(poradi), modelekPrehledu)] {
		if model.uroven[id] == modelekPrehledu {
			p.Top = append(p.Top, polozka(id))
		}
	}
	// Stoupající a klesající: posun aspoň o 3 místa a aspoň o 3 % délky pořadí (u velké sbírky není posun o tři
	// místa z tisíce nic), největší posun napřed
	prah := max(3, len(poradi)*3/100)
	for _, id := range poradi {
		switch z := model.zmenaPoradi[id]; {
		case z >= prah:
			p.Stoupaji = append(p.Stoupaji, polozka(id))
		case z <= -prah:
			p.Klesaji = append(p.Klesaji, polozka(id))
		}
	}
	sort.SliceStable(p.Stoupaji, func(i, j int) bool { return p.Stoupaji[i].ZmenaPoradi > p.Stoupaji[j].ZmenaPoradi })
	sort.SliceStable(p.Klesaji, func(i, j int) bool { return p.Klesaji[i].ZmenaPoradi < p.Klesaji[j].ZmenaPoradi })
	p.Stoupaji, p.Klesaji = p.Stoupaji[:min(len(p.Stoupaji), modelekPrehledu)], p.Klesaji[:min(len(p.Klesaji), modelekPrehledu)]
	// Dlouho neviděné: z nejoblíbenějších (horní třicítka) ty, které jsi aspoň 30 dní neotevřel; má to smysl, až
	// se zájem sleduje aspoň 30 dní (jinak by v seznamu byly všechny)
	if p.ZajemDni >= dnyDlouhoNevidene {
		for _, id := range poradi[:min(len(poradi), 3*modelekPrehledu)] {
			z, ok := model.zajemData[id]
			dni := -1
			if ok && !z.posledni.IsZero() {
				dni = int(nyni.Sub(z.posledni).Hours() / 24)
			}
			if dni == -1 || dni >= dnyDlouhoNevidene {
				x := polozka(id)
				x.Dni = dni
				p.DlouhoNevidene = append(p.DlouhoNevidene, x)
			}
		}
		sort.SliceStable(p.DlouhoNevidene, func(i, j int) bool {
			di, dj := p.DlouhoNevidene[i].Dni, p.DlouhoNevidene[j].Dni
			if di == -1 || dj == -1 {
				return di == -1 && dj != -1
			}
			return di > dj
		})
		p.DlouhoNevidene = p.DlouhoNevidene[:min(len(p.DlouhoNevidene), modelekPrehledu)]
	}
	return p
}

// ---------------------------------------------------------------------------------------------------------
// Zájem v databázi učení

// Zájem ze všech záznamů; volá se se zámkem
func (u *uceni) nacistZajem(nyni time.Time) stavZajmu {
	st := stavZajmu{modelky: map[int]zajemModelky{}}
	db := u.zajistit()
	if db == nil {
		return st
	}
	radky, err := db.Query("SELECT cas, modelka_id, druh, sekund FROM zajem")
	if err != nil {
		return st
	}
	defer radky.Close()
	for radky.Next() {
		var cas, druh string
		var id, sekund int
		if radky.Scan(&cas, &id, &druh, &sekund) != nil {
			continue
		}
		t, err := time.ParseInLocation("2006-01-02 15:04:05", cas, time.Local)
		if err != nil {
			continue
		}
		dny := max(0, nyni.Sub(t).Hours()/24)
		hodnota := 1.0
		if druh == "fotky" {
			hodnota = float64(sekund) / sekundNaProfil
		}
		z := st.modelky[id]
		z.skore += math.Pow(0.5, dny/polocasZajmu) * hodnota
		if dny <= dnyNedavnehoZajmu {
			if druh == "profil" {
				z.profil++
			} else {
				z.sekund += sekund
			}
		}
		if t.After(z.posledni) {
			z.posledni = t
		}
		st.modelky[id] = z
		if st.od.IsZero() || t.Before(st.od) {
			st.od = t
		}
	}
	return st
}

// Míra zájmu z ∈ (0, 2]: log(1 + skóre) proti mediánu modelek se zájmem (aspoň jednomu otevření profilu)
func miraZajmu(zajem map[int]zajemModelky) map[int]float64 {
	hodnoty := make([]float64, 0, len(zajem))
	for _, z := range zajem {
		if z.skore > 1e-6 {
			hodnoty = append(hodnoty, math.Log1p(z.skore))
		}
	}
	if len(hodnoty) == 0 {
		return nil
	}
	sort.Float64s(hodnoty)
	ref := max(hodnoty[len(hodnoty)/2], math.Log1p(1))
	mira := make(map[int]float64, len(hodnoty))
	for id, z := range zajem {
		if z.skore > 1e-6 {
			mira[id] = min(math.Log1p(z.skore)/ref, maxZajmu)
		}
	}
	return mira
}

// Váha zájmu z porovnání modelek se stejnými srdíčky: mřížka 0–0,3 po 0,025 podle vážené log-ztráty, výsledek
// stažený k výchozí 0,1 (silaPredpokladuZajmu porovnání). Z méně než 10 porovnání se neučí.
func naucitVahuZajmu(data []porovnaniZajmu) vysledekZajmu {
	v := vysledekZajmu{vaha: vychoziVahaZajmu}
	var info []porovnaniZajmu
	for _, p := range data {
		if math.Abs(p.zi-p.zj) > 1e-9 && p.t > 0 {
			info = append(info, p)
		}
	}
	v.porovnani = len(info)
	if len(info) < minPorovnaniZajmu {
		return v
	}
	nejlepsi, nejmensi := vychoziVahaZajmu, math.Inf(1)
	for g := 0; g <= int(math.Round(maxVahaZajmu/krokVahyZajmu)); g++ {
		w := float64(g) * krokVahyZajmu
		ztrata := 0.0
		for _, p := range info {
			d := skalaBT * ((p.pi + w*p.zi) - (p.pj + w*p.zj))
			ztrata += p.t * (p.y*math.Log1p(math.Exp(-d)) + (1-p.y)*math.Log1p(math.Exp(d)))
		}
		if ztrata < nejmensi-1e-12 {
			nejlepsi, nejmensi = w, ztrata
		}
	}
	n := float64(len(info))
	v.vaha = (n*nejlepsi + silaPredpokladuZajmu*vychoziVahaZajmu) / (n + silaPredpokladuZajmu)
	v.naucena = true
	return v
}

// „zájem: 8× profil, 14 min fotek za 2 měsíce“
func textZajmu(z zajemModelky) string {
	casti := ""
	if z.profil > 0 {
		casti = fmt.Sprintf("%d× profil", z.profil)
	}
	if minut := z.sekund / 60; minut > 0 {
		if casti != "" {
			casti += ", "
		}
		casti += fmt.Sprintf("%d min fotek", minut)
	}
	if casti == "" {
		return "zájem: dřív"
	}
	return "zájem: " + casti + " za 2 měsíce"
}

// ---------------------------------------------------------------------------------------------------------
// Pořadí, historie a trend

// Pořadí od 1 podle oblíbenosti (při shodě podle id), jen modelky s oblíbeností
func spocitatPoradi(oblibenost map[int]float64) map[int]int {
	ids := make([]int, 0, len(oblibenost))
	for id, o := range oblibenost {
		if o > 0 {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool {
		if oblibenost[ids[i]] != oblibenost[ids[j]] {
			return oblibenost[ids[i]] > oblibenost[ids[j]]
		}
		return ids[i] < ids[j]
	})
	poradi := make(map[int]int, len(ids))
	for i, id := range ids {
		poradi[id] = i + 1
	}
	return poradi
}

// Id modelek v pořadí
func (m *modelOblibenosti) seznamPoradi() []int {
	ids := make([]int, len(m.poradi))
	for id, p := range m.poradi {
		ids[p-1] = id
	}
	return ids
}

// Srovnávací snímek pro trend: poslední aspoň 30 dní starý, jinak nejstarší aspoň 7 dní starý; volá se se zámkem.
// Pořadí ve snímku je potvrzené, má-li snímek značku (řádek modelka_id 0), jinak je ze starší verze podle oblíbenosti.
func (u *uceni) nacistSrovnani(nyni time.Time) (map[int]snimekOblibenosti, time.Time, bool) {
	db := u.zajistit()
	if db == nil {
		return nil, time.Time{}, false
	}
	var den *string
	db.QueryRow("SELECT MAX(den) FROM historie_oblibenosti WHERE den <= ?", nyni.AddDate(0, 0, -dnyTrendu).Format("2006-01-02")).Scan(&den)
	if den == nil {
		db.QueryRow("SELECT MIN(den) FROM historie_oblibenosti WHERE den <= ?", nyni.AddDate(0, 0, -minDnyTrendu).Format("2006-01-02")).Scan(&den)
	}
	if den == nil {
		return nil, time.Time{}, false
	}
	t, err := time.ParseInLocation("2006-01-02", *den, time.Local)
	if err != nil {
		return nil, time.Time{}, false
	}
	radky, err := db.Query("SELECT modelka_id, oblibenost, poradi FROM historie_oblibenosti WHERE den = ?", *den)
	if err != nil {
		return nil, time.Time{}, false
	}
	defer radky.Close()
	snimek, potvrzene := map[int]snimekOblibenosti{}, false
	for radky.Next() {
		var id int
		var s snimekOblibenosti
		if radky.Scan(&id, &s.oblibenost, &s.poradi) != nil {
			continue
		}
		if id == znackaPotvrzenehoPoradi {
			potvrzene = s.poradi == 1
			continue
		}
		snimek[id] = s
	}
	return snimek, t, potvrzene
}

// Trend proti srovnávacímu snímku: posun oblíbenosti a pořadí (kladný = výš). Modelka, která ve snímku nebyla,
// trend nemá; posun pořadí se přepočítá jen mezi modelkami v obou snímcích, aby nové modelky v pořadí nevypadaly
// jako pád všech pod nimi. Se snímkem s potvrzeným pořadím se srovnává potvrzené pořadí (vstup do top 10 je
// vzestup), se snímkem ze starší verze pořadí podle oblíbenosti.
func (m *modelOblibenosti) nastavitTrend(snimek map[int]snimekOblibenosti, den, nyni time.Time, potvrzene bool) {
	m.trend, m.zmenaPoradi = map[int]float64{}, map[int]int{}
	if len(snimek) == 0 {
		return
	}
	dnes0 := time.Date(nyni.Year(), nyni.Month(), nyni.Day(), 0, 0, 0, 0, time.Local)
	m.trendDni = max(1, int(math.Round(dnes0.Sub(den).Hours()/24)))
	// Dnešní pořadí jen mezi modelkami, které byly i ve snímku: potvrzené (klíčem je záporné místo), nebo podle
	// oblíbenosti
	spolecne, predtim := map[int]float64{}, map[int]float64{}
	for id, o := range m.oblibenost {
		s, ok := snimek[id]
		switch {
		case !ok || o <= 0:
		case potvrzene && s.poradi > 0 && m.poradi[id] > 0:
			spolecne[id], predtim[id] = float64(1e9-m.poradi[id]), float64(1e9-s.poradi)
		case !potvrzene:
			spolecne[id], predtim[id] = o, s.oblibenost
		}
	}
	dnes, tehdy := spocitatPoradi(spolecne), spocitatPoradi(predtim)
	for id, p := range dnes {
		m.zmenaPoradi[id] = tehdy[id] - p
		m.trend[id] = zaokrouhlit3(m.oblibenost[id] - snimek[id].oblibenost)
	}
}

// Dnešní snímek do historie (nejvýš jednou za hodinu) a jednou denně úklid; volá se se zámkem
func (u *uceni) zapsatHistorii(m *modelOblibenosti, nyni time.Time) {
	den := nyni.Format("2006-01-02")
	posledni := u.ob.historieCas
	if !posledni.IsZero() && posledni.Format("2006-01-02") == den && nyni.Sub(posledni) < time.Hour {
		return
	}
	db := u.zajistit()
	if db == nil || len(m.poradi) == 0 {
		return
	}
	tx, err := db.Begin()
	if err != nil {
		return
	}
	prikaz, err := tx.Prepare("INSERT OR REPLACE INTO historie_oblibenosti (den, modelka_id, oblibenost, poradi) VALUES (?, ?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return
	}
	if _, err := prikaz.Exec(den, znackaPotvrzenehoPoradi, 0, 1); err != nil {
		prikaz.Close()
		tx.Rollback()
		return
	}
	for id, p := range m.poradi {
		if _, err := prikaz.Exec(den, id, zaokrouhlit3(m.oblibenost[id]), p); err != nil {
			prikaz.Close()
			tx.Rollback()
			varovatUceni("snímek oblíbenosti se nezapsal: %v", err)
			return
		}
	}
	prikaz.Close()
	if posledni.Format("2006-01-02") != den {
		tx.Exec("DELETE FROM historie_oblibenosti WHERE den < ?", nyni.AddDate(0, 0, -dnyHistorie).Format("2006-01-02"))
		tx.Exec("DELETE FROM historie_oblibenosti WHERE den < ? AND strftime('%w', den) != '1'", nyni.AddDate(0, 0, -dnyDennichSnimku).Format("2006-01-02"))
		tx.Exec("DELETE FROM zajem WHERE cas < ?", nyni.AddDate(0, 0, -dnyZaznamuZajmu).Format("2006-01-02"))
	}
	if tx.Commit() != nil {
		return
	}
	u.ob.historieCas = nyni
}
