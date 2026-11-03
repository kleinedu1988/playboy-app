package main

// Místní mezipaměť náhledů z Google Disku. Okno chce obrázky na adrese /nahled/<ID souboru>/<velikost>; obsluha
// (assetserver.Options.Handler v main.go – dostane, co není mezi soubory rozhraní) malé velikosti (karta w400,
// plakát w600) čte ze souboru na disku a napoprvé je stáhne z Disku a uloží, ostatní velikosti jen propustí.
// Náhled se tak po prvním zobrazení ukáže hned a i bez připojení; WebKit si obrázky z Disku pamatuje jen 24 hodin.
// Soubory jsou v ~/.cache/<program>/nahledy/<2 znaky ID>/<ID>_<velikost> (složky 0700, soubory 0600 jako databáze).
// Do databáze náhledy nepatří: zálohy kopírují celý soubor sbírky.

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var vzorVelikostiNahledu = regexp.MustCompile(`^[whs][0-9]{1,4}$`)

// Největší náhled, který se ještě uloží (w600 z Disku ~70 kB; obrana proti chybné odpovědi)
const nejvetsiNahled = 4 << 20

// Souběh stahování pro okno: Disk odpovídá ~250 ms na obrázek, při 16 souběžných se 48 karet načte za ~0,6 s
const soubehNahledu = 16

// Na pozadí ohleduplně k limitům Googlu: 3 najednou, ~4600 titulních fotek a plakátů sbírky za 3–6 minut
const soubehNahleduNaPozadi = 3

var (
	errNahledNedostupny = errors.New("soubor na Disku není dostupný")         // 403/404/HTML místo obrázku
	errNahledDocasne    = errors.New("Disk teď neodpovídá, zkusí se později") // výpadek sítě, 429, 5xx
)

type mezipametNahledu struct {
	slozka  string
	adresa  func(id, velikost string) string // adresa na Disku podle šablony
	klient  *http.Client
	ukladat map[string]bool // velikosti, které se ukládají na disk

	soubeh      chan struct{}
	pozadi      chan struct{} // souběh stahování na pozadí
	aktivniOkno atomic.Int32  // kolik náhledů právě stahuje okno (pozadí zatím počká)
	pauzaDo     atomic.Int64  // unix ns: do kdy pozadí čeká (po 429/5xx a bez připojení)
	bezSiteDo   atomic.Int64  // unix ns: do kdy se má za to, že není připojení (okno nečeká na vypršení spojení)
	zkouska     atomic.Int64  // unix ns: kdy naposledy šel bez připojení jeden požadavek vyzkoušet, jestli se vrátilo
	mu          sync.Mutex
	probihajici map[string]*stahovaniNahledu

	zasahy, stazeno, propusteno, chyby atomic.Int64
}

type stahovaniNahledu struct {
	hotovo chan struct{}
	data   []byte
	typ    string
	err    error
}

// Složka náhledů vedle mezipaměti WebKitu (VymazatMezipamet); prázdná, když domovská složka není známá
func slozkaNahledu() string {
	zaklad, err := os.UserCacheDir()
	if err != nil {
		return ""
	}
	return filepath.Join(zaklad, filepath.Base(os.Args[0]), "nahledy")
}

func novaMezipametNahledu(slozka string, adresa func(id, velikost string) string) *mezipametNahledu {
	return &mezipametNahledu{
		slozka:      slozka,
		adresa:      adresa,
		klient:      klientNahledu(),
		ukladat:     map[string]bool{"w400": true, "w600": true},
		soubeh:      make(chan struct{}, soubehNahledu),
		pozadi:      make(chan struct{}, soubehNahleduNaPozadi),
		probihajici: map[string]*stahovaniNahledu{},
	}
}

// Adresa náhledu na Disku podle šablony obrázků (stejná jako dřív v okně)
func adresaNahleduNaDisku(id, velikost string) string {
	return strings.ReplaceAll(adresaObrazkuNaDisku(id), "{velikost}", velikost)
}

func (m *mezipametNahledu) cesta(id, velikost string) string {
	return filepath.Join(m.slozka, id[:2], id+"_"+velikost)
}

func (m *mezipametNahledu) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	casti := strings.Split(strings.TrimPrefix(r.URL.Path, "/nahled/"), "/")
	if !strings.HasPrefix(r.URL.Path, "/nahled/") || len(casti) != 2 || !jeHoleID(casti[0]) || !vzorVelikostiNahledu.MatchString(casti[1]) {
		http.NotFound(w, r)
		return
	}
	id, velikost := casti[0], casti[1]
	if !m.ukladat[velikost] || m.slozka == "" {
		m.propustit(w, id, velikost)
		return
	}
	if data, err := m.precist(id, velikost); err == nil {
		m.zasahy.Add(1)
		m.odpovedet(w, data, http.DetectContentType(data))
		return
	}
	m.aktivniOkno.Add(1)
	data, typ, err := m.stahnout(id, velikost, m.soubeh)
	m.aktivniOkno.Add(-1)
	switch {
	case errors.Is(err, errNahledNedostupny):
		http.Error(w, err.Error(), http.StatusNotFound)
	case err != nil:
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
	default:
		m.odpovedet(w, data, typ)
	}
}

func (m *mezipametNahledu) odpovedet(w http.ResponseWriter, data []byte, typ string) {
	w.Header().Set("Content-Type", typ)
	w.Header().Set("Content-Length", fmt.Sprint(len(data)))
	// Náhled k ID se nemění
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Write(data)
}

func (m *mezipametNahledu) precist(id, velikost string) ([]byte, error) {
	p := m.cesta(id, velikost)
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	// Čas použití pro úklid nad limitem: obnoví se nejvýš jednou denně (nezávisí na noatime)
	if info, err := os.Stat(p); err == nil && time.Since(info.ModTime()) > 24*time.Hour {
		now := time.Now()
		os.Chtimes(p, now, now)
	}
	return data, nil
}

// Jedno stažení na ID a velikost, i když o ně okno žádá víckrát najednou
func (m *mezipametNahledu) stahnout(id, velikost string, soubeh chan struct{}) ([]byte, string, error) {
	klic := id + "_" + velikost
	m.mu.Lock()
	if s, ok := m.probihajici[klic]; ok {
		m.mu.Unlock()
		<-s.hotovo
		return s.data, s.typ, s.err
	}
	s := &stahovaniNahledu{hotovo: make(chan struct{})}
	m.probihajici[klic] = s
	m.mu.Unlock()
	defer func() {
		m.mu.Lock()
		delete(m.probihajici, klic)
		m.mu.Unlock()
		close(s.hotovo)
	}()

	soubeh <- struct{}{}
	defer func() { <-soubeh }()

	s.data, s.typ, s.err = m.zDisku(id, velikost)
	if s.err == nil {
		m.stazeno.Add(1)
		if err := m.ulozit(id, velikost, s.data); err != nil {
			m.chyby.Add(1) // náhled se ukáže, jen se neuloží
		}
	} else {
		m.chyby.Add(1)
	}
	return s.data, s.typ, s.err
}

// Bez připojení: po chybě sítě se dalších 30 s nestahuje (okno hned dostane chybu a ukáže „Nenačteno“, pozadí
// počká); jednou za 2 s jde jeden požadavek vyzkoušet, jestli se připojení vrátilo, a úspěch omezení zruší
const (
	trvaniBezSite = 30 * time.Second
	zkouskaSite   = 2 * time.Second
)

func (m *mezipametNahledu) bezSite() bool {
	ted := time.Now().UnixNano()
	if ted >= m.bezSiteDo.Load() {
		return false
	}
	posledni := m.zkouska.Load()
	return ted-posledni < int64(zkouskaSite) || !m.zkouska.CompareAndSwap(posledni, ted)
}

func (m *mezipametNahledu) chybaSite() {
	ted := time.Now()
	do := ted.Add(trvaniBezSite).UnixNano()
	m.zkouska.Store(ted.UnixNano())
	m.bezSiteDo.Store(do)
	if m.pauzaDo.Load() < do {
		m.pauzaDo.Store(do)
	}
}

// Klient s kratšími mezemi pro spojení: bez sítě se nečeká 20 s na každý obrázek
func klientNahledu() *http.Client {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.DialContext = (&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}).DialContext
	t.TLSHandshakeTimeout = 5 * time.Second
	t.ResponseHeaderTimeout = 15 * time.Second
	t.MaxIdleConnsPerHost = soubehNahledu
	return &http.Client{Timeout: 20 * time.Second, Transport: t}
}

func (m *mezipametNahledu) zDisku(id, velikost string) ([]byte, string, error) {
	if m.bezSite() {
		return nil, "", fmt.Errorf("%w: bez připojení", errNahledDocasne)
	}
	resp, err := m.klient.Get(m.adresa(id, velikost))
	if err != nil {
		m.chybaSite()
		return nil, "", fmt.Errorf("%w: %v", errNahledDocasne, err)
	}
	m.bezSiteDo.Store(0)
	defer resp.Body.Close()
	typ := resp.Header.Get("Content-Type")
	switch {
	case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500:
		m.pauzaDo.Store(time.Now().Add(pauzaPoOdmitnuti(resp)).UnixNano())
		return nil, "", fmt.Errorf("%w: HTTP %d", errNahledDocasne, resp.StatusCode)
	case resp.StatusCode != http.StatusOK || !strings.HasPrefix(typ, "image/"):
		return nil, "", errNahledNedostupny
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, nejvetsiNahled+1))
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", errNahledDocasne, err)
	}
	if len(data) > nejvetsiNahled {
		return nil, "", errNahledNedostupny
	}
	return data, typ, nil
}

// Zápis přes dočasný soubor a přejmenování: žádný napůl zapsaný náhled; soubory 0600, složky 0700
func (m *mezipametNahledu) ulozit(id, velikost string, data []byte) error {
	cil := m.cesta(id, velikost)
	if err := os.MkdirAll(filepath.Dir(cil), 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(cil), ".tmp-*")
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, bytes.NewReader(data)); err != nil {
		f.Close()
		os.Remove(f.Name())
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(f.Name())
		return err
	}
	return os.Rename(f.Name(), cil) // CreateTemp zakládá soubor s právy 0600
}

// Velikosti, které se neukládají (w800, w1200, s0): jen se propustí z Disku
func (m *mezipametNahledu) propustit(w http.ResponseWriter, id, velikost string) {
	m.propusteno.Add(1)
	if m.bezSite() {
		http.Error(w, "bez připojení", http.StatusServiceUnavailable)
		return
	}
	resp, err := m.klient.Get(m.adresa(id, velikost))
	if err != nil {
		m.chybaSite()
		http.Error(w, "Disk neodpovídá", http.StatusServiceUnavailable)
		return
	}
	m.bezSiteDo.Store(0)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		http.Error(w, "nedostupné", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("Cache-Control", "private, max-age=86400")
	io.Copy(w, resp.Body)
}

// Výchozí limit mezipaměti náhledů na disku; nad ním se mažou nejdéle nepoužité (titulní fotky a plakáty celé sbírky
// 3000 modelek zaberou ~250 MB, každá prohlédnutá fotka ~40 kB)
const limitNahledu = 1 << 30

// Úklid: smaže náhledy souborů, které už ve sbírce nejsou (platne), zbytky přerušených zápisů a nad limitem
// nejdéle nepoužité (podle času změny, precist ho obnovuje). Vrací, kolik souborů a bajtů zůstalo.
func (m *mezipametNahledu) uklid(platne func(id string) bool, limit int64) (souboru int, bajtu int64) {
	if m == nil || m.slozka == "" {
		return 0, 0
	}
	type soubor struct {
		cesta string
		vel   int64
		cas   time.Time
	}
	var vse []soubor
	filepath.WalkDir(m.slozka, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		jmeno := d.Name()
		id, _, _ := strings.Cut(jmeno, "_")
		if strings.HasPrefix(jmeno, ".tmp-") || (platne != nil && !platne(id)) {
			os.Remove(p)
			return nil
		}
		if info, err := d.Info(); err == nil {
			vse = append(vse, soubor{p, info.Size(), info.ModTime()})
			bajtu += info.Size()
		}
		return nil
	})
	sort.Slice(vse, func(i, j int) bool { return vse[i].cas.Before(vse[j].cas) })
	for i := 0; limit > 0 && bajtu > limit && i < len(vse); i++ {
		if os.Remove(vse[i].cesta) == nil {
			bajtu -= vse[i].vel
			vse[i].vel = -1
		}
	}
	for _, s := range vse {
		if s.vel >= 0 {
			souboru++
		}
	}
	return souboru, bajtu
}

// Smaže všechny náhledy (Vymazat mezipaměť, změna šablony adres); vrací uvolněné bajty
func (m *mezipametNahledu) vymazat() (int64, error) {
	if m == nil || m.slozka == "" {
		return 0, nil
	}
	velikost := velikostSlozky(m.slozka)
	return velikost, os.RemoveAll(m.slozka)
}

func velikostSlozky(slozka string) int64 {
	var velikost int64
	filepath.WalkDir(slozka, func(_ string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			if info, err := d.Info(); err == nil {
				velikost += info.Size()
			}
		}
		return nil
	})
	return velikost
}

// Úklid náhledů po startu: platná jsou ID fotek a titulních fotek sbírky; když se seznam nepodaří přečíst celý,
// maže se jen nad limitem (nic platného se nesmaže kvůli chybě čtení)
func (a *App) uklidNahledu() {
	if a.nahledy == nil || a.db == nil {
		return
	}
	platne := map[string]bool{}
	radky, err := a.db.Query(`SELECT drive_file_id FROM fotky UNION SELECT drive_cover_id FROM modelky WHERE COALESCE(drive_cover_id, '') <> ''`)
	if err == nil {
		for radky.Next() {
			var id sql.NullString
			if radky.Scan(&id) == nil && id.Valid {
				platne[id.String] = true
			}
		}
		err = radky.Err()
		radky.Close()
	}
	var filtr func(string) bool
	if err == nil && len(platne) > 0 {
		filtr = func(id string) bool { return platne[id] }
	}
	a.nahledy.uklid(filtr, limitNahledu)
}

// Pauza stahování na pozadí po odmítnutí Diskem (429/5xx): podle Retry-After, jinak 30 s
func pauzaPoOdmitnuti(resp *http.Response) time.Duration {
	if s, err := time.ParseDuration(resp.Header.Get("Retry-After") + "s"); err == nil && s > 0 && s < 10*time.Minute {
		return s
	}
	return 30 * time.Second
}

type polozkaNahledu struct{ id, velikost string }

// Stažení chybějících náhledů na pozadí v daném pořadí: nejvýš 3 souběžně, ustoupí, dokud okno samo stahuje,
// a po odmítnutí Diskem počká. hotovo dostane každou zpracovanou položku (stažená, už uložená, nedostupná).
// Skončí po projití seznamu nebo zrušením ctx.
func (m *mezipametNahledu) predstahnout(ctx context.Context, polozky []polozkaNahledu, hotovo func()) {
	var cekani sync.WaitGroup
	fronta := make(chan polozkaNahledu)
	for range cap(m.pozadi) {
		cekani.Add(1)
		go func() {
			defer cekani.Done()
			for p := range fronta {
				m.pockatNaKlid(ctx)
				if ctx.Err() != nil {
					continue
				}
				m.stahnout(p.id, p.velikost, m.pozadi)
				hotovo()
			}
		}()
	}
	for _, p := range polozky {
		if ctx.Err() != nil {
			break
		}
		if _, err := os.Stat(m.cesta(p.id, p.velikost)); err == nil {
			hotovo()
			continue
		}
		select {
		case fronta <- p:
		case <-ctx.Done():
		}
	}
	close(fronta)
	cekani.Wait()
}

func (m *mezipametNahledu) pockatNaKlid(ctx context.Context) {
	for ctx.Err() == nil {
		if m.aktivniOkno.Load() == 0 && time.Now().UnixNano() >= m.pauzaDo.Load() {
			return
		}
		select {
		case <-time.After(100 * time.Millisecond):
		case <-ctx.Done():
		}
	}
}
