package main

import (
	"fmt"
	"math"
	"slices"
	"strings"

	"playboy-app/internal/sbirka"
)

// Sloupce tabulky modelky (kromě id a jmeno) a jejich typy
var sloupceModelky = [][2]string{
	{"narozeni_datum", "TEXT"},
	{"umrti_datum", "TEXT"},
	{"narozeni_misto", "TEXT"},
	{"narodnost", "TEXT"},
	{"etnicita", "TEXT"},
	{"vyska_cm", "INTEGER"},
	{"vaha_kg", "INTEGER"},
	{"vlasy_barva", "TEXT"},
	{"oci_barva", "TEXT"},
	{"miry", "TEXT"},
	{"obvod_hrudnik_cm", "INTEGER"},
	{"obvod_pas_cm", "INTEGER"},
	{"obvod_boky_cm", "INTEGER"},
	{"velikost_prsou", "TEXT"},
	{"prsa_typ", "TEXT"},
	{"ochlupeni", "TEXT"},
	{"tetovani", "INTEGER"},
	{"piercing", "INTEGER"},
	{"vystoupeni", "TEXT"},
	{"pictorial_vydani", "TEXT"},
	{"role", "TEXT"},
	{"tags", "TEXT"},
	{"dalsi_jmena", "TEXT"},
	{"poznamka", "TEXT"},
	{"odkazy", "TEXT"},
	// Musí zůstat poslední: UpdateModelka podle ní pozná změnu titulní fotky
	{"drive_cover_id", "TEXT"},
}

// Sloupce s výřezem titulní fotky a jejich výchozí hodnoty; ukládají se zvlášť přes SetCoverVyrez
var sloupceVyrezu = [][2]string{
	{"cover_zoom", "1"},
	{"cover_x", "50"},
	{"cover_y", "50"},
}

var (
	dotazAddModelka    string
	dotazUpdateModelka string
)

func init() {
	sloupce := []string{"jmeno", "pridano"}
	otazniky := []string{"?", "?"}
	nastaveni := []string{"jmeno = ?"}
	for _, s := range sloupceModelky {
		sloupce = append(sloupce, s[0])
		otazniky = append(otazniky, "?")
		if s[0] == "drive_cover_id" {
			nastaveni = append(nastaveni, "drive_cover_id = CASE WHEN ? = '' THEN drive_cover_id ELSE ? END")
		} else {
			nastaveni = append(nastaveni, s[0]+" = ?")
		}
	}
	dotazAddModelka = fmt.Sprintf(`INSERT INTO modelky (%s) VALUES (%s)`, strings.Join(sloupce, ", "), strings.Join(otazniky, ", "))
	dotazUpdateModelka = fmt.Sprintf(`UPDATE modelky SET %s WHERE id = ?`, strings.Join(nastaveni, ", "))
}

// Stav „neuvedeno" se u tetování a piercingu ukládá jako NULL
func anoNeDoDatabaze(hodnota int) interface{} {
	if hodnota != 0 && hodnota != 1 {
		return nil
	}
	return hodnota
}

// Klíče „netýká se": u modelky titulni, zakladni, vzhled, zarazeni, centerfold, hodnoceni; u alba text, vydani
func prepnoutKlic(seznam, klic string, pridat bool) string {
	return sbirka.PrepnoutKlic(seznam, klic, pridat)
}

func obsahujeKlic(seznam, klic string) bool {
	return sbirka.ObsahujeKlic(seznam, klic)
}

func (a *App) SetNetykaSe(modelkaID int, klic string, netyka bool) bool {
	if !klicNetykaSeModelky[klic] && !kliceKontrolyModelky[klic] && !kliceNavrhuModelky[klic] {
		return false
	}
	var seznam string
	a.db.QueryRow("SELECT COALESCE(netyka_se, '') FROM modelky WHERE id = ?", modelkaID).Scan(&seznam)
	_, err := a.db.Exec("UPDATE modelky SET netyka_se = NULLIF(?, '') WHERE id = ?", prepnoutKlic(seznam, klic, netyka), modelkaID)
	if err != nil {
		a.chyba("označení „netýká se“", err)
	} else if kliceKontrolyModelky[klic] && obsahujeKlic(seznam, klic) != netyka {
		a.zaznamenatNalez(modelkaID, "", "", klic, netyka)
	}
	return err == nil
}

func (a *App) SetNetykaSeAlba(modelkaID int, album, typ, klic string, netyka bool) bool {
	if !klicNetykaSeAlba[klic] && !kliceKontrolyAlba[klic] && !kliceNavrhuAlba[klic] {
		return false
	}
	id, err := a.zajistitAlbum(modelkaID, album, typ)
	if err == nil {
		var seznam string
		a.db.QueryRow("SELECT COALESCE(netyka_se, '') FROM alba WHERE id = ?", id).Scan(&seznam)
		_, err = a.db.Exec("UPDATE alba SET netyka_se = NULLIF(?, '') WHERE id = ?", prepnoutKlic(seznam, klic, netyka), id)
		if err == nil && kliceKontrolyAlba[klic] && obsahujeKlic(seznam, klic) != netyka {
			a.zaznamenatNalez(modelkaID, album, typ, klic, netyka)
		}
	}
	if err != nil {
		a.chyba("označení „netýká se“ u alba", err)
	}
	return err == nil
}

func (a *App) GetModelky(vyhledavani string) []Modelka {
	modelky, err := a.nactiModelky(vyhledavani, true)
	if err != nil {
		a.chyba("načtení modelek", err)
	}
	return modelky
}

// Vrací, co se přečíst podařilo, a první chybu; export podle ní pozná, že seznam není úplný. sOblibenosti doplní
// oblíbenost a odhad hodnocení (oblibenost.go) spočítané ze všech modelek, ne jen z nalezených. Modelky jsou
// ze snímku sbírky (snimek.go) seřazené podle jména bez ohledu na velikost písmen a diakritiku.
func (a *App) nactiModelky(vyhledavani string, sOblibenosti bool) ([]Modelka, error) {
	s := a.snimekSbirky()
	// Kopie: snímek sdílejí souběžná volání, volající modelky mění (oblíbenost)
	vsechny := append([]Modelka(nil), s.modelky...)
	if sOblibenosti {
		a.doplnitOblibenost(vsechny)
	}
	h := pripravitHledani(vyhledavani)
	if len(h) == 0 {
		return vsechny, s.err
	}
	shodyFotek := a.doplnitShodyFotek(h)
	texty := s.textyKHledani()
	var vysledky []Modelka
	for i := range vsechny {
		if h.Odpovida(&vsechny[i], &texty[i]) {
			vsechny[i].ShodaFotek = shodyFotek[vsechny[i].ID]
			vysledky = append(vysledky, vsechny[i])
		}
	}
	return vysledky, s.err
}

// Hodnoty modelky ve stejném pořadí jako sloupceModelky
func hodnotyModelky(m Modelka) []interface{} {
	// Míry se skládají z jednotlivých obvodů, pokud jsou vyplněné všechny
	miry := m.Miry
	if m.ObvodHrudnikCm > 0 && m.ObvodPasCm > 0 && m.ObvodBokyCm > 0 {
		miry = fmt.Sprintf("%d-%d-%d", m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm)
	}

	coverID := ""
	if ids := parseDriveIDs(m.CoverID); len(ids) > 0 {
		coverID = ids[0]
	}

	m.PrsaTyp, _ = volbaZNabidky(m.PrsaTyp, moznostiPrsaTyp)
	m.Ochlupeni, _ = volbaZNabidky(m.Ochlupeni, moznostiOchlupeni)

	return []interface{}{
		strings.TrimSpace(m.NarozeniDatum), strings.TrimSpace(m.UmrtiDatum), m.NarozeniMisto, m.Narodnost, m.Etnicita,
		m.VyskaCm, m.VahaKg, m.VlasyBarva, m.OciBarva,
		miry, m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm,
		m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, anoNeDoDatabaze(m.Tetovani), anoNeDoDatabaze(m.Piercing),
		m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags, m.DalsiJmena, m.Poznamka, m.Odkazy, coverID,
	}
}

func (a *App) AddModelka(m Modelka) bool {
	if err := overitDataModelky(m); err != nil {
		a.chyba("přidání modelky", err)
		return false
	}
	// Import předává původní datum přidání, jinak platí okamžik vložení
	pridano := m.Pridano
	if pridano == "" {
		pridano = ted()
	}
	hodnoty := hodnotyModelky(m)
	args := make([]interface{}, 0, 2+len(hodnoty))
	args = append(args, m.Jmeno, pridano)
	args = append(args, hodnoty...)

	_, err := a.pripraveny(dotazAddModelka).Exec(args...)
	if err != nil {
		a.chyba("přidání modelky", err)
	}
	return err == nil
}

// Úprava údajů modelky; prázdná titulní fotka ponechá tu stávající
func (a *App) UpdateModelka(m Modelka) bool {
	if err := overitDataModelky(m); err != nil {
		a.chyba("úprava modelky", err)
		return false
	}
	hodnoty := hodnotyModelky(m)
	args := make([]interface{}, 0, len(hodnoty)+3)
	args = append(args, m.Jmeno)
	for i, s := range sloupceModelky {
		if s[0] == "drive_cover_id" {
			args = append(args, hodnoty[i], hodnoty[i])
			continue
		}
		args = append(args, hodnoty[i])
	}
	args = append(args, m.ID)

	var puvodniCover string
	a.pripraveny(`SELECT COALESCE(drive_cover_id, '') FROM modelky WHERE id = ?`).QueryRow(m.ID).Scan(&puvodniCover)

	_, err := a.pripraveny(dotazUpdateModelka).Exec(args...)
	if err != nil {
		a.chyba("úprava modelky", err)
		return false
	}

	// Pro novou titulní fotku starý výřez neplatí
	if novyCover := hodnoty[len(hodnoty)-1]; novyCover != "" && novyCover != puvodniCover {
		a.db.Exec(`UPDATE modelky SET cover_zoom = NULL, cover_x = NULL, cover_y = NULL WHERE id = ?`, m.ID)
	}
	return true
}

// Uložení výřezu titulní fotky na kartě (přiblížení a poloha v procentech)
func (a *App) SetCoverVyrez(id int, zoom, x, y float64) bool {
	omezit := func(hodnota, min, max float64) float64 {
		// NaN (třeba „.nan“ z ručně psaného importu) by porovnáním prošel; bere se jako výchozí nejmenší hodnota
		if math.IsNaN(hodnota) || hodnota < min {
			return min
		}
		if hodnota > max {
			return max
		}
		return hodnota
	}

	z, cx, cy := omezit(zoom, 1, 4), omezit(x, 0, 100), omezit(y, 0, 100)
	_, err := a.db.Exec(`UPDATE modelky SET cover_zoom = ?, cover_x = ?, cover_y = ? WHERE id = ?`, z, cx, cy, id)
	if err != nil {
		a.chyba("uložení výřezu fotky karty", err)
		return false
	}
	a.aktualizovatVyrezVeSnimku(id, z, cx, cy)
	return true
}

func (a *App) maSloupecHodnoceniPul() bool {
	if a.maHodnoceniPulDb == a.db && a.maHodnoceniPul {
		return true
	}
	if a.maSloupec("modelky", "hodnoceni_pul") {
		a.maHodnoceniPulDb = a.db
		a.maHodnoceniPul = true
		return true
	}
	return false
}

// Hodnocení modelky 0,5–5 srdíček po polovinách; 0 hodnocení ruší. Hodnoty mimo 0–5 se oříznou, hodnota mimo
// poloviny (3,3, NaN) se odmítne a nic nezmění.
func (a *App) SetHodnoceni(modelkaID int, hodnoceni float64) bool {
	pul, ok := hodnoceniNaPoloviny(hodnoceni)
	if !ok {
		a.chyba("uložení hodnocení modelky", fmt.Errorf("hodnocení %v není po polovinách srdíčka (0–5 po 0,5)", hodnoceni))
		return false
	}
	var err error
	pred := a.snimekProOpravu()
	defer func() {
		if err == nil && pred != nil {
			a.opravitSnimek(pred, func(s *snimek) *snimek {
				idx, ok := s.indexModelky[modelkaID]
				if !ok || idx < 0 || idx >= len(s.modelky) {
					return nil
				}
				novy := kopieSnimku(s)
				novy.modelky = slices.Clone(s.modelky)
				novy.modelky[idx].Hodnoceni = float64(pul) / 2
				return novy
			})
		}
	}()
	if a.maSloupecHodnoceniPul() {
		_, err = a.pripraveny(`UPDATE modelky SET hodnoceni_pul = ?, hodnoceni = ? WHERE id = ?`).Exec(pul, pul/2, modelkaID)
	} else {
		// Databáze před úpravou č. 13 (jen při chybě úpravy, kdy se stejně zapisovat nedá)
		_, err = a.db.Exec(`UPDATE modelky SET hodnoceni = ? WHERE id = ?`, pul/2, modelkaID)
	}
	if err != nil {
		a.chyba("uložení hodnocení modelky", err)
	}
	return err == nil
}

// Hodnocení v polovinách srdíčka (0–10); mimo 0–5 se ořízne, ok = false u hodnoty mimo poloviny nebo NaN
func hodnoceniNaPoloviny(hodnoceni float64) (int, bool) {
	if math.IsNaN(hodnoceni) {
		return 0, false
	}
	hodnoceni = min(max(hodnoceni, 0), 5)
	pul := math.Round(hodnoceni * 2)
	if math.Abs(pul-hodnoceni*2) > 1e-9 {
		return 0, false
	}
	return int(pul), true
}

// Výraz pro hodnocení modelky v polovinách; databáze před úpravou č. 13 (poškozená se neupravuje) má jen celá srdíčka
func (a *App) sloupecHodnoceni() string {
	if a.maSloupecHodnoceniPul() {
		return sloupecHodnoceniPul
	}
	return "MIN(MAX(COALESCE(hodnoceni, 0), 0), 5) * 2"
}

// Titulní fotkou modelky se stane fotka z některého jejího alba
func (a *App) SetTitulniFotka(modelkaID, fotoID int) bool {
	vysledek, err := a.db.Exec(`
		UPDATE modelky SET cover_zoom = NULL, cover_x = NULL, cover_y = NULL,
			drive_cover_id = (SELECT drive_file_id FROM fotografie WHERE id = ?1)
		WHERE id = ?2 AND EXISTS (SELECT 1 FROM fotografie f LEFT JOIN alba al ON al.id = f.album_id
			WHERE f.id = ?1 AND (f.modelka_id = ?2 OR EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = al.id AND am.modelka_id = ?2)))`,
		fotoID, modelkaID)
	if err != nil {
		a.chyba("nastavení fotky karty", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

// Smazání modelky včetně všech jejích fotografií
func (a *App) DeleteModelka(id int) bool {
	// Bez zálohy se nemaže
	if err := a.zalohovat("pred-smazanim-modelky"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return false
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("smazání modelky", err)
		return false
	}
	defer tx.Rollback()

	// Sdílené album nezmizí: hlavní modelkou se stane první z dalších modelek
	type predani struct {
		album, typ string
		komu       int
	}
	var predat []predani
	if rows, err := tx.Query(`SELECT al.album, al.typ, MIN(am.modelka_id) FROM alba al JOIN alba_modelky am ON am.album_id = al.id
		WHERE al.modelka_id = ? GROUP BY al.id`, id); err == nil {
		for rows.Next() {
			var p predani
			if rows.Scan(&p.album, &p.typ, &p.komu) == nil {
				predat = append(predat, p)
			}
		}
		rows.Close()
	}
	for _, p := range predat {
		var err error
		// Stejnojmenné album už další modelka má: sdílené se s ním sloučí, fotky se neztratí
		if pocetFotekAlba(tx, p.komu, p.album, p.typ) > 0 {
			err = sloucitAlbaTx(tx, id, p.album, p.typ, p.komu, p.album, p.typ)
		} else {
			err = presunoutAlbumTx(tx, id, p.album, p.typ, p.komu)
		}
		if err != nil {
			a.chyba("smazání modelky", err)
			return false
		}
	}

	if _, err := tx.Exec("DELETE FROM fotky WHERE album_id IN (SELECT id FROM alba WHERE modelka_id = ?)", id); err != nil {
		a.chyba("smazání modelky", err)
		return false
	}
	if _, err := tx.Exec("DELETE FROM alba WHERE modelka_id = ?", id); err != nil {
		a.chyba("smazání modelky", err)
		return false
	}
	if _, err := tx.Exec("DELETE FROM modelky WHERE id = ?", id); err != nil {
		a.chyba("smazání modelky", err)
		return false
	}
	if err := tx.Commit(); err != nil {
		a.chyba("smazání modelky", err)
		return false
	}
	return true
}

// Smazání celé databáze – všech modelek i fotografií
func (a *App) DeleteVse() bool {
	// Bez zálohy se nemaže
	if err := a.zalohovat("pred-smazanim-databaze"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return false
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("smazání celé databáze", err)
		return false
	}
	defer tx.Rollback()

	dotazy := []string{
		"DELETE FROM fotky",
		"DELETE FROM alba",
		"DELETE FROM clanky",
		"DELETE FROM vydani",
		"DELETE FROM vybery",
		"DELETE FROM modelky",
		// Číslování ID začne znovu od 1
		"DELETE FROM sqlite_sequence WHERE name IN ('fotky', 'alba', 'modelky', 'vybery')",
	}
	for _, dotaz := range dotazy {
		if _, err := tx.Exec(dotaz); err != nil {
			a.chyba("smazání celé databáze", err)
			return false
		}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("smazání celé databáze", err)
		return false
	}
	return true
}
