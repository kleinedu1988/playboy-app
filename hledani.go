package main

// Napojení vyhledávání, normalizace textu a typu Modelka z balíčku internal/hledani.

import "playboy-app/internal/hledani"

type Modelka = hledani.Modelka
type srdickaAlba = hledani.SrdickaAlba
type textyHledani = hledani.Texty

func zjednodusit(text string) string              { return hledani.Zjednodusit(text) }
func porovnatBezDiakritiky(a, b string) int       { return hledani.PorovnatBezDiakritiky(a, b) }
func textHodnoceni(h float64) string              { return hledani.TextHodnoceni(h) }
func pripravitTexty(m *Modelka) textyHledani      { return hledani.PripravitTexty(m) }
func pripravitHledani(dotaz string) hledani.Dotaz { return hledani.Pripravit(dotaz) }
func odpovidaTextFuzzy(text, dotaz string) bool   { return hledani.OdpovidaTextFuzzy(text, dotaz) }
func vzdalenostLevenshtein(s1, s2 string) int     { return hledani.VzdalenostLevenshtein(s1, s2) }
