package main

import (
	"fmt"
	"strings"
	"testing"
)

func TestGalerieNejlepsich(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Oblíbená"})
	a.AddModelka(Modelka{Jmeno: "Méně"})
	a.SetHodnoceni(1, 5)
	a.SetHodnoceni(2, 2)
	odkazy := func(n, od int) string {
		var v []string
		for i := 0; i < n; i++ {
			v = append(v, fmt.Sprintf("https://drive.google.com/file/d/%029d/view", od+i))
		}
		return strings.Join(v, " ")
	}
	a.AddBulkPhotos(1, "1995-03", "Centerfold", odkazy(3, 100))
	a.AddBulkPhotos(2, "Online", "Pictorial online", odkazy(3, 200))
	a.SetDatumAlba(2, "Online", "Pictorial online", "2012-05")
	a.AddCover("1980-01", odkazy(1, 300))
	f1, f2 := a.GetFotografieModelky(1), a.GetFotografieModelky(2)
	a.SetHodnoceniFotek([]int{f1[0].ID, f1[1].ID, f1[2].ID}, 4)
	a.SetHodnoceniFotek([]int{f2[0].ID, f2[1].ID}, 5)
	cover := a.GetCovery()[0]
	a.SetHodnoceniFotek([]int{cover.ID}, 3)

	ids := func(g GalerieNejlepsich) []int {
		var v []int
		for _, f := range g.Fotky {
			v = append(v, f.ID)
		}
		return v
	}
	// Hodnota: 4 srdíčka oblíbené (4×5/5 = 4) před 5 srdíčky méně oblíbené (5×2/5 = 2) a obálkou (3×2,5/5)
	g := a.GetGalerieNejlepsich(DotazNejlepsich{Min: 3})
	if g.Celkem != 6 || g.Modelek != 2 || g.Fotky[0].ID != f1[0].ID || g.Fotky[3].ID != f2[0].ID || g.Fotky[5].ID != cover.ID {
		t.Fatalf("hodnota: %v (celkem %d, modelek %d)", ids(g), g.Celkem, g.Modelek)
	}
	if g.Alba[g.Fotky[5].AlbumID].Typ != "Cover" || g.Alba[g.Fotky[0].AlbumID].JmenoModelky != "Oblíbená" {
		t.Fatalf("alba: %+v", g.Alba)
	}
	// Střídání modelek: druhá fotka oblíbené ztratí čtvrt srdíčka, třetí půl – pořád nad méně oblíbenou (2)
	if p := a.GetGalerieNejlepsich(DotazNejlepsich{Min: 3, Prokladat: true}); p.Fotky[2].ID != f1[2].ID {
		t.Fatalf("prokládání: %v", ids(p))
	}
	// Jen srdíčka fotky: pětky napřed
	if s := a.GetGalerieNejlepsich(DotazNejlepsich{Min: 3, Razeni: "srdicka"}); s.Fotky[0].ID != f2[0].ID {
		t.Fatalf("srdíčka: %v", ids(s))
	}
	// Filtry: typ, desetiletí, nejméně srdíček, hledání
	for _, x := range []struct {
		d     DotazNejlepsich
		pocet int
	}{
		{DotazNejlepsich{Min: 3, Typ: "centerfold"}, 3}, {DotazNejlepsich{Min: 3, Typ: "online"}, 2}, {DotazNejlepsich{Min: 3, Typ: "cover"}, 1},
		{DotazNejlepsich{Min: 3, Dekada: 1990}, 3}, {DotazNejlepsich{Min: 3, Dekada: 2010}, 2}, {DotazNejlepsich{Min: 5}, 2},
		{DotazNejlepsich{Min: 3, Hledat: "mene"}, 2},
	} {
		if g := a.GetGalerieNejlepsich(x.d); g.Celkem != x.pocet || len(g.Fotky) != x.pocet {
			t.Errorf("%+v: %d fotek", x.d, g.Celkem)
		}
	}
	// Stránky: dohromady totéž pořadí
	var stranky []int
	for od := 0; od < 6; od += 4 {
		stranky = append(stranky, ids(a.GetGalerieNejlepsich(DotazNejlepsich{Min: 3, Od: od, Pocet: 4}))...)
	}
	if fmt.Sprint(stranky) != fmt.Sprint(ids(g)) {
		t.Fatalf("stránky %v, celé %v", stranky, ids(g))
	}
	// Po ohodnocení se pořadí přepočítá (nová paměť)
	a.SetHodnoceniFotek([]int{cover.ID}, 5)
	if g := a.GetGalerieNejlepsich(DotazNejlepsich{Min: 3}); g.Fotky[3].ID != cover.ID {
		t.Fatalf("po ohodnocení: %v", ids(g))
	}
}
