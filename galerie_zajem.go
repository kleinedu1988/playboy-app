package main

// Osobní pořadí řad kolekcí v Galerii (docs/NAVRH-GALERIE-KOLEKCE.md): program si pamatuje, které kolekce otevíráš
// (Zobrazit vše, Celá kolekce, panel kolekcí, uložený výběr) a na které fotky v řadách klikáš, a takové kolekce
// i jejich skupinu dává výš. Řady, které se ukazují dny bez povšimnutí, mírně klesají. Zájem vyprchává
// (poločas 30 dní). Ukládá se jako JSON v tabulce nastaveni (klíč galerie_zajem) – schéma ani export se nemění.

import (
	"encoding/json"
	"math"
	"strings"
	"sync"
	"time"
)

const (
	klicZajmuKolekci    = "galerie_zajem"
	polocasZajmuKolekci = 30.0 // dní
	bodyOtevreni        = 1.0
	bodyFotky           = 0.3
	tolerovanoDnu       = 3 // tolik dní bez povšimnutí řada neklesá
	maxZaznamuZajmu     = 300
)

// Zájem o jednu kolekci
type zajemKolekce struct {
	Body       float64 `json:"b"` // body k datu Den (otevření 1, fotka z řady 0,3)
	Den        string  `json:"d"` // poslední zájem
	Prehlizeno int     `json:"z"` // dní, kdy se řada ukázala bez zájmu (od posledního zájmu)
	Ukazano    string  `json:"u"` // poslední den, kdy se řada ukázala
}

var zajemMu sync.Mutex

func (a *App) nacistZajem() map[string]*zajemKolekce {
	m := map[string]*zajemKolekce{}
	if json.Unmarshal([]byte(a.nastaveni(klicZajmuKolekci)), &m) != nil || m == nil {
		return map[string]*zajemKolekce{}
	}
	return m
}

func (a *App) ulozitZajem(m map[string]*zajemKolekce) {
	// Nejvýš maxZaznamuZajmu kolekcí (nejstarší zájem pryč) – denní kolekce (rok, fotograf) jinak přibývají
	for len(m) > maxZaznamuZajmu {
		nej, nejDen := "", "9999"
		for k, z := range m {
			if d := max(z.Den, z.Ukazano); d < nejDen {
				nej, nejDen = k, d
			}
		}
		delete(m, nej)
	}
	if data, err := json.Marshal(m); err == nil {
		if err := a.ulozitNastaveni(klicZajmuKolekci, string(data)); err != nil {
			a.chyba("uložení zájmu o kolekce", err)
		}
	}
}

// Body ke dni nyni (vyprchávání s poločasem)
func (z *zajemKolekce) bodyK(nyni time.Time) float64 {
	if z == nil || z.Body == 0 {
		return 0
	}
	den, err := time.ParseInLocation("2006-01-02", z.Den, nyni.Location())
	if err != nil {
		return 0
	}
	return z.Body * math.Pow(0.5, math.Max(0, nyni.Sub(den).Hours()/24)/polocasZajmuKolekci)
}

// ZaznamenatKolekci: zájem o kolekci z Galerie; akce "otevreni" (celá kolekce) nebo "fotka" (fotka z řady)
func (a *App) ZaznamenatKolekci(klic, akce string) {
	if a.db == nil || klic == "" || len(klic) > 120 {
		return
	}
	body := bodyFotky
	if akce == "otevreni" {
		body = bodyOtevreni
	}
	nyni := time.Now()
	zajemMu.Lock()
	defer zajemMu.Unlock()
	m := a.nacistZajem()
	z := m[klic]
	if z == nil {
		z = &zajemKolekce{}
		m[klic] = z
	}
	z.Body, z.Den, z.Prehlizeno = z.bodyK(nyni)+body, nyni.Format("2006-01-02"), 0
	a.ulozitZajem(m)
}

// Ukázané řady: den bez zájmu se počítá jednou denně (a jen dokud o řadu nebyl ten den zájem)
func (a *App) zaznamenatUkazaneRady(klice []string, nyni time.Time) {
	den := nyni.Format("2006-01-02")
	zajemMu.Lock()
	defer zajemMu.Unlock()
	m := a.nacistZajem()
	zmena := false
	for _, k := range klice {
		z := m[k]
		if z == nil {
			z = &zajemKolekce{}
			m[k] = z
		}
		if z.Ukazano == den {
			continue
		}
		z.Ukazano = den
		if z.Den != den {
			z.Prehlizeno++
		}
		zmena = true
	}
	if zmena {
		a.ulozitZajem(m)
	}
}

// Násobitele hodnoty kolekcí podle zájmu: kolekce až ×1,6, skupina až ×1,2, přehlížená řada až ×0,7
type nasobitelZajmu struct {
	kolekce map[string]float64
	skupina map[string]float64
	nyni    time.Time
	data    map[string]*zajemKolekce
}

func (a *App) zajemKolekci(nyni time.Time) *nasobitelZajmu {
	zajemMu.Lock()
	m := a.nacistZajem()
	zajemMu.Unlock()
	n := &nasobitelZajmu{kolekce: map[string]float64{}, skupina: map[string]float64{}, nyni: nyni, data: m}
	for k, z := range m {
		b := z.bodyK(nyni)
		n.kolekce[k] = b
		n.skupina[skupinaKlice(k)] += b
	}
	return n
}

func skupinaKlice(klic string) string {
	skupina, _, _ := strings.Cut(klic, ":")
	return skupina
}

func (n *nasobitelZajmu) nasobitel(klic string) float64 {
	x := (1 + 0.6*math.Tanh(n.kolekce[klic]/3)) * (1 + 0.2*math.Tanh(n.skupina[skupinaKlice(klic)]/6))
	if z := n.data[klic]; z != nil && z.Prehlizeno > tolerovanoDnu {
		x *= math.Max(0.7, 1-0.03*float64(z.Prehlizeno-tolerovanoDnu))
	}
	return x
}

// Oblíbená kolekce (štítek u řady): aspoň ~2 nedávná otevření
func (n *nasobitelZajmu) oblibena(klic string) bool {
	return n.kolekce[klic] >= 1.8
}
