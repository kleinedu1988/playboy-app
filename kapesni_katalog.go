package main

// Kapesní katalog offline (ROADMAP 1.47): sbírka v telefonu bez připojení – co mám, co sháním, kdo je v kterém čísle.
// Backend dá okně podklady čísel (první fotka obálky / centerfoldu / pictorialu, jména podle typu alba, stav
// výtisku), spočítá, kolik náhledů w400 je v mezipaměti, a uloží katalog do nové složky: index.html, který okno
// složí (frontend/src/lib/kapesni-katalog.js), a vedle něj náhledy n/<id>.jpg zkopírované z mezipaměti. Plné fotky
// se nekopírují a nic se nestahuje; náhled, který v mezipaměti není, katalog nahradí prázdným rámečkem.

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pinup-katalog/internal/nahledy"
)

const velikostNahleduKatalogu = "w400"

type PodkladCisla struct {
	Vydani   string   `json:"vydani"`
	DriveID  string   `json:"driveId"` // první fotka obálky, jinak centerfoldu, jinak pictorialu
	Playmate []string `json:"playmate"`
	Obalka   []string `json:"obalka"`
	Dalsi    []string `json:"dalsi"`
	Stav     string   `json:"stav"` // mam / shanim / nezajima / ""
	Nazev    string   `json:"nazev"`
	NaObalce string   `json:"naObalce"`
}

type NahledyKatalogu struct {
	Ulozenych int   `json:"ulozenych"`
	Chybi     int   `json:"chybi"`
	Bajtu     int64 `json:"bajtu"`
}

type VysledekKatalogu struct {
	Slozka  string `json:"slozka"` // prázdné = zrušeno nebo chyba
	Nahledu int    `json:"nahledu"`
	Chybi   int    `json:"chybi"`
	Bajtu   int64  `json:"bajtu"`
	Chyba   string `json:"chyba"`
}

func pridatJmeno(seznam []string, jmeno string) []string {
	if jmeno == "" {
		return seznam
	}
	for _, j := range seznam {
		if j == jmeno {
			return seznam
		}
	}
	return append(seznam, jmeno)
}

func (a *App) GetPodkladyKatalogu() []PodkladCisla {
	v := []PodkladCisla{}
	podle := map[string]*PodkladCisla{}
	cislo := func(vydani string) *PodkladCisla {
		if p := podle[vydani]; p != nil {
			return p
		}
		p := &PodkladCisla{Vydani: vydani, Playmate: []string{}, Obalka: []string{}, Dalsi: []string{}}
		podle[vydani] = p
		return p
	}
	radky, err := a.db.Query(`SELECT al.vydani, al.typ, COALESCE(f.drive_file_id, ''), COALESCE(m.jmeno, '')
		FROM alba al
		LEFT JOIN fotky f ON f.id = (SELECT MIN(id) FROM fotky WHERE album_id = al.id AND nedostupne_od IS NULL)
		LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE al.vydani <> '' ORDER BY al.vydani, al.id`)
	if err != nil {
		a.chyba("podklady katalogu", err)
		return v
	}
	priorita := map[string]int{}
	for radky.Next() {
		var vydani, typ, drive, jmeno string
		if radky.Scan(&vydani, &typ, &drive, &jmeno) != nil {
			continue
		}
		p := cislo(vydani)
		poradi := 3
		switch typ {
		case "Cover":
			poradi = 1
			p.Obalka = pridatJmeno(p.Obalka, jmeno)
		case "Centerfold":
			poradi = 2
			p.Playmate = pridatJmeno(p.Playmate, jmeno)
		default:
			p.Dalsi = pridatJmeno(p.Dalsi, jmeno)
		}
		if drive != "" && (p.DriveID == "" || poradi < priorita[vydani]) {
			p.DriveID, priorita[vydani] = drive, poradi
		}
	}
	radky.Close()
	jmena := map[int]string{}
	if r, err := a.db.Query(`SELECT id, jmeno FROM modelky`); err == nil {
		for r.Next() {
			var id int
			var jmeno string
			if r.Scan(&id, &jmeno) == nil {
				jmena[id] = jmeno
			}
		}
		r.Close()
	}
	for _, s := range a.GetStavyVydani() {
		p := cislo(s.Vydani)
		p.Stav, p.Nazev, p.NaObalce = s.Stav, s.Nazev, s.NaObalce
		p.Obalka = pridatJmeno(p.Obalka, jmena[s.ModelkaObalky])
	}
	for _, p := range podle {
		v = append(v, *p)
	}
	sort.Slice(v, func(i, j int) bool { return v[i].Vydani < v[j].Vydani })
	return v
}

// Kolik náhledů katalogu je v mezipaměti a kolik zaberou (odhad velikosti před uložením)
func (a *App) GetNahledyKatalogu(ids []string) NahledyKatalogu {
	var n NahledyKatalogu
	for _, id := range unikatni(ids) {
		if info, ok := a.nahledKatalogu(id); ok {
			n.Ulozenych++
			n.Bajtu += info.Size()
		} else {
			n.Chybi++
		}
	}
	return n
}

func unikatni(ids []string) []string {
	videno := make(map[string]bool, len(ids))
	v := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != "" && !videno[id] {
			videno[id] = true
			v = append(v, id)
		}
	}
	return v
}

func (a *App) nahledKatalogu(id string) (os.FileInfo, bool) {
	if a.nahledy == nil || !nahledy.JeHoleID(id) {
		return nil, false
	}
	info, err := os.Stat(a.nahledy.Cesta(id, velikostNahleduKatalogu))
	return info, err == nil && info.Mode().IsRegular() && info.Size() > 0
}

// Uloží katalog do nové složky ve zvoleném umístění; dialog vybere, kam
func (a *App) UlozitKatalog(html string, ids []string) VysledekKatalogu {
	kam, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Kam uložit kapesní katalog", CanCreateDirectories: true})
	if err != nil {
		a.chyba("kapesní katalog", err)
		return VysledekKatalogu{Chyba: err.Error()}
	}
	if kam == "" {
		return VysledekKatalogu{}
	}
	return a.zapsatKatalog(kam, html, ids, time.Now())
}

func (a *App) zapsatKatalog(kam, html string, ids []string, ted time.Time) VysledekKatalogu {
	if html == "" {
		return VysledekKatalogu{Chyba: "katalog je prázdný"}
	}
	zaklad := filepath.Join(kam, "kapesni-katalog-"+ted.Format("2006-01-02"))
	slozka := zaklad
	// Starší katalog stejného dne se nepřepíše: nová složka s pořadím
	for i := 2; ; i++ {
		if _, err := os.Stat(slozka); errors.Is(err, os.ErrNotExist) {
			break
		}
		slozka = zaklad + "-" + strconv.Itoa(i)
	}
	v := VysledekKatalogu{}
	if err := os.MkdirAll(filepath.Join(slozka, "n"), 0o755); err != nil {
		v.Chyba = err.Error()
		return v
	}
	for _, id := range unikatni(ids) {
		info, ok := a.nahledKatalogu(id)
		if !ok || kopirovatSoubor(a.nahledy.Cesta(id, velikostNahleduKatalogu), filepath.Join(slozka, "n", id+".jpg")) != nil {
			v.Chybi++
			continue
		}
		v.Nahledu++
		v.Bajtu += info.Size()
	}
	if err := os.WriteFile(filepath.Join(slozka, "index.html"), []byte(html), 0o644); err != nil {
		v.Chyba = err.Error()
		return v
	}
	v.Bajtu += int64(len(html))
	v.Slozka = slozka
	return v
}
