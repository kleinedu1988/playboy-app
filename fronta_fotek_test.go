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
