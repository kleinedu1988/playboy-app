package obsah

// Výřezy fotek z detektoru (0.02.049, Chytrý výřez náhledů) v souboru obsah/vyrezy.bin vedle partií: pro každou
// fotku rámeček celé postavy (sjednocení ženských tříd) a rámeček obličeje s nejvyšší jistotou, souřadnice jako
// podíl strany obrázku v bajtu (0–255). Z rámečků se pro každý tvar rámu (dlaždice, hero, karta) spočítá bod zájmu
// a přiblížení (NavrhVyrezu). Hlavička nese hash detektoru: z jiného se spočítá znovu.
//
// Formát: "PBVYREZY" | verze uint16 | hash detektoru 64 B | počet uint32 |
// záznamy: délka ID uint8 | ID | postava 4 × uint8 (x0, y0, x1, y1) | obličej 4 × uint8 | příznaky uint8.

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

const (
	nazevVyrezu  = "vyrezy.bin"
	znackaVyrezu = "PBVYREZY"
	verzeVyrezu  = 1

	vyrezPostava = 1 << iota // fotka má rámeček postavy
	vyrezOblicej             // fotka má rámeček obličeje
)

type zaznamVyrezu struct {
	postava, oblicej [4]uint8
	priznaky         uint8
}

// Vyrezy fotek v paměti
type Vyrezy struct {
	mu      sync.RWMutex
	m       map[string]zaznamVyrezu
	zmeneno bool
}

func NoveVyrezy() *Vyrezy { return &Vyrezy{m: map[string]zaznamVyrezu{}} }

func (v *Vyrezy) Ma(id string) bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	_, ok := v.m[id]
	return ok
}

func (v *Vyrezy) Pocet() int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.m)
}

// Pridat uloží rámečky z boxů detektoru (BoxyObrazku); bez boxů zapíše, že postava na fotce není
func (v *Vyrezy) Pridat(id string, boxy []Box) {
	if id == "" || len(id) > 255 {
		return
	}
	var z zaznamVyrezu
	x0, y0, x1, y1 := 1.0, 1.0, 0.0, 0.0
	var oblicej *Box
	for i, b := range boxy {
		x0, y0 = min(x0, b.X), min(y0, b.Y)
		x1, y1 = max(x1, b.X+b.S), max(y1, b.Y+b.V)
		if b.Trida == indexObliceje && (oblicej == nil || b.Jistota > oblicej.Jistota) {
			oblicej = &boxy[i]
		}
	}
	if len(boxy) > 0 && x1 > x0 && y1 > y0 {
		z.postava = [4]uint8{bajt(x0), bajt(y0), bajt(x1), bajt(y1)}
		z.priznaky |= vyrezPostava
	}
	if oblicej != nil {
		z.oblicej = [4]uint8{bajt(oblicej.X), bajt(oblicej.Y), bajt(oblicej.X + oblicej.S), bajt(oblicej.Y + oblicej.V)}
		z.priznaky |= vyrezOblicej
	}
	v.mu.Lock()
	v.m[id] = z
	v.zmeneno = true
	v.mu.Unlock()
}

// RamecekFotky: rámečky postavy a obličeje fotky jako podíl strany obrázku (0–1)
type RamecekFotky struct {
	Postava, Oblicej     [4]float64 // x0, y0, x1, y1
	MaPostavu, MaOblicej bool
}

// Ramecek fotky; ok = false, když fotka ještě spočítaná není (jinak ok i bez postavy)
func (v *Vyrezy) Ramecek(id string) (RamecekFotky, bool) {
	v.mu.RLock()
	z, ok := v.m[id]
	v.mu.RUnlock()
	if !ok {
		return RamecekFotky{}, false
	}
	var r RamecekFotky
	for i := range 4 {
		r.Postava[i] = float64(z.postava[i]) / 255
		r.Oblicej[i] = float64(z.oblicej[i]) / 255
	}
	r.MaPostavu, r.MaOblicej = z.priznaky&vyrezPostava != 0, z.priznaky&vyrezOblicej != 0
	return r, true
}

// VyrezRamu: výřez fotky s poměrem stran pomerObrazku pro rám s poměrem pomerRamu (šířka/výška) jako u titulní
// fotky (NavrhVyrezu: přiblížení a poloha 0–100 %, obličej v horní části rámu). ok = false bez postavy.
func (r RamecekFotky) VyrezRamu(pomerObrazku, pomerRamu float64) (Vyrez, bool) {
	if !r.MaPostavu {
		return Vyrez{Zoom: 1, X: 50, Y: 50}, false
	}
	p := r.Postava
	boxy := []Box{{X: p[0], Y: p[1], S: p[2] - p[0], V: p[3] - p[1], Trida: -1}}
	if r.MaOblicej {
		o := r.Oblicej
		boxy = append(boxy, Box{X: o[0], Y: o[1], S: o[2] - o[0], V: o[3] - o[1], Trida: indexObliceje})
	}
	return NavrhVyrezu(boxy, pomerObrazku, pomerRamu)
}

func (v *Vyrezy) Ponechat(platne func(id string) bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	for id := range v.m {
		if !platne(id) {
			delete(v.m, id)
			v.zmeneno = true
		}
	}
}

// NacistVyrezy: chybějící soubor nebo jiný detektor = prázdné, poškozený = chyba a prázdné
func NacistVyrezy(slozka string) (*Vyrezy, error) {
	v := NoveVyrezy()
	f, err := os.Open(filepath.Join(slozka, nazevVyrezu))
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
		Hash   [64]byte
		Pocet  uint32
	}
	if err := binary.Read(r, binary.LittleEndian, &h); err != nil {
		return v, fmt.Errorf("výřezy: hlavička: %w", err)
	}
	if string(h.Znacka[:]) != znackaVyrezu {
		return v, errors.New("výřezy: neznámý soubor")
	}
	if h.Verze != verzeVyrezu || string(h.Hash[:]) != hashDetektoru {
		return v, nil
	}
	if h.Pocet > 10_000_000 {
		return v, errors.New("výřezy: nečekaný počet záznamů")
	}
	idBuf := make([]byte, 255)
	var b [9]byte
	for i := range int(h.Pocet) {
		delka, err := r.ReadByte()
		if err == nil {
			_, err = io.ReadFull(r, idBuf[:delka])
		}
		if err == nil {
			_, err = io.ReadFull(r, b[:])
		}
		if err != nil {
			return NoveVyrezy(), fmt.Errorf("výřezy: záznam %d: %w", i, err)
		}
		var z zaznamVyrezu
		copy(z.postava[:], b[0:4])
		copy(z.oblicej[:], b[4:8])
		z.priznaky = b[8]
		v.m[string(idBuf[:delka])] = z
	}
	return v, nil
}

// Ulozit přes dočasný soubor a přejmenování; bez změny nic nedělá
func (v *Vyrezy) Ulozit(slozka string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if !v.zmeneno {
		return nil
	}
	if err := os.MkdirAll(slozka, 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(slozka, ".vyrezy-*")
	if err != nil {
		return err
	}
	docasny := f.Name()
	w := bufio.NewWriterSize(f, 1<<16)
	var hash [64]byte
	copy(hash[:], hashDetektoru)
	for _, x := range []any{[]byte(znackaVyrezu), uint16(verzeVyrezu), hash, uint32(len(v.m))} {
		binary.Write(w, binary.LittleEndian, x)
	}
	for id, z := range v.m {
		w.WriteByte(byte(len(id)))
		w.WriteString(id)
		w.Write(z.postava[:])
		w.Write(z.oblicej[:])
		w.WriteByte(z.priznaky)
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
		err = os.Rename(docasny, filepath.Join(slozka, nazevVyrezu))
	}
	if err != nil {
		os.Remove(docasny)
		return err
	}
	v.zmeneno = false
	return nil
}

func SmazatVyrezy(slozka string) error {
	err := os.Remove(filepath.Join(slozka, nazevVyrezu))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
