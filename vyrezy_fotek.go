package main

// Chytrý výřez náhledů (0.02.049): pro každou fotku rámeček postavy a obličeje z detektoru, počítaný v pozadí
// s obsahem fotek (internal/obsah/vyrezy.go). Výřez pro konkrétní rám (dlaždice, hero, karta) spočítá rozhraní
// z rámečků a skutečné velikosti obrázku (0.02.050); databáze rozměry fotek nezná. Ruční výřez, který bude mít
// přednost, přidá 0.02.057 jako úpravu schématu a exportu.

// VyrezFotky: zdroj "postava" (detektor našel postavu), "bez" (spočítáno, postava nenalezena – zůstane střed)
// nebo "ceka" (výpočet ji ještě nezpracoval nebo je obsah fotek vypnutý)
type VyrezFotky struct {
	DriveID string    `json:"driveId"`
	Zdroj   string    `json:"zdroj"`
	Postava []float64 `json:"postava,omitempty"` // x0, y0, x1, y1 jako podíl strany (0–1)
	Oblicej []float64 `json:"oblicej,omitempty"`
}

// GetVyrezyFotek: výřezy fotek podle ID souborů (pořadí jako ids)
func (a *App) GetVyrezyFotek(ids []string) []VyrezFotky {
	v := make([]VyrezFotky, 0, len(ids))
	for _, id := range ids {
		x := VyrezFotky{DriveID: id, Zdroj: "ceka"}
		if a.obsah != nil {
			if r, ok := a.obsah.RamecekFotky(id); ok {
				x.Zdroj = "bez"
				if r.MaPostavu {
					x.Zdroj, x.Postava = "postava", r.Postava[:]
				}
				if r.MaOblicej {
					x.Oblicej = r.Oblicej[:]
				}
			}
		}
		v = append(v, x)
	}
	return v
}

// StavVyrezu: kolik různých souborů sbírky má výřez spočítaný
type StavVyrezu struct {
	Souboru     int  `json:"souboru"`
	Spocitano   int  `json:"spocitano"`
	ObsahZapnut bool `json:"obsahZapnut"`
}

func (a *App) GetStavVyrezu() StavVyrezu {
	var s StavVyrezu
	if a.db == nil {
		return s
	}
	a.db.QueryRow(`SELECT COUNT(DISTINCT drive_file_id) FROM fotky`).Scan(&s.Souboru)
	s.ObsahZapnut = a.obsahZapnuty()
	if s.ObsahZapnut {
		s.Spocitano = min(a.obsah.PocetVyrezu(), s.Souboru)
	}
	return s
}
