package jadro

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"pinup-katalog/internal/google"
)

// Celá cesta telefonu proti falešnému Googlu a Disku: přihlášení přes zpětnou smyčku, stažení a rozbalení
// balíčku, obnova přístupu, odvolaný přístup a odhlášení
func TestPrihlaseniAStazeni(t *testing.T) {
	var b bytes.Buffer
	z := gzip.NewWriter(&b)
	io.WriteString(z, `{"verze":1,"modelky":[{"id":1,"jmeno":"Anna"},{"id":2,"jmeno":"Bára"}]}`)
	z.Close()
	odvolano := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/token":
			r.ParseForm()
			switch {
			case r.Form.Get("grant_type") == "authorization_code" && r.Form.Get("code") == "kod" && r.Form.Get("code_verifier") != "":
				// id_token: jen část s údaji (podpis se neověřuje)
				json.NewEncoder(w).Encode(map[string]any{"access_token": "pristup", "refresh_token": "obnova", "expires_in": 3600,
					"id_token": "x.eyJlbWFpbCI6ImFAYi5jeiJ9.y"})
			case r.Form.Get("grant_type") == "refresh_token" && odvolano:
				w.WriteHeader(400)
				io.WriteString(w, `{"error":"invalid_grant"}`)
			case r.Form.Get("grant_type") == "refresh_token":
				json.NewEncoder(w).Encode(map[string]any{"access_token": "pristup", "expires_in": 3600})
			default:
				w.WriteHeader(400)
			}
		case r.Header.Get("Authorization") != "Bearer pristup":
			w.WriteHeader(401)
		case r.URL.Path == "/drive/v3/files" && strings.Contains(r.URL.Query().Get("q"), predponaAplikace):
			io.WriteString(w, `{"files":[{"id":"a1","name":"telefon-aplikace-0.2.88.apk"},{"id":"a2","name":"telefon-aplikace-0.2.100.apk"},{"id":"a3","name":"telefon-aplikace-x.apk"}]}`)
		case r.URL.Path == "/drive/v3/files/a2" && r.URL.Query().Get("alt") == "media":
			io.WriteString(w, "apk")
		case r.URL.Path == "/drive/v3/files":
			if r.URL.Query().Get("spaces") != "appDataFolder" || !strings.Contains(r.URL.Query().Get("q"), nazevBalicku) {
				w.WriteHeader(400)
				return
			}
			io.WriteString(w, `{"files":[{"id":"b1"}]}`)
		case r.URL.Path == "/drive/v3/files/b1" && r.URL.Query().Get("alt") == "media":
			w.Write(b.Bytes())
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	adresy = google.Adresy{Autorizace: server.URL + "/auth", Token: server.URL + "/token", Odvolani: server.URL + "/revoke", API: server.URL}

	if Nastavit(t.TempDir(), []byte(`{}`)) == "" {
		t.Fatal("bez klienta")
	}
	if _, err := ZacitPrihlaseni(); err == nil {
		t.Fatal("přihlášení bez klienta")
	}
	if c := Nastavit(t.TempDir(), []byte(`{"installed":{"client_id":"id","client_secret":"tajne"}}`)); c != "" {
		t.Fatal(c)
	}
	if Balicek() != "" || Stahnout() == "" {
		t.Fatal("bez přihlášení")
	}

	adresa, err := ZacitPrihlaseni()
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(adresa)
	q := u.Query()
	if q.Get("scope") != rozsahy || q.Get("code_challenge_method") != "S256" {
		t.Fatalf("adresa přihlášení: %s", adresa)
	}
	// Prohlížeč: návrat s kódem; stránka návratu odkazuje zpět do aplikace
	stranka := make(chan string, 1)
	go func() {
		o, err := http.Get(q.Get("redirect_uri") + "/?code=kod&state=" + url.QueryEscape(q.Get("state")))
		if err != nil {
			stranka <- err.Error()
			return
		}
		data, _ := io.ReadAll(o.Body)
		o.Body.Close()
		stranka <- string(data)
	}()
	if c := DokoncitPrihlaseni(); c != "" {
		t.Fatal(c)
	}
	if s := <-stranka; !strings.Contains(s, "Přihlášení hotovo") || !strings.Contains(s, navratAplikace) {
		t.Fatalf("stránka návratu: %.200s", s)
	}
	var stav struct {
		Prihlasen bool
		Email     string
	}
	json.Unmarshal([]byte(Stav()), &stav)
	if !stav.Prihlasen || stav.Email != "a@b.cz" {
		t.Fatalf("stav: %s", Stav())
	}

	if c := Stahnout(); c != "" {
		t.Fatal(c)
	}
	if !strings.Contains(Balicek(), `"Bára"`) {
		t.Fatalf("balíček: %q", Balicek())
	}

	// Nová verze aplikace: nejnovější z Disku, jen když je novější než moje; stažení do souboru
	if v := NovaVerze("0.2.87"); v != `{"id":"a2","verze":"0.2.100"}` {
		t.Fatalf("nová verze: %q", v)
	}
	if v := NovaVerze("0.2.100"); v != "" {
		t.Fatalf("stejná verze: %q", v)
	}
	cil := t.TempDir() + "/aktualizace.apk"
	if c := StahnoutAplikaci("a2", cil); c != "" {
		t.Fatal(c)
	}
	if data, _ := os.ReadFile(cil); string(data) != "apk" {
		t.Fatalf("stažená aplikace: %q", data)
	}

	// Vypršelý přístupový token se obnoví; odvolaný přístup odhlásí, balíček zůstane
	tok := nacistToken()
	tok.Pristupovy = ""
	ulozitToken(tok)
	if c := Stahnout(); c != "" {
		t.Fatal(c)
	}
	tok = nacistToken()
	tok.Pristupovy = ""
	ulozitToken(tok)
	odvolano = true
	if c := Stahnout(); !strings.Contains(c, "přihlas se znovu") || nacistToken() != nil || Balicek() == "" {
		t.Fatalf("odvolaný přístup: %q", c)
	}
	Odhlasit()
	if Balicek() != "" || strings.Contains(Stav(), `"prihlasen":true`) {
		t.Fatal("odhlášení")
	}
}

// Zrušený návrat v prohlížeči
func TestPrihlaseniZruseno(t *testing.T) {
	Nastavit(t.TempDir(), []byte(`{"client_id":"id"}`))
	adresa, err := ZacitPrihlaseni()
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(adresa)
	q := u.Query()
	go http.Get(q.Get("redirect_uri") + "/?error=access_denied&state=" + url.QueryEscape(q.Get("state")))
	if c := DokoncitPrihlaseni(); !strings.Contains(c, "zrušeno") || !strings.Contains(Stav(), "zrušeno") {
		t.Fatalf("zrušení: %q", c)
	}
}

// Zrušené čekání (krátká služba vypršela)
func TestPrihlaseniPreruseno(t *testing.T) {
	Nastavit(t.TempDir(), []byte(`{"client_id":"id"}`))
	if _, err := ZacitPrihlaseni(); err != nil {
		t.Fatal(err)
	}
	go ZrusitPrihlaseni()
	if c := DokoncitPrihlaseni(); !strings.Contains(c, "nebylo dokončeno") {
		t.Fatalf("přerušení: %q", c)
	}
}

func TestNovejsi(t *testing.T) {
	for _, c := range []struct {
		a, b string
		v    bool
	}{{"0.2.88", "0.2.87", true}, {"0.2.100", "0.2.99", true}, {"0.2.87", "0.2.87", false}, {"0.2.8", "0.2.80", false},
		{"0.3", "0.2.99", true}, {"x", "0.2.1", false}, {"0.2.87.1", "0.2.87", true}} {
		if novejsi(c.a, c.b) != c.v {
			t.Errorf("%s > %s: %v", c.a, c.b, !c.v)
		}
	}
}
