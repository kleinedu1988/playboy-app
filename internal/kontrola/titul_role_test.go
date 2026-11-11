package kontrola

import (
	"testing"

	"pinup-katalog/internal/hledani"
)

func TestTitulMesiceVRoli(t *testing.T) {
	for role, chci := range map[string]bool{
		"PMOTM, Model": true, "Penthouse Pet": true, "Hustler Honey; Herečka": true, "Playmate": true,
		"PMOTM (Německo)": false, "Herečka": false, "Playboy Bunny": false, "": false,
	} {
		if titulMesiceVRoli(role) != chci {
			t.Errorf("%q: chci %v", role, chci)
		}
	}
	if !VzorPictorialuPMOY.MatchString("penthouse pet of the year 2017") || !VzorPictorialuPMOM.MatchString("hustler honey of the month") ||
		VzorPictorialuPMOM.MatchString("petra v miami") {
		t.Error("vzor Pet / Honey")
	}
}

// Číslo z údajů modelky se nenavrhne albu, jehož rok v názvu nesedí
func TestCisloZUdajuRokNazvu(t *testing.T) {
	m := hledani.Modelka{ID: 1, Jmeno: "S", PictorialVydani: "2016-06-MX"}
	NavrhnoutAlba([]hledani.Modelka{m}, []AlbumNavrhu{{ModelkaID: 1, Nazev: "2017-PMOY-MX", Typ: "Pictorial", Fotek: 1}}, 2026, nil,
		func(_ hledani.Modelka, _ *AlbumNavrhu, pole, hodnota, _, zdroj string, _ float64) {
			if pole == "vydaniAlba" && zdroj == "udaje" {
				t.Errorf("návrh %s", hodnota)
			}
		})
	if !VzorPictorialuPMOM.MatchString("playmates of the month may 1966") {
		t.Error("množné číslo")
	}
}
