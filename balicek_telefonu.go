package main

// Balíček pro telefon (0.02.077): výtah sbírky, ze kterého telefon (0.02.078+) složí stránku modelek – hero banner
// a dlaždice jako v hlavním programu, jen ke čtení. Pole modelek mají stejné názvy jako Modelka, aby telefon použil
// stejný JS (kategorie, výřezy titulních fotek). Obrázky jsou jen Drive ID a šablona adresy; telefon si náhledy
// stáhne z Disku stejně jako PC. Explicitní fotky (explicitniFotky, druh_fotek.go) jako na PC: titulní nebo
// profilová fotka, která je explicitní, se vynechá (dlaždice, hero); v galeriích modelky jsou (0.02.086). Balíček se nahraje do skryté složky programu na
// Disku (gzip JSON) spolu se zálohou a nahradí předchozí.

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"pinup-katalog/internal/hledani"
)

const (
	nazevBalickuTelefonu = "telefon-balicek.json.gz"
	// 2 (0.02.086): galerie modelek s fotkami
	verzeBalickuTelefonu = 2
)

// Modelka v balíčku: jen co potřebuje dlaždice, hero a řazení
type ModelkaTelefonu struct {
	ID             int                     `json:"id"`
	Jmeno          string                  `json:"jmeno"`
	Hodnoceni      float64                 `json:"hodnoceni,omitempty"`
	OdhadHodnoceni float64                 `json:"odhadHodnoceni,omitempty"`
	Oblibenost     float64                 `json:"oblibenost,omitempty"`
	Poradi         int                     `json:"poradi,omitempty"`
	Role           string                  `json:"role,omitempty"`
	Vydani         []string                `json:"vydani,omitempty"`
	Centerfoldy    []string                `json:"centerfoldy,omitempty"`
	Obalky         []string                `json:"obalky,omitempty"`
	CyberGirl      string                  `json:"cyberGirl,omitempty"`
	PlaymateMesice bool                    `json:"playmateMesice,omitempty"`
	PlaymateRoku   string                  `json:"playmateRoku,omitempty"`
	TitulyJinde    []hledani.TitulCasopisu `json:"titulyJinde,omitempty"`
	NarozeniDatum  string                  `json:"narozeniDatum,omitempty"`
	Narodnost      string                  `json:"narodnost,omitempty"`
	PocetFotek     int                     `json:"pocetFotek,omitempty"`
	Pridano        string                  `json:"pridano,omitempty"`
	// Titulní fotka dlaždice a její výřez
	CoverID   string  `json:"coverId,omitempty"`
	CoverZoom float64 `json:"coverZoom,omitempty"`
	CoverX    float64 `json:"coverX,omitempty"`
	CoverY    float64 `json:"coverY,omitempty"`
	// Profilová fotka (hero banner) a její výřez
	ProfilID   string  `json:"profilId,omitempty"`
	ProfilZoom float64 `json:"profilZoom,omitempty"`
	ProfilX    float64 `json:"profilX,omitempty"`
	ProfilY    float64 `json:"profilY,omitempty"`
	// Galerie (0.02.086) v pořadí podle vydání, všechny fotky (i explicitní, jako galerie na PC)
	Alba []AlbumTelefonu `json:"alba,omitempty"`
}

// Galerie modelky v balíčku: fotky jako Drive ID, otočená fotka s příponou „:90“ (stupně)
type AlbumTelefonu struct {
	Nazev  string   `json:"nazev"`
	Typ    string   `json:"typ"`
	Vydani string   `json:"vydani,omitempty"`
	Datum  string   `json:"datum,omitempty"` // online galerie mají datum místo vydání
	Fotky  []string `json:"fotky"`
}

type BalicekTelefonu struct {
	Verze    int    `json:"verze"`
	Vytvoren string `json:"vytvoren"`
	// Adresa obrázku z Disku se {id} a {velikost} (stejná jako v Nastavení › Šablona obrázků)
	SablonaObrazku string            `json:"sablonaObrazku"`
	Modelky        []ModelkaTelefonu `json:"modelky"`
}

// Balíček z aktuální sbírky (bez nahrání)
func (a *App) balicekTelefonu() (BalicekTelefonu, error) {
	modelky, err := a.nactiModelky("", true)
	b := BalicekTelefonu{Verze: verzeBalickuTelefonu, Vytvoren: time.Now().Format(time.RFC3339),
		SablonaObrazku: adresaObrazkuNaDisku("{id}"), Modelky: make([]ModelkaTelefonu, 0, len(modelky))}
	if err != nil {
		return b, err
	}
	explicitni := a.explicitniFotky()
	profily := a.profilyModelek()
	alba := a.albaModelekTelefonu()
	for _, m := range modelky {
		t := ModelkaTelefonu{ID: m.ID, Jmeno: m.Jmeno, Hodnoceni: m.Hodnoceni, OdhadHodnoceni: m.OdhadHodnoceni,
			Oblibenost: zaokrouhlit(m.Oblibenost), Poradi: m.Poradi, Role: m.Role, Vydani: m.Vydani, Centerfoldy: m.Centerfoldy,
			Obalky: m.Obalky, CyberGirl: m.CyberGirl, PlaymateMesice: m.PlaymateMesice, PlaymateRoku: m.PlaymateRoku,
			TitulyJinde: m.TitulyJinde, NarozeniDatum: m.NarozeniDatum, Narodnost: m.Narodnost, PocetFotek: m.PocetFotek,
			Pridano: m.Pridano}
		if m.CoverID != "" && !explicitni[m.CoverID] {
			t.CoverID, t.CoverZoom, t.CoverX, t.CoverY = m.CoverID, m.CoverZoom, m.CoverX, m.CoverY
		}
		if p, ok := profily[m.ID]; ok && !explicitni[p.id] {
			t.ProfilID, t.ProfilZoom, t.ProfilX, t.ProfilY = p.id, p.zoom, p.x, p.y
		}
		t.Alba = alba[m.ID]
		b.Modelky = append(b.Modelky, t)
	}
	return b, nil
}

type profilModelky struct {
	id         string
	zoom, x, y float64
}

// Profilové fotky všech modelek jedním dotazem (jako profilovaFotkaModelky)
func (a *App) profilyModelek() map[int]profilModelky {
	v := map[int]profilModelky{}
	radky, err := a.db.Query(`SELECT m.id, f.drive_file_id, m.profil_zoom, m.profil_x, m.profil_y
		FROM modelky m JOIN fotky f ON f.id = m.profil_fotka_id`)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		var drive string
		var z, x, y *float64
		if radky.Scan(&id, &drive, &z, &x, &y) != nil {
			continue
		}
		ids := parseDriveIDs(drive)
		if len(ids) == 0 {
			continue
		}
		p := profilModelky{id: ids[0], zoom: 1, x: 50, y: vychoziProfilovaY}
		if z != nil && x != nil && y != nil {
			p.zoom, p.x, p.y = *z, *x, *y
		}
		v[id] = p
	}
	return v
}

// Galerie všech modelek jedním dotazem (i společná alba z alba_modelky); dostupné fotky v pořadí jako v programu
func (a *App) albaModelekTelefonu() map[int][]AlbumTelefonu {
	v := map[int][]AlbumTelefonu{}
	radky, err := a.db.Query(`SELECT x.modelka_id, al.id, al.album, al.typ, al.vydani, COALESCE(al.datum, ''), f.drive_file_id, f.rotace
		FROM (SELECT id AS album_id, modelka_id FROM alba WHERE modelka_id IS NOT NULL
			UNION SELECT album_id, modelka_id FROM alba_modelky) x
		JOIN alba al ON al.id = x.album_id
		JOIN fotky f ON f.album_id = al.id
		WHERE f.nedostupne_od IS NULL
		ORDER BY x.modelka_id, COALESCE(NULLIF(al.vydani, ''), al.datum, ''), al.id, f.poradi IS NULL, f.poradi, f.id`)
	if err != nil {
		return v
	}
	defer radky.Close()
	posledni := map[int]int64{}
	for radky.Next() {
		var modelka, rotace int
		var album int64
		var nazev, typ, vydani, datum, drive string
		if radky.Scan(&modelka, &album, &nazev, &typ, &vydani, &datum, &drive, &rotace) != nil {
			continue
		}
		ids := parseDriveIDs(drive)
		if len(ids) == 0 {
			continue
		}
		if posledni[modelka] != album || len(v[modelka]) == 0 {
			v[modelka] = append(v[modelka], AlbumTelefonu{Nazev: nazev, Typ: typ, Vydani: vydani, Datum: datum})
			posledni[modelka] = album
		}
		foto := ids[0]
		if rotace%360 != 0 {
			foto += ":" + strconv.Itoa(((rotace%360)+360)%360)
		}
		g := &v[modelka][len(v[modelka])-1]
		g.Fotky = append(g.Fotky, foto)
	}
	return v
}

// Balíček jako gzip JSON
func zabalitBalicek(b BalicekTelefonu) ([]byte, error) {
	var buf bytes.Buffer
	z, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	if err := json.NewEncoder(z).Encode(b); err != nil {
		return nil, err
	}
	if err := z.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Nahraje balíček do skryté složky programu na Disku a smaže předchozí (nový je nahraný dřív, než starý zmizí)
func (a *App) nahratBalicekTelefonu(ctx context.Context) error {
	b, err := a.balicekTelefonu()
	if err != nil {
		return err
	}
	data, err := zabalitBalicek(b)
	if err != nil {
		return err
	}
	zamekDisku.Lock()
	defer zamekDisku.Unlock()
	stare, err := a.souboryNaDisku(ctx)
	if err != nil {
		return err
	}
	if err := a.nahratNaDisk(ctx, nazevBalickuTelefonu, "application/gzip", bytes.NewReader(data), int64(len(data))); err != nil {
		return err
	}
	for _, f := range stare {
		if f.Name != nazevBalickuTelefonu {
			continue
		}
		o, err := a.driveVolani(ctx, http.MethodDelete, adresaDriveAPI+"/drive/v3/files/"+url.PathEscape(f.ID), nil, nil)
		if err != nil {
			return err
		}
		o.Body.Close()
	}
	return nil
}
