package main

// Vizuální důvody pro kandidáty na sloučení (0.02.030): podobnost středů fotek obou modelek (CLIP, jako Podobné
// modelky v profilu) a stejná nebo skoro stejná fotka u obou (otisky, jako Údržba › Stejné fotky). Jen důvod
// a pořadí kandidátů – kandidátem se dvojice stává dál jen podle jména a data narození (internal/kontrola).

import (
	"fmt"
	"math"

	"pinup-katalog/internal/hledani"
)

// Kosinová podobnost středů, od které je „podobné fotky“ důvodem
const prahObsahuSlouceni = 0.85

// Soubory fotek (ID na Disku) každé modelky včetně sdílených alb
func (a *App) souboryModelek() map[int][]string {
	modelkyAlba := map[int][]int{}
	if rows, err := a.db.Query(`SELECT id, COALESCE(modelka_id, 0) FROM alba UNION ALL SELECT album_id, modelka_id FROM alba_modelky`); err == nil {
		for rows.Next() {
			var album, modelka int
			if rows.Scan(&album, &modelka) == nil && modelka > 0 {
				modelkyAlba[album] = append(modelkyAlba[album], modelka)
			}
		}
		rows.Close()
	}
	v := map[int][]string{}
	if rows, err := a.db.Query(`SELECT album_id, drive_file_id FROM fotky WHERE COALESCE(drive_file_id, '') <> ''`); err == nil {
		for rows.Next() {
			var album int
			var soubor string
			if rows.Scan(&album, &soubor) != nil {
				continue
			}
			for _, m := range modelkyAlba[album] {
				v[m] = append(v[m], soubor)
			}
		}
		rows.Close()
	}
	return v
}

// vizualniDuvodySlouceni: funkce pro kontrola.KontrolovatSlouceni; spočítá podklady jednou za kontrolu
func (a *App) vizualniDuvodySlouceni() func(x, y hledani.Modelka) ([]string, float64) {
	stredy, _ := a.stredyModelek()
	otisky := a.otiskySouboru()
	soubory := a.souboryModelek()
	return func(x, y hledani.Modelka) ([]string, float64) {
		var duvody []string
		skore := 0.0
		if sx, sy := stredy[x.ID], stredy[y.ID]; sx.vektor != nil && sy.vektor != nil {
			var cos float64
			for k, h := range sx.vektor {
				cos += float64(h) * float64(sy.vektor[k])
			}
			skore += cos
			if cos >= prahObsahuSlouceni {
				duvody = append(duvody, fmt.Sprintf("podobné fotky (%d %%)", int(math.Round(cos*100))))
			}
		}
		nejlepsi := ""
		for _, fx := range soubory[x.ID] {
			ox, okx := otisky[fx]
			for _, fy := range soubory[y.ID] {
				if fx == fy {
					nejlepsi = "stejna"
					break
				}
				if oy, oky := otisky[fy]; okx && oky {
					if d := shodaOtisku(ox, oy); silaDuvodu[d] > silaDuvodu[nejlepsi] {
						nejlepsi = d
					}
				}
			}
			if nejlepsi == "stejna" {
				break
			}
		}
		switch nejlepsi {
		case "stejna":
			duvody, skore = append(duvody, "stejná fotka u obou"), skore+1
		case "temer":
			duvody, skore = append(duvody, "skoro stejná fotka u obou"), skore+0.5
		}
		return duvody, skore
	}
}
