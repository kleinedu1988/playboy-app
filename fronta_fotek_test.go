package main

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

// Zabalená fronta nese všechno, co fotka z GetFotografie: údaje alba jednou a adresu ze šablony
func TestZabalitFrontu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Bára"})
	a.AddBulkPhotos(1, "Léto", "Pictorial", odkazA+" "+odkazB)
	a.SetPopisAlba(1, "Léto", "Pictorial", "popis", "Fotograf")
	puvodni := a.nehodnoceneFotky()
	f := a.GetNehodnoceneFotky()
	if len(f.Fotky) != 2 || len(puvodni) != 2 || len(f.Alba) != 1 {
		t.Fatalf("fronta: %+v", f)
	}
	for i, x := range f.Fotky {
		p := puvodni[i]
		al := f.Alba[x.AlbumID]
		if x.ID != p.ID || strings.ReplaceAll(f.Sablona, "{id}", x.DriveID) != p.URL || al.Album != p.Album || al.Typ != p.Typ ||
			al.ModelkaID != p.ModelkaID || al.JmenoModelky != p.JmenoModelky || al.Popis != "popis" || al.Fotograf != "Fotograf" || al.Vydani != p.Vydani {
			t.Fatalf("fotka %d: %+v / %+v vs %+v", i, x, al, p)
		}
	}
}

// Původní načtení nehodnocených fotek přes pohled se seřazením v SQL: měřítko pro nacistFrontu
func (a *App) nehodnoceneFotky() []Fotografie {
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE COALESCE(f.hodnoceni, 0) = 0
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true))
}

// Fronta z tabulek má stejné fotky ve stejném pořadí a se stejnými údaji jako původní načtení přes pohled
func TestNacistFrontuJakoSQL(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Žaneta", "Zuzana", "Ádina", "adéla", "Adela"} {
		a.AddModelka(Modelka{Jmeno: j})
	}
	odkazy := func(n int) string {
		var v []string
		for i := 0; i < n; i++ {
			v = append(v, fmt.Sprintf("https://drive.google.com/file/d/%029d/view", i+n*100))
		}
		return strings.Join(v, " ")
	}
	a.AddBulkPhotos(1, "B", "Pictorial", odkazy(3))
	a.AddBulkPhotos(1, "A", "Pictorial", odkazy(2))
	a.AddBulkPhotos(2, "A", "Centerfold", odkazy(4))
	a.AddBulkPhotos(3, "A", "Pictorial", odkazy(5))
	a.AddBulkPhotos(4, "A", "Pictorial", odkazy(6))
	a.AddBulkPhotos(5, "A", "Pictorial", odkazy(7))
	a.AddBulkPhotos(5, "A", "Cover", odkazy(8))
	a.PridatModelkuKAlbu(5, "A", "Pictorial", 1)
	fotky := a.nehodnoceneFotky()
	a.SetPoradiFotek([]int{fotky[2].ID, fotky[0].ID})
	a.SetHodnoceniFotek([]int{fotky[1].ID}, 3)
	a.SetHodnoceniFotek([]int{fotky[3].ID}, 4)
	cekam := zabalitFrontu(a.nehodnoceneFotky())
	if f := a.GetNehodnoceneFotky(); !reflect.DeepEqual(f, cekam) {
		t.Fatalf("fronta se liší od SQL:\n%+v\n%+v", f, cekam)
	}
	cekam = zabalitFrontu(a.fotkyKPruvodci())
	if f := a.GetFotkyKPruvodci(); !reflect.DeepEqual(f, cekam) || len(f.Fotky) != len(fotky) {
		t.Fatalf("fronta průvodce se liší od SQL:\n%+v\n%+v", f, cekam)
	}
}

// Stránky průvodce po albech: dohromady celá fronta bez opakování, i když fotky mezitím průvodcem projdou
func TestStrankyPruvodce(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Adéla", "Bára", "Cecílie"} {
		a.AddModelka(Modelka{Jmeno: j})
	}
	odkazy := func(n, od int) string {
		var v []string
		for i := 0; i < n; i++ {
			v = append(v, fmt.Sprintf("https://drive.google.com/file/d/%029d/view", od+i))
		}
		return strings.Join(v, " ")
	}
	a.AddBulkPhotos(1, "A", "Pictorial", odkazy(3, 100))
	a.AddBulkPhotos(1, "B", "Pictorial", odkazy(4, 200))
	a.AddBulkPhotos(2, "A", "Pictorial", odkazy(2, 300))
	a.AddBulkPhotos(3, "A", "Pictorial", odkazy(5, 400))
	cela := a.GetFotkyKPruvodci()

	prvni := a.GetStrankuPruvodce(nil, 4)
	// 3 + 4 fotky: stránka končí až na konci alba, které 4. fotku obsahuje
	if len(prvni.Fotky) != 7 || !prvni.Dalsi || prvni.Celkem != 14 || len(prvni.Souhrn) != 4 || prvni.Souhrn[1].Pocet != 4 {
		t.Fatalf("první stránka: %d fotek, další %v, celkem %d, souhrn %+v", len(prvni.Fotky), prvni.Dalsi, prvni.Celkem, prvni.Souhrn)
	}
	// Mezitím projde průvodcem fotka z první stránky: další stránka pokračuje dalším albem
	a.UlozitPruvodceFotky(ZapisPruvodce{Ids: []int{prvni.Fotky[0].ID}, Hotovo: true})
	nactena := map[int64]bool{}
	var ids []int
	for _, f := range prvni.Fotky {
		nactena[f.AlbumID] = true
		ids = append(ids, f.ID)
	}
	for stranka := prvni; stranka.Dalsi; {
		var alba []int64
		for id := range nactena {
			alba = append(alba, id)
		}
		stranka = a.GetStrankuPruvodce(alba, 4)
		for _, f := range stranka.Fotky {
			nactena[f.AlbumID] = true
			ids = append(ids, f.ID)
		}
		if len(stranka.Souhrn) != 0 {
			t.Fatal("souhrn jen u první stránky")
		}
	}
	if len(ids) != len(cela.Fotky) {
		t.Fatalf("stránky dohromady %d fotek, fronta %d", len(ids), len(cela.Fotky))
	}
	for i, f := range cela.Fotky {
		if ids[i] != f.ID {
			t.Fatalf("pořadí se liší na %d", i)
		}
	}
}

// Náhodné pořadí fronty počítá backend stejně jako okno (hodnoty z lib/hodnoceni.js nahodaKlice)
func TestNahodaKliceJakoOkno(t *testing.T) {
	for _, x := range []struct {
		klic, seed int
		cekam      float64
	}{{1, 1, 0.9209155989810824}, {123456, 54321, 0.12668296112678945}, {987654321, 99999, 0.4506329158321023}, {42, 0, 0.8236939776688814}, {7, 4294967295, 0.19304829044267535}} {
		if v := nahodaKlice(x.klic, x.seed); v != x.cekam {
			t.Errorf("nahodaKlice(%d, %d) = %v, okno %v", x.klic, x.seed, v, x.cekam)
		}
	}
}

// Stránky nehodnocených: dohromady celá fronta sezení v pořadí bez opakování; ohodnocené se vynechají
func TestStrankyNehodnocenych(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Adéla", "Bára", "Cecílie"} {
		a.AddModelka(Modelka{Jmeno: j})
	}
	odkazy := func(n, od int) string {
		var v []string
		for i := 0; i < n; i++ {
			v = append(v, fmt.Sprintf("https://drive.google.com/file/d/%029d/view", od+i))
		}
		return strings.Join(v, " ")
	}
	a.AddBulkPhotos(1, "A", "Pictorial", odkazy(6, 100))
	a.AddBulkPhotos(2, "1990-05", "Centerfold", odkazy(3, 200))
	a.AddBulkPhotos(3, "A", "Pictorial", odkazy(5, 300))
	for _, razeni := range []string{"nahodne", "modelky"} {
		prvni := a.GetStrankuNehodnocenych(777, razeni, 0, 0, 4)
		if prvni.Celkem != 14 || len(prvni.Polozky) != 4 || prvni.Dalsi != 4 || len(prvni.Modelky) != 3 || prvni.Modelky[0].N != 6 {
			t.Fatalf("%s: první stránka %+v", razeni, prvni)
		}
		videno := map[int]bool{}
		for _, p := range prvni.Polozky {
			videno[prvni.Fotky[p[0]].ID] = true
		}
		// Ohodnocená fotka z další stránky se vynechá
		dalsiF := a.GetStrankuNehodnocenych(777, razeni, 0, 4, 1)
		a.SetHodnoceniFotek([]int{dalsiF.Fotky[0].ID}, 3)
		for od := prvni.Dalsi; od >= 0; {
			s := a.GetStrankuNehodnocenych(777, razeni, 0, od, 4)
			for _, p := range s.Polozky {
				id := s.Fotky[p[0]].ID
				if videno[id] || id == dalsiF.Fotky[0].ID {
					t.Fatalf("%s: fotka %d znovu nebo ohodnocená", razeni, id)
				}
				videno[id] = true
			}
			od = s.Dalsi
		}
		if len(videno) != 13 {
			t.Fatalf("%s: dohromady %d položek", razeni, len(videno))
		}
		a.SetHodnoceniFotek([]int{dalsiF.Fotky[0].ID}, 0)
	}
	// Jen jedna modelka
	if s := a.GetStrankuNehodnocenych(777, "nahodne", 3, 0, 10); s.Celkem != 5 || len(s.Polozky) != 5 {
		t.Fatalf("modelka: %d / %d", s.Celkem, len(s.Polozky))
	}
}
