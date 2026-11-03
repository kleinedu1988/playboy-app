package main

// Stahování náhledů celé sbírky na pozadí (titulní fotky modelek, pak plakáty centerfoldů a obálky), aby se karty
// a stěny ukázaly hned i napoprvé. Spouští a zastavuje ho rozhraní (app/nahledy-pozadi.js; zastavení si pamatuje
// samo), stav čte každé dvě sekundy. Co už je na disku, se přeskočí – další starty dotáhnou jen nové.

import (
	"context"
	"sync"
	"sync/atomic"
)

type StavStahovaniNahledu struct {
	Bezi   bool `json:"bezi"`
	Hotovo int  `json:"hotovo"` // zpracováno (staženo, už uloženo nebo na Disku nedostupné)
	Celkem int  `json:"celkem"`
}

type stahovaniNaPozadi struct {
	mu             sync.Mutex
	zrusit         context.CancelFunc
	hotovo, celkem atomic.Int64
	bezi           atomic.Bool
}

var nahledyNaPozadi stahovaniNaPozadi

// Náhledy k předstažení v pořadí priority: titulní fotky (karta w400), pak plakáty centerfoldů a obálky (w600)
func (a *App) polozkyKPredstazeni() []polozkaNahledu {
	var v []polozkaNahledu
	videno := map[string]bool{}
	pridat := func(dotaz, velikost string) {
		radky, err := a.db.Query(dotaz)
		if err != nil {
			return
		}
		defer radky.Close()
		for radky.Next() {
			var id string
			if radky.Scan(&id) == nil && jeHoleID(id) && !videno[id+velikost] {
				videno[id+velikost] = true
				v = append(v, polozkaNahledu{id, velikost})
			}
		}
	}
	pridat(`SELECT drive_cover_id FROM modelky WHERE COALESCE(drive_cover_id, '') <> '' ORDER BY jmeno`, "w400")
	pridat(`SELECT f.drive_file_id FROM fotky f JOIN alba a ON a.id = f.album_id
		WHERE a.typ IN ('Centerfold', 'Cover') ORDER BY a.vydani DESC, f.poradi IS NULL, f.poradi, f.id`, "w600")
	return v
}

// Spustí stahování na pozadí (už běžící nechá běžet); false bez mezipaměti náhledů
func (a *App) SpustitStahovaniNahledu() bool {
	if a.nahledy == nil || a.nahledy.slozka == "" {
		return false
	}
	p := &nahledyNaPozadi
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.bezi.Load() {
		return true
	}
	polozky := a.polozkyKPredstazeni()
	ctx, zrusit := context.WithCancel(context.Background())
	p.zrusit = zrusit
	p.hotovo.Store(0)
	p.celkem.Store(int64(len(polozky)))
	p.bezi.Store(true)
	go func() {
		defer p.bezi.Store(false)
		a.nahledy.predstahnout(ctx, polozky, func() { p.hotovo.Add(1) })
	}()
	return true
}

func (a *App) ZastavitStahovaniNahledu() {
	p := &nahledyNaPozadi
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.zrusit != nil {
		p.zrusit()
	}
}

func (a *App) GetStavStahovaniNahledu() StavStahovaniNahledu {
	p := &nahledyNaPozadi
	return StavStahovaniNahledu{Bezi: p.bezi.Load(), Hotovo: int(p.hotovo.Load()), Celkem: int(p.celkem.Load())}
}
