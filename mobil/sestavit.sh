#!/usr/bin/env bash
# Kostra Android aplikace (0.02.078) – sestavení tří variant pro měření, bez Gradle:
#   A  webview      Java + WebView, stránka z assets
#   B  webview-go   totéž s jádrem v Go (gomobile bind, jen arm64-v8a)
#   C  fyne         celé rozhraní v Go (fyne package)
# Výstup: mobil/vystup/*.apk (mimo git). Podepsáno ladicím klíčem ~/.android/debug.keystore (vznikne sám).
# Potřeba: Android SDK (ANDROID_HOME, výchozí ~/Android/Sdk) s platformou, build-tools a NDK; JDK 17+
# (JAVA_HOME, výchozí ~/Android/jdk21); gomobile a fyne v ~/go/bin.
#
#   mobil/sestavit.sh [a] [b] [c]     (bez argumentu všechny)
#   ABI=amd64 mobil/sestavit.sh b c   (pro emulátor x86_64; APK s příponou -amd64)
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
PRIPONA=$([ "$ABI" = arm64 ] || echo "-$ABI")
VERZE=$(sed -n 's/^const Verze = "\(.*\)"/\1/p' "$(dirname "$0")/../verze.go")
KOD=$(echo "$VERZE" | awk -F. '{print $1*1000000 + $2*1000 + $3}')

cd "$(dirname "$0")"
MOBIL=$PWD
mkdir -p vystup
KLIC=$HOME/.android/debug.keystore
if [ ! -f "$KLIC" ]; then
	mkdir -p "$HOME/.android"
	keytool -genkeypair -keystore "$KLIC" -storepass android -keypass android -alias androiddebugkey \
		-keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" >/dev/null
fi

# APK z WebView; $1 = název, $2 = AAR s jádrem v Go (nepovinné)
webview() {
	local nazev=$1 aar=${2:-}
	local tmp
	tmp=$(mktemp -d)
	trap 'rm -rf "$tmp"' RETURN
	local cp=$JAR prejmenovat=()
	if [ -n "$aar" ]; then
		# Vlastní ID, aby šly v telefonu vedle sebe obě varianty (třídy zůstávají v cz.pinupkatalog.telefon)
		prejmenovat=(--rename-manifest-package cz.pinupkatalog.telefon.go)
		unzip -q "$aar" -d "$tmp/aar"
		cp="$cp:$tmp/aar/classes.jar"
	fi
	"$BT/aapt2" compile --dir webview/res -o "$tmp/res.zip"
	"$BT/aapt2" link "${prejmenovat[@]}" -o "$tmp/zaklad.apk" -I "$JAR" --manifest webview/AndroidManifest.xml -A webview/assets \
		"$tmp/res.zip" --java "$tmp/gen" --min-sdk-version 26 --target-sdk-version 36 \
		--version-code "$KOD" --version-name "$VERZE"
	javac --release 11 -nowarn -classpath "$cp" -d "$tmp/tridy" $(find webview/java "$tmp/gen" -name '*.java')
	local vstupy=("$tmp"/tridy/cz/pinupkatalog/telefon/*.class)
	[ -n "$aar" ] && vstupy+=("$tmp/aar/classes.jar")
	"$BT/d8" --release --lib "$JAR" --min-api 26 --output "$tmp" "${vstupy[@]}"
	(cd "$tmp" && zip -q -j zaklad.apk classes.dex)
	if [ -n "$aar" ]; then
		mkdir -p "$tmp/lib"
		cp -r "$tmp/aar/jni/"* "$tmp/lib/"
		(cd "$tmp" && zip -q -r -0 zaklad.apk lib)
	fi
	"$BT/zipalign" -f -p 4 "$tmp/zaklad.apk" "$tmp/zarovnany.apk"
	"$BT/apksigner" sign --ks "$KLIC" --ks-pass pass:android --out "vystup/$nazev.apk" "$tmp/zarovnany.apk"
	rm -f "vystup/$nazev.apk.idsig"
	echo "$nazev: $(du -k "vystup/$nazev.apk" | cut -f1) kB"
}

varianty=("$@")
[ ${#varianty[@]} -eq 0 ] && varianty=(a b c)
for v in "${varianty[@]}"; do
	case $v in
	a) webview pinup-webview ;;
	b)
		(cd jadro && GOFLAGS= gomobile bind -target="android/$ABI" -androidapi 26 -o "$MOBIL/vystup/jadro$PRIPONA.aar" .)
		webview "pinup-webview-go$PRIPONA" "$MOBIL/vystup/jadro$PRIPONA.aar"
		;;
	c)
		(cd fyne && GOFLAGS= fyne package -os "android/$ABI" -app-id cz.pinupkatalog.fyne -release=false)
		mv fyne/*.apk "vystup/pinup-fyne$PRIPONA.apk"
		echo "pinup-fyne$PRIPONA: $(du -k "vystup/pinup-fyne$PRIPONA.apk" | cut -f1) kB"
		;;
	esac
done
