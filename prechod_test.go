package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Snímek obsahu sbírky ve stejném tvaru, v jakém ho zapsaly staré verze do testdata/stare-verze/*/snimek.json
func snimekSbirky(a *App) map[string]any {
	fotky := map[string]any{}
	for _, m := range a.GetModelky("") {
		fotky[m.Jmeno] = a.GetFotografieModelky(m.ID)
	}
	fotkyVyberu := map[string]any{}
	for _, v := range a.GetVybery() {
		fotkyVyberu[v.Nazev] = a.GetFotkyVyberu(v.ID)
	}
	return map[string]any{
		"modelky": a.GetModelky(""), "fotky": fotky, "covery": a.GetCovery(), "vybery": a.GetVybery(), "fotkyVyberu": fotkyVyberu,
		"stavy": a.GetStavyVydani(), "infoCisla": a.GetVydaniInfo("1995-03"), "specialy": a.GetSpecialy(),
		"clanky": a.GetClanky("1995-03"), "kalendar": a.GetKalendar(),
	}
}

// Údaje, které se mezi verzemi smí lišit: adresy obrázků (šablona adresy) a při importu i čísla záznamů a časy
var (
	vzdyIgnorovat   = map[string]bool{"url": true, "coverUrl": true, "nahled": true, "skenyUrl": true}
	priImportuJinak = map[string]bool{"id": true, "albumId": true, "modelkaId": true, "modelkaObalky": true, "pridano": true}
	idSouboru       = regexp.MustCompile(`/d/([A-Za-z0-9_-]+)`)
)

// Klíč položky seznamu: fotka podle souboru na Disku, modelka podle jména, ostatní podle vydání a názvu
func klicPolozky(x map[string]any) string {
	if _, jeFotka := x["typ"]; jeFotka {
		if id, _ := x["driveId"].(string); id != "" {
			return id
		}
		if m := idSouboru.FindStringSubmatch(fmt.Sprint(x["url"])); m != nil {
			return m[1]
		}
	}
	if j, _ := x["jmeno"].(string); j != "" {
		return j
	}
	// Pole, které stará verze neměla (název speciálu), se počítá jako prázdné
	text := func(k string) string {
		if x[k] == nil {
			return ""
		}
		return fmt.Sprint(x[k])
	}
	return text("vydani") + "|" + text("nazev") + "|" + text("strana")
}

// Každý údaj staré verze musí být v nové stejný (nová verze smí údaje přidat)
func porovnatSnimky(stare, nove any, cesta string, importem bool, rozdily *[]string) {
	switch s := stare.(type) {
	case map[string]any:
		n, _ := nove.(map[string]any)
		for k, v := range s {
			if vzdyIgnorovat[k] || (importem && priImportuJinak[k]) {
				continue
			}
			if _, ok := n[k]; !ok {
				*rozdily = append(*rozdily, fmt.Sprintf("%s.%s chybí", cesta, k))
				continue
			}
			porovnatSnimky(v, n[k], cesta+"."+k, importem, rozdily)
		}
	case []any:
		n, _ := nove.([]any)
		if len(s) > 0 {
			if _, objekty := s[0].(map[string]any); objekty {
				podleKlice := map[string]any{}
				for _, x := range n {
					podleKlice[klicPolozky(x.(map[string]any))] = x
				}
				for _, x := range s {
					k := klicPolozky(x.(map[string]any))
					if _, ok := podleKlice[k]; !ok {
						*rozdily = append(*rozdily, fmt.Sprintf("%s[%s] chybí", cesta, k))
						continue
					}
					porovnatSnimky(x, podleKlice[k], cesta+"["+k+"]", importem, rozdily)
				}
			}
		}
		if len(s) != len(n) {
			*rozdily = append(*rozdily, fmt.Sprintf("%s: %d položek, teď %d", cesta, len(s), len(n)))
		}
	case nil:
	default:
		if fmt.Sprint(stare) != fmt.Sprint(nove) {
			*rozdily = append(*rozdily, fmt.Sprintf("%s: %v → %v", cesta, stare, nove))
		}
	}
}

func jakoJSON(t *testing.T, x any) any {
	b, err := json.Marshal(x)
	if err != nil {
		t.Fatal(err)
	}
	var v any
	json.Unmarshal(b, &v)
	return v
}

// Databáze a exporty ze všech dřívějších verzí (testdata/stare-verze) převezme současná verze beze ztráty
func TestPrechodZeStarychVerzi(t *testing.T) {
	verze, err := os.ReadDir(filepath.Join("testdata", "stare-verze"))
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range verze {
		if !v.IsDir() {
			continue
		}
		adr, _ := filepath.Abs(filepath.Join("testdata", "stare-verze", v.Name()))
		var stary any
		data, _ := os.ReadFile(filepath.Join(adr, "snimek.json"))
		if err := json.Unmarshal(data, &stary); err != nil {
			t.Fatalf("%s: %v", v.Name(), err)
		}
		// Export ve formátu do verze 3 ještě neměl „netýká se“ u modelky (EXPORT.md, verze 4)
		exportVerze := 0
		export, _ := os.ReadFile(filepath.Join(adr, "export.yaml"))
		fmt.Sscanf(regexp.MustCompile(`(?m)^verze: (\d+)`).FindString(string(export)), "verze: %d", &exportVerze)

		t.Run(v.Name()+"/databáze", func(t *testing.T) {
			t.Setenv("XDG_DATA_HOME", t.TempDir())
			os.MkdirAll(slozkaDat(), 0o700)
			db, _ := os.ReadFile(filepath.Join(adr, "playboy.db"))
			os.WriteFile(filepath.Join(slozkaDat(), "playboy.db"), db, 0o600)
			a := NewApp()
			a.startup(context.Background())
			defer a.db.Close()
			if a.chybaStartu != "" {
				t.Fatal(a.chybaStartu)
			}
			var schema int
			a.db.QueryRow("PRAGMA user_version").Scan(&schema)
			if schema != len(migrace) {
				t.Fatalf("schéma %d místo %d", schema, len(migrace))
			}
			if err := kontrolaCizichKlicu(a.db); err != nil {
				t.Fatal(err)
			}
			rozdily := []string{}
			porovnatSnimky(stary, jakoJSON(t, snimekSbirky(a)), "", false, &rozdily)
			if len(rozdily) > 0 {
				sort.Strings(rozdily)
				t.Fatalf("po úpravě databáze se změnilo:\n%s", strings.Join(rozdily, "\n"))
			}
		})

		t.Run(v.Name()+"/export", func(t *testing.T) {
			a := novaTestovaciApp(t, nil)
			vysledek := a.importovat(export)
			if vysledek.Selhalo != "" || len(vysledek.Chyby) > 0 {
				t.Fatalf("import: %s %v", vysledek.Selhalo, vysledek.Chyby)
			}
			novy := jakoJSON(t, snimekSbirky(a))
			rozdily := []string{}
			porovnatSnimky(stary, novy, "", true, &rozdily)
			if exportVerze < 4 {
				zbyle := rozdily[:0]
				for _, r := range rozdily {
					if !strings.Contains(r, ".netykaSe:") {
						zbyle = append(zbyle, r)
					}
				}
				rozdily = zbyle
			}
			if len(rozdily) > 0 {
				sort.Strings(rozdily)
				t.Fatalf("po importu exportu verze %d se změnilo:\n%s", exportVerze, strings.Join(rozdily, "\n"))
			}
		})
	}
}
