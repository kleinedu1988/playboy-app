// Průvodce hodnocením fotky v prohlížeči (Hodnocení › Hodnotit › Průvodce): skleněný pásek pod středem fotky
// s krokem průvodce (lib/pruvodce.js, kroky z backendu). Číslice 1–9 (i numerická klávesnice) vybírá, 0 = žádná,
// Enter / → dál, Backspace / ← zpět (na prvním kroku vrátí minulou fotku), Shift+Enter jako minulá fotka a rovnou
// srdíčka, S přeskočí (potvrzené kroky se zapíšou, fotka jde na konec fronty a nabídne se znovu), H skryje pásek,
// J přepne na „jen srdíčka“ (1–5 uloží jen srdíčka, tagy počkají na průvodce). Bez pohybu pásek po chvíli zeslábne.
// Srdíčka 1–5 fotku uloží jako prošlou a ukáže další; zápis běží za ní (nepovedený ji vrátí). Fotka, která už srdíčka
// má, krok srdíček přeskočí a uloží se po posledním kroku tagů (srdíčka zůstanou).
import { GetKrokyPruvodce, GetTagyFotek, UlozitPruvodceFotky, VratitPruvodceFotky } from './backend';
import { cislice, cisloKlavesy, jakoMinula, novyStav, potvrdit, predchoziKrok, tlumene, viditelneKroky, vybraneKroku, zadna, zodpovezeneSkupiny, zpet } from '../lib/pruvodce';
import { stav } from './stav';
import { lbNaplnitListu, lbZobrazit, lightbox, zavritLightbox } from './prohlizec';
import { oznamitHodnoceniFotek } from './galerie';
import { esc } from '../lib/format';
import { oznamit } from '../ui/oznameni';

const KLIC_SKRYTI = 'pruvodceSkryty';

/** @type {import('../lib/pruvodce').Krok[]} */
let kroky = [];
let stavy = new Map(); // položka → stav průvodce
const tagyFotek = new Map(); // id fotky → tagy (načtené při zobrazení)
let podleAlba = new Map(); // klíč alba → tagy minulé uložené fotky alba
let posledni = null; // tagy minulé uložené fotky (Shift+Enter)
export let historiePruvodce = []; // { polozky: [{ polozka, kde }], tagy, hodnoceni, predchozi, cas }
export let hotovoPruvodce = 0;
let pasek = null;
let skryty = (() => { try { return localStorage.getItem(KLIC_SKRYTI) === '1'; } catch { return false; } })();
const KLIC_JEN_SRDICKA = 'pruvodceJenSrdicka';
let jenSrdicka = (() => { try { return localStorage.getItem(KLIC_JEN_SRDICKA) === '1'; } catch { return false; } })();
const KLID_MS = 2500;
let casovacKlidu = 0;

const klicAlba = p => `${p.modelkaId}|${p.album}|${p.typ}`;
const aktualni = () => stav.lbPolozky[stav.lbIndex];
const zmena = () => document.dispatchEvent(new CustomEvent('lb-pruvodce-zmena'));
const nazvyTagu = new Map();
export const nazevTagu = klic => nazvyTagu.get(klic) || klic;

// Začátek relace (otevření prohlížeče)
export async function zacitPruvodce() {
    if (!kroky.length) {
        try { kroky = /** @type {any} */ ((await GetKrokyPruvodce())?.kroky || []); } catch { kroky = []; }
        kroky.forEach(k => k.moznosti.forEach(m => nazvyTagu.set(m.klic, m.nazev)));
    }
    stavy = new Map();
    podleAlba = new Map();
    posledni = null;
    historiePruvodce = [];
    hotovoPruvodce = 0;
}

// Stav zobrazené položky; tagy fotky se napřed načtou (první fotka položky zastupuje spojený plakát)
async function stavPolozky(p) {
    if (stavy.has(p)) return stavy.get(p);
    const id = p.fotky[0].id;
    if (!tagyFotek.has(id)) {
        let t = [];
        try { t = (await GetTagyFotek([id]))?.[id] || []; } catch { t = []; }
        tagyFotek.set(id, t);
    }
    // Fotka, která už má srdíčka (ohodnocená dřív nebo zvlášť), krok srdíček přeskočí
    if (!stavy.has(p)) stavy.set(p, novyStav(kroky, tagyFotek.get(id), podleAlba.get(klicAlba(p)) || [], Number(p.hodnoceni) || 0));
    return stavy.get(p);
}

// Zobrazená fotka (událost z prohlížeče): pásek pro její stav
export async function ukazatPruvodce() {
    const p = aktualni();
    if (!stav.lbPruvodce || !p) return vykreslitPasek();
    // Jen srdíčka: fotky, které srdíčka už mají, se přeskočí (počkají na průvodce kvůli tagům)
    if (jenSrdicka && Number(p.hodnoceni) > 0) {
        const seznam = stav.lbPolozky;
        const n = seznam.length;
        for (let k = 1; k < n; k++) {
            const i = (stav.lbIndex + k) % n;
            if (!(Number(seznam[i].hodnoceni) > 0)) return lbZobrazit(i);
        }
    }
    await stavPolozky(p);
    if (aktualni() === p) vykreslitPasek();
}

// ——— Zápis ———

function vyraditZFronty(cile) {
    const seznam = stav.lbPolozky;
    const polozky = cile.map(polozka => ({ polozka, kde: seznam.indexOf(polozka) })).filter(x => x.kde >= 0);
    [...polozky].sort((a, b) => b.kde - a.kde).forEach(x => seznam.splice(x.kde, 1));
    return polozky;
}

function ukazatDalsi(kde) {
    const seznam = stav.lbPolozky;
    if (!seznam.length) {
        zavritLightbox();
        oznamit('Hotovo – všechny fotky prošly průvodcem.');
        return;
    }
    lbNaplnitListu();
    lbZobrazit(Math.min(Math.max(kde, 0), seznam.length - 1));
}

// Fotka prošla průvodcem (srdíčka): vypadne z fronty, zápis běží za ní. Jen srdíčka: zapíšou se jen srdíčka,
// fotka v této relaci vypadne, ale průvodcem neprošla (nabídne se příště)
async function ulozitHotovou(p, s) {
    const kde = stav.lbPolozky.indexOf(p);
    const polozky = vyraditZFronty([p]);
    const jen = jenSrdicka;
    const tagy = jen ? [] : [...s.vybrane].filter(t => !s.navrh.has(t));
    const zaznam = { polozky, tagy, hodnoceni: s.hodnoceni, predchozi: null, cas: Date.now() };
    historiePruvodce.push(zaznam);
    hotovoPruvodce++;
    if (!jen) {
        posledni = tagy;
        podleAlba.set(klicAlba(p), tagy);
    }
    ukazatDalsi(kde);
    zmena();
    const ids = p.fotky.map(f => f.id);
    const predFotek = p.fotky.map(f => Number(f.hodnoceni) || 0);
    let vysledek = null;
    try {
        vysledek = await UlozitPruvodceFotky({ ids, skupiny: jen ? [] : zodpovezeneSkupiny(kroky, s), tagy, hodnoceni: s.hodnoceni, hotovo: !jen });
    } catch { /* oznámí se níž */ }
    if (vysledek?.ok) {
        zaznam.predchozi = vysledek;
        if (!jen) ids.forEach(id => tagyFotek.set(id, tagy));
        p.hodnoceni = s.hodnoceni;
        p.fotky.forEach((f) => { f.hodnoceni = s.hodnoceni; });
        oznamitHodnoceniFotek(predFotek, p.fotky.length, s.hodnoceni);
        stavy.delete(p);
        return zmena();
    }
    oznamit('Fotku se nepodařilo uložit.');
    vratitDoFronty(zaznam, false);
}

// S (a zavření uprostřed): potvrzené kroky se zapíšou, fotka zůstane neprošlá a jde na konec fronty
async function preskocit(naKonec = true) {
    const p = aktualni();
    if (!p) return;
    const s = stavy.get(p);
    if (s && zodpovezeneSkupiny(kroky, s).length) {
        const tagy = [...s.vybrane].filter(t => !s.navrh.has(t));
        UlozitPruvodceFotky({ ids: p.fotky.map(f => f.id), skupiny: zodpovezeneSkupiny(kroky, s), tagy, hodnoceni: 0, hotovo: false })
            .then((v) => { if (v?.ok) p.fotky.forEach(f => tagyFotek.set(f.id, tagy)); })
            .catch(() => oznamit('Rozpracované tagy se nepodařilo uložit.'));
    }
    stavy.delete(p);
    if (!naKonec) return;
    const kde = stav.lbIndex;
    vyraditZFronty([p]);
    stav.lbPolozky.push(p);
    ukazatDalsi(kde);
}

// Rozpracovaná fotka při zavření prohlížeče: zapsat potvrzené kroky
export function ukoncitPruvodce() {
    if (stav.lbPruvodce) preskocit(false);
    vykreslitPasek();
}

// Vrátit poslední uloženou fotku: předchozí tagy, srdíčka a příznak; fotka zpět na své místo
export async function vratitPruvodce() {
    const z = historiePruvodce[historiePruvodce.length - 1];
    if (!z?.predchozi) return;
    let ok = false;
    try { ok = await VratitPruvodceFotky(z.predchozi); } catch { ok = false; }
    if (!ok) return oznamit('Fotku se nepodařilo vrátit.');
    const p = z.polozky[0]?.polozka;
    if (p) {
        z.predchozi.fotky.forEach((f) => { tagyFotek.set(f.id, f.tagy || []); });
        const pred = z.predchozi.fotky[0]?.hodnoceni || 0;
        oznamitHodnoceniFotek(p.fotky.map(() => z.hodnoceni), p.fotky.length, pred);
        p.hodnoceni = pred;
        p.fotky.forEach((f) => { f.hodnoceni = pred; });
    }
    vratitDoFronty(z, true);
}

function vratitDoFronty(z, ukazat) {
    historiePruvodce = historiePruvodce.filter(x => x !== z);
    hotovoPruvodce = Math.max(0, hotovoPruvodce - 1);
    if (lightbox.classList.contains('hidden') || !stav.lbPruvodce) return zmena();
    const seznam = stav.lbPolozky;
    [...z.polozky].sort((a, b) => a.kde - b.kde).forEach(x => seznam.splice(Math.min(x.kde, seznam.length), 0, x.polozka));
    const p = z.polozky[0]?.polozka;
    if (p) {
        // Znovu s vybranými tagy a srdíčky na posledním kroku
        const s = novyStav(kroky, z.tagy, [], Number(p.hodnoceni) || 0);
        jakoMinula(kroky, s, z.tagy);
        // Fotka se srdíčky: zpět na poslední krok tagů (srdíčka nemá)
        if (s.maSrdicka) {
            s.hotovo = false;
            s.krok = predchoziKrok(kroky, kroky.length - 1, s.vybrane);
        }
        stavy.set(p, s);
    }
    lbNaplnitListu();
    if (ukazat && p) lbZobrazit(seznam.indexOf(p));
    zmena();
}

// ——— Klávesy ———

let blikani = 0;
function upozornit() {
    pasek?.classList.add('chybi');
    clearTimeout(blikani);
    blikani = setTimeout(() => pasek?.classList.remove('chybi'), 600);
}

// Klávesy průvodce; true = klávesa patřila průvodci
export function klavesaPruvodce(e) {
    if (!stav.lbPruvodce || !kroky.length) return false;
    probudit();
    const p = aktualni();
    const s = p && stavy.get(p);
    if (e.code === 'KeyH' || e.code === 'NumpadMultiply') {
        prepnoutSkryti();
        return true;
    }
    if (e.code === 'KeyJ') {
        prepnoutJenSrdicka();
        return true;
    }
    // Jen srdíčka: 1–5 uloží, Backspace vrátí, ostatní nic
    if (jenSrdicka && s) {
        const c = cisloKlavesy(e);
        if (c !== null) {
            if (!e.repeat && c >= 1 && c <= 5) {
                s.hodnoceni = c;
                ulozitHotovou(p, s);
            } else if (!e.repeat) upozornit();
            return true;
        }
        if (e.code === 'Backspace' || e.code === 'ArrowLeft') {
            vratitPruvodce();
            return true;
        }
        if (e.code !== 'KeyS' && e.code !== 'NumpadDivide') return ['Enter', 'NumpadEnter', 'ArrowRight', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code);
    }
    if (e.code === 'KeyS' || e.code === 'NumpadDivide') {
        if (!e.repeat) preskocit();
        return true;
    }
    if (!s) return ['Enter', 'NumpadEnter', 'Backspace', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || cisloKlavesy(e) !== null;
    const cislo = cisloKlavesy(e);
    if (cislo !== null) {
        if (e.repeat) return true;
        const v = cislo === 0 ? zadna(kroky, s) : cislice(kroky, s, cislo);
        if (v === 'hotovo') ulozitHotovou(p, s);
        else if (v) vykreslitPasek();
        else upozornit();
        return true;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'ArrowRight' || e.code === 'NumpadAdd') {
        if (e.repeat) return true;
        let v = '';
        if (e.shiftKey && posledni) {
            jakoMinula(kroky, s, posledni);
            if (s.hotovo) v = 'hotovo';
        } else v = potvrdit(kroky, s);
        if (v === 'hotovo') ulozitHotovou(p, s);
        else if (v === 'chybi') upozornit();
        vykreslitPasek();
        return true;
    }
    if (e.code === 'Backspace' || e.code === 'ArrowLeft' || e.code === 'NumpadSubtract') {
        if (!zpet(kroky, s) && !s.potvrzene.size) vratitPruvodce();
        vykreslitPasek();
        return true;
    }
    // Mezerník by spustil promítání; šipky nahoru a dolů skáčou po albech – v průvodci nic
    return e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown';
}

function prepnoutJenSrdicka() {
    jenSrdicka = !jenSrdicka;
    try { localStorage.setItem(KLIC_JEN_SRDICKA, jenSrdicka ? '1' : '0'); } catch { /* jen pro toto spuštění */ }
    vykreslitPasek();
}

// Pásek bez pohybu myši a kláves po chvíli zeslábne (nad ním ne)
function probudit() {
    pasek?.classList.remove('klid');
    clearTimeout(casovacKlidu);
    casovacKlidu = setTimeout(() => pasek?.classList.add('klid'), KLID_MS);
}

function prepnoutSkryti() {
    skryty = !skryty;
    try { localStorage.setItem(KLIC_SKRYTI, skryty ? '1' : '0'); } catch { /* jen pro toto spuštění */ }
    vykreslitPasek();
}

// ——— Pásek ———

function pripravitPasek() {
    if (pasek) return;
    pasek = document.createElement('div');
    pasek.id = 'lbPruvodce';
    pasek.className = 'lb-pruvodce hidden';
    lightbox.append(pasek);
    lightbox.addEventListener('mousemove', () => { if (stav.lbPruvodce) probudit(); });
    // Klik na pásek nesmí zavřít prohlížeč ani zapnout lupu
    pasek.addEventListener('click', (e) => {
        e.stopPropagation();
        const cil = /** @type {HTMLElement} */ (e.target);
        const p = aktualni();
        const s = p && stavy.get(p);
        if (cil.closest('[data-pr-skryt]')) return prepnoutSkryti();
        if (cil.closest('[data-pr-jen]')) return prepnoutJenSrdicka();
        if (!s) return;
        if (jenSrdicka) {
            const srdce = /** @type {HTMLElement | null} */ (cil.closest('[data-pr-cislo]'));
            if (srdce) {
                s.hodnoceni = Number(srdce.dataset.prCislo);
                return ulozitHotovou(p, s);
            }
            if (cil.closest('[data-pr-preskocit]')) return preskocit();
            return;
        }
        const volba = /** @type {HTMLElement | null} */ (cil.closest('[data-pr-cislo]'));
        if (volba) {
            const v = Number(volba.dataset.prCislo) === 0 ? zadna(kroky, s) : cislice(kroky, s, Number(volba.dataset.prCislo));
            if (v === 'hotovo') return ulozitHotovou(p, s);
            if (!v) upozornit();
        } else if (cil.closest('[data-pr-dal]')) {
            const v = potvrdit(kroky, s);
            if (v === 'hotovo') return ulozitHotovou(p, s);
            if (v === 'chybi') upozornit();
        } else if (cil.closest('[data-pr-zpet]')) zpet(kroky, s);
        else if (cil.closest('[data-pr-preskocit]')) return preskocit();
        else if (cil.closest('[data-pr-minula]') && posledni) {
            jakoMinula(kroky, s, posledni);
            if (s.hotovo) return ulozitHotovou(p, s);
        } else return;
        vykreslitPasek();
    });
}

export function vykreslitPasek() {
    pripravitPasek();
    const p = aktualni();
    const s = p && stavy.get(p);
    const videt = stav.lbPruvodce && !!s && !lightbox.classList.contains('hidden');
    pasek.classList.toggle('hidden', !videt);
    lightbox.classList.toggle('pruvodce-skryty', videt && skryty);
    if (!videt) return;
    if (skryty) {
        pasek.innerHTML = '<button type="button" class="pr-ukazat" data-pr-skryt title="Ukázat průvodce (H)">Průvodce <kbd>H</kbd></button>';
        pasek.classList.add('skryty');
        return;
    }
    pasek.classList.remove('skryty');
    probudit();
    const srdce = n => `<button type="button" class="pr-srdce" data-pr-cislo="${n}" title="${n} (uloží a ukáže další)"><kbd>${n}</kbd>${'♥'.repeat(n)}</button>`;
    const prepinacJen = `<button type="button" data-pr-jen title="${jenSrdicka ? 'Zpět na celý průvodce (J)' : 'Jen srdíčka – tagy počkají na průvodce (J)'}"><kbd>J</kbd> ${jenSrdicka ? 'celý průvodce' : 'jen srdíčka'}</button>`;
    if (jenSrdicka) {
        pasek.innerHTML = `
        <div class="pr-hlava"><span class="pr-krok">♥</span><b>Jen srdíčka</b>
            <span class="pr-napoveda">1–5 uloží srdíčka a ukáže další · tagy doplníš v průvodci</span>
            <button type="button" class="pr-skryt" data-pr-skryt title="Skrýt průvodce (H)"><kbd>H</kbd></button></div>
        <div class="pr-moznosti">${[1, 2, 3, 4, 5].map(srdce).join('')}</div>
        <div class="pr-pata"><button type="button" data-pr-preskocit title="Přeskočit fotku (S)"><kbd>S</kbd> přeskočit</button>${prepinacJen}</div>`;
        return;
    }
    const krok = kroky[s.krok];
    const viditelne = viditelneKroky(kroky, s.vybrane, s.maSrdicka);
    const poradi = viditelne.indexOf(s.krok) + 1;
    const tecky = viditelne.map(i => `<i class="${i === s.krok ? 'ted' : s.potvrzene.has(kroky[i].klic) ? 'on' : ''}" title="${esc(kroky[i].nazev)}"></i>`).join('');
    let moznosti = '';
    if (krok.typ === 'srdicka') {
        moznosti = [1, 2, 3, 4, 5].map(srdce).join('');
    } else {
        const tlum = tlumene(krok, s.vybrane);
        moznosti = (krok.povinny ? '' : `<button type="button" class="pr-volba nula ${vybraneKroku(krok, s).length ? '' : 'on'}" data-pr-cislo="0"><kbd>0</kbd>${esc(krok.nula || 'žádná')}</button>`)
            + krok.moznosti.map((m, i) => {
                const trida = s.vybrane.has(m.klic) ? (s.navrh.has(m.klic) ? 'navrh' : 'on') : '';
                return `<button type="button" class="pr-volba ${trida} ${tlum.has(m.klic) ? 'tlumena' : ''}" data-pr-cislo="${i + 1}"><kbd>${i + 1}</kbd>${esc(m.nazev)}</button>`;
            }).join('');
    }
    const navrh = krok.moznosti.some(m => s.navrh.has(m.klic));
    const posledniTagu = s.maSrdicka && viditelne[viditelne.length - 1] === s.krok;
    const napoveda = krok.typ === 'srdicka' ? '1–5 uloží a ukáže další'
        : posledniTagu ? `srdíčka už má – ${krok.typ === 'jeden' ? 'číslice' : '↵'} uloží a ukáže další`
        : krok.typ === 'jeden' ? `číslice vybere a jde dál${navrh ? ' · ↵ převezme z alba' : ''}`
            : `číslice přepíná · ↵ dál${krok.povinny ? '' : ' · 0 žádná'}${navrh ? ' · obrys = z alba' : ''}`;
    pasek.innerHTML = `
        <div class="pr-hlava">
            <span class="pr-krok">${poradi}/${viditelne.length}</span><b>${esc(krok.nazev)}</b>
            ${s.maSrdicka ? `<span class="pr-ma" title="Fotka už má srdíčka – krok srdíček se přeskočí">${'♥'.repeat(s.hodnoceni)}</span>` : ''}
            <span class="pr-tecky" aria-hidden="true">${tecky}</span>
            <span class="pr-napoveda">${esc(napoveda)}</span>
            <button type="button" class="pr-skryt" data-pr-skryt title="Skrýt průvodce (H)"><kbd>H</kbd></button>
        </div>
        <div class="pr-moznosti">
            <button type="button" class="pr-sipka" data-pr-zpet title="Zpět (Backspace / ←)">‹</button>
            ${moznosti}
            ${krok.typ === 'srdicka' ? '' : '<button type="button" class="pr-sipka" data-pr-dal title="Dál (Enter / →)">›</button>'}
        </div>
        <div class="pr-pata">
            <button type="button" data-pr-preskocit title="Přeskočit fotku – potvrzené kroky se uloží (S)"><kbd>S</kbd> přeskočit</button>
            ${posledni ? '<button type="button" data-pr-minula title="Tagy jako minulá fotka, pak srdíčka (Shift+Enter)"><kbd>⇧↵</kbd> jako minulá</button>' : ''}
            ${prepinacJen}
        </div>`;
}
