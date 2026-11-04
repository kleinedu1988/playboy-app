package main

import (
	"fmt"
	"sort"
	"time"

	"playboy-app/internal/kontrola"
	"playboy-app/internal/sbirka"
)

// Kontrola sbírky pro Údržbu: údaje, které vypadají jako chyba při zadávání. Každé pravidlo hlásí nález s klíčem
// „ok-…“; když je údaj přesto pravdivý (modelce opravdu bylo 16 let), označí se nález v Údržbě „V pořádku“
// a klíč se uloží mezi „netýká se“ modelky (nebo alba u nálezu alba). Při dalších kontrolách se pak nehlásí.
// Pravidla a učení rozsahů a podobných jmen jsou v balíčku internal/kontrola.

type PodezrelyUdaj = kontrola.PodezrelyUdaj
type pridatNalez = kontrola.PridatNalez

var (
	kliceKontrolyModelky = kontrola.KliceKontrolyModelky
	kliceKontrolyAlba    = kontrola.KliceKontrolyAlba
)

const (
	vekOd, vekDo         = kontrola.VekOd, kontrola.VekDo
	vyskaOd, vyskaDo     = kontrola.VyskaOd, kontrola.VyskaDo
	vahaOd, vahaDo       = kontrola.VahaOd, kontrola.VahaDo
	bmiOd, bmiDo         = kontrola.BmiOd, kontrola.BmiDo
	hrudnikOd, hrudnikDo = kontrola.HrudnikOd, kontrola.HrudnikDo
	pasOd, pasDo         = kontrola.PasOd, kontrola.PasDo
	bokyOd, bokyDo       = kontrola.BokyOd, kontrola.BokyDo
	prvniRokCasopisu     = kontrola.PrvniRokCasopisu
)

func vybratNalezy(vsechny []PodezrelyUdaj, vcetneSkrytych bool) []PodezrelyUdaj {
	return kontrola.VybratNalezy(vsechny, vcetneSkrytych)
}

// Všechny nálezy sbírky i s označenými „V pořádku“ (s příznakem); výpočet bez mezipaměti (ta je v uceni.go)
func (a *App) spocitatNalezy(modelky []Modelka, alba []albumSbirky, prahy prahyKontroly) []PodezrelyUdaj {
	nalezModelky := func(m Modelka, klic, zdroj, pole, popis string) PodezrelyUdaj {
		return PodezrelyUdaj{
			ModelkaID: m.ID, Jmeno: m.Jmeno, Popis: popis, Klic: klic, Pole: pole,
			NetykaSe: obsahujeKlic(m.NetykaSe, klic), Zdroj: zdroj,
		}
	}
	nalezy := []PodezrelyUdaj{}
	pridat := func(m Modelka, klic, zdroj, pole, popis string) {
		nalezy = append(nalezy, nalezModelky(m, klic, zdroj, pole, popis))
	}
	podleID := map[int]Modelka{}
	for _, m := range modelky {
		podleID[m.ID] = m
	}

	// Dvojice fotek hledá dotaz nad všemi fotkami: běží souběžně s kontrolami údajů (jen čte databázi a podleID)
	// a jeho nálezy se přidají na konec jako dřív
	var dvojice []PodezrelyUdaj
	hotovo := make(chan struct{})
	go func() {
		defer close(hotovo)
		a.kontrolovatDvojiceFotek(podleID, func(m Modelka, klic, zdroj, pole, popis string) {
			dvojice = append(dvojice, nalezModelky(m, klic, zdroj, pole, popis))
		})
	}()

	albaBal := albaDoBalicku(alba)
	kontrolovatModelky(modelky, prahy, pridat)
	kontrola.KontrolovatCenterfoldyCisel(modelky, albaBal, pridat)

	// Alba s fotkami: jedna fotka u alba s podobným názvem jako jiné album modelky (překlep), vydání mimo dobu
	// časopisu. Pořadí podle názvu alba.
	var sFotkami []sbirka.AlbumSbirky
	for _, al := range albaBal {
		if al.Fotek > 0 {
			sFotkami = append(sFotkami, al)
		}
	}
	sort.SliceStable(sFotkami, func(i, j int) bool { return sFotkami[i].Nazev < sFotkami[j].Nazev })
	podleModelky := map[int][]sbirka.AlbumSbirky{}
	for _, al := range sFotkami {
		podleModelky[al.ModelkaID] = append(podleModelky[al.ModelkaID], al)
	}
	pridatAlbu := func(al sbirka.AlbumSbirky, klic, zdroj, popis string) {
		m, ok := podleID[al.ModelkaID]
		if !ok {
			return
		}
		nalezy = append(nalezy, PodezrelyUdaj{
			ModelkaID: m.ID, Jmeno: m.Jmeno, Popis: popis, Klic: klic, Album: al.Nazev, Typ: al.Typ,
			NetykaSe: obsahujeKlic(al.Neni, klic), Zdroj: zdroj,
		})
	}
	letos := time.Now().Year()
	for _, al := range sFotkami {
		if al.Fotek == 1 && al.Typ != "Centerfold" && al.Typ != "Cover" {
			if podobne := kontrola.PodobneAlbum(al, podleModelky[al.ModelkaID]); podobne != "" {
				pridatAlbu(al, "ok-album", "album", fmt.Sprintf("album „%s“ má jen jednu fotku a podobá se albu „%s“ – překlep v názvu?", al.Nazev, podobne))
			}
		}
		if rok, _, _, ok := castiVydani(al.Vydani); ok && (rok < prvniRokCasopisu || rok > letos) {
			pridatAlbu(al, "ok-vydani-alba", "vydani-alba", fmt.Sprintf("album „%s“ má vydání %s, mimo roky časopisu (%d–%d)", al.Nazev, al.Vydani, prvniRokCasopisu, letos))
		}
	}
	<-hotovo
	return append(nalezy, dvojice...)
}

// Kontroly samotných údajů modelek (bez alb a fotek): pravidla s rozsahy naučenými ze sbírky,
// neobvyklé kombinace údajů postavy a podobná jména
func kontrolovatModelky(modelky []Modelka, prahy prahyKontroly, pridat pridatNalez) {
	type nalez struct {
		m                        Modelka
		klic, zdroj, pole, popis string
	}
	odlozit := func(seznam *[]nalez) pridatNalez {
		return func(m Modelka, klic, zdroj, pole, popis string) {
			*seznam = append(*seznam, nalez{m, klic, zdroj, pole, popis})
		}
	}
	var podobna, udaje []nalez
	hotovo := make(chan struct{})
	go func() {
		defer close(hotovo)
		kontrolovatPodobnaJmena(modelky, prahy.PrahJmen, odlozit(&podobna))
	}()

	uceni := naucitSe(modelky, prahy)
	kontrola.KontrolovatJmena(modelky, pridat)
	pridatUdaj := odlozit(&udaje)
	for _, m := range modelky {
		kontrola.KontrolovatData(m, uceni.Rozsahy, pridatUdaj)
		kontrola.KontrolovatPostavu(m, uceni.Rozsahy, pridatUdaj)
		kontrola.KontrolovatPlaymateRoku(m, pridatUdaj)
	}
	uceni.KontrolovatNeobvykle(modelky, pridatUdaj)
	<-hotovo
	for _, seznam := range [][]nalez{podobna, udaje} {
		for _, n := range seznam {
			pridat(n.m, n.klic, n.zdroj, n.pole, n.popis)
		}
	}
}

func prvniVydani(m Modelka) string { return kontrola.PrvniVydani(m) }
func predData(a, b string) bool    { return kontrola.PredData(a, b) }
func kontrolovatData(m Modelka, r rozsahyKontroly, pridat pridatNalez) {
	kontrola.KontrolovatData(m, r, pridat)
}
func kontrolovatPostavu(m Modelka, r rozsahyKontroly, pridat pridatNalez) {
	kontrola.KontrolovatPostavu(m, r, pridat)
}
func kontrolovatPlaymateRoku(m Modelka, pridat pridatNalez) {
	kontrola.KontrolovatPlaymateRoku(m, pridat)
}

// Stejná fotka (soubor na Disku) ve dvou albech jedné modelky mimo cover a centerfold bývá přidaná omylem dvakrát
func (a *App) kontrolovatDvojiceFotek(podleID map[int]Modelka, pridat pridatNalez) {
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
			pridat(m, "ok-dvojice", "dvojice", "", fmt.Sprintf("%d %s ve dvou albech zároveň (např. %s)", pocty[id], sklonovatSlovo(pocty[id], "fotka je", "fotky jsou", "fotek je"), priklad[id]))
		}
	}
}

func sklonovatSlovo(n int, jedna, dve, pet string) string {
	return kontrola.SklonovatSlovo(n, jedna, dve, pet)
}
