package main

// PDF čísel (0.02.035): soubor vybraný v dialogu se rozhraní vydá na adrese /pdf/<token> (jen takto vybrané soubory,
// žádná libovolná cesta), pdf.js ho vykreslí v okně (frontend/src/app/pdf-cisla.js). Stránky se později vyexportují
// jako obrázky pro Google Disk (rozhodnutí před 0.02.035: fotky zůstávají jen odkazy na Disk).

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// OtevrenePDF: vybraný soubor pro rozhraní
type OtevrenePDF struct {
	Adresa   string `json:"adresa"` // /pdf/<token>
	Nazev    string `json:"nazev"`  // název souboru bez cesty
	Velikost int64  `json:"velikost"`
}

var vybranaPDF = struct {
	sync.Mutex
	cesty map[string]string // token → cesta
}{cesty: map[string]string{}}

// VybratPDF: dialog pro výběr PDF čísla; prázdná adresa = nic nevybráno
func (a *App) VybratPDF() OtevrenePDF {
	cesta, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Otevřít PDF čísla",
		Filters: []runtime.FileFilter{{DisplayName: "PDF (*.pdf)", Pattern: "*.pdf;*.PDF"}}})
	if err != nil {
		a.chyba("výběr PDF", err)
		return OtevrenePDF{}
	}
	if cesta == "" {
		return OtevrenePDF{}
	}
	return zaregistrovatPDF(cesta)
}

func zaregistrovatPDF(cesta string) OtevrenePDF {
	info, err := os.Stat(cesta)
	if err != nil || info.IsDir() {
		return OtevrenePDF{}
	}
	b := make([]byte, 16)
	rand.Read(b)
	token := hex.EncodeToString(b)
	vybranaPDF.Lock()
	vybranaPDF.cesty[token] = cesta
	vybranaPDF.Unlock()
	return OtevrenePDF{Adresa: "/pdf/" + token, Nazev: filepath.Base(cesta), Velikost: info.Size()}
}

// obsluhaPDF: /pdf/<token> vydá vybraný soubor (s rozsahy), ostatní adresy jdou dál (náhledy)
type obsluhaPDF struct{ dalsi http.Handler }

func (o obsluhaPDF) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	token, je := strings.CutPrefix(r.URL.Path, "/pdf/")
	if !je {
		o.dalsi.ServeHTTP(w, r)
		return
	}
	vybranaPDF.Lock()
	cesta, ok := vybranaPDF.cesty[token]
	vybranaPDF.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(cesta)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, "", info.ModTime(), f)
}
