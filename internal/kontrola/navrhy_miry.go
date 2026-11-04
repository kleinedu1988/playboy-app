package kontrola

import (
	"fmt"
	"math"
	"math/bits"
	"regexp"
	"strconv"
	"strings"

	"playboy-app/internal/hledani"
	"playboy-app/internal/uceni"
)

// „90-60-90“, „36-24-36“, „34C-24-35“, „90 x 60 x 90 cm“
var VzorMer = regexp.MustCompile(`^\s*(\d{2,3})\s*([A-Ga-g]{1,3})?\s*[-–/x×]\s*(\d{2,3})\s*[-–/x×]\s*(\d{2,3})\s*(cm|in|"|″|inch|inches|palce|palcu)?\s*$`)

// Rozložené míry v centimetrech; prsa = velikost košíčku napsaná u hrudníku („34C“), hrudník je pak obvod pod
// prsy, ne přes ně, a jako obvod hrudníku se nebere
type RozlozeneMiry struct {
	Obvody   [3]int // hrudník, pas, boky; 0 = neznámý
	Palce    bool
	Pasmo    int    // číslo u velikosti košíčku
	Kosicek  string // „C“
	Puvodni  string
	VPalcich [3]int
}

func RozlozitMiry(text string) (RozlozeneMiry, bool) {
	r := RozlozeneMiry{Puvodni: strings.TrimSpace(text)}
	s := VzorMer.FindStringSubmatch(text)
	if s == nil {
		return r, false
	}
	var cisla [3]int
	for i, j := range []int{1, 3, 4} {
		cisla[i], _ = strconv.Atoi(s[j])
	}
	jednotka := strings.ToLower(s[5])
	switch {
	case jednotka == "cm":
	case jednotka != "":
		r.Palce = true
	case cisla[0] <= 60 && cisla[1] <= 60 && cisla[2] <= 60:
		r.Palce = true
	case cisla[0] >= 45 && cisla[1] >= 45 && cisla[2] >= 45:
	default:
		return r, false // smíšené jednotky
	}
	r.VPalcich = cisla
	for i, c := range cisla {
		if r.Palce {
			c = int(math.Round(float64(c) * 2.54))
		}
		r.Obvody[i] = c
	}
	if s[2] != "" {
		r.Kosicek = strings.ToUpper(s[2])
		r.Pasmo = cisla[0]
		r.Obvody[0] = 0
	}
	for i, o := range ObvodyNavrhu {
		if p := uceni.Priznaky[o.J]; r.Obvody[i] != 0 && (float64(r.Obvody[i]) < p.MezOd || float64(r.Obvody[i]) > p.MezDo) {
			return r, false
		}
	}
	return r, true
}

// Tvar velikosti prsou: americká („34C“), evropská („75C“) nebo jen košíček („C“)
const (
	TvarUS = iota
	TvarEU
	TvarKosicek
	PocetTvaru
)

var VzorVelikostiPrsou = regexp.MustCompile(`^\s*(\d{2,3})?\s*([A-Ga-g]{1,3})\s*$`)

func TvarVelikosti(v string) int {
	s := VzorVelikostiPrsou.FindStringSubmatch(v)
	switch {
	case s == nil:
		return -1
	case s[1] == "":
		return TvarKosicek
	}
	if n, _ := strconv.Atoi(s[1]); n < 55 {
		return TvarUS
	}
	return TvarEU
}

// Americká velikost na evropskou (pásmo 34 → 75, košíček do D stejný, DD → E, DDD → F); "" když nejde
func VelikostEU(pasmo int, kosicek string) string {
	if pasmo < 28 || pasmo > 46 || pasmo%2 != 0 {
		return ""
	}
	prevod := map[string]string{"AA": "AA", "A": "A", "B": "B", "C": "C", "D": "D", "DD": "E", "DDD": "F"}
	k, ok := prevod[kosicek]
	if !ok {
		return ""
	}
	return strconv.Itoa(pasmo*5/2-10) + k
}

func NavrhnoutMiry(modelky []hledani.Modelka, pridat PridatKandidata) {
	// Tvar velikosti prsou, kterým sbírka píše (většina aspoň ze 70 % a aspoň 5 hodnot, jinak jak je v mírách)
	var tvary [PocetTvaru]int
	celkem := 0
	for _, m := range modelky {
		if t := TvarVelikosti(m.VelikostPrsou); t >= 0 {
			tvary[t]++
			celkem++
		}
	}
	tvarSbirky := -1
	for t, n := range tvary {
		if celkem >= 5 && float64(n) >= 0.7*float64(celkem) {
			tvarSbirky = t
		}
	}

	udaje := uceni.UdajeSbirky(modelky)
	odhady := map[[2]int]*uceni.RegreseObvodu{}
	// Sousedé pro každý obvod se učí až při prvním použití (u sbírky bez chybějících obvodů vůbec)
	sousede := map[int]*uceni.SousedePostavy{}
	naucenoSousedu := map[int]bool{}
	for i, m := range modelky {
		if NeniKNavrhu(m, "obvodPasCm") {
			continue
		}
		stavajici := [3]int{m.ObvodHrudnikCm, m.ObvodPasCm, m.ObvodBokyCm}
		if strings.TrimSpace(m.Miry) != "" {
			r, ok := RozlozitMiry(m.Miry)
			if !ok {
				continue // míry, kterým program nerozumí: neodhaduje se ani regresí
			}
			// Vyplněné obvody musí mírám odpovídat, jinak je text nespolehlivý
			souhlasi := true
			for j, s := range stavajici {
				if s > 0 && r.Obvody[j] > 0 && absInt(s-r.Obvody[j]) > 2 {
					souhlasi = false
				}
			}
			if !souhlasi {
				continue
			}
			for j, o := range ObvodyNavrhu {
				if stavajici[j] > 0 || r.Obvody[j] == 0 {
					continue
				}
				jistota, duvod := 0.97, fmt.Sprintf("z měr %s", r.Puvodni)
				if r.Palce {
					jistota = 0.9
					duvod = fmt.Sprintf("z měr %s (palce): %d″ = %d cm", r.Puvodni, r.VPalcich[j], r.Obvody[j])
				}
				pridat(m, nil, o.Pole, strconv.Itoa(r.Obvody[j]), duvod, "miry", jistota)
			}
			if r.Kosicek != "" && strings.TrimSpace(m.VelikostPrsou) == "" {
				tvar := TvarUS
				if r.Pasmo >= 55 {
					tvar = TvarEU
				}
				hodnota, jistota := strconv.Itoa(r.Pasmo)+r.Kosicek, 0.95
				duvod := fmt.Sprintf("z měr %s", r.Puvodni)
				switch {
				case tvarSbirky == TvarKosicek:
					hodnota = r.Kosicek
					duvod += " (sbírka píše jen košíček)"
				case tvarSbirky == TvarEU && tvar == TvarUS:
					if hodnota = VelikostEU(r.Pasmo, r.Kosicek); hodnota == "" {
						continue
					}
					jistota = 0.8
					duvod += fmt.Sprintf(" převedeno na evropskou velikost jako ve sbírce (%d%s → %s)", r.Pasmo, r.Kosicek, hodnota)
				case tvarSbirky == TvarUS && tvar == TvarEU:
					continue // převod z evropské velikosti na americkou není jednoznačný
				}
				pridat(m, nil, "velikostPrsou", hodnota, duvod, "miry", jistota)
			}
			continue
		}
		// Odhad regresí a podle nejpodobnějších modelek z ostatních údajů postavy
		u := udaje[i]
		for j, o := range ObvodyNavrhu {
			if stavajici[j] > 0 {
				continue
			}
			maska := 0
			for _, p := range []int{uceni.PrVyska, uceni.PrVaha, uceni.PrHrudnik, uceni.PrPas, uceni.PrBoky} {
				if p != o.J && u.Ma[p] {
					maska |= 1 << p
				}
			}
			if bits.OnesCount(uint(maska)) < 2 {
				continue
			}
			if !naucenoSousedu[o.J] {
				sousede[o.J], naucenoSousedu[o.J] = uceni.NaucitSousedy(udaje, o.J), true
			}
			NavrhnoutPodleSousedu(m, u, o.Pole, o.J, sousede[o.J], pridat)
			klic := [2]int{o.J, maska}
			reg, ok := odhady[klic]
			if !ok {
				reg = uceni.NaucitRegresi(udaje, o.J, maska)
				odhady[klic] = reg
			}
			if reg == nil || reg.Trefa2 < PrahOdhadu {
				continue
			}
			odhad := reg.Odhad(u.X)
			if p := uceni.Priznaky[o.J]; float64(odhad) < p.MezOd || float64(odhad) > p.MezDo {
				continue
			}
			var zCeho []string
			for _, p := range reg.Prediktory {
				zCeho = append(zCeho, uceni.Priznaky[p].Nazev+" "+uceni.Priznaky[p].Hodnota(u.X[p]))
			}
			duvod := fmt.Sprintf("odhad z údajů %s podle %d modelek sbírky (přesně ±1 cm u %d %%, ±2 cm u %d %% z nich)",
				strings.Join(zCeho, ", "), reg.N, int(math.Round(reg.Trefa1*100)), int(math.Round(reg.Trefa2*100)))
			pridat(m, nil, o.Pole, strconv.Itoa(odhad), duvod, "regrese", min(StropOdhadu, reg.Trefa1))
		}
	}
}

// Odhad obvodu podle nejpodobnějších modelek (uceni/modely.go): jen když se na sbírce trefuje (±2 cm aspoň
// u PrahOdhadu modelek) a sousedé se shodují aspoň zhruba jako obvykle. Jistota je ověřená trefa ±1 cm,
// snížená v poměru typické a vlastní nejistoty, a nikdy nad StropOdhadu.
func NavrhnoutPodleSousedu(m hledani.Modelka, u uceni.UdajePostavy, pole string, cil int, s *uceni.SousedePostavy, pridat PridatKandidata) {
	if s == nil {
		return
	}
	hodnota, nejistota, o, ok := s.Odhad(u)
	if !ok || o.Trefa2 < PrahOdhadu || nejistota > 2*o.TypickaNejistota {
		return
	}
	odhad := int(math.Round(hodnota))
	if p := uceni.Priznaky[cil]; float64(odhad) < p.MezOd || float64(odhad) > p.MezDo {
		return
	}
	jistota := min(StropOdhadu, o.Trefa1*min(1, o.TypickaNejistota/max(nejistota, 0.01)))
	duvod := fmt.Sprintf("podle %d modelek sbírky s nejpodobnější postavou: %d cm, rozptyl ±%s cm (ověřeno na %d modelkách se stejnými údaji: ±1 cm u %d %%, ±2 cm u %d %%)",
		uceni.PocetSousedu, odhad, strings.Replace(strconv.FormatFloat(nejistota, 'f', 1, 64), ".", ",", 1), o.N,
		int(math.Round(o.Trefa1*100)), int(math.Round(o.Trefa2*100)))
	pridat(m, nil, pole, strconv.Itoa(odhad), duvod, "podobne", jistota)
}
