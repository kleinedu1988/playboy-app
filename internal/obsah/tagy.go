package obsah

// Návrhy tagů fotek z obsahu. Odhalení a partie (prsa, zadeček, klín, chodidla) navrhuje detektor (detektor.go),
// ostatní zero-shot CLIP: každý tag z katalogu (internal/sbirka) má anglické popisy, jejichž
// vektory z textové věže CLIP leží ve stejném prostoru jako vektory fotek. Fotka dostane návrh tagu, když je jejímu
// vektoru popis tagu jasně blíž než ostatní možnosti sady (Záběr, Prostředí, Oblečení…)
// (pomocná možnost bez tagu: barevná fotka, běžné světlo). Vektory popisů jsou spočítané předem a vestavěné (tagy.bin, generátor
// tagy-clip/main.go), program textovou věž nestahuje. Návrhy se jen nabízejí, zapisuje je uživatel.

import (
	"bytes"
	_ "embed"
	"math"
	"sort"

	"playboy-app/internal/sbirka"
)

//go:embed tagy.bin
var tagyBin []byte

// Logitová škála CLIP: podobnosti se před softmaxem násobí 100 (jako při učení modelu)
const skalaCLIP = 100

// Jistota, od které se tag navrhne
const minJistota = 0.6

// Popis tagu pro textovou věž: Ano = jak vypadá fotka s tagem; Sada = mezi čím se vybírá (výchozí skupina katalogu)
type PopisTagu struct {
	Klic string
	Sada string
	Ano  []string
}

// Možnost sady, která není tagem (barevná fotka, běžné světlo, bez doplňků): když vyhraje, tag se nenavrhne
const zadnyTag = "~"

// Tagy, které se z obsahu nenavrhují: bez označených fotek je zero-shot CLIP neodhadne spolehlivě (na vzorku
// sbírky vycházely u čtvrtiny až poloviny fotek); doplní je uživatel
var bezNavrhu = map[string]bool{
	"prsa": true, "zadecek": true, "vagina": true, "nohy": true, "chodidla": true,
	"zezadu": true, "mokra": true, "vic_modelek": true, "do_kamery": true, "usmev": true,
	"puncochy": true, "podvazky": true, "bunny": true,
}

// Tagy, které jsou v sadě jako možnost (aby nevyhrál soused), ale samy se nenavrhují: na vzorku sbírky (3 000 fotek,
// 6. 11. 2026) se chovaly jako šum – fotky s návrhem neměly ve stejném albu tentýž návrh častěji než jinde
// (zdvih 1,0–1,8×; spolehlivé tagy 2,5–40×). Poprsí vyhrávalo u 87 % fotek, tónovaná u 19 %.
var jenMoznost = map[string]bool{
	"poprsi": true, "lezi": true, "interier": true, "loznice": true, "tonovana": true,
}

// Popisy tagů; po změně spustit generátor (tagy-clip/main.go). Z každé sady se navrhne nejvýš jeden tag: ten, jehož
// popis je fotce nejblíž, a jen když je jasně blíž než ostatní možnosti (softmax jako při učení CLIP).
var PopisyTagu = []PopisTagu{
	// Záběr
	{Klic: "portret", Ano: []string{"a close-up portrait photo of a woman's face", "a headshot of a woman"}},
	{Klic: "poprsi", Ano: []string{"a photo of a woman from the waist up", "a half-length photo of a woman"}},
	{Klic: "postava", Ano: []string{"a full body photo of a woman, head to toe", "a full-length photo of a woman standing or lying"}},
	{Klic: "detail", Ano: []string{"a close-up detail photo of part of a body", "a cropped close-up of skin"}},
	// Odhalení
	{Klic: "oblecena", Ano: []string{"a photo of a fully clothed woman", "a woman wearing clothes"}},
	{Klic: "pradlo", Ano: []string{"a photo of a woman in lingerie", "a photo of a woman in a swimsuit", "a woman in underwear"}},
	{Klic: "nahore_bez", Ano: []string{"a photo of a topless woman", "a topless woman wearing only panties"}},
	{Klic: "akt", Ano: []string{"an artistic nude photo of a naked woman", "a nude woman", "a playboy centerfold nude"}},
	{Klic: "explicitni", Ano: []string{"an explicit hardcore pornographic photo"}},
	// Prostředí
	{Klic: "studio", Ano: []string{"a studio photo with a plain seamless backdrop", "a photo in a photo studio"}},
	{Klic: "interier", Ano: []string{"a photo taken indoors in a living room", "a photo in an interior room with furniture"}},
	{Klic: "loznice", Ano: []string{"a photo of a woman on a bed in a bedroom", "a bedroom with bed sheets"}},
	{Klic: "koupelna", Ano: []string{"a photo in a bathroom", "a woman in a bathtub or shower"}},
	{Klic: "priroda", Ano: []string{"a photo taken outdoors in nature with grass and trees", "a photo in a forest or a meadow"}},
	{Klic: "plaz", Ano: []string{"a photo on a sandy beach by the sea", "a woman on the beach with ocean waves"}},
	{Klic: "bazen", Ano: []string{"a photo at a swimming pool", "a woman by the pool"}},
	{Klic: "mesto", Ano: []string{"a photo on a city street", "an urban photo with buildings"}},
	{Klic: "auto", Ano: []string{"a woman with a car", "a woman on a motorcycle"}},
	// Oblečení a doplňky: vybírá se jeden výrazný kus, nebo nic
	{Klic: "podpatky", Ano: []string{"a woman wearing high heels", "high heel shoes"}},
	{Klic: "bikiny", Ano: []string{"a woman in a bikini", "a two-piece bikini swimsuit"}},
	{Klic: "saty", Ano: []string{"a woman wearing a dress", "a woman in a gown"}},
	{Klic: "kosile", Ano: []string{"a woman wearing a shirt", "a woman in a t-shirt"}},
	{Klic: "kostym", Ano: []string{"a woman in a costume", "a woman wearing a uniform"}},
	{Klic: "latex", Ano: []string{"a woman wearing black latex", "a woman in a leather outfit"}},
	{Klic: "dziny", Ano: []string{"a woman wearing blue jeans", "a woman in denim"}},
	{Klic: zadnyTag + "obleceni", Sada: "obleceni", Ano: []string{"a photo of a woman", "a nude woman", "a woman in lingerie"}},
	// Póza: postoj
	{Klic: "stoji", Sada: "postoj", Ano: []string{"a woman standing"}},
	{Klic: "sedi", Sada: "postoj", Ano: []string{"a woman sitting"}},
	{Klic: "lezi", Sada: "postoj", Ano: []string{"a woman lying down", "a woman reclining"}},
	{Klic: zadnyTag + "postoj", Sada: "postoj", Ano: []string{"a woman kneeling", "a close-up of a woman"}},
	// Barevnost (barevná fotka není tag)
	{Klic: "cernobila", Ano: []string{"a black and white photo", "a monochrome photograph"}},
	{Klic: "tonovana", Ano: []string{"a sepia toned photo", "a vintage tinted photograph"}},
	{Klic: zadnyTag + "barevna", Sada: "barevnost", Ano: []string{"a color photo", "a colorful photograph"}},
	// Světlo (běžné světlo není tag)
	{Klic: "high_key", Ano: []string{"a bright high-key photo with a white background", "an overexposed airy bright photo"}},
	{Klic: "low_key", Ano: []string{"a dark low-key photo with deep shadows", "a moody noir photo"}},
	{Klic: "zlata_hodina", Ano: []string{"a photo in warm golden hour sunlight", "a sunset backlit photo"}},
	{Klic: "noc", Ano: []string{"a photo at night with artificial light", "a nighttime photo with neon lights"}},
	{Klic: zadnyTag + "svetlo", Sada: "svetlo", Ano: []string{"a photo with normal even lighting", "a well-lit photo"}},
}

// Sada popisu: zadaná, jinak skupina tagu v katalogu
func (p PopisTagu) sada() string {
	if p.Sada != "" {
		return p.Sada
	}
	if sk := sbirka.SkupinaTaguMap[p.Klic]; sk != nil {
		return sk.Klic
	}
	return ""
}

// Navrh: tag a jistota (0–1)
type NavrhTagu struct {
	Tag     string  `json:"tag"`
	Jistota float32 `json:"jistota"`
}

// Sady možností s vektory popisů (pořadí podle PopisyTagu)
type sadaTagu struct {
	klice   []string
	vektory [][]float32
}

var sadyTagu []sadaTagu

// Vektory popisů podle klíče (test)
var vektoryTagu = map[string][]float32{}

func init() {
	v, err := cistVektory(bytes.NewReader(tagyBin))
	if err != nil {
		panic("tagy.bin: " + err.Error())
	}
	for i, id := range v.ids {
		radek := make([]float32, Rozmer)
		for j := range radek {
			radek[j] = float32(v.data[i*Rozmer+j]) * v.meritka[i]
		}
		vektoryTagu[id] = radek
	}
	poradi := map[string]int{}
	for _, p := range PopisyTagu {
		vt, ok := vektoryTagu[p.Klic]
		// Odhalení rozhoduje detektor (navrhyZDetektoru), CLIP jen mezi oblečenou a prádlem
		if !ok || bezNavrhu[p.Klic] || p.sada() == "odhaleni" {
			continue
		}
		i, ok := poradi[p.sada()]
		if !ok {
			i = len(sadyTagu)
			poradi[p.sada()] = i
			sadyTagu = append(sadyTagu, sadaTagu{})
		}
		sadyTagu[i].klice = append(sadyTagu[i].klice, p.Klic)
		sadyTagu[i].vektory = append(sadyTagu[i].vektory, vt)
	}
}

func skalarni(a, b []float32) float32 {
	var s float32
	for i := range a {
		s += a[i] * b[i]
	}
	return s
}

// Jistota detektoru, od které je partie na fotce (pod spodní mezí určitě není; mezi nimi se odhalení nenavrhuje)
const (
	prahPartie   = 0.45
	spodniPartie = 0.25
)

// Partie z detektoru, které jsou tagem
var tagyPartii = map[string]string{
	"FEMALE_BREAST_EXPOSED":    "prsa",
	"BUTTOCKS_EXPOSED":         "zadecek",
	"FEMALE_GENITALIA_EXPOSED": "vagina",
	"FEET_EXPOSED":             "chodidla",
}

func jistotaTridy(partie []float32, trida string) float32 {
	for i, t := range TridyDetektoru {
		if t == trida && i < len(partie) {
			return partie[i]
		}
	}
	return 0
}

// Odhalení a partie z detektoru: odhalený klín = akt, jinak odhalená prsa = nahoře bez; nic odhaleného (ani
// napůl jistě) = oblečená, nebo prádlo / plavky podle obsahu (CLIP); explicitní akt detektor neodliší
func navrhyZDetektoru(vektor, partie []float32) []NavrhTagu {
	var navrhy []NavrhTagu
	for trida, tag := range tagyPartii {
		if j := jistotaTridy(partie, trida); j >= prahPartie {
			navrhy = append(navrhy, NavrhTagu{Tag: tag, Jistota: j})
		}
	}
	klin, prsa := jistotaTridy(partie, "FEMALE_GENITALIA_EXPOSED"), jistotaTridy(partie, "FEMALE_BREAST_EXPOSED")
	zadek := jistotaTridy(partie, "BUTTOCKS_EXPOSED")
	switch {
	case klin >= prahPartie:
		navrhy = append(navrhy, NavrhTagu{Tag: "akt", Jistota: klin})
	case prsa >= prahPartie:
		navrhy = append(navrhy, NavrhTagu{Tag: "nahore_bez", Jistota: prsa})
	case klin < spodniPartie && prsa < spodniPartie && zadek < spodniPartie && len(vektor) == Rozmer:
		// Oblečená, nebo prádlo / plavky: rozhodne obsah, jen mezi těmito dvěma
		o := float64(skalaCLIP * skalarni(vektor, vektoryTagu["oblecena"]))
		p := float64(skalaCLIP * skalarni(vektor, vektoryTagu["pradlo"]))
		pp := 1 / (1 + math.Exp(o-p))
		if pp >= minJistota {
			navrhy = append(navrhy, NavrhTagu{Tag: "pradlo", Jistota: float32(pp)})
		} else if 1-pp >= minJistota {
			navrhy = append(navrhy, NavrhTagu{Tag: "oblecena", Jistota: float32(1 - pp)})
		}
	}
	return navrhy
}

// NavrhnoutTagy: tagy, které podle obsahu na fotce asi jsou, od nejjistějšího. vektor = CLIP (délka 1), partie =
// jistoty detektoru (pořadí TridyDetektoru); bez partií se odhalení a partie nenavrhují.
func NavrhnoutTagy(vektor, partie []float32) []NavrhTagu {
	var navrhy []NavrhTagu
	if len(partie) == len(TridyDetektoru) {
		navrhy = navrhyZDetektoru(vektor, partie)
	}
	if len(vektor) == Rozmer {
		for _, sada := range sadyTagu {
			logity := make([]float64, len(sada.klice))
			nej := 0
			for i, v := range sada.vektory {
				logity[i] = float64(skalaCLIP * skalarni(vektor, v))
				if logity[i] > logity[nej] {
					nej = i
				}
			}
			var soucet float64
			for _, l := range logity {
				soucet += math.Exp(l - logity[nej])
			}
			if p := 1 / soucet; p >= minJistota && sada.klice[nej][0] != zadnyTag[0] && !jenMoznost[sada.klice[nej]] {
				navrhy = append(navrhy, NavrhTagu{Tag: sada.klice[nej], Jistota: float32(p)})
			}
		}
	}
	if len(navrhy) == 0 {
		return nil
	}
	sort.SliceStable(navrhy, func(i, j int) bool {
		if navrhy[i].Jistota != navrhy[j].Jistota {
			return navrhy[i].Jistota > navrhy[j].Jistota
		}
		return navrhy[i].Tag < navrhy[j].Tag
	})
	return navrhy
}
