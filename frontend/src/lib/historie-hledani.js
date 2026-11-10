// Historie hledání (ROADMAP 1.52): posledních 20 dotazů pro našeptávač, nejnovější první, bez opakování
// (stejný dotaz bez ohledu na velikost písmen, diakritiku a mezery se jen přesune nahoru).
import { bezDiakritiky } from './format.js';

export const NEJVIC_HISTORIE = 20;
const klic = d => bezDiakritiky(String(d || '')).replace(/\s+/g, ' ').trim();

/** @param {string[]} seznam @param {string} dotaz @returns {string[]} */
export function pridatDotaz(seznam, dotaz, nejvic = NEJVIC_HISTORIE) {
    const d = String(dotaz || '').replace(/\s+/g, ' ').trim();
    if (d.length < 2) return seznam;
    return [d, ...seznam.filter(x => klic(x) !== klic(d))].slice(0, nejvic);
}

/** @param {string[]} seznam @param {string} dotaz @returns {string[]} */
export const odebratDotaz = (seznam, dotaz) => seznam.filter(x => klic(x) !== klic(dotaz));

// Dřívější dotazy, které obsahují psaný text (ne ten samý)
/** @param {string[]} seznam @param {string} text @returns {string[]} */
export function podobneDotazy(seznam, text, nejvic = 4) {
    const t = klic(text);
    if (!t) return seznam.slice(0, nejvic);
    return seznam.filter(x => klic(x) !== t && klic(x).includes(t)).slice(0, nejvic);
}

// Název chytrého výběru z dotazu (nejvýš 60 znaků, jako backend); obsazený název dostane číslo
/** @param {string} dotaz @param {string[]} obsazene @returns {string} */
export function nazevZDotazu(dotaz, obsazene = []) {
    const zaklad = [...String(dotaz || '').trim()].slice(0, 54).join('') || 'Hledání';
    const vzate = new Set(obsazene.map(n => klic(n)));
    if (!vzate.has(klic(zaklad))) return zaklad;
    for (let i = 2; ; i++) if (!vzate.has(klic(`${zaklad} (${i})`))) return `${zaklad} (${i})`;
}
