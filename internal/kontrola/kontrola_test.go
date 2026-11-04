package kontrola

import (
	"testing"

	"playboy-app/internal/hledani"
)

func TestPripravitJmenoAPodobnost(t *testing.T) {
	slovnik := NovySlovnikSlov()
	m1 := hledani.Modelka{ID: 1, Jmeno: "Anna Marie Smith", DalsiJmena: "Annie Smith"}
	m2 := hledani.Modelka{ID: 2, Jmeno: "Anna-Marie Smith"}
	a := PripravitJmeno(m1.Jmeno, 0, slovnik)
	b := PripravitJmeno(m2.Jmeno, 1, slovnik)
	s, _, ok := PodobnostModelek(a, b, m1, m2, 0.9)
	if !ok || s < 0.95 {
		t.Fatalf("PodobnostModelek = (%v, %v), očekáváno >= 0.95", s, ok)
	}
}

func TestDatumZNazvu(t *testing.T) {
	if d, p, ok := DatumZNazvu("Cyber Girl 2004-06-14", 2026); !ok || d != "2004-06-14" || p != 3 {
		t.Fatalf("DatumZNazvu = (%q, %d, %v)", d, p, ok)
	}
	if _, _, ok := DatumZNazvu("Bez čísla v názvu", 2026); ok {
		t.Fatal("DatumZNazvu mělo vrátit false pro název bez čtyřčíslí")
	}
}

func TestRozlozitMiryAVelikostEU(t *testing.T) {
	r, ok := RozlozitMiry("34C-24-35")
	if !ok || !r.Palce || r.Kosicek != "C" || r.Pasmo != 34 || r.Obvody[0] != 0 || r.Obvody[1] != 61 || r.Obvody[2] != 89 {
		t.Fatalf("RozlozitMiry(34C-24-35) = %+v, %v", r, ok)
	}
	if eu := VelikostEU(34, "DD"); eu != "75E" {
		t.Fatalf("VelikostEU(34, DD) = %q, očekáváno 75E", eu)
	}
}
