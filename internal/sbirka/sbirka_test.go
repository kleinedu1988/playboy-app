package sbirka

import (
	"playboy-app/internal/hledani"
	"strings"
	"testing"
)

func TestCastiVydaniAVek(t *testing.T) {
	rok, mesic, edice, ok := CastiVydani("1995-07-CZ")
	if !ok || rok != 1995 || mesic != 7 || edice != "CZ" {
		t.Fatalf("CastiVydani(1995-07-CZ) = (%d, %d, %q, %v)", rok, mesic, edice, ok)
	}
	rok, mesic, edice, ok = CastiVydani("1988-S01")
	if !ok || rok != 1988 || mesic != 0 || edice != "US" {
		t.Fatalf("CastiVydani(1988-S01) = (%d, %d, %q, %v)", rok, mesic, edice, ok)
	}
	if VekKVydani("1970-08-15", "1990-07") != 19 {
		t.Fatalf("očekáván věk 19")
	}
	if VekKVydani("1970-08-15", "1990-08") != 20 {
		t.Fatalf("očekáván věk 20")
	}
}

func TestUkazkaTextuADotazFTS(t *testing.T) {
	fts := DotazFTS([]string{"jean-luc", "-sartre"})
	if fts != `"jean"* AND "luc"* NOT "sartre"*` {
		t.Fatalf("DotazFTS = %q", fts)
	}
	text := strings.Repeat("úvodní slovo ", 10) + "Příliš žluťoučký kůň úpěl ďábelské ódy" + strings.Repeat(" další slovo", 20)
	ukazka := UkazkaTextu(text, []string{"zlutoucky"})
	if !strings.Contains(ukazka, "žluťoučký") || !strings.HasPrefix(ukazka, "…") || !strings.HasSuffix(ukazka, "…") {
		t.Fatalf("neočekávaná ukázka: %q", ukazka)
	}
}

func TestPlatneTagy(t *testing.T) {
	tagy := PlatneTagy([]string{"portret", "postava", "prsa", "prsa", "neexistuje"})
	if len(tagy) != 2 || tagy[0] != "postava" || tagy[1] != "prsa" {
		t.Fatalf("PlatneTagy = %v", tagy)
	}
}

func TestSpocitatStatistikyAVyvoj(t *testing.T) {
	modelky := []hledani.Modelka{
		{ID: 1, Jmeno: "Anna", NarozeniDatum: "1970-05-10", Narodnost: "USA", VlasyBarva: "Blond", VyskaCm: 170, VahaKg: 52, FotografoveAlb: "Pompeo Posar"},
		{ID: 2, Jmeno: "Bára", NarozeniDatum: "1972-03-01", Narodnost: "ČR", VlasyBarva: "Hnědé", VyskaCm: 175, VahaKg: 56, FotografoveAlb: "Arny Freytag"},
	}
	indexModelky := map[int]int{1: 0, 2: 1}
	texty := []hledani.Texty{hledani.PripravitTexty(&modelky[0]), hledani.PripravitTexty(&modelky[1])}
	alba := []AlbumSbirky{
		{ID: 1, ModelkaID: 1, Jmeno: "Anna", Nazev: "1990-05", Typ: "Centerfold", Vydani: "1990-05", Fotograf: "Pompeo Posar", Fotek: 1},
		{ID: 2, ModelkaID: 2, Jmeno: "Bára", Nazev: "1992-06", Typ: "Centerfold", Vydani: "1992-06", Fotograf: "Arny Freytag", Fotek: 1},
	}
	kalendar := []VydaniKalendare{
		{Vydani: "1990-05", Centerfold: true},
		{Vydani: "1992-06", Centerfold: true},
	}
	stat := SpocitatStatistiky(modelky, indexModelky, texty, alba, kalendar)
	if stat.Centerfoldu != 2 || len(stat.Desetileti) != 1 || stat.VekMedian != 20 {
		t.Fatalf("neočekávané statistiky: %+v", stat)
	}
	vyvoj := SpocitatVyvojVCase("US", modelky, alba)
	if vyvoj.Modelek != 2 || len(vyvoj.Desetileti) != 1 || vyvoj.Desetileti[0] != 1990 {
		t.Fatalf("neočekávaný vývoj: %+v", vyvoj)
	}
}
