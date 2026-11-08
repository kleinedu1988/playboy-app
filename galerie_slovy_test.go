package main

import (
	"fmt"
	"testing"
)

func TestRozepsatAOdebratJmeno(t *testing.T) {
	if r := rozepsat("Zrzka na pláži!"); r != "zrzavé vlasy na pláži!" {
		t.Fatalf("rozepsat %q", r)
	}
	if r := odebratJmeno("pamela ANDERSONOVÁ na pláži", "Pamela Andersonová"); r != "na pláži" {
		t.Fatalf("bez jména %q", r)
	}
}

// Vyčnívání nad rozložením: ukážou se jen fotky vysoko nad průměrem, nesmysl (nic nevyčnívá) nic nevrátí,
// u poznané modelky všechny její fotky podle shody
func TestSeraditPodleTextu(t *testing.T) {
	var fotky []fotkaGalerie
	podobnost := map[string]float64{}
	var vse []int
	for i := range 1000 {
		id := fmt.Sprint("f", i)
		fotky = append(fotky, fotkaGalerie{f: Fotografie{ID: i, DriveID: id, AlbumID: int64(i)}})
		podobnost[id] = 0.2 + float64(i%10)*0.002 // šum kolem 0,209
		vse = append(vse, i)
	}
	for i := range 5 {
		podobnost[fmt.Sprint("f", 100*i)] = 0.3 - float64(i)*0.001 // pět jasných shod
	}
	h := hledaniSlovy{podobnost: podobnost}
	h.prumer, h.odchylka = rozlozeni(podobnost)
	v := h.seradit(vse, fotky)
	if len(v) != 5 || v[0] != 0 {
		t.Fatalf("shody %v", v)
	}
	sum := map[string]float64{}
	for i := range 1000 {
		sum[fmt.Sprint("f", i)] = 0.2 + float64(i%10)*0.002
	}
	h = hledaniSlovy{podobnost: sum}
	h.prumer, h.odchylka = rozlozeni(sum)
	if v := h.seradit(vse, fotky); len(v) != 0 {
		t.Fatalf("nesmysl %d", len(v))
	}
	h.modelka = 7
	if v := h.seradit(vse[:20], fotky); len(v) != 20 {
		t.Fatalf("modelka %d", len(v))
	}
}
