package obsah

import "testing"

func TestDruhVestavenyAKodovani(t *testing.T) {
	if vahyDruhu == nil {
		t.Fatal("vestavěné váhy druhu (druh.bin) se nenačetly")
	}
	var m [2]VahyDruhu
	m[0].Posun, m[0].Vahy[3] = -1, 2
	m[1].Posun = 0.5
	z, ok := dekodovatDruh(ZakodovatDruh(m))
	if !ok || z[0].Posun != -1 || z[0].Vahy[3] != 2 || z[1].Posun != 0.5 {
		t.Fatalf("kódování vah %v %v", ok, z)
	}
	if _, ok := dekodovatDruh([]byte("PBDRUH01xx")); ok {
		t.Fatal("krátký soubor prošel")
	}
	v := make([]float32, Rozmer)
	v[3] = 1
	if p := z[0].Pravdepodobnost(v); p < 0.73 || p > 0.74 { // σ(−1 + 2) ≈ 0,731
		t.Fatalf("pravděpodobnost %v", p)
	}
}

// Doladění z potvrzení: vestavěný odhad plete skupinu B (pózovací) s kladnou skupinou A; po 20 potvrzeních
// „ne“ z B (a pár „ano“ z A) se B přestane navrhovat a A zůstane
func TestUcitDruhZPotvrzeni(t *testing.T) {
	smer := func(osa int, sum float32) []float32 {
		v := make([]float32, Rozmer)
		v[osa] = 1
		v[osa+1] = sum
		Normalizovat(v)
		return v
	}
	var start VahyDruhu
	start.Posun = -2
	start.Vahy[0], start.Vahy[2] = 6, 6 // A (osa 0) i B (osa 2) jsou vysoko
	a, b := smer(0, 0.1), smer(2, 0.1)
	if start.Pravdepodobnost(a) < 0.85 || start.Pravdepodobnost(b) < 0.85 {
		t.Fatalf("výchozí odhad: A %.2f, B %.2f", start.Pravdepodobnost(a), start.Pravdepodobnost(b))
	}
	var data []PrikladDruhu
	for i := range 20 {
		data = append(data, PrikladDruhu{X: smer(2, 0.1+float32(i)*0.01), T: 0, Vaha: 1})
	}
	for i := range 5 {
		data = append(data, PrikladDruhu{X: smer(0, 0.1+float32(i)*0.01), T: 1, Vaha: 1})
	}
	m := UcitDruh(data, &start)
	if pb, pa := m.Pravdepodobnost(b), m.Pravdepodobnost(a); pb >= 0.85 || pa < 0.85 {
		t.Fatalf("po potvrzeních: A %.2f (má zůstat ≥ 0,85), B %.2f (má klesnout pod 0,85)", pa, pb)
	}
	// Bez dat zůstanou výchozí váhy
	if z := UcitDruh(nil, &start); z.Posun != start.Posun || z.Vahy[0] != start.Vahy[0] {
		t.Fatal("bez potvrzení se váhy změnily")
	}
}
