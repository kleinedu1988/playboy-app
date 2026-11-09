package main

import (
	"strconv"
	"testing"
)

func TestVydaniZOdkazu(t *testing.T) {
	for text, v := range map[string]string{"06/1995": "1995-06", "6/1995": "1995-06", "06/1995 DE": "1995-06-DE", "06/1995-de": "1995-06-DE",
		"1995-06": "1995-06", "1995-06-CZ": "1995-06-CZ", "1995-S01": "1995-S01", "13/1995": "", "Pamela Anderson": "", "1995": ""} {
		if got := vydaniZOdkazu(text); got != v {
			t.Errorf("%q: %q, chci %q", text, got, v)
		}
	}
}

// Kritérium hotovo: [[06/1995]] v poznámce modelky → modelka je ve „Zmiňováno v…“ čísla 06/1995; odkazy na
// modelku z článku, alba, poznámky čísla a jiné modelky (i přes další jméno a bez diakritiky)
func TestZminky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna Testová", DalsiJmena: "Anička", Poznamka: "Fotila se pro **[[06/1995]]** a znala [[Bára Další|Báru]].", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Bára Další", Poznamka: "Odkaz sama na sebe [[Bára Další]].", Tetovani: -1, Piercing: -1})
	anna, bara := idModelky(t, a, "Anna Testová"), idModelky(t, a, "Bára Další")
	a.AddBulkPhotos(bara, "1995-07", "Centerfold", odkazA)
	if !a.SetPopisAlba(bara, "1995-07", "Centerfold", "Kamarádka [[anicka]] u bazénu.", "") {
		t.Fatal("popis alba")
	}
	a.AddClanek(Clanek{Vydani: "1995-08", Nazev: "Rozhovor", Text: "PLAYBOY: Co [[Anna Testová]]?\nNic. Viz [[1995-06]]."})
	a.SetVydaniInfo("1995-09", "Ohlédnutí za [[06/1995]] a [[Bára Další]].", "", 0, "")
	a.SetVydaniInfo("1995-06", "Vlastní číslo [[06/1995]] se nepočítá.", "", 0, "")

	druhy := func(z []Zminka) map[string]Zminka {
		v := map[string]Zminka{}
		for _, x := range z {
			v[x.Druh] = x
		}
		return v
	}
	z := druhy(a.GetZminky("vydani", "1995-06"))
	if len(z) != 3 || z["modelka"].ModelkaID != anna || z["clanek"].Nazev != "Rozhovor" || z["cislo"].Vydani != "1995-09" {
		t.Fatalf("zmínky čísla: %+v", z)
	}
	if u := z["modelka"].Uryvek; u != "Fotila se pro 06/1995 a znala Báru." {
		t.Errorf("úryvek: %q", u)
	}
	z = druhy(a.GetZminky("modelka", strconv.Itoa(anna)))
	if len(z) != 2 || z["album"].ModelkaID != bara || z["album"].Vydani != "1995-07" || z["clanek"].Vydani != "1995-08" {
		t.Fatalf("zmínky Anny: %+v", z)
	}
	z = druhy(a.GetZminky("modelka", strconv.Itoa(bara)))
	if len(z) != 2 || z["modelka"].ModelkaID != anna || z["cislo"].Vydani != "1995-09" {
		t.Fatalf("zmínky Báry (bez odkazu sama na sebe): %+v", z)
	}
}
