package obsah

// Stahování modelu a běhové knihovny pro obsah fotek (docs/NAVRH-OBSAH-FOTEK.md, docs/MODEL-CLIP-B32.md).
// Soubory jsou velké (89 MB model, 11 MB archiv ONNX Runtime), proto se stahují na vyžádání, po blocích rovnou
// na disk, s průběhem pro okno a s navázáním po přerušení (hlavička Range). Teprve soubor se shodným SHA-256
// (vestavěným v programu, pevná verze) dostane konečný název; poškozený soubor se smaže a ONNX Runtime ho
// nikdy neotevře. Soubory jsou ve složce obsah/ vedle databáze (složky 0700, soubory 0600 jako databáze).

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Soubor potřebný pro obsah fotek
type Soubor struct {
	Nazev    string // konečný název ve složce obsah/
	Adresa   string // pevná revize, ne „latest“
	Hash     string // SHA-256 staženého souboru (u archivu archivu samotného)
	Velikost int64  // velikost staženého souboru v bajtech (pro součet průběhu před začátkem stahování)
	Clen     string // u archivu .tgz cesta souboru uvnitř, který se vybalí jako Nazev; jinak prázdné
}

// Soubory ve stejném pořadí, v jakém se stahují (model první: bez něj nemá knihovna smysl)
var Soubory = []Soubor{
	{
		Nazev:    "clip-vit-b32-vision-int8.onnx",
		Adresa:   "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/6b7c523703ae26e39be4b03774966f8571c7f523/onnx/vision_model_int8.onnx",
		Hash:     "0ab0c1b3ace708e539633af1744d5a95247fe4e14d3e08ff197ef82a6cb9bd93",
		Velikost: 88648877,
	},
	{
		Nazev:    "libonnxruntime.so.1.31.1",
		Adresa:   "https://github.com/microsoft/onnxruntime/releases/download/v1.31.1/onnxruntime-linux-x64-1.31.1.tgz",
		Hash:     "c849e36a1ef3e22d4ff217b9d1ce4a3cf5b9467b975610913ae959ad5b16bdc9",
		Velikost: 11413655,
		Clen:     "onnxruntime-linux-x64-1.31.1/lib/libonnxruntime.so.1.31.1",
	},
}

// Přípona rozstaženého souboru; zůstane po přerušení a příště se naváže
const pripona = ".castecne"

// Velikost bloku při zápisu na disk
const blok = 256 << 10

// Jak často nejvýš hlásit průběh (okno nepotřebuje víc než ~10 událostí za sekundu)
const intervalPrubehu = 100 * time.Millisecond

// Největší povolený soubor (obrana proti chybné odpovědi serveru)
const nejvetsiSoubor = 1 << 30

// ErrHash: stažený soubor nemá očekávaný SHA-256 (výpadek, podvržený nebo změněný soubor); částečný soubor je smazaný
var ErrHash = errors.New("stažený soubor je poškozený (nesouhlasí kontrolní součet)")

// Průběh přípravy všech souborů
type Prubeh struct {
	Soubor string `json:"soubor"` // právě stahovaný soubor
	Hotovo int64  `json:"hotovo"` // bajtů všech souborů dohromady
	Celkem int64  `json:"celkem"`
}

// Pripraveno: jsou na místě všechny soubory (jen podle existence a velikosti nenulové; hash se ověřuje po stažení)
func Pripraveno(slozka string) bool {
	for _, s := range Soubory {
		if i, err := os.Stat(filepath.Join(slozka, s.Nazev)); err != nil || i.Size() == 0 {
			return false
		}
	}
	return true
}

// Pripravit stáhne do složky soubory, které chybí; průběh hlásí součtem přes všechny soubory.
// Přerušení přes ctx nechá částečný soubor a příští volání naváže.
func Pripravit(ctx context.Context, klient *http.Client, slozka string, prubeh func(Prubeh)) error {
	if err := os.MkdirAll(slozka, 0o700); err != nil {
		return err
	}
	var celkem, hotovo int64
	var chybi []Soubor
	for _, s := range Soubory {
		if _, err := os.Stat(filepath.Join(slozka, s.Nazev)); err == nil {
			continue
		}
		chybi = append(chybi, s)
		celkem += s.Velikost
	}
	for _, s := range chybi {
		zacatek := hotovo
		cil := filepath.Join(slozka, s.Nazev)
		stazeny := cil
		if s.Clen != "" {
			stazeny = filepath.Join(slozka, filepath.Base(s.Adresa))
		}
		err := Stahnout(ctx, klient, s.Adresa, stazeny, s.Hash, func(h, _ int64) {
			if prubeh != nil {
				prubeh(Prubeh{Soubor: s.Nazev, Hotovo: zacatek + h, Celkem: celkem})
			}
		})
		if err != nil {
			return fmt.Errorf("%s: %w", s.Nazev, err)
		}
		if s.Clen != "" {
			err = vybalit(stazeny, s.Clen, cil)
			os.Remove(stazeny)
			if err != nil {
				return fmt.Errorf("%s: %w", s.Nazev, err)
			}
		}
		hotovo += s.Velikost
	}
	if prubeh != nil && celkem > 0 {
		prubeh(Prubeh{Hotovo: celkem, Celkem: celkem})
	}
	return nil
}

// Smazat odstraní stažené soubory i rozstažené zbytky (vypnutí funkce s uvolněním místa)
func Smazat(slozka string) error {
	var chyba error
	for _, s := range Soubory {
		for _, n := range []string{s.Nazev, s.Nazev + pripona, filepath.Base(s.Adresa), filepath.Base(s.Adresa) + pripona} {
			if err := os.Remove(filepath.Join(slozka, n)); err != nil && !errors.Is(err, os.ErrNotExist) {
				chyba = err
			}
		}
	}
	return chyba
}

// Stahnout stáhne adresu do souboru cil po blocích, hlásí průběh (hotovo, celkem; celkem 0 = neznámé) a ověří
// SHA-256. Rozstažený soubor (cil + ".castecne") po přerušení zůstane a příští volání naváže hlavičkou Range;
// když server Range neumí, začne se znovu. Konečný název dostane soubor až po ověření.
func Stahnout(ctx context.Context, klient *http.Client, adresa, cil, hash string, prubeh func(hotovo, celkem int64)) error {
	if klient == nil {
		klient = http.DefaultClient
	}
	castecny := cil + pripona
	f, err := os.OpenFile(castecny, os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	uz, err := f.Seek(0, io.SeekEnd)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, adresa, nil)
	if err != nil {
		return err
	}
	if uz > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", uz))
	}
	odp, err := klient.Do(req)
	if err != nil {
		return err
	}
	defer odp.Body.Close()
	switch {
	case odp.StatusCode == http.StatusPartialContent && uz > 0:
	case odp.StatusCode == http.StatusRequestedRangeNotSatisfiable && uz > 0:
		// Soubor je celý stažený (přerušilo se až ověření) – ověří se níž
		odp.Body.Close()
		return dokoncit(f, castecny, cil, hash)
	case odp.StatusCode == http.StatusOK:
		// Server Range neumí nebo nic rozstaženého nebylo – začít od začátku
		if uz > 0 {
			if err := f.Truncate(0); err != nil {
				return err
			}
			if _, err := f.Seek(0, io.SeekStart); err != nil {
				return err
			}
			uz = 0
		}
	default:
		return fmt.Errorf("stahování: server odpověděl %s", odp.Status)
	}
	var celkem int64
	if odp.ContentLength > 0 {
		celkem = uz + odp.ContentLength
		if celkem > nejvetsiSoubor {
			return fmt.Errorf("stahování: soubor je nečekaně velký (%d B)", celkem)
		}
	}
	hotovo := uz
	var naposledy time.Time
	buf := make([]byte, blok)
	for {
		n, cteni := odp.Body.Read(buf)
		if n > 0 {
			if _, err := f.Write(buf[:n]); err != nil {
				return err
			}
			hotovo += int64(n)
			if hotovo > nejvetsiSoubor {
				return fmt.Errorf("stahování: soubor je nečekaně velký (přes %d B)", hotovo)
			}
			if prubeh != nil && time.Since(naposledy) >= intervalPrubehu {
				prubeh(hotovo, celkem)
				naposledy = time.Now()
			}
		}
		if cteni == io.EOF {
			break
		}
		if cteni != nil {
			return cteni // rozstažený soubor zůstane, příště se naváže
		}
	}
	if celkem > 0 && hotovo != celkem {
		return fmt.Errorf("stahování: spojení skončilo po %d z %d B", hotovo, celkem)
	}
	if prubeh != nil {
		prubeh(hotovo, celkem)
	}
	return dokoncit(f, castecny, cil, hash)
}

// Zapíše soubor na disk, ověří hash a přejmenuje na konečný název; při neshodě rozstažený soubor smaže
func dokoncit(f *os.File, castecny, cil, hash string) error {
	if err := f.Sync(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	spocitany, err := Sha256Souboru(castecny)
	if err != nil {
		return err
	}
	if spocitany != hash {
		os.Remove(castecny)
		return ErrHash
	}
	return os.Rename(castecny, cil)
}

// Sha256Souboru: kontrolní součet souboru jako malá šestnáctková čísla
func Sha256Souboru(cesta string) (string, error) {
	f, err := os.Open(cesta)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// Vybalí z archivu .tgz jediný soubor (clen) jako cil; ostatní obsah archivu se přeskočí
func vybalit(archiv, clen, cil string) error {
	f, err := os.Open(archiv)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			return fmt.Errorf("v archivu chybí %s", clen)
		}
		if err != nil {
			return err
		}
		if h.Name != clen || h.Typeflag != tar.TypeReg {
			continue
		}
		if h.Size > nejvetsiSoubor {
			return fmt.Errorf("%s je v archivu nečekaně velký", clen)
		}
		docasny := cil + pripona
		o, err := os.OpenFile(docasny, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		if _, err := io.Copy(o, io.LimitReader(tr, h.Size)); err != nil {
			o.Close()
			os.Remove(docasny)
			return err
		}
		if err := o.Close(); err != nil {
			os.Remove(docasny)
			return err
		}
		return os.Rename(docasny, cil)
	}
}
