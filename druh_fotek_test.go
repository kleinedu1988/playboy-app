package main

import "testing"

func TestSkupinaDruhu(t *testing.T) {
	s := skupinaDruhu([]FotkaDruhu{{DriveID: "a", Jistota: 0.9}, {DriveID: "b", Jistota: 0.99}, {DriveID: "c", Jistota: 0.95}}, 2)
	if s.Celkem != 3 || len(s.Fotky) != 2 || s.Fotky[0].DriveID != "b" || s.Fotky[1].DriveID != "c" || s.Fotky[0].URL == "" {
		t.Fatalf("skupina %+v", s)
	}
	if p := skupinaDruhu(nil, 24); p.Fotky == nil || p.Celkem != 0 {
		t.Fatalf("prázdná skupina %+v", p)
	}
}

func TestNavrhyDruhuBezObsahu(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	v := a.GetNavrhyDruhu(24)
	if v.Muz.Fotky == nil || v.Zeny.Fotky == nil || v.Muz.Celkem+v.Zeny.Celkem != 0 {
		t.Fatalf("bez obsahu %+v", v)
	}
}
