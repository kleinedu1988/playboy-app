package main

import (
	"fmt"
	"math"
	"math/bits"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

// Kontrola, která se učí ze sbírky samotné (bez knihoven, jen ze statistiky údajů):
//
//  1. Rozsahy výšky, váhy, BMI, obvodů a věku se místo pevných mezí odvodí z údajů sbírky (medián ± 4,5
//     robustní σ, obdoba MAD), když jich je dost; u malé sbírky platí pevné meze z kontrola.go.
//  2. „ok-neobvykle“: neobvyklá kombinace údajů postavy (každý zvlášť v rozsahu, dohromady ne) podle
//     Mahalanobisovy vzdálenosti od středu sbírky; kovariance se odhaduje bez zjevně odlehlých modelek.
//  3. „ok-podobne-jmeno“: skoro stejná jména dvou modelek (překlep, prohozené jméno a příjmení),
//     podpořená nebo vyvrácená dalšími údaji (datum narození, první vydání, centerfold).
//  4. Učení z rozhodnutí uživatele: hodnoty modelek, u nichž je nález označený „V pořádku“, se berou jako běžné.
//     Leží-li jich za hranicí rozsahu aspoň minPotvrzenych a navazují na ni, hranice se k nim posune
//     (tři potvrzené šestnáctileté a sedmnáctileté playmate → věk 16–17 se už nehlásí). Neobvyklá kombinace
//     se nehlásí, když se velmi podobá kombinaci, kterou uživatel už potvrdil.
//  5. Prahy podle zpětné vazby (prahyKontroly, uceni.go): pravidlo, jehož nálezy uživatel opakovaně označuje
//     „V pořádku“ místo opravy údaje, se zpřísní (širší rozsah, přísnější mez kombinace a podobnosti jmen).
//     Zpřísnit jde, uvolnit ne: kontrola raději mlčí, než aby hlásila zbytečně.
//
// Sdílené nástroje (robustní odhad, Choleského inverze, Jaro–Winkler, profil postavy) jsou v uceni_modely.go.
//
// Výpočet je deterministický (žádná náhoda, řazení podle pořadí modelek) a lineární až skoro lineární
// v počtu modelek, aby kontrola i u tisíců modelek trvala zlomek sekundy.

// Parametry učení
const (
	minHodnotProUceni = 30    // z méně hodnot se rozsah neučí (platí pevný)
	minModelekPostavy = 30    // z méně modelek s aspoň třemi údaji se kombinace nekontrolují
	minUdajuPostavy   = 3     // kombinace se posuzuje jen u modelky s aspoň tolika údaji
	kRozsahu          = 4.5   // naučený rozsah: medián ± 4,5 robustní směrodatné odchylky (u normálního rozdělení 1 z 150 000)
	orezaniZ          = 3.5   // modelky s některým údajem dál než 3,5 σ se do kovariance nepočítají
	zMezeKombinace    = 4.265 // jednostranný kvantil N(0,1) pro α = 1e-5: hlásí se jen zjevné odchylky
	smrstovani        = 0.1   // podíl diagonály v kovarianci (stabilní inverze i u závislých údajů jako BMI)
	minPotvrzenych    = 3     // tolik hodnot „V pořádku“ za hranicí ji posune
	prahJmen          = 0.95  // nejmenší podobnost jmen (Jaro–Winkler s úpravami) pro nález
	prahSlov          = 0.85  // každé slovo kratšího jména musí mít v druhém podobné slovo
)

// Prahy kontroly. Výchozí jsou konstanty výše; učení ze zpětné vazby (uceni.go) je může jen zpřísnit.
type prahyKontroly struct {
	kRozsahu   [pocetPriznaku]float64 // naučený rozsah: medián ± k·σ
	zKombinace float64                // kvantil N(0,1) pro mez neobvyklé kombinace
	prahJmen   float64                // nejmenší podobnost jmen
}

func vychoziPrahy() prahyKontroly {
	p := prahyKontroly{zKombinace: zMezeKombinace, prahJmen: prahJmen}
	for j := range p.kRozsahu {
		p.kRozsahu[j] = kRozsahu
	}
	return p
}

// Funkce, kterou pravidla hlásí nález: klíč „ok-…“, zdroj (stabilní klíč pravidla), pole formuláře a popis
type pridatNalez func(m Modelka, klic, zdroj, pole, popis string)

// Rozsah jednoho údaje, mimo který se hodnota hlásí (hranice patří do rozsahu)
type rozsah struct {
	od, do  float64
	naucene bool // odvozený z údajů sbírky, jinak pevný
}

// Rozsahy všech údajů postavy
type rozsahyKontroly [pocetPriznaku]rozsah

func (r rozsah) mimo(x float64) bool { return x < r.od || x > r.do }

// „145–195“
func (r rozsah) text(p priznak) string { return p.cislo(r.od) + "–" + p.cislo(r.do) }

// Jak se o rozsahu v nálezu mluví
func (r rozsah) popis() string {
	if r.naucene {
		return "obvyklý rozsah sbírky"
	}
	return "běžný rozsah"
}

// Naučený rozsah údaje: medián ± k·σ (robustní, viz robustniOdhad), aspoň minPul na každou stranu a nikdy za rozumné meze; z málo hodnot
// pevný rozsah. Nakonec se rozšíří o hodnoty potvrzené uživatelem.
func naucitRozsah(p priznak, hodnoty, potvrzene []float64, k float64) rozsah {
	r := rozsah{od: p.od, do: p.do}
	if len(hodnoty) >= minHodnotProUceni {
		med, sOd, sDo := robustniOdhad(hodnoty, !p.desetiny)
		od := min(med-k*max(sOd, p.minSigma), med-p.minPul)
		do := max(med+k*max(sDo, p.minSigma), med+p.minPul)
		od, do = max(od, p.mezOd), min(do, p.mezDo)
		if p.desetiny {
			od, do = math.Floor(od*10)/10, math.Ceil(do*10)/10
		} else {
			od, do = math.Floor(od), math.Ceil(do)
		}
		r = rozsah{od: od, do: do, naucene: true}
	}
	return rozsiritPodlePotvrzenych(r, potvrzene, p.krok)
}

// Učení z rozhodnutí uživatele: hodnoty za hranicí, které uživatel označil „V pořádku“, se projdou od nejbližší.
// Hranice se posouvá po souvislé řadě (mezera nejvýš krok); má-li řada aspoň minPotvrzenych hodnot, hranice
// zůstane u poslední z nich. Ojedinělá vzdálená hodnota tak rozsah nerozšíří, několik podobných ano.
func rozsiritPodlePotvrzenych(r rozsah, potvrzene []float64, krok float64) rozsah {
	var pod, nad []float64
	for _, v := range potvrzene {
		if v < r.od {
			pod = append(pod, v)
		} else if v > r.do {
			nad = append(nad, v)
		}
	}
	sort.Sort(sort.Reverse(sort.Float64Slice(pod)))
	sort.Float64s(nad)
	hranice, n := r.od, 0
	for _, v := range pod {
		if hranice-v > krok {
			break
		}
		hranice, n = v, n+1
	}
	if n >= minPotvrzenych {
		r.od = hranice
	}
	hranice, n = r.do, 0
	for _, v := range nad {
		if v-hranice > krok {
			break
		}
		hranice, n = v, n+1
	}
	if n >= minPotvrzenych {
		r.do = hranice
	}
	return r
}

// Co se kontrola naučila ze sbírky (udaje a vektory postavy jsou ve stejném pořadí jako modelky)
type uceniSbirky struct {
	prahy   prahyKontroly
	rozsahy rozsahyKontroly
	udaje   []udajePostavy
	postava *modelPostavy // nil: málo údajů, kombinace se nekontrolují
}

// Model postavy pro neobvyklé kombinace: robustní standardizace každého údaje a kovariance standardizovaných údajů
type modelPostavy struct {
	pouzity       [pocetPriznaku]bool // údaj má dost hodnot, aby se z něj dalo učit
	med, sOd, sDo [pocetPriznaku]float64
	kov           [pocetPriznaku][pocetPriznaku]float64
	presnosti     map[uint8]*presnost // inverzní kovariance podle toho, které údaje modelka má
	potvrzene     []vektorPostavy     // modelky s neobvyklou kombinací označenou „V pořádku“
	vektory       []vektorPostavy     // standardizované údaje všech modelek
}

// Standardizované údaje modelky; maska = které údaje má
type vektorPostavy struct {
	id    int
	z     [pocetPriznaku]float64
	maska uint8
}

// Inverzní kovariance (matice přesnosti) pro podmnožinu údajů
type presnost struct {
	index []int
	p     [][]float64
}

// Naučí rozsahy a model postavy ze všech modelek
func naucitSe(modelky []Modelka, prahy prahyKontroly) uceniSbirky {
	var hodnoty, potvrzene [pocetPriznaku][]float64
	u := uceniSbirky{prahy: prahy, udaje: udajeSbirky(modelky)}
	for i, m := range modelky {
		x := u.udaje[i]
		for j := range pocetPriznaku {
			if !x.ma[j] {
				continue
			}
			hodnoty[j] = append(hodnoty[j], x.x[j])
			if obsahujeKlic(m.NetykaSe, priznaky[j].klic) {
				potvrzene[j] = append(potvrzene[j], x.x[j])
			}
		}
	}
	for j, p := range priznaky {
		u.rozsahy[j] = naucitRozsah(p, hodnoty[j], potvrzene[j], prahy.kRozsahu[j])
	}
	u.postava = naucitPostavu(modelky, u.udaje, hodnoty)
	return u
}

// Standardizovaná hodnota: odchylka od mediánu v robustních směrodatných odchylkách (pod a nad mediánem zvlášť)
func (mp *modelPostavy) zSkore(j int, x float64) float64 {
	if x < mp.med[j] {
		return (x - mp.med[j]) / mp.sOd[j]
	}
	return (x - mp.med[j]) / mp.sDo[j]
}

// Zpět ze standardizované hodnoty na údaj
func (mp *modelPostavy) zpet(j int, z float64) float64 {
	if z < 0 {
		return mp.med[j] + z*mp.sOd[j]
	}
	return mp.med[j] + z*mp.sDo[j]
}

// Standardizovaný vektor modelky (jen údaje, ze kterých se model učil)
func (mp *modelPostavy) vektor(id int, u udajePostavy) vektorPostavy {
	v := vektorPostavy{id: id}
	for j := range pocetPriznaku {
		if u.ma[j] && mp.pouzity[j] {
			v.z[j] = mp.zSkore(j, u.x[j])
			v.maska |= 1 << j
		}
	}
	return v
}

// Odhad modelu postavy. Kovariance se počítá po dvojicích údajů (modelky mívají jen část údajů) jen z modelek,
// které nemají žádný údaj odlehlý (|z| > 3,5), aby překlepy neroztáhly odhad; modelky s potvrzenou neobvyklou
// kombinací se počítají vždy (uživatel je označil za skutečné).
func naucitPostavu(modelky []Modelka, udaje []udajePostavy, hodnoty [pocetPriznaku][]float64) *modelPostavy {
	mp := &modelPostavy{presnosti: map[uint8]*presnost{}}
	for j, p := range priznaky {
		if len(hodnoty[j]) < minHodnotProUceni {
			continue
		}
		med, sOd, sDo := robustniOdhad(hodnoty[j], !p.desetiny)
		mp.pouzity[j] = true
		mp.med[j], mp.sOd[j], mp.sDo[j] = med, max(sOd, p.minSigma), max(sDo, p.minSigma)
	}
	vektory := make([]vektorPostavy, 0, len(modelky))
	pocet := 0
	for i, m := range modelky {
		v := mp.vektor(m.ID, udaje[i])
		if bits.OnesCount8(v.maska) >= minUdajuPostavy {
			pocet++
		}
		vektory = append(vektory, v)
		if obsahujeKlic(m.NetykaSe, "ok-neobvykle") && bits.OnesCount8(v.maska) >= minUdajuPostavy {
			mp.potvrzene = append(mp.potvrzene, v)
		}
	}
	mp.vektory = vektory
	if pocet < minModelekPostavy {
		return nil
	}

	// Součty po dvojicích údajů: počet, Σzj, Σzk, Σzj², Σzk², Σzj·zk
	var n, sj, sk, sjj, skk, sjk [pocetPriznaku][pocetPriznaku]float64
	for i, v := range vektory {
		vnitrni := obsahujeKlic(modelky[i].NetykaSe, "ok-neobvykle")
		if !vnitrni {
			vnitrni = true
			for j := range pocetPriznaku {
				if v.maska&(1<<j) != 0 && math.Abs(v.z[j]) > orezaniZ {
					vnitrni = false
					break
				}
			}
		}
		if !vnitrni {
			continue
		}
		for j := range pocetPriznaku {
			if v.maska&(1<<j) == 0 {
				continue
			}
			for k := j; k < pocetPriznaku; k++ {
				if v.maska&(1<<k) == 0 {
					continue
				}
				n[j][k]++
				sj[j][k] += v.z[j]
				sk[j][k] += v.z[k]
				sjj[j][k] += v.z[j] * v.z[j]
				skk[j][k] += v.z[k] * v.z[k]
				sjk[j][k] += v.z[j] * v.z[k]
			}
		}
	}
	// Rozptyl každého údaje ze všech jeho hodnot, korelace z dvojic (aspoň 10 společných hodnot, jinak 0)
	var rozptyl [pocetPriznaku]float64
	for j := range pocetPriznaku {
		rozptyl[j] = 1
		if c := n[j][j]; c >= 2 {
			if r := sjj[j][j]/c - (sj[j][j]/c)*(sj[j][j]/c); r > 0.05 {
				rozptyl[j] = r
			}
		}
	}
	for j := range pocetPriznaku {
		mp.kov[j][j] = rozptyl[j]
		for k := j + 1; k < pocetPriznaku; k++ {
			c := n[j][k]
			if c < 10 {
				continue
			}
			mj, mk := sj[j][k]/c, sk[j][k]/c
			vj, vk := sjj[j][k]/c-mj*mj, skk[j][k]/c-mk*mk
			if vj <= 1e-9 || vk <= 1e-9 {
				continue
			}
			kor := max(-1, min(1, (sjk[j][k]/c-mj*mk)/math.Sqrt(vj*vk)))
			mp.kov[j][k] = kor * math.Sqrt(rozptyl[j]*rozptyl[k])
			mp.kov[k][j] = mp.kov[j][k]
		}
	}
	return mp
}

// Matice přesnosti pro údaje v masce (s mezipamětí). Kovariance se smrští k diagonále, aby šla invertovat
// i u silně závislých údajů (BMI z výšky a váhy); kdyby rozklad selhal, smrští se víc.
func (mp *modelPostavy) presnost(maska uint8) *presnost {
	if p, ok := mp.presnosti[maska]; ok {
		return p
	}
	var index []int
	for j := range pocetPriznaku {
		if maska&(1<<j) != 0 {
			index = append(index, j)
		}
	}
	d := len(index)
	var inverze [][]float64
	for _, lambda := range []float64{smrstovani, 0.3, 0.6, 1} {
		c := make([][]float64, d)
		for a, j := range index {
			c[a] = make([]float64, d)
			for b, k := range index {
				c[a][b] = (1 - lambda) * mp.kov[j][k]
				if a == b {
					c[a][b] = mp.kov[j][k]
				}
			}
		}
		if inverze = invertovatCholesky(c); inverze != nil {
			break
		}
	}
	p := &presnost{index: index, p: inverze}
	mp.presnosti[maska] = p
	return p
}

// Druhá mocnina Mahalanobisovy vzdálenosti vektoru z od středu pro údaje v masce; vrací i P·z
func (p *presnost) vzdalenost(z [pocetPriznaku]float64) (float64, []float64) {
	pz := make([]float64, len(p.index))
	d2 := 0.0
	for a := range p.index {
		for b, k := range p.index {
			pz[a] += p.p[a][b] * z[k]
		}
		d2 += z[p.index[a]] * pz[a]
	}
	return d2, pz
}

// Mez Mahalanobisovy vzdálenosti (její druhé mocniny) pro daný počet údajů: kvantil rozdělení χ² pro α = 1e-5
// (Wilsonova–Hilfertyho aproximace; z = kvantil N(0,1), výchozí zMezeKombinace). U běžné sbírky jde o pár modelek,
// u kterých je kombinace opravdu výjimečná.
func mezKombinace(stupnu int, z float64) float64 {
	k := float64(stupnu)
	a := 2 / (9 * k)
	return k * math.Pow(1-a+z*math.Sqrt(a), 3)
}

// Údaj modelky je už mimo rozsah jednotlivého pravidla (ten nález stačí, kombinace se pak nehlásí)
func postavaMimoRozsahy(m Modelka, u udajePostavy, r rozsahyKontroly) bool {
	hlaseno := false
	kontrolovatPostavu(m, r, func(Modelka, string, string, string, string) { hlaseno = true })
	return hlaseno || u.ma[prVek] && r[prVek].mimo(u.x[prVek])
}

// Neobvyklá kombinace údajů postavy („ok-neobvykle“): Mahalanobisova vzdálenost od středu sbírky nad mezí.
// Popis jmenuje údaj, který k vzdálenosti přispívá nejvíc, údaj, který jeho očekávanou hodnotu nejvíc
// ovlivňuje, a rozsah, jaký by u sbírky při ostatních údajích modelky byl obvyklý.
// Modelky musí být tytéž a ve stejném pořadí jako při učení (naucitSe).
func (u uceniSbirky) kontrolovatNeobvykle(modelky []Modelka, pridat pridatNalez) {
	mp := u.postava
	if mp == nil {
		return
	}
	for i, m := range modelky {
		v := mp.vektory[i]
		if bits.OnesCount8(v.maska) < minUdajuPostavy || postavaMimoRozsahy(m, u.udaje[i], u.rozsahy) {
			continue
		}
		p := mp.presnost(v.maska)
		d2, pz := p.vzdalenost(v.z)
		if d2 <= mezKombinace(len(p.index), u.prahy.zKombinace) || mp.podobnaPotvrzene(v) {
			continue
		}
		// Příspěvek údaje ke vzdálenosti: z_j·(P·z)_j (součet příspěvků je d²)
		hlavni := 0
		for a := range p.index {
			if v.z[p.index[a]]*pz[a] > v.z[p.index[hlavni]]*pz[hlavni] {
				hlavni = a
			}
		}
		h := p.index[hlavni]
		// Podmíněné rozdělení hlavního údaje při ostatních: střed z_h − (P·z)_h / P_hh, odchylka 1/√P_hh
		phh := p.p[hlavni][hlavni]
		stred, odchylka := v.z[h]-pz[hlavni]/phh, 1/math.Sqrt(phh)
		// Údaj, který očekávanou hodnotu hlavního posouvá nejvíc
		druhy, posun := -1, 0.0
		for b, k := range p.index {
			if b != hlavni && math.Abs(p.p[hlavni][b]*v.z[k]) > posun {
				druhy, posun = b, math.Abs(p.p[hlavni][b]*v.z[k])
			}
		}
		x := u.udaje[i].x
		ph := priznaky[h]
		od := max(ph.mezOd, mp.zpet(h, stred-2*odchylka))
		do := min(ph.mezDo, mp.zpet(h, stred+2*odchylka))
		obvykle := ph.cislo(od) + "–" + ph.cislo(do)
		if ph.jednotka != "" {
			obvykle += " " + ph.jednotka
		}
		popis := "neobvyklá kombinace údajů: " + ph.nazev + " " + ph.hodnota(x[h])
		if druhy >= 0 {
			k := p.index[druhy]
			popis += " " + priznaky[k].pri + " " + priznaky[k].hodnota(x[k])
		}
		pridat(m, "ok-neobvykle", "neobvykle", ph.pole, popis+" (u sbírky obvykle "+obvykle+")")
	}
}

// Kombinace se velmi podobá kombinaci, kterou uživatel u jiné modelky označil „V pořádku“: vzdálenost obou
// modelek (na společných údajích, aspoň třech) je menší než polovina obvyklé vzdálenosti dvou modelek sbírky
// (d² ≤ počet údajů / 2; dvě náhodné modelky mají v průměru d² = 2 × počet údajů).
func (mp *modelPostavy) podobnaPotvrzene(v vektorPostavy) bool {
	for _, pv := range mp.potvrzene {
		spolecne := v.maska & pv.maska
		if pv.id == v.id || bits.OnesCount8(spolecne) < minUdajuPostavy {
			continue
		}
		var rozdil [pocetPriznaku]float64
		for j := range pocetPriznaku {
			rozdil[j] = v.z[j] - pv.z[j]
		}
		p := mp.presnost(spolecne)
		if d2, _ := p.vzdalenost(rozdil); d2 <= float64(len(p.index))/2 {
			return true
		}
	}
	return false
}

// Jméno modelky připravené k porovnání
type jmenoKPorovnani struct {
	modelka                  int    // index modelky
	puvodni                  string // jak je zapsané
	presne                   string // zjednodušené jako u „ok-jmeno“ (shodu hlásí ono)
	text                     string // slova oddělená mezerou
	cislice                  string
	slova                    [][]rune
	znaky, otoceny, serazeny []rune  // slova za sebou; příjmení na začátku; slova abecedně
	idSlov                   []int32 // slova ve slovníku sbírky
}

// Slova všech jmen sbírky, každé jednou
type slovnikSlov struct {
	id    map[string]int32
	znaky [][]rune
}

// Číslo slova ve slovníku (nové se přidá)
func (s *slovnikSlov) cislo(slovo string) int32 {
	id, ok := s.id[slovo]
	if !ok {
		id = int32(len(s.znaky))
		s.id[slovo] = id
		s.znaky = append(s.znaky, []rune(slovo))
	}
	return id
}

// Ke každému slovu podobná slova (Jaro–Winkler aspoň prahSlov, včetně slova samého). Porovnají se jen slova
// se společnými trigramy (s mezerou na krajích): krátká aspoň s jedním, dlouhá s tolika, aby je dva překlepy
// (každý zničí nejvýš tři trigramy) nemohly rozdělit. Slov je ve sbírce málo (jména se opakují), takže je to rychlé.
func (s *slovnikSlov) podobna() [][]int32 {
	n := len(s.znaky)
	podobna := make([][]int32, n)
	trigramy := make([][]int32, n)
	idTrigramu := map[string]int32{}
	for u, slovo := range s.znaky {
		znaky := append(append([]rune{' '}, slovo...), ' ')
		for i := 0; i+3 <= len(znaky); i++ {
			t := string(znaky[i : i+3])
			id, ok := idTrigramu[t]
			if !ok {
				id = int32(len(idTrigramu))
				idTrigramu[t] = id
			}
			if !obsahujeCislo(trigramy[u], id) {
				trigramy[u] = append(trigramy[u], id)
			}
		}
	}
	seznamy := make([][]int32, len(idTrigramu))
	pocty := make([]int32, n)
	var dotcena []int32
	for u := range n {
		podobna[u] = append(podobna[u], int32(u))
		for _, t := range trigramy[u] {
			for _, v := range seznamy[t] {
				if pocty[v] == 0 {
					dotcena = append(dotcena, v)
				}
				pocty[v]++
			}
		}
		for _, v := range dotcena {
			spolecnych := int(pocty[v])
			pocty[v] = 0
			if spolecnych >= min(len(trigramy[u]), len(trigramy[v]))-6 && jaroWinklerZnaku(s.znaky[u], s.znaky[v]) >= prahSlov {
				podobna[u] = append(podobna[u], v)
				podobna[v] = append(podobna[v], int32(u))
			}
		}
		dotcena = dotcena[:0]
		for _, t := range trigramy[u] {
			seznamy[t] = append(seznamy[t], int32(u))
		}
	}
	return podobna
}

// Je číslo v krátkém seznamu
func obsahujeCislo(seznam []int32, x int32) bool {
	for _, y := range seznam {
		if y == x {
			return true
		}
	}
	return false
}

// Připraví jméno: zjednodušení, slova bez interpunkce, otočené pořadí (příjmení na začátku) a slova abecedně
func pripravitJmeno(jmeno string, modelka int, slovnik *slovnikSlov) jmenoKPorovnani {
	slova := strings.FieldsFunc(zjednodusit(jmeno), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
	j := jmenoKPorovnani{modelka: modelka, puvodni: strings.TrimSpace(jmeno), presne: zjednodusit(strings.TrimSpace(jmeno))}
	j.text = strings.Join(slova, " ")
	j.znaky, j.otoceny = []rune(j.text), []rune(j.text)
	if len(slova) > 1 {
		j.otoceny = []rune(slova[len(slova)-1] + " " + strings.Join(slova[:len(slova)-1], " "))
	}
	serazena := append([]string(nil), slova...)
	sort.Strings(serazena)
	j.serazeny = []rune(strings.Join(serazena, " "))
	for _, slovo := range slova {
		j.slova = append(j.slova, []rune(slovo))
		if id := slovnik.cislo(slovo); !obsahujeCislo(j.idSlov, id) {
			j.idSlov = append(j.idSlov, id)
		}
	}
	j.cislice = strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, j.text)
	return j
}

// Každé slovo kratšího jména má ve druhém podobné slovo (Karin a Mirjam van Breeschooten nejsou tatáž)
func slovaOdpovidaji(a, b [][]rune) bool {
	if len(a) > len(b) {
		a, b = b, a
	}
	for _, s := range a {
		nejlepsi := 0.0
		for _, t := range b {
			nejlepsi = max(nejlepsi, jaroWinklerZnaku(s, t))
		}
		if nejlepsi < prahSlov {
			return false
		}
	}
	return true
}

// Rok narození ze zapsaného data; prázdný, když není znám
func rokNarozeni(m Modelka) string {
	d := strings.TrimSpace(m.NarozeniDatum)
	if len(d) >= 4 {
		if _, err := strconv.Atoi(d[:4]); err == nil {
			return d[:4]
		}
	}
	return ""
}

// Podobnost dvou jmen dvou modelek upravená dalšími údaji; ok = false, když nejde o pravděpodobně tutéž modelku.
// Další údaje: jiný rok narození vylučuje; stejné datum narození (aspoň měsíc) nebo stejné první vydání přidá
// 0,04; jiný měsíc narození ubere 0,03; centerfoldy v různých číslech uberou 0,05 (playmate má centerfold jeden).
// Jednoslovné jméno (pseudonym) se hlásí jen s podporou dalších údajů.
func podobnostModelek(a, b jmenoKPorovnani, ma, mb Modelka, prah float64) (skore float64, duvody []string, ok bool) {
	if a.presne == b.presne || a.cislice != b.cislice || len(a.znaky) < 5 || len(b.znaky) < 5 {
		return 0, nil, false
	}
	if rokA, rokB := rokNarozeni(ma), rokNarozeni(mb); rokA != "" && rokB != "" && rokA != rokB {
		return 0, nil, false
	}
	// Nejlepší z porovnání v zapsaném pořadí, s prohozeným jménem a příjmením a se slovy abecedně
	// (další údaje přidají nejvýš 0,08, slabší podobnost tedy nemůže stačit)
	skore = jaroWinklerZnaku(a.znaky, b.znaky)
	if len(a.slova) > 1 || len(b.slova) > 1 {
		skore = max(skore, jaroWinklerZnaku(a.znaky, b.otoceny), jaroWinklerZnaku(a.otoceny, b.znaky), jaroWinklerZnaku(a.serazeny, b.serazeny))
	}
	if skore < prah-0.08 || !slovaOdpovidaji(a.slova, b.slova) {
		return 0, nil, false
	}
	narA, narB := strings.TrimSpace(ma.NarozeniDatum), strings.TrimSpace(mb.NarozeniDatum)
	if len(narA) >= 7 && len(narB) >= 7 {
		if narA[:7] == narB[:7] {
			skore += 0.04
			duvody = append(duvody, "stejné datum narození")
		} else {
			skore -= 0.03
		}
	}
	if prvniA := prvniVydani(ma); prvniA != "" && prvniA == prvniVydani(mb) {
		skore += 0.04
		duvody = append(duvody, "stejné první vydání")
	}
	if len(ma.Centerfoldy) > 0 && len(mb.Centerfoldy) > 0 {
		spolecny := false
		for _, v := range ma.Centerfoldy {
			for _, w := range mb.Centerfoldy {
				spolecny = spolecny || v == w
			}
		}
		if !spolecny {
			skore -= 0.05
		}
	}
	if (len(a.slova) < 2 || len(b.slova) < 2) && len(duvody) == 0 {
		return 0, nil, false
	}
	return skore, duvody, skore >= prah
}

// Pravděpodobně dvakrát založená modelka podle podobného jména („ok-podobne-jmeno“). Aby se neporovnávala
// každá s každou: dvojici posuzuje jméno s méně slovy (nebo při stejném počtu dřívější) a každé jeho slovo musí
// mít ve druhém jménu podobné slovo. Stačí proto projít jména, která mají slovo podobné jeho nejvzácnějšímu
// slovu (u „Jennifer Novak“ jména s podobou „Novak“, ne všechny Jennifer). Předvýběr tak nic nevynechá.
// Nález dostane později přidaná modelka (vyšší ID) se jménem té druhé.
func kontrolovatPodobnaJmena(modelky []Modelka, prah float64, pridat pridatNalez) {
	slovnik := &slovnikSlov{id: map[string]int32{}}
	var jmena []jmenoKPorovnani
	for i, m := range modelky {
		videna := map[string]bool{}
		for _, jmeno := range append([]string{m.Jmeno}, strings.Split(m.DalsiJmena, ",")...) {
			j := pripravitJmeno(jmeno, i, slovnik)
			if j.text == "" || videna[j.text] {
				continue
			}
			videna[j.text] = true
			jmena = append(jmena, j)
		}
	}
	podobna := slovnik.podobna()
	jmenaSlova := make([][]int32, len(slovnik.znaky))
	for i, j := range jmena {
		for _, id := range j.idSlov {
			jmenaSlova[id] = append(jmenaSlova[id], int32(i))
		}
	}

	type dvojice struct {
		hlasena, druha    int // indexy modelek
		jmeno, jmenoDruhe string
		skore             float64
		duvody            []string
	}
	nejlepsi := map[[2]int]*dvojice{}
	navstiveno := make([]int, len(jmena))
	for i := range navstiveno {
		navstiveno[i] = -1
	}
	for i := range jmena {
		a := &jmena[i]
		vzacne, nejmene := int32(-1), math.MaxInt
		for _, id := range a.idSlov {
			pocet := 0
			for _, u := range podobna[id] {
				pocet += len(jmenaSlova[u])
			}
			if pocet < nejmene {
				vzacne, nejmene = id, pocet
			}
		}
		for _, u := range podobna[vzacne] {
			for _, j32 := range jmenaSlova[u] {
				j := int(j32)
				if navstiveno[j] == i {
					continue
				}
				navstiveno[j] = i
				b := &jmena[j]
				if b.modelka == a.modelka || len(b.slova) < len(a.slova) || len(b.slova) == len(a.slova) && j < i {
					continue
				}
				ma, mb := modelky[a.modelka], modelky[b.modelka]
				skore, duvody, ok := podobnostModelek(*a, *b, ma, mb, prah)
				if !ok {
					continue
				}
				// Nález patří později přidané modelce (vyšší ID, při shodě později v seznamu)
				d := dvojice{hlasena: a.modelka, druha: b.modelka, jmeno: a.puvodni, jmenoDruhe: b.puvodni, skore: skore, duvody: duvody}
				if mb.ID > ma.ID || mb.ID == ma.ID && b.modelka > a.modelka {
					d.hlasena, d.druha, d.jmeno, d.jmenoDruhe = b.modelka, a.modelka, b.puvodni, a.puvodni
				}
				klic := [2]int{min(a.modelka, b.modelka), max(a.modelka, b.modelka)}
				if s, ok := nejlepsi[klic]; !ok || skore > s.skore {
					nejlepsi[klic] = &d
				}
			}
		}
	}

	vysledky := make([]*dvojice, 0, len(nejlepsi))
	for _, d := range nejlepsi {
		vysledky = append(vysledky, d)
	}
	sort.Slice(vysledky, func(i, j int) bool {
		if vysledky[i].hlasena != vysledky[j].hlasena {
			return vysledky[i].hlasena < vysledky[j].hlasena
		}
		return vysledky[i].druha < vysledky[j].druha
	})
	for _, d := range vysledky {
		druha := modelky[d.druha]
		kdo := "u modelky " + druha.Jmeno
		if d.jmenoDruhe != druha.Jmeno {
			kdo += " („" + d.jmenoDruhe + "“)"
		}
		duvod := ""
		if len(d.duvody) > 0 {
			duvod = ", " + strings.Join(d.duvody, ", ")
		}
		pridat(modelky[d.hlasena], "ok-podobne-jmeno", "podobne-jmeno", "inputDalsiJmena",
			fmt.Sprintf("jméno „%s“ je skoro stejné jako %s (podobnost %d %%%s) – tatáž modelka založená dvakrát?",
				d.jmeno, kdo, int(math.Round(min(1, d.skore)*100)), duvod))
	}
}
