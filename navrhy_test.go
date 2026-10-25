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

// Návrhy doplnění chybějících údajů (navrhy.go)

const letosTestu = 2026

// Návrhy čistě z modelek a alb (bez databáze), odmítnuté vynechané
func navrhyBezDb(modelky []Modelka, alba []albumNavrhu) []NavrhDoplneni {
	var vysledek []NavrhDoplneni
	for _, n := range navrhnoutDoplneni(modelky, alba, letosTestu) {
		if !n.Odmitnuto {
			vysledek = append(vysledek, n)
		}
	}
	return vysledek
}

// Návrh pro modelku a údaj; ok = false, když není
func najitNavrh(navrhy []NavrhDoplneni, jmeno, pole string) (NavrhDoplneni, bool) {
	for _, n := range navrhy {
		if n.Jmeno == jmeno && n.Pole == pole {
			return n, true
		}
	}
	return NavrhDoplneni{}, false
}

// Sbírka z modelek s postupně přidělenými ID
func sbirkaNavrhu(modelky ...Modelka) []Modelka {
	for i := range modelky {
		modelky[i].ID = i + 1
		if modelky[i].Jmeno == "" {
			modelky[i].Jmeno = fmt.Sprintf("Modelka %d", i+1)
		}
	}
	return modelky
}

// n modelek se stejnými údaji
func opakovat(n int, m Modelka) []Modelka {
	var vysledek []Modelka
	for range n {
		vysledek = append(vysledek, m)
	}
	return vysledek
}

func spojit(skupiny ...[]Modelka) []Modelka {
	var vysledek []Modelka
	for _, s := range skupiny {
		vysledek = append(vysledek, s...)
	}
	return sbirkaNavrhu(vysledek...)
}

func blizko(a, b float64) bool { return math.Abs(a-b) < 0.002 }

// Národnost z místa narození: naučené ze sbírky, tabulka zemí (i zkratka státu a překlep) a zápis sbírky
func TestNavrhNarodnostiZMista(t *testing.T) {
	modelky := spojit(
		opakovat(8, Modelka{NarozeniMisto: "Praha", Narodnost: "Česko"}),
		opakovat(5, Modelka{NarozeniMisto: "Dallas, Texas, USA", Narodnost: "Americká"}),
		opakovat(1, Modelka{NarozeniMisto: "Houston, Texas", Narodnost: "USA"}),
		opakovat(3, Modelka{NarozeniMisto: "Lhota pod Kopcem", Narodnost: "Slovensko"}),
		opakovat(1, Modelka{NarozeniMisto: "Horní Dolní", Narodnost: "Kanada"}),
		[]Modelka{
			{Jmeno: "Pražačka", NarozeniMisto: "Praha"},
			{Jmeno: "Texaska", NarozeniMisto: "Austin, TX"},
			{Jmeno: "Kalifornie s překlepem", NarozeniMisto: "San Jose, Kalifornia"},
			{Jmeno: "Z Lhoty", NarozeniMisto: "Lhota pod Kopcem"},
			{Jmeno: "Z Horní Dolní", NarozeniMisto: "Horní Dolní"},
			{Jmeno: "Japonka", NarozeniMisto: "Tokio, Japonsko"},
			{Jmeno: "Odnikud", NarozeniMisto: "Neznámov"},
			{Jmeno: "Nesleduje se", NarozeniMisto: "Praha", NetykaSe: "zakladni"},
		},
	)
	navrhy := navrhyBezDb(modelky, nil)

	n, ok := najitNavrh(navrhy, "Pražačka", "narodnost")
	if !ok || n.Hodnota != "Česko" || !blizko(n.Jistota, 17.0/18) || !strings.Contains(n.Duvod, "Praha → Česko") ||
		n.Klic != "nv-narodnost" || n.InputID != "inputNarodnost" || n.Popis != "Národnost" {
		t.Errorf("Praha: %+v", n)
	}
	// Zkratka státu USA; zápis podle většiny sbírky (Americká 5×, USA 1×)
	if n, ok := najitNavrh(navrhy, "Texaska", "narodnost"); !ok || n.Hodnota != "Americká" || !blizko(n.Jistota, 0.9) {
		t.Errorf("Austin, TX: %+v", n)
	}
	if n, ok := najitNavrh(navrhy, "Kalifornie s překlepem", "narodnost"); !ok || n.Hodnota != "Americká" {
		t.Errorf("překlep v názvu státu: %+v", n)
	}
	// Jen ze sbírky: 3 shody → (3 + 1)/(3 + 2)
	if n, ok := najitNavrh(navrhy, "Z Lhoty", "narodnost"); !ok || n.Hodnota != "Slovensko" || !blizko(n.Jistota, 0.8) ||
		!strings.Contains(n.Duvod, "3 z 3 modelek") {
		t.Errorf("naučené místo: %+v", n)
	}
	// Jediná modelka odtud je slabý důkaz
	if n, ok := najitNavrh(navrhy, "Z Horní Dolní", "narodnost"); ok {
		t.Errorf("z jedné modelky se nenavrhuje: %+v", n)
	}
	// Národnost, kterou ve sbírce nikdo nemá: výchozí zápis tabulky a nižší jistota
	if n, ok := najitNavrh(navrhy, "Japonka", "narodnost"); !ok || n.Hodnota != "Japonsko" || !blizko(n.Jistota, 0.72) ||
		!strings.Contains(n.Duvod, "zatím nikdo nemá") {
		t.Errorf("nová národnost: %+v", n)
	}
	for _, jmeno := range []string{"Odnikud", "Nesleduje se"} {
		if n, ok := najitNavrh(navrhy, jmeno, "narodnost"); ok {
			t.Errorf("%s: nečekaný návrh %+v", jmeno, n)
		}
	}
}

// Sbírka, která místa narození přiřazuje jinak než tabulka (narozené na základně v Německu jsou Američanky):
// tabulka se přehlasuje, nebo je údaj sporný a nenavrhuje se
func TestNavrhNarodnostiSbirkaPrehlasujeTabulku(t *testing.T) {
	modelky := spojit(
		opakovat(20, Modelka{NarozeniMisto: "Ramstein, Německo", Narodnost: "USA"}),
		[]Modelka{{Jmeno: "Z Ramsteinu", NarozeniMisto: "Ramstein, Německo"}},
	)
	n, ok := najitNavrh(navrhyBezDb(modelky, nil), "Z Ramsteinu", "narodnost")
	if !ok || n.Hodnota != "USA" || !strings.Contains(n.Duvod, "20 z 20") {
		t.Errorf("sbírka má přednost: %+v", n)
	}
}

// Národnost podle edice: modelka jen v české edici
func TestNavrhNarodnostiZEdice(t *testing.T) {
	cz := Modelka{Narodnost: "Česká", Vydani: []string{"2012-03-CZ"}}
	modelky := spojit(opakovat(6, cz), []Modelka{{Jmeno: "Česká edice", Vydani: []string{"2013-05-CZ"}}, {Jmeno: "Obě edice", Vydani: []string{"2013-05-CZ", "1999-01"}}})
	navrhy := navrhyBezDb(modelky, nil)
	if n, ok := najitNavrh(navrhy, "Česká edice", "narodnost"); !ok || n.Hodnota != "Česká" || !blizko(n.Jistota, 7.0/8) {
		t.Errorf("edice CZ: %+v", n)
	}
	if n, ok := najitNavrh(navrhy, "Obě edice", "narodnost"); ok {
		t.Errorf("modelka z obou edic: %+v", n)
	}
	// Málo modelek: nenavrhuje se
	if n, ok := najitNavrh(navrhyBezDb(spojit(opakovat(3, cz), []Modelka{{Jmeno: "X", Vydani: []string{"2013-05-CZ"}}}), nil), "X", "narodnost"); ok {
		t.Errorf("tři modelky nestačí: %+v", n)
	}
}

// Etnicita podle národnosti a vzhled podle etnicity: jen silně jednoznačné rozložení s dost modelkami
func TestNavrhVzhledu(t *testing.T) {
	modelky := spojit(
		opakovat(10, Modelka{Narodnost: "Japonsko", Etnicita: "asijská", VlasyBarva: "černá", OciBarva: "hnědá"}),
		opakovat(1, Modelka{Narodnost: "Japonsko", Etnicita: "Asijská", VlasyBarva: "Černá", OciBarva: "hnědá"}),
		opakovat(6, Modelka{Narodnost: "USA", Etnicita: "kavkazská", VlasyBarva: "blond", OciBarva: "modrá"}),
		opakovat(6, Modelka{Narodnost: "USA", Etnicita: "kavkazská", VlasyBarva: "hnědá", OciBarva: "hnědá"}),
		opakovat(4, Modelka{Narodnost: "Kuba", Etnicita: "latinskoamerická"}),
		[]Modelka{
			{Jmeno: "Japonka", Narodnost: "Japonsko"},
			{Jmeno: "Asiatka", Narodnost: "Japonsko", Etnicita: "asijská"},
			{Jmeno: "Američanka", Narodnost: "USA", Etnicita: "kavkazská"},
			{Jmeno: "Kubánka", Narodnost: "Kuba"},
		},
	)
	navrhy := navrhyBezDb(modelky, nil)
	// 12 z 12 (i Asiatka) → (12 + 1)/(12 + 2) = 0,93, strop 0,9; zápis nejčastější (asijská 11×, Asijská 1×)
	if n, ok := najitNavrh(navrhy, "Japonka", "etnicita"); !ok || n.Hodnota != "asijská" || n.Jistota != stropVzhledu ||
		!strings.Contains(n.Duvod, "národnost Japonsko: 12 z 12") {
		t.Errorf("etnicita: %+v", n)
	}
	if n, ok := najitNavrh(navrhy, "Asiatka", "vlasyBarva"); !ok || n.Hodnota != "černá" || n.Jistota > stropVzhledu {
		t.Errorf("vlasy: %+v", n)
	}
	if n, ok := najitNavrh(navrhy, "Asiatka", "ociBarva"); !ok || n.Hodnota != "hnědá" {
		t.Errorf("oči: %+v", n)
	}
	// Smíšené rozložení a málo modelek: nic
	for _, x := range [][2]string{{"Američanka", "vlasyBarva"}, {"Američanka", "ociBarva"}, {"Kubánka", "etnicita"}} {
		if n, ok := najitNavrh(navrhy, x[0], x[1]); ok {
			t.Errorf("%s %s: slabý důkaz, přesto návrh %+v", x[0], x[1], n)
		}
	}
}

// Obvody a velikost prsou z textu měr (centimetry, palce, s košíčkem) a převod na tvar sbírky
func TestNavrhZMer(t *testing.T) {
	modelky := sbirkaNavrhu(
		Modelka{Jmeno: "Centimetry", Miry: "90-60-90"},
		Modelka{Jmeno: "Palce", Miry: "36-24-36"},
		Modelka{Jmeno: "Košíček", Miry: "34C-24-35"},
		Modelka{Jmeno: "Část vyplněná", Miry: "88-58-90", ObvodPasCm: 58},
		Modelka{Jmeno: "Nesouhlasí", Miry: "88-58-90", ObvodPasCm: 70},
		Modelka{Jmeno: "Nesmysl", Miry: "asi štíhlá"},
	)
	navrhy := navrhyBezDb(modelky, nil)
	chci := []struct {
		jmeno, pole, hodnota string
		jistota              float64
	}{
		{"Centimetry", "obvodHrudnikCm", "90", 0.97}, {"Centimetry", "obvodPasCm", "60", 0.97}, {"Centimetry", "obvodBokyCm", "90", 0.97},
		{"Palce", "obvodHrudnikCm", "91", 0.9}, {"Palce", "obvodPasCm", "61", 0.9}, {"Palce", "obvodBokyCm", "91", 0.9},
		{"Košíček", "obvodPasCm", "61", 0.9}, {"Košíček", "obvodBokyCm", "89", 0.9}, {"Košíček", "velikostPrsou", "34C", 0.95},
		{"Část vyplněná", "obvodHrudnikCm", "88", 0.97}, {"Část vyplněná", "obvodBokyCm", "90", 0.97},
	}
	for _, c := range chci {
		if n, ok := najitNavrh(navrhy, c.jmeno, c.pole); !ok || n.Hodnota != c.hodnota || !blizko(n.Jistota, c.jistota) {
			t.Errorf("%s %s: %+v, čekám %s (%v)", c.jmeno, c.pole, n, c.hodnota, c.jistota)
		}
	}
	// Číslo u košíčku je obvod pod prsy, ne hrudník
	for _, x := range [][2]string{{"Košíček", "obvodHrudnikCm"}, {"Část vyplněná", "obvodPasCm"}, {"Nesouhlasí", "obvodBokyCm"}, {"Nesmysl", "obvodPasCm"}} {
		if n, ok := najitNavrh(navrhy, x[0], x[1]); ok {
			t.Errorf("%s %s: nečekaný návrh %+v", x[0], x[1], n)
		}
	}
	if n, _ := najitNavrh(navrhy, "Palce", "obvodPasCm"); !strings.Contains(n.Duvod, "24″ = 61 cm") {
		t.Errorf("důvod převodu z palců: %q", n.Duvod)
	}

	// Sbírka píše evropské velikosti: 34C → 75C
	evropske := append(opakovat(6, Modelka{VelikostPrsou: "75B"}), Modelka{Jmeno: "Košíček", Miry: "34C-24-35"})
	if n, ok := najitNavrh(navrhyBezDb(sbirkaNavrhu(evropske...), nil), "Košíček", "velikostPrsou"); !ok || n.Hodnota != "75C" || !blizko(n.Jistota, 0.8) {
		t.Errorf("převod na evropskou velikost: %+v", n)
	}
}

// Odhad obvodu regresí: jen když se u sbírky trefuje, s nízkou jistotou a s vysvětlením
func TestNavrhOdhaduObvodu(t *testing.T) {
	sbirka := func(sum float64) []Modelka {
		r := rand.New(rand.NewPCG(7, 7))
		var modelky []Modelka
		for range 200 {
			vyska := 160 + 15*r.Float64()
			vaha := 45 + 15*r.Float64()
			boky := 80 + 15*r.Float64()
			hrudnik := 80 + 15*r.Float64()
			pas := 0.6*boky + 0.2*(vaha-50) + 6 + sum*r.NormFloat64()
			modelky = append(modelky, Modelka{VyskaCm: int(math.Round(vyska)), VahaKg: int(math.Round(vaha)),
				ObvodHrudnikCm: int(math.Round(hrudnik)), ObvodPasCm: int(math.Round(pas)), ObvodBokyCm: int(math.Round(boky))})
		}
		modelky = append(modelky, Modelka{Jmeno: "Bez pasu", VyskaCm: 170, VahaKg: 50, ObvodHrudnikCm: 88, ObvodBokyCm: 90})
		return sbirkaNavrhu(modelky...)
	}
	n, ok := najitNavrh(navrhyBezDb(sbirka(0.6), nil), "Bez pasu", "obvodPasCm")
	// Očekávaný pas 0,6·90 + 0 + 6 = 60
	if !ok || n.Hodnota != "60" && n.Hodnota != "59" && n.Hodnota != "61" || n.Jistota > stropOdhadu || !strings.Contains(n.Duvod, "odhad z údajů") {
		t.Errorf("odhad pasu: %+v", n)
	}
	if n.Jistota >= prahNavrhu {
		t.Errorf("odhad nesmí působit jistě: %v", n.Jistota)
	}
	// Velký rozptyl: odhad se netrefuje, nenavrhuje se
	if n, ok := najitNavrh(navrhyBezDb(sbirka(5), nil), "Bez pasu", "obvodPasCm"); ok {
		t.Errorf("nepřesný odhad: %+v", n)
	}
	// Malá sbírka: nic
	if n, ok := najitNavrh(navrhyBezDb(sbirka(0.6)[190:], nil), "Bez pasu", "obvodPasCm"); ok {
		t.Errorf("odhad z malé sbírky: %+v", n)
	}
}

// Playmate roku z poznámky nebo tagů, s kontrolou roku proti centerfoldu
func TestNavrhPlaymateRoku(t *testing.T) {
	modelky := sbirkaNavrhu(
		Modelka{Jmeno: "Z poznámky", Poznamka: "Byla Playmate of the Year 1998.", Centerfoldy: []string{"1997-05"}, Role: "Celebrita"},
		Modelka{Jmeno: "Z tagů", Tags: "pmoy 2001, blond"},
		Modelka{Jmeno: "Rok nesedí", Poznamka: "Playmate roku 1980", Centerfoldy: []string{"1990-01"}},
		Modelka{Jmeno: "Už má", Poznamka: "Playmate of the Year 1998", Role: "Playmate roku 1998"},
		Modelka{Jmeno: "Dva roky", Poznamka: "Playmate of the Year 1998, PMOY 1999"},
	)
	navrhy := navrhyBezDb(modelky, nil)
	if n, ok := najitNavrh(navrhy, "Z poznámky", "role"); !ok || n.Hodnota != "Playmate roku 1998" || !blizko(n.Jistota, 0.92) || n.InputID != "inputRole" {
		t.Errorf("z poznámky: %+v", n)
	}
	if n, ok := najitNavrh(navrhy, "Z tagů", "role"); !ok || n.Hodnota != "Playmate roku 2001" || !blizko(n.Jistota, 0.75) {
		t.Errorf("z tagů bez centerfoldu: %+v", n)
	}
	for _, jmeno := range []string{"Rok nesedí", "Už má", "Dva roky"} {
		if n, ok := najitNavrh(navrhy, jmeno, "role"); ok {
			t.Errorf("%s: nečekaný návrh %+v", jmeno, n)
		}
	}
}

func TestDatumZNazvu(t *testing.T) {
	pripady := []struct {
		nazev, datum string
		presnost     int
	}{
		{"Playboy červen 1995", "1995-06", 2},
		{"June 1995", "1995-06", 2},
		{"Cyber Girl 2004-06-14", "2004-06-14", 3},
		{"Focení 14. 6. 2004", "2004-06-14", 3},
		{"14. července 2004", "2004-07-14", 3},
		{"July 4, 2004", "2004-07-04", 3},
		{"06/1995", "1995-06", 2},
		{"1995/06", "1995-06", 2},
		{"Cybergirl of the Year 2012", "2012", 1},
		{"Na pláži", "", 0},
		{"1995 a 1996", "", 0},
		{"Playboy 1930", "", 0},
		{"Září 2030", "", 0},
		{"2004-02-30", "", 0},
		{"1995-13", "", 0},
	}
	for _, p := range pripady {
		d, presnost, ok := datumZNazvu(p.nazev, letosTestu)
		if d != p.datum || presnost != p.presnost || ok != (p.datum != "") {
			t.Errorf("%q → %q %d %v, čekám %q %d", p.nazev, d, presnost, ok, p.datum, p.presnost)
		}
	}
}

// Vydání, datum a fotograf alba
func TestNavrhyAlb(t *testing.T) {
	modelky := sbirkaNavrhu(
		Modelka{Jmeno: "Playmate", Centerfoldy: []string{"1997-05"}},
		Modelka{Jmeno: "Dva pictorialy", Centerfoldy: []string{"1998-01"}},
		Modelka{Jmeno: "Online"},
		Modelka{Jmeno: "Stálý fotograf"},
	)
	alba := []albumNavrhu{
		{modelkaID: 1, nazev: "1997-05", typ: "Centerfold", fotograf: "Arny Freytag"},
		{modelkaID: 1, nazev: "Na pláži", typ: "Pictorial"},
		{modelkaID: 1, nazev: "Playboy červen 1999", typ: "Pictorial"},
		{modelkaID: 1, nazev: "Zákulisí", typ: "Pictorial", vydani: "1997-05"},
		{modelkaID: 2, nazev: "1998-01", typ: "Centerfold"},
		{modelkaID: 2, nazev: "První", typ: "Pictorial"},
		{modelkaID: 2, nazev: "Druhý", typ: "Pictorial"},
		{modelkaID: 3, nazev: "Cyber Girl 2004-06-14", typ: typCGTydne},
		{modelkaID: 3, nazev: "Web", typ: typOnline},
		{modelkaID: 4, nazev: "A", typ: "Pictorial", vydani: "2001-01", fotograf: "Stephen Wayda"},
		{modelkaID: 4, nazev: "B", typ: "Pictorial", vydani: "2002-01", fotograf: "stephen wayda"},
		{modelkaID: 4, nazev: "C", typ: "Pictorial", vydani: "2003-01", fotograf: "Stephen Wayda"},
		{modelkaID: 4, nazev: "D", typ: "Pictorial", vydani: "2004-01"},
	}
	navrhy := navrhyBezDb(modelky, alba)
	najit := func(jmeno, album, pole string) (NavrhDoplneni, bool) {
		for _, n := range navrhy {
			if n.Jmeno == jmeno && n.Album == album && n.Pole == pole {
				return n, true
			}
		}
		return NavrhDoplneni{}, false
	}
	if n, ok := najit("Playmate", "Playboy červen 1999", "vydaniAlba"); !ok || n.Hodnota != "1999-06" || n.InputID != "" || n.Typ != "Pictorial" || n.Klic != "nv-vydaniAlba" {
		t.Errorf("vydání z názvu: %+v", n)
	}
	// Pictorial v čísle centerfoldu už má (Zákulisí): druhý se k centerfoldu nepřiřadí
	if n, ok := najit("Playmate", "Na pláži", "vydaniAlba"); ok {
		t.Errorf("pictorial k centerfoldu podruhé: %+v", n)
	}
	// Dva pictorialy bez vydání: nejde poznat, který k centerfoldu patří
	for _, al := range []string{"První", "Druhý"} {
		if n, ok := najit("Dva pictorialy", al, "vydaniAlba"); ok {
			t.Errorf("%s: %+v", al, n)
		}
	}
	if n, ok := najit("Online", "Cyber Girl 2004-06-14", "datumAlba"); !ok || n.Hodnota != "2004-06-14" {
		t.Errorf("datum online alba: %+v", n)
	}
	if n, ok := najit("Online", "Web", "datumAlba"); ok {
		t.Errorf("datum bez data v názvu: %+v", n)
	}
	// Fotograf centerfoldu pro pictorial téhož čísla
	if n, ok := najit("Playmate", "Zákulisí", "fotografAlba"); !ok || n.Hodnota != "Arny Freytag" || n.Jistota < prahNavrhu {
		t.Errorf("fotograf ze stejného čísla: %+v", n)
	}
	// Fotograf ze všech ostatních alb modelky: bez dat ze sbírky jen předpoklad 0,5 → po ověření na jejích albech
	// (3 ze 3 shod) (3 + 1)/(3 + 2) = 0,8; zápis podle většiny
	if n, ok := najit("Stálý fotograf", "D", "fotografAlba"); !ok || n.Hodnota != "Stephen Wayda" || !blizko(n.Jistota, 0.8) {
		t.Errorf("fotograf modelky: %+v", n)
	}

	// Centerfold s jediným pictorialem bez vydání; pravidlo ověřené na jiných playmate
	modelky = sbirkaNavrhu(Modelka{Jmeno: "Nová", Centerfoldy: []string{"2000-02"}}, Modelka{Jmeno: "Stará", Centerfoldy: []string{"1990-03"}})
	alba = []albumNavrhu{
		{modelkaID: 1, nazev: "2000-02", typ: "Centerfold"},
		{modelkaID: 1, nazev: "Na pláži", typ: "Pictorial"},
		{modelkaID: 2, nazev: "1990-03", typ: "Centerfold"},
		{modelkaID: 2, nazev: "Pictorial", typ: "Pictorial", vydani: "1990-03"},
	}
	n, ok := najitNavrh(navrhyBezDb(modelky, alba), "Nová", "vydaniAlba")
	if !ok || n.Hodnota != "2000-02" || !blizko(n.Jistota, (1+0.75*4)/5.0) || !strings.Contains(n.Duvod, "1 z 1") {
		t.Errorf("vydání podle centerfoldu: %+v", n)
	}
	// Album s „netýká se: vydání“ se nenavrhuje
	alba[1].neni = "vydani"
	if n, ok := najitNavrh(navrhyBezDb(modelky, alba), "Nová", "vydaniAlba"); ok {
		t.Errorf("album bez sledovaného vydání: %+v", n)
	}
}

// Učení z odmítnutí: odmítnutý návrh se nevrací a podobné návrhy ztrácejí jistotu
func TestNavrhyUceniZOdmitnuti(t *testing.T) {
	sbirka := func(odmitnutych int) []Modelka {
		var modelky []Modelka
		for i := range 5 {
			m := Modelka{Jmeno: fmt.Sprintf("Texaska %d", i), NarozeniMisto: "Dallas, Texas"}
			if i < odmitnutych {
				m.NetykaSe = "nv-narodnost"
			}
			modelky = append(modelky, m)
		}
		return sbirkaNavrhu(append(modelky, Modelka{Narodnost: "USA"})...)
	}
	jistota := func(odmitnutych int) (float64, int) {
		navrhy := navrhyBezDb(sbirka(odmitnutych), nil)
		if len(navrhy) == 0 {
			return 0, 0
		}
		return navrhy[0].Jistota, len(navrhy)
	}
	j0, n0 := jistota(0)
	j1, n1 := jistota(1)
	j2, n2 := jistota(2)
	if n0 != 5 || n1 != 4 || n2 != 0 {
		t.Errorf("počty návrhů po 0, 1, 2 odmítnutích: %d, %d, %d", n0, n1, n2)
	}
	if !blizko(j1, j0*vahaOdmitnuti/(vahaOdmitnuti+1)) || j2 != 0 {
		t.Errorf("jistota po odmítnutí: %v → %v → %v", j0, j1, j2)
	}
	if navrhy := navrhyBezDb(sbirka(1), nil); !strings.Contains(navrhy[0].Duvod, "odmítnut 1×") {
		t.Errorf("důvod neříká, že podobný návrh byl odmítnut: %q", navrhy[0].Duvod)
	}
	// Odmítnutý návrh se při zobrazení odmítnutých vrací s příznakem
	odmitnute := 0
	for _, n := range navrhnoutDoplneni(sbirka(1), nil, letosTestu) {
		if n.Odmitnuto {
			odmitnute++
		}
	}
	if odmitnute != 1 {
		t.Errorf("odmítnutých návrhů %d, čekám 1", odmitnute)
	}
}

// Přijetí zapisuje jen do prázdného údaje; odmítnutí a jeho zrušení přes netyka_se; počet v Přehledu
func TestPrijetiAOdmitnutiNavrhu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for i := range 4 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("Pražačka %d", i), NarozeniMisto: "Praha", Narodnost: "Česko"})
	}
	a.AddModelka(Modelka{Jmeno: "Bez národnosti", NarozeniMisto: "Praha", Miry: "36-24-36"})
	a.AddModelka(Modelka{Jmeno: "Druhá bez národnosti", NarozeniMisto: "Brno"})
	a.AddModelka(Modelka{Jmeno: "Playmate"})
	pm := idModelky(t, a, "Playmate")
	a.AddBulkPhotos(pm, "1997-05", "Centerfold", "https://drive.google.com/file/d/NAVRHCENTERFOLDxxxxxxxxxxxxxx/view")
	a.AddBulkPhotos(pm, "Na pláži", "Pictorial", "https://drive.google.com/file/d/NAVRHPICTORIALxxxxxxxxxxxxxxx/view")

	navrhy := a.GetNavrhyDoplneni(false)
	for i := 1; i < len(navrhy); i++ {
		if navrhy[i].Jistota > navrhy[i-1].Jistota {
			t.Fatalf("návrhy nejsou seřazené od nejvyšší jistoty: %+v", navrhy)
		}
	}
	narodnost, ok := najitNavrh(navrhy, "Bez národnosti", "narodnost")
	if !ok || narodnost.Hodnota != "Česko" {
		t.Fatalf("návrh národnosti: %+v", navrhy)
	}
	if p := a.GetPrehled(false); p.Navrhu != len(navrhy) {
		t.Errorf("Přehled: %d návrhů, GetNavrhyDoplneni %d", p.Navrhu, len(navrhy))
	}

	// Přijetí zapíše; podruhé už je údaj vyplněný
	if !a.PrijmoutNavrh(narodnost) {
		t.Fatal("přijetí návrhu selhalo")
	}
	if m := modelkaPodleJmena(t, a, "Bez národnosti"); m.Narodnost != "Česko" {
		t.Errorf("národnost po přijetí: %q", m.Narodnost)
	}
	if a.PrijmoutNavrh(narodnost) {
		t.Error("návrh se zapsal do vyplněného údaje")
	}
	// Údaj mezitím vyplněný ručně se nepřepíše
	druha, _ := najitNavrh(navrhy, "Druhá bez národnosti", "narodnost")
	m := modelkaPodleJmena(t, a, "Druhá bez národnosti")
	m.Narodnost = "Slovensko"
	a.UpdateModelka(m)
	if a.PrijmoutNavrh(druha) || modelkaPodleJmena(t, a, "Druhá bez národnosti").Narodnost != "Slovensko" {
		t.Error("přijetí přepsalo ručně vyplněný údaj")
	}
	// Obvody: po třetím se složí míry
	for _, pole := range []string{"obvodHrudnikCm", "obvodPasCm", "obvodBokyCm"} {
		n, ok := najitNavrh(navrhy, "Bez národnosti", pole)
		if !ok || !a.PrijmoutNavrh(n) {
			t.Fatalf("přijetí %s: %+v", pole, n)
		}
	}
	if m := modelkaPodleJmena(t, a, "Bez národnosti"); m.ObvodHrudnikCm != 91 || m.ObvodPasCm != 61 || m.ObvodBokyCm != 91 || m.Miry != "91-61-91" {
		t.Errorf("obvody po přijetí: %d %d %d %q", m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm, m.Miry)
	}
	// Neplatný návrh
	for _, n := range []NavrhDoplneni{
		{ModelkaID: pm, Pole: "jmeno", Hodnota: "X"},
		{ModelkaID: pm, Pole: "obvodPasCm", Hodnota: "999"},
		{ModelkaID: pm, Pole: "role", Hodnota: "Cokoli"},
		{ModelkaID: pm, Pole: "vydaniAlba", Album: "Na pláži", Typ: "Pictorial", Hodnota: "červen"},
		{ModelkaID: pm, Pole: "narodnost", Hodnota: "  "},
	} {
		if a.PrijmoutNavrh(n) {
			t.Errorf("neplatný návrh se zapsal: %+v", n)
		}
	}

	// Album: vydání podle centerfoldu, odmítnutí a zrušení odmítnutí
	album, ok := najitNavrh(navrhy, "Playmate", "vydaniAlba")
	if !ok || album.Album != "Na pláži" || album.Hodnota != "1997-05" {
		t.Fatalf("návrh vydání alba: %+v", album)
	}
	if !a.OdmitnoutNavrh(album, true) {
		t.Fatal("odmítnutí selhalo")
	}
	if _, ok := najitNavrh(a.GetNavrhyDoplneni(false), "Playmate", "vydaniAlba"); ok {
		t.Error("odmítnutý návrh se vrací")
	}
	if n, ok := najitNavrh(a.GetNavrhyDoplneni(true), "Playmate", "vydaniAlba"); !ok || !n.Odmitnuto {
		t.Errorf("odmítnutý návrh při zobrazení odmítnutých: %+v", n)
	}
	if !a.OdmitnoutNavrh(album, false) {
		t.Fatal("zrušení odmítnutí selhalo")
	}
	album, ok = najitNavrh(a.GetNavrhyDoplneni(false), "Playmate", "vydaniAlba")
	if !ok || album.Odmitnuto {
		t.Fatalf("po zrušení odmítnutí: %+v", album)
	}
	if !a.PrijmoutNavrh(album) {
		t.Fatal("přijetí vydání alba selhalo")
	}
	var vydani string
	a.db.QueryRow("SELECT vydani FROM alba WHERE album = 'Na pláži'").Scan(&vydani)
	if vydani != "1997-05" {
		t.Errorf("vydání alba po přijetí: %q", vydani)
	}
	// Odmítnutí údaje modelky jde do netyka_se a do exportu se klíč dostane jako ostatní
	druha = NavrhDoplneni{ModelkaID: pm, Pole: "narodnost", Klic: "nv-narodnost"}
	if !a.OdmitnoutNavrh(druha, true) || !obsahujeKlic(modelkaPodleJmena(t, a, "Playmate").NetykaSe, "nv-narodnost") {
		t.Error("odmítnutí národnosti se neuložilo")
	}
	// Klíč, který k údaji nepatří, nebo album u údaje modelky
	for _, n := range []NavrhDoplneni{
		{ModelkaID: pm, Pole: "narodnost", Klic: "nv-etnicita"},
		{ModelkaID: pm, Pole: "narodnost", Klic: "nv-narodnost", Album: "Na pláži", Typ: "Pictorial"},
		{ModelkaID: pm, Pole: "vydaniAlba", Klic: "nv-vydaniAlba"},
		{ModelkaID: pm, Pole: "nic", Klic: "nv-nic"},
	} {
		if a.OdmitnoutNavrh(n, true) {
			t.Errorf("neplatné odmítnutí prošlo: %+v", n)
		}
	}
	if a.SetNetykaSe(pm, "nv-vydaniAlba", true) || a.SetNetykaSeAlba(pm, "Na pláži", "Pictorial", "nv-narodnost", true) {
		t.Error("klíč návrhu alba u modelky nebo naopak")
	}
}

// Hromadné přijetí: záloha předem, jedna transakce, počet zapsaných
func TestPrijetiViceNavrhu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for i := range 3 {
		a.AddModelka(Modelka{Jmeno: fmt.Sprintf("Míry %d", i), Miry: "90-60-90"})
	}
	navrhy := a.GetNavrhyDoplneni(false)
	if len(navrhy) != 9 {
		t.Fatalf("návrhů %d, čekám 9: %+v", len(navrhy), navrhy)
	}
	if n := a.PrijmoutNavrhy(navrhy); n != 9 {
		t.Errorf("zapsáno %d z 9", n)
	}
	if n := a.PrijmoutNavrhy(navrhy); n != 0 {
		t.Errorf("podruhé zapsáno %d", n)
	}
	zalohy := 0
	for _, z := range a.SeznamZaloh() {
		if z.Duvod == "pred-prijetim-navrhu" {
			zalohy++
		}
	}
	if zalohy != 2 {
		t.Errorf("záloh před přijetím návrhů %d, čekám 2", zalohy)
	}
	if len(a.GetNavrhyDoplneni(false)) != 0 {
		t.Error("po přijetí zůstaly návrhy")
	}
}

// Stejná sbírka = stejné návrhy ve stejném pořadí
func TestNavrhyDeterministicke(t *testing.T) {
	modelky, alba := velkaSbirkaNavrhu(400)
	prvni := navrhnoutDoplneni(modelky, alba, letosTestu)
	if len(prvni) == 0 {
		t.Fatal("umělá sbírka nedala žádný návrh")
	}
	for range 3 {
		if dalsi := navrhnoutDoplneni(modelky, alba, letosTestu); !reflect.DeepEqual(prvni, dalsi) {
			t.Fatal("návrhy se liší mezi běhy")
		}
	}
	for _, n := range prvni {
		if n.Jistota < 0 || n.Jistota > 1 || n.Duvod == "" || n.Popis == "" || n.Klic != "nv-"+n.Pole {
			t.Errorf("neúplný návrh %+v", n)
		}
	}
}

// Umělá sbírka s místy, národnostmi, vzhledem, měrami a alby
func velkaSbirkaNavrhu(n int) ([]Modelka, []albumNavrhu) {
	r := rand.New(rand.NewPCG(1953, 10))
	mista := []struct{ misto, narodnost, etnicita string }{
		{"Los Angeles, California", "USA", "kavkazská"}, {"Praha", "Česko", "kavkazská"}, {"Toronto, Ontario", "Kanada", "kavkazská"},
		{"Tokio", "Japonsko", "asijská"}, {"Houston, TX", "USA", "afroamerická"}, {"Město %d", "Brazílie", "latinskoamerická"},
	}
	var modelky []Modelka
	var alba []albumNavrhu
	for i := range n {
		mi := mista[r.IntN(len(mista))]
		misto := mi.misto
		if strings.Contains(misto, "%d") {
			misto = fmt.Sprintf(misto, r.IntN(50))
		}
		vydani := fmt.Sprintf("%d-%02d", 1960+i%60, 1+i%12)
		m := Modelka{ID: i + 1, Jmeno: fmt.Sprintf("Modelka %05d", i), NarozeniMisto: misto, Centerfoldy: []string{vydani}, Vydani: []string{vydani}}
		if r.Float64() < 0.8 {
			m.Narodnost = mi.narodnost
		}
		if r.Float64() < 0.7 {
			m.Etnicita = mi.etnicita
		}
		if mi.etnicita == "asijská" && r.Float64() < 0.8 {
			m.VlasyBarva, m.OciBarva = "černá", "hnědá"
		}
		vaha := 45 + r.IntN(15)
		m.VyskaCm, m.VahaKg = 160+r.IntN(20), vaha
		switch r.IntN(4) {
		case 0:
			m.Miry = fmt.Sprintf("%d-%d-%d", 34+r.IntN(4), 22+r.IntN(4), 34+r.IntN(4))
		case 1:
			boky := 85 + r.IntN(10)
			m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm = 85+r.IntN(10), boky*2/3, boky
		}
		if i%9 == 0 {
			m.Poznamka = fmt.Sprintf("Playmate of the Year %d", 1961+i%60)
		}
		modelky = append(modelky, m)
		fotograf := []string{"Arny Freytag", "Pompeo Posar", "Stephen Wayda", ""}[r.IntN(4)]
		alba = append(alba, albumNavrhu{modelkaID: m.ID, nazev: vydani, typ: "Centerfold", fotograf: fotograf, fotek: 2})
		pictorial := albumNavrhu{modelkaID: m.ID, nazev: "Pictorial", typ: "Pictorial", fotek: 10}
		if r.Float64() < 0.6 {
			pictorial.vydani, pictorial.fotograf = vydani, fotograf
		}
		alba = append(alba, pictorial)
		if i%5 == 0 {
			alba = append(alba, albumNavrhu{modelkaID: m.ID, nazev: fmt.Sprintf("Cyber Girl %d-06-%02d", 2000+i%20, 1+i%28), typ: typCGTydne, fotek: 5})
		}
	}
	return modelky, alba
}

// Rychlost: 3000 modelek do 1 s (učení i návrhy jsou lineární)
func TestNavrhyRychlost(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	modelky, alba := velkaSbirkaNavrhu(3000)
	zacatek := time.Now()
	navrhy := navrhnoutDoplneni(modelky, alba, letosTestu)
	trvalo := time.Since(zacatek)
	t.Logf("3000 modelek: %d návrhů za %v", len(navrhy), trvalo)
	if trvalo > time.Second {
		t.Errorf("návrhy pro 3000 modelek trvaly %v (limit 1 s)", trvalo)
	}
}
