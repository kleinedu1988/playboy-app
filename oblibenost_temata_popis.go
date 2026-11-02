package main

// Ikona, skupina a popis afinity témat sezón (od 1.2.3): karta tématu ve volbě sezóny, štítek v Porovnat. Skupina
// slouží k pestrému výběru návrhů (éra, styl, místo, původ…). Téma mimo slovník dostane ikonu a skupinu podle
// první podmínky a popis složený z podmínek.

import "strings"

type zapisTematu struct{ Ikona, Skupina, Popis string }

const (
	skupinaEra       = "era"
	skupinaKalendar  = "kalendar"
	skupinaPuvod     = "puvod"
	skupinaPuvab     = "puvab"
	skupinaStyl      = "styl"
	skupinaMisto     = "misto"
	skupinaKombinace = "kombinace"
)

var popisyTemat = map[string]zapisTematu{
	"": {"♛", "", "Bez tématu – soutěží všechny modelky v pořadí nad všemi fotkami."},
	// Éry a kalendář
	"fotka:obdobi=1960-1969":                       {"📼", skupinaEra, "Účesy do výšky, pop-art a první revoluce."},
	"fotka:obdobi=1970-1979":                       {"📼", skupinaEra, "Měkké světlo, zrno filmu a nespoutaná přirozenost."},
	"fotka:obdobi=1980-1989":                       {"📼", skupinaEra, "Objem, neon a sebevědomí velkých gest."},
	"fotka:obdobi=1990-1999":                       {"📼", skupinaEra, "Supermodelková éra na vrcholu formy."},
	"fotka:obdobi=2000-2009":                       {"💿", skupinaEra, "Digitální ostrost a lesklé obálky přelomu století."},
	"fotka:obdobi=2010-2019":                       {"📱", skupinaEra, "Nová generace a návrat k přirozenosti."},
	"fotka:obdobi=2020-2029":                       {"📱", skupinaEra, "Nejčerstvější tváře archivu."},
	"fotka:mesic=06,07,08":                         {"☀️", skupinaKalendar, "Pictorialy z červnových až srpnových čísel."},
	"fotka:mesic=12":                               {"🎄", skupinaKalendar, "Prosincová čísla, slavnostní a třpytivá."},
	"fotka:edice=CZ":                               {"🇨🇿", skupinaKalendar, "Fotky, které vyšly v tuzemském vydání."},
	"fotka:album=centerfold":                       {"🗞", skupinaKalendar, "Jen plakáty ze středové dvoustrany."},
	"fotka:obdobi=1990-1999+tag:bikiny,plaz":       {"🏖", skupinaKombinace, "Plavky a pláže zlaté dekády."},
	"fotka:obdobi=1980-1989+tag:podvazky,puncochy": {"🧦", skupinaKombinace, "Punčochy a podvazky v nejlesklejší dekádě."},
	// Původ
	"modelka:narodnost=cesko,slovensko":                                              {"🌍", skupinaPuvod, "Modelky z Česka a Slovenska."},
	"modelka:narodnost=cesko,madarsko,nemecko,polsko,rakousko,slovensko,slovinsko":   {"🌍", skupinaPuvod, "Krásky ze srdce Evropy."},
	"modelka:narodnost=dansko,finsko,island,norsko,svedsko":                          {"❄️", skupinaPuvod, "Světlé tóny a chladná elegance Severu."},
	"modelka:narodnost=francie,italie,portugalsko,recko,spanelsko":                   {"🫒", skupinaPuvod, "Slunce, olivová pleť a jižní šarm."},
	"modelka:narodnost=argentina,brazilie,chile,kolumbie,kuba,mexiko,peru,venezuela": {"💃", skupinaPuvod, "Rytmus a temperament Latinské Ameriky."},
	"modelka:narodnost=irsko,velka_britanie":                                         {"☕", skupinaPuvod, "Elegance z Britských ostrovů."},
	"modelka:narodnost=australie,novy_zeland":                                        {"🌊", skupinaPuvod, "Slunce a oceán jižní polokoule."},
	"modelka:narodnost=usa":                                                          {"🗽", skupinaPuvod, "Hvězdy z domoviny časopisu."},
	"fotka:edice=CZ+modelka:narodnost=cesko,slovensko":                               {"🏠", skupinaKombinace, "Naše modelky v našem vydání."},
	"modelka:narodnost=dansko,finsko,island,norsko,svedsko+tag:priroda":              {"🌲", skupinaKombinace, "Seveřanky v krajině."},
	// Půvab z údajů modelky
	"modelka:prsaTyp=Přírodní+tag:prsa":       {"🌸", skupinaPuvab, "Přirozená křivka bez skalpelu."},
	"modelka:prsaTyp=Silikonová+tag:prsa":     {"💎", skupinaPuvab, "Plné tvary a sebevědomí."},
	"modelka:prsaTyp=Přírodní+tag:nahore_bez": {"🌸", skupinaPuvab, "Nahoře bez a bez úprav."},
	"modelka:ochlupeni=Přírodní+tag:vagina":   {"🌿", skupinaPuvab, "Krása tak, jak ji příroda stvořila."},
	"modelka:ochlupeni=Oholené+tag:vagina":    {"🪒", skupinaPuvab, "Hladké linie bez kompromisů."},
	"modelka:vlasy=zrzav":                     {"🔥", skupinaPuvab, "Měděné, rezavé a ohnivé vlasy."},
	"modelka:vlasy=blond":                     {"✨", skupinaPuvab, "Platina, med i zlato."},
	"modelka:vlasy=čern":                      {"🖤", skupinaPuvab, "Havraní vlasy a hluboký pohled."},
	"modelka:vlasy=hněd":                      {"🌰", skupinaPuvab, "Brunetky všech odstínů."},
	"modelka:oci=modr":                        {"💧", skupinaPuvab, "Modrooké modelky."},
	"modelka:oci=zelen":                       {"🍀", skupinaPuvab, "Vzácná zelená v pohledu."},
	"modelka:tetovani=ano":                    {"🖋", skupinaPuvab, "Kresby na kůži a jejich příběhy."},
	"modelka:tetovani=ne":                     {"🤍", skupinaPuvab, "Pleť bez jediného tetování."},
	"modelka:kategorie=pmm":                   {"🐰", skupinaPuvab, "Playmates měsíce a celá jejich tvorba."},
	"modelka:kategorie=pmr":                   {"👑", skupinaPuvab, "Jen vyhlášené Playmate roku."},
	"modelka:kategorie=cg":                    {"💻", skupinaPuvab, "Cyber Girls online éry."},
	"modelka:kategorie=obalka":                {"📰", skupinaPuvab, "Modelky, které zdobily titulní stranu."},
	"modelka:vlasy=blond+tag:plaz":            {"🌞", skupinaKombinace, "Světlé vlasy u moře."},
	// Styl fotky
	"tag:cernobila":             {"🎞", skupinaStyl, "Fotografie zbavené barev, kde vládne světlo."},
	"tag:cernobila+tag:low_key": {"🕶", skupinaStyl, "Hluboké stíny a dramatický kontrast."},
	"tag:low_key":               {"🌑", skupinaStyl, "Tma, ze které vystupuje jen to podstatné."},
	"tag:high_key":              {"🤍", skupinaStyl, "Světlo, bílá a vzdušná lehkost."},
	"tag:tonovana":              {"📜", skupinaStyl, "Sépiová nostalgie starých zvětšenin."},
	"tag:zlata_hodina":          {"🌅", skupinaStyl, "Teplé světlo nízkého slunce."},
	"tag:noc":                   {"🌃", skupinaStyl, "Po setmění, ve světle lamp a neonů."},
	"tag:do_kamery":             {"👁", skupinaStyl, "Pohled, který se dívá přímo na tebe."},
	"tag:usmev":                 {"😊", skupinaStyl, "Radost, která je vidět."},
	"tag:portret":               {"🖼", skupinaStyl, "Tváře zblízka."},
	"tag:detail":                {"🔍", skupinaStyl, "Krása v záběru zblízka."},
	"tag:akt":                   {"🗿", skupinaStyl, "Nic navíc – jen tělo a světlo."},
	"tag:nahore_bez":            {"🌙", skupinaStyl, "Nahoře bez, dole tajemství."},
	"tag:oblecena":              {"🧥", skupinaStyl, "Víc slibuje, než ukazuje."},
	"tag:pradlo":                {"🎀", skupinaStyl, "Krajka, hedvábí a průsvitné látky."},
	"tag:podpatky":              {"👠", skupinaStyl, "Jehlové podpatky a dlouhé linie."},
	"tag:podvazky,puncochy":     {"🧦", skupinaStyl, "Nylon, krajka a podvazkové pásy."},
	"tag:bunny":                 {"🐰", skupinaStyl, "Zaječí uši – klasika, která nestárne."},
	"tag:dziny":                 {"👖", skupinaStyl, "Denim Americana."},
	"tag:latex":                 {"🖤", skupinaStyl, "Odvážné materiály a lesklé povrchy."},
	"tag:kostym":                {"🎭", skupinaStyl, "Uniformy, převleky a hra na někoho jiného."},
	"tag:saty":                  {"👗", skupinaStyl, "Róby, které víc slibují, než ukazují."},
	"tag:kosile":                {"👔", skupinaStyl, "Nedbalá elegance pánské košile."},
	"tag:zezadu":                {"🍑", skupinaStyl, "Linie zad a to, co je pod nimi."},
	"tag:mokra":                 {"💦", skupinaStyl, "Kapky na kůži a mokré vlasy."},
	"tag:vic_modelek":           {"👯", skupinaStyl, "Společná focení a souhra modelek."},
	"tag:nohy+tag:podpatky":     {"👠", skupinaKombinace, "Linie od kotníku až nahoru."},
	"tag:loznice+tag:pradlo":    {"🛏", skupinaKombinace, "Krajka a hedvábí za zavřenými dveřmi."},
	// Místa
	"tag:mesto,plaz,priroda": {"🌿", skupinaMisto, "Venku – pláže, louky i ulice."},
	"tag:plaz":               {"🌊", skupinaMisto, "Písek, vlny a slaná kůže."},
	"tag:bazen":              {"🏊", skupinaMisto, "Tyrkysová voda a lehátka."},
	"tag:priroda":            {"🌿", skupinaMisto, "Louky, lesy a volný prostor."},
	"tag:loznice":            {"🛏", skupinaMisto, "Intimita povlečení a ranního světla."},
	"tag:koupelna":           {"🛁", skupinaMisto, "Pěna, pára a vodní kapky."},
	"tag:studio":             {"💡", skupinaMisto, "Čisté pozadí a dokonale řízené světlo."},
	"tag:auto":               {"🏎", skupinaMisto, "Benzín, chrom a kůže sedadel."},
	"tag:mesto":              {"🏙", skupinaMisto, "Ulice, střechy a městská noc."},
}

// Ikona, skupina a popis tématu; mimo slovník podle podmínek
func popisTematu(klic string, podminky []PodminkaTematu) zapisTematu {
	if z, ok := popisyTemat[klic]; ok {
		return z
	}
	z := zapisTematu{Ikona: "✦", Skupina: skupinaKombinace}
	if len(podminky) == 1 {
		p := podminky[0]
		switch {
		case p.Druh == "fotka" && p.Klic == "obdobi":
			z.Ikona, z.Skupina = "📼", skupinaEra
		case p.Druh == "fotka":
			z.Ikona, z.Skupina = "🗓", skupinaKalendar
		case p.Druh == "modelka" && p.Klic == "narodnost":
			z.Ikona, z.Skupina = "🌍", skupinaPuvod
		case p.Druh == "modelka":
			z.Skupina = skupinaPuvab
		case p.Druh == "tag" && len(p.Hodnoty) > 0 && skupinaTagu[p.Hodnoty[0]] != nil && skupinaTagu[p.Hodnoty[0]].Klic == "prostredi":
			z.Skupina = skupinaMisto
		default:
			z.Skupina = skupinaStyl
		}
	}
	var fotky, modelky []string
	for _, p := range podminky {
		f := strings.ToLower(nazevTematu([]PodminkaTematu{p}))
		if p.Druh == "modelka" {
			modelky = append(modelky, f)
		} else {
			fotky = append(fotky, f)
		}
	}
	var casti []string
	if len(fotky) > 0 {
		casti = append(casti, "fotky: "+strings.Join(fotky, ", "))
	}
	if len(modelky) > 0 {
		casti = append(casti, "modelky: "+strings.Join(modelky, ", "))
	}
	if len(casti) > 0 {
		z.Popis = "Vlastní téma – " + strings.Join(casti, " · ") + "."
	}
	return z
}
