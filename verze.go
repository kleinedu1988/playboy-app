package main

// Verze programu (MAJOR.MINOR.PATCH, pravidla v ROADMAP.md, oddíl „Pravidlo verzování“).
// Při vydání se verze změní tady, ve wails.json (info.productVersion) a ve frontend/package.json
// a v CHANGELOG.md dostane datum; test hlídá, že spolu souhlasí.
const Verze = "0.1.0"

// Název programu (do 1.53.0 „Playboy Database“, viz prejmenovani.go). Kontrola nové verze podle něj pozná,
// že vzdálená větev patří k nové řadě verzí (aktualizace.go).
const NazevProgramu = "Pinup Katalog"

// Verze pro zobrazení v programu
func (a *App) GetVerze() string {
	return Verze
}
