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
	// Cover časopisu je album bez modelky
	if _, err := q.Exec(`INSERT OR IGNORE INTO alba (modelka_id, album, typ, vydani) VALUES (NULLIF(?, 0), ?, ?,
		CASE WHEN ? IN ('Centerfold', 'Cover') THEN ? ELSE '' END)`, modelkaID, album, typ, typ, album); err != nil {
		return 0, err
	}
	var id int64
	err := q.QueryRow("SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?", modelkaID, album, typ).Scan(&id)
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
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY`)
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
	return doplnitDalsiModelkyZ(fotky, a.dalsiModelkyAlb())
}

// Totéž s předem načtenými vazbami (export je načte jednou pro všechny modelky)
func doplnitDalsiModelkyZ(fotky []Fotografie, dalsi map[string][]OdkazModelky) []Fotografie {
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
	var existuje int
	a.db.QueryRow("SELECT COUNT(*) FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?", modelkaID, album, typ).Scan(&existuje)
	if dalsiID == modelkaID || a.jmenoModelky(dalsiID) == "" || existuje == 0 {
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
		// Pozůstatek prázdného alba téhož jména u cílové modelky by přesun zablokoval; album s obsahem
		// zablokuje přesun dřív, u volajícího. Fotky odkazují na album, změní se jen jeho modelka.
		{"DELETE FROM alba WHERE modelka_id = ? AND album = ? AND typ = ? AND " + albumBezObsahu, []interface{}{cilID, album, typ}},
		{"UPDATE alba SET modelka_id = ? WHERE modelka_id = ? AND album = ? AND typ = ?", []interface{}{cilID, modelkaID, album, typ}},
		// Hlavní modelka už nemusí být vedená i jako další
		{`DELETE FROM alba_modelky WHERE modelka_id = ?
			AND album_id = (SELECT id FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?)`, []interface{}{cilID, cilID, album, typ}},
	}
	for i, krok := range kroky {
		if _, err := tx.Exec(krok.dotaz, krok.args...); err != nil {
			return err
		}
		// Cílová modelka má stejnojmenné album s textem nebo vazbami, ale bez fotek: alba se sloučí
		if i == 0 {
			var obsazeno int
			tx.QueryRow("SELECT COUNT(*) FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?", cilID, album, typ).Scan(&obsazeno)
			if obsazeno > 0 {
				return sloucitAlbaTx(tx, modelkaID, album, typ, cilID, album, typ)
			}
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
		return fmt.Sprintf("Modelka %s už má album stejného názvu a typu. Použij „Sloučit s jiným albem…“ v nabídce alba.", cil)
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
	var zdrojID int64
	var vydani, popis, fotograf, netykaSe string
	err := tx.QueryRow("SELECT id, vydani, COALESCE(popis, ''), COALESCE(fotograf, ''), COALESCE(netyka_se, '') FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?",
		zModelka, zAlbum, zTyp).Scan(&zdrojID, &vydani, &popis, &fotograf, &netykaSe)
	if err == sql.ErrNoRows {
		return nil
	} else if err != nil {
		return err
	}
	cilID, err := zajistitAlbum(tx, doModelka, doAlbum, doTyp)
	if err != nil {
		return err
	}
	// Spojený plakát cílového alba určuje otočení přidaných stránek
	var spojit, rotace int
	tx.QueryRow("SELECT spojit, COALESCE((SELECT MAX(rotace) FROM fotky WHERE album_id = alba.id), 0) FROM alba WHERE id = ?", cilID).Scan(&spojit, &rotace)

	// Soubor, který v cílovém albu už je: cílová fotka převezme vyšší hodnocení a členství ve výběrech, zdrojová zmizí
	kroky := []string{
		`UPDATE fotky AS c SET hodnoceni = MAX(c.hodnoceni, z.hodnoceni)
			FROM fotky AS z WHERE z.album_id = ?1 AND c.album_id = ?2 AND c.drive_file_id = z.drive_file_id`,
		`INSERT OR IGNORE INTO vybery_fotky (vyber_id, fotografie_id, poradi)
			SELECT vf.vyber_id, c.id, vf.poradi FROM vybery_fotky vf
			JOIN fotky z ON z.id = vf.fotografie_id AND z.album_id = ?1
			JOIN fotky c ON c.album_id = ?2 AND c.drive_file_id = z.drive_file_id`,
		`DELETE FROM fotky WHERE album_id = ?1 AND drive_file_id IN (SELECT drive_file_id FROM fotky WHERE album_id = ?2)`,
		`UPDATE fotky SET album_id = ?2, rotace = CASE WHEN ?3 = 1 THEN ?4 ELSE rotace END, poradi = NULL WHERE album_id = ?1`,
		// Vydání, text a fotograf cílového alba mají přednost, chybějící doplní zdrojové
		`UPDATE alba SET vydani = CASE WHEN vydani = '' AND typ NOT IN ('Centerfold', 'Cover') THEN ?5 ELSE vydani END,
			popis = COALESCE(NULLIF(popis, ''), NULLIF(?6, '')), fotograf = COALESCE(NULLIF(fotograf, ''), NULLIF(?7, ''))
		WHERE id = ?2`,
		`INSERT OR IGNORE INTO alba_modelky (album_id, modelka_id)
			SELECT ?2, modelka_id FROM alba_modelky WHERE album_id = ?1 AND modelka_id <> ?8`,
	}
	for _, krok := range kroky {
		if _, err := tx.Exec(krok, zdrojID, cilID, spojit, rotace, vydani, popis, fotograf, doModelka); err != nil {
			return err
		}
	}
	// „Netýká se" zdrojového alba se přidá k cílovému
	var cilovy string
	tx.QueryRow("SELECT COALESCE(netyka_se, '') FROM alba WHERE id = ?", cilID).Scan(&cilovy)
	for _, klic := range strings.Split(netykaSe, ",") {
		if klic = strings.TrimSpace(klic); klic != "" {
			cilovy = prepnoutKlic(cilovy, klic, true)
		}
	}
	if _, err := tx.Exec("UPDATE alba SET netyka_se = NULLIF(?, '') WHERE id = ?", cilovy, cilID); err != nil {
		return err
	}
	_, err = tx.Exec("DELETE FROM alba WHERE id = ?", zdrojID)
	return err
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
	if err := a.overitKlicAlba(modelkaID, album, typ); err != nil {
		a.chyba("PresunoutFotky", err)
		return vysledek
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("PresunoutFotky", err)
		return vysledek
	}
	defer tx.Rollback()

	// Cílové album (případně nové); fotky přebírají jeho spojení plakátu a otočení
	cilID, err := zajistitAlbum(tx, modelkaID, album, typ)
	if err != nil {
		a.chyba("PresunoutFotky", err)
		return vysledek
	}
	var spojit, rotace int
	tx.QueryRow("SELECT spojit, COALESCE((SELECT MAX(rotace) FROM fotky WHERE album_id = alba.id), 0) FROM alba WHERE id = ?", cilID).Scan(&spojit, &rotace)
	for _, id := range ids {
		var stejny int
		tx.QueryRow(`SELECT COUNT(*) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND id <> ?
			AND drive_file_id = (SELECT drive_file_id FROM fotografie WHERE id = ?)`, modelkaID, album, typ, id, id).Scan(&stejny)
		if stejny > 0 {
			vysledek.Duplicitni++
			continue
		}
		zmena, err := tx.Exec(`UPDATE fotky SET album_id = ?, rotace = CASE WHEN ? = 1 THEN ? ELSE rotace END, poradi = NULL WHERE id = ?`,
			cilID, spojit, rotace, id)
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
	// Všechna alba zdroje, i ta bez fotek (jen s textem nebo dalšími modelkami); jinak by je smazala kaskáda
	rows, err := tx.Query("SELECT album, typ FROM alba WHERE modelka_id = ?", zdrojID)
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
	// Obálky zdrojové modelky přejdou na cílovou (smazání by je jinak vynulovalo)
	if _, err := tx.Exec("UPDATE vydani SET modelka_obalky = ? WHERE modelka_obalky = ?", cilID, zdrojID); err != nil {
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
		{&m.NarozeniDatum, &zdroj.NarozeniDatum}, {&m.UmrtiDatum, &zdroj.UmrtiDatum}, {&m.NarozeniMisto, &zdroj.NarozeniMisto}, {&m.Narodnost, &zdroj.Narodnost},
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
	// Odkazy obou modelek bez opakování, jeden na řádek
	odkazy := strings.Fields(m.Odkazy + "\n" + zdroj.Odkazy)
	m.Odkazy = strings.ReplaceAll(sloucitSeznam(strings.Join(odkazy, ","), ""), ", ", "\n")
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

// Údaje odebrané fotky, aby ji šlo vrátit (včetně výběrů, dalších modelek a „netýká se" jejího alba)
type ObnovaFotky struct {
	Vybery       []VyberFotky `json:"vybery"`
	DalsiModelky []int        `json:"dalsiModelky"`
	NetykaSe     string       `json:"netykaSe"`
	ModelkaID    int          `json:"modelkaId"`
	Album        string       `json:"album"`
	Typ          string       `json:"typ"`
	DriveID      string       `json:"driveId"`
	Vydani       string       `json:"vydani"`
	Rotace       int          `json:"rotace"`
	Spojit       bool         `json:"spojit"`
	Hodnoceni    int          `json:"hodnoceni"`
	Poradi       int          `json:"poradi"`
	Pridano      string       `json:"pridano"`
	Popis        string       `json:"popis"`
	Fotograf     string       `json:"fotograf"`
}

type VyberFotky struct {
	VyberID int `json:"vyberId"`
	Poradi  int `json:"poradi"`
}

// Odebrání fotek s údaji pro Vrátit: vrací všechno, co odebrání ztratí, i to, co frontend nezná
// (členství ve výběrech, další modelky a „netýká se" alba, které s poslední fotkou zmizí).
// Víc fotek najednou se odebírá se zálohou předem.
func (a *App) OdebratFotky(ids []int) []ObnovaFotky {
	obnova := []ObnovaFotky{}
	for _, id := range ids {
		var o ObnovaFotky
		var spojit, poradi int
		err := a.db.QueryRow(`SELECT f.modelka_id, f.album, f.typ, f.drive_file_id, COALESCE(f.vydani, ''), COALESCE(f.rotace, 0), COALESCE(f.spojit, 0),
				COALESCE(f.hodnoceni, 0), COALESCE(f.poradi, 0), COALESCE(f.pridano, ''), COALESCE(al.popis, ''), COALESCE(al.fotograf, ''), COALESCE(al.netyka_se, '')
			FROM fotografie f LEFT JOIN alba al ON al.id = f.album_id WHERE f.id = ?`, id).
			Scan(&o.ModelkaID, &o.Album, &o.Typ, &o.DriveID, &o.Vydani, &o.Rotace, &spojit, &o.Hodnoceni, &poradi, &o.Pridano, &o.Popis, &o.Fotograf, &o.NetykaSe)
		if err != nil {
			continue
		}
		o.Spojit, o.Poradi = spojit == 1, poradi
		o.Vybery = []VyberFotky{}
		if rows, err := a.db.Query("SELECT vyber_id, COALESCE(poradi, 0) FROM vybery_fotky WHERE fotografie_id = ?", id); err == nil {
			for rows.Next() {
				var v VyberFotky
				if rows.Scan(&v.VyberID, &v.Poradi) == nil {
					o.Vybery = append(o.Vybery, v)
				}
			}
			rows.Close()
		}
		o.DalsiModelky = []int{}
		if rows, err := a.db.Query(`SELECT am.modelka_id FROM alba_modelky am JOIN alba al ON al.id = am.album_id
			WHERE al.modelka_id = ? AND al.album = ? AND al.typ = ?`, o.ModelkaID, o.Album, o.Typ); err == nil {
			for rows.Next() {
				var m int
				if rows.Scan(&m) == nil {
					o.DalsiModelky = append(o.DalsiModelky, m)
				}
			}
			rows.Close()
		}
		obnova = append(obnova, o)
	}
	var ok bool
	if len(ids) == 1 {
		ok = a.DeleteFotografie(ids[0])
	} else {
		ok = a.DeleteFotografieHromadne(ids)
	}
	if !ok {
		return []ObnovaFotky{}
	}
	return obnova
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
		albumID, err := zajistitAlbum(a.db, f.ModelkaID, f.Album, f.Typ)
		if err != nil {
			a.chyba("ObnovitFotky", err)
			continue
		}
		// Album, které zmizelo s poslední fotkou, dostane zpět vydání a spojení
		a.db.Exec(`UPDATE alba SET vydani = CASE WHEN vydani = '' THEN ? ELSE vydani END, spojit = MAX(spojit, ?) WHERE id = ?`, vydani, f.Spojit, albumID)
		vysledek, err := a.db.Exec(`INSERT OR IGNORE INTO fotky (album_id, drive_file_id, rotace, hodnoceni, poradi, pridano) VALUES (?, ?, ?, ?, ?, ?)`,
			albumID, ids[0], f.Rotace, f.Hodnoceni, poradi, prvniNeprazdny(f.Pridano, ted()))
		if err != nil {
			a.chyba("ObnovitFotky", err)
			continue
		}
		if n, _ := vysledek.RowsAffected(); n > 0 {
			vraceno++
			// Členství ve výběrech na stejném místě
			for _, v := range f.Vybery {
				a.db.Exec(`INSERT OR IGNORE INTO vybery_fotky (vyber_id, fotografie_id, poradi)
					SELECT ?, id, ? FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND drive_file_id = ?`,
					v.VyberID, v.Poradi, f.ModelkaID, f.Album, f.Typ, ids[0])
			}
		}
		// Další modelky a „netýká se" alba, které zmizely s jeho poslední fotkou
		for _, dalsi := range f.DalsiModelky {
			a.PridatModelkuKAlbu(f.ModelkaID, f.Album, f.Typ, dalsi)
		}
		for _, klic := range strings.Split(f.NetykaSe, ",") {
			if klic = strings.TrimSpace(klic); klic != "" {
				a.SetNetykaSeAlba(f.ModelkaID, f.Album, f.Typ, klic, true)
			}
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
	// Stačí sloupec tagů, ne všechny údaje modelek
	radky, err := a.db.Query("SELECT tags FROM modelky WHERE COALESCE(tags, '') <> '' ORDER BY jmeno COLLATE BEZDIAKRITIKY")
	if err != nil {
		a.chyba("GetTagy", err)
		return []string{}
	}
	var seznamy []string
	for radky.Next() {
		var t string
		if radky.Scan(&t) == nil {
			seznamy = append(seznamy, t)
		}
	}
	radky.Close()
	for _, seznam := range seznamy {
		for _, tag := range strings.Split(seznam, ",") {
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
