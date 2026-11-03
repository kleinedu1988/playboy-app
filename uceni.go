package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	ucenibal "playboy-app/internal/uceni"
)

// Databáze učení: vlastní soubor SQLite vedle sbírky (playboy.db → playboy-ucenibal.db). Pamatuje si, co se
// strojové učení dozvědělo z rozhodnutí uživatele, a mezipaměť naučených výsledků (celkový popis v docs/UCENI.md).
// Nízkoúrovňová správa schématu, přenos do paměti, FNV-64a otisk a kalibrace zdrojů jsou v balíčku internal/ucenibal.

var (
	migraceUceni     = ucenibal.MigraceUceni
	tabulkyUceni     = ucenibal.TabulkyUceni
	tabulkyPorovnani = ucenibal.TabulkyPorovnani
)

const (
	udalostPrijato       = ucenibal.UdalostPrijato
	udalostOdmitnuto     = ucenibal.UdalostOdmitnuto
	udalostZpet          = ucenibal.UdalostZpet
	udalostOpraveno      = ucenibal.UdalostOpraveno
	udalostVPoradku      = ucenibal.UdalostVPoradku
	udalostZnovu         = ucenibal.UdalostZnovu
	udalostNalezOpraveny = ucenibal.UdalostNalezOpraveny

	verzeModeluUceni       = ucenibal.VerzeModeluUceni
	predponaOtiskuKontroly = ucenibal.PredponaOtiskuKontroly

	vahaKalibrace     = ucenibal.VahaKalibrace
	polocasZapomneni  = ucenibal.PolocasZapomneni
	vahaPredpokladuOk = ucenibal.VahaPredpokladuOk
	pocetZalohUceni   = ucenibal.PocetZalohUceni
)

type (
	kalibraceZdroje = ucenibal.KalibraceZdroje
	udalostUceni    = ucenibal.UdalostUceni
	otiskovac       = ucenibal.Otiskovac
	StavUceni       = ucenibal.StavUceni
	ZdrojUceni      = ucenibal.ZdrojUceni
)

// Parametry připojení (testy je mohou změnit, např. na soubor jen pro čtení: předpona „file:“ a mode=ro)
// synchronous NORMAL: při výpadku proudu se může ztratit poslední zápis, ne poškodit soubor; učení není sbírka
var predponaUceni, dsnUceni = "", "?_pragma=busy_timeout(3000)&_pragma=synchronous(NORMAL)"

// Stav databáze učení jedné aplikace (sdílí ho i kopie App při exportu; App importu ho nemá)
type uceni struct {
	mu          sync.Mutex
	cestaSbirky string // soubor sbírky; prázdný = sbírka v paměti, učení také
	otevreno    bool
	db          *sql.DB
	cesta       string // soubor databáze učení; prázdný = jen v paměti
	generace    int64  // poslední událost deníku: mění se s každým zápisem, je součástí otisku mezipaměti

	vstup         *vstupUceni // naučené pro návrhy (podle generace)
	vstupGenerace int64
	prahy         *prahyKontroly
	statistiky    map[string]*kalibraceZdroje // i s počty pro přehled

	navrhy      pametVysledku[[]navrhSbirky]
	nalezy      pametVysledku[ulozeneNalezy]
	posledniNav map[string]navrhSbirky   // poslední návrhy podle klíče (pro zpětnou vazbu)
	posledniNal map[string]PodezrelyUdaj // poslední nálezy podle klíče
	ukladani    sync.WaitGroup           // zápisy mezipaměti na pozadí
	// Po obnovení sbírky ze zálohy se zmizelé nálezy nepočítají jako opravené (data vrátila záloha, ne uživatel)
	bezPorovnani bool
	zavreno      bool // po zavření programu se už nic nezapisuje ani neotevírá

	// Výpočet návrhů a nálezů jen jeden najednou: Přehled volá GetPrehled, GetNavrhyDoplneni a GetStavUceni
	// souběžně a po změně dat by každé volání počítalo totéž znovu (a kontrola by opravu zapsala dvakrát).
	// Pořadí zámků: vypocet… vždy před mu.
	vypocetNavrhu, vypocetNalezu sync.Mutex

	// Porovnání dvojic a model oblíbenosti (oblibenost.go)
	ob oblibenostUceni
}

type pametVysledku[T any] struct {
	otisk string
	data  T
	ma    bool
}

// Nálezy v mezipaměti s otisky modelek, u kterých byly (pro poznání opravy údaje)
type ulozeneNalezy struct {
	Nalezy  []PodezrelyUdaj   `json:"nalezy"`
	Modelky map[string]string `json:"modelky"` // ID modelky → otisk jejích údajů
}

func souborUceni(cestaSbirky string) string { return ucenibal.SouborUceni(cestaSbirky) }

func varovatUceni(format string, args ...any) {
	fmt.Printf("Varování (databáze učení): "+format+"\n", args...)
}

// Otevření při prvním použití; volá se se zámkem. Vrací nil jen bez databáze učení vůbec (App importu).
func (u *uceni) zajistit() *sql.DB {
	if u.otevreno || u.zavreno {
		return u.db
	}
	u.otevreno = true
	if u.cestaSbirky == "" {
		u.db = ucenibal.OtevritUceniVPameti(nil, migraceUceni)
		return u.db
	}
	cesta := souborUceni(u.cestaSbirky)
	db, err := ucenibal.OtevritSouborUceni(cesta, predponaUceni, dsnUceni, migraceUceni, kontrolaSouboru, ted())
	if err == nil {
		u.db, u.cesta = db, cesta
		u.nacistGeneraci()
		return u.db
	}
	switch e := err.(type) {
	case ucenibal.ChybaUceni:
		if e.Poskozena {
			// Poškozený soubor se odloží (ne smaže) a začne se znovu
			odlozena := fmt.Sprintf("%s.poskozena-%s", cesta, time.Now().Format("20060102-150405"))
			if os.Rename(cesta, odlozena) == nil {
				varovatUceni("soubor %s je poškozený (%v), odložen jako %s, učení začíná znovu", cesta, e.Err, odlozena)
				if db, err := ucenibal.OtevritSouborUceni(cesta, predponaUceni, dsnUceni, migraceUceni, kontrolaSouboru, ted()); err == nil {
					u.db, u.cesta = db, cesta
					u.nacistGeneraci()
					return u.db
				}
			}
		}
		varovatUceni("soubor %s nejde použít (%v), učení běží jen v paměti", cesta, e.Err)
		if e.Prenest {
			u.db = ucenibal.OtevritUceniVPameti(e.Zdroj, migraceUceni)
		}
		if e.Zdroj != nil {
			e.Zdroj.Close()
		}
	default:
		varovatUceni("soubor %s nejde otevřít (%v), učení běží jen v paměti", cesta, err)
	}
	if u.db == nil {
		u.db = ucenibal.OtevritUceniVPameti(nil, migraceUceni)
	}
	u.nacistGeneraci()
	return u.db
}

func (u *uceni) nacistGeneraci() {
	if u.db != nil {
		u.db.QueryRow("SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'udalosti'), 0)").Scan(&u.generace)
	}
}

// Zápis události do deníku (bez databáze učení nic)
func (u *uceni) zapsat(druh string, modelka int, album, typ, pole, navrh, hodnota, zdroj string, jistota, vzorec float64) {
	if u == nil {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return
	}
	vysledek, err := db.Exec(`INSERT INTO udalosti (cas, druh, modelka_id, album, typ, pole, navrh, hodnota, zdroj, jistota, jistota_vzorce)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ted(), druh, modelka, album, typ, pole, navrh, hodnota, zdroj, jistota, vzorec)
	if err != nil {
		varovatUceni("událost se nezapsala: %v", err)
		return
	}
	if id, err := vysledek.LastInsertId(); err == nil {
		u.generace = id
	}
	u.vstup, u.prahy, u.statistiky = nil, nil, nil
}

// ---------------------------------------------------------------------------------------------------------
// Zpětná vazba z návrhů a kontroly

// Klíč návrhu pro dohledání zdroje a jistoty (modelka, album, typ, údaj, hodnota)
func klicNavrhuUceni(modelka int, album, typ, pole, hodnota string) string {
	return strconv.Itoa(modelka) + "\x00" + album + "\x00" + typ + "\x00" + pole + "\x00" + klicHodnoty(pole, hodnota)
}

// Událost návrhu se zdroji a jistotou z posledního výpočtu
func (a *App) zaznamenatNavrh(druh string, n NavrhDoplneni, vysledna string) {
	u := a.uc
	if u == nil {
		return
	}
	zdroj, jistota, vzorec := n.Zdroj, n.Jistota, n.Jistota
	u.mu.Lock()
	if p, ok := u.posledniNav[klicNavrhuUceni(n.ModelkaID, n.Album, n.Typ, n.Pole, n.Hodnota)]; ok {
		zdroj, jistota, vzorec = strings.Join(p.Zdroje, "+"), p.Jistota, p.JistotaVzorce
	}
	u.mu.Unlock()
	u.zapsat(druh, n.ModelkaID, n.Album, n.Typ, n.Pole, strings.TrimSpace(n.Hodnota), strings.TrimSpace(vysledna), zdroj, omezitJistotu(jistota), omezitJistotu(vzorec))
}

func omezitJistotu(p float64) float64 { return ucenibal.OmezitJistotu(p) }

// Odmítnutí (nebo jeho zrušení) jedné hodnoty údaje; klic "" = celý údaj (uloží se jako „*“).
func (u *uceni) odmitnoutHodnotu(ku klicUdaje, klic, hodnota string, odmitnout bool) int {
	if u == nil {
		return 0
	}
	if klic == "" {
		klic = "*"
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return 0
	}
	var err error
	switch {
	case odmitnout:
		_, err = db.Exec(`INSERT OR REPLACE INTO odmitnute (modelka_id, album, typ, pole, klic, hodnota, cas) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			ku.modelka, ku.album, ku.typ, ku.pole, klic, hodnota, ted())
	case klic == "*":
		_, err = db.Exec(`DELETE FROM odmitnute WHERE modelka_id = ? AND album = ? AND typ = ? AND pole = ?`, ku.modelka, ku.album, ku.typ, ku.pole)
	default:
		_, err = db.Exec(`DELETE FROM odmitnute WHERE modelka_id = ? AND album = ? AND typ = ? AND pole = ? AND klic IN (?, '*')`,
			ku.modelka, ku.album, ku.typ, ku.pole, klic)
	}
	if err != nil {
		varovatUceni("odmítnutí se nezapsalo: %v", err)
	}
	u.vstup = nil
	zbyva := 0
	db.QueryRow(`SELECT COUNT(*) FROM odmitnute WHERE modelka_id = ? AND album = ? AND typ = ? AND pole = ?`, ku.modelka, ku.album, ku.typ, ku.pole).Scan(&zbyva)
	return zbyva
}

// „V pořádku“ (netyka) nebo „Znovu kontrolovat“ u nálezu kontroly; zdroj a popis z posledního výpočtu
func (a *App) zaznamenatNalez(modelka int, album, typ, klic string, netyka bool) {
	u := a.uc
	if u == nil {
		return
	}
	druh := udalostVPoradku
	if !netyka {
		druh = udalostZnovu
	}
	u.mu.Lock()
	n := u.posledniNal[klicNalezu(modelka, album, typ, klic)]
	u.mu.Unlock()
	u.zapsat(druh, modelka, album, typ, klic, n.Popis, "", n.Zdroj, 0, 0)
}

func klicNalezu(modelka int, album, typ, klic string) string {
	return strconv.Itoa(modelka) + "\x00" + album + "\x00" + typ + "\x00" + klic
}

// Oprava navržené hodnoty před uložením (rozhraní volá, když uživatel návrh v poli upravil).
func (a *App) ZaznamenatOpravu(modelkaID int, pole, puvodniNavrh, novaHodnota string) bool {
	u, ok := udajeNavrhu[pole]
	puvodniNavrh, novaHodnota = strings.TrimSpace(puvodniNavrh), strings.TrimSpace(novaHodnota)
	if !ok || a.uc == nil || puvodniNavrh == "" || novaHodnota == "" {
		return false
	}
	n := NavrhDoplneni{ModelkaID: modelkaID, Pole: pole, Hodnota: puvodniNavrh}
	klicPuvodni := klicHodnoty(pole, puvodniNavrh)
	// Návrh alba: album se dohledá v posledních návrzích
	a.uc.mu.Lock()
	for _, p := range a.uc.posledniNav {
		if p.ModelkaID == modelkaID && p.Pole == pole && klicHodnoty(pole, p.Hodnota) == klicPuvodni {
			n = p.NavrhDoplneni
			break
		}
	}
	a.uc.mu.Unlock()
	if puvodniNavrh == novaHodnota {
		a.zaznamenatNavrh(udalostPrijato, n, novaHodnota)
		return true
	}
	if !u.cislo && jenZapis(pole, puvodniNavrh, novaHodnota) {
		a.uc.zapamatovatZapis(pole, klicPuvodni, novaHodnota)
	}
	a.zaznamenatNavrh(udalostOpraveno, n, novaHodnota)
	return true
}

// Dva zápisy téže hodnoty („USA“ a „Americká“, „Arny Freytag“ a „Arnie Freytag“)
func jenZapis(pole, a, b string) bool {
	if klicHodnoty(pole, a) == klicHodnoty(pole, b) {
		return true
	}
	znakyA := []rune(klicTextu(a))
	return len(znakyA) >= minDelkaSlouceni && jaroWinklerZnaku(znakyA, []rune(klicTextu(b))) >= 0.92
}

func (u *uceni) zapamatovatZapis(pole, klic, zapis string) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if db := u.zajistit(); db != nil {
		if _, err := db.Exec(`INSERT INTO zapisy (pole, klic, zapis) VALUES (?, ?, ?)
			ON CONFLICT(pole, klic, zapis) DO UPDATE SET pocet = pocet + 1`, pole, klic, zapis); err != nil {
			varovatUceni("zápis se neuložil: %v", err)
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Kalibrace zdrojů návrhů

func (u *uceni) nacistUdalosti(druhy ...string) []udalostUceni {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	otazniky := strings.TrimSuffix(strings.Repeat("?, ", len(druhy)), ", ")
	args := make([]any, len(druhy))
	for i, d := range druhy {
		args[i] = d
	}
	radky, err := db.Query(`SELECT druh, modelka_id, album, typ, pole, navrh, hodnota, zdroj, jistota_vzorce, cas FROM udalosti
		WHERE druh IN (`+otazniky+`) ORDER BY id`, args...)
	if err != nil {
		return nil
	}
	defer radky.Close()
	var udalosti []udalostUceni
	for radky.Next() {
		var e udalostUceni
		var cas string
		if radky.Scan(&e.Druh, &e.Modelka, &e.Album, &e.Typ, &e.Pole, &e.Navrh, &e.Hodnota, &e.Zdroj, &e.Vzorec, &cas) == nil {
			e.Cas, _ = time.ParseInLocation("2006-01-02 15:04:05", cas, time.Local)
			udalosti = append(udalosti, e)
		}
	}
	return udalosti
}

func vahaStari(cas, ted time.Time) float64 { return ucenibal.VahaStari(cas, ted) }

// Kalibrace všech zdrojů z deníku (volá se se zámkem)
func (u *uceni) spocitatKalibraci() map[string]*kalibraceZdroje {
	type rozhodnuti struct {
		y      float64
		zdroj  string
		vzorec float64
		cas    time.Time
	}
	posledni := map[string]rozhodnuti{}
	var poradi []string
	for _, e := range u.nacistUdalosti(udalostPrijato, udalostOdmitnuto, udalostZpet, udalostOpraveno) {
		klic := klicNavrhuUceni(e.Modelka, e.Album, e.Typ, e.Pole, e.Navrh)
		if _, ok := posledni[klic]; !ok {
			poradi = append(poradi, klic)
		}
		switch e.Druh {
		case udalostZpet:
			delete(posledni, klic)
			continue
		case udalostPrijato:
			posledni[klic] = rozhodnuti{1, e.Zdroj, e.Vzorec, e.Cas}
		case udalostOdmitnuto:
			posledni[klic] = rozhodnuti{0, e.Zdroj, e.Vzorec, e.Cas}
		case udalostOpraveno:
			y := 0.0
			if jenZapis(e.Pole, e.Navrh, e.Hodnota) {
				y = 1
			}
			posledni[klic] = rozhodnuti{y, e.Zdroj, e.Vzorec, e.Cas}
		}
	}
	kalibrace := map[string]*kalibraceZdroje{}
	nyni := time.Now()
	for _, klic := range poradi {
		r, ok := posledni[klic]
		if !ok || r.zdroj == "" {
			continue
		}
		w := vahaStari(r.cas, nyni)
		for _, z := range strings.Split(r.zdroj, "+") {
			k := kalibrace[z]
			if k == nil {
				k = &kalibraceZdroje{}
				kalibrace[z] = k
			}
			k.N += w
			k.Prijato += w * r.y
			k.Predpoved += w * r.vzorec
			if r.y > 0 {
				k.Prijatych++
			} else {
				k.Odmitnutych++
			}
		}
	}
	return kalibrace
}

// Naučené pro návrhy a generace, ze které je (bez databáze učení nil)
func (u *uceni) vstupNavrhu() (*vstupUceni, int64) {
	if u == nil {
		return nil, 0
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return nil, 0
	}
	if u.vstup != nil && u.vstupGenerace == u.generace {
		return u.vstup, u.generace
	}
	v := &vstupUceni{odmitnute: map[klicUdaje]map[string]bool{}, kalibrace: map[string]kalibraceZdroje{}, zapisy: map[string]map[string]string{}}
	if radky, err := db.Query("SELECT modelka_id, album, typ, pole, klic FROM odmitnute"); err == nil {
		for radky.Next() {
			var ku klicUdaje
			var klic string
			if radky.Scan(&ku.modelka, &ku.album, &ku.typ, &ku.pole, &klic) == nil {
				if v.odmitnute[ku] == nil {
					v.odmitnute[ku] = map[string]bool{}
				}
				v.odmitnute[ku][klic] = true
			}
		}
		radky.Close()
	}
	// Zápis z oprav: nejčastější u klíče
	if radky, err := db.Query("SELECT pole, klic, zapis FROM zapisy ORDER BY pocet, zapis DESC"); err == nil {
		for radky.Next() {
			var pole, klic, zapis string
			if radky.Scan(&pole, &klic, &zapis) == nil {
				if v.zapisy[pole] == nil {
					v.zapisy[pole] = map[string]string{}
				}
				v.zapisy[pole][klic] = zapis
			}
		}
		radky.Close()
	}
	if u.statistiky == nil {
		u.statistiky = u.spocitatKalibraci()
	}
	for z, k := range u.statistiky {
		v.kalibrace[z] = *k
	}
	u.vstup, u.vstupGenerace = v, u.generace
	return v, u.generace
}

// ---------------------------------------------------------------------------------------------------------
// Prahy kontroly podle zpětné vazby

// Zdroj nálezu → údaje postavy, jejichž rozsah zpřísní
var rozsahyPravidel = map[string][]int{"vyska": {prVyska}, "vaha": {prVaha}, "bmi": {prBmi}, "vek": {prVek},
	"miry": {prHrudnik, prPas, prBoky}}

// Prahy a generace deníku, ze které jsou (pod jedním zámkem)
func (u *uceni) prahyAGenerace() (prahyKontroly, int64) {
	if u == nil {
		return vychoziPrahy(), 0
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.spocitatPrahy(), u.generace
}

// Prahy kontroly z deníku (volá se se zámkem)
func (u *uceni) spocitatPrahy() prahyKontroly {
	p := vychoziPrahy()
	if u.zajistit() == nil {
		return p
	}
	if u.prahy != nil {
		return *u.prahy
	}
	stav := map[string]bool{} // poslední rozhodnutí u nálezu: true = opraveno, false = V pořádku
	zdroje := map[string]string{}
	for _, e := range u.nacistUdalosti(udalostVPoradku, udalostZnovu, udalostNalezOpraveny) {
		klic := klicNalezu(e.Modelka, e.Album, e.Typ, e.Pole) + "\x00" + e.Zdroj
		switch e.Druh {
		case udalostZnovu:
			delete(stav, klic)
		default:
			stav[klic] = e.Druh == udalostNalezOpraveny
			zdroje[klic] = e.Zdroj
		}
	}
	opraveno, planych := map[string]float64{}, map[string]float64{}
	for klic, ok := range stav {
		if ok {
			opraveno[zdroje[klic]]++
		} else {
			planych[zdroje[klic]]++
		}
	}
	zprisneni := func(zdroj string) float64 {
		presnost := (opraveno[zdroj] + 4) / (opraveno[zdroj] + planych[zdroj] + vahaPredpokladuOk)
		return max(0, (0.5-presnost)/0.5)
	}
	for zdroj, udaje := range rozsahyPravidel {
		for _, j := range udaje {
			p.kRozsahu[j] = max(p.kRozsahu[j], kRozsahu+1.5*zprisneni(zdroj))
		}
	}
	p.zKombinace += 0.75 * zprisneni("neobvykle")
	p.prahJmen = min(0.99, p.prahJmen+0.03*zprisneni("podobne-jmeno"))
	u.prahy = &p
	return p
}

// ---------------------------------------------------------------------------------------------------------
// Mezipaměť podle otisku sbírky

func novyOtiskovac() otiskovac            { return ucenibal.NovyOtiskovac() }
func otiskUdajuKontroly(m Modelka) string { return ucenibal.OtiskUdajuKontroly(m) }

func otiskSbirky(druh string, modelky []Modelka, alba []albumSbirky, generace int64) string {
	o := ucenibal.NovyOtiskovac()
	o.Text(verzeModeluUceni, druh, time.Now().Format("2006-01-02"))
	o.Cisla(int(generace))
	for i := range modelky {
		o.Modelka(&modelky[i])
	}
	for _, al := range alba {
		o.Text(al.jmeno, al.nazev, al.typ, al.vydani, al.datum, al.fotograf, al.popis, al.neni)
		o.Cisla(al.modelkaID, al.fotek, al.hodnocenych, int(al.soucetFotek))
	}
	return o.Hex()
}

// Výsledek z mezipaměti v souboru (jen se shodným otiskem); volá se se zámkem
func (u *uceni) nacistMezipamet(druh, otisk string, cil any) bool {
	db := u.zajistit()
	if db == nil {
		return false
	}
	var data []byte
	if db.QueryRow("SELECT data FROM mezipamet WHERE druh = ? AND otisk = ?", druh, otisk).Scan(&data) != nil {
		return false
	}
	return json.Unmarshal(data, cil) == nil
}

// Uložení do mezipaměti v souboru běží na pozadí; volá se se zámkem.
func (u *uceni) ulozitMezipamet(druh, otisk string, data any) {
	u.ukladani.Add(1)
	go func() {
		defer u.ukladani.Done()
		obsah, err := json.Marshal(data)
		if err != nil {
			return
		}
		u.mu.Lock()
		defer u.mu.Unlock()
		db := u.zajistit()
		if db == nil {
			return
		}
		if _, err := db.Exec("INSERT OR REPLACE INTO mezipamet (druh, otisk, data, cas) VALUES (?, ?, ?, ?)", druh, otisk, obsah, ted()); err != nil {
			varovatUceni("mezipaměť se neuložila: %v", err)
		}
	}()
}

// Počká na dokončení zápisů mezipaměti na pozadí
func (u *uceni) pockat() {
	if u != nil {
		u.ukladani.Wait()
	}
}

// Zavření při ukončení programu: počká na zápisy na pozadí a databázi zavře se zámkem
func (u *uceni) zavrit() {
	if u == nil {
		return
	}
	u.pockat()
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.db != nil {
		u.db.Close()
	}
	u.db, u.zavreno = nil, true
}

// Sbírka se vrátila do stavu zálohy: nálezy, které tím zmizely, uživatel neopravil.
func (u *uceni) poObnoveniSbirky() {
	if u == nil {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.nalezy = pametVysledku[ulozeneNalezy]{}
	u.bezPorovnani = true
}

// Všechny návrhy sbírky (i odmítnuté) s učením ze zpětné vazby; z mezipaměti, když se sbírka nezměnila
func (a *App) navrhySbirky(modelky []Modelka, alba []albumSbirky) []navrhSbirky {
	u := a.uc
	if u == nil {
		return navrhnout(modelky, albaProNavrhy(alba), time.Now().Year(), nil)
	}
	// Souběžné volání počká na výpočet prvního a vezme si jeho výsledek z mezipaměti
	u.vypocetNavrhu.Lock()
	defer u.vypocetNavrhu.Unlock()
	vstup, generace := u.vstupNavrhu()
	otisk := otiskSbirky("navrhy", modelky, alba, generace)
	u.mu.Lock()
	if !u.navrhy.ma || u.navrhy.otisk != otisk {
		var ulozene []navrhSbirky
		if u.nacistMezipamet("navrhy", otisk, &ulozene) {
			u.navrhy = pametVysledku[[]navrhSbirky]{otisk: otisk, data: ulozene, ma: true}
			u.zapamatovatNavrhy(ulozene)
		}
	}
	if u.navrhy.ma && u.navrhy.otisk == otisk {
		navrhy := u.navrhy.data
		u.mu.Unlock()
		return navrhy
	}
	u.mu.Unlock()

	navrhy := navrhnout(modelky, albaProNavrhy(alba), time.Now().Year(), vstup)
	u.mu.Lock()
	u.navrhy = pametVysledku[[]navrhSbirky]{otisk: otisk, data: navrhy, ma: true}
	u.zapamatovatNavrhy(navrhy)
	u.ulozitMezipamet("navrhy", otisk, navrhy)
	u.mu.Unlock()
	return navrhy
}

func (u *uceni) zapamatovatNavrhy(navrhy []navrhSbirky) {
	u.posledniNav = make(map[string]navrhSbirky, len(navrhy))
	for _, n := range navrhy {
		u.posledniNav[klicNavrhuUceni(n.ModelkaID, n.Album, n.Typ, n.Pole, n.Hodnota)] = n
	}
}

// Všechny nálezy kontroly (i označené „V pořádku“) s prahy podle zpětné vazby; z mezipaměti, když se sbírka nezměnila.
func (a *App) nalezyKontroly(modelky []Modelka, alba []albumSbirky) []PodezrelyUdaj {
	u := a.uc
	if u == nil {
		return a.spocitatNalezy(modelky, alba, vychoziPrahy())
	}
	u.vypocetNalezu.Lock()
	defer u.vypocetNalezu.Unlock()
	prahy, generace := u.prahyAGenerace()
	otisk := otiskSbirky("kontrola", modelky, alba, generace)
	u.mu.Lock()
	predchozi := u.nalezy
	bezPorovnani := u.bezPorovnani
	u.bezPorovnani = false
	if !predchozi.ma && !bezPorovnani {
		var ulozene ulozeneNalezy
		var ulozenyOtisk string
		if db := u.zajistit(); db != nil {
			var data []byte
			if db.QueryRow("SELECT otisk, data FROM mezipamet WHERE druh = 'kontrola'").Scan(&ulozenyOtisk, &data) == nil && json.Unmarshal(data, &ulozene) == nil {
				predchozi = pametVysledku[ulozeneNalezy]{otisk: ulozenyOtisk, data: ulozene, ma: true}
				u.nalezy = predchozi
				u.zapamatovatNalezy(ulozene.Nalezy)
			}
		}
	}
	if predchozi.ma && predchozi.otisk == otisk {
		u.mu.Unlock()
		return predchozi.data.Nalezy
	}
	u.mu.Unlock()

	nalezy := a.spocitatNalezy(modelky, alba, prahy)
	ulozit := ulozeneNalezy{Nalezy: nalezy, Modelky: make(map[string]string, len(nalezy))}
	podleID := make(map[int]*Modelka, len(modelky))
	for i := range modelky {
		podleID[modelky[i].ID] = &modelky[i]
	}
	for _, n := range nalezy {
		if n.Album == "" {
			if m := podleID[n.ModelkaID]; m != nil {
				ulozit.Modelky[strconv.Itoa(n.ModelkaID)] = otiskUdajuKontroly(*m)
			}
		}
	}
	// Opravené nálezy: byl, už není, modelka existuje a změnila se, a nebyl označen „V pořádku“
	if predchozi.ma {
		nyni := make(map[string]bool, len(nalezy))
		for _, n := range nalezy {
			nyni[klicNalezu(n.ModelkaID, n.Album, n.Typ, n.Klic)+"\x00"+n.Zdroj] = true
		}
		for _, n := range predchozi.data.Nalezy {
			m := podleID[n.ModelkaID]
			drivejsi := predchozi.data.Modelky[strconv.Itoa(n.ModelkaID)]
			if n.Album != "" || n.NetykaSe || m == nil || nyni[klicNalezu(n.ModelkaID, n.Album, n.Typ, n.Klic)+"\x00"+n.Zdroj] ||
				obsahujeKlic(m.NetykaSe, n.Klic) || !strings.HasPrefix(drivejsi, predponaOtiskuKontroly) || drivejsi == otiskUdajuKontroly(*m) {
				continue
			}
			u.zapsat(udalostNalezOpraveny, n.ModelkaID, "", "", n.Klic, n.Popis, "", n.Zdroj, 0, 0)
		}
	}
	u.mu.Lock()
	u.nalezy = pametVysledku[ulozeneNalezy]{otisk: otisk, data: ulozit, ma: true}
	u.zapamatovatNalezy(nalezy)
	u.ulozitMezipamet("kontrola", otisk, ulozit)
	u.mu.Unlock()
	return nalezy
}

func (u *uceni) zapamatovatNalezy(nalezy []PodezrelyUdaj) {
	u.posledniNal = make(map[string]PodezrelyUdaj, len(nalezy))
	for _, n := range nalezy {
		u.posledniNal[klicNalezu(n.ModelkaID, n.Album, n.Typ, n.Klic)] = n
	}
}

// ---------------------------------------------------------------------------------------------------------
// Přehled a zapomenutí

func (a *App) GetStavUceni() StavUceni {
	stav := StavUceni{Zdroje: []ZdrojUceni{}}
	u := a.uc
	if u == nil {
		return stav
	}
	modelky, alba, _ := a.modelkyAAlba()
	navrhy := a.navrhySbirky(modelky, alba)
	pocty := map[string]int{}
	for _, n := range navrhy {
		if !n.Odmitnuto {
			for _, z := range n.Zdroje {
				pocty[z]++
			}
		}
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return stav
	}
	stav.Soubor = u.cesta
	if u.cesta != "" {
		if info, err := os.Stat(u.cesta); err == nil {
			stav.Velikost = info.Size()
		}
	}
	db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(druh = ?), 0), COALESCE(SUM(druh = ?), 0), COALESCE(SUM(druh = ?), 0), COALESCE(MAX(cas), '')
		FROM udalosti`, udalostPrijato, udalostOdmitnuto, udalostOpraveno).Scan(&stav.Udalosti, &stav.Prijato, &stav.Odmitnuto, &stav.Opraveno, &stav.Naposledy)
	db.QueryRow("SELECT COUNT(*) FROM porovnani").Scan(&stav.Porovnani)
	if u.statistiky == nil {
		u.statistiky = u.spocitatKalibraci()
	}
	for _, z := range poradiZdroju {
		zn := zdrojeNavrhu[z]
		k := kalibraceZdroje{}
		if s := u.statistiky[z]; s != nil {
			k = *s
		}
		prah, strop := prahNavrhu, stropJistoty
		if zn.rodina == "odhad" {
			prah, strop = minJistotaOdhadu, stropOdhadu
		}
		stav.Zdroje = append(stav.Zdroje, ZdrojUceni{Zdroj: z, Popis: zn.popis, Navrhu: pocty[z], Prijato: k.Prijatych, Odmitnuto: k.Odmitnutych,
			Presnost: math.Round(k.Presnost(zn.predpoklad)*1000) / 1000, Aktivni: k.Upravit(strop, zn.predpoklad) >= prah})
	}
	return stav
}

// Zapomenutí naučeného: záloha databáze učení do složky záloh (uceni-….db) a její vyprázdnění.
func (a *App) ZapomenoutUceni() bool {
	u := a.uc
	if u == nil {
		return false
	}
	u.pockat()
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return false
	}
	if !a.zalohovatUceni(db) {
		return false
	}
	for _, tabulka := range append(append([]string(nil), tabulkyUceni...), "mezipamet") {
		if _, err := db.Exec("DELETE FROM " + tabulka); err != nil {
			a.chyba("zapomenutí učení", err)
			return false
		}
	}
	// Čítač událostí se posune, aby otisk mezipaměti z doby před zapomenutím už nikdy neplatil
	db.Exec("UPDATE sqlite_sequence SET seq = seq + 1 WHERE name = 'udalosti'")
	db.Exec("VACUUM")
	u.nacistGeneraci()
	u.vstup, u.prahy, u.statistiky = nil, nil, nil
	u.navrhy, u.nalezy = pametVysledku[[]navrhSbirky]{}, pametVysledku[ulozeneNalezy]{}
	return true
}

// Záloha databáze učení do složky záloh (uceni-….db) před zapomenutím; volá se se zámkem.
func (a *App) zalohovatUceni(db *sql.DB) bool {
	if a.uc.cesta == "" {
		return true
	}
	if err := os.MkdirAll(slozkaZaloh(), 0o700); err != nil {
		a.chyba("záloha databáze učení", err)
		return false
	}
	zaloha := filepath.Join(slozkaZaloh(), "uceni-"+time.Now().Format("2006-01-02-150405.000")+".db")
	if _, err := db.Exec("VACUUM INTO ?", zaloha); err != nil {
		a.chyba("záloha databáze učení", err)
		return false
	}
	os.Chmod(zaloha, 0o600)
	uklidZalohUceni()
	return true
}

// Ze záloh databáze učení zůstává posledních pocetZalohUceni
func uklidZalohUceni() {
	soubory, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "uceni-*.db"))
	sort.Strings(soubory)
	for len(soubory) > pocetZalohUceni {
		os.Remove(soubory[0])
		soubory = soubory[1:]
	}
}
