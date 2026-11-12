package main

// Záloha na Google Disk (0.02.076): denní záloha (zalohy.go) se po vytvoření nahraje do skryté složky programu na
// Disku (appDataFolder, rozsah drive.appdata – v Disku ji uživatel nevidí a jiné programy k ní nemají přístup).
// Na Disku zůstává posledních pocetZalohNaDisku denních záloh. Obnova: záloha z Disku se stáhne mezi místní zálohy
// a obnoví se obvyklou cestou (ObnovitZalohu, s porovnáním rozdílů) – tak jde obnovit i čistý program po
// přihlášení. Bez přihlášení se nic nenahrává.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"pinup-katalog/internal/google"
)

const pocetZalohNaDisku = 7

// Adresa Drive API (v testech místní server)
var adresaDriveAPI = "https://www.googleapis.com"

var zamekDisku sync.Mutex

// Platný přístupový token: obnoví ho, když vyprší za méně než minutu
func (a *App) pristupGoogle(ctx context.Context) (string, error) {
	t := nacistTokenGoogle()
	if t == nil {
		return "", errors.New("nejsi přihlášený ke Googlu")
	}
	if t.Pristupovy != "" && time.Until(t.Platnost) > time.Minute {
		return t.Pristupovy, nil
	}
	switch v, pristup := a.obnovitPristupGoogle(ctx, t); v {
	case overenoGoogle:
		return pristup, nil
	case odvolanoGoogle:
		return "", errors.New("Google přístup odvolal – přihlas se znovu")
	default:
		return "", errors.New("Google není dostupný")
	}
}

// Volání Drive API s přístupovým tokenem; chyba s textem odpovědi
func (a *App) driveVolani(ctx context.Context, metoda, adresa string, telo io.Reader, hlavicky map[string]string) (*http.Response, error) {
	pristup, err := a.pristupGoogle(ctx)
	if err != nil {
		return nil, err
	}
	return google.VolatDisk(ctx, pristup, metoda, adresa, telo, hlavicky)
}

// ZalohaNaDisku: soubor zálohy ve skryté složce programu na Disku
type ZalohaNaDisku struct {
	ID       string `json:"id"`
	Nazev    string `json:"nazev"`
	Cas      string `json:"cas"` // RRRR-MM-DD HH:MM:SS z názvu zálohy
	Velikost int64  `json:"velikost"`
	Mistni   bool   `json:"mistni"` // stejná záloha je i mezi místními
}

type ZalohyNaDisku struct {
	Prihlasen bool            `json:"prihlasen"`
	Zalohy    []ZalohaNaDisku `json:"zalohy"`
	Chyba     string          `json:"chyba"`
}

// Soubor ve skryté složce programu na Disku
type souborNaDisku struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Size string `json:"size"`
}

func (a *App) souboryNaDisku(ctx context.Context) ([]souborNaDisku, error) {
	q := url.Values{"spaces": {"appDataFolder"}, "fields": {"files(id,name,size)"}, "pageSize": {"200"}}
	o, err := a.driveVolani(ctx, http.MethodGet, adresaDriveAPI+"/drive/v3/files?"+q.Encode(), nil, nil)
	if err != nil {
		return nil, err
	}
	defer o.Body.Close()
	var odpoved struct {
		Files []souborNaDisku `json:"files"`
	}
	if err := json.NewDecoder(o.Body).Decode(&odpoved); err != nil {
		return nil, err
	}
	return odpoved.Files, nil
}

func (a *App) seznamNaDisku(ctx context.Context) ([]ZalohaNaDisku, error) {
	soubory, err := a.souboryNaDisku(ctx)
	if err != nil {
		return nil, err
	}
	v := []ZalohaNaDisku{}
	for _, f := range soubory {
		if !vzorZalohy.MatchString(f.Name) {
			continue
		}
		z := ZalohaNaDisku{ID: f.ID, Nazev: f.Name}
		z.Velikost, _ = strconv.ParseInt(f.Size, 10, 64)
		if cas, err := time.Parse("2006-01-02-150405", klicZalohy(f.Name)[:17]); err == nil {
			z.Cas = cas.Format("2006-01-02 15:04:05")
		}
		if _, err := os.Stat(filepath.Join(slozkaZaloh(), f.Name)); err == nil {
			z.Mistni = true
		}
		v = append(v, z)
	}
	// Od nejnovější (název začíná datem a časem)
	sort.Slice(v, func(i, j int) bool { return klicZalohy(v[i].Nazev) > klicZalohy(v[j].Nazev) })
	return v, nil
}

// GetZalohyNaDisku: zálohy ve skryté složce programu na Disku (bez přihlášení prázdné)
func (a *App) GetZalohyNaDisku() ZalohyNaDisku {
	v := ZalohyNaDisku{Zalohy: []ZalohaNaDisku{}}
	if nacistTokenGoogle() == nil {
		return v
	}
	v.Prihlasen = true
	ctx, zrusit := context.WithTimeout(context.Background(), 30*time.Second)
	defer zrusit()
	zalohy, err := a.seznamNaDisku(ctx)
	if err != nil {
		v.Chyba = err.Error()
		return v
	}
	v.Zalohy = zalohy
	return v
}

// Nahraje místní zálohu (název ze složky záloh) na Disk a uklidí staré denní zálohy tam
func (a *App) nahratZalohu(ctx context.Context, nazev string) error {
	zamekDisku.Lock()
	defer zamekDisku.Unlock()
	cesta := filepath.Join(slozkaZaloh(), nazev)
	info, err := os.Stat(cesta)
	if err != nil {
		return err
	}
	stavajici, err := a.seznamNaDisku(ctx)
	if err != nil {
		return err
	}
	for _, z := range stavajici {
		if z.Nazev == nazev {
			return a.uklidNaDisku(ctx, stavajici)
		}
	}
	soubor, err := os.Open(cesta)
	if err != nil {
		return err
	}
	defer soubor.Close()
	if err := a.nahratNaDisk(ctx, nazev, "application/x-sqlite3", soubor, info.Size()); err != nil {
		return err
	}
	nove, err := a.seznamNaDisku(ctx)
	if err != nil {
		return err
	}
	return a.uklidNaDisku(ctx, nove)
}

// Nahraje soubor do skryté složky programu na Disku: obnovitelné nahrání – metadata, pak celý obsah jedním PUT
func (a *App) nahratNaDisk(ctx context.Context, nazev, typ string, obsah io.Reader, velikost int64) error {
	meta, _ := json.Marshal(map[string]any{"name": nazev, "parents": []string{"appDataFolder"}})
	o, err := a.driveVolani(ctx, http.MethodPost, adresaDriveAPI+"/upload/drive/v3/files?uploadType=resumable", strings.NewReader(string(meta)),
		map[string]string{"Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": typ,
			"X-Upload-Content-Length": strconv.FormatInt(velikost, 10)})
	if err != nil {
		return err
	}
	o.Body.Close()
	kam := o.Header.Get("Location")
	if kam == "" {
		return errors.New("Disk nevrátil adresu nahrání")
	}
	o, err = a.driveVolani(ctx, http.MethodPut, kam, obsah, map[string]string{"Content-Type": typ,
		"Content-Length": strconv.FormatInt(velikost, 10)})
	if err != nil {
		return err
	}
	o.Body.Close()
	return nil
}

// Na Disku zůstane posledních pocetZalohNaDisku denních záloh (ostatní důvody se nenahrávají)
func (a *App) uklidNaDisku(ctx context.Context, zalohy []ZalohaNaDisku) error {
	denni := 0
	for _, z := range zalohy {
		casti := vzorZalohy.FindStringSubmatch(z.Nazev)
		if casti == nil || casti[2] != duvodDenni {
			continue
		}
		if denni++; denni <= pocetZalohNaDisku {
			continue
		}
		o, err := a.driveVolani(ctx, http.MethodDelete, adresaDriveAPI+"/drive/v3/files/"+url.PathEscape(z.ID), nil, nil)
		if err != nil {
			return err
		}
		o.Body.Close()
	}
	return nil
}

// Nejnovější místní denní záloha (název) nebo ""
func nejnovejsiDenniZaloha() string {
	soubory := souboryZaloh("*-" + duvodDenni + ".db")
	if len(soubory) == 0 {
		return ""
	}
	return filepath.Base(soubory[0])
}

// Po denní záloze na pozadí: nahrát ji na Disk, je-li uživatel přihlášený (chyba jen do záznamu)
func (a *App) zalohaNaDiskNaPozadi() {
	if nacistTokenGoogle() == nil {
		return
	}
	nazev := nejnovejsiDenniZaloha()
	if nazev == "" {
		return
	}
	ctx, zrusit := context.WithTimeout(context.Background(), 10*time.Minute)
	defer zrusit()
	if err := a.nahratZalohu(ctx, nazev); err != nil {
		a.chyba("záloha na Google Disk", err)
		return
	}
	// Po záloze i balíček pro telefon (balicek_telefonu.go)
	if err := a.nahratBalicekTelefonu(ctx); err != nil {
		a.chyba("balíček pro telefon na Google Disk", err)
	}
}

// NahratZalohuNaDisk (tlačítko v okně záloh): nahraje nejnovější denní zálohu hned (dnes žádná → vytvoří ji);
// "" = hotovo, jinak zpráva
func (a *App) NahratZalohuNaDisk() string {
	if nacistTokenGoogle() == nil {
		return "Nejsi přihlášený ke Googlu."
	}
	a.denniZaloha()
	nazev := nejnovejsiDenniZaloha()
	if nazev == "" {
		return "Žádná záloha k nahrání (prázdná sbírka?)."
	}
	ctx, zrusit := context.WithTimeout(context.Background(), 10*time.Minute)
	defer zrusit()
	if err := a.nahratZalohu(ctx, nazev); err != nil {
		return "Zálohu se nepodařilo nahrát: " + err.Error()
	}
	if err := a.nahratBalicekTelefonu(ctx); err != nil {
		return "Záloha je na Disku, balíček pro telefon se nepodařilo nahrát: " + err.Error()
	}
	return ""
}

// StahnoutZalohuZDisku stáhne zálohu z Disku mezi místní zálohy (pak jde obnovit jako každá jiná);
// vrací název místního souboru, nebo chybu
func (a *App) StahnoutZalohuZDisku(id string) (string, error) {
	ctx, zrusit := context.WithTimeout(context.Background(), 10*time.Minute)
	defer zrusit()
	zalohy, err := a.seznamNaDisku(ctx)
	if err != nil {
		return "", err
	}
	var z *ZalohaNaDisku
	for i := range zalohy {
		if zalohy[i].ID == id {
			z = &zalohy[i]
		}
	}
	// Jen soubor se jménem zálohy (název se použije jako cesta)
	if z == nil || z.Nazev != filepath.Base(z.Nazev) || !vzorZalohy.MatchString(z.Nazev) {
		return "", errors.New("záloha na Disku nenalezena")
	}
	cil := filepath.Join(slozkaZaloh(), z.Nazev)
	if _, err := os.Stat(cil); err == nil {
		return z.Nazev, nil
	}
	o, err := a.driveVolani(ctx, http.MethodGet, adresaDriveAPI+"/drive/v3/files/"+url.PathEscape(id)+"?alt=media", nil, nil)
	if err != nil {
		return "", err
	}
	defer o.Body.Close()
	if err := os.MkdirAll(slozkaZaloh(), 0o700); err != nil {
		return "", err
	}
	docasny := cil + ".tmp"
	f, err := os.OpenFile(docasny, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, o.Body); err != nil {
		f.Close()
		os.Remove(docasny)
		return "", err
	}
	if err := f.Close(); err != nil {
		os.Remove(docasny)
		return "", err
	}
	// Ověření, že jde o čitelnou databázi, než se objeví mezi zálohami
	if db, err := otevritZalohu(docasny); err == nil {
		stav := kontrolaSouboru(db)
		db.Close()
		if stav != "" {
			os.Remove(docasny)
			return "", fmt.Errorf("stažená záloha je poškozená (%s)", stav)
		}
	}
	return z.Nazev, os.Rename(docasny, cil)
}
