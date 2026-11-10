package main

import (
	"image"
	"image/color"
	"slices"
	"testing"
)

func obrazek(w, h int, barva func(x, y int) uint8) *image.Gray {
	img := image.NewGray(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetGray(x, y, color.Gray{Y: barva(x, y)})
		}
	}
	return img
}

func TestZmeritKvalitu(t *testing.T) {
	ostra := ZmeritKvalitu(obrazek(400, 300, func(x, y int) uint8 {
		if (x/2+y/2)%2 == 0 {
			return 30
		}
		return 220
	}))
	if ostra.Ostrost < 1000 || len(ostra.Problemy()) != 0 {
		t.Fatalf("šachovnice má být ostrá a bez problémů: %+v %v", ostra, ostra.Problemy())
	}
	mekka := ZmeritKvalitu(obrazek(400, 300, func(x, y int) uint8 { return uint8(60 + x/4) }))
	if !slices.Contains(mekka.Problemy(), "rozmazane") {
		t.Fatalf("plynulý přechod má být rozmazaný: %+v", mekka)
	}
	bila := ZmeritKvalitu(obrazek(400, 300, func(x, y int) uint8 { return 255 }))
	if !slices.Contains(bila.Problemy(), "prepalene") {
		t.Fatalf("bílá fotka má být přepálená: %+v", bila)
	}
	cerna := ZmeritKvalitu(obrazek(400, 300, func(x, y int) uint8 { return 3 }))
	if !slices.Contains(cerna.Problemy(), "tmave") {
		t.Fatalf("černá fotka má být tmavá: %+v", cerna)
	}
	mala := ZmeritKvalitu(obrazek(200, 150, func(x, y int) uint8 { return uint8((x*37 + y*11) % 256) }))
	if !slices.Contains(mala.Problemy(), "male") {
		t.Fatalf("náhled 200 × 150 je malý originál: %+v", mala)
	}
	if p := ZmeritKvalitu(obrazek(400, 600, func(x, y int) uint8 { return uint8((x*37 + y*11) % 256) })).Problemy(); slices.Contains(p, "male") {
		t.Fatalf("náhled široký 400 není malý: %v", p)
	}
}

func TestLepsiStejna(t *testing.T) {
	otisky := map[string]otisk{"a": {d: 1, p: 0b1010}, "b": {d: 1, p: 0b1011}, "c": {d: 99, p: ^uint64(0)}}
	slaba := Mereni{Ostrost: 5, Sirka: 200, Vyska: 150}
	mereni := map[string]Mereni{
		"a": slaba,
		"b": {Ostrost: 300, Sirka: 400, Vyska: 600, Jas: 120},
		"c": {Ostrost: 900, Sirka: 400, Vyska: 600, Jas: 120},
	}
	if l := lepsiStejna("a", slaba, otisky, mereni); l != "b" {
		t.Fatalf("lepší stejná má být b (c má jiný otisk), je %q", l)
	}
	mereni["b"] = Mereni{Ostrost: 5, Sirka: 400, Vyska: 600}
	if l := lepsiStejna("a", slaba, otisky, mereni); l != "" {
		t.Fatalf("rozmazaná kopie není lepší, vyšlo %q", l)
	}
}
