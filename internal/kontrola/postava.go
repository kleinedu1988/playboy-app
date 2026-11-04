package kontrola

import (
	"math"
	"math/bits"
	"playboy-app/internal/hledani"
	"playboy-app/internal/uceni"
	"sort"
	"strings"
)

// Parametry učení
const (
	MinHodnotProUceni = 30    // z méně hodnot se rozsah neučí (platí pevný)
	MinModelekPostavy = 30    // z méně modelek s aspoň třemi údaji se kombinace nekontrolují
	MinUdajuPostavy   = 3     // kombinace se posuzuje jen u modelky s aspoň tolika údaji
	KRozsahu          = 4.5   // naučený rozsah: medián ± 4,5 robustní směrodatné odchylky
	OrezaniZ          = 3.5   // modelky s některým údajem dál než 3,5 σ se do kovariance nepočítají
	ZMezeKombinace    = 4.265 // jednostranný kvantil N(0,1) pro α = 1e-5
	Smrstovani        = 0.1   // podíl diagonály v kovarianci
	MinPotvrzenych    = 3     // tolik hodnot „V pořádku“ za hranicí ji posune
	PrahJmen          = 0.95  // nejmenší podobnost jmen (Jaro–Winkler s úpravami) pro nález
	PrahSlov          = 0.85  // každé slovo kratšího jména musí mít v druhém podobné slovo
)

// Prahy kontroly. Výchozí jsou konstanty výše; učení ze zpětné vazby (uceni.go) je může jen zpřísnit.
type PrahyKontroly struct {
	KRozsahu   [uceni.PocetPriznaku]float64 // naučený rozsah: medián ± k·σ
	ZKombinace float64                      // kvantil N(0,1) pro mez neobvyklé kombinace
	PrahJmen   float64                      // nejmenší podobnost jmen
}

func VychoziPrahy() PrahyKontroly {
	p := PrahyKontroly{ZKombinace: ZMezeKombinace, PrahJmen: PrahJmen}
	for j := range p.KRozsahu {
		p.KRozsahu[j] = KRozsahu
	}
	return p
}

// Rozsah jednoho údaje, mimo který se hodnota hlásí (hranice patří do rozsahu)
type Rozsah struct {
	Od, Do  float64
	Naucene bool // odvozený z údajů sbírky, jinak pevný
}

// Rozsahy všech údajů postavy
type RozsahyKontroly [uceni.PocetPriznaku]Rozsah

func (r Rozsah) Mimo(x float64) bool { return x < r.Od || x > r.Do }

// „145–195“
func (r Rozsah) Text(p uceni.Priznak) string { return p.Cislo(r.Od) + "–" + p.Cislo(r.Do) }

// Jak se o rozsahu v nálezu mluví
func (r Rozsah) Popis() string {
	if r.Naucene {
		return "obvyklý rozsah sbírky"
	}
	return "běžný rozsah"
}

func NaucitRozsah(p uceni.Priznak, hodnoty, potvrzene []float64, k float64) Rozsah {
	var med, sOd, sDo float64
	if len(hodnoty) >= MinHodnotProUceni {
		med, sOd, sDo = uceni.RobustniOdhad(hodnoty, !p.Desetiny)
	}
	return naucitRozsahZOdhadu(p, len(hodnoty) >= MinHodnotProUceni, med, sOd, sDo, potvrzene, k)
}

func naucitRozsahZOdhadu(p uceni.Priznak, maOdhad bool, med, sOd, sDo float64, potvrzene []float64, k float64) Rozsah {
	r := Rozsah{Od: p.Od, Do: p.Do}
	if maOdhad {
		od := min(med-k*max(sOd, p.MinSigma), med-p.MinPul)
		do := max(med+k*max(sDo, p.MinSigma), med+p.MinPul)
		od, do = max(od, p.MezOd), min(do, p.MezDo)
		if p.Desetiny {
			od, do = math.Floor(od*10)/10, math.Ceil(do*10)/10
		} else {
			od, do = math.Floor(od), math.Ceil(do)
		}
		r = Rozsah{Od: od, Do: do, Naucene: true}
	}
	return RozsiritPodlePotvrzenych(r, potvrzene, p.Krok)
}

func RozsiritPodlePotvrzenych(r Rozsah, potvrzene []float64, krok float64) Rozsah {
	var pod, nad []float64
	for _, v := range potvrzene {
		if v < r.Od {
			pod = append(pod, v)
		} else if v > r.Do {
			nad = append(nad, v)
		}
	}
	sort.Sort(sort.Reverse(sort.Float64Slice(pod)))
	sort.Float64s(nad)
	hranice, n := r.Od, 0
	for _, v := range pod {
		if hranice-v > krok {
			break
		}
		hranice, n = v, n+1
	}
	if n >= MinPotvrzenych {
		r.Od = hranice
	}
	hranice, n = r.Do, 0
	for _, v := range nad {
		if v-hranice > krok {
			break
		}
		hranice, n = v, n+1
	}
	if n >= MinPotvrzenych {
		r.Do = hranice
	}
	return r
}

// Co se kontrola naučila ze sbírky
type UceniSbirky struct {
	Prahy   PrahyKontroly
	Rozsahy RozsahyKontroly
	Udaje   []uceni.UdajePostavy
	Postava *ModelPostavy // nil: málo údajů, kombinace se nekontrolují
}

type ModelPostavy struct {
	Pouzity       [uceni.PocetPriznaku]bool
	Med, SOd, SDo [uceni.PocetPriznaku]float64
	Kov           [uceni.PocetPriznaku][uceni.PocetPriznaku]float64
	Presnosti     map[uint8]*Presnost
	Potvrzene     []VektorPostavy
	Vektory       []VektorPostavy
}

type VektorPostavy struct {
	ID    int
	Z     [uceni.PocetPriznaku]float64
	Maska uint8
}

type Presnost struct {
	Index []int
	P     [][]float64
}

func obsahujeKlic(seznam, klic string) bool {
	if seznam == "" {
		return false
	}
	for _, k := range strings.Split(seznam, ",") {
		if strings.TrimSpace(k) == klic {
			return true
		}
	}
	return false
}

// Naučí rozsahy a model postavy ze všech modelek (robustní odhad se pro každý příznak počítá jen jednou)
func NaucitSe(modelky []hledani.Modelka, prahy PrahyKontroly) UceniSbirky {
	var hodnoty, potvrzene [uceni.PocetPriznaku][]float64
	u := UceniSbirky{Prahy: prahy, Udaje: uceni.UdajeSbirky(modelky)}
	for i, m := range modelky {
		x := u.Udaje[i]
		for j := range uceni.PocetPriznaku {
			if !x.Ma[j] {
				continue
			}
			hodnoty[j] = append(hodnoty[j], x.X[j])
			if obsahujeKlic(m.NetykaSe, uceni.Priznaky[j].Klic) {
				potvrzene[j] = append(potvrzene[j], x.X[j])
			}
		}
	}
	var pouzity [uceni.PocetPriznaku]bool
	var med, sOd, sDo [uceni.PocetPriznaku]float64
	for j, p := range uceni.Priznaky {
		if len(hodnoty[j]) >= MinHodnotProUceni {
			pouzity[j] = true
			med[j], sOd[j], sDo[j] = uceni.RobustniOdhad(hodnoty[j], !p.Desetiny)
		}
		u.Rozsahy[j] = naucitRozsahZOdhadu(p, pouzity[j], med[j], sOd[j], sDo[j], potvrzene[j], prahy.KRozsahu[j])
	}
	u.Postava = naucitPostavuZOdhadu(modelky, u.Udaje, pouzity, med, sOd, sDo)
	return u
}

func (mp *ModelPostavy) zSkore(j int, x float64) float64 {
	if x < mp.Med[j] {
		return (x - mp.Med[j]) / mp.SOd[j]
	}
	return (x - mp.Med[j]) / mp.SDo[j]
}

func (mp *ModelPostavy) zpet(j int, z float64) float64 {
	if z < 0 {
		return mp.Med[j] + z*mp.SOd[j]
	}
	return mp.Med[j] + z*mp.SDo[j]
}

func (mp *ModelPostavy) vektor(id int, u uceni.UdajePostavy) VektorPostavy {
	v := VektorPostavy{ID: id}
	for j := range uceni.PocetPriznaku {
		if u.Ma[j] && mp.Pouzity[j] {
			v.Z[j] = mp.zSkore(j, u.X[j])
			v.Maska |= 1 << j
		}
	}
	return v
}

func naucitPostavuZOdhadu(modelky []hledani.Modelka, udaje []uceni.UdajePostavy, pouzity [uceni.PocetPriznaku]bool, med, sOd, sDo [uceni.PocetPriznaku]float64) *ModelPostavy {
	mp := &ModelPostavy{Presnosti: map[uint8]*Presnost{}, Pouzity: pouzity, Med: med}
	for j, p := range uceni.Priznaky {
		if pouzity[j] {
			mp.SOd[j], mp.SDo[j] = max(sOd[j], p.MinSigma), max(sDo[j], p.MinSigma)
		}
	}
	vektory := make([]VektorPostavy, 0, len(modelky))
	pocet := 0
	for i, m := range modelky {
		v := mp.vektor(m.ID, udaje[i])
		if bits.OnesCount8(v.Maska) >= MinUdajuPostavy {
			pocet++
		}
		vektory = append(vektory, v)
		if obsahujeKlic(m.NetykaSe, "ok-neobvykle") && bits.OnesCount8(v.Maska) >= MinUdajuPostavy {
			mp.Potvrzene = append(mp.Potvrzene, v)
		}
	}
	mp.Vektory = vektory
	if pocet < MinModelekPostavy {
		return nil
	}

	var n, sj, sk, sjj, skk, sjk [uceni.PocetPriznaku][uceni.PocetPriznaku]float64
	for i, v := range vektory {
		vnitrni := obsahujeKlic(modelky[i].NetykaSe, "ok-neobvykle")
		if !vnitrni {
			vnitrni = true
			for j := range uceni.PocetPriznaku {
				if v.Maska&(1<<j) != 0 && math.Abs(v.Z[j]) > OrezaniZ {
					vnitrni = false
					break
				}
			}
		}
		if !vnitrni {
			continue
		}
		for j := range uceni.PocetPriznaku {
			if v.Maska&(1<<j) == 0 {
				continue
			}
			for k := j; k < uceni.PocetPriznaku; k++ {
				if v.Maska&(1<<k) == 0 {
					continue
				}
				n[j][k]++
				sj[j][k] += v.Z[j]
				sk[j][k] += v.Z[k]
				sjj[j][k] += v.Z[j] * v.Z[j]
				skk[j][k] += v.Z[k] * v.Z[k]
				sjk[j][k] += v.Z[j] * v.Z[k]
			}
		}
	}
	var rozptyl [uceni.PocetPriznaku]float64
	for j := range uceni.PocetPriznaku {
		rozptyl[j] = 1
		if c := n[j][j]; c >= 2 {
			if r := sjj[j][j]/c - (sj[j][j]/c)*(sj[j][j]/c); r > 0.05 {
				rozptyl[j] = r
			}
		}
	}
	for j := range uceni.PocetPriznaku {
		mp.Kov[j][j] = rozptyl[j]
		for k := j + 1; k < uceni.PocetPriznaku; k++ {
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
			mp.Kov[j][k] = kor * math.Sqrt(rozptyl[j]*rozptyl[k])
			mp.Kov[k][j] = mp.Kov[j][k]
		}
	}
	return mp
}

func (mp *ModelPostavy) Presnost(maska uint8) *Presnost {
	if p, ok := mp.Presnosti[maska]; ok {
		return p
	}
	var index []int
	for j := range uceni.PocetPriznaku {
		if maska&(1<<j) != 0 {
			index = append(index, j)
		}
	}
	d := len(index)
	var inverze [][]float64
	for _, lambda := range []float64{Smrstovani, 0.3, 0.6, 1} {
		c := make([][]float64, d)
		for a, j := range index {
			c[a] = make([]float64, d)
			for b, k := range index {
				c[a][b] = (1 - lambda) * mp.Kov[j][k]
				if a == b {
					c[a][b] = mp.Kov[j][k]
				}
			}
		}
		if inverze = uceni.InvertovatCholesky(c); inverze != nil {
			break
		}
	}
	p := &Presnost{Index: index, P: inverze}
	mp.Presnosti[maska] = p
	return p
}

// Druhá mocnina Mahalanobisovy vzdálenosti vektoru z od středu pro údaje v masce; vrací P·z na zásobníku
func (p *Presnost) Vzdalenost(z [uceni.PocetPriznaku]float64) (float64, [uceni.PocetPriznaku]float64) {
	var pz [uceni.PocetPriznaku]float64
	d2 := 0.0
	for a := range p.Index {
		s := 0.0
		pa := p.P[a]
		for b, k := range p.Index {
			s += pa[b] * z[k]
		}
		pz[a] = s
		d2 += z[p.Index[a]] * s
	}
	return d2, pz
}

func MezKombinace(stupnu int, z float64) float64 {
	k := float64(stupnu)
	a := 2 / (9 * k)
	return k * math.Pow(1-a+z*math.Sqrt(a), 3)
}

// Rychlá numerická kontrola bez formátování textů nálezů
func PostavaMimoRozsahy(m hledani.Modelka, u uceni.UdajePostavy, r RozsahyKontroly) bool {
	if m.VyskaCm > 0 && r[uceni.PrVyska].Mimo(float64(m.VyskaCm)) {
		return true
	}
	if m.VahaKg > 0 && r[uceni.PrVaha].Mimo(float64(m.VahaKg)) {
		return true
	}
	if m.VyskaCm > 0 && m.VahaKg > 0 {
		metry := float64(m.VyskaCm) / 100
		if r[uceni.PrBmi].Mimo(float64(m.VahaKg) / (metry * metry)) {
			return true
		}
	}
	if m.ObvodHrudnikCm > 0 && r[uceni.PrHrudnik].Mimo(float64(m.ObvodHrudnikCm)) ||
		m.ObvodPasCm > 0 && r[uceni.PrPas].Mimo(float64(m.ObvodPasCm)) ||
		m.ObvodBokyCm > 0 && r[uceni.PrBoky].Mimo(float64(m.ObvodBokyCm)) {
		return true
	}
	if m.ObvodPasCm > 0 && (m.ObvodBokyCm > 0 && m.ObvodPasCm >= m.ObvodBokyCm || m.ObvodHrudnikCm > 0 && m.ObvodPasCm >= m.ObvodHrudnikCm) {
		return true
	}
	return u.Ma[uceni.PrVek] && r[uceni.PrVek].Mimo(u.X[uceni.PrVek])
}

func (u UceniSbirky) KontrolovatNeobvykle(modelky []hledani.Modelka, pridat PridatNalez) {
	mp := u.Postava
	if mp == nil {
		return
	}
	for i, m := range modelky {
		v := mp.Vektory[i]
		if bits.OnesCount8(v.Maska) < MinUdajuPostavy || PostavaMimoRozsahy(m, u.Udaje[i], u.Rozsahy) {
			continue
		}
		p := mp.Presnost(v.Maska)
		d2, pz := p.Vzdalenost(v.Z)
		if d2 <= MezKombinace(len(p.Index), u.Prahy.ZKombinace) || mp.PodobnaPotvrzene(v) {
			continue
		}
		hlavni := 0
		for a := range p.Index {
			if v.Z[p.Index[a]]*pz[a] > v.Z[p.Index[hlavni]]*pz[hlavni] {
				hlavni = a
			}
		}
		h := p.Index[hlavni]
		phh := p.P[hlavni][hlavni]
		stred, odchylka := v.Z[h]-pz[hlavni]/phh, 1/math.Sqrt(phh)
		druhy, posun := -1, 0.0
		for b, k := range p.Index {
			if b != hlavni && math.Abs(p.P[hlavni][b]*v.Z[k]) > posun {
				druhy, posun = b, math.Abs(p.P[hlavni][b]*v.Z[k])
			}
		}
		x := u.Udaje[i].X
		ph := uceni.Priznaky[h]
		od := max(ph.MezOd, mp.zpet(h, stred-2*odchylka))
		do := min(ph.MezDo, mp.zpet(h, stred+2*odchylka))
		obvykle := ph.Cislo(od) + "–" + ph.Cislo(do)
		if ph.Jednotka != "" {
			obvykle += " " + ph.Jednotka
		}
		popis := "neobvyklá kombinace údajů: " + ph.Nazev + " " + ph.Hodnota(x[h])
		if druhy >= 0 {
			k := p.Index[druhy]
			popis += " " + uceni.Priznaky[k].Pri + " " + uceni.Priznaky[k].Hodnota(x[k])
		}
		pridat(m, "ok-neobvykle", "neobvykle", ph.Pole, popis+" (u sbírky obvykle "+obvykle+")")
	}
}

func (mp *ModelPostavy) PodobnaPotvrzene(v VektorPostavy) bool {
	for _, pv := range mp.Potvrzene {
		spolecne := v.Maska & pv.Maska
		if pv.ID == v.ID || bits.OnesCount8(spolecne) < MinUdajuPostavy {
			continue
		}
		var rozdil [uceni.PocetPriznaku]float64
		for j := range uceni.PocetPriznaku {
			rozdil[j] = v.Z[j] - pv.Z[j]
		}
		p := mp.Presnost(spolecne)
		if d2, _ := p.Vzdalenost(rozdil); d2 <= float64(len(p.Index))/2 {
			return true
		}
	}
	return false
}
