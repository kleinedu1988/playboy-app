// Package google: přihlášení Google a volání Disku společné pro program na PC a aplikaci v telefonu (0.02.085).
// OAuth 2.0 pro instalované programy: systémový prohlížeč, návrat na http://127.0.0.1:<port> (zpětná smyčka)
// a PKCE; klient typu „Počítačová aplikace“ z Google Cloud Console. Balíček nic neukládá a nemá globální stav –
// adresy Googlu dostává volající (v testech místní server), tokeny si ukládá sám.
package google

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Adresy Googlu
type Adresy struct {
	Autorizace string
	Token      string
	Odvolani   string
	API        string // Drive API (https://www.googleapis.com)
}

var Vychozi = Adresy{
	Autorizace: "https://accounts.google.com/o/oauth2/v2/auth",
	Token:      "https://oauth2.googleapis.com/token",
	Odvolani:   "https://oauth2.googleapis.com/revoke",
	API:        "https://www.googleapis.com",
}

// Přihlašovací údaje programu (OAuth klient)
type Klient struct {
	ID     string `json:"client_id"`
	Secret string `json:"client_secret"`
}

// KlientZJSON: soubor stažený z Console ({"installed": {...}}) nebo rovnou {client_id, client_secret}
func KlientZJSON(data []byte) (Klient, error) {
	var obal struct {
		Installed *Klient `json:"installed"`
		Web       *Klient `json:"web"`
		Klient
	}
	if err := json.Unmarshal(data, &obal); err != nil {
		return Klient{}, fmt.Errorf("není platný JSON: %w", err)
	}
	k := obal.Klient
	if obal.Installed != nil {
		k = *obal.Installed
	} else if obal.Web != nil {
		k = *obal.Web
	}
	if k.ID == "" {
		return Klient{}, errors.New("chybí client_id")
	}
	return k, nil
}

// Tokeny po přihlášení; jméno a e-mail z id_token
type Tokeny struct {
	Obnovovaci string
	Pristupovy string
	Platnost   time.Time
	Rozsahy    string
	Email      string
	Jmeno      string
}

// NahodnyRetezec pro PKCE a state (base64url bez doplnění)
func NahodnyRetezec(bajtu int) string {
	b := make([]byte, bajtu)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Prihlaseni: jedno přihlášení v prohlížeči (adresa, kterou otevřít, a čím ověřit návrat)
type Prihlaseni struct {
	Adresa   string // otevřít v prohlížeči
	Navrat   string // http://127.0.0.1:<port>
	Overovac string // PKCE
	Stav     string
}

// NovePrihlaseni připraví adresu přihlášení s PKCE pro návrat na danou adresu zpětné smyčky
func NovePrihlaseni(a Adresy, k Klient, navrat, rozsahy string) Prihlaseni {
	p := Prihlaseni{Navrat: navrat, Overovac: NahodnyRetezec(48), Stav: NahodnyRetezec(24)}
	vyzva := sha256.Sum256([]byte(p.Overovac))
	p.Adresa = a.Autorizace + "?" + url.Values{
		"client_id":             {k.ID},
		"redirect_uri":          {navrat},
		"response_type":         {"code"},
		"scope":                 {rozsahy},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(vyzva[:])},
		"code_challenge_method": {"S256"},
		"state":                 {p.Stav},
		"access_type":           {"offline"},
		"prompt":                {"consent"},
	}.Encode()
	return p
}

// KodZNavratu: kód z dotazu návratu, nebo česká chyba pro uživatele
func (p Prihlaseni) KodZNavratu(q url.Values) (kod, chyba string) {
	switch {
	case q.Get("state") != p.Stav:
		return "", "Návrat z prohlížeče nepatří k tomuto přihlášení."
	case q.Get("error") == "access_denied":
		return "", "Přihlášení bylo v prohlížeči zrušeno."
	case q.Get("error") != "":
		return "", "Google přihlášení odmítl: " + q.Get("error")
	case q.Get("code") == "":
		return "", "Google nevrátil kód přihlášení."
	}
	return q.Get("code"), ""
}

// VymenitKod: kód z návratu za tokeny (id_token přišel přímo z Googlu přes TLS, podpis se neověřuje)
func VymenitKod(ctx context.Context, a Adresy, k Klient, p Prihlaseni, kod string) (*Tokeny, error) {
	var o struct {
		Pristupovy string `json:"access_token"`
		Obnovovaci string `json:"refresh_token"`
		Platnost   int    `json:"expires_in"`
		Rozsahy    string `json:"scope"`
		IDToken    string `json:"id_token"`
		Chyba      string `json:"error"`
		Popis      string `json:"error_description"`
	}
	kodHTTP, err := postToken(ctx, a, url.Values{"code": {kod}, "client_id": {k.ID}, "client_secret": {k.Secret},
		"redirect_uri": {p.Navrat}, "grant_type": {"authorization_code"}, "code_verifier": {p.Overovac}}, &o)
	if err != nil {
		return nil, err
	}
	if o.Chyba != "" || kodHTTP != http.StatusOK {
		return nil, fmt.Errorf("%s %s", o.Chyba, o.Popis)
	}
	if o.Obnovovaci == "" {
		return nil, errors.New("Google nevrátil obnovovací token")
	}
	t := &Tokeny{Obnovovaci: o.Obnovovaci, Pristupovy: o.Pristupovy, Rozsahy: o.Rozsahy,
		Platnost: time.Now().Add(time.Duration(o.Platnost) * time.Second)}
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

// ErrOdvolano: Google obnovovací token odmítl (přístup odvolán nebo vypršel) – přihlásit znovu
var ErrOdvolano = errors.New("Google přístup odvolal – přihlas se znovu")

// ErrBezSpojeni: Google nedostupný nebo odpověď bez tokenu – zapamatované přihlášení platí dál
var ErrBezSpojeni = errors.New("Google není dostupný")

// Obnovit: nový přístupový token z obnovovacího; chyba ErrOdvolano nebo ErrBezSpojeni
func Obnovit(ctx context.Context, a Adresy, k Klient, obnovovaci string) (pristup string, platnost time.Time, err error) {
	var o struct {
		Pristupovy string `json:"access_token"`
		Platnost   int    `json:"expires_in"`
		Chyba      string `json:"error"`
	}
	if _, err := postToken(ctx, a, url.Values{"client_id": {k.ID}, "client_secret": {k.Secret},
		"refresh_token": {obnovovaci}, "grant_type": {"refresh_token"}}, &o); err != nil && o.Chyba == "" {
		return "", time.Time{}, ErrBezSpojeni
	}
	if o.Chyba == "invalid_grant" || o.Chyba == "unauthorized_client" {
		return "", time.Time{}, ErrOdvolano
	}
	if o.Pristupovy == "" {
		return "", time.Time{}, ErrBezSpojeni
	}
	return o.Pristupovy, time.Now().Add(time.Duration(o.Platnost) * time.Second), nil
}

// Odvolat: požádá Google o odvolání tokenu (při odhlášení; bez připojení se nic neděje)
func Odvolat(ctx context.Context, a Adresy, token string) {
	p, err := http.NewRequestWithContext(ctx, http.MethodPost, a.Odvolani, strings.NewReader(url.Values{"token": {token}}.Encode()))
	if err != nil {
		return
	}
	p.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if o, err := http.DefaultClient.Do(p); err == nil {
		o.Body.Close()
	}
}

func postToken(ctx context.Context, a Adresy, form url.Values, vysledek any) (int, error) {
	p, err := http.NewRequestWithContext(ctx, http.MethodPost, a.Token, strings.NewReader(form.Encode()))
	if err != nil {
		return 0, err
	}
	p.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	o, err := http.DefaultClient.Do(p)
	if err != nil {
		return 0, err
	}
	defer o.Body.Close()
	if err := json.NewDecoder(o.Body).Decode(vysledek); err != nil {
		return o.StatusCode, fmt.Errorf("nečitelná odpověď Googlu (HTTP %d)", o.StatusCode)
	}
	return o.StatusCode, nil
}

// StrankaNavratu: stránka v prohlížeči po návratu; dalsi = odkaz zpět do aplikace (telefon), "" = jen zavřít kartu
func StrankaNavratu(chyba, dalsi string) string {
	nadpis, text := "Přihlášení hotovo", "Můžeš zavřít tuto kartu a vrátit se do Pinup Katalogu."
	if dalsi != "" {
		text = "Vrať se do aplikace Pinup Katalog."
	}
	if chyba != "" {
		nadpis, text = "Přihlášení se nepovedlo", chyba+" Vrať se do Pinup Katalogu a zkus to znovu."
	}
	odkaz := ""
	if dalsi != "" {
		odkaz = `<p><a href="` + html.EscapeString(dalsi) + `" style="display:inline-block;margin-top:14px;padding:12px 24px;border-radius:999px;` +
			`background:#d6336c;color:#fff;text-decoration:none">Otevřít Pinup Katalog</a></p><script>setTimeout(function(){location.href=` +
			strconv.Quote(dalsi) + `},300)</script>`
	}
	return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pinup Katalog</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#4a0d1f,#0d0d10 60%);
color:#f3eee8;font:16px/1.5 system-ui,sans-serif}main{text-align:center;padding:2rem}h1{font-weight:300;letter-spacing:.08em;
text-transform:uppercase;color:#f0c75e}</style></head><body><main><h1>` + html.EscapeString(nadpis) + `</h1><p>` +
		html.EscapeString(text) + `</p>` + odkaz + `</main></body></html>`
}

// VolatDisk: volání Drive API s přístupovým tokenem; chyba česky (ChybaDisku)
func VolatDisk(ctx context.Context, pristup, metoda, adresa string, telo io.Reader, hlavicky map[string]string) (*http.Response, error) {
	p, err := http.NewRequestWithContext(ctx, metoda, adresa, telo)
	if err != nil {
		return nil, err
	}
	p.Header.Set("Authorization", "Bearer "+pristup)
	for k, v := range hlavicky {
		p.Header.Set(k, v)
	}
	if delka, ok := hlavicky["Content-Length"]; ok {
		p.ContentLength, _ = strconv.ParseInt(delka, 10, 64)
	}
	o, err := http.DefaultClient.Do(p)
	if err != nil {
		return nil, err
	}
	if o.StatusCode >= 300 {
		text, _ := io.ReadAll(io.LimitReader(o.Body, 16<<10))
		o.Body.Close()
		return nil, errors.New(ChybaDisku(o.StatusCode, text))
	}
	return o, nil
}

// ChybaDisku: chyba Disku srozumitelně (0.02.084): místo surové odpovědi Googlu (JSON) česká věta; u vypnutého Drive API
// i adresa, kde se zapíná
func ChybaDisku(kod int, telo []byte) string {
	var o struct {
		Error struct {
			Message string `json:"message"`
			Status  string `json:"status"`
			Errors  []struct {
				Reason string `json:"reason"`
			} `json:"errors"`
			Details []struct {
				Reason   string            `json:"reason"`
				Metadata map[string]string `json:"metadata"`
			} `json:"details"`
		} `json:"error"`
	}
	json.Unmarshal(telo, &o)
	e := o.Error
	duvody := map[string]bool{e.Status: true}
	for _, x := range e.Errors {
		duvody[x.Reason] = true
	}
	aktivace := ""
	for _, d := range e.Details {
		duvody[d.Reason] = true
		if d.Metadata["activationUrl"] != "" {
			aktivace = d.Metadata["activationUrl"]
		}
	}
	switch {
	case duvody["accessNotConfigured"] || duvody["SERVICE_DISABLED"]:
		if aktivace == "" {
			if i := strings.Index(e.Message, "https://console."); i >= 0 {
				aktivace = strings.Fields(e.Message[i:])[0]
			}
		}
		t := "Na Disku není zapnuté Google Drive API. Zapni ho ve svém projektu v Google Cloud Console (APIs & Services › Library › Google Drive API › Povolit), počkej pár minut a zkus to znovu."
		if aktivace != "" {
			t += " Adresa: " + aktivace
		}
		return t
	case duvody["storageQuotaExceeded"]:
		return "Google Disk je plný – uvolni na něm místo a zkus to znovu."
	case duvody["insufficientPermissions"] || duvody["ACCESS_TOKEN_SCOPE_INSUFFICIENT"]:
		return "Program nemá přístup k Disku. Odhlas se v ⋯ › Účet Google, přihlas se znovu a přístup k Disku povol."
	case kod == http.StatusUnauthorized:
		return "Přihlášení ke Googlu vypršelo – přihlas se znovu v ⋯ › Účet Google."
	case kod == http.StatusNotFound:
		return "Soubor na Disku nebyl nalezen (mezitím mohl zmizet)."
	case kod == http.StatusTooManyRequests || duvody["rateLimitExceeded"] || duvody["userRateLimitExceeded"]:
		return "Google teď odmítá příliš mnoho požadavků, zkus to za chvíli."
	case kod >= 500:
		return fmt.Sprintf("Google Disk je teď nedostupný (chyba %d), zkus to za chvíli.", kod)
	}
	zprava := strings.TrimSpace(e.Message)
	if zprava == "" {
		zprava = http.StatusText(kod)
	}
	if r := []rune(zprava); len(r) > 200 {
		zprava = string(r[:200]) + "…"
	}
	return fmt.Sprintf("Disk odpověděl chybou %d: %s", kod, zprava)
}
