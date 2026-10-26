package main

import (
	"fmt"
	"maps"
	"math"
	"math/rand"
	"regexp"
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
//   - Model vkusu: hřebenová regrese hodnocení na údaje modelky (etnicita, národnost, vlasy, oči, postava,
//     prsa, ochlupení, tetování, piercing, éra, kategorie, fotografové, srdíčka jejích fotek), ověřená křížovým
//     ověřením. Odhady se ukazují, jen když model na ověření jasně překoná prostý průměr (přesnost má přednost
//     před úplností), a každý má český důvod („blond, 70. léta, Pompeo Posar“).
//
// Vše se počítá v paměti z modelek sbírky a porovnání a ukládá se podle otisku (změna dat nebo nové porovnání
// otisk změní); GetModelky pak jen doplní hotová čísla.

// Verze výpočtu oblíbenosti: změna modelů zneplatní výsledek v paměti
const verzeOblibenosti = "oblibenost-2"

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
)

// Parametry modelu vkusu
const (
	minHodnocenychVkus  = 30  // z méně hodnocených modelek se vkus neodhaduje
	minHodnocenychCV    = 15  // od tolika se aspoň spočítá přesnost (pro přehled)
	minPodporaVkus      = 3   // hodnota údaje (blond, fotograf…) se počítá, když ji má aspoň tolik hodnocených modelek
	maxKategoriiVkus    = 150 // nejvíc hodnot údajů v modelu (nejčastější)
	pocetSkupinCV       = 5   // křížové ověření na pěti částech
	podilZlepseni       = 0.9 // odhad musí mít na ověření chybu nejvýš 90 % chyby prostého průměru
	minPresnostVkus     = 0.5 // a trefit hodnocení ± půl srdíčka aspoň u poloviny modelek
	minPokrytiVkus      = 4   // odhad jen u modelky, která má aspoň tolik skupin údajů
	minPresnostVysokych = 0.6 // „Mohlo by se ti líbit“: z vysokých odhadů na ověření musí sedět aspoň 60 %
)

var lambdyVkusu = []float64{0.5, 2, 8, 32}

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
	VahaFotek     float64             `json:"vahaFotek"`
	VahaNaucena   bool                `json:"vahaNaucena"`
	PorovnaniVahy int                 `json:"porovnaniVahy"`
	ZlepseniFotek float64             `json:"zlepseniFotek"`
	Poradi        []OblibenostModelky `json:"poradi"`
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
	Duvod            string  `json:"duvod"`       // „srdíčka 4 · fotky 4,3 (3 alba, 41 hodnocených fotek) · 12 porovnání (výhry 7)“
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

// Zapomenutí porovnání: záloha databáze učení (jako u ZapomenoutUceni) a smazání všech porovnání. Naučené
// z Údržby zůstává; ZapomenoutUceni naopak porovnání nemaže.
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
	u.ob.porovnani, u.ob.nacteno, u.ob.nabidnute = nil, true, nil
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
			Nejistota: zaokrouhlit3(math.Sqrt(model.rozptylModelky(&m))), Porovnani: model.pocet[m.ID]}
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
	sort.SliceStable(stav.Poradi, func(i, j int) bool {
		x, y := stav.Poradi[i], stav.Poradi[j]
		ox, oy := model.oblibenost[x.ModelkaID], model.oblibenost[y.ModelkaID]
		if ox != oy {
			return ox > oy
		}
		return x.ModelkaID < y.ModelkaID
	})
	for i := range stav.Poradi {
		stav.Poradi[i].Poradi = i + 1
	}
	stav.Modelek = len(stav.Poradi)
	return stav
}

// Nehodnocené modelky s nejvyšším jistým odhadem modelu vkusu (s důvodem); jen odhady aspoň na mediánu srdíček
// sbírky a jen když vysoké odhady na ověření opravdu sedí
func (a *App) GetMohloByTeLibit(pocet int) []OblibenostModelky {
	vysledek := []OblibenostModelky{}
	if a.uc == nil {
		return vysledek
	}
	pocet = min(max(pocet, 1), 200)
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	v := model.vkus
	if v == nil || !v.platny || (v.vysokych >= 5 && v.presnostVysokych < minPresnostVysokych) {
		return vysledek
	}
	type kandidatka struct {
		m      Modelka
		presny float64
	}
	var kandidatky []kandidatka
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			continue
		}
		if odhad, ok := model.odhad[m.ID]; ok && zaokrouhlitNaPul(odhad) >= v.prahVysokych {
			kandidatky = append(kandidatky, kandidatka{m, odhad})
		}
	}
	sort.SliceStable(kandidatky, func(i, j int) bool {
		if kandidatky[i].presny != kandidatky[j].presny {
			return kandidatky[i].presny > kandidatky[j].presny
		}
		return kandidatky[i].m.ID < kandidatky[j].m.ID
	})
	for i, k := range kandidatky[:min(pocet, len(kandidatky))] {
		odhad, duvod, _ := model.odhadModelky(k.m, true)
		if v.vysokych >= 5 {
			duvod += fmt.Sprintf(" (na ověření sedělo %d z %d podobně vysokých odhadů)", v.trefVysokych, v.vysokych)
		}
		vysledek = append(vysledek, OblibenostModelky{ModelkaID: k.m.ID, Jmeno: k.m.Jmeno, Odhad: odhad, Poradi: i + 1,
			Sila: zaokrouhlit3(k.presny), Nejistota: zaokrouhlit3(v.chybaCV), Porovnani: model.pocet[k.m.ID], Duvod: duvod})
	}
	return vysledek
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
	vkusZeSkore bool            // model vkusu bere skóre fotek místo průměru srdíček fotek (vyšlo lépe na ověření)
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
	u.mu.Unlock()
	otisk := otiskOblibenosti(modelky, porovnani)
	if u.ob.model != nil && u.ob.model.otisk == otisk {
		return u.ob.model
	}
	model := spocitatOblibenost(modelky, porovnani, time.Now())
	model.otisk = otisk
	u.ob.model = model
	return model
}

// Otisk všeho, z čeho se oblíbenost počítá: údaje modelek (i srdíčka fotek a fotografové), porovnání (počet a
// poslední číslo – vrácení i nové porovnání ho změní) a dnešní datum (stáří porovnání)
func otiskOblibenosti(modelky []Modelka, porovnani []porovnaniZaznam) string {
	o := novyOtiskovac()
	o.text(verzeOblibenosti, time.Now().Format("2006-01-02"))
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
	model := &modelOblibenosti{oblibenost: map[int]float64{}, odhad: map[int]float64{}, predpoklad: map[int]float64{}, zFotek: map[int]bool{}, porovnani: len(porovnani)}
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

	// Předpoklady: hodnocené modelky, modelky s hodnocenými fotkami a porovnávané nehodnocené; zvlášť jen ze srdíček
	// (cíl modelu vkusu)
	stred, sigma := map[int]float64{}, map[int]float64{}
	stredSrdicka, sigmaSrdicka := map[int]float64{}, map[int]float64{}
	for _, m := range modelky {
		sf, maF := model.skore[m.ID]
		if st, sg, ok := predpokladModelky(m.Hodnoceni, sf, maF, model.kalibrace, model.vaha.vaha); ok {
			stred[m.ID], sigma[m.ID] = st, sg
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
				stred[id], sigma[id] = model.prumer, sigmaNehodnocene
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

	// Model vkusu se učí na srdíčkách upřesněných porovnáním bez skóre fotek: fotky jsou mezi jeho údaji, v cíli by
	// se počítaly podruhé. Údaj o fotkách je průměr srdíček fotek, nebo skóre fotek, podle toho, co vyjde lépe na ověření.
	cil := map[int]float64{}
	if len(porovnani) > 0 {
		btSrdicka := spocitatBT(stredSrdicka, sigmaSrdicka, porovnani, nyni)
		for _, m := range modelky {
			if s, ok := btSrdicka.sila[m.ID]; ok && m.Hodnoceni > 0 {
				cil[m.ID] = m.Hodnoceni + min(max(s-m.Hodnoceni, -rozpetiCileVkusu), rozpetiCileVkusu)
			}
		}
	}
	udaje := pripravitUdajeVkusu(modelky)
	model.vkus = naucitVkus(modelky, cil, udaje)
	if v := model.vkus; len(model.skore) > 0 && v.chybaCV > 0 {
		udajeSkore := make(map[int]udajeVkusu, len(udaje))
		for id, u := range udaje {
			sf, ok := model.skore[id]
			u.cis[cvFotky], u.ma[cvFotky] = sf.skore, ok
			udajeSkore[id] = u
		}
		if s := naucitVkus(modelky, cil, udajeSkore); s.chybaCV > 0 && s.chybaCV < v.chybaCV-1e-9 {
			model.vkus, model.vkusZeSkore = s, true
		}
	}
	if v := model.vkus; v != nil && v.platny {
		maps.Copy(model.odhad, v.odhady)
	}
	return model
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
// srdíčky. Kandidátky jsou ke každé modelce nejbližší sousedé podle síly (sousedeDvojic na každou stranu).
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
}

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
		duvod := fmt.Sprintf("Nehodnocená modelka proti modelce s %s", textSrdicek7(k.y.Hodnoceni))
		if odhad, ok := model.odhad[k.x.ID]; ok {
			duvod += fmt.Sprintf(" (odhad podle vkusu %s)", textSrdicek(zaokrouhlitNaPul(odhad)))
		} else if sf, ok := model.skore[k.x.ID]; ok {
			duvod += fmt.Sprintf(" (její fotky mají skóre %s)", cisloCesky(sf.skore, 1))
		}
		return duvod
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

	var kandidati []kandidatDvojice
	informace := func(x, y *Modelka, sx, sy float64) float64 {
		p := zLogitu(skalaBT * (sx - sy))
		return p * (1 - p) * (model.rozptylModelky(x) + model.rozptylModelky(y))
	}
	if okruh == "nehodnocene" {
		// Nehodnocená modelka proti hodnocené kotvě blízko jejímu odhadu (vkus, jinak průměr sbírky)
		for _, x := range nehodnocene {
			// Odhad vkusu, jinak předpoklad ze skóre fotek, jinak průměr sbírky
			cil := model.prumer
			if p, ok := model.predpoklad[x.ID]; ok {
				cil = p
			}
			if odhad, ok := model.odhad[x.ID]; ok {
				cil = odhad
			}
			sx := model.silaModelky(x)
			if _, ok := model.sila[x.ID]; !ok {
				sx = cil
			}
			i := sort.Search(len(hodnocene), func(i int) bool { return silaM(hodnocene[i]) >= cil })
			for j := max(0, i-sousedeDvojic/2); j < min(len(hodnocene), i+sousedeDvojic/2); j++ {
				y := hodnocene[j]
				if vyloucene[klicDvojice(x.ID, y.ID)] {
					continue
				}
				kandidati = append(kandidati, kandidatDvojice{a: x.ID, b: y.ID, skore: informace(x, y, sx, silaM(y)) * vahaModelky(x) * vahaModelky(y),
					druh: dvojiceNehodnocena, x: x, y: y})
			}
		}
	} else {
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
				kandidati = append(kandidati, kandidatDvojice{a: x.ID, b: y.ID, skore: informace(x, y, silaM(x), silaM(y)) * vahaUrovne * vahaModelky(x) * vahaModelky(y),
					pruzkum: rozdil <= 0.5, druh: druh, x: x, y: y})
			}
		}
	}
	if len(kandidati) == 0 {
		return vysledek
	}
	sort.SliceStable(kandidati, func(i, j int) bool {
		if kandidati[i].skore != kandidati[j].skore {
			return kandidati[i].skore > kandidati[j].skore
		}
		return klicDvojice(kandidati[i].a, kandidati[i].b)[0] < klicDvojice(kandidati[j].a, kandidati[j].b)[0]
	})
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
	dalsi := 0
	for len(vysledek) < pocet {
		if nahoda.Float64() < podilPruzkumu {
			// Průzkum: náhodná použitelná dvojice ze stejné nebo sousední úrovně
			var moznosti []kandidatDvojice
			for _, k := range kandidati {
				if (k.pruzkum || okruh == "nehodnocene") && pouzitelny(k) {
					moznosti = append(moznosti, k)
				}
			}
			if len(moznosti) > 0 {
				k := moznosti[nahoda.Intn(len(moznosti))]
				pridat(k, "Průzkum: náhodná dvojice ze stejné nebo sousední úrovně, aby se pořadí neučilo jen z nejistých")
				continue
			}
		}
		for dalsi < len(kandidati) && !pouzitelny(kandidati[dalsi]) {
			dalsi++
		}
		if dalsi >= len(kandidati) {
			break
		}
		pridat(kandidati[dalsi], duvodDvojice(kandidati[dalsi], model))
	}
	return vysledek
}

// ---------------------------------------------------------------------------------------------------------
// Model vkusu
//
// Hřebenová regrese oblíbenosti hodnocených modelek (srdíčka upřesněná porovnáním) na údaje modelky: hodnoty
// údajů jako 0/1 (etnicita, národnost, vlasy, oči, typ a košíček prsou, ochlupení, tetování, piercing, desetiletí
// prvního vydání, kategorie, fotografové alb), postava a průměr srdíček jejích fotek standardizované (chybějící
// = průměr). Hodnota údaje se počítá, když ji má aspoň minPodporaVkus hodnocených modelek (nejvýš maxKategoriiVkus
// nejčastějších). Síla penalizace λ se vybere křížovým ověřením na pěti částech (rozdělení podle čísla modelky,
// opakovatelné). Na ověření se měří chyba odhadu (průměrná odchylka od srdíček), chyba prostého průměru a přesnost
// (zaokrouhlený odhad do ± půl srdíčka). Odhady se ukazují, jen když je hodnocených aspoň minHodnocenychVkus, chyba
// je nejvýš podilZlepseni chyby průměru a přesnost aspoň minPresnostVkus; u modelky jen s aspoň minPokrytiVkus
// skupinami údajů. Důvod jsou nejsilnější příspěvky wⱼ·(xⱼ − x̄ⱼ) ve směru odhadu.

// Číselné údaje modelu vkusu
const (
	cvVyska = iota
	cvVaha
	cvHrudnik
	cvPas
	cvBoky
	cvBmi
	cvFotky
	pocetCisVkusu
)

var popisCisVkusu = [pocetCisVkusu]struct{ nazev, jednotka string }{
	{"výška", "cm"}, {"váha", "kg"}, {"hrudník", "cm"}, {"pas", "cm"}, {"boky", "cm"}, {"BMI", ""}, {"srdíčka jejích fotek", ""},
}

type udajeVkusu struct {
	kat    []string // klíče hodnot „vlasy=blond“
	zapisy []string // zápis hodnoty k důvodu (stejné pořadí)
	cis    [pocetCisVkusu]float64
	ma     [pocetCisVkusu]bool
	skupin int // počet skupin údajů, které modelka má
}

type modelVkusu struct {
	sloupce  []string // klíče hodnot údajů (pak číselné údaje)
	popisy   []string // zápis do důvodu
	index    map[string]int
	stredCis [pocetCisVkusu]float64
	sdCis    [pocetCisVkusu]float64
	maCis    [pocetCisVkusu]bool
	stred    []float64 // průměr sloupce v trénovacích datech
	w        []float64
	prumer   float64
	lambda   float64
	n        int

	chybaCV, chybaZaklad, presnost float64
	prahVysokych                   float64 // medián srdíček hodnocených: od něj je odhad „vysoký“
	vysokych, trefVysokych         int     // vysoké odhady na ověření a kolik z nich mělo srdíčka aspoň prahVysokych
	presnostVysokych               float64
	platny                         bool
	odhady                         map[int]float64 // odhad u modelek s dost údaji
	udaje                          map[int]udajeVkusu
}

// Košíček z velikosti prsou („34C“, „C“, „34 DD“)
var vzorKosicku = regexp.MustCompile(`^\s*\d*\s*([A-H]{1,4})\s*$`)

// Údaje modelky pro model vkusu; klic = mezipaměť zjednodušených textů (stejné hodnoty se opakují)
func udajeModelkyVkus(m Modelka, klic func(pole, text string) string) udajeVkusu {
	var u udajeVkusu
	pridat := func(skupina, hodnota, zapis string) {
		if hodnota == "" {
			return
		}
		k := skupina + "=" + hodnota
		for _, x := range u.kat {
			if x == k {
				return
			}
		}
		u.kat = append(u.kat, k)
		u.zapisy = append(u.zapisy, zapis)
	}
	skupiny := 0
	jednoducha := func(skupina, pole, text, predpona string) {
		if t := strings.TrimSpace(text); t != "" {
			pridat(skupina, klic(pole, t), predpona+t)
			skupiny++
		}
	}
	jednoducha("etnicita", "etnicita", m.Etnicita, "")
	jednoducha("narodnost", "narodnost", m.Narodnost, "")
	jednoducha("vlasy", "vlasy", m.VlasyBarva, "")
	jednoducha("oci", "oci", m.OciBarva, "oči: ")
	jednoducha("prsa", "prsa", m.PrsaTyp, "prsa: ")
	jednoducha("ochlupeni", "ochlupeni", m.Ochlupeni, "ochlupení: ")
	if k := vzorKosicku.FindStringSubmatch(strings.ToUpper(m.VelikostPrsou)); k != nil {
		kosicek := k[1]
		if len(kosicek) > 1 || kosicek > "D" {
			kosicek = "DD+"
		}
		pridat("kosicek", kosicek, "košíček "+kosicek)
	}
	if m.Tetovani == 1 || m.Tetovani == 0 || m.Piercing == 1 || m.Piercing == 0 {
		skupiny++
	}
	switch m.Tetovani {
	case 1:
		pridat("tetovani", "ano", "tetování")
	case 0:
		pridat("tetovani", "ne", "bez tetování")
	}
	switch m.Piercing {
	case 1:
		pridat("piercing", "ano", "piercing")
	case 0:
		pridat("piercing", "ne", "bez piercingu")
	}
	if rok := prvniRokModelky(m); rok > 0 {
		desetileti := rok / 10 * 10
		pridat("era", fmt.Sprint(desetileti), textDesetileti(desetileti))
		skupiny++
	}
	kategorie := strings.Split(m.Role, ",")
	if len(m.Centerfoldy) > 0 {
		kategorie = append(kategorie, "Playmate měsíce")
	}
	if m.CyberGirl != "" {
		kategorie = append(kategorie, "Cyber Girl "+m.CyberGirl)
	}
	if len(m.Obalky) > 0 {
		kategorie = append(kategorie, "Modelka obálky")
	}
	maKategorii := false
	for _, k := range kategorie {
		if k = strings.TrimSpace(k); k != "" {
			pridat("kategorie", klic("kategorie", k), k)
			maKategorii = true
		}
	}
	if maKategorii {
		skupiny++
	}
	maFotografa := false
	for _, f := range strings.Split(m.fotografoveAlb, "\n") {
		if f = strings.TrimSpace(f); f != "" {
			pridat("fotograf", klic("fotograf", f), f)
			maFotografa = true
		}
	}
	if maFotografa {
		skupiny++
	}
	postava := priznakyModelky(m)
	for j, cv := range map[int]int{prVyska: cvVyska, prVaha: cvVaha, prHrudnik: cvHrudnik, prPas: cvPas, prBoky: cvBoky, prBmi: cvBmi} {
		u.cis[cv], u.ma[cv] = postava.x[j], postava.ma[j]
	}
	if postava.ma[prVyska] || postava.ma[prVaha] || postava.ma[prHrudnik] {
		skupiny++
	}
	if m.fotekHodnocenych >= 2 {
		u.cis[cvFotky], u.ma[cvFotky] = float64(m.srdciFotek)/float64(m.fotekHodnocenych), true
		skupiny++
	}
	u.skupin = skupiny
	return u
}

// Rok prvního výskytu modelky (vydání, centerfold, online album); 0 = neznámý
func prvniRokModelky(m Modelka) int {
	prvni := 0
	for _, seznam := range [][]string{m.Vydani, m.Centerfoldy, m.OnlineAlba, m.Obalky} {
		for _, v := range seznam {
			if len(v) < 4 {
				continue
			}
			rok := 0
			if _, err := fmt.Sscanf(v[:4], "%d", &rok); err == nil && rok > 1900 && (prvni == 0 || rok < prvni) {
				prvni = rok
			}
		}
	}
	return prvni
}

// „70. léta“, „léta 2000–2009“
func textDesetileti(desetileti int) string {
	if desetileti >= 1900 && desetileti < 2000 {
		return fmt.Sprintf("%d. léta", desetileti-1900)
	}
	return fmt.Sprintf("léta %d–%d", desetileti, desetileti+9)
}

// Údaje všech modelek pro model vkusu (počítají se jednou pro obě varianty údaje o fotkách)
func pripravitUdajeVkusu(modelky []Modelka) map[int]udajeVkusu {
	pamet := map[string]string{}
	klic := func(pole, text string) string {
		k := pole + "\x00" + text
		if v, ok := pamet[k]; ok {
			return v
		}
		v := klicHodnoty(pole, text)
		pamet[k] = v
		return v
	}
	udaje := make(map[int]udajeVkusu, len(modelky))
	for _, m := range modelky {
		udaje[m.ID] = udajeModelkyVkus(m, klic)
	}
	return udaje
}

// oblibenost: cíl hodnocených modelek (chybí = srdíčka); udaje z pripravitUdajeVkusu
func naucitVkus(modelky []Modelka, oblibenost map[int]float64, udaje map[int]udajeVkusu) *modelVkusu {
	v := &modelVkusu{udaje: udaje, odhady: map[int]float64{}, index: map[string]int{}}
	var hodnocene []int // indexy modelek
	podpora := map[string]int{}
	zapisy := map[string]map[string]int{}
	for i, m := range modelky {
		u := udaje[m.ID]
		if m.Hodnoceni <= 0 {
			continue
		}
		hodnocene = append(hodnocene, i)
		for x, k := range u.kat {
			podpora[k]++
			if zapisy[k] == nil {
				zapisy[k] = map[string]int{}
			}
			zapisy[k][u.zapisy[x]]++
		}
	}
	v.n = len(hodnocene)
	if v.n < minHodnocenychCV {
		return v
	}
	// Hodnoty údajů s dost modelkami, nejčastější napřed
	for k, n := range podpora {
		if n >= minPodporaVkus && n < v.n {
			v.sloupce = append(v.sloupce, k)
		}
	}
	sort.Slice(v.sloupce, func(i, j int) bool {
		if podpora[v.sloupce[i]] != podpora[v.sloupce[j]] {
			return podpora[v.sloupce[i]] > podpora[v.sloupce[j]]
		}
		return v.sloupce[i] < v.sloupce[j]
	})
	v.sloupce = v.sloupce[:min(len(v.sloupce), maxKategoriiVkus)]
	for _, k := range v.sloupce {
		// Nejčastější zápis hodnoty (při shodě abecedně první)
		nejlepsi, pocet := "", 0
		for z, n := range zapisy[k] {
			if n > pocet || (n == pocet && z < nejlepsi) {
				nejlepsi, pocet = z, n
			}
		}
		v.popisy = append(v.popisy, nejlepsi)
	}
	// Číselné údaje: průměr a směrodatná odchylka z hodnocených (aspoň 10 hodnot)
	for c := range pocetCisVkusu {
		var hodnoty []float64
		for _, i := range hodnocene {
			if u := v.udaje[modelky[i].ID]; u.ma[c] {
				hodnoty = append(hodnoty, u.cis[c])
			}
		}
		if len(hodnoty) < 10 {
			continue
		}
		prumer, rozptyl := 0.0, 0.0
		for _, x := range hodnoty {
			prumer += x
		}
		prumer /= float64(len(hodnoty))
		for _, x := range hodnoty {
			rozptyl += (x - prumer) * (x - prumer)
		}
		sd := math.Sqrt(rozptyl / float64(len(hodnoty)))
		if sd < 1e-9 {
			continue
		}
		v.stredCis[c], v.sdCis[c], v.maCis[c] = prumer, sd, true
		v.sloupce = append(v.sloupce, fmt.Sprintf("#%d", c))
		v.popisy = append(v.popisy, popisCisVkusu[c].nazev)
	}
	for j, k := range v.sloupce {
		v.index[k] = j
	}
	p := len(v.sloupce)

	// Řídké řádky hodnocených modelek; Gramova matice a součty po částech křížového ověření
	type prvek struct {
		j int
		x float64
	}
	radek := func(m Modelka) []prvek {
		u := v.udaje[m.ID]
		var r []prvek
		for _, k := range u.kat {
			if j, ok := v.index[k]; ok {
				r = append(r, prvek{j, 1})
			}
		}
		for c := range pocetCisVkusu {
			if v.maCis[c] && u.ma[c] {
				r = append(r, prvek{v.index[fmt.Sprintf("#%d", c)], (u.cis[c] - v.stredCis[c]) / v.sdCis[c]})
			}
		}
		return r
	}
	type cast struct {
		gram   [][]float64
		soucet []float64 // Σ x
		xy     []float64 // Σ x·y
		sy     float64
		n      int
	}
	novaCast := func() *cast {
		c := &cast{gram: make([][]float64, p), soucet: make([]float64, p), xy: make([]float64, p)}
		for j := range c.gram {
			c.gram[j] = make([]float64, p)
		}
		return c
	}
	casti := make([]*cast, pocetSkupinCV)
	for i := range casti {
		casti[i] = novaCast()
	}
	radky := make([][]prvek, len(hodnocene))
	cil := make([]float64, len(hodnocene))
	skupina := make([]int, len(hodnocene))
	for r, i := range hodnocene {
		m := modelky[i]
		radky[r] = radek(m)
		cil[r] = oblibenost[m.ID]
		if cil[r] == 0 {
			cil[r] = m.Hodnoceni
		}
		skupina[r] = int(uint32(m.ID)*2654435761>>8) % pocetSkupinCV
		c := casti[skupina[r]]
		for _, a := range radky[r] {
			c.soucet[a.j] += a.x
			c.xy[a.j] += a.x * cil[r]
			for _, b := range radky[r] {
				c.gram[a.j][b.j] += a.x * b.x
			}
		}
		c.sy += cil[r]
		c.n++
	}
	// Řešení pro trénovací data bez části vynech (-1 = všechna): w a průměry sloupců
	resit := func(vynech int, lambda float64) (w, stred []float64, prumer float64, ok bool) {
		t := novaCast()
		for s, c := range casti {
			if s == vynech {
				continue
			}
			for j := range p {
				t.soucet[j] += c.soucet[j]
				t.xy[j] += c.xy[j]
				for l := range p {
					t.gram[j][l] += c.gram[j][l]
				}
			}
			t.sy += c.sy
			t.n += c.n
		}
		if t.n < 5 {
			return nil, nil, 0, false
		}
		n := float64(t.n)
		prumer = t.sy / n
		stred = make([]float64, p)
		for j := range p {
			stred[j] = t.soucet[j] / n
		}
		// Centrovaná soustava (XᵀX − n·x̄x̄ᵀ + λI)·w = Xᵀy − n·x̄·ȳ
		a := make([][]float64, p)
		b := make([]float64, p)
		for j := range p {
			a[j] = make([]float64, p)
			for l := range p {
				a[j][l] = t.gram[j][l] - n*stred[j]*stred[l]
			}
			a[j][j] += lambda
			b[j] = t.xy[j] - n*stred[j]*prumer
		}
		w = resitCholesky(a, b)
		if w == nil {
			return nil, nil, 0, false
		}
		return w, stred, prumer, true
	}
	predikce := func(r []prvek, w, stred []float64, prumer float64) float64 {
		y := prumer
		for j := range stred {
			y -= w[j] * stred[j]
		}
		for _, a := range r {
			y += w[a.j] * a.x
		}
		return y
	}
	// Křížové ověření pro každou λ
	type overeni struct{ chyba, zaklad, presnost float64 }
	overit := func(lambda float64) (overeni, []float64, bool) {
		var o overeni
		odhady := make([]float64, len(radky))
		for s := range pocetSkupinCV {
			w, stred, prumer, ok := resit(s, lambda)
			if !ok {
				return o, nil, false
			}
			for r := range radky {
				if skupina[r] != s {
					continue
				}
				h := modelky[hodnocene[r]].Hodnoceni
				odhady[r] = predikce(radky[r], w, stred, prumer)
				o.chyba += math.Abs(odhady[r] - h)
				o.zaklad += math.Abs(prumer - h)
				if math.Abs(min(max(zaokrouhlitNaPul(odhady[r]), 0.5), 5)-h) <= 0.5 {
					o.presnost++
				}
			}
		}
		n := float64(len(radky))
		return overeni{o.chyba / n, o.zaklad / n, o.presnost / n}, odhady, true
	}
	nejlepsi, nejlepsiLambda := overeni{chyba: math.Inf(1)}, 0.0
	var odhadyCV []float64
	for _, lambda := range lambdyVkusu {
		if o, odhady, ok := overit(lambda); ok && o.chyba < nejlepsi.chyba {
			nejlepsi, nejlepsiLambda, odhadyCV = o, lambda, odhady
		}
	}
	if odhadyCV == nil {
		return v
	}
	v.chybaCV, v.chybaZaklad, v.presnost, v.lambda = nejlepsi.chyba, nejlepsi.zaklad, nejlepsi.presnost, nejlepsiLambda
	// Vysoké odhady na ověření: od mediánu srdíček hodnocených
	srdicka := make([]float64, len(hodnocene))
	for r, i := range hodnocene {
		srdicka[r] = modelky[i].Hodnoceni
	}
	sort.Float64s(srdicka)
	v.prahVysokych = max(2.5, zaokrouhlitNaPul(kvantil(srdicka, 0.5)))
	for r, i := range hodnocene {
		if zaokrouhlitNaPul(odhadyCV[r]) >= v.prahVysokych {
			v.vysokych++
			if modelky[i].Hodnoceni >= v.prahVysokych {
				v.trefVysokych++
			}
		}
	}
	if v.vysokych > 0 {
		v.presnostVysokych = float64(v.trefVysokych) / float64(v.vysokych)
	}
	v.platny = v.n >= minHodnocenychVkus && v.chybaCV <= podilZlepseni*v.chybaZaklad && v.presnost >= minPresnostVkus
	w, stred, prumer, ok := resit(-1, nejlepsiLambda)
	if !ok {
		v.platny = false
		return v
	}
	v.w, v.stred, v.prumer = w, stred, prumer
	if !v.platny {
		return v
	}
	for _, m := range modelky {
		u := v.udaje[m.ID]
		if u.skupin < minPokrytiVkus {
			continue
		}
		v.odhady[m.ID] = min(max(predikce(radek(m), w, stred, prumer), 0.5), 5)
	}
	return v
}

// Příspěvky údajů modelky k odhadu (wⱼ·(xⱼ − x̄ⱼ)) jako text: nejsilnější tři ve směru odchylky od průměru
func (v *modelVkusu) duvodOdhadu(id int, odhad float64) string {
	u := v.udaje[id]
	type prispevek struct {
		popis string
		c     float64
	}
	var prispevky []prispevek
	pritomne := map[int]bool{}
	for _, k := range u.kat {
		if j, ok := v.index[k]; ok {
			pritomne[j] = true
			prispevky = append(prispevky, prispevek{v.popisy[j], v.w[j] * (1 - v.stred[j])})
		}
	}
	for c := range pocetCisVkusu {
		if !v.maCis[c] || !u.ma[c] {
			continue
		}
		j := v.index[fmt.Sprintf("#%d", c)]
		z := (u.cis[c] - v.stredCis[c]) / v.sdCis[c]
		popis := popisCisVkusu[c].nazev + " " + strings.Replace(fmt.Sprintf("%.3g", u.cis[c]), ".", ",", 1)
		if popisCisVkusu[c].jednotka != "" {
			popis = fmt.Sprintf("%s %d %s", popisCisVkusu[c].nazev, int(math.Round(u.cis[c])), popisCisVkusu[c].jednotka)
		}
		prispevky = append(prispevky, prispevek{popis, v.w[j] * (z - v.stred[j])})
	}
	smer := 1.0
	if odhad < v.prumer {
		smer = -1
	}
	sort.SliceStable(prispevky, func(i, j int) bool { return prispevky[i].c*smer > prispevky[j].c*smer })
	var casti []string
	for _, p := range prispevky {
		if p.c*smer < 0.05 || len(casti) == 3 {
			break
		}
		casti = append(casti, p.popis)
	}
	return strings.Join(casti, ", ")
}

// Odhad hodnocení modelky po polovinách s důvodem; ok = false bez platného modelu nebo s málo údaji.
// sDuvodem = false vynechá text (rychlejší).
func (m *modelOblibenosti) odhadModelky(x Modelka, sDuvodem bool) (float64, string, bool) {
	odhad, ok := m.odhad[x.ID]
	if !ok || m.vkus == nil {
		return 0, "", false
	}
	zaokrouhleny := zaokrouhlitNaPul(odhad)
	duvod := "Odhad " + textSrdicek(zaokrouhleny)
	if sDuvodem {
		if d := m.vkus.duvodOdhadu(x.ID, odhad); d != "" {
			duvod += ": " + d
		}
	}
	return zaokrouhleny, duvod, true
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
