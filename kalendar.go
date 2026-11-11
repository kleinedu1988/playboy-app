package main

import "pinup-katalog/internal/sbirka"

type VydaniKalendare = sbirka.VydaniKalendare

// Kalendář se pamatuje se snímkem sbírky (snimek.go): Přehled ho čte dvakrát (GetPrehled i okno) a statistiky
// znovu, a mezi změnami dat je pořád stejný
func (a *App) GetKalendar() []VydaniKalendare {
	s := a.snimekVPameti()
	if s == nil || s.err != nil {
		kalendar, err := a.nacistKalendar()
		if err != nil {
			a.chyba("načtení kalendáře", err)
		}
		return kalendar
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.kalendar == nil {
		kalendar, err := a.nacistKalendar()
		if err != nil {
			a.chyba("načtení kalendáře", err)
			return kalendar
		}
		s.kalendar = kalendar
	}
	return append([]VydaniKalendare{}, s.kalendar...)
}

// Vrací, co se přečíst podařilo, a chybu
func (a *App) nacistKalendar() ([]VydaniKalendare, error) {
	vysledek := []VydaniKalendare{}
	rows, err := a.db.Query(`
		SELECT al.vydani, al.typ, al.album, COALESCE(f.drive_file_id, ''), COALESCE(m.jmeno, ''), f.id IS NULL
		FROM alba al
		LEFT JOIN fotky f ON f.id = (SELECT MIN(id) FROM fotky WHERE album_id = al.id)
		LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE al.vydani <> '' ORDER BY al.vydani, f.id`)
	if err != nil {
		return vysledek, err
	}
	defer rows.Close()
	priorita := map[string]int{"Cover": 0, "Centerfold": 1}
	var v *VydaniKalendare
	nejlepsiNahled := 3
	centerfoldBezFotek := map[string]string{}
	// Modelky pictorialů čísla bez titulu: jediná = modelka čísla, víc různých = žádná
	pictorialy := map[string]map[string]bool{}
	for rows.Next() {
		var vydani, typ, nazev, driveID, jmeno string
		var prazdne bool
		if rows.Scan(&vydani, &typ, &nazev, &driveID, &jmeno, &prazdne) != nil {
			continue
		}
		// Album bez fotek (centerfold zapsaný bez fotky) číslo do kalendáře nepřidá, dá jen jméno modelky čísla
		// (0.02.043)
		if prazdne {
			if typ == "Centerfold" && jmeno != "" {
				centerfoldBezFotek[vydani] = jmeno
			}
			continue
		}
		if v == nil || v.Vydani != vydani {
			vysledek = append(vysledek, VydaniKalendare{Vydani: vydani})
			v = &vysledek[len(vysledek)-1]
			nejlepsiNahled = 3
		}
		poradi, zname := priorita[typ]
		if !zname {
			poradi = 2
		}
		switch typ {
		case "Cover":
			v.Cover = true
		case "Centerfold":
			v.Centerfold = true
			if v.Modelka == "" {
				v.Modelka = jmeno
			}
			if v.Modelka != "" {
				v.ModelkaCisla, v.ModelkaOdkud = v.Modelka, "centerfold"
			}
		default:
			v.Pictorial = true
			// Titul měsíce bez centerfoldu ve sbírce (Ulla Lindstrom, Pet of the Month November 1969)
			if jmeno == "" {
				break
			}
			if typPodleNazvuAlba(typ, nazev) == typPMMesice {
				if v.ModelkaOdkud != "centerfold" {
					v.ModelkaCisla, v.ModelkaOdkud = jmeno, "titul"
				}
			} else {
				if pictorialy[vydani] == nil {
					pictorialy[vydani] = map[string]bool{}
				}
				pictorialy[vydani][jmeno] = true
			}
		}
		if poradi < nejlepsiNahled {
			nejlepsiNahled = poradi
			v.Nahled = adresaObrazku(driveID)
		}
	}
	for i := range vysledek {
		v := &vysledek[i]
		if jmeno := centerfoldBezFotek[v.Vydani]; jmeno != "" && v.Modelka == "" {
			v.ModelkaCisla, v.ModelkaOdkud = jmeno, "centerfold"
		}
		if p := pictorialy[v.Vydani]; v.ModelkaCisla == "" && len(p) == 1 {
			for jmeno := range p {
				v.ModelkaCisla, v.ModelkaOdkud = jmeno, "pictorial"
			}
		}
	}
	return vysledek, rows.Err()
}
