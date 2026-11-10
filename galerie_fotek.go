package main

// Galerie všech fotek napříč modelkami (Modelky › Galerie, frontend/src/app/nejlepsi.js): jedna mozaika po stránkách
// s filtry v ovládacím panelu (srdíčka fotky, typ alba, tagy, desetiletí, modelka a text) a řazením „Co se ti asi
// líbí“ (srdíčka, u nehodnocených odhad z obsahu fotek), „Nejlepší“ (srdíčka × oblíbenost modelky), „Nejnovější“
// a „Náhodně“. Fotky sbírky se načtou jednou a drží v paměti, dokud se data nezmění (otisk z tabulek fotek
// a tagů); seřazený výsledek dotazu se pamatuje, takže další stránky jsou jen výřez.

import (
	"fmt"
	"hash/fnv"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"pinup-katalog/internal/hledani"
)

// Dotaz galerie
type DotazGalerie struct {
	Razeni  string   `json:"razeni"`  // "libi" (výchozí), "hodnota", "nove", "nahodne"
	Srdicka string   `json:"srdicka"` // "" všechny, "3" ♥3+, "4" ♥4+, "5", "0" nehodnocené
	Typy    []string `json:"typy"`    // typy alb (Pictorial, Centerfold…); prázdné = všechny
	Tagy    []string `json:"tagy"`    // fotka má všechny
	Dekady  []string `json:"dekady"`  // „1990“…; prázdné = všechny
	Modelka int      `json:"modelka"` // jen fotky modelky
	Text    string   `json:"text"`    // jméno modelky, album, fotograf
	Kolekce string   `json:"kolekce"` // klíč kolekce (galerie_kolekce.go), „Zobrazit vše“ z řady
	Seminko int      `json:"seminko"` // náhodné pořadí
	Od      int      `json:"od"`      // stránka od
	Kolik   int      `json:"kolik"`   // velikost stránky
}

// Počty pro ovládací panel: kolik fotek by zůstalo s hodnotou (ostatní filtry platí)
type FasetyGalerie struct {
	Srdicka map[string]int `json:"srdicka"`
	Typy    map[string]int `json:"typy"`
	Tagy    map[string]int `json:"tagy"`
	Dekady  map[string]int `json:"dekady"`
}

type StrankaGalerie struct {
	Fotky  []Fotografie  `json:"fotky"`
	Od     int           `json:"od"`
	Celkem int           `json:"celkem"`
	Fasety FasetyGalerie `json:"fasety"`
	// Hledání slovy (galerie_slovy.go): text hledán v obsahu fotek; Rozpoznano = modelka poznaná v textu;
	// NabidnoutSlovy = textu nic neodpovídá a textový model není stažený
	Obsahem        bool   `json:"obsahem"`
	Rozpoznano     string `json:"rozpoznano"`
	NabidnoutSlovy bool   `json:"nabidnoutSlovy"`
}

type fotkaGalerie struct {
	f      Fotografie
	tagy   map[string]bool
	dekada string
	hledat string
}

var galeriePamet struct {
	sync.Mutex
	otisk    string
	fotky    []fotkaGalerie
	klic     string
	serazene []int // indexy do fotky pro poslední dotaz
	fasety   FasetyGalerie
	slovy    hledaniSlovy
}

func (a *App) otiskGalerie() string {
	var n, maxID, soucet, tagu int64
	a.db.QueryRow(`SELECT COUNT(*), COALESCE(MAX(id), 0), COALESCE(SUM(hodnoceni * (id % 9973 + 1)), 0) FROM fotky`).Scan(&n, &maxID, &soucet)
	a.db.QueryRow(`SELECT COUNT(*) FROM fotky_tagy`).Scan(&tagu)
	var alba int64
	a.db.QueryRow(`SELECT COUNT(*) + COALESCE(SUM(LENGTH(album) + LENGTH(typ)), 0) FROM alba`).Scan(&alba)
	return fmt.Sprint(n, maxID, soucet, tagu, alba)
}

func (a *App) fotkyGalerie() []fotkaGalerie {
	fotky := a.doplnitDalsiModelky(a.nacistFotografie(vyberFotografii+`, COALESCE(m.jmeno, '')`+vyberPopisu+` FROM fotografie f
		JOIN modelky m ON m.id = f.modelka_id`+pripojeniPopisu+`
		ORDER BY f.id`, true, true))
	tagy := vsechnyTagyFotek(a.db)
	v := make([]fotkaGalerie, 0, len(fotky))
	videne := map[string]bool{}
	for _, f := range fotky {
		// Soubor ve víc albech (sdílené album) jen jednou
		if videne[f.DriveID] {
			continue
		}
		videne[f.DriveID] = true
		g := fotkaGalerie{f: f, tagy: map[string]bool{}}
		for _, t := range tagy[f.ID] {
			g.tagy[t] = true
		}
		if len(f.Vydani) >= 4 && f.Vydani[0] >= '1' && f.Vydani[0] <= '2' {
			g.dekada = f.Vydani[:3] + "0"
		}
		g.hledat = zjednodusit(strings.Join([]string{f.JmenoModelky, f.Album, f.Fotograf}, " "))
		v = append(v, g)
	}
	return v
}

// Stránka galerie všech fotek
func (a *App) GetGalerieFotek(d DotazGalerie) StrankaGalerie {
	v := StrankaGalerie{Fotky: []Fotografie{}, Od: d.Od}
	if a.db == nil {
		return v
	}
	d.Kolik = min(max(d.Kolik, 1), 600)
	otisk := a.otiskGalerie()
	p := &galeriePamet
	p.Lock()
	defer p.Unlock()
	if p.otisk != otisk || p.fotky == nil {
		p.fotky, p.otisk, p.klic = a.fotkyGalerie(), otisk, ""
	}
	h := fnv.New64a()
	fmt.Fprintf(h, "%s|%s|%v|%v|%v|%d|%s|%d|%s|%s|%v", d.Razeni, d.Srdicka, d.Typy, d.Tagy, d.Dekady, d.Modelka, d.Text, d.Seminko, d.Kolekce, time.Now().Format("2006-01-02"), a.obsah.StavHledaniSlovy().Pripraveno)
	klic := fmt.Sprintf("%x|%s", h.Sum64(), otisk)
	if p.klic != klic {
		p.serazene, p.fasety, p.slovy = a.vybratGalerii(p.fotky, d)
		p.klic = klic
	}
	v.Celkem, v.Fasety = len(p.serazene), p.fasety
	v.Obsahem, v.Rozpoznano, v.NabidnoutSlovy = p.slovy.podobnost != nil, p.slovy.jmeno, p.slovy.nabidnout
	for i := d.Od; i < len(p.serazene) && i < d.Od+d.Kolik; i++ {
		v.Fotky = append(v.Fotky, p.fotky[p.serazene[i]].f)
	}
	return v
}

// Filtr jedné fotky; vynechat = dimenze, která se pro počty v panelu nepočítá
func vyhovujeGalerii(g *fotkaGalerie, d DotazGalerie, text []string, vynechat string) bool {
	if d.Modelka > 0 && g.f.ModelkaID != d.Modelka {
		return false
	}
	for _, t := range text {
		if !strings.Contains(g.hledat, t) {
			return false
		}
	}
	if vynechat != "srdicka" && d.Srdicka != "" {
		switch d.Srdicka {
		case "0":
			if g.f.Hodnoceni > 0 {
				return false
			}
		default:
			var minH int
			fmt.Sscan(d.Srdicka, &minH)
			if g.f.Hodnoceni < minH {
				return false
			}
		}
	}
	if vynechat != "typy" && len(d.Typy) > 0 && !obsahuje(d.Typy, g.f.Typ) {
		return false
	}
	if vynechat != "dekady" && len(d.Dekady) > 0 && !obsahuje(d.Dekady, g.dekada) {
		return false
	}
	if vynechat != "tagy" {
		for _, t := range d.Tagy {
			if !g.tagy[t] {
				return false
			}
		}
	}
	return true
}

func obsahuje(seznam []string, hodnota string) bool {
	for _, s := range seznam {
		if s == hodnota {
			return true
		}
	}
	return false
}

func (a *App) vybratGalerii(fotky []fotkaGalerie, d DotazGalerie) ([]int, FasetyGalerie, hledaniSlovy) {
	// Příkazy chytrého hledání (vlasy:blond vyska:>175 srdicka:>=4 rok:1990-1999): srdíčka, rok a edice platí pro
	// fotku (její vydání), ostatní pro její modelku; zbylý text hledá jako dřív
	prikazy, zbytek := rozdelitPrikazyGalerie(d.Text)
	d.Text = zbytek
	filtrPrikazu := a.filtrPrikazuGalerie(prikazy)
	text := strings.Fields(zjednodusit(d.Text))
	// Textu neodpovídá jméno, album ani fotograf → hledat v obsahu fotek (s modelkou poznanou v textu)
	slovy := a.hledatSlovy(fotky, d.Text, text)
	if slovy.podobnost != nil {
		text = nil
		if slovy.modelka > 0 {
			d.Modelka = slovy.modelka
		}
	}
	fasety := FasetyGalerie{Srdicka: map[string]int{}, Typy: map[string]int{}, Tagy: map[string]int{}, Dekady: map[string]int{}}
	kolekce, _ := a.filtrKolekce(fotky, d.Kolekce)
	var vybrane []int
	for i := range fotky {
		g := &fotky[i]
		if kolekce != nil && !kolekce(g) {
			continue
		}
		// Indexy jdou do sdílené paměti galerie, proto se fotky nevyřazují ze seznamu, jen přeskočí
		if filtrPrikazu != nil && !filtrPrikazu(&g.f) {
			continue
		}
		if vyhovujeGalerii(g, d, text, "") {
			vybrane = append(vybrane, i)
		}
		if vyhovujeGalerii(g, d, text, "srdicka") {
			if g.f.Hodnoceni == 0 {
				fasety.Srdicka["0"]++
			}
			for h := 3; h <= 5; h++ {
				if g.f.Hodnoceni >= h {
					fasety.Srdicka[fmt.Sprint(h)]++
				}
			}
		}
		if vyhovujeGalerii(g, d, text, "typy") {
			fasety.Typy[g.f.Typ]++
		}
		if g.dekada != "" && vyhovujeGalerii(g, d, text, "dekady") {
			fasety.Dekady[g.dekada]++
		}
		if vyhovujeGalerii(g, d, text, "tagy") {
			for t := range g.tagy {
				fasety.Tagy[t]++
			}
		}
	}

	if slovy.podobnost != nil {
		return slovy.seradit(vybrane, fotky), fasety, slovy
	}

	// Klíč řazení
	skore := make(map[int]float64, len(vybrane))
	switch d.Razeni {
	case "nove":
		sort.SliceStable(vybrane, func(i, j int) bool {
			x, y := fotky[vybrane[i]].f, fotky[vybrane[j]].f
			if x.Pridano != y.Pridano {
				return x.Pridano > y.Pridano
			}
			return x.ID > y.ID
		})
		return vybrane, fasety, slovy
	case "nahodne":
		sort.SliceStable(vybrane, func(i, j int) bool {
			return nahodaKlice(fotky[vybrane[i]].f.ID, d.Seminko) < nahodaKlice(fotky[vybrane[j]].f.ID, d.Seminko)
		})
		return vybrane, fasety, slovy
	case "hodnota":
		modelky, _ := a.nactiModelky("", false)
		var oblibenost map[int]float64
		if a.uc != nil {
			oblibenost = a.modelOblibenosti(modelky).oblibenost
		}
		for _, i := range vybrane {
			f := fotky[i].f
			o := oblibenost[f.ModelkaID]
			if o == 0 {
				o = 2.5
			}
			skore[i] = float64(f.Hodnoceni) * o / 5
		}
	default: // "libi": srdíčka, u nehodnocených odhad z obsahu fotek
		var odhad map[string]float64
		if o := a.odhadySrdicekFotek(); o != nil {
			odhad = o.Nehodnocene
		}
		for _, i := range vybrane {
			f := fotky[i].f
			if f.Hodnoceni > 0 {
				skore[i] = float64(f.Hodnoceni) + 0.25
			} else {
				skore[i] = odhad[f.DriveID]
			}
		}
	}
	sort.SliceStable(vybrane, func(i, j int) bool {
		x, y := skore[vybrane[i]], skore[vybrane[j]]
		if x != y {
			return x > y
		}
		return nahodaKlice(fotky[vybrane[i]].f.ID, d.Seminko) < nahodaKlice(fotky[vybrane[j]].f.ID, d.Seminko)
	})
	return promichatAlba(vybrane, fotky), fasety, slovy
}

// Napříč modelkami: z jednoho alba nejvýš 2 fotky v každých 12 po sobě (jinak by nahoře bylo jedno focení);
// odložené fotky přijdou hned, jak to okno dovolí, takže pořadí podle skóre zůstane přibližně zachované
func promichatAlba(serazene []int, fotky []fotkaGalerie) []int {
	const okno, naAlbum = 12, 2
	vysledek := make([]int, 0, len(serazene))
	var odlozene []int
	vOkne := func(album int64) int {
		n := 0
		for k := max(0, len(vysledek)-okno); k < len(vysledek); k++ {
			if fotky[vysledek[k]].f.AlbumID == album {
				n++
			}
		}
		return n
	}
	pridat := func(i int) bool {
		if vOkne(fotky[i].f.AlbumID) < naAlbum {
			vysledek = append(vysledek, i)
			return true
		}
		return false
	}
	for _, i := range serazene {
		// Odložené napřed (jsou z vyššího skóre)
		zbyle := odlozene[:0]
		for _, o := range odlozene {
			if !pridat(o) {
				zbyle = append(zbyle, o)
			}
		}
		odlozene = zbyle
		if !pridat(i) {
			odlozene = append(odlozene, i)
		}
		// Neomezené odkládání by u galerie jedné modelky zastavilo; dlouhá fronta se pustí
		if len(odlozene) > 200 {
			vysledek = append(vysledek, odlozene[0])
			odlozene = odlozene[1:]
		}
	}
	return append(vysledek, odlozene...)
}

var vzorPrikazuGalerie = regexp.MustCompile(`(?:^|\s)([-!]?([\p{L}]+):\s*(?:(?:>=|<=|==|>|<|=)\s*\d+(?:[.,]\d+)?|(?:"[^"]*"|[^\s",:]+)(?:\s*,\s*(?:"[^"]*"|[^\s",:]+))*))`)

// Text galerie → příkazy hledání (známé klíče) a zbylý text
func rozdelitPrikazyGalerie(text string) (prikazy []string, zbytek string) {
	zbytek = vzorPrikazuGalerie.ReplaceAllStringFunc(text, func(cast string) string {
		s := vzorPrikazuGalerie.FindStringSubmatch(cast)
		if !hledani.JeZnamyKlic(s[2]) {
			return cast
		}
		prikazy = append(prikazy, s[1])
		return " "
	})
	return prikazy, strings.TrimSpace(zbytek)
}

// Klíče, které se v galerii posuzují podle fotky, ne podle modelky
var klicePodleFotky = map[string]bool{"srdicka": true, "hodnoceni": true, "rok": true, "edice": true, "vydani": true}

// Filtr fotek podle příkazů; nil = žádné příkazy
func (a *App) filtrPrikazuGalerie(prikazy []string) func(f *Fotografie) bool {
	if len(prikazy) == 0 {
		return nil
	}
	var proFotku, proModelku []string
	for _, p := range prikazy {
		klic := zjednodusit(strings.TrimLeft(p[:strings.Index(p, ":")], "-!"))
		if klicePodleFotky[klic] {
			proFotku = append(proFotku, p)
		} else {
			proModelku = append(proModelku, p)
		}
	}
	var modelky map[int]bool
	if len(proModelku) > 0 {
		nalezene, _ := a.nactiModelky(strings.Join(proModelku, " "), false)
		modelky = make(map[int]bool, len(nalezene))
		for _, m := range nalezene {
			modelky[m.ID] = true
		}
	}
	dotazFotky := hledani.Pripravit(strings.Join(proFotku, " "))
	return func(f *Fotografie) bool {
		if modelky != nil && !modelky[f.ModelkaID] {
			return false
		}
		if len(dotazFotky) == 0 {
			return true
		}
		// Fotka jako „modelka“ s jedním vydáním a svými srdíčky
		m := Modelka{Hodnoceni: float64(f.Hodnoceni)}
		if f.Vydani != "" {
			m.Vydani = []string{f.Vydani}
		}
		return dotazFotky.Odpovida(&m, nil)
	}
}
