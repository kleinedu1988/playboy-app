package uceni

import (
	"math"
	"testing"
	"time"

	"playboy-app/internal/hledani"
)

func TestSlovnikHodnot(t *testing.T) {
	s := NovySlovnik()
	for range 12 {
		s.Pridat("philippines", "Philippines")
	}
	s.Pridat("phillipines", "Phillipines")
	s.Pridat("kanada", "Kanada")
	s.Pridat("kanady", "Kanady")
	s.Naucit()
	if s.Klic("phillipines") != "philippines" || s.Zapis("phillipines") != "Philippines" {
		t.Errorf("překlep: %q %q", s.Klic("phillipines"), s.Zapis("phillipines"))
	}
	if s.Klic("kanady") != "kanady" {
		t.Error("stejně časté tvary se nesjednocují")
	}
	s.Preferovane = map[string]string{"philippines": "Filipíny"}
	if s.Zapis("philippines") != "Filipíny" {
		t.Error("zápis uživatele má přednost")
	}
}

func TestSpojitZdrojeAKalibrace(t *testing.T) {
	if p := SpojitZdroje([]float64{0.8}, 0.3, TlumeniZavislosti); math.Abs(p-0.8) > 1e-9 {
		t.Errorf("jediný zdroj: %v", p)
	}
	if p := SpojitZdroje([]float64{0.8, 0.8}, 0.3, TlumeniZavislosti); p <= 0.8 || p >= 0.99 {
		t.Errorf("dva zdroje: %v", p)
	}
	if p := SpojitZdroje([]float64{0.8, 0.2}, 0.3, TlumeniZavislosti); p >= 0.8 {
		t.Errorf("zdroj proti: %v", p)
	}

	var nic KalibraceZdroje
	if nic.Upravit(0.83, 0.85) != 0.83 || nic.Presnost(0.85) != 0.85 {
		t.Error("bez rozhodnutí se jistota mění")
	}
	odmitany := KalibraceZdroje{N: 10, Prijato: 0, Predpoved: 9}
	if r := odmitany.Presnost(0.85); math.Abs(r-7.2/18) > 1e-9 {
		t.Errorf("úspěšnost odmítaného zdroje %v", r)
	}
	if p := odmitany.Upravit(0.9, 0.85); math.Abs(p-0.4) > 1e-9 {
		t.Errorf("kalibrovaná jistota %v", p)
	}
	t1, _ := time.ParseInLocation("2006-01-02 15:04:05", "2025-01-01 00:00:00", time.Local)
	t2, _ := time.ParseInLocation("2006-01-02 15:04:05", "2026-01-01 00:00:00", time.Local)
	if w := VahaStari(t1, t2); math.Abs(w-0.5) > 0.01 {
		t.Errorf("váha rozhodnutí po roce: %v", w)
	}
}

func TestVydaniAVek(t *testing.T) {
	if r, m, ed, ok := CastiVydani("2012-03-CZ"); !ok || r != 2012 || m != 3 || ed != "CZ" {
		t.Errorf("CastiVydani 2012-03-CZ: %d %d %s %v", r, m, ed, ok)
	}
	if r, m, ed, ok := CastiVydani("1995-S01"); !ok || r != 1995 || m != 0 || ed != "US" {
		t.Errorf("CastiVydani 1995-S01: %d %d %s %v", r, m, ed, ok)
	}
	if vek := VekKVydani("1990-05-12", "2012-03-CZ"); vek != 21 {
		t.Errorf("VekKVydani: %d, čekám 21", vek)
	}
	m := hledani.Modelka{Vydani: []string{"1995-S01", "1996-05", "1995-11"}}
	if prvni := PrvniVydani(m); prvni != "1995-11" {
		t.Errorf("PrvniVydani: %q, čekám 1995-11", prvni)
	}
}

func TestSousedeARegrese(t *testing.T) {
	var modelky []hledani.Modelka
	for i := range 300 {
		boky := 84 + i%16
		pas := 58
		if boky >= 92 {
			pas = 66
		}
		modelky = append(modelky, hledani.Modelka{VyskaCm: 165 + i%10, ObvodHrudnikCm: 86 + i%7, ObvodPasCm: pas, ObvodBokyCm: boky})
	}
	udaje := UdajeSbirky(modelky)
	s := NaucitSousedy(udaje, PrPas)
	if s == nil {
		t.Fatal("NaucitSousedy vrátil nil")
	}
	u := PriznakyModelky(hledani.Modelka{VyskaCm: 168, ObvodHrudnikCm: 88, ObvodBokyCm: 95})
	hodnota, _, _, ok := s.Odhad(u)
	if !ok || int(math.Round(hodnota)) != 66 {
		t.Errorf("Odhad sousedů: %v (%v), čekám 66", hodnota, ok)
	}
	r := NaucitRegresi(udaje, PrPas, (1<<PrVyska)|(1<<PrHrudnik)|(1<<PrBoky))
	if r == nil || r.N != 300 {
		t.Fatalf("NaucitRegresi: %+v", r)
	}
}
