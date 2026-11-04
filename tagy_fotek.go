package main

import (
	"database/sql"
	"playboy-app/internal/sbirka"
)

// Tagy fotek: pevný seznam (ne volný text) kvůli tematickým sezónám a filtrům.

type TagFotky = sbirka.TagFotky
type SkupinaTagu = sbirka.SkupinaTagu

var (
	katalogTagu = sbirka.KatalogTagu
	skupinaTagu = sbirka.SkupinaTaguMap
)

func (a *App) GetKatalogTagu() []SkupinaTagu {
	return katalogTagu
}

func platneTagy(tagy []string) []string {
	return sbirka.PlatneTagy(tagy)
}

func (a *App) GetTagyFotek(ids []int) map[int][]string {
	return sbirka.GetTagyFotek(a.db, ids, a.chyba)
}

func (a *App) SetTagyFotek(ids []int, pridat, odebrat []string) bool {
	pridat = platneTagy(pridat)
	return a.vTransakci("uložení tagů fotek", func(q dotazovac) error {
		for _, id := range ids {
			if err := zapsatTagyFotky(q, id, pridat, odebrat); err != nil {
				return err
			}
		}
		return nil
	})
}

func zapsatTagyFotky(q dotazovac, id int, pridat, odebrat []string) error {
	return sbirka.ZapsatTagyFotky(q, id, pridat, odebrat)
}

func (a *App) GetPoctyTagu() map[string]int {
	return sbirka.GetPoctyTagu(a.db)
}

func vsechnyTagyFotek(db *sql.DB) map[int][]string {
	return sbirka.VsechnyTagyFotek(db)
}

func (a *App) GetNepotagovaneFotky() []Fotografie {
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE NOT EXISTS (SELECT 1 FROM fotky_tagy t WHERE t.fotka_id = f.id)
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true))
}
