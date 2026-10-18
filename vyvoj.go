package main

import (
	"math"
	"sort"
	"strings"
)

// Vývoj modelek v čase pro Statistiky: věk v době centerfoldu, postava a podíly (vlasy, ochlupení, prsa, tetování)
// po desetiletích (tabulka) a po pětiletích (graf). Čas je rok centerfoldu modelky v dané edici; modelka bez
// centerfoldu v edici se nepočítá. Číselné údaje jsou medián s dolním a horním kvartilem (prostřední polovina
// modelek), u každého období je počet modelek se známým údajem. Nic se neukládá, počítá se při otevření.

// Číselný údaj v jednom období: medián, kvartily a počet modelek se známou hodnotou
type BodVyvoje struct {
	Obdobi int     `json:"obdobi"` // první rok období (1970 = 1970–1979, u pětiletí 1975 = 1975–1979)
	Median float64 `json:"median"`
	Dolni  float64 `json:"dolni"`
	Horni  float64 `json:"horni"`
	N      int     `json:"n"`
}

type RadaVyvoje struct {
	Klic       string      `json:"klic"`
	Nazev      string      `json:"nazev"`
	Jednotka   string      `json:"jednotka"`
	Desetileti []BodVyvoje `json:"desetileti"`
	Petileti   []BodVyvoje `json:"petileti"`
}

// Podíl kategorií v jednom období: počet modelek v každé kategorii (bez neuvedených) a celkem se známým údajem
type PodilVyvoje struct {
	Obdobi int            `json:"obdobi"`
	Pocty  map[string]int `json:"pocty"`
	N      int            `json:"n"`
}

type KategorieVyvoje struct {
	Klic       string        `json:"klic"`
	Nazev      string        `json:"nazev"`
	Kategorie  []string      `json:"kategorie"`  // pořadí v grafu
	Radek      string        `json:"radek"`      // kategorie, jejíž podíl ukazuje řádek tabulky
	NazevRadku string        `json:"nazevRadku"` // popis řádku tabulky (např. „Blond vlasy“)
	Desetileti []PodilVyvoje `json:"desetileti"`
}

type VyvojVCase struct {
	Edice      string            `json:"edice"`
	Desetileti []int             `json:"desetileti"`
	Modelek    int               `json:"modelek"` // modelek s centerfoldem v edici
	Ciselne    []RadaVyvoje      `json:"ciselne"`
	Podily     []KategorieVyvoje `json:"podily"`
}

// Kvantil seřazených hodnot s lineární interpolací (q 0–1)
func kvantil(serazene []float64, q float64) float64 {
	if len(serazene) == 0 {
		return 0
	}
	poz := q * float64(len(serazene)-1)
	dolni := int(math.Floor(poz))
	horni := int(math.Ceil(poz))
	return serazene[dolni] + (serazene[horni]-serazene[dolni])*(poz-float64(dolni))
}

// Body řady po obdobích dané délky (10 nebo 5 let); období bez hodnot se vynechají
func bodyVyvoje(hodnoty map[int][]float64, delka int) []BodVyvoje {
	podleObdobi := map[int][]float64{}
	for rok, h := range hodnoty {
		obdobi := rok / delka * delka
		podleObdobi[obdobi] = append(podleObdobi[obdobi], h...)
	}
	body := []BodVyvoje{}
	for obdobi, h := range podleObdobi {
		sort.Float64s(h)
		body = append(body, BodVyvoje{Obdobi: obdobi, Median: kvantil(h, 0.5), Dolni: kvantil(h, 0.25), Horni: kvantil(h, 0.75), N: len(h)})
	}
	sort.Slice(body, func(i, j int) bool { return body[i].Obdobi < body[j].Obdobi })
	return body
}

// Barva vlasů z volného textu do skupiny; prázdná = neuvedeno
func skupinaVlasu(text string) string {
	t := zjednodusit(text)
	switch {
	case t == "":
		return ""
	case strings.Contains(t, "blond") || strings.Contains(t, "plav"):
		return "Blond"
	case strings.Contains(t, "zrz") || strings.Contains(t, "red") || strings.Contains(t, "rus") || strings.Contains(t, "auburn") || strings.Contains(t, "rezav"):
		return "Zrzavé"
	case strings.Contains(t, "cern") || strings.Contains(t, "black"):
		return "Černé"
	case strings.Contains(t, "hned") || strings.Contains(t, "brown") || strings.Contains(t, "brunet") || strings.Contains(t, "kastan") || strings.Contains(t, "brun"):
		return "Hnědé"
	}
	return "Jiné"
}

func anoNe(hodnota int) string {
	switch hodnota {
	case 1:
		return "Ano"
	case 0:
		return "Ne"
	}
	return ""
}

func (a *App) GetVyvojVCase(edice string) VyvojVCase {
	if edice != "CZ" {
		edice = "US"
	}
	v := VyvojVCase{Edice: edice, Desetileti: []int{}, Ciselne: []RadaVyvoje{}, Podily: []KategorieVyvoje{}}

	// Rok (a vydání) prvního centerfoldu každé modelky v edici
	centerfold := map[int]string{}
	rows, err := a.db.Query(`SELECT modelka_id, vydani FROM alba WHERE typ = 'Centerfold' AND modelka_id IS NOT NULL ORDER BY vydani`)
	if err != nil {
		a.chyba("GetVyvojVCase", err)
		return v
	}
	for rows.Next() {
		var id int
		var vydani string
		if rows.Scan(&id, &vydani) != nil {
			continue
		}
		if _, mesic, ed, ok := castiVydani(vydani); ok && mesic > 0 && ed == edice {
			if _, uz := centerfold[id]; !uz {
				centerfold[id] = vydani
			}
		}
	}
	rows.Close()

	type ciselny struct {
		klic, nazev, jednotka string
		hodnota               func(m Modelka, vydani string) float64
	}
	ciselne := []ciselny{
		{"vek", "Věk", "let", func(m Modelka, vydani string) float64 { return float64(vekKVydani(m.NarozeniDatum, vydani)) }},
		{"vyska", "Výška", "cm", func(m Modelka, _ string) float64 { return float64(m.VyskaCm) }},
		{"vaha", "Váha", "kg", func(m Modelka, _ string) float64 { return float64(m.VahaKg) }},
		{"hrudnik", "Hrudník", "cm", func(m Modelka, _ string) float64 { return float64(m.ObvodHrudnikCm) }},
		{"pas", "Pas", "cm", func(m Modelka, _ string) float64 { return float64(m.ObvodPasCm) }},
		{"boky", "Boky", "cm", func(m Modelka, _ string) float64 { return float64(m.ObvodBokyCm) }},
	}
	type podilovy struct {
		klic, nazev, radek, nazevRadku string
		kategorie                      []string
		hodnota                        func(m Modelka) string
	}
	podilove := []podilovy{
		{"vlasy", "Vlasy", "Blond", "Blond vlasy", []string{"Blond", "Hnědé", "Černé", "Zrzavé", "Jiné"}, func(m Modelka) string { return skupinaVlasu(m.VlasyBarva) }},
		{"ochlupeni", "Ochlupení", "Oholené", "Oholené ochlupení", []string{"Přírodní", "Zastřižené", "Oholené"}, func(m Modelka) string { return strings.TrimSpace(m.Ochlupeni) }},
		{"prsa", "Prsa", "Silikonová", "Silikonová prsa", []string{"Přírodní", "Silikonová"}, func(m Modelka) string { return strings.TrimSpace(m.PrsaTyp) }},
		{"tetovani", "Tetování", "Ano", "Tetování", []string{"Ano", "Ne"}, func(m Modelka) string { return anoNe(m.Tetovani) }},
		{"piercing", "Piercing", "Ano", "Piercing", []string{"Ano", "Ne"}, func(m Modelka) string { return anoNe(m.Piercing) }},
	}

	hodnoty := make([]map[int][]float64, len(ciselne))
	for i := range hodnoty {
		hodnoty[i] = map[int][]float64{}
	}
	pocty := make([]map[int]map[string]int, len(podilove))
	for i := range pocty {
		pocty[i] = map[int]map[string]int{}
	}
	desetileti := map[int]bool{}
	for _, m := range a.GetModelky("") {
		vydani, ma := centerfold[m.ID]
		if !ma {
			continue
		}
		rok, _, _, _ := castiVydani(vydani)
		v.Modelek++
		desetileti[rok/10*10] = true
		for i, c := range ciselne {
			if h := c.hodnota(m, vydani); h > 0 {
				hodnoty[i][rok] = append(hodnoty[i][rok], h)
			}
		}
		for i, p := range podilove {
			// Hodnota mimo známé kategorie (starý zápis) se nepočítá, aby podíly dávaly 100 %
			h := p.hodnota(m)
			if h == "" || !obsahuje(p.kategorie, h) {
				continue
			}
			dek := rok / 10 * 10
			if pocty[i][dek] == nil {
				pocty[i][dek] = map[string]int{}
			}
			pocty[i][dek][h]++
		}
	}
	for d := range desetileti {
		v.Desetileti = append(v.Desetileti, d)
	}
	sort.Ints(v.Desetileti)

	for i, c := range ciselne {
		v.Ciselne = append(v.Ciselne, RadaVyvoje{Klic: c.klic, Nazev: c.nazev, Jednotka: c.jednotka,
			Desetileti: bodyVyvoje(hodnoty[i], 10), Petileti: bodyVyvoje(hodnoty[i], 5)})
	}
	for i, p := range podilove {
		k := KategorieVyvoje{Klic: p.klic, Nazev: p.nazev, Kategorie: p.kategorie, Radek: p.radek, NazevRadku: p.nazevRadku, Desetileti: []PodilVyvoje{}}
		for _, d := range v.Desetileti {
			bod := PodilVyvoje{Obdobi: d, Pocty: map[string]int{}}
			for kat, n := range pocty[i][d] {
				bod.Pocty[kat] = n
				bod.N += n
			}
			k.Desetileti = append(k.Desetileti, bod)
		}
		v.Podily = append(v.Podily, k)
	}
	return v
}

func obsahuje(seznam []string, hodnota string) bool {
	for _, s := range seznam {
		if s == hodnota {
			return true
		}
	}
	return false
}
