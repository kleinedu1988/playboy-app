package main

import (
	"database/sql"
	"fmt"
	"math"
	"strconv"
)

// Profilová fotka modelky: fotka v záhlaví profilu, oddělená od titulní fotky (karta v galerii, náhledy).
// Schéma je zmrazené, proto je v tabulce nastavení pod klíčem „profilova:<id modelky>“ s id fotky. Bez profilové
// fotky (i když fotka mezitím zmizela) ukazuje záhlaví titulní.
func klicProfiloveFotky(modelkaID int) string {
	return "profilova:" + strconv.Itoa(modelkaID)
}

// Výřez profilové fotky („přiblížení;x;y“) je zvlášť od výřezu titulní; nová profilová fotka ho zruší
func klicVyrezuProfilove(modelkaID int) string {
	return "profilova-vyrez:" + strconv.Itoa(modelkaID)
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

// Profilovou fotkou se stane fotka z některého alba modelky (i sdíleného); fotoID 0 profilovou fotku zruší
// a záhlaví znovu ukáže titulní
func (a *App) SetProfilovaFotka(modelkaID, fotoID int) bool {
	klic := klicProfiloveFotky(modelkaID)
	if fotoID == 0 {
		if _, err := a.db.Exec(`DELETE FROM nastaveni WHERE klic IN (?, ?)`, klic, klicVyrezuProfilove(modelkaID)); err != nil {
			a.chyba("zrušení profilové fotky", err)
			return false
		}
		return true
	}
	vysledek, err := a.db.Exec(`
		INSERT INTO nastaveni (klic, hodnota)
		SELECT ?3, ?1 WHERE EXISTS (SELECT 1 FROM modelky WHERE id = ?2) AND EXISTS (SELECT 1 FROM fotografie f
			LEFT JOIN alba al ON al.id = f.album_id
			WHERE f.id = ?1 AND (f.modelka_id = ?2 OR EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = al.id AND am.modelka_id = ?2)))
		ON CONFLICT (klic) DO UPDATE SET hodnota = excluded.hodnota`,
		strconv.Itoa(fotoID), modelkaID, klic)
	if err != nil {
		a.chyba("nastavení profilové fotky", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	if zmeneno == 1 {
		// Pro novou profilovou fotku starý výřez neplatí
		a.db.Exec(`DELETE FROM nastaveni WHERE klic = ?`, klicVyrezuProfilove(modelkaID))
	}
	return zmeneno == 1
}

// Uložení výřezu profilové fotky (přiblížení 1–4, poloha v procentech); jen když modelka profilovou fotku má
func (a *App) SetProfilovyVyrez(modelkaID int, zoom, x, y float64) bool {
	omezit := func(hodnota, min, max float64) float64 {
		if math.IsNaN(hodnota) || hodnota < min {
			return min
		}
		return math.Min(hodnota, max)
	}
	hodnota := fmt.Sprintf("%g;%g;%g", omezit(zoom, 1, 4), omezit(x, 0, 100), omezit(y, 0, 100))
	vysledek, err := a.db.Exec(`
		INSERT INTO nastaveni (klic, hodnota) SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM nastaveni WHERE klic = ?3)
		ON CONFLICT (klic) DO UPDATE SET hodnota = excluded.hodnota`,
		klicVyrezuProfilove(modelkaID), hodnota, klicProfiloveFotky(modelkaID))
	if err != nil {
		a.chyba("uložení výřezu profilové fotky", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

// Profilová fotka s výřezem; nil, když modelka profilovou fotku nemá (nebo fotka mezitím zmizela)
func (a *App) GetProfilovaFotka(modelkaID int) *ProfilovaFotka {
	var driveID, vyrez sql.NullString
	err := a.db.QueryRow(`SELECT f.drive_file_id, (SELECT hodnota FROM nastaveni WHERE klic = ?2)
		FROM nastaveni n JOIN fotky f ON f.id = CAST(n.hodnota AS INTEGER)
		WHERE n.klic = ?1`, klicProfiloveFotky(modelkaID), klicVyrezuProfilove(modelkaID)).Scan(&driveID, &vyrez)
	if err != nil || !driveID.Valid {
		return nil
	}
	ids := parseDriveIDs(driveID.String)
	if len(ids) == 0 {
		return nil
	}
	p := &ProfilovaFotka{URL: adresaObrazku(ids[0]), CoverZoom: 1, CoverX: 50, CoverY: vychoziProfilovaY}
	var z, x, y float64
	if vyrez.Valid {
		if n, _ := fmt.Sscanf(vyrez.String, "%g;%g;%g", &z, &x, &y); n == 3 {
			p.CoverZoom, p.CoverX, p.CoverY = z, x, y
		}
	}
	return p
}
