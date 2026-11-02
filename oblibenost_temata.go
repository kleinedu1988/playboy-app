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
}

// Katalog témat (pořadí = nabídka); názvy dává slovník
var katalogTemat = func() []Tema {
	t := func(p ...PodminkaTematu) Tema { return noveTema(p) }
	tag := func(h ...string) PodminkaTematu { return PodminkaTematu{Druh: "tag", Hodnoty: h} }
	mod := func(k string, h ...string) PodminkaTematu {
		return PodminkaTematu{Druh: "modelka", Klic: k, Hodnoty: h}
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
			casti = append(casti, "modelka:"+p.Klic+"="+strings.Join(h, ","))
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
			if !ok || h == "" || (k != "prsaTyp" && k != "ochlupeni" && k != "vlasy" && k != "tetovani") {
				return nil, false
			}
			podminky = append(podminky, PodminkaTematu{Druh: "modelka", Klic: k, Hodnoty: strings.Split(h, ",")})
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
		if p.Druh == "tag" {
			return true
		}
	}
	return false
}

// Fotka splňuje všechny podmínky na tagy (v každé aspoň jeden z tagů)
func (t *Tema) fotkaSplnuje(tagy map[string]bool) bool {
	for _, p := range t.Podminky {
		if p.Druh != "tag" {
			continue
		}
		ma := false
		for _, h := range p.Hodnoty {
			if tagy[h] {
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
			switch p.Klic {
			case "prsaTyp":
				ma = m.PrsaTyp == h
			case "ochlupeni":
				ma = m.Ochlupeni == h
			case "vlasy":
				ma = h != "" && strings.Contains(strings.ToLower(m.VlasyBarva), strings.ToLower(h))
			case "tetovani":
				ma = (h == "ano" && m.Tetovani == 1) || (h == "ne" && m.Tetovani == 0)
			}
			if ma {
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

// Fotky modelek s tagy (id fotky → modelka, tagy); jedním dotazem
type fotkaTematu struct {
	modelka int
	tagy    map[string]bool
}

func (a *App) fotkyProTemata() map[int]*fotkaTematu {
	fotky := map[int]*fotkaTematu{}
	radky, err := a.db.Query(`SELECT f.id, f.modelka_id FROM fotografie f WHERE f.modelka_id IS NOT NULL`)
	if err != nil {
		a.chyba("fotky pro témata", err)
		return fotky
	}
	for radky.Next() {
		var id, m int
		if radky.Scan(&id, &m) == nil {
			fotky[id] = &fotkaTematu{modelka: m, tagy: map[string]bool{}}
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
		if t.fotkaSplnuje(f.tagy) {
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
	tagy := a.GetTagyFotek(a.idFotekModelek(ids))
	povolit := func(id int) bool {
		m := map[string]bool{}
		for _, tag := range tagy[id] {
			m[tag] = true
		}
		return t.fotkaSplnuje(m)
	}
	vysledek := a.spocitatNahledy(a.snimekSbirky(), ids, pocet, povolit)
	for _, id := range ids {
		if vysledek[id] == nil {
			vysledek[id] = []NahledFotky{}
		}
	}
	return vysledek
}

// Čísla fotek modelek (jejich alba)
func (a *App) idFotekModelek(ids []int) []int {
	var fotky []int
	if len(ids) == 0 {
		return fotky
	}
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	radky, err := a.db.Query(`SELECT f.id FROM fotografie f WHERE f.modelka_id IN (?`+strings.Repeat(", ?", len(ids)-1)+`)`, args...)
	if err != nil {
		return fotky
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		if radky.Scan(&id) == nil {
			fotky = append(fotky, id)
		}
	}
	return fotky
}
