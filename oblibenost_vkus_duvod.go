package main

import (
	"fmt"
	"math"
	"playboy-app/internal/oblibenost"
	"sort"
	"strconv"
	"strings"
)

// Důvod odhadu modelu vkusu: příspěvky údajů, nejpodobnější hodnocené modelky podle listů stromů a zápis do textu.

// Hodnota číselného údaje do důvodu („výška 170 cm“, „BMI 19,5“, „70. léta“)
func textCislaVkusu(c int, x float64) string {
	p := popisCisVkusu[c]
	if c == cvRok {
		return textDesetileti(int(x) / 10 * 10)
	}
	t := cisloCesky(x, p.desetiny)
	if p.desetiny == 0 {
		t = fmt.Sprint(int(math.Round(x)))
	}
	if p.jednotka != "" {
		t += " " + p.jednotka
	}
	return p.nazev + " " + t
}

// Rozmezí koše do důvodu („výška 165–169 cm“, „výška pod 160 cm“)
func textKoseVkusu(c int, od, do float64) string {
	p := popisCisVkusu[c]
	cislo := func(x float64) string { return cisloCesky(x, p.desetiny) }
	jednotka := ""
	if p.jednotka != "" {
		jednotka = " " + p.jednotka
	}
	switch {
	case math.IsInf(od, -1):
		return fmt.Sprintf("%s pod %s%s", p.nazev, cislo(do), jednotka)
	case math.IsInf(do, 1):
		return fmt.Sprintf("%s od %s%s", p.nazev, cislo(od), jednotka)
	case p.desetiny == 0:
		return fmt.Sprintf("%s %s–%s%s", p.nazev, cislo(od), cislo(do-1), jednotka)
	}
	return fmt.Sprintf("%s %s–%s%s", p.nazev, cislo(od), cislo(do), jednotka)
}

type prispevekVkusu struct {
	klic string
	c    float64
}

// Příspěvky údajů modelky k odhadu podle skupiny („vlasy=blond“, „#0“ výška, „era=1970“ i z roku, „#fotky“);
// jen údaje, které modelka má. Součet příspěvků všech sloupců (i chybějících údajů) a základu je odhad.
func (v *modelVkusu) prispevkyOdhadu(u udajeVkusu) []prispevekVkusu {
	poSloupcich := make([]float64, len(v.sloupce))
	ma := make([]bool, len(v.sloupce))
	for _, k := range u.kat {
		if j, ok := v.index[k]; ok {
			ma[j] = true
		}
	}
	for j := v.hodnot; j < len(v.sloupce); j++ {
		ma[j] = u.ma[v.sloupce[j].c]
	}
	if v.vahaStromu < 1 {
		x := make([]float64, len(v.sloupce))
		for _, a := range v.radekHrebene(u) {
			x[a.j] = a.x
		}
		for j := range v.sloupce {
			if ma[j] {
				poSloupcich[j] += (1 - v.vahaStromu) * v.w[j] * (x[j] - v.stred[j])
			}
		}
	}
	if v.vahaStromu > 0 {
		v.les.Prispevky(v.kosyStromu(u), func(p int, c float64) {
			poSloupcich[v.stromove[p]] += v.vahaStromu * c
		})
	}
	var prispevky []prispevekVkusu
	for j, c := range poSloupcich {
		if !ma[j] || c == 0 {
			continue
		}
		s := &v.sloupce[j]
		klic := s.klic
		switch {
		case s.druh != slHodnota && s.c == cvRok:
			klic = "era=" + strconv.Itoa(int(u.cis[s.c])/10*10)
		case s.druh != slHodnota && (s.c == cvFotky || s.c == cvSkore):
			klic = "#fotky" // průměr srdíček fotek a skóre fotek jsou v důvodu jeden údaj
		}
		nalezen := false
		for x := range prispevky {
			if prispevky[x].klic == klic {
				prispevky[x].c += c
				nalezen = true
				break
			}
		}
		if !nalezen {
			prispevky = append(prispevky, prispevekVkusu{klic, c})
		}
	}
	return prispevky
}

// Zápis skupiny údajů modelky do důvodu
func (v *modelVkusu) popisPrispevku(u udajeVkusu, klic string) string {
	if j, ok := v.index[klic]; ok {
		return v.sloupce[j].popis
	}
	if desetileti, err := strconv.Atoi(strings.TrimPrefix(klic, "era=")); err == nil && strings.HasPrefix(klic, "era=") {
		return textDesetileti(desetileti)
	}
	if klic == "#fotky" {
		if u.ma[cvFotky] {
			return textCislaVkusu(cvFotky, u.cis[cvFotky])
		}
		return textCislaVkusu(cvSkore, u.cis[cvSkore])
	}
	if c, err := strconv.Atoi(strings.TrimPrefix(klic, "#")); err == nil && c >= 0 && c < pocetCisVkusu {
		return textCislaVkusu(c, u.cis[c])
	}
	return klic
}

// Nejsilnější tři příspěvky údajů ve směru odchylky odhadu od průměru jako text
func (v *modelVkusu) duvodOdhadu(id int, odhad float64) string {
	u := v.udaje[id]
	prispevky := v.prispevkyOdhadu(u)
	smer := 1.0
	if odhad < v.prumer {
		smer = -1
	}
	sort.Slice(prispevky, func(i, j int) bool {
		if prispevky[i].c*smer != prispevky[j].c*smer {
			return prispevky[i].c*smer > prispevky[j].c*smer
		}
		return prispevky[i].klic < prispevky[j].klic
	})
	var casti []string
	for _, p := range prispevky {
		if p.c*smer < 0.05 || len(casti) == 3 {
			break
		}
		casti = append(casti, v.popisPrispevku(u, p.klic))
	}
	return strings.Join(casti, ", ")
}

// Odhad hodnocení modelky po polovinách s důvodem; ok = false bez platného modelu nebo s málo údaji.
// sDuvodem = false vynechá text (rychlejší).
func (m *modelOblibenosti) odhadModelky(x Modelka, sDuvodem bool) (float64, string, bool) {
	odhad, ok := m.odhad[x.ID]
	if !ok || m.vkus == nil {
		return 0, "", false
	}
	return zaokrouhlitNaPul(odhad), m.vkus.textOdhadu(x.ID, odhad, sDuvodem, false), true
}

// „Odhad 4 srdíčka: blond, 70. léta, Pompeo Posar“, s podobnými navíc „; podobně jako Anna (4½) a Bára (4)“
// (hledání podobných projde všechny hodnocené, proto jen u tipů a u důvodu jedné modelky)
func (v *modelVkusu) textOdhadu(id int, odhad float64, sDuvodem, sPodobnymi bool) string {
	text := "Odhad " + textSrdicek(zaokrouhlitNaPul(odhad))
	if !sDuvodem {
		return text
	}
	if d := v.duvodOdhadu(id, odhad); d != "" {
		text += ": " + d
	}
	if !sPodobnymi {
		return text
	}
	if p := v.podobne(id, pocetPodobnychVkus); len(p) > 0 {
		jmena := make([]string, len(p))
		for i, h := range p {
			jmena[i] = fmt.Sprintf("%s (%s)", h.jmeno, kratceSrdicka(h.srdicka))
		}
		text += "; podobně jako " + strings.Join(jmena, " a ")
	}
	return text
}

// Nejpodobnější hodnocené modelky podle stromů: ve kolika stromech padne do stejného listu (nejvýš pocet,
// aspoň v polovině stromů)
func (v *modelVkusu) podobne(id int, pocet int) []hodnocenaVkusu {
	if v.les == nil || len(v.les.Stromy) == 0 || len(v.hodnocene) == 0 {
		return nil
	}
	listy := v.les.Listy(v.kosyStromu(v.udaje[id]))
	type kandidatka struct{ r, shod int }
	var nejlepsi []kandidatka
	for r, h := range v.hodnocene {
		if h.id == id {
			continue
		}
		shod := 0
		for t, l := range h.listy {
			if l == listy[t] {
				shod++
			}
		}
		if 2*shod < len(listy) {
			continue
		}
		nejlepsi = append(nejlepsi, kandidatka{r, shod})
		sort.SliceStable(nejlepsi, func(i, j int) bool { return nejlepsi[i].shod > nejlepsi[j].shod })
		nejlepsi = nejlepsi[:min(len(nejlepsi), pocet)]
	}
	vysledek := make([]hodnocenaVkusu, len(nejlepsi))
	for i, k := range nejlepsi {
		vysledek[i] = v.hodnocene[k.r]
	}
	return vysledek
}

// „4½“, „4“, „½“
func kratceSrdicka(h float64) string {
	return oblibenost.KratceSrdicka(h)
}
