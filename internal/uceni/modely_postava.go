package uceni

import (
	"math"
	"math/bits"
	"sort"
	"strconv"
	"strings"

	"playboy-app/internal/hledani"
)

// Profil postavy: údaje (výška, váha, obvody, BMI, věk), robustní odhad středu a rozptylu, lineární
// regrese s ověřením vynecháním jedné modelky a odhad k nejbližšími sousedy.

// Rozsahy, mimo které údaj stojí za kontrolu (ne za zákaz: modelky bývají i mimo ně). Platí u malé sbírky;
// když je údajů dost, nahradí je rozsahy naučené ze sbírky.
const (
	VekOd, VekDo         = 18, 45
	VyskaOd, VyskaDo     = 145, 195
	VahaOd, VahaDo       = 38, 95
	BmiOd, BmiDo         = 15.0, 30.0
	HrudnikOd, HrudnikDo = 65, 130
	PasOd, PasDo         = 45, 100
	BokyOd, BokyDo       = 65, 130
	PrvniRokCasopisu     = 1953
)

// Údaje postavy, ze kterých se kontrola i návrhy učí (pořadí = index v polích)
const (
	PrVyska = iota
	PrVaha
	PrHrudnik
	PrPas
	PrBoky
	PrBmi
	PrVek
	PocetPriznaku
)

// Priznak popisuje údaj postavy pro učení a pro text nálezu
type Priznak struct {
	Nazev, Pri, Jednotka string // „výška“, „při výšce“, „cm“
	Pole                 string // pole formuláře, kde se údaj opraví
	Klic                 string // nález, jehož „V pořádku“ potvrzuje hodnotu jako běžnou
	Od, Do               float64
	MezOd, MezDo         float64 // rozumné meze: naučený rozsah za ně nikdy nesahá
	MinPul               float64 // naučený rozsah sahá od mediánu aspoň o tolik na každou stranu
	MinSigma             float64 // nejmenší směrodatná odchylka (celá čísla mívají MAD nulovou)
	Krok                 float64 // největší mezera mezi potvrzenými hodnotami, přes kterou se hranice posune
	Desetiny             bool    // zobrazuje se s jedním desetinným místem (BMI)
}

// Priznaky obsahuje údaje postavy: pevné meze, rozumné meze a minimální šířky naučeného rozsahu.
// Dolní mez věku zůstává 18 let (mladší playmate stojí za kontrolu vždy); posunout ji může jen uživatel svým „V pořádku“.
var Priznaky = [PocetPriznaku]Priznak{
	PrVyska: {Nazev: "výška", Pri: "při výšce", Jednotka: "cm", Pole: "inputVyska", Klic: "ok-vyska",
		Od: VyskaOd, Do: VyskaDo, MezOd: 135, MezDo: 205, MinPul: 15, MinSigma: 2, Krok: 3},
	PrVaha: {Nazev: "váha", Pri: "při váze", Jednotka: "kg", Pole: "inputVaha", Klic: "ok-vaha",
		Od: VahaOd, Do: VahaDo, MezOd: 32, MezDo: 120, MinPul: 12, MinSigma: 2, Krok: 3},
	PrHrudnik: {Nazev: "hrudník", Pri: "při hrudníku", Jednotka: "cm", Pole: "inputHrudnik", Klic: "ok-miry",
		Od: HrudnikOd, Do: HrudnikDo, MezOd: 60, MezDo: 150, MinPul: 12, MinSigma: 1.5, Krok: 3},
	PrPas: {Nazev: "pas", Pri: "při pasu", Jednotka: "cm", Pole: "inputPas", Klic: "ok-miry",
		Od: PasOd, Do: PasDo, MezOd: 40, MezDo: 110, MinPul: 8, MinSigma: 1.5, Krok: 3},
	PrBoky: {Nazev: "boky", Pri: "při bocích", Jednotka: "cm", Pole: "inputBoky", Klic: "ok-miry",
		Od: BokyOd, Do: BokyDo, MezOd: 60, MezDo: 150, MinPul: 10, MinSigma: 1.5, Krok: 3},
	PrBmi: {Nazev: "BMI", Pri: "při BMI", Pole: "inputVaha", Klic: "ok-bmi",
		Od: BmiOd, Do: BmiDo, MezOd: 13, MezDo: 35, MinPul: 3, MinSigma: 0.4, Krok: 1, Desetiny: true},
	PrVek: {Nazev: "věk při prvním vydání", Pri: "při věku", Jednotka: "let", Pole: "inputNarozeniDatum", Klic: "ok-vek",
		Od: VekOd, Do: VekDo, MezOd: VekOd, MezDo: 60, MinPul: 8, MinSigma: 1, Krok: 1},
}

// Cislo vrátí číslo údaje k zobrazení (BMI s desetinnou čárkou)
func (p Priznak) Cislo(x float64) string {
	if p.Desetiny {
		return strings.Replace(strconv.FormatFloat(x, 'f', 1, 64), ".", ",", 1)
	}
	return strconv.Itoa(int(math.Round(x)))
}

// Hodnota vrátí formátovanou hodnotu („pas 80 cm“, „BMI 17,1“)
func (p Priznak) Hodnota(x float64) string {
	if p.Jednotka == "" {
		return p.Cislo(x)
	}
	return p.Cislo(x) + " " + p.Jednotka
}

// JePlatneCislo ověří, zda řetězec odpovídá číslu časopisu RRRR-MM nebo speciálu RRRR-Snn (případně s edicí -XX).
func JePlatneCislo(vydani string) bool {
	return len(vydani) >= 7 && (vydani[5] <= '9' || vydani[5] == 'S') && hledani.JePlatneVydani(vydani)
}

// JeSpecial rozpozná speciální vydání (RRRR-Snn): nemá měsíc, proto se nepočítá mezi měsíční čísla ročníku.
func JeSpecial(vydani string) bool {
	return len(vydani) >= 8 && vydani[4] == '-' && vydani[5] == 'S'
}

// PrvniVydani vrátí první měsíční vydání modelky (bez speciálů); prázdné, když žádné nemá.
func PrvniVydani(m hledani.Modelka) string {
	prvni := ""
	for _, v := range m.Vydani {
		if JePlatneCislo(v) && !JeSpecial(v) && (prvni == "" || v[:7] < prvni[:7]) {
			prvni = v
		}
	}
	return prvni
}

// CastiVydani rozebere rok, měsíc a edici vydání (bez přípony = US); měsíc 0 u ročníku a speciálu.
func CastiVydani(vydani string) (rok, mesic int, edice string, ok bool) {
	if !hledani.JePlatneVydani(vydani) {
		return 0, 0, "", false
	}
	rok = int(vydani[0]-'0')*1000 + int(vydani[1]-'0')*100 + int(vydani[2]-'0')*10 + int(vydani[3]-'0')
	edice = "US"
	if len(vydani) >= 7 {
		if vydani[5] >= '0' && vydani[5] <= '1' {
			mesic = int(vydani[5]-'0')*10 + int(vydani[6]-'0')
		}
		if vydani[len(vydani)-3] == '-' && vydani[len(vydani)-2] >= 'A' && vydani[len(vydani)-2] <= 'Z' {
			edice = vydani[len(vydani)-2:]
		}
	}
	return rok, mesic, edice, true
}

func rokAMesic(s string) (int, int, bool) {
	if len(s) < 7 || s[4] != '-' {
		return 0, 0, false
	}
	for _, i := range [6]int{0, 1, 2, 3, 5, 6} {
		if s[i] < '0' || s[i] > '9' {
			return 0, 0, false
		}
	}
	r := int(s[0]-'0')*1000 + int(s[1]-'0')*100 + int(s[2]-'0')*10 + int(s[3]-'0')
	m := int(s[5]-'0')*10 + int(s[6]-'0')
	return r, m, true
}

// VekKVydani spočítá věk v celých letech k datu vydání (stejně jako v profilu modelky); 0 = nelze určit.
func VekKVydani(narozeni, vydani string) int {
	nr, nm, ok1 := rokAMesic(narozeni)
	vr, vm, ok2 := rokAMesic(vydani)
	if !ok1 || !ok2 {
		return 0
	}
	vek := vr - nr
	if vm < nm {
		vek--
	}
	if vek <= 0 || vek >= 120 {
		return 0
	}
	return vek
}

// UdajePostavy drží hodnoty údajů postavy jedné modelky; Ma[j] = false u chybějícího údaje
type UdajePostavy struct {
	X  [PocetPriznaku]float64
	Ma [PocetPriznaku]bool
}

// PriznakyModelky vrátí údaje postavy modelky
func PriznakyModelky(m hledani.Modelka) UdajePostavy {
	var u UdajePostavy
	nastavit := func(j int, v float64) {
		if v > 0 {
			u.X[j], u.Ma[j] = v, true
		}
	}
	nastavit(PrVyska, float64(m.VyskaCm))
	nastavit(PrVaha, float64(m.VahaKg))
	nastavit(PrHrudnik, float64(m.ObvodHrudnikCm))
	nastavit(PrPas, float64(m.ObvodPasCm))
	nastavit(PrBoky, float64(m.ObvodBokyCm))
	if m.VyskaCm > 0 && m.VahaKg > 0 {
		metry := float64(m.VyskaCm) / 100
		nastavit(PrBmi, float64(m.VahaKg)/(metry*metry))
	}
	if narozeni := strings.TrimSpace(m.NarozeniDatum); narozeni != "" {
		if prvni := PrvniVydani(m); prvni != "" {
			nastavit(PrVek, float64(VekKVydani(narozeni, prvni)))
		}
	}
	return u
}

// UdajeSbirky vrátí údaje postavy všech modelek (ve stejném pořadí)
func UdajeSbirky(modelky []hledani.Modelka) []UdajePostavy {
	udaje := make([]UdajePostavy, len(modelky))
	for i, m := range modelky {
		udaje[i] = PriznakyModelky(m)
	}
	return udaje
}

// Kvantil spočítá kvantil seřazených hodnot s lineární interpolací (q 0–1)
func Kvantil(serazene []float64, q float64) float64 {
	if len(serazene) == 0 {
		return 0
	}
	poz := q * float64(len(serazene)-1)
	dolni := int(math.Floor(poz))
	horni := int(math.Ceil(poz))
	return serazene[dolni] + (serazene[horni]-serazene[dolni])*(poz-float64(dolni))
}

// KvantilUdaje spočítá kvantil q seřazených hodnot; celá čísla se berou jako rovnoměrně rozložená v intervalu ±0,5.
func KvantilUdaje(s []float64, q float64, celaCisla bool) float64 {
	n := len(s)
	if !celaCisla || n == 0 {
		return Kvantil(s, q)
	}
	cil := q * float64(n)
	for i := 0; i < n; {
		j := i
		for j < n && s[j] == s[i] {
			j++
		}
		if float64(j) >= cil {
			return s[i] - 0.5 + (cil-float64(i))/float64(j-i)
		}
		i = j
	}
	return s[n-1]
}

// Vzdálenost kvartilu od mediánu v σ normálního rozdělení
const KvartilNaSigma = 0.6745

// RobustniOdhad vrátí medián a směrodatnou odchylku pod a nad mediánem z kvartilů.
func RobustniOdhad(hodnoty []float64, celaCisla bool) (med, sOd, sDo float64) {
	s := append([]float64(nil), hodnoty...)
	sort.Float64s(s)
	med = KvantilUdaje(s, 0.5, celaCisla)
	return med, (med - KvantilUdaje(s, 0.25, celaCisla)) / KvartilNaSigma, (KvantilUdaje(s, 0.75, celaCisla) - med) / KvartilNaSigma
}

// InvertovatCholesky invertuje symetrickou pozitivně definitní matici Choleského rozkladem; nil, když není pozitivně definitní.
func InvertovatCholesky(c [][]float64) [][]float64 {
	d := len(c)
	l := make([][]float64, d)
	for i := range d {
		l[i] = make([]float64, d)
		for j := 0; j <= i; j++ {
			s := c[i][j]
			for k := range j {
				s -= l[i][k] * l[j][k]
			}
			if i == j {
				if s <= 1e-12 {
					return nil
				}
				l[i][i] = math.Sqrt(s)
			} else {
				l[i][j] = s / l[j][j]
			}
		}
	}
	inv := make([][]float64, d)
	for i := range d {
		inv[i] = make([]float64, d)
	}
	y := make([]float64, d)
	for sloupec := range d {
		// L·y = e, pak Lᵀ·x = y
		for i := range d {
			s := 0.0
			if i == sloupec {
				s = 1
			}
			for k := range i {
				s -= l[i][k] * y[k]
			}
			y[i] = s / l[i][i]
		}
		for i := d - 1; i >= 0; i-- {
			s := y[i]
			for k := i + 1; k < d; k++ {
				s -= l[k][i] * inv[k][sloupec]
			}
			inv[i][sloupec] = s / l[i][i]
		}
	}
	return inv
}

// Odhady obvodů (regrese i sousedé)
const (
	MinModelekOdhadu = 40 // z méně modelek s údaji se neodhaduje
	PocetSousedu     = 12
	VzorekOvereni    = 400 // ověření sousedů vynecháním jedné na nejvýš tolika modelkách
)

// PrediktoryPostavy jsou údaje, ze kterých se odhaduje obvod (BMI a věk ne: BMI je z výšky a váhy, věk s postavou nesouvisí)
var PrediktoryPostavy = []int{PrVyska, PrVaha, PrHrudnik, PrPas, PrBoky}

// RegreseObvodu představuje lineární regresi obvodu na jiné údaje postavy s robustním vyloučením odlehlých hodnot
// a ověřením vynecháním jedné modelky (leave-one-out).
type RegreseObvodu struct {
	Prediktory     []int
	PrumerX        []float64
	PrumerY        float64
	Beta           []float64
	N              int
	Trefa1, Trefa2 float64
}

func (r *RegreseObvodu) Odhad(x [PocetPriznaku]float64) int {
	return int(math.Round(r.OdhadPresny(x)))
}

func (r *RegreseObvodu) OdhadPresny(x [PocetPriznaku]float64) float64 {
	y := r.PrumerY
	for a, p := range r.Prediktory {
		y += r.Beta[a] * (x[p] - r.PrumerX[a])
	}
	return y
}

// NaucitRegresi naučí regresi údaje cil na údaje v masce (bity indexů); nil, když je modelek málo nebo soustava nejde vyřešit.
func NaucitRegresi(udaje []UdajePostavy, cil, maska int) *RegreseObvodu {
	var prediktory []int
	for p := range PocetPriznaku {
		if maska&(1<<p) != 0 {
			prediktory = append(prediktory, p)
		}
	}
	d := len(prediktory)
	var radky []int
	for i, u := range udaje {
		ok := u.Ma[cil]
		for _, p := range prediktory {
			ok = ok && u.Ma[p]
		}
		if ok {
			radky = append(radky, i)
		}
	}
	if len(radky) < MinModelekOdhadu {
		return nil
	}
	odhadnout := func(vybrane []int) (*RegreseObvodu, [][]float64) {
		r := &RegreseObvodu{Prediktory: prediktory, PrumerX: make([]float64, d), Beta: make([]float64, d), N: len(vybrane)}
		for _, i := range vybrane {
			r.PrumerY += udaje[i].X[cil]
			for a, p := range prediktory {
				r.PrumerX[a] += udaje[i].X[p]
			}
		}
		r.PrumerY /= float64(len(vybrane))
		for a := range prediktory {
			r.PrumerX[a] /= float64(len(vybrane))
		}
		s := make([][]float64, d)
		b := make([]float64, d)
		for a := range s {
			s[a] = make([]float64, d)
		}
		for _, i := range vybrane {
			for a, p := range prediktory {
				xa := udaje[i].X[p] - r.PrumerX[a]
				b[a] += xa * (udaje[i].X[cil] - r.PrumerY)
				for c, q := range prediktory {
					s[a][c] += xa * (udaje[i].X[q] - r.PrumerX[c])
				}
			}
		}
		inv := InvertovatCholesky(s)
		if inv == nil {
			return nil, nil
		}
		for a := range d {
			for c := range d {
				r.Beta[a] += inv[a][c] * b[c]
			}
		}
		return r, inv
	}
	r, _ := odhadnout(radky)
	if r == nil {
		return nil
	}
	rezidua := make([]float64, len(radky))
	absolutni := make([]float64, len(radky))
	for k, i := range radky {
		e := udaje[i].X[cil] - r.OdhadPresny(udaje[i].X)
		rezidua[k] = e
		absolutni[k] = math.Abs(e)
	}
	sort.Float64s(absolutni)
	mez := max(1, 3*1.4826*Kvantil(absolutni, 0.5))
	vnitrni := make([]int, 0, len(radky))
	for k, i := range radky {
		if math.Abs(rezidua[k]) <= mez {
			vnitrni = append(vnitrni, i)
		}
	}
	if len(vnitrni) < MinModelekOdhadu {
		return nil
	}
	r, inv := odhadnout(vnitrni)
	if r == nil {
		return nil
	}
	trefa1, trefa2 := 0, 0
	zakladH := 1 / float64(len(vnitrni))
	for k, i := range radky {
		y := udaje[i].X[cil]
		odhad := r.OdhadPresny(udaje[i].X)
		if math.Abs(rezidua[k]) <= mez {
			// Odhad bez modelky samé: y − e/(1 − h), h = 1/n + x̃ᵀ(X̃ᵀX̃)⁻¹x̃
			h := zakladH
			for a, p := range prediktory {
				xa := udaje[i].X[p] - r.PrumerX[a]
				for c, q := range prediktory {
					h += xa * inv[a][c] * (udaje[i].X[q] - r.PrumerX[c])
				}
			}
			if h < 1 {
				odhad = y - (y-odhad)/(1-h)
			}
		}
		chyba := math.Abs(y - math.Round(odhad))
		if chyba <= 1 {
			trefa1++
		}
		if chyba <= 2 {
			trefa2++
		}
	}
	r.Trefa1, r.Trefa2 = float64(trefa1)/float64(len(radky)), float64(trefa2)/float64(len(radky))
	r.N = len(radky)
	return r
}

// SousedePostavy odhaduje obvod pomocí k nejbližších sousedů (modelek sbírky s nejpodobnější postavou).
type SousedePostavy struct {
	Cil          int
	Stred, Sigma [PocetPriznaku]float64
	Radky        []int // modelky s cílovým údajem a aspoň dvěma prediktory
	Z            [][PocetPriznaku]float64
	Maska        []uint8
	Udaje        []UdajePostavy
	Overeni      map[uint8]*OvereniSousedu
}

// OvereniSousedu drží ověření sousedů pro jednu masku známých údajů; nil = málo modelek k ověření
type OvereniSousedu struct {
	N                int
	Trefa1, Trefa2   float64
	TypickaNejistota float64
}

func NaucitSousedy(udaje []UdajePostavy, cil int) *SousedePostavy {
	s := &SousedePostavy{Cil: cil, Udaje: udaje, Overeni: map[uint8]*OvereniSousedu{}}
	for _, j := range PrediktoryPostavy {
		if j == cil {
			continue
		}
		var hodnoty []float64
		for _, u := range udaje {
			if u.Ma[j] {
				hodnoty = append(hodnoty, u.X[j])
			}
		}
		if len(hodnoty) < MinModelekOdhadu {
			continue
		}
		med, sOd, sDo := RobustniOdhad(hodnoty, true)
		s.Stred[j], s.Sigma[j] = med, max((sOd+sDo)/2, Priznaky[j].MinSigma)
	}
	s.Z = make([][PocetPriznaku]float64, len(udaje))
	s.Maska = make([]uint8, len(udaje))
	for i, u := range udaje {
		s.Z[i], s.Maska[i] = s.Standardizovat(u)
		if u.Ma[cil] && bits.OnesCount8(s.Maska[i]) >= 2 {
			s.Radky = append(s.Radky, i)
		}
	}
	if len(s.Radky) < MinModelekOdhadu {
		return nil
	}
	return s
}

// Overit vrátí ověření pro masku (s mezipamětí)
func (s *SousedePostavy) Overit(maska uint8) *OvereniSousedu {
	if o, ok := s.Overeni[maska]; ok {
		return o
	}
	var vzorek []int
	for _, i := range s.Radky {
		if s.Maska[i]&maska == maska {
			vzorek = append(vzorek, i)
		}
	}
	var o *OvereniSousedu
	if len(vzorek) >= MinModelekOdhadu {
		krok := max(1, len(vzorek)/VzorekOvereni)
		trefa1, trefa2, overeno := 0, 0, 0
		var nejistoty []float64
		for k := 0; k < len(vzorek); k += krok {
			i := vzorek[k]
			odhad, nejistota, ok := s.OdhadZ(s.Z[i], maska, i)
			if !ok {
				continue
			}
			overeno++
			chyba := math.Abs(s.Udaje[i].X[s.Cil] - math.Round(odhad))
			if chyba <= 1 {
				trefa1++
			}
			if chyba <= 2 {
				trefa2++
			}
			nejistoty = append(nejistoty, nejistota)
		}
		if overeno >= MinModelekOdhadu/2 {
			sort.Float64s(nejistoty)
			o = &OvereniSousedu{N: len(vzorek), Trefa1: float64(trefa1) / float64(overeno), Trefa2: float64(trefa2) / float64(overeno),
				TypickaNejistota: max(0.5, Kvantil(nejistoty, 0.5))}
		}
	}
	s.Overeni[maska] = o
	return o
}

// Standardizovat vrátí standardizované prediktory a masku těch, které modelka má (cílový údaj se nepočítá)
func (s *SousedePostavy) Standardizovat(u UdajePostavy) (z [PocetPriznaku]float64, maska uint8) {
	for _, j := range PrediktoryPostavy {
		if j != s.Cil && u.Ma[j] && s.Sigma[j] > 0 {
			z[j] = (u.X[j] - s.Stred[j]) / s.Sigma[j]
			maska |= 1 << j
		}
	}
	return z, maska
}

// Odhad vrátí odhad pro modelku s údaji u a ověření pro její masku údajů; ok = false, když odhadnout nejde
func (s *SousedePostavy) Odhad(u UdajePostavy) (hodnota, nejistota float64, o *OvereniSousedu, ok bool) {
	z, maska := s.Standardizovat(u)
	if bits.OnesCount8(maska) < 2 {
		return 0, 0, nil, false
	}
	if o = s.Overit(maska); o == nil {
		return 0, 0, nil, false
	}
	hodnota, nejistota, ok = s.OdhadZ(z, maska, -1)
	return hodnota, nejistota, o, ok
}

// OdhadZ vrátí odhad z údajů masky (bez modelky s indexem krome; −1 = nikoho nevynechat)
func (s *SousedePostavy) OdhadZ(z [PocetPriznaku]float64, maska uint8, krome int) (hodnota, nejistota float64, ok bool) {
	type soused struct{ d, y, w float64 }
	var nejblizsi [PocetSousedu]soused
	pocet := 0
	for _, i := range s.Radky {
		if i == krome {
			continue
		}
		spolecne := maska & s.Maska[i]
		k := bits.OnesCount8(spolecne)
		if k < 2 {
			continue
		}
		zi := &s.Z[i]
		d := 0.0
		for j := range PrBoky + 1 { // výška až boky (PrediktoryPostavy)
			if spolecne&(1<<j) != 0 {
				r := z[j] - zi[j]
				d += r * r
			}
		}
		d /= float64(k)
		if pocet == PocetSousedu && d >= nejblizsi[pocet-1].d {
			continue
		}
		// Zařazení do seřazeného seznamu nejbližších (vkládáním; sousedů je jen pár)
		if pocet < PocetSousedu {
			pocet++
		}
		m := pocet - 1
		for m > 0 && nejblizsi[m-1].d > d {
			nejblizsi[m] = nejblizsi[m-1]
			m--
		}
		nejblizsi[m] = soused{d: d, y: s.Udaje[i].X[s.Cil]}
	}
	if pocet < PocetSousedu {
		return 0, 0, false
	}
	// Seřazení na místě podle hodnoty y (insertion sort na poli velikosti 12 na zásobníku – nula alokací)
	for i := 0; i < pocet; i++ {
		nejblizsi[i].w = 1 / (0.25 + math.Sqrt(nejblizsi[i].d))
	}
	for i := 1; i < pocet; i++ {
		v := nejblizsi[i]
		j := i
		for j > 0 && nejblizsi[j-1].y > v.y {
			nejblizsi[j] = nejblizsi[j-1]
			j--
		}
		nejblizsi[j] = v
	}
	celkem, soucet, soucet2 := 0.0, 0.0, 0.0
	for i := 0; i < pocet; i++ {
		v := nejblizsi[i]
		celkem += v.w
		soucet += v.w * v.y
		soucet2 += v.w * v.y * v.y
	}
	// Vážený medián
	polovina, kumul := celkem/2, 0.0
	for i := 0; i < pocet; i++ {
		kumul += nejblizsi[i].w
		if kumul >= polovina {
			hodnota = nejblizsi[i].y
			break
		}
	}
	prumer := soucet / celkem
	nejistota = math.Sqrt(max(0, soucet2/celkem-prumer*prumer))
	return hodnota, nejistota, true
}

func Abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
