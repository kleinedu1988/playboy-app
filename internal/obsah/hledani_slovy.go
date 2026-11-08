package obsah

// Hledání slovy v Sluzbě: stažení textového modelu na pozadí (s průběhem) a vektor dotazu

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// Stav hledání slovy
type StavTextu struct {
	Pripraveno bool   `json:"pripraveno"`
	Stahuje    bool   `json:"stahuje"`
	Stazeno    int64  `json:"stazeno"`
	Celkem     int64  `json:"celkem"` // bajtů ke stažení (i před zapnutím, pro potvrzení)
	Chyba      string `json:"chyba"`
}

type textSluzby struct {
	mu    sync.Mutex
	model *TextovyModel
	stav  StavTextu
}

var texty sync.Map // složka → *textSluzby (Sluzba nemá pole, ať se nemění její inicializace)

func (s *Sluzba) text() *textSluzby {
	t, _ := texty.LoadOrStore(s.slozka, &textSluzby{})
	return t.(*textSluzby)
}

// StavHledaniSlovy: je textový model připravený, stahuje se, kolik
func (s *Sluzba) StavHledaniSlovy() StavTextu {
	if s == nil || s.slozka == "" {
		return StavTextu{}
	}
	t := s.text()
	t.mu.Lock()
	defer t.mu.Unlock()
	v := t.stav
	v.Pripraveno = TextPripraven(s.slozka)
	if v.Celkem == 0 {
		v.Celkem = VelikostTextu()
	}
	return v
}

// ZapnoutHledaniSlovy stáhne a převede textový model na pozadí (běžící stahování nechá běžet)
func (s *Sluzba) ZapnoutHledaniSlovy() bool {
	if s == nil || s.slozka == "" {
		return false
	}
	t := s.text()
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.stav.Stahuje || TextPripraven(s.slozka) {
		return true
	}
	t.stav = StavTextu{Stahuje: true, Celkem: VelikostTextu()}
	go func() {
		err := PripravitText(context.Background(), s.klient, s.slozka, func(p Prubeh) {
			t.mu.Lock()
			t.stav.Stazeno, t.stav.Celkem = p.Hotovo, p.Celkem
			t.mu.Unlock()
		})
		t.mu.Lock()
		defer t.mu.Unlock()
		t.stav.Stahuje = false
		if err != nil {
			t.stav.Chyba = err.Error()
			fmt.Printf("Hledání slovy: %v\n", err)
		}
	}()
	return true
}

// VypnoutHledaniSlovy smaže textový model
func (s *Sluzba) VypnoutHledaniSlovy() error {
	if s == nil || s.slozka == "" {
		return nil
	}
	t := s.text()
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.stav.Stahuje {
		return errors.New("textový model se právě stahuje")
	}
	t.model, t.stav = nil, StavTextu{}
	return SmazatText(s.slozka)
}

// VektorTextu: vektor dotazu (nil bez textového modelu nebo vektorů fotek)
func (s *Sluzba) VektorTextu(dotaz string) []float32 {
	if s == nil || s.slozka == "" || !TextPripraven(s.slozka) {
		return nil
	}
	t := s.text()
	t.mu.Lock()
	if t.model == nil {
		m, err := OtevritText(s.slozka)
		if err != nil {
			t.stav.Chyba = err.Error()
			t.mu.Unlock()
			return nil
		}
		t.model = m
	}
	m := t.model
	t.mu.Unlock()
	return m.Vektor(dotaz)
}

// PodobnostiKTextu: podobnost každé fotky s vektorem k vektoru dotazu
func (s *Sluzba) PodobnostiKTextu(vektor []float32) map[string]float64 {
	if s == nil || len(vektor) != Rozmer {
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
	return v.PodobnostiKeStredu(vektor)
}
