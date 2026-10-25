package main

import (
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// Databáze učení: vlastní soubor SQLite vedle sbírky (playboy.db → playboy-uceni.db). Pamatuje si, co se
// strojové učení dozvědělo z rozhodnutí uživatele, a mezipaměť naučených výsledků (celkový popis v docs/UCENI.md):
//
//   - deník událostí: každé přijetí, odmítnutí a jeho zrušení, oprava navržené hodnoty před uložením,
//     „V pořádku“ a „Znovu kontrolovat“ u nálezu kontroly a nález, který zmizel opravou údaje;
//   - odmítnuté hodnoty návrhů (odmítnutí „Kanada“ neblokuje jiné hodnoty téhož údaje);
//   - zápisy, na které uživatel návrh opravil (jen jiný tvar téže hodnoty, např. „USA“ → „Spojené státy“);
//   - mezipaměť návrhů a nálezů podle otisku sbírky, aby se Přehled při každém otevření nepočítal znovu.
//
// Z deníku se počítá kalibrace zdrojů návrhů a prahy kontroly. Sbírka se databáze učení nikdy netýká: má vlastní
// číslo schématu (user_version) a úpravy, nezávislé na zmrazeném schématu sbírky. Chybí-li soubor, vznikne;
// je-li poškozený, odloží se a začne se znovu; nejde-li zapisovat (nebo je z novější verze), učení běží jen
// v paměti (do zavření programu). Smazání souboru (nebo ZapomenoutUceni) zapomene jen naučené z rozhodnutí;
// klíče „ok-…“ a „nv-…“ ve sbírce zůstanou. Nic z toho neopouští počítač.

// Úpravy schématu databáze učení (jako u sbírky: hotové se nemění, nové se přidávají na konec)
var migraceUceni = []string{
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
}

// Tabulky s naučeným z Údržby (bez mezipaměti), které se při čtení souboru jen pro čtení přenesou do paměti
// a které ZapomenoutUceni vyprázdní
var tabulkyUceni = []string{"udalosti", "odmitnute", "zapisy"}

// Porovnání dvojic: do paměti se přenesou také, ale zapomínají se zvlášť (ZapomenoutPorovnani)
var tabulkyPorovnani = []string{"porovnani"}

// Druhy událostí deníku
const (
	udalostPrijato       = "prijato"        // návrh přijat beze změny
	udalostOdmitnuto     = "odmitnuto"      // navržená hodnota odmítnuta
	udalostZpet          = "zpet"           // odmítnutí zrušeno
	udalostOpraveno      = "opraveno"       // navržená hodnota před uložením upravena
	udalostVPoradku      = "v-poradku"      // nález kontroly označen „V pořádku“ (planý poplach)
	udalostZnovu         = "znovu"          // „V pořádku“ zrušeno
	udalostNalezOpraveny = "nalez-opraveny" // nález zmizel, protože uživatel údaj modelky opravil
)

// Verze výpočtu: změna kódu modelů (jiné výsledky ze stejných údajů) zneplatní uloženou mezipaměť
const verzeModeluUceni = "uceni-1"

// Kalibrace a prahy
const (
	vahaKalibrace     = 8     // předpoklad zdroje váží jako 8 rozhodnutí
	polocasZapomneni  = 365.0 // dny: starší rozhodnutí váží méně (po roce polovinou)
	vahaPredpokladuOk = 6.0   // přesnost pravidla kontroly: předpoklad Beta(4, 2), tedy 2/3 nálezů je skutečná chyba
	pocetZalohUceni   = 5
)

// Parametry připojení (testy je mohou změnit, např. na soubor jen pro čtení: předpona „file:“ a mode=ro)
// synchronous NORMAL: při výpadku proudu se může ztratit poslední zápis, ne poškodit soubor; učení není sbírka
var predponaUceni, dsnUceni = "", "?_pragma=busy_timeout(3000)&_pragma=synchronous(NORMAL)"

// Stav databáze učení jedné aplikace (sdílí ho i kopie App při exportu; App importu ho nemá)
type uceni struct {
	mu          sync.Mutex
	cestaSbirky string // soubor sbírky; prázdný = sbírka v paměti, učení také
	otevreno    bool
	db          *sql.DB
	cesta       string // soubor databáze učení; prázdný = jen v paměti
	generace    int64  // poslední událost deníku: mění se s každým zápisem, je součástí otisku mezipaměti

	vstup         *vstupUceni // naučené pro návrhy (podle generace)
	vstupGenerace int64
	prahy         *prahyKontroly
	statistiky    map[string]*kalibraceZdroje // i s počty pro přehled

	navrhy      pametVysledku[[]navrhSbirky]
	nalezy      pametVysledku[ulozeneNalezy]
	posledniNav map[string]navrhSbirky   // poslední návrhy podle klíče (pro zpětnou vazbu)
	posledniNal map[string]PodezrelyUdaj // poslední nálezy podle klíče
	ukladani    sync.WaitGroup           // zápisy mezipaměti na pozadí
	// Po obnovení sbírky ze zálohy se zmizelé nálezy nepočítají jako opravené (data vrátila záloha, ne uživatel)
	bezPorovnani bool
	zavreno      bool // po zavření programu se už nic nezapisuje ani neotevírá

	// Výpočet návrhů a nálezů jen jeden najednou: Přehled volá GetPrehled, GetNavrhyDoplneni a GetStavUceni
	// souběžně a po změně dat by každé volání počítalo totéž znovu (a kontrola by opravu zapsala dvakrát).
	// Pořadí zámků: vypocet… vždy před mu.
	vypocetNavrhu, vypocetNalezu sync.Mutex

	// Porovnání dvojic a model oblíbenosti (oblibenost.go)
	ob oblibenostUceni
}

type pametVysledku[T any] struct {
	otisk string
	data  T
	ma    bool
}

// Nálezy v mezipaměti s otisky modelek, u kterých byly (pro poznání opravy údaje)
type ulozeneNalezy struct {
	Nalezy  []PodezrelyUdaj   `json:"nalezy"`
	Modelky map[string]string `json:"modelky"` // ID modelky → otisk jejích údajů
}

func souborUceni(cestaSbirky string) string {
	return strings.TrimSuffix(cestaSbirky, ".db") + "-uceni.db"
}

func varovatUceni(format string, args ...any) {
	fmt.Printf("Varování (databáze učení): "+format+"\n", args...)
}

// Otevření při prvním použití; volá se se zámkem. Vrací nil jen bez databáze učení vůbec (App importu).
func (u *uceni) zajistit() *sql.DB {
	if u.otevreno || u.zavreno {
		return u.db
	}
	u.otevreno = true
	if u.cestaSbirky == "" {
		u.db = otevritUceniVPameti(nil)
		return u.db
	}
	cesta := souborUceni(u.cestaSbirky)
	db, err := otevritSouborUceni(cesta)
	if err == nil {
		u.db, u.cesta = db, cesta
		u.nacistGeneraci()
		return u.db
	}
	switch e := err.(type) {
	case chybaUceni:
		if e.poskozena {
			// Poškozený soubor se odloží (ne smaže) a začne se znovu
			odlozena := fmt.Sprintf("%s.poskozena-%s", cesta, time.Now().Format("20060102-150405"))
			if os.Rename(cesta, odlozena) == nil {
				varovatUceni("soubor %s je poškozený (%v), odložen jako %s, učení začíná znovu", cesta, e.err, odlozena)
				if db, err := otevritSouborUceni(cesta); err == nil {
					u.db, u.cesta = db, cesta
					u.nacistGeneraci()
					return u.db
				}
			}
		}
		varovatUceni("soubor %s nejde použít (%v), učení běží jen v paměti", cesta, e.err)
		if e.prenest {
			u.db = otevritUceniVPameti(e.zdroj)
		}
	default:
		varovatUceni("soubor %s nejde otevřít (%v), učení běží jen v paměti", cesta, err)
	}
	if e, ok := err.(chybaUceni); ok && e.zdroj != nil {
		e.zdroj.Close()
	}
	if u.db == nil {
		u.db = otevritUceniVPameti(nil)
	}
	u.nacistGeneraci()
	return u.db
}

// Chyba otevření souboru učení: poškozený, z novější verze nebo jen pro čtení (pak jde naučené přenést do paměti)
type chybaUceni struct {
	err       error
	poskozena bool
	prenest   bool
	zdroj     *sql.DB
}

func (e chybaUceni) Error() string { return e.err.Error() }

func otevritSouborUceni(cesta string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", predponaUceni+cesta+dsnUceni)
	if err == nil {
		err = db.Ping()
	}
	if err != nil {
		if db != nil {
			db.Close()
		}
		if strings.Contains(err.Error(), "not a database") || strings.Contains(err.Error(), "malformed") {
			return nil, chybaUceni{err: err, poskozena: true}
		}
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if stav := kontrolaSouboru(db); stav != "" {
		db.Close()
		return nil, chybaUceni{err: fmt.Errorf("%s", stav), poskozena: true}
	}
	var verze int
	if err := db.QueryRow("PRAGMA user_version").Scan(&verze); err != nil {
		db.Close()
		return nil, chybaUceni{err: err, poskozena: true}
	}
	if verze > len(migraceUceni) {
		db.Close()
		return nil, chybaUceni{err: fmt.Errorf("databáze učení je z novější verze (schéma %d, program zná %d)", verze, len(migraceUceni))}
	}
	if err := migrovatUceni(db, verze); err != nil {
		return nil, chybaUceni{err: err, prenest: verze == len(migraceUceni), zdroj: db}
	}
	// Zkouška zápisu: soubor jen pro čtení se pozná až teď
	if _, err := db.Exec("INSERT OR REPLACE INTO stav (klic, hodnota) VALUES ('otevreno', ?)", ted()); err != nil {
		return nil, chybaUceni{err: err, prenest: true, zdroj: db}
	}
	os.Chmod(cesta, 0o600)
	return db, nil
}

func migrovatUceni(db *sql.DB, verze int) error {
	for cislo := verze + 1; cislo <= len(migraceUceni); cislo++ {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(migraceUceni[cislo-1]); err != nil {
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

// Databáze učení v paměti; se zdrojem (soubor jen pro čtení) se do ní přenese naučené
func otevritUceniVPameti(zdroj *sql.DB) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return nil
	}
	db.SetMaxOpenConns(1) // každé spojení by mělo vlastní prázdnou paměť
	if err := migrovatUceni(db, 0); err != nil {
		db.Close()
		return nil
	}
	if zdroj == nil {
		return db
	}
	for _, tabulka := range append(append([]string(nil), tabulkyUceni...), tabulkyPorovnani...) {
		radky, err := zdroj.Query("SELECT * FROM " + tabulka)
		if err != nil {
			continue
		}
		sloupce, _ := radky.Columns()
		otazniky := strings.TrimSuffix(strings.Repeat("?, ", len(sloupce)), ", ")
		var hodnoty [][]any
		for radky.Next() {
			h := make([]any, len(sloupce))
			ukazatele := make([]any, len(sloupce))
			for i := range h {
				ukazatele[i] = &h[i]
			}
			if radky.Scan(ukazatele...) == nil {
				hodnoty = append(hodnoty, h)
			}
		}
		radky.Close()
		for _, h := range hodnoty {
			db.Exec("INSERT OR IGNORE INTO "+tabulka+" ("+strings.Join(sloupce, ", ")+") VALUES ("+otazniky+")", h...)
		}
	}
	return db
}

func (u *uceni) nacistGeneraci() {
	if u.db != nil {
		u.db.QueryRow("SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'udalosti'), 0)").Scan(&u.generace)
	}
}

// Zápis události do deníku (bez databáze učení nic)
func (u *uceni) zapsat(druh string, modelka int, album, typ, pole, navrh, hodnota, zdroj string, jistota, vzorec float64) {
	if u == nil {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return
	}
	vysledek, err := db.Exec(`INSERT INTO udalosti (cas, druh, modelka_id, album, typ, pole, navrh, hodnota, zdroj, jistota, jistota_vzorce)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ted(), druh, modelka, album, typ, pole, navrh, hodnota, zdroj, jistota, vzorec)
	if err != nil {
		varovatUceni("událost se nezapsala: %v", err)
		return
	}
	if id, err := vysledek.LastInsertId(); err == nil {
		u.generace = id
	}
	u.vstup, u.prahy, u.statistiky = nil, nil, nil
}

// ---------------------------------------------------------------------------------------------------------
// Zpětná vazba z návrhů a kontroly

// Klíč návrhu pro dohledání zdroje a jistoty (modelka, album, typ, údaj, hodnota)
func klicNavrhuUceni(modelka int, album, typ, pole, hodnota string) string {
	return fmt.Sprintf("%d\x00%s\x00%s\x00%s\x00%s", modelka, album, typ, pole, klicHodnoty(pole, hodnota))
}

// Událost návrhu se zdroji a jistotou z posledního výpočtu (rozhraní posílá zpět, co dostalo; na co se
// spolehnout nedá, se dohledá)
func (a *App) zaznamenatNavrh(druh string, n NavrhDoplneni, vysledna string) {
	u := a.uc
	if u == nil {
		return
	}
	zdroj, jistota, vzorec := n.Zdroj, n.Jistota, n.Jistota
	u.mu.Lock()
	if p, ok := u.posledniNav[klicNavrhuUceni(n.ModelkaID, n.Album, n.Typ, n.Pole, n.Hodnota)]; ok {
		zdroj, jistota, vzorec = strings.Join(p.Zdroje, "+"), p.Jistota, p.JistotaVzorce
	}
	u.mu.Unlock()
	u.zapsat(druh, n.ModelkaID, n.Album, n.Typ, n.Pole, strings.TrimSpace(n.Hodnota), strings.TrimSpace(vysledna), zdroj, omezitJistotu(jistota), omezitJistotu(vzorec))
}

// Jistota z rozhraní do deníku jen v mezích 0–1: nekonečno nebo nesmysl by se přes kalibraci dostal až do
// přesnosti zdroje a GetStavUceni by nešlo převést na JSON (NaN, Inf)
func omezitJistotu(p float64) float64 {
	if math.IsNaN(p) {
		return 0
	}
	return min(1, max(0, p))
}

// Odmítnutí (nebo jeho zrušení) jedné hodnoty údaje; klic "" = celý údaj (uloží se jako „*“). Vrací, kolik
// odmítnutých hodnot u údaje zbývá (bez databáze učení 0).
func (u *uceni) odmitnoutHodnotu(ku klicUdaje, klic, hodnota string, odmitnout bool) int {
	if u == nil {
		return 0
	}
	if klic == "" {
		klic = "*"
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return 0
	}
	var err error
	switch {
	case odmitnout:
		_, err = db.Exec(`INSERT OR REPLACE INTO odmitnute (modelka_id, album, typ, pole, klic, hodnota, cas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			ku.modelka, ku.album, ku.typ, ku.pole, klic, hodnota, ted())
	case klic == "*":
		_, err = db.Exec(`DELETE FROM odmitnute WHERE modelka_id = ? AND album = ? AND typ = ? AND pole = ?`, ku.modelka, ku.album, ku.typ, ku.pole)
	default:
		_, err = db.Exec(`DELETE FROM odmitnute WHERE modelka_id = ? AND album = ? AND typ = ? AND pole = ? AND klic IN (?, '*')`,
			ku.modelka, ku.album, ku.typ, ku.pole, klic)
	}
	if err != nil {
		varovatUceni("odmítnutí se nezapsalo: %v", err)
	}
	u.vstup = nil
	zbyva := 0
	db.QueryRow(`SELECT COUNT(*) FROM odmitnute WHERE modelka_id = ? AND album = ? AND typ = ? AND pole = ?`, ku.modelka, ku.album, ku.typ, ku.pole).Scan(&zbyva)
	return zbyva
}

// „V pořádku“ (netyka) nebo „Znovu kontrolovat“ u nálezu kontroly; zdroj a popis z posledního výpočtu
func (a *App) zaznamenatNalez(modelka int, album, typ, klic string, netyka bool) {
	u := a.uc
	if u == nil {
		return
	}
	druh := udalostVPoradku
	if !netyka {
		druh = udalostZnovu
	}
	u.mu.Lock()
	n := u.posledniNal[klicNalezu(modelka, album, typ, klic)]
	u.mu.Unlock()
	u.zapsat(druh, modelka, album, typ, klic, n.Popis, "", n.Zdroj, 0, 0)
}

func klicNalezu(modelka int, album, typ, klic string) string {
	return fmt.Sprintf("%d\x00%s\x00%s\x00%s", modelka, album, typ, klic)
}

// Oprava navržené hodnoty před uložením (rozhraní volá, když uživatel návrh v poli upravil). Liší-li se jen
// zápis téže hodnoty (stejný klíč, nebo Jaro–Winkler aspoň 0,92), zapamatuje se zápis uživatele a návrh se
// počítá jako správný; jinak jako špatný. Nezměněná hodnota je přijetí.
func (a *App) ZaznamenatOpravu(modelkaID int, pole, puvodniNavrh, novaHodnota string) bool {
	u, ok := udajeNavrhu[pole]
	puvodniNavrh, novaHodnota = strings.TrimSpace(puvodniNavrh), strings.TrimSpace(novaHodnota)
	if !ok || a.uc == nil || puvodniNavrh == "" || novaHodnota == "" {
		return false
	}
	n := NavrhDoplneni{ModelkaID: modelkaID, Pole: pole, Hodnota: puvodniNavrh}
	// Návrh alba: album se dohledá v posledních návrzích
	a.uc.mu.Lock()
	for _, p := range a.uc.posledniNav {
		if p.ModelkaID == modelkaID && p.Pole == pole && klicHodnoty(pole, p.Hodnota) == klicHodnoty(pole, puvodniNavrh) {
			n = p.NavrhDoplneni
			break
		}
	}
	a.uc.mu.Unlock()
	if puvodniNavrh == novaHodnota {
		a.zaznamenatNavrh(udalostPrijato, n, novaHodnota)
		return true
	}
	if !u.cislo && jenZapis(pole, puvodniNavrh, novaHodnota) {
		a.uc.zapamatovatZapis(pole, klicHodnoty(pole, puvodniNavrh), novaHodnota)
	}
	a.zaznamenatNavrh(udalostOpraveno, n, novaHodnota)
	return true
}

// Dva zápisy téže hodnoty („USA“ a „Americká“, „Arny Freytag“ a „Arnie Freytag“)
func jenZapis(pole, a, b string) bool {
	ka, kb := klicHodnoty(pole, a), klicHodnoty(pole, b)
	return ka == kb || len([]rune(klicTextu(a))) >= minDelkaSlouceni && jaroWinkler(klicTextu(a), klicTextu(b)) >= 0.92
}

func (u *uceni) zapamatovatZapis(pole, klic, zapis string) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if db := u.zajistit(); db != nil {
		if _, err := db.Exec(`INSERT INTO zapisy (pole, klic, zapis) VALUES (?, ?, ?)
			ON CONFLICT(pole, klic, zapis) DO UPDATE SET pocet = pocet + 1`, pole, klic, zapis); err != nil {
			varovatUceni("zápis se neuložil: %v", err)
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Kalibrace zdrojů návrhů
//
// Každý zdroj slibuje jistotu p (vzorec v navrhy.go). Z rozhodnutí uživatele je vidět, jak často jeho návrhy
// opravdu sedí. Pro zdroj se sečte (s vahou podle stáří, poločas polocasZapomneni) n rozhodnutí, z nich
// k přijatých, a průměrná slíbená jistota p̄ v okamžiku návrhu. Skutečná úspěšnost se odhadne jako střední
// hodnota Beta rozdělení s předpokladem, že vzorec má pravdu:
//
//	r = (k + w·p̄)/(n + w),   w = vahaKalibrace
//
// a jistota každého návrhu zdroje se posune v log-šancích o rozdíl mezi skutečností a slibem:
//
//	logit p' = logit p + (logit r − logit p̄)
//
// Při málo rozhodnutích je r ≈ p̄ a posun ≈ 0; zdroj, jehož návrhy uživatel stále odmítá, klesne pod práh
// a přestane se nabízet sám. Posun v log-šancích zachová pořadí návrhů zdroje (silnější zůstane silnější).
// Izotonická kalibrace po intervalech jistoty by potřebovala stovky rozhodnutí na zdroj; tolik jich sbírka
// stovek modelek nemá, proto jediný posun na zdroj. Rozhodnutí o jednom návrhu se počítá jednou (poslední
// platí; zrušené odmítnutí se nepočítá). Oprava jen zápisu se počítá jako přijetí, oprava hodnoty jako odmítnutí.
// Návrh z více zdrojů se započítá každému z nich.
type kalibraceZdroje struct {
	n, prijato, predpoved  float64 // vážené součty
	prijatych, odmitnutych int     // počty rozhodnutí (pro přehled)
}

// Odhad skutečné úspěšnosti zdroje (r); bez rozhodnutí předpoklad zdroje
func (k kalibraceZdroje) presnost(predpoklad float64) float64 {
	prumer := predpoklad
	if k.n > 0 {
		prumer = k.predpoved / k.n
	}
	return (k.prijato + vahaKalibrace*prumer) / (k.n + vahaKalibrace)
}

// Kalibrovaná jistota návrhu; bez rozhodnutí beze změny
func (k kalibraceZdroje) upravit(p, predpoklad float64) float64 {
	if k.n <= 0 {
		return p
	}
	prumer := k.predpoved / k.n
	return zLogitu(logit(p) + logit(k.presnost(predpoklad)) - logit(prumer))
}

// Událost deníku pro výpočty
type udalostUceni struct {
	druh                  string
	modelka               int
	album, typ, pole      string
	navrh, hodnota, zdroj string
	vzorec                float64
	cas                   time.Time
}

func (u *uceni) nacistUdalosti(druhy ...string) []udalostUceni {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	otazniky := strings.TrimSuffix(strings.Repeat("?, ", len(druhy)), ", ")
	args := make([]any, len(druhy))
	for i, d := range druhy {
		args[i] = d
	}
	radky, err := db.Query(`SELECT druh, modelka_id, album, typ, pole, navrh, hodnota, zdroj, jistota_vzorce, cas FROM udalosti
		WHERE druh IN (`+otazniky+`) ORDER BY id`, args...)
	if err != nil {
		return nil
	}
	defer radky.Close()
	var udalosti []udalostUceni
	for radky.Next() {
		var e udalostUceni
		var cas string
		if radky.Scan(&e.druh, &e.modelka, &e.album, &e.typ, &e.pole, &e.navrh, &e.hodnota, &e.zdroj, &e.vzorec, &cas) == nil {
			e.cas, _ = time.ParseInLocation("2006-01-02 15:04:05", cas, time.Local)
			udalosti = append(udalosti, e)
		}
	}
	return udalosti
}

// Váha rozhodnutí podle stáří: 0,5^(dny/poločas)
func vahaStari(cas, ted time.Time) float64 {
	dny := max(0, ted.Sub(cas).Hours()/24)
	return math.Pow(0.5, dny/polocasZapomneni)
}

// Kalibrace všech zdrojů z deníku (volá se se zámkem)
func (u *uceni) spocitatKalibraci() map[string]*kalibraceZdroje {
	type rozhodnuti struct {
		y      float64
		zdroj  string
		vzorec float64
		cas    time.Time
	}
	posledni := map[string]rozhodnuti{}
	var poradi []string
	for _, e := range u.nacistUdalosti(udalostPrijato, udalostOdmitnuto, udalostZpet, udalostOpraveno) {
		klic := klicNavrhuUceni(e.modelka, e.album, e.typ, e.pole, e.navrh)
		if _, ok := posledni[klic]; !ok {
			poradi = append(poradi, klic)
		}
		switch e.druh {
		case udalostZpet:
			delete(posledni, klic)
			continue
		case udalostPrijato:
			posledni[klic] = rozhodnuti{1, e.zdroj, e.vzorec, e.cas}
		case udalostOdmitnuto:
			posledni[klic] = rozhodnuti{0, e.zdroj, e.vzorec, e.cas}
		case udalostOpraveno:
			y := 0.0
			if jenZapis(e.pole, e.navrh, e.hodnota) {
				y = 1
			}
			posledni[klic] = rozhodnuti{y, e.zdroj, e.vzorec, e.cas}
		}
	}
	kalibrace := map[string]*kalibraceZdroje{}
	nyni := time.Now()
	for _, klic := range poradi {
		r, ok := posledni[klic]
		if !ok || r.zdroj == "" {
			continue
		}
		w := vahaStari(r.cas, nyni)
		for _, z := range strings.Split(r.zdroj, "+") {
			k := kalibrace[z]
			if k == nil {
				k = &kalibraceZdroje{}
				kalibrace[z] = k
			}
			k.n += w
			k.prijato += w * r.y
			k.predpoved += w * r.vzorec
			if r.y > 0 {
				k.prijatych++
			} else {
				k.odmitnutych++
			}
		}
	}
	return kalibrace
}

// Naučené pro návrhy a generace, ze které je (bez databáze učení nil)
func (u *uceni) vstupNavrhu() (*vstupUceni, int64) {
	if u == nil {
		return nil, 0
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return nil, 0
	}
	if u.vstup != nil && u.vstupGenerace == u.generace {
		return u.vstup, u.generace
	}
	v := &vstupUceni{odmitnute: map[klicUdaje]map[string]bool{}, kalibrace: map[string]kalibraceZdroje{}, zapisy: map[string]map[string]string{}}
	if radky, err := db.Query("SELECT modelka_id, album, typ, pole, klic FROM odmitnute"); err == nil {
		for radky.Next() {
			var ku klicUdaje
			var klic string
			if radky.Scan(&ku.modelka, &ku.album, &ku.typ, &ku.pole, &klic) == nil {
				if v.odmitnute[ku] == nil {
					v.odmitnute[ku] = map[string]bool{}
				}
				v.odmitnute[ku][klic] = true
			}
		}
		radky.Close()
	}
	// Zápis z oprav: nejčastější u klíče
	if radky, err := db.Query("SELECT pole, klic, zapis FROM zapisy ORDER BY pocet, zapis DESC"); err == nil {
		for radky.Next() {
			var pole, klic, zapis string
			if radky.Scan(&pole, &klic, &zapis) == nil {
				if v.zapisy[pole] == nil {
					v.zapisy[pole] = map[string]string{}
				}
				v.zapisy[pole][klic] = zapis
			}
		}
		radky.Close()
	}
	if u.statistiky == nil {
		u.statistiky = u.spocitatKalibraci()
	}
	for z, k := range u.statistiky {
		v.kalibrace[z] = *k
	}
	u.vstup, u.vstupGenerace = v, u.generace
	return v, u.generace
}

// ---------------------------------------------------------------------------------------------------------
// Prahy kontroly podle zpětné vazby
//
// U pravidla s nastavitelným prahem se z deníku spočítá, kolik jeho nálezů uživatel opravil (nález zmizel
// změnou údaje modelky, k) a kolik označil „V pořádku“ (f). Přesnost pravidla je (k + 4)/(k + f + 6),
// tedy předpoklad, že dvě třetiny nálezů jsou skutečné chyby, s vahou šesti nálezů. Klesne-li pod polovinu,
// pravidlo se zpřísní úměrně t = (0,5 − přesnost)/0,5: rozsah o až 1,5 σ, mez neobvyklé kombinace o až 0,75
// v kvantilu N(0,1), podobnost jmen o až 0,03. Prahy se jen zpřísňují (přesnost má přednost před úplností).

// Zdroj nálezu → údaje postavy, jejichž rozsah zpřísní
var rozsahyPravidel = map[string][]int{"vyska": {prVyska}, "vaha": {prVaha}, "bmi": {prBmi}, "vek": {prVek},
	"miry": {prHrudnik, prPas, prBoky}}

func (u *uceni) prahyKontroly() prahyKontroly {
	p, _ := u.prahyAGenerace()
	return p
}

// Prahy a generace deníku, ze které jsou (pod jedním zámkem)
func (u *uceni) prahyAGenerace() (prahyKontroly, int64) {
	if u == nil {
		return vychoziPrahy(), 0
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.spocitatPrahy(), u.generace
}

// Prahy kontroly z deníku (volá se se zámkem)
func (u *uceni) spocitatPrahy() prahyKontroly {
	p := vychoziPrahy()
	if u.zajistit() == nil {
		return p
	}
	if u.prahy != nil {
		return *u.prahy
	}
	stav := map[string]bool{} // poslední rozhodnutí u nálezu: true = opraveno, false = V pořádku
	zdroje := map[string]string{}
	for _, e := range u.nacistUdalosti(udalostVPoradku, udalostZnovu, udalostNalezOpraveny) {
		klic := klicNalezu(e.modelka, e.album, e.typ, e.pole) + "\x00" + e.zdroj
		switch e.druh {
		case udalostZnovu:
			delete(stav, klic)
		default:
			stav[klic] = e.druh == udalostNalezOpraveny
			zdroje[klic] = e.zdroj
		}
	}
	opraveno, planych := map[string]float64{}, map[string]float64{}
	for klic, ok := range stav {
		if ok {
			opraveno[zdroje[klic]]++
		} else {
			planych[zdroje[klic]]++
		}
	}
	zprisneni := func(zdroj string) float64 {
		presnost := (opraveno[zdroj] + 4) / (opraveno[zdroj] + planych[zdroj] + vahaPredpokladuOk)
		return max(0, (0.5-presnost)/0.5)
	}
	for zdroj, udaje := range rozsahyPravidel {
		for _, j := range udaje {
			p.kRozsahu[j] = max(p.kRozsahu[j], kRozsahu+1.5*zprisneni(zdroj))
		}
	}
	p.zKombinace += 0.75 * zprisneni("neobvykle")
	p.prahJmen = min(0.99, p.prahJmen+0.03*zprisneni("podobne-jmeno"))
	u.prahy = &p
	return p
}

// ---------------------------------------------------------------------------------------------------------
// Mezipaměť podle otisku sbírky
//
// Otisk je FNV-64a ze všech údajů, ze kterých se návrhy a nálezy počítají: modelky (všechny údaje včetně
// odvozených vydání a „netýká se“), alba (i počet fotek a součet jejich čísel, takže přidání, přesun nebo
// odebrání fotky otisk změní), dnešní datum (kontrola počítá s dneškem), verze výpočtu a generace deníku učení.
// Jakákoli změna dat nebo nové rozhodnutí tak mezipaměť zneplatní samo; jiná invalidace není potřeba.

func otiskSbirky(druh string, modelky []Modelka, alba []albumSbirky, generace int64) string {
	h := fnv.New64a()
	o := otiskovac{h: h}
	o.text(verzeModeluUceni, druh, time.Now().Format("2006-01-02"))
	o.cisla(int(generace))
	for i := range modelky {
		o.modelka(&modelky[i])
	}
	for _, al := range alba {
		o.text(al.jmeno, al.nazev, al.typ, al.vydani, al.datum, al.fotograf, al.popis, al.neni)
		o.cisla(al.modelkaID, al.fotek, al.hodnocenych, int(al.soucetFotek))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// Otisk údajů modelky, ze kterých kontrola hlásí nálezy (pro poznání, že uživatel nález opravil). Bez údajů, které
// s kontrolou nesouvisejí a mění se často (srdíčka, titulní fotka, tagy, poznámka): jejich změna spolu s nálezem,
// který zmizel z jiného důvodu (posunutý naučený rozsah), by se jinak zapsala jako oprava. Předpona je verze výpočtu.
const predponaOtiskuKontroly = "k2:"

func otiskUdajuKontroly(m Modelka) string {
	m.Hodnoceni, m.CoverID, m.CoverURL, m.Tags, m.Poznamka, m.Pridano = 0, "", "", "", "", ""
	h := fnv.New64a()
	(&otiskovac{h: h}).modelka(&m)
	return predponaOtiskuKontroly + hex.EncodeToString(h.Sum(nil))
}

// Zápis údajů do otisku bez reflexe (fmt.Sprint všech modelek byl desetkrát pomalejší)
type otiskovac struct {
	h     interface{ Write([]byte) (int, error) }
	cislo [8]byte
}

func (o *otiskovac) text(texty ...string) {
	for _, t := range texty {
		o.h.Write([]byte(t))
		o.h.Write([]byte{0})
	}
}

func (o *otiskovac) cisla(cisla ...int) {
	for _, c := range cisla {
		for i := range o.cislo {
			o.cislo[i] = byte(uint64(c) >> (8 * i))
		}
		o.h.Write(o.cislo[:])
	}
}

func (o *otiskovac) modelka(m *Modelka) {
	o.cisla(m.ID, m.VyskaCm, m.VahaKg, m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm, m.Tetovani, m.Piercing, m.hodnoceniPul(), m.PocetFotek)
	o.text(m.Jmeno, m.NarozeniDatum, m.UmrtiDatum, m.NarozeniMisto, m.Narodnost, m.Etnicita, m.VlasyBarva, m.OciBarva, m.Miry,
		m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags, m.DalsiJmena, m.Poznamka,
		m.NetykaSe, m.CyberGirl, m.CoverID, m.Pridano)
	for _, seznam := range [][]string{m.Vydani, m.Centerfoldy, m.Obalky, m.OnlineAlba} {
		o.cisla(len(seznam))
		o.text(seznam...)
	}
}

// Výsledek z mezipaměti v souboru (jen se shodným otiskem); volá se se zámkem
func (u *uceni) nacistMezipamet(druh, otisk string, cil any) bool {
	db := u.zajistit()
	if db == nil {
		return false
	}
	var data []byte
	if db.QueryRow("SELECT data FROM mezipamet WHERE druh = ? AND otisk = ?", druh, otisk).Scan(&data) != nil {
		return false
	}
	return json.Unmarshal(data, cil) == nil
}

// Uložení do mezipaměti v souboru běží na pozadí (převod na JSON a zápis by zdržely Přehled); volá se se
// zámkem, data se už nemění. Na dokončení čeká pockat (zavření programu, zapomenutí, testy).
func (u *uceni) ulozitMezipamet(druh, otisk string, data any) {
	u.ukladani.Add(1)
	go func() {
		defer u.ukladani.Done()
		obsah, err := json.Marshal(data)
		if err != nil {
			return
		}
		u.mu.Lock()
		defer u.mu.Unlock()
		db := u.zajistit()
		if db == nil {
			return
		}
		if _, err := db.Exec("INSERT OR REPLACE INTO mezipamet (druh, otisk, data, cas) VALUES (?, ?, ?, ?)", druh, otisk, obsah, ted()); err != nil {
			varovatUceni("mezipaměť se neuložila: %v", err)
		}
	}()
}

// Počká na dokončení zápisů mezipaměti na pozadí
func (u *uceni) pockat() {
	if u != nil {
		u.ukladani.Wait()
	}
}

// Zavření při ukončení programu: počká na zápisy na pozadí a databázi zavře se zámkem; volání, která přijdou
// potom (rozhraní ještě může něco poslat), už nic nezapíšou ani soubor neotevřou znovu
func (u *uceni) zavrit() {
	if u == nil {
		return
	}
	u.pockat()
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.db != nil {
		u.db.Close()
	}
	u.db, u.zavreno = nil, true
}

// Sbírka se vrátila do stavu zálohy: nálezy, které tím zmizely, uživatel neopravil. Příští kontrola je proto
// s předchozími nálezy neporovná (ani s uloženými v souboru) a začne od nového stavu.
func (u *uceni) poObnoveniSbirky() {
	if u == nil {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.nalezy = pametVysledku[ulozeneNalezy]{}
	u.bezPorovnani = true
}

// Všechny návrhy sbírky (i odmítnuté) s učením ze zpětné vazby; z mezipaměti, když se sbírka nezměnila
func (a *App) navrhySbirky(modelky []Modelka, alba []albumSbirky) []navrhSbirky {
	u := a.uc
	if u == nil {
		return navrhnout(modelky, albaProNavrhy(alba), time.Now().Year(), nil)
	}
	// Souběžné volání počká na výpočet prvního a vezme si jeho výsledek z mezipaměti
	u.vypocetNavrhu.Lock()
	defer u.vypocetNavrhu.Unlock()
	vstup, generace := u.vstupNavrhu()
	otisk := otiskSbirky("navrhy", modelky, alba, generace)
	u.mu.Lock()
	if !u.navrhy.ma || u.navrhy.otisk != otisk {
		var ulozene []navrhSbirky
		if u.nacistMezipamet("navrhy", otisk, &ulozene) {
			u.navrhy = pametVysledku[[]navrhSbirky]{otisk: otisk, data: ulozene, ma: true}
			u.zapamatovatNavrhy(ulozene)
		}
	}
	if u.navrhy.ma && u.navrhy.otisk == otisk {
		navrhy := u.navrhy.data
		u.mu.Unlock()
		return navrhy
	}
	u.mu.Unlock()

	navrhy := navrhnout(modelky, albaProNavrhy(alba), time.Now().Year(), vstup)
	u.mu.Lock()
	u.navrhy = pametVysledku[[]navrhSbirky]{otisk: otisk, data: navrhy, ma: true}
	u.zapamatovatNavrhy(navrhy)
	u.ulozitMezipamet("navrhy", otisk, navrhy)
	u.mu.Unlock()
	return navrhy
}

func (u *uceni) zapamatovatNavrhy(navrhy []navrhSbirky) {
	u.posledniNav = make(map[string]navrhSbirky, len(navrhy))
	for _, n := range navrhy {
		u.posledniNav[klicNavrhuUceni(n.ModelkaID, n.Album, n.Typ, n.Pole, n.Hodnota)] = n
	}
}

// Všechny nálezy kontroly (i označené „V pořádku“) s prahy podle zpětné vazby; z mezipaměti, když se sbírka
// nezměnila. Nález modelky, který od minula zmizel, protože uživatel změnil její údaje (a ne označením
// „V pořádku“), se zapíše do deníku jako opravený – z toho se učí prahy.
func (a *App) nalezyKontroly(modelky []Modelka, alba []albumSbirky) []PodezrelyUdaj {
	u := a.uc
	if u == nil {
		return a.spocitatNalezy(modelky, alba, vychoziPrahy())
	}
	u.vypocetNalezu.Lock()
	defer u.vypocetNalezu.Unlock()
	// Prahy a generace z jednoho okamžiku: jinak by výsledek s prahy ze starší generace dostal otisk novější
	prahy, generace := u.prahyAGenerace()
	otisk := otiskSbirky("kontrola", modelky, alba, generace)
	u.mu.Lock()
	predchozi := u.nalezy
	bezPorovnani := u.bezPorovnani
	u.bezPorovnani = false
	if !predchozi.ma && !bezPorovnani {
		// Po spuštění: poslední uložené nálezy (s jakýmkoli otiskem) jako výchozí stav pro poznání oprav
		var ulozene ulozeneNalezy
		var ulozenyOtisk string
		if db := u.zajistit(); db != nil {
			var data []byte
			if db.QueryRow("SELECT otisk, data FROM mezipamet WHERE druh = 'kontrola'").Scan(&ulozenyOtisk, &data) == nil && json.Unmarshal(data, &ulozene) == nil {
				predchozi = pametVysledku[ulozeneNalezy]{otisk: ulozenyOtisk, data: ulozene, ma: true}
				u.nalezy = predchozi
				u.zapamatovatNalezy(ulozene.Nalezy)
			}
		}
	}
	if predchozi.ma && predchozi.otisk == otisk {
		u.mu.Unlock()
		return predchozi.data.Nalezy
	}
	u.mu.Unlock()

	nalezy := a.spocitatNalezy(modelky, alba, prahy)
	ulozit := ulozeneNalezy{Nalezy: nalezy, Modelky: map[string]string{}}
	podleID := make(map[int]Modelka, len(modelky))
	for _, m := range modelky {
		podleID[m.ID] = m
	}
	for _, n := range nalezy {
		if n.Album == "" {
			ulozit.Modelky[fmt.Sprint(n.ModelkaID)] = otiskUdajuKontroly(podleID[n.ModelkaID])
		}
	}
	// Opravené nálezy: byl, už není, modelka existuje a změnila se, a nebyl označen „V pořádku“
	if predchozi.ma {
		nyni := map[string]bool{}
		for _, n := range nalezy {
			nyni[klicNalezu(n.ModelkaID, n.Album, n.Typ, n.Klic)+"\x00"+n.Zdroj] = true
		}
		for _, n := range predchozi.data.Nalezy {
			m, existuje := podleID[n.ModelkaID]
			// Otisk z dřívější verze (jiný výpočet) se s novým porovnat nedá: oprava se raději nezapíše
			drivejsi := predchozi.data.Modelky[fmt.Sprint(n.ModelkaID)]
			if n.Album != "" || n.NetykaSe || !existuje || nyni[klicNalezu(n.ModelkaID, n.Album, n.Typ, n.Klic)+"\x00"+n.Zdroj] ||
				obsahujeKlic(m.NetykaSe, n.Klic) || !strings.HasPrefix(drivejsi, predponaOtiskuKontroly) || drivejsi == otiskUdajuKontroly(m) {
				continue
			}
			u.zapsat(udalostNalezOpraveny, n.ModelkaID, "", "", n.Klic, n.Popis, "", n.Zdroj, 0, 0)
		}
	}
	u.mu.Lock()
	u.nalezy = pametVysledku[ulozeneNalezy]{otisk: otisk, data: ulozit, ma: true}
	u.zapamatovatNalezy(nalezy)
	u.ulozitMezipamet("kontrola", otisk, ulozit)
	u.mu.Unlock()
	return nalezy
}

func (u *uceni) zapamatovatNalezy(nalezy []PodezrelyUdaj) {
	u.posledniNal = make(map[string]PodezrelyUdaj, len(nalezy))
	for _, n := range nalezy {
		u.posledniNal[klicNalezu(n.ModelkaID, n.Album, n.Typ, n.Klic)] = n
	}
}

// ---------------------------------------------------------------------------------------------------------
// Přehled a zapomenutí

// Stav učení pro okno Údržby
type StavUceni struct {
	Soubor    string       `json:"soubor"`   // soubor databáze učení; prázdný = jen v paměti
	Velikost  int64        `json:"velikost"` // bajtů
	Udalosti  int          `json:"udalosti"`
	Prijato   int          `json:"prijato"`
	Odmitnuto int          `json:"odmitnuto"`
	Opraveno  int          `json:"opraveno"`
	Zdroje    []ZdrojUceni `json:"zdroje"`
	Naposledy string       `json:"naposledy"` // čas poslední události (RRRR-MM-DD HH:MM:SS), prázdný bez událostí
	// Porovnání dvojic modelek (oblibenost.go); ZapomenoutUceni je nemaže, to dělá ZapomenoutPorovnani
	Porovnani int `json:"porovnani"`
}

// Zdroj návrhů v přehledu učení
type ZdrojUceni struct {
	Zdroj     string  `json:"zdroj"`
	Popis     string  `json:"popis"`
	Navrhu    int     `json:"navrhu"` // současné neodmítnuté návrhy, které zdroj podporuje
	Prijato   int     `json:"prijato"`
	Odmitnuto int     `json:"odmitnuto"`
	Presnost  float64 `json:"presnost"` // kalibrovaná úspěšnost 0–1
	Aktivni   bool    `json:"aktivni"`  // i nejsilnější návrh zdroje ještě projde prahem
}

func (a *App) GetStavUceni() StavUceni {
	stav := StavUceni{Zdroje: []ZdrojUceni{}}
	u := a.uc
	if u == nil {
		return stav
	}
	navrhy := a.navrhySbirky(a.GetModelky(""), a.albaSbirky())
	pocty := map[string]int{}
	for _, n := range navrhy {
		if !n.Odmitnuto {
			for _, z := range n.Zdroje {
				pocty[z]++
			}
		}
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return stav
	}
	stav.Soubor = u.cesta
	if u.cesta != "" {
		if info, err := os.Stat(u.cesta); err == nil {
			stav.Velikost = info.Size()
		}
	}
	db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(druh = ?), 0), COALESCE(SUM(druh = ?), 0), COALESCE(SUM(druh = ?), 0), COALESCE(MAX(cas), '')
		FROM udalosti`, udalostPrijato, udalostOdmitnuto, udalostOpraveno).Scan(&stav.Udalosti, &stav.Prijato, &stav.Odmitnuto, &stav.Opraveno, &stav.Naposledy)
	stav.Porovnani = len(u.nacistPorovnani())
	if u.statistiky == nil {
		u.statistiky = u.spocitatKalibraci()
	}
	for _, z := range poradiZdroju {
		zn := zdrojeNavrhu[z]
		k := kalibraceZdroje{}
		if s := u.statistiky[z]; s != nil {
			k = *s
		}
		prah, strop := prahNavrhu, stropJistoty
		if zn.rodina == "odhad" {
			prah, strop = minJistotaOdhadu, stropOdhadu
		}
		stav.Zdroje = append(stav.Zdroje, ZdrojUceni{Zdroj: z, Popis: zn.popis, Navrhu: pocty[z], Prijato: k.prijatych, Odmitnuto: k.odmitnutych,
			Presnost: math.Round(k.presnost(zn.predpoklad)*1000) / 1000, Aktivni: k.upravit(strop, zn.predpoklad) >= prah})
	}
	return stav
}

// Zapomenutí naučeného: záloha databáze učení do složky záloh (uceni-….db) a její vyprázdnění. Sbírka se
// nemění (klíče „ok-…“ a „nv-…“ v ní zůstávají).
func (a *App) ZapomenoutUceni() bool {
	u := a.uc
	if u == nil {
		return false
	}
	u.pockat()
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return false
	}
	if !a.zalohovatUceni(db) {
		return false
	}
	for _, tabulka := range append(append([]string(nil), tabulkyUceni...), "mezipamet") {
		if _, err := db.Exec("DELETE FROM " + tabulka); err != nil {
			a.chyba("zapomenutí učení", err)
			return false
		}
	}
	// Čítač událostí se posune, aby otisk mezipaměti z doby před zapomenutím už nikdy neplatil
	db.Exec("UPDATE sqlite_sequence SET seq = seq + 1 WHERE name = 'udalosti'")
	db.Exec("VACUUM")
	u.nacistGeneraci()
	u.vstup, u.prahy, u.statistiky = nil, nil, nil
	u.navrhy, u.nalezy = pametVysledku[[]navrhSbirky]{}, pametVysledku[ulozeneNalezy]{}
	return true
}

// Záloha databáze učení do složky záloh (uceni-….db) před zapomenutím; volá se se zámkem. Učení jen v paměti
// se nezálohuje.
func (a *App) zalohovatUceni(db *sql.DB) bool {
	if a.uc.cesta == "" {
		return true
	}
	if err := os.MkdirAll(slozkaZaloh(), 0o700); err != nil {
		a.chyba("záloha databáze učení", err)
		return false
	}
	zaloha := filepath.Join(slozkaZaloh(), "uceni-"+time.Now().Format("2006-01-02-150405.000")+".db")
	if _, err := db.Exec("VACUUM INTO ?", zaloha); err != nil {
		a.chyba("záloha databáze učení", err)
		return false
	}
	os.Chmod(zaloha, 0o600)
	uklidZalohUceni()
	return true
}

// Ze záloh databáze učení zůstává posledních pocetZalohUceni
func uklidZalohUceni() {
	soubory, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "uceni-*.db"))
	sort.Strings(soubory)
	for len(soubory) > pocetZalohUceni {
		os.Remove(soubory[0])
		soubory = soubory[1:]
	}
}

// ---------------------------------------------------------------------------------------------------------
// Alba sbírky jedním dotazem

// Album modelky se vším, co potřebuje Přehled, kontrola i návrhy
type albumSbirky struct {
	modelkaID               int
	jmeno                   string // jméno modelky
	nazev, typ              string
	vydani, datum, fotograf string
	popis, neni             string // neni = „netýká se“ alba
	fotek, hodnocenych      int
	soucetFotek             int64 // součet čísel fotek: změní se přidáním, přesunem i odebráním fotky
}

// Alba všech modelek (i bez fotek) seřazená podle jména modelky, názvu a typu
func (a *App) albaSbirky() []albumSbirky {
	alba := []albumSbirky{}
	rows, err := a.db.Query(`
		SELECT al.modelka_id, m.jmeno, al.album, al.typ, COALESCE(al.vydani, ''), COALESCE(al.datum, ''), TRIM(COALESCE(al.fotograf, '')),
			COALESCE(al.popis, ''), COALESCE(al.netyka_se, ''), COUNT(f.id), COALESCE(SUM(COALESCE(f.hodnoceni, 0) > 0), 0), COALESCE(SUM(f.id), 0)
		FROM alba al
		JOIN modelky m ON m.id = al.modelka_id
		LEFT JOIN fotky f ON f.album_id = al.id
		GROUP BY al.id`)
	if err != nil {
		a.chyba("načtení alb", err)
		return alba
	}
	defer rows.Close()
	for rows.Next() {
		var al albumSbirky
		if rows.Scan(&al.modelkaID, &al.jmeno, &al.nazev, &al.typ, &al.vydani, &al.datum, &al.fotograf, &al.popis, &al.neni,
			&al.fotek, &al.hodnocenych, &al.soucetFotek) == nil {
			alba = append(alba, al)
		}
	}
	// Řazení v programu: COLLATE BEZDIAKRITIKY v SQL zjednodušuje jméno při každém porovnání (desítky ms)
	klice := map[int]string{}
	for _, al := range alba {
		if _, ok := klice[al.modelkaID]; !ok {
			klice[al.modelkaID] = zjednodusit(al.jmeno)
		}
	}
	sort.SliceStable(alba, func(i, j int) bool {
		x, y := alba[i], alba[j]
		if kx, ky := klice[x.modelkaID], klice[y.modelkaID]; kx != ky {
			return kx < ky
		}
		if x.modelkaID != y.modelkaID {
			return x.modelkaID < y.modelkaID
		}
		if x.nazev != y.nazev {
			return x.nazev < y.nazev
		}
		return x.typ < y.typ
	})
	return alba
}
