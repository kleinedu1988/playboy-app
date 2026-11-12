package main

import (
	"sort"
	"strings"
	"time"
)

// Druh fotky (0.02.060, Explicitní fotky zvlášť): návrhy z odhadu nad vektory CLIP (internal/obsah/druh.go) –
// fotky, na kterých je nejspíš muž, a fotky s víc ženami. Jen ke kontrole v Údržbě; fotky se přeřadí až po
// potvrzení.
//
// Potvrzený druh (0.02.061, úprava schématu č. 19, export verze 16): podle souboru na Disku, platí ve všech albech.
// Druhy: pozovaci, lesbicka, sex, muz (na fotce je muž, ale nejde o sex – scéna, zákulisí).

var druhyFotek = map[string]bool{"pozovaci": true, "lesbicka": true, "sex": true, "muz": true}

func (a *App) migraceDruhFotek() error {
	_, err := a.db.Exec(`CREATE TABLE IF NOT EXISTS druhy_fotek (
		drive_file_id TEXT PRIMARY KEY,
		druh TEXT NOT NULL,
		potvrzeno TEXT NOT NULL DEFAULT ''
	) WITHOUT ROWID`)
	return err
}

// SetDruhFotek potvrdí druh souborů (prázdný druh potvrzení smaže); vrací počet změněných souborů ze sbírky
func (a *App) SetDruhFotek(ids []string, druh string) int {
	if a.db == nil || (druh != "" && !druhyFotek[druh]) || len(ids) == 0 {
		return 0
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("druh fotek", err)
		return 0
	}
	defer tx.Rollback()
	cas := time.Now().Format("2006-01-02 15:04:05")
	n := 0
	for _, id := range ids {
		var pocet int
		if id == "" || tx.QueryRow(`SELECT COUNT(*) FROM fotky WHERE drive_file_id = ?`, id).Scan(&pocet) != nil || pocet == 0 {
			continue
		}
		if druh == "" {
			_, err = tx.Exec(`DELETE FROM druhy_fotek WHERE drive_file_id = ?`, id)
		} else {
			_, err = tx.Exec(`INSERT OR REPLACE INTO druhy_fotek (drive_file_id, druh, potvrzeno) VALUES (?, ?, ?)`, id, druh, cas)
		}
		if err != nil {
			a.chyba("druh fotek", err)
			return 0
		}
		n++
	}
	if tx.Commit() != nil {
		return 0
	}
	return n
}

// GetDruhFotky: potvrzený druh souboru ("" = nepotvrzený)
func (a *App) GetDruhFotky(driveID string) string {
	var druh string
	if a.db != nil {
		a.db.QueryRow(`SELECT druh FROM druhy_fotek WHERE drive_file_id = ?`, driveID).Scan(&druh)
	}
	return druh
}

// Všechny potvrzené druhy (export, návrhy)
func vsechnyDruhyFotek(q dotazovac) map[string]string {
	v := map[string]string{}
	radky, err := q.Query(`SELECT drive_file_id, druh FROM druhy_fotek`)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id, druh string
		if radky.Scan(&id, &druh) == nil {
			v[id] = druh
		}
	}
	return v
}

// Druh z importu: neznámý se přeskočí (normalizace velikosti písmen)
func platnyDruh(druh string) string {
	druh = strings.ToLower(strings.TrimSpace(druh))
	if druhyFotek[druh] {
		return druh
	}
	return ""
}

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
	// Kolik souborů má potvrzený druh (podle druhu)
	Potvrzene map[string]int `json:"potvrzene"`
}

// GetNavrhyDruhu: fotky s mužem a s víc ženami podle odhadu, od nejjistějších, v každé skupině nejvýš limit
func (a *App) GetNavrhyDruhu(limit int) NavrhyDruhu {
	v := NavrhyDruhu{Muz: SkupinaDruhu{Fotky: []FotkaDruhu{}}, Zeny: SkupinaDruhu{Fotky: []FotkaDruhu{}}, Potvrzene: map[string]int{}}
	if a.db == nil || a.obsah == nil || !a.obsahZapnuty() {
		return v
	}
	potvrzene := vsechnyDruhyFotek(a.db)
	for _, d := range potvrzene {
		v.Potvrzene[d]++
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
		if radky.Scan(&f.DriveID, &f.ModelkaID, &f.Jmeno, &f.Album) != nil || videno[f.DriveID] || potvrzene[f.DriveID] != "" {
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
	potvrzeneV := v.Potvrzene
	v.Muz, v.Zeny = skupinaDruhu(muz, limit), skupinaDruhu(zeny, limit)
	v.Potvrzene = potvrzeneV
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
