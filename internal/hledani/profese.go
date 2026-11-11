package hledani

import (
	"regexp"
	"strings"
)

// Profese z pole Role (0.02.038, stejně jako frontend/src/lib/format.js profeseModelky): tituly a místa publikace
// (PMOTM, Penthouse Pet, Centerfold, Cybergirl, Cover…) se berou jen z galerií, z Role zbude Herečka, Zpěvačka…
var vzorTitulovehoZapisu = regexp.MustCompile(`(?i)playmate|\bpmo[mty]|\bpmotm|\bpet\b|\bpets\b|honey|centerfold|cyber ?girl|\bcoed|cover|ob[aá]lk|playboy|penthouse|hustler|\bmuses?\b|creator|online|speci[aá]l|of the (month|year)|měsíce|roku`)

var profeseJako = map[string]string{
	"model": "Modelka", "modelka": "Modelka", "actress": "Herečka", "singer": "Zpěvačka", "dancer": "Tanečnice",
	"porn actress": "Pornoherečka", "adult actress": "Pornoherečka", "pornstar": "Pornoherečka", "porn star": "Pornoherečka",
	"celebrity": "Celebrita", "celebrita": "Celebrita",
}

// JeTitulovyZapis: zápis v Roli, který je titulem nebo místem publikace, ne profesí
// (Playboy Bunny je povolání v klubu, ne titul čísla – zůstává profesí)
func JeTitulovyZapis(s string) bool {
	return vzorTitulovehoZapisu.MatchString(s) && !strings.Contains(strings.ToLower(s), "bunny")
}

// ProfeseZRole: profese bez titulů, česky („Model“ → „Modelka“), bez opakování, v zapsaném pořadí
func ProfeseZRole(role string) []string {
	var v []string
	for _, kus := range strings.FieldsFunc(role, func(r rune) bool { return r == ',' || r == ';' || r == '\n' }) {
		kus = strings.TrimSpace(kus)
		if kus == "" || JeTitulovyZapis(kus) {
			continue
		}
		nazev, ok := profeseJako[strings.Join(strings.Fields(Zjednodusit(kus)), " ")]
		if !ok {
			nazev = strings.ToUpper(kus[:1]) + kus[1:]
		}
		dup := false
		for _, x := range v {
			dup = dup || x == nazev
		}
		if !dup {
			v = append(v, nazev)
		}
	}
	return v
}
