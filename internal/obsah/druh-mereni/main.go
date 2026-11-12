//go:build ignore

// Měření a učení odhadu druhu fotky (0.02.059–0.02.060, Explicitní fotky zvlášť):
//
//	go run internal/obsah/druh-mereni/main.go -obsah ~/.local/share/pinup-katalog/obsah > partie.csv
//	go run internal/obsah/druh-mereni/main.go -obsah … -text <složka textového modelu> -popisy popisy.txt > clip.csv
//	go run internal/obsah/druh-mereni/main.go -obsah … -ucit stitky.csv [-out internal/obsah/druh.bin]
//
// Bez přepínačů: jistoty všech tříd detektoru NudeNet (pořadí TridyDetektoru). S -text: podobnost vektoru fotky
// (CLIP) s každým popisem ze souboru (řádek = popis); textový model se do složky stáhne jako u Hledání slovy.
// S -ucit: z ručně roztříděných fotek (CSV id,muz,zeny; 1 = ano, 0 = ne, prázdné = neurčeno) naučí logistickou
// regresi nad vektory CLIP pro „muž na fotce“ a „víc žen“, vypíše přesnost z 5násobné křížové validace a uloží
// váhy (formát v druh.go). Štítky obsahují ID souborů sbírky, proto nepatří do repozitáře.
package main

import (
	"bufio"
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strings"

	"pinup-katalog/internal/obsah"
)

func main() {
	slozka := flag.String("obsah", "", "složka obsahu fotek (partie.bin, vektory.bin)")
	text := flag.String("text", "", "složka textového modelu (stáhne se, když chybí)")
	popisy := flag.String("popisy", "", "soubor s popisy, jeden na řádek")
	ucit := flag.String("ucit", "", "CSV ručně roztříděných fotek (id,muz,zeny)")
	vystup := flag.String("out", "internal/obsah/druh.bin", "kam uložit naučené váhy (s -ucit)")
	simulace := flag.Bool("simulace", false, "s -ucit: simulace učení z potvrzení místo uložení vah")
	sila := flag.Float64("sila", obsah.SilaVychozichVah, "simulace: síla L2 k vestavěným vahám")
	vahaVzorku := flag.Float64("vzorek", 0.3, "simulace: váha slabého vzorku sbírky (0 = bez vzorku)")
	flag.Parse()
	switch {
	case *ucit != "" && *simulace:
		obsah.SilaVychozichVah = *sila
		simulovat(*slozka, *ucit, *vahaVzorku)
	case *ucit != "":
		naucit(*slozka, *ucit, *vystup)
	case *text != "":
		podobnosti(*slozka, *text, *popisy)
	default:
		partie(*slozka)
	}
}

func podobnosti(slozka, text, popisy string) {
	if err := obsah.PripravitText(context.Background(), http.DefaultClient, text, nil); err != nil {
		chyba(err)
	}
	m, err := obsah.OtevritText(text)
	if err != nil {
		chyba(err)
	}
	f, err := os.Open(popisy)
	if err != nil {
		chyba(err)
	}
	var texty []string
	var vektory [][]float32
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		if t := strings.TrimSpace(sc.Text()); t != "" {
			texty = append(texty, t)
			vektory = append(vektory, m.Vektor(t))
		}
	}
	v, err := obsah.NacistVektory(slozka)
	if err != nil {
		chyba(err)
	}
	pod := make([]map[string]float64, len(vektory))
	for i, x := range vektory {
		pod[i] = v.PodobnostiKeStredu(x)
	}
	fmt.Println("id," + strings.Join(texty, ","))
	for id := range pod[0] {
		hodnoty := make([]string, len(texty))
		for i := range texty {
			hodnoty[i] = fmt.Sprintf("%.4f", pod[i][id])
		}
		fmt.Println(id + "," + strings.Join(hodnoty, ","))
	}
}

func partie(slozka string) {
	p, err := obsah.NacistPartie(slozka)
	if err != nil {
		chyba(err)
	}
	fmt.Println("id," + strings.Join(obsah.TridyDetektoru, ","))
	for _, id := range p.Seznam() {
		j := p.Jistoty(id)
		hodnoty := make([]string, len(j))
		for i, x := range j {
			hodnoty[i] = fmt.Sprintf("%.3f", x)
		}
		fmt.Println(id + "," + strings.Join(hodnoty, ","))
	}
}

type priklad struct {
	x []float32
	t float64
}

func naucit(slozka, soubor, vystup string) {
	v, err := obsah.NacistVektory(slozka)
	if err != nil {
		chyba(err)
	}
	f, err := os.Open(soubor)
	if err != nil {
		chyba(err)
	}
	radky, err := csv.NewReader(f).ReadAll()
	f.Close()
	if err != nil {
		chyba(err)
	}
	var sady [2][]priklad // muž, víc žen
	for _, r := range radky[1:] {
		x := v.Vektor(r[0])
		if x == nil || len(r) < 3 {
			continue
		}
		for k := range 2 {
			switch r[1+k] {
			case "1":
				sady[k] = append(sady[k], priklad{x, 1})
			case "0":
				sady[k] = append(sady[k], priklad{x, 0})
			}
		}
	}
	var modely [2]obsah.VahyDruhu
	for k, jmeno := range []string{"muž na fotce", "víc žen"} {
		data := sady[k]
		rand.New(rand.NewSource(1)).Shuffle(len(data), func(a, b int) { data[a], data[b] = data[b], data[a] })
		var skore [][2]float64
		for slozeni := range 5 {
			var trenink []priklad
			for i, p := range data {
				if i%5 != slozeni {
					trenink = append(trenink, p)
				}
			}
			m := regrese(trenink)
			for i := slozeni; i < len(data); i += 5 {
				skore = append(skore, [2]float64{m.Pravdepodobnost(data[i].x), data[i].t})
			}
		}
		kladnych := 0
		for _, p := range data {
			kladnych += int(p.t)
		}
		fmt.Printf("%s: %d příkladů, %d ano\n", jmeno, len(data), kladnych)
		for _, prah := range []float64{0.5, 0.7, 0.85, 0.95} {
			tp, fp := 0, 0
			for _, s := range skore {
				if s[0] >= prah {
					if s[1] == 1 {
						tp++
					} else {
						fp++
					}
				}
			}
			fmt.Printf("  práh %.2f: nalezeno %d/%d, falešně %d/%d\n", prah, tp, kladnych, fp, len(data)-kladnych)
		}
		modely[k] = regrese(data)
	}
	if err := os.WriteFile(vystup, obsah.ZakodovatDruh(modely), 0o644); err != nil {
		chyba(err)
	}
	fmt.Println("uloženo", vystup)
}

// Simulace učení z potvrzení (0.02.063): štítky se rozdělí na polovinu A (z ní vestavěný odhad) a B. Z první
// části B „uživatel potvrdí“ prvních 40 návrhů (jistota ≥ 0,85, se skutečným druhem), odhad se doladí jako
// v programu (z vah A, s kotvou: vzorek sbírky s cílem = odhad A) a na druhé části B se porovnají návrhy před a po.
func simulovat(slozka, soubor string, vahaVzorku float64) {
	v, err := obsah.NacistVektory(slozka)
	if err != nil {
		chyba(err)
	}
	f, err := os.Open(soubor)
	if err != nil {
		chyba(err)
	}
	radky, err := csv.NewReader(f).ReadAll()
	f.Close()
	if err != nil {
		chyba(err)
	}
	// Slabý vzorek: prvních 300 vektorů, které nejsou mezi štítky
	znamy := map[string]bool{}
	for _, r := range radky[1:] {
		znamy[r[0]] = true
	}
	var ids []string
	for id := range v.PodobnostiKeStredu(make([]float32, obsah.Rozmer)) {
		if !znamy[id] {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	var vzorek [][]float32
	for _, id := range ids[:min(300, len(ids))] {
		vzorek = append(vzorek, v.Vektor(id))
	}
	for k, jmeno := range []string{"muž na fotce", "víc žen"} {
		var a, b []priklad
		for i, r := range radky[1:] {
			x := v.Vektor(r[0])
			if x == nil || (r[1+k] != "0" && r[1+k] != "1") {
				continue
			}
			p := priklad{x, map[string]float64{"1": 1, "0": 0}[r[1+k]]}
			if i%2 == 0 {
				a = append(a, p)
			} else {
				b = append(b, p)
			}
		}
		zaklad := regrese(a)
		b1, b2 := b[:len(b)/2], b[len(b)/2:]
		var potvrzene []obsah.PrikladDruhu
		for _, p := range b1 {
			if len(potvrzene) < 40 && zaklad.Pravdepodobnost(p.x) >= 0.5 {
				potvrzene = append(potvrzene, obsah.PrikladDruhu{X: p.x, T: p.t, Vaha: 1})
			}
		}
		// Učí se i z potvrzených správných (pózovací mezi návrhy = nejcennější)
		opravy := 0
		for _, p := range potvrzene {
			if p.T == 0 {
				opravy++
			}
		}
		data := append([]obsah.PrikladDruhu(nil), potvrzene...)
		for _, x := range vzorek {
			if vahaVzorku > 0 {
				data = append(data, obsah.PrikladDruhu{X: x, T: zaklad.Pravdepodobnost(x), Vaha: vahaVzorku})
			}
		}
		doladeny := obsah.UcitDruh(data, &zaklad)
		pocty := func(m obsah.VahyDruhu) (tp, fp int) {
			for _, p := range b2 {
				if m.Pravdepodobnost(p.x) >= 0.85 {
					if p.t == 1 {
						tp++
					} else {
						fp++
					}
				}
			}
			return
		}
		t0, f0 := pocty(zaklad)
		t1, f1 := pocty(doladeny)
		fmt.Printf("%s: potvrzeno %d návrhů (%d opravených na „ne“); na zbytku vzorku návrhy správně %d → %d, chybně %d → %d\n",
			jmeno, len(potvrzene), opravy, t0, t1, f0, f1)
	}
}

// Logistická regrese od nuly (stejná jako učení z potvrzení v programu, obsah.UcitDruh)
func regrese(data []priklad) obsah.VahyDruhu {
	p := make([]obsah.PrikladDruhu, len(data))
	for i, d := range data {
		p[i] = obsah.PrikladDruhu{X: d.x, T: d.t, Vaha: 1}
	}
	return obsah.UcitDruh(p, nil)
}

func chyba(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
