package main

import (
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Hledání modelek (pole hledání v seznamu, galerie, statistiky). Každé hledané slovo se musí najít v některém údaji
// modelky, cílené slovo („vlasy:blond“) v daném údaji; na velikosti písmen ani diakritice nezáleží. Dotaz se
// rozebere jednou (pripravitHledani) a pak se jen porovnává s modelkami; texty modelek, které na dotazu nezávisí,
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
		return m.fotografoveAlb
	case "rok", "edice":
		roky, edice := []string{}, []string{}
		for _, v := range m.Vydani {
			if len(v) < 4 {
				continue
			}
			roky = append(roky, v[:4])
			if len(v) > 4 && v[len(v)-3] == '-' && v[len(v)-2] >= 'A' {
				edice = append(edice, v[len(v)-2:])
			} else {
				edice = append(edice, "US")
			}
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
			return textHodnoceni(m.Hodnoceni)
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

// Kategorie: zapsané v poli role a odvozené z centerfoldu, alba Cyber Girl týdne či měsíce a obálky
// (frontend/src/lib/format.js, KATEGORIE a odvozeneKategorie); obyčejné online album kategorii nedává
func kategorieKHledani(m *Modelka) string {
	kategorie := m.Role
	if len(m.Centerfoldy) > 0 {
		kategorie += ", Playmate měsíce"
	}
	if m.CyberGirl != "" {
		kategorie += ", Cyber Girl " + m.CyberGirl
	}
	if len(m.Obalky) > 0 {
		kategorie += ", Modelka obálky"
	}
	return kategorie
}

// Výskyt: v časopise (číslo s měsícem nebo speciál), jen online (online kategorie nebo online album),
// jinak neurčeno (frontend/src/lib/format.js, vyskytModelky)
func vyskytKHledani(m *Modelka) string {
	for _, seznam := range [][]string{m.Vydani, m.Obalky, m.Centerfoldy} {
		for _, v := range seznam {
			if vzorVydani.MatchString(v) {
				return "casopis časopis"
			}
		}
	}
	if vzorOnlineKategorie.MatchString(m.Role) || len(m.OnlineAlba) > 0 {
		return "online"
	}
	return "neurceno neurčeno"
}

// Texty modelky k hledání, které na dotazu nezávisí (připraví se jednou pro snímek sbírky)
type textyHledani struct {
	udaje          string   // všechny údaje zjednodušené, pro obyčejná slova
	slovaJmena     []string // zjednodušená slova jména a pseudonymů (překlepy)
	slovaFotografu []string // zjednodušená slova fotografů alb (překlepy)
}

func pripravitTexty(m *Modelka) textyHledani {
	vyskaTxt := ""
	if m.VyskaCm > 0 {
		vyskaTxt = strconv.Itoa(m.VyskaCm) + " " + strconv.Itoa(m.VyskaCm) + "cm"
	}
	vahaTxt := ""
	if m.VahaKg > 0 {
		vahaTxt = strconv.Itoa(m.VahaKg) + " " + strconv.Itoa(m.VahaKg) + "kg"
	}
	tetovaniTxt := ""
	if m.Tetovani == 1 {
		tetovaniTxt = "tetování tetovani"
	}
	piercingTxt := ""
	if m.Piercing == 1 {
		piercingTxt = "piercing"
	}
	return textyHledani{
		udaje: zjednodusit(strings.Join([]string{
			m.Jmeno, m.Narodnost, m.Etnicita, m.NarozeniMisto, m.NarozeniDatum, m.UmrtiDatum, m.VlasyBarva, m.OciBarva,
			m.VelikostPrsou, m.PrsaTyp, m.Ochlupeni, m.Miry, m.Vystoupeni, m.PictorialVydani, m.Role, m.Tags,
			m.DalsiJmena, m.Poznamka, strings.Join(m.Vydani, " "), strings.Join(m.Obalky, " "), m.textyAlb,
			vyskaTxt, vahaTxt, tetovaniTxt, piercingTxt,
		}, "\n")),
		slovaJmena:     strings.Fields(zjednodusit(m.Jmeno + " " + m.DalsiJmena)),
		slovaFotografu: strings.Fields(zjednodusit(m.fotografoveAlb)),
	}
}

// Online kategorie (KATEGORIE s online: true ve frontend/src/lib/format.js), i anglicky
var vzorOnlineKategorie = regexp.MustCompile(`(?i)cyber|coed|\bmuses?\b|creator|tvůrkyně|online|playboy ?plus|playboy\.?com`)

// Slova hledání: volitelná negace (- nebo !), cílené pole:hodnota (i s mezerou za dvojtečkou) i pole:"více slov", uvozovky i obyčejná slova
var vzorSlovaHledani = regexp.MustCompile(`(-|!)?([\p{L}]+):\s*"([^"]*)"|(-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+(?:[.,]\d+)?|[^\s",:]+(?:\s*,\s*[^\s",:]+)*)?|(-|!)?"([^"]*)"|(\S+)`)
var vzorRozsahCisel = regexp.MustCompile(`^(\d+)\s*-\s*(\d+)$`)

// Rozsah roků v cíleném hledání (rok:1970-1979, narozena:1980..1989) a rok s měsícem (rok:1975-01)
var (
	vzorRozsahRoku      = regexp.MustCompile(`^\s*\d{4}\s*(-|\.\.)\s*\d{4}\s*$`)
	vzorRokMesicHledani = regexp.MustCompile(`^\s*\d{4}-(0[1-9]|1[0-2]|S\d{2})(-[A-Z]{2})?\s*$`)
)

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
	if parts := strings.Split(h, ".."); len(parts) == 2 {
		od, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
		do, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
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
		if casti := strings.Split(h, oddelovac); len(casti) == 2 {
			od, ok1 := pul(casti[0])
			do, ok2 := pul(casti[1])
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
		return vyhovujeCislo(m.hodnoceniPul(), op, numOd, numDo)
	case "narozena":
		if len(m.NarozeniDatum) >= 4 {
			if rok, err := strconv.Atoi(m.NarozeniDatum[:4]); err == nil && rok > 0 {
				return vyhovujeCislo(rok, op, numOd, numDo)
			}
		}
		return false
	case "rok":
		for _, v := range m.Vydani {
			if len(v) >= 4 {
				if rok, err := strconv.Atoi(v[:4]); err == nil && rok > 0 {
					if vyhovujeCislo(rok, op, numOd, numDo) {
						return true
					}
				}
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
	zjedn := zjednodusit(text)
	for _, v := range varianty {
		if strings.Contains(zjedn, v) {
			return true
		}
	}
	return false
}

// Levenshteinova vzdálenost mezi dvěma řetězci run (počet vložení, smazání a záměn znaků)
func vzdalenostLevenshtein(s1, s2 string) int {
	r1, r2 := []rune(s1), []rune(s2)
	len1, len2 := len(r1), len(r2)
	if len1 == 0 {
		return len2
	}
	if len2 == 0 {
		return len1
	}
	predchozi := make([]int, len2+1)
	aktualni := make([]int, len2+1)
	for j := 0; j <= len2; j++ {
		predchozi[j] = j
	}
	for i := 1; i <= len1; i++ {
		aktualni[0] = i
		for j := 1; j <= len2; j++ {
			cena := 1
			if r1[i-1] == r2[j-1] {
				cena = 0
			}
			smazat := predchozi[j] + 1
			vlozit := aktualni[j-1] + 1
			zamenit := predchozi[j-1] + cena
			min := smazat
			if vlozit < min {
				min = vlozit
			}
			if zamenit < min {
				min = zamenit
			}
			aktualni[j] = min
		}
		copy(predchozi, aktualni)
	}
	return aktualni[len2]
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
		if maxD > 0 && abs(utf8.RuneCountInString(s)-delka) <= maxD && vzdalenostLevenshtein(s, hledane) <= maxD {
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
func odpovidaTextFuzzy(text string, hledanyDotaz string) bool {
	return odpovidajiSlovaFuzzy(strings.Fields(zjednodusit(text)), strings.Fields(zjednodusit(hledanyDotaz)))
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
	meze     []filtrHodnoceni
}

// Rozebraný dotaz; prázdný = odpovídá každá modelka
type hledani []podminkaHledani

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

// Rozbor dotazu: negace (-tag:), čárka jako OR (vlasy:blond,zrzava), numerické porovnání (>175, 1970..1979),
// neuzavřené uvozovky; slovo, které nic neomezuje (prázdná hodnota, samá čárka), se vynechá
func pripravitHledani(vyhledavani string) hledani {
	// Pokud je v dotazu lichý počet uvozovek (uživatel píše uvozovku a ještě ji neuzavřel), pomyslně ji uzavřeme na konci
	if strings.Count(vyhledavani, "\"")%2 != 0 {
		vyhledavani += "\""
	}
	var h hledani
	for _, casti := range vzorSlovaHledani.FindAllStringSubmatch(vyhledavani, -1) {
		var negace bool
		var klic, hodnota string
		if casti[2] != "" {
			negace = casti[1] != ""
			klic = casti[2]
			hodnota = casti[3]
		} else if casti[5] != "" {
			negace = casti[4] != ""
			klic = casti[5]
			hodnota = casti[6]
		} else if strings.HasPrefix(casti[0], "\"") || strings.HasPrefix(casti[0], "-\"") || strings.HasPrefix(casti[0], "!\"") {
			negace = casti[7] != ""
			hodnota = casti[8]
		} else {
			slovo := casti[9]
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
		hodnota = strings.Trim(hodnota, "\"")
		hodnotaZjedn := zjednodusit(strings.TrimSpace(hodnota))
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
		p.klic = zjednodusit(klic)
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
func (h hledani) odpovida(m *Modelka, t *textyHledani) bool {
	texty := func() *textyHledani {
		if t == nil {
			pripravene := pripravitTexty(m)
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
			for _, v := range p.varianty {
				for _, d := range m.OnlineAlba {
					shoda = shoda || (d != "" && strings.HasPrefix(d, v))
				}
			}
		case hledatSrdicka:
			if p.jehla != "" {
				shoda = strings.Contains(texty().udaje, p.jehla)
			}
			for _, f := range p.meze {
				shoda = shoda || vyhovujeNumericky(m, p.klic, f.op, f.od, f.do)
			}
		case hledatCislo:
			shoda = vyhovujeNumericky(m, p.klic, p.op, p.od, p.do)
		case hledatPole:
			text := hodnotaPole(m, p.klic)
			if p.klic == "tetovani" || p.klic == "piercing" {
				// Ano/ne se porovnává po celých slovech („no“ je i v „ano“)
				for _, slovo := range strings.Fields(text) {
					for _, v := range p.varianty {
						shoda = shoda || slovo == v
					}
				}
			} else {
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
