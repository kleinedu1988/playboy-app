package main

import (
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"playboy-app/internal/obsah"
)

// Podobnost z obsahu: střed fotek jen s aspoň třemi vektory, kosinová podobnost středů, společní fotografové
// i s jiným zápisem jména a ze sdíleného alba; po přidání fotek se středy spočítají znovu
func TestPodobnostObsahu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Anna", "Bára", "Cecílie", "Dana"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
	}
	anna, bara, cecilie, dana := idModelky(t, a, "Anna"), idModelky(t, a, "Bára"), idModelky(t, a, "Cecílie"), idModelky(t, a, "Dana")
	soubor := func(znak string, i int) string { return strings.Repeat(znak, 28) + string(rune('0'+i)) }
	fotky := func(znak string, n int) string {
		ids := []string{}
		for i := 0; i < n; i++ {
			ids = append(ids, soubor(znak, i))
		}
		return strings.Join(ids, " ")
	}
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", fotky("A", 3))
	a.AddBulkPhotos(bara, "Studio", "Pictorial", fotky("B", 3))
	a.AddBulkPhotos(cecilie, "Zahrada", "Pictorial", fotky("C", 3))
	a.AddBulkPhotos(dana, "Les", "Pictorial", fotky("D", 2))
	a.SetPopisAlba(anna, "Pláž", "Pictorial", "", "Arny Freytag, Pompeo Posar")
	a.SetPopisAlba(cecilie, "Zahrada", "Pictorial", "", "arny freytag")
	a.SetPopisAlba(bara, "Studio", "Pictorial", "", "Stephen Wayda")

	slozka := a.slozkaObsahu()
	os.MkdirAll(slozka, 0o700)
	for _, s := range obsah.Soubory {
		os.WriteFile(filepath.Join(slozka, s.Nazev), []byte("x"), 0o600)
	}
	v := obsah.NoveVektory()
	for i := 0; i < 3; i++ {
		v.Pridat(soubor("A", i), vektorObsahu(1, 0))
		v.Pridat(soubor("B", i), vektorObsahu(0.8, 0.6))
		v.Pridat(soubor("C", i), vektorObsahu(0, 1))
	}
	for i := 0; i < 2; i++ {
		v.Pridat(soubor("D", i), vektorObsahu(1, 0))
	}
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}

	p := a.GetPodobnostObsahu(anna)
	if p.Fotek != 3 {
		t.Fatalf("fotek s vektorem %d, chci 3", p.Fotek)
	}
	if math.Abs(p.NaFotkach[bara]-0.8) > 1e-3 || math.Abs(p.NaFotkach[cecilie]) > 1e-3 {
		t.Fatalf("podobnost středů %+v", p.NaFotkach)
	}
	if _, ma := p.NaFotkach[dana]; ma {
		t.Fatal("Dana má jen 2 fotky s vektorem, střed se jí počítat nemá")
	}
	if f := p.Fotografove[cecilie]; len(f) != 1 || f[0] != "Arny Freytag" {
		t.Fatalf("společný fotograf s Cecílií %v", f)
	}
	if _, ma := p.Fotografove[bara]; ma {
		t.Fatal("Bára nemá s Annou společného fotografa")
	}
	if d := a.GetPodobnostObsahu(dana); d.Fotek != 2 || len(d.NaFotkach) != 0 {
		t.Fatalf("modelka s málo fotkami: %+v", d)
	}

	// Sdílené album: Dana je i v albu Báry, fotky a fotograf alba se počítají i jí
	alba := a.GetFotografieModelky(bara)
	if len(alba) == 0 || alba[0].AlbumID == 0 {
		t.Fatal("album Báry")
	}
	if _, err := a.db.Exec(`INSERT INTO alba_modelky (album_id, modelka_id) VALUES (?, ?)`, alba[0].AlbumID, dana); err != nil {
		t.Fatal(err)
	}
	d := a.GetPodobnostObsahu(dana)
	if d.Fotek != 5 {
		t.Fatalf("po sdílení alba fotek s vektorem %d, chci 5", d.Fotek)
	}
	if f := d.Fotografove[bara]; len(f) != 1 || f[0] != "Stephen Wayda" {
		t.Fatalf("fotograf sdíleného alba %v", f)
	}
}
