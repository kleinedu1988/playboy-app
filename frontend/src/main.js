import './style.css';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { oznamit } from './ui/oznameni';
import { GetOblibenost, GetSezona, GetVerze, MaZamek, StavDatabaze } from './app/backend';
import { krokUvodu, pockatNaNahledy, skrytUvod, ukazatUvod, ulozitProfilovkyUvodu, verzeUvodu, zapomenoutProfilovkyUvodu } from './ui/uvod';
import { stav } from './app/stav';
import { nacistSpecialy, vsechnyModelky } from './app/mezipamet';
import { prepinacRezimu, prepnoutRezim } from './app/navigace';
import { nacistGalerii } from './app/galerie';
import { kontrolaPoSpusteni, odemknoutPriStartu } from './app/sprava';
import * as obrazky from './app/obrazky';
import * as galerie from './app/galerie';
import * as profil from './app/profil';
import * as stena from './app/stena';
import * as vydani from './app/vydani';
import * as kalendar from './app/kalendar';
import * as prehled from './app/prehled';
import * as nejlepsi from './app/nejlepsi';
import * as cover from './app/cover';
import * as prohlizec from './app/prohlizec';
import * as vyber from './app/vyber';
import * as okno from './app/okno';
import * as formularModelky from './app/formular-modelky';
import * as formularAlba from './app/formular-alba';
import * as sprava from './app/sprava';
import * as nabidky from './app/nabidky';
import * as ulozeni from './app/ulozeni';
import * as klavesnice from './app/klavesnice';
import * as napoveda from './app/napoveda';
import * as doplneni from './app/doplneni';
import * as clanky from './app/clanky';
import * as ctecka from './app/ctecka';
import * as naseptavac from './app/naseptavac';
import * as statistiky from './app/statistiky';
import * as oblibenost from './app/oblibenost';
import * as zkratky from './app/zkratky';
import * as editorTextu from './ui/editor-textu';
import { stats } from './app/prvky';
import { vyhlasitSezonu } from './app/vyhlaseni-sezony';
import { spustitPredpripravu } from './app/predpriprava';

// Obsluha událostí se registruje v pořadí, v jakém byla v původním souboru. Přehled zkratek je první:
// když je otevřený, jeho obsluha kláves zastaví ostatní
zkratky.pripravit();
obrazky.pripravit();
galerie.pripravit();
profil.pripravit();
stena.pripravit();
vydani.pripravit();
kalendar.pripravit();
prehled.pripravit();
oblibenost.pripravit();
nejlepsi.pripravit();
cover.pripravit();
prohlizec.pripravit();
vyber.pripravit();
okno.pripravit();
formularModelky.pripravit();
formularAlba.pripravit();
sprava.pripravit();
nabidky.pripravit();
ulozeni.pripravit();
klavesnice.pripravit();
napoveda.pripravit();
doplneni.pripravit();
clanky.pripravit();
editorTextu.pripravit();
ctecka.pripravit();
naseptavac.pripravit();
statistiky.pripravit(stats);

// Chyby z backendu se ukazují v okně, ne jen v konzoli
EventsOn('chyba', (zprava) => oznamit(zprava));
StavDatabaze().then((chyba) => {
    if (chyba) oznamit(chyba, { text: 'Rozumím', akce: () => {} });
});

// Spuštění pod úvodní obrazovkou (ui/uvod.js): nejdřív případný zámek, potom přehled, ve kterém se program naposledy
// zavřel, jeho náhledy a data Hodnocení; úvod zmizí, až je vše připravené
(async () => {
    // Pojistka: úvod nesmí zůstat viset, ani kdyby se příprava zasekla
    const pojistka = setTimeout(skrytUvod, 15000);
    try {
        GetVerze().then(verzeUvodu).catch(() => {});
        stav.maZamek = await MaZamek();
        if (stav.maZamek) {
            ukazatUvod(false);
            await odemknoutPriStartu();
            ukazatUvod(true);
        }

        krokUvodu('Načítám sbírku…', 0.25);
        // Názvy speciálů a seznam modelek pro galerii se načítají souběžně
        const specialy = nacistSpecialy();
        vsechnyModelky().catch(() => {});
        await specialy;

        krokUvodu('Sestavuji galerii…', 0.5);
        let posledni = null;
        try { posledni = localStorage.getItem('posledniRezim'); } catch { /* bez úložiště začne galerií */ }
        if (posledni === 'nejlepsi') oblibenost.nastavitNejlepsiVOblibenosti(true);
        if (['kalendar', 'nejlepsi', 'centerfoldy'].includes(posledni) || prepinacRezimu.querySelector(`[data-rezim="${posledni}"]`)) prepnoutRezim(posledni);
        await nacistGalerii().catch(() => {});

        // Hodnocení se připraví dopředu (backend si výpočet pamatuje), mezitím se načtou náhledy první obrazovky
        krokUvodu('Načítám náhledy a připravuji Hodnocení…', 0.75);
        const hodnoceni = Promise.all([GetOblibenost(), GetSezona()]).catch(() => {});
        await Promise.all([pockatNaNahledy(2500), Promise.race([hodnoceni, new Promise(hotovo => setTimeout(hotovo, 2500))])]);
    } finally {
        clearTimeout(pojistka);
        skrytUvod();
    }
    // Nový náhodný výběr profilovek pro úvod příštího spuštění, až program doběhne (seznam modelek je už načtený);
    // se zámkem se neukládají – úvod je vidět dřív než okno s heslem
    setTimeout(() => {
        if (stav.maZamek) zapomenoutProfilovkyUvodu();
        else vsechnyModelky().then(m => ulozitProfilovkyUvodu(m, obrazky.adresaTitulni)).catch(() => {});
    }, 4000);
    // Mezipaměti backendu pro další pohledy se připraví v klidu po úvodu (app/predpriprava.js)
    spustitPredpripravu();
    // Po aktualizaci jednou ukáže, co je nového (až po odemčení a úvodu)
    napoveda.ukazatNovinkyPoAktualizaci();
    // Denní ověření souborů až po prvním vykreslení, ať nebrzdí start
    setTimeout(() => kontrolaPoSpusteni(), 5000);
    // Skončená sezóna oblíbenosti čeká na vyhlášení Favoritky (app/vyhlaseni-sezony.js); až po úvodních oknech
    setTimeout(() => vyhlasitSezonu(), 1500);
})();
