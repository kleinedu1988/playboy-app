package main

import (
	"strings"
	"testing"
)

// Chytrý výběr je živý: nová modelka nebo fotka, která splní podmínky, je v něm hned; export a import ho zachová
func TestChytreVybery(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", VlasyBarva: "blond", VyskaCm: 178, Hodnoceni: 4, Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára", VlasyBarva: "černá", VyskaCm: 165, Tetovani: -1, Piercing: -1})
	anna := idModelky(t, a, "Anna")
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", odkazA)

	m := a.UlozitChytryVyber(ChytryVyber{Nazev: " Vysoké blondýny ", Druh: DruhVyberuModelky, Zapis: "blond výška > 170", Text: "vlasy:blond vyska:>170"})
	f := a.UlozitChytryVyber(ChytryVyber{Nazev: "Pětky", Popis: "Nejlepší fotky", Druh: DruhVyberuFotky, Text: "vlasy:blond", Galerie: PodminkyGalerie{Srdicka: "5"}})
	if m.ID == "" || f.ID == "" || m.Nazev != "Vysoké blondýny" || m.Vytvoreno == "" {
		t.Fatalf("uložení: %+v %+v", m, f)
	}
	if a.UlozitChytryVyber(ChytryVyber{Nazev: "vysoke blondyny", Druh: DruhVyberuModelky}).ID != "" {
		t.Fatal("stejný název stejného druhu se nemá uložit")
	}
	pocty := func() map[string]int {
		p := map[string]int{}
		for _, s := range a.GetChytreVybery("") {
			p[s.Nazev] = s.Pocet
		}
		return p
	}
	if p := pocty(); p["Vysoké blondýny"] != 1 || p["Pětky"] != 0 {
		t.Fatalf("počty: %v", p)
	}
	// Nová modelka a ohodnocená fotka se objeví samy
	a.AddModelka(Modelka{Jmeno: "Cecílie", VlasyBarva: "Blond", VyskaCm: 180, Tetovani: -1, Piercing: -1})
	a.SetHodnoceniFotek([]int{a.GetFotografieModelky(anna)[0].ID}, 5)
	a.AddBulkPhotos(anna, "Pláž", "Pictorial", odkazB)
	if p := pocty(); p["Vysoké blondýny"] != 2 || p["Pětky"] != 1 {
		t.Fatalf("po přidání: %v", p)
	}
	if s := a.GetChytreVybery(DruhVyberuModelky); len(s) != 1 || len(s[0].Modelky) != 2 || s[0].Modelky[0] != anna {
		t.Fatalf("náhled modelek: %+v", s)
	}
	// Úprava podle ID zachová datum vytvoření
	m.Popis = "nad 170 cm"
	if u := a.UlozitChytryVyber(m); u.ID != m.ID || u.Vytvoreno != m.Vytvoreno || len(a.GetChytreVybery("")) != 2 {
		t.Fatalf("úprava: %+v", u)
	}

	// Zmrazení: fotky do běžného výběru, modelky do tagu
	if z := a.ZmrazitChytryVyber(f.ID); z.Pocet != 1 || z.VyberID == 0 {
		t.Fatalf("zmrazení fotek: %+v", z)
	}
	if z := a.ZmrazitChytryVyber(m.ID); z.Pocet != 2 || z.Tag != "Vysoké blondýny" || !strings.Contains(a.GetModelky("Anna")[0].Tags, "Vysoké blondýny") {
		t.Fatalf("zmrazení modelek: %+v", z)
	}

	// Export a import
	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(export), "chytre_vybery:") || !strings.Contains(string(export), "zapis: blond výška > 170") {
		t.Fatalf("export bez chytrých výběrů:\n%s", export)
	}
	b := novaTestovaciApp(t, nil)
	if v := b.importovat(export); v.Selhalo != "" || len(v.Chyby) != 0 || len(v.Opravy) != 0 {
		t.Fatalf("import: %+v", v)
	}
	vybery := b.GetChytreVybery("")
	if len(vybery) != 2 || vybery[0].Nazev != "Vysoké blondýny" || vybery[0].Popis != "nad 170 cm" || vybery[1].Galerie.Srdicka != "5" || vybery[0].Pocet != 2 {
		t.Fatalf("po importu: %+v", vybery)
	}
	// Druhý import výběry nezdvojí
	b.importovat(export)
	if len(b.GetChytreVybery("")) != 2 {
		t.Fatal("opakovaný import zdvojil výběry")
	}

	if !a.SmazatChytryVyber(f.ID) || len(a.GetChytreVybery("")) != 1 || a.SmazatChytryVyber(f.ID) {
		t.Fatal("smazání")
	}
}

// Dřívější uložené výběry Galerie se převedou na chytré výběry fotek
func TestPrevodVyberuGalerie(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.UlozitVyberGalerie("Staré", DotazGalerie{Srdicka: "4", Typy: []string{"Pictorial"}})
	v := a.GetChytreVybery("")
	if len(v) != 1 || v[0].Druh != DruhVyberuFotky || v[0].Galerie.Srdicka != "4" || len(a.GetVyberyGalerie()) != 0 {
		t.Fatalf("převod: %+v", v)
	}
	if len(a.GetChytreVybery("")) != 1 {
		t.Fatal("převod se opakoval")
	}
}

// Odznak +N: co přibylo od posledního otevření; otevření ho vynuluje; Dnešní výběr jen z modelek výběru
func TestNovinkyVyberu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", VlasyBarva: "blond", Tetovani: -1, Piercing: -1})
	v := a.UlozitChytryVyber(ChytryVyber{Nazev: "Blond", Druh: DruhVyberuModelky, Text: "vlasy:blond"})
	nove := func() int { return a.GetChytreVybery(DruhVyberuModelky)[0].Nove }
	if n := nove(); n != 0 {
		t.Fatalf("hned po uložení: %d", n)
	}
	a.AddModelka(Modelka{Jmeno: "Bára", VlasyBarva: "blond", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Cecílie", VlasyBarva: "blond", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Dana", VlasyBarva: "černá", Tetovani: -1, Piercing: -1})
	if n := nove(); n != 2 {
		t.Fatalf("přibyly dvě blond: %d", n)
	}
	a.OznacitVyberVideny(v.ID)
	if n := nove(); n != 0 {
		t.Fatalf("po otevření: %d", n)
	}
	if s := a.GetObsahChytrehoVyberu(v.ID, 100); s.Pocet != 3 || len(s.Modelky) != 3 {
		t.Fatalf("obsah: %+v", s)
	}
	dana := idModelky(t, a, "Dana")
	if m := a.modelkyVyberu(v.ID); len(m) != 3 || m[dana] {
		t.Fatalf("modelky výběru: %v", m)
	}
	if !a.SmazatChytryVyber(v.ID) || a.nastaveni(predponaVidenoVyberu+v.ID) != "" {
		t.Fatal("smazání má uklidit i viděné")
	}
}
