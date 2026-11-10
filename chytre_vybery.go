package main

// Chytré výběry (⚡): pojmenovaný živý dotaz nad fotkami (Galerie fotek: řazení, srdíčka, typy, tagy, desetiletí,
// kolekce a text hledání včetně chytrých výrazů a hledání slovy) nebo nad modelkami (text hledání a filtr z panelu
// Filtry). Neukládají se položky, ale podmínky: nová fotka nebo modelka, která jim vyhoví, je ve výběru hned.
// Ukládají se jako JSON v tabulce nastaveni (klíč chytre_vybery) a v exportu v nepovinné části nastaveni –
// schéma databáze (úprava č. 16) ani verze exportu (13) se nemění; starší program část nastaveni přeskočí.
// Dřívější „Uložené výběry“ Galerie (klíč galerie_vybery) se při prvním čtení převedou sem.

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strings"
)

const (
	klicChytrychVyberu = "chytre_vybery"
	maxChytrychVyberu  = 60
	nahleduChytrehoVyb = 4

	DruhVyberuFotky   = "fotky"
	DruhVyberuModelky = "modelky"
)

// Podmínky Galerie fotek (bez stránkování a semínka)
type PodminkyGalerie struct {
	Razeni  string   `json:"razeni,omitempty" yaml:"razeni,omitempty"`
	Srdicka string   `json:"srdicka,omitempty" yaml:"srdicka,omitempty"`
	Typy    []string `json:"typy,omitempty" yaml:"typy,omitempty"`
	Tagy    []string `json:"tagy,omitempty" yaml:"tagy,omitempty"`
	Dekady  []string `json:"dekady,omitempty" yaml:"dekady,omitempty"`
	Kolekce string   `json:"kolekce,omitempty" yaml:"kolekce,omitempty"`
}

type ChytryVyber struct {
	ID    string `json:"id" yaml:"id"`
	Nazev string `json:"nazev" yaml:"nazev"`
	Popis string `json:"popis,omitempty" yaml:"popis,omitempty"`
	Druh  string `json:"druh" yaml:"druh"` // fotky | modelky
	// Text hledání tak, jak ho uživatel napsal (blond výška > 175), a převedený na příkazy (vlasy:blond vyska:>175);
	// vyhodnocuje se převedený, zápis se ukazuje a vrací do pole hledání
	Zapis string `json:"zapis,omitempty" yaml:"zapis,omitempty"`
	Text  string `json:"text,omitempty" yaml:"text,omitempty"`
	// Modelky: příkazy panelu Filtry (hodnoceni:>=4 vlasy:blond)
	Filtr string `json:"filtr,omitempty" yaml:"filtr,omitempty"`
	// Fotky: podmínky Galerie
	Galerie      PodminkyGalerie `json:"galerie" yaml:"galerie,omitempty"`
	NazevKolekce string          `json:"nazevKolekce,omitempty" yaml:"nazev_kolekce,omitempty"`
	Vytvoreno    string          `json:"vytvoreno,omitempty" yaml:"vytvoreno,omitempty"`
}

// Chytrý výběr s aktuálním výsledkem
type StavChytrehoVyberu struct {
	ChytryVyber
	Pocet   int          `json:"pocet"`
	Fotky   []Fotografie `json:"fotky"`   // náhled (fotky)
	Modelky []int        `json:"modelky"` // náhled (modelky, od nejvíc srdíček)
	// Položky, které přibyly od posledního otevření výběru (1.52); při prvním vyhodnocení 0
	Nove int `json:"nove"`
}

func noveIDVyberu() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Uložené chytré výběry v pořadí (nejnovější uložený první)
func (a *App) chytreVybery() []ChytryVyber {
	v := []ChytryVyber{}
	if a.db == nil {
		return v
	}
	if text := a.nastaveni(klicChytrychVyberu); text != "" {
		if json.Unmarshal([]byte(text), &v) != nil || v == nil {
			return []ChytryVyber{}
		}
		return v
	}
	// Převod dřívějších uložených výběrů Galerie
	stare := a.GetVyberyGalerie()
	if len(stare) == 0 {
		return v
	}
	for _, s := range stare {
		v = append(v, ChytryVyber{ID: noveIDVyberu(), Nazev: s.Nazev, Druh: DruhVyberuFotky, NazevKolekce: s.NazevKolekce,
			Galerie: PodminkyGalerie{Razeni: s.Dotaz.Razeni, Srdicka: s.Dotaz.Srdicka, Typy: s.Dotaz.Typy, Tagy: s.Dotaz.Tagy, Dekady: s.Dotaz.Dekady, Kolekce: s.Dotaz.Kolekce}})
	}
	if a.ulozitChytreVybery(v) {
		_ = a.ulozitNastaveni(klicVyberuGalerie, "")
	}
	return v
}

func (a *App) ulozitChytreVybery(v []ChytryVyber) bool {
	if len(v) == 0 {
		return a.ulozitNastaveni(klicChytrychVyberu, "[]") == nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		return false
	}
	if err := a.ulozitNastaveni(klicChytrychVyberu, string(data)); err != nil {
		a.chyba("uložení chytrého výběru", err)
		return false
	}
	return true
}

// Výběry s počty a náhledy; druh "" = všechny
func (a *App) GetChytreVybery(druh string) []StavChytrehoVyberu {
	vysledek := []StavChytrehoVyberu{}
	for _, v := range a.chytreVybery() {
		if druh != "" && v.Druh != druh {
			continue
		}
		vysledek = append(vysledek, a.vyhodnotitChytryVyber(v, nahleduChytrehoVyb))
	}
	return vysledek
}

func (v ChytryVyber) dotazGalerie() DotazGalerie {
	g := v.Galerie
	return DotazGalerie{Razeni: g.Razeni, Srdicka: g.Srdicka, Typy: g.Typy, Tagy: g.Tagy, Dekady: g.Dekady, Kolekce: g.Kolekce, Text: v.Text}
}

// Počet a prvních nahled položek (fotky v pořadí galerie, modelky od nejvíc srdíček) a kolik přibylo od minula
func (a *App) vyhodnotitChytryVyber(v ChytryVyber, nahled int) StavChytrehoVyberu {
	s := StavChytrehoVyberu{ChytryVyber: v, Fotky: []Fotografie{}, Modelky: []int{}}
	ids := a.idsChytrehoVyberu(v, nahled, &s)
	videno, ok := a.videnoVyberu(v.ID)
	if !ok {
		// Výběr ještě nikdy nepočítal: všechno teď je „viděné“
		a.ulozitVidenoVyberu(v.ID, ids)
		return s
	}
	for _, id := range ids {
		if !videno[id] {
			s.Nove++
		}
	}
	return s
}

// ID všech položek výběru; do s doplní počet a náhled
func (a *App) idsChytrehoVyberu(v ChytryVyber, nahled int, s *StavChytrehoVyberu) []int {
	var ids []int
	switch v.Druh {
	case DruhVyberuFotky:
		fotky, poradi := a.fotkyChytrehoVyberu(v)
		s.Pocet = len(poradi)
		for i, p := range poradi {
			ids = append(ids, fotky[p].f.ID)
			if i < nahled {
				s.Fotky = append(s.Fotky, fotky[p].f)
			}
		}
	case DruhVyberuModelky:
		modelky := a.modelkyChytrehoVyberu(v)
		s.Pocet = len(modelky)
		sort.SliceStable(modelky, func(i, j int) bool { return modelky[i].Hodnoceni > modelky[j].Hodnoceni })
		for i, m := range modelky {
			ids = append(ids, m.ID)
			if i < nahled {
				s.Modelky = append(s.Modelky, m.ID)
			}
		}
	}
	return ids
}

const predponaVidenoVyberu = "chytry_vyber_videno:"

// Položky výběru při posledním otevření; false = ještě nezapsané
func (a *App) videnoVyberu(id string) (map[int]bool, bool) {
	text := a.nastaveni(predponaVidenoVyberu + id)
	if text == "" {
		return nil, false
	}
	var ids []int
	if json.Unmarshal([]byte(text), &ids) != nil {
		return nil, false
	}
	m := make(map[int]bool, len(ids))
	for _, x := range ids {
		m[x] = true
	}
	return m, true
}

func (a *App) ulozitVidenoVyberu(id string, ids []int) {
	if id == "" || a.db == nil {
		return
	}
	if ids == nil {
		ids = []int{}
	}
	if data, err := json.Marshal(ids); err == nil {
		_ = a.ulozitNastaveni(predponaVidenoVyberu+id, string(data))
	}
}

// Otevření výběru: co v něm teď je, je od teď viděné (odznak +N zmizí)
func (a *App) OznacitVyberVideny(id string) {
	for _, v := range a.chytreVybery() {
		if v.ID == id {
			var s StavChytrehoVyberu
			a.ulozitVidenoVyberu(id, a.idsChytrehoVyberu(v, 0, &s))
			return
		}
	}
}

// Výběr s náhledem až nejvic položek (Časopis, prezentace)
func (a *App) GetObsahChytrehoVyberu(id string, nejvic int) StavChytrehoVyberu {
	nejvic = min(max(nejvic, 1), 500)
	for _, v := range a.chytreVybery() {
		if v.ID == id {
			s := StavChytrehoVyberu{ChytryVyber: v, Fotky: []Fotografie{}, Modelky: []int{}}
			a.idsChytrehoVyberu(v, nejvic, &s)
			return s
		}
	}
	return StavChytrehoVyberu{Fotky: []Fotografie{}, Modelky: []int{}}
}

// Modelky výběru (okruh Dnešního výběru „vyber:<id>“); nil = výběr neexistuje
func (a *App) modelkyVyberu(id string) map[int]bool {
	for _, v := range a.chytreVybery() {
		if v.ID == id && v.Druh == DruhVyberuModelky {
			m := map[int]bool{}
			for _, x := range a.modelkyChytrehoVyberu(v) {
				m[x.ID] = true
			}
			return m
		}
	}
	return nil
}

// Fotky galerie a pořadí vyhovujících; sdílenou paměť galerie čte, ale nemění (posledni dotaz Galerie zůstane)
func (a *App) fotkyChytrehoVyberu(v ChytryVyber) ([]fotkaGalerie, []int) {
	otisk := a.otiskGalerie()
	p := &galeriePamet
	p.Lock()
	defer p.Unlock()
	if p.otisk != otisk || p.fotky == nil {
		p.fotky, p.otisk, p.klic = a.fotkyGalerie(), otisk, ""
	}
	poradi, _, _ := a.vybratGalerii(p.fotky, v.dotazGalerie())
	return p.fotky, poradi
}

func (a *App) modelkyChytrehoVyberu(v ChytryVyber) []Modelka {
	dotaz := strings.TrimSpace(v.Filtr + " " + v.Text)
	modelky, _ := a.nactiModelky(dotaz, false)
	return modelky
}

// Uloží výběr (nový bez ID, jinak přepíše výběr se stejným ID) na začátek seznamu; vrací uložený, nebo prázdný
// při chybě. Název musí být mezi výběry stejného druhu jedinečný (bez ohledu na velikost písmen a diakritiku).
func (a *App) UlozitChytryVyber(v ChytryVyber) ChytryVyber {
	v.Nazev = strings.TrimSpace(v.Nazev)
	if r := []rune(v.Nazev); len(r) > 60 {
		v.Nazev = string(r[:60])
	}
	v.Popis = strings.TrimSpace(v.Popis)
	v.Text, v.Zapis, v.Filtr = strings.TrimSpace(v.Text), strings.TrimSpace(v.Zapis), strings.TrimSpace(v.Filtr)
	if a.db == nil || v.Nazev == "" || (v.Druh != DruhVyberuFotky && v.Druh != DruhVyberuModelky) {
		return ChytryVyber{}
	}
	if v.Druh == DruhVyberuModelky {
		v.Galerie, v.NazevKolekce = PodminkyGalerie{}, ""
	} else {
		v.Filtr = ""
		v.NazevKolekce = ""
		if v.Galerie.Kolekce != "" {
			_, v.NazevKolekce = a.filtrKolekce(a.fotkyGalerieVPameti(), v.Galerie.Kolekce)
		}
	}
	stare := a.chytreVybery()
	if v.ID == "" {
		v.ID = noveIDVyberu()
		if v.Vytvoreno == "" {
			v.Vytvoreno = ted()
		}
	}
	seznam := []ChytryVyber{v}
	for _, x := range stare {
		if x.ID == v.ID {
			if v.Vytvoreno == "" {
				seznam[0].Vytvoreno = x.Vytvoreno
			}
			continue
		}
		if x.Druh == v.Druh && zjednodusit(x.Nazev) == zjednodusit(v.Nazev) {
			return ChytryVyber{}
		}
		if len(seznam) < maxChytrychVyberu {
			seznam = append(seznam, x)
		}
	}
	if !a.ulozitChytreVybery(seznam) {
		return ChytryVyber{}
	}
	return seznam[0]
}

func (a *App) SmazatChytryVyber(id string) bool {
	var seznam []ChytryVyber
	nalezen := false
	for _, x := range a.chytreVybery() {
		if x.ID == id {
			nalezen = true
			continue
		}
		seznam = append(seznam, x)
	}
	if nalezen {
		_ = a.ulozitNastaveni(predponaVidenoVyberu+id, "")
	}
	return nalezen && a.ulozitChytreVybery(seznam)
}

// Výsledek zmrazení: fotky → běžný výběr (Nejlepší) se stejným názvem, modelky → tag se jménem výběru
type ZmrazeniVyberu struct {
	Pocet   int    `json:"pocet"`
	VyberID int    `json:"vyberId"`
	Tag     string `json:"tag"`
}

// Zmrazí aktuální obsah do běžného výběru fotek, nebo do tagu modelek; chytrý výběr zůstane
func (a *App) ZmrazitChytryVyber(id string) ZmrazeniVyberu {
	var v *ChytryVyber
	for _, x := range a.chytreVybery() {
		if x.ID == id {
			v = &x
			break
		}
	}
	if v == nil {
		return ZmrazeniVyberu{}
	}
	switch v.Druh {
	case DruhVyberuFotky:
		fotky, poradi := a.fotkyChytrehoVyberu(*v)
		ids := make([]int, len(poradi))
		for i, j := range poradi {
			ids[i] = fotky[j].f.ID
		}
		vyber := a.VyberPodleNazvu(v.Nazev)
		if vyber == 0 {
			return ZmrazeniVyberu{}
		}
		return ZmrazeniVyberu{Pocet: a.PridatDoVyberu(vyber, ids), VyberID: vyber}
	case DruhVyberuModelky:
		tag := v.Nazev
		zmeny := map[int]string{}
		for _, m := range a.modelkyChytrehoVyberu(*v) {
			if nove := sloucitSeznam(m.Tags, tag); nove != m.Tags {
				zmeny[m.ID] = nove
			}
		}
		if !a.vTransakci("zmrazení chytrého výběru", func(tx dotazovac) error {
			for id, tagy := range zmeny {
				if _, err := tx.Exec("UPDATE modelky SET tags = ? WHERE id = ?", tagy, id); err != nil {
					return err
				}
			}
			return nil
		}) {
			return ZmrazeniVyberu{}
		}
		return ZmrazeniVyberu{Pocet: len(zmeny), Tag: tag}
	}
	return ZmrazeniVyberu{}
}

// Export: chytré výběry v nepovinné části nastaveni (bez ID; při importu dostanou nová)
type exportNastaveni struct {
	ChytreVybery []ChytryVyber `yaml:"chytre_vybery,omitempty"`
}

func (a *App) exportovatNastaveni() *exportNastaveni {
	v := a.chytreVybery()
	if len(v) == 0 {
		return nil
	}
	for i := range v {
		v[i].ID = ""
	}
	return &exportNastaveni{ChytreVybery: v}
}

// Import: výběr se stejným druhem a názvem se přepíše, ostatní přibudou; vrací počet importovaných
func (a *App) importovatNastaveni(n *exportNastaveni) int {
	if n == nil || len(n.ChytreVybery) == 0 {
		return 0
	}
	stavajici := a.chytreVybery()
	pocet := 0
	// Od posledního, aby po importu zůstalo pořadí ze souboru (ukládá se na začátek)
	for i := len(n.ChytreVybery) - 1; i >= 0; i-- {
		v := n.ChytreVybery[i]
		v.ID = ""
		for _, x := range stavajici {
			if x.Druh == v.Druh && zjednodusit(x.Nazev) == zjednodusit(strings.TrimSpace(v.Nazev)) {
				v.ID = x.ID
			}
		}
		if a.UlozitChytryVyber(v).ID != "" {
			pocet++
		}
	}
	return pocet
}
