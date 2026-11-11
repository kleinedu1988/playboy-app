package sbirka

import (
	"database/sql"
)

// Dotazovac spouští dotazy v databázi i uvnitř transakce.
type Dotazovac interface {
	Exec(dotaz string, args ...any) (sql.Result, error)
	Query(dotaz string, args ...any) (*sql.Rows, error)
	QueryRow(dotaz string, args ...any) *sql.Row
}

// OdkazModelky představuje ID a jméno další modelky u sdíleného alba.
type OdkazModelky struct {
	ID    int    `json:"id"`
	Jmeno string `json:"jmeno"`
}

// Fotografie představuje jeden snímek v albu modelky nebo obálku vydání.
type Fotografie struct {
	ID           int            `json:"id"`
	ModelkaID    int            `json:"modelkaId"`
	Album        string         `json:"album"`
	Typ          string         `json:"typ"`
	URL          string         `json:"url"`
	Rotace       int            `json:"rotace"`
	Spojit       bool           `json:"spojit"`
	JmenoModelky string         `json:"jmenoModelky"`
	Vydani       string         `json:"vydani"`
	Popis        string         `json:"popis"`
	Fotograf     string         `json:"fotograf"`
	DatumAlba    string         `json:"datumAlba"`
	Hodnoceni    int            `json:"hodnoceni"`
	Poradi       int            `json:"poradi"`
	Pridano      string         `json:"pridano"`
	DalsiModelky []OdkazModelky `json:"dalsiModelky"`
	DriveID      string         `json:"driveId"`
	AlbumID      int64          `json:"albumId"`
}

// Zaloha představuje uloženou zálohu databáze.
type Zaloha struct {
	Soubor    string `json:"soubor"`
	Cas       string `json:"cas"`
	Duvod     string `json:"duvod"`
	Modelek   int    `json:"modelek"`
	Fotek     int    `json:"fotek"`
	Poskozena bool   `json:"poskozena"`
}

// VydaniKalendare představuje jeden řádek v kalendáři vydání.
type VydaniKalendare struct {
	Vydani     string `json:"vydani"`
	Cover      bool   `json:"cover"`
	Centerfold bool   `json:"centerfold"`
	Pictorial  bool   `json:"pictorial"`
	Nahled     string `json:"nahled"`  // adresa obrázku: cover, jinak centerfold, jinak pictorial
	Modelka    string `json:"modelka"` // jméno modelky z centerfoldu
	// Modelka čísla (0.02.043): z centerfoldu (i bez fotek), jinak z alba s titulem měsíce (Pet of the Month bez
	// centerfoldu ve sbírce), jinak jediná modelka pictorialů čísla – pro hero Kalendáře a Obálek; Odkud je
	// „centerfold“, „titul“ nebo „pictorial“
	ModelkaCisla string `json:"modelkaCisla,omitempty"`
	ModelkaOdkud string `json:"modelkaOdkud,omitempty"`
}

// NedostupnySoubor popisuje fotku, jejíž soubor na Google Disku je nedostupný.
type NedostupnySoubor struct {
	FotoID    int    `json:"fotoId"` // 0 = titulní fotka modelky
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
	Opakovane bool   `json:"opakovane"`
}

// KontrolaSouboru je výsledek kontroly dostupnosti souborů na Disku.
type KontrolaSouboru struct {
	Zkontrolovano int                `json:"zkontrolovano"`
	Nedostupne    []NedostupnySoubor `json:"nedostupne"`
	Neovereno     int                `json:"neovereno"`
	Davka         bool               `json:"davka"`
}

// VysledekVlozeni shrnuje hromadné vložení fotek do alba.
type VysledekVlozeni struct {
	Vlozeno    int `json:"vlozeno"`
	Nedostupne int `json:"nedostupne"`
	Duplicitni int `json:"duplicitni"`
	Neovereno  int `json:"neovereno"`
}

// VysledekPresunu shrnuje přesun fotek mezi alby.
type VysledekPresunu struct {
	Presunuto  int `json:"presunuto"`
	Duplicitni int `json:"duplicitni"`
}

// VyberFotky drží členství odebrané fotky ve výběru pro případné vrácení.
type VyberFotky struct {
	VyberID int `json:"vyberId"`
	Poradi  int `json:"poradi"`
}

// ObnovaFotky uchovává všechny údaje odebrané fotky pro akci Zpět.
type ObnovaFotky struct {
	Vybery       []VyberFotky `json:"vybery"`
	DalsiModelky []int        `json:"dalsiModelky"`
	NetykaSe     string       `json:"netykaSe"`
	ModelkaID    int          `json:"modelkaId"`
	Album        string       `json:"album"`
	Typ          string       `json:"typ"`
	DriveID      string       `json:"driveId"`
	Vydani       string       `json:"vydani"`
	Datum        string       `json:"datum"`
	Rotace       int          `json:"rotace"`
	Spojit       bool         `json:"spojit"`
	Hodnoceni    int          `json:"hodnoceni"`
	Poradi       int          `json:"poradi"`
	Pridano      string       `json:"pridano"`
	Popis        string       `json:"popis"`
	Fotograf     string       `json:"fotograf"`
}

// VydaniInfo uchovává doplňkové údaje o vydání časopisu.
type VydaniInfo struct {
	Vydani        string `json:"vydani"`
	Poznamka      string `json:"poznamka"`
	Stav          string `json:"stav"`
	ModelkaObalky int    `json:"modelkaObalky"`
	JmenoObalky   string `json:"jmenoObalky"`
	NaObalce      string `json:"naObalce"`
	Nazev         string `json:"nazev"`
}

// Vyber představuje vlastní pojmenovaný výběr fotek.
type Vyber struct {
	ID    int    `json:"id"`
	Nazev string `json:"nazev"`
	Pocet int    `json:"pocet"`
}

// Special představuje speciální vydání časopisu (RRRR-Snn).
type Special struct {
	Vydani string `json:"vydani"`
	Nazev  string `json:"nazev"`
}

// Clanek představuje článek, rozhovor nebo jiný text přiřazený k vydání časopisu.
type Clanek struct {
	ID           int      `json:"id"`
	Vydani       string   `json:"vydani"`
	Strana       int      `json:"strana"` // 0 = neuvedena
	Rubrika      string   `json:"rubrika"`
	Nazev        string   `json:"nazev"`
	Autor        string   `json:"autor"`
	ModelkaID    int      `json:"modelkaId"` // 0 = žádná
	JmenoModelky string   `json:"jmenoModelky"`
	Druh         string   `json:"druh"`
	Text         string   `json:"text"`
	Skeny        []string `json:"skeny"`
	SkenyURL     []string `json:"skenyUrl"`
	SkenyOdkazy  string   `json:"skenyOdkazy"`
}

// NalezClanku je článek nalezený hledáním a úryvek textu kolem první shody.
type NalezClanku struct {
	ID           int    `json:"id"`
	Vydani       string `json:"vydani"`
	Strana       int    `json:"strana"`
	Rubrika      string `json:"rubrika"`
	Nazev        string `json:"nazev"`
	JmenoModelky string `json:"jmenoModelky"`
	Ukazka       string `json:"ukazka"`
}

// NalezTextu je výsledek full-textového hledání napříč články i popisy alb s BM25 relevancí.
type NalezTextu struct {
	Druh      string  `json:"druh"`      // "clanek" nebo "album"
	ZdrojID   int     `json:"zdrojId"`   // id článku nebo alba
	Vydani    string  `json:"vydani"`    // vydání (např. 1975-05)
	Nazev     string  `json:"nazev"`     // název článku nebo alba
	Rubrika   string  `json:"rubrika"`   // rubrika článku nebo typ alba
	Autor     string  `json:"autor"`     // autor článku nebo fotograf
	ModelkaID int     `json:"modelkaId"` // id modelky
	Ukazka    string  `json:"ukazka"`    // úryvek textu s kontextem
	Relevance float64 `json:"relevance"` // BM25 skóre relevance
}

// TagFotky je jedna položka v pevném katalogu tagů fotek.
type TagFotky struct {
	Klic  string `json:"klic"`
	Nazev string `json:"nazev"`
}

// SkupinaTagu seskupuje příbuzné tagy fotek v katalogu.
type SkupinaTagu struct {
	Klic    string     `json:"klic"`
	Nazev   string     `json:"nazev"`
	Vylucna bool       `json:"vylucna"`
	Tagy    []TagFotky `json:"tagy"`
}

// AlbumSbirky představuje album modelky se vším, co potřebuje Přehled, statistiky, kontrola i návrhy.
type AlbumSbirky struct {
	ID                      int64
	ModelkaID               int
	Jmeno                   string
	Nazev, Typ              string
	Vydani, Datum, Fotograf string
	Popis, Neni             string
	Fotek, Hodnocenych      int
	SoucetFotek             int64
}

// PolozkaStatistiky je jedna položka žebříčku ve statistikách.
type PolozkaStatistiky struct {
	Nazev string `json:"nazev"`
	Pocet int    `json:"pocet"`
}

// DesetiletiStatistiky obsahuje počty centerfoldů a čísel v jednom desetiletí.
type DesetiletiStatistiky struct {
	Desetileti  int            `json:"desetileti"`
	Centerfoldy int            `json:"centerfoldy"`
	Cisla       int            `json:"cisla"`
	Edice       map[string]int `json:"edice"`
}

// Statistiky shrnuje statistiky sbírky pro Přehled.
type Statistiky struct {
	Centerfoldu        int                    `json:"centerfoldu"`
	Desetileti         []DesetiletiStatistiky `json:"desetileti"`
	Vek                []PolozkaStatistiky    `json:"vek"`
	VekMedian          float64                `json:"vekMedian"`
	VekNejcastej       int                    `json:"vekNejcastejsi"`
	VekZnamy           int                    `json:"vekZnamy"`
	Fotografove        []PolozkaStatistiky    `json:"fotografove"`
	FotografuCelkem    int                    `json:"fotografuCelkem"`
	ModelkyFotografu   map[string][]int       `json:"modelkyFotografu"`
	Narodnosti         []PolozkaStatistiky    `json:"narodnosti"`
	NarodnostiCelkem   int                    `json:"narodnostiCelkem"`
	ModelekSNarodnosti int                    `json:"modelekSNarodnosti"`
}

// BodVyvoje představuje číselný údaj v jednom období (medián, kvartily a počet modelek).
type BodVyvoje struct {
	Obdobi int     `json:"obdobi"`
	Median float64 `json:"median"`
	Dolni  float64 `json:"dolni"`
	Horni  float64 `json:"horni"`
	N      int     `json:"n"`
}

// RadaVyvoje sdružuje časovou řadu jednoho číselného údaje po desetiletích a pětiletích.
type RadaVyvoje struct {
	Klic       string      `json:"klic"`
	Nazev      string      `json:"nazev"`
	Jednotka   string      `json:"jednotka"`
	Odvozene   bool        `json:"odvozene"`
	Desetinna  int         `json:"desetinna"`
	Znamych    int         `json:"znamych"`
	Chybi      []int       `json:"chybi"`
	Desetileti []BodVyvoje `json:"desetileti"`
	Petileti   []BodVyvoje `json:"petileti"`
}

// PodilVyvoje udává počet modelek v každé kategorii v jednom období.
type PodilVyvoje struct {
	Obdobi int            `json:"obdobi"`
	Pocty  map[string]int `json:"pocty"`
	N      int            `json:"n"`
}

// KategorieVyvoje představuje vývoj zastoupení jedné kategorie v čase.
type KategorieVyvoje struct {
	Klic       string        `json:"klic"`
	Nazev      string        `json:"nazev"`
	Kategorie  []string      `json:"kategorie"`
	Radek      string        `json:"radek"`
	NazevRadku string        `json:"nazevRadku"`
	Znamych    int           `json:"znamych"`
	Chybi      []int         `json:"chybi"`
	Desetileti []PodilVyvoje `json:"desetileti"`
}

// VyvojVCase obsahuje všechny časové řady a kategorie pro zobrazení vývoje v čase.
type VyvojVCase struct {
	Edice      string            `json:"edice"`
	Desetileti []int             `json:"desetileti"`
	Modelek    int               `json:"modelek"`
	Ciselne    []RadaVyvoje      `json:"ciselne"`
	Podily     []KategorieVyvoje `json:"podily"`
}
