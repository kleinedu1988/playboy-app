package main

import (
	"math"
	"math/bits"
	"sort"
	"strconv"
	"strings"
)

// Sdílené statistické nástroje strojového učení (celkový popis v docs/UCENI.md). Používají je návrhy doplnění
// (navrhy.go) i kontrola sbírky (kontrola.go, kontrola_uceni.go). Nic z toho nečte databázi ani nemá stav:
// stejné údaje dají vždy stejný výsledek.
//
//   - Texty: klíč textu pro porovnání, Jaro–Winklerova podobnost, naučené sjednocení zápisů hodnot.
//   - Pravděpodobnosti: podíl úspěchů s předpokladem (Beta/Laplace), log-šance a spojení více zdrojů.
//   - Četnosti hodnot při podmínce.
//   - Profil postavy: údaje (výška, váha, obvody, BMI, věk), robustní odhad středu a rozptylu, lineární
//     regrese s ověřením vynecháním jedné modelky a odhad k nejbližšími sousedy.

// ---------------------------------------------------------------------------------------------------------
// Texty

// Klíč textu pro porovnání: malá písmena bez diakritiky, bez teček, jedna mezera („U.S.A.“ = „usa“)
func klicTextu(s string) string {
	z := zjednodusit(s)
	if uzJeKlicem(z) {
		return z
	}
	return strings.Join(strings.Fields(strings.ReplaceAll(z, ".", "")), " ")
}

// Text, který úprava na klíč nezmění: jen ASCII bez teček, mezery jednoduché a ne na krajích (běžné hodnoty
// údajů; klíč se počítá u každého návrhu a hodnoty)
func uzJeKlicem(z string) bool {
	for i := 0; i < len(z); i++ {
		switch c := z[i]; {
		case c >= 0x80 || c == '.' || c == '\t' || c == '\n' || c == '\v' || c == '\f' || c == '\r':
			return false
		case c == ' ' && (i == 0 || i == len(z)-1 || z[i-1] == ' '):
			return false
		}
	}
	return true
}

// Jaro–Winklerova podobnost dvou textů (0–1): shodné znaky v okně, přehozené znaky a bonus za společný začátek
func jaroWinkler(s1, s2 string) float64 { return jaroWinklerZnaku([]rune(s1), []rune(s2)) }

// Jaro–Winkler nad znaky; pomocná pole jsou u krátkých textů na zásobníku (porovnávají se tisíce dvojic)
func jaroWinklerZnaku(a, b []rune) float64 {
	if len(a) == 0 || len(b) == 0 {
		if len(a) == len(b) {
			return 1
		}
		return 0
	}
	okno := max(0, max(len(a), len(b))/2-1)
	var poleA, poleB [64]bool
	shodaA, shodaB := poleA[:], poleB[:]
	if len(a) > len(poleA) || len(b) > len(poleB) {
		shodaA, shodaB = make([]bool, len(a)), make([]bool, len(b))
	}
	shod := 0
	for i := range a {
		for j := max(0, i-okno); j < min(len(b), i+okno+1); j++ {
			if !shodaB[j] && a[i] == b[j] {
				shodaA[i], shodaB[j] = true, true
				shod++
				break
			}
		}
	}
	if shod == 0 {
		return 0
	}
	prehozenych, k := 0, 0
	for i := range a {
		if !shodaA[i] {
			continue
		}
		for !shodaB[k] {
			k++
		}
		if a[i] != b[k] {
			prehozenych++
		}
		k++
	}
	m := float64(shod)
	jaro := (m/float64(len(a)) + m/float64(len(b)) + (m-float64(prehozenych)/2)/m) / 3
	zacatek := 0
	for zacatek < min(4, len(a), len(b)) && a[zacatek] == b[zacatek] {
		zacatek++
	}
	return jaro + float64(zacatek)*0.1*(1-jaro)
}

// Naučené sjednocení zápisů
const (
	prahSlouceni     = 0.94 // Jaro–Winkler varianty a převládajícího tvaru
	nasobekPrevahy   = 3    // převládající tvar je aspoň tolikrát častější než varianta
	minDelkaSlouceni = 5    // kratší klíče se nesjednocují (u krátkých slov je podobnost náhodná)
)

// Zápisy hodnot jednoho údaje ve sbírce. Klíč je zjednodušený text (klicTextu) nebo jiný klíč (národnost podle
// tabulky zemí „z:…“); ke klíči se počítá, jak často se jak píše. naucit() navíc sloučí vzácnou variantu
// s překlepem do převládajícího tvaru („phillipines“ 1× → „philippines“ 12×): podobnost aspoň prahSlouceni,
// převaha aspoň nasobekPrevahy a jediný takový kandidát. Návrh tak píše hodnotu tak, jak ji píše uživatel,
// a varianty s překlepem se v četnostech počítají k převládajícímu tvaru. Zápis, na který uživatel návrh
// opravil (jen jiný tvar téže hodnoty, viz uceni.go), má přednost před nejčastějším.
type slovnikHodnot struct {
	pocty       map[string]map[string]int // klíč → zápis → počet
	kanon       map[string]string         // varianta → převládající klíč (po naucit)
	preferovane map[string]string         // klíč → zápis z oprav uživatele
}

func novySlovnik() *slovnikHodnot {
	return &slovnikHodnot{pocty: map[string]map[string]int{}, kanon: map[string]string{}}
}

func (s *slovnikHodnot) pridat(klic, zapis string) {
	if s.pocty[klic] == nil {
		s.pocty[klic] = map[string]int{}
	}
	s.pocty[klic][zapis]++
}

func (s *slovnikHodnot) celkem(klic string) int {
	n := 0
	for _, p := range s.pocty[klic] {
		n += p
	}
	return n
}

// Sloučení variant s překlepem; volá se jednou po přidání všech zápisů
func (s *slovnikHodnot) naucit() {
	klice := make([]string, 0, len(s.pocty))
	pocet := map[string]int{}
	for k := range s.pocty {
		if !strings.HasPrefix(k, "z:") && len([]rune(k)) >= minDelkaSlouceni {
			klice = append(klice, k)
			pocet[k] = s.celkem(k)
		}
	}
	sort.Slice(klice, func(i, j int) bool {
		if pocet[klice[i]] != pocet[klice[j]] {
			return pocet[klice[i]] > pocet[klice[j]]
		}
		return klice[i] < klice[j]
	})
	znaky := make([][]rune, len(klice))
	for i, k := range klice {
		znaky[i] = []rune(k)
	}
	for i, varianta := range klice {
		cil, kandidatu := "", 0
		for j := 0; j < i; j++ {
			if pocet[klice[j]] < nasobekPrevahy*max(1, pocet[varianta]) {
				break // seřazené sestupně: dál jsou jen méně časté
			}
			if jaroWinklerZnaku(znaky[i], znaky[j]) >= prahSlouceni {
				cil = klice[j]
				kandidatu++
			}
		}
		if kandidatu == 1 {
			s.kanon[varianta] = cil
		}
	}
	// Řetězec variant (a → b → c) vede rovnou k poslednímu tvaru; počty zápisů se přičtou k němu
	for varianta := range s.kanon {
		cil := s.kanon[varianta]
		for kroku := 0; kroku < 8; kroku++ {
			dalsi, ok := s.kanon[cil]
			if !ok {
				break
			}
			cil = dalsi
		}
		s.kanon[varianta] = cil
	}
	for varianta, cil := range s.kanon {
		for z, n := range s.pocty[varianta] {
			s.pridatPocet(cil, z, n)
		}
	}
}

func (s *slovnikHodnot) pridatPocet(klic, zapis string, n int) {
	if s.pocty[klic] == nil {
		s.pocty[klic] = map[string]int{}
	}
	s.pocty[klic][zapis] += n
}

// Klíč po sjednocení variant
func (s *slovnikHodnot) klic(k string) string {
	if c, ok := s.kanon[k]; ok {
		return c
	}
	return k
}

// Zápis hodnoty: oprava uživatele, jinak nejčastější zápis sbírky; "" když hodnotu sbírka nezná
func (s *slovnikHodnot) zapis(klic string) string {
	klic = s.klic(klic)
	if z, ok := s.preferovane[klic]; ok && z != "" {
		return z
	}
	nejlepsi, pocet := "", 0
	for z, n := range s.pocty[klic] {
		if n > pocet || n == pocet && z < nejlepsi {
			nejlepsi, pocet = z, n
		}
	}
	return nejlepsi
}

// ---------------------------------------------------------------------------------------------------------
// Pravděpodobnosti

// Podíl úspěchů s předpokladem: (k + p·w)/(n + w) – střední hodnota Beta rozdělení po k úspěších z n pokusů
// s předchozím Beta(p·w, (1−p)·w); p = předpoklad bez dat, w = jeho váha v pseudo-pozorováních.
// p = 0,5 a w = 2 je Laplaceovo pravidlo (k + 1)/(n + 2).
func podilSPredpokladem(k, n int, p, w float64) float64 {
	return (float64(k) + p*w) / (float64(n) + w)
}

// Log-šance a zpět; pravděpodobnost se omezí na (0,001; 0,999), aby jistota nikdy nebyla nekonečná
func logit(p float64) float64 {
	p = min(0.999, max(0.001, p))
	return math.Log(p / (1 - p))
}

func zLogitu(x float64) float64 { return 1 / (1 + math.Exp(-x)) }

// Tlumení závislosti zdrojů při spojení (1 = čistý naivní Bayes)
const tlumeniZavislosti = 0.5

// Spojení pravděpodobností téže hodnoty z více nezávislých zdrojů (naivní Bayes v log-šancích):
//
//	logit q = logit p₁ + Σ_{i≥2} ρ·(logit pᵢ − logit π)
//
// p₁ je nejsilnější zdroj, π předpoklad hodnoty bez jakéhokoli zdroje (její podíl ve sbírce). Každý další zdroj
// přidá svůj „důkaz“ – o kolik je hodnota pravděpodobnější, než by byla bez něj. ρ < 1 tlumí to, že zdroje
// nebývají úplně nezávislé (místo narození a edice čísel souvisí přes zemi). Jediný zdroj dá q = p₁; zdroj, který
// hodnotě věří méně než π, jistotu sníží.
func spojitZdroje(p []float64, predpoklad, rho float64) float64 {
	if len(p) == 0 {
		return 0
	}
	serazene := append([]float64(nil), p...)
	sort.Sort(sort.Reverse(sort.Float64Slice(serazene)))
	x := logit(serazene[0])
	for _, pi := range serazene[1:] {
		x += rho * (logit(pi) - logit(predpoklad))
	}
	return zLogitu(x)
}

// Úspěšnost pravidla na sbírce: kolikrát by u údajů, které už vyplněné jsou, trefilo
type uspesnost struct{ k, n int }

func (u *uspesnost) zapocitat(shoda bool) {
	u.n++
	if shoda {
		u.k++
	}
}

func (u uspesnost) jistota(predpoklad, vaha float64) float64 {
	return podilSPredpokladem(u.k, u.n, predpoklad, vaha)
}

// Text úspěšnosti do důvodu
func (u uspesnost) text(co string) string {
	if u.n == 0 {
		return ""
	}
	return "; ve sbírce sedí u " + strconv.Itoa(u.k) + " z " + strconv.Itoa(u.n) + " " + co
}

// ---------------------------------------------------------------------------------------------------------
// Četnosti hodnot při podmínce

type cetnosti map[string]map[string]int

func (c cetnosti) pridat(podminka, hodnota string) {
	if c[podminka] == nil {
		c[podminka] = map[string]int{}
	}
	c[podminka][hodnota]++
}

// Nejčastější hodnota při podmínce, její počet a počet všech
func (c cetnosti) nejcastejsi(podminka string) (hodnota string, k, n int) {
	for h, p := range c[podminka] {
		n += p
		if p > k || p == k && h < hodnota {
			hodnota, k = h, p
		}
	}
	return hodnota, k, n
}

// ---------------------------------------------------------------------------------------------------------
// Profil postavy

// Údaje postavy, ze kterých se kontrola i návrhy učí (pořadí = index v polích)
const (
	prVyska = iota
	prVaha
	prHrudnik
	prPas
	prBoky
	prBmi
	prVek
	pocetPriznaku
)

// Popis údaje postavy pro učení a pro text nálezu
type priznak struct {
	nazev, pri, jednotka string // „výška“, „při výšce“, „cm“
	pole                 string // pole formuláře, kde se údaj opraví
	klic                 string // nález, jehož „V pořádku“ potvrzuje hodnotu jako běžnou
	od, do               float64
	mezOd, mezDo         float64 // rozumné meze: naučený rozsah za ně nikdy nesahá
	minPul               float64 // naučený rozsah sahá od mediánu aspoň o tolik na každou stranu
	minSigma             float64 // nejmenší směrodatná odchylka (celá čísla mívají MAD nulovou)
	krok                 float64 // největší mezera mezi potvrzenými hodnotami, přes kterou se hranice posune
	desetiny             bool    // zobrazuje se s jedním desetinným místem (BMI)
}

// Údaje postavy: pevné meze z kontrola.go, rozumné meze a minimální šířky naučeného rozsahu.
// Dolní mez věku zůstává 18 let (mladší playmate stojí za kontrolu vždy); posunout ji může jen uživatel svým „V pořádku“.
var priznaky = [pocetPriznaku]priznak{
	prVyska: {nazev: "výška", pri: "při výšce", jednotka: "cm", pole: "inputVyska", klic: "ok-vyska",
		od: vyskaOd, do: vyskaDo, mezOd: 135, mezDo: 205, minPul: 15, minSigma: 2, krok: 3},
	prVaha: {nazev: "váha", pri: "při váze", jednotka: "kg", pole: "inputVaha", klic: "ok-vaha",
		od: vahaOd, do: vahaDo, mezOd: 32, mezDo: 120, minPul: 12, minSigma: 2, krok: 3},
	prHrudnik: {nazev: "hrudník", pri: "při hrudníku", jednotka: "cm", pole: "inputHrudnik", klic: "ok-miry",
		od: hrudnikOd, do: hrudnikDo, mezOd: 60, mezDo: 150, minPul: 12, minSigma: 1.5, krok: 3},
	prPas: {nazev: "pas", pri: "při pasu", jednotka: "cm", pole: "inputPas", klic: "ok-miry",
		od: pasOd, do: pasDo, mezOd: 40, mezDo: 110, minPul: 8, minSigma: 1.5, krok: 3},
	prBoky: {nazev: "boky", pri: "při bocích", jednotka: "cm", pole: "inputBoky", klic: "ok-miry",
		od: bokyOd, do: bokyDo, mezOd: 60, mezDo: 150, minPul: 10, minSigma: 1.5, krok: 3},
	prBmi: {nazev: "BMI", pri: "při BMI", pole: "inputVaha", klic: "ok-bmi",
		od: bmiOd, do: bmiDo, mezOd: 13, mezDo: 35, minPul: 3, minSigma: 0.4, krok: 1, desetiny: true},
	prVek: {nazev: "věk při prvním vydání", pri: "při věku", jednotka: "let", pole: "inputNarozeniDatum", klic: "ok-vek",
		od: vekOd, do: vekDo, mezOd: vekOd, mezDo: 60, minPul: 8, minSigma: 1, krok: 1},
}

// Číslo údaje k zobrazení (BMI s desetinnou čárkou)
func (p priznak) cislo(x float64) string {
	if p.desetiny {
		return strings.Replace(strconv.FormatFloat(x, 'f', 1, 64), ".", ",", 1)
	}
	return strconv.Itoa(int(math.Round(x)))
}

// „pas 80 cm“, „BMI 17,1“
func (p priznak) hodnota(x float64) string {
	if p.jednotka == "" {
		return p.cislo(x)
	}
	return p.cislo(x) + " " + p.jednotka
}

// Hodnoty údajů postavy jedné modelky; ma[j] = false u chybějícího údaje
type udajePostavy struct {
	x  [pocetPriznaku]float64
	ma [pocetPriznaku]bool
}

// Údaje postavy modelky
func priznakyModelky(m Modelka) udajePostavy {
	var u udajePostavy
	nastavit := func(j int, v float64) {
		if v > 0 {
			u.x[j], u.ma[j] = v, true
		}
	}
	nastavit(prVyska, float64(m.VyskaCm))
	nastavit(prVaha, float64(m.VahaKg))
	nastavit(prHrudnik, float64(m.ObvodHrudnikCm))
	nastavit(prPas, float64(m.ObvodPasCm))
	nastavit(prBoky, float64(m.ObvodBokyCm))
	if m.VyskaCm > 0 && m.VahaKg > 0 {
		metry := float64(m.VyskaCm) / 100
		nastavit(prBmi, float64(m.VahaKg)/(metry*metry))
	}
	if narozeni := strings.TrimSpace(m.NarozeniDatum); narozeni != "" {
		if prvni := prvniVydani(m); prvni != "" {
			nastavit(prVek, float64(vekKVydani(narozeni, prvni)))
		}
	}
	return u
}

// Údaje postavy všech modelek (ve stejném pořadí)
func udajeSbirky(modelky []Modelka) []udajePostavy {
	udaje := make([]udajePostavy, len(modelky))
	for i, m := range modelky {
		udaje[i] = priznakyModelky(m)
	}
	return udaje
}

// Kvantil q seřazených hodnot; celá čísla se berou jako rovnoměrně rozložená v intervalu ±0,5 (údaj 60 cm znamená
// 59,5–60,5 cm), jinak by u úzce rozložených údajů (pas) vycházel rozptyl skokově 0, 1 nebo 2 cm.
// Desetinná čísla (BMI) běžným kvantilem s interpolací (vyvoj.go).
func kvantilUdaje(s []float64, q float64, celaCisla bool) float64 {
	n := len(s)
	if !celaCisla || n == 0 {
		return kvantil(s, q)
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
const kvartilNaSigma = 0.6745

// Robustní odhad středu a rozptylu: medián a zvlášť směrodatná odchylka pod a nad mediánem z kvartilů
// ((Q2−Q1)/0,6745 a (Q3−Q2)/0,6745; u normálního rozdělení obě rovny σ, stejně jako MAD × 1,4826). Odděleně proto,
// aby šikmý údaj (váha mívá delší horní chvost) neměl zbytečně úzkou horní mez. Odlehlé hodnoty (překlepy)
// odhad skoro neovlivní.
func robustniOdhad(hodnoty []float64, celaCisla bool) (med, sOd, sDo float64) {
	s := append([]float64(nil), hodnoty...)
	sort.Float64s(s)
	med = kvantilUdaje(s, 0.5, celaCisla)
	return med, (med - kvantilUdaje(s, 0.25, celaCisla)) / kvartilNaSigma, (kvantilUdaje(s, 0.75, celaCisla) - med) / kvartilNaSigma
}

// Inverze symetrické pozitivně definitní matice Choleského rozkladem; nil, když matice není pozitivně definitní
func invertovatCholesky(c [][]float64) [][]float64 {
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
	minModelekOdhadu = 40 // z méně modelek s údaji se neodhaduje
	pocetSousedu     = 12
	vzorekOvereni    = 400 // ověření sousedů vynecháním jedné na nejvýš tolika modelkách
)

// Údaje, ze kterých se odhaduje obvod (BMI a věk ne: BMI je z výšky a váhy, věk s postavou nesouvisí)
var prediktoryPostavy = []int{prVyska, prVaha, prHrudnik, prPas, prBoky}

// Lineární regrese obvodu na jiné údaje postavy. Robustní: po prvním odhadu se vynechají modelky s reziduem
// nad 3 robustní σ (překlepy) a odhad se zopakuje. Úspěšnost se měří poctivě vynecháním jedné modelky
// (leave-one-out přes diagonálu projekční matice): podíl modelek, u nichž by zaokrouhlený odhad bez nich samých
// trefil skutečnou hodnotu do ±1 a do ±2 cm.
type regreseObvodu struct {
	prediktory     []int
	prumerX        []float64
	prumerY        float64
	beta           []float64
	n              int
	trefa1, trefa2 float64
}

func (r *regreseObvodu) odhad(x [pocetPriznaku]float64) int {
	return int(math.Round(r.odhadPresny(x)))
}

func (r *regreseObvodu) odhadPresny(x [pocetPriznaku]float64) float64 {
	y := r.prumerY
	for a, p := range r.prediktory {
		y += r.beta[a] * (x[p] - r.prumerX[a])
	}
	return y
}

// Regrese údaje cil na údaje v masce (bity indexů); nil, když je modelek málo nebo soustava nejde vyřešit
func naucitRegresi(udaje []udajePostavy, cil, maska int) *regreseObvodu {
	var prediktory []int
	for p := range pocetPriznaku {
		if maska&(1<<p) != 0 {
			prediktory = append(prediktory, p)
		}
	}
	d := len(prediktory)
	var radky []int
	for i, u := range udaje {
		ok := u.ma[cil]
		for _, p := range prediktory {
			ok = ok && u.ma[p]
		}
		if ok {
			radky = append(radky, i)
		}
	}
	if len(radky) < minModelekOdhadu {
		return nil
	}
	odhadnout := func(vybrane []int) (*regreseObvodu, [][]float64) {
		r := &regreseObvodu{prediktory: prediktory, prumerX: make([]float64, d), beta: make([]float64, d), n: len(vybrane)}
		for _, i := range vybrane {
			r.prumerY += udaje[i].x[cil]
			for a, p := range prediktory {
				r.prumerX[a] += udaje[i].x[p]
			}
		}
		r.prumerY /= float64(len(vybrane))
		for a := range prediktory {
			r.prumerX[a] /= float64(len(vybrane))
		}
		s := make([][]float64, d)
		b := make([]float64, d)
		for a := range s {
			s[a] = make([]float64, d)
		}
		for _, i := range vybrane {
			for a, p := range prediktory {
				xa := udaje[i].x[p] - r.prumerX[a]
				b[a] += xa * (udaje[i].x[cil] - r.prumerY)
				for c, q := range prediktory {
					s[a][c] += xa * (udaje[i].x[q] - r.prumerX[c])
				}
			}
		}
		inv := invertovatCholesky(s)
		if inv == nil {
			return nil, nil
		}
		for a := range d {
			for c := range d {
				r.beta[a] += inv[a][c] * b[c]
			}
		}
		return r, inv
	}
	r, _ := odhadnout(radky)
	if r == nil {
		return nil
	}
	rezidua := make([]float64, len(radky))
	for k, i := range radky {
		rezidua[k] = udaje[i].x[cil] - r.odhadPresny(udaje[i].x)
	}
	absolutni := make([]float64, len(rezidua))
	for k, e := range rezidua {
		absolutni[k] = math.Abs(e)
	}
	sort.Float64s(absolutni)
	mez := max(1, 3*1.4826*kvantil(absolutni, 0.5))
	var vnitrni []int
	vnejsi := map[int]bool{}
	for k, i := range radky {
		if math.Abs(rezidua[k]) <= mez {
			vnitrni = append(vnitrni, i)
		} else {
			vnejsi[i] = true
		}
	}
	if len(vnitrni) < minModelekOdhadu {
		return nil
	}
	r, inv := odhadnout(vnitrni)
	if r == nil {
		return nil
	}
	trefa1, trefa2 := 0, 0
	for _, i := range radky {
		y := udaje[i].x[cil]
		odhad := r.odhadPresny(udaje[i].x)
		if !vnejsi[i] {
			// Odhad bez modelky samé: y − e/(1 − h), h = 1/n + x̃ᵀ(X̃ᵀX̃)⁻¹x̃
			h := 1 / float64(len(vnitrni))
			for a, p := range prediktory {
				for c, q := range prediktory {
					h += (udaje[i].x[p] - r.prumerX[a]) * inv[a][c] * (udaje[i].x[q] - r.prumerX[c])
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
	r.trefa1, r.trefa2 = float64(trefa1)/float64(len(radky)), float64(trefa2)/float64(len(radky))
	r.n = len(radky)
	return r
}

// Odhad obvodu k nejbližšími sousedy: modelky sbírky s nejpodobnější postavou. Vzdálenost je průměr čtverců
// rozdílů standardizovaných údajů (medián a robustní σ jako u kontroly) přes údaje, které má hledaná modelka
// (aspoň dva) a soused také (aspoň dva společné). Na rozdíl od regrese nepředpokládá přímkovou závislost a sama
// ukáže nejistotu: odhad je vážený medián hodnot sousedů (váha 1/(0,25 + d), bližší soused víc), nejistota
// jejich vážená směrodatná odchylka.
//
// Úspěšnost se ověřuje zvlášť pro každou kombinaci známých údajů (masku), stejně jako u regrese: z výšky a váhy
// se pas odhaduje hůř než z boků. Ověří se vynecháním jedné modelky na rovnoměrném vzorku modelek, které cílový
// údaj i všechny údaje masky mají, a odhadují se jen z údajů masky. typickaNejistota je medián nejistoty na
// tomtéž vzorku – odhad s větší nejistotou má úměrně menší jistotu.
type sousedePostavy struct {
	cil          int
	stred, sigma [pocetPriznaku]float64
	radky        []int // modelky s cílovým údajem a aspoň dvěma prediktory
	z            [][pocetPriznaku]float64
	maska        []uint8
	udaje        []udajePostavy
	overeni      map[uint8]*overeniSousedu
}

// Ověření sousedů pro jednu masku známých údajů; nil = málo modelek k ověření
type overeniSousedu struct {
	n                int
	trefa1, trefa2   float64
	typickaNejistota float64
}

func naucitSousedy(udaje []udajePostavy, cil int) *sousedePostavy {
	s := &sousedePostavy{cil: cil, udaje: udaje, overeni: map[uint8]*overeniSousedu{}}
	for _, j := range prediktoryPostavy {
		if j == cil {
			continue
		}
		var hodnoty []float64
		for _, u := range udaje {
			if u.ma[j] {
				hodnoty = append(hodnoty, u.x[j])
			}
		}
		if len(hodnoty) < minModelekOdhadu {
			continue
		}
		med, sOd, sDo := robustniOdhad(hodnoty, true)
		s.stred[j], s.sigma[j] = med, max((sOd+sDo)/2, priznaky[j].minSigma)
	}
	s.z = make([][pocetPriznaku]float64, len(udaje))
	s.maska = make([]uint8, len(udaje))
	for i, u := range udaje {
		s.z[i], s.maska[i] = s.standardizovat(u)
		if u.ma[cil] && bitu(int(s.maska[i])) >= 2 {
			s.radky = append(s.radky, i)
		}
	}
	if len(s.radky) < minModelekOdhadu {
		return nil
	}
	return s
}

// Ověření pro masku (s mezipamětí)
func (s *sousedePostavy) overit(maska uint8) *overeniSousedu {
	if o, ok := s.overeni[maska]; ok {
		return o
	}
	var vzorek []int
	for _, i := range s.radky {
		if s.maska[i]&maska == maska {
			vzorek = append(vzorek, i)
		}
	}
	var o *overeniSousedu
	if len(vzorek) >= minModelekOdhadu {
		krok := max(1, len(vzorek)/vzorekOvereni)
		trefa1, trefa2, overeno := 0, 0, 0
		var nejistoty []float64
		for k := 0; k < len(vzorek); k += krok {
			i := vzorek[k]
			odhad, nejistota, ok := s.odhadZ(s.z[i], maska, i)
			if !ok {
				continue
			}
			overeno++
			chyba := math.Abs(s.udaje[i].x[s.cil] - math.Round(odhad))
			if chyba <= 1 {
				trefa1++
			}
			if chyba <= 2 {
				trefa2++
			}
			nejistoty = append(nejistoty, nejistota)
		}
		if overeno >= minModelekOdhadu/2 {
			sort.Float64s(nejistoty)
			o = &overeniSousedu{n: len(vzorek), trefa1: float64(trefa1) / float64(overeno), trefa2: float64(trefa2) / float64(overeno),
				typickaNejistota: max(0.5, kvantil(nejistoty, 0.5))}
		}
	}
	s.overeni[maska] = o
	return o
}

// Standardizované prediktory a maska těch, které modelka má (cílový údaj se nepočítá)
func (s *sousedePostavy) standardizovat(u udajePostavy) (z [pocetPriznaku]float64, maska uint8) {
	for _, j := range prediktoryPostavy {
		if j != s.cil && u.ma[j] && s.sigma[j] > 0 {
			z[j] = (u.x[j] - s.stred[j]) / s.sigma[j]
			maska |= 1 << j
		}
	}
	return z, maska
}

// Odhad pro modelku s údaji u a ověření pro její masku údajů; ok = false, když odhadnout nejde
func (s *sousedePostavy) odhad(u udajePostavy) (hodnota, nejistota float64, o *overeniSousedu, ok bool) {
	z, maska := s.standardizovat(u)
	if bitu(int(maska)) < 2 {
		return 0, 0, nil, false
	}
	if o = s.overit(maska); o == nil {
		return 0, 0, nil, false
	}
	hodnota, nejistota, ok = s.odhadZ(z, maska, -1)
	return hodnota, nejistota, o, ok
}

// Odhad z údajů masky (bez modelky s indexem krome; −1 = nikoho nevynechat)
func (s *sousedePostavy) odhadZ(z [pocetPriznaku]float64, maska uint8, krome int) (hodnota, nejistota float64, ok bool) {
	type soused struct{ d, y float64 }
	var nejblizsi [pocetSousedu]soused
	pocet := 0
	for _, i := range s.radky {
		if i == krome {
			continue
		}
		spolecne := maska & s.maska[i]
		k := bits.OnesCount8(spolecne)
		if k < 2 {
			continue
		}
		zi := &s.z[i]
		d := 0.0
		for j := range prBoky + 1 { // výška až boky (prediktoryPostavy)
			if spolecne&(1<<j) != 0 {
				r := z[j] - zi[j]
				d += r * r
			}
		}
		d /= float64(k)
		if pocet == pocetSousedu && d >= nejblizsi[pocet-1].d {
			continue
		}
		// Zařazení do seřazeného seznamu nejbližších (vkládáním; sousedů je jen pár)
		if pocet < pocetSousedu {
			pocet++
		}
		m := pocet - 1
		for m > 0 && nejblizsi[m-1].d > d {
			nejblizsi[m] = nejblizsi[m-1]
			m--
		}
		nejblizsi[m] = soused{d, s.udaje[i].x[s.cil]}
	}
	if pocet < pocetSousedu {
		return 0, 0, false
	}
	vybrani := append([]soused(nil), nejblizsi[:pocet]...)
	sort.Slice(vybrani, func(a, b int) bool { return vybrani[a].y < vybrani[b].y })
	celkem, soucet, soucet2 := 0.0, 0.0, 0.0
	for _, v := range vybrani {
		w := 1 / (0.25 + math.Sqrt(v.d))
		celkem += w
		soucet += w * v.y
		soucet2 += w * v.y * v.y
	}
	// Vážený medián
	polovina, kumul := celkem/2, 0.0
	for _, v := range vybrani {
		kumul += 1 / (0.25 + math.Sqrt(v.d))
		if kumul >= polovina {
			hodnota = v.y
			break
		}
	}
	prumer := soucet / celkem
	nejistota = math.Sqrt(max(0, soucet2/celkem-prumer*prumer))
	return hodnota, nejistota, true
}

// ---------------------------------------------------------------------------------------------------------
// Drobnosti

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func bitu(x int) int {
	n := 0
	for ; x > 0; x >>= 1 {
		n += x & 1
	}
	return n
}
