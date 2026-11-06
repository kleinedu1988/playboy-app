package obsah

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func data(n int) []byte {
	b := make([]byte, n)
	for i := range b {
		b[i] = byte(i*7 + i/251)
	}
	return b
}

func hashOf(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// Server s podporou Range (http.ServeContent); počítá požadavky s hlavičkou Range
func serverSRange(t *testing.T, obsah []byte, rozsahy *atomic.Int32) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Range") != "" && rozsahy != nil {
			rozsahy.Add(1)
		}
		http.ServeContent(w, r, "soubor", time.Time{}, bytes.NewReader(obsah))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestStahnoutCelyAOveritHash(t *testing.T) {
	obsah := data(3*blok + 123)
	srv := serverSRange(t, obsah, nil)
	cil := filepath.Join(t.TempDir(), "model.onnx")
	var posledni, celkem int64
	if err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, hashOf(obsah), func(h, c int64) { posledni, celkem = h, c }); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(cil)
	if !bytes.Equal(got, obsah) {
		t.Fatal("stažený obsah nesouhlasí")
	}
	if posledni != int64(len(obsah)) || celkem != int64(len(obsah)) {
		t.Fatalf("poslední průběh %d/%d, čekáno %d", posledni, celkem, len(obsah))
	}
	if _, err := os.Stat(cil + pripona); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("rozstažený soubor po dokončení zůstal")
	}
	if i, _ := os.Stat(cil); i.Mode().Perm() != 0o600 {
		t.Fatalf("práva souboru %v, čekáno 0600", i.Mode().Perm())
	}
}

func TestStahnoutNavazePoPreruseni(t *testing.T) {
	obsah := data(2*blok + 77)
	var rozsahy atomic.Int32
	srv := serverSRange(t, obsah, &rozsahy)
	cil := filepath.Join(t.TempDir(), "model.onnx")
	if err := os.WriteFile(cil+pripona, obsah[:blok+5], 0o600); err != nil {
		t.Fatal(err)
	}
	var prvni int64 = -1
	if err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, hashOf(obsah), func(h, _ int64) {
		if prvni < 0 {
			prvni = h
		}
	}); err != nil {
		t.Fatal(err)
	}
	if rozsahy.Load() != 1 {
		t.Fatalf("požadavků s Range %d, čekán 1", rozsahy.Load())
	}
	if prvni <= int64(blok+5) {
		t.Fatalf("průběh nezačal od rozstažené části (%d)", prvni)
	}
	got, _ := os.ReadFile(cil)
	if !bytes.Equal(got, obsah) {
		t.Fatal("navázaný soubor nesouhlasí")
	}
}

func TestStahnoutServerBezRangeZacneZnovu(t *testing.T) {
	obsah := data(blok + 10)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(obsah) // Range ignoruje, vždy 200 s celým souborem
	}))
	defer srv.Close()
	cil := filepath.Join(t.TempDir(), "model.onnx")
	os.WriteFile(cil+pripona, []byte("cizí začátek"), 0o600)
	if err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, hashOf(obsah), nil); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(cil)
	if !bytes.Equal(got, obsah) {
		t.Fatal("soubor po novém začátku nesouhlasí")
	}
}

func TestStahnoutCelyRozstazenyJenOveri(t *testing.T) {
	obsah := data(1000)
	srv := serverSRange(t, obsah, nil)
	cil := filepath.Join(t.TempDir(), "model.onnx")
	os.WriteFile(cil+pripona, obsah, 0o600) // server odpoví 416
	if err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, hashOf(obsah), nil); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(cil); !bytes.Equal(got, obsah) {
		t.Fatal("soubor nesouhlasí")
	}
}

func TestStahnoutSpatnyHashSmazeSoubor(t *testing.T) {
	obsah := data(5000)
	srv := serverSRange(t, obsah, nil)
	cil := filepath.Join(t.TempDir(), "model.onnx")
	err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, hashOf([]byte("jiný")), nil)
	if !errors.Is(err, ErrHash) {
		t.Fatalf("čekána ErrHash, je %v", err)
	}
	for _, p := range []string{cil, cil + pripona} {
		if _, err := os.Stat(p); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("%s po špatném hashi zůstal", filepath.Base(p))
		}
	}
}

func TestStahnoutChybaServeru(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	defer srv.Close()
	cil := filepath.Join(t.TempDir(), "model.onnx")
	err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, "x", nil)
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("čekána chyba 404, je %v", err)
	}
	if _, err := os.Stat(cil); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("po chybě vznikl konečný soubor")
	}
}

func TestStahnoutPreruseneSpojeniNecháRozstazene(t *testing.T) {
	obsah := data(4 * blok)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1048576")
		w.Write(obsah[:blok]) // polovina a konec spojení
	}))
	defer srv.Close()
	cil := filepath.Join(t.TempDir(), "model.onnx")
	if err := Stahnout(context.Background(), srv.Client(), srv.URL, cil, hashOf(obsah), nil); err == nil {
		t.Fatal("čekána chyba přerušeného spojení")
	}
	i, err := os.Stat(cil + pripona)
	if err != nil || i.Size() != int64(blok) {
		t.Fatalf("rozstažený soubor má zůstat s %d B: %v %v", blok, i, err)
	}
}

func TestStahnoutZruseni(t *testing.T) {
	ctx, zrusit := context.WithCancel(context.Background())
	zrusit()
	srv := serverSRange(t, data(100), nil)
	if err := Stahnout(ctx, srv.Client(), srv.URL, filepath.Join(t.TempDir(), "m"), "x", nil); !errors.Is(err, context.Canceled) {
		t.Fatalf("čekáno context.Canceled, je %v", err)
	}
}

func tgz(t *testing.T, soubory map[string][]byte) []byte {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for n, b := range soubory {
		if err := tw.WriteHeader(&tar.Header{Name: n, Mode: 0o644, Size: int64(len(b)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		tw.Write(b)
	}
	tw.Close()
	gz.Close()
	return buf.Bytes()
}

func TestPripravitModelAKnihovnuZArchivu(t *testing.T) {
	model := data(blok + 1)
	knihovna := data(3000)
	archiv := tgz(t, map[string][]byte{"ort/lib/libonnxruntime.so.1": knihovna, "ort/README": []byte("x")})
	mux := http.NewServeMux()
	mux.HandleFunc("/model.onnx", func(w http.ResponseWriter, r *http.Request) {
		http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(model))
	})
	mux.HandleFunc("/ort.tgz", func(w http.ResponseWriter, r *http.Request) {
		http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(archiv))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	puvodni := Soubory
	t.Cleanup(func() { Soubory = puvodni })
	Soubory = []Soubor{
		{Nazev: "model.onnx", Adresa: srv.URL + "/model.onnx", Hash: hashOf(model), Velikost: int64(len(model))},
		{Nazev: "libonnxruntime.so", Adresa: srv.URL + "/ort.tgz", Hash: hashOf(archiv), Velikost: int64(len(archiv)), Clen: "ort/lib/libonnxruntime.so.1"},
	}
	slozka := filepath.Join(t.TempDir(), "obsah")
	if Pripraveno(slozka) {
		t.Fatal("prázdná složka nemá být připravená")
	}
	var posledni Prubeh
	var klesl bool
	if err := Pripravit(context.Background(), srv.Client(), slozka, func(p Prubeh) {
		if p.Hotovo < posledni.Hotovo {
			klesl = true
		}
		posledni = p
	}); err != nil {
		t.Fatal(err)
	}
	if klesl {
		t.Fatal("průběh nesmí klesat")
	}
	if want := int64(len(model) + len(archiv)); posledni.Hotovo != want || posledni.Celkem != want {
		t.Fatalf("konečný průběh %+v, čekáno %d", posledni, want)
	}
	if !Pripraveno(slozka) {
		t.Fatal("po přípravě má být připraveno")
	}
	if got, _ := os.ReadFile(filepath.Join(slozka, "libonnxruntime.so")); !bytes.Equal(got, knihovna) {
		t.Fatal("knihovna z archivu nesouhlasí")
	}
	if _, err := os.Stat(filepath.Join(slozka, "ort.tgz")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("archiv po vybalení zůstal")
	}
	if i, _ := os.Stat(slozka); i.Mode().Perm() != 0o700 {
		t.Fatalf("práva složky %v, čekáno 0700", i.Mode().Perm())
	}

	// Druhé volání nic nestahuje
	srv.Close()
	if err := Pripravit(context.Background(), nil, slozka, nil); err != nil {
		t.Fatalf("hotová složka nemá nic stahovat: %v", err)
	}
	if err := Smazat(slozka); err != nil {
		t.Fatal(err)
	}
	if Pripraveno(slozka) {
		t.Fatal("po smazání nemá být připraveno")
	}
}

func TestPripravitChybiClenArchivu(t *testing.T) {
	archiv := tgz(t, map[string][]byte{"jiny": []byte("x")})
	srv := serverSRange(t, archiv, nil)
	puvodni := Soubory
	t.Cleanup(func() { Soubory = puvodni })
	Soubory = []Soubor{{Nazev: "lib.so", Adresa: srv.URL + "/a.tgz", Hash: hashOf(archiv), Velikost: int64(len(archiv)), Clen: "ort/lib.so"}}
	slozka := t.TempDir()
	if err := Pripravit(context.Background(), srv.Client(), slozka, nil); err == nil || !strings.Contains(err.Error(), "chybí") {
		t.Fatalf("čekána chyba chybějícího souboru v archivu, je %v", err)
	}
	if _, err := os.Stat(filepath.Join(slozka, "lib.so")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("bez souboru v archivu nemá vzniknout knihovna")
	}
}

// Vestavěné soubory: pevné revize a hashe (změna je vědomé rozhodnutí, viz docs/MODEL-CLIP-B32.md)
func TestVestaveneSouboryMajiPevnouRevizi(t *testing.T) {
	for _, s := range Soubory {
		if len(s.Hash) != 64 || strings.ToLower(s.Hash) != s.Hash {
			t.Errorf("%s: hash musí být SHA-256 malými písmeny", s.Nazev)
		}
		if strings.Contains(s.Adresa, "/main/") || strings.Contains(s.Adresa, "latest") {
			t.Errorf("%s: adresa musí mít pevnou revizi: %s", s.Nazev, s.Adresa)
		}
		if !strings.HasPrefix(s.Adresa, "https://") || s.Velikost <= 0 {
			t.Errorf("%s: adresa přes https a známá velikost", s.Nazev)
		}
	}
}
