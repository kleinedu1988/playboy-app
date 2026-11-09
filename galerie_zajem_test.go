package main

import (
	"testing"
	"time"
)

// Otevírané kolekce stoupají (i jejich skupina), přehlížené řady klesají, zájem vyprchává
func TestZajemKolekci(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	nyni := time.Now()
	if n := a.zajemKolekci(nyni).nasobitel("styl:retro60"); n != 1 {
		t.Fatalf("bez zájmu %v", n)
	}
	a.ZaznamenatKolekci("styl:retro60", "otevreni")
	a.ZaznamenatKolekci("styl:retro60", "otevreni")
	a.ZaznamenatKolekci("styl:retro60", "fotka")
	z := a.zajemKolekci(nyni)
	if z.nasobitel("styl:retro60") < 1.4 || !z.oblibena("styl:retro60") {
		t.Fatalf("otevíraná %v", z.nasobitel("styl:retro60"))
	}
	if n := z.nasobitel("styl:neon"); n <= 1 || n >= z.nasobitel("styl:retro60") {
		t.Fatalf("skupina %v", n)
	}
	if n := z.nasobitel("cas:mesic"); n != 1 {
		t.Fatalf("jiná skupina %v", n)
	}
	// Za 60 dní (dva poločasy) jen čtvrtina bodů; den záznamu se počítá od půlnoci, proto poledne (večer by
	// uplynulo o hodiny víc a test by padal podle denní doby)
	poledne := time.Date(nyni.Year(), nyni.Month(), nyni.Day(), 12, 0, 0, 0, nyni.Location())
	if b := z.data["styl:retro60"].bodyK(poledne.AddDate(0, 0, 60)); b < 0.55 || b > 0.6 {
		t.Fatalf("vyprchání %v", b)
	}
	// Řada ukázaná 10 různých dní bez zájmu klesne
	for d := range 10 {
		a.zaznamenatUkazaneRady([]string{"cas:mesic"}, nyni.AddDate(0, 0, d+1))
	}
	a.zaznamenatUkazaneRady([]string{"cas:mesic"}, nyni.AddDate(0, 0, 10)) // týž den znovu se nepočítá
	z = a.zajemKolekci(nyni)
	if z.data["cas:mesic"].Prehlizeno != 10 || z.nasobitel("cas:mesic") >= 1 {
		t.Fatalf("přehlížená %+v %v", z.data["cas:mesic"], z.nasobitel("cas:mesic"))
	}
	// Zájem přehlížení vynuluje
	a.ZaznamenatKolekci("cas:mesic", "fotka")
	if a.zajemKolekci(nyni).data["cas:mesic"].Prehlizeno != 0 {
		t.Fatal("po zájmu")
	}
}
