package sbirka

import (
	"pinup-katalog/internal/hledani"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	NejviceVZebricku = 8
	PrvniRokCasopisu = 1953

	TypOnline   = "Pictorial online"
	TypCGTydne  = "Cyber Girl týdne"
	TypCGMesice = "Cyber Girl měsíce"
	TypPMMesice = "Playmate měsíce"
	TypPMRoku   = "Playmate roku"
)

var (
	VzorVydani     = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2]|S\d{2})(-[A-Z]{2})?$`)
	VzorVydaniAlba = regexp.MustCompile(`^\d{4}(-(0[1-9]|1[0-2]|S\d{2}))?(-[A-Z]{2})?$`)
)

// JePictorialCasopisu vrací true pro obyčejný pictorial časopisu nebo pictorial playmate.
func JePictorialCasopisu(typ string) bool {
	return typ == "Pictorial" || typ == TypPMMesice || typ == TypPMRoku
}

// JeOnlineTyp vrací true pro online album (Pictorial online nebo Cyber Girl týdne či měsíce).
func JeOnlineTyp(typ string) bool {
	return typ == TypOnline || typ == TypCGTydne || typ == TypCGMesice
}

// EdicePodleVydani vrátí edici z vydání (RRRR-MM-ED nebo RRRR-ED); prázdná znamená US.
func EdicePodleVydani(vydani string) string {
	if i := strings.LastIndex(vydani, "-"); i > 0 && len(vydani)-i == 3 && vydani[i+1] >= 'A' {
		return vydani[i+1:]
	}
	return ""
}

// ObsahujeKlic zjistí, zda čárkou oddělený seznam klíčů obsahuje daný klíč (bez alokace řezu).
func ObsahujeKlic(seznam, klic string) bool {
	for len(seznam) > 0 {
		var cast string
		if i := strings.IndexByte(seznam, ','); i >= 0 {
			cast = seznam[:i]
			seznam = seznam[i+1:]
		} else {
			cast = seznam
			seznam = ""
		}
		if strings.TrimSpace(cast) == klic {
			return true
		}
	}
	return false
}

// PrepnoutKlic přidá nebo odebere klíč v čárkou odděleném seřazeném seznamu.
func PrepnoutKlic(seznam, klic string, pridat bool) string {
	var klice []string
	for _, k := range strings.Split(seznam, ",") {
		k = strings.TrimSpace(k)
		if k != "" && k != klic {
			klice = append(klice, k)
		}
	}
	if pridat {
		klice = append(klice, klic)
	}
	sort.Strings(klice)
	return strings.Join(klice, ",")
}

// JeSpecial vrací true, pokud je vydání speciál (RRRR-Snn).
func JeSpecial(vydani string) bool {
	return len(vydani) >= 8 && vydani[4] == '-' && vydani[5] == 'S'
}

func rychlyRokMesic(s string) (rok, mesic int, ok bool) {
	if len(s) < 7 || s[4] != '-' {
		return 0, 0, false
	}
	for i := 0; i < 4; i++ {
		c := s[i]
		if c < '0' || c > '9' {
			return 0, 0, false
		}
		rok = rok*10 + int(c-'0')
	}
	if s[5] < '0' || s[5] > '9' || s[6] < '0' || s[6] > '9' {
		return 0, 0, false
	}
	mesic = int(s[5]-'0')*10 + int(s[6]-'0')
	return rok, mesic, true
}

// CastiVydani vrátí rok, měsíc a edici vydání (bez přípony = US); měsíc 0 u ročníku a speciálu.
func CastiVydani(vydani string) (rok, mesic int, edice string, ok bool) {
	if !VzorVydaniAlba.MatchString(vydani) {
		return 0, 0, "", false
	}
	rok = int(vydani[0]-'0')*1000 + int(vydani[1]-'0')*100 + int(vydani[2]-'0')*10 + int(vydani[3]-'0')
	edice = "US"
	zbytek := vydani[4:]
	for len(zbytek) > 0 {
		if zbytek[0] == '-' {
			zbytek = zbytek[1:]
		}
		konec := strings.IndexByte(zbytek, '-')
		var cast string
		if konec < 0 {
			cast = zbytek
			zbytek = ""
		} else {
			cast = zbytek[:konec]
			zbytek = zbytek[konec+1:]
		}
		if len(cast) == 2 && cast[0] >= 'A' && cast[0] <= 'Z' {
			edice = cast
		} else if len(cast) == 2 && cast[0] >= '0' && cast[0] <= '9' && cast[1] >= '0' && cast[1] <= '9' {
			mesic = int(cast[0]-'0')*10 + int(cast[1]-'0')
		}
	}
	return rok, mesic, edice, true
}

// VekKVydani vrátí věk v celých letech k datu vydání (stejně jako v profilu modelky); 0 = nelze určit.
func VekKVydani(narozeni, vydani string) int {
	nr, nm, ok1 := rychlyRokMesic(narozeni)
	vr, vm, ok2 := rychlyRokMesic(vydani)
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

// Zebricek vrátí seřazený žebříček z počtů (při shodě abecedně), nejvýše n položek.
func Zebricek(pocty map[string]int, n int) []PolozkaStatistiky {
	polozky := make([]PolozkaStatistiky, 0, len(pocty))
	for nazev, pocet := range pocty {
		polozky = append(polozky, PolozkaStatistiky{Nazev: nazev, Pocet: pocet})
	}
	sort.Slice(polozky, func(i, j int) bool {
		if polozky[i].Pocet != polozky[j].Pocet {
			return polozky[i].Pocet > polozky[j].Pocet
		}
		return polozky[i].Nazev < polozky[j].Nazev
	})
	if len(polozky) > n {
		polozky = polozky[:n]
	}
	return polozky
}

// SpocitatStatistiky spočítá statistiky sbírky pro Přehled čistě v paměti nad snímkem sbírky bez dotazů do SQLite.
func SpocitatStatistiky(
	modelky []hledani.Modelka,
	indexModelky map[int]int,
	texty []hledani.Texty,
	alba []AlbumSbirky,
	kalendar []VydaniKalendare,
) Statistiky {
	s := Statistiky{
		Desetileti:  []DesetiletiStatistiky{},
		Vek:         []PolozkaStatistiky{},
		Fotografove: []PolozkaStatistiky{},
		Narodnosti:  []PolozkaStatistiky{},
	}
	desetileti := map[int]*DesetiletiStatistiky{}
	dekada := func(rok int) *DesetiletiStatistiky {
		k := rok / 10 * 10
		if desetileti[k] == nil {
			desetileti[k] = &DesetiletiStatistiky{Desetileti: k, Edice: map[string]int{}}
		}
		return desetileti[k]
	}

	for _, k := range kalendar {
		if rok, mesic, edice, ok := CastiVydani(k.Vydani); ok && mesic > 0 {
			d := dekada(rok)
			d.Cisla++
			d.Edice[edice]++
		}
	}

	podleVeku := map[int]int{}
	var veky []int
	fotografove, zapisy := map[string]int{}, map[string]map[string]int{}

	for i := range alba {
		al := &alba[i]
		if al.Typ == "Centerfold" {
			s.Centerfoldu++
			if rok, _, _, ok := CastiVydani(al.Vydani); ok {
				dekada(rok).Centerfoldy++
			}
			var narozeni string
			if idx, ok := indexModelky[al.ModelkaID]; ok && idx >= 0 && idx < len(modelky) {
				narozeni = modelky[idx].NarozeniDatum
			}
			if vek := VekKVydani(narozeni, al.Vydani); vek > 0 {
				podleVeku[vek]++
				veky = append(veky, vek)
			}
		}
		if al.Fotograf != "" {
			for _, jmeno := range strings.Split(al.Fotograf, ",") {
				if jmeno = strings.TrimSpace(jmeno); jmeno != "" {
					k := hledani.Zjednodusit(jmeno)
					if zapisy[k] == nil {
						zapisy[k] = map[string]int{}
					}
					zapisy[k][jmeno]++
					fotografove[k]++
				}
			}
		}
	}

	for _, d := range desetileti {
		s.Desetileti = append(s.Desetileti, *d)
	}
	sort.Slice(s.Desetileti, func(i, j int) bool { return s.Desetileti[i].Desetileti < s.Desetileti[j].Desetileti })

	if len(veky) > 0 {
		sort.Ints(veky)
		s.VekZnamy = len(veky)
		if len(veky)%2 == 1 {
			s.VekMedian = float64(veky[len(veky)/2])
		} else {
			s.VekMedian = float64(veky[len(veky)/2-1]+veky[len(veky)/2]) / 2
		}
		for vek := veky[0]; vek <= veky[len(veky)-1]; vek++ {
			s.Vek = append(s.Vek, PolozkaStatistiky{Nazev: strconv.Itoa(vek), Pocet: podleVeku[vek]})
			if podleVeku[vek] > podleVeku[s.VekNejcastej] {
				s.VekNejcastej = vek
			}
		}
	}

	podleJmena := make(map[string]int, len(fotografove))
	for k, pocet := range fotografove {
		nejlepsi := ""
		for zapis, n := range zapisy[k] {
			if lepsi := n - zapisy[k][nejlepsi]; nejlepsi == "" || lepsi > 0 || lepsi == 0 && zapis < nejlepsi {
				nejlepsi = zapis
			}
		}
		podleJmena[nejlepsi] = pocet
	}
	s.Fotografove = Zebricek(podleJmena, NejviceVZebricku)
	s.FotografuCelkem = len(podleJmena)
	s.ModelkyFotografu = make(map[string][]int, len(s.Fotografove))
	for _, f := range s.Fotografove {
		h := hledani.Pripravit(`fotograf:"` + f.Nazev + `"`)
		ids := []int{}
		for i := range modelky {
			if len(h) == 0 || (i < len(texty) && h.Odpovida(&modelky[i], &texty[i])) {
				ids = append(ids, modelky[i].ID)
			}
		}
		s.ModelkyFotografu[f.Nazev] = ids
	}

	narodnosti := map[string]int{}
	for i := range modelky {
		if n := strings.TrimSpace(modelky[i].Narodnost); n != "" {
			narodnosti[n]++
			s.ModelekSNarodnosti++
		}
	}
	s.Narodnosti = Zebricek(narodnosti, NejviceVZebricku)
	s.NarodnostiCelkem = len(narodnosti)
	return s
}
