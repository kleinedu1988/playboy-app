package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const idNahleduA = "1NBcNnN7_8cRTDcAvZYHTwSD7XqGDx-cd"
const idNahleduB = "1ZZprechod0000000000000002abcdef"

var jpegNahledu = append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 2000)...)

// Disk pro testy: /d/<id>=<velikost>; 404 vrací stránku místo obrázku jako skutečný Disk u nesdíleného souboru
type falesnyDiskNahledu struct {
	pozadavku atomic.Int64
	zpozdeni  time.Duration
	kod       func(id string) int
}

func (d *falesnyDiskNahledu) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	d.pozadavku.Add(1)
	time.Sleep(d.zpozdeni)
	id, _, _ := strings.Cut(strings.TrimPrefix(r.URL.Path, "/d/"), "=")
	kod := http.StatusOK
	if d.kod != nil {
		kod = d.kod(id)
	}
	switch kod {
	case http.StatusOK:
		w.Header().Set("Content-Type", "image/jpeg")
		w.Write(jpegNahledu)
	case http.StatusNotFound:
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte("<html>nenalezeno</html>"))
	default:
		w.WriteHeader(kod)
	}
}

func novaTestovaciMezipamet(t *testing.T, d *falesnyDiskNahledu) (*mezipametNahledu, string) {
	srv := httptest.NewServer(d)
	t.Cleanup(srv.Close)
	slozka := filepath.Join(t.TempDir(), "nahledy")
	return novaMezipametNahledu(slozka, func(id, vel string) string { return srv.URL + "/d/" + id + "=" + vel }), slozka
}

func ziskatNahled(m *mezipametNahledu, cesta string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	m.ServeHTTP(w, httptest.NewRequest("GET", cesta, nil))
	return w
}

// První zobrazení stáhne z Disku a uloží (0600 v 0700), další čte ze souboru bez sítě
func TestNahledPrvniStahneDruhyZDisku(t *testing.T) {
	d := &falesnyDiskNahledu{}
	m, slozka := novaTestovaciMezipamet(t, d)
	if w := ziskatNahled(m, "/nahled/"+idNahleduA+"/w400"); w.Code != 200 || w.Body.Len() != len(jpegNahledu) || w.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("první: %d %d", w.Code, w.Body.Len())
	}
	if w := ziskatNahled(m, "/nahled/"+idNahleduA+"/w400"); w.Code != 200 || w.Body.Len() != len(jpegNahledu) {
		t.Fatalf("druhý: %d", w.Code)
	}
	if d.pozadavku.Load() != 1 || m.zasahy.Load() != 1 {
		t.Fatalf("na Disk %d, ze souboru %d", d.pozadavku.Load(), m.zasahy.Load())
	}
	info, err := os.Stat(filepath.Join(slozka, idNahleduA[:2], idNahleduA+"_w400"))
	dir, _ := os.Stat(filepath.Join(slozka, idNahleduA[:2]))
	if err != nil || info.Mode().Perm() != 0o600 || dir.Mode().Perm() != 0o700 {
		t.Fatalf("soubor %v, práva %v %v", err, info, dir)
	}
}

// Nedostupný soubor (stránka místo obrázku) a dočasná chyba Disku se neuloží
func TestNahledChybaSeNeulozi(t *testing.T) {
	d := &falesnyDiskNahledu{kod: func(id string) int {
		if id == idNahleduA {
			return http.StatusNotFound
		}
		return http.StatusTooManyRequests
	}}
	m, slozka := novaTestovaciMezipamet(t, d)
	if w := ziskatNahled(m, "/nahled/"+idNahleduA+"/w400"); w.Code != http.StatusNotFound {
		t.Fatalf("nedostupný: %d", w.Code)
	}
	if w := ziskatNahled(m, "/nahled/"+idNahleduB+"/w400"); w.Code != http.StatusServiceUnavailable {
		t.Fatalf("429: %d", w.Code)
	}
	if _, err := os.Stat(slozka); err == nil {
		soubory, _ := filepath.Glob(filepath.Join(slozka, "*", "*"))
		if len(soubory) > 0 {
			t.Fatalf("uložilo se: %v", soubory)
		}
	}
}

func TestNahledNeplatnaAdresa(t *testing.T) {
	d := &falesnyDiskNahledu{}
	m, _ := novaTestovaciMezipamet(t, d)
	for _, c := range []string{"/nahled/kratke/w400", "/nahled/" + idNahleduA + "/../../etc", "/nahled/" + idNahleduA + "/w400/x", "/nahled/" + idNahleduA + "/x400", "/jinde/" + idNahleduA + "/w400"} {
		if w := ziskatNahled(m, c); w.Code != http.StatusNotFound {
			t.Errorf("%s: %d", c, w.Code)
		}
	}
	if d.pozadavku.Load() != 0 {
		t.Fatal("neplatná adresa nesmí jít na Disk")
	}
}

func TestNahledSoubezneJednoStazeni(t *testing.T) {
	d := &falesnyDiskNahledu{zpozdeni: 100 * time.Millisecond}
	m, _ := novaTestovaciMezipamet(t, d)
	var wg sync.WaitGroup
	for range 20 {
		wg.Add(1)
		go func() { defer wg.Done(); ziskatNahled(m, "/nahled/"+idNahleduA+"/w400") }()
	}
	wg.Wait()
	if d.pozadavku.Load() != 1 {
		t.Fatalf("na Disk %d požadavků", d.pozadavku.Load())
	}
}

// Velké velikosti (prohlížeč fotek) se jen propouštějí
func TestNahledVelkeSePropousti(t *testing.T) {
	d := &falesnyDiskNahledu{}
	m, slozka := novaTestovaciMezipamet(t, d)
	ziskatNahled(m, "/nahled/"+idNahleduA+"/s0")
	if w := ziskatNahled(m, "/nahled/"+idNahleduA+"/s0"); w.Code != 200 || w.Body.Len() != len(jpegNahledu) {
		t.Fatalf("s0: %d", w.Code)
	}
	if d.pozadavku.Load() != 2 || m.propusteno.Load() != 2 {
		t.Fatalf("s0 se nemá ukládat: %d", d.pozadavku.Load())
	}
	if _, err := os.Stat(slozka); err == nil {
		t.Fatal("složka náhledů nemá vzniknout")
	}
}

// Adresy pro okno: přes mezipaměť jen holé ID (a {id} šablony fronty); kontrola souborů jde vždy na Disk
func TestAdresaObrazkuPresMezipamet(t *testing.T) {
	nahledyPresMezipamet.Store(true)
	t.Cleanup(func() { nahledyPresMezipamet.Store(false) })
	if a := adresaObrazku(idNahleduA); a != "/nahled/"+idNahleduA+"/{velikost}" {
		t.Fatalf("adresa: %s", a)
	}
	if a := adresaObrazku("{id}"); a != "/nahled/{id}/{velikost}" {
		t.Fatalf("šablona: %s", a)
	}
	if a := adresaObrazku("kratke"); !strings.HasPrefix(a, "https://") {
		t.Fatalf("neplatné ID má jít na Disk: %s", a)
	}
	if a := adresaNahleduNaDisku(idNahleduA, "w400"); a != "https://lh3.googleusercontent.com/d/"+idNahleduA+"=w400" {
		t.Fatalf("na Disku: %s", a)
	}
}
