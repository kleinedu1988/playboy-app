#!/bin/bash
# Instalace programu do domovské složky (bez sudo): spustitelný soubor, ikona a položka v nabídce aplikací.
#
#   ./instalovat.sh                  sestaví program a nainstaluje ho (stejně i aktualizace)
#   ./instalovat.sh --bez-sestaveni  nainstaluje už sestavený build/bin/playboy-app
#   ./instalovat.sh --odinstalovat   odebere program z nabídky i ze ~/.local/bin; data a zálohy zůstanou
#
# Data sbírky jsou zvlášť v ~/.local/share/playboy-app a instalace ani odinstalace na ně nesahá.
set -euo pipefail

cd "$(dirname "$0")"
NAZEV=playboy-app
BIN="$HOME/.local/bin/$NAZEV"
IKONA="$HOME/.local/share/icons/hicolor/256x256/apps/$NAZEV.png"
POLOZKA="$HOME/.local/share/applications/$NAZEV.desktop"

obnovit_nabidku() {
    command -v update-desktop-database >/dev/null && update-desktop-database -q "$HOME/.local/share/applications" || true
    command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
}

if [ "${1:-}" = "--odinstalovat" ]; then
    rm -f "$BIN" "$IKONA" "$POLOZKA"
    obnovit_nabidku
    echo "Program je odinstalovaný. Data a zálohy zůstaly v ~/.local/share/$NAZEV."
    exit 0
fi

if [ "${1:-}" != "--bez-sestaveni" ]; then
    if ! command -v wails >/dev/null; then
        export PATH="$PATH:$HOME/go/bin"
    fi
    wails build -tags webkit2_41
fi
if [ ! -x "build/bin/$NAZEV" ]; then
    echo "Chybí build/bin/$NAZEV – nejdřív program sestav (wails build)." >&2
    exit 1
fi

mkdir -p "$(dirname "$BIN")" "$(dirname "$IKONA")" "$(dirname "$POLOZKA")"
# Přes dočasný soubor: běžící program se při aktualizaci nepřepíše uprostřed čtení
install -m 0755 "build/bin/$NAZEV" "$BIN.novy"
mv -f "$BIN.novy" "$BIN"
if command -v magick >/dev/null; then
    magick build/appicon.png -resize 256x256 "$IKONA"
elif command -v convert >/dev/null; then
    convert build/appicon.png -resize 256x256 "$IKONA"
else
    install -m 0644 build/appicon.png "$IKONA"
fi
cat > "$POLOZKA" <<EOF
[Desktop Entry]
Type=Application
Name=Playboy Database
Comment=Katalog sbírky: modelky, alba, čísla časopisu
Exec=$BIN
Icon=$NAZEV
Terminal=false
Categories=Graphics;Viewer;
StartupWMClass=$NAZEV
EOF
obnovit_nabidku

echo "Nainstalováno: $BIN"
echo "Program je v nabídce aplikací jako „Playboy Database“."
