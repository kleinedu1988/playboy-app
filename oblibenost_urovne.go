package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// Úrovně Top 10 / 20 / 50 / 100 (popis v docs/UCENI.md, oddíl Úrovně Top 10/20/50/100): do špičky oblíbenosti se
// nedostane modelka jen proto, že má hodně srdíček nebo vysoký odhad. Každá úroveň má prahy (počet porovnání,
// nejistota síly, u top 10 výhra nad potvrzenou top 20). Modelka, která je nesplňuje, zůstane v potvrzeném pořadí
// těsně pod hranicí té úrovně; číslo oblíbenosti se nemění, mění se jen pořadí (model.poradi, pořadí podle síly je
// v model.mistoSily). Výběr dvojic (oblibenost_dvojice.go) přidává souboje na hranicích, aby se čekající rychle
// potvrdila, nebo vypadla.

// Úroveň Top N v rozhraní (StavOblibenosti.Urovne): prahy pro texty a kolik modelek v ní potvrzeně je
type UrovenTop struct {
	Uroven           int     `json:"uroven"`
	PotrebaPorovnani int     `json:"potrebaPorovnani"`
	MaxNejistota     float64 `json:"maxNejistota"`
	PotrebaVyhry     bool    `json:"potrebaVyhry"` // výhra nad modelkou potvrzenou v top 20
	Potvrzenych      int     `json:"potvrzenych"`
}

// Modelka, která by podle síly patřila do vyšší úrovně, než má potvrzeno: kam by patřila a jak daleko je k prahům
type CekaniNaUroven struct {
	Uroven           int     `json:"uroven"`
	Porovnani        int     `json:"porovnani"`
	PotrebaPorovnani int     `json:"potrebaPorovnani"`
	Nejistota        float64 `json:"nejistota"`
	MaxNejistota     float64 `json:"maxNejistota"`
	PotrebaVyhry     bool    `json:"potrebaVyhry"`
	MaVyhru          bool    `json:"maVyhru"`
}

// Prahy úrovně: aspoň tolik porovnání, nejistota síly (směrodatná odchylka na stupnici srdíček) nejvýš tolik a u top
// 10 aspoň jedna výhra nad modelkou potvrzenou v top 20. Od nejpřísnější; přísnější úroveň splňuje i prahy volnějších.
// Nejistota hodnocené modelky je díky předpokladu ze srdíček vždy pod 0,3, rozhoduje u ní počet porovnání (a výhra);
// nehodnocená se do top 100 dostane, až je její úroveň známá jako pro návrh srdíček (nejistota 0,6). Top 10 chce
// 10 porovnání místo navržených 8: v simulaci (TestSimulaceUrovni) to zvedlo přesnost potvrzené top 10 o 3 body
// za cenu asi 70 porovnání navíc, než se skutečná top 10 potvrdí; přísnější i ostatní úrovně už pomáhaly málo.
type prahUrovne struct {
	uroven    int
	porovnani int
	nejistota float64
	vyhra     bool
}

var prahyUrovni = []prahUrovne{
	{10, 10, 0.3, true},
	{20, 6, 0.4, false},
	{50, 4, 0.5, false},
	{100, 2, maxNejistotaNavrhu, false},
}

const (
	// Do top N se potvrdí jen modelka, která je podle síly nejvýš na místě 2·N: potvrzení nikoho nevytáhne z hloubky
	// (třiadvacet porovnaných trojek nad nepotvrzené pětky); okno 2·N je nejvýš další úroveň, takže modelka, která prahy
	// své úrovně podle síly splňuje, v ní zůstane
	oknoUrovne = 2
	// Výhra pro top 10 se počítá nad modelkami potvrzenými v top 20
	urovenElity = 20
	// Souboje na hranicích ve výběru dvojic: nejvýš tolik soupeřek čekající modelky, a N. s N+1. místem jen při
	// oblíbenosti rozdílné nejvýš o tolik
	soupererekSouboje = 3
	blizkoSouboje     = 0.15
)

// Podíl soubojů ze všech dvojic výběru (dokud nějaké jsou; proměnná kvůli simulaci v testu). V simulaci
// 0,1 potvrdí skutečnou top 10 po mediánu 590 porovnání, 0,2 po 370, 0,3 po 280, 0,45 po 230 (souboje jsou pak
// pětina všech dvojic – kandidátů je málo); 0,3 nechává většinu dvojic běžnému učení celé sbírky.
var podilSouboju = 0.3

// Úroveň na indexu prahyUrovni (len = mimo top 100 → 0)
func urovenIndexu(k int) int {
	if k >= len(prahyUrovni) {
		return 0
	}
	return prahyUrovni[k].uroven
}

// Index nejmenší úrovně, do které místo spadá (len = mimo top 100)
func indexMista(misto int) int {
	for k, p := range prahyUrovni {
		if misto <= p.uroven {
			return k
		}
	}
	return len(prahyUrovni)
}

// Potvrzené pořadí a úrovně z oblíbenosti (model.oblibenost, pocet, rozptyl a jenOdhad už musí být spočítané):
//
//  1. Místo podle síly = pořadí podle oblíbenosti (spocitatPoradi).
//  2. Splněná úroveň: nejpřísnější, jejíž prahy modelka splňuje (jen odhad nesplňuje žádnou); způsobilá je pro ni,
//     když je podle síly nejvýš na místě 2·N, jinak pro nejbližší volnější, kam okno sahá.
//  3. Pořadí se plní místo po místě: na místo p jde nejsilnější zbývající modelka, která na ně smí (způsobilá pro
//     úroveň N smí na místa od předchozí hranice + 1, mimo top 100 až od 101.). Když nikdo takový nezbývá (úroveň
//     nemá dost potvrzených), jde tam nejsilnější zbývající (nepotvrzená, s úrovní podle svých prahů, i 0) a jen
//     odhad až úplně nakonec.
//     Modelka, která na top 10 nemá, tak skončí na 11. místě (je-li dost potvrzených), mimo top 100 na 101. Je to
//     deterministické (síla, při shodě id) a za O(n · úrovně).
//  4. Úroveň modelky = nejmenší N, kde je na místě ≤ N a je pro N způsobilá; jinak 0.
//
// Výhra pro top 10 závisí na potvrzené top 20, takže se pořadí počítá dvakrát: napřed bez výher (do top 10 se nikdo
// nepotvrdí, top 20 už je skoro hotová – výhry ji hlavně přeskupí), z něj potvrzená top 20 a pak znovu s výhrami.
func (m *modelOblibenosti) spocitatUrovne(porovnani []porovnaniZaznam) {
	m.mistoSily = spocitatPoradi(m.oblibenost)
	ids := make([]int, len(m.mistoSily))
	for id, p := range m.mistoSily {
		ids[p-1] = id
	}
	nejistota := make([]float64, len(ids))
	for i, id := range ids {
		r, ok := m.rozptyl[id]
		if !ok {
			r = sigmaNehodnocene * sigmaNehodnocene
		}
		nejistota[i] = math.Sqrt(r)
	}
	// Nejpřísnější splněná úroveň (index prahyUrovni) a způsobilost s oknem 2·N
	splnena := func(i int, vyhra bool) int {
		if m.jenOdhad[ids[i]] {
			return len(prahyUrovni)
		}
		for k, p := range prahyUrovni {
			if m.pocet[ids[i]] >= p.porovnani && nejistota[i] <= p.nejistota+1e-9 && (!p.vyhra || vyhra) {
				return k
			}
		}
		return len(prahyUrovni)
	}
	zpusobilost := func(vyhry map[int]bool) []int {
		z := make([]int, len(ids))
		for i := range ids {
			k := splnena(i, vyhry[ids[i]])
			for k < len(prahyUrovni) && i+1 > oknoUrovne*prahyUrovni[k].uroven {
				k++
			}
			z[i] = k
		}
		return z
	}
	poradi, uroven := m.seraditPodleUrovni(ids, zpusobilost(nil))

	// Výhry nad potvrzenou top 20 (remíza výhra není)
	m.elita = map[int]bool{}
	for i, id := range ids {
		if u := uroven[i]; u > 0 && u <= urovenElity {
			m.elita[id] = true
		}
	}
	m.maVyhru = map[int]bool{}
	for _, p := range porovnani {
		switch {
		case p.vysledek == "a" && m.elita[p.b] && p.a != p.b:
			m.maVyhru[p.a] = true
		case p.vysledek == "b" && m.elita[p.a] && p.a != p.b:
			m.maVyhru[p.b] = true
		}
	}
	if len(m.maVyhru) > 0 {
		poradi, uroven = m.seraditPodleUrovni(ids, zpusobilost(m.maVyhru))
	}

	m.poradi, m.uroven, m.ceka = make(map[int]int, len(ids)), make(map[int]int, len(ids)), map[int]CekaniNaUroven{}
	m.potvrzenych = make([]int, len(prahyUrovni))
	for i, id := range ids {
		m.poradi[id], m.uroven[id] = poradi[i], uroven[i]
		for k, p := range prahyUrovni {
			if uroven[i] > 0 && uroven[i] <= p.uroven {
				m.potvrzenych[k]++
			}
		}
		// Čeká: podle síly patří do vyšší úrovně, než má potvrzeno (ta prahy nesplňuje; okno je splněné vždy)
		ks := indexMista(i + 1)
		if ks < len(prahyUrovni) && (uroven[i] == 0 || uroven[i] > prahyUrovni[ks].uroven) {
			p := prahyUrovni[ks]
			m.ceka[id] = CekaniNaUroven{Uroven: p.uroven, Porovnani: m.pocet[id], PotrebaPorovnani: p.porovnani,
				Nejistota: zaokrouhlit3(nejistota[i]), MaxNejistota: p.nejistota, PotrebaVyhry: p.vyhra, MaVyhru: m.maVyhru[id]}
		}
	}
}

// Plnění pořadí místo po místě (krok 3 výše): ids podle síly, zpusobila = index úrovně, pro kterou je modelka
// způsobilá (len = žádná). Vrací potvrzené místo a úroveň ke každému indexu ids.
func (m *modelOblibenosti) seraditPodleUrovni(ids []int, zpusobila []int) (poradi, uroven []int) {
	n := len(prahyUrovni)
	// Skupiny: způsobilé pro úroveň k (0…n−1), žádnou (n), jen odhad (n+1); v každé indexy podle síly
	skupiny := make([][]int, n+2)
	for i, id := range ids {
		k := zpusobila[i]
		if m.jenOdhad[id] {
			k = n + 1
		}
		skupiny[k] = append(skupiny[k], i)
	}
	// Nejlepší místo skupiny: za hranicí předchozí úrovně, mimo úrovně za poslední
	odMista := make([]int, n+2)
	for k := range odMista {
		odMista[k] = 1
		if min(k, n) > 0 {
			odMista[k] = prahyUrovni[min(k, n)-1].uroven + 1
		}
	}
	dalsi := make([]int, n+2)
	poradi, uroven = make([]int, len(ids)), make([]int, len(ids))
	for p := 1; p <= len(ids); p++ {
		vybrana := -1
		for k := range skupiny {
			if dalsi[k] < len(skupiny[k]) && odMista[k] <= p && (vybrana < 0 || skupiny[k][dalsi[k]] < skupiny[vybrana][dalsi[vybrana]]) {
				vybrana = k
			}
		}
		if vybrana < 0 {
			// Úroveň nemá dost potvrzených: nejsilnější zbývající, jen odhad až nakonec. Ne „nejlépe způsobilá“: to by
			// do prázdné top 10 vytáhlo slabší porovnanou z místa 150 (okno ji pustí jen do top 100)
			for k := range skupiny {
				if dalsi[k] < len(skupiny[k]) && (vybrana < 0 || (k <= n && skupiny[k][dalsi[k]] < skupiny[vybrana][dalsi[vybrana]])) {
					vybrana = k
				}
			}
		}
		i := skupiny[vybrana][dalsi[vybrana]]
		dalsi[vybrana]++
		poradi[i] = p
		uroven[i] = urovenIndexu(max(indexMista(p), zpusobila[i]))
		if m.jenOdhad[ids[i]] {
			uroven[i] = 0
		}
	}
	return poradi, uroven
}

// Úrovně pro rozhraní (StavOblibenosti.Urovne)
func (m *modelOblibenosti) urovneTop() []UrovenTop {
	urovne := make([]UrovenTop, len(prahyUrovni))
	for k, p := range prahyUrovni {
		urovne[k] = UrovenTop{Uroven: p.uroven, PotrebaPorovnani: p.porovnani, MaxNejistota: p.nejistota, PotrebaVyhry: p.vyhra}
		if k < len(m.potvrzenych) {
			urovne[k].Potvrzenych = m.potvrzenych[k]
		}
	}
	return urovne
}

// ---------------------------------------------------------------------------------------------------------
// Souboje na hranicích (výběr dvojic)
//
// Dva druhy kandidátů, jen ve výchozím okruhu: (a) čekající modelka proti poslední potvrzené v úrovni, kam by podle
// síly patřila (tu by vytlačila; nejvýš 3 soupeřky odspodu, když úroveň potvrzenou nemá nikoho, sousedky podle síly),
// (b) N. proti N+1. místu potvrzeného pořadí, když se jejich oblíbenost liší nejvýš o 0,15. Do souboje nejde jen
// odhad (nehodnocená neporovnaná – tu porovnává kotva na úrovni odhadu) ani nehodnocená, jejíž úroveň ještě není
// známá (bez návrhu srdíček: méně než 3 porovnání nebo nejistota nad 0,6) – nejdřív se musí zjistit, kam patří.
// Skóre: váha úrovně (top 10 1, top 20 0,8, top 50 0,6, top 100 0,45) krát váhy obou modelek (četnost v posledních
// porovnáních, nesoulad, fotka), u (a) krát 1/(1 + 0,01·místo podle síly) a 1; 0,8; 0,64 podle soupeřky odspodu
// (sousedka 0,8), u (b) krát 0,8. Souboje jsou zvláštní seznam kandidátů, ze kterého se bere asi 30 % všech dvojic
// (podilSouboju; berou se z těch, které by jinak byly hodnocené – nehodnocené proti kotvě si svou třetinu nechávají).

// Váha souboje podle úrovně (index prahyUrovni)
var vahySouboju = []float64{1, 0.8, 0.6, 0.45}

func (m *modelOblibenosti) doSouboje(x *Modelka) bool {
	if m.jenOdhad[x.ID] {
		return false
	}
	if x.Hodnoceni > 0 {
		return true
	}
	return m.pocet[x.ID] >= minPorovnaniNavrhu && math.Sqrt(m.rozptylModelky(x)) <= maxNejistotaNavrhu
}

func (m *modelOblibenosti) kandidatiSouboju(modelky []Modelka, vyloucene map[[2]int]bool, vahaModelky func(*Modelka) float64) []kandidatDvojice {
	if len(m.poradi) == 0 || len(prahyUrovni) == 0 {
		return nil
	}
	podleId := make(map[int]*Modelka, len(m.poradi))
	for i := range modelky {
		if _, ok := m.poradi[modelky[i].ID]; ok {
			podleId[modelky[i].ID] = &modelky[i]
		}
	}
	poradi := make([]*Modelka, len(m.poradi)) // potvrzené pořadí
	podleSily := make([]*Modelka, len(m.poradi))
	for id, x := range podleId {
		poradi[m.poradi[id]-1], podleSily[m.mistoSily[id]-1] = x, x
	}
	var kandidati []kandidatDvojice
	pridat := func(x, y *Modelka, skore float64, druh, k int) bool {
		if x == nil || y == nil || x == y || vyloucene[klicDvojice(x.ID, y.ID)] || !m.doSouboje(x) || !m.doSouboje(y) {
			return false
		}
		kandidati = append(kandidati, kandidatDvojice{a: x.ID, b: y.ID, skore: skore * vahySouboju[k] * vahaModelky(x) * vahaModelky(y),
			druh: druh, x: x, y: y, urovenTop: prahyUrovni[k].uroven})
		return true
	}
	// (a) čekající proti posledním potvrzeným v úrovni
	for _, x := range podleSily[:min(len(podleSily), prahyUrovni[len(prahyUrovni)-1].uroven)] {
		if x == nil {
			continue
		}
		c, ok := m.ceka[x.ID]
		if !ok || !m.doSouboje(x) {
			continue
		}
		// Silnější čekající mírně napřed (při stejné váze by rozhodovalo číslo modelky)
		k := indexMista(m.mistoSily[x.ID])
		nalezeno, vaha := 0, 1/(1+0.01*float64(m.mistoSily[x.ID]))
		for p := min(c.Uroven, len(poradi)); p >= 1 && nalezeno < soupererekSouboje; p-- {
			y := poradi[p-1]
			if y == nil {
				continue
			}
			if u := m.uroven[y.ID]; u > 0 && u <= c.Uroven && pridat(x, y, vaha, dvojiceCekajici, k) {
				nalezeno++
				vaha *= 0.8
			}
		}
		if nalezeno == 0 {
			// Úroveň zatím nemá nikoho potvrzeného (nebo jsou všechny dvojice nedávno porovnané): sousedky podle síly
			for _, d := range []int{-1, 1, -2, 2} {
				if p := m.mistoSily[x.ID] + d; p >= 1 && p <= len(podleSily) && nalezeno < 2 && pridat(x, podleSily[p-1], 0.8*vaha, dvojiceCekajici, k) {
					nalezeno++
				}
			}
		}
	}
	// (b) N. proti N+1. místu, když jsou si silou blízko
	for k, p := range prahyUrovni {
		if p.uroven >= len(poradi) {
			break
		}
		x, y := poradi[p.uroven-1], poradi[p.uroven]
		if x != nil && y != nil && math.Abs(m.oblibenost[x.ID]-m.oblibenost[y.ID]) <= blizkoSouboje {
			pridat(y, x, 0.8, dvojiceHranice, k)
		}
	}
	sort.SliceStable(kandidati, func(i, j int) bool {
		if kandidati[i].skore != kandidati[j].skore {
			return kandidati[i].skore > kandidati[j].skore
		}
		ki, kj := klicDvojice(kandidati[i].a, kandidati[i].b), klicDvojice(kandidati[j].a, kandidati[j].b)
		return ki[0] < kj[0] || (ki[0] == kj[0] && ki[1] < kj[1])
	})
	return kandidati
}

// Důvod souboje: „Souboj o top 10: Bára (10.), nebo Anna (11.)? Silou jsou si blízko“, „Anna čeká na potvrzení do
// top 10 (5 z 8 porovnání) – soupeřkou je Bára (10.), poslední potvrzená v top 10“. Jména zůstávají v prvním pádě
// (cizí jména se skloňovat nedají).
func duvodSouboje(k kandidatDvojice, model *modelOblibenosti) string {
	jmeno := func(x *Modelka) string {
		if x.Jmeno == "" {
			return fmt.Sprintf("modelka č. %d", x.ID)
		}
		return x.Jmeno
	}
	if k.druh == dvojiceHranice {
		return fmt.Sprintf("Souboj o top %d: %s (%d.), nebo %s (%d.)? Silou jsou si blízko", k.urovenTop,
			jmeno(k.y), model.poradi[k.y.ID], jmeno(k.x), model.poradi[k.x.ID])
	}
	c := model.ceka[k.x.ID]
	var chybi []string
	if c.Porovnani < c.PotrebaPorovnani {
		chybi = append(chybi, fmt.Sprintf("%d z %d porovnání", c.Porovnani, c.PotrebaPorovnani))
	}
	if c.Nejistota > c.MaxNejistota+1e-9 {
		chybi = append(chybi, fmt.Sprintf("nejistota %s, potřeba nejvýš %s", cisloCesky(c.Nejistota, 2), cisloCesky(c.MaxNejistota, 1)))
	}
	if c.PotrebaVyhry && !c.MaVyhru {
		chybi = append(chybi, fmt.Sprintf("chybí výhra nad top %d", urovenElity))
	}
	stav := ""
	if len(chybi) > 0 {
		stav = " (" + strings.Join(chybi, ", ") + ")"
	}
	kdo := fmt.Sprintf("poslední potvrzená v top %d", c.Uroven)
	if u := model.uroven[k.y.ID]; u == 0 || u > c.Uroven || model.poradi[k.y.ID] > c.Uroven {
		kdo = "sousedka podle síly"
	} else if model.posledniVUrovni(c.Uroven) != k.y.ID {
		kdo = fmt.Sprintf("potvrzená v top %d", c.Uroven)
	}
	return fmt.Sprintf("%s čeká na potvrzení do top %d%s – soupeřkou je %s (%d.), %s", jmeno(k.x), c.Uroven, stav, jmeno(k.y), model.poradi[k.y.ID], kdo)
}

// Poslední potvrzená v úrovni (nejvyšší místo s úrovní ≤ N); 0, když nikdo
func (m *modelOblibenosti) posledniVUrovni(uroven int) int {
	posledni, misto := 0, 0
	for id, u := range m.uroven {
		if p := m.poradi[id]; u > 0 && u <= uroven && p <= uroven && p > misto {
			posledni, misto = id, p
		}
	}
	return posledni
}
