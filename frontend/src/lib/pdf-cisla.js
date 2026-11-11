// Listování v PDF čísla (0.02.035): dvoustrany jako v tištěném časopise – obálka (strana 1) sama, pak 2–3, 4–5…,
// poslední bez dvojice sama. Strany se číslují od 1.

/**
 * Strany zobrazené spolu se stranou s
 * @param {number} s @param {number} pocet @param {boolean} dvoustrana
 * @returns {number[]}
 */
export function stranyZobrazeni(s, pocet, dvoustrana) {
    if (pocet < 1) return [];
    const x = Math.min(Math.max(1, Math.round(s) || 1), pocet);
    if (!dvoustrana || x === 1) return [x];
    const leva = x % 2 === 0 ? x : x - 1;
    return leva + 1 <= pocet ? [leva, leva + 1] : [leva];
}

/**
 * První strana dalšího (smer 1) nebo předchozího (smer -1) zobrazení; na kraji zůstane
 * @param {number} s @param {number} pocet @param {boolean} dvoustrana @param {1 | -1} smer
 */
export function dalsiZobrazeni(s, pocet, dvoustrana, smer) {
    const ted = stranyZobrazeni(s, pocet, dvoustrana);
    if (!ted.length) return 1;
    const cil = smer > 0 ? ted[ted.length - 1] + 1 : ted[0] - 1;
    return cil < 1 || cil > pocet ? ted[0] : stranyZobrazeni(cil, pocet, dvoustrana)[0];
}

/**
 * Měřítko vykreslení: strany vedle sebe se vejdou do plochy (lupa 1 = přizpůsobit), lupa ho násobí
 * @param {{ sirka: number, vyska: number }[]} strany rozměry stran v bodech PDF @param {number} sirkaPlochy
 * @param {number} vyskaPlochy @param {number} lupa
 */
export function meritkoZobrazeni(strany, sirkaPlochy, vyskaPlochy, lupa = 1) {
    if (!strany.length || sirkaPlochy <= 0 || vyskaPlochy <= 0) return 1;
    const sirka = strany.reduce((s, x) => s + x.sirka, 0);
    const vyska = Math.max(...strany.map(x => x.vyska));
    return Math.min(sirkaPlochy / sirka, vyskaPlochy / vyska) * lupa;
}

export const LUPY = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** Další stupeň lupy nahoru (smer 1) nebo dolů (-1) */
export function dalsiLupa(lupa, smer) {
    if (smer > 0) return LUPY.find(l => l > lupa + 1e-9) ?? LUPY[LUPY.length - 1];
    return [...LUPY].reverse().find(l => l < lupa - 1e-9) ?? LUPY[0];
}
