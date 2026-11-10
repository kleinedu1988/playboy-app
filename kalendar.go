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
		SELECT al.vydani, al.typ, f.drive_file_id, COALESCE(m.jmeno, '')
		FROM alba al
		JOIN fotky f ON f.id = (SELECT MIN(id) FROM fotky WHERE album_id = al.id)
		LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE al.vydani <> '' ORDER BY al.vydani, f.id`)
	if err != nil {
		return vysledek, err
	}
	defer rows.Close()
	priorita := map[string]int{"Cover": 0, "Centerfold": 1}
	var v *VydaniKalendare
	nejlepsiNahled := 3
	for rows.Next() {
		var vydani, typ, driveID, jmeno string
		if rows.Scan(&vydani, &typ, &driveID, &jmeno) != nil {
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
		default:
			v.Pictorial = true
		}
		if poradi < nejlepsiNahled {
			nejlepsiNahled = poradi
			v.Nahled = adresaObrazku(driveID)
		}
	}
	return vysledek, rows.Err()
}
