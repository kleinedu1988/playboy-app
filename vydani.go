package main

import (
	"fmt"
	"sort"
	"strings"
)

// Etapa 6: vydání jako záznam (poznámka, stav, modelka z obálky) a vlastní výběry fotek napříč modelkami.

// Úprava č. 5: tabulka vydání, výběry fotek a odkazy u modelky
func (a *App) migraceVydaniAVybery() error {
	kroky := []string{
		`CREATE TABLE IF NOT EXISTS vydani (
			vydani TEXT PRIMARY KEY,
			poznamka TEXT,
			stav TEXT,
			modelka_obalky INTEGER
		)`,
		`CREATE TABLE IF NOT EXISTS vybery (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nazev TEXT NOT NULL UNIQUE,
			pridano TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS vybery_fotky (
			vyber_id INTEGER NOT NULL,
			fotografie_id INTEGER NOT NULL,
			poradi INTEGER,
			PRIMARY KEY (vyber_id, fotografie_id)
		)`,
		// Smazaná fotka zmizí z výběrů, smazaný výběr vezme své vazby, smazaná modelka z obálek
		`CREATE TRIGGER IF NOT EXISTS vybery_po_fotce AFTER DELETE ON fotografie
			BEGIN DELETE FROM vybery_fotky WHERE fotografie_id = OLD.id; END`,
		`CREATE TRIGGER IF NOT EXISTS vybery_po_vyberu AFTER DELETE ON vybery
			BEGIN DELETE FROM vybery_fotky WHERE vyber_id = OLD.id; END`,
		`CREATE TRIGGER IF NOT EXISTS obalky_po_modelce AFTER DELETE ON modelky
			BEGIN UPDATE vydani SET modelka_obalky = NULL WHERE modelka_obalky = OLD.id; END`,
	}
	for _, krok := range kroky {
		if _, err := a.db.Exec(krok); err != nil {
			return err
		}
	}
	if !a.maSloupec("modelky", "odkazy") {
		if _, err := a.db.Exec("ALTER TABLE modelky ADD COLUMN odkazy TEXT"); err != nil {
			return err
		}
	}
	return nil
}

// Stav vydání ve sbírce: prázdný = běžný, „shanim" = chybí a hledám ho, „nezajima" = chybí záměrně,
// „mam" = mám fyzický výtisk (bez ohledu na to, jestli jsou fotky ve sbírce)
var stavyVydani = map[string]bool{"": true, "shanim": true, "nezajima": true, "mam": true}

type VydaniInfo struct {
	Vydani        string `json:"vydani"`
	Poznamka      string `json:"poznamka"`
	Stav          string `json:"stav"`
	ModelkaObalky int    `json:"modelkaObalky"` // 0 = neuvedeno
	JmenoObalky   string `json:"jmenoObalky"`
	// Kdo je na obálce, když to není modelka ze sbírky (volný text); s modelkou ze sbírky je prázdný
	NaObalce string `json:"naObalce"`
	// Název speciálu (u měsíčního čísla prázdný)
	Nazev string `json:"nazev"`
}

func (a *App) GetVydaniInfo(vydani string) VydaniInfo {
	info := VydaniInfo{Vydani: vydani}
	a.db.QueryRow(`SELECT COALESCE(v.poznamka, ''), COALESCE(v.stav, ''), COALESCE(v.modelka_obalky, 0), COALESCE(m.jmeno, ''), COALESCE(v.nazev, ''),
		COALESCE(v.na_obalce, '') FROM vydani v LEFT JOIN modelky m ON m.id = v.modelka_obalky WHERE v.vydani = ?`, vydani).
		Scan(&info.Poznamka, &info.Stav, &info.ModelkaObalky, &info.JmenoObalky, &info.Nazev, &info.NaObalce)
	return info
}

// Poznámka, stav a kdo je na obálce (modelka ze sbírky, nebo jméno textem); prázdné údaje řádek vydání ruší
func (a *App) SetVydaniInfo(vydani, poznamka, stav string, modelkaObalky int, naObalce string) bool {
	poznamka, naObalce = strings.TrimSpace(poznamka), strings.TrimSpace(naObalce)
	if !vzorVydani.MatchString(vydani) || !stavyVydani[stav] || (modelkaObalky != 0 && a.jmenoModelky(modelkaObalky) == "") {
		return false
	}
	// Modelka ze sbírky má přednost před textem
	if modelkaObalky != 0 {
		naObalce = ""
	}
	var err error
	if poznamka == "" && stav == "" && modelkaObalky == 0 && naObalce == "" {
		// Speciál si řádek ponechá kvůli názvu
		_, err = a.db.Exec("DELETE FROM vydani WHERE vydani = ? AND COALESCE(nazev, '') = ''", vydani)
		if err == nil {
			_, err = a.db.Exec("UPDATE vydani SET poznamka = NULL, stav = NULL, modelka_obalky = NULL, na_obalce = NULL WHERE vydani = ?", vydani)
		}
	} else {
		var obalka interface{}
		if modelkaObalky != 0 {
			obalka = modelkaObalky
		}
		_, err = a.db.Exec(`INSERT INTO vydani (vydani, poznamka, stav, modelka_obalky, na_obalce) VALUES (?, NULLIF(?, ''), NULLIF(?, ''), ?, NULLIF(?, ''))
			ON CONFLICT(vydani) DO UPDATE SET poznamka = excluded.poznamka, stav = excluded.stav, modelka_obalky = excluded.modelka_obalky,
				na_obalce = excluded.na_obalce`,
			vydani, poznamka, stav, obalka, naObalce)
	}
	if err != nil {
		a.chyba("uložení údajů čísla", err)
	}
	return err == nil
}

// Jen stav (z kalendáře), poznámka a obálka zůstávají
func (a *App) SetStavVydani(vydani, stav string) bool {
	info := a.GetVydaniInfo(vydani)
	return a.SetVydaniInfo(vydani, info.Poznamka, stav, info.ModelkaObalky, info.NaObalce)
}

// Vydání se stavem nebo poznámkou pro kalendář (i ta, ke kterým zatím nic není)
func (a *App) GetStavyVydani() []VydaniInfo {
	stavy := []VydaniInfo{}
	rows, err := a.db.Query("SELECT vydani, COALESCE(poznamka, ''), COALESCE(stav, ''), COALESCE(modelka_obalky, 0), COALESCE(nazev, ''), COALESCE(na_obalce, '') FROM vydani ORDER BY vydani")
	if err != nil {
		a.chyba("načtení stavů čísel", err)
		return stavy
	}
	defer rows.Close()
	for rows.Next() {
		var v VydaniInfo
		if rows.Scan(&v.Vydani, &v.Poznamka, &v.Stav, &v.ModelkaObalky, &v.Nazev, &v.NaObalce) == nil {
			stavy = append(stavy, v)
		}
	}
	return stavy
}

// Vlastní výběry fotek

type Vyber struct {
	ID    int    `json:"id"`
	Nazev string `json:"nazev"`
	Pocet int    `json:"pocet"`
}

func (a *App) GetVybery() []Vyber {
	vybery := []Vyber{}
	rows, err := a.db.Query(`SELECT v.id, v.nazev, (SELECT COUNT(*) FROM vybery_fotky vf WHERE vf.vyber_id = v.id)
		FROM vybery v ORDER BY v.nazev COLLATE BEZDIAKRITIKY`)
	if err != nil {
		a.chyba("načtení výběrů", err)
		return vybery
	}
	defer rows.Close()
	for rows.Next() {
		var v Vyber
		if rows.Scan(&v.ID, &v.Nazev, &v.Pocet) == nil {
			vybery = append(vybery, v)
		}
	}
	return vybery
}

// Výběr podle názvu (bez ohledu na velikost písmen a diakritiku); neexistující se založí. Vrací id, 0 při chybě.
func (a *App) VyberPodleNazvu(nazev string) int {
	nazev = strings.TrimSpace(nazev)
	if nazev == "" {
		return 0
	}
	for _, v := range a.GetVybery() {
		if zjednodusit(v.Nazev) == zjednodusit(nazev) {
			return v.ID
		}
	}
	vysledek, err := a.db.Exec("INSERT INTO vybery (nazev, pridano) VALUES (?, ?)", nazev, ted())
	if err != nil {
		a.chyba("založení výběru", err)
		return 0
	}
	id, _ := vysledek.LastInsertId()
	return int(id)
}

func (a *App) PrejmenovatVyber(id int, nazev string) bool {
	nazev = strings.TrimSpace(nazev)
	if nazev == "" {
		return false
	}
	_, err := a.db.Exec("UPDATE vybery SET nazev = ? WHERE id = ?", nazev, id)
	return err == nil
}

func (a *App) SmazatVyber(id int) bool {
	_, err := a.db.Exec("DELETE FROM vybery WHERE id = ?", id)
	if err != nil {
		a.chyba("smazání výběru", err)
	}
	return err == nil
}

// Přidání fotek na konec výběru; fotka, která už ve výběru je, se přeskočí. Vrací počet přidaných.
// Konec výběru se zjistí jednou na začátku transakce (dřív u každé fotky, výběr tisíců fotek byl kvadratický).
func (a *App) PridatDoVyberu(vyberID int, fotoIDs []int) int {
	pridano := 0
	if !a.vTransakci("přidání fotek do výběru", func(tx dotazovac) error {
		pridano = 0
		var posledni int
		if err := tx.QueryRow("SELECT COALESCE(MAX(poradi), 0) FROM vybery_fotky WHERE vyber_id = ?", vyberID).Scan(&posledni); err != nil {
			return err
		}
		for _, id := range fotoIDs {
			vysledek, err := tx.Exec("INSERT OR IGNORE INTO vybery_fotky (vyber_id, fotografie_id, poradi) VALUES (?, ?, ?)", vyberID, id, posledni+1)
			if err != nil {
				return err
			}
			if n, _ := vysledek.RowsAffected(); n > 0 {
				pridano++
				posledni++
			}
		}
		return nil
	}) {
		return 0
	}
	return pridano
}

func (a *App) OdebratZVyberu(vyberID int, fotoIDs []int) bool {
	return a.vTransakci("odebrání fotek z výběru", func(tx dotazovac) error {
		for _, id := range fotoIDs {
			if _, err := tx.Exec("DELETE FROM vybery_fotky WHERE vyber_id = ? AND fotografie_id = ?", vyberID, id); err != nil {
				return err
			}
		}
		return nil
	})
}

// Fotky výběru v pořadí, v jakém byly přidány
func (a *App) GetFotkyVyberu(vyberID int) []Fotografie {
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM vybery_fotky vf
		JOIN fotografie f ON f.id = vf.fotografie_id
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE vf.vyber_id = ? ORDER BY vf.poradi, f.id`, true, true, vyberID))
}

// Názvy výběrů pro export: fotka je určená modelkou, albem, typem a souborem
type exportVyberu struct {
	Nazev string              `yaml:"nazev"`
	Fotky []exportFotkyVyberu `yaml:"fotky"`
}

type exportFotkyVyberu struct {
	Modelka string `yaml:"modelka,omitempty"`
	Album   string `yaml:"album"`
	Typ     string `yaml:"typ"`
	ID      string `yaml:"id"`
}

type exportVydani struct {
	Vydani        string `yaml:"vydani"`
	Nazev         string `yaml:"nazev,omitempty"` // název speciálu
	Stav          string `yaml:"stav,omitempty"`
	ModelkaObalky string `yaml:"modelka_obalky,omitempty"`
	// Kdo je na obálce, když to není modelka ze sbírky
	NaObalce string `yaml:"na_obalce,omitempty"`
	Poznamka string `yaml:"poznamka,omitempty"`
	// Články čísla (od verze exportu 7)
	Clanky []exportClanek `yaml:"clanky,omitempty"`
}

func (a *App) exportovatVydaniAVybery(odkazy odkazyNaModelky, jmena map[int]string) ([]exportVydani, []exportVyberu) {
	var vydani []exportVydani
	for _, v := range a.GetStavyVydani() {
		obalka := ""
		if v.ModelkaObalky != 0 {
			obalka = odkazy.odkaz(v.ModelkaObalky, jmena[v.ModelkaObalky])
		}
		vydani = append(vydani, exportVydani{Vydani: v.Vydani, Nazev: v.Nazev, Stav: v.Stav, ModelkaObalky: obalka, NaObalce: v.NaObalce, Poznamka: v.Poznamka})
	}
	// Články patří k vydání; vydání bez údajů, ke kterému jsou jen články, přibude v seznamu samo
	clanky := a.exportovatClanky(odkazy)
	for i := range vydani {
		vydani[i].Clanky = clanky[vydani[i].Vydani]
		delete(clanky, vydani[i].Vydani)
	}
	for v, c := range clanky {
		vydani = append(vydani, exportVydani{Vydani: v, Clanky: c})
	}
	sort.Slice(vydani, func(i, j int) bool { return vydani[i].Vydani < vydani[j].Vydani })
	var vybery []exportVyberu
	for _, v := range a.GetVybery() {
		e := exportVyberu{Nazev: v.Nazev, Fotky: []exportFotkyVyberu{}}
		for _, f := range a.GetFotkyVyberu(v.ID) {
			modelka := ""
			if f.ModelkaID != 0 {
				modelka = odkazy.odkaz(f.ModelkaID, f.JmenoModelky)
			}
			e.Fotky = append(e.Fotky, exportFotkyVyberu{Modelka: modelka, Album: f.Album, Typ: f.Typ, ID: f.DriveID})
		}
		vybery = append(vybery, e)
	}
	return vydani, vybery
}

// Import vydání a výběrů po importu modelek a fotek; nenalezené se ohlásí
func (a *App) importovatVydaniAVybery(vydani []exportVydani, vybery []exportVyberu, idPodleOdkazu func(string) int, vysledek *VysledekImportu) {
	idModelky := func(odkaz string) int {
		if strings.TrimSpace(odkaz) == "" {
			return 0
		}
		return idPodleOdkazu(odkaz)
	}
	for _, v := range vydani {
		if len(v.Clanky) > 0 {
			a.importovatClanky(v.Vydani, v.Clanky, idModelky, vysledek)
		}
		// Vydání jen s články (bez údajů čísla) údaje čísla nemění
		if v.Nazev == "" && v.Stav == "" && v.ModelkaObalky == "" && v.NaObalce == "" && v.Poznamka == "" && len(v.Clanky) > 0 {
			continue
		}
		stavajici := a.GetVydaniInfo(v.Vydani)
		// Na obálce: modelka ze sbírky, jinak jméno textem; pomlčka obojí smaže
		obalka, naObalce := stavajici.ModelkaObalky, stavajici.NaObalce
		switch {
		case strings.TrimSpace(v.ModelkaObalky) == smazatUdaj || strings.TrimSpace(v.NaObalce) == smazatUdaj:
			obalka, naObalce = 0, ""
		case strings.TrimSpace(v.ModelkaObalky) != "":
			if id := idModelky(v.ModelkaObalky); id != 0 {
				obalka, naObalce = id, ""
			} else {
				// Modelka, která ve sbírce není, se zapíše textem
				obalka, naObalce = 0, strings.TrimSpace(v.ModelkaObalky)
			}
		case strings.TrimSpace(v.NaObalce) != "":
			obalka, naObalce = 0, strings.TrimSpace(v.NaObalce)
		}
		if strings.TrimSpace(v.Nazev) != "" && !a.SetNazevSpecialu(v.Vydani, v.Nazev) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("vydání „%s“: název má jen speciál (RRRR-Snn)", v.Vydani))
			continue
		}
		if !a.SetVydaniInfo(v.Vydani, hodnotaZImportu(v.Poznamka, stavajici.Poznamka), hodnotaZImportu(v.Stav, stavajici.Stav), obalka, naObalce) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("vydání „%s“: neplatné vydání nebo stav", v.Vydani))
		}
	}
	for _, v := range vybery {
		id := a.VyberPodleNazvu(v.Nazev)
		if id == 0 {
			continue
		}
		// Fotky výběru se přidají najednou v pořadí ze souboru
		var fotoIDs []int
		for _, f := range v.Fotky {
			var fotoID int
			a.pripraveny("SELECT id FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND drive_file_id = ?").QueryRow(
				idModelky(f.Modelka), f.Album, f.Typ, f.ID).Scan(&fotoID)
			if fotoID == 0 {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("výběr „%s“: fotka %s v albu „%s“ ve sbírce není", v.Nazev, f.ID, f.Album))
				continue
			}
			fotoIDs = append(fotoIDs, fotoID)
		}
		a.PridatDoVyberu(id, fotoIDs)
	}
}

// Úprava č. 7: speciály (RRRR-Snn) mají u čísla název
func (a *App) migraceSpecialy() error {
	if a.maSloupec("vydani", "nazev") {
		return nil
	}
	_, err := a.db.Exec("ALTER TABLE vydani ADD COLUMN nazev TEXT")
	return err
}

type Special struct {
	Vydani string `json:"vydani"`
	Nazev  string `json:"nazev"`
}

// Všechny speciály: pojmenované u čísla i ty, ke kterým jsou jen alba (třeba ze staršího importu)
func (a *App) GetSpecialy() []Special {
	specialy := []Special{}
	rows, err := a.db.Query(`SELECT vydani, MAX(nazev) FROM (
			SELECT vydani, COALESCE(nazev, '') AS nazev FROM vydani WHERE vydani GLOB '[0-9][0-9][0-9][0-9]-S[0-9][0-9]*'
			UNION ALL SELECT DISTINCT vydani, '' FROM alba WHERE vydani GLOB '[0-9][0-9][0-9][0-9]-S[0-9][0-9]*'
		) GROUP BY vydani ORDER BY vydani`)
	if err != nil {
		a.chyba("načtení speciálů", err)
		return specialy
	}
	defer rows.Close()
	for rows.Next() {
		var s Special
		if rows.Scan(&s.Vydani, &s.Nazev) == nil && vzorVydani.MatchString(s.Vydani) {
			specialy = append(specialy, s)
		}
	}
	return specialy
}

// Nový speciál v roce a edici (prázdná edice = US); vrací jeho klíč, při chybě prázdný text
func (a *App) ZalozitSpecial(rok int, edice, nazev string) string {
	nazev = strings.TrimSpace(nazev)
	if edice == "US" {
		edice = ""
	}
	if nazev == "" || rok < 1953 || rok > 2100 || (edice != "" && !dalsiEdice[edice]) {
		return ""
	}
	pripona := ""
	if edice != "" {
		pripona = "-" + edice
	}
	obsazena := map[string]bool{}
	for _, s := range a.GetSpecialy() {
		obsazena[s.Vydani] = true
	}
	for cislo := 1; cislo <= 99; cislo++ {
		klic := fmt.Sprintf("%04d-S%02d%s", rok, cislo, pripona)
		if obsazena[klic] {
			continue
		}
		if _, err := a.db.Exec("INSERT INTO vydani (vydani, nazev) VALUES (?, ?)", klic, nazev); err != nil {
			a.chyba("založení speciálu", err)
			return ""
		}
		return klic
	}
	return ""
}

// Přejmenování speciálu; název nesmí být prázdný
func (a *App) SetNazevSpecialu(vydani, nazev string) bool {
	nazev = strings.TrimSpace(nazev)
	if !vzorVydani.MatchString(vydani) || !jeSpecial(vydani) || nazev == "" {
		return false
	}
	_, err := a.db.Exec(`INSERT INTO vydani (vydani, nazev) VALUES (?, ?) ON CONFLICT(vydani) DO UPDATE SET nazev = excluded.nazev`, vydani, nazev)
	if err != nil {
		a.chyba("přejmenování speciálu", err)
	}
	return err == nil
}
