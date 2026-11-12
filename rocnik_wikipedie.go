package main

// Ročník podle Wikipedie: Playmate měsíců ze seznamu „List of Playboy Playmates of RRRR“ (všechny infoboxy
// v oddílech měsíců, některé měsíce mají víc Playmate) a Playmate roku ze seznamu „List of Playboy Playmates of
// the Year“, porovnané se sbírkou. Jen na kliknutí; zápis (jméno z Wikipedie) jen s potvrzením.
//
// Penthouse (0.02.064): anglická Wikipedie seznam Pets nemá (článek smazán), italská má celý seznam „Penthouse
// Pet“ – oddíl Pet of the Year („* 1985 – Jméno“) a Pet of the Month po rocích („;1985“ a „*Gennaio – Jméno“).

import (
	"fmt"
	"pinup-katalog/internal/hledani"
	"regexp"
	"strconv"
	"strings"
)

type RadekRocniku struct {
	Mesic        int    `json:"mesic"` // 1–12; 0 = Playmate roku
	Vydani       string `json:"vydani"`
	Jmeno        string `json:"jmeno"` // podle Wikipedie
	URL          string `json:"url"`
	Stav         string `json:"stav"` // shoda | preklep | jine-jmeno | jiny-mesic | bez-centerfoldu | chybi | nenalezeno
	ModelkaID    int    `json:"modelkaId"`
	JmenoSbirky  string `json:"jmenoSbirky"`
	VydaniSbirky string `json:"vydaniSbirky"` // u jiného měsíce: kde má ve sbírce centerfold
}

type RocnikWikipedie struct {
	Rok     int    `json:"rok"`
	Casopis string `json:"casopis"` // PB, PH
	// Tituly modelky měsíce a roku podle časopisu (Playmate of the Month, Pet of the Year…)
	TitulMesice string         `json:"titulMesice"`
	TitulRoku   string         `json:"titulRoku"`
	Radky       []RadekRocniku `json:"radky"`
	Shod        int            `json:"shod"`
	Chyba       string         `json:"chyba"`
	Zdroje      []string       `json:"zdroje"`
}

const podobnostPreklepu = 0.88

var vzorPmoyRadku = regexp.MustCompile(`(?m)^\*\s*(\d{4})\s*:\s*(.+)$`)

// Jména Playmate po měsících (1–12) z oddílů seznamu ročníku
func playmatyRocniku(rok int) (map[int][]string, string, error) {
	stranka := fmt.Sprintf("List of Playboy Playmates of %d", rok)
	text, _, err := wikitextStranky(adresaWikipedie, stranka, "")
	if err != nil || text == "" {
		return nil, "", err
	}
	v := map[int][]string{}
	for m := 1; m <= 12; m++ {
		i := regexp.MustCompile(`(?m)^==\s*` + nazvyMesicuEn[m] + `\s*==\s*$`).FindStringIndex(text)
		if i == nil {
			continue
		}
		oddil := text[i[1]:]
		if j := regexp.MustCompile(`(?m)^==[^=]`).FindStringIndex(oddil); j != nil {
			oddil = oddil[:j[0]]
		}
		for {
			pole := poleInfoboxu(oddil, "Infobox Playboy Playmate")
			if pole == nil {
				break
			}
			if jmeno := vycistitWikitext(pole["name"]); jmeno != "" {
				v[m] = append(v[m], jmeno)
			}
			// Další infobox v témže oddílu
			k := strings.Index(strings.ToLower(oddil), "{{infobox playboy playmate")
			oddil = oddil[k+len("{{infobox playboy playmate"):]
		}
	}
	return v, webWikipedie + strings.ReplaceAll(stranka, " ", "_"), nil
}

// Playmate roku podle seznamu (jeden řádek „*1995: [[Julie Lynn Cialini]]“, někdy dvě jména)
func playmateRokuWikipedie(rok int) ([]string, string, error) {
	stranka := "List of Playboy Playmates of the Year"
	text, _, err := wikitextStranky(adresaWikipedie, stranka, "")
	if err != nil || text == "" {
		return nil, "", err
	}
	for _, s := range vzorPmoyRadku.FindAllStringSubmatch(text, -1) {
		if s[1] != strconv.Itoa(rok) {
			continue
		}
		var jmena []string
		for _, odkaz := range vzorOdkazuWiki.FindAllStringSubmatch(s[2], -1) {
			jmena = append(jmena, strings.TrimSpace(odkaz[1]))
		}
		if len(jmena) == 0 {
			jmena = []string{vycistitWikitext(s[2])}
		}
		return jmena, webWikipedie + strings.ReplaceAll(stranka, " ", "_"), nil
	}
	return nil, "", nil
}

func jePlaymateRokuZ(m *Modelka, rok int) bool {
	return strings.Contains(m.PlaymateRoku, strconv.Itoa(rok))
}

// Porovnání ročníku americké edice Playboye se sbírkou
func (a *App) RocnikPodleWikipedie(rok int) RocnikWikipedie {
	return a.RocnikCasopisuPodleWikipedie(rok, hledani.VychoziCasopis)
}

// Časopisy, které mají seznam modelek měsíce na Wikipedii (klíč časopisu)
var rocnikyNaWikipedii = map[string]bool{hledani.VychoziCasopis: true, "PH": true}

// Porovnání ročníku časopisu (americká edice) se sbírkou: PB podle anglické, PH podle italské Wikipedie
func (a *App) RocnikCasopisuPodleWikipedie(rok int, casopis string) RocnikWikipedie {
	if casopis == "" {
		casopis = hledani.VychoziCasopis
	}
	r := RocnikWikipedie{Rok: rok, Casopis: casopis, Radky: []RadekRocniku{}, Zdroje: []string{}}
	tituly := a.titulyCasopisu()[casopis]
	r.TitulMesice, r.TitulRoku = tituly[0], tituly[1]
	if !rocnikyNaWikipedii[casopis] {
		r.Chyba = "Pro tento časopis Wikipedie seznam modelek měsíce nemá."
		return r
	}
	if rok < 1953 || rok > 2030 {
		r.Chyba = "Neplatný ročník."
		return r
	}
	var mesice map[int][]string
	var roku []string
	var adresa, adresaRoku string
	var err error
	klic := func(mesic int) string { return fmt.Sprintf("%d-%02d", rok, mesic) }
	odkaz := func(mesic int) string { return fmt.Sprintf("%s#%s", adresa, nazvyMesicuEn[mesic]) }
	// Čísla modelky, ve kterých je modelkou měsíce, a vzor měsíčního čísla časopisu
	cisla := func(m *Modelka) []string { return m.Centerfoldy }
	mesicni := vzorCenterfolduUS.MatchString
	jeRoku := func(m *Modelka) bool { return jePlaymateRokuZ(m, rok) }
	if casopis == "PH" {
		mesice, roku, adresa, err = petyPenthouse(rok)
		adresaRoku = adresa
		klic = func(mesic int) string { return fmt.Sprintf("%d-%02d@PH", rok, mesic) }
		odkaz = func(int) string { return adresa }
		// Pet bývá ve sbírce jako album s titulem měsíce, nejen centerfold
		cisla = func(m *Modelka) []string { return append(append([]string(nil), m.Centerfoldy...), m.Vydani...) }
		mesicni = vzorCislaPenthouse.MatchString
		jeRoku = func(m *Modelka) bool {
			for _, t := range m.TitulyJinde {
				if t.Nazev == r.TitulRoku && t.Rok == strconv.Itoa(rok) {
					return true
				}
			}
			return false
		}
	} else {
		mesice, adresa, err = playmatyRocniku(rok)
		if err == nil && mesice != nil {
			// Playmate roku (chyba seznamu ročník nekazí)
			if jmena, a2, e2 := playmateRokuWikipedie(rok); e2 == nil {
				roku, adresaRoku = jmena, a2
			}
		}
	}
	if err != nil {
		r.Chyba = "Wikipedie neodpovídá: " + err.Error()
		return r
	}
	if mesice == nil {
		r.Chyba = fmt.Sprintf("Wikipedie nemá seznam %s roku %d.", nazevSeznamu(tituly[0]), rok)
		return r
	}
	r.Zdroje = append(r.Zdroje, adresa)
	modelky := a.snimekSbirky().modelky
	podleJmena := func(jmeno string) *Modelka {
		for i := range modelky {
			if stejneJmeno(&modelky[i], jmeno) {
				return &modelky[i]
			}
		}
		return nil
	}
	for mesic := 1; mesic <= 12; mesic++ {
		vydani := klic(mesic)
		url := odkaz(mesic)
		// Modelky měsíce sbírky v tomto čísle; každá jde spárovat jen jednou
		var vCisle []*Modelka
		for i := range modelky {
			if obsahuje(cisla(&modelky[i]), vydani) {
				vCisle = append(vCisle, &modelky[i])
			}
		}
		pouzite := map[int]bool{}
		jmena := mesice[mesic]
		if len(jmena) == 0 {
			r.Radky = append(r.Radky, RadekRocniku{Mesic: mesic, Vydani: vydani, URL: url, Stav: "nenalezeno"})
			continue
		}
		var cekaji []RadekRocniku
		for _, jmeno := range jmena {
			radek := RadekRocniku{Mesic: mesic, Vydani: vydani, Jmeno: jmeno, URL: url}
			for _, m := range vCisle {
				if !pouzite[m.ID] && stejneJmeno(m, jmeno) {
					radek.Stav, radek.ModelkaID, radek.JmenoSbirky = "shoda", m.ID, m.Jmeno
					pouzite[m.ID] = true
					break
				}
			}
			if radek.Stav == "" {
				cekaji = append(cekaji, radek)
				continue
			}
			r.Radky = append(r.Radky, radek)
		}
		for _, radek := range cekaji {
			if m := podleJmena(radek.Jmeno); m != nil {
				radek.ModelkaID, radek.JmenoSbirky = m.ID, m.Jmeno
				radek.Stav = "bez-centerfoldu"
				for _, c := range cisla(m) {
					if mesicni(c) {
						radek.Stav, radek.VydaniSbirky = "jiny-mesic", c
						break
					}
				}
			} else {
				// Ve sbírce je v čísle někdo jiný: podobné jméno = nejspíš překlep
				nejlepsi, podobnost := (*Modelka)(nil), 0.0
				for _, m := range vCisle {
					if pouzite[m.ID] {
						continue
					}
					if p := jaroWinkler(zjednodusit(m.Jmeno), zjednodusit(radek.Jmeno)); p > podobnost {
						nejlepsi, podobnost = m, p
					}
				}
				switch {
				case nejlepsi != nil && podobnost >= podobnostPreklepu:
					radek.Stav, radek.ModelkaID, radek.JmenoSbirky = "preklep", nejlepsi.ID, nejlepsi.Jmeno
					pouzite[nejlepsi.ID] = true
				case nejlepsi != nil:
					radek.Stav, radek.ModelkaID, radek.JmenoSbirky = "jine-jmeno", nejlepsi.ID, nejlepsi.Jmeno
					pouzite[nejlepsi.ID] = true
				default:
					radek.Stav = "chybi"
				}
			}
			r.Radky = append(r.Radky, radek)
		}
	}
	if len(roku) > 0 {
		if adresaRoku != adresa {
			r.Zdroje = append(r.Zdroje, adresaRoku)
		}
		for _, jmeno := range roku {
			radek := RadekRocniku{Mesic: 0, Jmeno: jmeno, URL: adresaRoku, Stav: "chybi"}
			if m := podleJmena(jmeno); m != nil {
				radek.ModelkaID, radek.JmenoSbirky = m.ID, m.Jmeno
				radek.Stav = "bez-oceneni"
				if jeRoku(m) {
					radek.Stav = "shoda"
				}
			}
			r.Radky = append(r.Radky, radek)
		}
	}
	for _, radek := range r.Radky {
		if radek.Stav == "shoda" {
			r.Shod++
		}
	}
	return r
}

func nazevSeznamu(titul string) string {
	if t := strings.TrimSuffix(strings.TrimSuffix(titul, " of the Month"), " měsíce"); t != "" {
		return t
	}
	return "modelek měsíce"
}

// ——— Penthouse Pets z italské Wikipedie ———

var (
	vzorCislaPenthouse = regexp.MustCompile(`^\d{4}-\d{2}@PH$`)
	vzorRokuPetu       = regexp.MustCompile(`(?m)^;\s*(\d{4})\b`)
	vzorPetuMesice     = regexp.MustCompile(`^\*\s*([A-Za-z]+)\s*[–—-]\s*(.+)$`)
	vzorPetuRoku       = regexp.MustCompile(`(?m)^\*\s*(\d{4})\s*[–—-]\s*(.+)$`)
	mesiceIt           = map[string]int{"gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4, "maggio": 5, "giugno": 6,
		"luglio": 7, "agosto": 8, "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12}
)

const strankaPetu = "Penthouse Pet"

// Pets měsíců (1–12) a Pet of the Year daného roku ze seznamu na italské Wikipedii; mesice nil = rok v seznamu není
func petyPenthouse(rok int) (map[int][]string, []string, string, error) {
	text, _, err := wikitextStranky(adresaWikipedieIt, strankaPetu, "")
	if err != nil || text == "" {
		return nil, nil, "", err
	}
	text = vzorRef.ReplaceAllString(text, "")
	adresa := webWikipedieIt + strings.ReplaceAll(strankaPetu, " ", "_")
	var mesice map[int][]string
	roky := vzorRokuPetu.FindAllStringSubmatchIndex(text, -1)
	for k, m := range roky {
		if text[m[2]:m[3]] != strconv.Itoa(rok) {
			continue
		}
		konec := len(text)
		if k+1 < len(roky) {
			konec = roky[k+1][0]
		}
		oddil := text[m[1]:konec]
		if n := regexp.MustCompile(`(?m)^==`).FindStringIndex(oddil); n != nil {
			oddil = oddil[:n[0]]
		}
		mesice = map[int][]string{}
		for _, radek := range strings.Split(oddil, "\n") {
			s := vzorPetuMesice.FindStringSubmatch(strings.TrimSpace(radek))
			if s == nil {
				continue
			}
			if mesic := mesiceIt[strings.ToLower(s[1])]; mesic > 0 {
				if jmeno := vycistitWikitext(s[2]); jmeno != "" {
					mesice[mesic] = append(mesice[mesic], jmeno)
				}
			}
		}
		break
	}
	// Pet of the Year: oddíl před Pet of the Month
	var roku []string
	oddilRoku := text
	if i := strings.Index(text, "== Pet of the Month"); i >= 0 {
		oddilRoku = text[:i]
	}
	for _, s := range vzorPetuRoku.FindAllStringSubmatch(oddilRoku, -1) {
		if s[1] == strconv.Itoa(rok) {
			if jmeno := vycistitWikitext(s[2]); jmeno != "" {
				roku = append(roku, jmeno)
			}
		}
	}
	return mesice, roku, adresa, nil
}

// Jméno z Wikipedie k modelce: přejmenovat (dosavadní jméno přejde do dalších jmen), nebo jen přidat jako další jméno
func (a *App) PrijmoutJmenoZWikipedie(id int, jmeno string, prejmenovat bool) bool {
	jmeno = strings.TrimSpace(jmeno)
	m, ok := a.modelkaPodleID(id)
	if !ok || jmeno == "" {
		return false
	}
	dalsi := strings.Split(m.DalsiJmena, ",")
	pridat := func(j string) {
		for _, d := range dalsi {
			if bez, _ := hledani.RozdelitJmeno(d); zjednodusit(bez) == zjednodusit(j) {
				return
			}
		}
		dalsi = append(dalsi, j)
	}
	if prejmenovat {
		if zjednodusit(m.Jmeno) != zjednodusit(jmeno) {
			pridat(m.Jmeno)
		}
		m.Jmeno = jmeno
	} else {
		pridat(jmeno)
	}
	var cista []string
	for _, d := range dalsi {
		if d = strings.TrimSpace(d); d != "" && zjednodusit(d) != zjednodusit(m.Jmeno) {
			cista = append(cista, d)
		}
	}
	m.DalsiJmena = strings.Join(cista, ", ")
	m.CoverID = ""
	return a.UpdateModelka(m)
}
