package main

import "pinup-katalog/internal/oblibenost"

// Gradientní posilování mělkých regresních stromů pro model vkusu (oblibenost_vkus.go), čistě v Go
// (implementace v internal/oblibenost/stromy.go).

const (
	krokStromu       = oblibenost.KrokStromu
	hloubkaStromu    = oblibenost.HloubkaStromu
	maxStromu        = oblibenost.MaxStromu
	minListStromu    = oblibenost.MinListStromu
	lambdaStromu     = oblibenost.LambdaStromu
	podilRadkuStromu = oblibenost.PodilRadkuStromu
	maxKosuStromu    = oblibenost.MaxKosuStromu
	trpelivostStromu = oblibenost.TrpelivostStromu
)

type uzelStromu = oblibenost.UzelStromu
type stromVkusu = oblibenost.StromVkusu
type lesVkusu = oblibenost.LesVkusu
type prvekKosu = oblibenost.PrvekKosu
type dataStromu = oblibenost.DataStromu

func novaDataStromu(kosy [][]uint8, pocetKosu []int) *dataStromu {
	return oblibenost.NovaDataStromu(kosy, pocetKosu)
}

func naucitLes(d *dataStromu, y []float64, trenink []int, pocet int, semeno int64, poStromu func(t int, s stromVkusu) bool) *lesVkusu {
	return oblibenost.NaucitLes(d, y, trenink, pocet, semeno, poStromu)
}

func postavitStrom(d *dataStromu, radky []int, g []float64, uzel []int32) stromVkusu {
	return oblibenost.PostavitStrom(d, radky, g, uzel)
}

func hraniceKosu(hodnoty []float64) []float64 {
	return oblibenost.HraniceKosu(hodnoty)
}

func kosHodnoty(hranice []float64, x float64) uint8 {
	return oblibenost.KosHodnoty(hranice, x)
}
