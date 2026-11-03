package main

import (
	"database/sql"
	"sort"
)

// Fronty fotek k hodnocení (Hodnotit › Fotky, Průvodce, odemčení tématu) mají desítky tisíc fotek. Údaje alba
// (modelka, název, vydání, spojení, popis, fotograf, další modelky – vše je v databázi u alba, viz pohled fotografie) by se u každé fotky opakovaly a adresa obrázku je jen šablona
// s ID z Disku, takže fronta posílá alba zvlášť, šablonu jednou a u fotky jen to, co je její (rozbalí je
// frontend/src/lib/fronta.js zpět na fotky). Ve sbírce se 150 000 fotkami je to místo 67 MB zhruba šestina.

type FotkaFronty struct {
	ID        int    `json:"id"`
	AlbumID   int64  `json:"albumId"`
	DriveID   string `json:"driveId"`
	Rotace    int    `json:"rotace,omitempty"`
	Hodnoceni int    `json:"hodnoceni,omitempty"`
}

type AlbumFronty struct {
	ModelkaID    int            `json:"modelkaId"`
	JmenoModelky string         `json:"jmenoModelky"`
	Album        string         `json:"album"`
	Typ          string         `json:"typ"`
	Vydani       string         `json:"vydani,omitempty"`
	Spojit       bool           `json:"spojit,omitempty"`
	Popis        string         `json:"popis,omitempty"`
	Fotograf     string         `json:"fotograf,omitempty"`
	DatumAlba    string         `json:"datumAlba,omitempty"`
	DalsiModelky []OdkazModelky `json:"dalsiModelky,omitempty"`
}

type FrontaFotek struct {
	Sablona string        `json:"sablona"` // adresa obrázku s {id} místo ID z Disku
	Fotky   []FotkaFronty `json:"fotky"`   // v pořadí fronty
	// Alba fotek podle albumId (klíč JSONu je text)
	Alba map[int64]AlbumFronty `json:"alba"`
}

func zabalitFrontu(fotky []Fotografie) FrontaFotek {
	f := FrontaFotek{Sablona: adresaObrazku("{id}"), Fotky: make([]FotkaFronty, 0, len(fotky)), Alba: map[int64]AlbumFronty{}}
	for _, x := range fotky {
		f.Fotky = append(f.Fotky, FotkaFronty{ID: x.ID, AlbumID: x.AlbumID, DriveID: x.DriveID, Rotace: x.Rotace, Hodnoceni: x.Hodnoceni})
		if _, ok := f.Alba[x.AlbumID]; !ok {
			if len(x.DalsiModelky) == 0 {
				x.DalsiModelky = nil
			}
			f.Alba[x.AlbumID] = AlbumFronty{ModelkaID: x.ModelkaID, JmenoModelky: x.JmenoModelky, Album: x.Album, Typ: x.Typ, Vydani: x.Vydani, Spojit: x.Spojit, Popis: x.Popis, Fotograf: x.Fotograf, DatumAlba: x.DatumAlba, DalsiModelky: x.DalsiModelky}
		}
	}
	return f
}

// Fronta přímo z tabulek: fotky jen s vlastními sloupci, alba zvlášť a pořadí (modelka bez diakritiky, album,
// pořadí v albu) se skládá tady – SQLite by jinak řadil všechny fotky s porovnáním jmen bez diakritiky.
// Pořadí je stejné jako ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, f.album, razeniFotek (hlídá test).
// podminka je výraz nad fotkou f (tabulka fotky) a jejím albem a.
func (a *App) nacistFrontu(kde, podminka string, args ...interface{}) FrontaFotek {
	fr := FrontaFotek{Sablona: adresaObrazku("{id}"), Fotky: []FotkaFronty{}, Alba: map[int64]AlbumFronty{}}
	type fotka struct {
		FotkaFronty
		poradi sql.NullInt64
	}
	var fotky []fotka
	radky, err := a.db.Query(`SELECT f.id, f.album_id, f.drive_file_id, COALESCE(f.rotace, 0), COALESCE(f.hodnoceni, 0), f.poradi
		FROM fotky f JOIN alba a ON a.id = f.album_id JOIN modelky m ON m.id = a.modelka_id WHERE `+podminka, args...)
	if err != nil {
		a.chyba(kde, err)
		return fr
	}
	for radky.Next() {
		var f fotka
		if radky.Scan(&f.ID, &f.AlbumID, &f.DriveID, &f.Rotace, &f.Hodnoceni, &f.poradi) == nil {
			fotky = append(fotky, f)
			fr.Alba[f.AlbumID] = AlbumFronty{}
		}
	}
	radky.Close()
	if len(fotky) == 0 {
		return fr
	}

	radky, err = a.db.Query(`SELECT a.id, COALESCE(a.modelka_id, 0), COALESCE(m.jmeno, ''), a.album, a.typ, COALESCE(a.vydani, ''),
		COALESCE(a.spojit, 0), COALESCE(a.popis, ''), COALESCE(a.fotograf, ''), COALESCE(a.datum, '')
		FROM alba a JOIN modelky m ON m.id = a.modelka_id`)
	if err != nil {
		a.chyba(kde, err)
		return FrontaFotek{Sablona: fr.Sablona, Fotky: []FotkaFronty{}, Alba: map[int64]AlbumFronty{}}
	}
	for radky.Next() {
		var id int64
		var al AlbumFronty
		if radky.Scan(&id, &al.ModelkaID, &al.JmenoModelky, &al.Album, &al.Typ, &al.Vydani, &al.Spojit, &al.Popis, &al.Fotograf, &al.DatumAlba) != nil {
			continue
		}
		if _, ok := fr.Alba[id]; ok {
			fr.Alba[id] = al
		}
	}
	radky.Close()
	dalsi := a.dalsiModelkyAlb(nil)
	ids := make([]int64, 0, len(fr.Alba))
	for id, al := range fr.Alba {
		if d := dalsi[id]; len(d) > 0 {
			al.DalsiModelky = d
			fr.Alba[id] = al
		}
		ids = append(ids, id)
	}

	// Pořadí alb: jméno modelky bez diakritiky, název alba; stejná dvojice (jiný typ, jmenovkyně) má stejné místo
	// a její fotky se řadí společně podle pořadí v albu, jako v SQL
	sort.Slice(ids, func(i, j int) bool {
		x, y := fr.Alba[ids[i]], fr.Alba[ids[j]]
		if c := porovnatBezDiakritiky(x.JmenoModelky, y.JmenoModelky); c != 0 {
			return c < 0
		}
		return x.Album < y.Album
	})
	misto := make(map[int64]int, len(ids))
	for i, id := range ids {
		if i > 0 {
			x, y := fr.Alba[ids[i-1]], fr.Alba[id]
			if porovnatBezDiakritiky(x.JmenoModelky, y.JmenoModelky) == 0 && x.Album == y.Album {
				misto[id] = misto[ids[i-1]]
				continue
			}
		}
		misto[id] = i
	}
	sort.Slice(fotky, func(i, j int) bool {
		x, y := &fotky[i], &fotky[j]
		if mx, my := misto[x.AlbumID], misto[y.AlbumID]; mx != my {
			return mx < my
		}
		if x.poradi.Valid != y.poradi.Valid {
			return x.poradi.Valid
		}
		if x.poradi.Int64 != y.poradi.Int64 {
			return x.poradi.Int64 < y.poradi.Int64
		}
		return x.ID < y.ID
	})
	for _, f := range fotky {
		fr.Fotky = append(fr.Fotky, f.FotkaFronty)
	}
	return fr
}
