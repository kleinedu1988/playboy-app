package main

import (
	"fmt"
	"math"
	"math/rand"
	"slices"
	"sort"
	"strings"
	"time"
)

// Výběr dvojic k porovnání „Která se ti líbí víc?“ (aktivní učení, popis níž a v docs/UCENI.md, oddíl Výběr dvojic):
// hodnocené dvojice stejné a sousední úrovně, nehodnocené proti kotvě na úrovni jejich síly a souboje na hranicích
// top 10/20/50/100 (oblibenost_urovne.go). Úroveň i nejistota jsou ze společného modelu oblíbenosti (oblibenost.go),
// stejně jako pořadí a návrhy srdíček.

// Dvojice k porovnání „Která se ti líbí víc?“
type DvojicePorovnani struct {
	A     int    `json:"a"`
	B     int    `json:"b"`
	Duvod string `json:"duvod"` // proč právě tahle dvojice (česky)
	Druh  string `json:"druh"`  // "souboj" u soubojů na hranicích top 10/20/50/100, "overeni" u ověření srdíček, "utok" u útoku na top 10, jinak ""
}

// Parametry výběru dvojic
const (
	sousedeDvojic      = 10  // kandidátky ke každé modelce: tolik nejbližších podle síly
	podilPruzkumu      = 0.2 // část dvojic vybraná náhodně (průzkum), ne podle nejistoty
	pametNabidek       = 60  // kolik naposledy nabídnutých dvojic se nenabízí znovu
	nedavnaPorovnani   = 200 // z tolika posledních porovnání se počítá, jak často modelka byla na řadě
	maxDvojicNaVolani  = 50  // nejvíc dvojic na jedno volání
	vahaBezFotky       = 0.3 // modelka bez titulní fotky i fotek se do dvojice hodí hůř (není co porovnat)
	vahaSousedniUrovne = 0.7 // sousední úroveň (rozdíl půl srdíčka) proti stejné
	vahaVzdaleneUrovne = 0.2 // rozdíl jednoho srdíčka
	// Nehodnocené proti kotvě: podíl dvojic ve výchozím výběru a váhy podle toho, co o nich víme (s odhadem vkusu 1)
	podilNehodnocenych = 0.33
	vahaRozpracovane   = 2.5 // už porovnaná, ale ještě bez návrhu srdíček: dotáhnout ji
	vahaBezOdhadu      = 0.35
	vahaNesouladu      = 1.6 // modelka, které nesedí srdíčka: další porovnání to ověří

	// Výchozí výběr (1.3.1): kromě běžných dvojic, nehodnocených proti kotvě a soubojů na hranicích ještě
	// objevování (málo porovnané modelky), dvojice napříč úrovněmi srdíček a útoky na top 10. Podíly jednotlivých
	// seznamů ve výběru; když seznam dojde, bere se z dalších.
	podilObjevovani = 0.15 // hodnocené modelky s málo porovnáními (do maxPorovnaniObjevu) proti známé kotvě
	podilNapric     = 0.2  // hodnocené modelky, jejichž srdíčka se liší o jedno až dvě a půl
	podilUtoku      = 0.1  // modelka z top 10 proti vyzyvatelce zpoza top 10
	podilBeznych    = 0.15 // stejná a sousední úroveň (zbytek podílu po ostatních)

	maxPorovnaniObjevu = 2  // objevování: modelka s nejvýš tolika porovnáními
	sirkaNapric        = 40 // napříč úrovněmi: kandidátky do tolika míst podle síly na každou stranu
	vyzyvatelekUtoku   = 30 // útok na top 10: vyzyvatelky z míst 11 až 10 + tolik podle síly
)

// Dvojice k porovnání vybrané aktivním učením. okruh: "" všechny hodnocené, "stejne" jen stejná úroveň srdíček,
// "nehodnocene" nehodnocené modelky proti hodnoceným (kotvám), "tema:<klíč>" jen soutěžící tematické sezóny.
func (a *App) GetDvojiceKPorovnani(pocet int, okruh string) []DvojicePorovnani {
	dvojice := []DvojicePorovnani{}
	u := a.uc
	if u == nil {
		return dvojice
	}
	pocet = min(max(pocet, 1), maxDvojicNaVolani)
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	u.mu.Lock()
	porovnani := u.nacistPorovnani()
	nabidnute := append([][2]int(nil), u.ob.nabidnute...)
	u.ob.nabidek++
	semienko := int64(len(porovnani))*7919 + int64(u.ob.nabidek)
	u.mu.Unlock()
	// Tematická sezóna: jen soutěžící tématu a opakování podle soubojů v tématu (jinde šlo o jiné fotky)
	if klic, ok := strings.CutPrefix(okruh, "tema:"); ok {
		// Soutěžící dnes (i pod hranicí počtu – rozjetá tematická sezóna se dohraje); kanonický klíč
		t := temaZKlice(klic)
		if t == nil || t.Klic == "" {
			return dvojice
		}
		soutezici, _ := a.souteziciTematuSbirky(t)
		modelky = slices.DeleteFunc(slices.Clone(modelky), func(m Modelka) bool { return soutezici[m.ID] == 0 })
		porovnani = slices.DeleteFunc(slices.Clone(porovnani), func(p porovnaniZaznam) bool { return p.tema != t.Klic })
		okruh = ""
	}

	dvojice = vybratDvojiceS(modelky, model, porovnani, nabidnute, pocet, okruh, rand.New(rand.NewSource(semienko)), false)
	if len(dvojice) == 0 && len(porovnani) > 0 {
		// Všechno rozhodnuté se nedávno porovnávalo: radši dvojice starší než týden než nic
		dvojice = vybratDvojiceS(modelky, model, porovnani, nabidnute, pocet, okruh, rand.New(rand.NewSource(semienko)), true)
	}
	u.mu.Lock()
	for _, d := range dvojice {
		u.ob.nabidnute = append(u.ob.nabidnute, klicDvojice(d.A, d.B))
	}
	if n := len(u.ob.nabidnute); n > pametNabidek {
		u.ob.nabidnute = append([][2]int(nil), u.ob.nabidnute[n-pametNabidek:]...)
	}
	u.mu.Unlock()
	return dvojice
}

// ---------------------------------------------------------------------------------------------------------
// Výběr dvojic k porovnání (aktivní učení)
//
// Porovnání má smysl tam, kde je pořadí nejisté a kde na něm záleží: u modelek se stejnými nebo sousedními
// srdíčky. Výchozí výběr sám míchá hodnocené dvojice a asi třetinu nehodnocených proti kotvě na úrovni jejich
// odhadu (viz níž); nic se nemusí přepínat. Kandidátky jsou ke každé modelce nejbližší sousedé podle síly
// (sousedeDvojic na každou stranu). Modelka, které nesedí srdíčka (prohrává se slabšími nebo vyhrává se silnějšími),
// má vyšší váhu, aby se nesoulad ověřil.
// Skóre dvojice je očekávaná informace p(1 − p)·(Var sᵢ + Var sⱼ) (největší, když je výsledek nejistý a obě síly
// málo známé) krát váha úrovně (stejná 1, sousední 0,7, o srdíčko 0,2, jinak nic) a váha za fotku. Dvojice
// z posledních nedavnaPorovnani porovnání a naposledy nabídnuté se vynechají, modelka je v jednom výběru nejvýš
// jednou a modelka častá v posledních porovnáních se tlumí. Asi pětina dvojic je průzkum: náhodná dvojice ze
// stejné nebo sousední úrovně (semínko z počtu porovnání a volání, takže výsledek je opakovatelný). Pořadí A/B
// je náhodné, aby levá strana neměla přednost.
// Od 1.3.1 výchozí výběr losuje každou dvojici z jednoho ze šesti seznamů podle podílů (podilBeznych …
// podilUtoku): k běžným, nehodnoceným a soubojům přibylo objevování málo porovnaných, dvojice napříč úrovněmi
// srdíček (o 1 až 2½) a útoky vyzyvatelek na top 10 (docs/UCENI.md, oddíl Výběr dvojic).

type kandidatDvojice struct {
	a, b    int
	skore   float64
	pruzkum bool
	// Proč právě tahle dvojice; text se skládá až u vybraných (duvodDvojice), kandidátů jsou tisíce
	druh int
	x, y *Modelka
	// Nehodnocená: úroveň srdíček, na kterou vychází (odhad nebo síla z porovnání, po polovinách), a odkud
	uroven float64
	zdroj  int
	// Souboj: o kterou úroveň top N (x čekající nebo N+1. místo, y soupeřka)
	urovenTop int
}

// Odkud je úroveň nehodnocené modelky
const (
	urovenPrumer    = iota // bez odhadu: průměr srdíček sbírky
	urovenVkus             // odhad modelu vkusu
	urovenPorovnani        // síla z dosavadních porovnání
)

// Druhy kandidátů dvojic (pro důvod)
const (
	dvojiceNehodnocena = iota // nehodnocená proti hodnocené kotvě
	dvojiceStejna             // stejná úroveň srdíček
	dvojiceSousedni           // sousední úrovně
	dvojiceVzdalena           // srdíčka se liší o jedno
	dvojiceCekajici           // souboj: čekající na potvrzení úrovně proti poslední potvrzené
	dvojiceHranice            // souboj: N. proti N+1. místu
	dvojiceObhajoba           // souboj: vyzyvatelka proti držitelce, která místo obhajuje
	dvojiceOvereni            // ověření srdíček: modelka s nesouladem proti úrovni, kam podle něj patří
	dvojiceObjev              // objevování: málo porovnaná hodnocená modelka proti známé kotvě
	dvojiceNapric             // napříč úrovněmi: srdíčka se liší o jedno až dvě a půl
	dvojiceUtok               // útok na top 10: vyzyvatelka zpoza top 10 proti modelce z top 10
)

// Souboje a ověření srdíček jdou ze zvláštního seznamu (oblibenost_urovne.go) s důvodem z duvodSouboje
func jeSouboj(druh int) bool {
	return druh == dvojiceCekajici || druh == dvojiceHranice || druh == dvojiceObhajoba || druh == dvojiceOvereni
}

func jmenoDvojice(x *Modelka) string {
	if x.Jmeno == "" {
		return fmt.Sprintf("modelka č. %d", x.ID)
	}
	return x.Jmeno
}

func duvodDvojice(k kandidatDvojice, model *modelOblibenosti) string {
	if jeSouboj(k.druh) {
		return duvodSouboje(k, model)
	}
	nizsi, vyssi := textSrdicek(min(k.x.Hodnoceni, k.y.Hodnoceni)), textSrdicek(max(k.x.Hodnoceni, k.y.Hodnoceni))
	switch k.druh {
	case dvojiceNehodnocena:
		var odkud string
		switch k.zdroj {
		case urovenPorovnani:
			odkud = fmt.Sprintf("Po %d porovnáních vychází nehodnocená na %s", model.pocet[k.x.ID], textSrdicek(k.uroven))
			if model.pocet[k.x.ID] == 1 {
				odkud = fmt.Sprintf("Po prvním porovnání vychází nehodnocená na %s", textSrdicek(k.uroven))
			}
		case urovenVkus:
			odkud = fmt.Sprintf("Odhad podle vkusu: %s", textSrdicek(k.uroven))
		default:
			odkud = fmt.Sprintf("Zatím bez odhadu, průměr sbírky je %s", textSrdicek(k.uroven))
		}
		if k.y.Hodnoceni != k.uroven {
			return fmt.Sprintf("%s – modelku s %s nemáš, proto proti nejbližší s %s: vyhraje, nebo prohraje?", odkud, textSrdicek7(k.uroven), textSrdicek7(k.y.Hodnoceni))
		}
		return fmt.Sprintf("%s – proti modelce s %s: vyhraje-li, patří výš, prohraje-li, níž", odkud, textSrdicek7(k.y.Hodnoceni))
	case dvojiceStejna:
		sx, okX := model.skore[k.x.ID]
		sy, okY := model.skore[k.y.ID]
		if okX && okY {
			return fmt.Sprintf("Obě mají %s (fotky %s a %s) a pořadí mezi nimi zatím není jisté", textSrdicek(k.x.Hodnoceni), cisloCesky(sx.skore, 1), cisloCesky(sy.skore, 1))
		}
		return fmt.Sprintf("Obě mají %s a pořadí mezi nimi zatím není jisté", textSrdicek(k.x.Hodnoceni))
	case dvojiceSousedni:
		return fmt.Sprintf("Sousední úrovně (%s a %s): patří ta s méně srdíčky výš?", nizsi, vyssi)
	case dvojiceObjev:
		n := model.pocet[k.x.ID]
		kolik := "ještě nebyla v žádném porovnání"
		if n > 0 {
			kolik = fmt.Sprintf("má zatím jen %d %s", n, sklonovatSlovo(n, "porovnání", "porovnání", "porovnání"))
		}
		return fmt.Sprintf("Nová v porovnávání: %s (%s) %s – proti %s (%s), která má pořadí jisté", jmenoDvojice(k.x), textSrdicek(k.x.Hodnoceni), kolik, jmenoDvojice(k.y), textSrdicek(k.y.Hodnoceni))
	case dvojiceNapric:
		return fmt.Sprintf("Napříč úrovněmi: %s a %s. Sedí rozdíl srdíček, nebo je ta s méně srdíčky lepší?", nizsi, vyssi)
	case dvojiceUtok:
		return fmt.Sprintf("Útok na top 10: %s (%d. místo) vyzývá %s (%d. místo) – v top 10 nemá nikdo místo jisté",
			jmenoDvojice(k.x), model.mistoSily[k.x.ID], jmenoDvojice(k.y), model.poradi[k.y.ID])
	}
	return fmt.Sprintf("Srdíčka se liší o jedno (%s a %s), porovnání ověří hranici", nizsi, vyssi)
}

// Omezení soubojů a ověření, aby se tatáž modelka neobjevovala pořád dokola: modelka z posledních porovnání nebo
// nabídnutých (ještě neporovnaných) dvojic chvíli souboj ani ověření nedostane (ani jako soupeřka), a modelka
// s nesouladem se ověřuje jen do maxPorovnaniOvereni porovnání s modelkami na straně nesouladu – pak už důkazy má
// a rozhodnutí je na uživateli (návrh srdíček zůstává).
type omezeniSouboju struct {
	pauza   map[int]bool
	overeno map[int]int
}

const (
	pauzaSouboju        = 12 // posledních porovnání, jejichž modelky souboj ani ověření hned znovu nedostanou
	pauzaNabidek        = 8  // naposledy nabídnutých dvojic (ještě ve frontě rozhraní) totéž
	maxPorovnaniOvereni = 10 // nesoulad vzniká od 3 porovnání se stranou nesouladu; ověření dál jen do 10
)

func omezitSouboje(model *modelOblibenosti, porovnani []porovnaniZaznam, nabidnute [][2]int) omezeniSouboju {
	o := omezeniSouboju{pauza: map[int]bool{}, overeno: map[int]int{}}
	for _, p := range porovnani[max(0, len(porovnani)-pauzaSouboju):] {
		o.pauza[p.a], o.pauza[p.b] = true, true
	}
	for _, d := range nabidnute[max(0, len(nabidnute)-pauzaNabidek):] {
		o.pauza[d[0]], o.pauza[d[1]] = true, true
	}
	if len(model.nesoulad) == 0 {
		return o
	}
	// Porovnání se stranou nesouladu: podhodnocená s víc srdíčky, nadhodnocená s méně (srdíčka v době porovnání)
	strana := func(id int, h, souperka float64) {
		if n, ok := model.nesoulad[id]; ok && ((n.Smer == "vice" && souperka > h) || (n.Smer == "mene" && souperka < h && souperka > 0)) {
			o.overeno[id]++
		}
	}
	for _, p := range porovnani {
		strana(p.a, p.ha, p.hb)
		strana(p.b, p.hb, p.ha)
	}
	return o
}

// Paměť rozhodnutých dvojic: dvojice, ve které ses rozhodl (jedna vede), se měsíc nenabízí; remíza nebo vyrovnaný stav
// (každá jednou vyhrála) se vrátí jako rozstřel nejdřív za týden. Počítá se od posledního porovnání té dvojice.
const (
	dnyRozhodnute = 30
	dnyRozstrelu  = 7
)

// Dvojice, které se teď nenabízejí (paměť rozhodnutých výše); uvolnit = pro všechny jen týdenní pauza, když by jinak
// nebylo co porovnávat. Porovnání bez času (testy, simulace) bere jako dnešní.
func vylouceneDvojice(porovnani []porovnaniZaznam, nyni time.Time, uvolnit bool) map[[2]int]bool {
	type stavDvojice struct {
		skore    int // výhry modelky s menším číslem minus výhry té druhé
		posledni time.Time
	}
	stavy := map[[2]int]stavDvojice{}
	for _, p := range porovnani {
		k := klicDvojice(p.a, p.b)
		s := stavy[k]
		vyhralaPrvni := (p.vysledek == "a" && p.a == k[0]) || (p.vysledek == "b" && p.b == k[0])
		switch {
		case p.vysledek == "remiza":
		case vyhralaPrvni:
			s.skore++
		default:
			s.skore--
		}
		cas := p.cas
		if cas.IsZero() {
			cas = nyni
		}
		if cas.After(s.posledni) {
			s.posledni = cas
		}
		stavy[k] = s
	}
	v := make(map[[2]int]bool, len(stavy))
	for k, s := range stavy {
		dny := dnyRozstrelu
		if s.skore != 0 && !uvolnit {
			dny = dnyRozhodnute
		}
		if nyni.Sub(s.posledni) < time.Duration(dny)*24*time.Hour {
			v[k] = true
		}
	}
	return v
}

func vybratDvojice(modelky []Modelka, model *modelOblibenosti, porovnani []porovnaniZaznam, nabidnute [][2]int, pocet int, okruh string, nahoda *rand.Rand) []DvojicePorovnani {
	return vybratDvojiceS(modelky, model, porovnani, nabidnute, pocet, okruh, nahoda, false)
}

func vybratDvojiceS(modelky []Modelka, model *modelOblibenosti, porovnani []porovnaniZaznam, nabidnute [][2]int, pocet int, okruh string, nahoda *rand.Rand, uvolnit bool) []DvojicePorovnani {
	vysledek := []DvojicePorovnani{}
	vyloucene := vylouceneDvojice(porovnani, time.Now(), uvolnit)
	for _, d := range nabidnute {
		vyloucene[d] = true
	}
	castost := map[int]float64{}
	for i, p := range porovnani[max(0, len(porovnani)-nedavnaPorovnani):] {
		// Novější porovnání tlumí víc (posledních asi 20)
		vaha := math.Pow(0.9, float64(min(len(porovnani), nedavnaPorovnani)-1-i))
		castost[p.a] += vaha
		castost[p.b] += vaha
	}
	vahaModelky := func(m *Modelka) float64 {
		w := 1 / (1 + 0.5*castost[m.ID])
		if _, ok := model.nesoulad[m.ID]; ok {
			w *= vahaNesouladu
		}
		if m.CoverID == "" && m.PocetFotek == 0 {
			w *= vahaBezFotky
		}
		return w
	}

	// Ukazatele: řadí se tisíce modelek a kopírování celých záznamů bylo dražší než výběr sám
	var hodnocene, nehodnocene []*Modelka
	for i := range modelky {
		if m := &modelky[i]; m.Hodnoceni > 0 {
			hodnocene = append(hodnocene, m)
		} else {
			nehodnocene = append(nehodnocene, m)
		}
	}
	silaM := func(m *Modelka) float64 { return model.silaModelky(m) }
	sort.SliceStable(hodnocene, func(i, j int) bool {
		si, sj := silaM(hodnocene[i]), silaM(hodnocene[j])
		if si != sj {
			return si < sj
		}
		return hodnocene[i].ID < hodnocene[j].ID
	})

	informace := func(x, y *Modelka, sx, sy float64) float64 {
		p := zLogitu(skalaBT * (sx - sy))
		return p * (1 - p) * (model.rozptylModelky(x) + model.rozptylModelky(y))
	}
	// Hodnocené dvojice (stejná, sousední a o srdíčko vzdálená úroveň) a nehodnocené proti kotvě; okruh "" (výchozí)
	// je míchá samo, "stejne" a "nehodnocene" berou jen jeden druh
	var kandidatiHod, kandidatiNeh []kandidatDvojice
	if okruh == "nehodnocene" || okruh == "" {
		// Nehodnocená modelka proti kotvě se stejným počtem srdíček, na jaký vychází: odhad zaokrouhlený na
		// polovinu srdíčka (po porovnáních síla z nich, takže výhra posune další kotvu výš a prohra níž). Ukáže
		// přímo, jestli patří nad svou úroveň, nebo pod ni. Kotvy jsou typické modelky té úrovně (síla nejblíž
		// srdíčkům); bez modelky na té úrovni nejbližší úroveň. Přednost má rozpracovaná nehodnocená (už porovnaná,
		// ale ještě bez návrhu srdíček), pak s odhadem vkusu, s hodnocenými fotkami, nakonec bez ničeho.
		podleUrovne := map[float64][]*Modelka{}
		for _, y := range hodnocene {
			podleUrovne[y.Hodnoceni] = append(podleUrovne[y.Hodnoceni], y)
		}
		for h, seznam := range podleUrovne {
			sort.SliceStable(seznam, func(i, j int) bool {
				return math.Abs(silaM(seznam[i])-h) < math.Abs(silaM(seznam[j])-h)
			})
		}
		for _, x := range nehodnocene {
			if len(podleUrovne) == 0 {
				break
			}
			// Úroveň je síla modelky (předpoklad z odhadu vkusu nebo průměru, upřesněný porovnáními) – stejné číslo,
			// ze kterého je její místo v pořadí a návrh srdíček
			cil, zdroj, vahaX := model.prumer, urovenPrumer, vahaBezOdhadu
			if s, ok := model.sila[x.ID]; ok {
				cil, zdroj = s, model.zdrojOdhadu[x.ID]
			}
			if zdroj == urovenVkus {
				vahaX = 1
			}
			if model.pocet[x.ID] > 0 {
				zdroj = urovenPorovnani
				if math.Sqrt(model.rozptylModelky(x)) > maxNejistotaNavrhu || model.pocet[x.ID] < minPorovnaniNavrhu {
					vahaX = vahaRozpracovane
				}
			}
			uroven := min(max(zaokrouhlitNaPul(cil), 0.5), 5)
			kotvy := podleUrovne[uroven]
			if len(kotvy) == 0 {
				nejblizsi := -1.0
				for h := range podleUrovne {
					if nejblizsi < 0 || math.Abs(h-uroven) < math.Abs(nejblizsi-uroven) || (math.Abs(h-uroven) == math.Abs(nejblizsi-uroven) && h > nejblizsi) {
						nejblizsi = h
					}
				}
				kotvy = podleUrovne[nejblizsi]
			}
			for _, y := range kotvy[:min(len(kotvy), sousedeDvojic)] {
				if vyloucene[klicDvojice(x.ID, y.ID)] {
					continue
				}
				kandidatiNeh = append(kandidatiNeh, kandidatDvojice{a: x.ID, b: y.ID, skore: informace(x, y, cil, silaM(y)) * vahaX * vahaModelky(x) * vahaModelky(y),
					pruzkum: true, druh: dvojiceNehodnocena, x: x, y: y, uroven: uroven, zdroj: zdroj})
			}
		}
	}
	if okruh != "nehodnocene" {
		for i, x := range hodnocene {
			for j := i + 1; j < min(len(hodnocene), i+1+sousedeDvojic); j++ {
				y := hodnocene[j]
				rozdil := math.Abs(x.Hodnoceni - y.Hodnoceni)
				vahaUrovne, druh := 0.0, 0
				switch {
				case rozdil == 0:
					vahaUrovne, druh = 1, dvojiceStejna
				case rozdil <= 0.5 && okruh != "stejne":
					vahaUrovne, druh = vahaSousedniUrovne, dvojiceSousedni
				case rozdil <= 1 && okruh != "stejne":
					vahaUrovne, druh = vahaVzdaleneUrovne, dvojiceVzdalena
				}
				if vahaUrovne == 0 || vyloucene[klicDvojice(x.ID, y.ID)] {
					continue
				}
				kandidatiHod = append(kandidatiHod, kandidatDvojice{a: x.ID, b: y.ID, skore: informace(x, y, silaM(x), silaM(y)) * vahaUrovne * vahaModelky(x) * vahaModelky(y),
					pruzkum: rozdil <= 0.5, druh: druh, x: x, y: y})
			}
		}
	}
	// Souboje na hranicích top 10/20/50/100 a ověření srdíček (jen výchozí okruh; seřazené už jsou)
	var kandidatiSoub []kandidatDvojice
	if okruh == "" {
		kandidatiSoub = model.kandidatiSouboju(modelky, vyloucene, vahaModelky, omezitSouboje(model, porovnani, nabidnute))
	}
	// Objevování, napříč úrovněmi a útoky na top 10 (jen výchozí okruh)
	var kandidatiObjev, kandidatiNapric, kandidatiUtok []kandidatDvojice
	if okruh == "" {
		kandidatiObjev = kandidatiObjevovani(hodnocene, model, vyloucene, vahaModelky)
		kandidatiNapric = kandidatiNapricUrovnemi(hodnocene, model, vyloucene, vahaModelky, informace)
		kandidatiUtok = kandidatiUtokuNaTop(modelky, model, vyloucene, vahaModelky, nahoda)
		seraditKandidaty(kandidatiObjev)
		seraditKandidaty(kandidatiNapric)
		seraditKandidaty(kandidatiUtok)
	}
	seraditKandidaty(kandidatiHod)
	seraditKandidaty(kandidatiNeh)
	pouzite := map[int]bool{}
	pouzitelny := func(k kandidatDvojice) bool { return !pouzite[k.a] && !pouzite[k.b] }
	pridat := func(k kandidatDvojice, duvod string) {
		pouzite[k.a], pouzite[k.b] = true, true
		a, b := k.a, k.b
		if nahoda.Intn(2) == 1 {
			a, b = b, a
		}
		d := DvojicePorovnani{A: a, B: b, Duvod: duvod}
		if k.druh == dvojiceOvereni {
			d.Druh = "overeni"
		} else if k.druh == dvojiceUtok {
			d.Druh = "utok"
		} else if jeSouboj(k.druh) {
			d.Druh = "souboj"
		}
		vysledek = append(vysledek, d)
	}
	// Další dvojice z jednoho seznamu: občas průzkum (náhodná použitelná ze stejné nebo sousední úrovně), jinak
	// nejlepší použitelná; false, když v seznamu nic použitelného není
	// Seznamy kandidátů (souboje bez průzkumu: o hranici rozhoduje pořadí, ne náhoda)
	const (
		seznamHodnocenych = iota
		seznamNehodnocenych
		seznamSouboju
	)
	dalsi := map[int]int{}
	// seznam: index seznamu (vlastní ukazatel na dalšího kandidáta), druh: seznamSouboju průzkum nemá
	vzitZ := func(kandidati []kandidatDvojice, seznam, druh int) bool {
		if druh != seznamSouboju && nahoda.Float64() < podilPruzkumu {
			var moznosti []kandidatDvojice
			for _, k := range kandidati {
				if k.pruzkum && pouzitelny(k) {
					moznosti = append(moznosti, k)
				}
			}
			if len(moznosti) > 0 {
				k := moznosti[nahoda.Intn(len(moznosti))]
				duvod := "Průzkum: náhodná dvojice ze stejné nebo sousední úrovně, aby se pořadí neučilo jen z nejistých"
				if k.druh != dvojiceStejna && k.druh != dvojiceSousedni {
					duvod = duvodDvojice(k, model)
				}
				pridat(k, duvod)
				return true
			}
		}
		for dalsi[seznam] < len(kandidati) && !pouzitelny(kandidati[dalsi[seznam]]) {
			dalsi[seznam]++
		}
		if dalsi[seznam] >= len(kandidati) {
			return false
		}
		pridat(kandidati[dalsi[seznam]], duvodDvojice(kandidati[dalsi[seznam]], model))
		return true
	}
	vzit := func(kandidati []kandidatDvojice, druh int) bool { return vzitZ(kandidati, druh, druh) }
	seznamy := [][]kandidatDvojice{kandidatiHod, kandidatiNeh, kandidatiSoub, kandidatiObjev, kandidatiNapric, kandidatiUtok}
	if okruh == "" {
		// Výchozí výběr: každá dvojice z jednoho seznamu, vylosovaného podle podílů (jen ze seznamů, které nějaké
		// kandidáty mají); když vylosovaný seznam nic použitelného nemá, bere se z dalších podle velikosti podílu
		podily := []float64{podilBeznych, podilNehodnocenych, podilSouboju, podilObjevovani, podilNapric, podilUtoku}
		for len(vysledek) < pocet {
			var moznosti []int
			soucet := 0.0
			for s, k := range seznamy {
				if len(k) > 0 && podily[s] > 0 {
					moznosti = append(moznosti, s)
					soucet += podily[s]
				}
			}
			if len(moznosti) == 0 {
				break
			}
			los, prvni := nahoda.Float64()*soucet, moznosti[len(moznosti)-1]
			for _, s := range moznosti {
				if los < podily[s] {
					prvni = s
					break
				}
				los -= podily[s]
			}
			ostatni := slices.DeleteFunc(slices.Clone(moznosti), func(s int) bool { return s == prvni })
			sort.SliceStable(ostatni, func(i, j int) bool { return podily[ostatni[i]] > podily[ostatni[j]] })
			vzato := false
			for _, s := range append([]int{prvni}, ostatni...) {
				druh := s
				if s > seznamSouboju {
					druh = seznamHodnocenych // nové seznamy mají průzkum jako běžné dvojice
				}
				if vzitZ(seznamy[s], s, druh) {
					vzato = true
					break
				}
			}
			if !vzato {
				break
			}
		}
		return vysledek
	}
	// Okruhy „stejne“ a „nehodnocene“: jen jejich seznam
	// Souboje berou z dvojic, které by jinak byly hodnocené, tolik, aby jich bylo podilSouboju ze všech
	podilSoubojuHodnocenych := podilSouboju
	if len(kandidatiNeh) > 0 {
		podilSoubojuHodnocenych /= 1 - podilNehodnocenych
	}
	for len(vysledek) < pocet {
		nejdriv, potom := seznamHodnocenych, seznamNehodnocenych
		if len(kandidatiHod) == 0 || (len(kandidatiNeh) > 0 && nahoda.Float64() < podilNehodnocenych) {
			nejdriv, potom = seznamNehodnocenych, seznamHodnocenych
		}
		poradiSeznamu := []int{nejdriv, potom, seznamSouboju}
		if nejdriv == seznamHodnocenych && len(kandidatiSoub) > 0 && nahoda.Float64() < podilSoubojuHodnocenych {
			poradiSeznamu = []int{seznamSouboju, seznamHodnocenych, seznamNehodnocenych}
		}
		vzato := false
		for _, s := range poradiSeznamu {
			if vzit(seznamy[s], s) {
				vzato = true
				break
			}
		}
		if !vzato {
			break
		}
	}
	return vysledek
}

// Kandidáti od nejlepšího skóre, při shodě podle menšího čísla modelky dvojice, jinak v původním pořadí (stabilně).
// Řadí se čísla kandidátů s předpočítanými klíči a pak se kandidáti přeskládají – přesouvat při řazení celé
// záznamy desítek tisíc kandidátů bylo nejdražší část výběru dvojic.
func seraditKandidaty(k []kandidatDvojice) {
	if len(k) < 2 {
		return
	}
	type klic struct {
		skore float64
		mensi int
		i     int32
	}
	klice := make([]klic, len(k))
	for i := range k {
		klice[i] = klic{k[i].skore, min(k[i].a, k[i].b), int32(i)}
	}
	slices.SortFunc(klice, func(x, y klic) int {
		switch {
		case x.skore != y.skore:
			if x.skore > y.skore {
				return -1
			}
			return 1
		case x.mensi != y.mensi:
			return x.mensi - y.mensi
		}
		return int(x.i - y.i)
	})
	puvodni := slices.Clone(k)
	for i, x := range klice {
		k[i] = puvodni[x.i]
	}
}

// Objevování: hodnocená modelka s nejvýš maxPorovnaniObjevu porovnáními proti kotvě – modelce s jistým místem
// (aspoň 5 porovnání) a silou co nejblíž. Méně porovnaná má přednost. hodnocene jsou seřazené podle síly.
func kandidatiObjevovani(hodnocene []*Modelka, model *modelOblibenosti, vyloucene map[[2]int]bool, vahaModelky func(*Modelka) float64) []kandidatDvojice {
	var kandidati []kandidatDvojice
	for i, x := range hodnocene {
		n := model.pocet[x.ID]
		if n > maxPorovnaniObjevu {
			continue
		}
		nalezeno := 0
		for d := 1; d <= sirkaNapric && nalezeno < 3; d++ {
			for _, j := range []int{i - d, i + d} {
				if j < 0 || j >= len(hodnocene) || nalezeno >= 3 {
					continue
				}
				y := hodnocene[j]
				if model.pocet[y.ID] < 5 || vyloucene[klicDvojice(x.ID, y.ID)] {
					continue
				}
				skore := float64(maxPorovnaniObjevu+1-n) * vahaModelky(x) * vahaModelky(y) / float64(1+nalezeno)
				kandidati = append(kandidati, kandidatDvojice{a: x.ID, b: y.ID, skore: skore, pruzkum: true, druh: dvojiceObjev, x: x, y: y})
				nalezeno++
			}
		}
	}
	return kandidati
}

// Napříč úrovněmi: hodnocené modelky, jejichž srdíčka se liší o jedno až dvě a půl, mezi sousedkami podle síly
// (do sirkaNapric míst). Přednost má dvojice, kde síly srdíčkům neodpovídají (výsledek je nejistý), a málo známé
// modelky; i jasnější dvojice ale dostanou základní váhu, aby se rozdíl srdíček občas ověřil.
func kandidatiNapricUrovnemi(hodnocene []*Modelka, model *modelOblibenosti, vyloucene map[[2]int]bool, vahaModelky func(*Modelka) float64,
	informace func(x, y *Modelka, sx, sy float64) float64) []kandidatDvojice {
	var kandidati []kandidatDvojice
	for i, x := range hodnocene {
		for j := i + 1; j < min(len(hodnocene), i+1+sirkaNapric); j++ {
			y := hodnocene[j]
			rozdil := math.Abs(x.Hodnoceni - y.Hodnoceni)
			if rozdil < 1 || rozdil > 2.5 || vyloucene[klicDvojice(x.ID, y.ID)] {
				continue
			}
			zaklad := 0.05 * (model.rozptylModelky(x) + model.rozptylModelky(y))
			skore := (informace(x, y, model.silaModelky(x), model.silaModelky(y)) + zaklad) * vahaModelky(x) * vahaModelky(y)
			kandidati = append(kandidati, kandidatDvojice{a: x.ID, b: y.ID, skore: skore, pruzkum: true, druh: dvojiceNapric, x: x, y: y})
		}
	}
	return kandidati
}

// Útok na top 10: každá modelka z potvrzené top 10 proti vyzyvatelkám zpoza ní (místa 11 až 10 + vyzyvatelekUtoku
// podle síly). Bližší silou mají přednost, s náhodnou příměsí, aby se vyzyvatelky střídaly; v top 10 tak nemá
// nikdo místo jisté a každá musí místo občas obhájit.
func kandidatiUtokuNaTop(modelky []Modelka, model *modelOblibenosti, vyloucene map[[2]int]bool, vahaModelky func(*Modelka) float64, nahoda *rand.Rand) []kandidatDvojice {
	var top, vyzyvatelky []*Modelka
	for i := range modelky {
		x := &modelky[i]
		if p := model.poradi[x.ID]; p >= 1 && p <= 10 {
			top = append(top, x)
		} else if s := model.mistoSily[x.ID]; s > 10 && s <= 10+vyzyvatelekUtoku && model.doSouboje(x) {
			vyzyvatelky = append(vyzyvatelky, x)
		}
	}
	sort.Slice(top, func(i, j int) bool { return model.poradi[top[i].ID] < model.poradi[top[j].ID] })
	sort.Slice(vyzyvatelky, func(i, j int) bool { return model.mistoSily[vyzyvatelky[i].ID] < model.mistoSily[vyzyvatelky[j].ID] })
	var kandidati []kandidatDvojice
	for _, y := range top {
		for _, x := range vyzyvatelky {
			if vyloucene[klicDvojice(x.ID, y.ID)] {
				continue
			}
			blizko := 1 / (1 + 2*math.Abs(model.oblibenost[x.ID]-model.oblibenost[y.ID]))
			skore := blizko * (0.7 + 0.6*nahoda.Float64()) * vahaModelky(x) * vahaModelky(y)
			kandidati = append(kandidati, kandidatDvojice{a: x.ID, b: y.ID, skore: skore, pruzkum: true, druh: dvojiceUtok, x: x, y: y})
		}
	}
	return kandidati
}
