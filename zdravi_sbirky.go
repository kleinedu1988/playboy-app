package main

// Zdraví sbírky (karta v Údržbě) a náhled rozdílů před obnovením zálohy. Porovnání čte zálohu jen pro čtení
// a databázi nemění; tabulky se srovnávají po řádcích přes sloupce, které mají obě (starší záloha může mít
// starší schéma).

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"pinup-katalog/internal/nahledy"
	"sort"
	"strings"
	"sync"
	"time"
)

type KategorieRozdilu struct {
	Nazev    string   `json:"nazev"`
	Pribude  int      `json:"pribude"` // obnovením přibude (je v záloze, teď ne)
	Ubude    int      `json:"ubude"`   // obnovením zmizí (teď je, v záloze ne)
	Zmeni    int      `json:"zmeni"`
	Priklady []string `json:"priklady"` // „+ Jméno“, „− Jméno“, „~ Jméno (sloupce)“
}

type RozdilZalohy struct {
	Kategorie []KategorieRozdilu `json:"kategorie"`
	Celkem    int                `json:"celkem"`
	Chyba     string             `json:"chyba"`
}

const pocetPrikladuRozdilu = 8

// Sloupce tabulky v databázi (prázdné = tabulka není)
func sloupceTabulky(db *sql.DB, tabulka string) []string {
	radky, err := db.Query(fmt.Sprintf("PRAGMA table_info(%q)", tabulka))
	if err != nil {
		return nil
	}
	defer radky.Close()
	var v []string
	for radky.Next() {
		var cid, notnull, pk int
		var nazev, typ string
		var vychozi sql.NullString
		if radky.Scan(&cid, &nazev, &typ, &notnull, &vychozi, &pk) == nil {
			v = append(v, nazev)
		}
	}
	return v
}

type radekTabulky struct {
	hodnoty []string
	popis   string
}

// Řádky tabulky podle klíče: hodnoty společných sloupců jako text a popisek řádku
func nacistRadky(db *sql.DB, tabulka, klic, popis string, sloupce []string) (map[string]radekTabulky, error) {
	vyber := make([]string, len(sloupce))
	for i, s := range sloupce {
		vyber[i] = fmt.Sprintf("CAST(%q AS TEXT)", s)
	}
	radky, err := db.Query(fmt.Sprintf("SELECT CAST(%q AS TEXT), COALESCE(%s, ''), %s FROM %q", klic, popis, strings.Join(vyber, ", "), tabulka))
	if err != nil {
		return nil, err
	}
	defer radky.Close()
	v := map[string]radekTabulky{}
	for radky.Next() {
		hodnoty := make([]sql.NullString, len(sloupce)+2)
		cile := make([]any, len(hodnoty))
		for i := range hodnoty {
			cile[i] = &hodnoty[i]
		}
		if err := radky.Scan(cile...); err != nil {
			return nil, err
		}
		r := radekTabulky{popis: hodnoty[1].String}
		for _, h := range hodnoty[2:] {
			if h.Valid {
				r.hodnoty = append(r.hodnoty, h.String)
			} else {
				r.hodnoty = append(r.hodnoty, "\x00")
			}
		}
		v[hodnoty[0].String] = r
	}
	return v, radky.Err()
}

// Rozdíl jedné tabulky: co by obnovení zálohy přidalo, odebralo a změnilo
func porovnatTabulku(ted, zaloha *sql.DB, nazev, tabulka, klic, popis string, ignorovat ...string) (KategorieRozdilu, error) {
	k := KategorieRozdilu{Nazev: nazev, Priklady: []string{}}
	vZaloze := map[string]bool{}
	for _, s := range sloupceTabulky(zaloha, tabulka) {
		vZaloze[s] = true
	}
	var spolecne []string
	for _, s := range sloupceTabulky(ted, tabulka) {
		if vZaloze[s] && s != klic && !obsahuje(ignorovat, s) {
			spolecne = append(spolecne, s)
		}
	}
	if len(vZaloze) == 0 {
		return k, nil
	}
	a, err := nacistRadky(ted, tabulka, klic, popis, spolecne)
	if err != nil {
		return k, err
	}
	b, err := nacistRadky(zaloha, tabulka, klic, popis, spolecne)
	if err != nil {
		return k, err
	}
	var pribude, ubude, zmeni []string
	for id, rb := range b {
		ra, je := a[id]
		if !je {
			k.Pribude++
			pribude = append(pribude, "+ "+rb.popis)
			continue
		}
		var lisi []string
		for i := range spolecne {
			if ra.hodnoty[i] != rb.hodnoty[i] {
				lisi = append(lisi, spolecne[i])
			}
		}
		if len(lisi) > 0 {
			k.Zmeni++
			zmeni = append(zmeni, fmt.Sprintf("~ %s (%s)", rb.popis, strings.Join(lisi, ", ")))
		}
	}
	for id, ra := range a {
		if _, je := b[id]; !je {
			k.Ubude++
			ubude = append(ubude, "− "+ra.popis)
		}
	}
	for _, s := range [][]string{pribude, ubude, zmeni} {
		sort.Strings(s)
		for _, p := range s {
			if len(k.Priklady) < pocetPrikladuRozdilu && strings.TrimLeft(p, "+−~ ") != "" {
				k.Priklady = append(k.Priklady, p)
			}
		}
	}
	return k, nil
}

func (a *App) rozdilProti(zaloha *sql.DB) RozdilZalohy {
	r := RozdilZalohy{Kategorie: []KategorieRozdilu{}}
	for _, t := range []struct {
		nazev, tabulka, klic, popis string
		ignorovat                   []string
	}{
		{"Modelky", "modelky", "id", "jmeno", nil},
		{"Čísla", "vydani", "vydani", "vydani", nil},
		{"Alba", "alba", "id", "album || ' · ' || typ", nil},
		// Datum ověření mění denní kontrola souborů, za změnu sbírky se nepočítá
		{"Fotky", "fotky", "id", "''", []string{"overeno"}},
		{"Články", "clanky", "id", "nazev", nil},
	} {
		k, err := porovnatTabulku(a.db, zaloha, t.nazev, t.tabulka, t.klic, t.popis, t.ignorovat...)
		if err != nil {
			r.Chyba = fmt.Sprintf("%s: %v", t.nazev, err)
			continue
		}
		r.Kategorie = append(r.Kategorie, k)
		r.Celkem += k.Pribude + k.Ubude + k.Zmeni
	}
	return r
}

// Co by obnovení zálohy změnilo, nanečisto (databáze ani záloha se nemění)
func (a *App) RozdilZalohy(soubor string) RozdilZalohy {
	if soubor != filepath.Base(soubor) || !vzorZalohy.MatchString(soubor) {
		return RozdilZalohy{Kategorie: []KategorieRozdilu{}, Chyba: "Neplatný název zálohy."}
	}
	db, err := otevritZalohu(filepath.Join(slozkaZaloh(), soubor))
	if err != nil {
		return RozdilZalohy{Kategorie: []KategorieRozdilu{}, Chyba: err.Error()}
	}
	defer db.Close()
	return a.rozdilProti(db)
}

// ——— Zdraví sbírky ———

type ZdraviSbirky struct {
	PosledniZaloha    string     `json:"posledniZaloha"` // RRRR-MM-DD HH:MM:SS
	DuvodZalohy       string     `json:"duvodZalohy"`
	PocetZaloh        int        `json:"pocetZaloh"`
	VelikostZaloh     int64      `json:"velikostZaloh"`
	PosledniExport    string     `json:"posledniExport"` // RRRR-MM-DD, "" = nikdy
	DniOdExportu      int        `json:"dniOdExportu"`   // -1 = nikdy
	ZmenOdExportu     int        `json:"zmenOdExportu"`
	PripomenoutExport bool       `json:"pripomenoutExport"`
	PosledniKontrola  string     `json:"posledniKontrola"` // nejnovější ověření souboru fotky
	Overenych         int        `json:"overenych"`
	Nedostupnych      int        `json:"nedostupnych"`
	Fotek             int        `json:"fotek"`
	VelikostDatabaze  int64      `json:"velikostDatabaze"`
	VelikostNahledu   int64      `json:"velikostNahledu"`
	VelikostWebu      int64      `json:"velikostWebu"`
	VelikostObsahu    int64      `json:"velikostObsahu"`
	Obsah             StavObsahu `json:"obsah"`
}

const (
	dniDoPripominky   = 14
	zmenDoPripominky  = 20
	platnostVelikosti = 5 * time.Minute
)

var (
	velikostiSlozek = map[string]struct {
		bajtu int64
		cas   time.Time
	}{}
	velikostiZamek sync.Mutex
)

// Velikost složky s mezipamětí na pár minut (náhledů bývají desetitisíce souborů)
func velikostSlozkyPamet(slozka string) int64 {
	if slozka == "" {
		return 0
	}
	velikostiZamek.Lock()
	v, je := velikostiSlozek[slozka]
	velikostiZamek.Unlock()
	if je && time.Since(v.cas) < platnostVelikosti {
		return v.bajtu
	}
	bajtu := nahledy.VelikostSlozky(slozka)
	velikostiZamek.Lock()
	velikostiSlozek[slozka] = struct {
		bajtu int64
		cas   time.Time
	}{bajtu, time.Now()}
	velikostiZamek.Unlock()
	return bajtu
}

func velikostSouboru(cesta string) int64 {
	if info, err := os.Stat(cesta); err == nil {
		return info.Size()
	}
	return 0
}

// Záloha nejbližší ke dni (nejnovější z toho dne nebo dřívější), jinak nejstarší; "" = žádná
func zalohaKeDni(zalohy []Zaloha, den string) string {
	for _, z := range zalohy { // od nejnovější
		if !z.Poskozena && len(z.Cas) >= 10 && z.Cas[:10] <= den {
			return z.Soubor
		}
	}
	for i := len(zalohy) - 1; i >= 0; i-- {
		if !zalohy[i].Poskozena {
			return zalohy[i].Soubor
		}
	}
	return ""
}

func (a *App) GetZdraviSbirky() ZdraviSbirky {
	z := ZdraviSbirky{DniOdExportu: -1}
	zalohy := a.SeznamZaloh()
	z.PocetZaloh = len(zalohy)
	if len(zalohy) > 0 {
		z.PosledniZaloha, z.DuvodZalohy = zalohy[0].Cas, zalohy[0].Duvod
	}
	soubory, _ := filepath.Glob(filepath.Join(slozkaZaloh(), "playboy-*.db"))
	for _, s := range soubory {
		z.VelikostZaloh += velikostSouboru(s)
	}

	var posledni sql.NullString
	a.db.QueryRow(`SELECT MAX(overeno), COUNT(overeno), COUNT(nedostupne_od), COUNT(*) FROM fotky`).Scan(&posledni, &z.Overenych, &z.Nedostupnych, &z.Fotek)
	z.PosledniKontrola = posledni.String

	if a.cestaDb != "" {
		z.VelikostDatabaze = velikostSouboru(a.cestaDb) + velikostSouboru(a.cestaDb+"-wal")
	}
	z.VelikostNahledu = velikostSlozkyPamet(nahledy.Slozka())
	z.VelikostWebu = velikostSlozkyPamet(slozkaMezipametiWebu())
	z.VelikostObsahu = velikostSlozkyPamet(a.slozkaObsahu())
	if a.obsah != nil {
		z.Obsah = a.GetStavObsahu()
	}

	// Export do souboru je jediná záloha mimo tento počítač; změny od něj podle zálohy z jeho dne
	z.PosledniExport = a.nastaveni("posledni_export")
	if z.PosledniExport != "" {
		if den, err := time.ParseInLocation("2006-01-02", z.PosledniExport, time.Local); err == nil {
			z.DniOdExportu = int(time.Since(den).Hours() / 24)
		}
		if soubor := zalohaKeDni(zalohy, z.PosledniExport); soubor != "" {
			z.ZmenOdExportu = a.RozdilZalohy(soubor).Celkem
		}
	} else {
		var zaznamu int
		a.db.QueryRow("SELECT (SELECT COUNT(*) FROM modelky) + (SELECT COUNT(*) FROM fotky)").Scan(&zaznamu)
		z.ZmenOdExportu = zaznamu
	}
	z.PripomenoutExport = (z.DniOdExportu < 0 || z.DniOdExportu > dniDoPripominky) && z.ZmenOdExportu >= zmenDoPripominky
	return z
}
