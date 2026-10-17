// Velikosti obrázků z Disku a zástupný obrázek pro chybějící fotku
import { obrazek } from '../lib/format';

// Google Disk bez přípony vrací nejvýše 1600 px; =s0 je originál, =w600 úsporný náhled
export const VELIKOST_NAHLEDU = 'w400';       // dlaždice fotky v albu
export const VELIKOST_PLAKATU_MALA = 'w600';  // plakát na stěně, v coverech a v úzkém levém sloupci
export const VELIKOST_PLAKATU = 'w1200';      // plakát v širokém sloupci stránky vydání
export const VELIKOST_KARTY = 'w400';         // titulní fotka na kartě galerie
// Titulní fotka v profilu a při úpravě výřezu; rezerva pro přiblížení
export const VELIKOST_TITULNI = 'w800';

// Zástupný obrázek pro modelku bez titulní fotky nebo pro fotku, která se nenačetla
export const BEZ_FOTKY = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
        <rect width="300" height="400" fill="#18181c"/>
        <g fill="none" stroke="#3a3a42" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="95" y="150" width="110" height="90" rx="10"/>
            <circle cx="130" cy="182" r="10"/>
            <path d="M102 232l34-30 22 18 18-14 22 26"/>
        </g>
        <text x="150" y="275" fill="#5a5a62" font-family="sans-serif" font-size="16" text-anchor="middle">Bez fotky</text>
    </svg>`);

// Karta si vystačí s menším obrázkem, dokud výřez fotku výrazně nepřibližuje
export function adresaTitulni(modelka, velka = false) {
    if (!modelka.coverUrl) return BEZ_FOTKY;
    return obrazek(modelka.coverUrl, velka || modelka.coverZoom > 1.5 ? VELIKOST_TITULNI : VELIKOST_KARTY);
}
export const PLNE_ROZLISENI = 's0';

// Adresy náhledů, které se už jednou načetly: znovu vykreslená dlaždice je ukáže hned, bez plynulého objevení
const nactene = new Set();
const oznacit = img => {
    img.classList.add('nacteno');
    nactene.add(img.src);
};

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Náhled (img loading="lazy") je průhledný, dokud se nenačte, pak se plynule objeví (styl v style.css)
    document.addEventListener('load', (e) => {
        const img = /** @type {HTMLImageElement} */ (e.target);
        if (img.tagName === 'IMG' && img.loading === 'lazy') oznacit(img);
    }, true);
    // Nově vložený náhled, který už je v mezipaměti, se označí ještě před vykreslením (bez bliknutí)
    new MutationObserver(zmeny => zmeny.forEach(z => z.addedNodes.forEach(uzel => {
        if (uzel.nodeType !== 1) return;
        const prvek = /** @type {Element} */ (uzel);
        const obrazky = prvek.tagName === 'IMG' ? [prvek] : prvek.querySelectorAll('img[loading="lazy"]');
        obrazky.forEach(img => {
            const i = /** @type {HTMLImageElement} */ (img);
            if (i.loading === 'lazy' && (nactene.has(i.src) || (i.complete && i.naturalWidth))) oznacit(i);
        });
    }))).observe(document.body, { childList: true, subtree: true });

    // Fotka, která se nenačte (smazaná na Disku, bez připojení), se nahradí zástupným obrázkem
    document.addEventListener('error', (e) => {
        const img = /** @type {HTMLImageElement} */ (e.target);
        if (img.tagName !== 'IMG' || img.src === BEZ_FOTKY || img.closest('.lightbox')) return;
        img.src = BEZ_FOTKY;
    }, true);
}
