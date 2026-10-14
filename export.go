package main

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
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
	// Jen když se liší od data přidání alba
	Pridano string `yaml:"pridano,omitempty"`
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
	NetykaSe     string        `yaml:"netyka_se,omitempty"`
	Fotky        []exportFotka `yaml:"fotky"`
}

type exportVyrez struct {
	Zoom float64 `yaml:"zoom"`
	X    float64 `yaml:"poloha_x"`
	Y    float64 `yaml:"poloha_y"`
}

type exportModelka struct {
	Jmeno string `yaml:"jmeno"`
	// Číslo modelky v databázi, ze které export vznikl; odlišuje modelky stejného jména
	Cislo           int           `yaml:"cislo,omitempty"`
	NetykaSe        string        `yaml:"netyka_se,omitempty"`
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
	Odkazy          string        `yaml:"odkazy,omitempty"`
	TitulniFotka    string        `yaml:"titulni_fotka,omitempty"`
	Vyrez           *exportVyrez  `yaml:"vyrez,omitempty"`
	Alba            []exportAlbum `yaml:"alba,omitempty"`
}

type exportCover struct {
	Vydani      string        `yaml:"vydani"`
	Spojit      bool          `yaml:"spojit,omitempty"`
	RucniPoradi bool          `yaml:"rucni_poradi,omitempty"`
	Fotky       []exportFotka `yaml:"fotky"`
}

// Verze formátu exportu, kterou program zapisuje a nejvýš umí načíst; popis je v EXPORT.md
const verzeExportu = 5

// Odkaz na modelku v exportu (další modelka alba, obálka, výběr): jméno, u jmen, která má víc modelek,
// doplněné o číslo modelky v hranatých závorkách („Anna [12]“)
type odkazyNaModelky map[string]int

func (o odkazyNaModelky) odkaz(id int, jmeno string) string {
	if o[zjednodusit(jmeno)] > 1 {
		return fmt.Sprintf("%s [%d]", jmeno, id)
	}
	return jmeno
}

// Číslo modelky se zapisuje jen u jmen, která má víc modelek
func (o odkazyNaModelky) cislo(id int, jmeno string) int {
	if o[zjednodusit(jmeno)] > 1 {
		return id
	}
	return 0
}

var vzorOdkazuSCislem = regexp.MustCompile(`^(.*\S)\s*\[(\d+)\]$`)

type exportDat struct {
	Verze   int             `yaml:"verze"`
	Modelky []exportModelka `yaml:"modelky"`
	Covery  []exportCover   `yaml:"covery,omitempty"`
	Vydani  []exportVydani  `yaml:"vydani,omitempty"`
	Vybery  []exportVyberu  `yaml:"vybery,omitempty"`
}

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
func seskupitDoAlb(fotky []Fotografie, odkazy odkazyNaModelky, netykaSe map[int64]string) []exportAlbum {
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
				album.DalsiModelky = append(album.DalsiModelky, odkazy.odkaz(dalsi.ID, dalsi.Jmeno))
			}
			album.NetykaSe = netykaSe[f.AlbumID]
			alba = append(alba, album)
		}
		if f.Pridano != "" && (alba[i].Pridano == "" || f.Pridano < alba[i].Pridano) {
			alba[i].Pridano = f.Pridano
		}
		alba[i].Spojit = alba[i].Spojit || f.Spojit
		alba[i].RucniPoradi = alba[i].RucniPoradi || f.Poradi > 0
		alba[i].Fotky = append(alba[i].Fotky, exportFotka{
			ID: f.DriveID, Hodnoceni: f.Hodnoceni, Rotace: f.Rotace, Pridano: f.Pridano,
		})
	}
	// Datum fotky se zapisuje, jen když se liší od data alba
	for i := range alba {
		for j := range alba[i].Fotky {
			if alba[i].Fotky[j].Pridano == alba[i].Pridano {
				alba[i].Fotky[j].Pridano = ""
			}
		}
	}
	return alba
}

func (a *App) exportovat() ([]byte, error) {
	data := exportDat{Verze: verzeExportu, Modelky: []exportModelka{}}
	exportovanoFotek := 0

	// Chyba čtení nesmí skončit neúplným souborem, který vypadá jako úspěšný export
	modelky, err := a.nactiModelky("")
	if err != nil {
		return nil, fmt.Errorf("modelky se nepodařilo přečíst: %w", err)
	}
	// Jména, která má víc modelek, se v odkazech doplní číslem
	odkazy := odkazyNaModelky{}
	for _, m := range modelky {
		odkazy[zjednodusit(m.Jmeno)]++
	}
	netykaSeAlb := map[int64]string{}
	if rows, err := a.db.Query("SELECT id, netyka_se FROM alba WHERE COALESCE(netyka_se, '') <> ''"); err == nil {
		for rows.Next() {
			var id int64
			var n string
			if rows.Scan(&id, &n) == nil {
				netykaSeAlb[id] = n
			}
		}
		rows.Close()
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
			Poznamka: m.Poznamka, Odkazy: m.Odkazy, TitulniFotka: m.CoverID,
			Alba: seskupitDoAlb(fotky, odkazy, netykaSeAlb), Cislo: odkazy.cislo(m.ID, m.Jmeno), NetykaSe: m.NetykaSe,
		}
		// Alba bez fotek, která nesou text, fotografa, „netýká se“ nebo další modelky
		e.Alba = append(e.Alba, a.prazdnaAlba(m.ID, odkazy)...)
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
	for _, album := range seskupitDoAlb(covery, odkazy, netykaSeAlb) {
		data.Covery = append(data.Covery, exportCover{Vydani: album.Nazev, Spojit: album.Spojit, RucniPoradi: album.RucniPoradi, Fotky: album.Fotky})
	}

	data.Vydani, data.Vybery = a.exportovatVydaniAVybery(odkazy)

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
			// Přímo do tabulky fotek, aby bylo známé id nové fotky
			albumID, err := zajistitAlbum(a.db, modelkaID, album.Nazev, album.Typ)
			var vlozeno sql.Result
			if err == nil {
				vlozeno, err = a.db.Exec("INSERT INTO fotky (album_id, drive_file_id, pridano) VALUES (?, ?, ?)",
					albumID, ids[0], prvniNeprazdny(f.Pridano, prvniNeprazdny(album.Pridano, ted())))
			}
			if err != nil {
				a.chyba("import "+kde, err)
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
			a.db.Exec("UPDATE fotky SET poradi = ? WHERE id = ?", i+1, id)
		}
	}
}

func (a *App) importovatAlbum(modelkaID int, jmeno string, album exportAlbum, vysledek *VysledekImportu) {
	album.Nazev, album.Typ = strings.TrimSpace(album.Nazev), strings.TrimSpace(album.Typ)
	kde := fmt.Sprintf("%s – %s", jmeno, album.Nazev)
	// Stejné pravidlo jako při zápisu z programu
	if err := a.overitKlicAlba(modelkaID, album.Nazev, album.Typ); err != nil {
		vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: %v", kde, err))
		return
	}
	// Album bez fotek (jen s textem nebo dalšími modelkami) se založí samo
	if _, err := zajistitAlbum(a.db, modelkaID, album.Nazev, album.Typ); err != nil {
		a.chyba("import "+kde, err)
		return
	}

	a.importovatFotky(modelkaID, album, vysledek, kde)
	vysledek.Alba++

	if album.Spojit {
		a.db.Exec("UPDATE alba SET spojit = 1 WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?", modelkaID, album.Nazev, album.Typ)
	}
	for _, klic := range strings.Split(album.NetykaSe, ",") {
		if klic = strings.TrimSpace(klic); klic != "" {
			a.SetNetykaSeAlba(modelkaID, album.Nazev, album.Typ, klic, true)
		}
	}
	if vydani := strings.TrimSpace(album.Vydani); vydani != "" && album.Typ != "Centerfold" {
		if !a.SetVydaniAlba(modelkaID, album.Nazev, album.Typ, vydani) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: vydání „%s“ není ve tvaru RRRR-MM ani RRRR", kde, vydani))
		}
	}
	if strings.TrimSpace(album.Popis) != "" || strings.TrimSpace(album.Fotograf) != "" {
		var popis, fotograf string
		a.db.QueryRow("SELECT COALESCE(popis, ''), COALESCE(fotograf, '') FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?",
			modelkaID, album.Nazev, album.Typ).Scan(&popis, &fotograf)
		a.SetPopisAlba(modelkaID, album.Nazev, album.Typ, prvniNeprazdny(album.Popis, popis), prvniNeprazdny(album.Fotograf, fotograf))
	}
}

// YAML v textu souboru. V Markdownu bloky ```yaml (každý zvlášť), jinak úvodní hlavička mezi řádky ---,
// jinak celý soubor; v souboru YAML celý obsah.
func yamlZTextu(nazev, text string) []string {
	text = strings.ReplaceAll(strings.TrimPrefix(text, "\ufeff"), "\r\n", "\n")
	if !strings.HasSuffix(strings.ToLower(nazev), ".md") {
		return []string{text}
	}
	var bloky []string
	for _, m := range vzorBlokuYaml.FindAllStringSubmatch(text, -1) {
		bloky = append(bloky, m[1])
	}
	if len(bloky) > 0 {
		return bloky
	}
	if m := vzorHlavickyMd.FindStringSubmatch(text); m != nil {
		return []string{m[1]}
	}
	return []string{text}
}

var (
	vzorBlokuYaml  = regexp.MustCompile("(?ms)^```\\s*(?:yaml|yml)\\s*$\n(.*?)^```")
	vzorHlavickyMd = regexp.MustCompile(`(?s)\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\z)`)
)

// Jeden dokument: celý export, seznam modelek, nebo jedna modelka s údaji přímo nahoře (bez „modelky:“)
func nacistDokument(text string) (exportDat, error) {
	var data exportDat
	errCely := yaml.Unmarshal([]byte(text), &data)
	if errCely == nil && (len(data.Modelky) > 0 || len(data.Covery) > 0 || len(data.Vydani) > 0 || len(data.Vybery) > 0) {
		return data, nil
	}
	var seznam []exportModelka
	if yaml.Unmarshal([]byte(text), &seznam) == nil && len(seznam) > 0 {
		return exportDat{Verze: verzeExportu, Modelky: seznam}, nil
	}
	var jedna exportModelka
	if yaml.Unmarshal([]byte(text), &jedna) == nil && strings.TrimSpace(jedna.Jmeno) != "" {
		return exportDat{Verze: data.Verze, Modelky: []exportModelka{jedna}}, nil
	}
	if errCely != nil {
		return data, fmt.Errorf("není platný YAML: %v", errCely)
	}
	return data, fmt.Errorf("nejsou v něm žádné modelky ani covery (každá modelka v seznamu začíná „- jmeno:“)")
}

// Obsah všech souborů importu jako jeden celek; chyba říká, který soubor je špatně
func slozitSoubory(soubory map[string][]byte, poradi []string) (exportDat, error) {
	celek := exportDat{Verze: verzeExportu}
	for _, nazev := range poradi {
		kratky := filepath.Base(nazev)
		for _, text := range yamlZTextu(nazev, string(soubory[nazev])) {
			data, err := nacistDokument(text)
			if err != nil {
				return celek, fmt.Errorf("Soubor „%s“ %v. Nic se nenačetlo.", kratky, err)
			}
			if data.Verze > verzeExportu {
				return celek, fmt.Errorf("Soubor „%s“ je z novější verze programu (formát %d, tato verze umí nejvýš %d). Nic se nenačetlo; aktualizuj program.", kratky, data.Verze, verzeExportu)
			}
			celek.Modelky = append(celek.Modelky, data.Modelky...)
			celek.Covery = append(celek.Covery, data.Covery...)
			celek.Vydani = append(celek.Vydani, data.Vydani...)
			celek.Vybery = append(celek.Vybery, data.Vybery...)
		}
	}
	return celek, nil
}

func (a *App) importovat(yamlData []byte) VysledekImportu {
	data, err := slozitSoubory(map[string][]byte{"import.yaml": yamlData}, []string{"import.yaml"})
	if err != nil {
		return VysledekImportu{Chyby: []string{}, Selhalo: err.Error()}
	}
	return a.importovatCelek(data)
}

func (a *App) importovatCelek(data exportDat) VysledekImportu {
	vysledek := VysledekImportu{Chyby: []string{}}
	// Bez zálohy se do databáze hromadně nezapisuje
	if err := a.zalohovat("pred-importem"); err != nil {
		vysledek.Selhalo = fmt.Sprintf("Nepodařilo se vytvořit zálohu, import se neprovedl: %v", err)
		return vysledek
	}

	// Celý import běží v jedné transakci na vlastním spojení: když cokoli selže, v databázi nezůstane nic.
	// Ostatní volání z okna pracují dál se svým spojením; zápisy během importu počkají na jeho konec
	// a nic z nich se nepřimíchá do transakce importu.
	if a.cestaDb == "" {
		a.importovatData(data, &vysledek)
		return vysledek
	}
	db, err := sql.Open("sqlite", a.cestaDb+"?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err == nil {
		db.SetMaxOpenConns(1)
		_, err = db.Exec("BEGIN IMMEDIATE")
	}
	if err != nil {
		vysledek.Selhalo = fmt.Sprintf("Import se nepodařilo zahájit: %v", err)
		return vysledek
	}
	defer db.Close()

	// Kopie aplikace nad spojením s transakcí; chyba zápisu kdekoli v pomocných funkcích import zruší
	var chybyZapisu []string
	imp := &App{ctx: a.ctx, db: db, naChybu: func(zprava string) { chybyZapisu = append(chybyZapisu, zprava) }}
	func() {
		defer func() {
			if r := recover(); r != nil {
				vysledek.Selhalo = fmt.Sprintf("Import selhal, nic se nezměnilo: %v", r)
			}
		}()
		imp.importovatData(data, &vysledek)
	}()
	if vysledek.Selhalo == "" && len(chybyZapisu) > 0 {
		vysledek.Selhalo = "Import se nepodařilo zapsat, nic se nezměnilo: " + chybyZapisu[0]
	}
	if vysledek.Selhalo == "" {
		if _, err := db.Exec("COMMIT"); err != nil {
			vysledek.Selhalo = fmt.Sprintf("Import se nepodařilo uložit, nic se nezměnilo: %v", err)
		}
	}
	if vysledek.Selhalo != "" {
		db.Exec("ROLLBACK")
		return VysledekImportu{Chyby: []string{}, Selhalo: vysledek.Selhalo}
	}
	return vysledek
}

// Vlastní import do databáze aplikace (u importu do souboru je to spojení s transakcí)
func (a *App) importovatData(data exportDat, vysledek *VysledekImportu) {
	// Modelky se párují podle jména bez ohledu na velikost písmen a diakritiku. Jména, která má víc modelek,
	// rozhodne číslo modelky ze souboru; každá modelka v databázi se spáruje nejvýš jednou.
	podleJmena := map[string][]Modelka{}
	for _, m := range a.GetModelky("") {
		podleJmena[zjednodusit(m.Jmeno)] = append(podleJmena[zjednodusit(m.Jmeno)], m)
	}
	sparovana := map[int]bool{}
	podleCislaSouboru := map[int]int{}
	najit := func(jmeno string, cislo int) (Modelka, bool) {
		kandidati := podleJmena[zjednodusit(jmeno)]
		for _, m := range kandidati {
			if cislo != 0 && m.ID == cislo && !sparovana[m.ID] {
				return m, true
			}
		}
		var volne []Modelka
		for _, m := range kandidati {
			if !sparovana[m.ID] {
				volne = append(volne, m)
			}
		}
		// Jméno bez čísla, které má ve sbírce jediná modelka: je to ona, i když už ji doplnil jiný soubor téhož importu
		if cislo == 0 && len(kandidati) == 1 {
			return kandidati[0], true
		}
		if len(volne) == 1 && len(kandidati) == 1 {
			return volne[0], true
		}
		return Modelka{}, false
	}
	// Odkaz ze souboru („jméno“ nebo „jméno [číslo]“) na id modelky v databázi
	idPodleOdkazu := func(odkaz string) int {
		odkaz = strings.TrimSpace(odkaz)
		if casti := vzorOdkazuSCislem.FindStringSubmatch(odkaz); casti != nil {
			var cislo int
			fmt.Sscanf(casti[2], "%d", &cislo)
			if id := podleCislaSouboru[cislo]; id != 0 {
				return id
			}
			odkaz = casti[1]
		}
		if kandidati := podleJmena[zjednodusit(odkaz)]; len(kandidati) == 1 {
			return kandidati[0].ID
		}
		return 0
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

		m, existuje := najit(jmeno, e.Cislo)
		if !existuje {
			if !a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1, Pridano: strings.TrimSpace(e.Pridano)}) {
				vysledek.Chyby = append(vysledek.Chyby, jmeno+": modelku se nepodařilo založit")
				continue
			}
			m = Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1}
			a.db.QueryRow("SELECT id FROM modelky WHERE jmeno = ? ORDER BY id DESC LIMIT 1", jmeno).Scan(&m.ID)
			podleJmena[zjednodusit(jmeno)] = append(podleJmena[zjednodusit(jmeno)], m)
			vysledek.NoveModelky++
		} else {
			vysledek.UpraveneModelky++
		}
		sparovana[m.ID] = true
		if e.Cislo != 0 {
			podleCislaSouboru[e.Cislo] = m.ID
		}
		if strings.TrimSpace(e.NetykaSe) != "" {
			for _, klic := range strings.Split(e.NetykaSe, ",") {
				a.SetNetykaSe(m.ID, strings.TrimSpace(klic), true)
			}
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
		// Hodnota mimo nabídku formuláře by se při další úpravě ve formuláři ztratila: ohlásí se a stávající zůstane
		for _, pole := range []struct {
			nazev    string
			ze, kam  *string
			moznosti []string
		}{{"prsa_typ", &e.PrsaTyp, &m.PrsaTyp, moznostiPrsaTyp}, {"ochlupeni", &e.Ochlupeni, &m.Ochlupeni, moznostiOchlupeni}} {
			if hodnota, ok := volbaZNabidky(*pole.ze, pole.moznosti); !ok {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: %s „%s“ není v nabídce (%s)", jmeno, pole.nazev, hodnota, strings.Join(pole.moznosti, ", ")))
			} else {
				*pole.kam = prvniNeprazdny(hodnota, *pole.kam)
			}
		}
		m.Tetovani = anoNeZTextu(e.Tetovani, m.Tetovani)
		m.Piercing = anoNeZTextu(e.Piercing, m.Piercing)
		m.Role = prvniNeprazdny(e.Role, m.Role)
		m.Tags = prvniNeprazdny(e.Tags, m.Tags)
		m.Vystoupeni = prvniNeprazdny(e.Vystoupeni, m.Vystoupeni)
		m.PictorialVydani = prvniNeprazdny(e.PictorialVydani, m.PictorialVydani)
		m.Poznamka = prvniNeprazdny(e.Poznamka, m.Poznamka)
		m.Odkazy = prvniNeprazdny(e.Odkazy, m.Odkazy)

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
		// Další výskyt téže modelky (v jiném souboru importu) navazuje na právě uložené údaje
		for i, k := range podleJmena[zjednodusit(jmeno)] {
			if k.ID == m.ID {
				podleJmena[zjednodusit(jmeno)][i] = m
			}
		}
		if e.Vyrez != nil && m.CoverID != "" {
			a.SetCoverVyrez(m.ID, e.Vyrez.Zoom, e.Vyrez.X, e.Vyrez.Y)
		}
		if e.Hodnoceni != 0 {
			a.SetHodnoceni(m.ID, e.Hodnoceni)
		}

		for _, album := range e.Alba {
			a.importovatAlbum(m.ID, jmeno, album, vysledek)
			sdilena = append(sdilena, sdileneAlbum{m.ID, album})
		}
		if poImportuModelky != nil {
			if err := poImportuModelky(); err != nil {
				vysledek.Selhalo = fmt.Sprintf("Import selhal, nic se nezměnilo: %v", err)
				return
			}
		}
	}

	// Další modelky alb až po založení všech modelek ze souboru; neznámé jméno založí modelku
	for _, s := range sdilena {
		for _, odkaz := range s.album.DalsiModelky {
			id := idPodleOdkazu(odkaz)
			jmeno := strings.TrimSpace(odkaz)
			if id == 0 && jmeno != "" && !vzorOdkazuSCislem.MatchString(jmeno) && a.AddModelka(Modelka{Jmeno: jmeno, Tetovani: -1, Piercing: -1}) {
				var nova Modelka
				a.db.QueryRow("SELECT id, jmeno FROM modelky WHERE jmeno = ? ORDER BY id DESC LIMIT 1", jmeno).Scan(&nova.ID, &nova.Jmeno)
				podleJmena[zjednodusit(jmeno)] = append(podleJmena[zjednodusit(jmeno)], nova)
				id = nova.ID
				vysledek.NoveModelky++
			}
			if id != 0 {
				a.PridatModelkuKAlbu(s.modelkaID, strings.TrimSpace(s.album.Nazev), strings.TrimSpace(s.album.Typ), id)
			} else {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("album „%s“: další modelku „%s“ nejde jednoznačně určit", s.album.Nazev, odkaz))
			}
		}
	}

	for _, c := range data.Covery {
		vydani := strings.TrimSpace(c.Vydani)
		if !vzorVydani.MatchString(vydani) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("cover: vydání „%s“ není ve tvaru RRRR-MM", vydani))
			continue
		}
		a.importovatFotky(0, exportAlbum{Nazev: vydani, Typ: "Cover", Fotky: c.Fotky, RucniPoradi: c.RucniPoradi}, vysledek, "cover "+vydani)
		if c.Spojit {
			a.db.Exec("UPDATE alba SET spojit = 1 WHERE modelka_id IS NULL AND album = ? AND typ = 'Cover'", vydani)
		}
	}

	// Vydání a výběry až po modelkách a fotkách, na které odkazují
	a.importovatVydaniAVybery(data.Vydani, data.Vybery, idPodleOdkazu, vysledek)
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
var filtrImportu = []runtime.FileFilter{
	{DisplayName: "YAML a Markdown (*.yaml, *.yml, *.md)", Pattern: "*.yaml;*.yml;*.md"},
	{DisplayName: "Všechny soubory", Pattern: "*"},
}

// Výběr jednoho nebo více souborů k importu
func (a *App) VybratSouboryImportu() []string {
	cesty, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{Title: "Importovat do sbírky", Filters: filtrImportu})
	if err != nil {
		a.chyba("import", err)
		return []string{}
	}
	if cesty == nil {
		return []string{}
	}
	return cesty
}

// Import sbírky ze souboru: doplňuje a opravuje, nic nemaže; předtím se uloží záloha
// Import jednoho nebo více souborů jako jeden celek: jedna záloha, jedna transakce, buď vše, nebo nic
func (a *App) ImportovatSoubory(cesty []string) VysledekImportu {
	soubory := map[string][]byte{}
	for _, cesta := range cesty {
		data, err := os.ReadFile(cesta)
		if err != nil {
			return VysledekImportu{Chyby: []string{}, Selhalo: fmt.Sprintf("Soubor „%s“ se nepodařilo přečíst: %v", filepath.Base(cesta), err)}
		}
		soubory[cesta] = data
	}
	data, err := slozitSoubory(soubory, cesty)
	if err != nil {
		return VysledekImportu{Chyby: []string{}, Selhalo: err.Error()}
	}
	return a.importovatCelek(data)
}

func (a *App) prazdnaAlba(modelkaID int, odkazy odkazyNaModelky) []exportAlbum {
	var alba []exportAlbum
	rows, err := a.db.Query(`SELECT id, album, typ, vydani, spojit, COALESCE(popis, ''), COALESCE(fotograf, ''), COALESCE(netyka_se, '')
		FROM alba WHERE modelka_id = ? AND NOT EXISTS (SELECT 1 FROM fotky f WHERE f.album_id = alba.id) ORDER BY album COLLATE BEZDIAKRITIKY, typ`, modelkaID)
	if err != nil {
		a.chyba("export", err)
		return nil
	}
	var ids []int64
	for rows.Next() {
		var id int64
		var al exportAlbum
		if rows.Scan(&id, &al.Nazev, &al.Typ, &al.Vydani, &al.Spojit, &al.Popis, &al.Fotograf, &al.NetykaSe) == nil {
			if al.Typ == "Centerfold" || al.Typ == "Cover" {
				al.Vydani = ""
			}
			al.Fotky = []exportFotka{}
			alba = append(alba, al)
			ids = append(ids, id)
		}
	}
	rows.Close()
	for i, id := range ids {
		if rows, err := a.db.Query(`SELECT m.id, m.jmeno FROM alba_modelky am JOIN modelky m ON m.id = am.modelka_id
			WHERE am.album_id = ? ORDER BY m.jmeno COLLATE BEZDIAKRITIKY`, id); err == nil {
			for rows.Next() {
				var mid int
				var jmeno string
				if rows.Scan(&mid, &jmeno) == nil {
					alba[i].DalsiModelky = append(alba[i].DalsiModelky, odkazy.odkaz(mid, jmeno))
				}
			}
			rows.Close()
		}
	}
	return alba
}
