package main

// Tematické sezóny: téma je sada podmínek nad tagy fotek (tagy_fotek.go) a údaji modelky (typ prsou, vlasy,
// ochlupení, tetování). V tematické sezóně soutěží jen modelky, které mají aspoň minFotekTematu fotek tématu
// (a splňují podmínky na modelku); do bodů se počítají jen souboje odehrané v tématu (porovnani.tema) mezi
// soutěžícími a zájem jen u soutěžících. Když téma nemá aspoň minModelekTematu soutěžících, sezóna běží jako
// Klasická (bez tématu). Téma sezóny je u jejího období (oblibenost_obdobi.go; klíč tématu, "" = Klasická).
//
// Název tématu skládá slovník: přesná kombinace podmínek má vlastní název („Přírodní krása“), jinak se složí
// z frází jednotlivých podmínek („Podpatky · přírodní prsa“). Klíč tématu je kanonický zápis podmínek
// („tag:prsa+modelka:prsaTyp=Přírodní“), takže jde uložit i téma složené mimo katalog.

import (
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	minFotekTematu   = 6 // fotek tématu, aby modelka soutěžila
	minModelekTematu = 8 // soutěžících, aby téma platilo (jinak Klasická)
)

// Podmínka tématu: druh "tag" = fotka má aspoň jeden z tagů v Hodnoty; druh "modelka" = údaj Klic modelky má
// jednu z Hodnoty (prsaTyp, ochlupeni, vlasy – část názvu barvy, tetovani – ano/ne)
type PodminkaTematu struct {
	Druh    string   `json:"druh"`
	Klic    string   `json:"klic"`
	Hodnoty []string `json:"hodnoty"`
}

type Tema struct {
	Klic     string           `json:"klic"`
	Nazev    string           `json:"nazev"`
	Podminky []PodminkaTematu `json:"podminky"`
	Ikona    string           `json:"ikona"`
	Skupina  string           `json:"skupina"` // éra, kalendář, původ, půvab, styl, místo, kombinace (oblibenost_temata_popis.go)
	Popis    string           `json:"popis"`   // jedna věta „afinity“ na kartu tématu
}

// Téma v katalogu s pokrytím (kolik modelek by soutěžilo a kolik fotek tématu je)
type InfoTematu struct {
	Tema
	Soutezicich int  `json:"soutezicich"`
	Fotek       int  `json:"fotek"`
	Plati       bool `json:"plati"` // má dost soutěžících
}

// ——— Slovník názvů ———

// Vlastní názvy přesných kombinací podmínek (klíč tématu → název)
var slovnikTemat = map[string]string{
	"":                                    "Klasická",
	"modelka:prsaTyp=Přírodní+tag:prsa":   "Přírodní krása",
	"modelka:prsaTyp=Silikonová+tag:prsa": "Silikonové křivky",
	"tag:oblecena":                        "Zahalená elegance",
	"tag:pradlo":                          "Krajky a prádlo",
	"tag:podpatky":                        "Na podpatcích",
	"tag:mesto,plaz,priroda":              "Pod širým nebem",
	"tag:plaz":                            "Léto u vody",
	"tag:portret":                         "Tváře",
	"tag:akt":                             "Čistý akt",
	"tag:nahore_bez":                      "Nahoře bez",
	"tag:podvazky,puncochy":               "Punčochy a podvazky",
	"tag:loznice":                         "V ložnici",
	"tag:zezadu":                          "Pohled zezadu",
	"tag:mokra":                           "Mokrá kůže",
	"modelka:vlasy=zrzav":                 "Ohnivé zrzky",
	"modelka:vlasy=blond":                 "Blondýnky",
	"modelka:vlasy=čern":                  "Černovlásky",
	"modelka:tetovani=ano":                "Tetované",
	"modelka:ochlupeni=Přírodní+tag:vagina":   "Divoká příroda",
	"modelka:ochlupeni=Oholené+tag:vagina":    "Hladké linie",
	"modelka:prsaTyp=Přírodní+tag:nahore_bez": "Přírodně nahoře bez",
	// Éry a kalendář z vydání alba (od 1.2.1)
	"fotka:obdobi=1960-1969":                       "Swingující šedesátá",
	"fotka:obdobi=1970-1979":                       "Návrat do sedmdesátek",
	"fotka:obdobi=1980-1989":                       "Lesk osmdesátek",
	"fotka:obdobi=1990-1999":                       "Zlatá devadesátá",
	"fotka:obdobi=2000-2009":                       "Nové milénium",
	"fotka:obdobi=2010-2019":                       "Desátá léta",
	"fotka:obdobi=2020-2029":                       "Současná éra",
	"fotka:mesic=06,07,08":                         "Letní čísla",
	"fotka:mesic=12":                               "Vánoční čísla",
	"fotka:edice=CZ":                               "Česká edice",
	"fotka:album=centerfold":                       "Středová dvoustrana",
	"fotka:obdobi=1990-1999+tag:bikiny,plaz":       "Léto devadesátých",
	"fotka:obdobi=1980-1989+tag:podvazky,puncochy": "Osmdesátky v nylonu",
	// Původ a údaje modelky (od 1.2.2)
	"modelka:narodnost=cesko,slovensko":                                              "Krásky od nás",
	"modelka:narodnost=cesko,madarsko,nemecko,polsko,rakousko,slovensko,slovinsko":   "Středoevropský půvab",
	"modelka:narodnost=dansko,finsko,island,norsko,svedsko":                          "Severská krása",
	"modelka:narodnost=francie,italie,portugalsko,recko,spanelsko":                   "Středomořský temperament",
	"modelka:narodnost=argentina,brazilie,chile,kolumbie,kuba,mexiko,peru,venezuela": "Latinský žár",
	"modelka:narodnost=irsko,velka_britanie":                                         "Britský šarm",
	"modelka:narodnost=australie,novy_zeland":                                        "Od protinožců",
	"modelka:narodnost=usa":                                                          "Americký sen",
	"fotka:edice=CZ+modelka:narodnost=cesko,slovensko":                               "Domácí scéna",
	"modelka:narodnost=dansko,finsko,island,norsko,svedsko+tag:priroda":              "Severská divočina",
	"modelka:vlasy=hněd":                                                             "Brunetky",
	"modelka:oci=modr":                                                               "Azurové pohledy",
	"modelka:oci=zelen":                                                              "Smaragdové oči",
	"modelka:tetovani=ne":                                                            "Čisté plátno",
	"modelka:kategorie=pmm":                                                          "Playmates měsíce",
	"modelka:kategorie=pmr":                                                          "Královny ročníku",
	"modelka:kategorie=cg":                                                           "Digitální múzy",
	"modelka:kategorie=obalka":                                                       "Tváře obálek",
	// Styl a místa z tagů (od 1.2.3)
	"tag:cernobila":                "Černobílá múza",
	"tag:cernobila+tag:low_key":    "Film noir",
	"tag:low_key":                  "Noir",
	"tag:high_key":                 "Andělské světlo",
	"tag:tonovana":                 "Sépiová nostalgie",
	"tag:zlata_hodina":             "Zlatá hodina",
	"tag:noc":                      "Po setmění",
	"tag:do_kamery":                "Tváří v tvář",
	"tag:usmev":                    "Úsměvy",
	"tag:detail":                   "Umění detailu",
	"tag:bunny":                    "Bunny klasika",
	"tag:dziny":                    "Denim Americana",
	"tag:latex":                    "Kůže a lesk",
	"tag:kostym":                   "Role a kostýmy",
	"tag:saty":                     "Dámy v šatech",
	"tag:kosile":                   "V jeho košili",
	"tag:vic_modelek":              "Společné focení",
	"tag:nohy+tag:podpatky":        "Nekonečné nohy",
	"tag:loznice+tag:pradlo":       "Budoár",
	"tag:bazen":                    "U bazénu",
	"tag:priroda":                  "Návrat k přírodě",
	"tag:koupelna":                 "Pěna a pára",
	"tag:studio":                   "Studiové světlo",
	"tag:auto":                     "Benzín a chrom",
	"tag:mesto":                    "Noc ve městě",
	"modelka:vlasy=blond+tag:plaz": "Slunce a blond",
}

// Fráze jednotlivých podmínek na modelku (podmínka na tag má frázi z názvu tagu)
var slovnikPodminek = map[string]string{
	"prsaTyp=Přírodní":     "přírodní prsa",
	"prsaTyp=Silikonová":   "silikonová prsa",
	"ochlupeni=Přírodní":   "přírodní klín",
	"ochlupeni=Oholené":    "oholené",
	"ochlupeni=Zastřižené": "zastřižené",
	"vlasy=zrzav":          "zrzky",
	"vlasy=blond":          "blondýnky",
	"vlasy=čern":           "černovlásky",
	"vlasy=hněd":           "brunetky",
	"tetovani=ano":         "s tetováním",
	"tetovani=ne":          "bez tetování",
	"oci=modr":             "modré oči",
	"oci=zelen":            "zelené oči",
	"oci=hněd":             "hnědé oči",
	"piercing=ano":         "s piercingem",
	"piercing=ne":          "bez piercingu",
	"kategorie=pmm":        "Playmates měsíce",
	"kategorie=pmr":        "Playmates roku",
	"kategorie=cg":         "Cyber Girls",
	"kategorie=obalka":     "modelky z obálek",
}

// Katalog témat (pořadí = nabídka); názvy dává slovník
var katalogTemat = func() []Tema {
	t := func(p ...PodminkaTematu) Tema { return noveTema(p) }
	tag := func(h ...string) PodminkaTematu { return PodminkaTematu{Druh: "tag", Hodnoty: h} }
	mod := func(k string, h ...string) PodminkaTematu {
		return PodminkaTematu{Druh: "modelka", Klic: k, Hodnoty: h}
	}
	fot := func(k string, h ...string) PodminkaTematu {
		return PodminkaTematu{Druh: "fotka", Klic: k, Hodnoty: h}
	}
	return []Tema{
		t(tag("prsa"), mod("prsaTyp", "Přírodní")),
		t(tag("prsa"), mod("prsaTyp", "Silikonová")),
		t(tag("oblecena")),
		t(tag("pradlo")),
		t(tag("podpatky")),
		t(tag("priroda", "plaz", "mesto")),
		t(tag("portret")),
		t(tag("akt")),
		t(tag("puncochy", "podvazky")),
		t(tag("vagina"), mod("ochlupeni", "Přírodní")),
		t(mod("vlasy", "zrzav")),
		t(mod("vlasy", "blond")),
		t(mod("tetovani", "ano")),
		t(fot("obdobi", "1960-1969")),
		t(fot("obdobi", "1970-1979")),
		t(fot("obdobi", "1980-1989")),
		t(fot("obdobi", "1990-1999")),
		t(fot("obdobi", "2000-2009")),
		t(fot("obdobi", "2010-2019")),
		t(fot("obdobi", "2020-2029")),
		t(fot("mesic", "06", "07", "08")),
		t(fot("mesic", "12")),
		t(fot("edice", "CZ")),
		t(fot("album", "centerfold")),
		t(fot("obdobi", "1990-1999"), tag("bikiny", "plaz")),
		t(fot("obdobi", "1980-1989"), tag("podvazky", "puncochy")),
		t(mod("narodnost", "cesko", "slovensko")),
		t(mod("narodnost", "cesko", "madarsko", "nemecko", "polsko", "rakousko", "slovensko", "slovinsko")),
		t(mod("narodnost", "dansko", "finsko", "island", "norsko", "svedsko")),
		t(mod("narodnost", "francie", "italie", "portugalsko", "recko", "spanelsko")),
		t(mod("narodnost", "argentina", "brazilie", "chile", "kolumbie", "kuba", "mexiko", "peru", "venezuela")),
		t(mod("narodnost", "irsko", "velka_britanie")),
		t(mod("narodnost", "australie", "novy_zeland")),
		t(mod("narodnost", "usa")),
		t(fot("edice", "CZ"), mod("narodnost", "cesko", "slovensko")),
		t(mod("narodnost", "dansko", "finsko", "island", "norsko", "svedsko"), tag("priroda")),
		t(mod("vlasy", "hněd")),
		t(mod("oci", "modr")),
		t(mod("oci", "zelen")),
		t(mod("tetovani", "ne")),
		t(mod("kategorie", "pmm")),
		t(mod("kategorie", "pmr")),
		t(mod("kategorie", "cg")),
		t(mod("kategorie", "obalka")),
		t(mod("vlasy", "blond"), tag("plaz")),
		t(tag("cernobila")),
		t(tag("cernobila"), tag("low_key")),
		t(tag("low_key")),
		t(tag("high_key")),
		t(tag("tonovana")),
		t(tag("zlata_hodina")),
		t(tag("noc")),
		t(tag("do_kamery")),
		t(tag("usmev")),
		t(tag("detail")),
		t(tag("bunny")),
		t(tag("dziny")),
		t(tag("latex")),
		t(tag("kostym")),
		t(tag("saty")),
		t(tag("kosile")),
		t(tag("vic_modelek")),
		t(tag("nohy"), tag("podpatky")),
		t(tag("loznice"), tag("pradlo")),
		t(tag("bazen")),
		t(tag("priroda")),
		t(tag("koupelna")),
		t(tag("studio")),
		t(tag("auto")),
		t(tag("mesto")),
	}
}()

// Kanonický klíč podmínek: hodnoty i podmínky seřazené, „druh:klic=hodnoty“ spojené „+“
func klicTematu(podminky []PodminkaTematu) string {
	casti := make([]string, 0, len(podminky))
	for _, p := range podminky {
		h := append([]string(nil), p.Hodnoty...)
		sort.Strings(h)
		if p.Druh == "tag" {
			casti = append(casti, "tag:"+strings.Join(h, ","))
		} else {
			casti = append(casti, p.Druh+":"+p.Klic+"="+strings.Join(h, ","))
		}
	}
	sort.Strings(casti)
	return strings.Join(casti, "+")
}

// Podmínky z klíče (opak klicTematu); neplatný klíč → nil, false
func podminkyZKlice(klic string) ([]PodminkaTematu, bool) {
	if klic == "" {
		return nil, true
	}
	var podminky []PodminkaTematu
	for _, cast := range strings.Split(klic, "+") {
		switch {
		case strings.HasPrefix(cast, "tag:"):
			h := strings.Split(strings.TrimPrefix(cast, "tag:"), ",")
			for _, t := range h {
				if skupinaTagu[t] == nil {
					return nil, false
				}
			}
			podminky = append(podminky, PodminkaTematu{Druh: "tag", Hodnoty: h})
		case strings.HasPrefix(cast, "modelka:"):
			k, h, ok := strings.Cut(strings.TrimPrefix(cast, "modelka:"), "=")
			if !ok || h == "" || !klicePodminekModelky[k] {
				return nil, false
			}
			hodnoty := strings.Split(h, ",")
			for _, x := range hodnoty {
				if !platnaHodnotaModelky(k, x) {
					return nil, false
				}
			}
			podminky = append(podminky, PodminkaTematu{Druh: "modelka", Klic: k, Hodnoty: hodnoty})
		case strings.HasPrefix(cast, "fotka:"):
			k, h, ok := strings.Cut(strings.TrimPrefix(cast, "fotka:"), "=")
			hodnoty := strings.Split(h, ",")
			if !ok || h == "" || !platnaPodminkaFotky(k, hodnoty) {
				return nil, false
			}
			podminky = append(podminky, PodminkaTematu{Druh: "fotka", Klic: k, Hodnoty: hodnoty})
		default:
			return nil, false
		}
	}
	return podminky, true
}

// Název podle slovníku: přesná kombinace, jinak fráze podmínek („Podpatky · přírodní prsa“)
func nazevTematu(podminky []PodminkaTematu) string {
	if n, ok := slovnikTemat[klicTematu(podminky)]; ok {
		return n
	}
	var fraze []string
	for _, p := range podminky {
		if p.Druh == "tag" {
			var nazvy []string
			for _, t := range p.Hodnoty {
				nazvy = append(nazvy, nazevTaguFotky(t))
			}
			fraze = append(fraze, strings.Join(nazvy, " nebo "))
			continue
		}
		var nazvy []string
		for _, h := range p.Hodnoty {
			if f, ok := slovnikPodminek[p.Klic+"="+h]; ok {
				nazvy = append(nazvy, f)
			} else if p.Druh == "fotka" {
				nazvy = append(nazvy, frazeFotky(p.Klic, h))
			} else if i, ok := kodyZemi[h]; ok && p.Klic == "narodnost" {
				nazvy = append(nazvy, tabulkaZemi[i].Narodnost)
			} else {
				nazvy = append(nazvy, strings.ToLower(h))
			}
		}
		fraze = append(fraze, strings.Join(nazvy, " nebo "))
	}
	n := strings.Join(fraze, " · ")
	if n == "" {
		return "Klasická"
	}
	r := []rune(n)
	return strings.ToUpper(string(r[0])) + string(r[1:])
}

func nazevTaguFotky(klic string) string {
	if sk := skupinaTagu[klic]; sk != nil {
		for _, t := range sk.Tagy {
			if t.Klic == klic {
				return t.Nazev
			}
		}
	}
	return klic
}

func noveTema(podminky []PodminkaTematu) Tema {
	klic := klicTematu(podminky)
	z := popisTematu(klic, podminky)
	return Tema{Klic: klic, Nazev: nazevTematu(podminky), Podminky: podminky, Ikona: z.Ikona, Skupina: z.Skupina, Popis: z.Popis}
}

// Téma z klíče (i mimo katalog); neplatný klíč → nil
func temaZKlice(klic string) *Tema {
	p, ok := podminkyZKlice(klic)
	if !ok {
		return nil
	}
	t := noveTema(p)
	return &t
}

// ——— Podmínky ———

func (t *Tema) maPodminkuNaFotku() bool {
	for _, p := range t.Podminky {
		if p.Druh == "tag" || p.Druh == "fotka" {
			return true
		}
	}
	return false
}

// Fotka splňuje všechny podmínky na tagy a na album (v každé aspoň jedna z hodnot)
func (t *Tema) fotkaSplnuje(f *fotkaTematu) bool {
	for _, p := range t.Podminky {
		if p.Druh != "tag" && p.Druh != "fotka" {
			continue
		}
		ma := false
		for _, h := range p.Hodnoty {
			if p.Druh == "tag" && f.maTag(h) || p.Druh == "fotka" && f.album.splnuje(p.Klic, h) {
				ma = true
				break
			}
		}
		if !ma {
			return false
		}
	}
	return true
}

func (t *Tema) modelkaSplnuje(m *Modelka) bool {
	for _, p := range t.Podminky {
		if p.Druh != "modelka" {
			continue
		}
		ma := false
		for _, h := range p.Hodnoty {
			if ma = modelkaMaHodnotu(m, p.Klic, h); ma {
				break
			}
		}
		if !ma {
			return false
		}
	}
	return true
}

// ——— Pokrytí: fotky tématu po modelkách ———

// Fotky modelek s tagy a údaji alba (id fotky → modelka, maska tagů, album)
type fotkaTematu struct {
	id      int
	modelka int
	maska   uint64 // tagy jako bity (bitTagu) – rychlá podmínka nad statisíci fotek bez alokace mapy
	album   *albumTematu
}

func (f *fotkaTematu) maTag(tag string) bool {
	return f.maska&bitTagu[tag] != 0
}

// Bit tagu v masce fotky (katalog má méně než 64 tagů; test to hlídá)
var bitTagu = func() map[string]uint64 {
	m := map[string]uint64{}
	n := 0
	for _, sk := range katalogTagu {
		for _, t := range sk.Tagy {
			m[t.Klic] = 1 << n
			n++
		}
	}
	return m
}()

type temataPamet struct {
	mu     sync.Mutex
	snimek *snimek
	fotky  map[int]*fotkaTematu
	seznam []*fotkaTematu // tytéž fotky jako seznam (procházení je řádově rychlejší než přes mapu)
	// Výsledky témat ke snímku (soutěžící a pokrytí; obojí jen ze sbírky, každý zápis dá nový snímek)
	vysledkySnimek *snimek
	soutez         map[string]vysledekSouteze
	pokryti        map[string]PokrytiTematu
	// Fotky prošlé průvodcem ke snímku (pokrytí témat je čte u každého tématu)
	prosleSnimek *snimek
	prosle       map[int]bool
	// Otisk dat témat ke snímku (temata_otisk.go) a otisky, ke kterým patří fotky a výsledky: shodný otisk
	// přenese paměť na nový snímek (zápis, který témata nemění – srdíčko)
	otiskSnimek   *snimek
	otisk         otiskTemat
	fotkyOtisk    string
	vysledkyOtisk string
	prosleOtisk   string
	// Fronta průvodce ke snímku (pruvodce_fotky.go GetStrankuPruvodce)
	pruvodceSnimek *snimek
	pruvodce       FrontaFotek
}

type vysledekSouteze struct {
	soutezici map[int]int
	fotek     int
}

// Výsledek tématu z paměti ke snímku, jinak spočítat (spocitat se volá bez zámku – sama čte snímek a fotky)
func pametTematu[T any](a *App, klic string, vyber func(p *temataPamet) map[string]T, spocitat func() T) T {
	s := a.snimekVPameti()
	if s == nil {
		return spocitat()
	}
	p := a.pametTemat()
	p.mu.Lock()
	if p.vysledkySnimek != s {
		if ov := a.otiskTematKeSnimku(p, s).vysledku; p.soutez == nil || ov != p.vysledkyOtisk {
			p.soutez, p.pokryti, p.vysledkyOtisk = map[string]vysledekSouteze{}, map[string]PokrytiTematu{}, ov
		}
		p.vysledkySnimek = s
	}
	if v, ok := vyber(p)[klic]; ok {
		p.mu.Unlock()
		return v
	}
	p.mu.Unlock()
	v := spocitat()
	p.mu.Lock()
	if p.vysledkySnimek == s {
		vyber(p)[klic] = v
	}
	p.mu.Unlock()
	return v
}

// Soutěžící tématu nad celou sbírkou (z paměti ke snímku); výsledek se nesmí měnit
func (a *App) souteziciTematuSbirky(t *Tema) (map[int]int, int) {
	v := pametTematu(a, t.Klic, func(p *temataPamet) map[string]vysledekSouteze { return p.soutez }, func() vysledekSouteze {
		s, n := souteziciTematu(t, a.modelkyProTemata(), a.seznamFotekProTemata())
		return vysledekSouteze{s, n}
	})
	return v.soutezici, v.fotek
}

// Paměť se zakládá líně (App se kopíruje, např. pro import – kopie sdílí ukazatel)
var zalozeniPametiTemat sync.Mutex

func (a *App) pametTemat() *temataPamet {
	zalozeniPametiTemat.Lock()
	defer zalozeniPametiTemat.Unlock()
	if a.temataPamet == nil {
		a.temataPamet = &temataPamet{}
	}
	return a.temataPamet
}

// Fotky pro témata; modelky = jen fotky těchto modelek (nil = všechny). Všechny se pamatují ke snímku sbírky
// (každý zápis do databáze dá nový snímek, takže paměť nezastará); výsledek se nesmí měnit.
func (a *App) fotkyProTemata(modelky ...int) map[int]*fotkaTematu {
	if len(modelky) == 0 {
		if s := a.snimekVPameti(); s != nil {
			p := a.pametTemat()
			p.mu.Lock()
			defer p.mu.Unlock()
			if p.snimek != s {
				if of := a.otiskTematKeSnimku(p, s).fotek; p.fotky == nil || of != p.fotkyOtisk {
					p.fotky, p.fotkyOtisk = a.nacistFotkyProTemata(), of
					p.seznam = seznamFotek(p.fotky)
				}
				p.snimek = s
			}
			return p.fotky
		}
	}
	return a.nacistFotkyProTemata(modelky...)
}

// Modelky pro témata jen ke čtení: ze snímku bez kopie (nactiModelky kopíruje celý seznam – u 70 témat znatelné)
func (a *App) modelkyProTemata() []Modelka {
	if s := a.snimekSbirky(); s != nil && s.err == nil {
		return s.modelky
	}
	m, _ := a.nactiModelky("", false)
	return m
}

// Všechny fotky pro témata jako seznam (z paměti ke snímku)
func (a *App) seznamFotekProTemata() []*fotkaTematu {
	if s := a.snimekVPameti(); s != nil {
		a.fotkyProTemata()
		p := a.pametTemat()
		p.mu.Lock()
		defer p.mu.Unlock()
		if p.snimek == s {
			return p.seznam
		}
	}
	return seznamFotek(a.nacistFotkyProTemata())
}

func seznamFotek(fotky map[int]*fotkaTematu) []*fotkaTematu {
	v := make([]*fotkaTematu, 0, len(fotky))
	for _, f := range fotky {
		v = append(v, f)
	}
	return v
}

func (a *App) nacistFotkyProTemata(modelky ...int) map[int]*fotkaTematu {
	fotky := map[int]*fotkaTematu{}
	alba := a.albaProTemata()
	dotaz := `SELECT f.id, f.modelka_id, f.album_id FROM fotografie f WHERE f.modelka_id > 0`
	args := make([]any, len(modelky))
	for i, id := range modelky {
		args[i] = id
	}
	if len(modelky) > 0 {
		dotaz += ` AND f.modelka_id IN (?` + strings.Repeat(", ?", len(modelky)-1) + `)`
	}
	radky, err := a.db.Query(dotaz, args...)
	if err != nil {
		a.chyba("fotky pro témata", err)
		return fotky
	}
	for radky.Next() {
		var id, m, album int
		if radky.Scan(&id, &m, &album) == nil {
			al := alba[album]
			if al == nil {
				al = &albumTematu{}
			}
			fotky[id] = &fotkaTematu{id: id, modelka: m, album: al}
		}
	}
	radky.Close()
	for id, t := range vsechnyTagyFotek(a.db) {
		if f := fotky[id]; f != nil {
			for _, tag := range t {
				f.maska |= bitTagu[tag]
			}
		}
	}
	return fotky
}

// Vyhodnocení tématu nad všemi fotkami: údaje modelky se zjistí jednou za modelku a podmínky na album jednou za
// album (dřív u každé ze statisíců fotek); fotky modelek, které údaje nesplňují, se přeskočí
type hodnotitelTematu struct {
	t       *Tema
	modelky map[int]bool
	splnuje []bool // podle id modelky (rychlejší než mapa ve smyčce přes všechny fotky)
	alba    map[*albumTematu]bool
	maAlbum bool
	masky   []uint64 // každá podmínka na tag: fotka musí mít aspoň jeden z bitů
}

func novyHodnotitel(t *Tema, modelky []Modelka) *hodnotitelTematu {
	h := &hodnotitelTematu{t: t, modelky: make(map[int]bool, len(modelky)), alba: map[*albumTematu]bool{}}
	maxID := 0
	for i := range modelky {
		maxID = max(maxID, modelky[i].ID)
	}
	h.splnuje = make([]bool, maxID+1)
	for i := range modelky {
		if t.modelkaSplnuje(&modelky[i]) {
			h.modelky[modelky[i].ID] = true
			h.splnuje[modelky[i].ID] = true
		}
	}
	for _, p := range t.Podminky {
		h.maAlbum = h.maAlbum || p.Druh == "fotka"
		if p.Druh == "tag" {
			var m uint64
			for _, x := range p.Hodnoty {
				m |= bitTagu[x]
			}
			h.masky = append(h.masky, m)
		}
	}
	return h
}

// Modelka fotky splňuje údaje tématu
func (h *hodnotitelTematu) modelka(id int) bool {
	return id >= 0 && id < len(h.splnuje) && h.splnuje[id]
}

func (h *hodnotitelTematu) album(f *fotkaTematu) bool {
	if !h.maAlbum {
		return true
	}
	v, ok := h.alba[f.album]
	if !ok {
		v = h.t.albumSplnuje(f)
		h.alba[f.album] = v
	}
	return v
}

func (h *hodnotitelTematu) tagy(f *fotkaTematu) bool {
	for _, m := range h.masky {
		if f.maska&m == 0 {
			return false
		}
	}
	return true
}

// Soutěžící tématu: modelka → počet fotek tématu (jen ty s aspoň minFotekTematu a splněnými údaji)
func souteziciTematu(t *Tema, modelky []Modelka, fotky []*fotkaTematu) (map[int]int, int) {
	h := novyHodnotitel(t, modelky)
	pocet := make([]int, len(h.splnuje))
	fotekCelkem := 0
	for _, f := range fotky {
		if h.modelka(f.modelka) && h.tagy(f) && h.album(f) {
			pocet[f.modelka]++
		}
	}
	soutezici := map[int]int{}
	for i := range modelky {
		m := &modelky[i]
		if n := pocet[m.ID]; n >= minFotekTematu && h.modelka(m.ID) {
			soutezici[m.ID] = n
			fotekCelkem += n
		}
	}
	return soutezici, fotekCelkem
}

// Katalog témat s pokrytím (nabídka tématu sezóny)
func (a *App) GetTemataSezon() []InfoTematu {
	vysledek := make([]InfoTematu, 0, len(katalogTemat))
	for i := range katalogTemat {
		t := katalogTemat[i]
		s, n := a.souteziciTematuSbirky(&t)
		vysledek = append(vysledek, InfoTematu{Tema: t, Soutezicich: len(s), Fotek: n, Plati: len(s) >= minModelekTematu})
	}
	return vysledek
}

// Název tématu z klíče (pro uložené sezóny); neplatný klíč = Klasická
func nazevKliceTematu(klic string) string {
	if t := temaZKlice(klic); t != nil {
		return t.Nazev
	}
	return "Klasická"
}

// Porovnání v tématu sezóny (Porovnat v tematickém režimu): jako PorovnatModelky, se zapsaným tématem
func (a *App) PorovnatModelkyVTematu(modelkaA, modelkaB int, vysledek, tema string) bool {
	t := temaZKlice(tema)
	if t == nil {
		return false
	}
	// Kanonický klíč (souboje se se sezónou párují přesnou shodou)
	return a.porovnatModelky(modelkaA, modelkaB, vysledek, t.Klic)
}

// Filtr bodů sezóny: platné téma a jeho soutěžící; nil = Klasická
type filtrSezony struct {
	tema      Tema
	soutezici map[int]int
}

// Filtr sezóny s tématem (klíč): téma, pokud má dost soutěžících (jinak Klasická = nil)
func (a *App) filtrSezony(tema string) *filtrSezony {
	t := temaZKlice(tema)
	if t == nil || t.Klic == "" {
		return nil
	}
	s, _ := a.souteziciTematuSbirky(t)
	if len(s) < minModelekTematu {
		return nil
	}
	return &filtrSezony{tema: *t, soutezici: s}
}

// Filtr sezóny v okně [od, do): téma platí, když se v něm v té sezóně opravdu porovnávalo (rozhoduje, jak sezóna
// běžela, ne dnešní počet soutěžících – ten se dotagováním mění); soutěžící jsou dnešní soutěžící tématu (i pod
// hranicí počtu). Bez tematických soubojů: probíhající sezóna podle dnešní platnosti tématu, skončená jako Klasická.
func (a *App) filtrSezonyOkna(tema string, porovnani []porovnaniZaznam, od, do time.Time, probiha bool) *filtrSezony {
	t := temaZKlice(tema)
	if t == nil || t.Klic == "" {
		return nil
	}
	vTematu := slices.ContainsFunc(porovnani, func(p porovnaniZaznam) bool {
		return p.tema == t.Klic && !p.cas.Before(od) && p.cas.Before(do)
	})
	if !vTematu {
		if !probiha {
			return nil
		}
		return a.filtrSezony(t.Klic)
	}
	s, _ := a.souteziciTematuSbirky(t)
	return &filtrSezony{tema: *t, soutezici: s}
}

// Souboj patří do sezóny: v Klasické všechny, v tématu jen odehrané v tématu mezi soutěžícími
func (f *filtrSezony) pocitaSe(p porovnaniZaznam) bool {
	if f == nil {
		return true
	}
	return p.tema == f.tema.Klic && f.soutezici[p.a] > 0 && f.soutezici[p.b] > 0
}

// Náhledy pásů v Porovnat v tematické sezóně: jen fotky tématu (bez mezipaměti, téma se mění zřídka a pásy
// chtějí jen pár modelek); Klasická = běžné GetNahledyModelek
func (a *App) GetNahledyTematu(ids []int, pocet int, tema string) map[int][]NahledFotky {
	t := temaZKlice(tema)
	if t == nil || !t.maPodminkuNaFotku() {
		return a.GetNahledyModelek(ids, pocet)
	}
	pocet = min(max(pocet, 1), maxNahledu)
	ids = ids[:min(len(ids), 2*maxDvojicNaVolani)]
	if len(ids) == 0 {
		return map[int][]NahledFotky{}
	}
	fotky := a.fotkyProTemata(ids...)
	povolit := func(id int) bool {
		f := fotky[id]
		return f != nil && t.fotkaSplnuje(f)
	}
	vysledek := a.spocitatNahledy(a.snimekSbirky(), ids, pocet, povolit)
	for _, id := range ids {
		if vysledek[id] == nil {
			vysledek[id] = []NahledFotky{}
		}
	}
	return vysledek
}
