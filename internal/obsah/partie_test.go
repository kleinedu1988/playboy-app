package obsah

import (
	"testing"
)

func TestPartieUlozitANacist(t *testing.T) {
	slozka := t.TempDir()
	p := NovePartie()
	j := make([]float32, len(TridyDetektoru))
	j[3] = 0.8
	p.Pridat("a", j)
	p.Pridat("b", make([]float32, len(TridyDetektoru)))
	if err := p.Ulozit(slozka); err != nil {
		t.Fatal(err)
	}
	n, err := NacistPartie(slozka)
	if err != nil || n.Pocet() != 2 {
		t.Fatalf("načteno %d, %v", n.Pocet(), err)
	}
	if x := n.Jistoty("a")[3]; x < 0.79 || x > 0.81 {
		t.Fatalf("jistota %.3f", x)
	}
	n.Ponechat(func(id string) bool { return id == "a" })
	if n.Ma("b") || n.Jistoty("b") != nil {
		t.Fatal("úklid")
	}
	puvodni := hashDetektoru
	hashDetektoru = "0000000000000000000000000000000000000000000000000000000000000000"
	jiny, err := NacistPartie(slozka)
	hashDetektoru = puvodni
	if err != nil || jiny.Pocet() != 0 {
		t.Fatal("partie jiného detektoru se mají zahodit")
	}
}
