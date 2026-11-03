package main

// Otisk dat, ze kterých se počítají témata sezón. Paměť témat (fotky s tagy a albem, výsledky témat) patřila ke
// snímku sbírky a každý zápis ji zahodil – i srdíčko u fotky, které témata nemění (po něm se fotky pro témata
// načítaly znovu ~0,4 s a témata počítala znovu). Když se otisk se snímkem nezmění, paměť přejde na nový snímek.
// otiskFotek: fotky (album), alba (typ, vydání, datum, modelka) a tagy fotek; otiskVysledku navíc údaje modelek
// a fotky prošlé průvodcem.

import (
	"database/sql"
	"fmt"
	"math"
)

type otiskTemat struct {
	fotek, vysledku string
}

// Volá se se zámkem paměti témat; spočítá se jednou za snímek
func (a *App) otiskTematKeSnimku(p *temataPamet, s *snimek) otiskTemat {
	if p.otiskSnimek == s {
		return p.otisk
	}
	p.otiskSnimek, p.otisk = s, a.spocitatOtiskTemat(s)
	return p.otisk
}

func (a *App) spocitatOtiskTemat(s *snimek) otiskTemat {
	o := novyOtiskovac()
	chyba := false
	cisla := func(dotaz string) {
		var x, y, z sql.NullFloat64
		if err := a.db.QueryRow(dotaz).Scan(&x, &y, &z); err != nil {
			chyba = true
			return
		}
		o.Text(fmt.Sprint(x.Float64, y.Float64, z.Float64))
	}
	// Fotky: počet a rozmístění do alb
	cisla(`SELECT COUNT(*), TOTAL(id * 1.0 * album_id), TOTAL(album_id * 1.0 * album_id) FROM fotky`)
	// Tagy po tagu (index tag, fotka): počet, součet a součet čtverců čísel fotek
	if radky, err := a.db.Query(`SELECT tag, COUNT(*), TOTAL(fotka_id), TOTAL(fotka_id * 1.0 * fotka_id) FROM fotky_tagy GROUP BY tag`); err == nil {
		for radky.Next() {
			var tag string
			var n, soucet, ctverce float64
			if radky.Scan(&tag, &n, &soucet, &ctverce) == nil {
				o.Text(tag, fmt.Sprint(n, soucet, math.Mod(ctverce, 1e15)))
			}
		}
		chyba = chyba || radky.Err() != nil
		radky.Close()
	} else {
		chyba = true
	}
	// Alba: údaje, ze kterých témata čtou období, druh a modelku
	if radky, err := a.db.Query(`SELECT id, COALESCE(modelka_id, 0), typ, COALESCE(vydani, ''), COALESCE(datum, '') FROM alba ORDER BY id`); err == nil {
		for radky.Next() {
			var id, modelka int
			var typ, vydani, datum string
			if radky.Scan(&id, &modelka, &typ, &vydani, &datum) == nil {
				o.Cisla(id, modelka)
				o.Text(typ, vydani, datum)
			}
		}
		chyba = chyba || radky.Err() != nil
		radky.Close()
	} else {
		chyba = true
	}
	fotek := o.Hex()
	// Chyba čtení: otisk, který se s ničím neshoduje (paměť se nepřenese)
	if chyba {
		fotek = fmt.Sprintf("chyba %p", s)
	}
	v := novyOtiskovac()
	v.Text(fotek)
	for i := range s.modelky {
		v.Modelka(&s.modelky[i])
	}
	var n, soucet float64
	if err := a.db.QueryRow(`SELECT COUNT(*), TOTAL(fotka_id * 1.0 * verze) FROM fotky_pruvodce`).Scan(&n, &soucet); err != nil {
		return otiskTemat{fotek, fmt.Sprintf("chyba %p", s)}
	}
	v.Text(fmt.Sprint(n, soucet))
	return otiskTemat{fotek, v.Hex()}
}
