package main

// Rychlé přidávání (zásobník odkazů v profilu, rychlé okno Nová modelka): kontrola vložených odkazů před uložením.
// Kolik odkazů je platných a které soubory už ve sbírce jsou (s místy, kde jsou), aby šlo vložit jen nové.

import "strings"

// MistoOdkazu: kde už soubor ve sbírce je
type MistoOdkazu struct {
	FotkaID      int    `json:"fotkaId"`
	ModelkaID    int    `json:"modelkaId"`
	JmenoModelky string `json:"jmenoModelky"`
	Album        string `json:"album"`
	Typ          string `json:"typ"`
	Vydani       string `json:"vydani"`
	URL          string `json:"url"`
}

type ExistujiciOdkaz struct {
	DriveID string        `json:"driveId"`
	Mista   []MistoOdkazu `json:"mista"`
}

// KontrolaOdkazu: platné soubory z textu (v pořadí, bez opakování), z nich nové a ty, které už ve sbírce jsou
type KontrolaOdkazu struct {
	Ids        []string          `json:"ids"`
	Nove       []string          `json:"nove"`
	Existujici []ExistujiciOdkaz `json:"existujici"`
	Slozka     bool              `json:"slozka"` // text obsahuje odkaz na složku Disku (ta se nerozbalí)
}

const nejviceMistOdkazu = 3

func (a *App) ZkontrolovatOdkazy(rawLinks string) KontrolaOdkazu {
	k := KontrolaOdkazu{Ids: parseDriveIDs(rawLinks), Nove: []string{}, Existujici: []ExistujiciOdkaz{}, Slozka: strings.Contains(rawLinks, "/folders/")}
	if k.Ids == nil {
		k.Ids = []string{}
	}
	if len(k.Ids) == 0 {
		return k
	}
	mista := map[string][]MistoOdkazu{}
	// Po dávkách (limit parametrů SQLite)
	for od := 0; od < len(k.Ids); od += 500 {
		davka := k.Ids[od:min(od+500, len(k.Ids))]
		args := make([]interface{}, len(davka))
		for i, id := range davka {
			args[i] = id
		}
		rows, err := a.db.Query(`SELECT f.id, f.drive_file_id, COALESCE(f.modelka_id, 0), COALESCE(m.jmeno, ''), f.album, f.typ, COALESCE(f.vydani, '')
			FROM fotografie f LEFT JOIN modelky m ON m.id = f.modelka_id
			WHERE f.drive_file_id IN (?`+strings.Repeat(", ?", len(davka)-1)+`) ORDER BY f.id`, args...)
		if err != nil {
			a.chyba("kontrola odkazů", err)
			return k
		}
		for rows.Next() {
			var m MistoOdkazu
			var id string
			if rows.Scan(&m.FotkaID, &id, &m.ModelkaID, &m.JmenoModelky, &m.Album, &m.Typ, &m.Vydani) == nil && len(mista[id]) < nejviceMistOdkazu {
				m.URL = adresaObrazku(id)
				mista[id] = append(mista[id], m)
			}
		}
		rows.Close()
	}
	for _, id := range k.Ids {
		if m, ok := mista[id]; ok {
			k.Existujici = append(k.Existujici, ExistujiciOdkaz{DriveID: id, Mista: m})
		} else {
			k.Nove = append(k.Nove, id)
		}
	}
	return k
}
