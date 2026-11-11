// Chytrý výřez náhledů (0.02.050): kam posunout ořezaný náhled (object-fit: cover), aby byla vidět postava a hlavně
// obličej. Vstupem jsou rámečky z detektoru (GetVyrezyFotek: postava a obličej jako x0, y0, x1, y1 v podílu strany)
// a poměry stran obrázku a rámu (šířka / výška). Výsledek je object-position v procentech; bez rámečku střed.

const STRED = Object.freeze({ x: 50, y: 50 });

// Tvar podle místa (0.02.051): kam v rámu patří postava a obličej, podle skutečného poměru rámu.
// cilX = vodorovná poloha středu postavy/obličeje v okně (0–1); nad = místo nad obličejem (podíl viditelné výšky).
// Dlaždice a karty (i úzký rám hera vedle textu): obličej uprostřed, hlava kousek pod horní hranou. Široký rám
// (od 1,6 : 1): nízké okno, obličej níž, ať je vidět i trup. Široký banner s textem vlevo (hero): postava doprava.
export const TVARY = Object.freeze({
    dlazdice: Object.freeze({ cilX: 0.5, nad: 0.12 }),
    siroky: Object.freeze({ cilX: 0.5, nad: 0.22 }),
    hero: Object.freeze({ cilX: 0.68, nad: 0.22 }),
});
export const SIROKY_RAM = 1.6;

/**
 * Začátek viditelného okna délky f (podíl 0–1) v jedné ose. Celá postava se vejde → postava na cíl (svisle na
 * střed). Nevejde se → podle obličeje: vodorovně obličej na cíl, svisle obličej nahoře s rezervou nad; bez
 * obličeje vodorovně postava na cíl, svisle od začátku postavy (hlava bývá nahoře).
 * @param {number} f @param {number} p0 @param {number} p1 @param {number[] | null} o @param {boolean} svisle
 * @param {{ cilX: number, nad: number }} tvar
 */
function zacatekOkna(f, p0, p1, o, svisle, tvar) {
    const cil = svisle ? 0.5 : tvar.cilX;
    if (p1 - p0 <= f) return (p0 + p1) / 2 - cil * f;
    if (!o) return svisle ? p0 : (p0 + p1) / 2 - cil * f;
    return svisle ? o[0] - tvar.nad * f : (o[0] + o[1]) / 2 - cil * f;
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
 * @param {'dlazdice' | 'hero'} [tvar] místo náhledu: dlaždice (výchozí) nebo banner s textem vlevo
 * @returns {{ x: number, y: number }}
 */
export function polohaNahledu(vyrez, pomerObrazku, pomerRamu, tvar = 'dlazdice') {
    const p = vyrez?.postava;
    if (!p || p.length !== 4 || !(pomerObrazku > 0) || !(pomerRamu > 0)) return STRED;
    const o = vyrez.oblicej?.length === 4 ? vyrez.oblicej : null;
    // Viditelný podíl šířky a výšky obrázku při object-fit: cover
    const fx = Math.min(1, pomerRamu / pomerObrazku), fy = Math.min(1, pomerObrazku / pomerRamu);
    const t = pomerRamu < SIROKY_RAM ? TVARY.dlazdice : tvar === 'hero' ? TVARY.hero : TVARY.siroky;
    return {
        x: procento(zacatekOkna(fx, p[0], p[2], o && [o[0], o[2]], false, t), fx),
        y: procento(zacatekOkna(fy, p[1], p[3], o && [o[1], o[3]], true, t), fy),
    };
}

/** CSS hodnota object-position; střed vrací prázdný řetězec (výchozí styl) */
export const cssPolohy = ({ x, y }) => (x === 50 && y === 50 ? '' : `${x}% ${y}%`);
// ID souboru z adresy obrázku (/nahled/<id>/… přes mezipaměť, …/d/<id>=… na Disku) – pro místa, kde pohled zná
// jen adresu (hero Kalendáře a Obálek)
export function idZAdresy(/** @type {string} */ adresa) {
    const m = /\/nahled\/([\w-]{10,})\/|\/d\/([\w-]{10,})=|[?&]id=([\w-]{10,})/.exec(String(adresa || ''));
    return m ? m[1] || m[2] || m[3] : '';
}
