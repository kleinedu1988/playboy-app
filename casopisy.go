package main

// Časopisy (Pinup Katalog 0.02.003, ROADMAP etapa U): tabulka `casopisy` (úprava schématu č. 17). Klíč je
// dvoupísmenná zkratka, která se píše na konec klíče čísla („1985-09@PH“, hledani.RozdelitCasopis); Playboy (PB)
// je výchozí a do klíče se nepíše. Edice = země vydání, ve kterých časopis vycházel; první je výchozí (bez přípony).
// Názvy „modelky měsíce“ a „roku“ použijí texty rozhraní od 0.04. Správa (přidat, upravit) přijde v 0.02.009.

import (
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
