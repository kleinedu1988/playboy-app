package obsah

// Objevené styly (docs/NAVRH-GALERIE-KOLEKCE.md, ML #1): fotky sbírky se shlukují podle obsahu (k-means nad vektory
// CLIP) a každý shluk dostane český název – nejbližší z popisů stylů níže (zero-shot: vektory anglických popisů
// z textové věže CLIP jsou spočítané předem a vestavěné v styly.bin, generátor tagy-clip -styly). Shluky se počítají
// na pozadí a ukládají vedle vektorů (styly.json); přepočítají se, když přibude obsah.

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"math"
	"math/rand/v2"
	"os"
	"path/filepath"
	"sync"
	"time"
)

//go:embed styly.bin
var stylyBin []byte

// Popis stylu pro textovou věž: český název a anglické popisy (průměr jejich vektorů)
type PopisStylu struct {
	Klic, Nazev string
	Ano         []string
}

// Popisy stylů; po změně spustit generátor (go run ./internal/obsah/tagy-clip/main.go -styly …)
var PopisyStylu = []PopisStylu{
	// Éry a retro vzhled
	{"retro60", "Šedesátky", []string{"a 1960s vintage pin-up photo", "a retro sixties glamour photograph"}},
	{"retro70", "Retro 70. let", []string{"a 1970s vintage photo with warm faded film colors", "a seventies soft focus glamour photo"}},
	{"retro80", "Osmdesátky", []string{"a 1980s glamour photo with big hair", "an eighties fashion photo with neon and teased hair"}},
	{"retro90", "Devadesátky", []string{"a 1990s glamour photo", "a nineties fashion photo shoot"}},
	{"moderni", "Moderní digitál", []string{"a modern crisp high resolution digital photo", "a contemporary professional photo shoot"}},
	{"film", "Analogový film", []string{"a grainy analog film photograph", "a photo with film grain and faded colors"}},
	// Prostředí a scéna
	{"plaz-soumrak", "Pláž za soumraku", []string{"a woman on the beach at sunset", "golden sunset light at the seaside"}},
	{"plaz-den", "Slunná pláž", []string{"a woman on a sunny tropical beach", "bright blue sea and white sand"}},
	{"vlny", "Ve vlnách", []string{"a woman in the ocean waves", "a woman splashing in the sea water"}},
	{"bazen", "U bazénu", []string{"a woman by a swimming pool", "poolside photo with blue water"}},
	{"tropy", "Tropy a palmy", []string{"a woman under palm trees in the tropics", "a tropical jungle setting"}},
	{"poust", "Poušť", []string{"a woman in the desert", "a desert landscape with sand dunes"}},
	{"les", "V lese", []string{"a woman in a forest", "a woman among trees and green leaves"}},
	{"louka", "Na louce", []string{"a woman in a meadow with flowers", "a woman in a field of grass"}},
	{"hory", "Hory a skály", []string{"a woman on rocks in the mountains", "a rocky outdoor landscape"}},
	{"snih", "Zima a sníh", []string{"a woman in the snow", "a winter scene with snow"}},
	{"vodopad", "Řeka a vodopád", []string{"a woman by a waterfall", "a woman in a river or a lake"}},
	{"farma", "Venkov a farma", []string{"a woman on a farm with hay", "a rustic barn and countryside"}},
	{"mesto-noc", "Město v noci", []string{"a woman in a city at night with lights", "urban night street photo"}},
	{"mesto-den", "Ulice a město", []string{"a woman on a city street", "an urban street photo with buildings"}},
	{"strecha", "Na střeše", []string{"a woman on a rooftop with a city skyline", "a rooftop terrace view"}},
	{"auto", "Auta", []string{"a woman posing with a classic car", "a woman in a convertible car"}},
	{"motorka", "Motorky", []string{"a woman on a motorcycle", "a biker girl with a motorbike"}},
	{"loznice-bila", "Bílá ložnice", []string{"a woman on a bed with white sheets", "a bright bedroom with white linen"}},
	{"loznice-luxus", "Luxusní ložnice", []string{"a woman in a luxurious bedroom with satin", "an opulent boudoir"}},
	{"koupelna", "Koupelna a vana", []string{"a woman in a bathtub with bubbles", "a woman in a bathroom"}},
	{"sprcha", "Ve sprše", []string{"a woman in the shower with water drops", "wet skin under the shower"}},
	{"kuchyne", "V kuchyni", []string{"a woman in a kitchen", "a domestic kitchen scene"}},
	{"obyvak", "Obývák a gauč", []string{"a woman on a sofa in a living room", "a woman lounging on a couch"}},
	{"krb", "U krbu", []string{"a woman by a fireplace", "a cozy room with a fireplace"}},
	{"zamek", "Zámek a palác", []string{"a woman in a palace with chandeliers", "an elegant mansion interior"}},
	{"retro-interier", "Retro interiér", []string{"a woman in a vintage retro room", "a seventies interior with wood panels"}},
	{"kancelar", "Kancelář", []string{"a woman in an office at a desk", "a secretary in an office"}},
	{"bar", "Bar a klub", []string{"a woman in a bar or nightclub", "a woman at a bar counter with drinks"}},
	{"posilovna", "Fitness", []string{"a woman in a gym", "a fitness workout photo"}},
	{"jachta", "Na jachtě", []string{"a woman on a yacht or a boat", "a woman on the deck of a sailboat"}},
	{"studio-bile", "Bílé studio", []string{"a studio photo with a white background", "a clean white seamless backdrop"}},
	{"studio-cerne", "Černé studio", []string{"a studio photo with a black background", "a woman lit against a dark backdrop"}},
	{"studio-barevne", "Barevné studio", []string{"a studio photo with a colorful backdrop", "a bold colored seamless background"}},
	// Oblečení a doplňky
	{"bikiny", "Bikiny", []string{"a woman in a bikini", "a two-piece swimsuit"}},
	{"plavky", "Jednodílné plavky", []string{"a woman in a one-piece swimsuit"}},
	{"pradlo-cerne", "Černé prádlo", []string{"a woman in black lingerie", "black lace underwear"}},
	{"pradlo-bile", "Bílé prádlo", []string{"a woman in white lingerie", "white lace underwear"}},
	{"pradlo-cervene", "Červené prádlo", []string{"a woman in red lingerie", "red lace underwear"}},
	{"puncochy", "Punčochy a podvazky", []string{"a woman in stockings and garters", "nylon stockings and a garter belt"}},
	{"korzet", "Korzet", []string{"a woman in a corset", "a tight laced corset"}},
	{"saty", "Večerní šaty", []string{"a woman in an evening gown", "an elegant long dress"}},
	{"kosile", "Pánská košile", []string{"a woman wearing only an open men's shirt", "an oversized white shirt"}},
	{"dziny", "Džíny", []string{"a woman in denim jeans", "a woman in denim shorts"}},
	{"latex", "Latex a kůže", []string{"a woman in black latex", "a woman in a leather outfit"}},
	{"kostym", "Kostýmy", []string{"a woman in a costume", "a woman dressed in a uniform"}},
	{"bunny", "Bunny", []string{"a woman in a playboy bunny costume with ears"}},
	{"kovboj", "Kovbojský styl", []string{"a cowgirl with a cowboy hat and boots", "a western ranch style"}},
	{"sport", "Sportovní", []string{"a woman in sportswear", "a sporty athletic outfit"}},
	{"kozesina", "Kožešiny", []string{"a woman wrapped in fur", "a fur coat"}},
	{"satky", "Šperky a perly", []string{"a woman wearing pearls and jewelry", "a woman with diamonds and necklaces"}},
	{"klobouk", "Klobouky", []string{"a woman wearing a hat", "a woman in a wide brimmed hat"}},
	{"bryle", "Sluneční brýle", []string{"a woman with sunglasses"}},
	// Světlo, barvy a nálada
	{"zlata", "Zlatá hodina", []string{"warm golden hour sunlight", "a backlit photo with golden glow"}},
	{"noir", "Noir", []string{"a dark moody low-key photo with deep shadows", "film noir lighting"}},
	{"high-key", "Světlé a vzdušné", []string{"a bright airy high-key photo", "soft bright pastel light"}},
	{"cernobile", "Černobílé", []string{"a black and white photograph", "a monochrome photo"}},
	{"sepie", "Sépie", []string{"a sepia toned vintage photograph"}},
	{"neon", "Neon", []string{"neon lights in pink and blue", "a photo lit with colorful neon"}},
	{"svicky", "Při svíčkách", []string{"a woman lit by candlelight", "warm candle light in the dark"}},
	{"okno", "Světlo z okna", []string{"soft window light in a room", "a woman by a window with natural light"}},
	{"stiny", "Hra stínů", []string{"light and shadow stripes on the body", "shadows from blinds on skin"}},
	{"mokro", "Mokrá kůže", []string{"a woman with wet skin and wet hair", "water drops on the body"}},
	{"olej", "Olejem natřená kůže", []string{"oiled glistening skin", "shiny tanned skin"}},
	{"pastel", "Pastelové barvy", []string{"a photo in soft pastel colors"}},
	{"cervena", "V červené", []string{"a photo dominated by the color red", "red background and red clothes"}},
	{"modra", "V modré", []string{"a photo dominated by the color blue"}},
	{"romanticke", "Romantické", []string{"a romantic soft dreamy photo", "a sensual romantic mood"}},
	{"hrave", "Hravé", []string{"a playful fun cheerful photo", "a woman laughing and having fun"}},
	{"elegantni", "Elegantní", []string{"an elegant sophisticated glamour photo", "a classy fashion editorial"}},
	{"vamp", "Femme fatale", []string{"a seductive femme fatale photo", "a sultry intense gaze"}},
	{"nevinne", "Nevinné", []string{"an innocent sweet girl next door photo", "a natural fresh look"}},
	// Záběr a kompozice
	{"portret", "Portréty", []string{"a close-up portrait of a woman's face", "a beauty headshot"}},
	{"postava", "Celá postava", []string{"a full body photo of a woman standing", "a full length photo"}},
	{"lezi", "Vleže", []string{"a woman lying down on her back", "a woman lying on her stomach"}},
	{"zezadu", "Zezadu", []string{"a photo of a woman from behind", "a woman's back and bottom"}},
	{"detail", "Detaily", []string{"an artistic close-up detail of the body", "a cropped close-up of curves"}},
	{"silueta", "Siluety", []string{"a silhouette of a woman against the light"}},
	{"zrcadlo", "Zrcadla", []string{"a woman reflected in a mirror"}},
	{"dvojice", "Ve dvou", []string{"two women posing together", "a pair of women"}},
}

// Vektory popisů stylů (z styly.bin)
var vektoryStylu = map[string][]float32{}

func init() {
	v, err := cistVektory(bytes.NewReader(stylyBin))
	if err != nil {
		panic("styly.bin: " + err.Error())
	}
	for i, id := range v.ids {
		radek := make([]float32, Rozmer)
		for j := range radek {
			radek[j] = float32(v.data[i*Rozmer+j]) * v.meritka[i]
		}
		vektoryStylu[id] = radek
	}
}

// Objevený styl: název, fotky (ID souborů) a jak dobře název sedí (podobnost středu shluku a popisu)
type Styl struct {
	Klic  string   `json:"klic"`
	Nazev string   `json:"nazev"`
	Shoda float64  `json:"shoda"`
	Fotky []string `json:"fotky"`
}

// Shluků na sbírku: zhruba jeden na 300 fotek, 12–80
func pocetShluku(n int) int {
	return min(max(n/300, 12), 80)
}

// Shlukovat: k-means++ nad vektory (kosinová podobnost na vektorech délky 1), pevné semínko → opakovatelné
func (v *Vektory) Shlukovat(k, iteraci int) (prirazeni []int, stredy [][]float32) {
	v.mu.RLock()
	n := len(v.ids)
	x := make([]float32, n*Rozmer)
	for i := range n {
		m := v.meritka[i]
		for j, q := range v.data[i*Rozmer : (i+1)*Rozmer] {
			x[i*Rozmer+j] = float32(q) * m
		}
	}
	v.mu.RUnlock()
	if n < k || k < 2 {
		return nil, nil
	}
	r := rand.New(rand.NewPCG(7, 11))
	radek := func(i int) []float32 { return x[i*Rozmer : (i+1)*Rozmer] }
	podobnost := skalarni
	// k-means++: další střed s pravděpodobností úměrnou vzdálenosti od nejbližšího
	stredy = [][]float32{append([]float32(nil), radek(r.IntN(n))...)}
	vzdal := make([]float64, n)
	for i := range n {
		vzdal[i] = math.Max(0, 1-float64(podobnost(radek(i), stredy[0])))
	}
	for len(stredy) < k {
		var soucet float64
		for _, d := range vzdal {
			soucet += d * d
		}
		cil := r.Float64() * soucet
		vybrany := n - 1
		for i, d := range vzdal {
			if cil -= d * d; cil <= 0 {
				vybrany = i
				break
			}
		}
		s := append([]float32(nil), radek(vybrany)...)
		stredy = append(stredy, s)
		for i := range n {
			vzdal[i] = math.Min(vzdal[i], math.Max(0, 1-float64(podobnost(radek(i), s))))
		}
	}
	prirazeni = make([]int, n)
	nove := make([][]float32, k)
	for s := range nove {
		nove[s] = make([]float32, Rozmer)
	}
	for range iteraci {
		zmeneno := 0
		var mu sync.Mutex
		var wg sync.WaitGroup
		kusu := 4
		for c := range kusu {
			wg.Go(func() {
				z := 0
				for i := c * n / kusu; i < (c+1)*n/kusu; i++ {
					nej, nejP := 0, float32(-2)
					for s, st := range stredy {
						if p := podobnost(radek(i), st); p > nejP {
							nej, nejP = s, p
						}
					}
					if prirazeni[i] != nej {
						prirazeni[i] = nej
						z++
					}
				}
				mu.Lock()
				zmeneno += z
				mu.Unlock()
			})
		}
		wg.Wait()
		for s := range nove {
			clear(nove[s])
		}
		for i := range n {
			st := nove[prirazeni[i]]
			for j, q := range radek(i) {
				st[j] += q
			}
		}
		for s := range nove {
			if !Normalizovat(nove[s]) {
				copy(nove[s], stredy[s]) // prázdný shluk si nechá střed
			}
		}
		stredy, nove = nove, stredy
		if zmeneno < n/1000 {
			break
		}
	}
	return prirazeni, stredy
}

// Pojmenovat shluky: každému popis stylu, který ho nejvíc odlišuje od ostatních shluků – podobnost středu
// a popisu minus průměrná podobnost popisu ke všem středům (obecné popisy typu „glamour fotka“ sedí na všechno
// a vyhrávaly by). Shluky se stejným popisem jsou týž styl – při ukládání se sloučí.
func pojmenovat(stredy [][]float32) ([]string, []float64) {
	type popis struct {
		klic string
		v    []float32
	}
	var popisy []popis
	for _, p := range PopisyStylu {
		if vp := vektoryStylu[p.Klic]; len(vp) == Rozmer {
			popisy = append(popisy, popis{p.Klic, vp})
		}
	}
	podobnost := make([][]float64, len(stredy))
	prumer := make([]float64, len(popisy))
	for s, st := range stredy {
		podobnost[s] = make([]float64, len(popisy))
		for k, p := range popisy {
			var x float32
			for j := range st {
				x += st[j] * p.v[j]
			}
			podobnost[s][k] = float64(x)
			prumer[k] += float64(x) / float64(len(stredy))
		}
	}
	nazvy := make([]string, len(stredy))
	shody := make([]float64, len(stredy))
	for s := range stredy {
		nej := math.Inf(-1)
		for k, p := range popisy {
			if d := podobnost[s][k] - prumer[k]; d > nej {
				nej, nazvy[s], shody[s] = d, p.klic, podobnost[s][k]
			}
		}
	}
	return nazvy, shody
}

const nazevStylu = "styly.json"

// Uložené styly: k jakému stavu vektorů patří (počet a hash modelu)
type ulozeneStyly struct {
	Model string `json:"model"`
	Fotek int    `json:"fotek"`
	Styly []Styl `json:"styly"`
}

var stylyMu sync.Mutex

// Načtené styly.json (podle času změny souboru), ať se 19 000 ID nečte při každém dotazu
var stylyPamet struct {
	sync.Mutex
	zmena time.Time
	u     ulozeneStyly
}

// Styly sbírky ze složky obsah/ (spočítané dřív); nil, když nejsou nebo patří k jinému stavu vektorů
func (s *Sluzba) Styly() []Styl {
	if s == nil || s.slozka == "" {
		return nil
	}
	s.mu.Lock()
	if s.vektory == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	v := s.vektory
	s.mu.Unlock()
	if v == nil {
		return nil
	}
	cesta := filepath.Join(s.slozka, nazevStylu)
	info, err := os.Stat(cesta)
	if err != nil {
		return nil
	}
	stylyPamet.Lock()
	defer stylyPamet.Unlock()
	if !info.ModTime().Equal(stylyPamet.zmena) {
		data, err := os.ReadFile(cesta)
		if err != nil {
			return nil
		}
		var u ulozeneStyly
		if json.Unmarshal(data, &u) != nil {
			return nil
		}
		stylyPamet.zmena, stylyPamet.u = info.ModTime(), u
	}
	u := stylyPamet.u
	// Patří k jinému modelu nebo přibylo/ubylo přes 2 % vektorů → spočítat znovu
	if u.Model != hashModelu || abs(u.Fotek-v.Pocet()) > v.Pocet()/50 {
		return nil
	}
	return u.Styly
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// SpocitatStyly shlukuje vektory, pojmenuje shluky a uloží je (trvá několik sekund; volat na pozadí)
func (s *Sluzba) SpocitatStyly() error {
	if s == nil || s.slozka == "" {
		return errors.New("bez obsahu fotek")
	}
	if !stylyMu.TryLock() {
		return nil // už běží
	}
	defer stylyMu.Unlock()
	s.mu.Lock()
	if s.vektory == nil && Pripraveno(s.slozka) {
		s.nacistVektoryZamceno()
	}
	v := s.vektory
	s.mu.Unlock()
	if v == nil || v.Pocet() < 200 {
		return errors.New("málo vektorů")
	}
	prirazeni, stredy := v.Shlukovat(pocetShluku(v.Pocet()), 25)
	if prirazeni == nil {
		return errors.New("shlukování se nepovedlo")
	}
	nazvy, shody := pojmenovat(stredy)
	v.mu.RLock()
	fotky := make([][]string, len(stredy))
	for i, c := range prirazeni {
		fotky[c] = append(fotky[c], v.ids[i])
	}
	pocet := len(v.ids)
	v.mu.RUnlock()
	nazevPodleKlice := map[string]string{}
	for _, p := range PopisyStylu {
		nazevPodleKlice[p.Klic] = p.Nazev
	}
	u := ulozeneStyly{Model: hashModelu, Fotek: pocet}
	podleKlice := map[string]int{}
	for c := range stredy {
		if nazvy[c] == "" {
			continue
		}
		if i, ok := podleKlice[nazvy[c]]; ok {
			u.Styly[i].Fotky = append(u.Styly[i].Fotky, fotky[c]...)
			u.Styly[i].Shoda = math.Max(u.Styly[i].Shoda, math.Round(shody[c]*1000)/1000)
			continue
		}
		podleKlice[nazvy[c]] = len(u.Styly)
		u.Styly = append(u.Styly, Styl{Klic: nazvy[c], Nazev: nazevPodleKlice[nazvy[c]], Shoda: math.Round(shody[c]*1000) / 1000, Fotky: fotky[c]})
	}
	data, err := json.Marshal(u)
	if err != nil {
		return err
	}
	docasny := filepath.Join(s.slozka, ".styly.tmp")
	if err := os.WriteFile(docasny, data, 0o600); err != nil {
		return err
	}
	return os.Rename(docasny, filepath.Join(s.slozka, nazevStylu))
}
