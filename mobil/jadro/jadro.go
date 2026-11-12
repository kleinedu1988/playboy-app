// Jádro aplikace pro telefon (0.02.085): knihovna pro Android přes `gomobile bind` (třída jadro.Jadro). Přihlášení
// Google a stažení balíčku sbírky z Disku – stejný kód jako program na PC (internal/google). Java vrstva
// (mobil/webview) jen ukazuje stránku, otevírá prohlížeč a drží proces při životě během přihlášení.
//
// Tokeny i stažený balíček jsou v soukromé složce aplikace (Nastavit); balíček je rozbalený JSON, stránka ho čte
// přímo a ukáže ho i bez připojení.
package jadro

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"pinup-katalog/internal/google"
)

const (
	// Telefon jen čte skrytou složku programu na Disku (balíček sbírky)
	rozsahy         = "openid email https://www.googleapis.com/auth/drive.appdata"
	nazevBalicku    = "telefon-balicek.json.gz"
	navratAplikace  = "pinupkatalog://prihlaseno"
	casNaPrihlaseni = 4 * time.Minute
)

var (
	mu        sync.Mutex
	slozka    string
	klient    google.Klient
	maKlienta bool
	posledni  string // chyba posledního přihlášení
	adresy    = google.Vychozi
	cekajici  *prihlasovani
)

type prihlasovani struct {
	p         google.Prihlaseni
	posluchac net.Listener
}

type token struct {
	Obnovovaci string    `json:"refresh_token"`
	Pristupovy string    `json:"access_token"`
	Platnost   time.Time `json:"expiry"`
	Email      string    `json:"email"`
}

// Nastavit: soukromá složka aplikace a přihlašovací údaje programu (assets/klient.json); vrací chybu klienta
func Nastavit(slozkaDat string, klientJSON []byte) string {
	mu.Lock()
	defer mu.Unlock()
	slozka = slozkaDat
	k, err := google.KlientZJSON(klientJSON)
	klient, maKlienta = k, err == nil
	if err != nil {
		return "V aplikaci chybí přihlašovací údaje programu (" + err.Error() + ")"
	}
	return ""
}

func cestaTokenu() string  { return filepath.Join(slozka, "google-token.json") }
func cestaBalicku() string { return filepath.Join(slozka, "balicek.json") }

func nacistToken() *token {
	data, err := os.ReadFile(cestaTokenu())
	if err != nil {
		return nil
	}
	var t token
	if json.Unmarshal(data, &t) != nil || t.Obnovovaci == "" {
		return nil
	}
	return &t
}

func ulozit(cesta string, data []byte) error {
	docasny := cesta + ".novy"
	if err := os.WriteFile(docasny, data, 0o600); err != nil {
		return err
	}
	return os.Rename(docasny, cesta)
}

func ulozitToken(t *token) error {
	data, _ := json.Marshal(t)
	return ulozit(cestaTokenu(), data)
}

// Stav: JSON {klient, prihlasen, email, chyba}
func Stav() string {
	mu.Lock()
	defer mu.Unlock()
	t := nacistToken()
	s := map[string]any{"klient": maKlienta, "prihlasen": t != nil, "email": "", "chyba": posledni}
	if t != nil {
		s["email"] = t.Email
	}
	data, _ := json.Marshal(s)
	return string(data)
}

// ZacitPrihlaseni připraví návrat na zpětnou smyčku a vrátí adresu, kterou otevřít v prohlížeči
func ZacitPrihlaseni() (string, error) {
	mu.Lock()
	defer mu.Unlock()
	if !maKlienta {
		return "", errors.New("V aplikaci chybí přihlašovací údaje programu – sestav ji znovu s klientem Google")
	}
	if cekajici != nil {
		cekajici.posluchac.Close()
	}
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	p := google.NovePrihlaseni(adresy, klient, fmt.Sprintf("http://127.0.0.1:%d", l.Addr().(*net.TCPAddr).Port), rozsahy)
	cekajici = &prihlasovani{p: p, posluchac: l}
	posledni = ""
	return p.Adresa, nil
}

// DokoncitPrihlaseni čeká na návrat z prohlížeče (nejvýš 4 minuty), vymění kód a uloží přihlášení; "" = hotovo
func DokoncitPrihlaseni() string {
	mu.Lock()
	c := cekajici
	mu.Unlock()
	if c == nil {
		return "Přihlášení nebylo zahájeno"
	}
	chyba := dokoncit(c)
	mu.Lock()
	if cekajici == c {
		cekajici = nil
		posledni = chyba
	}
	mu.Unlock()
	return chyba
}

func dokoncit(c *prihlasovani) string {
	ctx, zrusit := context.WithTimeout(context.Background(), casNaPrihlaseni)
	defer zrusit()
	type navrat struct{ kod, chyba string }
	navraty := make(chan navrat, 1)
	vysledky := make(chan string, 1)
	server := &http.Server{ReadHeaderTimeout: 10 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		var v navrat
		v.kod, v.chyba = c.p.KodZNavratu(r.URL.Query())
		select {
		case navraty <- v:
		default:
			http.NotFound(w, r)
			return
		}
		// Stránku v prohlížeči až po výměně kódu, aby ukázala skutečný výsledek
		chyba := <-vysledky
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, google.StrankaNavratu(chyba, navratAplikace))
	})}
	zavreno := make(chan struct{})
	go func() {
		server.Serve(c.posluchac)
		close(zavreno)
	}()
	defer func() {
		time.Sleep(time.Second) // stránka návratu se stihne odeslat
		server.Close()
	}()
	var v navrat
	select {
	case v = <-navraty:
	case <-ctx.Done():
		return "Přihlášení nebylo dokončeno do 4 minut."
	case <-zavreno:
		return "Přihlášení nebylo dokončeno – zkus to znovu."
	}
	chyba := v.chyba
	if chyba == "" {
		chyba = vymenit(ctx, c.p, v.kod)
	}
	vysledky <- chyba
	return chyba
}

func vymenit(ctx context.Context, p google.Prihlaseni, kod string) string {
	mu.Lock()
	k := klient
	mu.Unlock()
	g, err := google.VymenitKod(ctx, adresy, k, p, kod)
	if err != nil {
		return "Přihlášení se nepodařilo dokončit: " + err.Error()
	}
	if err := ulozitToken(&token{Obnovovaci: g.Obnovovaci, Pristupovy: g.Pristupovy, Platnost: g.Platnost, Email: g.Email}); err != nil {
		return "Přihlášení se nepodařilo uložit: " + err.Error()
	}
	return ""
}

// ZrusitPrihlaseni ukončí čekání na návrat (služba vypršela nebo si to uživatel rozmyslel)
func ZrusitPrihlaseni() {
	mu.Lock()
	defer mu.Unlock()
	if cekajici != nil {
		cekajici.posluchac.Close()
	}
}

// Odhlasit smaže přihlášení a stažený balíček a na pozadí požádá Google o odvolání
func Odhlasit() {
	mu.Lock()
	t := nacistToken()
	os.Remove(cestaTokenu())
	os.Remove(cestaBalicku())
	posledni = ""
	mu.Unlock()
	if t != nil {
		go func() {
			ctx, zrusit := context.WithTimeout(context.Background(), 10*time.Second)
			defer zrusit()
			google.Odvolat(ctx, adresy, t.Obnovovaci)
		}()
	}
}

// Platný přístupový token (obnoví ho, když vypršel). Zámek se při čekání na Google nedrží (0.02.092), jinak by
// stránka (Stav, Balicek) při pomalém připojení zamrzla; souběžné obnovy nevadí, uloží se poslední
func pristup(ctx context.Context) (string, error) {
	mu.Lock()
	t, k := nacistToken(), klient
	mu.Unlock()
	if t == nil {
		return "", errors.New("Nejsi přihlášený ke Googlu")
	}
	if t.Pristupovy != "" && time.Until(t.Platnost) > time.Minute {
		return t.Pristupovy, nil
	}
	p, platnost, err := google.Obnovit(ctx, adresy, k, t.Obnovovaci)
	mu.Lock()
	defer mu.Unlock()
	// Mezitím odhlášeno nebo přihlášeno znovu: výsledek se zahodí
	if aktualni := nacistToken(); aktualni == nil || aktualni.Obnovovaci != t.Obnovovaci {
		return "", errors.New("Nejsi přihlášený ke Googlu")
	}
	if errors.Is(err, google.ErrOdvolano) {
		os.Remove(cestaTokenu())
		return "", errors.New("Přihlášení ke Googlu vypršelo nebo bylo odvoláno – přihlas se znovu")
	}
	if err != nil {
		return "", errors.New("Google není dostupný – zkontroluj připojení")
	}
	t.Pristupovy, t.Platnost = p, platnost
	ulozitToken(t)
	return p, nil
}

// Stahnout stáhne nejnovější balíček sbírky z Disku a uloží ho rozbalený; "" = hotovo, jinak česká chyba
func Stahnout() string {
	ctx, zrusit := context.WithTimeout(context.Background(), 2*time.Minute)
	defer zrusit()
	if err := stahnout(ctx); err != nil {
		return err.Error()
	}
	return ""
}

func stahnout(ctx context.Context) error {
	p, err := pristup(ctx)
	if err != nil {
		return err
	}
	q := url.Values{"spaces": {"appDataFolder"}, "pageSize": {"100"}, "orderBy": {"modifiedTime desc"},
		"fields": {"files(id,name,modifiedTime)"}, "q": {"name='" + nazevBalicku + "'"}}
	o, err := google.VolatDisk(ctx, p, http.MethodGet, adresy.API+"/drive/v3/files?"+q.Encode(), nil, nil)
	if err != nil {
		return err
	}
	var seznam struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	err = json.NewDecoder(o.Body).Decode(&seznam)
	o.Body.Close()
	if err != nil {
		return fmt.Errorf("nečitelný seznam souborů na Disku: %w", err)
	}
	if len(seznam.Files) == 0 {
		return errors.New("Na Disku zatím balíček sbírky není. V programu na PC: ⋯ › Obnovit ze zálohy… › Nahrát teď.")
	}
	o, err = google.VolatDisk(ctx, p, http.MethodGet, adresy.API+"/drive/v3/files/"+url.PathEscape(seznam.Files[0].ID)+"?alt=media", nil, nil)
	if err != nil {
		return err
	}
	defer o.Body.Close()
	gz, err := io.ReadAll(io.LimitReader(o.Body, 64<<20))
	if err != nil {
		return fmt.Errorf("stažení balíčku se přerušilo: %w", err)
	}
	data, err := rozbalit(gz)
	if err != nil {
		return err
	}
	mu.Lock()
	defer mu.Unlock()
	return ulozit(cestaBalicku(), data)
}

// Rozbalí balíček a ověří, že je celý (JSON s modelkami)
func rozbalit(gz []byte) ([]byte, error) {
	z, err := gzip.NewReader(bytes.NewReader(gz))
	if err != nil {
		return nil, fmt.Errorf("balíček není platný: %w", err)
	}
	data, err := io.ReadAll(z)
	if err != nil {
		return nil, fmt.Errorf("balíček není celý: %w", err)
	}
	var b struct {
		Modelky []json.RawMessage `json:"modelky"`
	}
	if err := json.Unmarshal(data, &b); err != nil {
		return nil, fmt.Errorf("balíček není platný: %w", err)
	}
	return data, nil
}

// Balicek: uložený rozbalený balíček (JSON) nebo ""
func Balicek() string {
	mu.Lock()
	defer mu.Unlock()
	data, err := os.ReadFile(cestaBalicku())
	if err != nil {
		return ""
	}
	return string(data)
}

// Nové verze aplikace (0.02.088): program na PC nahrává APK do skryté složky na Disku jako
// telefon-aplikace-<verze>.apk (aplikace_telefonu.go)
const predponaAplikace = "telefon-aplikace-"

// NovaVerze: JSON {verze, id} novější verze aplikace na Disku než moje, jinak "" (i bez přihlášení nebo spojení)
func NovaVerze(moje string) string {
	ctx, zrusit := context.WithTimeout(context.Background(), 30*time.Second)
	defer zrusit()
	p, err := pristup(ctx)
	if err != nil {
		return ""
	}
	q := url.Values{"spaces": {"appDataFolder"}, "pageSize": {"100"}, "fields": {"files(id,name)"},
		"q": {"name contains '" + predponaAplikace + "'"}}
	o, err := google.VolatDisk(ctx, p, http.MethodGet, adresy.API+"/drive/v3/files?"+q.Encode(), nil, nil)
	if err != nil {
		return ""
	}
	defer o.Body.Close()
	var seznam struct {
		Files []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"files"`
	}
	if json.NewDecoder(o.Body).Decode(&seznam) != nil {
		return ""
	}
	nej, id := moje, ""
	for _, f := range seznam.Files {
		v, ok := strings.CutPrefix(f.Name, predponaAplikace)
		v, ok2 := strings.CutSuffix(v, ".apk")
		if ok && ok2 && novejsi(v, nej) {
			nej, id = v, f.ID
		}
	}
	if id == "" {
		return ""
	}
	data, _ := json.Marshal(map[string]string{"verze": nej, "id": id})
	return string(data)
}

// a > b pro verze „0.2.88“ (čísla po tečkách; nečíselná verze není novější)
func novejsi(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := range max(len(pa), len(pb)) {
		x, y := 0, 0
		if i < len(pa) {
			n, err := strconv.Atoi(pa[i])
			if err != nil {
				return false
			}
			x = n
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

// StahnoutAplikaci stáhne APK z Disku do souboru cil; "" = hotovo, jinak česká chyba
func StahnoutAplikaci(id, cil string) string {
	ctx, zrusit := context.WithTimeout(context.Background(), 10*time.Minute)
	defer zrusit()
	p, err := pristup(ctx)
	if err != nil {
		return err.Error()
	}
	o, err := google.VolatDisk(ctx, p, http.MethodGet, adresy.API+"/drive/v3/files/"+url.PathEscape(id)+"?alt=media", nil, nil)
	if err != nil {
		return err.Error()
	}
	defer o.Body.Close()
	f, err := os.Create(cil + ".novy")
	if err != nil {
		return err.Error()
	}
	_, err = io.Copy(f, io.LimitReader(o.Body, 200<<20))
	if e := f.Close(); err == nil {
		err = e
	}
	if err != nil {
		os.Remove(cil + ".novy")
		return "Stažení aplikace se přerušilo: " + err.Error()
	}
	if err := os.Rename(cil+".novy", cil); err != nil {
		return err.Error()
	}
	return ""
}
