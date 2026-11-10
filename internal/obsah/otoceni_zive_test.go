package obsah

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func TestOtoceniSonda(t *testing.T) {
	domov, _ := os.UserHomeDir()
	slozka := filepath.Join(domov, ".local/share/playboy-app/obsah")
	v, err := NacistVektory(slozka)
	if err != nil {
		t.Skip(err)
	}
	m, _ := OtevritModel(slozka)
	defer m.Zavrit()
	soubory, _ := filepath.Glob(filepath.Join(domov, ".cache/playboy-app/nahledy/*/*_w400"))
	type pr struct {
		x []float32
		y int
	}
	var data []pr
	n := 0
	for i := 0; i < len(soubory) && n < 400; i += 7 {
		id := filepath.Base(soubory[i])
		id = id[:len(id)-5]
		if _, ok := v.index[id]; !ok {
			continue
		}
		b, _ := os.ReadFile(soubory[i])
		img, _, err := image.Decode(bytes.NewReader(b))
		if err != nil {
			continue
		}
		n++
		for k, u := range UhlyOtoceni {
			vek, _ := m.VektorObrazku(OtocitObrazek(img, u))
			data = append(data, pr{vek, k})
		}
	}
	uceni, test := data[:len(data)*2/3], data[len(data)*2/3:]
	var w [4][Rozmer + 1]float64
	for ep := 0; ep < 300; ep++ {
		var g [4][Rozmer + 1]float64
		for _, p := range uceni {
			var z [4]float64
			mx := -1e9
			for k := range 4 {
				z[k] = w[k][Rozmer]
				for j, x := range p.x {
					z[k] += w[k][j] * float64(x)
				}
				mx = math.Max(mx, z[k])
			}
			sum := 0.0
			for k := range 4 {
				z[k] = math.Exp(z[k] - mx)
				sum += z[k]
			}
			for k := range 4 {
				pk := z[k] / sum
				if k == p.y {
					pk -= 1
				}
				for j, x := range p.x {
					g[k][j] += pk * float64(x)
				}
				g[k][Rozmer] += pk
			}
		}
		for k := range 4 {
			for j := range g[k] {
				w[k][j] -= 2.0*g[k][j]/float64(len(uceni)) + 0.0005*w[k][j]
			}
		}
	}
	for _, prah := range []float64{0.5, 0.7, 0.8, 0.9, 0.95} {
		fal, spr, cel, rov := 0, 0, 0, 0
		for _, p := range test {
			var z [4]float64
			mx := -1e9
			for k := range 4 {
				z[k] = w[k][Rozmer]
				for j, x := range p.x {
					z[k] += w[k][j] * float64(x)
				}
				mx = math.Max(mx, z[k])
			}
			sum := 0.0
			for k := range 4 {
				z[k] = math.Exp(z[k] - mx)
				sum += z[k]
			}
			nej := 0
			for k := range 4 {
				if z[k] > z[nej] {
					nej = k
				}
			}
			jistota := z[nej] / sum
			hlasit := nej != 0 && jistota >= prah
			if p.y == 0 {
				rov++
				if hlasit {
					fal++
				}
			} else {
				cel++
				if hlasit && nej == p.y {
					spr++
				}
			}
		}
		fmt.Printf("sonda práh %.2f: rovných %d falešně %d (%.1f %%), otočených %d/%d (%.0f %%)\n", prah, rov, fal, 100*float64(fal)/float64(rov), spr, cel, 100*float64(spr)/float64(cel))
	}
}
