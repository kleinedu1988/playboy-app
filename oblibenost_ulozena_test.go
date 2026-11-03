package main

import (
	"context"
	"testing"
)

// Po novém spuštění bez změny dat dá seznam modelek tutéž oblíbenost z uložené mezipaměti (model se počítá na
// pozadí); po změně dat se uložená nepoužije
func TestUlozenaOblibenost(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.startNaPozadi = true
	for i, j := range []string{"Adéla", "Bára", "Cecílie", "Dana"} {
		a.AddModelka(Modelka{Jmeno: j, Hodnoceni: float64(i%3 + 2)})
	}
	a.PorovnatModelky(1, 2, "a")
	puvodni := a.GetModelky("")
	a.shutdown()

	b := NewApp()
	b.startNaPozadi = true
	b.startup(context.Background())
	t.Cleanup(func() { b.shutdown() })
	b.pockatNaPozadi()
	if b.ulozenaOblibenost(b.modelkyProTemata()) == nil {
		t.Fatal("uložená oblíbenost se nenačetla")
	}
	znovu := b.GetModelky("")
	for i := range puvodni {
		x, y := puvodni[i], znovu[i]
		if x.ID != y.ID || x.Oblibenost != y.Oblibenost || x.Poradi != y.Poradi || x.OdhadHodnoceni != y.OdhadHodnoceni || x.UrovenTop != y.UrovenTop {
			t.Fatalf("%s: %+v / %+v", x.Jmeno, x, y)
		}
	}
	b.PorovnatModelky(2, 3, "a")
	b.uc.ob.vypocet.Lock()
	b.uc.ob.model = nil
	b.uc.ob.vypocet.Unlock()
	if b.ulozenaOblibenost(b.modelkyProTemata()) != nil {
		t.Fatal("po novém porovnání se nemá použít stará uložená oblíbenost")
	}
}
