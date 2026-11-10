package main

import (
	"fmt"
	"maps"
	"math"
	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/oblibenost"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Model vkusu: odhad hodnocení nehodnocených modelek z jejich údajů (celkový popis v docs/UCENI.md, oddíl Model
// vkusu). Pořadí oblíbenosti, Bradley–Terry a výběr dvojic jsou v oblibenost.go, skóre fotek v oblibenost_fotky.go,
// učení v oblibenost_vkus_uceni.go a důvod odhadu v oblibenost_vkus_duvod.go.

// Parametry modelu vkusu
const (
	minHodnocenychVkus = 30 // z méně hodnocených modelek se vkus neodhaduje
	minHodnocenychCV   = 15 // od tolika se aspoň spočítá přesnost (pro přehled)
	minPodporaVkus     = 3  // hodnota údaje (blond, fotograf…) se počítá, když ji má aspoň tolik hodnocených modelek
	// Poměr hrudník/pas a věk při prvním vydání až od tolika hodnocených modelek s údajem: s méně (zkušební sbírka se
	// 69 hodnocenými) odhad zhoršily, model se v nich učil šum; od asi stovky pomáhají
	minPodporaOdvozenych = 60
	maxKategoriiVkus     = 150 // nejvíc hodnot údajů v modelu (nejčastější)
	pocetSkupinCV        = 5   // křížové ověření na pěti částech
	podilZlepseni        = 0.9 // odhad musí mít na ověření chybu nejvýš 90 % chyby prostého průměru
	minPresnostVkus      = 0.5 // a trefit hodnocení ± půl srdíčka aspoň u poloviny modelek
	minPokrytiVkus       = 4   // odhad jen u modelky, která má aspoň tolik skupin údajů
	minPresnostVysokych  = 0.6 // „Mohlo by se ti líbit“: z vysokých odhadů na ověření musí sedět aspoň 60 %
	kosuHrebene          = 5   // regrese: číselný údaj i po pětinách (rozmezí)
	minOverenychVkus     = 20  // skupina podle bohatosti údajů se hodnotí jen na aspoň tolika hodnocených modelkách
	pocetPodobnychVkus   = 2   // důvod odhadu: tolik nejpodobnějších hodnocených modelek
)

var lambdyVkusu = []float64{2, 8, 32, 128}

// Nehodnocené modelky s nejvyšším odhadem modelu vkusu (s důvodem, vybratTipy); nejistota = chyba ověření
// u modelek s podobně bohatými údaji
func (a *App) GetMohloByTeLibit(pocet int) []OblibenostModelky {
	vysledek := []OblibenostModelky{}
	if a.uc == nil {
		return vysledek
	}
	pocet = min(max(pocet, 1), 200)
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	v := model.vkus
	kandidatky := vybratTipy(modelky, model)
	for i, k := range kandidatky[:min(pocet, len(kandidatky))] {
		// Důvod jako věta ze slovníku údajů (oblibenost_vkus_veta.go), ne výčet
		odhad, duvod := zaokrouhlitNaPul(k.presny), v.vetaTipu(k.m.ID, k.presny)
		nejistota := v.chybaKose[kosBohatosti(v.udaje[k.m.ID])]
		if nejistota == 0 {
			nejistota = v.chybaCV
		}
		vysledek = append(vysledek, OblibenostModelky{ModelkaID: k.m.ID, Jmeno: k.m.Jmeno, Odhad: odhad, Poradi: i + 1,
			Sila: zaokrouhlit3(k.presny), Nejistota: zaokrouhlit3(nejistota), Porovnani: model.pocet[k.m.ID], Duvod: duvod})
	}
	return vysledek
}

// Důvod odhadu hodnocení nehodnocené modelky („Odhad 4 srdíčka: blond, 70. léta; podobně jako Anna (4½)…“)
// pro nápovědu štítku „odhad“; "" bez ukázaného odhadu
func (a *App) GetDuvodOdhadu(id int) string {
	if a.uc == nil {
		return ""
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	for _, m := range modelky {
		if odhad, ok := model.odhad[m.ID]; ok && m.ID == id && m.Hodnoceni <= 0 {
			return model.vkus.textOdhadu(id, odhad, true, true)
		}
	}
	return ""
}

type tipVkusu struct {
	m      Modelka
	presny float64
}

// Kandidátky „Mohlo by se ti líbit“ od nejvyššího odhadu: nehodnocené s dost údaji a odhadem aspoň na mediánu
// srdíček; nic bez platného modelu nebo když vysoké odhady na ověření nesedí. Na rozdíl od odhadu v seznamu
// modelek (jen skupiny údajů, kde odhad jasně překonal průměr) jde o pořadí: i bez srdíček fotek vysoký odhad
// na ověření sedí (víc než průměrná modelka), jen jeho přesná hodnota je méně jistá.
func vybratTipy(modelky []Modelka, model *modelOblibenosti) []tipVkusu {
	v := model.vkus
	if v == nil || !v.platny || (v.vysokych >= 5 && v.presnostVysokych < minPresnostVysokych) {
		return nil
	}
	var kandidatky []tipVkusu
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			continue
		}
		if odhad, ok := v.surove[m.ID]; ok && v.udaje[m.ID].skupin >= minPokrytiVkus && zaokrouhlitNaPul(odhad) >= v.prahVysokych {
			kandidatky = append(kandidatky, tipVkusu{m, odhad})
		}
	}
	sort.SliceStable(kandidatky, func(i, j int) bool {
		if kandidatky[i].presny != kandidatky[j].presny {
			return kandidatky[i].presny > kandidatky[j].presny
		}
		return kandidatky[i].m.ID < kandidatky[j].m.ID
	})
	return kandidatky
}

// Model vkusu do modelu oblíbenosti: cíl ze srdíček upřesněných porovnáním (Bradley–Terry s předpokladem jen ze
// srdíček), údaje modelek včetně skóre fotek a odhady platného modelu
func (model *modelOblibenosti) naucitModelVkusu(modelky []Modelka, porovnani []porovnaniZaznam, stredSrdicka, sigmaSrdicka map[int]float64, nyni time.Time) *vysledekBT {
	// Model vkusu se učí na srdíčkách upřesněných porovnáním bez skóre fotek: fotky jsou mezi jeho údaji, v cíli by
	// se počítaly podruhé.
	cil := map[int]float64{}
	var btSrdicka *vysledekBT
	if len(porovnani) > 0 {
		bt := spocitatBT(stredSrdicka, sigmaSrdicka, porovnani, nyni)
		btSrdicka = &bt
		for _, m := range modelky {
			if s, ok := btSrdicka.sila[m.ID]; ok && m.Hodnoceni > 0 {
				cil[m.ID] = m.Hodnoceni + min(max(s-m.Hodnoceni, -rozpetiCileVkusu), rozpetiCileVkusu)
			}
		}
	}
	// Učební modelky: srdíčka jen převzatá z odhadu vkusu (rychlé hodnocení) se nepočítají, dokud je nepotvrdí aspoň
	// tři porovnání – model by se učil sám ze sebe; nehodnocená s aspoň třemi porovnáními a jistou silou (jako pro
	// návrh srdíček) učí síla z porovnání, jen do učení (ověření a „podobné modelky“ v důvodu zůstávají srdíčkům)
	pocet := map[int]int{}
	for _, p := range porovnani {
		pocet[p.a]++
		pocet[p.b]++
	}
	ucebni := append([]Modelka(nil), modelky...)
	nast := nastaveniVkusuVychozi
	for i := range ucebni {
		m := &ucebni[i]
		if h, ok := model.prevzate[m.ID]; ok && m.Hodnoceni > 0 && math.Abs(h-m.Hodnoceni) < 1e-9 && pocet[m.ID] < minPorovnaniNavrhu {
			m.Hodnoceni = 0
			continue
		}
		if m.Hodnoceni <= 0 && pocet[m.ID] >= minPorovnaniNavrhu && btSrdicka != nil {
			if s, ok := btSrdicka.sila[m.ID]; ok && math.Sqrt(btSrdicka.rozptyl[m.ID]) <= maxNejistotaNavrhu {
				sila := oriznoutSrdicka(s)
				m.Hodnoceni, cil[m.ID] = zaokrouhlitNaPul(sila), sila
				if nast.jenTrenink == nil {
					nast.jenTrenink = map[int]bool{}
				}
				nast.jenTrenink[m.ID] = true
			}
		}
	}
	// Údaje nezávisí na srdíčkách (ucebni se od modelek liší jen jimi); připravené se zkopírují, skóre fotek je mění
	udaje := maps.Clone(model.udajeVstup)
	if udaje == nil {
		udaje = pripravitUdajeVkusu(ucebni)
	}
	model.udajeVstup = nil
	doplnitSkoreVkusu(udaje, model.skore)
	model.vkus = naucitVkus(ucebni, cil, udaje, nast)
	model.vkusZeSkore = len(model.skore) > 0 && nastaveniVkusuVychozi.fotky != fotkyPrumer
	if v := model.vkus; v != nil && v.platny {
		maps.Copy(model.odhad, v.odhady)
	}
	return btSrdicka
}

// Obsah fotek (obrazové modely, obsah_fotek.go) do údajů modelek: vlastní skupina údajů, i u modelky bez
// hodnocených fotek – proto pomáhá hlavně u nehodnocených kandidátek „Mohlo by se ti líbit“
func doplnitObsahVkusu(udaje map[int]udajeVkusu, obsah map[int]float64) {
	for id, x := range obsah {
		u, ok := udaje[id]
		if !ok {
			continue
		}
		if !u.ma[cvObsah] {
			u.skupin++
		}
		u.cis[cvObsah], u.ma[cvObsah] = x, true
		udaje[id] = u
	}
}

// Skóre fotek (oblibenost_fotky.go) do údajů modelek; modelka s hodnocenými fotkami má skupinu údajů o fotkách
func doplnitSkoreVkusu(udaje map[int]udajeVkusu, skore map[int]skoreFotek) {
	for id, sf := range skore {
		u, ok := udaje[id]
		if !ok {
			continue
		}
		if !u.ma[cvFotky] {
			u.skupin++
		}
		u.cis[cvSkore], u.ma[cvSkore] = sf.skore, true
		udaje[id] = u
	}
}

// ---------------------------------------------------------------------------------------------------------
// Model vkusu
//
// Odhad srdíček z údajů modelky jako vážený průměr dvou modelů, oba ověřené křížovým ověřením na pěti částech
// (rozdělení podle čísla modelky, opakovatelné):
//
//   - hřebenová (ridge) regrese na hodnotách údajů jako 0/1 (etnicita, národnost, vlasy, oči, typ a košíček
//     prsou, ochlupení, tetování, piercing, desetiletí, kategorie bez roku, fotografové) a na číselných údajích
//     robustně standardizovaných (medián a MAD, oříznuté na ±3) i po pětinách (rozmezí „výška 165–169 cm“);
//     chybějící číselný údaj = 0 po standardizaci; λ vybere ověření;
//   - gradientně posilované mělké stromy (oblibenost_vkus_stromy.go) na hodnotách údajů a číselných údajích
//     (i rok prvního výskytu, poměry pas/boky a hrudník/pas a věk při prvním vydání), chybějící údaj jde svou
//     cestou; počet stromů vybere ověření.
//     Stromy zachytí souvislosti, které přímka nevidí (blond jen v jedné éře, oblíbené rozmezí výšky).
//
// Váhu stromů v průměru (0, ¼, ½, ¾, 1) vybere ověření. Hodnota údaje se počítá, když ji má aspoň minPodporaVkus
// hodnocených modelek (nejvýš maxKategoriiVkus nejčastějších). Údaje o fotkách (průměr srdíček fotek a skóre
// fotek) jsou mezi údaji, cíl je bez skóre fotek (žádné dvojí započtení).
//
// Přesnost má přednost před úplností: modelky se rozdělí do šesti skupin podle bohatosti údajů (se srdíčky fotek
// nebo bez, méně než 5, 5–6 a aspoň 7 skupin údajů) a odhad se ukáže jen ve skupině, kde na ověření má chybu nejvýš
// podilZlepseni chyby prostého průměru a přesnost (zaokrouhlený odhad do ± půl srdíčka) aspoň minPresnostVkus
// (skupina s málo hodnocenými se posuzuje spolu s chudšími skupinami téhož druhu); vždy jen od minHodnocenychVkus
// hodnocených a u modelky s aspoň minPokrytiVkus skupinami údajů. Důvod jsou nejsilnější příspěvky údajů ve směru
// odhadu (u regrese wⱼ·(xⱼ − x̄ⱼ), u stromů rozdíly hodnot uzlů po cestě stromem) a nejpodobnější hodnocené
// modelky (nejvíc společných listů stromů).

// Číselné údaje modelu vkusu
const (
	cvVyska = iota
	cvVaha
	cvHrudnik
	cvPas
	cvBoky
	cvBmi
	cvPomer   // pas/boky
	cvHrudPas // hrudník/pas (postava „přesýpací hodiny“)
	cvVek     // věk při prvním vydání (z data narození)
	cvRok     // rok prvního výskytu
	cvFotky   // průměr srdíček jejích fotek (aspoň 2 hodnocené)
	cvSkore   // skóre fotek (oblibenost_fotky.go)
	cvObsah   // obsah fotek: průměr odhadu srdíček z obsahu jejích fotek (obsah_fotek.go, obrazové modely)
	pocetCisVkusu
)

var popisCisVkusu = [pocetCisVkusu]struct {
	nazev, jednotka string
	desetiny        int
}{
	{"výška", "cm", 0}, {"váha", "kg", 0}, {"hrudník", "cm", 0}, {"pas", "cm", 0}, {"boky", "cm", 0}, {"BMI", "", 1},
	{"poměr pas/boky", "", 2}, {"poměr hrudník/pas", "", 2}, {"věk", "let", 0}, {"rok", "", 0}, {"srdíčka jejích fotek", "", 1},
	{"skóre fotek", "", 1}, {"obsah fotek", "", 1},
}

// Které údaje o fotkách model bere
const (
	fotkyPrumer = iota // průměr srdíček jejích fotek
	fotkySkore         // skóre fotek
	fotkyObe
)

// Nastavení modelu (výchozí pro program; vyhodnocení v testech porovnává varianty)
type nastaveniVkusu struct {
	hreben, stromy bool         // které modely (aspoň jeden)
	kose           bool         // regrese: číselné údaje i po pětinách
	fotky          int          // fotkyPrumer, fotkySkore, fotkyObe
	vahaStromu     float64      // pevná váha stromů v průměru; < 0 = vybere ověření
	jenTrenink     map[int]bool // modelky jen do učení (síla z porovnání místo srdíček): neověřují se, nejsou mezi podobnými
	poSkupinach    bool         // odhad jen ve skupinách podle bohatosti údajů, kde na ověření jasně překoná průměr
}

var nastaveniVkusuVychozi = nastaveniVkusu{hreben: true, stromy: true, kose: true, fotky: fotkyObe, vahaStromu: -1, poSkupinach: true}

// Skupina modelky podle bohatosti údajů: se srdíčky fotek nebo bez (3 + …), méně než 5, 5–6 a aspoň 7 skupin údajů
const pocetKosuBohatosti = 6

func kosBohatosti(u udajeVkusu) int {
	k := 0
	if u.ma[cvFotky] || u.ma[cvSkore] {
		k = 3
	}
	switch {
	case u.skupin >= 7:
		k += 2
	case u.skupin >= 5:
		k++
	}
	return k
}

// Váhy stromů v průměru s regresí, ze kterých vybírá ověření
var vahyStromuVkusu = []float64{0, 0.25, 0.5, 0.75, 1}

// Druhy sloupců
const (
	slHodnota = iota // hodnota údaje 0/1 („vlasy=blond“)
	slCislo          // číselný údaj (regrese standardizovaně, stromy po koších)
	slKos            // regrese: číselný údaj v rozmezí [od, do)
)

type sloupecVkusu struct {
	klic   string // klíč hodnoty („vlasy=blond“) nebo „#3“ u číselného údaje
	popis  string // zápis do důvodu
	druh   int
	c      int     // číselný údaj (slCislo, slKos)
	od, do float64 // slKos
}

type udajeVkusu struct {
	kat    []string // klíče hodnot „vlasy=blond“
	zapisy []string // zápis hodnoty k důvodu (stejné pořadí)
	cis    [pocetCisVkusu]float64
	ma     [pocetCisVkusu]bool
	skupin int // počet skupin údajů, které modelka má
}

type prvekVkusu struct {
	j int
	x float64
}

type modelVkusu struct {
	sloupce  []sloupecVkusu // hodnoty údajů (napřed), pak číselné
	hodnot   int            // počet sloupců hodnot údajů
	index    map[string]int // klíč hodnoty → sloupec
	stredCis [pocetCisVkusu]float64
	sdCis    [pocetCisVkusu]float64
	hranice  [pocetCisVkusu][]float64 // koše stromů
	stromove []int                    // sloupce, ze kterých jsou příznaky stromů (hodnoty a číselné údaje)

	w, stred    []float64 // regrese: váhy a průměry sloupců
	les         *lesVkusu
	pocetStromu int
	vahaStromu  float64
	prumer      float64 // průměr cíle hodnocených
	lambda      float64
	n           int

	chybaCV, chybaZaklad, presnost float64
	prahVysokych                   float64 // medián srdíček hodnocených: od něj je odhad „vysoký“
	vysokych, trefVysokych         int     // vysoké odhady na ověření a kolik z nich mělo srdíčka aspoň prahVysokych
	presnostVysokych               float64
	platny                         bool
	odhady                         map[int]float64 // odhad u modelek s dost údaji (jen platný model)
	surove                         map[int]float64 // odhad u všech modelek bez ohledu na ověření a pokrytí (vyhodnocení)
	udaje                          map[int]udajeVkusu
	hodnocene                      []hodnocenaVkusu            // hodnocené modelky s listy stromů (důvod „podobně jako“)
	ukazatKos                      [pocetKosuBohatosti]bool    // skupiny podle bohatosti údajů, ve kterých se odhad ukazuje
	chybaKose                      [pocetKosuBohatosti]float64 // chyba ověření ve skupině (nejistota tipu)
}

// Hodnocená modelka pro důvod „podobně jako“: listy, do kterých padne v jednotlivých stromech
type hodnocenaVkusu struct {
	id      int
	jmeno   string
	srdicka float64
	listy   []uint8
}

// Košíček z velikosti prsou („34C“, „C“, „34 DD“)
var vzorKosicku = regexp.MustCompile(`^\s*\d*\s*([A-H]{1,4})\s*$`)

// Rok na konci kategorie („Playmate roku 1998“)
var vzorRokuKategorie = regexp.MustCompile(`\s+(19|20)\d{2}\s*$`)

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
		u.cis[cvRok], u.ma[cvRok] = float64(rok), true
		skupiny++
	}
	kategorie := strings.Split(m.Role, ",")
	// Playmate měsíce jen z centerfoldu Playboye; tituly jiných časopisů jako vlastní kategorie (0.02.022)
	if hledani.CenterfoldPlayboye(&m) || m.PlaymateMesice {
		kategorie = append(kategorie, "Playmate měsíce")
	}
	for _, t := range m.TitulyJinde {
		kategorie = append(kategorie, t.Nazev)
	}
	if m.PlaymateRoku != "" && !maPlaymateRoku(m.Role) {
		kategorie = append(kategorie, "Playmate roku")
	}
	if m.CyberGirl != "" {
		kategorie = append(kategorie, "Cyber Girl "+m.CyberGirl)
	}
	if obalkaPlayboye(m.Obalky) {
		kategorie = append(kategorie, "Modelka obálky")
	}
	maKategorii := false
	for _, k := range kategorie {
		// „Playmate roku 1998“ je táž kategorie jako „Playmate roku 2003“
		if k = strings.TrimSpace(vzorRokuKategorie.ReplaceAllString(k, "")); k != "" {
			pridat("kategorie", klic("kategorie", k), k)
			maKategorii = true
		}
	}
	if maKategorii {
		skupiny++
	}
	maFotografa := false
	for _, f := range strings.Split(m.FotografoveAlb, "\n") {
		if f = strings.TrimSpace(f); f != "" {
			pridat("fotograf", klic("fotograf", f), f)
			maFotografa = true
		}
	}
	if maFotografa {
		skupiny++
	}
	postava := priznakyModelky(m)
	for _, p := range [6][2]int{{prVyska, cvVyska}, {prVaha, cvVaha}, {prHrudnik, cvHrudnik}, {prPas, cvPas}, {prBoky, cvBoky}, {prBmi, cvBmi}} {
		u.cis[p[1]], u.ma[p[1]] = postava.X[p[0]], postava.Ma[p[0]]
	}
	if postava.Ma[prPas] && postava.Ma[prBoky] {
		u.cis[cvPomer], u.ma[cvPomer] = postava.X[prPas]/postava.X[prBoky], true
	}
	if postava.Ma[prHrudnik] && postava.Ma[prPas] {
		u.cis[cvHrudPas], u.ma[cvHrudPas] = postava.X[prHrudnik]/postava.X[prPas], true
	}
	// Věk při prvním vydání (stejný výpočet jako v Údržbě): jen věrohodný (14–60 let)
	if postava.Ma[prVek] && postava.X[prVek] >= 14 && postava.X[prVek] <= 60 {
		u.cis[cvVek], u.ma[cvVek] = postava.X[prVek], true
	}
	if postava.Ma[prVyska] || postava.Ma[prVaha] || postava.Ma[prHrudnik] {
		skupiny++
	}
	if m.FotekHodnocenych >= 2 {
		u.cis[cvFotky], u.ma[cvFotky] = float64(m.SrdciFotek)/float64(m.FotekHodnocenych), true
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
	return oblibenost.TextDesetileti(desetileti)
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

// Nejméně hodnocených modelek s obsahem fotek, ze kterých se převádí obsah fotek na srdíčka modelky
const minModelekObsahu = 30

// Úroveň nehodnocených modelek bez odhadu vkusu podle obsahu fotek: obsah (odhad srdíček fotek, jiná stupnice)
// se převede na srdíčka modelky přímkou naučenou na hodnocených modelkách (nejmenší čtverce), oříznuto na ½–5
func urovenZObsahu(modelky []Modelka, obsah map[int]float64, model *modelOblibenosti) map[int]float64 {
	var sx, sy, sxx, sxy, n float64
	for _, m := range modelky {
		if x, ok := obsah[m.ID]; ok && m.Hodnoceni > 0 {
			sx += x
			sy += m.Hodnoceni
			sxx += x * x
			sxy += x * m.Hodnoceni
			n++
		}
	}
	if n < minModelekObsahu {
		return nil
	}
	rozptyl := sxx - sx*sx/n
	if rozptyl <= 0 {
		return nil
	}
	b := (sxy - sx*sy/n) / rozptyl
	if b <= 0 {
		return nil // obsah se srdíčky nesouvisí: úroveň by nic neříkala
	}
	a0 := (sy - b*sx) / n
	v := map[int]float64{}
	for _, m := range modelky {
		x, ok := obsah[m.ID]
		if !ok || m.Hodnoceni > 0 {
			continue
		}
		if _, maOdhad := model.odhad[m.ID]; maOdhad {
			continue
		}
		v[m.ID] = math.Min(5, math.Max(0.5, a0+b*x))
	}
	return v
}

// Má modelka obálku Playboye? Věta vkusu „byla na obálce Playboye“ (0.02.022); obálky jiných časopisů jsou časopis
// jako vlastnost vkusu (0.02.042 Vkus, odhady a Statistiky napříč časopisy)
func obalkaPlayboye(obalky []string) bool {
	for _, v := range obalky {
		if _, c := hledani.RozdelitCasopis(v); c == "" || c == hledani.VychoziCasopis {
			return true
		}
	}
	return false
}
