package main

import (
	"context"
	"database/sql"
	"sort"
	"strings"
	"sync"
)

// Snímek sbírky: modelky a alba (s počty fotek) načtené jedním průchodem databází. Seznam modelek, Přehled,
// kontrola, návrhy i oblíbenost dřív četly tytéž tabulky každý znovu (seznam modelek osmi dotazy, alba Přehledu
// dalším průchodem všemi fotkami); teď si vezmou společný snímek.
//
// Snímek se pamatuje, dokud se databáze nezmění. Změnu pozná PRAGMA data_version na zvláštním spojení, které nikdy
// nezapisuje: hodnota se změní s každým potvrzeným zápisem jakéhokoli jiného spojení (okno, import, ruční SQL
// zvenku). Verze se čte před načtením dat, takže zápis během načítání snímek nanejvýš zbytečně zneplatní, nikdy
// nenechá platit starý. Snímek se nepamatuje u databáze v paměti (dočasná databáze po chybě startu) ani v kopii
// aplikace pro import (ta musí vidět své nepotvrzené zápisy).

// Album s počty fotek, jak ho potřebují seznam modelek, Přehled, kontrola i návrhy
type souhrnAlba struct {
	id                        int64
	modelkaID                 int // 0 = album bez modelky (cover časopisu)
	nazev, typ, vydani, datum string
	popis, fotograf, neni     string // fotograf bez úprav; neni = „netýká se“ alba
	fotek, hodnocenych, srdci int    // fotky, hodnocené fotky a součet jejich srdíček
	soucetFotek               int64  // součet čísel fotek (otisk mezipaměti učení)
	pocty                     srdickaAlba
}

// Počty hodnocených fotek alba podle srdíček: [0] = 1 srdíčko … [4] = 5 srdíček (skóre fotek v oblibenost_fotky.go)
type srdickaAlba [5]int

// Album, ve kterém modelka je (vlastní i jako další modelka), pro skóre fotek a náhledy alb v porovnání
type albumModelky struct {
	id         int64
	nazev, typ string
	fotek      int
	pocty      srdickaAlba
}

// Album modelky se vším, co potřebuje Přehled, kontrola i návrhy (fotograf oříznutý o mezery na krajích)
type albumSbirky struct {
	modelkaID               int
	jmeno                   string // jméno modelky
	nazev, typ              string
	vydani, datum, fotograf string
	popis, neni             string // neni = „netýká se“ alba
	fotek, hodnocenych      int
	soucetFotek             int64 // součet čísel fotek: změní se přidáním, přesunem i odebráním fotky
}

// Další modelka alba (alba_modelky)
type vazbaAlba struct {
	album   int64
	modelka int
}

type snimek struct {
	modelky []Modelka     // jako z nactiModelky bez hledání a oblíbenosti, seřazené podle jména
	alba    []albumSbirky // alba modelek (bez coverů) seřazená podle jména modelky, názvu a typu
	// Modelky vedené jako další u alba typu Centerfold (i bez fotek) a počet fotek coverů, pro Přehled
	sdileneCenterfoldy map[int]bool
	fotekCoveru        int
	err                error // první chyba čtení; snímek s chybou se nepamatuje
	// Alba s fotkami každé modelky (vlastní, pak ta, kde je další modelkou) a pořadí modelky v seznamu podle čísla
	albaModelek  map[int][]albumModelky
	indexModelky map[int]int

	hledani sync.Once
	texty   []textyHledani // texty modelek k hledání ve stejném pořadí jako modelky (při prvním hledání)

	// Kalendář vydání (GetKalendar) spočítaný při prvním volání nad tímto snímkem; nil = ještě není
	mu       sync.Mutex
	kalendar []VydaniKalendare
	// Náhledy fotek modelek pro porovnání (GetNahledyModelek) spočítané nad tímto snímkem
	nahledy map[int]nahledyModelky
}

// Texty modelek k hledání; spočítají se jednou pro snímek, další hledání (psaní do pole hledání) je už nepočítá
func (s *snimek) textyKHledani() []textyHledani {
	s.hledani.Do(func() {
		s.texty = make([]textyHledani, len(s.modelky))
		for i := range s.modelky {
			s.texty[i] = pripravitTexty(&s.modelky[i])
		}
	})
	return s.texty
}

// Alba všech modelek i coverů s počty fotek a další modelky alb. Počty fotek jdou po indexu fotek podle alba
// jedním průchodem (dřív se fotky procházely zvlášť pro modelky a zvlášť pro Přehled).
func (a *App) nacistSouhrnAlb() ([]souhrnAlba, []vazbaAlba, error) {
	type pocty struct {
		fotek, hodnocenych, srdci int
		soucet                    int64
		podleSrdicek              srdickaAlba
	}
	podleAlba := map[int64]pocty{}
	radky, err := a.db.Query(`SELECT album_id, COUNT(*), SUM(hodnoceni > 0), SUM(MAX(hodnoceni, 0)), SUM(id),
		SUM(hodnoceni = 1), SUM(hodnoceni = 2), SUM(hodnoceni = 3), SUM(hodnoceni = 4), SUM(hodnoceni >= 5) FROM fotky GROUP BY album_id`)
	if err != nil {
		return nil, nil, err
	}
	for radky.Next() {
		var id int64
		var p pocty
		if err := radky.Scan(&id, &p.fotek, &p.hodnocenych, &p.srdci, &p.soucet, &p.podleSrdicek[0], &p.podleSrdicek[1], &p.podleSrdicek[2],
			&p.podleSrdicek[3], &p.podleSrdicek[4]); err != nil {
			radky.Close()
			return nil, nil, err
		}
		podleAlba[id] = p
	}
	radky.Close()
	if err := radky.Err(); err != nil {
		return nil, nil, err
	}

	var alba []souhrnAlba
	radky, err = a.db.Query(`SELECT id, COALESCE(modelka_id, 0), album, typ, COALESCE(vydani, ''), COALESCE(datum, ''), COALESCE(popis, ''),
		COALESCE(fotograf, ''), COALESCE(netyka_se, '') FROM alba ORDER BY id`)
	if err != nil {
		return nil, nil, err
	}
	for radky.Next() {
		var al souhrnAlba
		if err := radky.Scan(&al.id, &al.modelkaID, &al.nazev, &al.typ, &al.vydani, &al.datum, &al.popis, &al.fotograf, &al.neni); err != nil {
			radky.Close()
			return nil, nil, err
		}
		p := podleAlba[al.id]
		al.fotek, al.hodnocenych, al.srdci, al.soucetFotek, al.pocty = p.fotek, p.hodnocenych, p.srdci, p.soucet, p.podleSrdicek
		alba = append(alba, al)
	}
	radky.Close()
	if err := radky.Err(); err != nil {
		return nil, nil, err
	}

	// V pořadí vložení, jako je dřív vracelo spojení s alby (na pořadí záleží texty alb pro hledání)
	var vazby []vazbaAlba
	radky, err = a.db.Query("SELECT album_id, modelka_id FROM alba_modelky ORDER BY rowid")
	if err != nil {
		return nil, nil, err
	}
	for radky.Next() {
		var v vazbaAlba
		if err := radky.Scan(&v.album, &v.modelka); err != nil {
			radky.Close()
			return nil, nil, err
		}
		vazby = append(vazby, v)
	}
	radky.Close()
	return alba, vazby, radky.Err()
}

// Co se o modelce odvodí z jejích alb (vlastních i těch, kde je další modelkou)
type odvozeneZAlb struct {
	fotek, hodnocenych, srdci   int
	vydani, centerfoldy, online []string
	cyberGirl                   string
	texty, fotografove          strings.Builder
	alba                        []albumModelky // alba s fotkami (skóre fotek, náhledy)
}

// Seřazený seznam bez opakování
func serazeneBezOpakovani(s []string) []string {
	sort.Strings(s)
	vysledek := s[:0]
	for i, v := range s {
		if i == 0 || v != s[i-1] {
			vysledek = append(vysledek, v)
		}
	}
	return vysledek
}

// Prázdný seznam místo nil (JSON [] místo null) a bez volné kapacity, aby přidání do kopie nepřepsalo sdílený snímek
func uzavritSeznam(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s[:len(s):len(s)]
}

// Načtení snímku z databáze (bez paměti)
func (a *App) nacistSnimek() *snimek {
	s := &snimek{sdileneCenterfoldy: map[int]bool{}, albaModelek: map[int][]albumModelky{}}
	alba, vazby, err := a.nacistSouhrnAlb()
	if err != nil {
		s.err = err
		return s
	}

	// Údaje odvozené z alb: počty fotek, vydání, centerfoldy a online alba (jen alba s fotkami), texty alb
	// k hledání (všechna alba); nejdřív vlastní alba, pak alba, kde je modelka další
	odvozene := map[int]*odvozeneZAlb{}
	pridat := func(modelka int, al *souhrnAlba) {
		o := odvozene[modelka]
		if o == nil {
			o = &odvozeneZAlb{}
			odvozene[modelka] = o
		}
		o.fotek += al.fotek
		o.hodnocenych += al.hodnocenych
		o.srdci += al.srdci
		if al.fotek > 0 {
			if al.typ != "Cover" {
				o.alba = append(o.alba, albumModelky{id: al.id, nazev: al.nazev, typ: al.typ, fotek: al.fotek, pocty: al.pocty})
			}
			if al.vydani != "" {
				o.vydani = append(o.vydani, al.vydani)
			}
			if al.typ == "Centerfold" {
				v := al.vydani
				if v == "" {
					v = al.nazev
				}
				o.centerfoldy = append(o.centerfoldy, v)
			}
			if jeOnlineTyp(al.typ) {
				o.online = append(o.online, al.datum)
				if al.typ == typCGMesice {
					o.cyberGirl = "měsíce"
				} else if al.typ == typCGTydne && o.cyberGirl == "" {
					o.cyberGirl = "týdne"
				}
			}
		}
		o.texty.WriteString(al.popis + "\n" + al.fotograf + "\n")
		o.fotografove.WriteString(al.fotograf + "\n")
	}
	podleID := make(map[int64]*souhrnAlba, len(alba))
	for i := range alba {
		al := &alba[i]
		podleID[al.id] = al
		if al.modelkaID != 0 {
			pridat(al.modelkaID, al)
		}
		if al.typ == "Cover" {
			s.fotekCoveru += al.fotek
		}
	}
	for _, v := range vazby {
		if al := podleID[v.album]; al != nil {
			pridat(v.modelka, al)
			if al.typ == "Centerfold" {
				s.sdileneCenterfoldy[v.modelka] = true
			}
		}
	}

	// Modelky z obálek vydání
	obalky := map[int][]string{}
	if radky, err := a.db.Query("SELECT modelka_obalky, vydani FROM vydani WHERE modelka_obalky IS NOT NULL ORDER BY vydani"); err == nil {
		for radky.Next() {
			var id int
			var v string
			if radky.Scan(&id, &v) == nil {
				obalky[id] = append(obalky[id], v)
			}
		}
		radky.Close()
	}

	modelky, jmena, err := a.nacistRadkyModelek(odvozene, obalky)
	s.err = err
	for id, o := range odvozene {
		if len(o.alba) > 0 {
			s.albaModelek[id] = o.alba[:len(o.alba):len(o.alba)]
		}
	}

	// Řazení podle jména bez ohledu na velikost písmen a diakritiku; klíč se spočítá pro každou modelku jednou
	klice := make(map[int]string, len(jmena))
	for id, jmeno := range jmena {
		klice[id] = zjednodusit(jmeno)
	}
	poradi, klicRadku := make([]int, len(modelky)), make([]string, len(modelky))
	for i := range poradi {
		poradi[i], klicRadku[i] = i, klice[modelky[i].ID]
	}
	sort.SliceStable(poradi, func(i, j int) bool { return klicRadku[poradi[i]] < klicRadku[poradi[j]] })
	s.modelky = make([]Modelka, len(modelky))
	s.indexModelky = make(map[int]int, len(modelky))
	for i, p := range poradi {
		s.modelky[i] = modelky[p]
		s.indexModelky[modelky[p].ID] = i
	}

	// Alba modelek (bez coverů) seřazená podle jména modelky, názvu a typu
	for _, al := range alba {
		jmeno, ok := jmena[al.modelkaID]
		if al.modelkaID == 0 || !ok {
			continue
		}
		s.alba = append(s.alba, albumSbirky{modelkaID: al.modelkaID, jmeno: jmeno, nazev: al.nazev, typ: al.typ, vydani: al.vydani,
			datum: al.datum, fotograf: strings.Trim(al.fotograf, " "), popis: al.popis, neni: al.neni, fotek: al.fotek,
			hodnocenych: al.hodnocenych, soucetFotek: al.soucetFotek})
	}
	sort.SliceStable(s.alba, func(i, j int) bool {
		x, y := &s.alba[i], &s.alba[j]
		if kx, ky := klice[x.modelkaID], klice[y.modelkaID]; kx != ky {
			return kx < ky
		}
		if x.modelkaID != y.modelkaID {
			return x.modelkaID < y.modelkaID
		}
		if x.nazev != y.nazev {
			return x.nazev < y.nazev
		}
		return x.typ < y.typ
	})
	return s
}

// Řádky tabulky modelek doplněné o údaje z alb a obálek, v pořadí tabulky. Vrací i jména všech modelek (i těch,
// jejichž řádek se nepodařilo celý přečíst; jejich alba v seznamu alb zůstávají) a první chybu.
func (a *App) nacistRadkyModelek(odvozene map[int]*odvozeneZAlb, obalky map[int][]string) ([]Modelka, map[int]string, error) {
	// Starší řádky mohou mít ve sloupcích NULL
	vyber := []string{"id", "jmeno"}
	for _, s := range sloupceModelky {
		vychozi := "''"
		if s[1] == "INTEGER" {
			vychozi = "0"
		}
		if s[0] == "tetovani" || s[0] == "piercing" {
			vychozi = "-1"
		}
		vyber = append(vyber, "COALESCE("+s[0]+", "+vychozi+")")
	}
	for _, s := range sloupceVyrezu {
		vyber = append(vyber, "COALESCE("+s[0]+", "+s[1]+")")
	}
	vyber = append(vyber, a.sloupecHodnoceni(), "COALESCE(pridano, '')", "COALESCE(netyka_se, '')")

	rows, err := a.db.Query("SELECT " + strings.Join(vyber, ", ") + " FROM modelky")
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var prvniChyba error
	var modelky []Modelka
	jmena := map[int]string{}
	for rows.Next() {
		var m Modelka
		var driveID string
		var hodnoceniPul int
		err := rows.Scan(&m.ID, &m.Jmeno,
			&m.NarozeniDatum, &m.UmrtiDatum, &m.NarozeniMisto, &m.Narodnost, &m.Etnicita,
			&m.VyskaCm, &m.VahaKg, &m.VlasyBarva, &m.OciBarva,
			&m.Miry, &m.ObvodHrudnikCm, &m.ObvodPasCm, &m.ObvodBokyCm,
			&m.VelikostPrsou, &m.PrsaTyp, &m.Ochlupeni, &m.Tetovani, &m.Piercing,
			&m.Vystoupeni, &m.PictorialVydani, &m.Role, &m.Tags, &m.DalsiJmena, &m.Poznamka, &m.Odkazy, &driveID,
			&m.CoverZoom, &m.CoverX, &m.CoverY, &hodnoceniPul, &m.Pridano, &m.NetykaSe)
		if m.ID != 0 {
			// Scan vyplní sloupce před chybným, číslo a jméno jsou první
			jmena[m.ID] = m.Jmeno
		}
		if err != nil {
			if prvniChyba == nil {
				prvniChyba = err
			}
			continue
		}
		m.Hodnoceni = float64(min(max(hodnoceniPul, 0), 10)) / 2
		if ids := parseDriveIDs(driveID); len(ids) > 0 {
			m.CoverID = ids[0]
			m.CoverURL = adresaObrazku(ids[0])
		}
		var o odvozeneZAlb
		if x := odvozene[m.ID]; x != nil {
			o.fotek, o.hodnocenych, o.srdci, o.cyberGirl = x.fotek, x.hodnocenych, x.srdci, x.cyberGirl
			o.vydani, o.centerfoldy, o.online = serazeneBezOpakovani(x.vydani), serazeneBezOpakovani(x.centerfoldy), x.online
			sort.Strings(o.online)
			m.textyAlb, m.fotografoveAlb = x.texty.String(), x.fotografove.String()
			for _, al := range x.alba {
				if al.pocty != (srdickaAlba{}) {
					m.srdickaAlb = append(m.srdickaAlb, al.pocty)
				}
			}
			m.srdickaAlb = m.srdickaAlb[:len(m.srdickaAlb):len(m.srdickaAlb)]
		}
		m.PocetFotek, m.fotekHodnocenych, m.srdciFotek = o.fotek, o.hodnocenych, o.srdci
		m.Vydani, m.Centerfoldy, m.OnlineAlba = uzavritSeznam(o.vydani), uzavritSeznam(o.centerfoldy), uzavritSeznam(o.online)
		m.Obalky = uzavritSeznam(obalky[m.ID])
		m.CyberGirl = o.cyberGirl
		modelky = append(modelky, m)
	}
	if err := rows.Err(); err != nil && prvniChyba == nil {
		prvniChyba = err
	}
	return modelky, jmena, prvniChyba
}

// Všechny modelky bez oblíbenosti (kopie) pro výpočty, které ji nepotřebují; chyba čtení se ohlásí jako u GetModelky
func (a *App) vsechnyModelky() []Modelka {
	modelky, err := a.nactiModelky("", false)
	if err != nil {
		a.chyba("načtení modelek", err)
	}
	return modelky
}

// Modelky (bez oblíbenosti) a alba z jednoho snímku sbírky pro Přehled a Údržbu; kopie, které volající smí měnit.
// Chyba čtení se ohlásí jako u GetModelky.
func (a *App) modelkyAAlba() ([]Modelka, []albumSbirky, *snimek) {
	s := a.snimekSbirky()
	if s.err != nil {
		a.chyba("načtení modelek", s.err)
	}
	return append([]Modelka(nil), s.modelky...), append([]albumSbirky{}, s.alba...), s
}

// Paměť posledního snímku; sdílí ji i kopie aplikace pro export
type pametSbirky struct {
	mu      sync.Mutex
	db      *sql.DB   // spojení aplikace, ke kterému snímek patří
	hlidac  *sql.DB   // zvláštní spojení, které jen čte PRAGMA data_version
	spojeni *sql.Conn // jeho jediné spojení (data_version se dá porovnávat jen na stejném spojení)
	verze   int64
	sablona string // šablona adres obrázků, ze které jsou adresy titulních fotek ve snímku
	snimek  *snimek
	konec   bool // program končí: hlídací spojení se už neotevře
}

// Zavření hlídacího spojení a zapomenutí snímku; volá se se zámkem
func (p *pametSbirky) zavritZamcene() {
	if p.spojeni != nil {
		p.spojeni.Close()
	}
	if p.hlidac != nil {
		p.hlidac.Close()
	}
	p.db, p.hlidac, p.spojeni, p.snimek = nil, nil, nil, nil
}

// Zavření před zavřením nebo výměnou databáze (obnovení ze zálohy, jen pro čtení); navždy = konec programu
func (a *App) zavritPametSbirky(navzdy bool) {
	if p := a.pamet; p != nil {
		p.mu.Lock()
		p.zavritZamcene()
		p.konec = p.konec || navzdy
		p.mu.Unlock()
	}
}

// Snímek sbírky pro čtení; z paměti, když se databáze od posledního načtení nezměnila. Snímek se nesmí měnit
// (sdílí ho souběžná volání); kdo potřebuje modelky nebo alba upravit, vezme si kopii.
func (a *App) snimekSbirky() *snimek {
	if s := a.snimekVPameti(); s != nil {
		return s
	}
	return a.nacistSnimek()
}

// Snímek z paměti (zastaralý se načte znovu); nil, když se snímek pamatovat nedá. Co se ze snímku spočítá
// později (kalendář), může být novější než verze snímku, nikdy starší: další volání pozná novou verzi a vezme
// nový snímek.
func (a *App) snimekVPameti() *snimek {
	p := a.pamet
	if p == nil || a.cestaDb == "" || a.vImportu {
		return nil
	}
	// Souběžná volání (Přehled volá několik metod najednou) počkají na první načtení a vezmou si jeho snímek
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.konec {
		return nil
	}
	if p.db != a.db {
		p.zavritZamcene()
		p.db = a.db
	}
	if p.spojeni == nil {
		hlidac, err := sql.Open("sqlite", a.cestaDb+"?_pragma=busy_timeout(5000)")
		if err != nil {
			return nil
		}
		spojeni, err := hlidac.Conn(context.Background())
		if err != nil {
			hlidac.Close()
			return nil
		}
		p.hlidac, p.spojeni = hlidac, spojeni
	}
	var verze int64
	if err := p.spojeni.QueryRowContext(context.Background(), "PRAGMA data_version").Scan(&verze); err != nil {
		// Bez spolehlivé verze se snímek nepamatuje; příště se spojení otevře znovu
		db := p.db
		p.zavritZamcene()
		p.db = db
		return nil
	}
	sablona, _ := sablonaObrazku.Load().(string)
	if p.snimek != nil && p.verze == verze && p.sablona == sablona {
		return p.snimek
	}
	s := a.nacistSnimek()
	p.snimek = nil
	if s.err == nil {
		p.snimek, p.verze, p.sablona = s, verze, sablona
	}
	return s
}
