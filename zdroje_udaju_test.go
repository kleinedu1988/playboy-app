package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPrevodyZdroju(t *testing.T) {
	for text, cm := range map[string]int{"{{height|ft=5|in=7}}": 170, "5 ft 6 in": 168, "5 ft 1in (1.57 m)": 157, "1.70 m": 170, "{{height|m=1.73}}": 173, "172 cm": 172, "": 0} {
		if got := vyskaVCm(text); got != cm {
			t.Errorf("výška %q: %d, chci %d", text, got, cm)
		}
	}
	for text, kg := range map[string]int{"{{weight|lb=105}}": 48, "115 lb": 52, "52 kg": 52, "{{weight|kg=50}}": 50} {
		if got := vahaVKg(text); got != kg {
			t.Errorf("váha %q: %d, chci %d", text, got, kg)
		}
	}
	if m, k, p := miryVCm("36DD-22-34"); m != "91-56-86" || k != "DD" || p != 36 {
		t.Errorf("míry v palcích: %s %s %d", m, k, p)
	}
	if m, _, _ := miryVCm("86-61-89"); m != "86-61-89" {
		t.Errorf("míry v cm: %s", m)
	}
	for _, p := range []struct {
		prsa     int
		kosicek  string
		obvod    int
		velikost string
	}{{37, "C", 0, "75C"}, {36, "B", 0, "75B"}, {0, "DD", 36, "80E"}, {0, "C", 35, "75C"}, {0, "B", 34, "75B"}, {0, "D", 0, ""}, {36, "X", 0, ""}} {
		if got := velikostPrsouEU(p.prsa, p.kosicek, p.obvod); got != p.velikost {
			t.Errorf("prsa %d%s/%d: %q, chci %q", p.prsa, p.kosicek, p.obvod, got, p.velikost)
		}
	}
	for text, d := range map[string]string{"{{birth date and age|mf=yes|1969|10|30}}": "1969-10-30", "{{Birth date and age|1974|02|01|mf=y}}": "1974-02-01",
		"October 30, 1969": "1969-10-30", "30 October 1969": "1969-10-30", "1955": "1955", "": ""} {
		if got := datumZWikitextu(text); got != d {
			t.Errorf("datum %q: %q, chci %q", text, got, d)
		}
	}
	if got := mistoSbirky("[[Greenwood, South Carolina]], United States"); got != "Greenwood, South Carolina, USA" {
		t.Errorf("místo: %q", got)
	}
	if prevestTabulkou("Blonde", barvyVlasu) != "blond" || prevestTabulkou("blue eyes", barvyOci) != "modrá" || prevestTabulkou("Caucasian", etnicity) != "kavkazská" || zemeSbirky("Canadian") != "Kanada" {
		t.Error("převod tabulkou")
	}
	if got := pridatOdkazy("https://a.cz, https://b.cz", []string{"https://a.cz/", "https://c.cz#x"}); got != "https://a.cz, https://b.cz, https://c.cz#x" {
		t.Errorf("odkazy: %q", got)
	}
	m := &Modelka{Jmeno: "Melissa Holliday", DalsiJmena: "Melissa Deanne Holliday"}
	if !stejneJmeno(m, "Melissa Deanne Holliday") || !stejneJmeno(m, "[[Melissa Holliday]]") || stejneJmeno(m, "Lisa Marie Scott") {
		t.Error("shoda jména")
	}
	if !stejnyUdaj("narozeniDatum", "1967", "1967-07-01") || stejnyUdaj("narozeniDatum", "1967-07-01", "1967") || !stejnyUdaj("miry", "91-56-86", "91-57-86") || !stejnyUdaj("narozeniMisto", "Ladysmith, Kanada", "Ladysmith, British Columbia, Kanada") {
		t.Error("shoda údajů")
	}
}

// Falešné servery Wikidat, Wikipedie a Boobpedie
func falesneZdroje(t *testing.T) {
	t.Helper()
	json200 := func(w http.ResponseWriter, v any) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(v)
	}
	cas := func(s string, p int) map[string]any {
		return map[string]any{"mainsnak": map[string]any{"datavalue": map[string]any{"value": map[string]any{"time": s, "precision": p}}}, "rank": "normal"}
	}
	polozka := func(id string) map[string]any {
		return map[string]any{"mainsnak": map[string]any{"datavalue": map[string]any{"value": map[string]any{"id": id}}}, "rank": "normal"}
	}
	mnozstvi := func(a, j string) map[string]any {
		return map[string]any{"mainsnak": map[string]any{"datavalue": map[string]any{"value": map[string]any{"amount": a, "unit": "http://www.wikidata.org/entity/" + j}}}, "rank": "normal"}
	}
	// Ocenění s datem v kvalifikátoru P585 (0.02.065)
	oceneni := func(id, cas string, p int) map[string]any {
		o := polozka(id)
		o["qualifiers"] = map[string]any{"P585": []any{map[string]any{"datavalue": map[string]any{"value": map[string]any{"time": cas, "precision": p}}}}}
		return o
	}
	stitky := func(cs, en string) map[string]any {
		l := map[string]any{"en": map[string]string{"value": en}}
		if cs != "" {
			l["cs"] = map[string]string{"value": cs}
		}
		return l
	}
	entity := map[string]any{
		"Q1": map[string]any{"id": "Q1", "labels": stitky("", "Anna Testová"), "descriptions": map[string]any{"en": map[string]string{"value": "American model and Playboy Playmate"}},
			"claims": map[string]any{"P106": []any{polozka("Q728711")}, "P569": []any{cas("+1970-05-04T00:00:00Z", 11)}, "P19": []any{polozka("Q10")},
				"P27": []any{polozka("Q30")}, "P2048": []any{mnozstvi("+1.73", "Q11573")}, "P1884": []any{polozka("Q20")},
				"P166": []any{oceneni("Q100762773", "+1990-03-01T00:00:00Z", 10), oceneni("Q100765879", "+1991-01-01T00:00:00Z", 9),
					oceneni("Q11326351", "+1992-05-01T00:00:00Z", 10), oceneni("Q100762773", "+1993-00-00T00:00:00Z", 9), polozka("Q999")}}},
		"Q2": map[string]any{"id": "Q2", "labels": stitky("", "Anna Testová"), "descriptions": map[string]any{"en": map[string]string{"value": "Czech painter"}},
			"claims": map[string]any{"P569": []any{cas("+1890-01-01T00:00:00Z", 9)}}},
		"Q10": map[string]any{"id": "Q10", "labels": stitky("Dallas", "Dallas"), "claims": map[string]any{"P17": []any{polozka("Q30")}}},
		"Q30": map[string]any{"id": "Q30", "labels": stitky("Spojené státy americké", "United States")},
		"Q20": map[string]any{"id": "Q20", "labels": stitky("blond", "blond hair")},
	}
	wikidata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		switch q.Get("action") {
		case "wbsearchentities":
			json200(w, map[string]any{"search": []any{map[string]string{"id": "Q2"}, map[string]string{"id": "Q1"}}})
		case "wbgetentities":
			v := map[string]any{}
			for _, id := range strings.Split(q.Get("ids"), "|") {
				if e, ok := entity[id]; ok {
					v[id] = e
				}
			}
			json200(w, map[string]any{"entities": v})
		}
	}))
	seznam := "== January ==\n{{Infobox Playboy Playmate\n| name = Anna Testová\n| birth_place = [[Dallas, Texas]], United States\n| birth_date = {{birth date and age|1970|5|4}}\n| height = 5 ft 8 in\n| measurements = 34B-24-35\n| weight = 115 lb\n}}\ntext\n== February ==\n{{Infobox Playboy Playmate\n| name = Jiná Dívka\n}}\n"
	biobox := "{{Biobox new\n| name = Anna Testová\n| birth month = May\n| birth day = 4\n| birth year = 1970\n| birth location = Dallas, Texas, United States\n| nationality = American\n| ethnicity = Caucasian\n| measurements = 34B-24-35\n| bra/cup size = {{bra|B}}\n| natural tits = y\n| height = {{height|ft=5|in=8}}\n| weight = {{weight|lb=115}}\n| eye color = Green\n| hair color = Blonde\n| pubic hair = Trimmed\n| playmatemonth = 1\n| playmateyear = 1995\n}}\nText"
	parse := func(texty map[string]string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			stranka := strings.ReplaceAll(r.URL.Query().Get("page"), "_", " ")
			if text, ok := texty[stranka]; ok {
				json200(w, map[string]any{"parse": map[string]any{"title": stranka, "wikitext": text}})
				return
			}
			json200(w, map[string]any{"error": map[string]string{"code": "missingtitle", "info": "missing"}})
		}
	}
	wikipedie := httptest.NewServer(parse(map[string]string{"List of Playboy Playmates of 1995": seznam}))
	boobpedia := httptest.NewServer(parse(map[string]string{"Anna Testová": biobox}))
	puvodni := []string{adresaWikidat, adresaWikipedie, adresaBoobpedie}
	puvodniOdstup := odstupDotazu
	adresaWikidat, adresaWikipedie, adresaBoobpedie = wikidata.URL, wikipedie.URL, boobpedia.URL
	odstupDotazu = time.Millisecond
	zdrojeZamek.Lock()
	zdrojeMezipamet = map[string][]byte{}
	zdrojeZamek.Unlock()
	t.Cleanup(func() {
		wikidata.Close()
		wikipedie.Close()
		boobpedia.Close()
		adresaWikidat, adresaWikipedie, adresaBoobpedie = puvodni[0], puvodni[1], puvodni[2]
		odstupDotazu = puvodniOdstup
	})
}

// Doplnění ze zdrojů: najde správnou osobu (ne jmenovkyni), převede údaje, ukáže jen odlišné a zapíše jen zvolené
func TestNajitUdajeModelky(t *testing.T) {
	falesneZdroje(t)
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna Testová", NarozeniDatum: "1970", VlasyBarva: "blond", Tetovani: -1, Piercing: -1, Odkazy: "https://example.com/anna"})
	id := idModelky(t, a, "Anna Testová")
	a.AddBulkPhotos(id, "1995-01", "Centerfold", odkazA)

	n := a.NajitUdajeModelky(id)
	stavy := map[string]string{}
	for _, z := range n.Zdroje {
		stavy[z.Klic] = z.Stav + " " + z.URL
	}
	if !strings.HasPrefix(stavy["wikidata"], "nalezeno") || !strings.Contains(stavy["wikidata"], "/Q1") || !strings.HasPrefix(stavy["wikipedie"], "nalezeno") || !strings.HasPrefix(stavy["boobpedia"], "nalezeno") {
		t.Fatalf("zdroje: %v", stavy)
	}
	navrhy := map[string][]string{}
	for _, p := range n.Pole {
		for _, h := range p.Navrhy {
			navrhy[p.Klic] = append(navrhy[p.Klic], h.Zdroj+"="+h.Hodnota)
		}
	}
	chci := map[string]string{
		"narozeniDatum": "wikidata=1970-05-04", "vyskaCm": "wikidata=173 wikipedie=173", "narodnost": "wikidata=USA",
		"narozeniMisto": "wikidata=Dallas, USA wikipedie=Dallas, Texas, USA", "miry": "wikipedie=86-61-89", "velikostPrsou": "wikipedie=75B",
		"vahaKg": "wikipedie=52", "prsaTyp": "boobpedia=Přírodní", "ociBarva": "boobpedia=zelená", "ochlupeni": "boobpedia=Zastřižené", "etnicita": "boobpedia=kavkazská",
	}
	for klic, h := range chci {
		// Stejné hodnoty z více zdrojů se slučují (první zdroj)
		got := strings.Join(navrhy[klic], " ")
		if !strings.HasPrefix(h, strings.Split(got, " ")[0]) {
			t.Errorf("%s: %q, chci %q", klic, got, h)
		}
	}
	if _, ma := navrhy["vlasyBarva"]; ma {
		t.Errorf("vlasy souhlasí, návrh nemá být: %v", navrhy["vlasyBarva"])
	}
	if !strings.Contains(strings.Join(n.Souhlasi, ","), "Vlasy") {
		t.Errorf("souhlasí: %v", n.Souhlasi)
	}

	// Zápis jen zvolených údajů a odkazu
	if !a.UlozitUdajeZeZdroju(id, map[string]string{"narozeniDatum": "1970-05-04", "miry": "86-61-89", "vyskaCm": "173"}, []string{"https://www.wikidata.org/wiki/Q1"}) {
		t.Fatal("uložení")
	}
	m, _ := a.modelkaPodleID(id)
	if m.NarozeniDatum != "1970-05-04" || m.ObvodPasCm != 61 || m.VyskaCm != 173 || m.OciBarva != "" || m.Odkazy != "https://example.com/anna, https://www.wikidata.org/wiki/Q1" {
		t.Fatalf("po uložení: %+v", m)
	}

	// Úplnost čísla: Playmate měsíce podle seznamu
	if p := a.PlaymatePodleWikipedie("1995-01"); p.Jmeno != "Anna Testová" || p.ModelkaID != id || !strings.HasSuffix(p.URL, "#January") {
		t.Fatalf("playmate 1995-01: %+v", p)
	}
	if p := a.PlaymatePodleWikipedie("1995-02"); p.Jmeno != "Jiná Dívka" || p.ModelkaID != 0 {
		t.Fatalf("playmate 1995-02: %+v", p)
	}
	if p := a.PlaymatePodleWikipedie("1995-03-CZ"); p.Chyba == "" {
		t.Fatal("česká edice nemá seznam")
	}
}

// Jmenovkyně s jiným rokem narození se nepoužije
func TestZdrojeJinaOsoba(t *testing.T) {
	falesneZdroje(t)
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna Testová", NarozeniDatum: "1980", Tetovani: -1, Piercing: -1})
	n := a.NajitUdajeModelky(idModelky(t, a, "Anna Testová"))
	for _, z := range n.Zdroje {
		if z.Klic != zdrojWikipedie && z.Stav == "nalezeno" {
			t.Errorf("%s: %s %s", z.Klic, z.Stav, z.Poznamka)
		}
	}
	if len(n.Pole) != 0 {
		t.Errorf("pole: %+v", n.Pole)
	}
	_ = fmt.Sprint
}

// Ocenění z Wikidat (0.02.065): Pet of the Month, Pet of the Year a Honey s datem jsou návrh titulů; přijetí
// založí prázdný centerfold čísla a album titulu roku a modelka pak tituly má (návrh zmizí)
func TestTitulyZWikidat(t *testing.T) {
	falesneZdroje(t)
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna Testová", NarozeniDatum: "1970", Tetovani: -1, Piercing: -1})
	id := idModelky(t, a, "Anna Testová")
	// Pet of the Month 1990-03 už ve sbírce je (album s titulem měsíce)
	a.AddBulkPhotos(id, "Pet of the Month March 1990", typPMMesice, odkazA)
	a.SetVydaniAlba(id, "Pet of the Month March 1990", typPMMesice, "1990-03@PH")

	navrh := func() (string, bool) {
		n := a.NajitUdajeModelky(id)
		for _, p := range n.Pole {
			if p.Klic == "tituly" {
				return p.Navrhy[0].Hodnota, false
			}
		}
		return "", strings.Contains(strings.Join(n.Souhlasi, ","), "Tituly")
	}
	h, _ := navrh()
	// Pet měsíce bez přesného měsíce (1993) se nenabízí, neznámé ocenění také ne
	if h != "1991@PH, 1992-05@HU" {
		t.Fatalf("návrh titulů %q", h)
	}
	if !a.UlozitUdajeZeZdroju(id, map[string]string{"tituly": h}, nil) {
		t.Fatal("zápis titulů")
	}
	m, _ := a.modelkaPodleID(id)
	if got := strings.Join(titulyModelky(&m), ", "); got != "1990-03@PH, 1991@PH, 1992-05@HU" {
		t.Fatalf("tituly po zápisu %q (centerfoldy %v, tituly %v)", got, m.Centerfoldy, m.TitulyJinde)
	}
	if h, souhlasi := navrh(); h != "" || !souhlasi {
		t.Fatalf("po zápisu návrh %q, souhlasí %v", h, souhlasi)
	}
	// Fronta Údržby: návrh titulů je doplnění (bez stávající hodnoty); Vrátit smaže založená alba
	a.nahraditNavrhyZWebu(id, []NavrhZWebu{{ModelkaID: id, Pole: "tituly", Hodnota: "1990-03@PH, 1993-02@PH"}})
	fronta := a.GetNavrhyZWebu()
	if len(fronta) != 1 || fronta[0].Hodnota != "1993-02@PH" || fronta[0].Stavajici != "" {
		t.Fatalf("fronta %+v", fronta)
	}
	p := a.PrijmoutNavrhyZWebuVratitelne(fronta)
	m, _ = a.modelkaPodleID(id)
	if p.Zapsano != 1 || !strings.Contains(strings.Join(titulyModelky(&m), ","), "1993-02@PH") {
		t.Fatalf("přijetí z fronty: %+v, tituly %v", p, titulyModelky(&m))
	}
	a.VratitPrijetiZWebu(p)
	m, _ = a.modelkaPodleID(id)
	if got := strings.Join(titulyModelky(&m), ", "); got != "1990-03@PH, 1991@PH, 1992-05@HU" {
		t.Fatalf("po vrácení %q", got)
	}
	// Zápis znovu nic nezdvojí
	a.UlozitUdajeZeZdroju(id, map[string]string{"tituly": "1991@PH"}, nil)
	var alb int
	a.db.QueryRow(`SELECT COUNT(*) FROM alba WHERE modelka_id = ?`, id).Scan(&alb)
	if alb != 3 {
		t.Errorf("alb %d, chci 3", alb)
	}
}
