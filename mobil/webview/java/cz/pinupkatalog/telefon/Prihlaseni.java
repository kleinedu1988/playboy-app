package cz.pinupkatalog.telefon;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import jadro.Jadro;

// Přihlášení Google (0.02.085) stejně jako na PC: jádro v Go připraví návrat na http://127.0.0.1:<port> s PKCE,
// tady se otevře prohlížeč a čeká se na návrat. Krátká služba v popředí drží proces při životě, než se uživatel
// v prohlížeči přihlásí (systém by aplikaci v pozadí zmrazil). Stránka návratu otevře pinupkatalog://prihlaseno.
public class Prihlaseni extends Service {
    // Z aktivity (je vidět, takže smí otevřít prohlížeč): adresa z jádra, prohlížeč, pak služba čeká na návrat
    static void zacit(Activity a) {
        String adresa;
        try {
            adresa = Jadro.zacitPrihlaseni();
        } catch (Exception e) {
            Hlavni.udalost("prihlaseni", e.getMessage());
            return;
        }
        Intent i = new Intent(a, Prihlaseni.class);
        Context c = a;
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
        else c.startService(i);
        a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(adresa)));
    }

    @Override
    public IBinder onBind(Intent i) {
        return null;
    }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("prihlaseni", "Přihlášení", NotificationManager.IMPORTANCE_LOW));
        Notification n = new Notification.Builder(this, "prihlaseni").setContentTitle("Pinup Katalog")
                .setContentText("Čeká na přihlášení ke Googlu v prohlížeči…").setSmallIcon(android.R.drawable.stat_sys_download).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
        else startForeground(1, n);
        new Thread(() -> konec(Jadro.dokoncitPrihlaseni())).start();
        return START_NOT_STICKY;
    }

    // Krátká služba vypršela (3 minuty): čekání se ukončí, jádro ohlásí nedokončené přihlášení
    @Override
    public void onTimeout(int id) {
        Jadro.zrusitPrihlaseni();
    }

    private void konec(String chyba) {
        Hlavni.udalost("prihlaseni", chyba == null ? "" : chyba);
        stopForeground(true);
        stopSelf();
    }
}
