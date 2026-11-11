// Propojení ven a zpět (0.02.056, Přehledná Sbírka): profil modelky a stránka čísla ukazují „N úkolů ve Sbírce“;
// klik otevře Sbírka › Úkoly › Po modelkách přímo na kartě modelky nebo čísla. Místo, odkud se přišlo, se
// zapamatuje (Zpět vrátí na profil / číslo). Opačný směr (z karty úkolu na profil / číslo) je v udrzba-fokus.js.
import { stav } from './stav';
import { searchInput, stats } from './prvky';
import { prepnoutRezim, zapamatovatMisto } from './navigace';
import { nacistGalerii } from './galerie';
import { sklonovat } from '../lib/format';
import * as udrzba from './udrzba';

// Prázdné místo pro odkaz; vyplní ho doplnitOdkazy, až budou úkoly spočítané (bez úkolů zůstane skryté)
export const htmlOdkazuUkolu = (/** @type {string} */ klicSkupiny, trida = 'link') =>
    `<button type="button" class="${trida} ukoly-sbirky" data-ukoly-sbirky="${klicSkupiny.replace(/"/g, '')}" hidden></button>`;

export async function doplnitOdkazy(/** @type {ParentNode} */ koren) {
    const tlacitka = /** @type {HTMLElement[]} */ ([...koren.querySelectorAll('[data-ukoly-sbirky]')]);
    if (!tlacitka.length) return;
    const pocty = await udrzba.poctyUkoluSkupin().catch(() => null);
    if (!pocty) return;
    tlacitka.forEach((b) => {
        const n = pocty.get(b.dataset.ukolySbirky || '') || 0;
        b.hidden = !n;
        if (!n) return;
        b.textContent = `${sklonovat(n, 'úkol', 'úkoly', 'úkolů')} ve Sbírce`;
        b.title = 'Otevřít Sbírka › Úkoly › Po modelkách na této kartě (Zpět vrátí sem)';
    });
}

// Sbírka › Úkoly › Po modelkách na kartě skupiny; počká, až se Sbírka načte a ukáže
export function otevritUkoly(/** @type {string} */ klicSkupiny) {
    zapamatovatMisto({});
    stav.prehledSekce = 'udrzba';
    stav.sbirkaPanel = '';
    stav.udrzbaRezim = 'modelky';
    prepnoutRezim('prehled');
    nacistGalerii(searchInput.value);
    let pokus = 0;
    const zkusit = () => {
        const hotovo = !stats.classList.contains('hidden') && udrzba.jeNacteno() && document.querySelector('.sbirka-hlava:not(.hidden)');
        if (hotovo) udrzba.nastavitRezim('modelky', klicSkupiny);
        else if (pokus++ < 100) setTimeout(zkusit, 100);
    };
    setTimeout(zkusit, 0);
}

export function pripravit() {
    document.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-ukoly-sbirky]'));
        if (!b?.dataset.ukolySbirky) return;
        e.preventDefault();
        e.stopPropagation();
        otevritUkoly(b.dataset.ukolySbirky);
    }, true);
}
