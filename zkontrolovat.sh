#!/bin/bash
# Všechny kontroly před vydáním: ./zkontrolovat.sh (rychle, bez pomalých testů: ./zkontrolovat.sh --rychle)
set -euo pipefail
cd "$(dirname "$0")"
krok() { printf '\n== %s\n' "$*"; }

krok "Frontend: závislosti a sestavení (go:embed potřebuje frontend/dist)"
(cd frontend && { [ -d node_modules ] || npm ci; } && npm run build >/dev/null)
krok "Frontend: testy a typy"
(cd frontend && npm test && npm run typy)
krok "Go: formát, vet a testy (hlídají i verzi, kontrolní součet package.json a vazby na rozhraní)"
neformatovane=$(gofmt -l .)
[ -z "$neformatovane" ] || { echo "Neformátované soubory (gofmt -w): $neformatovane" >&2; exit 1; }
go vet ./...
if [ "${1:-}" = "--rychle" ]; then go test -short -count=1 ./...; else go test -count=1 ./...; fi
krok "Volitelné nástroje"
if command -v shellcheck >/dev/null; then shellcheck -e SC1111 instalovat.sh zkontrolovat.sh; else echo "shellcheck není – přeskočeno"; fi
if command -v govulncheck >/dev/null; then govulncheck ./...; else echo "govulncheck není – přeskočeno"; fi
krok "Pracovní strom"
if git status --porcelain | grep -q .; then echo "Pozor: necommitnuté změny"; else echo "čistý"; fi
printf '\nVše prošlo.\n'
