package main

// Údržba › Stejné fotky: tatáž fotka nahraná na Disk víckrát (jiné ID souboru) a téměř shodné záběry ze stejného
// focení. Dvojice souborů je „stejná“, když se shodují perceptuální otisky (otisky.go) – to najde přesné, přeuložené
// i zmenšené kopie v celé sbírce – nebo když mají fotky téže modelky skoro stejný vektor obsahu (CLIP, ≥ 0,985) –
// to najde i mírně oříznuté kopie a vedlejší snímky. Dvojice spojené přes společný soubor tvoří skupinu.
// Sloučení skupiny nechá jeden soubor: v albu, kde už je, se kopie odebere (srdíčka a tagy přejdou na ponechanou),
// jinde se v albu jen vymění soubor, aby album o fotku nepřišlo. Všechno jde vrátit. Skupina označená
// „V pořádku (nejsou stejné)“ se už nehlásí (dvojice v nastaveni).

import (
	"context"
	"database/sql"
	"sort"
	"strings"
	"time"
)

// Prahy shody otisků: pHash do 6 bitů je táž fotka (i přeuložená či zmenšená); do 10 bitů jen spolu s dHash
const (
	prahPHashJiste   = 6
	prahPHash        = 10
	prahDHash        = 10
	prahObsahuStejne = 0.985
	// Fotky jedné modelky se porovnávají vektory obsahu každá s každou; víc fotek jedné modelky už se nesrovnává
	nejviceFotekNaObsah = 4000
	klicRuznychFotek    = "stejne_fotky_ruzne"
)

// SouborStejnych: jeden soubor ze skupiny a všechna jeho místa ve sbírce (alba, ve kterých je)
type SouborStejnych struct {
	DriveID  string       `json:"driveId"`
	Fotky    []Fotografie `json:"fotky"`
	Tagu     int          `json:"tagu"`
	Ponechat bool         `json:"ponechat"` // návrh, který soubor nechat (víc srdíček, tagů, míst, starší)
}

// SkupinaStejnych: soubory, které vypadají jako tatáž fotka; Duvod je nejsilnější shoda ve skupině
type SkupinaStejnych struct {
	Klic    string           `json:"klic"`
	Duvod   string           `json:"duvod"` // "stejna" (otisky skoro shodné), "temer" (otisky blízko), "obsah" (vektor obsahu)
	Soubory []SouborStejnych `json:"soubory"`
}

func klicStejnych(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + "|" + b
}

// Dvojice označené „V pořádku (nejsou stejné)“
func (a *App) ruzneFotky() map[string]bool {
	m := map[string]bool{}
	for _, radek := range strings.Split(a.nastaveni(klicRuznychFotek), "\n") {
		if radek = strings.TrimSpace(radek); radek != "" {
			m[radek] = true
		}
	}
	return m
}

func (a *App) ulozitRuzneFotky(m map[string]bool) error {
	radky := make([]string, 0, len(m))
	for k := range m {
		radky = append(radky, k)
	}
	sort.Strings(radky)
	return a.ulozitNastaveni(klicRuznychFotek, strings.Join(radky, "\n"))
}

// OznacitRuzneFotky: soubory skupiny nejsou stejné (každá jejich dvojice se přestane hlásit)
func (a *App) OznacitRuzneFotky(ids []string) bool {
	m := a.ruzneFotky()
	for i := range ids {
		for j := i + 1; j < len(ids); j++ {
			m[klicStejnych(ids[i], ids[j])] = true
		}
	}
	if err := a.ulozitRuzneFotky(m); err != nil {
		a.chyba("uložení výjimky stejných fotek", err)
		return false
	}
	return true
}

// ZrusitRuzneFotky: vrácení OznacitRuzneFotky
func (a *App) ZrusitRuzneFotky(ids []string) bool {
	m := a.ruzneFotky()
	for i := range ids {
		for j := i + 1; j < len(ids); j++ {
			delete(m, klicStejnych(ids[i], ids[j]))
		}
	}
	if err := a.ulozitRuzneFotky(m); err != nil {
		a.chyba("uložení výjimky stejných fotek", err)
		return false
	}
	return true
}

// Shoda dvou souborů podle otisků: "stejna", "temer", nebo ""
func shodaOtisku(x, y otisk) string {
	dd, dp := x.vzdalenost(y)
	switch {
	case dp <= 2 && dd <= 4:
		return "stejna"
	case dp <= prahPHashJiste || (dp <= prahPHash && dd <= prahDHash):
		return "temer"
	}
	return ""
}

var silaDuvodu = map[string]int{"stejna": 3, "temer": 2, "obsah": 1}

// Union-find nad indexy souborů
type mnoziny []int

func (m mnoziny) koren(i int) int {
	for m[i] != i {
		m[i] = m[m[i]]
		i = m[i]
	}
	return i
}

// GetStejneFotky: skupiny stejných fotek, seřazené podle modelky a alba první fotky
func (a *App) GetStejneFotky() []SkupinaStejnych {
	skupiny := []SkupinaStejnych{}
	fotky := a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		WHERE f.nedostupne_od IS NULL AND COALESCE(f.drive_file_id, '') <> ''
		ORDER BY f.id`, true, true)
	if len(fotky) < 2 {
		return skupiny
	}
	fotky = a.doplnitDalsiModelky(fotky)

	// Soubory (jedno ID souboru může být ve víc albech) a jejich modelky
	indexSouboru := map[string]int{}
	var soubory []string
	mista := map[string][]Fotografie{}
	modelkySouboru := map[int][]int{}
	for _, f := range fotky {
		if !jeHoleID(f.DriveID) {
			continue
		}
		i, ok := indexSouboru[f.DriveID]
		if !ok {
			i = len(soubory)
			indexSouboru[f.DriveID] = i
			soubory = append(soubory, f.DriveID)
		}
		mista[f.DriveID] = append(mista[f.DriveID], f)
		if f.ModelkaID > 0 {
			seznam := modelkySouboru[f.ModelkaID]
			if len(seznam) == 0 || seznam[len(seznam)-1] != i {
				modelkySouboru[f.ModelkaID] = append(seznam, i)
			}
		}
	}

	ruzne := a.ruzneFotky()
	rodic := make(mnoziny, len(soubory))
	for i := range rodic {
		rodic[i] = i
	}
	duvodDvojice := map[[2]int]string{}
	spojit := func(i, j int, duvod string) {
		if i == j || ruzne[klicStejnych(soubory[i], soubory[j])] {
			return
		}
		if i > j {
			i, j = j, i
		}
		if silaDuvodu[duvod] > silaDuvodu[duvodDvojice[[2]int{i, j}]] {
			duvodDvojice[[2]int{i, j}] = duvod
		}
		if ri, rj := rodic.koren(i), rodic.koren(j); ri != rj {
			rodic[ri] = rj
		}
	}

	// Otisky: každý soubor s každým (popcount je levný i pro desítky tisíc souborů)
	otisky := a.otiskySouboru()
	sOtiskem := make([]int, 0, len(soubory))
	hodnoty := make([]otisk, 0, len(soubory))
	for i, id := range soubory {
		if x, ok := otisky[id]; ok {
			sOtiskem = append(sOtiskem, i)
			hodnoty = append(hodnoty, x)
		}
	}
	for x := 0; x < len(sOtiskem); x++ {
		for y := x + 1; y < len(sOtiskem); y++ {
			if d := shodaOtisku(hodnoty[x], hodnoty[y]); d != "" {
				spojit(sOtiskem[x], sOtiskem[y], d)
			}
		}
	}

	// Vektory obsahu: fotky téže modelky každá s každou
	if a.obsah.Zapnuto() {
		for _, seznam := range modelkySouboru {
			if len(seznam) < 2 || len(seznam) > nejviceFotekNaObsah {
				continue
			}
			// Vektory fotek modelky jednou (ProjitObsah dává sdílený buffer, proto kopie), pak skalární součiny
			ids := make([]string, len(seznam))
			for k, i := range seznam {
				ids[k] = soubory[i]
			}
			vektory := map[string][]float32{}
			a.obsah.ProjitObsah(ids, func(id string, vektor, _ []float32) {
				if vektor != nil {
					vektory[id] = append([]float32(nil), vektor...)
				}
			})
			for x := 0; x < len(seznam); x++ {
				vx := vektory[soubory[seznam[x]]]
				if vx == nil {
					continue
				}
				for y := x + 1; y < len(seznam); y++ {
					vy := vektory[soubory[seznam[y]]]
					if vy == nil {
						continue
					}
					var soucin float32
					for k := range vx {
						soucin += vx[k] * vy[k]
					}
					if float64(soucin) >= prahObsahuStejne {
						spojit(seznam[x], seznam[y], "obsah")
					}
				}
			}
		}
	}

	// Skupiny podle kořene
	clenove := map[int][]int{}
	for i := range soubory {
		r := rodic.koren(i)
		clenove[r] = append(clenove[r], i)
	}
	tagu := a.poctyTaguFotek()
	for _, cl := range clenove {
		if len(cl) < 2 {
			continue
		}
		sort.Ints(cl)
		duvod := ""
		for x := 0; x < len(cl); x++ {
			for y := x + 1; y < len(cl); y++ {
				if d := duvodDvojice[[2]int{cl[x], cl[y]}]; silaDuvodu[d] > silaDuvodu[duvod] {
					duvod = d
				}
			}
		}
		sk := SkupinaStejnych{Duvod: duvod}
		ids := make([]string, len(cl))
		for k, i := range cl {
			id := soubory[i]
			ids[k] = id
			s := SouborStejnych{DriveID: id, Fotky: mista[id]}
			for _, f := range s.Fotky {
				s.Tagu += tagu[f.ID]
			}
			sk.Soubory = append(sk.Soubory, s)
		}
		sk.Klic = strings.Join(ids, "|")
		sk.Soubory[navrhPonechat(sk.Soubory)].Ponechat = true
		skupiny = append(skupiny, sk)
	}
	sort.SliceStable(skupiny, func(i, j int) bool {
		fi, fj := skupiny[i].Soubory[0].Fotky[0], skupiny[j].Soubory[0].Fotky[0]
		if c := porovnatBezDiakritiky(fi.JmenoModelky, fj.JmenoModelky); c != 0 {
			return c < 0
		}
		if fi.Album != fj.Album {
			return fi.Album < fj.Album
		}
		return skupiny[i].Klic < skupiny[j].Klic
	})
	return skupiny
}

// Který soubor nechat: víc srdíček, víc tagů, víc míst ve sbírce, dřív vložený
func navrhPonechat(soubory []SouborStejnych) int {
	nejlepsi := 0
	hodnota := func(s SouborStejnych) (int, int, int, int) {
		srdicka, prvni := 0, 1<<62
		for _, f := range s.Fotky {
			srdicka = max(srdicka, f.Hodnoceni)
			prvni = min(prvni, f.ID)
		}
		return srdicka, s.Tagu, len(s.Fotky), -prvni
	}
	for i := 1; i < len(soubory); i++ {
		a1, a2, a3, a4 := hodnota(soubory[i])
		b1, b2, b3, b4 := hodnota(soubory[nejlepsi])
		if a1 > b1 || a1 == b1 && (a2 > b2 || a2 == b2 && (a3 > b3 || a3 == b3 && a4 > b4)) {
			nejlepsi = i
		}
	}
	return nejlepsi
}

func (a *App) poctyTaguFotek() map[int]int {
	m := map[int]int{}
	rows, err := a.db.Query(`SELECT fotka_id, COUNT(*) FROM fotky_tagy GROUP BY fotka_id`)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var id, n int
		if rows.Scan(&id, &n) == nil {
			m[id] = n
		}
	}
	return m
}

// ——— Sloučení a jeho vrácení ———

type NahrazeniSouboru struct {
	FotkaID int    `json:"fotkaId"`
	Puvodni string `json:"puvodni"`
}

type ZmenaHodnoceniFotky struct {
	FotkaID int `json:"fotkaId"`
	Puvodni int `json:"puvodni"`
}

type TagSlouceni struct {
	FotkaID int    `json:"fotkaId"`
	Tag     string `json:"tag"`
}

// Tagy odebrané fotky (vrátí se po ObnovitFotky; fotku najde album a soubor)
type TagyOdebraneFotky struct {
	ModelkaID int      `json:"modelkaId"`
	Album     string   `json:"album"`
	Typ       string   `json:"typ"`
	DriveID   string   `json:"driveId"`
	Tagy      []string `json:"tagy"`
}

// SlouceniStejnych: co sloučení změnilo (pro Vrátit)
type SlouceniStejnych struct {
	Nahrazeno      []NahrazeniSouboru    `json:"nahrazeno"`
	Hodnoceni      []ZmenaHodnoceniFotky `json:"hodnoceni"`
	PridaneTagy    []TagSlouceni         `json:"pridaneTagy"`
	Odebrano       []ObnovaFotky         `json:"odebrano"`
	TagyOdebranych []TagyOdebraneFotky   `json:"tagyOdebranych"`
	Chyba          bool                  `json:"chyba"`
}

func tagyFotky(q interface {
	Query(string, ...interface{}) (*sql.Rows, error)
}, id int) []string {
	tagy := []string{}
	rows, err := q.Query(`SELECT tag FROM fotky_tagy WHERE fotka_id = ? ORDER BY tag`, id)
	if err != nil {
		return tagy
	}
	defer rows.Close()
	for rows.Next() {
		var t string
		if rows.Scan(&t) == nil {
			tagy = append(tagy, t)
		}
	}
	return tagy
}

// SloucitStejneFotky: soubory odebrat se ve sbírce nahradí souborem ponechat (se zálohou předem)
func (a *App) SloucitStejneFotky(ponechat string, odebrat []string) SlouceniStejnych {
	v := SlouceniStejnych{Nahrazeno: []NahrazeniSouboru{}, Hodnoceni: []ZmenaHodnoceniFotky{}, PridaneTagy: []TagSlouceni{},
		Odebrano: []ObnovaFotky{}, TagyOdebranych: []TagyOdebraneFotky{}}
	selhalo := func(err error) SlouceniStejnych {
		a.chyba("sloučení stejných fotek", err)
		return SlouceniStejnych{Chyba: true}
	}
	if !jeHoleID(ponechat) || len(odebrat) == 0 {
		return SlouceniStejnych{Chyba: true}
	}
	if err := a.zalohovat("pred-sloucenim-stejnych-fotek"); err != nil {
		return selhalo(err)
	}
	// Místa odebíraných souborů (fotka, album, srdíčka, soubor)
	type misto struct {
		id, album, hodnoceni int
		soubor               string
	}
	var mista []misto
	for _, id := range odebrat {
		if id == ponechat {
			continue
		}
		rows, err := a.db.Query(`SELECT id, album_id, COALESCE(hodnoceni, 0) FROM fotky WHERE drive_file_id = ? ORDER BY id`, id)
		if err != nil {
			return selhalo(err)
		}
		for rows.Next() {
			m := misto{soubor: id}
			if rows.Scan(&m.id, &m.album, &m.hodnoceni) == nil {
				mista = append(mista, m)
			}
		}
		rows.Close()
	}
	// Plán napřed: v albu, kde ponechaný soubor je (od začátku, nebo po záměně dřívější kopie), se kopie odebere,
	// jinde se vymění. Údaje pro Vrátit u odebíraných se čtou teď, mimo transakci.
	sPonechanym := map[int]bool{}
	if rows, err := a.db.Query(`SELECT DISTINCT album_id FROM fotky WHERE drive_file_id = ?`, ponechat); err == nil {
		for rows.Next() {
			var album int
			if rows.Scan(&album) == nil {
				sPonechanym[album] = true
			}
		}
		rows.Close()
	} else {
		return selhalo(err)
	}
	odebratMisto := make([]bool, len(mista))
	obnovy := make([]ObnovaFotky, len(mista))
	for k, m := range mista {
		if sPonechanym[m.album] {
			o, ok := a.obnovaFotky(m.id)
			if !ok {
				continue
			}
			odebratMisto[k], obnovy[k] = true, o
		} else {
			sPonechanym[m.album] = true
		}
	}

	tx, err := a.db.Begin()
	if err != nil {
		return selhalo(err)
	}
	defer tx.Rollback()
	var smazat []int
	for k, m := range mista {
		if !odebratMisto[k] {
			// V albu ponechaný soubor není: kopie se jen vymění, album o fotku nepřijde (srdíčka, tagy a pořadí zůstanou)
			if _, err := tx.Exec(`UPDATE fotky SET drive_file_id = ? WHERE id = ?`, ponechat, m.id); err != nil {
				return selhalo(err)
			}
			v.Nahrazeno = append(v.Nahrazeno, NahrazeniSouboru{FotkaID: m.id, Puvodni: m.soubor})
			continue
		}
		var ponechana, hodnoceni int
		if err := tx.QueryRow(`SELECT id, COALESCE(hodnoceni, 0) FROM fotky WHERE album_id = ? AND drive_file_id = ?`, m.album, ponechat).Scan(&ponechana, &hodnoceni); err != nil {
			return selhalo(err)
		}
		// V albu už je: kopie se odebere, srdíčka a tagy přejdou na ponechanou fotku
		if m.hodnoceni > hodnoceni {
			if _, err := tx.Exec(`UPDATE fotky SET hodnoceni = ? WHERE id = ?`, m.hodnoceni, ponechana); err != nil {
				return selhalo(err)
			}
			v.Hodnoceni = append(v.Hodnoceni, ZmenaHodnoceniFotky{FotkaID: ponechana, Puvodni: hodnoceni})
		}
		maTagy := map[string]bool{}
		for _, t := range tagyFotky(tx, ponechana) {
			maTagy[t] = true
		}
		tagyKopie := tagyFotky(tx, m.id)
		for _, t := range tagyKopie {
			if !maTagy[t] {
				if _, err := tx.Exec(`INSERT OR IGNORE INTO fotky_tagy (fotka_id, tag) VALUES (?, ?)`, ponechana, t); err != nil {
					return selhalo(err)
				}
				v.PridaneTagy = append(v.PridaneTagy, TagSlouceni{FotkaID: ponechana, Tag: t})
			}
		}
		o := obnovy[k]
		v.Odebrano = append(v.Odebrano, o)
		if len(tagyKopie) > 0 {
			v.TagyOdebranych = append(v.TagyOdebranych, TagyOdebraneFotky{ModelkaID: o.ModelkaID, Album: o.Album, Typ: o.Typ, DriveID: o.DriveID, Tagy: tagyKopie})
		}
		smazat = append(smazat, m.id)
	}
	for _, id := range smazat {
		if _, err := tx.Exec(`DELETE FROM fotky WHERE id = ?`, id); err != nil {
			return selhalo(err)
		}
	}
	if _, err := tx.Exec(smazatPrazdnaAlba); err != nil {
		return selhalo(err)
	}
	if err := tx.Commit(); err != nil {
		return selhalo(err)
	}
	return v
}

// VratitSlouceniStejnych: vrátí sloučení (záměny souborů, srdíčka, tagy a odebrané fotky i s jejich tagy)
func (a *App) VratitSlouceniStejnych(s SlouceniStejnych) bool {
	tx, err := a.db.Begin()
	if err != nil {
		a.chyba("vrácení sloučení stejných fotek", err)
		return false
	}
	defer tx.Rollback()
	for _, n := range s.Nahrazeno {
		if !jeHoleID(n.Puvodni) {
			continue
		}
		if _, err := tx.Exec(`UPDATE fotky SET drive_file_id = ? WHERE id = ?`, n.Puvodni, n.FotkaID); err != nil {
			a.chyba("vrácení sloučení stejných fotek", err)
			return false
		}
	}
	for _, h := range s.Hodnoceni {
		tx.Exec(`UPDATE fotky SET hodnoceni = ? WHERE id = ?`, h.Puvodni, h.FotkaID)
	}
	for _, t := range s.PridaneTagy {
		tx.Exec(`DELETE FROM fotky_tagy WHERE fotka_id = ? AND tag = ?`, t.FotkaID, t.Tag)
	}
	if err := tx.Commit(); err != nil {
		a.chyba("vrácení sloučení stejných fotek", err)
		return false
	}
	a.ObnovitFotky(s.Odebrano)
	for _, t := range s.TagyOdebranych {
		var id int
		if a.db.QueryRow(`SELECT id FROM fotografie WHERE modelka_id = ? AND album = ? AND typ = ? AND drive_file_id = ?`,
			t.ModelkaID, t.Album, t.Typ, t.DriveID).Scan(&id) != nil {
			continue
		}
		for _, tag := range t.Tagy {
			a.db.Exec(`INSERT OR IGNORE INTO fotky_tagy (fotka_id, tag) VALUES (?, ?)`, id, tag)
		}
	}
	return true
}

// ——— Kontrola nově vložených fotek ———

// NalezStejne: nově vložený soubor vypadá jako fotka, která už ve sbírce je
type NalezStejne struct {
	DriveID    string     `json:"driveId"`
	Existujici Fotografie `json:"existujici"`
}

// ZkontrolovatNoveFotky: otisky nově vložených souborů (z odkazů, jak se vkládaly) proti otiskům ostatních
// souborů sbírky; náhledy se stáhnou hned (je to akce uživatele), nejvýš na půl minuty
func (a *App) ZkontrolovatNoveFotky(rawLinks string) []NalezStejne {
	nalezy := []NalezStejne{}
	nove := parseDriveIDs(rawLinks)
	if len(nove) == 0 {
		return nalezy
	}
	jeNovy := map[string]bool{}
	for _, id := range nove {
		jeNovy[id] = true
	}
	ctx, zrusit := context.WithTimeout(context.Background(), 30*time.Second)
	defer zrusit()
	otiskyNovych := map[string]otisk{}
	for _, id := range nove {
		if x, ok := a.otiskSouboru(ctx, id); ok {
			otiskyNovych[id] = x
		}
	}
	if len(otiskyNovych) == 0 {
		return nalezy
	}
	ruzne := a.ruzneFotky()
	shody := map[string]string{} // nový soubor → existující
	for id, ostatni := range a.otiskySouboru() {
		if jeNovy[id] {
			continue
		}
		for novy, x := range otiskyNovych {
			if _, uz := shody[novy]; uz || ruzne[klicStejnych(novy, id)] {
				continue
			}
			if d := shodaOtisku(x, ostatni); d == "stejna" || d == "temer" {
				shody[novy] = id
			}
		}
	}
	for _, novy := range nove {
		existujici, ok := shody[novy]
		if !ok {
			continue
		}
		f := a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
			LEFT JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
			WHERE f.drive_file_id = ? ORDER BY f.id LIMIT 1`, true, true, existujici)
		if len(f) > 0 {
			nalezy = append(nalezy, NalezStejne{DriveID: novy, Existujici: f[0]})
		}
	}
	return nalezy
}
