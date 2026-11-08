package obsah

import (
	"reflect"
	"testing"
)

// Rozdělení na slova (interpunkce zvlášť, řídicí znaky pryč) a WordPiece s „##“ (velká písmena a diakritika zůstávají)
func TestTokenizerBert(t *testing.T) {
	if s := slovaBert("Žena na pláži,\tv\x00 bikinách!"); !reflect.DeepEqual(s, []string{"Žena", "na", "pláži", ",", "v", "bikinách", "!"}) {
		t.Fatalf("slova %q", s)
	}
	m := &TextovyModel{slovnik: map[string]int32{"[UNK]": 1, "[CLS]": 2, "[SEP]": 3, "Žena": 10, "na": 11, "plá": 12, "##ži": 13, "!": 14}, unk: 1, cls: 2, sep: 3}
	if tok := m.Tokeny("Žena na pláži xyz!"); !reflect.DeepEqual(tok, []int32{2, 10, 11, 12, 13, 1, 14, 3}) {
		t.Fatalf("tokeny %v", tok)
	}
	dlouhy := ""
	for range 300 {
		dlouhy += "na "
	}
	if tok := m.Tokeny(dlouhy); len(tok) != maxTokenu || tok[len(tok)-1] != 3 {
		t.Fatalf("délka %d", len(tok))
	}
}

// Int8 po řádcích: násobení odpovídá float32 do zaokrouhlení
func TestMaticeInt8(t *testing.T) {
	m := naInt8(tenzor{[]int{2, 3}, []float32{1, -2, 0.5, 0, 0, 0}})
	y := m.nasobit([]float32{1, 1, 1}, 1, []float32{0.5, 1})
	if y[0] < -0.02 || y[0] > 0.02 || y[1] != 1 {
		t.Fatalf("y %v", y)
	}
}
