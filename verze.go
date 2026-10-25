package main

// Verze programu (MAJOR.MINOR.PATCH, pravidla v ROADMAP.md, oddíl „Pravidlo verzování“).
// Při vydání se verze změní tady, ve wails.json (info.productVersion) a ve frontend/package.json
// a v CHANGELOG.md dostane datum; test hlídá, že spolu souhlasí.
const Verze = "0.99.13"

// Verze pro zobrazení v programu
func (a *App) GetVerze() string {
	return Verze
}
