package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// Ikona okna (Alt+Tab, panel); v nabídce aplikací je ikona z instalovat.sh
//
//go:embed build/appicon.png
var ikona []byte

func main() {
	// Create an instance of the app structure
	app := NewApp()
	// Okno se otevře tak, jak bylo naposledy zavřeno
	okno := nacistStavOkna()
	stavOkna := options.Normal
	if okno.Maximalizovane {
		stavOkna = options.Maximised
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "Playboy Database",
		Width:            okno.Sirka,
		Height:           okno.Vyska,
		WindowStartState: stavOkna,
		// Okno nejde zmenšit pod jednu kartu modelky v nejmenší velikosti (včetně lišty a okrajů)
		MinWidth:  280,
		MinHeight: 420,
		// Bez systémové lišty okna – ovládání okna je v hlavičce aplikace
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// Průhledné pozadí kvůli zakulaceným rohům rámečku okna
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		Linux: &linux.Options{
			WindowIsTranslucent: true,
			Icon:                ikona,
			// Stejný název jako StartupWMClass v položce nabídky: okno se spáruje s ní a s její ikonou
			ProgramName: "playboy-app",
			Messages: &linux.Messages{
				WebKit2GTKMinRequired: "Program potřebuje WebKit2GTK %s nebo novější.",
			},
		},
		OnStartup: func(ctx context.Context) {
			app.naChybu = func(zprava string) { runtime.EventsEmit(ctx, "chyba", zprava) }
			app.startup(ctx)
			if okno.MaPolohu && !okno.Maximalizovane {
				runtime.WindowSetPosition(ctx, okno.X, okno.Y)
			}
		},
		OnBeforeClose: func(ctx context.Context) bool {
			zapamatovatOkno(ctx)
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
