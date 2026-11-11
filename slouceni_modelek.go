package main

// Sloučení modelek s náhledem nanečisto a Vrátit (0.02.033). Samotné sloučení je SloucitModelky (alba.go); tady:
//   - NahledSlouceniModelek: co se stane, než se cokoli změní (alba, doplněné a ponechané údaje, další jméno,
//     srdíčka, porovnání, obálky, články);
//   - zachycení dotčených řádků sbírky před sloučením (modelky, alba, fotky s tagy, průvodcem a výběry, další modelky
//     alb, obálky, články) a převod porovnání, zájmu, historie srdíček a převzatých odhadů v databázi učení;
//   - VratitSlouceniModelek: obě modelky zpět přesně jako před sloučením (i s ID), pokud od sloučení u cílové
//     nepřibylo album ani fotka. Vrátit platí do zavření programu; záloha „pred-sloucenim-modelek“ zůstává.
// Nikdy automaticky: kandidáty jen hlásí Údržba (internal/kontrola/slouceni.go).

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"sync"

	"pinup-katalog/internal/hledani"
)

// Řádky jedné tabulky v pořadí sloupců
type radkyTabulky struct {
	tabulka string
	sloupce []string
	radky   [][]any
}

func zachytitRadky(tx *sql.Tx, tabulka, kde string, args ...any) (radkyTabulky, error) {
	v := radkyTabulky{tabulka: tabulka}
	rows, err := tx.Query("SELECT * FROM "+tabulka+" WHERE "+kde, args...)
	if err != nil {
		return v, err
	}
	defer rows.Close()
	if v.sloupce, err = rows.Columns(); err != nil {
		return v, err
	}
	for rows.Next() {
		radek := make([]any, len(v.sloupce))
		ukazatele := make([]any, len(radek))
		for i := range radek {
			ukazatele[i] = &radek[i]
		}
		if err := rows.Scan(ukazatele...); err != nil {
			return v, err
		}
		v.radky = append(v.radky, radek)
	}
	return v, rows.Err()
}

func (r radkyTabulky) vlozit(tx *sql.Tx, prikaz string) error {
	if len(r.radky) == 0 {
		return nil
	}
	dotaz := fmt.Sprintf("%s INTO %s (%s) VALUES (%s)", prikaz, r.tabulka, strings.Join(r.sloupce, ", "),
		strings.TrimSuffix(strings.Repeat("?, ", len(r.sloupce)), ", "))
	for _, radek := range r.radky {
		if _, err := tx.Exec(dotaz, radek...); err != nil {
			return fmt.Errorf("%s: %w", r.tabulka, err)
		}
	}
	return nil
}

// Stav sbírky a učení před sloučením
type predSloucenim struct {
	cil, zdroj int
	modelky    radkyTabulky
	tabulky    []radkyTabulky // alba, fotky, fotky_tagy, fotky_pruvodce, alba_modelky, vybery_fotky (v pořadí vložení)
	alba       map[int64]bool
	fotky      map[int64]bool
	obalky     map[string]any // vydání → původní modelka_obalky
	clanky     map[int64]any  // článek → původní modelka_id
	uceni      zmenyUceni
}

type zmenyUceni struct {
	porovnani [][3]int64   // id, původní a, b (převedená)
	smazana   radkyTabulky // porovnání cílové se zdrojovou (po sloučení by byla sama se sebou)
	zajem     []int64      // id záznamů zájmu zdrojové
	historie  []int64      // rowid historie srdíček zdrojové
	prevzate  radkyTabulky // převzatý odhad zdrojové
}

var vratitelnaSlouceni = struct {
	sync.Mutex
	podleZdroje map[int]*predSloucenim
}{podleZdroje: map[int]*predSloucenim{}}

func idSeznam(m map[int64]bool) string {
	casti := make([]string, 0, len(m))
	for id := range m {
		casti = append(casti, fmt.Sprint(id))
	}
	if len(casti) == 0 {
		return "NULL"
	}
	return strings.Join(casti, ",")
}

func jakoID(x any) int64 {
	switch v := x.(type) {
	case int64:
		return v
	case float64:
		return int64(v)
	}
	return 0
}

// Zachycení dotčených řádků sbírky v transakci sloučení (před první změnou)
func zachytitPredSloucenim(tx *sql.Tx, cil, zdroj int) (*predSloucenim, error) {
	p := &predSloucenim{cil: cil, zdroj: zdroj, alba: map[int64]bool{}, fotky: map[int64]bool{}, obalky: map[string]any{}, clanky: map[int64]any{}}
	var err error
	if p.modelky, err = zachytitRadky(tx, "modelky", "id IN (?, ?)", cil, zdroj); err != nil {
		return nil, err
	}
	alba, err := zachytitRadky(tx, "alba", "modelka_id IN (?, ?)", cil, zdroj)
	if err != nil {
		return nil, err
	}
	for _, r := range alba.radky {
		p.alba[jakoID(r[0])] = true
	}
	fotky, err := zachytitRadky(tx, "fotky", "album_id IN ("+idSeznam(p.alba)+")")
	if err != nil {
		return nil, err
	}
	for _, r := range fotky.radky {
		p.fotky[jakoID(r[0])] = true
	}
	p.tabulky = []radkyTabulky{alba, fotky}
	for _, t := range []struct{ tabulka, kde string }{
		{"fotky_tagy", "fotka_id IN (" + idSeznam(p.fotky) + ")"},
		{"fotky_pruvodce", "fotka_id IN (" + idSeznam(p.fotky) + ")"},
		{"alba_modelky", fmt.Sprintf("modelka_id IN (%d, %d) OR album_id IN (%s)", cil, zdroj, idSeznam(p.alba))},
		{"vybery_fotky", "fotografie_id IN (" + idSeznam(p.fotky) + ")"},
	} {
		r, err := zachytitRadky(tx, t.tabulka, t.kde)
		if err != nil {
			return nil, err
		}
		p.tabulky = append(p.tabulky, r)
	}
	rows, err := tx.Query("SELECT vydani, modelka_obalky FROM vydani WHERE modelka_obalky IN (?, ?)", cil, zdroj)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var v string
		var m any
		if rows.Scan(&v, &m) == nil {
			p.obalky[v] = m
		}
	}
	rows.Close()
	rows, err = tx.Query("SELECT id, modelka_id FROM clanky WHERE modelka_id IN (?, ?)", cil, zdroj)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var m any
		if rows.Scan(&id, &m) == nil {
			p.clanky[id] = m
		}
	}
	rows.Close()
	return p, nil
}

// Převod zdrojové modelky na cílovou v databázi učení (porovnání, zájem, historie srdíček, převzatý odhad)
func (a *App) prevestUceniSlouceni(p *predSloucenim) error {
	if a.uc == nil {
		return nil
	}
	a.uc.mu.Lock()
	defer a.uc.mu.Unlock()
	db := a.uc.zajistit()
	if db == nil {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	z := &p.uceni
	if z.smazana, err = zachytitRadky(tx, "porovnani", "(a = ? AND b = ?) OR (a = ? AND b = ?)", p.cil, p.zdroj, p.zdroj, p.cil); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM porovnani WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)", p.cil, p.zdroj, p.zdroj, p.cil); err != nil {
		return err
	}
	rows, err := tx.Query("SELECT id, a, b FROM porovnani WHERE a = ? OR b = ?", p.zdroj, p.zdroj)
	if err != nil {
		return err
	}
	for rows.Next() {
		var r [3]int64
		if rows.Scan(&r[0], &r[1], &r[2]) == nil {
			z.porovnani = append(z.porovnani, r)
		}
	}
	rows.Close()
	for _, r := range z.porovnani {
		na := func(x int64) int64 {
			if x == int64(p.zdroj) {
				return int64(p.cil)
			}
			return x
		}
		if _, err := tx.Exec("UPDATE porovnani SET a = ?, b = ? WHERE id = ?", na(r[1]), na(r[2]), r[0]); err != nil {
			return err
		}
	}
	for _, t := range []struct {
		dotaz string
		cil   *[]int64
	}{{"SELECT id FROM zajem WHERE modelka_id = ?", &z.zajem}, {"SELECT rowid FROM historie_srdicek WHERE modelka_id = ?", &z.historie}} {
		rows, err := tx.Query(t.dotaz, p.zdroj)
		if err != nil {
			return err
		}
		for rows.Next() {
			var id int64
			if rows.Scan(&id) == nil {
				*t.cil = append(*t.cil, id)
			}
		}
		rows.Close()
	}
	if _, err := tx.Exec("UPDATE zajem SET modelka_id = ? WHERE modelka_id = ?", p.cil, p.zdroj); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE historie_srdicek SET modelka_id = ? WHERE modelka_id = ?", p.cil, p.zdroj); err != nil {
		return err
	}
	if z.prevzate, err = zachytitRadky(tx, "prevzate_odhady", "modelka_id = ?", p.zdroj); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM prevzate_odhady WHERE modelka_id = ?", p.zdroj); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	a.uc.ob.nacteno = false
	return nil
}

func (a *App) vratitUceniSlouceni(p *predSloucenim) error {
	if a.uc == nil {
		return nil
	}
	a.uc.mu.Lock()
	defer a.uc.mu.Unlock()
	db := a.uc.zajistit()
	if db == nil {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	z := p.uceni
	for _, r := range z.porovnani {
		if _, err := tx.Exec("UPDATE porovnani SET a = ?, b = ? WHERE id = ?", r[1], r[2], r[0]); err != nil {
			return err
		}
	}
	if err := z.smazana.vlozit(tx, "INSERT OR IGNORE"); err != nil {
		return err
	}
	for _, id := range z.zajem {
		if _, err := tx.Exec("UPDATE zajem SET modelka_id = ? WHERE id = ?", p.zdroj, id); err != nil {
			return err
		}
	}
	for _, id := range z.historie {
		if _, err := tx.Exec("UPDATE historie_srdicek SET modelka_id = ? WHERE rowid = ?", p.zdroj, id); err != nil {
			return err
		}
	}
	if err := z.prevzate.vlozit(tx, "INSERT OR REPLACE"); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	a.uc.ob.nacteno = false
	return nil
}

// VratitSlouceniModelek: obě modelky zpět jako před sloučením zdroje do cíle; text chyby, prázdný při úspěchu
func (a *App) VratitSlouceniModelek(cilID, zdrojID int) string {
	vratitelnaSlouceni.Lock()
	p := vratitelnaSlouceni.podleZdroje[zdrojID]
	vratitelnaSlouceni.Unlock()
	if p == nil || p.cil != cilID {
		return "Toto sloučení už vrátit nejde (Vrátit platí do zavření programu, zůstává záloha před sloučením)."
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("vrácení sloučení modelek", err)
		return "Sloučení se nepodařilo vrátit."
	}
	defer tx.Rollback()
	// Od sloučení přibylé album nebo fotka u cílové by vrácení smazalo
	var noveAlbum, novaFotka int
	tx.QueryRow("SELECT COUNT(*) FROM alba WHERE modelka_id = ? AND id NOT IN ("+idSeznam(p.alba)+")", cilID).Scan(&noveAlbum)
	tx.QueryRow("SELECT COUNT(*) FROM fotky f JOIN alba al ON al.id = f.album_id WHERE al.modelka_id = ? AND f.id NOT IN ("+idSeznam(p.fotky)+")", cilID).Scan(&novaFotka)
	if noveAlbum > 0 || novaFotka > 0 {
		return "Od sloučení přibylo album nebo fotka – vrácení by je smazalo. Obnov zálohu před sloučením, nebo přesuň alba ručně."
	}
	selhalo := func(err error) string {
		a.chyba("vrácení sloučení modelek", err)
		return "Sloučení se nepodařilo vrátit."
	}
	for _, dotaz := range []string{
		"DELETE FROM alba WHERE modelka_id IN (?, ?)",
		"DELETE FROM alba_modelky WHERE modelka_id IN (?, ?)",
	} {
		if _, err := tx.Exec(dotaz, cilID, zdrojID); err != nil {
			return selhalo(err)
		}
	}
	if _, err := tx.Exec("DELETE FROM modelky WHERE id = ?", zdrojID); err != nil {
		return selhalo(err)
	}
	// Cílová modelka: údaje přepsat (smazání by spustilo kaskády), zdrojová znovu se svým ID
	for _, r := range p.modelky.radky {
		if jakoID(r[0]) == int64(cilID) {
			nastav := make([]string, 0, len(p.modelky.sloupce))
			for _, s := range p.modelky.sloupce {
				nastav = append(nastav, s+" = ?")
			}
			if _, err := tx.Exec("UPDATE modelky SET "+strings.Join(nastav, ", ")+" WHERE id = ?", append(append([]any{}, r...), cilID)...); err != nil {
				return selhalo(err)
			}
			// Spoušť srdíček (modelky_hodnoceni_cela) doplní poloviny i tam, kde byly prázdné; vrátit přesně
			for i, s := range p.modelky.sloupce {
				if s == "hodnoceni_pul" {
					if _, err := tx.Exec("UPDATE modelky SET hodnoceni_pul = ? WHERE id = ?", r[i], cilID); err != nil {
						return selhalo(err)
					}
				}
			}
		} else if err := (radkyTabulky{tabulka: "modelky", sloupce: p.modelky.sloupce, radky: [][]any{r}}).vlozit(tx, "INSERT"); err != nil {
			return selhalo(err)
		}
	}
	for _, t := range p.tabulky {
		if err := t.vlozit(tx, "INSERT OR IGNORE"); err != nil {
			return selhalo(err)
		}
	}
	for v, m := range p.obalky {
		if _, err := tx.Exec("UPDATE vydani SET modelka_obalky = ? WHERE vydani = ?", m, v); err != nil {
			return selhalo(err)
		}
	}
	for id, m := range p.clanky {
		if _, err := tx.Exec("UPDATE clanky SET modelka_id = ? WHERE id = ?", m, id); err != nil {
			return selhalo(err)
		}
	}
	if err := tx.Commit(); err != nil {
		return selhalo(err)
	}
	if err := a.vratitUceniSlouceni(p); err != nil {
		a.chyba("vrácení porovnání po sloučení", err)
	}
	vratitelnaSlouceni.Lock()
	delete(vratitelnaSlouceni.podleZdroje, zdrojID)
	vratitelnaSlouceni.Unlock()
	return ""
}

// ---------------------------------------------------------------------------------------------------------
// Náhled nanečisto

type AlbumSlouceni struct {
	Nazev string `json:"nazev"`
	Typ   string `json:"typ"`
	Fotek int    `json:"fotek"`
	Akce  string `json:"akce"` // „přejde“ nebo „sloučí se“ (cílová má album se stejným názvem a typem)
}

type UdajSlouceni struct {
	Pole  string `json:"pole"`
	Cil   string `json:"cil"`
	Zdroj string `json:"zdroj"`
}

type NahledSlouceni struct {
	Chyba      string          `json:"chyba"`
	Cil        string          `json:"cil"`
	Zdroj      string          `json:"zdroj"`
	Alba       []AlbumSlouceni `json:"alba"`
	Doplni     []UdajSlouceni  `json:"doplni"`  // prázdné u cílové, vezme se ze zdrojové
	Ponecha    []UdajSlouceni  `json:"ponecha"` // vyplněné u obou jinak: zůstane cílové
	DalsiJmeno string          `json:"dalsiJmeno"`
	Srdicka    string          `json:"srdicka"`
	Porovnani  int             `json:"porovnani"` // porovnání zdrojové se třetími modelkami, přejdou na cílovou
	Obalek     int             `json:"obalek"`
	Clanku     int             `json:"clanku"`
}

// Další jméno zdrojové modelky pro cílovou: s příponou časopisu, když zdrojová vyšla jen v jednom jiném časopise
// než cílová (0.02.027 „Jane Doe @PH“)
func dalsiJmenoZeSlouceni(cil, zdroj Modelka) string {
	if hledani.Zjednodusit(cil.Jmeno) == hledani.Zjednodusit(zdroj.Jmeno) {
		return ""
	}
	casopisy := func(m Modelka) map[string]bool {
		v := map[string]bool{}
		for _, c := range append(append([]string{}, m.Vydani...), m.Obalky...) {
			_, k := hledani.RozdelitCasopis(c)
			if k == "" {
				k = hledani.VychoziCasopis
			}
			v[k] = true
		}
		return v
	}
	cz, cc := casopisy(zdroj), casopisy(cil)
	if len(cz) == 1 {
		for k := range cz {
			if !cc[k] && k != hledani.VychoziCasopis {
				return zdroj.Jmeno + " @" + k
			}
		}
	}
	return zdroj.Jmeno
}

func (a *App) NahledSlouceniModelek(cilID, zdrojID int) NahledSlouceni {
	var cil, zdroj *Modelka
	for _, m := range a.vsechnyModelky() {
		m := m
		switch m.ID {
		case cilID:
			cil = &m
		case zdrojID:
			zdroj = &m
		}
	}
	if cil == nil || zdroj == nil || cilID == zdrojID {
		return NahledSlouceni{Chyba: "Vyber jinou modelku."}
	}
	v := NahledSlouceni{Cil: cil.Jmeno, Zdroj: zdroj.Jmeno, Alba: []AlbumSlouceni{}, Doplni: []UdajSlouceni{}, Ponecha: []UdajSlouceni{}}
	if rows, err := a.db.Query(`SELECT al.album, al.typ, (SELECT COUNT(*) FROM fotky f WHERE f.album_id = al.id),
		EXISTS (SELECT 1 FROM alba c WHERE c.modelka_id = ? AND c.album = al.album AND c.typ = al.typ)
		FROM alba al WHERE al.modelka_id = ? ORDER BY al.vydani, al.album`, cilID, zdrojID); err == nil {
		for rows.Next() {
			var x AlbumSlouceni
			var slouci bool
			if rows.Scan(&x.Nazev, &x.Typ, &x.Fotek, &slouci) == nil {
				x.Akce = "přejde"
				if slouci {
					x.Akce = "sloučí se"
				}
				v.Alba = append(v.Alba, x)
			}
		}
		rows.Close()
	}
	for _, p := range []struct {
		pole      string
		cil, zdro string
	}{
		{"datum narození", cil.NarozeniDatum, zdroj.NarozeniDatum}, {"datum úmrtí", cil.UmrtiDatum, zdroj.UmrtiDatum},
		{"místo narození", cil.NarozeniMisto, zdroj.NarozeniMisto}, {"národnost", cil.Narodnost, zdroj.Narodnost},
		{"etnicita", cil.Etnicita, zdroj.Etnicita}, {"vlasy", cil.VlasyBarva, zdroj.VlasyBarva}, {"oči", cil.OciBarva, zdroj.OciBarva},
		{"míry", cil.Miry, zdroj.Miry}, {"velikost prsou", cil.VelikostPrsou, zdroj.VelikostPrsou}, {"prsa", cil.PrsaTyp, zdroj.PrsaTyp},
		{"ochlupení", cil.Ochlupeni, zdroj.Ochlupeni}, {"role", cil.Role, zdroj.Role},
		{"výška", cisloNeboNic(cil.VyskaCm, " cm"), cisloNeboNic(zdroj.VyskaCm, " cm")}, {"váha", cisloNeboNic(cil.VahaKg, " kg"), cisloNeboNic(zdroj.VahaKg, " kg")},
	} {
		c, z := strings.TrimSpace(p.cil), strings.TrimSpace(p.zdro)
		switch {
		case z == "" || hledani.Zjednodusit(c) == hledani.Zjednodusit(z):
		case c == "":
			v.Doplni = append(v.Doplni, UdajSlouceni{p.pole, c, z})
		default:
			v.Ponecha = append(v.Ponecha, UdajSlouceni{p.pole, c, z})
		}
	}
	v.DalsiJmeno = dalsiJmenoZeSlouceni(*cil, *zdroj)
	switch {
	case zdroj.Hodnoceni > cil.Hodnoceni:
		v.Srdicka = fmt.Sprintf("%s (ze zdrojové, cílová má %s)", formatSrdicek(zdroj.Hodnoceni), formatSrdicek(cil.Hodnoceni))
	case cil.Hodnoceni > 0:
		v.Srdicka = formatSrdicek(cil.Hodnoceni)
	}
	if a.uc != nil {
		a.uc.mu.Lock()
		for _, p := range a.uc.nacistPorovnani() {
			// Porovnání se třetí modelkou přejdou; vzájemná (cílová se zdrojovou) se odloží do Vrátit
			if (p.a == zdrojID || p.b == zdrojID) && p.a != cilID && p.b != cilID {
				v.Porovnani++
			}
		}
		a.uc.mu.Unlock()
	}
	a.db.QueryRow("SELECT COUNT(*) FROM vydani WHERE modelka_obalky = ?", zdrojID).Scan(&v.Obalek)
	a.db.QueryRow("SELECT COUNT(*) FROM clanky WHERE modelka_id = ?", zdrojID).Scan(&v.Clanku)
	sort.SliceStable(v.Alba, func(i, j int) bool { return v.Alba[i].Akce > v.Alba[j].Akce })
	return v
}

func cisloNeboNic(x int, jednotka string) string {
	if x <= 0 {
		return ""
	}
	return fmt.Sprint(x) + jednotka
}

func formatSrdicek(h float64) string {
	return strings.Replace(fmt.Sprintf("%g", h), ".", ",", 1) + " ♥"
}
