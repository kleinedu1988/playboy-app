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
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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

type klientGoogle struct {
	ID     string `json:"client_id"`
	Secret string `json:"client_secret"`
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
	var obal struct {
		Installed *klientGoogle `json:"installed"`
		Web       *klientGoogle `json:"web"`
		klientGoogle
	}
	if err := json.Unmarshal(data, &obal); err != nil {
		return klientGoogle{}, fmt.Errorf("soubor %s není platný JSON: %w", cestaKlientaGoogle(), err)
	}
	k := obal.klientGoogle
	if obal.Installed != nil {
		k = *obal.Installed
	} else if obal.Web != nil {
		k = *obal.Web
	}
	if k.ID == "" {
		return klientGoogle{}, fmt.Errorf("v souboru %s chybí client_id", cestaKlientaGoogle())
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

// Náhodný řetězec pro PKCE a state (base64url bez doplnění)
func nahodnyRetezec(bajtu int) string {
	b := make([]byte, bajtu)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
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
	navrat := fmt.Sprintf("http://127.0.0.1:%d", posluchac.Addr().(*net.TCPAddr).Port)
	overovac := nahodnyRetezec(48)
	vyzva := sha256.Sum256([]byte(overovac))
	stavDotazu := nahodnyRetezec(24)

	type vysledekNavratu struct{ kod, chyba string }
	navraty := make(chan vysledekNavratu, 1)
	server := &http.Server{ReadHeaderTimeout: 10 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		v := vysledekNavratu{kod: q.Get("code")}
		switch {
		case q.Get("state") != stavDotazu:
			v = vysledekNavratu{chyba: "Návrat z prohlížeče nepatří k tomuto přihlášení."}
		case q.Get("error") == "access_denied":
			v = vysledekNavratu{chyba: "Přihlášení bylo v prohlížeči zrušeno."}
		case q.Get("error") != "":
			v = vysledekNavratu{chyba: "Google přihlášení odmítl: " + q.Get("error")}
		case v.kod == "":
			v = vysledekNavratu{chyba: "Google nevrátil kód přihlášení."}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, strankaNavratu(v.chyba))
		select {
		case navraty <- v:
		default:
		}
	})}
	go server.Serve(posluchac)
	defer server.Close()

	parametry := url.Values{
		"client_id":             {klient.ID},
		"redirect_uri":          {navrat},
		"response_type":         {"code"},
		"scope":                 {rozsahyGoogle},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(vyzva[:])},
		"code_challenge_method": {"S256"},
		"state":                 {stavDotazu},
		"access_type":           {"offline"},
		"prompt":                {"consent"},
	}
	otevritProhlizec(a, adresaAutorizaceGoogle+"?"+parametry.Encode())

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
	t, err := vymenitKodGoogle(ctx, klient, v.kod, overovac, navrat)
	if err != nil {
		return "Přihlášení se nepodařilo dokončit: " + err.Error()
	}
	if err := ulozitTokenGoogle(t); err != nil {
		return "Přihlášení se nepodařilo uložit: " + err.Error()
	}
	return ""
}

// Výměna kódu za tokeny; jméno a e-mail z id_token (přišel přímo z Googlu přes TLS, podpis se neověřuje)
func vymenitKodGoogle(ctx context.Context, k klientGoogle, kod, overovac, navrat string) (*tokenGoogle, error) {
	form := url.Values{
		"code":          {kod},
		"client_id":     {k.ID},
		"client_secret": {k.Secret},
		"redirect_uri":  {navrat},
		"grant_type":    {"authorization_code"},
		"code_verifier": {overovac},
	}
	pozadavek, err := http.NewRequestWithContext(ctx, http.MethodPost, adresaTokenuGoogle, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	pozadavek.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	odpoved, err := http.DefaultClient.Do(pozadavek)
	if err != nil {
		return nil, err
	}
	defer odpoved.Body.Close()
	var o struct {
		Pristupovy string `json:"access_token"`
		Obnovovaci string `json:"refresh_token"`
		Platnost   int    `json:"expires_in"`
		Rozsahy    string `json:"scope"`
		IDToken    string `json:"id_token"`
		Chyba      string `json:"error"`
		Popis      string `json:"error_description"`
	}
	if err := json.NewDecoder(odpoved.Body).Decode(&o); err != nil {
		return nil, fmt.Errorf("nečitelná odpověď Googlu (HTTP %d)", odpoved.StatusCode)
	}
	if o.Chyba != "" || odpoved.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s %s", o.Chyba, o.Popis)
	}
	if o.Obnovovaci == "" {
		return nil, errors.New("Google nevrátil obnovovací token")
	}
	t := &tokenGoogle{Obnovovaci: o.Obnovovaci, Pristupovy: o.Pristupovy, Rozsahy: o.Rozsahy,
		Platnost: time.Now().Add(time.Duration(o.Platnost) * time.Second), Prihlaseno: ted()}
	if casti := strings.Split(o.IDToken, "."); len(casti) == 3 {
		if data, err := base64.RawURLEncoding.DecodeString(casti[1]); err == nil {
			var id struct {
				Email string `json:"email"`
				Jmeno string `json:"name"`
			}
			if json.Unmarshal(data, &id) == nil {
				t.Email, t.Jmeno = id.Email, id.Jmeno
			}
		}
	}
	return t, nil
}

// Stránka v prohlížeči po návratu (prohlížeč pak uživatel zavře)
func strankaNavratu(chyba string) string {
	nadpis, text := "Přihlášení hotovo", "Můžeš zavřít tuto kartu a vrátit se do Pinup Katalogu."
	if chyba != "" {
		nadpis, text = "Přihlášení se nepovedlo", chyba+" Vrať se do Pinup Katalogu a zkus to znovu."
	}
	return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Pinup Katalog</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#4a0d1f,#0d0d10 60%);
color:#f3eee8;font:16px/1.5 system-ui,sans-serif}main{text-align:center;padding:2rem}h1{font-weight:300;letter-spacing:.08em;
text-transform:uppercase;color:#f0c75e}</style></head><body><main><h1>` + html.EscapeString(nadpis) + `</h1><p>` +
		html.EscapeString(text) + `</p></main></body></html>`
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
			p, err := http.NewRequestWithContext(ctx, http.MethodPost, adresaOdvolaniGoogle,
				strings.NewReader(url.Values{"token": {t.Obnovovaci}}.Encode()))
			if err != nil {
				return
			}
			p.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			if o, err := http.DefaultClient.Do(p); err == nil {
				o.Body.Close()
			}
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
	form := url.Values{"client_id": {klient.ID}, "client_secret": {klient.Secret}, "refresh_token": {t.Obnovovaci}, "grant_type": {"refresh_token"}}
	p, err := http.NewRequestWithContext(ctx, http.MethodPost, adresaTokenuGoogle, strings.NewReader(form.Encode()))
	if err != nil {
		return bezSpojeniGoogle, ""
	}
	p.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	odpoved, err := http.DefaultClient.Do(p)
	if err != nil {
		return bezSpojeniGoogle, ""
	}
	defer odpoved.Body.Close()
	var o struct {
		Pristupovy string `json:"access_token"`
		Platnost   int    `json:"expires_in"`
		Chyba      string `json:"error"`
	}
	json.NewDecoder(odpoved.Body).Decode(&o)
	if o.Chyba == "invalid_grant" || o.Chyba == "unauthorized_client" {
		os.Remove(cestaTokenuGoogle())
		return odvolanoGoogle, ""
	}
	if o.Pristupovy == "" {
		return bezSpojeniGoogle, ""
	}
	t.Pristupovy, t.Platnost = o.Pristupovy, time.Now().Add(time.Duration(o.Platnost)*time.Second)
	if err := ulozitTokenGoogle(t); err != nil {
		a.chyba("uložení přístupu Google", err)
	}
	return overenoGoogle, t.Pristupovy
}
