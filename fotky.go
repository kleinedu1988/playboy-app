package main

import (
	"database/sql"
	"encoding/json"
	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	"sort"
	"strings"
)

type Fotografie = sbirka.Fotografie
type VysledekVlozeni = sbirka.VysledekVlozeni

var (
	vzorVydani     = sbirka.VzorVydani
	vzorVydaniAlba = sbirka.VzorVydaniAlba
)

func jeSpecial(vydani string) bool {
	return sbirka.JeSpecial(vydani)
}

// Vydání fotky: centerfold a cover ho mají v názvu alba, ostatní ve vlastním sloupci
const vydaniFotky = "f.vydani"

const vyberFotografii = "SELECT f.id, COALESCE(f.modelka_id, 0), f.album, f.typ, f.drive_file_id, COALESCE(f.rotace, 0), COALESCE(f.spojit, 0), " + vydaniFotky + ", COALESCE(f.hodnoceni, 0), COALESCE(f.poradi, 0), COALESCE(f.pridano, ''), f.album_id"

// Pořadí fotek v albu: nejdřív ručně seřazené, za nimi ostatní podle vložení
const razeniFotek = "f.poradi IS NULL, f.poradi, f.id"

// Připojení údajů alba k fotce; sloupce se přidávají na konec výběru
const (
	vyberPopisu     = ", COALESCE(a.popis, ''), COALESCE(a.fotograf, ''), COALESCE(a.datum, '')"
	pripojeniPopisu = " LEFT JOIN alba a ON a.id = f.album_id"
)

// Řádek alba, ke kterému už nejsou žádné fotky, nesmí zůstat: jeho popis by se objevil u nového alba téhož jména
const albumBezObsahu = `NOT EXISTS (SELECT 1 FROM fotky f WHERE f.album_id = alba.id)
	AND COALESCE(popis, '') = '' AND COALESCE(fotograf, '') = '' AND COALESCE(netyka_se, '') = ''
	AND NOT EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = alba.id)`

const smazatPrazdnaAlba = `DELETE FROM alba WHERE ` + albumBezObsahu

func (a *App) nacistFotografie(query string, sJmenem, sPopisem bool, args ...interface{}) []Fotografie {
	fotky, err := a.nactiFotografie(query, sJmenem, sPopisem, args...)
	if err != nil {
		a.chyba("načtení fotek", err)
	}
	return fotky
}

// Vrací, co se přečíst podařilo, a první chybu
func (a *App) nactiFotografie(query string, sJmenem, sPopisem bool, args ...interface{}) ([]Fotografie, error) {
	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prvniChyba error
	var fotky []Fotografie
	var f Fotografie
	var driveID string
	var poleCilu [16]interface{}
	poleCilu[0] = &f.ID
	poleCilu[1] = &f.ModelkaID
	poleCilu[2] = &f.Album
	poleCilu[3] = &f.Typ
	poleCilu[4] = &driveID
	poleCilu[5] = &f.Rotace
	poleCilu[6] = &f.Spojit
	poleCilu[7] = &f.Vydani
	poleCilu[8] = &f.Hodnoceni
	poleCilu[9] = &f.Poradi
	poleCilu[10] = &f.Pridano
	poleCilu[11] = &f.AlbumID
	pocetCilu := 12
	if sJmenem {
		poleCilu[pocetCilu] = &f.JmenoModelky
		pocetCilu++
	}
	if sPopisem {
		poleCilu[pocetCilu] = &f.Popis
		poleCilu[pocetCilu+1] = &f.Fotograf
		poleCilu[pocetCilu+2] = &f.DatumAlba
		pocetCilu += 3
	}
	cile := poleCilu[:pocetCilu]

	for rows.Next() {
		f = Fotografie{}
		driveID = ""
		if err := rows.Scan(cile...); err != nil {
			if prvniChyba == nil {
				prvniChyba = err
			}
			continue
		}
		f.DriveID = driveID
		f.URL = adresaObrazku(driveID)
		fotky = append(fotky, f)
	}
	if err := rows.Err(); err != nil && prvniChyba == nil {
		prvniChyba = err
	}
	return fotky, prvniChyba
}

const dotazFotekModelky = vyberFotografii + vyberPopisu + " FROM fotografie f" + pripojeniPopisu + ` WHERE f.album_id IN (
	SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = ?1 UNION SELECT album_id FROM alba_modelky WHERE modelka_id = ?1)
	ORDER BY ` + razeniFotek

const dotazFotekVsechModelek = vyberFotografii + vyberPopisu + " FROM fotografie f" + pripojeniPopisu + `
	WHERE f.modelka_id <> 0 ORDER BY f.modelka_id, ` + razeniFotek

func (a *App) GetFotografieModelky(modelkaID int) []Fotografie {
	return a.doplnitDalsiModelky(a.nacistFotografie(dotazFotekModelky, false, true, modelkaID))
}

func (a *App) GetCenterfoldy() FrontaFotek {
	return a.nacistFrontu("centerfoldy", `a.typ = 'Centerfold'`)
}

func (a *App) centerfoldy() []Fotografie {
	return a.nacistFotografie(vyberFotografii+`, m.jmeno`+vyberPopisu+` FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE f.typ = 'Centerfold'
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true)
}

const dotazCoveru = vyberFotografii + ` FROM fotografie f
		WHERE f.typ = 'Cover' AND f.modelka_id = 0
		ORDER BY f.album DESC, f.id`

func (a *App) GetCovery() []Fotografie {
	return a.nacistFotografie(dotazCoveru, false, false)
}

// Přidání coveru (nebo více coverů) k vydání časopisu
func (a *App) AddCover(vydani, rawLinks string) VysledekVlozeni {
	if !vzorVydani.MatchString(vydani) {
		return VysledekVlozeni{}
	}
	return a.AddBulkPhotos(0, vydani, "Cover", rawLinks)
}

// Změna vydání coveru; prázdný odkaz ponechá stávající obrázek
func (a *App) UpdateCover(id int, vydani, rawLink string) bool {
	if !vzorVydani.MatchString(vydani) {
		return false
	}
	var typ string
	if a.db.QueryRow("SELECT typ FROM fotografie WHERE id = ?", id).Scan(&typ); typ != "Cover" {
		return false
	}
	return a.vTransakci("úprava coveru", func(tx dotazovac) error {
		albumID, err := zajistitAlbum(tx, 0, vydani, "Cover")
		if err != nil {
			return err
		}
		if _, err := tx.Exec("UPDATE fotky SET album_id = ? WHERE id = ?", albumID, id); err != nil {
			return err
		}
		if ids := parseDriveIDs(rawLink); len(ids) > 0 {
			if _, err := tx.Exec("UPDATE fotky SET drive_file_id = ? WHERE id = ?", ids[0], id); err != nil {
				return err
			}
		}
		_, err = tx.Exec(smazatPrazdnaAlba)
		return err
	})
}

func (a *App) GetVydani(vydani string) []Fotografie {
	if !vzorVydaniAlba.MatchString(vydani) {
		return nil
	}
	podminka, args := vydaniFotky+" = ?", []interface{}{vydani}
	if rok, edice, casopis, jenRocnik := rozlozitRocnik(vydani); jenRocnik {
		vzor, vzorSpecialu := rok+"-[0-1][0-9]", rok+"-S[0-9][0-9]"
		if edice != "" {
			vzor += "-" + edice
			vzorSpecialu += "-" + edice
		}
		if casopis != "" {
			vzor += "@" + casopis
			vzorSpecialu += "@" + casopis
		}
		podminka, args = "("+vydaniFotky+" = ? OR "+vydaniFotky+" GLOB ? OR "+vydaniFotky+" GLOB ?)", []interface{}{vydani, vzor, vzorSpecialu}
	}
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE `+podminka+`
		ORDER BY `+vydaniFotky+`, m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true, args...))
}

// „1975" → 1975, "", "", true; „1975-CZ" → 1975, "CZ", "", true; „1975-UK@PH" → 1975, "UK", "PH", true;
// vydání s měsícem → false
func rozlozitRocnik(vydani string) (rok, edice, casopis string, jenRocnik bool) {
	zaklad, casopis := hledani.RozdelitCasopis(vydani)
	if len(zaklad) == 4 {
		return zaklad, "", casopis, true
	}
	if len(zaklad) == 7 && zaklad[4] == '-' && zaklad[5] >= 'A' {
		return zaklad[:4], zaklad[5:], casopis, true
	}
	return "", "", "", false
}

// Fotky s aspoň minHodnoceni srdíčky napříč sbírkou, po modelkách od nejlépe hodnocených
func (a *App) GetNejlepsiFotky(minHodnoceni int) []Fotografie {
	if minHodnoceni < 1 {
		minHodnoceni = 1
	}
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE COALESCE(f.hodnoceni, 0) >= ?
		ORDER BY m.jmeno IS NULL, m.jmeno COLLATE BEZDIAKRITIKY, f.hodnoceni DESC, f.album, f.id`, true, true, minHodnoceni))
}

func (a *App) GetNehodnoceneFotky() FrontaFotek {
	return a.nacistFrontu("nehodnocené fotky", `COALESCE(f.hodnoceni, 0) = 0`)
}

func (a *App) GetPocetNehodnocenychFotek() int {
	if s := a.snimekVPameti(); s != nil && s.err == nil {
		n := 0
		for i := range s.alba {
			n += s.alba[i].fotek - s.alba[i].hodnocenych
		}
		return n
	}
	return a.pocetNehodnocenychZDatabaze()
}

func (a *App) pocetNehodnocenychZDatabaze() int {
	var n int
	a.db.QueryRow(`SELECT COUNT(*) FROM fotografie f JOIN modelky m ON m.id = f.modelka_id
		WHERE COALESCE(f.hodnoceni, 0) = 0`).Scan(&n)
	return n
}

func (a *App) GetAlbaFotografa(fotograf string) []Fotografie {
	hledany := zjednodusit(strings.TrimSpace(fotograf))
	fotky := []Fotografie{}
	if hledany == "" {
		return fotky
	}
	var alba []int
	radky, err := a.db.Query(`SELECT id, fotograf FROM alba WHERE COALESCE(fotograf, '') <> ''`)
	if err != nil {
		a.chyba("alba fotografa", err)
		return fotky
	}
	for radky.Next() {
		var id int
		var jmena string
		if radky.Scan(&id, &jmena) != nil {
			continue
		}
		for _, jmeno := range strings.Split(jmena, ",") {
			if zjednodusit(strings.TrimSpace(jmeno)) == hledany {
				alba = append(alba, id)
				break
			}
		}
	}
	radky.Close()
	if len(alba) == 0 {
		return fotky
	}
	idAlb, _ := json.Marshal(alba)
	fotky = a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE f.album_id IN (SELECT value FROM json_each(?))
		ORDER BY `+vydaniFotky+`, m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true, string(idAlb))
	return a.doplnitDalsiModelky(fotky)
}

func (a *App) GetPrehledVydani() []Fotografie {
	return a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '') FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id
		WHERE `+vydaniFotky+` <> ''
		ORDER BY `+vydaniFotky+`, f.id`, true, false)
}

// Hodnocení fotek 1–5 srdíček (u spojeného plakátu všech jeho stránek najednou); 0 hodnocení ruší
func (a *App) SetHodnoceniFotek(ids []int, hodnoceni int) bool {
	if hodnoceni < 0 {
		hodnoceni = 0
	}
	if hodnoceni > 5 {
		hodnoceni = 5
	}
	pred := a.snimekProOpravu()
	var zmeny []zmenaSrdicekFotky
	ok := a.vTransakci("uložení hodnocení fotek", func(tx dotazovac) error {
		for _, id := range ids {
			if pred != nil {
				var z zmenaSrdicekFotky
				if err := tx.QueryRow(`SELECT album_id, COALESCE(hodnoceni, 0) FROM fotky WHERE id = ?`, id).Scan(&z.album, &z.stare); err == nil {
					z.nove = hodnoceni
					zmeny = append(zmeny, z)
				}
			}
			if _, err := tx.Exec(`UPDATE fotky SET hodnoceni = ? WHERE id = ?`, hodnoceni, id); err != nil {
				return err
			}
		}
		return nil
	})
	if ok && pred != nil && len(zmeny) == len(ids) {
		a.opravitSnimek(pred, func(s *snimek) *snimek { return opravitSrdickaFotek(s, zmeny) })
	}
	return ok
}

// Ruční pořadí fotek alba (nebo stránek spojeného plakátu): fotky dostanou pořadí podle místa v seznamu
func (a *App) SetPoradiFotek(ids []int) bool {
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("uložení pořadí fotek", err)
		return false
	}
	defer tx.Rollback()

	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE fotky SET poradi = ? WHERE id = ?`, i+1, id); err != nil {
			a.chyba("uložení pořadí fotek", err)
			return false
		}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("uložení pořadí fotek", err)
		return false
	}
	return true
}

// Zrušení ručního pořadí: album se znovu řadí podle hodnocení a vložení
func (a *App) ZrusitPoradiAlba(modelkaID int, album, typ string) bool {
	_, err := a.db.Exec("UPDATE fotky SET poradi = NULL WHERE album_id = (SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?)", modelkaID, album, typ)
	if err != nil {
		a.chyba("zrušení ručního pořadí alba", err)
	}
	return err == nil
}

// Přiřazení alba (typicky pictorialu) k vydání časopisu; prázdné vydání přiřazení ruší
func (a *App) SetVydaniAlba(modelkaID int, album, typ, vydani string) bool {
	if vydani != "" && (!vzorVydaniAlba.MatchString(vydani) || jeOnlineTyp(typ) || !a.znamaRada(edicePodleVydani(vydani))) {
		return false
	}
	_, err := a.pripraveny("UPDATE alba SET vydani = ? WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND typ NOT IN ('Centerfold', 'Cover', ?, ?, ?)").Exec(
		vydani, modelkaID, album, typ, typOnline, typCGTydne, typCGMesice)
	if err != nil {
		a.chyba("přiřazení alba k číslu", err)
	}
	return err == nil
}

func (a *App) SetDatumAlba(modelkaID int, album, typ, datum string) bool {
	datum = strings.TrimSpace(datum)
	if !platneDatum(datum) || (!jeOnlineTyp(typ) && datum != "") {
		return false
	}
	_, err := a.pripraveny("UPDATE alba SET datum = NULLIF(?, '') WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND typ IN (?, ?, ?)").Exec(
		datum, modelkaID, album, typ, typOnline, typCGTydne, typCGMesice)
	if err != nil {
		a.chyba("uložení data nafocení alba", err)
	}
	return err == nil
}

// Uložení otočení fotek (u spojeného plakátu všech jeho stránek najednou)
func (a *App) SetRotaceFotek(ids []int, rotace int) bool {
	rotace = ((rotace % 360) + 360) % 360
	return a.vTransakci("otočení fotek", func(tx dotazovac) error {
		for _, id := range ids {
			if _, err := tx.Exec("UPDATE fotky SET rotace = ? WHERE id = ?", rotace, id); err != nil {
				return err
			}
		}
		return nil
	})
}

// Zapnutí nebo vypnutí spojení stránek alba do jednoho plakátu
func (a *App) SetSpojeniAlba(modelkaID int, album, typ string, spojit bool) bool {
	id, err := a.zajistitAlbum(modelkaID, album, typ)
	if err == nil {
		_, err = a.db.Exec("UPDATE alba SET spojit = ? WHERE id = ?", spojit, id)
	}
	if err == nil {
		_, err = a.db.Exec("UPDATE fotky SET rotace = 0 WHERE album_id = ?", id)
	}
	if err != nil {
		a.chyba("spojení stránek alba", err)
	}
	return err == nil
}

// Přejmenování alba nebo změna jeho typu; album je určeno modelkou, názvem a typem
func (a *App) UpdateAlbum(modelkaID int, staryAlbum, staryTyp, novyAlbum, novyTyp string) bool {
	if staryAlbum == novyAlbum && staryTyp == novyTyp {
		return true
	}
	if err := a.overitKlicAlba(modelkaID, novyAlbum, novyTyp); err != nil {
		a.chyba("úprava alba", err)
		return false
	}
	a.db.Exec("DELETE FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND "+albumBezObsahu, modelkaID, novyAlbum, novyTyp)
	var obsazeno int
	a.db.QueryRow("SELECT COUNT(*) FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?", modelkaID, novyAlbum, novyTyp).Scan(&obsazeno)
	if obsazeno > 0 {
		return false
	}

	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("úprava alba", err)
		return false
	}
	defer tx.Rollback()

	dotazy := []string{
		`UPDATE alba SET album = ?1, typ = ?2,
			vydani = CASE WHEN ?2 IN ('Centerfold', 'Cover') THEN ?1 WHEN ?2 IN (?6, ?7, ?8) OR typ IN ('Centerfold', 'Cover') THEN '' ELSE vydani END,
			datum = CASE WHEN ?2 IN (?6, ?7, ?8) THEN datum END
		WHERE COALESCE(modelka_id, 0) = ?3 AND album = ?4 AND typ = ?5`,
	}
	for _, dotaz := range dotazy {
		if _, err := tx.Exec(dotaz, novyAlbum, novyTyp, modelkaID, staryAlbum, staryTyp, typOnline, typCGTydne, typCGMesice); err != nil {
			a.chyba("úprava alba", err)
			return false
		}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("úprava alba", err)
		return false
	}
	return true
}

// Průvodní text a fotograf alba; obojí prázdné údaje alba ruší
func (a *App) SetPopisAlba(modelkaID int, album, typ, popis, fotograf string) bool {
	popis, fotograf = strings.TrimSpace(popis), strings.TrimSpace(fotograf)

	var id int64
	err := a.pripraveny(dotazIDAlba).QueryRow(modelkaID, album, typ).Scan(&id)
	if err == sql.ErrNoRows {
		return popis == "" && fotograf == ""
	}
	if err == nil {
		_, err = a.pripraveny("UPDATE alba SET popis = NULLIF(?, ''), fotograf = NULLIF(?, '') WHERE id = ?").Exec(popis, fotograf, id)
	}
	if err == nil && popis == "" && fotograf == "" {
		_, err = a.db.Exec(smazatPrazdnaAlba)
	}
	if err != nil {
		a.chyba("uložení popisu alba", err)
	}
	return err == nil
}

// Fotografové ze všech alb sbírky pro našeptávání, aby se stejné jméno psalo vždy stejně
func (a *App) GetFotografove() []string {
	fotografove := []string{}
	rows, err := a.db.Query("SELECT DISTINCT TRIM(fotograf) FROM alba WHERE TRIM(COALESCE(fotograf, '')) <> ''")
	if err != nil {
		a.chyba("načtení fotografů", err)
		return fotografove
	}
	defer rows.Close()
	for rows.Next() {
		var jmeno string
		if rows.Scan(&jmeno) == nil {
			fotografove = append(fotografove, jmeno)
		}
	}
	sort.Slice(fotografove, func(i, j int) bool { return zjednodusit(fotografove[i]) < zjednodusit(fotografove[j]) })
	return fotografove
}

// Smazání celého alba (všech jeho fotek) z databáze
func (a *App) DeleteAlbum(modelkaID int, album, typ string) bool {
	if err := a.zalohovat("pred-smazanim-alba"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return false
	}
	_, err := a.db.Exec("DELETE FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?", modelkaID, album, typ)
	if err != nil {
		a.chyba("smazání alba", err)
	}
	return err == nil
}

// Odebrání více fotek najednou (nedostupné soubory): jedna záloha předem a jedna transakce
func (a *App) DeleteFotografieHromadne(ids []int) bool {
	if len(ids) == 0 {
		return true
	}
	if err := a.zalohovat("pred-odebranim-fotek"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return false
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("smazání fotek", err)
		return false
	}
	defer tx.Rollback()

	for _, id := range ids {
		if _, err := tx.Exec("DELETE FROM fotky WHERE id = ?", id); err != nil {
			a.chyba("smazání fotek", err)
			return false
		}
	}
	if _, err := tx.Exec(smazatPrazdnaAlba); err != nil {
		a.chyba("smazání fotek", err)
		return false
	}
	if err := tx.Commit(); err != nil {
		a.chyba("smazání fotek", err)
		return false
	}
	return true
}

// Odebrání jedné fotky z alba
func (a *App) DeleteFotografie(id int) bool {
	_, err := a.db.Exec("DELETE FROM fotky WHERE id = ?", id)
	if err == nil {
		_, err = a.db.Exec(smazatPrazdnaAlba)
	}
	if err != nil {
		a.chyba("smazání fotky", err)
	}
	return err == nil
}

// Které ze souborů ids už v albu (modelka, název, typ) jsou; dotaz po pěti stech souborech místo dotazu na každý
func (a *App) souboryVAlbu(modelkaID int, album, typ string, ids []string) (map[string]bool, error) {
	vAlbu := map[string]bool{}
	for zacatek := 0; zacatek < len(ids); zacatek += 500 {
		cast := ids[zacatek:min(len(ids), zacatek+500)]
		args := make([]interface{}, 0, 3+len(cast))
		args = append(args, modelkaID, album, typ)
		for _, id := range cast {
			args = append(args, id)
		}
		radky, err := a.db.Query(`SELECT f.drive_file_id FROM fotky f JOIN alba al ON al.id = f.album_id
			WHERE COALESCE(al.modelka_id, 0) = ? AND al.album = ? AND al.typ = ? AND f.drive_file_id IN (?`+strings.Repeat(", ?", len(cast)-1)+`)`, args...)
		if err != nil {
			return nil, err
		}
		for radky.Next() {
			var id string
			if err := radky.Scan(&id); err != nil {
				radky.Close()
				return nil, err
			}
			vAlbu[id] = true
		}
		radky.Close()
		if err := radky.Err(); err != nil {
			return nil, err
		}
	}
	return vAlbu, nil
}

// Hromadné vložení fotek/odkazů do alba modelky
func (a *App) AddBulkPhotos(modelkaID int, album, typ, rawLinks string) VysledekVlozeni {
	var vysledek VysledekVlozeni
	if err := a.overitKlicAlba(modelkaID, album, typ); err != nil {
		a.chyba("vložení fotek do alba", err)
		return vysledek
	}

	odkazy := parseDriveIDs(rawLinks)
	vAlbu, err := a.souboryVAlbu(modelkaID, album, typ, odkazy)
	if err != nil {
		a.chyba("vložení fotek do alba", err)
		return vysledek
	}
	var ids []string
	for _, id := range odkazy {
		if vAlbu[id] {
			vysledek.Duplicitni++
			continue
		}
		ids = append(ids, id)
	}

	var albumID int64
	var rotace int
	if len(ids) > 0 {
		var err error
		if albumID, err = a.zajistitAlbum(modelkaID, album, typ); err != nil {
			a.chyba("vložení fotek do alba", err)
			return vysledek
		}
		a.db.QueryRow("SELECT CASE WHEN spojit = 1 THEN COALESCE((SELECT MAX(rotace) FROM fotky WHERE album_id = alba.id), 0) ELSE 0 END FROM alba WHERE id = ?",
			albumID).Scan(&rotace)
	}

	stavy := overitSoubory(ids)
	for _, stav := range stavy {
		if stav == souborNedostupny {
			vysledek.Nedostupne++
		}
	}
	vlozeno, neovereno := 0, 0
	if a.vTransakci("vložení fotek do alba", func(q dotazovac) error {
		vlozeno, neovereno = 0, 0
		for i, stav := range stavy {
			if stav == souborNedostupny {
				continue
			}
			var overeno interface{}
			if stav == souborDostupny {
				overeno = dnes()
			}
			if _, err := q.Exec("INSERT INTO fotky (album_id, drive_file_id, rotace, pridano, overeno) VALUES (?, ?, ?, ?, ?)",
				albumID, ids[i], rotace, ted(), overeno); err != nil {
				a.chyba("vložení fotek do alba", err)
				continue
			}
			vlozeno++
			if stav == souborNeoveren {
				neovereno++
			}
		}
		return nil
	}) {
		vysledek.Vlozeno, vysledek.Neovereno = vlozeno, neovereno
	}
	if albumID != 0 && vysledek.Vlozeno == 0 {
		if _, err := a.db.Exec("DELETE FROM alba WHERE id = ? AND "+albumBezObsahu, albumID); err != nil {
			a.chyba("vložení fotek do alba", err)
		}
	}
	return vysledek
}
