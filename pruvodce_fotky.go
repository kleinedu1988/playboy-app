package main

// Průvodce hodnocením fotky (Hodnocení › Hodnotit › Fotky): krok po kroku tagy a nakonec srdíčka. Každý krok má
// nejvýš 9 možností (číslice 1–9), volitelný krok i „0 = žádná“. Fotka se nabízí, dokud neprojde všemi kroky
// aktuální verze průvodce (tabulka fotky_pruvodce); přeskočená fotka si nechá tagy z potvrzených kroků. Kroky
// definuje backend, frontend jen vyhodnocuje podmínky (frontend/src/lib/pruvodce.js). Když přibude krok nebo
// tag, zvýší se verzePruvodce a fotky prošlé starší verzí se nabídnou znovu (s předvyplněnými tagy).

import (
	"database/sql"
	"errors"
)

const verzePruvodce = 1

// Podmínka nad tagy vybranými v dřívějších krocích: splněná, když fotka má některý z tagů (Ne: žádný z nich)
type PodminkaKroku struct {
	Tagy []string `json:"tagy"`
	Ne   bool     `json:"ne"`
}

// Možnosti, které se při splněné podmínce ztlumí (čísla zůstanou, jen se nehodí)
type TlumeniKroku struct {
	Moznosti []string      `json:"moznosti"`
	Kdyz     PodminkaKroku `json:"kdyz"`
}

type MoznostKroku struct {
	Klic    string `json:"klic"`
	Nazev   string `json:"nazev"`
	Skupina string `json:"skupina"`
	Vylucna bool   `json:"vylucna"` // ze své skupiny nejvýš jedna (i v kroku „více“)
}

type KrokPruvodce struct {
	Klic        string         `json:"klic"`
	Nazev       string         `json:"nazev"`
	Typ         string         `json:"typ"` // "jeden" (číslice vybere a jde dál) | "vice" (číslice přepíná, Enter dál) | "srdicka"
	Povinny     bool           `json:"povinny"`
	Nula        string         `json:"nula"` // popis „0“ u volitelného kroku
	Moznosti    []MoznostKroku `json:"moznosti"`
	Preskocit   *PodminkaKroku `json:"preskocit"`   // celý krok se přeskočí
	Tlumit      []TlumeniKroku `json:"tlumit"`      // ztlumené možnosti
	Predvyplnit []string       `json:"predvyplnit"` // tagy převzaté z minulé fotky téhož alba
	Skupiny     []string       `json:"skupiny"`     // skupiny katalogu, na které krok odpovídá
}

type KrokyPruvodce struct {
	Verze int            `json:"verze"`
	Kroky []KrokPruvodce `json:"kroky"`
}

var krokyPruvodce = func() []KrokPruvodce {
	k := func(klic, nazev, typ string, povinny bool, nula string, tagy ...string) KrokPruvodce {
		krok := KrokPruvodce{Klic: klic, Nazev: nazev, Typ: typ, Povinny: povinny, Nula: nula, Tlumit: []TlumeniKroku{}, Predvyplnit: []string{}}
		videne := map[string]bool{}
		for _, t := range tagy {
			sk := skupinaTagu[t]
			krok.Moznosti = append(krok.Moznosti, MoznostKroku{Klic: t, Nazev: nazevTaguFotky(t), Skupina: sk.Klic, Vylucna: sk.Vylucna})
			if !videne[sk.Klic] {
				videne[sk.Klic] = true
				krok.Skupiny = append(krok.Skupiny, sk.Klic)
			}
		}
		return krok
	}
	kdyz := func(tagy ...string) PodminkaKroku { return PodminkaKroku{Tagy: tagy} }
	telo := k("telo", "Tělo a nohy", "vice", false, "nic z toho", "prsa", "zadecek", "vagina", "nohy", "chodidla", "podpatky", "puncochy", "podvazky")
	telo.Preskocit = &PodminkaKroku{Tagy: []string{"portret"}}
	telo.Tlumit = []TlumeniKroku{
		{Moznosti: []string{"vagina"}, Kdyz: PodminkaKroku{Tagy: []string{"akt", "explicitni"}, Ne: true}},
		{Moznosti: []string{"vagina", "nohy", "chodidla", "podpatky", "puncochy", "podvazky"}, Kdyz: kdyz("poprsi")},
	}
	telo.Predvyplnit = []string{"podpatky", "puncochy", "podvazky"}
	prostredi := k("prostredi", "Prostředí", "jeden", false, "nepoznám / jiné", "studio", "interier", "loznice", "koupelna", "priroda", "plaz", "bazen", "mesto", "auto")
	prostredi.Predvyplnit = []string{"studio", "interier", "loznice", "koupelna", "priroda", "plaz", "bazen", "mesto", "auto"}
	obleceni := k("obleceni", "Oblečení", "vice", false, "bez oblečení z nabídky", "bikiny", "saty", "kosile", "dziny", "kostym", "latex", "bunny")
	obleceni.Predvyplnit = []string{"bikiny", "saty", "kosile", "dziny", "kostym", "latex", "bunny"}
	poza := k("poza", "Póza a výraz", "vice", false, "nic z toho", "stoji", "sedi", "lezi", "zezadu", "mokra", "vic_modelek", "do_kamery", "usmev")
	poza.Tlumit = []TlumeniKroku{{Moznosti: []string{"do_kamery", "usmev"}, Kdyz: kdyz("detail")}}
	styl := k("styl", "Styl fotky", "vice", false, "běžná barevná fotka", "cernobila", "tonovana", "high_key", "low_key", "zlata_hodina", "noc")
	styl.Predvyplnit = []string{"cernobila", "tonovana", "high_key", "low_key", "zlata_hodina", "noc"}
	return []KrokPruvodce{
		k("zaber", "Záběr", "jeden", true, "", "portret", "poprsi", "postava", "detail"),
		k("odhaleni", "Odhalení", "jeden", true, "", "oblecena", "pradlo", "nahore_bez", "akt", "explicitni"),
		prostredi,
		telo,
		obleceni,
		poza,
		styl,
		{Klic: "srdicka", Nazev: "Srdíčka", Typ: "srdicka", Povinny: true, Moznosti: []MoznostKroku{}, Tlumit: []TlumeniKroku{}, Predvyplnit: []string{}, Skupiny: []string{}},
	}
}()

func (a *App) GetKrokyPruvodce() KrokyPruvodce {
	return KrokyPruvodce{Verze: verzePruvodce, Kroky: krokyPruvodce}
}

// Fotky modelek, které ještě neprošly průvodcem aktuální verze: po modelkách a albech (předvyplnění podle alba)
func (a *App) GetFotkyKPruvodci() FrontaFotek {
	return a.nacistFrontu("fotky k průvodci", `NOT EXISTS (SELECT 1 FROM fotky_pruvodce p WHERE p.fotka_id = f.id AND p.verze >= ?)`, verzePruvodce)
}

func (a *App) fotkyKPruvodci() []Fotografie {
	return a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE NOT EXISTS (SELECT 1 FROM fotky_pruvodce p WHERE p.fotka_id = f.id AND p.verze >= ?)
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, f.album, `+razeniFotek, true, true, verzePruvodce))
}

func (a *App) GetPocetFotekKPruvodci() int {
	var n int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM fotky f JOIN alba al ON al.id = f.album_id
		WHERE al.modelka_id > 0 AND NOT EXISTS (SELECT 1 FROM fotky_pruvodce p WHERE p.fotka_id = f.id AND p.verze >= ?)`, verzePruvodce).Scan(&n); err != nil {
		a.chyba("počet fotek k průvodci", err)
	}
	return n
}

// Zápis průvodce: Skupiny = skupiny katalogu zodpovězených kroků (v nich tagy fotky nahradí výběr; ostatní
// skupiny zůstanou), Hodnoceni > 0 nastaví srdíčka, Hotovo zapíše, že fotka prošla průvodcem
type ZapisPruvodce struct {
	Ids       []int    `json:"ids"`
	Skupiny   []string `json:"skupiny"`
	Tagy      []string `json:"tagy"`
	Hodnoceni int      `json:"hodnoceni"`
	Hotovo    bool     `json:"hotovo"`
}

// Stav fotek před zápisem (pro Vrátit)
type StavFotkyPruvodce struct {
	ID        int      `json:"id"`
	Tagy      []string `json:"tagy"`
	Hodnoceni int      `json:"hodnoceni"`
	Verze     int      `json:"verze"` // 0 = neprošla
	Hotovo    string   `json:"hotovo"`
}

type PredchoziPruvodce struct {
	Ok    bool                `json:"ok"`
	Fotky []StavFotkyPruvodce `json:"fotky"`
}

func (a *App) UlozitPruvodceFotky(z ZapisPruvodce) PredchoziPruvodce {
	vysledek := PredchoziPruvodce{Fotky: []StavFotkyPruvodce{}}
	if len(z.Ids) == 0 {
		return vysledek
	}
	zodpovezene := map[string]bool{}
	for _, s := range z.Skupiny {
		zodpovezene[s] = true
	}
	var pridat []string
	for _, t := range platneTagy(z.Tagy) {
		if zodpovezene[skupinaTagu[t].Klic] {
			pridat = append(pridat, t)
		}
	}
	var odebrat []string
	for i := range katalogTagu {
		if zodpovezene[katalogTagu[i].Klic] {
			for _, t := range katalogTagu[i].Tagy {
				odebrat = append(odebrat, t.Klic)
			}
		}
	}
	hodnoceni := min(max(z.Hodnoceni, 0), 5)
	cas := ted()
	vysledek.Ok = a.vTransakci("uložení průvodce fotky", func(q dotazovac) error {
		for _, id := range z.Ids {
			predtim, err := stavFotkyPruvodce(q, id)
			if errors.Is(err, sql.ErrNoRows) {
				continue // fotka mezitím smazaná: zbytek dávky (spojený plakát) se uloží
			}
			if err != nil {
				return err
			}
			vysledek.Fotky = append(vysledek.Fotky, predtim)
			if err := zapsatTagyFotky(q, id, pridat, odebrat); err != nil {
				return err
			}
			if hodnoceni > 0 {
				if _, err := q.Exec(`UPDATE fotky SET hodnoceni = ? WHERE id = ?`, hodnoceni, id); err != nil {
					return err
				}
			}
			if z.Hotovo {
				if _, err := q.Exec(`INSERT OR REPLACE INTO fotky_pruvodce (fotka_id, verze, hotovo) VALUES (?, ?, ?)`, id, verzePruvodce, cas); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if !vysledek.Ok {
		vysledek.Fotky = []StavFotkyPruvodce{}
	}
	return vysledek
}

func stavFotkyPruvodce(q dotazovac, id int) (StavFotkyPruvodce, error) {
	s := StavFotkyPruvodce{ID: id, Tagy: []string{}}
	if err := q.QueryRow(`SELECT COALESCE(hodnoceni, 0) FROM fotky WHERE id = ?`, id).Scan(&s.Hodnoceni); err != nil {
		return s, err
	}
	radky, err := q.Query(`SELECT tag FROM fotky_tagy WHERE fotka_id = ? ORDER BY tag`, id)
	if err != nil {
		return s, err
	}
	for radky.Next() {
		var t string
		if err := radky.Scan(&t); err != nil {
			radky.Close()
			return s, err
		}
		s.Tagy = append(s.Tagy, t)
	}
	radky.Close()
	if err := radky.Err(); err != nil {
		return s, err
	}
	if err := q.QueryRow(`SELECT verze, hotovo FROM fotky_pruvodce WHERE fotka_id = ?`, id).Scan(&s.Verze, &s.Hotovo); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return s, err
	}
	return s, nil
}

// Vrátí fotky do stavu před zápisem průvodce (tagy, srdíčka, příznak)
func (a *App) VratitPruvodceFotky(p PredchoziPruvodce) bool {
	if len(p.Fotky) == 0 {
		return false
	}
	return a.vTransakci("vrácení průvodce fotky", func(q dotazovac) error {
		for _, f := range p.Fotky {
			// Fotka mezitím smazaná: nic k vrácení (cizí klíč by jinak shodil celé vrácení)
			var existuje int
			if err := q.QueryRow(`SELECT COUNT(*) FROM fotky WHERE id = ?`, f.ID).Scan(&existuje); err != nil {
				return err
			}
			if existuje == 0 {
				continue
			}
			if _, err := q.Exec(`DELETE FROM fotky_tagy WHERE fotka_id = ?`, f.ID); err != nil {
				return err
			}
			// Přesně podle snímku (i tagy, které mezitím z katalogu zmizely)
			for _, t := range f.Tagy {
				if _, err := q.Exec(`INSERT OR IGNORE INTO fotky_tagy (fotka_id, tag) VALUES (?, ?)`, f.ID, t); err != nil {
					return err
				}
			}
			if _, err := q.Exec(`UPDATE fotky SET hodnoceni = ? WHERE id = ?`, min(max(f.Hodnoceni, 0), 5), f.ID); err != nil {
				return err
			}
			if _, err := q.Exec(`DELETE FROM fotky_pruvodce WHERE fotka_id = ?`, f.ID); err != nil {
				return err
			}
			if f.Verze > 0 {
				if _, err := q.Exec(`INSERT INTO fotky_pruvodce (fotka_id, verze, hotovo) VALUES (?, ?, ?)`, f.ID, f.Verze, f.Hotovo); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// Verze průvodce prošlých fotek pro export: id fotky → verze
func vsechnyPruvodceFotek(q dotazovac) map[int]int {
	v := map[int]int{}
	radky, err := q.Query(`SELECT fotka_id, verze FROM fotky_pruvodce`)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id, verze int
		if radky.Scan(&id, &verze) == nil {
			v[id] = verze
		}
	}
	return v
}
