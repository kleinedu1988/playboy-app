// Jádro telefonu v Go (0.02.078, varianta B): knihovna pro Android přes `gomobile bind`. Zatím jen popis a
// rozbalení balíčku pro telefon (balicek_telefonu.go v hlavním programu), aby měření velikosti zahrnulo i
// gzip a JSON.
package jadro

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"runtime"
)

// Popis: verze Go a balíčku (pro stránku kostry)
func Popis() string {
	return runtime.Version() + ", balíček v1"
}

// PocetModelek rozbalí balíček pro telefon (gzip JSON) a vrátí počet modelek
func PocetModelek(balicek []byte) (int, error) {
	z, err := gzip.NewReader(bytes.NewReader(balicek))
	if err != nil {
		return 0, err
	}
	var b struct {
		Modelky []json.RawMessage `json:"modelky"`
	}
	if err := json.NewDecoder(z).Decode(&b); err != nil {
		return 0, err
	}
	return len(b.Modelky), nil
}
