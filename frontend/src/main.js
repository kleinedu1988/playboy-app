import './style.css';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { oznamit } from './ui/oznameni';
import { MaZamek, StavDatabaze } from './app/backend';
import { stav } from './app/stav';
import { nacistSpecialy } from './app/mezipamet';
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
import * as zkratky from './app/zkratky';
import * as vyvoj from './app/vyvoj';
import { stats } from './app/prvky';

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
ctecka.pripravit();
naseptavac.pripravit();
statistiky.pripravit(stats);
vyvoj.pripravit(stats);

// Chyby z backendu se ukazují v okně, ne jen v konzoli
EventsOn('chyba', (zprava) => oznamit(zprava));
StavDatabaze().then((chyba) => {
    if (chyba) oznamit(chyba, { text: 'Rozumím', akce: () => {} });
});

// Spuštění: nejdřív případný zámek, potom přehled, ve kterém se program naposledy zavřel
(async () => {
    stav.maZamek = await MaZamek();
    if (stav.maZamek) await odemknoutPriStartu();
    // Po aktualizaci jednou ukáže, co je nového (až po odemčení)
    napoveda.ukazatNovinkyPoAktualizaci();

    await nacistSpecialy();
    let posledni = null;
    try { posledni = localStorage.getItem('posledniRezim'); } catch { /* bez úložiště začne galerií */ }
    if (prepinacRezimu.querySelector(`[data-rezim="${posledni}"]`)) prepnoutRezim(posledni);
    nacistGalerii();
    kontrolaPoSpusteni();
})();
