package main

// Napojení obsahu fotek (internal/obsah, docs/NAVRH-OBSAH-FOTEK.md) na databázi sbírky, mezipaměť náhledů a okno.
// Model a vektory jsou ve složce obsah/ vedle databáze; funkce se zapíná stažením modelu a vypíná jeho smazáním.

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"path/filepath"
	"strings"
	"sync"

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

// Návrhy tagů z obsahu jedné fotky; Zpracovano = fotka už má vektor (CLIP) i partie (detektor)
type NavrhyTaguFotky struct {
	Zpracovano bool     `json:"zpracovano"`
	Tagy       []string `json:"tagy"`
}

// Návrhy tagů z obsahu pro fotky (id fotky → návrhy, od nejjistějšího). Bez staženého modelu prázdná mapa.
func (a *App) GetNavrhyTagu(ids []int) map[int]NavrhyTaguFotky {
	navrhy := map[int]NavrhyTaguFotky{}
	if len(ids) == 0 || !a.obsah.Zapnuto() {
		return navrhy
	}
	maji := a.GetTagyFotek(ids)
	for _, id := range ids {
		var driveID string
		if a.db.QueryRow(`SELECT drive_file_id FROM fotky WHERE id = ?`, id).Scan(&driveID) != nil {
			continue
		}
		v, partie := a.obsah.Vektor(driveID), a.obsah.Partie(driveID)
		n := NavrhyTaguFotky{Zpracovano: v != nil && partie != nil, Tagy: []string{}}
		// Výlučná skupina s tagem (záběr, prostředí…) se nenavrhuje; u ostatních jen tagy, které fotka ještě nemá
		ma, obsazene := map[string]bool{}, map[string]bool{}
		for _, t := range maji[id] {
			ma[t] = true
			if sk := skupinaTagu[t]; sk != nil && sk.Vylucna {
				obsazene[sk.Klic] = true
			}
		}
		for _, x := range obsah.NavrhnoutTagy(v, partie) {
			if sk := skupinaTagu[x.Tag]; sk != nil && !obsazene[sk.Klic] && !ma[x.Tag] {
				n.Tagy = append(n.Tagy, x.Tag)
			}
		}
		navrhy[id] = n
	}
	return navrhy
}

// Odhady srdíček z obsahu fotek (internal/obsah/odhad.go); nil, když je hodnocených fotek s obsahem málo
func (a *App) odhadySrdicekFotek() *obsah.Odhady {
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

// Nejméně fotek s obsahem, od kolika má modelka údaj „obsah fotek“
const minFotekObsahu = 3

// Obsah fotek modelek pro model vkusu: průměr čistého odhadu srdíček z obsahu jejích fotek (modelka → 1–5)
func (a *App) obsahFotekModelek() map[int]float64 {
	o := a.odhadySrdicekFotek()
	if o == nil {
		return nil
	}
	radky, err := a.db.Query(`SELECT DISTINCT al.modelka_id, f.drive_file_id FROM fotky f JOIN alba al ON al.id = f.album_id
		WHERE al.modelka_id IS NOT NULL`)
	if err != nil {
		return nil
	}
	defer radky.Close()
	type soucet struct{ s, n float64 }
	podle := map[int]*soucet{}
	for radky.Next() {
		var m int
		var id string
		if radky.Scan(&m, &id) != nil {
			continue
		}
		x, ok := o.Obsah[id]
		if !ok {
			continue
		}
		s := podle[m]
		if s == nil {
			s = &soucet{}
			podle[m] = s
		}
		s.s += x
		s.n++
	}
	v := map[int]float64{}
	for m, s := range podle {
		if s.n >= minFotekObsahu {
			v[m] = math.Min(5, math.Max(1, s.s/s.n))
		}
	}
	return v
}

// Obsah fotek modelek se přepočítá jen po spočítání dalšího obsahu nebo po aspoň tolika nových hodnoceních fotek:
// naučení odhadu trvá ~0,5 s a oblíbenost se přepočítává po každém hodnocení
const prepocetObsahuPoHodnocenich = 25

var obsahModelekPamet struct {
	sync.Mutex
	klic  [3]int
	otisk uint64
	obsah map[int]float64
}

// Obsah fotek modelek (obsahFotekModelek) z paměti a jeho otisk (0 = žádný)
func (a *App) obsahFotekVPameti() (map[int]float64, uint64) {
	if a.obsah == nil || !a.obsah.Zapnuto() {
		return nil, 0
	}
	st := a.obsah.Stav()
	var hodnocenych int
	a.db.QueryRow(`SELECT COUNT(*) FROM fotky WHERE hodnoceni > 0`).Scan(&hodnocenych)
	klic := [3]int{st.Vektoru, a.obsah.PocetPartii(), hodnocenych / prepocetObsahuPoHodnocenich}
	p := &obsahModelekPamet
	p.Lock()
	defer p.Unlock()
	if p.klic == klic && p.obsah != nil {
		return p.obsah, p.otisk
	}
	p.klic, p.obsah = klic, a.obsahFotekModelek()
	h := fnv.New64a()
	for _, x := range klic {
		fmt.Fprint(h, x, ",")
	}
	p.otisk = 0
	if len(p.obsah) > 0 {
		p.otisk = h.Sum64()
	}
	if p.obsah == nil {
		p.obsah = map[int]float64{}
	}
	return p.obsah, p.otisk
}
