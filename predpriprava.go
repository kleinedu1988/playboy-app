package main

// Předpříprava po úvodní obrazovce: rozhraní v klidu (app/predpriprava.js) volá kroky po jednom a backend si jimi
// naplní své mezipaměti (snímek sbírky, témata ke snímku, mezipaměť učení), aby první otevření pohledu nečekalo.
// Kroky nic nevracejí a data nemění; mezipaměti dál hlídají změny dat (data_version, otisky), takže po zápisu se
// nic zastaralého neukáže – krok se jen zopakuje.

import "sync"

var krokyPredpripravy = map[string]func(a *App){
	// Volba sezóny a Průvodce: návrh sezóny ~0,6 s, témata k odemčení 0,2–0,7 s
	"temata": func(a *App) { a.GetTemataKOdemceni(); a.GetNavrhSezony() },
	// Sbírka: přehled ~350 ms, návrhy doplnění ~300 ms, stav učení ~270 ms
	"sbirka": func(a *App) { a.GetPrehled(false); a.GetNavrhyDoplneni(true); a.GetStavUceni() },
	// Kalendář ke snímku (Čísla, Sbírka, našeptávač)
	"kalendar": func(a *App) { a.GetKalendar() },
	// Texty k hledání ke snímku (první hledání a Statistiky)
	"texty": func(a *App) {
		if s := a.snimekSbirky(); s != nil {
			s.textyKHledani()
		}
	},
	"statistiky": func(a *App) { a.GetStatistiky() },
	// Obsah fotek (obsah_fotek.go): odhad srdíček fotek (~0,5 s), obsah fotek modelek a učení tagů z Průvodce
	// (do ~3 s na 1 000 fotek) – na úvodní obrazovce, aby Rychle ♥ a Průvodce nečekaly
	// a objevené styly (shlukování obsahu, ~6 s na 19 000 fotek, jen poprvé a po přibytí 2 % fotek)
	"obsah": func(a *App) { a.odhadySrdicekFotek(); a.obsahFotekVPameti(); a.uceniTaguHned(); a.stylyFotek() },
	// Kolekce Galerie (galerie_kolekce.go): data kolekcí, objevené styly a barvy (~1,5 s, pak z mezipaměti); bez
	// GetKolekceGalerie, ta by řady zapsala jako ukázané (osobní pořadí řad)
	"kolekce": func(a *App) { a.kandidatiKolekci(a.fotkyGalerieVPameti()) },
	// Oblíbenost a „Mohlo by se ti líbit“ (model vkusu s obsahem fotek)
	"oblibenost": func(a *App) { a.GetMohloByTeLibit(12) },
}

// Kroky jdou po jednom; souběžné volání (druhé okno, dvojí plánování) se nespustí a vrátí false
var zamekPredpripravy sync.Mutex

// Jeden krok předpřípravy podle názvu; false = neznámý krok nebo už jiný běží
func (a *App) Predpripravit(krok string) bool {
	f, ok := krokyPredpripravy[krok]
	if !ok || !zamekPredpripravy.TryLock() {
		return false
	}
	defer zamekPredpripravy.Unlock()
	f(a)
	return true
}
