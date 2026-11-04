package main

import (
	"context"
	"database/sql"
	"maps"
	"regexp"
	"runtime"
	"slices"
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

// Album, ve kterém modelka je (vlastní i jako další modelka), pro skóre fotek a náhledy alb v porovnání
type albumModelky struct {
	id         int64
	nazev, typ string
	fotek      int
	pocty      srdickaAlba
}

// Album modelky se vším, co potřebuje Přehled, kontrola i návrhy (fotograf oříznutý o mezery na krajích)
type albumSbirky struct {
	id                      int64
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

	// Texty k hledání, kalendář vydání (GetKalendar) a náhledy modelek (GetNahledyModelek) spočítané při prvním volání nad tímto snímkem
	mu       sync.Mutex
	texty    []textyHledani
	kalendar []VydaniKalendare
	nahledy  map[int]nahledyModelky
}

// Texty modelek k hledání; spočítají se jednou pro snímek, další hledání (psaní do pole hledání) je už nepočítá
func (s *snimek) textyKHledani() []textyHledani {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.texty == nil {
		texty := make([]textyHledani, len(s.modelky))
		for i := range s.modelky {
			texty[i] = pripravitTexty(&s.modelky[i])
		}
		s.texty = texty
	}
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
	// Počty fotek po albech: dotaz přes všechny fotky (u 150 000 fotek ~0,2 s) se rozdělí podle rozsahů čísel alb
	// mezi jádra – každá část jde vlastním spojením (čtení se ve WAL neblokují)
	var odAlba, doAlba sql.NullInt64
	if err := a.db.QueryRow(`SELECT MIN(album_id), MAX(album_id) FROM fotky`).Scan(&odAlba, &doAlba); err != nil {
		return nil, nil, err
	}
	casti := 1
	if doAlba.Int64-odAlba.Int64 > 1000 {
		casti = min(runtime.NumCPU(), 4)
	}
	krok := (doAlba.Int64-odAlba.Int64)/int64(casti) + 1
	vysledky := make([]map[int64]pocty, casti)
	chyby := make([]error, casti)
	var cekani sync.WaitGroup
	for c := range casti {
		cekani.Add(1)
		go func() {
			defer cekani.Done()
			v := map[int64]pocty{}
			vysledky[c] = v
			radky, err := a.db.Query(`SELECT album_id, COUNT(*), SUM(hodnoceni > 0), SUM(MAX(hodnoceni, 0)), SUM(id),
				SUM(hodnoceni = 1), SUM(hodnoceni = 2), SUM(hodnoceni = 3), SUM(hodnoceni = 4), SUM(hodnoceni >= 5) FROM fotky
				WHERE album_id BETWEEN ? AND ? GROUP BY album_id`, odAlba.Int64+int64(c)*krok, odAlba.Int64+int64(c+1)*krok-1)
			if err != nil {
				chyby[c] = err
				return
			}
			defer radky.Close()
			for radky.Next() {
				var id int64
				var p pocty
				if err := radky.Scan(&id, &p.fotek, &p.hodnocenych, &p.srdci, &p.soucet, &p.podleSrdicek[0], &p.podleSrdicek[1], &p.podleSrdicek[2],
					&p.podleSrdicek[3], &p.podleSrdicek[4]); err != nil {
					chyby[c] = err
					return
				}
				v[id] = p
			}
			chyby[c] = radky.Err()
		}()
	}
	cekani.Wait()
	podleAlba := map[int64]pocty{}
	for c := range casti {
		if chyby[c] != nil {
			return nil, nil, chyby[c]
		}
		maps.Copy(podleAlba, vysledky[c])
	}

	var alba []souhrnAlba
	radky, err := a.db.Query(`SELECT id, COALESCE(modelka_id, 0), album, typ, COALESCE(vydani, ''), COALESCE(datum, ''), COALESCE(popis, ''),
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

// Rok (1950–2099) ve vydání nebo názvu alba
var vzorRokuAlba = regexp.MustCompile(`\b(19[5-9]\d|20\d{2})\b`)

// Co se o modelce odvodí z jejích alb (vlastních i těch, kde je další modelkou)
type odvozeneZAlb struct {
	fotek, hodnocenych, srdci   int
	vydani, centerfoldy, online []string
	cyberGirl                   string
	playmateMesice              bool
	playmateRoku                string
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
			switch al.typ {
			case typPMMesice:
				o.playmateMesice = true
			case typPMRoku:
				// Rok čísla s pictorialem, jinak rok z názvu alba („Playmate of the Year 1998“)
				rok := vzorRokuAlba.FindString(al.vydani)
				if rok == "" {
					rok = vzorRokuAlba.FindString(al.nazev)
				}
				if rok == "" {
					rok = "?"
				}
				if o.playmateRoku == "" || o.playmateRoku == "?" {
					o.playmateRoku = rok
				}
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
		s.alba = append(s.alba, albumSbirky{id: al.id, modelkaID: al.modelkaID, jmeno: jmeno, nazev: al.nazev, typ: al.typ, vydani: al.vydani,
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
			o.playmateMesice, o.playmateRoku = x.playmateMesice, x.playmateRoku
			o.vydani, o.centerfoldy, o.online = serazeneBezOpakovani(x.vydani), serazeneBezOpakovani(x.centerfoldy), x.online
			sort.Strings(o.online)
			m.TextyAlb, m.FotografoveAlb = x.texty.String(), x.fotografove.String()
			for _, al := range x.alba {
				if al.pocty != (srdickaAlba{}) {
					m.SrdickaAlb = append(m.SrdickaAlb, al.pocty)
				}
			}
			m.SrdickaAlb = m.SrdickaAlb[:len(m.SrdickaAlb):len(m.SrdickaAlb)]
		}
		m.PocetFotek, m.FotekHodnocenych, m.SrdciFotek = o.fotek, o.hodnocenych, o.srdci
		m.Vydani, m.Centerfoldy, m.OnlineAlba = uzavritSeznam(o.vydani), uzavritSeznam(o.centerfoldy), uzavritSeznam(o.online)
		m.Obalky = uzavritSeznam(obalky[m.ID])
		m.CyberGirl = o.cyberGirl
		m.PlaymateMesice, m.PlaymateRoku = o.playmateMesice, o.playmateRoku
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

// Při úpravě výřezu titulní fotky se změní jen 3 čísla jedné modelky; aktualizují se přímo v zapamatovaném snímku,
// aby se nemusely znovu načítat všechny fotky, alba, vydání a modelky z databáze ani zahazovat vyhledávací texty
func (a *App) aktualizovatVyrezVeSnimku(id int, zoom, x, y float64) {
	p := a.pamet
	if p == nil || a.cestaDb == "" || a.vImportu {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.snimek == nil || p.spojeni == nil || p.db != a.db {
		return
	}
	idx, ok := p.snimek.indexModelky[id]
	if !ok || idx < 0 || idx >= len(p.snimek.modelky) {
		return
	}
	var verze int64
	if err := p.spojeni.QueryRowContext(context.Background(), "PRAGMA data_version").Scan(&verze); err != nil {
		return
	}
	// Nový snímek s kopií modelek (souběžná čtení drží starý snímek a nesmí vidět zápis uprostřed kopírování);
	// texty hledání, kalendář a náhledy na výřezu titulní fotky nezávisí a zůstanou zachované
	stary := p.snimek
	novy := kopieSnimku(stary)
	novy.modelky = slices.Clone(stary.modelky)
	novy.modelky[idx].CoverZoom = zoom
	novy.modelky[idx].CoverX = x
	novy.modelky[idx].CoverY = y
	p.snimek = novy
	p.verze = verze
}

// ——— Oprava snímku na místě po srdíčku ———
// Srdíčko u fotky nebo modelky mění jen pár čísel; místo nového načtení celého snímku (u 150 000 fotek ~0,25 s
// po každém srdíčku) se opraví zapamatovaný snímek: nový snímek s kopiemi dotčených částí (souběžná čtení drží
// starý a nesmí vidět zápis uprostřed). Oprava se dělá, jen když snímek před zápisem odpovídal databázi; jinak se
// snímek načte znovu jako dřív.

// Snímek, který právě odpovídá databázi (před zápisem); nil = nic se opravovat nebude
func (a *App) snimekProOpravu() *snimek {
	p := a.pamet
	if p == nil || a.cestaDb == "" || a.vImportu {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.snimek == nil || p.spojeni == nil || p.db != a.db || p.snimek.err != nil {
		return nil
	}
	var verze int64
	if p.spojeni.QueryRowContext(context.Background(), "PRAGMA data_version").Scan(&verze) != nil || verze != p.verze {
		return nil
	}
	return p.snimek
}

// Po zápisu: opravený snímek místo puvodni (uprava vrátí nil = opravu vzdát, snímek se pak načte znovu)
func (a *App) opravitSnimek(puvodni *snimek, uprava func(s *snimek) *snimek) {
	p := a.pamet
	if puvodni == nil || p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.snimek != puvodni || p.spojeni == nil {
		return
	}
	var verze int64
	if p.spojeni.QueryRowContext(context.Background(), "PRAGMA data_version").Scan(&verze) != nil {
		return
	}
	if novy := uprava(puvodni); novy != nil {
		p.snimek, p.verze = novy, verze
	}
}

func kopieSnimku(s *snimek) *snimek {
	s.mu.Lock()
	texty := s.texty
	kalendar := s.kalendar
	nahledy := s.nahledy
	s.mu.Unlock()
	return &snimek{
		modelky: s.modelky, alba: s.alba, sdileneCenterfoldy: s.sdileneCenterfoldy, fotekCoveru: s.fotekCoveru,
		err: s.err, albaModelek: s.albaModelek, indexModelky: s.indexModelky,
		texty: texty, kalendar: kalendar, nahledy: nahledy,
	}
}

type zmenaSrdicekFotky struct {
	album       int64
	stare, nove int
}

func kosSrdicek(h int) int {
	return min(h, 5) - 1
}

// Snímek po změně srdíček fotek: počty alba (Přehled, nehodnocené) a u jeho modelek hodnocené fotky, součet srdíček
// a srdíčka po albech (oblíbenost, model vkusu)
func opravitSrdickaFotek(s *snimek, zmeny []zmenaSrdicekFotky) *snimek {
	novy := kopieSnimku(s)
	novy.alba = slices.Clone(s.alba)
	novy.modelky = slices.Clone(s.modelky)
	novy.albaModelek = maps.Clone(s.albaModelek)
	poAlbech := map[int64][]zmenaSrdicekFotky{}
	for _, z := range zmeny {
		poAlbech[z.album] = append(poAlbech[z.album], z)
	}
	najdeno := map[int64]bool{}
	for i := range novy.alba {
		for _, z := range poAlbech[novy.alba[i].id] {
			najdeno[z.album] = true
			novy.alba[i].hodnocenych += btoi(z.nove > 0) - btoi(z.stare > 0)
		}
	}
	// Album, které snímek mezi alby modelek nemá (obálka, album bez modelky): opravu vzdát
	for album := range poAlbech {
		if !najdeno[album] {
			return nil
		}
	}
	for id, seznam := range s.albaModelek {
		zmeneno := false
		var dHodnocenych, dSrdci int
		for j, al := range seznam {
			for _, z := range poAlbech[al.id] {
				if !zmeneno {
					seznam = slices.Clone(seznam)
					zmeneno = true
				}
				al := &seznam[j]
				if z.stare > 0 {
					al.pocty[kosSrdicek(z.stare)]--
				}
				if z.nove > 0 {
					al.pocty[kosSrdicek(z.nove)]++
				}
				dHodnocenych += btoi(z.nove > 0) - btoi(z.stare > 0)
				dSrdci += max(z.nove, 0) - max(z.stare, 0)
			}
		}
		if !zmeneno {
			continue
		}
		novy.albaModelek[id] = seznam
		idx, ok := s.indexModelky[id]
		if !ok {
			continue
		}
		m := &novy.modelky[idx]
		m.FotekHodnocenych += dHodnocenych
		m.SrdciFotek += dSrdci
		m.SrdickaAlb = nil
		for _, al := range seznam {
			if al.pocty != (srdickaAlba{}) {
				m.SrdickaAlb = append(m.SrdickaAlb, al.pocty)
			}
		}
		m.SrdickaAlb = m.SrdickaAlb[:len(m.SrdickaAlb):len(m.SrdickaAlb)]
	}
	return novy
}

func btoi(b bool) int {
	if b {
		return 1
	}
	return 0
}
