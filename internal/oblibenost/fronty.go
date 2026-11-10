package oblibenost

import (
	"pinup-katalog/internal/sbirka"
	"strconv"
)

type FotkaFronty struct {
	ID        int    `json:"id"`
	AlbumID   int64  `json:"albumId"`
	DriveID   string `json:"driveId"`
	Rotace    int    `json:"rotace,omitempty"`
	Hodnoceni int    `json:"hodnoceni,omitempty"`
}

type AlbumFronty struct {
	ModelkaID    int                   `json:"modelkaId"`
	JmenoModelky string                `json:"jmenoModelky"`
	Album        string                `json:"album"`
	Typ          string                `json:"typ"`
	Vydani       string                `json:"vydani,omitempty"`
	Spojit       bool                  `json:"spojit,omitempty"`
	Popis        string                `json:"popis,omitempty"`
	Fotograf     string                `json:"fotograf,omitempty"`
	DatumAlba    string                `json:"datumAlba,omitempty"`
	DalsiModelky []sbirka.OdkazModelky `json:"dalsiModelky,omitempty"`
}

type FrontaFotek struct {
	Sablona string                `json:"sablona"` // adresa obrázku s {id} místo ID z Disku
	Fotky   []FotkaFronty         `json:"fotky"`   // v pořadí fronty
	Alba    map[int64]AlbumFronty `json:"alba"`
}

type DotazNejlepsich struct {
	Min       int    `json:"min"`       // nejméně srdíček fotky (1–5)
	Typ       string `json:"typ"`       // "", "centerfold", "pictorial", "online", "cover"
	Dekada    int    `json:"dekada"`    // 0 = všechna desetiletí, jinak např. 1990
	Razeni    string `json:"razeni"`    // "hodnota" (výchozí), "srdicka", "nejnovejsi", "nahodne"
	Prokladat bool   `json:"prokladat"` // střídat modelky: každá další fotka téže modelky má hodnotu o čtvrt srdíčka nižší
	Seed      int    `json:"seed"`      // semínko náhodného řazení
	Hledat    string `json:"hledat"`    // slova ve jménu modelky, názvu alba, fotografovi nebo popisu
	Od        int    `json:"od"`
	Pocet     int    `json:"pocet"` // 0 = vše od Od
}

type GalerieNejlepsich struct {
	FrontaFotek
	Celkem  int `json:"celkem"`  // fotek vyhovujících dotazu
	Modelek int `json:"modelek"` // různých modelek mezi nimi
	Od      int `json:"od"`
}

// Rok alba pro desetiletí a řazení od nejnovějších: z vydání, jinak z data nafocení (online)
func RokAlba(al AlbumFronty) int {
	zdroj := al.Vydani
	if zdroj == "" {
		zdroj = al.DatumAlba
	}
	if len(zdroj) >= 4 {
		if r, err := strconv.Atoi(zdroj[:4]); err == nil {
			return r
		}
	}
	return 0
}

func SkupinaTypu(typ string, jeOnline bool) string {
	switch {
	case typ == "Centerfold":
		return "centerfold"
	case typ == "Cover":
		return "cover"
	case jeOnline:
		return "online"
	}
	return "pictorial"
}
