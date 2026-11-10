package main

// Napojení obsahu fotek (internal/obsah, docs/NAVRH-OBSAH-FOTEK.md) na databázi sbírky, mezipaměť náhledů a okno.
// Model a vektory jsou ve složce obsah/ vedle databáze; funkce se zapíná stažením modelu a vypíná jeho smazáním.

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

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
	// Kontrola otočení stojí na vektorech: zastaví se a její výsledky se smažou s nimi
	a.PrerusitKontroluOtoceni()
	if f := a.souborOtoceni(); f != "" {
		os.Remove(f)
		a.otoceni = nil
	}
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
	Naucene    int      `json:"naucene"` // kolik z návrhů rozhodly tagy naučené z Průvodce
	Odhad      float64  `json:"odhad"`   // odhad srdíček z obsahu (0 = fotka má srdíčka nebo odhad nemá)
}

// Návrhy tagů z obsahu pro fotky (id fotky → návrhy, od nejjistějšího). Bez staženého modelu prázdná mapa.
func (a *App) GetNavrhyTagu(ids []int) map[int]NavrhyTaguFotky {
	navrhy := map[int]NavrhyTaguFotky{}
	if len(ids) == 0 || !a.obsah.Zapnuto() {
		return navrhy
	}
	maji := a.GetTagyFotek(ids)
	uceni := a.uceniTagu()
	odhady := a.odhadySrdicekFotek()
	otazniky := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		otazniky[i] = "?"
		args[i] = id
	}
	drivePodleID := make(map[int]string, len(ids))
	if radky, err := a.db.Query(`SELECT id, drive_file_id FROM fotky WHERE id IN (`+strings.Join(otazniky, ",")+`)`, args...); err == nil {
		for radky.Next() {
			var id int
			var driveID string
			if radky.Scan(&id, &driveID) == nil {
				drivePodleID[id] = driveID
			}
		}
		radky.Close()
	}
	for _, id := range ids {
		driveID, ok := drivePodleID[id]
		if !ok {
			continue
		}
		v, partie := a.obsah.Vektor(driveID), a.obsah.Partie(driveID)
		n := NavrhyTaguFotky{Zpracovano: v != nil && partie != nil, Tagy: []string{}}
		if odhady != nil {
			n.Odhad = math.Round(odhady.Nehodnocene[driveID]*10) / 10
		}
		// Výlučná skupina s tagem (záběr, prostředí…) se nenavrhuje; u ostatních jen tagy, které fotka ještě nemá
		ma, obsazene := map[string]bool{}, map[string]bool{}
		for _, t := range maji[id] {
			ma[t] = true
			if sk := skupinaTagu[t]; sk != nil && sk.Vylucna {
				obsazene[sk.Klic] = true
			}
		}
		for _, x := range uceni.Upravit(driveID, obsah.NavrhnoutTagy(v, partie)) {
			if sk := skupinaTagu[x.Tag]; sk != nil && !obsazene[sk.Klic] && !ma[x.Tag] {
				n.Tagy = append(n.Tagy, x.Tag)
				if x.Naucene {
					n.Naucene++
				}
			}
		}
		navrhy[id] = n
	}
	return navrhy
}

var odhadyPamet struct {
	sync.Mutex
	klic   [4]int64
	odhady *obsah.Odhady
}

// Odhady srdíček z obsahu fotek (internal/obsah/odhad.go); nil, když je hodnocených fotek s obsahem málo.
// V paměti, dokud se nezmění hodnocení fotek ani spočítaný obsah (Průvodce se ptá u každé fotky).
// Během běžícího výpočtu na pozadí se počet vektorů a partií v klíči zaokrouhluje po 250 fotkách,
// aby se hřebenová regrese (Cholesky 531×531) nepřeučovala každé 2 sekundy.
func (a *App) odhadySrdicekFotek() *obsah.Odhady {
	if !a.obsah.Zapnuto() {
		return nil
	}
	var pocet, soucet int64
	a.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(hodnoceni * (id % 9973 + 1)), 0) FROM fotky WHERE hodnoceni > 0`).Scan(&pocet, &soucet)
	st := a.obsah.Stav()
	vektoru, partii := int64(st.Vektoru), int64(a.obsah.PocetPartii())
	if st.Faze == obsah.FazePocita {
		vektoru, partii = -1-(vektoru/250), -1-(partii/250)
	}
	klic := [4]int64{pocet, soucet, vektoru, partii}
	p := &odhadyPamet
	p.Lock()
	defer p.Unlock()
	if p.klic == klic && p.odhady != nil {
		return p.odhady
	}
	p.odhady, p.klic = a.spocitatOdhadySrdicek(), klic
	return p.odhady
}

func (a *App) spocitatOdhadySrdicek() *obsah.Odhady {
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
	vektoru, partii := st.Vektoru, a.obsah.PocetPartii()
	if st.Faze == obsah.FazePocita {
		vektoru, partii = -1-(vektoru/250), -1-(partii/250)
	}
	klic := [3]int{vektoru, partii, hodnocenych / prepocetObsahuPoHodnocenich}
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

// Učení tagů z Průvodce (internal/obsah/uceni_tagu.go): přeučí se na pozadí po každých tolika nově prošlých fotkách,
// mezitím platí minulé naučení (učení trvá až několik sekund)
const preuceniTaguPo = 10

var uceniTaguPamet struct {
	sync.Mutex
	klic  [3]int
	bezi  bool
	uceni *obsah.UceniTagu
}

// Tagy katalogu pro učení
func tagyProUceni() []obsah.TagUceni {
	var v []obsah.TagUceni
	for _, sk := range katalogTagu {
		for _, t := range sk.Tagy {
			v = append(v, obsah.TagUceni{Klic: t.Klic, Skupina: sk.Klic, Vylucna: sk.Vylucna})
		}
	}
	return v
}

// Příklady z Průvodce: fotky, které prošly průvodcem aktuální verze, s tagy a zodpovězenými skupinami (skupiny
// kroků, které se u fotky nepřeskočily). Soubor ve víc albech jen jednou. Pořadí podle alb (souvislé bloky pro
// ověření).
func (a *App) prikladyTaguZPruvodce() []obsah.PrikladTagu {
	radky, err := a.db.Query(`SELECT f.id, f.drive_file_id FROM fotky f JOIN fotky_pruvodce p ON p.fotka_id = f.id
		WHERE p.verze >= ? ORDER BY f.album_id, f.id`, verzePruvodce)
	if err != nil {
		return nil
	}
	type fotka struct {
		id    int
		drive string
	}
	var fotky []fotka
	var ids []int
	for radky.Next() {
		var f fotka
		if radky.Scan(&f.id, &f.drive) == nil {
			fotky = append(fotky, f)
			ids = append(ids, f.id)
		}
	}
	radky.Close()
	tagy := a.GetTagyFotek(ids)
	videne := map[string]bool{}
	var v []obsah.PrikladTagu
	for _, f := range fotky {
		if videne[f.drive] {
			continue
		}
		videne[f.drive] = true
		ma := map[string]bool{}
		for _, t := range tagy[f.id] {
			ma[t] = true
		}
		pr := obsah.PrikladTagu{ID: f.drive, Tagy: tagy[f.id]}
		for _, k := range krokyPruvodce {
			if k.Preskocit != nil && splnena(*k.Preskocit, ma) {
				continue
			}
			pr.Skupiny = append(pr.Skupiny, k.Skupiny...)
		}
		v = append(v, pr)
	}
	return v
}

// Podmínka kroku průvodce nad tagy fotky (stejně jako plati v frontend/src/lib/pruvodce.js)
func splnena(p PodminkaKroku, ma map[string]bool) bool {
	je := false
	for _, t := range p.Tagy {
		if ma[t] {
			je = true
		}
	}
	return je != p.Ne
}

// Naučené tagy (z paměti); když přibylo dost fotek z Průvodce nebo obsahu, přeučí se na pozadí
func (a *App) uceniTagu() *obsah.UceniTagu {
	return a.uceniTaguZ(false)
}

// Naučí tagy hned (úvodní obrazovka): počká i na rozběhnuté učení na pozadí
func (a *App) uceniTaguHned() *obsah.UceniTagu {
	return a.uceniTaguZ(true)
}

func (a *App) uceniTaguZ(hned bool) *obsah.UceniTagu {
	if a.obsah == nil || !a.obsah.Zapnuto() {
		return nil
	}
	var prosle int
	a.db.QueryRow(`SELECT COUNT(*) FROM fotky_pruvodce WHERE verze >= ?`, verzePruvodce).Scan(&prosle)
	klic := [3]int{prosle / preuceniTaguPo, a.obsah.Stav().Vektoru / 1000, a.obsah.PocetPartii() / 1000}
	p := &uceniTaguPamet
	p.Lock()
	defer p.Unlock()
	for hned && p.bezi {
		p.Unlock()
		time.Sleep(50 * time.Millisecond)
		p.Lock()
	}
	if (p.klic != klic || p.uceni == nil) && !p.bezi {
		naucit := func() *obsah.UceniTagu {
			return a.obsah.NaucitTagy(a.prikladyTaguZPruvodce(), tagyProUceni(), nil)
		}
		// Testy (bez okna) a úvodní obrazovka učí hned, jinak na pozadí
		if !a.startNaPozadi || hned {
			p.uceni, p.klic = naucit(), klic
			return p.uceni
		}
		p.bezi = true
		go func() {
			u := naucit()
			p.Lock()
			p.uceni, p.klic, p.bezi = u, klic, false
			p.Unlock()
		}()
	}
	return p.uceni
}

// Výchozí návrhy tagů fotky (CLIP a detektor), bez učení
func (a *App) vychoziNavrhyTagu(driveID string) []obsah.NavrhTagu {
	return obsah.NavrhnoutTagy(a.obsah.Vektor(driveID), a.obsah.Partie(driveID))
}

// Stav učení tagů z Průvodce (pro okno)
type StavUceniTagu struct {
	Fotek   int                   `json:"fotek"`   // fotek z Průvodce s obsahem
	Pouzito int                   `json:"pouzito"` // tagů, které už navrhuje podle tebe
	Tagy    []obsah.HodnoceniTagu `json:"tagy"`
}

func (a *App) GetStavUceniTagu() StavUceniTagu {
	v := StavUceniTagu{Tagy: []obsah.HodnoceniTagu{}}
	if u := a.uceniTagu(); u != nil {
		v.Fotek, v.Pouzito, v.Tagy = u.Fotek, u.Pouzito(), u.Tagy
	}
	return v
}

// Obsah fotek pro náhledy v soubojích (oblibenost_fotky.go): čistý odhad srdíček z obsahu a podobnost záběrů;
// nil bez obrazových modelů. Otisk se mění s hodnocením fotek a spočítaným obsahem.
func (a *App) obsahNahleduVPameti() (*obsahNahledu, uint64) {
	if a.obsah == nil || !a.obsah.Zapnuto() {
		return nil, 0
	}
	o := a.odhadySrdicekFotek()
	odhadyPamet.Lock()
	klic := odhadyPamet.klic
	odhadyPamet.Unlock()
	h := fnv.New64a()
	fmt.Fprint(h, klic)
	n := &obsahNahledu{odhad: map[string]float64{}, podobnost: a.obsah.Podobnost}
	if o != nil {
		n.odhad = o.Obsah
	}
	return n, h.Sum64()
}
