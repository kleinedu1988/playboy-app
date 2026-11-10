package main

// Otočené fotky a návrh výřezu titulní fotky (ROADMAP 1.45, výpočty v internal/obsah/otoceni.go).
//
// Kontrola otočení běží na pozadí nad fotkami s vektorem (vyžaduje zapnutý Obsah fotek): pro každý soubor tři
// vektory CLIP otočených náhledů a skóre všech čtyř orientací proti středu sbírky se uloží do obsah/otoceni.json.
// Návrh se pak počítá vždy proti současné rotaci fotky ve sbírce, takže otočení jedním klikem úkol rovnou vyřídí.
// „V pořádku“ (fotka je schválně na boku) se pamatuje v nastavení.
//
// Výřez: detektor NudeNet na náhledu titulní fotky najde postavu a obličej; výřez se navrhne pro kartu 3 : 4
// a uloží až potvrzením.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"playboy-app/internal/obsah"
)

const (
	nazevSouboruOtoceni = "otoceni.json"
	klicOtoceniVPoradku = "otoceni_v_poradku"
	klicVyrezVychozi    = "vyrez_vychozi_ok"
	// O kolik musí být jiná orientace podobnější středu sbírky než současná, aby se hlásila
	prahOtoceni      = 0.02
	pomerKarty       = 3.0 / 4.0
	ukladatOtoceniPo = 100
)

type kontrolaOtoceni struct {
	mu       sync.Mutex
	bezi     bool
	hotovo   int
	celkem   int
	chyba    string
	zrusit   context.CancelFunc
	konec    chan struct{}
	vysledky map[string][4]float32 // Drive ID → skóre orientací 0°, 90°, 180°, 270°
	nacteno  bool
}

type StavOtoceni struct {
	Zapnuto       bool   `json:"zapnuto"` // Obsah fotek má model a vektory
	Bezi          bool   `json:"bezi"`
	Hotovo        int    `json:"hotovo"` // v tomto běhu
	Celkem        int    `json:"celkem"` // v tomto běhu
	Zkontrolovano int    `json:"zkontrolovano"`
	Fotek         int    `json:"fotek"`
	Chyba         string `json:"chyba"`
}

type OtocenaFotka struct {
	DriveID   string  `json:"driveId"`
	FotkyIDs  []int   `json:"fotkyIds"`
	URL       string  `json:"url"`
	Rotace    int     `json:"rotace"`
	Navrh     int     `json:"navrh"`
	Rozdil    float64 `json:"rozdil"`
	ModelkaID int     `json:"modelkaId"`
	Jmeno     string  `json:"jmeno"`
	Album     string  `json:"album"`
}

var zamekKontrolyOtoceni sync.Mutex

func (a *App) kontrolyOtoceni() *kontrolaOtoceni {
	zamekKontrolyOtoceni.Lock()
	defer zamekKontrolyOtoceni.Unlock()
	if a.otoceni == nil {
		a.otoceni = &kontrolaOtoceni{vysledky: map[string][4]float32{}}
	}
	return a.otoceni
}

func (a *App) souborOtoceni() string {
	if a.slozkaObsahu() == "" {
		return ""
	}
	return filepath.Join(a.slozkaObsahu(), nazevSouboruOtoceni)
}

// Volá se se zamčeným k.mu
func (a *App) nacistOtoceniZamceno(k *kontrolaOtoceni) {
	if k.nacteno {
		return
	}
	k.nacteno = true
	if f := a.souborOtoceni(); f != "" {
		if b, err := os.ReadFile(f); err == nil {
			json.Unmarshal(b, &k.vysledky)
		}
	}
}

func (a *App) ulozitOtoceni(k *kontrolaOtoceni) error {
	f := a.souborOtoceni()
	if f == "" {
		return nil
	}
	k.mu.Lock()
	b, err := json.Marshal(k.vysledky)
	k.mu.Unlock()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(f), 0o755); err != nil {
		return err
	}
	docasny := f + ".tmp"
	if err := os.WriteFile(docasny, b, 0o644); err != nil {
		return err
	}
	return os.Rename(docasny, f)
}

func (a *App) obsahZapnuty() bool {
	return a.obsah != nil && a.obsah.Zapnuto()
}

func (a *App) GetStavOtoceni() StavOtoceni {
	k := a.kontrolyOtoceni()
	ids, _ := a.fotkyProObsah()
	k.mu.Lock()
	defer k.mu.Unlock()
	a.nacistOtoceniZamceno(k)
	st := StavOtoceni{Zapnuto: a.obsahZapnuty(), Bezi: k.bezi, Hotovo: k.hotovo, Celkem: k.celkem, Fotek: len(ids), Chyba: k.chyba}
	for _, id := range ids {
		if _, ok := k.vysledky[id]; ok {
			st.Zkontrolovano++
		}
	}
	return st
}

// Kontrola otočení fotek, které ji ještě nemají; false = Obsah fotek není zapnutý, běží, nebo není co
func (a *App) SpustitKontroluOtoceni() bool {
	if !a.obsahZapnuty() {
		return false
	}
	stred := a.obsah.StredVsech()
	if stred == nil {
		return false
	}
	ids, err := a.fotkyProObsah()
	if err != nil {
		return false
	}
	k := a.kontrolyOtoceni()
	k.mu.Lock()
	if k.bezi {
		k.mu.Unlock()
		return false
	}
	a.nacistOtoceniZamceno(k)
	var chybi []string
	for _, id := range ids {
		if _, ok := k.vysledky[id]; !ok && a.obsah.Vektor(id) != nil {
			chybi = append(chybi, id)
		}
	}
	if len(chybi) == 0 {
		k.mu.Unlock()
		return false
	}
	ctx, zrusit := context.WithCancel(context.Background())
	k.bezi, k.hotovo, k.celkem, k.chyba, k.zrusit, k.konec = true, 0, len(chybi), "", zrusit, make(chan struct{})
	konec := k.konec
	k.mu.Unlock()

	go func() {
		defer close(konec)
		err := a.kontrolovatOtoceni(ctx, k, chybi, stred)
		if uerr := a.ulozitOtoceni(k); err == nil {
			err = uerr
		}
		k.mu.Lock()
		k.bezi, k.zrusit = false, nil
		if err != nil && !errors.Is(err, context.Canceled) {
			k.chyba = err.Error()
		}
		k.mu.Unlock()
	}()
	return true
}

func (a *App) kontrolovatOtoceni(ctx context.Context, k *kontrolaOtoceni, ids []string, stred []float32) error {
	m, err := obsah.OtevritModel(a.obsah.Slozka())
	if err != nil {
		return err
	}
	defer m.Zavrit()
	odUlozeni := 0
	for _, id := range ids {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		k.mu.Lock()
		k.hotovo++
		k.mu.Unlock()
		data, err := a.nahledProObsah(ctx, id)
		if err != nil || data == nil {
			continue // bez náhledu se zkusí příště
		}
		img, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			continue
		}
		var vektory [4][]float32
		vektory[0] = a.obsah.Vektor(id)
		for i := 1; i < 4; i++ {
			if vektory[i], err = m.VektorObrazku(obsah.OtocitObrazek(img, obsah.UhlyOtoceni[i])); err != nil {
				return err
			}
		}
		skore := obsah.SkoreOtoceni(vektory, stred)
		k.mu.Lock()
		k.vysledky[id] = [4]float32{float32(skore[0]), float32(skore[1]), float32(skore[2]), float32(skore[3])}
		k.mu.Unlock()
		if odUlozeni++; odUlozeni >= ukladatOtoceniPo {
			odUlozeni = 0
			if err := a.ulozitOtoceni(k); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *App) PrerusitKontroluOtoceni() {
	if a.otoceni == nil {
		return
	}
	k := a.otoceni
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

func (a *App) mnozinaNastaveni(klic string) map[string]bool {
	var seznam []string
	a.nacistJSONNastaveni(klic, &seznam)
	v := map[string]bool{}
	for _, x := range seznam {
		v[x] = true
	}
	return v
}

func (a *App) zmenitMnozinuNastaveni(klic string, polozky []string, pridat bool) bool {
	m := a.mnozinaNastaveni(klic)
	for _, p := range polozky {
		if pridat {
			m[p] = true
		} else {
			delete(m, p)
		}
	}
	seznam := make([]string, 0, len(m))
	for x := range m {
		seznam = append(seznam, x)
	}
	sort.Strings(seznam)
	if len(seznam) == 0 {
		return a.ulozitNastaveni(klic, "") == nil
	}
	a.ulozitJSONNastaveni(klic, seznam)
	return true
}

// Fotky, kterým jiná orientace sedí lépe než současná, od nejjistějších
func (a *App) GetOtoceneFotky() []OtocenaFotka {
	k := a.kontrolyOtoceni()
	k.mu.Lock()
	a.nacistOtoceniZamceno(k)
	vysledky := make(map[string][4]float32, len(k.vysledky))
	for id, s := range k.vysledky {
		vysledky[id] = s
	}
	k.mu.Unlock()
	v := []OtocenaFotka{}
	if len(vysledky) == 0 {
		return v
	}
	vPoradku := a.mnozinaNastaveni(klicOtoceniVPoradku)
	radky, err := a.db.Query(`SELECT f.id, f.drive_file_id, COALESCE(f.rotace, 0), COALESCE(al.modelka_id, 0), al.album,
		COALESCE(m.jmeno, '') FROM fotky f JOIN alba al ON al.id = f.album_id LEFT JOIN modelky m ON m.id = al.modelka_id
		WHERE f.nedostupne_od IS NULL ORDER BY f.id`)
	if err != nil {
		a.chyba("otočené fotky", err)
		return v
	}
	defer radky.Close()
	podleSouboru := map[string]*OtocenaFotka{}
	var poradi []string
	for radky.Next() {
		var id, rotace, modelka int
		var drive, album, jmeno string
		if radky.Scan(&id, &drive, &rotace, &modelka, &album, &jmeno) != nil {
			continue
		}
		skore, ok := vysledky[drive]
		if !ok || vPoradku[drive] {
			continue
		}
		o := podleSouboru[drive]
		if o == nil {
			var s [4]float64
			for i := range skore {
				s[i] = float64(skore[i])
			}
			navrh, rozdil := obsah.NavrhOtoceni(s, rotace)
			if rozdil < prahOtoceni {
				continue
			}
			o = &OtocenaFotka{DriveID: drive, URL: adresaObrazku(drive), Rotace: rotace, Navrh: navrh, Rozdil: rozdil,
				ModelkaID: modelka, Jmeno: jmeno, Album: album}
			podleSouboru[drive] = o
			poradi = append(poradi, drive)
		}
		o.FotkyIDs = append(o.FotkyIDs, id)
	}
	for _, d := range poradi {
		v = append(v, *podleSouboru[d])
	}
	sort.SliceStable(v, func(i, j int) bool { return v[i].Rozdil > v[j].Rozdil })
	return v
}

// Fotka je schválně jinak natočená (nebo návrh nesedí): už se nehlásí; vPoradku = false to vrací
func (a *App) OznacitOtoceniVPoradku(driveIDs []string, vPoradku bool) bool {
	return a.zmenitMnozinuNastaveni(klicOtoceniVPoradku, driveIDs, vPoradku)
}

// ——— Výřez titulní fotky ———

type NavrhVyrezu struct {
	ModelkaID int     `json:"modelkaId"`
	Ok        bool    `json:"ok"`
	Zoom      float64 `json:"zoom"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Duvod     string  `json:"duvod"` // proč návrh není
}

type TitulniBezVyrezu struct {
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	URL       string `json:"url"`
}

// Navrhne výřez titulních fotek modelek (detektor se otevře jednou pro všechny)
func (a *App) NavrhnoutVyrezy(ids []int) []NavrhVyrezu {
	v := make([]NavrhVyrezu, 0, len(ids))
	if !a.obsahZapnuty() {
		for _, id := range ids {
			v = append(v, NavrhVyrezu{ModelkaID: id, Duvod: "Návrh výřezu potřebuje zapnutý Obsah fotek (Nastavení)."})
		}
		return v
	}
	d, err := obsah.OtevritDetektor(a.obsah.Slozka(), obsah.Soubory[2].Nazev)
	if err != nil {
		for _, id := range ids {
			v = append(v, NavrhVyrezu{ModelkaID: id, Duvod: "Detektor se nepodařilo spustit: " + err.Error()})
		}
		return v
	}
	defer d.Zavrit()
	ctx, zrusit := context.WithTimeout(context.Background(), 2*time.Minute)
	defer zrusit()
	for _, id := range ids {
		n := NavrhVyrezu{ModelkaID: id}
		m, ok := a.modelkaPodleIDZeSnimku(id)
		switch {
		case !ok || m.CoverID == "" || a.nahledy == nil:
			n.Duvod = "Modelka nemá titulní fotku."
		default:
			data, err := a.nahledy.Nacist(ctx, m.CoverID, "w400")
			if err != nil {
				n.Duvod = "Náhled titulní fotky se nepodařilo načíst."
				break
			}
			img, _, err := image.Decode(bytes.NewReader(data))
			if err != nil {
				n.Duvod = "Náhled titulní fotky nejde přečíst."
				break
			}
			boxy, err := d.BoxyObrazku(img)
			if err != nil {
				n.Duvod = err.Error()
				break
			}
			b := img.Bounds()
			vyrez, nalezeno := obsah.NavrhVyrezu(boxy, float64(b.Dx())/float64(b.Dy()), pomerKarty)
			if !nalezeno {
				n.Duvod = "Na fotce se nenašla postava."
				break
			}
			n.Ok, n.Zoom, n.X, n.Y = true, vyrez.Zoom, vyrez.X, vyrez.Y
		}
		v = append(v, n)
	}
	return v
}

func (a *App) modelkaPodleIDZeSnimku(id int) (Modelka, bool) {
	for _, m := range a.snimekSbirky().modelky {
		if m.ID == id {
			return m, true
		}
	}
	return Modelka{}, false
}

func vychoziVyrez(m *Modelka) bool {
	return (m.CoverZoom == 0 || m.CoverZoom == 1) && (m.CoverX == 0 || m.CoverX == 50) && (m.CoverY == 0 || m.CoverY == 50)
}

// Modelky s titulní fotkou a výchozím výřezem (kromě těch, kterým výchozí výřez vyhovuje)
func (a *App) GetTitulniBezVyrezu() []TitulniBezVyrezu {
	ok := a.mnozinaNastaveni(klicVyrezVychozi)
	v := []TitulniBezVyrezu{}
	for _, m := range a.snimekSbirky().modelky {
		if m.CoverID != "" && vychoziVyrez(&m) && !ok[strconv.Itoa(m.ID)] {
			v = append(v, TitulniBezVyrezu{ModelkaID: m.ID, Jmeno: m.Jmeno, URL: m.CoverURL})
		}
	}
	sort.SliceStable(v, func(i, j int) bool { return strings.ToLower(v[i].Jmeno) < strings.ToLower(v[j].Jmeno) })
	return v
}

// Výchozí výřez je u modelek v pořádku: úkol se už nehlásí (vychozi = false to vrací)
func (a *App) OznacitVyrezVychozi(ids []int, vychozi bool) bool {
	klice := make([]string, len(ids))
	for i, id := range ids {
		klice[i] = strconv.Itoa(id)
	}
	return a.zmenitMnozinuNastaveni(klicVyrezVychozi, klice, vychozi)
}
