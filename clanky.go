package main

import (
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"
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
	return a.nacistClanky("GetClanky", "c.vydani = ?", "COALESCE(c.strana, 0) = 0, c.strana, c.id", vydani)
}

// Články, ve kterých se modelka objevuje (rozhovor, 20 otázek…), podle vydání a strany
func (a *App) GetClankyModelky(modelkaID int) []Clanek {
	return a.nacistClanky("GetClankyModelky", "c.modelka_id = ?", "c.vydani, COALESCE(c.strana, 0) = 0, c.strana, c.id", modelkaID)
}

func (a *App) nacistClanky(kde, podminka, razeni string, hodnota interface{}) []Clanek {
	clanky := []Clanek{}
	rows, err := a.db.Query(`SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev, COALESCE(c.autor, ''),
			COALESCE(c.modelka_id, 0), COALESCE(m.jmeno, ''), COALESCE(c.druh, ''), COALESCE(c.text, ''), COALESCE(c.skeny, '')
		FROM clanky c LEFT JOIN modelky m ON m.id = c.modelka_id
		WHERE `+podminka+` ORDER BY `+razeni, hodnota)
	if err != nil {
		a.chyba(kde, err)
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

// Článek nalezený hledáním: kde je a úryvek textu kolem první shody
type NalezClanku struct {
	ID           int    `json:"id"`
	Vydani       string `json:"vydani"`
	Strana       int    `json:"strana"`
	Rubrika      string `json:"rubrika"`
	Nazev        string `json:"nazev"`
	JmenoModelky string `json:"jmenoModelky"`
	Ukazka       string `json:"ukazka"`
}

// Výsledek full-textového hledání napříč články i popisy alb s BM25 relevancí
type NalezTextu struct {
	Druh      string  `json:"druh"`      // "clanek" nebo "album"
	ZdrojID   int     `json:"zdrojId"`   // id článku nebo alba
	Vydani    string  `json:"vydani"`    // vydání (např. 1975-05)
	Nazev     string  `json:"nazev"`     // název článku nebo alba
	Rubrika   string  `json:"rubrika"`   // rubrika článku nebo typ alba
	Autor     string  `json:"autor"`     // autor článku nebo fotograf
	ModelkaID int     `json:"modelkaId"` // id modelky
	Ukazka    string  `json:"ukazka"`    // úryvek textu s kontextem
	Relevance float64 `json:"relevance"` // BM25 skóre relevance
}

// Nejvíce nalezených článků v rozbalovacím hledání
const nejviceNalezu = 20

// Hledání v článcích: využívá SQLite FTS5 s relevančním řazením BM25 a tolerancí diakritiky;
// při absenci shody v FTS5 použije záložní prohledání (např. překlepy či shodu ve jménu modelky).
func (a *App) HledatClanky(dotaz string) []NalezClanku {
	slova := strings.Fields(zjednodusit(dotaz))
	if len(slova) == 0 {
		return []NalezClanku{}
	}

	var ftsTermy []string
	for _, s := range slova {
		ciste := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				return r
			}
			return -1
		}, s)
		if ciste != "" {
			ftsTermy = append(ftsTermy, `"`+ciste+`"*`)
		}
	}

	if len(ftsTermy) > 0 {
		ftsDotaz := strings.Join(ftsTermy, " AND ")
		rows, err := a.db.Query(`
			SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev,
				COALESCE(c.autor, ''), COALESCE(m.jmeno, ''), COALESCE(c.text, '')
			FROM texty_fts f
			JOIN clanky c ON c.id = f.zdroj_id
			LEFT JOIN modelky m ON m.id = c.modelka_id
			WHERE f.druh = 'clanek' AND texty_fts MATCH ?
			ORDER BY (CASE WHEN LOWER(c.nazev) LIKE '%' || ? || '%' THEN 0 ELSE 1 END), bm25(texty_fts), c.vydani DESC
			LIMIT ?`, ftsDotaz, slova[0], nejviceNalezu)
		if err == nil {
			defer rows.Close()
			nalezy := []NalezClanku{}
			for rows.Next() {
				var n NalezClanku
				var autor, text string
				if rows.Scan(&n.ID, &n.Vydani, &n.Strana, &n.Rubrika, &n.Nazev, &autor, &n.JmenoModelky, &text) == nil {
					n.Ukazka = ukazkaTextu(text, slova)
					nalezy = append(nalezy, n)
				}
			}
			if len(nalezy) > 0 {
				return nalezy
			}
		}
	}

	return a.hledatClankyZalozni(slova)
}

func (a *App) hledatClankyZalozni(slova []string) []NalezClanku {
	nalezy := []NalezClanku{}
	rows, err := a.db.Query(`SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev, COALESCE(c.autor, ''),
			COALESCE(m.jmeno, ''), COALESCE(c.text, '')
		FROM clanky c LEFT JOIN modelky m ON m.id = c.modelka_id`)
	if err != nil {
		a.chyba("HledatClankyZalozni", err)
		return nalezy
	}
	defer rows.Close()
	type kandidat struct {
		NalezClanku
		vNazvu bool
	}
	var vse []kandidat
	for rows.Next() {
		var n NalezClanku
		var autor, text string
		if rows.Scan(&n.ID, &n.Vydani, &n.Strana, &n.Rubrika, &n.Nazev, &autor, &n.JmenoModelky, &text) != nil {
			continue
		}
		nazev := zjednodusit(n.Nazev)
		prohledat := zjednodusit(strings.Join([]string{n.Nazev, n.Rubrika, autor, n.JmenoModelky, text}, " "))
		vNazvu, vyhovuje := true, true
		for _, slovo := range slova {
			if !strings.Contains(prohledat, slovo) && !odpovidaTextFuzzy(n.Nazev+" "+autor+" "+n.JmenoModelky, slovo) {
				vyhovuje = false
				break
			}
			vNazvu = vNazvu && strings.Contains(nazev, slovo)
		}
		if !vyhovuje {
			continue
		}
		n.Ukazka = ukazkaTextu(text, slova)
		vse = append(vse, kandidat{n, vNazvu})
	}
	sort.SliceStable(vse, func(i, j int) bool {
		if vse[i].vNazvu != vse[j].vNazvu {
			return vse[i].vNazvu
		}
		return vse[i].Vydani > vse[j].Vydani
	})
	for i, k := range vse {
		if i == nejviceNalezu {
			break
		}
		nalezy = append(nalezy, k.NalezClanku)
	}
	return nalezy
}

// Bleskové vyhledávání napříč články i popisy alb pomocí virtuální tabulky SQLite FTS5 s relevančním řazením BM25
func (a *App) HledatTexty(dotaz string) []NalezTextu {
	nalezy := []NalezTextu{}
	slova := strings.Fields(zjednodusit(dotaz))
	if len(slova) == 0 {
		return nalezy
	}
	var ftsTermy []string
	for _, s := range slova {
		ciste := strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				return r
			}
			return -1
		}, s)
		if ciste != "" {
			ftsTermy = append(ftsTermy, `"`+ciste+`"*`)
		}
	}
	if len(ftsTermy) == 0 {
		return nalezy
	}
	ftsDotaz := strings.Join(ftsTermy, " AND ")
	rows, err := a.db.Query(`
		SELECT f.druh, f.zdroj_id, f.vydani, f.nazev, f.rubrika, f.autor, f.modelka_id, f.text,
			bm25(texty_fts) AS rank
		FROM texty_fts f
		WHERE texty_fts MATCH ?
		ORDER BY rank, f.vydani DESC
		LIMIT ?`, ftsDotaz, nejviceNalezu)
	if err != nil {
		a.chyba("HledatTexty", err)
		return nalezy
	}
	defer rows.Close()
	for rows.Next() {
		var n NalezTextu
		var text string
		if rows.Scan(&n.Druh, &n.ZdrojID, &n.Vydani, &n.Nazev, &n.Rubrika, &n.Autor, &n.ModelkaID, &text, &n.Relevance) == nil {
			n.Ukazka = ukazkaTextu(text, slova)
			nalezy = append(nalezy, n)
		}
	}
	return nalezy
}

// Úryvek textu kolem první shody některého ze slov (zjednodušených); bez shody začátek textu
func ukazkaTextu(text string, slova []string) string {
	znaky := []rune(strings.Join(strings.Fields(text), " "))
	if len(znaky) == 0 {
		return ""
	}
	// Zjednodušený text po znacích, aby se pozice shody dala převést zpět na původní znak
	var zjednoduseny strings.Builder
	puvodni := []int{}
	for i, z := range znaky {
		cast := zjednodusit(string(z))
		for range cast {
			puvodni = append(puvodni, i)
		}
		zjednoduseny.WriteString(cast)
	}
	hledat := zjednoduseny.String()
	shoda := -1
	for _, slovo := range slova {
		if bajt := strings.Index(hledat, slovo); bajt >= 0 {
			if poz := puvodni[utf8.RuneCountInString(hledat[:bajt])]; shoda < 0 || poz < shoda {
				shoda = poz
			}
		}
	}
	if shoda < 0 {
		shoda = 0
	}
	const pred, za = 50, 110
	od, do := 0, len(znaky)
	if shoda > pred {
		od = shoda - pred
	}
	if od+pred+za < do {
		do = od + pred + za
	}
	// Úryvek začíná a končí celým slovem
	if od > 0 {
		for od < shoda && znaky[od-1] != ' ' {
			od++
		}
	}
	if do < len(znaky) {
		for do > shoda+1 && znaky[do] != ' ' {
			do--
		}
	}
	ukazka := strings.TrimSpace(string(znaky[od:do]))
	if od > 0 {
		ukazka = "…" + ukazka
	}
	if do < len(znaky) {
		ukazka += "…"
	}
	return ukazka
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
