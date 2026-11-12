package obsah

// Hledání slovy (docs/NAVRH-GALERIE-KOLEKCE.md, bod 5): český text → vektor ve stejném prostoru jako vektory fotek
// z CLIP ViT-B/32. Textový model je vícejazyčný DistilBERT vydestilovaný na textovou věž CLIP
// (sentence-transformers/clip-ViT-B-32-multilingual-v1), zúžený na češtinu (slovník 32 768 tokenů, licence MIT):
// tokeny → 6 vrstev transformeru → průměr přes tokeny → lineární projekce 768 → 512 → délka 1.
//
// Model běží přímo v Go (dotaz má pár slov, ~0,1 s): po stažení (~274 MB) se váhy převedou na int8 po řádcích
// do text-cs-int8.bin (~70 MB) a stažené soubory se smažou. Stahuje se, až když hledání slovy poprvé zapneš.

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"
)

const (
	nazevTextu      = "text-cs-int8.bin"
	nazevTokenizeru = "text-cs-tokenizer.json"
	znackaTextu     = "PBTEXTCS"
	verzeTextu      = 1
	vrstevTextu     = 6
	dimTextu        = 768
	hlavTextu       = 12
	maxTokenu       = 128
)

// Soubory textového modelu ke stažení (pevná revize na Hugging Face, ověřené hashe)
var SouboryTextu = []Soubor{
	{
		Nazev:    "text-cs.safetensors",
		Adresa:   "https://huggingface.co/alphaedge-ai/clip-ViT-B-32-multilingual-v1-cs-32768/resolve/44510be281f23377777dae6b62b4ea66b3179181/model.safetensors",
		Hash:     "1e209d99d485ffb0173dbe2ceaea3ba928c54db846756a5aa19a0c4e8f5e95fe",
		Velikost: 272362328,
	},
	{
		Nazev:    "text-cs-dense.safetensors",
		Adresa:   "https://huggingface.co/alphaedge-ai/clip-ViT-B-32-multilingual-v1-cs-32768/resolve/44510be281f23377777dae6b62b4ea66b3179181/2_Dense/model.safetensors",
		Hash:     "d12568dc7300970a4d3dbb49068ad16cd89b99840b74b026f8e48071e9414f74",
		Velikost: 1572984,
	},
	{
		Nazev:    nazevTokenizeru,
		Adresa:   "https://huggingface.co/alphaedge-ai/clip-ViT-B-32-multilingual-v1-cs-32768/resolve/44510be281f23377777dae6b62b4ea66b3179181/tokenizer.json",
		Hash:     "ea9279a00107f66cd3879d5e9a3ae57e9d6485862b8f80ed286ad4563a18c906",
		Velikost: 728414,
	},
}

// TextPripraven: převedený model i tokenizér na místě
func TextPripraven(slozka string) bool {
	for _, n := range []string{nazevTextu, nazevTokenizeru} {
		if i, err := os.Stat(filepath.Join(slozka, n)); err != nil || i.Size() == 0 {
			return false
		}
	}
	return true
}

// VelikostTextu: kolik bajtů se stáhne (pro potvrzení)
func VelikostTextu() int64 {
	var n int64
	for _, s := range SouboryTextu {
		n += s.Velikost
	}
	return n
}

// PripravitText stáhne chybějící soubory textového modelu, převede váhy na int8 a stažené váhy smaže
func PripravitText(ctx context.Context, klient *http.Client, slozka string, prubeh func(Prubeh)) error {
	if TextPripraven(slozka) {
		return nil
	}
	if err := os.MkdirAll(slozka, 0o700); err != nil {
		return err
	}
	var celkem, hotovo int64
	for _, s := range SouboryTextu {
		celkem += s.Velikost
	}
	for _, s := range SouboryTextu {
		cil := filepath.Join(slozka, s.Nazev)
		if _, err := os.Stat(cil); err != nil {
			zacatek := hotovo
			err := Stahnout(ctx, klient, s.Adresa, cil, s.Hash, func(h, _ int64) {
				if prubeh != nil {
					prubeh(Prubeh{Soubor: s.Nazev, Hotovo: zacatek + h, Celkem: celkem})
				}
			})
			if err != nil {
				return fmt.Errorf("%s: %w", s.Nazev, err)
			}
		}
		hotovo += s.Velikost
	}
	if err := prevestText(filepath.Join(slozka, SouboryTextu[0].Nazev), filepath.Join(slozka, SouboryTextu[1].Nazev), filepath.Join(slozka, nazevTextu)); err != nil {
		return fmt.Errorf("převod textového modelu: %w", err)
	}
	os.Remove(filepath.Join(slozka, SouboryTextu[0].Nazev))
	os.Remove(filepath.Join(slozka, SouboryTextu[1].Nazev))
	if prubeh != nil {
		prubeh(Prubeh{Hotovo: celkem, Celkem: celkem})
	}
	return nil
}

// SmazatText odstraní textový model (i rozstažené zbytky)
func SmazatText(slozka string) error {
	var chyba error
	for _, n := range []string{nazevTextu, nazevTokenizeru, SouboryTextu[0].Nazev, SouboryTextu[1].Nazev,
		SouboryTextu[0].Nazev + pripona, SouboryTextu[1].Nazev + pripona, nazevTokenizeru + pripona} {
		if err := os.Remove(filepath.Join(slozka, n)); err != nil && !errors.Is(err, os.ErrNotExist) && chyba == nil {
			chyba = err
		}
	}
	return chyba
}

// --- safetensors (jen F32) ---

type tenzor struct {
	tvar []int
	data []float32
}

type tenzorInfo struct {
	Dtype   string   `json:"dtype"`
	Shape   []int    `json:"shape"`
	Offsets [2]int64 `json:"data_offsets"`
}

type cteckaSafetensors struct {
	f       *os.File
	zacatek int64
	tenzory map[string]tenzorInfo
}

func otevritSafetensors(cesta string) (*cteckaSafetensors, error) {
	f, err := os.Open(cesta)
	if err != nil {
		return nil, err
	}
	var n uint64
	if err := binary.Read(f, binary.LittleEndian, &n); err != nil {
		f.Close()
		return nil, err
	}
	if n > 10<<20 {
		f.Close()
		return nil, errors.New("safetensors: nečekaná hlavička")
	}
	hlavicka := make([]byte, n)
	if _, err := io.ReadFull(f, hlavicka); err != nil {
		f.Close()
		return nil, err
	}
	var popis map[string]json.RawMessage
	if err := json.Unmarshal(hlavicka, &popis); err != nil {
		f.Close()
		return nil, err
	}
	tenzory := make(map[string]tenzorInfo, len(popis))
	for jmeno, raw := range popis {
		if jmeno == "__metadata__" {
			continue
		}
		var i tenzorInfo
		if err := json.Unmarshal(raw, &i); err != nil {
			f.Close()
			return nil, err
		}
		tenzory[jmeno] = i
	}
	return &cteckaSafetensors{f: f, zacatek: 8 + int64(n), tenzory: tenzory}, nil
}

func (c *cteckaSafetensors) zavrit() error {
	return c.f.Close()
}

func (c *cteckaSafetensors) cist(jmeno string) (tenzor, bool, error) {
	i, ok := c.tenzory[jmeno]
	if !ok {
		return tenzor{}, false, nil
	}
	if i.Dtype != "F32" {
		return tenzor{}, true, fmt.Errorf("safetensors: %s má typ %s", jmeno, i.Dtype)
	}
	pocet := 1
	for _, d := range i.Shape {
		pocet *= d
	}
	if int64(pocet)*4 != i.Offsets[1]-i.Offsets[0] {
		return tenzor{}, true, fmt.Errorf("safetensors: %s nesedí velikost", jmeno)
	}
	data := make([]float32, pocet)
	if _, err := c.f.Seek(c.zacatek+i.Offsets[0], io.SeekStart); err != nil {
		return tenzor{}, true, err
	}
	if err := binary.Read(bufio.NewReaderSize(c.f, 1<<20), binary.LittleEndian, data); err != nil {
		return tenzor{}, true, fmt.Errorf("safetensors: %s: %w", jmeno, err)
	}
	return tenzor{i.Shape, data}, true, nil
}

// --- převedený model: matice int8 po řádcích (měřítko na řádek), vektory float32 ---

type maticeInt8 struct {
	radku, sloupcu int
	meritka        []float32
	data           []int8
}

func naInt8(t tenzor) maticeInt8 {
	r, s := t.tvar[0], t.tvar[1]
	m := maticeInt8{r, s, make([]float32, r), make([]int8, r*s)}
	for i := range r {
		radek := t.data[i*s : (i+1)*s]
		var mx float32
		for _, x := range radek {
			mx = max(mx, float32(math.Abs(float64(x))))
		}
		if mx == 0 {
			continue
		}
		m.meritka[i] = mx / 127
		for j, x := range radek {
			m.data[i*s+j] = int8(math.Round(float64(x / m.meritka[i])))
		}
	}
	return m
}

// Názvy matic a vektorů převedeného modelu (pořadí v souboru)
func nazvyTextu() (matice, vektory []string) {
	matice = []string{"embeddings.word_embeddings.weight", "embeddings.position_embeddings.weight"}
	vektory = []string{"embeddings.LayerNorm.gamma", "embeddings.LayerNorm.beta"}
	for l := range vrstevTextu {
		p := fmt.Sprintf("transformer.layer.%d.", l)
		for _, x := range []string{"attention.q_lin", "attention.k_lin", "attention.v_lin", "attention.out_lin", "ffn.lin1", "ffn.lin2"} {
			matice = append(matice, p+x+".weight")
			vektory = append(vektory, p+x+".bias")
		}
		for _, x := range []string{"sa_layer_norm", "output_layer_norm"} {
			vektory = append(vektory, p+x+".weight", p+x+".bias")
		}
	}
	matice = append(matice, "linear.weight")
	return matice, vektory
}

func prevestText(model, dense, cil string) error {
	t, err := otevritSafetensors(model)
	if err != nil {
		return err
	}
	defer t.zavrit()
	d, err := otevritSafetensors(dense)
	if err != nil {
		return err
	}
	defer d.zavrit()
	nacti := func(jmeno string) (tenzor, bool, error) {
		if jmeno == "linear.weight" {
			return d.cist(jmeno)
		}
		return t.cist(jmeno)
	}
	matice, vektory := nazvyTextu()
	docasny := cil + ".tmp"
	f, err := os.OpenFile(docasny, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	w := bufio.NewWriterSize(f, 1<<20)
	binary.Write(w, binary.LittleEndian, []byte(znackaTextu))
	binary.Write(w, binary.LittleEndian, uint16(verzeTextu))
	for _, n := range matice {
		x, ok, err := nacti(n)
		if err != nil {
			f.Close()
			os.Remove(docasny)
			return err
		}
		if !ok || len(x.tvar) != 2 {
			f.Close()
			os.Remove(docasny)
			return fmt.Errorf("chybí matice %s", n)
		}
		m := naInt8(x)
		binary.Write(w, binary.LittleEndian, [2]uint32{uint32(m.radku), uint32(m.sloupcu)})
		binary.Write(w, binary.LittleEndian, m.meritka)
		binary.Write(w, binary.LittleEndian, m.data)
	}
	for _, n := range vektory {
		x, ok, err := nacti(n)
		if err != nil {
			f.Close()
			os.Remove(docasny)
			return err
		}
		if !ok || len(x.tvar) != 1 {
			f.Close()
			os.Remove(docasny)
			return fmt.Errorf("chybí vektor %s", n)
		}
		binary.Write(w, binary.LittleEndian, uint32(len(x.data)))
		binary.Write(w, binary.LittleEndian, x.data)
	}
	err = w.Flush()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(docasny, cil)
	}
	if err != nil {
		os.Remove(docasny)
	}
	return err
}

type vrstvaTextu struct {
	qW, kW, vW, outW, ffn1W, ffn2W       maticeInt8
	qB, kB, vB, outB, ffn1B, ffn2B       []float32
	saNormG, saNormB, outNormG, outNormB []float32
}

// TextovyModel: český text → vektor délky 1 v prostoru vektorů fotek
type TextovyModel struct {
	slova, pozice, projekce maticeInt8
	embNormG, embNormB      []float32
	vrstvy                  [vrstevTextu]vrstvaTextu
	slovnik                 map[string]int32
	unk                     int32
	cls                     int32
	sep                     int32

	mu    sync.Mutex
	pamet map[string][]float32 // posledních dotazů
}

// OtevritText načte převedený model a tokenizér ze složky obsah/
func OtevritText(slozka string) (*TextovyModel, error) {
	f, err := os.Open(filepath.Join(slozka, nazevTextu))
	if err != nil {
		return nil, err
	}
	defer f.Close()
	r := bufio.NewReaderSize(f, 1<<20)
	var znacka [8]byte
	var verze uint16
	if err := binary.Read(r, binary.LittleEndian, &znacka); err != nil || string(znacka[:]) != znackaTextu {
		return nil, errors.New("textový model: neznámý soubor")
	}
	if binary.Read(r, binary.LittleEndian, &verze) != nil || verze != verzeTextu {
		return nil, errors.New("textový model: jiná verze")
	}
	maticeMapa := map[string]maticeInt8{}
	vektoryMapa := map[string][]float32{}
	matice, vektory := nazvyTextu()
	for _, n := range matice {
		var rozmer [2]uint32
		if err := binary.Read(r, binary.LittleEndian, &rozmer); err != nil {
			return nil, fmt.Errorf("textový model: %s: %w", n, err)
		}
		if rozmer[0] > 1<<17 || rozmer[1] > 1<<13 {
			return nil, fmt.Errorf("textový model: %s: nečekaný rozměr", n)
		}
		m := maticeInt8{int(rozmer[0]), int(rozmer[1]), make([]float32, rozmer[0]), make([]int8, int(rozmer[0])*int(rozmer[1]))}
		if err := binary.Read(r, binary.LittleEndian, m.meritka); err != nil {
			return nil, err
		}
		if err := binary.Read(r, binary.LittleEndian, m.data); err != nil {
			return nil, err
		}
		maticeMapa[n] = m
	}
	for _, n := range vektory {
		var delka uint32
		if err := binary.Read(r, binary.LittleEndian, &delka); err != nil || delka > 1<<13 {
			return nil, fmt.Errorf("textový model: %s", n)
		}
		x := make([]float32, delka)
		if err := binary.Read(r, binary.LittleEndian, x); err != nil {
			return nil, err
		}
		vektoryMapa[n] = x
	}
	t := &TextovyModel{
		slova:    maticeMapa["embeddings.word_embeddings.weight"],
		pozice:   maticeMapa["embeddings.position_embeddings.weight"],
		projekce: maticeMapa["linear.weight"],
		embNormG: vektoryMapa["embeddings.LayerNorm.gamma"],
		embNormB: vektoryMapa["embeddings.LayerNorm.beta"],
		pamet:    map[string][]float32{},
	}
	for l := range vrstevTextu {
		p := fmt.Sprintf("transformer.layer.%d.", l)
		t.vrstvy[l] = vrstvaTextu{
			qW:       maticeMapa[p+"attention.q_lin.weight"],
			qB:       vektoryMapa[p+"attention.q_lin.bias"],
			kW:       maticeMapa[p+"attention.k_lin.weight"],
			kB:       vektoryMapa[p+"attention.k_lin.bias"],
			vW:       maticeMapa[p+"attention.v_lin.weight"],
			vB:       vektoryMapa[p+"attention.v_lin.bias"],
			outW:     maticeMapa[p+"attention.out_lin.weight"],
			outB:     vektoryMapa[p+"attention.out_lin.bias"],
			saNormG:  vektoryMapa[p+"sa_layer_norm.weight"],
			saNormB:  vektoryMapa[p+"sa_layer_norm.bias"],
			ffn1W:    maticeMapa[p+"ffn.lin1.weight"],
			ffn1B:    vektoryMapa[p+"ffn.lin1.bias"],
			ffn2W:    maticeMapa[p+"ffn.lin2.weight"],
			ffn2B:    vektoryMapa[p+"ffn.lin2.bias"],
			outNormG: vektoryMapa[p+"output_layer_norm.weight"],
			outNormB: vektoryMapa[p+"output_layer_norm.bias"],
		}
	}
	if err := t.nacistSlovnik(filepath.Join(slozka, nazevTokenizeru)); err != nil {
		return nil, err
	}
	return t, nil
}

func (t *TextovyModel) nacistSlovnik(cesta string) error {
	data, err := os.ReadFile(cesta)
	if err != nil {
		return err
	}
	var tok struct {
		Model struct {
			Vocab map[string]int32 `json:"vocab"`
		} `json:"model"`
	}
	if err := json.Unmarshal(data, &tok); err != nil {
		return fmt.Errorf("tokenizér: %w", err)
	}
	t.slovnik = tok.Model.Vocab
	var ok1, ok2, ok3 bool
	t.unk, ok1 = t.slovnik["[UNK]"]
	t.cls, ok2 = t.slovnik["[CLS]"]
	t.sep, ok3 = t.slovnik["[SEP]"]
	if !ok1 || !ok2 || !ok3 || len(t.slovnik) != t.slova.radku {
		return errors.New("tokenizér nesedí k modelu")
	}
	return nil
}

// --- tokenizér BERT (bez převodu na malá písmena a bez odstranění diakritiky) + WordPiece ---

func interpunkce(r rune) bool {
	if (r >= 33 && r <= 47) || (r >= 58 && r <= 64) || (r >= 91 && r <= 96) || (r >= 123 && r <= 126) {
		return true
	}
	return unicode.IsPunct(r)
}

func cjk(r rune) bool {
	return (r >= 0x4E00 && r <= 0x9FFF) || (r >= 0x3400 && r <= 0x4DBF) || (r >= 0x20000 && r <= 0x2A6DF) ||
		(r >= 0x2A700 && r <= 0x2B73F) || (r >= 0x2B740 && r <= 0x2B81F) || (r >= 0x2B820 && r <= 0x2CEAF) ||
		(r >= 0xF900 && r <= 0xFAFF) || (r >= 0x2F800 && r <= 0x2FA1F)
}

// Slova po normalizaci a rozdělení (mezery, interpunkce a znaky CJK zvlášť)
func slovaBert(text string) []string {
	var slova []string
	var b strings.Builder
	konec := func() {
		if b.Len() > 0 {
			slova = append(slova, b.String())
			b.Reset()
		}
	}
	for _, r := range text {
		switch {
		case r == 0 || r == 0xFFFD || (unicode.IsControl(r) && r != '\t' && r != '\n' && r != '\r'):
			continue
		case unicode.IsSpace(r):
			konec()
		case interpunkce(r) || cjk(r):
			konec()
			slova = append(slova, string(r))
		default:
			b.WriteRune(r)
		}
	}
	konec()
	return slova
}

// Tokeny textu: [CLS] … [SEP], nejvýš maxTokenu
func (t *TextovyModel) Tokeny(text string) []int32 {
	v := make([]int32, 1, 16)
	v[0] = t.cls
	var hranice [101]int
	var castiBuf [100]int32
	var podretezec [404]byte
	podretezec[0], podretezec[1] = '#', '#'
	for _, slovo := range slovaBert(text) {
		if utf8.RuneCountInString(slovo) > 100 {
			v = append(v, t.unk)
			continue
		}
		nRun := 0
		for i := range slovo {
			hranice[nRun] = i
			nRun++
		}
		hranice[nRun] = len(slovo)
		casti := castiBuf[:0]
		for zacatek := 0; zacatek < nRun; {
			konec := nRun
			nalezeno := int32(-1)
			for ; konec > zacatek; konec-- {
				usek := slovo[hranice[zacatek]:hranice[konec]]
				if zacatek == 0 {
					if id, ok := t.slovnik[usek]; ok {
						nalezeno = id
						break
					}
				} else {
					n := 2 + copy(podretezec[2:], usek)
					if id, ok := t.slovnik[string(podretezec[:n])]; ok {
						nalezeno = id
						break
					}
				}
			}
			if nalezeno < 0 {
				casti = append(castiBuf[:0], t.unk)
				break
			}
			casti = append(casti, nalezeno)
			zacatek = konec
		}
		v = append(v, casti...)
		if len(v) >= maxTokenu-1 {
			v = v[:maxTokenu-1]
			break
		}
	}
	return append(v, t.sep)
}

// --- výpočet ---

func skalarInt8(xi []float32, w []int8) float32 {
	var s0, s1, s2, s3 float32
	k := 0
	for ; k+3 < len(w); k += 4 {
		s0 += xi[k] * float32(w[k])
		s1 += xi[k+1] * float32(w[k+1])
		s2 += xi[k+2] * float32(w[k+2])
		s3 += xi[k+3] * float32(w[k+3])
	}
	s := (s0 + s1) + (s2 + s3)
	for ; k < len(w); k++ {
		s += xi[k] * float32(w[k])
	}
	return s
}

// y[n×radku] = x[n×sloupcu] · Wᵀ + b, souběžně po řádcích matice
func (m maticeInt8) nasobit(x []float32, n int, b []float32) []float32 {
	return m.nasobitDo(nil, x, n, b)
}

func (m maticeInt8) nasobitDo(y, x []float32, n int, b []float32) []float32 {
	if cap(y) < n*m.radku {
		y = make([]float32, n*m.radku)
	} else {
		y = y[:n*m.radku]
	}
	vlaken := min(runtime.NumCPU(), 8, max(1, n*m.radku/1024))
	if vlaken <= 1 {
		for j := range m.radku {
			w := m.data[j*m.sloupcu : (j+1)*m.sloupcu]
			mer := m.meritka[j]
			var bj float32
			if b != nil {
				bj = b[j]
			}
			for i := range n {
				xi := x[i*m.sloupcu : (i+1)*m.sloupcu]
				y[i*m.radku+j] = skalarInt8(xi, w)*mer + bj
			}
		}
		return y
	}
	var wg sync.WaitGroup
	for c := range vlaken {
		wg.Go(func() {
			for j := c * m.radku / vlaken; j < (c+1)*m.radku/vlaken; j++ {
				w := m.data[j*m.sloupcu : (j+1)*m.sloupcu]
				mer := m.meritka[j]
				var bj float32
				if b != nil {
					bj = b[j]
				}
				for i := range n {
					xi := x[i*m.sloupcu : (i+1)*m.sloupcu]
					y[i*m.radku+j] = skalarInt8(xi, w)*mer + bj
				}
			}
		})
	}
	wg.Wait()
	return y
}

func (m maticeInt8) pridatRadek(i int, cil []float32) {
	mer := m.meritka[i]
	for k, q := range m.data[i*m.sloupcu : (i+1)*m.sloupcu] {
		cil[k] += float32(q) * mer
	}
}

func normalizovatVrstvou(x []float32, n int, g, b []float32) {
	for i := range n {
		r := x[i*dimTextu : (i+1)*dimTextu]
		var prumer, rozptyl float64
		for _, v := range r {
			prumer += float64(v)
		}
		prumer /= dimTextu
		for _, v := range r {
			d := float64(v) - prumer
			rozptyl += d * d
		}
		rozptyl /= dimTextu
		k := 1 / math.Sqrt(rozptyl+1e-12)
		for j, v := range r {
			r[j] = float32((float64(v)-prumer)*k)*g[j] + b[j]
		}
	}
}

type pracovniText struct {
	x, q, k, v, pozornost, kontext, skryta, vystup []float32
	skore                                          []float64
}

var textPracovniPool = sync.Pool{
	New: func() any {
		return &pracovniText{
			x:         make([]float32, 0, 16*dimTextu),
			q:         make([]float32, 0, 16*dimTextu),
			k:         make([]float32, 0, 16*dimTextu),
			v:         make([]float32, 0, 16*dimTextu),
			pozornost: make([]float32, 0, 16*dimTextu),
			kontext:   make([]float32, 0, 16*dimTextu),
			skryta:    make([]float32, 0, 16*4*dimTextu),
			vystup:    make([]float32, 0, 16*dimTextu),
			skore:     make([]float64, 0, 16),
		}
	},
}

func zajistitFloat32(s []float32, n int) []float32 {
	if cap(s) < n {
		return make([]float32, n)
	}
	s = s[:n]
	clear(s)
	return s
}

// Vektor textu délky 1 (512 čísel); nil pro prázdný text
func (t *TextovyModel) Vektor(text string) []float32 {
	text = strings.TrimSpace(text)
	if t == nil || text == "" {
		return nil
	}
	t.mu.Lock()
	if v, ok := t.pamet[text]; ok {
		t.mu.Unlock()
		return append([]float32(nil), v...)
	}
	t.mu.Unlock()
	tokeny := t.Tokeny(text)
	n := len(tokeny)
	buf := textPracovniPool.Get().(*pracovniText)
	defer textPracovniPool.Put(buf)
	x := zajistitFloat32(buf.x, n*dimTextu)
	kontext := zajistitFloat32(buf.kontext, n*dimTextu)
	if cap(buf.skore) < n {
		buf.skore = make([]float64, n)
	}
	skore := buf.skore[:n]
	for i, id := range tokeny {
		radek := x[i*dimTextu : (i+1)*dimTextu]
		t.slova.pridatRadek(int(id), radek)
		t.pozice.pridatRadek(i, radek)
	}
	normalizovatVrstvou(x, n, t.embNormG, t.embNormB)
	const dimHlavy = dimTextu / hlavTextu
	const meritkoHlavy = 1.0 / 8.0 // 1 / √dimHlavy (dimHlavy = 64)
	q, k, v := buf.q, buf.k, buf.v
	pozornost, skryta, vystup := buf.pozornost, buf.skryta, buf.vystup
	for l := range vrstevTextu {
		vr := &t.vrstvy[l]
		q = vr.qW.nasobitDo(q, x, n, vr.qB)
		k = vr.kW.nasobitDo(k, x, n, vr.kB)
		v = vr.vW.nasobitDo(v, x, n, vr.vB)
		clear(kontext)
		for h := range hlavTextu {
			o := h * dimHlavy
			for i := range n {
				qi := q[i*dimTextu+o : i*dimTextu+o+dimHlavy]
				nej := math.Inf(-1)
				for j := range n {
					kj := k[j*dimTextu+o : j*dimTextu+o+dimHlavy]
					var s float32
					for d := range dimHlavy {
						s += qi[d] * kj[d]
					}
					sk := float64(s) * meritkoHlavy
					skore[j] = sk
					if sk > nej {
						nej = sk
					}
				}
				var soucet float64
				for j := range n {
					e := math.Exp(skore[j] - nej)
					skore[j] = e
					soucet += e
				}
				ki := kontext[i*dimTextu+o : i*dimTextu+o+dimHlavy]
				invSoucet := 1 / soucet
				for j := range n {
					w := float32(skore[j] * invSoucet)
					vj := v[j*dimTextu+o : j*dimTextu+o+dimHlavy]
					for d := range dimHlavy {
						ki[d] += w * vj[d]
					}
				}
			}
		}
		pozornost = vr.outW.nasobitDo(pozornost, kontext, n, vr.outB)
		for i := range x {
			x[i] += pozornost[i]
		}
		normalizovatVrstvou(x, n, vr.saNormG, vr.saNormB)
		skryta = vr.ffn1W.nasobitDo(skryta, x, n, vr.ffn1B)
		for i, a := range skryta {
			skryta[i] = float32(0.5 * float64(a) * (1 + math.Erf(float64(a)/math.Sqrt2)))
		}
		vystup = vr.ffn2W.nasobitDo(vystup, skryta, n, vr.ffn2B)
		for i := range x {
			x[i] += vystup[i]
		}
		normalizovatVrstvou(x, n, vr.outNormG, vr.outNormB)
	}
	buf.x, buf.q, buf.k, buf.v = x, q, k, v
	buf.pozornost, buf.kontext, buf.skryta, buf.vystup = pozornost, kontext, skryta, vystup
	var prumer [dimTextu]float32
	invN := 1 / float32(n)
	for i := range n {
		xi := x[i*dimTextu : (i+1)*dimTextu]
		for d := range dimTextu {
			prumer[d] += xi[d] * invN
		}
	}
	vektor := t.projekce.nasobit(prumer[:], 1, nil)
	if !Normalizovat(vektor) {
		return nil
	}
	t.mu.Lock()
	if len(t.pamet) > 200 {
		t.pamet = map[string][]float32{}
	}
	t.pamet[text] = vektor
	t.mu.Unlock()
	return append([]float32(nil), vektor...)
}
