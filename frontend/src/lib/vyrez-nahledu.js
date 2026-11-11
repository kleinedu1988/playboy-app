// Chytrý výřez náhledů (0.02.050): kam posunout ořezaný náhled (object-fit: cover), aby byla vidět postava a hlavně
// obličej. Vstupem jsou rámečky z detektoru (GetVyrezyFotek: postava a obličej jako x0, y0, x1, y1 v podílu strany)
// a poměry stran obrázku a rámu (šířka / výška). Výsledek je object-position v procentech; bez rámečku střed.

const STRED = Object.freeze({ x: 50, y: 50 });
// Nad obličejem zůstane kousek místa (podíl viditelné výšky), aby hlava nebyla nalepená na horní hranu
const NAD_OBLICEJEM = 0.12;

/**
 * Začátek viditelného okna délky f (podíl 0–1) v jedné ose. Celá postava se vejde → postava na střed okna.
 * Nevejde se → podle obličeje: vodorovně obličej na střed, svisle obličej nahoře s rezervou; bez obličeje
 * od začátku postavy (hlava bývá nahoře).
 * @param {number} f @param {number} p0 @param {number} p1 @param {number[] | null} o @param {boolean} svisle
 */
function zacatekOkna(f, p0, p1, o, svisle) {
    if (p1 - p0 <= f) return (p0 + p1) / 2 - f / 2;
    if (!o) return svisle ? p0 : (p0 + p1) / 2 - f / 2;
    return svisle ? o[0] - NAD_OBLICEJEM * f : (o[0] + o[1]) / 2 - f / 2;
}

/** object-position v % ze začátku okna: p = začátek / (1 − f), omezené na obrázek */
function procento(zacatek, f) {
    if (f >= 0.999) return 50;
    const z = Math.min(Math.max(zacatek, 0), 1 - f);
    return Math.round((z / (1 - f)) * 1000) / 10;
}

/**
 * Poloha ořezaného náhledu (object-position v %) pro obrázek s poměrem pomerObrazku v rámu s poměrem pomerRamu
 * @param {{ postava?: number[], oblicej?: number[] } | null | undefined} vyrez
 * @param {number} pomerObrazku @param {number} pomerRamu
 * @returns {{ x: number, y: number }}
 */
export function polohaNahledu(vyrez, pomerObrazku, pomerRamu) {
    const p = vyrez?.postava;
    if (!p || p.length !== 4 || !(pomerObrazku > 0) || !(pomerRamu > 0)) return STRED;
    const o = vyrez.oblicej?.length === 4 ? vyrez.oblicej : null;
    // Viditelný podíl šířky a výšky obrázku při object-fit: cover
    const fx = Math.min(1, pomerRamu / pomerObrazku), fy = Math.min(1, pomerObrazku / pomerRamu);
    return {
        x: procento(zacatekOkna(fx, p[0], p[2], o && [o[0], o[2]], false), fx),
        y: procento(zacatekOkna(fy, p[1], p[3], o && [o[1], o[3]], true), fy),
    };
}

/** CSS hodnota object-position; střed vrací prázdný řetězec (výchozí styl) */
export const cssPolohy = ({ x, y }) => (x === 50 && y === 50 ? '' : `${x}% ${y}%`);
