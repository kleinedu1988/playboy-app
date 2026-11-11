// Přehledná Sbírka (0.02.052): jediný seznam stránek Sbírky a režimů Úkolů. Z něj se kreslí lišta Sbírky
// (app/udrzba.js), mapa sekcí (app/cover.js) i cesta Zpět (app/navigace.js), takže se všude jmenují stejně.
//
// Stránka se odvozuje ze stavu: panel Čísla a sháním / Učení (stav.sbirkaPanel), jinak režim Údržby – „dnes“ je
// Přehled, ostatní režimy jsou Úkoly.

/** @typedef {'prehled' | 'ukoly' | 'cisla' | 'uceni'} StrankaSbirky */

/** @type {ReadonlyArray<{ klic: StrankaSbirky, nazev: string, popis: string }>} */
export const STRANKY_SBIRKY = Object.freeze([
    { klic: 'prehled', nazev: 'Přehled', popis: 'Jak je sbírka doplněná, dnešní dávka úkolů a co běží na pozadí' },
    { klic: 'ukoly', nazev: 'Úkoly', popis: 'Co doplnit a zkontrolovat: po údajích, po modelkách, stejné a otočené fotky, rozdíly z webu' },
    { klic: 'cisla', nazev: 'Čísla a sháním', popis: 'Mapa čísel po edicích a seznam čísel, která sháníš' },
    { klic: 'uceni', nazev: 'Učení', popis: 'Co se program naučil z tvých srdíček a tagů' },
]);

// Režimy stránky Úkoly: [klíč režimu Údržby, název, popis do nápovědy]
export const REZIMY_UKOLU = Object.freeze([
    ['udaje', 'Po údajích', 'Jeden údaj, všechny modelky, kterým chybí: píšeš rovnou do řádků, Enter uloží a jde dolů'],
    ['modelky', 'Po modelkách', 'Jedna modelka a všechny její úkoly na jedné kartě, vpravo fronta'],
    ['stejne', 'Stejné fotky', 'Tatáž fotka ve sbírce víckrát (jiný soubor, přeuložená nebo zmenšená kopie): nechat jednu, nebo označit jako v pořádku'],
    ['fotky', 'Otočené a výřezy', 'Fotky na boku nebo vzhůru nohama (otočit jedním klikem), malé, rozmazané, přepálené a tmavé fotky (vyměnit za lepší stejnou) a titulní fotky s výchozím výřezem (navrhnout výřez z postavy)'],
    ['web', 'Z webu', 'Průchod sbírkou proti Wikidatům, Wikipedii a Boobpedii; rozdíly přijmout po jednom, po údaji nebo po zdroji, nebo odmítnout'],
    ['souhrn', 'Fronta', 'Celá fronta úkolů s filtry podle oblasti a zdroje'],
]);

export const PRVNI_REZIM_UKOLU = 'udaje';
export const jeRezimUkolu = (/** @type {string} */ rezim) => REZIMY_UKOLU.some(([k]) => k === rezim);

/**
 * Stránka Sbírky pro stav (panel a režim Údržby)
 * @param {{ sbirkaPanel?: string, udrzbaRezim?: string }} s
 * @returns {StrankaSbirky}
 */
export function strankaSbirky(s) {
    if (s.sbirkaPanel === 'cisla' || s.sbirkaPanel === 'uceni') return s.sbirkaPanel;
    return jeRezimUkolu(s.udrzbaRezim || '') ? 'ukoly' : 'prehled';
}

/**
 * Stav, který ukáže stránku: panel a režim Údržby. Úkoly otevře v naposledy použitém režimu úkolů. Pod panelem
 * (Čísla a sháním, Učení) je Přehled – úzká fronta úkolů vedle panelu se láme (do 0.02.053, kdy z panelů budou
 * celé stránky).
 * @param {string} klic @param {{ udrzbaRezim?: string }} s @param {string} [posledniUkoly]
 * @returns {{ sbirkaPanel: string, udrzbaRezim: string }}
 */
export function stavStrankySbirky(klic, s, posledniUkoly = '') {
    const rezim = s.udrzbaRezim || 'dnes';
    if (klic === 'cisla' || klic === 'uceni') return { sbirkaPanel: klic, udrzbaRezim: 'dnes' };
    if (klic === 'ukoly') {
        return { sbirkaPanel: '', udrzbaRezim: jeRezimUkolu(rezim) ? rezim : jeRezimUkolu(posledniUkoly) ? posledniUkoly : PRVNI_REZIM_UKOLU };
    }
    return { sbirkaPanel: '', udrzbaRezim: 'dnes' };
}

export const nazevStrankySbirky = (/** @type {string} */ klic) => STRANKY_SBIRKY.find(s => s.klic === klic)?.nazev || 'Přehled';
export const nazevRezimuUkolu = (/** @type {string} */ klic) => REZIMY_UKOLU.find(([k]) => k === klic)?.[1] || '';
