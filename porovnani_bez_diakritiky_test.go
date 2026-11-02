package main

import (
	"strings"
	"testing"
)

// Rychlá cesta COLLATE BEZDIAKRITIKY dává stejné pořadí jako porovnání zjednodušených textů
func TestPorovnatBezDiakritiky(t *testing.T) {
	texty := []string{"", "a", "A", "ab", "Ab", "abc", "b", "Anna", "anna", "Anna Nováková", "Anna Novakova", "Žaneta", "zaneta", "Čestmír",
		"cestmir", "Zoe", "zoe ", "Z", "_x", "1", "Ann", "Annb", "ANNA", "Éva", "Eva"}
	znamenko := func(n int) int {
		switch {
		case n < 0:
			return -1
		case n > 0:
			return 1
		}
		return 0
	}
	for _, a := range texty {
		for _, b := range texty {
			if x, y := znamenko(porovnatBezDiakritiky(a, b)), znamenko(strings.Compare(zjednodusit(a), zjednodusit(b))); x != y {
				t.Errorf("%q vs %q: %d, čekáno %d", a, b, x, y)
			}
		}
	}
}
