package kontrola

import (
	"fmt"
	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	"pinup-katalog/internal/uceni"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Údaj, který vypadá jako chyba při zadávání a stojí za kontrolu
type PodezrelyUdaj struct {
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Popis     string `json:"popis"`
	Klic      string `json:"klic"`  // „ok-…“, pod kterým se nález označí jako v pořádku
	Album     string `json:"album"` // u nálezu alba jeho název a typ (označení patří albu)
	Typ       string `json:"typ"`
	Pole      string `json:"pole"`     // pole formuláře modelky, kde se údaj opraví; prázdné = v profilu (alba)
	NetykaSe  bool   `json:"netykaSe"` // označeno jako v pořádku; v seznamu jen při zobrazení skrytých
	Zdroj     string `json:"zdroj"`    // stabilní klíč pravidla („vek“, „neobvykle“, „podobne-jmeno“…)
}

// Klíče nálezů: modelky a alba (ukládají se mezi „netýká se“)
var (
	KliceKontrolyModelky = map[string]bool{"ok-jmeno": true, "ok-vek": true, "ok-narozeni": true, "ok-umrti": true,
		"ok-vyska": true, "ok-vaha": true, "ok-bmi": true, "ok-miry": true, "ok-pmoy": true, "ok-cislo": true, "ok-dvojice": true,
		"ok-neobvykle": true, "ok-podobne-jmeno": true, "ok-slouceni": true}
	KliceKontrolyAlba = map[string]bool{"ok-album": true, "ok-vydani-alba": true}
)

var vzorPlaymateRoku = regexp.MustCompile(`(?i)playmate roku\s*(\d{4})`)

// Rozsahy, mimo které údaj stojí za kontrolu
const (
	VekOd, VekDo         = 18, 45
	VyskaOd, VyskaDo     = 145, 195
	VahaOd, VahaDo       = 38, 95
	BmiOd, BmiDo         = 15.0, 30.0
	HrudnikOd, HrudnikDo = 65, 130
	PasOd, PasDo         = 45, 100
	BokyOd, BokyDo       = 65, 130
	PrvniRokCasopisu     = 1953
)

type PridatNalez func(m hledani.Modelka, klic, zdroj, pole, popis string)

// Nálezy bez označených „V pořádku“, nebo všechny
func VybratNalezy(vsechny []PodezrelyUdaj, vcetneSkrytych bool) []PodezrelyUdaj {
	nalezy := []PodezrelyUdaj{}
	for _, n := range vsechny {
		if !n.NetykaSe || vcetneSkrytych {
			nalezy = append(nalezy, n)
		}
	}
	return nalezy
}

// Stejné jméno nebo pseudonym u dvou modelek bývá dvakrát založená tatáž
func KontrolovatJmena(modelky []hledani.Modelka, pridat PridatNalez) {
	podleJmena := map[string]hledani.Modelka{}
	for _, m := range modelky {
		for _, jmeno := range append([]string{m.Jmeno}, hledani.DalsiJmena(m.DalsiJmena)...) {
			klic := hledani.Zjednodusit(strings.TrimSpace(jmeno))
			if klic == "" {
				continue
			}
			if jina, obsazeno := podleJmena[klic]; obsazeno && jina.ID != m.ID {
				// Kandidáta na sloučení hlásí „ok-slouceni“ (0.02.029) s důvody; dvojí nález by byl navíc
				if _, _, kandidat := KandidatNaSlouceni(jina, m); kandidat {
					continue
				}
				pridat(m, "ok-jmeno", "jmeno", "inputDalsiJmena", fmt.Sprintf("jméno nebo pseudonym „%s“ má i modelka %s", strings.TrimSpace(jmeno), jina.Jmeno))
				continue
			}
			podleJmena[klic] = m
		}
	}
}

// První měsíční vydání modelky (bez speciálů); prázdné, když žádné nemá
func PrvniVydani(m hledani.Modelka) string {
	prvni := ""
	for _, v := range m.Vydani {
		if sbirka.VzorVydani.MatchString(v) && !sbirka.JeSpecial(v) && (prvni == "" || v[:7] < prvni[:7]) {
			prvni = v
		}
	}
	return prvni
}

// Narození, úmrtí a věk při prvním vydání (rozsah věku z r)
func KontrolovatData(m hledani.Modelka, r RozsahyKontroly, pridat PridatNalez) {
	dnes := time.Now().Format("2006-01-02")
	narozeni, umrti := strings.TrimSpace(m.NarozeniDatum), strings.TrimSpace(m.UmrtiDatum)
	prvni := PrvniVydani(m)
	if narozeni != "" {
		switch {
		case narozeni > dnes:
			pridat(m, "ok-narozeni", "narozeni-budoucnost", "inputNarozeniDatum", fmt.Sprintf("datum narození %s je v budoucnosti", narozeni))
		case narozeni[:min(4, len(narozeni))] < "1900":
			pridat(m, "ok-narozeni", "narozeni-pred-1900", "inputNarozeniDatum", fmt.Sprintf("datum narození %s je před rokem 1900", narozeni))
		case prvni != "" && narozeni[:min(7, len(narozeni))] >= prvni[:7]:
			pridat(m, "ok-narozeni", "narozeni-po-vydani", "inputNarozeniDatum", fmt.Sprintf("datum narození %s není před prvním vydáním (%s)", narozeni, prvni))
		default:
			if vek := uceni.VekKVydani(narozeni, prvni); prvni != "" && vek > 0 && r[uceni.PrVek].Mimo(float64(vek)) {
				pridat(m, "ok-vek", "vek", "inputNarozeniDatum", fmt.Sprintf("věk při prvním vydání (%s) vychází na %d let", prvni, vek))
			}
		}
	}
	if umrti != "" {
		switch {
		case umrti > dnes:
			pridat(m, "ok-umrti", "umrti-budoucnost", "inputUmrtiDatum", fmt.Sprintf("datum úmrtí %s je v budoucnosti", umrti))
		case narozeni != "" && PredData(umrti, narozeni):
			pridat(m, "ok-umrti", "umrti-pred-narozenim", "inputUmrtiDatum", fmt.Sprintf("datum úmrtí %s je před narozením (%s)", umrti, narozeni))
		case prvni != "" && PredData(umrti, prvni[:7]):
			pridat(m, "ok-umrti", "umrti-pred-vydanim", "inputUmrtiDatum", fmt.Sprintf("datum úmrtí %s je před prvním vydáním (%s)", umrti, prvni))
		}
	}
}

// Datum a je jistě před datem b: porovná se na společnou přesnost
func PredData(a, b string) bool {
	n := min(len(a), len(b))
	return a[:n] < b[:n]
}

// Výška, váha, BMI a obvody mimo rozsahy r
func KontrolovatPostavu(m hledani.Modelka, r RozsahyKontroly, pridat PridatNalez) {
	if v := r[uceni.PrVyska]; m.VyskaCm > 0 && v.Mimo(float64(m.VyskaCm)) {
		pridat(m, "ok-vyska", "vyska", "inputVyska", fmt.Sprintf("výška %d cm je mimo %s %s cm", m.VyskaCm, v.Popis(), v.Text(uceni.Priznaky[uceni.PrVyska])))
	}
	if v := r[uceni.PrVaha]; m.VahaKg > 0 && v.Mimo(float64(m.VahaKg)) {
		pridat(m, "ok-vaha", "vaha", "inputVaha", fmt.Sprintf("váha %d kg je mimo %s %s kg", m.VahaKg, v.Popis(), v.Text(uceni.Priznaky[uceni.PrVaha])))
	}
	if m.VyskaCm > 0 && m.VahaKg > 0 {
		metry := float64(m.VyskaCm) / 100
		if bmi := float64(m.VahaKg) / (metry * metry); r[uceni.PrBmi].Mimo(bmi) {
			pridat(m, "ok-bmi", "bmi", "inputVaha", fmt.Sprintf("BMI z výšky a váhy vychází %s – překlep ve výšce nebo váze?", uceni.Priznaky[uceni.PrBmi].Cislo(bmi)))
		}
	}
	var chyby []string
	zdroj := "miry"
	for _, o := range []struct {
		j int
		h int
	}{{uceni.PrHrudnik, m.ObvodHrudnikCm}, {uceni.PrPas, m.ObvodPasCm}, {uceni.PrBoky, m.ObvodBokyCm}} {
		if o.h > 0 && r[o.j].Mimo(float64(o.h)) {
			slovo := "běžně"
			if r[o.j].Naucene {
				slovo = "ve sbírce obvykle"
			}
			chyby = append(chyby, fmt.Sprintf("%s %d cm (%s %s)", uceni.Priznaky[o.j].Nazev, o.h, slovo, r[o.j].Text(uceni.Priznaky[o.j])))
		}
	}
	if m.ObvodPasCm > 0 && (m.ObvodBokyCm > 0 && m.ObvodPasCm >= m.ObvodBokyCm || m.ObvodHrudnikCm > 0 && m.ObvodPasCm >= m.ObvodHrudnikCm) {
		if len(chyby) == 0 {
			zdroj = "miry-pas"
		}
		chyby = append(chyby, fmt.Sprintf("pas %d cm není užší než hrudník a boky (%s) – prohozená pole?", m.ObvodPasCm, m.Miry))
	}
	if len(chyby) > 0 {
		pridat(m, "ok-miry", zdroj, "inputHrudnik", "míry: "+strings.Join(chyby, ", "))
	}
}

// Playmate roku se vyhlašuje z playmate dřívějších let: rok před prvním centerfoldem nebo dlouho po něm je podezřelý
func KontrolovatPlaymateRoku(m hledani.Modelka, pridat PridatNalez) {
	shoda := vzorPlaymateRoku.FindStringSubmatch(m.Role)
	if shoda == nil {
		return
	}
	rok, _ := strconv.Atoi(shoda[1])
	prvni := 0
	for _, v := range m.Centerfoldy {
		// Playmate roku je titul Playboye: centerfold Penthouse (Pet) se nepočítá (0.02.045)
		if _, c := hledani.RozdelitCasopis(v); c != "" && c != hledani.VychoziCasopis {
			continue
		}
		if r, _, _, ok := sbirka.CastiVydani(v); ok && (prvni == 0 || r < prvni) {
			prvni = r
		}
	}
	switch {
	case prvni == 0:
		pridat(m, "ok-pmoy", "pmoy-bez-centerfoldu", "inputRole", fmt.Sprintf("Playmate roku %d bez centerfoldu ve sbírce", rok))
	case rok < prvni || rok > prvni+3:
		pridat(m, "ok-pmoy", "pmoy-rok", "inputRole", fmt.Sprintf("Playmate roku %d, ale první centerfold je z roku %d", rok, prvni))
	}
}

// Dvě různá centerfoldová alba ve stejném měsíčním čísle bývají špatně zapsané vydání
func KontrolovatCenterfoldyCisel(modelky []hledani.Modelka, alba []sbirka.AlbumSbirky, pridat PridatNalez) {
	pocty := map[string]int{}
	for _, al := range alba {
		if al.Typ == "Centerfold" && al.Vydani != "" {
			pocty[al.Vydani]++
		}
	}
	vicekrat := map[string]bool{}
	for v, n := range pocty {
		if n > 1 && sbirka.VzorVydani.MatchString(v) && !sbirka.JeSpecial(v) {
			vicekrat[v] = true
		}
	}
	podleCisla := map[string][]hledani.Modelka{}
	for _, m := range modelky {
		for _, v := range m.Centerfoldy {
			if vicekrat[v] {
				podleCisla[v] = append(podleCisla[v], m)
			}
		}
	}
	cisla := make([]string, 0, len(podleCisla))
	for v := range podleCisla {
		cisla = append(cisla, v)
	}
	sort.Strings(cisla)
	for _, v := range cisla {
		for _, m := range podleCisla[v] {
			var jine []string
			for _, j := range podleCisla[v] {
				if j.ID != m.ID {
					jine = append(jine, j.Jmeno)
				}
			}
			if len(jine) > 0 {
				pridat(m, "ok-cislo", "cislo", "", fmt.Sprintf("centerfold čísla %s má i %s – správné vydání?", v, strings.Join(jine, ", ")))
			}
		}
	}
}

// Jiné album modelky stejného typu s podobným názvem
func PodobneAlbum(al sbirka.AlbumSbirky, alba []sbirka.AlbumSbirky) string {
	nazev := hledani.Zjednodusit(al.Nazev)
	for _, jine := range alba {
		if jine.Nazev == al.Nazev || jine.Typ != al.Typ {
			continue
		}
		druhy := hledani.Zjednodusit(jine.Nazev)
		if nazev == druhy || len(nazev) >= 4 && len(druhy) >= 4 && (strings.Contains(nazev, druhy) || strings.Contains(druhy, nazev)) ||
			hledani.VzdalenostLevenshtein(nazev, druhy) <= max(1, min(len(nazev), len(druhy))/6) {
			return jine.Nazev
		}
	}
	return ""
}

func SklonovatSlovo(n int, jedna, dve, pet string) string {
	switch {
	case n == 1:
		return jedna
	case n > 1 && n < 5:
		return dve
	}
	return pet
}
