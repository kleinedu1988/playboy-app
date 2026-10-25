package main

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Návrhy doplnění chybějících údajů pro Údržbu (popis v docs/NAVRHY-DOPLNENI.md). Návrh vzniká dvojím způsobem:
//
//  1. Pravidla: údaj, který už ve sbírce je, jen jinde nebo v jiném tvaru (obvody z textu „míry“, vydání nebo
//     datum alba z jeho názvu, národnost z místa narození podle tabulky zemí, Playmate roku z poznámky).
//  2. Učení ze sbírky: četnosti hodnot mezi modelkami, které údaj vyplněný mají (národnost podle místa narození,
//     etnicita podle národnosti, barva vlasů a očí podle etnicity a národnosti, fotograf podle jiných alb téhož
//     čísla), a lineární regrese obvodů z ostatních údajů postavy.
//
// Jistota je odhad pravděpodobnosti, že navržená hodnota je správně: u četností (k + p·w)/(n + w), tedy podíl
// shod se zkušeností w pseudo-modelek s předpokladem p (Laplaceovo pravidlo pro p = 0,5, w = 2). Pravidla mají
// předpoklad pevný a sbírka ho upřesní: kolikrát by stejné pravidlo u modelek s vyplněným údajem trefilo. Slabý
// návrh (pod prahem) se nenabízí vůbec – raději méně návrhů, ale správných.
//
// Odmítnutý návrh se uloží jako klíč „nv-<pole>“ mezi „netýká se“ modelky nebo alba a už se nevrací. Zároveň
// snižuje jistotu podobných návrhů u ostatních modelek (stejný údaj ze stejného zdroje se stejnou hodnotou):
// každé odmítnutí násobí jistotu w/(w + d), takže dvě až tři odmítnutí zdroj pro tu hodnotu prakticky vypnou.
//
// Výpočet je deterministický a lineární v počtu modelek a alb (jeden průchod na učení, jeden na návrhy).

// Návrh hodnoty chybějícího údaje modelky nebo alba
type NavrhDoplneni struct {
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"` // jen u návrhů pro album, jinak ""
	Typ       string `json:"typ"`   // typ alba, jinak ""
	// Klíč údaje: narodnost, etnicita, vlasyBarva, ociBarva, velikostPrsou, obvodHrudnikCm, obvodPasCm,
	// obvodBokyCm, role (kategorie), vydaniAlba, fotografAlba, datumAlba
	Pole    string  `json:"pole"`
	Popis   string  `json:"popis"`   // česky název údaje, např. „Národnost“
	Hodnota string  `json:"hodnota"` // navrhovaná hodnota v tom tvaru, v jakém se uloží
	Jistota float64 `json:"jistota"` // 0–1, odhad pravděpodobnosti, že je hodnota správně
	Duvod   string  `json:"duvod"`   // česky proč
	Klic    string  `json:"klic"`    // „nv-<pole>“, pod kterým se návrh odmítne
	InputID string  `json:"inputId"` // pole formuláře modelky nebo okna alba pro „Upravit…“
	// Návrh je odmítnutý; v seznamu jen při zobrazení odmítnutých
	Odmitnuto bool `json:"odmitnuto"`
}

// Údaj, pro který se návrhy dělají
type udajNavrhu struct {
	popis   string // „Národnost“
	input   string // pole formuláře modelky
	sloupec string // sloupec tabulky modelky nebo alba
	cislo   bool   // celé číslo (obvody)
	album   bool   // údaj alba
	netyka  string // klíč „netýká se“ modelky, který návrhy údaje vypne (údaje se u ní nesledují)
}

var udajeNavrhu = map[string]udajNavrhu{
	"narodnost":      {popis: "Národnost", input: "inputNarodnost", sloupec: "narodnost", netyka: "zakladni"},
	"etnicita":       {popis: "Etnicita", input: "inputEtnicita", sloupec: "etnicita", netyka: "zakladni"},
	"vlasyBarva":     {popis: "Barva vlasů", input: "inputVlasy", sloupec: "vlasy_barva", netyka: "vzhled"},
	"ociBarva":       {popis: "Barva očí", input: "inputOci", sloupec: "oci_barva", netyka: "vzhled"},
	"velikostPrsou":  {popis: "Velikost prsou", input: "inputVelikost", sloupec: "velikost_prsou", netyka: "vzhled"},
	"obvodHrudnikCm": {popis: "Hrudník", input: "inputHrudnik", sloupec: "obvod_hrudnik_cm", cislo: true, netyka: "vzhled"},
	"obvodPasCm":     {popis: "Pas", input: "inputPas", sloupec: "obvod_pas_cm", cislo: true, netyka: "vzhled"},
	"obvodBokyCm":    {popis: "Boky", input: "inputBoky", sloupec: "obvod_boky_cm", cislo: true, netyka: "vzhled"},
	"role":           {popis: "Kategorie", input: "inputRole", sloupec: "role", netyka: "zarazeni"},
	"vydaniAlba":     {popis: "Vydání alba", input: "inputAlbumRok", sloupec: "vydani", album: true},
	"fotografAlba":   {popis: "Fotograf alba", input: "inputAlbumFotograf", sloupec: "fotograf", album: true},
	"datumAlba":      {popis: "Datum nafocení", input: "inputAlbumDatum", sloupec: "datum", album: true},
}

// Klíče odmítnutých návrhů (ukládají se mezi „netýká se“ modelky a alba jako „ok-…“ u kontroly)
var kliceNavrhuModelky, kliceNavrhuAlba = func() (map[string]bool, map[string]bool) {
	modelky, alba := map[string]bool{}, map[string]bool{}
	for pole, u := range udajeNavrhu {
		if u.album {
			alba[klicNavrhu(pole)] = true
		} else {
			modelky[klicNavrhu(pole)] = true
		}
	}
	return modelky, alba
}()

func klicNavrhu(pole string) string { return "nv-" + pole }

// Obvod (pole návrhu) → index údaje postavy v kontrola_uceni.go
var obvodyNavrhu = []struct {
	pole string
	j    int
}{{"obvodHrudnikCm", prHrudnik}, {"obvodPasCm", prPas}, {"obvodBokyCm", prBoky}}

// Prahy a váhy
const (
	prahNavrhu         = 0.7  // slabší návrh se nenabízí
	stropJistoty       = 0.99 // ani stokrát ověřené pravidlo není jisté (překlep, výjimka)
	prahVzhledu        = 0.85 // etnicita, barva vlasů a očí: jen silně jednoznačné rozložení
	prahEdice          = 0.8  // národnost jen podle edice čísel
	stropVzhledu       = 0.9  // naučený vzhled nikdy nemá vyšší jistotu (vlasy se barví, sbírka není svět)
	minModelekEtnicity = 8
	minModelekVzhledu  = 10 // podmínka etnicita + národnost
	minModelekObecne   = 15 // podmínka jen etnicita nebo jen národnost
	minModelekEdice    = 5
	vahaTabulkyZemi    = 8   // tabulka zemí váží jako 8 modelek sbírky
	podilNoveHodnoty   = 0.8 // národnost, kterou ve sbírce ještě nikdo nemá (tvar zápisu nemusí sedět)
	vahaOdmitnuti      = 6   // jistota × w/(w + počet odmítnutých podobných návrhů)
	prahOdhadu         = 0.6 // odhad obvodu jen když se u sbírky trefí do ±2 cm aspoň u 60 % modelek
	stropOdhadu        = 0.6 // odhad nikdy nepůsobí jistě
	minModelekOdhadu   = 40
)

// Podíl úspěchů s předpokladem: (k + p·w)/(n + w); p = předpoklad bez dat, w = jeho váha v modelkách
func podilSPredpokladem(k, n int, p, w float64) float64 {
	return (float64(k) + p*w) / (float64(n) + w)
}

// Klíč textu pro porovnání: malá písmena bez diakritiky, bez teček, jedna mezera („U.S.A.“ = „usa“)
func klicTextu(s string) string {
	return strings.Join(strings.Fields(strings.ReplaceAll(zjednodusit(s), ".", "")), " ")
}

// Zápisy hodnot ve sbírce: ke každému klíči nejčastější zápis, aby návrh psal hodnotu tak, jak ji píše uživatel
type pravopis map[string]map[string]int

func (p pravopis) pridat(klic, zapis string) {
	if p[klic] == nil {
		p[klic] = map[string]int{}
	}
	p[klic][zapis]++
}

func (p pravopis) zapis(klic string) string {
	nejlepsi, pocet := "", 0
	for z, n := range p[klic] {
		if n > pocet || n == pocet && z < nejlepsi {
			nejlepsi, pocet = z, n
		}
	}
	return nejlepsi
}

// Četnosti hodnot při podmínce
type cetnosti map[string]map[string]int

func (c cetnosti) pridat(podminka, hodnota string) {
	if c[podminka] == nil {
		c[podminka] = map[string]int{}
	}
	c[podminka][hodnota]++
}

// Nejčastější hodnota při podmínce, její počet a počet všech
func (c cetnosti) nejcastejsi(podminka string) (hodnota string, k, n int) {
	for h, p := range c[podminka] {
		n += p
		if p > k || p == k && h < hodnota {
			hodnota, k = h, p
		}
	}
	return hodnota, k, n
}

// Album pro návrhy
type albumNavrhu struct {
	modelkaID                     int
	nazev, typ                    string
	vydani, datum, fotograf, neni string // neni = „netýká se“ alba
	fotek                         int
}

// Alba modelek jedním dotazem
func (a *App) albaNavrhu() []albumNavrhu {
	alba := []albumNavrhu{}
	rows, err := a.db.Query(`SELECT al.modelka_id, al.album, al.typ, COALESCE(al.vydani, ''), COALESCE(al.datum, ''),
			TRIM(COALESCE(al.fotograf, '')), COALESCE(al.netyka_se, ''), COUNT(f.id)
		FROM alba al LEFT JOIN fotky f ON f.album_id = al.id
		WHERE al.modelka_id IS NOT NULL GROUP BY al.id ORDER BY al.modelka_id, al.album, al.typ`)
	if err != nil {
		a.chyba("načtení alb pro návrhy", err)
		return alba
	}
	defer rows.Close()
	for rows.Next() {
		var al albumNavrhu
		if rows.Scan(&al.modelkaID, &al.nazev, &al.typ, &al.vydani, &al.datum, &al.fotograf, &al.neni, &al.fotek) == nil {
			alba = append(alba, al)
		}
	}
	return alba
}

// Návrhy doplnění chybějících údajů seřazené od nejvyšší jistoty; odmítnuté jen s vcetneOdmitnutych (s příznakem)
func (a *App) GetNavrhyDoplneni(vcetneOdmitnutych bool) []NavrhDoplneni {
	return a.navrhyDoplneni(a.GetModelky(""), vcetneOdmitnutych)
}

func (a *App) navrhyDoplneni(modelky []Modelka, vcetneOdmitnutych bool) []NavrhDoplneni {
	vysledek := []NavrhDoplneni{}
	for _, n := range navrhnoutDoplneni(modelky, a.albaNavrhu(), time.Now().Year()) {
		if !n.Odmitnuto || vcetneOdmitnutych {
			vysledek = append(vysledek, n)
		}
	}
	return vysledek
}

// Přijetí návrhu: zapíše hodnotu, jen když je údaj stále prázdný (jinak false a nic se nemění)
func (a *App) PrijmoutNavrh(n NavrhDoplneni) bool {
	zapsano := false
	ok := a.vTransakci("přijetí návrhu", func(q dotazovac) error {
		var err error
		zapsano, err = zapsatNavrh(q, n)
		return err
	})
	return ok && zapsano
}

// Přijetí více návrhů najednou (hromadná změna: předtím záloha); vrací počet zapsaných
func (a *App) PrijmoutNavrhy(navrhy []NavrhDoplneni) int {
	if len(navrhy) == 0 {
		return 0
	}
	if err := a.zalohovat("pred-prijetim-navrhu"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return 0
	}
	pocet := 0
	ok := a.vTransakci("přijetí návrhů", func(q dotazovac) error {
		for _, n := range navrhy {
			zapsano, err := zapsatNavrh(q, n)
			if err != nil {
				return err
			}
			if zapsano {
				pocet++
			}
		}
		return nil
	})
	if !ok {
		return 0
	}
	return pocet
}

// Odmítnutí návrhu (odmitnout = false odmítnutí ruší): klíč „nv-<pole>“ mezi „netýká se“ modelky nebo alba
func (a *App) OdmitnoutNavrh(n NavrhDoplneni, odmitnout bool) bool {
	u, ok := udajeNavrhu[n.Pole]
	if !ok || n.Klic != klicNavrhu(n.Pole) || u.album != (n.Album != "") {
		return false
	}
	if u.album {
		return a.SetNetykaSeAlba(n.ModelkaID, n.Album, n.Typ, n.Klic, odmitnout)
	}
	return a.SetNetykaSe(n.ModelkaID, n.Klic, odmitnout)
}

var vzorPlaymateRokuNavrhu = regexp.MustCompile(`^Playmate roku (19|20)\d{2}$`)

// Zápis jednoho návrhu; false, když údaj mezitím někdo vyplnil nebo návrh není platný
func zapsatNavrh(q dotazovac, n NavrhDoplneni) (bool, error) {
	u, ok := udajeNavrhu[n.Pole]
	hodnota := strings.TrimSpace(n.Hodnota)
	if !ok || hodnota == "" {
		return false, nil
	}
	zapsano := func(vysledek interface{ RowsAffected() (int64, error) }, err error) (bool, error) {
		if err != nil {
			return false, err
		}
		pocet, err := vysledek.RowsAffected()
		return pocet > 0, err
	}
	if u.album {
		if n.Album == "" {
			return false, nil
		}
		klic := "COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?"
		switch n.Pole {
		case "vydaniAlba":
			if !vzorVydaniAlba.MatchString(hodnota) || jeOnlineTyp(n.Typ) || n.Typ == "Centerfold" || n.Typ == "Cover" {
				return false, nil
			}
			return zapsano(q.Exec("UPDATE alba SET vydani = ? WHERE "+klic+" AND COALESCE(vydani, '') = ''", hodnota, n.ModelkaID, n.Album, n.Typ))
		case "datumAlba":
			if !platneDatum(hodnota) || !jeOnlineTyp(n.Typ) {
				return false, nil
			}
			return zapsano(q.Exec("UPDATE alba SET datum = ? WHERE "+klic+" AND COALESCE(datum, '') = ''", hodnota, n.ModelkaID, n.Album, n.Typ))
		default:
			return zapsano(q.Exec("UPDATE alba SET "+u.sloupec+" = ? WHERE "+klic+" AND TRIM(COALESCE("+u.sloupec+", '')) = ''", hodnota, n.ModelkaID, n.Album, n.Typ))
		}
	}
	if n.Album != "" {
		return false, nil
	}
	switch {
	case u.cislo:
		cislo, err := strconv.Atoi(hodnota)
		j := -1
		for _, o := range obvodyNavrhu {
			if o.pole == n.Pole {
				j = o.j
			}
		}
		if err != nil || j < 0 || float64(cislo) < priznaky[j].mezOd || float64(cislo) > priznaky[j].mezDo {
			return false, nil
		}
		ok, err := zapsano(q.Exec("UPDATE modelky SET "+u.sloupec+" = ? WHERE id = ? AND COALESCE("+u.sloupec+", 0) = 0", cislo, n.ModelkaID))
		if ok {
			// Se všemi třemi obvody se míry skládají z nich (stejně jako při uložení formuláře)
			_, err = q.Exec(`UPDATE modelky SET miry = obvod_hrudnik_cm || '-' || obvod_pas_cm || '-' || obvod_boky_cm
				WHERE id = ? AND obvod_hrudnik_cm > 0 AND obvod_pas_cm > 0 AND obvod_boky_cm > 0`, n.ModelkaID)
		}
		return ok && err == nil, err
	case n.Pole == "role":
		// Kategorie se k zapsaným přidá; „prázdný“ je údaj, dokud modelka Playmate roku zapsanou nemá
		if !vzorPlaymateRokuNavrhu.MatchString(hodnota) {
			return false, nil
		}
		var role string
		if err := q.QueryRow("SELECT COALESCE(role, '') FROM modelky WHERE id = ?", n.ModelkaID).Scan(&role); err != nil {
			return false, nil
		}
		if maPlaymateRoku(role) {
			return false, nil
		}
		nova := hodnota
		if strings.TrimSpace(role) != "" {
			nova = strings.TrimRight(strings.TrimSpace(role), ",;") + ", " + hodnota
		}
		return zapsano(q.Exec("UPDATE modelky SET role = ? WHERE id = ? AND COALESCE(role, '') = ?", nova, n.ModelkaID, role))
	default:
		return zapsano(q.Exec("UPDATE modelky SET "+u.sloupec+" = ? WHERE id = ? AND TRIM(COALESCE("+u.sloupec+", '')) = ''", hodnota, n.ModelkaID))
	}
}

// Kandidát návrhu: vzor = co mají podobné návrhy společné (pro učení z odmítnutí)
type kandidat struct {
	NavrhDoplneni
	vzor string
}

// Všechny návrhy sbírky (i odmítnuté, s příznakem) nad prahem, seřazené od nejvyšší jistoty.
// Modelky a alba jako z GetModelky a albaNavrhu; letos = nejpozdější rok, který může být v datu.
func navrhnoutDoplneni(modelky []Modelka, alba []albumNavrhu, letos int) []NavrhDoplneni {
	var kandidati []kandidat
	pridat := func(m Modelka, al *albumNavrhu, pole, hodnota, duvod, zdroj string, jistota float64) {
		u := udajeNavrhu[pole]
		k := kandidat{NavrhDoplneni: NavrhDoplneni{ModelkaID: m.ID, Jmeno: m.Jmeno, Pole: pole, Popis: u.popis, Hodnota: hodnota,
			Jistota: jistota, Duvod: duvod, Klic: klicNavrhu(pole), InputID: u.input}}
		k.vzor = pole + "|" + zdroj
		if al != nil {
			k.Album, k.Typ = al.nazev, al.typ
			k.Odmitnuto = obsahujeKlic(al.neni, k.Klic)
		} else {
			k.Odmitnuto = obsahujeKlic(m.NetykaSe, k.Klic)
		}
		kandidati = append(kandidati, k)
	}

	navrhnoutNarodnosti(modelky, pridat)
	navrhnoutVzhled(modelky, pridat)
	navrhnoutMiry(modelky, pridat)
	navrhnoutPlaymateRoku(modelky, alba, pridat)
	navrhnoutAlba(modelky, alba, letos, pridat)

	return vybratNavrhy(kandidati)
}

// Funkce, kterou zdroje přidávají kandidáty (al = nil u údaje modelky)
type pridatKandidata func(m Modelka, al *albumNavrhu, pole, hodnota, duvod, zdroj string, jistota float64)

// Učení z odmítnutí, sloučení návrhů pro stejný údaj, práh a řazení
func vybratNavrhy(kandidati []kandidat) []NavrhDoplneni {
	// Odmítnuté podobné návrhy: stejný údaj, zdroj a hodnota (u alb a odhadů zdroj sám)
	odmitnute := map[string]int{}
	for _, k := range kandidati {
		if k.Odmitnuto {
			odmitnute[k.vzor]++
		}
	}
	for i := range kandidati {
		k := &kandidati[i]
		d := odmitnute[k.vzor]
		if k.Odmitnuto {
			d--
		}
		if d > 0 {
			k.Jistota *= vahaOdmitnuti / (vahaOdmitnuti + float64(d))
			k.Duvod += fmt.Sprintf("; podobný návrh odmítnut %d×", d)
		}
	}

	// Pro jeden údaj nejvýš jeden návrh: shodné hodnoty → ten jistější; různé hodnoty, z nichž by prošly
	// dvě → údaj je sporný a nenavrhuje se
	type klicUdaje struct {
		modelka    int
		album, typ string
		pole       string
	}
	nejlepsi := map[klicUdaje]int{}
	sporne := map[klicUdaje]bool{}
	var poradi []klicUdaje
	for i, k := range kandidati {
		ku := klicUdaje{k.ModelkaID, k.Album, k.Typ, k.Pole}
		j, ok := nejlepsi[ku]
		if !ok {
			nejlepsi[ku] = i
			poradi = append(poradi, ku)
			continue
		}
		jiny := kandidati[j]
		if klicTextu(jiny.Hodnota) != klicTextu(k.Hodnota) && min(jiny.Jistota, k.Jistota) >= prahNavrhu*0.9 {
			sporne[ku] = true
		}
		if k.Jistota > jiny.Jistota {
			nejlepsi[ku] = i
		}
	}
	navrhy := []NavrhDoplneni{}
	for _, ku := range poradi {
		k := kandidati[nejlepsi[ku]]
		if sporne[ku] || !jeOdhad(k.vzor) && k.Jistota < prahNavrhu {
			continue
		}
		k.Jistota = math.Round(min(k.Jistota, stropJistoty)*1000) / 1000
		navrhy = append(navrhy, k.NavrhDoplneni)
	}
	klice := make([]string, len(navrhy))
	for i, n := range navrhy {
		klice[i] = zjednodusit(n.Jmeno) + "\x00" + n.Album + "\x00" + n.Typ + "\x00" + n.Pole
	}
	index := make([]int, len(navrhy))
	for i := range index {
		index[i] = i
	}
	sort.SliceStable(index, func(x, y int) bool {
		a, b := navrhy[index[x]], navrhy[index[y]]
		if a.Jistota != b.Jistota {
			return a.Jistota > b.Jistota
		}
		if klice[index[x]] != klice[index[y]] {
			return klice[index[x]] < klice[index[y]]
		}
		return a.ModelkaID < b.ModelkaID
	})
	serazene := make([]NavrhDoplneni, len(navrhy))
	for i, j := range index {
		serazene[i] = navrhy[j]
	}
	return serazene
}

// Odhad obvodu regresí: má vlastní práh (prahOdhadu se ověřuje už při odhadu) a nízkou jistotu
const zdrojOdhadu = "odhad"

func jeOdhad(vzor string) bool { return strings.HasSuffix(vzor, "|"+zdrojOdhadu) }

// Modelka nesleduje údaje skupiny („netýká se“) nebo návrh odmítla celý
func neniKNavrhu(m Modelka, pole string) bool {
	u := udajeNavrhu[pole]
	return u.netyka != "" && obsahujeKlic(m.NetykaSe, u.netyka)
}

// ---------------------------------------------------------------------------------------------------------
// Národnost

// Země: výchozí zápis národnosti, názvy (místa narození) a další tvary národnosti; vše zjednodušené (klicTextu)
// kromě výchozího zápisu. Výchozí zápis se použije, jen když národnost ve sbírce ještě nikdo nemá; jinak se
// píše nejčastější zápis sbírky (USA, Americká…).
var tabulkaZemi = []struct{ narodnost, nazvy, tvary string }{
	{"USA", "usa|us|united states|united states of america|spojene staty|spojene staty americke|amerika|america", "americka|american|americanka"},
	{"Kanada", "kanada|canada", "kanadska|canadian|kanadanka"},
	{"Česko", "cesko|ceska republika|czech republic|czechia|cr", "ceska|czech|cesko|ceska republika|cr|ceska narodnost|cechie"},
	{"Slovensko", "slovensko|slovakia|slovak republic|slovenska republika|sr", "slovenska|slovak|slovenka"},
	{"Velká Británie", "velka britanie|britanie|united kingdom|uk|great britain|spojene kralovstvi|anglie|england|skotsko|scotland|wales|severni irsko|northern ireland", "britska|british|anglicka|english|britka|anglicanka"},
	{"Irsko", "irsko|ireland|eire", "irska|irish"},
	{"Německo", "nemecko|germany|deutschland|nsr|ndr|west germany|east germany|zapadni nemecko|vychodni nemecko", "nemecka|german|nemka"},
	{"Rakousko", "rakousko|austria|osterreich", "rakouska|austrian"},
	{"Švýcarsko", "svycarsko|switzerland|schweiz|suisse", "svycarska|swiss"},
	{"Francie", "francie|france", "francouzska|french|francouzka"},
	{"Belgie", "belgie|belgium|belgique", "belgicka|belgian"},
	{"Nizozemsko", "nizozemsko|netherlands|holandsko|holland|nederland|the netherlands", "nizozemska|holandska|dutch"},
	{"Dánsko", "dansko|denmark|danmark", "danska|danish"},
	{"Švédsko", "svedsko|sweden|sverige", "svedska|swedish"},
	{"Norsko", "norsko|norway|norge", "norska|norwegian"},
	{"Finsko", "finsko|finland|suomi", "finska|finnish"},
	{"Island", "island|iceland", "islandska|icelandic"},
	{"Itálie", "italie|italy|italia", "italska|italian"},
	{"Španělsko", "spanelsko|spain|espana", "spanelska|spanish"},
	{"Portugalsko", "portugalsko|portugal", "portugalska|portuguese"},
	{"Řecko", "recko|greece", "recka|greek"},
	{"Polsko", "polsko|poland|polska", "polska|polish"},
	{"Maďarsko", "madarsko|hungary|magyarorszag", "madarska|hungarian"},
	{"Rumunsko", "rumunsko|romania", "rumunska|romanian"},
	{"Bulharsko", "bulharsko|bulgaria", "bulharska|bulgarian"},
	{"Chorvatsko", "chorvatsko|croatia|hrvatska", "chorvatska|croatian"},
	{"Srbsko", "srbsko|serbia|srbija", "srbska|serbian"},
	{"Slovinsko", "slovinsko|slovenia|slovenija", "slovinska|slovenian"},
	{"Rusko", "rusko|russia|ruska federace|russian federation", "ruska|russian"},
	{"Ukrajina", "ukrajina|ukraine", "ukrajinska|ukrainian"},
	{"Bělorusko", "belorusko|belarus", "beloruska|belarusian"},
	{"Estonsko", "estonsko|estonia", "estonska|estonian"},
	{"Lotyšsko", "lotyssko|latvia", "lotysska|latvian"},
	{"Litva", "litva|lithuania", "litevska|lithuanian"},
	{"Turecko", "turecko|turkey|turkiye", "turecka|turkish"},
	{"Izrael", "izrael|israel", "izraelska|israeli"},
	{"Austrálie", "australie|australia", "australska|australian"},
	{"Nový Zéland", "novy zeland|new zealand", "novozelandska|new zealander"},
	{"Japonsko", "japonsko|japan", "japonska|japanese"},
	{"Čína", "cina|china", "cinska|chinese"},
	{"Jižní Korea", "jizni korea|south korea|korea", "korejska|jihokorejska|korean|south korean"},
	{"Filipíny", "filipiny|philippines", "filipinska|filipino|filipina"},
	{"Thajsko", "thajsko|thailand", "thajska|thai"},
	{"Vietnam", "vietnam|viet nam", "vietnamska|vietnamese"},
	{"Indie", "indie|india", "indicka|indian"},
	{"Jihoafrická republika", "jihoafricka republika|jar|south africa", "jihoafricka|south african"},
	{"Mexiko", "mexiko|mexico", "mexicka|mexican"},
	{"Brazílie", "brazilie|brazil|brasil", "brazilska|brazilian"},
	{"Argentina", "argentina", "argentinska|argentine|argentinian"},
	{"Kolumbie", "kolumbie|colombia", "kolumbijska|colombian"},
	{"Venezuela", "venezuela", "venezuelska|venezuelan"},
	{"Kuba", "kuba|cuba", "kubanska|cuban"},
	{"Chile", "chile", "chilska|chilean"},
	{"Peru", "peru", "peruanska|peruvian"},
}

// Další místa, která jednoznačně patří k zemi: státy USA, provincie Kanady a velká města
var mistaZemi = map[string]string{
	"USA": "alabama|alaska|arizona|arkansas|california|kalifornie|colorado|kolorado|connecticut|delaware|florida|hawaii|havaj|" +
		"idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|" +
		"missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|novy mexiko|new york|ohio|oklahoma|oregon|" +
		"pennsylvania|pensylvanie|rhode island|north carolina|severni karolina|south carolina|jizni karolina|north dakota|" +
		"severni dakota|south dakota|jizni dakota|tennessee|texas|utah|vermont|virginia|virginie|washington|west virginia|" +
		"zapadni virginie|wisconsin|wyoming|district of columbia|washington dc|los angeles|new york city|nyc|chicago|houston|" +
		"miami|las vegas|san francisco|san diego|dallas|seattle|philadelphia|boston|detroit|phoenix|atlanta|denver|honolulu",
	"Kanada": "ontario|quebec|british columbia|britska kolumbie|alberta|manitoba|saskatchewan|nova scotia|nove skotsko|" +
		"new brunswick|novy brunswick|newfoundland|prince edward island|toronto|montreal|vancouver|calgary|ottawa|edmonton|winnipeg",
	"Česko":          "praha|prague|brno|ostrava|plzen|olomouc|liberec|ceske budejovice|hradec kralove|pardubice|usti nad labem|zlin|karlovy vary",
	"Slovensko":      "bratislava|kosice|presov|zilina|nitra|banska bystrica|trnava",
	"Velká Británie": "london|londyn|manchester|liverpool|birmingham|glasgow|edinburgh|edinburk|cardiff|belfast|leeds|bristol",
	"Německo":        "berlin|hamburg|mnichov|munchen|munich|koln|kolin nad rynem|cologne|frankfurt|stuttgart|dusseldorf|drazdany|dresden|lipsko|leipzig",
	"Rakousko":       "viden|wien|vienna|salzburg|graz|innsbruck|linz",
	"Francie":        "paris|pariz|marseille|lyon|nice|toulouse|bordeaux",
	"Itálie":         "rim|roma|rome|milano|milan|neapol|napoli|naples|turin|torino|florencie|firenze|florence|benatky|venezia|venice",
	"Španělsko":      "madrid|barcelona|valencie|valencia|sevilla|malaga",
	"Nizozemsko":     "amsterdam|rotterdam|haag|den haag|utrecht",
	"Švédsko":        "stockholm|goteborg|gothenburg|malmo",
	"Norsko":         "oslo|bergen",
	"Dánsko":         "kodan|copenhagen|kobenhavn|aarhus",
	"Finsko":         "helsinki",
	"Polsko":         "varsava|warszawa|warsaw|krakov|krakow|gdansk|vratislav|wroclaw|lodz|poznan",
	"Maďarsko":       "budapest|budapesti|debrecin|debrecen",
	"Rusko":          "moskva|moscow|petrohrad|sankt peterburg|saint petersburg|st petersburg",
	"Ukrajina":       "kyjev|kiev|kyiv|charkov|kharkiv|oděsa|odesa|odessa|lvov|lviv",
	"Austrálie":      "sydney|melbourne|brisbane|perth|adelaide",
	"Japonsko":       "tokio|tokyo|osaka|kjoto|kyoto",
	"Mexiko":         "mexico city|ciudad de mexico|guadalajara|monterrey|tijuana",
	"Brazílie":       "sao paulo|rio de janeiro|brasilia|salvador",
	"Argentina":      "buenos aires",
	"Kolumbie":       "bogota|medellin|cali",
	"Venezuela":      "caracas",
	"Filipíny":       "manila",
}

// Dvoupísmenné zkratky států USA („Austin, TX“); jen velkými písmeny a ne jako první část místa
var zkratkyStatuUSA = map[string]bool{}

func init() {
	for _, z := range strings.Split("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC", " ") {
		zkratkyStatuUSA[z] = true
	}
}

// Rejstřík tabulky zemí: místo → země a tvar národnosti → země (index v tabulkaZemi)
var mistoNaZemi, narodnostNaZemi, zemeUSA = func() (map[string]int, map[string]int, int) {
	mista, narodnosti := map[string]int{}, map[string]int{}
	podleNazvu := map[string]int{}
	for i, z := range tabulkaZemi {
		podleNazvu[z.narodnost] = i
		for _, n := range strings.Split(z.nazvy, "|") {
			mista[n] = i
			narodnosti[n] = i
		}
		for _, n := range strings.Split(z.tvary, "|") {
			narodnosti[n] = i
		}
		narodnosti[klicTextu(z.narodnost)] = i
	}
	for zeme, seznam := range mistaZemi {
		for _, n := range strings.Split(seznam, "|") {
			mista[klicTextu(n)] = podleNazvu[zeme]
		}
	}
	return mista, narodnosti, podleNazvu["USA"]
}()

// Klíč národnosti: země z tabulky („z:3“), jinak zjednodušený text („t:…“). USA a Americká mají stejný klíč.
func klicNarodnosti(narodnost string) string {
	k := klicTextu(narodnost)
	if k == "" {
		return ""
	}
	if i, ok := narodnostNaZemi[k]; ok {
		return "z:" + strconv.Itoa(i)
	}
	return "t:" + k
}

// Část místa narození: klíč a zápis
type castMista struct{ klic, zapis string }

// Části místa narození od nejkonkrétnější („Santa Monica, California, USA“ → santa monica, california, usa);
// závorka je další část („Praha (Československo)“)
func castiMista(misto string) []castMista {
	var casti []castMista
	for _, c := range strings.FieldsFunc(misto, func(r rune) bool { return r == ',' || r == '(' || r == ')' || r == ';' }) {
		zapis := strings.TrimSpace(c)
		if k := klicTextu(zapis); k != "" {
			casti = append(casti, castMista{k, zapis})
		}
	}
	return casti
}

// Země podle tabulky pro část místa (i s drobným překlepem: Jaro–Winkler ≥ 0,94 u delších názvů); -1 = neznámá
type rejstrikMist struct{ mezipamet map[string]int }

func (r *rejstrikMist) zeme(c castMista, poradi int) int {
	if poradi > 0 && len(c.zapis) == 2 && zkratkyStatuUSA[c.zapis] {
		return zemeUSA
	}
	if i, ok := mistoNaZemi[c.klic]; ok {
		return i
	}
	if i, ok := r.mezipamet[c.klic]; ok {
		return i
	}
	nejlepsi, skore, druhe := -1, 0.0, -1
	if len([]rune(c.klic)) >= 6 {
		znaky := []rune(c.klic)
		for nazev, i := range mistoNaZemi {
			if len(nazev) < 6 {
				continue
			}
			if s := jaroWinklerZnaku(znaky, []rune(nazev)); s >= 0.94 && (s > skore || s == skore && i < nejlepsi) {
				if nejlepsi >= 0 && i != nejlepsi {
					druhe = nejlepsi
				}
				nejlepsi, skore = i, s
			}
		}
	}
	if druhe >= 0 && druhe != nejlepsi {
		nejlepsi = -1 // podobá se názvům dvou zemí
	}
	r.mezipamet[c.klic] = nejlepsi
	return nejlepsi
}

// Národnost z místa narození (naučené ze sbírky a tabulka zemí) a z edice čísel (jen česká edice → nejčastější
// národnost takových modelek). Z více částí místa se vezme ta s nejvyšší jistotou.
func navrhnoutNarodnosti(modelky []Modelka, pridat pridatKandidata) {
	zapisy := pravopis{}
	mista := cetnosti{} // část místa → klíč národnosti
	edice := cetnosti{} // edice čísel → klíč národnosti
	rejstrik := &rejstrikMist{mezipamet: map[string]int{}}
	for _, m := range modelky {
		k := klicNarodnosti(m.Narodnost)
		if k == "" {
			continue
		}
		zapisy.pridat(k, strings.TrimSpace(m.Narodnost))
		videne := map[string]bool{}
		for _, c := range castiMista(m.NarozeniMisto) {
			if !videne[c.klic] {
				videne[c.klic] = true
				mista.pridat(c.klic, k)
			}
		}
		if e := edicePrehledu(m); e != "" {
			edice.pridat(e, k)
		}
	}
	zapisZeme := func(zeme int) (string, bool) {
		if z := zapisy.zapis("z:" + strconv.Itoa(zeme)); z != "" {
			return z, true
		}
		return tabulkaZemi[zeme].narodnost, false
	}

	for _, m := range modelky {
		if strings.TrimSpace(m.Narodnost) != "" || neniKNavrhu(m, "narodnost") {
			continue
		}
		var nejHodnota, nejDuvod string
		nejJistota := 0.0
		for poradi, c := range castiMista(m.NarozeniMisto) {
			zeme := rejstrik.zeme(c, poradi)
			klicZeme := ""
			if zeme >= 0 {
				klicZeme = "z:" + strconv.Itoa(zeme)
			}
			// Nejčastější národnost u modelek z téhož místa; tabulka zemí přidá své zemi vahaTabulkyZemi
			pocty := mista[c.klic]
			n := 0
			for _, p := range pocty {
				n += p
			}
			nejKlic, nejK := "", 0.0
			for klic, p := range pocty {
				v := float64(p)
				if klic == klicZeme {
					v += vahaTabulkyZemi
				}
				if v > nejK || v == nejK && klic < nejKlic {
					nejKlic, nejK = klic, v
				}
			}
			celkem := float64(n)
			if zeme >= 0 {
				celkem += vahaTabulkyZemi
				if _, ma := pocty[klicZeme]; !ma && vahaTabulkyZemi > nejK {
					nejKlic, nejK = klicZeme, vahaTabulkyZemi
				}
			}
			if nejKlic == "" {
				continue
			}
			// Laplaceovo pravidlo: (k + 1)/(n + 2)
			jistota := (nejK + 1) / (celkem + 2)
			hodnota, znama := zapisy.zapis(nejKlic), true
			if hodnota == "" && nejKlic == klicZeme {
				hodnota, znama = zapisZeme(zeme)
			}
			k := pocty[nejKlic]
			var duvod string
			switch {
			case nejKlic == klicZeme && n == 0:
				duvod = fmt.Sprintf("místo narození %s → %s (tabulka zemí)", c.zapis, hodnota)
			case nejKlic == klicZeme:
				duvod = fmt.Sprintf("místo narození %s → %s (tabulka zemí; ve sbírce %d z %d %s odtud)", c.zapis, hodnota, k, n, sklonovatSlovo(n, "modelky", "modelek", "modelek"))
			default:
				duvod = fmt.Sprintf("místo narození %s → %s (%d z %d %s sbírky narozených tamtéž)", c.zapis, hodnota, k, n, sklonovatSlovo(n, "modelky", "modelek", "modelek"))
			}
			if !znama {
				jistota *= podilNoveHodnoty
				duvod += "; tuto národnost ve sbírce zatím nikdo nemá"
			}
			if jistota > nejJistota || jistota == nejJistota && poradi > 0 {
				nejHodnota, nejDuvod, nejJistota = hodnota, duvod, jistota
			}
		}
		if nejHodnota != "" {
			pridat(m, nil, "narodnost", nejHodnota, nejDuvod, "misto|"+klicTextu(nejHodnota), nejJistota)
			continue
		}
		// Bez místa: edice čísel (jen tam, kde má modelka čísla jen jedné edice)
		if e := edicePrehledu(m); e != "" {
			klic, k, n := edice.nejcastejsi(e)
			if jistota := podilSPredpokladem(k, n, 0.5, 2); n >= minModelekEdice && jistota >= prahEdice {
				hodnota := zapisy.zapis(klic)
				pridat(m, nil, "narodnost", hodnota, fmt.Sprintf("vyšla jen v edici %s; %d z %d takových modelek sbírky má národnost %s", e, k, n, hodnota),
					"edice|"+klicTextu(hodnota), jistota)
			}
		}
	}
}

// Edice všech čísel modelky, když jsou jedné edice („CZ“, „US“); jinak ""
func edicePrehledu(m Modelka) string {
	edice := ""
	for _, seznam := range [][]string{m.Vydani, m.Centerfoldy, m.Obalky} {
		for _, v := range seznam {
			if !vzorVydaniAlba.MatchString(v) {
				continue
			}
			e := edicePodleVydani(v)
			if e == "" {
				e = "US"
			}
			if edice != "" && edice != e {
				return ""
			}
			edice = e
		}
	}
	return edice
}

// ---------------------------------------------------------------------------------------------------------
// Etnicita, barva vlasů a očí

// Etnicita podle národnosti; barva vlasů a očí podle etnicity a národnosti (s ústupem na jen etnicitu, nebo
// jen národnost, když dvojice nemá dost modelek). Bere se nejkonkrétnější podmínka, která má dost modelek,
// ne ta, která vyjde nejlépe (to by byl výběr náhody). Navrhuje se jen silně jednoznačná hodnota.
func navrhnoutVzhled(modelky []Modelka, pridat pridatKandidata) {
	type udaj struct {
		pole, slovo string // „barvu vlasů“
		hodnota     func(Modelka) string
	}
	udaje := []udaj{
		{"etnicita", "etnicitu", func(m Modelka) string { return m.Etnicita }},
		{"vlasyBarva", "barvu vlasů", func(m Modelka) string { return m.VlasyBarva }},
		{"ociBarva", "barvu očí", func(m Modelka) string { return m.OciBarva }},
	}
	zapisy := map[string]pravopis{}
	tabulky := map[string]cetnosti{}
	for _, u := range udaje {
		zapisy[u.pole], tabulky[u.pole] = pravopis{}, cetnosti{}
	}
	type podminka struct {
		klic, popis string
		minimum     int // nejmenší počet modelek s údajem při podmínce
	}
	podminky := func(m Modelka, pole string) []podminka {
		e, n := klicTextu(m.Etnicita), klicNarodnosti(m.Narodnost)
		etnicita, narodnost := "etnicita "+strings.TrimSpace(m.Etnicita), "národnost "+strings.TrimSpace(m.Narodnost)
		var p []podminka
		if pole == "etnicita" {
			if n != "" {
				p = append(p, podminka{"n:" + n, narodnost, minModelekEtnicity})
			}
			return p
		}
		if e != "" && n != "" {
			p = append(p, podminka{"e:" + e + "|n:" + n, etnicita + ", " + narodnost, minModelekVzhledu})
		}
		if e != "" {
			p = append(p, podminka{"e:" + e, etnicita, minModelekObecne})
		}
		if n != "" {
			p = append(p, podminka{"n:" + n, narodnost, minModelekObecne})
		}
		return p
	}
	for _, m := range modelky {
		for _, u := range udaje {
			h := strings.TrimSpace(u.hodnota(m))
			if h == "" {
				continue
			}
			k := klicTextu(h)
			zapisy[u.pole].pridat(k, h)
			for _, p := range podminky(m, u.pole) {
				tabulky[u.pole].pridat(p.klic, k)
			}
		}
	}
	for _, m := range modelky {
		for _, u := range udaje {
			if strings.TrimSpace(u.hodnota(m)) != "" || neniKNavrhu(m, u.pole) {
				continue
			}
			for _, p := range podminky(m, u.pole) {
				klic, k, n := tabulky[u.pole].nejcastejsi(p.klic)
				if n < p.minimum {
					continue
				}
				if jistota := podilSPredpokladem(k, n, 0.5, 2); jistota >= prahVzhledu {
					hodnota := zapisy[u.pole].zapis(klic)
					pridat(m, nil, u.pole, hodnota, fmt.Sprintf("%s: %d z %d modelek sbírky má %s %s", p.popis, k, n, u.slovo, hodnota),
						"cetnost|"+klic, min(jistota, stropVzhledu))
				}
				break
			}
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Míry: obvody a velikost prsou z textu „míry“, jinak odhad obvodu regresí

// „90-60-90“, „36-24-36“, „34C-24-35“, „90 x 60 x 90 cm“
var vzorMer = regexp.MustCompile(`^\s*(\d{2,3})\s*([A-Ga-g]{1,3})?\s*[-–/x×]\s*(\d{2,3})\s*[-–/x×]\s*(\d{2,3})\s*(cm|in|"|″|inch|inches|palce|palcu)?\s*$`)

// Rozložené míry v centimetrech; prsa = velikost košíčku napsaná u hrudníku („34C“), hrudník je pak obvod pod
// prsy, ne přes ně, a jako obvod hrudníku se nebere
type rozlozeneMiry struct {
	obvody   [3]int // hrudník, pas, boky; 0 = neznámý
	palce    bool
	pasmo    int    // číslo u velikosti košíčku
	kosicek  string // „C“
	puvodni  string
	vPalcich [3]int
}

func rozlozitMiry(text string) (rozlozeneMiry, bool) {
	r := rozlozeneMiry{puvodni: strings.TrimSpace(text)}
	s := vzorMer.FindStringSubmatch(text)
	if s == nil {
		return r, false
	}
	var cisla [3]int
	for i, j := range []int{1, 3, 4} {
		cisla[i], _ = strconv.Atoi(s[j])
	}
	jednotka := strings.ToLower(s[5])
	switch {
	case jednotka == "cm":
	case jednotka != "":
		r.palce = true
	case cisla[0] <= 60 && cisla[1] <= 60 && cisla[2] <= 60:
		r.palce = true
	case cisla[0] >= 45 && cisla[1] >= 45 && cisla[2] >= 45:
	default:
		return r, false // smíšené jednotky
	}
	r.vPalcich = cisla
	for i, c := range cisla {
		if r.palce {
			c = int(math.Round(float64(c) * 2.54))
		}
		r.obvody[i] = c
	}
	if s[2] != "" {
		r.kosicek = strings.ToUpper(s[2])
		r.pasmo = cisla[0]
		r.obvody[0] = 0
	}
	for i, o := range obvodyNavrhu {
		if p := priznaky[o.j]; r.obvody[i] != 0 && (float64(r.obvody[i]) < p.mezOd || float64(r.obvody[i]) > p.mezDo) {
			return r, false
		}
	}
	return r, true
}

// Tvar velikosti prsou: americká („34C“), evropská („75C“) nebo jen košíček („C“)
const (
	tvarUS = iota
	tvarEU
	tvarKosicek
	pocetTvaru
)

var vzorVelikostiPrsou = regexp.MustCompile(`^\s*(\d{2,3})?\s*([A-Ga-g]{1,3})\s*$`)

func tvarVelikosti(v string) int {
	s := vzorVelikostiPrsou.FindStringSubmatch(v)
	switch {
	case s == nil:
		return -1
	case s[1] == "":
		return tvarKosicek
	}
	if n, _ := strconv.Atoi(s[1]); n < 55 {
		return tvarUS
	}
	return tvarEU
}

// Americká velikost na evropskou (pásmo 34 → 75, košíček do D stejný, DD → E, DDD → F); "" když nejde
func velikostEU(pasmo int, kosicek string) string {
	if pasmo < 28 || pasmo > 46 || pasmo%2 != 0 {
		return ""
	}
	prevod := map[string]string{"AA": "AA", "A": "A", "B": "B", "C": "C", "D": "D", "DD": "E", "DDD": "F"}
	k, ok := prevod[kosicek]
	if !ok {
		return ""
	}
	return strconv.Itoa(pasmo*5/2-10) + k
}

func navrhnoutMiry(modelky []Modelka, pridat pridatKandidata) {
	// Tvar velikosti prsou, kterým sbírka píše (většina aspoň ze 70 % a aspoň 5 hodnot, jinak jak je v mírách)
	var tvary [pocetTvaru]int
	celkem := 0
	for _, m := range modelky {
		if t := tvarVelikosti(m.VelikostPrsou); t >= 0 {
			tvary[t]++
			celkem++
		}
	}
	tvarSbirky := -1
	for t, n := range tvary {
		if celkem >= 5 && float64(n) >= 0.7*float64(celkem) {
			tvarSbirky = t
		}
	}

	udaje := make([]udajePostavy, len(modelky))
	for i, m := range modelky {
		x, ma := priznakyModelky(m)
		udaje[i] = udajePostavy{x: x, ma: ma}
	}
	odhady := map[[2]int]*regreseObvodu{}
	for i, m := range modelky {
		if neniKNavrhu(m, "obvodPasCm") {
			continue
		}
		stavajici := [3]int{m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm}
		if strings.TrimSpace(m.Miry) != "" {
			r, ok := rozlozitMiry(m.Miry)
			if !ok {
				continue // míry, kterým program nerozumí: neodhaduje se ani regresí
			}
			// Vyplněné obvody musí mírám odpovídat, jinak je text nespolehlivý
			souhlasi := true
			for j, s := range stavajici {
				if s > 0 && r.obvody[j] > 0 && abs(s-r.obvody[j]) > 2 {
					souhlasi = false
				}
			}
			if !souhlasi {
				continue
			}
			for j, o := range obvodyNavrhu {
				if stavajici[j] > 0 || r.obvody[j] == 0 {
					continue
				}
				jistota, duvod := 0.97, fmt.Sprintf("z měr %s", r.puvodni)
				if r.palce {
					jistota = 0.9
					duvod = fmt.Sprintf("z měr %s (palce): %d″ = %d cm", r.puvodni, r.vPalcich[j], r.obvody[j])
				}
				pridat(m, nil, o.pole, strconv.Itoa(r.obvody[j]), duvod, "miry", jistota)
			}
			if r.kosicek != "" && strings.TrimSpace(m.VelikostPrsou) == "" {
				tvar := tvarUS
				if r.pasmo >= 55 {
					tvar = tvarEU
				}
				hodnota, jistota := strconv.Itoa(r.pasmo)+r.kosicek, 0.95
				duvod := fmt.Sprintf("z měr %s", r.puvodni)
				switch {
				case tvarSbirky == tvarKosicek:
					hodnota = r.kosicek
					duvod += " (sbírka píše jen košíček)"
				case tvarSbirky == tvarEU && tvar == tvarUS:
					if hodnota = velikostEU(r.pasmo, r.kosicek); hodnota == "" {
						continue
					}
					jistota = 0.8
					duvod += fmt.Sprintf(" převedeno na evropskou velikost jako ve sbírce (%d%s → %s)", r.pasmo, r.kosicek, hodnota)
				case tvarSbirky == tvarUS && tvar == tvarEU:
					continue // převod z evropské velikosti na americkou není jednoznačný
				}
				pridat(m, nil, "velikostPrsou", hodnota, duvod, "miry", jistota)
			}
			continue
		}
		// Odhad regresí z ostatních údajů postavy
		u := udaje[i]
		for j, o := range obvodyNavrhu {
			if stavajici[j] > 0 {
				continue
			}
			maska := 0
			for _, p := range []int{prVyska, prVaha, prHrudnik, prPas, prBoky} {
				if p != o.j && u.ma[p] {
					maska |= 1 << p
				}
			}
			if bitu(maska) < 2 {
				continue
			}
			klic := [2]int{o.j, maska}
			reg, ok := odhady[klic]
			if !ok {
				reg = naucitRegresi(udaje, o.j, maska)
				odhady[klic] = reg
			}
			if reg == nil || reg.trefa2 < prahOdhadu {
				continue
			}
			odhad := reg.odhad(u.x)
			if p := priznaky[o.j]; float64(odhad) < p.mezOd || float64(odhad) > p.mezDo {
				continue
			}
			var zCeho []string
			for _, p := range reg.prediktory {
				zCeho = append(zCeho, priznaky[p].nazev+" "+priznaky[p].hodnota(u.x[p]))
			}
			duvod := fmt.Sprintf("odhad z údajů %s podle %d modelek sbírky (přesně ±1 cm u %d %%, ±2 cm u %d %% z nich)",
				strings.Join(zCeho, ", "), reg.n, int(math.Round(reg.trefa1*100)), int(math.Round(reg.trefa2*100)))
			pridat(m, nil, o.pole, strconv.Itoa(odhad), duvod, zdrojOdhadu, min(stropOdhadu, reg.trefa1))
		}
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func bitu(x int) int {
	n := 0
	for ; x > 0; x >>= 1 {
		n += x & 1
	}
	return n
}

// Lineární regrese obvodu na jiné údaje postavy. Robustní: po prvním odhadu se vynechají modelky s reziduem
// nad 3 robustní σ (překlepy) a odhad se zopakuje. Úspěšnost se měří poctivě vynecháním jedné modelky
// (leave-one-out přes diagonálu projekční matice): podíl modelek, u nichž by zaokrouhlený odhad bez nich samých
// trefil skutečnou hodnotu do ±1 a do ±2 cm.
type regreseObvodu struct {
	prediktory     []int
	prumerX        []float64
	prumerY        float64
	beta           []float64
	n              int
	trefa1, trefa2 float64
}

func (r *regreseObvodu) odhad(x [pocetPriznaku]float64) int {
	y := r.prumerY
	for a, p := range r.prediktory {
		y += r.beta[a] * (x[p] - r.prumerX[a])
	}
	return int(math.Round(y))
}

func naucitRegresi(udaje []udajePostavy, cil, maska int) *regreseObvodu {
	var prediktory []int
	for p := range pocetPriznaku {
		if maska&(1<<p) != 0 {
			prediktory = append(prediktory, p)
		}
	}
	d := len(prediktory)
	var radky []int
	for i, u := range udaje {
		ok := u.ma[cil]
		for _, p := range prediktory {
			ok = ok && u.ma[p]
		}
		if ok {
			radky = append(radky, i)
		}
	}
	if len(radky) < minModelekOdhadu {
		return nil
	}
	odhadnout := func(vybrane []int) (*regreseObvodu, [][]float64) {
		r := &regreseObvodu{prediktory: prediktory, prumerX: make([]float64, d), beta: make([]float64, d), n: len(vybrane)}
		for _, i := range vybrane {
			r.prumerY += udaje[i].x[cil]
			for a, p := range prediktory {
				r.prumerX[a] += udaje[i].x[p]
			}
		}
		r.prumerY /= float64(len(vybrane))
		for a := range prediktory {
			r.prumerX[a] /= float64(len(vybrane))
		}
		s := make([][]float64, d)
		b := make([]float64, d)
		for a := range s {
			s[a] = make([]float64, d)
		}
		for _, i := range vybrane {
			for a, p := range prediktory {
				xa := udaje[i].x[p] - r.prumerX[a]
				b[a] += xa * (udaje[i].x[cil] - r.prumerY)
				for c, q := range prediktory {
					s[a][c] += xa * (udaje[i].x[q] - r.prumerX[c])
				}
			}
		}
		inv := invertovatCholesky(s)
		if inv == nil {
			return nil, nil
		}
		for a := range d {
			for c := range d {
				r.beta[a] += inv[a][c] * b[c]
			}
		}
		return r, inv
	}
	r, _ := odhadnout(radky)
	if r == nil {
		return nil
	}
	rezidua := make([]float64, len(radky))
	for k, i := range radky {
		rezidua[k] = udaje[i].x[cil] - r.odhadPresny(udaje[i].x)
	}
	absolutni := make([]float64, len(rezidua))
	for k, e := range rezidua {
		absolutni[k] = math.Abs(e)
	}
	sort.Float64s(absolutni)
	mez := max(1, 3*1.4826*kvantil(absolutni, 0.5))
	var vnitrni []int
	vnejsi := map[int]bool{}
	for k, i := range radky {
		if math.Abs(rezidua[k]) <= mez {
			vnitrni = append(vnitrni, i)
		} else {
			vnejsi[i] = true
		}
	}
	if len(vnitrni) < minModelekOdhadu {
		return nil
	}
	r, inv := odhadnout(vnitrni)
	if r == nil {
		return nil
	}
	trefa1, trefa2 := 0, 0
	for _, i := range radky {
		y := udaje[i].x[cil]
		odhad := r.odhadPresny(udaje[i].x)
		if !vnejsi[i] {
			// Odhad bez modelky samé: y − e/(1 − h), h = 1/n + x̃ᵀ(X̃ᵀX̃)⁻¹x̃
			h := 1 / float64(len(vnitrni))
			for a, p := range prediktory {
				for c, q := range prediktory {
					h += (udaje[i].x[p] - r.prumerX[a]) * inv[a][c] * (udaje[i].x[q] - r.prumerX[c])
				}
			}
			if h < 1 {
				odhad = y - (y-odhad)/(1-h)
			}
		}
		chyba := math.Abs(y - math.Round(odhad))
		if chyba <= 1 {
			trefa1++
		}
		if chyba <= 2 {
			trefa2++
		}
	}
	r.trefa1, r.trefa2 = float64(trefa1)/float64(len(radky)), float64(trefa2)/float64(len(radky))
	r.n = len(radky)
	return r
}

func (r *regreseObvodu) odhadPresny(x [pocetPriznaku]float64) float64 {
	y := r.prumerY
	for a, p := range r.prediktory {
		y += r.beta[a] * (x[p] - r.prumerX[a])
	}
	return y
}

// ---------------------------------------------------------------------------------------------------------
// Kategorie Playmate roku

var vzorPlaymateRokuTextu = regexp.MustCompile(`\b(?:playmate\s+(?:of\s+the\s+year|roku)|pmoy)\s*[:\-–]?\s*((?:19|20)\d{2})\b|\b((?:19|20)\d{2})\s+playmate\s+of\s+the\s+year\b`)

// Kategorie Playmate roku už je zapsaná (v jakémkoli tvaru, který rozhraní pozná)
func maPlaymateRoku(role string) bool {
	r := klicTextu(role)
	return strings.Contains(r, "playmate roku") || strings.Contains(r, "playmate of the year") || strings.Contains(r, "pmoy")
}

// Playmate roku z poznámky, tagů, vystoupení nebo názvu alba („Playmate of the Year 1998“), když kategorie
// zapsaná není. Rok musí sedět k prvnímu centerfoldu (stejně jako kontrola ok-pmoy); bez centerfoldu nižší jistota.
func navrhnoutPlaymateRoku(modelky []Modelka, alba []albumNavrhu, pridat pridatKandidata) {
	nazvyAlb := map[int][]string{}
	for _, al := range alba {
		nazvyAlb[al.modelkaID] = append(nazvyAlb[al.modelkaID], al.nazev)
	}
	for _, m := range modelky {
		if maPlaymateRoku(m.Role) || neniKNavrhu(m, "role") {
			continue
		}
		roky := map[int]string{}
		for _, zdroj := range []struct{ nazev, text string }{
			{"poznámka", m.Poznamka}, {"tagy", m.Tags}, {"vystoupení", m.Vystoupeni}, {"album", strings.Join(nazvyAlb[m.ID], "\n")},
		} {
			for _, s := range vzorPlaymateRokuTextu.FindAllStringSubmatch(zjednodusit(zdroj.text), -1) {
				rok, _ := strconv.Atoi(s[1] + s[2])
				if _, ma := roky[rok]; !ma {
					roky[rok] = zdroj.nazev
				}
			}
		}
		if len(roky) != 1 {
			continue // žádný, nebo více různých roků
		}
		for rok, zdroj := range roky {
			prvni := 0
			for _, v := range m.Centerfoldy {
				if r, _, _, ok := castiVydani(v); ok && (prvni == 0 || r < prvni) {
					prvni = r
				}
			}
			jistota, duvod := 0.92, fmt.Sprintf("%s uvádí Playmate roku %d", zdroj, rok)
			switch {
			case prvni == 0:
				jistota = 0.75
				duvod += " (centerfold ve sbírce není)"
			case rok < prvni || rok > prvni+3:
				continue
			default:
				duvod += fmt.Sprintf(", první centerfold %d", prvni)
			}
			pridat(m, nil, "role", fmt.Sprintf("Playmate roku %d", rok), duvod, "text", jistota)
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Alba: vydání, datum nafocení a fotograf

// Názvy měsíců (zjednodušené, česky i anglicky, i v 2. pádě) → číslo měsíce
var mesiceNazvu = map[string]int{
	"leden": 1, "ledna": 1, "january": 1, "jan": 1, "unor": 2, "unora": 2, "february": 2, "feb": 2,
	"brezen": 3, "brezna": 3, "march": 3, "mar": 3, "duben": 4, "dubna": 4, "april": 4, "apr": 4,
	"kveten": 5, "kvetna": 5, "may": 5, "cerven": 6, "cervna": 6, "june": 6, "jun": 6,
	"cervenec": 7, "cervence": 7, "july": 7, "jul": 7, "srpen": 8, "srpna": 8, "august": 8, "aug": 8,
	"zari": 9, "september": 9, "sep": 9, "sept": 9, "rijen": 10, "rijna": 10, "october": 10, "oct": 10,
	"listopad": 11, "listopadu": 11, "november": 11, "nov": 11, "prosinec": 12, "prosince": 12, "december": 12, "dec": 12,
}

var (
	vzorMesicu = func() string {
		var n []string
		for k := range mesiceNazvu {
			n = append(n, k)
		}
		// Delší první (cervenec před cerven)
		sort.Slice(n, func(i, j int) bool { return len(n[i]) > len(n[j]) || len(n[i]) == len(n[j]) && n[i] < n[j] })
		return strings.Join(n, "|")
	}()
	vzoryDat = []struct {
		vzor            *regexp.Regexp
		rok, mesic, den int // index skupiny; mesic < 0 = název měsíce ve skupině -mesic
		presnost        int // 1 = rok, 2 = měsíc, 3 = den
	}{
		{regexp.MustCompile(`\b(\d{4})-(\d{1,2})-(\d{1,2})\b`), 1, 2, 3, 3},
		{regexp.MustCompile(`\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b`), 3, 2, 1, 3},
		{regexp.MustCompile(`\b(\d{1,2})\.?\s+(` + vzorMesicu + `)\.?\s+(\d{4})\b`), 3, -2, 1, 3},
		{regexp.MustCompile(`\b(` + vzorMesicu + `)\.?\s+(\d{1,2}),?\s+(\d{4})\b`), 3, -1, 2, 3},
		{regexp.MustCompile(`\b(\d{4})[-/.](\d{1,2})\b`), 1, 2, 0, 2},
		{regexp.MustCompile(`\b(\d{1,2})[-/.](\d{4})\b`), 2, 1, 0, 2},
		{regexp.MustCompile(`\b(` + vzorMesicu + `)\.?\s+(\d{4})\b`), 2, -1, 0, 2},
		{regexp.MustCompile(`\b((?:19|20)\d{2})\b`), 1, 0, 0, 1},
	}
	vzorRoku = regexp.MustCompile(`\b(?:19|20)\d{2}\b`)
	vzorCZ   = regexp.MustCompile(`\bcz\b`)
)

// Datum z názvu alba ve tvaru RRRR, RRRR-MM nebo RRRR-MM-DD a jeho přesnost (1 rok, 2 měsíc, 3 den);
// ok = false, když název datum nemá nebo jich má víc různých
func datumZNazvu(nazev string, letos int) (datum string, presnost int, ok bool) {
	text := zjednodusit(nazev)
	for _, v := range vzoryDat {
		s := v.vzor.FindStringSubmatch(text)
		if s == nil {
			continue
		}
		rok, _ := strconv.Atoi(s[v.rok])
		mesic, den := 0, 0
		switch {
		case v.mesic > 0:
			mesic, _ = strconv.Atoi(s[v.mesic])
		case v.mesic < 0:
			mesic = mesiceNazvu[s[-v.mesic]]
		}
		if v.den > 0 {
			den, _ = strconv.Atoi(s[v.den])
		}
		if rok < prvniRokCasopisu || rok > letos || v.presnost >= 2 && (mesic < 1 || mesic > 12) {
			return "", 0, false
		}
		// Všechny roky v názvu musí být tentýž (jinak nejde poznat, který platí)
		for _, r := range vzorRoku.FindAllString(text, -1) {
			if r != strconv.Itoa(rok) {
				return "", 0, false
			}
		}
		switch v.presnost {
		case 3:
			datum = fmt.Sprintf("%04d-%02d-%02d", rok, mesic, den)
			if _, err := time.Parse("2006-01-02", datum); err != nil {
				return "", 0, false
			}
		case 2:
			datum = fmt.Sprintf("%04d-%02d", rok, mesic)
		default:
			datum = strconv.Itoa(rok)
		}
		return datum, v.presnost, true
	}
	return "", 0, false
}

// Úspěšnost pravidla na sbírce
type uspesnost struct{ k, n int }

func (u *uspesnost) zapocitat(shoda bool) {
	u.n++
	if shoda {
		u.k++
	}
}

func (u uspesnost) jistota(predpoklad, vaha float64) float64 {
	return podilSPredpokladem(u.k, u.n, predpoklad, vaha)
}

// Text úspěšnosti do důvodu
func (u uspesnost) text(co string) string {
	if u.n == 0 {
		return ""
	}
	return fmt.Sprintf("; ve sbírce sedí u %d z %d %s", u.k, u.n, co)
}

// Pictorial časopisu (ne online, centerfold ani cover), u kterého se vydání sleduje
func jePictorialCisla(al albumNavrhu) bool { return al.typ == "Pictorial" }

// Vydání pictorialu z názvu alba nebo z čísla jediného centerfoldu modelky (pictorial playmate vychází
// v čísle s jejím centerfoldem), datum online alba z názvu a fotograf z jiných alb téhož čísla nebo modelky.
// Každé pravidlo se nejdřív vyzkouší na albech, která údaj mají, a z toho se spočítá jeho jistota.
func navrhnoutAlba(modelky []Modelka, alba []albumNavrhu, letos int, pridat pridatKandidata) {
	podleModelky := map[int][]int{}
	for i, al := range alba {
		podleModelky[al.modelkaID] = append(podleModelky[al.modelkaID], i)
	}
	vydaniZNazvu := func(al albumNavrhu) (string, bool) {
		d, presnost, ok := datumZNazvu(al.nazev, letos)
		if !ok || presnost < 2 {
			return "", false
		}
		v := d[:7]
		if vzorCZ.MatchString(zjednodusit(al.nazev)) {
			v += "-CZ"
		}
		return v, true
	}
	// Jediný měsíční centerfold modelky (vydání), jinak ""
	centerfold := func(m Modelka) string {
		jediny := ""
		for _, v := range m.Centerfoldy {
			if !vzorVydani.MatchString(v) || jeSpecial(v) {
				continue
			}
			if jediny != "" && jediny != v {
				return ""
			}
			jediny = v
		}
		return jediny
	}
	// Vydání alba pro porovnání (centerfold má vydání v názvu)
	vydaniAlba := func(al albumNavrhu) string {
		if al.typ == "Centerfold" && al.vydani == "" {
			return al.nazev
		}
		return al.vydani
	}
	// Fotograf z ostatních alb: všechna, která ho mají, se shodují; vrací zápis a počet alb
	jednotnyFotograf := func(indexy []int, krome int, podminka func(albumNavrhu) bool) (string, int) {
		fotograf, pocet := "", 0
		for _, j := range indexy {
			al := alba[j]
			if j == krome || al.fotograf == "" || !podminka(al) {
				continue
			}
			if fotograf != "" && klicTextu(fotograf) != klicTextu(al.fotograf) {
				return "", 0
			}
			fotograf = al.fotograf
			pocet++
		}
		return fotograf, pocet
	}

	// Ověření pravidel na albech, která údaj mají
	var zNazvu, sCenterfoldem, datumOnline, fotografCisla, fotografModelky uspesnost
	podleID := map[int]Modelka{}
	for _, m := range modelky {
		podleID[m.ID] = m
	}
	for i, al := range alba {
		m := podleID[al.modelkaID]
		switch {
		case jePictorialCisla(al) && al.vydani != "":
			if v, ok := vydaniZNazvu(al); ok {
				zNazvu.zapocitat(v == al.vydani)
			}
			if c := centerfold(m); c != "" {
				jiny := false
				for _, j := range podleModelky[al.modelkaID] {
					jiny = jiny || j != i && jePictorialCisla(alba[j]) && alba[j].vydani == c
				}
				if !jiny {
					sCenterfoldem.zapocitat(al.vydani == c)
				}
			}
		case jeOnlineTyp(al.typ) && al.datum != "":
			if d, _, ok := datumZNazvu(al.nazev, letos); ok {
				datumOnline.zapocitat(strings.HasPrefix(al.datum, d))
			}
		}
		if al.fotograf != "" {
			if v := vydaniAlba(al); v != "" {
				if f, n := jednotnyFotograf(podleModelky[al.modelkaID], i, func(j albumNavrhu) bool { return vydaniAlba(j) == v }); n > 0 {
					fotografCisla.zapocitat(klicTextu(f) == klicTextu(al.fotograf))
				}
			}
			if f, n := jednotnyFotograf(podleModelky[al.modelkaID], i, func(albumNavrhu) bool { return true }); n >= 2 {
				fotografModelky.zapocitat(klicTextu(f) == klicTextu(al.fotograf))
			}
		}
	}
	// Zápis fotografa, jak ho píše většina sbírky
	zapisyFotografu := pravopis{}
	for _, al := range alba {
		if al.fotograf != "" {
			zapisyFotografu.pridat(klicTextu(al.fotograf), al.fotograf)
		}
	}

	for _, m := range modelky {
		indexy := podleModelky[m.ID]
		c := centerfold(m)
		bezVydani := 0
		maPictorialCenterfoldu := false
		for _, j := range indexy {
			if al := alba[j]; jePictorialCisla(al) {
				if al.vydani == "" && !obsahujeKlic(al.neni, "vydani") {
					bezVydani++
				}
				maPictorialCenterfoldu = maPictorialCenterfoldu || c != "" && al.vydani == c
			}
		}
		for _, j := range indexy {
			al := &alba[j]
			if jePictorialCisla(*al) && al.vydani == "" && !obsahujeKlic(al.neni, "vydani") {
				if v, ok := vydaniZNazvu(*al); ok {
					pridat(m, al, "vydaniAlba", v, fmt.Sprintf("název alba „%s“ obsahuje datum%s", al.nazev, zNazvu.text("pictorialů s datem v názvu")),
						"nazev", zNazvu.jistota(0.85, 6))
				} else if c != "" && bezVydani == 1 && !maPictorialCenterfoldu {
					// Rok v názvu, který k centerfoldu nesedí, pravidlo vylučuje
					if r := vzorRoku.FindString(zjednodusit(al.nazev)); r == "" || r == c[:4] {
						pridat(m, al, "vydaniAlba", c, fmt.Sprintf("pictorial playmate vychází v čísle jejího centerfoldu (%s)%s", c, sCenterfoldem.text("playmate s jedním centerfoldem")),
							"centerfold", sCenterfoldem.jistota(0.75, 4))
					}
				}
			}
			if jeOnlineTyp(al.typ) && al.datum == "" {
				if d, presnost, ok := datumZNazvu(al.nazev, letos); ok {
					predpoklad := 0.85
					if presnost == 1 {
						predpoklad = 0.6
					}
					pridat(m, al, "datumAlba", d, fmt.Sprintf("název alba „%s“ obsahuje datum%s", al.nazev, datumOnline.text("online alb s datem v názvu")),
						"nazev", datumOnline.jistota(predpoklad, 6))
				}
			}
			if al.fotograf == "" && al.typ != "Cover" {
				if v := vydaniAlba(*al); v != "" {
					if f, n := jednotnyFotograf(indexy, j, func(x albumNavrhu) bool { return vydaniAlba(x) == v }); n > 0 {
						f = zapisyFotografu.zapis(klicTextu(f))
						pridat(m, al, "fotografAlba", f, fmt.Sprintf("fotograf jejího alba ze stejného čísla %s%s", v, fotografCisla.text("alb modelek ze stejného čísla")),
							"cislo", fotografCisla.jistota(0.8, 4))
						continue
					}
				}
				if f, n := jednotnyFotograf(indexy, j, func(albumNavrhu) bool { return true }); n >= 2 {
					f = zapisyFotografu.zapis(klicTextu(f))
					pridat(m, al, "fotografAlba", f, fmt.Sprintf("všechna její ostatní alba s fotografem (%d) nafotil %s%s", n, f, fotografModelky.text("alb modelek s jednotným fotografem")),
						"modelka", fotografModelky.jistota(0.5, 2))
				}
			}
		}
	}
}
