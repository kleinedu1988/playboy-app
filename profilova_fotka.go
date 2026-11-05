package main

import (
	"database/sql"
	"math"
)

// Profilová fotka modelky: fotka v záhlaví profilu, oddělená od titulní fotky (karta v galerii, náhledy) i se
// svým výřezem. Úprava schématu č. 16 (výjimka ze zmrazení na přání uživatele, 1.2.65): sloupce
// profil_fotka_id (odkaz na fotku; smazaná fotka ho vynuluje) a profil_zoom, profil_x, profil_y. Profilové
// fotky uložené mezi nastaveními (1.2.63–1.2.64, klíče „profilova:<id>“ a „profilova-vyrez:<id>“) úprava přenese.
var krokyProfilovaFotka = []string{
	`ALTER TABLE modelky ADD COLUMN profil_fotka_id INTEGER REFERENCES fotky(id) ON DELETE SET NULL`,
	`ALTER TABLE modelky ADD COLUMN profil_zoom REAL`,
	`ALTER TABLE modelky ADD COLUMN profil_x REAL`,
	`ALTER TABLE modelky ADD COLUMN profil_y REAL`,
	`UPDATE modelky SET profil_fotka_id = (SELECT f.id FROM nastaveni n JOIN fotky f ON f.id = CAST(n.hodnota AS INTEGER)
		WHERE n.klic = 'profilova:' || modelky.id)`,
	// Výřez „přiblížení;x;y“
	`UPDATE modelky SET
		profil_zoom = CAST(substr(v, 1, instr(v, ';') - 1) AS REAL),
		profil_x = CAST(substr(v, instr(v, ';') + 1, instr(substr(v, instr(v, ';') + 1), ';') - 1) AS REAL),
		profil_y = CAST(substr(substr(v, instr(v, ';') + 1), instr(substr(v, instr(v, ';') + 1), ';') + 1) AS REAL)
	FROM (SELECT substr(klic, 17) AS mid, hodnota AS v FROM nastaveni WHERE klic LIKE 'profilova-vyrez:%') AS vyrezy
	WHERE modelky.id = CAST(vyrezy.mid AS INTEGER) AND modelky.profil_fotka_id IS NOT NULL`,
	`DELETE FROM nastaveni WHERE klic LIKE 'profilova:%' OR klic LIKE 'profilova-vyrez:%'`,
}

func (a *App) migraceProfilovaFotka() error {
	if a.maSloupec("modelky", "profil_fotka_id") {
		return nil
	}
	for _, krok := range krokyProfilovaFotka {
		if _, err := a.db.Exec(krok); err != nil {
			return err
		}
	}
	return nil
}

// Profilová fotka pro záhlaví: adresa (s {velikost}) a výřez se stejnými jmény jako u titulní fotky
type ProfilovaFotka struct {
	URL       string  `json:"url"`
	CoverZoom float64 `json:"coverZoom"`
	CoverX    float64 `json:"coverX"`
	CoverY    float64 `json:"coverY"`
}

// Výchozí výřez profilové fotky: horní část s obličejem (rámeček v záhlaví má poměr 3 : 4)
const vychoziProfilovaY = 22

// Fotka patří modelce: je v jejím albu nebo ve sdíleném albu, kde je modelka další
const fotkaModelky = `EXISTS (SELECT 1 FROM fotografie f LEFT JOIN alba al ON al.id = f.album_id
	WHERE f.id = ?1 AND (f.modelka_id = ?2 OR EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = al.id AND am.modelka_id = ?2)))`

// Profilovou fotkou se stane fotka z některého alba modelky (i sdíleného); fotoID 0 profilovou fotku zruší
// a záhlaví zůstane bez fotky. Nová profilová fotka začíná s výchozím výřezem.
func (a *App) SetProfilovaFotka(modelkaID, fotoID int) bool {
	if fotoID == 0 {
		if _, err := a.db.Exec(`UPDATE modelky SET profil_fotka_id = NULL, profil_zoom = NULL, profil_x = NULL, profil_y = NULL
			WHERE id = ?`, modelkaID); err != nil {
			a.chyba("zrušení profilové fotky", err)
			return false
		}
		return true
	}
	vysledek, err := a.db.Exec(`UPDATE modelky SET profil_fotka_id = ?1, profil_zoom = NULL, profil_x = NULL, profil_y = NULL
		WHERE id = ?2 AND `+fotkaModelky, fotoID, modelkaID)
	if err != nil {
		a.chyba("nastavení profilové fotky", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

// Import: profilová fotka podle ID z Disku mezi fotkami modelky
func (a *App) nastavitProfilovouPodleDisku(modelkaID int, odkaz string) bool {
	ids := parseDriveIDs(odkaz)
	if len(ids) == 0 {
		return false
	}
	var fotoID int
	a.db.QueryRow(`SELECT f.id FROM fotografie f LEFT JOIN alba al ON al.id = f.album_id
		WHERE f.drive_file_id = ?1 AND (f.modelka_id = ?2 OR EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = al.id AND am.modelka_id = ?2))
		ORDER BY f.id LIMIT 1`, ids[0], modelkaID).Scan(&fotoID)
	return fotoID != 0 && a.SetProfilovaFotka(modelkaID, fotoID)
}

// Uložení výřezu profilové fotky (přiblížení 1–4, poloha v procentech); jen když modelka profilovou fotku má
func (a *App) SetProfilovyVyrez(modelkaID int, zoom, x, y float64) bool {
	omezit := func(hodnota, min, max float64) float64 {
		if math.IsNaN(hodnota) || hodnota < min {
			return min
		}
		return math.Min(hodnota, max)
	}
	vysledek, err := a.db.Exec(`UPDATE modelky SET profil_zoom = ?, profil_x = ?, profil_y = ?
		WHERE id = ? AND profil_fotka_id IS NOT NULL`, omezit(zoom, 1, 4), omezit(x, 0, 100), omezit(y, 0, 100), modelkaID)
	if err != nil {
		a.chyba("uložení výřezu profilové fotky", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

// Profilová fotka s výřezem; nil, když modelka profilovou fotku nemá (nebo fotka mezitím zmizela)
func (a *App) GetProfilovaFotka(modelkaID int) *ProfilovaFotka {
	driveID, zoom, x, y := a.profilovaFotkaModelky(modelkaID)
	if driveID == "" {
		return nil
	}
	return &ProfilovaFotka{URL: adresaObrazku(driveID), CoverZoom: zoom, CoverX: x, CoverY: y}
}

func (a *App) profilovaFotkaModelky(modelkaID int) (driveID string, zoom, x, y float64) {
	var id sql.NullString
	var z, cx, cy sql.NullFloat64
	err := a.db.QueryRow(`SELECT f.drive_file_id, m.profil_zoom, m.profil_x, m.profil_y
		FROM modelky m JOIN fotky f ON f.id = m.profil_fotka_id WHERE m.id = ?`, modelkaID).Scan(&id, &z, &cx, &cy)
	if err != nil || !id.Valid {
		return "", 0, 0, 0
	}
	ids := parseDriveIDs(id.String)
	if len(ids) == 0 {
		return "", 0, 0, 0
	}
	zoom, x, y = 1, 50, vychoziProfilovaY
	if z.Valid && cx.Valid && cy.Valid {
		zoom, x, y = z.Float64, cx.Float64, cy.Float64
	}
	return ids[0], zoom, x, y
}

// Export: ID profilové fotky z Disku a výřez, jen když není výchozí
func (a *App) exportProfiloveFotky(modelkaID int) (string, *exportVyrez) {
	driveID, zoom, x, y := a.profilovaFotkaModelky(modelkaID)
	if driveID == "" {
		return "", nil
	}
	if zoom == 1 && x == 50 && y == vychoziProfilovaY {
		return driveID, nil
	}
	nadve := func(hodnota float64) float64 { return math.Round(hodnota*100) / 100 }
	return driveID, &exportVyrez{Zoom: nadve(zoom), X: nadve(x), Y: nadve(y)}
}
