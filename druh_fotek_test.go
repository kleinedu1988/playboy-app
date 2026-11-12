package main

import (
	"strings"
	"testing"
)

func TestSkupinaDruhu(t *testing.T) {
	s := skupinaDruhu([]FotkaDruhu{{DriveID: "a", Jistota: 0.9}, {DriveID: "b", Jistota: 0.99}, {DriveID: "c", Jistota: 0.95}}, 2)
	if s.Celkem != 3 || len(s.Fotky) != 2 || s.Fotky[0].DriveID != "b" || s.Fotky[1].DriveID != "c" || s.Fotky[0].URL == "" {
		t.Fatalf("skupina %+v", s)
	}
	if p := skupinaDruhu(nil, 24); p.Fotky == nil || p.Celkem != 0 {
		t.Fatalf("prázdná skupina %+v", p)
	}
}

func TestNavrhyDruhuBezObsahu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	v := a.GetNavrhyDruhu(24)
	if v.Muz.Fotky == nil || v.Zeny.Fotky == nil || v.Muz.Celkem+v.Zeny.Celkem != 0 {
		t.Fatalf("bez obsahu %+v", v)
	}
}

func TestPotvrzenyDruhFotky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Druh Test", Tetovani: -1, Piercing: -1})
	m := modelkaPodleJmenaApp(t, a, "Druh Test")
	a.AddBulkPhotos(m.ID, "Album", "Pictorial", odkazA+" "+odkazB)

	if a.SetDruhFotek([]string{idA}, "nesmysl") != 0 || a.SetDruhFotek([]string{"neni-ve-sbirce-123"}, "sex") != 0 {
		t.Fatal("uložil se neznámý druh nebo soubor mimo sbírku")
	}
	if n := a.SetDruhFotek([]string{idA, idB}, "lesbicka"); n != 2 {
		t.Fatalf("potvrzeno %d", n)
	}
	a.SetDruhFotek([]string{idB}, "muz")
	if a.GetDruhFotky(idA) != "lesbicka" || a.GetDruhFotky(idB) != "muz" {
		t.Fatalf("druhy %q %q", a.GetDruhFotky(idA), a.GetDruhFotky(idB))
	}

	export, err := a.exportovat()
	if err != nil {
		t.Fatal(err)
	}
	if text := string(export); !strings.Contains(text, "druh: lesbicka") || !strings.Contains(text, "druh: muz") {
		t.Fatalf("export druhu:\n%s", text)
	}
	b := novaTestovaciApp(t, nil)
	if r := b.importovat(export); r.Selhalo != "" || len(r.Chyby) != 0 {
		t.Fatalf("import: %+v", r)
	}
	if b.GetDruhFotky(idA) != "lesbicka" || b.GetDruhFotky(idB) != "muz" {
		t.Fatal("druh se importem nepřenesl")
	}
	// Import bez druhu ani s neznámým druhem potvrzení nesmaže
	if r := b.importovat([]byte(strings.ReplaceAll(string(export), "druh: lesbicka", "druh: jiny"))); r.Selhalo != "" {
		t.Fatalf("import s neznámým druhem: %+v", r)
	}
	if b.GetDruhFotky(idA) != "lesbicka" {
		t.Fatal("neznámý druh v importu přepsal potvrzený")
	}

	if a.SetDruhFotek([]string{idA}, "") != 1 || a.GetDruhFotky(idA) != "" {
		t.Fatal("potvrzení se nesmazalo")
	}
}
