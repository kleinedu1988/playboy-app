package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func falesnaWikipedie(t *testing.T, stranky map[string]string) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		stranka := strings.ReplaceAll(r.URL.Query().Get("page"), "_", " ")
		if text, ok := stranky[stranka]; ok {
			json.NewEncoder(w).Encode(map[string]any{"parse": map[string]any{"title": stranka, "wikitext": text}})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": "missingtitle", "info": "missing"}})
	}))
	puvodni, puvodniIt, puvodniOdstup := adresaWikipedie, adresaWikipedieIt, odstupDotazu
	adresaWikipedie, adresaWikipedieIt, odstupDotazu = server.URL, server.URL+"/it", time.Millisecond
	zdrojeZamek.Lock()
	zdrojeMezipamet = map[string][]byte{}
	zdrojeZamek.Unlock()
	t.Cleanup(func() {
		server.Close()
		adresaWikipedie, adresaWikipedieIt, odstupDotazu = puvodni, puvodniIt, puvodniOdstup
	})
}

func infobox(jmeno string) string {
	return "{{Infobox Playboy Playmate\n| name = " + jmeno + "\n| height = 5 ft 6 in\n}}\nText.\n"
}

// Kritérium: ročník proti Wikipedii ukáže shodu, překlep, jiný měsíc, jiné jméno, chybějící i Playmate roku
func TestRocnikPodleWikipedie(t *testing.T) {
	falesnaWikipedie(t, map[string]string{
		"List of Playboy Playmates of 1995": "Úvod\n==January==\n" + infobox("Anna Testová") +
			"==February==\n" + infobox("Bára Dvojče") + infobox("Cecílie Dvojče") +
			"==March==\n" + infobox("Dana Preklepová") + "==April==\n" + infobox("Eva Jinde") +
			"==May==\n" + infobox("Gina Úplně Jiná") + "==June==\n" + infobox("Hana Chybí") + "==See also==\n",
		"List of Playboy Playmates of the Year": "*1994: [[Někdo]]\n*1995: [[Anna Testová]]\n*1996: [[List of Playboy Playmates of 1995#March|Stacy]]\n",
	})
	a := novaTestovaciApp(t, nil)
	pridat := func(jmeno, vydani, typ string) int {
		a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1})
		id := idModelky(t, a, jmeno)
		if vydani != "" {
			a.AddBulkPhotos(id, vydani, typ, odkazA)
		}
		return id
	}
	anna := pridat("Anna Testová", "1995-01", "Centerfold")
	a.AddBulkPhotos(anna, "Playmate roku 1995", "Playmate roku", odkazB)
	a.SetVydaniAlba(anna, "Playmate roku 1995", "Playmate roku", "1995-06")
	pridat("Bára Dvojče", "1995-02", "Centerfold")
	dana := pridat("Dana Preklepova Smith", "", "")
	_ = dana
	pridat("Dana Prekleppová", "1995-03", "Centerfold")
	pridat("Eva Jinde", "1995-05", "Centerfold")
	pridat("Fiona Zcela", "1995-05", "Centerfold")

	r := a.RocnikPodleWikipedie(1995)
	if r.Chyba != "" {
		t.Fatal(r.Chyba)
	}
	stavy := map[string]string{}
	for _, x := range r.Radky {
		stavy[x.Jmeno+"@"+x.Vydani] = x.Stav + " " + x.JmenoSbirky + " " + x.VydaniSbirky
	}
	chci := map[string]string{
		"Anna Testová@1995-01":    "shoda Anna Testová ",
		"Bára Dvojče@1995-02":     "shoda Bára Dvojče ",
		"Cecílie Dvojče@1995-02":  "chybi  ",
		"Dana Preklepová@1995-03": "preklep Dana Prekleppová ",
		"Eva Jinde@1995-04":       "jiny-mesic Eva Jinde 1995-05",
		"Gina Úplně Jiná@1995-05": "jine-jmeno Fiona Zcela ",
		"Hana Chybí@1995-06":      "chybi  ",
		"@1995-07":                "nenalezeno  ",
		"Anna Testová@":           "shoda Anna Testová ",
	}
	for k, v := range chci {
		if stavy[k] != v {
			t.Errorf("%s: %q, chci %q", k, stavy[k], v)
		}
	}
	if r.Shod != 3 {
		t.Errorf("shod %d (%v)", r.Shod, stavy)
	}

	// Přejmenování podle Wikipedie: staré jméno přejde do dalších jmen
	id := idModelky(t, a, "Dana Prekleppová")
	if !a.PrijmoutJmenoZWikipedie(id, "Dana Preklepová", true) {
		t.Fatal("přejmenování")
	}
	m, _ := a.modelkaPodleID(id)
	if m.Jmeno != "Dana Preklepová" || m.DalsiJmena != "Dana Prekleppová" {
		t.Fatalf("po přejmenování: %q / %q", m.Jmeno, m.DalsiJmena)
	}
	if !a.PrijmoutJmenoZWikipedie(id, "D. P.", false) {
		t.Fatal("další jméno")
	}
	m, _ = a.modelkaPodleID(id)
	if m.Jmeno != "Dana Preklepová" || m.DalsiJmena != "Dana Prekleppová, D. P." {
		t.Fatalf("další jméno: %q / %q", m.Jmeno, m.DalsiJmena)
	}
	if r := a.RocnikPodleWikipedie(1990); r.Chyba == "" {
		t.Error("chybějící seznam")
	}
}

// Penthouse (0.02.064): Pets měsíců a Pet of the Year z italského seznamu; Pet ve sbírce jako album s titulem
// měsíce i jako centerfold, jiný měsíc, chybějící a Pet roku podle titulu
func TestRocnikPenthousePodleWikipedie(t *testing.T) {
	falesnaWikipedie(t, map[string]string{
		"Penthouse Pet": "Úvod<ref>{{Cita web|url=x}}</ref>\n== Pet of the Year ==\n{{Div col}}\n* 1984 – Linda Kenton\n" +
			"* 1985 – [[Pet Rokova]]<ref name=\"a\" />\n{{div col end}}\n\n== Pet of the Month ==\n=== Anni 1980 ===\n{{Colonne}}\n" +
			";1984\n*Gennaio – Někdo Starší\n;1985\n*Gennaio – Rebecca Testova\n*Febbraio - [[Brittany Odkaz|Brittany Dane]]\n" +
			"*Marzo – Carolyn Jinde<ref>pozn.</ref>\n*Aprile – Andi Chybi\n{{Colonne spezza}}\n;1986\n*Gennaio – Sarah Pozdejsi\n{{Colonne fine}}\n== Note ==\n",
	})
	a := novaTestovaciApp(t, nil)
	pridat := func(jmeno, album, typ, vydani string) int {
		a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1})
		id := idModelky(t, a, jmeno)
		a.AddBulkPhotos(id, album, typ, odkazA)
		if vydani != "" {
			a.SetVydaniAlba(id, album, typ, vydani)
		}
		return id
	}
	pridat("Rebecca Testova", "Pet of the Month January 1985", typPMMesice, "1985-01@PH")
	pridat("Brittany Dane", "1985-02@PH", "Centerfold", "")
	pridat("Carolyn Jinde", "Pet of the Month May 1985", typPMMesice, "1985-05@PH")
	// Stejný měsíc Playboye se s Penthouse neplete
	pridat("Andi Playboy", "1985-04", "Centerfold", "")
	id := pridat("Pet Rokova", "Penthouse Pet of the Year 1985", typPMRoku, "1985@PH")

	r := a.RocnikCasopisuPodleWikipedie(1985, "PH")
	if r.Chyba != "" {
		t.Fatal(r.Chyba)
	}
	if r.TitulRoku != "Pet of the Year" {
		t.Errorf("titul roku %q", r.TitulRoku)
	}
	stavy := map[string]string{}
	for _, x := range r.Radky {
		stavy[x.Jmeno+"@"+x.Vydani] = x.Stav + " " + x.VydaniSbirky
	}
	chci := map[string]string{
		"Rebecca Testova@1985-01@PH": "shoda ",
		"Brittany Dane@1985-02@PH":   "shoda ",
		"Carolyn Jinde@1985-03@PH":   "jiny-mesic 1985-05@PH",
		"Andi Chybi@1985-04@PH":      "chybi ",
		"@1985-06@PH":                "nenalezeno ",
		"Pet Rokova@":                "shoda ",
	}
	for k, v := range chci {
		if stavy[k] != v {
			t.Errorf("%s: %q, chci %q (%v)", k, stavy[k], v, stavy)
		}
	}
	if len(r.Zdroje) != 1 || !strings.Contains(r.Zdroje[0], "Penthouse_Pet") {
		t.Errorf("zdroje %v", r.Zdroje)
	}
	_ = id
	if r := a.RocnikCasopisuPodleWikipedie(1960, "PH"); r.Chyba == "" {
		t.Error("rok mimo seznam")
	}
	if r := a.RocnikCasopisuPodleWikipedie(1985, "HU"); r.Chyba == "" {
		t.Error("Hustler seznam nemá")
	}
}
