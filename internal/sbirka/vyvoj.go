package sbirka

import (
	"math"
	"pinup-katalog/internal/hledani"
	"sort"
	"strings"
)

// Kvantil seřazených hodnot s lineární interpolací (q 0–1).
func Kvantil(serazene []float64, q float64) float64 {
	if len(serazene) == 0 {
		return 0
	}
	poz := q * float64(len(serazene)-1)
	dolni := int(math.Floor(poz))
	horni := int(math.Ceil(poz))
	return serazene[dolni] + (serazene[horni]-serazene[dolni])*(poz-float64(dolni))
}

// BodyVyvoje vrátí body řady po obdobích dané délky (10 nebo 5 let); období bez hodnot se vynechají.
func BodyVyvoje(hodnoty map[int][]float64, delka int) []BodVyvoje {
	podleObdobi := map[int][]float64{}
	for rok, h := range hodnoty {
		obdobi := rok / delka * delka
		podleObdobi[obdobi] = append(podleObdobi[obdobi], h...)
	}
	body := make([]BodVyvoje, 0, len(podleObdobi))
	for obdobi, h := range podleObdobi {
		sort.Float64s(h)
		body = append(body, BodVyvoje{
			Obdobi: obdobi,
			Median: Kvantil(h, 0.5),
			Dolni:  Kvantil(h, 0.25),
			Horni:  Kvantil(h, 0.75),
			N:      len(h),
		})
	}
	sort.Slice(body, func(i, j int) bool { return body[i].Obdobi < body[j].Obdobi })
	return body
}

// SkupinaVlasu převede barvu vlasů z volného textu do skupiny; prázdná = neuvedeno.
func SkupinaVlasu(text string) string {
	t := hledani.Zjednodusit(text)
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

// AnoNe převede číselnou hodnotu 1/0 na "Ano"/"Ne".
func AnoNe(hodnota int) string {
	switch hodnota {
	case 1:
		return "Ano"
	case 0:
		return "Ne"
	}
	return ""
}

func obsahuje(seznam []string, hodnota string) bool {
	for _, s := range seznam {
		if s == hodnota {
			return true
		}
	}
	return false
}

// SpocitatVyvojVCase spočítá vývoj modelek v čase pro Statistiky čistě v paměti nad snímkem sbírky.
func SpocitatVyvojVCase(edice string, modelky []hledani.Modelka, alba []AlbumSbirky) VyvojVCase {
	if edice != "CZ" {
		edice = "US"
	}
	v := VyvojVCase{Edice: edice, Desetileti: []int{}, Ciselne: []RadaVyvoje{}, Podily: []KategorieVyvoje{}}

	// Rok (a vydání) prvního centerfoldu každé modelky v edici přímo ze snímku alb (bez SQL dotazu)
	centerfold := map[int]string{}
	for i := range alba {
		al := &alba[i]
		if al.Typ == "Centerfold" && al.ModelkaID != 0 {
			if _, mesic, ed, ok := CastiVydani(al.Vydani); ok && mesic > 0 && ed == edice {
				if stary, uz := centerfold[al.ModelkaID]; !uz || al.Vydani < stary {
					centerfold[al.ModelkaID] = al.Vydani
				}
			}
		}
	}

	type ciselny struct {
		klic, nazev, jednotka string
		odvozene              bool
		desetinna             int
		hodnota               func(m hledani.Modelka, vydani string) float64
	}
	ciselne := []ciselny{
		{"vek", "Věk", "let", false, 1, func(m hledani.Modelka, vydani string) float64 { return float64(VekKVydani(m.NarozeniDatum, vydani)) }},
		{"vyska", "Výška", "cm", false, 1, func(m hledani.Modelka, _ string) float64 { return float64(m.VyskaCm) }},
		{"vaha", "Váha", "kg", false, 1, func(m hledani.Modelka, _ string) float64 { return float64(m.VahaKg) }},
		{"hrudnik", "Hrudník", "cm", false, 1, func(m hledani.Modelka, _ string) float64 { return float64(m.ObvodHrudnikCm) }},
		{"pas", "Pas", "cm", false, 1, func(m hledani.Modelka, _ string) float64 { return float64(m.ObvodPasCm) }},
		{"boky", "Boky", "cm", false, 1, func(m hledani.Modelka, _ string) float64 { return float64(m.ObvodBokyCm) }},
		{"bmi", "BMI", "kg/m²", true, 1, func(m hledani.Modelka, _ string) float64 {
			if m.VyskaCm <= 0 || m.VahaKg <= 0 {
				return 0
			}
			metry := float64(m.VyskaCm) / 100
			return float64(m.VahaKg) / (metry * metry)
		}},
		{"whr", "Pas : boky", "poměr", true, 2, func(m hledani.Modelka, _ string) float64 {
			if m.ObvodPasCm <= 0 || m.ObvodBokyCm <= 0 {
				return 0
			}
			return float64(m.ObvodPasCm) / float64(m.ObvodBokyCm)
		}},
	}
	type podilovy struct {
		klic, nazev, radek, nazevRadku string
		kategorie                      []string
		hodnota                        func(m hledani.Modelka) string
	}
	podilove := []podilovy{
		{"vlasy", "Vlasy", "Blond", "Blond vlasy", []string{"Blond", "Hnědé", "Černé", "Zrzavé", "Jiné"}, func(m hledani.Modelka) string { return SkupinaVlasu(m.VlasyBarva) }},
		{"ochlupeni", "Ochlupení", "Oholené", "Oholené ochlupení", []string{"Přírodní", "Zastřižené", "Oholené"}, func(m hledani.Modelka) string { return strings.TrimSpace(m.Ochlupeni) }},
		{"prsa", "Prsa", "Silikonová", "Silikonová prsa", []string{"Přírodní", "Silikonová"}, func(m hledani.Modelka) string { return strings.TrimSpace(m.PrsaTyp) }},
		{"tetovani", "Tetování", "Ano", "Tetování", []string{"Ano", "Ne"}, func(m hledani.Modelka) string { return AnoNe(m.Tetovani) }},
		{"piercing", "Piercing", "Ano", "Piercing", []string{"Ano", "Ne"}, func(m hledani.Modelka) string { return AnoNe(m.Piercing) }},
	}

	hodnoty := make([]map[int][]float64, len(ciselne))
	for i := range hodnoty {
		hodnoty[i] = map[int][]float64{}
	}
	pocty := make([]map[int]map[string]int, len(podilove))
	for i := range pocty {
		pocty[i] = map[int]map[string]int{}
	}
	chybiCiselne := make([][]int, len(ciselne))
	chybiPodily := make([][]int, len(podilove))
	desetileti := map[int]bool{}
	for i := range modelky {
		m := modelky[i]
		vydani, ma := centerfold[m.ID]
		if !ma {
			continue
		}
		rok, _, _, _ := CastiVydani(vydani)
		v.Modelek++
		desetileti[rok/10*10] = true
		for idx, c := range ciselne {
			if h := c.hodnota(m, vydani); h > 0 {
				hodnoty[idx][rok] = append(hodnoty[idx][rok], h)
			} else {
				chybiCiselne[idx] = append(chybiCiselne[idx], m.ID)
			}
		}
		for idx, p := range podilove {
			h := p.hodnota(m)
			if h == "" || !obsahuje(p.kategorie, h) {
				chybiPodily[idx] = append(chybiPodily[idx], m.ID)
				continue
			}
			dek := rok / 10 * 10
			if pocty[idx][dek] == nil {
				pocty[idx][dek] = map[string]int{}
			}
			pocty[idx][dek][h]++
		}
	}
	for d := range desetileti {
		v.Desetileti = append(v.Desetileti, d)
	}
	sort.Ints(v.Desetileti)

	for i, c := range ciselne {
		chybi := append([]int{}, chybiCiselne[i]...)
		v.Ciselne = append(v.Ciselne, RadaVyvoje{
			Klic: c.klic, Nazev: c.nazev, Jednotka: c.jednotka, Odvozene: c.odvozene, Desetinna: c.desetinna,
			Znamych: v.Modelek - len(chybi), Chybi: chybi, Desetileti: BodyVyvoje(hodnoty[i], 10), Petileti: BodyVyvoje(hodnoty[i], 5),
		})
	}
	for i, p := range podilove {
		chybi := append([]int{}, chybiPodily[i]...)
		k := KategorieVyvoje{
			Klic: p.klic, Nazev: p.nazev, Kategorie: p.kategorie, Radek: p.radek, NazevRadku: p.nazevRadku,
			Znamych: v.Modelek - len(chybi), Chybi: chybi, Desetileti: []PodilVyvoje{},
		}
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
