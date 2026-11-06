package obsah

import (
	"fmt"
	"math/rand/v2"
	"testing"
)

// Uživatel taguje podle směru obsahu, který výchozí návrh nezná: naučený tag ho po dost příkladech nahradí;
// tag s málo příklady zůstane výchozí
func TestNaucitTagy(t *testing.T) {
	r := rand.New(rand.NewPCG(11, 12))
	v := NoveVektory()
	smer := nahodnyVektor(r)
	var priklady []PrikladTagu
	for i := range 300 {
		x := nahodnyVektor(r)
		ano := i%3 == 0
		k := float32(0)
		if ano {
			k = 0.6
		}
		for j := range x {
			x[j] += k * smer[j]
		}
		Normalizovat(x)
		id := fmt.Sprintf("f%03d", i)
		v.Pridat(id, x)
		pr := PrikladTagu{ID: id, Skupiny: []string{"prostredi", "barevnost"}}
		if ano {
			pr.Tagy = []string{"plaz"}
		} else {
			pr.Tagy = []string{"studio"}
		}
		if i < 3 {
			pr.Tagy = append(pr.Tagy, "cernobila")
		}
		priklady = append(priklady, pr)
	}
	tagy := []TagUceni{{"plaz", "prostredi", true}, {"studio", "prostredi", true}, {"cernobila", "barevnost", true}}
	posledniUceni = nil
	u := naucitTagy(v, nil, priklady, tagy, func(string) []NavrhTagu { return nil })
	if u.Fotek != 300 {
		t.Fatalf("příkladů %d", u.Fotek)
	}
	if h := u.podle["plaz"]; !h.Pouzito || h.Naucene < 0.85 || h.Ano != 100 || h.Ne != 200 {
		t.Fatalf("pláž: %+v", h)
	}
	if h := u.podle["cernobila"]; h.Pouzito {
		t.Fatalf("černobílá se 3 příklady se nemá učit: %+v", h)
	}
	// Návrhy: pláž rozhodne naučená, výchozí návrh pláže u fotky bez ní zmizí; výlučná skupina jeden tag
	var dobre int
	for i := range 30 {
		id := fmt.Sprintf("f%03d", i)
		n := u.Upravit(id, []NavrhTagu{{Tag: "plaz", Jistota: 0.9}})
		pocet := 0
		ma := false
		for _, x := range n {
			if x.Tag == "plaz" || x.Tag == "studio" {
				pocet++
			}
			if x.Tag == "plaz" {
				ma = true
			}
		}
		if pocet > 1 {
			t.Fatalf("výlučná skupina má víc návrhů: %+v", n)
		}
		if ma == (i%3 == 0) {
			dobre++
		}
	}
	if dobre < 27 {
		t.Fatalf("naučená pláž sedí jen u %d z 30", dobre)
	}
	// Stejné příklady: z paměti
	if naucitTagy(v, nil, priklady, tagy, func(string) []NavrhTagu { return nil }) != u {
		t.Fatal("stejné příklady se mají vzít z paměti")
	}
}
