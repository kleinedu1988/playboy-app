package main

import "testing"

func TestAlbumTematu(t *testing.T) {
	for _, c := range []struct {
		typ, vydani, datum string
		rok, mesic         int
		edice, druh        string
	}{
		{"Centerfold", "1995-06", "", 1995, 6, "US", "centerfold"},
		{"Pictorial", "2003-12-CZ", "", 2003, 12, "CZ", "pictorial"},
		{"Pictorial", "1998-S01", "", 1998, 0, "US", "pictorial"},
		{"Pictorial", "", "", 0, 0, "", "pictorial"},
		{typOnline, "", "2014-07-02", 2014, 7, "", "online"},
		{typCGMesice, "", "", 0, 0, "", "cg"},
	} {
		al := noveAlbumTematu(c.typ, c.vydani, c.datum)
		if al.rok != c.rok || al.mesic != c.mesic || al.edice != c.edice || al.druh != c.druh {
			t.Errorf("%+v: %+v", c, al)
		}
	}
	al := noveAlbumTematu("Centerfold", "1995-06", "")
	for _, c := range []struct {
		klic, hodnota string
		ano           bool
	}{
		{"obdobi", "1990-1999", true}, {"obdobi", "1980-1989", false}, {"mesic", "06", true}, {"mesic", "07", false},
		{"edice", "US", true}, {"edice", "CZ", false}, {"album", "centerfold", true}, {"album", "pictorial", false},
	} {
		if al.splnuje(c.klic, c.hodnota) != c.ano {
			t.Errorf("%s=%s: čekáno %v", c.klic, c.hodnota, c.ano)
		}
	}
	if (&albumTematu{}).splnuje("obdobi", "1990-1999") || (&albumTematu{}).splnuje("edice", "US") {
		t.Error("album bez vydání nemá splnit éru ani edici")
	}
	for _, spatny := range []string{"fotka:obdobi=1999-1990", "fotka:obdobi=199x", "fotka:mesic=6", "fotka:mesic=13", "fotka:edice=DE", "fotka:album=Centerfold", "fotka:barva=1"} {
		if temaZKlice(spatny) != nil {
			t.Errorf("neplatný klíč %q prošel", spatny)
		}
	}
	for klic, nazev := range map[string]string{
		"fotka:obdobi=1990-1999":                 "Zlatá devadesátá",
		"fotka:obdobi=1950-1959":                 "50. léta",
		"fotka:obdobi=1995-2005":                 "1995–2005",
		"fotka:edice=CZ+tag:podpatky":            "Česká edice · Podpatky",
		"fotka:album=pmr":                        "Playmate roku",
		"fotka:mesic=12+modelka:vlasy=zrzav":     "Prosincová čísla · zrzky",
		"fotka:obdobi=1990-1999+tag:bikiny,plaz": "Léto devadesátých",
	} {
		if tm := temaZKlice(klic); tm == nil || tm.Nazev != nazev || tm.Klic != klic {
			t.Errorf("%q: %+v, čekáno %q", klic, tm, nazev)
		}
	}
}

// Éra v aplikaci: soutěží modelky s fotkami z alb vydaných v éře, náhledy jen z těch alb
func TestEraVAplikaci(t *testing.T) {
	puvodniFotek, puvodniModelek := minFotekTematu, minModelekTematu
	minFotekTematu, minModelekTematu = 1, 2
	defer func() { minFotekTematu, minModelekTematu = puvodniFotek, puvodniModelek }()

	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Anna", "Bára", "Cecílie"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		id := idModelky(t, a, j)
		a.AddBulkPhotos(id, "Devadesátky", "Pictorial", odkazA)
		a.AddBulkPhotos(id, "Nové", "Pictorial", odkazB)
	}
	ida, idb, idc := idModelky(t, a, "Anna"), idModelky(t, a, "Bára"), idModelky(t, a, "Cecílie")
	a.db.Exec(`UPDATE alba SET vydani = '1996-07' WHERE album = 'Devadesátky' AND modelka_id IN (?, ?)`, ida, idb)
	a.db.Exec(`UPDATE alba SET vydani = '2012-03' WHERE album = 'Nové' OR modelka_id = ?`, idc)
	for _, info := range a.GetTemataSezon() {
		switch info.Klic {
		case "fotka:obdobi=1990-1999":
			if info.Soutezicich != 2 || info.Fotek != 2 || !info.Plati {
				t.Errorf("devadesátá: %+v", info)
			}
		case "fotka:obdobi=2010-2019":
			if info.Soutezicich != 3 {
				t.Errorf("desátá léta: %+v", info)
			}
		}
	}
	n := a.GetNahledyTematu([]int{ida, idc}, 10, "fotka:obdobi=1990-1999")
	if len(n[ida]) != 1 || len(n[idc]) != 0 {
		t.Errorf("náhledy éry: %+v", n)
	}
}
