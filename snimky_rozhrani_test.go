//go:build snimky

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

// Snímky rozhraní pro ladění (0.02.041): spustí program nad kopií sbírky, obslouží sestavený frontend
// (frontend/dist) s voláním backendu přes HTTP a náhledy fotek a skrytý WebKitGTK (nastroje/snimky/foto.py)
// podle úlohy nafotí obrazovky a změří přetékající prvky. Nic se nezapisuje do opravdové sbírky.
//
//	npm run build --prefix frontend
//	mkdir -p /tmp/kopie/pinup-katalog && sqlite3 ~/.local/share/pinup-katalog/katalog.db ".backup /tmp/kopie/pinup-katalog/katalog.db"
//	cp ~/.local/share/pinup-katalog/katalog-uceni.db /tmp/kopie/pinup-katalog/ && cp -r ~/.local/share/pinup-katalog/obsah /tmp/kopie/pinup-katalog/
//	WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 \
//	  KOPIE=/tmp/kopie KOREN=$PWD SKRIPT=nastroje/snimky/foto.py ARGS="/tmp/snimky nastroje/snimky/profily.json" \
//	  go test -tags snimky -run TestSnimkyRozhrani -v .
const shimJS = `window.go={main:{App:new Proxy({},{get:(_,m)=>(...a)=>fetch('/zz/call',{method:'POST',body:JSON.stringify({m,a})}).then(r=>r.json()).then(x=>{if(x.e)throw new Error(x.e);return x.v})})}};
window.runtime=new Proxy({},{get:(_,n)=>(...a)=>{if(n==='EventsOnMultiple')return()=>{};if(n.startsWith('WindowIs'))return Promise.resolve(false);return undefined}});`

func TestSnimkyRozhrani(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", os.Getenv("KOPIE"))
	t.Chdir(t.TempDir())
	// FALESNY_DISK=1 (0.02.076): Google i Disk nahradí místní server (falesnyDisk ze zaloha_disk_test.go),
	// obnova tokenu vrátí přístup „pristup“; složku nastavení s tokenem dodá XDG_CONFIG_HOME
	if os.Getenv("FALESNY_DISK") != "" {
		disk := &falesnyDisk{soubory: map[string][2]string{}, relace: map[string]string{}}
		google := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/token" {
				w.Write([]byte(`{"access_token":"pristup","expires_in":3600}`))
				return
			}
			disk.ServeHTTP(w, r)
		}))
		defer google.Close()
		adresaDriveAPI, adresaTokenuGoogle = google.URL, google.URL+"/token"
	}
	a := NewApp()
	a.startup(context.Background())
	defer a.shutdown()
	dist, _ := filepath.Abs(filepath.Join(os.Getenv("KOREN"), "frontend/dist"))
	index, _ := os.ReadFile(filepath.Join(dist, "index.html"))
	stranka := strings.Replace(string(index), "<head>", `<head><script src="/zz/shim.js"></script>`, 1)
	dalsi := obsluhaPDF{dalsi: a.nahledy}
	hodnotaApp := reflect.ValueOf(a)
	mux := http.NewServeMux()
	mux.HandleFunc("/zz/shim.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/javascript")
		w.Write([]byte(shimJS))
	})
	mux.HandleFunc("/zz/call", func(w http.ResponseWriter, r *http.Request) {
		var pozadavek struct {
			M string            `json:"m"`
			A []json.RawMessage `json:"a"`
		}
		json.NewDecoder(r.Body).Decode(&pozadavek)
		odpoved := map[string]any{}
		// Dialog výběru PDF snímkovač nemá: vrátí soubor z proměnné PDF (prohlížeč PDF čísla, 0.02.048)
		if pozadavek.M == "VybratPDF" && os.Getenv("PDF") != "" {
			json.NewEncoder(w).Encode(map[string]any{"v": zaregistrovatPDF(os.Getenv("PDF"))})
			return
		}
		metoda := hodnotaApp.MethodByName(pozadavek.M)
		if !metoda.IsValid() {
			odpoved["e"] = "neznámá metoda " + pozadavek.M
		} else {
			args := make([]reflect.Value, metoda.Type().NumIn())
			for i := range args {
				p := reflect.New(metoda.Type().In(i))
				if i < len(pozadavek.A) {
					json.Unmarshal(pozadavek.A[i], p.Interface())
				}
				args[i] = p.Elem()
			}
			vysledky := metoda.Call(args)
			if len(vysledky) > 0 {
				odpoved["v"] = vysledky[0].Interface()
			}
			if len(vysledky) > 1 {
				if err, ok := vysledky[len(vysledky)-1].Interface().(error); ok && err != nil {
					odpoved["e"] = err.Error()
				}
			}
		}
		json.NewEncoder(w).Encode(odpoved)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(stranka))
			return
		}
		if soubor := filepath.Join(dist, filepath.Clean(r.URL.Path)); strings.HasPrefix(soubor, dist) {
			if st, err := os.Stat(soubor); err == nil && !st.IsDir() {
				http.ServeFile(w, r, soubor)
				return
			}
		}
		dalsi.ServeHTTP(w, r)
	})
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go http.Serve(l, mux)
	adresa := fmt.Sprintf("http://%s/", l.Addr())
	fmt.Println("adresa", adresa)
	ctx, zrusit := context.WithTimeout(context.Background(), 8*time.Minute)
	defer zrusit()
	cmd := exec.CommandContext(ctx, "python3", append([]string{os.Getenv("SKRIPT"), adresa}, strings.Fields(os.Getenv("ARGS"))...)...)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	cmd.Run()
}
