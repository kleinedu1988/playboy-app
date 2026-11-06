package nahledy

// Místní mezipaměť náhledů z Google Disku. Okno chce obrázky na adrese /nahled/<ID souboru>/<velikost>; obsluha
// (assetserver.Options.Handler v main.go – dostane, co není mezi soubory rozhraní) malé velikosti (karta w400,
// plakát w600) čte ze souboru na disku a napoprvé je stáhne z Disku a uloží, ostatní velikosti jen propustí.
// Náhled se tak po prvním zobrazení ukáže hned a i bez připojení; WebKit si obrázky z Disku pamatuje jen 24 hodin.
// Soubory jsou v ~/.cache/<program>/nahledy/<2 znaky ID>/<ID>_<velikost> (složky 0700, soubory 0600 jako databáze).
// Do databáze náhledy nepatří: zálohy kopírují celý soubor sbírky.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Největší náhled, který se ještě uloží (w600 z Disku ~70 kB; obrana proti chybné odpovědi)
const nejvetsiNahled = 4 << 20

// Souběh stahování pro okno: Disk odpovídá ~250 ms na obrázek, při 16 souběžných se 48 karet načte za ~0,6 s
const soubehNahledu = 16

// Na pozadí ohleduplně k limitům Googlu: 3 najednou, ~4600 titulních fotek a plakátů sbírky za 3–6 minut
const soubehNahleduNaPozadi = 3

// Výchozí limit mezipaměti náhledů na disku; nad ním se mažou nejdéle nepoužité (titulní fotky a plakáty celé sbírky
// 3000 modelek zaberou ~250 MB, každá prohlédnutá fotka ~40 kB)
const LimitDisku = 1 << 30

var (
	errNahledNedostupny = errors.New("soubor na Disku není dostupný")         // 403/404/HTML místo obrázku
	errNahledDocasne    = errors.New("Disk teď neodpovídá, zkusí se později") // výpadek sítě, 429, 5xx
)

// Stav stahování náhledů celé sbírky na pozadí
type StavStahovani struct {
	Bezi   bool `json:"bezi"`
	Hotovo int  `json:"hotovo"` // zpracováno (staženo, už uloženo nebo na Disku nedostupné)
	Celkem int  `json:"celkem"`
}

// Položka ke stažení na pozadí (ID souboru na Disku a požadovaná velikost, např. w400 nebo w600)
type Polozka struct {
	ID       string
	Velikost string
}

type stahovaniNaPozadi struct {
	mu             sync.Mutex
	zrusit         context.CancelFunc
	hotovo, celkem atomic.Int64
	bezi           atomic.Bool
}

// Místní mezipaměť náhledů z Google Disku
type Mezipamet struct {
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
	pozadiStav  stahovaniNaPozadi

	zasahy, stazeno, propusteno, chyby atomic.Int64
}

type stahovaniNahledu struct {
	hotovo chan struct{}
	data   []byte
	typ    string
	err    error
}

// Celý text je holé ID z Disku (alespoň 25 znaků a-z, A-Z, 0-9, _ nebo -)
func JeHoleID(text string) bool {
	if len(text) < 25 {
		return false
	}
	for i := 0; i < len(text); i++ {
		if z := text[i]; !(z >= 'a' && z <= 'z' || z >= 'A' && z <= 'Z' || z >= '0' && z <= '9' || z == '_' || z == '-') {
			return false
		}
	}
	return true
}

// Platné označení velikosti náhledu ([whs][0-9]{1,4}) bez regulárního výrazu
func jeVelikostNahledu(s string) bool {
	if len(s) < 2 || len(s) > 5 {
		return false
	}
	if z := s[0]; z != 'w' && z != 'h' && z != 's' {
		return false
	}
	for i := 1; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// Složka náhledů vedle mezipaměti WebKitu (VymazatMezipamet); prázdná, když domovská složka není známá
func Slozka() string {
	zaklad, err := os.UserCacheDir()
	if err != nil {
		return ""
	}
	return filepath.Join(zaklad, filepath.Base(os.Args[0]), "nahledy")
}

func Nova(slozka string, adresa func(id, velikost string) string) *Mezipamet {
	return &Mezipamet{
		slozka:      slozka,
		adresa:      adresa,
		klient:      klientNahledu(),
		ukladat:     map[string]bool{"w400": true, "w600": true},
		soubeh:      make(chan struct{}, soubehNahledu),
		pozadi:      make(chan struct{}, soubehNahleduNaPozadi),
		probihajici: map[string]*stahovaniNahledu{},
	}
}

func (m *Mezipamet) Cesta(id, velikost string) string {
	return filepath.Join(m.slozka, id[:2], id+"_"+velikost)
}

func (m *Mezipamet) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	cesta, ok := strings.CutPrefix(r.URL.Path, "/nahled/")
	if !ok {
		http.NotFound(w, r)
		return
	}
	id, velikost, ok := strings.Cut(cesta, "/")
	if !ok || !JeHoleID(id) || !jeVelikostNahledu(velikost) {
		http.NotFound(w, r)
		return
	}
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

func (m *Mezipamet) odpovedet(w http.ResponseWriter, data []byte, typ string) {
	w.Header().Set("Content-Type", typ)
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	// Náhled k ID se nemění
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Write(data)
}

func (m *Mezipamet) precist(id, velikost string) ([]byte, error) {
	p := m.Cesta(id, velikost)
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	data := make([]byte, info.Size())
	_, err = io.ReadFull(f, data)
	f.Close()
	if err != nil {
		return nil, err
	}
	// Čas použití pro úklid nad limitem: obnoví se nejvýš jednou denně (nezávisí na noatime)
	if time.Since(info.ModTime()) > 24*time.Hour {
		now := time.Now()
		os.Chtimes(p, now, now)
	}
	return data, nil
}

// Jedno stažení na ID a velikost, i když o ně okno žádá víckrát najednou
func (m *Mezipamet) stahnout(id, velikost string, soubeh chan struct{}) ([]byte, string, error) {
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
		if err := m.Ulozit(id, velikost, s.data); err != nil {
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

func (m *Mezipamet) bezSite() bool {
	ted := time.Now().UnixNano()
	if ted >= m.bezSiteDo.Load() {
		return false
	}
	posledni := m.zkouska.Load()
	return ted-posledni < int64(zkouskaSite) || !m.zkouska.CompareAndSwap(posledni, ted)
}

func (m *Mezipamet) chybaSite() {
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

func (m *Mezipamet) zDisku(id, velikost string) ([]byte, string, error) {
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
func (m *Mezipamet) Ulozit(id, velikost string, data []byte) error {
	cil := m.Cesta(id, velikost)
	if err := os.MkdirAll(filepath.Dir(cil), 0o700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(cil), ".tmp-*")
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
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
func (m *Mezipamet) propustit(w http.ResponseWriter, id, velikost string) {
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

// Úklid: smaže náhledy souborů, které už ve sbírce nejsou (platne), zbytky přerušených zápisů a nad limitem
// nejdéle nepoužité (podle času změny, precist ho obnovuje). Vrací, kolik souborů a bajtů zůstalo.
func (m *Mezipamet) Uklid(platne func(id string) bool, limit int64) (souboru int, bajtu int64) {
	if m == nil || m.slozka == "" {
		return 0, 0
	}
	type soubor struct {
		cesta string
		vel   int64
		cas   time.Time
	}
	vse := make([]soubor, 0, 512)
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
func (m *Mezipamet) Vymazat() (int64, error) {
	if m == nil || m.slozka == "" {
		return 0, nil
	}
	velikost := VelikostSlozky(m.slozka)
	return velikost, os.RemoveAll(m.slozka)
}

func VelikostSlozky(slozka string) int64 {
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

// Pauza stahování na pozadí po odmítnutí Diskem (429/5xx): podle Retry-After, jinak 30 s
func pauzaPoOdmitnuti(resp *http.Response) time.Duration {
	if s, err := time.ParseDuration(resp.Header.Get("Retry-After") + "s"); err == nil && s > 0 && s < 10*time.Minute {
		return s
	}
	return 30 * time.Second
}

// Stažení chybějících náhledů na pozadí v daném pořadí: nejvýš 3 souběžně, ustoupí, dokud okno samo stahuje,
// a po odmítnutí Diskem počká. hotovo dostane každou zpracovanou položku (stažená, už uložená, nedostupná).
// Skončí po projití seznamu nebo zrušením ctx.
func (m *Mezipamet) Predstahnout(ctx context.Context, polozky []Polozka, hotovo func()) {
	var cekani sync.WaitGroup
	fronta := make(chan Polozka)
	for range cap(m.pozadi) {
		cekani.Add(1)
		go func() {
			defer cekani.Done()
			for p := range fronta {
				m.pockatNaKlid(ctx)
				if ctx.Err() != nil {
					continue
				}
				m.stahnout(p.ID, p.Velikost, m.pozadi)
				hotovo()
			}
		}()
	}
	for _, p := range polozky {
		if ctx.Err() != nil {
			break
		}
		if _, err := os.Stat(m.Cesta(p.ID, p.Velikost)); err == nil {
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

func (m *Mezipamet) pockatNaKlid(ctx context.Context) {
	if ctx.Err() != nil || (m.aktivniOkno.Load() == 0 && time.Now().UnixNano() >= m.pauzaDo.Load()) {
		return
	}
	t := time.NewTicker(100 * time.Millisecond)
	defer t.Stop()
	for ctx.Err() == nil {
		if m.aktivniOkno.Load() == 0 && time.Now().UnixNano() >= m.pauzaDo.Load() {
			return
		}
		select {
		case <-t.C:
		case <-ctx.Done():
		}
	}
}

// Nacist vrátí uložený náhled, nebo ho stáhne ohleduplně jako stahování na pozadí (souběh 3, ustoupí oknu,
// po odmítnutí Diskem počká) a uloží. Pro výpočet obsahu fotek (internal/obsah); bez mezipaměti jen stáhne.
func (m *Mezipamet) Nacist(ctx context.Context, id, velikost string) ([]byte, error) {
	if !JeHoleID(id) || !jeVelikostNahledu(velikost) {
		return nil, errNahledNedostupny
	}
	ukladat := m.slozka != "" && m.ukladat[velikost]
	if ukladat {
		if data, err := m.precist(id, velikost); err == nil {
			return data, nil
		}
	}
	m.pockatNaKlid(ctx)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if !ukladat {
		data, _, err := m.zDisku(id, velikost)
		return data, err
	}
	data, _, err := m.stahnout(id, velikost, m.pozadi)
	return data, err
}

// Nedostupny: náhled na Disku není (soubor smazaný nebo bez přístupu), zkoušet znovu nemá smysl
func Nedostupny(err error) bool {
	return errors.Is(err, errNahledNedostupny)
}

// Spustí stahování na pozadí (už běžící nechá běžet); false bez mezipaměti náhledů
func (m *Mezipamet) SpustitPozadi(nacistPolozky func() []Polozka) bool {
	if m == nil || m.slozka == "" {
		return false
	}
	p := &m.pozadiStav
	p.mu.Lock()
	if p.bezi.Load() {
		p.mu.Unlock()
		return true
	}
	p.bezi.Store(true)
	p.hotovo.Store(0)
	p.celkem.Store(0)
	ctx, zrusit := context.WithCancel(context.Background())
	p.zrusit = zrusit
	p.mu.Unlock()

	polozky := nacistPolozky()
	p.celkem.Store(int64(len(polozky)))
	go func() {
		defer p.bezi.Store(false)
		m.Predstahnout(ctx, polozky, func() { p.hotovo.Add(1) })
	}()
	return true
}

// Zastaví běžící stahování náhledů na pozadí
func (m *Mezipamet) ZastavitPozadi() {
	if m == nil {
		return
	}
	p := &m.pozadiStav
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.zrusit != nil {
		p.zrusit()
	}
}

// Vrátí aktuální stav stahování náhledů na pozadí
func (m *Mezipamet) StavPozadi() StavStahovani {
	if m == nil {
		return StavStahovani{}
	}
	p := &m.pozadiStav
	return StavStahovani{Bezi: p.bezi.Load(), Hotovo: int(p.hotovo.Load()), Celkem: int(p.celkem.Load())}
}
