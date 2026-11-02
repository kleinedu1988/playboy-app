package main

import (
	"database/sql"
	"sort"
	"strings"
)

// Tagy fotek: pevný seznam (ne volný text) kvůli tematickým sezónám a filtrům. Skupina je buď výlučná (fotka má
// nejvýš jednu hodnotu – přidání jiné hodnoty té skupiny tu dosavadní odebere), nebo vícenásobná. Kódy tagů jsou
// stálé (ukládají se do databáze a do zálohy), názvy jen pro zobrazení. Typ prsou, ochlupení, vlasy a podobně se
// neberou z fotky, ale z údajů modelky. Indoor a outdoor se odvozují z prostředí.

type TagFotky struct {
	Klic  string `json:"klic"`
	Nazev string `json:"nazev"`
}

type SkupinaTagu struct {
	Klic    string     `json:"klic"`
	Nazev   string     `json:"nazev"`
	Vylucna bool       `json:"vylucna"`
	Tagy    []TagFotky `json:"tagy"`
}

var katalogTagu = []SkupinaTagu{
	{Klic: "zaber", Nazev: "Záběr", Vylucna: true, Tagy: []TagFotky{
		{"portret", "Portrét"}, {"poprsi", "Poprsí"}, {"postava", "Celá postava"}, {"detail", "Detail"}}},
	{Klic: "odhaleni", Nazev: "Odhalení", Vylucna: true, Tagy: []TagFotky{
		{"oblecena", "Oblečená"}, {"pradlo", "Spodní prádlo / plavky"}, {"nahore_bez", "Nahoře bez"}, {"akt", "Akt"}, {"explicitni", "Explicitní akt"}}},
	{Klic: "partie", Nazev: "Partie v záběru", Tagy: []TagFotky{
		{"prsa", "Prsa"}, {"zadecek", "Zadeček"}, {"vagina", "Vagina"}, {"nohy", "Nohy"}, {"chodidla", "Chodidla"}}},
	{Klic: "prostredi", Nazev: "Prostředí", Vylucna: true, Tagy: []TagFotky{
		{"studio", "Studio"}, {"interier", "Interiér"}, {"loznice", "Ložnice"}, {"koupelna", "Koupelna"},
		{"priroda", "Příroda"}, {"plaz", "Pláž / voda"}, {"mesto", "Město"}}},
	{Klic: "obleceni", Nazev: "Oblečení a doplňky", Tagy: []TagFotky{
		{"podpatky", "Podpatky"}, {"puncochy", "Punčochy"}, {"podvazky", "Podvazky"}, {"bikiny", "Bikiny"},
		{"saty", "Šaty"}, {"kosile", "Košile / tričko"}, {"kostym", "Kostým / uniforma"}, {"latex", "Latex / kůže"}}},
	{Klic: "poza", Nazev: "Póza", Tagy: []TagFotky{
		{"stoji", "Stojí"}, {"sedi", "Sedí"}, {"lezi", "Leží"}, {"zezadu", "Zezadu"}, {"mokra", "Mokrá"}, {"vic_modelek", "Víc modelek"}}},
}

// Tag → jeho skupina (pro kontrolu a výlučnost)
var skupinaTagu = func() map[string]*SkupinaTagu {
	m := map[string]*SkupinaTagu{}
	for i := range katalogTagu {
		for _, t := range katalogTagu[i].Tagy {
			m[t.Klic] = &katalogTagu[i]
		}
	}
	return m
}()

// Seznam tagů pro rozhraní (skupiny v pořadí, v jakém se ukazují)
func (a *App) GetKatalogTagu() []SkupinaTagu {
	return katalogTagu
}

// Platné tagy bez opakování; ve výlučné skupině zůstane jen poslední uvedený
func platneTagy(tagy []string) []string {
	vysledek := []string{}
	podleSkupiny := map[string]int{}
	videne := map[string]bool{}
	for _, t := range tagy {
		t = strings.TrimSpace(t)
		sk := skupinaTagu[t]
		if sk == nil || videne[t] {
			continue
		}
		if sk.Vylucna {
			if i, ok := podleSkupiny[sk.Klic]; ok {
				delete(videne, vysledek[i])
				vysledek[i] = t
				videne[t] = true
				continue
			}
			podleSkupiny[sk.Klic] = len(vysledek)
		}
		videne[t] = true
		vysledek = append(vysledek, t)
	}
	return vysledek
}

// Tagy fotek podle id (fotka bez tagů v mapě není)
func (a *App) GetTagyFotek(ids []int) map[int][]string {
	vysledek := map[int][]string{}
	if len(ids) == 0 {
		return vysledek
	}
	znaky := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	radky, err := a.db.Query(`SELECT fotka_id, tag FROM fotky_tagy WHERE fotka_id IN (`+znaky+`)`, args...)
	if err != nil {
		a.chyba("načtení tagů fotek", err)
		return vysledek
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		var tag string
		if radky.Scan(&id, &tag) == nil {
			vysledek[id] = append(vysledek[id], tag)
		}
	}
	for id := range vysledek {
		sort.Strings(vysledek[id])
	}
	return vysledek
}

// Přidá a odebere tagy u fotek v jedné transakci; přidání tagu výlučné skupiny odebere ostatní tagy té skupiny
func (a *App) SetTagyFotek(ids []int, pridat, odebrat []string) bool {
	pridat = platneTagy(pridat)
	return a.vTransakci("uložení tagů fotek", func(q dotazovac) error {
		for _, id := range ids {
			if err := zapsatTagyFotky(q, id, pridat, odebrat); err != nil {
				return err
			}
		}
		return nil
	})
}

func zapsatTagyFotky(q dotazovac, id int, pridat, odebrat []string) error {
	for _, t := range odebrat {
		if _, err := q.Exec(`DELETE FROM fotky_tagy WHERE fotka_id = ? AND tag = ?`, id, t); err != nil {
			return err
		}
	}
	for _, t := range pridat {
		if sk := skupinaTagu[t]; sk.Vylucna {
			for _, jiny := range sk.Tagy {
				if jiny.Klic != t {
					if _, err := q.Exec(`DELETE FROM fotky_tagy WHERE fotka_id = ? AND tag = ?`, id, jiny.Klic); err != nil {
						return err
					}
				}
			}
		}
		if _, err := q.Exec(`INSERT OR IGNORE INTO fotky_tagy (fotka_id, tag) VALUES (?, ?)`, id, t); err != nil {
			return err
		}
	}
	return nil
}

// Počty fotek podle tagu; pod klíčem "" počet fotek bez jediného tagu
func (a *App) GetPoctyTagu() map[string]int {
	pocty := map[string]int{}
	radky, err := a.db.Query(`SELECT tag, COUNT(*) FROM fotky_tagy GROUP BY tag`)
	if err == nil {
		for radky.Next() {
			var tag string
			var n int
			if radky.Scan(&tag, &n) == nil {
				pocty[tag] = n
			}
		}
		radky.Close()
	}
	var bez int
	a.db.QueryRow(`SELECT COUNT(*) FROM fotky f WHERE NOT EXISTS (SELECT 1 FROM fotky_tagy t WHERE t.fotka_id = f.id)`).Scan(&bez)
	pocty[""] = bez
	return pocty
}

// Všechny tagy sbírky pro export: id fotky → tagy
func vsechnyTagyFotek(db *sql.DB) map[int][]string {
	vysledek := map[int][]string{}
	radky, err := db.Query(`SELECT fotka_id, tag FROM fotky_tagy ORDER BY fotka_id, tag`)
	if err != nil {
		return vysledek
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		var tag string
		if radky.Scan(&id, &tag) == nil {
			vysledek[id] = append(vysledek[id], tag)
		}
	}
	return vysledek
}
