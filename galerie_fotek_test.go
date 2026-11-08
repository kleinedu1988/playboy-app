package main

import "testing"

// Galerie všech fotek: všechny fotky napříč modelkami, filtry, počty v panelu, stránky a promíchání alb
func TestGalerieFotek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna"), idModelky(t, a, "Bára")
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", odkazA+" "+odkazB)
	a.AddBulkPhotos(bara, "Studio", "Pictorial online", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCC DDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
	fotkyAnny := a.GetFotografieModelky(anna)
	a.SetHodnoceniFotek([]int{fotkyAnny[0].ID}, 5)
	a.SetTagyFotek([]int{fotkyAnny[0].ID}, []string{"plaz"}, nil)

	vse := a.GetGalerieFotek(DotazGalerie{Kolik: 50})
	if vse.Celkem != 4 || len(vse.Fotky) != 4 || vse.Fotky[0].ID != fotkyAnny[0].ID {
		t.Fatalf("všechny: %d, první %+v", vse.Celkem, vse.Fotky)
	}
	if vse.Fasety.Typy["Pictorial online"] != 2 || vse.Fasety.Srdicka["5"] != 1 || vse.Fasety.Srdicka["0"] != 3 || vse.Fasety.Tagy["plaz"] != 1 {
		t.Fatalf("fasety %+v", vse.Fasety)
	}
	if g := a.GetGalerieFotek(DotazGalerie{Kolik: 50, Srdicka: "0", Typy: []string{"Pictorial online"}}); g.Celkem != 2 {
		t.Fatalf("nehodnocené centerfoldy: %d", g.Celkem)
	}
	if g := a.GetGalerieFotek(DotazGalerie{Kolik: 50, Tagy: []string{"plaz"}}); g.Celkem != 1 {
		t.Fatalf("tag: %d", g.Celkem)
	}
	if g := a.GetGalerieFotek(DotazGalerie{Kolik: 50, Text: "bara"}); g.Celkem != 2 {
		t.Fatalf("text bez diakritiky: %d", g.Celkem)
	}
	if g := a.GetGalerieFotek(DotazGalerie{Kolik: 1, Od: 3}); len(g.Fotky) != 1 || g.Od != 3 {
		t.Fatalf("stránka: %+v", g)
	}
	// Po změně dat se galerie načte znovu
	a.SetHodnoceniFotek([]int{fotkyAnny[1].ID}, 4)
	if g := a.GetGalerieFotek(DotazGalerie{Kolik: 50, Srdicka: "4"}); g.Celkem != 2 {
		t.Fatalf("po změně srdíček: %d", g.Celkem)
	}
}

func TestPromichatAlba(t *testing.T) {
	var fotky []fotkaGalerie
	var poradi []int
	for i := range 10 {
		album := int64(1)
		if i >= 6 {
			album = int64(i)
		}
		fotky = append(fotky, fotkaGalerie{f: Fotografie{ID: i, AlbumID: album}})
		poradi = append(poradi, i)
	}
	v := promichatAlba(poradi, fotky)
	if len(v) != 10 || v[0] != 0 || v[1] != 1 || v[2] != 6 {
		t.Fatalf("promíchání: %v", v)
	}
}
