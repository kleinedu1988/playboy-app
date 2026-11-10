package main

// Přejmenování Playboy Database → Pinup Katalog (0.1.0, 10. 11. 2026). Data, nastavení okna (localStorage
// webového jádra) i mezipaměť leží ve složkách pojmenovaných podle programu; při prvním spuštění se staré
// složky přesunou na nové místo. Když přesun nejde (běží stará verze, jiný disk), program dál použije starou
// složku dat a zkusí to příště. Názvy souborů uvnitř (playboy.db, playboy-uceni.db) zůstávají.

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	slozkaProgramu      = "pinup-katalog"
	staraSlozkaProgramu = "playboy-app"
)

func existuje(cesta string) bool {
	_, err := os.Lstat(cesta)
	return err == nil
}

func zakladDat() string {
	zaklad := os.Getenv("XDG_DATA_HOME")
	if zaklad == "" {
		domov, _ := os.UserHomeDir()
		zaklad = filepath.Join(domov, ".local", "share")
	}
	return zaklad
}

// Běží ještě stará verze programu? (její proces by dál zapisoval do přesouvané složky)
var beziStaryProgram = func() bool {
	polozky, _ := os.ReadDir("/proc")
	for _, p := range polozky {
		if p.Name()[0] < '0' || p.Name()[0] > '9' {
			continue
		}
		if jmeno, err := os.ReadFile(filepath.Join("/proc", p.Name(), "comm")); err == nil && strings.TrimSpace(string(jmeno)) == staraSlozkaProgramu {
			return true
		}
	}
	return false
}

// Přesune staré složky dat a mezipaměti na nová místa; vrací popis, co se stalo (pro výpis při startu)
func presunoutStareSlozky() []string {
	var zpravy []string
	if beziStaryProgram() {
		return []string{"Běží ještě Playboy Database – data se přesunou při příštím spuštění."}
	}
	dvojice := [][2]string{{filepath.Join(zakladDat(), staraSlozkaProgramu), filepath.Join(zakladDat(), slozkaProgramu)}}
	if mezipamet, err := os.UserCacheDir(); err == nil {
		dvojice = append(dvojice, [2]string{filepath.Join(mezipamet, staraSlozkaProgramu), filepath.Join(mezipamet, slozkaProgramu)})
	}
	for _, d := range dvojice {
		stara, nova := d[0], d[1]
		if !existuje(stara) || existuje(nova) {
			continue
		}
		if err := os.Rename(stara, nova); err != nil {
			zpravy = append(zpravy, fmt.Sprintf("Složku %s se nepodařilo přesunout na %s: %v", stara, nova, err))
			continue
		}
		zpravy = append(zpravy, fmt.Sprintf("Přesunuto: %s → %s", stara, nova))
	}
	return zpravy
}

// Data aplikace mají pevné místo nezávislé na tom, odkud se aplikace spouští. Dokud se stará složka
// nepřesunula, používá se dál ona.
func slozkaDat() string {
	nova := filepath.Join(zakladDat(), slozkaProgramu)
	if stara := filepath.Join(zakladDat(), staraSlozkaProgramu); !existuje(nova) && existuje(stara) {
		return stara
	}
	return nova
}
