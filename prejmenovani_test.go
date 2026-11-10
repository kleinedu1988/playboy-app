package main

import (
	"os"
	"path/filepath"
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
