// Modelky › Statistiky: vlastní pohled vedle Profilů a Galerie (dřív panel vpravo ve Sbírce). Nahoře hero s
// nejsilnějším postřehem sbírky (statistiky.js naplnitHeroStatistik), pod ním panel Postřehy, graf a modelky výběru.
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

// Po zápisu do databáze se při dalším otevření spočítá znovu (otevřený pohled hned)
let zastarale = false;
poZmeneDat(() => {
    zastarale = true;
    if (stav.rezim === 'statistiky' && !statistikyView.classList.contains('hidden')) otevritStatistiky();
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
    await naplnitHeroStatistik(hero());
}

// Statistiky po překreslení (změna grafu, výběru) oznámí nové volby: lišta je převezme, když je pohled vidět
document.addEventListener('volby-prehledu', () => {
    if (stav.rezim !== 'statistiky' || statistikyView.classList.contains('hidden')) return;
    obnovitPasHlavicky(statistikyView);
    obnovitVolby(statistikyView);
    naplnitHeroStatistik(hero(), { jenPriZmene: true });
});
