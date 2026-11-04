package main

import "playboy-app/internal/kontrola"

// Učení rozsahů údajů a modelu neobvyklých kombinací postavy deleguje do balíčku internal/kontrola.

const (
	minHodnotProUceni = kontrola.MinHodnotProUceni
	minModelekPostavy = kontrola.MinModelekPostavy
	minUdajuPostavy   = kontrola.MinUdajuPostavy
	kRozsahu          = kontrola.KRozsahu
	orezaniZ          = kontrola.OrezaniZ
	zMezeKombinace    = kontrola.ZMezeKombinace
	smrstovani        = kontrola.Smrstovani
	minPotvrzenych    = kontrola.MinPotvrzenych
	prahJmen          = kontrola.PrahJmen
	prahSlov          = kontrola.PrahSlov
)

type (
	prahyKontroly   = kontrola.PrahyKontroly
	rozsah          = kontrola.Rozsah
	rozsahyKontroly = kontrola.RozsahyKontroly
	uceniSbirky     = kontrola.UceniSbirky
	modelPostavy    = kontrola.ModelPostavy
	vektorPostavy   = kontrola.VektorPostavy
	presnost        = kontrola.Presnost
)

func vychoziPrahy() prahyKontroly {
	return kontrola.VychoziPrahy()
}

func naucitRozsah(p priznak, hodnoty, potvrzene []float64, k float64) rozsah {
	return kontrola.NaucitRozsah(p, hodnoty, potvrzene, k)
}

func rozsiritPodlePotvrzenych(r rozsah, hodnoty []float64, krok float64) rozsah {
	return kontrola.RozsiritPodlePotvrzenych(r, hodnoty, krok)
}

func naucitSe(modelky []Modelka, prahy prahyKontroly) uceniSbirky {
	return kontrola.NaucitSe(modelky, prahy)
}
