package main

// Galerie (Nejlepší) – nejlepší fotky sbírky v jedné mřížce bez oddílů. Hodnota fotky = srdíčka fotky × oblíbenost
// modelky ÷ 5 (jako hodnotaFotky v lib/oblibenost.js; modelka bez oblíbenosti bere 2,5). Backend filtruje, řadí
// a posílá stránky zhuštěně (údaje alba jednou za album, adresa obrázku jako šablona) – dřív okno dostávalo
// všechny fotky se srdíčky (~12 MB) a řadilo je samo.

import (
	"fmt"
	"playboy-app/internal/oblibenost"
	"sort"
	"strings"
	"sync"
	"time"
)

type DotazNejlepsich = oblibenost.DotazNejlepsich
type GalerieNejlepsich = oblibenost.GalerieNejlepsich

// Seřazený výsledek dotazu se drží v paměti (stránky ho jen krájejí); platí ke snímku sbírky a modelu oblíbenosti
var pametNejlepsich struct {
	sync.Mutex
	klic    string
	fronta  FrontaFotek
	modelek int
}

// Klíč stavu sbírky a oblíbenosti bez kopírování 3 000 modelek a tisíců FormatFloat při každé stránce
func (a *App) klicStavuNejlepsich() string {
	s := a.snimekSbirky()
	var nPorovnani, davka int
	var posledni int64
	if u := a.uc; u != nil {
		u.mu.Lock()
		p := u.nacistPorovnani()
		nPorovnani = len(p)
		posledni = posledniPorovnani(p)
		davka = u.ob.zaznamuZajmu / zaznamuNaPrepocet
		u.mu.Unlock()
	}
	return fmt.Sprintf("%p|%s|%d|%d|%d", s, time.Now().Format("2006-01-02"), nPorovnani, posledni, davka)
}

func (a *App) GetGalerieNejlepsich(d DotazNejlepsich) GalerieNejlepsich {
	d.Min = min(max(d.Min, 1), 5)
	klic := fmt.Sprintf("%s|%d|%s|%d|%s|%v|%d|%s", a.klicStavuNejlepsich(), d.Min, d.Typ, d.Dekada, d.Razeni, d.Prokladat, d.Seed, d.Hledat)
	pametNejlepsich.Lock()
	fronta, modelek := pametNejlepsich.fronta, pametNejlepsich.modelek
	nalezeno := pametNejlepsich.klic == klic
	pametNejlepsich.Unlock()
	if !nalezeno {
		modelky, _ := a.nactiModelky("", true)
		oblibenostMap := make(map[int]float64, len(modelky))
		for _, m := range modelky {
			oblibenostMap[m.ID] = m.Oblibenost
		}
		fronta, modelek = a.seraditNejlepsi(d, oblibenostMap)
		pametNejlepsich.Lock()
		pametNejlepsich.klic, pametNejlepsich.fronta, pametNejlepsich.modelek = klic, fronta, modelek
		pametNejlepsich.Unlock()
	}
	g := GalerieNejlepsich{FrontaFotek: FrontaFotek{Sablona: fronta.Sablona, Fotky: []FotkaFronty{}, Alba: map[int64]AlbumFronty{}},
		Celkem: len(fronta.Fotky), Modelek: modelek, Od: min(max(d.Od, 0), len(fronta.Fotky))}
	do := len(fronta.Fotky)
	if d.Pocet > 0 {
		do = min(do, g.Od+d.Pocet)
	}
	for _, f := range fronta.Fotky[g.Od:do] {
		g.Fotky = append(g.Fotky, f)
		g.Alba[f.AlbumID] = fronta.Alba[f.AlbumID]
	}
	return g
}

// Rok alba pro desetiletí a řazení od nejnovějších: z vydání, jinak z data nafocení (online)
func rokAlba(al AlbumFronty) int {
	return oblibenost.RokAlba(al)
}

func skupinaTypu(typ string) string {
	return oblibenost.SkupinaTypu(typ, jeOnlineTyp(typ))
}

func (a *App) seraditNejlepsi(d DotazNejlepsich, oblibenost map[int]float64) (FrontaFotek, int) {
	f := FrontaFotek{Sablona: adresaObrazku("{id}"), Fotky: []FotkaFronty{}, Alba: map[int64]AlbumFronty{}}
	radky, err := a.db.Query(`SELECT a.id, COALESCE(a.modelka_id, 0), COALESCE(m.jmeno, ''), a.album, a.typ, COALESCE(a.vydani, ''),
		COALESCE(a.spojit, 0), COALESCE(a.popis, ''), COALESCE(a.fotograf, ''), COALESCE(a.datum, '')
		FROM alba a LEFT JOIN modelky m ON m.id = a.modelka_id`)
	if err != nil {
		a.chyba("nejlepší fotky", err)
		return f, 0
	}
	alba := map[int64]AlbumFronty{}
	for radky.Next() {
		var id int64
		var al AlbumFronty
		if radky.Scan(&id, &al.ModelkaID, &al.JmenoModelky, &al.Album, &al.Typ, &al.Vydani, &al.Spojit, &al.Popis, &al.Fotograf, &al.DatumAlba) == nil {
			alba[id] = al
		}
	}
	radky.Close()
	slova := strings.Fields(zjednodusit(d.Hledat))
	vyhovuje := map[int64]bool{}
	for id, al := range alba {
		if d.Typ != "" && skupinaTypu(al.Typ) != d.Typ {
			continue
		}
		if d.Dekada > 0 && rokAlba(al)/10*10 != d.Dekada {
			continue
		}
		if len(slova) > 0 {
			text := zjednodusit(al.JmenoModelky + " " + al.Album + " " + al.Fotograf + " " + al.Popis)
			ok := true
			for _, s := range slova {
				if !strings.Contains(text, s) {
					ok = false
					break
				}
			}
			if !ok {
				continue
			}
		}
		vyhovuje[id] = true
	}

	type fotka struct {
		FotkaFronty
		modelka int
		hodnota float64
		rok     int
	}
	var fotky []fotka
	radky, err = a.db.Query(`SELECT id, album_id, drive_file_id, COALESCE(rotace, 0), COALESCE(hodnoceni, 0) FROM fotky WHERE COALESCE(hodnoceni, 0) >= ?`, d.Min)
	if err != nil {
		a.chyba("nejlepší fotky", err)
		return f, 0
	}
	for radky.Next() {
		var x fotka
		if radky.Scan(&x.ID, &x.AlbumID, &x.DriveID, &x.Rotace, &x.Hodnoceni) != nil || !vyhovuje[x.AlbumID] {
			continue
		}
		al := alba[x.AlbumID]
		x.modelka = al.ModelkaID
		o := oblibenost[x.modelka]
		if o <= 0 {
			o = 2.5
		}
		x.hodnota = float64(x.Hodnoceni) * o / 5
		x.rok = rokAlba(al)
		fotky = append(fotky, x)
	}
	radky.Close()

	podleHodnoty := func(i, j int) bool {
		x, y := &fotky[i], &fotky[j]
		if x.hodnota != y.hodnota {
			return x.hodnota > y.hodnota
		}
		if x.Hodnoceni != y.Hodnoceni {
			return x.Hodnoceni > y.Hodnoceni
		}
		return x.ID < y.ID
	}
	switch d.Razeni {
	case "srdicka":
		sort.Slice(fotky, func(i, j int) bool {
			if fotky[i].Hodnoceni != fotky[j].Hodnoceni {
				return fotky[i].Hodnoceni > fotky[j].Hodnoceni
			}
			return podleHodnoty(i, j)
		})
	case "nejnovejsi":
		sort.Slice(fotky, func(i, j int) bool {
			if fotky[i].rok != fotky[j].rok {
				return fotky[i].rok > fotky[j].rok
			}
			return podleHodnoty(i, j)
		})
	case "nahodne":
		sort.Slice(fotky, func(i, j int) bool {
			x, y := nahodaKlice(fotky[i].ID, d.Seed), nahodaKlice(fotky[j].ID, d.Seed)
			if x != y {
				return x < y
			}
			return fotky[i].ID < fotky[j].ID
		})
	default:
		sort.Slice(fotky, podleHodnoty)
		if d.Prokladat {
			// Každá další fotka téže modelky (v pořadí hodnoty) má hodnotu o čtvrt srdíčka nižší: modelky se střídají
			n := map[int]int{}
			for i := range fotky {
				if m := fotky[i].modelka; m > 0 {
					fotky[i].hodnota -= 0.25 * float64(n[m])
					n[m]++
				}
			}
			sort.SliceStable(fotky, func(i, j int) bool { return fotky[i].hodnota > fotky[j].hodnota })
		}
	}
	modelek := map[int]bool{}
	for _, x := range fotky {
		f.Fotky = append(f.Fotky, x.FotkaFronty)
		f.Alba[x.AlbumID] = alba[x.AlbumID]
		if x.modelka > 0 {
			modelek[x.modelka] = true
		}
	}
	return f, len(modelek)
}
