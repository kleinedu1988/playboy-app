package obsah

import (
	"math"
	"math/rand/v2"
	"os"
	"path/filepath"
	"testing"
)

// Náhodný vektor délky 1
func nahodnyVektor(r *rand.Rand) []float32 {
	v := make([]float32, Rozmer)
	for i := range v {
		v[i] = float32(r.NormFloat64())
	}
	normalizovat(v)
	return v
}

// Vektor blízký vzoru (stejné focení)
func blizky(r *rand.Rand, vzor []float32, sum float64) []float32 {
	v := make([]float32, Rozmer)
	for i := range v {
		v[i] = vzor[i] + float32(r.NormFloat64()*sum)
	}
	normalizovat(v)
	return v
}

func TestVektoryUlozitANacist(t *testing.T) {
	r := rand.New(rand.NewPCG(1, 2))
	slozka := t.TempDir()
	v := NoveVektory()
	puvodni := map[string][]float32{}
	for _, id := range []string{"a", "b", "c"} {
		puvodni[id] = nahodnyVektor(r)
		v.Pridat(id, puvodni[id])
	}
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}
	if i, err := os.Stat(filepath.Join(slozka, nazevVektoru)); err != nil || i.Mode().Perm() != 0o600 {
		t.Fatalf("soubor vektorů: %v %v", i, err)
	}
	n, err := NacistVektory(slozka)
	if err != nil || n.Pocet() != 3 {
		t.Fatalf("načteno %d, %v", n.Pocet(), err)
	}
	// Kvantování na int8 skoro nemění podobnost
	for id := range puvodni {
		s := n.Podobne(id, 1)
		if len(s) != 1 || s[0].ID != id || math.Abs(float64(s[0].Podobnost)-1) > 0.01 {
			t.Fatalf("%s: %+v", id, s)
		}
	}
}

func TestVektoryJinyModelSeZahodi(t *testing.T) {
	slozka := t.TempDir()
	v := NoveVektory()
	v.Pridat("a", nahodnyVektor(rand.New(rand.NewPCG(1, 1))))
	puvodni := hashModelu
	hashModelu = "0000000000000000000000000000000000000000000000000000000000000000"
	err := v.Ulozit(slozka)
	hashModelu = puvodni
	if err != nil {
		t.Fatal(err)
	}
	n, err := NacistVektory(slozka)
	if err != nil || n.Pocet() != 0 {
		t.Fatalf("vektory jiného modelu: %d, %v", n.Pocet(), err)
	}
}

func TestVektoryPoskozenySoubor(t *testing.T) {
	slozka := t.TempDir()
	v := NoveVektory()
	v.Pridat("a", nahodnyVektor(rand.New(rand.NewPCG(1, 1))))
	v.Pridat("b", nahodnyVektor(rand.New(rand.NewPCG(1, 2))))
	if err := v.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(slozka, nazevVektoru)
	data, _ := os.ReadFile(p)
	os.WriteFile(p, data[:len(data)-100], 0o600)
	n, err := NacistVektory(slozka)
	if err == nil || n.Pocet() != 0 {
		t.Fatalf("useknutý soubor: %d, %v", n.Pocet(), err)
	}
	if n, err := NacistVektory(t.TempDir()); err != nil || n.Pocet() != 0 {
		t.Fatalf("bez souboru: %d, %v", n.Pocet(), err)
	}
}

func TestPodobneNejdrivStejneFoceni(t *testing.T) {
	r := rand.New(rand.NewPCG(3, 4))
	v := NoveVektory()
	foceni := nahodnyVektor(r)
	for _, id := range []string{"f1", "f2", "f3"} {
		v.Pridat(id, blizky(r, foceni, 0.02))
	}
	for i := range 200 {
		v.Pridat(string(rune('A'+i%26))+string(rune('a'+i/26)), nahodnyVektor(r))
	}
	s := v.Podobne("f2", 3)
	if len(s) != 3 || s[0].ID != "f2" {
		t.Fatalf("%+v", s)
	}
	for _, x := range s[1:] {
		if x.ID != "f1" && x.ID != "f3" {
			t.Fatalf("mezi nejpodobnějšími je cizí fotka: %+v", s)
		}
	}
	if s[0].Podobnost < s[1].Podobnost || s[1].Podobnost < s[2].Podobnost {
		t.Fatalf("pořadí: %+v", s)
	}
	if v.Podobne("neni", 5) != nil {
		t.Fatal("fotka bez vektoru má mít nil")
	}
}

func TestVektoryPonechat(t *testing.T) {
	r := rand.New(rand.NewPCG(5, 6))
	v := NoveVektory()
	b := nahodnyVektor(r)
	v.Pridat("a", nahodnyVektor(r))
	v.Pridat("b", b)
	v.Pridat("c", nahodnyVektor(r))
	v.Ponechat(func(id string) bool { return id != "a" })
	if v.Pocet() != 2 || v.Ma("a") || !v.Ma("b") || !v.Ma("c") {
		t.Fatalf("po úklidu %d", v.Pocet())
	}
	// Posunutý záznam má pořád svůj vektor
	if s := v.Podobne("b", 1); s[0].ID != "b" || s[0].Podobnost < 0.99 {
		t.Fatalf("%+v", s)
	}
	v.Pridat("b", b) // nahrazení nepřidá záznam
	if v.Pocet() != 2 {
		t.Fatal("nahrazení přidalo záznam")
	}
}
