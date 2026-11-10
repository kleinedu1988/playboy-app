package main

// Doplnění údajů modelky ze zdrojů na internetu, jen na vyžádání (tlačítko v profilu) a s potvrzením každého údaje:
// Wikidata (CC0, strukturovaná data), Wikipedie (infobox Playmate měsíce v seznamu „List of Playboy Playmates of
// RRRR“) a Boobpedia (infobox Biobox: míry, prsa, váha, ochlupení). Hodnoty se převedou do podoby sbírky (česky,
// cm, kg, evropská velikost prsou) a předloží vedle stávajících; zapíše se jen to, co uživatel zaškrtne, a k
// odkazům modelky přibude použitý zdroj. Dotazy na jeden server nejvýš jednou za sekundu, odpovědi v mezipaměti.

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"pinup-katalog/internal/hledani"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	adresaWikidat    = "https://www.wikidata.org/w/api.php"
	adresaWikipedie  = "https://en.wikipedia.org/w/api.php"
	adresaBoobpedie  = "https://www.boobpedia.com/wiki/api.php"
	webWikidat       = "https://www.wikidata.org/wiki/"
	webWikipedie     = "https://en.wikipedia.org/wiki/"
	webBoobpedie     = "https://www.boobpedia.com/boobs/"
	klientZdroju     = &http.Client{Timeout: 15 * time.Second}
	odstupDotazu     = time.Second
	uaZdroju         = "PlayboyApp/1.38 (personal collection catalogue; on-demand lookups)"
	zdrojeMezipamet  = map[string][]byte{}
	zdrojeCasy       = map[string]time.Time{}
	zdrojeZamek      sync.Mutex
	zdrojePosledni   = map[string]time.Time{}
	zdrojePosledniZa sync.Mutex
)

const (
	zdrojWikidata    = "wikidata"
	zdrojWikipedie   = "wikipedie"
	zdrojBoobpedia   = "boobpedia"
	platnostOdpovedi = time.Hour
)

// GET s parametry, odstupem mezi dotazy na stejný server a mezipamětí; JSON odpovědi do cil
func ziskatZdroj(adresa string, parametry url.Values, cil any) error {
	celaAdresa := adresa + "?" + parametry.Encode()
	zdrojeZamek.Lock()
	data, mame := zdrojeMezipamet[celaAdresa]
	if mame && time.Since(zdrojeCasy[celaAdresa]) > platnostOdpovedi {
		mame = false
	}
	zdrojeZamek.Unlock()
	if !mame {
		u, err := url.Parse(adresa)
		if err != nil {
			return err
		}
		zdrojePosledniZa.Lock()
		if cekat := odstupDotazu - time.Since(zdrojePosledni[u.Host]); cekat > 0 {
			time.Sleep(cekat)
		}
		zdrojePosledni[u.Host] = time.Now()
		zdrojePosledniZa.Unlock()
		pozadavek, err := http.NewRequest(http.MethodGet, celaAdresa, nil)
		if err != nil {
			return err
		}
		pozadavek.Header.Set("User-Agent", uaZdroju)
		pozadavek.Header.Set("Accept", "application/json")
		odpoved, err := klientZdroju.Do(pozadavek)
		if err != nil {
			return fmt.Errorf("server neodpovídá (%v)", zkratitChybu(err))
		}
		defer odpoved.Body.Close()
		if odpoved.StatusCode != http.StatusOK {
			return fmt.Errorf("server vrátil %d", odpoved.StatusCode)
		}
		data, err = io.ReadAll(io.LimitReader(odpoved.Body, 8<<20))
		if err != nil {
			return err
		}
		zdrojeZamek.Lock()
		zdrojeMezipamet[celaAdresa], zdrojeCasy[celaAdresa] = data, time.Now()
		zdrojeZamek.Unlock()
	}
	return json.Unmarshal(data, cil)
}

func zkratitChybu(err error) string {
	var u *url.Error
	if errors.As(err, &u) {
		return u.Err.Error()
	}
	return err.Error()
}

// ——— Výsledek ———

type NavrhUdaje struct {
	Zdroj   string `json:"zdroj"`
	Hodnota string `json:"hodnota"` // v podobě sbírky (datum RRRR-MM-DD, výška v cm, míry 91-56-86…)
}

type PoleZeZdroju struct {
	Klic      string       `json:"klic"`
	Nazev     string       `json:"nazev"`
	Stavajici string       `json:"stavajici"`
	Navrhy    []NavrhUdaje `json:"navrhy"`
}

type ZdrojUdaju struct {
	Klic     string `json:"klic"`
	Nazev    string `json:"nazev"`
	URL      string `json:"url"`
	Stav     string `json:"stav"` // nalezeno | nenalezeno | jina | chyba
	Poznamka string `json:"poznamka"`
}

type NalezUdaju struct {
	ModelkaID int            `json:"modelkaId"`
	Jmeno     string         `json:"jmeno"`
	Zdroje    []ZdrojUdaju   `json:"zdroje"`
	Pole      []PoleZeZdroju `json:"pole"`
	Souhlasi  []string       `json:"souhlasi"` // názvy údajů, které se zdroji souhlasí
}

// Pole, která zdroje umí doplnit, v pořadí okna
var poleZdroju = []struct{ klic, nazev string }{
	{"narozeniDatum", "Narození"}, {"narozeniMisto", "Místo narození"}, {"umrtiDatum", "Úmrtí"}, {"narodnost", "Národnost"},
	{"etnicita", "Etnicita"}, {"vyskaCm", "Výška (cm)"}, {"vahaKg", "Váha (kg)"}, {"miry", "Míry (cm)"}, {"velikostPrsou", "Velikost prsou"},
	{"prsaTyp", "Prsa"}, {"vlasyBarva", "Vlasy"}, {"ociBarva", "Oči"}, {"ochlupeni", "Ochlupení"},
}

func hodnotaPoleModelky(m *Modelka, klic string) string {
	cislo := func(n int) string {
		if n > 0 {
			return strconv.Itoa(n)
		}
		return ""
	}
	switch klic {
	case "narozeniDatum":
		return m.NarozeniDatum
	case "narozeniMisto":
		return m.NarozeniMisto
	case "umrtiDatum":
		return m.UmrtiDatum
	case "narodnost":
		return m.Narodnost
	case "etnicita":
		return m.Etnicita
	case "vyskaCm":
		return cislo(m.VyskaCm)
	case "vahaKg":
		return cislo(m.VahaKg)
	case "miry":
		if m.ObvodHrudnikCm > 0 || m.ObvodPasCm > 0 || m.ObvodBokyCm > 0 {
			return fmt.Sprintf("%d-%d-%d", m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm)
		}
		return m.Miry
	case "velikostPrsou":
		return m.VelikostPrsou
	case "prsaTyp":
		return m.PrsaTyp
	case "vlasyBarva":
		return m.VlasyBarva
	case "ociBarva":
		return m.OciBarva
	case "ochlupeni":
		return m.Ochlupeni
	}
	return ""
}

// Údaje z jednoho zdroje: klíč pole → hodnota v podobě sbírky
type udajeZdroje map[string]string

func (a *App) modelkaPodleID(id int) (Modelka, bool) {
	for _, m := range a.snimekSbirky().modelky {
		if m.ID == id {
			return m, true
		}
	}
	return Modelka{}, false
}

// Najde údaje modelky ve všech zdrojích (souběžně) a porovná je se stávajícími
func (a *App) NajitUdajeModelky(id int) NalezUdaju {
	m, ok := a.modelkaPodleID(id)
	if !ok {
		return NalezUdaju{Zdroje: []ZdrojUdaju{}, Pole: []PoleZeZdroju{}, Souhlasi: []string{}}
	}
	type vysledek struct {
		zdroj ZdrojUdaju
		udaje udajeZdroje
	}
	hledani := []func(*Modelka) (ZdrojUdaju, udajeZdroje){udajeZWikidat, udajeZWikipedie, udajeZBoobpedie}
	vysledky := make([]vysledek, len(hledani))
	var wg sync.WaitGroup
	for i, f := range hledani {
		wg.Add(1)
		go func(i int, f func(*Modelka) (ZdrojUdaju, udajeZdroje)) {
			defer wg.Done()
			z, u := f(&m)
			vysledky[i] = vysledek{z, u}
		}(i, f)
	}
	wg.Wait()

	n := NalezUdaju{ModelkaID: m.ID, Jmeno: m.Jmeno, Zdroje: []ZdrojUdaju{}, Pole: []PoleZeZdroju{}, Souhlasi: []string{}}
	for _, v := range vysledky {
		n.Zdroje = append(n.Zdroje, v.zdroj)
	}
	for _, p := range poleZdroju {
		stavajici := hodnotaPoleModelky(&m, p.klic)
		pole := PoleZeZdroju{Klic: p.klic, Nazev: p.nazev, Stavajici: stavajici, Navrhy: []NavrhUdaje{}}
		videne := map[string]bool{}
		souhlasi := false
		for _, v := range vysledky {
			h := strings.TrimSpace(v.udaje[p.klic])
			if h == "" {
				continue
			}
			if stejnyUdaj(p.klic, h, stavajici) {
				souhlasi = true
				continue
			}
			if !videne[zjednodusit(h)] {
				videne[zjednodusit(h)] = true
				pole.Navrhy = append(pole.Navrhy, NavrhUdaje{Zdroj: v.zdroj.Klic, Hodnota: h})
			}
		}
		// Méně přesné datum (1969) vedle úplného (1969-10-30) se nenabízí
		if p.klic == "narozeniDatum" || p.klic == "umrtiDatum" {
			var presne []NavrhUdaje
			for _, h := range pole.Navrhy {
				prekryte := false
				for _, jiny := range pole.Navrhy {
					if len(jiny.Hodnota) > len(h.Hodnota) && strings.HasPrefix(jiny.Hodnota, h.Hodnota) {
						prekryte = true
					}
				}
				if !prekryte {
					presne = append(presne, h)
				}
			}
			pole.Navrhy = presne
		}
		if len(pole.Navrhy) > 0 {
			n.Pole = append(n.Pole, pole)
		} else if souhlasi {
			n.Souhlasi = append(n.Souhlasi, p.nazev)
		}
	}
	return n
}

// Shoda údaje se stávajícím: datum může být ve sbírce přesnější i méně přesné (1967 vs. 1967-07-01), výška
// a váha s tolerancí 1, míry po obvodech s tolerancí 1 cm
func stejnyUdaj(klic, novy, stary string) bool {
	if zjednodusit(novy) == zjednodusit(stary) {
		return true
	}
	if stary == "" {
		return false
	}
	switch klic {
	case "narozeniDatum", "umrtiDatum":
		return strings.HasPrefix(stary, novy)
	case "vyskaCm", "vahaKg":
		a, e1 := strconv.Atoi(novy)
		b, e2 := strconv.Atoi(stary)
		return e1 == nil && e2 == nil && absInt(a-b) <= 1
	case "miry":
		a, b := rozlozitTriCisla(novy), rozlozitTriCisla(stary)
		if a == nil || b == nil {
			return false
		}
		for i := range a {
			if absInt(a[i]-b[i]) > 1 {
				return false
			}
		}
		return true
	case "narozeniMisto":
		// Stávající místo s krajem či státem obsahuje navržené město
		return strings.HasPrefix(zjednodusit(stary), zjednodusit(strings.Split(novy, ",")[0]))
	}
	return false
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

var vzorTriCisel = regexp.MustCompile(`^\s*(\d{2,3})\D+(\d{2,3})\D+(\d{2,3})\s*$`)

func rozlozitTriCisla(text string) []int {
	s := vzorTriCisel.FindStringSubmatch(text)
	if s == nil {
		return nil
	}
	var v []int
	for _, x := range s[1:] {
		n, _ := strconv.Atoi(x)
		v = append(v, n)
	}
	return v
}

// Zapíše zaškrtnuté údaje (klíč → hodnota v podobě sbírky) a přidá odkazy na použité zdroje
func (a *App) UlozitUdajeZeZdroju(id int, hodnoty map[string]string, odkazy []string) bool {
	m, ok := a.modelkaPodleID(id)
	if !ok {
		return false
	}
	cislo := func(h string) int {
		n, _ := strconv.Atoi(strings.TrimSpace(h))
		return n
	}
	for klic, h := range hodnoty {
		h = strings.TrimSpace(h)
		switch klic {
		case "narozeniDatum":
			m.NarozeniDatum = h
		case "narozeniMisto":
			m.NarozeniMisto = h
		case "umrtiDatum":
			m.UmrtiDatum = h
		case "narodnost":
			m.Narodnost = h
		case "etnicita":
			m.Etnicita = h
		case "vyskaCm":
			m.VyskaCm = cislo(h)
		case "vahaKg":
			m.VahaKg = cislo(h)
		case "miry":
			if v := rozlozitTriCisla(h); v != nil {
				m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm = v[0], v[1], v[2]
				m.Miry = fmt.Sprintf("%d-%d-%d", v[0], v[1], v[2])
			}
		case "velikostPrsou":
			m.VelikostPrsou = h
		case "prsaTyp":
			m.PrsaTyp = h
		case "vlasyBarva":
			m.VlasyBarva = h
		case "ociBarva":
			m.OciBarva = h
		case "ochlupeni":
			m.Ochlupeni = h
		}
	}
	m.Odkazy = pridatOdkazy(m.Odkazy, odkazy)
	// Titulní fotka se nemění (prázdná ponechá stávající)
	m.CoverID = ""
	return a.UpdateModelka(m)
}

// Odkazy modelky jsou čárkou nebo po řádcích; nový se přidá stejným způsobem, už uvedený (bez kotvy) ne
func pridatOdkazy(stavajici string, nove []string) string {
	oddelovac := ", "
	if strings.Contains(stavajici, "\n") {
		oddelovac = "\n"
	}
	bezKotvy := func(u string) string { return strings.TrimRight(strings.SplitN(strings.TrimSpace(u), "#", 2)[0], "/") }
	mame := map[string]bool{}
	for _, o := range strings.FieldsFunc(stavajici, func(r rune) bool { return r == ',' || r == '\n' }) {
		mame[bezKotvy(o)] = true
	}
	vysledek := strings.TrimSpace(stavajici)
	for _, o := range nove {
		o = strings.TrimSpace(o)
		if o == "" || mame[bezKotvy(o)] {
			continue
		}
		mame[bezKotvy(o)] = true
		if vysledek != "" {
			vysledek += oddelovac
		}
		vysledek += o
	}
	return vysledek
}

// ——— Převody do podoby sbírky ———

var (
	vzorPalceStopy    = regexp.MustCompile(`(?i)ft\s*=\s*(\d+)(?:\s*\|\s*in\s*=\s*(\d+(?:\.\d+)?))?|(\d)\s*(?:ft|feet|foot|')\s*(\d+(?:\.\d+)?)?\s*(?:in|inches|"|″)?`)
	vzorMetry         = regexp.MustCompile(`(?i)(?:^|[^\w])m\s*=\s*(\d(?:\.\d+)?)|(\d\.\d{1,2})\s*m\b`)
	vzorCm            = regexp.MustCompile(`(?i)cm\s*=\s*(\d{3})|(\d{3})\s*cm\b`)
	vzorLibry         = regexp.MustCompile(`(?i)lbs?\s*=\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b`)
	vzorKg            = regexp.MustCompile(`(?i)kg\s*=\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*kg\b`)
	vzorMir           = regexp.MustCompile(`(?i)(\d{2,3})\s*([A-H]{1,3})?\s*[-–/]\s*(\d{2,3})\s*[-–/]\s*(\d{2,3})`)
	vzorKosickuZdroje = regexp.MustCompile(`(?i)(\d{2})?\s*\b([A-H]{1,3})\b`)
)

func prvniCislo(skupiny []string) (float64, bool) {
	for _, s := range skupiny {
		if s != "" {
			x, err := strconv.ParseFloat(s, 64)
			return x, err == nil
		}
	}
	return 0, false
}

// Výška v cm z „5 ft 7 in“, „{{height|ft=5|in=7}}“, „1.70 m“, „170 cm“; 0 = nerozpoznáno
func vyskaVCm(text string) int {
	if s := vzorCm.FindStringSubmatch(text); s != nil {
		if x, ok := prvniCislo(s[1:]); ok && x >= 120 && x <= 215 {
			return int(x)
		}
	}
	if s := vzorMetry.FindStringSubmatch(text); s != nil {
		if x, ok := prvniCislo(s[1:]); ok && x >= 1.2 && x <= 2.15 {
			return int(math.Round(x * 100))
		}
	}
	if s := vzorPalceStopy.FindStringSubmatch(text); s != nil {
		stopy, _ := prvniCislo([]string{s[1], s[3]})
		palce, _ := prvniCislo([]string{s[2], s[4]})
		cm := int(math.Round((stopy*12 + palce) * 2.54))
		if cm >= 120 && cm <= 215 {
			return cm
		}
	}
	return 0
}

// Váha v kg z „115 lb“, „{{weight|lb=105}}“, „52 kg“; 0 = nerozpoznáno
func vahaVKg(text string) int {
	if s := vzorKg.FindStringSubmatch(text); s != nil {
		if x, ok := prvniCislo(s[1:]); ok && x >= 30 && x <= 150 {
			return int(math.Round(x))
		}
	}
	if s := vzorLibry.FindStringSubmatch(text); s != nil {
		if x, ok := prvniCislo(s[1:]); ok && x >= 66 && x <= 330 {
			return int(math.Round(x * 0.45359237))
		}
	}
	return 0
}

// Míry „36DD-22-34“ (palce) nebo „91-56-86“ (cm) → „91-56-86“ a americký košíček z měr (DD), nebo ""
func miryVCm(text string) (miry, kosicek string, prsaPalce int) {
	s := vzorMir.FindStringSubmatch(text)
	if s == nil {
		return "", "", 0
	}
	h, _ := strconv.Atoi(s[1])
	p, _ := strconv.Atoi(s[3])
	b, _ := strconv.Atoi(s[4])
	if h < 60 && p < 60 && b < 60 {
		prsaPalce = h
		h, p, b = int(math.Round(float64(h)*2.54)), int(math.Round(float64(p)*2.54)), int(math.Round(float64(b)*2.54))
	}
	if h < 60 || h > 140 || p < 40 || p > 110 || b < 60 || b > 140 {
		return "", "", 0
	}
	return fmt.Sprintf("%d-%d-%d", h, p, b), strings.ToUpper(s[2]), prsaPalce
}

// Americká velikost → evropská (75C): 32 → 70, 34 → 75, 36 → 80; DD → E, DDD → F. Míry s písmenem („34B-24-35“) jsou
// ve zdrojích zápis podprsenky – číslo je obvod pod prsy (obvodPalce, liché dolů na sudé). Bez něj se obvod odhadne
// z obvodu přes prsa minus palce košíčku (A = 1, B = 2 …).
func velikostPrsouEU(prsaPalce int, kosicek string, obvodPalce int) string {
	kosicek = strings.ToUpper(strings.TrimSpace(kosicek))
	palceKosicku := map[string]int{"AA": 0, "A": 1, "B": 2, "C": 3, "D": 4, "DD": 5, "E": 5, "DDD": 6, "F": 6, "G": 7, "H": 8}
	eu := map[string]string{"DD": "E", "DDD": "F"}
	k, znamy := palceKosicku[kosicek]
	if !znamy {
		return ""
	}
	if obvodPalce == 0 {
		if prsaPalce == 0 {
			return ""
		}
		obvodPalce = int(math.Round(float64(prsaPalce-k)/2)) * 2
	}
	obvodPalce = obvodPalce / 2 * 2
	if obvodPalce < 28 || obvodPalce > 44 {
		return ""
	}
	cil := kosicek
	if e, ok := eu[kosicek]; ok {
		cil = e
	}
	return fmt.Sprintf("%d%s", 70+(obvodPalce-32)/2*5, cil)
}

func prevestTabulkou(text string, tabulka map[string]string) string {
	t := strings.ToLower(strings.TrimSpace(text))
	for _, pripona := range []string{" hair", " eyes", " eye", " colour", " color"} {
		t = strings.TrimSuffix(t, pripona)
	}
	return tabulka[t]
}

var barvyVlasu = map[string]string{
	"blonde": "blond", "blond": "blond", "dirty blonde": "blond", "platinum blonde": "blond", "platinum": "blond", "honey blonde": "blond",
	"strawberry blonde": "ryšavá", "strawberry blond": "ryšavá", "brown": "hnědá", "brunette": "hnědá", "light brown": "světle hnědá",
	"dark brown": "tmavě hnědá", "black": "černá", "red": "zrzavá", "redhead": "zrzavá", "ginger": "zrzavá", "auburn": "kaštanová",
	"chestnut": "kaštanová", "gray": "šedá", "grey": "šedá", "white": "bílá",
}
var barvyOci = map[string]string{
	"blue": "modrá", "brown": "hnědá", "dark brown": "hnědá", "green": "zelená", "hazel": "oříšková", "gray": "šedá", "grey": "šedá",
	"blue-green": "modrozelená", "blue green": "modrozelená", "amber": "jantarová", "black": "černá", "blue-gray": "modrošedá", "blue-grey": "modrošedá",
}
var etnicity = map[string]string{
	"caucasian": "kavkazská", "white": "kavkazská", "black": "černošská", "african american": "černošská", "ebony": "černošská",
	"latin": "latinskoamerická", "latina": "latinskoamerická", "latino": "latinskoamerická", "hispanic": "latinskoamerická",
	"asian": "asijská", "mixed": "míšenka", "multiracial": "míšenka", "biracial": "míšenka", "mixed race": "míšenka",
}
var ochlupeniZdroju = map[string]string{
	"full": "Přírodní", "natural": "Přírodní", "hairy": "Přírodní", "bush": "Přírodní", "trimmed": "Zastřižené", "landing strip": "Zastřižené",
	"partially shaved": "Zastřižené", "brazilian": "Zastřižené", "shaved": "Oholené", "bald": "Oholené", "waxed": "Oholené",
}

// Země v podobě sbírky z anglického názvu, přídavného jména nebo českého štítku Wikidat
var zeme = func() map[string]string {
	z := map[string]string{}
	for _, r := range [][]string{
		{"USA", "united states", "united states of america", "usa", "u.s.", "u.s", "us", "american", "spojené státy americké", "spojené státy"},
		{"Kanada", "canada", "canadian"}, {"Velká Británie", "united kingdom", "uk", "england", "scotland", "wales", "british", "english", "scottish", "welsh", "spojené království", "anglie", "skotsko"},
		{"Německo", "germany", "german", "west germany", "east germany"}, {"Norsko", "norway", "norwegian"}, {"Nizozemsko", "netherlands", "dutch", "holland"},
		{"Švédsko", "sweden", "swedish"}, {"Dánsko", "denmark", "danish"}, {"Finsko", "finland", "finnish"}, {"Island", "iceland", "icelandic"},
		{"Francie", "france", "french"}, {"Itálie", "italy", "italian"}, {"Španělsko", "spain", "spanish"}, {"Portugalsko", "portugal", "portuguese"},
		{"Česko", "czech republic", "czechia", "czech", "czechoslovakia", "czechoslovak", "československo"}, {"Slovensko", "slovakia", "slovak"},
		{"Polsko", "poland", "polish"}, {"Maďarsko", "hungary", "hungarian"}, {"Rakousko", "austria", "austrian"}, {"Švýcarsko", "switzerland", "swiss"},
		{"Belgie", "belgium", "belgian"}, {"Irsko", "ireland", "irish"}, {"Rusko", "russia", "russian", "soviet union", "sovětský svaz"},
		{"Ukrajina", "ukraine", "ukrainian"}, {"Bělorusko", "belarus", "belarusian"}, {"Rumunsko", "romania", "romanian"}, {"Bulharsko", "bulgaria", "bulgarian"},
		{"Chorvatsko", "croatia", "croatian"}, {"Srbsko", "serbia", "serbian"}, {"Slovinsko", "slovenia", "slovenian"}, {"Řecko", "greece", "greek"},
		{"Estonsko", "estonia", "estonian"}, {"Lotyšsko", "latvia", "latvian"}, {"Litva", "lithuania", "lithuanian"}, {"Malta", "malta", "maltese"},
		{"Austrálie", "australia", "australian"}, {"Nový Zéland", "new zealand", "new zealander"}, {"Brazílie", "brazil", "brazilian"},
		{"Mexiko", "mexico", "mexican"}, {"Argentina", "argentina", "argentine", "argentinian"}, {"Kolumbie", "colombia", "colombian"},
		{"Venezuela", "venezuela", "venezuelan"}, {"Kuba", "cuba", "cuban"}, {"Portoriko", "puerto rico", "puerto rican"}, {"Chile", "chile", "chilean"},
		{"Peru", "peru", "peruvian"}, {"Japonsko", "japan", "japanese"}, {"Čína", "china", "chinese"}, {"Filipíny", "philippines", "filipino", "filipina"},
		{"Thajsko", "thailand", "thai"}, {"Indie", "india", "indian"}, {"Izrael", "israel", "israeli"}, {"Jihoafrická republika", "south africa", "south african"},
		{"Jižní Korea", "south korea", "korean"}, {"Vietnam", "vietnam", "vietnamese"}, {"Turecko", "turkey", "turkish"}, {"Írán", "iran", "iranian"},
	} {
		for _, n := range r[1:] {
			z[n] = r[0]
		}
		z[strings.ToLower(r[0])] = r[0]
	}
	return z
}()

func zemeSbirky(text string) string {
	t := strings.ToLower(strings.TrimSpace(strings.Trim(text, ".")))
	return zeme[t]
}

// „Ladysmith, British Columbia, Canada“ → „Ladysmith, British Columbia, Kanada“ (jen poslední část, když je to země)
func mistoSbirky(text string) string {
	casti := strings.Split(vycistitWikitext(text), ",")
	for i := range casti {
		casti[i] = strings.TrimSpace(casti[i])
	}
	if z := zemeSbirky(casti[len(casti)-1]); z != "" {
		casti[len(casti)-1] = z
	}
	var v []string
	for _, c := range casti {
		if c != "" {
			v = append(v, c)
		}
	}
	return strings.Join(v, ", ")
}

var (
	vzorOdkazuWiki   = regexp.MustCompile(`\[\[(?:[^|\]]*\|)?([^\]]*)\]\]`)
	vzorSablonyKonec = regexp.MustCompile(`\{\{[^{}]*\}\}`)
	vzorRef          = regexp.MustCompile(`(?s)<ref[^>]*/>|<ref[^>]*>.*?</ref>|<!--.*?-->`)
)

// Wikitext bez odkazů, poznámek a komentářů (šablony zůstanou)
func vycistitWikitext(text string) string {
	t := vzorRef.ReplaceAllString(text, "")
	t = vzorOdkazuWiki.ReplaceAllString(t, "$1")
	return strings.TrimSpace(strings.ReplaceAll(t, "&nbsp;", " "))
}

var mesiceEn = map[string]int{"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7, "august": 8,
	"september": 9, "october": 10, "november": 11, "december": 12}

func datumSbirky(rok, mesic, den int) string {
	switch {
	case rok < 1880 || rok > 2030:
		return ""
	case mesic < 1 || mesic > 12:
		return strconv.Itoa(rok)
	case den < 1 || den > 31:
		return fmt.Sprintf("%04d-%02d", rok, mesic)
	}
	return fmt.Sprintf("%04d-%02d-%02d", rok, mesic, den)
}

var (
	vzorSablonyData = regexp.MustCompile(`(?i)\{\{\s*(?:birth|death)[ _]date[^|}]*\|([^}]*)\}\}`)
	vzorDataSlovy   = regexp.MustCompile(`(?i)([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})`)
	vzorRoku        = regexp.MustCompile(`\b(1[89]\d\d|20[0-2]\d)\b`)
)

// Datum z „{{birth date and age|1969|10|30}}“, „October 30, 1969“, „30 October 1969“ nebo samotného roku
func datumZWikitextu(text string) string {
	if s := vzorSablonyData.FindStringSubmatch(text); s != nil {
		var cisla []int
		for _, c := range strings.Split(s[1], "|") {
			c = strings.TrimSpace(c)
			if strings.Contains(c, "=") {
				continue
			}
			if n, err := strconv.Atoi(c); err == nil {
				cisla = append(cisla, n)
			}
		}
		if len(cisla) >= 3 {
			return datumSbirky(cisla[0], cisla[1], cisla[2])
		}
		if len(cisla) == 2 {
			return datumSbirky(cisla[0], cisla[1], 0)
		}
	}
	t := vycistitWikitext(text)
	if s := vzorDataSlovy.FindStringSubmatch(t); s != nil {
		if s[1] != "" {
			den, _ := strconv.Atoi(s[2])
			rok, _ := strconv.Atoi(s[3])
			if m := mesiceEn[strings.ToLower(s[1])]; m > 0 {
				return datumSbirky(rok, m, den)
			}
		} else {
			den, _ := strconv.Atoi(s[4])
			rok, _ := strconv.Atoi(s[6])
			if m := mesiceEn[strings.ToLower(s[5])]; m > 0 {
				return datumSbirky(rok, m, den)
			}
		}
	}
	if s := vzorRoku.FindString(t); s != "" && !strings.Contains(t, "{{") {
		r, _ := strconv.Atoi(s)
		return datumSbirky(r, 0, 0)
	}
	return ""
}

// Pole infoboxu (| klic = hodnota) z wikitextu šablony, klíče malými písmeny s mezerami místo podtržítek.
// Hodnota může pokračovat na dalších řádcích, dokud nezačne další pole.
func poleInfoboxu(wikitext, sablona string) map[string]string {
	i := strings.Index(strings.ToLower(wikitext), "{{"+strings.ToLower(sablona))
	if i < 0 {
		return nil
	}
	// Konec šablony podle párování {{ }}
	hloubka, konec := 0, len(wikitext)
	for j := i; j < len(wikitext)-1; j++ {
		if wikitext[j] == '{' && wikitext[j+1] == '{' {
			hloubka++
			j++
		} else if wikitext[j] == '}' && wikitext[j+1] == '}' {
			hloubka--
			j++
			if hloubka == 0 {
				konec = j + 1
				break
			}
		}
	}
	telo := wikitext[i:konec]
	pole := map[string]string{}
	klic := ""
	for _, radek := range strings.Split(telo, "\n") {
		r := strings.TrimSpace(radek)
		if strings.HasPrefix(r, "|") && strings.Contains(r, "=") {
			k, v, _ := strings.Cut(strings.TrimPrefix(r, "|"), "=")
			klic = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(k), "_", " "))
			pole[klic] = strings.TrimSpace(v)
		} else if klic != "" && r != "" && r != "}}" {
			pole[klic] += " " + r
		}
	}
	return pole
}

// ——— Ověření, že zdroj mluví o téže modelce ———

// Jméno ve zdroji odpovídá modelce, když se shoduje příjmení i křestní jméno (bez diakritiky, i s pseudonymy)
func stejneJmeno(m *Modelka, jmeno string) bool {
	j := zjednodusit(vycistitWikitext(jmeno))
	if j == "" {
		return false
	}
	kandidati := append([]string{m.Jmeno}, hledani.DalsiJmena(m.DalsiJmena)...)
	for _, k := range kandidati {
		k = zjednodusit(strings.TrimSpace(k))
		if k == "" {
			continue
		}
		if k == j {
			return true
		}
		slova := strings.Fields(k)
		vse := true
		for _, s := range []string{slova[0], slova[len(slova)-1]} {
			if !strings.Contains(" "+j+" ", " "+s+" ") {
				vse = false
			}
		}
		if vse {
			return true
		}
	}
	return false
}

func rokNarozeni(m *Modelka) int {
	if len(m.NarozeniDatum) >= 4 {
		r, _ := strconv.Atoi(m.NarozeniDatum[:4])
		return r
	}
	return 0
}

var vzorCenterfolduUS = regexp.MustCompile(`^(\d{4})-(\d{2})$`)

// Americké centerfoldy modelky (Playmate měsíce) jako [rok, měsíc]
func centerfoldyUS(m *Modelka) [][2]int {
	var v [][2]int
	for _, c := range m.Centerfoldy {
		if s := vzorCenterfolduUS.FindStringSubmatch(c); s != nil {
			r, _ := strconv.Atoi(s[1])
			mes, _ := strconv.Atoi(s[2])
			v = append(v, [2]int{r, mes})
		}
	}
	return v
}

// ——— Wikidata ———

type entitaWikidat struct {
	ID           string                            `json:"id"`
	Labels       map[string]struct{ Value string } `json:"labels"`
	Descriptions map[string]struct{ Value string } `json:"descriptions"`
	Claims       map[string][]struct {
		Mainsnak struct {
			Datavalue struct {
				Value json.RawMessage `json:"value"`
			} `json:"datavalue"`
		} `json:"mainsnak"`
		Rank string `json:"rank"`
	} `json:"claims"`
}

func (e *entitaWikidat) stitek() string {
	for _, j := range []string{"cs", "en"} {
		if l, ok := e.Labels[j]; ok && l.Value != "" {
			return l.Value
		}
	}
	return ""
}

func (e *entitaWikidat) popis() string {
	if d, ok := e.Descriptions["en"]; ok {
		return d.Value
	}
	return ""
}

// Hodnoty vlastnosti (preferované napřed, zastaralé vynechané)
func (e *entitaWikidat) hodnoty(vlastnost string) []json.RawMessage {
	var pref, ostatni []json.RawMessage
	for _, c := range e.Claims[vlastnost] {
		if len(c.Mainsnak.Datavalue.Value) == 0 || c.Rank == "deprecated" {
			continue
		}
		if c.Rank == "preferred" {
			pref = append(pref, c.Mainsnak.Datavalue.Value)
		} else {
			ostatni = append(ostatni, c.Mainsnak.Datavalue.Value)
		}
	}
	return append(pref, ostatni...)
}

func (e *entitaWikidat) polozky(vlastnost string) []string {
	var v []string
	for _, h := range e.hodnoty(vlastnost) {
		var p struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(h, &p) == nil && p.ID != "" {
			v = append(v, p.ID)
		}
	}
	return v
}

func (e *entitaWikidat) datum(vlastnost string) string {
	for _, h := range e.hodnoty(vlastnost) {
		var t struct {
			Time      string `json:"time"`
			Precision int    `json:"precision"`
		}
		if json.Unmarshal(h, &t) != nil || len(t.Time) < 11 || t.Time[0] != '+' {
			continue
		}
		rok, _ := strconv.Atoi(t.Time[1:5])
		mesic, _ := strconv.Atoi(t.Time[6:8])
		den, _ := strconv.Atoi(t.Time[9:11])
		switch {
		case t.Precision >= 11:
			return datumSbirky(rok, mesic, den)
		case t.Precision == 10:
			return datumSbirky(rok, mesic, 0)
		case t.Precision == 9:
			return datumSbirky(rok, 0, 0)
		}
	}
	return ""
}

// Množství převedené na základní jednotku (cm, kg); 0 = není
func (e *entitaWikidat) mnozstvi(vlastnost string, jednotky map[string]float64) float64 {
	for _, h := range e.hodnoty(vlastnost) {
		var q struct {
			Amount string `json:"amount"`
			Unit   string `json:"unit"`
		}
		if json.Unmarshal(h, &q) != nil {
			continue
		}
		x, err := strconv.ParseFloat(strings.TrimPrefix(q.Amount, "+"), 64)
		nasobek, znama := jednotky[q.Unit[strings.LastIndex(q.Unit, "/")+1:]]
		if err == nil && znama {
			return x * nasobek
		}
	}
	return 0
}

const playmateWikidata = "Q728711"

func entityWikidat(ids []string) (map[string]*entitaWikidat, error) {
	var odpoved struct {
		Entities map[string]*entitaWikidat `json:"entities"`
	}
	if len(ids) == 0 {
		return map[string]*entitaWikidat{}, nil
	}
	err := ziskatZdroj(adresaWikidat, url.Values{"action": {"wbgetentities"}, "ids": {strings.Join(ids, "|")},
		"props": {"labels|descriptions|claims|sitelinks"}, "languages": {"cs|en"}, "format": {"json"}}, &odpoved)
	return odpoved.Entities, err
}

var (
	vzorQ          = regexp.MustCompile(`wikidata\.org/(?:wiki|entity)/(Q\d+)`)
	vzorClankuWiki = regexp.MustCompile(`en\.wikipedia\.org/wiki/([^\s,#?]+)`)
	vzorBoobpedie  = regexp.MustCompile(`boobpedia\.com/boobs/([^\s,#?]+)`)
)

// Položka Wikidat modelky: z odkazů (Wikidata nebo článek Wikipedie), jinak hledáním jména s ověřením
// (povolání Playboy Playmate, rok narození); vrací položku, nebo důvod, proč žádná nesedí
func najitWikidata(m *Modelka) (*entitaWikidat, string, error) {
	var ids []string
	if s := vzorQ.FindStringSubmatch(m.Odkazy); s != nil {
		ids = []string{s[1]}
	} else {
		for _, s := range vzorClankuWiki.FindAllStringSubmatch(m.Odkazy, -1) {
			titul, _ := url.PathUnescape(s[1])
			if strings.HasPrefix(titul, "List_of") {
				continue
			}
			var o struct {
				Entities map[string]struct {
					ID string `json:"id"`
				} `json:"entities"`
			}
			if err := ziskatZdroj(adresaWikidat, url.Values{"action": {"wbgetentities"}, "sites": {"enwiki"}, "titles": {titul},
				"props": {"info"}, "format": {"json"}}, &o); err != nil {
				return nil, "", err
			}
			for id := range o.Entities {
				if strings.HasPrefix(id, "Q") {
					ids = append(ids, id)
				}
			}
			if len(ids) > 0 {
				break
			}
		}
	}
	zOdkazu := len(ids) > 0
	if !zOdkazu {
		var o struct {
			Search []struct {
				ID string `json:"id"`
			} `json:"search"`
		}
		if err := ziskatZdroj(adresaWikidat, url.Values{"action": {"wbsearchentities"}, "search": {m.Jmeno}, "language": {"en"},
			"type": {"item"}, "limit": {"8"}, "format": {"json"}}, &o); err != nil {
			return nil, "", err
		}
		for _, s := range o.Search {
			ids = append(ids, s.ID)
		}
	}
	entity, err := entityWikidat(ids)
	if err != nil {
		return nil, "", err
	}
	rok := rokNarozeni(m)
	var nejlepsi *entitaWikidat
	nejlepsiSkore := 0
	duvod := "žádná osoba toho jména s povoláním Playboy Playmate ani se stejným rokem narození"
	for _, id := range ids {
		e := entity[id]
		if e == nil {
			continue
		}
		skore := 0
		if zOdkazu {
			skore += 5
		}
		for _, p := range e.polozky("P106") {
			if p == playmateWikidata {
				skore += 3
			}
		}
		if strings.Contains(strings.ToLower(e.popis()), "playmate") {
			skore += 2
		}
		if d := e.datum("P569"); rok > 0 && len(d) >= 4 {
			if d[:4] == strconv.Itoa(rok) {
				skore += 3
			} else {
				duvod = fmt.Sprintf("osoba %s se narodila %s, modelka %d", e.stitek(), d[:4], rok)
				continue
			}
		}
		if skore > nejlepsiSkore {
			nejlepsi, nejlepsiSkore = e, skore
		}
	}
	if nejlepsiSkore < 3 {
		return nil, duvod, nil
	}
	return nejlepsi, "", nil
}

func udajeZWikidat(m *Modelka) (ZdrojUdaju, udajeZdroje) {
	z := ZdrojUdaju{Klic: zdrojWikidata, Nazev: "Wikidata"}
	e, duvod, err := najitWikidata(m)
	if err != nil {
		z.Stav, z.Poznamka = "chyba", err.Error()
		return z, nil
	}
	if e == nil {
		z.Stav, z.Poznamka = "nenalezeno", duvod
		return z, nil
	}
	z.Stav, z.URL, z.Poznamka = "nalezeno", webWikidat+e.ID, strings.TrimSpace(e.stitek()+" – "+e.popis())
	u := udajeZdroje{"narozeniDatum": e.datum("P569"), "umrtiDatum": e.datum("P570")}
	if cm := e.mnozstvi("P2048", map[string]float64{"Q174728": 1, "Q11573": 100}); cm >= 120 && cm <= 215 {
		u["vyskaCm"] = strconv.Itoa(int(math.Round(cm)))
	}
	if kg := e.mnozstvi("P2067", map[string]float64{"Q11570": 1, "Q100995": 0.45359237}); kg >= 30 && kg <= 150 {
		u["vahaKg"] = strconv.Itoa(int(math.Round(kg)))
	}
	// Štítky míst, zemí a barev jedním dotazem
	misto, staty, vlasy, oci := e.polozky("P19"), e.polozky("P27"), e.polozky("P1884"), e.polozky("P1340")
	var dalsi []string
	for _, s := range [][]string{misto, staty, vlasy, oci} {
		if len(s) > 0 {
			dalsi = append(dalsi, s[0])
		}
	}
	if pomocne, err := entityWikidat(dalsi); err == nil {
		stitekEn := func(id string) string {
			if p := pomocne[id]; p != nil {
				if l, ok := p.Labels["en"]; ok {
					return l.Value
				}
			}
			return ""
		}
		zemeId := func(id string) string {
			if p := pomocne[id]; p != nil {
				if z := zemeSbirky(p.stitek()); z != "" {
					return z
				}
				if z := zemeSbirky(stitekEn(id)); z != "" {
					return z
				}
				return p.stitek()
			}
			return ""
		}
		if len(staty) > 0 {
			u["narodnost"] = zemeId(staty[0])
		}
		if len(misto) > 0 && pomocne[misto[0]] != nil {
			nazev := pomocne[misto[0]].stitek()
			stat := ""
			if s := pomocne[misto[0]].polozky("P17"); len(s) > 0 && len(staty) > 0 && s[0] == staty[0] {
				stat = u["narodnost"]
			}
			u["narozeniMisto"] = strings.Trim(nazev+", "+stat, ", ")
		}
		if len(vlasy) > 0 {
			u["vlasyBarva"] = prevestTabulkou(stitekEn(vlasy[0]), barvyVlasu)
		}
		if len(oci) > 0 {
			u["ociBarva"] = prevestTabulkou(stitekEn(oci[0]), barvyOci)
		}
	}
	return z, u
}

// ——— Wikipedie: seznam Playmate roku ———

func wikitextStranky(adresa, stranka string, oddil string) (string, string, error) {
	var o struct {
		Parse struct {
			Title    string `json:"title"`
			Wikitext string `json:"wikitext"`
		} `json:"parse"`
		Error *struct {
			Code string `json:"code"`
			Info string `json:"info"`
		} `json:"error"`
	}
	parametry := url.Values{"action": {"parse"}, "page": {stranka}, "prop": {"wikitext"}, "redirects": {"1"}, "format": {"json"}, "formatversion": {"2"}}
	if oddil != "" {
		parametry.Set("section", oddil)
	}
	if err := ziskatZdroj(adresa, parametry, &o); err != nil {
		return "", "", err
	}
	if o.Error != nil {
		if o.Error.Code == "missingtitle" {
			return "", "", nil
		}
		return "", "", errors.New(o.Error.Info)
	}
	return o.Parse.Wikitext, o.Parse.Title, nil
}

var nazvyMesicuEn = []string{"", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}

// Infobox Playmate měsíce ze seznamu „List of Playboy Playmates of RRRR“: pole a odkaz na oddíl
func playmateZeSeznamu(rok, mesic int) (map[string]string, string, error) {
	stranka := fmt.Sprintf("List of Playboy Playmates of %d", rok)
	text, _, err := wikitextStranky(adresaWikipedie, stranka, "")
	if err != nil || text == "" {
		return nil, "", err
	}
	nadpis := regexp.MustCompile(`(?m)^==\s*` + nazvyMesicuEn[mesic] + `\s*==\s*$`)
	i := nadpis.FindStringIndex(text)
	if i == nil {
		return nil, "", nil
	}
	oddil := text[i[1]:]
	if j := regexp.MustCompile(`(?m)^==[^=]`).FindStringIndex(oddil); j != nil {
		oddil = oddil[:j[0]]
	}
	pole := poleInfoboxu(oddil, "Infobox Playboy Playmate")
	if pole == nil {
		return nil, "", nil
	}
	return pole, webWikipedie + strings.ReplaceAll(stranka, " ", "_") + "#" + nazvyMesicuEn[mesic], nil
}

func udajeZInfoboxu(pole map[string]string) udajeZdroje {
	u := udajeZdroje{}
	if d := datumZWikitextu(pole["birth date"]); d != "" {
		u["narozeniDatum"] = d
	}
	if d := datumZWikitextu(pole["death date"]); d != "" {
		u["umrtiDatum"] = d
	}
	if p := mistoSbirky(pole["birth place"]); p != "" {
		u["narozeniMisto"] = p
		casti := strings.Split(p, ", ")
		if z := zemeSbirky(casti[len(casti)-1]); z != "" {
			u["narodnost"] = z
		}
	}
	if cm := vyskaVCm(pole["height"]); cm > 0 {
		u["vyskaCm"] = strconv.Itoa(cm)
	}
	if kg := vahaVKg(pole["weight"]); kg > 0 {
		u["vahaKg"] = strconv.Itoa(kg)
	}
	if miry, kosicek, palce := miryVCm(vycistitWikitext(pole["measurements"])); miry != "" {
		u["miry"] = miry
		if v := velikostPrsouEU(0, kosicek, palce); v != "" {
			u["velikostPrsou"] = v
		}
	}
	return u
}

func udajeZWikipedie(m *Modelka) (ZdrojUdaju, udajeZdroje) {
	z := ZdrojUdaju{Klic: zdrojWikipedie, Nazev: "Wikipedie"}
	cf := centerfoldyUS(m)
	if len(cf) == 0 {
		z.Stav, z.Poznamka = "nenalezeno", "modelka nemá americký centerfold (seznamy Playmate měsíce)"
		return z, nil
	}
	for _, c := range cf {
		pole, adresa, err := playmateZeSeznamu(c[0], c[1])
		if err != nil {
			z.Stav, z.Poznamka = "chyba", err.Error()
			return z, nil
		}
		if pole == nil {
			continue
		}
		jmeno := vycistitWikitext(pole["name"])
		if !stejneJmeno(m, jmeno) {
			z.Stav, z.URL, z.Poznamka = "jina", adresa, fmt.Sprintf("Playmate %02d/%d je podle seznamu %s", c[1], c[0], jmeno)
			continue
		}
		z.Stav, z.URL, z.Poznamka = "nalezeno", adresa, fmt.Sprintf("Playmate %02d/%d: %s", c[1], c[0], jmeno)
		return z, udajeZInfoboxu(pole)
	}
	if z.Stav == "" {
		z.Stav, z.Poznamka = "nenalezeno", "seznam Playmate pro její měsíc nemá infobox"
	}
	return z, nil
}

// ——— Boobpedia ———

func udajeZBoobpedie(m *Modelka) (ZdrojUdaju, udajeZdroje) {
	z := ZdrojUdaju{Klic: zdrojBoobpedia, Nazev: "Boobpedia"}
	var stranky []string
	if s := vzorBoobpedie.FindStringSubmatch(m.Odkazy); s != nil {
		t, _ := url.PathUnescape(s[1])
		stranky = append(stranky, t)
	}
	stranky = append(stranky, m.Jmeno)
	for _, j := range hledani.DalsiJmena(m.DalsiJmena) {
		if j = strings.TrimSpace(j); j != "" {
			stranky = append(stranky, j)
		}
	}
	rok := rokNarozeni(m)
	for _, stranka := range stranky {
		text, titul, err := wikitextStranky(adresaBoobpedie, strings.ReplaceAll(stranka, " ", "_"), "0")
		if err != nil {
			z.Stav, z.Poznamka = "chyba", err.Error()
			return z, nil
		}
		pole := poleInfoboxu(text, "Biobox")
		if pole == nil {
			continue
		}
		adresa := webBoobpedie + url.PathEscape(strings.ReplaceAll(titul, " ", "_"))
		u := udajeZdroje{}
		rokZ, _ := strconv.Atoi(strings.TrimSpace(pole["birth year"]))
		if rok > 0 && rokZ > 0 && rokZ != rok {
			z.Stav, z.URL, z.Poznamka = "jina", adresa, fmt.Sprintf("%s se narodila %d, modelka %d", titul, rokZ, rok)
			continue
		}
		mesic := mesiceEn[strings.ToLower(strings.TrimSpace(pole["birth month"]))]
		den, _ := strconv.Atoi(strings.TrimSpace(pole["birth day"]))
		if rokZ > 0 {
			u["narozeniDatum"] = datumSbirky(rokZ, mesic, den)
		}
		if p := mistoSbirky(pole["birth location"]); p != "" {
			u["narozeniMisto"] = p
		}
		if n := zemeSbirky(vycistitWikitext(pole["nationality"])); n != "" {
			u["narodnost"] = n
		}
		u["etnicita"] = prevestTabulkou(vycistitWikitext(pole["ethnicity"]), etnicity)
		if cm := vyskaVCm(pole["height"]); cm > 0 {
			u["vyskaCm"] = strconv.Itoa(cm)
		}
		if kg := vahaVKg(pole["weight"]); kg > 0 {
			u["vahaKg"] = strconv.Itoa(kg)
		}
		miry, kosicek, palce := miryVCm(pole["measurements"])
		if miry != "" {
			u["miry"] = miry
		}
		// Číslo s košíčkem v mírách je obvod podprsenky
		obvod := 0
		if kosicek != "" {
			obvod, palce = palce, 0
		}
		if s := vzorKosickuZdroje.FindStringSubmatch(strings.ReplaceAll(strings.ReplaceAll(pole["bra/cup size"], "{{bra|", ""), "}}", "")); s != nil {
			if n, _ := strconv.Atoi(s[1]); n > 0 {
				obvod = n
			}
			kosicek = strings.ToUpper(s[2])
		}
		if v := velikostPrsouEU(palce, kosicek, obvod); v != "" {
			u["velikostPrsou"] = v
		}
		switch strings.ToLower(strings.TrimSpace(pole["natural tits"])) {
		case "y", "yes":
			u["prsaTyp"] = "Přírodní"
		case "n", "no":
			u["prsaTyp"] = "Silikonová"
		}
		u["vlasyBarva"] = prevestTabulkou(vycistitWikitext(pole["hair color"]), barvyVlasu)
		u["ociBarva"] = prevestTabulkou(vycistitWikitext(pole["eye color"]), barvyOci)
		u["ochlupeni"] = prevestTabulkou(vycistitWikitext(pole["pubic hair"]), ochlupeniZdroju)
		poznamka := titul
		pm, _ := strconv.Atoi(strings.TrimSpace(pole["playmatemonth"]))
		pr, _ := strconv.Atoi(strings.TrimSpace(pole["playmateyear"]))
		if pm > 0 && pr > 0 {
			poznamka = fmt.Sprintf("%s · Playmate %02d/%d", titul, pm, pr)
			for _, c := range centerfoldyUS(m) {
				if c == [2]int{pr, pm} {
					poznamka += " souhlasí"
				}
			}
		}
		z.Stav, z.URL, z.Poznamka = "nalezeno", adresa, poznamka
		return z, u
	}
	if z.Stav == "" {
		z.Stav, z.Poznamka = "nenalezeno", "stránka s infoboxem pod jménem ani pseudonymy není"
	}
	return z, nil
}

// ——— Úplnost čísla: Playmate měsíce podle Wikipedie ———

type PlaymatePodleWikipedie struct {
	Jmeno     string `json:"jmeno"`
	URL       string `json:"url"`
	ModelkaID int    `json:"modelkaId"` // modelka sbírky toho jména, 0 = ve sbírce není
	Chyba     string `json:"chyba"`
}

// Playmate měsíce amerického čísla RRRR-MM podle seznamu na Wikipedii, s modelkou sbírky, pokud tam je
func (a *App) PlaymatePodleWikipedie(vydani string) PlaymatePodleWikipedie {
	s := vzorCenterfolduUS.FindStringSubmatch(vydani)
	if s == nil {
		return PlaymatePodleWikipedie{Chyba: "jen pro měsíční čísla americké edice"}
	}
	rok, _ := strconv.Atoi(s[1])
	mesic, _ := strconv.Atoi(s[2])
	pole, adresa, err := playmateZeSeznamu(rok, mesic)
	if err != nil {
		return PlaymatePodleWikipedie{Chyba: err.Error()}
	}
	if pole == nil {
		return PlaymatePodleWikipedie{Chyba: "seznam na Wikipedii pro tento měsíc infobox nemá"}
	}
	p := PlaymatePodleWikipedie{Jmeno: vycistitWikitext(pole["name"]), URL: adresa}
	modelky := a.snimekSbirky().modelky
	kandidati := make([]int, 0)
	for i := range modelky {
		if stejneJmeno(&modelky[i], p.Jmeno) {
			kandidati = append(kandidati, i)
		}
	}
	// Při více shodách přednost té, která má centerfold z tohoto čísla
	sort.SliceStable(kandidati, func(i, j int) bool {
		return obsahuje(modelky[kandidati[i]].Centerfoldy, vydani) && !obsahuje(modelky[kandidati[j]].Centerfoldy, vydani)
	})
	if len(kandidati) > 0 {
		p.ModelkaID = modelky[kandidati[0]].ID
	}
	return p
}
