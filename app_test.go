package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

const (
	odkazA = "https://drive.google.com/file/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAAA/view"
	odkazB = "https://drive.google.com/file/d/BBBBBBBBBBBBBBBBBBBBBBBBBBBBB/view"
	idA    = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	idB    = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
)

// Aplikace nad prázdnou složkou dat; ověřování souborů na Disku je nahrazené, aby testy nepotřebovaly síť
func novaTestovaciApp(t *testing.T, stavy map[string]int) *App {
	t.Helper()
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Chdir(t.TempDir())

	puvodni := overitSoubor
	overitSoubor = func(driveID string) int {
		if stav, ok := stavy[driveID]; ok {
			return stav
		}
		return souborDostupny
	}
	t.Cleanup(func() { overitSoubor = puvodni })

	a := NewApp()
	a.startup(context.Background())
	t.Cleanup(func() { a.db.Close() })
	return a
}

func TestParseDriveIDs(t *testing.T) {
	pripady := []struct {
		vstup string
		chci  []string
	}{
		{odkazA, []string{idA}},
		{"https://drive.google.com/open?id=" + idA, []string{idA}},
		{"https://lh3.googleusercontent.com/d/" + idA, []string{idA}},
		{idA, []string{idA}},
		{odkazA + "\n" + odkazB + " " + odkazA, []string{idA, idB}},
		{"nic", nil},
	}
	for _, p := range pripady {
		mam := parseDriveIDs(p.vstup)
		if len(mam) != len(p.chci) {
			t.Fatalf("parseDriveIDs(%q) = %v, chci %v", p.vstup, mam, p.chci)
		}
		for i := range mam {
			if mam[i] != p.chci[i] {
				t.Fatalf("parseDriveIDs(%q) = %v, chci %v", p.vstup, mam, p.chci)
			}
		}
	}
}

func TestModelkaZivotniCyklus(t *testing.T) {
	a := novaTestovaciApp(t, nil)

	m := Modelka{Jmeno: "Test O'Hara", ObvodHrudnikCm: 86, ObvodPasCm: 61, ObvodBokyCm: 89, Tetovani: 1, Piercing: -1, CoverID: odkazA}
	if !a.AddModelka(m) {
		t.Fatal("AddModelka selhalo")
	}

	// Apostrof ve hledání nesmí rozbít dotaz
	nalezene := a.GetModelky("O'H")
	if len(nalezene) != 1 {
		t.Fatalf("hledání vrátilo %d modelek, chci 1", len(nalezene))
	}
	ulozena := nalezene[0]
	// Tetování je vyplněné, piercing zůstal neuvedený
	if ulozena.Miry != "86-61-89" || ulozena.Tetovani != 1 || ulozena.Piercing != -1 || ulozena.CoverID != idA {
		t.Fatalf("špatně uložená modelka: %+v", ulozena)
	}
	if ulozena.CoverZoom != 1 || ulozena.CoverX != 50 || ulozena.CoverY != 50 {
		t.Fatalf("výchozí výřez = %v/%v/%v", ulozena.CoverZoom, ulozena.CoverX, ulozena.CoverY)
	}

	// Výřez se omezuje na povolený rozsah
	a.SetCoverVyrez(ulozena.ID, 9, -5, 70)
	ulozena = a.GetModelky("")[0]
	if ulozena.CoverZoom != 4 || ulozena.CoverX != 0 || ulozena.CoverY != 70 {
		t.Fatalf("výřez po omezení = %v/%v/%v", ulozena.CoverZoom, ulozena.CoverX, ulozena.CoverY)
	}

	// Úprava bez titulní fotky ponechá fotku i výřez
	ulozena.Jmeno, ulozena.CoverID = "Jiné jméno", ""
	a.UpdateModelka(ulozena)
	ulozena = a.GetModelky("")[0]
	if ulozena.Jmeno != "Jiné jméno" || ulozena.CoverID != idA || ulozena.CoverZoom != 4 {
		t.Fatalf("úprava bez fotky: %+v", ulozena)
	}

	// Nová titulní fotka výřez vrací na výchozí
	ulozena.CoverID = odkazB
	a.UpdateModelka(ulozena)
	ulozena = a.GetModelky("")[0]
	if ulozena.CoverID != idB || ulozena.CoverZoom != 1 {
		t.Fatalf("úprava s novou fotkou: %+v", ulozena)
	}

	// Smazání modelky bere s sebou její fotky, cizí nechává
	a.AddBulkPhotos(ulozena.ID, "Album", "Pictorial", odkazA)
	a.AddBulkPhotos(ulozena.ID+1, "Album", "Pictorial", odkazA)
	if !a.DeleteModelka(ulozena.ID) {
		t.Fatal("DeleteModelka selhalo")
	}
	if len(a.GetModelky("")) != 0 || len(a.GetFotografieModelky(ulozena.ID)) != 0 {
		t.Fatal("modelka nebo její fotky po smazání zůstaly")
	}
	if len(a.GetFotografieModelky(ulozena.ID+1)) != 1 {
		t.Fatal("smazání modelky smazalo i cizí fotky")
	}
}

func TestVkladaniFotekOverujeOdkazy(t *testing.T) {
	a := novaTestovaciApp(t, map[string]int{idB: souborNedostupny})

	v := a.AddBulkPhotos(1, "Album", "Pictorial", odkazA+" "+odkazB)
	if v.Vlozeno != 1 || v.Nedostupne != 1 || v.Duplicitni != 0 {
		t.Fatalf("první vložení: %+v", v)
	}
	// Podruhé je dostupný soubor duplicitní, nedostupný se znovu odmítne
	v = a.AddBulkPhotos(1, "Album", "Pictorial", odkazA+" "+odkazB)
	if v.Vlozeno != 0 || v.Nedostupne != 1 || v.Duplicitni != 1 {
		t.Fatalf("druhé vložení: %+v", v)
	}
	// Stejný soubor v jiném albu duplicitní není
	if v = a.AddBulkPhotos(1, "Jiné", "Pictorial", odkazA); v.Vlozeno != 1 {
		t.Fatalf("vložení do jiného alba: %+v", v)
	}
}

func TestVkladaniBezPripojeniUklada(t *testing.T) {
	a := novaTestovaciApp(t, map[string]int{idA: souborNeoveren})

	v := a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	if v.Vlozeno != 1 || v.Neovereno != 1 {
		t.Fatalf("vložení bez připojení: %+v", v)
	}
	k := a.ZkontrolovatSoubory()
	if k.Zkontrolovano != 1 || k.Neovereno != 1 || len(k.Nedostupne) != 0 {
		t.Fatalf("kontrola bez připojení nesmí hlásit nedostupné: %+v", k)
	}
}

func TestAlbaACenterfoldy(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka", CoverID: odkazA})
	id := a.GetModelky("")[0].ID

	a.AddBulkPhotos(id, "2009-11", "Centerfold", odkazA+" "+odkazB)
	a.AddBulkPhotos(id, "Pictorial", "Pictorial", odkazA)

	centerfoldy := a.GetCenterfoldy()
	if len(centerfoldy) != 2 || centerfoldy[0].JmenoModelky != "Modelka" {
		t.Fatalf("centerfoldy: %+v", centerfoldy)
	}

	// Spojení do plakátu sjednotí otočení a nové stránky ho přebírají
	a.SetRotaceFotek([]int{centerfoldy[0].ID}, 90)
	a.SetSpojeniAlba(id, "2009-11", "Centerfold", true)
	a.SetRotaceFotek([]int{centerfoldy[0].ID, centerfoldy[1].ID}, 450)
	a.AddBulkPhotos(id, "2009-11", "Centerfold", "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view")
	for _, f := range a.GetCenterfoldy() {
		if !f.Spojit || f.Rotace != 90 {
			t.Fatalf("stránka plakátu má spojit=%v rotace=%d", f.Spojit, f.Rotace)
		}
	}

	// Přejmenování alba se týká jen daného typu
	a.UpdateAlbum(id, "2009-11", "Centerfold", "2010-01", "Centerfold")
	if len(a.GetCenterfoldy()) != 3 || a.GetCenterfoldy()[0].Album != "2010-01" {
		t.Fatal("přejmenování centerfoldu se neprojevilo")
	}

	a.DeleteAlbum(id, "2010-01", "Centerfold")
	zbyle := a.GetFotografieModelky(id)
	if len(zbyle) != 1 || zbyle[0].Typ != "Pictorial" {
		t.Fatalf("po smazání alba zbylo: %+v", zbyle)
	}
	if !a.DeleteFotografie(zbyle[0].ID) || len(a.GetFotografieModelky(id)) != 0 {
		t.Fatal("odebrání fotky selhalo")
	}
}

func TestCovery(t *testing.T) {
	a := novaTestovaciApp(t, nil)

	for _, spatne := range []string{"2009-13", "2009-00", "2009-1", "listopad", ""} {
		if v := a.AddCover(spatne, odkazA); v.Vlozeno != 0 {
			t.Fatalf("AddCover(%q) nemělo nic vložit", spatne)
		}
	}
	a.AddCover("2009-11", odkazA)
	a.AddCover("2010-01", odkazB)

	covery := a.GetCovery()
	if len(covery) != 2 || covery[0].Album != "2010-01" || covery[0].ModelkaID != 0 {
		t.Fatalf("covery mají být od nejnovějšího: %+v", covery)
	}
	// Covery nepatří žádné modelce ani mezi centerfoldy
	if len(a.GetCenterfoldy()) != 0 {
		t.Fatal("cover se objevil mezi centerfoldy")
	}

	if a.UpdateCover(covery[0].ID, "spatne", "") {
		t.Fatal("UpdateCover přijal neplatné vydání")
	}
	a.UpdateCover(covery[0].ID, "1999-05", "")
	a.UpdateCover(covery[1].ID, "1999-06", "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view")
	covery = a.GetCovery()
	if covery[0].Album != "1999-06" || covery[0].DriveID != "CCCCCCCCCCCCCCCCCCCCCCCCCCCCC" {
		t.Fatalf("úprava coveru s novým odkazem: %+v", covery[0])
	}
	if covery[1].Album != "1999-05" || covery[1].DriveID != idB {
		t.Fatalf("úprava coveru bez odkazu změnila obrázek: %+v", covery[1])
	}
}

func TestKontrolaSouboru(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka", CoverID: odkazB})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	a.AddCover("2009-11", "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view")

	// Titulní fotka a cover mezitím z Disku zmizely
	overitSoubor = func(driveID string) int {
		if driveID == idA {
			return souborDostupny
		}
		return souborNedostupny
	}
	k := a.ZkontrolovatSoubory()
	if k.Zkontrolovano != 3 || len(k.Nedostupne) != 2 {
		t.Fatalf("kontrola: %+v", k)
	}
	typy := map[string]bool{}
	for _, n := range k.Nedostupne {
		typy[n.Typ] = true
	}
	if !typy["Titulní fotka"] || !typy["Cover"] {
		t.Fatalf("nedostupné mají být titulní fotka a cover: %+v", k.Nedostupne)
	}
}

func TestZalohaPredMazanim(t *testing.T) {
	a := novaTestovaciApp(t, nil)

	// Prázdná databáze se nezálohuje
	if !a.DeleteVse() {
		t.Fatal("DeleteVse nad prázdnou databází selhalo")
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*.db")); len(zalohy) != 0 {
		t.Fatalf("prázdná databáze vytvořila zálohu: %v", zalohy)
	}

	a.AddModelka(Modelka{Jmeno: "Modelka", CoverID: odkazA})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	a.AddCover("2009-11", odkazB)
	if !a.DeleteVse() {
		t.Fatal("DeleteVse selhalo")
	}
	if len(a.GetModelky("")) != 0 || len(a.GetCovery()) != 0 {
		t.Fatal("po smazání databáze zůstala data")
	}

	zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*.db"))
	if len(zalohy) != 1 {
		t.Fatalf("čekám jednu zálohu, mám %v", zalohy)
	}
	zaloha, err := sql.Open("sqlite", zalohy[0])
	if err != nil {
		t.Fatal(err)
	}
	defer zaloha.Close()
	var modelek, fotek int
	zaloha.QueryRow("SELECT (SELECT COUNT(*) FROM modelky), (SELECT COUNT(*) FROM fotografie)").Scan(&modelek, &fotek)
	if modelek != 1 || fotek != 2 {
		t.Fatalf("záloha obsahuje %d modelek a %d fotek, chci 1 a 2", modelek, fotek)
	}

	// Po smazání začíná číslování znovu od 1
	a.AddModelka(Modelka{Jmeno: "Nová", CoverID: odkazA})
	if id := a.GetModelky("")[0].ID; id != 1 {
		t.Fatalf("nová modelka má ID %d, chci 1", id)
	}
}

func TestPocetZalohJeOmezeny(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka", CoverID: odkazA})

	for i := 0; i < pocetZaloh+5; i++ {
		if err := a.zalohovat("test"); err != nil {
			t.Fatal(err)
		}
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*.db")); len(zalohy) != pocetZaloh {
		t.Fatalf("zůstalo %d záloh, chci %d", len(zalohy), pocetZaloh)
	}
}

// Databáze starší verze ležela ve složce spuštění a měla jiné sloupce
func TestPrevzetiStareDatabaze(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Chdir(t.TempDir())

	stara, err := sql.Open("sqlite", "playboy.db")
	if err != nil {
		t.Fatal(err)
	}
	stara.Exec(`CREATE TABLE modelky (id INTEGER PRIMARY KEY AUTOINCREMENT, jmeno TEXT NOT NULL, vystoupeni TEXT, velikost_prsou TEXT, miry TEXT, typ_obsahu TEXT, drive_file_id TEXT)`)
	stara.Exec(`CREATE TABLE fotografie (id INTEGER PRIMARY KEY AUTOINCREMENT, modelka_id INTEGER, album TEXT, typ TEXT, drive_file_id TEXT)`)
	stara.Exec(`INSERT INTO modelky (jmeno, vystoupeni, drive_file_id) VALUES ('Pamela', '1995-01', ?)`, odkazA)
	stara.Exec(`INSERT INTO fotografie (modelka_id, album, typ, drive_file_id) VALUES (1, 'Album', 'Pictorial', ?)`, idB)
	stara.Close()

	spustit := func() *App {
		a := NewApp()
		a.startup(context.Background())
		return a
	}
	a := spustit()

	modelky := a.GetModelky("")
	if len(modelky) != 1 || modelky[0].Jmeno != "Pamela" || modelky[0].CoverID != idA || modelky[0].Vystoupeni != "1995-01" {
		t.Fatalf("modelka po převzetí: %+v", modelky)
	}
	if fotky := a.GetFotografieModelky(1); len(fotky) != 1 || fotky[0].Rotace != 0 || fotky[0].Spojit {
		t.Fatalf("fotky po převzetí: %+v", fotky)
	}
	if _, err := os.Stat("playboy.db"); !os.IsNotExist(err) {
		t.Fatal("původní playboy.db měla být přejmenována")
	}
	if _, err := os.Stat("playboy.db.presunuta"); err != nil {
		t.Fatal("chybí pojistná kopie playboy.db.presunuta")
	}
	if _, err := os.Stat(filepath.Join(slozkaDat(), "playboy.db")); err != nil {
		t.Fatal("databáze není na novém místě")
	}
	a.db.Close()

	// Druhé spuštění už nic nepřesouvá a data zůstávají
	b := spustit()
	defer b.db.Close()
	if len(b.GetModelky("")) != 1 {
		t.Fatal("po druhém spuštění data zmizela")
	}
	if b.StavDatabaze() != "" {
		t.Fatalf("neočekávaná chyba startu: %s", b.StavDatabaze())
	}
}

func TestVydaniSpojujeCoverCenterfoldAPictorial(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Kelley", CoverID: odkazA})
	a.AddModelka(Modelka{Jmeno: "Anna", CoverID: odkazA})

	a.AddCover("2009-11", odkazA)
	a.AddCover("2009-12", odkazA)
	a.AddBulkPhotos(1, "2009-11", "Centerfold", odkazA)
	a.AddBulkPhotos(1, "Playmate of the Month", "Pictorial", odkazA)
	a.AddBulkPhotos(2, "Jiný pictorial", "Pictorial", odkazA)

	if a.SetVydaniAlba(1, "Playmate of the Month", "Pictorial", "listopad") {
		t.Fatal("SetVydaniAlba přijalo neplatné vydání")
	}
	if !a.SetVydaniAlba(1, "Playmate of the Month", "Pictorial", "2009-11") {
		t.Fatal("SetVydaniAlba selhalo")
	}
	// Fotka přidaná později vydání alba přebírá
	a.AddBulkPhotos(1, "Playmate of the Month", "Pictorial", odkazB)

	vydani := a.GetVydani("2009-11")
	typy := map[string]int{}
	for _, f := range vydani {
		typy[f.Typ]++
		if f.Vydani != "2009-11" {
			t.Fatalf("fotka %d má vydání %q", f.ID, f.Vydani)
		}
		if f.Typ != "Cover" && f.JmenoModelky != "Kelley" {
			t.Fatalf("fotka %d patří modelce %q", f.ID, f.JmenoModelky)
		}
	}
	if typy["Cover"] != 1 || typy["Centerfold"] != 1 || typy["Pictorial"] != 2 || len(vydani) != 4 {
		t.Fatalf("vydání 2009-11 obsahuje %v", typy)
	}

	// Kalendář vidí všechna vydání, fotky bez vydání do něj nepatří
	prehled := map[string]int{}
	for _, f := range a.GetPrehledVydani() {
		prehled[f.Vydani]++
	}
	if len(prehled) != 2 || prehled["2009-11"] != 4 || prehled["2009-12"] != 1 {
		t.Fatalf("přehled vydání: %v", prehled)
	}
	if modelky := a.GetModelky(""); modelky[0].Jmeno != "Anna" || modelky[0].PocetFotek != 1 || modelky[1].PocetFotek != 3 {
		t.Fatalf("počty fotek modelek: %d a %d", modelky[0].PocetFotek, modelky[1].PocetFotek)
	}

	// Zrušení přiřazení pictorial z vydání vyřadí
	a.SetVydaniAlba(1, "Playmate of the Month", "Pictorial", "")
	if len(a.GetVydani("2009-11")) != 2 {
		t.Fatal("pictorial po zrušení přiřazení ve vydání zůstal")
	}
	if a.GetVydani("neplatne") != nil {
		t.Fatal("neplatné vydání má vrátit prázdný výsledek")
	}
}

// K založení modelky stačí jméno; titulní fotka se dá vybrat později z alba
func TestModelkaJenSeJmenem(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	if !a.AddModelka(Modelka{Jmeno: "Jen Jméno", Tetovani: -1, Piercing: -1}) {
		t.Fatal("AddModelka jen se jménem selhalo")
	}
	m := a.GetModelky("")[0]
	if m.CoverID != "" || m.CoverURL != "" {
		t.Fatalf("modelka bez fotky má titulní fotku %q", m.CoverURL)
	}

	a.AddBulkPhotos(m.ID, "Album", "Pictorial", odkazA)
	if !a.SetTitulniFotka(m.ID, a.GetFotografieModelky(m.ID)[0].ID) || a.GetModelky("")[0].CoverID != idA {
		t.Fatal("titulní fotku se nepodařilo vybrat z alba")
	}
}

func TestHledaniARazeniModelek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "zuzana Nová", Narodnost: "Česká", VlasyBarva: "Hnědá", Tags: "modelka, playmate"})
	a.AddModelka(Modelka{Jmeno: "Anna Bílá", Narodnost: "Brazilská", VlasyBarva: "Hnědá", VelikostPrsou: "34B"})
	a.AddModelka(Modelka{Jmeno: "Šárka Malá", Narodnost: "Česká", VlasyBarva: "Blond"})

	jmena := func(dotaz string) []string {
		var vysledek []string
		for _, m := range a.GetModelky(dotaz) {
			vysledek = append(vysledek, m.Jmeno)
		}
		return vysledek
	}
	stejne := func(mam []string, chci ...string) bool {
		if len(mam) != len(chci) {
			return false
		}
		for i := range mam {
			if mam[i] != chci[i] {
				return false
			}
		}
		return true
	}

	if mam := jmena(""); !stejne(mam, "Anna Bílá", "Šárka Malá", "zuzana Nová") {
		t.Fatalf("řazení podle jména: %v", mam)
	}
	// Hledá se ve všech údajích, bez ohledu na velikost písmen a diakritiku
	if mam := jmena("ceska"); !stejne(mam, "Šárka Malá", "zuzana Nová") {
		t.Fatalf("hledání národnosti: %v", mam)
	}
	// Více slov se musí najít všechna
	if mam := jmena("ČESKÁ blond"); !stejne(mam, "Šárka Malá") {
		t.Fatalf("hledání dvou slov: %v", mam)
	}
	if mam := jmena("34b"); !stejne(mam, "Anna Bílá") {
		t.Fatalf("hledání velikosti: %v", mam)
	}
	if mam := jmena("playmate"); !stejne(mam, "zuzana Nová") {
		t.Fatalf("hledání tagu: %v", mam)
	}
	if mam := jmena("neexistuje"); len(mam) != 0 {
		t.Fatalf("hledání bez výsledku: %v", mam)
	}
}

func TestDoplnkoveUdajeModelky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Kelley Thompson", DalsiJmena: "Kelly T., Miss November", Poznamka: "Playmate roku", Tetovani: 0, Piercing: -1, CoverID: odkazA})
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: 7, CoverID: odkazA})

	// Hledání najde modelku i podle pseudonymu a poznámky
	for _, dotaz := range []string{"miss november", "playmate roku"} {
		if nalezene := a.GetModelky(dotaz); len(nalezene) != 1 || nalezene[0].Jmeno != "Kelley Thompson" {
			t.Fatalf("hledání %q: %+v", dotaz, nalezene)
		}
	}

	kelley := a.GetModelky("kelley")[0]
	if kelley.Tetovani != 0 || kelley.Piercing != -1 || kelley.DalsiJmena != "Kelly T., Miss November" {
		t.Fatalf("uložené údaje: %+v", kelley)
	}
	// Nesmyslná hodnota se uloží jako neuvedeno
	if anna := a.GetModelky("anna")[0]; anna.Tetovani != -1 {
		t.Fatalf("tetování mimo rozsah = %d", anna.Tetovani)
	}

	// Hodnocení 0–5, hodnoty mimo rozsah se oříznou
	if kelley.Hodnoceni != 0 {
		t.Fatalf("nová modelka má hodnocení %d", kelley.Hodnoceni)
	}
	for nastavit, chci := range map[int]int{3: 3, 9: 5, -2: 0} {
		a.SetHodnoceni(kelley.ID, nastavit)
		if mam := a.GetModelky("kelley")[0].Hodnoceni; mam != chci {
			t.Fatalf("SetHodnoceni(%d) uložilo %d, chci %d", nastavit, mam, chci)
		}
	}

	// Vydání se odvozují z alb a centerfoldů a jdou vyhledat
	a.AddBulkPhotos(kelley.ID, "2009-11", "Centerfold", odkazA)
	a.AddBulkPhotos(kelley.ID, "Pictorial", "Pictorial", odkazB)
	a.SetVydaniAlba(kelley.ID, "Pictorial", "Pictorial", "2008-03")
	kelley = a.GetModelky("kelley")[0]
	if len(kelley.Vydani) != 2 || kelley.Vydani[0] != "2008-03" || kelley.Vydani[1] != "2009-11" {
		t.Fatalf("odvozená vydání: %v", kelley.Vydani)
	}
	if nalezene := a.GetModelky("2008-03"); len(nalezene) != 1 {
		t.Fatalf("hledání podle vydání vrátilo %d modelek", len(nalezene))
	}

	// Titulní fotka z alba: jen z fotek téže modelky, výřez se vrací na výchozí
	fotky := a.GetFotografieModelky(kelley.ID)
	a.SetCoverVyrez(kelley.ID, 3, 10, 10)
	var pictorial Fotografie
	for _, f := range fotky {
		if f.Typ == "Pictorial" {
			pictorial = f
		}
	}
	if !a.SetTitulniFotka(kelley.ID, pictorial.ID) {
		t.Fatal("SetTitulniFotka selhalo")
	}
	kelley = a.GetModelky("kelley")[0]
	if kelley.CoverID != idB || kelley.CoverZoom != 1 {
		t.Fatalf("titulní fotka po změně: %s, výřez %v", kelley.CoverID, kelley.CoverZoom)
	}
	anna := a.GetModelky("anna")[0]
	if a.SetTitulniFotka(anna.ID, pictorial.ID) || a.GetModelky("anna")[0].CoverID != idA {
		t.Fatal("titulní fotku šlo nastavit z cizí fotky")
	}
}

// Starší verze měla jen příznak oblíbené; ten se převádí na pět srdíček
func TestPrevodOblibenychNaHodnoceni(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Chdir(t.TempDir())
	os.MkdirAll(slozkaDat(), 0o755)

	stara, err := sql.Open("sqlite", filepath.Join(slozkaDat(), "playboy.db"))
	if err != nil {
		t.Fatal(err)
	}
	stara.Exec(`CREATE TABLE modelky (id INTEGER PRIMARY KEY AUTOINCREMENT, jmeno TEXT NOT NULL, oblibena INTEGER)`)
	stara.Exec(`INSERT INTO modelky (jmeno, oblibena) VALUES ('Oblíbená', 1), ('Běžná', 0), ('Neznámá', NULL)`)
	stara.Close()

	a := NewApp()
	a.startup(context.Background())
	defer a.db.Close()

	hodnoceni := map[string]int{}
	for _, m := range a.GetModelky("") {
		hodnoceni[m.Jmeno] = m.Hodnoceni
	}
	if hodnoceni["Oblíbená"] != 5 || hodnoceni["Běžná"] != 0 || hodnoceni["Neznámá"] != 0 {
		t.Fatalf("hodnocení po převodu: %v", hodnoceni)
	}
}

func TestPopisAlba(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Leanna"})
	a.AddModelka(Modelka{Jmeno: "Jiná"})
	id := a.GetModelky("Leanna")[0].ID

	// Album bez fotek popis mít nemůže
	if a.SetPopisAlba(id, "Karkulka", "Pictorial", "text", "") {
		t.Fatal("popis se uložil k albu bez fotek")
	}

	a.AddBulkPhotos(id, "Karkulka", "Pictorial", odkazA+" "+odkazB)
	a.AddBulkPhotos(id, "Druhé", "Pictorial", odkazA)
	if !a.SetPopisAlba(id, "Karkulka", "Pictorial", "  Little Red Riding Hood\n\ndruhý odstavec ", "Jan Novák") {
		t.Fatal("popis se neuložil")
	}
	a.SetPopisAlba(id, "Karkulka", "Pictorial", "Little Red Riding Hood", "Jan Novák")

	for _, f := range a.GetFotografieModelky(id) {
		chtenyPopis, chtenyFotograf := "", ""
		if f.Album == "Karkulka" {
			chtenyPopis, chtenyFotograf = "Little Red Riding Hood", "Jan Novák"
		}
		if f.Popis != chtenyPopis || f.Fotograf != chtenyFotograf {
			t.Fatalf("album %s má popis %q a fotografa %q", f.Album, f.Popis, f.Fotograf)
		}
	}

	// Popis i fotograf se prohledávají s modelkou
	for _, dotaz := range []string{"riding hood", "novak"} {
		if nalezene := a.GetModelky(dotaz); len(nalezene) != 1 || nalezene[0].Jmeno != "Leanna" {
			t.Fatalf("hledání %q našlo: %+v", dotaz, nalezene)
		}
	}

	// Přejmenování na název jiného alba se odmítne, jinak by se alba slila
	if a.UpdateAlbum(id, "Karkulka", "Pictorial", "Druhé", "Pictorial") {
		t.Fatal("přejmenování na existující album prošlo")
	}
	// Popis se přejmenováním alba neztratí a je vidět i na stránce vydání
	if !a.UpdateAlbum(id, "Karkulka", "Pictorial", "Red", "Pictorial") {
		t.Fatal("přejmenování selhalo")
	}
	a.SetVydaniAlba(id, "Red", "Pictorial", "2013-05")
	veVydani := a.GetVydani("2013-05")
	if len(veVydani) != 2 || veVydani[0].Popis != "Little Red Riding Hood" || veVydani[0].JmenoModelky != "Leanna" {
		t.Fatalf("vydání: %+v", veVydani)
	}

	// Po odebrání poslední fotky popis nepřežije pro nové album téhož jména
	for _, f := range veVydani {
		a.DeleteFotografie(f.ID)
	}
	a.AddBulkPhotos(id, "Red", "Pictorial", odkazA)
	for _, f := range a.GetFotografieModelky(id) {
		if f.Popis != "" {
			t.Fatalf("nové album zdědilo popis: %+v", f)
		}
	}

	// Hodnocení fotky se drží v rozsahu 0–5
	druhe := a.GetFotografieModelky(id)[0]
	if !a.SetHodnoceniFotek([]int{druhe.ID}, 9) || a.GetFotografieModelky(id)[0].Hodnoceni != 5 {
		t.Fatal("hodnocení fotky se neuložilo nebo nebylo omezeno na 5")
	}
	a.SetHodnoceniFotek([]int{druhe.ID}, 0)
	if a.GetFotografieModelky(id)[0].Hodnoceni != 0 {
		t.Fatal("hodnocení fotky se nezrušilo")
	}

	// Ruční pořadí: seřazené fotky jdou první, později přidaná za ně; zrušení vrací pořadí vložení
	a.AddBulkPhotos(id, "Pořadí", "Pictorial", odkazA+" "+odkazB)
	idsAlba := func() []int {
		var ids []int
		for _, f := range a.GetFotografieModelky(id) {
			if f.Album == "Pořadí" {
				ids = append(ids, f.ID)
			}
		}
		return ids
	}
	puvodni := idsAlba()
	if !a.SetPoradiFotek([]int{puvodni[1], puvodni[0]}) {
		t.Fatal("pořadí se neuložilo")
	}
	a.AddBulkPhotos(id, "Pořadí", "Pictorial", "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view")
	if ted := idsAlba(); len(ted) != 3 || ted[0] != puvodni[1] || ted[1] != puvodni[0] || ted[2] <= puvodni[1] {
		t.Fatalf("ruční pořadí: %v, původně %v", ted, puvodni)
	}
	a.ZrusitPoradiAlba(id, "Pořadí", "Pictorial")
	if ted := idsAlba(); ted[0] != puvodni[0] || ted[1] != puvodni[1] {
		t.Fatalf("po zrušení pořadí: %v", ted)
	}
	a.DeleteAlbum(id, "Pořadí", "Pictorial")

	// Pictorialu stačí ročník bez měsíce; má i svou stránku
	if !a.SetVydaniAlba(id, "Druhé", "Pictorial", "2012") || a.SetVydaniAlba(id, "Druhé", "Pictorial", "2012-13") {
		t.Fatal("vydání alba: ročník má projít, neplatný měsíc ne")
	}
	if rocnik := a.GetVydani("2012"); len(rocnik) != 1 || rocnik[0].Album != "Druhé" {
		t.Fatalf("stránka ročníku: %+v", rocnik)
	}

	// Prázdné údaje řádek alba ruší, smazání modelky také
	a.SetPopisAlba(id, "Red", "Pictorial", "x", "")
	a.SetPopisAlba(id, "Druhé", "Pictorial", "y", "")
	a.SetPopisAlba(id, "Red", "Pictorial", "", "")
	var radku int
	a.db.QueryRow("SELECT COUNT(*) FROM alba").Scan(&radku)
	if radku != 1 {
		t.Fatalf("v tabulce alb je %d řádků", radku)
	}
	a.DeleteModelka(id)
	a.db.QueryRow("SELECT COUNT(*) FROM alba").Scan(&radku)
	if radku != 0 {
		t.Fatalf("po smazání modelky zbylo %d řádků alb", radku)
	}
}

func TestExportAImport(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{
		Jmeno: "Leanna Decker", Narodnost: "USA", NarozeniDatum: "1991-08-01", VyskaCm: 157,
		ObvodHrudnikCm: 86, ObvodPasCm: 61, ObvodBokyCm: 86, Tetovani: 0, Piercing: -1, Tags: "zrzka, cybergirl", CoverID: odkazA,
	})
	a.AddModelka(Modelka{Jmeno: "Druhá", Tetovani: -1, Piercing: 1})
	id := a.GetModelky("Leanna")[0].ID
	a.SetHodnoceni(id, 5)
	a.SetCoverVyrez(id, 2, 30, 40)

	a.AddBulkPhotos(id, "Karkulka", "Pictorial", odkazA+" "+odkazB)
	a.SetPopisAlba(id, "Karkulka", "Pictorial", "První odstavec.\n\nDruhý odstavec.", "Jan Novák")
	a.SetVydaniAlba(id, "Karkulka", "Pictorial", "2012")
	fotky := a.GetFotografieModelky(id)
	a.SetPoradiFotek([]int{fotky[1].ID, fotky[0].ID})
	a.SetHodnoceniFotek([]int{fotky[0].ID}, 4)
	a.AddBulkPhotos(id, "2013-05", "Centerfold", odkazA+" "+odkazB)
	a.SetSpojeniAlba(id, "2013-05", "Centerfold", true)
	a.SetRotaceFotek([]int{a.GetCenterfoldy()[0].ID, a.GetCenterfoldy()[1].ID}, 90)
	a.AddCover("2013-05", odkazA)

	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	// Soubor má jít číst a upravovat ručně: víceřádkový popis je blok, ne řádek s \n
	if text := string(export); !strings.Contains(text, "popis: |-\n") || !strings.Contains(text, "rucni_poradi: true") || strings.Contains(text, "miry:") {
		t.Fatalf("export nemá čekanou podobu:\n%s", text)
	}

	// Import do prázdné databáze dá po novém exportu totéž (až na hlavičku s časem)
	bezHlavicky := func(data []byte) string { return string(data[strings.Index(string(data), "verze:"):]) }
	b := novaTestovaciApp(t, nil)
	vysledek := b.importovat(export)
	if vysledek.Selhalo != "" || len(vysledek.Chyby) != 0 || vysledek.NoveModelky != 2 || vysledek.NoveFotky != 5 || vysledek.Alba != 2 {
		t.Fatalf("import: %+v", vysledek)
	}
	znovu, _ := b.exportovat()
	if bezHlavicky(znovu) != bezHlavicky(export) {
		t.Fatalf("po importu se export liší:\n%s\n---\n%s", znovu, export)
	}

	// Opakovaný import nic nezdvojí
	if podruhe := b.importovat(export); podruhe.NoveModelky != 0 || podruhe.NoveFotky != 0 || podruhe.UpraveneModelky != 2 {
		t.Fatalf("druhý import: %+v", podruhe)
	}

	// Ručně psaný soubor: doplní a opraví, chybějící údaje nechá, nic nesmaže; neplatné části ohlásí
	rucni := `
modelky:
  - jmeno: leanna decker
    narodnost: Kanada
    vyska_cm: 160
    tetovani: ano
    alba:
      - nazev: Karkulka
        typ: Pictorial
        vydani: 2012-10
        popis: Nový text
        fotky:
          - id: https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view
            hodnoceni: 3
      - nazev: špatně
        typ: Centerfold
        fotky: [{id: DDDDDDDDDDDDDDDDDDDDDDDDDDDDD}]
  - jmeno: Třetí
covery:
  - vydani: 2014
    fotky: [{id: EEEEEEEEEEEEEEEEEEEEEEEEEEEEE}]
`
	vysledek = b.importovat([]byte(rucni))
	if vysledek.NoveModelky != 1 || vysledek.UpraveneModelky != 1 || vysledek.NoveFotky != 1 || len(vysledek.Chyby) != 2 {
		t.Fatalf("ruční import: %+v", vysledek)
	}
	m := b.GetModelky("leanna")[0]
	if m.Narodnost != "Kanada" || m.VyskaCm != 160 || m.Tetovani != 1 || m.NarozeniDatum != "1991-08-01" || m.Tags != "zrzka, cybergirl" ||
		m.Hodnoceni != 5 || m.CoverID != idA || m.CoverZoom != 2 || m.Miry != "86-61-86" {
		t.Fatalf("modelka po ručním importu: %+v", m)
	}
	var karkulka []Fotografie
	for _, f := range b.GetFotografieModelky(m.ID) {
		if f.Album == "Karkulka" {
			karkulka = append(karkulka, f)
		}
	}
	if len(karkulka) != 3 || karkulka[0].Popis != "Nový text" || karkulka[0].Fotograf != "Jan Novák" || karkulka[0].Vydani != "2012-10" {
		t.Fatalf("album po ručním importu: %+v", karkulka)
	}
	if len(b.GetModelky("")) != 3 || len(b.GetCovery()) != 1 {
		t.Fatal("ruční import něco smazal nebo přidal neplatný cover")
	}

	// Nečitelný soubor databázi nezmění
	if spatny := b.importovat([]byte("modelky: [nedokončeno")); spatny.Selhalo == "" {
		t.Fatal("neplatný YAML prošel")
	}
}

func TestStavOknaSeUklada(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())

	// Bez souboru nebo s nesmyslným obsahem se otevře výchozí okno
	if stav := nacistStavOkna(); stav.Sirka != vychoziSirka || stav.Vyska != vychoziVyska || stav.Maximalizovane {
		t.Fatalf("výchozí okno: %+v", stav)
	}
	ulozitStavOkna(StavOkna{Sirka: 10, Vyska: 10})
	if stav := nacistStavOkna(); stav.Sirka != vychoziSirka {
		t.Fatalf("příliš malé okno se převzalo: %+v", stav)
	}

	chtene := StavOkna{Sirka: 1400, Vyska: 900, X: 30, Y: 40, Maximalizovane: true, MaPolohu: true}
	if err := ulozitStavOkna(chtene); err != nil {
		t.Fatal(err)
	}
	if stav := nacistStavOkna(); stav != chtene {
		t.Fatalf("okno: %+v", stav)
	}
}

func TestZamekHeslem(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	zdrzeniSpatnehoHesla = 0

	if a.MaZamek() || a.Odemknout("") {
		t.Fatal("nová databáze nemá mít zámek a prázdné heslo nesmí nic odemknout")
	}
	if !a.NastavitHeslo("", "tajné") || !a.MaZamek() {
		t.Fatal("heslo se nenastavilo")
	}
	if a.Odemknout("spatne") || a.Odemknout("") || !a.Odemknout("tajné") {
		t.Fatal("odemykání nefunguje")
	}
	// Heslo samotné v databázi není
	if ulozene := a.nastaveni("heslo"); strings.Contains(ulozene, "tajné") || len(ulozene) < 64 {
		t.Fatalf("uložené heslo: %q", ulozene)
	}
	// Změna i zrušení vyžadují stávající heslo
	if a.NastavitHeslo("spatne", "jiné") || a.NastavitHeslo("spatne", "") {
		t.Fatal("heslo šlo změnit bez znalosti stávajícího")
	}
	if !a.NastavitHeslo("tajné", "jiné") || a.Odemknout("tajné") || !a.Odemknout("jiné") {
		t.Fatal("změna hesla selhala")
	}
	if !a.NastavitHeslo("jiné", "") || a.MaZamek() {
		t.Fatal("zrušení hesla selhalo")
	}
}

func TestPrehledSbirky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Úplná", NarozeniDatum: "1990-01-01", CoverID: odkazA})
	a.AddModelka(Modelka{Jmeno: "Prázdná"})
	uplna := a.GetModelky("Úplná")[0].ID
	a.SetHodnoceni(uplna, 4)

	a.AddBulkPhotos(uplna, "2010-03", "Centerfold", odkazA)
	a.AddBulkPhotos(uplna, "S popisem", "Pictorial", odkazA+" "+odkazB)
	a.SetPopisAlba(uplna, "S popisem", "Pictorial", "text", "")
	a.SetVydaniAlba(uplna, "S popisem", "Pictorial", "2010-04")
	a.AddBulkPhotos(uplna, "Holé", "Pictorial", odkazA)
	a.SetHodnoceniFotek([]int{a.GetFotografieModelky(uplna)[0].ID}, 5)
	a.AddCover("2010-03", odkazA)
	a.AddCover("2011-01", odkazA)

	p := a.GetPrehled(false)
	if p.Modelek != 2 || p.Alb != 3 || p.Fotek != 4 || p.HodnocenychFotek != 1 || p.Coveru != 2 || p.Vydani != 3 {
		t.Fatalf("počty: %+v", p)
	}
	jmena := func(polozky []PolozkaPrehledu) string {
		var text []string
		for _, polozka := range polozky {
			text = append(text, polozka.Jmeno+"/"+polozka.Album)
		}
		return strings.Join(text, ",")
	}
	for nazev, dvojice := range map[string][2]string{
		"bez titulní":            {jmena(p.BezTitulni), "Prázdná/"},
		"bez narození":           {jmena(p.BezNarozeni), "Prázdná/"},
		"bez centerfoldu":        {jmena(p.BezCenterfoldu), "Prázdná/"},
		"bez hodnocení":          {jmena(p.BezHodnoceni), "Prázdná/"},
		"alba bez popisu":        {jmena(p.AlbaBezPopisu), "Úplná/Holé"},
		"alba bez vydání":        {jmena(p.AlbaBezVydani), "Úplná/Holé"},
		"bez coveru":             {strings.Join(p.VydaniBezCoveru, ","), "2010-04"},
		"bez centerfoldu vydání": {strings.Join(p.VydaniBezCenterfoldu, ","), "2010-04,2011-01"},
	} {
		if dvojice[0] != dvojice[1] {
			t.Errorf("%s: %q, čekáno %q", nazev, dvojice[0], dvojice[1])
		}
	}
	brezenADuben := [12]bool{2: true, 3: true}
	if len(p.Rocniky) != 2 || p.Rocniky[0] != (RocnikPrehledu{Rok: 2010, Edice: "US", Vydani: 2, Mesice: brezenADuben}) || p.Rocniky[1] != (RocnikPrehledu{Rok: 2011, Edice: "US", Vydani: 1, Mesice: [12]bool{0: true}}) {
		t.Fatalf("ročníky: %+v", p.Rocniky)
	}

	// Ke kontrole: album s jednou fotkou; po doplnění dalších údajů i duplicitní jméno a nesmyslný věk
	if len(p.Podezrele) != 1 || !strings.Contains(p.Podezrele[0].Popis, "Holé") {
		t.Fatalf("podezřelé údaje: %+v", p.Podezrele)
	}
	a.AddModelka(Modelka{Jmeno: "Jiná", DalsiJmena: "x, úplná", NarozeniDatum: "2000-06-15"})
	jina := a.GetModelky("Jiná")[0].ID
	a.AddBulkPhotos(jina, "2010-03", "Centerfold", odkazB)
	var popisy []string
	for _, u := range a.GetPrehled(false).Podezrele {
		popisy = append(popisy, u.Jmeno+": "+u.Popis)
	}
	vse := strings.Join(popisy, " | ")
	if len(popisy) != 3 || !strings.Contains(vse, "má i modelka Jiná") || !strings.Contains(vse, "vychází na 9 let") {
		t.Fatalf("podezřelé údaje: %s", vse)
	}

	// Nově přidané záznamy mají datum přidání
	if m := a.GetModelky("Jiná")[0]; len(m.Pridano) != 19 || len(a.GetFotografieModelky(jina)[0].Pridano) != 19 {
		t.Fatalf("datum přidání chybí: %+v", m)
	}
}

func TestPojistkyZaloh(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka"})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA+" "+odkazB)
	a.SetPopisAlba(1, "Album", "Pictorial", "text", "")
	zalohy := func(vzor string) []string {
		soubory, _ := filepath.Glob(filepath.Join(slozkaZaloh(), vzor))
		return soubory
	}

	// Denní záloha vznikne jednou za den, i když se program spustí víckrát
	a.denniZaloha()
	a.denniZaloha()
	if denni := zalohy("*-denni.db"); len(denni) != 1 {
		t.Fatalf("denní zálohy: %v", denni)
	} else if info, _ := os.Stat(denni[0]); info.Mode().Perm() != 0o600 {
		t.Fatalf("záloha má práva %v, chci jen pro vlastníka", info.Mode().Perm())
	}

	// Každý důvod má vlastní frontu: úklid alb nevytlačí zálohu před importem
	if err := a.zalohovat("pred-importem"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < pocetZaloh+3; i++ {
		a.zalohovat("pred-smazanim-alba")
	}
	if len(zalohy("*-pred-importem.db")) != 1 || len(zalohy("*-pred-smazanim-alba.db")) != pocetZaloh || len(zalohy("*-denni.db")) != 1 {
		t.Fatalf("po úklidu: import %d, alba %d, denní %d", len(zalohy("*-pred-importem.db")), len(zalohy("*-pred-smazanim-alba.db")), len(zalohy("*-denni.db")))
	}

	// Denní zálohy: posledních sedm a k nim nejnovější z každého ze čtyř dalších týdnů
	for _, soubor := range zalohy("*.db") {
		os.Remove(soubor)
	}
	den := time.Date(2026, 3, 31, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 60; i++ {
		nazev := fmt.Sprintf("playboy-%s-120000.000-denni.db", den.AddDate(0, 0, -i).Format("2006-01-02"))
		os.WriteFile(filepath.Join(slozkaZaloh(), nazev), nil, 0o600)
	}
	uklidZaloh()
	zbyle := zalohy("*-denni.db")
	if len(zbyle) != pocetDennichZaloh+pocetTydnuZaloh {
		t.Fatalf("zbylo %d denních záloh: %v", len(zbyle), zbyle)
	}
	if nejstarsi := filepath.Base(zbyle[0]); nejstarsi < "playboy-2026-02-20" {
		t.Fatalf("zůstala příliš stará záloha %s", nejstarsi)
	}

	// Hromadné odebrání fotek: záloha předem, text alba mizí až s poslední fotkou
	fotky := a.GetFotografieModelky(1)
	if !a.DeleteFotografieHromadne([]int{fotky[0].ID, fotky[1].ID}) || len(a.GetFotografieModelky(1)) != 0 {
		t.Fatal("hromadné odebrání selhalo")
	}
	if len(zalohy("*-pred-odebranim-fotek.db")) != 1 {
		t.Fatal("před hromadným odebráním nevznikla záloha")
	}

	// Když se záloha nepovede, mazání se nesmí provést
	a.AddBulkPhotos(1, "Druhé", "Pictorial", odkazA)
	os.RemoveAll(slozkaZaloh())
	os.WriteFile(slozkaZaloh(), nil, 0o600) // místo složky soubor: zálohu není kam zapsat
	if a.DeleteAlbum(1, "Druhé", "Pictorial") || a.DeleteModelka(1) || a.DeleteVse() || a.DeleteFotografieHromadne([]int{a.GetFotografieModelky(1)[0].ID}) {
		t.Fatal("mazání proběhlo bez zálohy")
	}
	if len(a.GetModelky("")) != 1 || len(a.GetFotografieModelky(1)) != 1 {
		t.Fatal("po neúspěšné záloze zmizela data")
	}
	os.Remove(slozkaZaloh())

	// Nezjistitelný obsah databáze není „není co zálohovat": záloha musí ohlásit chybu, export také
	a.db.Exec("ALTER TABLE fotografie RENAME TO fotografie_pryc")
	if a.zalohovat("test") == nil {
		t.Fatal("záloha nad nečitelnou databází vrátila úspěch")
	}
	if _, err := a.exportovat(); err == nil {
		t.Fatal("export nad nečitelnou databází vrátil úspěch")
	}
}

func TestMigraceAObnoveni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	verze := func() (v int) { a.db.QueryRow("PRAGMA user_version").Scan(&v); return }
	if verze() != len(migrace) {
		t.Fatalf("nová databáze má schéma %d, chci %d", verze(), len(migrace))
	}

	a.AddModelka(Modelka{Jmeno: "Zoë Ödegaard"})
	a.AddModelka(Modelka{Jmeno: "Adéla"})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA+" "+odkazB)
	a.NastavitHeslo("", "současné")

	// Hledání a řazení nezávisí na diakritice žádného jazyka
	if nalezene := a.GetModelky("zoe odegaard"); len(nalezene) != 1 {
		t.Fatalf("hledání bez diakritiky: %+v", nalezene)
	}
	if vsechny := a.GetModelky(""); vsechny[0].Jmeno != "Adéla" {
		t.Fatalf("řazení: %s je první", vsechny[0].Jmeno)
	}

	// Tentýž soubor v albu podruhé databáze nepřijme, ani kdyby kontrola v programu selhala
	if _, err := a.db.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id) VALUES (1, 'Album', 'Pictorial', ?)", idA); err == nil {
		t.Fatal("databáze přijala tentýž soubor v albu dvakrát")
	}

	// Opakované spuštění migrací nic nemění a nedělá zálohu
	if err := a.migrovat(); err != nil {
		t.Fatal(err)
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*-pred-migraci.db")); len(zalohy) != 0 {
		t.Fatalf("zbytečná záloha před migrací: %v", zalohy)
	}

	// Databáze z novější verze programu se neupravuje
	a.db.Exec(fmt.Sprintf("PRAGMA user_version = %d", len(migrace)+1))
	if a.migrovat() == nil {
		t.Fatal("novější schéma prošlo bez chyby")
	}
	a.db.Exec(fmt.Sprintf("PRAGMA user_version = %d", len(migrace)))

	// Obnovení: záloha se dvěma fotkami, potom změny, potom návrat
	if err := a.zalohovat("test"); err != nil {
		t.Fatal(err)
	}
	a.DeleteAlbum(1, "Album", "Pictorial")
	a.AddModelka(Modelka{Jmeno: "Přidaná po záloze"})
	a.NastavitHeslo("současné", "nové")

	seznam := a.SeznamZaloh()
	var testovaci Zaloha
	for _, z := range seznam {
		if z.Duvod == "test" {
			testovaci = z
		}
	}
	if testovaci.Modelek != 2 || testovaci.Fotek != 2 || testovaci.Poskozena || len(testovaci.Cas) != 19 {
		t.Fatalf("seznam záloh: %+v", seznam)
	}
	if a.ObnovitZalohu("../playboy.db") == "" || a.ObnovitZalohu("neexistuje.db") == "" {
		t.Fatal("obnovení přijalo soubor mimo složku záloh")
	}
	if chyba := a.ObnovitZalohu(testovaci.Soubor); chyba != "" {
		t.Fatal(chyba)
	}
	if len(a.GetModelky("")) != 2 || len(a.GetFotografieModelky(1)) != 2 {
		t.Fatal("obnovení nevrátilo stav zálohy")
	}
	// Heslo zůstává to, které platilo před obnovením, ne to ze zálohy
	if !a.Odemknout("nové") || a.Odemknout("současné") {
		t.Fatal("obnovení vrátilo staré heslo")
	}
	// Stav před obnovením jde vrátit také
	var predObnovenim Zaloha
	for _, z := range a.SeznamZaloh() {
		if z.Duvod == "pred-obnovenim" {
			predObnovenim = z
		}
	}
	if predObnovenim.Modelek != 3 || predObnovenim.Fotek != 0 {
		t.Fatalf("záloha před obnovením: %+v", predObnovenim)
	}

	// Stará databáze bez indexu a se zdvojenou fotkou: úprava ji uklidí a předem zazálohuje
	a.db.Exec("DROP INDEX fotografie_soubor_v_albu")
	a.db.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id) VALUES (1, 'Album', 'Pictorial', ?)", idA)
	a.db.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id) VALUES (NULL, '2009-11', 'Cover', ?)", idA)
	a.db.Exec("PRAGMA user_version = 1")
	if err := a.migrovat(); err != nil {
		t.Fatal(err)
	}
	if len(a.GetFotografieModelky(1)) != 2 || len(a.GetCovery()) != 1 || verze() != len(migrace) {
		t.Fatalf("po úpravě: %d fotek, %d coverů, schéma %d", len(a.GetFotografieModelky(1)), len(a.GetCovery()), verze())
	}
	if zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "*-pred-migraci.db")); len(zalohy) != 1 {
		t.Fatalf("záloha před migrací: %v", zalohy)
	}
}

func TestEdiceVydani(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Americká"})
	a.AddModelka(Modelka{Jmeno: "Česká"})

	// Stejný měsíc v US a CZ edici jsou dvě různá vydání
	a.AddCover("2009-11", odkazA)
	a.AddCover("2009-11-CZ", odkazB)
	a.AddBulkPhotos(1, "2009-11", "Centerfold", odkazA)
	a.AddBulkPhotos(2, "2009-11-CZ", "Centerfold", odkazB)
	a.AddBulkPhotos(2, "Pictorial", "Pictorial", odkazA)
	if !a.SetVydaniAlba(2, "Pictorial", "Pictorial", "2009-11-CZ") || !a.SetVydaniAlba(2, "Pictorial", "Pictorial", "2012-CZ") {
		t.Fatal("vydání s edicí se nepřijalo")
	}
	a.SetVydaniAlba(2, "Pictorial", "Pictorial", "2009-11-CZ")
	if a.SetVydaniAlba(2, "Pictorial", "Pictorial", "2009-11-cz") || a.AddCover("2009-13-CZ", odkazA).Vlozeno != 0 {
		t.Fatal("neplatná edice nebo měsíc prošly")
	}

	us, cz := a.GetVydani("2009-11"), a.GetVydani("2009-11-CZ")
	if len(us) != 2 || len(cz) != 3 {
		t.Fatalf("US vydání má %d položek, CZ %d", len(us), len(cz))
	}

	p := a.GetPrehled(false)
	if p.Vydani != 2 || len(p.Rocniky) != 2 || p.Rocniky[0].Edice != "US" || p.Rocniky[1].Edice != "CZ" || p.Rocniky[1].Vydani != 1 {
		t.Fatalf("přehled: %d vydání, ročníky %+v", p.Vydani, p.Rocniky)
	}

	// Fotografové z celé sbírky, každý jednou
	a.SetPopisAlba(2, "Pictorial", "Pictorial", "", "Arny Freytag")
	a.SetPopisAlba(1, "2009-11", "Centerfold", "", " Arny Freytag ")
	if f := a.GetFotografove(); len(f) != 1 || f[0] != "Arny Freytag" {
		t.Fatalf("fotografové: %q", f)
	}

	// Odkaz na složku není ID fotky; holá ID oddělená řádky ano
	if ids := parseDriveIDs("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345"); len(ids) != 0 {
		t.Fatalf("odkaz na složku dal ID %v", ids)
	}
	if ids := parseDriveIDs(idA + "\n" + idB); len(ids) != 2 {
		t.Fatalf("holá ID: %v", ids)
	}
}

func TestOpravyBezMazani(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	odkazC := "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view"
	a.AddModelka(Modelka{Jmeno: "Anna", Tags: "blond, zrzka"})
	a.AddModelka(Modelka{Jmeno: "Bára", NarozeniDatum: "1990-01-01", Tags: "Blond"})
	a.AddModelka(Modelka{Jmeno: "Anna Duplicitní", Narodnost: "USA", DalsiJmena: "Annie"})
	anna, bara, dup := 1, 2, 3
	a.AddBulkPhotos(anna, "Spolu", "Pictorial", odkazA+" "+odkazB)
	a.SetPopisAlba(anna, "Spolu", "Pictorial", "Společný pictorial", "Fotograf X")
	a.SetVydaniAlba(anna, "Spolu", "Pictorial", "2010-05")

	// Sdílené album: ukáže se i v profilu druhé modelky, počítá se jí a dá se najít podle textu
	if !a.PridatModelkuKAlbu(anna, "Spolu", "Pictorial", bara) || a.PridatModelkuKAlbu(anna, "Spolu", "Pictorial", anna) {
		t.Fatal("přidání další modelky k albu")
	}
	fotkyBary := a.GetFotografieModelky(bara)
	if len(fotkyBary) != 2 || fotkyBary[0].ModelkaID != anna || len(fotkyBary[0].DalsiModelky) != 1 || fotkyBary[0].DalsiModelky[0].Jmeno != "Bára" {
		t.Fatalf("sdílené album v profilu druhé modelky: %+v", fotkyBary)
	}
	if m := a.GetModelky("spolecny")[0]; len(a.GetModelky("spolecny")) != 2 || a.GetModelky("Bára")[0].PocetFotek != 2 || len(a.GetModelky("Bára")[0].Vydani) != 1 {
		t.Fatalf("sdílené album v počtech a hledání: %+v", m)
	}
	// Vyprázdnění textu sdílené album nerozbije
	a.SetPopisAlba(anna, "Spolu", "Pictorial", "", "")
	if len(a.GetFotografieModelky(bara)) != 2 {
		t.Fatal("vyprázdnění textu zrušilo sdílení")
	}
	a.SetPopisAlba(anna, "Spolu", "Pictorial", "Společný pictorial", "Fotograf X")

	// Export zapíše sdílené album jednou, import vazbu obnoví
	export, err := a.exportovat()
	if err != nil || strings.Count(string(export), "nazev: Spolu") != 1 || !strings.Contains(string(export), "dalsi_modelky:") {
		t.Fatalf("export sdíleného alba (%v):\n%s", err, export)
	}
	b := novaTestovaciApp(t, nil)
	if v := b.importovat(export); v.Selhalo != "" || len(b.GetFotografieModelky(b.GetModelky("Bára")[0].ID)) != 2 {
		t.Fatalf("import sdíleného alba: %+v", v)
	}

	// Přesun alba k jiné modelce: srdíčka i text zůstanou; kolize se stejnojmenným albem se odmítne
	a.SetHodnoceniFotek([]int{a.GetFotografieModelky(anna)[0].ID}, 5)
	if chyba := a.PresunoutAlbum(anna, "Spolu", "Pictorial", dup); chyba != "" {
		t.Fatal(chyba)
	}
	presunute := a.GetFotografieModelky(dup)
	if len(presunute) != 2 || presunute[0].Hodnoceni != 5 || presunute[0].Popis != "Společný pictorial" || len(a.GetFotografieModelky(bara)) != 2 {
		t.Fatalf("po přesunu alba: %+v", presunute)
	}
	a.AddBulkPhotos(anna, "Spolu", "Pictorial", odkazC)
	if a.PresunoutAlbum(anna, "Spolu", "Pictorial", dup) == "" {
		t.Fatal("přesun na stejnojmenné album prošel")
	}

	// Sloučení alb: duplicitní soubor se nezdvojí, text cílového alba má přednost
	a.AddBulkPhotos(dup, "Spolu překlep", "Pictorial", odkazA+" "+odkazC)
	a.SetPopisAlba(dup, "Spolu překlep", "Pictorial", "jiný text", "")
	if chyba := a.SloucitAlba(dup, "Spolu překlep", "Pictorial", "Spolu", "Pictorial"); chyba != "" {
		t.Fatal(chyba)
	}
	slouceno := a.GetFotografieModelky(dup)
	if len(slouceno) != 3 || slouceno[2].Vydani != "2010-05" || slouceno[0].Popis != "Společný pictorial" {
		t.Fatalf("po sloučení alb: %+v", slouceno)
	}

	// Přesun vybraných fotek do jiného alba
	if v := a.PresunoutFotky([]int{slouceno[2].ID}, anna, "Spolu", "Pictorial"); v.Presunuto != 0 || v.Duplicitni != 1 {
		t.Fatalf("přesun duplicitní fotky: %+v", v)
	}
	if v := a.PresunoutFotky([]int{slouceno[0].ID}, anna, "Nové album", "Pictorial"); v.Presunuto != 1 {
		t.Fatalf("přesun do nového alba: %+v", v)
	}

	// Zpět po odebrání: fotka se vrátí i se srdíčky a textem alba, který zmizel s poslední fotkou
	jedina := a.GetFotografieModelky(anna)
	var nove Fotografie
	for _, f := range jedina {
		if f.Album == "Nové album" {
			nove = f
		}
	}
	a.SetPopisAlba(anna, "Nové album", "Pictorial", "text nového", "")
	nove = func() Fotografie {
		for _, f := range a.GetFotografieModelky(anna) {
			if f.ID == nove.ID {
				return f
			}
		}
		return nove
	}()
	a.DeleteFotografie(nove.ID)
	if n := a.ObnovitFotky([]ObnovaFotky{{ModelkaID: anna, Album: nove.Album, Typ: nove.Typ, DriveID: nove.DriveID, Hodnoceni: nove.Hodnoceni, Popis: nove.Popis, Fotograf: nove.Fotograf}}); n != 1 {
		t.Fatalf("vráceno %d fotek", n)
	}
	for _, f := range a.GetFotografieModelky(anna) {
		if f.Album == "Nové album" && (f.Hodnoceni != 5 || f.Popis != "text nového") {
			t.Fatalf("vrácená fotka: %+v", f)
		}
	}

	// Sloučení modelek: alba přejdou, prázdné údaje se doplní, jméno se přidá mezi pseudonymy
	if chyba := a.SloucitModelky(anna, dup); chyba != "" {
		t.Fatal(chyba)
	}
	if len(a.GetModelky("")) != 2 {
		t.Fatal("zdrojová modelka po sloučení zůstala")
	}
	m := a.GetModelky("Anna")[0]
	if m.Narodnost != "USA" || !strings.Contains(m.DalsiJmena, "Anna Duplicitní") || !strings.Contains(m.DalsiJmena, "Annie") {
		t.Fatalf("modelka po sloučení: %+v", m)
	}
	// Stejnojmenné album „Spolu" se sloučilo, společný soubor C v něm zůstal jednou
	if fotky := a.GetFotografieModelky(anna); len(fotky) != 3 {
		t.Fatalf("po sloučení modelek má %d fotek", len(fotky))
	}

	// Přejmenování fotografa a tagu v celé sbírce
	if a.PrejmenovatFotografa("fotograf x", "Fotograf Y") != 1 || a.GetFotografove()[0] != "Fotograf Y" {
		t.Fatalf("fotografové: %v", a.GetFotografove())
	}
	if n := a.PrejmenovatTag("blond", "Blondýna"); n != 2 || a.GetModelky("Bára")[0].Tags != "Blondýna" || !strings.HasPrefix(a.GetModelky("Anna")[0].Tags, "Blondýna") {
		t.Fatalf("tagy po přejmenování (%d): %v", n, a.GetTagy())
	}

	// Smazání modelky uklidí i její vazby na alba
	a.DeleteModelka(bara)
	var vazeb int
	a.db.QueryRow("SELECT COUNT(*) FROM alba_modelky").Scan(&vazeb)
	if vazeb != 0 {
		t.Fatalf("po smazání modelky zůstalo %d vazeb", vazeb)
	}
}

func TestImportVJedneTransakci(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Stávající"})
	soubor := []byte("modelky:\n  - jmeno: První\n  - jmeno: Druhá\n  - jmeno: Stávající\n    narodnost: Kanada\n")

	pocet := 0
	poImportuModelky = func() error {
		if pocet++; pocet == 2 {
			return fmt.Errorf("simulovaná chyba")
		}
		return nil
	}
	defer func() { poImportuModelky = nil }()

	if v := a.importovat(soubor); v.Selhalo == "" {
		t.Fatal("import se simulovanou chybou neohlásil selhání")
	}
	if modelky := a.GetModelky(""); len(modelky) != 1 || modelky[0].Narodnost != "" {
		t.Fatalf("po neúspěšném importu zůstala část změn: %+v", modelky)
	}
	poImportuModelky = nil
	if v := a.importovat(soubor); v.Selhalo != "" || len(a.GetModelky("")) != 3 {
		t.Fatalf("import bez chyby: %+v", v)
	}
}

func TestOpakovanaNedostupnost(t *testing.T) {
	a := novaTestovaciApp(t, map[string]int{idB: souborNedostupny})
	a.AddModelka(Modelka{Jmeno: "Modelka"})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	a.db.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id) VALUES (1, 'Album', 'Pictorial', ?)", idB)

	// Poprvé nedostupná: hlásí se, ale odebrat se zatím nenabízí
	k := a.ZkontrolovatDavku()
	if len(k.Nedostupne) != 1 || k.Nedostupne[0].Opakovane || !k.Davka {
		t.Fatalf("první kontrola: %+v", k)
	}
	// Nedostupná i v jiný den: teprve teď opakovaně
	a.db.Exec("UPDATE fotografie SET nedostupne_od = '2020-01-01' WHERE drive_file_id = ?", idB)
	if k := a.ZkontrolovatSoubory(); len(k.Nedostupne) != 1 || !k.Nedostupne[0].Opakovane {
		t.Fatalf("opakovaná kontrola: %+v", k)
	}
	// Znovu dostupná se z nedostupných vyřadí
	overitSoubor = func(string) int { return souborDostupny }
	a.ZkontrolovatDavku()
	var nedostupnych int
	a.db.QueryRow("SELECT COUNT(*) FROM fotografie WHERE nedostupne_od IS NOT NULL").Scan(&nedostupnych)
	if nedostupnych != 0 {
		t.Fatal("dostupná fotka zůstala označená jako nedostupná")
	}
}

func TestEtapa4Backend(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Blondýna Nováková", VlasyBarva: "Blond", Narodnost: "Česká", NarozeniDatum: "1975-03-01", Poznamka: "zrzavá kamarádka"})
	a.AddModelka(Modelka{Jmeno: "Zrzka", VlasyBarva: "Zrzavá", Poznamka: "blond paruka"})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	a.SetPopisAlba(1, "Album", "Pictorial", "", "Arny Freytag")
	a.SetVydaniAlba(1, "Album", "Pictorial", "1999-04-CZ")
	a.AddBulkPhotos(2, "1975-06", "Centerfold", odkazB)

	// Cílené hledání: hodnota jen v daném údaji; obyčejné slovo všude
	for dotaz, cekano := range map[string]int{
		"blond": 2, "vlasy:blond": 1, "vlasy:zrzava": 1, `fotograf:"arny freytag"`: 1, "fotograf:freytag": 1,
		"rok:1975": 1, "rok:1999": 1, "narozena:1975": 1, "edice:cz": 1, "edice:us": 1, "vlasy:blond rok:1975": 0,
		"neznamepole:blond": 0,
	} {
		if n := len(a.GetModelky(dotaz)); n != cekano {
			t.Errorf("hledání %q našlo %d, čekáno %d", dotaz, n, cekano)
		}
	}

	// Netýká se: položka zmizí z přehledu, se skrytými se ukáže s příznakem
	if len(a.GetPrehled(false).BezCenterfoldu) != 1 {
		t.Fatal("modelka bez centerfoldu chybí v přehledu")
	}
	a.SetNetykaSe(1, "centerfold", true)
	a.SetNetykaSe(1, "titulni", true)
	a.SetNetykaSeAlba(1, "Album", "Pictorial", "text", true)
	p := a.GetPrehled(false)
	if len(p.BezCenterfoldu) != 0 || len(p.AlbaBezPopisu) != 0 {
		t.Fatalf("označené „netýká se“ zůstalo v přehledu: %+v", p)
	}
	if s := a.GetPrehled(true); len(s.BezCenterfoldu) != 1 || !s.BezCenterfoldu[0].NetykaSe || !s.AlbaBezPopisu[0].NetykaSe {
		t.Fatalf("přehled se skrytými: %+v", s)
	}
	if m := a.GetModelky("Blondýna")[0]; m.NetykaSe != "centerfold,titulni" {
		t.Fatalf("netýká se u modelky: %q", m.NetykaSe)
	}
	a.SetNetykaSe(1, "centerfold", false)
	if len(a.GetPrehled(false).BezCenterfoldu) != 1 {
		t.Fatal("zrušené označení se neprojevilo")
	}

	// Kalendář: jeden řádek na vydání s náhledem a jménem z centerfoldu
	k := a.GetKalendar()
	if len(k) != 2 || k[0].Vydani != "1975-06" || !k[0].Centerfold || k[0].Modelka != "Zrzka" || !strings.Contains(k[0].Nahled, idB) || !k[1].Pictorial {
		t.Fatalf("kalendář: %+v", k)
	}

	// Šablona adresy obrázků: jedno místo, změna se projeví všude; bez {id} se odmítne
	if a.GetSablonaObrazku() != vychoziSablonaObrazku || a.SetSablonaObrazku("https://jinde/obrazek") {
		t.Fatal("šablona bez {id} prošla nebo výchozí nesedí")
	}
	if !a.SetSablonaObrazku("https://drive.google.com/thumbnail?id={id}&sz={velikost}") {
		t.Fatal("platná šablona se neuložila")
	}
	if f := a.GetFotografieModelky(1)[0]; f.URL != "https://drive.google.com/thumbnail?id="+idA+"&sz={velikost}" || f.DriveID != idA {
		t.Fatalf("adresa podle šablony: %s", f.URL)
	}
	a.SetSablonaObrazku("")
	if a.GetSablonaObrazku() != vychoziSablonaObrazku {
		t.Fatal("prázdná šablona nevrátila výchozí")
	}
}

// Verze v programu, ve wails.json, ve frontend/package.json a v changelogu musí souhlasit
func TestVerzeSouhlasi(t *testing.T) {
	cisla := strings.TrimSuffix(Verze, "-dev")
	if !regexp.MustCompile(`^\d+\.\d+\.\d+$`).MatchString(cisla) {
		t.Fatalf("verze %q není MAJOR.MINOR.PATCH", Verze)
	}
	precist := func(cesta string) string {
		data, err := os.ReadFile(cesta)
		if err != nil {
			t.Fatal(err)
		}
		return string(data)
	}
	if !strings.Contains(precist("wails.json"), `"productVersion": "`+cisla+`"`) {
		t.Errorf("wails.json nemá productVersion %s", cisla)
	}
	if !strings.Contains(precist("frontend/package.json"), `"version": "`+cisla+`"`) {
		t.Errorf("frontend/package.json nemá version %s", cisla)
	}
	changelog := precist("CHANGELOG.md")
	if !strings.Contains(changelog, "## ["+cisla+"]") {
		t.Errorf("CHANGELOG.md nemá oddíl pro %s", cisla)
	}
	// Vydaná verze (bez -dev) musí mít v changelogu datum
	if !strings.HasSuffix(Verze, "-dev") && !regexp.MustCompile(`## \[`+regexp.QuoteMeta(cisla)+`\] – \d{4}-\d{2}-\d{2}`).MatchString(changelog) {
		t.Errorf("vydaná verze %s nemá v CHANGELOG.md datum", cisla)
	}
}

func TestProhlizeniNapricSbirkou(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	odkazC := "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view"
	a.AddModelka(Modelka{Jmeno: "Bára"})
	a.AddModelka(Modelka{Jmeno: "Adéla"})
	a.AddBulkPhotos(1, "1975-03", "Centerfold", odkazA)
	a.AddBulkPhotos(1, "Pictorial", "Pictorial", odkazB+" "+odkazC)
	a.SetVydaniAlba(1, "Pictorial", "Pictorial", "1975")
	a.AddBulkPhotos(2, "CZ pictorial", "Pictorial", odkazA)
	a.SetVydaniAlba(2, "CZ pictorial", "Pictorial", "1975-06-CZ")
	a.AddCover("1975-03", odkazC)
	a.AddCover("1976-01", odkazB)

	// Ročník: čísla po měsících i pictorial jen k ročníku; jiná edice a jiný rok ne
	if n := len(a.GetVydani("1975")); n != 4 {
		t.Fatalf("ročník 1975 US má %d fotek, čekám 4", n)
	}
	if cz := a.GetVydani("1975-CZ"); len(cz) != 1 || cz[0].JmenoModelky != "Adéla" {
		t.Fatalf("ročník 1975 CZ: %+v", cz)
	}
	if n := len(a.GetVydani("1975-03")); n != 2 {
		t.Fatalf("číslo 1975-03 má %d fotek", n)
	}

	// Nejlepší fotky: jen s dost srdíčky, napříč modelkami
	fotky := a.GetFotografieModelky(1)
	a.SetHodnoceniFotek([]int{fotky[0].ID}, 5)
	a.SetHodnoceniFotek([]int{fotky[1].ID}, 3)
	a.SetHodnoceniFotek([]int{a.GetFotografieModelky(2)[0].ID}, 4)
	if n := len(a.GetNejlepsiFotky(4)); n != 2 {
		t.Fatalf("fotek se 4+ srdíčky: %d", n)
	}
	if nej := a.GetNejlepsiFotky(1); len(nej) != 3 || nej[0].JmenoModelky != "Adéla" {
		t.Fatalf("nejlepší po modelkách: %+v", nej)
	}

	// Fotograf: jeho alba napříč modelkami
	a.SetPopisAlba(1, "Pictorial", "Pictorial", "", "Arny Freytag")
	a.SetPopisAlba(2, "CZ pictorial", "Pictorial", "", "arny  freytag")
	a.SetPopisAlba(2, "CZ pictorial", "Pictorial", "", "Arny Freytag")
	if alba := a.GetAlbaFotografa("ARNY FREYTAG"); len(alba) != 3 {
		t.Fatalf("alba fotografa: %d fotek", len(alba))
	}
}
