package kontrola

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"pinup-katalog/internal/hledani"
	"pinup-katalog/internal/sbirka"
	"pinup-katalog/internal/uceni"
)

// Země: výchozí zápis národnosti, názvy (místa narození) a další tvary národnosti; vše zjednodušené (KlicTextu)
// kromě výchozího zápisu. Výchozí zápis se použije, jen když národnost ve sbírce ještě nikdo nemá; jinak se
// píše nejčastější zápis sbírky (USA, Americká…).
var TabulkaZemi = []struct{ Narodnost, Nazvy, Tvary string }{
	{"USA", "usa|us|united states|united states of america|spojene staty|spojene staty americke|amerika|america", "americka|american|americanka"},
	{"Kanada", "kanada|canada", "kanadska|canadian|kanadanka"},
	{"Česko", "cesko|ceska republika|czech republic|czechia|cr", "ceska|czech|cesko|ceska republika|cr|ceska narodnost|cechie"},
	{"Slovensko", "slovensko|slovakia|slovak republic|slovenska republika|sr", "slovenska|slovak|slovenka"},
	{"Velká Británie", "velka britanie|britanie|united kingdom|uk|great britain|spojene kralovstvi|anglie|england|skotsko|scotland|wales|severni irsko|northern ireland", "britska|british|anglicka|english|britka|anglicanka"},
	{"Irsko", "irsko|ireland|eire", "irska|irish"},
	{"Německo", "nemecko|germany|deutschland|nsr|ndr|west germany|east germany|zapadni nemecko|vychodni nemecko", "nemecka|german|nemka"},
	{"Rakousko", "rakousko|austria|osterreich", "rakouska|austrian"},
	{"Švýcarsko", "svycarsko|switzerland|schweiz|suisse", "svycarska|swiss"},
	{"Francie", "francie|france", "francouzska|french|francouzka"},
	{"Belgie", "belgie|belgium|belgique", "belgicka|belgian"},
	{"Nizozemsko", "nizozemsko|netherlands|holandsko|holland|nederland|the netherlands", "nizozemska|holandska|dutch"},
	{"Dánsko", "dansko|denmark|danmark", "danska|danish"},
	{"Švédsko", "svedsko|sweden|sverige", "svedska|swedish"},
	{"Norsko", "norsko|norway|norge", "norska|norwegian"},
	{"Finsko", "finsko|finland|suomi", "finska|finnish"},
	{"Island", "island|iceland", "islandska|icelandic"},
	{"Itálie", "italie|italy|italia", "italska|italian"},
	{"Španělsko", "spanelsko|spain|espana", "spanelska|spanish"},
	{"Portugalsko", "portugalsko|portugal", "portugalska|portuguese"},
	{"Řecko", "recko|greece", "recka|greek"},
	{"Polsko", "polsko|poland|polska", "polska|polish"},
	{"Maďarsko", "madarsko|hungary|magyarorszag", "madarska|hungarian"},
	{"Rumunsko", "rumunsko|romania", "rumunska|romanian"},
	{"Bulharsko", "bulharsko|bulgaria", "bulharska|bulgarian"},
	{"Chorvatsko", "chorvatsko|croatia|hrvatska", "chorvatska|croatian"},
	{"Srbsko", "srbsko|serbia|srbija", "srbska|serbian"},
	{"Slovinsko", "slovinsko|slovenia|slovenija", "slovinska|slovenian"},
	{"Rusko", "rusko|russia|ruska federace|russian federation", "ruska|russian"},
	{"Ukrajina", "ukrajina|ukraine", "ukrajinska|ukrainian"},
	{"Bělorusko", "belorusko|belarus", "beloruska|belarusian"},
	{"Estonsko", "estonsko|estonia", "estonska|estonian"},
	{"Lotyšsko", "lotyssko|latvia", "lotysska|latvian"},
	{"Litva", "litva|lithuania", "litevska|lithuanian"},
	{"Turecko", "turecko|turkey|turkiye", "turecka|turkish"},
	{"Izrael", "izrael|israel", "izraelska|israeli"},
	{"Austrálie", "australie|australia", "australska|australian"},
	{"Nový Zéland", "novy zeland|new zealand", "novozelandska|new zealander"},
	{"Japonsko", "japonsko|japan", "japonska|japanese"},
	{"Čína", "cina|china", "cinska|chinese"},
	{"Jižní Korea", "jizni korea|south korea|korea", "korejska|jihokorejska|korean|south korean"},
	{"Filipíny", "filipiny|philippines", "filipinska|filipino|filipina"},
	{"Thajsko", "thajsko|thailand", "thajska|thai"},
	{"Vietnam", "vietnam|viet nam", "vietnamska|vietnamese"},
	{"Indie", "indie|india", "indicka|indian"},
	{"Jihoafrická republika", "jihoafricka republika|jar|south africa", "jihoafricka|south african"},
	{"Mexiko", "mexiko|mexico", "mexicka|mexican"},
	{"Brazílie", "brazilie|brazil|brasil", "brazilska|brazilian"},
	{"Argentina", "argentina", "argentinska|argentine|argentinian"},
	{"Kolumbie", "kolumbie|colombia", "kolumbijska|colombian"},
	{"Venezuela", "venezuela", "venezuelska|venezuelan"},
	{"Kuba", "kuba|cuba", "kubanska|cuban"},
	{"Chile", "chile", "chilska|chilean"},
	{"Peru", "peru", "peruanska|peruvian"},
}

// Další místa, která jednoznačně patří k zemi: státy USA, provincie Kanady a velká města
var MistaZemi = map[string]string{
	"USA": "alabama|alaska|arizona|arkansas|california|kalifornie|colorado|kolorado|connecticut|delaware|florida|hawaii|havaj|" +
		"idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|" +
		"missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|novy mexiko|new york|ohio|oklahoma|oregon|" +
		"pennsylvania|pensylvanie|rhode island|north carolina|severni karolina|south carolina|jizni karolina|north dakota|" +
		"severni dakota|south dakota|jizni dakota|tennessee|texas|utah|vermont|virginia|virginie|washington|west virginia|" +
		"zapadni virginie|wisconsin|wyoming|district of columbia|washington dc|los angeles|new york city|nyc|chicago|houston|" +
		"miami|las vegas|san francisco|san diego|dallas|seattle|philadelphia|boston|detroit|phoenix|atlanta|denver|honolulu",
	"Kanada": "ontario|quebec|british columbia|britska kolumbie|alberta|manitoba|saskatchewan|nova scotia|nove skotsko|" +
		"new brunswick|novy brunswick|newfoundland|prince edward island|toronto|montreal|vancouver|calgary|ottawa|edmonton|winnipeg",
	"Česko":          "praha|prague|brno|ostrava|plzen|olomouc|liberec|ceske budejovice|hradec kralove|pardubice|usti nad labem|zlin|karlovy vary",
	"Slovensko":      "bratislava|kosice|presov|zilina|nitra|banska bystrica|trnava",
	"Velká Británie": "london|londyn|manchester|liverpool|birmingham|glasgow|edinburgh|edinburk|cardiff|belfast|leeds|bristol",
	"Německo":        "berlin|hamburg|mnichov|munchen|munich|koln|kolin nad rynem|cologne|frankfurt|stuttgart|dusseldorf|drazdany|dresden|lipsko|leipzig",
	"Rakousko":       "viden|wien|vienna|salzburg|graz|innsbruck|linz",
	"Francie":        "paris|pariz|marseille|lyon|nice|toulouse|bordeaux",
	"Itálie":         "rim|roma|rome|milano|milan|neapol|napoli|naples|turin|torino|florencie|firenze|florence|benatky|venezia|venice",
	"Španělsko":      "madrid|barcelona|valencie|valencia|sevilla|malaga",
	"Nizozemsko":     "amsterdam|rotterdam|haag|den haag|utrecht",
	"Švédsko":        "stockholm|goteborg|gothenburg|malmo",
	"Norsko":         "oslo|bergen",
	"Dánsko":         "kodan|copenhagen|kobenhavn|aarhus",
	"Finsko":         "helsinki",
	"Polsko":         "varsava|warszawa|warsaw|krakov|krakow|gdansk|vratislav|wroclaw|lodz|poznan",
	"Maďarsko":       "budapest|budapesti|debrecin|debrecen",
	"Rusko":          "moskva|moscow|petrohrad|sankt peterburg|saint petersburg|st petersburg",
	"Ukrajina":       "kyjev|kiev|kyiv|charkov|kharkiv|oděsa|odesa|odessa|lvov|lviv",
	"Austrálie":      "sydney|melbourne|brisbane|perth|adelaide",
	"Japonsko":       "tokio|tokyo|osaka|kjoto|kyoto",
	"Mexiko":         "mexico city|ciudad de mexico|guadalajara|monterrey|tijuana",
	"Brazílie":       "sao paulo|rio de janeiro|brasilia|salvador",
	"Argentina":      "buenos aires",
	"Kolumbie":       "bogota|medellin|cali",
	"Venezuela":      "caracas",
	"Filipíny":       "manila",
}

// Dvoupísmenné zkratky států USA („Austin, TX“); jen velkými písmeny a ne jako první část místa
var ZkratkyStatuUSA = map[string]bool{}

func init() {
	for _, z := range strings.Split("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC", " ") {
		ZkratkyStatuUSA[z] = true
	}
}

type mistoZemeRuny struct {
	znaky []rune
	zeme  int
}

// Rejstřík tabulky zemí: místo → země a tvar národnosti → země (index v TabulkaZemi), a předpočítané runy delších názvů
var MistoNaZemi, NarodnostNaZemi, ZemeUSA, mistaDelsiRuny = func() (map[string]int, map[string]int, int, []mistoZemeRuny) {
	mista, narodnosti := map[string]int{}, map[string]int{}
	podleNazvu := map[string]int{}
	for i, z := range TabulkaZemi {
		podleNazvu[z.Narodnost] = i
		for _, n := range strings.Split(z.Nazvy, "|") {
			mista[n] = i
			narodnosti[n] = i
		}
		for _, n := range strings.Split(z.Tvary, "|") {
			narodnosti[n] = i
		}
		narodnosti[uceni.KlicTextu(z.Narodnost)] = i
	}
	for zeme, seznam := range MistaZemi {
		for _, n := range strings.Split(seznam, "|") {
			mista[uceni.KlicTextu(n)] = podleNazvu[zeme]
		}
	}
	var runy []mistoZemeRuny
	var klice []string
	for nazev := range mista {
		if len(nazev) >= 6 {
			klice = append(klice, nazev)
		}
	}
	sort.Strings(klice)
	for _, nazev := range klice {
		runy = append(runy, mistoZemeRuny{znaky: []rune(nazev), zeme: mista[nazev]})
	}
	return mista, narodnosti, podleNazvu["USA"], runy
}()

// Klíč národnosti: země z tabulky („z:3“), jinak zjednodušený text („t:…“). USA a Americká mají stejný klíč.
func KlicNarodnosti(narodnost string) string {
	k := uceni.KlicTextu(narodnost)
	if k == "" {
		return ""
	}
	if i, ok := NarodnostNaZemi[k]; ok {
		return "z:" + strconv.Itoa(i)
	}
	return "t:" + k
}

// Část místa narození: klíč a zápis
type CastMista struct{ Klic, Zapis string }

// Části místa narození od nejkonkrétnější („Santa Monica, California, USA“ → santa monica, california, usa);
// závorka je další část („Praha (Československo)“)
func CastiMista(misto string) []CastMista {
	var casti []CastMista
	for _, c := range strings.FieldsFunc(misto, func(r rune) bool { return r == ',' || r == '(' || r == ')' || r == ';' }) {
		zapis := strings.TrimSpace(c)
		if k := uceni.KlicTextu(zapis); k != "" {
			casti = append(casti, CastMista{k, zapis})
		}
	}
	return casti
}

// Země podle tabulky pro část místa (i s drobným překlepem: Jaro–Winkler ≥ 0,94 u delších názvů); -1 = neznámá
type RejstrikMist struct{ Mezipamet map[string]int }

func (r *RejstrikMist) Zeme(c CastMista, poradi int) int {
	if poradi > 0 && len(c.Zapis) == 2 && ZkratkyStatuUSA[c.Zapis] {
		return ZemeUSA
	}
	if i, ok := MistoNaZemi[c.Klic]; ok {
		return i
	}
	if i, ok := r.Mezipamet[c.Klic]; ok {
		return i
	}
	nejlepsi, skore, druhe := -1, 0.0, -1
	znaky := []rune(c.Klic)
	if len(znaky) >= 6 {
		for _, m := range mistaDelsiRuny {
			if s := uceni.JaroWinklerZnaku(znaky, m.znaky); s >= 0.94 && (s > skore || s == skore && m.zeme < nejlepsi) {
				if nejlepsi >= 0 && m.zeme != nejlepsi {
					druhe = nejlepsi
				}
				nejlepsi, skore = m.zeme, s
			}
		}
	}
	if druhe >= 0 && druhe != nejlepsi {
		nejlepsi = -1 // podobá se názvům dvou zemí
	}
	r.Mezipamet[c.Klic] = nejlepsi
	return nejlepsi
}

// Národnost z místa narození (naučené ze sbírky a tabulka zemí) a z edice čísel (jen česká edice → nejčastější
// národnost takových modelek). Z více částí místa se vezme ta s nejvyšší jistotou. Místo a edice jsou dva zdroje;
// navrhnou-li tutéž hodnotu, spojí je VybratNavrhy, navrhnou-li různé, sníží si jistotu navzájem.
// preferovane = zápisy z oprav uživatele (klíč národnosti → zápis).
func NavrhnoutNarodnosti(modelky []hledani.Modelka, preferovane map[string]string, pridat PridatKandidata) {
	zapisy := uceni.NovySlovnik()
	zapisy.Preferovane = preferovane
	for _, m := range modelky {
		if k := KlicNarodnosti(m.Narodnost); k != "" {
			zapisy.Pridat(k, strings.TrimSpace(m.Narodnost))
		}
	}
	zapisy.Naucit()
	mista := uceni.Cetnosti{} // část místa → klíč národnosti
	edice := uceni.Cetnosti{} // edice čísel → klíč národnosti
	rejstrik := &RejstrikMist{Mezipamet: map[string]int{}}
	for _, m := range modelky {
		k := zapisy.Klic(KlicNarodnosti(m.Narodnost))
		if k == "" {
			continue
		}
		videne := map[string]bool{}
		for _, c := range CastiMista(m.NarozeniMisto) {
			if !videne[c.Klic] {
				videne[c.Klic] = true
				mista.Pridat(c.Klic, k)
			}
		}
		if e := EdicePrehledu(m); e != "" {
			edice.Pridat(e, k)
		}
	}
	zapisZeme := func(zeme int) (string, bool) {
		if z := zapisy.Zapis("z:" + strconv.Itoa(zeme)); z != "" {
			return z, true
		}
		return TabulkaZemi[zeme].Narodnost, false
	}

	for _, m := range modelky {
		if strings.TrimSpace(m.Narodnost) != "" || NeniKNavrhu(m, "narodnost") {
			continue
		}
		var nejHodnota, nejDuvod string
		nejJistota := 0.0
		for poradi, c := range CastiMista(m.NarozeniMisto) {
			zeme := rejstrik.Zeme(c, poradi)
			klicZeme := ""
			if zeme >= 0 {
				klicZeme = "z:" + strconv.Itoa(zeme)
			}
			// Nejčastější národnost u modelek z téhož místa; tabulka zemí přidá své zemi VahaTabulkyZemi
			pocty := mista[c.Klic]
			n := 0
			for _, p := range pocty {
				n += p
			}
			nejKlic, nejK := "", 0.0
			for klic, p := range pocty {
				v := float64(p)
				if klic == klicZeme {
					v += VahaTabulkyZemi
				}
				if v > nejK || v == nejK && klic < nejKlic {
					nejKlic, nejK = klic, v
				}
			}
			celkem := float64(n)
			if zeme >= 0 {
				celkem += VahaTabulkyZemi
				if _, ma := pocty[klicZeme]; !ma && VahaTabulkyZemi > nejK {
					nejKlic, nejK = klicZeme, VahaTabulkyZemi
				}
			}
			if nejKlic == "" {
				continue
			}
			// Laplaceovo pravidlo: (k + 1)/(n + 2)
			jistota := (nejK + 1) / (celkem + 2)
			hodnota, znama := zapisy.Zapis(nejKlic), true
			if hodnota == "" && nejKlic == klicZeme {
				hodnota, znama = zapisZeme(zeme)
			}
			k := pocty[nejKlic]
			var duvod string
			switch {
			case nejKlic == klicZeme && n == 0:
				duvod = fmt.Sprintf("místo narození %s → %s (tabulka zemí)", c.Zapis, hodnota)
			case nejKlic == klicZeme:
				duvod = fmt.Sprintf("místo narození %s → %s (tabulka zemí; ve sbírce %d z %d %s odtud)", c.Zapis, hodnota, k, n, SklonovatSlovo(n, "modelky", "modelek", "modelek"))
			default:
				duvod = fmt.Sprintf("místo narození %s → %s (%d z %d %s sbírky narozených tamtéž)", c.Zapis, hodnota, k, n, SklonovatSlovo(n, "modelky", "modelek", "modelek"))
			}
			if !znama {
				jistota *= PodilNoveHodnoty
				duvod += "; tuto národnost ve sbírce zatím nikdo nemá"
			}
			if jistota > nejJistota || jistota == nejJistota && poradi > 0 {
				nejHodnota, nejDuvod, nejJistota = hodnota, duvod, jistota
			}
		}
		if nejHodnota != "" {
			pridat(m, nil, "narodnost", nejHodnota, nejDuvod, "misto", nejJistota)
		}
		// Edice čísel (jen tam, kde má modelka čísla jen jedné edice)
		if e := EdicePrehledu(m); e != "" {
			klic, k, n := edice.Nejcastejsi(e)
			if jistota := uceni.PodilSPredpokladem(k, n, 0.5, 2); n >= MinModelekEdice && jistota >= PrahEdice {
				hodnota := zapisy.Zapis(klic)
				pridat(m, nil, "narodnost", hodnota, fmt.Sprintf("vyšla jen v edici %s; %d z %d takových modelek sbírky má národnost %s", e, k, n, hodnota),
					"edice", jistota)
			}
		}
	}
}

// Edice všech čísel modelky, když jsou jedné edice („CZ“, „US“); jinak ""
func EdicePrehledu(m hledani.Modelka) string {
	edice := ""
	for _, seznam := range [][]string{m.Vydani, m.Centerfoldy, m.Obalky} {
		for _, v := range seznam {
			if !sbirka.VzorVydaniAlba.MatchString(v) {
				continue
			}
			e := sbirka.EdicePodleVydani(v)
			if e == "" {
				e = "US"
			}
			if edice != "" && edice != e {
				return ""
			}
			edice = e
		}
	}
	return edice
}

// Etnicita podle národnosti; barva vlasů a očí podle etnicity a národnosti (s ústupem na jen etnicitu, nebo
// jen národnost, když dvojice nemá dost modelek). Bere se nejkonkrétnější podmínka, která má dost modelek,
// ne ta, která vyjde nejlépe (to by byl výběr náhody). Navrhuje se jen silně jednoznačná hodnota.
func NavrhnoutVzhled(modelky []hledani.Modelka, preferovane map[string]map[string]string, pridat PridatKandidata) {
	type udaj struct {
		pole, slovo string // „barvu vlasů“
		hodnota     func(hledani.Modelka) string
	}
	udaje := []udaj{
		{"etnicita", "etnicitu", func(m hledani.Modelka) string { return m.Etnicita }},
		{"vlasyBarva", "barvu vlasů", func(m hledani.Modelka) string { return m.VlasyBarva }},
		{"ociBarva", "barvu očí", func(m hledani.Modelka) string { return m.OciBarva }},
	}
	zapisy := map[string]*uceni.SlovnikHodnot{}
	tabulky := map[string]uceni.Cetnosti{}
	for _, u := range udaje {
		zapisy[u.pole], tabulky[u.pole] = uceni.NovySlovnik(), uceni.Cetnosti{}
		zapisy[u.pole].Preferovane = preferovane[u.pole]
	}
	for _, m := range modelky {
		for _, u := range udaje {
			if h := strings.TrimSpace(u.hodnota(m)); h != "" {
				zapisy[u.pole].Pridat(uceni.KlicTextu(h), h)
			}
		}
	}
	for _, u := range udaje {
		zapisy[u.pole].Naucit()
	}
	type podminka struct {
		klic, popis string
		minimum     int // nejmenší počet modelek s údajem při podmínce
	}
	podminky := func(m hledani.Modelka, pole string) []podminka {
		e, n := zapisy["etnicita"].Klic(uceni.KlicTextu(m.Etnicita)), KlicNarodnosti(m.Narodnost)
		etnicita, narodnost := "etnicita "+strings.TrimSpace(m.Etnicita), "národnost "+strings.TrimSpace(m.Narodnost)
		var p []podminka
		if pole == "etnicita" {
			if n != "" {
				p = append(p, podminka{"n:" + n, narodnost, MinModelekEtnicity})
			}
			return p
		}
		if e != "" && n != "" {
			p = append(p, podminka{"e:" + e + "|n:" + n, etnicita + ", " + narodnost, MinModelekVzhledu})
		}
		if e != "" {
			p = append(p, podminka{"e:" + e, etnicita, MinModelekObecne})
		}
		if n != "" {
			p = append(p, podminka{"n:" + n, narodnost, MinModelekObecne})
		}
		return p
	}
	for _, m := range modelky {
		for _, u := range udaje {
			h := strings.TrimSpace(u.hodnota(m))
			if h == "" {
				continue
			}
			k := zapisy[u.pole].Klic(uceni.KlicTextu(h))
			for _, p := range podminky(m, u.pole) {
				tabulky[u.pole].Pridat(p.klic, k)
			}
		}
	}
	for _, m := range modelky {
		for _, u := range udaje {
			if strings.TrimSpace(u.hodnota(m)) != "" || NeniKNavrhu(m, u.pole) {
				continue
			}
			for _, p := range podminky(m, u.pole) {
				klic, k, n := tabulky[u.pole].Nejcastejsi(p.klic)
				if n < p.minimum {
					continue
				}
				if jistota := uceni.PodilSPredpokladem(k, n, 0.5, 2); jistota >= PrahVzhledu {
					hodnota := zapisy[u.pole].Zapis(klic)
					pridat(m, nil, u.pole, hodnota, fmt.Sprintf("%s: %d z %d modelek sbírky má %s %s", p.popis, k, n, u.slovo, hodnota),
						"cetnost", min(jistota, StropVzhledu))
				}
				break
			}
		}
	}
}
