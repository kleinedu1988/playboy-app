package main

// Tvoje ideální modelka (obrazně): co z tvých srdíček vyplývá o vkusu. Každá vlastnost (vlasy, původ, éra, věk při
// focení, kariéra, objevený styl, barvy, prostředí a oblečení – kolekce z galerie_kolekce.go) se porovná: jak velký
// podíl má mezi fotkami, které hodnotíš ♥4+ (♥5 váží dvakrát), proti podílu v celé sbírce. Poměr nad 1 = máš ji
// rád víc, než odpovídá sbírce. K tomu modelky a fotky obsahem nejblíž „středu“ tvých ♥4+ fotek.

import (
	"math"
	"sort"
	"strings"
	"time"
)

// Vlastnost vkusu: podíl mezi oblíbenými fotkami proti podílu ve sbírce; Klic = kolekce v Galerii (prázdný u éry
// a věku, ty se otevírají filtrem)
type VlastnostVkusu struct {
	Skupina string  `json:"skupina"`
	Hodnota string  `json:"hodnota"`
	Klic    string  `json:"klic"`
	Podil   float64 `json:"podil"`  // mezi oblíbenými (0–1)
	Prumer  float64 `json:"prumer"` // ve sbírce (0–1)
	Pomer   float64 `json:"pomer"`
}

type ModelkaIdealu struct {
	ModelkaID int        `json:"modelkaId"`
	Jmeno     string     `json:"jmeno"`
	Shoda     float64    `json:"shoda"` // 0–100: jak blízko jsou její nejbližší fotky tvému středu (proti nejbližší modelce)
	Fotka     Fotografie `json:"fotka"`
}

type IdealniModelka struct {
	Oblibenych int              `json:"oblibenych"` // fotek ♥4+
	Malo       bool             `json:"malo"`       // málo hodnocených fotek na závěry
	Profil     []VlastnostVkusu `json:"profil"`     // nejvýraznější hodnota v každé skupině vlastností modelky
	Milujes    []VlastnostVkusu `json:"milujes"`    // styly, barvy a obsah, které hodnotíš nejvíc nad průměr
	Mijis      []VlastnostVkusu `json:"mijis"`      // časté ve sbírce, ale mezi oblíbenými skoro nejsou
	Nejblize   []ModelkaIdealu  `json:"nejblize"`
	Dokonala   *Fotografie      `json:"dokonala"` // tvoje ♥4+ fotka nejblíž středu vkusu (nejtypičtější)
	Objev      *Fotografie      `json:"objev"`    // nejbližší nehodnocená – ještě jsi ji neviděl
}

const (
	minOblibenychVkusu = 20
	minFotekVlastnosti = 30  // vlastnost s méně fotkami ve sbírce nic neříká
	minOblibenychVlast = 3   // a aspoň tolik oblíbených fotek
	minPomerMilujes    = 1.2 // „miluješ“: aspoň o 20 % víc než ve sbírce
	maxPomerMijis      = 0.6
)

// Skupiny profilu ideální modelky (z kolekcí vzhledu a kariéry, éra a věk zvlášť), v pořadí na kartě
var skupinyProfilu = []struct{ predpona, nazev string }{
	{"vzhled:vlasy:", "Vlasy"}, {"vzhled:oblast:", "Původ"}, {"era:", "Éra"}, {"vek:", "Věk při focení"},
	{"vzhled:tetovani", "Tetování"}, {"vzhled:piercing", "Piercing"}, {"kariera:", "Kariéra"},
}

func pasmoVeku(vek int) string {
	switch {
	case vek == 0:
		return ""
	case vek <= 21:
		return "18–21 let"
	case vek <= 25:
		return "22–25 let"
	case vek <= 29:
		return "26–29 let"
	default:
		return "30 a víc let"
	}
}

func (a *App) GetIdealniModelka() IdealniModelka {
	v := IdealniModelka{Profil: []VlastnostVkusu{}, Milujes: []VlastnostVkusu{}, Mijis: []VlastnostVkusu{}, Nejblize: []ModelkaIdealu{}}
	if a.db == nil {
		return v
	}
	fotky := a.fotkyGalerieVPameti()
	dk := a.dataKolekci(fotky)
	vahy := make([]float64, len(fotky))
	var celkemVah float64
	var oblibene []string
	for i := range fotky {
		if h := fotky[i].f.Hodnoceni; h >= 4 {
			vahy[i] = float64(h - 3)
			celkemVah += vahy[i]
			oblibene = append(oblibene, fotky[i].f.DriveID)
			v.Oblibenych++
		}
	}
	if v.Oblibenych < minOblibenychVkusu {
		v.Malo = true
		return v
	}

	// Vlastnosti: kolekce (bez času a „tvoje“ – ty jsou o hodnocení samém) + éra + věkové pásmo
	type vlastnost struct {
		skupina, hodnota, klic string
		plati                  func(i int) bool
	}
	var vlastnosti []vlastnost
	for _, d := range a.definiceKolekci(fotky, dk, nyniVkusu()) {
		if d.skupina == "cas" || d.skupina == "tvoje" || strings.HasPrefix(d.klic, "kariera:fotograf") {
			continue
		}
		vlastnosti = append(vlastnosti, vlastnost{d.skupina, d.nazev, d.klic, func(i int) bool { return d.plati(&fotky[i]) }})
	}
	dekady := map[string]bool{}
	pasma := map[string]bool{}
	for i := range fotky {
		dekady[fotky[i].dekada] = true
		pasma[pasmoVeku(vekPriFoceni(dk.modelky[fotky[i].f.ModelkaID].narozeni, fotky[i].f))] = true
	}
	for d := range dekady {
		if len(d) == 4 {
			vlastnosti = append(vlastnosti, vlastnost{"era", d[2:] + ". léta", "era:" + d, func(i int) bool { return fotky[i].dekada == d }})
		}
	}
	for p := range pasma {
		if p != "" {
			vlastnosti = append(vlastnosti, vlastnost{"vek", p, "vek:" + p, func(i int) bool {
				return pasmoVeku(vekPriFoceni(dk.modelky[fotky[i].f.ModelkaID].narozeni, fotky[i].f)) == p
			}})
		}
	}

	var vysledky []VlastnostVkusu
	for _, x := range vlastnosti {
		n, oblib := 0, 0
		var vaha float64
		for i := range fotky {
			if !x.plati(i) {
				continue
			}
			n++
			if vahy[i] > 0 {
				oblib++
				vaha += vahy[i]
			}
		}
		if n < minFotekVlastnosti {
			continue
		}
		podil, prumer := vaha/celkemVah, float64(n)/float64(len(fotky))
		klic := x.klic
		if strings.HasPrefix(klic, "era:") || strings.HasPrefix(klic, "vek:") {
			klic = ""
		}
		r := VlastnostVkusu{Skupina: x.skupina, Hodnota: x.hodnota, Klic: klic, Podil: zaokrouhlit(podil), Prumer: zaokrouhlit(prumer), Pomer: math.Round(podil/prumer*100) / 100}
		puvodniKlic := x.klic
		// Profil: skupina podle předpony
		for _, sp := range skupinyProfilu {
			if strings.HasPrefix(puvodniKlic, sp.predpona) && oblib >= minOblibenychVlast {
				r.Skupina = sp.nazev
				vysledky = append(vysledky, r)
			}
		}
		// Styly, barvy a obsah fotek
		if x.skupina == "styl" || x.skupina == "barvy" || x.skupina == "obsah" {
			r.Skupina = map[string]string{"styl": "Styl", "barvy": "Barvy a světlo", "obsah": "Obsah fotek"}[x.skupina]
			if r.Pomer >= minPomerMilujes && oblib >= minOblibenychVlast {
				v.Milujes = append(v.Milujes, r)
			} else if r.Pomer <= maxPomerMijis && prumer >= 0.02 {
				v.Mijis = append(v.Mijis, r)
			}
		}
	}
	// Profil: v každé skupině hodnota s nejvyšším poměrem (u tetování a piercingu jen když je nad průměrem)
	for _, sp := range skupinyProfilu {
		var nej *VlastnostVkusu
		for i := range vysledky {
			r := &vysledky[i]
			if r.Skupina == sp.nazev && (nej == nil || r.Pomer > nej.Pomer) {
				nej = r
			}
		}
		// Bez vyhraněné preference (poměr pod 1,1; u tetování, piercingu a kariéry pod 1,2) skupina na kartě není
		prah := 1.1
		if sp.nazev == "Tetování" || sp.nazev == "Piercing" || sp.nazev == "Kariéra" {
			prah = minPomerMilujes
		}
		if nej == nil || nej.Pomer < prah {
			continue
		}
		v.Profil = append(v.Profil, *nej)
	}
	sort.SliceStable(v.Milujes, func(i, j int) bool { return v.Milujes[i].Pomer > v.Milujes[j].Pomer })
	sort.SliceStable(v.Mijis, func(i, j int) bool { return v.Mijis[i].Pomer < v.Mijis[j].Pomer })
	v.Milujes, v.Mijis = bezPodobnych(v.Milujes), bezPodobnych(v.Mijis)
	v.Milujes = v.Milujes[:min(len(v.Milujes), 8)]
	v.Mijis = v.Mijis[:min(len(v.Mijis), 5)]

	a.nejblizeIdealu(fotky, oblibene, &v)
	return v
}

// Modelky a fotky obsahem nejblíž středu tvých ♥4+ fotek (bez obsahu fotek nic)
func (a *App) nejblizeIdealu(fotky []fotkaGalerie, oblibene []string, v *IdealniModelka) {
	if a.obsah == nil || !a.obsah.Zapnuto() {
		return
	}
	podobnost := a.obsah.PodobnostiKeStredu(oblibene)
	if len(podobnost) == 0 {
		return
	}
	type modelka struct {
		jmeno    string
		nej      []float64
		fotka    Fotografie
		nejFotka float64
	}
	modelky := map[int]*modelka{}
	nejCelkem, nejObjev := -2.0, -2.0
	for i := range fotky {
		f := fotky[i].f
		p, ok := podobnost[f.DriveID]
		if !ok {
			continue
		}
		if f.Hodnoceni >= 4 && p > nejCelkem {
			nejCelkem, v.Dokonala = p, &fotky[i].f
		}
		if f.Hodnoceni == 0 && p > nejObjev {
			nejObjev, v.Objev = p, &fotky[i].f
		}
		m := modelky[f.ModelkaID]
		if m == nil {
			m = &modelka{jmeno: f.JmenoModelky, nejFotka: -2}
			modelky[f.ModelkaID] = m
		}
		m.nej = append(m.nej, p)
		if p > m.nejFotka {
			m.nejFotka, m.fotka = p, f
		}
	}
	// Modelka: průměr jejích 3 nejbližších fotek (jedna náhodně podobná fotka nestačí), aspoň 5 fotek s obsahem
	var poradi []ModelkaIdealu
	for id, m := range modelky {
		if len(m.nej) < 5 {
			continue
		}
		sort.Sort(sort.Reverse(sort.Float64Slice(m.nej)))
		poradi = append(poradi, ModelkaIdealu{ModelkaID: id, Jmeno: m.jmeno, Shoda: (m.nej[0] + m.nej[1] + m.nej[2]) / 3, Fotka: m.fotka})
	}
	sort.Slice(poradi, func(i, j int) bool { return poradi[i].Shoda > poradi[j].Shoda })
	poradi = poradi[:min(len(poradi), 6)]
	// Shoda v procentech proti rozpětí sbírky: nejbližší modelka 100, medián fotek 0
	if len(poradi) > 0 {
		hodnoty := make([]float64, 0, len(podobnost))
		for _, p := range podobnost {
			hodnoty = append(hodnoty, p)
		}
		sort.Float64s(hodnoty)
		median, nej := hodnoty[len(hodnoty)/2], poradi[0].Shoda
		for i := range poradi {
			poradi[i].Shoda = math.Round(math.Max(0, (poradi[i].Shoda-median)/(nej-median)) * 100)
		}
	}
	v.Nejblize = poradi
}

// Styl a obsah často pojmenují totéž („Auta“ a „Auta a motorky“): ze stejného prvního slova jen první (silnější)
func bezPodobnych(x []VlastnostVkusu) []VlastnostVkusu {
	videno := map[string]bool{}
	v := []VlastnostVkusu{}
	for _, r := range x {
		slova := strings.Fields(r.Hodnota)
		if len(slova) == 0 {
			continue
		}
		slovo := zjednodusit(slova[0])
		if videno[slovo] {
			continue
		}
		videno[slovo] = true
		v = append(v, r)
	}
	return v
}

func zaokrouhlit(x float64) float64 { return math.Round(x*1000) / 1000 }

// Čas pro definice kolekcí (denní kolekce se vynechávají, na dni nezáleží)
var nyniVkusu = func() time.Time { return time.Now() }
