#!/usr/bin/env bash
# Měření kostry na telefonu (0.02.078): nainstaluje APK z mobil/vystup přes adb (telefon s Laděním USB), každou
# variantu pětkrát spustí za studena (am start -W, TotalTime) a uloží snímek obrazovky do mobil/vystup.
#
#   mobil/merit.sh
#   ABI=amd64 mobil/merit.sh   (emulátor x86_64: varianty B a C s příponou -amd64)
set -euo pipefail
: "${ANDROID_HOME:=$HOME/Android/Sdk}"
ADB=$ANDROID_HOME/platform-tools/adb
ABI=${ABI:-arm64}
PRIPONA=$([ "$ABI" = arm64 ] || echo "-$ABI")
cd "$(dirname "$0")/vystup"

if [ "$($ADB devices | grep -c 'device$')" -ne 1 ]; then
	echo "Připoj právě jeden telefon s Laděním USB (adb devices):" >&2
	$ADB devices -l >&2
	exit 1
fi
echo "Telefon: $($ADB shell getprop ro.product.model | tr -d '\r'), Android $($ADB shell getprop ro.build.version.release | tr -d '\r')"

merit() {
	local apk=$1 balicek=$2 aktivita=$3
	[ -f "$apk" ] || { echo "$apk: chybí (mobil/sestavit.sh)"; return; }
	$ADB install -r "$apk" >/dev/null
	local casy=()
	for _ in 1 2 3 4 5; do
		$ADB shell am force-stop "$balicek"
		sleep 1
		casy+=("$($ADB shell am start -W -n "$balicek/$aktivita" | tr -d '\r' | sed -n 's/^TotalTime: //p')")
		sleep 3
	done
	$ADB exec-out screencap -p >"snimek-${apk%.apk}.png"
	local serazene
	serazene=$(printf '%s\n' "${casy[@]}" | sort -n | tr '\n' ' ')
	printf '%-24s %6s kB  start (ms, seřazeno): %s\n' "$apk" "$(du -k "$apk" | cut -f1)" "$serazene"
	$ADB logcat -d -s PinupKatalog:I | tail -1 || true
	$ADB shell am force-stop "$balicek"
}

$ADB logcat -c || true
merit pinup-webview.apk cz.pinupkatalog.telefon cz.pinupkatalog.telefon.Hlavni
merit "pinup-webview-go$PRIPONA.apk" cz.pinupkatalog.telefon.go cz.pinupkatalog.telefon.Hlavni
merit "pinup-fyne$PRIPONA.apk" cz.pinupkatalog.fyne org.golang.app.GoNativeActivity
