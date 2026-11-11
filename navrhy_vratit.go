package main

import (
	"strconv"
	"strings"
)

// Vrácení hromadně přijatých návrhů (0.02.039, tlačítko Vrátit v oznámení): návrhy vyplňují jen prázdné údaje,
// vrácení tedy údaj zase vyprázdní – ale jen pokud v něm pořád je přijatá hodnota (mezitím upravený se nechá).
// Typ alba se vrátí na původní (Pictorial). Vrací počet vrácených.
func (a *App) VratitNavrhy(navrhy []NavrhDoplneni) int {
	// Album, kterému návrh změnil typ, má ostatní údaje už pod novým typem; typ se vrací až nakonec
	type klicAlba struct {
		modelka    int
		album, typ string
	}
	novyTyp := map[klicAlba]string{}
	poradi := make([]NavrhDoplneni, 0, len(navrhy))
	var typy []NavrhDoplneni
	for _, n := range navrhy {
		if n.Pole == "typAlba" {
			novyTyp[klicAlba{n.ModelkaID, n.Album, n.Typ}] = strings.TrimSpace(n.Hodnota)
			typy = append(typy, n)
		} else {
			poradi = append(poradi, n)
		}
	}
	for i, n := range poradi {
		if t, ok := novyTyp[klicAlba{n.ModelkaID, n.Album, n.Typ}]; ok && n.Album != "" {
			poradi[i].Typ = t
		}
	}
	poradi = append(poradi, typy...)
	vraceno := 0
	a.vTransakci("vrácení návrhů", func(q dotazovac) error {
		vraceno = 0
		for _, n := range poradi {
			ok, err := vratitNavrh(q, n)
			if err != nil {
				return err
			}
			if ok {
				vraceno++
			}
		}
		return nil
	})
	return vraceno
}

func vratitNavrh(q dotazovac, n NavrhDoplneni) (bool, error) {
	u, ok := udajeNavrhu[n.Pole]
	hodnota := strings.TrimSpace(n.Hodnota)
	if !ok || hodnota == "" || u.Album != (n.Album != "") {
		return false, nil
	}
	zapsano := func(q dotazovac, sql string, args ...any) (bool, error) {
		v, err := q.Exec(sql, args...)
		if err != nil {
			return false, err
		}
		pocet, err := v.RowsAffected()
		return pocet > 0, err
	}
	if u.Album {
		switch n.Pole {
		case "typAlba":
			// Album má teď typ z návrhu; zpět na původní, jen když tím nevznikne dvojí album
			return zapsano(q, `UPDATE alba SET typ = ? WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND NOT EXISTS
				(SELECT 1 FROM alba b WHERE COALESCE(b.modelka_id, 0) = ? AND b.album = ? AND b.typ = ?)`,
				n.Typ, n.ModelkaID, n.Album, hodnota, n.ModelkaID, n.Album, n.Typ)
		case "vydaniAlba":
			return zapsano(q, "UPDATE alba SET vydani = '' WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND vydani = ?", n.ModelkaID, n.Album, n.Typ, hodnota)
		case "datumAlba":
			return zapsano(q, "UPDATE alba SET datum = '' WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND datum = ?", n.ModelkaID, n.Album, n.Typ, hodnota)
		default:
			return zapsano(q, "UPDATE alba SET "+u.Sloupec+" = '' WHERE COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ? AND "+u.Sloupec+" = ?", n.ModelkaID, n.Album, n.Typ, hodnota)
		}
	}
	if u.Cislo {
		cislo, err := strconv.Atoi(hodnota)
		if err != nil {
			return false, nil
		}
		// Míry složené při přijetí z obvodů se s obvodem zase vyprázdní
		if _, err := q.Exec(`UPDATE modelky SET miry = '' WHERE id = ? AND `+u.Sloupec+` = ? AND
			miry = obvod_hrudnik_cm || '-' || obvod_pas_cm || '-' || obvod_boky_cm`, n.ModelkaID, cislo); err != nil {
			return false, err
		}
		return zapsano(q, "UPDATE modelky SET "+u.Sloupec+" = 0 WHERE id = ? AND "+u.Sloupec+" = ?", n.ModelkaID, cislo)
	}
	if n.Pole == "role" {
		return false, nil // kategorie se k Roli přidávala (do 0.02.038); vrací se ve formuláři
	}
	return zapsano(q, "UPDATE modelky SET "+u.Sloupec+" = '' WHERE id = ? AND "+u.Sloupec+" = ?", n.ModelkaID, hodnota)
}
