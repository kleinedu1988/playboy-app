package kontrola

import (
	"fmt"
	"pinup-katalog/internal/hledani"
	"sort"
	"strings"
)

// Kandidáti na sloučení (0.02.029): dvě modelky se stejným jménem nebo přezdívkou, jejichž data narození si
// neodporují – typicky tatáž modelka založená zvlášť pro Playboy a pro Penthouse. Jiné datum narození (v přesnosti,
// kterou znají obě) kandidáta vylučuje. Bez data u některé z nich je kandidátem jen modelka z jiného časopisu
// (stejné jméno ve stejném časopise hlásí „ok-jmeno“). Sloučení samo je 0.02.033, tady jen úkol Údržby.

// Jména modelky zjednodušená (jméno a další jména bez přípony časopisu)
func jmenaModelky(m hledani.Modelka) map[string]string {
	v := map[string]string{}
	for _, j := range append([]string{m.Jmeno}, hledani.DalsiJmena(m.DalsiJmena)...) {
		if k := hledani.Zjednodusit(strings.TrimSpace(j)); k != "" {
			v[k] = strings.TrimSpace(j)
		}
	}
	return v
}

// Časopisy čísel a obálek modelky (klíče „PB“, „PH“…)
func casopisyModelky(m hledani.Modelka) map[string]bool {
	v := map[string]bool{}
	for _, c := range append(append(append([]string{}, m.Vydani...), m.Obalky...), m.Centerfoldy...) {
		if len(c) < 4 {
			continue
		}
		_, k := hledani.RozdelitCasopis(c)
		if k == "" {
			k = hledani.VychoziCasopis
		}
		v[k] = true
	}
	return v
}

// Porovnání dat narození: shoda (v přesnosti obou), rozpor, nebo neznámé (aspoň jedno chybí)
func porovnatNarozeni(a, b string) (shoda string, rozpor bool) {
	a, b = strings.TrimSpace(a), strings.TrimSpace(b)
	if len(a) < 4 || len(b) < 4 {
		return "", false
	}
	n := min(len(a), len(b))
	for _, p := range []int{10, 7, 4} {
		if n >= p {
			if a[:p] != b[:p] {
				return "", true
			}
			switch p {
			case 10:
				return "stejné datum narození " + a[:10], false
			case 7:
				return "stejný měsíc narození " + a[:7], false
			}
			return "stejný rok narození " + a[:4], false
		}
	}
	return "", false
}

// KandidatNaSlouceni: důvody, proč jsou a a b nejspíš tatáž modelka; ok = false, když kandidátem nejsou
func KandidatNaSlouceni(a, b hledani.Modelka) (jmeno string, duvody []string, ok bool) {
	if a.ID == b.ID {
		return "", nil, false
	}
	ja, jb := jmenaModelky(a), jmenaModelky(b)
	klice := make([]string, 0, len(ja))
	for k := range ja {
		if _, je := jb[k]; je {
			klice = append(klice, k)
		}
	}
	if len(klice) == 0 {
		return "", nil, false
	}
	sort.Strings(klice)
	jmeno = ja[klice[0]]
	shoda, rozpor := porovnatNarozeni(a.NarozeniDatum, b.NarozeniDatum)
	if rozpor {
		return "", nil, false
	}
	ca, cb := casopisyModelky(a), casopisyModelky(b)
	jinyCasopis := false
	for k := range cb {
		if !ca[k] {
			jinyCasopis = true
		}
	}
	for k := range ca {
		if !cb[k] {
			jinyCasopis = true
		}
	}
	if shoda == "" && !jinyCasopis {
		return "", nil, false
	}
	duvody = append(duvody, "stejné jméno „"+jmeno+"“")
	if shoda != "" {
		duvody = append(duvody, shoda)
	} else {
		duvody = append(duvody, "datum narození zná jen jedna nebo žádná")
	}
	if jinyCasopis {
		duvody = append(duvody, "čísla z různých časopisů")
	}
	return jmeno, duvody, true
}

// VizualniDuvody: důvody z fotek dvojice (podobné fotky, stejná fotka) a skóre pro pořadí kandidátů (0.02.030)
type VizualniDuvody func(a, b hledani.Modelka) ([]string, float64)

// KontrolovatSlouceni: nález „ok-slouceni“ u novější modelky dvojice (vyšší ID), jednou za dvojici; s vizualne
// (může být nil) jsou u nálezu i důvody z fotek a kandidáti jdou od nejsilnějších (víc důvodů, podobnější fotky)
func KontrolovatSlouceni(modelky []hledani.Modelka, vizualne VizualniDuvody, pridat PridatNalez) {
	type kandidat struct {
		a, b   hledani.Modelka
		duvody []string
		skore  float64
	}
	var kandidati []kandidat
	podleJmena := map[string][]int{}
	for i, m := range modelky {
		for k := range jmenaModelky(m) {
			podleJmena[k] = append(podleJmena[k], i)
		}
	}
	videno := map[[2]int]bool{}
	klice := make([]string, 0, len(podleJmena))
	for k := range podleJmena {
		klice = append(klice, k)
	}
	sort.Strings(klice)
	for _, k := range klice {
		idx := podleJmena[k]
		for x := 0; x < len(idx); x++ {
			for y := x + 1; y < len(idx); y++ {
				a, b := modelky[idx[x]], modelky[idx[y]]
				if a.ID > b.ID {
					a, b = b, a
				}
				par := [2]int{a.ID, b.ID}
				if a.ID == b.ID || videno[par] {
					continue
				}
				videno[par] = true
				if _, duvody, ok := KandidatNaSlouceni(a, b); ok {
					k := kandidat{a: a, b: b, duvody: duvody, skore: float64(len(duvody))}
					if vizualne != nil {
						dalsi, s := vizualne(a, b)
						k.duvody, k.skore = append(k.duvody, dalsi...), k.skore+float64(len(dalsi))+s
					}
					kandidati = append(kandidati, k)
				}
			}
		}
	}
	sort.SliceStable(kandidati, func(i, j int) bool { return kandidati[i].skore > kandidati[j].skore })
	for _, k := range kandidati {
		pridat(k.b, "ok-slouceni", "slouceni", "inputDalsiJmena",
			fmt.Sprintf("nejspíš tatáž modelka jako %s (id %d): %s – sloučit?", k.a.Jmeno, k.a.ID, strings.Join(k.duvody, ", ")))
	}
}
