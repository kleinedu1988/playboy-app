package main

// Témata sezón na více jádrech: každé téma se vyhodnocuje samostatně nad stejnými (jen čtenými) daty, takže
// návrh sezóny a témata k odemčení si výsledky všech témat nejdřív spočítají souběžně do paměti témat ke snímku
// (pametTematu) a pak je jen poskládají. Bez snímku sbírky (testy bez paměti) se nic nepředpočítává.

import (
	"runtime"
	"sync"
)

func (a *App) predpocitatTemata(temata []Tema, spocitat func(t *Tema)) {
	if len(temata) < 2 || a.snimekVPameti() == nil {
		return
	}
	// Společná data témat se připraví jednou předem (jinak by je souběžně chystalo každé vlákno)
	a.modelkyProTemata()
	a.seznamFotekProTemata()
	a.proslePruvodcemKeSnimku()
	fronta := make(chan *Tema)
	var cekani sync.WaitGroup
	for range min(runtime.NumCPU(), len(temata)) {
		cekani.Add(1)
		go func() {
			defer cekani.Done()
			for t := range fronta {
				spocitat(t)
			}
		}()
	}
	for i := range temata {
		fronta <- &temata[i]
	}
	close(fronta)
	cekani.Wait()
}
