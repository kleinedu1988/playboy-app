package main

import "testing"

func TestVycnivajiciModelky(t *testing.T) {
	var fotky []fotkaGalerie
	podobnost := map[string]float64{}
	for i := 0; i < 200; i++ {
		id := string(rune('A'+i%26)) + string(rune('a'+i/26))
		fotky = append(fotky, fotkaGalerie{f: Fotografie{DriveID: id, ModelkaID: 1 + i%10}})
		podobnost[id] = 0.20 + float64(i%7)*0.001
	}
	podobnost[fotky[3].f.DriveID] = 0.35 // modelka 4 má jednu výraznou fotku
	shody := vycnivajiciModelky(fotky, podobnost)
	if len(shody) != 1 || shody[4] < minVycnivaniNej {
		t.Fatalf("čekám jen modelku 4: %v", shody)
	}
	// Bez výrazné fotky: text v obsahu nic neznamená
	podobnost[fotky[3].f.DriveID] = 0.203
	if s := vycnivajiciModelky(fotky, podobnost); len(s) != 0 {
		t.Fatalf("čekám nic: %v", s)
	}
}
