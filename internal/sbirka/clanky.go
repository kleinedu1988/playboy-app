package sbirka

import (
	"pinup-katalog/internal/hledani"
	"sort"
	"strings"
	"unicode/utf8"
)

// Nejvíce nalezených článků v rozbalovacím hledání.
const NejviceNalezu = 20

// DruhyClanku určuje povolené druhy textu článku (přepis celého textu, shrnutí, nebo neuvedeno).
var DruhyClanku = map[string]bool{"": true, "prepis": true, "shrnuti": true}

// DotazFTS převede slova hledání na dotaz FTS5.
func DotazFTS(slova []string) string {
	casti := func(slovo string) []string {
		return strings.FieldsFunc(slovo, func(r rune) bool { return (r < 'a' || r > 'z') && (r < '0' || r > '9') })
	}
	var hledat, vyloucit []string
	for _, s := range slova {
		cil := &hledat
		if strings.HasPrefix(s, "-") || strings.HasPrefix(s, "!") {
			cil = &vyloucit
		}
		for _, c := range casti(s) {
			*cil = append(*cil, `"`+c+`"*`)
		}
	}
	if len(hledat) == 0 {
		return ""
	}
	dotaz := strings.Join(hledat, " AND ")
	for _, v := range vyloucit {
		dotaz += " NOT " + v
	}
	return dotaz
}

// HledanaSlova vrátí slova hledání bez vylučovaných (pro úryvek a řazení podle názvu).
func HledanaSlova(slova []string) []string {
	vysledek := make([]string, 0, len(slova))
	for _, s := range slova {
		if !strings.HasPrefix(s, "-") && !strings.HasPrefix(s, "!") {
			vysledek = append(vysledek, s)
		}
	}
	return vysledek
}

// RozdelitSkeny rozdělí text skenů oddělených novým řádkem na seznam ID.
func RozdelitSkeny(text string) []string {
	skeny := []string{}
	for _, id := range strings.Split(text, "\n") {
		if id = strings.TrimSpace(id); id != "" {
			skeny = append(skeny, id)
		}
	}
	return skeny
}

// NacistClanky načte články podle zadané podmínky a řazení.
func NacistClanky(db Dotazovac, podminka, razeni string, hodnota any, adresaObrazku func(string) string) ([]Clanek, error) {
	clanky := []Clanek{}
	rows, err := db.Query(`SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev, COALESCE(c.autor, ''),
			COALESCE(c.modelka_id, 0), COALESCE(m.jmeno, ''), COALESCE(c.druh, ''), COALESCE(c.text, ''), COALESCE(c.skeny, '')
		FROM clanky c LEFT JOIN modelky m ON m.id = c.modelka_id
		WHERE `+podminka+` ORDER BY `+razeni, hodnota)
	if err != nil {
		return clanky, err
	}
	defer rows.Close()
	for rows.Next() {
		var c Clanek
		var skeny string
		if rows.Scan(&c.ID, &c.Vydani, &c.Strana, &c.Rubrika, &c.Nazev, &c.Autor, &c.ModelkaID, &c.JmenoModelky, &c.Druh, &c.Text, &skeny) != nil {
			continue
		}
		c.Skeny = RozdelitSkeny(skeny)
		c.SkenyURL = make([]string, len(c.Skeny))
		odkazy := make([]string, len(c.Skeny))
		for i, id := range c.Skeny {
			c.SkenyURL[i] = adresaObrazku(id)
			odkazy[i] = "https://drive.google.com/file/d/" + id + "/view"
		}
		c.SkenyOdkazy = strings.Join(odkazy, "\n")
		clanky = append(clanky, c)
	}
	return clanky, nil
}

// UkazkaTextu vytvoří úryvek textu kolem první shody některého ze slov (zjednodušených); bez shody začátek textu.
func UkazkaTextu(text string, slova []string) string {
	znaky := []rune(strings.Join(strings.Fields(text), " "))
	if len(znaky) == 0 {
		return ""
	}
	var zjednoduseny strings.Builder
	zjednoduseny.Grow(len(text))
	puvodni := make([]int, 0, len(znaky))
	for i, z := range znaky {
		if z < utf8.RuneSelf {
			c := byte(z)
			if c >= 'A' && c <= 'Z' {
				c += 'a' - 'A'
			}
			puvodni = append(puvodni, i)
			zjednoduseny.WriteByte(c)
			continue
		}
		cast := hledani.Zjednodusit(string(z))
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

// HledatClanky vyhledá v článcích přes FTS5 BM25 s doplněním záložního hledání podle jména modelky a s tolerancí překlepů.
func HledatClanky(db Dotazovac, dotaz string, chybaFn func(string, error)) []NalezClanku {
	slova := strings.Fields(hledani.Zjednodusit(dotaz))
	hledana := HledanaSlova(slova)
	if len(hledana) == 0 {
		return []NalezClanku{}
	}
	nalezy := []NalezClanku{}
	if ftsDotaz := DotazFTS(slova); ftsDotaz != "" {
		rows, err := db.Query(`
			SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev,
				COALESCE(c.autor, ''), COALESCE(m.jmeno, ''), COALESCE(c.text, '')
			FROM texty_fts f
			JOIN clanky c ON c.id = f.zdroj_id
			LEFT JOIN modelky m ON m.id = c.modelka_id
			WHERE f.druh = 'clanek' AND texty_fts MATCH ?
			ORDER BY bm25(texty_fts), c.vydani DESC
			LIMIT ?`, ftsDotaz, NejviceNalezu)
		if err != nil {
			if chybaFn != nil {
				chybaFn("hledání v článcích", err)
			}
		} else {
			for rows.Next() {
				var n NalezClanku
				var autor, text string
				if rows.Scan(&n.ID, &n.Vydani, &n.Strana, &n.Rubrika, &n.Nazev, &autor, &n.JmenoModelky, &text) == nil {
					n.Ukazka = UkazkaTextu(text, hledana)
					nalezy = append(nalezy, n)
				}
			}
			rows.Close()
		}
	}
	videne := make(map[int]bool, len(nalezy))
	for _, n := range nalezy {
		videne[n.ID] = true
	}
	for _, n := range hledatClankyZalozni(db, slova, false, chybaFn) {
		if !videne[n.ID] {
			nalezy = append(nalezy, n)
		}
	}
	if len(nalezy) == 0 {
		nalezy = hledatClankyZalozni(db, slova, true, chybaFn)
	}
	vNazvu := func(n NalezClanku) bool {
		nazev := hledani.Zjednodusit(n.Nazev)
		for _, s := range hledana {
			if !strings.Contains(nazev, s) {
				return false
			}
		}
		return true
	}
	sort.SliceStable(nalezy, func(i, j int) bool { return vNazvu(nalezy[i]) && !vNazvu(nalezy[j]) })
	if len(nalezy) > NejviceNalezu {
		nalezy = nalezy[:NejviceNalezu]
	}
	return nalezy
}

func hledatClankyZalozni(db Dotazovac, slova []string, sPreklepy bool, chybaFn func(string, error)) []NalezClanku {
	nalezy := []NalezClanku{}
	rows, err := db.Query(`SELECT c.id, c.vydani, COALESCE(c.strana, 0), COALESCE(c.rubrika, ''), c.nazev, COALESCE(c.autor, ''),
			COALESCE(m.jmeno, ''), COALESCE(c.text, '')
		FROM clanky c LEFT JOIN modelky m ON m.id = c.modelka_id`)
	if err != nil {
		if chybaFn != nil {
			chybaFn("hledání v článcích", err)
		}
		return nalezy
	}
	defer rows.Close()
	hledana := HledanaSlova(slova)
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
		nazev := hledani.Zjednodusit(n.Nazev)
		prohledat := hledani.Zjednodusit(strings.Join([]string{n.Nazev, n.Rubrika, autor, n.JmenoModelky, text}, " "))
		vNazvu, vyhovuje := true, true
		for _, slovo := range slova {
			if vylucovane := strings.TrimLeft(slovo, "-!"); vylucovane != slovo {
				if vylucovane != "" && strings.Contains(prohledat, vylucovane) {
					vyhovuje = false
					break
				}
				continue
			}
			if !strings.Contains(prohledat, slovo) && (!sPreklepy || !hledani.OdpovidaTextFuzzy(n.Nazev+" "+autor+" "+n.JmenoModelky, slovo)) {
				vyhovuje = false
				break
			}
			vNazvu = vNazvu && strings.Contains(nazev, slovo)
		}
		if !vyhovuje {
			continue
		}
		n.Ukazka = UkazkaTextu(text, hledana)
		vse = append(vse, kandidat{n, vNazvu})
	}
	sort.SliceStable(vse, func(i, j int) bool {
		if vse[i].vNazvu != vse[j].vNazvu {
			return vse[i].vNazvu
		}
		return vse[i].Vydani > vse[j].Vydani
	})
	for i, k := range vse {
		if i == NejviceNalezu {
			break
		}
		nalezy = append(nalezy, k.NalezClanku)
	}
	return nalezy
}

// HledatTexty vyhledá napříč články i popisy alb pomocí virtuální tabulky SQLite FTS5 s relevančním řazením BM25.
func HledatTexty(db Dotazovac, dotaz string, chybaFn func(string, error)) []NalezTextu {
	nalezy := []NalezTextu{}
	slova := strings.Fields(hledani.Zjednodusit(dotaz))
	if len(slova) == 0 {
		return nalezy
	}
	ftsDotaz := DotazFTS(slova)
	if ftsDotaz == "" {
		return nalezy
	}
	rows, err := db.Query(`
		SELECT f.druh, f.zdroj_id, f.vydani, f.nazev, f.rubrika, f.autor, f.modelka_id, f.text,
			bm25(texty_fts) AS rank
		FROM texty_fts f
		WHERE texty_fts MATCH ?
		ORDER BY rank, f.vydani DESC
		LIMIT ?`, ftsDotaz, NejviceNalezu)
	if err != nil {
		if chybaFn != nil {
			chybaFn("hledání v textech", err)
		}
		return nalezy
	}
	defer rows.Close()
	hledana := HledanaSlova(slova)
	for rows.Next() {
		var n NalezTextu
		var text string
		if rows.Scan(&n.Druh, &n.ZdrojID, &n.Vydani, &n.Nazev, &n.Rubrika, &n.Autor, &n.ModelkaID, &text, &n.Relevance) == nil {
			n.Ukazka = UkazkaTextu(text, hledana)
			nalezy = append(nalezy, n)
		}
	}
	return nalezy
}
