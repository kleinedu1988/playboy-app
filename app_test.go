package main

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
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
