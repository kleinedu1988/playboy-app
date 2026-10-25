package main

import (
	"fmt"
	"math/rand"
	"strings"
	"testing"
	"time"
)

// Měření hlavních cest nad umělou sbírkou (400 modelek jako dnes a 3000 do budoucna):
//
//	go test -run '^$' -bench Sbirka -benchtime 20x            (časy)
//	go test -run '^$' -bench 'Sbirka/n=3000/GetModelky$' -cpuprofile cpu.out   (profil)
//
// TestVykonHlavnichCest vypíše stejné časy jednou za běh (bez -short) a hlídá hrubé meze.

// Umělá sbírka nad sbirkouNavrhu: k albům víc fotek, srdíčka modelek a fotek, popisy alb, covery časopisů,
// sdílená alba, modelky obálek, výběr fotek a porovnání dvojic v databázi učení
func naplnitSyntetickouSbirku(t testing.TB, a *App, n int) {
	t.Helper()
	naplnitSbirkuNavrhu(t, a, n)
	r := rand.New(rand.NewSource(int64(n)))
	tx, err := a.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	exec := func(dotaz string, args ...any) {
		if _, err := tx.Exec(dotaz, args...); err != nil {
			t.Fatal(err)
		}
	}
	// Pictorialy mají kolem dvaceti fotek (sbirkaNavrhu jich zakládá nejvýš tři)
	radky, err := tx.Query("SELECT id FROM alba WHERE typ = 'Pictorial'")
	if err != nil {
		t.Fatal(err)
	}
	var pictorialy []int64
	for radky.Next() {
		var id int64
		radky.Scan(&id)
		pictorialy = append(pictorialy, id)
	}
	radky.Close()
	for _, id := range pictorialy {
		for f := range 15 + r.Intn(10) {
			exec("INSERT INTO fotky (album_id, drive_file_id, hodnoceni, pridano) VALUES (?, ?, ?, ?)",
				id, fmt.Sprintf("P%07d%02dxxxxxxxxxxxxxxxxxxxx", id, f), r.Intn(6), ted())
		}
	}
	exec("UPDATE modelky SET hodnoceni_pul = 1 + id % 10, hodnoceni = (1 + id % 10) / 2 WHERE id % 3 = 0")
	exec("UPDATE modelky SET drive_cover_id = 'T' || printf('%07d', id) || 'xxxxxxxxxxxxxxxxxxxx' WHERE id % 4 <> 0")
	exec("UPDATE modelky SET tags = 'blond, studio', dalsi_jmena = 'Pseudonym ' || id WHERE id % 7 = 0")
	exec("UPDATE alba SET popis = 'Průvodní text alba ' || id || ' s pár slovy o modelce a fotografovi.' WHERE id % 2 = 0")
	// Covery časopisů: jedno číslo měsíčně
	for c := range n / 5 {
		vydani := fmt.Sprintf("%d-%02d", 1960+c/12, 1+c%12)
		exec("INSERT INTO alba (modelka_id, album, typ, vydani) VALUES (NULL, ?, 'Cover', ?)", vydani, vydani)
		exec("INSERT INTO fotky (album_id, drive_file_id, pridano) VALUES (last_insert_rowid(), ?, ?)", fmt.Sprintf("C%07dxxxxxxxxxxxxxxxxxxxx", c), ted())
		if c%3 == 0 {
			exec("INSERT OR REPLACE INTO vydani (vydani, modelka_obalky, stav) VALUES (?, ?, ?)", vydani, 1+r.Intn(n), []string{"", "mam", "shanim"}[c/3%3])
		}
	}
	// Sdílená alba: pictorial každé dvacáté modelky má i další modelku
	for m := 1; m <= n; m += 20 {
		exec("INSERT OR IGNORE INTO alba_modelky (album_id, modelka_id) SELECT id, ? FROM alba WHERE modelka_id = ? AND typ = 'Pictorial'", m%n+1, m)
	}
	exec("INSERT INTO vybery (nazev, pridano) VALUES ('Nejlepší', ?)", ted())
	exec("INSERT INTO vybery_fotky (vyber_id, fotografie_id, poradi) SELECT 1, id, id FROM fotky WHERE id % 50 = 0")
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	for range n / 6 {
		x, y := 3*(1+r.Intn(n/3-1)), 3*(1+r.Intn(n/3-1))
		if x != y {
			a.PorovnatModelky(x, y, []string{"a", "b", "remiza"}[r.Intn(3)])
		}
	}
	a.uc.pockat()
}

// Měřené cesty; f dostává pořadí opakování (cesty se změnou dat podle něj mění údaje)
type mereniCesty struct {
	nazev string
	f     func(a *App, i int)
}

func cestyKMereni(n int) []mereniCesty {
	export := func(a *App) []byte {
		data, err := a.exportovat()
		if err != nil {
			panic(err)
		}
		return data
	}
	return []mereniCesty{
		{"GetModelky", func(a *App, _ int) { a.GetModelky("") }},
		{"GetModelky/vlasy", func(a *App, _ int) { a.GetModelky("vlasy:blond") }},
		{"GetModelky/jmeno", func(a *App, _ int) { a.GetModelky("Modelka 00042") }},
		{"GetModelky/slovo", func(a *App, _ int) { a.GetModelky("freytag") }},
		{"GetModelky/preklep", func(a *App, _ int) { a.GetModelky("Pompeo Possar") }},
		{"nactiModelky", func(a *App, _ int) { a.nactiModelky("", false) }},
		// Po změně údaje modelky: seznam se načte znovu z databáze (snímek sbírky neplatí)
		{"GetModelky/po-zmene", func(a *App, i int) {
			a.db.Exec("UPDATE modelky SET vaha_kg = ? WHERE id = 3", 45+i%20)
			a.GetModelky("")
		}},
		{"GetFotografieModelky", func(a *App, i int) { a.GetFotografieModelky(1 + i%n) }},
		{"GetPrehled", func(a *App, _ int) { a.GetPrehled(false) }},
		{"GetPrehled/po-zmene", func(a *App, i int) {
			a.db.Exec("UPDATE modelky SET vyska_cm = ? WHERE id = 2", 160+i%30)
			a.GetPrehled(false)
		}},
		{"GetNavrhyDoplneni", func(a *App, _ int) { a.GetNavrhyDoplneni(false) }},
		{"GetStavUceni", func(a *App, _ int) { a.GetStavUceni() }},
		{"GetOblibenost", func(a *App, _ int) { a.GetOblibenost() }},
		{"GetDvojiceKPorovnani", func(a *App, _ int) { a.GetDvojiceKPorovnani(10, "") }},
		{"GetMohloByTeLibit", func(a *App, _ int) { a.GetMohloByTeLibit(10) }},
		{"GetStatistiky", func(a *App, _ int) { a.GetStatistiky() }},
		{"GetVyvojVCase", func(a *App, _ int) { a.GetVyvojVCase("") }},
		{"GetKalendar", func(a *App, _ int) { a.GetKalendar() }},
		{"GetCovery", func(a *App, _ int) { a.GetCovery() }},
		{"GetVydani/rocnik", func(a *App, _ int) { a.GetVydani("1975") }},
		{"GetTagy", func(a *App, _ int) { a.GetTagy() }},
		{"odpovidaHledani", func(a *App, _ int) {
			modelky, _ := a.nactiModelky("", false)
			for _, m := range modelky {
				odpovidaHledani(m, "vlasy:blond -rok:1975 Pompeo")
			}
		}},
		{"export", func(a *App, _ int) { export(a) }},
		{"import", func(a *App, _ int) {
			data, err := slozitSoubory(map[string][]byte{"sbirka.yaml": export(a)}, []string{"sbirka.yaml"})
			if err != nil {
				panic(err)
			}
			if v := a.importovatCelek(data); v.Selhalo != "" {
				panic(v.Selhalo)
			}
		}},
		{"AddBulkPhotos/200", func(a *App, i int) {
			var odkazy strings.Builder
			for f := range 200 {
				fmt.Fprintf(&odkazy, "https://drive.google.com/file/d/B%07d%03dxxxxxxxxxxxxxxxxxxxx/view\n", i, f)
			}
			a.AddBulkPhotos(1+i%n, fmt.Sprintf("Hromadné %d", i), "Pictorial", odkazy.String())
		}},
		{"start", func(a *App, _ int) {
			b := NewApp()
			b.startup(a.ctx)
			b.uc.mu.Lock()
			b.uc.zajistit()
			b.uc.mu.Unlock()
			b.shutdown()
		}},
	}
}

func BenchmarkSbirka(b *testing.B) {
	for _, n := range []int{400, 3000} {
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			a := novaTestovaciApp(b, nil)
			naplnitSyntetickouSbirku(b, a, n)
			// Mezipaměti učení a oblíbenosti se naplní předem; měří se ustálený stav (cesty „po-zmene“ ho mění)
			a.GetPrehled(false)
			for _, c := range cestyKMereni(n) {
				b.Run(c.nazev, func(b *testing.B) {
					i := 0
					for b.Loop() {
						c.f(a, i)
						i++
					}
				})
			}
		})
	}
}

// Časy hlavních cest jednou za běh: nejlepší ze tří opakování (u startu a importu jedno)
func TestVykonHlavnichCest(t *testing.T) {
	if testing.Short() {
		t.Skip("velká sbírka se v rychlém běhu nestaví")
	}
	limity := map[string]time.Duration{"export": 10 * time.Second, "import": 30 * time.Second}
	for _, n := range []int{400, 3000} {
		t.Run(fmt.Sprintf("n=%d", n), func(t *testing.T) {
			a := novaTestovaciApp(t, nil)
			naplnitSyntetickouSbirku(t, a, n)
			a.GetPrehled(false)
			for _, c := range cestyKMereni(n) {
				opakovani := 3
				if c.nazev == "import" || c.nazev == "export" {
					opakovani = 1
				}
				nejlepsi := time.Duration(1<<63 - 1)
				for i := range opakovani {
					zacatek := time.Now()
					c.f(a, i)
					nejlepsi = min(nejlepsi, time.Since(zacatek))
				}
				t.Logf("%-22s %10.2f ms", c.nazev, float64(nejlepsi.Microseconds())/1000)
				limit, ok := limity[c.nazev]
				if !ok {
					limit = 3 * time.Second
				}
				if nejlepsi > limit {
					t.Errorf("%s trvalo %v (limit %v)", c.nazev, nejlepsi, limit)
				}
			}
		})
	}
}

// Každé hledané slovo se musí najít v některém údaji modelky, cílené slovo v daném údaji (viz pripravitHledani)
func odpovidaHledani(m Modelka, vyhledavani string) bool {
	return pripravitHledani(vyhledavani).odpovida(&m, nil)
}
