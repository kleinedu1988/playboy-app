package main

// Kvalita fotek (ROADMAP 1.51, Údržba › Otočené, výřezy a kvalita). Kontrola na pozadí přečte náhled w400 každé
// fotky a spočítá ostrost (rozptyl Laplaciánu jasu), podíl přepálených a tmavých bodů, průměrný jas a rozměry
// náhledu. Úzký náhled (méně než 400 bodů na šířku) znamená malý originál – Disk ho nezvětšuje. Výsledky jsou
// v obsah-nezávislém souboru vedle mezipaměti náhledů (kvalita.json); Obsah fotek nepotřebuje.
// Když má slabá fotka ve sbírce stejnou fotku (shodný perceptuální otisk, otisky.go) v lepší kvalitě, nabídne se
// „Vyměnit za lepší“ – sloučení stejných fotek (stejne_fotky.go), které nechá lepší soubor a jde vrátit.
// „V pořádku“ (fotka je schválně měkká nebo tmavá) se pamatuje v nastavení. Prahy nejsou ověřené na sbírce.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"pinup-katalog/internal/nahledy"
)

const (
	klicKvalitaVPoradku = "kvalita_v_poradku"
	// Neověřené prahy (doladit na vzorku sbírky, viz K-VYZKOUSENI.md)
	prahRozmazane    = 12.0 // rozptyl Laplaciánu jasu 0–255 na náhledu w400
	prahPrepalene    = 0.30 // podíl bodů s jasem ≥ 250
	prahTmave        = 0.60 // podíl bodů s jasem ≤ 12 …
	prahTmavyPrumer  = 40.0 // … a zároveň průměrný jas pod touto hodnotou
	sirkaNahledu     = 400
	ukladatKvalituPo = 200
)

// Mereni: co se z náhledu spočítá (krátké klíče kvůli velikosti souboru)
type Mereni struct {
	Ostrost float64 `json:"o"`
	Svetle  float64 `json:"s"`
	Tmave   float64 `json:"t"`
	Jas     float64 `json:"j"`
	Sirka   int     `json:"w"`
	Vyska   int     `json:"h"`
}

// Problémy fotky podle prahů: "male", "rozmazane", "prepalene", "tmave"
func (m Mereni) Problemy() []string {
	var p []string
	if m.Sirka > 0 && m.Sirka < sirkaNahledu && m.Vyska < sirkaNahledu {
		p = append(p, "male")
	}
	if m.Ostrost < prahRozmazane {
		p = append(p, "rozmazane")
	}
	if m.Svetle >= prahPrepalene {
		p = append(p, "prepalene")
	}
	if m.Tmave >= prahTmave && m.Jas < prahTmavyPrumer {
		p = append(p, "tmave")
	}
	return p
}

// Skóre pro porovnání stejných fotek: větší a ostřejší je lepší
func (m Mereni) skore() float64 {
	return float64(m.Sirka*m.Vyska) / 1000 * (1 + m.Ostrost/100)
}

// ZmeritKvalitu: měření jednoho obrázku (jas podle Rec. 601, Laplacián 4-okolí bez okrajových bodů)
func ZmeritKvalitu(img image.Image) Mereni {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	m := Mereni{Sirka: w, Vyska: h}
	if w < 3 || h < 3 {
		return m
	}
	jas := make([]float64, w*h)
	var soucet float64
	var svetle, tmave int
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			r, g, bb, _ := img.At(b.Min.X+x, b.Min.Y+y).RGBA()
			j := (0.299*float64(r) + 0.587*float64(g) + 0.114*float64(bb)) / 257
			jas[y*w+x] = j
			soucet += j
			if j >= 250 {
				svetle++
			} else if j <= 12 {
				tmave++
			}
		}
	}
	n := float64(w * h)
	m.Jas, m.Svetle, m.Tmave = soucet/n, float64(svetle)/n, float64(tmave)/n
	var s, s2 float64
	pocet := 0
	for y := 1; y < h-1; y++ {
		for x := 1; x < w-1; x++ {
			i := y*w + x
			l := jas[i-1] + jas[i+1] + jas[i-w] + jas[i+w] - 4*jas[i]
			s += l
			s2 += l * l
			pocet++
		}
	}
	prumer := s / float64(pocet)
	m.Ostrost = s2/float64(pocet) - prumer*prumer
	return m
}

type kontrolaKvality struct {
	mu       sync.Mutex
	bezi     bool
	hotovo   int
	celkem   int
	chyba    string
	zrusit   context.CancelFunc
	konec    chan struct{}
	vysledky map[string]Mereni
	chybne   map[string]bool
	nacteno  bool
	cesta    string
	nahled   func(ctx context.Context, id string) ([]byte, error)
}

var zamekKvality sync.Mutex

func (a *App) kontrolyKvality() *kontrolaKvality {
	zamekKvality.Lock()
	defer zamekKvality.Unlock()
	if a.kvalita == nil {
		k := &kontrolaKvality{vysledky: map[string]Mereni{}, chybne: map[string]bool{}}
		if a.nahledy != nil {
			if slozka := nahledy.Slozka(); slozka != "" {
				k.cesta = filepath.Join(filepath.Dir(slozka), "kvalita.json")
			}
			k.nahled = a.nahledProObsah
		}
		a.kvalita = k
	}
	return a.kvalita
}

func (k *kontrolaKvality) nacistZamceno() {
	if k.nacteno {
		return
	}
	k.nacteno = true
	if k.cesta == "" {
		return
	}
	if b, err := os.ReadFile(k.cesta); err == nil {
		nove := map[string]Mereni{}
		if json.Unmarshal(b, &nove) == nil {
			for id, m := range nove {
				if _, uz := k.vysledky[id]; !uz {
					k.vysledky[id] = m
				}
			}
		}
	}
}

func (k *kontrolaKvality) ulozitZamceno() error {
	if k.cesta == "" {
		return nil
	}
	b, err := json.Marshal(k.vysledky)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(k.cesta), 0o700); err != nil {
		return err
	}
	docasny := k.cesta + ".tmp"
	if err := os.WriteFile(docasny, b, 0o600); err != nil {
		return err
	}
	return os.Rename(docasny, k.cesta)
}

type StavKvality struct {
	Mozna         bool   `json:"mozna"` // je mezipaměť náhledů
	Bezi          bool   `json:"bezi"`
	Hotovo        int    `json:"hotovo"`
	Celkem        int    `json:"celkem"`
	Zkontrolovano int    `json:"zkontrolovano"`
	Fotek         int    `json:"fotek"`
	Chyba         string `json:"chyba"`
}

func (a *App) GetStavKvality() StavKvality {
	ids, _ := a.fotkyProObsah()
	k := a.kontrolyKvality()
	k.mu.Lock()
	defer k.mu.Unlock()
	k.nacistZamceno()
	st := StavKvality{Mozna: k.nahled != nil, Bezi: k.bezi, Hotovo: k.hotovo, Celkem: k.celkem, Fotek: len(ids), Chyba: k.chyba}
	for _, id := range ids {
		if _, ok := k.vysledky[id]; ok {
			st.Zkontrolovano++
		}
	}
	return st
}

// SpustitKontroluKvality: změří fotky, které měření ještě nemají; false = bez náhledů, běží, nebo není co
func (a *App) SpustitKontroluKvality() bool {
	ids, err := a.fotkyProObsah()
	if err != nil {
		return false
	}
	k := a.kontrolyKvality()
	k.mu.Lock()
	if k.bezi || k.nahled == nil {
		k.mu.Unlock()
		return false
	}
	k.nacistZamceno()
	var chybi []string
	for _, id := range ids {
		if _, ok := k.vysledky[id]; !ok && !k.chybne[id] {
			chybi = append(chybi, id)
		}
	}
	if len(chybi) == 0 {
		k.mu.Unlock()
		return false
	}
	ctx, zrusit := context.WithCancel(context.Background())
	k.bezi, k.hotovo, k.celkem, k.chyba, k.zrusit, k.konec = true, 0, len(chybi), "", zrusit, make(chan struct{})
	konec, nahled := k.konec, k.nahled
	k.mu.Unlock()
	go func() {
		defer close(konec)
		err := k.merit(ctx, chybi, nahled)
		k.mu.Lock()
		if uerr := k.ulozitZamceno(); err == nil {
			err = uerr
		}
		k.bezi, k.zrusit = false, nil
		if err != nil && !errors.Is(err, context.Canceled) {
			k.chyba = err.Error()
		}
		k.mu.Unlock()
	}()
	return true
}

func (k *kontrolaKvality) merit(ctx context.Context, ids []string, nahled func(context.Context, string) ([]byte, error)) error {
	for i, id := range ids {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		data, err := nahled(ctx, id)
		var img image.Image
		if err == nil {
			img, _, err = image.Decode(bytes.NewReader(data))
		}
		k.mu.Lock()
		k.hotovo++
		if err != nil {
			if ctx.Err() == nil {
				k.chybne[id] = true
			}
		} else {
			k.vysledky[id] = ZmeritKvalitu(img)
		}
		var uerr error
		if (i+1)%ukladatKvalituPo == 0 {
			uerr = k.ulozitZamceno()
		}
		k.mu.Unlock()
		if uerr != nil {
			return uerr
		}
	}
	return nil
}

func (a *App) PrerusitKontroluKvality() {
	if a.kvalita == nil {
		return
	}
	k := a.kvalita
	k.mu.Lock()
	zrusit, konec := k.zrusit, k.konec
	k.mu.Unlock()
	if zrusit == nil {
		return
	}
	zrusit()
	select {
	case <-konec:
	case <-time.After(3 * time.Second):
	}
}

// SlabaFotka: fotka s aspoň jedním problémem; Lepsi = stejná fotka ve sbírce v lepší kvalitě (jinak "")
type SlabaFotka struct {
	DriveID   string   `json:"driveId"`
	FotkyIDs  []int    `json:"fotkyIds"`
	URL       string   `json:"url"`
	Problemy  []string `json:"problemy"`
	Mereni    Mereni   `json:"mereni"`
	ModelkaID int      `json:"modelkaId"`
	Jmeno     string   `json:"jmeno"`
	Album     string   `json:"album"`
	Hodnoceni int      `json:"hodnoceni"`
	Lepsi     string   `json:"lepsi"`
	LepsiURL  string   `json:"lepsiUrl"`
}

// Stejná fotka v lepší kvalitě: shodný otisk (pHash do prahPHashJiste) a výrazně větší nebo ostřejší
func lepsiStejna(id string, m Mereni, otisky map[string]otisk, mereni map[string]Mereni) string {
	x, ok := otisky[id]
	if !ok {
		return ""
	}
	nejlepsi, skore := "", m.skore()*1.3
	for jine, y := range otisky {
		if jine == id {
			continue
		}
		if _, dp := x.vzdalenost(y); dp > prahPHashJiste {
			continue
		}
		mj, ok := mereni[jine]
		if !ok || len(mj.Problemy()) > 0 {
			continue
		}
		if s := mj.skore(); s > skore {
			nejlepsi, skore = jine, s
		}
	}
	return nejlepsi
}

// GetSlabeFotky: změřené fotky s problémem (bez označených „V pořádku“), od nejvíc hodnocených;
// fotky s lepší stejnou fotkou ve sbírce jsou první
func (a *App) GetSlabeFotky() []SlabaFotka {
	k := a.kontrolyKvality()
	k.mu.Lock()
	k.nacistZamceno()
	mereni := make(map[string]Mereni, len(k.vysledky))
	for id, m := range k.vysledky {
		mereni[id] = m
	}
	k.mu.Unlock()
	v := []SlabaFotka{}
	if len(mereni) == 0 {
		return v
	}
	vPoradku := a.mnozinaNastaveni(klicKvalitaVPoradku)
	radky, err := a.db.Query(`SELECT f.id, f.drive_file_id, COALESCE(f.hodnoceni, 0), COALESCE(al.modelka_id, 0), al.album,
		COALESCE(m.jmeno, '') FROM fotky f JOIN alba al ON al.id = f.album_id LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE f.nedostupne_od IS NULL ORDER BY f.id`)
	if err != nil {
		a.chyba("slabé fotky", err)
		return v
	}
	defer radky.Close()
	podleSouboru := map[string]*SlabaFotka{}
	var poradi []string
	for radky.Next() {
		var id, hodnoceni, modelka int
		var drive, album, jmeno string
		if radky.Scan(&id, &drive, &hodnoceni, &modelka, &album, &jmeno) != nil {
			continue
		}
		m, ok := mereni[drive]
		if !ok || vPoradku[drive] {
			continue
		}
		s := podleSouboru[drive]
		if s == nil {
			problemy := m.Problemy()
			if len(problemy) == 0 {
				continue
			}
			s = &SlabaFotka{DriveID: drive, URL: adresaObrazku(drive), Problemy: problemy, Mereni: m, ModelkaID: modelka, Jmeno: jmeno, Album: album}
			podleSouboru[drive] = s
			poradi = append(poradi, drive)
		}
		s.FotkyIDs = append(s.FotkyIDs, id)
		if hodnoceni > s.Hodnoceni {
			s.Hodnoceni = hodnoceni
		}
	}
	if len(poradi) > 0 {
		otisky := a.otiskySouboru()
		for _, d := range poradi {
			s := podleSouboru[d]
			if s.Lepsi = lepsiStejna(d, s.Mereni, otisky, mereni); s.Lepsi != "" {
				s.LepsiURL = adresaObrazku(s.Lepsi)
			}
			v = append(v, *s)
		}
	}
	sort.SliceStable(v, func(i, j int) bool {
		if (v[i].Lepsi != "") != (v[j].Lepsi != "") {
			return v[i].Lepsi != ""
		}
		return v[i].Hodnoceni > v[j].Hodnoceni
	})
	return v
}

// Fotka je schválně taková (měkká kresba, tmavá nálada): už se nehlásí; vPoradku = false to vrací
func (a *App) OznacitKvalituVPoradku(driveIDs []string, vPoradku bool) bool {
	return a.zmenitMnozinuNastaveni(klicKvalitaVPoradku, driveIDs, vPoradku)
}
