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
