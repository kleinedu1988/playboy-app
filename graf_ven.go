package main

// Graf ven (ROADMAP 1.53): graf nebo tabulka Statistik jako PNG nebo CSV; soubor si uživatel vybere v dialogu

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Uloží obsah do souboru z dialogu; PNG chodí jako data URL (base64), CSV jako text. Vrací cestu, "" po zrušení.
func (a *App) UlozitSouborGrafu(nazev, obsah string) string {
	pripona := strings.ToLower(filepath.Ext(nazev))
	filtr := runtime.FileFilter{DisplayName: "CSV (*.csv)", Pattern: "*.csv"}
	data := []byte(obsah)
	if pripona == ".png" {
		filtr = runtime.FileFilter{DisplayName: "Obrázek PNG (*.png)", Pattern: "*.png"}
		_, b64, _ := strings.Cut(obsah, ",")
		var err error
		if data, err = base64.StdEncoding.DecodeString(b64); err != nil {
			a.chyba("uložení grafu", err)
			return ""
		}
	} else if pripona != ".csv" {
		return ""
	}
	cesta, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: "Uložit graf", DefaultFilename: nazev, Filters: []runtime.FileFilter{filtr}})
	if err != nil || cesta == "" {
		return ""
	}
	if !strings.EqualFold(filepath.Ext(cesta), pripona) {
		cesta += pripona
	}
	if err := os.WriteFile(cesta, data, 0o644); err != nil {
		a.chyba("uložení grafu", err)
		return ""
	}
	return cesta
}
