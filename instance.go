package main

import (
	"crypto/sha256"
	"encoding/hex"
)

// Zámek jediné instance platí pro složku dat a druh sestavení: dvojí spuštění téhož programu nad jednou
// databází se nepovolí, vývojové sestavení vedle hotového programu ano.
func idInstance() string {
	otisk := sha256.Sum256([]byte(slozkaDat()))
	return "playboy-app-" + druhSestaveni + "-" + hex.EncodeToString(otisk[:6])
}
