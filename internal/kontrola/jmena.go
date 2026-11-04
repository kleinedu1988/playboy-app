package kontrola

import (
	"fmt"
	"math"
	"playboy-app/internal/hledani"
	"playboy-app/internal/uceni"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

// Jméno modelky připravené k porovnání
type JmenoKPorovnani struct {
	Modelka                  int    // index modelky
	Puvodni                  string // jak je zapsané
	Presne                   string // zjednodušené jako u „ok-jmeno“ (shodu hlásí ono)
	Text                     string // slova oddělená mezerou
	Cislice                  string
	Slova                    [][]rune
	Znaky, Otoceny, Serazeny []rune  // slova za sebou; příjmení na začátku; slova abecedně
	IdSlov                   []int32 // slova ve slovníku sbírky
}

// Slova všech jmen sbírky, každé jednou
type SlovnikSlov struct {
	ID    map[string]int32
	Znaky [][]rune
}

func NovySlovnikSlov() *SlovnikSlov {
	return &SlovnikSlov{ID: map[string]int32{}}
}

// Číslo slova ve slovníku (nové se přidá)
func (s *SlovnikSlov) Cislo(slovo string) int32 {
	id, ok := s.ID[slovo]
	if !ok {
		id = int32(len(s.Znaky))
		s.ID[slovo] = id
		s.Znaky = append(s.Znaky, []rune(slovo))
	}
	return id
}

// Ke každému slovu podobná slova (Jaro–Winkler aspoň PrahSlov, včetně slova samého).
// Trigramy jsou zabalené do uint64 klíčů místo alokace stringu pro každý trigram.
func (s *SlovnikSlov) Podobna() [][]int32 {
	n := len(s.Znaky)
	podobna := make([][]int32, n)
	trigramy := make([][]int32, n)
	idTrigramu := map[uint64]int32{}
	var bufZnaku [64]rune
	for u, slovo := range s.Znaky {
		var znaky []rune
		if len(slovo)+2 <= len(bufZnaku) {
			znaky = bufZnaku[:len(slovo)+2]
			znaky[0] = ' '
			copy(znaky[1:], slovo)
			znaky[len(slovo)+1] = ' '
		} else {
			znaky = append(append([]rune{' '}, slovo...), ' ')
		}
		for i := 0; i+3 <= len(znaky); i++ {
			t := uint64(znaky[i])<<42 | uint64(znaky[i+1])<<21 | uint64(znaky[i+2])
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
			if spolecnych >= min(len(trigramy[u]), len(trigramy[v]))-6 && uceni.JaroWinklerZnaku(s.Znaky[u], s.Znaky[v]) >= PrahSlov {
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

func obsahujeCislo(seznam []int32, x int32) bool {
	for _, y := range seznam {
		if y == x {
			return true
		}
	}
	return false
}

// Připraví jméno: zjednodušení, slova bez interpunkce, otočené pořadí (příjmení na začátku) a slova abecedně
func PripravitJmeno(jmeno string, modelka int, slovnik *SlovnikSlov) JmenoKPorovnani {
	slova := strings.FieldsFunc(hledani.Zjednodusit(jmeno), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
	j := JmenoKPorovnani{Modelka: modelka, Puvodni: strings.TrimSpace(jmeno), Presne: hledani.Zjednodusit(strings.TrimSpace(jmeno))}
	j.Text = strings.Join(slova, " ")
	j.Znaky = []rune(j.Text)
	j.Otoceny = j.Znaky
	if len(slova) > 1 {
		j.Otoceny = []rune(slova[len(slova)-1] + " " + strings.Join(slova[:len(slova)-1], " "))
	}
	serazena := append([]string(nil), slova...)
	sort.Strings(serazena)
	j.Serazeny = []rune(strings.Join(serazena, " "))
	for _, slovo := range slova {
		j.Slova = append(j.Slova, []rune(slovo))
		if id := slovnik.Cislo(slovo); !obsahujeCislo(j.IdSlov, id) {
			j.IdSlov = append(j.IdSlov, id)
		}
	}
	j.Cislice = strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, j.Text)
	return j
}

// Každé slovo kratšího jména má ve druhém podobné slovo
func SlovaOdpovidaji(a, b [][]rune) bool {
	if len(a) > len(b) {
		a, b = b, a
	}
	for _, s := range a {
		nejlepsi := 0.0
		for _, t := range b {
			nejlepsi = max(nejlepsi, uceni.JaroWinklerZnaku(s, t))
		}
		if nejlepsi < PrahSlov {
			return false
		}
	}
	return true
}

func rokNarozeni(m hledani.Modelka) string {
	d := strings.TrimSpace(m.NarozeniDatum)
	if len(d) >= 4 {
		if _, err := strconv.Atoi(d[:4]); err == nil {
			return d[:4]
		}
	}
	return ""
}

// Podobnost dvou jmen dvou modelek upravená dalšími údaji
func PodobnostModelek(a, b JmenoKPorovnani, ma, mb hledani.Modelka, prah float64) (skore float64, duvody []string, ok bool) {
	if a.Presne == b.Presne || a.Cislice != b.Cislice || len(a.Znaky) < 5 || len(b.Znaky) < 5 {
		return 0, nil, false
	}
	if rokA, rokB := rokNarozeni(ma), rokNarozeni(mb); rokA != "" && rokB != "" && rokA != rokB {
		return 0, nil, false
	}
	skore = uceni.JaroWinklerZnaku(a.Znaky, b.Znaky)
	if len(a.Slova) > 1 || len(b.Slova) > 1 {
		skore = max(skore, uceni.JaroWinklerZnaku(a.Znaky, b.Otoceny), uceni.JaroWinklerZnaku(a.Otoceny, b.Znaky), uceni.JaroWinklerZnaku(a.Serazeny, b.Serazeny))
	}
	if skore < prah-0.08 || !SlovaOdpovidaji(a.Slova, b.Slova) {
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
	if prvniA := PrvniVydani(ma); prvniA != "" && prvniA == PrvniVydani(mb) {
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
	if (len(a.Slova) < 2 || len(b.Slova) < 2) && len(duvody) == 0 {
		return 0, nil, false
	}
	return skore, duvody, skore >= prah
}

// Pravděpodobně dvakrát založená modelka podle podobného jména („ok-podobne-jmeno“)
func KontrolovatPodobnaJmena(modelky []hledani.Modelka, prah float64, pridat PridatNalez) {
	slovnik := NovySlovnikSlov()
	var jmena []JmenoKPorovnani
	for i, m := range modelky {
		videna := map[string]bool{}
		for _, jmeno := range append([]string{m.Jmeno}, strings.Split(m.DalsiJmena, ",")...) {
			j := PripravitJmeno(jmeno, i, slovnik)
			if j.Text == "" || videna[j.Text] {
				continue
			}
			videna[j.Text] = true
			jmena = append(jmena, j)
		}
	}
	podobna := slovnik.Podobna()
	jmenaSlova := make([][]int32, len(slovnik.Znaky))
	for i, j := range jmena {
		for _, id := range j.IdSlov {
			jmenaSlova[id] = append(jmenaSlova[id], int32(i))
		}
	}

	type dvojice struct {
		hlasena, druha    int
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
		for _, id := range a.IdSlov {
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
				if b.Modelka == a.Modelka || len(b.Slova) < len(a.Slova) || len(b.Slova) == len(a.Slova) && j < i {
					continue
				}
				ma, mb := modelky[a.Modelka], modelky[b.Modelka]
				skore, duvody, ok := PodobnostModelek(*a, *b, ma, mb, prah)
				if !ok {
					continue
				}
				d := dvojice{hlasena: a.Modelka, druha: b.Modelka, jmeno: a.Puvodni, jmenoDruhe: b.Puvodni, skore: skore, duvody: duvody}
				if mb.ID > ma.ID || mb.ID == ma.ID && b.Modelka > a.Modelka {
					d.hlasena, d.druha, d.jmeno, d.jmenoDruhe = b.Modelka, a.Modelka, b.Puvodni, a.Puvodni
				}
				klic := [2]int{min(a.Modelka, b.Modelka), max(a.Modelka, b.Modelka)}
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
