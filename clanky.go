package main

import (
	"fmt"
	"pinup-katalog/internal/sbirka"
	"strings"
)

// Články čísla časopisu: obsah s rubrikami a stranami, text (přepis nebo shrnutí) a volitelně skeny stran.
// Úprava schématu č. 9 přidává tabulku článků; články jsou i v exportu (u vydání, klíč clanky).

type Clanek = sbirka.Clanek
type NalezClanku = sbirka.NalezClanku
type NalezTextu = sbirka.NalezTextu

var druhyClanku = sbirka.DruhyClanku

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

// Úprava schématu č. 10: virtuální tabulka SQLite FTS5 pro články a texty alb s BM25 relevancí
func (a *App) migraceFTS5() error {
	_, err := a.db.Exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS texty_fts USING fts5(
			druh,
			vydani,
			nazev,
			rubrika,
			autor,
			text,
			zdroj_id UNINDEXED,
			modelka_id UNINDEXED,
			tokenize='unicode61 remove_diacritics 2'
		);
	`)
	if err != nil {
		return err
	}

	_, err = a.db.Exec(`
		CREATE TRIGGER IF NOT EXISTS clanky_ai AFTER INSERT ON clanky BEGIN
			INSERT INTO texty_fts(druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES('clanek', new.vydani, new.nazev, COALESCE(new.rubrika, ''), COALESCE(new.autor, ''), COALESCE(new.text, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		CREATE TRIGGER IF NOT EXISTS clanky_ad AFTER DELETE ON clanky BEGIN
			DELETE FROM texty_fts WHERE druh = 'clanek' AND zdroj_id = old.id;
		END;

		CREATE TRIGGER IF NOT EXISTS clanky_au AFTER UPDATE ON clanky BEGIN
			DELETE FROM texty_fts WHERE druh = 'clanek' AND zdroj_id = old.id;
			INSERT INTO texty_fts(druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES('clanek', new.vydani, new.nazev, COALESCE(new.rubrika, ''), COALESCE(new.autor, ''), COALESCE(new.text, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		CREATE TRIGGER IF NOT EXISTS alba_popis_ai AFTER INSERT ON alba BEGIN
			INSERT INTO texty_fts(druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES('album', new.vydani, new.album, new.typ, COALESCE(new.fotograf, ''), COALESCE(new.popis, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		CREATE TRIGGER IF NOT EXISTS alba_popis_ad AFTER DELETE ON alba BEGIN
			DELETE FROM texty_fts WHERE druh = 'album' AND zdroj_id = old.id;
		END;

		CREATE TRIGGER IF NOT EXISTS alba_popis_au AFTER UPDATE ON alba BEGIN
			DELETE FROM texty_fts WHERE druh = 'album' AND zdroj_id = old.id;
			INSERT INTO texty_fts(druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES('album', new.vydani, new.album, new.typ, COALESCE(new.fotograf, ''), COALESCE(new.popis, ''), new.id, COALESCE(new.modelka_id, 0));
		END;
	`)
	if err != nil {
		return err
	}

	_, err = a.db.Exec(`
		INSERT INTO texty_fts(druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
		SELECT 'clanek', vydani, nazev, COALESCE(rubrika, ''), COALESCE(autor, ''), COALESCE(text, ''), id, COALESCE(modelka_id, 0)
		FROM clanky;

		INSERT INTO texty_fts(druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
		SELECT 'album', vydani, album, typ, COALESCE(fotograf, ''), COALESCE(popis, ''), id, COALESCE(modelka_id, 0)
		FROM alba
		WHERE (popis IS NOT NULL AND popis <> '') OR (fotograf IS NOT NULL AND fotograf <> '');
	`)
	return err
}

// Úprava schématu č. 11: index textů s klíčem v rowid (článek = id, album = −id), aby se při změně článku
// nebo alba mazal jediný řádek indexu a neprocházel celý (zdroj_id je UNINDEXED a hledání podle něj čte vše).
func (a *App) migraceFTSKlice() error {
	_, err := a.db.Exec(`
		DROP TRIGGER IF EXISTS clanky_ai;
		DROP TRIGGER IF EXISTS clanky_ad;
		DROP TRIGGER IF EXISTS clanky_au;
		DROP TRIGGER IF EXISTS alba_popis_ai;
		DROP TRIGGER IF EXISTS alba_popis_ad;
		DROP TRIGGER IF EXISTS alba_popis_au;
		DROP TABLE IF EXISTS texty_fts;

		CREATE VIRTUAL TABLE texty_fts USING fts5(
			druh UNINDEXED,
			vydani,
			nazev,
			rubrika,
			autor,
			text,
			zdroj_id UNINDEXED,
			modelka_id UNINDEXED,
			tokenize='unicode61 remove_diacritics 2'
		);

		CREATE TRIGGER clanky_ai AFTER INSERT ON clanky BEGIN
			INSERT INTO texty_fts(rowid, druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES(new.id, 'clanek', new.vydani, new.nazev, COALESCE(new.rubrika, ''), COALESCE(new.autor, ''), COALESCE(new.text, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		CREATE TRIGGER clanky_ad AFTER DELETE ON clanky BEGIN
			DELETE FROM texty_fts WHERE rowid = old.id;
		END;

		CREATE TRIGGER clanky_au AFTER UPDATE ON clanky BEGIN
			DELETE FROM texty_fts WHERE rowid = old.id;
			INSERT INTO texty_fts(rowid, druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES(new.id, 'clanek', new.vydani, new.nazev, COALESCE(new.rubrika, ''), COALESCE(new.autor, ''), COALESCE(new.text, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		CREATE TRIGGER alba_popis_ai AFTER INSERT ON alba BEGIN
			INSERT INTO texty_fts(rowid, druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES(-new.id, 'album', new.vydani, new.album, new.typ, COALESCE(new.fotograf, ''), COALESCE(new.popis, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		CREATE TRIGGER alba_popis_ad AFTER DELETE ON alba BEGIN
			DELETE FROM texty_fts WHERE rowid = -old.id;
		END;

		CREATE TRIGGER alba_popis_au AFTER UPDATE OF vydani, album, typ, fotograf, popis, modelka_id ON alba BEGIN
			DELETE FROM texty_fts WHERE rowid = -old.id;
			INSERT INTO texty_fts(rowid, druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
			VALUES(-new.id, 'album', new.vydani, new.album, new.typ, COALESCE(new.fotograf, ''), COALESCE(new.popis, ''), new.id, COALESCE(new.modelka_id, 0));
		END;

		INSERT INTO texty_fts(rowid, druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
		SELECT id, 'clanek', vydani, nazev, COALESCE(rubrika, ''), COALESCE(autor, ''), COALESCE(text, ''), id, COALESCE(modelka_id, 0)
		FROM clanky;

		INSERT INTO texty_fts(rowid, druh, vydani, nazev, rubrika, autor, text, zdroj_id, modelka_id)
		SELECT -id, 'album', vydani, album, typ, COALESCE(fotograf, ''), COALESCE(popis, ''), id, COALESCE(modelka_id, 0)
		FROM alba;
	`)
	return err
}

func dotazFTS(slova []string) string {
	return sbirka.DotazFTS(slova)
}

func hledanaSlova(slova []string) []string {
	return sbirka.HledanaSlova(slova)
}

func rozdelitSkeny(text string) []string {
	return sbirka.RozdelitSkeny(text)
}

// Články čísla podle strany (bez strany na konci), pak podle pořadí přidání
func (a *App) GetClanky(vydani string) []Clanek {
	return a.nacistClanky("načtení článků čísla", "c.vydani = ?", "COALESCE(c.strana, 0) = 0, c.strana, c.id", vydani)
}

// Články, ve kterých se modelka objevuje (rozhovor, 20 otázek…), podle vydání a strany
func (a *App) GetClankyModelky(modelkaID int) []Clanek {
	return a.nacistClanky("načtení článků modelky", "c.modelka_id = ?", "c.vydani, COALESCE(c.strana, 0) = 0, c.strana, c.id", modelkaID)
}

func (a *App) nacistClanky(kde, podminka, razeni string, hodnota interface{}) []Clanek {
	clanky, err := sbirka.NacistClanky(a.db, podminka, razeni, hodnota, adresaObrazku)
	if err != nil {
		a.chyba(kde, err)
	}
	return clanky
}

func (a *App) HledatClanky(dotaz string) []NalezClanku {
	return sbirka.HledatClanky(a.db, dotaz, a.chyba)
}

func (a *App) HledatTexty(dotaz string) []NalezTextu {
	return sbirka.HledatTexty(a.db, dotaz, a.chyba)
}

func ukazkaTextu(text string, slova []string) string {
	return sbirka.UkazkaTextu(text, slova)
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
		a.chyba("přidání článku", err)
		return 0
	}
	vysledek, err := a.db.Exec(`INSERT INTO clanky (vydani, strana, rubrika, nazev, autor, modelka_id, druh, text, skeny)
		VALUES (?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''))`,
		c.Vydani, nullPokudNula(c.Strana), c.Rubrika, c.Nazev, c.Autor, nullPokudNula(c.ModelkaID), c.Druh, c.Text, strings.Join(c.Skeny, "\n"))
	if err != nil {
		a.chyba("přidání článku", err)
		return 0
	}
	id, _ := vysledek.LastInsertId()
	return int(id)
}

func (a *App) UpdateClanek(c Clanek) bool {
	if err := a.pripravitClanek(&c); err != nil {
		a.chyba("úprava článku", err)
		return false
	}
	vysledek, err := a.db.Exec(`UPDATE clanky SET vydani = ?, strana = ?, rubrika = NULLIF(?, ''), nazev = ?, autor = NULLIF(?, ''),
			modelka_id = ?, druh = NULLIF(?, ''), text = NULLIF(?, ''), skeny = NULLIF(?, '') WHERE id = ?`,
		c.Vydani, nullPokudNula(c.Strana), c.Rubrika, c.Nazev, c.Autor, nullPokudNula(c.ModelkaID), c.Druh, c.Text, strings.Join(c.Skeny, "\n"), c.ID)
	if err != nil {
		a.chyba("úprava článku", err)
		return false
	}
	zmeneno, _ := vysledek.RowsAffected()
	return zmeneno == 1
}

func (a *App) DeleteClanek(id int) bool {
	vysledek, err := a.db.Exec("DELETE FROM clanky WHERE id = ?", id)
	if err != nil {
		a.chyba("smazání článku", err)
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
		a.chyba("export článků", err)
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
