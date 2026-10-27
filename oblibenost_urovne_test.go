package main

import (
	"fmt"
	"math/rand"
	"os"
	"sort"
	"strings"
	"testing"
	"time"
)

// Úrovně Top 10/20/50/100: potvrzené pořadí, čekání, souboje ve výběru dvojic a simulace přesnosti

// Model jen s tím, co úrovně potřebují: modelka i+1 má oblíbenost sily[i] (sestupně = místo podle síly i+1),
// nejistotu 0,2 a pocet[i] porovnání
func modelUrovni(sily []float64, pocet []int, jenOdhad map[int]bool) *modelOblibenosti {
	m := &modelOblibenosti{oblibenost: map[int]float64{}, rozptyl: map[int]float64{}, pocet: map[int]int{}, jenOdhad: map[int]bool{}}
	for i, s := range sily {
		m.oblibenost[i+1], m.rozptyl[i+1], m.pocet[i+1] = s, 0.04, pocet[i]
	}
	for id := range jenOdhad {
		m.jenOdhad[id] = true
	}
	return m
}

// Potvrzené pořadí je permutace 1…n a úroveň odpovídá místu
func overitPermutaci(t *testing.T, m *modelOblibenosti) {
	t.Helper()
	videno := map[int]bool{}
	for id, p := range m.poradi {
		if p < 1 || p > len(m.poradi) || videno[p] {
			t.Fatalf("pořadí není permutace: %d má místo %d", id, p)
		}
		videno[p] = true
		if u := m.uroven[id]; u != 0 && p > u {
			t.Fatalf("modelka %d na %d. místě má úroveň %d", id, p, u)
		}
	}
}

func TestUrovneTopPotvrzenePoradi(t *testing.T) {
	n := 60
	sily, pocet := make([]float64, n), make([]int, n)
	for i := range n {
		sily[i], pocet[i] = 5-0.05*float64(i), 10
	}
	pocet[3] = 7 // 4. podle síly: na top 10 chybí porovnání, top 20 splňuje → 11. místo
	pocet[5] = 5 // 6.: splňuje jen top 50 → 21. místo
	pocet[1] = 0 // 2.: jen odhad → úplně nakonec
	// Výhry nad potvrzenou top 20: všechny porazily dvacátou (8. ne), dvacátá první
	var porovnani []porovnaniZaznam
	for id := 1; id <= n; id++ {
		if id != 20 && id != 8 {
			porovnani = append(porovnani, porovnaniZaznam{a: id, b: 20, vysledek: "a"})
		}
	}
	porovnani = append(porovnani, porovnaniZaznam{a: 1, b: 20, vysledek: "b"})
	m := modelUrovni(sily, pocet, map[int]bool{2: true})
	m.spocitatUrovne(porovnani)
	overitPermutaci(t, m)
	for _, c := range []struct{ id, poradi, misto, uroven, ceka int }{
		{1, 1, 1, 10, 0}, {3, 2, 3, 10, 0}, {5, 3, 5, 10, 0}, {14, 10, 14, 10, 0},
		{4, 11, 4, 20, 10},  // nemá na top 10: těsně pod hranicí
		{8, 12, 8, 20, 10},  // bez výhry nad top 20
		{6, 21, 6, 50, 10},  // nemá ani na top 20
		{2, 60, 2, 0, 10},   // jen odhad
		{15, 13, 15, 20, 0}, // potvrdila by se i do top 10, ale je jich tam deset silnějších
	} {
		if m.poradi[c.id] != c.poradi || m.mistoSily[c.id] != c.misto || m.uroven[c.id] != c.uroven || m.ceka[c.id].Uroven != c.ceka {
			t.Errorf("modelka %d: místo %d (chci %d), podle síly %d, úroveň %d (chci %d), čeká %+v", c.id, m.poradi[c.id], c.poradi, m.mistoSily[c.id], m.uroven[c.id], c.uroven, m.ceka[c.id])
		}
	}
	if c := m.ceka[4]; c.Porovnani != 7 || c.PotrebaPorovnani != 10 || !c.PotrebaVyhry || !c.MaVyhru || c.MaxNejistota != 0.3 {
		t.Errorf("čekání čtvrté: %+v", c)
	}
	if c := m.ceka[8]; c.MaVyhru || c.Porovnani != 10 {
		t.Errorf("čekání osmé: %+v", c)
	}
	if u := m.urovneTop(); len(u) != 4 || u[0].Potvrzenych != 10 || u[1].Potvrzenych != 20 || u[3].Uroven != 100 || u[3].Potvrzenych != n-1 {
		t.Errorf("úrovně: %+v", u)
	}
	// Deterministické: stejný vstup, stejné pořadí
	m2 := modelUrovni(sily, pocet, map[int]bool{2: true})
	m2.spocitatUrovne(porovnani)
	for id, p := range m.poradi {
		if m2.poradi[id] != p {
			t.Fatalf("pořadí se liší: %d %d/%d", id, p, m2.poradi[id])
		}
	}
}

// Bez porovnání nikdo potvrzený není: pořadí zůstane podle síly, každá v top 100 čeká, jen odhad až za top 100
func TestUrovneTopBezPorovnani(t *testing.T) {
	n := 120
	sily, pocet := make([]float64, n), make([]int, n)
	for i := range n {
		sily[i] = 5 - 0.03*float64(i)
	}
	m := modelUrovni(sily, pocet, map[int]bool{1: true})
	m.spocitatUrovne(nil)
	overitPermutaci(t, m)
	if m.poradi[1] != 101 || m.poradi[2] != 1 || m.poradi[50] != 49 || m.uroven[2] != 0 || len(m.ceka) != 100 || m.ceka[60].Uroven != 100 {
		t.Fatalf("bez porovnání: jen odhad %d., druhá %d., úroveň %d, čekajících %d", m.poradi[1], m.poradi[2], m.uroven[2], len(m.ceka))
	}
}

// Okno 2·N: porovnaná slabší modelka (podle síly 150.) se nepotvrdí do top 50 ani nevytáhne nad nepotvrzené, jen do
// top 100 (od 51. místa)
func TestUrovneTopOkno(t *testing.T) {
	n := 300
	sily, pocet := make([]float64, n), make([]int, n)
	var porovnani []porovnaniZaznam
	for i := range n {
		sily[i] = 5 - 0.01*float64(i)
		if i >= 149 && i < 160 {
			pocet[i] = 12
			porovnani = append(porovnani, porovnaniZaznam{a: i + 1, b: 1, vysledek: "a"})
		}
	}
	m := modelUrovni(sily, pocet, nil)
	m.spocitatUrovne(porovnani)
	overitPermutaci(t, m)
	if m.poradi[150] != 51 || m.uroven[150] != 100 || m.poradi[1] != 1 || m.uroven[1] != 0 || m.poradi[51] != 62 {
		t.Fatalf("okno: 150. podle síly na %d. (úroveň %d), první na %d., 51. na %d.", m.poradi[150], m.uroven[150], m.poradi[1], m.poradi[51])
	}
}

// Výběr dvojic: čekající na top 10 dostane souboj s poslední potvrzenou v top 10 (druh „souboj“, důvod s počtem
// porovnání); nehodnocená neporovnaná do souboje nejde
func TestVyberDvojicSouboje(t *testing.T) {
	var modelky []Modelka
	var porovnani []porovnaniZaznam
	pridat := func(a, b int, v string) {
		porovnani = append(porovnani, porovnaniZaznam{id: int64(len(porovnani) + 1), a: a, b: b, vysledek: v})
	}
	for i := range 30 {
		h := 5.0
		if i >= 12 {
			h = 4
		}
		modelky = append(modelky, Modelka{ID: i + 1, Jmeno: fmt.Sprintf("M%02d", i+1), Hodnoceni: h, CoverID: "x"})
	}
	modelky = append(modelky, Modelka{ID: 99, Jmeno: "Nová", CoverID: "x"})
	// Prvních 12 se pětkrát porovnalo mezi sebou (každá s pěti dalšími), 1. podle síly (M01) jen třikrát
	for i := 2; i <= 12; i++ {
		for d := 1; d <= 4; d++ {
			j := (i-2+d)%11 + 2
			pridat(i, j, "a")
		}
	}
	for _, j := range []int{2, 3, 4} {
		pridat(1, j, "a")
	}
	for i := 13; i <= 30; i++ {
		pridat(i, 13+(i-12)%18, "remiza")
	}
	model := spocitatOblibenost(modelky, porovnani, time.Now())
	c, ok := model.ceka[1]
	if !ok || c.Uroven != 10 || c.Porovnani >= c.PotrebaPorovnani {
		t.Fatalf("M01 má čekat na top 10: %+v (místo podle síly %d, pořadí %d)", c, model.mistoSily[1], model.poradi[1])
	}
	souboju, sM01 := 0, 0
	for k := range 20 {
		for _, d := range vybratDvojice(modelky, model, nil, nil, 8, "", rand.New(rand.NewSource(int64(k)))) {
			if d.Druh != "souboj" {
				if strings.HasPrefix(d.Duvod, "Souboj") || strings.Contains(d.Duvod, "čeká na potvrzení") {
					t.Fatalf("důvod souboje bez druhu: %+v", d)
				}
				continue
			}
			souboju++
			if d.A == 99 || d.B == 99 {
				t.Fatalf("nehodnocená neporovnaná v souboji: %+v", d)
			}
			if d.A == 1 || d.B == 1 {
				sM01++
				if !strings.Contains(d.Duvod, "M01 čeká na potvrzení do top 10 (3 z 10 porovnání)") || !strings.Contains(d.Duvod, "soupeřkou je ") {
					t.Fatalf("důvod souboje: %q", d.Duvod)
				}
			}
		}
	}
	if souboju == 0 || sM01 == 0 || souboju > 20*8/2 {
		t.Fatalf("soubojů %d (s M01 %d) ze %d dvojic", souboju, sM01, 20*8)
	}
	// Okruh „stejne“ souboje nenabízí
	for _, d := range vybratDvojice(modelky, model, nil, nil, 8, "stejne", rand.New(rand.NewSource(1))) {
		if d.Druh != "" {
			t.Fatalf("souboj v okruhu stejne: %+v", d)
		}
	}
}

// Trend se snímkem s potvrzeným pořadím srovnává potvrzená místa (vstup do top 10 je vzestup), se starším
// snímkem oblíbenost
func TestTrendPotvrzenehoPoradi(t *testing.T) {
	m := &modelOblibenosti{oblibenost: map[int]float64{1: 4.9, 2: 4.8, 3: 4.7}, poradi: map[int]int{1: 3, 2: 1, 3: 2}}
	snimek := map[int]snimekOblibenosti{1: {4.9, 1}, 2: {4.8, 2}, 3: {4.7, 3}}
	nyni := time.Now()
	m.nastavitTrend(snimek, nyni.AddDate(0, 0, -30), nyni, true)
	if m.zmenaPoradi[1] != -2 || m.zmenaPoradi[2] != 1 || m.zmenaPoradi[3] != 1 {
		t.Fatalf("potvrzené pořadí: %v", m.zmenaPoradi)
	}
	m.nastavitTrend(snimek, nyni.AddDate(0, 0, -30), nyni, false)
	if m.zmenaPoradi[1] != 0 || m.zmenaPoradi[2] != 0 {
		t.Fatalf("starší snímek podle oblíbenosti: %v", m.zmenaPoradi)
	}
}

// ---------------------------------------------------------------------------------------------------------
// Simulace: jak přesná je špička pořadí s prahy a bez nich

// Umělá sbírka: skutečná síla t ~ N(3; 1) (0,3–5,4), hodnocené mají srdíčka = t + šum N(0; 0,3) zaokrouhlené na
// poloviny (0,5–5), část nehodnocená. Simulovaný uživatel odpovídá podle Bradley–Terry se skutečnými silami.
type simulaceUrovni struct {
	modelky  []Modelka
	skutecna map[int]float64
	top      map[int][]int // skutečné top k (k = 10, 20, 50)
}

func novaSimulaceUrovni(n, hodnocenych int, r *rand.Rand) simulaceUrovni {
	s := simulaceUrovni{skutecna: map[int]float64{}, top: map[int][]int{}}
	ids := make([]int, n)
	for i := range n {
		id := i + 1
		ids[i] = id
		t := min(max(3+r.NormFloat64(), 0.3), 5.4)
		s.skutecna[id] = t
		m := Modelka{ID: id, Jmeno: fmt.Sprintf("S%03d", id), CoverID: "x"}
		if i < hodnocenych {
			m.Hodnoceni = min(max(zaokrouhlitNaPul(t+0.3*r.NormFloat64()), 0.5), 5)
		}
		s.modelky = append(s.modelky, m)
	}
	sort.Slice(ids, func(i, j int) bool { return s.skutecna[ids[i]] > s.skutecna[ids[j]] })
	for _, k := range []int{10, 20, 50} {
		s.top[k] = append([]int(nil), ids[:k]...)
	}
	return s
}

// Výsledek simulace v jednom bodě (průměr přes semínka)
type bodSimulace struct {
	porovnani                       int
	presnost10, presnost20, presn50 float64 // podíl skutečných top k v prvních k místech ukázaného pořadí
	potvrzenych10, falesnych10      float64 // potvrzené v top 10 (Top v Přehledu) a z nich mimo skutečnou top 10
	presnostPotvrzenych20           float64 // podíl skutečné top 20 mezi potvrzenými v top 20
	potvrzenych20                   float64
}

type vysledekSimulace struct {
	body []bodSimulace
	// Skutečná top 10: po kolika porovnáních se modelka poprvé potvrdila v top 10 (medián) a kolik jich do konce ne
	medianPotvrzeni float64
	nepotvrzenych   float64
	soubojuPodil    float64
	// Výpadky z potvrzené top 10 (mezi dvěma výpočty) za celou simulaci a z nich modelek skutečné top 10
	vypadku10, vypadkuSkutecnych10 float64
	// Kronika síně slávy: kolikrát top 10 složená z událostí nesouhlasila s modelem (musí být 0) a obhajob
	nesouladKroniky, obhajobKroniky int
}

// Simulace předává držitelky z výpočtu do výpočtu jako aplikace (varianta „bez obhajoby“ ne)
var obhajobaVSimulaci = true

func simulovatUrovne(semena []int64, body []int, varianta func()) vysledekSimulace {
	puvodniPrahy, puvodniPodil := prahyUrovni, podilSouboju
	puvodniObhajoba := obhajobaDoUrovne
	defer func() {
		prahyUrovni, podilSouboju, obhajobaVSimulaci, obhajobaDoUrovne = puvodniPrahy, puvodniPodil, true, puvodniObhajoba
	}()
	varianta()
	v := vysledekSimulace{body: make([]bodSimulace, len(body))}
	var potvrzeni []float64
	dvojic, souboju := 0, 0
	nyni := time.Now()
	for _, semeno := range semena {
		r := rand.New(rand.NewSource(semeno))
		s := novaSimulaceUrovni(400, 340, r)
		jeTop := map[int]map[int]bool{}
		for k, ids := range s.top {
			jeTop[k] = map[int]bool{}
			for _, id := range ids {
				jeTop[k][id] = true
			}
		}
		var porovnani []porovnaniZaznam
		var nabidnute [][2]int
		potvrzena := map[int]int{}
		var drzitelky map[int]int
		var predchozi *modelOblibenosti
		kronika, jednicka, odStavu := map[int]bool{}, 0, 0
		bod := 0
		for bod < len(body) {
			model := spocitatOblibenostUplne(s.modelky, porovnani, stavZajmu{}, vstupOblibenosti{drzitelky: drzitelky}, nyni)
			if obhajobaVSimulaci {
				var obhajoby map[int]ObhajobaUrovne
				if predchozi != nil {
					obhajoby = predchozi.obhajoba
				}
				for _, x := range udalostiSlavy(drzitelky, model, obhajoby, porovnani[odStavu:], predchozi == nil, jednicka) {
					switch x.druh {
					case udalostPocatek, udalostVstup:
						kronika[x.modelka] = true
					case udalostVystup:
						delete(kronika, x.modelka)
					case udalostObhajoba:
						v.obhajobKroniky++
					case udalostJednicka:
						jednicka = x.modelka
					case udalostKonecJednicky:
						jednicka = 0
					}
				}
				for id, u := range model.uroven {
					if jeVTop10(u) != kronika[id] || (model.poradi[id] == 1 && jeVTop10(u) && jednicka != id) {
						v.nesouladKroniky++
					}
				}
				predchozi, odStavu = model, len(porovnani)
			}
			for id, u := range drzitelky {
				if u == 10 && model.uroven[id] != 10 {
					v.vypadku10++
					if jeTop[10][id] {
						v.vypadkuSkutecnych10++
					}
				}
			}
			drzitelky = potvrzeneUrovne(model.uroven)
			if !obhajobaVSimulaci {
				// Bez obhajoby: držitelky jen pro počítání výpadků
				model = spocitatOblibenost(s.modelky, porovnani, nyni)
				drzitelky = potvrzeneUrovne(model.uroven)
			}
			for id, u := range model.uroven {
				if _, ok := potvrzena[id]; !ok && u == 10 && jeTop[10][id] {
					potvrzena[id] = len(porovnani)
				}
			}
			if len(porovnani) >= body[bod] {
				b := &v.body[bod]
				b.porovnani = body[bod]
				poradi := model.seznamPoradi()
				pres := func(k int) float64 {
					trefa := 0
					for _, id := range poradi[:min(k, len(poradi))] {
						if jeTop[k][id] {
							trefa++
						}
					}
					return float64(trefa) / float64(k)
				}
				b.presnost10 += pres(10)
				b.presnost20 += pres(20)
				b.presn50 += pres(50)
				potv10, fal10, potv20, tref20 := 0, 0, 0, 0
				for id, u := range model.uroven {
					if u == 10 {
						potv10++
						if !jeTop[10][id] {
							fal10++
						}
					}
					if u > 0 && u <= 20 {
						potv20++
						if jeTop[20][id] {
							tref20++
						}
					}
				}
				b.potvrzenych10 += float64(potv10)
				b.falesnych10 += float64(fal10)
				b.potvrzenych20 += float64(potv20)
				b.presnostPotvrzenych20 += float64(tref20) / 20
				bod++
				if bod == len(body) {
					break
				}
			}
			for _, d := range vybratDvojice(s.modelky, model, porovnani, nabidnute, 10, "", r) {
				dvojic++
				if d.Druh == "souboj" {
					souboju++
				}
				vysledek := "b"
				if r.Float64() < zLogitu(skalaBT*(s.skutecna[d.A]-s.skutecna[d.B])) {
					vysledek = "a"
				}
				ha, hb := s.modelky[d.A-1].Hodnoceni, s.modelky[d.B-1].Hodnoceni
				porovnani = append(porovnani, porovnaniZaznam{id: int64(len(porovnani) + 1), a: d.A, b: d.B, vysledek: vysledek, ha: ha, hb: hb})
				nabidnute = append(nabidnute, klicDvojice(d.A, d.B))
			}
			if len(nabidnute) > pametNabidek {
				nabidnute = nabidnute[len(nabidnute)-pametNabidek:]
			}
		}
		for _, id := range s.top[10] {
			if p, ok := potvrzena[id]; ok {
				potvrzeni = append(potvrzeni, float64(p))
			} else {
				v.nepotvrzenych++
			}
		}
	}
	k := float64(len(semena))
	for i := range v.body {
		b := &v.body[i]
		b.presnost10, b.presnost20, b.presn50 = b.presnost10/k, b.presnost20/k, b.presn50/k
		b.potvrzenych10, b.falesnych10, b.potvrzenych20, b.presnostPotvrzenych20 = b.potvrzenych10/k, b.falesnych10/k, b.potvrzenych20/k, b.presnostPotvrzenych20/k
	}
	v.nepotvrzenych /= k
	v.vypadku10, v.vypadkuSkutecnych10 = v.vypadku10/k, v.vypadkuSkutecnych10/k
	if len(potvrzeni) > 0 {
		sort.Float64s(potvrzeni)
		v.medianPotvrzeni = potvrzeni[len(potvrzeni)/2]
	}
	if dvojic > 0 {
		v.soubojuPodil = float64(souboju) / float64(dvojic)
	}
	return v
}

// Simulace (bez -short): 400 modelek (340 hodnocených), po 10 dvojicích z vybratDvojice, odpovědi podle skutečných
// sil. Měří přesnost prvních 10/20/50 míst ukázaného pořadí, kolik je potvrzených v top 10 a kolik z nich „falešných“
// (mimo skutečnou top 10), a jak rychle se skutečná top 10 potvrdí. Varianty: bez prahů (dřívější pořadí podle
// oblíbenosti, bez soubojů), výchozí a bez obhajoby; s PLAYBOY_SIMULACE=vse (16 semínek, asi 8 minut) i prahy bez soubojů,
// přísnější a mírnější prahy, bez výhry nad top 20, víc nebo méně soubojů a obhajoba na jiných úrovních (tím se prahy
// a váhy ladily). Výchozí varianta předává držitelky z výpočtu do výpočtu (obhajoba), „bez obhajoby“ ne; obě počítají
// výpadky z potvrzené top 10.
func TestSimulaceUrovni(t *testing.T) {
	if testing.Short() {
		t.Skip("simulace úrovní se v rychlém běhu nepouští")
	}
	vse := os.Getenv("PLAYBOY_SIMULACE") == "vse"
	semena := []int64{1, 2, 3, 4, 5, 6}
	if vse {
		semena = []int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	}
	body := []int{0, 100, 200, 400, 800, 1500}
	varianty := []struct {
		nazev string
		f     func()
	}{
		{"bez prahů (dřív)", func() { prahyUrovni = nil }},
		{"prahy bez soubojů", func() { podilSouboju = 0 }},
		{"výchozí 10/6/4/2 + souboje 0,3", func() {}},
		{"bez obhajoby", func() { obhajobaVSimulaci = false }},
		{"obhajoba jen top 10", func() { obhajobaDoUrovne = 10 }},
		{"obhajoba do top 20", func() { obhajobaDoUrovne = 20 }},
		{"obhajoba i top 100", func() { obhajobaDoUrovne = 100 }},
		{"souboje 0,1", func() { podilSouboju = 0.1 }},
		{"souboje 0,2", func() { podilSouboju = 0.2 }},
		{"souboje 0,45", func() { podilSouboju = 0.45 }},
		{"navržené 8/6/4/2", func() {
			prahyUrovni = []prahUrovne{{10, 8, 0.3, true}, {20, 6, 0.4, false}, {50, 4, 0.5, false}, {100, 2, maxNejistotaNavrhu, false}}
		}},
		{"přísnější 12/8/5/3", func() {
			prahyUrovni = []prahUrovne{{10, 12, 0.3, true}, {20, 8, 0.4, false}, {50, 5, 0.5, false}, {100, 3, maxNejistotaNavrhu, false}}
		}},
		{"mírnější 6/4/3/2", func() {
			prahyUrovni = []prahUrovne{{10, 6, 0.3, true}, {20, 4, 0.4, false}, {50, 3, 0.5, false}, {100, 2, maxNejistotaNavrhu, false}}
		}},
		{"výchozí bez výhry nad top 20", func() {
			prahyUrovni = []prahUrovne{{10, 10, 0.3, false}, {20, 6, 0.4, false}, {50, 4, 0.5, false}, {100, 2, maxNejistotaNavrhu, false}}
		}},
	}
	if !vse {
		varianty = []struct {
			nazev string
			f     func()
		}{varianty[0], varianty[2], varianty[3]}
	}
	vysledky := map[string]vysledekSimulace{}
	for _, va := range varianty {
		zacatek := time.Now()
		v := simulovatUrovne(semena, body, va.f)
		vysledky[va.nazev] = v
		t.Logf("== %s (%v): souboje %.0f %% dvojic, skutečná top 10 potvrzená po mediánu %.0f porovnání, nepotvrzených do konce %.1f, výpadků z top 10 %.1f (skutečných top 10 %.1f), obhajob v kronice %d",
			va.nazev, time.Since(zacatek).Round(time.Second), 100*v.soubojuPodil, v.medianPotvrzeni, v.nepotvrzenych, v.vypadku10, v.vypadkuSkutecnych10, v.obhajobKroniky)
		if v.nesouladKroniky > 0 {
			t.Errorf("%s: kronika nesouhlasí s top 10 modelu %d×", va.nazev, v.nesouladKroniky)
		}
		t.Logf("   porovnání | P@10 | P@20 | P@50 | potvrzených top 10 | z nich falešných | potvrzených top 20 | z top 20 trefených")
		for _, b := range v.body {
			t.Logf("   %9d | %.2f | %.2f | %.2f | %18.1f | %16.1f | %18.1f | %.2f", b.porovnani, b.presnost10, b.presnost20, b.presn50,
				b.potvrzenych10, b.falesnych10, b.potvrzenych20, b.presnostPotvrzenych20)
		}
	}
	// Prahy nesmí ukázané pořadí zhoršit víc než o šum a potvrzená top 10 má být přesnější než prvních 10 bez prahů
	bez, s := vysledky["bez prahů (dřív)"], vysledky["výchozí 10/6/4/2 + souboje 0,3"]
	posledni := len(body) - 1
	if s.body[posledni].presnost10 < bez.body[posledni].presnost10-0.1 {
		t.Errorf("P@10 s prahy %.2f, bez %.2f", s.body[posledni].presnost10, bez.body[posledni].presnost10)
	}
	// Obhajoba nesmí skutečnou top 10 vyhazovat častěji než bez ní (šum 6 semínek)
	if bezObh := vysledky["bez obhajoby"]; s.vypadkuSkutecnych10 > bezObh.vypadkuSkutecnych10+0.5 {
		t.Errorf("výpadky skutečné top 10 s obhajobou %.1f, bez %.1f", s.vypadkuSkutecnych10, bezObh.vypadkuSkutecnych10)
	}
	if b := s.body[posledni]; b.potvrzenych10 < 5 || b.falesnych10/b.potvrzenych10 > 1-bez.body[posledni].presnost10+0.05 {
		t.Errorf("potvrzená top 10: %.1f, falešných %.1f (bez prahů přesnost %.2f)", b.potvrzenych10, b.falesnych10, bez.body[posledni].presnost10)
	}
}

// Obhajoba: držitelka top 10, kterou silou předstihla jiná, místo drží, dokud s ní vyzyvatelka v posledním
// rozhodnutém vzájemném porovnání nevyhraje; bez souboje ho ztratí jen pod oknem 2·N nebo bez prahů
func TestObhajobaUrovne(t *testing.T) {
	n := 40
	drzitelky := map[int]int{}
	for id := 1; id <= n; id++ {
		drzitelky[id] = urovenIndexu(indexMista(id))
	}
	vypocet := func(upravit func(sily []float64, pocet []int), navic ...porovnaniZaznam) *modelOblibenosti {
		sily, pocet := make([]float64, n), make([]int, n)
		for i := range n {
			sily[i], pocet[i] = 5-0.05*float64(i), 10
		}
		upravit(sily, pocet)
		var porovnani []porovnaniZaznam
		for id := 1; id <= n; id++ {
			if id != 20 {
				porovnani = append(porovnani, porovnaniZaznam{a: id, b: 20, vysledek: "a"})
			}
		}
		m := modelUrovni(sily, pocet, nil)
		m.drzitelky = drzitelky
		m.spocitatUrovne(append(porovnani, navic...))
		overitPermutaci(t, m)
		return m
	}
	// Jedenáctá silou předstihla desátou
	predstihla := func(sily []float64, _ []int) { sily[10] = sily[9] + 0.01 }
	obhajuje := func(m *modelOblibenosti, chci bool) {
		t.Helper()
		ma := m.poradi[10] == 10 && m.poradi[11] == 11 && m.uroven[10] == 10 && m.uroven[11] == 20 &&
			m.obhajoba[10] == ObhajobaUrovne{Uroven: 10, Vyzyvatelka: 11} && m.vyzyva[11] == 10 && m.ceka[11].Drzitelka == 10 && m.ceka[11].Uroven == 10
		bez := m.poradi[11] == 10 && m.poradi[10] == 11 && m.uroven[11] == 10 && m.obhajoba[10].Uroven == 0 && m.ceka[11].Uroven == 0
		if (chci && !ma) || (!chci && !bez) {
			t.Errorf("obhajoba %v: místa 10./11. %d/%d, úrovně %d/%d, obhajoba %+v, čeká %+v", chci, m.poradi[10], m.poradi[11],
				m.uroven[10], m.uroven[11], m.obhajoba[10], m.ceka[11])
		}
	}
	obhajuje(vypocet(predstihla), true)
	vyhra := porovnaniZaznam{a: 11, b: 10, vysledek: "a"}
	obhajuje(vypocet(predstihla, vyhra), false)
	// Remíza po výhře nic nemění, odveta držitelky obhajobu vrátí
	obhajuje(vypocet(predstihla, vyhra, porovnaniZaznam{a: 10, b: 11, vysledek: "remiza"}), false)
	obhajuje(vypocet(predstihla, vyhra, porovnaniZaznam{a: 10, b: 11, vysledek: "a"}), true)
	// Desátá silou až 25.: top 10 neobhájí (okno 2·N), top 20 ano – proti všem pěti silnějším, které by místo vzaly
	m := vypocet(func(sily []float64, _ []int) { sily[9] = sily[24] - 0.001 })
	if m.poradi[10] != 20 || m.uroven[10] != 20 || m.obhajoba[10] != (ObhajobaUrovne{Uroven: 20, Vyzyvatelka: 21}) || m.poradi[11] != 10 {
		t.Errorf("pád pod okno: místo %d, úroveň %d, obhajoba %+v", m.poradi[10], m.uroven[10], m.obhajoba[10])
	}
	for id := 21; id <= 25; id++ {
		if m.vyzyva[id] != 10 || m.ceka[id].Drzitelka != 10 || m.ceka[id].Uroven != 20 || m.poradi[id] != id {
			t.Errorf("vyzyvatelka %d: místo %d, čeká %+v", id, m.poradi[id], m.ceka[id])
		}
	}
	// Bez obhajoby: bez prahů top 10, nebo bez držitelek
	obhajuje(vypocet(func(sily []float64, pocet []int) { sily[10] = sily[9] + 0.01; pocet[9] = 8 }), false)
	puvodni := drzitelky
	drzitelky = nil
	obhajuje(vypocet(predstihla), false)
	drzitelky = puvodni

	// Souboj o obhajobu má ve výběru přednost a důvod ho pojmenuje
	m = vypocet(predstihla)
	var modelky []Modelka
	for id := 1; id <= n; id++ {
		modelky = append(modelky, Modelka{ID: id, Jmeno: fmt.Sprintf("M%02d", id), Hodnoceni: 4})
	}
	kandidati := m.kandidatiSouboju(modelky, nil, func(*Modelka) float64 { return 1 })
	if len(kandidati) == 0 || kandidati[0].druh != dvojiceObhajoba || kandidati[0].a != 11 || kandidati[0].b != 10 {
		t.Fatalf("první kandidát souboje: %+v", kandidati[:min(1, len(kandidati))])
	}
	if d := duvodSouboje(kandidati[0], m); d != "Obhajoba top 10: M10 (10.) brání místo, M11 (11.) ji silou předstihla – rozhodne jejich souboj" {
		t.Errorf("důvod obhajoby: %q", d)
	}
	for _, k := range kandidati[1:] {
		if k.druh == dvojiceCekajici && k.a == 11 {
			t.Errorf("vyzyvatelka i mezi čekajícími: %+v", k)
		}
	}
}

// Držitelky v databázi učení: stav po porovnání, vrácení porovnání vrátí předchozí
func TestDrzitelkyVDatabazi(t *testing.T) {
	a := novaTestovaciApp(t, nil)
	for _, j := range []string{"A", "B"} {
		a.AddModelka(Modelka{Jmeno: j, Tetovani: -1, Piercing: -1})
		a.SetHodnoceni(idModelky(t, a, j), 4)
	}
	ida, idb := idModelky(t, a, "A"), idModelky(t, a, "B")
	u := a.uc
	// Se zámkem databáze učení (Fatal uvnitř by zámek nechal zamčený a úklid aplikace by se zasekl)
	sZamkem := func(f func()) {
		u.mu.Lock()
		defer u.mu.Unlock()
		f()
	}
	var chyba string
	sZamkem(func() {
		// Bez porovnání nikdo potvrzený (stav 0 už mohl zapsat výpočet při přidání modelek)
		if st := u.nacistStavUrovni(0); !st.db || len(st.drzitelky) != 0 {
			chyba = fmt.Sprintf("prázdná databáze: %+v", st)
			return
		}
		u.zapsatDrzitelky(0, map[int]int{ida: 10, idb: 0})
		if st := u.nacistStavUrovni(0); len(st.drzitelky) != 1 || st.drzitelky[ida] != 10 || st.porovnani != 0 {
			chyba = fmt.Sprintf("po zápisu: %+v", st)
		}
	})
	if chyba != "" {
		t.Fatal(chyba)
	}
	if !a.PorovnatModelky(idb, ida, "a") {
		t.Fatal("porovnání")
	}
	a.GetOblibenost()
	var posledni int64
	var stavu int
	sZamkem(func() {
		posledni = posledniPorovnani(u.nacistPorovnani())
		u.zajistit().QueryRow("SELECT COUNT(DISTINCT porovnani_id) FROM drzitelky_urovni").Scan(&stavu)
		u.zapsatDrzitelky(posledni, map[int]int{idb: 10})
	})
	if posledni == 0 || stavu != 2 {
		t.Fatalf("po porovnání %d: stavů držitelek %d", posledni, stavu)
	}
	if !a.VratitPorovnani() {
		t.Fatal("vrácení")
	}
	var st stavUrovni
	sZamkem(func() { st = u.nacistStavUrovni(posledni + 5) })
	if len(st.drzitelky) != 1 || st.drzitelky[ida] != 10 || st.porovnani != 0 {
		t.Fatalf("po vrácení: %+v", st)
	}
}

// „Rozhodnout teď“: čekající dostane souboje s posledními potvrzenými v úrovni (tolik, kolik jí chybí porovnání),
// vyzyvatelka a držitelka jediný vzájemný souboj, ostatní nic
func TestSoubojeModelky(t *testing.T) {
	n := 30
	sily, pocet := make([]float64, n), make([]int, n)
	for i := range n {
		sily[i], pocet[i] = 5-0.05*float64(i), 10
	}
	pocet[3] = 7 // 4. podle síly: chybí 3 porovnání do top 10
	var porovnani []porovnaniZaznam
	for id := 1; id <= n; id++ {
		if id != 20 {
			porovnani = append(porovnani, porovnaniZaznam{a: id, b: 20, vysledek: "a"})
		}
	}
	m := modelUrovni(sily, pocet, nil)
	m.spocitatUrovne(porovnani)
	var modelky []Modelka
	for id := 1; id <= n; id++ {
		modelky = append(modelky, Modelka{ID: id, Jmeno: fmt.Sprintf("M%02d", id), Hodnoceni: 4})
	}
	souperky := func(d []DvojicePorovnani) []int {
		var v []int
		for _, x := range d {
			v = append(v, x.B)
		}
		return v
	}
	d := m.soubojeModelky(modelky, 4)
	// Top 10 bez čtyřky: 1, 2, 3, 5, …, 11 – poslední potvrzené odspodu jsou 11, 10, 9
	if s := fmt.Sprint(souperky(d)); s != "[11 10 9]" || d[0].A != 4 || d[0].Druh != "souboj" {
		t.Fatalf("souboje čtyřky: %s %+v", s, d)
	}
	if d[0].Duvod != "Rozhodnout teď: M04 o top 10 – soupeřka M11 (10.), potvrzená v top 10" {
		t.Errorf("důvod: %q", d[0].Duvod)
	}
	if d := m.soubojeModelky(modelky, 1); len(d) != 0 {
		t.Errorf("potvrzená jednička nemá co rozhodovat: %+v", d)
	}
	// Obhajoba: držitelka i vyzyvatelka mají jediný vzájemný souboj
	m.obhajoba, m.vyzyva = map[int]ObhajobaUrovne{11: {Uroven: 10, Vyzyvatelka: 12}}, map[int]int{12: 11}
	if d := m.soubojeModelky(modelky, 12); fmt.Sprint(souperky(d)) != "[11]" || !strings.Contains(d[0].Duvod, "místo obhajuje") {
		t.Errorf("vyzyvatelka: %+v", d)
	}
	if d := m.soubojeModelky(modelky, 11); fmt.Sprint(souperky(d)) != "[12]" {
		t.Errorf("držitelka: %+v", d)
	}
}
