package main

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Kontrola sbírky pro Údržbu: údaje, které vypadají jako chyba při zadávání. Každé pravidlo hlásí nález s klíčem
// „ok-…“; když je údaj přesto pravdivý (modelce opravdu bylo 16 let), označí se nález v Údržbě „V pořádku“
// a klíč se uloží mezi „netýká se“ modelky (nebo alba u nálezu alba). Při dalších kontrolách se pak nehlásí.

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
}

// Klíče nálezů: modelky a alba (ukládají se mezi „netýká se“)
var (
	kliceKontrolyModelky = map[string]bool{"ok-jmeno": true, "ok-vek": true, "ok-narozeni": true, "ok-umrti": true,
		"ok-vyska": true, "ok-vaha": true, "ok-bmi": true, "ok-miry": true, "ok-pmoy": true, "ok-cislo": true, "ok-dvojice": true,
		"ok-neobvykle": true, "ok-podobne-jmeno": true}
	kliceKontrolyAlba = map[string]bool{"ok-album": true, "ok-vydani-alba": true}
)

var vzorPlaymateRoku = regexp.MustCompile(`(?i)playmate roku\s*(\d{4})`)

// Rozsahy, mimo které údaj stojí za kontrolu (ne za zákaz: modelky bývají i mimo ně). Platí u malé sbírky;
// když je údajů dost, nahradí je rozsahy naučené ze sbírky (kontrola_uceni.go).
const (
	vekOd, vekDo         = 18, 45
	vyskaOd, vyskaDo     = 145, 195
	vahaOd, vahaDo       = 38, 95
	bmiOd, bmiDo         = 15.0, 30.0
	hrudnikOd, hrudnikDo = 65, 130
	pasOd, pasDo         = 45, 100
	bokyOd, bokyDo       = 65, 130
	prvniRokCasopisu     = 1953
)

// Album modelky pro kontrolu
type albumKontroly struct {
	modelkaID      int
	nazev, typ     string
	vydani, netyka string
	fotek          int
}

func (a *App) kontrolovatSbirku(modelky []Modelka, vcetneSkrytych bool) []PodezrelyUdaj {
	nalezy := []PodezrelyUdaj{}
	pridat := func(m Modelka, klic, pole, popis string) {
		skryty := obsahujeKlic(m.NetykaSe, klic)
		if !skryty || vcetneSkrytych {
			nalezy = append(nalezy, PodezrelyUdaj{ModelkaID: m.ID, Jmeno: m.Jmeno, Popis: popis, Klic: klic, Pole: pole, NetykaSe: skryty})
		}
	}
	podleID := map[int]Modelka{}
	for _, m := range modelky {
		podleID[m.ID] = m
	}

	kontrolovatModelky(modelky, pridat)
	a.kontrolovatCenterfoldyCisel(modelky, pridat)

	// Alba: jedna fotka u alba s podobným názvem jako jiné album modelky (překlep), vydání mimo dobu časopisu
	alba := a.albaKontroly()
	podleModelky := map[int][]albumKontroly{}
	for _, al := range alba {
		podleModelky[al.modelkaID] = append(podleModelky[al.modelkaID], al)
	}
	pridatAlbu := func(al albumKontroly, klic, popis string) {
		m, ok := podleID[al.modelkaID]
		if !ok {
			return
		}
		skryty := obsahujeKlic(al.netyka, klic)
		if !skryty || vcetneSkrytych {
			nalezy = append(nalezy, PodezrelyUdaj{ModelkaID: m.ID, Jmeno: m.Jmeno, Popis: popis, Klic: klic, Album: al.nazev, Typ: al.typ, NetykaSe: skryty})
		}
	}
	letos := time.Now().Year()
	for _, al := range alba {
		if al.fotek == 1 && al.typ != "Centerfold" && al.typ != "Cover" {
			if podobne := podobneAlbum(al, podleModelky[al.modelkaID]); podobne != "" {
				pridatAlbu(al, "ok-album", fmt.Sprintf("album „%s“ má jen jednu fotku a podobá se albu „%s“ – překlep v názvu?", al.nazev, podobne))
			}
		}
		if rok, _, _, ok := castiVydani(al.vydani); ok && (rok < prvniRokCasopisu || rok > letos) {
			pridatAlbu(al, "ok-vydani-alba", fmt.Sprintf("album „%s“ má vydání %s, mimo roky časopisu (%d–%d)", al.nazev, al.vydani, prvniRokCasopisu, letos))
		}
	}
	a.kontrolovatDvojiceFotek(podleID, pridat)
	return nalezy
}

// Kontroly samotných údajů modelek (bez alb a fotek): pravidla s rozsahy naučenými ze sbírky,
// neobvyklé kombinace údajů postavy a podobná jména
func kontrolovatModelky(modelky []Modelka, pridat func(Modelka, string, string, string)) {
	uceni := naucitSe(modelky)
	kontrolovatJmena(modelky, pridat)
	kontrolovatPodobnaJmena(modelky, pridat)
	for _, m := range modelky {
		kontrolovatData(m, uceni.rozsahy, pridat)
		kontrolovatPostavu(m, uceni.rozsahy, pridat)
		kontrolovatPlaymateRoku(m, pridat)
	}
	uceni.kontrolovatNeobvykle(modelky, pridat)
}

// Stejné jméno nebo pseudonym u dvou modelek bývá dvakrát založená tatáž
func kontrolovatJmena(modelky []Modelka, pridat func(Modelka, string, string, string)) {
	podleJmena := map[string]Modelka{}
	for _, m := range modelky {
		for _, jmeno := range append([]string{m.Jmeno}, strings.Split(m.DalsiJmena, ",")...) {
			klic := zjednodusit(strings.TrimSpace(jmeno))
			if klic == "" {
				continue
			}
			if jina, obsazeno := podleJmena[klic]; obsazeno && jina.ID != m.ID {
				pridat(m, "ok-jmeno", "inputDalsiJmena", fmt.Sprintf("jméno nebo pseudonym „%s“ má i modelka %s", strings.TrimSpace(jmeno), jina.Jmeno))
				continue
			}
			podleJmena[klic] = m
		}
	}
}

// První měsíční vydání modelky (bez speciálů); prázdné, když žádné nemá
func prvniVydani(m Modelka) string {
	prvni := ""
	for _, v := range m.Vydani {
		if vzorVydani.MatchString(v) && !jeSpecial(v) && (prvni == "" || v[:7] < prvni[:7]) {
			prvni = v
		}
	}
	return prvni
}

// Narození, úmrtí a věk při prvním vydání (rozsah věku z r)
func kontrolovatData(m Modelka, r rozsahyKontroly, pridat func(Modelka, string, string, string)) {
	dnes := time.Now().Format("2006-01-02")
	narozeni, umrti := strings.TrimSpace(m.NarozeniDatum), strings.TrimSpace(m.UmrtiDatum)
	prvni := prvniVydani(m)
	if narozeni != "" {
		switch {
		case narozeni > dnes:
			pridat(m, "ok-narozeni", "inputNarozeniDatum", fmt.Sprintf("datum narození %s je v budoucnosti", narozeni))
		case narozeni[:min(4, len(narozeni))] < "1900":
			pridat(m, "ok-narozeni", "inputNarozeniDatum", fmt.Sprintf("datum narození %s je před rokem 1900", narozeni))
		case prvni != "" && narozeni[:min(7, len(narozeni))] >= prvni[:7]:
			pridat(m, "ok-narozeni", "inputNarozeniDatum", fmt.Sprintf("datum narození %s není před prvním vydáním (%s)", narozeni, prvni))
		default:
			// Věk mimo běžný rozsah ukazuje na překlep v datu narození nebo ve vydání (ale bývá i pravdivý)
			if vek := vekKVydani(narozeni, prvni); prvni != "" && vek > 0 && r[prVek].mimo(float64(vek)) {
				pridat(m, "ok-vek", "inputNarozeniDatum", fmt.Sprintf("věk při prvním vydání (%s) vychází na %d let", prvni, vek))
			}
		}
	}
	if umrti != "" {
		switch {
		case umrti > dnes:
			pridat(m, "ok-umrti", "inputUmrtiDatum", fmt.Sprintf("datum úmrtí %s je v budoucnosti", umrti))
		case narozeni != "" && predData(umrti, narozeni):
			pridat(m, "ok-umrti", "inputUmrtiDatum", fmt.Sprintf("datum úmrtí %s je před narozením (%s)", umrti, narozeni))
		case prvni != "" && predData(umrti, prvni[:7]):
			pridat(m, "ok-umrti", "inputUmrtiDatum", fmt.Sprintf("datum úmrtí %s je před prvním vydáním (%s)", umrti, prvni))
		}
	}
}

// Datum a je jistě před datem b: porovná se na společnou přesnost (úmrtí „1980“ není před vydáním „1980-08“)
func predData(a, b string) bool {
	n := min(len(a), len(b))
	return a[:n] < b[:n]
}

// Výška, váha, BMI a obvody mimo rozsahy r (pevné nebo naučené ze sbírky); pas širší než boky nebo hrudník
// bývá prohozené pole
func kontrolovatPostavu(m Modelka, r rozsahyKontroly, pridat func(Modelka, string, string, string)) {
	if v := r[prVyska]; m.VyskaCm > 0 && v.mimo(float64(m.VyskaCm)) {
		pridat(m, "ok-vyska", "inputVyska", fmt.Sprintf("výška %d cm je mimo %s %s cm", m.VyskaCm, v.popis(), v.text(priznaky[prVyska])))
	}
	if v := r[prVaha]; m.VahaKg > 0 && v.mimo(float64(m.VahaKg)) {
		pridat(m, "ok-vaha", "inputVaha", fmt.Sprintf("váha %d kg je mimo %s %s kg", m.VahaKg, v.popis(), v.text(priznaky[prVaha])))
	}
	if m.VyskaCm > 0 && m.VahaKg > 0 {
		metry := float64(m.VyskaCm) / 100
		if bmi := float64(m.VahaKg) / (metry * metry); r[prBmi].mimo(bmi) {
			pridat(m, "ok-bmi", "inputVaha", fmt.Sprintf("BMI z výšky a váhy vychází %s – překlep ve výšce nebo váze?", priznaky[prBmi].cislo(bmi)))
		}
	}
	var chyby []string
	for _, o := range []struct {
		j int
		h int
	}{{prHrudnik, m.ObvodHrudnikCm}, {prPas, m.ObvodPasCm}, {prBoky, m.ObvodBokyCm}} {
		if o.h > 0 && r[o.j].mimo(float64(o.h)) {
			slovo := "běžně"
			if r[o.j].naucene {
				slovo = "ve sbírce obvykle"
			}
			chyby = append(chyby, fmt.Sprintf("%s %d cm (%s %s)", priznaky[o.j].nazev, o.h, slovo, r[o.j].text(priznaky[o.j])))
		}
	}
	if m.ObvodPasCm > 0 && (m.ObvodBokyCm > 0 && m.ObvodPasCm >= m.ObvodBokyCm || m.ObvodHrudnikCm > 0 && m.ObvodPasCm >= m.ObvodHrudnikCm) {
		chyby = append(chyby, fmt.Sprintf("pas %d cm není užší než hrudník a boky (%s) – prohozená pole?", m.ObvodPasCm, m.Miry))
	}
	if len(chyby) > 0 {
		pridat(m, "ok-miry", "inputHrudnik", "míry: "+strings.Join(chyby, ", "))
	}
}

// Playmate roku se vyhlašuje z playmate dřívějších let: rok před prvním centerfoldem nebo dlouho po něm je podezřelý
func kontrolovatPlaymateRoku(m Modelka, pridat func(Modelka, string, string, string)) {
	shoda := vzorPlaymateRoku.FindStringSubmatch(m.Role)
	if shoda == nil {
		return
	}
	rok, _ := strconv.Atoi(shoda[1])
	prvni := 0
	for _, v := range m.Centerfoldy {
		if r, _, _, ok := castiVydani(v); ok && (prvni == 0 || r < prvni) {
			prvni = r
		}
	}
	switch {
	case prvni == 0:
		pridat(m, "ok-pmoy", "inputRole", fmt.Sprintf("Playmate roku %d bez centerfoldu ve sbírce", rok))
	case rok < prvni || rok > prvni+3:
		pridat(m, "ok-pmoy", "inputRole", fmt.Sprintf("Playmate roku %d, ale první centerfold je z roku %d", rok, prvni))
	}
}

// Dvě různá centerfoldová alba ve stejném měsíčním čísle bývají špatně zapsané vydání (společný centerfold
// dvojčat je jedno sdílené album a nehlásí se)
func (a *App) kontrolovatCenterfoldyCisel(modelky []Modelka, pridat func(Modelka, string, string, string)) {
	rows, err := a.db.Query(`SELECT vydani FROM alba WHERE typ = 'Centerfold' AND COALESCE(vydani, '') <> ''
		GROUP BY vydani HAVING COUNT(*) > 1`)
	if err != nil {
		a.chyba("kontrola centerfoldů čísel", err)
		return
	}
	vicekrat := map[string]bool{}
	for rows.Next() {
		var v string
		if rows.Scan(&v) == nil && vzorVydani.MatchString(v) && !jeSpecial(v) {
			vicekrat[v] = true
		}
	}
	rows.Close()
	podleCisla := map[string][]Modelka{}
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
				pridat(m, "ok-cislo", "", fmt.Sprintf("centerfold čísla %s má i %s – správné vydání?", v, strings.Join(jine, ", ")))
			}
		}
	}
}

// Alba všech modelek s počtem fotek
func (a *App) albaKontroly() []albumKontroly {
	alba := []albumKontroly{}
	rows, err := a.db.Query(`SELECT al.modelka_id, al.album, al.typ, COALESCE(al.vydani, ''), COALESCE(al.netyka_se, ''), COUNT(f.id)
		FROM alba al JOIN fotky f ON f.album_id = al.id WHERE al.modelka_id IS NOT NULL GROUP BY al.id ORDER BY al.album`)
	if err != nil {
		a.chyba("načtení alb pro kontrolu", err)
		return alba
	}
	defer rows.Close()
	for rows.Next() {
		var al albumKontroly
		if rows.Scan(&al.modelkaID, &al.nazev, &al.typ, &al.vydani, &al.netyka, &al.fotek) == nil {
			alba = append(alba, al)
		}
	}
	return alba
}

// Jiné album modelky stejného typu s podobným názvem (liší se o pár znaků nebo jeden obsahuje druhý)
func podobneAlbum(al albumKontroly, alba []albumKontroly) string {
	nazev := zjednodusit(al.nazev)
	for _, jine := range alba {
		if jine.nazev == al.nazev || jine.typ != al.typ {
			continue
		}
		druhy := zjednodusit(jine.nazev)
		if nazev == druhy || len(nazev) >= 4 && len(druhy) >= 4 && (strings.Contains(nazev, druhy) || strings.Contains(druhy, nazev)) ||
			vzdalenostLevenshtein(nazev, druhy) <= max(1, min(len(nazev), len(druhy))/6) {
			return jine.nazev
		}
	}
	return ""
}

// Stejná fotka (soubor na Disku) ve dvou albech jedné modelky mimo cover a centerfold bývá přidaná omylem dvakrát
func (a *App) kontrolovatDvojiceFotek(podleID map[int]Modelka, pridat func(Modelka, string, string, string)) {
	rows, err := a.db.Query(`SELECT al.modelka_id, f.drive_file_id, GROUP_CONCAT(al.album, ' · ')
		FROM fotky f JOIN alba al ON al.id = f.album_id
		WHERE al.modelka_id IS NOT NULL AND al.typ NOT IN ('Cover', 'Centerfold')
		GROUP BY al.modelka_id, f.drive_file_id HAVING COUNT(*) > 1 ORDER BY al.modelka_id`)
	if err != nil {
		a.chyba("kontrola dvojic fotek", err)
		return
	}
	defer rows.Close()
	pocty := map[int]int{}
	priklad := map[int]string{}
	var poradi []int
	for rows.Next() {
		var id int
		var soubor, alba string
		if rows.Scan(&id, &soubor, &alba) != nil {
			continue
		}
		if pocty[id] == 0 {
			poradi = append(poradi, id)
			priklad[id] = alba
		}
		pocty[id]++
	}
	for _, id := range poradi {
		if m, ok := podleID[id]; ok {
			pridat(m, "ok-dvojice", "", fmt.Sprintf("%d %s ve dvou albech zároveň (např. %s)", pocty[id], sklonovatSlovo(pocty[id], "fotka je", "fotky jsou", "fotek je"), priklad[id]))
		}
	}
}

func sklonovatSlovo(n int, jedna, dve, pet string) string {
	switch {
	case n == 1:
		return jedna
	case n > 1 && n < 5:
		return dve
	}
	return pet
}
