package main

import (
	"os"
	"path/filepath"
	"testing"

	"playboy-app/internal/obsah"
)

// Vektor délky 1 se dvěma složkami (stačí na pořadí podobnosti)
func vektorObsahu(x, y float32) []float32 {
	v := make([]float32, obsah.Rozmer)
	v[0], v[1] = x, y
	return v
}

// Podobné fotky: vlastní fotka první, pak podle podobnosti; soubor ve dvou albech jen jednou; bez vektoru nic
func TestPodobneFotky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	idC := "CCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", odkazA+" "+odkazB)
	a.AddBulkPhotos(bara, "Studio", "Pictorial", idC+" "+odkazA)

	slozka := a.slozkaObsahu()
	os.MkdirAll(slozka, 0o700)
	for _, s := range obsah.Soubory {
		os.WriteFile(filepath.Join(slozka, s.Nazev), []byte("x"), 0o600)
	}
	v := obsah.NoveVektory()
	v.Pridat(idA, vektorObsahu(1, 0))
	v.Pridat(idB, vektorObsahu(0, 1))
	v.Pridat(idC, vektorObsahu(0.8, 0.6))
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}

	var fotkaA int
	for _, f := range a.GetFotografieModelky(bara) {
		if f.DriveID == idA {
			fotkaA = f.ID
		}
	}
	podobne := a.GetPodobneFotky(fotkaA)
	if len(podobne) != 3 {
		t.Fatalf("podobných %d: %+v", len(podobne), podobne)
	}
	if podobne[0].ID != fotkaA || podobne[1].DriveID != idC || podobne[2].DriveID != idB {
		t.Fatalf("pořadí %s %s %s", podobne[0].DriveID, podobne[1].DriveID, podobne[2].DriveID)
	}
	if st := a.GetStavObsahu(); st.Vektoru != 3 || st.Faze != obsah.FazePripraveno {
		t.Fatalf("stav %+v", st)
	}

	if !a.VypnoutObsah() {
		t.Fatal("vypnutí selhalo")
	}
	if n := len(a.GetPodobneFotky(fotkaA)); n != 0 {
		t.Fatalf("po vypnutí %d podobných", n)
	}
	if _, err := os.Stat(filepath.Join(slozka, obsah.Soubory[0].Nazev)); !os.IsNotExist(err) {
		t.Fatal("model po vypnutí zůstal")
	}
}
