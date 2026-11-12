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

// VychoziVahyDruhu: vestavěné váhy (nil, když se nenačetly)
func VychoziVahyDruhu() *[2]VahyDruhu { return vahyDruhu }

// OdhadyDruhu: odhad pro každou fotku s vektorem; vahy nil = vestavěné (bez vektorů nebo vah prázdné)
func (s *Sluzba) OdhadyDruhu(vahy *[2]VahyDruhu) map[string]OdhadDruhu {
	v := map[string]OdhadDruhu{}
	if vahy == nil {
		vahy = vahyDruhu
	}
	if vahy == nil {
		return v
	}
	muz := s.PodobnostiKTextu(vahy[0].Vahy[:])
	zeny := s.PodobnostiKTextu(vahy[1].Vahy[:])
	for id, x := range muz {
		v[id] = OdhadDruhu{
			Muz:  sigmoida(x + float64(vahy[0].Posun)),
			Zeny: sigmoida(zeny[id] + float64(vahy[1].Posun)),
		}
	}
	return v
}

// PrikladDruhu: vektor fotky, cíl (1 ano, 0 ne) a váha příkladu (potvrzená fotka 1, slabý vzorek sbírky méně)
type PrikladDruhu struct {
	X    []float32
	T    float64
	Vaha float64
}

// Síla L2 k vestavěným vahám při doladění (čím víc, tím méně pár potvrzení odhad posune)
var SilaVychozichVah = 0.1

// UcitDruh (0.02.063): logistická regrese s vahami tříd. Se start (vestavěné váhy) začne z nich a L2 drží váhy
// u nich – pár potvrzení odhad jen doladí, nepřeučí; bez start je to učení od nuly (generátor druh.bin).
func UcitDruh(data []PrikladDruhu, start *VahyDruhu) VahyDruhu {
	const epoch, krok, skala = 400, 0.5, 10.0
	l2 := 1e-3
	w0 := make([]float64, Rozmer)
	b := 0.0
	l2b := 0.0 // posun se k výchozímu drží jen při doladění
	if start != nil {
		l2b = SilaVychozichVah
		l2 = SilaVychozichVah
		for j := range w0 {
			w0[j] = float64(start.Vahy[j]) / skala
		}
		b = float64(start.Posun)
	}
	b0 := b
	w := append([]float64(nil), w0...)
	kladne, zaporne := 0.0, 0.0
	for _, p := range data {
		// Měkký cíl (kotva z výchozího odhadu) se do tříd rozdělí podle své hodnoty
		kladne += p.T * p.Vaha
		zaporne += (1 - p.T) * p.Vaha
	}
	vahaAno := 1.0
	if kladne > 0 {
		vahaAno = zaporne / kladne
	}
	vahaAno = min(max(vahaAno, 0.2), 20)
	g := make([]float64, Rozmer)
	var n float64
	for _, p := range data {
		n += p.Vaha
	}
	if n == 0 {
		if start != nil {
			return *start
		}
		return VahyDruhu{}
	}
	for range epoch {
		clear(g)
		gb := 0.0
		for _, p := range data {
			z := b
			for j, x := range p.X {
				z += w[j] * float64(x) * skala
			}
			// Váha kladné třídy jen u tvrdých „ano“ (potvrzení); měkké cíle kotvy beze změny
			d := (sigmoida(z) - p.T) * p.Vaha
			if p.T == 1 {
				d *= vahaAno
			}
			for j, x := range p.X {
				g[j] += d * float64(x) * skala
			}
			gb += d
		}
		for j := range w {
			w[j] -= krok * (g[j]/n + l2*(w[j]-w0[j]))
		}
		b -= krok * (gb/n + l2b*(b-b0))
	}
	var m VahyDruhu
	m.Posun = float32(b)
	for j := range w {
		m.Vahy[j] = float32(w[j] * skala)
	}
	return m
}
