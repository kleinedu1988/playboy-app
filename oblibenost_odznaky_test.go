package main

import (
	"fmt"
	"testing"
	"time"
)

// Odznaky: stupně s časem zisku, jednorázové příběhy, postup u modelek v top 10 a nové rekordy
func TestOdznaky(t *testing.T) {
	den0 := time.Date(2026, 1, 1, 12, 0, 0, 0, time.Local)
	den := func(d int) time.Time { return den0.AddDate(0, 0, d) }
	nyni := den(200)
	var porovnani []porovnaniZaznam
	p := func(d int, a, b int, vysledek string, ha, hb float64) {
		porovnani = append(porovnani, porovnaniZaznam{id: int64(len(porovnani) + 1), cas: den(d).Add(time.Duration(len(porovnani)) * time.Minute), a: a, b: b, vysledek: vysledek, ha: ha, hb: hb})
	}
	// Modelka 1: šest výher za sebou (remíza sérii nepřeruší), pak prohra, pak dvě výhry
	for i := range 3 {
		p(10, 1, 50+i, "a", 4, 4)
	}
	p(11, 1, 60, "remiza", 4, 4)
	for i := range 3 {
		p(12, 70+i, 1, "b", 4, 4)
	}
	p(13, 1, 80, "b", 4, 4)
	p(14, 1, 81, "a", 4, 4)
	p(15, 1, 82, "a", 4, 4)
	// Modelka 2 (3 srdíčka) porazila jedničku 3 (5 srdíček) ze 40. místa: David a Goliáš i laťka
	p(30, 2, 3, "a", 3, 5)
	// Modelka 4 v Top 10 od dne 50 do teď: 3 výhry, žádná prohra → neporazitelná po 30 dnech
	p(52, 4, 90, "a", 4, 4)
	p(55, 91, 4, "b", 4, 4)
	p(60, 4, 92, "a", 4, 4)
	snimky := []snimekPoradi{
		{den: den(29), poradi: map[int]int{3: 1, 2: 40, 5: 150, 6: 45}},
		{den: den(35), poradi: map[int]int{3: 1, 2: 30, 5: 140, 6: 60}},
		{den: den(40), poradi: map[int]int{3: 1, 2: 20, 5: 120, 6: 50}},
		{den: den(44), poradi: map[int]int{3: 1, 2: 18, 5: 12, 6: 9}},
	}
	existuje := map[int]bool{}
	for id := 1; id <= 100; id++ {
		existuje[id] = true
	}
	v := vstupOdznaku{
		pobyty: map[int][]pobytVTop{
			3: {{od: den(0), do: nyni, odZacatku: true}},                    // od začátku kroniky: ani raketa, ani comeback
			5: {{od: den(45), do: nyni}},                                    // ze 120. místa (den 40) do Top 10: raketa
			6: {{od: den(5), do: den(20)}, {od: den(60), do: nyni}},         // 40 dní venku: comeback
			4: {{od: den(50), do: nyni}},                                    // neporazitelná
			7: {{od: den(100), do: den(110)}, {od: den(115), do: den(130)}}, // jen 5 dní venku: comeback ne
		},
		vlady:        []vladaJednicky{{modelka: 3, od: den(0), do: nyni}},
		obhajobyCasy: map[int][]time.Time{3: {den(20), den(40), den(60), den(70)}},
		porovnani:    porovnani,
		snimky:       snimky,
		vTop:         map[int]bool{3: true, 4: true, 5: true, 6: true},
		existuje:     existuje,
		nyni:         nyni,
	}
	odznaky, zisky, rekordy := spocitatOdznaky(v)
	o := map[string]OdznakModelky{}
	for _, x := range odznaky {
		o[fmt.Sprintf("%d:%s", x.ModelkaID, x.Odznak)] = x
	}
	chci := func(klic string, stupen int, ziskan bool, hodnota, dalsi int) {
		t.Helper()
		x, ok := o[klic]
		if !ok || x.Stupen != stupen || x.Ziskan != ziskan || x.Hodnota != hodnota || x.Dalsi != dalsi {
			t.Errorf("%s: %+v (je %v)", klic, x, ok)
		}
	}
	chci("1:serie", 1, true, 6, 10)
	chci("3:stalice", 2, true, 200, 365)
	chci("3:kralovna", 3, true, 200, 0)
	chci("3:hradba", 1, true, 4, 5)
	chci("4:stalice", 2, true, 150, 365)
	chci("2:david", 0, true, 0, 0)
	chci("2:latka", 0, true, 0, 0)
	chci("5:raketa", 0, true, 0, 0)
	chci("6:comeback", 0, true, 0, 0)
	chci("4:neporazitelna", 0, true, 0, 0)
	for _, klic := range []string{"3:raketa", "3:comeback", "7:comeback", "6:raketa", "1:neporazitelna", "1:david"} {
		if _, ok := o[klic]; ok {
			t.Errorf("%s nemá být: %+v", klic, o[klic])
		}
	}
	if x := o["2:david"]; x.Souperka != 3 || x.Cas[:10] != "2026-01-31" {
		t.Errorf("David: %+v", x)
	}
	if x := o["4:neporazitelna"]; x.Cas[:10] != "2026-03-22" {
		t.Errorf("neporazitelná: %+v", x)
	}
	// Zisky: bronz série modelky 1 v den 12 (pátá výhra), stříbro Stálice trojky v den 100
	var serie, stalice bool
	for _, z := range zisky {
		if z.modelka == 1 && z.odznak == "serie" && z.stupen == 1 && z.cas.Format("2006-01-02") == "2026-01-13" {
			serie = true
		}
		if z.modelka == 3 && z.odznak == "stalice" && z.stupen == 2 && z.cas.Format("2006-01-02") == den(100).Format("2006-01-02") {
			stalice = true
		}
	}
	if !serie || !stalice {
		t.Errorf("zisky: série %v, stálice %v: %+v", serie, stalice, zisky)
	}
	r := map[string]RekordSlavy{}
	for _, x := range rekordy {
		r[x.Druh] = x
	}
	if r["serie"].ModelkaID != 1 || r["serie"].Hodnota != 6 || r["serie"].Trva {
		t.Errorf("rekord série: %+v", r["serie"])
	}
	if r["porovnani"].ModelkaID != 1 || r["porovnani"].Hodnota != 10 {
		t.Errorf("rekord porovnání: %+v", r["porovnani"])
	}
	if r["skok"].ModelkaID != 5 || r["skok"].Hodnota != 108 {
		t.Errorf("rekord skok: %+v", r["skok"])
	}
}
