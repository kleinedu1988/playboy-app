package main

// Dnešní výběr: porovnávání po čtveřicích („Která se ti líbí nejvíc?“). Jedna volba nejlepší ze čtyř zapíše tři
// porovnání (vítězka proti každé ze tří), takže na stejné zpřesnění pořadí stačí asi třetina kliknutí co u dvojic.
// Čtveřice staví na výběru dvojic aktivním učením (oblibenost_dvojice.go): nejinformativnější dvojice dá základ
// a doplní se dvěma modelkami s nejbližší silou (z dalších nabídnutých dvojic, jinak z celé sbírky), aby volba
// byla vyrovnaná – vybírat mezi jasně lepší a jasně horšími by nic nového neřeklo.

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
)

// Čtveřice k porovnání: čísla modelek v pořadí zobrazení a proč právě ona
type CtvericePorovnani struct {
	Modelky []int  `json:"modelky"`
	Duvod   string `json:"duvod"`
}

const velikostCtverice = 4

// Čtveřice k porovnání (nejvýš pocet); prázdné, když na porovnání není dost modelek
func (a *App) GetCtvericeKPorovnani(pocet int) []CtvericePorovnani {
	vysledek := []CtvericePorovnani{}
	if a.uc == nil {
		return vysledek
	}
	pocet = min(max(pocet, 1), 20)
	dvojice := a.GetDvojiceKPorovnani(min(pocet*velikostCtverice, maxDvojicNaVolani), "")
	if len(dvojice) == 0 {
		return vysledek
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	return sestavitCtverice(dvojice, modelky, model, pocet, rand.New(rand.NewSource(int64(len(dvojice))*7919+int64(model.porovnani))))
}

// Síla pro sestavení čtveřice: z pořadí, jinak odhad vkusu; false = o modelce se nic neví
func silaProCtverici(model *modelOblibenosti, id int) (float64, bool) {
	if s, ok := model.sila[id]; ok {
		return s, true
	}
	if s, ok := model.odhad[id]; ok {
		return s, true
	}
	return 0, false
}

func sestavitCtverice(dvojice []DvojicePorovnani, modelky []Modelka, model *modelOblibenosti, pocet int, r *rand.Rand) []CtvericePorovnani {
	vysledek := []CtvericePorovnani{}
	pouzite := map[int]bool{}
	// Kandidátky na doplnění: napřed z nabídnutých dvojic (o těch je co rozhodovat), pak celá sbírka s fotkou
	var zDvojic, ostatni []int
	videne := map[int]bool{}
	for _, d := range dvojice {
		for _, id := range []int{d.A, d.B} {
			if !videne[id] {
				videne[id] = true
				zDvojic = append(zDvojic, id)
			}
		}
	}
	for _, m := range modelky {
		if !videne[m.ID] && (m.CoverID != "" || m.PocetFotek > 0) {
			if _, ok := silaProCtverici(model, m.ID); ok {
				ostatni = append(ostatni, m.ID)
			}
		}
	}
	nejblizsi := func(z []int, cil float64) int {
		nej, vzdal := 0, math.Inf(1)
		for _, id := range z {
			if pouzite[id] {
				continue
			}
			s, ok := silaProCtverici(model, id)
			if !ok {
				continue
			}
			if d := math.Abs(s - cil); d < vzdal {
				nej, vzdal = id, d
			}
		}
		return nej
	}
	for _, d := range dvojice {
		if len(vysledek) >= pocet {
			break
		}
		if pouzite[d.A] || pouzite[d.B] {
			continue
		}
		skupina := []int{d.A, d.B}
		pouzite[d.A], pouzite[d.B] = true, true
		sa, _ := silaProCtverici(model, d.A)
		sb, _ := silaProCtverici(model, d.B)
		cil := (sa + sb) / 2
		for len(skupina) < velikostCtverice {
			id := nejblizsi(zDvojic, cil)
			if id == 0 {
				id = nejblizsi(ostatni, cil)
			}
			if id == 0 {
				break
			}
			pouzite[id] = true
			skupina = append(skupina, id)
		}
		if len(skupina) < 3 {
			continue
		}
		r.Shuffle(len(skupina), func(i, j int) { skupina[i], skupina[j] = skupina[j], skupina[i] })
		vysledek = append(vysledek, CtvericePorovnani{Modelky: skupina, Duvod: d.Duvod})
	}
	return vysledek
}

// Volba nejlepší ze čtveřice: vítězka proti každé ostatní jako jedno porovnání (vítězka je A)
func (a *App) PorovnatCtverici(modelky []int, vitezka int) bool {
	ok, zapsano := false, 0
	for _, id := range modelky {
		if id == vitezka {
			ok = true
		}
	}
	if !ok {
		return false
	}
	for _, id := range modelky {
		if id != vitezka && a.porovnatModelky(vitezka, id, "a", "") {
			zapsano++
		}
	}
	return zapsano > 0
}

// Vrácení poslední volby ze čtveřice (její porovnání jsou poslední v pořadí zápisu, od konce)
func (a *App) VratitCtverici(modelky []int, vitezka int) bool {
	vraceno := 0
	for i := len(modelky) - 1; i >= 0; i-- {
		if modelky[i] != vitezka && a.VratitPorovnani(vitezka, modelky[i]) {
			vraceno++
		}
	}
	return vraceno > 0
}

// Pořadí modelek v oblíbenosti (shrnutí po dnešním výběru: kdo kam postoupil); 0 = mimo pořadí
func (a *App) GetPoradiModelek(ids []int) map[int]int {
	v := map[int]int{}
	if a.uc == nil {
		return v
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	for _, id := range ids {
		v[id] = model.poradi[id]
	}
	return v
}

// Lákadlo na kartičku dnešního výběru po spuštění: konkrétní rozhodnutí, které výběr přinese
func (a *App) GetLakadloPorovnani() string {
	if a.uc == nil {
		return ""
	}
	modelky, _ := a.nactiModelky("", false)
	model := a.modelOblibenosti(modelky)
	jmena := map[int]string{}
	nove := 0
	for _, m := range modelky {
		jmena[m.ID] = m.Jmeno
		if m.Hodnoceni <= 0 && model.pocet[m.ID] == 0 && (m.CoverID != "" || m.PocetFotek > 0) {
			nove++
		}
	}
	type mistoModelky struct{ id, poradi int }
	var top []mistoModelky
	for id, p := range model.poradi {
		if p > 0 && p <= 11 {
			top = append(top, mistoModelky{id, p})
		}
	}
	sort.Slice(top, func(i, j int) bool { return top[i].poradi < top[j].poradi })
	// Střídá se podle dne: hranice Top 10, nebo nezařazené modelky
	if len(top) >= 11 && (nove == 0 || model.porovnani%2 == 0) {
		return fmt.Sprintf("Kdo bude desátá v Top 10 – %s, nebo %s?", jmena[top[9].id], jmena[top[10].id])
	}
	if nove > 0 {
		return fmt.Sprintf("%s čeká na zařazení – dnešní výběr je posune na správné místo.", sklonovatCesky(nove, "nová modelka", "nové modelky", "nových modelek"))
	}
	return "Pár voleb dnes zpřesní tvé pořadí a návrhy srdíček."
}

func sklonovatCesky(n int, jedna, dve, pet string) string {
	switch {
	case n == 1:
		return "1 " + jedna
	case n >= 2 && n <= 4:
		return fmt.Sprintf("%d %s", n, dve)
	default:
		return fmt.Sprintf("%d %s", n, pet)
	}
}
