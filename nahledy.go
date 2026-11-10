package main

// Napojení místní mezipaměti náhledů (internal/nahledy) na databázi sbírky a okno aplikace.

import (
	"database/sql"
	"strings"

	"pinup-katalog/internal/nahledy"
)

type StavStahovaniNahledu = nahledy.StavStahovani

// Adresa náhledu na Disku podle šablony obrázků (stejná jako dřív v okně)
func adresaNahleduNaDisku(id, velikost string) string {
	return strings.ReplaceAll(adresaObrazkuNaDisku(id), "{velikost}", velikost)
}

// Úklid náhledů po startu: platná jsou ID fotek a titulních fotek sbírky; když se seznam nepodaří přečíst celý,
// maže se jen nad limitem (nic platného se nesmaže kvůli chybě čtení)
func (a *App) uklidNahledu() {
	if a.nahledy == nil || a.db == nil {
		return
	}
	platne := map[string]bool{}
	radky, err := a.db.Query(`SELECT drive_file_id FROM fotky UNION SELECT drive_cover_id FROM modelky WHERE COALESCE(drive_cover_id, '') <> ''`)
	if err == nil {
		for radky.Next() {
			var id sql.NullString
			if radky.Scan(&id) == nil && id.Valid {
				platne[id.String] = true
			}
		}
		err = radky.Err()
		radky.Close()
	}
	var filtr func(string) bool
	if err == nil && len(platne) > 0 {
		filtr = func(id string) bool { return platne[id] }
	}
	a.nahledy.Uklid(filtr, nahledy.LimitDisku)
}

// Náhledy k předstažení v pořadí priority: titulní fotky (karta w400), plakáty centerfoldů a obálky (w600),
// nakonec fotky záhlaví profilů v plném rozlišení
func (a *App) polozkyKPredstazeni() []nahledy.Polozka {
	var v []nahledy.Polozka
	videno := make(map[nahledy.Polozka]bool, 512)
	pridat := func(dotaz, velikost string) {
		radky, err := a.db.Query(dotaz)
		if err != nil {
			return
		}
		defer radky.Close()
		for radky.Next() {
			var id string
			if radky.Scan(&id) == nil && jeHoleID(id) {
				p := nahledy.Polozka{ID: id, Velikost: velikost}
				if !videno[p] {
					videno[p] = true
					v = append(v, p)
				}
			}
		}
	}
	pridat(`SELECT drive_cover_id FROM modelky WHERE COALESCE(drive_cover_id, '') <> '' ORDER BY jmeno`, "w400")
	pridat(`SELECT f.drive_file_id FROM fotky f JOIN alba a ON a.id = f.album_id
		WHERE a.typ IN ('Centerfold', 'Cover') ORDER BY a.vydani DESC, f.poradi IS NULL, f.poradi, f.id`, "w600")
	// Nakonec fotky záhlaví profilů v plném rozlišení (jedna na modelku s fotkou záhlaví)
	pridat(`SELECT f.drive_file_id FROM modelky m JOIN fotky f ON f.id = m.profil_fotka_id ORDER BY m.jmeno`, nahledy.VelikostZahlavi)
	return v
}

// Spustí stahování na pozadí (už běžící nechá běžet); false bez mezipaměti náhledů
func (a *App) SpustitStahovaniNahledu() bool {
	return a.nahledy.SpustitPozadi(a.polozkyKPredstazeni)
}

func (a *App) ZastavitStahovaniNahledu() {
	a.nahledy.ZastavitPozadi()
}

func (a *App) GetStavStahovaniNahledu() StavStahovaniNahledu {
	return a.nahledy.StavPozadi()
}
