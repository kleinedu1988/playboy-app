package main

import (
	"database/sql"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"pinup-katalog/internal/sbirka"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type Zaloha = sbirka.Zaloha

// Zálohy jdou po jedné (denní záloha na pozadí a záloha před zápisem by si jinak navzájem uklízely soubory)
var zamekZaloh sync.Mutex

// Od každého důvodu (před importem, před migrací…) nejvýš tolik záloh a jen z posledních maxStariZalohy dní;
// nejnovější záloha každého důvodu zůstane vždy. Záloha má ~10 MB, dřív jich bylo až 20 od každého (přes 50 souborů).
const (
	pocetZaloh     = 3
	maxStariZalohy = 30 // dní
)

// Název zálohy: katalog-RRRR-MM-DD-HHMMSS.mmm-[pořadí-]důvod.db; zálohy před 0.02.078 mají předponu playboy-
// a jdou dál obnovit
var vzorZalohy = regexp.MustCompile(`^(?:playboy|katalog)-(\d{4}-\d{2}-\d{2})-\d{6}\.\d{3}-(?:\d+-)?(.+)\.db$`)

// Soubory sbírky (0.02.078): katalog.db a vedle něj databáze učení katalog-uceni.db (internal/uceni); dřív
// playboy.db a playboy-uceni.db
const (
	nazevSbirky      = "katalog.db"
	staryNazevSbirky = "playboy.db"
	predponaZaloh    = "katalog-"
)

func cestaSbirky() string {
	return filepath.Join(slozkaDat(), nazevSbirky)
}

// Čas zálohy z názvu (část za předponou; obě předpony mají stejnou délku, na tom ale nic nestojí)
func klicZalohy(nazev string) string {
	nazev = filepath.Base(nazev)
	if i := strings.IndexByte(nazev, '-'); i >= 0 {
		return nazev[i+1:]
	}
	return nazev
}

// Zálohy sbírky obou předpon odpovídající vzoru za předponou („*.db“), od nejnovější
func souboryZaloh(vzor string) []string {
	var soubory []string
	for _, predpona := range []string{predponaZaloh, "playboy-"} {
		nalezene, _ := filepath.Glob(filepath.Join(slozkaZaloh(), predpona+vzor))
		soubory = append(soubory, nalezene...)
	}
	sort.SliceStable(soubory, func(i, j int) bool { return klicZalohy(soubory[i]) > klicZalohy(soubory[j]) })
	return soubory
}

// Jednorázové přejmenování souborů sbírky (0.02.078): když katalog.db ještě není a playboy.db je obyčejný
// soubor, uloží se záloha a sbírka i databáze učení se přejmenují (napřed -wal, pak databáze, aby se nikdy
// nerozdělily). Na starých místech zůstanou odkazy na nové soubory, aby starší verze programu otevřela stejnou
// sbírku a nezaložila si prázdnou. Chyba = přejmenování se neprovedlo celé, program zůstane u starých jmen.
func prejmenovatSouborySbirky() error {
	stara := filepath.Join(slozkaDat(), staryNazevSbirky)
	info, err := os.Lstat(stara)
	if existuje(cestaSbirky()) || err != nil || !info.Mode().IsRegular() {
		return nil
	}
	if err := os.MkdirAll(slozkaZaloh(), 0o700); err != nil {
		return err
	}
	zaloha := filepath.Join(slozkaZaloh(), predponaZaloh+time.Now().Format("2006-01-02-150405.000")+"-pred-prejmenovanim.db")
	db, err := sql.Open("sqlite", stara)
	if err != nil {
		return err
	}
	_, err = db.Exec("VACUUM INTO '" + strings.ReplaceAll(zaloha, "'", "''") + "'")
	// Zavření spojení zapíše WAL do databáze
	db.Close()
	if err != nil {
		os.Remove(zaloha)
		return fmt.Errorf("záloha před přejmenováním: %w", err)
	}
	os.Chmod(zaloha, 0o600)

	dvojice := [][2]string{{staryNazevSbirky, nazevSbirky}, {"playboy-uceni.db", "katalog-uceni.db"}}
	for _, d := range dvojice {
		z, k := filepath.Join(slozkaDat(), d[0]), filepath.Join(slozkaDat(), d[1])
		if info, err := os.Lstat(z); err != nil || !info.Mode().IsRegular() || existuje(k) {
			continue
		}
		os.Remove(z + "-shm")
		if existuje(z + "-wal") {
			if err := os.Rename(z+"-wal", k+"-wal"); err != nil {
				return err
			}
		}
		if err := os.Rename(z, k); err != nil {
			// WAL zpátky k databázi, ke které patří
			os.Rename(k+"-wal", z+"-wal")
			return err
		}
		if err := os.Symlink(d[1], z); err != nil {
			fmt.Printf("Odkaz %s → %s se nepodařilo vytvořit: %v\n", z, d[1], err)
		}
	}
	fmt.Printf("Soubory sbírky přejmenovány na %s (záloha %s)\n", nazevSbirky, filepath.Base(zaloha))
	return nil
}

const (
	duvodDenni        = "denni"
	pocetDennichZaloh = 5
	pocetTydnuZaloh   = 3
)

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
	if err := prejmenovatSouborySbirky(); err != nil {
		fmt.Printf("Soubory sbírky se nepodařilo přejmenovat, zůstávají staré názvy: %v\n", err)
		return filepath.Join(slozkaDat(), staryNazevSbirky), nil
	}
	cil := cestaSbirky()
	if _, err := os.Stat(cil); err == nil {
		return cil, nil
	}

	kandidati := []string{staryNazevSbirky}
	if program, err := os.Executable(); err == nil {
		kandidati = append(kandidati, filepath.Join(filepath.Dir(program), staryNazevSbirky))
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

// Záloha databáze. Bez úspěšné zálohy se nesmí pokračovat v mazání, proto se chyba nikdy nezamlčí.
func (a *App) zalohovat(duvod string) error {
	zamekZaloh.Lock()
	defer zamekZaloh.Unlock()
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
	zaklad := filepath.Join(slozkaZaloh(), predponaZaloh+time.Now().Format("2006-01-02-150405.000"))
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
	soubory := souboryZaloh("*.db")

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
			hranice := time.Now().AddDate(0, 0, -maxStariZalohy).Format("2006-01-02")
			for i, zaloha := range zalohy {
				casti := vzorZalohy.FindStringSubmatch(filepath.Base(zaloha))
				if i >= pocetZaloh || (i > 0 && casti != nil && casti[1] < hranice) {
					os.Remove(zaloha)
				}
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
	if len(souboryZaloh(dnes+"-*-"+duvodDenni+".db")) > 0 {
		return
	}
	if err := a.zalohovat(duvodDenni); err != nil {
		a.chyba("denní záloha", err)
		return
	}
	// Nová denní záloha i na Google Disk (zaloha_disk.go), je-li uživatel přihlášený
	go a.zalohaNaDiskNaPozadi()
}

// Složka se zálohami pro zobrazení v aplikaci
func (a *App) SlozkaZaloh() string {
	os.MkdirAll(slozkaZaloh(), 0o700)
	return slozkaZaloh()
}

// Zálohy od nejnovější, s počty, aby šlo poznat, ke které se vrátit
func (a *App) SeznamZaloh() []Zaloha {
	soubory := souboryZaloh("*.db")

	zalohy := []Zaloha{}
	for _, soubor := range soubory {
		nazev := filepath.Base(soubor)
		casti := vzorZalohy.FindStringSubmatch(nazev)
		if casti == nil {
			continue
		}
		z := Zaloha{Soubor: nazev, Duvod: casti[2]}
		if cas, err := time.Parse("2006-01-02-150405", klicZalohy(nazev)[:17]); err == nil {
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

func (a *App) ObnovitZalohu(soubor string) string {
	a.pockatNaPozadi()
	// Jen soubor ze složky záloh, žádná cesta zvenku
	if soubor != filepath.Base(soubor) || !vzorZalohy.MatchString(soubor) {
		return "Neplatný název zálohy."
	}
	zaloha := filepath.Join(slozkaZaloh(), soubor)
	cil := a.cestaDb
	if cil == "" {
		cil = cestaSbirky()
	}
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
	// I hlídací spojení snímku sbírky, aby soubor po výměně nikdo nedržel
	a.zavritPametSbirky(false)
	a.db.Close()
	if zapis, err := sql.Open("sqlite", cil+dsnDatabaze); err == nil {
		var zaneprazdneno, stranek, preneseno int
		err = zapis.QueryRow("PRAGMA wal_checkpoint(TRUNCATE)").Scan(&zaneprazdneno, &stranek, &preneseno)
		zapis.Close()
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
	// Nálezy, které zmizí návratem k záloze, uživatel neopravil; učení je za opravy počítat nesmí
	a.uc.poObnoveniSbirky()
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
		a.chybaStartu = fmt.Sprintf("Obnovenou databázi se nepodařilo připravit (%v). Záloha stavu před obnovením je ve složce %s.", err, slozkaZaloh())
		a.prepnoutJenProCteni()
		return a.chybaStartu
	}
	a.zapnoutWAL()
	if err := a.ulozitNastaveni("heslo", heslo); err != nil {
		return fmt.Sprintf("Databáze je obnovená, ale nepodařilo se zachovat současné heslo: %v", err)
	}
	a.ulozitNastaveni("sablona_obrazku", sablona)
	sablonaObrazku.Store(sablona)
	return ""
}
