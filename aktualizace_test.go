package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestPorovnatVerze(t *testing.T) {
	for _, p := range []struct {
		a, b string
		znamenko int
	}{{"1.48.0", "1.47.0", 1}, {"1.47.0", "1.47.0", 0}, {"1.9.0", "1.10.0", -1}, {"2.0.0", "1.99.9", 1}, {"1.48.0-rc1", "1.48.0", -1}} {
		v := porovnatVerze(p.a, p.b)
		if (v > 0) != (p.znamenko > 0) || (v < 0) != (p.znamenko < 0) {
			t.Errorf("%s vs %s = %d", p.a, p.b, v)
		}
	}
}

// Kritérium: bez klonu kontrola mlčí; s klonem najde novější verzi ve vzdálené větvi a její changelog, pracovní
// soubory klonu se nezmění, denní kontrola se podruhé nepouští a vypnutá kontrola se po startu nespustí
func TestKontrolaNoveVerze(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git chybí")
	}
	a := novaTestovaciApp(t, nil)
	puvodni := slozkaZdroje
	t.Cleanup(func() { slozkaZdroje = puvodni })

	slozkaZdroje = ""
	if n := a.ZkontrolovatNovouVerzi(true); n.Mozna || n.Novejsi {
		t.Fatalf("bez klonu: %+v", n)
	}

	koren := t.TempDir()
	vzdaleny, klon, prace := filepath.Join(koren, "vzdaleny.git"), filepath.Join(koren, "klon"), filepath.Join(koren, "prace")
	spustit := func(slozka string, args ...string) {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = slozka
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t", "GIT_CONFIG_GLOBAL=/dev/null")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v %s", args, err, out)
		}
	}
	zapsat := func(verze string) {
		os.WriteFile(filepath.Join(prace, "verze.go"), []byte("package main\n\nconst Verze = \""+verze+"\"\n"), 0o644)
		os.WriteFile(filepath.Join(prace, "CHANGELOG.md"), []byte("# Changelog\n\n## ["+verze+"] – 2026-11-11\n\n### Přidáno\n- Novinka\n"), 0o644)
		spustit(prace, "add", ".")
		spustit(prace, "commit", "-q", "-m", verze)
		spustit(prace, "push", "-q", "origin", "HEAD:main")
	}
	spustit(koren, "init", "-q", "--bare", "-b", "main", vzdaleny)
	spustit(koren, "clone", "-q", vzdaleny, prace)
	spustit(prace, "checkout", "-q", "-b", "main")
	zapsat(Verze)
	spustit(koren, "clone", "-q", vzdaleny, klon)
	slozkaZdroje = klon

	n := a.ZkontrolovatNovouVerzi(false)
	if !n.Mozna || n.Verze != Verze || n.Novejsi || !strings.Contains(n.Prikaz, "git pull") {
		t.Fatalf("stejná verze: %+v", n)
	}
	zapsat("99.0.0")
	// Kontrola po startu se do dne nepouští znovu
	if n := a.ZkontrolovatNovouVerzi(false); n.Novejsi {
		t.Fatalf("druhá kontrola téhož dne: %+v", n)
	}
	n = a.ZkontrolovatNovouVerzi(true)
	if !n.Novejsi || n.Verze != "99.0.0" || !strings.Contains(a.GetChangelogNoveVerze(), "## [99.0.0]") {
		t.Fatalf("nová verze: %+v", n)
	}
	if b, _ := os.ReadFile(filepath.Join(klon, "verze.go")); strings.Contains(string(b), "99.0.0") {
		t.Fatal("kontrola změnila pracovní soubory klonu")
	}
	if g := a.GetNovaVerze(); !g.Novejsi || g.Verze != "99.0.0" {
		t.Fatalf("stav bez sítě: %+v", g)
	}
	// Vypnutá kontrola se po startu nespustí, z nabídky ano
	a.NastavitKontroluVerze(false)
	a.ulozitNastaveni(klicPosledniKontroly, "")
	if n := a.ZkontrolovatNovouVerzi(false); n.Zapnuto || n.Kontrola != "" {
		t.Fatalf("vypnutá: %+v", n)
	}
}
