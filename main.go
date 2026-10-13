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

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Playboy Database",
		Width:  1024,
		Height: 768,
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
		},
		OnStartup: func(ctx context.Context) {
			app.naChybu = func(zprava string) { runtime.EventsEmit(ctx, "chyba", zprava) }
			app.startup(ctx)
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
