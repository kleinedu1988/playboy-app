package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// /pdf/<token> vydá jen soubor vybraný v dialogu, i s rozsahem; ostatní adresy jdou dál (0.02.035)
func TestObsluhaPDF(t *testing.T) {
	cesta := filepath.Join(t.TempDir(), "cislo.pdf")
	os.WriteFile(cesta, []byte("%PDF-1.4 obsah"), 0o644)
	p := zaregistrovatPDF(cesta)
	if p.Nazev != "cislo.pdf" || p.Velikost != 14 || len(p.Adresa) != len("/pdf/")+32 {
		t.Fatalf("%+v", p)
	}
	dalsi := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(299) })
	o := obsluhaPDF{dalsi: dalsi}
	w := httptest.NewRecorder()
	o.ServeHTTP(w, httptest.NewRequest("GET", p.Adresa, nil))
	if w.Code != 200 || w.Body.String() != "%PDF-1.4 obsah" || w.Header().Get("Content-Type") != "application/pdf" {
		t.Fatalf("%d %q", w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	r := httptest.NewRequest("GET", p.Adresa, nil)
	r.Header.Set("Range", "bytes=0-3")
	o.ServeHTTP(w, r)
	if w.Code != 206 || w.Body.String() != "%PDF" {
		t.Fatalf("rozsah: %d %q", w.Code, w.Body.String())
	}
	for _, adresa := range []string{"/pdf/neznamy", "/pdf/../etc/passwd"} {
		w = httptest.NewRecorder()
		o.ServeHTTP(w, httptest.NewRequest("GET", adresa, nil))
		if w.Code != 404 {
			t.Errorf("%s: %d", adresa, w.Code)
		}
	}
	w = httptest.NewRecorder()
	o.ServeHTTP(w, httptest.NewRequest("GET", "/nahled/x", nil))
	if w.Code != 299 {
		t.Errorf("náhledy: %d", w.Code)
	}
}
