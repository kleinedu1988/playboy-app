package main

import "testing"

func TestTemataKOdemceni(t *testing.T) {
	puvodniFotek, puvodniModelek := minFotekTematu, minModelekTematu
	minFotekTematu, minModelekTematu = 2, 2
	defer func() { minFotekTematu, minModelekTematu = puvodniFotek, puvodniModelek }()

	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Anna", "Bára", "Cecílie"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
	}
	ida, idb, idc := idModelky(t, a, "Anna"), idModelky(t, a, "Bára"), idModelky(t, a, "Cecílie")
	a.AddBulkPhotos(ida, "A", "Pictorial", odkazA+" "+odkazB)
	a.AddBulkPhotos(idb, "B", "Pictorial", odkazA+" "+odkazB)
	a.AddBulkPhotos(idc, "C", "Pictorial", odkazA+" "+odkazB)
	fa, fc := a.GetFotografieModelky(ida), a.GetFotografieModelky(idc)
	a.SetTagyFotek([]int{fa[0].ID, fa[1].ID, fc[0].ID}, []string{"podpatky"}, nil)
	// Cecílie má jednu fotku s podpatky a druhou prošlou průvodcem bez nich – nemůže soutěžit
	a.UlozitPruvodceFotky(ZapisPruvodce{Ids: []int{fc[1].ID}, Skupiny: []string{"obleceni"}, Tagy: []string{"saty"}, Hodnoceni: 3, Hotovo: true})

	var podpatky *PokrytiTematu
	temata := a.GetTemataKOdemceni()
	for i := range temata {
		if temata[i].Klic == "tag:podpatky" {
			podpatky = &temata[i]
		}
	}
	if podpatky == nil {
		t.Fatalf("podpatky nejsou k odemčení: %+v", temata)
	}
	if podpatky.Soutezicich != 1 || podpatky.ChybiModelek != 1 || len(podpatky.Kandidatky) != 1 || podpatky.Kandidatky[0].ModelkaID != idb ||
		podpatky.Kandidatky[0].Chybi != 2 || podpatky.FotekKOdemceni != 2 {
		t.Errorf("pokrytí podpatků: %+v", podpatky)
	}
	f := a.fotkyKOdemceni("tag:podpatky")
	if len(f) != 2 || f[0].ModelkaID != idb || f[1].ModelkaID != idb {
		t.Errorf("fronta k odemčení: %+v", f)
	}
	if len(a.fotkyKOdemceni("tag:neexistuje")) != 0 {
		t.Error("neplatné téma")
	}
	// Téma bez tagů (éra) se tagováním neodemkne
	for _, p := range temata {
		if !temaZKlice(p.Klic).maPodminkuNaTag() {
			t.Errorf("téma bez tagu k odemčení: %s", p.Klic)
		}
	}
}
