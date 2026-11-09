package main

// Perceptuální otisky fotek (Údržba › Stejné fotky, stejne_fotky.go): 64bitový dHash a pHash z náhledu w400.
// Stejná fotka nahraná na Disk víckrát (jiné ID souboru), přeuložená nebo zmenšená má otisky shodné nebo
// skoro shodné (Hammingova vzdálenost v řádu jednotek), jiná fotka se liší zhruba v polovině bitů.
// Otisky se počítají na pozadí (náhledy přes mezipaměť, ohleduplně k oknu jako stahování na pozadí) a ukládají
// do souboru otisky.bin vedle mezipaměti náhledů; databáze sbírky ani export se nemění.

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"math/bits"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	_ "golang.org/x/image/webp"

	"playboy-app/internal/nahledy"
)

// Otisk fotky: rozdílový (dHash, 9 × 8 jasů, soused vpravo světlejší) a frekvenční (pHash, nejnižší frekvence
// DCT 32 × 32 nad mediánem)
type otisk struct {
	d, p uint64
}

// Vzdálenost otisků: počet rozdílných bitů dHash a pHash
func (o otisk) vzdalenost(x otisk) (int, int) {
	return bits.OnesCount64(o.d ^ x.d), bits.OnesCount64(o.p ^ x.p)
}

const strana = 32

// Kosiny DCT-II pro 32 bodů, jen prvních 8 frekvencí (víc pHash nepotřebuje)
var kosinyDCT = func() [8][strana]float64 {
	var c [8][strana]float64
	for u := 0; u < 8; u++ {
		for x := 0; x < strana; x++ {
			c[u][x] = math.Cos(float64(2*x+1) * float64(u) * math.Pi / (2 * strana))
		}
	}
	return c
}()

// spocitatOtisk: jasy obrázku zprůměrované do mřížky 32 × 32 (pHash) a 9 × 8 (dHash) v jednom průchodu pixely
func spocitatOtisk(img image.Image) (otisk, bool) {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w < 9 || h < 8 {
		return otisk{}, false
	}
	var m32 [strana * strana]float64
	var n32 [strana * strana]int
	var m9 [9 * 8]float64
	var n9 [9 * 8]int
	pridat := func(x, y int, jas float64) {
		i := (y*strana/h)*strana + x*strana/w
		m32[i] += jas
		n32[i]++
		j := (y*8/h)*9 + x*9/w
		m9[j] += jas
		n9[j]++
	}
	// JPEG (YCbCr): jas je rovnou rovina Y; jinak převod na šedou
	if yc, ok := img.(*image.YCbCr); ok {
		for y := 0; y < h; y++ {
			radek := yc.Y[(y+b.Min.Y-yc.Rect.Min.Y)*yc.YStride+(b.Min.X-yc.Rect.Min.X):]
			for x := 0; x < w; x++ {
				pridat(x, y, float64(radek[x]))
			}
		}
	} else {
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				pridat(x, y, float64(color.GrayModel.Convert(img.At(b.Min.X+x, b.Min.Y+y)).(color.Gray).Y))
			}
		}
	}
	for i := range m32 {
		if n32[i] > 0 {
			m32[i] /= float64(n32[i])
		}
	}
	for i := range m9 {
		if n9[i] > 0 {
			m9[i] /= float64(n9[i])
		}
	}

	var o otisk
	for r := 0; r < 8; r++ {
		for c := 0; c < 8; c++ {
			if m9[r*9+c] < m9[r*9+c+1] {
				o.d |= 1 << uint(r*8+c)
			}
		}
	}

	// DCT-II po řádcích (jen 8 frekvencí) a pak po sloupcích
	var radky [strana][8]float64
	for y := 0; y < strana; y++ {
		for u := 0; u < 8; u++ {
			var s float64
			for x := 0; x < strana; x++ {
				s += m32[y*strana+x] * kosinyDCT[u][x]
			}
			radky[y][u] = s
		}
	}
	var koef [64]float64
	for v := 0; v < 8; v++ {
		for u := 0; u < 8; u++ {
			var s float64
			for y := 0; y < strana; y++ {
				s += radky[y][u] * kosinyDCT[v][y]
			}
			koef[v*8+u] = s
		}
	}
	// Medián bez stejnosměrné složky (ta říká jen celkový jas)
	serazene := make([]float64, 63)
	copy(serazene, koef[1:])
	sort.Float64s(serazene)
	median := (serazene[31] + serazene[32]) / 2
	for i := 1; i < 64; i++ {
		if koef[i] > median {
			o.p |= 1 << uint(i)
		}
	}
	return o, true
}

func otiskZDat(data []byte) (otisk, bool) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return otisk{}, false
	}
	return spocitatOtisk(img)
}

// ——— Uložené otisky a výpočet na pozadí ———

type otiskyFotek struct {
	mu      sync.Mutex
	m       map[string]otisk
	chybne  map[string]bool // soubory, ze kterých otisk nešel spočítat (v tomto spuštění se nezkouší znovu)
	nacteno bool
	zmeneno bool
	cesta   string // soubor otisků; "" = jen v paměti (testy, bez mezipaměti náhledů)
	bezi    bool
	zrusit  context.CancelFunc
	konec   chan struct{}
	// náhled w400 souboru; v aplikaci z mezipaměti náhledů (ohleduplně k oknu), v testech náhrada
	nahled func(ctx context.Context, id string) ([]byte, error)
}

var zamekOtisku sync.Mutex

func (a *App) otisky() *otiskyFotek {
	zamekOtisku.Lock()
	defer zamekOtisku.Unlock()
	if a.otiskyFotek == nil {
		o := &otiskyFotek{m: map[string]otisk{}, chybne: map[string]bool{}}
		if a.nahledy != nil {
			if slozka := nahledy.Slozka(); slozka != "" {
				o.cesta = filepath.Join(filepath.Dir(slozka), "otisky.bin")
			}
			o.nahled = func(ctx context.Context, id string) ([]byte, error) { return a.nahledy.Nacist(ctx, id, "w400") }
		}
		a.otiskyFotek = o
	}
	return a.otiskyFotek
}

const hlavickaOtisku = "OTISKY1\n"

// Načtení souboru otisků (jednou); poškozený nebo cizí soubor se ignoruje a otisky se spočítají znovu
func (o *otiskyFotek) nacistZamceno() {
	if o.nacteno {
		return
	}
	o.nacteno = true
	if o.cesta == "" {
		return
	}
	f, err := os.Open(o.cesta)
	if err != nil {
		return
	}
	defer f.Close()
	r := bufio.NewReader(f)
	hlavicka := make([]byte, len(hlavickaOtisku))
	if _, err := io.ReadFull(r, hlavicka); err != nil || string(hlavicka) != hlavickaOtisku {
		return
	}
	var pocet uint32
	if binary.Read(r, binary.LittleEndian, &pocet) != nil {
		return
	}
	nove := make(map[string]otisk, pocet)
	for i := uint32(0); i < pocet; i++ {
		delka, err := r.ReadByte()
		if err != nil {
			return
		}
		id := make([]byte, delka)
		if _, err := io.ReadFull(r, id); err != nil {
			return
		}
		var x [2]uint64
		if binary.Read(r, binary.LittleEndian, &x) != nil {
			return
		}
		nove[string(id)] = otisk{d: x[0], p: x[1]}
	}
	for id, x := range nove {
		if _, uz := o.m[id]; !uz {
			o.m[id] = x
		}
	}
}

// Uložení do souboru (přes dočasný soubor, aby přerušený zápis nepoškodil uložené otisky)
func (o *otiskyFotek) ulozitZamceno() error {
	if o.cesta == "" || !o.zmeneno {
		return nil
	}
	ids := make([]string, 0, len(o.m))
	for id := range o.m {
		if len(id) <= 255 {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	var buf bytes.Buffer
	buf.WriteString(hlavickaOtisku)
	binary.Write(&buf, binary.LittleEndian, uint32(len(ids)))
	for _, id := range ids {
		x := o.m[id]
		buf.WriteByte(byte(len(id)))
		buf.WriteString(id)
		binary.Write(&buf, binary.LittleEndian, [2]uint64{x.d, x.p})
	}
	if err := os.MkdirAll(filepath.Dir(o.cesta), 0o700); err != nil {
		return err
	}
	docasny := o.cesta + ".tmp"
	if err := os.WriteFile(docasny, buf.Bytes(), 0o600); err != nil {
		return err
	}
	if err := os.Rename(docasny, o.cesta); err != nil {
		return err
	}
	o.zmeneno = false
	return nil
}

// Otisky souborů (kopie pro výpočet skupin bez držení zámku)
func (a *App) otiskySouboru() map[string]otisk {
	o := a.otisky()
	o.mu.Lock()
	defer o.mu.Unlock()
	o.nacistZamceno()
	kopie := make(map[string]otisk, len(o.m))
	for id, x := range o.m {
		kopie[id] = x
	}
	return kopie
}

func (a *App) ulozitOtisk(id string, x otisk) {
	o := a.otisky()
	o.mu.Lock()
	o.nacistZamceno()
	o.m[id] = x
	o.zmeneno = true
	o.mu.Unlock()
}

// Otisk jednoho souboru hned (kontrola nově vložených fotek); z paměti, nebo z náhledu
func (a *App) otiskSouboru(ctx context.Context, id string) (otisk, bool) {
	o := a.otisky()
	o.mu.Lock()
	o.nacistZamceno()
	x, ok := o.m[id]
	nahled := o.nahled
	o.mu.Unlock()
	if ok {
		return x, true
	}
	if nahled == nil {
		return otisk{}, false
	}
	data, err := nahled(ctx, id)
	if err != nil {
		return otisk{}, false
	}
	if x, ok = otiskZDat(data); ok {
		a.ulozitOtisk(id, x)
	}
	return x, ok
}

// StavOtisku: kolik fotek sbírky (různých souborů) už otisk má a jestli výpočet běží
type StavOtisku struct {
	Bezi   bool `json:"bezi"`
	Hotovo int  `json:"hotovo"`
	Celkem int  `json:"celkem"`
	Chybne int  `json:"chybne"`
}

func (a *App) GetStavOtisku() StavOtisku {
	ids, _ := a.fotkyProObsah()
	o := a.otisky()
	o.mu.Lock()
	defer o.mu.Unlock()
	o.nacistZamceno()
	st := StavOtisku{Bezi: o.bezi, Celkem: len(ids)}
	for _, id := range ids {
		if _, ok := o.m[id]; ok {
			st.Hotovo++
		} else if o.chybne[id] {
			st.Chybne++
		}
	}
	return st
}

// SpustitOtisky: výpočet otisků fotek, které je ještě nemají, na pozadí; false = nejde (bez náhledů) nebo už běží
func (a *App) SpustitOtisky() bool {
	o := a.otisky()
	o.mu.Lock()
	if o.bezi || o.nahled == nil {
		o.mu.Unlock()
		return false
	}
	ctx, zrusit := context.WithCancel(context.Background())
	o.bezi, o.zrusit, o.konec = true, zrusit, make(chan struct{})
	konec := o.konec
	o.mu.Unlock()
	go func() {
		defer close(konec)
		a.pocitatOtisky(ctx)
		o.mu.Lock()
		o.bezi, o.zrusit = false, nil
		if err := o.ulozitZamceno(); err != nil {
			a.chyba("uložení otisků fotek", err)
		}
		o.mu.Unlock()
	}()
	return true
}

// Zastavení výpočtu (zavření programu); rozpočítané otisky se uloží
func (a *App) zastavitOtisky() {
	if a.otiskyFotek == nil {
		return
	}
	o := a.otiskyFotek
	o.mu.Lock()
	zrusit, konec := o.zrusit, o.konec
	o.mu.Unlock()
	if zrusit == nil {
		return
	}
	zrusit()
	select {
	case <-konec:
	case <-time.After(3 * time.Second):
	}
}

const ukladatOtiskyPo = 200

func (a *App) pocitatOtisky(ctx context.Context) {
	ids, err := a.fotkyProObsah()
	if err != nil {
		a.chyba("výpočet otisků fotek", err)
		return
	}
	o := a.otisky()
	o.mu.Lock()
	o.nacistZamceno()
	chybi := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, ok := o.m[id]; !ok && !o.chybne[id] {
			chybi = append(chybi, id)
		}
	}
	nahled := o.nahled
	o.mu.Unlock()
	for i, id := range chybi {
		if ctx.Err() != nil {
			return
		}
		data, err := nahled(ctx, id)
		if err != nil {
			if ctx.Err() != nil || errors.Is(err, context.Canceled) {
				return
			}
			o.mu.Lock()
			o.chybne[id] = true
			o.mu.Unlock()
			continue
		}
		x, ok := otiskZDat(data)
		o.mu.Lock()
		if ok {
			o.m[id] = x
			o.zmeneno = true
		} else {
			o.chybne[id] = true
		}
		if (i+1)%ukladatOtiskyPo == 0 {
			if err := o.ulozitZamceno(); err != nil {
				a.chyba("uložení otisků fotek", err)
			}
		}
		o.mu.Unlock()
	}
}
