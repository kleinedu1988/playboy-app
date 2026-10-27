package main

import (
	"fmt"
	"maps"
	"math"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"
)

// Oblíbenost modelek (celkový popis v docs/UCENI.md, oddíly Oblíbenost, Bradley–Terry, Výběr dvojic a Model vkusu):
//
//   - Porovnání dvojic „Která se ti líbí víc?“ se ukládají do databáze učení (tabulka porovnani), nikdy do sbírky.
//   - Bradley–Terry s předpokladem ze srdíček a skóre fotek: každá modelka má skrytou sílu na stupnici srdíček.
//     Srdíčka modelky smíchaná se skóre jejích fotek (váha naučená z porovnání, oblibenost_fotky.go) dávají
//     předpoklad (průměr síly), porovnání ji upřesňují. Odhad MAP iteracemi MM, nejistota z Fisherovy informace
//     (Laplaceova aproximace, diagonála). Oblíbenost hodnocené modelky zůstává do ±0,49 od jejích srdíček.
//   - Výběr dvojic (aktivní učení): dvojice s nejistým pořadím na stejné nebo sousední úrovni srdíček, bez
//     nedávno ukázaných dvojic a bez častého opakování modelky, s trochou průzkumu.
//   - Zájem a trend (oblibenost_zajem.go): otevírání profilu a prohlížení fotek posouvá předpoklad síly (váha
//     naučená z porovnání), denní snímky oblíbenosti dávají pořadí v čase a trend (stoupá / klesá).
//   - Model vkusu (oblibenost_vkus.go): průměr hřebenové regrese a posilovaných stromů na údajích modelky,
//     ověřený křížovým ověřením. Odhady se ukazují jen u modelek s údaji, u kterých model na ověření jasně
//     překoná prostý průměr (přesnost má přednost před úplností), a každý má český důvod („blond, 70. léta,
//     Pompeo Posar; podobně jako Anna (4½)“).
//
// Vše se počítá v paměti z modelek sbírky a porovnání a ukládá se podle otisku (změna dat nebo nové porovnání
// otisk změní); GetModelky pak jen doplní hotová čísla.

// Verze výpočtu oblíbenosti: změna modelů zneplatní výsledek v paměti
const verzeOblibenosti = "oblibenost-3"

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

// Parametry výběru dvojic
const (
	sousedeDvojic      = 10  // kandidátky ke každé modelce: tolik nejbližších podle síly
	podilPruzkumu      = 0.2 // část dvojic vybraná náhodně (průzkum), ne podle nejistoty
	pametNabidek       = 60  // kolik naposledy nabídnutých dvojic se nenabízí znovu
	nedavnaPorovnani   = 200 // dvojice z tolika posledních porovnání se nenabízí
	maxDvojicNaVolani  = 50  // nejvíc dvojic na jedno volání
	vahaBezFotky       = 0.3 // modelka bez titulní fotky i fotek se do dvojice hodí hůř (není co porovnat)
	vahaSousedniUrovne = 0.7 // sousední úroveň (rozdíl půl srdíčka) proti stejné
	vahaVzdaleneUrovne = 0.2 // rozdíl jednoho srdíčka
	// Nehodnocené proti kotvě: podíl dvojic ve výchozím výběru a váhy podle toho, co o nich víme (s odhadem vkusu 1)
	podilNehodnocenych = 0.33
	vahaRozpracovane   = 2.5 // už porovnaná, ale ještě bez návrhu srdíček: dotáhnout ji
	vahaOdhaduFotek    = 0.8 // jen skóre fotek
	vahaBezOdhadu      = 0.35
	vahaNesouladu      = 1.6 // modelka, které nesedí srdíčka: další porovnání to ověří
)

// Návrh srdíček nehodnocené modelce z porovnání (GetNavrhSrdicek): až po tolika porovnáních a jen s tak malou
// nejistotou síly (směrodatná odchylka na stupnici srdíček)
const (
	minPorovnaniNavrhu = 3
	maxNejistotaNavrhu = 0.6
)

// Nesoulad se srdíčky (StavOblibenosti.Nesedi): hodnocená modelka, která v porovnáních s modelkami s jinými srdíčky
// vyhrála o tolik méně (nebo více), než by čekala samotná srdíčka, a aspoň tolikrát
const (
	minPorovnaniNesouladu = 3
	prahNesouladu         = 1.5 // rozdíl výher proti očekávání (vážený stářím)
	// Nesoulad se skóre fotek: fotky (převedené na stupnici srdíček modelek) se liší aspoň o celé srdíčko, z aspoň
	// 2 alb a 10 hodnocených fotek
	prahNesouladuFotek = 1.0
	minAlbNesouladu    = 2
	minFotekNesouladu  = 10
)

// ---------------------------------------------------------------------------------------------------------
// Rozhraní

// Dvojice k porovnání „Která se ti líbí víc?“
type DvojicePorovnani struct {
	A     int    `json:"a"`
	B     int    `json:"b"`
	Duvod string `json:"duvod"` // proč právě tahle dvojice (česky)
}

// Přehled oblíbenosti: pořadí hodnocených (a porovnávaných) modelek
type StavOblibenosti struct {
	Porovnani int     `json:"porovnani"` // počet porovnání v databázi učení
	Modelek   int     `json:"modelek"`   // modelek v pořadí
	Presnost  float64 `json:"presnost"`  // přesnost modelu vkusu na křížovém ověření (± půl srdíčka), 0–1; 0 = málo dat
	// Model vkusu prošel ověřením a jeho odhady se ukazují (odhadHodnoceni, GetMohloByTeLibit)
	Odhady bool `json:"odhady"`
	// Váha skóre fotek v předpokladu síly (0–1), zda je naučená z porovnání (jinak výchozí 0,3), z kolika porovnání
	// a o kolik zlepšila předpověď porovnání proti samotným srdíčkům na ověření (podíl log-ztráty, může být záporné)
	VahaFotek     float64 `json:"vahaFotek"`
	VahaNaucena   bool    `json:"vahaNaucena"`
	PorovnaniVahy int     `json:"porovnaniVahy"`
	ZlepseniFotek float64 `json:"zlepseniFotek"`
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
}

// Nesoulad se srdíčky: modelka s víc srdíčky prohrává se slabšími, nebo má slabší fotky (smer "mene", návrh o půl
// srdíčka méně), nebo s méně srdíčky vyhrává se silnějšími, nebo má lepší fotky (smer "vice", o půl víc). Zdroj
// "porovnani", "fotky", nebo "oba" (obojí ukazuje stejným směrem); když porovnání a fotky ukazují proti sobě, platí
// porovnání (jsou to výslovné soudy).
type NesouladSrdicek struct {
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Hodnoceni float64 `json:"hodnoceni"`
	Navrh     float64 `json:"navrh"`
	Smer      string  `json:"smer"`
	Zdroj     string  `json:"zdroj"`
	Porovnani int     `json:"porovnani"` // porovnání s modelkami s méně (smer mene) nebo víc (vice) srdíčky
	Vysledky  int     `json:"vysledky"`  // z nich prohry (mene) nebo výhry (vice); remíza se nepočítá
	Rozdil    float64 `json:"rozdil"`    // výhry proti očekávání ze srdíček (záporné = méně)
	// Skóre fotek na stupnici srdíček fotek, z kolika alb a hodnocených fotek, a o kolik se fotky převedené na
	// stupnici srdíček modelek liší od jejích srdíček (jen zdroj fotky a oba)
	SkoreFotek       float64 `json:"skoreFotek"`
	AlbFotek         int     `json:"albFotek"`
	FotekHodnocenych int     `json:"fotekHodnocenych"`
	RozdilFotek      float64 `json:"rozdilFotek"`
	vaha             float64 // síla nesouladu pro řazení
}

type OblibenostModelky struct {
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Hodnoceni float64 `json:"hodnoceni"` // srdíčka po polovinách (0 = nehodnocená)
	Sila      float64 `json:"sila"`      // síla z porovnání na stupnici srdíček (bez porovnání = srdíčka)
	Nejistota float64 `json:"nejistota"` // směrodatná odchylka síly
	Poradi    int     `json:"poradi"`    // pořadí od 1 podle oblíbenosti
	Porovnani int     `json:"porovnani"` // kolikrát byla porovnávaná
	Odhad     float64 `json:"odhad"`     // odhad modelu vkusu po polovinách (0 = bez jistého odhadu)
	// Skóre fotek na stupnici srdíček fotek (0 = žádná hodnocená fotka), z kolika alb a hodnocených fotek
	SkoreFotek       float64 `json:"skoreFotek"`
	AlbFotek         int     `json:"albFotek"`
	FotekHodnocenych int     `json:"fotekHodnocenych"`
	OdhadZFotek      bool    `json:"odhadZFotek"` // nehodnocená a neporovnaná: místo v pořadí je jen odhad z fotek
	// Posun síly zájmem (srdíčka), posun oblíbenosti a pořadí proti srovnávacímu snímku (kladný = výš)
	Zajem       float64 `json:"zajem"`
	Trend       float64 `json:"trend"`
	ZmenaPoradi int     `json:"zmenaPoradi"`
	Duvod       string  `json:"duvod"` // „srdíčka 4 · fotky 4,3 (3 alba, 41 hodnocených fotek) · 12 porovnání (výhry 7)“
}

// Dvojice k porovnání vybrané aktivním učením. okruh: "" všechny hodnocené, "stejne" jen stejná úroveň srdíček,
// "nehodnocene" nehodnocené modelky proti hodnoceným (kotvám).
func (a *App) GetDvojiceKPorovnani(pocet int, okruh string) []DvojicePorovnani {
	dvojice := []DvojicePorovnani{}
	u := a.uc
	if u == nil {
		return dvojice
	}
	pocet = min(max(pocet, 1), maxDvojicNaVolani)
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	u.mu.Lock()
	porovnani := u.nacistPorovnani()
	nabidnute := append([][2]int(nil), u.ob.nabidnute...)
	u.ob.nabidek++
	semienko := int64(len(porovnani))*7919 + int64(u.ob.nabidek)
	u.mu.Unlock()

	dvojice = vybratDvojice(modelky, model, porovnani, nabidnute, pocet, okruh, rand.New(rand.NewSource(semienko)))
	u.mu.Lock()
	for _, d := range dvojice {
		u.ob.nabidnute = append(u.ob.nabidnute, klicDvojice(d.A, d.B))
	}
	if n := len(u.ob.nabidnute); n > pametNabidek {
		u.ob.nabidnute = append([][2]int(nil), u.ob.nabidnute[n-pametNabidek:]...)
	}
	u.mu.Unlock()
	return dvojice
}

// Návrh srdíček nehodnocené modelce podle porovnání: úroveň, na kterou vychází její síla (po polovinách)
type NavrhSrdicek struct {
	Hodnoceni float64 `json:"hodnoceni"` // 0 = zatím nenavrhovat (málo porovnání, velká nejistota, už hodnocená)
	Porovnani int     `json:"porovnani"`
	Vyhry     float64 `json:"vyhry"` // remíza = půl
	Nejistota float64 `json:"nejistota"`
}

// Návrh srdíček pro nehodnocenou modelku: po aspoň 3 porovnáních a s nejistotou síly nejvýš 0,6 srdíčka úroveň, na
// kterou vychází (síla zaokrouhlená na polovinu srdíčka, 0,5–5)
func (a *App) GetNavrhSrdicek(modelkaID int) NavrhSrdicek {
	navrh := NavrhSrdicek{}
	if a.uc == nil {
		return navrh
	}
	modelky, _ := a.nactiModelky("", false)
	var x *Modelka
	for i := range modelky {
		if modelky[i].ID == modelkaID {
			x = &modelky[i]
		}
	}
	if x == nil || x.Hodnoceni > 0 {
		return navrh
	}
	model := a.modelOblibenosti(modelky)
	navrh.Porovnani, navrh.Vyhry = model.pocet[x.ID], model.vyhry[x.ID]
	navrh.Nejistota = zaokrouhlit3(math.Sqrt(model.rozptylModelky(x)))
	if s, ok := model.sila[x.ID]; ok && navrh.Porovnani >= minPorovnaniNavrhu && navrh.Nejistota <= maxNejistotaNavrhu {
		navrh.Hodnoceni = min(max(zaokrouhlitNaPul(s), 0.5), 5)
	}
	return navrh
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
	stav.VahaFotek, stav.VahaNaucena, stav.PorovnaniVahy = zaokrouhlit3(model.vaha.vaha), model.vaha.naucena, model.vaha.porovnani
	stav.ZlepseniFotek = zaokrouhlit3(model.vaha.zlepseni())
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
			Zajem: zaokrouhlit3(model.posunZajmu(m.ID)), Trend: model.trend[m.ID], ZmenaPoradi: model.zmenaPoradi[m.ID]}
		if sf, ok := model.skore[m.ID]; ok {
			polozka.SkoreFotek, polozka.AlbFotek, polozka.FotekHodnocenych = zaokrouhlit3(sf.skore), sf.alb, sf.fotek
		}
		if odhad, duvod, ok := model.odhadModelky(m, true); ok {
			polozka.Odhad = odhad
			polozka.Duvod = duvod
		}
		polozka.Duvod = model.duvodOblibenosti(m, polozka.Duvod)
		if model.zFotek[m.ID] {
			polozka.OdhadZFotek = true
			polozka.Duvod = "odhad z fotek, zatím bez srdíček a porovnání: " + polozka.Duvod
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
		m.Poradi, m.ZmenaPoradi = model.poradi[m.ID], model.zmenaPoradi[m.ID]
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
	kalibrace   kalibraceFotek
	vaha        vysledekVahy
	predpoklad  map[int]float64 // střed předpokladu síly
	zFotek      map[int]bool    // nehodnocená a neporovnaná modelka: oblíbenost jen odhadem z fotek
	vkusZeSkore bool            // model vkusu má mezi příznaky skóre fotek (výchozí nastavení vkusu, ne průměr srdíček fotek)

	// Zájem (oblibenost_zajem.go): míra zájmu z, záznamy, od kdy se sleduje a naučená váha
	zajem     map[int]float64
	zajemData map[int]zajemModelky
	zajemOd   time.Time
	vahaZajmu vysledekZajmu
	// Pořadí od 1 a trend proti srovnávacímu snímku (posun oblíbenosti, pořadí a stáří snímku ve dnech)
	poradi      map[int]int
	trend       map[int]float64
	zmenaPoradi map[int]int
	trendDni    int
	// Hodnocené modelky, kterým podle porovnání s jinými úrovněmi nesedí srdíčka
	nesoulad map[int]NesouladSrdicek
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
	snimek, den := u.nacistSrovnani(nyni)
	u.mu.Unlock()
	model := spocitatOblibenostSeZajmem(modelky, porovnani, zajem, nyni)
	model.nastavitTrend(snimek, den, nyni)
	model.otisk = otisk
	u.ob.model = model
	u.mu.Lock()
	u.zapsatHistorii(model, nyni)
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
	model := &modelOblibenosti{oblibenost: map[int]float64{}, odhad: map[int]float64{}, predpoklad: map[int]float64{}, zFotek: map[int]bool{}, porovnani: len(porovnani),
		zajem: miraZajmu(zajem.modelky), zajemData: zajem.modelky, zajemOd: zajem.od, vahaZajmu: vysledekZajmu{vaha: vychoziVahaZajmu}}
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
	// Skóre fotek, jeho převod na stupnici srdíček modelek a váha fotek naučená z porovnání
	model.skore, model.fotky = spocitatSkoreFotek(modelky)
	model.kalibrace = kalibrovatFotky(modelky, model.skore)
	prevedene := make(map[int]float64, len(model.skore))
	for id, sf := range model.skore {
		prevedene[id], _ = model.kalibrace.naSrdicka(sf)
	}
	data := make([]porovnaniVahy, 0, len(porovnani))
	for _, p := range porovnani {
		if !existuje[p.a] || !existuje[p.b] || p.a == p.b {
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
		data = append(data, porovnaniVahy{hi: p.ha, hj: p.hb, fi: prevedene[p.a], fj: prevedene[p.b], y: y, t: t})
	}
	model.vaha = naucitVahuFotek(data, model.prumer)

	// Váha zájmu z porovnání modelek se stejnými srdíčky (předpoklad stran se srdíčky a fotkami s naučenou vahou)
	if len(model.zajem) > 0 {
		dataZajmu := make([]porovnaniZajmu, 0, len(data))
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
				pi: predpokladStrany(p.ha, prevedene[p.a], model.vaha.vaha, model.prumer), zi: model.zajem[p.a],
				pj: predpokladStrany(p.hb, prevedene[p.b], model.vaha.vaha, model.prumer), zj: model.zajem[p.b], y: y, t: t})
		}
		model.vahaZajmu = naucitVahuZajmu(dataZajmu)
	}

	// Předpoklady: hodnocené modelky, modelky s hodnocenými fotkami a porovnávané nehodnocené; zvlášť jen ze srdíček
	// (cíl modelu vkusu)
	stred, sigma := map[int]float64{}, map[int]float64{}
	stredSrdicka, sigmaSrdicka := map[int]float64{}, map[int]float64{}
	for _, m := range modelky {
		sf, maF := model.skore[m.ID]
		if st, sg, ok := predpokladModelky(m.Hodnoceni, sf, maF, model.kalibrace, model.vaha.vaha); ok {
			stred[m.ID], sigma[m.ID] = st+model.vahaZajmu.vaha*model.zajem[m.ID], sg
		}
		if m.Hodnoceni > 0 {
			stredSrdicka[m.ID], sigmaSrdicka[m.ID] = m.Hodnoceni, sigmaHodnocene
		}
	}
	for _, p := range porovnani {
		for _, id := range []int{p.a, p.b} {
			if !existuje[id] {
				continue
			}
			if _, ok := stred[id]; !ok {
				stred[id], sigma[id] = model.prumer+model.vahaZajmu.vaha*model.zajem[id], sigmaNehodnocene
			}
			if _, ok := stredSrdicka[id]; !ok {
				stredSrdicka[id], sigmaSrdicka[id] = model.prumer, sigmaNehodnocene
			}
		}
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
		case ok && maSkore(model.skore, m.ID):
			// Nehodnocená modelka s hodnocenými fotkami: odhad ze skóre fotek (v Pořadí s označením „odhad z fotek“)
			model.oblibenost[m.ID] = min(max(s, 0.25), 5)
			model.zFotek[m.ID] = true
		}
	}
	model.poradi = spocitatPoradi(model.oblibenost)
	model.nesoulad = spocitatNesoulad(modelky, porovnani, nyni)
	model.doplnitNesouladFotek(modelky)

	model.naucitModelVkusu(modelky, porovnani, stredSrdicka, sigmaSrdicka, nyni)
	return model
}

// Nesoulad se srdíčky: u každé hodnocené modelky porovnání s hodnocenými, které mají jiná srdíčka (dnešní). Očekávaná
// výhra je σ(k·(hᵢ − hⱼ)) podle samotných srdíček; rozdíl skutečných a očekávaných výher (vážený stářím porovnání)
// pod −1,5 znamená, že modelka s víc srdíčky prohrává se slabšími (možná jí patří o půl srdíčka méně), nad +1,5,
// že vyhrává se silnějšími (o půl víc). Počítají se jen modelky s aspoň 3 takovými porovnáními.
func spocitatNesoulad(modelky []Modelka, porovnani []porovnaniZaznam, nyni time.Time) map[int]NesouladSrdicek {
	srdicka := make(map[int]float64, len(modelky))
	jmena := make(map[int]string, len(modelky))
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			srdicka[m.ID], jmena[m.ID] = m.Hodnoceni, m.Jmeno
		}
	}
	type soucet struct {
		n                                 int
		rozdil                            float64
		protiSlabsim, prohrySeSlabsimi    int
		protiSilnejsim, vyhrySeSilnejsimi int
	}
	soucty := map[int]*soucet{}
	pridat := func(id int, h, hJine, y, t float64) {
		s := soucty[id]
		if s == nil {
			s = &soucet{}
			soucty[id] = s
		}
		s.n++
		s.rozdil += t * (y - zLogitu(skalaBT*(h-hJine)))
		if hJine < h {
			s.protiSlabsim++
			if y == 0 {
				s.prohrySeSlabsimi++
			}
		} else {
			s.protiSilnejsim++
			if y == 1 {
				s.vyhrySeSilnejsimi++
			}
		}
	}
	for _, p := range porovnani {
		ha, okA := srdicka[p.a]
		hb, okB := srdicka[p.b]
		if !okA || !okB || ha == hb {
			continue
		}
		y := 0.5
		switch p.vysledek {
		case "a":
			y = 1
		case "b":
			y = 0
		}
		t := 1.0
		if !p.cas.IsZero() {
			t = vahaStari(p.cas, nyni)
		}
		pridat(p.a, ha, hb, y, t)
		pridat(p.b, hb, ha, 1-y, t)
	}
	vysledek := map[int]NesouladSrdicek{}
	for id, s := range soucty {
		if s.n < minPorovnaniNesouladu {
			continue
		}
		h := srdicka[id]
		n := NesouladSrdicek{ModelkaID: id, Jmeno: jmena[id], Hodnoceni: h, Rozdil: zaokrouhlit3(s.rozdil)}
		switch {
		case s.rozdil <= -prahNesouladu && h > 0.5:
			n.Smer, n.Navrh, n.Porovnani, n.Vysledky = "mene", h-0.5, s.protiSlabsim, s.prohrySeSlabsimi
		case s.rozdil >= prahNesouladu && h < 5:
			n.Smer, n.Navrh, n.Porovnani, n.Vysledky = "vice", h+0.5, s.protiSilnejsim, s.vyhrySeSilnejsimi
		default:
			continue
		}
		n.Zdroj, n.vaha = "porovnani", math.Abs(s.rozdil)/prahNesouladu
		vysledek[id] = n
	}
	return vysledek
}

// Nesoulad se skóre fotek: hodnocená modelka s dost hodnocenými fotkami, jejíž fotky převedené na stupnici srdíček
// modelek (kalibrace sbírky) se liší od jejích srdíček aspoň o celé srdíčko. Se stejným směrem jako porovnání se
// položky spojí (zdroj „oba“), s opačným platí porovnání.
func (m *modelOblibenosti) doplnitNesouladFotek(modelky []Modelka) {
	for _, x := range modelky {
		sf, ok := m.skore[x.ID]
		if x.Hodnoceni <= 0 || !ok || sf.alb < minAlbNesouladu || sf.fotek < minFotekNesouladu {
			continue
		}
		f, _ := m.kalibrace.naSrdicka(sf)
		rozdil := f - x.Hodnoceni
		smer, navrh := "", 0.0
		switch {
		case rozdil <= -prahNesouladuFotek && x.Hodnoceni > 0.5:
			smer, navrh = "mene", x.Hodnoceni-0.5
		case rozdil >= prahNesouladuFotek && x.Hodnoceni < 5:
			smer, navrh = "vice", x.Hodnoceni+0.5
		default:
			continue
		}
		fotky := func(n *NesouladSrdicek) {
			n.SkoreFotek, n.AlbFotek, n.FotekHodnocenych, n.RozdilFotek = zaokrouhlit3(sf.skore), sf.alb, sf.fotek, zaokrouhlit3(rozdil)
		}
		if n, ok := m.nesoulad[x.ID]; ok {
			if n.Smer == smer {
				fotky(&n)
				n.Zdroj, n.vaha = "oba", n.vaha+math.Abs(rozdil)/prahNesouladuFotek+1
				m.nesoulad[x.ID] = n
			}
			continue
		}
		n := NesouladSrdicek{ModelkaID: x.ID, Jmeno: x.Jmeno, Hodnoceni: x.Hodnoceni, Navrh: navrh, Smer: smer, Zdroj: "fotky", vaha: math.Abs(rozdil) / prahNesouladuFotek}
		fotky(&n)
		m.nesoulad[x.ID] = n
	}
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

// ---------------------------------------------------------------------------------------------------------
// Výběr dvojic k porovnání (aktivní učení)
//
// Porovnání má smysl tam, kde je pořadí nejisté a kde na něm záleží: u modelek se stejnými nebo sousedními
// srdíčky. Výchozí výběr sám míchá hodnocené dvojice a asi třetinu nehodnocených proti kotvě na úrovni jejich
// odhadu (viz níž); nic se nemusí přepínat. Kandidátky jsou ke každé modelce nejbližší sousedé podle síly
// (sousedeDvojic na každou stranu). Modelka, které nesedí srdíčka (prohrává se slabšími nebo vyhrává se silnějšími),
// má vyšší váhu, aby se nesoulad ověřil.
// Skóre dvojice je očekávaná informace p(1 − p)·(Var sᵢ + Var sⱼ) (největší, když je výsledek nejistý a obě síly
// málo známé) krát váha úrovně (stejná 1, sousední 0,7, o srdíčko 0,2, jinak nic) a váha za fotku. Dvojice
// z posledních nedavnaPorovnani porovnání a naposledy nabídnuté se vynechají, modelka je v jednom výběru nejvýš
// jednou a modelka častá v posledních porovnáních se tlumí. Asi pětina dvojic je průzkum: náhodná dvojice ze
// stejné nebo sousední úrovně (semínko z počtu porovnání a volání, takže výsledek je opakovatelný). Pořadí A/B
// je náhodné, aby levá strana neměla přednost.

type kandidatDvojice struct {
	a, b    int
	skore   float64
	pruzkum bool
	// Proč právě tahle dvojice; text se skládá až u vybraných (duvodDvojice), kandidátů jsou tisíce
	druh int
	x, y *Modelka
	// Nehodnocená: úroveň srdíček, na kterou vychází (odhad nebo síla z porovnání, po polovinách), a odkud
	uroven float64
	zdroj  int
}

// Odkud je úroveň nehodnocené modelky
const (
	urovenPrumer    = iota // bez odhadu: průměr srdíček sbírky
	urovenFotky            // skóre jejích fotek
	urovenVkus             // odhad modelu vkusu
	urovenPorovnani        // síla z dosavadních porovnání
)

// Druhy kandidátů dvojic (pro důvod)
const (
	dvojiceNehodnocena = iota // nehodnocená proti hodnocené kotvě
	dvojiceStejna             // stejná úroveň srdíček
	dvojiceSousedni           // sousední úrovně
	dvojiceVzdalena           // srdíčka se liší o jedno
)

func duvodDvojice(k kandidatDvojice, model *modelOblibenosti) string {
	nizsi, vyssi := textSrdicek(min(k.x.Hodnoceni, k.y.Hodnoceni)), textSrdicek(max(k.x.Hodnoceni, k.y.Hodnoceni))
	switch k.druh {
	case dvojiceNehodnocena:
		var odkud string
		switch k.zdroj {
		case urovenPorovnani:
			odkud = fmt.Sprintf("Po %d porovnáních vychází nehodnocená na %s", model.pocet[k.x.ID], textSrdicek(k.uroven))
			if model.pocet[k.x.ID] == 1 {
				odkud = fmt.Sprintf("Po prvním porovnání vychází nehodnocená na %s", textSrdicek(k.uroven))
			}
		case urovenVkus:
			odkud = fmt.Sprintf("Odhad podle vkusu: %s", textSrdicek(k.uroven))
		case urovenFotky:
			odkud = fmt.Sprintf("Podle srdíček jejích fotek asi %s", textSrdicek(k.uroven))
		default:
			odkud = fmt.Sprintf("Zatím bez odhadu, průměr sbírky je %s", textSrdicek(k.uroven))
		}
		if k.y.Hodnoceni != k.uroven {
			return fmt.Sprintf("%s – modelku s %s nemáš, proto proti nejbližší s %s: vyhraje, nebo prohraje?", odkud, textSrdicek7(k.uroven), textSrdicek7(k.y.Hodnoceni))
		}
		return fmt.Sprintf("%s – proti modelce s %s: vyhraje-li, patří výš, prohraje-li, níž", odkud, textSrdicek7(k.y.Hodnoceni))
	case dvojiceStejna:
		sx, okX := model.skore[k.x.ID]
		sy, okY := model.skore[k.y.ID]
		if okX && okY {
			return fmt.Sprintf("Obě mají %s (fotky %s a %s) a pořadí mezi nimi zatím není jisté", textSrdicek(k.x.Hodnoceni), cisloCesky(sx.skore, 1), cisloCesky(sy.skore, 1))
		}
		return fmt.Sprintf("Obě mají %s a pořadí mezi nimi zatím není jisté", textSrdicek(k.x.Hodnoceni))
	case dvojiceSousedni:
		return fmt.Sprintf("Sousední úrovně (%s a %s): patří ta s méně srdíčky výš?", nizsi, vyssi)
	}
	return fmt.Sprintf("Srdíčka se liší o jedno (%s a %s), porovnání ověří hranici", nizsi, vyssi)
}

func vybratDvojice(modelky []Modelka, model *modelOblibenosti, porovnani []porovnaniZaznam, nabidnute [][2]int, pocet int, okruh string, nahoda *rand.Rand) []DvojicePorovnani {
	vysledek := []DvojicePorovnani{}
	vyloucene := map[[2]int]bool{}
	for _, d := range nabidnute {
		vyloucene[d] = true
	}
	castost := map[int]float64{}
	for i, p := range porovnani[max(0, len(porovnani)-nedavnaPorovnani):] {
		vyloucene[klicDvojice(p.a, p.b)] = true
		// Novější porovnání tlumí víc (posledních asi 20)
		vaha := math.Pow(0.9, float64(min(len(porovnani), nedavnaPorovnani)-1-i))
		castost[p.a] += vaha
		castost[p.b] += vaha
	}
	vahaModelky := func(m *Modelka) float64 {
		w := 1 / (1 + 0.5*castost[m.ID])
		if _, ok := model.nesoulad[m.ID]; ok {
			w *= vahaNesouladu
		}
		if m.CoverID == "" && m.PocetFotek == 0 {
			w *= vahaBezFotky
		}
		return w
	}

	// Ukazatele: řadí se tisíce modelek a kopírování celých záznamů bylo dražší než výběr sám
	var hodnocene, nehodnocene []*Modelka
	for i := range modelky {
		if m := &modelky[i]; m.Hodnoceni > 0 {
			hodnocene = append(hodnocene, m)
		} else {
			nehodnocene = append(nehodnocene, m)
		}
	}
	silaM := func(m *Modelka) float64 { return model.silaModelky(m) }
	sort.SliceStable(hodnocene, func(i, j int) bool {
		si, sj := silaM(hodnocene[i]), silaM(hodnocene[j])
		if si != sj {
			return si < sj
		}
		return hodnocene[i].ID < hodnocene[j].ID
	})

	informace := func(x, y *Modelka, sx, sy float64) float64 {
		p := zLogitu(skalaBT * (sx - sy))
		return p * (1 - p) * (model.rozptylModelky(x) + model.rozptylModelky(y))
	}
	// Hodnocené dvojice (stejná, sousední a o srdíčko vzdálená úroveň) a nehodnocené proti kotvě; okruh "" (výchozí)
	// je míchá samo, "stejne" a "nehodnocene" berou jen jeden druh
	var kandidatiHod, kandidatiNeh []kandidatDvojice
	if okruh == "nehodnocene" || okruh == "" {
		// Nehodnocená modelka proti kotvě se stejným počtem srdíček, na jaký vychází: odhad zaokrouhlený na
		// polovinu srdíčka (po porovnáních síla z nich, takže výhra posune další kotvu výš a prohra níž). Ukáže
		// přímo, jestli patří nad svou úroveň, nebo pod ni. Kotvy jsou typické modelky té úrovně (síla nejblíž
		// srdíčkům); bez modelky na té úrovni nejbližší úroveň. Přednost má rozpracovaná nehodnocená (už porovnaná,
		// ale ještě bez návrhu srdíček), pak s odhadem vkusu, s hodnocenými fotkami, nakonec bez ničeho.
		podleUrovne := map[float64][]*Modelka{}
		for _, y := range hodnocene {
			podleUrovne[y.Hodnoceni] = append(podleUrovne[y.Hodnoceni], y)
		}
		for h, seznam := range podleUrovne {
			sort.SliceStable(seznam, func(i, j int) bool {
				return math.Abs(silaM(seznam[i])-h) < math.Abs(silaM(seznam[j])-h)
			})
		}
		for _, x := range nehodnocene {
			if len(podleUrovne) == 0 {
				break
			}
			cil, zdroj, vahaX := model.prumer, urovenPrumer, vahaBezOdhadu
			if p, ok := model.predpoklad[x.ID]; ok && maSkore(model.skore, x.ID) {
				cil, zdroj, vahaX = p, urovenFotky, vahaOdhaduFotek
			}
			if odhad, ok := model.odhad[x.ID]; ok {
				cil, zdroj, vahaX = odhad, urovenVkus, 1
			}
			if s, ok := model.sila[x.ID]; ok && model.pocet[x.ID] > 0 {
				cil, zdroj = s, urovenPorovnani
				if math.Sqrt(model.rozptylModelky(x)) > maxNejistotaNavrhu || model.pocet[x.ID] < minPorovnaniNavrhu {
					vahaX = vahaRozpracovane
				}
			}
			uroven := min(max(zaokrouhlitNaPul(cil), 0.5), 5)
			kotvy := podleUrovne[uroven]
			if len(kotvy) == 0 {
				nejblizsi := -1.0
				for h := range podleUrovne {
					if nejblizsi < 0 || math.Abs(h-uroven) < math.Abs(nejblizsi-uroven) || (math.Abs(h-uroven) == math.Abs(nejblizsi-uroven) && h > nejblizsi) {
						nejblizsi = h
					}
				}
				kotvy = podleUrovne[nejblizsi]
			}
			for _, y := range kotvy[:min(len(kotvy), sousedeDvojic)] {
				if vyloucene[klicDvojice(x.ID, y.ID)] {
					continue
				}
				kandidatiNeh = append(kandidatiNeh, kandidatDvojice{a: x.ID, b: y.ID, skore: informace(x, y, cil, silaM(y)) * vahaX * vahaModelky(x) * vahaModelky(y),
					pruzkum: true, druh: dvojiceNehodnocena, x: x, y: y, uroven: uroven, zdroj: zdroj})
			}
		}
	}
	if okruh != "nehodnocene" {
		for i, x := range hodnocene {
			for j := i + 1; j < min(len(hodnocene), i+1+sousedeDvojic); j++ {
				y := hodnocene[j]
				rozdil := math.Abs(x.Hodnoceni - y.Hodnoceni)
				vahaUrovne, druh := 0.0, 0
				switch {
				case rozdil == 0:
					vahaUrovne, druh = 1, dvojiceStejna
				case rozdil <= 0.5 && okruh != "stejne":
					vahaUrovne, druh = vahaSousedniUrovne, dvojiceSousedni
				case rozdil <= 1 && okruh != "stejne":
					vahaUrovne, druh = vahaVzdaleneUrovne, dvojiceVzdalena
				}
				if vahaUrovne == 0 || vyloucene[klicDvojice(x.ID, y.ID)] {
					continue
				}
				kandidatiHod = append(kandidatiHod, kandidatDvojice{a: x.ID, b: y.ID, skore: informace(x, y, silaM(x), silaM(y)) * vahaUrovne * vahaModelky(x) * vahaModelky(y),
					pruzkum: rozdil <= 0.5, druh: druh, x: x, y: y})
			}
		}
	}
	for _, kandidati := range [][]kandidatDvojice{kandidatiHod, kandidatiNeh} {
		sort.SliceStable(kandidati, func(i, j int) bool {
			if kandidati[i].skore != kandidati[j].skore {
				return kandidati[i].skore > kandidati[j].skore
			}
			return klicDvojice(kandidati[i].a, kandidati[i].b)[0] < klicDvojice(kandidati[j].a, kandidati[j].b)[0]
		})
	}
	pouzite := map[int]bool{}
	pouzitelny := func(k kandidatDvojice) bool { return !pouzite[k.a] && !pouzite[k.b] }
	pridat := func(k kandidatDvojice, duvod string) {
		pouzite[k.a], pouzite[k.b] = true, true
		a, b := k.a, k.b
		if nahoda.Intn(2) == 1 {
			a, b = b, a
		}
		vysledek = append(vysledek, DvojicePorovnani{A: a, B: b, Duvod: duvod})
	}
	// Další dvojice z jednoho seznamu: občas průzkum (náhodná použitelná ze stejné nebo sousední úrovně), jinak
	// nejlepší použitelná; false, když v seznamu nic použitelného není
	dalsi := map[int]int{}
	vzit := func(kandidati []kandidatDvojice, druh int) bool {
		if nahoda.Float64() < podilPruzkumu {
			var moznosti []kandidatDvojice
			for _, k := range kandidati {
				if k.pruzkum && pouzitelny(k) {
					moznosti = append(moznosti, k)
				}
			}
			if len(moznosti) > 0 {
				k := moznosti[nahoda.Intn(len(moznosti))]
				duvod := "Průzkum: náhodná dvojice ze stejné nebo sousední úrovně, aby se pořadí neučilo jen z nejistých"
				if k.druh == dvojiceNehodnocena {
					duvod = duvodDvojice(k, model)
				}
				pridat(k, duvod)
				return true
			}
		}
		for dalsi[druh] < len(kandidati) && !pouzitelny(kandidati[dalsi[druh]]) {
			dalsi[druh]++
		}
		if dalsi[druh] >= len(kandidati) {
			return false
		}
		pridat(kandidati[dalsi[druh]], duvodDvojice(kandidati[dalsi[druh]], model))
		return true
	}
	for len(vysledek) < pocet {
		// Nehodnocené dostanou asi třetinu dvojic (když nějaké jsou); když jeden seznam dojde, bere se z druhého
		nejdriv, potom := 0, 1
		if len(kandidatiHod) == 0 || (len(kandidatiNeh) > 0 && nahoda.Float64() < podilNehodnocenych) {
			nejdriv, potom = 1, 0
		}
		seznamy := [][]kandidatDvojice{kandidatiHod, kandidatiNeh}
		if !vzit(seznamy[nejdriv], nejdriv) && !vzit(seznamy[potom], potom) {
			break
		}
	}
	return vysledek
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
		pricina := "porovnání"
		switch {
		case maFotky && m.vaha.vaha > 0 && n > 0:
			pricina = "fotky a porovnání"
		case maFotky && m.vaha.vaha > 0:
			pricina = "fotky"
		}
		casti = append(casti, fmt.Sprintf("%s ji staví %s než její srdíčka (síla %s)", pricina, smer, cisloCesky(s, 1)))
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
