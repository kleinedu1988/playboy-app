package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Celé přihlášení s místním „Googlem“: autorizace (prohlížeč nahradí GET na návratovou adresu), výměna kódu
// s ověřením PKCE, uložení tokenu s právy 0600, stav účtu, odhlášení
func TestPrihlaseniGoogle(t *testing.T) {
	slozka := t.TempDir()
	puvodni := []any{slozkaNastaveniGoogle, otevritProhlizec, adresaAutorizaceGoogle, adresaTokenuGoogle, adresaOdvolaniGoogle}
	t.Cleanup(func() {
		slozkaNastaveniGoogle = puvodni[0].(func() string)
		otevritProhlizec = puvodni[1].(func(*App, string))
		adresaAutorizaceGoogle, adresaTokenuGoogle, adresaOdvolaniGoogle = puvodni[2].(string), puvodni[3].(string), puvodni[4].(string)
	})
	slozkaNastaveniGoogle = func() string { return slozka }
	a := &App{}

	if u := a.GetUcetGoogle(); u.Nastaveno || u.Prihlasen {
		t.Fatalf("bez údajů: %+v", u)
	}
	if z := a.PrihlasitGoogle(); !strings.Contains(z, "nemá přihlašovací údaje") {
		t.Fatalf("bez údajů: %q", z)
	}
	os.WriteFile(filepath.Join(slozka, "google-klient.json"), []byte(`{"installed":{"client_id":"klient-1","client_secret":"tajne"}}`), 0o600)

	var vyzva string
	odvolanyPristup := false
	odvolano := make(chan string, 1)
	google := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		switch r.URL.Path {
		case "/token":
			if r.Form.Get("grant_type") == "refresh_token" {
				if odvolanyPristup || r.Form.Get("refresh_token") != "obnova" {
					w.WriteHeader(400)
					io.WriteString(w, `{"error":"invalid_grant"}`)
					return
				}
				io.WriteString(w, `{"access_token":"novy","expires_in":3600}`)
				return
			}
			s := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
			if r.Form.Get("code") != "kod-42" || base64.RawURLEncoding.EncodeToString(s[:]) != vyzva || r.Form.Get("client_secret") != "tajne" {
				w.WriteHeader(400)
				io.WriteString(w, `{"error":"invalid_grant"}`)
				return
			}
			id := base64.RawURLEncoding.EncodeToString([]byte(`{"email":"modelka@example.com","name":"Test Uživatel"}`))
			json.NewEncoder(w).Encode(map[string]any{"access_token": "pristup", "refresh_token": "obnova", "expires_in": 3600,
				"scope": rozsahyGoogle, "id_token": "x." + id + ".y"})
		case "/revoke":
			odvolano <- r.Form.Get("token")
		}
	}))
	defer google.Close()
	adresaAutorizaceGoogle, adresaTokenuGoogle, adresaOdvolaniGoogle = google.URL+"/auth", google.URL+"/token", google.URL+"/revoke"
	otevritProhlizec = func(_ *App, adresa string) {
		u, _ := url.Parse(adresa)
		q := u.Query()
		if q.Get("scope") != rozsahyGoogle || q.Get("code_challenge_method") != "S256" || !strings.HasPrefix(q.Get("redirect_uri"), "http://127.0.0.1:") {
			t.Errorf("autorizace: %v", q)
		}
		vyzva = q.Get("code_challenge")
		go func() {
			o, err := http.Get(q.Get("redirect_uri") + "/?code=kod-42&state=" + url.QueryEscape(q.Get("state")))
			if err == nil {
				telo, _ := io.ReadAll(o.Body)
				o.Body.Close()
				if !strings.Contains(string(telo), "Přihlášení hotovo") {
					t.Errorf("stránka návratu: %s", telo)
				}
			}
		}()
	}
	if z := a.PrihlasitGoogle(); z != "" {
		t.Fatalf("přihlášení: %q", z)
	}
	u := a.GetUcetGoogle()
	if !u.Nastaveno || !u.Prihlasen || u.Email != "modelka@example.com" || u.Jmeno != "Test Uživatel" || u.Probiha {
		t.Fatalf("po přihlášení: %+v", u)
	}
	if info, err := os.Stat(filepath.Join(slozka, "google-token.json")); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("token: %v %v", info, err)
	}

	// Zapamatované přihlášení: obnova tokenu projde; odvolaný přístup token smaže (brána se zavře)
	if v := a.OveritUcetGoogle(); v != "ok" {
		t.Fatalf("ověření: %q", v)
	}
	if !a.GetUcetGoogle().Prihlasen {
		t.Fatal("po ověření odhlášen")
	}
	odvolanyPristup = true
	if v := a.OveritUcetGoogle(); v != "odvolano" || a.GetUcetGoogle().Prihlasen {
		t.Fatalf("odvolaný přístup: %q", v)
	}
	// Znovu přihlásit pro další části testu
	odvolanyPristup = false
	if z := a.PrihlasitGoogle(); z != "" {
		t.Fatalf("nové přihlášení: %q", z)
	}

	// Cizí state se odmítne
	otevritProhlizec = func(_ *App, adresa string) {
		u, _ := url.Parse(adresa)
		go http.Get(u.Query().Get("redirect_uri") + "/?code=kod-42&state=cizi")
	}
	if z := a.PrihlasitGoogle(); !strings.Contains(z, "nepatří") {
		t.Fatalf("cizí state: %q", z)
	}

	if !a.OdhlasitGoogle() || a.GetUcetGoogle().Prihlasen {
		t.Fatal("odhlášení")
	}
	if tok := <-odvolano; tok != "obnova" {
		t.Fatalf("odvolán token %q", tok)
	}
}
