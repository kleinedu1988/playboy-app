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
	pa := obsah.NovePartie()
	for _, id := range []string{idA, idB, idC} {
		pa.Pridat(id, make([]float32, len(obsah.TridyDetektoru)))
	}
	if err := pa.Ulozit(slozka); err != nil {
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

	// Návrhy tagů: fotka s vektorem je zpracovaná, bez vektoru čeká
	var fotkaBez int
	a.AddBulkPhotos(bara, "Studio", "Pictorial", "DDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
	for _, f := range a.GetFotografieModelky(bara) {
		if f.DriveID == "DDDDDDDDDDDDDDDDDDDDDDDDDDDDD" {
			fotkaBez = f.ID
		}
	}
	navrhy := a.GetNavrhyTagu([]int{fotkaA, fotkaBez})
	if !navrhy[fotkaA].Zpracovano || navrhy[fotkaBez].Zpracovano || navrhy[fotkaBez].Tagy == nil {
		t.Fatalf("návrhy %+v", navrhy)
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

// Řazení fronty podle odhadu srdíček: od nejvyššího, položky bez odhadu na konci
func TestSeraditFrontuPodleOdhadu(t *testing.T) {
	p := []polozkaFronty{{klic: 1}, {klic: 2}, {klic: 3}, {klic: 4}}
	seraditFrontu(p, "odhad", 7, map[int]float64{1: 1.5, 2: 4.2, 4: 3.1})
	if p[0].klic != 2 || p[1].klic != 4 || p[2].klic != 1 || p[3].klic != 3 {
		t.Fatalf("pořadí %+v", p)
	}
	// Bez odhadu (málo hodnocených) zamíchaně jako „náhodně“
	q := []polozkaFronty{{klic: 1}, {klic: 2}, {klic: 3}}
	r := []polozkaFronty{{klic: 1}, {klic: 2}, {klic: 3}}
	seraditFrontu(q, "odhad", 7, nil)
	seraditFrontu(r, "nahodne", 7, nil)
	for i := range q {
		if q[i].klic != r[i].klic {
			t.Fatal("bez odhadu se má řadit náhodně")
		}
	}
}

// Příklady z Průvodce: jen prošlé fotky, tagy a zodpovězené skupiny (krok přeskočený u portrétu se nepočítá)
func TestPrikladyTaguZPruvodce(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	anna := idModelky(t, a, "Anna")
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", odkazA+" "+odkazB)
	fotky := a.GetFotografieModelky(anna)
	var vsechny []string
	for _, k := range krokyPruvodce {
		vsechny = append(vsechny, k.Skupiny...)
	}
	a.UlozitPruvodceFotky(ZapisPruvodce{Ids: []int{fotky[0].ID}, Skupiny: vsechny, Tagy: []string{"portret", "oblecena", "plaz"}, Hotovo: true})
	priklady := a.prikladyTaguZPruvodce()
	if len(priklady) != 1 || priklady[0].ID != fotky[0].DriveID {
		t.Fatalf("příklady %+v", priklady)
	}
	sk := map[string]bool{}
	for _, s := range priklady[0].Skupiny {
		sk[s] = true
	}
	if !sk["zaber"] || !sk["prostredi"] || sk["partie"] {
		t.Fatalf("zodpovězené skupiny %v (tělo se u portrétu přeskočí)", priklady[0].Skupiny)
	}
}
