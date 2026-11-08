package main

// Uložené výběry Galerie (panel kolekcí): pojmenovaná kombinace řazení, filtrů a kolekce, kterou jde jedním klikem
// zase zapnout. Ukládají se jako JSON v tabulce nastaveni (klíč galerie_vybery) – schéma databáze ani export se
// nemění.

import (
	"encoding/json"
	"strings"
)

const (
	klicVyberuGalerie = "galerie_vybery"
	maxVyberuGalerie  = 30
)

// Uložený výběr: název a dotaz (jen řazení, srdíčka, typy, tagy, desetiletí a kolekce)
type VyberGalerie struct {
	Nazev        string       `json:"nazev"`
	NazevKolekce string       `json:"nazevKolekce"`
	Dotaz        DotazGalerie `json:"dotaz"`
}

func (a *App) GetVyberyGalerie() []VyberGalerie {
	v := []VyberGalerie{}
	if a.db == nil {
		return v
	}
	if json.Unmarshal([]byte(a.nastaveni(klicVyberuGalerie)), &v) != nil || v == nil {
		return []VyberGalerie{}
	}
	return v
}

// UlozitVyberGalerie uloží (stejný název přepíše) výběr na začátek seznamu; false bez názvu nebo při chybě
func (a *App) UlozitVyberGalerie(nazev string, d DotazGalerie) bool {
	nazev = strings.TrimSpace(nazev)
	if a.db == nil || nazev == "" {
		return false
	}
	if r := []rune(nazev); len(r) > 60 {
		nazev = string(r[:60])
	}
	vyber := VyberGalerie{Nazev: nazev, Dotaz: DotazGalerie{Razeni: d.Razeni, Srdicka: d.Srdicka, Typy: d.Typy, Tagy: d.Tagy, Dekady: d.Dekady, Kolekce: d.Kolekce}}
	if d.Kolekce != "" {
		_, vyber.NazevKolekce = a.filtrKolekce(a.fotkyGalerieVPameti(), d.Kolekce)
	}
	v := []VyberGalerie{vyber}
	for _, x := range a.GetVyberyGalerie() {
		if !strings.EqualFold(x.Nazev, nazev) && len(v) < maxVyberuGalerie {
			v = append(v, x)
		}
	}
	return a.ulozitVybery(v)
}

func (a *App) SmazatVyberGalerie(nazev string) bool {
	if a.db == nil {
		return false
	}
	var v []VyberGalerie
	for _, x := range a.GetVyberyGalerie() {
		if x.Nazev != nazev {
			v = append(v, x)
		}
	}
	return a.ulozitVybery(v)
}

func (a *App) ulozitVybery(v []VyberGalerie) bool {
	if len(v) == 0 {
		return a.ulozitNastaveni(klicVyberuGalerie, "") == nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		return false
	}
	if err := a.ulozitNastaveni(klicVyberuGalerie, string(data)); err != nil {
		a.chyba("uložení výběru Galerie", err)
		return false
	}
	return true
}
