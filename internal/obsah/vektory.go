package obsah

// Vektory fotek v souboru obsah/vektory.bin vedle databáze (ne v databázi: schéma je zmrazené a zálohy kopírují
// celý soubor; vektory jsou odvozená data jako náhledy). Klíčem je ID souboru na Disku. Vektor délky 1 je uložený
// kvantovaný na int8 s měřítkem (512 B na fotku, celá sbírka ~10 MB) a v paměti leží v souvislém poli, takže
// hledání nejbližších je jen průchod polem. Hlavička nese hash modelu: soubor z jiného modelu se zahodí.
//
// Formát (little-endian): "PBVEKTOR" | verze uint16 | rozměr uint16 | hash modelu 64 B (hex) | počet uint32 |
// záznamy: délka ID uint8 | ID | měřítko float32 | rozměr × int8.

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

const (
	nazevVektoru  = "vektory.bin"
	znackaVektoru = "PBVEKTOR"
	verzeVektoru  = 1
)

// Hash modelu, ke kterému vektory patří
var hashModelu = Soubory[0].Hash

// Vektory fotek v paměti
type Vektory struct {
	mu      sync.RWMutex
	ids     []string
	index   map[string]int
	meritka []float32
	data    []int8 // len(ids) × Rozmer
	zmeneno bool   // od posledního uložení přibyly nebo ubyly vektory
}

func NoveVektory() *Vektory {
	return &Vektory{index: map[string]int{}}
}

// Pocet uložených vektorů
func (v *Vektory) Pocet() int {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return len(v.ids)
}

// Ma: fotka už má vektor
func (v *Vektory) Ma(id string) bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	_, ok := v.index[id]
	return ok
}

// Vektor fotky (z int8 zpět na čísla), nil když ho nemá
func (v *Vektory) Vektor(id string) []float32 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	i, ok := v.index[id]
	if !ok {
		return nil
	}
	x := make([]float32, Rozmer)
	for k, q := range v.data[i*Rozmer : (i+1)*Rozmer] {
		x[k] = float32(q) * v.meritka[i]
	}
	return x
}

// Podobnost dvou fotek (skalární součin vektorů délky 1); 0, když některá vektor nemá
func (v *Vektory) Podobnost(a, b string) float64 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	i, ok1 := v.index[a]
	j, ok2 := v.index[b]
	if !ok1 || !ok2 {
		return 0
	}
	x, y := v.data[i*Rozmer:(i+1)*Rozmer], v.data[j*Rozmer:(j+1)*Rozmer]
	var s0, s1, s2, s3 int32
	for k := 0; k < Rozmer; k += 4 {
		s0 += int32(x[k]) * int32(y[k])
		s1 += int32(x[k+1]) * int32(y[k+1])
		s2 += int32(x[k+2]) * int32(y[k+2])
		s3 += int32(x[k+3]) * int32(y[k+3])
	}
	return float64(s0+s1+s2+s3) * float64(v.meritka[i]) * float64(v.meritka[j])
}

// Stred: průměrný vektor fotek (délky 1), nil bez žádné s vektorem – „střed vkusu“ (např. fotky ♥4+)
func (v *Vektory) Stred(ids []string) []float32 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	s := make([]float64, Rozmer)
	n := 0
	for _, id := range ids {
		i, ok := v.index[id]
		if !ok {
			continue
		}
		m := float64(v.meritka[i])
		for k, q := range v.data[i*Rozmer : (i+1)*Rozmer] {
			s[k] += float64(q) * m
		}
		n++
	}
	if n == 0 {
		return nil
	}
	x := make([]float32, Rozmer)
	for k := range s {
		x[k] = float32(s[k])
	}
	if !Normalizovat(x) {
		return nil
	}
	return x
}

// PodobnostiKeStredu: podobnost každé fotky s vektorem k danému vektoru (skalární součin)
func (v *Vektory) PodobnostiKeStredu(stred []float32) map[string]float64 {
	v.mu.RLock()
	defer v.mu.RUnlock()
	vysledek := make(map[string]float64, len(v.ids))
	if len(stred) != Rozmer {
		return vysledek
	}
	for i, id := range v.ids {
		radek := v.data[i*Rozmer : (i+1)*Rozmer]
		var s0, s1, s2, s3 float32
		for k := 0; k < Rozmer; k += 4 {
			s0 += float32(radek[k]) * stred[k]
			s1 += float32(radek[k+1]) * stred[k+1]
			s2 += float32(radek[k+2]) * stred[k+2]
			s3 += float32(radek[k+3]) * stred[k+3]
		}
		vysledek[id] = float64(((s0 + s1) + (s2 + s3)) * v.meritka[i])
	}
	return vysledek
}

// Pridat uloží (nebo nahradí) vektor délky 1
func (v *Vektory) Pridat(id string, vektor []float32) {
	if len(vektor) != Rozmer || id == "" || len(id) > 255 {
		return
	}
	var nejvic float32
	for _, x := range vektor {
		nejvic = max(nejvic, float32(math.Abs(float64(x))))
	}
	meritko := nejvic / 127
	if meritko == 0 {
		return
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	i, ok := v.index[id]
	if !ok {
		i = len(v.ids)
		v.index[id] = i
		v.ids = append(v.ids, id)
		v.meritka = append(v.meritka, 0)
		v.data = append(v.data, make([]int8, Rozmer)...)
	}
	v.meritka[i] = meritko
	radek := v.data[i*Rozmer : (i+1)*Rozmer]
	for j, x := range vektor {
		radek[j] = int8(math.Round(float64(x / meritko)))
	}
	v.zmeneno = true
}

// Ponechat jen vektory fotek, které jsou ve sbírce (smazané fotky vypadnou při příštím uložení)
func (v *Vektory) Ponechat(platne func(id string) bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	k := 0
	for i, id := range v.ids {
		if !platne(id) {
			delete(v.index, id)
			continue
		}
		if k != i {
			v.ids[k] = id
			v.meritka[k] = v.meritka[i]
			copy(v.data[k*Rozmer:(k+1)*Rozmer], v.data[i*Rozmer:(i+1)*Rozmer])
			v.index[id] = k
		}
		k++
	}
	if k != len(v.ids) {
		v.ids, v.meritka, v.data = v.ids[:k], v.meritka[:k], v.data[:k*Rozmer]
		v.zmeneno = true
	}
}

// Shoda: fotka a její podobnost s hledanou (skalární součin vektorů délky 1, 1 = stejná)
type Shoda struct {
	ID        string  `json:"id"`
	Podobnost float32 `json:"podobnost"`
}

// Podobne vrátí nejvýš pocet fotek nejpodobnějších fotce id (sama je první), od nejpodobnější; nil, když fotka
// vektor nemá
func (v *Vektory) Podobne(id string, pocet int) []Shoda {
	v.mu.RLock()
	defer v.mu.RUnlock()
	i, ok := v.index[id]
	if !ok || pocet <= 0 {
		return nil
	}
	dotaz := v.data[i*Rozmer : (i+1)*Rozmer]
	md := v.meritka[i]
	// Nejlepší průběžně v malé seřazené řadě: na desítky výsledků z desítek tisíc je to rychlejší než řadit vše
	nej := make([]Shoda, 0, pocet+1)
	for j := range v.ids {
		radek := v.data[j*Rozmer : (j+1)*Rozmer]
		var s0, s1, s2, s3 int32
		for k := 0; k < Rozmer; k += 4 {
			s0 += int32(dotaz[k]) * int32(radek[k])
			s1 += int32(dotaz[k+1]) * int32(radek[k+1])
			s2 += int32(dotaz[k+2]) * int32(radek[k+2])
			s3 += int32(dotaz[k+3]) * int32(radek[k+3])
		}
		p := float32(s0+s1+s2+s3) * md * v.meritka[j]
		if len(nej) == pocet && p <= nej[pocet-1].Podobnost {
			continue
		}
		k := sort.Search(len(nej), func(k int) bool { return nej[k].Podobnost < p })
		nej = append(nej, Shoda{})
		copy(nej[k+1:], nej[k:])
		nej[k] = Shoda{ID: v.ids[j], Podobnost: p}
		if len(nej) > pocet {
			nej = nej[:pocet]
		}
	}
	// Fotka sama první, i kdyby ji zaokrouhlení předběhlo téměř stejnou
	for k, s := range nej {
		if s.ID == id && k > 0 {
			copy(nej[1:k+1], nej[:k])
			nej[0] = s
			break
		}
	}
	return nej
}

// NacistVektory přečte soubor ze složky; chybějící soubor, jiný model nebo jiná verze formátu = prázdné vektory
// (spočítají se znovu), poškozený soubor = chyba a prázdné vektory
func NacistVektory(slozka string) (*Vektory, error) {
	v := NoveVektory()
	f, err := os.Open(filepath.Join(slozka, nazevVektoru))
	if errors.Is(err, os.ErrNotExist) {
		return v, nil
	}
	if err != nil {
		return v, err
	}
	defer f.Close()
	n, err := cistVektory(f)
	if err != nil {
		return v, err
	}
	return n, nil
}

// Přečte vektory ze souboru ve formátu vektory.bin; jiný model nebo verze = prázdné vektory bez chyby
func cistVektory(f io.Reader) (*Vektory, error) {
	v := NoveVektory()
	r := bufio.NewReaderSize(f, 1<<16)
	var hlavicka struct {
		Znacka [8]byte
		Verze  uint16
		Rozmer uint16
		Hash   [64]byte
		Pocet  uint32
	}
	if err := binary.Read(r, binary.LittleEndian, &hlavicka); err != nil {
		return v, fmt.Errorf("vektory: hlavička: %w", err)
	}
	if string(hlavicka.Znacka[:]) != znackaVektoru {
		return v, errors.New("vektory: neznámý soubor")
	}
	if hlavicka.Verze != verzeVektoru || hlavicka.Rozmer != Rozmer || string(hlavicka.Hash[:]) != hashModelu {
		return v, nil // jiný model nebo formát: spočítat znovu
	}
	n := int(hlavicka.Pocet)
	if n > 10_000_000 {
		return v, errors.New("vektory: nečekaný počet záznamů")
	}
	v.ids = make([]string, 0, n)
	v.meritka = make([]float32, 0, n)
	v.data = make([]int8, n*Rozmer)
	idBuf := make([]byte, 255)
	for i := range n {
		delka, err := r.ReadByte()
		if err == nil {
			_, err = io.ReadFull(r, idBuf[:delka])
		}
		var meritko float32
		if err == nil {
			err = binary.Read(r, binary.LittleEndian, &meritko)
		}
		if err == nil {
			err = binary.Read(r, binary.LittleEndian, v.data[i*Rozmer:(i+1)*Rozmer])
		}
		if err != nil {
			return NoveVektory(), fmt.Errorf("vektory: záznam %d: %w", i, err)
		}
		id := string(idBuf[:delka])
		if _, dvakrat := v.index[id]; dvakrat || meritko <= 0 || math.IsNaN(float64(meritko)) {
			return NoveVektory(), fmt.Errorf("vektory: neplatný záznam %d", i)
		}
		v.index[id] = i
		v.ids = append(v.ids, id)
		v.meritka = append(v.meritka, meritko)
	}
	return v, nil
}

// Ulozit zapíše vektory do složky přes dočasný soubor a přejmenování (žádný napůl zapsaný soubor); bez změny
// od posledního uložení nic nedělá
func (v *Vektory) Ulozit(slozka string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if !v.zmeneno {
		return nil
	}
	if err := os.MkdirAll(slozka, 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(slozka, ".vektory-*")
	if err != nil {
		return err
	}
	docasny := f.Name()
	err = v.zapsat(f)
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
		err = os.Rename(docasny, filepath.Join(slozka, nazevVektoru))
	}
	if err != nil {
		os.Remove(docasny)
		return err
	}
	v.zmeneno = false
	return nil
}

// Zapsat vektory ve formátu vektory.bin (generátor tagů; soubor sbírky ukládá Ulozit)
func (v *Vektory) Zapsat(f io.Writer) error {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.zapsat(f)
}

func (v *Vektory) zapsat(f io.Writer) error {
	w := bufio.NewWriterSize(f, 1<<16)
	var hash [64]byte
	copy(hash[:], hashModelu)
	hlavicka := []any{[]byte(znackaVektoru), uint16(verzeVektoru), uint16(Rozmer), hash, uint32(len(v.ids))}
	for _, h := range hlavicka {
		if err := binary.Write(w, binary.LittleEndian, h); err != nil {
			return err
		}
	}
	for i, id := range v.ids {
		w.WriteByte(byte(len(id)))
		w.WriteString(id)
		binary.Write(w, binary.LittleEndian, v.meritka[i])
		if err := binary.Write(w, binary.LittleEndian, v.data[i*Rozmer:(i+1)*Rozmer]); err != nil {
			return err
		}
	}
	return w.Flush()
}

// SmazatVektory odstraní soubor vektorů (vypnutí funkce s uvolněním místa)
func SmazatVektory(slozka string) error {
	err := os.Remove(filepath.Join(slozka, nazevVektoru))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
