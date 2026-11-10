package hledani

import (
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

// Počty hodnocených fotek alba podle srdíček: [0] = 1 srdíčko … [4] = 5 srdíček (skóre fotek v oblibenost_fotky.go)
type SrdickaAlba [5]int

type Modelka struct {
	ID             int    `json:"id"`
	Jmeno          string `json:"jmeno"`
	NarozeniDatum  string `json:"narozeniDatum"` // RRRR, RRRR-MM nebo RRRR-MM-DD
	UmrtiDatum     string `json:"umrtiDatum"`    // ve stejném tvaru; prázdné u žijící nebo neznámé
	NarozeniMisto  string `json:"narozeniMisto"`
	Narodnost      string `json:"narodnost"`
	Etnicita       string `json:"etnicita"`
	VyskaCm        int    `json:"vyskaCm"`
	VahaKg         int    `json:"vahaKg"`
	VlasyBarva     string `json:"vlasyBarva"`
	OciBarva       string `json:"ociBarva"`
	Miry           string `json:"miry"` // "Hrudník-Pas-Boky", skládá se z obvodů
	ObvodHrudnikCm int    `json:"obvodHrudnikCm"`
	ObvodPasCm     int    `json:"obvodPasCm"`
	ObvodBokyCm    int    `json:"obvodBokyCm"`
	VelikostPrsou  string `json:"velikostPrsou"`
	PrsaTyp        string `json:"prsaTyp"`
	Ochlupeni      string `json:"ochlupeni"`
	// Tetování a piercing: 1 = ano, 0 = ne, -1 = neuvedeno
	Tetovani        int    `json:"tetovani"`
	Piercing        int    `json:"piercing"`
	Vystoupeni      string `json:"vystoupeni"`
	PictorialVydani string `json:"pictorialVydani"` // jedno vydání na řádek
	Role            string `json:"role"`
	Tags            string `json:"tags"` // oddělené čárkou
	CoverURL        string `json:"coverUrl"`
	CoverID         string `json:"coverId"` // při ukládání Drive ID nebo celý odkaz
	// Výřez titulní fotky na kartě: přiblížení (1 = bez přiblížení) a poloha v procentech
	CoverZoom float64 `json:"coverZoom"`
	CoverX    float64 `json:"coverX"`
	CoverY    float64 `json:"coverY"`
	// Počet fotek modelky ve všech albech (jen pro čtení)
	PocetFotek int `json:"pocetFotek"`
	// Vydání časopisu, ve kterých modelka je, odvozená z jejích alb a centerfoldů (jen pro čtení)
	Vydani []string `json:"vydani"`

	DalsiJmena string `json:"dalsiJmena"` // pseudonymy oddělené čárkou
	Poznamka   string `json:"poznamka"`
	// 0 = nehodnoceno, 0,5–5 srdíček po polovinách (úprava schématu č. 13)
	Hodnoceni float64 `json:"hodnoceni"`
	// Jemné pořadí oblíbenosti pro řazení (jen pro čtení, oblibenost.go): srdíčka upřesněná skóre fotek
	// a porovnáním dvojic (nejvýš ±0,49, takže o celé srdíčko se pořadí nepřehodí, o půl ano); nehodnocená
	// porovnávaná modelka má odhad síly z porovnání, ostatní nehodnocené 0
	Oblibenost float64 `json:"oblibenost"`
	// Odhad hodnocení modelem vkusu (jen pro čtení): 0,5–5 po polovinách jen u nehodnocené modelky s dost jistým
	// odhadem, jinak 0
	OdhadHodnoceni float64 `json:"odhadHodnoceni"`
	// Potvrzené pořadí oblíbenosti od 1 (0 = mimo pořadí; s prahy úrovní Top N) a o kolik míst stoupla proti snímku před trendDni dny (záporné =
	// klesla; trendDni 0 = trend zatím není), jen pro čtení (oblibenost_zajem.go)
	Poradi      int `json:"poradi"`
	ZmenaPoradi int `json:"zmenaPoradi"`
	TrendDni    int `json:"trendDni"`
	// Úroveň Top N, ve které modelka potvrzeně je (10, 20, 50, 100; 0 = mimo top 100), a úroveň, na jejíž potvrzení
	// čeká (podle síly by tam patřila, ale nesplňuje prahy; 0 = nic), jen pro čtení (oblibenost_urovne.go)
	UrovenTop int `json:"urovenTop"`
	CekaNaTop int `json:"cekaNaTop"`
	// Úroveň, kterou obhajuje proti silnější vyzyvatelce (0 = nic), jen pro čtení
	ObhajujeTop int `json:"obhajujeTop"`

	// Kdy byla modelka přidána (RRRR-MM-DD HH:MM:SS); prázdné u záznamů starších než tento údaj
	Pridano string `json:"pridano"`

	// Údaje, které se u modelky nesledují (centerfold neměla…): klíče oddělené čárkou
	NetykaSe string `json:"netykaSe"`
	// Odkazy na zdroje údajů (Wikipedie a podobně), jeden na řádek
	Odkazy string `json:"odkazy"`
	// Vydání, na jejichž obálce modelka je (jen pro čtení)
	Obalky []string `json:"obalky"`
	// Vydání jejích centerfoldů (jen pro čtení); centerfold = kategorie Playmate měsíce
	Centerfoldy []string `json:"centerfoldy"`
	// Data nafocení jejích online alb (typ Pictorial online, jen pro čtení); album bez data má prázdný text
	OnlineAlba []string `json:"onlineAlba"`
	// Nejvyšší úroveň jejích alb Cyber Girl: „měsíce“, „týdne“ nebo "" (odvozená kategorie, jen pro čtení)
	CyberGirl string `json:"cyberGirl"`
	// Pictorial Playmate of the Month (kategorie Playmate měsíce i bez centerfoldu) a rok pictorialu Playmate of the
	// Year (kategorie Playmate roku; „?“ = album bez roku); odvozené z alb, jen pro čtení
	PlaymateMesice bool   `json:"playmateMesice"`
	PlaymateRoku   string `json:"playmateRoku"`
	// Od 0.02.012 se Playmate (PlaymateMesice, PlaymateRoku) odvozuje jen z čísel Playboye; tituly z jiných časopisů
	// (centerfold nebo pictorial modelky měsíce / roku) jsou tady s názvem z tabulky časopisů: „Pet of the Month“,
	// „Pet of the Year“ s rokem („?“ = bez roku); jen pro čtení
	TitulyJinde []TitulCasopisu `json:"titulyJinde"`

	// Popisy a fotografové alb modelky, jen pro hledání
	TextyAlb       string `json:"-"`
	FotografoveAlb string `json:"-"`
	// Hodnocené fotky modelky a součet jejich srdíček (model vkusu)
	FotekHodnocenych int `json:"-"`
	SrdciFotek       int `json:"-"`
	// Počty hodnocených fotek podle srdíček v každém jejím albu s hodnocenými fotkami (skóre fotek)
	SrdickaAlb []SrdickaAlba `json:"-"`
	// Shoda fotek modelky s foto:"…" v dotazu (vyčnívání nad průměr sbírky); 0 = dotaz foto: nemá
	ShodaFotek float64 `json:"shodaFotek,omitempty"`
}

// Hodnocení modelky v polovinách srdíčka (3,5 → 7)
func (m Modelka) HodnoceniPul() int { return int(math.Round(m.Hodnoceni * 2)) }

// Hodnocení modelky k zobrazení a do hledání: „3“, „3.5“
func TextHodnoceni(h float64) string {
	return strconv.FormatFloat(h, 'f', -1, 64)
}

// Písmena, která se na základní tvar nerozkládají sama
var zvlastniPismena = strings.NewReplacer("ł", "l", "ø", "o", "đ", "d", "ß", "ss", "æ", "ae", "œ", "oe", "þ", "th", "ı", "i")

// Text pro porovnávání a řazení: malá písmena bez diakritiky jakéhokoli jazyka (Zoë = zoe, Ödegaard = odegaard)
func Zjednodusit(text string) string {
	// Text jen z ASCII (většina jmen a údajů) nemá co rozkládat: stačí malá písmena. Volá se i při každém
	// porovnání v SQL (COLLATE BEZDIAKRITIKY), proto se vyplatí.
	ascii := true
	velke := false
	for i := 0; i < len(text); i++ {
		c := text[i]
		if c >= utf8.RuneSelf {
			ascii = false
			break
		}
		if 'A' <= c && c <= 'Z' {
			velke = true
		}
	}
	if ascii {
		if !velke {
			return text
		}
		return strings.ToLower(text)
	}
	rozlozeny := norm.NFD.String(strings.ToLower(text))
	var b strings.Builder
	b.Grow(len(rozlozeny))
	zbyloNeAscii := false
	for _, znak := range rozlozeny {
		if unicode.Is(unicode.Mn, znak) {
			continue
		}
		if znak >= utf8.RuneSelf {
			zbyloNeAscii = true
		}
		b.WriteRune(znak)
	}
	bez := b.String()
	if !zbyloNeAscii {
		return bez
	}
	return zvlastniPismena.Replace(bez)
}

// Porovnání pro COLLATE BEZDIAKRITIKY: dva texty jen z ASCII (většina) bajt po bajtu malými písmeny bez alokace
// (řazení velkých výsledků volá porovnání statisíckrát); jinak přes Zjednodusit
func PorovnatBezDiakritiky(a, b string) int {
	for i := 0; ; i++ {
		if i == len(a) || i == len(b) {
			for j := i; j < len(a); j++ {
				if a[j] >= utf8.RuneSelf {
					return strings.Compare(Zjednodusit(a), Zjednodusit(b))
				}
			}
			for j := i; j < len(b); j++ {
				if b[j] >= utf8.RuneSelf {
					return strings.Compare(Zjednodusit(a), Zjednodusit(b))
				}
			}
			return len(a) - len(b)
		}
		x, y := a[i], b[i]
		if x >= utf8.RuneSelf || y >= utf8.RuneSelf {
			return strings.Compare(Zjednodusit(a), Zjednodusit(b))
		}
		if 'A' <= x && x <= 'Z' {
			x += 'a' - 'A'
		}
		if 'A' <= y && y <= 'Z' {
			y += 'a' - 'A'
		}
		if x != y {
			return int(x) - int(y)
		}
	}
}

// Časopis čísla (Pinup Katalog 0.02): klíč RRRR-MM[-EDICE][@ČASOPIS], např. „1985-09@PH“, „1986-03-UK@PH“.
// Bez přípony je to Playboy (VychoziCasopis), proto se „@PB“ nepíše a klíč s ním není platný. Edice je země vydání
// v rámci časopisu; „řada“ (RadaVydani) je edice i s časopisem: u Playboye „US“ / „CZ“ jako dřív, jinak „PH/US“.
// Pohledy, které porovnávají edici s „US“ nebo „CZ“, tak čísla jiných časopisů samy vynechají.
const VychoziCasopis = "PB"

func velkePismeno(b byte) bool { return b >= 'A' && b <= 'Z' }

// RozdelitCasopis: „1985-09-UK@PH“ → „1985-09-UK“, „PH“; bez přípony časopisu vrací celý klíč a ""
func RozdelitCasopis(v string) (zaklad, casopis string) {
	if n := len(v); n >= 3 && v[n-3] == '@' && velkePismeno(v[n-2]) && velkePismeno(v[n-1]) {
		return v[:n-3], v[n-2:]
	}
	return v, ""
}

// RadaVydani: edice (země, "" = US) s časopisem ("" = Playboy) → „US“, „CZ“, „PH/US“, „PH/UK“
func RadaVydani(edice, casopis string) string {
	if edice == "" {
		edice = "US"
	}
	if casopis == "" || casopis == VychoziCasopis {
		return edice
	}
	return casopis + "/" + edice
}

// EdiceKlice: dvoupísmenná edice na konci klíče bez časopisu („1995-07-CZ“ → „CZ“), jinak ""
func EdiceKlice(zaklad string) string {
	if n := len(zaklad); n > 4 && zaklad[n-3] == '-' && velkePismeno(zaklad[n-2]) && velkePismeno(zaklad[n-1]) {
		return zaklad[n-2:]
	}
	return ""
}

// RadaKlice: řada čísla z celého klíče („1985-09@PH“ → „PH/US“, „2012-03-CZ“ → „CZ“)
func RadaKlice(v string) string {
	zaklad, casopis := RozdelitCasopis(v)
	return RadaVydani(EdiceKlice(zaklad), casopis)
}

// Ověří, zda řetězec odpovídá tvaru vydání časopisu ^\d{4}-(0[1-9]|1[0-2]|S\d{2})(-[A-Z]{2})?(@[A-Z]{2})?$ bez
// regulárního výrazu; „@PB“ (výchozí časopis) se nepíše
func JePlatneVydani(v string) bool {
	zaklad, casopis := RozdelitCasopis(v)
	return casopis != VychoziCasopis && jePlatnyZakladVydani(zaklad)
}

func jePlatnyZakladVydani(v string) bool {
	if len(v) < 7 || v[4] != '-' {
		return false
	}
	for i := 0; i < 4; i++ {
		if v[i] < '0' || v[i] > '9' {
			return false
		}
	}
	var konec int
	if v[5] == 'S' {
		if len(v) < 8 || v[6] < '0' || v[6] > '9' || v[7] < '0' || v[7] > '9' {
			return false
		}
		konec = 8
	} else {
		m := (int(v[5]-'0') * 10) + int(v[6]-'0')
		if v[5] < '0' || v[5] > '9' || v[6] < '0' || v[6] > '9' || m < 1 || m > 12 {
			return false
		}
		konec = 7
	}
	if len(v) == konec {
		return true
	}
	return len(v) == konec+3 && v[konec] == '-' &&
		v[konec+1] >= 'A' && v[konec+1] <= 'Z' &&
		v[konec+2] >= 'A' && v[konec+2] <= 'Z'
}

// Hledání modelek (pole hledání v seznamu, galerie, statistiky). Každé hledané slovo se musí najít v některém údaji
// modelky, cílené slovo („vlasy:blond“) v daném údaji; na velikosti písmen ani diakritice nezáleží. Dotaz se
// rozebere jednou (Pripravit) a pak se jen porovnává s modelkami; texty modelek, které na dotazu nezávisí,
// se připraví jednou pro snímek sbírky (snimek.go), takže psaní do pole hledání je už nepočítá znovu.

// Pole pro cílené hledání („vlasy:blond", „fotograf:\"arny freytag\"", „rok:1975"); hodnota se hledá jen v daném údaji
var klicePoleHledani = map[string]bool{
	"jmeno": true, "vlasy": true, "oci": true, "narodnost": true, "etnicita": true, "misto": true, "tag": true, "tagy": true,
	"role": true, "kategorie": true, "vyskyt": true, "fotograf": true, "rok": true, "vydani": true, "narozena": true, "edice": true,
	"prsa": true, "ochlupeni": true, "poznamka": true, "vyska": true, "vaha": true, "miry": true, "hodnoceni": true, "srdicka": true,
	"tetovani": true, "piercing": true, "obalka": true, "obalky": true, "umrti": true, "zemrela": true, "nafoceno": true,
}

// Hodnota pole cíleného hledání u modelky; počítá se jen hledané pole
func hodnotaPole(m *Modelka, klic string) string {
	anoNe := func(hodnota int) string {
		switch hodnota {
		case 1:
			return "ano yes"
		case 0:
			return "ne no"
		}
		return ""
	}
	kladne := func(cislo int) string {
		if cislo > 0 {
			return strconv.Itoa(cislo)
		}
		return ""
	}
	switch klic {
	case "jmeno":
		return m.Jmeno + "\n" + m.DalsiJmena
	case "vlasy":
		return m.VlasyBarva
	case "oci":
		return m.OciBarva
	case "narodnost":
		return m.Narodnost
	case "etnicita":
		return m.Etnicita
	case "misto":
		return m.NarozeniMisto
	case "tag", "tagy":
		return m.Tags
	case "role", "kategorie":
		return kategorieKHledani(m)
	case "vyskyt":
		return vyskytKHledani(m)
	case "fotograf":
		return m.FotografoveAlb
	case "rok", "edice":
		roky, edice := []string{}, []string{}
		// Edice podle všech čísel modelky včetně obálek, stejně jako filtr Edice v panelu (galerie.js); rok jen z vydání
		cisla := m.Vydani
		if klic == "edice" {
			cisla = append(append([]string{}, m.Vydani...), m.Obalky...)
		}
		for _, v := range cisla {
			if len(v) < 4 {
				continue
			}
			roky = append(roky, v[:4])
			edice = append(edice, RadaKlice(v))
		}
		if klic == "rok" {
			return strings.Join(roky, " ")
		}
		return strings.Join(edice, " ")
	case "vydani":
		return strings.Join(m.Vydani, " ")
	case "narozena":
		// Celé datum: narozena:1955-03 najde i měsíc (rok porovnává číselné hledání z NarozeniDatum)
		return m.NarozeniDatum
	case "prsa":
		return m.VelikostPrsou + " " + m.PrsaTyp
	case "ochlupeni":
		return m.Ochlupeni
	case "poznamka":
		return m.Poznamka
	case "vyska":
		return kladne(m.VyskaCm)
	case "vaha":
		return kladne(m.VahaKg)
	case "miry":
		return m.Miry
	case "hodnoceni", "srdicka":
		if m.Hodnoceni > 0 {
			return TextHodnoceni(m.Hodnoceni)
		}
		return ""
	case "tetovani":
		return anoNe(m.Tetovani)
	case "piercing":
		return anoNe(m.Piercing)
	case "obalka", "obalky":
		return strings.Join(m.Obalky, " ")
	case "umrti", "zemrela":
		return m.UmrtiDatum
	case "nafoceno":
		return strings.Join(m.OnlineAlba, " ")
	}
	return ""
}

// Titul modelky v jiném časopise než Playboy (odvozená kategorie)
type TitulCasopisu struct {
	Nazev string `json:"nazev"`
	Rok   string `json:"rok,omitempty"`
}

// Má modelka centerfold v Playboyi (číslo bez „@“)
func CenterfoldPlayboye(m *Modelka) bool {
	for _, v := range m.Centerfoldy {
		if _, c := RozdelitCasopis(v); c == "" || c == VychoziCasopis {
			return true
		}
	}
	return false
}

// Kategorie: zapsané v poli role a odvozené z centerfoldu, alba Cyber Girl týdne či měsíce a obálky
// (frontend/src/lib/format.js, KATEGORIE a odvozeneKategorie); obyčejné online album kategorii nedává
func kategorieKHledani(m *Modelka) string {
	var b strings.Builder
	b.WriteString(m.Role)
	if CenterfoldPlayboye(m) || m.PlaymateMesice {
		b.WriteString(", Playmate měsíce")
	}
	for _, t := range m.TitulyJinde {
		b.WriteString(", ")
		b.WriteString(t.Nazev)
		if t.Rok != "" && t.Rok != "?" {
			b.WriteString(" ")
			b.WriteString(t.Rok)
		}
	}
	if m.PlaymateRoku != "" {
		b.WriteString(", Playmate roku ")
		b.WriteString(strings.TrimSuffix(m.PlaymateRoku, "?"))
	}
	if m.CyberGirl != "" {
		b.WriteString(", Cyber Girl ")
		b.WriteString(m.CyberGirl)
	}
	if len(m.Obalky) > 0 {
		b.WriteString(", Modelka obálky")
	}
	return b.String()
}

// Výskyt: v časopise (číslo s měsícem nebo speciál), jen online (online kategorie nebo online album),
// jinak neurčeno (frontend/src/lib/format.js, vyskytModelky)
func vyskytKHledani(m *Modelka) string {
	for _, seznam := range [3][]string{m.Vydani, m.Obalky, m.Centerfoldy} {
		for _, v := range seznam {
			if JePlatneVydani(v) {
				return "casopis časopis"
			}
		}
	}
	if (m.Role != "" && vzorOnlineKategorie.MatchString(m.Role)) || len(m.OnlineAlba) > 0 {
		return "online"
	}
	return "neurceno neurčeno"
}

// Texty modelky k hledání, které na dotazu nezávisí (připraví se jednou pro snímek sbírky)
type Texty struct {
	udaje          string   // všechny údaje zjednodušené, pro obyčejná slova
	kategorie      string   // předpočítané zjednodušené kategorie a role
	vyskyt         string   // předpočítaný zjednodušený výskyt (casopis, online, neurceno)
	slovaJmena     []string // zjednodušená slova jména a pseudonymů (překlepy)
	slovaFotografu []string // zjednodušená slova fotografů alb (překlepy)
}

func PripravitTexty(m *Modelka) Texty {
	var b strings.Builder
	b.Grow(256 + len(m.Poznamka) + len(m.TextyAlb))
	zapsat := func(s string) {
		b.WriteString(s)
		b.WriteByte('\n')
	}
	zapsatSeznam := func(seznam []string) {
		for i, s := range seznam {
			if i > 0 {
				b.WriteByte(' ')
			}
			b.WriteString(s)
		}
		b.WriteByte('\n')
	}
	zapsat(m.Jmeno)
	zapsat(m.Narodnost)
	zapsat(m.Etnicita)
	zapsat(m.NarozeniMisto)
	zapsat(m.NarozeniDatum)
	zapsat(m.UmrtiDatum)
	zapsat(m.VlasyBarva)
	zapsat(m.OciBarva)
	zapsat(m.VelikostPrsou)
	zapsat(m.PrsaTyp)
	zapsat(m.Ochlupeni)
	zapsat(m.Miry)
	zapsat(m.Vystoupeni)
	zapsat(m.PictorialVydani)
	zapsat(m.Role)
	zapsat(m.Tags)
	zapsat(m.DalsiJmena)
	zapsat(m.Poznamka)
	zapsatSeznam(m.Vydani)
	zapsatSeznam(m.Obalky)
	zapsat(m.TextyAlb)
	if m.VyskaCm > 0 {
		v := strconv.Itoa(m.VyskaCm)
		b.WriteString(v)
		b.WriteByte(' ')
		b.WriteString(v)
		b.WriteString("cm")
	}
	b.WriteByte('\n')
	if m.VahaKg > 0 {
		v := strconv.Itoa(m.VahaKg)
		b.WriteString(v)
		b.WriteByte(' ')
		b.WriteString(v)
		b.WriteString("kg")
	}
	b.WriteByte('\n')
	if m.Tetovani == 1 {
		b.WriteString("tetování tetovani")
	}
	b.WriteByte('\n')
	if m.Piercing == 1 {
		b.WriteString("piercing")
	}
	jmena := m.Jmeno
	if m.DalsiJmena != "" {
		jmena += " " + m.DalsiJmena
	}
	return Texty{
		udaje:          Zjednodusit(b.String()),
		kategorie:      Zjednodusit(kategorieKHledani(m)),
		vyskyt:         Zjednodusit(vyskytKHledani(m)),
		slovaJmena:     strings.Fields(Zjednodusit(jmena)),
		slovaFotografu: strings.Fields(Zjednodusit(m.FotografoveAlb)),
	}
}

// Online kategorie (KATEGORIE s online: true ve frontend/src/lib/format.js), i anglicky
var vzorOnlineKategorie = regexp.MustCompile(`(?i)cyber|coed|\bmuses?\b|creator|tvůrkyně|online|playboy ?plus|playboy\.?com`)

// Slova hledání: volitelná negace (- nebo !), cílené pole:hodnota (i s mezerou za dvojtečkou) i pole:"více slov", uvozovky i obyčejná slova
// Slovo dotazu: klíč s hodnotou (porovnání čísla, nebo seznam hodnot NEBO přes čárku, každá i v uvozovkách:
// kategorie:playmate,"cyber girl"), fráze v uvozovkách, nebo samostatné slovo. Skupiny: 1 negace, 2 klíč, 3 hodnota |
// 4 negace, 5 fráze | 6 slovo. Stejný vzor má frontend (lib/format.js, rozlozitDotaz).
var vzorSlovaHledani = regexp.MustCompile(`(-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+(?:[.,]\d+)?|(?:"[^"]*"|[^\s",:]+)(?:\s*,\s*(?:"[^"]*"|[^\s",:]+))*)?|(-|!)?"([^"]*)"|(\S+)`)
var vzorRozsahCisel = regexp.MustCompile(`^(\d+)\s*-\s*(\d+)$`)

// Rozsah roků v cíleném hledání (rok:1970-1979, narozena:1980..1989) a rok s měsícem (rok:1975-01)
var (
	vzorRozsahRoku      = regexp.MustCompile(`^\s*\d{4}\s*(-|\.\.)\s*\d{4}\s*$`)
	vzorRokMesicHledani = regexp.MustCompile(`^\s*\d{4}-(0[1-9]|1[0-2]|S\d{2})(-[A-Z]{2})?(@[A-Z]{2})?\s*$`)
)

// Je klíč příkazu známý hledání (vlasy:, vyska:, pas: …)? Galerie fotek podle toho odliší příkazy od textu.
func JeZnamyKlic(klic string) bool {
	k := Zjednodusit(klic)
	return klicePoleHledani[k] || klicDesetinnychPoli[k]
}

// Číselná pole s desetinnou hodnotou (chytré hledání: pas > 60, bmi < 18,5, věk < 21, bez fotek)
var klicDesetinnychPoli = map[string]bool{"pas": true, "hrudnik": true, "boky": true, "bmi": true, "whr": true, "vek": true, "fotek": true}

// Hodnota číselného pole modelky; false = údaj chybí (obvod 0, bez výšky nebo váhy, bez narození či čísla)
func DesetinnaHodnota(m *Modelka, klic string) (float64, bool) {
	switch klic {
	case "pas":
		return float64(m.ObvodPasCm), m.ObvodPasCm > 0
	case "hrudnik":
		return float64(m.ObvodHrudnikCm), m.ObvodHrudnikCm > 0
	case "boky":
		return float64(m.ObvodBokyCm), m.ObvodBokyCm > 0
	case "bmi":
		if m.VyskaCm <= 0 || m.VahaKg <= 0 {
			return 0, false
		}
		v := float64(m.VyskaCm) / 100
		return float64(m.VahaKg) / (v * v), true
	case "whr":
		if m.ObvodPasCm <= 0 || m.ObvodBokyCm <= 0 {
			return 0, false
		}
		return float64(m.ObvodPasCm) / float64(m.ObvodBokyCm), true
	case "vek":
		vek, ok := VekVPrvnimCisle(m)
		return float64(vek), ok
	case "fotek":
		return float64(m.PocetFotek), true
	}
	return 0, false
}

// Věk modelky v jejím nejstarším čísle (rok a měsíc vydání proti roku a měsíci narození)
func VekVPrvnimCisle(m *Modelka) (int, bool) {
	rokN, ok := rychlyRok4(m.NarozeniDatum)
	if !ok {
		return 0, false
	}
	prvni := ""
	for _, v := range m.Vydani {
		if _, ok := rychlyRok4(v); ok && (prvni == "" || v < prvni) {
			prvni = v
		}
	}
	if prvni == "" {
		return 0, false
	}
	rokV, _ := rychlyRok4(prvni)
	vek := rokV - rokN
	mesic := func(text string) int {
		if len(text) >= 7 && text[4] == '-' && text[5] >= '0' && text[5] <= '1' {
			if n, err := strconv.Atoi(text[5:7]); err == nil && n >= 1 && n <= 12 {
				return n
			}
		}
		return 0
	}
	if mv, mn := mesic(prvni), mesic(m.NarozeniDatum); mv > 0 && mn > 0 && mv < mn {
		vek--
	}
	return vek, vek > 10 && vek < 100
}

var vzorDesetinnehoCisla = regexp.MustCompile(`^\d+(?:[.,]\d+)?$`)

// Desetinný filtr: porovnání (>=60, <18,5), rozsah (60..65, 60-65, 0,65-0,72) nebo přesná hodnota
func parsovatDesetinnyFiltr(hodnota string) (op string, od, do float64, ok bool) {
	h := strings.ReplaceAll(strings.TrimSpace(hodnota), " ", "")
	cislo := func(text string) (float64, bool) {
		if !vzorDesetinnehoCisla.MatchString(text) {
			return 0, false
		}
		x, err := strconv.ParseFloat(strings.Replace(text, ",", ".", 1), 64)
		return x, err == nil
	}
	for _, o := range []string{">=", "<=", "==", ">", "<", "="} {
		if strings.HasPrefix(h, o) {
			x, ok := cislo(h[len(o):])
			if o == "==" {
				o = "="
			}
			return o, x, 0, ok
		}
	}
	for _, oddelovac := range []string{"..", "-"} {
		if a, b, ma := strings.Cut(h, oddelovac); ma {
			x, ok1 := cislo(a)
			y, ok2 := cislo(b)
			if ok1 && ok2 {
				return "..", math.Min(x, y), math.Max(x, y), true
			}
		}
	}
	x, ok := cislo(h)
	return "=", x, 0, ok
}

func vyhovujeDesetinne(x float64, op string, od, do float64) bool {
	const eps = 1e-9
	switch op {
	case ">=":
		return x >= od-eps
	case "<=":
		return x <= od+eps
	case ">":
		return x > od+eps
	case "<":
		return x < od-eps
	case "..":
		return x >= od-eps && x <= do+eps
	}
	// Přesná hodnota s přesností zadaného čísla (bmi:18 = 18,0–18,99…, whr:0,7 = 0,70–0,79…)
	return x >= od-eps && x < od+presnost(od)
}

func presnost(x float64) float64 {
	for _, p := range []float64{1, 0.1, 0.01, 0.001} {
		if math.Abs(x/p-math.Round(x/p)) < 1e-6 {
			return p
		}
	}
	return 0.0001
}

// Rozpoznání numerického filtru: op (">=", "<=", ">", "<", "=", ".."), numOd, numDo
func parsovatNumerickyFiltr(hodnota string) (op string, numOd, numDo int, ok bool) {
	h := strings.TrimSpace(hodnota)
	// Porovnání; když za znaménkem není číslo, zkusí se další (">=x" dál jako ">" s „=x“ a nakonec rozsah)
	for _, o := range [...]struct{ predpona, op string }{{">=", ">="}, {"<=", "<="}, {"==", "="}, {">", ">"}, {"<", "<"}, {"=", "="}} {
		if strings.HasPrefix(h, o.predpona) {
			if n, err := strconv.Atoi(strings.TrimSpace(h[len(o.predpona):])); err == nil {
				return o.op, n, 0, true
			}
		}
	}
	if odStr, doStr, ma := strings.Cut(h, ".."); ma && !strings.Contains(doStr, "..") {
		od, err1 := strconv.Atoi(strings.TrimSpace(odStr))
		do, err2 := strconv.Atoi(strings.TrimSpace(doStr))
		if err1 == nil && err2 == nil {
			return "..", min(od, do), max(od, do), true
		}
	}
	if m := vzorRozsahCisel.FindStringSubmatch(h); len(m) == 3 {
		od, _ := strconv.Atoi(m[1])
		do, _ := strconv.Atoi(m[2])
		return "..", min(od, do), max(od, do), true
	}
	if n, err := strconv.Atoi(h); err == nil {
		return "=", n, 0, true
	}
	return "", 0, 0, false
}

// Jedna podmínka filtru srdíček; meze v polovinách srdíčka
type filtrHodnoceni struct {
	op     string
	od, do int
}

var (
	vzorPulSrdicka   = regexp.MustCompile(`^\d+(?:[.,]\d+)?$`)
	vzorDesetinnaPul = regexp.MustCompile(`^\d[.,][05]$`)
)

// Filtr srdíček modelky po polovinách: číslo (3, 3.5, 3,5), porovnání (>=3,5), rozsah (3..4,5 nebo 3-4) nebo
// výčet oddělený čárkou (3,4 = 3 nebo 4 srdíčka). „Číslice,5“ a „číslice,0“ je desetinná čárka: 3,5 = tři a půl
// (dřívější výčet „4,5“ = 4 nebo 5 se tak čte jako 4½). Vrací podmínky (stačí jedna) v polovinách; ok = false,
// když hodnota číslem není.
func parsovatFiltrHodnoceni(hodnota string) (filtry []filtrHodnoceni, ok bool) {
	h := strings.ReplaceAll(strings.TrimSpace(hodnota), " ", "")
	pul := func(text string) (int, bool) {
		if !vzorPulSrdicka.MatchString(text) {
			return 0, false
		}
		x, err := strconv.ParseFloat(strings.Replace(text, ",", ".", 1), 64)
		if err != nil {
			return 0, false
		}
		// Hodnota mezi polovinami (3.3) se zaokrouhlí na nejbližší polovinu
		return int(math.Round(x * 2)), true
	}
	for _, op := range []string{">=", "<=", "==", ">", "<", "="} {
		if strings.HasPrefix(h, op) {
			if n, ok := pul(h[len(op):]); ok {
				if op == "==" {
					op = "="
				}
				return []filtrHodnoceni{{op: op, od: n}}, true
			}
			return nil, false
		}
	}
	for _, oddelovac := range []string{"..", "-"} {
		if odStr, doStr, ma := strings.Cut(h, oddelovac); ma && !strings.Contains(doStr, oddelovac) {
			od, ok1 := pul(odStr)
			do, ok2 := pul(doStr)
			if ok1 && ok2 {
				return []filtrHodnoceni{{op: "..", od: min(od, do), do: max(od, do)}}, true
			}
		}
	}
	if vzorDesetinnaPul.MatchString(h) {
		n, _ := pul(h)
		return []filtrHodnoceni{{op: "=", od: n}}, true
	}
	for _, cast := range strings.Split(h, ",") {
		if cast == "" {
			continue
		}
		n, ok := pul(cast)
		if !ok {
			return nil, false
		}
		filtry = append(filtry, filtrHodnoceni{op: "=", od: n})
	}
	return filtry, len(filtry) > 0
}

func vyhovujeCislo(hodnota int, op string, numOd, numDo int) bool {
	switch op {
	case ">=":
		return hodnota >= numOd
	case "<=":
		return hodnota <= numOd
	case ">":
		return hodnota > numOd
	case "<":
		return hodnota < numOd
	case "=", "==":
		return hodnota == numOd
	case "..":
		return hodnota >= numOd && hodnota <= numDo
	default:
		return false
	}
}

func rychlyRok4(s string) (int, bool) {
	if len(s) < 4 {
		return 0, false
	}
	var r int
	for i := 0; i < 4; i++ {
		if s[i] < '0' || s[i] > '9' {
			return 0, false
		}
		r = r*10 + int(s[i]-'0')
	}
	return r, r > 0
}

func vyhovujeNumericky(m *Modelka, klic, op string, numOd, numDo int) bool {
	switch klic {
	case "vyska":
		if m.VyskaCm <= 0 {
			return false
		}
		return vyhovujeCislo(m.VyskaCm, op, numOd, numDo)
	case "vaha":
		if m.VahaKg <= 0 {
			return false
		}
		return vyhovujeCislo(m.VahaKg, op, numOd, numDo)
	case "hodnoceni", "srdicka":
		// Meze jsou v polovinách srdíčka (parsovatFiltrHodnoceni)
		if m.Hodnoceni <= 0 && numOd > 0 {
			return false
		}
		return vyhovujeCislo(m.HodnoceniPul(), op, numOd, numDo)
	case "narozena":
		if rok, ok := rychlyRok4(m.NarozeniDatum); ok {
			return vyhovujeCislo(rok, op, numOd, numDo)
		}
		return false
	case "rok":
		for _, v := range m.Vydani {
			if rok, ok := rychlyRok4(v); ok && vyhovujeCislo(rok, op, numOd, numDo) {
				return true
			}
		}
		return false
	}
	return false
}

// Slovo jen z číslic (rok, výška…): hledá se přesně, bez tolerance překlepů
func jeCislo(text string) bool {
	if text == "" {
		return false
	}
	for _, r := range text {
		if (r < '0' || r > '9') && r != '-' && r != '.' {
			return false
		}
	}
	return true
}

func vyhovujeVarianty(text string, varianty []string) bool {
	zjedn := Zjednodusit(text)
	for _, v := range varianty {
		if strings.Contains(zjedn, v) {
			return true
		}
	}
	return false
}

// Levenshteinova vzdálenost mezi dvěma řetězci run (počet vložení, smazání a záměn znaků)
func VzdalenostLevenshtein(s1, s2 string) int {
	var r1Buf, r2Buf [64]rune
	var r1, r2 []rune
	if len(s1) <= len(r1Buf) {
		n := 0
		for _, r := range s1 {
			r1Buf[n] = r
			n++
		}
		r1 = r1Buf[:n]
	} else {
		r1 = []rune(s1)
	}
	if len(s2) <= len(r2Buf) {
		n := 0
		for _, r := range s2 {
			r2Buf[n] = r
			n++
		}
		r2 = r2Buf[:n]
	} else {
		r2 = []rune(s2)
	}
	len1, len2 := len(r1), len(r2)
	if len1 == 0 {
		return len2
	}
	if len2 == 0 {
		return len1
	}
	var buf1, buf2 [65]int
	var predchozi, aktualni []int
	if len2 < len(buf1) {
		predchozi = buf1[:len2+1]
		aktualni = buf2[:len2+1]
	} else {
		predchozi = make([]int, len2+1)
		aktualni = make([]int, len2+1)
	}
	for j := 0; j <= len2; j++ {
		predchozi[j] = j
	}
	for i := 1; i <= len1; i++ {
		aktualni[0] = i
		ri := r1[i-1]
		for j := 1; j <= len2; j++ {
			cena := 1
			if ri == r2[j-1] {
				cena = 0
			}
			smazat := predchozi[j] + 1
			vlozit := aktualni[j-1] + 1
			zamenit := predchozi[j-1] + cena
			m := smazat
			if vlozit < m {
				m = vlozit
			}
			if zamenit < m {
				m = zamenit
			}
			aktualni[j] = m
		}
		predchozi, aktualni = aktualni, predchozi
	}
	return predchozi[len2]
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// Maximální povolená editační vzdálenost podle délky hledaného slova (max 1–2 překlepy pro jména a fotografy)
func maxPovolenaVzdalenost(delka int) int {
	if delka <= 3 {
		return 0
	}
	if delka <= 6 {
		return 1
	}
	return 2
}

// Hledané slovo (zjednodušené) je podřetězcem některého slova textu (zjednodušených), nebo se od něj liší nejvýš
// o povolený počet překlepů (Levenshtein)
func odpovidaSlovoFuzzy(slovaTextu []string, hledane string) bool {
	if hledane == "" {
		return true
	}
	delka := utf8.RuneCountInString(hledane)
	maxD := maxPovolenaVzdalenost(delka)
	for _, s := range slovaTextu {
		if strings.Contains(s, hledane) {
			return true
		}
		// Vzdálenost je aspoň rozdíl délek: slovo o víc znaků delší nebo kratší se počítat nemusí
		if maxD > 0 && absInt(utf8.RuneCountInString(s)-delka) <= maxD && VzdalenostLevenshtein(s, hledane) <= maxD {
			return true
		}
	}
	return false
}

// Každé hledané slovo odpovídá některému slovu textu (obojí zjednodušené), přesně nebo s drobnými překlepy
func odpovidajiSlovaFuzzy(slovaTextu, hledana []string) bool {
	for _, h := range hledana {
		if !odpovidaSlovoFuzzy(slovaTextu, h) {
			return false
		}
	}
	return true
}

// Ověří, zda hledaný dotaz (i víceslovný) odpovídá textu (přesně nebo s drobnými překlepy v jednotlivých slovech)
func OdpovidaTextFuzzy(text string, hledanyDotaz string) bool {
	return odpovidajiSlovaFuzzy(strings.Fields(Zjednodusit(text)), strings.Fields(Zjednodusit(hledanyDotaz)))
}

// Jak se podmínka hledání porovnává s modelkou
const (
	hledatSlovo       = iota // obyčejné slovo ve všech údajích (s překlepy ve jméně a u fotografů)
	hledatRokMesic           // rok:1975-01 – předpona vydání
	hledatNafoceno           // nafoceno:2004 – předpona data online alba
	hledatSrdicka            // hodnoceni:, srdicka: po polovinách srdíčka
	hledatCislo              // vyska:, vaha:, rok:, narozena: s číselným filtrem
	hledatPole               // známé pole
	hledatNeznamePole        // neznámé pole: „klic:hodnota“ jako obyčejný text
	hledatDesetinne          // pas:, hrudnik:, boky:, bmi:, whr:, vek:, fotek: s číselným filtrem (i desetinným)
	hledatSkupina            // (…) nebo a | b: stačí jedna z alternativ (každá je celý dotaz)
	hledatFoto               // foto:"na pláži" – obsah fotek slovy; shody doplní volající (NastavitShodyFotek)
)

// Jedno slovo dotazu rozebrané předem
type podminkaHledani struct {
	druh     int
	negace   bool
	klic     string     // zjednodušený klíč cíleného hledání
	hodnota  string     // oříznutá hodnota (předpona vydání)
	jehla    string     // „klic:hodnota“ hledané v údajích (neznámé pole, srdíčka, která nejsou číslem)
	varianty []string   // zjednodušené hodnoty oddělené čárkou (stačí jedna)
	slova    [][]string // slova každé varianty pro překlepy; nil = překlepy se nezkoušejí
	op       string     // číselný filtr
	od, do   int
	odF, doF float64 // desetinný filtr (hledatDesetinne)
	meze     []filtrHodnoceni
	nebo     []Dotaz         // alternativy skupiny (hledatSkupina)
	text     string          // původní text foto: (s diakritikou pro textový model)
	shody    map[int]float64 // foto: modelky s odpovídajícími fotkami; nil = zatím nevyhodnoceno (neomezuje)
}

// Rozebraný dotaz; prázdný = odpovídá každá modelka
type Dotaz []podminkaHledani

// Hodnoty oddělené čárkou, oříznuté a bez prázdných
func variantyHledani(hodnota string) []string {
	var varianty []string
	for _, v := range strings.Split(hodnota, ",") {
		if v = strings.TrimSpace(v); v != "" {
			varianty = append(varianty, v)
		}
	}
	return varianty
}

func slovaVariant(varianty []string) [][]string {
	slova := make([][]string, len(varianty))
	for i, v := range varianty {
		slova[i] = strings.Fields(v)
	}
	return slova
}

// Svislítko na nejvyšší úrovni (mimo uvozovky a závorky) dělí dotaz na alternativy
func rozdelitNebo(s string) []string {
	var casti []string
	hloubka, uvozovky, od := 0, false, 0
	for i, z := range s {
		switch {
		case z == '"':
			uvozovky = !uvozovky
		case uvozovky:
		case z == '(':
			hloubka++
		case z == ')':
			if hloubka > 0 {
				hloubka--
			}
		case z == '|' && hloubka == 0:
			casti = append(casti, s[od:i])
			od = i + 1
		}
	}
	return append(casti, s[od:])
}

type zavorka struct {
	negace bool
	text   string
}

// Závorky na nejvyšší úrovni (i s - nebo ! před nimi) se vyjmou jako skupiny; neuzavřená sahá do konce dotazu
func vyjmoutZavorky(s string) (string, []zavorka) {
	var zbytek strings.Builder
	var skupiny []zavorka
	uvozovky := false
	b := []byte(s)
	for i := 0; i < len(b); i++ {
		z := b[i]
		if z == '"' {
			uvozovky = !uvozovky
		}
		if uvozovky || z != '(' {
			zbytek.WriteByte(z)
			continue
		}
		negace := false
		if t := strings.TrimRight(zbytek.String(), " "); strings.HasSuffix(t, "-") || strings.HasSuffix(t, "!") {
			if p := len(t) - 1; p == 0 || t[p-1] == ' ' {
				negace = true
				obsah := t[:p]
				zbytek.Reset()
				zbytek.WriteString(obsah)
			}
		}
		hloubka, uvnitr, j := 1, false, i+1
		for ; j < len(b) && hloubka > 0; j++ {
			switch {
			case b[j] == '"':
				uvnitr = !uvnitr
			case uvnitr:
			case b[j] == '(':
				hloubka++
			case b[j] == ')':
				hloubka--
			}
		}
		konec := j
		if hloubka == 0 {
			konec = j - 1
		}
		skupiny = append(skupiny, zavorka{negace: negace, text: s[i+1 : konec]})
		zbytek.WriteByte(' ')
		i = j - 1
	}
	return zbytek.String(), skupiny
}

// Rozbor dotazu: negace (-tag:), čárka jako OR (vlasy:blond,zrzava), numerické porovnání (>175, 1970..1979),
// neuzavřené uvozovky; slovo, které nic neomezuje (prázdná hodnota, samá čárka), se vynechá.
// Svislítko je NEBO mezi celými podmínkami (blond | zrzava, rok:1970-1979 | rok:1980-1989) a závorky je
// seskupují: (rok:1970-1979 | rok:1980-1989) vyska:>175. foto:"…" hledá v obsahu fotek (shody doplní volající).
func Pripravit(vyhledavani string) Dotaz {
	// Pokud je v dotazu lichý počet uvozovek (uživatel píše uvozovku a ještě ji neuzavřel), pomyslně ji uzavřeme na konci
	if strings.Count(vyhledavani, "\"")%2 != 0 {
		vyhledavani += "\""
	}
	if alternativy := rozdelitNebo(vyhledavani); len(alternativy) > 1 {
		p := podminkaHledani{druh: hledatSkupina}
		for _, a := range alternativy {
			d := Pripravit(a)
			if len(d) == 0 {
				// Prázdná alternativa (píše se další): nic neomezuje, ostatní se zatím neberou jako podmínka
				continue
			}
			p.nebo = append(p.nebo, d)
		}
		if len(p.nebo) == 0 {
			return nil
		}
		if len(p.nebo) == 1 {
			return p.nebo[0]
		}
		return Dotaz{p}
	}
	zbytek, zavorky := vyjmoutZavorky(vyhledavani)
	h := pripravitSlova(zbytek)
	for _, z := range zavorky {
		if d := Pripravit(z.text); len(d) > 0 {
			h = append(h, podminkaHledani{druh: hledatSkupina, negace: z.negace, nebo: []Dotaz{d}})
		}
	}
	return h
}

// TextyFotek: texty všech foto:"…" v dotazu (i ve skupinách), každý jednou
func (h Dotaz) TextyFotek() []string {
	var v []string
	videno := map[string]bool{}
	h.prochazet(func(p *podminkaHledani) {
		if p.druh == hledatFoto && !videno[p.text] {
			videno[p.text] = true
			v = append(v, p.text)
		}
	})
	return v
}

// NastavitShodyFotek: modelky, jejichž fotky odpovídají textu foto:"…" (id → síla shody)
func (h Dotaz) NastavitShodyFotek(text string, shody map[int]float64) {
	h.prochazet(func(p *podminkaHledani) {
		if p.druh == hledatFoto && p.text == text {
			p.shody = shody
		}
	})
}

func (h Dotaz) prochazet(f func(p *podminkaHledani)) {
	for i := range h {
		f(&h[i])
		for _, d := range h[i].nebo {
			d.prochazet(f)
		}
	}
}

func pripravitSlova(vyhledavani string) Dotaz {
	var h Dotaz
	for _, casti := range vzorSlovaHledani.FindAllStringSubmatch(vyhledavani, -1) {
		var negace bool
		var klic, hodnota string
		if casti[2] != "" {
			negace = casti[1] != ""
			klic = casti[2]
			hodnota = casti[3]
		} else if strings.HasPrefix(casti[0], "\"") || strings.HasPrefix(casti[0], "-\"") || strings.HasPrefix(casti[0], "!\"") {
			negace = casti[4] != ""
			hodnota = casti[5]
		} else {
			slovo := casti[6]
			if strings.HasPrefix(slovo, "-") || strings.HasPrefix(slovo, "!") {
				negace = true
				slovo = slovo[1:]
			}
			if i := strings.Index(slovo, ":"); i > 0 {
				klic = slovo[:i]
				hodnota = slovo[i+1:]
			} else {
				hodnota = slovo
			}
		}
		// Uvozovky jen ohraničují hodnoty (i jednotlivé v seznamu NEBO), do hodnoty nepatří
		hodnota = strings.ReplaceAll(hodnota, "\"", "")
		hodnotaZjedn := Zjednodusit(strings.TrimSpace(hodnota))
		if hodnotaZjedn == "" {
			continue
		}
		p := podminkaHledani{negace: negace}
		if klic == "" {
			p.druh, p.varianty = hledatSlovo, variantyHledani(hodnotaZjedn)
			if len(p.varianty) == 0 {
				continue
			}
			// Překlepy jen u hledaných slov s písmeny (ne u čísel a vylučovaných slov): 1975 nenajde 1976, -anna nevyloučí Anju
			if !negace && !jeCislo(hodnotaZjedn) {
				p.slova = slovaVariant(p.varianty)
			}
			h = append(h, p)
			continue
		}
		p.klic = Zjednodusit(klic)
		if p.klic == "foto" || p.klic == "obsah" {
			p.druh, p.text = hledatFoto, strings.TrimSpace(hodnota)
			h = append(h, p)
			continue
		}
		op, numOd, numDo, ok := parsovatNumerickyFiltr(hodnota)
		rokNeboNarozena := p.klic == "rok" || p.klic == "narozena"
		// Rok kratší než čtyři číslice (rok:197) je začátek roku, ne přesný rok: hledá se jako text
		if ok && op == "=" && rokNeboNarozena && len(strings.TrimSpace(hodnota)) < 4 {
			ok = false
		}
		// Rozsah roků jen se čtyřmístnými mezemi: „1975-01“ je měsíc vydání (narození), ne rozsah 1–1975
		if ok && op == ".." && rokNeboNarozena && !vzorRozsahRoku.MatchString(hodnota) {
			ok = false
		}
		switch {
		case p.klic == "rok" && vzorRokMesicHledani.MatchString(hodnota):
			// rok:1975-01 = modelky čísla z daného měsíce (předpona vydání)
			p.druh, p.hodnota = hledatRokMesic, strings.TrimSpace(hodnota)
		case p.klic == "nafoceno":
			// nafoceno:2004, nafoceno:2004-06 = online album nafocené v daném roce či měsíci (předpona data)
			p.druh, p.varianty = hledatNafoceno, variantyHledani(hodnotaZjedn)
			if len(p.varianty) == 0 {
				continue
			}
		case p.klic == "hodnoceni" || p.klic == "srdicka":
			// Srdíčka i po polovinách: hodnoceni:3.5, srdicka:3,5, hodnoceni:>=3,5, hodnoceni:3..4, hodnoceni:3,4 (3 nebo 4)
			meze, zname := parsovatFiltrHodnoceni(hodnota)
			p.druh, p.meze = hledatSrdicka, meze
			if !zname {
				p.jehla = p.klic + ":" + hodnotaZjedn
			}
		case klicDesetinnychPoli[p.klic]:
			// Obvody, BMI, poměr pas : boky, věk v prvním čísle a počet fotek: pas:<=60, bmi:<18,5, whr:0,65-0,72
			op, od, do, ok := parsovatDesetinnyFiltr(hodnota)
			if !ok {
				p.druh, p.jehla = hledatNeznamePole, p.klic+":"+hodnotaZjedn
				break
			}
			p.druh, p.op, p.odF, p.doF = hledatDesetinne, op, od, do
		case ok && (p.klic == "vyska" || p.klic == "vaha" || rokNeboNarozena):
			p.druh, p.op, p.od, p.do = hledatCislo, op, numOd, numDo
		case klicePoleHledani[p.klic]:
			p.druh, p.varianty = hledatPole, variantyHledani(hodnotaZjedn)
			if len(p.varianty) == 0 {
				// Jen čárka (píše se další hodnota): slovo nic neomezuje
				continue
			}
			// Překlepy se tolerují u jména a fotografa (i ve vyloučení: -jmeno:Pamella vyloučí Pamelu)
			if p.klic == "jmeno" || p.klic == "fotograf" {
				p.slova = slovaVariant(p.varianty)
			}
		default:
			// Neznámé pole: hledá se celé slovo jako obyčejný text
			p.druh, p.jehla = hledatNeznamePole, p.klic+":"+hodnotaZjedn
		}
		h = append(h, p)
	}
	return h
}

// Splňuje modelka všechny podmínky? t jsou její texty k hledání; nil = spočítají se, až budou potřeba
func (h Dotaz) Odpovida(m *Modelka, t *Texty) bool {
	texty := func() *Texty {
		if t == nil {
			pripravene := PripravitTexty(m)
			t = &pripravene
		}
		return t
	}
	for i := range h {
		p := &h[i]
		var shoda bool
		switch p.druh {
		case hledatSlovo:
			shoda = obsahujeNekterou(texty().udaje, p.varianty)
			if !shoda && p.slova != nil {
				for _, slova := range p.slova {
					if odpovidajiSlovaFuzzy(texty().slovaJmena, slova) || odpovidajiSlovaFuzzy(texty().slovaFotografu, slova) {
						shoda = true
						break
					}
				}
			}
		case hledatRokMesic:
			for _, v := range m.Vydani {
				if strings.HasPrefix(v, p.hodnota) {
					shoda = true
					break
				}
			}
		case hledatNafoceno:
		nafocenoCyklus:
			for _, v := range p.varianty {
				for _, d := range m.OnlineAlba {
					if d != "" && strings.HasPrefix(d, v) {
						shoda = true
						break nafocenoCyklus
					}
				}
			}
		case hledatSrdicka:
			if p.jehla != "" {
				shoda = strings.Contains(texty().udaje, p.jehla)
			}
			if !shoda {
				for _, f := range p.meze {
					if vyhovujeNumericky(m, p.klic, f.op, f.od, f.do) {
						shoda = true
						break
					}
				}
			}
		case hledatCislo:
			shoda = vyhovujeNumericky(m, p.klic, p.op, p.od, p.do)
		case hledatPole:
			switch p.klic {
			case "role", "kategorie":
				shoda = obsahujeNekterou(texty().kategorie, p.varianty)
			case "vyskyt":
				shoda = obsahujeNekterou(texty().vyskyt, p.varianty)
			case "tetovani", "piercing":
				text := hodnotaPole(m, p.klic)
			anoNeCyklus:
				for _, slovo := range strings.Fields(text) {
					for _, v := range p.varianty {
						if slovo == v {
							shoda = true
							break anoNeCyklus
						}
					}
				}
			default:
				text := hodnotaPole(m, p.klic)
				shoda = vyhovujeVarianty(text, p.varianty)
			}
			if !shoda && p.slova != nil {
				slovaTextu := texty().slovaJmena
				if p.klic == "fotograf" {
					slovaTextu = texty().slovaFotografu
				}
				for _, slova := range p.slova {
					if odpovidajiSlovaFuzzy(slovaTextu, slova) {
						shoda = true
						break
					}
				}
			}
		case hledatNeznamePole:
			shoda = strings.Contains(texty().udaje, p.jehla)
		case hledatDesetinne:
			if x, zname := DesetinnaHodnota(m, p.klic); zname {
				shoda = vyhovujeDesetinne(x, p.op, p.odF, p.doF)
			}
		case hledatSkupina:
			for _, d := range p.nebo {
				if d.Odpovida(m, texty()) {
					shoda = true
					break
				}
			}
		case hledatFoto:
			if p.shody == nil {
				continue // obsah fotek není k dispozici: neomezuje (ani s negací; okno to řekne)
			}
			_, shoda = p.shody[m.ID]
		}
		if shoda == p.negace {
			return false
		}
	}
	return true
}

// Text (zjednodušený) obsahuje některou z hodnot
func obsahujeNekterou(text string, varianty []string) bool {
	for _, v := range varianty {
		if strings.Contains(text, v) {
			return true
		}
	}
	return false
}
