package kontrola

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"

	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	"pinup-katalog/internal/uceni"
)

// Návrh hodnoty chybějícího údaje modelky nebo alba
type NavrhDoplneni struct {
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"` // jen u návrhů pro album, jinak ""
	Typ       string `json:"typ"`   // typ alba, jinak ""
	// Klíč údaje: narodnost, etnicita, vlasyBarva, ociBarva, velikostPrsou, obvodHrudnikCm, obvodPasCm,
	// obvodBokyCm, role (kategorie), vydaniAlba, fotografAlba, datumAlba
	Pole    string  `json:"pole"`
	Popis   string  `json:"popis"`   // česky název údaje, např. „Národnost“
	Hodnota string  `json:"hodnota"` // navrhovaná hodnota v tom tvaru, v jakém se uloží
	Jistota float64 `json:"jistota"` // 0–1, odhad pravděpodobnosti, že je hodnota správně
	Duvod   string  `json:"duvod"`   // česky proč
	Klic    string  `json:"klic"`    // „nv-<pole>“, pod kterým se návrh odmítne
	InputID string  `json:"inputId"` // pole formuláře modelky nebo okna alba pro „Upravit…“
	// Návrh je odmítnutý; v seznamu jen při zobrazení odmítnutých
	Odmitnuto bool `json:"odmitnuto"`
	// Stabilní klíč nejsilnějšího zdroje (ZdrojeNavrhu) a česky popis všech zdrojů, které hodnotu podporují
	Zdroj      string `json:"zdroj"`
	ZdrojPopis string `json:"zdrojPopis"`
}

// Návrh i s tím, co potřebuje učení: všechny podporující zdroje a jistota před kalibrací
type NavrhSbirky struct {
	NavrhDoplneni
	Zdroje        []string `json:"zdroje"`
	JistotaVzorce float64  `json:"jistotaVzorce"`
}

// Zdroj návrhů
type ZdrojNavrhu struct {
	Popis string // česky krátce, „místo narození“
	// Zdroje téže rodiny vycházejí ze stejných údajů, takže se jako nezávislé nespojují (bere se silnější)
	Rodina string
	// Typická jistota zdroje: předpoklad kalibrace, dokud o zdroji není zpětná vazba
	Predpoklad float64
	// Odmítnutí podobného návrhu se počítá jen se stejnou hodnotou (u četností), jinak u celého zdroje
	VzorSHodnotou bool
}

var ZdrojeNavrhu = map[string]ZdrojNavrhu{
	"misto":      {Popis: "místo narození", Rodina: "misto", Predpoklad: 0.85, VzorSHodnotou: true},
	"edice":      {Popis: "edice", Rodina: "edice", Predpoklad: 0.85, VzorSHodnotou: true},
	"cetnost":    {Popis: "četnost ve sbírce", Rodina: "cetnost", Predpoklad: 0.88, VzorSHodnotou: true},
	"miry":       {Popis: "míry", Rodina: "miry", Predpoklad: 0.95},
	"regrese":    {Popis: "odhad z postavy", Rodina: "odhad", Predpoklad: 0.5},
	"podobne":    {Popis: "podobné modelky", Rodina: "odhad", Predpoklad: 0.5},
	"text":       {Popis: "poznámka", Rodina: "text", Predpoklad: 0.9},
	"nazev":      {Popis: "název alba", Rodina: "nazev", Predpoklad: 0.85},
	"centerfold": {Popis: "centerfold", Rodina: "centerfold", Predpoklad: 0.75},
	"cislo":      {Popis: "fotograf čísla", Rodina: "fotograf", Predpoklad: 0.8},
	"modelka":    {Popis: "fotograf modelky", Rodina: "fotograf", Predpoklad: 0.7},
}

// Pořadí zdrojů v důvodu návrhu a v přehledu učení
var PoradiZdroju = []string{"misto", "edice", "cetnost", "miry", "regrese", "podobne", "text", "nazev", "centerfold", "cislo", "modelka"}

// Údaj, pro který se návrhy dělají
type UdajNavrhu struct {
	Popis   string // „Národnost“
	Input   string // pole formuláře modelky
	Sloupec string // sloupec tabulky modelky nebo alba
	Cislo   bool   // celé číslo (obvody)
	Album   bool   // údaj alba
	Netyka  string // klíč „netýká se“ modelky, který návrhy údaje vypne (údaje se u ní nesledují)
}

var UdajeNavrhu = map[string]UdajNavrhu{
	"narodnost":      {Popis: "Národnost", Input: "inputNarodnost", Sloupec: "narodnost", Netyka: "zakladni"},
	"etnicita":       {Popis: "Etnicita", Input: "inputEtnicita", Sloupec: "etnicita", Netyka: "zakladni"},
	"vlasyBarva":     {Popis: "Barva vlasů", Input: "inputVlasy", Sloupec: "vlasy_barva", Netyka: "vzhled"},
	"ociBarva":       {Popis: "Barva očí", Input: "inputOci", Sloupec: "oci_barva", Netyka: "vzhled"},
	"velikostPrsou":  {Popis: "Velikost prsou", Input: "inputVelikost", Sloupec: "velikost_prsou", Netyka: "vzhled"},
	"obvodHrudnikCm": {Popis: "Hrudník", Input: "inputHrudnik", Sloupec: "obvod_hrudnik_cm", Cislo: true, Netyka: "vzhled"},
	"obvodPasCm":     {Popis: "Pas", Input: "inputPas", Sloupec: "obvod_pas_cm", Cislo: true, Netyka: "vzhled"},
	"obvodBokyCm":    {Popis: "Boky", Input: "inputBoky", Sloupec: "obvod_boky_cm", Cislo: true, Netyka: "vzhled"},
	"role":           {Popis: "Kategorie", Input: "inputRole", Sloupec: "role", Netyka: "zarazeni"},
	"vydaniAlba":     {Popis: "Vydání alba", Input: "inputAlbumRok", Sloupec: "vydani", Album: true},
	"fotografAlba":   {Popis: "Fotograf alba", Input: "inputAlbumFotograf", Sloupec: "fotograf", Album: true},
	"datumAlba":      {Popis: "Datum nafocení", Input: "inputAlbumDatum", Sloupec: "datum", Album: true},
	"typAlba":        {Popis: "Druh pictorialu", Input: "selectTyp", Sloupec: "typ", Album: true},
}

// Klíče odmítnutých návrhů (ukládají se mezi „netýká se“ modelky a alba jako „ok-…“ u kontroly)
var KliceNavrhuModelky, KliceNavrhuAlba = func() (map[string]bool, map[string]bool) {
	modelky, alba := map[string]bool{}, map[string]bool{}
	for pole, u := range UdajeNavrhu {
		if u.Album {
			alba[KlicNavrhu(pole)] = true
		} else {
			modelky[KlicNavrhu(pole)] = true
		}
	}
	return modelky, alba
}()

func KlicNavrhu(pole string) string { return "nv-" + pole }

// Klíč hodnoty pro porovnání a odmítnutí: národnost podle země (USA = Americká), jinak zjednodušený text
func KlicHodnoty(pole, hodnota string) string {
	if pole == "narodnost" {
		return KlicNarodnosti(hodnota)
	}
	return uceni.KlicTextu(hodnota)
}

// Obvod (pole návrhu) → index údaje postavy (uceni/modely.go)
var ObvodyNavrhu = []struct {
	Pole string
	J    int
}{{"obvodHrudnikCm", uceni.PrHrudnik}, {"obvodPasCm", uceni.PrPas}, {"obvodBokyCm", uceni.PrBoky}}

// Prahy a váhy
const (
	PrahNavrhu         = 0.7  // slabší návrh se nenabízí
	StropJistoty       = 0.99 // ani stokrát ověřené pravidlo není jisté (překlep, výjimka)
	PrahVzhledu        = 0.85 // etnicita, barva vlasů a očí: jen silně jednoznačné rozložení
	PrahEdice          = 0.8  // národnost jen podle edice čísel
	StropVzhledu       = 0.9  // naučený vzhled nikdy nemá vyšší jistotu (vlasy se barví, sbírka není svět)
	MinModelekEtnicity = 8
	MinModelekVzhledu  = 10 // podmínka etnicita + národnost
	MinModelekObecne   = 15 // podmínka jen etnicita nebo jen národnost
	MinModelekEdice    = 5
	VahaTabulkyZemi    = 8   // tabulka zemí váží jako 8 modelek sbírky
	PodilNoveHodnoty   = 0.8 // národnost, kterou ve sbírce ještě nikdo nemá (tvar zápisu nemusí sedět)
	VahaOdmitnuti      = 6   // jistota × w/(w + počet odmítnutých podobných návrhů)
	PrahOdhadu         = 0.6 // odhad obvodu jen když se u sbírky trefí do ±2 cm aspoň u 60 % modelek
	StropOdhadu        = 0.6 // odhad nikdy nepůsobí jistě
	MinJistotaOdhadu   = 0.3 // odhad, kterému kalibrace sebrala víc, se nezobrazuje (zdroj selhává)
	TlumeniOdhadu      = 0.25
)

// Album pro návrhy
type AlbumNavrhu struct {
	ModelkaID                     int
	Nazev, Typ                    string
	Vydani, Datum, Fotograf, Neni string // Neni = „netýká se“ alba
	Fotek                         int
}

// Alba modelek pro návrhy (ze snímku sbírky) v pořadí modelka, název, typ
func AlbaProNavrhy(alba []sbirka.AlbumSbirky) []AlbumNavrhu {
	vysledek := make([]AlbumNavrhu, 0, len(alba))
	for _, al := range alba {
		vysledek = append(vysledek, AlbumNavrhu{
			ModelkaID: al.ModelkaID, Nazev: al.Nazev, Typ: al.Typ, Vydani: al.Vydani,
			Datum: al.Datum, Fotograf: al.Fotograf, Neni: al.Neni, Fotek: al.Fotek,
		})
	}
	sort.SliceStable(vysledek, func(i, j int) bool {
		x, y := vysledek[i], vysledek[j]
		if x.ModelkaID != y.ModelkaID {
			return x.ModelkaID < y.ModelkaID
		}
		if x.Nazev != y.Nazev {
			return x.Nazev < y.Nazev
		}
		return x.Typ < y.Typ
	})
	return vysledek
}

// Údaj, ke kterému návrh patří (modelka, u alba i název a typ)
type KlicUdaje struct {
	Modelka    int
	Album, Typ string
	Pole       string
}

// Co se návrhy naučily ze zpětné vazby (uceni.go); nil = jen ze sbírky
type VstupUceni struct {
	Odmitnute map[KlicUdaje]map[string]bool    // odmítnuté hodnoty (KlicHodnoty) podle údaje
	Kalibrace map[string]uceni.KalibraceZdroje // podle klíče zdroje
	Zapisy    map[string]map[string]string     // pole → klíč hodnoty → zápis z oprav uživatele
}

// Kandidát návrhu jednoho zdroje
type Kandidat struct {
	NavrhDoplneni
	Vzor        string // co mají podobné návrhy společné (pro učení z odmítnutí)
	KlicHodnoty string
	DalsiZdroje []string // zdroje sloučené do kandidáta (shodné odhady obvodů)
}

// Funkce, kterou zdroje přidávají kandidáty (al = nil u údaje modelky; zdroj = klíč ze ZdrojeNavrhu)
type PridatKandidata func(m hledani.Modelka, al *AlbumNavrhu, pole, hodnota, duvod, zdroj string, jistota float64)

// Návrhy s učením ze zpětné vazby (uc může být nil)
func Navrhnout(modelky []hledani.Modelka, alba []AlbumNavrhu, letos int, uc *VstupUceni) []NavrhSbirky {
	novyKandidat := func(m hledani.Modelka, al *AlbumNavrhu, pole, hodnota, duvod, zdroj string, jistota float64) Kandidat {
		u := UdajeNavrhu[pole]
		k := Kandidat{NavrhDoplneni: NavrhDoplneni{
			ModelkaID: m.ID, Jmeno: m.Jmeno, Pole: pole, Popis: u.Popis, Hodnota: hodnota,
			Jistota: jistota, Duvod: duvod, Klic: KlicNavrhu(pole), InputID: u.Input, Zdroj: zdroj,
		}}
		k.KlicHodnoty = KlicHodnoty(pole, hodnota)
		k.Vzor = pole + "|" + zdroj
		if ZdrojeNavrhu[zdroj].VzorSHodnotou {
			k.Vzor += "|" + k.KlicHodnoty
		}
		neni := m.NetykaSe
		if al != nil {
			k.Album, k.Typ, neni = al.Nazev, al.Typ, al.Neni
		}
		// Odmítnutá hodnota (databáze učení); klíč „nv-“ bez záznamu v databázi odmítá celý údaj
		if sbirka.ObsahujeKlic(neni, k.Klic) {
			var hodnoty map[string]bool
			if uc != nil {
				hodnoty = uc.Odmitnute[KlicUdaje{k.ModelkaID, k.Album, k.Typ, pole}]
			}
			k.Odmitnuto = len(hodnoty) == 0 || hodnoty[k.KlicHodnoty]
		}
		return k
	}
	predpoklady := PredpokladyHodnot(modelky, alba)
	var zapisy map[string]map[string]string
	if uc != nil {
		zapisy = uc.Zapisy
	}

	// Zdroje jsou na sobě nezávislé a jen čtou modelky, alba a naučené (uc): počítají se souběžně, každý do
	// vlastního seznamu, a kandidáti se spojí v pevném pořadí zdrojů (výsledek je stejný jako po jednom)
	zdroje := []func(pridat PridatKandidata){
		func(pridat PridatKandidata) { NavrhnoutNarodnosti(modelky, zapisy["narodnost"], pridat) },
		func(pridat PridatKandidata) { NavrhnoutVzhled(modelky, zapisy, pridat) },
		func(pridat PridatKandidata) { NavrhnoutMiry(modelky, pridat) },
		func(pridat PridatKandidata) { NavrhnoutPlaymateRoku(modelky, alba, pridat) },
		func(pridat PridatKandidata) { NavrhnoutAlba(modelky, alba, letos, zapisy["fotografAlba"], pridat) },
	}
	podleZdroje := make([][]Kandidat, len(zdroje))
	var cekani sync.WaitGroup
	for i, spustit := range zdroje {
		cekani.Add(1)
		go func() {
			defer cekani.Done()
			spustit(func(m hledani.Modelka, al *AlbumNavrhu, pole, hodnota, duvod, zdroj string, jistota float64) {
				podleZdroje[i] = append(podleZdroje[i], novyKandidat(m, al, pole, hodnota, duvod, zdroj, jistota))
			})
		}()
	}
	cekani.Wait()
	var kandidati []Kandidat
	for _, k := range podleZdroje {
		kandidati = append(kandidati, k...)
	}

	var kalibrace map[string]uceni.KalibraceZdroje
	if uc != nil {
		kalibrace = uc.Kalibrace
	}
	return VybratNavrhy(kandidati, predpoklady, kalibrace)
}

// Předpoklad hodnoty bez jakéhokoli zdroje (π pro spojení zdrojů): podíl hodnoty mezi vyplněnými údaji sbírky
// s Laplaceovým vyhlazením (k + 1)/(n + K + 1); jedna pseudo-hodnota navíc nechává místo pro hodnotu, kterou
// sbírka ještě nezná. Klíč pole + "\x00" + klicHodnoty.
type PredpokladyNavrhu struct {
	Pocty   map[string]int
	Celkem  map[string]int
	Ruznych map[string]int
}

func PredpokladyHodnot(modelky []hledani.Modelka, alba []AlbumNavrhu) PredpokladyNavrhu {
	p := PredpokladyNavrhu{Pocty: map[string]int{}, Celkem: map[string]int{}, Ruznych: map[string]int{}}
	pridat := func(pole, hodnota string) {
		if strings.TrimSpace(hodnota) == "" || hodnota == "0" {
			return
		}
		k := pole + "\x00" + KlicHodnoty(pole, hodnota)
		if p.Pocty[k] == 0 {
			p.Ruznych[pole]++
		}
		p.Pocty[k]++
		p.Celkem[pole]++
	}
	for _, m := range modelky {
		pridat("narodnost", m.Narodnost)
		pridat("etnicita", m.Etnicita)
		pridat("vlasyBarva", m.VlasyBarva)
		pridat("ociBarva", m.OciBarva)
		pridat("velikostPrsou", m.VelikostPrsou)
		pridat("obvodHrudnikCm", strconv.Itoa(m.ObvodHrudnikCm))
		pridat("obvodPasCm", strconv.Itoa(m.ObvodPasCm))
		pridat("obvodBokyCm", strconv.Itoa(m.ObvodBokyCm))
	}
	for _, al := range alba {
		pridat("vydaniAlba", al.Vydani)
		pridat("fotografAlba", al.Fotograf)
		pridat("datumAlba", al.Datum)
	}
	return p
}

func (p PredpokladyNavrhu) Hodnoty(pole, klic string) float64 {
	return (float64(p.Pocty[pole+"\x00"+klic]) + 1) / (float64(p.Celkem[pole]+p.Ruznych[pole]) + 1)
}

// Výběr návrhů: učení z odmítnutí, kalibrace zdrojů, spojení zdrojů téhož údaje, spor, práh a řazení
func VybratNavrhy(kandidati []Kandidat, predpoklady PredpokladyNavrhu, kalibrace map[string]uceni.KalibraceZdroje) []NavrhSbirky {
	// Odmítnuté podobné návrhy: stejný údaj, zdroj a u četností i hodnota
	odmitnute := map[string]int{}
	for _, k := range kandidati {
		if k.Odmitnuto {
			odmitnute[k.Vzor]++
		}
	}
	for i := range kandidati {
		k := &kandidati[i]
		// U zdroje bez hodnoty ve vzoru je to totéž, co kalibrace z databáze učení; s ní se nepočítá dvakrát
		if _, kalibrovany := kalibrace[k.Zdroj]; kalibrovany && !ZdrojeNavrhu[k.Zdroj].VzorSHodnotou {
			continue
		}
		d := odmitnute[k.Vzor]
		if k.Odmitnuto {
			d--
		}
		if d > 0 {
			k.Jistota *= VahaOdmitnuti / (VahaOdmitnuti + float64(d))
			k.Duvod += fmt.Sprintf("; podobný návrh odmítnut %d×", d)
		}
	}

	// Kandidáti podle údaje (v pořadí prvního výskytu, aby byl výsledek deterministický)
	skupiny := map[KlicUdaje][]int{}
	var poradi []KlicUdaje
	for i, k := range kandidati {
		ku := KlicUdaje{k.ModelkaID, k.Album, k.Typ, k.Pole}
		if _, ok := skupiny[ku]; !ok {
			poradi = append(poradi, ku)
		}
		skupiny[ku] = append(skupiny[ku], i)
	}
	navrhy := []NavrhSbirky{}
	for _, ku := range poradi {
		navrhy = append(navrhy, VybratZeSkupiny(kandidati, skupiny[ku], predpoklady, kalibrace)...)
	}
	for i := range navrhy {
		navrhy[i].Jistota = math.Round(min(navrhy[i].Jistota, StropJistoty)*1000) / 1000
		navrhy[i].JistotaVzorce = math.Round(min(navrhy[i].JistotaVzorce, StropJistoty)*1000) / 1000
	}

	klice := make([]string, len(navrhy))
	for i, n := range navrhy {
		klice[i] = hledani.Zjednodusit(n.Jmeno) + "\x00" + n.Album + "\x00" + n.Typ + "\x00" + n.Pole + "\x00" + n.Hodnota
	}
	index := make([]int, len(navrhy))
	for i := range index {
		index[i] = i
	}
	sort.SliceStable(index, func(x, y int) bool {
		a, b := navrhy[index[x]], navrhy[index[y]]
		if a.Jistota != b.Jistota {
			return a.Jistota > b.Jistota
		}
		if klice[index[x]] != klice[index[y]] {
			return klice[index[x]] < klice[index[y]]
		}
		return a.ModelkaID < b.ModelkaID
	})
	serazene := make([]NavrhSbirky, len(navrhy))
	for i, j := range index {
		serazene[i] = navrhy[j]
	}
	return serazene
}

// Hodnota navržená pro údaj a zdroje, které ji podporují (z každé rodiny nejsilnější kandidát)
type hodnotaUdaje struct {
	klic      string
	kandidati []int // indexy do kandidátů, podle síly sestupně
	odmitnuto bool
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// Návrhy pro jeden údaj. Z každé rodiny zdrojů se bere nejsilnější kandidát; odhady obvodů (regrese a sousedé)
// se slučují zvlášť. Pro každou hodnotu se pak spojí důkazy všech rodin (spojeníHodnoty): rodiny, které ji
// podporují, jistotu zvednou, rodiny jiné hodnoty ji sníží. Odmítnutá hodnota se do soutěže nepočítá (víme, že je
// u modelky špatně), jen se vrátí s příznakem. Prošly-li by dvě různé hodnoty, je údaj sporný a nenavrhuje se.
func VybratZeSkupiny(kandidati []Kandidat, indexy []int, predpoklady PredpokladyNavrhu, kalibrace map[string]uceni.KalibraceZdroje) []NavrhSbirky {
	// Kalibrovaná jistota každého kandidáta
	kalibrovana := map[int]float64{}
	for _, i := range indexy {
		kalibrovana[i] = kalibrace[kandidati[i].Zdroj].Upravit(kandidati[i].Jistota, ZdrojeNavrhu[kandidati[i].Zdroj].Predpoklad)
	}
	silnejsi := func(i, j int) bool {
		if kalibrovana[i] != kalibrovana[j] {
			return kalibrovana[i] > kalibrovana[j]
		}
		return i < j
	}
	// Rodina → hodnota → nejsilnější kandidát
	nejlepsi := map[string]map[string]int{}
	var rodiny []string
	for _, i := range indexy {
		k := kandidati[i]
		r := ZdrojeNavrhu[k.Zdroj].Rodina
		if nejlepsi[r] == nil {
			nejlepsi[r] = map[string]int{}
			rodiny = append(rodiny, r)
		}
		if j, ok := nejlepsi[r][k.KlicHodnoty]; !ok || silnejsi(i, j) {
			nejlepsi[r][k.KlicHodnoty] = i
		}
	}
	// Odhady obvodů: regrese a sousedé do ±1 cm se shodnou (silnější hodnota, jistota spojená s tlumením),
	// o 3 cm a víc se přou (odhad se nenavrhuje), jinak platí silnější
	if odhady := nejlepsi["odhad"]; len(odhady) > 1 {
		var seznam []int
		for _, i := range odhady {
			seznam = append(seznam, i)
		}
		sort.Slice(seznam, func(a, b int) bool { return silnejsi(seznam[a], seznam[b]) })
		prvni := seznam[0]
		x, _ := strconv.Atoi(kandidati[prvni].Hodnota)
		zustava := map[string]int{kandidati[prvni].KlicHodnoty: prvni}
		for _, i := range seznam[1:] {
			y, _ := strconv.Atoi(kandidati[i].Hodnota)
			switch rozdil := absInt(x - y); {
			case rozdil >= 3:
				zustava = nil
			case rozdil <= 1 && zustava != nil:
				p := []float64{kalibrovana[prvni], kalibrovana[i]}
				pi := predpoklady.Hodnoty(kandidati[prvni].Pole, kandidati[prvni].KlicHodnoty)
				kalibrovana[prvni] = min(StropOdhadu, uceni.SpojitZdroje(p, pi, TlumeniOdhadu))
				kandidati[prvni].Jistota = min(StropOdhadu, uceni.SpojitZdroje([]float64{kandidati[prvni].Jistota, kandidati[i].Jistota}, pi, TlumeniOdhadu))
				kandidati[prvni].Duvod += "; " + kandidati[i].Duvod
				kandidati[prvni].ZdrojPopis = ZdrojeNavrhu[kandidati[prvni].Zdroj].Popis + " + " + ZdrojeNavrhu[kandidati[i].Zdroj].Popis
				kandidati[prvni].DalsiZdroje = append(kandidati[prvni].DalsiZdroje, kandidati[i].Zdroj)
			}
		}
		nejlepsi["odhad"] = zustava
		if zustava == nil {
			delete(nejlepsi, "odhad")
		}
	}

	// Hodnoty a jejich podpora
	hodnoty := map[string]*hodnotaUdaje{}
	var klice []string
	for _, r := range rodiny {
		for klic, i := range nejlepsi[r] {
			h := hodnoty[klic]
			if h == nil {
				h = &hodnotaUdaje{klic: klic}
				hodnoty[klic] = h
				klice = append(klice, klic)
			}
			h.kandidati = append(h.kandidati, i)
			h.odmitnuto = h.odmitnuto || kandidati[i].Odmitnuto
		}
	}
	sort.Strings(klice)
	for _, h := range hodnoty {
		sort.Slice(h.kandidati, func(a, b int) bool { return silnejsi(h.kandidati[a], h.kandidati[b]) })
	}
	if len(klice) == 0 {
		return nil
	}
	pole := kandidati[indexy[0]].Pole
	// Spojená jistota hodnoty: kalibrovaná a před kalibrací (vzorec, pro zpětnou vazbu)
	spojit := func(h *hodnotaUdaje, jistota func(int) float64) float64 {
		pi := predpoklady.Hodnoty(pole, h.klic)
		var pro []float64
		for _, i := range h.kandidati {
			pro = append(pro, jistota(i))
		}
		x := uceni.Logit(uceni.SpojitZdroje(pro, pi, uceni.TlumeniZavislosti))
		// Proti: rodina, jejíž nejsilnější neodmítnutá hodnota je jiná, pravděpodobnost téhle hodnoty snižuje
		// na q = (1 − p)·π/(1 − π_jiné) – zbytek své jistoty rozdělí mezi ostatní hodnoty podle předpokladů
		for _, druha := range klice {
			g := hodnoty[druha]
			if druha == h.klic || g.odmitnuto {
				continue
			}
			for _, i := range g.kandidati {
				if podporuje(h, kandidati[i].Zdroj, kandidati) {
					continue
				}
				q := (1 - jistota(i)) * pi / max(0.01, 1-predpoklady.Hodnoty(pole, druha))
				x += uceni.TlumeniZavislosti * (uceni.Logit(q) - uceni.Logit(pi))
			}
		}
		return uceni.ZLogitu(x)
	}
	type vysledek struct {
		h               *hodnotaUdaje
		jistota, vzorec float64
	}
	var vysledky []vysledek
	for _, klic := range klice {
		h := hodnoty[klic]
		v := vysledek{
			h:       h,
			jistota: spojit(h, func(i int) float64 { return kalibrovana[i] }),
			vzorec:  spojit(h, func(i int) float64 { return kandidati[i].Jistota }),
		}
		vysledky = append(vysledky, v)
	}
	odhad := func(v vysledek) bool { return ZdrojeNavrhu[kandidati[v.h.kandidati[0]].Zdroj].Rodina == "odhad" }
	prosel := func(v vysledek) bool {
		if odhad(v) {
			return v.jistota >= MinJistotaOdhadu
		}
		return v.jistota >= PrahNavrhu
	}
	// Spor: dvě neodmítnuté hodnoty, z nichž by skoro prošly obě
	sporne := 0
	for _, v := range vysledky {
		if !v.h.odmitnuto && !odhad(v) && v.jistota >= PrahNavrhu*0.9 {
			sporne++
		}
	}
	var navrhy []NavrhSbirky
	var nejNeodmitnuta *vysledek
	for i, v := range vysledky {
		// Odmítnutá hodnota se vrací vždy (s příznakem), aby šlo odmítnutí zrušit, i když jistota mezitím klesla
		if v.h.odmitnuto {
			navrhy = append(navrhy, SestavitNavrh(kandidati, v.h, v.jistota, v.vzorec))
			continue
		}
		if !prosel(v) || sporne > 1 {
			continue
		}
		if nejNeodmitnuta == nil || v.jistota > nejNeodmitnuta.jistota {
			nejNeodmitnuta = &vysledky[i]
		}
	}
	if nejNeodmitnuta != nil {
		navrhy = append(navrhy, SestavitNavrh(kandidati, nejNeodmitnuta.h, nejNeodmitnuta.jistota, nejNeodmitnuta.vzorec))
	}
	return navrhy
}

// Hodnotu podporuje kandidát zdroje (pro „proti“ se zdroj, který ji sám podporuje, nepočítá)
func podporuje(h *hodnotaUdaje, zdroj string, kandidati []Kandidat) bool {
	for _, i := range h.kandidati {
		if kandidati[i].Zdroj == zdroj {
			return true
		}
	}
	return false
}

// Návrh z hodnoty: zápis a důvod nejsilnějšího zdroje, důvody dalších zdrojů v pořadí zdrojů
func SestavitNavrh(kandidati []Kandidat, h *hodnotaUdaje, jistota, vzorec float64) NavrhSbirky {
	hlavni := kandidati[h.kandidati[0]]
	n := NavrhSbirky{NavrhDoplneni: hlavni.NavrhDoplneni, JistotaVzorce: vzorec}
	n.Jistota = jistota
	n.Odmitnuto = h.odmitnuto
	podle := append([]int(nil), h.kandidati...)
	sort.SliceStable(podle, func(a, b int) bool {
		return PoradiZdroje(kandidati[podle[a]].Zdroj) < PoradiZdroje(kandidati[podle[b]].Zdroj)
	})
	var duvody, popisy []string
	for _, i := range podle {
		k := kandidati[i]
		duvody = append(duvody, k.Duvod)
		if k.ZdrojPopis != "" {
			popisy = append(popisy, k.ZdrojPopis)
		} else {
			popisy = append(popisy, ZdrojeNavrhu[k.Zdroj].Popis)
		}
		n.Zdroje = append(n.Zdroje, k.Zdroj)
		n.Zdroje = append(n.Zdroje, k.DalsiZdroje...)
	}
	n.Duvod = strings.Join(duvody, "; zároveň ")
	n.ZdrojPopis = strings.Join(popisy, " + ")
	if vzorec != 0 && math.Abs(jistota-vzorec) >= 0.005 {
		n.Duvod += fmt.Sprintf("; podle dosavadních rozhodnutí upraveno z %d %% na %d %%", int(math.Round(min(vzorec, StropJistoty)*100)), int(math.Round(min(jistota, StropJistoty)*100)))
	}
	return n
}

func PoradiZdroje(zdroj string) int {
	for i, z := range PoradiZdroju {
		if z == zdroj {
			return i
		}
	}
	return len(PoradiZdroju)
}

// Modelka nesleduje údaje skupiny („netýká se“)
func NeniKNavrhu(m hledani.Modelka, pole string) bool {
	u := UdajeNavrhu[pole]
	return u.Netyka != "" && sbirka.ObsahujeKlic(m.NetykaSe, u.Netyka)
}
