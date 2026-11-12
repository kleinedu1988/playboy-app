package cz.pinupkatalog.telefon;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

import jadro.Jadro;

// Aplikace pro telefon (0.02.085): WebView se stránkou z assets (index.html). Most „telefon“ dává stránce stav
// přihlášení, přihlášení a odhlášení a balíček sbírky – všechno dělá jádro v Go (jadro.Jadro, mobil/jadro, stejný
// kód jako program na PC). Dlouhé věci běží ve vlákně a stránce dají vědět voláním window.udalost(název, text).
public class Hlavni extends Activity {
    static Hlavni aktivni;
    WebView web;

    @Override
    protected void onCreate(Bundle stav) {
        super.onCreate(stav);
        aktivni = this;
        byte[] klient = new byte[0];
        try (InputStream in = getAssets().open("klient.json")) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
            klient = b.toByteArray();
        } catch (Exception ignored) {
        }
        Jadro.nastavit(getFilesDir().getAbsolutePath(), klient);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(18, 10, 14));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setWebChromeClient(new WebChromeClient());
        // Odkazy mimo aplikaci do prohlížeče
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, u));
                return true;
            }
        });
        web.addJavascriptInterface(new Most(), "telefon");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
    }

    @Override
    protected void onResume() {
        super.onResume();
        udalost("navrat", "");
    }

    @Override
    protected void onDestroy() {
        if (aktivni == this) aktivni = null;
        super.onDestroy();
    }

    // Zpět: nejdřív stránka (zavře detail), jinak aplikace
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.zpet ? window.zpet() : false", v -> {
            if (!"true".equals(v)) Hlavni.super.onBackPressed();
        });
    }

    static void udalost(String nazev, String text) {
        Hlavni h = aktivni;
        if (h == null || h.web == null) return;
        String js = "window.udalost && window.udalost(" + JSONObject.quote(nazev) + "," + JSONObject.quote(text) + ")";
        h.runOnUiThread(() -> h.web.evaluateJavascript(js, null));
    }

    public class Most {
        @JavascriptInterface
        public String stav() {
            return Jadro.stav();
        }

        @JavascriptInterface
        public String verze() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void prihlasit() {
            runOnUiThread(() -> Prihlaseni.zacit(Hlavni.this));
        }

        @JavascriptInterface
        public void odhlasit() {
            Jadro.odhlasit();
        }

        // Uložený balíček (JSON) nebo prázdný řetězec
        @JavascriptInterface
        public String balicek() {
            return Jadro.balicek();
        }

        // Stáhne nový balíček z Disku; hotovo → událost „balicek“ („“ = v pořádku, jinak chyba)
        @JavascriptInterface
        public void stahnout() {
            new Thread(() -> udalost("balicek", Jadro.stahnout())).start();
        }
    }
}
