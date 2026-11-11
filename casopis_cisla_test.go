package main

import (
	"fmt"
	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	uc "pinup-katalog/internal/uceni"
	"sort"
	"strings"
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

// Číslo Penthouse je v seznamu čísel a centerfoldů modelky (profil z něj otevírá stránku čísla, 0.02.006)
func TestCisloJinehoCasopisuVProfilu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Pet", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	a.AddBulkPhotos(id, "1985-09@PH", "Centerfold", "https://drive.google.com/file/d/PPPPPPPPPPPPPPPPPPPPPPPPPPPPP/view")
	m := a.GetModelky("")[0]
	ma := func(seznam []string) bool {
		for _, v := range seznam {
			if v == "1985-09@PH" {
				return true
			}
		}
		return false
	}
	if !ma(m.Vydani) || !ma(m.Centerfoldy) {
		t.Fatalf("vydání %v, centerfoldy %v", m.Vydani, m.Centerfoldy)
	}
	if f := a.GetVydani("1985-09@PH"); len(f) != 1 || f[0].ModelkaID != id {
		t.Fatalf("stránka čísla: %+v", f)
	}
}

// Desetiletí ve Statistikách počítají jen čísla Playboye (0.02.007)
func TestDesetiletiJenPlayboy(t *testing.T) {
	kal := []sbirka.VydaniKalendare{{Vydani: "1985-09"}, {Vydani: "1985-09@PH"}, {Vydani: "1986-03-UK@PH"}, {Vydani: "1985-10-CZ"}}
	s := sbirka.SpocitatStatistiky(nil, map[int]int{}, nil, nil, kal)
	if len(s.Desetileti) != 1 || s.Desetileti[0].Cisla != 2 || s.Desetileti[0].Edice["US"] != 1 || s.Desetileti[0].Edice["CZ"] != 1 {
		t.Fatalf("desetiletí: %+v", s.Desetileti)
	}
}

// Pictorial modelky měsíce a roku (v okně alba Pet of the Month / Year) k číslu Penthouse se uloží (0.02.011)
func TestPictorialPetOfTheMonth(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Pet", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	a.AddBulkPhotos(id, "Pet měsíce", "Playmate měsíce", "https://drive.google.com/file/d/MMMMMMMMMMMMMMMMMMMMMMMMMMMMM/view")
	a.AddBulkPhotos(id, "Pet roku", "Playmate roku", "https://drive.google.com/file/d/RRRRRRRRRRRRRRRRRRRRRRRRRRRRR/view")
	if !a.SetVydaniAlba(id, "Pet měsíce", "Playmate měsíce", "1985-09@PH") || !a.SetVydaniAlba(id, "Pet roku", "Playmate roku", "1986-S01-UK@PH") {
		t.Fatal("pictorial Pet of the Month / Year se k číslu Penthouse neuložil")
	}
	if f := a.GetVydani("1985-09@PH"); len(f) != 1 {
		t.Fatalf("číslo Penthouse: %d fotek", len(f))
	}
}

// Kategorie podle časopisu (0.02.012): Penthouse dá Pet of the Month / Year, ne Playmate; hledání kategorie: najde
func TestKategoriePetOfTheMonth(t *testing.T) {
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
	odkaz := func(z string) string { return "https://drive.google.com/file/d/" + strings.Repeat(z, 29) + "/view" }
	a.AddBulkPhotos(pet, "1985-09@PH", "Centerfold", odkaz("P"))
	a.AddBulkPhotos(pet, "Pet roku", "Playmate roku", odkaz("R"))
	a.SetVydaniAlba(pet, "Pet roku", "Playmate roku", "1986-S01@PH")
	a.AddBulkPhotos(pm, "1987-02", "Centerfold", odkaz("M"))
	m := modelkaPodleJmena(t, a, "Pet")
	if m.PlaymateMesice || m.PlaymateRoku != "" || fmt.Sprint(m.TitulyJinde) != "[{Pet of the Month } {Pet of the Year 1986}]" {
		t.Fatalf("tituly: mesice %v, roku %q, jinde %v", m.PlaymateMesice, m.PlaymateRoku, m.TitulyJinde)
	}
	jmena := func(dotaz string) string {
		var v []string
		for _, x := range a.GetModelky(dotaz) {
			v = append(v, x.Jmeno)
		}
		return strings.Join(v, ",")
	}
	if j := jmena(`kategorie:"pet of the month"`); j != "Pet" {
		t.Fatalf("kategorie Pet of the Month: %q", j)
	}
	if j := jmena(`kategorie:"playmate mesice"`); j != "Playmate" {
		t.Fatalf("kategorie Playmate měsíce: %q", j)
	}
	if j := jmena(`kategorie:"pet of the year"`); j != "Pet" {
		t.Fatalf("kategorie Pet of the Year: %q", j)
	}
}

// Správa časopisů (0.02.013): nový časopis jde hned použít, použitou edici ani časopis s čísly nejde ubrat
func TestSpravaCasopisu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	if e := a.UlozitCasopis(Casopis{Klic: "ou", Nazev: "Oui", Barva: "#00897b", Edice: []string{"us", "FR"}, ModelkaMesice: "Girl of the Month"}, true); e != "" {
		t.Fatal(e)
	}
	if e := a.UlozitCasopis(Casopis{Klic: "OU", Nazev: "Oui", Edice: []string{"US"}}, true); e == "" {
		t.Fatal("druhý časopis se stejnou zkratkou se založil")
	}
	for _, c := range []Casopis{{Klic: "O", Nazev: "X", Edice: []string{"US"}}, {Klic: "OX", Nazev: " ", Edice: []string{"US"}},
		{Klic: "OX", Nazev: "X", Edice: []string{"USA"}}, {Klic: "OX", Nazev: "X", Barva: "zelená", Edice: []string{"US"}}, {Klic: "OX", Nazev: "X"}} {
		if e := a.UlozitCasopis(c, true); e == "" {
			t.Fatalf("neplatný časopis %+v se uložil", c)
		}
	}
	c := a.GetCasopisy()
	if len(c) != 4 || c[3].Klic != "OU" || fmt.Sprint(c[3].Edice) != "[US FR]" || c[3].Poradi != 4 {
		t.Fatalf("časopisy: %+v", c)
	}
	// Nový časopis jde hned použít v albu
	a.AddModelka(Modelka{Jmeno: "Oui", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	a.AddBulkPhotos(id, "Paříž", "Pictorial", "https://drive.google.com/file/d/OOOOOOOOOOOOOOOOOOOOOOOOOOOOO/view")
	if !a.SetVydaniAlba(id, "Paříž", "Pictorial", "1980-05-FR@OU") {
		t.Fatal("album k číslu nového časopisu se neuložilo")
	}
	if e := a.UlozitCasopis(Casopis{Klic: "OU", Nazev: "Oui!", Edice: []string{"US"}}, false); !strings.Contains(e, "FR") {
		t.Fatalf("použitá edice FR šla ubrat: %q", e)
	}
	if e := a.UlozitCasopis(Casopis{Klic: "OU", Nazev: "Oui!", Edice: []string{"FR", "UK"}}, false); e != "" {
		t.Fatal(e)
	}
	if e := a.SmazatCasopis("OU"); e == "" {
		t.Fatal("časopis s čísly se smazal")
	}
	if e := a.SmazatCasopis("PB"); e == "" {
		t.Fatal("Playboy se smazal")
	}
	// Playboy: název a tituly jdou změnit, edice zůstanou
	if e := a.UlozitCasopis(Casopis{Klic: "PB", Nazev: "Playboy", Edice: []string{"US"}, ModelkaMesice: "Playmate měsíce", ModelkaRoku: "Playmate roku"}, false); e != "" {
		t.Fatal(e)
	}
	if fmt.Sprint(a.GetCasopisy()[0].Edice) != "[US CZ]" {
		t.Fatalf("edice Playboye: %v", a.GetCasopisy()[0].Edice)
	}
	// Nepoužitý časopis jde smazat
	if e := a.SmazatCasopis("HU"); e != "" {
		t.Fatal(e)
	}
	if len(a.GetCasopisy()) != 3 {
		t.Fatal("Hustler se nesmazal")
	}
}

// Hledání casopis: (0.02.019): název i zkratka, modelka ze dvou časopisů se najde pod oběma
func TestHledaniCasopis(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"Pet", "Playmate", "Obě"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
	}
	id := map[string]int{}
	for _, m := range a.GetModelky("") {
		id[m.Jmeno] = m.ID
	}
	odkaz := func(z string) string { return "https://drive.google.com/file/d/" + strings.Repeat(z, 29) + "/view" }
	a.AddBulkPhotos(id["Pet"], "1985-09@PH", "Centerfold", odkaz("P"))
	a.AddBulkPhotos(id["Playmate"], "1987-02", "Centerfold", odkaz("M"))
	a.AddBulkPhotos(id["Obě"], "1988-04", "Centerfold", odkaz("O"))
	a.AddBulkPhotos(id["Obě"], "1990-01-UK@PH", "Centerfold", odkaz("U"))
	jmena := func(dotaz string) string {
		var v []string
		for _, x := range a.GetModelky(dotaz) {
			v = append(v, x.Jmeno)
		}
		sort.Strings(v)
		return strings.Join(v, ",")
	}
	for dotaz, chci := range map[string]string{
		"casopis:penthouse": "Obě,Pet", "casopis:ph": "Obě,Pet", "casopis:playboy": "Obě,Playmate", "casopis:pb": "Obě,Playmate",
		"casopis:hustler": "", "-casopis:penthouse": "Playmate", "casopis:penthouse rok:1985": "Pet",
	} {
		if j := jmena(dotaz); j != chci {
			t.Errorf("%s: %q, chci %q", dotaz, j, chci)
		}
	}
}

// Vkus u jiných časopisů (0.02.022): Pet není „Playmate měsíce“, obálka Penthouse není „obálka Playboye“
func TestVkusTitulyJinde(t *testing.T) {
	if f := frazeRole("Pet of the Month"); f != "byla Pet of the Month" {
		t.Errorf("fráze titulu: %q", f)
	}
	if obalkaPlayboye([]string{"1987-02@PH"}) || !obalkaPlayboye([]string{"1987-02@PH", "1988-01"}) {
		t.Error("obálka Playboye")
	}
	pet := Modelka{Centerfoldy: []string{"1985-09@PH"}}
	if hledani.CenterfoldPlayboye(&pet) {
		t.Error("centerfold Penthouse není centerfold Playboye")
	}
}

// Další jména s časopisem (0.02.027): normalizace při uložení, export a porovnávání bez přípony
func TestPrezdivkyCasopisu(t *testing.T) {
	if s := hledani.NormalizovatDalsiJmena(" Jane Doe@ph , Ann,, Kate @HU "); s != "Jane Doe @PH, Ann, Kate @HU" {
		t.Errorf("normalizace: %q", s)
	}
	if j := strings.Join(hledani.DalsiJmena("Jane Doe @PH, Ann"), "|"); j != "Jane Doe|Ann" {
		t.Errorf("jména: %q", j)
	}
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Sylvie", DalsiJmena: "Jane Doe@ph", Tetovani: -1, Piercing: -1})
	m := a.GetModelky("")[0]
	if m.DalsiJmena != "Jane Doe @PH" {
		t.Fatalf("uloženo: %q", m.DalsiJmena)
	}
	data, err := a.exportovat()
	if err != nil || !strings.Contains(string(data), "dalsi_jmena: Jane Doe @PH") {
		t.Errorf("přezdívka chybí v exportu (%v)", err)
	}
}

// Hledání podle přezdívky s časopisem (0.02.028): jméno se najde, přípona časopisu se jako text nehledá
func TestHledaniPrezdivky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Sylvie", DalsiJmena: "Jane Doe @PH", Tetovani: -1, Piercing: -1})
	for dotaz, chci := range map[string]int{"jane": 1, `jmeno:"jane doe"`: 1, "jmeno:sylvie": 1, "@ph": 0} {
		if n := len(a.GetModelky(dotaz)); n != chci {
			t.Errorf("%s: %d, chci %d", dotaz, n, chci)
		}
	}
}

// Vizuální důvod sloučení z databáze (0.02.030): stejný soubor fotky u obou modelek
func TestSlouceniStejnaFotka(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Jane Doe", NarozeniDatum: "1965-03-12", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Jane Doe", NarozeniDatum: "1965-03-12", Tetovani: -1, Piercing: -1})
	m := a.GetModelky("")
	odkaz := "https://drive.google.com/file/d/" + strings.Repeat("S", 29) + "/view"
	a.AddBulkPhotos(m[0].ID, "1985-09", "Centerfold", odkaz)
	a.AddBulkPhotos(m[1].ID, "1986-01@PH", "Centerfold", odkaz)
	duvody, skore := a.vizualniDuvodySlouceni()(m[0], m[1])
	if strings.Join(duvody, ",") != "stejná fotka u obou" || skore < 1 {
		t.Errorf("důvody %v, skóre %v", duvody, skore)
	}
}

// Album bez čísla a údaje „Penthouse říjen 1970“ (Heide Mann, 0.02.036): titul Pet of the Month, ne Playmate
func TestAlbumBezCislaZTextu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Heide Mann", Vystoupeni: "Penthouse říjen 1970", PictorialVydani: "1970-10", Tetovani: -1, Piercing: -1})
	m := a.GetModelky("")[0]
	odkaz := "https://drive.google.com/file/d/" + strings.Repeat("H", 29) + "/view"
	a.AddBulkPhotos(m.ID, "Pet of the Month October 1970", typPMMesice, odkaz)
	a.db.Exec(`UPDATE alba SET vydani = '' WHERE modelka_id = ?`, m.ID)
	m = a.GetModelky("")[0]
	if m.PlaymateMesice || m.PictorialVydani != "1970-10@PH" || strings.Join(m.Vydani, ",") != "1970-10@PH" ||
		len(m.TitulyJinde) != 1 || m.TitulyJinde[0].Nazev != "Pet of the Month" {
		t.Fatalf("playmate %v, textová %q, vydání %v, tituly %+v", m.PlaymateMesice, m.PictorialVydani, m.Vydani, m.TitulyJinde)
	}
}

// Titul z prázdného centerfoldu a z pictorialu pojmenovaného jako titul (0.02.038): Allison Parks má prázdné album
// Centerfold 1965-10 a pictorialy „Playmate of the Month October 1965“ a „Playmate of the Year 1966“
func TestTitulZPrazdnehoCenterfolduANazvuAlba(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Allison Parks", Role: "PMOTM, PMOTY, Model", Tetovani: -1, Piercing: -1})
	m := a.GetModelky("")[0]
	odkaz := func(z string) string { return "https://drive.google.com/file/d/" + strings.Repeat(z, 29) + "/view" }
	a.AddBulkPhotos(m.ID, "1965-10", "Centerfold", odkaz("C"))
	a.db.Exec(`DELETE FROM fotky WHERE album_id IN (SELECT id FROM alba WHERE typ = 'Centerfold')`)
	a.AddBulkPhotos(m.ID, "Playmate of the Month October 1965", "Pictorial", odkaz("M"))
	a.AddBulkPhotos(m.ID, "Playmate of the Year 1966", "Pictorial", odkaz("R"))
	a.db.Exec(`UPDATE alba SET vydani = '1966' WHERE album = 'Playmate of the Year 1966'`)
	m = a.GetModelky("")[0]
	if strings.Join(m.Centerfoldy, ",") != "1965-10" || !m.PlaymateMesice || m.PlaymateRoku != "1966" {
		t.Fatalf("centerfoldy %v, měsíce %v, roku %q", m.Centerfoldy, m.PlaymateMesice, m.PlaymateRoku)
	}
	for dotaz, chci := range map[string]int{`kategorie:"playmate mesice"`: 1, `kategorie:"playmate roku"`: 1, "kategorie:pmotm": 0} {
		if n := len(a.GetModelky(dotaz)); n != chci {
			t.Errorf("%s: %d modelek, chci %d", dotaz, n, chci)
		}
	}
	if typPodleNazvuAlba("Pictorial", "Penthouse Pet of the Year 2017") != typPMRoku || typPodleNazvuAlba("Pictorial", "Beach") != "Pictorial" ||
		typPodleNazvuAlba("Centerfold", "Playmate of the Month") != "Centerfold" {
		t.Error("typ podle názvu alba")
	}
}

// Modelka čísla v kalendáři (0.02.043): z centerfoldu bez fotek nebo z alba s titulem měsíce (hero Kalendáře a Obálek)
func TestKalendarModelkaCisla(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Lynnda Kimball", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Ulla Lindstrom", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Prázdná", Tetovani: -1, Piercing: -1})
	id := map[string]int{}
	for _, m := range a.GetModelky("") {
		id[m.Jmeno] = m.ID
	}
	odkaz := func(z string) string { return "https://drive.google.com/file/d/" + strings.Repeat(z, 29) + "/view" }
	a.AddBulkPhotos(id["Lynnda Kimball"], "1975-01", "Centerfold", odkaz("C"))
	a.db.Exec(`DELETE FROM fotky WHERE album_id IN (SELECT id FROM alba WHERE typ = 'Centerfold')`)
	a.AddBulkPhotos(id["Lynnda Kimball"], "Playmate of the Month January 1975", "Pictorial", odkaz("P"))
	a.AddBulkPhotos(id["Ulla Lindstrom"], "Pet of the Month November 1969", "Playmate měsíce", odkaz("U"))
	a.AddBulkPhotos(id["Prázdná"], "1980-02", "Centerfold", odkaz("E"))
	a.db.Exec(`DELETE FROM fotky WHERE album_id IN (SELECT id FROM alba WHERE album = '1980-02')`)
	a.db.Exec(`UPDATE alba SET vydani = '1975-01' WHERE album LIKE '%January 1975' OR album = '1975-01'`)
	a.db.Exec(`UPDATE alba SET vydani = '1969-11@PH' WHERE album LIKE 'Pet of the Month%'`)
	a.db.Exec(`UPDATE alba SET vydani = '1980-02' WHERE album = '1980-02'`)
	k := map[string]VydaniKalendare{}
	for _, v := range a.GetKalendar() {
		k[v.Vydani] = v
	}
	if v := k["1975-01"]; v.Centerfold || !v.Pictorial || v.Modelka != "" || v.ModelkaCisla != "Lynnda Kimball" || v.ModelkaOdkud != "centerfold" {
		t.Errorf("1975-01: %+v", v)
	}
	if v := k["1969-11@PH"]; v.ModelkaCisla != "Ulla Lindstrom" || v.ModelkaOdkud != "titul" {
		t.Errorf("1969-11@PH: %+v", v)
	}
	// Jen pictorialy jedné modelky (Leanna Decker 2012-11): ona; dvou různých: nikdo
	a.AddBulkPhotos(id["Ulla Lindstrom"], "Rock N' Roll Babe", "Pictorial", odkaz("R"))
	a.AddBulkPhotos(id["Ulla Lindstrom"], "I Wanna Be Watched", "Pictorial", odkaz("W"))
	a.AddBulkPhotos(id["Prázdná"], "Druhá", "Pictorial", odkaz("D"))
	a.db.Exec(`UPDATE alba SET vydani = '2012-11' WHERE album IN ('Rock N'' Roll Babe', 'I Wanna Be Watched')`)
	a.AddBulkPhotos(id["Ulla Lindstrom"], "Zimní", "Pictorial", odkaz("Z"))
	a.db.Exec(`UPDATE alba SET vydani = '2013-01' WHERE album IN ('Druhá', 'Zimní')`)
	k = map[string]VydaniKalendare{}
	for _, v := range a.GetKalendar() {
		k[v.Vydani] = v
	}
	if v := k["2012-11"]; v.ModelkaCisla != "Ulla Lindstrom" || v.ModelkaOdkud != "pictorial" {
		t.Errorf("2012-11: %+v", v)
	}
	if v := k["2013-01"]; v.ModelkaCisla != "" {
		t.Errorf("2013-01 se dvěma modelkami: %+v", v)
	}
	if _, je := k["1980-02"]; je || len(k) != 4 {
		t.Errorf("číslo jen s prázdným albem v kalendáři: %+v", k)
	}
}
