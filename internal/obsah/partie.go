package obsah

// Partie fotek z detektoru (detektor.go) v souboru obsah/partie.bin vedle vektorů: pro každou fotku nejvyšší
// jistota každé z 18 tříd NudeNet jako bajt (0–255). Hlavička nese hash detektoru: z jiného se spočítá znovu.
//
// Formát: "PBPARTIE" | verze uint16 | počet tříd uint16 | hash detektoru 64 B | počet uint32 |
// záznamy: délka ID uint8 | ID | třídy × uint8.

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
	nazevPartii  = "partie.bin"
	znackaPartii = "PBPARTIE"
	verzePartii  = 1
)

var hashDetektoru = Soubory[2].Hash

// Partie fotek v paměti
type Partie struct {
	mu      sync.RWMutex
	m       map[string][TridDetektoru]uint8
	zmeneno bool
}

func NovePartie() *Partie { return &Partie{m: map[string][TridDetektoru]uint8{}} }

func (p *Partie) Ma(id string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	_, ok := p.m[id]
	return ok
}

func (p *Partie) Pocet() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.m)
}

// Pridat uloží jistoty tříd (0–1, pořadí TridyDetektoru)
func (p *Partie) Pridat(id string, jistoty []float32) {
	if len(jistoty) != TridDetektoru || id == "" || len(id) > 255 {
		return
	}
	var b [TridDetektoru]uint8
	for i, x := range jistoty {
		b[i] = uint8(min(max(x, 0), 1)*255 + 0.5)
	}
	p.mu.Lock()
	p.m[id] = b
	p.zmeneno = true
	p.mu.Unlock()
}

// Jistoty tříd fotky (0–1), nil když je nemá
func (p *Partie) Jistoty(id string) []float32 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	b, ok := p.m[id]
	if !ok {
		return nil
	}
	v := make([]float32, len(b))
	for i, x := range b {
		v[i] = float32(x) / 255
	}
	return v
}

func (p *Partie) Ponechat(platne func(id string) bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for id := range p.m {
		if !platne(id) {
			delete(p.m, id)
			p.zmeneno = true
		}
	}
}

// NacistPartie: chybějící soubor nebo jiný detektor = prázdné, poškozený = chyba a prázdnné
func NacistPartie(slozka string) (*Partie, error) {
	p := NovePartie()
	f, err := os.Open(filepath.Join(slozka, nazevPartii))
	if errors.Is(err, os.ErrNotExist) {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	defer f.Close()
	r := bufio.NewReaderSize(f, 1<<16)
	var h struct {
		Znacka [8]byte
		Verze  uint16
		Trid   uint16
		Hash   [64]byte
		Pocet  uint32
	}
	if err := binary.Read(r, binary.LittleEndian, &h); err != nil {
		return p, fmt.Errorf("partie: hlavička: %w", err)
	}
	if string(h.Znacka[:]) != znackaPartii {
		return p, errors.New("partie: neznámý soubor")
	}
	if h.Verze != verzePartii || int(h.Trid) != TridDetektoru || string(h.Hash[:]) != hashDetektoru {
		return p, nil
	}
	if h.Pocet > 10_000_000 {
		return p, errors.New("partie: nečekaný počet záznamů")
	}
	idBuf := make([]byte, 255)
	for i := range int(h.Pocet) {
		delka, err := r.ReadByte()
		var b [TridDetektoru]uint8
		if err == nil {
			_, err = io.ReadFull(r, idBuf[:delka])
		}
		if err == nil {
			_, err = io.ReadFull(r, b[:])
		}
		if err != nil {
			return NovePartie(), fmt.Errorf("partie: záznam %d: %w", i, err)
		}
		p.m[string(idBuf[:delka])] = b
	}
	return p, nil
}

// Ulozit přes dočasný soubor a přejmenování; bez změny nic nedělá
func (p *Partie) Ulozit(slozka string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.zmeneno {
		return nil
	}
	if err := os.MkdirAll(slozka, 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(slozka, ".partie-*")
	if err != nil {
		return err
	}
	docasny := f.Name()
	w := bufio.NewWriterSize(f, 1<<16)
	var hash [64]byte
	copy(hash[:], hashDetektoru)
	for _, x := range []any{[]byte(znackaPartii), uint16(verzePartii), uint16(TridDetektoru), hash, uint32(len(p.m))} {
		binary.Write(w, binary.LittleEndian, x)
	}
	for id, b := range p.m {
		w.WriteByte(byte(len(id)))
		w.WriteString(id)
		w.Write(b[:])
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
		err = os.Rename(docasny, filepath.Join(slozka, nazevPartii))
	}
	if err != nil {
		os.Remove(docasny)
		return err
	}
	p.zmeneno = false
	return nil
}

func SmazatPartie(slozka string) error {
	err := os.Remove(filepath.Join(slozka, nazevPartii))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
