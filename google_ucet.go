package main

// Přihlášení Google (0.02.074, blok Mobil a Google Disk): OAuth 2.0 pro desktopové programy – systémový prohlížeč,
// návrat na http://127.0.0.1:<port> (zpětná smyčka) a PKCE. Rozsahy drive.file (jen soubory, které program sám
// vytvoří – zálohy) a drive.appdata (skrytá složka programu na Disku) nepotřebují ověření aplikace Googlem; k fotkám
// sbírky na Disku přístup nedávají. openid email profile jen pro jméno a e-mail v okně účtu.
//
// Přihlašovací údaje programu (OAuth klient typu „Desktop app“ z Google Cloud Console) si uživatel uloží jako
// ~/.config/pinup-katalog/google-klient.json (soubor stažený z Console); bez něj se přihlásit nedá. Token (obnovovací)
// je v téže složce v google-token.json s právy 0600.
//
// Vstup do programu (0.02.075): s přihlašovacími údaji programu je přihlášení bránou – bez něj se sbírka neotevře.
// Přihlášení si program pamatuje (jako jiné aplikace); brána se ukáže po odhlášení nebo když Google přístup odvolá
// (OveritUcetGoogle při startu). Bez připojení zapamatované přihlášení platí dál. Bez přihlašovacích údajů programu
// brána není (přihlásit se nejde a sbírka nesmí zůstat zamčená).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pinup-katalog/internal/google"
)

const rozsahyGoogle = "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata"

// Adresy Googlu (v testech místní server)
var (
	adresaAutorizaceGoogle = "https://accounts.google.com/o/oauth2/v2/auth"
	adresaTokenuGoogle     = "https://oauth2.googleapis.com/token"
	adresaOdvolaniGoogle   = "https://oauth2.googleapis.com/revoke"
	casNaPrihlaseni        = 5 * time.Minute
)

// Otevření adresy v systémovém prohlížeči (v testech náhrada, která „přihlášení“ rovnou dokončí)
var otevritProhlizec = func(a *App, adresa string) {
	if a.ctx != nil {
		runtime.BrowserOpenURL(a.ctx, adresa)
	}
}

// Složka nastavení programu (~/.config/pinup-katalog); v testech jiná
var slozkaNastaveniGoogle = func() string {
	zaklad, err := os.UserConfigDir()
	if err != nil {
		domov, _ := os.UserHomeDir()
		zaklad = filepath.Join(domov, ".config")
	}
	return filepath.Join(zaklad, slozkaProgramu)
}

type klientGoogle = google.Klient

// Adresy Googlu pro společný balíček (proměnné výše, v testech místní server)
func adresyGoogle() google.Adresy {
	return google.Adresy{Autorizace: adresaAutorizaceGoogle, Token: adresaTokenuGoogle, Odvolani: adresaOdvolaniGoogle, API: adresaDriveAPI}
}

type tokenGoogle struct {
	Obnovovaci string    `json:"refresh_token"`
	Pristupovy string    `json:"access_token"`
	Platnost   time.Time `json:"expiry"`
	Rozsahy    string    `json:"scope"`
	Email      string    `json:"email"`
	Jmeno      string    `json:"jmeno"`
	Prihlaseno string    `json:"prihlaseno"`
}

// UcetGoogle: stav přihlášení pro okno účtu a Nastavení
type UcetGoogle struct {
	Nastaveno     bool   `json:"nastaveno"` // program má přihlašovací údaje (google-klient.json)
	Prihlasen     bool   `json:"prihlasen"`
	Email         string `json:"email"`
	Jmeno         string `json:"jmeno"`
	Prihlaseno    string `json:"prihlaseno"`    // kdy (RRRR-MM-DD HH:MM:SS)
	CestaKlienta  string `json:"cestaKlienta"`  // kam uložit přihlašovací údaje
	SlozkaKlienta string `json:"slozkaKlienta"` // jejich složka (tlačítko Otevřít složku)
	Probiha       bool   `json:"probiha"`       // čeká se na návrat z prohlížeče
}

var stavGoogle struct {
	sync.Mutex
	zrusit context.CancelFunc
}

func cestaKlientaGoogle() string { return filepath.Join(slozkaNastaveniGoogle(), "google-klient.json") }
func cestaTokenuGoogle() string  { return filepath.Join(slozkaNastaveniGoogle(), "google-token.json") }

// Přihlašovací údaje programu: soubor z Console ({"installed": {...}}) nebo rovnou {client_id, client_secret}
func nacistKlientaGoogle() (klientGoogle, error) {
	data, err := os.ReadFile(cestaKlientaGoogle())
	if err != nil {
		return klientGoogle{}, err
	}
	k, err := google.KlientZJSON(data)
	if err != nil {
		return klientGoogle{}, fmt.Errorf("soubor %s: %w", cestaKlientaGoogle(), err)
	}
	return k, nil
}

func nacistTokenGoogle() *tokenGoogle {
	data, err := os.ReadFile(cestaTokenuGoogle())
	if err != nil {
		return nil
	}
	var t tokenGoogle
	if json.Unmarshal(data, &t) != nil || t.Obnovovaci == "" {
		return nil
	}
	return &t
}

func ulozitTokenGoogle(t *tokenGoogle) error {
	if err := os.MkdirAll(slozkaNastaveniGoogle(), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		return err
	}
	docasny := cestaTokenuGoogle() + ".tmp"
	if err := os.WriteFile(docasny, data, 0o600); err != nil {
		return err
	}
	return os.Rename(docasny, cestaTokenuGoogle())
}

func (a *App) GetUcetGoogle() UcetGoogle {
	u := UcetGoogle{CestaKlienta: cestaKlientaGoogle(), SlozkaKlienta: slozkaNastaveniGoogle()}
	_, err := nacistKlientaGoogle()
	u.Nastaveno = err == nil
	if t := nacistTokenGoogle(); t != nil {
		u.Prihlasen, u.Email, u.Jmeno, u.Prihlaseno = true, t.Email, t.Jmeno, t.Prihlaseno
	}
	stavGoogle.Lock()
	u.Probiha = stavGoogle.zrusit != nil
	stavGoogle.Unlock()
	return u
}

// PrihlasitGoogle otevře přihlášení v prohlížeči a počká na návrat (nejvýš casNaPrihlaseni); "" = přihlášeno,
// jinak česká zpráva pro uživatele
func (a *App) PrihlasitGoogle() string {
	klient, err := nacistKlientaGoogle()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "Program zatím nemá přihlašovací údaje Googlu (soubor " + cestaKlientaGoogle() + ")."
		}
		return err.Error()
	}
	ctx, zrusit := context.WithTimeout(context.Background(), casNaPrihlaseni)
	defer zrusit()
	stavGoogle.Lock()
	if stavGoogle.zrusit != nil {
		stavGoogle.zrusit() // předchozí nedokončené přihlášení
	}
	stavGoogle.zrusit = zrusit
	stavGoogle.Unlock()
	defer func() {
		stavGoogle.Lock()
		stavGoogle.zrusit = nil
		stavGoogle.Unlock()
	}()

	posluchac, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "Nepodařilo se připravit návrat z prohlížeče: " + err.Error()
	}
	prihlaseni := google.NovePrihlaseni(adresyGoogle(), klient, fmt.Sprintf("http://127.0.0.1:%d", posluchac.Addr().(*net.TCPAddr).Port), rozsahyGoogle)

	type vysledekNavratu struct{ kod, chyba string }
	navraty := make(chan vysledekNavratu, 1)
	server := &http.Server{ReadHeaderTimeout: 10 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		var v vysledekNavratu
		v.kod, v.chyba = prihlaseni.KodZNavratu(r.URL.Query())
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, google.StrankaNavratu(v.chyba, ""))
		select {
		case navraty <- v:
		default:
		}
	})}
	go server.Serve(posluchac)
	defer server.Close()

	otevritProhlizec(a, prihlaseni.Adresa)

	var v vysledekNavratu
	select {
	case v = <-navraty:
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return "Přihlášení nebylo dokončeno do 5 minut."
		}
		return "Přihlášení bylo zrušeno."
	}
	if v.chyba != "" {
		return v.chyba
	}
	g, err := google.VymenitKod(ctx, adresyGoogle(), klient, prihlaseni, v.kod)
	if err != nil {
		return "Přihlášení se nepodařilo dokončit: " + err.Error()
	}
	t := &tokenGoogle{Obnovovaci: g.Obnovovaci, Pristupovy: g.Pristupovy, Platnost: g.Platnost, Rozsahy: g.Rozsahy,
		Email: g.Email, Jmeno: g.Jmeno, Prihlaseno: ted()}
	if err := ulozitTokenGoogle(t); err != nil {
		return "Přihlášení se nepodařilo uložit: " + err.Error()
	}
	return ""
}

// ZrusitPrihlaseniGoogle ukončí čekání na návrat z prohlížeče (uživatel si to rozmyslel)
func (a *App) ZrusitPrihlaseniGoogle() {
	stavGoogle.Lock()
	defer stavGoogle.Unlock()
	if stavGoogle.zrusit != nil {
		stavGoogle.zrusit()
	}
}

// OdhlasitGoogle smaže token a požádá Google o jeho odvolání (bez připojení stačí smazání)
func (a *App) OdhlasitGoogle() bool {
	t := nacistTokenGoogle()
	if err := os.Remove(cestaTokenuGoogle()); err != nil && !errors.Is(err, os.ErrNotExist) {
		a.chyba("odhlášení Google", err)
		return false
	}
	if t != nil {
		go func() {
			ctx, zrusit := context.WithTimeout(context.Background(), 10*time.Second)
			defer zrusit()
			google.Odvolat(ctx, adresyGoogle(), t.Obnovovaci)
		}()
	}
	return true
}

// Výsledek ověření zapamatovaného přihlášení
const (
	overenoGoogle     = "ok"       // přístupový token obnoven
	odvolanoGoogle    = "odvolano" // Google přístup odvolal nebo token vypršel – token smazán, brána se zavře
	bezSpojeniGoogle  = "offline"  // Google nedostupný – zapamatované přihlášení platí dál
	neprihlasenGoogle = "neprihlasen"
)

// OveritUcetGoogle (při startu na pozadí): obnoví přístupový token; když ho Google odmítne (invalid_grant), token
// smaže, aby se brána znovu zavřela
func (a *App) OveritUcetGoogle() string {
	t := nacistTokenGoogle()
	if t == nil {
		return neprihlasenGoogle
	}
	ctx, zrusit := context.WithTimeout(context.Background(), 20*time.Second)
	defer zrusit()
	v, _ := a.obnovitPristupGoogle(ctx, t)
	return v
}

// Nový přístupový token z obnovovacího (výsledek overenoGoogle / odvolanoGoogle / bezSpojeniGoogle); odvolaný
// přístup token smaže
func (a *App) obnovitPristupGoogle(ctx context.Context, t *tokenGoogle) (string, string) {
	klient, err := nacistKlientaGoogle()
	if err != nil {
		return bezSpojeniGoogle, ""
	}
	pristup, platnost, err := google.Obnovit(ctx, adresyGoogle(), klient, t.Obnovovaci)
	if errors.Is(err, google.ErrOdvolano) {
		os.Remove(cestaTokenuGoogle())
		return odvolanoGoogle, ""
	}
	if err != nil {
		return bezSpojeniGoogle, ""
	}
	t.Pristupovy, t.Platnost = pristup, platnost
	if err := ulozitTokenGoogle(t); err != nil {
		a.chyba("uložení přístupu Google", err)
	}
	return overenoGoogle, t.Pristupovy
}
