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
//
// Obhajoba (top 10, 20 a 50): sestup je stejně těžký jako postup. Modelka potvrzená v top N (držitelka z minulého výpočtu) o místo
// nepřijde jen proto, že ji silou předstihla jiná: dokud s ní vyzyvatelka v posledním rozhodnutém vzájemném
// porovnání nevyhraje (remíza se nepočítá), držitelka místo obhajuje a vyzyvatelka čeká těsně pod hranicí. Souboj
// o obhajobu má ve výběru dvojic přednost. Bez souboje držitelka místo ztratí, jen když prahy úrovně přestane
// splňovat nebo klesne silou pod místo 2·N. Držitelky se ukládají po každém porovnání (tabulka drzitelky_urovni),
// takže vrácení porovnání vrátí i obhajobu.

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
	// Prahy splňuje, ale místo obhajuje tahle držitelka: do úrovně se dostane, až ji porazí (0 = nikdo)
	Drzitelka int `json:"drzitelka,omitempty"`
}

// Držitelka obhajuje úroveň proti silnější vyzyvatelce
type ObhajobaUrovne struct {
	Uroven      int `json:"uroven"`
	Vyzyvatelka int `json:"vyzyvatelka"`
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
	// Souboj o obhajobu má před ostatními souboji přednost (váha čekající proti poslední potvrzené je nejvýš 1)
	vahaObhajoby = 1.5
)

// Obhajoba platí pro úrovně do top N (proměnná kvůli simulaci v testu). V simulaci (16 semínek, 1500 porovnání)
// obhajoba do top 50 snížila výpadky skutečné top 10 z potvrzené top 10 z 1,8 na 1,2 bez ztráty přesnosti
// (P@10 0,77 proti 0,76, P@50 0,82 stejně); s top 100 souboje o obhajobu zabraly celý podíl soubojů a P@50 kleslo
// na 0,76, jen s top 10 nepomohla.
var obhajobaDoUrovne = 50

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
	if len(m.maVyhru) > 0 || len(m.drzitelky) > 0 {
		poradi, uroven = m.obhajitUrovne(ids, zpusobilost(m.maVyhru), nejistota, porovnani)
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
		// Čeká: podle síly patří do vyšší úrovně, než má potvrzeno (ta prahy nesplňuje; okno je splněné vždy), nebo
		// prahy splňuje, ale místo obhajuje držitelka
		ks, drzitelka := indexMista(i+1), m.vyzyva[id]
		if drzitelka > 0 {
			ks = indexMista(m.obhajoba[drzitelka].Uroven)
		}
		if ks < len(prahyUrovni) && (drzitelka > 0 || uroven[i] == 0 || uroven[i] > prahyUrovni[ks].uroven) {
			p := prahyUrovni[ks]
			m.ceka[id] = CekaniNaUroven{Uroven: p.uroven, Porovnani: m.pocet[id], PotrebaPorovnani: p.porovnani,
				Nejistota: zaokrouhlit3(nejistota[i]), MaxNejistota: p.nejistota, PotrebaVyhry: p.vyhra, MaVyhru: m.maVyhru[id], Drzitelka: drzitelka}
		}
	}
}

// Obhajoba míst (popis nahoře) nad způsobilostí z (index úrovně ke každému indexu ids, jako pro seraditPodleUrovni):
// úroveň po úrovni od top 10 porovná potvrzené s držitelkami. Držitelka, která z úrovně vypadla, ale prahy (bez
// výhry, tu už jednou splnila) a okno 2·N dál splňuje, místo obhájí proti nejslabší nové modelce v úrovni, která ji
// v posledním rozhodnutém vzájemném porovnání neporazila; ta je pro úroveň nezpůsobilá a čeká. Silnější vypadlé
// párují napřed. Po každém kole se pořadí přepočítá a kolo se opakuje, dokud na uvolněné místo přichází další
// (všechny musí držitelku porazit); posun v top 10 pak promítne i do top 20.
func (m *modelOblibenosti) obhajitUrovne(ids []int, zpusobila []int, nejistota []float64, porovnani []porovnaniZaznam) (poradi, uroven []int) {
	z := append([]int(nil), zpusobila...)
	m.obhajoba, m.vyzyva = map[int]ObhajobaUrovne{}, map[int]int{}
	poradi, uroven = m.seraditPodleUrovni(ids, z)
	if len(m.drzitelky) == 0 {
		return poradi, uroven
	}
	// Vítězka posledního rozhodnutého vzájemného porovnání (remíza nic nemění)
	vitezka := map[[2]int]int{}
	for _, p := range porovnani {
		switch p.vysledek {
		case "a":
			vitezka[klicDvojice(p.a, p.b)] = p.a
		case "b":
			vitezka[klicDvojice(p.a, p.b)] = p.b
		}
	}
	for k, p := range prahyUrovni {
		if p.uroven > obhajobaDoUrovne {
			break
		}
		// Dokud se úroveň neustálí: po zablokování vyzyvatelky může na uvolněné místo přijít další silnější
		for {
			var vypadle, nove []int
			for i, id := range ids {
				d := m.drzitelky[id]
				drzela, je := d > 0 && d <= p.uroven, uroven[i] > 0 && uroven[i] <= p.uroven
				switch {
				case drzela && !je && !m.jenOdhad[id] && m.pocet[id] >= p.porovnani && nejistota[i] <= p.nejistota+1e-9 && i+1 <= oknoUrovne*p.uroven:
					vypadle = append(vypadle, i)
				case je && !drzela:
					nove = append(nove, i)
				}
			}
			pouzita, zmena := map[int]bool{}, false
			for _, i := range vypadle {
				for j := len(nove) - 1; j >= 0; j-- {
					y := nove[j]
					if pouzita[y] || vitezka[klicDvojice(ids[i], ids[y])] == ids[y] {
						continue
					}
					pouzita[y], zmena = true, true
					z[i], z[y] = min(z[i], k), max(z[y], k+1)
					// Vyzyvatelkou je první, kdo by místo vzal; další zablokované čekají na souboj se stejnou
					if _, ok := m.obhajoba[ids[i]]; !ok {
						m.obhajoba[ids[i]] = ObhajobaUrovne{Uroven: p.uroven, Vyzyvatelka: ids[y]}
					}
					m.vyzyva[ids[y]] = ids[i]
					break
				}
			}
			if !zmena {
				break
			}
			poradi, uroven = m.seraditPodleUrovni(ids, z)
		}
	}
	return poradi, uroven
}

// Uložený stav úrovní: držitelky po posledním porovnání ≤ posledni (po vrácení porovnání ten před ním) a pod kterým
// porovnáním (−1 = žádný stav), jestli už začala kronika síně slávy a poslední zapsaná jednička; db false =
// databáze učení není (nic se nezapisuje). Volá se se zámkem.
type stavUrovni struct {
	db        bool
	drzitelky map[int]int
	porovnani int64
	zacatek   bool
	jednicka  int
}

func (u *uceni) nacistStavUrovni(posledni int64) stavUrovni {
	st := stavUrovni{porovnani: -1}
	db := u.zajistit()
	if db == nil {
		return st
	}
	st.db = true
	var pocet int
	db.QueryRow("SELECT COUNT(*) FROM kronika_slavy WHERE druh = ?", udalostZacatek).Scan(&pocet)
	st.zacatek = pocet > 0
	var druh string
	if db.QueryRow("SELECT druh, modelka_id FROM kronika_slavy WHERE druh IN (?, ?) ORDER BY id DESC LIMIT 1", udalostJednicka, udalostKonecJednicky).Scan(&druh, &st.jednicka) == nil && druh == udalostKonecJednicky {
		st.jednicka = 0
	}
	if db.QueryRow("SELECT COALESCE(MAX(porovnani_id), -1) FROM drzitelky_urovni WHERE porovnani_id <= ?", posledni).Scan(&st.porovnani) != nil || st.porovnani < 0 {
		st.porovnani = -1
		return st
	}
	radky, err := db.Query("SELECT modelka_id, uroven FROM drzitelky_urovni WHERE porovnani_id = ? AND modelka_id > 0", st.porovnani)
	if err != nil {
		return st
	}
	defer radky.Close()
	st.drzitelky = map[int]int{}
	for radky.Next() {
		var id, uroven int
		if radky.Scan(&id, &uroven) == nil {
			st.drzitelky[id] = uroven
		}
	}
	return st
}

// Zápis držitelek po porovnání posledni; drží se jen posledních pametDrzitelek stavů (na vracení porovnání)
func (u *uceni) zapsatDrzitelky(posledni int64, uroven map[int]int) {
	db := u.zajistit()
	if db == nil {
		return
	}
	tx, err := db.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()
	if _, err := tx.Exec("DELETE FROM drzitelky_urovni WHERE porovnani_id >= ?", posledni); err != nil {
		return
	}
	prikaz, err := tx.Prepare("INSERT INTO drzitelky_urovni (porovnani_id, modelka_id, uroven) VALUES (?, ?, ?)")
	if err != nil {
		return
	}
	defer prikaz.Close()
	if _, err := prikaz.Exec(posledni, 0, 0); err != nil {
		return
	}
	for id, u := range potvrzeneUrovne(uroven) {
		if _, err := prikaz.Exec(posledni, id, u); err != nil {
			varovatUceni("držitelky úrovní se nezapsaly: %v", err)
			return
		}
	}
	tx.Exec("DELETE FROM drzitelky_urovni WHERE porovnani_id NOT IN (SELECT DISTINCT porovnani_id FROM drzitelky_urovni ORDER BY porovnani_id DESC LIMIT ?)", pametDrzitelek)
	tx.Commit()
}

// Kolik posledních stavů držitelek se pamatuje (tolikrát jde vrátit porovnání se správnou obhajobou)
const pametDrzitelek = 50

// Jen potvrzené (úroveň > 0)
func potvrzeneUrovne(uroven map[int]int) map[int]int {
	v := make(map[int]int, len(uroven))
	for id, u := range uroven {
		if u > 0 {
			v[id] = u
		}
	}
	return v
}

func posledniPorovnani(porovnani []porovnaniZaznam) int64 {
	if len(porovnani) == 0 {
		return 0
	}
	return porovnani[len(porovnani)-1].id
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
	// (o) vyzyvatelka proti držitelce, která místo obhajuje: přednost před ostatními souboji
	for _, x := range podleSily {
		if x == nil {
			continue
		}
		if d, ok := m.vyzyva[x.ID]; ok {
			pridat(x, podleId[d], vahaObhajoby, dvojiceObhajoba, indexMista(m.obhajoba[d].Uroven))
		}
	}
	// (a) čekající proti posledním potvrzeným v úrovni
	for _, x := range podleSily[:min(len(podleSily), prahyUrovni[len(prahyUrovni)-1].uroven)] {
		if x == nil || m.vyzyva[x.ID] > 0 {
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
	if k.druh == dvojiceObhajoba {
		return fmt.Sprintf("Obhajoba top %d: %s (%d.) brání místo, %s (%d.) ji silou předstihla – rozhodne jejich souboj", k.urovenTop,
			jmeno(k.y), model.poradi[k.y.ID], jmeno(k.x), model.poradi[k.x.ID])
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
