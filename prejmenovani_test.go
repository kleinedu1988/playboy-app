package main

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPresunStarychSlozek(t *testing.T) {
	data, mezipamet := t.TempDir(), t.TempDir()
	t.Setenv("XDG_DATA_HOME", data)
	t.Setenv("XDG_CACHE_HOME", mezipamet)
	puvodni := beziStaryProgram
	defer func() { beziStaryProgram = puvodni }()

	stara := filepath.Join(data, staraSlozkaProgramu)
	os.MkdirAll(filepath.Join(stara, "localstorage"), 0o700)
	os.WriteFile(filepath.Join(stara, "playboy.db"), []byte("db"), 0o600)
	os.MkdirAll(filepath.Join(mezipamet, staraSlozkaProgramu, "nahledy"), 0o700)

	// Dokud běží stará verze, nic se nepřesouvá a data jsou dál ve staré složce
	beziStaryProgram = func() bool { return true }
	presunoutStareSlozky()
	if slozkaDat() != stara {
		t.Fatalf("při běžící staré verzi má zůstat stará složka, je %s", slozkaDat())
	}

	beziStaryProgram = func() bool { return false }
	if z := presunoutStareSlozky(); len(z) != 2 {
		t.Fatalf("mají se přesunout data i mezipaměť: %v", z)
	}
	nova := filepath.Join(data, slozkaProgramu)
	if slozkaDat() != nova {
		t.Fatalf("slozkaDat %s, čekáno %s", slozkaDat(), nova)
	}
	if b, err := os.ReadFile(filepath.Join(nova, "playboy.db")); err != nil || string(b) != "db" {
		t.Fatalf("databáze se nepřesunula: %v", err)
	}
	if !existuje(filepath.Join(nova, "localstorage")) || !existuje(filepath.Join(mezipamet, slozkaProgramu, "nahledy")) {
		t.Fatal("chybí localstorage nebo mezipaměť náhledů")
	}
	// Podruhé (nová složka už je) se nic neděje, ani když se stará znovu objeví
	os.MkdirAll(stara, 0o700)
	if z := presunoutStareSlozky(); len(z) != 0 || slozkaDat() != nova {
		t.Fatalf("druhý start: %v, %s", z, slozkaDat())
	}
}

// Přejmenování souborů sbírky (0.02.078): playboy.db s WAL a databáze učení se přejmenují na katalog*.db,
// předtím vznikne záloha; na starých místech zůstanou odkazy (starší verze otevře stejnou sbírku); stará záloha
// playboy-… jde dál vypsat a obnovit a zálohy obou předpon se řadí podle času
func TestPrejmenovaniSouboruSbirky(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	t.Chdir(t.TempDir())
	// Sbírka jako před 0.02.078: založit, pak soubory vrátit na stará jména
	puvodni := NewApp()
	puvodni.startup(context.Background())
	puvodni.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	puvodni.GetPrehled(false)
	puvodni.shutdown()
	os.RemoveAll(slozkaZaloh())
	stara := filepath.Join(slozkaDat(), "playboy.db")
	for _, d := range [][2]string{{"katalog.db", "playboy.db"}, {"katalog-uceni.db", "playboy-uceni.db"}} {
		if err := os.Rename(filepath.Join(slozkaDat(), d[0]), filepath.Join(slozkaDat(), d[1])); err != nil {
			t.Fatal(err)
		}
	}
	uceni, _ := sql.Open("sqlite", filepath.Join(slozkaDat(), "playboy-uceni.db"))
	uceni.Exec(`CREATE TABLE u (x INTEGER); INSERT INTO u VALUES (7)`)
	uceni.Close()

	a := NewApp()
	a.startup(context.Background())
	defer a.shutdown()
	if a.cestaDb != cestaSbirky() || a.chybaStartu != "" {
		t.Fatalf("otevřeno %s, chyba %q", a.cestaDb, a.chybaStartu)
	}
	if m := a.GetModelky(""); len(m) != 1 || m[0].Jmeno != "Anna" {
		t.Fatalf("modelky po přejmenování: %+v", m)
	}
	for stary, novy := range map[string]string{"playboy.db": "katalog.db", "playboy-uceni.db": "katalog-uceni.db"} {
		if cil, err := os.Readlink(filepath.Join(slozkaDat(), stary)); err != nil || cil != novy {
			t.Fatalf("odkaz %s: %q %v", stary, cil, err)
		}
	}
	var x int
	u, _ := sql.Open("sqlite", filepath.Join(slozkaDat(), "katalog-uceni.db"))
	if err := u.QueryRow(`SELECT x FROM u`).Scan(&x); err != nil || x != 7 {
		t.Fatalf("databáze učení: %d %v", x, err)
	}
	u.Close()
	// Starší verze přes odkaz vidí stejnou sbírku
	pres, _ := sql.Open("sqlite", stara)
	var jmeno string
	if err := pres.QueryRow(`SELECT jmeno FROM modelky`).Scan(&jmeno); err != nil || jmeno != "Anna" {
		t.Fatalf("přes odkaz: %q %v", jmeno, err)
	}
	pres.Close()

	// Záloha před přejmenováním a stará záloha playboy-… v seznamu, od nejnovější
	pred := ""
	for _, z := range a.SeznamZaloh() {
		if z.Duvod == "pred-prejmenovanim" && z.Modelek == 1 && strings.HasPrefix(z.Soubor, "katalog-") {
			pred = z.Soubor
		}
	}
	if pred == "" {
		t.Fatalf("chybí záloha před přejmenováním: %+v", a.SeznamZaloh())
	}
	kopirovatSoubor(filepath.Join(slozkaZaloh(), pred), filepath.Join(slozkaZaloh(), "playboy-2020-01-01-120000.000-denni.db"))
	if err := a.zalohovat("test"); err != nil {
		t.Fatal(err)
	}
	zalohy := a.SeznamZaloh()
	if len(zalohy) != 4 || !strings.HasPrefix(zalohy[0].Soubor, "katalog-") || zalohy[0].Duvod != "test" || zalohy[3].Soubor != "playboy-2020-01-01-120000.000-denni.db" {
		t.Fatalf("pořadí záloh: %+v", zalohy)
	}
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	if chyba := a.ObnovitZalohu("playboy-2020-01-01-120000.000-denni.db"); chyba != "" {
		t.Fatalf("obnovení staré zálohy: %s", chyba)
	}
	if m := a.GetModelky(""); len(m) != 1 {
		t.Fatalf("po obnovení: %+v", m)
	}
	// Odkaz zůstal odkazem (obnovení zapisuje do katalog.db)
	if info, err := os.Lstat(stara); err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("playboy.db po obnovení: %v %v", info, err)
	}
}
