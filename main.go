package main

import (
	"context"
	"embed"
	"fmt"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pinup-katalog/internal/nahledy"
)

//go:embed all:frontend/dist
var assets embed.FS

// Ikona okna (Alt+Tab, panel); v nabídce aplikací je ikona z instalovat.sh
//
//go:embed build/appicon.png
var ikona []byte

func main() {
	// Přejmenování (0.1.0): staré složky Playboy Database na nové místo, než je cokoli otevře
	for _, zprava := range presunoutStareSlozky() {
		fmt.Println(zprava)
	}
	// Mezipaměť webového jádra se sama neomezuje (narostla až přes 900 MB) – nad limitem pryč, než se otevře okno
	if uvolneno := omezitMezipametWebu(); uvolneno > 0 {
		fmt.Printf("Mezipaměť okna: uvolněno %d MB\n", uvolneno>>20)
	}

	// Create an instance of the app structure
	app := NewApp()
	// Obrázky v okně jdou přes místní mezipaměť náhledů (nahledy.go, obsluha v AssetServer níže)
	nahledyPresMezipamet.Store(true)
	app.nahledy = nahledy.Nova(nahledy.Slozka(), adresaNahleduNaDisku)
	// Úvodní obrazovka je malé okno uprostřed; uloženou velikost a polohu dostane okno až na konci úvodu
	// (App.ObnovitOkno), tak jak bylo naposledy zavřeno
	okno := nacistStavOkna()
	app.uvod = &uvodOkna{okno: okno}
	app.uvod.bezi.Store(true)

	// Create application with options
	err := wails.Run(&options.App{
		Title:            NazevProgramu,
		Width:            sirkaUvodu,
		Height:           vyskaUvodu,
		WindowStartState: options.Normal,
		// Okno nejde zmenšit pod jednu kartu modelky v nejmenší velikosti (včetně lišty a okrajů)
		MinWidth:  280,
		MinHeight: 420,
		// Bez systémové lišty okna – ovládání okna je v hlavičce aplikace
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
			// Co není mezi soubory rozhraní: náhledy z Disku přes místní mezipaměť (nahledy.go)
			Handler: obsluhaPDF{dalsi: app.nahledy},
		},
		// Průhledné pozadí kvůli zakulaceným rohům rámečku okna
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		Linux: &linux.Options{
			WindowIsTranslucent: true,
			Icon:                ikona,
			// Stejný název jako StartupWMClass v položce nabídky: okno se spáruje s ní a s její ikonou
			ProgramName: slozkaProgramu,
			Messages: &linux.Messages{
				WebKit2GTKMinRequired: "Program potřebuje WebKit2GTK %s nebo novější.",
			},
		},
		OnStartup: func(ctx context.Context) {
			app.naChybu = func(zprava string) { runtime.EventsEmit(ctx, "chyba", zprava) }
			app.startNaPozadi = true
			app.startup(ctx)
			runtime.WindowCenter(ctx)
		},
		OnBeforeClose: func(ctx context.Context) bool {
			// Zavření během úvodu nesmí uložit malé okno úvodu
			if !app.uvod.bezi.Load() {
				zapamatovatOkno(ctx)
			}
			return false
		},
		OnShutdown: func(ctx context.Context) { app.shutdown() },
		// Druhé spuštění nad stejnou složkou dat jen ukáže už otevřené okno
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: idInstance(),
			OnSecondInstanceLaunch: func(options.SecondInstanceData) {
				if app.ctx != nil {
					runtime.WindowUnminimise(app.ctx)
					runtime.WindowShow(app.ctx)
				}
			},
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
