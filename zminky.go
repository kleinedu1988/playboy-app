package main

// Obousměrné odkazy: v textech sbírky (poznámka modelky, průvodní text alba, článek, poznámka čísla) odkazuje
// [[Jméno modelky]], [[06/1995]] (i [[1995-06]], [[06/1995 DE]]) nebo [[Fotograf]], volitelně s popiskem
// [[cíl|popisek]]. GetZminky najde všechna místa, která na modelku nebo číslo odkazují („Zmiňováno v…“).

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var (
	vzorOdkazuTextu  = regexp.MustCompile(`\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]`)
	vzorOdkazuMesic  = regexp.MustCompile(`^(\d{1,2})\s*/\s*(\d{4})(?:[\s-]+([A-Za-z]{2}))?$`)
	vzorOdkazuVydani = regexp.MustCompile(`^(\d{4})-(\d{2}|S\d{2})(?:-([A-Za-z]{2}))?$`)
)

// Klíč vydání z odkazu („06/1995“ → „1995-06“, „06/1995 DE“ → „1995-06-DE“); "" = není číslo
func vydaniZOdkazu(text string) string {
	t := strings.TrimSpace(text)
	var rok, mesic, edice string
	if s := vzorOdkazuMesic.FindStringSubmatch(t); s != nil {
		m, _ := strconv.Atoi(s[1])
		if m < 1 || m > 12 {
			return ""
		}
		rok, mesic, edice = s[2], fmt.Sprintf("%02d", m), s[3]
	} else if s := vzorOdkazuVydani.FindStringSubmatch(t); s != nil {
		rok, mesic, edice = s[1], s[2], s[3]
		if m, err := strconv.Atoi(mesic); err == nil && (m < 1 || m > 12) {
			return ""
		}
	} else {
		return ""
	}
	edice = strings.ToUpper(edice)
	if edice == "" || edice == "US" {
		return rok + "-" + mesic
	}
	return rok + "-" + mesic + "-" + edice
}

// Modelka podle jména nebo dalšího jména (bez diakritiky a velikosti písmen)
func modelkaZOdkazu(text string, modelky []Modelka) int {
	j := zjednodusit(strings.TrimSpace(text))
	if j == "" {
		return 0
	}
	for i := range modelky {
		if zjednodusit(modelky[i].Jmeno) == j {
			return modelky[i].ID
		}
	}
	for i := range modelky {
		for _, d := range strings.Split(modelky[i].DalsiJmena, ",") {
			if zjednodusit(strings.TrimSpace(d)) == j {
				return modelky[i].ID
			}
		}
	}
	return 0
}

type Zminka struct {
	Druh      string `json:"druh"` // modelka | album | clanek | cislo
	Nazev     string `json:"nazev"`
	ModelkaID int    `json:"modelkaId"`
	Vydani    string `json:"vydani"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
	ClanekID  int    `json:"clanekId"`
	Uryvek    string `json:"uryvek"`
}

// Úryvek kolem odkazu: odkazy nahrazené popisky, nejvýš ~140 znaků
func uryvekOdkazu(text string, od, do_ int) string {
	zacatek, konec := od, do_
	for n := 0; zacatek > 0 && n < 70; n++ {
		zacatek--
	}
	for n := 0; konec < len(text) && n < 70; n++ {
		konec++
	}
	// Na hranici znaku UTF-8
	for zacatek > 0 && !utf8Zacatek(text[zacatek]) {
		zacatek--
	}
	for konec < len(text) && !utf8Zacatek(text[konec]) {
		konec++
	}
	kus := vzorOdkazuTextu.ReplaceAllStringFunc(text[zacatek:konec], func(o string) string {
		s := vzorOdkazuTextu.FindStringSubmatch(o)
		if s[2] != "" {
			return s[2]
		}
		return s[1]
	})
	kus = strings.Join(strings.Fields(strings.NewReplacer("**", "", "__", "", "~~", "", "\n", " ").Replace(kus)), " ")
	if zacatek > 0 {
		kus = "…" + kus
	}
	if konec < len(text) {
		kus += "…"
	}
	return kus
}

func utf8Zacatek(b byte) bool { return b&0xC0 != 0x80 }

// Zmínky o modelce (druh "modelka", klic = id) nebo o čísle (druh "vydani", klic = RRRR-MM[-ED])
func (a *App) GetZminky(druh, klic string) []Zminka {
	zminky := []Zminka{}
	modelky := a.snimekSbirky().modelky
	idCile, _ := strconv.Atoi(klic)
	jmena := map[int]string{}
	for i := range modelky {
		jmena[modelky[i].ID] = modelky[i].Jmeno
	}
	// Odkazuje text na cíl? Vrátí pozici prvního takového odkazu
	trefa := func(text string) (int, int, bool) {
		for _, p := range vzorOdkazuTextu.FindAllStringSubmatchIndex(text, -1) {
			cil := text[p[2]:p[3]]
			if druh == "vydani" && vydaniZOdkazu(cil) == klic {
				return p[0], p[1], true
			}
			if druh == "modelka" && vydaniZOdkazu(cil) == "" && modelkaZOdkazu(cil, modelky) == idCile && idCile > 0 {
				return p[0], p[1], true
			}
		}
		return 0, 0, false
	}

	radky, err := a.db.Query(`SELECT id, poznamka FROM modelky WHERE poznamka LIKE '%[[%' ORDER BY jmeno`)
	if err == nil {
		for radky.Next() {
			var id int
			var text string
			if radky.Scan(&id, &text) != nil || (druh == "modelka" && id == idCile) {
				continue
			}
			if od, do_, ok := trefa(text); ok {
				zminky = append(zminky, Zminka{Druh: "modelka", Nazev: jmena[id], ModelkaID: id, Uryvek: uryvekOdkazu(text, od, do_)})
			}
		}
		radky.Close()
	}
	radky, err = a.db.Query(`SELECT COALESCE(modelka_id, 0), album, typ, vydani, popis FROM alba WHERE popis LIKE '%[[%' ORDER BY vydani, album`)
	if err == nil {
		for radky.Next() {
			var id int
			var album, typ, vydani, text string
			if radky.Scan(&id, &album, &typ, &vydani, &text) != nil {
				continue
			}
			if od, do_, ok := trefa(text); ok {
				zminky = append(zminky, Zminka{Druh: "album", Nazev: jmena[id], ModelkaID: id, Album: album, Typ: typ, Vydani: vydani, Uryvek: uryvekOdkazu(text, od, do_)})
			}
		}
		radky.Close()
	}
	radky, err = a.db.Query(`SELECT id, vydani, nazev, text FROM clanky WHERE text LIKE '%[[%' ORDER BY vydani, strana`)
	if err == nil {
		for radky.Next() {
			var id int
			var vydani, nazev, text string
			if radky.Scan(&id, &vydani, &nazev, &text) != nil {
				continue
			}
			if od, do_, ok := trefa(text); ok {
				zminky = append(zminky, Zminka{Druh: "clanek", Nazev: nazev, ClanekID: id, Vydani: vydani, Uryvek: uryvekOdkazu(text, od, do_)})
			}
		}
		radky.Close()
	}
	radky, err = a.db.Query(`SELECT vydani, poznamka FROM vydani WHERE poznamka LIKE '%[[%' ORDER BY vydani`)
	if err == nil {
		for radky.Next() {
			var vydani, text string
			if radky.Scan(&vydani, &text) != nil || (druh == "vydani" && vydani == klic) {
				continue
			}
			if od, do_, ok := trefa(text); ok {
				zminky = append(zminky, Zminka{Druh: "cislo", Vydani: vydani, Uryvek: uryvekOdkazu(text, od, do_)})
			}
		}
		radky.Close()
	}
	return zminky
}
