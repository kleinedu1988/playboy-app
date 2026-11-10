package main

// Rok ve sbírce (ROADMAP 1.46): výroční přehled práce na sbírce podle data přidání. Backend počítá, co okno
// samo neví – fotky, alba a čísla podle `pridano` fotek, dny práce a nejdelší sérii (přidání fotek a modelek,
// porovnání v Hodnocení, zápisy Údržby), nejlépe hodnocené nové fotky a sezóny uzavřené v roce. Modelky,
// jejich hodnocení a dokončené ročníky skládá okno ze seznamu modelek (frontend/src/lib/rok-ve-sbirce.js).

import (
	"sort"
	"strconv"
	"time"
)

const fotekRokuNejvys = 12

type MesicRoku struct {
	Fotek   int `json:"fotek"`
	Alb     int `json:"alb"`
	Modelek int `json:"modelek"`
	Dnu     int `json:"dnu"` // dní práce v měsíci
}

type FotkaRoku struct {
	FotkaID   int    `json:"fotkaId"`
	URL       string `json:"url"`
	Rotace    int    `json:"rotace"`
	Hodnoceni int    `json:"hodnoceni"`
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
	Vydani    string `json:"vydani"`
}

type SerieRoku struct {
	Dni int    `json:"dni"`
	Od  string `json:"od"` // RRRR-MM-DD
	Do  string `json:"do"`
}

type RokVeSbirce struct {
	Rok   int   `json:"rok"`
	Roky  []int `json:"roky"` // roky s nějakou prací, od nejnovějšího
	Fotek int   `json:"fotek"`
	Alb   int   `json:"alb"`   // alba, jejichž první fotka přibyla v roce
	Cisel int   `json:"cisel"` // čísla (vydání), jejichž první fotka přibyla v roce
	// Z fotek přidaných v roce: kolik už má srdíčka a kolik pět
	Hodnocenych int            `json:"hodnocenych"`
	Fotek5      int            `json:"fotek5"`
	Mesice      [12]MesicRoku  `json:"mesice"`
	DnuPrace    int            `json:"dnuPrace"`
	Serie       SerieRoku      `json:"serie"`
	Souboju     int            `json:"souboju"` // porovnání v Hodnocení
	Zapisu      int            `json:"zapisu"`  // přijaté návrhy a opravy v Údržbě
	Nejlepsi    []FotkaRoku    `json:"nejlepsi"`
	NovaCisla   []string       `json:"novaCisla"`
	Sezony      []MinulaSezona `json:"sezony"` // uzavřené sezóny, které začaly v roce, od nejstarší
	FotekLoni   int            `json:"fotekLoni"`
	ModelekLoni int            `json:"modelekLoni"`
}

// Den a rok z textu data „RRRR-MM-DD…“; neplatné vrací rok 0
func denZCasu(cas string) (string, int, int) {
	if len(cas) < 10 {
		return "", 0, 0
	}
	rok, err1 := strconv.Atoi(cas[:4])
	mesic, err2 := strconv.Atoi(cas[5:7])
	if err1 != nil || err2 != nil || mesic < 1 || mesic > 12 {
		return "", 0, 0
	}
	return cas[:10], rok, mesic
}

// Nejdelší řada po sobě jdoucích dní ze seřazených dnů RRRR-MM-DD
func nejdelsiSerie(dny []string) SerieRoku {
	var nej, akt SerieRoku
	var predchozi time.Time
	for _, d := range dny {
		t, err := time.Parse("2006-01-02", d)
		if err != nil {
			continue
		}
		if akt.Dni > 0 && t.Sub(predchozi) == 24*time.Hour {
			akt.Dni++
			akt.Do = d
		} else {
			akt = SerieRoku{Dni: 1, Od: d, Do: d}
		}
		predchozi = t
		if akt.Dni > nej.Dni {
			nej = akt
		}
	}
	return nej
}

func (a *App) GetRokVeSbirce(rok int) RokVeSbirce {
	v := RokVeSbirce{Rok: rok, Roky: []int{}, Nejlepsi: []FotkaRoku{}, NovaCisla: []string{}, Sezony: []MinulaSezona{}}
	roky := map[int]bool{}
	dny := map[string]bool{}
	pridatDen := func(cas string) (int, int) {
		den, r, m := denZCasu(cas)
		if r > 0 {
			roky[r] = true
			if r == rok {
				dny[den] = true
			}
		}
		return r, m
	}

	// Fotky: počty po měsících, první fotka alba a čísla, srdíčka
	radky, err := a.db.Query(`SELECT f.id, f.album_id, COALESCE(f.pridano, ''), COALESCE(f.hodnoceni, 0) FROM fotky f`)
	if err != nil {
		a.chyba("rok ve sbírce", err)
		return v
	}
	prvniAlba := map[int64]string{}
	for radky.Next() {
		var id int
		var album int64
		var pridano string
		var h int
		if radky.Scan(&id, &album, &pridano, &h) != nil {
			continue
		}
		r, m := pridatDen(pridano)
		if r == 0 {
			continue
		}
		if p, ok := prvniAlba[album]; !ok || pridano < p {
			prvniAlba[album] = pridano
		}
		switch r {
		case rok:
			v.Fotek++
			v.Mesice[m-1].Fotek++
			if h > 0 {
				v.Hodnocenych++
			}
			if h >= 5 {
				v.Fotek5++
			}
		case rok - 1:
			v.FotekLoni++
		}
	}
	radky.Close()

	// Alba a čísla: kdy přibyla jejich první fotka
	vydaniAlb := map[int64]string{}
	if r, err := a.db.Query(`SELECT id, COALESCE(vydani, '') FROM alba`); err == nil {
		for r.Next() {
			var id int64
			var vydani string
			if r.Scan(&id, &vydani) == nil {
				vydaniAlb[id] = vydani
			}
		}
		r.Close()
	}
	prvniCisla := map[string]string{}
	for album, pridano := range prvniAlba {
		if _, r, m := denZCasu(pridano); r == rok {
			v.Alb++
			v.Mesice[m-1].Alb++
		}
		if c := vydaniAlb[album]; c != "" {
			if p, ok := prvniCisla[c]; !ok || pridano < p {
				prvniCisla[c] = pridano
			}
		}
	}
	for c, pridano := range prvniCisla {
		if _, r, _ := denZCasu(pridano); r == rok {
			v.NovaCisla = append(v.NovaCisla, c)
		}
	}
	sort.Strings(v.NovaCisla)
	v.Cisel = len(v.NovaCisla)

	// Modelky: po měsících (seznam a hodnocení skládá okno)
	if r, err := a.db.Query(`SELECT COALESCE(pridano, '') FROM modelky`); err == nil {
		for r.Next() {
			var pridano string
			if r.Scan(&pridano) != nil {
				continue
			}
			switch rr, m := pridatDen(pridano); rr {
			case rok:
				v.Mesice[m-1].Modelek++
			case rok - 1:
				v.ModelekLoni++
			}
		}
		r.Close()
	}

	// Nejlépe hodnocené fotky přidané v roce (stejné srdíčko: dřív přidaná první); jen dostupné
	od, do := strconv.Itoa(rok)+"-01-01", strconv.Itoa(rok+1)+"-01-01"
	if r, err := a.db.Query(`SELECT f.id, f.drive_file_id, COALESCE(f.rotace, 0), f.hodnoceni, COALESCE(al.modelka_id, 0),
		COALESCE(m.jmeno, ''), al.album, al.typ, COALESCE(al.vydani, '')
		FROM fotky f JOIN alba al ON al.id = f.album_id LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE f.pridano >= ? AND f.pridano < ? AND f.hodnoceni >= 4 AND f.nedostupne_od IS NULL
		ORDER BY f.hodnoceni DESC, f.pridano, f.id`, od, do); err == nil {
		// Nejvýš dvě fotky jedné modelky, ať přehled ukáže víc focení
		naModelku := map[int]int{}
		for r.Next() && len(v.Nejlepsi) < fotekRokuNejvys {
			var f FotkaRoku
			var drive string
			if r.Scan(&f.FotkaID, &drive, &f.Rotace, &f.Hodnoceni, &f.ModelkaID, &f.Jmeno, &f.Album, &f.Typ, &f.Vydani) != nil {
				continue
			}
			if f.ModelkaID > 0 && naModelku[f.ModelkaID] >= 2 {
				continue
			}
			naModelku[f.ModelkaID]++
			f.URL = adresaObrazku(drive)
			v.Nejlepsi = append(v.Nejlepsi, f)
		}
		r.Close()
	}

	// Učení: porovnání, zápisy Údržby a sezóny
	if u := a.uc; u != nil {
		u.mu.Lock()
		porovnani := u.nacistPorovnani()
		sezony := u.nacistSezony()
		obdobi := u.nacistObdobi()
		var zapisy []string
		if db := u.zajistit(); db != nil {
			if r, err := db.Query(`SELECT cas FROM udalosti`); err == nil {
				for r.Next() {
					var cas string
					if r.Scan(&cas) == nil {
						zapisy = append(zapisy, cas)
					}
				}
				r.Close()
			}
		}
		u.mu.Unlock()
		for _, p := range porovnani {
			if r, _ := pridatDen(p.cas.Format("2006-01-02 15:04:05")); r == rok {
				v.Souboju++
			}
		}
		for _, cas := range zapisy {
			if r, _ := pridatDen(cas); r == rok {
				v.Zapisu++
			}
		}
		for _, s := range sezony {
			sOd, sDo, ok := oknoSezony(s.Klic, obdobi)
			if !ok || sOd.Year() != rok {
				continue
			}
			s.NazevSezony = noveNazevSezony(s.Klic, sOd, sDo, s.Tema)
			v.Sezony = append(v.Sezony, s)
		}
		sort.Slice(v.Sezony, func(i, j int) bool { return v.Sezony[i].Od < v.Sezony[j].Od })
	}

	serazene := make([]string, 0, len(dny))
	for d := range dny {
		serazene = append(serazene, d)
	}
	sort.Strings(serazene)
	v.DnuPrace = len(serazene)
	v.Serie = nejdelsiSerie(serazene)
	for _, d := range serazene {
		if m, err := strconv.Atoi(d[5:7]); err == nil {
			v.Mesice[m-1].Dnu++
		}
	}
	for r := range roky {
		v.Roky = append(v.Roky, r)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(v.Roky)))
	return v
}
