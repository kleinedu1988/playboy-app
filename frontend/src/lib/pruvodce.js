// Logika průvodce hodnocením fotky bez DOM (kroky dodává backend: pruvodce_fotky.go GetKrokyPruvodce). Stav jedné
// fotky: index kroku, vybrané tagy celé fotky (stávající + předvyplněné + zvolené), navržené (předvyplněné podle
// minulé fotky alba, dokud se krok nepotvrdí), potvrzené kroky a srdíčka. Výlučný krok („jeden“) číslice vybere
// a rovnou pokračuje; „více“ číslice přepíná a Enter potvrdí; 0 = žádná jen u volitelných kroků.

/** @typedef {{ tagy: string[], ne: boolean }} Podminka */
/** @typedef {{ klic: string, nazev: string, skupina: string, vylucna: boolean }} Moznost */
/** @typedef {{ klic: string, nazev: string, typ: string, povinny: boolean, nula: string, moznosti: Moznost[], preskocit: Podminka | null, tlumit: { moznosti: string[], kdyz: Podminka }[], predvyplnit: string[], skupiny: string[] }} Krok */
/** @typedef {{ krok: number, vybrane: Set<string>, navrh: Set<string>, potvrzene: Set<string>, hodnoceni: number, hotovo: boolean }} StavPruvodce */

/** @param {Podminka | null | undefined} p @param {Set<string>} vybrane */
export function plati(p, vybrane) {
    if (!p) return false;
    const ma = (p.tagy || []).some(t => vybrane.has(t));
    return p.ne ? !ma : ma;
}

/** @param {Krok} krok @param {Set<string>} vybrane */
export const preskocen = (krok, vybrane) => plati(krok.preskocit, vybrane);

/** Ztlumené možnosti kroku @param {Krok} krok @param {Set<string>} vybrane */
export function tlumene(krok, vybrane) {
    const v = new Set();
    (krok.tlumit || []).forEach(t => { if (plati(t.kdyz, vybrane)) t.moznosti.forEach(m => v.add(m)); });
    return v;
}

/** Další nepřeskočený krok za i (nebo kroky.length) @param {Krok[]} kroky */
export function dalsiKrok(kroky, i, vybrane) {
    let j = i + 1;
    while (j < kroky.length && preskocen(kroky[j], vybrane)) j++;
    return j;
}

/** Předchozí nepřeskočený krok před i (nebo -1) @param {Krok[]} kroky */
export function predchoziKrok(kroky, i, vybrane) {
    let j = i - 1;
    while (j >= 0 && preskocen(kroky[j], vybrane)) j--;
    return j;
}

/** Viditelné kroky (pro tečky postupu) @param {Krok[]} kroky */
export const viditelneKroky = (kroky, vybrane) => kroky.map((k, i) => i).filter(i => !preskocen(kroky[i], vybrane));

/**
 * Nový stav fotky: stávající tagy, u kroků bez tagu předvyplnění z minulé fotky alba (jen tagy, které krok dovolí)
 * @param {Krok[]} kroky @param {string[]} tagyFotky @param {string[]} podleAlba
 * @returns {StavPruvodce}
 */
export function novyStav(kroky, tagyFotky = [], podleAlba = []) {
    const vybrane = new Set(tagyFotky);
    const navrh = new Set();
    kroky.forEach((k) => {
        const moznosti = new Set(k.moznosti.map(m => m.klic));
        if ([...vybrane].some(t => moznosti.has(t))) return;
        podleAlba.filter(t => moznosti.has(t) && (k.predvyplnit || []).includes(t)).forEach((t) => {
            vybrane.add(t);
            navrh.add(t);
        });
    });
    const s = { krok: 0, vybrane, navrh, potvrzene: new Set(), hodnoceni: 0, hotovo: false };
    if (preskocen(kroky[0], vybrane)) s.krok = dalsiKrok(kroky, 0, vybrane);
    return s;
}

/** Vybrané tagy kroku @param {Krok} krok @param {StavPruvodce} s */
export const vybraneKroku = (krok, s) => krok.moznosti.map(m => m.klic).filter(t => s.vybrane.has(t));

function potvrditKrok(kroky, s) {
    const krok = kroky[s.krok];
    s.potvrzene.add(krok.klic);
    krok.moznosti.forEach(m => s.navrh.delete(m.klic));
    s.krok = dalsiKrok(kroky, s.krok, s.vybrane);
}

/**
 * Číslice 1–9 (u srdíček 1–5); vrací 'dal' (krok hotový), 'zmena', 'hotovo' (srdíčka – fotka hotová) nebo ''
 * @param {Krok[]} kroky @param {StavPruvodce} s @param {number} cislo
 */
export function cislice(kroky, s, cislo) {
    const krok = kroky[s.krok];
    if (!krok) return '';
    if (krok.typ === 'srdicka') {
        if (cislo < 1 || cislo > 5) return '';
        s.hodnoceni = cislo;
        s.potvrzene.add(krok.klic);
        s.hotovo = true;
        return 'hotovo';
    }
    const m = krok.moznosti[cislo - 1];
    if (!m || tlumene(krok, s.vybrane).has(m.klic)) return '';
    const mel = s.vybrane.has(m.klic) && !s.navrh.has(m.klic);
    // Výlučná skupina: jiné hodnoty té skupiny pryč
    if (m.vylucna) krok.moznosti.filter(x => x.skupina === m.skupina).forEach((x) => { s.vybrane.delete(x.klic); s.navrh.delete(x.klic); });
    if (krok.typ === 'jeden') {
        s.vybrane.add(m.klic);
        potvrditKrok(kroky, s);
        return 'dal';
    }
    s.navrh.delete(m.klic);
    if (mel) s.vybrane.delete(m.klic);
    else s.vybrane.add(m.klic);
    // Předvyplněné ostatní možnosti kroku se volbou potvrdí
    krok.moznosti.forEach(x => s.navrh.delete(x.klic));
    return 'zmena';
}

/** 0 = žádná (jen volitelný krok): krok bez tagů a dál; vrací 'dal' nebo '' @param {Krok[]} kroky @param {StavPruvodce} s */
export function zadna(kroky, s) {
    const krok = kroky[s.krok];
    if (!krok || krok.povinny || krok.typ === 'srdicka') return '';
    krok.moznosti.forEach((m) => { s.vybrane.delete(m.klic); s.navrh.delete(m.klic); });
    potvrditKrok(kroky, s);
    return 'dal';
}

/** Enter: potvrdí výběr (i předvyplněný); povinný krok bez výběru → 'chybi'; vrací 'dal', 'chybi' nebo '' */
export function potvrdit(kroky, s) {
    const krok = kroky[s.krok];
    if (!krok || krok.typ === 'srdicka') return '';
    if (!vybraneKroku(krok, s).length) {
        if (krok.povinny) return 'chybi';
        return zadna(kroky, s);
    }
    potvrditKrok(kroky, s);
    return 'dal';
}

/** Zpět o krok; vrací false na prvním kroku */
export function zpet(kroky, s) {
    const j = predchoziKrok(kroky, s.krok, s.vybrane);
    if (j < 0) return false;
    s.krok = j;
    s.hotovo = false;
    return true;
}

/** Shift+Enter: tagy jako minulá fotka (krokům, které na ně odpovídají) a rovnou na srdíčka */
export function jakoMinula(kroky, s, tagyMinule) {
    const posledni = kroky.length - 1;
    kroky.slice(0, posledni).forEach((k) => {
        k.moznosti.forEach((m) => { s.vybrane.delete(m.klic); s.navrh.delete(m.klic); });
        tagyMinule.filter(t => k.moznosti.some(m => m.klic === t)).forEach(t => s.vybrane.add(t));
        if (!preskocen(k, s.vybrane)) s.potvrzene.add(k.klic);
    });
    s.krok = posledni;
}

/** Skupiny katalogu potvrzených kroků (backend v nich nahradí tagy fotky) */
export function zodpovezeneSkupiny(kroky, s) {
    return [...new Set(kroky.filter(k => s.potvrzene.has(k.klic)).flatMap(k => k.skupiny || []))];
}

/** Číslice z klávesy podle fyzické klávesy (horní řada na českém rozložení dává ě š č…, numerická klávesnice) */
export function cisloKlavesy(e) {
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '');
    if (m) return Number(m[1]);
    return /^[0-9]$/.test(e.key || '') ? Number(e.key) : null;
}
