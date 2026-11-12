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
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"

	"pinup-katalog/internal/obsah"
)

func main() {
	slozka := flag.String("obsah", "", "složka obsahu fotek (partie.bin, vektory.bin)")
	text := flag.String("text", "", "složka textového modelu (stáhne se, když chybí)")
	popisy := flag.String("popisy", "", "soubor s popisy, jeden na řádek")
	ucit := flag.String("ucit", "", "CSV ručně roztříděných fotek (id,muz,zeny)")
	vystup := flag.String("out", "internal/obsah/druh.bin", "kam uložit naučené váhy (s -ucit)")
	flag.Parse()
	switch {
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

// Logistická regrese s vahami tříd (málo kladných příkladů) a L2, plný gradientní sestup
func regrese(data []priklad) obsah.VahyDruhu {
	const epoch, krok, l2, skala = 400, 0.5, 1e-3, 10.0
	var m obsah.VahyDruhu
	kladnych := 0.0
	for _, p := range data {
		kladnych += p.t
	}
	vahaAno := (float64(len(data)) - kladnych) / max(kladnych, 1)
	w := make([]float64, obsah.Rozmer)
	b := 0.0
	g := make([]float64, obsah.Rozmer)
	for range epoch {
		clear(g)
		gb := 0.0
		for _, p := range data {
			z := b
			for j, x := range p.x {
				z += w[j] * float64(x) * skala
			}
			d := 1/(1+math.Exp(-max(-30, min(30, z)))) - p.t
			if p.t == 1 {
				d *= vahaAno
			}
			for j, x := range p.x {
				g[j] += d * float64(x) * skala
			}
			gb += d
		}
		n := float64(len(data))
		for j := range w {
			w[j] -= krok * (g[j]/n + l2*w[j])
		}
		b -= krok * gb / n
	}
	m.Posun = float32(b)
	for j := range w {
		m.Vahy[j] = float32(w[j] * skala)
	}
	return m
}

func chyba(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
