// Volby vzhledu (ROADMAP 1.49, okno app/vzhled.js): přiblížení rozhraní, hustota a velikost a obsah karet.
// Uložené jako ostatní volby okna v localStorage; na kořeni stránky se projeví atributy a proměnnými, které čte
// style.css. Přiblížení je CSS zoom na kořeni (Wails na Linuxu přiblížení stránky nenabízí): procentní rozměry
// se mu přizpůsobí samy, 100vh a 100vw nahrazují --vh a --vw a plovoucí prvky umístěné podle souřadnic myši
// nebo prvku převádí naCss().

export const PRIBLIZENI = { min: 0.9, max: 1.5, krok: 0.1 };
export const VELIKOSTI = /** @type {const} */ (['s', 'm', 'l']);
export const POHLEDY_KARET = /** @type {const} */ (['modelky', 'fotky', 'steny']);

/** @typedef {{ priblizeni: number, hustota: 'pohodlna' | 'kompaktni', karty: Record<string, string>, karta: { srdicka: boolean, rok: boolean, fotek: boolean } }} Vzhled */

/** @returns {Vzhled} */
export const vychozi = () => ({ priblizeni: 1, hustota: 'pohodlna', karty: { modelky: 'm', fotky: 'm', steny: 'm' }, karta: { srdicka: true, rok: false, fotek: false } });

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
    return v;
}

let aktualni = vychozi();

export const vzhled = () => aktualni;
export const priblizeni = () => aktualni.priblizeni;

// Souřadnice z getBoundingClientRect / události (zvětšené přiblížením) na hodnotu pro style.left / top
export const naCss = (px) => px / aktualni.priblizeni;

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
    // Pohledy, které počítají rozložení z rozměrů (mapa, grafy), se překreslí
    window.dispatchEvent(new Event('resize'));
}

/** Uloží a projeví změnu */
export function zmenit(zmena) {
    const v = platnyVzhled({ ...aktualni, ...zmena, karty: { ...aktualni.karty, ...(zmena.karty || {}) }, karta: { ...aktualni.karta, ...(zmena.karta || {}) } });
    try { localStorage.setItem('vzhled', JSON.stringify(v)); } catch { /* jen pro toto spuštění */ }
    pouzit(v);
    return v;
}

// Při načtení modulu (před prvním vykreslením): uložený vzhled hned
export function pripravit() {
    pouzit(nacist());
}
