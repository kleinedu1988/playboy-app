package main

// Oblíbenost modelek mezi spuštěními: výsledek modelu (to, co seznam modelek z modelu potřebuje) se ukládá do
// mezipaměti databáze učení pod otiskem dat. Při startu, když se od minula nic nezměnilo (modelky, porovnání,
// zájem, den), dostane seznam modelek oblíbenost hned a celý model (~0,35 s se sbírkou 3 000 modelek) se spočítá
// až na pozadí.

const druhUlozeneOblibenosti = "oblibenost-modelek"

type oblibenostModelky struct {
	O  float64 `json:"o,omitempty"`  // oblíbenost
	H  float64 `json:"h,omitempty"`  // odhad hodnocení
	P  int     `json:"p,omitempty"`  // pořadí
	Z  int     `json:"z,omitempty"`  // změna pořadí
	T  int     `json:"t,omitempty"`  // dní trendu
	U  int     `json:"u,omitempty"`  // úroveň Top
	C  int     `json:"c,omitempty"`  // čeká na úroveň
	Ob int     `json:"ob,omitempty"` // obhajuje úroveň
	B  string  `json:"b,omitempty"`  // proč nemá odhad (0.02.040)
}

func (o oblibenostModelky) doplnit(m *Modelka) {
	m.Oblibenost, m.OdhadHodnoceni, m.Poradi, m.ZmenaPoradi, m.TrendDni = o.O, o.H, o.P, o.Z, o.T
	m.UrovenTop, m.CekaNaTop, m.ObhajujeTop = o.U, o.C, o.Ob
	m.BezOdhadu = o.B
}

// Volá se se zámkem výpočtu; zápis běží na pozadí
func ulozitOblibenostModelek(u *uceni, modelky []Modelka, model *modelOblibenosti) {
	v := make(map[int]oblibenostModelky, len(modelky))
	for i := range modelky {
		m := modelky[i]
		x := oblibenostModelky{O: model.oblibenostModelky(&m), P: model.poradi[m.ID], Z: model.zmenaPoradi[m.ID], U: model.uroven[m.ID],
			C: model.ceka[m.ID].Uroven, Ob: model.obhajoba[m.ID].Uroven}
		if _, ok := model.zmenaPoradi[m.ID]; ok {
			x.T = model.trendDni
		}
		if m.Hodnoceni <= 0 && model.vkus != nil && model.vkus.platny {
			if odhad, ok := model.odhad[m.ID]; ok {
				x.H = zaokrouhlitNaPul(odhad)
			}
		}
		x.B = model.duvodBezOdhadu(m)
		v[m.ID] = x
	}
	u.ulozitMezipamet(druhUlozeneOblibenosti, model.otisk, v)
}

// Uložená oblíbenost pro tytéž modelky a data; nil, když model v tomto běhu už existuje nebo se data změnila
func (a *App) ulozenaOblibenost(modelky []Modelka) map[int]oblibenostModelky {
	u := a.uc
	if !u.ob.vypocet.TryLock() {
		return nil // model se právě počítá: počkat na něj
	}
	defer u.ob.vypocet.Unlock()
	if u.ob.model != nil {
		return nil
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	otisk := otiskOblibenosti(modelky, u.nacistPorovnani(), u.ob.zaznamuZajmu/zaznamuNaPrepocet)
	var v map[int]oblibenostModelky
	if !u.nacistMezipamet(druhUlozeneOblibenosti, otisk, &v) || len(v) == 0 {
		return nil
	}
	return v
}
