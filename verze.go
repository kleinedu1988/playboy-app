package main

import (
	"fmt"
	"strconv"
	"strings"
)

// Verze programu (MAJOR.MINOR.PATCH, pravidla v ROADMAP.md, oddíl „Pravidlo verzování“). Tady, ve wails.json
// a v package.json je bez nul na začátku (SemVer, jinak je npm ani Wails nepřijmou); v programu a v CHANGELOG.md
// se ukazuje s pevnou šířkou X.XX.XXX (0.1.1 → 0.01.001, zobrazitVerzi). Při vydání se změní tady, ve wails.json
// (info.productVersion) a ve frontend/package.json a v CHANGELOG.md dostane datum; test hlídá, že spolu souhlasí.
const Verze = "0.2.29"

// Název programu (do 1.53.0 „Playboy Database“, viz prejmenovani.go). Kontrola nové verze podle něj pozná,
// že vzdálená větev patří k nové řadě verzí (aktualizace.go).
const NazevProgramu = "Pinup Katalog"

// Verze s pevnou šířkou X.XX.XXX: „0.1.1“ → „0.01.001“, „0.2.0-dev“ → „0.02.000-dev“; jiný tvar beze změny
func zobrazitVerzi(v string) string {
	zaklad, pripona, sPriponou := strings.Cut(v, "-")
	casti := strings.Split(zaklad, ".")
	if len(casti) != 3 {
		return v
	}
	var c [3]int
	for i, s := range casti {
		n, err := strconv.Atoi(s)
		if err != nil {
			return v
		}
		c[i] = n
	}
	vysledek := fmt.Sprintf("%d.%02d.%03d", c[0], c[1], c[2])
	if sPriponou {
		vysledek += "-" + pripona
	}
	return vysledek
}

// Verze pro zobrazení v programu (pevná šířka; porovnávání v rozhraní je číselné, nuly mu nevadí)
func (a *App) GetVerze() string {
	return zobrazitVerzi(Verze)
}
