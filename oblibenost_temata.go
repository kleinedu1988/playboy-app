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
	"sort"
	"strings"
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
	"tag:mokra":                           "Mokrá sezóna",
	"modelka:vlasy=zrzav":                 "Ohnivé zrzky",
	"modelka:vlasy=blond":                 "Blond sezóna",
	"modelka:vlasy=čern":                  "Černovlásky",
	"modelka:tetovani=ano":                "Tetované",
	"modelka:ochlupeni=Přírodní+tag:vagina":   "Divoká příroda",
	"modelka:ochlupeni=Oholené+tag:vagina":    "Hladká sezóna",
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
	"modelka:vlasy=hněd":                                                             "Kaštanová sezóna",
	"modelka:oci=modr":                                                               "Azurové pohledy",
	"modelka:oci=zelen":                                                              "Smaragdové oči",
	"modelka:tetovani=ne":                                                            "Čisté plátno",
	"modelka:kategorie=pmm":                                                          "Playmates měsíce",
	"modelka:kategorie=pmr":                                                          "Královny ročníku",
	"modelka:kategorie=cg":                                                           "Digitální múzy",
	"modelka:kategorie=obalka":                                                       "Tváře obálek",
	"modelka:vlasy=blond+tag:plaz":                                                   "Slunce a blond",
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
				nazvy = append(nazvy, tabulkaZemi[i].narodnost)
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
	return Tema{Klic: klicTematu(podminky), Nazev: nazevTematu(podminky), Podminky: podminky}
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
			if p.Druh == "tag" && f.tagy[h] || p.Druh == "fotka" && f.album.splnuje(p.Klic, h) {
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

// Fotky modelek s tagy a údaji alba (id fotky → modelka, tagy, album)
type fotkaTematu struct {
	modelka int
	tagy    map[string]bool
	album   *albumTematu
}

// Fotky pro témata; modelky = jen fotky těchto modelek (nil = všechny)
func (a *App) fotkyProTemata(modelky ...int) map[int]*fotkaTematu {
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
			fotky[id] = &fotkaTematu{modelka: m, tagy: map[string]bool{}, album: al}
		}
	}
	radky.Close()
	for id, t := range vsechnyTagyFotek(a.db) {
		if f := fotky[id]; f != nil {
			for _, tag := range t {
				f.tagy[tag] = true
			}
		}
	}
	return fotky
}

// Soutěžící tématu: modelka → počet fotek tématu (jen ty s aspoň minFotekTematu a splněnými údaji)
func souteziciTematu(t *Tema, modelky []Modelka, fotky map[int]*fotkaTematu) (map[int]int, int) {
	pocet := map[int]int{}
	fotekCelkem := 0
	for _, f := range fotky {
		if t.fotkaSplnuje(f) {
			pocet[f.modelka]++
		}
	}
	soutezici := map[int]int{}
	for i := range modelky {
		m := &modelky[i]
		if n := pocet[m.ID]; n >= minFotekTematu && t.modelkaSplnuje(m) {
			soutezici[m.ID] = n
			fotekCelkem += n
		}
	}
	return soutezici, fotekCelkem
}

// Katalog témat s pokrytím (nabídka tématu sezóny)
func (a *App) GetTemataSezon() []InfoTematu {
	modelky, _ := a.nactiModelky("", false)
	fotky := a.fotkyProTemata()
	vysledek := make([]InfoTematu, 0, len(katalogTemat))
	for i := range katalogTemat {
		t := katalogTemat[i]
		s, n := souteziciTematu(&t, modelky, fotky)
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
	if temaZKlice(tema) == nil {
		return false
	}
	return a.porovnatModelky(modelkaA, modelkaB, vysledek, tema)
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
	modelky, _ := a.nactiModelky("", false)
	s, _ := souteziciTematu(t, modelky, a.fotkyProTemata())
	if len(s) < minModelekTematu {
		return nil
	}
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
