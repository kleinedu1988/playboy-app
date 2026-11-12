package main

import (
	"fmt"
	"hash/fnv"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"pinup-katalog/internal/obsah"
)

// Druh fotky (0.02.060, Explicitní fotky zvlášť): návrhy z odhadu nad vektory CLIP (internal/obsah/druh.go) –
// fotky, na kterých je nejspíš muž, a fotky s víc ženami. Jen ke kontrole v Údržbě; fotky se přeřadí až po
// potvrzení.
//
// Potvrzený druh (0.02.061, úprava schématu č. 19, export verze 16): podle souboru na Disku, platí ve všech albech.
// Druhy: pozovaci, lesbicka, sex, muz (na fotce je muž, ale nejde o sex – scéna, zákulisí).

var druhyFotek = map[string]bool{"pozovaci": true, "lesbicka": true, "sex": true, "muz": true}

// Počet změn druhu za běhu (otisk Galerie: změna v téže sekundě se v čase potvrzení neprojeví)
var zmenyDruhu atomic.Int64

func (a *App) migraceDruhFotek() error {
	_, err := a.db.Exec(`CREATE TABLE IF NOT EXISTS druhy_fotek (
		drive_file_id TEXT PRIMARY KEY,
		druh TEXT NOT NULL,
		potvrzeno TEXT NOT NULL DEFAULT ''
	) WITHOUT ROWID`)
	return err
}

// SetDruhFotek potvrdí druh souborů (prázdný druh potvrzení smaže); vrací počet změněných souborů ze sbírky
func (a *App) SetDruhFotek(ids []string, druh string) int {
	if a.db == nil || (druh != "" && !druhyFotek[druh]) || len(ids) == 0 {
		return 0
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("druh fotek", err)
		return 0
	}
	defer tx.Rollback()
	cas := time.Now().Format("2006-01-02 15:04:05")
	n := 0
	for _, id := range ids {
		var pocet int
		if id == "" || tx.QueryRow(`SELECT COUNT(*) FROM fotky WHERE drive_file_id = ?`, id).Scan(&pocet) != nil || pocet == 0 {
			continue
		}
		if druh == "" {
			_, err = tx.Exec(`DELETE FROM druhy_fotek WHERE drive_file_id = ?`, id)
		} else {
			_, err = tx.Exec(`INSERT OR REPLACE INTO druhy_fotek (drive_file_id, druh, potvrzeno) VALUES (?, ?, ?)`, id, druh, cas)
		}
		if err != nil {
			a.chyba("druh fotek", err)
			return 0
		}
		n++
	}
	if tx.Commit() != nil {
		return 0
	}
	zmenyDruhu.Add(1)
	return n
}

// GetDruhFotky: potvrzený druh souboru ("" = nepotvrzený)
func (a *App) GetDruhFotky(driveID string) string {
	var druh string
	if a.db != nil {
		a.db.QueryRow(`SELECT druh FROM druhy_fotek WHERE drive_file_id = ?`, driveID).Scan(&druh)
	}
	return druh
}

// Všechny potvrzené druhy (export, návrhy)
func vsechnyDruhyFotek(q dotazovac) map[string]string {
	v := map[string]string{}
	radky, err := q.Query(`SELECT drive_file_id, druh FROM druhy_fotek`)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id, druh string
		if radky.Scan(&id, &druh) == nil {
			v[id] = druh
		}
	}
	return v
}

// Druh z importu: neznámý se přeskočí (normalizace velikosti písmen)
func platnyDruh(druh string) string {
	druh = strings.ToLower(strings.TrimSpace(druh))
	if druhyFotek[druh] {
		return druh
	}
	return ""
}

// Učení z potvrzení (0.02.063): potvrzené fotky doladí vestavěný odhad (obsah.UcitDruh). Muž na fotce: sex
// a „jen s mužem“ ano, pózovací a lesbická ne. Víc žen: lesbická ano, pózovací ne (u sexu a „s mužem“ neznámo).
// Kotva: vzorek nepotvrzených fotek sbírky a nejsilnější nepotvrzené návrhy s cílem = vestavěný odhad (ne 0) –
// odhad se změní jen tam, kam ukazují potvrzení; samé „ne“ ho jinak srazí celý. Naučené váhy se drží v paměti,
// dokud se potvrzení nezmění.
const (
	vzorekSbirkyDruhu   = 300
	kotvaNavrhuDruhu    = 200 // nejsilnějších nepotvrzených návrhů každé skupiny v kotvě
	vahaVzorkuDruhu     = 0.3
	maxPotvrzenychDruhu = 3000
)

var uceniDruhu struct {
	sync.Mutex
	klic  string
	vahy  *[2]obsah.VahyDruhu
	pocet int // potvrzených fotek, ze kterých se učilo
}

// vahyDruhu: váhy odhadu doladěné z potvrzení (nil = vestavěné, když nic potvrzeného není) a počet příkladů
func (a *App) vahyDruhu() (*[2]obsah.VahyDruhu, int) {
	if a.db == nil || a.obsah == nil || obsah.VychoziVahyDruhu() == nil {
		return nil, 0
	}
	var n int
	var posledni string
	a.db.QueryRow(`SELECT COUNT(*), COALESCE(MAX(potvrzeno), '') FROM druhy_fotek`).Scan(&n, &posledni)
	klic := fmt.Sprint(n, posledni, zmenyDruhu.Load(), a.obsah.PocetPartii())
	u := &uceniDruhu
	u.Lock()
	defer u.Unlock()
	if u.klic == klic {
		return u.vahy, u.pocet
	}
	u.klic, u.vahy, u.pocet = klic, nil, 0
	if n == 0 {
		return nil, 0
	}
	// Potvrzené (nejnovější, nejvýš maxPotvrzenychDruhu) a deterministický vzorek nepotvrzených
	radky, err := a.db.Query(`SELECT drive_file_id, druh FROM druhy_fotek ORDER BY potvrzeno DESC LIMIT ?`, maxPotvrzenychDruhu)
	if err != nil {
		return nil, 0
	}
	var muz, zeny []obsah.PrikladDruhu
	potvrzene := map[string]bool{}
	for radky.Next() {
		var id, druh string
		if radky.Scan(&id, &druh) != nil {
			continue
		}
		potvrzene[id] = true
		x := a.obsah.Vektor(id)
		if x == nil {
			continue
		}
		u.pocet++
		ano := map[bool]float64{true: 1, false: 0}
		muz = append(muz, obsah.PrikladDruhu{X: x, T: ano[druh == "sex" || druh == "muz"], Vaha: 1})
		if druh == "lesbicka" || druh == "pozovaci" {
			zeny = append(zeny, obsah.PrikladDruhu{X: x, T: ano[druh == "lesbicka"], Vaha: 1})
		}
	}
	radky.Close()
	if u.pocet == 0 {
		return nil, 0
	}
	vychoziOdhady := a.obsah.OdhadyDruhu(nil)
	kotva := a.vzorekSbirkyDruhu(potvrzene)
	for _, k := range []func(o obsah.OdhadDruhu) float64{
		func(o obsah.OdhadDruhu) float64 { return o.Muz }, func(o obsah.OdhadDruhu) float64 { return o.Zeny }} {
		var nejsilnejsi []string
		for id := range vychoziOdhady {
			if !potvrzene[id] {
				nejsilnejsi = append(nejsilnejsi, id)
			}
		}
		sort.Slice(nejsilnejsi, func(i, j int) bool {
			pi, pj := k(vychoziOdhady[nejsilnejsi[i]]), k(vychoziOdhady[nejsilnejsi[j]])
			if pi != pj {
				return pi > pj
			}
			return nejsilnejsi[i] < nejsilnejsi[j]
		})
		kotva = append(kotva, nejsilnejsi[:min(len(nejsilnejsi), kotvaNavrhuDruhu)]...)
	}
	videno := map[string]bool{}
	for _, id := range kotva {
		o, ok := vychoziOdhady[id]
		x := a.obsah.Vektor(id)
		if !ok || x == nil || videno[id] {
			continue
		}
		videno[id] = true
		muz = append(muz, obsah.PrikladDruhu{X: x, T: o.Muz, Vaha: vahaVzorkuDruhu})
		zeny = append(zeny, obsah.PrikladDruhu{X: x, T: o.Zeny, Vaha: vahaVzorkuDruhu})
	}
	vychozi := obsah.VychoziVahyDruhu()
	u.vahy = &[2]obsah.VahyDruhu{obsah.UcitDruh(muz, &vychozi[0]), obsah.UcitDruh(zeny, &vychozi[1])}
	return u.vahy, u.pocet
}

// Vzorek nepotvrzených souborů sbírky, stále stejný (pořadí podle otisku ID)
func (a *App) vzorekSbirkyDruhu(vynechat map[string]bool) []string {
	radky, err := a.db.Query(`SELECT DISTINCT drive_file_id FROM fotky WHERE nedostupne_od IS NULL`)
	if err != nil {
		return nil
	}
	defer radky.Close()
	type s struct {
		id string
		h  uint64
	}
	var v []s
	for radky.Next() {
		var id string
		if radky.Scan(&id) != nil || vynechat[id] {
			continue
		}
		h := fnv.New64a()
		h.Write([]byte(id))
		v = append(v, s{id, h.Sum64()})
	}
	sort.Slice(v, func(i, j int) bool { return v[i].h < v[j].h })
	ids := make([]string, 0, vzorekSbirkyDruhu)
	for _, x := range v[:min(len(v), vzorekSbirkyDruhu)] {
		ids = append(ids, x.id)
	}
	return ids
}

// Od jaké jistoty odhadu se nepotvrzená fotka v Galerii skryje jako sex nebo lesbická (0.02.062)
const prahSkrytiDruhu = 0.95

// explicitniFotky (0.02.062, Galerie zvlášť): soubory, které se v běžné Galerii a kolekcích nezobrazí – potvrzený
// sex nebo lesbická, u nepotvrzených odhad s jistotou ≥ 95 %. Potvrzená pózovací a „jen s mužem“ zůstávají.
func (a *App) explicitniFotky() map[string]bool {
	v := map[string]bool{}
	if a.db == nil {
		return v
	}
	potvrzene := vsechnyDruhyFotek(a.db)
	for id, druh := range potvrzene {
		if druh == "sex" || druh == "lesbicka" {
			v[id] = true
		}
	}
	if a.obsah == nil || !a.obsahZapnuty() {
		return v
	}
	vahy, _ := a.vahyDruhu()
	for id, o := range a.obsah.OdhadyDruhu(vahy) {
		if potvrzene[id] == "" && (o.Muz >= prahSkrytiDruhu || o.Zeny >= prahSkrytiDruhu) {
			v[id] = true
		}
	}
	return v
}

// Od jaké pravděpodobnosti se fotka navrhne (na kontrolních listech z celé sbírky sedí asi 9 z 10)
const prahNavrhuDruhu = 0.85

type FotkaDruhu struct {
	DriveID   string  `json:"driveId"`
	URL       string  `json:"url"`
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Album     string  `json:"album"`
	Jistota   float64 `json:"jistota"`
}

type SkupinaDruhu struct {
	Fotky  []FotkaDruhu `json:"fotky"`
	Celkem int          `json:"celkem"`
}

type NavrhyDruhu struct {
	Muz  SkupinaDruhu `json:"muz"`
	Zeny SkupinaDruhu `json:"zeny"`
	// Kolik souborů má potvrzený druh (podle druhu)
	Potvrzene map[string]int `json:"potvrzene"`
	// Z kolika potvrzených fotek se odhad doladil (0 = vestavěný)
	Uceno int `json:"uceno"`
}

// GetNavrhyDruhu: fotky s mužem a s víc ženami podle odhadu, od nejjistějších (sporne: od nejméně jistých),
// v každé skupině nejvýš limit
func (a *App) GetNavrhyDruhu(limit int, sporne bool) NavrhyDruhu {
	v := NavrhyDruhu{Muz: SkupinaDruhu{Fotky: []FotkaDruhu{}}, Zeny: SkupinaDruhu{Fotky: []FotkaDruhu{}}, Potvrzene: map[string]int{}}
	if a.db == nil || a.obsah == nil || !a.obsahZapnuty() {
		return v
	}
	potvrzene := vsechnyDruhyFotek(a.db)
	for _, d := range potvrzene {
		v.Potvrzene[d]++
	}
	vahy, uceno := a.vahyDruhu()
	odhady := a.obsah.OdhadyDruhu(vahy)
	if len(odhady) == 0 {
		return v
	}
	radky, err := a.db.Query(`SELECT f.drive_file_id, COALESCE(al.modelka_id, 0), COALESCE(m.jmeno, ''), al.album
		FROM fotky f JOIN alba al ON al.id = f.album_id LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE f.nedostupne_od IS NULL ORDER BY f.id`)
	if err != nil {
		a.chyba("návrhy druhu fotek", err)
		return v
	}
	defer radky.Close()
	videno := map[string]bool{}
	var muz, zeny []FotkaDruhu
	for radky.Next() {
		var f FotkaDruhu
		if radky.Scan(&f.DriveID, &f.ModelkaID, &f.Jmeno, &f.Album) != nil || videno[f.DriveID] || potvrzene[f.DriveID] != "" {
			continue
		}
		videno[f.DriveID] = true
		o, ok := odhady[f.DriveID]
		if !ok {
			continue
		}
		// Fotka s mužem patří mezi „muž“, i když je na ní víc žen (scéna s mužem rozhoduje)
		if o.Muz >= prahNavrhuDruhu {
			f.Jistota = naDveMista(o.Muz)
			muz = append(muz, f)
		} else if o.Zeny >= prahNavrhuDruhu {
			f.Jistota = naDveMista(o.Zeny)
			zeny = append(zeny, f)
		}
	}
	v.Muz, v.Zeny = skupinaDruhu(muz, limit, sporne), skupinaDruhu(zeny, limit, sporne)
	v.Uceno = uceno
	return v
}

func skupinaDruhu(fotky []FotkaDruhu, limit int, sporne bool) SkupinaDruhu {
	sort.SliceStable(fotky, func(i, j int) bool {
		if sporne {
			return fotky[i].Jistota < fotky[j].Jistota
		}
		return fotky[i].Jistota > fotky[j].Jistota
	})
	s := SkupinaDruhu{Celkem: len(fotky), Fotky: fotky[:min(len(fotky), max(limit, 0))]}
	for i := range s.Fotky {
		s.Fotky[i].URL = adresaObrazku(s.Fotky[i].DriveID)
	}
	if s.Fotky == nil {
		s.Fotky = []FotkaDruhu{}
	}
	return s
}
