package uceni

import (
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"playboy-app/internal/hledani"
)

// Sdílené statistické nástroje strojového učení pro texty, pravděpodobnosti a četnosti (celkový popis v docs/UCENI.md).
// Nic z toho nečte databázi ani nemá stav: stejné údaje dají vždy stejný výsledek.

// ---------------------------------------------------------------------------------------------------------
// Texty

// KlicTextu vrátí klíč textu pro porovnání: malá písmena bez diakritiky, bez teček, jedna mezera („U.S.A.“ = „usa“)
func KlicTextu(s string) string {
	z := hledani.Zjednodusit(s)
	if UzJeKlicem(z) {
		return z
	}
	return strings.Join(strings.Fields(strings.ReplaceAll(z, ".", "")), " ")
}

// UzJeKlicem rozpozná text, který úprava na klíč nezmění: jen ASCII bez teček, mezery jednoduché a ne na krajích
func UzJeKlicem(z string) bool {
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

// JaroWinkler spočítá Jaro–Winklerovu podobnost dvou textů (0–1): shodné znaky v okně, přehozené znaky a bonus za společný začátek
func JaroWinkler(s1, s2 string) float64 { return JaroWinklerZnaku([]rune(s1), []rune(s2)) }

// JaroWinklerZnaku spočítá Jaro–Winklerovu podobnost nad znaky; pomocná pole jsou u krátkých textů na zásobníku
func JaroWinklerZnaku(a, b []rune) float64 {
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
	PrahSlouceni     = 0.94 // Jaro–Winkler varianty a převládajícího tvaru
	NasobekPrevahy   = 3    // převládající tvar je aspoň tolikrát častější než varianta
	MinDelkaSlouceni = 5    // kratší klíče se nesjednocují (u krátkých slov je podobnost náhodná)
)

// SlovnikHodnot drží zápisy hodnot jednoho údaje ve sbírce a slučuje vzácné varianty s překlepem do převládajícího tvaru.
type SlovnikHodnot struct {
	Pocty       map[string]map[string]int // klíč → zápis → počet
	Kanon       map[string]string         // varianta → převládající klíč (po Naucit)
	Preferovane map[string]string         // klíč → zápis z oprav uživatele
}

func NovySlovnik() *SlovnikHodnot {
	return &SlovnikHodnot{Pocty: map[string]map[string]int{}, Kanon: map[string]string{}}
}

func (s *SlovnikHodnot) Pridat(klic, zapis string) {
	if s.Pocty[klic] == nil {
		s.Pocty[klic] = map[string]int{}
	}
	s.Pocty[klic][zapis]++
}

func (s *SlovnikHodnot) Celkem(klic string) int {
	n := 0
	for _, p := range s.Pocty[klic] {
		n += p
	}
	return n
}

// Naucit sloučí varianty s překlepem; volá se jednou po přidání všech zápisů
func (s *SlovnikHodnot) Naucit() {
	klice := make([]string, 0, len(s.Pocty))
	pocet := make(map[string]int, len(s.Pocty))
	for k := range s.Pocty {
		if !strings.HasPrefix(k, "z:") && len(k) >= MinDelkaSlouceni && utf8.RuneCountInString(k) >= MinDelkaSlouceni {
			klice = append(klice, k)
			pocet[k] = s.Celkem(k)
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
			if pocet[klice[j]] < NasobekPrevahy*max(1, pocet[varianta]) {
				break // seřazené sestupně: dál jsou jen méně časté
			}
			if JaroWinklerZnaku(znaky[i], znaky[j]) >= PrahSlouceni {
				cil = klice[j]
				kandidatu++
			}
		}
		if kandidatu == 1 {
			s.Kanon[varianta] = cil
		}
	}
	// Řetězec variant (a → b → c) vede rovnou k poslednímu tvaru; počty zápisů se přičtou k němu
	for varianta := range s.Kanon {
		cil := s.Kanon[varianta]
		for kroku := 0; kroku < 8; kroku++ {
			dalsi, ok := s.Kanon[cil]
			if !ok {
				break
			}
			cil = dalsi
		}
		s.Kanon[varianta] = cil
	}
	for varianta, cil := range s.Kanon {
		for z, n := range s.Pocty[varianta] {
			s.PridatPocet(cil, z, n)
		}
	}
}

func (s *SlovnikHodnot) PridatPocet(klic, zapis string, n int) {
	if s.Pocty[klic] == nil {
		s.Pocty[klic] = map[string]int{}
	}
	s.Pocty[klic][zapis] += n
}

// Klic vrátí klíč po sjednocení variant
func (s *SlovnikHodnot) Klic(k string) string {
	if c, ok := s.Kanon[k]; ok {
		return c
	}
	return k
}

// Zapis vrátí zápis hodnoty: oprava uživatele, jinak nejčastější zápis sbírky; "" když hodnotu sbírka nezná
func (s *SlovnikHodnot) Zapis(klic string) string {
	klic = s.Klic(klic)
	if z, ok := s.Preferovane[klic]; ok && z != "" {
		return z
	}
	nejlepsi, pocet := "", 0
	for z, n := range s.Pocty[klic] {
		if n > pocet || n == pocet && z < nejlepsi {
			nejlepsi, pocet = z, n
		}
	}
	return nejlepsi
}

// ---------------------------------------------------------------------------------------------------------
// Pravděpodobnosti

// PodilSPredpokladem vrátí podíl úspěchů s předpokladem: (k + p·w)/(n + w)
func PodilSPredpokladem(k, n int, p, w float64) float64 {
	return (float64(k) + p*w) / (float64(n) + w)
}

// Logit převede pravděpodobnost na log-šanci; omezí na (0,001; 0,999), aby jistota nikdy nebyla nekonečná
func Logit(p float64) float64 {
	p = min(0.999, max(0.001, p))
	return math.Log(p / (1 - p))
}

func ZLogitu(x float64) float64 { return 1 / (1 + math.Exp(-x)) }

// Tlumení závislosti zdrojů při spojení (1 = čistý naivní Bayes)
const TlumeniZavislosti = 0.5

// SpojitZdroje spojí pravděpodobnosti téže hodnoty z více nezávislých zdrojů (naivní Bayes v log-šancích).
func SpojitZdroje(p []float64, predpoklad, rho float64) float64 {
	if len(p) == 0 {
		return 0
	}
	if len(p) == 1 {
		return zLogituZ(Logit(p[0]))
	}
	var buf [8]float64
	var serazene []float64
	if len(p) <= len(buf) {
		serazene = append(buf[:0], p...)
	} else {
		serazene = append([]float64(nil), p...)
	}
	// Seřazení sestupně vkládáním (zdrojů je nejvýše pár)
	for i := 1; i < len(serazene); i++ {
		v := serazene[i]
		j := i
		for j > 0 && serazene[j-1] < v {
			serazene[j] = serazene[j-1]
			j--
		}
		serazene[j] = v
	}
	x := Logit(serazene[0])
	lp := Logit(predpoklad)
	for _, pi := range serazene[1:] {
		x += rho * (Logit(pi) - lp)
	}
	return ZLogitu(x)
}

func zLogituZ(x float64) float64 { return ZLogitu(x) }

// Uspesnost měří úspěšnost pravidla na sbírce: kolikrát by u údajů, které už vyplněné jsou, trefilo
type Uspesnost struct{ K, N int }

func (u *Uspesnost) Zapocitat(shoda bool) {
	u.N++
	if shoda {
		u.K++
	}
}

func (u Uspesnost) Jistota(predpoklad, vaha float64) float64 {
	return PodilSPredpokladem(u.K, u.N, predpoklad, vaha)
}

// Text vrátí popis úspěšnosti do důvodu
func (u Uspesnost) Text(co string) string {
	if u.N == 0 {
		return ""
	}
	return "; ve sbírce sedí u " + strconv.Itoa(u.K) + " z " + strconv.Itoa(u.N) + " " + co
}

// ---------------------------------------------------------------------------------------------------------
// Četnosti hodnot při podmínce

type Cetnosti map[string]map[string]int

func (c Cetnosti) Pridat(podminka, hodnota string) {
	if c[podminka] == nil {
		c[podminka] = map[string]int{}
	}
	c[podminka][hodnota]++
}

// Nejcastejsi vrátí nejčastější hodnotu při podmínce, její počet a počet všech
func (c Cetnosti) Nejcastejsi(podminka string) (hodnota string, k, n int) {
	for h, p := range c[podminka] {
		n += p
		if p > k || p == k && h < hodnota {
			hodnota, k = h, p
		}
	}
	return hodnota, k, n
}
