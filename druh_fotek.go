package main

import "sort"

// Druh fotky (0.02.060, Explicitní fotky zvlášť): návrhy z odhadu nad vektory CLIP (internal/obsah/druh.go) –
// fotky, na kterých je nejspíš muž, a fotky s víc ženami. Jen ke kontrole v Údržbě; fotky se přeřadí až po
// potvrzení (další krok).

// Od jaké pravděpodobnosti se fotka navrhne (na kontrolních listech z celé sbírky sedí asi 9 z 10)
const prahNavrhuDruhu = 0.85

type FotkaDruhu struct {
	DriveID   string  `json:"driveId"`
	URL       string  `json:"url"`
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Album     string  `json:"album"`
	Jistota   float64 `json:"jistota"`
}

type SkupinaDruhu struct {
	Fotky  []FotkaDruhu `json:"fotky"`
	Celkem int          `json:"celkem"`
}

type NavrhyDruhu struct {
	Muz  SkupinaDruhu `json:"muz"`
	Zeny SkupinaDruhu `json:"zeny"`
}

// GetNavrhyDruhu: fotky s mužem a s víc ženami podle odhadu, od nejjistějších, v každé skupině nejvýš limit
func (a *App) GetNavrhyDruhu(limit int) NavrhyDruhu {
	v := NavrhyDruhu{Muz: SkupinaDruhu{Fotky: []FotkaDruhu{}}, Zeny: SkupinaDruhu{Fotky: []FotkaDruhu{}}}
	if a.db == nil || a.obsah == nil || !a.obsahZapnuty() {
		return v
	}
	odhady := a.obsah.OdhadyDruhu()
	if len(odhady) == 0 {
		return v
	}
	radky, err := a.db.Query(`SELECT f.drive_file_id, COALESCE(al.modelka_id, 0), COALESCE(m.jmeno, ''), al.album
		FROM fotky f JOIN alba al ON al.id = f.album_id LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE f.nedostupne_od IS NULL ORDER BY f.id`)
	if err != nil {
		a.chyba("návrhy druhu fotek", err)
		return v
	}
	defer radky.Close()
	videno := map[string]bool{}
	var muz, zeny []FotkaDruhu
	for radky.Next() {
		var f FotkaDruhu
		if radky.Scan(&f.DriveID, &f.ModelkaID, &f.Jmeno, &f.Album) != nil || videno[f.DriveID] {
			continue
		}
		videno[f.DriveID] = true
		o, ok := odhady[f.DriveID]
		if !ok {
			continue
		}
		// Fotka s mužem patří mezi „muž“, i když je na ní víc žen (scéna s mužem rozhoduje)
		if o.Muz >= prahNavrhuDruhu {
			f.Jistota = naDveMista(o.Muz)
			muz = append(muz, f)
		} else if o.Zeny >= prahNavrhuDruhu {
			f.Jistota = naDveMista(o.Zeny)
			zeny = append(zeny, f)
		}
	}
	v.Muz, v.Zeny = skupinaDruhu(muz, limit), skupinaDruhu(zeny, limit)
	return v
}

func skupinaDruhu(fotky []FotkaDruhu, limit int) SkupinaDruhu {
	sort.SliceStable(fotky, func(i, j int) bool { return fotky[i].Jistota > fotky[j].Jistota })
	s := SkupinaDruhu{Celkem: len(fotky), Fotky: fotky[:min(len(fotky), max(limit, 0))]}
	for i := range s.Fotky {
		s.Fotky[i].URL = adresaObrazku(s.Fotky[i].DriveID)
	}
	if s.Fotky == nil {
		s.Fotky = []FotkaDruhu{}
	}
	return s
}
