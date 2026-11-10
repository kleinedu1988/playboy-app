package main

// foto:"na pláži" v hledání modelek (ROADMAP 1.52): český textový model (galerie_slovy.go) spočítá podobnost
// každé fotky s textem; modelka vyhoví, když některá její fotka nad průměrem sbírky vyčnívá aspoň o
// minVycnivani směrodatné odchylky (stejný práh jako hledání slovy ve Všech fotkách). Síla shody modelky je
// vyčnívání její nejlepší fotky; Galerie modelek podle ní řadí. Bez obsahu fotek nebo textového modelu
// podmínka foto: nic neomezuje (okno to řekne).

import (
	"sync"

	"pinup-katalog/internal/hledani"
)

var shodyFotekPamet struct {
	sync.Mutex
	klic  string
	shody map[int]float64
}

// shodyFotekModelek: modelka → vyčnívání její nejlepší fotky (jen nad prahem); ok = false, když obsah fotek nejde použít
func (a *App) shodyFotekModelek(text string) (map[int]float64, bool) {
	if a.obsah == nil || !a.obsah.Zapnuto() || !a.obsah.StavHledaniSlovy().Pripraveno {
		return nil, false
	}
	fotky := a.fotkyGalerieVPameti()
	klic := text + "|" + a.otiskGalerie()
	p := &shodyFotekPamet
	p.Lock()
	if p.klic == klic {
		s := p.shody
		p.Unlock()
		return s, true
	}
	p.Unlock()
	vektor := a.obsah.VektorTextu(rozepsat(text))
	if vektor == nil {
		return nil, false
	}
	podobnost := a.obsah.PodobnostiKTextu(vektor)
	if len(podobnost) == 0 {
		return nil, false
	}
	shody := vycnivajiciModelky(fotky, podobnost)
	p.Lock()
	p.klic, p.shody = klic, shody
	p.Unlock()
	return shody, true
}

// Modelky s fotkou nad prahem; když ani nejlepší fotka sbírky nevyčnívá dost, text v obsahu nic neznamená
func vycnivajiciModelky(fotky []fotkaGalerie, podobnost map[string]float64) map[int]float64 {
	shody := map[int]float64{}
	prumer, odchylka := rozlozeni(podobnost)
	if odchylka == 0 {
		return shody
	}
	nej := 0.0
	for _, x := range podobnost {
		nej = max(nej, x)
	}
	if nej < prumer+minVycnivaniNej*odchylka {
		return shody
	}
	for i := range fotky {
		x, ok := podobnost[fotky[i].f.DriveID]
		if !ok {
			continue
		}
		if v := (x - prumer) / odchylka; v >= minVycnivani && v > shody[fotky[i].f.ModelkaID] {
			shody[fotky[i].f.ModelkaID] = v
		}
	}
	return shody
}

// Doplní do dotazu shody foto:"…"; vrací shody podle modelky (největší přes všechny texty), nil bez foto:
func (a *App) doplnitShodyFotek(h hledani.Dotaz) map[int]float64 {
	texty := h.TextyFotek()
	if len(texty) == 0 {
		return nil
	}
	celkem := map[int]float64{}
	for _, t := range texty {
		shody, ok := a.shodyFotekModelek(t)
		if !ok {
			continue
		}
		h.NastavitShodyFotek(t, shody)
		for id, v := range shody {
			celkem[id] = max(celkem[id], v)
		}
	}
	return celkem
}

// Jde hledat foto:"…"? (obsah fotek zapnutý a textový model stažený)
func (a *App) GetFotoHledaniDostupne() bool {
	return a.obsah != nil && a.obsah.Zapnuto() && a.obsah.StavHledaniSlovy().Pripraveno
}
