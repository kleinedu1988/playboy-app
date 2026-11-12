package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// Falešný Disk: skrytá složka programu (appDataFolder) v paměti
type falesnyDisk struct {
	sync.Mutex
	soubory map[string][2]string // id → název, obsah
	relace  map[string]string    // relace nahrání → název
	dalsi   int
}

func (d *falesnyDisk) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	d.Lock()
	defer d.Unlock()
	if r.Header.Get("Authorization") != "Bearer pristup" {
		w.WriteHeader(401)
		return
	}
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/drive/v3/files":
		if r.URL.Query().Get("spaces") != "appDataFolder" {
			w.WriteHeader(400)
			return
		}
		var f []map[string]string
		for id, s := range d.soubory {
			f = append(f, map[string]string{"id": id, "name": s[0], "size": fmt.Sprint(len(s[1]))})
		}
		json.NewEncoder(w).Encode(map[string]any{"files": f})
	case r.Method == http.MethodPost && r.URL.Path == "/upload/drive/v3/files":
		var meta struct {
			Name    string   `json:"name"`
			Parents []string `json:"parents"`
		}
		json.NewDecoder(r.Body).Decode(&meta)
		if len(meta.Parents) != 1 || meta.Parents[0] != "appDataFolder" {
			w.WriteHeader(400)
			return
		}
		d.dalsi++
		klic := fmt.Sprint(d.dalsi)
		d.relace[klic] = meta.Name
		w.Header().Set("Location", "http://"+r.Host+"/relace/"+klic)
	case r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/relace/"):
		obsah, _ := io.ReadAll(r.Body)
		d.dalsi++
		d.soubory[fmt.Sprint("f", d.dalsi)] = [2]string{d.relace[strings.TrimPrefix(r.URL.Path, "/relace/")], string(obsah)}
	case r.Method == http.MethodDelete:
		delete(d.soubory, strings.TrimPrefix(r.URL.Path, "/drive/v3/files/"))
	case r.Method == http.MethodGet && r.URL.Query().Get("alt") == "media":
		io.WriteString(w, d.soubory[strings.TrimPrefix(r.URL.Path, "/drive/v3/files/")][1])
	default:
		w.WriteHeader(404)
	}
}

func TestZalohaNaDisku(t *testing.T) {
	data, nastaveni := t.TempDir(), t.TempDir()
	t.Setenv("XDG_DATA_HOME", data)
	puvodniSlozka, puvodniAPI := slozkaNastaveniGoogle, adresaDriveAPI
	t.Cleanup(func() { slozkaNastaveniGoogle, adresaDriveAPI = puvodniSlozka, puvodniAPI })
	slozkaNastaveniGoogle = func() string { return nastaveni }
	disk := &falesnyDisk{soubory: map[string][2]string{}, relace: map[string]string{}}
	server := httptest.NewServer(disk)
	defer server.Close()
	adresaDriveAPI = server.URL
	a := &App{}

	if v := a.GetZalohyNaDisku(); v.Prihlasen || a.NahratZalohuNaDisk() == "" {
		t.Fatal("bez přihlášení se nemá nic nahrávat")
	}
	ulozitTokenGoogle(&tokenGoogle{Obnovovaci: "obnova", Pristupovy: "pristup", Platnost: time.Now().Add(time.Hour)})

	// Devět denních záloh (platné databáze) za sebou, každá se nahraje
	os.MkdirAll(slozkaZaloh(), 0o700)
	var nazvy []string
	for den := 1; den <= 9; den++ {
		nazev := fmt.Sprintf("playboy-2026-11-%02d-120000.000-denni.db", den)
		db, _ := sql.Open("sqlite", filepath.Join(slozkaZaloh(), nazev))
		db.Exec(`CREATE TABLE modelky (id INTEGER); INSERT INTO modelky VALUES (?)`, den)
		db.Close()
		nazvy = append(nazvy, nazev)
		if err := a.nahratZalohu(t.Context(), nazev); err != nil {
			t.Fatalf("nahrání %s: %v", nazev, err)
		}
	}
	// Opakované nahrání téže zálohy nic nepřidá
	if err := a.nahratZalohu(t.Context(), nazvy[8]); err != nil {
		t.Fatal(err)
	}
	v := a.GetZalohyNaDisku()
	if !v.Prihlasen || v.Chyba != "" || len(v.Zalohy) != pocetZalohNaDisku {
		t.Fatalf("na Disku: %+v", v)
	}
	if v.Zalohy[0].Nazev != nazvy[8] || v.Zalohy[6].Nazev != nazvy[2] || v.Zalohy[0].Cas != "2026-11-09 12:00:00" || !v.Zalohy[0].Mistni {
		t.Fatalf("pořadí nebo údaje: %+v", v.Zalohy)
	}

	// Čistý program: místní zálohy nejsou, záloha z Disku se stáhne a je čitelná
	os.RemoveAll(slozkaZaloh())
	nazev, err := a.StahnoutZalohuZDisku(v.Zalohy[0].ID)
	if err != nil || nazev != nazvy[8] {
		t.Fatalf("stažení: %q %v", nazev, err)
	}
	db, _ := otevritZalohu(filepath.Join(slozkaZaloh(), nazev))
	var id int
	if err := db.QueryRow(`SELECT id FROM modelky`).Scan(&id); err != nil || id != 9 {
		t.Fatalf("stažená záloha: %d %v", id, err)
	}
	db.Close()
	if _, err := a.StahnoutZalohuZDisku("neexistuje"); err == nil {
		t.Fatal("neexistující záloha")
	}
}
