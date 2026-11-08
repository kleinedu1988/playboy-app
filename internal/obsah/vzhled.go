package obsah

// Vzhled fotek (barvy a kvalita snímku, docs/NAVRH-GALERIE-KOLEKCE.md, ML #2) v souboru obsah/vzhled.bin vedle
// vektorů: pro každou fotku 18 bajtů spočítaných přímo z náhledu w400 bez modelu – podíly 12 odstínů mezi
// barevnými body, barevnost, jas, sytost, teplota, kontrast a ostrost (rozptyl laplaciánu). Podklad pro kolekce
// „V červené“, „Pastelové“, „Teplé tóny“, „Nejostřejší“ a podobné.
//
// Formát: "PBVZHLED" | verze uint16 | délka záznamu uint16 | počet uint32 |
// záznamy: délka ID uint8 | ID | délka záznamu × uint8.

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"io"
	"math"
	"os"
	"path/filepath"
	"sync"

	"golang.org/x/image/draw"
)

const (
	nazevVzhledu  = "vzhled.bin"
	znackaVzhledu = "PBVZHLED"
	verzeVzhledu  = 1
	Odstinu       = 12 // po 30°, první červená (345–15°)
	delkaVzhledu  = Odstinu + 6
)

// Vzhled jedné fotky (vše 0–1)
type VzhledFotky struct {
	Odstiny   [Odstinu]float64 // podíl odstínu mezi barevnými body (sytost ≥ 0,4, jas ≥ 0,25)
	Barevnost float64          // podíl barevných bodů v celé fotce
	Jas       float64          // průměrný jas
	Sytost    float64          // průměrná sytost
	Teplota   float64          // 0,5 neutrální, víc teplé (červená nad modrou), míň chladné
	Kontrast  float64          // směrodatná odchylka jasu (×2)
	Ostrost   float64          // log rozptylu laplaciánu jasu (ostré hrany a detail)
}

// SpocitatVzhled z obrázku (JPEG, PNG, GIF, WebP); náhled se pro výpočet zmenší na nejvýš 256 bodů na šířku
func SpocitatVzhled(obrazek []byte) (VzhledFotky, error) {
	img, _, err := image.Decode(bytes.NewReader(obrazek))
	if err != nil {
		return VzhledFotky{}, fmt.Errorf("obrázek: %w", err)
	}
	return vzhledObrazku(img), nil
}

func vzhledObrazku(img image.Image) VzhledFotky {
	b := img.Bounds()
	s, v := b.Dx(), b.Dy()
	if s > 256 {
		s, v = 256, max(1, v*256/b.Dx())
	}
	m := image.NewRGBA(image.Rect(0, 0, s, v))
	draw.ApproxBiLinear.Scale(m, m.Bounds(), img, b, draw.Src, nil)
	var vz VzhledFotky
	jas := make([]float64, s*v)
	var soucetJasu, soucetCtvercu, soucetSytosti, teplota float64
	barevnych := 0
	for p := range s * v {
		r, g, bl := float64(m.Pix[p*4])/255, float64(m.Pix[p*4+1])/255, float64(m.Pix[p*4+2])/255
		y := 0.299*r + 0.587*g + 0.114*bl
		jas[p] = y
		soucetJasu += y
		soucetCtvercu += y * y
		teplota += r - bl
		mx, mn := math.Max(r, math.Max(g, bl)), math.Min(r, math.Min(g, bl))
		sytost := 0.0
		if mx > 0 {
			sytost = (mx - mn) / mx
		}
		soucetSytosti += sytost
		if sytost < 0.4 || mx < 0.25 {
			continue
		}
		var h float64 // odstín 0–360
		switch mx {
		case r:
			h = math.Mod((g-bl)/(mx-mn), 6) * 60
		case g:
			h = ((bl-r)/(mx-mn) + 2) * 60
		default:
			h = ((r-g)/(mx-mn) + 4) * 60
		}
		if h < 0 {
			h += 360
		}
		vz.Odstiny[int(math.Mod(h+15, 360)/30)%Odstinu]++
		barevnych++
	}
	n := float64(s * v)
	if barevnych > 0 {
		for i := range vz.Odstiny {
			vz.Odstiny[i] /= float64(barevnych)
		}
	}
	vz.Barevnost = float64(barevnych) / n
	vz.Jas = soucetJasu / n
	vz.Sytost = soucetSytosti / n
	vz.Teplota = min(max(0.5+teplota/n, 0), 1)
	vz.Kontrast = min(math.Sqrt(math.Max(0, soucetCtvercu/n-vz.Jas*vz.Jas))*2, 1)
	// Ostrost: rozptyl laplaciánu (0–255 škála jasu), log10 / 4 → 0–1
	var lap, lap2 float64
	k := 0
	for y := 1; y < v-1; y++ {
		for x := 1; x < s-1; x++ {
			p := y*s + x
			l := (4*jas[p] - jas[p-1] - jas[p+1] - jas[p-s] - jas[p+s]) * 255
			lap += l
			lap2 += l * l
			k++
		}
	}
	if k > 0 {
		rozptyl := math.Max(0, lap2/float64(k)-(lap/float64(k))*(lap/float64(k)))
		vz.Ostrost = min(math.Log10(1+rozptyl)/4, 1)
	}
	return vz
}

func (vz VzhledFotky) bajty() []uint8 {
	b := make([]uint8, delkaVzhledu)
	for i, x := range vz.Odstiny {
		b[i] = bajt(x)
	}
	for i, x := range []float64{vz.Barevnost, vz.Jas, vz.Sytost, vz.Teplota, vz.Kontrast, vz.Ostrost} {
		b[Odstinu+i] = bajt(x)
	}
	return b
}

func bajt(x float64) uint8 { return uint8(min(max(x, 0), 1)*255 + 0.5) }

func vzhledZBajtu(b []uint8) VzhledFotky {
	var vz VzhledFotky
	for i := range vz.Odstiny {
		vz.Odstiny[i] = float64(b[i]) / 255
	}
	for i, x := range []*float64{&vz.Barevnost, &vz.Jas, &vz.Sytost, &vz.Teplota, &vz.Kontrast, &vz.Ostrost} {
		*x = float64(b[Odstinu+i]) / 255
	}
	return vz
}

// Vzhled fotek v paměti
type Vzhled struct {
	mu      sync.RWMutex
	m       map[string][]uint8
	zmeneno bool
}

func NovyVzhled() *Vzhled { return &Vzhled{m: map[string][]uint8{}} }

func (v *Vzhled) Ma(id string) bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	_, ok := v.m[id]
	return ok
}

func (v *Vzhled) Pocet() int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.m)
}

func (v *Vzhled) Pridat(id string, vz VzhledFotky) {
	if id == "" || len(id) > 255 {
		return
	}
	v.mu.Lock()
	v.m[id] = vz.bajty()
	v.zmeneno = true
	v.mu.Unlock()
}

// Fotky: vzhled fotky a jestli ho má
func (v *Vzhled) Fotky(id string) (VzhledFotky, bool) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	b, ok := v.m[id]
	if !ok {
		return VzhledFotky{}, false
	}
	return vzhledZBajtu(b), true
}

// Vse: vzhled všech fotek (pro kolekce)
func (v *Vzhled) Vse() map[string]VzhledFotky {
	v.mu.RLock()
	defer v.mu.RUnlock()
	x := make(map[string]VzhledFotky, len(v.m))
	for id, b := range v.m {
		x[id] = vzhledZBajtu(b)
	}
	return x
}

func (v *Vzhled) Ponechat(platne func(id string) bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	for id := range v.m {
		if !platne(id) {
			delete(v.m, id)
			v.zmeneno = true
		}
	}
}

// NacistVzhled: chybějící soubor nebo jiná verze = prázdný, poškozený = chyba a prázdný
func NacistVzhled(slozka string) (*Vzhled, error) {
	v := NovyVzhled()
	f, err := os.Open(filepath.Join(slozka, nazevVzhledu))
	if errors.Is(err, os.ErrNotExist) {
		return v, nil
	}
	if err != nil {
		return v, err
	}
	defer f.Close()
	r := bufio.NewReaderSize(f, 1<<16)
	var h struct {
		Znacka [8]byte
		Verze  uint16
		Delka  uint16
		Pocet  uint32
	}
	if err := binary.Read(r, binary.LittleEndian, &h); err != nil {
		return v, fmt.Errorf("vzhled: hlavička: %w", err)
	}
	if string(h.Znacka[:]) != znackaVzhledu {
		return v, errors.New("vzhled: neznámý soubor")
	}
	if h.Verze != verzeVzhledu || h.Delka != delkaVzhledu {
		return v, nil
	}
	if h.Pocet > 10_000_000 {
		return v, errors.New("vzhled: nečekaný počet záznamů")
	}
	idBuf := make([]byte, 255)
	for i := range int(h.Pocet) {
		delka, err := r.ReadByte()
		b := make([]uint8, delkaVzhledu)
		if err == nil {
			_, err = io.ReadFull(r, idBuf[:delka])
		}
		if err == nil {
			_, err = io.ReadFull(r, b)
		}
		if err != nil {
			return NovyVzhled(), fmt.Errorf("vzhled: záznam %d: %w", i, err)
		}
		v.m[string(idBuf[:delka])] = b
	}
	return v, nil
}

// Ulozit přes dočasný soubor a přejmenování; bez změny nic nedělá
func (v *Vzhled) Ulozit(slozka string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if !v.zmeneno {
		return nil
	}
	if err := os.MkdirAll(slozka, 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(slozka, ".vzhled-*")
	if err != nil {
		return err
	}
	docasny := f.Name()
	w := bufio.NewWriterSize(f, 1<<16)
	for _, x := range []any{[]byte(znackaVzhledu), uint16(verzeVzhledu), uint16(delkaVzhledu), uint32(len(v.m))} {
		binary.Write(w, binary.LittleEndian, x)
	}
	for id, b := range v.m {
		w.WriteByte(byte(len(id)))
		w.WriteString(id)
		w.Write(b)
	}
	err = w.Flush()
	if err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Chmod(docasny, 0o600)
	}
	if err == nil {
		err = os.Rename(docasny, filepath.Join(slozka, nazevVzhledu))
	}
	if err != nil {
		os.Remove(docasny)
		return err
	}
	v.zmeneno = false
	return nil
}

func SmazatVzhled(slozka string) error {
	err := os.Remove(filepath.Join(slozka, nazevVzhledu))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
