package main

import (
	"fmt"
	"strings"
)

// Články čísla časopisu: obsah s rubrikami a stranami, text (přepis nebo shrnutí) a volitelně skeny stran.
// Úprava schématu č. 9 přidává tabulku článků; články jsou i v exportu (u vydání, klíč clanky).

func (a *App) migraceClanky() error {
	_, err := a.db.Exec(`CREATE TABLE IF NOT EXISTS clanky (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		vydani TEXT NOT NULL,
		strana INTEGER,
		rubrika TEXT,
		nazev TEXT NOT NULL,
		autor TEXT,
		modelka_id INTEGER REFERENCES modelky(id) ON DELETE SET NULL,
		druh TEXT,
		text TEXT,
		skeny TEXT
	)`)
	if err == nil {
		_, err = a.db.Exec("CREATE INDEX IF NOT EXISTS idx_clanky_vydani ON clanky(vydani)")
	}
	return err
}

// Druh textu článku: přepis celého textu, nebo jen shrnutí; prázdný = neuvedeno
var druhyClanku = map[string]bool{"": true, "prepis": true, "shrnuti": true}

type Clanek struct {
	ID           int    `json:"id"`
	Vydani       string `json:"vydani"`
	Strana       int    `json:"strana"` // 0 = neuvedena
	Rubrika      string `json:"rubrika"`
	Nazev        string `json:"nazev"`
	Autor        string `json:"autor"`
	ModelkaID    int    `json:"modelkaId"` // 0 = žádná
	JmenoModelky string `json:"jmenoModelky"`
	Druh         string `json:"druh"`
	Text         string `json:"text"`
	// Skeny stran: id souborů na Disku a adresy obrázků (šablona s {velikost})
	Skeny    []string `json:"skeny"`
	SkenyURL []string `json:"skenyUrl"`
	// Odkazy na skeny, jak je uživatel napsal; při uložení se z nich vezmou id (prázdné = beze skenů)
	SkenyOdkazy string `json:"skenyOdkazy"`
}

func rozdelitSkeny(text string) []string {
	skeny := []string{}
	for _, id := range strings.Split(text, "\n") {
		if id = strings.TrimSpace(id); id != "" {
			skeny = append(skeny, id)
		}
	}
	return skeny
}

// Články čísla podle strany (bez strany na konci), pak podle pořadí přidání
func (a *App) GetClanky(vydani string) []Clanek {
	clanky := []Clanek{}
	rows, err := a.db.Query(`SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev, COALESCE(c.autor, ''),
			COALESCE(c.modelka_id, 0), COALESCE(m.jmeno, ''), COALESCE(c.druh, ''), COALESCE(c.text, ''), COALESCE(c.skeny, '')
		FROM clanky c LEFT JOIN modelky m ON m.id = c.modelka_id
		WHERE c.vydani = ? ORDER BY COALESCE(c.strana, 0) = 0, c.strana, c.id`, vydani)
	if err != nil {
		a.chyba("GetClanky", err)
		return clanky
	}
	defer rows.Close()
	for rows.Next() {
		var c Clanek
		var skeny string
		if rows.Scan(&c.ID, &c.Vydani, &c.Strana, &c.Rubrika, &c.Nazev, &c.Autor, &c.ModelkaID, &c.JmenoModelky, &c.Druh, &c.Text, &skeny) != nil {
			continue
		}
		c.Skeny = rozdelitSkeny(skeny)
		c.SkenyURL = make([]string, len(c.Skeny))
		odkazy := make([]string, len(c.Skeny))
		for i, id := range c.Skeny {
			c.SkenyURL[i] = adresaObrazku(id)
			odkazy[i] = "https://drive.google.com/file/d/" + id + "/view"
		}
		c.SkenyOdkazy = strings.Join(odkazy, "\n")
		clanky = append(clanky, c)
	}
	return clanky
}

// Kontrola a úprava článku před zápisem
func (a *App) pripravitClanek(c *Clanek) error {
	c.Vydani, c.Nazev = strings.TrimSpace(c.Vydani), strings.TrimSpace(c.Nazev)
	c.Rubrika, c.Autor, c.Text = strings.TrimSpace(c.Rubrika), strings.TrimSpace(c.Autor), strings.TrimSpace(c.Text)
	if !vzorVydaniAlba.MatchString(c.Vydani) {
		return fmt.Errorf("neplatné vydání „%s“", c.Vydani)
	}
	if c.Nazev == "" {
		return fmt.Errorf("článek musí mít název")
	}
	if !druhyClanku[c.Druh] {
		return fmt.Errorf("neznámý druh textu „%s“", c.Druh)
	}
	if c.Strana < 0 {
		c.Strana = 0
	}
	if c.ModelkaID != 0 && a.jmenoModelky(c.ModelkaID) == "" {
		c.ModelkaID = 0
	}
	c.Skeny = parseDriveIDs(c.SkenyOdkazy)
	return nil
}

func nullPokudNula(n int) interface{} {
	if n == 0 {
		return nil
	}
	return n
}

// Nový článek; vrací jeho id (0 = nepovedlo se)
func (a *App) AddClanek(c Clanek) int {
	if err := a.pripravitClanek(&c); err != nil {
		a.chyba("AddClanek", err)
		return 0
	}
	vysledek, err := a.db.Exec(`INSERT INTO clanky (vydani, strana, rubrika, nazev, autor, modelka_id, druh, text, skeny)
		VALUES (?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''))`,
		c.Vydani, nullPokudNula(c.Strana), c.Rubrika, c.Nazev, c.Autor, nullPokudNula(c.ModelkaID), c.Druh, c.Text, strings.Join(c.Skeny, "\n"))
	if err != nil {
		a.chyba("AddClanek", err)
		return 0
	}
	id, _ := vysledek.LastInsertId()
	return int(id)
}

func (a *App) UpdateClanek(c Clanek) bool {
	if err := a.pripravitClanek(&c); err != nil {
		a.chyba("UpdateClanek", err)
		return false
	}
	vysledek, err := a.db.Exec(`UPDATE clanky SET vydani = ?, strana = ?, rubrika = NULLIF(?, ''), nazev = ?, autor = NULLIF(?, ''),
			modelka_id = ?, druh = NULLIF(?, ''), text = NULLIF(?, ''), skeny = NULLIF(?, '') WHERE id = ?`,
		c.Vydani, nullPokudNula(c.Strana), c.Rubrika, c.Nazev, c.Autor, nullPokudNula(c.ModelkaID), c.Druh, c.Text, strings.Join(c.Skeny, "\n"), c.ID)
	if err != nil {
		a.chyba("UpdateClanek", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

func (a *App) DeleteClanek(id int) bool {
	vysledek, err := a.db.Exec("DELETE FROM clanky WHERE id = ?", id)
	if err != nil {
		a.chyba("DeleteClanek", err)
		return false
	}
	smazano, _ := vysledek.RowsAffected()
	return smazano == 1
}

// Článek v souboru exportu (u vydání, klíč clanky); modelka je odkaz na modelku jako jinde v exportu
type exportClanek struct {
	Strana  int      `yaml:"strana,omitempty"`
	Rubrika string   `yaml:"rubrika,omitempty"`
	Nazev   string   `yaml:"nazev"`
	Autor   string   `yaml:"autor,omitempty"`
	Modelka string   `yaml:"modelka,omitempty"`
	Druh    string   `yaml:"druh,omitempty"`
	Text    string   `yaml:"text,omitempty"`
	Skeny   []string `yaml:"skeny,omitempty"`
}

// Vydání, ke kterým jsou články, a jejich články pro export
func (a *App) exportovatClanky(odkazy odkazyNaModelky) map[string][]exportClanek {
	podleVydani := map[string][]exportClanek{}
	rows, err := a.db.Query("SELECT DISTINCT vydani FROM clanky ORDER BY vydani")
	if err != nil {
		a.chyba("exportovatClanky", err)
		return podleVydani
	}
	var vydani []string
	for rows.Next() {
		var v string
		if rows.Scan(&v) == nil {
			vydani = append(vydani, v)
		}
	}
	rows.Close()
	for _, v := range vydani {
		for _, c := range a.GetClanky(v) {
			modelka := ""
			if c.ModelkaID != 0 {
				modelka = odkazy.odkaz(c.ModelkaID, c.JmenoModelky)
			}
			podleVydani[v] = append(podleVydani[v], exportClanek{Strana: c.Strana, Rubrika: c.Rubrika, Nazev: c.Nazev, Autor: c.Autor,
				Modelka: modelka, Druh: c.Druh, Text: c.Text, Skeny: c.Skeny})
		}
	}
	return podleVydani
}

// Import článků vydání: článek se stejným názvem v čísle se doplní a opraví, jinak přibude nový.
// Prázdný údaj ponechá stávající, pomlčka ho smaže (jako jinde v importu).
func (a *App) importovatClanky(vydani string, clanky []exportClanek, idModelky func(string) int, vysledek *VysledekImportu) {
	stavajici := map[string]Clanek{}
	for _, c := range a.GetClanky(vydani) {
		stavajici[zjednodusit(c.Nazev)] = c
	}
	for _, e := range clanky {
		if strings.TrimSpace(e.Nazev) == "" {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("vydání „%s“: článek bez názvu byl přeskočen", vydani))
			continue
		}
		c, existuje := stavajici[zjednodusit(e.Nazev)]
		if !existuje {
			c = Clanek{Vydani: vydani, Nazev: strings.TrimSpace(e.Nazev)}
		}
		if e.Strana != 0 {
			c.Strana = e.Strana
		}
		c.Rubrika = hodnotaZImportu(e.Rubrika, c.Rubrika)
		c.Autor = hodnotaZImportu(e.Autor, c.Autor)
		c.Text = hodnotaZImportu(e.Text, c.Text)
		druh := hodnotaZImportu(e.Druh, c.Druh)
		switch zjednodusit(druh) {
		case "prepis":
			druh = "prepis"
		case "shrnuti":
			druh = "shrnuti"
		}
		c.Druh = druh
		switch strings.TrimSpace(e.Modelka) {
		case "":
		case smazatUdaj:
			c.ModelkaID = 0
		default:
			if id := idModelky(e.Modelka); id != 0 {
				c.ModelkaID = id
			} else {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("článek „%s“: modelka „%s“ ve sbírce není", e.Nazev, e.Modelka))
			}
		}
		if len(e.Skeny) > 0 {
			c.SkenyOdkazy = strings.Join(e.Skeny, "\n")
		} else {
			c.SkenyOdkazy = strings.Join(c.Skeny, "\n")
		}
		uspech := false
		if existuje {
			uspech = a.UpdateClanek(c)
		} else {
			uspech = a.AddClanek(c) != 0
		}
		if !uspech {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("vydání „%s“: článek „%s“ se nepodařilo uložit (neplatné vydání nebo druh)", vydani, e.Nazev))
		}
	}
}
