// Modelky › Statistiky: vlastní pohled vedle Profilů a Galerie (dřív panel vpravo ve Sbírce). Nahoře hero s
// postřehem sbírky a pásem karet (statistiky.js naplnitHeroStatistik; s výběrem čím se liší od sbírky), pod ním graf
// a modelky výběru.
// Volby grafu (Graf ▾, Výskyt, Edice, výběr) jsou jako jinde v liště pod hledáním.
import { statistikyView } from './prvky';
import { stav } from './stav';
import { ukazatPohled } from './navigace';
import { nacistStatistiky, naplnitHeroStatistik, zapomenoutStatistiky } from './statistiky';
import { obnovitVolby } from '../ui/volby';
import { obnovitPasHlavicky } from './prehled';
import { poZmeneDat } from './udalosti';

const sekce = () => /** @type {HTMLElement | null} */ (statistikyView.querySelector('.stat-statistiky'));
const hero = () => /** @type {HTMLElement | null} */ (statistikyView.querySelector('.sh-hero'));

// Po zápisu do databáze se při dalším otevření spočítá znovu; otevřený pohled až po chvíli klidu, aby série zápisů
// (srdíčka, import) nepřepočítávala Statistiky po každém
let zastarale = false;
let casovacZmeny = 0;
poZmeneDat(() => {
    zastarale = true;
    clearTimeout(casovacZmeny);
    casovacZmeny = setTimeout(() => {
        if (zastarale && stav.rezim === 'statistiky' && !statistikyView.classList.contains('hidden')) otevritStatistiky();
    }, 800);
});

export async function otevritStatistiky() {
    ukazatPohled(statistikyView);
    if (zastarale) {
        zapomenoutStatistiky(sekce());
        zastarale = false;
    }
    await nacistStatistiky(sekce());
    if (stav.rezim !== 'statistiky') return;
    obnovitVolby(statistikyView);
    // Hero se doplní na pozadí (jako u Profilů): start ani přepnutí na jeho fotku nečekají
    naplnitHeroStatistik(hero());
}

// Statistiky po překreslení (změna grafu, výběru) oznámí nové volby: lišta je převezme, když je pohled vidět
document.addEventListener('volby-prehledu', () => {
    if (stav.rezim !== 'statistiky' || statistikyView.classList.contains('hidden')) return;
    obnovitPasHlavicky(statistikyView);
    obnovitVolby(statistikyView);
    naplnitHeroStatistik(hero(), { jenPriZmene: true });
});
