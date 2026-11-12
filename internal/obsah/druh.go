package obsah

// Odhad druhu fotky (0.02.060, Explicitní fotky zvlášť): pravděpodobnost „muž na fotce“ a „víc žen“ z vektoru
// CLIP, který sbírka už má. Měření 0.02.059–0.02.060 ukázalo, že detektor (320n i větší 640m) muže ve scénách
// skoro nevidí a obecný popis scény CLIP plete pózovací fotky; logistická regrese nad vektory naučená z ručně
// roztříděných fotek pozná „víc žen“ s přesností ~91 % a „muže“ ~70 %. Výsledek je jen návrh – fotky se
// přeřadí až po potvrzení uživatelem (Údržba › Druh fotek).
//
// Váhy jsou vestavěné (druh.bin, generátor internal/obsah/druh-mereni -ucit). Formát (little-endian):
// "PBDRUH01" | 2 × (posun float32 | Rozmer × float32), pořadí muž, víc žen.

import (
	"bytes"
	_ "embed"
	"encoding/binary"
	"math"
)

//go:embed druh.bin
var druhBin []byte

const znackaDruhu = "PBDRUH01"

// VahyDruhu: lineární model nad vektorem CLIP; pravděpodobnost = σ(posun + váhy · vektor)
type VahyDruhu struct {
	Posun float32
	Vahy  [Rozmer]float32
}

func (m *VahyDruhu) Pravdepodobnost(vektor []float32) float64 {
	if len(vektor) != Rozmer {
		return 0
	}
	z := float64(m.Posun)
	for i, x := range vektor {
		z += float64(m.Vahy[i]) * float64(x)
	}
	return sigmoida(z)
}

func sigmoida(z float64) float64 { return 1 / (1 + math.Exp(-max(-30, min(30, z)))) }

// ZakodovatDruh: váhy obou modelů do formátu druh.bin (generátor)
func ZakodovatDruh(m [2]VahyDruhu) []byte {
	var b bytes.Buffer
	b.WriteString(znackaDruhu)
	for _, x := range m {
		binary.Write(&b, binary.LittleEndian, x.Posun)
		binary.Write(&b, binary.LittleEndian, x.Vahy)
	}
	return b.Bytes()
}

func dekodovatDruh(data []byte) (*[2]VahyDruhu, bool) {
	if !bytes.HasPrefix(data, []byte(znackaDruhu)) || len(data) != len(znackaDruhu)+2*4*(Rozmer+1) {
		return nil, false
	}
	var m [2]VahyDruhu
	r := bytes.NewReader(data[len(znackaDruhu):])
	for k := range m {
		if binary.Read(r, binary.LittleEndian, &m[k].Posun) != nil || binary.Read(r, binary.LittleEndian, &m[k].Vahy) != nil {
			return nil, false
		}
	}
	return &m, true
}

var vahyDruhu, _ = dekodovatDruh(druhBin)

// OdhadDruhu: pravděpodobnost (0–1), že je na fotce muž a že je na ní víc žen
type OdhadDruhu struct {
	Muz  float64 `json:"muz"`
	Zeny float64 `json:"zeny"`
}

// OdhadyDruhu: odhad pro každou fotku s vektorem (bez vektorů nebo vah prázdné)
func (s *Sluzba) OdhadyDruhu() map[string]OdhadDruhu {
	v := map[string]OdhadDruhu{}
	if vahyDruhu == nil {
		return v
	}
	muz := s.PodobnostiKTextu(vahyDruhu[0].Vahy[:])
	zeny := s.PodobnostiKTextu(vahyDruhu[1].Vahy[:])
	for id, x := range muz {
		v[id] = OdhadDruhu{
			Muz:  sigmoida(x + float64(vahyDruhu[0].Posun)),
			Zeny: sigmoida(zeny[id] + float64(vahyDruhu[1].Posun)),
		}
	}
	return v
}
