// Potvrzený druh fotky (0.02.061, Explicitní fotky zvlášť): pózovací, lesbická, sex, nebo jen s mužem (scéna,
// zákulisí). Platí pro soubor na Disku ve všech albech. Potvrzuje se v Údržbě › Druh fotek a v nabídce fotky.
import { GetDruhFotky, SetDruhFotek } from './backend';
import { oznamit } from '../ui/oznameni';
import { contextMenu, otevritKontextovouNabidku } from '../ui/nabidka';

/** @type {ReadonlyArray<[string, string]>} klíč druhu, název */
export const DRUHY_FOTEK = Object.freeze([
    ['pozovaci', 'Pózovací'],
    ['lesbicka', 'Lesbická'],
    ['sex', 'Sex'],
    ['muz', 'Jen s mužem (bez sexu)'],
]);
export const nazevDruhu = (/** @type {string} */ k) => DRUHY_FOTEK.find(([d]) => d === k)?.[1] || '';

/**
 * Potvrdí druh souborů (prázdný druh potvrzení smaže) a nabídne Vrátit
 * @param {string[]} ids @param {string} druh
 * @param {{ predchozi?: string, poZmene?: () => void }} [moznosti] predchozi = druh před změnou (u jedné fotky)
 */
export async function potvrditDruh(ids, druh, { predchozi = '', poZmene = () => {} } = {}) {
    const n = await SetDruhFotek(ids, druh).catch(() => 0);
    if (!n) { oznamit('Druh fotky se nepodařilo uložit.'); return 0; }
    const text = druh ? `${n === 1 ? 'Fotka' : `${n.toLocaleString('cs-CZ')} fotek`}: ${nazevDruhu(druh).toLowerCase()}.` : 'Druh fotky už není potvrzený.';
    oznamit(text, { text: 'Vrátit', akce: async () => {
        await SetDruhFotek(ids, predchozi).catch(() => 0);
        poZmene();
    } });
    poZmene();
    return n;
}

// Nabídka druhu u fotky (z nabídky fotky): otevře se na místě, kde byla nabídka fotky
export async function nabidkaDruhu(/** @type {{ driveId?: string }} */ fotka, poZmene = () => {}) {
    if (!fotka?.driveId) return;
    const x = parseFloat(contextMenu.style.left) || 100, y = parseFloat(contextMenu.style.top) || 100;
    const ted = await GetDruhFotky(fotka.driveId).catch(() => '');
    otevritKontextovouNabidku(x, y, [
        { nadpis: 'Druh fotky' },
        ...DRUHY_FOTEK.map(([k, nazev]) => ({
            text: `${k === ted ? '✓ ' : ''}${nazev}`,
            akce: () => (k === ted ? undefined : potvrditDruh([fotka.driveId], k, { predchozi: ted, poZmene })),
        })),
        ...(ted ? [null, { text: 'Nepotvrzený (zrušit)', akce: () => potvrditDruh([fotka.driveId], '', { predchozi: ted, poZmene }) }] : []),
    ]);
}
