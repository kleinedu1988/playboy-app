package main

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Statistiky sbírky pro Přehled: centerfoldy a čísla podle desetiletí, věk v době centerfoldu, nejčastější
// fotografové a národnosti, srovnání edic. Počítá se z uložených údajů při každém otevření, nic se neukládá.

type PolozkaStatistiky struct {
	Nazev string `json:"nazev"`
	Pocet int    `json:"pocet"`
}

// Desetiletí (1970 = 1970–1979) s počty centerfoldů a čísel ve sbírce; edice → počet čísel
type DesetiletiStatistiky struct {
	Desetileti  int            `json:"desetileti"`
	Centerfoldy int            `json:"centerfoldy"`
	Cisla       int            `json:"cisla"`
	Edice       map[string]int `json:"edice"`
}

type Statistiky struct {
	Centerfoldu int                    `json:"centerfoldu"`
	Desetileti  []DesetiletiStatistiky `json:"desetileti"`
	// Věk v době centerfoldu: počet centerfoldů podle věku (jen modelky se známým měsícem narození)
	Vek          []PolozkaStatistiky `json:"vek"`
	VekMedian    float64             `json:"vekMedian"`
	VekNejcastej int                 `json:"vekNejcastejsi"`
	VekZnamy     int                 `json:"vekZnamy"`
	// Nejčastější fotografové (podle počtu alb) a národnosti (podle počtu modelek), nejvýše po 8
	Fotografove        []PolozkaStatistiky `json:"fotografove"`
	FotografuCelkem    int                 `json:"fotografuCelkem"`
	Narodnosti         []PolozkaStatistiky `json:"narodnosti"`
	NarodnostiCelkem   int                 `json:"narodnostiCelkem"`
	ModelekSNarodnosti int                 `json:"modelekSNarodnosti"`
}

const nejviceVZebricku = 8

var vzorRokMesic = regexp.MustCompile(`^(\d{4})-(\d{2})`)

// Rok, měsíc a edice vydání (bez přípony = US); měsíc 0 u ročníku a speciálu
func castiVydani(vydani string) (rok, mesic int, edice string, ok bool) {
	if !vzorVydaniAlba.MatchString(vydani) {
		return 0, 0, "", false
	}
	casti := strings.Split(vydani, "-")
	rok, _ = strconv.Atoi(casti[0])
	edice = "US"
	for _, c := range casti[1:] {
		if len(c) == 2 && c[0] >= 'A' && c[0] <= 'Z' {
			edice = c
		} else if m, err := strconv.Atoi(c); err == nil {
			mesic = m
		}
	}
	return rok, mesic, edice, true
}

// Věk v celých letech k datu vydání (stejně jako v profilu modelky); 0 = nelze určit
func vekKVydani(narozeni, vydani string) int {
	n, v := vzorRokMesic.FindStringSubmatch(narozeni), vzorRokMesic.FindStringSubmatch(vydani)
	if n == nil || v == nil {
		return 0
	}
	nr, _ := strconv.Atoi(n[1])
	nm, _ := strconv.Atoi(n[2])
	vr, _ := strconv.Atoi(v[1])
	vm, _ := strconv.Atoi(v[2])
	vek := vr - nr
	if vm < nm {
		vek--
	}
	if vek <= 0 || vek >= 120 {
		return 0
	}
	return vek
}

// Seřazený žebříček z počtů (při shodě abecedně), nejvýše n položek
func zebricek(pocty map[string]int, n int) []PolozkaStatistiky {
	polozky := []PolozkaStatistiky{}
	for nazev, pocet := range pocty {
		polozky = append(polozky, PolozkaStatistiky{nazev, pocet})
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

func (a *App) GetStatistiky() Statistiky {
	s := Statistiky{Desetileti: []DesetiletiStatistiky{}, Vek: []PolozkaStatistiky{}, Fotografove: []PolozkaStatistiky{}, Narodnosti: []PolozkaStatistiky{}}
	desetileti := map[int]*DesetiletiStatistiky{}
	dekada := func(rok int) *DesetiletiStatistiky {
		k := rok / 10 * 10
		if desetileti[k] == nil {
			desetileti[k] = &DesetiletiStatistiky{Desetileti: k, Edice: map[string]int{}}
		}
		return desetileti[k]
	}

	// Čísla ve sbírce: každé měsíční vydání, ke kterému je cover, centerfold nebo pictorial
	for _, k := range a.GetKalendar() {
		if rok, mesic, edice, ok := castiVydani(k.Vydani); ok && mesic > 0 {
			d := dekada(rok)
			d.Cisla++
			d.Edice[edice]++
		}
	}

	// Centerfoldy: každé album typu Centerfold (i bez fotek), s datem narození modelky pro věk
	rows, err := a.db.Query(`SELECT a.vydani, COALESCE(m.narozeni_datum, '')
		FROM alba a LEFT JOIN modelky m ON m.id = a.modelka_id WHERE a.typ = 'Centerfold'`)
	if err != nil {
		a.chyba("načtení statistik", err)
		return s
	}
	podleVeku := map[int]int{}
	veky := []int{}
	for rows.Next() {
		var vydani, narozeni string
		if rows.Scan(&vydani, &narozeni) != nil {
			continue
		}
		s.Centerfoldu++
		if rok, _, _, ok := castiVydani(vydani); ok {
			dekada(rok).Centerfoldy++
		}
		if vek := vekKVydani(narozeni, vydani); vek > 0 {
			podleVeku[vek]++
			veky = append(veky, vek)
		}
	}
	rows.Close()

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
			s.Vek = append(s.Vek, PolozkaStatistiky{strconv.Itoa(vek), podleVeku[vek]})
			if podleVeku[vek] > podleVeku[s.VekNejcastej] {
				s.VekNejcastej = vek
			}
		}
	}

	// Fotografové: počet alb (víc fotografů alba odděleno čárkou). Jména se sjednotí bez ohledu na velikost písmen
	// a diakritiku; ukáže se nejčastější zápis, při shodě ten s velkými písmeny.
	fotografove, zapisy := map[string]int{}, map[string]map[string]int{}
	if rows, err := a.db.Query(`SELECT fotograf FROM alba WHERE COALESCE(fotograf, '') <> ''`); err == nil {
		for rows.Next() {
			var text string
			if rows.Scan(&text) != nil {
				continue
			}
			for _, jmeno := range strings.Split(text, ",") {
				if jmeno = strings.TrimSpace(jmeno); jmeno != "" {
					k := zjednodusit(jmeno)
					if zapisy[k] == nil {
						zapisy[k] = map[string]int{}
					}
					zapisy[k][jmeno]++
					fotografove[k]++
				}
			}
		}
		rows.Close()
	}
	podleJmena := map[string]int{}
	for k, pocet := range fotografove {
		nejlepsi := ""
		for zapis, n := range zapisy[k] {
			if lepsi := n - zapisy[k][nejlepsi]; nejlepsi == "" || lepsi > 0 || lepsi == 0 && zapis < nejlepsi {
				nejlepsi = zapis
			}
		}
		podleJmena[nejlepsi] = pocet
	}
	s.Fotografove = zebricek(podleJmena, nejviceVZebricku)
	s.FotografuCelkem = len(podleJmena)

	// Národnosti modelek
	narodnosti := map[string]int{}
	if rows, err := a.db.Query(`SELECT TRIM(narodnost) FROM modelky WHERE TRIM(COALESCE(narodnost, '')) <> ''`); err == nil {
		for rows.Next() {
			var n string
			if rows.Scan(&n) == nil {
				narodnosti[n]++
				s.ModelekSNarodnosti++
			}
		}
		rows.Close()
	}
	s.Narodnosti = zebricek(narodnosti, nejviceVZebricku)
	s.NarodnostiCelkem = len(narodnosti)
	return s
}
