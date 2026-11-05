package main

import (
	"database/sql"
	"strconv"
)

// Profilová fotka modelky: fotka v záhlaví profilu, oddělená od titulní fotky (karta v galerii, náhledy).
// Schéma je zmrazené, proto je v tabulce nastavení pod klíčem „profilova:<id modelky>“ s id fotky. Bez profilové
// fotky (i když fotka mezitím zmizela) ukazuje záhlaví titulní.
func klicProfiloveFotky(modelkaID int) string {
	return "profilova:" + strconv.Itoa(modelkaID)
}

// Profilovou fotkou se stane fotka z některého alba modelky (i sdíleného); fotoID 0 profilovou fotku zruší
// a záhlaví znovu ukáže titulní
func (a *App) SetProfilovaFotka(modelkaID, fotoID int) bool {
	klic := klicProfiloveFotky(modelkaID)
	if fotoID == 0 {
		if _, err := a.db.Exec(`DELETE FROM nastaveni WHERE klic = ?`, klic); err != nil {
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
	return zmeneno == 1
}

// Adresa profilové fotky (s {velikost} jako u titulní); prázdná, když modelka profilovou fotku nemá
func (a *App) GetProfilovaFotka(modelkaID int) string {
	var driveID sql.NullString
	err := a.db.QueryRow(`SELECT f.drive_file_id FROM nastaveni n JOIN fotky f ON f.id = CAST(n.hodnota AS INTEGER)
		WHERE n.klic = ?`, klicProfiloveFotky(modelkaID)).Scan(&driveID)
	if err != nil || !driveID.Valid {
		return ""
	}
	if ids := parseDriveIDs(driveID.String); len(ids) > 0 {
		return adresaObrazku(ids[0])
	}
	return ""
}
