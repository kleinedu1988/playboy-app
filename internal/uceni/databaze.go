package uceni

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"strings"
	"time"
)

// Úpravy schématu databáze učení (jako u sbírky: hotové se nemění, nové se přidávají na konec)
var MigraceUceni = []string{
	`CREATE TABLE stav (klic TEXT PRIMARY KEY, hodnota TEXT NOT NULL);
	CREATE TABLE udalosti (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cas TEXT NOT NULL,
		druh TEXT NOT NULL,
		modelka_id INTEGER NOT NULL,
		album TEXT NOT NULL DEFAULT '',
		typ TEXT NOT NULL DEFAULT '',
		pole TEXT NOT NULL,
		navrh TEXT NOT NULL DEFAULT '',
		hodnota TEXT NOT NULL DEFAULT '',
		zdroj TEXT NOT NULL DEFAULT '',
		jistota REAL NOT NULL DEFAULT 0,
		jistota_vzorce REAL NOT NULL DEFAULT 0
	);
	CREATE INDEX udalosti_druh ON udalosti(druh);
	CREATE TABLE odmitnute (
		modelka_id INTEGER NOT NULL,
		album TEXT NOT NULL,
		typ TEXT NOT NULL,
		pole TEXT NOT NULL,
		klic TEXT NOT NULL,
		hodnota TEXT NOT NULL,
		cas TEXT NOT NULL,
		PRIMARY KEY (modelka_id, album, typ, pole, klic)
	);
	CREATE TABLE zapisy (
		pole TEXT NOT NULL,
		klic TEXT NOT NULL,
		zapis TEXT NOT NULL,
		pocet INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY (pole, klic, zapis)
	);
	CREATE TABLE mezipamet (druh TEXT PRIMARY KEY, otisk TEXT NOT NULL, data BLOB NOT NULL, cas TEXT NOT NULL);`,
	// Úprava č. 2: porovnání dvojic modelek „Která se ti líbí víc?“ (oblibenost.go): čas, modelky A a B, výsledek
	// (a, b, remiza) a jejich srdíčka v tu chvíli (po polovinách)
	`CREATE TABLE porovnani (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cas TEXT NOT NULL,
		a INTEGER NOT NULL,
		b INTEGER NOT NULL,
		vysledek TEXT NOT NULL CHECK (vysledek IN ('a', 'b', 'remiza')),
		hodnoceni_a REAL NOT NULL DEFAULT 0,
		hodnoceni_b REAL NOT NULL DEFAULT 0
	);`,
	// Úprava č. 3: zájem o modelky (oblibenost_zajem.go) – otevření profilu a čas prohlížení jejích fotek – a denní
	// snímky oblíbenosti (pořadí a trend)
	`CREATE TABLE zajem (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cas TEXT NOT NULL,
		modelka_id INTEGER NOT NULL,
		druh TEXT NOT NULL CHECK (druh IN ('profil', 'fotky')),
		sekund INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX zajem_modelka ON zajem(modelka_id);
	CREATE TABLE historie_oblibenosti (
		den TEXT NOT NULL,
		modelka_id INTEGER NOT NULL,
		oblibenost REAL NOT NULL,
		poradi INTEGER NOT NULL,
		PRIMARY KEY (den, modelka_id)
	);`,
	// Úprava č. 4: držitelky úrovní Top N po každém porovnání (oblibenost_urovne.go, obhajoba místa); porovnani_id =
	// poslední porovnání, po kterém platí (vrácení porovnání vrátí i držitelky), modelka_id 0 = značka stavu
	`CREATE TABLE drzitelky_urovni (
		porovnani_id INTEGER NOT NULL,
		modelka_id INTEGER NOT NULL,
		uroven INTEGER NOT NULL,
		PRIMARY KEY (porovnani_id, modelka_id)
	);`,
	// Úprava č. 5: kronika síně slávy (oblibenost_slava.go) – vstupy do top 10, výpadky, obhajoby a nové jedničky;
	// porovnani_id = poslední porovnání v době zápisu (vrácení porovnání smaže i události po něm)
	`CREATE TABLE kronika_slavy (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		cas TEXT NOT NULL,
		porovnani_id INTEGER NOT NULL,
		modelka_id INTEGER NOT NULL,
		druh TEXT NOT NULL,
		misto INTEGER NOT NULL DEFAULT 0,
		souperka INTEGER NOT NULL DEFAULT 0
	);`,
	// Úprava č. 6: srdíčka daná přijetím odhadu vkusu v rychlém hodnocení (oblibenost_hodnoceni.go) – model vkusu
	// se z nich neučí, dokud je nepotvrdí porovnání (jinak by se učil sám ze sebe)
	`CREATE TABLE prevzate_odhady (
		modelka_id INTEGER PRIMARY KEY,
		hodnoceni REAL NOT NULL,
		cas TEXT NOT NULL
	);`,
	// Úprava č. 7: uzavřené sezóny (oblibenost_sezony.go) – měsíc, Favoritka (0 = bez titulu), Miláček (volba
	// uživatele, 0 = žádný), body Favoritky a počet soubojů v sezóně
	`CREATE TABLE sezony (
		mesic TEXT PRIMARY KEY,
		favoritka INTEGER NOT NULL DEFAULT 0,
		milacek INTEGER NOT NULL DEFAULT 0,
		body INTEGER NOT NULL DEFAULT 0,
		souboju INTEGER NOT NULL DEFAULT 0,
		uzavreno TEXT NOT NULL
	);`,
	// Úprava č. 8: tematické sezóny (oblibenost_temata.go) – téma měsíce (klíč podmínek, "" = Klasická) a téma,
	// ve kterém se porovnání odehrálo ("" = mimo téma)
	`CREATE TABLE temata_sezon (
		mesic TEXT PRIMARY KEY,
		tema TEXT NOT NULL,
		zvoleno TEXT NOT NULL
	);
	ALTER TABLE porovnani ADD COLUMN tema TEXT NOT NULL DEFAULT '';`,
	// Úprava č. 9: sezóny jako období různé délky (oblibenost_obdobi.go) – od (první den, klíč sezóny), do (den po
	// posledním), téma; témata měsíců z úpravy č. 8 se převedou na období celého měsíce;
	// uzavřená sezóna si pamatuje téma, ve kterém opravdu běžela
	`CREATE TABLE obdobi_sezon (
		od TEXT PRIMARY KEY,
		do TEXT NOT NULL,
		tema TEXT NOT NULL DEFAULT '',
		zvoleno TEXT NOT NULL DEFAULT ''
	);
	INSERT INTO obdobi_sezon (od, do, tema, zvoleno) SELECT mesic || '-01', date(mesic || '-01', '+1 month'), tema, zvoleno FROM temata_sezon;
	ALTER TABLE sezony ADD COLUMN tema TEXT NOT NULL DEFAULT '';`,
	// Úprava č. 10: změny srdíček modelek (vkus_v_case.go) – čas, modelka, srdíčka před a po (Můj vkus v čase)
	`CREATE TABLE historie_srdicek (
		cas TEXT NOT NULL,
		modelka_id INTEGER NOT NULL,
		pred REAL NOT NULL,
		po REAL NOT NULL
	);
	CREATE INDEX historie_srdicek_cas ON historie_srdicek(cas);`,
}

// TabulkyUceni jsou tabulky s naučeným z Údržby (bez mezipaměti), které se při čtení souboru jen pro čtení přenesou do paměti
// a které ZapomenoutUceni vyprázdní.
var TabulkyUceni = []string{"udalosti", "odmitnute", "zapisy"}

// TabulkyPorovnani jsou tabulky oblíbenosti: do paměti se přenesou také, ale zapomínají se zvlášť (ZapomenoutPorovnani).
var TabulkyPorovnani = []string{"porovnani", "zajem", "historie_oblibenosti", "drzitelky_urovni", "kronika_slavy", "prevzate_odhady", "sezony"}

// Druhy událostí deníku
const (
	UdalostPrijato       = "prijato"        // návrh přijat beze změny
	UdalostOdmitnuto     = "odmitnuto"      // navržená hodnota odmítnuta
	UdalostZpet          = "zpet"           // odmítnutí zrušeno
	UdalostOpraveno      = "opraveno"       // navržená hodnota před uložením upravena
	UdalostVPoradku      = "v-poradku"      // nález kontroly označen „V pořádku“ (planý poplach)
	UdalostZnovu         = "znovu"          // „V pořádku“ zrušeno
	UdalostNalezOpraveny = "nalez-opraveny" // nález zmizel, protože uživatel údaj modelky opravil
)

// Kalibrace a prahy
const (
	VahaKalibrace     = 8     // předpoklad zdroje váží jako 8 rozhodnutí
	PolocasZapomneni  = 365.0 // dny: starší rozhodnutí váží méně (po roce polovinou)
	VahaPredpokladuOk = 6.0   // přesnost pravidla kontroly: předpoklad Beta(4, 2), tedy 2/3 nálezů je skutečná chyba
	PocetZalohUceni   = 5
)

type PametVysledku[T any] struct {
	Otisk string
	Data  T
	Ma    bool
}

func SouborUceni(cestaSbirky string) string {
	return strings.TrimSuffix(cestaSbirky, ".db") + "-uceni.db"
}

// ChybaUceni popisuje chybu otevření souboru učení: poškozený, z novější verze nebo jen pro čtení.
type ChybaUceni struct {
	Err       error
	Poskozena bool
	Prenest   bool
	Zdroj     *sql.DB
}

func (e ChybaUceni) Error() string { return e.Err.Error() }

func OtevritSouborUceni(cesta, predpona, dsn string, migrace []string, kontrola func(*sql.DB) string, nyni string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", predpona+cesta+dsn)
	if err == nil {
		err = db.Ping()
	}
	if err != nil {
		if db != nil {
			db.Close()
		}
		if strings.Contains(err.Error(), "not a database") || strings.Contains(err.Error(), "malformed") {
			return nil, ChybaUceni{Err: err, Poskozena: true}
		}
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if stav := kontrola(db); stav != "" {
		db.Close()
		return nil, ChybaUceni{Err: fmt.Errorf("%s", stav), Poskozena: true}
	}
	var verze int
	if err := db.QueryRow("PRAGMA user_version").Scan(&verze); err != nil {
		db.Close()
		return nil, ChybaUceni{Err: err, Poskozena: true}
	}
	if verze > len(migrace) {
		db.Close()
		return nil, ChybaUceni{Err: fmt.Errorf("databáze učení je z novější verze (schéma %d, program zná %d)", verze, len(migrace))}
	}
	if err := MigrovatUceni(db, verze, migrace); err != nil {
		return nil, ChybaUceni{Err: err, Prenest: verze == len(migrace), Zdroj: db}
	}
	// Zkouška zápisu: soubor jen pro čtení se pozná až teď
	if _, err := db.Exec("INSERT OR REPLACE INTO stav (klic, hodnota) VALUES ('otevreno', ?)", nyni); err != nil {
		return nil, ChybaUceni{Err: err, Prenest: true, Zdroj: db}
	}
	os.Chmod(cesta, 0o600)
	return db, nil
}

func MigrovatUceni(db *sql.DB, verze int, migrace []string) error {
	for cislo := verze + 1; cislo <= len(migrace); cislo++ {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(migrace[cislo-1]); err != nil {
			tx.Rollback()
			return fmt.Errorf("úprava databáze učení č. %d: %w", cislo, err)
		}
		if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", cislo)); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// OtevritUceniVPameti otevře databázi učení v paměti; se zdrojem (soubor jen pro čtení) do ní v jediné transakci přenese naučené.
func OtevritUceniVPameti(zdroj *sql.DB, migrace []string) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return nil
	}
	db.SetMaxOpenConns(1) // každé spojení by mělo vlastní prázdnou paměť
	if err := MigrovatUceni(db, 0, migrace); err != nil {
		db.Close()
		return nil
	}
	if zdroj == nil {
		return db
	}
	tx, err := db.Begin()
	if err != nil {
		return db
	}
	for _, seznam := range [2][]string{TabulkyUceni, TabulkyPorovnani} {
		for _, tabulka := range seznam {
			radky, err := zdroj.Query("SELECT * FROM " + tabulka)
			if err != nil {
				continue
			}
			sloupce, _ := radky.Columns()
			otazniky := strings.TrimSuffix(strings.Repeat("?, ", len(sloupce)), ", ")
			stmt, err := tx.Prepare("INSERT OR IGNORE INTO " + tabulka + " (" + strings.Join(sloupce, ", ") + ") VALUES (" + otazniky + ")")
			if err != nil {
				radky.Close()
				continue
			}
			h := make([]any, len(sloupce))
			ukazatele := make([]any, len(sloupce))
			for i := range h {
				ukazatele[i] = &h[i]
			}
			for radky.Next() {
				if radky.Scan(ukazatele...) == nil {
					stmt.Exec(h...)
				}
			}
			stmt.Close()
			radky.Close()
		}
	}
	_ = tx.Commit()
	return db
}

// OmezitJistotu omezí jistotu z rozhraní do deníku na meze 0–1.
func OmezitJistotu(p float64) float64 {
	if math.IsNaN(p) {
		return 0
	}
	return min(1, max(0, p))
}

// KalibraceZdroje drží vážené součty a počty rozhodnutí pro kalibraci jednoho zdroje návrhů.
type KalibraceZdroje struct {
	N, Prijato, Predpoved  float64 // vážené součty
	Prijatych, Odmitnutych int     // počty rozhodnutí (pro přehled)
}

// Presnost vrátí odhad skutečné úspěšnosti zdroje (r); bez rozhodnutí předpoklad zdroje
func (k KalibraceZdroje) Presnost(predpoklad float64) float64 {
	prumer := predpoklad
	if k.N > 0 {
		prumer = k.Predpoved / k.N
	}
	return (k.Prijato + VahaKalibrace*prumer) / (k.N + VahaKalibrace)
}

// Upravit vrátí kalibrovanou jistotu návrhu; bez rozhodnutí beze změny
func (k KalibraceZdroje) Upravit(p, predpoklad float64) float64 {
	if k.N <= 0 {
		return p
	}
	prumer := k.Predpoved / k.N
	return ZLogitu(Logit(p) + Logit(k.Presnost(predpoklad)) - Logit(prumer))
}

// UdalostUceni je událost deníku pro výpočty kalibrace a prahů
type UdalostUceni struct {
	Druh                  string
	Modelka               int
	Album, Typ, Pole      string
	Navrh, Hodnota, Zdroj string
	Vzorec                float64
	Cas                   time.Time
}

// VahaStari vrátí váhu rozhodnutí podle stáří: 0,5^(dny/poločas)
func VahaStari(cas, ted time.Time) float64 {
	dny := max(0, ted.Sub(cas).Hours()/24)
	return math.Pow(0.5, dny/PolocasZapomneni)
}

// StavUceni popisuje stav databáze učení pro okno Údržby
type StavUceni struct {
	Soubor    string       `json:"soubor"`   // soubor databáze učení; prázdný = jen v paměti
	Velikost  int64        `json:"velikost"` // bajtů
	Udalosti  int          `json:"udalosti"`
	Prijato   int          `json:"prijato"`
	Odmitnuto int          `json:"odmitnuto"`
	Opraveno  int          `json:"opraveno"`
	Zdroje    []ZdrojUceni `json:"zdroje"`
	Naposledy string       `json:"naposledy"` // čas poslední události (RRRR-MM-DD HH:MM:SS), prázdný bez událostí
	Porovnani int          `json:"porovnani"`
}

// ZdrojUceni popisuje zdroj návrhů v přehledu učení
type ZdrojUceni struct {
	Zdroj     string  `json:"zdroj"`
	Popis     string  `json:"popis"`
	Navrhu    int     `json:"navrhu"` // současné neodmítnuté návrhy, které zdroj podporuje
	Prijato   int     `json:"prijato"`
	Odmitnuto int     `json:"odmitnuto"`
	Presnost  float64 `json:"presnost"` // kalibrovaná úspěšnost 0–1
	Aktivni   bool    `json:"aktivni"`  // i nejsilnější návrh zdroje ještě projde prahem
}
