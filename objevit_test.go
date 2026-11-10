package main

import "testing"

func TestObjevitPrazdne(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.AddModelka(Modelka{Jmeno: "Anna", Tetovani: -1, Piercing: -1})
	v := a.GetObjevit(5)
	if v.Modelky == nil || v.Alba == nil || len(v.Alba) != 0 {
		t.Fatalf("bez odhadů prázdné seznamy, ne nil: %+v", v)
	}
	for _, m := range v.Modelky {
		if m.Duvod == "" {
			t.Fatalf("tip bez důvodu: %+v", m)
		}
	}
}
