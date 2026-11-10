package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"pinup-katalog/internal/nahledy"
)

// Kritérium: podklady čísla mají první fotku obálky před centerfoldem, jména podle typu alba a stav výtisku;
// katalog se zapíše do nové složky s index.html a náhledy z mezipaměti, chybějící se jen spočítají a starší
// katalog téhož dne se nepřepíše
func TestKapesniKatalog(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.nahledy = nahledy.Nova(t.TempDir(), func(id, velikost string) string { return "" })
	a.AddModelka(Modelka{Jmeno: "Playmate", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Obálková", Tetovani: -1, Piercing: -1})
	pm, ob := idModelky(t, a, "Playmate"), idModelky(t, a, "Obálková")
	a.AddBulkPhotos(pm, "2012-03-CZ", "Centerfold", odkazA)
	a.AddCover("2012-03-CZ", odkazB)
	a.SetVydaniInfo("2012-03-CZ", "", "mam", ob, "")
	a.SetStavVydani("2013-01-CZ", "shanim")

	p := a.GetPodkladyKatalogu()
	if len(p) != 2 || p[0].Vydani != "2012-03-CZ" || p[1].Vydani != "2013-01-CZ" {
		t.Fatalf("podklady: %+v", p)
	}
	if p[0].DriveID != idB || p[0].Stav != "mam" || strings.Join(p[0].Playmate, ",") != "Playmate" || strings.Join(p[0].Obalka, ",") != "Obálková" {
		t.Fatalf("číslo: %+v", p[0])
	}
	if p[1].Stav != "shanim" || p[1].DriveID != "" {
		t.Fatalf("sháněné: %+v", p[1])
	}

	// V mezipaměti je jen obálka
	cesta := a.nahledy.Cesta(idB, "w400")
	os.MkdirAll(filepath.Dir(cesta), 0o755)
	os.WriteFile(cesta, []byte("jpeg"), 0o644)
	if n := a.GetNahledyKatalogu([]string{idB, idA, idB, ""}); n != (NahledyKatalogu{Ulozenych: 1, Chybi: 1, Bajtu: 4}) {
		t.Fatalf("náhledy: %+v", n)
	}
	kam := t.TempDir()
	den := time.Date(2026, 11, 10, 12, 0, 0, 0, time.Local)
	v := a.zapsatKatalog(kam, "<!doctype html>katalog", []string{idB, idA}, den)
	if v.Chyba != "" || v.Slozka != filepath.Join(kam, "playboy-katalog-2026-11-10") || v.Nahledu != 1 || v.Chybi != 1 {
		t.Fatalf("zápis: %+v", v)
	}
	if b, _ := os.ReadFile(filepath.Join(v.Slozka, "n", idB+".jpg")); string(b) != "jpeg" {
		t.Fatal("náhled se nezkopíroval")
	}
	if b, _ := os.ReadFile(filepath.Join(v.Slozka, "index.html")); string(b) != "<!doctype html>katalog" {
		t.Fatal("index.html")
	}
	if druhy := a.zapsatKatalog(kam, "x", nil, den); druhy.Slozka != filepath.Join(kam, "playboy-katalog-2026-11-10-2") {
		t.Fatalf("druhý katalog téhož dne: %+v", druhy)
	}
	if a.zapsatKatalog(kam, "", nil, den).Chyba == "" {
		t.Fatal("prázdný katalog se zapsal")
	}
}
