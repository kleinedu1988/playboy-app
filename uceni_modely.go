package main

import (
	"math/bits"

	ucenibal "pinup-katalog/internal/uceni"
)

// Napojení sdílených statistických nástrojů strojového učení z balíčku internal/uceni.

const (
	prahSlouceni      = ucenibal.PrahSlouceni
	nasobekPrevahy    = ucenibal.NasobekPrevahy
	minDelkaSlouceni  = ucenibal.MinDelkaSlouceni
	tlumeniZavislosti = ucenibal.TlumeniZavislosti

	prVyska       = ucenibal.PrVyska
	prVaha        = ucenibal.PrVaha
	prHrudnik     = ucenibal.PrHrudnik
	prPas         = ucenibal.PrPas
	prBoky        = ucenibal.PrBoky
	prBmi         = ucenibal.PrBmi
	prVek         = ucenibal.PrVek
	pocetPriznaku = ucenibal.PocetPriznaku

	kvartilNaSigma   = ucenibal.KvartilNaSigma
	minModelekOdhadu = ucenibal.MinModelekOdhadu
	pocetSousedu     = ucenibal.PocetSousedu
	vzorekOvereni    = ucenibal.VzorekOvereni
)

var (
	priznaky          = ucenibal.Priznaky
	prediktoryPostavy = ucenibal.PrediktoryPostavy
)

type (
	slovnikHodnot  = ucenibal.SlovnikHodnot
	uspesnost      = ucenibal.Uspesnost
	cetnosti       = ucenibal.Cetnosti
	priznak        = ucenibal.Priznak
	udajePostavy   = ucenibal.UdajePostavy
	regreseObvodu  = ucenibal.RegreseObvodu
	sousedePostavy = ucenibal.SousedePostavy
	overeniSousedu = ucenibal.OvereniSousedu
)

func klicTextu(s string) string            { return ucenibal.KlicTextu(s) }
func uzJeKlicem(z string) bool             { return ucenibal.UzJeKlicem(z) }
func jaroWinkler(s1, s2 string) float64    { return ucenibal.JaroWinkler(s1, s2) }
func jaroWinklerZnaku(a, b []rune) float64 { return ucenibal.JaroWinklerZnaku(a, b) }
func novySlovnik() *slovnikHodnot          { return ucenibal.NovySlovnik() }
func podilSPredpokladem(k, n int, p, w float64) float64 {
	return ucenibal.PodilSPredpokladem(k, n, p, w)
}
func logit(p float64) float64   { return ucenibal.Logit(p) }
func zLogitu(x float64) float64 { return ucenibal.ZLogitu(x) }
func spojitZdroje(p []float64, predpoklad, rho float64) float64 {
	return ucenibal.SpojitZdroje(p, predpoklad, rho)
}
func priznakyModelky(m Modelka) udajePostavy       { return ucenibal.PriznakyModelky(m) }
func udajeSbirky(modelky []Modelka) []udajePostavy { return ucenibal.UdajeSbirky(modelky) }
func kvantilUdaje(s []float64, q float64, celaCisla bool) float64 {
	return ucenibal.KvantilUdaje(s, q, celaCisla)
}
func robustniOdhad(hodnoty []float64, celaCisla bool) (med, sOd, sDo float64) {
	return ucenibal.RobustniOdhad(hodnoty, celaCisla)
}
func invertovatCholesky(c [][]float64) [][]float64 { return ucenibal.InvertovatCholesky(c) }
func naucitRegresi(udaje []udajePostavy, cil, maska int) *regreseObvodu {
	return ucenibal.NaucitRegresi(udaje, cil, maska)
}
func naucitSousedy(udaje []udajePostavy, cil int) *sousedePostavy {
	return ucenibal.NaucitSousedy(udaje, cil)
}
func abs(x int) int  { return ucenibal.Abs(x) }
func bitu(x int) int { return bits.OnesCount(uint(x)) }
