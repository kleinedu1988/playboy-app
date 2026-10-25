package main

import (
	"database/sql"
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"regexp"
	"strings"
	"testing"
)

// Snímek sbírky se pamatuje, dokud se databáze nezmění, a každá změna (z okna, přímým SQL, jiným spojením,
// importem, obnovením zálohy, novou šablonou adres) ho zneplatní
func TestSnimekSbirkyPoZmene(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	jmeno := func() string {
		t.Helper()
		m := a.GetModelky("")
		if len(m) != 1 {
			t.Fatalf("modelek %d", len(m))
		}
		return m[0].Jmeno
	}
	if jmeno() != "Anna" {
		t.Fatal("první načtení")
	}
	prvni := a.pamet.snimek
	if jmeno(); a.pamet.snimek != prvni || prvni == nil {
		t.Fatal("beze změny dat se snímek načetl znovu")
	}

	m := a.GetModelky("")[0]
	m.Jmeno = "Anna Okno"
	a.UpdateModelka(m)
	if jmeno() != "Anna Okno" {
		t.Error("změna z okna")
	}
	a.db.Exec("UPDATE modelky SET jmeno = 'Anna SQL'")
	if jmeno() != "Anna SQL" {
		t.Error("změna přímým SQL")
	}
	jine, err := sql.Open("sqlite", a.cestaDb+dsnDatabaze)
	if err != nil {
		t.Fatal(err)
	}
	jine.Exec("UPDATE modelky SET jmeno = 'Anna Zvenku'")
	jine.Close()
	if jmeno() != "Anna Zvenku" {
		t.Error("změna jiným spojením")
	}
	if v := a.importovat([]byte("- jmeno: Anna Zvenku\n  poznamka: z importu\n")); v.Selhalo != "" {
		t.Fatal(v.Selhalo)
	}
	if a.GetModelky("")[0].Poznamka != "z importu" {
		t.Error("import")
	}

	// Adresa titulní fotky je ze šablony: nová šablona snímek zneplatní
	a.db.Exec("UPDATE modelky SET drive_cover_id = ?", idA)
	if url := a.GetModelky("")[0].CoverURL; !strings.Contains(url, "lh3.googleusercontent.com") {
		t.Fatalf("adresa titulní fotky %q", url)
	}
	puvodni, _ := sablonaObrazku.Load().(string)
	sablonaObrazku.Store("https://jinde.example/{id}")
	t.Cleanup(func() { sablonaObrazku.Store(puvodni) })
	if url := a.GetModelky("")[0].CoverURL; url != "https://jinde.example/"+idA {
		t.Errorf("adresa po změně šablony %q", url)
	}
	sablonaObrazku.Store(puvodni)

	// Obnovení zálohy vymění soubor databáze
	if err := a.zalohovat("test-snimku"); err != nil {
		t.Fatal(err)
	}
	a.db.Exec("UPDATE modelky SET jmeno = 'Po záloze'")
	if jmeno() != "Po záloze" {
		t.Fatal("změna po záloze")
	}
	for _, z := range a.SeznamZaloh() {
		if z.Duvod == "test-snimku" {
			if chyba := a.ObnovitZalohu(z.Soubor); chyba != "" {
				t.Fatal(chyba)
			}
		}
	}
	if jmeno() != "Anna Zvenku" {
		t.Error("obnovení zálohy")
	}
}

// Volající dostane kopii: úprava vrácených modelek a alb se do snímku (a dalších volání) nepromítne
func TestSnimekVraciKopie(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	a.AddBulkPhotos(id, "1975-03", "Centerfold", odkazA)
	m := a.GetModelky("")
	m[0].Jmeno = "Změněno"
	m[0].Vydani = append(m[0].Vydani, "2000-01")
	_, alba, _ := a.modelkyAAlba()
	alba[0].nazev = "Změněno"
	if n := a.GetModelky(""); n[0].Jmeno != "Anna" || len(n[0].Vydani) != 1 {
		t.Errorf("snímek se změnil: %+v", n[0])
	}
	if _, alba, _ := a.modelkyAAlba(); alba[0].nazev != "1975-03" {
		t.Error("alba ve snímku se změnila")
	}
	k := a.GetKalendar()
	k[0].Vydani = "Změněno"
	if a.GetKalendar()[0].Vydani != "1975-03" {
		t.Error("kalendář ve snímku se změnil")
	}
}

// Bez souboru databáze (dočasná databáze v paměti) ani v kopii pro import se snímek nepamatuje
func TestSnimekBezPameti(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	b := &App{uc: &uceni{}, pamet: &pametSbirky{}, db: a.db}
	b.AddModelka(Modelka{Jmeno: "Bez souboru", Tetovani: -1, Piercing: -1})
	if len(b.GetModelky("")) != 1 || b.pamet.snimek != nil {
		t.Error("snímek bez souboru databáze se zapamatoval")
	}
	imp := &App{db: a.db, cestaDb: a.cestaDb, vImportu: true, pamet: &pametSbirky{}}
	if len(imp.GetModelky("")) != 1 || imp.pamet.snimek != nil {
		t.Error("snímek kopie pro import se zapamatoval")
	}
}

// Otisk bez alokací dává stejné hodnoty jako hash/fnv (otisky uložené v mezipaměti učení platí dál)
func TestOtiskovacJakoFNV(t *testing.T) {
	o := novyOtiskovac()
	o.text("uceni-1", "", "Zoë Ödegaard")
	o.cisla(0, -1, 1<<40, 3000)
	o.text()
	h := fnv.New64a()
	for _, s := range []string{"uceni-1", "", "Zoë Ödegaard"} {
		h.Write([]byte(s))
		h.Write([]byte{0})
	}
	for _, c := range []int{0, -1, 1 << 40, 3000} {
		var b [8]byte
		for i := range b {
			b[i] = byte(uint64(c) >> (8 * i))
		}
		h.Write(b[:])
	}
	if o.hex() != hex.EncodeToString(h.Sum(nil)) {
		t.Errorf("otisk %s, hash/fnv %s", o.hex(), hex.EncodeToString(h.Sum(nil)))
	}
}

// Rychlé cesty dávají totéž co obecné
func TestRychleCestyTextu(t *testing.T) {
	for _, s := range []string{"usa", "U.S.A.", " praha ", "los  angeles", "a\tb", "Zoë", "new york", "x", "", "a b", "a b", "kanada."} {
		if mam, chci := klicTextu(s), strings.Join(strings.Fields(strings.ReplaceAll(zjednodusit(s), ".", "")), " "); mam != chci {
			t.Errorf("klicTextu(%q) = %q, čekám %q", s, mam, chci)
		}
	}
	vzor := regexp.MustCompile(`^[a-zA-Z0-9_-]{25,}$`)
	for _, s := range []string{idA, idA[:24], idA + "!", "a-b_c" + idA, "", "https://drive.google.com/file/d/" + idA, idA + " " + idB} {
		if jeHoleID(s) != vzor.MatchString(s) {
			t.Errorf("jeHoleID(%q)", s)
		}
	}
	for _, s := range []string{"ABC", "abc", "Zoë", "ÖDEGAARD", "Łódź", "straße", "", "O'Hara-Smith 2"} {
		if zjednodusit(zjednodusit(s)) != zjednodusit(s) {
			t.Errorf("zjednodusit(%q) není ustálené", s)
		}
	}
}

// Výběr: fotky se řadí za konec výběru v pořadí, jak přišly; opakovaná ani už přítomná fotka místo nezabere
func TestPridatDoVyberuPoradi(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	var odkazy []string
	for i := range 5 {
		odkazy = append(odkazy, fmt.Sprintf("%s%d", idA, i))
	}
	a.AddBulkPhotos(id, "Album", "Pictorial", strings.Join(odkazy, "\n"))
	f := a.GetFotografieModelky(id)
	vyber := a.VyberPodleNazvu("Výběr")
	if n := a.PridatDoVyberu(vyber, []int{f[2].ID, f[0].ID}); n != 2 {
		t.Fatalf("přidáno %d", n)
	}
	if n := a.PridatDoVyberu(vyber, []int{f[0].ID, f[4].ID, f[4].ID, f[1].ID}); n != 2 {
		t.Fatalf("přidáno podruhé %d", n)
	}
	var poradi []string
	for _, x := range a.GetFotkyVyberu(vyber) {
		poradi = append(poradi, x.DriveID[len(idA):])
	}
	if strings.Join(poradi, "") != "2041" {
		t.Errorf("pořadí ve výběru %v", poradi)
	}
	radky, _ := a.db.Query("SELECT poradi FROM vybery_fotky WHERE vyber_id = ? ORDER BY poradi", vyber)
	defer radky.Close()
	for i := 1; radky.Next(); i++ {
		var p int
		radky.Scan(&p)
		if p != i {
			t.Errorf("pořadí %d místo %d", p, i)
		}
	}
}

// Hromadné vložení: soubory, které v albu už jsou, se přeskočí i při stovkách odkazů (dotaz po částech)
func TestAddBulkPhotosMnohoOdkazu(t *testing.T) {
	a := novaTestovaciApp(t, map[string]int{idB + "0007": souborNedostupny, idB + "0008": souborNeoveren})
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	id := a.GetModelky("")[0].ID
	var odkazy []string
	for i := range 700 {
		odkazy = append(odkazy, fmt.Sprintf("https://drive.google.com/file/d/%s%04d/view", idB, i))
	}
	v := a.AddBulkPhotos(id, "Album", "Pictorial", strings.Join(odkazy[:600], "\n"))
	if v.Vlozeno != 599 || v.Nedostupne != 1 || v.Neovereno != 1 || v.Duplicitni != 0 {
		t.Fatalf("první vložení %+v", v)
	}
	v = a.AddBulkPhotos(id, "Album", "Pictorial", strings.Join(odkazy, " "))
	// Nedostupný soubor se zkouší znovu (a znovu se nevloží)
	if v.Vlozeno != 100 || v.Duplicitni != 599 || v.Nedostupne != 1 {
		t.Fatalf("druhé vložení %+v", v)
	}
	if n := len(a.GetFotografieModelky(id)); n != 699 {
		t.Errorf("fotek %d", n)
	}
	// Stejný soubor v jiném albu duplicitou není
	if v := a.AddBulkPhotos(id, "Jiné", "Pictorial", odkazy[0]); v.Vlozeno != 1 || v.Duplicitni != 0 {
		t.Errorf("jiné album %+v", v)
	}
}
