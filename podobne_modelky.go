package main

// Podobné modelky z obsahu sbírky (profil › Podobné modelky, frontend/src/lib/mapa-sbirky.js): vizuální příbuznost
// z fotek a společní fotografové. Vizuální příbuznost je kosinová podobnost středů vektorů obsahu (CLIP, internal/obsah)
// fotek obou modelek; střed se počítá jen z fotek, které vektor už mají, a jen u modelky s aspoň minFotekStredu
// takovými fotkami (méně fotek dává střed, který víc říká o jednom focení než o modelce). Fotky sdíleného alba
// (alba_modelky) se počítají všem jeho modelkám. Středy se drží v paměti, dokud se nezmění fotky ani počet vektorů.

import (
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"

	"pinup-katalog/internal/obsah"
)

const minFotekStredu = 3

// PodobnostObsahu: k jedné modelce podobnost středu fotek s ostatními modelkami (id → kosinová podobnost, jen
// modelky s dost fotkami s vektorem) a společní fotografové (id → jména, jak jsou zapsaná u alb dané modelky)
type PodobnostObsahu struct {
	Fotek       int              `json:"fotek"` // kolik fotek modelky má vektor (0 = vizuální podobnost nejde spočítat)
	NaFotkach   map[int]float64  `json:"naFotkach"`
	Fotografove map[int][]string `json:"fotografove"`
}

type stredModelky struct {
	vektor []float32
	fotek  int
}

var pametStredu struct {
	sync.Mutex
	app         *App // pro kterou aplikaci (databázi) jsou středy spočítané
	otisk       string
	stredy      map[int]stredModelky
	fotografove map[int]map[string]string // modelka → zjednodušené jméno → jméno, jak je zapsané
}

// Jména fotografů alba („A, B“, „A & B“, „A / B“) jednotlivě
func rozdelitFotografy(text string) []string {
	casti := strings.FieldsFunc(text, func(r rune) bool { return r == ',' || r == '&' || r == '/' || r == ';' })
	jmena := make([]string, 0, len(casti))
	for _, c := range casti {
		if c = strings.TrimSpace(c); c != "" {
			jmena = append(jmena, c)
		}
	}
	return jmena
}

// Otisk dat, ze kterých jsou středy: fotky a jejich alba, sdílená alba, fotografové (délka a FNV-1a otisk jejich
// zápisu) a počet vektorů obsahu
func (a *App) otiskStredu() string {
	var fotek, maxFotka, sdilenych, alb int
	var fotografove string
	a.db.QueryRow(`SELECT COUNT(*), COALESCE(MAX(id), 0) FROM fotky`).Scan(&fotek, &maxFotka)
	a.db.QueryRow(`SELECT COUNT(*) FROM alba_modelky`).Scan(&sdilenych)
	a.db.QueryRow(`SELECT COUNT(*), COALESCE(GROUP_CONCAT(COALESCE(fotograf, ''), '|'), '') FROM alba`).Scan(&alb, &fotografove)
	st := a.obsah.Stav()
	casti := []int{fotek, maxFotka, sdilenych, alb, st.Vektoru, st.Hotovo, len(fotografove), int(hashRetezce(fotografove))}
	texty := make([]string, len(casti))
	for i, n := range casti {
		texty[i] = strconv.Itoa(n)
	}
	return strings.Join(texty, ":")
}

func hashRetezce(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}

// Spočítá (nebo vrátí z paměti) středy fotek a fotografy všech modelek
func (a *App) stredyModelek() (map[int]stredModelky, map[int]map[string]string) {
	otisk := a.otiskStredu()
	pametStredu.Lock()
	defer pametStredu.Unlock()
	if pametStredu.stredy != nil && pametStredu.app == a && pametStredu.otisk == otisk {
		return pametStredu.stredy, pametStredu.fotografove
	}

	// Album → modelky (vlastní modelka alba a modelky sdíleného alba), album → fotografové
	modelkyAlba := map[int][]int{}
	fotografove := map[int]map[string]string{}
	pridatFotografa := func(modelka int, jmeno string) {
		if fotografove[modelka] == nil {
			fotografove[modelka] = map[string]string{}
		}
		klic := zjednodusit(jmeno)
		if _, uz := fotografove[modelka][klic]; !uz {
			fotografove[modelka][klic] = jmeno
		}
	}
	fotografoveAlba := map[int][]string{}
	if rows, err := a.db.Query(`SELECT id, COALESCE(modelka_id, 0), TRIM(COALESCE(fotograf, '')) FROM alba`); err == nil {
		for rows.Next() {
			var id, modelka int
			var fotograf string
			if rows.Scan(&id, &modelka, &fotograf) != nil {
				continue
			}
			if modelka > 0 {
				modelkyAlba[id] = append(modelkyAlba[id], modelka)
			}
			if fotograf != "" {
				fotografoveAlba[id] = rozdelitFotografy(fotograf)
			}
		}
		rows.Close()
	} else {
		a.chyba("načtení alb pro podobné modelky", err)
	}
	if rows, err := a.db.Query(`SELECT album_id, modelka_id FROM alba_modelky`); err == nil {
		for rows.Next() {
			var album, modelka int
			if rows.Scan(&album, &modelka) == nil && modelka > 0 {
				modelkyAlba[album] = append(modelkyAlba[album], modelka)
			}
		}
		rows.Close()
	}
	for album, jmena := range fotografoveAlba {
		for _, m := range modelkyAlba[album] {
			for _, j := range jmena {
				pridatFotografa(m, j)
			}
		}
	}

	// Soubor fotky → modelky (soubor ve víc albech téže modelky se počítá jednou)
	modelkySouboru := map[string][]int{}
	if rows, err := a.db.Query(`SELECT album_id, drive_file_id FROM fotky WHERE COALESCE(drive_file_id, '') <> ''`); err == nil {
		for rows.Next() {
			var album int
			var soubor string
			if rows.Scan(&album, &soubor) != nil {
				continue
			}
			for _, m := range modelkyAlba[album] {
				uz := false
				for _, x := range modelkySouboru[soubor] {
					if x == m {
						uz = true
						break
					}
				}
				if !uz {
					modelkySouboru[soubor] = append(modelkySouboru[soubor], m)
				}
			}
		}
		rows.Close()
	} else {
		a.chyba("načtení fotek pro podobné modelky", err)
	}

	soubory := make([]string, 0, len(modelkySouboru))
	for s := range modelkySouboru {
		soubory = append(soubory, s)
	}
	sort.Strings(soubory)
	soucty := map[int][]float64{}
	pocty := map[int]int{}
	a.obsah.ProjitObsah(soubory, func(id string, vektor, _ []float32) {
		if vektor == nil {
			return
		}
		for _, m := range modelkySouboru[id] {
			s := soucty[m]
			if s == nil {
				s = make([]float64, obsah.Rozmer)
				soucty[m] = s
			}
			for k, x := range vektor {
				s[k] += float64(x)
			}
			pocty[m]++
		}
	})
	stredy := make(map[int]stredModelky, len(soucty))
	for m, s := range soucty {
		if pocty[m] < minFotekStredu {
			stredy[m] = stredModelky{fotek: pocty[m]}
			continue
		}
		var norma float64
		for _, x := range s {
			norma += x * x
		}
		norma = math.Sqrt(norma)
		if norma == 0 {
			continue
		}
		v := make([]float32, len(s))
		for k, x := range s {
			v[k] = float32(x / norma)
		}
		stredy[m] = stredModelky{vektor: v, fotek: pocty[m]}
	}
	pametStredu.app, pametStredu.otisk, pametStredu.stredy, pametStredu.fotografove = a, otisk, stredy, fotografove
	return stredy, fotografove
}

// GetPodobnostObsahu: vizuální příbuznost modelky s ostatními (z fotek) a společní fotografové
func (a *App) GetPodobnostObsahu(modelkaID int) PodobnostObsahu {
	v := PodobnostObsahu{NaFotkach: map[int]float64{}, Fotografove: map[int][]string{}}
	stredy, fotografove := a.stredyModelek()
	if moje, ok := stredy[modelkaID]; ok {
		v.Fotek = moje.fotek
		if moje.vektor != nil {
			for id, s := range stredy {
				if id == modelkaID || s.vektor == nil {
					continue
				}
				var soucin float64
				for k, x := range moje.vektor {
					soucin += float64(x) * float64(s.vektor[k])
				}
				v.NaFotkach[id] = math.Round(soucin*10000) / 10000
			}
		}
	}
	if moji := fotografove[modelkaID]; len(moji) > 0 {
		for id, jejich := range fotografove {
			if id == modelkaID {
				continue
			}
			spolecni := []string{}
			for klic, jmeno := range moji {
				if _, ok := jejich[klic]; ok {
					spolecni = append(spolecni, jmeno)
				}
			}
			if len(spolecni) > 0 {
				sort.Strings(spolecni)
				v.Fotografove[id] = spolecni
			}
		}
	}
	return v
}
