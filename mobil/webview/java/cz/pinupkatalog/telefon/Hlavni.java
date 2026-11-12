package cz.pinupkatalog.telefon;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

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

    static final String INSTALACE = "cz.pinupkatalog.telefon.INSTALACE";

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        if (INSTALACE.equals(i.getAction())) vysledekInstalace(i);
    }

    // Instalace nové verze (0.02.088): APK stažené jádrem → relace systémového instalátoru; uživatel potvrdí
    // v dialogu systému, po instalaci se aplikace sama restartuje do nové verze
    void instalovat(File apk) throws Exception {
        PackageInstaller pi = getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams parametry = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        int id = pi.createSession(parametry);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (OutputStream o = s.openWrite("aplikace", 0, apk.length()); InputStream in = new FileInputStream(apk)) {
                byte[] buf = new byte[65536];
                for (int n; (n = in.read(buf)) > 0; ) o.write(buf, 0, n);
                s.fsync(o);
            }
            int prizn = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent zpet = PendingIntent.getActivity(this, 1, new Intent(this, Hlavni.class).setAction(INSTALACE), prizn);
            s.commit(zpet.getIntentSender());
        }
    }

    private void vysledekInstalace(Intent i) {
        int stav = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (stav == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent potvrzeni = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (potvrzeni != null) startActivity(potvrzeni);
        } else if (stav == PackageInstaller.STATUS_FAILURE_ABORTED) {
            udalost("instalace", "Instalace zrušena.");
        } else if (stav != PackageInstaller.STATUS_SUCCESS) {
            String text = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            udalost("instalace", "Instalace se nepovedla" + (text == null ? "." : ": " + text));
        }
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

        // Novější verze aplikace na Disku → událost „verze“ (JSON {verze, id}, nebo "")
        @JavascriptInterface
        public void zkontrolovatVerzi() {
            String moje = verze();
            new Thread(() -> udalost("verze", Jadro.novaVerze(moje))).start();
        }

        // Stáhne verzi z Disku a spustí instalaci; chyba → událost „instalace“
        @JavascriptInterface
        public void aktualizovat(String id) {
            if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
                udalost("instalace", "Povol instalaci aplikací z Pinup Katalogu, vrať se a klepni na Aktualizovat znovu.");
                return;
            }
            new Thread(() -> {
                File apk = new File(getCacheDir(), "aktualizace.apk");
                String chyba = Jadro.stahnoutAplikaci(id, apk.getAbsolutePath());
                if (chyba.isEmpty()) {
                    try {
                        instalovat(apk);
                    } catch (Exception e) {
                        chyba = "Instalace se nepovedla: " + e.getMessage();
                    }
                }
                udalost("instalace", chyba);
            }).start();
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
