package main

import (
	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	uc "pinup-katalog/internal/uceni"
	"testing"
)

// Klíč čísla s časopisem (0.02.001): RRRR-MM[-EDICE][@ČASOPIS], bez přípony Playboy
func TestKlicCislaSCasopisem(t *testing.T) {
	platne := []string{"1985-09@PH", "1986-03-UK@PH", "1985-S01@HU", "2009-11", "2009-11-CZ", "1995-S01"}
	for _, v := range platne {
		if !hledani.JePlatneVydani(v) || !sbirka.VzorVydani.MatchString(v) || !sbirka.VzorVydaniAlba.MatchString(v) {
			t.Errorf("%q má být platné vydání", v)
		}
	}
	for _, v := range []string{"1985-09@PB", "1985-09@ph", "1985-09@P", "1985-09@PHX", "1985-09-@PH", "1985@", "1985-13@PH"} {
		if hledani.JePlatneVydani(v) || sbirka.VzorVydani.MatchString(v) || sbirka.VzorVydaniAlba.MatchString(v) {
			t.Errorf("%q nemá být platné vydání", v)
		}
	}
	for _, v := range []string{"1985@PH", "1985-UK@PH", "1985", "1985-CZ"} {
		if !sbirka.VzorVydaniAlba.MatchString(v) {
			t.Errorf("ročník %q má být platné vydání alba", v)
		}
	}

	type casti struct {
		rok, mesic int
		edice      string
	}
	for v, cekano := range map[string]casti{
		"1985-09@PH":    {1985, 9, "PH/US"},
		"1986-03-UK@PH": {1986, 3, "PH/UK"},
		"1985-S01@HU":   {1985, 0, "HU/US"},
		"2012-03-CZ":    {2012, 3, "CZ"},
		"1975-06":       {1975, 6, "US"},
	} {
		if r, m, e, ok := sbirka.CastiVydani(v); !ok || (casti{r, m, e}) != cekano {
			t.Errorf("sbirka.CastiVydani(%q) = %d %d %q %v, čekáno %+v", v, r, m, e, ok, cekano)
		}
		if r, m, e, ok := uc.CastiVydani(v); !ok || (casti{r, m, e}) != cekano {
			t.Errorf("uc.CastiVydani(%q) = %d %d %q %v, čekáno %+v", v, r, m, e, ok, cekano)
		}
		if e := hledani.RadaKlice(v); e != cekano.edice {
			t.Errorf("RadaKlice(%q) = %q", v, e)
		}
	}
	for v, cekano := range map[string]string{"1985-09@PH": "PH/US", "1985-UK@PH": "PH/UK", "2012-03-CZ": "CZ", "1975-06": "", "1975": ""} {
		if e := sbirka.EdicePodleVydani(v); e != cekano {
			t.Errorf("EdicePodleVydani(%q) = %q, čekáno %q", v, e, cekano)
		}
	}
	if zaklad, c := hledani.RozdelitCasopis("1986-03-UK@PH"); zaklad != "1986-03-UK" || c != "PH" {
		t.Errorf("RozdelitCasopis: %q %q", zaklad, c)
	}
	if uc.JeSpecial("1985-09@PH") || !uc.JeSpecial("1985-S01@PH") || !uc.JePlatneCislo("1985-09@PH") {
		t.Error("speciál a platné číslo jiného časopisu")
	}
	if v := uc.VekKVydani("1965-03-01", "1985-09@PH"); v != 20 {
		t.Errorf("věk k číslu Penthouse: %d", v)
	}
	for v, cekano := range map[string][4]string{
		"1975": {"1975", "", "", "ano"}, "1975-CZ": {"1975", "CZ", "", "ano"}, "1975@PH": {"1975", "", "PH", "ano"},
		"1975-UK@PH": {"1975", "UK", "PH", "ano"}, "1975-06@PH": {"", "", "", ""},
	} {
		rok, edice, casopis, jen := rozlozitRocnik(v)
		ano := map[bool]string{true: "ano"}[jen]
		if [4]string{rok, edice, casopis, ano} != cekano {
			t.Errorf("rozlozitRocnik(%q) = %q %q %q %v", v, rok, edice, casopis, jen)
		}
	}
}

// Stránka čísla a ročníku drží časopisy od sebe: Playboy 09/1985 neukáže Penthouse 09/1985 a naopak
func TestCislaRuznychCasopisuOdSebe(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Pet", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Playmate", Tetovani: -1, Piercing: -1})
	var pet, pm int
	for _, m := range a.GetModelky("") {
		if m.Jmeno == "Pet" {
			pet = m.ID
		} else {
			pm = m.ID
		}
	}
	if v := a.AddBulkPhotos(pet, "1985-09@PH", "Centerfold", "https://drive.google.com/file/d/PPPPPPPPPPPPPPPPPPPPPPPPPPPPP/view"); v.Vlozeno != 1 {
		t.Fatalf("centerfold Penthouse se neuložil: %+v", v)
	}
	if v := a.AddBulkPhotos(pm, "1985-09", "Centerfold", "https://drive.google.com/file/d/QQQQQQQQQQQQQQQQQQQQQQQQQQQQQ/view"); v.Vlozeno != 1 {
		t.Fatalf("centerfold Playboy se neuložil: %+v", v)
	}
	jmena := func(fotky []Fotografie) []string {
		var j []string
		for _, f := range fotky {
			j = append(j, f.Album)
		}
		return j
	}
	for klic, cekano := range map[string]string{"1985-09@PH": "1985-09@PH", "1985-09": "1985-09", "1985@PH": "1985-09@PH", "1985": "1985-09"} {
		if f := a.GetVydani(klic); len(f) != 1 || f[0].Album != cekano {
			t.Errorf("GetVydani(%q) = %v, čekáno jen %s", klic, jmena(f), cekano)
		}
	}
	if a.AddBulkPhotos(pet, "1985-09@PB", "Centerfold", "https://drive.google.com/file/d/RRRRRRRRRRRRRRRRRRRRRRRRRRRRR/view").Vlozeno != 0 {
		t.Error("„@PB“ se nepíše, takový klíč se nemá uložit")
	}
}

func TestSpecialJinehoCasopisu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for edice, cekano := range map[string]string{"PH/US": "1985-S01@PH", "PH/UK": "1985-S01-UK@PH", "CZ": "1985-S01-CZ", "US": "1985-S01", "PB/US": "", "XX": "",
		"HU/UK": "", "XY/US": ""} {
		if klic := a.ZalozitSpecial(1985, edice, "Ročenka"); klic != cekano {
			t.Errorf("ZalozitSpecial(%q) = %q, čekáno %q", edice, klic, cekano)
		}
	}
}

// Tabulka časopisů (úprava č. 17): Playboy, Penthouse a Hustler předvyplněné; neznámý časopis ani edice neprojde
func TestTabulkaCasopisu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	c := a.GetCasopisy()
	if len(c) != 3 || c[0].Klic != "PB" || c[0].Nazev != "Playboy" || c[1].Klic != "PH" || c[1].ModelkaMesice != "Pet of the Month" || c[2].Klic != "HU" {
		t.Fatalf("předvyplněné časopisy: %+v", c)
	}
	if len(c[1].Edice) != 2 || c[1].Edice[0] != "US" || c[1].Edice[1] != "UK" {
		t.Fatalf("edice Penthouse: %v", c[1].Edice)
	}
	for rada, cekano := range map[string]bool{"US": true, "CZ": true, "": true, "PH/US": true, "PH/UK": true, "HU/US": true, "HU/UK": false, "XY/US": false, "PB/US": false, "DE": false} {
		if a.znamaRada(rada) != cekano {
			t.Errorf("znamaRada(%q) = %v", rada, !cekano)
		}
	}
	a.AddModelka(Modelka{Jmeno: "Honey", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	if a.AddBulkPhotos(id, "1985-09-UK@HU", "Centerfold", "https://drive.google.com/file/d/HHHHHHHHHHHHHHHHHHHHHHHHHHHHH/view").Vlozeno != 0 {
		t.Error("Hustler UK v tabulce není, centerfold se nemá uložit")
	}
	if a.AddBulkPhotos(id, "1985-09@HU", "Centerfold", "https://drive.google.com/file/d/HHHHHHHHHHHHHHHHHHHHHHHHHHHHH/view").Vlozeno != 1 {
		t.Error("centerfold Hustleru se má uložit")
	}
}

// Pictorial jde přiřadit k číslu jiného časopisu, jen když časopis a edici zná tabulka (0.02.005)
func TestPictorialJinehoCasopisu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Pet", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	a.AddBulkPhotos(id, "Pláž", "Pictorial", "https://drive.google.com/file/d/PPPPPPPPPPPPPPPPPPPPPPPPPPPPP/view")
	for vydani, cekano := range map[string]bool{"1985-09@PH": true, "1986-03-UK@PH": true, "1985@PH": true, "1985-09@XY": false, "1985-09-UK@HU": false, "1985-09": true} {
		if a.SetVydaniAlba(id, "Pláž", "Pictorial", vydani) != cekano {
			t.Errorf("SetVydaniAlba(%q) = %v", vydani, !cekano)
		}
	}
}
