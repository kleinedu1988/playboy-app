//go:build race

package main

// Detektor souběhů (go test -race) zpomaluje SQLite v čistém Go asi desetkrát; časové limity testů se násobí
const nasobekCasuTestu = 10
