package main

import (
	"reflect"
	"testing"
)

// Kritérium: rok počítá fotky, alba a čísla podle první fotky, dny práce se sérií, nejlepší nové fotky (nejvýš dvě
// na modelku) a srovnání s loňskem; roky s prací jsou od nejnovějšího
func TestRokVeSbirce(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Letošní", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Loňská", Tetovani: -1, Piercing: -1})
	letos, lonska := idModelky(t, a, "Letošní"), idModelky(t, a, "Loňská")
	odkaz := func(c byte) string {
		b := make([]byte, 29)
		for i := range b {
			b[i] = c
		}
		return "https://drive.google.com/file/d/" + string(b) + "/view "
	}
	a.AddBulkPhotos(letos, "1995-06", "Centerfold", odkaz('C')+odkaz('D')+odkaz('E'))
	a.AddBulkPhotos(letos, "Pláž", "Pictorial", odkaz('F'))
	a.AddBulkPhotos(lonska, "1994-01", "Centerfold", odkaz('G'))
	exec := func(dotaz string, args ...any) {
		t.Helper()
		if _, err := a.db.Exec(dotaz, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`UPDATE modelky SET pridano = ? WHERE id = ?`, "2025-03-01 10:00:00", letos)
	exec(`UPDATE modelky SET pridano = ? WHERE id = ?`, "2024-12-30 10:00:00", lonska)
	// Fotky Letošní: 1. až 3. března (série 3 dní) a 10. května, srdíčka 5, 5, 4, 5
	dny := map[string][2]any{"CCCCCCCCCCCCCCCCCCCCCCCCCCCCC": {"2025-03-01 10:00:00", 5}, "DDDDDDDDDDDDDDDDDDDDDDDDDDDDD": {"2025-03-02 10:00:00", 5},
		"EEEEEEEEEEEEEEEEEEEEEEEEEEEEE": {"2025-03-03 10:00:00", 4}, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFF": {"2025-05-10 10:00:00", 5},
		"GGGGGGGGGGGGGGGGGGGGGGGGGGGGG": {"2024-12-30 10:00:00", 3}}
	for drive, d := range dny {
		exec(`UPDATE fotky SET pridano = ?, hodnoceni = ? WHERE drive_file_id = ?`, d[0], d[1], drive)
	}

	r := a.GetRokVeSbirce(2025)
	if r.Fotek != 4 || r.Alb != 2 || r.Cisel != 1 || !reflect.DeepEqual(r.NovaCisla, []string{"1995-06"}) {
		t.Fatalf("počty: fotek %d, alb %d, čísel %d %v", r.Fotek, r.Alb, r.Cisel, r.NovaCisla)
	}
	if r.Hodnocenych != 4 || r.Fotek5 != 3 || r.FotekLoni != 1 || r.ModelekLoni != 1 {
		t.Fatalf("srdíčka a loni: %+v", r)
	}
	if r.Mesice[2].Fotek != 3 || r.Mesice[2].Alb != 1 || r.Mesice[2].Modelek != 1 || r.Mesice[2].Dnu != 3 || r.Mesice[4].Fotek != 1 {
		t.Fatalf("měsíce: %+v", r.Mesice)
	}
	if r.DnuPrace != 4 || r.Serie != (SerieRoku{Dni: 3, Od: "2025-03-01", Do: "2025-03-03"}) {
		t.Fatalf("dny %d, série %+v", r.DnuPrace, r.Serie)
	}
	// Nejvýš dvě fotky jedné modelky: dvě pětky z března (dřív přidané), čtyřka ani třetí pětka už ne
	if len(r.Nejlepsi) != 2 || r.Nejlepsi[0].Hodnoceni != 5 || r.Nejlepsi[1].Hodnoceni != 5 || r.Nejlepsi[0].Jmeno != "Letošní" || r.Nejlepsi[0].URL == "" {
		t.Fatalf("nejlepší: %+v", r.Nejlepsi)
	}
	if !reflect.DeepEqual(r.Roky, []int{2025, 2024}) {
		t.Fatalf("roky %v", r.Roky)
	}
	// Loňský rok: čísla jen podle první fotky, letošní centerfold tam není
	l := a.GetRokVeSbirce(2024)
	if l.Fotek != 1 || l.Cisel != 1 || l.NovaCisla[0] != "1994-01" || len(l.Nejlepsi) != 0 || l.Serie.Dni != 1 {
		t.Fatalf("loni: %+v", l)
	}
}

func TestNejdelsiSerie(t *testing.T) {
	s := nejdelsiSerie([]string{"2025-01-30", "2025-01-31", "2025-02-01", "2025-02-05", "2025-02-06"})
	if s != (SerieRoku{Dni: 3, Od: "2025-01-30", Do: "2025-02-01"}) {
		t.Fatalf("%+v", s)
	}
	if nejdelsiSerie(nil).Dni != 0 {
		t.Fatal("prázdná")
	}
}
