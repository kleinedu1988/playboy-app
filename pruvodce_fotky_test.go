package main

import (
	"slices"
	"strings"
	"testing"
)

// Kroky: nejvýš 9 možností, každý tag katalogu právě v jednom kroku, podmínky jen na tagy dřívějších kroků
func TestKrokyPruvodce(t *testing.T) {
	kroky := krokyPruvodce
	if kroky[len(kroky)-1].Typ != "srdicka" {
		t.Fatal("poslední krok mají být srdíčka")
	}
	kde := map[string]int{}
	for i, k := range kroky {
		if len(k.Moznosti) > 9 {
			t.Errorf("krok %s má %d možností", k.Klic, len(k.Moznosti))
		}
		if k.Typ == "jeden" {
			for _, m := range k.Moznosti {
				if !m.Vylucna || m.Skupina != k.Moznosti[0].Skupina {
					t.Errorf("krok „jeden“ %s musí být jedna výlučná skupina", k.Klic)
				}
			}
		}
		if !k.Povinny && k.Typ != "srdicka" && k.Nula == "" {
			t.Errorf("volitelný krok %s nemá popis nuly", k.Klic)
		}
		for _, m := range k.Moznosti {
			if _, ok := kde[m.Klic]; ok {
				t.Errorf("tag %s je ve dvou krocích", m.Klic)
			}
			kde[m.Klic] = i
		}
	}
	for _, sk := range katalogTagu {
		for _, tag := range sk.Tagy {
			if _, ok := kde[tag.Klic]; !ok {
				t.Errorf("tag %s není v žádném kroku", tag.Klic)
			}
		}
	}
	for i, k := range kroky {
		podminky := []PodminkaKroku{}
		if k.Preskocit != nil {
			podminky = append(podminky, *k.Preskocit)
		}
		for _, tl := range k.Tlumit {
			podminky = append(podminky, tl.Kdyz)
			for _, m := range tl.Moznosti {
				if kde[m] != i {
					t.Errorf("krok %s tlumí cizí možnost %s", k.Klic, m)
				}
			}
		}
		for _, p := range podminky {
			for _, tag := range p.Tagy {
				if j, ok := kde[tag]; !ok || j >= i {
					t.Errorf("krok %s má podmínku na tag %s, který není v dřívějším kroku", k.Klic, tag)
				}
			}
		}
		for _, tag := range k.Predvyplnit {
			if kde[tag] != i {
				t.Errorf("krok %s předvyplňuje cizí tag %s", k.Klic, tag)
			}
		}
	}
}

func TestPruvodceFotek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	ida := idModelky(t, a, "Anna")
	a.AddBulkPhotos(ida, "Album", "Pictorial", odkazA+" "+odkazB)
	fotky := a.GetFotografieModelky(ida)
	f1, f2 := fotky[0].ID, fotky[1].ID
	if n := a.GetPocetFotekKPruvodci(); n != 2 || len(a.GetFotkyKPruvodci()) != 2 {
		t.Fatalf("na začátku k průvodci %d", n)
	}
	a.SetTagyFotek([]int{f1}, []string{"studio", "podpatky"}, nil)

	// Přeskočeno po dvou krocích: zápis jen zodpovězených skupin, ostatní tagy zůstanou, fotka dál ve frontě
	p := a.UlozitPruvodceFotky(ZapisPruvodce{Ids: []int{f1}, Skupiny: []string{"zaber", "odhaleni"}, Tagy: []string{"postava", "akt", "loznice"}})
	if !p.Ok || len(p.Fotky) != 1 || !slices.Equal(p.Fotky[0].Tagy, []string{"podpatky", "studio"}) {
		t.Fatalf("předchozí stav: %+v", p)
	}
	tagy := a.GetTagyFotek([]int{f1})[f1]
	if !slices.Equal(tagy, []string{"akt", "podpatky", "postava", "studio"}) || a.GetPocetFotekKPruvodci() != 2 {
		t.Errorf("částečný zápis: %v, k průvodci %d", tagy, a.GetPocetFotekKPruvodci())
	}

	// Dokončeno: krok Tělo a nohy bez výběru odebere podpatky, srdíčka a příznak
	hotovo := a.UlozitPruvodceFotky(ZapisPruvodce{Ids: []int{f1}, Skupiny: []string{"zaber", "odhaleni", "prostredi", "partie", "obleceni"},
		Tagy: []string{"postava", "akt", "studio"}, Hodnoceni: 4, Hotovo: true})
	tagy = a.GetTagyFotek([]int{f1})[f1]
	if !hotovo.Ok || !slices.Equal(tagy, []string{"akt", "postava", "studio"}) || a.GetPocetFotekKPruvodci() != 1 {
		t.Errorf("hotovo: %v, k průvodci %d", tagy, a.GetPocetFotekKPruvodci())
	}
	if f := a.GetFotkyKPruvodci(); len(f) != 1 || f[0].ID != f2 {
		t.Errorf("fronta: %+v", f)
	}

	// Export a import nesou příznak
	export, _ := a.exportovat()
	if !strings.Contains(string(export), "pruvodce: 1") {
		t.Errorf("export bez příznaku průvodce")
	}

	// Vrátit: přesně předchozí stav
	if !a.VratitPruvodceFotky(hotovo) {
		t.Fatal("vrácení")
	}
	tagy = a.GetTagyFotek([]int{f1})[f1]
	if !slices.Equal(tagy, []string{"akt", "podpatky", "postava", "studio"}) || a.GetPocetFotekKPruvodci() != 2 {
		t.Errorf("po vrácení: %v, k průvodci %d", tagy, a.GetPocetFotekKPruvodci())
	}
	// Smazaná fotka: dávka se uloží bez ní a vrácení ji přeskočí
	z := a.UlozitPruvodceFotky(ZapisPruvodce{Ids: []int{f2, 999999}, Skupiny: []string{"zaber"}, Tagy: []string{"detail"}, Hotovo: true})
	if !z.Ok || len(z.Fotky) != 1 {
		t.Errorf("dávka se smazanou fotkou: %+v", z)
	}
	a.db.Exec(`DELETE FROM fotky WHERE id = ?`, f2)
	if !a.VratitPruvodceFotky(z) {
		t.Error("vrácení smazané fotky má projít")
	}
	b := novaTestovaciApp(t, nil)
	b.importovat(export)
	if n := b.GetPocetFotekKPruvodci(); n != 1 {
		t.Errorf("po importu k průvodci %d", n)
	}
}
