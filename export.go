package main

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"gopkg.in/yaml.v3"
)

// Export a import celé sbírky v YAML. Soubor je určený i k ručním úpravám v textovém editoru:
// prázdné údaje se nevypisují a při importu prázdný nebo chybějící údaj nic nepřepisuje.

type exportFotka struct {
	ID        string `yaml:"id"`
	Hodnoceni int    `yaml:"hodnoceni,omitempty"`
	Rotace    int    `yaml:"rotace,omitempty"`
}

type exportAlbum struct {
	Nazev    string `yaml:"nazev"`
	Typ      string `yaml:"typ"`
	Pridano  string `yaml:"pridano,omitempty"` // kdy přibyla první fotka alba
	Vydani   string `yaml:"vydani,omitempty"`
	Fotograf string `yaml:"fotograf,omitempty"`
	Popis    string `yaml:"popis,omitempty"`
	Spojit   bool   `yaml:"spojit,omitempty"`
	// Fotky jsou v souboru v ručně určeném pořadí; bez toho se album řadí podle srdíček
	RucniPoradi bool `yaml:"rucni_poradi,omitempty"`
	// Další modelky alba; album je zapsané jen u hlavní modelky
	DalsiModelky []string      `yaml:"dalsi_modelky,omitempty"`
	Fotky        []exportFotka `yaml:"fotky"`
}

type exportVyrez struct {
	Zoom float64 `yaml:"zoom"`
	X    float64 `yaml:"poloha_x"`
	Y    float64 `yaml:"poloha_y"`
}

type exportModelka struct {
	Jmeno           string        `yaml:"jmeno"`
	Pridano         string        `yaml:"pridano,omitempty"`
	DalsiJmena      string        `yaml:"dalsi_jmena,omitempty"`
	Hodnoceni       int           `yaml:"hodnoceni,omitempty"`
	NarozeniDatum   string        `yaml:"narozeni_datum,omitempty"`
	NarozeniMisto   string        `yaml:"narozeni_misto,omitempty"`
	Narodnost       string        `yaml:"narodnost,omitempty"`
	Etnicita        string        `yaml:"etnicita,omitempty"`
	VyskaCm         int           `yaml:"vyska_cm,omitempty"`
	VahaKg          int           `yaml:"vaha_kg,omitempty"`
	VlasyBarva      string        `yaml:"vlasy,omitempty"`
	OciBarva        string        `yaml:"oci,omitempty"`
	ObvodHrudnikCm  int           `yaml:"hrudnik_cm,omitempty"`
	ObvodPasCm      int           `yaml:"pas_cm,omitempty"`
	ObvodBokyCm     int           `yaml:"boky_cm,omitempty"`
	Miry            string        `yaml:"miry,omitempty"`
	VelikostPrsou   string        `yaml:"velikost_prsou,omitempty"`
	PrsaTyp         string        `yaml:"prsa_typ,omitempty"`
	Ochlupeni       string        `yaml:"ochlupeni,omitempty"`
	Tetovani        string        `yaml:"tetovani,omitempty"` // ano / ne
	Piercing        string        `yaml:"piercing,omitempty"` // ano / ne
	Role            string        `yaml:"role,omitempty"`
	Tags            string        `yaml:"tagy,omitempty"`
	Vystoupeni      string        `yaml:"vystoupeni,omitempty"`
	PictorialVydani string        `yaml:"pictorial_vydani,omitempty"`
	Poznamka        string        `yaml:"poznamka,omitempty"`
	TitulniFotka    string        `yaml:"titulni_fotka,omitempty"`
	Vyrez           *exportVyrez  `yaml:"vyrez,omitempty"`
	Alba            []exportAlbum `yaml:"alba,omitempty"`
}

type exportCover struct {
	Vydani string        `yaml:"vydani"`
	Fotky  []exportFotka `yaml:"fotky"`
}

type exportDat struct {
	Verze   int             `yaml:"verze"`
	Modelky []exportModelka `yaml:"modelky"`
	Covery  []exportCover   `yaml:"covery,omitempty"`
}

const adresaObrazku = "https://lh3.googleusercontent.com/d/"

func anoNeDoTextu(hodnota int) string {
	switch hodnota {
	case 1:
		return "ano"
	case 0:
		return "ne"
	}
	return ""
}

// Prázdný nebo nesrozumitelný text nechává údaj beze změny
func anoNeZTextu(text string, puvodni int) int {
	switch zjednodusit(strings.TrimSpace(text)) {
	case "ano", "true", "1":
		return 1
	case "ne", "false", "0":
		return 0
	}
	return puvodni
}

// Fotky seskupené do alb v pořadí, v jakém přišly z databáze
func seskupitDoAlb(fotky []Fotografie) []exportAlbum {
	var alba []exportAlbum
	kde := map[string]int{}
	for _, f := range fotky {
		klic := f.Album + "\n" + f.Typ
		i, znam := kde[klic]
		if !znam {
			i = len(alba)
			kde[klic] = i
			album := exportAlbum{Nazev: f.Album, Typ: f.Typ, Fotograf: f.Fotograf, Popis: f.Popis, Pridano: f.Pridano}
			// Centerfold má vydání přímo v názvu alba
			if f.Typ != "Centerfold" && f.Typ != "Cover" {
				album.Vydani = f.Vydani
			}
			for _, dalsi := range f.DalsiModelky {
				album.DalsiModelky = append(album.DalsiModelky, dalsi.Jmeno)
			}
			alba = append(alba, album)
		}
		if f.Pridano != "" && (alba[i].Pridano == "" || f.Pridano < alba[i].Pridano) {
			alba[i].Pridano = f.Pridano
		}
		alba[i].Spojit = alba[i].Spojit || f.Spojit
		alba[i].RucniPoradi = alba[i].RucniPoradi || f.Poradi > 0
		alba[i].Fotky = append(alba[i].Fotky, exportFotka{
			ID: strings.TrimPrefix(f.URL, adresaObrazku), Hodnoceni: f.Hodnoceni, Rotace: f.Rotace,
		})
	}
	return alba
}

func (a *App) exportovat() ([]byte, error) {
	data := exportDat{Verze: 2, Modelky: []exportModelka{}}
	exportovanoFotek := 0

	// Chyba čtení nesmí skončit neúplným souborem, který vypadá jako úspěšný export
	modelky, err := a.nactiModelky("")
	if err != nil {
		return nil, fmt.Errorf("modelky se nepodařilo přečíst: %w", err)
	}
	for _, m := range modelky {
		vsechny, err := a.nactiFotografie(dotazFotekModelky, false, true, m.ID)
		if err != nil {
			return nil, fmt.Errorf("fotky modelky %s se nepodařilo přečíst: %w", m.Jmeno, err)
		}
		// Sdílené album se zapisuje jen u hlavní modelky, u ostatních je jen jejich jméno v dalsi_modelky
		var fotky []Fotografie
		for _, f := range a.doplnitDalsiModelky(vsechny) {
			if f.ModelkaID == m.ID {
				fotky = append(fotky, f)
			}
		}
		exportovanoFotek += len(fotky)
		e := exportModelka{
			Jmeno: m.Jmeno, Pridano: m.Pridano, DalsiJmena: m.DalsiJmena, Hodnoceni: m.Hodnoceni,
			NarozeniDatum: m.NarozeniDatum, NarozeniMisto: m.NarozeniMisto, Narodnost: m.Narodnost, Etnicita: m.Etnicita,
			VyskaCm: m.VyskaCm, VahaKg: m.VahaKg, VlasyBarva: m.VlasyBarva, OciBarva: m.OciBarva,
			ObvodHrudnikCm: m.ObvodHrudnikCm, ObvodPasCm: m.ObvodPasCm, ObvodBokyCm: m.ObvodBokyCm, Miry: m.Miry,
			VelikostPrsou: m.VelikostPrsou, PrsaTyp: m.PrsaTyp, Ochlupeni: m.Ochlupeni,
			Tetovani: anoNeDoTextu(m.Tetovani), Piercing: anoNeDoTextu(m.Piercing),
			Role: m.Role, Tags: m.Tags, Vystoupeni: m.Vystoupeni, PictorialVydani: m.PictorialVydani,
			Poznamka: m.Poznamka, TitulniFotka: m.CoverID,
			Alba: seskupitDoAlb(fotky),
		}
		// Míry složené z obvodů se při importu složí znovu
		if m.ObvodHrudnikCm > 0 && m.ObvodPasCm > 0 && m.ObvodBokyCm > 0 {
			e.Miry = ""
		}
		if m.CoverID != "" && (m.CoverZoom != 1 || m.CoverX != 50 || m.CoverY != 50) {
			// Dvě desetinná místa stačí a soubor se lépe čte
			nadve := func(hodnota float64) float64 { return math.Round(hodnota*100) / 100 }
			e.Vyrez = &exportVyrez{Zoom: nadve(m.CoverZoom), X: nadve(m.CoverX), Y: nadve(m.CoverY)}
		}
		data.Modelky = append(data.Modelky, e)
	}

	covery, err := a.nactiFotografie(dotazCoveru, false, false)
	if err != nil {
		return nil, fmt.Errorf("covery se nepodařilo přečíst: %w", err)
	}
	exportovanoFotek += len(covery)
	for _, album := range seskupitDoAlb(covery) {
		data.Covery = append(data.Covery, exportCover{Vydani: album.Nazev, Fotky: album.Fotky})
	}

	// Kontrola úplnosti proti databázi: fotky modelek a covery časopisů
	var modelekVDb, fotekVDb int
	err = a.db.QueryRow(`SELECT (SELECT COUNT(*) FROM modelky), (SELECT COUNT(*) FROM fotografie f
		WHERE (f.typ = 'Cover' AND f.modelka_id = 0) OR EXISTS (SELECT 1 FROM modelky m WHERE m.id = f.modelka_id))`).Scan(&modelekVDb, &fotekVDb)
	if err != nil {
		return nil, fmt.Errorf("úplnost exportu se nepodařilo ověřit: %w", err)
	}
	if modelekVDb != len(data.Modelky) || fotekVDb != exportovanoFotek {
		return nil, fmt.Errorf("export není úplný: v databázi je %d modelek a %d fotek, načetlo se %d a %d",
			modelekVDb, fotekVDb, len(data.Modelky), exportovanoFotek)
	}

	yamlData, err := yaml.Marshal(data)
	if err != nil {
		return nil, err
	}
	hlavicka := "# Playboy Database – export " + time.Now().Format("2006-01-02 15:04") + "\n" +
		"# Import údaje doplňuje a opravuje, nic nemaže; prázdný nebo chybějící údaj ponechá ten stávající.\n\n"
	return append([]byte(hlavicka), yamlData...), nil
}

type VysledekImportu struct {
	NoveModelky     int `json:"noveModelky"`
	UpraveneModelky int `json:"upraveneModelky"`
	Alba            int `json:"alba"`
	NoveFotky       int `json:"noveFotky"`
	// Co se z souboru nepodařilo převzít; prázdné, když prošlo vše
	Chyby []string `json:"chyby"`
	// Soubor nešel přečíst vůbec, v databázi se nic nezměnilo
	Selhalo string `json:"selhalo"`
}

func prvniNeprazdny(novy, puvodni string) string {
	if strings.TrimSpace(novy) != "" {
		return strings.TrimSpace(novy)
	}
	return puvodni
}

func prvniNenulove(nove, puvodni int) int {
	if nove != 0 {
		return nove
	}
	return puvodni
}

// Vložení fotek alba, které v databázi ještě nejsou, a převzetí jejich hodnocení, otočení a pořadí
func (a *App) importovatFotky(modelkaID int, album exportAlbum, vysledek *VysledekImportu, kde string) {
	for i, f := range album.Fotky {
		ids := parseDriveIDs(f.ID)
		if len(ids) == 0 {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: fotka %d nemá platné ID z Disku", kde, i+1))
			continue
		}

		var id int
		err := a.db.QueryRow("SELECT id FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND drive_file_id = ?",
			modelkaID, album.Nazev, album.Typ, ids[0]).Scan(&id)
		if err != nil {
			// Nová fotka přebírá datum alba ze souboru, bez něj okamžik importu
			vlozeno, err := a.db.Exec("INSERT INTO fotografie (modelka_id, album, typ, drive_file_id, pridano) VALUES (?, ?, ?, ?, ?)",
				modelkaID, album.Nazev, album.Typ, ids[0], prvniNeprazdny(album.Pridano, ted()))
			if err != nil {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: %v", kde, err))
				continue
			}
			nove, _ := vlozeno.LastInsertId()
			id = int(nove)
			vysledek.NoveFotky++
		}

		if f.Hodnoceni != 0 {
			a.SetHodnoceniFotek([]int{id}, f.Hodnoceni)
		}
		if f.Rotace != 0 {
			a.SetRotaceFotek([]int{id}, f.Rotace)
		}
		if album.RucniPoradi {
			a.db.Exec("UPDATE fotografie SET poradi = ? WHERE id = ?", i+1, id)
		}
	}
}

func (a *App) importovatAlbum(modelkaID int, jmeno string, album exportAlbum, vysledek *VysledekImportu) {
	album.Nazev, album.Typ = strings.TrimSpace(album.Nazev), strings.TrimSpace(album.Typ)
	kde := fmt.Sprintf("%s – %s", jmeno, album.Nazev)
	switch {
	case album.Nazev == "" || album.Typ == "":
		vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: album nemá název nebo typ", jmeno))
		return
	case album.Typ == "Cover":
		vysledek.Chyby = append(vysledek.Chyby, kde+": covery patří do oddílu covery, ne k modelce")
		return
	case album.Typ == "Centerfold" && !vzorVydani.MatchString(album.Nazev):
		vysledek.Chyby = append(vysledek.Chyby, kde+": název centerfoldu musí být vydání ve tvaru RRRR-MM")
		return
	}

	a.importovatFotky(modelkaID, album, vysledek, kde)
	vysledek.Alba++

	if album.Spojit {
		a.db.Exec("UPDATE fotografie SET spojit = 1 WHERE modelka_id = ? AND album = ? AND typ = ?", modelkaID, album.Nazev, album.Typ)
	}
	if vydani := strings.TrimSpace(album.Vydani); vydani != "" && album.Typ != "Centerfold" {
		if !a.SetVydaniAlba(modelkaID, album.Nazev, album.Typ, vydani) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: vydání „%s“ není ve tvaru RRRR-MM ani RRRR", kde, vydani))
		}
	}
	if strings.TrimSpace(album.Popis) != "" || strings.TrimSpace(album.Fotograf) != "" {
		var popis, fotograf string
		a.db.QueryRow("SELECT COALESCE(popis, ''), COALESCE(fotograf, '') FROM alba WHERE modelka_id = ? AND album = ? AND typ = ?",
			modelkaID, album.Nazev, album.Typ).Scan(&popis, &fotograf)
		a.SetPopisAlba(modelkaID, album.Nazev, album.Typ, prvniNeprazdny(album.Popis, popis), prvniNeprazdny(album.Fotograf, fotograf))
	}
}

func (a *App) importovat(yamlData []byte) VysledekImportu {
	vysledek := VysledekImportu{Chyby: []string{}}

	var data exportDat
	if err := yaml.Unmarshal(yamlData, &data); err != nil {
		vysledek.Selhalo = fmt.Sprintf("Soubor není platný YAML: %v", err)
		return vysledek
	}
	if len(data.Modelky) == 0 && len(data.Covery) == 0 {
		vysledek.Selhalo = "V souboru nejsou žádné modelky ani covery."
		return vysledek
	}
	// Bez zálohy se do databáze hromadně nezapisuje
	if err := a.zalohovat("pred-importem"); err != nil {
		vysledek.Selhalo = fmt.Sprintf("Nepodařilo se vytvořit zálohu, import se neprovedl: %v", err)
		return vysledek
	}

	// Celý import běží v jedné transakci: když selže uprostřed, v databázi nezůstane napůl.
	// Pomocné funkce zapisují přes a.db, proto se pro dobu importu podstrčí spojení s jediným připojením,
	// na kterém transakce běží.
	if a.cestaDb != "" {
		puvodni := a.db
		db, err := sql.Open("sqlite", a.cestaDb+"?_pragma=busy_timeout(5000)")
		if err == nil {
			db.SetMaxOpenConns(1)
			_, err = db.Exec("BEGIN IMMEDIATE")
		}
		if err != nil {
			vysledek.Selhalo = fmt.Sprintf("Import se nepodařilo zahájit: %v", err)
			return vysledek
		}
		a.db = db
		defer func() {
			if vysledek.Selhalo == "" {
				if _, err := db.Exec("COMMIT"); err != nil {
					vysledek.Selhalo = fmt.Sprintf("Import se nepodařilo uložit, nic se nezměnilo: %v", err)
				}
			}
			if vysledek.Selhalo != "" {
				db.Exec("ROLLBACK")
				vysledek = VysledekImportu{Chyby: []string{}, Selhalo: vysledek.Selhalo}
			}
			db.Close()
			a.db = puvodni
		}()
	}

	// Modelky se párují podle jména bez ohledu na velikost písmen a diakritiku
	stavajici := map[string]Modelka{}
	for _, m := range a.GetModelky("") {
		stavajici[zjednodusit(m.Jmeno)] = m
	}

	type sdileneAlbum struct {
		modelkaID int
		album     exportAlbum
	}
	var sdilena []sdileneAlbum
	for _, e := range data.Modelky {
		jmeno := strings.TrimSpace(e.Jmeno)
		if jmeno == "" {
			vysledek.Chyby = append(vysledek.Chyby, "modelka bez jména byla přeskočena")
			continue
		}

		m, existuje := stavajici[zjednodusit(jmeno)]
		if !existuje {
			if !a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1, Pridano: strings.TrimSpace(e.Pridano)}) {
				vysledek.Chyby = append(vysledek.Chyby, jmeno+": modelku se nepodařilo založit")
				continue
			}
			m = Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1}
			a.db.QueryRow("SELECT id FROM modelky WHERE jmeno = ? ORDER BY id DESC LIMIT 1", jmeno).Scan(&m.ID)
			stavajici[zjednodusit(jmeno)] = m
			vysledek.NoveModelky++
		} else {
			vysledek.UpraveneModelky++
		}

		m.DalsiJmena = prvniNeprazdny(e.DalsiJmena, m.DalsiJmena)
		m.NarozeniDatum = prvniNeprazdny(e.NarozeniDatum, m.NarozeniDatum)
		m.NarozeniMisto = prvniNeprazdny(e.NarozeniMisto, m.NarozeniMisto)
		m.Narodnost = prvniNeprazdny(e.Narodnost, m.Narodnost)
		m.Etnicita = prvniNeprazdny(e.Etnicita, m.Etnicita)
		m.VyskaCm = prvniNenulove(e.VyskaCm, m.VyskaCm)
		m.VahaKg = prvniNenulove(e.VahaKg, m.VahaKg)
		m.VlasyBarva = prvniNeprazdny(e.VlasyBarva, m.VlasyBarva)
		m.OciBarva = prvniNeprazdny(e.OciBarva, m.OciBarva)
		m.ObvodHrudnikCm = prvniNenulove(e.ObvodHrudnikCm, m.ObvodHrudnikCm)
		m.ObvodPasCm = prvniNenulove(e.ObvodPasCm, m.ObvodPasCm)
		m.ObvodBokyCm = prvniNenulove(e.ObvodBokyCm, m.ObvodBokyCm)
		m.Miry = prvniNeprazdny(e.Miry, m.Miry)
		m.VelikostPrsou = prvniNeprazdny(e.VelikostPrsou, m.VelikostPrsou)
		m.PrsaTyp = prvniNeprazdny(e.PrsaTyp, m.PrsaTyp)
		m.Ochlupeni = prvniNeprazdny(e.Ochlupeni, m.Ochlupeni)
		m.Tetovani = anoNeZTextu(e.Tetovani, m.Tetovani)
		m.Piercing = anoNeZTextu(e.Piercing, m.Piercing)
		m.Role = prvniNeprazdny(e.Role, m.Role)
		m.Tags = prvniNeprazdny(e.Tags, m.Tags)
		m.Vystoupeni = prvniNeprazdny(e.Vystoupeni, m.Vystoupeni)
		m.PictorialVydani = prvniNeprazdny(e.PictorialVydani, m.PictorialVydani)
		m.Poznamka = prvniNeprazdny(e.Poznamka, m.Poznamka)

		// Výřez patří ke konkrétní titulní fotce: nová fotka bez výřezu v souboru dostane výchozí
		if ids := parseDriveIDs(e.TitulniFotka); len(ids) > 0 {
			m.CoverID = ids[0]
		} else if strings.TrimSpace(e.TitulniFotka) != "" {
			vysledek.Chyby = append(vysledek.Chyby, jmeno+": titulní fotka nemá platné ID z Disku")
		}
		if !a.UpdateModelka(m) {
			vysledek.Chyby = append(vysledek.Chyby, jmeno+": údaje modelky se nepodařilo uložit")
			continue
		}
		if e.Vyrez != nil && m.CoverID != "" {
			a.SetCoverVyrez(m.ID, e.Vyrez.Zoom, e.Vyrez.X, e.Vyrez.Y)
		}
		if e.Hodnoceni != 0 {
			a.SetHodnoceni(m.ID, e.Hodnoceni)
		}

		for _, album := range e.Alba {
			a.importovatAlbum(m.ID, jmeno, album, &vysledek)
			sdilena = append(sdilena, sdileneAlbum{m.ID, album})
		}
		if poImportuModelky != nil {
			if err := poImportuModelky(); err != nil {
				vysledek.Selhalo = fmt.Sprintf("Import selhal, nic se nezměnilo: %v", err)
				return vysledek
			}
		}
	}

	// Další modelky alb až po založení všech modelek ze souboru; neznámé jméno založí modelku
	for _, s := range sdilena {
		for _, jmeno := range s.album.DalsiModelky {
			jmeno = strings.TrimSpace(jmeno)
			dalsi, znama := stavajici[zjednodusit(jmeno)]
			if !znama && jmeno != "" && a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1}) {
				a.db.QueryRow("SELECT id FROM modelky WHERE jmeno = ? ORDER BY id DESC LIMIT 1", jmeno).Scan(&dalsi.ID)
				stavajici[zjednodusit(jmeno)] = dalsi
				vysledek.NoveModelky++
			}
			if dalsi.ID != 0 {
				a.PridatModelkuKAlbu(s.modelkaID, strings.TrimSpace(s.album.Nazev), strings.TrimSpace(s.album.Typ), dalsi.ID)
			}
		}
	}

	for _, c := range data.Covery {
		vydani := strings.TrimSpace(c.Vydani)
		if !vzorVydani.MatchString(vydani) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("cover: vydání „%s“ není ve tvaru RRRR-MM", vydani))
			continue
		}
		a.importovatFotky(0, exportAlbum{Nazev: vydani, Typ: "Cover", Fotky: c.Fotky}, &vysledek, "cover "+vydani)
	}
	return vysledek
}

// Testy jím mohou import uprostřed shodit a ověřit, že se nic nezměnilo
var poImportuModelky func() error

var filtrYaml = []runtime.FileFilter{{DisplayName: "YAML (*.yaml, *.yml)", Pattern: "*.yaml;*.yml"}}

// Export sbírky do souboru, který si uživatel vybere; vrací cestu, nebo prázdný text po zrušení
func (a *App) ExportovatDoSouboru() string {
	cesta, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Exportovat sbírku",
		DefaultFilename: "playboy-" + time.Now().Format("2006-01-02") + ".yaml",
		Filters:         filtrYaml,
	})
	if err != nil {
		a.chyba("export", err)
		return ""
	}
	if cesta == "" {
		return ""
	}

	// Nejdřív do dočasného souboru: přerušený zápis nesmí zničit starší export téhož jména
	data, err := a.exportovat()
	if err == nil {
		err = os.WriteFile(cesta+".tmp", data, 0o600)
	}
	if err == nil {
		err = os.Rename(cesta+".tmp", cesta)
	}
	if err != nil {
		a.chyba("export", err)
		return ""
	}
	return cesta
}

// Výběr souboru k importu; prázdný text znamená, že uživatel výběr zrušil
func (a *App) VybratSouborImportu() string {
	cesta, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Importovat sbírku", Filters: filtrYaml})
	if err != nil {
		a.chyba("import", err)
		return ""
	}
	return cesta
}

// Import sbírky ze souboru: doplňuje a opravuje, nic nemaže; předtím se uloží záloha
func (a *App) ImportovatZeSouboru(cesta string) VysledekImportu {
	data, err := os.ReadFile(cesta)
	if err != nil {
		return VysledekImportu{Chyby: []string{}, Selhalo: fmt.Sprintf("Soubor se nepodařilo přečíst: %v", err)}
	}
	return a.importovat(data)
}
