package obsah

import (
	"context"
	"os"
	"testing"
)

// Skutečné stažení vestavěných souborů z internetu (~100 MB); spouští se jen ručně:
// OBSAH_SIT=1 go test -run TestSkutecneStazeni -v ./internal/obsah
func TestSkutecneStazeni(t *testing.T) {
	if os.Getenv("OBSAH_SIT") == "" {
		t.Skip("bez OBSAH_SIT=1 (stahuje ~100 MB z internetu)")
	}
	slozka := t.TempDir()
	if err := Pripravit(context.Background(), nil, slozka, func(p Prubeh) {}); err != nil {
		t.Fatal(err)
	}
	if !Pripraveno(slozka) {
		t.Fatal("po stažení nejsou soubory na místě")
	}
}
