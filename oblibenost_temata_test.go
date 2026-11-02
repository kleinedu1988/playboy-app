package main

import (
	"testing"
	"time"
)

// Slovník názvů: přesná kombinace má vlastní název, jiná se složí z frází; klíč jde tam i zpět
func TestNazvyTemat(t *testing.T) {
	for _, tm := range katalogTemat {
		if tm.Nazev == "" || tm.Klic == "" {
			t.Errorf("téma bez názvu nebo klíče: %+v", tm)
		}
		if zpet := temaZKlice(tm.Klic); zpet == nil || zpet.Klic != tm.Klic || zpet.Nazev != tm.Nazev {
			t.Errorf("klíč %q tam a zpět: %+v", tm.Klic, zpet)
		}
	}
	prirodni := noveTema([]PodminkaTematu{{Druh: "modelka", Klic: "prsaTyp", Hodnoty: []string{"Přírodní"}}, {Druh: "tag", Hodnoty: []string{"prsa"}}})
	if prirodni.Nazev != "Přírodní krása" || prirodni.Klic != "modelka:prsaTyp=Přírodní+tag:prsa" {
		t.Errorf("přírodní krása: %+v", prirodni)
	}
	slozene := noveTema([]PodminkaTematu{{Druh: "tag", Hodnoty: []string{"podpatky"}}, {Druh: "modelka", Klic: "prsaTyp", Hodnoty: []string{"Přírodní"}}})
	if slozene.Nazev != "Podpatky · přírodní prsa" {
		t.Errorf("složený název: %q", slozene.Nazev)
	}
	if klasicka := temaZKlice(""); klasicka == nil || klasicka.Nazev != "Klasická" {
		t.Errorf("Klasická: %+v", klasicka)
	}
	for _, spatny := range []string{"tag:neexistuje", "modelka:barva=x", "nesmysl", "modelka:prsaTyp="} {
		if temaZKlice(spatny) != nil {
			t.Errorf("neplatný klíč %q prošel", spatny)
		}
	}
}

// Body v tematické sezóně: jen souboje v tématu mezi soutěžícími, zájem jen soutěžících
func TestBodyTematickeSezony(t *testing.T) {
	od := time.Date(2026, 11, 1, 0, 0, 0, 0, time.Local)
	cas := time.Date(2026, 11, 2, 10, 0, 0, 0, time.Local)
	existuje := map[int]bool{1: true, 2: true, 3: true}
	tema := *temaZKlice("tag:podpatky")
	filtr := &filtrSezony{tema: tema, soutezici: map[int]int{1: 6, 2: 7}}
	porovnani := []porovnaniZaznam{
		{cas: cas, a: 1, b: 2, vysledek: "a", tema: tema.Klic}, // počítá se
		{cas: cas, a: 2, b: 1, vysledek: "a"},                  // mimo téma
		{cas: cas, a: 1, b: 3, vysledek: "a", tema: tema.Klic}, // 3 nesoutěží
		{cas: cas, a: 2, b: 1, vysledek: "remiza", tema: "tag:akt"},
	}
	zajem := []zaznamZajmu{{cas: cas, id: 3, profil: true}, {cas: cas, id: 2, profil: true}}
	b := spocitatBodySezony(porovnani, zajem, map[int]int{}, existuje, od, od.AddDate(0, 1, 0), filtr)
	podle := map[int]BodySezony{}
	for _, x := range b {
		podle[x.ModelkaID] = x
	}
	if podle[1].Souboju != 1 || podle[1].ZaSouboje != bodyVyhra || podle[2].Souboju != 1 || podle[2].ZaZajem != 0 {
		t.Errorf("body v tématu: %+v", b)
	}
	if _, ma := podle[3]; ma {
		t.Errorf("nesoutěžící 3 má body: %+v", podle[3])
	}
	if n := pocetSouboju(porovnani, od, od.AddDate(0, 1, 0), filtr); n != 1 {
		t.Errorf("soubojů v tématu %d", n)
	}
	if n := pocetSouboju(porovnani, od, od.AddDate(0, 1, 0), nil); n != 4 {
		t.Errorf("soubojů v Klasické %d", n)
	}
}

// Téma sezóny v aplikaci: soutěžící podle tagů, body z tematických soubojů, Klasická při málo soutěžících,
// náhledy jen fotek tématu
func TestTemaSezonyVAplikaci(t *testing.T) {
	puvodniFotek, puvodniModelek := minFotekTematu, minModelekTematu
	minFotekTematu, minModelekTematu = 1, 2
	defer func() { minFotekTematu, minModelekTematu = puvodniFotek, puvodniModelek }()

	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Anna", "Bára", "Cecílie"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), 4)
	}
	ida, idb, idc := idModelky(t, a, "Anna"), idModelky(t, a, "Bára"), idModelky(t, a, "Cecílie")
	for _, id := range []int{ida, idb, idc} {
		a.AddBulkPhotos(id, "Album", "Pictorial", odkazA+" "+odkazB)
	}
	// Podpatky má jen jedna fotka Anny a jedna Báry; Cecílie žádnou
	fa, fb := a.GetFotografieModelky(ida), a.GetFotografieModelky(idb)
	a.SetTagyFotek([]int{fa[0].ID, fb[0].ID}, []string{"podpatky"}, nil)

	od := a.GetSezona().Klic
	if a.SetObdobiSezony(od, "tag:neexistuje", 0) || a.SetObdobiSezony("2000-01-01", "tag:podpatky", 0) || a.SetObdobiSezony(od, "tag:podpatky", 5) {
		t.Fatal("neplatné téma, minulá sezóna nebo délka mimo nabídku prošly")
	}
	if !a.SetObdobiSezony(od, "tag:podpatky", 0) {
		t.Fatal("téma se neuložilo")
	}
	if a.PorovnatModelkyVTematu(ida, idb, "a", "tag:neexistuje") {
		t.Fatal("porovnání v neplatném tématu prošlo")
	}
	a.PorovnatModelkyVTematu(ida, idb, "a", "tag:podpatky")
	a.PorovnatModelky(idb, ida, "a")
	a.PorovnatModelkyVTematu(ida, idc, "a", "tag:podpatky") // Cecílie nesoutěží

	s := a.GetSezona()
	if s.Tema == nil || s.Tema.Nazev != "Na podpatcích" || s.Nazev != "Na podpatcích" || s.Zvolene != "tag:podpatky" || s.Soutezicich != 2 || s.Souboju != 1 {
		t.Fatalf("sezóna s tématem: tema %+v, soutěžících %d, soubojů %d", s.Tema, s.Soutezicich, s.Souboju)
	}
	if len(s.Poradi) == 0 || s.Poradi[0].ModelkaID != ida || s.Poradi[0].ZaSouboje != bodyVyhra {
		t.Errorf("pořadí v tématu: %+v", s.Poradi)
	}

	// Náhledy tématu: jen fotky s podpatky
	n := a.GetNahledyTematu([]int{ida, idc}, 10, "tag:podpatky")
	if len(n[ida]) != 1 || n[ida][0].ID != fa[0].ID || len(n[idc]) != 0 {
		t.Errorf("náhledy tématu: %+v", n)
	}
	if len(a.GetNahledyTematu([]int{ida}, 10, "")[ida]) != 2 {
		t.Error("Klasická má mít všechny fotky")
	}

	// Katalog s pokrytím
	for _, info := range a.GetTemataSezon() {
		if info.Klic == "tag:podpatky" && (info.Soutezicich != 2 || info.Fotek != 2 || !info.Plati) {
			t.Errorf("pokrytí podpatků: %+v", info)
		}
	}

	// Málo soutěžících: sezóna běží jako Klasická (všechny souboje)
	minModelekTematu = 3
	s = a.GetSezona()
	if s.Tema != nil || s.Souboju != 3 || s.Nazev != s.Obdobi || s.Zvolene != "tag:podpatky" {
		t.Errorf("Klasická místo tématu: tema %+v, soubojů %d, název %q", s.Tema, s.Souboju, s.Nazev)
	}
}
