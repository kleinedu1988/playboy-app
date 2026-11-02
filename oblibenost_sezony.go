package main

// Sezóny oblíbenosti: sezóna je období různé délky, případně s tématem (oblibenost_obdobi.go). Modelky v ní sbírají body formy ze soubojů v porovnávání
// a ze zájmu (otevřené profily, čas nad fotkami); sílu ani pořadí oblíbenosti to nemění. Body:
//   - výhra +3, remíza +1, prohra 0; výhra nad silnější (výš v současném pořadí) +2 navíc;
//   - zájem: den s otevřeným profilem +1, každé 2 minuty nad fotkami +1, nejvýš 4 za den; celkem nejvýš tolik, kolik
//     má ze soubojů (zájem je nejvýš polovina bodů – rozhodují souboje);
//   - o titul soutěží jen modelka s aspoň 3 souboji v sezóně.
// Skončenou sezónu uzavírá uživatel (okno vyhlášení při dalším spuštění): Favoritka sezóny = nejvíc bodů
// (při shodě víc výher, pak vyšší místo v pořadí), Miláček sezóny = volitelná volba uživatele. Uzavřené sezóny
// jsou v tabulce sezony databáze učení, Favoritka a Miláček i v kronice síně slávy (porovnani_id 0, vrácení
// porovnání je nesmaže) a tituly Favoritky dávají odznak (oblibenost_odznaky.go). Vše se počítá z existujících
// porovnání a zájmu s časovým oknem.

import (
	"slices"
	"sort"
	"time"
)

const (
	bodyVyhra           = 3
	bodyRemiza          = 1
	bodyNadSilnejsi     = 2
	sekundNaBodZajmu    = 120
	zajmuZaDenNejvys    = 4
	soubojuNaTitul      = 3
	udalostFavoritka    = "favoritka" // Favoritka sezóny (kronika síně slávy)
	udalostMilacek      = "milacek"   // Miláček sezóny, volba uživatele
	mesicuZpetKUzavreni = 12          // nejstarší neuzavřená sezóna, kterou ještě nabídne uzavřít
)

// Body modelky v sezóně; Misto 0 = nesoutěží (méně než 3 souboje), Trend = posun v pořadí sezóny za posledních
// 7 dní (kladný = stoupla)
type BodySezony struct {
	ModelkaID int  `json:"modelkaId"`
	Body      int  `json:"body"`
	ZaSouboje int  `json:"zaSouboje"`
	ZaZajem   int  `json:"zaZajem"`
	Vyhry     int  `json:"vyhry"`
	Remizy    int  `json:"remizy"`
	Prohry    int  `json:"prohry"`
	Souboju   int  `json:"souboju"`
	Misto     int  `json:"misto"`
	Trend     int  `json:"trend"`
	Soutezi   bool `json:"soutezi"`
}

// Pojmenování sezóny: klíč (RRRR-MM-DD prvního dne období, starší měsíční RRRR-MM), plný název (téma, jinak
// období), krátký do hlaviček (téma, jinak období bez roku) a období („2.–15. listopadu 2026“)
type NazevSezony struct {
	Klic   string `json:"klic"`
	Nazev  string `json:"nazev"`
	Kratky string `json:"kratky"`
	Obdobi string `json:"obdobi"`
	Od     string `json:"od"` // RRRR-MM-DD
	Do     string `json:"do"` // poslední den sezóny
}

func noveNazevSezony(klic string, od, do time.Time, tema string) NazevSezony {
	n := nazvySezony(od, do, tema)
	return NazevSezony{Klic: klic, Nazev: n.nazev, Kratky: n.kratky, Obdobi: n.obdobi, Od: od.Format(formatDne), Do: do.AddDate(0, 0, -1).Format(formatDne)}
}

// Uzavřená sezóna (Favoritka 0 = nikdo nesplnil 3 souboje)
type MinulaSezona struct {
	NazevSezony
	Tema      string `json:"tema"` // klíč tématu, ve kterém sezóna běžela ("" = Klasická)
	Favoritka int    `json:"favoritka"`
	Milacek   int    `json:"milacek"`
	Body      int    `json:"body"`
	Souboju   int    `json:"souboju"`
}

// Skončená, ještě neuzavřená sezóna: pořadí k vyhlášení (soutěžící, nejvýš 10)
type UzavreniSezony struct {
	NazevSezony
	Tema    string       `json:"tema"` // klíč tématu, ve kterém běžela ("" = Klasická)
	Poradi  []BodySezony `json:"poradi"`
	Souboju int          `json:"souboju"`
	Modelek int          `json:"modelek"`
}

type Sezona struct {
	NazevSezony
	Den       int             `json:"den"` // kolikátý den sezóny je dnes
	Dni       int             `json:"dni"` // dní v sezóně
	Souboju   int             `json:"souboju"`
	Modelek   int             `json:"modelek"` // modelek s body
	Poradi    []BodySezony    `json:"poradi"`  // soutěžící podle bodů, pak ostatní s body
	Minule    []MinulaSezona  `json:"minule"`  // od nejnovější
	KUzavreni *UzavreniSezony `json:"kUzavreni"`
	// Téma probíhající sezóny (nil = Klasická; i když zvolené téma nemá dost soutěžících), kolik modelek v něm
	// soutěží (má dost fotek tématu), zvolené téma (klíč, i neplatné) a délky, které jde zvolit
	Tema        *Tema  `json:"tema"`
	Soutezicich int    `json:"soutezicich"`
	Zvolene     string `json:"zvolene"`
	Zvoleno     bool   `json:"zvoleno"` // téma a délka potvrzené (jinak se nabídne volba)
	MozneDelky  []int  `json:"mozneDelky"`
}

type zaznamZajmu struct {
	cas    time.Time
	id     int
	profil bool
	sekund int
}

func zacatekMesice(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}

// Body všech modelek za okno [od, do); poradi = současné místo v pořadí oblíbenosti (0 = mimo pořadí), existuje =
// modelky ve sbírce. Vrací soutěžící podle bodů (s místy), za nimi ostatní s body.
// filtr = téma sezóny (nil = Klasická): jen souboje v tématu mezi soutěžícími a zájem soutěžících
func spocitatBodySezony(porovnani []porovnaniZaznam, zajem []zaznamZajmu, poradi map[int]int, existuje map[int]bool, od, do time.Time, filtr *filtrSezony) []BodySezony {
	body := map[int]*BodySezony{}
	zaznam := func(id int) *BodySezony {
		b := body[id]
		if b == nil {
			b = &BodySezony{ModelkaID: id}
			body[id] = b
		}
		return b
	}
	silnejsi := func(x, y int) bool { // x je výš v pořadí než y
		px, py := poradi[x], poradi[y]
		return px > 0 && (py == 0 || px < py)
	}
	for _, p := range porovnani {
		if p.cas.Before(od) || !p.cas.Before(do) || p.a == p.b || !existuje[p.a] || !existuje[p.b] || !filtr.pocitaSe(p) {
			continue
		}
		a, b := zaznam(p.a), zaznam(p.b)
		a.Souboju++
		b.Souboju++
		switch p.vysledek {
		case "remiza":
			a.Remizy++
			b.Remizy++
			a.ZaSouboje += bodyRemiza
			b.ZaSouboje += bodyRemiza
		case "a", "b":
			vitez, porazena := a, b
			if p.vysledek == "b" {
				vitez, porazena = b, a
			}
			vitez.Vyhry++
			porazena.Prohry++
			vitez.ZaSouboje += bodyVyhra
			if silnejsi(porazena.ModelkaID, vitez.ModelkaID) {
				vitez.ZaSouboje += bodyNadSilnejsi
			}
		}
	}
	// Zájem po dnech: den s profilem +1, sekundy nad fotkami po 2 minutách, nejvýš 4 za den
	type denModelky struct {
		id  int
		den string
	}
	profil := map[denModelky]bool{}
	sekund := map[denModelky]int{}
	for _, z := range zajem {
		if z.cas.Before(od) || !z.cas.Before(do) || !existuje[z.id] || (filtr != nil && filtr.soutezici[z.id] == 0) {
			continue
		}
		k := denModelky{z.id, z.cas.Format("2006-01-02")}
		if z.profil {
			profil[k] = true
		} else {
			sekund[k] += z.sekund
		}
	}
	zaDen := map[int]int{}
	dny := map[denModelky]bool{}
	for k := range profil {
		dny[k] = true
	}
	for k := range sekund {
		dny[k] = true
	}
	for k := range dny {
		n := sekund[k] / sekundNaBodZajmu
		if profil[k] {
			n++
		}
		zaDen[k.id] += min(n, zajmuZaDenNejvys)
	}
	for id, n := range zaDen {
		if n > 0 {
			zaznam(id).ZaZajem = n
		}
	}
	vysledek := make([]BodySezony, 0, len(body))
	for _, b := range body {
		b.ZaZajem = min(b.ZaZajem, b.ZaSouboje)
		b.Body = b.ZaSouboje + b.ZaZajem
		b.Soutezi = b.Souboju >= soubojuNaTitul
		if b.Body > 0 || b.Souboju > 0 {
			vysledek = append(vysledek, *b)
		}
	}
	sort.Slice(vysledek, func(i, j int) bool {
		x, y := vysledek[i], vysledek[j]
		if x.Soutezi != y.Soutezi {
			return x.Soutezi
		}
		if x.Body != y.Body {
			return x.Body > y.Body
		}
		if x.Vyhry != y.Vyhry {
			return x.Vyhry > y.Vyhry
		}
		if silnejsi(x.ModelkaID, y.ModelkaID) != silnejsi(y.ModelkaID, x.ModelkaID) {
			return silnejsi(x.ModelkaID, y.ModelkaID)
		}
		return x.ModelkaID < y.ModelkaID
	})
	misto := 0
	for i := range vysledek {
		if vysledek[i].Soutezi {
			misto++
			vysledek[i].Misto = misto
		}
	}
	return vysledek
}

// Posun v pořadí sezóny proti stavu před týdnem (jen modelky, které soutěžily už tehdy)
func doplnitTrend(ted, predtim []BodySezony) {
	mistoPredtim := map[int]int{}
	for _, b := range predtim {
		if b.Misto > 0 {
			mistoPredtim[b.ModelkaID] = b.Misto
		}
	}
	for i := range ted {
		if m := mistoPredtim[ted[i].ModelkaID]; m > 0 && ted[i].Misto > 0 {
			ted[i].Trend = m - ted[i].Misto
		}
	}
}

// Záznamy zájmu v okně [od, do); volá se se zámkem
func (u *uceni) nacistZaznamyZajmu(od, do time.Time) []zaznamZajmu {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	radky, err := db.Query("SELECT cas, modelka_id, druh, sekund FROM zajem WHERE cas >= ? AND cas < ?",
		od.Format("2006-01-02 15:04:05"), do.Format("2006-01-02 15:04:05"))
	if err != nil {
		return nil
	}
	defer radky.Close()
	var vysledek []zaznamZajmu
	for radky.Next() {
		var cas, druh string
		var z zaznamZajmu
		if radky.Scan(&cas, &z.id, &druh, &z.sekund) != nil {
			continue
		}
		t, err := time.ParseInLocation("2006-01-02 15:04:05", cas, time.Local)
		if err != nil {
			continue
		}
		z.cas, z.profil = t, druh == "profil"
		vysledek = append(vysledek, z)
	}
	return vysledek
}

// Uzavřené sezóny od nejnovější; volá se se zámkem
func (u *uceni) nacistSezony() []MinulaSezona {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	radky, err := db.Query("SELECT mesic, tema, favoritka, milacek, body, souboju FROM sezony ORDER BY mesic DESC")
	if err != nil {
		return nil
	}
	defer radky.Close()
	var vysledek []MinulaSezona
	for radky.Next() {
		var s MinulaSezona
		if radky.Scan(&s.Klic, &s.Tema, &s.Favoritka, &s.Milacek, &s.Body, &s.Souboju) == nil {
			vysledek = append(vysledek, s)
		}
	}
	return vysledek
}

// Podklady pro výpočet sezón: porovnání, současné pořadí a modelky ve sbírce
func (a *App) podkladySezon() ([]porovnaniZaznam, map[int]int, map[int]bool) {
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	existuje := make(map[int]bool, len(modelky))
	for _, m := range modelky {
		existuje[m.ID] = true
	}
	a.uc.mu.Lock()
	porovnani := a.uc.nacistPorovnani()
	a.uc.mu.Unlock()
	return porovnani, model.poradi, existuje
}

func (a *App) bodySezony(porovnani []porovnaniZaznam, poradi map[int]int, existuje map[int]bool, od, do time.Time, filtr *filtrSezony) []BodySezony {
	a.uc.mu.Lock()
	zajem := a.uc.nacistZaznamyZajmu(od, do)
	a.uc.mu.Unlock()
	return spocitatBodySezony(porovnani, zajem, poradi, existuje, od, do, filtr)
}

// Souboje sezóny v okně [od, do) (v tématu jen tematické mezi soutěžícími)
func pocetSouboju(porovnani []porovnaniZaznam, od, do time.Time, filtr *filtrSezony) int {
	n := 0
	for _, p := range porovnani {
		if !p.cas.Before(od) && p.cas.Before(do) && filtr.pocitaSe(p) {
			n++
		}
	}
	return n
}

// Klíč tématu, ve kterém sezóna opravdu běží ("" = Klasická, i když zvolené téma nemá dost soutěžících)
func (f *filtrSezony) klic() string {
	if f == nil {
		return ""
	}
	return f.tema.Klic
}

// Nejstarší skončená neuzavřená sezóna, ve které byly souboje; sezónu, ve které nikdo nesplnil 3 souboje, uzavře
// rovnou bez titulu
func (a *App) sezonaKUzavreni(porovnani []porovnaniZaznam, poradi map[int]int, existuje map[int]bool, uzavrene map[string]bool, obdobi []obdobiSezony, nyni time.Time) *UzavreniSezony {
	for _, k := range ukonceneSezony(porovnani, obdobi, nyni) {
		if uzavrene[k.klic] {
			continue
		}
		filtr := a.filtrSezony(k.tema)
		souboju := pocetSouboju(porovnani, k.od, k.do, filtr)
		if souboju == 0 {
			continue
		}
		body := a.bodySezony(porovnani, poradi, existuje, k.od, k.do, filtr)
		var soutezici []BodySezony
		for _, b := range body {
			if b.Soutezi && len(soutezici) < 10 {
				soutezici = append(soutezici, b)
			}
		}
		nazev := noveNazevSezony(k.klic, k.od, k.do, filtr.klic())
		if len(soutezici) == 0 {
			a.zapsatSezonu(k.do, MinulaSezona{NazevSezony: nazev, Tema: filtr.klic(), Souboju: souboju})
			continue
		}
		return &UzavreniSezony{NazevSezony: nazev, Tema: filtr.klic(), Poradi: soutezici, Souboju: souboju, Modelek: len(body)}
	}
	return nil
}

// Zápis uzavřené sezóny; Favoritka a Miláček i do kroniky síně slávy (k poslednímu dni sezóny; do = den po něm)
func (a *App) zapsatSezonu(do time.Time, s MinulaSezona) bool {
	u := a.uc
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return false
	}
	tx, err := db.Begin()
	if err != nil {
		return false
	}
	defer tx.Rollback()
	cas := do.Add(-time.Second).Format("2006-01-02 15:04:05")
	if _, err := tx.Exec("INSERT OR IGNORE INTO sezony (mesic, tema, favoritka, milacek, body, souboju, uzavreno) VALUES (?, ?, ?, ?, ?, ?, ?)",
		s.Klic, s.Tema, s.Favoritka, s.Milacek, s.Body, s.Souboju, time.Now().Format("2006-01-02 15:04:05")); err != nil {
		varovatUceni("sezónu se nepodařilo uzavřít: %v", err)
		return false
	}
	for _, x := range []struct {
		druh string
		id   int
	}{{udalostFavoritka, s.Favoritka}, {udalostMilacek, s.Milacek}} {
		if x.id > 0 {
			tx.Exec("INSERT INTO kronika_slavy (cas, porovnani_id, modelka_id, druh, misto, souperka) VALUES (?, 0, ?, ?, 0, 0)", cas, x.id, x.druh)
		}
	}
	return tx.Commit() == nil
}

// Okno a název uzavřené sezóny podle klíče: měsíc (RRRR-MM) nebo období
func oknoSezony(klic string, obdobi []obdobiSezony) (time.Time, time.Time, bool) {
	if m, err := time.ParseInLocation("2006-01", klic, time.Local); err == nil {
		return m, m.AddDate(0, 1, 0), true
	}
	for _, o := range obdobi {
		if o.klic() == klic {
			return o.od, o.do, true
		}
	}
	return time.Time{}, time.Time{}, false
}

// Probíhající sezóna s průběžným pořadím, uzavřené sezóny a případně skončená sezóna k vyhlášení
func (a *App) GetSezona() Sezona {
	nyni := time.Now()
	s := Sezona{Poradi: []BodySezony{}, Minule: []MinulaSezona{}, MozneDelky: delkySezon}
	if a.uc == nil {
		od := zacatekMesice(nyni)
		s.NazevSezony = noveNazevSezony(od.Format(formatDne), od, od.AddDate(0, 1, 0), "")
		return s
	}
	obdobi, o := a.obdobiSezon(nyni)
	od, do := o.od, o.do
	s.Den = int(zacatekDne(nyni).Sub(od).Hours()/24+0.5) + 1
	s.Dni = o.dni()
	s.Zvolene, s.Zvoleno = o.tema, o.zvoleno
	porovnani, poradi, existuje := a.podkladySezon()
	a.uc.mu.Lock()
	minule := a.uc.nacistSezony()
	a.uc.mu.Unlock()
	uzavrene := map[string]bool{}
	for _, m := range minule {
		uzavrene[m.Klic] = true
	}
	s.KUzavreni = a.sezonaKUzavreni(porovnani, poradi, existuje, uzavrene, obdobi, nyni)
	if s.KUzavreni == nil {
		// Sezóny uzavřené rovnou bez titulu se ukážou mezi minulými
		a.uc.mu.Lock()
		minule = a.uc.nacistSezony()
		a.uc.mu.Unlock()
	}
	filtr := a.filtrSezony(o.tema)
	if filtr != nil {
		t := filtr.tema
		s.Tema, s.Soutezicich = &t, len(filtr.soutezici)
	}
	s.NazevSezony = noveNazevSezony(o.klic(), od, do, filtr.klic())
	s.Poradi = a.bodySezony(porovnani, poradi, existuje, od, nyni.Add(time.Second), filtr)
	if tyden := nyni.AddDate(0, 0, -7); tyden.After(od) {
		doplnitTrend(s.Poradi, a.bodySezony(porovnani, poradi, existuje, od, tyden, filtr))
	}
	s.Souboju = pocetSouboju(porovnani, od, do, filtr)
	s.Modelek = len(s.Poradi)
	for _, m := range minule {
		mOd, mDo, ok := oknoSezony(m.Klic, obdobi)
		if !ok {
			continue
		}
		m.NazevSezony = noveNazevSezony(m.Klic, mOd, mDo, m.Tema)
		if m.Favoritka == 0 || existuje[m.Favoritka] {
			if !existuje[m.Milacek] {
				m.Milacek = 0
			}
			s.Minule = append(s.Minule, m)
		}
	}
	return s
}

// Uzavření skončené sezóny z okna vyhlášení (klíč sezóny): Favoritka podle bodů, Miláček volba uživatele (0 = žádný)
func (a *App) UzavritSezonu(klic string, milacek int) bool {
	if a.uc == nil {
		return false
	}
	nyni := time.Now()
	obdobi, _ := a.obdobiSezon(nyni)
	porovnani, poradi, existuje := a.podkladySezon()
	i := slices.IndexFunc(ukonceneSezony(porovnani, obdobi, nyni), func(k sezonaKlic) bool { return k.klic == klic })
	if i < 0 {
		return false
	}
	k := ukonceneSezony(porovnani, obdobi, nyni)[i]
	filtr := a.filtrSezony(k.tema)
	body := a.bodySezony(porovnani, poradi, existuje, k.od, k.do, filtr)
	s := MinulaSezona{NazevSezony: NazevSezony{Klic: klic}, Tema: filtr.klic(), Souboju: pocetSouboju(porovnani, k.od, k.do, filtr)}
	if len(body) > 0 && body[0].Soutezi {
		s.Favoritka, s.Body = body[0].ModelkaID, body[0].Body
	}
	if existuje[milacek] && milacek != s.Favoritka {
		s.Milacek = milacek
	}
	return a.zapsatSezonu(k.do, s)
}

// Časy titulů Favoritky z kroniky (pro odznak); kronika je od nejstarší
func titulyFavoritky(kronika []zaznamKroniky) map[int][]time.Time {
	tituly := map[int][]time.Time{}
	for _, z := range kronika {
		if z.druh == udalostFavoritka {
			tituly[z.modelka] = append(tituly[z.modelka], z.cas)
		}
	}
	return tituly
}
