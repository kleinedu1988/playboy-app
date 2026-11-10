package main

// Objevit (ROADMAP 1.53): modelky bez srdíček s nejvyšším odhadem (model vkusu a podobné modelky, s důvodem)
// a celá nehodnocená alba, jejichž fotky by podle obsahu (internal/obsah/odhad.go) měly mít nejvíc srdíček.
// Karta v Přehledu (frontend/src/app/objevit.js).

import (
	"math"
	"sort"
)

type TipModelky struct {
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Odhad     float64 `json:"odhad"`
	Duvod     string  `json:"duvod"`
}

type TipAlba struct {
	AlbumID   int64   `json:"albumId"`
	Album     string  `json:"album"`
	Typ       string  `json:"typ"`
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Odhad     float64 `json:"odhad"`
	Fotek     int     `json:"fotek"`
	Nahled    string  `json:"nahled"` // adresa fotky s nejvyšším odhadem
	Duvod     string  `json:"duvod"`
}

type Objevit struct {
	Modelky []TipModelky `json:"modelky"`
	Alba    []TipAlba    `json:"alba"`
}

const minFotekAlbaObjevit = 5

func (a *App) GetObjevit(pocet int) Objevit {
	pocet = min(max(pocet, 1), 30)
	v := Objevit{Modelky: []TipModelky{}, Alba: []TipAlba{}}
	modelky, _ := a.nactiModelky("", false)
	jmena := make(map[int]string, len(modelky))
	for _, m := range modelky {
		jmena[m.ID] = m.Jmeno
	}
	if a.uc != nil {
		model := a.modelOblibenosti(modelky)
		for _, m := range modelky {
			odhad, ok := model.odhad[m.ID]
			if !ok || m.Hodnoceni > 0 {
				continue
			}
			v.Modelky = append(v.Modelky, TipModelky{ModelkaID: m.ID, Jmeno: m.Jmeno, Odhad: math.Round(odhad*10) / 10})
		}
		sort.SliceStable(v.Modelky, func(i, j int) bool { return v.Modelky[i].Odhad > v.Modelky[j].Odhad })
		if len(v.Modelky) > pocet {
			v.Modelky = v.Modelky[:pocet]
		}
		for i := range v.Modelky {
			v.Modelky[i].Duvod = model.vkus.textOdhadu(v.Modelky[i].ModelkaID, v.Modelky[i].Odhad, true, true)
		}
	}
	v.Alba = a.objevitAlba(pocet, jmena)
	return v
}

// Nehodnocená alba (žádná fotka nemá srdíčka) s aspoň minFotekAlbaObjevit odhadnutými fotkami, podle průměru odhadu
func (a *App) objevitAlba(pocet int, jmena map[int]string) []TipAlba {
	tipy := []TipAlba{}
	odhady := a.odhadySrdicekFotek()
	if odhady == nil || len(odhady.Nehodnocene) == 0 {
		return tipy
	}
	radky, err := a.db.Query(`SELECT al.id, al.album, al.typ, COALESCE(al.modelka_id, 0), f.drive_file_id FROM alba al
		JOIN fotky f ON f.album_id = al.id
		WHERE al.id NOT IN (SELECT album_id FROM fotky WHERE hodnoceni > 0)`)
	if err != nil {
		return tipy
	}
	defer radky.Close()
	type souhrn struct {
		t        TipAlba
		soucet   float64
		nej      float64
		nejFotka string
	}
	alba := map[int64]*souhrn{}
	for radky.Next() {
		var t TipAlba
		var drive string
		if radky.Scan(&t.AlbumID, &t.Album, &t.Typ, &t.ModelkaID, &drive) != nil {
			continue
		}
		odhad, ok := odhady.Nehodnocene[drive]
		if !ok {
			continue
		}
		s := alba[t.AlbumID]
		if s == nil {
			s = &souhrn{t: t}
			alba[t.AlbumID] = s
		}
		s.t.Fotek++
		s.soucet += odhad
		if odhad > s.nej {
			s.nej, s.nejFotka = odhad, drive
		}
	}
	for _, s := range alba {
		if s.t.Fotek < minFotekAlbaObjevit {
			continue
		}
		t := s.t
		t.Odhad = math.Round(s.soucet/float64(t.Fotek)*10) / 10
		t.Jmeno = jmena[t.ModelkaID]
		t.Nahled = adresaObrazku(s.nejFotka)
		t.Duvod = "Podle obsahu fotek: podobné fotkám, kterým dáváš víc srdíček"
		tipy = append(tipy, t)
	}
	sort.SliceStable(tipy, func(i, j int) bool {
		if tipy[i].Odhad != tipy[j].Odhad {
			return tipy[i].Odhad > tipy[j].Odhad
		}
		return tipy[i].AlbumID < tipy[j].AlbumID
	})
	if len(tipy) > pocet {
		tipy = tipy[:pocet]
	}
	return tipy
}
