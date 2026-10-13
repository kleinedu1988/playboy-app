package main

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

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

	m := Modelka{Jmeno: "Test O'Hara", ObvodHrudnikCm: 86, ObvodPasCm: 61, ObvodBokyCm: 89, Tetovani: true, CoverID: odkazA}
	if !a.AddModelka(m) {
		t.Fatal("AddModelka selhalo")
	}

	// Apostrof ve hledání nesmí rozbít dotaz
	nalezene := a.GetModelky("O'H")
	if len(nalezene) != 1 {
		t.Fatalf("hledání vrátilo %d modelek, chci 1", len(nalezene))
	}
	ulozena := nalezene[0]
	if ulozena.Miry != "86-61-89" || !ulozena.Tetovani || ulozena.CoverID != idA {
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
	if covery[0].Album != "1999-06" || covery[0].URL != "https://lh3.googleusercontent.com/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC" {
		t.Fatalf("úprava coveru s novým odkazem: %+v", covery[0])
	}
	if covery[1].Album != "1999-05" || covery[1].URL != "https://lh3.googleusercontent.com/d/"+idB {
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
