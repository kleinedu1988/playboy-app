package main

import (
	"fmt"
	"sort"
	"strings"
)

// Skóre fotek a náhledy alb pro porovnání (celkový popis v docs/UCENI.md, oddíly Skóre fotek a Náhledy alb):
//
//   - Skóre fotek: z hodnocených fotek modelky po albech. Album hodnotí průměr jeho nejlepších fotek (bez slabší
//     čtvrtiny, nejvýš pět), každé album je jeden hlas (velké album nepřehlasuje ostatní) a odhad se smršťuje
//     k průměru sbírky podle toho, kolik alb a fotek modelka má (empirický Bayes: hierarchický normální model
//     fotka → album → modelka, rozptyly odhadnuté ze sbírky). Nehodnocené fotky a alba bez hodnocených fotek se
//     nepočítají; typ alba (centerfold, pictorial, online) se nerozlišuje.
//     Skóre je údaj pro model vkusu a pro rozhraní; sílu modelky přímo neposouvá (srdíčka fotek jsou poměrná
//     k modelce – pětka je její nejlepší fotka, ne absolutní hodnota).
//   - Náhledy alb: pro porovnání několik nejlepších fotek modelky, z každého alba aspoň jedna.

// Parametry skóre fotek
const (
	topFotekAlba       = 5    // album hodnotí průměr nejvýš tolika jeho nejlepších fotek
	vychoziRozptylFoto = 0.5  // rozptyl srdíček fotek uvnitř alba, dokud ho sbírka neurčí (σ_w²)
	vychoziRozptylAlb  = 0.1  // rozptyl skóre alb jedné modelky kolem její úrovně (τ_a²)
	vychoziRozptylMod  = 0.3  // rozptyl úrovní modelek kolem průměru sbírky (τ_m²)
	minRozptylFoto     = 0.05 // dolní meze odhadnutých rozptylů (odhad momentovou metodou může vyjít i záporný)
	minRozptylAlb      = 0.02
	minRozptylMod      = 0.05
	minStupnuVolnosti  = 10 // rozptyl se ze sbírky odhaduje až z tolika stupňů volnosti (modelek, alb)
)

// ---------------------------------------------------------------------------------------------------------
// Skóre fotek
//
// Fotka h v albu a modelky m: h ~ N(θₐ, σ_w²), album θₐ ~ N(φₘ, τₐ²), modelka φₘ ~ N(μ, τₘ²).
// Album se shrne průměrem mₐ svých k nejlepších hodnocených fotek, k = min(5, n − ⌊n/4⌋): slabší čtvrtina alba
// a fotky za pátou nejlepší výsledek nezhorší (album s pěti fotkami za 5 srdíček a třiceti průměrnými je
// výborné album), ale album s jedinou dobrou fotkou mezi slabými zůstane slabé. Rozptyl mₐ kolem φₘ je
// vₐ = σ_w²/kₐ + τₐ² (skóre alba stojí na kₐ fotkách), takže váha alba 1/vₐ přestane růst od šesti hodnocených
// fotek: album je jeden hlas a čtyřicet fotek ho neudělá silnějším; album s jednou dvěma fotkami je jen částečný
// hlas (je nejisté). Aposteriorní odhad modelky:
//
//	φ̂ = (μ/τₘ² + Σ mₐ/vₐ) / (1/τₘ² + Σ 1/vₐ),   Var φ̂ = 1 / (1/τₘ² + Σ 1/vₐ)
//
// σ_w² se odhadne ze srdíček fotek uvnitř alb, τₐ² z rozdílů alb téže modelky a τₘ² z rozdílů modelek (vždy
// pozorovaný rozptyl minus část, kterou vysvětlí nejistota odhadů; empirický Bayes momentovou metodou).

type skoreFotek struct {
	skore   float64 // odhad na stupnici srdíček fotek (smrštěný k průměru sbírky)
	rozptyl float64 // Var φ̂
	surove  float64 // průměr skóre alb bez smrštění
	alb     int     // alba s hodnocenými fotkami
	fotek   int     // hodnocené fotky
}

type parametryFotek struct {
	stred                   float64 // μ: průměr úrovní modelek s hodnocenými fotkami
	rozptylFoto, rozptylAlb float64 // σ_w², τₐ²
	rozptylModelek          float64 // τₘ²
	modelek                 int     // modelky s hodnocenými fotkami
}

// Průměr k nejlepších hodnocených fotek alba (k = min(5, n − ⌊n/4⌋)), k, počet hodnocených fotek n a jejich
// součet čtverců odchylek od průměru alba (rozptyl uvnitř alba)
func skoreAlba(c srdickaAlba) (prumer float64, k, n int, ctverce float64) {
	soucet := 0
	for h, pocet := range c {
		n += pocet
		soucet += (h + 1) * pocet
	}
	if n == 0 {
		return 0, 0, 0, 0
	}
	stred := float64(soucet) / float64(n)
	for h, pocet := range c {
		ctverce += float64(pocet) * (float64(h+1) - stred) * (float64(h+1) - stred)
	}
	k = min(topFotekAlba, n-n/4)
	zbyva, vybrano := k, 0
	for h := 4; h >= 0 && zbyva > 0; h-- {
		vzit := min(zbyva, c[h])
		vybrano += vzit * (h + 1)
		zbyva -= vzit
	}
	return float64(vybrano) / float64(k), k, n, ctverce
}

func spocitatSkoreFotek(modelky []Modelka) (map[int]skoreFotek, parametryFotek) {
	type album struct {
		m    float64
		k, n int
	}
	par := parametryFotek{rozptylFoto: vychoziRozptylFoto, rozptylAlb: vychoziRozptylAlb, rozptylModelek: vychoziRozptylMod}
	alba := map[int][]album{}
	var ids []int
	ctverce, stupne := 0.0, 0
	for i := range modelky {
		m := &modelky[i]
		for _, c := range m.srdickaAlb {
			prumer, k, n, q := skoreAlba(c)
			if n == 0 {
				continue
			}
			if len(alba[m.ID]) == 0 {
				ids = append(ids, m.ID)
			}
			alba[m.ID] = append(alba[m.ID], album{prumer, k, n})
			ctverce += q
			stupne += n - 1
		}
	}
	vysledek := make(map[int]skoreFotek, len(ids))
	if len(ids) == 0 {
		return vysledek, par
	}
	// σ_w²: srdíčka fotek uvnitř alb
	if stupne >= minStupnuVolnosti {
		par.rozptylFoto = max(minRozptylFoto, ctverce/float64(stupne))
	}
	// τₐ²: alba téže modelky kolem jejího průměru, bez části vysvětlené nejistotou alb
	q, st, nejistota, pocet := 0.0, 0, 0.0, 0
	for _, id := range ids {
		a := alba[id]
		if len(a) < 2 {
			continue
		}
		stred := 0.0
		for _, x := range a {
			stred += x.m
		}
		stred /= float64(len(a))
		for _, x := range a {
			q += (x.m - stred) * (x.m - stred)
			nejistota += par.rozptylFoto / float64(x.k)
			pocet++
		}
		st += len(a) - 1
	}
	if st >= minStupnuVolnosti {
		par.rozptylAlb = max(minRozptylAlb, q/float64(st)-nejistota/float64(pocet))
	}
	// μ a τₘ²: průměry modelek kolem průměru sbírky, bez části vysvětlené nejistotou průměrů
	surove := make([]float64, len(ids))
	nejistoty := make([]float64, len(ids))
	stred := 0.0
	for i, id := range ids {
		a := alba[id]
		for _, x := range a {
			surove[i] += x.m
			nejistoty[i] += par.rozptylFoto/float64(x.k) + par.rozptylAlb
		}
		surove[i] /= float64(len(a))
		nejistoty[i] /= float64(len(a) * len(a))
		stred += surove[i]
	}
	stred /= float64(len(ids))
	par.stred, par.modelek = stred, len(ids)
	if len(ids) >= minStupnuVolnosti {
		rozptyl, prumernaNejistota := 0.0, 0.0
		for i := range ids {
			rozptyl += (surove[i] - stred) * (surove[i] - stred)
			prumernaNejistota += nejistoty[i]
		}
		par.rozptylModelek = max(minRozptylMod, rozptyl/float64(len(ids)-1)-prumernaNejistota/float64(len(ids)))
	}
	for i, id := range ids {
		presnost, soucet := 1/par.rozptylModelek, par.stred/par.rozptylModelek
		fotek := 0
		for _, x := range alba[id] {
			v := par.rozptylFoto/float64(x.k) + par.rozptylAlb
			presnost += 1 / v
			soucet += x.m / v
			fotek += x.n
		}
		vysledek[id] = skoreFotek{skore: soucet / presnost, rozptyl: 1 / presnost, surove: surove[i], alb: len(alba[id]), fotek: fotek}
	}
	return vysledek, par
}

// ---------------------------------------------------------------------------------------------------------
// Texty

// „4,3“
func cisloCesky(x float64, mist int) string {
	return strings.Replace(fmt.Sprintf("%.*f", mist, x), ".", ",", 1)
}

// „srdíčka 3,5“, „bez srdíček“
func textSlozkySrdicek(h float64) string {
	if h <= 0 {
		return "bez srdíček"
	}
	return "srdíčka " + strings.TrimSuffix(cisloCesky(h, 1), ",0")
}

// „fotky 4,3 (3 alba, 41 hodnocených fotek)“
func textSkoreFotek(s skoreFotek) string {
	return fmt.Sprintf("fotky %s (%d %s, %d %s)", cisloCesky(s.skore, 1), s.alb, sklonovatSlovo(s.alb, "album", "alba", "alb"),
		s.fotek, sklonovatSlovo(s.fotek, "hodnocená fotka", "hodnocené fotky", "hodnocených fotek"))
}

// ---------------------------------------------------------------------------------------------------------
// Náhledy alb pro porovnání
//
// K velké titulní fotce každé modelky v porovnání patří řada několika fotek z jejích alb: nejlépe hodnocené,
// z každého alba aspoň jedna. Alba se seřadí podle skóre (průměr nejlepších fotek, alba bez hodnocených fotek
// nakonec, při shodě v pořadí přidání), fotky v albu podle srdíček a pak podle pořadí v albu (ruční pořadí, jinak
// vložení). Napřed nejlepší fotka každého alba (při víc albech než náhledech nejlepších alb), zbylá místa
// dostanou ostatní fotky podle srdíček (při shodě ta výš ve svém albu, pak z lepšího alba); vybrané se nakonec
// seřadí podle srdíček (stabilně), takže 1. náhled je nejlepší fotka. Titulní fotka se neopakuje. Fotky se čtou
// jedním dotazem pro všechna alba žádaných modelek a výsledek se pamatuje se snímkem sbírky (změna fotek snímek
// zneplatní).

// Náhled fotky modelky v porovnání
type NahledFotky struct {
	ID        int    `json:"id"` // číslo fotky
	URL       string `json:"url"`
	Album     string `json:"album"`
	Typ       string `json:"typ"`
	Hodnoceni int    `json:"hodnoceni"` // srdíčka fotky 0–5
	Rotace    int    `json:"rotace"`
}

type nahledyModelky struct {
	pocet int
	fotky []NahledFotky
}

type fotkaNahledu struct {
	id, rotace, hodnoceni, poradi int
	drive                         string
}

const maxNahledu = 24

// Náhledy fotek modelek (nejvýš pocet na modelku) podle čísel modelek; neznámá modelka nebo modelka bez fotek
// má prázdný seznam
func (a *App) GetNahledyModelek(ids []int, pocet int) map[int][]NahledFotky {
	vysledek := map[int][]NahledFotky{}
	pocet = min(max(pocet, 1), maxNahledu)
	ids = ids[:min(len(ids), 2*maxDvojicNaVolani)]
	s := a.snimekSbirky()
	var chybi []int
	s.mu.Lock()
	for _, id := range ids {
		if _, hotovo := vysledek[id]; hotovo {
			continue
		}
		if n, ok := s.nahledy[id]; ok && n.pocet == pocet {
			vysledek[id] = n.fotky
			continue
		}
		vysledek[id] = nil
		chybi = append(chybi, id)
	}
	s.mu.Unlock()
	if len(chybi) == 0 {
		return vysledek
	}
	spocitane := a.spocitatNahledy(s, chybi, pocet)
	s.mu.Lock()
	if s.nahledy == nil {
		s.nahledy = map[int]nahledyModelky{}
	}
	for _, id := range chybi {
		f := spocitane[id]
		if f == nil {
			f = []NahledFotky{}
		}
		s.nahledy[id] = nahledyModelky{pocet, f}
		vysledek[id] = f
	}
	s.mu.Unlock()
	return vysledek
}

func (a *App) spocitatNahledy(s *snimek, ids []int, pocet int) map[int][]NahledFotky {
	vysledek := map[int][]NahledFotky{}
	var alba []any
	for _, id := range ids {
		for _, al := range s.albaModelek[id] {
			alba = append(alba, al.id)
		}
	}
	fotky := map[int64][]fotkaNahledu{}
	const davka = 500
	for od := 0; od < len(alba); od += davka {
		cast := alba[od:min(len(alba), od+davka)]
		radky, err := a.db.Query("SELECT id, album_id, drive_file_id, rotace, hodnoceni, COALESCE(poradi, 0) FROM fotky WHERE album_id IN (?"+
			strings.Repeat(", ?", len(cast)-1)+")", cast...)
		if err != nil {
			a.chyba("náhledy fotek", err)
			return vysledek
		}
		for radky.Next() {
			var f fotkaNahledu
			var album int64
			if radky.Scan(&f.id, &album, &f.drive, &f.rotace, &f.hodnoceni, &f.poradi) == nil {
				fotky[album] = append(fotky[album], f)
			}
		}
		radky.Close()
	}
	for _, id := range ids {
		cover := ""
		if i, ok := s.indexModelky[id]; ok {
			cover = s.modelky[i].CoverID
		}
		vysledek[id] = vybratNahledy(s.albaModelek[id], fotky, pocet, cover)
	}
	return vysledek
}

// Výběr náhledů: po kolech přes alba seřazená podle skóre, v albu nejlepší fotky napřed (viz výše)
func vybratNahledy(alba []albumModelky, fotky map[int64][]fotkaNahledu, pocet int, cover string) []NahledFotky {
	type albumVyberu struct {
		al    albumModelky
		skore float64
		fotky []fotkaNahledu
	}
	var serazena []albumVyberu
	for _, al := range alba {
		var f []fotkaNahledu
		for _, x := range fotky[al.id] {
			if cover == "" || x.drive != cover {
				f = append(f, x)
			}
		}
		if len(f) == 0 {
			continue
		}
		sort.SliceStable(f, func(i, j int) bool {
			x, y := f[i], f[j]
			if x.hodnoceni != y.hodnoceni {
				return x.hodnoceni > y.hodnoceni
			}
			if (x.poradi > 0) != (y.poradi > 0) {
				return x.poradi > 0
			}
			if x.poradi != y.poradi {
				return x.poradi < y.poradi
			}
			return x.id < y.id
		})
		skore, _, _, _ := skoreAlba(al.pocty)
		serazena = append(serazena, albumVyberu{al, skore, f})
	}
	sort.SliceStable(serazena, func(i, j int) bool {
		if serazena[i].skore != serazena[j].skore {
			return serazena[i].skore > serazena[j].skore
		}
		return serazena[i].al.id < serazena[j].al.id
	})
	// Nejlepší fotka každého alba, pak ostatní podle srdíček (při shodě dřív ta, která je ve svém albu výš,
	// a z lepšího alba); kandidáti jsou už v pořadí alb a fotek, takže stačí stabilní řazení
	type kandidat struct {
		a      *albumVyberu
		f      fotkaNahledu
		poradi int // pořadí fotky v jejím albu
	}
	var prvni, dalsi []kandidat
	for i := range serazena {
		for x, f := range serazena[i].fotky {
			k := kandidat{&serazena[i], f, x}
			if x == 0 {
				prvni = append(prvni, k)
			} else {
				dalsi = append(dalsi, k)
			}
		}
	}
	sort.SliceStable(dalsi, func(i, j int) bool {
		if dalsi[i].f.hodnoceni != dalsi[j].f.hodnoceni {
			return dalsi[i].f.hodnoceni > dalsi[j].f.hodnoceni
		}
		return dalsi[i].poradi < dalsi[j].poradi
	})
	vybrane := append(prvni[:min(pocet, len(prvni)):min(pocet, len(prvni))], dalsi[:min(max(0, pocet-len(prvni)), len(dalsi))]...)
	sort.SliceStable(vybrane, func(i, j int) bool { return vybrane[i].f.hodnoceni > vybrane[j].f.hodnoceni })
	vysledek := make([]NahledFotky, 0, len(vybrane))
	for _, k := range vybrane {
		vysledek = append(vysledek, NahledFotky{ID: k.f.id, URL: adresaObrazku(k.f.drive), Album: k.a.al.nazev, Typ: k.a.al.typ, Hodnoceni: k.f.hodnoceni, Rotace: k.f.rotace})
	}
	return vysledek
}
