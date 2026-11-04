package main

import "playboy-app/internal/sbirka"

// Statistiky sbírky pro Přehled: centerfoldy a čísla podle desetiletí, věk v době centerfoldu, nejčastější
// fotografové a národnosti, srovnání edic.

type PolozkaStatistiky = sbirka.PolozkaStatistiky
type DesetiletiStatistiky = sbirka.DesetiletiStatistiky
type Statistiky = sbirka.Statistiky

const nejviceVZebricku = sbirka.NejviceVZebricku

func castiVydani(vydani string) (rok, mesic int, edice string, ok bool) {
	return sbirka.CastiVydani(vydani)
}

func vekKVydani(narozeni, vydani string) int {
	return sbirka.VekKVydani(narozeni, vydani)
}

func zebricek(pocty map[string]int, n int) []PolozkaStatistiky {
	return sbirka.Zebricek(pocty, n)
}

func (a *App) GetStatistiky() Statistiky {
	s := a.snimekSbirky()
	if s.err != nil {
		a.chyba("načtení statistik", s.err)
		return Statistiky{
			Desetileti:  []DesetiletiStatistiky{},
			Vek:         []PolozkaStatistiky{},
			Fotografove: []PolozkaStatistiky{},
			Narodnosti:  []PolozkaStatistiky{},
		}
	}
	alba := make([]sbirka.AlbumSbirky, len(s.alba))
	for i := range s.alba {
		al := &s.alba[i]
		alba[i] = sbirka.AlbumSbirky{
			ID: al.id, ModelkaID: al.modelkaID, Jmeno: al.jmeno,
			Nazev: al.nazev, Typ: al.typ, Vydani: al.vydani,
			Datum: al.datum, Fotograf: al.fotograf, Popis: al.popis,
			Neni: al.neni, Fotek: al.fotek, Hodnocenych: al.hodnocenych,
			SoucetFotek: al.soucetFotek,
		}
	}
	return sbirka.SpocitatStatistiky(s.modelky, s.indexModelky, s.textyKHledani(), alba, a.GetKalendar())
}
