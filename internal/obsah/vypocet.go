package obsah

// Obsah fotek jako celek: stažení modelů, výpočet vektorů (CLIP) a partií (detektor) všech fotek sbírky na pozadí
// a hledání podobných.
// Výpočet bere náhledy w400 (z mezipaměti, chybějící se stáhnou ohleduplně jako náhledy na pozadí), počítá jedním
// modelem se 2 vlákny, průběžně ukládá a po přerušení (zavření programu, Pozastavit) pokračuje tam, kde skončil.
// Model (~200 MB paměti) je otevřený jen během výpočtu; hledání podobných ho nepotřebuje.

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
)

// Fáze obsahu fotek pro okno
const (
	FazeVypnuto    = "vypnuto"    // soubory modelu nejsou stažené
	FazeStahuje    = "stahuje"    // stahuje se model a knihovna
	FazePocita     = "pocita"     // počítají se vektory fotek
	FazePripraveno = "pripraveno" // model je stažený, výpočet neběží
	FazeChyba      = "chyba"      // poslední běh skončil chybou (Chyba)
)

// Po kolika spočítaných fotkách se vektory uloží (přerušení přijde nejvýš o tolik výpočtu)
const ukladatPo = 500

// Kolik náhledů se stahuje najednou (stejně jako náhledy na pozadí, ohled na limity Googlu)
const soubehNahledu = 3

// Stav obsahu fotek
type Stav struct {
	Faze     string `json:"faze"`
	Stazeno  int64  `json:"stazeno"`  // bajtů při stahování modelu
	Stahnout int64  `json:"stahnout"` // bajtů ke stažení celkem (i před zapnutím, pro potvrzení)
	Hotovo   int    `json:"hotovo"`   // fotek s vektorem
	Celkem   int    `json:"celkem"`   // fotek ve sbírce při posledním výpočtu
	Vektoru  int    `json:"vektoru"`
	Chyba    string `json:"chyba"`
}

// Zdroje dat pro výpočet (napojení na databázi a mezipaměť náhledů v package main)
type Zdroje struct {
	Fotky  func() ([]string, error)                             // ID souborů všech fotek sbírky v pořadí výpočtu
	Nahled func(ctx context.Context, id string) ([]byte, error) // náhled w400
}

// Obsah fotek nad složkou obsah/
type Sluzba struct {
	slozka string
	klient *http.Client
	zdroje Zdroje

	mu      sync.Mutex
	stav    Stav
	zrusit  context.CancelFunc
	konec   chan struct{} // zavře se po skončení běhu na pozadí
	vektory *Vektory
	partie  *Partie // jistoty partií z detektoru (partie.go), načtené spolu s vektory
	vzhled  *Vzhled // barvy a kvalita snímku (vzhled.go), načtené spolu s vektory
}

func NovaSluzba(slozka string, klient *http.Client, zdroje Zdroje) *Sluzba {
	return &Sluzba{slozka: slozka, klient: klient, zdroje: zdroje}
}

// Stav pro okno
func (s *Sluzba) Stav() Stav {
	if s == nil || s.slozka == "" {
		return Stav{Faze: FazeVypnuto}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.stav
	if st.Faze == "" {
		st.Faze = FazeVypnuto
		if Pripraveno(s.slozka) {
			st.Faze = FazePripraveno
		}
	}
	if s.vektory == nil && st.Faze == FazePripraveno {
		s.nacistVektoryZamceno()
	}
	if s.vektory != nil {
		st.Vektoru = s.vektory.Pocet()
	}
	if st.Stahnout == 0 && st.Faze == FazeVypnuto {
		for _, f := range Soubory {
			st.Stahnout += f.Velikost
		}
	}
	return st
}

// Zapnuto: model je stažený (funkce se zapíná stažením, vypíná smazáním)
func (s *Sluzba) Zapnuto() bool {
	return s != nil && s.slozka != "" && Pripraveno(s.slozka)
}

func (s *Sluzba) nacistVektoryZamceno() {
	v, err := NacistVektory(s.slozka)
	if err != nil {
		fmt.Printf("Obsah fotek: %v – vektory se spočítají znovu\n", err)
	}
	p, err := NacistPartie(s.slozka)
	if err != nil {
		fmt.Printf("Obsah fotek: %v – partie se spočítají znovu\n", err)
	}
	vz, err := NacistVzhled(s.slozka)
	if err != nil {
		fmt.Printf("Obsah fotek: %v – vzhled se spočítá znovu\n", err)
	}
	s.vektory, s.partie, s.vzhled = v, p, vz
}

// Spustit stáhne model (když chybí) a dopočítá vektory fotek bez vektoru; běžící běh nechá běžet.
// false, když obsah fotek nemá složku (dočasná databáze).
func (s *Sluzba) Spustit() bool {
	if s == nil || s.slozka == "" {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.zrusit != nil {
		return true
	}
	ctx, zrusit := context.WithCancel(context.Background())
	s.zrusit = zrusit
	s.konec = make(chan struct{})
	s.stav.Chyba = ""
	s.stav.Faze = FazePocita
	if !Pripraveno(s.slozka) {
		s.stav.Faze = FazeStahuje
	}
	go func(konec chan struct{}) {
		defer close(konec)
		err := s.behat(ctx)
		s.mu.Lock()
		defer s.mu.Unlock()
		s.zrusit = nil
		switch {
		case err != nil && !errors.Is(err, context.Canceled):
			s.stav.Faze = FazeChyba
			s.stav.Chyba = err.Error()
			fmt.Printf("Obsah fotek: %v\n", err)
		case Pripraveno(s.slozka):
			s.stav.Faze = FazePripraveno
		default:
			s.stav.Faze = FazeVypnuto
		}
	}(s.konec)
	return true
}

// Zastavit přeruší stahování nebo výpočet a počká na jeho konec (rozpracované se uloží)
func (s *Sluzba) Zastavit() {
	if s == nil {
		return
	}
	s.mu.Lock()
	zrusit, konec := s.zrusit, s.konec
	s.mu.Unlock()
	if zrusit != nil {
		zrusit()
		<-konec
	}
}

// Vypnout zastaví běh a smaže model, knihovnu i vektory (uvolní ~110 MB a vektory)
func (s *Sluzba) Vypnout() error {
	if s == nil || s.slozka == "" {
		return nil
	}
	s.Zastavit()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.vektory, s.partie, s.vzhled = nil, nil, nil
	s.stav = Stav{}
	err := Smazat(s.slozka)
	if e := SmazatVektory(s.slozka); err == nil {
		err = e
	}
	if e := SmazatPartie(s.slozka); err == nil {
		err = e
	}
	if e := SmazatVzhled(s.slozka); err == nil {
		err = e
	}
	if e := s.VypnoutHledaniSlovy(); err == nil {
		err = e
	}
	return err
}

// Podobne: nejpodobnější fotky k fotce (ID souboru na Disku), sama první; nil, když vektor ještě nemá
func (s *Sluzba) Podobne(id string, pocet int) []Shoda {
	if s == nil || s.slozka == "" {
		return nil
	}
	s.mu.Lock()
	if s.vektory == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	return v.Podobne(id, pocet)
}

// Vektor fotky (ID souboru na Disku), nil když ho ještě nemá
func (s *Sluzba) Vektor(id string) []float32 {
	if s == nil || s.slozka == "" {
		return nil
	}
	s.mu.Lock()
	if s.vektory == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	return v.Vektor(id)
}

// Partie fotky z detektoru (jistoty tříd TridyDetektoru), nil když je ještě nemá
func (s *Sluzba) Partie(id string) []float32 {
	if s == nil || s.slozka == "" {
		return nil
	}
	s.mu.Lock()
	if s.partie == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	p := s.partie
	s.mu.Unlock()
	if p == nil {
		return nil
	}
	return p.Jistoty(id)
}

// Podobnost dvou fotek (ID souborů) podle vektorů obsahu: 1 = stejná, 0 bez vektoru
func (s *Sluzba) Podobnost(a, b string) float64 {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return 0
	}
	return v.Podobnost(a, b)
}

// PodobnostiKeStredu fotek: střed = průměr vektorů fotek ids; nil bez vektorů
func (s *Sluzba) PodobnostiKeStredu(ids []string) map[string]float64 {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	if s.vektory == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	stred := v.Stred(ids)
	if stred == nil {
		return nil
	}
	return v.PodobnostiKeStredu(stred)
}

// VzhledFotek: barvy a kvalita snímku všech spočítaných fotek (nil bez obsahu)
func (s *Sluzba) VzhledFotek() map[string]VzhledFotky {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	if s.vzhled == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	vz := s.vzhled
	s.mu.Unlock()
	if vz == nil {
		return nil
	}
	return vz.Vse()
}

// PocetVzhledu: kolik fotek má spočítaný vzhled
func (s *Sluzba) PocetVzhledu() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.vzhled == nil {
		return 0
	}
	return s.vzhled.Pocet()
}

// PocetPartii: kolik fotek má spočítané partie z detektoru
func (s *Sluzba) PocetPartii() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.partie == nil {
		return 0
	}
	return s.partie.Pocet()
}

// Zpracovana: fotka má vektor i partie (návrhy tagů jsou úplné)
func (s *Sluzba) Zpracovana(id string) bool {
	return s.Vektor(id) != nil && s.Partie(id) != nil
}

func (s *Sluzba) nastavit(fn func(st *Stav)) {
	s.mu.Lock()
	fn(&s.stav)
	s.mu.Unlock()
}

func (s *Sluzba) behat(ctx context.Context) error {
	if !Pripraveno(s.slozka) {
		s.nastavit(func(st *Stav) { st.Faze = FazeStahuje; st.Stazeno = 0 })
		err := Pripravit(ctx, s.klient, s.slozka, func(p Prubeh) {
			s.nastavit(func(st *Stav) { st.Stazeno, st.Stahnout = p.Hotovo, p.Celkem })
		})
		if err != nil {
			return err
		}
	}
	s.mu.Lock()
	if s.vektory == nil || s.partie == nil || s.vzhled == nil {
		s.nacistVektoryZamceno()
	}
	v, pa, vz := s.vektory, s.partie, s.vzhled
	s.mu.Unlock()

	ids, err := s.zdroje.Fotky()
	if err != nil {
		return fmt.Errorf("seznam fotek: %w", err)
	}
	platne := make(map[string]bool, len(ids))
	var chybi []string
	for _, id := range ids {
		if platne[id] {
			continue
		}
		platne[id] = true
		if !v.Ma(id) || !pa.Ma(id) || !vz.Ma(id) {
			chybi = append(chybi, id)
		}
	}
	v.Ponechat(func(id string) bool { return platne[id] })
	pa.Ponechat(func(id string) bool { return platne[id] })
	vz.Ponechat(func(id string) bool { return platne[id] })
	s.nastavit(func(st *Stav) { st.Faze = FazePocita; st.Celkem = len(platne); st.Hotovo = len(platne) - len(chybi) })
	if len(chybi) == 0 {
		return ulozitVse(s.slozka, v, pa, vz)
	}

	m, err := OtevritModel(s.slozka)
	if err != nil {
		return err
	}
	defer m.Zavrit()
	d, err := OtevritDetektor(s.slozka, Soubory[2].Nazev)
	if err != nil {
		return err
	}
	defer d.Zavrit()
	err = s.spocitat(ctx, m, d, v, pa, vz, chybi)
	uerr := ulozitVse(s.slozka, v, pa, vz)
	if uerr != nil && (err == nil || errors.Is(err, context.Canceled)) {
		return fmt.Errorf("uložení vektorů: %w", uerr)
	}
	return err
}

func ulozitVse(slozka string, v *Vektory, pa *Partie, vz *Vzhled) error {
	if err := v.Ulozit(slozka); err != nil {
		return err
	}
	if err := pa.Ulozit(slozka); err != nil {
		return fmt.Errorf("uložení partií: %w", err)
	}
	if err := vz.Ulozit(slozka); err != nil {
		return fmt.Errorf("uložení vzhledu: %w", err)
	}
	return nil
}

type nahledFotky struct {
	id   string
	data []byte
}

// Náhledy stahuje několik vláken, model počítá jedno (sám používá 2 vlákna)
func (s *Sluzba) spocitat(ctx context.Context, m *Model, d *Detektor, v *Vektory, pa *Partie, vz *Vzhled, chybi []string) error {
	ctx, zrusit := context.WithCancel(ctx) // při chybě modelu skončí i stahování náhledů
	defer zrusit()
	fronta := make(chan string)
	nahledy := make(chan nahledFotky, soubehNahledu)
	var stahovani sync.WaitGroup
	for range soubehNahledu {
		stahovani.Go(func() {
			for id := range fronta {
				// Bez náhledu (na Disku nedostupný, výpadek) zůstane fotka bez vektoru a zkusí se při dalším běhu
				data, _ := s.zdroje.Nahled(ctx, id)
				select {
				case nahledy <- nahledFotky{id, data}:
				case <-ctx.Done():
					return
				}
			}
		})
	}
	go func() {
		defer close(fronta)
		for _, id := range chybi {
			select {
			case fronta <- id:
			case <-ctx.Done():
				return
			}
		}
	}()
	go func() {
		stahovani.Wait()
		close(nahledy)
	}()

	odUlozeni := 0
	var prvniChyba error
	chybVypoctu := 0
	for n := range nahledy {
		if ctx.Err() != nil {
			continue // dočerpat, aby vlákna stahování skončila
		}
		s.nastavit(func(st *Stav) { st.Hotovo++ })
		if n.data == nil {
			continue
		}
		var err error
		if !v.Ma(n.id) {
			var vektor []float32
			if vektor, err = m.Vektor(n.data); err == nil {
				v.Pridat(n.id, vektor)
			}
		}
		if err == nil && !pa.Ma(n.id) {
			var jistoty []float32
			if jistoty, err = d.Partie(n.data); err == nil {
				pa.Pridat(n.id, jistoty)
			}
		}
		if err == nil && !vz.Ma(n.id) {
			var x VzhledFotky
			if x, err = SpocitatVzhled(n.data); err == nil {
				vz.Pridat(n.id, x)
			}
		}
		if err != nil {
			// Jednotlivý nečitelný obrázek výpočet nezastaví; když selhává skoro všechno, je chyba v modelu
			chybVypoctu++
			if prvniChyba == nil {
				prvniChyba = err
			}
			if chybVypoctu >= 20 && v.Pocet() == 0 {
				return fmt.Errorf("výpočet: %w", prvniChyba)
			}
			continue
		}
		if odUlozeni++; odUlozeni >= ukladatPo {
			odUlozeni = 0
			if err := ulozitVse(s.slozka, v, pa, vz); err != nil {
				return fmt.Errorf("uložení vektorů: %w", err)
			}
		}
	}
	return ctx.Err()
}
