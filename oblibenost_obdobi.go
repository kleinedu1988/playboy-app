package main

// Sezóny jako období různé délky: sezóna trvá od dne „od“ do dne před „do“ (tabulka obdobi_sezon databáze
// učení) a má téma (oblibenost_temata.go; "" = Klasická). Sezóny jdou za sebou bez mezer: když žádné období
// nezahrnuje dnešek, založí se další od konce posledního s výchozí délkou (první období vůbec = zbytek
// probíhajícího měsíce, aby navázalo na dřívější měsíční sezóny). Téma a délku probíhající sezóny volí uživatel
// (SetObdobiSezony); délka jen z nabídky a konec nesmí být v minulosti. Starší sezóny před prvním obdobím
// zůstávají měsíční (klíč RRRR-MM); sezóna období má klíč svého prvního dne (RRRR-MM-DD).

import (
	"fmt"
	"slices"
	"time"
)

var delkySezon = []int{7, 10, 14, 21, 28, 30}

const vychoziDelkaSezony = 14

type obdobiSezony struct {
	od, do  time.Time
	tema    string
	zvoleno bool // uživatel téma a délku potvrdil
}

const formatDne = "2006-01-02"

func (o obdobiSezony) klic() string { return o.od.Format(formatDne) }
func (o obdobiSezony) dni() int     { return int(o.do.Sub(o.od).Hours()/24 + 0.5) }

func zacatekDne(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// Období od nejstaršího; volá se se zámkem
func (u *uceni) nacistObdobi() []obdobiSezony {
	db := u.zajistit()
	if db == nil {
		return nil
	}
	radky, err := db.Query("SELECT od, do, tema, zvoleno != '' FROM obdobi_sezon ORDER BY od")
	if err != nil {
		return nil
	}
	defer radky.Close()
	var vysledek []obdobiSezony
	for radky.Next() {
		var od, do, tema string
		var zvoleno bool
		if radky.Scan(&od, &do, &tema, &zvoleno) != nil {
			continue
		}
		o, err1 := time.ParseInLocation(formatDne, od, time.Local)
		d, err2 := time.ParseInLocation(formatDne, do, time.Local)
		if err1 == nil && err2 == nil && d.After(o) {
			vysledek = append(vysledek, obdobiSezony{od: o, do: d, tema: tema, zvoleno: zvoleno})
		}
	}
	return vysledek
}

// Všechna období a probíhající sezóna; chybějící období až po dnešek se založí (bez mezer, výchozí délka)
func (a *App) obdobiSezon(nyni time.Time) ([]obdobiSezony, obdobiSezony) {
	u := a.uc
	u.mu.Lock()
	defer u.mu.Unlock()
	obdobi := u.nacistObdobi()
	db := u.zajistit()
	zalozit := func(o obdobiSezony) {
		if db != nil {
			if _, err := db.Exec("INSERT OR IGNORE INTO obdobi_sezon (od, do, tema, zvoleno) VALUES (?, ?, '', '')", o.klic(), o.do.Format(formatDne)); err != nil {
				varovatUceni("období sezóny se nezapsalo: %v", err)
			}
		}
		obdobi = append(obdobi, o)
	}
	if len(obdobi) == 0 {
		od := zacatekMesice(nyni)
		zalozit(obdobiSezony{od: od, do: od.AddDate(0, 1, 0)})
	}
	serazeni := func() { slices.SortFunc(obdobi, func(x, y obdobiSezony) int { return x.od.Compare(y.od) }) }
	if nyni.Before(obdobi[0].od) { // jen období v budoucnu (téma budoucího měsíce z úpravy č. 8): od začátku měsíce
		od := zacatekMesice(nyni)
		if !od.Before(obdobi[0].od) {
			od = zacatekDne(nyni)
		}
		zalozit(obdobiSezony{od: od, do: obdobi[0].od})
		serazeni()
	}
	// Mezery mezi obdobími (víc budoucích měsíců s tématem z úpravy č. 8) se vyplní, ať sezóny jdou bez mezer
	for i := len(obdobi) - 2; i >= 0; i-- {
		if obdobi[i].do.Before(obdobi[i+1].od) {
			zalozit(obdobiSezony{od: obdobi[i].do, do: obdobi[i+1].od})
		}
	}
	serazeni()
	for !nyni.Before(obdobi[len(obdobi)-1].do) {
		od := obdobi[len(obdobi)-1].do
		zalozit(obdobiSezony{od: od, do: od.AddDate(0, 0, vychoziDelkaSezony)})
	}
	for _, o := range obdobi {
		if !nyni.Before(o.od) && nyni.Before(o.do) {
			return obdobi, o
		}
	}
	return obdobi, obdobi[len(obdobi)-1]
}

// Téma a délka probíhající (nebo budoucí) sezóny: od = klíč sezóny, tema = klíč tématu ("" = Klasická), dni =
// délka z nabídky (0 = ponechat). Ukončenou sezónu ani délku, po které by sezóna už skončila, nastavit nejde;
// délku nejde měnit, když za sezónou už začalo další období.
func (a *App) SetObdobiSezony(od, tema string, dni int) bool {
	u := a.uc
	t := temaZKlice(tema)
	if u == nil || t == nil || (dni != 0 && !slices.Contains(delkySezon, dni)) {
		return false
	}
	nyni := time.Now()
	a.obdobiSezon(nyni) // založí chybějící období
	// Kontrola i zápis pod jedním zámkem (mezitím nesmí vzniknout další období)
	u.mu.Lock()
	defer u.mu.Unlock()
	db := u.zajistit()
	if db == nil {
		return false
	}
	obdobi := u.nacistObdobi()
	i := slices.IndexFunc(obdobi, func(o obdobiSezony) bool { return o.klic() == od })
	if i < 0 || !nyni.Before(obdobi[i].do) {
		return false
	}
	do := obdobi[i].do
	if dni != 0 {
		do = obdobi[i].od.AddDate(0, 0, dni)
		if !do.After(nyni) || (i < len(obdobi)-1 && !do.Equal(obdobi[i].do)) {
			return false
		}
	}
	// Kanonický klíč tématu (souboje a sezóny se párují přesnou shodou)
	if _, err := db.Exec("UPDATE obdobi_sezon SET tema = ?, do = ?, zvoleno = ? WHERE od = ?", t.Klic, do.Format(formatDne), ted(), od); err != nil {
		varovatUceni("téma sezóny se nepodařilo uložit: %v", err)
		return false
	}
	return true
}

// ——— Názvy a období pro zobrazení ———

var (
	mesiceNazev   = []string{"leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"}
	mesiceGenitiv = []string{"ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"}
)

// „2.–15. listopadu 2026“, „28. listopadu – 11. prosince 2026“, celý měsíc „listopad 2026“, přes rok s oběma
// roky; do = den po posledním; sRokem false = bez roku (když nejde přes rok)
func textObdobi(od, do time.Time, sRokem bool) string {
	posledni := do.AddDate(0, 0, -1)
	rok := ""
	if sRokem {
		rok = fmt.Sprintf(" %d", od.Year())
	}
	switch {
	case od.Year() != posledni.Year():
		return fmt.Sprintf("%d. %s %d – %d. %s %d", od.Day(), mesiceGenitiv[od.Month()-1], od.Year(), posledni.Day(), mesiceGenitiv[posledni.Month()-1], posledni.Year())
	case od.Day() == 1 && do.Day() == 1 && od.AddDate(0, 1, 0).Equal(do):
		return mesiceNazev[od.Month()-1] + rok
	case od.Month() != posledni.Month():
		return fmt.Sprintf("%d. %s – %d. %s%s", od.Day(), mesiceGenitiv[od.Month()-1], posledni.Day(), mesiceGenitiv[posledni.Month()-1], rok)
	case od.Equal(posledni):
		return fmt.Sprintf("%d. %s%s", od.Day(), mesiceGenitiv[od.Month()-1], rok)
	default:
		return fmt.Sprintf("%d.–%d. %s%s", od.Day(), posledni.Day(), mesiceGenitiv[od.Month()-1], rok)
	}
}

// Názvy sezóny pro zobrazení: plný (téma, jinak období s rokem) a krátký do hlaviček (téma, jinak období bez roku)
type nazvy struct{ nazev, kratky, obdobi string }

func nazvySezony(od, do time.Time, tema string) nazvy {
	n := nazvy{nazev: textObdobi(od, do, true), kratky: textObdobi(od, do, false), obdobi: textObdobi(od, do, true)}
	// Neplatný klíč (např. tag, který už v katalogu není) dá název podle období, ne „Klasická“
	if t := temaZKlice(tema); tema != "" && t != nil {
		n.nazev = t.Nazev
		n.kratky = n.nazev
	}
	return n
}

// Sezóna k uzavření nebo uzavřená: klíč, okno [od, do) a téma
type sezonaKlic struct {
	klic   string
	od, do time.Time
	tema   string
}

// Ukončené sezóny od nejstarší: měsíce před prvním obdobím (od prvního porovnání, nejvýš mesicuZpetKUzavreni měsíců
// zpět od dneška) a ukončená období
func ukonceneSezony(porovnani []porovnaniZaznam, obdobi []obdobiSezony, nyni time.Time) []sezonaKlic {
	var vysledek []sezonaKlic
	if len(obdobi) > 0 && len(porovnani) > 0 {
		mesic := zacatekMesice(porovnani[0].cas)
		if nejstarsi := zacatekMesice(nyni).AddDate(0, -mesicuZpetKUzavreni, 0); mesic.Before(nejstarsi) {
			mesic = nejstarsi
		}
		for ; mesic.Before(obdobi[0].od); mesic = mesic.AddDate(0, 1, 0) {
			do := mesic.AddDate(0, 1, 0)
			if do.After(obdobi[0].od) {
				do = obdobi[0].od
			}
			vysledek = append(vysledek, sezonaKlic{klic: mesic.Format("2006-01"), od: mesic, do: do})
		}
	}
	for _, o := range obdobi {
		if !nyni.Before(o.do) {
			vysledek = append(vysledek, sezonaKlic{klic: o.klic(), od: o.od, do: o.do, tema: o.tema})
		}
	}
	return vysledek
}
