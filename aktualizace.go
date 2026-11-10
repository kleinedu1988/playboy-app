package main

// Upozornění na novou verzi (ROADMAP 1.48, návrh R15 v docs/PLAN-1X-ROZSIRENI.md). instalovat.sh předá při sestavení
// cestu ke klonu repozitáře (-ldflags "-X main.slozkaZdroje=…"). Program jednou denně na pozadí spustí
// `git fetch` v tom klonu (bez dotazu na heslo, nejvýš 15 s), přečte Verze z verze.go vzdálené větve a její
// CHANGELOG.md a novější verzi okno nenápadně oznámí s příkazem k aktualizaci. Nic se nestahuje do sbírky ani
// neinstaluje samo; pracovní soubory klonu se nemění (fetch mění jen vzdálené větve). Bez gitu, bez klonu nebo bez
// sítě mlčí. Vypnutí v ⋯ (nastavení kontrola_verze = "vypnuto").

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Cesta ke klonu, ze kterého byl program sestaven (nastaví instalovat.sh); prázdná = kontrola není možná
var slozkaZdroje string

const (
	klicKontrolyVerze    = "kontrola_verze"
	klicPosledniKontroly = "kontrola_verze_cas_pk"
	// Od přejmenování (0.1.0) nové klíče: uložená verze ze staré řady 1.x by se brala jako novější
	klicNalezeneVerze = "kontrola_verze_nalezena_pk"
	kontrolaVerzePo   = 24 * time.Hour
	limitGitu         = 15 * time.Second
)

var (
	vzorVerze      = regexp.MustCompile(`const Verze = "([0-9]+\.[0-9]+\.[0-9]+[^"]*)"`)
	vzorNazvu      = regexp.MustCompile(`const NazevProgramu = "`)
	zamekAktualiz  sync.Mutex
	pametChangelog struct {
		verze, text string
	}
)

type NovaVerze struct {
	Zapnuto  bool   `json:"zapnuto"`
	Mozna    bool   `json:"mozna"` // program zná svůj klon s gitem
	Verze    string `json:"verze"` // nalezená verze ve vzdálené větvi ("" = zatím nezjištěno)
	Novejsi  bool   `json:"novejsi"`
	Klon     string `json:"klon"`
	Prikaz   string `json:"prikaz"` // jak aktualizovat
	Kontrola string `json:"kontrola"`
	Chyba    string `json:"chyba"`
}

// Číselné porovnání verzí MAJOR.MINOR.PATCH; předběžná verze (s „-“) je před vydáním stejného čísla
func porovnatVerze(a, b string) int {
	cisla := func(v string) ([3]int, bool) {
		var c [3]int
		zaklad, _, predbezna := strings.Cut(v, "-")
		casti := strings.Split(zaklad, ".")
		for i := 0; i < 3 && i < len(casti); i++ {
			c[i], _ = strconv.Atoi(casti[i])
		}
		return c, predbezna
	}
	x, px := cisla(a)
	y, py := cisla(b)
	for i := range x {
		if x[i] != y[i] {
			return x[i] - y[i]
		}
	}
	switch {
	case px && !py:
		return -1
	case !px && py:
		return 1
	}
	return 0
}

// Klon s gitem, ze kterého je program; jinak ""
func klonZdroje() string {
	if slozkaZdroje == "" {
		return ""
	}
	if _, err := os.Stat(filepath.Join(slozkaZdroje, ".git")); err != nil {
		return ""
	}
	if _, err := exec.LookPath("git"); err != nil {
		return ""
	}
	return slozkaZdroje
}

func git(ctx context.Context, klon string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", klon}, args...)...)
	// Žádné dotazy na heslo ani otevírání okna; čistý výstup bez barev a překladů
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "GIT_ASKPASS=true", "SSH_ASKPASS=true", "LC_ALL=C", "GIT_SSH_COMMAND=ssh -o BatchMode=yes")
	vystup, err := cmd.Output()
	return string(vystup), err
}

// Větev, se kterou se porovnává: sledovaná větev, jinak výchozí větev originu
func vzdalenaVetev(ctx context.Context, klon string) string {
	for _, ref := range []string{"@{upstream}", "origin/HEAD", "origin/main", "origin/master"} {
		if _, err := git(ctx, klon, "rev-parse", "--verify", "--quiet", ref); err == nil {
			return ref
		}
	}
	return ""
}

func (a *App) stavNoveVerze(klon string) NovaVerze {
	n := NovaVerze{Zapnuto: a.nastaveni(klicKontrolyVerze) != "vypnuto", Mozna: klon != "", Klon: klon,
		Verze: a.nastaveni(klicNalezeneVerze), Kontrola: a.nastaveni(klicPosledniKontroly)}
	if klon != "" {
		n.Prikaz = "cd " + strconv.Quote(klon) + " && git pull && ./instalovat.sh"
	}
	n.Novejsi = n.Verze != "" && porovnatVerze(n.Verze, Verze) > 0
	return n
}

// Stav bez sítě: naposledy nalezená verze a jestli je novější
func (a *App) GetNovaVerze() NovaVerze {
	return a.stavNoveVerze(klonZdroje())
}

// Kontrola na pozadí po startu (vynutit = false: nejvýš jednou za den) nebo z nabídky (vynutit = true)
func (a *App) ZkontrolovatNovouVerzi(vynutit bool) NovaVerze {
	zamekAktualiz.Lock()
	defer zamekAktualiz.Unlock()
	klon := klonZdroje()
	n := a.stavNoveVerze(klon)
	if klon == "" || (!n.Zapnuto && !vynutit) {
		return n
	}
	if !vynutit {
		if t, err := time.ParseInLocation("2006-01-02 15:04:05", n.Kontrola, time.Local); err == nil && time.Since(t) < kontrolaVerzePo {
			return n
		}
	}
	ctx, zrusit := context.WithTimeout(context.Background(), limitGitu)
	defer zrusit()
	if _, err := git(ctx, klon, "fetch", "--quiet", "--no-tags", "origin"); err != nil {
		// Bez sítě nebo bez přístupu: mlčí, zkusí se zase za den (z nabídky se chyba ukáže)
		a.ulozitNastaveni(klicPosledniKontroly, ted())
		n.Kontrola = ted()
		n.Chyba = "Nepodařilo se spojit s repozitářem – je počítač připojený k internetu?"
		return n
	}
	verze, changelog := cistVzdalenouVerzi(ctx, klon)
	a.ulozitNastaveni(klicPosledniKontroly, ted())
	if verze == "" {
		n.Chyba = "Ve vzdáleném repozitáři se nepodařilo najít verzi programu."
		return n
	}
	a.ulozitNastaveni(klicNalezeneVerze, verze)
	pametChangelog.verze, pametChangelog.text = verze, changelog
	return a.stavNoveVerze(klon)
}

func cistVzdalenouVerzi(ctx context.Context, klon string) (string, string) {
	ref := vzdalenaVetev(ctx, klon)
	if ref == "" {
		return "", ""
	}
	zdroj, err := git(ctx, klon, "show", ref+":verze.go")
	if err != nil {
		return "", ""
	}
	m := vzorVerze.FindStringSubmatch(zdroj)
	// Vzdálená větev ještě se starou řadou Playboy Database (1.x před přejmenováním) není novější verze
	if m == nil || !vzorNazvu.MatchString(zdroj) {
		return "", ""
	}
	changelog, _ := git(ctx, klon, "show", ref+":CHANGELOG.md")
	return m[1], changelog
}

// CHANGELOG.md nalezené verze (okno z něj vybere verze mezi současnou a novou); bez sítě z klonu
func (a *App) GetChangelogNoveVerze() string {
	zamekAktualiz.Lock()
	defer zamekAktualiz.Unlock()
	if pametChangelog.text != "" {
		return pametChangelog.text
	}
	klon := klonZdroje()
	if klon == "" {
		return ""
	}
	ctx, zrusit := context.WithTimeout(context.Background(), limitGitu)
	defer zrusit()
	verze, text := cistVzdalenouVerzi(ctx, klon)
	if verze != "" {
		pametChangelog.verze, pametChangelog.text = verze, text
	}
	return text
}

func (a *App) NastavitKontroluVerze(zapnuto bool) bool {
	hodnota := ""
	if !zapnuto {
		hodnota = "vypnuto"
	}
	if err := a.ulozitNastaveni(klicKontrolyVerze, hodnota); err != nil {
		a.chyba("nastavení kontroly verze", err)
		return false
	}
	return true
}
