package obsah

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Složka se staženým modelem a knihovnou (soubory pod názvy z Soubory); bez ní se testy modelu přeskočí:
// OBSAH_SLOZKA=~/.local/share/playboy-app/obsah go test -run Model -v ./internal/obsah
func slozkaModelu(t *testing.T) string {
	slozka := os.Getenv("OBSAH_SLOZKA")
	if slozka == "" || !Pripraveno(slozka) {
		t.Skip("bez OBSAH_SLOZKA se staženým modelem a ONNX Runtime")
	}
	return slozka
}

// Vektor testovacího obrázku musí odpovídat prototypu, na kterém se měřila kvalita (MODEL-CLIP-B32.md)
func TestModelShodaSReferenci(t *testing.T) {
	slozka := slozkaModelu(t)
	data, err := os.ReadFile("testdata/ikona.jpg")
	if err != nil {
		t.Fatal(err)
	}
	text, err := os.ReadFile("testdata/ikona-vektor.txt")
	if err != nil {
		t.Fatal(err)
	}
	var ref []float32
	for _, r := range strings.Fields(string(text)) {
		x, err := strconv.ParseFloat(r, 32)
		if err != nil {
			t.Fatal(err)
		}
		ref = append(ref, float32(x))
	}
	m, err := OtevritModel(slozka)
	if err != nil {
		t.Fatal(err)
	}
	defer m.Zavrit()
	v, err := m.Vektor(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(v) != Rozmer || len(ref) != Rozmer {
		t.Fatalf("rozměr %d, reference %d", len(v), len(ref))
	}
	var s float32
	for i := range v {
		s += v[i] * ref[i]
	}
	t.Logf("podobnost s referencí %.4f", s)
	if s < 0.999 {
		t.Fatalf("podobnost s referencí %.4f", s)
	}
	if _, err := m.Vektor([]byte("není obrázek")); err == nil {
		t.Fatal("neobrázek má vrátit chybu")
	}
}

// Celý výpočet nad složkou: fotky bez vektoru se spočítají, nedostupné přeskočí, výsledek se uloží
func TestModelVypocetSbirky(t *testing.T) {
	zdroj := slozkaModelu(t)
	slozka := t.TempDir()
	for _, s := range Soubory {
		if err := os.Symlink(zdroj+"/"+s.Nazev, slozka+"/"+s.Nazev); err != nil {
			t.Fatal(err)
		}
	}
	data, _ := os.ReadFile("testdata/ikona.jpg")
	sl := NovaSluzba(slozka, nil, Zdroje{
		Fotky: func() ([]string, error) { return []string{"a", "b", "nedostupna", "a"}, nil },
		Nahled: func(ctx context.Context, id string) ([]byte, error) {
			if id == "nedostupna" {
				return nil, errors.New("404")
			}
			return data, nil
		},
	})
	t.Cleanup(sl.Zastavit)
	if !sl.Spustit() {
		t.Fatal("nespustilo se")
	}
	konec := time.Now().Add(time.Minute)
	for sl.Stav().Faze != FazePripraveno {
		if st := sl.Stav(); st.Faze == FazeChyba || time.Now().After(konec) {
			t.Fatalf("stav %+v", st)
		}
		time.Sleep(20 * time.Millisecond)
	}
	st := sl.Stav()
	if st.Vektoru != 2 || st.Celkem != 3 || st.Hotovo != 3 {
		t.Fatalf("stav %+v", st)
	}
	if s := sl.Podobne("a", 5); len(s) != 2 || s[0].ID != "a" || s[1].Podobnost < 0.99 {
		t.Fatalf("podobné %+v", s)
	}
	n, err := NacistVektory(slozka)
	if err != nil || n.Pocet() != 2 {
		t.Fatalf("uložené vektory %d, %v", n.Pocet(), err)
	}
}
