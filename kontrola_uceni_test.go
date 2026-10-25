package main

import (
	"fmt"
	"math"
	"math/rand/v2"
	"reflect"
	"strings"
	"testing"
	"time"
)

// Křestní jména a příjmení umělé sbírky (navzájem nepodobná, aby se nehlásila jako podobná jména)
var (
	umelaKrestni = []string{"Alice", "Brenda", "Carmen", "Dorothy", "Elena", "Fiona", "Gabriela", "Heather", "Ingrid", "Jasmine",
		"Kimberly", "Lorraine", "Monique", "Natasha", "Olivia", "Priscilla", "Rosalind", "Sabrina", "Tamara", "Veronica"}
	umelaPrijmeni = []string{"Anderson", "Blackwood", "Castillo", "Dubois", "Eriksson", "Fitzgerald", "Gonzalez", "Holloway", "Ivanova", "Johansson"}
	umelaSlabiky  = []string{"ka", "lo", "mi", "ra", "tu", "se", "vo", "ni", "be", "du", "fa", "gi"}
)

// Umělá sbírka: n modelek s věrohodnými a navzájem souvisejícími údaji (vyšší modelka je těžší, pas a boky
// rostou s váhou). Pevné semínko: sbírka je při každém běhu stejná. Do 200 modelek mají jména z nepodobných
// seznamů, u větší sbírky se příjmení skládají ze slabik (podobná jména se tam vyskytnou, jde jen o rychlost).
func umelaSbirka(n int) []Modelka {
	r := rand.New(rand.NewPCG(1953, 12))
	modelky := make([]Modelka, 0, n)
	for i := range n {
		jmeno := umelaKrestni[i%len(umelaKrestni)] + " " + umelaPrijmeni[(i/len(umelaKrestni))%len(umelaPrijmeni)]
		if n > len(umelaKrestni)*len(umelaPrijmeni) {
			s := len(umelaSlabiky)
			jmeno = fmt.Sprintf("%s %s%s%s", umelaKrestni[i%len(umelaKrestni)], umelaSlabiky[(i/20)%s], umelaSlabiky[(i/240)%s], umelaSlabiky[(i/2880)%s])
		}
		vyska := 168 + 6*r.NormFloat64()
		bmi := 18.8 + 1.1*r.NormFloat64()
		vaha := bmi * vyska * vyska / 10000
		vek := min(32, max(18, int(math.Round(22+2.5*r.NormFloat64()))))
		rok, mesic := 1960+i%50, 1+i%12
		vydani := fmt.Sprintf("%d-%02d", rok, mesic)
		m := Modelka{ID: i + 1, Jmeno: jmeno, VyskaCm: int(math.Round(vyska)), VahaKg: int(math.Round(vaha)),
			NarozeniDatum: fmt.Sprintf("%d-%02d", rok-vek, mesic), Vydani: []string{vydani}, Centerfoldy: []string{vydani}}
		if i%7 != 3 {
			m.ObvodHrudnikCm = int(math.Round(88 + 0.3*(vyska-168) + 3.5*r.NormFloat64()))
			m.ObvodPasCm = int(math.Round(60 + 0.25*(vaha-53) + 2*r.NormFloat64()))
			m.ObvodBokyCm = int(math.Round(89 + 0.5*(vaha-53) + 2.5*r.NormFloat64()))
		}
		if i%11 == 5 {
			m.VahaKg = 0
		}
		modelky = append(modelky, m)
	}
	return modelky
}

// Nálezy kontroly údajů modelek; označené „V pořádku“ se vynechají (jako v Údržbě bez skrytých)
func kontrolaModelek(modelky []Modelka) []PodezrelyUdaj {
	nalezy := []PodezrelyUdaj{}
	kontrolovatModelky(modelky, vychoziPrahy(), func(m Modelka, klic, zdroj, pole, popis string) {
		if !obsahujeKlic(m.NetykaSe, klic) {
			nalezy = append(nalezy, PodezrelyUdaj{ModelkaID: m.ID, Jmeno: m.Jmeno, Popis: popis, Klic: klic, Pole: pole})
		}
	})
	return nalezy
}

// Nálezy s daným klíčem podle jména modelky
func nalezySKlicem(nalezy []PodezrelyUdaj, klic string) map[string]PodezrelyUdaj {
	vysledek := map[string]PodezrelyUdaj{}
	for _, u := range nalezy {
		if u.Klic == klic {
			vysledek[u.Jmeno] = u
		}
	}
	return vysledek
}

// Přidá modelku na konec sbírky s dalším ID
func pridatModelku(modelky []Modelka, m Modelka) []Modelka {
	m.ID = len(modelky) + 1
	return append(modelky, m)
}

func TestJaroWinkler(t *testing.T) {
	for _, p := range []struct {
		a, b   string
		cekano float64
	}{{"martha", "marhta", 0.961}, {"dwayne", "duane", 0.840}, {"dixon", "dicksonx", 0.813}, {"abc", "abc", 1}, {"abc", "xyz", 0}} {
		if v := jaroWinkler(p.a, p.b); math.Abs(v-p.cekano) > 0.001 {
			t.Errorf("%s/%s: %.3f, čekáno %.3f", p.a, p.b, v, p.cekano)
		}
	}
}

// Čistá sbírka: naučené rozsahy jsou věrohodné a běžné modelky se nehlásí
func TestUceniCisteSbirky(t *testing.T) {
	modelky := umelaSbirka(200)
	u := naucitSe(modelky, vychoziPrahy())
	for j, r := range u.rozsahy {
		if !r.naucene && j != prVek {
			t.Errorf("%s: rozsah se měl naučit: %+v", priznaky[j].nazev, r)
		}
	}
	if r := u.rozsahy[prVyska]; r.od < 140 || r.od > 155 || r.do < 181 || r.do > 200 {
		t.Errorf("výška: %+v", r)
	}
	// Pas sbírky je úzký: naučený rozsah je užší než pevný 45–100
	if r := u.rozsahy[prPas]; r.od <= pasOd || r.do >= pasDo {
		t.Errorf("pas: %+v", r)
	}
	// Dolní mez věku zůstává 18 let i u naučeného rozsahu
	if r := u.rozsahy[prVek]; r.od != vekOd {
		t.Errorf("věk: %+v", r)
	}
	if u.postava == nil {
		t.Fatal("model postavy se měl naučit")
	}
	if nalezy := kontrolaModelek(modelky); len(nalezy) != 0 {
		t.Errorf("čistá sbírka nemá mít nálezy: %v", nalezy)
	}
}

// Neobvyklá kombinace: každý údaj zvlášť v rozsahu, dohromady ne; překlepy hlásí jednotlivá pravidla
func TestNeobvyklaKombinace(t *testing.T) {
	modelky := umelaSbirka(200)
	// Pas 70 cm (v rozsahu) u drobné modelky se 44 kg a úzkými boky
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Kombinace", NarozeniDatum: "1968-06", VyskaCm: 165, VahaKg: 44,
		ObvodHrudnikCm: 84, ObvodPasCm: 70, ObvodBokyCm: 82})
	// Překlep ve výšce (17 místo 170) a v pase: hlásí pravidla, ne kombinace
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Překlep", NarozeniDatum: "1968-06", VyskaCm: 17, VahaKg: 52,
		ObvodHrudnikCm: 88, ObvodPasCm: 160, ObvodBokyCm: 90})
	// Dva údaje na kombinaci nestačí
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Dva údaje", VyskaCm: 150, VahaKg: 70})

	nalezy := kontrolaModelek(modelky)
	neobvykle := nalezySKlicem(nalezy, "ok-neobvykle")
	u, ok := neobvykle["Kombinace"]
	if !ok {
		t.Fatalf("neobvyklá kombinace se nenašla: %v", nalezy)
	}
	if u.Pole != "inputPas" || !strings.HasPrefix(u.Popis, "neobvyklá kombinace údajů: pas 70 cm při ") || !strings.Contains(u.Popis, "(u sbírky obvykle ") {
		t.Errorf("popis kombinace: %+v", u)
	}
	t.Log(u.Popis)
	if len(neobvykle) != 1 {
		t.Errorf("kombinace má být jen jedna: %v", neobvykle)
	}
	if _, ok := nalezySKlicem(nalezy, "ok-vyska")["Překlep"]; !ok {
		t.Errorf("překlep ve výšce se nenašel: %v", nalezy)
	}
	if u := nalezySKlicem(nalezy, "ok-miry")["Překlep"]; !strings.Contains(u.Popis, "pas 160 cm (ve sbírce obvykle ") {
		t.Errorf("překlep v pase: %+v", u)
	}

	// „V pořádku“ u kombinace ji skryje a podobná kombinace jiné modelky se pak také nehlásí; jiná ano
	modelky[200].NetykaSe = "ok-neobvykle"
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Podobná", NarozeniDatum: "1968-06", VyskaCm: 164, VahaKg: 44,
		ObvodHrudnikCm: 84, ObvodPasCm: 70, ObvodBokyCm: 81})
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Jiná", NarozeniDatum: "1968-06", VyskaCm: 180, VahaKg: 70,
		ObvodHrudnikCm: 100, ObvodPasCm: 50, ObvodBokyCm: 102})
	neobvykle = nalezySKlicem(kontrolaModelek(modelky), "ok-neobvykle")
	if _, ok := neobvykle["Kombinace"]; ok {
		t.Error("kombinace označená v pořádku se má skrýt")
	}
	if _, ok := neobvykle["Podobná"]; ok {
		t.Error("kombinace podobná potvrzené se nemá hlásit")
	}
	if u, ok := neobvykle["Jiná"]; !ok {
		t.Errorf("jiná neobvyklá kombinace se má hlásit: %v", neobvykle)
	} else {
		t.Log(u.Popis)
	}
}

// Malá sbírka: pevné rozsahy a bez kontroly kombinací
func TestUceniMaleSbirky(t *testing.T) {
	modelky := umelaSbirka(20)
	u := naucitSe(modelky, vychoziPrahy())
	if u.rozsahy != vychoziRozsahy() {
		t.Errorf("malá sbírka má mít pevné rozsahy: %+v", u.rozsahy)
	}
	if u.postava != nil {
		t.Error("z malé sbírky se kombinace neučí")
	}
	// Pas 80 cm je v pevném rozsahu 45–100, u malé sbírky se tedy nehlásí (u velké by byl mimo naučený rozsah)
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Široký pas", VyskaCm: 170, VahaKg: 60, ObvodHrudnikCm: 90, ObvodPasCm: 80, ObvodBokyCm: 95})
	if nalezy := kontrolaModelek(modelky); len(nalezy) != 0 {
		t.Errorf("malá sbírka: %v", nalezy)
	}
	velka := pridatModelku(umelaSbirka(200), Modelka{Jmeno: "Široký pas", VyskaCm: 170, VahaKg: 60, ObvodHrudnikCm: 90, ObvodPasCm: 80, ObvodBokyCm: 95})
	if _, ok := nalezySKlicem(kontrolaModelek(velka), "ok-miry")["Široký pas"]; !ok {
		t.Error("ve velké sbírce je pas 80 cm mimo naučený rozsah")
	}
}

// Učení z „V pořádku“: tři potvrzené mladé playmate posunou dolní mez věku, ojedinělá hodnota ne
func TestUceniZPotvrzeni(t *testing.T) {
	r := rozsah{od: 18, do: 45}
	if v := rozsiritPodlePotvrzenych(r, []float64{17, 17, 16, 14, 50}, 1); v.od != 16 || v.do != 45 {
		t.Errorf("souvislá řada 17, 17, 16 má posunout mez na 16 (14 je za mezerou): %+v", v)
	}
	if v := rozsiritPodlePotvrzenych(r, []float64{17, 16}, 1); v != r {
		t.Errorf("dvě hodnoty mez neposunou: %+v", v)
	}
	if v := rozsiritPodlePotvrzenych(r, []float64{12, 12, 12}, 1); v != r {
		t.Errorf("vzdálené hodnoty bez návaznosti mez neposunou: %+v", v)
	}

	modelky := umelaSbirka(200)
	mlada := func(jmeno string, vek int, potvrzeno bool) Modelka {
		m := Modelka{Jmeno: jmeno, NarozeniDatum: fmt.Sprintf("%d-06", 1990-vek), Vydani: []string{"1990-06"}}
		if potvrzeno {
			m.NetykaSe = "ok-vek"
		}
		return m
	}
	modelky = pridatModelku(modelky, mlada("Šestnáct", 16, false))
	modelky = pridatModelku(modelky, mlada("Sedmnáct A", 17, false))
	modelky = pridatModelku(modelky, mlada("Sedmnáct B", 17, false))
	modelky = pridatModelku(modelky, mlada("Nová sedmnáct", 17, false))
	modelky = pridatModelku(modelky, mlada("Patnáct", 15, false))
	if vek := nalezySKlicem(kontrolaModelek(modelky), "ok-vek"); len(vek) != 5 {
		t.Fatalf("před potvrzením se hlásí všech pět: %v", vek)
	}
	for i := 200; i < 203; i++ {
		modelky[i].NetykaSe = "ok-vek"
	}
	vek := nalezySKlicem(kontrolaModelek(modelky), "ok-vek")
	if _, ok := vek["Nová sedmnáct"]; ok {
		t.Error("po třech potvrzených se sedmnáctiletá už nemá hlásit")
	}
	if _, ok := vek["Patnáct"]; !ok || len(vek) != 1 {
		t.Errorf("patnáctiletá je za posunutou mezí a hlásí se dál: %v", vek)
	}
}

// Podobná jména: překlep, prohozené jméno a příjmení; jiný rok narození nebo jiné křestní jméno dvojčete ne
func TestPodobnaJmena(t *testing.T) {
	modelky := umelaSbirka(200)
	puvodni := modelky[42] // Carmen Castillo
	kopie := puvodni
	kopie.Jmeno = "Karmen Castilo"
	modelky = pridatModelku(modelky, kopie)
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Dubois Elena"}) // prohozené u Elena Dubois (bez dalších údajů)
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Mirjam Holloway", NarozeniDatum: puvodni.NarozeniDatum})
	jinyRok := modelky[5] // Fiona Anderson
	jinyRok.Jmeno, jinyRok.NarozeniDatum = "Fiona Andersen", "1901-01"
	modelky = pridatModelku(modelky, jinyRok)
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Destiny", DalsiJmena: "Heather Andersonová", NarozeniDatum: modelky[7].NarozeniDatum})
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Destini"}) // jednoslovné bez dalších údajů se nehlásí

	podobna := nalezySKlicem(kontrolaModelek(modelky), "ok-podobne-jmeno")
	for _, p := range []struct{ jmeno, obsahuje string }{
		{"Karmen Castilo", "Carmen Castillo (podobnost"},
		{"Dubois Elena", "Elena Dubois"},
		{"Destiny", "jméno „Heather Andersonová“ je skoro stejné jako u modelky Heather Anderson"},
	} {
		if u, ok := podobna[p.jmeno]; !ok || !strings.Contains(u.Popis, p.obsahuje) || u.Pole != "inputDalsiJmena" {
			t.Errorf("%s: %+v; nálezy: %v", p.jmeno, u, podobna)
		}
	}
	if u := podobna["Karmen Castilo"]; !strings.Contains(u.Popis, "stejné datum narození, stejné první vydání") {
		t.Errorf("důvody: %s", u.Popis)
	}
	if len(podobna) != 3 {
		t.Errorf("čekány 3 podobná jména, jsou %d: %v", len(podobna), podobna)
	}
}

// Stejná sbírka dává vždy stejné nálezy ve stejném pořadí
func TestUceniDeterministicke(t *testing.T) {
	modelky := umelaSbirka(300)
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Kombinace", NarozeniDatum: "1968-06", VyskaCm: 165, VahaKg: 44,
		ObvodHrudnikCm: 84, ObvodPasCm: 70, ObvodBokyCm: 82})
	modelky = pridatModelku(modelky, Modelka{Jmeno: "Carmen Ivanowa"})
	prvni := kontrolaModelek(modelky)
	for range 5 {
		if dalsi := kontrolaModelek(modelky); !reflect.DeepEqual(prvni, dalsi) {
			t.Fatalf("nálezy se liší:\n%v\n%v", prvni, dalsi)
		}
	}
}

// Kontrola sbírky 5000 modelek musí trvat zlomek sekundy
func TestUceniRychlost(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	modelky := umelaSbirka(5000)
	zacatek := time.Now()
	nalezy := kontrolaModelek(modelky)
	trvani := time.Since(zacatek)
	t.Logf("5000 modelek: %v, %d nálezů", trvani, len(nalezy))
	if trvani > time.Second {
		t.Errorf("kontrola trvala %v", trvani)
	}
}

func BenchmarkKontrolaModelek(b *testing.B) {
	modelky := umelaSbirka(5000)
	for b.Loop() {
		kontrolovatModelky(modelky, vychoziPrahy(), func(Modelka, string, string, string, string) {})
	}
}

// Nové klíče jde označit „V pořádku“
func TestNoveKliceKontroly(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Zkouška"})
	id := a.GetModelky("")[0].ID
	for _, klic := range []string{"ok-neobvykle", "ok-podobne-jmeno"} {
		if !a.SetNetykaSe(id, klic, true) {
			t.Errorf("%s se nemá odmítnout", klic)
		}
	}
	if m := a.GetModelky("")[0]; !obsahujeKlic(m.NetykaSe, "ok-neobvykle") || !obsahujeKlic(m.NetykaSe, "ok-podobne-jmeno") {
		t.Errorf("netýká se: %q", m.NetykaSe)
	}
}

// Pevné rozsahy (malá sbírka)
func vychoziRozsahy() rozsahyKontroly {
	var r rozsahyKontroly
	for j, p := range priznaky {
		r[j] = rozsah{od: p.od, do: p.do}
	}
	return r
}
