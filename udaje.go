package main

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// Úprava č. 8 (poslední před alfou): datum úmrtí u modelky a textový údaj „na obálce“ u čísla
// pro modelku, která ve sbírce není. Datum narození i úmrtí smí být neúplné: RRRR, RRRR-MM nebo RRRR-MM-DD.

func (a *App) migraceUmrtiAObalka() error {
	if !a.maSloupec("modelky", "umrti_datum") {
		if _, err := a.db.Exec("ALTER TABLE modelky ADD COLUMN umrti_datum TEXT"); err != nil {
			return err
		}
	}
	if !a.maSloupec("vydani", "na_obalce") {
		if _, err := a.db.Exec("ALTER TABLE vydani ADD COLUMN na_obalce TEXT"); err != nil {
			return err
		}
	}
	return nil
}

// Datum modelky: rok, rok a měsíc, nebo celé datum
var vzorDatumu = regexp.MustCompile(`^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$`)

// Prázdné datum je v pořádku (údaj chybí)
func platneDatum(datum string) bool {
	datum = strings.TrimSpace(datum)
	return datum == "" || vzorDatumu.MatchString(datum)
}

// Data modelky musí mít tvar RRRR, RRRR-MM nebo RRRR-MM-DD a úmrtí nesmí předcházet narození
func overitDataModelky(m Modelka) error {
	narozeni, umrti := strings.TrimSpace(m.NarozeniDatum), strings.TrimSpace(m.UmrtiDatum)
	if !platneDatum(narozeni) {
		return fmt.Errorf("datum narození „%s“ není ve tvaru RRRR, RRRR-MM nebo RRRR-MM-DD", narozeni)
	}
	if !platneDatum(umrti) {
		return fmt.Errorf("datum úmrtí „%s“ není ve tvaru RRRR, RRRR-MM nebo RRRR-MM-DD", umrti)
	}
	// Texty ve stejném tvaru se dají porovnat přímo; u neúplného data stačí shoda na společné délce
	if narozeni != "" && umrti != "" {
		delka := min(len(narozeni), len(umrti))
		if umrti[:delka] < narozeni[:delka] {
			return fmt.Errorf("datum úmrtí %s je před datem narození %s", umrti, narozeni)
		}
	}
	return nil
}

// Pomlčka v importu údaj smaže; prázdný nebo chybějící údaj nechá stávající
const smazatUdaj = "-"

func hodnotaZImportu(novy, puvodni string) string {
	switch strings.TrimSpace(novy) {
	case smazatUdaj:
		return ""
	case "":
		return puvodni
	}
	return strings.TrimSpace(novy)
}

// Číselný údaj v souboru exportu: číslo, nebo „-“ pro smazání. V exportu se zapisuje jako obyčejné číslo.
type cisloUdaje struct {
	Hodnota int
	Smazat  bool
}

func (c cisloUdaje) IsZero() bool { return c.Hodnota == 0 && !c.Smazat }

func (c cisloUdaje) MarshalYAML() (interface{}, error) { return c.Hodnota, nil }

func (c *cisloUdaje) UnmarshalYAML(uzel *yaml.Node) error {
	text := strings.TrimSpace(uzel.Value)
	if text == smazatUdaj {
		*c = cisloUdaje{Smazat: true}
		return nil
	}
	hodnota, err := strconv.Atoi(text)
	if err != nil {
		return fmt.Errorf("„%s“ není celé číslo (pro smazání údaje napiš -)", text)
	}
	*c = cisloUdaje{Hodnota: hodnota}
	return nil
}

// Hodnocení modelky v souboru exportu (od verze 9 po polovinách srdíčka): 0–5 po 0,5, nebo „-“ pro smazání.
// Zapisuje se celé číslo bez „.0“ (4), polovina s desetinnou tečkou (3.5); import přijme i desetinnou čárku
// („3,5“). Jiná hodnota (3.3, 7, text) je chyba souboru s jasnou hláškou. 0 nic nemění (jako chybějící údaj).
type hodnoceniUdaje struct {
	Pul    int // v polovinách srdíčka (0–10)
	Smazat bool
}

func (h hodnoceniUdaje) IsZero() bool { return h.Pul == 0 && !h.Smazat }

func (h hodnoceniUdaje) MarshalYAML() (interface{}, error) {
	if h.Pul%2 == 0 {
		return h.Pul / 2, nil
	}
	return float64(h.Pul) / 2, nil
}

func (h *hodnoceniUdaje) UnmarshalYAML(uzel *yaml.Node) error {
	text := strings.TrimSpace(uzel.Value)
	if text == smazatUdaj {
		*h = hodnoceniUdaje{Smazat: true}
		return nil
	}
	chyba := fmt.Errorf("„%s“ není hodnocení modelky: zapiš 0–5 srdíček po polovinách, např. 4 nebo 3.5 (pro smazání údaje napiš -)", text)
	if !vzorPulSrdicka.MatchString(text) {
		return chyba
	}
	x, err := strconv.ParseFloat(strings.Replace(text, ",", ".", 1), 64)
	if err != nil || x > 5 || math.Abs(x*2-math.Round(x*2)) > 1e-9 {
		return chyba
	}
	*h = hodnoceniUdaje{Pul: int(math.Round(x * 2))}
	return nil
}

func cisloZImportu(novy cisloUdaje, puvodni int) int {
	if novy.Smazat {
		return 0
	}
	if novy.Hodnota != 0 {
		return novy.Hodnota
	}
	return puvodni
}

// Ano/ne z importu: „-“ údaj smaže (neuvedeno), prázdný nebo nesrozumitelný nechá stávající
func anoNeZImportu(text string, puvodni int) int {
	if strings.TrimSpace(text) == smazatUdaj {
		return -1
	}
	return anoNeZTextu(text, puvodni)
}

// Překlep v klíči souboru („narodnot:“) se opraví na nejbližší známý klíč, neznámý klíč se ohlásí.
// Prochází se strom dokumentu; klíče všech struktur formátu jsou v znameKlice.
func opravitKlice(uzel *yaml.Node, hlaseni *[]string) {
	if uzel == nil {
		return
	}
	if uzel.Kind == yaml.MappingNode {
		for i := 0; i+1 < len(uzel.Content); i += 2 {
			klic := uzel.Content[i]
			if klic.Kind == yaml.ScalarNode && !znameKlice[klic.Value] {
				if opraveny := nejblizsiKlic(klic.Value); opraveny != "" {
					*hlaseni = append(*hlaseni, fmt.Sprintf("řádek %d: klíč „%s“ opraven na „%s“", klic.Line, klic.Value, opraveny))
					klic.Value = opraveny
				} else {
					*hlaseni = append(*hlaseni, fmt.Sprintf("řádek %d: neznámý klíč „%s“ byl přeskočen", klic.Line, klic.Value))
				}
			}
			opravitKlice(uzel.Content[i+1], hlaseni)
		}
		return
	}
	for _, dite := range uzel.Content {
		opravitKlice(dite, hlaseni)
	}
}

// Nejbližší známý klíč, pokud se od něj liší nejvýš o dva znaky (u krátkých klíčů o jeden); jinak prázdný.
// Při dvou stejně blízkých klíčích se nehádá.
func nejblizsiKlic(klic string) string {
	klic = strings.ToLower(strings.TrimSpace(klic))
	if znameKlice[klic] {
		return klic
	}
	nejlepsi, vzdalenost, nejednoznacne := "", 99, false
	for znamy := range znameKlice {
		d := levenshtein(klic, znamy)
		if d < vzdalenost {
			nejlepsi, vzdalenost, nejednoznacne = znamy, d, false
		} else if d == vzdalenost {
			nejednoznacne = true
		}
	}
	limit := 2
	if len([]rune(klic)) <= 4 {
		limit = 1
	}
	if vzdalenost > limit || nejednoznacne {
		return ""
	}
	return nejlepsi
}

func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	radek := make([]int, len(rb)+1)
	for j := range radek {
		radek[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		predchozi := radek[0]
		radek[0] = i
		for j := 1; j <= len(rb); j++ {
			puvodni := radek[j]
			cena := 1
			if ra[i-1] == rb[j-1] {
				cena = 0
			}
			radek[j] = min(radek[j]+1, radek[j-1]+1, predchozi+cena)
			predchozi = puvodni
		}
	}
	return radek[len(rb)]
}
