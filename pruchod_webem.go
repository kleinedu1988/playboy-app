package main

// Průchod sbírkou na webu (Údržba › Z webu): NajitUdajeModelky postupně pro všechny modelky (nebo jen ty
// s chybějícími údaji) na pozadí; ziskatZdroj drží 1 dotaz za sekundu na server. Rozdíly proti zdrojům čekají
// ve frontě návrhů z webu, nic se nezapíše bez potvrzení. Stav průchodu, fronta i odmítnuté hodnoty jsou
// v tabulce nastaveni, takže průchod jde po restartu dokončit a odmítnuté se znovu nenabízí.

import (
	"context"
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	klicStavuPruchodu    = "web_pruchod"
	klicNavrhuZWebu      = "web_navrhy"
	klicOdmitnutychZWebu = "web_odmitnute"
)

type NavrhZWebu struct {
	ModelkaID  int    `json:"modelkaId"`
	Jmeno      string `json:"jmeno"`
	Pole       string `json:"pole"`
	Nazev      string `json:"nazev"`
	Stavajici  string `json:"stavajici"`
	Hodnota    string `json:"hodnota"`
	Zdroj      string `json:"zdroj"`
	ZdrojNazev string `json:"zdrojNazev"`
	URL        string `json:"url"`
}

// Uložený stav průchodu: kdo zbývá (pořadí), kolik je hotovo
type ulozenyPruchod struct {
	Zbyva        []int  `json:"zbyva"`
	Celkem       int    `json:"celkem"`
	Hotovo       int    `json:"hotovo"`
	Chyb         int    `json:"chyb"`
	JenChybejici bool   `json:"jenChybejici"`
	Zacatek      string `json:"zacatek"`
	Konec        string `json:"konec"`
}

type StavPruchoduWebem struct {
	Bezi         bool   `json:"bezi"`
	Celkem       int    `json:"celkem"`
	Hotovo       int    `json:"hotovo"`
	Chyb         int    `json:"chyb"`
	Zbyva        int    `json:"zbyva"` // > 0 a neběží = přerušený, jde pokračovat
	Aktualni     string `json:"aktualni"`
	JenChybejici bool   `json:"jenChybejici"`
	Zacatek      string `json:"zacatek"`
	Konec        string `json:"konec"`
	Navrhu       int    `json:"navrhu"`
}

type pruchodWebem struct {
	mu       sync.Mutex
	bezi     bool
	aktualni string
	zrusit   context.CancelFunc
	konec    chan struct{}
}

// Hledání údajů jedné modelky; v testech se nahradí
var hledatUdajeModelky = func(a *App, id int) NalezUdaju { return a.NajitUdajeModelky(id) }

var zamekPruchodu sync.Mutex

func (a *App) pruchodu() *pruchodWebem {
	zamekPruchodu.Lock()
	defer zamekPruchodu.Unlock()
	if a.pruchod == nil {
		a.pruchod = &pruchodWebem{}
	}
	return a.pruchod
}

func (a *App) nacistJSONNastaveni(klic string, cil any) {
	if h := a.nastaveni(klic); h != "" {
		json.Unmarshal([]byte(h), cil)
	}
}

func (a *App) ulozitJSONNastaveni(klic string, hodnota any) {
	b, err := json.Marshal(hodnota)
	if err != nil {
		return
	}
	if err := a.ulozitNastaveni(klic, string(b)); err != nil {
		a.chyba("uložení průchodu webem", err)
	}
}

func klicOdmitnutiZWebu(id int, pole, hodnota string) string {
	return strconv.Itoa(id) + "|" + pole + "|" + zjednodusit(hodnota)
}

func (a *App) odmitnuteZWebu() map[string]bool {
	var seznam []string
	a.nacistJSONNastaveni(klicOdmitnutychZWebu, &seznam)
	v := map[string]bool{}
	for _, k := range seznam {
		v[k] = true
	}
	return v
}

func (a *App) ulozitOdmitnuteZWebu(m map[string]bool) {
	seznam := make([]string, 0, len(m))
	for k := range m {
		seznam = append(seznam, k)
	}
	sort.Strings(seznam)
	a.ulozitJSONNastaveni(klicOdmitnutychZWebu, seznam)
}

// Modelce chybí některý údaj, který zdroje umí doplnit
func chybiUdajZWebu(m *Modelka) bool {
	for _, p := range poleZdroju {
		if p.klic == "umrtiDatum" {
			continue
		}
		if strings.TrimSpace(hodnotaPoleModelky(m, p.klic)) == "" {
			return true
		}
	}
	return false
}

// Návrhy z nálezu jedné modelky (bez odmítnutých)
func navrhyZNalezu(n NalezUdaju, odmitnute map[string]bool) []NavrhZWebu {
	zdroje := map[string]ZdrojUdaju{}
	for _, z := range n.Zdroje {
		zdroje[z.Klic] = z
	}
	var v []NavrhZWebu
	for _, p := range n.Pole {
		for _, h := range p.Navrhy {
			if odmitnute[klicOdmitnutiZWebu(n.ModelkaID, p.Klic, h.Hodnota)] {
				continue
			}
			z := zdroje[h.Zdroj]
			v = append(v, NavrhZWebu{ModelkaID: n.ModelkaID, Jmeno: n.Jmeno, Pole: p.Klic, Nazev: p.Nazev, Stavajici: p.Stavajici,
				Hodnota: h.Hodnota, Zdroj: h.Zdroj, ZdrojNazev: z.Nazev, URL: z.URL})
		}
	}
	return v
}

// SpustitPruchodWebem: nový průchod (pokracovat = false), nebo dokončení přerušeného; false = už běží nebo není co
func (a *App) SpustitPruchodWebem(jenChybejici, pokracovat bool) bool {
	p := a.pruchodu()
	p.mu.Lock()
	if p.bezi {
		p.mu.Unlock()
		return false
	}
	var st ulozenyPruchod
	a.nacistJSONNastaveni(klicStavuPruchodu, &st)
	if !pokracovat || len(st.Zbyva) == 0 {
		modelky := a.snimekSbirky().modelky
		st = ulozenyPruchod{Zbyva: []int{}, JenChybejici: jenChybejici, Zacatek: time.Now().Format("2006-01-02 15:04")}
		for i := range modelky {
			if !jenChybejici || chybiUdajZWebu(&modelky[i]) {
				st.Zbyva = append(st.Zbyva, modelky[i].ID)
			}
		}
		st.Celkem = len(st.Zbyva)
	}
	if len(st.Zbyva) == 0 {
		p.mu.Unlock()
		return false
	}
	st.Konec = ""
	a.ulozitJSONNastaveni(klicStavuPruchodu, st)
	ctx, zrusit := context.WithCancel(context.Background())
	p.bezi, p.zrusit, p.konec, p.aktualni = true, zrusit, make(chan struct{}), ""
	konec := p.konec
	p.mu.Unlock()

	go func() {
		defer close(konec)
		defer func() {
			p.mu.Lock()
			p.bezi, p.zrusit, p.aktualni = false, nil, ""
			p.mu.Unlock()
		}()
		for len(st.Zbyva) > 0 {
			if ctx.Err() != nil {
				return
			}
			id := st.Zbyva[0]
			m, ok := a.modelkaPodleID(id)
			if ok {
				p.mu.Lock()
				p.aktualni = m.Jmeno
				p.mu.Unlock()
				n := hledatUdajeModelky(a, id)
				if ctx.Err() != nil {
					// Přerušeno uprostřed: modelka zůstane na řadě
					return
				}
				chyba := len(n.Zdroje) > 0
				for _, z := range n.Zdroje {
					if z.Stav != "chyba" {
						chyba = false
					}
				}
				if chyba {
					st.Chyb++
				}
				a.nahraditNavrhyZWebu(id, navrhyZNalezu(n, a.odmitnuteZWebu()))
			}
			st.Zbyva = st.Zbyva[1:]
			st.Hotovo++
			if len(st.Zbyva) == 0 {
				st.Konec = time.Now().Format("2006-01-02 15:04")
			}
			a.ulozitJSONNastaveni(klicStavuPruchodu, st)
		}
	}()
	return true
}

// Přerušení: rozpracovaná modelka zůstane na řadě, průchod jde dokončit i po restartu
func (a *App) PrerusitPruchodWebem() {
	p := a.pruchodu()
	p.mu.Lock()
	zrusit, konec := p.zrusit, p.konec
	p.mu.Unlock()
	if zrusit == nil {
		return
	}
	zrusit()
	select {
	case <-konec:
	case <-time.After(3 * time.Second):
	}
}

func (a *App) GetStavPruchoduWebem() StavPruchoduWebem {
	var st ulozenyPruchod
	a.nacistJSONNastaveni(klicStavuPruchodu, &st)
	p := a.pruchodu()
	p.mu.Lock()
	v := StavPruchoduWebem{Bezi: p.bezi, Aktualni: p.aktualni}
	p.mu.Unlock()
	v.Celkem, v.Hotovo, v.Chyb, v.Zbyva = st.Celkem, st.Hotovo, st.Chyb, len(st.Zbyva)
	v.JenChybejici, v.Zacatek, v.Konec = st.JenChybejici, st.Zacatek, st.Konec
	v.Navrhu = len(a.GetNavrhyZWebu())
	return v
}

var zamekNavrhuZWebu sync.Mutex

func (a *App) nahraditNavrhyZWebu(id int, nove []NavrhZWebu) {
	zamekNavrhuZWebu.Lock()
	defer zamekNavrhuZWebu.Unlock()
	var vse []NavrhZWebu
	a.nacistJSONNastaveni(klicNavrhuZWebu, &vse)
	zbyle := vse[:0]
	for _, n := range vse {
		if n.ModelkaID != id {
			zbyle = append(zbyle, n)
		}
	}
	a.ulozitJSONNastaveni(klicNavrhuZWebu, append(zbyle, nove...))
}

// Fronta návrhů z webu: bez smazaných modelek, odmítnutých a těch, které už se se sbírkou shodují
// (údaj mezitím někdo vyplnil stejně); stávající hodnota je vždy aktuální
func (a *App) GetNavrhyZWebu() []NavrhZWebu {
	zamekNavrhuZWebu.Lock()
	var vse []NavrhZWebu
	a.nacistJSONNastaveni(klicNavrhuZWebu, &vse)
	zamekNavrhuZWebu.Unlock()
	odmitnute := a.odmitnuteZWebu()
	modelky := map[int]*Modelka{}
	snimek := a.snimekSbirky().modelky
	for i := range snimek {
		modelky[snimek[i].ID] = &snimek[i]
	}
	v := []NavrhZWebu{}
	for _, n := range vse {
		m, ok := modelky[n.ModelkaID]
		if !ok || odmitnute[klicOdmitnutiZWebu(n.ModelkaID, n.Pole, n.Hodnota)] {
			continue
		}
		n.Stavajici = hodnotaPoleModelky(m, n.Pole)
		n.Jmeno = m.Jmeno
		if stejnyUdaj(n.Pole, n.Hodnota, n.Stavajici) {
			continue
		}
		v = append(v, n)
	}
	return v
}

// Přijetí návrhů (po jednom, po poli, po zdroji): u každé modelky se zapíše jedna hodnota na údaj (první
// v seznamu) a odkazy na použité zdroje; ostatní návrhy téhož údaje z fronty zmizí. Víc modelek = předtím záloha.
// Vrací počet modelek, u kterých se něco zapsalo.
func (a *App) PrijmoutNavrhyZWebu(navrhy []NavrhZWebu) int {
	type zmena struct {
		hodnoty map[string]string
		odkazy  []string
	}
	zmeny := map[int]*zmena{}
	var poradi []int
	for _, n := range navrhy {
		if strings.TrimSpace(n.Hodnota) == "" {
			continue
		}
		z := zmeny[n.ModelkaID]
		if z == nil {
			z = &zmena{hodnoty: map[string]string{}}
			zmeny[n.ModelkaID] = z
			poradi = append(poradi, n.ModelkaID)
		}
		if _, uz := z.hodnoty[n.Pole]; uz {
			continue
		}
		z.hodnoty[n.Pole] = n.Hodnota
		if n.URL != "" {
			z.odkazy = append(z.odkazy, n.URL)
		}
	}
	if len(poradi) == 0 {
		return 0
	}
	if len(poradi) > 1 {
		if err := a.zalohovat("pred-prijetim-navrhu-z-webu"); err != nil {
			a.chyba("vytvoření zálohy", err)
			return 0
		}
	}
	zapsano := 0
	for _, id := range poradi {
		z := zmeny[id]
		if !a.UlozitUdajeZeZdroju(id, z.hodnoty, z.odkazy) {
			continue
		}
		zapsano++
		// Vyřízené údaje: zbylé návrhy téhož pole se zahodí
		zamekNavrhuZWebu.Lock()
		var vse []NavrhZWebu
		a.nacistJSONNastaveni(klicNavrhuZWebu, &vse)
		zbyle := vse[:0]
		for _, n := range vse {
			if _, vyrizeno := z.hodnoty[n.Pole]; n.ModelkaID == id && vyrizeno {
				continue
			}
			zbyle = append(zbyle, n)
		}
		a.ulozitJSONNastaveni(klicNavrhuZWebu, zbyle)
		zamekNavrhuZWebu.Unlock()
	}
	return zapsano
}

// Odmítnutí (odmitnout = false je ruší); odmítnutá hodnota se u modelky a údaje už nenabídne ani v dalším průchodu
func (a *App) OdmitnoutNavrhyZWebu(navrhy []NavrhZWebu, odmitnout bool) bool {
	m := a.odmitnuteZWebu()
	for _, n := range navrhy {
		k := klicOdmitnutiZWebu(n.ModelkaID, n.Pole, n.Hodnota)
		if odmitnout {
			m[k] = true
		} else {
			delete(m, k)
		}
	}
	a.ulozitOdmitnuteZWebu(m)
	return true
}

// Počet odmítnutých (nápověda „odmítnuté se nenabízí“, vrácení všech)
func (a *App) PocetOdmitnutychZWebu() int {
	return len(a.odmitnuteZWebu())
}

// Zrušení všech odmítnutí; nabídnou se po dalším průchodu
func (a *App) ZrusitOdmitnutiZWebu() bool {
	return a.ulozitNastaveni(klicOdmitnutychZWebu, "") == nil
}

// PrijetiZWebu: výsledek hromadného přijetí s tím, co je potřeba k vrácení (původní záznamy modelek a návrhy)
type PrijetiZWebu struct {
	Zapsano int          `json:"zapsano"`
	Puvodni []Modelka    `json:"puvodni"`
	Navrhy  []NavrhZWebu `json:"navrhy"`
}

// PrijmoutNavrhyZWebuVratitelne: jako PrijmoutNavrhyZWebu, ale vrátí původní záznamy dotčených modelek,
// aby šlo přijetí vrátit (Údržba › Z webu › Přijmout zobrazené, 1.51.1)
func (a *App) PrijmoutNavrhyZWebuVratitelne(navrhy []NavrhZWebu) PrijetiZWebu {
	v := PrijetiZWebu{Puvodni: []Modelka{}, Navrhy: navrhy}
	videno := map[int]bool{}
	for _, n := range navrhy {
		if videno[n.ModelkaID] {
			continue
		}
		videno[n.ModelkaID] = true
		if m, ok := a.modelkaPodleID(n.ModelkaID); ok {
			v.Puvodni = append(v.Puvodni, m)
		}
	}
	v.Zapsano = a.PrijmoutNavrhyZWebu(navrhy)
	return v
}

// VratitPrijetiZWebu: vrátí údaje modelek do stavu před přijetím a návrhy vrátí do fronty
func (a *App) VratitPrijetiZWebu(p PrijetiZWebu) bool {
	ok := true
	for _, m := range p.Puvodni {
		// Titulní fotka se neměnila; prázdná ponechá stávající
		m.CoverID = ""
		if !a.UpdateModelka(m) {
			ok = false
		}
	}
	zamekNavrhuZWebu.Lock()
	var vse []NavrhZWebu
	a.nacistJSONNastaveni(klicNavrhuZWebu, &vse)
	mame := map[string]bool{}
	for _, n := range vse {
		mame[klicOdmitnutiZWebu(n.ModelkaID, n.Pole, n.Hodnota)] = true
	}
	for _, n := range p.Navrhy {
		if k := klicOdmitnutiZWebu(n.ModelkaID, n.Pole, n.Hodnota); !mame[k] {
			mame[k] = true
			vse = append(vse, n)
		}
	}
	a.ulozitJSONNastaveni(klicNavrhuZWebu, vse)
	zamekNavrhuZWebu.Unlock()
	return ok
}
