package main

import (
	"math"
	"time"
)

// Návrhy srdíček (popis v docs/UCENI.md, oddíly Výběr dvojic a Nesoulad se srdíčky) – jediné místo, které srdíčka
// navrhuje: nehodnocené modelce úroveň, na kterou po pár porovnáních vychází její síla, hodnocené nesoulad se
// srdíčky z porovnání s jinými úrovněmi a ze srdíček fotek. Rozhraní je ukazuje pod pásy po porovnání
// (GetNavrhSrdicek) a v Pořadí v „Nesedí se srdíčky“ (GetOblibenost().nesedi).

// Návrh srdíček nehodnocené modelce z porovnání (GetNavrhSrdicek): až po tolika porovnáních a jen s tak malou
// nejistotou síly (směrodatná odchylka na stupnici srdíček)
const (
	minPorovnaniNavrhu = 3
	maxNejistotaNavrhu = 0.6
)

// Nesoulad se srdíčky (StavOblibenosti.Nesedi): hodnocená modelka, která v porovnáních s modelkami s jinými srdíčky
// vyhrála o tolik méně (nebo více), než by čekala samotná srdíčka, a aspoň tolikrát
const (
	minPorovnaniNesouladu = 3
	prahNesouladu         = 1.5 // rozdíl výher proti očekávání (vážený stářím)
	// Nesoulad se skóre fotek: fotky (převedené na stupnici srdíček modelek) se liší aspoň o celé srdíčko, z aspoň
	// 2 alb a 10 hodnocených fotek
	prahNesouladuFotek = 1.0
	minAlbNesouladu    = 2
	minFotekNesouladu  = 10
)

// Nesoulad se srdíčky: modelka s víc srdíčky prohrává se slabšími, nebo má slabší fotky (smer "mene", návrh o půl
// srdíčka méně), nebo s méně srdíčky vyhrává se silnějšími, nebo má lepší fotky (smer "vice", o půl víc). Zdroj
// "porovnani", "fotky", nebo "oba" (obojí ukazuje stejným směrem); když porovnání a fotky ukazují proti sobě, platí
// porovnání (jsou to výslovné soudy).
type NesouladSrdicek struct {
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Hodnoceni float64 `json:"hodnoceni"`
	Navrh     float64 `json:"navrh"`
	Smer      string  `json:"smer"`
	Zdroj     string  `json:"zdroj"`
	Porovnani int     `json:"porovnani"` // porovnání s modelkami s méně (smer mene) nebo víc (vice) srdíčky
	Vysledky  int     `json:"vysledky"`  // z nich prohry (mene) nebo výhry (vice); remíza se nepočítá
	Rozdil    float64 `json:"rozdil"`    // výhry proti očekávání ze srdíček (záporné = méně)
	// Skóre fotek na stupnici srdíček fotek, z kolika alb a hodnocených fotek, a o kolik se fotky převedené na
	// stupnici srdíček modelek liší od jejích srdíček (jen zdroj fotky a oba)
	SkoreFotek       float64 `json:"skoreFotek"`
	AlbFotek         int     `json:"albFotek"`
	FotekHodnocenych int     `json:"fotekHodnocenych"`
	RozdilFotek      float64 `json:"rozdilFotek"`
	vaha             float64 // síla nesouladu pro řazení
}

// Návrh srdíček modelce – jediné místo, odkud rozhraní srdíčka navrhuje (po porovnání i v „Nesedí se srdíčky“):
// nehodnocené úroveň, na kterou vychází její síla; hodnocené nesoulad se srdíčky (porovnání s jinými úrovněmi nebo
// srdíčka fotek)
type NavrhSrdicek struct {
	Hodnoceni float64 `json:"hodnoceni"` // navržená srdíčka po polovinách; 0 = nic nenavrhovat
	// Nehodnocená: z kolika porovnání, výhry (remíza = půl) a nejistota síly
	Porovnani int     `json:"porovnani"`
	Vyhry     float64 `json:"vyhry"`
	Nejistota float64 `json:"nejistota"`
	// Hodnocená: nesoulad, ze kterého návrh je
	Nesoulad *NesouladSrdicek `json:"nesoulad,omitempty"`
}

// Návrh srdíček pro modelku: nehodnocené po aspoň 3 porovnáních a s nejistotou síly nejvýš 0,6 srdíčka úroveň, na
// kterou vychází (síla zaokrouhlená na polovinu srdíčka, 0,5–5); hodnocené návrh z nesouladu se srdíčky, když je
func (a *App) GetNavrhSrdicek(modelkaID int) NavrhSrdicek {
	navrh := NavrhSrdicek{}
	if a.uc == nil {
		return navrh
	}
	modelky, _ := a.nactiModelky("", false)
	var x *Modelka
	for i := range modelky {
		if modelky[i].ID == modelkaID {
			x = &modelky[i]
		}
	}
	if x == nil {
		return navrh
	}
	return a.modelOblibenosti(modelky).navrhSrdicek(x)
}

func (m *modelOblibenosti) navrhSrdicek(x *Modelka) NavrhSrdicek {
	navrh := NavrhSrdicek{}
	if x.Hodnoceni > 0 {
		if n, ok := m.nesoulad[x.ID]; ok {
			navrh.Hodnoceni, navrh.Nesoulad = n.Navrh, &n
		}
		return navrh
	}
	navrh.Porovnani, navrh.Vyhry = m.pocet[x.ID], m.vyhry[x.ID]
	navrh.Nejistota = zaokrouhlit3(math.Sqrt(m.rozptylModelky(x)))
	if s, ok := m.sila[x.ID]; ok && navrh.Porovnani >= minPorovnaniNavrhu && navrh.Nejistota <= maxNejistotaNavrhu {
		navrh.Hodnoceni = min(max(zaokrouhlitNaPul(s), 0.5), 5)
	}
	return navrh
}

// Nesoulad se srdíčky: u každé hodnocené modelky porovnání s hodnocenými, které mají jiná srdíčka (dnešní). Očekávaná
// výhra je σ(k·(hᵢ − hⱼ)) podle samotných srdíček; rozdíl skutečných a očekávaných výher (vážený stářím porovnání)
// pod −1,5 znamená, že modelka s víc srdíčky prohrává se slabšími (možná jí patří o půl srdíčka méně), nad +1,5,
// že vyhrává se silnějšími (o půl víc). Počítají se jen modelky s aspoň 3 takovými porovnáními.
func spocitatNesoulad(modelky []Modelka, porovnani []porovnaniZaznam, nyni time.Time) map[int]NesouladSrdicek {
	srdicka := make(map[int]float64, len(modelky))
	jmena := make(map[int]string, len(modelky))
	for _, m := range modelky {
		if m.Hodnoceni > 0 {
			srdicka[m.ID], jmena[m.ID] = m.Hodnoceni, m.Jmeno
		}
	}
	type soucet struct {
		n                                 int
		rozdil                            float64
		protiSlabsim, prohrySeSlabsimi    int
		protiSilnejsim, vyhrySeSilnejsimi int
	}
	soucty := map[int]*soucet{}
	pridat := func(id int, h, hJine, y, t float64) {
		s := soucty[id]
		if s == nil {
			s = &soucet{}
			soucty[id] = s
		}
		s.n++
		s.rozdil += t * (y - zLogitu(skalaBT*(h-hJine)))
		if hJine < h {
			s.protiSlabsim++
			if y == 0 {
				s.prohrySeSlabsimi++
			}
		} else {
			s.protiSilnejsim++
			if y == 1 {
				s.vyhrySeSilnejsimi++
			}
		}
	}
	for _, p := range porovnani {
		ha, okA := srdicka[p.a]
		hb, okB := srdicka[p.b]
		if !okA || !okB || ha == hb {
			continue
		}
		y := 0.5
		switch p.vysledek {
		case "a":
			y = 1
		case "b":
			y = 0
		}
		t := 1.0
		if !p.cas.IsZero() {
			t = vahaStari(p.cas, nyni)
		}
		pridat(p.a, ha, hb, y, t)
		pridat(p.b, hb, ha, 1-y, t)
	}
	vysledek := map[int]NesouladSrdicek{}
	for id, s := range soucty {
		if s.n < minPorovnaniNesouladu {
			continue
		}
		h := srdicka[id]
		n := NesouladSrdicek{ModelkaID: id, Jmeno: jmena[id], Hodnoceni: h, Rozdil: zaokrouhlit3(s.rozdil)}
		switch {
		case s.rozdil <= -prahNesouladu && h > 0.5:
			n.Smer, n.Navrh, n.Porovnani, n.Vysledky = "mene", h-0.5, s.protiSlabsim, s.prohrySeSlabsimi
		case s.rozdil >= prahNesouladu && h < 5:
			n.Smer, n.Navrh, n.Porovnani, n.Vysledky = "vice", h+0.5, s.protiSilnejsim, s.vyhrySeSilnejsimi
		default:
			continue
		}
		n.Zdroj, n.vaha = "porovnani", math.Abs(s.rozdil)/prahNesouladu
		vysledek[id] = n
	}
	return vysledek
}

// Nesoulad se skóre fotek: hodnocená modelka s dost hodnocenými fotkami, jejíž fotky převedené na stupnici srdíček
// modelek (kalibrace sbírky) se liší od jejích srdíček aspoň o celé srdíčko. Se stejným směrem jako porovnání se
// položky spojí (zdroj „oba“), s opačným platí porovnání.
func (m *modelOblibenosti) doplnitNesouladFotek(modelky []Modelka) {
	for _, x := range modelky {
		sf, ok := m.skore[x.ID]
		if x.Hodnoceni <= 0 || !ok || sf.alb < minAlbNesouladu || sf.fotek < minFotekNesouladu {
			continue
		}
		f, _ := m.kalibrace.naSrdicka(sf)
		rozdil := f - x.Hodnoceni
		smer, navrh := "", 0.0
		switch {
		case rozdil <= -prahNesouladuFotek && x.Hodnoceni > 0.5:
			smer, navrh = "mene", x.Hodnoceni-0.5
		case rozdil >= prahNesouladuFotek && x.Hodnoceni < 5:
			smer, navrh = "vice", x.Hodnoceni+0.5
		default:
			continue
		}
		fotky := func(n *NesouladSrdicek) {
			n.SkoreFotek, n.AlbFotek, n.FotekHodnocenych, n.RozdilFotek = zaokrouhlit3(sf.skore), sf.alb, sf.fotek, zaokrouhlit3(rozdil)
		}
		if n, ok := m.nesoulad[x.ID]; ok {
			if n.Smer == smer {
				fotky(&n)
				n.Zdroj, n.vaha = "oba", n.vaha+math.Abs(rozdil)/prahNesouladuFotek+1
				m.nesoulad[x.ID] = n
			}
			continue
		}
		n := NesouladSrdicek{ModelkaID: x.ID, Jmeno: x.Jmeno, Hodnoceni: x.Hodnoceni, Navrh: navrh, Smer: smer, Zdroj: "fotky", vaha: math.Abs(rozdil) / prahNesouladuFotek}
		fotky(&n)
		m.nesoulad[x.ID] = n
	}
}
