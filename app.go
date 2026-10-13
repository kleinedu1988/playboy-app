package main

import (
	"context"
	"database/sql"
	"fmt"
	"io"

	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type App struct {
	ctx context.Context
	db  *sql.DB

	// Hlášení chyb do okna aplikace; v testech zůstává prázdné
	naChybu func(zprava string)
	// Chyba, kvůli které se nepodařilo otevřít databázi
	chybaStartu string
}

// Chyba se vypíše do konzole a zároveň se ukáže uživateli
func (a *App) chyba(kde string, err error) {
	fmt.Printf("Chyba %s: %v\n", kde, err)
	if a.naChybu != nil {
		a.naChybu(fmt.Sprintf("Chyba (%s): %v", kde, err))
	}
}

// Stav databáze po spuštění; prázdný text znamená, že je vše v pořádku
func (a *App) StavDatabaze() string {
	return a.chybaStartu
}

type Modelka struct {
	ID             int    `json:"id"`
	Jmeno          string `json:"jmeno"`
	NarozeniDatum  string `json:"narozeniDatum"` // RRRR-MM-DD
	NarozeniMisto  string `json:"narozeniMisto"`
	Narodnost      string `json:"narodnost"`
	Etnicita       string `json:"etnicita"`
	VyskaCm        int    `json:"vyskaCm"`
	VahaKg         int    `json:"vahaKg"`
	VlasyBarva     string `json:"vlasyBarva"`
	OciBarva       string `json:"ociBarva"`
	Miry           string `json:"miry"` // "Hrudník-Pas-Boky", skládá se z obvodů
	ObvodHrudnikCm int    `json:"obvodHrudnikCm"`
	ObvodPasCm     int    `json:"obvodPasCm"`
	ObvodBokyCm    int    `json:"obvodBokyCm"`
	VelikostPrsou  string `json:"velikostPrsou"`
	PrsaTyp        string `json:"prsaTyp"`
	Ochlupeni      string `json:"ochlupeni"`
	// Tetování a piercing: 1 = ano, 0 = ne, -1 = neuvedeno
	Tetovani        int    `json:"tetovani"`
	Piercing        int    `json:"piercing"`
	Vystoupeni      string `json:"vystoupeni"`
	PictorialVydani string `json:"pictorialVydani"` // jedno vydání na řádek
	Role            string `json:"role"`
	Tags            string `json:"tags"` // oddělené čárkou
	CoverURL        string `json:"coverUrl"`
	CoverID         string `json:"coverId"` // při ukládání Drive ID nebo celý odkaz
	// Výřez titulní fotky na kartě: přiblížení (1 = bez přiblížení) a poloha v procentech
	CoverZoom float64 `json:"coverZoom"`
	CoverX    float64 `json:"coverX"`
	CoverY    float64 `json:"coverY"`
	// Počet fotek modelky ve všech albech (jen pro čtení)
	PocetFotek int `json:"pocetFotek"`
	// Vydání časopisu, ve kterých modelka je, odvozená z jejích alb a centerfoldů (jen pro čtení)
	Vydani []string `json:"vydani"`

	DalsiJmena string `json:"dalsiJmena"` // pseudonymy oddělené čárkou
	Poznamka   string `json:"poznamka"`
	Oblibena   bool   `json:"oblibena"`
}

type Fotografie struct {
	ID        int    `json:"id"`
	ModelkaID int    `json:"modelkaId"`
	Album     string `json:"album"`
	Typ       string `json:"typ"` // "Centerfold", "Pictorial", "Cover"
	URL       string `json:"url"`
	Rotace    int    `json:"rotace"` // otočení při zobrazení: 0, 90, 180, 270
	// Stránky centerfoldu v albu se zobrazují spojené do jednoho plakátu
	Spojit       bool   `json:"spojit"`
	JmenoModelky string `json:"jmenoModelky"` // vyplněno jen v přehledech napříč modelkami
	// Vydání časopisu RRRR-MM, ke kterému fotka patří; u centerfoldu a coveru je to přímo album
	Vydani string `json:"vydani"`
}

// Sloupce tabulky modelky (kromě id a jmeno) a jejich typy
var sloupceModelky = [][2]string{
	{"narozeni_datum", "TEXT"},
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
	{"drive_cover_id", "TEXT"},
}

// Sloupce s výřezem titulní fotky a jejich výchozí hodnoty; ukládají se zvlášť přes SetCoverVyrez
var sloupceVyrezu = [][2]string{
	{"cover_zoom", "1"},
	{"cover_x", "50"},
	{"cover_y", "50"},
}

// Stav „neuvedeno" se u tetování a piercingu ukládá jako NULL
func anoNeDoDatabaze(hodnota int) interface{} {
	if hodnota != 0 && hodnota != 1 {
		return nil
	}
	return hodnota
}

func NewApp() *App {
	return &App{}
}

func (a *App) maSloupec(tabulka, sloupec string) bool {
	var pocet int
	a.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`, tabulka, sloupec).Scan(&pocet)
	return pocet > 0
}

const pocetZaloh = 20

// Data aplikace mají pevné místo nezávislé na tom, odkud se aplikace spouští
func slozkaDat() string {
	zaklad := os.Getenv("XDG_DATA_HOME")
	if zaklad == "" {
		domov, _ := os.UserHomeDir()
		zaklad = filepath.Join(domov, ".local", "share")
	}
	return filepath.Join(zaklad, "playboy-app")
}

func slozkaZaloh() string {
	return filepath.Join(slozkaDat(), "zalohy")
}

func kopirovatSoubor(zdroj, cil string) error {
	vstup, err := os.Open(zdroj)
	if err != nil {
		return err
	}
	defer vstup.Close()

	// Nejdřív do dočasného souboru, aby po přerušení nezůstala poškozená databáze
	docasny := cil + ".tmp"
	vystup, err := os.Create(docasny)
	if err != nil {
		return err
	}
	if _, err := io.Copy(vystup, vstup); err != nil {
		vystup.Close()
		os.Remove(docasny)
		return err
	}
	if err := vystup.Close(); err != nil {
		os.Remove(docasny)
		return err
	}
	return os.Rename(docasny, cil)
}

// Cesta k databázi; při prvním spuštění převezme databázi starší verze,
// která ležela ve složce spuštění nebo vedle programu
func pripravitDatabazi() (string, error) {
	if err := os.MkdirAll(slozkaDat(), 0o755); err != nil {
		return "", err
	}
	cil := filepath.Join(slozkaDat(), "playboy.db")
	if _, err := os.Stat(cil); err == nil {
		return cil, nil
	}

	kandidati := []string{"playboy.db"}
	if program, err := os.Executable(); err == nil {
		kandidati = append(kandidati, filepath.Join(filepath.Dir(program), "playboy.db"))
	}
	for _, stara := range kandidati {
		if info, err := os.Stat(stara); err != nil || info.IsDir() {
			continue
		}
		if err := kopirovatSoubor(stara, cil); err != nil {
			return "", err
		}
		// Původní soubor zůstává jako pojistka, jen pod jiným jménem, aby nevznikly dvě živé databáze
		if err := os.Rename(stara, stara+".presunuta"); err != nil {
			fmt.Printf("Původní databázi se nepodařilo přejmenovat: %v\n", err)
		}
		fmt.Printf("Databáze přesunuta z %s do %s\n", stara, cil)
		break
	}
	return cil, nil
}

// Záloha databáze před nevratným mazáním; uchovává se posledních pocetZaloh kopií
func (a *App) zalohovat(duvod string) error {
	var zaznamu int
	a.db.QueryRow("SELECT (SELECT COUNT(*) FROM modelky) + (SELECT COUNT(*) FROM fotografie)").Scan(&zaznamu)
	if zaznamu == 0 {
		return nil
	}
	if err := os.MkdirAll(slozkaZaloh(), 0o755); err != nil {
		return err
	}

	// Dvě zálohy ve stejné milisekundě se nesmí přepsat ani srazit
	zaklad := filepath.Join(slozkaZaloh(), fmt.Sprintf("playboy-%s", time.Now().Format("2006-01-02-150405.000")))
	cil := fmt.Sprintf("%s-%s.db", zaklad, duvod)
	for i := 2; ; i++ {
		if _, err := os.Stat(cil); os.IsNotExist(err) {
			break
		}
		cil = fmt.Sprintf("%s-%d-%s.db", zaklad, i, duvod)
	}
	if _, err := a.db.Exec("VACUUM INTO '" + strings.ReplaceAll(cil, "'", "''") + "'"); err != nil {
		return err
	}

	zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "playboy-*.db"))
	sort.Strings(zalohy)
	for len(zalohy) > pocetZaloh {
		os.Remove(zalohy[0])
		zalohy = zalohy[1:]
	}
	return nil
}

// Složka se zálohami pro zobrazení v aplikaci
func (a *App) SlozkaZaloh() string {
	os.MkdirAll(slozkaZaloh(), 0o755)
	return slozkaZaloh()
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	cesta, err := pripravitDatabazi()
	if err == nil {
		a.db, err = sql.Open("sqlite", cesta)
	}
	if err == nil {
		err = a.db.Ping()
	}
	if err != nil {
		// Bez databáze aplikace poběží nad prázdnou dočasnou, aby šla aspoň otevřít a chybu ukázat
		a.chybaStartu = fmt.Sprintf("Databázi se nepodařilo otevřít (%v). Aplikace běží s prázdnou dočasnou databází, změny se neuloží.", err)
		fmt.Println(a.chybaStartu)
		a.db, _ = sql.Open("sqlite", ":memory:")
		a.db.SetMaxOpenConns(1)
	}

	// Tabulka modelek
	a.db.Exec(`
	CREATE TABLE IF NOT EXISTS modelky (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		jmeno TEXT NOT NULL
	);`)

	// Migrace starší verze tabulky, kde se sloupec jmenoval drive_file_id
	if !a.maSloupec("modelky", "drive_cover_id") && a.maSloupec("modelky", "drive_file_id") {
		if _, err := a.db.Exec(`ALTER TABLE modelky RENAME COLUMN drive_file_id TO drive_cover_id`); err != nil {
			a.chyba("migrace DB", err)
		}
	}

	// Doplnění sloupců, které v tabulce ještě nejsou
	for _, s := range sloupceModelky {
		if a.maSloupec("modelky", s[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE modelky ADD COLUMN %s %s`, s[0], s[1])); err != nil {
			a.chyba("migrace DB", err)
		}
	}

	if !a.maSloupec("modelky", "oblibena") {
		if _, err := a.db.Exec(`ALTER TABLE modelky ADD COLUMN oblibena INTEGER`); err != nil {
			a.chyba("migrace DB", err)
		}
	}

	for _, s := range sloupceVyrezu {
		if a.maSloupec("modelky", s[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE modelky ADD COLUMN %s REAL`, s[0])); err != nil {
			a.chyba("migrace DB", err)
		}
	}

	// Tabulka pro jednotlivé fotky v albech
	a.db.Exec(`
	CREATE TABLE IF NOT EXISTS fotografie (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		modelka_id INTEGER,
		album TEXT,
		typ TEXT,
		drive_file_id TEXT,
		FOREIGN KEY(modelka_id) REFERENCES modelky(id)
	);`)

	for _, sloupec := range [][2]string{{"rotace", "INTEGER"}, {"spojit", "INTEGER"}, {"vydani", "TEXT"}} {
		if a.maSloupec("fotografie", sloupec[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE fotografie ADD COLUMN %s %s`, sloupec[0], sloupec[1])); err != nil {
			a.chyba("migrace DB", err)
		}
	}
}

// Vytažení všech Drive ID z jakéhokoliv textu/odkazů
func parseDriveIDs(rawInput string) []string {
	re := regexp.MustCompile(`(?:file/d/|id=|/d/)([a-zA-Z0-9_-]{25,})`)
	matches := re.FindAllStringSubmatch(rawInput, -1)

	var ids []string
	seen := make(map[string]bool)

	for _, m := range matches {
		if len(m) > 1 && !seen[m[1]] {
			seen[m[1]] = true
			ids = append(ids, m[1])
		}
	}

	// Pokud uživatel vložil pouze jedno čisté ID bez URL
	if len(ids) == 0 && len(strings.TrimSpace(rawInput)) >= 25 {
		ids = append(ids, strings.TrimSpace(rawInput))
	}

	return ids
}

func (a *App) GetModelky(vyhledavani string) []Modelka {
	// Starší řádky mohou mít ve sloupcích NULL
	vyber := []string{"id", "jmeno"}
	for _, s := range sloupceModelky {
		vychozi := "''"
		if s[1] == "INTEGER" {
			vychozi = "0"
		}
		if s[0] == "tetovani" || s[0] == "piercing" {
			vychozi = "-1"
		}
		vyber = append(vyber, fmt.Sprintf("COALESCE(%s, %s)", s[0], vychozi))
	}

	for _, s := range sloupceVyrezu {
		vyber = append(vyber, fmt.Sprintf("COALESCE(%s, %s)", s[0], s[1]))
	}

	vyber = append(vyber, "(SELECT COUNT(*) FROM fotografie f WHERE f.modelka_id = modelky.id)", "COALESCE(oblibena, 0)")

	// Vydání každé modelky odvozená z jejích fotek
	vydaniModelek := map[int][]string{}
	if radky, err := a.db.Query("SELECT DISTINCT f.modelka_id, " + vydaniFotky + " AS v FROM fotografie f WHERE f.modelka_id > 0 AND " + vydaniFotky + " <> '' ORDER BY v"); err == nil {
		for radky.Next() {
			var id int
			var v string
			if radky.Scan(&id, &v) == nil {
				vydaniModelek[id] = append(vydaniModelek[id], v)
			}
		}
		radky.Close()
	}

	query := "SELECT " + strings.Join(vyber, ", ") + " FROM modelky"

	rows, err := a.db.Query(query)
	if err != nil {
		a.chyba("GetModelky", err)
		return nil
	}
	defer rows.Close()

	var vysledky []Modelka
	for rows.Next() {
		var m Modelka
		var driveID string
		err := rows.Scan(&m.ID, &m.Jmeno,
			&m.NarozeniDatum, &m.NarozeniMisto, &m.Narodnost, &m.Etnicita,
			&m.VyskaCm, &m.VahaKg, &m.VlasyBarva, &m.OciBarva,
			&m.Miry, &m.ObvodHrudnikCm, &m.ObvodPasCm, &m.ObvodBokyCm,
			&m.VelikostPrsou, &m.PrsaTyp, &m.Ochlupeni, &m.Tetovani, &m.Piercing,
			&m.Vystoupeni, &m.PictorialVydani, &m.Role, &m.Tags, &m.DalsiJmena, &m.Poznamka, &driveID,
			&m.CoverZoom, &m.CoverX, &m.CoverY, &m.PocetFotek, &m.Oblibena)
		if err != nil {
			a.chyba("GetModelky", err)
			continue
		}

		ids := parseDriveIDs(driveID)
		if len(ids) > 0 {
			m.CoverID = ids[0]
			m.CoverURL = fmt.Sprintf("https://lh3.googleusercontent.com/d/%s", ids[0])
		}
		m.Vydani = vydaniModelek[m.ID]
		if m.Vydani == nil {
			m.Vydani = []string{}
		}
		if odpovidaHledani(m, vyhledavani) {
			vysledky = append(vysledky, m)
		}
	}

	// Řazení podle jména bez ohledu na velikost písmen a diakritiku
	sort.SliceStable(vysledky, func(i, j int) bool {
		return zjednodusit(vysledky[i].Jmeno) < zjednodusit(vysledky[j].Jmeno)
	})
	return vysledky
}

var bezDiakritiky = strings.NewReplacer(
	"á", "a", "č", "c", "ď", "d", "é", "e", "ě", "e", "í", "i", "ň", "n", "ó", "o",
	"ř", "r", "š", "s", "ť", "t", "ú", "u", "ů", "u", "ý", "y", "ž", "z",
)

// Text pro porovnávání: malá písmena bez české diakritiky
func zjednodusit(text string) string {
	return bezDiakritiky.Replace(strings.ToLower(text))
}

// Každé hledané slovo se musí najít v některém údaji modelky; na velikosti písmen ani diakritice nezáleží.
// Filtruje se tady a ne v SQL, protože LIKE v SQLite neumí malá a velká písmena s diakritikou.
func odpovidaHledani(m Modelka, vyhledavani string) bool {
	udaje := zjednodusit(strings.Join([]string{
		m.Jmeno, m.Narodnost, m.Etnicita, m.NarozeniMisto, m.NarozeniDatum, m.VlasyBarva, m.OciBarva,
		m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, m.Miry, m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags,
		m.DalsiJmena, m.Poznamka, strings.Join(m.Vydani, " "),
	}, "\n"))
	for _, slovo := range strings.Fields(zjednodusit(vyhledavani)) {
		if !strings.Contains(udaje, slovo) {
			return false
		}
	}
	return true
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

	return []interface{}{
		m.NarozeniDatum, m.NarozeniMisto, m.Narodnost, m.Etnicita,
		m.VyskaCm, m.VahaKg, m.VlasyBarva, m.OciBarva,
		miry, m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm,
		m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, anoNeDoDatabaze(m.Tetovani), anoNeDoDatabaze(m.Piercing),
		m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags, m.DalsiJmena, m.Poznamka, coverID,
	}
}

func (a *App) AddModelka(m Modelka) bool {
	sloupce := []string{"jmeno"}
	otazniky := []string{"?"}
	for _, s := range sloupceModelky {
		sloupce = append(sloupce, s[0])
		otazniky = append(otazniky, "?")
	}

	query := fmt.Sprintf(`INSERT INTO modelky (%s) VALUES (%s)`, strings.Join(sloupce, ", "), strings.Join(otazniky, ", "))
	args := append([]interface{}{m.Jmeno}, hodnotyModelky(m)...)

	_, err := a.db.Exec(query, args...)
	if err != nil {
		a.chyba("AddModelka", err)
	}
	return err == nil
}

// Úprava údajů modelky; prázdná titulní fotka ponechá tu stávající
func (a *App) UpdateModelka(m Modelka) bool {
	hodnoty := hodnotyModelky(m)
	nastaveni := []string{"jmeno = ?"}
	args := []interface{}{m.Jmeno}

	for i, s := range sloupceModelky {
		if s[0] == "drive_cover_id" {
			nastaveni = append(nastaveni, "drive_cover_id = CASE WHEN ? = '' THEN drive_cover_id ELSE ? END")
			args = append(args, hodnoty[i], hodnoty[i])
			continue
		}
		nastaveni = append(nastaveni, s[0]+" = ?")
		args = append(args, hodnoty[i])
	}
	args = append(args, m.ID)

	var puvodniCover string
	a.db.QueryRow(`SELECT COALESCE(drive_cover_id, '') FROM modelky WHERE id = ?`, m.ID).Scan(&puvodniCover)

	query := fmt.Sprintf(`UPDATE modelky SET %s WHERE id = ?`, strings.Join(nastaveni, ", "))
	_, err := a.db.Exec(query, args...)
	if err != nil {
		a.chyba("UpdateModelka", err)
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
		if hodnota < min {
			return min
		}
		if hodnota > max {
			return max
		}
		return hodnota
	}

	_, err := a.db.Exec(`UPDATE modelky SET cover_zoom = ?, cover_x = ?, cover_y = ? WHERE id = ?`,
		omezit(zoom, 1, 4), omezit(x, 0, 100), omezit(y, 0, 100), id)
	if err != nil {
		a.chyba("SetCoverVyrez", err)
	}
	return err == nil
}

// Označení modelky jako oblíbené
func (a *App) SetOblibena(id int, oblibena bool) bool {
	_, err := a.db.Exec(`UPDATE modelky SET oblibena = ? WHERE id = ?`, oblibena, id)
	if err != nil {
		a.chyba("SetOblibena", err)
	}
	return err == nil
}

// Titulní fotkou modelky se stane fotka z některého jejího alba
func (a *App) SetTitulniFotka(modelkaID, fotoID int) bool {
	vysledek, err := a.db.Exec(`
		UPDATE modelky SET cover_zoom = NULL, cover_x = NULL, cover_y = NULL,
			drive_cover_id = (SELECT drive_file_id FROM fotografie WHERE id = ? AND modelka_id = ?)
		WHERE id = ? AND EXISTS (SELECT 1 FROM fotografie WHERE id = ? AND modelka_id = ?)`,
		fotoID, modelkaID, modelkaID, fotoID, modelkaID)
	if err != nil {
		a.chyba("SetTitulniFotka", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

// Smazání modelky včetně všech jejích fotografií
func (a *App) DeleteModelka(id int) bool {
	// Bez zálohy se nemaže
	if err := a.zalohovat("pred-smazanim-modelky"); err != nil {
		a.chyba("zálohy", err)
		return false
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("DeleteModelka", err)
		return false
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM fotografie WHERE modelka_id = ?", id); err != nil {
		a.chyba("DeleteModelka", err)
		return false
	}
	if _, err := tx.Exec("DELETE FROM modelky WHERE id = ?", id); err != nil {
		a.chyba("DeleteModelka", err)
		return false
	}
	if err := tx.Commit(); err != nil {
		a.chyba("DeleteModelka", err)
		return false
	}
	return true
}

// Smazání celé databáze – všech modelek i fotografií
func (a *App) DeleteVse() bool {
	// Bez zálohy se nemaže
	if err := a.zalohovat("pred-smazanim-databaze"); err != nil {
		a.chyba("zálohy", err)
		return false
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("DeleteVse", err)
		return false
	}
	defer tx.Rollback()

	dotazy := []string{
		"DELETE FROM fotografie",
		"DELETE FROM modelky",
		// Číslování ID začne znovu od 1
		"DELETE FROM sqlite_sequence WHERE name IN ('fotografie', 'modelky')",
	}
	for _, dotaz := range dotazy {
		if _, err := tx.Exec(dotaz); err != nil {
			a.chyba("DeleteVse", err)
			return false
		}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("DeleteVse", err)
		return false
	}
	return true
}

// Vydání fotky: centerfold a cover ho mají v názvu alba, ostatní ve vlastním sloupci
const vydaniFotky = "CASE WHEN f.typ IN ('Centerfold', 'Cover') THEN f.album ELSE COALESCE(f.vydani, '') END"

const vyberFotografii = "SELECT f.id, COALESCE(f.modelka_id, 0), f.album, f.typ, f.drive_file_id, COALESCE(f.rotace, 0), COALESCE(f.spojit, 0), " + vydaniFotky

func (a *App) nacistFotografie(query string, sJmenem bool, args ...interface{}) []Fotografie {
	rows, err := a.db.Query(query, args...)
	if err != nil {
		a.chyba("načtení fotografií", err)
		return nil
	}
	defer rows.Close()

	var fotky []Fotografie
	for rows.Next() {
		var f Fotografie
		var driveID string
		cile := []interface{}{&f.ID, &f.ModelkaID, &f.Album, &f.Typ, &driveID, &f.Rotace, &f.Spojit, &f.Vydani}
		if sJmenem {
			cile = append(cile, &f.JmenoModelky)
		}
		if err := rows.Scan(cile...); err != nil {
			a.chyba("načtení fotografií", err)
			continue
		}
		f.URL = fmt.Sprintf("https://lh3.googleusercontent.com/d/%s", driveID)
		fotky = append(fotky, f)
	}
	return fotky
}

// Načtení fotek konkrétní modelky pro její detailní profil
func (a *App) GetFotografieModelky(modelkaID int) []Fotografie {
	return a.nacistFotografie(vyberFotografii+" FROM fotografie f WHERE f.modelka_id = ? ORDER BY f.id", false, modelkaID)
}

// Všechny centerfoldy napříč modelkami pro stěnu plakátů
func (a *App) GetCenterfoldy() []Fotografie {
	return a.nacistFotografie(vyberFotografii+`, m.jmeno FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id
		WHERE f.typ = 'Centerfold'
		ORDER BY m.jmeno COLLATE NOCASE, f.album, f.id`, true)
}

// Covery časopisů nepatří k modelce (modelka_id = 0); album je vydání ve tvaru RRRR-MM
var vzorVydani = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

func (a *App) GetCovery() []Fotografie {
	return a.nacistFotografie(vyberFotografii+` FROM fotografie f
		WHERE f.typ = 'Cover' AND COALESCE(f.modelka_id, 0) = 0
		ORDER BY f.album DESC, f.id`, false)
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
	query := "UPDATE fotografie SET album = ? WHERE id = ? AND typ = 'Cover'"
	args := []interface{}{vydani, id}
	if ids := parseDriveIDs(rawLink); len(ids) > 0 {
		query = "UPDATE fotografie SET album = ?, drive_file_id = ? WHERE id = ? AND typ = 'Cover'"
		args = []interface{}{vydani, ids[0], id}
	}

	_, err := a.db.Exec(query, args...)
	if err != nil {
		a.chyba("UpdateCover", err)
	}
	return err == nil
}

// Vše, co patří k jednomu vydání časopisu: covery, centerfoldy i pictorialy napříč modelkami
func (a *App) GetVydani(vydani string) []Fotografie {
	if !vzorVydani.MatchString(vydani) {
		return nil
	}
	return a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '') FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id
		WHERE `+vydaniFotky+` = ?
		ORDER BY m.jmeno COLLATE NOCASE, f.album, f.id`, true, vydani)
}

// Všechny fotky přiřazené k nějakému vydání, pro kalendář vydání
func (a *App) GetPrehledVydani() []Fotografie {
	return a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '') FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id
		WHERE `+vydaniFotky+` <> ''
		ORDER BY `+vydaniFotky+`, f.id`, true)
}

// Přiřazení alba (typicky pictorialu) k vydání časopisu; prázdné vydání přiřazení ruší
func (a *App) SetVydaniAlba(modelkaID int, album, typ, vydani string) bool {
	if vydani != "" && !vzorVydani.MatchString(vydani) {
		return false
	}
	_, err := a.db.Exec("UPDATE fotografie SET vydani = ? WHERE modelka_id = ? AND album = ? AND typ = ?", vydani, modelkaID, album, typ)
	if err != nil {
		a.chyba("SetVydaniAlba", err)
	}
	return err == nil
}

// Uložení otočení fotek (u spojeného plakátu všech jeho stránek najednou)
func (a *App) SetRotaceFotek(ids []int, rotace int) bool {
	rotace = ((rotace % 360) + 360) % 360
	for _, id := range ids {
		if _, err := a.db.Exec("UPDATE fotografie SET rotace = ? WHERE id = ?", rotace, id); err != nil {
			a.chyba("SetRotaceFotek", err)
			return false
		}
	}
	return true
}

// Zapnutí nebo vypnutí spojení stránek alba do jednoho plakátu
func (a *App) SetSpojeniAlba(modelkaID int, album, typ string, spojit bool) bool {
	// Spojený plakát se otáčí jako celek, proto se otočení stránek sjednotí
	_, err := a.db.Exec("UPDATE fotografie SET spojit = ?, rotace = 0 WHERE modelka_id = ? AND album = ? AND typ = ?",
		spojit, modelkaID, album, typ)
	if err != nil {
		a.chyba("SetSpojeniAlba", err)
	}
	return err == nil
}

// Přejmenování alba nebo změna jeho typu; album je určeno modelkou, názvem a typem
func (a *App) UpdateAlbum(modelkaID int, staryAlbum, staryTyp, novyAlbum, novyTyp string) bool {
	_, err := a.db.Exec("UPDATE fotografie SET album = ?, typ = ? WHERE modelka_id = ? AND album = ? AND typ = ?",
		novyAlbum, novyTyp, modelkaID, staryAlbum, staryTyp)
	if err != nil {
		a.chyba("UpdateAlbum", err)
	}
	return err == nil
}

// Smazání celého alba (všech jeho fotek) z databáze
func (a *App) DeleteAlbum(modelkaID int, album, typ string) bool {
	// Bez zálohy se nemaže
	if err := a.zalohovat("pred-smazanim-alba"); err != nil {
		a.chyba("zálohy", err)
		return false
	}
	_, err := a.db.Exec("DELETE FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ?", modelkaID, album, typ)
	if err != nil {
		a.chyba("DeleteAlbum", err)
	}
	return err == nil
}

// Odebrání jedné fotky z alba
func (a *App) DeleteFotografie(id int) bool {
	_, err := a.db.Exec("DELETE FROM fotografie WHERE id = ?", id)
	if err != nil {
		a.chyba("DeleteFotografie", err)
	}
	return err == nil
}

// Stav souboru na Google Disku
const (
	souborNeoveren   = -1 // kontrola se nepovedla (např. výpadek připojení)
	souborNedostupny = 0
	souborDostupny   = 1
)

var klientDisku = &http.Client{Timeout: 20 * time.Second}

// Malý náhled stačí; smazaný nebo nesdílený soubor vrací místo obrázku stránku
func overitSouborNaDisku(driveID string) int {
	resp, err := klientDisku.Get(fmt.Sprintf("https://lh3.googleusercontent.com/d/%s=w64", driveID))
	if err != nil {
		return souborNeoveren
	}
	resp.Body.Close()
	if resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests {
		return souborNeoveren
	}
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		return souborNedostupny
	}
	return souborDostupny
}

// Ověřování je vyměnitelné, aby testy nepotřebovaly síť
var overitSoubor = overitSouborNaDisku

// Souběžné ověření více souborů; výsledky jsou ve stejném pořadí jako vstup
func overitSoubory(driveIDs []string) []int {
	stavy := make([]int, len(driveIDs))
	var cekani sync.WaitGroup
	soubezne := make(chan struct{}, 8)
	for i, id := range driveIDs {
		cekani.Add(1)
		soubezne <- struct{}{}
		go func(i int, id string) {
			defer cekani.Done()
			defer func() { <-soubezne }()
			stavy[i] = overitSoubor(id)
		}(i, id)
	}
	cekani.Wait()
	return stavy
}

// Ověření odkazu před uložením: 1 = dostupný obrázek, 0 = nedostupný, -1 = nepodařilo se ověřit
func (a *App) OveritOdkaz(rawLink string) int {
	ids := parseDriveIDs(rawLink)
	if len(ids) == 0 {
		return souborNedostupny
	}
	return overitSoubor(ids[0])
}

// Vymazání mezipaměti obrázků, kterou si prohlížeč aplikace ukládá na disk; vrací uvolněné bajty
func (a *App) VymazatMezipamet() int64 {
	zaklad, err := os.UserCacheDir()
	if err != nil {
		return 0
	}
	slozka := filepath.Join(zaklad, filepath.Base(os.Args[0]), "WebKitCache")

	var velikost int64
	filepath.Walk(slozka, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			velikost += info.Size()
		}
		return nil
	})
	if err := os.RemoveAll(slozka); err != nil {
		a.chyba("VymazatMezipamet", err)
		return 0
	}
	return velikost
}

type NedostupnySoubor struct {
	FotoID    int    `json:"fotoId"` // 0 = titulní fotka modelky
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
}

type KontrolaSouboru struct {
	Zkontrolovano int                `json:"zkontrolovano"`
	Nedostupne    []NedostupnySoubor `json:"nedostupne"`
	// Soubory, u kterých se kontrola nepovedla (např. výpadek připojení); nepočítají se jako nedostupné
	Neovereno int `json:"neovereno"`
}

// Ověření, že Google Disk všechny uložené soubory stále vrací jako obrázek
func (a *App) ZkontrolovatSoubory() KontrolaSouboru {
	type polozka struct {
		soubor  NedostupnySoubor
		driveID string
	}
	var polozky []polozka

	rows, err := a.db.Query(`
		SELECT f.id, COALESCE(f.modelka_id, 0), COALESCE(m.jmeno, ''), f.album, f.typ, f.drive_file_id
		FROM fotografie f LEFT JOIN modelky m ON m.id = f.modelka_id
		UNION ALL
		SELECT 0, id, jmeno, '', 'Titulní fotka', drive_cover_id FROM modelky WHERE COALESCE(drive_cover_id, '') <> ''`)
	if err != nil {
		a.chyba("ZkontrolovatSoubory", err)
		return KontrolaSouboru{}
	}
	for rows.Next() {
		var p polozka
		if err := rows.Scan(&p.soubor.FotoID, &p.soubor.ModelkaID, &p.soubor.Jmeno, &p.soubor.Album, &p.soubor.Typ, &p.driveID); err == nil {
			polozky = append(polozky, p)
		}
	}
	rows.Close()

	vysledek := KontrolaSouboru{Zkontrolovano: len(polozky), Nedostupne: []NedostupnySoubor{}}
	driveIDs := make([]string, len(polozky))
	for i, p := range polozky {
		driveIDs[i] = p.driveID
	}
	for i, stav := range overitSoubory(driveIDs) {
		switch stav {
		case souborNeoveren:
			vysledek.Neovereno++
		case souborNedostupny:
			vysledek.Nedostupne = append(vysledek.Nedostupne, polozky[i].soubor)
		}
	}
	return vysledek
}

type VysledekVlozeni struct {
	Vlozeno    int `json:"vlozeno"`
	Nedostupne int `json:"nedostupne"` // odkazy, které Disk nevrací jako obrázek – neuloženy
	Duplicitni int `json:"duplicitni"` // soubory, které v albu už jsou – neuloženy
	Neovereno  int `json:"neovereno"`  // uloženy bez ověření (výpadek připojení)
}

// Hromadné vložení fotek/odkazů do alba modelky
func (a *App) AddBulkPhotos(modelkaID int, album, typ, rawLinks string) VysledekVlozeni {
	var vysledek VysledekVlozeni

	// Soubory, které v tomto albu už jsou, se nevkládají podruhé
	var ids []string
	for _, id := range parseDriveIDs(rawLinks) {
		var pocet int
		a.db.QueryRow("SELECT COUNT(*) FROM fotografie WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND drive_file_id = ?",
			modelkaID, album, typ, id).Scan(&pocet)
		if pocet > 0 {
			vysledek.Duplicitni++
			continue
		}
		ids = append(ids, id)
	}

	// Nové stránky přebírají nastavení spojeného plakátu, do kterého se přidávají
	var spojit, rotace int
	a.db.QueryRow("SELECT COALESCE(MAX(spojit), 0), COALESCE(MAX(rotace), 0) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND spojit = 1",
		modelkaID, album, typ).Scan(&spojit, &rotace)
	// ... a také vydání, ke kterému album patří
	var vydani string
	a.db.QueryRow("SELECT COALESCE(MAX(vydani), '') FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ?",
		modelkaID, album, typ).Scan(&vydani)

	for i, stav := range overitSoubory(ids) {
		if stav == souborNedostupny {
			vysledek.Nedostupne++
			continue
		}
		_, err := a.db.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id, spojit, rotace, vydani) VALUES (?, ?, ?, ?, ?, ?, ?)", modelkaID, album, typ, ids[i], spojit, rotace, vydani)
		if err != nil {
			a.chyba("AddBulkPhotos", err)
			continue
		}
		vysledek.Vlozeno++
		if stav == souborNeoveren {
			vysledek.Neovereno++
		}
	}
	return vysledek
}
