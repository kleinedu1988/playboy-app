package main

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"
)

// Opravy bez mazání: alba sdílená více modelkami, přesuny a slučování alb, fotek i modelek,
// vrácení odebraných fotek a hromadné přejmenování fotografa či tagu.
//
// Album dál určuje jeho hlavní modelka, název a typ (fotky mají tyto tři údaje u sebe). Stálou identitu
// mu dává řádek v tabulce alba; k němu se váží další modelky alba (alba_modelky).

type OdkazModelky struct {
	ID    int    `json:"id"`
	Jmeno string `json:"jmeno"`
}

// Spouští dotazy v databázi i uvnitř transakce
type dotazovac interface {
	Exec(dotaz string, args ...interface{}) (sql.Result, error)
	Query(dotaz string, args ...interface{}) (*sql.Rows, error)
	QueryRow(dotaz string, args ...interface{}) *sql.Row
}

// Úprava č. 3: další modelky alba a stav dostupnosti souborů
func (a *App) migraceSdilenaAlba() error {
	kroky := []string{
		`CREATE TABLE IF NOT EXISTS alba_modelky (
			album_id INTEGER NOT NULL,
			modelka_id INTEGER NOT NULL,
			PRIMARY KEY (album_id, modelka_id)
		)`,
		// Vazby mizí samy se smazaným albem i modelkou
		`CREATE TRIGGER IF NOT EXISTS alba_modelky_po_albu AFTER DELETE ON alba
			BEGIN DELETE FROM alba_modelky WHERE album_id = OLD.id; END`,
		`CREATE TRIGGER IF NOT EXISTS alba_modelky_po_modelce AFTER DELETE ON modelky
			BEGIN DELETE FROM alba_modelky WHERE modelka_id = OLD.id; END`,
	}
	for _, krok := range kroky {
		if _, err := a.db.Exec(krok); err != nil {
			return err
		}
	}
	// Kdy byl soubor naposledy ověřen jako dostupný a od kdy je nedostupný (RRRR-MM-DD)
	for _, sloupec := range []string{"overeno", "nedostupne_od"} {
		if !a.maSloupec("fotografie", sloupec) {
			if _, err := a.db.Exec("ALTER TABLE fotografie ADD COLUMN " + sloupec + " TEXT"); err != nil {
				return err
			}
		}
	}
	return nil
}

// Řádek alba (vytvoří se, pokud ještě není); vrací jeho id
func zajistitAlbum(q dotazovac, modelkaID int, album, typ string) (int64, error) {
	if _, err := q.Exec("INSERT OR IGNORE INTO alba (modelka_id, album, typ) VALUES (?, ?, ?)", modelkaID, album, typ); err != nil {
		return 0, err
	}
	var id int64
	err := q.QueryRow("SELECT id FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?", modelkaID, album, typ).Scan(&id)
	return id, err
}

func pocetFotekAlba(q dotazovac, modelkaID int, album, typ string) int {
	var pocet int
	q.QueryRow("SELECT COUNT(*) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ?", modelkaID, album, typ).Scan(&pocet)
	return pocet
}

func (a *App) jmenoModelky(id int) string {
	var jmeno string
	a.db.QueryRow("SELECT jmeno FROM modelky WHERE id = ?", id).Scan(&jmeno)
	return jmeno
}

// Další modelky alb podle klíče „modelka\nalbum\ntyp"
func (a *App) dalsiModelkyAlb() map[string][]OdkazModelky {
	vysledek := map[string][]OdkazModelky{}
	rows, err := a.db.Query(`SELECT al.modelka_id, al.album, al.typ, m.id, m.jmeno
		FROM alba_modelky am JOIN alba al ON al.id = am.album_id JOIN modelky m ON m.id = am.modelka_id
		ORDER BY m.jmeno COLLATE NOCASE`)
	if err != nil {
		return vysledek
	}
	defer rows.Close()
	for rows.Next() {
		var modelkaID int
		var album, typ string
		var odkaz OdkazModelky
		if rows.Scan(&modelkaID, &album, &typ, &odkaz.ID, &odkaz.Jmeno) == nil {
			klic := fmt.Sprintf("%d\n%s\n%s", modelkaID, album, typ)
			vysledek[klic] = append(vysledek[klic], odkaz)
		}
	}
	return vysledek
}

// Fotkám doplní další modelky jejich alba
func (a *App) doplnitDalsiModelky(fotky []Fotografie) []Fotografie {
	dalsi := a.dalsiModelkyAlb()
	for i := range fotky {
		fotky[i].DalsiModelky = dalsi[fmt.Sprintf("%d\n%s\n%s", fotky[i].ModelkaID, fotky[i].Album, fotky[i].Typ)]
		if fotky[i].DalsiModelky == nil {
			fotky[i].DalsiModelky = []OdkazModelky{}
		}
	}
	return fotky
}

// Další modelka alba: album se ukáže i v jejím profilu
func (a *App) PridatModelkuKAlbu(modelkaID int, album, typ string, dalsiID int) bool {
	if dalsiID == modelkaID || a.jmenoModelky(dalsiID) == "" || pocetFotekAlba(a.db, modelkaID, album, typ) == 0 {
		return false
	}
	id, err := zajistitAlbum(a.db, modelkaID, album, typ)
	if err == nil {
		_, err = a.db.Exec("INSERT OR IGNORE INTO alba_modelky (album_id, modelka_id) VALUES (?, ?)", id, dalsiID)
	}
	if err != nil {
		a.chyba("PridatModelkuKAlbu", err)
	}
	return err == nil
}

func (a *App) OdebratModelkuZAlba(modelkaID int, album, typ string, dalsiID int) bool {
	_, err := a.db.Exec(`DELETE FROM alba_modelky WHERE modelka_id = ?
		AND album_id = (SELECT id FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?)`, dalsiID, modelkaID, album, typ)
	if err != nil {
		a.chyba("OdebratModelkuZAlba", err)
	}
	return err == nil
}

// Album celé k jiné modelce (hlavní modelka se změní, fotky, srdíčka, pořadí i text zůstanou)
func presunoutAlbumTx(tx *sql.Tx, modelkaID int, album, typ string, cilID int) error {
	kroky := []struct {
		dotaz string
		args  []interface{}
	}{
		// Pozůstatek prázdného alba téhož jména u cílové modelky by přesun zablokoval
		{"DELETE FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?", []interface{}{cilID, album, typ}},
		{"UPDATE alba SET modelka_id = ? WHERE modelka_id = ? AND album = ? AND typ = ?", []interface{}{cilID, modelkaID, album, typ}},
		{"UPDATE fotografie SET modelka_id = ? WHERE modelka_id = ? AND album = ? AND typ = ?", []interface{}{cilID, modelkaID, album, typ}},
		// Hlavní modelka už nemusí být vedená i jako další
		{`DELETE FROM alba_modelky WHERE modelka_id = ?
			AND album_id = (SELECT id FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?)`, []interface{}{cilID, cilID, album, typ}},
	}
	for _, krok := range kroky {
		if _, err := tx.Exec(krok.dotaz, krok.args...); err != nil {
			return err
		}
	}
	return nil
}

// Přesun alba k jiné modelce; vrací text chyby, prázdný při úspěchu
func (a *App) PresunoutAlbum(modelkaID int, album, typ string, cilID int) string {
	cil := a.jmenoModelky(cilID)
	switch {
	case cil == "" || cilID == modelkaID:
		return "Vyber jinou modelku."
	case pocetFotekAlba(a.db, cilID, album, typ) > 0:
		return fmt.Sprintf("Modelka %s už má album stejného názvu a typu. Použij Sloučit s albem.", cil)
	}
	tx, err := a.db.Begin()
	if err == nil {
		defer tx.Rollback()
		if err = presunoutAlbumTx(tx, modelkaID, album, typ, cilID); err == nil {
			err = tx.Commit()
		}
	}
	if err != nil {
		a.chyba("PresunoutAlbum", err)
		return "Album se nepodařilo přesunout."
	}
	return ""
}

// Fotky jednoho alba do jiného (i jiné modelky). Soubor, který v cílovém albu už je, se nepřesouvá, ale smaže,
// aby nevznikl dvakrát. Přesunuté fotky přebírají vydání a spojení plakátu cílového alba a řadí se za jeho fotky.
func sloucitAlbaTx(tx *sql.Tx, zModelka int, zAlbum, zTyp string, doModelka int, doAlbum, doTyp string) error {
	var vydani string
	var spojit, rotace int
	tx.QueryRow("SELECT COALESCE(MAX(vydani), ''), COALESCE(MAX(spojit), 0), COALESCE(MAX(CASE WHEN spojit = 1 THEN rotace END), 0) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ?",
		doModelka, doAlbum, doTyp).Scan(&vydani, &spojit, &rotace)

	if _, err := tx.Exec(`DELETE FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND drive_file_id IN
		(SELECT drive_file_id FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ?)`, zModelka, zAlbum, zTyp, doModelka, doAlbum, doTyp); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE fotografie SET modelka_id = ?, album = ?, typ = ?, vydani = ?, spojit = ?,
		rotace = CASE WHEN ? = 1 THEN ? ELSE rotace END, poradi = NULL
		WHERE modelka_id = ? AND album = ? AND typ = ?`, doModelka, doAlbum, doTyp, vydani, spojit, spojit, rotace, zModelka, zAlbum, zTyp); err != nil {
		return err
	}

	// Text a další modelky zdrojového alba přejdou na cílové; vlastní text cílového alba má přednost
	var zdrojID int64
	var popis, fotograf string
	if err := tx.QueryRow("SELECT id, COALESCE(popis, ''), COALESCE(fotograf, '') FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?",
		zModelka, zAlbum, zTyp).Scan(&zdrojID, &popis, &fotograf); err == nil {
		cilID, err := zajistitAlbum(tx, doModelka, doAlbum, doTyp)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE alba SET popis = COALESCE(NULLIF(popis, ''), NULLIF(?, '')), fotograf = COALESCE(NULLIF(fotograf, ''), NULLIF(?, '')) WHERE id = ?`,
			popis, fotograf, cilID); err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO alba_modelky (album_id, modelka_id)
			SELECT ?, modelka_id FROM alba_modelky WHERE album_id = ? AND modelka_id <> ?`, cilID, zdrojID, doModelka); err != nil {
			return err
		}
		if _, err := tx.Exec("DELETE FROM alba WHERE id = ?", zdrojID); err != nil {
			return err
		}
	}
	return nil
}

// Sloučení dvou alb téže modelky (typicky album s jedinou fotkou vzniklé překlepem v názvu)
func (a *App) SloucitAlba(modelkaID int, zAlbum, zTyp, doAlbum, doTyp string) string {
	if zAlbum == doAlbum && zTyp == doTyp {
		return "Vyber jiné album."
	}
	if pocetFotekAlba(a.db, modelkaID, doAlbum, doTyp) == 0 {
		return "Cílové album neexistuje."
	}
	if err := a.zalohovat("pred-sloucenim"); err != nil {
		a.chyba("zálohy", err)
		return "Nepodařilo se vytvořit zálohu, nic se nezměnilo."
	}
	tx, err := a.db.Begin()
	if err == nil {
		defer tx.Rollback()
		if err = sloucitAlbaTx(tx, modelkaID, zAlbum, zTyp, modelkaID, doAlbum, doTyp); err == nil {
			err = tx.Commit()
		}
	}
	if err != nil {
		a.chyba("SloucitAlba", err)
		return "Alba se nepodařilo sloučit."
	}
	return ""
}

type VysledekPresunu struct {
	Presunuto  int `json:"presunuto"`
	Duplicitni int `json:"duplicitni"` // v cílovém albu už jsou – zůstaly na místě
}

// Vybrané fotky do jiného alba (i nového nebo jiné modelky); přebírají jeho vydání a spojení plakátu
func (a *App) PresunoutFotky(ids []int, modelkaID int, album, typ string) VysledekPresunu {
	var vysledek VysledekPresunu
	album, typ = strings.TrimSpace(album), strings.TrimSpace(typ)
	if album == "" || typ == "" || (modelkaID != 0 && a.jmenoModelky(modelkaID) == "") {
		return vysledek
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("PresunoutFotky", err)
		return vysledek
	}
	defer tx.Rollback()

	var vydani string
	var spojit, rotace int
	tx.QueryRow("SELECT COALESCE(MAX(vydani), ''), COALESCE(MAX(spojit), 0), COALESCE(MAX(CASE WHEN spojit = 1 THEN rotace END), 0) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ?",
		modelkaID, album, typ).Scan(&vydani, &spojit, &rotace)
	for _, id := range ids {
		var stejny int
		tx.QueryRow(`SELECT COUNT(*) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND id <> ?
			AND drive_file_id = (SELECT drive_file_id FROM fotografie WHERE id = ?)`, modelkaID, album, typ, id, id).Scan(&stejny)
		if stejny > 0 {
			vysledek.Duplicitni++
			continue
		}
		zmena, err := tx.Exec(`UPDATE fotografie SET modelka_id = ?, album = ?, typ = ?, vydani = ?, spojit = ?,
			rotace = CASE WHEN ? = 1 THEN ? ELSE rotace END, poradi = NULL WHERE id = ?`, modelkaID, album, typ, vydani, spojit, spojit, rotace, id)
		if err != nil {
			a.chyba("PresunoutFotky", err)
			return VysledekPresunu{}
		}
		if n, _ := zmena.RowsAffected(); n > 0 {
			vysledek.Presunuto++
		}
	}
	if _, err := tx.Exec(smazatPrazdnaAlba); err != nil {
		a.chyba("PresunoutFotky", err)
		return VysledekPresunu{}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("PresunoutFotky", err)
		return VysledekPresunu{}
	}
	return vysledek
}

// Sloučení duplicitní modelky do jiné: alba přejdou (stejnojmenná se sloučí), prázdné údaje se doplní,
// jméno a pseudonymy zdrojové modelky se přidají mezi pseudonymy. Vrací text chyby, prázdný při úspěchu.
func (a *App) SloucitModelky(cilID, zdrojID int) string {
	var cil, zdroj *Modelka
	for _, m := range a.GetModelky("") {
		m := m
		switch m.ID {
		case cilID:
			cil = &m
		case zdrojID:
			zdroj = &m
		}
	}
	if cil == nil || zdroj == nil || cilID == zdrojID {
		return "Vyber jinou modelku."
	}
	if err := a.zalohovat("pred-sloucenim-modelek"); err != nil {
		a.chyba("zálohy", err)
		return "Nepodařilo se vytvořit zálohu, nic se nezměnilo."
	}

	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("SloucitModelky", err)
		return "Modelky se nepodařilo sloučit."
	}
	defer tx.Rollback()

	type klicAlba struct{ album, typ string }
	var alba []klicAlba
	rows, err := tx.Query("SELECT DISTINCT album, typ FROM fotografie WHERE modelka_id = ?", zdrojID)
	if err == nil {
		for rows.Next() {
			var k klicAlba
			if rows.Scan(&k.album, &k.typ) == nil {
				alba = append(alba, k)
			}
		}
		rows.Close()
	}
	for _, k := range alba {
		if pocetFotekAlba(tx, cilID, k.album, k.typ) > 0 {
			err = sloucitAlbaTx(tx, zdrojID, k.album, k.typ, cilID, k.album, k.typ)
		} else {
			err = presunoutAlbumTx(tx, zdrojID, k.album, k.typ, cilID)
		}
		if err != nil {
			a.chyba("SloucitModelky", err)
			return "Modelky se nepodařilo sloučit."
		}
	}
	// Alba, kde byla zdrojová modelka vedená jako další, teď vedou cílovou (pokud nejde o její vlastní album)
	if _, err := tx.Exec(`INSERT OR IGNORE INTO alba_modelky (album_id, modelka_id)
		SELECT am.album_id, ? FROM alba_modelky am JOIN alba al ON al.id = am.album_id
		WHERE am.modelka_id = ? AND al.modelka_id <> ?`, cilID, zdrojID, cilID); err != nil {
		a.chyba("SloucitModelky", err)
		return "Modelky se nepodařilo sloučit."
	}
	if _, err := tx.Exec("DELETE FROM modelky WHERE id = ?", zdrojID); err != nil {
		a.chyba("SloucitModelky", err)
		return "Modelky se nepodařilo sloučit."
	}
	if err := tx.Commit(); err != nil {
		a.chyba("SloucitModelky", err)
		return "Modelky se nepodařilo sloučit."
	}

	// Údaje: cílové mají přednost, prázdná se doplní ze zdrojové
	m := *cil
	doplnit := func(cilovy *string, zdrojovy string) {
		if strings.TrimSpace(*cilovy) == "" {
			*cilovy = zdrojovy
		}
	}
	for _, dvojice := range [][2]*string{
		{&m.NarozeniDatum, &zdroj.NarozeniDatum}, {&m.NarozeniMisto, &zdroj.NarozeniMisto}, {&m.Narodnost, &zdroj.Narodnost},
		{&m.Etnicita, &zdroj.Etnicita}, {&m.VlasyBarva, &zdroj.VlasyBarva}, {&m.OciBarva, &zdroj.OciBarva}, {&m.Miry, &zdroj.Miry},
		{&m.VelikostPrsou, &zdroj.VelikostPrsou}, {&m.PrsaTyp, &zdroj.PrsaTyp}, {&m.Ochlupeni, &zdroj.Ochlupeni},
		{&m.Vystoupeni, &zdroj.Vystoupeni}, {&m.PictorialVydani, &zdroj.PictorialVydani}, {&m.Role, &zdroj.Role},
	} {
		doplnit(dvojice[0], *dvojice[1])
	}
	for _, dvojice := range [][2]*int{{&m.VyskaCm, &zdroj.VyskaCm}, {&m.VahaKg, &zdroj.VahaKg},
		{&m.ObvodHrudnikCm, &zdroj.ObvodHrudnikCm}, {&m.ObvodPasCm, &zdroj.ObvodPasCm}, {&m.ObvodBokyCm, &zdroj.ObvodBokyCm}} {
		if *dvojice[0] == 0 {
			*dvojice[0] = *dvojice[1]
		}
	}
	if m.Tetovani != 0 && m.Tetovani != 1 {
		m.Tetovani = zdroj.Tetovani
	}
	if m.Piercing != 0 && m.Piercing != 1 {
		m.Piercing = zdroj.Piercing
	}
	m.Tags = sloucitSeznam(m.Tags, zdroj.Tags)
	m.DalsiJmena = sloucitSeznam(m.DalsiJmena, zdroj.Jmeno+", "+zdroj.DalsiJmena)
	if strings.TrimSpace(zdroj.Poznamka) != "" && !strings.Contains(m.Poznamka, zdroj.Poznamka) {
		m.Poznamka = strings.TrimSpace(m.Poznamka + "\n\n" + zdroj.Poznamka)
	}
	coverZeZdroje := m.CoverID == "" && zdroj.CoverID != ""
	if coverZeZdroje {
		m.CoverID = zdroj.CoverID
	}
	if !a.UpdateModelka(m) {
		return "Fotky jsou sloučené, ale údaje modelky se nepodařilo uložit."
	}
	if coverZeZdroje {
		a.SetCoverVyrez(cilID, zdroj.CoverZoom, zdroj.CoverX, zdroj.CoverY)
	}
	if zdroj.Hodnoceni > cil.Hodnoceni {
		a.SetHodnoceni(cilID, zdroj.Hodnoceni)
	}
	return ""
}

// Seznam oddělený čárkami bez opakování (na velikosti písmen a diakritice nezáleží)
func sloucitSeznam(prvni, druhy string) string {
	var vysledek []string
	videne := map[string]bool{}
	for _, polozka := range strings.Split(prvni+","+druhy, ",") {
		polozka = strings.TrimSpace(polozka)
		if polozka == "" || videne[zjednodusit(polozka)] {
			continue
		}
		videne[zjednodusit(polozka)] = true
		vysledek = append(vysledek, polozka)
	}
	return strings.Join(vysledek, ", ")
}

// Údaje odebrané fotky, aby ji šlo vrátit
type ObnovaFotky struct {
	ModelkaID int    `json:"modelkaId"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
	DriveID   string `json:"driveId"`
	Vydani    string `json:"vydani"`
	Rotace    int    `json:"rotace"`
	Spojit    bool   `json:"spojit"`
	Hodnoceni int    `json:"hodnoceni"`
	Poradi    int    `json:"poradi"`
	Pridano   string `json:"pridano"`
	Popis     string `json:"popis"`
	Fotograf  string `json:"fotograf"`
}

// Vrácení odebraných fotek (Zpět); fotka, která mezitím v albu znovu je, se přeskočí. Vrací počet vrácených.
func (a *App) ObnovitFotky(fotky []ObnovaFotky) int {
	vraceno := 0
	for _, f := range fotky {
		ids := parseDriveIDs(f.DriveID)
		if len(ids) == 0 {
			continue
		}
		vydani := f.Vydani
		if f.Typ == "Centerfold" || f.Typ == "Cover" {
			vydani = ""
		}
		var poradi interface{}
		if f.Poradi > 0 {
			poradi = f.Poradi
		}
		vysledek, err := a.db.Exec(`INSERT OR IGNORE INTO fotografie (modelka_id, album, typ, drive_file_id, vydani, rotace, spojit, hodnoceni, poradi, pridano)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, f.ModelkaID, f.Album, f.Typ, ids[0], vydani, f.Rotace, f.Spojit, f.Hodnoceni, poradi, prvniNeprazdny(f.Pridano, ted()))
		if err != nil {
			a.chyba("ObnovitFotky", err)
			continue
		}
		if n, _ := vysledek.RowsAffected(); n > 0 {
			vraceno++
		}
		// Text alba zmizel s jeho poslední fotkou; vrací se s ní
		if f.Popis != "" || f.Fotograf != "" {
			var maText int
			a.db.QueryRow("SELECT COUNT(*) FROM alba WHERE modelka_id = ? AND album = ? AND typ = ? AND (COALESCE(popis, '') <> '' OR COALESCE(fotograf, '') <> '')",
				f.ModelkaID, f.Album, f.Typ).Scan(&maText)
			if maText == 0 {
				a.SetPopisAlba(f.ModelkaID, f.Album, f.Typ, f.Popis, f.Fotograf)
			}
		}
	}
	return vraceno
}

// Přejmenování fotografa ve všech albech; vrací počet upravených alb
func (a *App) PrejmenovatFotografa(stary, novy string) int {
	novy = strings.TrimSpace(novy)
	if strings.TrimSpace(stary) == "" || novy == "" {
		return 0
	}
	rows, err := a.db.Query("SELECT id, fotograf FROM alba WHERE COALESCE(fotograf, '') <> ''")
	if err != nil {
		a.chyba("PrejmenovatFotografa", err)
		return 0
	}
	var ids []int64
	for rows.Next() {
		var id int64
		var fotograf string
		if rows.Scan(&id, &fotograf) == nil && zjednodusit(strings.TrimSpace(fotograf)) == zjednodusit(strings.TrimSpace(stary)) {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		a.db.Exec("UPDATE alba SET fotograf = ? WHERE id = ?", novy, id)
	}
	return len(ids)
}

// Všechny tagy sbírky pro našeptávání
func (a *App) GetTagy() []string {
	var tagy []string
	videne := map[string]bool{}
	for _, m := range a.GetModelky("") {
		for _, tag := range strings.Split(m.Tags, ",") {
			tag = strings.TrimSpace(tag)
			if tag != "" && !videne[zjednodusit(tag)] {
				videne[zjednodusit(tag)] = true
				tagy = append(tagy, tag)
			}
		}
	}
	sort.Slice(tagy, func(i, j int) bool { return zjednodusit(tagy[i]) < zjednodusit(tagy[j]) })
	if tagy == nil {
		tagy = []string{}
	}
	return tagy
}

// Přejmenování tagu u všech modelek (sloučí se, má-li modelka už i nový tag); vrací počet upravených modelek
func (a *App) PrejmenovatTag(stary, novy string) int {
	novy = strings.TrimSpace(novy)
	if strings.TrimSpace(stary) == "" || novy == "" {
		return 0
	}
	upraveno := 0
	for _, m := range a.GetModelky("") {
		tagy := strings.Split(m.Tags, ",")
		zmena := false
		for i, tag := range tagy {
			if zjednodusit(strings.TrimSpace(tag)) == zjednodusit(strings.TrimSpace(stary)) {
				tagy[i] = novy
				zmena = true
			}
		}
		if zmena {
			a.db.Exec("UPDATE modelky SET tags = ? WHERE id = ?", sloucitSeznam(strings.Join(tagy, ","), ""), m.ID)
			upraveno++
		}
	}
	return upraveno
}

// Dnešní datum pro stav dostupnosti
func dnes() string {
	return time.Now().Format("2006-01-02")
}
