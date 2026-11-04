package main

// Podmínky témat na údaje modelky přidané v 1.2.2: národnost (země z tabulky zemí, zápis „Česká“ i „Česko“ dá
// stejnou zemi), barva očí, piercing a kategorie (Playmate měsíce, Playmate roku, Cyber Girl, obálka). Kódy zemí
// jsou zjednodušené názvy z tabulky („cesko“, „velka_britanie“) a nesmí se měnit (jsou v uložených klíčích).

import "strings"

// Kód země pro témata z indexu v tabulce zemí
func kodZeme(i int) string { return strings.ReplaceAll(klicTextu(tabulkaZemi[i].Narodnost), " ", "_") }

var kodyZemi = func() map[string]int {
	m := map[string]int{}
	for i := range tabulkaZemi {
		m[kodZeme(i)] = i
	}
	return m
}()

// Země modelky (kód), "" = neznámá nebo mimo tabulku
func zemeModelky(m *Modelka) string {
	if i, ok := narodnostNaZemi[klicTextu(m.Narodnost)]; ok && strings.TrimSpace(m.Narodnost) != "" {
		return kodZeme(i)
	}
	return ""
}

var kategorieTematu = map[string]func(m *Modelka) bool{
	"pmm":    func(m *Modelka) bool { return len(m.Centerfoldy) > 0 || m.PlaymateMesice },
	"pmr":    func(m *Modelka) bool { return m.PlaymateRoku != "" },
	"cg":     func(m *Modelka) bool { return m.CyberGirl != "" },
	"obalka": func(m *Modelka) bool { return len(m.Obalky) > 0 },
}

// Klíče podmínek na modelku, které jdou do tématu (hodnoty kontroluje platnaHodnotaModelky)
var klicePodminekModelky = map[string]bool{"prsaTyp": true, "ochlupeni": true, "vlasy": true, "tetovani": true,
	"narodnost": true, "oci": true, "piercing": true, "kategorie": true}

func platnaHodnotaModelky(klic, h string) bool {
	switch klic {
	case "narodnost":
		_, ok := kodyZemi[h]
		return ok
	case "kategorie":
		return kategorieTematu[h] != nil
	case "piercing", "tetovani":
		return h == "ano" || h == "ne"
	}
	return h != ""
}

// Splňuje modelka jednu hodnotu podmínky
func modelkaMaHodnotu(m *Modelka, klic, h string) bool {
	switch klic {
	case "prsaTyp":
		return m.PrsaTyp == h
	case "ochlupeni":
		return m.Ochlupeni == h
	case "vlasy":
		return h != "" && strings.Contains(strings.ToLower(m.VlasyBarva), strings.ToLower(h))
	case "oci":
		return h != "" && strings.Contains(strings.ToLower(m.OciBarva), strings.ToLower(h))
	case "tetovani":
		return (h == "ano" && m.Tetovani == 1) || (h == "ne" && m.Tetovani == 0)
	case "piercing":
		return (h == "ano" && m.Piercing == 1) || (h == "ne" && m.Piercing == 0)
	case "narodnost":
		return zemeModelky(m) == h
	case "kategorie":
		if f := kategorieTematu[h]; f != nil {
			return f(m)
		}
	}
	return false
}
