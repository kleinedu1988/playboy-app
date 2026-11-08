//go:build ignore

// Generátor vektorů tagů fotek (internal/obsah/tagy.bin) a popisů stylů (styly.bin, -styly) z textové věže
// CLIP ViT-B/32 – spouští se ručně jen při změně katalogu tagů nebo popisů v tagy.go a styly.go:
//
//	go run ./internal/obsah/tagy-clip -model <složka s text_model.onnx, vocab.json, merges.txt> -lib <libonnxruntime.so>
//
// Soubory jsou z Xenova/clip-vit-base-patch32 (stejná revize jako obrazová věž, docs/MODEL-CLIP-B32.md). Program
// textovou věž nepotřebuje: tagy jsou pevné, jejich vektory se spočítají jednou a jsou vestavěné.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"

	ort "github.com/yalue/onnxruntime_go"

	"playboy-app/internal/obsah"
)

func main() {
	slozka := flag.String("model", "", "složka s text_model.onnx, vocab.json a merges.txt")
	lib := flag.String("lib", "", "cesta k libonnxruntime.so")
	vystup := flag.String("out", "", "výstup (výchozí internal/obsah/tagy.bin, se -styly internal/obsah/styly.bin)")
	styly := flag.Bool("styly", false, "popisy stylů (PopisyStylu) místo tagů")
	ukazat := flag.String("tokeny", "", "jen vypsat tokeny textu (kontrola tokenizéru)")
	flag.Parse()

	tok := nacistTokenizer(*slozka)
	if *ukazat != "" {
		fmt.Println(tok.zakodovat(*ukazat))
		return
	}
	ort.SetSharedLibraryPath(*lib)
	if err := ort.InitializeEnvironment(); err != nil {
		panic(err)
	}
	defer ort.DestroyEnvironment()
	sez, err := ort.NewDynamicAdvancedSession(*slozka+"/text_model.onnx", []string{"input_ids"}, []string{"text_embeds"}, nil)
	if err != nil {
		panic(err)
	}
	defer sez.Destroy()

	vektor := func(text string) []float32 {
		ids := tok.zakodovat(text)
		vstup, _ := ort.NewTensor(ort.NewShape(1, int64(len(ids))), ids)
		defer vstup.Destroy()
		vyst, _ := ort.NewEmptyTensor[float32](ort.NewShape(1, obsah.Rozmer))
		defer vyst.Destroy()
		if err := sez.Run([]ort.Value{vstup}, []ort.Value{vyst}); err != nil {
			panic(err)
		}
		return append([]float32(nil), vyst.GetData()...)
	}
	// Průměr vektorů všech popisů (víc formulací = stabilnější vektor), znovu na délku 1
	prumer := func(texty []string) []float32 {
		s := make([]float32, obsah.Rozmer)
		for _, t := range texty {
			v := vektor(t)
			obsah.Normalizovat(v)
			for i := range s {
				s[i] += v[i]
			}
		}
		obsah.Normalizovat(s)
		return s
	}

	v := obsah.NoveVektory()
	if *styly {
		for _, p := range obsah.PopisyStylu {
			v.Pridat(p.Klic, prumer(p.Ano))
		}
		if *vystup == "" {
			*vystup = "internal/obsah/styly.bin"
		}
	} else {
		for _, p := range obsah.PopisyTagu {
			v.Pridat(p.Klic, prumer(p.Ano))
		}
		if *vystup == "" {
			*vystup = "internal/obsah/tagy.bin"
		}
	}
	f, err := os.Create(*vystup)
	if err != nil {
		panic(err)
	}
	if err := v.Zapsat(f); err != nil {
		panic(err)
	}
	f.Close()
	fmt.Println("zapsáno", *vystup, v.Pocet())
}

// Tokenizér CLIP: malá písmena, rozdělení na slova, bajty jako znaky, BPE podle merges.txt, slovo končí </w>
type tokenizer struct {
	slovnik map[string]int64
	poradi  map[[2]string]int
	bajty   [256]string
}

var vzorSlov = regexp.MustCompile(`'s|'t|'re|'ve|'m|'ll|'d|\pL+|\pN|[^\s\pL\pN]+`)

func nacistTokenizer(slozka string) *tokenizer {
	t := &tokenizer{slovnik: map[string]int64{}, poradi: map[[2]string]int{}}
	data, err := os.ReadFile(slozka + "/vocab.json")
	if err != nil {
		panic(err)
	}
	if err := json.Unmarshal(data, &t.slovnik); err != nil {
		panic(err)
	}
	f, err := os.Open(slozka + "/merges.txt")
	if err != nil {
		panic(err)
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	n := 0
	for s.Scan() {
		r := s.Text()
		if strings.HasPrefix(r, "#") {
			continue
		}
		a, b, ok := strings.Cut(r, " ")
		if ok {
			t.poradi[[2]string{a, b}] = n
			n++
		}
	}
	// bytes_to_unicode z GPT-2/CLIP
	dalsi := 0
	for b := 0; b < 256; b++ {
		if b >= '!' && b <= '~' || b >= 0xA1 && b <= 0xAC || b >= 0xAE && b <= 0xFF {
			t.bajty[b] = string(rune(b))
		} else {
			t.bajty[b] = string(rune(256 + dalsi))
			dalsi++
		}
	}
	return t
}

func (t *tokenizer) zakodovat(text string) []int64 {
	ids := []int64{t.slovnik["<|startoftext|>"]}
	for _, slovo := range vzorSlov.FindAllString(strings.ToLower(strings.Join(strings.Fields(text), " ")), -1) {
		var casti []string
		for i := 0; i < len(slovo); i++ {
			casti = append(casti, t.bajty[slovo[i]])
		}
		casti[len(casti)-1] += "</w>"
		for len(casti) > 1 {
			nej, kde := -1, -1
			for i := 0; i+1 < len(casti); i++ {
				if r, ok := t.poradi[[2]string{casti[i], casti[i+1]}]; ok && (nej < 0 || r < nej) {
					nej, kde = r, i
				}
			}
			if kde < 0 {
				break
			}
			casti = append(casti[:kde], append([]string{casti[kde] + casti[kde+1]}, casti[kde+2:]...)...)
		}
		for _, c := range casti {
			id, ok := t.slovnik[c]
			if !ok {
				panic("token mimo slovník: " + c)
			}
			ids = append(ids, id)
		}
	}
	return append(ids, t.slovnik["<|endoftext|>"])
}
