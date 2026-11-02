package main

import (
	"testing"
	"time"
)

func den(r int, m time.Month, d int) time.Time { return time.Date(r, m, d, 0, 0, 0, 0, time.Local) }

func TestTextObdobi(t *testing.T) {
	for _, c := range []struct {
		od, do      time.Time
		sRokem, bez string
	}{
		{den(2026, 11, 2), den(2026, 11, 16), "2.–15. listopadu 2026", "2.–15. listopadu"},
		{den(2026, 11, 1), den(2026, 12, 1), "listopad 2026", "listopad"},
		{den(2026, 11, 28), den(2026, 12, 12), "28. listopadu – 11. prosince 2026", "28. listopadu – 11. prosince"},
		{den(2026, 12, 25), den(2027, 1, 8), "25. prosince 2026 – 7. ledna 2027", "25. prosince 2026 – 7. ledna 2027"},
		{den(2026, 11, 5), den(2026, 11, 6), "5. listopadu 2026", "5. listopadu"},
	} {
		if x := textObdobi(c.od, c.do, true); x != c.sRokem {
			t.Errorf("s rokem %q, čekáno %q", x, c.sRokem)
		}
		if x := textObdobi(c.od, c.do, false); x != c.bez {
			t.Errorf("bez roku %q, čekáno %q", x, c.bez)
		}
	}
}

// Období jdou za sebou bez mezer: první = probíhající měsíc, další s výchozí délkou od konce předchozího
func TestObdobiSezonBezMezer(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	obdobi, o := a.obdobiSezon(den(2026, 11, 20).Add(10 * time.Hour))
	if len(obdobi) != 1 || !o.od.Equal(den(2026, 11, 1)) || !o.do.Equal(den(2026, 12, 1)) {
		t.Fatalf("první období: %+v", obdobi)
	}
	// O měsíc později: prosincová období po 14 dnech, poslední zahrnuje dnešek
	obdobi, o = a.obdobiSezon(den(2026, 12, 20).Add(time.Hour))
	if len(obdobi) != 3 || !obdobi[1].od.Equal(den(2026, 12, 1)) || !obdobi[1].do.Equal(den(2026, 12, 15)) ||
		!o.od.Equal(den(2026, 12, 15)) || o.dni() != vychoziDelkaSezony {
		t.Fatalf("další období: %+v, probíhá %+v", obdobi, o)
	}
	// Uložené: znovu načtená stejná
	if znovu, _ := a.obdobiSezon(den(2026, 12, 21)); len(znovu) != 3 {
		t.Errorf("období se neuložila: %+v", znovu)
	}
	k := ukonceneSezony(nil, obdobi, den(2026, 12, 20))
	if len(k) != 2 || k[0].klic != "2026-11-01" || k[1].klic != "2026-12-01" {
		t.Errorf("ukončené: %+v", k)
	}
}

// Starší měsíční sezóny před prvním obdobím zůstávají měsíční
func TestUkonceneSezonyMesicni(t *testing.T) {
	obdobi := []obdobiSezony{{od: den(2026, 11, 1), do: den(2026, 11, 15)}}
	porovnani := []porovnaniZaznam{{cas: den(2026, 9, 10)}}
	k := ukonceneSezony(porovnani, obdobi, den(2026, 11, 20))
	if len(k) != 3 || k[0].klic != "2026-09" || k[1].klic != "2026-10" || !k[1].do.Equal(den(2026, 11, 1)) || k[2].klic != "2026-11-01" {
		t.Errorf("ukončené: %+v", k)
	}
	if od, do, ok := oknoSezony("2026-10", obdobi); !ok || !od.Equal(den(2026, 10, 1)) || !do.Equal(den(2026, 11, 1)) {
		t.Errorf("okno měsíce: %v %v", od, do)
	}
	if od, _, ok := oknoSezony("2026-11-01", obdobi); !ok || !od.Equal(den(2026, 11, 1)) {
		t.Errorf("okno období: %v", od)
	}
}

// Volba délky probíhající sezóny: jen z nabídky, konec ne v minulosti, neexistující sezónu nastavit nejde
func TestDelkaSezony(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	nyni := time.Now()
	od := zacatekDne(nyni).AddDate(0, 0, -3)
	a.uc.mu.Lock()
	a.uc.zajistit().Exec("INSERT INTO obdobi_sezon (od, do) VALUES (?, ?)", od.Format(formatDne), od.AddDate(0, 0, 14).Format(formatDne))
	a.uc.mu.Unlock()
	klic := od.Format(formatDne)
	if a.SetObdobiSezony(klic, "", 3) || a.SetObdobiSezony(klic, "", 9) || a.SetObdobiSezony(klic, "", 1) {
		t.Fatal("délka mimo nabídku prošla")
	}
	if !a.SetObdobiSezony(klic, "tag:podpatky", 7) {
		t.Fatal("délka 7 se neuložila")
	}
	s := a.GetSezona()
	if s.Klic != klic || s.Dni != 7 || s.Den != 4 || s.Zvolene != "tag:podpatky" || len(s.MozneDelky) != len(delkySezon) {
		t.Errorf("sezóna po volbě: %+v", s.NazevSezony)
	}
	if !a.SetObdobiSezony(klic, "", 0) || a.GetSezona().Dni != 7 {
		t.Error("téma bez změny délky mělo projít a délku nechat")
	}
	if a.SetObdobiSezony("2000-01-01", "", 7) {
		t.Error("neexistující sezóna prošla")
	}
}

// Mezera mezi obdobími z úpravy č. 8 (témata dvou budoucích měsíců) se vyplní; první období od začátku měsíce;
// měsíc zkrácený prvním obdobím má zkrácené okno
func TestObdobiMezeryAZacatek(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	a.uc.mu.Lock()
	db := a.uc.zajistit()
	db.Exec("INSERT INTO obdobi_sezon (od, do, tema) VALUES ('2026-12-01', '2027-01-01', 'tag:podpatky'), ('2027-02-01', '2027-03-01', '')")
	a.uc.mu.Unlock()
	obdobi, o := a.obdobiSezon(den(2026, 11, 2).Add(time.Hour))
	if len(obdobi) != 4 || !obdobi[0].od.Equal(den(2026, 11, 1)) || !obdobi[2].od.Equal(den(2027, 1, 1)) || !obdobi[2].do.Equal(den(2027, 2, 1)) {
		t.Fatalf("období: %+v", obdobi)
	}
	if !o.od.Equal(den(2026, 11, 1)) {
		t.Errorf("probíhající: %+v", o)
	}
	od, do, _ := oknoSezony("2026-11", []obdobiSezony{{od: den(2026, 11, 15), do: den(2026, 11, 29)}})
	if !od.Equal(den(2026, 11, 1)) || !do.Equal(den(2026, 11, 15)) {
		t.Errorf("zkrácený měsíc: %v–%v", od, do)
	}
	if n := nazvySezony(den(2026, 11, 1), den(2026, 11, 15), "tag:neexistuje"); n.nazev != "1.–14. listopadu 2026" {
		t.Errorf("neplatný klíč: %q", n.nazev)
	}
}
