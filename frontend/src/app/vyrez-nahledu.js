// Chytrý výřez náhledů (0.02.050) na jednom místě: pohled jen označí ořezaný náhled atributem data-vyrez="<ID
// souboru>" (otočené fotky ne – rámečky detektoru platí pro neotočený obrázek). Tady se výřezy načtou po dávkách
// (GetVyrezyFotek) a po načtení obrázku se mu nastaví object-position podle jeho velikosti a rámu
// (lib/vyrez-nahledu.js). Bez výřezu (výpočet ještě neběžel, postava nenalezena) zůstane střed.
import { polohaNahledu, cssPolohy, priblizeniNahledu } from '../lib/vyrez-nahledu';
import { GetVyrezyFotek } from './backend';

/** @type {Map<string, any>} ID souboru → výřez z backendu (i bez postavy); „čeká“ se nepamatuje */
const vyrezy = new Map();
/** @type {Set<string>} */
const kNacteni = new Set();
let casovac = 0;
const DAVKA = 400;

function pouzit(/** @type {HTMLImageElement} */ img) {
    const v = vyrezy.get(img.dataset.vyrez || '');
    if (!v || !img.naturalWidth || !img.naturalHeight) return;
    const sirka = img.clientWidth, vyska = img.clientHeight;
    if (!sirka || !vyska) return;
    const tvar = img.dataset.vyrezTvar === 'hero' ? 'hero' : 'dlazdice';
    const pomer = img.naturalWidth / img.naturalHeight;
    const poloha = cssPolohy(polohaNahledu(v, pomer, sirka / vyska, tvar));
    if (img.style.objectPosition !== poloha) img.style.objectPosition = poloha;
    // Přiblížení ručního výřezu jen v rámu, který obrázek ořezává (jinak by přetekl přes okolí)
    const p = priblizeniNahledu(v, pomer, sirka / vyska);
    const orezava = p && img.parentElement && ['hidden', 'clip'].includes(getComputedStyle(img.parentElement).overflow);
    const scale = orezava ? String(p.zoom) : '';
    if (img.style.scale !== scale) {
        img.style.scale = scale;
        img.style.transformOrigin = orezava ? p.origin : '';
    }
}

// Po uložení nebo smazání ručního výřezu (0.02.058): fotka se načte znovu a náhledy se posunou
export function obnovitVyrez(/** @type {string} */ id) {
    vyrezy.delete(id);
    document.querySelectorAll(`img[data-vyrez="${CSS.escape(id)}"]`).forEach(img => pozadat(/** @type {HTMLImageElement} */ (img)));
}

async function nacist() {
    casovac = 0;
    const ids = [...kNacteni].slice(0, DAVKA);
    ids.forEach(id => kNacteni.delete(id));
    if (kNacteni.size) casovac = window.setTimeout(nacist, 0);
    let vysledek = [];
    try { vysledek = (await GetVyrezyFotek(ids)) || []; } catch { return; }
    const hotove = new Set();
    for (const v of vysledek) {
        if (v.zdroj === 'ceka') continue;
        vyrezy.set(v.driveId, v);
        hotove.add(v.driveId);
    }
    if (!hotove.size) return;
    document.querySelectorAll('img[data-vyrez]').forEach(img => {
        if (hotove.has(/** @type {HTMLImageElement} */ (img).dataset.vyrez)) pouzit(/** @type {HTMLImageElement} */ (img));
    });
}

function pozadat(/** @type {HTMLImageElement} */ img) {
    const id = img.dataset.vyrez;
    if (!id) return;
    if (vyrezy.has(id)) { pouzit(img); return; }
    kNacteni.add(id);
    if (!casovac) casovac = window.setTimeout(nacist, 30);
}

function projit(/** @type {ParentNode} */ koren) {
    koren.querySelectorAll?.('img[data-vyrez]').forEach(img => pozadat(/** @type {HTMLImageElement} */ (img)));
}

export function pripravit() {
    // Nové náhledy v okně (pohledy kreslí přes innerHTML) a obrázky načtené později (data-src, lazy)
    new MutationObserver((zaznamy) => {
        for (const z of zaznamy) {
            z.addedNodes.forEach((n) => {
                if (n instanceof HTMLImageElement && n.dataset.vyrez) pozadat(n);
                else if (n instanceof Element) projit(n);
            });
        }
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('load', (e) => {
        const t = e.target;
        if (t instanceof HTMLImageElement && t.dataset.vyrez) pouzit(t);
    }, true);
    // Fotky, které „čekaly“ na výpočet v pozadí, se zeptají znovu při dalším vykreslení („čeká“ se nepamatuje)
    projit(document);
}

// Atribut ořezaného náhledu do šablony pohledu: otočená fotka (rotace) ho nedostane; tvar 'hero' pro banner
export const atributVyrezu = (/** @type {{ driveId?: string, rotace?: number } | null | undefined} */ f, tvar = '') =>
    (f?.driveId && !f.rotace ? ` data-vyrez="${String(f.driveId).replace(/[^\w-]/g, '')}"${tvar ? ` data-vyrez-tvar="${tvar}"` : ''}` : '');

export { idZAdresy } from '../lib/vyrez-nahledu';
