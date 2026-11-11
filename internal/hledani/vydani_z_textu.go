package hledani

import (
	"regexp"
	"slices"
	"strings"
	"unicode"
)

// Číslo z textu vystoupení (0.02.036): import a starší zápisy mají u modelky jen text „Penthouse říjen 1970“
// a textové vydání „1970-10“ bez časopisu, album bez čísla. Bez přípony by se četlo jako Playboy.

var (
	vzorRokuTextu  = regexp.MustCompile(`\b(19|20)\d\d\b`)
	vzorCislaRadku = regexp.MustCompile(`^\d{4}-\d{2}`)
	// Měsíce česky (1. i 2. pád) a anglicky, bez diakritiky a malými písmeny (po Zjednodusit)
	mesiceTextu = map[string]string{
		"leden": "01", "ledna": "01", "unor": "02", "unora": "02", "brezen": "03", "brezna": "03", "duben": "04", "dubna": "04",
		"kveten": "05", "kvetna": "05", "cerven": "06", "cervna": "06", "cervenec": "07", "cervence": "07", "srpen": "08", "srpna": "08",
		"zari": "09", "rijen": "10", "rijna": "10", "listopad": "11", "listopadu": "11", "prosinec": "12", "prosince": "12",
		"january": "01", "february": "02", "march": "03", "april": "04", "may": "05", "june": "06", "july": "07", "august": "08",
		"september": "09", "october": "10", "november": "11", "december": "12",
	}
)

// CasopisZTextu: klíč jediného časopisu (mimo Playboy), jehož název text zmiňuje; nazvy = klíč → název; "" = žádný
// nebo víc časopisů
func CasopisZTextu(text string, nazvy map[string]string) string {
	t := " " + strings.Join(slovaTextu(text), " ") + " "
	nalez := ""
	for k, n := range nazvy {
		if k == VychoziCasopis || strings.TrimSpace(n) == "" {
			continue
		}
		if strings.Contains(t, " "+strings.Join(slovaTextu(n), " ")+" ") {
			if nalez != "" {
				return ""
			}
			nalez = k
		}
	}
	return nalez
}

// cisloZTextu: „Penthouse říjen 1970“ → „1970-10“ (rok a měsíc z textu); "" bez roku nebo měsíce
func cisloZTextu(text string) string {
	rok := vzorRokuTextu.FindString(text)
	if rok == "" {
		return ""
	}
	mesic := ""
	for _, slovo := range slovaTextu(text) {
		if m, ok := mesiceTextu[slovo]; ok {
			if mesic != "" && mesic != m {
				return ""
			}
			mesic = m
		}
	}
	if mesic == "" {
		return ""
	}
	return rok + "-" + mesic
}

// CasopisPodleTextu: textová vydání bez časopisu dostanou příponu časopisu z textu vystoupení, když ho text jednoznačně
// zmiňuje a číslo z textu (rok a měsíc) s vydáním souhlasí, nebo text měsíc nemá a rok sedí
func CasopisPodleTextu(textova, vystoupeni string, nazvy map[string]string) string {
	k := CasopisZTextu(vystoupeni, nazvy)
	if k == "" || strings.TrimSpace(textova) == "" {
		return textova
	}
	cislo, rok := cisloZTextu(vystoupeni), vzorRokuTextu.FindString(vystoupeni)
	radky := strings.Split(textova, "\n")
	for i, radek := range radky {
		v := strings.TrimSpace(radek)
		if _, c := RozdelitCasopis(v); c != "" || !vzorCislaRadku.MatchString(v) {
			continue
		}
		if (cislo != "" && strings.HasPrefix(v, cislo)) || (cislo == "" && rok != "" && strings.HasPrefix(v, rok)) {
			radky[i] = v + "@" + k
		}
	}
	return strings.Join(radky, "\n")
}

// JedinoCisloModelky: číslo pro album modelky bez čísla – jediné textové vydání (po CasopisPodleTextu), jinak číslo
// přímo z textu vystoupení s časopisem; "" když není jednoznačné
func JedinoCisloModelky(textova, vystoupeni string, nazvy map[string]string) string {
	var cisla []string
	for _, r := range strings.Split(CasopisPodleTextu(textova, vystoupeni, nazvy), "\n") {
		if v := strings.TrimSpace(r); vzorCislaRadku.MatchString(v) && !slices.Contains(cisla, v) {
			cisla = append(cisla, v)
		}
	}
	if len(cisla) == 1 {
		return cisla[0]
	}
	if len(cisla) == 0 {
		if k, c := CasopisZTextu(vystoupeni, nazvy), cisloZTextu(vystoupeni); k != "" && c != "" {
			return c + "@" + k
		}
	}
	return ""
}

// Slova textu bez diakritiky a interpunkce
func slovaTextu(text string) []string {
	return strings.FieldsFunc(Zjednodusit(text), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
}
