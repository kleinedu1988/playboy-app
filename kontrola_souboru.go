package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"playboy-app/internal/nahledy"
	"playboy-app/internal/sbirka"
	"strings"
	"sync"
	"time"
)

type NedostupnySoubor = sbirka.NedostupnySoubor
type KontrolaSouboru = sbirka.KontrolaSouboru

// Stav souboru na Google Disku
const (
	souborNeoveren   = -1 // kontrola se nepovedla (např. výpadek připojení)
	souborNedostupny = 0
	souborDostupny   = 1
)

var klientDisku = &http.Client{Timeout: 20 * time.Second}

// Malý náhled stačí; smazaný nebo nesdílený soubor vrací místo obrázku stránku
func overitSouborNaDisku(driveID string) int {
	resp, err := klientDisku.Get(strings.ReplaceAll(adresaObrazkuNaDisku(driveID), "{velikost}", "w64"))
	if err != nil {
		return souborNeoveren
	}
	resp.Body.Close()
	if resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests {
		return souborNeoveren
	}
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		return souborNedostupny
	}
	return souborDostupny
}

// Ověřování je vyměnitelné, aby testy nepotřebovaly síť
var overitSoubor = overitSouborNaDisku

// Souběžné ověření více souborů; výsledky jsou ve stejném pořadí jako vstup
func overitSoubory(driveIDs []string) []int {
	stavy := make([]int, len(driveIDs))
	var cekani sync.WaitGroup
	soubezne := make(chan struct{}, 8)
	for i, id := range driveIDs {
		cekani.Add(1)
		soubezne <- struct{}{}
		go func(i int, id string) {
			defer cekani.Done()
			defer func() { <-soubezne }()
			stavy[i] = overitSoubor(id)
		}(i, id)
	}
	cekani.Wait()
	return stavy
}

// Ověření odkazu před uložením: 1 = dostupný obrázek, 0 = nedostupný, -1 = nepodařilo se ověřit
func (a *App) OveritOdkaz(rawLink string) int {
	ids := parseDriveIDs(rawLink)
	if len(ids) == 0 {
		return souborNedostupny
	}
	return overitSoubor(ids[0])
}

// Vymazání mezipaměti obrázků, kterou si prohlížeč aplikace ukládá na disk; vrací uvolněné bajty
func (a *App) VymazatMezipamet() int64 {
	zaklad, err := os.UserCacheDir()
	if err != nil {
		return 0
	}
	slozka := filepath.Join(zaklad, filepath.Base(os.Args[0]), "WebKitCache")
	velikost := nahledy.VelikostSlozky(slozka)
	if err := os.RemoveAll(slozka); err != nil {
		a.chyba("vymazání mezipaměti obrázků", err)
		return 0
	}
	// I náhledy uložené na disku (nahledy.go)
	nahledu, err := a.nahledy.Vymazat()
	if err != nil {
		a.chyba("vymazání náhledů", err)
	}
	return velikost + nahledu
}

// Kolik fotek ověří denní kontrola; za dávku se prostřídají všechny a Google nedostane tisíce požadavků najednou
const velikostDenniDavky = 300

// Ruční kontrola všech souborů včetně titulních fotek
func (a *App) ZkontrolovatSoubory() KontrolaSouboru {
	return a.zkontrolovat(`
		SELECT f.id, f.modelka_id, COALESCE(m.jmeno, ''), f.album, f.typ, f.drive_file_id, COALESCE(f.nedostupne_od, '')
		FROM fotografie f LEFT JOIN modelky m ON m.id = f.modelka_id
		UNION ALL
		SELECT 0, id, jmeno, '', 'Titulní fotka', drive_cover_id, '' FROM modelky WHERE COALESCE(drive_cover_id, '') <> ''`, false)
}

// Denní kontrola: nejdéle neověřené fotky, nejdřív ty, které už nedostupné byly
func (a *App) ZkontrolovatDavku() KontrolaSouboru {
	return a.zkontrolovat(fmt.Sprintf(`
		SELECT f.id, f.modelka_id, COALESCE(m.jmeno, ''), f.album, f.typ, f.drive_file_id, COALESCE(f.nedostupne_od, '')
		FROM fotografie f LEFT JOIN modelky m ON m.id = f.modelka_id
		ORDER BY COALESCE(f.overeno, ''), f.id LIMIT %d`, velikostDenniDavky), true)
}

// Ověření souborů a zápis výsledku k fotkám: dostupná dostane datum ověření, nedostupná si pamatuje, od kdy
// nedostupná je. Titulní fotky se jen hlásí, nikam se nezapisují.
func (a *App) zkontrolovat(dotaz string, davka bool) KontrolaSouboru {
	type polozka struct {
		soubor       NedostupnySoubor
		driveID      string
		nedostupneOd string
	}
	var polozky []polozka

	rows, err := a.db.Query(dotaz)
	if err != nil {
		a.chyba("kontrola souborů", err)
		return KontrolaSouboru{Nedostupne: []NedostupnySoubor{}}
	}
	for rows.Next() {
		var p polozka
		if err := rows.Scan(&p.soubor.FotoID, &p.soubor.ModelkaID, &p.soubor.Jmeno, &p.soubor.Album, &p.soubor.Typ, &p.driveID, &p.nedostupneOd); err == nil {
			polozky = append(polozky, p)
		}
	}
	rows.Close()

	vysledek := KontrolaSouboru{Zkontrolovano: len(polozky), Nedostupne: []NedostupnySoubor{}, Davka: davka}
	driveIDs := make([]string, len(polozky))
	for i, p := range polozky {
		driveIDs[i] = p.driveID
	}
	den := dnes()
	stavy := overitSoubory(driveIDs)
	for i, stav := range stavy {
		p := polozky[i]
		switch stav {
		case souborNeoveren:
			vysledek.Neovereno++
		case souborNedostupny:
			p.soubor.Opakovane = p.nedostupneOd != "" && p.nedostupneOd < den
			vysledek.Nedostupne = append(vysledek.Nedostupne, p.soubor)
		}
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("kontrola souborů", err)
		return vysledek
	}
	defer tx.Rollback()
	for i, stav := range stavy {
		p := polozky[i]
		if p.soubor.FotoID == 0 {
			continue
		}
		var err error
		switch stav {
		case souborDostupny:
			_, err = tx.Exec("UPDATE fotky SET overeno = ?, nedostupne_od = NULL WHERE id = ?", den, p.soubor.FotoID)
		case souborNedostupny:
			_, err = tx.Exec("UPDATE fotky SET overeno = ?, nedostupne_od = COALESCE(nedostupne_od, ?) WHERE id = ?", den, den, p.soubor.FotoID)
		}
		if err != nil {
			a.chyba("kontrola souborů", err)
			return vysledek
		}
	}
	if err := tx.Commit(); err != nil {
		a.chyba("kontrola souborů", err)
	}
	return vysledek
}
