package main

// Časopisy v exportu (formát 14, Pinup Katalog 0.02.008, EXPORT.md). Export zapíše celou tabulku časopisů; import
// časopis podle klíče založí nebo přepíše jeho údaje (název, barva, edice, tituly, pořadí). Edice se jen přidávají:
// edici, kterou sbírka už má, import neubere, aby čísla v ní zůstala platná. Playboy je výchozí a jeho edice
// určuje program (dalsiEdice), z tabulky se u něj berou jen popisné údaje.

import (
	"fmt"
	"regexp"
	"strings"

	"pinup-katalog/internal/hledani"
)

type exportCasopis struct {
	Klic          string   `yaml:"klic"`
	Nazev         string   `yaml:"nazev"`
	Barva         string   `yaml:"barva,omitempty"`
	Edice         []string `yaml:"edice,flow"`
	ModelkaMesice string   `yaml:"modelka_mesice,omitempty"`
	ModelkaRoku   string   `yaml:"modelka_roku,omitempty"`
	Poradi        int      `yaml:"poradi,omitempty"`
}

var (
	vzorKliceCasopisu = regexp.MustCompile(`^[A-Z]{2}$`)
	vzorBarvy         = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

func (a *App) exportovatCasopisy() []exportCasopis {
	v := []exportCasopis{}
	for _, c := range a.GetCasopisy() {
		v = append(v, exportCasopis{Klic: c.Klic, Nazev: c.Nazev, Barva: c.Barva, Edice: c.Edice,
			ModelkaMesice: c.ModelkaMesice, ModelkaRoku: c.ModelkaRoku, Poradi: c.Poradi})
	}
	return v
}

func (a *App) importovatCasopisy(casopisy []exportCasopis, vysledek *VysledekImportu) {
	for _, c := range casopisy {
		klic := strings.ToUpper(strings.TrimSpace(c.Klic))
		nazev := strings.TrimSpace(c.Nazev)
		if !vzorKliceCasopisu.MatchString(klic) || nazev == "" {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("časopis „%s“: klíč musí být dvě velká písmena (PH) a časopis musí mít název", c.Klic))
			continue
		}
		barva := strings.TrimSpace(c.Barva)
		if barva != "" && !vzorBarvy.MatchString(barva) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("časopis %s: barva „%s“ není ve tvaru #rrggbb, zůstane původní", klic, barva))
			barva = ""
		}
		// Edice: stávající zůstanou, nové se přidají na konec (u nového časopisu v pořadí ze souboru)
		var ulozene string
		a.db.QueryRow(`SELECT edice FROM casopisy WHERE klic = ?`, klic).Scan(&ulozene)
		edice := []string{}
		pridat := func(e string) {
			e = strings.ToUpper(strings.TrimSpace(e))
			if e == "" {
				return
			}
			if !vzorZemeEdice.MatchString(e) {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("časopis %s: edice „%s“ není dvoupísmenná zkratka země (US, UK)", klic, e))
				return
			}
			for _, x := range edice {
				if x == e {
					return
				}
			}
			edice = append(edice, e)
		}
		for _, e := range strings.Split(ulozene, ",") {
			pridat(e)
		}
		for _, e := range c.Edice {
			pridat(e)
		}
		if len(edice) == 0 {
			edice = []string{"US"}
		}
		if klic == hledani.VychoziCasopis && ulozene != "" {
			edice = strings.Split(ulozene, ",")
		}
		if _, err := a.db.Exec(`INSERT INTO casopisy (klic, nazev, barva, edice, modelka_mesice, modelka_roku, poradi) VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(klic) DO UPDATE SET nazev = excluded.nazev, barva = CASE WHEN excluded.barva = '' THEN barva ELSE excluded.barva END,
				edice = excluded.edice, modelka_mesice = CASE WHEN excluded.modelka_mesice = '' THEN modelka_mesice ELSE excluded.modelka_mesice END,
				modelka_roku = CASE WHEN excluded.modelka_roku = '' THEN modelka_roku ELSE excluded.modelka_roku END,
				poradi = CASE WHEN excluded.poradi = 0 THEN poradi ELSE excluded.poradi END`,
			klic, nazev, barva, strings.Join(edice, ","), strings.TrimSpace(c.ModelkaMesice), strings.TrimSpace(c.ModelkaRoku), c.Poradi); err != nil {
			a.chyba("import časopisu", err)
		}
	}
}
