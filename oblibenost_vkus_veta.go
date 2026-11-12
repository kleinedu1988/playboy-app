package main

// Důvod tipu „Mohlo by se ti líbit“ jako věta místo výčtu údajů. Slovník převádí každý údaj, který odhad zvedá,
// na frázi ve správném tvaru a skladatel z nich poskládá souvětí:
//
//	„Zrzka z 90. let, která byla Playmate měsíce a má tetování. Fotil ji Pompeo Posar. Podobá se modelkám,
//	které se ti líbí: Victoria Fuller (4 ♥) a Arlene Baxter (4½ ♥). Takhle vysoké tipy ti zatím sedí zhruba
//	ve 3 ze 4 případů.“
//
// Fráze mají čtyři druhy podle místa ve větě: podstatné jméno na začátek („Zrzka“), přívlastek za něj („z 90. let“,
// „z Norska“), vedlejší věta za „která“ („byla Playmate měsíce“) a samostatná věta („Fotil ji Pompeo Posar.“).

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
)

const (
	frJmeno = iota
	frPrivlastek
	frKtera
	frVeta
)

type frazeVkusu struct {
	druh int
	text string
}

// Země v 2. pádě („z Norska“) pro národnosti ve sbírce; jiné zůstanou jako „národnost X“
var zemeVkusu = map[string]string{
	"usa": "z USA", "spojene staty": "z USA", "americka": "z USA",
	"kanada": "z Kanady", "kanadska": "z Kanady",
	"norsko": "z Norska", "norska": "z Norska",
	"svedsko": "ze Švédska", "svedska": "ze Švédska",
	"dansko": "z Dánska", "danska": "z Dánska",
	"finsko": "z Finska", "finska": "z Finska",
	"island": "z Islandu", "islandska": "z Islandu",
	"velka britanie": "z Velké Británie", "spojene kralovstvi": "z Velké Británie", "britska": "z Velké Británie", "anglie": "z Anglie",
	"irsko": "z Irska", "irska": "z Irska",
	"nemecko": "z Německa", "nemecka": "z Německa",
	"nizozemsko": "z Nizozemska", "nizozemska": "z Nizozemska",
	"francie": "z Francie", "francouzska": "z Francie",
	"italie": "z Itálie", "italska": "z Itálie",
	"spanelsko": "ze Španělska", "spanelska": "ze Španělska",
	"malta": "z Malty", "maltska": "z Malty",
	"rakousko": "z Rakouska", "rakouska": "z Rakouska",
	"svycarsko": "ze Švýcarska", "svycarska": "ze Švýcarska",
	"belgie": "z Belgie", "belgicka": "z Belgie",
	"ceska republika": "z Česka", "cesko": "z Česka", "ceska": "z Česka",
	"slovensko": "ze Slovenska", "slovenska": "ze Slovenska",
	"polsko": "z Polska", "polska": "z Polska",
	"rusko": "z Ruska", "ruska": "z Ruska",
	"ukrajina": "z Ukrajiny", "ukrajinska": "z Ukrajiny",
	"madarsko": "z Maďarska", "madarska": "z Maďarska",
	"recko": "z Řecka", "recka": "z Řecka",
	"mexiko": "z Mexika", "mexicka": "z Mexika",
	"brazilie": "z Brazílie", "brazilska": "z Brazílie",
	"kolumbie": "z Kolumbie", "kolumbijska": "z Kolumbie",
	"argentina": "z Argentiny", "argentinska": "z Argentiny",
	"venezuela": "z Venezuely", "venezuelska": "z Venezuely",
	"kuba": "z Kuby", "kubanska": "z Kuby",
	"portoriko": "z Portorika", "portoricka": "z Portorika",
	"australie": "z Austrálie", "australska": "z Austrálie",
	"novy zeland": "z Nového Zélandu",
	"japonsko":    "z Japonska", "japonska": "z Japonska",
	"cina": "z Číny", "cinska": "z Číny",
	"filipiny": "z Filipín", "filipinska": "z Filipín",
	"thajsko": "z Thajska", "thajska": "z Thajska",
}

// Vlasy jako podstatné jméno na začátek věty
func jmenoPodleVlasu(vlasy string) string {
	switch v := zjednodusit(vlasy); {
	case strings.Contains(v, "blond"):
		return "Blondýnka"
	case strings.Contains(v, "zrzav") || strings.Contains(v, "rysav") || strings.Contains(v, "cerven"):
		return "Zrzka"
	case strings.Contains(v, "cern"):
		return "Černovláska"
	case strings.Contains(v, "hned") || strings.Contains(v, "kastan"):
		return "Brunetka"
	}
	return ""
}

// Barva v 1. pádě ženského rodu → množné číslo („modrá“ → „modré“)
func barvaMnozne(barva string) string {
	b := strings.ToLower(strings.TrimSpace(barva))
	if strings.HasSuffix(b, "á") {
		return strings.TrimSuffix(b, "á") + "é"
	}
	return b
}

// Desetiletí ve 2. pádě („z 90. let“, „z nultých let“)
func zDesetileti(d int) string {
	switch {
	case d >= 1900 && d < 2000:
		return fmt.Sprintf("z %d. let", d-1900)
	case d == 2000:
		return "z nultých let"
	case d == 2010:
		return "z desátých let"
	}
	return fmt.Sprintf("z let %d–%d", d, d+9)
}

// Role ze slovníku („PMOTM“ → „byla Playmate měsíce“); "" = nic neříká (Model)
func frazeRole(role string) string {
	r := zjednodusit(role)
	switch {
	case r == "pmotm" || strings.HasPrefix(r, "playmate mesice"):
		return "byla Playmate měsíce"
	case r == "pmoty" || strings.HasPrefix(r, "playmate roku"):
		return "byla Playmate roku"
	case strings.HasPrefix(r, "herec") || strings.HasPrefix(r, "herck") || r == "actress":
		return "hraje i ve filmech"
	case strings.Contains(r, "bunny"):
		return "byla Playboy Bunny"
	case strings.HasPrefix(r, "zpevac") || r == "singer":
		return "také zpívá"
	case strings.HasPrefix(r, "modelka obalky"):
		return "byla na obálce Playboye"
	case strings.HasPrefix(r, "cyber girl"):
		return "byla Cyber Girl"
	case r == "model" || r == "modelka":
		return ""
	case strings.HasSuffix(r, "of the month") || strings.HasSuffix(r, "of the year") || strings.HasSuffix(r, " mesice") || strings.HasSuffix(r, " roku"):
		// Titul jiného časopisu („Pet of the Month“, 0.02.022)
		return "byla " + strings.TrimSpace(role)
	}
	return "je " + strings.TrimSpace(role)
}

// Číselný údaj modelky jako fráze
func frazeCisla(c int, x float64) frazeVkusu {
	cislo := func(d int) string { return cisloCesky(x, d) }
	switch c {
	case cvVyska:
		return frazeVkusu{frKtera, fmt.Sprintf("měří %s cm", cislo(0))}
	case cvVaha:
		return frazeVkusu{frKtera, fmt.Sprintf("váží %s kg", cislo(0))}
	case cvHrudnik:
		return frazeVkusu{frKtera, fmt.Sprintf("má přes prsa %s cm", cislo(0))}
	case cvPas:
		return frazeVkusu{frKtera, fmt.Sprintf("má pas %s cm", cislo(0))}
	case cvBoky:
		return frazeVkusu{frKtera, fmt.Sprintf("má boky %s cm", cislo(0))}
	case cvBmi:
		if x < 19 {
			return frazeVkusu{frKtera, "je hodně štíhlá"}
		}
		if x < 21.5 {
			return frazeVkusu{frKtera, "je štíhlá"}
		}
		return frazeVkusu{frKtera, "má plnější postavu"}
	case cvPomer:
		if x <= 0.72 {
			return frazeVkusu{frKtera, "má výrazně útlý pas"}
		}
		return frazeVkusu{frKtera, "má sportovní postavu"}
	case cvHrudPas:
		if x >= 1.4 {
			return frazeVkusu{frKtera, "má výrazné křivky"}
		}
		return frazeVkusu{frKtera, "má spíš drobnou postavu"}
	case cvVek:
		return frazeVkusu{frVeta, fmt.Sprintf("Na prvních fotkách jí bylo %d let.", int(math.Round(x)))}
	case cvRok:
		return frazeVkusu{frPrivlastek, zDesetileti(int(x) / 10 * 10)}
	case cvFotky:
		// Nízký průměr zní jako důvod proti, i když odhad zvedá (proti modelkám bez hodnocených fotek)
		if x < 3 {
			return frazeVkusu{}
		}
		return frazeVkusu{frVeta, fmt.Sprintf("Její fotky hodnotíš v průměru %s ♥.", cislo(1))}
	case cvSkore:
		return frazeVkusu{frVeta, "Její fotky u tebe dobře bodují."}
	case cvObsah:
		return frazeVkusu{frVeta, "Na jejích fotkách je to, co hodnotíš nejvýš."}
	}
	return frazeVkusu{}
}

// Údaj (klíč příspěvku) jako fráze ze slovníku; prázdný text = do věty nepatří
func (v *modelVkusu) frazeUdaje(u udajeVkusu, klic string) frazeVkusu {
	if strings.HasPrefix(klic, "era=") {
		d, _ := strconv.Atoi(strings.TrimPrefix(klic, "era="))
		return frazeVkusu{frPrivlastek, zDesetileti(d)}
	}
	if klic == "#fotky" {
		if u.ma[cvFotky] {
			return frazeCisla(cvFotky, u.cis[cvFotky])
		}
		return frazeCisla(cvSkore, u.cis[cvSkore])
	}
	if c, err := strconv.Atoi(strings.TrimPrefix(klic, "#")); err == nil && strings.HasPrefix(klic, "#") && c >= 0 && c < pocetCisVkusu {
		return frazeCisla(c, u.cis[c])
	}
	skupina, _, _ := strings.Cut(klic, "=")
	zapis := v.popisPrispevku(u, klic)
	// Zápis hodnoty této modelky (popis sloupce je nejčastější zápis ze všech)
	for i, k := range u.kat {
		if k == klic && i < len(u.zapisy) {
			zapis = u.zapisy[i]
		}
	}
	hodnota := strings.TrimSpace(zapis[strings.Index(zapis, ":")+1:])
	switch skupina {
	case "vlasy":
		if j := jmenoPodleVlasu(zapis); j != "" {
			return frazeVkusu{frJmeno, j}
		}
		return frazeVkusu{frKtera, "má " + barvaMnozne(zapis) + " vlasy"}
	case "oci":
		return frazeVkusu{frKtera, "má " + barvaMnozne(hodnota) + " oči"}
	case "narodnost":
		prvni, _, _ := strings.Cut(zapis, ",")
		if z, ok := zemeVkusu[zjednodusit(strings.TrimSpace(prvni))]; ok {
			return frazeVkusu{frPrivlastek, z}
		}
		return frazeVkusu{frKtera, "má národnost " + zapis}
	case "etnicita":
		return frazeVkusu{} // do věty ne (jen národnost)
	case "prsa":
		return frazeVkusu{frKtera, "má " + strings.ToLower(hodnota) + " prsa"}
	case "kosicek":
		return frazeVkusu{frKtera, "má košíček " + strings.TrimPrefix(zapis, "košíček ")}
	case "ochlupeni":
		switch h := zjednodusit(hodnota); {
		case strings.HasPrefix(h, "ohol"):
			return frazeVkusu{frKtera, "je oholená"}
		case strings.HasPrefix(h, "zastriz"):
			return frazeVkusu{frKtera, "je upravená"}
		}
		return frazeVkusu{frKtera, "má " + strings.ToLower(hodnota) + " ochlupení"}
	case "tetovani":
		if strings.HasSuffix(klic, "=ano") {
			return frazeVkusu{frKtera, "má tetování"}
		}
		return frazeVkusu{frKtera, "nemá tetování"}
	case "piercing":
		if strings.HasSuffix(klic, "=ano") {
			return frazeVkusu{frKtera, "má piercing"}
		}
		return frazeVkusu{frKtera, "nemá piercing"}
	case "kategorie":
		if f := frazeRole(zapis); f != "" {
			return frazeVkusu{frKtera, f}
		}
		return frazeVkusu{}
	case "fotograf":
		return frazeVkusu{frVeta, "Fotil ji " + zapis + "."}
	case "casopis":
		return frazeVkusu{frKtera, "vyšla v časopise " + zapis}
	}
	return frazeVkusu{frKtera, "má " + zapis}
}

// Výčet „a, b a c“
func vycet(x []string) string {
	switch len(x) {
	case 0:
		return ""
	case 1:
		return x[0]
	}
	return strings.Join(x[:len(x)-1], ", ") + " a " + x[len(x)-1]
}

// Jak často vysoké tipy sedí, slovy („zhruba ve 3 ze 4 případů“)
func castostSlovy(trefy, celkem int) string {
	p := float64(trefy) / float64(celkem)
	switch {
	case p >= 0.9:
		return "skoro vždy"
	case p >= 0.72:
		return "zhruba ve 3 ze 4 případů"
	case p >= 0.6:
		return "zhruba ve 2 ze 3 případů"
	case p >= 0.45:
		return "zhruba v polovině případů"
	}
	return "zatím spíš výjimečně"
}

// Věta důvodu tipu: údaje, které odhad nejvíc zvedají (nejvýš 4), podobné hodnocené modelky a spolehlivost
func (v *modelVkusu) vetaTipu(id int, odhad float64) string {
	u := v.udaje[id]
	prispevky := v.prispevkyOdhadu(u)
	sort.Slice(prispevky, func(i, j int) bool {
		if prispevky[i].c != prispevky[j].c {
			return prispevky[i].c > prispevky[j].c
		}
		return prispevky[i].klic < prispevky[j].klic
	})
	var jmeno string
	var privlastky, ktera, vety []string
	pouzito := 0
	for _, p := range prispevky {
		if p.c < 0.05 || pouzito == 4 {
			break
		}
		f := v.frazeUdaje(u, p.klic)
		if f.text == "" {
			continue
		}
		pouzito++
		switch f.druh {
		case frJmeno:
			jmeno = f.text
		case frPrivlastek:
			privlastky = append(privlastky, f.text)
		case frKtera:
			ktera = append(ktera, f.text)
		case frVeta:
			vety = append(vety, f.text)
		}
	}
	// Začátek věty podle jejích vlasů, i když odhad nezvedají („Brunetka z 90. let“ zní líp než „Modelka…“)
	if jmeno == "" {
		for i, k := range u.kat {
			if strings.HasPrefix(k, "vlasy=") && i < len(u.zapisy) {
				jmeno = jmenoPodleVlasu(u.zapisy[i])
			}
		}
	}
	// „má sportovní postavu a košíček D“: opakované „má“ jen jednou
	for i := len(ktera) - 1; i > 0; i-- {
		if strings.HasPrefix(ktera[i], "má ") && strings.HasPrefix(ktera[i-1], "má ") {
			ktera[i] = strings.TrimPrefix(ktera[i], "má ")
		}
	}
	var casti []string
	if len(privlastky) > 0 || len(ktera) > 0 {
		if jmeno == "" {
			jmeno = "Modelka"
		}
		veta := strings.Join(append([]string{jmeno}, privlastky...), " ")
		if len(ktera) > 0 {
			veta += ", která " + vycet(ktera)
		}
		casti = append(casti, veta+".")
	}
	casti = append(casti, vety...)
	// Podobné jen z těch, které máš rád (♥3+): podobnost s modelkou za 1 ♥ důvodem není
	var jmena []string
	for _, h := range v.podobne(id, pocetPodobnychVkus+2) {
		if h.srdicka >= 3 && len(jmena) < pocetPodobnychVkus {
			jmena = append(jmena, fmt.Sprintf("%s (%s ♥)", h.jmeno, kratceSrdicka(h.srdicka)))
		}
	}
	if len(jmena) == 1 {
		casti = append(casti, "Podobá se modelce, která se ti líbí: "+jmena[0]+".")
	} else if len(jmena) > 1 {
		casti = append(casti, "Podobá se modelkám, které se ti líbí: "+vycet(jmena)+".")
	}
	if v.vysokych >= 5 {
		casti = append(casti, "Takhle vysoké tipy ti zatím sedí "+castostSlovy(v.trefVysokych, v.vysokych)+".")
	}
	if len(casti) == 0 {
		return "Odhad " + textSrdicek(zaokrouhlitNaPul(odhad)) + "."
	}
	return strings.Join(casti, " ")
}
