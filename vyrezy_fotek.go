package main

import (
	"math"
	"strings"
	"time"
)

// Chytrý výřez náhledů (0.02.049): pro každou fotku rámeček postavy a obličeje z detektoru, počítaný v pozadí
// s obsahem fotek (internal/obsah/vyrezy.go). Výřez pro konkrétní rám (dlaždice, hero, karta) spočítá rozhraní
// z rámečků a skutečné velikosti obrázku (0.02.050); databáze rozměry fotek nezná.
//
// Ruční výřez (0.02.057, úprava schématu č. 18, export verze 15): bod zájmu (x, y v % šířky a výšky obrázku) a
// přiblížení podle souboru na Disku – platí pro fotku ve všech albech a má přednost před automatickým.

// VyrezFotky: zdroj "rucni" (ruční výřez: bod a přiblížení), "postava" (detektor našel postavu), "bez"
// (spočítáno, postava nenalezena – zůstane střed) nebo "ceka" (výpočet ji ještě nezpracoval nebo je obsah vypnutý)
type VyrezFotky struct {
	DriveID string    `json:"driveId"`
	Zdroj   string    `json:"zdroj"`
	Postava []float64 `json:"postava,omitempty"` // x0, y0, x1, y1 jako podíl strany (0–1)
	Oblicej []float64 `json:"oblicej,omitempty"`
	Bod     []float64 `json:"bod,omitempty"` // ruční bod zájmu x, y jako podíl strany (0–1)
	Zoom    float64   `json:"zoom,omitempty"`
}

func (a *App) migraceRucniVyrezy() error {
	_, err := a.db.Exec(`CREATE TABLE IF NOT EXISTS vyrezy_fotek (
		drive_file_id TEXT PRIMARY KEY,
		bod_x REAL NOT NULL,
		bod_y REAL NOT NULL,
		zoom REAL NOT NULL DEFAULT 1,
		upraveno TEXT NOT NULL DEFAULT ''
	) WITHOUT ROWID`)
	return err
}

func naDveMista(h float64) float64 { return math.Round(h*100) / 100 }

// Meze ručního výřezu: bod 0–100 %, přiblížení 1–4×
const maxZoomVyrezu = 4.0

func omezitVyrez(x, y, zoom float64) (float64, float64, float64, bool) {
	if math.IsNaN(x) || math.IsNaN(y) || math.IsNaN(zoom) || math.IsInf(x, 0) || math.IsInf(y, 0) || math.IsInf(zoom, 0) {
		return 0, 0, 0, false
	}
	return min(max(x, 0), 100), min(max(y, 0), 100), min(max(zoom, 1), maxZoomVyrezu), true
}

// SetRucniVyrez uloží ruční výřez souboru (bod zájmu v %, přiblížení); soubor musí být ve sbírce
func (a *App) SetRucniVyrez(driveID string, x, y, zoom float64) bool {
	x, y, zoom, ok := omezitVyrez(x, y, zoom)
	if !ok || driveID == "" || a.db == nil {
		return false
	}
	var n int
	if a.db.QueryRow(`SELECT COUNT(*) FROM fotky WHERE drive_file_id = ?`, driveID).Scan(&n) != nil || n == 0 {
		return false
	}
	if _, err := a.db.Exec(`INSERT OR REPLACE INTO vyrezy_fotek (drive_file_id, bod_x, bod_y, zoom, upraveno) VALUES (?, ?, ?, ?, ?)`,
		driveID, naDveMista(x), naDveMista(y), naDveMista(zoom), time.Now().Format("2006-01-02 15:04:05")); err != nil {
		a.chyba("uložení výřezu fotky", err)
		return false
	}
	return true
}

// SmazatRucniVyrez vrátí fotce automatický výřez
func (a *App) SmazatRucniVyrez(driveID string) bool {
	if a.db == nil {
		return false
	}
	if _, err := a.db.Exec(`DELETE FROM vyrezy_fotek WHERE drive_file_id = ?`, driveID); err != nil {
		a.chyba("smazání výřezu fotky", err)
		return false
	}
	return true
}

// Ruční výřezy pro seznam souborů (po dávkách kvůli limitu parametrů SQLite)
func (a *App) rucniVyrezy(ids []string) map[string]exportVyrez {
	v := map[string]exportVyrez{}
	if a.db == nil {
		return v
	}
	for od := 0; od < len(ids); od += 500 {
		davka := ids[od:min(od+500, len(ids))]
		args := make([]any, len(davka))
		for i, id := range davka {
			args[i] = id
		}
		radky, err := a.db.Query(`SELECT drive_file_id, bod_x, bod_y, zoom FROM vyrezy_fotek WHERE drive_file_id IN (`+
			strings.TrimSuffix(strings.Repeat("?,", len(davka)), ",")+`)`, args...)
		if err != nil {
			return v
		}
		for radky.Next() {
			var id string
			var e exportVyrez
			if radky.Scan(&id, &e.X, &e.Y, &e.Zoom) == nil {
				v[id] = e
			}
		}
		radky.Close()
	}
	return v
}

// Všechny ruční výřezy (export)
func vsechnyRucniVyrezy(q dotazovac) map[string]*exportVyrez {
	v := map[string]*exportVyrez{}
	radky, err := q.Query(`SELECT drive_file_id, bod_x, bod_y, zoom FROM vyrezy_fotek`)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id string
		e := &exportVyrez{}
		if radky.Scan(&id, &e.X, &e.Y, &e.Zoom) == nil {
			v[id] = e
		}
	}
	return v
}

// GetVyrezyFotek: výřezy fotek podle ID souborů (pořadí jako ids); ruční má přednost před automatickým
func (a *App) GetVyrezyFotek(ids []string) []VyrezFotky {
	v := make([]VyrezFotky, 0, len(ids))
	rucni := a.rucniVyrezy(ids)
	for _, id := range ids {
		x := VyrezFotky{DriveID: id, Zdroj: "ceka"}
		if r, ok := rucni[id]; ok {
			x.Zdroj, x.Bod, x.Zoom = "rucni", []float64{r.X / 100, r.Y / 100}, r.Zoom
			v = append(v, x)
			continue
		}
		if a.obsah != nil {
			if r, ok := a.obsah.RamecekFotky(id); ok {
				x.Zdroj = "bez"
				if r.MaPostavu {
					x.Zdroj, x.Postava = "postava", r.Postava[:]
				}
				if r.MaOblicej {
					x.Oblicej = r.Oblicej[:]
				}
			}
		}
		v = append(v, x)
	}
	return v
}

// StavVyrezu: kolik různých souborů sbírky má výřez spočítaný
type StavVyrezu struct {
	Souboru     int  `json:"souboru"`
	Spocitano   int  `json:"spocitano"`
	ObsahZapnut bool `json:"obsahZapnut"`
}

func (a *App) GetStavVyrezu() StavVyrezu {
	var s StavVyrezu
	if a.db == nil {
		return s
	}
	a.db.QueryRow(`SELECT COUNT(DISTINCT drive_file_id) FROM fotky`).Scan(&s.Souboru)
	s.ObsahZapnut = a.obsahZapnuty()
	if s.ObsahZapnut {
		s.Spocitano = min(a.obsah.PocetVyrezu(), s.Souboru)
	}
	return s
}

// FotkaBezVyrezu: fotka, na které detektor postavu nenašel a nemá ruční výřez (náhled zůstává na středu)
type FotkaBezVyrezu struct {
	DriveID   string `json:"driveId"`
	URL       string `json:"url"`
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"`
}

type FotkyBezVyrezu struct {
	Fotky  []FotkaBezVyrezu `json:"fotky"`
	Celkem int              `json:"celkem"`
}

// GetFotkyBezVyrezu (0.02.058, Údržba › Otočené a výřezy): fotky bez postavy od nejlépe hodnocených; otočené
// se vynechají (rámečky detektoru platí pro neotočený obrázek), nejvýš limit
func (a *App) GetFotkyBezVyrezu(limit int) FotkyBezVyrezu {
	v := FotkyBezVyrezu{Fotky: []FotkaBezVyrezu{}}
	if a.db == nil || a.obsah == nil || !a.obsahZapnuty() {
		return v
	}
	rucni := map[string]bool{}
	for id := range vsechnyRucniVyrezy(a.db) {
		rucni[id] = true
	}
	radky, err := a.db.Query(`SELECT f.drive_file_id, COALESCE(al.modelka_id, 0), COALESCE(m.jmeno, ''), al.album
		FROM fotky f JOIN alba al ON al.id = f.album_id LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE f.nedostupne_od IS NULL AND COALESCE(f.rotace, 0) = 0
		ORDER BY COALESCE(f.hodnoceni, 0) DESC, f.id`)
	if err != nil {
		a.chyba("fotky bez výřezu", err)
		return v
	}
	defer radky.Close()
	videno := map[string]bool{}
	for radky.Next() {
		var f FotkaBezVyrezu
		if radky.Scan(&f.DriveID, &f.ModelkaID, &f.Jmeno, &f.Album) != nil || videno[f.DriveID] || rucni[f.DriveID] {
			continue
		}
		videno[f.DriveID] = true
		if r, ok := a.obsah.RamecekFotky(f.DriveID); !ok || r.MaPostavu {
			continue
		}
		v.Celkem++
		if len(v.Fotky) < limit {
			f.URL = adresaObrazku(f.DriveID)
			v.Fotky = append(v.Fotky, f)
		}
	}
	return v
}
