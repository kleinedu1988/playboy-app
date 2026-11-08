package main

// Kolekce v Galerii (docs/NAVRH-GALERIE-KOLEKCE.md): pojmenované skupiny fotek, které program sestaví sám – z času
// (tento měsíc v historii, výročí, rok, desetiletí, narozeniny, nově přidané), ze vzhledu a kariéry modelek (vlasy,
// oblast původu, tetování, Playmate, centerfoldy, fotograf, dua), z tvého hodnocení (♥5, Top 10, nejslibnější
// nehodnocené) a z obrazových modelů (prostředí, oblečení, světlo, černobílá – tagy i návrhy z obsahu). Každý den
// se z nich vybere 10 řad: podle velikosti, jak se ti fotky asi líbí, kontextu (kalendář) a denní obměny; nejvýš
// 3 z jedné skupiny. Fotky v kolekci jsou seřazené jako „Co se ti asi líbí“. Beze změny schématu i exportu.

import (
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"playboy-app/internal/obsah"
)

// Řada kolekce pro Galerii
type KolekceGalerie struct {
	Klic    string       `json:"klic"`
	Nazev   string       `json:"nazev"`
	Duvod   string       `json:"duvod"`   // proč tahle kolekce („Vydání z listopadu napříč roky“)
	Skupina string       `json:"skupina"` // cas, vzhled, kariera, tvoje, obsah
	Pocet   int          `json:"pocet"`
	Fotky   []Fotografie `json:"fotky"` // nejlepší fotky do řady
}

const (
	rad             = 10
	fotekVRade      = 15
	minFotekKolekce = 8
	maxRadZeSkupiny = 3
	maxPodilKolekce = 0.6
)

type defKolekce struct {
	klic, nazev, duvod, skupina string
	kontext                     float64 // přednost podle dne (kalendář) – 1 = běžná
	plati                       func(g *fotkaGalerie) bool
}

// Údaje modelek pro kolekce
type modelkaKolekce struct {
	vlasy, oblast, narozeni, role string
	tetovani, piercing            bool
	poradi                        int
}

var nazvyMesicu = []string{"leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"}
var nazvyMesicu2 = []string{"ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"}

// Oblast původu z národnosti (jen národnost, ne etnicita – rozhodnutí 8. 11. 2026); USA je většina, kolekci nemá
func oblastPuvodu(narodnost string) string {
	n := zjednodusit(narodnost)
	switch {
	case n == "":
		return ""
	case strings.Contains(n, "norsk") || strings.Contains(n, "sved") || strings.Contains(n, "dans") || strings.Contains(n, "finsk") || strings.Contains(n, "island"):
		return "Ze Skandinávie"
	case strings.Contains(n, "kanad"):
		return "Z Kanady"
	case strings.Contains(n, "cesk") || strings.Contains(n, "sloven") || strings.Contains(n, "polsk") || strings.Contains(n, "madar") || strings.Contains(n, "rus") || strings.Contains(n, "ukrajin"):
		return "Ze střední a východní Evropy"
	case strings.Contains(n, "nemec") || strings.Contains(n, "brit") || strings.Contains(n, "kralovstvi") || strings.Contains(n, "nizozem") || strings.Contains(n, "franc") || strings.Contains(n, "ital") || strings.Contains(n, "span") || strings.Contains(n, "irsk") || strings.Contains(n, "maltsk") || strings.Contains(n, "belg") || strings.Contains(n, "rakous") || strings.Contains(n, "svycar") || strings.Contains(n, "portugal") || strings.Contains(n, "reck"):
		return "Z Evropy"
	case strings.Contains(n, "mexi") || strings.Contains(n, "brazil") || strings.Contains(n, "kolumb") || strings.Contains(n, "argent") || strings.Contains(n, "venezu") || strings.Contains(n, "kub") || strings.Contains(n, "portorik") || strings.Contains(n, "dominik"):
		return "Z Latinské Ameriky"
	case strings.Contains(n, "japon") || strings.Contains(n, "cin") || strings.Contains(n, "filip") || strings.Contains(n, "thaj") || strings.Contains(n, "korej") || strings.Contains(n, "vietnam") || strings.Contains(n, "indi"):
		return "Z Asie"
	case strings.Contains(n, "austral") || strings.Contains(n, "zeland"):
		return "Z Austrálie a Nového Zélandu"
	}
	return ""
}

func vlasyKolekce(vlasy string) string {
	v := zjednodusit(vlasy)
	switch {
	case strings.Contains(v, "blond"):
		return "Blondýnky"
	case strings.Contains(v, "zrzav") || strings.Contains(v, "rysav") || strings.Contains(v, "cerven"):
		return "Zrzky"
	case strings.Contains(v, "cern"):
		return "Černovlásky"
	case strings.Contains(v, "hned") || strings.Contains(v, "kastan"):
		return "Brunetky"
	}
	return ""
}

// Náhodné číslo 0–1 stálé pro den a klíč (denní obměna kolekcí)
func nahodaDne(den, klic string) float64 {
	h := fnv.New64a()
	h.Write([]byte(den + "|" + klic))
	return float64(h.Sum64()%10000) / 10000
}

// Definice kolekcí na daný den
func (a *App) definiceKolekci(fotky []fotkaGalerie, dk *dataKolekce, nyni time.Time) []defKolekce {
	modelky, tagyObsahu := dk.modelky, dk.tagy
	den := nyni.Format("2006-01-02")
	mesic := int(nyni.Month())
	rokNyni := nyni.Year()
	var defs []defKolekce
	pridat := func(d defKolekce) { defs = append(defs, d) }
	rokFotky := func(g *fotkaGalerie) int {
		if len(g.f.Vydani) < 4 {
			return 0
		}
		r, _ := strconv.Atoi(g.f.Vydani[:4])
		return r
	}
	mesicFotky := func(g *fotkaGalerie) int {
		if len(g.f.Vydani) < 7 || g.f.Vydani[4] != '-' {
			return 0
		}
		m, _ := strconv.Atoi(g.f.Vydani[5:7])
		return m
	}
	maTag := func(g *fotkaGalerie, tag string) bool {
		return g.tagy[tag] || tagyObsahu[g.f.DriveID][tag]
	}

	// --- Čas ---
	pridat(defKolekce{klic: "cas:mesic", nazev: "Tento měsíc v historii", skupina: "cas", kontext: 1.4,
		duvod: fmt.Sprintf("Čísla z %s napříč roky", nazvyMesicu2[mesic-1]),
		plati: func(g *fotkaGalerie) bool { return mesicFotky(g) == mesic }})
	for _, n := range []int{50, 40, 30, 25, 20, 10} {
		rok := rokNyni - n
		pridat(defKolekce{klic: fmt.Sprintf("cas:vyroci:%d", n), nazev: fmt.Sprintf("Před %d lety", n), skupina: "cas", kontext: 1.5,
			duvod: fmt.Sprintf("%s %d", strings.ToUpper(nazvyMesicu[mesic-1][:1])+nazvyMesicu[mesic-1][1:], rok),
			plati: func(g *fotkaGalerie) bool { return rokFotky(g) == rok && mesicFotky(g) == mesic }})
	}
	// Rok a desetiletí: jeden rok a jedno desetiletí denně (z těch s dost fotkami)
	poctyRoku, poctyDekad := map[int]int{}, map[string]int{}
	for i := range fotky {
		if r := rokFotky(&fotky[i]); r > 0 {
			poctyRoku[r]++
		}
		if d := fotky[i].dekada; d != "" {
			poctyDekad[d]++
		}
	}
	vybratDne := func(klice []string, klic string) string {
		if len(klice) == 0 {
			return ""
		}
		sort.Strings(klice)
		return klice[int(nahodaDne(den, klic)*float64(len(klice)))%len(klice)]
	}
	var roky, dekady []string
	for r, n := range poctyRoku {
		if n >= 30 {
			roky = append(roky, strconv.Itoa(r))
		}
	}
	for d, n := range poctyDekad {
		if n >= 50 {
			dekady = append(dekady, d)
		}
	}
	if r := vybratDne(roky, "rok"); r != "" {
		rok, _ := strconv.Atoi(r)
		pridat(defKolekce{klic: "cas:rok:" + r, nazev: "Rok " + r, skupina: "cas", kontext: 1, duvod: "Všechna čísla a alba roku " + r,
			plati: func(g *fotkaGalerie) bool { return rokFotky(g) == rok }})
	}
	if d := vybratDne(dekady, "dekada"); d != "" {
		pridat(defKolekce{klic: "cas:dekada:" + d, nazev: d[2:] + ". léta", skupina: "cas", kontext: 1, duvod: fmt.Sprintf("Fotky z let %s–%s", d, d[:3]+"9"),
			plati: func(g *fotkaGalerie) bool { return g.dekada == d }})
	}
	pridat(defKolekce{klic: "cas:narozeniny", nazev: "Narozeniny tento týden", skupina: "cas", kontext: 1.6, duvod: "Modelky, které mají kolem dneška narozeniny",
		plati: func(g *fotkaGalerie) bool {
			n := modelky[g.f.ModelkaID].narozeni
			if len(n) < 10 {
				return false
			}
			d, err := time.Parse("2006-01-02", strconv.Itoa(rokNyni)+n[4:10])
			return err == nil && math.Abs(d.Sub(nyni).Hours()) <= 3.5*24
		}})
	mesicZpet := nyni.AddDate(0, -1, 0).Format("2006-01-02")
	pridat(defKolekce{klic: "cas:nove", nazev: "Nově přidané", skupina: "cas", kontext: 1.2, duvod: "Fotky přidané za poslední měsíc",
		plati: func(g *fotkaGalerie) bool { return g.f.Pridano >= mesicZpet }})

	// --- Vzhled (údaje modelek) ---
	for _, v := range []string{"Blondýnky", "Brunetky", "Černovlásky", "Zrzky"} {
		pridat(defKolekce{klic: "vzhled:vlasy:" + zjednodusit(v), nazev: v, skupina: "vzhled", kontext: 1, duvod: "Podle barvy vlasů v údajích modelky",
			plati: func(g *fotkaGalerie) bool { return modelky[g.f.ModelkaID].vlasy == v }})
	}
	oblasti := map[string]bool{}
	for _, m := range modelky {
		if m.oblast != "" {
			oblasti[m.oblast] = true
		}
	}
	for o := range oblasti {
		pridat(defKolekce{klic: "vzhled:oblast:" + zjednodusit(o), nazev: o, skupina: "vzhled", kontext: 1, duvod: "Podle národnosti v údajích modelky",
			plati: func(g *fotkaGalerie) bool { return modelky[g.f.ModelkaID].oblast == o }})
	}
	pridat(defKolekce{klic: "vzhled:tetovani", nazev: "S tetováním", skupina: "vzhled", kontext: 0.9, duvod: "Modelky s tetováním",
		plati: func(g *fotkaGalerie) bool { return modelky[g.f.ModelkaID].tetovani }})
	pridat(defKolekce{klic: "vzhled:piercing", nazev: "S piercingem", skupina: "vzhled", kontext: 0.9, duvod: "Modelky s piercingem",
		plati: func(g *fotkaGalerie) bool { return modelky[g.f.ModelkaID].piercing }})

	// --- Kariéra a časopis ---
	pridat(defKolekce{klic: "kariera:centerfoldy", nazev: "Centerfoldy", skupina: "kariera", kontext: 1, duvod: "Rozkládací plakáty ze středu čísla",
		plati: func(g *fotkaGalerie) bool { return g.f.Typ == "Centerfold" }})
	pridat(defKolekce{klic: "kariera:playmate-roku", nazev: "Playmate roku", skupina: "kariera", kontext: 1.1, duvod: "Modelky s titulem Playmate roku",
		plati: func(g *fotkaGalerie) bool { return strings.Contains(modelky[g.f.ModelkaID].role, "PMOTY") }})
	pridat(defKolekce{klic: "kariera:online", nazev: "Online pictorialy", skupina: "kariera", kontext: 0.9, duvod: "Alba z webu Playboy",
		plati: func(g *fotkaGalerie) bool { return g.f.Typ == "Pictorial online" }})
	pridat(defKolekce{klic: "kariera:duo", nazev: "Dua a skupiny", skupina: "kariera", kontext: 1, duvod: "Alba, ve kterých je víc modelek",
		plati: func(g *fotkaGalerie) bool { return len(g.f.DalsiModelky) > 0 }})
	poctyFotografu := map[string]int{}
	for i := range fotky {
		for _, j := range strings.Split(fotky[i].f.Fotograf, ",") {
			if j = strings.TrimSpace(j); j != "" {
				poctyFotografu[j]++
			}
		}
	}
	var fotografove []string
	for j, n := range poctyFotografu {
		if n >= 30 {
			fotografove = append(fotografove, j)
		}
	}
	if j := vybratDne(fotografove, "fotograf"); j != "" {
		pridat(defKolekce{klic: "kariera:fotograf:" + j, nazev: "Fotí " + j, skupina: "kariera", kontext: 1, duvod: "Dílo jednoho fotografa napříč modelkami",
			plati: func(g *fotkaGalerie) bool { return strings.Contains(g.f.Fotograf, j) }})
	}

	// --- Tvoje hodnocení ---
	pridat(defKolekce{klic: "tvoje:5", nazev: "Tvoje ♥5", skupina: "tvoje", kontext: 1.1, duvod: "Fotky, které jsi ohodnotil pěti srdíčky",
		plati: func(g *fotkaGalerie) bool { return g.f.Hodnoceni == 5 }})
	pridat(defKolekce{klic: "tvoje:top10", nazev: "Top 10", skupina: "tvoje", kontext: 1.2, duvod: "Fotky tvých deseti nejoblíbenějších modelek",
		plati: func(g *fotkaGalerie) bool { p := modelky[g.f.ModelkaID].poradi; return p > 0 && p <= 10 }})
	if dk.prahPokladu > 0 {
		pridat(defKolekce{klic: "tvoje:poklady", nazev: "Skryté poklady", skupina: "tvoje", kontext: 1.3, duvod: "Nehodnocené fotky, které by se ti podle obsahu měly líbit nejvíc",
			plati: func(g *fotkaGalerie) bool { return g.f.Hodnoceni == 0 && dk.odhad[g.f.DriveID] >= dk.prahPokladu }})
	}

	// --- Obsah fotek (tagy i návrhy obrazových modelů) ---
	obsahove := []struct{ tag, nazev, duvod string }{
		{"plaz", "Na pláži", "Pláž a moře"}, {"bazen", "U bazénu", "Bazén"}, {"studio", "Ve studiu", "Studiové fotky"},
		{"koupelna", "V koupelně", "Koupelna, vana, sprcha"}, {"priroda", "V přírodě", "Les, louka, příroda"},
		{"auto", "Auta a motorky", "S autem nebo motorkou"}, {"bikiny", "V bikinách", "Bikiny"}, {"podpatky", "Na podpatcích", "Podpatky"},
		{"latex", "Latex a kůže", "Latex nebo kůže"}, {"saty", "V šatech", "Šaty"}, {"dziny", "V džínách", "Džíny"},
		{"zlata_hodina", "Zlatá hodina", "Teplé světlo při západu slunce"}, {"low_key", "Noir", "Tmavé fotky s hlubokými stíny"},
		{"high_key", "Světlé a vzdušné", "High-key"}, {"cernobila", "Černobílé", "Černobílé fotky"},
	}
	for _, o := range obsahove {
		tag := o.tag
		pridat(defKolekce{klic: "obsah:" + tag, nazev: o.nazev, skupina: "obsah", kontext: 1, duvod: o.duvod + " – podle tagů a obsahu fotek",
			plati: func(g *fotkaGalerie) bool { return maTag(g, tag) }})
	}
	return defs
}

// Data pro kolekce: údaje modelek, tagy z obsahu fotek (návrhy obrazových modelů) a odhad srdíček; v paměti, dokud
// se nezmění fotky, hodnocení ani spočítaný obsah (výpočet tagů pro celou sbírku ~1 s)
type dataKolekce struct {
	modelky     map[int]modelkaKolekce
	tagy        map[string]map[string]bool
	odhad       map[string]float64
	prahPokladu float64 // odhad, od kterého je nehodnocená fotka „skrytý poklad“ (horních 10 %)
}

var kolekcePamet struct {
	sync.Mutex
	klic string
	data *dataKolekce
}

func (a *App) dataKolekci(fotky []fotkaGalerie) *dataKolekce {
	klic := a.otiskGalerie()
	if a.obsah != nil {
		klic += fmt.Sprint("|", a.obsah.Stav().Vektoru, "|", a.obsah.PocetPartii())
	}
	p := &kolekcePamet
	p.Lock()
	defer p.Unlock()
	if p.klic == klic && p.data != nil {
		return p.data
	}
	modelky, tagy := a.spocitatDataKolekci(fotky)
	dk := &dataKolekce{modelky: modelky, tagy: tagy, odhad: map[string]float64{}}
	if o := a.odhadySrdicekFotek(); o != nil {
		dk.odhad = o.Nehodnocene
		var hodnoty []float64
		for _, x := range o.Nehodnocene {
			hodnoty = append(hodnoty, x)
		}
		if len(hodnoty) >= 50 {
			sort.Float64s(hodnoty)
			dk.prahPokladu = hodnoty[len(hodnoty)*9/10]
		}
	}
	p.klic, p.data = klic, dk
	return dk
}

func (a *App) spocitatDataKolekci(fotky []fotkaGalerie) (map[int]modelkaKolekce, map[string]map[string]bool) {
	seznam, _ := a.nactiModelky("", false)
	var poradi map[int]int
	if a.uc != nil {
		poradi = a.modelOblibenosti(seznam).poradi
	}
	modelky := make(map[int]modelkaKolekce, len(seznam))
	for _, m := range seznam {
		modelky[m.ID] = modelkaKolekce{vlasy: vlasyKolekce(m.VlasyBarva), oblast: oblastPuvodu(m.Narodnost), narozeni: m.NarozeniDatum,
			role: m.Role, tetovani: m.Tetovani == 1, piercing: m.Piercing == 1, poradi: poradi[m.ID]}
	}
	tagy := map[string]map[string]bool{}
	if a.obsah != nil && a.obsah.Zapnuto() {
		for i := range fotky {
			id := fotky[i].f.DriveID
			v, p := a.obsah.Vektor(id), a.obsah.Partie(id)
			if v == nil && p == nil {
				continue
			}
			m := map[string]bool{}
			for _, n := range obsah.NavrhnoutTagy(v, p) {
				m[n.Tag] = true
			}
			tagy[id] = m
		}
	}
	return modelky, tagy
}

// Skóre „Co se ti asi líbí“ pro fotky (srdíčka, u nehodnocených odhad z obsahu)
func (a *App) skoreLibi(fotky []fotkaGalerie) []float64 {
	var odhad map[string]float64
	if o := a.odhadySrdicekFotek(); o != nil {
		odhad = o.Nehodnocene
	}
	s := make([]float64, len(fotky))
	for i := range fotky {
		if h := fotky[i].f.Hodnoceni; h > 0 {
			s[i] = float64(h) + 0.25
		} else {
			s[i] = odhad[fotky[i].f.DriveID]
		}
	}
	return s
}

// Kolekce na dnešek: 10 řad s nejlepšími fotkami
func (a *App) GetKolekceGalerie() []KolekceGalerie {
	v := []KolekceGalerie{}
	if a.db == nil {
		return v
	}
	otisk := a.otiskGalerie()
	p := &galeriePamet
	p.Lock()
	if p.otisk != otisk || p.fotky == nil {
		p.fotky, p.otisk, p.klic = a.fotkyGalerie(), otisk, ""
	}
	fotky := p.fotky
	p.Unlock()

	nyni := time.Now()
	den := nyni.Format("2006-01-02")
	dk := a.dataKolekci(fotky)
	skore := a.skoreLibi(fotky)
	type kandidat struct {
		d       defKolekce
		indexy  []int
		hodnota float64
	}
	var kandidati []kandidat
	for _, d := range a.definiceKolekci(fotky, dk, nyni) {
		var indexy []int
		for i := range fotky {
			if d.plati(&fotky[i]) {
				indexy = append(indexy, i)
			}
		}
		// Moc malá, nebo skoro celá sbírka (např. „nově přidané“ po prvním importu) – nic by neřekla
		if len(indexy) < minFotekKolekce || float64(len(indexy)) > maxPodilKolekce*float64(len(fotky)) {
			continue
		}
		sort.SliceStable(indexy, func(x, y int) bool { return skore[indexy[x]] > skore[indexy[y]] })
		// Hodnota: průměr nejlepších fotek × velikost (log) × kontext dne × denní obměna
		var soucet float64
		k := min(len(indexy), 20)
		for _, i := range indexy[:k] {
			soucet += skore[i]
		}
		hodnota := (soucet/float64(k) + 0.5) * math.Log10(float64(len(indexy))+10) * d.kontext * (0.7 + 0.6*nahodaDne(den, d.klic))
		kandidati = append(kandidati, kandidat{d, indexy, hodnota})
	}
	sort.SliceStable(kandidati, func(i, j int) bool { return kandidati[i].hodnota > kandidati[j].hodnota })
	zeSkupiny := map[string]int{}
	for _, k := range kandidati {
		if len(v) >= rad {
			break
		}
		if zeSkupiny[k.d.skupina] >= maxRadZeSkupiny {
			continue
		}
		zeSkupiny[k.d.skupina]++
		r := KolekceGalerie{Klic: k.d.klic, Nazev: k.d.nazev, Duvod: k.d.duvod, Skupina: k.d.skupina, Pocet: len(k.indexy), Fotky: []Fotografie{}}
		for _, i := range promichatAlba(k.indexy, fotky)[:min(fotekVRade, len(k.indexy))] {
			r.Fotky = append(r.Fotky, fotky[i].f)
		}
		v = append(v, r)
	}
	return v
}

// Predikát kolekce podle klíče (filtr Galerie „Zobrazit vše“); nil = neznámá kolekce
func (a *App) filtrKolekce(fotky []fotkaGalerie, klic string) (func(g *fotkaGalerie) bool, string) {
	if klic == "" {
		return nil, ""
	}
	for _, d := range a.definiceKolekci(fotky, a.dataKolekci(fotky), time.Now()) {
		if d.klic == klic {
			return d.plati, d.nazev
		}
	}
	return nil, ""
}
