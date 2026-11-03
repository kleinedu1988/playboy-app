import { esc } from '../lib/format';
import { ikonaZobrazeni } from './volby';

// Plovoucí pás stránky (Hodnocení, Síň slávy, Sbírka): jeden komponent pro všechny tři. Vlevo pilulky částí (ikona,
// název, číslo jen u toho, co čeká na akci), vpravo nejvýš dvě informace (.pas-info). Šipky mezi pilulkami obsluhuje
// pripravitPasy pro všechny pásy; přepnutí dělá klik na pilulku (data-<atribut>="klíč"), který obslouží stránka.

// pilulky: [{ klic, nazev, pocet?, titulek?, zvolena }], atribut: název data atributu bez „data-“
export const htmlPilulek = (pilulky, atribut) => pilulky.map(p => `<button type="button" role="tab" class="slava-pohled ${p.zvolena ? 'active' : ''}" data-${atribut}="${esc(p.klic)}" aria-selected="${p.zvolena}" tabindex="${p.zvolena ? 0 : -1}"${p.titulek ? ` title="${esc(p.titulek)}"` : ''}>${ikonaZobrazeni(p.nazev)}<span class="pas-nazev">${esc(p.nazev)}</span>${p.pocet ? `<small>${p.pocet}</small>` : ''}</button>`).join('');

export const htmlPasu = ({ popis, pilulky, atribut, vpravo = '' }) =>
    `<div class="plovouci-pas"><nav class="slava-pohledy" role="tablist" aria-label="${esc(popis)}">${htmlPilulek(pilulky, atribut)}</nav>${vpravo}</div>`;

// Plovoucí pás stránky: při rolování drží nahoře (CSS sticky). Přilepený dostane
// třídu .prilepeny – schová informace vpravo a zůstanou jen pilulky částí. Jeho výšku dostanou další lepivé prvky
// pod ním (lišta nástrojů a bok Údržby) v proměnné --vyska-pasu, aby se pod něj neschovaly.
export function pripravitPasy() {
    const hlavni = document.querySelector('main');
    if (!hlavni) return;
    let ceka = false;
    // Pásy se pamatují: hledat je v celém <main> při každém snímku rolování (desítky tisíc prvků galerie) bylo drahé;
    // znovu se najdou po překreslení stránky (volby-prehledu) nebo když některý z DOM zmizí
    /** @type {HTMLElement[] | null} */
    let pasy = null;
    let posledniVyska = '';
    const obnovit = () => {
        ceka = false;
        if (!pasy || pasy.some(p => !p.isConnected)) pasy = /** @type {HTMLElement[]} */ ([...hlavni.querySelectorAll('.plovouci-pas')]);
        let vyska = 0;
        if (pasy.length) {
            const horni = hlavni.getBoundingClientRect().top;
            pasy.forEach((pas) => {
                if (!pas.getClientRects().length) return;
                pas.classList.toggle('prilepeny', hlavni.scrollTop > 0 && pas.getBoundingClientRect().top <= horni + 1);
                vyska = pas.offsetHeight;
            });
        }
        // Bez pásu (Modelky, profil…) nic neposouvá; jinak i fokus a skok na prvek (scroll-padding) končí pod pásem.
        // Zapisuje se jen při změně (zápis stylu v každém snímku vynucuje přepočet)
        const nova = `${vyska}px`;
        if (nova !== posledniVyska) {
            posledniVyska = nova;
            hlavni.style.setProperty('--vyska-pasu', nova);
        }
    };
    const naplanovat = () => {
        if (ceka) return;
        ceka = true;
        requestAnimationFrame(obnovit);
    };
    hlavni.addEventListener('scroll', naplanovat, { passive: true });
    // Šipky mezi pilulkami pásu (jako záložky), Home/End na první a poslední: klik na sousední pilulku, pás se
    // překreslí a fokus dostane nově zvolená. Zachytí se dřív než klávesy stránky (šipky v Porovnání listují pásy).
    document.addEventListener('keydown', (e) => {
        const pilulka = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.plovouci-pas [role="tab"], #pasStranky [role="tab"]'));
        if (!pilulka || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
        const vsechny = /** @type {HTMLElement[]} */ ([...pilulka.parentElement.querySelectorAll('[role="tab"]')]);
        const i = vsechny.indexOf(pilulka);
        const n = vsechny.length;
        const nova = vsechny[e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n];
        e.preventDefault();
        e.stopImmediatePropagation();
        if (nova === pilulka) return;
        nova.click();
        requestAnimationFrame(() => /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.plovouci-pas [role="tab"][aria-selected="true"], #pasStranky [role="tab"][aria-selected="true"]')])
            .find(t => t.getClientRects().length)?.focus({ preventScroll: true }));
    });
    // Pás se při změně části nebo filtru vykreslí znovu (bez třídy): stav se obnoví hned
    document.addEventListener('volby-prehledu', () => {
        pasy = null;
        naplanovat();
    });
    window.addEventListener('resize', naplanovat);
}
