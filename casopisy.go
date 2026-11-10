package main

// Časopisy (Pinup Katalog 0.02.003, ROADMAP etapa U): tabulka `casopisy` (úprava schématu č. 17). Klíč je
// dvoupísmenná zkratka, která se píše na konec klíče čísla („1985-09@PH“, hledani.RozdelitCasopis); Playboy (PB)
// je výchozí a do klíče se nepíše. Edice = země vydání, ve kterých časopis vycházel; první je výchozí (bez přípony).
// Názvy „modelky měsíce“ a „roku“ jsou tituly modelky (Pet of the Month, 0.02.009–0.02.012); správa časopisů
// (UlozitCasopis, SmazatCasopis) je od 0.02.013.

import (
	"fmt"
	"slices"
	"strings"

	"pinup-katalog/internal/hledani"
)

type Casopis struct {
	Klic          string   `json:"klic"`  // PB, PH, HU…
	Nazev         string   `json:"nazev"` // Playboy
	Barva         string   `json:"barva"` // #rrggbb
	Edice         []string `json:"edice"` // země vydání, první výchozí: ["US", "CZ"]
	ModelkaMesice string   `json:"modelkaMesice"`
	ModelkaRoku   string   `json:"modelkaRoku"`
	Poradi        int      `json:"poradi"`
}

// Předvyplněné časopisy (úprava č. 17); Playboy má edice podle dalsiEdice
var vychoziCasopisy = []Casopis{
	{Klic: hledani.VychoziCasopis, Nazev: "Playboy", Barva: "#d81b60", Edice: []string{"US", "CZ"}, ModelkaMesice: "Playmate měsíce", ModelkaRoku: "Playmate roku", Poradi: 1},
	{Klic: "PH", Nazev: "Penthouse", Barva: "#7e57c2", Edice: []string{"US", "UK"}, ModelkaMesice: "Pet of the Month", ModelkaRoku: "Pet of the Year", Poradi: 2},
	{Klic: "HU", Nazev: "Hustler", Barva: "#ffb300", Edice: []string{"US"}, ModelkaMesice: "Honey of the Month", ModelkaRoku: "Honey of the Year", Poradi: 3},
}

func (a *App) migraceCasopisy() error {
	if _, err := a.db.Exec(`CREATE TABLE IF NOT EXISTS casopisy (
		klic TEXT PRIMARY KEY CHECK (length(klic) = 2 AND klic = upper(klic)),
		nazev TEXT NOT NULL,
		barva TEXT NOT NULL DEFAULT '',
		edice TEXT NOT NULL DEFAULT 'US',
		modelka_mesice TEXT NOT NULL DEFAULT '',
		modelka_roku TEXT NOT NULL DEFAULT '',
		poradi INTEGER NOT NULL DEFAULT 0
	) WITHOUT ROWID`); err != nil {
		return err
	}
	for _, c := range vychoziCasopisy {
		if _, err := a.db.Exec(`INSERT OR IGNORE INTO casopisy (klic, nazev, barva, edice, modelka_mesice, modelka_roku, poradi) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			c.Klic, c.Nazev, c.Barva, strings.Join(c.Edice, ","), c.ModelkaMesice, c.ModelkaRoku, c.Poradi); err != nil {
			return err
		}
	}
	return nil
}

// Časopisy podle pořadí (Playboy první)
func (a *App) GetCasopisy() []Casopis {
	v := []Casopis{}
	radky, err := a.db.Query(`SELECT klic, nazev, barva, edice, modelka_mesice, modelka_roku, poradi FROM casopisy ORDER BY poradi, klic`)
	if err != nil {
		a.chyba("načtení časopisů", err)
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var c Casopis
		var edice string
		if radky.Scan(&c.Klic, &c.Nazev, &c.Barva, &edice, &c.ModelkaMesice, &c.ModelkaRoku, &c.Poradi) == nil {
			for _, e := range strings.Split(edice, ",") {
				if e = strings.TrimSpace(e); e != "" {
					c.Edice = append(c.Edice, e)
				}
			}
			if len(c.Edice) == 0 {
				c.Edice = []string{"US"}
			}
			v = append(v, c)
		}
	}
	return v
}

// Je řada („US“, „CZ“, „PH/UK“) známá: Playboy podle dalsiEdice, jiný časopis musí být v tabulce i s edicí
func (a *App) znamaRada(rada string) bool {
	if !platnaRada(rada) {
		return false
	}
	casopis, zeme, jiny := strings.Cut(rada, "/")
	if !jiny {
		return true
	}
	var edice string
	if a.db.QueryRow(`SELECT edice FROM casopisy WHERE klic = ?`, casopis).Scan(&edice) != nil {
		return false
	}
	for _, e := range strings.Split(edice, ",") {
		if strings.TrimSpace(e) == zeme {
			return true
		}
	}
	return false
}

// Tituly modelky měsíce a roku podle klíče časopisu (snímek sbírky, kategorie „Pet of the Month“); časopis bez
// titulu dostane obecný jako v rozhraní (titulCasopisu ve format.js)
func (a *App) titulyCasopisu() map[string][2]string {
	v := map[string][2]string{}
	for _, c := range a.GetCasopisy() {
		v[c.Klic] = [2]string{c.ModelkaMesice, c.ModelkaRoku}
	}
	return v
}

func titulyJinde(tituly map[string][2]string, mesice []string, roky map[string]string) []hledani.TitulCasopisu {
	v := []hledani.TitulCasopisu{}
	nazev := func(casopis string, i int, obecny string) string {
		if t := strings.TrimSpace(tituly[casopis][i]); t != "" {
			return t
		}
		return obecny
	}
	for _, c := range mesice {
		v = append(v, hledani.TitulCasopisu{Nazev: nazev(c, 0, "Modelka měsíce")})
	}
	klice := make([]string, 0, len(roky))
	for c := range roky {
		klice = append(klice, c)
	}
	slices.Sort(klice)
	for _, c := range klice {
		v = append(v, hledani.TitulCasopisu{Nazev: nazev(c, 1, "Modelka roku"), Rok: roky[c]})
	}
	return v
}

// Řady („US“, „CZ“, „PH/US“) všech čísel ve sbírce: alba (název centerfoldu a coveru, vydání pictorialu)
// a údaje čísel. Správa časopisů podle nich nedovolí smazat časopis ani ubrat edici, která se používá.
func (a *App) pouziteRady() map[string]bool {
	v := map[string]bool{}
	radky, err := a.db.Query(`SELECT album FROM alba WHERE typ IN ('Centerfold', 'Cover')
		UNION SELECT vydani FROM alba WHERE COALESCE(vydani, '') != '' UNION SELECT vydani FROM vydani`)
	if err != nil {
		a.chyba("použité řady čísel", err)
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var klic string
		if radky.Scan(&klic) == nil && klic != "" {
			v[edicePodleVydani(klic)] = true
		}
	}
	return v
}

// Uloží časopis ze správy časopisů (0.02.013); novy = zakládá se (klíč nesmí existovat). Vrací chybu k zobrazení,
// "" = uloženo. Klíč se nemění (je v klíčích čísel), edici, která má čísla, nejde ubrat; Playboy má edice
// pevné (US, CZ).
func (a *App) UlozitCasopis(c Casopis, novy bool) string {
	klic := strings.ToUpper(strings.TrimSpace(c.Klic))
	nazev := strings.TrimSpace(c.Nazev)
	barva := strings.TrimSpace(c.Barva)
	switch {
	case !vzorKliceCasopisu.MatchString(klic):
		return "Zkratka časopisu musí být dvě písmena bez diakritiky (např. OU)."
	case nazev == "":
		return "Časopis musí mít název."
	case barva != "" && !vzorBarvy.MatchString(barva):
		return "Barva musí být ve tvaru #rrggbb."
	}
	var ulozene string
	existuje := a.db.QueryRow(`SELECT edice FROM casopisy WHERE klic = ?`, klic).Scan(&ulozene) == nil
	if novy && existuje {
		return fmt.Sprintf("Časopis se zkratkou %s už je.", klic)
	}
	if !novy && !existuje {
		return fmt.Sprintf("Časopis %s není v tabulce.", klic)
	}
	edice := []string{}
	for _, e := range c.Edice {
		e = strings.ToUpper(strings.TrimSpace(e))
		if e == "" || slices.Contains(edice, e) {
			continue
		}
		if !vzorZemeEdice.MatchString(e) {
			return fmt.Sprintf("Edice „%s“ není dvoupísmenná zkratka země (US, UK, FR).", e)
		}
		edice = append(edice, e)
	}
	if klic == hledani.VychoziCasopis {
		edice = strings.Split(ulozene, ",")
	} else {
		if len(edice) == 0 {
			return "Časopis musí mít aspoň jednu edici (zemi vydání)."
		}
		pouzite := a.pouziteRady()
		for _, e := range strings.Split(ulozene, ",") {
			if e = strings.TrimSpace(e); e != "" && !slices.Contains(edice, e) && pouzite[hledani.RadaVydani(e, klic)] {
				return fmt.Sprintf("Edici %s nejde ubrat, sbírka má čísla %s %s.", e, nazev, e)
			}
		}
	}
	poradi := c.Poradi
	if novy && poradi <= 0 {
		a.db.QueryRow(`SELECT COALESCE(MAX(poradi), 0) + 1 FROM casopisy`).Scan(&poradi)
	}
	var err error
	if novy {
		_, err = a.db.Exec(`INSERT INTO casopisy (klic, nazev, barva, edice, modelka_mesice, modelka_roku, poradi) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			klic, nazev, barva, strings.Join(edice, ","), strings.TrimSpace(c.ModelkaMesice), strings.TrimSpace(c.ModelkaRoku), poradi)
	} else {
		_, err = a.db.Exec(`UPDATE casopisy SET nazev = ?, barva = ?, edice = ?, modelka_mesice = ?, modelka_roku = ?,
			poradi = CASE WHEN ? > 0 THEN ? ELSE poradi END WHERE klic = ?`,
			nazev, barva, strings.Join(edice, ","), strings.TrimSpace(c.ModelkaMesice), strings.TrimSpace(c.ModelkaRoku), poradi, poradi, klic)
	}
	if err != nil {
		a.chyba("uložení časopisu", err)
		return "Časopis se nepodařilo uložit."
	}
	return ""
}

// Smaže časopis, který nemá ve sbírce žádné číslo; Playboy smazat nejde. "" = smazáno.
func (a *App) SmazatCasopis(klic string) string {
	if klic == hledani.VychoziCasopis {
		return "Playboy je výchozí časopis, smazat ho nejde."
	}
	for rada := range a.pouziteRady() {
		if strings.HasPrefix(rada, klic+"/") {
			return fmt.Sprintf("Časopis %s má ve sbírce čísla, smazat ho nejde.", nazevCasopisu(a, klic))
		}
	}
	if _, err := a.db.Exec(`DELETE FROM casopisy WHERE klic = ?`, klic); err != nil {
		a.chyba("smazání časopisu", err)
		return "Časopis se nepodařilo smazat."
	}
	return ""
}

func nazevCasopisu(a *App, klic string) string {
	var nazev string
	if a.db.QueryRow(`SELECT nazev FROM casopisy WHERE klic = ?`, klic).Scan(&nazev) != nil {
		return klic
	}
	return nazev
}
