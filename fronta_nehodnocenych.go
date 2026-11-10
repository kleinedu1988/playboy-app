package main

// Rychle ♥ (nehodnocené fotky) po stránkách: celá fronta má u velké sbírky ~80 000 fotek (~8 MB). Backend složí
// položky prohlížeče (spojený centerfold je jedna položka) a seřadí je stejně jako dřív okno (lib/alba.js
// sestavitAlba, lib/hodnoceni.js frontaFotek, nahodaKlice) a okno si bere stránky. Seřazená fronta se drží
// po celé sezení (semínko + řazení): ohodnocené fotky z ní nevypadávají, stránka je jen vynechá – pořadí se tak
// neposune a nic se nepřeskočí.

import (
	"encoding/json"
	"pinup-katalog/internal/oblibenost"
	"sort"
	"strconv"
	"sync"
)

// Stálá náhodná hodnota pro klíč a semínko (0–1); stejný výpočet jako nahodaKlice v lib/hodnoceni.js
func nahodaKlice(klic int, seed int) float64 {
	return oblibenost.NahodaKlice(klic, seed)
}

type polozkaFronty struct {
	fotky   []int // indexy do fotek fronty
	modelka int
	klic    int // id první fotky
}

// Položky prohlížeče v pořadí sestavitAlba: alba podle prvního výskytu, centerfoldy napřed, spojený centerfold
// (víc stránek, aspoň jedna spojená) je jedna položka
func polozkyFronty(f FrontaFotek) []polozkaFronty {
	type album struct {
		al    AlbumFronty
		fotky []int
	}
	var alba []*album
	podleKlice := map[string]*album{}
	for i, x := range f.Fotky {
		al := f.Alba[x.AlbumID]
		klic := klicAlbaFronty(al)
		a := podleKlice[klic]
		if a == nil {
			a = &album{al: al}
			podleKlice[klic] = a
			alba = append(alba, a)
		}
		a.fotky = append(a.fotky, i)
	}
	sort.SliceStable(alba, func(i, j int) bool { return alba[i].al.Typ == "Centerfold" && alba[j].al.Typ != "Centerfold" })
	var v []polozkaFronty
	for _, a := range alba {
		spojit := false
		if a.al.Typ == "Centerfold" && len(a.fotky) > 1 {
			// Spojení je údaj alba (všechny fotky ho mají stejný)
			spojit = a.al.Spojit
		}
		if spojit {
			v = append(v, polozkaFronty{fotky: a.fotky, modelka: a.al.ModelkaID, klic: f.Fotky[a.fotky[0]].ID})
			continue
		}
		for _, i := range a.fotky {
			v = append(v, polozkaFronty{fotky: []int{i}, modelka: a.al.ModelkaID, klic: f.Fotky[i].ID})
		}
	}
	return v
}

func klicAlbaFronty(al AlbumFronty) string {
	return strconv.Itoa(al.ModelkaID) + "\n" + al.Album + "\n" + al.Typ
}

// Pořadí jako frontaFotek: 'modelky' = modelky v náhodném pořadí, položky každé pohromadě; 'odhad' = od nejvyššího
// odhadu srdíček z obsahu fotek (odhad podle ID fotky, bez odhadu na konec zamíchané); jinak vše zamíchané
func seraditFrontu(p []polozkaFronty, razeni string, seed int, odhad map[int]float64) {
	if razeni == "odhad" && len(odhad) > 0 {
		sort.SliceStable(p, func(i, j int) bool {
			x, okx := odhad[p[i].klic]
			y, oky := odhad[p[j].klic]
			if okx != oky {
				return okx
			}
			if x != y {
				return x > y
			}
			return nahodaKlice(p[i].klic, seed) < nahodaKlice(p[j].klic, seed)
		})
		return
	}
	if razeni != "modelky" {
		sort.SliceStable(p, func(i, j int) bool {
			x, y := nahodaKlice(p[i].klic, seed), nahodaKlice(p[j].klic, seed)
			if x != y {
				return x < y
			}
			return p[i].klic < p[j].klic
		})
		return
	}
	poradi := map[int]int{}
	var modelky []int
	for _, x := range p {
		if _, ok := poradi[x.modelka]; !ok {
			poradi[x.modelka] = 0
			modelky = append(modelky, x.modelka)
		}
	}
	sort.Slice(modelky, func(i, j int) bool {
		x, y := nahodaKlice(modelky[i], seed), nahodaKlice(modelky[j], seed)
		if x != y {
			return x < y
		}
		return modelky[i] < modelky[j]
	})
	for i, m := range modelky {
		poradi[m] = i
	}
	sort.SliceStable(p, func(i, j int) bool { return poradi[p[i].modelka] < poradi[p[j].modelka] })
}

// Odhad srdíček z obsahu podle ID fotky fronty
func (a *App) odhadPolozekFronty(f FrontaFotek) map[int]float64 {
	o := a.odhadySrdicekFotek()
	if o == nil || len(o.Nehodnocene) == 0 {
		return nil
	}
	podleSouboru := o.Nehodnocene
	v := make(map[int]float64, len(f.Fotky))
	for _, x := range f.Fotky {
		if o, ok := podleSouboru[x.DriveID]; ok {
			v[x.ID] = o
		}
	}
	return v
}

// Pokrytí odhadem srdíček z obsahu fotek: kolik nehodnocených fotek (souborů) odhad má a kolik jich je.
// Řazení „Co se ti asi líbí“ se nabídne až od minPokrytiOdhadu – dokud obrazové modely nezpracovaly většinu
// nehodnocených fotek, byla by fronta z větší části jen zamíchaná.
type PokrytiOdhadu struct {
	Odhadnuto     int  `json:"odhadnuto"`
	Nehodnocenych int  `json:"nehodnocenych"`
	Nabidnout     bool `json:"nabidnout"` // dost pokrytí pro řazení podle odhadu
}

const minPokrytiOdhadu = 0.8

func (a *App) GetPokrytiOdhadu() PokrytiOdhadu {
	var v PokrytiOdhadu
	a.db.QueryRow(`SELECT COUNT(*) FROM (SELECT drive_file_id FROM fotky GROUP BY drive_file_id HAVING MAX(hodnoceni) = 0)`).Scan(&v.Nehodnocenych)
	if o := a.odhadySrdicekFotek(); o != nil {
		v.Odhadnuto = len(o.Nehodnocene)
	}
	v.Nabidnout = v.Odhadnuto > 0 && float64(v.Odhadnuto) >= minPokrytiOdhadu*float64(v.Nehodnocenych)
	return v
}

type StrankaNehodnocenych struct {
	FrontaFotek
	// Položky stránky jako indexy do Fotky (spojený centerfold má víc stránek)
	Polozky [][]int `json:"polozky"`
	Od      int     `json:"od"`    // pozice první položky stránky ve frontě sezení
	Dalsi   int     `json:"dalsi"` // pozice, od které pokračovat; -1 = konec fronty
	// Jen u první stránky: položek celkem a modelky fronty [{id, jmeno, n}] od nejvíc položek
	Celkem  int                    `json:"celkem"`
	Fotek   int                    `json:"fotek"` // fotek celkem (spojený centerfold má víc)
	Modelky []ModelkaNehodnocenych `json:"modelky"`
}

type ModelkaNehodnocenych struct {
	ID    int    `json:"id"`
	Jmeno string `json:"jmeno"`
	N     int    `json:"n"`
}

type sezeniNehodnocenych struct {
	klic    string
	fronta  FrontaFotek
	polozky []polozkaFronty
}

var (
	zamekNehodnocenych        sync.Mutex
	sezeniNehodnocenehoDotazu *sezeniNehodnocenych
)

// Stránka fronty nehodnocených: od = pozice ve frontě sezení (0 = nové sezení: fronta se složí znovu),
// modelka > 0 = jen položky té modelky. Položky, které se mezitím ohodnotily, stránka vynechá.
func (a *App) GetStrankuNehodnocenych(seed int, razeni string, modelka int, od int, kolik int) StrankaNehodnocenych {
	klic := razeni + "|" + strconv.Itoa(seed)
	zamekNehodnocenych.Lock()
	s := sezeniNehodnocenehoDotazu
	if od == 0 && modelka == 0 || s == nil || s.klic != klic {
		f := a.GetNehodnoceneFotky()
		p := polozkyFronty(f)
		var odhad map[int]float64
		if razeni == "odhad" {
			odhad = a.odhadPolozekFronty(f)
		}
		seraditFrontu(p, razeni, seed, odhad)
		s = &sezeniNehodnocenych{klic: klic, fronta: f, polozky: p}
		sezeniNehodnocenehoDotazu = s
	}
	zamekNehodnocenych.Unlock()

	v := StrankaNehodnocenych{FrontaFotek: FrontaFotek{Sablona: s.fronta.Sablona, Fotky: []FotkaFronty{}, Alba: map[int64]AlbumFronty{}},
		Polozky: [][]int{}, Od: od, Dalsi: -1, Modelky: []ModelkaNehodnocenych{}}
	hodnocene := a.ohodnoceneZ(s, od, kolik, modelka)
	for i := od; i < len(s.polozky); i++ {
		x := s.polozky[i]
		if modelka > 0 && x.modelka != modelka {
			continue
		}
		if len(v.Polozky) >= kolik {
			v.Dalsi = i
			break
		}
		if hodnocene[s.fronta.Fotky[x.fotky[0]].ID] {
			continue
		}
		var indexy []int
		for _, fi := range x.fotky {
			f := s.fronta.Fotky[fi]
			indexy = append(indexy, len(v.Fotky))
			v.Fotky = append(v.Fotky, f)
			v.Alba[f.AlbumID] = s.fronta.Alba[f.AlbumID]
		}
		v.Polozky = append(v.Polozky, indexy)
	}
	if od == 0 {
		n := map[int]*ModelkaNehodnocenych{}
		var poradi []*ModelkaNehodnocenych
		for _, x := range s.polozky {
			if modelka > 0 && x.modelka != modelka {
				continue
			}
			v.Celkem++
			v.Fotek += len(x.fotky)
			m := n[x.modelka]
			if m == nil {
				m = &ModelkaNehodnocenych{ID: x.modelka, Jmeno: s.fronta.Alba[s.fronta.Fotky[x.fotky[0]].AlbumID].JmenoModelky}
				n[x.modelka] = m
				poradi = append(poradi, m)
			}
			m.N++
		}
		klicJmena := make(map[int]string, len(poradi))
		for _, m := range poradi {
			klicJmena[m.ID] = zjednodusit(m.Jmeno)
		}
		sort.SliceStable(poradi, func(i, j int) bool {
			if poradi[i].N != poradi[j].N {
				return poradi[i].N > poradi[j].N
			}
			return klicJmena[poradi[i].ID] < klicJmena[poradi[j].ID]
		})
		for _, m := range poradi {
			v.Modelky = append(v.Modelky, *m)
		}
	}
	return v
}

// Fotky z rozsahu stránky, které se od složení fronty ohodnotily (ze snímku sbírky by to nešlo – má jen počty)
func (a *App) ohodnoceneZ(s *sezeniNehodnocenych, od, kolik, modelka int) map[int]bool {
	v := map[int]bool{}
	if od == 0 && modelka == 0 {
		return v // fronta je právě složená
	}
	var ids []int
	for i := od; i < len(s.polozky) && len(ids) < kolik+500; i++ {
		if modelka > 0 && s.polozky[i].modelka != modelka {
			continue
		}
		ids = append(ids, s.fronta.Fotky[s.polozky[i].fotky[0]].ID)
	}
	if len(ids) == 0 {
		return v
	}
	idsJSON, _ := json.Marshal(ids)
	radky, err := a.db.Query(`SELECT id FROM fotky WHERE COALESCE(hodnoceni, 0) > 0 AND id IN (SELECT value FROM json_each(?))`, idsJSON)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var id int
		if radky.Scan(&id) == nil {
			v[id] = true
		}
	}
	return v
}
