package sbirka

import (
	"database/sql"
	"sort"
	"strings"
)

// KatalogTagu je pevný seznam skupin a tagů fotek.
var KatalogTagu = []SkupinaTagu{
	{Klic: "zaber", Nazev: "Záběr", Vylucna: true, Tagy: []TagFotky{
		{"portret", "Portrét"}, {"poprsi", "Poprsí"}, {"postava", "Celá postava"}, {"detail", "Detail"}}},
	{Klic: "odhaleni", Nazev: "Odhalení", Vylucna: true, Tagy: []TagFotky{
		{"oblecena", "Oblečená"}, {"pradlo", "Spodní prádlo / plavky"}, {"nahore_bez", "Nahoře bez"}, {"akt", "Akt"}, {"explicitni", "Explicitní akt"}}},
	{Klic: "partie", Nazev: "Partie v záběru", Tagy: []TagFotky{
		{"prsa", "Prsa"}, {"zadecek", "Zadeček"}, {"vagina", "Vagina"}, {"nohy", "Nohy"}, {"chodidla", "Chodidla"}}},
	{Klic: "prostredi", Nazev: "Prostředí", Vylucna: true, Tagy: []TagFotky{
		{"studio", "Studio"}, {"interier", "Jiný interiér"}, {"loznice", "Ložnice"}, {"koupelna", "Koupelna"},
		{"priroda", "Příroda"}, {"plaz", "Pláž / moře"}, {"bazen", "Bazén"}, {"mesto", "Město"}, {"auto", "Auto / motorka"}}},
	{Klic: "obleceni", Nazev: "Oblečení a doplňky", Tagy: []TagFotky{
		{"podpatky", "Podpatky"}, {"puncochy", "Punčochy"}, {"podvazky", "Podvazky"}, {"bikiny", "Bikiny"},
		{"saty", "Šaty"}, {"kosile", "Košile / tričko"}, {"kostym", "Kostým / uniforma"}, {"latex", "Latex / kůže"},
		{"bunny", "Zaječí uši"}, {"dziny", "Džíny / denim"}}},
	{Klic: "poza", Nazev: "Póza a situace", Tagy: []TagFotky{
		{"stoji", "Stojí"}, {"sedi", "Sedí"}, {"lezi", "Leží"}, {"zezadu", "Zezadu"}, {"mokra", "Mokrá"}, {"vic_modelek", "Víc modelek"}}},
	{Klic: "barevnost", Nazev: "Barevnost", Vylucna: true, Tagy: []TagFotky{
		{"cernobila", "Černobílá"}, {"tonovana", "Tónovaná / sépie"}}},
	{Klic: "svetlo", Nazev: "Světlo", Vylucna: true, Tagy: []TagFotky{
		{"high_key", "Světlé (high-key)"}, {"low_key", "Tmavé (low-key / noir)"}, {"zlata_hodina", "Zlatá hodina"}, {"noc", "Noc / umělé světlo"}}},
	{Klic: "vyraz", Nazev: "Výraz", Tagy: []TagFotky{
		{"do_kamery", "Pohled do kamery"}, {"usmev", "Úsměv"}}},
}

var (
	SkupinaTaguMap      = map[string]*SkupinaTagu{}
	smazatVylucneDotazy = map[string]string{}
)

func init() {
	for i := range KatalogTagu {
		sk := &KatalogTagu[i]
		var klice []string
		for _, t := range sk.Tagy {
			SkupinaTaguMap[t.Klic] = sk
			klice = append(klice, "'"+strings.ReplaceAll(t.Klic, "'", "''")+"'")
		}
		if sk.Vylucna && len(klice) > 0 {
			smazatVylucneDotazy[sk.Klic] = "DELETE FROM fotky_tagy WHERE fotka_id = ? AND tag <> ? AND tag IN (" + strings.Join(klice, ",") + ")"
		}
	}
}

// PlatneTagy vrátí platné tagy bez opakování; ve výlučné skupině zůstane jen poslední uvedený.
func PlatneTagy(tagy []string) []string {
	vysledek := []string{}
	podleSkupiny := map[string]int{}
	videne := map[string]bool{}
	for _, t := range tagy {
		t = strings.TrimSpace(t)
		sk := SkupinaTaguMap[t]
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

// GetTagyFotek načte tagy fotek podle id (fotka bez tagů v mapě není).
func GetTagyFotek(db Dotazovac, ids []int, chybaFn func(string, error)) map[int][]string {
	vysledek := map[int][]string{}
	if len(ids) == 0 {
		return vysledek
	}
	znaky := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	radky, err := db.Query(`SELECT fotka_id, tag FROM fotky_tagy WHERE fotka_id IN (`+znaky+`)`, args...)
	if err != nil {
		if chybaFn != nil {
			chybaFn("načtení tagů fotek", err)
		}
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

// ZapsatTagyFotky přidá a odebere tagy u jedné fotky; výlučná skupina smaže ostatní tagy jedním dotazem.
func ZapsatTagyFotky(q Dotazovac, id int, pridat, odebrat []string) error {
	for _, t := range odebrat {
		if _, err := q.Exec(`DELETE FROM fotky_tagy WHERE fotka_id = ? AND tag = ?`, id, t); err != nil {
			return err
		}
	}
	for _, t := range pridat {
		if sk := SkupinaTaguMap[t]; sk != nil && sk.Vylucna {
			if dotaz := smazatVylucneDotazy[sk.Klic]; dotaz != "" {
				if _, err := q.Exec(dotaz, id, t); err != nil {
					return err
				}
			}
		}
		if _, err := q.Exec(`INSERT OR IGNORE INTO fotky_tagy (fotka_id, tag) VALUES (?, ?)`, id, t); err != nil {
			return err
		}
	}
	return nil
}

// GetPoctyTagu spočítá počty fotek podle tagu; pod klíčem "" je počet fotek bez jediného tagu.
func GetPoctyTagu(db Dotazovac) map[string]int {
	pocty := map[string]int{}
	radky, err := db.Query(`SELECT tag, COUNT(*) FROM fotky_tagy GROUP BY tag`)
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
	db.QueryRow(`SELECT (SELECT COUNT(*) FROM fotky) - (SELECT COUNT(DISTINCT fotka_id) FROM fotky_tagy)`).Scan(&bez)
	pocty[""] = bez
	return pocty
}

// VsechnyTagyFotek vrátí všechny tagy sbírky pro export: id fotky → tagy.
func VsechnyTagyFotek(db *sql.DB) map[int][]string {
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
