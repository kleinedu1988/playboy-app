package main

import (
	"strings"
	"testing"
)

// Kritérium: otočená fotka se hlásí s návrhem podle současné rotace, otočení jedním klikem ji z úkolů vyřadí,
// „v pořádku“ se pamatuje; titulní bez výřezu je úkol a bez Obsahu fotek návrh výřezu řekne proč
func TestOtoceneFotkyAVyrez(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Otočená", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "Otočená")
	a.AddBulkPhotos(id, "Fotky", "Pictorial", odkazA+" "+odkazB)
	fotky := a.GetFotografieModelky(id)
	if len(fotky) != 2 {
		t.Fatalf("fotek %d", len(fotky))
	}
	driveA, driveB := fotky[0].DriveID, fotky[1].DriveID
	k := a.kontrolyOtoceni()
	k.nacteno = true
	k.vysledky[driveA] = [4]float32{0.60, 0.70, 0.55, 0.58} // na boku: 90° sedí víc
	k.vysledky[driveB] = [4]float32{0.70, 0.69, 0.60, 0.65} // rovně

	o := a.GetOtoceneFotky()
	if len(o) != 1 || o[0].DriveID != driveA || o[0].Navrh != 90 || o[0].Rotace != 0 || len(o[0].FotkyIDs) != 1 || o[0].Jmeno != "Otočená" {
		t.Fatalf("otočené: %+v", o)
	}
	// Otočení jedním klikem: úkol zmizí
	if !a.SetRotaceFotek(o[0].FotkyIDs, o[0].Navrh) || len(a.GetOtoceneFotky()) != 0 {
		t.Fatal("po otočení se pořád hlásí")
	}
	// Ručně vrácená rotace se hlásí znovu; v pořádku ji vyřadí, zrušení vrátí
	a.SetRotaceFotek(o[0].FotkyIDs, 0)
	if !a.OznacitOtoceniVPoradku([]string{driveA}, true) || len(a.GetOtoceneFotky()) != 0 {
		t.Fatal("v pořádku")
	}
	a.OznacitOtoceniVPoradku([]string{driveA}, false)
	if len(a.GetOtoceneFotky()) != 1 {
		t.Fatal("zrušení v pořádku")
	}
	// Uložení a načtení výsledků ze souboru
	if err := a.ulozitOtoceni(k); err != nil {
		t.Fatal(err)
	}
	a.otoceni = nil
	if len(a.GetOtoceneFotky()) != 1 {
		t.Fatal("výsledky se nenačetly ze souboru")
	}
	if st := a.GetStavOtoceni(); st.Zkontrolovano != 2 || st.Zapnuto || a.SpustitKontroluOtoceni() {
		t.Fatalf("stav bez Obsahu fotek: %+v", st)
	}

	// Titulní bez výřezu
	a.SetTitulniFotka(id, fotky[0].ID)
	bez := a.GetTitulniBezVyrezu()
	if len(bez) != 1 || bez[0].ModelkaID != id {
		t.Fatalf("titulní bez výřezu: %+v", bez)
	}
	n := a.NavrhnoutVyrezy([]int{id})
	if len(n) != 1 || n[0].Ok || !strings.Contains(n[0].Duvod, "Obsah fotek") {
		t.Fatalf("návrh bez obsahu: %+v", n)
	}
	a.OznacitVyrezVychozi([]int{id}, true)
	if len(a.GetTitulniBezVyrezu()) != 0 {
		t.Fatal("výchozí výřez v pořádku")
	}
	a.OznacitVyrezVychozi([]int{id}, false)
	a.SetCoverVyrez(id, 1.5, 40, 30)
	if len(a.GetTitulniBezVyrezu()) != 0 {
		t.Fatal("s výřezem se hlásí")
	}
}
