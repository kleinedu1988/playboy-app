package hledani

import (
	"strings"
	"testing"
)

// Z Role jen profese (0.02.038), stejně jako frontend profeseModelky; Playboy Bunny je povolání
func TestProfeseZRole(t *testing.T) {
	for role, chci := range map[string]string{
		"PMOTM, PMOTY, Model, Actress":             "Modelka, Herečka",
		"Penthouse Pet; Playboy Cybergirl\nSinger": "Zpěvačka",
		"Playboy Bunny, model, Modelka":            "Playboy Bunny, Modelka",
		"":                                         "",
	} {
		if mam := strings.Join(ProfeseZRole(role), ", "); mam != chci {
			t.Errorf("%q: %q, chci %q", role, mam, chci)
		}
	}
	m := &Modelka{Role: "PMOTM, Herečka", OnlineAlba: []string{"2004-06"}}
	if k := kategorieKHledani(m); k != "Herečka, Online" {
		t.Errorf("kategorie %q", k)
	}
	if vyskytKHledani(&Modelka{Role: "Muse"}) != "neurceno neurčeno" {
		t.Error("výskyt z Role")
	}
}
