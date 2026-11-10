package main

import "pinup-katalog/internal/sbirka"

// Vývoj modelek v čase pro Statistiky: věk v době centerfoldu, postava (i BMI a poměr pasu a boků) a podíly
// (vlasy, ochlupení, prsa, tetování) po desetiletích (tabulka) a po pětiletích (graf).

type BodVyvoje = sbirka.BodVyvoje
type RadaVyvoje = sbirka.RadaVyvoje
type PodilVyvoje = sbirka.PodilVyvoje
type KategorieVyvoje = sbirka.KategorieVyvoje
type VyvojVCase = sbirka.VyvojVCase

func kvantil(serazene []float64, q float64) float64 {
	return sbirka.Kvantil(serazene, q)
}

func bodyVyvoje(hodnoty map[int][]float64, delka int) []BodVyvoje {
	return sbirka.BodyVyvoje(hodnoty, delka)
}

func skupinaVlasu(text string) string {
	return sbirka.SkupinaVlasu(text)
}

func anoNe(hodnota int) string {
	return sbirka.AnoNe(hodnota)
}

func (a *App) GetVyvojVCase(edice string) VyvojVCase {
	s := a.snimekSbirky()
	if s.err != nil {
		a.chyba("načtení vývoje v čase", s.err)
		if edice != "CZ" {
			edice = "US"
		}
		return VyvojVCase{Edice: edice, Desetileti: []int{}, Ciselne: []RadaVyvoje{}, Podily: []KategorieVyvoje{}}
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
	return sbirka.SpocitatVyvojVCase(edice, s.modelky, alba)
}
