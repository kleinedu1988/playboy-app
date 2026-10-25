package main

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Databáze učení (uceni.go) a sdílené modely (uceni_modely.go)

// Počet řádků tabulky v databázi učení
func radkuUceni(t *testing.T, a *App, tabulka string) int {
	t.Helper()
	a.uc.pockat()
	a.uc.mu.Lock()
	defer a.uc.mu.Unlock()
	var n int
	if err := a.uc.zajistit().QueryRow("SELECT COUNT(*) FROM " + tabulka).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// Události deníku jako „druh pole zdroj“
func udalostiUceni(t *testing.T, a *App) []string {
	t.Helper()
	a.uc.mu.Lock()
	defer a.uc.mu.Unlock()
	radky, err := a.uc.zajistit().Query("SELECT druh, pole, zdroj FROM udalosti ORDER BY id")
	if err != nil {
		t.Fatal(err)
	}
	defer radky.Close()
	var vysledek []string
	for radky.Next() {
		var druh, pole, zdroj string
		radky.Scan(&druh, &pole, &zdroj)
		vysledek = append(vysledek, druh+" "+pole+" "+zdroj)
	}
	return vysledek
}

// Jako po novém spuštění: databáze učení se zavře a otevře znovu při prvním použití
func restartovatUceni(a *App) {
	a.uc.pockat()
	a.uc.mu.Lock()
	if a.uc.db != nil {
		a.uc.db.Close()
	}
	a.uc.mu.Unlock()
	a.uc = &uceni{cestaSbirky: a.cestaDb}
}

func TestDatabazeUceniVznikneVedleSbirky(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	cesta := filepath.Join(slozkaDat(), "playboy-uceni.db")
	if _, err := os.Stat(cesta); !os.IsNotExist(err) {
		t.Fatal("databáze učení vznikla dřív, než je potřeba")
	}
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	a.GetPrehled(false)
	stav := a.GetStavUceni()
	if stav.Soubor != cesta || stav.Velikost == 0 {
		t.Fatalf("stav učení: %+v", stav)
	}
	db, err := sql.Open("sqlite", cesta)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var verze int
	db.QueryRow("PRAGMA user_version").Scan(&verze)
	if verze != len(migraceUceni) {
		t.Errorf("schéma učení %d, čekám %d", verze, len(migraceUceni))
	}
	// Schéma sbírky se nemění
	a.db.QueryRow("PRAGMA user_version").Scan(&verze)
	if verze != len(migrace) {
		t.Errorf("schéma sbírky %d", verze)
	}
	if len(stav.Zdroje) != len(zdrojeNavrhu) || !stav.Zdroje[0].Aktivni || stav.Zdroje[0].Popis != "místo narození" {
		t.Errorf("zdroje: %+v", stav.Zdroje)
	}
}

// Poškozený soubor se odloží a učení začne znovu; soubor z novější verze nebo jen pro čtení se nemění
// a učení běží v paměti (u souboru jen pro čtení s tím, co se v něm naučilo)
func TestDatabazeUceniPoskozenaNovejsiJenProCteni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	cesta := souborUceni(a.cestaDb)

	// Poškozený
	restartovatUceni(a)
	if err := os.WriteFile(cesta, []byte(strings.Repeat("tohle není databáze", 500)), 0o600); err != nil {
		t.Fatal(err)
	}
	if p := a.GetPrehled(false); p.Modelek != 1 {
		t.Fatalf("Přehled s poškozenou databází učení: %+v", p)
	}
	if odlozene, _ := filepath.Glob(cesta + ".poskozena-*"); len(odlozene) != 1 {
		t.Errorf("poškozený soubor se neodložil: %v", odlozene)
	}
	if a.GetStavUceni().Soubor != cesta {
		t.Error("po odložení poškozeného souboru nevznikl nový")
	}

	// Odmítnutí do souboru, pak soubor jen pro čtení: odmítnutí platí, nové zápisy jdou do paměti
	ku := klicUdaje{1, "", "", "narodnost"}
	a.uc.odmitnoutHodnotu(ku, "z:0", "USA", true)
	a.uc.zapsat(udalostOdmitnuto, 1, "", "", "narodnost", "USA", "", "misto", 0.9, 0.9)
	restartovatUceni(a)
	puvodni := dsnUceni
	predponaUceni, dsnUceni = "file:", "?mode=ro&_pragma=busy_timeout(3000)"
	t.Cleanup(func() { predponaUceni, dsnUceni = "", puvodni })
	vstup, _ := a.uc.vstupNavrhu()
	if vstup == nil || !vstup.odmitnute[ku]["z:0"] {
		t.Fatalf("odmítnutí ze souboru jen pro čtení se nepřeneslo: %+v", vstup)
	}
	if s := a.GetStavUceni(); s.Soubor != "" || s.Udalosti != 1 {
		t.Errorf("stav učení jen pro čtení: %+v", s)
	}
	a.uc.zapsat(udalostPrijato, 1, "", "", "etnicita", "x", "x", "cetnost", 0.9, 0.9)
	if radkuUceni(t, a, "udalosti") != 2 {
		t.Error("zápis do paměti selhal")
	}
	predponaUceni, dsnUceni = "", puvodni
	restartovatUceni(a)
	if radkuUceni(t, a, "udalosti") != 1 {
		t.Error("soubor jen pro čtení se změnil")
	}

	// Novější schéma: soubor se nečte ani nemění
	a.uc.mu.Lock()
	a.uc.db.Exec("PRAGMA user_version = 99")
	a.uc.mu.Unlock()
	restartovatUceni(a)
	if s := a.GetStavUceni(); s.Soubor != "" || s.Udalosti != 0 {
		t.Errorf("databáze učení z novější verze: %+v", s)
	}
	db, _ := sql.Open("sqlite", cesta)
	defer db.Close()
	var verze, udalosti int
	db.QueryRow("PRAGMA user_version").Scan(&verze)
	db.QueryRow("SELECT COUNT(*) FROM udalosti").Scan(&udalosti)
	if verze != 99 || udalosti != 1 {
		t.Errorf("soubor z novější verze se změnil: schéma %d, událostí %d", verze, udalosti)
	}

	// Bez souboru sbírky (dočasná databáze) učení běží v paměti
	b := &App{uc: &uceni{}}
	b.db = a.db
	if b.GetStavUceni().Soubor != "" {
		t.Error("učení bez souboru sbírky má soubor")
	}
}

// Přijetí, odmítnutí a jeho zrušení se zapíšou do deníku se zdrojem; odmítnutí platí pro hodnotu
func TestZpetnaVazbaNavrhu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for i := range 3 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("Míry %d", i), Miry: "90-60-90", Tetovani: -1, Piercing: -1})
	}
	navrhy := a.GetNavrhyDoplneni(false)
	if len(navrhy) != 9 || navrhy[0].Zdroj != "miry" || navrhy[0].ZdrojPopis != "míry" {
		t.Fatalf("návrhy: %+v", navrhy)
	}
	pas := func(jmeno string) NavrhDoplneni {
		n, ok := najitNavrh(a.GetNavrhyDoplneni(true), jmeno, "obvodPasCm")
		if !ok {
			t.Fatalf("%s: návrh pasu chybí", jmeno)
		}
		return n
	}
	if !a.PrijmoutNavrh(pas("Míry 0")) {
		t.Fatal("přijetí selhalo")
	}
	n := pas("Míry 1")
	if !a.OdmitnoutNavrh(n, true) || !obsahujeKlic(modelkaPodleJmena(t, a, "Míry 1").NetykaSe, "nv-obvodPasCm") {
		t.Fatal("odmítnutí selhalo")
	}
	if radkuUceni(t, a, "odmitnute") != 1 {
		t.Error("odmítnutá hodnota se neuložila")
	}
	if n := pas("Míry 1"); !n.Odmitnuto {
		t.Errorf("odmítnutý návrh: %+v", n)
	}
	if !a.OdmitnoutNavrh(n, false) || obsahujeKlic(modelkaPodleJmena(t, a, "Míry 1").NetykaSe, "nv-obvodPasCm") || radkuUceni(t, a, "odmitnute") != 0 {
		t.Error("zrušení odmítnutí nesmazalo hodnotu ani klíč")
	}
	if u := udalostiUceni(t, a); strings.Join(u, ",") != "prijato obvodPasCm miry,odmitnuto obvodPasCm miry,zpet obvodPasCm miry" {
		t.Errorf("deník: %v", u)
	}
	if s := a.GetStavUceni(); s.Prijato != 1 || s.Odmitnuto != 1 || s.Udalosti != 3 {
		t.Errorf("stav: %+v", s)
	}
}

// Odmítnutá hodnota blokuje jen sebe: jiná hodnota téhož údaje se navrhnout může. Klíč „nv-“ bez záznamu
// v databázi učení (starší verze) blokuje celý údaj.
func TestOdmitnutiJedneHodnoty(t *testing.T) {
	modelky := spojit(
		opakovat(6, Modelka{Narodnost: "Česká", Vydani: []string{"2012-03-CZ"}}),
		[]Modelka{{Jmeno: "Z Dallasu", NarozeniMisto: "Dallas, Texas", Vydani: []string{"2013-05-CZ"}, NetykaSe: "nv-narodnost"}},
	)
	ku := klicUdaje{7, "", "", "narodnost"}
	uc := &vstupUceni{odmitnute: map[klicUdaje]map[string]bool{ku: {klicHodnoty("narodnost", "USA"): true}}}
	navrhy := navrhnout(modelky, nil, letosTestu, uc)
	var odmitnuta, nova *navrhSbirky
	for i, n := range navrhy {
		if n.Jmeno == "Z Dallasu" && n.Odmitnuto {
			odmitnuta = &navrhy[i]
		} else if n.Jmeno == "Z Dallasu" {
			nova = &navrhy[i]
		}
	}
	if odmitnuta == nil || odmitnuta.Hodnota != "USA" || nova == nil || nova.Hodnota != "Česká" || nova.Zdroj != "edice" {
		t.Fatalf("odmítnutí jedné hodnoty: %+v", navrhy)
	}
	// Bez záznamu: celý údaj
	for _, n := range navrhnout(modelky, nil, letosTestu, &vstupUceni{}) {
		if n.Jmeno == "Z Dallasu" && !n.Odmitnuto {
			t.Errorf("starší klíč nv- má blokovat celý údaj: %+v", n)
		}
	}
	// Bez odmítnutí: místo narození (USA) a edice (Česká) se přou; místo je silnější (edice tu nic nového neříká:
	// Česká je i bez ní 7 z 8 modelek sbírky, takže jistotu USA nesníží)
	modelky[6].NetykaSe = ""
	n, ok := najitNavrh(navrhyBezDb(modelky, nil), "Z Dallasu", "narodnost")
	if !ok || n.Hodnota != "USA" || n.Jistota > 0.72 || !strings.Contains(n.Duvod, "→ USA") {
		t.Errorf("místo proti edici: %+v", n)
	}
}

// Dva nezávislé zdroje téže hodnoty jistotu zvednou (naivní Bayes), popis jmenuje oba
func TestSpojeniZdroju(t *testing.T) {
	modelky := spojit(
		opakovat(6, Modelka{Narodnost: "Česká", Vydani: []string{"2012-03-CZ"}}),
		opakovat(20, Modelka{Narodnost: "USA"}),
		[]Modelka{
			{Jmeno: "Pražačka z CZ", NarozeniMisto: "Praha", Vydani: []string{"2013-05-CZ"}},
			{Jmeno: "Pražačka", NarozeniMisto: "Praha"},
		},
	)
	navrhy := navrhnout(modelky, nil, letosTestu, nil)
	var obe, misto navrhSbirky
	for _, n := range navrhy {
		switch n.Jmeno {
		case "Pražačka z CZ":
			obe = n
		case "Pražačka":
			misto = n
		}
	}
	if obe.Hodnota != "Česká" || obe.Jistota <= misto.Jistota || obe.ZdrojPopis != "místo narození + edice" ||
		strings.Join(obe.Zdroje, ",") != "misto,edice" || obe.Zdroj != "misto" || !strings.Contains(obe.Duvod, "; zároveň vyšla jen v edici CZ") {
		t.Errorf("spojení: %+v, jen místo: %+v", obe, misto)
	}

	// Vzorec: jediný zdroj beze změny, shodné zdroje víc, zdroj proti méně
	if p := spojitZdroje([]float64{0.8}, 0.3, tlumeniZavislosti); math.Abs(p-0.8) > 1e-9 {
		t.Errorf("jediný zdroj: %v", p)
	}
	if p := spojitZdroje([]float64{0.8, 0.8}, 0.3, tlumeniZavislosti); p <= 0.8 || p >= 0.99 {
		t.Errorf("dva zdroje: %v", p)
	}
	if p := spojitZdroje([]float64{0.8, 0.2}, 0.3, tlumeniZavislosti); p >= 0.8 {
		t.Errorf("zdroj proti: %v", p)
	}
}

// Kalibrace: bez rozhodnutí beze změny, odmítaný zdroj klesne pod práh, přijímaný stoupne; pořadí návrhů zůstane
func TestKalibraceZdroje(t *testing.T) {
	var nic kalibraceZdroje
	if nic.upravit(0.83, 0.85) != 0.83 || nic.presnost(0.85) != 0.85 {
		t.Error("bez rozhodnutí se jistota mění")
	}
	odmitany := kalibraceZdroje{n: 10, prijato: 0, predpoved: 9}
	if r := odmitany.presnost(0.85); math.Abs(r-7.2/18) > 1e-9 {
		t.Errorf("úspěšnost odmítaného zdroje %v, čekám (0 + 8·0,9)/(10 + 8)", r)
	}
	if p := odmitany.upravit(0.9, 0.85); math.Abs(p-0.4) > 1e-9 {
		t.Errorf("kalibrovaná jistota %v, čekám 0,4 (posun v log-šancích o logit 0,4 − logit 0,9)", p)
	}
	if odmitany.upravit(0.95, 0.85) >= prahNavrhu || odmitany.upravit(0.95, 0.85) <= odmitany.upravit(0.9, 0.85) {
		t.Error("odmítaný zdroj má klesnout pod práh a zachovat pořadí")
	}
	prijimany := kalibraceZdroje{n: 20, prijato: 20, predpoved: 15}
	if p := prijimany.upravit(0.75, 0.75); p <= 0.75 {
		t.Errorf("přijímaný zdroj: %v", p)
	}
	if w := vahaStari(mustCas("2025-01-01 00:00:00"), mustCas("2026-01-01 00:00:00")); math.Abs(w-0.5) > 0.01 {
		t.Errorf("váha rozhodnutí po roce: %v", w)
	}

	// Celý okruh: deset odmítnutých návrhů z měr → zdroj se vypne, přehled to ukáže
	a := novaTestovaciApp(t, nil)
	for i := range 12 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("Míry %02d", i), Miry: "90-60-90", Tetovani: -1, Piercing: -1})
	}
	puvodni := a.GetNavrhyDoplneni(false)
	for i := range 10 {
		n, _ := najitNavrh(puvodni, fmt.Sprintf("Míry %02d", i), "obvodPasCm")
		if !a.OdmitnoutNavrh(n, true) {
			t.Fatalf("odmítnutí %d", i)
		}
	}
	if n, ok := najitNavrh(a.GetNavrhyDoplneni(false), "Míry 11", "obvodPasCm"); ok {
		t.Errorf("zdroj, který uživatel stále odmítá, se nabízí dál: %+v", n)
	}
	for _, z := range a.GetStavUceni().Zdroje {
		if z.Zdroj == "miry" && (z.Aktivni || z.Odmitnuto != 10 || z.Presnost >= 0.6) {
			t.Errorf("zdroj míry v přehledu: %+v", z)
		}
	}
}

func mustCas(s string) time.Time {
	c, _ := time.ParseInLocation("2006-01-02 15:04:05", s, time.Local)
	return c
}

// Mezipaměť: stejná sbírka se nepočítá znovu (ani po restartu), změna údaje nebo rozhodnutí ji zneplatní
func TestMezipametUceni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Míry", Miry: "90-60-90", Tetovani: -1, Piercing: -1})
	p := a.GetPrehled(false)
	otisk := a.uc.navrhy.otisk
	if p.Navrhu != 3 || otisk == "" || radkuUceni(t, a, "mezipamet") != 2 {
		t.Fatalf("první výpočet: %d návrhů, otisk %q", p.Navrhu, otisk)
	}
	// Podvržený obsah mezipaměti se vrátí: důkaz, že se nepočítá znovu
	a.uc.mu.Lock()
	a.uc.navrhy.data = nil
	a.uc.mu.Unlock()
	if p := a.GetPrehled(false); p.Navrhu != 0 {
		t.Fatal("mezipaměť v paměti se nepoužila")
	}
	// Po restartu z mezipaměti v souboru
	restartovatUceni(a)
	if p := a.GetPrehled(false); p.Navrhu != 3 || a.uc.navrhy.otisk != otisk {
		t.Fatalf("po restartu: %d návrhů", p.Navrhu)
	}
	// Změna údaje
	m := modelkaPodleJmena(t, a, "Míry")
	m.ObvodPasCm = 60
	a.UpdateModelka(m)
	if p := a.GetPrehled(false); p.Navrhu != 2 || a.uc.navrhy.otisk == otisk {
		t.Errorf("po změně údaje: %d návrhů", p.Navrhu)
	}
	// Rozhodnutí
	otisk = a.uc.navrhy.otisk
	n, _ := najitNavrh(a.GetNavrhyDoplneni(false), "Míry", "obvodBokyCm")
	a.OdmitnoutNavrh(n, true)
	if p := a.GetPrehled(false); p.Navrhu != 1 || a.uc.navrhy.otisk == otisk {
		t.Errorf("po odmítnutí: %d návrhů", p.Navrhu)
	}
	// Přidání fotky změní otisk alb
	otisk = a.uc.nalezy.otisk
	a.AddBulkPhotos(m.ID, "Pláž", "Pictorial", odkazA)
	if a.GetPrehled(false); a.uc.nalezy.otisk == otisk {
		t.Error("přidání fotky nezměnilo otisk")
	}
}

// Zapomenutí: záloha, prázdná databáze učení, sbírka beze změny
func TestZapomenoutUceni(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Míry", Miry: "90-60-90", Tetovani: -1, Piercing: -1})
	n, _ := najitNavrh(a.GetNavrhyDoplneni(false), "Míry", "obvodPasCm")
	a.OdmitnoutNavrh(n, true)
	if !a.ZapomenoutUceni() {
		t.Fatal("zapomenutí selhalo")
	}
	if s := a.GetStavUceni(); s.Udalosti != 0 || radkuUceni(t, a, "odmitnute") != 0 {
		t.Errorf("po zapomenutí: %+v", s)
	}
	zalohy, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "uceni-*.db"))
	if len(zalohy) != 1 {
		t.Fatalf("zálohy učení: %v", zalohy)
	}
	db, _ := sql.Open("sqlite", zalohy[0])
	defer db.Close()
	var udalosti int
	if db.QueryRow("SELECT COUNT(*) FROM udalosti").Scan(&udalosti); udalosti != 1 {
		t.Errorf("v záloze %d událostí", udalosti)
	}
	// Klíč ve sbírce zůstává (bez záznamu v učení blokuje celý údaj jako ve starších verzích)
	if !obsahujeKlic(modelkaPodleJmena(t, a, "Míry").NetykaSe, "nv-obvodPasCm") {
		t.Error("zapomenutí změnilo sbírku")
	}
	if n, ok := najitNavrh(a.GetNavrhyDoplneni(true), "Míry", "obvodPasCm"); !ok || !n.Odmitnuto {
		t.Errorf("po zapomenutí: %+v", n)
	}
	for _, z := range a.SeznamZaloh() {
		if strings.HasPrefix(z.Soubor, "uceni-") {
			t.Error("záloha učení je mezi zálohami sbírky")
		}
	}
}

// Oprava navržené hodnoty: jiný zápis téže hodnoty se zapamatuje a použije, jiná hodnota je chyba zdroje
func TestZaznamenatOpravu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for i := range 4 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("Pražačka %d", i), NarozeniMisto: "Praha", Narodnost: "Česko", Tetovani: -1, Piercing: -1})
	}
	a.AddModelka(Modelka{Jmeno: "První", NarozeniMisto: "Praha", Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Druhá", NarozeniMisto: "Praha", Tetovani: -1, Piercing: -1})
	n, ok := najitNavrh(a.GetNavrhyDoplneni(false), "První", "narodnost")
	if !ok || n.Hodnota != "Česko" {
		t.Fatalf("návrh: %+v", n)
	}
	if !a.ZaznamenatOpravu(n.ModelkaID, "narodnost", "Česko", "Česká republika") {
		t.Fatal("oprava se nezaznamenala")
	}
	if radkuUceni(t, a, "zapisy") != 1 {
		t.Error("zápis z opravy se neuložil")
	}
	if n, _ := najitNavrh(a.GetNavrhyDoplneni(false), "Druhá", "narodnost"); n.Hodnota != "Česká republika" {
		t.Errorf("návrh nepíše zápis uživatele: %+v", n)
	}
	if a.ZaznamenatOpravu(n.ModelkaID, "nic", "a", "b") || a.ZaznamenatOpravu(n.ModelkaID, "narodnost", "", "b") {
		t.Error("neplatná oprava prošla")
	}
	a.ZaznamenatOpravu(n.ModelkaID, "narodnost", "Česko", "Slovensko")
	k := a.uc.spocitatKalibraci()["misto"]
	if k == nil || k.odmitnutych != 1 || k.prijatych != 0 {
		t.Errorf("oprava na jinou hodnotu (poslední rozhodnutí platí): %+v", k)
	}
	if jenZapis("narodnost", "USA", "Americká") != true || jenZapis("narodnost", "USA", "Kanada") {
		t.Error("jenZapis")
	}
}

// Kontrola: „V pořádku“ a oprava údaje se zapíšou se zdrojem pravidla, opakované „V pořádku“ pravidlo zpřísní
func TestZpetnaVazbaKontroly(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Vysoká", VyskaCm: 250, Tetovani: -1, Piercing: -1})
	a.AddModelka(Modelka{Jmeno: "Těžká", VahaKg: 150, Tetovani: -1, Piercing: -1})
	nalezy := nalezyKontroly(a, false)
	if nalezy["Vysoká: ok-vyska"].Zdroj != "vyska" || nalezy["Těžká: ok-vaha"].Zdroj != "vaha" {
		t.Fatalf("nálezy: %+v", nalezy)
	}
	tezka := idModelky(t, a, "Těžká")
	a.SetNetykaSe(tezka, "ok-vaha", true)
	m := modelkaPodleJmena(t, a, "Vysoká")
	m.VyskaCm = 170
	a.UpdateModelka(m)
	a.GetPrehled(false)
	if u := strings.Join(udalostiUceni(t, a), ","); u != "v-poradku ok-vaha vaha,nalez-opraveny ok-vyska vyska" {
		t.Errorf("deník kontroly: %s", u)
	}
	// Podruhé se oprava nezapíše
	a.GetPrehled(false)
	if len(udalostiUceni(t, a)) != 2 {
		t.Error("oprava nálezu se zapsala dvakrát")
	}
	if p := a.uc.prahyKontroly(); p.kRozsahu[prVaha] != kRozsahu || p.kRozsahu[prVyska] != kRozsahu {
		t.Errorf("jedno rozhodnutí prahy nemění: %+v", p)
	}
	for i := range 6 {
		a.uc.zapsat(udalostVPoradku, 100+i, "", "", "ok-vaha", "", "", "vaha", 0, 0)
	}
	if p := a.uc.prahyKontroly(); p.kRozsahu[prVaha] <= kRozsahu || p.kRozsahu[prVyska] != kRozsahu {
		t.Errorf("opakované „V pořádku“ má zpřísnit jen rozsah váhy: %+v", p)
	}
}

// Naučené sjednocení zápisů: vzácná varianta s překlepem patří k převládajícímu tvaru
func TestSlovnikHodnot(t *testing.T) {
	s := novySlovnik()
	for range 12 {
		s.pridat("philippines", "Philippines")
	}
	s.pridat("phillipines", "Phillipines")
	s.pridat("kanada", "Kanada")
	s.pridat("kanady", "Kanady")
	s.naucit()
	if s.klic("phillipines") != "philippines" || s.zapis("phillipines") != "Philippines" {
		t.Errorf("překlep: %q %q", s.klic("phillipines"), s.zapis("phillipines"))
	}
	if s.klic("kanady") != "kanady" {
		t.Error("stejně časté tvary se nesjednocují")
	}
	s.preferovane = map[string]string{"philippines": "Filipíny"}
	if s.zapis("philippines") != "Filipíny" {
		t.Error("zápis uživatele má přednost")
	}
}

// Odhad obvodu podle nejpodobnějších modelek: zachytí i nelineární závislost a ověřuje se po maskách údajů
func TestNavrhPodleSousedu(t *testing.T) {
	var modelky []Modelka
	for i := range 300 {
		boky := 84 + i%16
		// Pas skokově podle boků: přímka to vystihne hůř než sousedé
		pas := 58
		if boky >= 92 {
			pas = 66
		}
		modelky = append(modelky, Modelka{VyskaCm: 165 + i%10, ObvodHrudnikCm: 86 + i%7, ObvodPasCm: pas, ObvodBokyCm: boky})
	}
	modelky = append(modelky, Modelka{Jmeno: "Bez pasu", VyskaCm: 168, ObvodHrudnikCm: 88, ObvodBokyCm: 95})
	modelky = sbirkaNavrhu(modelky...)
	var nalezeno bool
	for _, n := range navrhnout(modelky, nil, letosTestu, nil) {
		if n.Jmeno == "Bez pasu" && n.Pole == "obvodPasCm" {
			nalezeno = true
			if n.Hodnota != "66" || !strings.Contains(strings.Join(n.Zdroje, ","), "podobne") || n.Jistota > stropOdhadu {
				t.Errorf("odhad podle sousedů: %+v", n)
			}
		}
	}
	if !nalezeno {
		t.Error("odhad podle sousedů chybí")
	}
	s := naucitSousedy(udajeSbirky(modelky), prPas)
	if o := s.overit(1<<prVyska | 1<<prHrudnik); o != nil && o.trefa2 >= prahOdhadu {
		t.Errorf("z výšky a hrudníku pas odhadnout nejde, ověření má selhat: %+v", o)
	}
}
