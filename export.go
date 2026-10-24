package main

import (
	"database/sql"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
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
	Nazev   string `yaml:"nazev"`
	Typ     string `yaml:"typ"`
	Pridano string `yaml:"pridano,omitempty"` // kdy přibyla první fotka alba
	Vydani  string `yaml:"vydani,omitempty"`
	// Jen u typu Pictorial online: kdy bylo album nafoceno nebo zveřejněno (RRRR, RRRR-MM nebo RRRR-MM-DD)
	Datum    string `yaml:"datum,omitempty"`
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
	Hodnoceni       cisloUdaje    `yaml:"hodnoceni,omitempty"`
	NarozeniDatum   string        `yaml:"narozeni_datum,omitempty"`
	UmrtiDatum      string        `yaml:"umrti_datum,omitempty"`
	NarozeniMisto   string        `yaml:"narozeni_misto,omitempty"`
	Narodnost       string        `yaml:"narodnost,omitempty"`
	Etnicita        string        `yaml:"etnicita,omitempty"`
	VyskaCm         cisloUdaje    `yaml:"vyska_cm,omitempty"`
	VahaKg          cisloUdaje    `yaml:"vaha_kg,omitempty"`
	VlasyBarva      string        `yaml:"vlasy,omitempty"`
	OciBarva        string        `yaml:"oci,omitempty"`
	ObvodHrudnikCm  cisloUdaje    `yaml:"hrudnik_cm,omitempty"`
	ObvodPasCm      cisloUdaje    `yaml:"pas_cm,omitempty"`
	ObvodBokyCm     cisloUdaje    `yaml:"boky_cm,omitempty"`
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
const verzeExportu = 8

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
	// Opravené a přeskočené klíče ze souboru (do souboru se nezapisuje)
	Opravy []string `yaml:"-"`
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
			album := exportAlbum{Nazev: f.Album, Typ: f.Typ, Fotograf: f.Fotograf, Popis: f.Popis, Pridano: f.Pridano, Datum: f.DatumAlba}
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

// Export celé sbírky. Běží nad kopií aplikace, která chyby nehlásí do okna, ale sbírá: chyba čtení i v pomocných
// funkcích, které ji jinak jen ohlásí (alba bez fotek, vydání, články, výběry), export zruší, aby se neuložil
// neúplný soubor, který vypadá jako úspěšný export
func (a *App) exportovat() ([]byte, error) {
	var chyby []string
	exp := *a
	exp.naChybu = func(zprava string) { chyby = append(chyby, zprava) }
	data, err := exp.sestavitExport()
	if err != nil {
		return nil, err
	}
	if len(chyby) > 0 {
		return nil, fmt.Errorf("export není úplný: %s", chyby[0])
	}
	return data, nil
}

func (a *App) sestavitExport() ([]byte, error) {
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
	} else {
		a.chyba("export", err)
	}
	dalsiModelky := a.dalsiModelkyAlb()
	for _, m := range modelky {
		vsechny, err := a.nactiFotografie(dotazFotekModelky, false, true, m.ID)
		if err != nil {
			return nil, fmt.Errorf("fotky modelky %s se nepodařilo přečíst: %w", m.Jmeno, err)
		}
		// Sdílené album se zapisuje jen u hlavní modelky, u ostatních je jen jejich jméno v dalsi_modelky
		var fotky []Fotografie
		for _, f := range doplnitDalsiModelkyZ(vsechny, dalsiModelky) {
			if f.ModelkaID == m.ID {
				fotky = append(fotky, f)
			}
		}
		exportovanoFotek += len(fotky)
		e := exportModelka{
			Jmeno: m.Jmeno, Pridano: m.Pridano, DalsiJmena: m.DalsiJmena, Hodnoceni: cisloUdaje{Hodnota: m.Hodnoceni},
			NarozeniDatum: m.NarozeniDatum, UmrtiDatum: m.UmrtiDatum, NarozeniMisto: m.NarozeniMisto, Narodnost: m.Narodnost, Etnicita: m.Etnicita,
			VyskaCm: cisloUdaje{Hodnota: m.VyskaCm}, VahaKg: cisloUdaje{Hodnota: m.VahaKg}, VlasyBarva: m.VlasyBarva, OciBarva: m.OciBarva,
			ObvodHrudnikCm: cisloUdaje{Hodnota: m.ObvodHrudnikCm}, ObvodPasCm: cisloUdaje{Hodnota: m.ObvodPasCm}, ObvodBokyCm: cisloUdaje{Hodnota: m.ObvodBokyCm}, Miry: m.Miry,
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
		// Cover nemá v exportu datum alba, proto každá fotka nese své
		for i := range album.Fotky {
			if album.Fotky[i].Pridano == "" {
				album.Fotky[i].Pridano = album.Pridano
			}
		}
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
		"# Import údaje doplňuje a opravuje; prázdný nebo chybějící údaj ponechá, smaže jen údaj s hodnotou „-“. Modelky, alba ani fotky nemaže.\n\n"
	return append([]byte(hlavicka), yamlData...), nil
}

type VysledekImportu struct {
	NoveModelky     int `json:"noveModelky"`
	UpraveneModelky int `json:"upraveneModelky"`
	Alba            int `json:"alba"`
	NoveFotky       int `json:"noveFotky"`
	// Co se z souboru nepodařilo převzít; prázdné, když prošlo vše
	Chyby []string `json:"chyby"`
	// Opravené překlepy v klíčích a přeskočené neznámé klíče
	Opravy []string `json:"opravy"`
	// Soubor nešel přečíst vůbec, v databázi se nic nezměnilo
	Selhalo string `json:"selhalo"`
}

func prvniNeprazdny(novy, puvodni string) string {
	if strings.TrimSpace(novy) != "" {
		return strings.TrimSpace(novy)
	}
	return puvodni
}

// Vložení fotek alba, které v databázi ještě nejsou, a převzetí jejich hodnocení, otočení a pořadí
// Příkaz připravený jednou pro celý import; SQLite by jinak sestavoval stejný dotaz u každé fotky znovu.
// Mimo import (nebo když příprava selže) se vrátí obal, který dotaz pošle obyčejně.
func (a *App) pripraveny(dotaz string) pripravenyDotaz {
	if a.vImportu {
		if a.pripravene == nil {
			a.pripravene = map[string]*sql.Stmt{}
		}
		if stmt, ok := a.pripravene[dotaz]; ok {
			return stmt
		}
		if stmt, err := a.db.Prepare(dotaz); err == nil {
			a.pripravene[dotaz] = stmt
			return stmt
		}
	}
	return obycejnyDotaz{a.db, dotaz}
}

type pripravenyDotaz interface {
	Exec(args ...interface{}) (sql.Result, error)
	QueryRow(args ...interface{}) *sql.Row
}

type obycejnyDotaz struct {
	db    dotazovac
	dotaz string
}

func (o obycejnyDotaz) Exec(args ...interface{}) (sql.Result, error) {
	return o.db.Exec(o.dotaz, args...)
}
func (o obycejnyDotaz) QueryRow(args ...interface{}) *sql.Row { return o.db.QueryRow(o.dotaz, args...) }

func (a *App) importovatFotky(modelkaID int, album exportAlbum, vysledek *VysledekImportu, kde string) {
	if len(album.Fotky) == 0 {
		return
	}
	// Album se zjistí (nebo založí) jednou; fotky se pak hledají a zapisují přímo v tabulce fotek
	albumID, err := zajistitAlbum(a.db, modelkaID, album.Nazev, album.Typ)
	if err != nil {
		a.chyba("import "+kde, err)
		return
	}
	for i, f := range album.Fotky {
		ids := parseDriveIDs(f.ID)
		if len(ids) == 0 {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: fotka %d nemá platné ID z Disku", kde, i+1))
			continue
		}

		var id int64
		if err := a.pripraveny("SELECT id FROM fotky WHERE album_id = ? AND drive_file_id = ?").QueryRow(albumID, ids[0]).Scan(&id); err != nil {
			// Nová fotka přebírá datum ze souboru (fotky, jinak alba), bez něj okamžik importu
			vlozeno, err := a.pripraveny("INSERT INTO fotky (album_id, drive_file_id, pridano) VALUES (?, ?, ?)").Exec(
				albumID, ids[0], prvniNeprazdny(f.Pridano, prvniNeprazdny(album.Pridano, ted())))
			if err != nil {
				a.chyba("import "+kde, err)
				continue
			}
			id, _ = vlozeno.LastInsertId()
			vysledek.NoveFotky++
		}

		// Srdíčka, otočení a ruční pořadí jedním zápisem; prázdný údaj ponechá stávající
		hodnoceni := min(max(f.Hodnoceni, 0), 5)
		var poradi interface{}
		if album.RucniPoradi {
			poradi = i + 1
		}
		if _, err := a.pripraveny(`UPDATE fotky SET hodnoceni = CASE WHEN ?1 > 0 THEN ?1 ELSE hodnoceni END,
			rotace = CASE WHEN ?2 <> 0 THEN ?2 ELSE rotace END, poradi = COALESCE(?3, poradi) WHERE id = ?4`).Exec(
			hodnoceni, ((f.Rotace%360)+360)%360, poradi, id); err != nil {
			a.chyba("import "+kde, err)
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
		if album.Typ == typOnline {
			// Smazání vydání, které online album nemá, nic nemění
			if vydani != smazatUdaj {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: online album nepatří k vydání „%s“ (kdy bylo nafoceno, patří do „datum“)", kde, vydani))
			}
		} else if vydani == smazatUdaj {
			a.SetVydaniAlba(modelkaID, album.Nazev, album.Typ, "")
		} else if !a.SetVydaniAlba(modelkaID, album.Nazev, album.Typ, vydani) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: vydání „%s“ není ve tvaru RRRR-MM ani RRRR", kde, vydani))
		}
	}
	if datum := strings.TrimSpace(album.Datum); datum != "" {
		if album.Typ != typOnline {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: datum nafocení má jen album typu %s", kde, typOnline))
		} else if datum == smazatUdaj {
			a.SetDatumAlba(modelkaID, album.Nazev, album.Typ, "")
		} else if !platneDatum(datum) {
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: datum „%s“ není ve tvaru RRRR-MM-DD, RRRR-MM ani RRRR", kde, datum))
		} else {
			a.SetDatumAlba(modelkaID, album.Nazev, album.Typ, datum)
		}
	}
	if strings.TrimSpace(album.Popis) != "" || strings.TrimSpace(album.Fotograf) != "" {
		var popis, fotograf string
		a.db.QueryRow("SELECT COALESCE(popis, ''), COALESCE(fotograf, '') FROM alba WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?",
			modelkaID, album.Nazev, album.Typ).Scan(&popis, &fotograf)
		a.SetPopisAlba(modelkaID, album.Nazev, album.Typ, hodnotaZImportu(album.Popis, popis), hodnotaZImportu(album.Fotograf, fotograf))
	}
}

// YAML v textu souboru. V Markdownu bloky ```yaml (každý zvlášť), jinak úvodní hlavička mezi řádky ---,
// jinak celý soubor; v souboru YAML celý obsah.
func yamlZTextu(nazev, text string) []string {
	text = strings.ReplaceAll(strings.TrimPrefix(text, "\ufeff"), "\r\n", "\n")
	if !strings.HasSuffix(strings.ToLower(nazev), ".md") {
		return []string{text}
	}
	// Bloky kódu po řádcích: otevírací ``` nebo ~~~ s jazykem yaml, yml nebo bez jazyka; blok jiného jazyka
	// (json…) se přeskočí celý, aby jeho zavírací čára neotevřela falešný blok
	var bloky []string
	var blok []string
	otevreny, vzit := "", false
	for _, radek := range strings.Split(text, "\n") {
		orezany := strings.TrimSpace(radek)
		if otevreny == "" {
			if m := vzorOteviraniBloku.FindStringSubmatch(orezany); m != nil {
				otevreny = m[1]
				jazyk := strings.ToLower(m[2])
				vzit = jazyk == "" || jazyk == "yaml" || jazyk == "yml"
				blok = nil
			}
			continue
		}
		if strings.HasPrefix(orezany, otevreny) && strings.Trim(orezany, otevreny[:1]) == "" {
			if vzit {
				bloky = append(bloky, strings.Join(blok, "\n")+"\n")
			}
			otevreny = ""
			continue
		}
		blok = append(blok, radek)
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
	// Otevření bloku kódu v Markdownu: ``` nebo ~~~ (i delší) a případně jazyk
	vzorOteviraniBloku = regexp.MustCompile("^(```+|~~~+)[ \\t]*([A-Za-z0-9_+-]*)[ \\t]*$")
	vzorHlavickyMd     = regexp.MustCompile(`(?s)\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\z)`)
)

// Ručně psaný YAML: tabulátor v odsazení nahradí dvěma mezerami, odrážku Markdownu „* “ nebo „+ “ před
// položkou (převod z Google Dokumentů) pomlčkou, hodnotu s dvojtečkou uprostřed (např. „poznamka: Playmate
// měsíce: září“) a samotnou pomlčku (smazání údaje) dá do uvozovek. Použije se, jen když se text bez úprav načíst nedá.
var vzorOdrazkyMd = regexp.MustCompile(`^(\s*)[*+] ([A-Za-z_]+:)`)

var vzorRadkuHodnoty = regexp.MustCompile(`^(\s*(?:- )?[A-Za-z_]+):[ \t]+(.+?)[ \t]*$`)

// Klíče formátu exportu (podle značek yaml ve strukturách); řádek „Zdroj: Wikipedie“ uvnitř textu klíčem není
var znameKlice = func() map[string]bool {
	klice := map[string]bool{}
	for _, v := range []interface{}{exportDat{}, exportModelka{}, exportAlbum{}, exportFotka{}, exportVyrez{}, exportCover{}, exportVydani{}, exportVyberu{}, exportFotkyVyberu{}, exportClanek{}} {
		t := reflect.TypeOf(v)
		for i := 0; i < t.NumField(); i++ {
			if nazev := strings.Split(t.Field(i).Tag.Get("yaml"), ",")[0]; nazev != "" {
				klice[nazev] = true
			}
		}
	}
	return klice
}()

var vzorKlice = regexp.MustCompile(`^\s*(?:- )?([A-Za-z_]+):(?:\s|$)`)

func jeZnamyKlic(radek string) bool {
	m := vzorKlice.FindStringSubmatch(radek)
	return m != nil && znameKlice[m[1]]
}

func opravitRucniYaml(text string) string {
	radky := strings.Split(text, "\n")
	// Blok textu („klíč: |“), jehož řádky ztratily odsazení: odsadí se až po další klíč na úrovni klíče bloku
	blokOdsazeni := -1
	for i, r := range radky {
		odsazeni := len(r) - len(strings.TrimLeft(r, " \t"))
		r = strings.ReplaceAll(r[:odsazeni], "\t", "  ") + r[odsazeni:]
		odsazeni = len(r) - len(strings.TrimLeft(r, " "))
		if blokOdsazeni >= 0 {
			obsah := strings.TrimSpace(r)
			if obsah != "" && odsazeni <= blokOdsazeni && (jeZnamyKlic(r) || strings.HasPrefix(obsah, "- ") || strings.HasPrefix(obsah, "* ")) {
				blokOdsazeni = -1
			} else {
				if obsah != "" && odsazeni <= blokOdsazeni {
					r = strings.Repeat(" ", blokOdsazeni+2) + obsah
				}
				radky[i] = r
				continue
			}
		}
		r = vzorOdrazkyMd.ReplaceAllString(r, "$1- $2")
		if m := vzorRadkuHodnoty.FindStringSubmatch(r); m != nil {
			hodnota := m[2]
			if hodnota == "|" || hodnota == ">" || hodnota == "|-" || hodnota == ">-" || hodnota == "|+" || hodnota == ">+" {
				// Úroveň klíče bloku (u položky seznamu „- klíč“ je klíč o dvě pozice dál)
				blokOdsazeni = len(m[1]) - len(strings.TrimLeft(m[1], " "))
				if strings.HasPrefix(strings.TrimLeft(m[1], " "), "- ") {
					blokOdsazeni += 2
				}
			} else if hodnota == smazatUdaj {
				// „klíč: -“ (smazání údaje) je v YAML začátek seznamu; hodnotou se stane až v uvozovkách
				r = m[1] + `: "-"`
			} else if k := strings.Index(hodnota, " #"); !strings.ContainsAny(hodnota[:1], `"'|>[{&*!%@`+"`") && strings.Contains(hodnota, ": ") && (k < 0 || strings.Index(hodnota, ": ") < k) {
				r = m[1] + ": " + strconv.Quote(hodnota)
			}
		}
		radky[i] = r
	}
	return strings.Join(radky, "\n")
}

// Jeden dokument: celý export, seznam modelek, nebo jedna modelka s údaji přímo nahoře (bez „modelky:“)
func nacistDokument(text string) (exportDat, error) {
	data, err := nacistDokumentPresne(text)
	if err == nil {
		return data, nil
	}
	if opraveny := opravitRucniYaml(text); opraveny != text {
		if data, errOpraveny := nacistDokumentPresne(opraveny); errOpraveny == nil {
			return data, nil
		}
	}
	return data, err
}

func nacistDokumentPresne(text string) (exportDat, error) {
	var data exportDat
	// Nejdřív strom dokumentu: překlepy v klíčích se opraví dřív, než se údaje přiřadí k polím
	var koren yaml.Node
	if err := yaml.Unmarshal([]byte(text), &koren); err != nil {
		return data, fmt.Errorf("není platný YAML: %v", err)
	}
	var opravy []string
	opravitKlice(&koren, &opravy)

	errCely := koren.Decode(&data)
	if errCely == nil && (len(data.Modelky) > 0 || len(data.Covery) > 0 || len(data.Vydani) > 0 || len(data.Vybery) > 0) {
		data.Opravy = opravy
		return data, nil
	}
	var seznam []exportModelka
	if koren.Decode(&seznam) == nil && len(seznam) > 0 {
		return exportDat{Verze: verzeExportu, Modelky: seznam, Opravy: opravy}, nil
	}
	var jedna exportModelka
	errJedna := koren.Decode(&jedna)
	if errJedna == nil && strings.TrimSpace(jedna.Jmeno) != "" {
		return exportDat{Verze: data.Verze, Modelky: []exportModelka{jedna}, Opravy: opravy}, nil
	}
	// Jedna modelka s chybným údajem (např. text místo čísla): hláška řekne, co je špatně
	if errJedna != nil && strings.TrimSpace(jedna.Jmeno) != "" {
		return data, fmt.Errorf("má u modelky „%s“ chybný údaj: %v", strings.TrimSpace(jedna.Jmeno), errJedna)
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
			for _, oprava := range data.Opravy {
				celek.Opravy = append(celek.Opravy, fmt.Sprintf("%s, %s", kratky, oprava))
			}
		}
	}
	return celek, nil
}

func (a *App) importovatCelek(data exportDat) VysledekImportu {
	vysledek := VysledekImportu{Chyby: []string{}, Opravy: append([]string{}, data.Opravy...)}
	// Import zapisuje na vlastním spojení; v režimu jen pro čtení (poškozená nebo novější databáze) nesmí
	if a.chybaStartu != "" {
		vysledek.Selhalo = "Program běží jen pro čtení, import se neprovedl. " + a.chybaStartu
		return vysledek
	}
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
	db, err := sql.Open("sqlite", a.cestaDb+dsnDatabaze)
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
	imp := &App{ctx: a.ctx, db: db, vImportu: true, naChybu: func(zprava string) { chybyZapisu = append(chybyZapisu, zprava) }}
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
		return VysledekImportu{Chyby: []string{}, Opravy: []string{}, Selhalo: vysledek.Selhalo}
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
	// Výsledek párování modelky ze souboru s modelkami ve sbírce
	const (
		nalezena = iota
		zalozit
		nejednoznacna
	)
	// Číslo modelky ze souboru platí jen v databázi, ze které export vznikl. Když ve sbírce zbývá víc
	// nespárovaných modelek téhož jména a číslo žádnou neurčí, modelka se nezaloží znovu (opakovaný import
	// do jiné databáze by jinak pokaždé přidal další kopie), ale přeskočí se s hláškou.
	najit := func(jmeno string, cislo int) (Modelka, int) {
		kandidati := podleJmena[zjednodusit(jmeno)]
		for _, m := range kandidati {
			if cislo != 0 && m.ID == cislo && !sparovana[m.ID] {
				return m, nalezena
			}
		}
		var volne []Modelka
		for _, m := range kandidati {
			if !sparovana[m.ID] {
				volne = append(volne, m)
			}
		}
		switch {
		case len(kandidati) == 0:
			return Modelka{}, zalozit
		// Jméno bez čísla, které má ve sbírce jediná modelka: je to ona, i když už ji doplnil jiný soubor téhož importu
		case cislo == 0 && len(kandidati) == 1:
			return kandidati[0], nalezena
		case len(volne) == 1 && len(kandidati) == 1:
			return volne[0], nalezena
		// Všechny modelky toho jména už spároval tento import (soubor se dvěma Annami do prázdné databáze)
		case len(volne) == 0:
			return Modelka{}, zalozit
		}
		return Modelka{}, nejednoznacna
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

		m, stav := najit(jmeno, e.Cislo)
		if stav == nejednoznacna {
			kdo := jmeno
			if e.Cislo != 0 {
				kdo = fmt.Sprintf("%s [%d]", jmeno, e.Cislo)
			}
			vysledek.Chyby = append(vysledek.Chyby, kdo+": ve sbírce je víc modelek tohoto jména a číslo nesedí, modelka přeskočena")
			continue
		}
		if stav == zalozit {
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

		m.DalsiJmena = hodnotaZImportu(e.DalsiJmena, m.DalsiJmena)
		// Datum v jiném tvaru se ohlásí a stávající zůstane
		for _, pole := range []struct {
			nazev   string
			ze, kam *string
		}{{"narozeni_datum", &e.NarozeniDatum, &m.NarozeniDatum}, {"umrti_datum", &e.UmrtiDatum, &m.UmrtiDatum}} {
			if hodnota := hodnotaZImportu(*pole.ze, *pole.kam); platneDatum(hodnota) {
				*pole.kam = hodnota
			} else {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: %s „%s“ není ve tvaru RRRR, RRRR-MM nebo RRRR-MM-DD", jmeno, pole.nazev, hodnota))
			}
		}
		m.NarozeniMisto = hodnotaZImportu(e.NarozeniMisto, m.NarozeniMisto)
		m.Narodnost = hodnotaZImportu(e.Narodnost, m.Narodnost)
		m.Etnicita = hodnotaZImportu(e.Etnicita, m.Etnicita)
		m.VyskaCm = cisloZImportu(e.VyskaCm, m.VyskaCm)
		m.VahaKg = cisloZImportu(e.VahaKg, m.VahaKg)
		m.VlasyBarva = hodnotaZImportu(e.VlasyBarva, m.VlasyBarva)
		m.OciBarva = hodnotaZImportu(e.OciBarva, m.OciBarva)
		m.ObvodHrudnikCm = cisloZImportu(e.ObvodHrudnikCm, m.ObvodHrudnikCm)
		m.ObvodPasCm = cisloZImportu(e.ObvodPasCm, m.ObvodPasCm)
		m.ObvodBokyCm = cisloZImportu(e.ObvodBokyCm, m.ObvodBokyCm)
		m.Miry = hodnotaZImportu(e.Miry, m.Miry)
		m.VelikostPrsou = hodnotaZImportu(e.VelikostPrsou, m.VelikostPrsou)
		// Hodnota mimo nabídku formuláře by se při další úpravě ve formuláři ztratila: ohlásí se a stávající zůstane
		for _, pole := range []struct {
			nazev    string
			ze, kam  *string
			moznosti []string
		}{{"prsa_typ", &e.PrsaTyp, &m.PrsaTyp, moznostiPrsaTyp}, {"ochlupeni", &e.Ochlupeni, &m.Ochlupeni, moznostiOchlupeni}} {
			if strings.TrimSpace(*pole.ze) == smazatUdaj {
				*pole.kam = ""
			} else if hodnota, ok := volbaZNabidky(*pole.ze, pole.moznosti); !ok {
				vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("%s: %s „%s“ není v nabídce (%s)", jmeno, pole.nazev, hodnota, strings.Join(pole.moznosti, ", ")))
			} else {
				*pole.kam = hodnotaZImportu(hodnota, *pole.kam)
			}
		}
		m.Tetovani = anoNeZImportu(e.Tetovani, m.Tetovani)
		m.Piercing = anoNeZImportu(e.Piercing, m.Piercing)
		m.Role = hodnotaZImportu(e.Role, m.Role)
		m.Tags = hodnotaZImportu(e.Tags, m.Tags)
		m.Vystoupeni = hodnotaZImportu(e.Vystoupeni, m.Vystoupeni)
		m.PictorialVydani = hodnotaZImportu(e.PictorialVydani, m.PictorialVydani)
		m.Poznamka = hodnotaZImportu(e.Poznamka, m.Poznamka)
		m.Odkazy = hodnotaZImportu(e.Odkazy, m.Odkazy)

		// Výřez patří ke konkrétní titulní fotce: nová fotka bez výřezu v souboru dostane výchozí
		smazatTitulni := strings.TrimSpace(e.TitulniFotka) == smazatUdaj
		if ids := parseDriveIDs(e.TitulniFotka); len(ids) > 0 {
			m.CoverID = ids[0]
		} else if strings.TrimSpace(e.TitulniFotka) != "" && !smazatTitulni {
			vysledek.Chyby = append(vysledek.Chyby, jmeno+": titulní fotka nemá platné ID z Disku")
		}
		if !a.UpdateModelka(m) {
			vysledek.Chyby = append(vysledek.Chyby, jmeno+": údaje modelky se nepodařilo uložit")
			continue
		}
		// Prázdná titulní fotka v UpdateModelka stávající ponechá; pomlčka ji smaže i s výřezem
		if smazatTitulni {
			a.db.Exec("UPDATE modelky SET drive_cover_id = NULL, cover_zoom = NULL, cover_x = NULL, cover_y = NULL WHERE id = ?", m.ID)
			m.CoverID, m.CoverURL = "", ""
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
		if e.Hodnoceni.Smazat || e.Hodnoceni.Hodnota != 0 {
			a.SetHodnoceni(m.ID, e.Hodnoceni.Hodnota)
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
			vysledek.Chyby = append(vysledek.Chyby, fmt.Sprintf("cover: vydání „%s“ není ve tvaru RRRR-MM nebo RRRR-Snn (s příponou edice, např. 2011-07-CZ)", vydani))
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
		a.chyba("výběr souborů k importu", err)
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
			return VysledekImportu{Chyby: []string{}, Opravy: []string{}, Selhalo: fmt.Sprintf("Soubor „%s“ se nepodařilo přečíst: %v", filepath.Base(cesta), err)}
		}
		soubory[cesta] = data
	}
	data, err := slozitSoubory(soubory, cesty)
	if err != nil {
		return VysledekImportu{Chyby: []string{}, Opravy: []string{}, Selhalo: err.Error()}
	}
	return a.importovatCelek(data)
}

func (a *App) prazdnaAlba(modelkaID int, odkazy odkazyNaModelky) []exportAlbum {
	var alba []exportAlbum
	rows, err := a.db.Query(`SELECT id, album, typ, vydani, spojit, COALESCE(popis, ''), COALESCE(fotograf, ''), COALESCE(netyka_se, ''), COALESCE(datum, '')
		FROM alba WHERE modelka_id = ? AND NOT EXISTS (SELECT 1 FROM fotky f WHERE f.album_id = alba.id) ORDER BY album COLLATE BEZDIAKRITIKY, typ`, modelkaID)
	if err != nil {
		a.chyba("export", err)
		return nil
	}
	var ids []int64
	for rows.Next() {
		var id int64
		var al exportAlbum
		if rows.Scan(&id, &al.Nazev, &al.Typ, &al.Vydani, &al.Spojit, &al.Popis, &al.Fotograf, &al.NetykaSe, &al.Datum) == nil {
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
		} else {
			a.chyba("export", err)
		}
	}
	return alba
}
