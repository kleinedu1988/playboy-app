package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"playboy-app/internal/nahledy"
)

const idNahleduA = "1NBcNnN7_8cRTDcAvZYHTwSD7XqGDx-cd"

var jpegNahledu = append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 2000)...)

// Adresy pro okno: přes mezipaměť jen holé ID (a {id} šablony fronty); kontrola souborů jde vždy na Disk
func TestAdresaObrazkuPresMezipamet(t *testing.T) {
	nahledyPresMezipamet.Store(true)
	t.Cleanup(func() { nahledyPresMezipamet.Store(false) })
	if a := adresaObrazku(idNahleduA); a != "/nahled/"+idNahleduA+"/{velikost}" {
		t.Fatalf("adresa: %s", a)
	}
	if a := adresaObrazku("{id}"); a != "/nahled/{id}/{velikost}" {
		t.Fatalf("šablona: %s", a)
	}
	if a := adresaObrazku("kratke"); !strings.HasPrefix(a, "https://") {
		t.Fatalf("neplatné ID má jít na Disk: %s", a)
	}
	if a := adresaNahleduNaDisku(idNahleduA, "w400"); a != "https://lh3.googleusercontent.com/d/"+idNahleduA+"=w400" {
		t.Fatalf("na Disku: %s", a)
	}
}

// Úklid po startu nechá náhledy fotek a titulních fotek sbírky, smaže náhledy smazaných fotek
func TestUklidNahleduAplikace(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka", CoverID: odkazB})
	a.AddBulkPhotos(1, "Album", "Pictorial", odkazA)
	m := nahledy.Nova(filepath.Join(t.TempDir(), "nahledy"), func(id, vel string) string { return "" })
	a.nahledy = m
	idA, idB, ciziID := "AAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
	for _, id := range []string{idA, idB, ciziID} {
		m.Ulozit(id, "w400", jpegNahledu)
	}
	a.uklidNahledu()
	for id, zustat := range map[string]bool{idA: true, idB: true, ciziID: false} {
		if _, err := os.Stat(m.Cesta(id, "w400")); (err == nil) != zustat {
			t.Errorf("%s: zůstal %v", id, err == nil)
		}
	}
	// Změna šablony adres smaže náhledy (můžou být z jiného zdroje)
	if chyba := a.SetSablonaObrazku("https://jinde.example/{id}/{velikost}"); chyba != "" {
		t.Fatal(chyba)
	}
	if _, err := os.Stat(m.Cesta(idA, "w400")); !os.IsNotExist(err) {
		t.Fatal("po změně šablony náhled zůstal")
	}
	a.SetSablonaObrazku("")
}

// Seznam k předstažení: titulní fotky před plakáty, bez opakování
func TestPolozkyKPredstazeni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Modelka", CoverID: odkazB})
	a.AddBulkPhotos(1, "1990-05", "Centerfold", odkazA)
	a.AddBulkPhotos(1, "Album", "Pictorial", "https://drive.google.com/file/d/CCCCCCCCCCCCCCCCCCCCCCCCCCCCC/view")
	p := a.polozkyKPredstazeni()
	if len(p) != 2 || p[0] != (nahledy.Polozka{ID: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBB", Velikost: "w400"}) || p[1] != (nahledy.Polozka{ID: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAA", Velikost: "w600"}) {
		t.Fatalf("%+v", p)
	}
	if a.SpustitStahovaniNahledu() {
		t.Fatal("bez mezipaměti náhledů se stahování nemá spustit")
	}
}
