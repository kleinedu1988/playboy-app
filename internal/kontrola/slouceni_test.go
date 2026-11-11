package kontrola

import (
	"pinup-katalog/internal/hledani"
	"strings"
	"testing"
)

// Vzorek dvojic (0.02.029): kandidát jen se stejným jménem a slučitelným datem; jiné datum nikdy
func TestKandidatiNaSlouceni(t *testing.T) {
	m := func(id int, jmeno, dalsi, narozeni string, vydani ...string) hledani.Modelka {
		return hledani.Modelka{ID: id, Jmeno: jmeno, DalsiJmena: dalsi, NarozeniDatum: narozeni, Vydani: vydani}
	}
	pripady := []struct {
		popis string
		a, b  hledani.Modelka
		chci  bool
	}{
		{"stejné jméno i datum, dva časopisy", m(1, "Jane Doe", "", "1965-03-12", "1985-09"), m(2, "Jane Doe", "", "1965-03-12", "1986-01@PH"), true},
		{"přezdívka a stejné datum", m(1, "Sylvie Novak", "Jane Doe @PH", "1965-03-12", "1985-09"), m(2, "Jane Doe", "", "1965-03-12", "1986-01@PH"), true},
		{"stejné jméno, jiné datum", m(1, "Jane Doe", "", "1965-03-12", "1985-09"), m(2, "Jane Doe", "", "1971-07-02", "1990-01@PH"), false},
		{"stejné jméno, jiný rok (jen rok známý)", m(1, "Jane Doe", "", "1965", "1985-09"), m(2, "Jane Doe", "", "1966-02-01", "1986-01@PH"), false},
		{"stejné jméno, stejný rok, jiný den", m(1, "Jane Doe", "", "1965-03-12", "1985-09"), m(2, "Jane Doe", "", "1965-03-13", "1986-01@PH"), false},
		{"stejné jméno, data neznámá, stejný časopis", m(1, "Jane Doe", "", "", "1985-09"), m(2, "Jane Doe", "", "", "1987-01"), false},
		{"stejné jméno, data neznámá, různé časopisy", m(1, "Jane Doe", "", "", "1985-09"), m(2, "Jane Doe", "", "", "1987-01@PH"), true},
		{"jiné jméno, stejné datum", m(1, "Jane Doe", "", "1965-03-12", "1985-09"), m(2, "Ann Smith", "", "1965-03-12", "1986-01@PH"), false},
		{"jen rok u jedné, sedí", m(1, "Jane Doe", "", "1965", "1985-09"), m(2, "Jane Doe", "", "1965-03-12", "1985-09"), true},
	}
	for _, p := range pripady {
		_, duvody, ok := KandidatNaSlouceni(p.a, p.b)
		if ok != p.chci {
			t.Errorf("%s: %v (%v), chci %v", p.popis, ok, duvody, p.chci)
		}
	}
	// Nález jednou za dvojici, u novější modelky, s důvody
	var nalezy []string
	KontrolovatSlouceni([]hledani.Modelka{pripady[0].a, pripady[0].b, m(3, "Jane Doe", "", "1971-07-02")}, nil,
		func(x hledani.Modelka, klic, zdroj, pole, popis string) {
			nalezy = append(nalezy, x.Jmeno+"#"+klic+"#"+popis)
		})
	if len(nalezy) != 1 || !strings.Contains(nalezy[0], "ok-slouceni") || !strings.Contains(nalezy[0], "stejné datum narození 1965-03-12") {
		t.Errorf("nálezy: %v", nalezy)
	}
	// Stejné jméno s rozporným datem dál hlásí „ok-jmeno“, kandidáta ne dvakrát
	var jmena []string
	KontrolovatJmena([]hledani.Modelka{pripady[0].a, pripady[0].b, m(3, "Jane Doe", "", "1971-07-02")},
		func(x hledani.Modelka, klic, zdroj, pole, popis string) { jmena = append(jmena, klic) })
	if len(jmena) != 1 {
		t.Errorf("ok-jmeno: %v", jmena)
	}
}

// Vizuální důvody (0.02.030): přidají se k nálezu a silnější kandidát jde první
func TestSlouceniVizualne(t *testing.T) {
	m := func(id int, jmeno, narozeni, vydani string) hledani.Modelka {
		return hledani.Modelka{ID: id, Jmeno: jmeno, NarozeniDatum: narozeni, Vydani: []string{vydani}}
	}
	modelky := []hledani.Modelka{m(1, "Ann Lee", "1970-01-01", "1990-01"), m(2, "Ann Lee", "1970-01-01", "1991-01@PH"),
		m(3, "Kate Moss", "1972-02-02", "1992-01"), m(4, "Kate Moss", "1972-02-02", "1993-01@PH")}
	vizualne := func(a, b hledani.Modelka) ([]string, float64) {
		if a.ID == 3 {
			return []string{"stejná fotka u obou"}, 1.9
		}
		return nil, 0.4
	}
	var nalezy []string
	KontrolovatSlouceni(modelky, vizualne, func(x hledani.Modelka, klic, zdroj, pole, popis string) { nalezy = append(nalezy, popis) })
	if len(nalezy) != 2 || !strings.Contains(nalezy[0], "Kate Moss") || !strings.Contains(nalezy[0], "stejná fotka u obou") {
		t.Errorf("pořadí a důvody: %v", nalezy)
	}
}
