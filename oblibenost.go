package main

import (
	"fmt"
	"maps"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Oblíbenost modelek (celkový popis v docs/UCENI.md, oddíly Oblíbenost až Model vkusu). Jeden model
// (modelOblibenosti, podle otisku dat v paměti), ze kterého berou čísla pořadí, galerie, výběr dvojic i návrhy:
//
//   - Porovnání dvojic „Která se ti líbí víc?“ se ukládají do databáze učení (tabulka porovnani), nikdy do sbírky.
//   - Předpoklad síly každé modelky na stupnici srdíček: hodnocená ze srdíček smíchaných se skóre jejích fotek
//     (oblibenost_fotky.go, váha naučená z porovnání), nehodnocená z odhadu modelu vkusu (oblibenost_vkus.go,
//     nejistota = chyba ověření), jinak ze skóre fotek, jinak (jen porovnávaná) z průměru sbírky; k tomu posun
//     zájmem (oblibenost_zajem.go, otevírání profilu a prohlížení fotek, váha naučená z porovnání).
//   - Bradley–Terry: porovnání předpoklad upřesní (MAP iteracemi MM, nejistota z Fisherovy informace). Oblíbenost
//     hodnocené modelky zůstává do ±0,49 od jejích srdíček; nehodnocená neporovnaná má jen odhad (označený).
//   - Z téhož modelu: výběr dvojic (oblibenost_dvojice.go – stejné a sousední úrovně, nehodnocené proti kotvě na
//     úrovni své síly, častěji modelky s nesouladem), návrhy srdíček (oblibenost_navrhy.go – úroveň nehodnocené po
//     pár porovnáních, nesoulad hodnocené s porovnáními a se srdíčky fotek), pořadí a trend (oblibenost_zajem.go).
//   - Potvrzené pořadí s úrovněmi Top 10/20/50/100 (oblibenost_urovne.go): modelka, která nesplňuje prahy úrovně
//     (porovnání, nejistota, u top 10 výhra nad top 20), zůstane pod její hranicí; oblíbenost (číslo) se nemění.
//
// Model vkusu se učí jen na srdíčkách upřesněných porovnáním a na údajích modelek (se skóre fotek), na výsledku
// Bradley–Terry nezávisí, takže se počítá napřed. Vše se počítá v paměti z modelek sbírky, porovnání a zájmu a ukládá
// se podle otisku (změna dat, nové porovnání nebo dávka zájmu otisk změní); GetModelky pak jen doplní hotová čísla.

// Verze výpočtu oblíbenosti: změna modelů zneplatní výsledek v paměti
const verzeOblibenosti = "oblibenost-6"

// Parametry modelu Bradley–Terry
const (
	skalaBT          = 2.0  // P(A víc než B) = σ(skalaBT·(sA − sB)): o půl srdíčka silnější vyhraje v 73 %
	sigmaHodnocene   = 0.25 // předpoklad síly hodnocené modelky: N(srdíčka, 0,25²) – porovnání ji posunou hlavně uvnitř úrovně
	sigmaNehodnocene = 1.25 // nehodnocená porovnávaná modelka bez hodnocených fotek: N(průměr srdíček sbírky, 1,25²)
	// Oblíbenost hodnocené modelky = srdíčka ± nejvýš 0,49: fotky a porovnání ji mohou posunout přes sousední
	// úroveň (o půl srdíčka), ale modelku s o celé srdíčko víc nepředběhne (srdíčka jsou měkký předpoklad, ne přihrádky)
	rozpetiUrovne = 0.49
	// Cíl modelu vkusu: srdíčka upřesněná porovnáním uvnitř úrovně (bez skóre fotek, to je mezi údaji)
	rozpetiCileVkusu = 0.24
	maxIteraciBT     = 2000
)

// ---------------------------------------------------------------------------------------------------------
// Rozhraní

// Přehled oblíbenosti: pořadí hodnocených (a porovnávaných) modelek
type StavOblibenosti struct {
	Porovnani   int     `json:"porovnani"`   // počet porovnání v databázi učení
	Modelek     int     `json:"modelek"`     // modelek v pořadí (i nehodnocené s odhadem a porovnávané)
	Hodnocenych int     `json:"hodnocenych"` // hodnocených modelek (z nich se učí model vkusu)
	Presnost    float64 `json:"presnost"`    // přesnost modelu vkusu na křížovém ověření (± půl srdíčka), 0–1; 0 = málo dat
	// Model vkusu prošel ověřením a jeho odhady se ukazují (odhadHodnoceni, GetMohloByTeLibit)
	Odhady bool `json:"odhady"`
	// Váha zájmu (otevírání profilu a prohlížení fotek) v předpokladu síly na jednotku míry zájmu, zda je naučená
	// z porovnání (jinak výchozí 0,1) a z kolika; od kolika dní se zájem sleduje; stáří srovnávacího snímku trendu
	// (0 = historie zatím chybí)
	VahaZajmu      float64             `json:"vahaZajmu"`
	ZajemNaucen    bool                `json:"zajemNaucen"`
	PorovnaniZajmu int                 `json:"porovnaniZajmu"`
	ZajemDni       int                 `json:"zajemDni"`
	TrendDni       int                 `json:"trendDni"`
	Poradi         []OblibenostModelky `json:"poradi"`
	// Hodnocené modelky, kterým podle porovnání nesedí srdíčka, od největšího nesouladu
	Nesedi []NesouladSrdicek `json:"nesedi"`
	// Úrovně Top 10, 20, 50 a 100 (prahy a kolik modelek v nich potvrzeně je) a kolik modelek čeká na potvrzení
	// úrovně, kam by podle síly patřila (oblibenost_urovne.go)
	Urovne     []UrovenTop `json:"urovne"`
	Cekajicich int         `json:"cekajicich"`
}

type OblibenostModelky struct {
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Hodnoceni float64 `json:"hodnoceni"` // srdíčka po polovinách (0 = nehodnocená)
	Sila      float64 `json:"sila"`      // síla z porovnání na stupnici srdíček (bez porovnání = srdíčka)
	Nejistota float64 `json:"nejistota"` // směrodatná odchylka síly
	Poradi    int     `json:"poradi"`    // potvrzené pořadí od 1 (oblíbenost s prahy úrovní Top 10/20/50/100)
	Porovnani int     `json:"porovnani"` // kolikrát byla porovnávaná
	Odhad     float64 `json:"odhad"`     // odhad modelu vkusu po polovinách (0 = bez jistého odhadu)
	// Skóre fotek na stupnici srdíček fotek (0 = žádná hodnocená fotka), z kolika alb a hodnocených fotek
	SkoreFotek       float64 `json:"skoreFotek"`
	AlbFotek         int     `json:"albFotek"`
	FotekHodnocenych int     `json:"fotekHodnocenych"`
	// Nehodnocená a neporovnaná: místo v pořadí je jen odhad podle vkusu („vkus“)
	JenOdhad    bool   `json:"jenOdhad"`
	ZdrojOdhadu string `json:"zdrojOdhadu"`
	// Posun síly zájmem (srdíčka), posun oblíbenosti a pořadí proti srovnávacímu snímku (kladný = výš)
	Zajem       float64 `json:"zajem"`
	Trend       float64 `json:"trend"`
	ZmenaPoradi int     `json:"zmenaPoradi"`
	Duvod       string  `json:"duvod"` // „srdíčka 4 · fotky 4,3 (3 alba, 41 hodnocených fotek) · 12 porovnání (výhry 7)“
	// Pořadí jen podle oblíbenosti (bez prahů), nejmenší úroveň Top N, ve které potvrzeně je (10, 20, 50, 100;
	// 0 = mimo top 100), a čekání na vyšší úroveň, kam by podle síly patřila (jen když tam potvrzená není)
	MistoPodleSily int             `json:"mistoPodleSily"`
	Uroven         int             `json:"uroven"`
	Ceka           *CekaniNaUroven `json:"ceka,omitempty"`
	// Úroveň, kterou modelka obhajuje proti silnější vyzyvatelce (místo jí zůstává, dokud s ní neprohraje)
	Obhajoba *ObhajobaUrovne `json:"obhajoba,omitempty"`
}

// Výsledek porovnání: vysledek "a" (víc se líbí A), "b" nebo "remiza". Zapíše se do databáze učení se srdíčky
// obou modelek v tu chvíli.
func (a *App) PorovnatModelky(modelkaA, modelkaB int, vysledek string) bool {
	u := a.uc
	if u == nil || modelkaA == modelkaB || (vysledek != "a" && vysledek != "b" && vysledek != "remiza") {
		return false
	}
	hodnoceni := map[int]float64{}
	radky, err := a.db.Query("SELECT id, "+a.sloupecHodnoceni()+" FROM modelky WHERE id IN (?, ?)", modelkaA, modelkaB)
	if err != nil {
		a.chyba("porovnání modelek", err)
		return false
	}
	for radky.Next() {
		var id, pul int
		if radky.Scan(&id, &pul) == nil {
			hodnoceni[id] = float64(pul) / 2
		}
	}
	radky.Close()
	if len(hodnoceni) != 2 {
		return false
	}
	return u.zapsatPorovnani(modelkaA, modelkaB, vysledek, hodnoceni[modelkaA], hodnoceni[modelkaB])
}

// Vrácení posledního porovnání (smaže ho z databáze učení); false, když žádné není
func (a *App) VratitPorovnani() bool {
	u := a.uc
	if u == nil {
		return false
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	porovnani := u.nacistPorovnani()
	if db == nil || len(porovnani) == 0 {
		return false
	}
	posledni := porovnani[len(porovnani)-1]
	if _, err := db.Exec("DELETE FROM porovnani WHERE id = ?", posledni.id); err != nil {
		varovatUceni("porovnání se nepodařilo vrátit: %v", err)
		return false
	}
	u.ob.porovnani = append([]porovnaniZaznam(nil), porovnani[:len(porovnani)-1]...)
	// Držitelky úrovní po vráceném porovnání neplatí (vrátí se ty před ním)
	db.Exec("DELETE FROM drzitelky_urovni WHERE porovnani_id >= ?", posledni.id)
	db.Exec("DELETE FROM kronika_slavy WHERE porovnani_id >= ?", posledni.id)
	return true
}

// Zapomenutí oblíbenosti: záloha databáze učení (jako u ZapomenoutUceni) a smazání všech porovnání, zájmu
// a historie oblíbenosti. Naučené z Údržby zůstává; ZapomenoutUceni naopak oblíbenost nemaže.
func (a *App) ZapomenoutPorovnani() bool {
	u := a.uc
	if u == nil {
		return false
	}
	u.pockat()
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil || !a.zalohovatUceni(db) {
		return false
	}
	if _, err := db.Exec("DELETE FROM porovnani"); err != nil {
		a.chyba("zapomenutí porovnání", err)
		return false
	}
	db.Exec("DELETE FROM zajem")
	db.Exec("DELETE FROM historie_oblibenosti")
	db.Exec("DELETE FROM drzitelky_urovni")
	db.Exec("DELETE FROM kronika_slavy")
	u.ob.porovnani, u.ob.nacteno, u.ob.nabidnute = nil, true, nil
	u.ob.profily, u.ob.zaznamuZajmu, u.ob.historieCas, u.ob.model = nil, u.ob.zaznamuZajmu+zaznamuNaPrepocet, time.Time{}, nil
	return true
}

// Pořadí oblíbenosti hodnocených a porovnávaných modelek s přesností modelu vkusu
func (a *App) GetOblibenost() StavOblibenosti {
	stav := StavOblibenosti{Poradi: []OblibenostModelky{}}
	if a.uc == nil {
		return stav
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	stav.Porovnani = model.porovnani
	stav.VahaZajmu, stav.ZajemNaucen, stav.PorovnaniZajmu = zaokrouhlit3(model.vahaZajmu.vaha), model.vahaZajmu.naucena, model.vahaZajmu.porovnani
	stav.TrendDni = model.trendDni
	if !model.zajemOd.IsZero() {
		stav.ZajemDni = int(time.Since(model.zajemOd).Hours() / 24)
	}
	if v := model.vkus; v != nil {
		stav.Presnost = zaokrouhlit3(v.presnost)
		stav.Odhady = v.platny
	}
	for _, m := range modelky {
		ob := model.oblibenostModelky(&m)
		if ob <= 0 {
			continue
		}
		polozka := OblibenostModelky{ModelkaID: m.ID, Jmeno: m.Jmeno, Hodnoceni: m.Hodnoceni, Sila: zaokrouhlit3(model.silaModelky(&m)),
			Nejistota: zaokrouhlit3(math.Sqrt(model.rozptylModelky(&m))), Porovnani: model.pocet[m.ID], Poradi: model.poradi[m.ID],
			Zajem: zaokrouhlit3(model.posunZajmu(m.ID)), Trend: model.trend[m.ID], ZmenaPoradi: model.zmenaPoradi[m.ID],
			MistoPodleSily: model.mistoSily[m.ID], Uroven: model.uroven[m.ID]}
		if c, ok := model.ceka[m.ID]; ok {
			polozka.Ceka = &c
		}
		if o, ok := model.obhajoba[m.ID]; ok {
			polozka.Obhajoba = &o
		}
		if sf, ok := model.skore[m.ID]; ok {
			polozka.SkoreFotek, polozka.AlbFotek, polozka.FotekHodnocenych = zaokrouhlit3(sf.skore), sf.alb, sf.fotek
		}
		if odhad, duvod, ok := model.odhadModelky(m, true); ok {
			polozka.Odhad = odhad
			polozka.Duvod = duvod
		}
		polozka.Duvod = model.duvodOblibenosti(m, polozka.Duvod)
		if model.jenOdhad[m.ID] {
			polozka.JenOdhad = true
			polozka.ZdrojOdhadu = "fotky"
			polozka.Duvod = "odhad z fotek, zatím bez srdíček a porovnání: " + polozka.Duvod
			if model.zdrojOdhadu[m.ID] == urovenVkus {
				polozka.ZdrojOdhadu = "vkus"
				polozka.Duvod = "odhad podle vkusu, zatím bez srdíček a porovnání: " + polozka.Duvod
			}
		}
		stav.Poradi = append(stav.Poradi, polozka)
	}
	sort.Slice(stav.Poradi, func(i, j int) bool { return stav.Poradi[i].Poradi < stav.Poradi[j].Poradi })
	stav.Nesedi = []NesouladSrdicek{}
	for _, n := range model.nesoulad {
		stav.Nesedi = append(stav.Nesedi, n)
	}
	sort.Slice(stav.Nesedi, func(i, j int) bool {
		if stav.Nesedi[i].vaha != stav.Nesedi[j].vaha {
			return stav.Nesedi[i].vaha > stav.Nesedi[j].vaha
		}
		return stav.Nesedi[i].ModelkaID < stav.Nesedi[j].ModelkaID
	})
	stav.Modelek = len(stav.Poradi)
	stav.Urovne, stav.Cekajicich = model.urovneTop(), len(model.ceka)
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			stav.Hodnocenych++
		}
	}
	return stav
}

// Oblíbenost a odhad hodnocení do seznamu modelek (GetModelky); z hotového modelu jen čísla z map
func (a *App) doplnitOblibenost(modelky []Modelka) {
	if a.uc == nil || len(modelky) == 0 {
		return
	}
	model := a.modelOblibenosti(modelky)
	for i := range modelky {
		m := &modelky[i]
		m.Oblibenost = model.oblibenostModelky(m)
		m.Poradi, m.ZmenaPoradi, m.UrovenTop = model.poradi[m.ID], model.zmenaPoradi[m.ID], model.uroven[m.ID]
		m.CekaNaTop = model.ceka[m.ID].Uroven
		m.ObhajujeTop = model.obhajoba[m.ID].Uroven
		if _, ok := model.zmenaPoradi[m.ID]; ok {
			m.TrendDni = model.trendDni
		}
		if m.Hodnoceni <= 0 && model.vkus != nil && model.vkus.platny {
			if odhad, ok := model.odhad[m.ID]; ok {
				m.OdhadHodnoceni = zaokrouhlitNaPul(odhad)
			}
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Porovnání v databázi učení

type porovnaniZaznam struct {
	id       int64
	cas      time.Time
	a, b     int
	vysledek string
	ha, hb   float64
}

// Stav oblíbenosti v databázi učení jedné aplikace
type oblibenostUceni struct {
	nacteno   bool
	porovnani []porovnaniZaznam // seřazená podle id; při změně se nahradí celý (výpočet drží starý)
	// Jen jeden výpočet modelu najednou; pořadí zámků: vypocet před mu
	vypocet sync.Mutex
	model   *modelOblibenosti
	// Naposledy nabídnuté dvojice (jen v paměti) a počet volání výběru (semínko průzkumu)
	nabidnute [][2]int
	nabidek   int
	// Zájem (oblibenost_zajem.go): kdy byl naposledy zapsán profil každé modelky (pauza 10 minut), počet zápisů
	// zájmu za běhu (po každých 20 se model přepočítá) a kdy se naposledy zapsal snímek historie
	profily      map[int]time.Time
	zaznamuZajmu int
	historieCas  time.Time
}

// Porovnání z databáze učení (načtou se při prvním použití); volá se se zámkem
func (u *uceni) nacistPorovnani() []porovnaniZaznam {
	if u.ob.nacteno {
		return u.ob.porovnani
	}
	db := u.zajistit()
	if db == nil {
		return nil
	}
	u.ob.nacteno = true
	radky, err := db.Query("SELECT id, cas, a, b, vysledek, hodnoceni_a, hodnoceni_b FROM porovnani ORDER BY id")
	if err != nil {
		return nil
	}
	defer radky.Close()
	for radky.Next() {
		var p porovnaniZaznam
		var cas string
		if radky.Scan(&p.id, &cas, &p.a, &p.b, &p.vysledek, &p.ha, &p.hb) == nil {
			p.cas, _ = time.ParseInLocation("2006-01-02 15:04:05", cas, time.Local)
			u.ob.porovnani = append(u.ob.porovnani, p)
		}
	}
	return u.ob.porovnani
}

func (u *uceni) zapsatPorovnani(a, b int, vysledek string, ha, hb float64) bool {
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return false
	}
	porovnani := u.nacistPorovnani()
	cas := ted()
	v, err := db.Exec("INSERT INTO porovnani (cas, a, b, vysledek, hodnoceni_a, hodnoceni_b) VALUES (?, ?, ?, ?, ?, ?)", cas, a, b, vysledek, ha, hb)
	if err != nil {
		varovatUceni("porovnání se nezapsalo: %v", err)
		return false
	}
	id, _ := v.LastInsertId()
	casT, _ := time.ParseInLocation("2006-01-02 15:04:05", cas, time.Local)
	u.ob.porovnani = append(append(make([]porovnaniZaznam, 0, len(porovnani)+1), porovnani...),
		porovnaniZaznam{id: id, cas: casT, a: a, b: b, vysledek: vysledek, ha: ha, hb: hb})
	return true
}

func klicDvojice(a, b int) [2]int {
	if a > b {
		a, b = b, a
	}
	return [2]int{a, b}
}

// ---------------------------------------------------------------------------------------------------------
// Model oblíbenosti: Bradley–Terry + model vkusu podle otisku

type modelOblibenosti struct {
	otisk      string
	sila       map[int]float64 // síla modelek s předpokladem (hodnocené, s hodnocenými fotkami a porovnávané)
	rozptyl    map[int]float64
	pocet      map[int]int     // porovnání modelky
	vyhry      map[int]float64 // výhry (remíza = půl)
	oblibenost map[int]float64
	odhad      map[int]float64 // nezaokrouhlený odhad vkusu u modelek s dost údaji (jen platný model)
	vkus       *modelVkusu
	porovnani  int
	prumer     float64 // průměr srdíček hodnocených modelek

	skore       map[int]skoreFotek // skóre fotek modelek s hodnocenými fotkami
	fotky       parametryFotek
	predpoklad  map[int]float64 // střed předpokladu síly
	jenOdhad    map[int]bool    // nehodnocená a neporovnaná modelka: oblíbenost jen odhadem vkusu
	zdrojOdhadu map[int]int     // nehodnocená: odkud je předpoklad síly (urovenVkus, urovenPrumer)
	vkusZeSkore bool            // model vkusu má mezi příznaky skóre fotek (výchozí nastavení vkusu, ne průměr srdíček fotek)

	// Zájem (oblibenost_zajem.go): míra zájmu z, záznamy, od kdy se sleduje a naučená váha
	zajem     map[int]float64
	zajemData map[int]zajemModelky
	zajemOd   time.Time
	vahaZajmu vysledekZajmu
	// Potvrzené pořadí od 1 a trend proti srovnávacímu snímku (posun oblíbenosti, pořadí a stáří snímku ve dnech)
	poradi      map[int]int
	trend       map[int]float64
	zmenaPoradi map[int]int
	trendDni    int
	// Hodnocené modelky, kterým podle porovnání s jinými úrovněmi nesedí srdíčka
	nesoulad map[int]NesouladSrdicek
	// Úrovně Top N (oblibenost_urovne.go): místo jen podle oblíbenosti, potvrzená úroveň (10/20/50/100, 0 = mimo),
	// čekání na vyšší úroveň, potvrzená top 20 (elita) a kdo nad ní vyhrál, počet potvrzených v každé úrovni
	mistoSily   map[int]int
	uroven      map[int]int
	ceka        map[int]CekaniNaUroven
	elita       map[int]bool
	maVyhru     map[int]bool
	potvrzenych []int
	// Obhajoba (oblibenost_urovne.go): držitelky úrovní z minulého výpočtu (vstup), kdo místo obhajuje a proti
	// komu, a vyzyvatelka → držitelka, kterou musí porazit
	drzitelky map[int]int
	obhajoba  map[int]ObhajobaUrovne
	vyzyva    map[int]int
	// Srdíčka daná přijetím odhadu vkusu (rychlé hodnocení, oblibenost_hodnoceni.go): model vkusu se z nich neučí,
	// dokud je nepotvrdí porovnání
	prevzate map[int]float64
}

// Posun předpokladu síly zájmem (srdíčka); jen u modelek s předpokladem (hodnocené nebo s hodnocenými fotkami)
func (m *modelOblibenosti) posunZajmu(id int) float64 {
	if _, ok := m.predpoklad[id]; !ok {
		return 0
	}
	return m.vahaZajmu.vaha * m.zajem[id]
}

func (m *modelOblibenosti) silaModelky(x *Modelka) float64 {
	if s, ok := m.sila[x.ID]; ok {
		return s
	}
	return x.Hodnoceni
}

func (m *modelOblibenosti) rozptylModelky(x *Modelka) float64 {
	if r, ok := m.rozptyl[x.ID]; ok {
		return r
	}
	return sigmaNehodnocene * sigmaNehodnocene
}

func (m *modelOblibenosti) oblibenostModelky(x *Modelka) float64 { return m.oblibenost[x.ID] }

func maSkore(skore map[int]skoreFotek, id int) bool {
	_, ok := skore[id]
	return ok
}

// Model pro modelky sbírky: z paměti, když se data ani porovnání od minula nezměnily
func (a *App) modelOblibenosti(modelky []Modelka) *modelOblibenosti {
	u := a.uc
	u.ob.vypocet.Lock()
	defer u.ob.vypocet.Unlock()
	u.mu.Lock()
	porovnani := u.nacistPorovnani()
	zaznamu := u.ob.zaznamuZajmu
	u.mu.Unlock()
	otisk := otiskOblibenosti(modelky, porovnani, zaznamu/zaznamuNaPrepocet)
	if u.ob.model != nil && u.ob.model.otisk == otisk {
		return u.ob.model
	}
	nyni := time.Now()
	u.mu.Lock()
	zajem := u.nacistZajem(nyni)
	snimek, den, potvrzene := u.nacistSrovnani(nyni)
	posledni := posledniPorovnani(porovnani)
	st := u.nacistStavUrovni(posledni)
	prevzate := u.nacistPrevzate()
	u.mu.Unlock()
	model := spocitatOblibenostUplne(modelky, porovnani, zajem, vstupOblibenosti{drzitelky: st.drzitelky, prevzate: prevzate}, nyni)
	model.nastavitTrend(snimek, den, nyni, potvrzene)
	model.otisk = otisk
	predchozi := u.ob.model
	u.ob.model = model
	u.mu.Lock()
	u.zapsatHistorii(model, nyni)
	if st.db {
		// Kronika síně slávy: vstupy, výpadky, obhajoby a nové jedničky od minulého stavu (oblibenost_slava.go)
		var obhajobyPred map[int]ObhajobaUrovne
		if predchozi != nil {
			obhajobyPred = predchozi.obhajoba
		}
		var nove []porovnaniZaznam
		if st.porovnani >= 0 {
			for _, p := range porovnani {
				if p.id > st.porovnani {
					nove = append(nove, p)
				}
			}
		}
		if udalosti := udalostiSlavy(st.drzitelky, model, obhajobyPred, nove, !st.zacatek, st.jednicka); len(udalosti) > 0 {
			u.zapsatUdalostiSlavy(posledni, udalosti, nyni)
		}
		if st.porovnani != posledni || !maps.Equal(st.drzitelky, potvrzeneUrovne(model.uroven)) {
			u.zapsatDrzitelky(posledni, model.uroven)
		}
	}
	u.mu.Unlock()
	return model
}

// Otisk všeho, z čeho se oblíbenost počítá: údaje modelek (i srdíčka fotek a fotografové), porovnání (počet a
// poslední číslo – vrácení i nové porovnání ho změní), dávka zápisů zájmu a dnešní datum (stáří porovnání,
// zájmu a srovnávací snímek trendu)
func otiskOblibenosti(modelky []Modelka, porovnani []porovnaniZaznam, davkaZajmu int) string {
	o := novyOtiskovac()
	o.text(verzeOblibenosti, time.Now().Format("2006-01-02"))
	o.cisla(davkaZajmu)
	posledni := int64(0)
	if len(porovnani) > 0 {
		posledni = porovnani[len(porovnani)-1].id
	}
	o.cisla(len(porovnani), int(posledni))
	for i := range modelky {
		m := &modelky[i]
		o.modelka(m)
		o.cisla(m.fotekHodnocenych, m.srdciFotek, len(m.srdickaAlb))
		for _, c := range m.srdickaAlb {
			o.cisla(c[:]...)
		}
		o.text(m.fotografoveAlb)
	}
	return o.hex()
}

func spocitatOblibenost(modelky []Modelka, porovnani []porovnaniZaznam, nyni time.Time) *modelOblibenosti {
	return spocitatOblibenostSeZajmem(modelky, porovnani, stavZajmu{}, nyni)
}

func spocitatOblibenostSeZajmem(modelky []Modelka, porovnani []porovnaniZaznam, zajem stavZajmu, nyni time.Time) *modelOblibenosti {
	return spocitatOblibenostUplne(modelky, porovnani, zajem, vstupOblibenosti{}, nyni)
}

// Vstup výpočtu z databáze učení mimo porovnání a zájem: drzitelky = úrovně potvrzené minulým výpočtem (modelka →
// 10/20/50/100) pro obhajobu místa, prevzate = srdíčka daná přijetím odhadu vkusu (modelka → srdíčka v tu chvíli)
type vstupOblibenosti struct {
	drzitelky map[int]int
	prevzate  map[int]float64
}

// Celý výpočet
func spocitatOblibenostUplne(modelky []Modelka, porovnani []porovnaniZaznam, zajem stavZajmu, vstup vstupOblibenosti, nyni time.Time) *modelOblibenosti {
	model := &modelOblibenosti{drzitelky: vstup.drzitelky, prevzate: vstup.prevzate, oblibenost: map[int]float64{}, odhad: map[int]float64{}, predpoklad: map[int]float64{}, jenOdhad: map[int]bool{}, zdrojOdhadu: map[int]int{}, porovnani: len(porovnani),
		zajemData: zajem.modelky, zajemOd: zajem.od, vahaZajmu: vysledekZajmu{vaha: vychoziVahaZajmu}}
	var refZajmu float64
	model.zajem, refZajmu = miraZajmu(zajem.modelky)
	existuje := make(map[int]bool, len(modelky))
	soucet, hodnocenych := 0.0, 0
	for _, m := range modelky {
		existuje[m.ID] = true
		if m.Hodnoceni > 0 {
			soucet += m.Hodnoceni
			hodnocenych++
		}
	}
	model.prumer = 2.5
	if hodnocenych > 0 {
		model.prumer = soucet / float64(hodnocenych)
	}
	// Skóre fotek: údaj pro model vkusu a pro rozhraní (síla modelky se z něj nepočítá, váha fotek je 0)
	model.skore, model.fotky = spocitatSkoreFotek(modelky)

	// Váha zájmu z porovnání modelek se stejnými srdíčky (předpoklad stran ze srdíček), u každého porovnání jen se
	// zájmem z doby před ním (zájem po porovnání by výsledek „předpověděl“ zpětně)
	if len(model.zajem) > 0 {
		mira := func(id int, cas time.Time) float64 {
			if zajem.casy == nil {
				return model.zajem[id] // bez záznamů s časem (testy se stavem sestaveným ručně)
			}
			if cas.IsZero() {
				cas = nyni
			}
			if sk := zajem.skoreK(id, cas); sk > 1e-6 {
				return mirkaZajmu(sk, refZajmu)
			}
			return 0
		}
		dataZajmu := make([]porovnaniZajmu, 0, len(porovnani))
		for _, p := range porovnani {
			if !existuje[p.a] || !existuje[p.b] || p.a == p.b || p.ha <= 0 || p.ha != p.hb {
				continue
			}
			y, t := 0.5, 1.0
			switch p.vysledek {
			case "a":
				y = 1
			case "b":
				y = 0
			}
			if !p.cas.IsZero() {
				t = vahaStari(p.cas, nyni)
			}
			dataZajmu = append(dataZajmu, porovnaniZajmu{
				pi: p.ha, zi: mira(p.a, p.cas),
				pj: p.hb, zj: mira(p.b, p.cas), y: y, t: t})
		}
		model.vahaZajmu = naucitVahuZajmu(dataZajmu)
	}

	// Model vkusu napřed: učí se jen na srdíčkách upřesněných porovnáním (předpoklad jen ze srdíček) a na údajích se
	// skóre fotek, na Bradley–Terry nezávisí. Jeho odhad je pak předpokladem síly nehodnocené modelky.
	stredSrdicka, sigmaSrdicka := map[int]float64{}, map[int]float64{}
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			stredSrdicka[m.ID], sigmaSrdicka[m.ID] = m.Hodnoceni, sigmaHodnocene
		}
	}
	for _, p := range porovnani {
		for _, id := range []int{p.a, p.b} {
			if _, ok := stredSrdicka[id]; existuje[id] && !ok {
				stredSrdicka[id], sigmaSrdicka[id] = model.prumer, sigmaNehodnocene
			}
		}
	}
	model.naucitModelVkusu(modelky, porovnani, stredSrdicka, sigmaSrdicka, nyni)

	// Předpoklady síly (jeden zdroj pro pořadí, galerii, výběr dvojic i návrhy): hodnocená ze srdíček; nehodnocená
	// z odhadu vkusu (nejistota = chyba ověření skupiny), jinak (jen porovnávaná) z průměru sbírky. K tomu posun zájmem.
	// Srdíčka fotek sílu přímo neposouvají: říkají, jak dobrá je fotka té modelky (pětka = její nejlepší), ne jak
	// dobrá je modelka; jsou jen jedním z údajů modelu vkusu.
	stred, sigma := map[int]float64{}, map[int]float64{}
	for _, m := range modelky {
		if odhad, ok := model.odhad[m.ID]; ok && m.Hodnoceni <= 0 {
			stred[m.ID], sigma[m.ID] = odhad, model.nejistotaOdhadu(m.ID)
			model.zdrojOdhadu[m.ID] = urovenVkus
		} else if m.Hodnoceni > 0 {
			stred[m.ID], sigma[m.ID] = m.Hodnoceni, sigmaHodnocene
		}
	}
	for _, p := range porovnani {
		for _, id := range []int{p.a, p.b} {
			if _, ok := stred[id]; existuje[id] && !ok {
				stred[id], sigma[id] = model.prumer, sigmaNehodnocene
				model.zdrojOdhadu[id] = urovenPrumer
			}
		}
	}
	for id := range stred {
		stred[id] += model.vahaZajmu.vaha * model.zajem[id]
	}
	maps.Copy(model.predpoklad, stred)
	bt := spocitatBT(stred, sigma, porovnani, nyni)
	model.sila, model.rozptyl, model.pocet, model.vyhry = bt.sila, bt.rozptyl, bt.pocet, bt.vyhry
	for _, m := range modelky {
		s, ok := bt.sila[m.ID]
		switch {
		case m.Hodnoceni > 0:
			model.oblibenost[m.ID] = m.Hodnoceni + min(max(s-m.Hodnoceni, -rozpetiUrovne), rozpetiUrovne)
		case ok && bt.pocet[m.ID] > 0:
			model.oblibenost[m.ID] = min(max(s, 0.25), 5)
		case ok:
			// Nehodnocená neporovnaná s odhadem vkusu nebo s hodnocenými fotkami: jen odhad (v Pořadí označený)
			model.oblibenost[m.ID] = min(max(s, 0.25), 5)
			model.jenOdhad[m.ID] = true
		}
	}
	model.spocitatUrovne(porovnani)
	model.nesoulad = spocitatNesoulad(modelky, porovnani, nyni)
	return model
}

// Nejistota odhadu vkusu jako směrodatná odchylka předpokladu: chyba ověření ve skupině modelky podle bohatosti údajů
// (jinak celková), nejméně 0,35 a nejvýš jako u nehodnocené bez odhadu
func (m *modelOblibenosti) nejistotaOdhadu(id int) float64 {
	v := m.vkus
	if v == nil {
		return sigmaNehodnocene
	}
	chyba := v.chybaKose[kosBohatosti(v.udaje[id])]
	if chyba <= 0 {
		chyba = v.chybaCV
	}
	return min(max(chyba, 0.35), sigmaNehodnocene)
}

// ---------------------------------------------------------------------------------------------------------
// Bradley–Terry s předpokladem ze srdíček
//
// Modelka i má skrytou sílu sᵢ na stupnici srdíček. Pravděpodobnost, že se víc líbí i než j, je
// σ(k·(sᵢ − sⱼ)), k = skalaBT. Předpoklad sᵢ ~ N(μᵢ, σᵢ²): hodnocená μ = srdíčka, σ = 0,25; nehodnocená μ = průměr
// srdíček sbírky, σ = 1,25. Remíza se počítá jako půl výhry pro každou. Každé porovnání váží podle stáří
// 0,5^(dny/365) (vkus se mění). Hledá se maximum aposteriorní hustoty
//
//	L(s) = Σ_c w_c·[y_c·log σ(k·d_c) + (1 − y_c)·log σ(−k·d_c)] − Σᵢ (sᵢ − μᵢ)²/(2σᵢ²)
//
// iteracemi MM (minorizace–maximalizace) po souřadnicích: zakřivení logistické funkce je nejvýš k²/4, takže krok
// sᵢ += gᵢ/(Σ w·k²/4 + 1/σᵢ²) L nikdy nesníží (Böhningova mez) a konverguje k jedinému maximu (L je konkávní).
// Nejistota je Laplaceova aproximace z diagonály Fisherovy informace v maximu: Var sᵢ ≈ 1/(1/σᵢ² + Σ w·k²·p(1 − p)).
// Modelka bez porovnání má sílu rovnou předpokladu.

type vysledekBT struct {
	sila, rozptyl map[int]float64
	pocet         map[int]int
	vyhry         map[int]float64
}

func spocitatBT(stred, sigma map[int]float64, porovnani []porovnaniZaznam, nyni time.Time) vysledekBT {
	v := vysledekBT{sila: map[int]float64{}, rozptyl: map[int]float64{}, pocet: map[int]int{}, vyhry: map[int]float64{}}
	ids := make([]int, 0, len(stred))
	for id := range stred {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	index := make(map[int]int, len(ids))
	s, mu, prec := make([]float64, len(ids)), make([]float64, len(ids)), make([]float64, len(ids))
	for i, id := range ids {
		index[id] = i
		s[i], mu[i] = stred[id], stred[id]
		prec[i] = 1 / (sigma[id] * sigma[id])
	}
	type hrana struct {
		i, j int
		y, w float64 // y: výsledek z pohledu i (1 výhra, 0,5 remíza, 0 prohra)
	}
	var hrany []hrana
	sousede := make([][]int, len(ids))
	for _, p := range porovnani {
		i, okA := index[p.a]
		j, okB := index[p.b]
		if !okA || !okB || i == j {
			continue
		}
		y := 0.5
		switch p.vysledek {
		case "a":
			y = 1
		case "b":
			y = 0
		}
		w := 1.0
		if !p.cas.IsZero() {
			w = vahaStari(p.cas, nyni)
		}
		sousede[i] = append(sousede[i], len(hrany))
		sousede[j] = append(sousede[j], len(hrany))
		hrany = append(hrany, hrana{i, j, y, w})
		v.pocet[p.a]++
		v.pocet[p.b]++
		v.vyhry[p.a] += y
		v.vyhry[p.b] += 1 - y
	}
	k := skalaBT
	for iterace := 0; iterace < maxIteraciBT && len(hrany) > 0; iterace++ {
		maxZmena := 0.0
		for x := range ids {
			if len(sousede[x]) == 0 {
				continue
			}
			g := -prec[x] * (s[x] - mu[x])
			mez := prec[x]
			for _, e := range sousede[x] {
				h := hrany[e]
				y, jiny := h.y, h.j
				if h.j == x {
					y, jiny = 1-h.y, h.i
				}
				p := zLogitu(k * (s[x] - s[jiny]))
				g += h.w * k * (y - p)
				mez += h.w * k * k / 4
			}
			krok := g / mez
			s[x] += krok
			maxZmena = max(maxZmena, math.Abs(krok))
		}
		if maxZmena < 1e-9 {
			break
		}
	}
	for x, id := range ids {
		info := prec[x]
		for _, e := range sousede[x] {
			h := hrany[e]
			p := zLogitu(k * (s[h.i] - s[h.j]))
			info += h.w * k * k * p * (1 - p)
		}
		v.sila[id], v.rozptyl[id] = s[x], 1/info
	}
	return v
}

// Důvod v pořadí oblíbenosti: složky (srdíčka, skóre fotek, porovnání), posun síly proti srdíčkům a případně
// odhad vkusu: „srdíčka 4 · fotky 4,3 (3 alba, 41 hodnocených fotek) · 12 porovnání (výhry 7)“
func (m *modelOblibenosti) duvodOblibenosti(x Modelka, odhad string) string {
	casti := []string{textSlozkySrdicek(x.Hodnoceni)}
	sf, maFotky := m.skore[x.ID]
	if maFotky {
		casti = append(casti, textSkoreFotek(sf))
	}
	n := m.pocet[x.ID]
	if n > 0 {
		casti = append(casti, fmt.Sprintf("%d porovnání (výhry %s)", n, strings.Replace(fmt.Sprint(m.vyhry[x.ID]), ".", ",", 1)))
	}
	if posun := m.posunZajmu(x.ID); posun >= 0.01 {
		casti = append(casti, fmt.Sprintf("%s (+%s)", textZajmu(m.zajemData[x.ID]), cisloCesky(posun, 2)))
	}
	if s, ok := m.sila[x.ID]; ok && x.Hodnoceni > 0 && math.Abs(s-x.Hodnoceni) > 0.25 {
		smer := "výš"
		if s < x.Hodnoceni {
			smer = "níž"
		}
		casti = append(casti, fmt.Sprintf("porovnání ji staví %s než její srdíčka (síla %s)", smer, cisloCesky(s, 1)))
	}
	if odhad != "" {
		casti = append(casti, strings.ToLower(odhad[:1])+odhad[1:])
	}
	return strings.Join(casti, " · ")
}

// ---------------------------------------------------------------------------------------------------------
// Pomocné

// Řešení soustavy A·x = b se symetrickou pozitivně definitní A Choleského rozkladem (A se přepíše);
// nil, když A pozitivně definitní není
func resitCholesky(a [][]float64, b []float64) []float64 {
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

func zaokrouhlitNaPul(x float64) float64 { return math.Round(x*2) / 2 }

func zaokrouhlit3(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return 0
	}
	return math.Round(x*1000) / 1000
}

// „4 srdíčka“, „3½ srdíčka“, „5 srdíček“, „1 srdíčko“, „½ srdíčka“
func textSrdicek(h float64) string {
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
func textSrdicek7(h float64) string {
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
