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
	puvodni, puvodniOdstup := adresaWikipedie, odstupDotazu
	adresaWikipedie, odstupDotazu = server.URL, time.Millisecond
	zdrojeZamek.Lock()
	zdrojeMezipamet = map[string][]byte{}
	zdrojeZamek.Unlock()
	t.Cleanup(func() {
		server.Close()
		adresaWikipedie, odstupDotazu = puvodni, puvodniOdstup
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
