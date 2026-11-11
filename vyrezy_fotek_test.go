package main

import "testing"

// Výřezy fotek bez spočítaného obsahu (0.02.049): každá fotka „čeká“, stav zná počet souborů sbírky
func TestVyrezyFotekBezObsahu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	v := a.GetVyrezyFotek([]string{"soubor1", "soubor2"})
	if len(v) != 2 || v[0].Zdroj != "ceka" || v[1].DriveID != "soubor2" || v[0].Postava != nil {
		t.Fatalf("výřezy: %+v", v)
	}
	if s := a.GetStavVyrezu(); s.Spocitano != 0 {
		t.Errorf("stav: %+v", s)
	}
}
