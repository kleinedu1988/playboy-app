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
	hodnoceni                     float64
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
	// Stejně staré v době focení: věk z data narození a data alba nebo čísla, jeden věk denně (s dost fotkami)
	vekFotky := func(g *fotkaGalerie) int {
		n := modelky[g.f.ModelkaID].narozeni
		datum := g.f.DatumAlba
		if datum == "" {
			datum = g.f.Vydani
		}
		if len(n) < 4 || len(datum) < 4 {
			return 0
		}
		rn, e1 := strconv.Atoi(n[:4])
		rf, e2 := strconv.Atoi(datum[:4])
		if e1 != nil || e2 != nil || rf < rn {
			return 0
		}
		vek := rf - rn
		// S měsícem narození i focení: před narozeninami o rok méně
		if len(n) >= 7 && len(datum) >= 7 && datum[4] == '-' && datum[5] != 'S' && datum[5:7] < n[5:7] {
			vek--
		}
		if vek < 18 || vek > 70 {
			return 0
		}
		return vek
	}
	poctyVeku := map[int]int{}
	for i := range fotky {
		if v := vekFotky(&fotky[i]); v > 0 {
			poctyVeku[v]++
		}
	}
	var veky []string
	for v, n := range poctyVeku {
		if n >= 30 {
			veky = append(veky, fmt.Sprintf("%02d", v))
		}
	}
	if v := vybratDne(veky, "vek"); v != "" {
		vek, _ := strconv.Atoi(v)
		pridat(defKolekce{klic: "cas:vek:" + strconv.Itoa(vek), nazev: fmt.Sprintf("%d let v době focení", vek), skupina: "cas", kontext: 1.2,
			duvod: "Modelky stejně staré v době focení (z data narození a data alba)",
			plati: func(g *fotkaGalerie) bool { return vekFotky(g) == vek }})
	}
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

	// --- Strojové učení nad obsahem (etapa 4) ---
	pridat(defKolekce{klic: "tvoje:foceni", nazev: "Nejlepší snímek každého focení", skupina: "tvoje", kontext: 1.1,
		duvod: "Z každého alba jedna fotka – s nejvíc srdíčky, jinak s nejvyšším odhadem z obsahu",
		plati: func(g *fotkaGalerie) bool { return dk.reprezentant[g.f.DriveID] }})
	if len(dk.doporucenaAlba) > 0 {
		pridat(defKolekce{klic: "tvoje:alba", nazev: "Focení, která jsi ještě nehodnotil", skupina: "tvoje", kontext: 1.25,
			duvod: "Alba bez srdíček, která by se ti podle obsahu měla líbit nejvíc – z každého jedna fotka",
			plati: func(g *fotkaGalerie) bool { return dk.doporucenaAlba[g.f.AlbumID] && dk.reprezentant[g.f.DriveID] }})
	}
	if len(dk.bublina) > 0 {
		pridat(defKolekce{klic: "tvoje:bublina", nazev: "Mimo tvou bublinu", skupina: "tvoje", kontext: 1.15,
			duvod: "Tvoje oblíbené modelky ve stylu, jaký obvykle nehodnotíš nejvýš",
			plati: func(g *fotkaGalerie) bool { return dk.bublina[g.f.DriveID] }})
	}

	// --- Objevené styly (shluky obsahu pojmenované obrazovým modelem; jen dost velké a s jistým názvem) ---
	for _, st := range dk.styly {
		if st.Shoda < minShodaStylu || len(st.Fotky) < minFotekStylu {
			continue
		}
		klic := st.Klic
		pridat(defKolekce{klic: "styl:" + klic, nazev: st.Nazev, skupina: "styl", kontext: 1.1,
			duvod: "Objevený styl – program sám seskupil fotky podobné obsahem",
			plati: func(g *fotkaGalerie) bool { return dk.stylFotky[g.f.DriveID] == klic }})
	}

	// --- Barvy a kvalita snímku (počítané z náhledu; prahy ověřené na ukázkách sbírky) ---
	if len(dk.vzhled) > 0 {
		barva := func(klic, nazev, duvod string, plati func(v obsah.VzhledFotky) bool) {
			pridat(defKolekce{klic: "barvy:" + klic, nazev: nazev, skupina: "barvy", kontext: 1, duvod: duvod,
				plati: func(g *fotkaGalerie) bool {
					v, ok := dk.vzhled[g.f.DriveID]
					return ok && plati(v)
				}})
		}
		o := func(v obsah.VzhledFotky, odstiny ...int) float64 {
			s := 0.0
			for _, i := range odstiny {
				s += v.Odstiny[i]
			}
			return s * v.Barevnost
		}
		barva("cervena", "V červené", "Červená zabírá aspoň čtvrtinu fotky – pozadí, prádlo, pohovka",
			func(v obsah.VzhledFotky) bool { return o(v, 0)+o(v, 11)/2 >= 0.25 })
		barva("modra", "V modré", "Modrá a tyrkysová – voda, obloha, modré studio",
			func(v obsah.VzhledFotky) bool { return o(v, 6, 7, 8) >= 0.12 })
		barva("zelena", "V zeleni", "Hodně zelené – tráva, listí, zahrady",
			func(v obsah.VzhledFotky) bool { return o(v, 3, 4, 5) >= 0.05 })
		barva("ruzova", "Růžová a fialová", "Růžové, purpurové a fialové barvy",
			func(v obsah.VzhledFotky) bool { return o(v, 9, 10, 11) >= 0.05 })
		barva("syte", "Sytě barevné", "Výrazné syté barvy mimo tóny pleti",
			func(v obsah.VzhledFotky) bool { return (1-v.Odstiny[1])*v.Barevnost >= 0.4 })
		if dk.prahTeple > 0 {
			barva("teple", "Teplé tóny", "Nejteplejší barvy ve sbírce – zlatá, oranžová, jantarová",
				func(v obsah.VzhledFotky) bool { return v.Teplota >= dk.prahTeple })
			barva("chladne", "Chladné tóny", "Nejchladnější barevné fotky – modravé světlo, voda, noc",
				func(v obsah.VzhledFotky) bool { return v.Sytost >= 0.1 && v.Teplota <= dk.prahChladne })
			barva("mekke", "Měkký snový filtr", "Nejměkčí fotky – soft focus a snový opar, typicky 70. léta",
				func(v obsah.VzhledFotky) bool { return v.Ostrost <= dk.prahMekke })
			barva("textury", "Vzory a textury", "Nejvíc jemného detailu – vzorované látky, tráva, kůra, krajky",
				func(v obsah.VzhledFotky) bool { return v.Ostrost >= dk.prahTextury })
		}
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

	// Strojové učení nad spočítaným obsahem (etapa 4 návrhu)
	reprezentant   map[string]bool   // nejlepší fotka každého alba (srdíčka, jinak odhad z obsahu)
	doporucenaAlba map[int64]bool    // alba bez hodnocených fotek s nejvyšším průměrným odhadem (horních 15 %)
	bublina        map[string]bool   // fotky oblíbených modelek (♥4+), obsahem nejdál od tvých ♥4+ fotek
	styly          []obsah.Styl      // objevené styly (shluky obsahu s názvem)
	stylFotky      map[string]string // ID souboru → klíč stylu

	// Barvy a kvalita snímku (obsah/vzhled.go) a prahy z rozložení ve sbírce
	vzhled                 map[string]obsah.VzhledFotky
	prahTeple, prahChladne float64 // teplota: horních / dolních 5 % (chladné jen barevné fotky)
	prahMekke, prahTextury float64 // ostrost na náhledu: dolních / horních 6 %
}

var kolekcePamet struct {
	sync.Mutex
	klic string
	data *dataKolekce
}

func (a *App) dataKolekci(fotky []fotkaGalerie) *dataKolekce {
	klic := a.otiskGalerie()
	var styly []obsah.Styl
	if a.obsah != nil {
		styly = a.obsah.Styly()
		klic += fmt.Sprint("|", a.obsah.Stav().Vektoru, "|", a.obsah.PocetPartii(), "|", len(styly), "|", a.obsah.PocetVzhledu())
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
	a.strojoveUceniKolekci(fotky, dk)
	if a.obsah != nil {
		dk.vzhled = a.obsah.VzhledFotek()
		prahyVzhledu(dk)
	}
	dk.styly, dk.stylFotky = styly, map[string]string{}
	for _, st := range styly {
		for _, id := range st.Fotky {
			dk.stylFotky[id] = st.Klic
		}
	}
	p.klic, p.data = klic, dk
	return dk
}

// Kolekce ze strojového učení: reprezentant focení, doporučená alba, mimo tvou bublinu
func (a *App) strojoveUceniKolekci(fotky []fotkaGalerie, dk *dataKolekce) {
	dk.reprezentant, dk.doporucenaAlba, dk.bublina = map[string]bool{}, map[int64]bool{}, map[string]bool{}
	skore := func(g *fotkaGalerie) float64 {
		if g.f.Hodnoceni > 0 {
			return float64(g.f.Hodnoceni) + 0.25
		}
		return dk.odhad[g.f.DriveID]
	}
	type album struct {
		nej              string
		nejSkore, soucet float64
		pocet            int
		hodnocene        bool
	}
	alba := map[int64]*album{}
	for i := range fotky {
		g := &fotky[i]
		al := alba[g.f.AlbumID]
		if al == nil {
			al = &album{nejSkore: -1}
			alba[g.f.AlbumID] = al
		}
		if s := skore(g); s > al.nejSkore {
			al.nej, al.nejSkore = g.f.DriveID, s
		}
		al.soucet += dk.odhad[g.f.DriveID]
		al.pocet++
		if g.f.Hodnoceni > 0 {
			al.hodnocene = true
		}
	}
	var prumery []float64
	for _, al := range alba {
		if al.nej != "" {
			dk.reprezentant[al.nej] = true
		}
		if !al.hodnocene && al.pocet >= 3 {
			prumery = append(prumery, al.soucet/float64(al.pocet))
		}
	}
	if len(prumery) >= 10 {
		sort.Float64s(prumery)
		prah := prumery[len(prumery)*85/100]
		for id, al := range alba {
			if !al.hodnocene && al.pocet >= 3 && al.soucet/float64(al.pocet) >= prah {
				dk.doporucenaAlba[id] = true
			}
		}
	}
	// Mimo bublinu: střed vkusu = průměrný obsah tvých ♥4+ fotek; z fotek modelek s ♥4+ ty nejvzdálenější (20 %)
	if a.obsah == nil || !a.obsah.Zapnuto() {
		return
	}
	var oblibene []string
	for i := range fotky {
		if fotky[i].f.Hodnoceni >= 4 {
			oblibene = append(oblibene, fotky[i].f.DriveID)
		}
	}
	if len(oblibene) < 20 {
		return
	}
	podobnost := a.obsah.PodobnostiKeStredu(oblibene)
	var kandidati []string
	var hodnoty []float64
	for i := range fotky {
		g := &fotky[i]
		p, ok := podobnost[g.f.DriveID]
		if ok && g.f.Hodnoceni < 4 && dk.modelky[g.f.ModelkaID].hodnoceni >= 4 {
			kandidati = append(kandidati, g.f.DriveID)
			hodnoty = append(hodnoty, p)
		}
	}
	if len(hodnoty) < 20 {
		return
	}
	serazene := append([]float64(nil), hodnoty...)
	sort.Float64s(serazene)
	prah := serazene[len(serazene)/5]
	for i, id := range kandidati {
		if hodnoty[i] <= prah {
			dk.bublina[id] = true
		}
	}
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
			role: m.Role, tetovani: m.Tetovani == 1, piercing: m.Piercing == 1, poradi: poradi[m.ID], hodnoceni: m.Hodnoceni}
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
	fotky := a.fotkyGalerieVPameti()
	kandidati := a.kandidatiKolekci(fotky)
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
		// Téměř stejné snímky (podobnost obsahu ≥ 0,95) v řadě jen jednou
		for _, i := range promichatAlba(k.indexy, fotky) {
			if len(r.Fotky) >= fotekVRade {
				break
			}
			if a.temerStejna(fotky[i].f.DriveID, r.Fotky) {
				continue
			}
			r.Fotky = append(r.Fotky, fotky[i].f)
		}
		v = append(v, r)
	}
	return v
}

// Fotky Galerie (z mezipaměti, když se sbírka nezměnila)
func (a *App) fotkyGalerieVPameti() []fotkaGalerie {
	otisk := a.otiskGalerie()
	p := &galeriePamet
	p.Lock()
	defer p.Unlock()
	if p.otisk != otisk || p.fotky == nil {
		p.fotky, p.otisk, p.klic = a.fotkyGalerie(), otisk, ""
	}
	return p.fotky
}

type kandidatKolekce struct {
	d       defKolekce
	indexy  []int // fotky kolekce od té, která se ti asi líbí nejvíc
	hodnota float64
}

// Všechny platné kolekce (aspoň 8 fotek, nejvýš 60 % sbírky) s hodnotou pro dnešní výběr řad
func (a *App) kandidatiKolekci(fotky []fotkaGalerie) []kandidatKolekce {
	nyni := time.Now()
	den := nyni.Format("2006-01-02")
	dk := a.dataKolekci(fotky)
	skore := a.skoreLibi(fotky)
	var kandidati []kandidatKolekce
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
		kandidati = append(kandidati, kandidatKolekce{d, indexy, hodnota})
	}
	return kandidati
}

// Kolekce v panelu kolekcí: všechny platné, s titulní fotkou (ta, která se ti asi líbí nejvíc)
type PrehledKolekce struct {
	Klic    string     `json:"klic"`
	Nazev   string     `json:"nazev"`
	Duvod   string     `json:"duvod"`
	Skupina string     `json:"skupina"`
	Pocet   int        `json:"pocet"`
	Fotka   Fotografie `json:"fotka"`
}

// Pořadí skupin v panelu kolekcí
var poradiSkupinKolekci = map[string]int{"tvoje": 0, "cas": 1, "styl": 2, "barvy": 3, "obsah": 4, "vzhled": 5, "kariera": 6}

// GetVsechnyKolekce: panel kolekcí v Galerii – všechny kolekce po skupinách, ve skupině od největší
func (a *App) GetVsechnyKolekce() []PrehledKolekce {
	v := []PrehledKolekce{}
	if a.db == nil {
		return v
	}
	fotky := a.fotkyGalerieVPameti()
	for _, k := range a.kandidatiKolekci(fotky) {
		v = append(v, PrehledKolekce{Klic: k.d.klic, Nazev: k.d.nazev, Duvod: k.d.duvod, Skupina: k.d.skupina, Pocet: len(k.indexy), Fotka: fotky[k.indexy[0]].f})
	}
	sort.SliceStable(v, func(i, j int) bool {
		if v[i].Skupina != v[j].Skupina {
			return poradiSkupinKolekci[v[i].Skupina] < poradiSkupinKolekci[v[j].Skupina]
		}
		return v[i].Pocet > v[j].Pocet
	})
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

// Téměř stejný snímek jako některý už vybraný (různé ořezy, sousední záběry)
const prahTemerStejne = 0.95

func (a *App) temerStejna(id string, vybrane []Fotografie) bool {
	if a.obsah == nil {
		return false
	}
	for _, f := range vybrane {
		if a.obsah.Podobnost(id, f.DriveID) >= prahTemerStejne {
			return true
		}
	}
	return false
}

// Objevený styl je kolekcí jen s dost jistým názvem (podobnost středu a popisu; pod ~0,265 názvy často nesedí –
// ověřeno proti návrhům tagů) a aspoň 100 fotkami
const (
	minShodaStylu = 0.265
	minFotekStylu = 100
)

// Objevené styly: spočítat, když chybí nebo jsou zastaralé (na úvodní obrazovce, ~6 s)
func (a *App) stylyFotek() {
	if a.obsah == nil || !a.obsah.Zapnuto() || a.obsah.Styly() != nil {
		return
	}
	_ = a.obsah.SpocitatStyly() // bez stylů jen nebudou jejich kolekce
}

// Prahy barevných kolekcí z rozložení ve sbírce (aspoň 200 fotek se vzhledem)
func prahyVzhledu(dk *dataKolekce) {
	if len(dk.vzhled) < 200 {
		return
	}
	var teplota, barevnaTeplota, ostrost []float64
	for _, v := range dk.vzhled {
		teplota = append(teplota, v.Teplota)
		ostrost = append(ostrost, v.Ostrost)
		if v.Sytost >= 0.1 {
			barevnaTeplota = append(barevnaTeplota, v.Teplota)
		}
	}
	for _, x := range [][]float64{teplota, barevnaTeplota, ostrost} {
		sort.Float64s(x)
	}
	dk.prahTeple = teplota[len(teplota)*95/100]
	dk.prahMekke, dk.prahTextury = ostrost[len(ostrost)*6/100], ostrost[len(ostrost)*94/100]
	dk.prahChladne = -1
	if len(barevnaTeplota) > 0 {
		dk.prahChladne = barevnaTeplota[len(barevnaTeplota)*5/100]
	}
}
