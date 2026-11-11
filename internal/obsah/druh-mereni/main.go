//go:build ignore

// Měření rozpoznání druhu fotky (0.02.059, Explicitní fotky zvlášť). Vypíše CSV pro ruční kontrolu vzorku:
//
//	go run internal/obsah/druh-mereni/main.go -obsah ~/.local/share/pinup-katalog/obsah > partie.csv
//	go run internal/obsah/druh-mereni/main.go -obsah … -text <složka textového modelu> -popisy popisy.txt > clip.csv
//
// Bez -text: jistoty všech tříd detektoru NudeNet (pořadí TridyDetektoru). S -text: podobnost vektoru fotky
// (CLIP) s každým popisem ze souboru (řádek = popis); textový model se do složky stáhne jako u Hledání slovy.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"strings"

	"pinup-katalog/internal/obsah"
)

func main() {
	slozka := flag.String("obsah", "", "složka obsahu fotek (partie.bin, vektory.bin)")
	text := flag.String("text", "", "složka textového modelu (stáhne se, když chybí)")
	popisy := flag.String("popisy", "", "soubor s popisy, jeden na řádek")
	flag.Parse()
	if *text == "" {
		partie(*slozka)
		return
	}
	if err := obsah.PripravitText(context.Background(), http.DefaultClient, *text, nil); err != nil {
		chyba(err)
	}
	m, err := obsah.OtevritText(*text)
	if err != nil {
		chyba(err)
	}
	f, err := os.Open(*popisy)
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
	v, err := obsah.NacistVektory(*slozka)
	if err != nil {
		chyba(err)
	}
	podobnosti := make([]map[string]float64, len(vektory))
	for i, x := range vektory {
		podobnosti[i] = v.PodobnostiKeStredu(x)
	}
	fmt.Println("id," + strings.Join(texty, ","))
	for id := range podobnosti[0] {
		hodnoty := make([]string, len(texty))
		for i := range texty {
			hodnoty[i] = fmt.Sprintf("%.4f", podobnosti[i][id])
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

func chyba(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
