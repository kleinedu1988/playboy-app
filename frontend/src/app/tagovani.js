// Rychlé tagování v prohlížeči (Hodnocení › Hodnotit › Tagy): fronta fotek bez tagů po albech. Panel skupin dole
// nad stavovou lištou; klávesy: Z záběr, O odhalení, M místo (prostředí) – každý stisk další hodnota, se Shiftem
// předchozí, za poslední nic; P prsa, V vagina, H podpatky přepínají; Enter uloží a ukáže další, 1–5 uloží
// i se srdíčky, „.“ tagy jako minulá fotka, Shift+Enter tagy všem zbývajícím fotkám alba, Backspace vrátí. Prostředí,
// odhalení a záběr se předvyplní podle minulé fotky téhož alba (obrysem; uloží se s Enterem). Ostatní tagy klikem
// na pilulku. Uložená fotka z fronty vypadne; stavová lišta ukazuje postup a Vrátit (galerie-hodnoceni.js).
import { SetHodnoceniFotek, SetTagyFotek } from './backend';
import { katalogTagu } from './tagy-fotek';
import { stav } from './stav';
import { lbNaplnitListu, lbZobrazit, lightbox, zavritLightbox } from './prohlizec';
import { oznamitHodnoceniFotek } from './galerie';
import { esc } from '../lib/format';
import { oznamit } from '../ui/oznameni';

const CYKLUS = { z: 'zaber', o: 'odhaleni', m: 'prostredi' };
const PREPINACE = { p: 'prsa', v: 'vagina', h: 'podpatky' };
const PREDVYPLNIT = ['prostredi', 'odhaleni', 'zaber'];

let katalog = [];
const skupinaTagu = new Map(); // tag → skupina
let rozpracovane = new Map(); // položka → Set tagů
let navrzene = new Map(); // položka → Set předvyplněných (ještě nepotvrzených)
let posledni = null; // tagy minulé uložené fotky („.“)
let podleAlba = new Map(); // klíč alba → tagy výlučných skupin z minulé fotky alba
export let historieTagu = []; // { polozky: [{ polozka, kde }], tagy, hodnoceni, pred, cas }
export let otagovano = 0;

const klicAlba = p => `${p.modelkaId}|${p.album}|${p.typ}`;
const aktualni = () => stav.lbPolozky[stav.lbIndex];
const zmena = () => document.dispatchEvent(new CustomEvent('lb-tagovani'));

// Začátek tagování (otevření prohlížeče): čistý stav relace
export async function zacitTagovani() {
    katalog = await katalogTagu();
    skupinaTagu.clear();
    katalog.forEach(sk => sk.tagy.forEach(t => skupinaTagu.set(t.klic, sk)));
    rozpracovane = new Map();
    navrzene = new Map();
    posledni = null;
    podleAlba = new Map();
    historieTagu = [];
    otagovano = 0;
}

// Tagy zobrazené fotky; poprvé předvyplněné podle minulé fotky téhož alba
function tagy(p) {
    if (!rozpracovane.has(p)) {
        const z = podleAlba.get(klicAlba(p)) || [];
        rozpracovane.set(p, new Set(z));
        navrzene.set(p, new Set(z));
    }
    return rozpracovane.get(p);
}

function potvrdit(p, skupina) {
    const n = navrzene.get(p);
    if (!n) return;
    [...n].forEach(t => { if (skupinaTagu.get(t)?.klic === skupina) n.delete(t); });
}

// Výlučná skupina: další (nebo předchozí) hodnota, za poslední nic
function cyklovat(skupina, zpet) {
    const p = aktualni();
    const sk = katalog.find(x => x.klic === skupina);
    if (!p || !sk) return;
    const s = tagy(p);
    const ted = sk.tagy.findIndex(t => s.has(t.klic));
    sk.tagy.forEach(t => s.delete(t.klic));
    const dalsi = zpet ? (ted < 0 ? sk.tagy.length - 1 : ted - 1) : ted + 1;
    if (dalsi >= 0 && dalsi < sk.tagy.length) s.add(sk.tagy[dalsi].klic);
    potvrdit(p, skupina);
    vykreslitPanel();
}

// Přepnutí jednoho tagu (ve výlučné skupině nahradí dosavadní hodnotu)
function prepnout(tag) {
    const p = aktualni();
    const sk = skupinaTagu.get(tag);
    if (!p || !sk) return;
    const s = tagy(p);
    const mel = s.has(tag);
    if (sk.vylucna) sk.tagy.forEach(t => s.delete(t.klic));
    if (mel) s.delete(tag);
    else s.add(tag);
    potvrdit(p, sk.klic);
    vykreslitPanel();
}

function jakoMinula() {
    const p = aktualni();
    if (!p || !posledni) return;
    rozpracovane.set(p, new Set(posledni));
    navrzene.set(p, new Set());
    vykreslitPanel();
}

// Uloží tagy zobrazené fotky (Shift+Enter: všem zbývajícím fotkám alba), u 1–5 i srdíčka; fotky z fronty vypadnou
// hned a zápis běží za nimi (nepovedený je vrátí)
async function ulozit(hodnoceni = 0, celeAlbum = false) {
    const p = aktualni();
    if (!p) return;
    const t = [...tagy(p)];
    if (!t.length) return oznamit('Fotka nemá žádný tag – vyber aspoň jeden (Z záběr, O odhalení, M místo…).');
    const seznam = stav.lbPolozky;
    const cile = celeAlbum ? seznam.filter(x => klicAlba(x) === klicAlba(p)) : [p];
    const polozky = cile.map(polozka => ({ polozka, kde: seznam.indexOf(polozka) }));
    const kde = seznam.indexOf(p);
    // Vyřadit od konce, ať indexy ostatních sedí
    [...polozky].sort((a, b) => b.kde - a.kde).forEach(x => seznam.splice(x.kde, 1));
    const pred = Number(p.hodnoceni) || 0;
    const zaznam = { polozky, tagy: t, hodnoceni, pred, cas: Date.now() };
    historieTagu.push(zaznam);
    otagovano += cile.length;
    posledni = t;
    podleAlba.set(klicAlba(p), t.filter(x => PREDVYPLNIT.includes(skupinaTagu.get(x)?.klic)));
    if (!seznam.length) {
        zavritLightbox();
        oznamit('Hotovo – všechny fotky mají tagy.');
    } else {
        lbNaplnitListu();
        lbZobrazit(Math.min(kde, seznam.length - 1));
    }
    zmena();
    const ids = cile.flatMap(x => x.fotky.map(f => f.id));
    let ok = false;
    try {
        ok = await SetTagyFotek(ids, t, []);
        if (ok && hodnoceni) {
            ok = await SetHodnoceniFotek(p.fotky.map(f => f.id), hodnoceni);
            if (ok) {
                const predFotek = p.fotky.map(f => Number(f.hodnoceni) || 0);
                p.hodnoceni = hodnoceni;
                p.fotky.forEach(f => { f.hodnoceni = hodnoceni; });
                oznamitHodnoceniFotek(predFotek, p.fotky.length, hodnoceni);
            }
        }
    } catch { /* oznámí se níž */ }
    if (ok) return;
    oznamit('Tagy se nepodařilo uložit.');
    vratitZaznam(zaznam, false);
}

// Vrátit poslední uložení: tagy (a srdíčka) pryč, fotky zpět na svá místa
export async function vratitTagovani() {
    const z = historieTagu[historieTagu.length - 1];
    if (!z) return;
    const ids = z.polozky.flatMap(x => x.polozka.fotky.map(f => f.id));
    let ok = false;
    try {
        ok = await SetTagyFotek(ids, [], z.tagy);
        const p = z.polozky.find(x => x.polozka.hodnoceni === z.hodnoceni)?.polozka;
        if (ok && z.hodnoceni && p) {
            ok = await SetHodnoceniFotek(p.fotky.map(f => f.id), z.pred);
            if (ok) {
                p.hodnoceni = z.pred;
                p.fotky.forEach(f => { f.hodnoceni = z.pred; });
                oznamitHodnoceniFotek(p.fotky.map(() => z.hodnoceni), p.fotky.length, z.pred);
            }
        }
    } catch { /* oznámí se níž */ }
    if (!ok) return oznamit('Tagy se nepodařilo vrátit.');
    vratitZaznam(z, true);
}

function vratitZaznam(z, ukazat) {
    historieTagu = historieTagu.filter(x => x !== z);
    otagovano = Math.max(0, otagovano - z.polozky.length);
    if (lightbox.classList.contains('hidden') || !stav.lbTagovani) return zmena();
    const seznam = stav.lbPolozky;
    [...z.polozky].sort((a, b) => a.kde - b.kde).forEach(x => seznam.splice(Math.min(x.kde, seznam.length), 0, x.polozka));
    const p = z.polozky[0].polozka;
    rozpracovane.set(p, new Set(z.tagy));
    navrzene.set(p, new Set());
    lbNaplnitListu();
    if (ukazat) lbZobrazit(seznam.indexOf(p));
    zmena();
}

// Klávesy tagování; true = klávesa patřila tagování
export function klavesaTagovani(e) {
    if (!stav.lbTagovani) return false;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') ulozit(0, e.shiftKey);
    else if (/^[1-5]$/.test(e.key)) { if (!e.repeat) ulozit(Number(e.key)); }
    else if (e.key === 'Backspace') vratitTagovani();
    else if (e.key === '.') jakoMinula();
    else if (CYKLUS[k]) cyklovat(CYKLUS[k], e.shiftKey);
    else if (PREPINACE[k]) prepnout(PREPINACE[k]);
    else return false;
    return true;
}

// Panel skupin dole v prohlížeči: pilulky (plná = vybraná, obrys = předvyplněná podle alba), klávesa u skupiny
const KLAVESA_SKUPINY = { zaber: 'Z', odhaleni: 'O', prostredi: 'M' };
const KLAVESA_TAGU = { prsa: 'P', vagina: 'V', podpatky: 'H' };
let panel = null;
export function vykreslitPanel() {
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'lbTagy';
        panel.className = 'lb-tagy';
        // Pod prohlížečem (ten je při tagování o výšku panelu kratší), nad stavovou lištou
        document.getElementById('app').append(panel);
        panel.addEventListener('click', (e) => {
            const tag = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-lbt-tag]'))?.dataset.lbtTag;
            if (tag) prepnout(tag);
        });
    }
    const p = aktualni();
    panel.classList.toggle('hidden', !stav.lbTagovani || !p);
    if (!stav.lbTagovani || !p) return;
    const s = tagy(p);
    const n = navrzene.get(p) || new Set();
    panel.innerHTML = katalog.map(sk => `<div class="lbt-skupina"><span class="lbt-nazev">${KLAVESA_SKUPINY[sk.klic] ? `<kbd>${KLAVESA_SKUPINY[sk.klic]}</kbd>` : ''}${esc(sk.nazev)}</span>
        ${sk.tagy.map(t => `<button type="button" class="lbt-tag ${s.has(t.klic) ? (n.has(t.klic) ? 'navrh' : 'on') : ''}" data-lbt-tag="${esc(t.klic)}" title="${esc(KLAVESA_TAGU[t.klic] ? `${t.nazev} (${KLAVESA_TAGU[t.klic]})` : t.nazev)}">${esc(t.nazev)}${KLAVESA_TAGU[t.klic] ? `<kbd>${KLAVESA_TAGU[t.klic]}</kbd>` : ''}</button>`).join('')}</div>`).join('');
}

export const tagyRozpracovane = () => {
    const p = aktualni();
    return p ? [...tagy(p)] : [];
};
export const nazevTagu = klic => skupinaTagu.get(klic)?.tagy.find(t => t.klic === klic)?.nazev || klic;
