package main

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"math"

	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"

	"golang.org/x/text/unicode/norm"

	"modernc.org/sqlite"
)

type App struct {
	// Kopie aplikace nad spojením s transakcí importu: hromadné zápisy jdou do ní, ne do nové transakce
	vImportu bool
	// Připravené příkazy importu (viz pripraveny)
	pripravene map[string]*sql.Stmt
	ctx        context.Context
	db         *sql.DB
	// Soubor databáze; prázdný u dočasné databáze v paměti
	cestaDb string

	// Hlášení chyb do okna aplikace; v testech zůstává prázdné
	naChybu func(zprava string)
	// Chyba, kvůli které se nepodařilo otevřít databázi
	chybaStartu string
	// Databáze je otevřená jen pro čtení (poškozená nebo z novější verze)
	jenProCteni bool
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
	NarozeniDatum  string `json:"narozeniDatum"` // RRRR, RRRR-MM nebo RRRR-MM-DD
	UmrtiDatum     string `json:"umrtiDatum"`    // ve stejném tvaru; prázdné u žijící nebo neznámé
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
	Hodnoceni  int    `json:"hodnoceni"` // 0 = nehodnoceno, 1–5 srdíček

	// Kdy byla modelka přidána (RRRR-MM-DD HH:MM:SS); prázdné u záznamů starších než tento údaj
	Pridano string `json:"pridano"`

	// Údaje, které se u modelky nesledují (centerfold neměla…): klíče oddělené čárkou
	NetykaSe string `json:"netykaSe"`
	// Odkazy na zdroje údajů (Wikipedie a podobně), jeden na řádek
	Odkazy string `json:"odkazy"`
	// Vydání, na jejichž obálce modelka je (jen pro čtení)
	Obalky []string `json:"obalky"`
	// Vydání jejích centerfoldů (jen pro čtení); centerfold = kategorie Playmate měsíce
	Centerfoldy []string `json:"centerfoldy"`
	// Data nafocení jejích online alb (typ Pictorial online, jen pro čtení); album bez data má prázdný text
	OnlineAlba []string `json:"onlineAlba"`
	// Nejvyšší úroveň jejích alb Cyber Girl: „měsíce“, „týdne“ nebo "" (odvozená kategorie, jen pro čtení)
	CyberGirl string `json:"cyberGirl"`

	// Popisy a fotografové alb modelky, jen pro hledání
	textyAlb       string
	fotografoveAlb string
}

type Fotografie struct {
	ID        int    `json:"id"`
	ModelkaID int    `json:"modelkaId"`
	Album     string `json:"album"`
	Typ       string `json:"typ"` // "Centerfold", "Pictorial", "Pictorial online", "Cover"
	URL       string `json:"url"`
	Rotace    int    `json:"rotace"` // otočení při zobrazení: 0, 90, 180, 270
	// Stránky centerfoldu v albu se zobrazují spojené do jednoho plakátu
	Spojit       bool   `json:"spojit"`
	JmenoModelky string `json:"jmenoModelky"` // vyplněno jen v přehledech napříč modelkami
	// Vydání časopisu RRRR-MM, ke kterému fotka patří; u centerfoldu a coveru je to přímo album
	Vydani string `json:"vydani"`
	// Průvodní text a fotograf alba; vyplněno jen v profilu modelky a na stránce vydání
	Popis    string `json:"popis"`
	Fotograf string `json:"fotograf"`
	// Datum nafocení online alba (RRRR, RRRR-MM nebo RRRR-MM-DD); vyplněno tam, kde popis alba
	DatumAlba string `json:"datumAlba"`
	// 0 = nehodnoceno, 1–5 srdíček; lépe hodnocené fotky jsou v albu vpředu
	Hodnoceni int `json:"hodnoceni"`
	// Ručně určené pořadí v albu od 1; 0 = pořadí neurčeno (fotka je za seřazenými podle vložení)
	Poradi int `json:"poradi"`
	// Kdy byla fotka přidána (RRRR-MM-DD HH:MM:SS); prázdné u záznamů starších než tento údaj
	Pridano string `json:"pridano"`
	// Další modelky alba kromě hlavní (vyplněno v profilu a na stránce vydání)
	DalsiModelky []OdkazModelky `json:"dalsiModelky"`
	// ID souboru na Disku; adresu obrázku skládá URL ze šablony
	DriveID string `json:"driveId"`
	// Album, do kterého fotka patří
	AlbumID int64 `json:"albumId"`
}

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

// Stav „neuvedeno" se u tetování a piercingu ukládá jako NULL
func anoNeDoDatabaze(hodnota int) interface{} {
	if hodnota != 0 && hodnota != 1 {
		return nil
	}
	return hodnota
}

// Okamžik pro údaj „přidáno"; text se řadí stejně jako čas
func ted() string {
	return time.Now().Format("2006-01-02 15:04:05")
}

// Řazení v SQL stejně jako v programu: bez ohledu na velikost písmen a diakritiku (COLLATE BEZDIAKRITIKY zná jen ASCII)
func init() {
	sqlite.MustRegisterCollationUtf8("BEZDIAKRITIKY", func(a, b string) int {
		return strings.Compare(zjednodusit(a), zjednodusit(b))
	})
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
	if err := os.MkdirAll(slozkaDat(), 0o700); err != nil {
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

// Název zálohy: playboy-RRRR-MM-DD-HHMMSS.mmm-[pořadí-]důvod.db
var vzorZalohy = regexp.MustCompile(`^playboy-(\d{4}-\d{2}-\d{2})-\d{6}\.\d{3}-(?:\d+-)?(.+)\.db$`)

const (
	duvodDenni        = "denni"
	pocetDennichZaloh = 7
	pocetTydnuZaloh   = 4
)

// Záloha databáze. Bez úspěšné zálohy se nesmí pokračovat v mazání, proto se chyba nikdy nezamlčí.
func (a *App) zalohovat(duvod string) error {
	var zaznamu int
	if err := a.db.QueryRow("SELECT (SELECT COUNT(*) FROM modelky) + (SELECT COUNT(*) FROM fotografie)").Scan(&zaznamu); err != nil {
		return fmt.Errorf("nelze zjistit obsah databáze: %w", err)
	}
	// Prázdnou databázi není proč zálohovat
	if zaznamu == 0 {
		return nil
	}
	if err := os.MkdirAll(slozkaZaloh(), 0o700); err != nil {
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
		// Nedokončený soubor (plný disk) by se v seznamu záloh tvářil jako záloha
		os.Remove(cil)
		return err
	}
	os.Chmod(cil, 0o600)

	uklidZaloh()
	return nil
}

// Každý důvod zálohy má vlastní frontu, aby úklid alb nevytlačil zálohu před importem nebo smazáním databáze.
// Denních záloh zůstává posledních pocetDennichZaloh a k nim nejnovější z každého z dalších pocetTydnuZaloh týdnů.
func uklidZaloh() {
	soubory, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "playboy-*.db"))
	// Od nejnovější
	sort.Sort(sort.Reverse(sort.StringSlice(soubory)))

	podleDuvodu := map[string][]string{}
	for _, soubor := range soubory {
		duvod := ""
		if casti := vzorZalohy.FindStringSubmatch(filepath.Base(soubor)); casti != nil {
			duvod = casti[2]
		}
		podleDuvodu[duvod] = append(podleDuvodu[duvod], soubor)
	}

	for duvod, zalohy := range podleDuvodu {
		if duvod != duvodDenni {
			for _, stara := range zalohy[min(len(zalohy), pocetZaloh):] {
				os.Remove(stara)
			}
			continue
		}
		tydny := map[string]bool{}
		for i, zaloha := range zalohy {
			if i < pocetDennichZaloh {
				continue
			}
			den, _ := time.Parse("2006-01-02", vzorZalohy.FindStringSubmatch(filepath.Base(zaloha))[1])
			rok, tyden := den.ISOWeek()
			klic := fmt.Sprintf("%d-%d", rok, tyden)
			if tydny[klic] || len(tydny) >= pocetTydnuZaloh {
				os.Remove(zaloha)
				continue
			}
			tydny[klic] = true
		}
	}
}

// Jedna záloha denně při spuštění: pojistka proti chybám, které nejsou smazáním (špatné přejmenování, chybný import)
func (a *App) denniZaloha() {
	dnes := time.Now().Format("2006-01-02")
	if dnesni, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "playboy-"+dnes+"-*-"+duvodDenni+".db")); len(dnesni) > 0 {
		return
	}
	if err := a.zalohovat(duvodDenni); err != nil {
		a.chyba("denní záloha", err)
	}
}

// Složka se zálohami pro zobrazení v aplikaci
func (a *App) SlozkaZaloh() string {
	os.MkdirAll(slozkaZaloh(), 0o700)
	return slozkaZaloh()
}

type Zaloha struct {
	Soubor  string `json:"soubor"`
	Cas     string `json:"cas"`   // RRRR-MM-DD HH:MM:SS
	Duvod   string `json:"duvod"` // denni, pred-smazanim-alba, pred-importem…
	Modelek int    `json:"modelek"`
	Fotek   int    `json:"fotek"`
	// Záloha, kterou se nepodařilo přečíst; obnovit z ní nejde
	Poskozena bool `json:"poskozena"`
}

// Zálohy od nejnovější, s počty, aby šlo poznat, ke které se vrátit
func (a *App) SeznamZaloh() []Zaloha {
	soubory, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "playboy-*.db"))
	sort.Sort(sort.Reverse(sort.StringSlice(soubory)))

	zalohy := []Zaloha{}
	for _, soubor := range soubory {
		nazev := filepath.Base(soubor)
		casti := vzorZalohy.FindStringSubmatch(nazev)
		if casti == nil {
			continue
		}
		z := Zaloha{Soubor: nazev, Duvod: casti[2]}
		if cas, err := time.Parse("2006-01-02-150405", nazev[len("playboy-"):len("playboy-")+17]); err == nil {
			z.Cas = cas.Format("2006-01-02 15:04:05")
		}
		db, err := otevritZalohu(soubor)
		if err == nil {
			err = db.QueryRow("SELECT (SELECT COUNT(*) FROM modelky), (SELECT COUNT(*) FROM fotografie)").Scan(&z.Modelek, &z.Fotek)
			db.Close()
		}
		z.Poskozena = err != nil
		zalohy = append(zalohy, z)
	}
	return zalohy
}

// Spojení se zálohou jen pro čtení. Parametr mode bere SQLite jen z adresy file:, z obyčejné cesty by ho
// ovladač zahodil, spojení by bylo pro zápis a chybějící soubor by založil jako prázdnou databázi.
func otevritZalohu(soubor string) (*sql.DB, error) {
	return sql.Open("sqlite", (&url.URL{Scheme: "file", Path: soubor, RawQuery: "mode=ro"}).String())
}

// Návrat databáze do stavu zálohy. Současný stav se předtím uloží jako další záloha a heslo zůstává současné.
// Vrací text chyby, prázdný při úspěchu.
// Databáze, které program nerozumí nebo je poškozená, se otevře znovu jen pro čtení
func (a *App) prepnoutJenProCteni() {
	if ro, err := sql.Open("sqlite", "file:"+a.cestaDb+"?mode=ro&_pragma=busy_timeout(5000)"); err == nil && ro.Ping() == nil {
		a.db.Close()
		a.db = ro
		a.jenProCteni = true
		if veta := " Program běží jen pro čtení, změny se neuloží."; !strings.Contains(a.chybaStartu, veta) {
			a.chybaStartu += veta
		}
	}
}

func (a *App) ObnovitZalohu(soubor string) string {
	// Jen soubor ze složky záloh, žádná cesta zvenku
	if soubor != filepath.Base(soubor) || !vzorZalohy.MatchString(soubor) {
		return "Neplatný název zálohy."
	}
	zaloha := filepath.Join(slozkaZaloh(), soubor)
	cil := filepath.Join(slozkaDat(), "playboy.db")
	// Záloha mohla mezitím zmizet (úklid záloh po jiné záloze); prázdný soubor by obnovil prázdnou sbírku
	if info, err := os.Stat(zaloha); err != nil || !info.Mode().IsRegular() || info.Size() == 0 {
		return "Záloha už neexistuje, databáze zůstala beze změny."
	}

	overeni, err := otevritZalohu(zaloha)
	if err != nil {
		return fmt.Sprintf("Zálohu se nepodařilo otevřít: %v", err)
	}
	stav := kontrolaSouboru(overeni)
	overeni.Close()
	if stav != "" {
		return fmt.Sprintf("Záloha je poškozená (%s), databáze zůstala beze změny.", stav)
	}

	// Obnovovaná záloha se nejdřív zkopíruje stranou: záloha současného stavu spouští úklid záloh,
	// který by mohl smazat právě ji (nejstarší v plném počtu)
	docasna := filepath.Join(slozkaDat(), "obnovovana.db.tmp")
	if err := kopirovatSoubor(zaloha, docasna); err != nil {
		return fmt.Sprintf("Zálohu se nepodařilo připravit, databáze zůstala beze změny: %v", err)
	}
	defer os.Remove(docasna)
	zaloha = docasna
	if err := a.zalohovat("pred-obnovenim"); err != nil {
		return fmt.Sprintf("Současný stav se nepodařilo zazálohovat, obnovení se neprovedlo: %v", err)
	}
	heslo := a.nastaveni("heslo")
	sablona := a.nastaveni("sablona_obrazku")

	// Ve WAL patří k souboru i deník změn (playboy.db-wal), který obnovená databáze nesmí převzít. Staré spojení
	// se proto před výměnou zavře a deník se přenese do souboru zvláštním spojením pro zápis (spojení jen pro
	// čtení to neumí). Když to nejde (deník drží běžící import) nebo deník zůstane, obnovení se neprovede
	// a databáze se otevře znovu tak, jak byla, včetně režimu jen pro čtení. Výměna souboru je pak
	// přejmenováním, takže proběhne celá, nebo vůbec.
	byloJenProCteni := a.jenProCteni
	puvodniChyba := a.chybaStartu
	vratitPuvodni := func(zprava string) string {
		a.chybaStartu = puvodniChyba
		if err := a.otevritDatabazi(cil); err != nil {
			return zprava + fmt.Sprintf(" Databázi se nepodařilo znovu otevřít (%v), restartuj program.", err)
		}
		if byloJenProCteni {
			a.prepnoutJenProCteni()
		}
		return zprava
	}
	a.db.Close()
	if zapis, err := sql.Open("sqlite", cil+dsnDatabaze); err == nil {
		var zaneprazdneno, stranek, preneseno int
		err = zapis.QueryRow("PRAGMA wal_checkpoint(TRUNCATE)").Scan(&zaneprazdneno, &stranek, &preneseno)
		zapis.Close()
		// Chyba přenosu sama obnovení nebrání (poškozená databáze se právě obnovuje), rozhoduje zbytek deníku níže
		if err == nil && zaneprazdneno != 0 {
			return vratitPuvodni("Databázi teď nejde uzavřít (běží import?), zůstala beze změny. Zkus to za chvíli znovu.")
		}
	}
	if info, err := os.Stat(cil + "-wal"); err == nil && info.Size() > 0 {
		return vratitPuvodni("Databázi se nepodařilo uzavřít pro obnovení, zůstala beze změny. Zkus to znovu.")
	}
	os.Remove(cil + "-wal")
	os.Remove(cil + "-shm")
	if err := kopirovatSoubor(zaloha, cil); err != nil {
		return vratitPuvodni(fmt.Sprintf("Zálohu se nepodařilo zkopírovat, databáze zůstala beze změny: %v", err))
	}
	// Obnovená databáze začíná bez chyby a bez režimu jen pro čtení; kontrola souboru a úpravy schématu níže
	// je případně nastaví znovu
	a.chybaStartu = ""
	a.jenProCteni = false
	if err := a.otevritDatabazi(cil); err != nil {
		return fmt.Sprintf("Databázi se po obnovení nepodařilo otevřít: %v. Záloha stavu před obnovením je ve složce %s.", err, slozkaZaloh())
	}
	if a.chybaStartu != "" {
		a.prepnoutJenProCteni()
		return a.chybaStartu
	}
	// Starší záloha může mít starší schéma
	if err := a.migrovat(); err != nil {
		// Do schématu, které se nepodařilo upravit, se nezapisuje
		a.chybaStartu = fmt.Sprintf("Obnovenou databázi se nepodařilo připravit (%v). Záloha stavu před obnovením je ve složce %s.", err, slozkaZaloh())
		a.prepnoutJenProCteni()
		return a.chybaStartu
	}
	a.zapnoutWAL()
	if err := a.ulozitNastaveni("heslo", heslo); err != nil {
		return fmt.Sprintf("Databáze je obnovená, ale nepodařilo se zachovat současné heslo: %v", err)
	}
	// Adresa obrázků zůstává současná jako heslo
	a.ulozitNastaveni("sablona_obrazku", sablona)
	sablonaObrazku.Store(sablona)
	return ""
}

// Adresa obrázku na Disku: šablona s {id} a {velikost} (velikost doplní rozhraní, např. w600 nebo s0).
// Je na jednom místě a jde změnit v nastavení, kdyby Google adresu náhledů změnil.
const vychoziSablonaObrazku = "https://lh3.googleusercontent.com/d/{id}={velikost}"

var sablonaObrazku atomic.Value

func adresaObrazku(driveID string) string {
	sablona, _ := sablonaObrazku.Load().(string)
	if sablona == "" {
		sablona = vychoziSablonaObrazku
	}
	return strings.ReplaceAll(sablona, "{id}", driveID)
}

func (a *App) GetSablonaObrazku() string {
	return adresaObrazku("{id}")
}

// Nová šablona adresy obrázků; musí obsahovat {id}, prázdná vrací výchozí. Před uložením se ověří na jedné fotce
// ze sbírky, která byla naposledy dostupná, aby chybná šablona neoznačila celou sbírku jako nedostupnou.
// Vrací text chyby, prázdný při úspěchu.
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

// Klíče „netýká se": u modelky titulni, zakladni, vzhled, zarazeni, centerfold, hodnoceni; u alba text, vydani
func prepnoutKlic(seznam, klic string, pridat bool) string {
	var klice []string
	for _, k := range strings.Split(seznam, ",") {
		if k = strings.TrimSpace(k); k != "" && k != klic {
			klice = append(klice, k)
		}
	}
	if pridat {
		klice = append(klice, klic)
	}
	sort.Strings(klice)
	return strings.Join(klice, ",")
}

func obsahujeKlic(seznam, klic string) bool {
	for _, k := range strings.Split(seznam, ",") {
		if strings.TrimSpace(k) == klic {
			return true
		}
	}
	return false
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
	}
	return err == nil
}

func (a *App) SetNetykaSeAlba(modelkaID int, album, typ, klic string, netyka bool) bool {
	if !klicNetykaSeAlba[klic] && !kliceKontrolyAlba[klic] && !kliceNavrhuAlba[klic] {
		return false
	}
	id, err := zajistitAlbum(a.db, modelkaID, album, typ)
	if err == nil {
		var seznam string
		a.db.QueryRow("SELECT COALESCE(netyka_se, '') FROM alba WHERE id = ?", id).Scan(&seznam)
		_, err = a.db.Exec("UPDATE alba SET netyka_se = NULLIF(?, '') WHERE id = ?", prepnoutKlic(seznam, klic, netyka), id)
	}
	if err != nil {
		a.chyba("označení „netýká se“ u alba", err)
	}
	return err == nil
}

// Kalendář: jeden řádek na vydání, co k němu je a jeden náhled; místo každé fotky přiřazené k vydání
type VydaniKalendare struct {
	Vydani     string `json:"vydani"`
	Cover      bool   `json:"cover"`
	Centerfold bool   `json:"centerfold"`
	Pictorial  bool   `json:"pictorial"`
	Nahled     string `json:"nahled"`  // adresa obrázku: cover, jinak centerfold, jinak pictorial
	Modelka    string `json:"modelka"` // jméno modelky z centerfoldu
}

func (a *App) GetKalendar() []VydaniKalendare {
	// Jedním průchodem alby (s první fotkou každého): co ke kterému vydání je a jeden náhled (cover, jinak
	// centerfold, jinak pictorial). Album bez fotek se nepočítá. Po albech místo po fotkách je to desetkrát
	// méně řádků; pořadí podle první fotky dá stejný náhled i modelku jako průchod všemi fotkami.
	vysledek := []VydaniKalendare{}
	rows, err := a.db.Query(`
		SELECT al.vydani, al.typ, f.drive_file_id, COALESCE(m.jmeno, '')
		FROM alba al
		JOIN fotky f ON f.id = (SELECT MIN(id) FROM fotky WHERE album_id = al.id)
		LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE al.vydani <> '' ORDER BY al.vydani, f.id`)
	if err != nil {
		a.chyba("načtení kalendáře", err)
		return vysledek
	}
	defer rows.Close()
	priorita := map[string]int{"Cover": 0, "Centerfold": 1}
	var v *VydaniKalendare
	nejlepsiNahled := 3
	for rows.Next() {
		var vydani, typ, driveID, jmeno string
		if rows.Scan(&vydani, &typ, &driveID, &jmeno) != nil {
			continue
		}
		if v == nil || v.Vydani != vydani {
			vysledek = append(vysledek, VydaniKalendare{Vydani: vydani})
			v = &vysledek[len(vysledek)-1]
			nejlepsiNahled = 3
		}
		poradi, zname := priorita[typ]
		if !zname {
			poradi = 2
		}
		switch typ {
		case "Cover":
			v.Cover = true
		case "Centerfold":
			v.Centerfold = true
			if v.Modelka == "" {
				v.Modelka = jmeno
			}
		default:
			v.Pictorial = true
		}
		if poradi < nejlepsiNahled {
			nejlepsiNahled = poradi
			v.Nahled = adresaObrazku(driveID)
		}
	}
	return vysledek
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	cesta, err := pripravitDatabazi()
	if err == nil {
		err = a.otevritDatabazi(cesta)
	}
	if err != nil {
		// Bez databáze aplikace poběží nad prázdnou dočasnou, aby šla aspoň otevřít a chybu ukázat
		a.chybaStartu = fmt.Sprintf("Databázi se nepodařilo otevřít (%v). Aplikace běží s prázdnou dočasnou databází, změny se neuloží.", err)
		fmt.Println(a.chybaStartu)
		a.db, _ = sql.Open("sqlite", ":memory:")
		a.db.SetMaxOpenConns(1)
	}

	// Poškozená databáze se neupravuje; databáze z novější verze se upravit nedá
	if a.chybaStartu == "" {
		if err := a.migrovat(); err != nil {
			a.chybaStartu = fmt.Sprintf("Databázi se nepodařilo připravit (%v). Záloha před úpravou je ve složce %s.", err, slozkaZaloh())
		}
	}
	// S chybou běží program jen pro čtení, aby nezapisoval do databáze, které nerozumí nebo která je poškozená
	if a.chybaStartu != "" && a.cestaDb != "" {
		a.prepnoutJenProCteni()
		fmt.Println(a.chybaStartu)
	}

	sablonaObrazku.Store(a.nastaveni("sablona_obrazku"))

	// Až po migracích a jen nad databází, která se otevřela v pořádku
	if a.chybaStartu == "" && a.cestaDb != "" {
		a.zapnoutWAL()
	}
	if a.chybaStartu == "" {
		a.denniZaloha()
	}
}

// Parametry spojení se souborem databáze (okno i import). synchronous NORMAL je bezpečné jen ve WAL;
// když WAL zapnout nejde, databáze se otevře znovu s dsnBezWAL (výchozí FULL).
const dsnBezWAL = "?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)"
const dsnDatabaze = dsnBezWAL + "&_pragma=synchronous(NORMAL)"

// Režim WAL: změny se připisují do deníku vedle databáze (playboy.db-wal) a do souboru se přenesou najednou,
// takže zápis nečeká na disk a čtení s zápisem se neblokují. Režim si pamatuje soubor; zapíná se až nad
// databází, která prošla kontrolou a úpravami schématu (poškozená nebo novější se nemění).
func (a *App) zapnoutWAL() {
	var rezim string
	if err := a.db.QueryRow("PRAGMA journal_mode = WAL").Scan(&rezim); err != nil || rezim != "wal" {
		fmt.Printf("Režim WAL se nepodařilo zapnout (%s, %v), databáze běží v původním režimu\n", rezim, err)
		if db, err := sql.Open("sqlite", a.cestaDb+dsnBezWAL); err == nil && db.Ping() == nil {
			a.db.Close()
			a.db = db
		}
	}
}

// Otevření souboru databáze; volá se při startu a znovu po obnovení ze zálohy
func (a *App) otevritDatabazi(cesta string) error {
	// Souběžná volání z rozhraní na sebe chvíli počkají, místo aby hned selhala na zamčené databázi.
	// synchronous NORMAL: ve WAL se při potvrzení nečeká na disk, uložená data přežijí i pád programu.
	db, err := sql.Open("sqlite", cesta+dsnDatabaze)
	if err == nil {
		err = db.Ping()
	}
	if err != nil {
		return err
	}
	a.db = db
	a.cestaDb = cesta
	// Data jsou jen pro vlastníka účtu
	os.Chmod(slozkaDat(), 0o700)
	os.Chmod(cesta, 0o600)
	// Poškozený soubor by se jinak ukázal jako prázdná sbírka bez jakékoli hlášky
	if stav := kontrolaSouboru(a.db); stav != "" {
		a.chybaStartu = fmt.Sprintf("Soubor databáze je poškozený (%s). Nic neupravuj a obnov poslední zálohu.", stav)
		fmt.Println(a.chybaStartu)
	}
	return nil
}

// Od tohoto čísla schématu databáze drží cizí klíče
const schemaSCizimiKlici = 6

// Po úpravě schématu nesmí zůstat řádek odkazující na neexistující záznam
func kontrolaCizichKlicu(db dotazovac) error {
	var tabulka string
	var radek, rodic interface{}
	var fk int
	if err := db.QueryRow("PRAGMA foreign_key_check").Scan(&tabulka, &radek, &rodic, &fk); err == nil {
		return fmt.Errorf("tabulka %s odkazuje na neexistující záznam v %v", tabulka, rodic)
	}
	return nil
}

// Rychlá kontrola celistvosti; prázdný text znamená, že je soubor v pořádku
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

// Úpravy schématu jdou za sebou a databáze si v user_version pamatuje, kolik jich už má za sebou.
// Nová úprava se přidává na konec seznamu; hotové se nemění.
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

	// Před první čekající úpravou záloha; nová prázdná databáze ještě tabulky nemá a zálohovat není co
	if a.maSloupec("modelky", "id") && a.maSloupec("fotografie", "id") {
		if err := a.zalohovat("pred-migraci"); err != nil {
			return fmt.Errorf("záloha před úpravou schématu selhala: %w", err)
		}
	}
	// Každá úprava běží v transakci spolu se zápisem čísla schématu: buď proběhne celá, nebo vůbec.
	// Všechny příkazy jdou přes jedno spojení, aby transakce platila pro celou úpravu; přestavba tabulek
	// potřebuje vypnuté cizí klíče, a to jde jen mimo transakci.
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
		// Cizí klíče platí od úpravy č. 6; starší schémata vedla cover pod modelkou 0
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

// Úprava č. 1: schéma, jak vznikalo do zavedení číslování. Každý krok si sám zjistí, zda je potřeba,
// takže projde nad jakkoli starou databází.
// Sloupce modelky, jak je zakládala úprava č. 1; zmrazené, další sloupce přidávají až pozdější úpravy
var sloupceModelkySchema1 = [][2]string{
	{"narozeni_datum", "TEXT"}, {"narozeni_misto", "TEXT"}, {"narodnost", "TEXT"}, {"etnicita", "TEXT"},
	{"vyska_cm", "INTEGER"}, {"vaha_kg", "INTEGER"}, {"vlasy_barva", "TEXT"}, {"oci_barva", "TEXT"}, {"miry", "TEXT"},
	{"obvod_hrudnik_cm", "INTEGER"}, {"obvod_pas_cm", "INTEGER"}, {"obvod_boky_cm", "INTEGER"}, {"velikost_prsou", "TEXT"},
	{"prsa_typ", "TEXT"}, {"ochlupeni", "TEXT"}, {"tetovani", "INTEGER"}, {"piercing", "INTEGER"}, {"vystoupeni", "TEXT"},
	{"pictorial_vydani", "TEXT"}, {"role", "TEXT"}, {"tags", "TEXT"}, {"dalsi_jmena", "TEXT"}, {"poznamka", "TEXT"},
	{"drive_cover_id", "TEXT"},
}

func (a *App) migraceZaklad() error {
	// Tabulka modelek
	if _, err := a.db.Exec(`
	CREATE TABLE IF NOT EXISTS modelky (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		jmeno TEXT NOT NULL
	);`); err != nil {
		return err
	}

	// Migrace starší verze tabulky, kde se sloupec jmenoval drive_file_id
	if !a.maSloupec("modelky", "drive_cover_id") && a.maSloupec("modelky", "drive_file_id") {
		if _, err := a.db.Exec(`ALTER TABLE modelky RENAME COLUMN drive_file_id TO drive_cover_id`); err != nil {
			return err
		}
	}

	// Doplnění sloupců, které v tabulce ještě nejsou
	for _, s := range sloupceModelkySchema1 {
		if a.maSloupec("modelky", s[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE modelky ADD COLUMN %s %s`, s[0], s[1])); err != nil {
			return err
		}
	}

	// Datum přidání se zapisuje při vložení; starší záznamy ho nemají a zpětně zjistit nejde
	if !a.maSloupec("modelky", "pridano") {
		if _, err := a.db.Exec(`ALTER TABLE modelky ADD COLUMN pridano TEXT`); err != nil {
			return err
		}
	}

	if !a.maSloupec("modelky", "hodnoceni") {
		if _, err := a.db.Exec(`ALTER TABLE modelky ADD COLUMN hodnoceni INTEGER`); err != nil {
			return err
		}
		// Starší verze znala jen ano/ne: oblíbená modelka dostane plné hodnocení
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

	for _, sloupec := range [][2]string{{"rotace", "INTEGER"}, {"spojit", "INTEGER"}, {"vydani", "TEXT"}, {"hodnoceni", "INTEGER"}, {"poradi", "INTEGER"}, {"pridano", "TEXT"}} {
		if a.maSloupec("fotografie", sloupec[0]) {
			continue
		}
		if _, err := a.db.Exec(fmt.Sprintf(`ALTER TABLE fotografie ADD COLUMN %s %s`, sloupec[0], sloupec[1])); err != nil {
			return err
		}
	}

	// Nastavení programu (zatím jen otisk hesla)
	a.db.Exec(`CREATE TABLE IF NOT EXISTS nastaveni (klic TEXT PRIMARY KEY, hodnota TEXT);`)

	// Údaje alba jako celku; album je určeno modelkou, názvem a typem stejně jako u fotek
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

// Úprava č. 2: index pro hledání fotek alba a jedinečnost souboru v albu
// Běží v transakci, kterou kolem každé úpravy otevírá migrovat
func (a *App) migraceIndexy() error {
	kroky := []string{
		// Cover časopisu má modelku 0; NULL ze starších verzí by index i porovnávání obcházel
		`UPDATE fotografie SET modelka_id = 0 WHERE modelka_id IS NULL`,
		// Tentýž soubor dvakrát v jednom albu (dvojí odeslání formuláře): zůstává dříve vložený
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

// Zavření databáze při ukončení programu
func (a *App) shutdown() {
	if a.db != nil {
		a.db.Close()
	}
}

var vzorHolehoID = regexp.MustCompile(`^[a-zA-Z0-9_-]{25,}$`)

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

	// Holá ID (i mezi odkazy), oddělená mezerami či řádky; slovo s / nebo : (odkaz) vzoru ID nevyhoví
	for _, slovo := range strings.Fields(rawInput) {
		if vzorHolehoID.MatchString(slovo) && !seen[slovo] {
			seen[slovo] = true
			ids = append(ids, slovo)
		}
	}

	return ids
}

func (a *App) GetModelky(vyhledavani string) []Modelka {
	modelky, err := a.nactiModelky(vyhledavani)
	if err != nil {
		a.chyba("načtení modelek", err)
	}
	return modelky
}

// Vrací, co se přečíst podařilo, a první chybu; export podle ní pozná, že seznam není úplný
func (a *App) nactiModelky(vyhledavani string) ([]Modelka, error) {
	var prvniChyba error
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

	vyber = append(vyber, "COALESCE(hodnoceni, 0)", "COALESCE(pridano, '')", "COALESCE(netyka_se, '')")

	// Počet fotek: vlastní a ze sdílených alb, dvěma souhrnnými dotazy (poddotaz pro každou modelku byl kvadratický)
	pocetFotek := map[int]int{}
	for _, dotaz := range []string{
		"SELECT al.modelka_id, COUNT(*) FROM fotky f JOIN alba al ON al.id = f.album_id WHERE al.modelka_id IS NOT NULL GROUP BY al.modelka_id",
		`SELECT am.modelka_id, COUNT(*) FROM alba_modelky am JOIN fotky f ON f.album_id = am.album_id GROUP BY am.modelka_id`,
	} {
		radky, err := a.db.Query(dotaz)
		if err != nil {
			return nil, err
		}
		for radky.Next() {
			var id, pocet int
			if radky.Scan(&id, &pocet) == nil {
				pocetFotek[id] += pocet
			}
		}
		radky.Close()
	}

	// Vydání každé modelky odvozená z jejích alb s fotkami (vlastních i sdílených)
	vydaniModelek := map[int][]string{}
	if radky, err := a.db.Query(`SELECT modelka_id, vydani FROM alba al WHERE modelka_id IS NOT NULL AND vydani <> ''
			AND EXISTS (SELECT 1 FROM fotky WHERE album_id = al.id)
		UNION SELECT am.modelka_id, al.vydani FROM alba al JOIN alba_modelky am ON am.album_id = al.id
			WHERE al.vydani <> '' AND EXISTS (SELECT 1 FROM fotky WHERE album_id = al.id)
		ORDER BY 2`); err == nil {
		for radky.Next() {
			var id int
			var v string
			if radky.Scan(&id, &v) == nil {
				vydaniModelek[id] = append(vydaniModelek[id], v)
			}
		}
		radky.Close()
	}

	// Centerfoldy modelek s fotkami (vlastní i sdílené); jen vydání, pro odvozenou kategorii Playmate měsíce
	centerfoldyModelek := map[int][]string{}
	if radky, err := a.db.Query(`SELECT modelka_id, COALESCE(NULLIF(vydani, ''), album) FROM alba al WHERE modelka_id IS NOT NULL
			AND typ = 'Centerfold' AND EXISTS (SELECT 1 FROM fotky WHERE album_id = al.id)
		UNION SELECT am.modelka_id, COALESCE(NULLIF(al.vydani, ''), al.album) FROM alba al JOIN alba_modelky am ON am.album_id = al.id
			WHERE al.typ = 'Centerfold' AND EXISTS (SELECT 1 FROM fotky WHERE album_id = al.id)
		ORDER BY 2`); err == nil {
		for radky.Next() {
			var id int
			var v string
			if radky.Scan(&id, &v) == nil {
				centerfoldyModelek[id] = append(centerfoldyModelek[id], v)
			}
		}
		radky.Close()
	}

	// Online alba modelek s fotkami (vlastní i sdílená): data nafocení pro výskyt „jen online“ a hledání nafoceno:
	onlineAlbaModelek := map[int][]string{}
	cyberGirl := map[int]string{}
	if radky, err := a.db.Query(`SELECT modelka_id, COALESCE(datum, ''), typ FROM alba al WHERE modelka_id IS NOT NULL
			AND typ IN (?1, ?2, ?3) AND EXISTS (SELECT 1 FROM fotky WHERE album_id = al.id)
		UNION ALL SELECT am.modelka_id, COALESCE(al.datum, ''), al.typ FROM alba al JOIN alba_modelky am ON am.album_id = al.id
			WHERE al.typ IN (?1, ?2, ?3) AND EXISTS (SELECT 1 FROM fotky WHERE album_id = al.id)
		ORDER BY 2`, typOnline, typCGTydne, typCGMesice); err == nil {
		for radky.Next() {
			var id int
			var d, typ string
			if radky.Scan(&id, &d, &typ) == nil {
				onlineAlbaModelek[id] = append(onlineAlbaModelek[id], d)
				if typ == typCGMesice {
					cyberGirl[id] = "měsíce"
				} else if typ == typCGTydne && cyberGirl[id] == "" {
					cyberGirl[id] = "týdne"
				}
			}
		}
		radky.Close()
	}

	// Popisy alb se prohledávají spolu s údaji modelky
	textyAlb := map[int]string{}
	fotografoveAlb := map[int]string{}
	// Modelky z obálek vydání
	obalky := map[int][]string{}
	if radky, err := a.db.Query("SELECT modelka_obalky, vydani FROM vydani WHERE modelka_obalky IS NOT NULL ORDER BY vydani"); err == nil {
		for radky.Next() {
			var id int
			var v string
			if radky.Scan(&id, &v) == nil {
				obalky[id] = append(obalky[id], v)
			}
		}
		radky.Close()
	}
	if radky, err := a.db.Query("SELECT modelka_id, COALESCE(popis, ''), COALESCE(fotograf, '') FROM alba UNION ALL SELECT am.modelka_id, COALESCE(al.popis, ''), COALESCE(al.fotograf, '') FROM alba_modelky am JOIN alba al ON al.id = am.album_id"); err == nil {
		for radky.Next() {
			var id int
			var popis, fotograf string
			if radky.Scan(&id, &popis, &fotograf) == nil {
				textyAlb[id] += popis + "\n" + fotograf + "\n"
				fotografoveAlb[id] += fotograf + "\n"
			}
		}
		radky.Close()
	}

	query := "SELECT " + strings.Join(vyber, ", ") + " FROM modelky"

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vysledky []Modelka
	for rows.Next() {
		var m Modelka
		var driveID string
		err := rows.Scan(&m.ID, &m.Jmeno,
			&m.NarozeniDatum, &m.UmrtiDatum, &m.NarozeniMisto, &m.Narodnost, &m.Etnicita,
			&m.VyskaCm, &m.VahaKg, &m.VlasyBarva, &m.OciBarva,
			&m.Miry, &m.ObvodHrudnikCm, &m.ObvodPasCm, &m.ObvodBokyCm,
			&m.VelikostPrsou, &m.PrsaTyp, &m.Ochlupeni, &m.Tetovani, &m.Piercing,
			&m.Vystoupeni, &m.PictorialVydani, &m.Role, &m.Tags, &m.DalsiJmena, &m.Poznamka, &m.Odkazy, &driveID,
			&m.CoverZoom, &m.CoverX, &m.CoverY, &m.Hodnoceni, &m.Pridano, &m.NetykaSe)
		if err != nil {
			if prvniChyba == nil {
				prvniChyba = err
			}
			continue
		}

		ids := parseDriveIDs(driveID)
		if len(ids) > 0 {
			m.CoverID = ids[0]
			m.CoverURL = adresaObrazku(ids[0])
		}
		m.PocetFotek = pocetFotek[m.ID]
		m.textyAlb = textyAlb[m.ID]
		m.Obalky = obalky[m.ID]
		if m.Obalky == nil {
			m.Obalky = []string{}
		}
		m.fotografoveAlb = fotografoveAlb[m.ID]
		m.Vydani = vydaniModelek[m.ID]
		if m.Vydani == nil {
			m.Vydani = []string{}
		}
		m.Centerfoldy = centerfoldyModelek[m.ID]
		if m.Centerfoldy == nil {
			m.Centerfoldy = []string{}
		}
		m.OnlineAlba = onlineAlbaModelek[m.ID]
		if m.OnlineAlba == nil {
			m.OnlineAlba = []string{}
		}
		m.CyberGirl = cyberGirl[m.ID]
		if odpovidaHledani(m, vyhledavani) {
			vysledky = append(vysledky, m)
		}
	}

	// Řazení podle jména bez ohledu na velikost písmen a diakritiku; klíč se spočítá pro každou modelku jednou
	klice := make(map[int]string, len(vysledky))
	for _, m := range vysledky {
		klice[m.ID] = zjednodusit(m.Jmeno)
	}
	sort.SliceStable(vysledky, func(i, j int) bool {
		return klice[vysledky[i].ID] < klice[vysledky[j].ID]
	})
	if err := rows.Err(); err != nil && prvniChyba == nil {
		prvniChyba = err
	}
	return vysledky, prvniChyba
}

// Písmena, která se na základní tvar nerozkládají sama
var zvlastniPismena = strings.NewReplacer("ł", "l", "ø", "o", "đ", "d", "ß", "ss", "æ", "ae", "œ", "oe", "þ", "th", "ı", "i")

// Text pro porovnávání a řazení: malá písmena bez diakritiky jakéhokoli jazyka (Zoë = zoe, Ödegaard = odegaard)
func zjednodusit(text string) string {
	rozlozeny := norm.NFD.String(strings.ToLower(text))
	bez := strings.Map(func(znak rune) rune {
		if unicode.Is(unicode.Mn, znak) {
			return -1
		}
		return znak
	}, rozlozeny)
	return zvlastniPismena.Replace(bez)
}

// Pole pro cílené hledání („vlasy:blond", „fotograf:\"arny freytag\"", „rok:1975"); hodnota se hledá jen v daném údaji
func poleHledani(m Modelka) map[string]string {
	roky, edice := []string{}, []string{}
	for _, v := range m.Vydani {
		if len(v) < 4 {
			continue
		}
		roky = append(roky, v[:4])
		if len(v) > 4 && v[len(v)-3] == '-' && v[len(v)-2] >= 'A' {
			edice = append(edice, v[len(v)-2:])
		} else {
			edice = append(edice, "US")
		}
	}
	// Celé datum: narozena:1955-03 najde i měsíc (rok porovnává číselné hledání z NarozeniDatum)
	narozena := m.NarozeniDatum
	vyska := ""
	if m.VyskaCm > 0 {
		vyska = fmt.Sprintf("%d", m.VyskaCm)
	}
	vaha := ""
	if m.VahaKg > 0 {
		vaha = fmt.Sprintf("%d", m.VahaKg)
	}
	hodnoceni := ""
	if m.Hodnoceni > 0 {
		hodnoceni = fmt.Sprintf("%d", m.Hodnoceni)
	}
	tetovani := ""
	if m.Tetovani == 1 {
		tetovani = "ano yes"
	} else if m.Tetovani == 0 {
		tetovani = "ne no"
	}
	piercing := ""
	if m.Piercing == 1 {
		piercing = "ano yes"
	} else if m.Piercing == 0 {
		piercing = "ne no"
	}
	obalky := strings.Join(m.Obalky, " ")
	// Kategorie: zapsané v poli role a odvozené z centerfoldu, alba Cyber Girl týdne či měsíce a obálky
	// (frontend/src/lib/format.js, KATEGORIE a odvozeneKategorie); obyčejné online album kategorii nedává
	kategorie := m.Role
	if len(m.Centerfoldy) > 0 {
		kategorie += ", Playmate měsíce"
	}
	if m.CyberGirl != "" {
		kategorie += ", Cyber Girl " + m.CyberGirl
	}
	if len(m.Obalky) > 0 {
		kategorie += ", Modelka obálky"
	}
	// Výskyt: v časopise (číslo s měsícem nebo speciál), jen online (online kategorie nebo online album),
	// jinak neurčeno (frontend/src/lib/format.js, vyskytModelky)
	vyskyt := "neurceno neurčeno"
	cisla := append(append(append([]string{}, m.Vydani...), m.Obalky...), m.Centerfoldy...)
	for _, v := range cisla {
		if vzorVydani.MatchString(v) {
			vyskyt = "casopis časopis"
			break
		}
	}
	if vyskyt != "casopis časopis" && (vzorOnlineKategorie.MatchString(m.Role) || len(m.OnlineAlba) > 0) {
		vyskyt = "online"
	}
	return map[string]string{
		"jmeno": m.Jmeno + "\n" + m.DalsiJmena, "vlasy": m.VlasyBarva, "oci": m.OciBarva, "narodnost": m.Narodnost,
		"etnicita": m.Etnicita, "misto": m.NarozeniMisto, "tag": m.Tags, "tagy": m.Tags, "role": kategorie, "kategorie": kategorie, "vyskyt": vyskyt,
		"fotograf": m.fotografoveAlb, "rok": strings.Join(roky, " "), "vydani": strings.Join(m.Vydani, " "),
		"narozena": narozena, "edice": strings.Join(edice, " "), "prsa": m.VelikostPrsou + " " + m.PrsaTyp,
		"ochlupeni": m.Ochlupeni, "poznamka": m.Poznamka, "vyska": vyska, "vaha": vaha,
		"miry": m.Miry, "hodnoceni": hodnoceni, "srdicka": hodnoceni, "tetovani": tetovani,
		"piercing": piercing, "obalka": obalky, "obalky": obalky, "umrti": m.UmrtiDatum, "zemrela": m.UmrtiDatum,
		"nafoceno": strings.Join(m.OnlineAlba, " "),
	}
}

// Online kategorie (KATEGORIE s online: true ve frontend/src/lib/format.js), i anglicky
var vzorOnlineKategorie = regexp.MustCompile(`(?i)cyber|coed|\bmuses?\b|creator|tvůrkyně|online|playboy ?plus|playboy\.?com`)

// Slova hledání: volitelná negace (- nebo !), cílené pole:hodnota (i s mezerou za dvojtečkou) i pole:"více slov", uvozovky i obyčejná slova
var vzorSlovaHledani = regexp.MustCompile(`(-|!)?([\p{L}]+):\s*"([^"]*)"|(-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+|[^\s",:]+(?:\s*,\s*[^\s",:]+)*)?|(-|!)?"([^"]*)"|(\S+)`)
var vzorRozsahCisel = regexp.MustCompile(`^(\d+)\s*-\s*(\d+)$`)

// Rozpoznání numerického filtru: op (">=", "<=", ">", "<", "=", ".."), numOd, numDo
// Rozsah roků v cíleném hledání (rok:1970-1979, narozena:1980..1989) a rok s měsícem (rok:1975-01)
var (
	vzorRozsahRoku      = regexp.MustCompile(`^\s*\d{4}\s*(-|\.\.)\s*\d{4}\s*$`)
	vzorRokMesicHledani = regexp.MustCompile(`^\s*\d{4}-(0[1-9]|1[0-2]|S\d{2})(-[A-Z]{2})?\s*$`)
)

func parsovatNumerickyFiltr(hodnota string) (op string, numOd, numDo int, ok bool) {
	h := strings.TrimSpace(hodnota)
	if strings.HasPrefix(h, ">=") {
		if n, err := strconv.Atoi(strings.TrimSpace(h[2:])); err == nil {
			return ">=", n, 0, true
		}
	}
	if strings.HasPrefix(h, "<=") {
		if n, err := strconv.Atoi(strings.TrimSpace(h[2:])); err == nil {
			return "<=", n, 0, true
		}
	}
	if strings.HasPrefix(h, "==") {
		if n, err := strconv.Atoi(strings.TrimSpace(h[2:])); err == nil {
			return "=", n, 0, true
		}
	}
	if strings.HasPrefix(h, ">") {
		if n, err := strconv.Atoi(strings.TrimSpace(h[1:])); err == nil {
			return ">", n, 0, true
		}
	}
	if strings.HasPrefix(h, "<") {
		if n, err := strconv.Atoi(strings.TrimSpace(h[1:])); err == nil {
			return "<", n, 0, true
		}
	}
	if strings.HasPrefix(h, "=") {
		if n, err := strconv.Atoi(strings.TrimSpace(h[1:])); err == nil {
			return "=", n, 0, true
		}
	}
	if parts := strings.Split(h, ".."); len(parts) == 2 {
		od, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
		do, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err1 == nil && err2 == nil {
			return "..", min(od, do), max(od, do), true
		}
	}
	if m := vzorRozsahCisel.FindStringSubmatch(h); len(m) == 3 {
		od, _ := strconv.Atoi(m[1])
		do, _ := strconv.Atoi(m[2])
		return "..", min(od, do), max(od, do), true
	}
	if n, err := strconv.Atoi(h); err == nil {
		return "=", n, 0, true
	}
	return "", 0, 0, false
}

func vyhovujeCislo(hodnota int, op string, numOd, numDo int) bool {
	switch op {
	case ">=":
		return hodnota >= numOd
	case "<=":
		return hodnota <= numOd
	case ">":
		return hodnota > numOd
	case "<":
		return hodnota < numOd
	case "=", "==":
		return hodnota == numOd
	case "..":
		return hodnota >= numOd && hodnota <= numDo
	default:
		return false
	}
}

func vyhovujeNumericky(m Modelka, klic, op string, numOd, numDo int) bool {
	switch klic {
	case "vyska":
		if m.VyskaCm <= 0 {
			return false
		}
		return vyhovujeCislo(m.VyskaCm, op, numOd, numDo)
	case "vaha":
		if m.VahaKg <= 0 {
			return false
		}
		return vyhovujeCislo(m.VahaKg, op, numOd, numDo)
	case "hodnoceni", "srdicka":
		if m.Hodnoceni <= 0 && numOd > 0 {
			return false
		}
		return vyhovujeCislo(m.Hodnoceni, op, numOd, numDo)
	case "narozena":
		if len(m.NarozeniDatum) >= 4 {
			if rok, err := strconv.Atoi(m.NarozeniDatum[:4]); err == nil && rok > 0 {
				return vyhovujeCislo(rok, op, numOd, numDo)
			}
		}
		return false
	case "rok":
		for _, v := range m.Vydani {
			if len(v) >= 4 {
				if rok, err := strconv.Atoi(v[:4]); err == nil && rok > 0 {
					if vyhovujeCislo(rok, op, numOd, numDo) {
						return true
					}
				}
			}
		}
		return false
	}
	return false
}

// Slovo jen z číslic (rok, výška…): hledá se přesně, bez tolerance překlepů
func jeCislo(text string) bool {
	if text == "" {
		return false
	}
	for _, r := range text {
		if (r < '0' || r > '9') && r != '-' && r != '.' {
			return false
		}
	}
	return true
}

func vyhovujeVarianty(text string, varianty []string) bool {
	zjedn := zjednodusit(text)
	for _, v := range varianty {
		if strings.Contains(zjedn, v) {
			return true
		}
	}
	return false
}

// Levenshteinova vzdálenost mezi dvěma řetězci run (počet vložení, smazání a záměn znaků)
func vzdalenostLevenshtein(s1, s2 string) int {
	r1, r2 := []rune(s1), []rune(s2)
	len1, len2 := len(r1), len(r2)
	if len1 == 0 {
		return len2
	}
	if len2 == 0 {
		return len1
	}
	predchozi := make([]int, len2+1)
	aktualni := make([]int, len2+1)
	for j := 0; j <= len2; j++ {
		predchozi[j] = j
	}
	for i := 1; i <= len1; i++ {
		aktualni[0] = i
		for j := 1; j <= len2; j++ {
			cena := 1
			if r1[i-1] == r2[j-1] {
				cena = 0
			}
			smazat := predchozi[j] + 1
			vlozit := aktualni[j-1] + 1
			zamenit := predchozi[j-1] + cena
			min := smazat
			if vlozit < min {
				min = vlozit
			}
			if zamenit < min {
				min = zamenit
			}
			aktualni[j] = min
		}
		copy(predchozi, aktualni)
	}
	return aktualni[len2]
}

// Maximální povolená editační vzdálenost podle délky hledaného slova (max 1–2 překlepy pro jména a fotografy)
func maxPovolenaVzdalenost(delka int) int {
	if delka <= 3 {
		return 0
	}
	if delka <= 6 {
		return 1
	}
	return 2
}

// Ověří, zda hledané slovo odpovídá některému ze slov textu (přesně jako podřetězec nebo fuzzy Levenshteinem)
func odpovidaSlovoFuzzy(slovaTextu []string, hledaneSlovo string) bool {
	hledane := zjednodusit(hledaneSlovo)
	if hledane == "" {
		return true
	}
	maxD := maxPovolenaVzdalenost(len([]rune(hledane)))
	for _, slovo := range slovaTextu {
		s := zjednodusit(slovo)
		if strings.Contains(s, hledane) {
			return true
		}
		if maxD > 0 && vzdalenostLevenshtein(s, hledane) <= maxD {
			return true
		}
	}
	return false
}

// Ověří, zda hledaný dotaz (i víceslovný) odpovídá textu (přesně nebo s drobnými překlepy v jednotlivých slovech)
func odpovidaTextFuzzy(text string, hledanyDotaz string) bool {
	hledane := strings.Fields(zjednodusit(hledanyDotaz))
	if len(hledane) == 0 {
		return true
	}
	slovaTextu := strings.Fields(zjednodusit(text))
	for _, h := range hledane {
		if !odpovidaSlovoFuzzy(slovaTextu, h) {
			return false
		}
	}
	return true
}

// Každé hledané slovo se musí najít v některém údaji modelky, cílené slovo v daném údaji; na velikosti písmen
// ani diakritice nezáleží. Podporuje negaci (-tag:), čárku jako OR (vlasy:blond,zrzava), numerické porovnání
// (>175, 1970..1979), neuzavřené uvozovky i fuzzy matching pro jména modelek a fotografů.
func odpovidaHledani(m Modelka, vyhledavani string) bool {
	// Pokud je v dotazu lichý počet uvozovek (uživatel píše uvozovku a ještě ji neuzavřel), pomyslně ji uzavřeme na konci
	if strings.Count(vyhledavani, "\"")%2 != 0 {
		vyhledavani += "\""
	}

	vyskaTxt := ""
	if m.VyskaCm > 0 {
		vyskaTxt = fmt.Sprintf("%d %dcm", m.VyskaCm, m.VyskaCm)
	}
	vahaTxt := ""
	if m.VahaKg > 0 {
		vahaTxt = fmt.Sprintf("%d %dkg", m.VahaKg, m.VahaKg)
	}
	tetovaniTxt := ""
	if m.Tetovani == 1 {
		tetovaniTxt = "tetování tetovani"
	}
	piercingTxt := ""
	if m.Piercing == 1 {
		piercingTxt = "piercing"
	}
	udaje := zjednodusit(strings.Join([]string{
		m.Jmeno, m.Narodnost, m.Etnicita, m.NarozeniMisto, m.NarozeniDatum, m.UmrtiDatum, m.VlasyBarva, m.OciBarva,
		m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, m.Miry, m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags,
		m.DalsiJmena, m.Poznamka, strings.Join(m.Vydani, " "), strings.Join(m.Obalky, " "), m.textyAlb,
		vyskaTxt, vahaTxt, tetovaniTxt, piercingTxt,
	}, "\n"))
	var pole map[string]string
	for _, casti := range vzorSlovaHledani.FindAllStringSubmatch(vyhledavani, -1) {
		var negace bool
		var klic, hodnota string
		if casti[2] != "" {
			negace = casti[1] != ""
			klic = casti[2]
			hodnota = casti[3]
		} else if casti[5] != "" {
			negace = casti[4] != ""
			klic = casti[5]
			hodnota = casti[6]
		} else if strings.HasPrefix(casti[0], "\"") || strings.HasPrefix(casti[0], "-\"") || strings.HasPrefix(casti[0], "!\"") {
			negace = casti[7] != ""
			hodnota = casti[8]
		} else {
			slovo := casti[9]
			if strings.HasPrefix(slovo, "-") || strings.HasPrefix(slovo, "!") {
				negace = true
				slovo = slovo[1:]
			}
			if i := strings.Index(slovo, ":"); i > 0 {
				klic = slovo[:i]
				hodnota = slovo[i+1:]
			} else {
				hodnota = slovo
			}
		}
		hodnota = strings.Trim(hodnota, "\"")
		hodnotaZjedn := zjednodusit(strings.TrimSpace(hodnota))
		if hodnotaZjedn == "" {
			continue
		}

		var shoda bool
		if klic != "" {
			klicZjedn := zjednodusit(klic)
			op, numOd, numDo, ok := parsovatNumerickyFiltr(hodnota)
			// Rok kratší než čtyři číslice (rok:197) je začátek roku, ne přesný rok: hledá se jako text
			if ok && op == "=" && (klicZjedn == "rok" || klicZjedn == "narozena") && len(strings.TrimSpace(hodnota)) < 4 {
				ok = false
			}
			// Rozsah roků jen se čtyřmístnými mezemi: „1975-01“ je měsíc vydání (narození), ne rozsah 1–1975
			if ok && op == ".." && (klicZjedn == "rok" || klicZjedn == "narozena") && !vzorRozsahRoku.MatchString(hodnota) {
				ok = false
			}
			if klicZjedn == "rok" && vzorRokMesicHledani.MatchString(hodnota) {
				// rok:1975-01 = modelky čísla z daného měsíce (předpona vydání)
				shoda = false
				for _, v := range m.Vydani {
					if strings.HasPrefix(v, strings.TrimSpace(hodnota)) {
						shoda = true
						break
					}
				}
			} else if klicZjedn == "nafoceno" {
				// nafoceno:2004, nafoceno:2004-06 = online album nafocené v daném roce či měsíci (předpona data)
				shoda = false
				varianty := 0
				for _, v := range strings.Split(hodnotaZjedn, ",") {
					if v = strings.TrimSpace(v); v == "" {
						continue
					}
					varianty++
					for _, d := range m.OnlineAlba {
						shoda = shoda || (d != "" && strings.HasPrefix(d, v))
					}
				}
				if varianty == 0 {
					continue
				}
			} else if ok && (klicZjedn == "vyska" || klicZjedn == "vaha" || klicZjedn == "hodnoceni" || klicZjedn == "srdicka" || klicZjedn == "rok" || klicZjedn == "narozena") {
				shoda = vyhovujeNumericky(m, klicZjedn, op, numOd, numDo)
			} else {
				if pole == nil {
					pole = poleHledani(m)
				}
				if text, zname := pole[klicZjedn]; zname {
					varianty := []string{}
					for _, v := range strings.Split(hodnotaZjedn, ",") {
						if vz := strings.TrimSpace(v); vz != "" {
							varianty = append(varianty, vz)
						}
					}
					if len(varianty) == 0 {
						// Jen čárka (píše se další hodnota): slovo nic neomezuje
						continue
					}
					if klicZjedn == "tetovani" || klicZjedn == "piercing" {
						// Ano/ne se porovnává po celých slovech („no“ je i v „ano“)
						shoda = false
						for _, slovo := range strings.Fields(text) {
							for _, v := range varianty {
								shoda = shoda || slovo == v
							}
						}
					} else {
						shoda = vyhovujeVarianty(text, varianty)
					}
					// Překlepy se tolerují u jména a fotografa (i ve vyloučení: -jmeno:Pamella vyloučí Pamelu)
					if !shoda && (klicZjedn == "jmeno" || klicZjedn == "fotograf") {
						for _, v := range varianty {
							if odpovidaTextFuzzy(text, v) {
								shoda = true
								break
							}
						}
					}
				} else {
					// Neznámé pole: hledá se celé slovo jako obyčejný text
					shoda = strings.Contains(udaje, klicZjedn+":"+hodnotaZjedn)
				}
			}
		} else {
			varianty := []string{}
			for _, v := range strings.Split(hodnotaZjedn, ",") {
				if vz := strings.TrimSpace(v); vz != "" {
					varianty = append(varianty, vz)
				}
			}
			if len(varianty) == 0 {
				continue
			}
			shoda = vyhovujeVarianty(udaje, varianty)
			// Překlepy jen u hledaných slov s písmeny (ne u čísel a vylučovaných slov): 1975 nenajde 1976, -anna nevyloučí Anju
			if !shoda && !negace && !jeCislo(hodnotaZjedn) {
				for _, v := range varianty {
					if odpovidaTextFuzzy(m.Jmeno+" "+m.DalsiJmena, v) || odpovidaTextFuzzy(m.fotografoveAlb, v) {
						shoda = true
						break
					}
				}
			}
		}

		if negace {
			shoda = !shoda
		}
		if !shoda {
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
	sloupce := []string{"jmeno", "pridano"}
	otazniky := []string{"?", "?"}
	for _, s := range sloupceModelky {
		sloupce = append(sloupce, s[0])
		otazniky = append(otazniky, "?")
	}

	query := fmt.Sprintf(`INSERT INTO modelky (%s) VALUES (%s)`, strings.Join(sloupce, ", "), strings.Join(otazniky, ", "))
	// Import předává původní datum přidání, jinak platí okamžik vložení
	pridano := m.Pridano
	if pridano == "" {
		pridano = ted()
	}
	args := append([]interface{}{m.Jmeno, pridano}, hodnotyModelky(m)...)

	_, err := a.db.Exec(query, args...)
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

	_, err := a.db.Exec(`UPDATE modelky SET cover_zoom = ?, cover_x = ?, cover_y = ? WHERE id = ?`,
		omezit(zoom, 1, 4), omezit(x, 0, 100), omezit(y, 0, 100), id)
	if err != nil {
		a.chyba("uložení výřezu titulní fotky", err)
	}
	return err == nil
}

// Hodnocení modelky 1–5 srdíček; 0 hodnocení ruší
func (a *App) SetHodnoceni(id, hodnoceni int) bool {
	if hodnoceni < 0 {
		hodnoceni = 0
	}
	if hodnoceni > 5 {
		hodnoceni = 5
	}
	_, err := a.db.Exec(`UPDATE modelky SET hodnoceni = ? WHERE id = ?`, hodnoceni, id)
	if err != nil {
		a.chyba("uložení hodnocení modelky", err)
	}
	return err == nil
}

// Hodnocení fotek 1–5 srdíček (u spojeného plakátu všech jeho stránek najednou); 0 hodnocení ruší
func (a *App) SetHodnoceniFotek(ids []int, hodnoceni int) bool {
	if hodnoceni < 0 {
		hodnoceni = 0
	}
	if hodnoceni > 5 {
		hodnoceni = 5
	}
	return a.vTransakci("uložení hodnocení fotek", func(tx dotazovac) error {
		for _, id := range ids {
			if _, err := tx.Exec(`UPDATE fotky SET hodnoceni = ? WHERE id = ?`, hodnoceni, id); err != nil {
				return err
			}
		}
		return nil
	})
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

// Titulní fotkou modelky se stane fotka z některého jejího alba
func (a *App) SetTitulniFotka(modelkaID, fotoID int) bool {
	vysledek, err := a.db.Exec(`
		UPDATE modelky SET cover_zoom = NULL, cover_x = NULL, cover_y = NULL,
			drive_cover_id = (SELECT drive_file_id FROM fotografie WHERE id = ?1)
		WHERE id = ?2 AND EXISTS (SELECT 1 FROM fotografie f LEFT JOIN alba al ON al.id = f.album_id
			WHERE f.id = ?1 AND (f.modelka_id = ?2 OR EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = al.id AND am.modelka_id = ?2)))`,
		fotoID, modelkaID)
	if err != nil {
		a.chyba("nastavení titulní fotky", err)
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
// Podmínka alba, které nemá fotky ani nic dalšího
const albumBezObsahu = `NOT EXISTS (SELECT 1 FROM fotky f WHERE f.album_id = alba.id)
	AND COALESCE(popis, '') = '' AND COALESCE(fotograf, '') = '' AND COALESCE(netyka_se, '') = ''
	AND NOT EXISTS (SELECT 1 FROM alba_modelky am WHERE am.album_id = alba.id)`

// Album bez fotek zmizí, jen když nenese nic dalšího: text, fotograf, „netýká se“ i další modelky přežijí
// odebrání poslední fotky a vrátí se s novými fotkami. Smazat album jako celek umí DeleteAlbum.
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
	for rows.Next() {
		var f Fotografie
		var driveID string
		cile := []interface{}{&f.ID, &f.ModelkaID, &f.Album, &f.Typ, &driveID, &f.Rotace, &f.Spojit, &f.Vydani, &f.Hodnoceni, &f.Poradi, &f.Pridano, &f.AlbumID}
		if sJmenem {
			cile = append(cile, &f.JmenoModelky)
		}
		if sPopisem {
			cile = append(cile, &f.Popis, &f.Fotograf, &f.DatumAlba)
		}
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

// Načtení fotek konkrétní modelky pro její detailní profil
// Fotky modelky včetně alb, ve kterých je vedená jako další modelka
// Alba modelky (hlavní i další) se vyberou přes index alb a vazeb; podmínka s OR nad spojením
// procházela všechna alba sbírky a export (po modelkách) byl kvadratický
const dotazFotekModelky = vyberFotografii + vyberPopisu + " FROM fotografie f" + pripojeniPopisu + ` WHERE f.album_id IN (
	SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = ?1 UNION SELECT album_id FROM alba_modelky WHERE modelka_id = ?1)
	ORDER BY ` + razeniFotek

func (a *App) GetFotografieModelky(modelkaID int) []Fotografie {
	return a.doplnitDalsiModelky(a.nacistFotografie(dotazFotekModelky, false, true, modelkaID))
}

// Všechny centerfoldy napříč modelkami pro stěnu plakátů
func (a *App) GetCenterfoldy() []Fotografie {
	return a.nacistFotografie(vyberFotografii+`, m.jmeno`+vyberPopisu+` FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE f.typ = 'Centerfold'
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true)
}

// Covery časopisů nepatří k modelce (modelka_id = 0); album je vydání ve tvaru RRRR-MM
// Číslo časopisu je RRRR-MM, speciál RRRR-Snn (pořadí speciálu v roce, název je u čísla); u jiné než
// výchozí (US) edice s příponou, např. 2009-11-CZ nebo 1995-S01-CZ
var vzorVydani = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2]|S\d{2})(-[A-Z]{2})?$`)

// Pictorial může patřit i jen k ročníku bez měsíce (např. „Cybergirl of the Year 2012")
var vzorVydaniAlba = regexp.MustCompile(`^\d{4}(-(0[1-9]|1[0-2]|S\d{2}))?(-[A-Z]{2})?$`)

// Speciál (RRRR-Snn): nemá měsíc, proto se nepočítá mezi měsíční čísla ročníku
func jeSpecial(vydani string) bool {
	return len(vydani) >= 8 && vydani[4] == '-' && vydani[5] == 'S'
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
	// Cover přejde do alba svého vydání (případně nového), staré prázdné zmizí. Celé v jedné transakci:
	// když výměna souboru selže (stejný soubor už v cílovém čísle je), cover zůstane, kde byl.
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

// Vše, co patří k jednomu vydání časopisu: covery, centerfoldy i pictorialy napříč modelkami
// Vydání RRRR-MM: vše z jednoho čísla. Ročník RRRR (s edicí RRRR-CZ): vše z celého roku dané edice,
// tedy čísla po měsících i pictorialy přiřazené jen k ročníku.
func (a *App) GetVydani(vydani string) []Fotografie {
	if !vzorVydaniAlba.MatchString(vydani) {
		return nil
	}
	podminka, args := vydaniFotky+" = ?", []interface{}{vydani}
	if rok, edice, jenRocnik := rozlozitRocnik(vydani); jenRocnik {
		// Ročník: měsíční čísla i speciály roku v dané edici
		vzor, vzorSpecialu := rok+"-[0-1][0-9]", rok+"-S[0-9][0-9]"
		if edice != "" {
			vzor += "-" + edice
			vzorSpecialu += "-" + edice
		}
		podminka, args = "("+vydaniFotky+" = ? OR "+vydaniFotky+" GLOB ? OR "+vydaniFotky+" GLOB ?)", []interface{}{vydani, vzor, vzorSpecialu}
	}
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE `+podminka+`
		ORDER BY `+vydaniFotky+`, m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true, args...))
}

// „1975" → 1975, "", true; „1975-CZ" → 1975, "CZ", true; vydání s měsícem → false
func rozlozitRocnik(vydani string) (rok, edice string, jenRocnik bool) {
	if len(vydani) == 4 {
		return vydani, "", true
	}
	if len(vydani) == 7 && vydani[4] == '-' && vydani[5] >= 'A' {
		return vydani[:4], vydani[5:], true
	}
	return "", "", false
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

// Alba jednoho fotografa napříč modelkami (na velikosti písmen a diakritice ve jméně nezáleží)
func (a *App) GetAlbaFotografa(fotograf string) []Fotografie {
	hledany := zjednodusit(strings.TrimSpace(fotograf))
	fotky := []Fotografie{}
	if hledany == "" {
		return fotky
	}
	vsechny := a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE COALESCE(a.fotograf, '') <> ''
		ORDER BY `+vydaniFotky+`, m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true)
	// Album s víc fotografy (oddělenými čárkou) patří každému z nich
	for _, f := range vsechny {
		for _, jmeno := range strings.Split(f.Fotograf, ",") {
			if zjednodusit(strings.TrimSpace(jmeno)) == hledany {
				fotky = append(fotky, f)
				break
			}
		}
	}
	return a.doplnitDalsiModelky(fotky)
}

// Všechny fotky přiřazené k nějakému vydání, pro kalendář vydání
func (a *App) GetPrehledVydani() []Fotografie {
	return a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '') FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id
		WHERE `+vydaniFotky+` <> ''
		ORDER BY `+vydaniFotky+`, f.id`, true, false)
}

// Přiřazení alba (typicky pictorialu) k vydání časopisu; prázdné vydání přiřazení ruší
func (a *App) SetVydaniAlba(modelkaID int, album, typ, vydani string) bool {
	if vydani != "" && (!vzorVydaniAlba.MatchString(vydani) || jeOnlineTyp(typ)) {
		return false
	}
	// Centerfold a cover mají vydání v názvu; online album k číslu nepatří (má datum nafocení)
	_, err := a.db.Exec("UPDATE alba SET vydani = ? WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND typ NOT IN ('Centerfold', 'Cover', ?, ?, ?)",
		vydani, modelkaID, album, typ, typOnline, typCGTydne, typCGMesice)
	if err != nil {
		a.chyba("přiřazení alba k číslu", err)
	}
	return err == nil
}

// Datum nafocení nebo zveřejnění online alba (RRRR, RRRR-MM nebo RRRR-MM-DD, stejný tvar jako datum narození);
// prázdné datum údaj ruší. Je to jen údaj alba: vydání, kalendář ani titulní fotku modelky nemění.
func (a *App) SetDatumAlba(modelkaID int, album, typ, datum string) bool {
	datum = strings.TrimSpace(datum)
	if !platneDatum(datum) || (!jeOnlineTyp(typ) && datum != "") {
		return false
	}
	_, err := a.db.Exec("UPDATE alba SET datum = NULLIF(?, '') WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND typ IN (?, ?, ?)",
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
	// Spojený plakát se otáčí jako celek, proto se otočení stránek sjednotí
	id, err := zajistitAlbum(a.db, modelkaID, album, typ)
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
	// Dvě alba se přejmenováním nesmí tiše slít do jednoho; prázdný pozůstatek bez obsahu nevadí
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

	// Fotky odkazují na album, přejmenuje se jen jeho záznam; vydání centerfoldu je jeho název. Online album
	// vydání nemá a datum nafocení má jen ono: změnou typu na online vydání zmizí, změnou z online datum.
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

	// Popis patří k existujícímu albu; vymazání ho jen vyprázdní, album nese i fotky, vydání a vazby
	var id int64
	err := a.db.QueryRow("SELECT id FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?", modelkaID, album, typ).Scan(&id)
	if err == sql.ErrNoRows {
		return popis == "" && fotograf == ""
	}
	if err == nil {
		_, err = a.db.Exec("UPDATE alba SET popis = NULLIF(?, ''), fotograf = NULLIF(?, '') WHERE id = ?", popis, fotograf, id)
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
	// Bez zálohy se nemaže
	if err := a.zalohovat("pred-smazanim-alba"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return false
	}
	// Fotky, další modelky i výběry odejdou s albem přes cizí klíče a spouštěče
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
	// Bez zálohy se nemaže
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

// Stav souboru na Google Disku
const (
	souborNeoveren   = -1 // kontrola se nepovedla (např. výpadek připojení)
	souborNedostupny = 0
	souborDostupny   = 1
)

var klientDisku = &http.Client{Timeout: 20 * time.Second}

// Malý náhled stačí; smazaný nebo nesdílený soubor vrací místo obrázku stránku
func overitSouborNaDisku(driveID string) int {
	resp, err := klientDisku.Get(strings.ReplaceAll(adresaObrazku(driveID), "{velikost}", "w64"))
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
		a.chyba("vymazání mezipaměti obrázků", err)
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
	// Nedostupný i při kontrole v některý předchozí den; jen takové soubory se nabízí odebrat
	Opakovane bool `json:"opakovane"`
}

type KontrolaSouboru struct {
	Zkontrolovano int                `json:"zkontrolovano"`
	Nedostupne    []NedostupnySoubor `json:"nedostupne"`
	// Soubory, u kterých se kontrola nepovedla (např. výpadek připojení); nepočítají se jako nedostupné
	Neovereno int `json:"neovereno"`
	// Kontrola jen části souborů (denní dávka)
	Davka bool `json:"davka"`
}

// Kolik fotek ověří denní kontrola; za dávku se prostřídají všechny a Google nedostane tisíce požadavků najednou
const velikostDenniDavky = 300

// Ruční kontrola všech souborů včetně titulních fotek
func (a *App) ZkontrolovatSoubory() KontrolaSouboru {
	return a.zkontrolovat(`
		SELECT f.id, f.modelka_id, COALESCE(m.jmeno, ''), f.album, f.typ, f.drive_file_id, COALESCE(f.nedostupne_od, '')
		FROM fotografie f LEFT JOIN modelky m ON m.id = f.modelka_id
		UNION ALL
		SELECT 0, id, jmeno, '', 'Titulní fotka', drive_cover_id, '' FROM modelky WHERE COALESCE(drive_cover_id, '') <> ''`, false)
}

// Denní kontrola: nejdéle neověřené fotky, nejdřív ty, které už nedostupné byly
func (a *App) ZkontrolovatDavku() KontrolaSouboru {
	return a.zkontrolovat(fmt.Sprintf(`
		SELECT f.id, f.modelka_id, COALESCE(m.jmeno, ''), f.album, f.typ, f.drive_file_id, COALESCE(f.nedostupne_od, '')
		FROM fotografie f LEFT JOIN modelky m ON m.id = f.modelka_id
		ORDER BY COALESCE(f.overeno, ''), f.id LIMIT %d`, velikostDenniDavky), true)
}

// Ověření souborů a zápis výsledku k fotkám: dostupná dostane datum ověření, nedostupná si pamatuje, od kdy
// nedostupná je. Titulní fotky se jen hlásí, nikam se nezapisují.
func (a *App) zkontrolovat(dotaz string, davka bool) KontrolaSouboru {
	type polozka struct {
		soubor       NedostupnySoubor
		driveID      string
		nedostupneOd string
	}
	var polozky []polozka

	rows, err := a.db.Query(dotaz)
	if err != nil {
		a.chyba("kontrola souborů", err)
		return KontrolaSouboru{Nedostupne: []NedostupnySoubor{}}
	}
	for rows.Next() {
		var p polozka
		if err := rows.Scan(&p.soubor.FotoID, &p.soubor.ModelkaID, &p.soubor.Jmeno, &p.soubor.Album, &p.soubor.Typ, &p.driveID, &p.nedostupneOd); err == nil {
			polozky = append(polozky, p)
		}
	}
	rows.Close()

	vysledek := KontrolaSouboru{Zkontrolovano: len(polozky), Nedostupne: []NedostupnySoubor{}, Davka: davka}
	driveIDs := make([]string, len(polozky))
	for i, p := range polozky {
		driveIDs[i] = p.driveID
	}
	den := dnes()
	stavy := overitSoubory(driveIDs)
	for i, stav := range stavy {
		p := polozky[i]
		switch stav {
		case souborNeoveren:
			vysledek.Neovereno++
		case souborNedostupny:
			p.soubor.Opakovane = p.nedostupneOd != "" && p.nedostupneOd < den
			vysledek.Nedostupne = append(vysledek.Nedostupne, p.soubor)
		}
	}
	// Výsledky se zapíšou najednou v jedné transakci, až po síťové kontrole (spojení se po ni nedrží).
	// Seznam nedostupných se rozhraní vrátí, i když se zápis nepovede; chyba se ale ohlásí.
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("kontrola souborů", err)
		return vysledek
	}
	defer tx.Rollback()
	for i, stav := range stavy {
		p := polozky[i]
		if p.soubor.FotoID == 0 {
			continue
		}
		var err error
		switch stav {
		case souborDostupny:
			_, err = tx.Exec("UPDATE fotky SET overeno = ?, nedostupne_od = NULL WHERE id = ?", den, p.soubor.FotoID)
		case souborNedostupny:
			_, err = tx.Exec("UPDATE fotky SET overeno = ?, nedostupne_od = COALESCE(nedostupne_od, ?) WHERE id = ?", den, den, p.soubor.FotoID)
		}
		if err != nil {
			a.chyba("kontrola souborů", err)
			return vysledek
		}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("kontrola souborů", err)
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
	if err := a.overitKlicAlba(modelkaID, album, typ); err != nil {
		a.chyba("vložení fotek do alba", err)
		return vysledek
	}

	// Soubory, které v tomto albu už jsou, se nevkládají podruhé
	var ids []string
	for _, id := range parseDriveIDs(rawLinks) {
		var pocet int
		a.db.QueryRow("SELECT COUNT(*) FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND drive_file_id = ?",
			modelkaID, album, typ, id).Scan(&pocet)
		if pocet > 0 {
			vysledek.Duplicitni++
			continue
		}
		ids = append(ids, id)
	}

	// Nové stránky přebírají otočení spojeného plakátu, do kterého se přidávají; vydání a spojení jsou u alba
	var albumID int64
	var rotace int
	if len(ids) > 0 {
		var err error
		if albumID, err = zajistitAlbum(a.db, modelkaID, album, typ); err != nil {
			a.chyba("vložení fotek do alba", err)
			return vysledek
		}
		a.db.QueryRow("SELECT CASE WHEN spojit = 1 THEN COALESCE((SELECT MAX(rotace) FROM fotky WHERE album_id = alba.id), 0) ELSE 0 END FROM alba WHERE id = ?",
			albumID).Scan(&rotace)
	}

	for i, stav := range overitSoubory(ids) {
		if stav == souborNedostupny {
			vysledek.Nedostupne++
			continue
		}
		_, err := a.db.Exec("INSERT INTO fotky (album_id, drive_file_id, rotace, pridano, overeno) VALUES (?, ?, ?, ?, ?)",
			albumID, ids[i], rotace, ted(), map[bool]interface{}{true: dnes(), false: nil}[stav == souborDostupny])
		if err != nil {
			a.chyba("vložení fotek do alba", err)
			continue
		}
		vysledek.Vlozeno++
		if stav == souborNeoveren {
			vysledek.Neovereno++
		}
	}
	// Album založené jen pro tyto fotky nezůstane prázdné, když se nevložila žádná; album, které už předtím
	// neslo text, fotografa nebo další modelky, zůstane
	if albumID != 0 && vysledek.Vlozeno == 0 {
		if _, err := a.db.Exec("DELETE FROM alba WHERE id = ? AND "+albumBezObsahu, albumID); err != nil {
			a.chyba("vložení fotek do alba", err)
		}
	}
	return vysledek
}
