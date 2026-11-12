#!/usr/bin/env bash
# Aplikace pro telefon (0.02.085): WebView se stránkou z assets a jádrem v Go (gomobile bind, mobil/jadro – stejné
# přihlášení Google a Disk jako program na PC). Bez Gradle. Výstup: mobil/vystup/pinup-katalog.apk a jeho verze
# v pinup-katalog.verze (mimo git); program na PC je při nahrání zálohy nahraje na Disk a aplikace v telefonu
# nabídne aktualizaci (0.02.088).
#
# Podpis: stálý klíč ~/.config/pinup-katalog/telefon.keystore (mimo git; poprvé převzatý z ladicího klíče
# ~/.android/debug.keystore, kterým byly podepsané verze do 0.02.087, jinak nový). Android novou verzi nainstaluje
# přes starou jen se stejným klíčem – klíč zálohuj; bez něj je potřeba aplikaci odinstalovat a nainstalovat znovu.
#
# Přihlašovací údaje programu se do APK zkopírují z ~/.config/pinup-katalog/google-klient.json (stejné jako na PC;
# v gitu nejsou). Potřeba: Android SDK (ANDROID_HOME, výchozí ~/Android/Sdk) s platformou, build-tools a NDK;
# JDK 17+ (JAVA_HOME, výchozí ~/Android/jdk21); gomobile v ~/go/bin.
#
#   mobil/sestavit.sh                 (telefon arm64)
#   ABI=amd64 mobil/sestavit.sh       (emulátor x86_64)
#   mobil/sestavit.sh --instalovat    (a nainstalovat do připojeného telefonu přes adb)
set -euo pipefail

: "${ANDROID_HOME:=$HOME/Android/Sdk}"
: "${JAVA_HOME:=$HOME/Android/jdk21}"
export ANDROID_HOME JAVA_HOME
NDK=$(ls -d "$ANDROID_HOME"/ndk/* | sort -V | tail -1)
export ANDROID_NDK_HOME=$NDK
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
PLATFORMA=$(ls -d "$ANDROID_HOME"/platforms/android-* | sort -V | tail -1)
JAR=$PLATFORMA/android.jar
export PATH="$JAVA_HOME/bin:$HOME/go/bin:$PATH"
ABI=${ABI:-arm64}
VERZE=$(sed -n 's/^const Verze = "\(.*\)"/\1/p' "$(dirname "$0")/../verze.go")
KOD=$(echo "$VERZE" | awk -F. '{print $1*1000000 + $2*1000 + $3}')
KLIENT=${XDG_CONFIG_HOME:-$HOME/.config}/pinup-katalog/google-klient.json

cd "$(dirname "$0")"
mkdir -p vystup
KLIC=$(dirname "$KLIENT")/telefon.keystore
if [ ! -f "$KLIC" ]; then
	mkdir -p "$(dirname "$KLIC")"
	if [ -f "$HOME/.android/debug.keystore" ]; then
		cp "$HOME/.android/debug.keystore" "$KLIC"
	else
		keytool -genkeypair -keystore "$KLIC" -storepass android -keypass android -alias androiddebugkey \
			-keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Pinup Katalog,C=CZ" >/dev/null
	fi
	chmod 600 "$KLIC"
	echo "Podpisový klíč aplikace: $KLIC (zálohuj ho)"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Jádro v Go
(cd jadro && GOFLAGS= gomobile bind -target="android/$ABI" -androidapi 26 -ldflags="-s -w" -o "$tmp/jadro.aar" .)
unzip -q "$tmp/jadro.aar" -d "$tmp/aar"

# Stránka a přihlašovací údaje programu
cp -r webview/assets "$tmp/assets"
if [ -f "$KLIENT" ]; then
	cp "$KLIENT" "$tmp/assets/klient.json"
else
	echo "Pozor: chybí $KLIENT – aplikace se nebude moci přihlásit" >&2
fi

"$BT/aapt2" compile --dir webview/res -o "$tmp/res.zip"
"$BT/aapt2" link -o "$tmp/zaklad.apk" -I "$JAR" --manifest webview/AndroidManifest.xml -A "$tmp/assets" \
	"$tmp/res.zip" --java "$tmp/gen" --min-sdk-version 26 --target-sdk-version 36 \
	--version-code "$KOD" --version-name "$VERZE"
javac --release 11 -nowarn -classpath "$JAR:$tmp/aar/classes.jar" -d "$tmp/tridy" $(find webview/java "$tmp/gen" -name '*.java')
"$BT/d8" --release --lib "$JAR" --min-api 26 --output "$tmp" "$tmp"/tridy/cz/pinupkatalog/telefon/*.class "$tmp/aar/classes.jar"
(cd "$tmp" && zip -q -j zaklad.apk classes.dex)
mkdir -p "$tmp/lib"
cp -r "$tmp/aar/jni/"* "$tmp/lib/"
(cd "$tmp" && zip -q -r -0 zaklad.apk lib)
"$BT/zipalign" -f -p 4 "$tmp/zaklad.apk" "$tmp/zarovnany.apk"
"$BT/apksigner" sign --ks "$KLIC" --ks-pass pass:android --out vystup/pinup-katalog.apk "$tmp/zarovnany.apk"
rm -f vystup/pinup-katalog.apk.idsig
echo "$VERZE" >vystup/pinup-katalog.verze
echo "pinup-katalog.apk $VERZE: $(du -k vystup/pinup-katalog.apk | cut -f1) kB"

if [ "${1:-}" = --instalovat ]; then
	"$ANDROID_HOME/platform-tools/adb" install -r vystup/pinup-katalog.apk
fi
