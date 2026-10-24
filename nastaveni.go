package main

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Zapamatování okna, zámek heslem a přehled sbírky.

// Stav okna při posledním zavření. Je v souboru, ne v databázi, protože se čte dřív, než se okno vytvoří.
type StavOkna struct {
	Sirka          int  `json:"sirka"`
	Vyska          int  `json:"vyska"`
	X              int  `json:"x"`
	Y              int  `json:"y"`
	Maximalizovane bool `json:"maximalizovane"`
	// Polohu systém nemusí sdělit ani dovolit nastavit (Wayland); pak se neobnovuje
	MaPolohu bool `json:"maPolohu"`
}

const (
	vychoziSirka = 1024
	vychoziVyska = 768
)

func souborOkna() string {
	return filepath.Join(slozkaDat(), "okno.json")
}

// Chybějící nebo poškozený soubor znamená výchozí okno
func nacistStavOkna() StavOkna {
	stav := StavOkna{Sirka: vychoziSirka, Vyska: vychoziVyska}
	data, err := os.ReadFile(souborOkna())
	if err != nil {
		return stav
	}
	var ulozeny StavOkna
	if json.Unmarshal(data, &ulozeny) != nil || ulozeny.Sirka < 280 || ulozeny.Vyska < 420 {
		return stav
	}
	return ulozeny
}

func ulozitStavOkna(stav StavOkna) error {
	if err := os.MkdirAll(slozkaDat(), 0o700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(stav, "", "  ")
	return os.WriteFile(souborOkna(), data, 0o600)
}

// Zapsání stavu okna těsně před zavřením
func zapamatovatOkno(ctx context.Context) {
	stav := nacistStavOkna()
	stav.Maximalizovane = runtime.WindowIsMaximised(ctx) || runtime.WindowIsFullscreen(ctx)
	// Rozměr maximalizovaného okna se neukládá, po obnovení by okno nemělo kam zmenšit
	if !stav.Maximalizovane {
		stav.Sirka, stav.Vyska = runtime.WindowGetSize(ctx)
		stav.X, stav.Y = runtime.WindowGetPosition(ctx)
		stav.MaPolohu = stav.X != 0 || stav.Y != 0
	}
	ulozitStavOkna(stav)
}

// Zámek: heslo se neukládá, jen jeho otisk se solí. Chrání rozhraní, databáze na disku šifrovaná není.

const iteraciHesla = 200_000

func (a *App) nastaveni(klic string) string {
	var hodnota string
	a.db.QueryRow("SELECT hodnota FROM nastaveni WHERE klic = ?", klic).Scan(&hodnota)
	return hodnota
}

func (a *App) ulozitNastaveni(klic, hodnota string) error {
	if hodnota == "" {
		_, err := a.db.Exec("DELETE FROM nastaveni WHERE klic = ?", klic)
		return err
	}
	_, err := a.db.Exec("INSERT INTO nastaveni (klic, hodnota) VALUES (?, ?) ON CONFLICT(klic) DO UPDATE SET hodnota = excluded.hodnota", klic, hodnota)
	return err
}

func otiskHesla(heslo string, sul []byte) string {
	otisk, _ := pbkdf2.Key(sha256.New, heslo, sul, iteraciHesla, 32)
	return hex.EncodeToString(sul) + ":" + hex.EncodeToString(otisk)
}

func (a *App) hesloSouhlasi(heslo string) bool {
	ulozeny := a.nastaveni("heslo")
	sul, err := hex.DecodeString(strings.SplitN(ulozeny, ":", 2)[0])
	if ulozeny == "" || err != nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(otiskHesla(heslo, sul)), []byte(ulozeny)) == 1
}

// Zda je program chráněný heslem
func (a *App) MaZamek() bool {
	return a.nastaveni("heslo") != ""
}

// Ověření hesla při spuštění; špatný pokus se zdrží, aby se heslo nedalo rychle zkoušet
func (a *App) Odemknout(heslo string) bool {
	if a.hesloSouhlasi(heslo) {
		return true
	}
	time.Sleep(zdrzeniSpatnehoHesla)
	return false
}

var zdrzeniSpatnehoHesla = 700 * time.Millisecond

// Nastavení, změna nebo zrušení hesla (prázdné nové heslo zámek ruší); stávající heslo se musí zadat
func (a *App) NastavitHeslo(stare, nove string) bool {
	if a.MaZamek() && !a.Odemknout(stare) {
		return false
	}
	hodnota := ""
	if nove != "" {
		sul := make([]byte, 16)
		if _, err := rand.Read(sul); err != nil {
			a.chyba("nastavení hesla", err)
			return false
		}
		hodnota = otiskHesla(nove, sul)
	}
	if err := a.ulozitNastaveni("heslo", hodnota); err != nil {
		a.chyba("nastavení hesla", err)
		return false
	}
	return true
}

// Chybějící údaj do seznamu; označený „netýká se" jen při zobrazení skrytých
func pridatChybejici(seznam *[]PolozkaPrehledu, polozka PolozkaPrehledu, netykaSe, vcetneSkrytych bool) {
	if netykaSe && !vcetneSkrytych {
		return
	}
	polozka.NetykaSe = netykaSe
	*seznam = append(*seznam, polozka)
}

// Přehled sbírky: počty a seznamy toho, co ještě chybí doplnit

type PolozkaPrehledu struct {
	// Označeno „netýká se"; v seznamech jen při zobrazení skrytých
	NetykaSe  bool   `json:"netykaSe"`
	ModelkaID int    `json:"modelkaId"`
	Jmeno     string `json:"jmeno"`
	Album     string `json:"album"` // prázdné u položky, která se týká celé modelky
	Typ       string `json:"typ"`
}

type RocnikPrehledu struct {
	Rok    int      `json:"rok"`
	Edice  string   `json:"edice"`  // US, CZ…
	Vydani int      `json:"vydani"` // kolik měsíců ročníku ve sbírce je
	Mesice [12]bool `json:"mesice"` // které to jsou, od ledna
}

type Prehled struct {
	Modelek          int `json:"modelek"`
	Alb              int `json:"alb"`
	AlbOnline        int `json:"albOnline"`
	Fotek            int `json:"fotek"`
	HodnocenychFotek int `json:"hodnocenychFotek"`
	Coveru           int `json:"coveru"`
	Vydani           int `json:"vydani"`

	BezTitulni     []PolozkaPrehledu `json:"bezTitulni"`
	BezNarozeni    []PolozkaPrehledu `json:"bezNarozeni"`
	BezCenterfoldu []PolozkaPrehledu `json:"bezCenterfoldu"`
	BezHodnoceni   []PolozkaPrehledu `json:"bezHodnoceni"`
	AlbaBezPopisu  []PolozkaPrehledu `json:"albaBezPopisu"`
	AlbaBezVydani  []PolozkaPrehledu `json:"albaBezVydani"`

	// Vydání RRRR-MM, ke kterým něco je, ale cover nebo centerfold chybí
	VydaniBezCoveru      []string         `json:"vydaniBezCoveru"`
	VydaniBezCenterfoldu []string         `json:"vydaniBezCenterfoldu"`
	Rocniky              []RocnikPrehledu `json:"rocniky"`

	Podezrele []PodezrelyUdaj `json:"podezrele"`
}

// vcetneSkrytych: i položky označené „netýká se" (s příznakem), aby šlo označení zrušit
func (a *App) GetPrehled(vcetneSkrytych bool) Prehled {
	p := Prehled{
		BezTitulni: []PolozkaPrehledu{}, BezNarozeni: []PolozkaPrehledu{}, BezCenterfoldu: []PolozkaPrehledu{},
		BezHodnoceni: []PolozkaPrehledu{}, AlbaBezPopisu: []PolozkaPrehledu{}, AlbaBezVydani: []PolozkaPrehledu{},
		VydaniBezCoveru: []string{}, VydaniBezCenterfoldu: []string{}, Rocniky: []RocnikPrehledu{},
		Podezrele: []PodezrelyUdaj{},
	}

	// Alba všech modelek; album je skupina fotek se stejným názvem a typem
	maCenterfold := map[int]bool{}
	rows, err := a.db.Query(`
		SELECT al.modelka_id, m.jmeno, al.album, al.typ, COUNT(*), COALESCE(SUM(COALESCE(f.hodnoceni, 0) > 0), 0),
			COALESCE(al.vydani, ''), COALESCE(al.popis, ''), COALESCE(al.netyka_se, '')
		FROM fotky f
		JOIN alba al ON al.id = f.album_id
		JOIN modelky m ON m.id = al.modelka_id
		GROUP BY al.id
		ORDER BY m.jmeno COLLATE BEZDIAKRITIKY, al.album`)
	if err != nil {
		a.chyba("načtení přehledu sbírky", err)
		return p
	}
	for rows.Next() {
		var polozka PolozkaPrehledu
		var fotek, hodnocenych int
		var vydani, popis, netykaSe string
		if err := rows.Scan(&polozka.ModelkaID, &polozka.Jmeno, &polozka.Album, &polozka.Typ, &fotek, &hodnocenych, &vydani, &popis, &netykaSe); err != nil {
			continue
		}
		p.Alb++
		p.Fotek += fotek
		p.HodnocenychFotek += hodnocenych
		if polozka.Typ == "Centerfold" {
			maCenterfold[polozka.ModelkaID] = true
			continue
		}
		if popis == "" {
			pridatChybejici(&p.AlbaBezPopisu, polozka, obsahujeKlic(netykaSe, "text"), vcetneSkrytych)
		}
		// Online album k číslu nepatří, vydání mu nechybí
		if jeOnlineTyp(polozka.Typ) {
			p.AlbOnline++
		} else if vydani == "" {
			pridatChybejici(&p.AlbaBezVydani, polozka, obsahujeKlic(netykaSe, "vydani"), vcetneSkrytych)
		}
	}
	rows.Close()

	// Modelky se načtou jednou pro kontrolu i pro seznamy toho, co chybí
	modelky := a.GetModelky("")

	// Údaje ke kontrole (kontrola.go)
	p.Podezrele = a.kontrolovatSbirku(modelky, vcetneSkrytych)

	// Centerfold sdíleného alba patří i dalším modelkám
	if radky, err := a.db.Query("SELECT am.modelka_id FROM alba_modelky am JOIN alba al ON al.id = am.album_id WHERE al.typ = 'Centerfold'"); err == nil {
		for radky.Next() {
			var id int
			if radky.Scan(&id) == nil {
				maCenterfold[id] = true
			}
		}
		radky.Close()
	}

	for _, m := range modelky {
		p.Modelek++
		polozka := PolozkaPrehledu{ModelkaID: m.ID, Jmeno: m.Jmeno}
		if m.CoverID == "" {
			pridatChybejici(&p.BezTitulni, polozka, obsahujeKlic(m.NetykaSe, "titulni"), vcetneSkrytych)
		}
		if m.NarozeniDatum == "" {
			pridatChybejici(&p.BezNarozeni, polozka, obsahujeKlic(m.NetykaSe, "zakladni"), vcetneSkrytych)
		}
		if !maCenterfold[m.ID] {
			pridatChybejici(&p.BezCenterfoldu, polozka, obsahujeKlic(m.NetykaSe, "centerfold"), vcetneSkrytych)
		}
		if m.Hodnoceni == 0 {
			pridatChybejici(&p.BezHodnoceni, polozka, obsahujeKlic(m.NetykaSe, "hodnoceni"), vcetneSkrytych)
		}
	}

	// Co je ke kterému vydání k dispozici; ročník bez měsíce se mezi vydání nepočítá
	type obsah struct{ cover, centerfold bool }
	vydani := map[string]*obsah{}
	var poradi []string
	for _, v := range a.GetKalendar() {
		if !vzorVydani.MatchString(v.Vydani) {
			continue
		}
		vydani[v.Vydani] = &obsah{v.Cover, v.Centerfold}
		poradi = append(poradi, v.Vydani)
	}
	a.db.QueryRow("SELECT COUNT(*) FROM fotografie WHERE typ = 'Cover'").Scan(&p.Coveru)
	p.Vydani = len(poradi)

	// Ročník je rok v jedné edici
	rocniky := map[string]int{}
	// Vydání označené „nezajímá mě" se nedoplňuje
	nezajima := map[string]bool{}
	for _, v := range a.GetStavyVydani() {
		nezajima[v.Vydani] = v.Stav == "nezajima"
	}
	for _, v := range poradi {
		if !vydani[v].cover && !nezajima[v] {
			p.VydaniBezCoveru = append(p.VydaniBezCoveru, v)
		}
		// Speciál nemá jediný centerfold ani měsíc v ročníku
		if jeSpecial(v) {
			continue
		}
		if !vydani[v].centerfold && !nezajima[v] {
			p.VydaniBezCenterfoldu = append(p.VydaniBezCenterfoldu, v)
		}
		var rok int
		for _, znak := range v[:4] {
			rok = rok*10 + int(znak-'0')
		}
		edice := "US"
		if len(v) > 7 {
			edice = v[8:]
		}
		klic := fmt.Sprintf("%d-%s", rok, edice)
		i, znamy := rocniky[klic]
		if !znamy {
			i = len(p.Rocniky)
			rocniky[klic] = i
			p.Rocniky = append(p.Rocniky, RocnikPrehledu{Rok: rok, Edice: edice})
		}
		mesic := int(v[5]-'0')*10 + int(v[6]-'0')
		p.Rocniky[i].Mesice[mesic-1] = true
		p.Rocniky[i].Vydani++
	}
	return p
}
