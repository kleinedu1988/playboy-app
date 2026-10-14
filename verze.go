package main

// Verze programu podle sémantického verzování (MAJOR.MINOR.PATCH). Do 1.0.0 se schéma databáze a formát
// exportu ještě mění; každá verze, která je mění, zvyšuje MINOR. Neuvolněný stav nese příponu -dev.
// Při vydání se verze změní tady, ve wails.json (info.productVersion) a ve frontend/package.json
// a v CHANGELOG.md dostane datum; test hlídá, že spolu souhlasí.
const Verze = "0.9.1"

// Verze pro zobrazení v programu
func (a *App) GetVerze() string {
	return Verze
}
