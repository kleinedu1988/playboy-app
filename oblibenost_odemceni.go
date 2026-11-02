package main

// Témata k odemčení (Hodnotit › Průvodce, volba sezóny): téma s podmínkou na tagy, kterému chybí soutěžící, a
// modelky, které by mohly soutěžit, když se projdou jejich fotky průvodcem. Kandidátka splňuje údaje modelky,
// má méně než minFotekTematu fotek tématu a dost neprošlých fotek (průvodce jim teprve dá tagy), které splňují
// podmínky na album. Téma je dosažitelné, když je kandidátek aspoň tolik, kolik soutěžících chybí.

import "sort"

const kandidatekNejvys = 12

type KandidatkaTematu struct {
	ModelkaID int `json:"modelkaId"`
	Fotek     int `json:"fotek"`     // fotek tématu teď
	Chybi     int `json:"chybi"`     // kolik fotek tématu chybí do soutěže
	Neznamych int `json:"neznamych"` // neprošlých fotek, které můžou téma dostat
}

type PokrytiTematu struct {
	InfoTematu
	ChybiModelek   int                `json:"chybiModelek"`
	FotekKOdemceni int                `json:"fotekKOdemceni"` // nejméně fotek tématu, které odemknou téma
	Kandidatky     []KandidatkaTematu `json:"kandidatky"`     // od nejbližší
	MinFotek       int                `json:"minFotek"`
	MinModelek     int                `json:"minModelek"`
}

// Fotka splňuje podmínky tématu na album (bez tagů)
func (t *Tema) albumSplnuje(f *fotkaTematu) bool {
	for _, p := range t.Podminky {
		if p.Druh != "fotka" {
			continue
		}
		ma := false
		for _, h := range p.Hodnoty {
			if f.album.splnuje(p.Klic, h) {
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

func (t *Tema) maPodminkuNaTag() bool {
	for _, p := range t.Podminky {
		if p.Druh == "tag" {
			return true
		}
	}
	return false
}

// Fotky prošlé průvodcem aktuální verze
func (a *App) proslePruvodcem() map[int]bool {
	v := map[int]bool{}
	radky, err := a.db.Query(`SELECT fotka_id FROM fotky_pruvodce WHERE verze >= ?`, verzePruvodce)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		if radky.Scan(&id) == nil {
			v[id] = true
		}
	}
	return v
}

func pokrytiTematu(t *Tema, modelky []Modelka, fotky map[int]*fotkaTematu, prosle map[int]bool) PokrytiTematu {
	fotek, neznamych := map[int]int{}, map[int]int{}
	for id, f := range fotky {
		switch {
		case t.fotkaSplnuje(f):
			fotek[f.modelka]++
		case !prosle[id] && t.albumSplnuje(f):
			neznamych[f.modelka]++
		}
	}
	p := PokrytiTematu{InfoTematu: InfoTematu{Tema: *t}, Kandidatky: []KandidatkaTematu{}, MinFotek: minFotekTematu, MinModelek: minModelekTematu}
	for i := range modelky {
		m := &modelky[i]
		if !t.modelkaSplnuje(m) {
			continue
		}
		n := fotek[m.ID]
		if n >= minFotekTematu {
			p.Soutezicich++
			p.Fotek += n
			continue
		}
		if chybi := minFotekTematu - n; neznamych[m.ID] >= chybi {
			p.Kandidatky = append(p.Kandidatky, KandidatkaTematu{ModelkaID: m.ID, Fotek: n, Chybi: chybi, Neznamych: neznamych[m.ID]})
		}
	}
	p.Plati = p.Soutezicich >= minModelekTematu
	p.ChybiModelek = max(0, minModelekTematu-p.Soutezicich)
	sort.SliceStable(p.Kandidatky, func(i, j int) bool {
		x, y := p.Kandidatky[i], p.Kandidatky[j]
		if x.Chybi != y.Chybi {
			return x.Chybi < y.Chybi
		}
		if x.Neznamych != y.Neznamych {
			return x.Neznamych > y.Neznamych
		}
		return x.ModelkaID < y.ModelkaID
	})
	for i := 0; i < p.ChybiModelek && i < len(p.Kandidatky); i++ {
		p.FotekKOdemceni += p.Kandidatky[i].Chybi
	}
	p.Kandidatky = p.Kandidatky[:min(len(p.Kandidatky), max(kandidatekNejvys, p.ChybiModelek))]
	return p
}

// Témata katalogu s podmínkou na tagy, která ještě neplatí, ale průvodce je může odemknout; od nejbližšího
func (a *App) GetTemataKOdemceni() []PokrytiTematu {
	modelky, _ := a.nactiModelky("", false)
	fotky := a.fotkyProTemata()
	prosle := a.proslePruvodcem()
	vysledek := []PokrytiTematu{}
	for i := range katalogTemat {
		t := katalogTemat[i]
		if !t.maPodminkuNaTag() {
			continue
		}
		p := pokrytiTematu(&t, modelky, fotky, prosle)
		if !p.Plati && len(p.Kandidatky) >= p.ChybiModelek {
			vysledek = append(vysledek, p)
		}
	}
	sort.SliceStable(vysledek, func(i, j int) bool { return vysledek[i].FotekKOdemceni < vysledek[j].FotekKOdemceni })
	return vysledek
}

// Fronta průvodce pro téma: neprošlé fotky kandidátek (od nejbližší), které splňují podmínky na album
func (a *App) GetFotkyKOdemceni(tema string) []Fotografie {
	t := temaZKlice(tema)
	if t == nil {
		return []Fotografie{}
	}
	modelky, _ := a.nactiModelky("", false)
	vsechny := a.fotkyProTemata()
	p := pokrytiTematu(t, modelky, vsechny, a.proslePruvodcem())
	poradi := map[int]int{}
	for i, k := range p.Kandidatky {
		poradi[k.ModelkaID] = i + 1
	}
	var ids []int
	for _, k := range p.Kandidatky {
		ids = append(ids, k.ModelkaID)
	}
	if len(ids) == 0 {
		return []Fotografie{}
	}
	fotkyModelek := vsechny
	vysledek := []Fotografie{}
	for _, f := range a.GetFotkyKPruvodci() {
		ft := fotkyModelek[f.ID]
		if poradi[f.ModelkaID] > 0 && ft != nil && t.albumSplnuje(ft) && !t.fotkaSplnuje(ft) {
			vysledek = append(vysledek, f)
		}
	}
	sort.SliceStable(vysledek, func(i, j int) bool { return poradi[vysledek[i].ModelkaID] < poradi[vysledek[j].ModelkaID] })
	return vysledek
}
