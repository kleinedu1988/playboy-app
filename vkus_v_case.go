package main

// Můj vkus v čase (ROADMAP 1.53): podklady pro Statistiky › Můj vkus v čase (frontend/src/lib/vkus-v-case.js).
// Porovnání dvojic mají celou historii s časem a srdíčky obou modelek v tu chvíli; změny srdíček modelek se
// zapisují od verze 1.53 do databáze učení (úprava č. 10). Vyhodnocení (kdo vyhrává, posun proti dřívějšku,
// testy) je ve frontendu, který zná údaje modelek.

type PorovnaniVCase struct {
	Den      string `json:"den"` // RRRR-MM-DD
	Vitez    int    `json:"vitez"`
	Porazena int    `json:"porazena"`
}

type ZmenaSrdicek struct {
	Den     string  `json:"den"`
	Modelka int     `json:"modelka"`
	Pred    float64 `json:"pred"`
	Po      float64 `json:"po"`
}

type VkusVCase struct {
	Porovnani []PorovnaniVCase `json:"porovnani"` // bez remíz, od nejstaršího
	Srdicka   []ZmenaSrdicek   `json:"srdicka"`
}

// Zápis změny srdíček modelky (bez databáze učení nic)
func (u *uceni) zapsatSrdicka(modelka int, pred, po float64) {
	if u == nil {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	if db := u.zajistit(); db != nil {
		if _, err := db.Exec(`INSERT INTO historie_srdicek (cas, modelka_id, pred, po) VALUES (?, ?, ?, ?)`, ted(), modelka, pred, po); err != nil {
			varovatUceni("změna srdíček se nezapsala: %v", err)
		}
	}
}

func (a *App) GetVkusVCase() VkusVCase {
	v := VkusVCase{Porovnani: []PorovnaniVCase{}, Srdicka: []ZmenaSrdicek{}}
	u := a.uc
	if u == nil {
		return v
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	for _, p := range u.nacistPorovnani() {
		if p.cas.IsZero() || (p.vysledek != "a" && p.vysledek != "b") {
			continue
		}
		vitez, porazena := p.a, p.b
		if p.vysledek == "b" {
			vitez, porazena = p.b, p.a
		}
		v.Porovnani = append(v.Porovnani, PorovnaniVCase{Den: p.cas.Format("2006-01-02"), Vitez: vitez, Porazena: porazena})
	}
	db := u.zajistit()
	if db == nil {
		return v
	}
	radky, err := db.Query(`SELECT substr(cas, 1, 10), modelka_id, pred, po FROM historie_srdicek ORDER BY rowid`)
	if err != nil {
		return v
	}
	defer radky.Close()
	for radky.Next() {
		var z ZmenaSrdicek
		if radky.Scan(&z.Den, &z.Modelka, &z.Pred, &z.Po) == nil {
			v.Srdicka = append(v.Srdicka, z)
		}
	}
	return v
}
