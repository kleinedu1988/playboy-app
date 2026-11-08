package main

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

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

// Kolekce: řady z dat (♥5, oblast původu, vlasy) a filtr „Zobrazit vše“
func TestKolekceGalerie(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", VlasyBarva: "blond", Narodnost: "Norsko", Tetovani: -1, Piercing: -1})
	anna := idModelky(t, a, "Anna")
	var ids []string
	for i := range 10 {
		ids = append(ids, fmt.Sprintf("%029d", i))
	}
	a.AddBulkPhotos(anna, "Fjord", "Pictorial online", strings.Join(ids, " "))
	var fotky []int
	for _, f := range a.GetFotografieModelky(anna) {
		fotky = append(fotky, f.ID)
	}
	a.SetHodnoceniFotek(fotky, 5)
	// Další modelka, aby kolekce nepokrývaly skoro celou sbírku (ty se neukazují)
	a.AddModelka(Modelka{Jmeno: "Bára", Tetovani: -1, Piercing: -1})
	var dalsi []string
	for i := range 20 {
		dalsi = append(dalsi, fmt.Sprintf("B%028d", i))
	}
	a.AddBulkPhotos(idModelky(t, a, "Bára"), "Město", "Pictorial online", strings.Join(dalsi, " "))
	k := a.GetKolekceGalerie()
	nalezene := map[string]KolekceGalerie{}
	var klice []string
	for _, r := range k {
		nalezene[r.Klic] = r
		klice = append(klice, r.Klic)
	}
	if r, ok := nalezene["tvoje:5"]; !ok || r.Pocet != 10 || len(r.Fotky) != 10 {
		t.Fatalf("kolekce ♥5: %+v (kolekce %v)", r, klice)
	}
	if _, ok := nalezene["vzhled:oblast:ze skandinavie"]; !ok {
		t.Fatalf("oblast původu chybí: %v", klice)
	}
	if g := a.GetGalerieFotek(DotazGalerie{Kolik: 50, Kolekce: "vzhled:vlasy:blondynky"}); g.Celkem != 10 {
		t.Fatalf("Zobrazit vše blondýnky: %d", g.Celkem)
	}
	if len(k) > rad {
		t.Fatalf("řad %d", len(k))
	}
}

// Věk v době focení: z data narození a čísla, před narozeninami o rok méně
func TestKolekceVekuVDobeFoceni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	fotky := []fotkaGalerie{{f: Fotografie{ModelkaID: 1, Vydani: "1995-06"}}, {f: Fotografie{ModelkaID: 1, Vydani: "1995-03"}}}
	dk := &dataKolekce{modelky: map[int]modelkaKolekce{1: {narozeni: "1973-05-10"}}, tagy: map[string]map[string]bool{}}
	for i := range 40 {
		fotky = append(fotky, fotkaGalerie{f: Fotografie{ModelkaID: 1, Vydani: "1995-06", ID: 100 + i}})
	}
	var vek *defKolekce
	for _, d := range a.definiceKolekci(fotky, dk, time.Now()) {
		if strings.HasPrefix(d.klic, "cas:vek:") {
			vek = &d
		}
	}
	if vek == nil || vek.klic != "cas:vek:22" || !vek.plati(&fotky[0]) || vek.plati(&fotky[1]) {
		t.Fatalf("věk: %+v", vek)
	}
}

// Reprezentant focení (nejlepší fotka alba) a doporučená alba (bez srdíček, nejvyšší průměrný odhad)
func TestStrojoveUceniKolekci(t *testing.T) {
	a := &App{}
	var fotky []fotkaGalerie
	odhad := map[string]float64{}
	for al := range 12 {
		for k := range 4 {
			id := fmt.Sprintf("a%02d-%d", al, k)
			g := fotkaGalerie{f: Fotografie{AlbumID: int64(al), DriveID: id}}
			if al == 0 && k == 2 {
				g.f.Hodnoceni = 5
			}
			odhad[id] = float64(al)/10 + float64(k)/100
			fotky = append(fotky, g)
		}
	}
	dk := &dataKolekce{odhad: odhad, modelky: map[int]modelkaKolekce{}}
	a.strojoveUceniKolekci(fotky, dk)
	if !dk.reprezentant["a00-2"] || !dk.reprezentant["a05-3"] || dk.reprezentant["a05-1"] {
		t.Fatalf("reprezentanti %v", dk.reprezentant)
	}
	if !dk.doporucenaAlba[11] || dk.doporucenaAlba[0] || dk.doporucenaAlba[3] {
		t.Fatalf("doporučená alba %v", dk.doporucenaAlba)
	}
}
