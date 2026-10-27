package main

import (
	"fmt"
	"math"
	"sort"
	"time"
)

// Rychlé hodnocení (Oblíbenost › Hodnocení, popis v docs/UCENI.md, oddíl Rychlé hodnocení): fronta modelek, kterým
// se vyplatí dát nebo opravit srdíčka, a zápis srdíček převzatých z odhadu vkusu.
//
// Fronta: napřed nově přidané nehodnocené (posledních 14 dní, nejnovější napřed – máš je čerstvě v hlavě), pak ostatní
// nehodnocené podle užitku pro pořadí, nakonec hodnocené, kterým podle porovnání nebo fotek nesedí srdíčka (nesoulad,
// stejný návrh jako „Nesedí se srdíčky“). Užitek nehodnocené = odhad + ½·nejistota: nejistá „možná pětka“ může
// rozhodnout o top 10 a model vkusu se na ní naučí nejvíc, jistá čtyřka méně. Odhad je síla z porovnání (už
// porovnávaná), odhad vkusu, odhad ze srdíček fotek, jinak průměr srdíček bez odhadu. Modelky bez fotek i titulky jdou
// mezi nehodnocenými nakonec.

const (
	dnyNoveModelky   = 14
	vahaNejistotyHod = 0.5
	nejistotaFotek   = 0.8
)

// Položka fronty rychlého hodnocení. Druh: "nova" (nedávno přidaná nehodnocená), "nehodnocena", "nesedi" (hodnocená,
// nesoulad se srdíčky; Hodnoceni a Navrh). Odhad 0 = žádný; Nejistota je směrodatná odchylka odhadu ve srdíčkách.
type PolozkaHodnoceni struct {
	ModelkaID int              `json:"modelkaId"`
	Druh      string           `json:"druh"`
	Odhad     float64          `json:"odhad"`
	Nejistota float64          `json:"nejistota"`
	Duvod     string           `json:"duvod"`
	Hodnoceni float64          `json:"hodnoceni"`
	Navrh     float64          `json:"navrh"`
	Nesoulad  *NesouladSrdicek `json:"nesoulad,omitempty"`
}

// Fronta rychlého hodnocení
func (a *App) GetFrontaHodnoceni() []PolozkaHodnoceni {
	if a.uc == nil {
		return []PolozkaHodnoceni{}
	}
	modelky, _ := a.nactiModelky("", false)
	return a.modelOblibenosti(modelky).frontaHodnoceni(modelky, time.Now())
}

// Srdíčka převzatá z odhadu vkusu (Enter v rychlém hodnocení): uloží je jako SetHodnoceni a zapamatuje si, že jsou
// jen přijatý odhad (model vkusu se z nich neučí, dokud je nepotvrdí porovnání)
func (a *App) SetHodnoceniOdhadem(modelkaID int, hodnoceni float64) bool {
	if !a.SetHodnoceni(modelkaID, hodnoceni) {
		return false
	}
	if u := a.uc; u != nil {
		u.mu.Lock()
		defer u.mu.Unlock()
		if db := u.zajistit(); db != nil {
			if _, err := db.Exec("INSERT OR REPLACE INTO prevzate_odhady (modelka_id, hodnoceni, cas) VALUES (?, ?, ?)",
				modelkaID, hodnoceni, time.Now().Format("2006-01-02 15:04:05")); err != nil {
				varovatUceni("převzatý odhad se nezapsal: %v", err)
			}
		}
	}
	return true
}

// Srdíčka převzatá z odhadu (modelka → srdíčka v tu chvíli); volá se se zámkem
func (u *uceni) nacistPrevzate() map[int]float64 {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	radky, err := db.Query("SELECT modelka_id, hodnoceni FROM prevzate_odhady")
	if err != nil {
		return nil
	}
	defer radky.Close()
	v := map[int]float64{}
	for radky.Next() {
		var id int
		var h float64
		if radky.Scan(&id, &h) == nil {
			v[id] = h
		}
	}
	return v
}

// Odhad nehodnocené pro frontu: hodnota, nejistota a důvod (odhad 0 = žádný)
func (m *modelOblibenosti) odhadProHodnoceni(x Modelka) (odhad, nejistota float64, duvod string) {
	if n := m.pocet[x.ID]; n > 0 && !m.jenOdhad[x.ID] {
		odhad = min(max(m.oblibenost[x.ID], 0.5), 5)
		return odhad, math.Sqrt(m.rozptylModelky(&x)), fmt.Sprintf("Po %d porovnáních vychází na %s", n, textSrdicek(zaokrouhlitNaPul(odhad)))
	}
	switch m.zdrojOdhadu[x.ID] {
	case urovenVkus:
		if o, ok := m.odhad[x.ID]; ok && m.vkus != nil {
			return o, m.nejistotaOdhadu(x.ID), m.vkus.textOdhadu(x.ID, o, true, false)
		}
	case urovenFotky:
		if p, ok := m.predpoklad[x.ID]; ok {
			return min(max(p, 0.5), 5), nejistotaFotek, fmt.Sprintf("Podle srdíček jejích fotek asi %s", textSrdicek(zaokrouhlitNaPul(p)))
		}
	}
	return 0, sigmaNehodnocene, ""
}

func (m *modelOblibenosti) frontaHodnoceni(modelky []Modelka, nyni time.Time) []PolozkaHodnoceni {
	v := []PolozkaHodnoceni{}
	type kandidat struct {
		p       PolozkaHodnoceni
		uzitek  float64
		pridano string
		bez     bool // bez fotek i titulky
	}
	var nove, nehodnocene []kandidat
	odNovych := nyni.AddDate(0, 0, -dnyNoveModelky).Format("2006-01-02")
	for _, x := range modelky {
		if x.Hodnoceni > 0 {
			continue
		}
		odhad, nejistota, duvod := m.odhadProHodnoceni(x)
		k := kandidat{p: PolozkaHodnoceni{ModelkaID: x.ID, Druh: "nehodnocena", Odhad: zaokrouhlit3(odhad), Nejistota: zaokrouhlit3(nejistota), Duvod: duvod},
			pridano: x.Pridano, bez: x.PocetFotek == 0 && x.CoverURL == "" && x.CoverID == ""}
		stred := odhad
		if stred == 0 {
			stred = m.prumer
		}
		k.uzitek = stred + vahaNejistotyHod*nejistota
		if len(x.Pridano) >= 10 && x.Pridano[:10] >= odNovych && !k.bez {
			k.p.Druh = "nova"
			nove = append(nove, k)
		} else {
			nehodnocene = append(nehodnocene, k)
		}
	}
	sort.SliceStable(nove, func(i, j int) bool {
		if nove[i].pridano != nove[j].pridano {
			return nove[i].pridano > nove[j].pridano
		}
		return nove[i].p.ModelkaID < nove[j].p.ModelkaID
	})
	sort.SliceStable(nehodnocene, func(i, j int) bool {
		a, b := nehodnocene[i], nehodnocene[j]
		if a.bez != b.bez {
			return !a.bez
		}
		if a.uzitek != b.uzitek {
			return a.uzitek > b.uzitek
		}
		return a.p.ModelkaID < b.p.ModelkaID
	})
	for _, k := range append(nove, nehodnocene...) {
		v = append(v, k.p)
	}
	// Nesoulad se srdíčky: od nejsilnějšího
	var nesedi []NesouladSrdicek
	for _, n := range m.nesoulad {
		nesedi = append(nesedi, n)
	}
	sort.Slice(nesedi, func(i, j int) bool {
		if nesedi[i].vaha != nesedi[j].vaha {
			return nesedi[i].vaha > nesedi[j].vaha
		}
		return nesedi[i].ModelkaID < nesedi[j].ModelkaID
	})
	for i := range nesedi {
		n := nesedi[i]
		v = append(v, PolozkaHodnoceni{ModelkaID: n.ModelkaID, Druh: "nesedi", Hodnoceni: n.Hodnoceni, Navrh: n.Navrh, Nesoulad: &n})
	}
	return v
}
