// Hero Kalendáře (0.02.023): který ročník zvolené řady ukázat nahoře a jak je úplný. Vstupem je mapa měsíčních
// čísel řady ve sbírce (klíč → { cover, centerfold, pictorial, modelka, nahled }) jako v kalendar.js.
import { MESICE, ciselRocniku, cisloNevyslo, slozitVydani } from './format.js';

const mesic = i => String(i + 1).padStart(2, '0');

/**
 * Ročník do hera: napřed ročníky, jejichž číslo z dnešního měsíce je ve sbírce (výročí, od nejnovějšího), pak
 * ostatní od nejnovějšího; posun = kolikátý další (tlačítko Další ročník), dokola.
 * @param {Map<string, any>} vydani @param {string} rada @param {Date} [dnes] @param {number} [posun]
 * @returns {{ rok: number, vyroci: string, pocet: number } | null}
 */
export function vybratRocnik(vydani, rada, dnes = new Date(), posun = 0) {
    const roky = [...new Set([...vydani.keys()].map(k => parseInt(k.slice(0, 4), 10)))].sort((a, b) => b - a);
    if (!roky.length) return null;
    const tento = mesic(dnes.getMonth());
    const vyroci = roky.filter(r => r < dnes.getFullYear() && vydani.has(slozitVydani(String(r), tento, rada)));
    const poradi = [...vyroci, ...roky.filter(r => !vyroci.includes(r))];
    const rok = poradi[((posun % poradi.length) + poradi.length) % poradi.length];
    return { rok, vyroci: vyroci.includes(rok) ? slozitVydani(String(rok), tento, rada) : '', pocet: poradi.length };
}

/**
 * Úplnost ročníku: vyšlá čísla, kolik jich sbírka má, s coverem, centerfoldem, pictorialem a se vším (kompletní)
 * a chybějící klíče v pořadí měsíců
 * @param {Map<string, any>} vydani @param {number} rok @param {string} rada
 */
export function uplnostRocniku(vydani, rok, rada) {
    const vysla = MESICE.map((_, i) => slozitVydani(String(rok), mesic(i), rada)).filter(k => !cisloNevyslo(k));
    const mame = vysla.map(k => vydani.get(k)).filter(Boolean);
    const pocet = vlastnost => mame.filter(v => v[vlastnost]).length;
    return {
        cisel: ciselRocniku(rok, rada) || vysla.length, mame: mame.length,
        cover: pocet('cover'), centerfold: pocet('centerfold'), pictorial: pocet('pictorial'),
        kompletni: mame.filter(v => v.cover && v.centerfold && v.pictorial).length,
        chybi: vysla.filter(k => !vydani.has(k)),
    };
}

// „před rokem“, „před 2 lety“, „před 41 lety“
export const predLety = n => (n === 1 ? 'před rokem' : `před ${n} lety`);
