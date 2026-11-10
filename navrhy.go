package main

import (
	"database/sql"
	"strconv"
	"strings"

	"pinup-katalog/internal/kontrola"
)

// Návrhy doplnění chybějících údajů pro Údržbu (celkový popis učení v docs/UCENI.md).
// Pravidla, modely učení ze sbírky i odhad obvodů a pravidla pro alba jsou v balíčku internal/kontrola.

type (
	NavrhDoplneni = kontrola.NavrhDoplneni
	navrhSbirky   = kontrola.NavrhSbirky
	zdrojNavrhu   = kontrola.ZdrojNavrhu
	udajNavrhu    = kontrola.UdajNavrhu
	albumNavrhu   = kontrola.AlbumNavrhu
	klicUdaje     = kontrola.KlicUdaje
	vstupUceni    = kontrola.VstupUceni
	kandidat      = kontrola.Kandidat
)

var (
	zdrojeNavrhu           = kontrola.ZdrojeNavrhu
	poradiZdroju           = kontrola.PoradiZdroju
	udajeNavrhu            = kontrola.UdajeNavrhu
	kliceNavrhuModelky     = kontrola.KliceNavrhuModelky
	kliceNavrhuAlba        = kontrola.KliceNavrhuAlba
	obvodyNavrhu           = kontrola.ObvodyNavrhu
	vzorPlaymateRokuNavrhu = kontrola.VzorPlaymateRokuNavrhu
	tabulkaZemi            = kontrola.TabulkaZemi
	narodnostNaZemi        = kontrola.NarodnostNaZemi
)

const (
	prahNavrhu         = kontrola.PrahNavrhu
	stropJistoty       = kontrola.StropJistoty
	prahVzhledu        = kontrola.PrahVzhledu
	prahEdice          = kontrola.PrahEdice
	stropVzhledu       = kontrola.StropVzhledu
	minModelekEtnicity = kontrola.MinModelekEtnicity
	minModelekVzhledu  = kontrola.MinModelekVzhledu
	minModelekObecne   = kontrola.MinModelekObecne
	minModelekEdice    = kontrola.MinModelekEdice
	vahaTabulkyZemi    = kontrola.VahaTabulkyZemi
	podilNoveHodnoty   = kontrola.PodilNoveHodnoty
	vahaOdmitnuti      = kontrola.VahaOdmitnuti
	prahOdhadu         = kontrola.PrahOdhadu
	stropOdhadu        = kontrola.StropOdhadu
	minJistotaOdhadu   = kontrola.MinJistotaOdhadu
	tlumeniOdhadu      = kontrola.TlumeniOdhadu
)

func klicNavrhu(pole string) string           { return kontrola.KlicNavrhu(pole) }
func klicHodnoty(pole, hodnota string) string { return kontrola.KlicHodnoty(pole, hodnota) }
func maPlaymateRoku(role string) bool         { return kontrola.MaPlaymateRoku(role) }
func datumZNazvu(nazev string, letos int) (string, int, bool) {
	return kontrola.DatumZNazvu(nazev, letos)
}

func albaProNavrhy(alba []albumSbirky) []albumNavrhu {
	return kontrola.AlbaProNavrhy(albaDoBalicku(alba))
}

func navrhnout(modelky []Modelka, alba []albumNavrhu, letos int, uc *vstupUceni) []navrhSbirky {
	return kontrola.Navrhnout(modelky, alba, letos, uc)
}

// Návrhy doplnění chybějících údajů seřazené od nejvyšší jistoty; odmítnuté jen s vcetneOdmitnutych (s příznakem)
func (a *App) GetNavrhyDoplneni(vcetneOdmitnutych bool) []NavrhDoplneni {
	modelky, alba, _ := a.modelkyAAlba()
	return a.navrhyDoplneni(modelky, alba, vcetneOdmitnutych)
}

func (a *App) navrhyDoplneni(modelky []Modelka, alba []albumSbirky, vcetneOdmitnutych bool) []NavrhDoplneni {
	vysledek := []NavrhDoplneni{}
	for _, n := range a.navrhySbirky(modelky, alba) {
		if !n.Odmitnuto || vcetneOdmitnutych {
			vysledek = append(vysledek, n.NavrhDoplneni)
		}
	}
	return vysledek
}

// Přijetí návrhu: zapíše hodnotu, jen když je údaj stále prázdný (jinak false a nic se nemění)
func (a *App) PrijmoutNavrh(n NavrhDoplneni) bool {
	zapsano := false
	ok := a.vTransakci("přijetí návrhu", func(q dotazovac) error {
		var err error
		zapsano, err = zapsatNavrh(q, n)
		return err
	})
	if ok && zapsano {
		a.zaznamenatNavrh(udalostPrijato, n, n.Hodnota)
	}
	return ok && zapsano
}

// Přijetí více návrhů najednou (hromadná změna: předtím záloha); vrací počet zapsaných
func (a *App) PrijmoutNavrhy(navrhy []NavrhDoplneni) int {
	if len(navrhy) == 0 {
		return 0
	}
	if err := a.zalohovat("pred-prijetim-navrhu"); err != nil {
		a.chyba("vytvoření zálohy", err)
		return 0
	}
	var prijate []NavrhDoplneni
	ok := a.vTransakci("přijetí návrhů", func(q dotazovac) error {
		prijate = prijate[:0]
		for _, n := range navrhy {
			zapsano, err := zapsatNavrh(q, n)
			if err != nil {
				return err
			}
			if zapsano {
				prijate = append(prijate, n)
			}
		}
		return nil
	})
	if !ok {
		return 0
	}
	for _, n := range prijate {
		a.zaznamenatNavrh(udalostPrijato, n, n.Hodnota)
	}
	return len(prijate)
}

// Odmítnutí návrhu (odmitnout = false odmítnutí ruší). Platí pro navrženou hodnotu (n.Hodnota): ta se uloží do
// databáze učení a jiná hodnota téhož údaje se navrhnout může. Ve sbírce se zároveň zapíše klíč „nv-<pole>“ mezi
// „netýká se“ modelky nebo alba (export, starší verze); zruší se, až u údaje nezbude žádná odmítnutá hodnota.
// Bez hodnoty se odmítá (nebo obnovuje) celý údaj.
func (a *App) OdmitnoutNavrh(n NavrhDoplneni, odmitnout bool) bool {
	u, ok := udajeNavrhu[n.Pole]
	if !ok || n.Klic != klicNavrhu(n.Pole) || u.Album != (n.Album != "") {
		return false
	}
	ku := klicUdaje{Modelka: n.ModelkaID, Album: n.Album, Typ: n.Typ, Pole: n.Pole}
	klic := klicHodnoty(n.Pole, n.Hodnota)
	zbyva := a.uc.odmitnoutHodnotu(ku, klic, strings.TrimSpace(n.Hodnota), odmitnout)
	// Klíč ve sbírce: při odmítnutí vždy, při zrušení jen když u údaje nic odmítnutého nezbylo
	zapsat := odmitnout || zbyva == 0
	ok = true
	if zapsat {
		if u.Album {
			ok = a.SetNetykaSeAlba(n.ModelkaID, n.Album, n.Typ, n.Klic, odmitnout)
		} else {
			ok = a.SetNetykaSe(n.ModelkaID, n.Klic, odmitnout)
		}
	}
	if ok {
		druh := udalostOdmitnuto
		if !odmitnout {
			druh = udalostZpet
		}
		a.zaznamenatNavrh(druh, n, "")
	}
	return ok
}

// Zápis jednoho návrhu; false, když údaj mezitím někdo vyplnil nebo návrh není platný
func zapsatNavrh(q dotazovac, n NavrhDoplneni) (bool, error) {
	u, ok := udajeNavrhu[n.Pole]
	hodnota := strings.TrimSpace(n.Hodnota)
	if !ok || hodnota == "" {
		return false, nil
	}
	zapsano := func(vysledek sql.Result, err error) (bool, error) {
		if err != nil {
			return false, err
		}
		pocet, err := vysledek.RowsAffected()
		return pocet > 0, err
	}
	if u.Album {
		if n.Album == "" {
			return false, nil
		}
		klic := "COALESCE(modelka_id, 0) = ? AND album = ? AND typ = ?"
		switch n.Pole {
		case "vydaniAlba":
			if !vzorVydaniAlba.MatchString(hodnota) || jeOnlineTyp(n.Typ) || n.Typ == "Centerfold" || n.Typ == "Cover" {
				return false, nil
			}
			return zapsano(q.Exec("UPDATE alba SET vydani = ? WHERE "+klic+" AND COALESCE(vydani, '') = ''", hodnota, n.ModelkaID, n.Album, n.Typ))
		case "typAlba":
			if n.Typ != "Pictorial" || (hodnota != typPMMesice && hodnota != typPMRoku) {
				return false, nil
			}
			return zapsano(q.Exec("UPDATE alba SET typ = ? WHERE "+klic+` AND NOT EXISTS (SELECT 1 FROM alba b
				WHERE COALESCE(b.modelka_id, 0) = ? AND b.album = ? AND b.typ = ?)`, hodnota, n.ModelkaID, n.Album, n.Typ, n.ModelkaID, n.Album, hodnota))
		case "datumAlba":
			if !platneDatum(hodnota) || !jeOnlineTyp(n.Typ) {
				return false, nil
			}
			return zapsano(q.Exec("UPDATE alba SET datum = ? WHERE "+klic+" AND COALESCE(datum, '') = ''", hodnota, n.ModelkaID, n.Album, n.Typ))
		default:
			return zapsano(q.Exec("UPDATE alba SET "+u.Sloupec+" = ? WHERE "+klic+" AND TRIM(COALESCE("+u.Sloupec+", '')) = ''", hodnota, n.ModelkaID, n.Album, n.Typ))
		}
	}
	if n.Album != "" {
		return false, nil
	}
	switch {
	case u.Cislo:
		cislo, err := strconv.Atoi(hodnota)
		j := -1
		for _, o := range obvodyNavrhu {
			if o.Pole == n.Pole {
				j = o.J
			}
		}
		if err != nil || j < 0 || float64(cislo) < priznaky[j].MezOd || float64(cislo) > priznaky[j].MezDo {
			return false, nil
		}
		ok, err := zapsano(q.Exec("UPDATE modelky SET "+u.Sloupec+" = ? WHERE id = ? AND COALESCE("+u.Sloupec+", 0) = 0", cislo, n.ModelkaID))
		if ok {
			_, err = q.Exec(`UPDATE modelky SET miry = obvod_hrudnik_cm || '-' || obvod_pas_cm || '-' || obvod_boky_cm
				WHERE id = ? AND obvod_hrudnik_cm > 0 AND obvod_pas_cm > 0 AND obvod_boky_cm > 0`, n.ModelkaID)
		}
		return ok && err == nil, err
	case n.Pole == "role":
		if !vzorPlaymateRokuNavrhu.MatchString(hodnota) {
			return false, nil
		}
		var role string
		if err := q.QueryRow("SELECT COALESCE(role, '') FROM modelky WHERE id = ?", n.ModelkaID).Scan(&role); err != nil {
			return false, nil
		}
		if maPlaymateRoku(role) {
			return false, nil
		}
		nova := hodnota
		if strings.TrimSpace(role) != "" {
			nova = strings.TrimRight(strings.TrimSpace(role), ",;") + ", " + hodnota
		}
		return zapsano(q.Exec("UPDATE modelky SET role = ? WHERE id = ? AND COALESCE(role, '') = ?", nova, n.ModelkaID, role))
	default:
		return zapsano(q.Exec("UPDATE modelky SET "+u.Sloupec+" = ? WHERE id = ? AND TRIM(COALESCE("+u.Sloupec+", '')) = ''", hodnota, n.ModelkaID))
	}
}
