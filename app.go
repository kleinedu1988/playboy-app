package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"modernc.org/sqlite"

	"pinup-katalog/internal/nahledy"
	"pinup-katalog/internal/obsah"
)

type App struct {
	// Fotky pro témata (všechny) ke snímku sbírky: Síň slávy, volba sezóny a Porovnat je jinak počítaly znovu
	temataPamet *temataPamet
	// Kopie aplikace nad spojením s transakcí importu: hromadné zápisy jdou do ní, ne do nové transakce
	vImportu bool
	// Připravené příkazy importu (viz pripraveny)
	pripravene map[string]*sql.Stmt
	ctx        context.Context
	db         *sql.DB
	// Soubor databáze; prázdný u dočasné databáze v paměti
	cestaDb string

	// Zapamatování přítomnosti sloupce hodnoceni_pul u současného spojení databáze
	maHodnoceniPulDb *sql.DB
	maHodnoceniPul   bool

	// Hlášení chyb do okna aplikace; v testech zůstává prázdné
	naChybu func(zprava string)
	// Chyba, kvůli které se nepodařilo otevřít databázi
	chybaStartu string
	// Databáze je otevřená jen pro čtení (poškozená nebo z novější verze)
	jenProCteni bool
	// Databáze učení vedle sbírky (uceni.go); nil u kopie pro import
	uc *uceni
	// Poslední snímek sbírky (snimek.go); nil = snímek se nepamatuje (kopie pro import, testy bez NewApp)
	pamet *pametSbirky
	// Okno aplikace (ne testy): denní záloha a první snímek sbírky se při startu dělají na pozadí, aby okno
	// nečekalo; obnovení zálohy a zavření programu na ně počkají (pockatNaPozadi)
	startNaPozadi bool
	naPozadi      *sync.WaitGroup
	// Místní mezipaměť náhledů z Disku (nahledy.go); nil v testech a v kopii pro import
	nahledy *nahledy.Mezipamet
	// Obsah fotek: model, vektory a podobné fotky (obsah_fotek.go); nil = vypnuto (testy bez startup)
	obsah *obsah.Sluzba
	// Perceptuální otisky fotek pro Stejné fotky (otisky.go); vznikají při prvním použití
	otiskyFotek *otiskyFotek
	// Průchod sbírkou na webu (pruchod_webem.go)
	pruchod *pruchodWebem
	// Kontrola otočených fotek (otocene_fotky.go)
	otoceni *kontrolaOtoceni
	kvalita *kontrolaKvality
	// Úvodní obrazovka v malém okně (main.go): okno dostane uloženou velikost až na jejím konci (ObnovitOkno)
	uvod *uvodOkna
}

type uvodOkna struct {
	bezi atomic.Bool
	okno StavOkna // uložený stav okna, který dostane po úvodu
}

// Počká na práci startu na pozadí (denní záloha, první snímek), než se databáze zavře nebo vymění
func (a *App) pockatNaPozadi() {
	if a.naPozadi != nil {
		a.naPozadi.Wait()
	}
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

// Okamžik pro údaj „přidáno"; text se řadí stejně jako čas
func ted() string {
	return time.Now().Format("2006-01-02 15:04:05")
}

// Řazení v SQL stejně jako v programu: bez ohledu na velikost písmen a diakritiku (COLLATE BEZDIAKRITIKY zná jen ASCII)
func init() {
	sqlite.MustRegisterCollationUtf8("BEZDIAKRITIKY", porovnatBezDiakritiky)
}

func NewApp() *App {
	return &App{uc: &uceni{}, pamet: &pametSbirky{}}
}

func (a *App) maSloupec(tabulka, sloupec string) bool {
	var pocet int
	a.pripraveny(`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`).QueryRow(tabulka, sloupec).Scan(&pocet)
	return pocet > 0
}

// Databáze, které program nerozumí nebo je poškozená, se otevře znovu jen pro čtení
func (a *App) prepnoutJenProCteni() {
	if ro, err := sql.Open("sqlite", "file:"+a.cestaDb+"?mode=ro&_pragma=busy_timeout(5000)"); err == nil && ro.Ping() == nil {
		a.zavritPametSbirky(false)
		a.db.Close()
		a.db = ro
		a.jenProCteni = true
		if veta := " Program běží jen pro čtení, změny se neuloží."; !strings.Contains(a.chybaStartu, veta) {
			a.chybaStartu += veta
		}
	}
}

// Adresa obrázku na Disku: šablona s {id} a {velikost} (velikost doplní rozhraní, např. w600 nebo s0).
// Je na jednom místě a jde změnit v nastavení, kdyby Google adresu náhledů změnil.
const vychoziSablonaObrazku = "https://lh3.googleusercontent.com/d/{id}={velikost}"

var sablonaObrazku atomic.Value

// Okno aplikace bere obrázky přes místní mezipaměť náhledů (nahledy.go); testy a kopie pro import adresy Disku
var nahledyPresMezipamet atomic.Bool

// Adresa obrázku pro okno (s {velikost}, doplní ji rozhraní): přes mezipaměť náhledů /nahled/<id>/{velikost},
// jinak přímo na Disk
func adresaObrazku(driveID string) string {
	if nahledyPresMezipamet.Load() && (driveID == "{id}" || jeHoleID(driveID)) {
		return "/nahled/" + driveID + "/{velikost}"
	}
	return adresaObrazkuNaDisku(driveID)
}

// Adresa obrázku přímo na Disku podle šablony (kontrola souborů, stahování do mezipaměti náhledů, nastavení)
func adresaObrazkuNaDisku(driveID string) string {
	sablona, _ := sablonaObrazku.Load().(string)
	if sablona == "" {
		sablona = vychoziSablonaObrazku
	}
	return strings.ReplaceAll(sablona, "{id}", driveID)
}

func (a *App) GetSablonaObrazku() string {
	return adresaObrazkuNaDisku("{id}")
}

// Nová šablona adresy obrázků; musí obsahovat {id}, prázdná vrací výchozí.
func (a *App) SetSablonaObrazku(sablona string) string {
	sablona = strings.TrimSpace(sablona)
	if sablona != "" && !strings.Contains(sablona, "{id}") {
		return "Šablona musí obsahovat {id}."
	}
	if sablona == vychoziSablonaObrazku {
		sablona = ""
	}
	puvodni, _ := sablonaObrazku.Load().(string)
	var vzorek string
	a.db.QueryRow("SELECT drive_file_id FROM fotografie WHERE overeno IS NOT NULL AND nedostupne_od IS NULL ORDER BY overeno DESC LIMIT 1").Scan(&vzorek)
	if vzorek != "" {
		sablonaObrazku.Store(sablona)
		stav := overitSoubor(vzorek)
		sablonaObrazku.Store(puvodni)
		if stav == souborNedostupny {
			return "S touto šablonou se nenačte ani fotka, která byla naposledy dostupná. Šablona se neuložila."
		}
	}
	if err := a.ulozitNastaveni("sablona_obrazku", sablona); err != nil {
		a.chyba("uložení šablony adresy obrázků", err)
		return "Šablonu se nepodařilo uložit."
	}
	if sablona != puvodni {
		if _, err := a.nahledy.Vymazat(); err != nil {
			a.chyba("vymazání náhledů", err)
		}
	}
	sablonaObrazku.Store(sablona)
	return ""
}

// Úprava č. 4: údaje označené „netýká se" u modelky a u alba
func (a *App) migraceNetykaSe() error {
	for _, tabulka := range []string{"modelky", "alba"} {
		if !a.maSloupec(tabulka, "netyka_se") {
			if _, err := a.db.Exec("ALTER TABLE " + tabulka + " ADD COLUMN netyka_se TEXT"); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	cesta, err := pripravitDatabazi()
	if err == nil {
		err = a.otevritDatabazi(cesta)
	}
	if err != nil {
		a.chybaStartu = fmt.Sprintf("Databázi se nepodařilo otevřít (%v). Aplikace běží s prázdnou dočasnou databází, změny se neuloží.", err)
		fmt.Println(a.chybaStartu)
		a.db, _ = sql.Open("sqlite", ":memory:")
		a.db.SetMaxOpenConns(1)
	}

	if a.chybaStartu == "" {
		if err := a.migrovat(); err != nil {
			a.chybaStartu = fmt.Sprintf("Databázi se nepodařilo připravit (%v). Záloha před úpravou je ve složce %s.", err, slozkaZaloh())
		}
	}
	if a.chybaStartu != "" && a.cestaDb != "" {
		a.prepnoutJenProCteni()
		fmt.Println(a.chybaStartu)
	}

	sablonaObrazku.Store(a.nastaveni("sablona_obrazku"))
	if a.uc != nil {
		a.uc.cestaSbirky = a.cestaDb
	}
	a.pripravitObsah()

	if a.chybaStartu == "" && a.cestaDb != "" {
		a.zapnoutWAL()
	}
	if a.chybaStartu == "" {
		if !a.startNaPozadi {
			a.denniZaloha()
			return
		}
		if a.naPozadi == nil {
			a.naPozadi = &sync.WaitGroup{}
		}
		a.naPozadi.Add(2)
		go func() {
			defer a.naPozadi.Done()
			a.denniZaloha()
		}()
		go func() {
			defer a.naPozadi.Done()
			a.snimekVPameti()
		}()
		time.AfterFunc(time.Minute, a.uklidNahledu)
		// Otisky fotek pro Údržbu › Stejné fotky: na pozadí, až se program rozběhne (náhledy ustupují oknu)
		time.AfterFunc(3*time.Minute, func() { a.SpustitOtisky() })
	}
}

const dsnBezWAL = "?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=cache_size(-32000)&_pragma=temp_store(MEMORY)"
const dsnDatabaze = dsnBezWAL + "&_pragma=synchronous(NORMAL)"

func (a *App) zapnoutWAL() {
	var rezim string
	if err := a.db.QueryRow("PRAGMA journal_mode = WAL").Scan(&rezim); err != nil || rezim != "wal" {
		fmt.Printf("Režim WAL se nepodařilo zapnout (%s, %v), databáze běží v původním režimu\n", rezim, err)
		if db, err := sql.Open("sqlite", a.cestaDb+dsnBezWAL); err == nil && db.Ping() == nil {
			a.zavritPametSbirky(false)
			a.db.Close()
			a.db = db
		}
	}
}

func (a *App) otevritDatabazi(cesta string) error {
	db, err := sql.Open("sqlite", cesta+dsnDatabaze)
	if err == nil {
		err = db.Ping()
	}
	if err != nil {
		return err
	}
	a.db = db
	a.cestaDb = cesta
	os.Chmod(slozkaDat(), 0o700)
	os.Chmod(cesta, 0o600)
	if stav := kontrolaSouboru(a.db); stav != "" {
		a.chybaStartu = fmt.Sprintf("Soubor databáze je poškozený (%s). Nic neupravuj a obnov poslední zálohu.", stav)
		fmt.Println(a.chybaStartu)
	}
	return nil
}

const schemaSCizimiKlici = 6

func kontrolaCizichKlicu(db dotazovac) error {
	var tabulka string
	var radek, rodic interface{}
	var fk int
	if err := db.QueryRow("PRAGMA foreign_key_check").Scan(&tabulka, &radek, &rodic, &fk); err == nil {
		return fmt.Errorf("tabulka %s odkazuje na neexistující záznam v %v", tabulka, rodic)
	}
	return nil
}

func kontrolaSouboru(db *sql.DB) string {
	var stav string
	if err := db.QueryRow("PRAGMA quick_check").Scan(&stav); err != nil {
		return err.Error()
	}
	if stav != "ok" {
		return stav
	}
	return ""
}

var migrace = []func(a *App) error{
	(*App).migraceZaklad,
	(*App).migraceIndexy,
	(*App).migraceSdilenaAlba,
	(*App).migraceNetykaSe,
	(*App).migraceVydaniAVybery,
	(*App).migraceAlbumJakoZaznam,
	(*App).migraceSpecialy,
	(*App).migraceUmrtiAObalka,
	(*App).migraceClanky,
	(*App).migraceFTS5,
	(*App).migraceFTSKlice,
	(*App).migraceDatumAlba,
	(*App).migraceHodnoceniPul,
	(*App).migraceTagyFotek,
	(*App).migracePruvodceFotek,
	(*App).migraceProfilovaFotka,
}

func (a *App) migrovat() error {
	var verze int
	if err := a.db.QueryRow("PRAGMA user_version").Scan(&verze); err != nil {
		return err
	}
	if verze > len(migrace) {
		return fmt.Errorf("databáze je z novější verze programu (schéma %d, program zná %d)", verze, len(migrace))
	}
	if verze == len(migrace) {
		return nil
	}

	if a.maSloupec("modelky", "id") && a.maSloupec("fotografie", "id") {
		if err := a.zalohovat("pred-migraci"); err != nil {
			return fmt.Errorf("záloha před úpravou schématu selhala: %w", err)
		}
	}
	a.db.SetMaxOpenConns(1)
	defer a.db.SetMaxOpenConns(0)
	a.db.Exec("PRAGMA foreign_keys = OFF")
	defer a.db.Exec("PRAGMA foreign_keys = ON")
	for cislo := verze + 1; cislo <= len(migrace); cislo++ {
		if _, err := a.db.Exec("BEGIN"); err != nil {
			return err
		}
		err := migrace[cislo-1](a)
		if err == nil {
			_, err = a.db.Exec(fmt.Sprintf("PRAGMA user_version = %d", cislo))
		}
		if err == nil && cislo >= schemaSCizimiKlici {
			err = kontrolaCizichKlicu(a.db)
		}
		if err != nil {
			a.db.Exec("ROLLBACK")
			return fmt.Errorf("úprava schématu č. %d: %w", cislo, err)
		}
		if _, err := a.db.Exec("COMMIT"); err != nil {
			return err
		}
	}
	return nil
}

var sloupceModelkySchema1 = [][2]string{
	{"narozeni_datum", "TEXT"}, {"narozeni_misto", "TEXT"}, {"narodnost", "TEXT"}, {"etnicita", "TEXT"},
	{"vyska_cm", "INTEGER"}, {"vaha_kg", "INTEGER"}, {"vlasy_barva", "TEXT"}, {"oci_barva", "TEXT"}, {"miry", "TEXT"},
	{"obvod_hrudnik_cm", "INTEGER"}, {"obvod_pas_cm", "INTEGER"}, {"obvod_boky_cm", "INTEGER"}, {"velikost_prsou", "TEXT"},
	{"prsa_typ", "TEXT"}, {"ochlupeni", "TEXT"}, {"tetovani", "INTEGER"}, {"piercing", "INTEGER"}, {"vystoupeni", "TEXT"},
	{"pictorial_vydani", "TEXT"}, {"role", "TEXT"}, {"tags", "TEXT"}, {"dalsi_jmena", "TEXT"}, {"poznamka", "TEXT"},
	{"drive_cover_id", "TEXT"},
}

func (a *App) migraceZaklad() error {
	if _, err := a.db.Exec(`
	CREATE TABLE IF NOT EXISTS modelky (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		jmeno TEXT NOT NULL
	);`); err != nil {
		return err
	}

	if !a.maSloupec("modelky", "drive_cover_id") && a.maSloupec("modelky", "drive_file_id") {
		if _, err := a.db.Exec(`ALTER TABLE modelky RENAME COLUMN drive_file_id TO drive_cover_id`); err != nil {
			return err
		}
	}

	for _, s := range sloupceModelkySchema1 {
		if a.maSloupec("modelky", s[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE modelky ADD COLUMN %s %s`, s[0], s[1])); err != nil {
			return err
		}
	}

	if !a.maSloupec("modelky", "pridano") {
		if _, err := a.db.Exec(`ALTER TABLE modelky ADD COLUMN pridano TEXT`); err != nil {
			return err
		}
	}

	if !a.maSloupec("modelky", "hodnoceni") {
		if _, err := a.db.Exec(`ALTER TABLE modelky ADD COLUMN hodnoceni INTEGER`); err != nil {
			return err
		}
		if a.maSloupec("modelky", "oblibena") {
			if _, err := a.db.Exec(`UPDATE modelky SET hodnoceni = 5 WHERE oblibena = 1`); err != nil {
				return err
			}
		}
	}

	for _, s := range sloupceVyrezu {
		if a.maSloupec("modelky", s[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE modelky ADD COLUMN %s REAL`, s[0])); err != nil {
			return err
		}
	}

	a.db.Exec(`
	CREATE TABLE IF NOT EXISTS fotografie (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		modelka_id INTEGER,
		album TEXT,
		typ TEXT,
		drive_file_id TEXT,
		FOREIGN KEY(modelka_id) REFERENCES modelky(id)
	);`)

	for _, sloupec := range [][2]string{{"rotace", "INTEGER"}, {"spojit", "INTEGER"}, {"vydani", "TEXT"}, {"hodnoceni", "INTEGER"}, {"poradi", "INTEGER"}, {"pridano", "TEXT"}} {
		if a.maSloupec("fotografie", sloupec[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE fotografie ADD COLUMN %s %s`, sloupec[0], sloupec[1])); err != nil {
			return err
		}
	}

	a.db.Exec(`CREATE TABLE IF NOT EXISTS nastaveni (klic TEXT PRIMARY KEY, hodnota TEXT);`)

	a.db.Exec(`
	CREATE TABLE IF NOT EXISTS alba (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		modelka_id INTEGER NOT NULL,
		album TEXT NOT NULL,
		typ TEXT NOT NULL,
		popis TEXT,
		fotograf TEXT,
		UNIQUE(modelka_id, album, typ)
	);`)
	return nil
}

func (a *App) migraceIndexy() error {
	kroky := []string{
		`UPDATE fotografie SET modelka_id = 0 WHERE modelka_id IS NULL`,
		`DELETE FROM fotografie WHERE id NOT IN (SELECT MIN(id) FROM fotografie GROUP BY modelka_id, album, typ, drive_file_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS fotografie_soubor_v_albu ON fotografie(modelka_id, album, typ, drive_file_id)`,
		`CREATE INDEX IF NOT EXISTS fotografie_vydani ON fotografie(vydani)`,
	}
	for _, krok := range kroky {
		if _, err := a.db.Exec(krok); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) shutdown() {
	a.ZastavitStahovaniNahledu()
	a.zastavitOtisky()
	a.PrerusitPruchodWebem()
	a.PrerusitKontroluOtoceni()
	a.PrerusitKontroluKvality()
	a.obsah.Zastavit()
	obsah.UkoncitProstredi()
	a.pockatNaPozadi()
	a.zavritPametSbirky(true)
	if a.db != nil {
		a.db.Close()
	}
	a.uc.zavrit()
}

var vzorHolehoID = regexp.MustCompile(`^[a-zA-Z0-9_-]{25,}$`)

func jeHoleID(text string) bool {
	return nahledy.JeHoleID(text)
}

var vzorOdkazuDrive = regexp.MustCompile(`(?:file/d/|id=|/d/)([a-zA-Z0-9_-]{25,})`)

func parseDriveIDs(rawInput string) []string {
	if jeHoleID(rawInput) {
		return []string{rawInput}
	}
	matches := vzorOdkazuDrive.FindAllStringSubmatch(rawInput, -1)

	var ids []string
	seen := make(map[string]bool)

	for _, m := range matches {
		if len(m) > 1 && !seen[m[1]] {
			seen[m[1]] = true
			ids = append(ids, m[1])
		}
	}

	for _, slovo := range strings.Fields(rawInput) {
		if jeHoleID(slovo) && !seen[slovo] {
			seen[slovo] = true
			ids = append(ids, slovo)
		}
	}

	return ids
}

// Hromadný zápis v jedné transakci: jeden zápis na disk místo jednoho za každou fotku, a buď vše, nebo nic.
// Import už běží ve vlastní transakci, tam se zapisuje přímo do ní.
func (a *App) vTransakci(kde string, fn func(q dotazovac) error) bool {
	if a.vImportu {
		if err := fn(a.db); err != nil {
			a.chyba(kde, err)
			return false
		}
		return true
	}
	tx, err := a.db.Begin()
	if err == nil {
		defer tx.Rollback()
		if err = fn(tx); err == nil {
			err = tx.Commit()
		}
	}
	if err != nil {
		a.chyba(kde, err)
	}
	return err == nil
}
