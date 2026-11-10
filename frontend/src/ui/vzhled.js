// Volby vzhledu (ROADMAP 1.49, okno app/vzhled.js): přiblížení rozhraní, hustota a velikost a obsah karet.
// Uložené jako ostatní volby okna v localStorage; na kořeni stránky se projeví atributy a proměnnými, které čte
// style.css. Přiblížení je CSS zoom na kořeni (Wails na Linuxu přiblížení stránky nenabízí): procentní rozměry
// se mu přizpůsobí samy, 100vh a 100vw nahrazují --vh a --vw a plovoucí prvky umístěné podle souřadnic myši
// nebo prvku převádí naCss().

export const PRIBLIZENI = { min: 0.9, max: 1.5, krok: 0.1 };
export const VELIKOSTI = /** @type {const} */ (['s', 'm', 'l']);
export const POHLEDY_KARET = /** @type {const} */ (['modelky', 'fotky', 'steny']);
// 1.50: pohyb, prohlížeč fotek, karty Přehledu (Sbírka), sekce po startu a záhlaví profilu
export const POHYBY = /** @type {const} */ (['plny', 'omezeny', 'zadny']);
export const POZADI_PROHLIZECE = /** @type {const} */ (['tmave', 'cerne', 'rozmazane']);
export const OVLADANI_PROHLIZECE = /** @type {const} */ (['pohyb', 'trvale']);
export const KARTY_PREHLEDU = /** @type {const} */ (['cz', 'us', 'vybery', 'objevit', 'naposledy']);
export const STARTY = /** @type {const} */ (['modelky', 'cisla', 'sbirka', 'posledni']);
export const ZAHLAVI = /** @type {const} */ (['vysoke', 'pevne', 'pruh']);

/** @typedef {{ priblizeni: number, hustota: 'pohodlna' | 'kompaktni', karty: Record<string, string>, karta: { srdicka: boolean, rok: boolean, fotek: boolean },
 *   pohyb: string, prohlizec: { pozadi: string, ovladani: string, pas: boolean }, prehled: { poradi: string[], skryte: string[] }, start: string, zahlavi: string }} Vzhled */

/** @returns {Vzhled} */
export const vychozi = () => ({ priblizeni: 1, hustota: 'pohodlna', karty: { modelky: 'm', fotky: 'm', steny: 'm' }, karta: { srdicka: true, rok: false, fotek: false },
    pohyb: 'plny', prohlizec: { pozadi: 'tmave', ovladani: 'pohyb', pas: false }, prehled: { poradi: [...KARTY_PREHLEDU], skryte: [] }, start: 'modelky', zahlavi: 'vysoke' });

/**
 * Uložené volby doplněné výchozími; neplatné hodnoty se vrátí na výchozí
 * @param {any} ulozene
 * @returns {Vzhled}
 */
export function platnyVzhled(ulozene) {
    const v = vychozi();
    if (!ulozene || typeof ulozene !== 'object') return v;
    const p = Math.round(Number(ulozene.priblizeni) * 10) / 10;
    if (p >= PRIBLIZENI.min && p <= PRIBLIZENI.max) v.priblizeni = p;
    if (ulozene.hustota === 'kompaktni') v.hustota = 'kompaktni';
    for (const k of POHLEDY_KARET) if (VELIKOSTI.includes(ulozene.karty?.[k])) v.karty[k] = ulozene.karty[k];
    for (const k of /** @type {const} */ (['srdicka', 'rok', 'fotek'])) if (typeof ulozene.karta?.[k] === 'boolean') v.karta[k] = ulozene.karta[k];
    if (POHYBY.includes(ulozene.pohyb)) v.pohyb = ulozene.pohyb;
    if (POZADI_PROHLIZECE.includes(ulozene.prohlizec?.pozadi)) v.prohlizec.pozadi = ulozene.prohlizec.pozadi;
    if (OVLADANI_PROHLIZECE.includes(ulozene.prohlizec?.ovladani)) v.prohlizec.ovladani = ulozene.prohlizec.ovladani;
    if (typeof ulozene.prohlizec?.pas === 'boolean') v.prohlizec.pas = ulozene.prohlizec.pas;
    // Pořadí karet Přehledu: uložené známé karty, chybějící (nové) na konec; skryté jen známé
    const poradi = Array.isArray(ulozene.prehled?.poradi) ? ulozene.prehled.poradi.filter((k, i, a) => KARTY_PREHLEDU.includes(k) && a.indexOf(k) === i) : [];
    v.prehled.poradi = [...poradi, ...KARTY_PREHLEDU.filter(k => !poradi.includes(k))];
    if (Array.isArray(ulozene.prehled?.skryte)) v.prehled.skryte = KARTY_PREHLEDU.filter(k => ulozene.prehled.skryte.includes(k));
    if (STARTY.includes(ulozene.start)) v.start = ulozene.start;
    if (ZAHLAVI.includes(ulozene.zahlavi)) v.zahlavi = ulozene.zahlavi;
    return v;
}

let aktualni = vychozi();

export const vzhled = () => aktualni;
export const priblizeni = () => aktualni.priblizeni;

// Souřadnice z getBoundingClientRect / události (zvětšené přiblížením) na hodnotu pro style.left / top
export const naCss = (px) => px / aktualni.priblizeni;

// Omezit pohyb: volba Omezený / Žádný, nebo (u Plného) systémové omezení animací
export const omezitPohyb = () => aktualni.pohyb !== 'plny' || matchMedia('(prefers-reduced-motion: reduce)').matches;

// Plynulé posouvání (scrollTo / scrollBy / scrollIntoView s behavior: 'smooth') je při omezeném pohybu okamžité.
// Jedno místo místo úprav ve všech pohledech, které posouvají.
function hlidatPlynulePosouvani() {
    const bezPlynuleho = (a) => (a && typeof a === 'object' && a.behavior === 'smooth' && omezitPohyb() ? { ...a, behavior: 'auto' } : a);
    for (const nazev of /** @type {const} */ (['scrollTo', 'scrollBy', 'scrollIntoView'])) {
        const puvodni = Element.prototype[nazev];
        Element.prototype[nazev] = function (...args) { return puvodni.apply(this, args.length === 1 ? [bezPlynuleho(args[0])] : args); };
    }
}

function nacist() {
    try { return platnyVzhled(JSON.parse(localStorage.getItem('vzhled') || 'null')); } catch { return vychozi(); }
}

/** Projeví volby na kořeni stránky */
export function pouzit(v = aktualni) {
    aktualni = platnyVzhled(v);
    const koren = document.documentElement;
    koren.style.zoom = aktualni.priblizeni === 1 ? '' : String(aktualni.priblizeni);
    if (aktualni.priblizeni === 1) koren.style.removeProperty('--priblizeni');
    else koren.style.setProperty('--priblizeni', String(aktualni.priblizeni));
    koren.dataset.hustota = aktualni.hustota;
    for (const k of POHLEDY_KARET) koren.dataset[`karty${k[0].toUpperCase()}${k.slice(1)}`] = aktualni.karty[k];
    koren.toggleAttribute('data-karta-bez-srdicek', !aktualni.karta.srdicka);
    koren.toggleAttribute('data-karta-rok', aktualni.karta.rok);
    koren.toggleAttribute('data-karta-fotek', aktualni.karta.fotek);
    koren.dataset.pohyb = aktualni.pohyb;
    koren.dataset.prohlizecPozadi = aktualni.prohlizec.pozadi;
    koren.dataset.prohlizecOvladani = aktualni.prohlizec.ovladani;
    koren.toggleAttribute('data-prohlizec-pas', aktualni.prohlizec.pas);
    koren.dataset.zahlavi = aktualni.zahlavi;
    window.dispatchEvent(new CustomEvent('vzhled-zmenen'));
    // Pohledy, které počítají rozložení z rozměrů (mapa, grafy), se překreslí
    window.dispatchEvent(new Event('resize'));
}

/** Uloží a projeví změnu */
export function zmenit(zmena) {
    const v = platnyVzhled({ ...aktualni, ...zmena, karty: { ...aktualni.karty, ...(zmena.karty || {}) }, karta: { ...aktualni.karta, ...(zmena.karta || {}) },
        prohlizec: { ...aktualni.prohlizec, ...(zmena.prohlizec || {}) }, prehled: { ...aktualni.prehled, ...(zmena.prehled || {}) } });
    try { localStorage.setItem('vzhled', JSON.stringify(v)); } catch { /* jen pro toto spuštění */ }
    pouzit(v);
    return v;
}

// Při načtení modulu (před prvním vykreslením): uložený vzhled hned
export function pripravit() {
    hlidatPlynulePosouvani();
    pouzit(nacist());
}
