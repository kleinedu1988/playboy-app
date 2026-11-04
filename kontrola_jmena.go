package main

import "playboy-app/internal/kontrola"

// Kontrola podobných jmen a prohozených slov pomocí trigramového slovníku v balíčku internal/kontrola.

type (
	jmenoKPorovnani = kontrola.JmenoKPorovnani
	slovnikSlov     = kontrola.SlovnikSlov
)

func kontrolovatPodobnaJmena(modelky []Modelka, prah float64, pridat pridatNalez) {
	kontrola.KontrolovatPodobnaJmena(modelky, prah, pridat)
}
