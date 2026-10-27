package main

import (
	"fmt"
	"maps"
	"math"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Model vkusu: odhad hodnocení nehodnocených modelek z jejich údajů (celkový popis v docs/UCENI.md, oddíl Model
// vkusu). Pořadí oblíbenosti, Bradley–Terry a výběr dvojic jsou v oblibenost.go, skóre fotek v oblibenost_fotky.go.

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
		odhad, duvod := zaokrouhlitNaPul(k.presny), v.textOdhadu(k.m.ID, k.presny, true, true)
		if v.vysokych >= 5 {
			duvod += fmt.Sprintf(" (na ověření sedělo %d z %d podobně vysokých odhadů)", v.trefVysokych, v.vysokych)
		}
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
func (model *modelOblibenosti) naucitModelVkusu(modelky []Modelka, porovnani []porovnaniZaznam, stredSrdicka, sigmaSrdicka map[int]float64, nyni time.Time) {
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
	udaje := pripravitUdajeVkusu(ucebni)
	doplnitSkoreVkusu(udaje, model.skore)
	model.vkus = naucitVkus(ucebni, cil, udaje, nast)
	model.vkusZeSkore = len(model.skore) > 0 && nastaveniVkusuVychozi.fotky != fotkyPrumer
	if v := model.vkus; v != nil && v.platny {
		maps.Copy(model.odhad, v.odhady)
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
	pocetCisVkusu
)

var popisCisVkusu = [pocetCisVkusu]struct {
	nazev, jednotka string
	desetiny        int
}{
	{"výška", "cm", 0}, {"váha", "kg", 0}, {"hrudník", "cm", 0}, {"pas", "cm", 0}, {"boky", "cm", 0}, {"BMI", "", 1},
	{"poměr pas/boky", "", 2}, {"poměr hrudník/pas", "", 2}, {"věk", "let", 0}, {"rok", "", 0}, {"srdíčka jejích fotek", "", 1},
	{"skóre fotek", "", 1},
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
	if postava.ma[prPas] && postava.ma[prBoky] {
		u.cis[cvPomer], u.ma[cvPomer] = postava.x[prPas]/postava.x[prBoky], true
	}
	if postava.ma[prHrudnik] && postava.ma[prPas] {
		u.cis[cvHrudPas], u.ma[cvHrudPas] = postava.x[prHrudnik]/postava.x[prPas], true
	}
	// Věk při prvním vydání (stejný výpočet jako v Údržbě): jen věrohodný (14–60 let)
	if postava.ma[prVek] && postava.x[prVek] >= 14 && postava.x[prVek] <= 60 {
		u.cis[cvVek], u.ma[cvVek] = postava.x[prVek], true
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

// Standardizovaný číselný údaj pro regresi (robustně, oříznutý na ±3)
func (v *modelVkusu) z(c int, x float64) float64 {
	return min(max((x-v.stredCis[c])/v.sdCis[c], -3), 3)
}

// Řídký řádek regrese
func (v *modelVkusu) radekHrebene(u udajeVkusu) []prvekVkusu {
	r := make([]prvekVkusu, 0, len(u.kat)+12)
	for _, k := range u.kat {
		if j, ok := v.index[k]; ok {
			r = append(r, prvekVkusu{j, 1})
		}
	}
	for j := v.hodnot; j < len(v.sloupce); j++ {
		s := &v.sloupce[j]
		ma, x := u.ma[s.c], u.cis[s.c]
		switch {
		case s.druh == slCislo && ma:
			r = append(r, prvekVkusu{j, v.z(s.c, x)})
		case s.druh == slKos && ma && x >= s.od && x < s.do:
			r = append(r, prvekVkusu{j, 1})
		}
	}
	return r
}

// Koše příznaků stromů (hodnota údaje: 1 nemá, 2 má; číselný: 0 chybí, 1… podle hranic)
func (v *modelVkusu) kosyStromu(u udajeVkusu) []uint8 {
	k := make([]uint8, len(v.stromove))
	for p, j := range v.stromove {
		s := &v.sloupce[j]
		switch {
		case s.druh == slHodnota:
			k[p] = 1
		case u.ma[s.c]:
			k[p] = kosHodnoty(v.hranice[s.c], u.cis[s.c])
		}
	}
	for _, kl := range u.kat {
		if j, ok := v.index[kl]; ok {
			k[j] = 2 // hodnoty údajů jsou první sloupce i první příznaky stromů
		}
	}
	return k
}

// Odhad regrese z řádku
func predikceHrebene(r []prvekVkusu, w, stred []float64, prumer float64) float64 {
	y := prumer
	for j := range stred {
		y -= w[j] * stred[j]
	}
	for _, a := range r {
		y += w[a.j] * a.x
	}
	return y
}

func oriznoutSrdicka(x float64) float64 { return min(max(x, 0.5), 5) }

// Rozmezí pětin číselného údaje z hodnot hodnocených (různé hranice, celé hodnoty u celých čísel)
func patinyUdaje(hodnoty []float64, c int) []float64 {
	s := append([]float64(nil), hodnoty...)
	sort.Float64s(s)
	var hranice []float64
	for k := 1; k < kosuHrebene; k++ {
		h := kvantil(s, float64(k)/kosuHrebene)
		if popisCisVkusu[c].desetiny == 0 {
			h = math.Round(h)
		}
		if h > s[0] && (len(hranice) == 0 || h > hranice[len(hranice)-1]) {
			hranice = append(hranice, h)
		}
	}
	return hranice
}

// Hodnota číselného údaje do důvodu („výška 170 cm“, „BMI 19,5“, „70. léta“)
func textCislaVkusu(c int, x float64) string {
	p := popisCisVkusu[c]
	if c == cvRok {
		return textDesetileti(int(x) / 10 * 10)
	}
	t := cisloCesky(x, p.desetiny)
	if p.desetiny == 0 {
		t = fmt.Sprint(int(math.Round(x)))
	}
	if p.jednotka != "" {
		t += " " + p.jednotka
	}
	return p.nazev + " " + t
}

// Rozmezí koše do důvodu („výška 165–169 cm“, „výška pod 160 cm“)
func textKoseVkusu(c int, od, do float64) string {
	p := popisCisVkusu[c]
	cislo := func(x float64) string { return cisloCesky(x, p.desetiny) }
	jednotka := ""
	if p.jednotka != "" {
		jednotka = " " + p.jednotka
	}
	switch {
	case math.IsInf(od, -1):
		return fmt.Sprintf("%s pod %s%s", p.nazev, cislo(do), jednotka)
	case math.IsInf(do, 1):
		return fmt.Sprintf("%s od %s%s", p.nazev, cislo(od), jednotka)
	case p.desetiny == 0:
		return fmt.Sprintf("%s %s–%s%s", p.nazev, cislo(od), cislo(do-1), jednotka)
	}
	return fmt.Sprintf("%s %s–%s%s", p.nazev, cislo(od), cislo(do), jednotka)
}

// oblibenost: cíl hodnocených modelek (chybí = srdíčka); udaje z pripravitUdajeVkusu (případně se skóre fotek)
func naucitVkus(modelky []Modelka, oblibenost map[int]float64, udaje map[int]udajeVkusu, nast nastaveniVkusu) *modelVkusu {
	v := &modelVkusu{udaje: udaje, odhady: map[int]float64{}, index: map[string]int{}}
	var hodnocene []int // indexy modelek
	podpora := map[string]int{}
	zapisy := map[string]map[string]int{}
	for i, m := range modelky {
		if m.Hodnoceni <= 0 {
			continue
		}
		u := udaje[m.ID]
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
	var klice []string
	for k, n := range podpora {
		if n >= minPodporaVkus && n < v.n {
			klice = append(klice, k)
		}
	}
	sort.Slice(klice, func(i, j int) bool {
		if podpora[klice[i]] != podpora[klice[j]] {
			return podpora[klice[i]] > podpora[klice[j]]
		}
		return klice[i] < klice[j]
	})
	for _, k := range klice[:min(len(klice), maxKategoriiVkus)] {
		// Nejčastější zápis hodnoty (při shodě abecedně první)
		nejlepsi, pocet := "", 0
		for z, n := range zapisy[k] {
			if n > pocet || (n == pocet && z < nejlepsi) {
				nejlepsi, pocet = z, n
			}
		}
		v.index[k] = len(v.sloupce)
		v.stromove = append(v.stromove, len(v.sloupce))
		v.sloupce = append(v.sloupce, sloupecVkusu{klic: k, popis: nejlepsi, druh: slHodnota})
	}
	v.hodnot = len(v.sloupce)
	// Číselné údaje z hodnocených (aspoň 10 hodnot, odvozené poměr hrudník/pas a věk aspoň minPodporaOdvozenych):
	// robustní střed a rozptyl, koše stromů a pětiny
	for c := range pocetCisVkusu {
		if (c == cvFotky && nast.fotky == fotkySkore) || (c == cvSkore && nast.fotky == fotkyPrumer) {
			continue
		}
		var hodnoty []float64
		for _, i := range hodnocene {
			if u := udaje[modelky[i].ID]; u.ma[c] {
				hodnoty = append(hodnoty, u.cis[c])
			}
		}
		if len(hodnoty) < 10 || ((c == cvHrudPas || c == cvVek) && len(hodnoty) < minPodporaOdvozenych) {
			continue
		}
		serazene := append([]float64(nil), hodnoty...)
		sort.Float64s(serazene)
		med := kvantil(serazene, 0.5)
		odchylky := make([]float64, len(serazene))
		prumer, rozptyl := 0.0, 0.0
		for i, x := range serazene {
			odchylky[i] = math.Abs(x - med)
			prumer += x
		}
		prumer /= float64(len(serazene))
		for _, x := range serazene {
			rozptyl += (x - prumer) * (x - prumer)
		}
		sort.Float64s(odchylky)
		sd := 1.4826 * kvantil(odchylky, 0.5)
		if sd < 1e-9 {
			sd = math.Sqrt(rozptyl / float64(len(serazene)))
		}
		if sd < 1e-9 {
			continue
		}
		v.stredCis[c], v.sdCis[c] = med, sd
		v.hranice[c] = hraniceKosu(hodnoty)
		klic := fmt.Sprintf("#%d", c)
		v.stromove = append(v.stromove, len(v.sloupce))
		v.sloupce = append(v.sloupce, sloupecVkusu{klic: klic, popis: popisCisVkusu[c].nazev, druh: slCislo, c: c})
		if nast.kose {
			hranice := append(append([]float64{math.Inf(-1)}, patinyUdaje(hodnoty, c)...), math.Inf(1))
			for k := 1; k < len(hranice); k++ {
				od, do := hranice[k-1], hranice[k]
				n := 0
				for _, x := range hodnoty {
					if x >= od && x < do {
						n++
					}
				}
				if n >= minPodporaVkus && n < len(hodnoty) {
					v.sloupce = append(v.sloupce, sloupecVkusu{klic: klic, popis: textKoseVkusu(c, od, do), druh: slKos, c: c, od: od, do: do})
				}
			}
		}
	}
	p := len(v.sloupce)

	// Řádky hodnocených, cíl a části křížového ověření
	n := len(hodnocene)
	radky := make([][]prvekVkusu, n)
	kosy := make([][]uint8, n)
	cil := make([]float64, n)
	srdicka := make([]float64, n)
	skupina := make([]int, n)
	for r, i := range hodnocene {
		m := modelky[i]
		u := udaje[m.ID]
		if nast.hreben {
			radky[r] = v.radekHrebene(u)
		}
		if nast.stromy {
			kosy[r] = v.kosyStromu(u)
		}
		cil[r] = oblibenost[m.ID]
		if cil[r] == 0 {
			cil[r] = m.Hodnoceni
		}
		srdicka[r] = m.Hodnoceni
		skupina[r] = int(uint32(m.ID)*2654435761>>8) % pocetSkupinCV
	}
	trenink := func(vynech int) []int {
		var t []int
		for r := range n {
			if skupina[r] != vynech {
				t = append(t, r)
			}
		}
		return t
	}
	// Chyba prostého průměru (průměr cíle trénovacích částí)
	zaklad := 0.0
	zakladR := make([]float64, n)
	for s := range pocetSkupinCV {
		t := trenink(s)
		if len(t) == 0 {
			continue
		}
		prumer := 0.0
		for _, r := range t {
			prumer += cil[r]
		}
		prumer /= float64(len(t))
		for r := range n {
			if skupina[r] == s {
				zakladR[r] = oriznoutSrdicka(prumer)
				zaklad += math.Abs(zakladR[r] - srdicka[r])
			}
		}
	}
	mae := func(odhady []float64) float64 {
		chyba := 0.0
		for r, o := range odhady {
			chyba += math.Abs(oriznoutSrdicka(o) - srdicka[r])
		}
		return chyba / float64(n)
	}

	// Regrese: Gramova matice a součty po částech, ověření pro každou λ
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
	var casti []*cast
	// Řešení pro trénovací data bez části vynech (−1 = všechna) pro každou λ: váhy (nil = nevyřešeno), průměry
	// sloupců a průměr cíle. Centrovaná soustava (XᵀX − n·x̄x̄ᵀ + λI)·w = Xᵀy − n·x̄·ȳ se sestaví jednou.
	resit := func(vynech int, lambdy []float64) (w [][]float64, stred []float64, prumer float64) {
		w = make([][]float64, len(lambdy))
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
			return w, nil, 0
		}
		nt := float64(t.n)
		prumer = t.sy / nt
		stred = make([]float64, p)
		for j := range p {
			stred[j] = t.soucet[j] / nt
		}
		b := make([]float64, p)
		for j := range p {
			for l := range p {
				t.gram[j][l] -= nt * stred[j] * stred[l]
			}
			b[j] = t.xy[j] - nt*stred[j]*prumer
		}
		for x, lambda := range lambdy {
			a := make([][]float64, p)
			for j := range p {
				a[j] = append([]float64(nil), t.gram[j]...)
				a[j][j] += lambda
			}
			w[x] = resitCholesky(a, append([]float64(nil), b...))
		}
		return w, stred, prumer
	}
	// Stromy souběžně s regresí: na každé části les s nejvýš maxStromu stromy, odhady ověření po každém stromu
	// (počet stromů s nejmenší chybou vybere ověření), a les ze všech hodnocených (pak se zkrátí)
	var data *dataStromu
	var odhadyStromy []float64
	var prubeh [][]float64 // odhad ověření po t+1 stromech
	var lesVse *lesVkusu
	var cekat sync.WaitGroup
	if nast.stromy {
		data = novaDataStromu(kosy, v.pocetKosu())
		prubeh = make([][]float64, maxStromu)
		for t := range prubeh {
			prubeh[t] = make([]float64, n)
		}
		cekat.Add(1)
		go func() {
			defer cekat.Done()
			kopie := *data
			kopie.hg, kopie.hn, kopie.hg2, kopie.hn2 = nil, nil, nil, nil
			lesVse = naucitLes(&kopie, cil, trenink(-1), maxStromu, 0, nil)
		}()
		for s := range pocetSkupinCV {
			t := trenink(s)
			if len(t) < 5 {
				continue
			}
			cekat.Add(1)
			go func() {
				defer cekat.Done()
				var overit []int
				for r := range n {
					if skupina[r] == s {
						overit = append(overit, r)
					}
				}
				// Vlastní kopie dat (pracovní histogramy); les přestane růst, když se chyba ověření části
				// trpelivostStromu stromů nezlepšila
				kopie := *data
				kopie.hg, kopie.hn, kopie.hg2, kopie.hn2 = nil, nil, nil, nil
				zaklad := 0.0
				for _, r := range t {
					zaklad += cil[r]
				}
				zaklad /= float64(len(t))
				odhad := make([]float64, n)
				nejlepsi, nejlepsiK, posledni := math.Inf(1), 0, 0
				naucitLes(&kopie, cil, t, maxStromu, int64(s+1), func(k int, strom stromVkusu) bool {
					chyba := 0.0
					for _, r := range overit {
						odhad[r] += strom[strom.list(data.kosy[r])].hodnota
						prubeh[k][r] = zaklad + odhad[r]
						chyba += math.Abs(oriznoutSrdicka(prubeh[k][r]) - srdicka[r])
					}
					if chyba < nejlepsi {
						nejlepsi, nejlepsiK = chyba, k
					}
					posledni = k
					return k-nejlepsiK < trpelivostStromu
				})
				for k := posledni + 1; k < maxStromu; k++ {
					for _, r := range overit {
						prubeh[k][r] = prubeh[posledni][r]
					}
				}
			}()
		}
	}

	var odhadyHreben []float64
	if nast.hreben {
		casti = make([]*cast, pocetSkupinCV)
		for i := range casti {
			casti[i] = novaCast()
		}
		for r := range n {
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
		// Části souběžně, pro každou λ odhady ověření
		odhadyL := make([][]float64, len(lambdyVkusu))
		for x := range odhadyL {
			odhadyL[x] = make([]float64, n)
		}
		vyreseno := make([]bool, pocetSkupinCV*len(lambdyVkusu))
		var cekatHreben sync.WaitGroup
		for s := range pocetSkupinCV {
			cekatHreben.Add(1)
			go func() {
				defer cekatHreben.Done()
				w, stred, prumer := resit(s, lambdyVkusu)
				for x := range lambdyVkusu {
					if w[x] == nil {
						continue
					}
					vyreseno[s*len(lambdyVkusu)+x] = true
					for r := range n {
						if skupina[r] == s {
							odhadyL[x][r] = predikceHrebene(radky[r], w[x], stred, prumer)
						}
					}
				}
			}()
		}
		cekatHreben.Wait()
		nejlepsi := math.Inf(1)
		for x, lambda := range lambdyVkusu {
			ok := true
			for s := range pocetSkupinCV {
				ok = ok && vyreseno[s*len(lambdyVkusu)+x]
			}
			if chyba := mae(odhadyL[x]); ok && chyba < nejlepsi {
				nejlepsi, v.lambda, odhadyHreben = chyba, lambda, odhadyL[x]
			}
		}
	}
	if nast.stromy {
		cekat.Wait()
		nejlepsi := math.Inf(1)
		for k := range prubeh {
			if chyba := mae(prubeh[k]); chyba < nejlepsi-1e-9 {
				nejlepsi, v.pocetStromu, odhadyStromy = chyba, k+1, prubeh[k]
			}
		}
	}

	// Váha stromů v průměru
	var odhadyCV []float64
	switch {
	case odhadyHreben != nil && odhadyStromy != nil:
		vahy := vahyStromuVkusu
		if nast.vahaStromu >= 0 {
			vahy = []float64{nast.vahaStromu}
		}
		nejlepsi := math.Inf(1)
		for _, a := range vahy {
			odhady := make([]float64, n)
			for r := range n {
				odhady[r] = (1-a)*odhadyHreben[r] + a*odhadyStromy[r]
			}
			if chyba := mae(odhady); chyba < nejlepsi-1e-9 {
				nejlepsi, v.vahaStromu, odhadyCV = chyba, a, odhady
			}
		}
	case odhadyHreben != nil:
		odhadyCV = odhadyHreben
	case odhadyStromy != nil:
		odhadyCV, v.vahaStromu = odhadyStromy, 1
	default:
		return v
	}
	serazena := append([]float64(nil), srdicka...)
	sort.Float64s(serazena)
	v.prahVysokych = max(2.5, zaokrouhlitNaPul(kvantil(serazena, 0.5)))
	// Ověření na modelkách ze skupin podle bohatosti údajů: chyba, chyba průměru, přesnost a vysoké odhady
	type souhrnOvereni struct {
		n                       int
		chyba, zaklad, presnost float64
		vysokych, trefVysokych  int
	}
	overit := func(kose ...int) souhrnOvereni {
		var o souhrnOvereni
		for r, i := range hodnocene {
			if nast.jenTrenink[modelky[i].ID] || (kose != nil && !slices.Contains(kose, kosBohatosti(udaje[modelky[i].ID]))) {
				continue
			}
			o.n++
			o.chyba += math.Abs(oriznoutSrdicka(odhadyCV[r]) - srdicka[r])
			o.zaklad += math.Abs(zakladR[r] - srdicka[r])
			if math.Abs(oriznoutSrdicka(zaokrouhlitNaPul(odhadyCV[r]))-srdicka[r]) <= 0.5 {
				o.presnost++
			}
			if zaokrouhlitNaPul(odhadyCV[r]) >= v.prahVysokych {
				o.vysokych++
				if srdicka[r] >= v.prahVysokych {
					o.trefVysokych++
				}
			}
		}
		if o.n > 0 {
			o.chyba, o.zaklad, o.presnost = o.chyba/float64(o.n), o.zaklad/float64(o.n), o.presnost/float64(o.n)
		}
		return o
	}
	prosel := func(o souhrnOvereni) bool {
		return o.n >= minOverenychVkus && o.chyba <= podilZlepseni*o.zaklad && o.presnost >= minPresnostVkus
	}
	o := overit()
	// Vysoké odhady (pro „Mohlo by se ti líbit“) ze všech hodnocených
	v.vysokych, v.trefVysokych = o.vysokych, o.trefVysokych
	if v.vysokych > 0 {
		v.presnostVysokych = float64(v.trefVysokych) / float64(v.vysokych)
	}
	nalezen := prosel(o)
	if nast.poSkupinach {
		// Skupina se ukazuje, když v ní (s málo modelkami spolu s chudšími skupinami téhož druhu, pak s celým
		// druhem) odhady na ověření jasně překonají průměr. Souhrn ověření je ze všech ukázaných skupin.
		var ukazane []int
		for k := range pocetKosuBohatosti {
			fotky, uroven := k/3, k%3
			druh := []int{fotky * 3, fotky*3 + 1, fotky*3 + 2}
			for _, kose := range [][]int{{k}, druh[:uroven+1], druh} {
				if ok := overit(kose...); ok.n >= minOverenychVkus {
					v.chybaKose[k] = ok.chyba
					if prosel(ok) {
						v.ukazatKos[k] = true
						ukazane = append(ukazane, k)
					}
					break
				}
			}
		}
		nalezen = len(ukazane) > 0
		if nalezen {
			o = overit(ukazane...)
		}
	}
	v.chybaCV, v.chybaZaklad, v.presnost = o.chyba, o.zaklad, o.presnost
	v.platny = v.n >= minHodnocenychVkus && nalezen

	// Modely ze všech hodnocených
	for r := range n {
		v.prumer += cil[r]
	}
	v.prumer /= float64(n)
	if v.vahaStromu < 1 {
		w, stred, _ := resit(-1, []float64{v.lambda})
		if w[0] == nil {
			v.platny = false
			return v
		}
		v.w, v.stred = w[0], stred
	}
	if nast.stromy {
		// Les zůstane i s váhou 0: podle společných listů hledá podobné hodnocené modelky do důvodu
		v.les = &lesVkusu{zaklad: lesVse.zaklad, stromy: lesVse.stromy[:min(v.pocetStromu, len(lesVse.stromy))]}
		v.hodnocene = make([]hodnocenaVkusu, 0, n)
		for r, i := range hodnocene {
			if !nast.jenTrenink[modelky[i].ID] {
				v.hodnocene = append(v.hodnocene, hodnocenaVkusu{id: modelky[i].ID, jmeno: modelky[i].Jmeno, srdicka: srdicka[r], listy: v.les.listy(kosy[r])})
			}
		}
	}
	v.surove = make(map[int]float64, len(modelky))
	for _, m := range modelky {
		u := udaje[m.ID]
		odhad := oriznoutSrdicka(v.predikce(u))
		v.surove[m.ID] = odhad
		if v.platny && u.skupin >= minPokrytiVkus && (!nast.poSkupinach || v.ukazatKos[kosBohatosti(u)]) {
			v.odhady[m.ID] = odhad
		}
	}
	return v
}

// Počty košů příznaků stromů
func (v *modelVkusu) pocetKosu() []int {
	pocty := make([]int, len(v.stromove))
	for p, j := range v.stromove {
		if s := v.sloupce[j]; s.druh == slHodnota {
			pocty[p] = 3
		} else {
			pocty[p] = 2 + len(v.hranice[s.c])
		}
	}
	return pocty
}

// Neoříznutý odhad hotového modelu
func (v *modelVkusu) predikce(u udajeVkusu) float64 {
	y := 0.0
	if v.vahaStromu < 1 {
		y += (1 - v.vahaStromu) * predikceHrebene(v.radekHrebene(u), v.w, v.stred, v.prumer)
	}
	if v.vahaStromu > 0 {
		y += v.vahaStromu * v.les.predikce(v.kosyStromu(u), v.pocetStromu)
	}
	return y
}

type prispevekVkusu struct {
	klic string
	c    float64
}

// Příspěvky údajů modelky k odhadu podle skupiny („vlasy=blond“, „#0“ výška, „era=1970“ i z roku, „#fotky“);
// jen údaje, které modelka má. Součet příspěvků všech sloupců (i chybějících údajů) a základu je odhad.
func (v *modelVkusu) prispevkyOdhadu(u udajeVkusu) []prispevekVkusu {
	poSloupcich := make([]float64, len(v.sloupce))
	ma := make([]bool, len(v.sloupce))
	for _, k := range u.kat {
		if j, ok := v.index[k]; ok {
			ma[j] = true
		}
	}
	for j := v.hodnot; j < len(v.sloupce); j++ {
		ma[j] = u.ma[v.sloupce[j].c]
	}
	if v.vahaStromu < 1 {
		x := make([]float64, len(v.sloupce))
		for _, a := range v.radekHrebene(u) {
			x[a.j] = a.x
		}
		for j := range v.sloupce {
			if ma[j] {
				poSloupcich[j] += (1 - v.vahaStromu) * v.w[j] * (x[j] - v.stred[j])
			}
		}
	}
	if v.vahaStromu > 0 {
		v.les.prispevky(v.kosyStromu(u), func(p int, c float64) {
			poSloupcich[v.stromove[p]] += v.vahaStromu * c
		})
	}
	var prispevky []prispevekVkusu
	for j, c := range poSloupcich {
		if !ma[j] || c == 0 {
			continue
		}
		s := &v.sloupce[j]
		klic := s.klic
		switch {
		case s.druh != slHodnota && s.c == cvRok:
			klic = "era=" + strconv.Itoa(int(u.cis[s.c])/10*10)
		case s.druh != slHodnota && (s.c == cvFotky || s.c == cvSkore):
			klic = "#fotky" // průměr srdíček fotek a skóre fotek jsou v důvodu jeden údaj
		}
		nalezen := false
		for x := range prispevky {
			if prispevky[x].klic == klic {
				prispevky[x].c += c
				nalezen = true
				break
			}
		}
		if !nalezen {
			prispevky = append(prispevky, prispevekVkusu{klic, c})
		}
	}
	return prispevky
}

// Zápis skupiny údajů modelky do důvodu
func (v *modelVkusu) popisPrispevku(u udajeVkusu, klic string) string {
	if j, ok := v.index[klic]; ok {
		return v.sloupce[j].popis
	}
	if desetileti, err := strconv.Atoi(strings.TrimPrefix(klic, "era=")); err == nil && strings.HasPrefix(klic, "era=") {
		return textDesetileti(desetileti)
	}
	if klic == "#fotky" {
		if u.ma[cvFotky] {
			return textCislaVkusu(cvFotky, u.cis[cvFotky])
		}
		return textCislaVkusu(cvSkore, u.cis[cvSkore])
	}
	if c, err := strconv.Atoi(strings.TrimPrefix(klic, "#")); err == nil && c >= 0 && c < pocetCisVkusu {
		return textCislaVkusu(c, u.cis[c])
	}
	return klic
}

// Nejsilnější tři příspěvky údajů ve směru odchylky odhadu od průměru jako text
func (v *modelVkusu) duvodOdhadu(id int, odhad float64) string {
	u := v.udaje[id]
	prispevky := v.prispevkyOdhadu(u)
	smer := 1.0
	if odhad < v.prumer {
		smer = -1
	}
	sort.Slice(prispevky, func(i, j int) bool {
		if prispevky[i].c*smer != prispevky[j].c*smer {
			return prispevky[i].c*smer > prispevky[j].c*smer
		}
		return prispevky[i].klic < prispevky[j].klic
	})
	var casti []string
	for _, p := range prispevky {
		if p.c*smer < 0.05 || len(casti) == 3 {
			break
		}
		casti = append(casti, v.popisPrispevku(u, p.klic))
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
	return zaokrouhlitNaPul(odhad), m.vkus.textOdhadu(x.ID, odhad, sDuvodem, false), true
}

// „Odhad 4 srdíčka: blond, 70. léta, Pompeo Posar“, s podobnými navíc „; podobně jako Anna (4½) a Bára (4)“
// (hledání podobných projde všechny hodnocené, proto jen u tipů a u důvodu jedné modelky)
func (v *modelVkusu) textOdhadu(id int, odhad float64, sDuvodem, sPodobnymi bool) string {
	text := "Odhad " + textSrdicek(zaokrouhlitNaPul(odhad))
	if !sDuvodem {
		return text
	}
	if d := v.duvodOdhadu(id, odhad); d != "" {
		text += ": " + d
	}
	if !sPodobnymi {
		return text
	}
	if p := v.podobne(id, pocetPodobnychVkus); len(p) > 0 {
		jmena := make([]string, len(p))
		for i, h := range p {
			jmena[i] = fmt.Sprintf("%s (%s)", h.jmeno, kratceSrdicka(h.srdicka))
		}
		text += "; podobně jako " + strings.Join(jmena, " a ")
	}
	return text
}

// Nejpodobnější hodnocené modelky podle stromů: ve kolika stromech padne do stejného listu (nejvýš pocet,
// aspoň v polovině stromů)
func (v *modelVkusu) podobne(id int, pocet int) []hodnocenaVkusu {
	if v.les == nil || len(v.les.stromy) == 0 || len(v.hodnocene) == 0 {
		return nil
	}
	listy := v.les.listy(v.kosyStromu(v.udaje[id]))
	type kandidatka struct{ r, shod int }
	var nejlepsi []kandidatka
	for r, h := range v.hodnocene {
		if h.id == id {
			continue
		}
		shod := 0
		for t, l := range h.listy {
			if l == listy[t] {
				shod++
			}
		}
		if 2*shod < len(listy) {
			continue
		}
		nejlepsi = append(nejlepsi, kandidatka{r, shod})
		sort.SliceStable(nejlepsi, func(i, j int) bool { return nejlepsi[i].shod > nejlepsi[j].shod })
		nejlepsi = nejlepsi[:min(len(nejlepsi), pocet)]
	}
	vysledek := make([]hodnocenaVkusu, len(nejlepsi))
	for i, k := range nejlepsi {
		vysledek[i] = v.hodnocene[k.r]
	}
	return vysledek
}

// „4½“, „4“, „½“
func kratceSrdicka(h float64) string {
	cela := int(h)
	pul := h-float64(cela) >= 0.5
	switch {
	case pul && cela == 0:
		return "½"
	case pul:
		return fmt.Sprintf("%d½", cela)
	}
	return fmt.Sprint(cela)
}
