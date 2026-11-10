package main

// Hledání slovy v Galerii (docs/NAVRH-GALERIE-KOLEKCE.md, bod 5): text, kterému neodpovídá jméno modelky, album
// ani fotograf, se hledá v obsahu fotek – český textový model (internal/obsah/text_cs.go) z něj spočítá vektor
// a fotky se seřadí podle podobnosti. Podobnost obrázku a textu má u každého dotazu jiné rozložení (průměr ~0,2),
// proto se ukážou fotky, které nad průměrem sbírky vyčnívají aspoň o minVycnivani směrodatné odchylky; když ani
// nejlepší nevyčnívá o minVycnivaniNej, text v obsahu nic neznamená (nesmysl, překlep) a výsledek je prázdný
// (ověřeno na sbírce: skutečné dotazy 3,4–8, nesmysly 3,1–3,25). Jméno modelky v textu
// („Pamela na pláži“) omezí hledání na její fotky (ty se jen seřadí podle shody) a z textu pro obsah se vynechá.
// Hovorová slova, která model zná špatně („zrzka“), se nahradí popisem („zrzavé vlasy“).

import (
	"math"
	"sort"
	"strings"

	"pinup-katalog/internal/obsah"
)

const (
	minVycnivani    = 2.8
	minVycnivaniNej = 3.3
	maxFotekSlovy   = 1000
)

type hledaniSlovy struct {
	podobnost map[string]float64 // nil = neuplatní se
	prumer    float64            // rozložení podobnosti v celé sbírce
	odchylka  float64
	modelka   int
	jmeno     string
	nabidnout bool
}

func (a *App) hledatSlovy(fotky []fotkaGalerie, puvodni string, slova []string) hledaniSlovy {
	var v hledaniSlovy
	if len(slova) == 0 || a.obsah == nil || !a.obsah.Zapnuto() {
		return v
	}
	for i := range fotky {
		vse := true
		for _, t := range slova {
			if !strings.Contains(fotky[i].hledat, t) {
				vse = false
				break
			}
		}
		if vse {
			return v // odpovídá jménu, albu nebo fotografovi – hledá se jako dosud
		}
	}
	if !a.obsah.StavHledaniSlovy().Pripraveno {
		v.nabidnout = true
		return v
	}
	// Nejdelší jméno modelky, které je v textu celé (bez diakritiky, jako celá slova)
	text := " " + strings.Join(slova, " ") + " "
	zbytek := puvodni
	for i := range fotky {
		f := fotky[i].f
		jmeno := zjednodusit(f.JmenoModelky)
		if len([]rune(jmeno)) < 4 || len(jmeno) <= len(zjednodusit(v.jmeno)) || !strings.Contains(text, " "+jmeno+" ") {
			continue
		}
		v.modelka, v.jmeno = f.ModelkaID, f.JmenoModelky
	}
	if v.modelka > 0 {
		zbytek = odebratJmeno(puvodni, v.jmeno)
	}
	if strings.TrimSpace(zbytek) == "" {
		return hledaniSlovy{}
	}
	vektor := a.obsah.VektorTextu(rozepsat(zbytek))
	if vektor == nil {
		return hledaniSlovy{}
	}
	v.podobnost = a.obsah.PodobnostiKTextu(vektor)
	if len(v.podobnost) == 0 {
		return hledaniSlovy{}
	}
	v.prumer, v.odchylka = rozlozeni(v.podobnost)
	return v
}

// Hovorová slova → popis, kterému textový model rozumí (jednoslovné výrazy pro vlasy zná špatně)
var popisySlov = map[string]string{
	"zrzka": "zrzavé vlasy", "zrzky": "zrzavé vlasy", "zrzku": "zrzavé vlasy", "zrzek": "zrzavé vlasy",
	"blondynka": "blond vlasy", "blondynky": "blond vlasy", "blondynku": "blond vlasy", "blondyna": "blond vlasy",
	"brunetka": "hnědé vlasy", "brunetky": "hnědé vlasy", "brunetku": "hnědé vlasy",
	"cernovlaska": "černé vlasy", "cernovlasky": "černé vlasy", "cernovlasku": "černé vlasy",
}

func rozepsat(text string) string {
	slova := strings.Fields(text)
	for i, s := range slova {
		if p, ok := popisySlov[zjednodusit(strings.Trim(s, ",.!?;:"))]; ok {
			slova[i] = p
		}
	}
	return strings.Join(slova, " ")
}

// Text bez jména modelky (slova jména vynechaná bez ohledu na velikost písmen a diakritiku)
func odebratJmeno(text, jmeno string) string {
	vynechat := map[string]bool{}
	for _, s := range strings.Fields(zjednodusit(jmeno)) {
		vynechat[s] = true
	}
	var zbytek []string
	for _, s := range strings.Fields(text) {
		if !vynechat[zjednodusit(s)] {
			zbytek = append(zbytek, s)
		}
	}
	return strings.Join(zbytek, " ")
}

// Fotky podle podobnosti k textu (stejné fotky pod různými ID jen jednou), jen dost blízko nejlepší, promíchané alby
func (h hledaniSlovy) seradit(vybrane []int, fotky []fotkaGalerie) []int {
	var s []int
	for _, i := range vybrane {
		if _, ok := h.podobnost[fotky[i].f.DriveID]; ok {
			s = append(s, i)
		}
	}
	sort.SliceStable(s, func(i, j int) bool {
		return h.podobnost[fotky[s[i]].f.DriveID] > h.podobnost[fotky[s[j]].f.DriveID]
	})
	if len(s) == 0 || h.odchylka == 0 {
		return []int{}
	}
	// Fotky poznané modelky: všechny, jen seřazené podle shody (práh sbírky by jich většinu skryl)
	if h.modelka > 0 {
		return s
	}
	nej := 0.0
	for _, x := range h.podobnost {
		nej = max(nej, x)
	}
	if nej < h.prumer+minVycnivaniNej*h.odchylka {
		return []int{}
	}
	prah := h.prumer + minVycnivani*h.odchylka
	konec := 0
	for konec < len(s) && konec < maxFotekSlovy && h.podobnost[fotky[s[konec]].f.DriveID] >= prah {
		konec++
	}
	return promichatAlba(s[:konec], fotky)
}

// Stav hledání slovy (stažený textový model, průběh stahování)
func (a *App) GetStavHledaniSlovy() obsah.StavTextu {
	return a.obsah.StavHledaniSlovy()
}

// Zapne hledání slovy: stáhne český textový model (~274 MB, jednou) na pozadí; false bez složky dat
func (a *App) ZapnoutHledaniSlovy() bool {
	return a.obsah.ZapnoutHledaniSlovy()
}

// Průměr a směrodatná odchylka podobností
func rozlozeni(p map[string]float64) (prumer, odchylka float64) {
	if len(p) == 0 {
		return 0, 0
	}
	for _, x := range p {
		prumer += x
	}
	prumer /= float64(len(p))
	for _, x := range p {
		odchylka += (x - prumer) * (x - prumer)
	}
	return prumer, math.Sqrt(odchylka / float64(len(p)))
}
