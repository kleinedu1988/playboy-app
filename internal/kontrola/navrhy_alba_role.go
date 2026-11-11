package kontrola

import (
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	"pinup-katalog/internal/uceni"
)

var (
	VzorPlaymateRokuNavrhu = regexp.MustCompile(`^Playmate roku (19|20)\d{2}$`)
	VzorPlaymateRokuTextu  = regexp.MustCompile(`\b(?:playmate\s+(?:of\s+the\s+year|roku)|pmoy)\s*[:\-–]?\s*((?:19|20)\d{2})\b|\b((?:19|20)\d{2})\s+playmate\s+of\s+the\s+year\b`)
	// Pet a Honey of the Month / Year (Penthouse, Hustler) od 0.02.039 – typ alba je obecný, popisek podle časopisu
	VzorPictorialuPMOY = regexp.MustCompile(`\b((playmate|pet|honey)s?\s+(of\s+the\s+year|roku)|pmoy)\b`)
	VzorPictorialuPMOM = regexp.MustCompile(`\b((playmate|pet|honey)s?\s+(of\s+the\s+month|mesice)|pmom)\b`)
	// Titul modelky měsíce zapsaný jen v Roli (PMOTM, Penthouse Pet, Hustler Honey); bez zahraničních edic v závorce
	vzorTituluMesiceVRoli = regexp.MustCompile(`^(pmo[tm]m|playmate( mesice| of the month)?|(penthouse )?pet( of the month)?|(hustler )?honey( of the month)?)$`)
)

// Role uvádí titul modelky měsíce (0.02.039): jeden ze zápisů v Roli je PMOTM, Penthouse Pet, Hustler Honey…
func titulMesiceVRoli(role string) bool {
	for _, kus := range strings.FieldsFunc(role, func(r rune) bool { return r == ',' || r == ';' || r == '\n' }) {
		if vzorTituluMesiceVRoli.MatchString(strings.Join(strings.Fields(hledani.Zjednodusit(kus)), " ")) {
			return true
		}
	}
	return false
}

// Kategorie Playmate roku už je zapsaná (v jakémkoli tvaru, který rozhraní pozná)
func MaPlaymateRoku(role string) bool {
	r := uceni.KlicTextu(role)
	return strings.Contains(r, "playmate roku") || strings.Contains(r, "playmate of the year") || strings.Contains(r, "pmoy")
}

// Názvy měsíců (zjednodušené, česky i anglicky, i v 2. pádě) → číslo měsíce
var MesiceNazvu = map[string]int{
	"leden": 1, "ledna": 1, "january": 1, "jan": 1, "unor": 2, "unora": 2, "february": 2, "feb": 2,
	"brezen": 3, "brezna": 3, "march": 3, "mar": 3, "duben": 4, "dubna": 4, "april": 4, "apr": 4,
	"kveten": 5, "kvetna": 5, "may": 5, "cerven": 6, "cervna": 6, "june": 6, "jun": 6,
	"cervenec": 7, "cervence": 7, "july": 7, "jul": 7, "srpen": 8, "srpna": 8, "august": 8, "aug": 8,
	"zari": 9, "september": 9, "sep": 9, "sept": 9, "rijen": 10, "rijna": 10, "october": 10, "oct": 10,
	"listopad": 11, "listopadu": 11, "november": 11, "nov": 11, "prosinec": 12, "prosince": 12, "december": 12, "dec": 12,
}

var (
	VzorMesicu = func() string {
		var n []string
		for k := range MesiceNazvu {
			n = append(n, k)
		}
		// Delší první (cervenec před cerven)
		sort.Slice(n, func(i, j int) bool { return len(n[i]) > len(n[j]) || len(n[i]) == len(n[j]) && n[i] < n[j] })
		return strings.Join(n, "|")
	}()
	VzoryDat = []struct {
		Vzor            *regexp.Regexp
		Rok, Mesic, Den int // index skupiny; Mesic < 0 = název měsíce ve skupině -Mesic
		Presnost        int // 1 = rok, 2 = měsíc, 3 = den
	}{
		{regexp.MustCompile(`\b(\d{4})-(\d{1,2})-(\d{1,2})\b`), 1, 2, 3, 3},
		{regexp.MustCompile(`\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b`), 3, 2, 1, 3},
		{regexp.MustCompile(`\b(\d{1,2})\.?\s+(` + VzorMesicu + `)\.?\s+(\d{4})\b`), 3, -2, 1, 3},
		{regexp.MustCompile(`\b(` + VzorMesicu + `)\.?\s+(\d{1,2}),?\s+(\d{4})\b`), 3, -1, 2, 3},
		{regexp.MustCompile(`\b(\d{4})[-/.](\d{1,2})\b`), 1, 2, 0, 2},
		{regexp.MustCompile(`\b(\d{1,2})[-/.](\d{4})\b`), 2, 1, 0, 2},
		{regexp.MustCompile(`\b(` + VzorMesicu + `)\.?\s+(\d{4})\b`), 2, -1, 0, 2},
		{regexp.MustCompile(`\b((?:19|20)\d{2})\b`), 1, 0, 0, 1},
	}
	VzorRoku = regexp.MustCompile(`\b(?:19|20)\d{2}\b`)
	VzorCZ   = regexp.MustCompile(`\bcz\b`)
)

// Rychlý průchod bez regulárních výrazů: kontroluje, zda text obsahuje aspoň jedno čtyřčíslí.
func maCtyrcisli(s string) bool {
	run := 0
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			run++
			if run == 4 {
				return true
			}
		} else {
			run = 0
		}
	}
	return false
}

// Datum z názvu alba ve tvaru RRRR, RRRR-MM nebo RRRR-MM-DD a jeho přesnost (1 rok, 2 měsíc, 3 den);
// ok = false, když název datum nemá nebo jich má víc různých
func DatumZNazvu(nazev string, letos int) (datum string, presnost int, ok bool) {
	if !maCtyrcisli(nazev) {
		return "", 0, false
	}
	text := hledani.Zjednodusit(nazev)
	for _, v := range VzoryDat {
		s := v.Vzor.FindStringSubmatch(text)
		if s == nil {
			continue
		}
		rok, _ := strconv.Atoi(s[v.Rok])
		mesic, den := 0, 0
		switch {
		case v.Mesic > 0:
			mesic, _ = strconv.Atoi(s[v.Mesic])
		case v.Mesic < 0:
			mesic = MesiceNazvu[s[-v.Mesic]]
		}
		if v.Den > 0 {
			den, _ = strconv.Atoi(s[v.Den])
		}
		if rok < sbirka.PrvniRokCasopisu || rok > letos || v.Presnost >= 2 && (mesic < 1 || mesic > 12) {
			return "", 0, false
		}
		// Všechny roky v názvu musí být tentýž (jinak nejde poznat, který platí)
		for _, r := range VzorRoku.FindAllString(text, -1) {
			if r != strconv.Itoa(rok) {
				return "", 0, false
			}
		}
		switch v.Presnost {
		case 3:
			datum = fmt.Sprintf("%04d-%02d-%02d", rok, mesic, den)
			if _, err := time.Parse("2006-01-02", datum); err != nil {
				return "", 0, false
			}
		case 2:
			datum = fmt.Sprintf("%04d-%02d", rok, mesic)
		default:
			datum = strconv.Itoa(rok)
		}
		return datum, v.Presnost, true
	}
	return "", 0, false
}

// Pictorial časopisu (ne online, centerfold ani cover), u kterého se vydání sleduje
func JePictorialCisla(al AlbumNavrhu) bool { return sbirka.JePictorialCasopisu(al.Typ) }

// Vydání pictorialu z názvu alba nebo z čísla jediného centerfoldu modelky (pictorial playmate vychází
// v čísle s jejím centerfoldem), datum online alba z názvu a fotograf z jiných alb téhož čísla nebo modelky.
// Každé pravidlo se nejdřív vyzkouší na albech, která údaj mají, a z toho se spočítá jeho jistota.
func NavrhnoutAlba(modelky []hledani.Modelka, alba []AlbumNavrhu, letos int, preferovane map[string]string, pridat PridatKandidata) {
	// Zápisy fotografů, jak je píše většina sbírky; varianty s překlepem se sjednotí
	zapisyFotografu := uceni.NovySlovnik()
	zapisyFotografu.Preferovane = preferovane
	for _, al := range alba {
		if al.Fotograf != "" {
			zapisyFotografu.Pridat(uceni.KlicTextu(al.Fotograf), al.Fotograf)
		}
	}
	zapisyFotografu.Naucit()
	// Předpočítání klíčů fotografů a vydání z názvu alba (místo opakovaného hledání v jednotnyFotograf a smyčkách)
	kliceFotografu := make([]string, len(alba))
	vydaniNazvu := make([]string, len(alba))
	podleModelky := map[int][]int{}
	for i, al := range alba {
		if al.Fotograf != "" {
			kliceFotografu[i] = zapisyFotografu.Klic(uceni.KlicTextu(al.Fotograf))
		}
		if d, presnost, ok := DatumZNazvu(al.Nazev, letos); ok && presnost >= 2 {
			v := d[:7]
			if VzorCZ.MatchString(hledani.Zjednodusit(al.Nazev)) {
				v += "-CZ"
			}
			vydaniNazvu[i] = v
		}
		podleModelky[al.ModelkaID] = append(podleModelky[al.ModelkaID], i)
	}
	// Jediný měsíční centerfold modelky (vydání), jinak ""
	centerfold := func(m hledani.Modelka) string {
		jediny := ""
		for _, v := range m.Centerfoldy {
			if !sbirka.VzorVydani.MatchString(v) || sbirka.JeSpecial(v) {
				continue
			}
			if jediny != "" && jediny != v {
				return ""
			}
			jediny = v
		}
		return jediny
	}
	// Vydání alba pro porovnání (centerfold má vydání v názvu)
	vydaniAlba := func(al AlbumNavrhu) string {
		if al.Typ == "Centerfold" && al.Vydani == "" {
			return al.Nazev
		}
		return al.Vydani
	}
	// Fotograf z ostatních alb: všechna, která ho mají, se shodují; vrací zápis, klíč a počet alb
	jednotnyFotograf := func(indexy []int, krome int, podminka func(AlbumNavrhu) bool) (string, string, int) {
		fotograf, klicF, pocet := "", "", 0
		for _, j := range indexy {
			al := alba[j]
			if j == krome || al.Fotograf == "" || !podminka(al) {
				continue
			}
			if fotograf != "" && klicF != kliceFotografu[j] {
				return "", "", 0
			}
			fotograf, klicF = al.Fotograf, kliceFotografu[j]
			pocet++
		}
		return fotograf, klicF, pocet
	}

	// Ověření pravidel na albech, která údaj mají
	var zNazvu, sCenterfoldem, datumOnline, fotografCisla, fotografModelky uceni.Uspesnost
	podleID := map[int]hledani.Modelka{}
	for _, m := range modelky {
		podleID[m.ID] = m
	}
	for i, al := range alba {
		m := podleID[al.ModelkaID]
		switch {
		case JePictorialCisla(al) && al.Vydani != "":
			if v := vydaniNazvu[i]; v != "" {
				zNazvu.Zapocitat(v == al.Vydani)
			}
			if c := centerfold(m); c != "" {
				jiny := false
				for _, j := range podleModelky[al.ModelkaID] {
					jiny = jiny || j != i && JePictorialCisla(alba[j]) && alba[j].Vydani == c
				}
				if !jiny {
					sCenterfoldem.Zapocitat(al.Vydani == c)
				}
			}
		case sbirka.JeOnlineTyp(al.Typ) && al.Datum != "":
			if d, _, ok := DatumZNazvu(al.Nazev, letos); ok {
				datumOnline.Zapocitat(strings.HasPrefix(al.Datum, d))
			}
		}
		if al.Fotograf != "" {
			if v := vydaniAlba(al); v != "" {
				if _, kf, n := jednotnyFotograf(podleModelky[al.ModelkaID], i, func(j AlbumNavrhu) bool { return vydaniAlba(j) == v }); n > 0 {
					fotografCisla.Zapocitat(kf == kliceFotografu[i])
				}
			}
			if _, kf, n := jednotnyFotograf(podleModelky[al.ModelkaID], i, func(AlbumNavrhu) bool { return true }); n >= 2 {
				fotografModelky.Zapocitat(kf == kliceFotografu[i])
			}
		}
	}

	// Kolik pictorialů časopisu má modelka v daném čísle
	pictorialuVCisle := func(indexy []int, vydani string) int {
		n := 0
		for _, j := range indexy {
			if JePictorialCisla(alba[j]) && alba[j].Vydani == vydani {
				n++
			}
		}
		return n
	}
	// Ověření čísla z údajů modelky (0.02.039): u pictorialů s číslem, sedí jediné číslo z textového vydání?
	var zUdaju uceni.Uspesnost
	cisloUdaju := map[int]string{}
	for _, m := range modelky {
		if c := hledani.JedinoCisloModelky(m.PictorialVydani, "", nil); c != "" {
			cisloUdaju[m.ID] = c
		}
	}
	for _, al := range alba {
		if c := cisloUdaju[al.ModelkaID]; c != "" && JePictorialCisla(al) && al.Vydani != "" {
			zUdaju.Zapocitat(al.Vydani == c)
		}
	}
	for _, m := range modelky {
		indexy := podleModelky[m.ID]
		c := centerfold(m)
		bezVydani := 0
		pictorialu, obycejnych := 0, -1
		maPictorialCenterfoldu := false
		maCisloUdaju := false
		for _, j := range indexy {
			if al := alba[j]; JePictorialCisla(al) {
				if al.Vydani == "" && !sbirka.ObsahujeKlic(al.Neni, "vydani") {
					bezVydani++
				}
				maPictorialCenterfoldu = maPictorialCenterfoldu || c != "" && al.Vydani == c
				maCisloUdaju = maCisloUdaju || al.Vydani != "" && al.Vydani == cisloUdaju[m.ID]
				pictorialu++
				if al.Typ == "Pictorial" {
					obycejnych = j
				}
			}
		}
		// Titul jen v Roli a žádný z galerií: jediný pictorial časopisu je pictorial modelky měsíce
		titulZRole := titulMesiceVRoli(m.Role) && len(m.Centerfoldy) == 0 && !m.PlaymateMesice && len(m.TitulyJinde) == 0 &&
			pictorialu == 1 && obycejnych >= 0
		for _, j := range indexy {
			al := &alba[j]
			if JePictorialCisla(*al) && al.Vydani == "" && !sbirka.ObsahujeKlic(al.Neni, "vydani") {
				if v := vydaniNazvu[j]; v != "" {
					// Datum z názvu nezná časopis: když údaje modelky uvádějí totéž číslo jiného časopisu, platí ono
					if cu := cisloUdaju[m.ID]; cu != "" && strings.SplitN(cu, "@", 2)[0] == v {
						v = cu
					}
					pridat(m, al, "vydaniAlba", v, fmt.Sprintf("název alba „%s“ obsahuje datum%s", al.Nazev, zNazvu.Text("pictorialů s datem v názvu")),
						"nazev", zNazvu.Jistota(0.85, 6))
				}
				// Rok v názvu alba, který k číslu nesedí (2017-PMOY-MX u čísla 2016-06-MX), pravidlo vylučuje
				rokNazvu := VzorRoku.FindString(hledani.Zjednodusit(al.Nazev))
				if cu := cisloUdaju[m.ID]; cu != "" && bezVydani == 1 && !maCisloUdaju && cu != c && (rokNazvu == "" || rokNazvu == cu[:4]) {
					pridat(m, al, "vydaniAlba", cu, fmt.Sprintf("v údajích modelky je jediné číslo %s%s", cu, zUdaju.Text("pictorialů modelek s jedním číslem v údajích")),
						"udaje", zUdaju.Jistota(0.8, 6))
				}
				if c != "" && bezVydani == 1 && !maPictorialCenterfoldu {
					// Rok v názvu, který k centerfoldu nesedí, pravidlo vylučuje
					if r := VzorRoku.FindString(hledani.Zjednodusit(al.Nazev)); r == "" || r == c[:4] {
						pridat(m, al, "vydaniAlba", c, fmt.Sprintf("pictorial modelky vychází v čísle jejího centerfoldu (%s)%s", c, sCenterfoldem.Text("modelek s jedním centerfoldem")),
							"centerfold", sCenterfoldem.Jistota(0.75, 4))
					}
				}
			}
			// Druh pictorialu: Playmate of the Year / of the Month z názvu alba, jinak pictorial v čísle jejího
			// centerfoldu je pictorial Playmate of the Month
			if al.Typ == "Pictorial" && !sbirka.ObsahujeKlic(al.Neni, KlicNavrhu("typAlba")) {
				nazev := hledani.Zjednodusit(al.Nazev)
				switch {
				case VzorPictorialuPMOY.MatchString(nazev):
					pridat(m, al, "typAlba", sbirka.TypPMRoku, fmt.Sprintf("název alba „%s“ uvádí %s", al.Nazev, titulZNazvu(nazev, "Year")), "nazev", 0.92)
				case VzorPictorialuPMOM.MatchString(nazev):
					pridat(m, al, "typAlba", sbirka.TypPMMesice, fmt.Sprintf("název alba „%s“ uvádí %s", al.Nazev, titulZNazvu(nazev, "Month")), "nazev", 0.9)
				case al.Vydani != "" && slices.Contains(m.Centerfoldy, al.Vydani) && pictorialuVCisle(indexy, al.Vydani) == 1:
					pridat(m, al, "typAlba", sbirka.TypPMMesice, fmt.Sprintf("pictorial vyšel v čísle jejího centerfoldu (%s) – pictorial %s", al.Vydani, modelkaMesiceCisla(al.Vydani)), "centerfold", 0.8)
				case titulZRole && obycejnych == j:
					pridat(m, al, "typAlba", sbirka.TypPMMesice, "titul modelky měsíce je zapsaný jen v Roli a tohle je její jediný pictorial – titul se bere z alba", "role", 0.75)
				}
			}
			if sbirka.JeOnlineTyp(al.Typ) && al.Datum == "" {
				if d, presnost, ok := DatumZNazvu(al.Nazev, letos); ok {
					predpoklad := 0.85
					if presnost == 1 {
						predpoklad = 0.6
					}
					pridat(m, al, "datumAlba", d, fmt.Sprintf("název alba „%s“ obsahuje datum%s", al.Nazev, datumOnline.Text("online alb s datem v názvu")),
						"nazev", datumOnline.Jistota(predpoklad, 6))
				}
			}
			if al.Fotograf == "" && al.Typ != "Cover" {
				if v := vydaniAlba(*al); v != "" {
					if _, kf, n := jednotnyFotograf(indexy, j, func(x AlbumNavrhu) bool { return vydaniAlba(x) == v }); n > 0 {
						f := zapisyFotografu.Zapis(kf)
						pridat(m, al, "fotografAlba", f, fmt.Sprintf("fotograf jejího alba ze stejného čísla %s%s", v, fotografCisla.Text("alb modelek ze stejného čísla")),
							"cislo", fotografCisla.Jistota(0.8, 4))
						continue
					}
				}
				if _, kf, n := jednotnyFotograf(indexy, j, func(AlbumNavrhu) bool { return true }); n >= 2 {
					f := zapisyFotografu.Zapis(kf)
					pridat(m, al, "fotografAlba", f, fmt.Sprintf("všechna její ostatní alba s fotografem (%d) nafotil %s%s", n, f, fotografModelky.Text("alb modelek s jednotným fotografem")),
						"modelka", fotografModelky.Jistota(0.5, 2))
				}
			}
		}
	}
}

// Titul z názvu alba, jak ho název píše (0.02.045): „Pet of the Month“, „Playmate of the Year“, ne vždy Playmate
func titulZNazvu(zjednoduseny, obdobi string) string {
	for _, slovo := range []string{"pet", "honey", "playmate"} {
		if strings.Contains(zjednoduseny, slovo) {
			return strings.ToUpper(slovo[:1]) + slovo[1:] + " of the " + obdobi
		}
	}
	return "titul modelky " + map[string]string{"Month": "měsíce", "Year": "roku"}[obdobi]
}

// Modelka měsíce čísla: „playmate měsíce“ jen u Playboye, jinak obecně (Pet of the Month Penthouse, 0.02.045)
func modelkaMesiceCisla(vydani string) string {
	if _, c := hledani.RozdelitCasopis(vydani); c != "" && c != hledani.VychoziCasopis {
		return "modelky měsíce"
	}
	return "playmate měsíce"
}
