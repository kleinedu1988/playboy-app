package cz.pinupkatalog.telefon;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

// Kostra telefonu (0.02.078): WebView se stránkou z assets. Varianta s jádrem v Go (gomobile bind) má třídu
// jadro.Jadro; bez ní stránka ukáže „bez jádra v Go“. Čas od startu procesu do vykreslení stránky se zapíše do
// logu (značka PinupKatalog) – měření startu.
public class Hlavni extends Activity {
    @Override
    protected void onCreate(Bundle stav) {
        super.onCreate(stav);
        WebView web = new WebView(this);
        web.setBackgroundColor(Color.rgb(18, 10, 14));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.addJavascriptInterface(new Most(), "telefon");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    // Most pro stránku: verze jádra v Go (je-li v APK) a hlášení vykreslení
    public static class Most {
        @JavascriptInterface
        public String jadro() {
            try {
                Class<?> c = Class.forName("jadro.Jadro");
                return (String) c.getMethod("popis").invoke(null);
            } catch (Throwable e) {
                return "";
            }
        }

        @JavascriptInterface
        public void vykresleno(double msStranky) {
            long odStartu = SystemClock.elapsedRealtime() - android.os.Process.getStartElapsedRealtime();
            android.util.Log.i("PinupKatalog", "vykresleno: " + odStartu + " ms od startu procesu, stránka " + Math.round(msStranky) + " ms");
        }
    }
}
