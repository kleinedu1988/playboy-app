package main

// Napojení obsahu fotek (internal/obsah, docs/NAVRH-OBSAH-FOTEK.md) na databázi sbírky, mezipaměť náhledů a okno.
// Model a vektory jsou ve složce obsah/ vedle databáze; funkce se zapíná stažením modelu a vypíná jeho smazáním.

import (
	"context"
	"errors"
	"path/filepath"
	"strings"

	"playboy-app/internal/obsah"
)

type StavObsahu = obsah.Stav

// Kolik nejpodobnějších fotek ukázat (vlastní fotka první)
const pocetPodobnych = 48

// Složka obsahu fotek vedle databáze; prázdná u dočasné databáze v paměti
func (a *App) slozkaObsahu() string {
	if a.cestaDb == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.cestaDb), "obsah")
}

func (a *App) pripravitObsah() {
	a.obsah = obsah.NovaSluzba(a.slozkaObsahu(), nil, obsah.Zdroje{
		Fotky:  a.fotkyProObsah,
		Nahled: a.nahledProObsah,
	})
}

// ID souborů všech fotek sbírky; nejdřív nejlépe hodnocené, aby měly vektor co nejdřív
func (a *App) fotkyProObsah() ([]string, error) {
	radky, err := a.db.Query(`SELECT drive_file_id FROM fotky WHERE nedostupne_od IS NULL
		GROUP BY drive_file_id ORDER BY MAX(hodnoceni) DESC, MIN(id)`)
	if err != nil {
		return nil, err
	}
	defer radky.Close()
	var ids []string
	for radky.Next() {
		var id string
		if err := radky.Scan(&id); err != nil {
			return nil, err
		}
		if jeHoleID(id) {
			ids = append(ids, id)
		}
	}
	return ids, radky.Err()
}

func (a *App) nahledProObsah(ctx context.Context, id string) ([]byte, error) {
	if a.nahledy == nil {
		return nil, errors.New("bez mezipaměti náhledů")
	}
	return a.nahledy.Nacist(ctx, id, "w400")
}

func (a *App) GetStavObsahu() StavObsahu {
	return a.obsah.Stav()
}

// Zapne obsah fotek: stáhne model (když chybí) a dopočítá vektory fotek, které ho nemají; false bez složky dat
func (a *App) ZapnoutObsah() bool {
	return a.obsah.Spustit()
}

// Pozastaví stahování nebo výpočet (spočítané zůstane, příště se pokračuje)
func (a *App) ZastavitObsah() {
	a.obsah.Zastavit()
}

// Vypne obsah fotek a smaže model i vektory
func (a *App) VypnoutObsah() bool {
	if err := a.obsah.Vypnout(); err != nil {
		a.chyba("smazání dat obsahu fotek", err)
		return false
	}
	return true
}

// Fotky ze sbírky, které vypadají podobně (stejné focení, scéna, téměř stejné snímky), od nejpodobnější;
// vlastní fotka první. Prázdné, když fotka ještě nemá vektor (výpočet se pak spustí, pokud neběží).
func (a *App) GetPodobneFotky(fotkaID int) []Fotografie {
	fotky := []Fotografie{}
	var driveID string
	if err := a.db.QueryRow(`SELECT drive_file_id FROM fotky WHERE id = ?`, fotkaID).Scan(&driveID); err != nil {
		return fotky
	}
	shody := a.obsah.Podobne(driveID, pocetPodobnych)
	if len(shody) == 0 {
		if a.obsah.Zapnuto() {
			a.obsah.Spustit()
		}
		return fotky
	}
	poradi := make(map[string]int, len(shody))
	args := make([]interface{}, len(shody))
	for i, s := range shody {
		poradi[s.ID] = i
		args[i] = s.ID
	}
	nactene := a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE f.drive_file_id IN (?`+strings.Repeat(", ?", len(args)-1)+`)
		ORDER BY f.id = ? DESC, f.id`, true, true, append(args, fotkaID)...)
	// Soubor ve víc albech (sdílené album) jen jednou: u vlastní fotky ta, ze které se hledalo, jinak první
	podleSouboru := make([]*Fotografie, len(shody))
	for i := range nactene {
		f := &nactene[i]
		if k, ok := poradi[f.DriveID]; ok && podleSouboru[k] == nil {
			podleSouboru[k] = f
		}
	}
	for _, f := range podleSouboru {
		if f != nil {
			fotky = append(fotky, *f)
		}
	}
	return a.doplnitDalsiModelky(fotky)
}

// Návrhy tagů z obsahu pro fotky (id fotky → tagy, od nejjistějšího). Navrhují se jen tagy skupin, ve kterých
// fotka ještě žádný tag nemá; fotka bez vektoru návrh nemá.
func (a *App) GetNavrhyTagu(ids []int) map[int][]string {
	navrhy := map[int][]string{}
	if len(ids) == 0 || !a.obsah.Zapnuto() {
		return navrhy
	}
	maji := a.GetTagyFotek(ids)
	for _, id := range ids {
		var driveID string
		if a.db.QueryRow(`SELECT drive_file_id FROM fotky WHERE id = ?`, id).Scan(&driveID) != nil {
			continue
		}
		v := a.obsah.Vektor(driveID)
		if v == nil {
			continue
		}
		obsazene := map[string]bool{}
		for _, t := range maji[id] {
			if sk := skupinaTagu[t]; sk != nil {
				obsazene[sk.Klic] = true
			}
		}
		for _, n := range obsah.NavrhnoutTagy(v) {
			if sk := skupinaTagu[n.Tag]; sk != nil && !obsazene[sk.Klic] {
				navrhy[id] = append(navrhy[id], n.Tag)
			}
		}
	}
	return navrhy
}

// Odhad srdíček nehodnocených fotek z obsahu (ID souboru → 1–5); nil, když je hodnocených fotek s vektorem málo
func (a *App) odhadySrdicekFotek() map[string]float64 {
	if !a.obsah.Zapnuto() {
		return nil
	}
	radky, err := a.db.Query(`SELECT drive_file_id, MIN(album_id), MAX(hodnoceni) FROM fotky GROUP BY drive_file_id`)
	if err != nil {
		return nil
	}
	defer radky.Close()
	var fotky []obsah.HodnoceniFotky
	for radky.Next() {
		var f obsah.HodnoceniFotky
		if radky.Scan(&f.ID, &f.Album, &f.Hodnoceni) == nil {
			fotky = append(fotky, f)
		}
	}
	return a.obsah.OdhadyFotek(fotky)
}
