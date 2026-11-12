package main

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Nová verze aplikace pro telefon na Disk (0.02.088): bez sestaveného APK nic, stejná verze jen jednou, novější
// nahradí starší; zálohy a balíček zůstanou
func TestAplikaceTelefonuNaDisk(t *testing.T) {
	klon := t.TempDir()
	os.MkdirAll(filepath.Join(klon, ".git"), 0o700)
	vystup := filepath.Join(klon, "mobil", "vystup")
	puvodniZdroj, puvodniSlozka, puvodniAPI := slozkaZdroje, slozkaNastaveniGoogle, adresaDriveAPI
	t.Cleanup(func() { slozkaZdroje, slozkaNastaveniGoogle, adresaDriveAPI = puvodniZdroj, puvodniSlozka, puvodniAPI })
	slozkaZdroje = klon
	nastaveni := t.TempDir()
	slozkaNastaveniGoogle = func() string { return nastaveni }
	disk := &falesnyDisk{soubory: map[string][2]string{"z1": {"katalog-2026-11-12-120000.000-denni.db", "x"}}, relace: map[string]string{}}
	server := httptest.NewServer(disk)
	defer server.Close()
	adresaDriveAPI = server.URL
	ulozitTokenGoogle(&tokenGoogle{Obnovovaci: "obnova", Pristupovy: "pristup", Platnost: time.Now().Add(time.Hour)})
	a := &App{}

	apk := func() []string {
		var v []string
		for _, s := range disk.soubory {
			if strings.HasPrefix(s[0], predponaAplikaceTelefonu) {
				v = append(v, s[0]+"="+s[1])
			}
		}
		return v
	}
	if err := a.nahratAplikaciTelefonu(t.Context()); err != nil || len(apk()) != 0 {
		t.Fatalf("bez sestaveného APK: %v %v", err, apk())
	}
	os.MkdirAll(vystup, 0o700)
	sestavit := func(verze, obsah string) {
		os.WriteFile(filepath.Join(vystup, "pinup-katalog.apk"), []byte(obsah), 0o600)
		os.WriteFile(filepath.Join(vystup, "pinup-katalog.verze"), []byte(verze+"\n"), 0o600)
	}
	sestavit("0.2.88", "apk88")
	for range 2 {
		if err := a.nahratAplikaciTelefonu(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	if v := apk(); len(v) != 1 || v[0] != "telefon-aplikace-0.2.88.apk=apk88" {
		t.Fatalf("po první verzi: %v", v)
	}
	sestavit("0.2.89", "apk89")
	if err := a.nahratAplikaciTelefonu(t.Context()); err != nil {
		t.Fatal(err)
	}
	if v := apk(); len(v) != 1 || v[0] != "telefon-aplikace-0.2.89.apk=apk89" {
		t.Fatalf("po novější verzi: %v", v)
	}
	if _, ok := disk.soubory["z1"]; !ok || len(disk.soubory) != 2 {
		t.Fatalf("záloha zmizela nebo něco navíc: %v", len(disk.soubory))
	}
	// Podezřelá verze (cesta) se nenahraje
	sestavit("../x", "zlé")
	if err := a.nahratAplikaciTelefonu(t.Context()); err != nil || len(apk()) != 1 {
		t.Fatalf("podezřelá verze: %v %v", err, apk())
	}
}
