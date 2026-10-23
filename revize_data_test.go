package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Testy oprav z revize datové vrstvy (docs/REVIZE-GO-DATA.md, oddíl 3)

// Zápisy aplikace narazí na zámek: jiné spojení drží BEGIN IMMEDIATE a aplikace čeká jen chvíli.
// Vrací funkci, která zámek uvolní.
func revizeZamknout(t *testing.T, a *App) func() {
	t.Helper()
	a.db.Close()
	db, err := sql.Open("sqlite", a.cestaDb+"?_pragma=busy_timeout(50)&_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	a.db = db
	zamek, err := sql.Open("sqlite", a.cestaDb+dsnDatabaze)
	if err != nil {
		t.Fatal(err)
	}
	zamek.SetMaxOpenConns(1)
	if _, err := zamek.Exec("BEGIN IMMEDIATE"); err != nil {
		t.Fatal(err)
	}
	uvolneno := false
	uvolnit := func() {
		if !uvolneno {
			uvolneno = true
			zamek.Exec("ROLLBACK")
			zamek.Close()
		}
	}
	t.Cleanup(uvolnit)
	return uvolnit
}

// #1: opakovaný import exportu se stejnojmennými modelkami do jiné databáze je nezakládá znovu
func TestRevizeDatOpakovanyImportStejnychJmen(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	// Anny mají v databázi A čísla 3 a 4, v databázi B dostanou jiná
	for _, jmeno := range []string{"X", "Y", "Anna", "Anna"} {
		a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1})
	}
	a.DeleteModelka(1)
	a.DeleteModelka(2)
	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	if text := string(export); !strings.Contains(text, "cislo: 3") || !strings.Contains(text, "cislo: 4") {
		t.Fatalf("export nemá čísla modelek:\n%s", text)
	}

	b := novaTestovaciApp(t, nil)
	anny := func() int { return len(b.GetModelky("Anna")) }
	if v := b.importovat(export); v.Selhalo != "" || len(v.Chyby) != 0 || v.NoveModelky != 2 || anny() != 2 {
		t.Fatalf("první import: %+v, Ann %d", v, anny())
	}
	v := b.importovat(export)
	if v.Selhalo != "" || v.NoveModelky != 0 || anny() != 2 {
		t.Fatalf("druhý import založil další Anny: %+v, Ann %d", v, anny())
	}
	if len(v.Chyby) != 2 || !strings.Contains(v.Chyby[0], "Anna [3]: ve sbírce je víc modelek tohoto jména") {
		t.Fatalf("druhý import bez hlášky: %+v", v.Chyby)
	}

	// Ruční soubor bez čísla: nejednoznačné jméno se přeskočí s hláškou
	v = b.importovat([]byte("- jmeno: Anna\n  narodnost: USA\n"))
	if v.Selhalo != "" || v.NoveModelky != 0 || anny() != 2 || len(v.Chyby) != 1 || !strings.HasPrefix(v.Chyby[0], "Anna: ") {
		t.Fatalf("ruční import: %+v, Ann %d", v, anny())
	}
	for _, m := range b.GetModelky("Anna") {
		if m.Narodnost != "" {
			t.Fatalf("přeskočená modelka se upravila: %+v", m)
		}
	}
}

// #2: obnovení zálohy, která mezitím zmizela, nic nezmění; zálohy se otevírají jen pro čtení
func TestRevizeDatObnoveniZmizeleZalohy(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	if err := a.zalohovat("test"); err != nil {
		t.Fatal(err)
	}
	predtim, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*"))

	if chyba := a.ObnovitZalohu("playboy-2026-01-01-120000.000-denni.db"); chyba != "Záloha už neexistuje, databáze zůstala beze změny." {
		t.Fatalf("obnovení neexistující zálohy vrátilo %q", chyba)
	}
	if len(a.GetModelky("")) != 1 {
		t.Fatal("obnovení neexistující zálohy změnilo sbírku")
	}
	potom, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*"))
	if len(potom) != len(predtim) {
		t.Fatalf("ve složce záloh přibyl soubor: %v → %v", predtim, potom)
	}
	// Prázdný soubor zálohy se také neobnoví
	prazdna := filepath.Join(slozkaZaloh(), "playboy-2026-01-02-120000.000-denni.db")
	os.WriteFile(prazdna, nil, 0o600)
	if chyba := a.ObnovitZalohu(filepath.Base(prazdna)); chyba == "" || len(a.GetModelky("")) != 1 {
		t.Fatalf("obnovení prázdné zálohy: %q", chyba)
	}
	for _, z := range a.SeznamZaloh() {
		if z.Soubor == filepath.Base(prazdna) && !z.Poskozena {
			t.Fatal("prázdná záloha není v seznamu poškozená")
		}
	}
}

func TestRevizeDatZalohaJenProCteni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	if err := a.zalohovat("test"); err != nil {
		t.Fatal(err)
	}
	zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "playboy-*-test.db"))
	if len(zalohy) != 1 {
		t.Fatalf("zálohy: %v", zalohy)
	}
	db, err := otevritZalohu(zalohy[0])
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var modelek int
	if err := db.QueryRow("SELECT COUNT(*) FROM modelky").Scan(&modelek); err != nil || modelek != 1 {
		t.Fatalf("čtení zálohy: %d, %v", modelek, err)
	}
	if _, err := db.Exec("DELETE FROM modelky"); err == nil {
		t.Fatal("zápis přes spojení se zálohou prošel")
	}

	// Chybějící soubor se neotevře a nezaloží
	chybi := filepath.Join(slozkaZaloh(), "playboy-2026-01-01-120000.000-denni.db")
	if db, err := otevritZalohu(chybi); err == nil {
		if db.QueryRow("SELECT COUNT(*) FROM modelky").Scan(&modelek) == nil {
			t.Fatal("chybějící záloha se otevřela")
		}
		db.Close()
	}
	if _, err := os.Stat(chybi); !os.IsNotExist(err) {
		t.Fatal("otevření chybějící zálohy založilo soubor")
	}
}

// #3: sloučení modelek přenese články a „netýká se“ / „V pořádku“ zdrojové modelky
func TestRevizeDatSlouceniModelekSClankyANetykaSe(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Cíl", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Zdroj", Tetovani: -1, Piercing: -1})
	if a.AddClanek(Clanek{Vydani: "1996-01", Nazev: "Rozhovor", ModelkaID: 2}) == 0 {
		t.Fatal("článek se neuložil")
	}
	a.SetNetykaSe(1, "vzhled", true)
	a.SetNetykaSe(2, "titulni", true)
	a.SetNetykaSe(2, "ok-vyska", true)

	if chyba := a.SloucitModelky(1, 2); chyba != "" {
		t.Fatal(chyba)
	}
	if c := a.GetClankyModelky(1); len(c) != 1 || c[0].Nazev != "Rozhovor" {
		t.Fatalf("články cílové modelky po sloučení: %+v", c)
	}
	if m := a.GetModelky(""); len(m) != 1 || m[0].NetykaSe != "ok-vyska,titulni,vzhled" {
		t.Fatalf("netýká se po sloučení: %+v", m)
	}
}

// #4: chyba čtení během exportu export zruší místo neúplného souboru
func TestRevizeDatExportSelzePriDilciChybe(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	a.PridatDoVyberu(a.VyberPodleNazvu("Oblíbené"), []int{a.GetFotografieModelky(1)[0].ID})
	if _, err := a.exportovat(); err != nil {
		t.Fatal(err)
	}
	var hlaseno []string
	a.naChybu = func(zprava string) { hlaseno = append(hlaseno, zprava) }

	if _, err := a.db.Exec("DROP TABLE vybery_fotky"); err != nil {
		t.Fatal(err)
	}
	data, err := a.exportovat()
	if err == nil || data != nil || !strings.Contains(err.Error(), "export není úplný") {
		t.Fatalf("export bez výběrů: %v, %d bajtů", err, len(data))
	}
	// Chyba skončí ve vrácené chybě exportu, okno ji nedostane dvakrát
	if len(hlaseno) != 0 {
		t.Fatalf("export hlásil do okna: %v", hlaseno)
	}
}

// #5: přejmenování fotografa a tagu proběhne celé, nebo vůbec
func TestRevizeDatPrejmenovaniVTransakci(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1, Tags: "zrzka, blond"})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1, Tags: "zrzka"})
	a.AddBulkPhotos(1, "První", "Pictorial", odkazA)
	a.AddBulkPhotos(2, "Druhé", "Pictorial", odkazB)
	a.SetPopisAlba(1, "První", "Pictorial", "", "Jan Novák, Petr Malý")
	a.SetPopisAlba(2, "Druhé", "Pictorial", "", "Jan Novák")

	uvolnit := revizeZamknout(t, a)
	if n := a.PrejmenovatFotografa("jan novak", "Jan Nowak"); n != 0 {
		t.Fatalf("přejmenování fotografa při zamčené databázi vrátilo %d", n)
	}
	if n := a.PrejmenovatTag("zrzka", "rusovláska"); n != 0 {
		t.Fatalf("přejmenování tagu při zamčené databázi vrátilo %d", n)
	}
	uvolnit()
	if f := a.GetFotografieModelky(1)[0].Fotograf; f != "Jan Novák, Petr Malý" {
		t.Fatalf("fotograf po nezdařeném přejmenování: %q", f)
	}
	for _, m := range a.GetModelky("") {
		if !strings.Contains(m.Tags, "zrzka") {
			t.Fatalf("tagy po nezdařeném přejmenování: %+v", m)
		}
	}

	// Bez zámku: u alba s víc fotografy se přejmenuje jen ten jeden a nový se nezdvojí
	if n := a.PrejmenovatFotografa("jan novak", "Petr Malý"); n != 2 {
		t.Fatalf("přejmenování fotografa upravilo %d alb", n)
	}
	if f := a.GetFotografieModelky(1)[0].Fotograf; f != "Petr Malý" {
		t.Fatalf("fotograf alba s víc fotografy: %q", f)
	}
	if n := a.PrejmenovatTag("zrzka", "rusovláska"); n != 2 || a.GetModelky("Anna")[0].Tags != "rusovláska, blond" {
		t.Fatalf("přejmenování tagu: %d, %+v", n, a.GetModelky("Anna")[0])
	}
}

// #6: nepovedený zápis výsledku kontroly souborů se ohlásí a seznam nedostupných se vrátí i tak
func TestRevizeDatKontrolaSouboruHlasiChybuZapisu(t *testing.T) {
	stavy := map[string]int{}
	a := novaTestovaciApp(t, stavy)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA+" "+odkazB)
	stavy[idA] = souborNedostupny

	var hlaseno []string
	a.naChybu = func(zprava string) { hlaseno = append(hlaseno, zprava) }
	uvolnit := revizeZamknout(t, a)
	vysledek := a.ZkontrolovatSoubory()
	uvolnit()
	if len(vysledek.Nedostupne) != 1 || vysledek.Zkontrolovano != 2 {
		t.Fatalf("výsledek kontroly: %+v", vysledek)
	}
	if len(hlaseno) == 0 || !strings.Contains(hlaseno[0], "kontrola souborů") {
		t.Fatalf("chyba zápisu se neohlásila: %v", hlaseno)
	}
	var zapsano int
	a.db.QueryRow("SELECT COUNT(*) FROM fotky WHERE nedostupne_od IS NOT NULL").Scan(&zapsano)
	if zapsano != 0 {
		t.Fatal("při zamčené databázi se něco zapsalo")
	}

	// Bez zámku se výsledek uloží
	hlaseno = nil
	a.ZkontrolovatSoubory()
	a.db.QueryRow("SELECT COUNT(*) FROM fotky WHERE nedostupne_od IS NOT NULL").Scan(&zapsano)
	if len(hlaseno) != 0 || zapsano != 1 {
		t.Fatalf("kontrola bez zámku: %v, zapsáno %d", hlaseno, zapsano)
	}
}

// #7: po samých nedostupných odkazech nezůstane prázdné album
func TestRevizeDatZadnePrazdneAlbumPoNedostupnychOdkazech(t *testing.T) {
	a := novaTestovaciApp(t, map[string]int{idA: souborNedostupny})
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	alb := func() (n int) { a.db.QueryRow("SELECT COUNT(*) FROM alba").Scan(&n); return }

	if v := a.AddBulkPhotos(1, "Nové", "Pictorial", odkazA); v.Vlozeno != 0 || v.Nedostupne != 1 {
		t.Fatalf("vložení: %+v", v)
	}
	if alb() != 0 {
		t.Fatalf("po nedostupném odkazu zůstalo %d alb", alb())
	}

	// Album, které už neslo text, zůstane
	if _, err := zajistitAlbum(a.db, 1, "S popisem", "Pictorial"); err != nil {
		t.Fatal(err)
	}
	a.SetPopisAlba(1, "S popisem", "Pictorial", "Text alba", "")
	a.AddBulkPhotos(1, "S popisem", "Pictorial", odkazA)
	if alb() != 1 {
		t.Fatalf("album s popisem: %d alb", alb())
	}
}

// #8: úprava coveru proběhne celá, nebo vůbec
func TestRevizeDatUpravaCoveruCelaNeboVubec(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddCover("1990-01", odkazA)
	a.AddCover("1990-02", odkazB)
	coverA := func() Fotografie {
		for _, c := range a.GetCovery() {
			if c.DriveID == idA {
				return c
			}
		}
		t.Fatal("cover A zmizel")
		return Fotografie{}
	}
	id := coverA().ID

	// Soubor B už v čísle 1990-02 je: přesun ani výměna se neprovede
	if a.UpdateCover(id, "1990-02", odkazB) {
		t.Fatal("úprava coveru na soubor, který v čísle už je, prošla")
	}
	if c := coverA(); c.Album != "1990-01" || c.DriveID != idA {
		t.Fatalf("cover po nezdařené úpravě: %+v", c)
	}
	var ve1990_02 int
	a.db.QueryRow("SELECT COUNT(*) FROM fotografie WHERE album = '1990-02'").Scan(&ve1990_02)
	if ve1990_02 != 1 || len(a.GetCovery()) != 2 {
		t.Fatalf("číslo 1990-02 se změnilo: %d fotek", ve1990_02)
	}

	// Platná úprava proběhne a staré prázdné album zmizí
	if !a.UpdateCover(id, "1990-03", "") {
		t.Fatal("platná úprava coveru selhala")
	}
	var alb int
	a.db.QueryRow("SELECT COUNT(*) FROM alba WHERE album = '1990-01'").Scan(&alb)
	if c := coverA(); c.Album != "1990-03" || alb != 0 {
		t.Fatalf("cover po úpravě: %+v, alb 1990-01: %d", c, alb)
	}
}
