package main

// Podmínky témat na album fotky (od 1.2.1): éra podle roku vydání, měsíc vydání, edice a typ alba. Nic se
// netaguje, bere se z vydání alba (Centerfold a Cover mají vydání v názvu, online alba datum nafocení). Klíč:
// „fotka:obdobi=1990-1999“, „fotka:mesic=06,07,08“, „fotka:edice=CZ“, „fotka:album=centerfold“. Kódy hodnot
// se nesmí měnit (jsou v uložených klíčích sezón a soubojů).

import (
	"fmt"
	"regexp"
	"strconv"
)

// Údaje alba pro témata; rok a měsíc 0 = neznámé, edice "" = album bez vydání
type albumTematu struct {
	rok, mesic int
	edice      string
	druh       string // kód typu alba (kodyAlb)
}

// Typ alba → kód v klíči tématu (bez mezer a diakritiky); Cover patří vydání, ne modelce
var kodyAlb = map[string]string{
	"Pictorial":  "pictorial",
	"Centerfold": "centerfold",
	typOnline:    "online",
	typCGTydne:   "cg",
	typCGMesice:  "cg",
	typPMMesice:  "pmm",
	typPMRoku:    "pmr",
}

var (
	vzorObdobi     = regexp.MustCompile(`^(\d{4})-(\d{4})$`)
	vzorRokuTematu = regexp.MustCompile(`^(\d{4})(?:-(\d{2}))?`)
)

// Údaje všech alb (id alba → údaje)
func (a *App) albaProTemata() map[int]*albumTematu {
	alba := map[int]*albumTematu{}
	radky, err := a.db.Query(`SELECT id, typ, COALESCE(vydani, ''), COALESCE(datum, '') FROM alba`)
	if err != nil {
		a.chyba("alba pro témata", err)
		return alba
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		var typ, vydani, datum string
		if radky.Scan(&id, &typ, &vydani, &datum) == nil {
			alba[id] = noveAlbumTematu(typ, vydani, datum)
		}
	}
	return alba
}

func noveAlbumTematu(typ, vydani, datum string) *albumTematu {
	al := &albumTematu{druh: kodyAlb[typ]}
	zdroj := vydani
	if zdroj == "" {
		zdroj = datum // online album: datum nafocení
	}
	if m := vzorRokuTematu.FindStringSubmatch(zdroj); m != nil {
		al.rok, _ = strconv.Atoi(m[1])
		if m[2] != "" {
			if n, _ := strconv.Atoi(m[2]); n >= 1 && n <= 12 {
				al.mesic = n
			}
		}
	}
	if vydani != "" {
		al.edice = edicePodleVydani(vydani)
		if al.edice == "" {
			al.edice = "US"
		}
	}
	return al
}

func (al *albumTematu) splnuje(klic, hodnota string) bool {
	if al == nil {
		return false
	}
	switch klic {
	case "obdobi":
		m := vzorObdobi.FindStringSubmatch(hodnota)
		if m == nil || al.rok == 0 {
			return false
		}
		od, _ := strconv.Atoi(m[1])
		do, _ := strconv.Atoi(m[2])
		return al.rok >= od && al.rok <= do
	case "mesic":
		n, err := strconv.Atoi(hodnota)
		return err == nil && al.mesic > 0 && n == al.mesic
	case "edice":
		return al.edice != "" && al.edice == hodnota
	case "album":
		return al.druh != "" && al.druh == hodnota
	}
	return false
}

// Platná podmínka na album v klíči (jen kanonické hodnoty)
func platnaPodminkaFotky(klic string, hodnoty []string) bool {
	for _, h := range hodnoty {
		ok := false
		switch klic {
		case "obdobi":
			if m := vzorObdobi.FindStringSubmatch(h); m != nil {
				od, _ := strconv.Atoi(m[1])
				do, _ := strconv.Atoi(m[2])
				ok = od >= 1950 && od <= do && do <= 2099
			}
		case "mesic":
			n, err := strconv.Atoi(h)
			ok = err == nil && len(h) == 2 && n >= 1 && n <= 12
		case "edice":
			ok = h == "US" || dalsiEdice[h]
		case "album":
			for _, k := range kodyAlb {
				ok = ok || k == h
			}
		}
		if !ok {
			return false
		}
	}
	return len(hodnoty) > 0
}

var (
	mesiceFraze = map[string]string{"01": "lednová čísla", "02": "únorová čísla", "03": "březnová čísla", "04": "dubnová čísla",
		"05": "květnová čísla", "06": "červnová čísla", "07": "červencová čísla", "08": "srpnová čísla", "09": "zářijová čísla",
		"10": "říjnová čísla", "11": "listopadová čísla", "12": "prosincová čísla"}
	albaFraze = map[string]string{"pictorial": "pictorialy", "centerfold": "centerfoldy", "online": "online pictorialy",
		"cg": "Cyber Girls", "pmm": "Playmate měsíce", "pmr": "Playmate roku"}
	edicFraze = map[string]string{"US": "americké vydání", "CZ": "česká edice"}
)

// Fráze podmínky na album pro složený název („90. léta“, „letní čísla“, „česká edice“)
func frazeFotky(klic, hodnota string) string {
	switch klic {
	case "obdobi":
		if m := vzorObdobi.FindStringSubmatch(hodnota); m != nil {
			od, _ := strconv.Atoi(m[1])
			do, _ := strconv.Atoi(m[2])
			if od%10 == 0 && do == od+9 {
				switch od {
				case 2000:
					return "nultá léta"
				case 2010:
					return "desátá léta"
				case 2020:
					return "dvacátá léta"
				}
				return fmt.Sprintf("%d. léta", od%100)
			}
			return fmt.Sprintf("%d–%d", od, do)
		}
	case "mesic":
		if f, ok := mesiceFraze[hodnota]; ok {
			return f
		}
	case "album":
		if f, ok := albaFraze[hodnota]; ok {
			return f
		}
	case "edice":
		if f, ok := edicFraze[hodnota]; ok {
			return f
		}
	}
	return hodnota
}
