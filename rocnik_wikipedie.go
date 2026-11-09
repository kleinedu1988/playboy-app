package main

// Ročník podle Wikipedie: Playmate měsíců ze seznamu „List of Playboy Playmates of RRRR“ (všechny infoboxy
// v oddílech měsíců, některé měsíce mají víc Playmate) a Playmate roku ze seznamu „List of Playboy Playmates of
// the Year“, porovnané se sbírkou. Jen na kliknutí; zápis (jméno z Wikipedie) jen s potvrzením.

import (
	"fmt"
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
	Rok    int            `json:"rok"`
	Radky  []RadekRocniku `json:"radky"`
	Shod   int            `json:"shod"`
	Chyba  string         `json:"chyba"`
	Zdroje []string       `json:"zdroje"`
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

// Porovnání ročníku americké edice se sbírkou
func (a *App) RocnikPodleWikipedie(rok int) RocnikWikipedie {
	r := RocnikWikipedie{Rok: rok, Radky: []RadekRocniku{}, Zdroje: []string{}}
	if rok < 1953 || rok > 2030 {
		r.Chyba = "Neplatný ročník."
		return r
	}
	mesice, adresa, err := playmatyRocniku(rok)
	if err != nil {
		r.Chyba = "Wikipedie neodpovídá: " + err.Error()
		return r
	}
	if mesice == nil {
		r.Chyba = fmt.Sprintf("Wikipedie nemá seznam Playmate roku %d.", rok)
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
		vydani := fmt.Sprintf("%d-%02d", rok, mesic)
		url := fmt.Sprintf("%s#%s", adresa, nazvyMesicuEn[mesic])
		// Centerfoldy sbírky v tomto čísle; každý jde spárovat jen jednou
		var vCisle []*Modelka
		for i := range modelky {
			if obsahuje(modelky[i].Centerfoldy, vydani) {
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
				for _, c := range m.Centerfoldy {
					if vzorCenterfolduUS.MatchString(c) {
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
	// Playmate roku (chyba seznamu ročník nekazí)
	if jmena, adresaPmoy, err := playmateRokuWikipedie(rok); err == nil && len(jmena) > 0 {
		r.Zdroje = append(r.Zdroje, adresaPmoy)
		for _, jmeno := range jmena {
			radek := RadekRocniku{Mesic: 0, Jmeno: jmeno, URL: adresaPmoy, Stav: "chybi"}
			if m := podleJmena(jmeno); m != nil {
				radek.ModelkaID, radek.JmenoSbirky = m.ID, m.Jmeno
				radek.Stav = "bez-oceneni"
				if jePlaymateRokuZ(m, rok) {
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
			if zjednodusit(strings.TrimSpace(d)) == zjednodusit(j) {
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
