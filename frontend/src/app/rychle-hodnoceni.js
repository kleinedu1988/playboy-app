// Rychlé hodnocení (Oblíbenost › Hodnocení): modelky jedna po druhé – vlevo velká titulní fotka se jménem a srdíčky,
// vpravo pás jejích nejlepších fotek (stejný vzhled jako v Porovnávání), pod ním odhad nebo návrh. Frontu skládá
// backend (GetFrontaHodnoceni): nově přidané, nehodnocené podle užitku pro pořadí (odhad + ½ nejistoty), nakonec
// hodnocené, kterým nesedí srdíčka (stejný návrh jako „Nesedí se srdíčky“ v Pořadí). Přeskočené si program pamatuje
// i po zavření a dává je na konec (lib/hodnoceni.js).
// Enter přijme odhad (zapíše se jako převzatý – model vkusu se z něj neučí, dokud ho nepotvrdí porovnání) nebo návrh,
// 1–5 dá srdíčka (půlky klikem na srdíčka), N u nesouladu nechá srdíčka, S přeskočí, Backspace vrátí poslední.
// Nejistý odhad se ukáže až po chvíli, aby nejdřív rozhodly fotky (ochrana před ukotvením na čísle).
// Po každých pěti hodnoceních se odhady zbytku fronty obnoví – model vkusu se z nových srdíček učí.
// Srdíčka obsluhuje galerie.js (data-hodnoceni) a ohlásí je událostí hodnoceni-modelky; profil otevírá prehled.js.
import { GetFotografieModelky, GetFrontaHodnoceni, GetNahledyModelek, SetHodnoceni, SetHodnoceniOdhadem } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { pridatPreskocenou, srdickaKlavesy, upravitFrontu } from '../lib/hodnoceni';
import { klicNavrhu, kratceSrdicka, skryteNavrhy, skrytNavrh, vetaNesouladu } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, popisNahledu } from '../lib/oblibenost';
import { sestavitAlba } from '../lib/alba';
import { stav } from './stav';
import { VELIKOST_NAHLEDU, adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { htmlSrdicka } from './galerie';
import { otevritLightbox } from './prohlizec';
import { seraditAlbaProfilu } from './profil';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';

const OBNOVIT_PO = 5;
const NEJISTY_ODHAD = 0.6; // nejistota (srdíčka), od které se odhad ukáže až po chvíli
const ODHAD_ZA_MS = 2000;
const KLIC_PRESKOCENYCH = 'hodnoceniPreskocene';

let kontejner = null;
let fronta = []; // položky fronty (PolozkaHodnoceni + preskocena); první je zobrazená
const historie = []; // [{ polozka, predtim }] ohodnocené v tomto sezení (Vrátit)
let hotovo = 0;
let odObnoveni = 0;
let zaneprazdneno = false;
let ukladamSama = false; // vlastní zápis srdíček (událost hodnoceni-modelky se pak neřeší podruhé)
let odkryto = null; // položka, jejíž nejistý odhad je už vidět
let casovacOdhadu = 0;
const nahledy = new Map();

const modelka = id => stav.prehledModelky.get(id);

function preskocene() {
    try { return JSON.parse(localStorage.getItem(KLIC_PRESKOCENYCH) || '[]'); } catch { return []; }
}
function ulozitPreskocene(seznam) {
    try { localStorage.setItem(KLIC_PRESKOCENYCH, JSON.stringify(seznam)); } catch { /* jen pro toto spuštění */ }
}

export async function nacistHodnoceni(prvek) {
    kontejner = prvek;
    // Fronta se sestaví jen poprvé nebo když došla (přepnutí sem a zpět ji nezahodí)
    if (!fronta.length) await sestavitFrontu();
    vykreslit();
}

async function nacistFrontu() {
    const polozky = (await GetFrontaHodnoceni() || []).filter(p => modelka(p.modelkaId));
    return upravitFrontu(polozky, { preskocene: preskocene(), skryte: skryteNavrhy() });
}

async function sestavitFrontu() {
    try {
        fronta = await nacistFrontu();
    } catch {
        fronta = [];
    }
}

// Po pár hodnoceních: nové odhady pro zbytek fronty (pořadí zůstává, ať se modelky nepřehazují pod rukama)
async function obnovitOdhady() {
    odObnoveni = 0;
    try {
        const nove = new Map((await nacistFrontu()).map(p => [p.modelkaId, p]));
        fronta.forEach((p, i) => {
            const n = nove.get(p.modelkaId);
            if (i > 0 && n && n.druh === p.druh) Object.assign(p, { odhad: n.odhad, nejistota: n.nejistota, duvod: n.duvod });
        });
    } catch { /* staré odhady zůstanou */ }
}

async function nacistFotky(id) {
    if (nahledy.has(id)) return;
    try {
        const v = await GetNahledyModelek([id], NAHLEDU_V_POROVNANI);
        nahledy.set(id, v?.[id] || []);
    } catch {
        nahledy.set(id, []);
    }
}

// Odhad je vidět: jistý hned, nejistý po chvíli nebo po kliku na „Ukázat odhad“
const odhadVidet = p => p.druh === 'nesedi' || !(p.odhad > 0) || p.nejistota <= NEJISTY_ODHAD || odkryto === p;
// Co přijme Enter: návrh u nesouladu, jinak viditelný odhad (0 = nic)
const prijmout = p => !p ? 0 : p.druh === 'nesedi' ? p.navrh : odhadVidet(p) ? p.odhad : 0;

// ——— Vykreslení ———

function htmlOdhadu(p, m) {
    if (p.druh === 'nesedi') {
        return `<p class="hod-odhad"><b>návrh ${esc(kratceSrdicka(p.navrh))} ♥</b><small>Má ${esc(kratceSrdicka(p.hodnoceni))} ♥, ale ${esc(p.nesoulad ? vetaNesouladu(p.nesoulad) : 'porovnání ji staví jinam')}.</small></p>`;
    }
    if (!(p.odhad > 0)) return '<p class="hod-odhad"><small>Odhad zatím není – model vkusu o ní ještě nic neví.</small></p>';
    if (!odhadVidet(p)) {
        return `<p class="hod-odhad"><small>Odhad je nejistý – nejdřív se podívej na fotky, ukáže se za chvíli.</small>
            <button type="button" class="link" data-hod-odkryt>Ukázat odhad</button></p>`;
    }
    const jistota = p.nejistota > NEJISTY_ODHAD ? ' · nejistý' : '';
    return `<p class="hod-odhad"><b>odhad ${esc(kratceSrdicka(p.odhad))}${jistota}</b><small>${esc(p.duvod || 'podle tvého vkusu')}</small></p>`;
}

function vykreslit() {
    if (!kontejner) return;
    const p = fronta[0];
    const m = p && modelka(p.modelkaId);
    clearTimeout(casovacOdhadu);
    if (!m) {
        nastavitHtml(kontejner, `${htmlPruhu()}${htmlPrazdna(hotovo ? 'Hotovo' : 'Není co hodnotit',
            hotovo ? `Ohodnoceno ${sklonovat(hotovo, 'modelka', 'modelky', 'modelek')}. Nehodnocená ani nesoulad se srdíčky už nezbývá.` : 'Všechny modelky mají srdíčka a žádné nesedí.', { ikona: 'srdce' })}`);
        return;
    }
    if (!odhadVidet(p)) casovacOdhadu = setTimeout(() => { if (fronta[0] === p) { odkryto = p; vykreslit(); } }, ODHAD_ZA_MS);
    const fotky = nahledy.get(p.modelkaId);
    const stitek = p.druh === 'nova' ? '<span class="hod-stitek">nově přidaná</span>'
        : p.druh === 'nesedi' ? '<span class="hod-stitek nesedi">nesedí srdíčka</span>'
        : p.preskocena ? '<span class="hod-stitek">přeskočená</span>' : '';
    const enter = prijmout(p);
    nastavitHtml(kontejner, `${htmlPruhu()}
        <section class="pas hod-pas">
            <div class="pas-profil hod-profil">
                <img src="${esc(adresaTitulni(m, true))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
                <div class="pas-popis">
                    ${stitek}
                    <button type="button" class="pas-jmeno" data-otevrit-modelku="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>
                    ${htmlSrdicka(m)}
                    <small>${sklonovat(m.pocetFotek || 0, 'fotka', 'fotky', 'fotek')}</small>
                </div>
            </div>
            <div class="pas-fotky" data-hod-fotky>${!fotky ? Array.from({ length: 5 }, () => '<span class="pas-fotka kostra"></span>').join('')
                : !fotky.length ? '<p class="pas-prazdne">Modelka zatím nemá fotky v albech.</p>'
                : fotky.map((f, i) => `<button type="button" class="pas-fotka" data-hod-fotka="${i}" aria-label="${esc(popisNahledu(f, i))} – otevřít v prohlížeči">
                    <img ${i < 6 ? 'src' : 'data-src'}="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" alt="" data-rot="${Number(f.rotace) || 0}" draggable="false" decoding="async" />
                    ${f.album ? `<span class="pas-album">${esc(f.album)}</span>` : ''}</button>`).join('')}</div>
        </section>
        ${htmlOdhadu(p, m)}
        <div class="hod-ovladani">
            ${enter ? `<button type="button" class="btn btn-primary btn-small" data-hod-prijmout title="${p.druh === 'nesedi' ? 'Dát jí návrh' : 'Dát jí odhad'} (Enter)"><kbd>Enter</kbd> Dát ${esc(kratceSrdicka(enter))} ♥</button>` : ''}
            ${p.druh === 'nesedi' ? `<button type="button" class="btn btn-secondary btn-small" data-hod-nechat title="Srdíčka nechat a návrh už nenabízet (N)"><kbd>N</kbd> Nechat ${esc(kratceSrdicka(p.hodnoceni))} ♥</button>` : ''}
            <span class="hod-klavesy"><kbd>1</kbd>–<kbd>5</kbd> srdíčka · půlky klikem na srdíčka</span>
            <span class="oddelovac"></span>
            <button type="button" class="link" data-hod-preskocit title="Přeskočit – příště bude až na konci (S)">Přeskočit <kbd>S</kbd></button>
            <button type="button" class="link" data-hod-vratit title="Vrátit poslední hodnocení (Backspace)" ${historie.length ? '' : 'disabled'}>Vrátit <kbd>⌫</kbd></button>
        </div>`);
    const pas = kontejner.querySelector('[data-hod-fotky]');
    if (pas) nacitatPostupne(pas, { root: pas, rootMargin: '0px 100% 0px 25%' });
    if (!fotky) nacistFotky(p.modelkaId).then(() => { if (fronta[0] === p) vykreslit(); });
    // Další modelka dopředu (fotky i titulka), přechod pak nebliká
    const dalsi = fronta[1];
    if (dalsi) {
        nacistFotky(dalsi.modelkaId);
        const md = modelka(dalsi.modelkaId);
        if (md) new Image().src = adresaTitulni(md, true);
    }
}

// „Rychlé hodnocení · zbývá 37 · z toho 5 přeskočených · ohodnoceno 5“ s ukazatelem
function htmlPruhu() {
    const celkem = hotovo + fronta.length;
    const nehodnocenych = fronta.filter(p => p.druh !== 'nesedi').length;
    const nesedi = fronta.length - nehodnocenych;
    const preskocenych = fronta.filter(p => p.preskocena).length;
    const casti = [
        nehodnocenych ? `${sklonovat(nehodnocenych, 'modelka', 'modelky', 'modelek')} bez srdíček` : '',
        nesedi ? `${nesedi} k přehodnocení` : '',
    ].filter(Boolean);
    return `<div class="hod-pruh"><span><b>Rychlé hodnocení</b> · ${casti.length ? `zbývá ${casti.join(' a ')}` : 'nic nezbývá'}${preskocenych ? ` · z toho ${sklonovat(preskocenych, 'přeskočená', 'přeskočené', 'přeskočených')}` : ''}${hotovo ? ` · ohodnoceno ${hotovo}` : ''}</span>
        <span class="ob-serie-postup" aria-hidden="true"><i style="width:${celkem ? Math.round(100 * hotovo / celkem) : 0}%"></i></span></div>`;
}

// ——— Akce ———

async function ohodnotit(hodnoceni, zOdhadu = false) {
    const p = fronta[0];
    if (!p || zaneprazdneno || !(hodnoceni > 0)) return;
    zaneprazdneno = true;
    const m = modelka(p.modelkaId);
    const predtim = m?.hodnoceni || 0;
    let ok = false;
    ukladamSama = true;
    try {
        ok = await (zOdhadu ? SetHodnoceniOdhadem(p.modelkaId, hodnoceni) : SetHodnoceni(p.modelkaId, hodnoceni));
    } catch { /* oznámí se níž */ }
    if (ok) {
        if (m) m.hodnoceni = hodnoceni;
        document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id: p.modelkaId, hodnoceni } }));
    }
    ukladamSama = false;
    zaneprazdneno = false;
    if (!ok) return oznamit('Hodnocení se nepodařilo uložit.');
    hotovaPolozka(p, predtim);
}

// Modelka ohodnocená (tady nebo klikem na srdíčka): pryč z přeskočených, do historie a další na řadu
function hotovaPolozka(p, predtim) {
    ulozitPreskocene(preskocene().filter(id => id !== p.modelkaId));
    historie.push({ polozka: p, predtim });
    fronta.shift();
    hotovo++;
    if (++odObnoveni >= OBNOVIT_PO) obnovitOdhady().then(vykreslit);
    vykreslit();
}

// Nesoulad: srdíčka nechat a návrh skrýt (stejně jako „Nechat“ v Pořadí)
function nechat() {
    const p = fronta[0];
    if (!p || p.druh !== 'nesedi' || zaneprazdneno) return;
    skrytNavrh(klicNavrhu(p.modelkaId, p.hodnoceni, p.navrh));
    fronta.shift();
    vykreslit();
}

// Přeskočit: na konec fronty a do paměti (příště taky až na konci)
function preskocit() {
    const p = fronta[0];
    if (!p || zaneprazdneno) return;
    ulozitPreskocene(pridatPreskocenou(preskocene(), p.modelkaId));
    p.preskocena = true;
    fronta.push(fronta.shift());
    vykreslit();
}

async function vratit() {
    const posledni = historie.at(-1);
    if (!posledni || zaneprazdneno) return;
    const { polozka: p, predtim } = posledni;
    zaneprazdneno = true;
    let ok = false;
    ukladamSama = true;
    try {
        ok = await SetHodnoceni(p.modelkaId, predtim);
    } catch { /* oznámí se níž */ }
    if (ok) {
        const m = modelka(p.modelkaId);
        if (m) m.hodnoceni = predtim;
        document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id: p.modelkaId, hodnoceni: predtim } }));
    }
    ukladamSama = false;
    zaneprazdneno = false;
    if (!ok) return oznamit('Hodnocení se nepodařilo vrátit.');
    historie.pop();
    hotovo = Math.max(0, hotovo - 1);
    fronta.unshift(p);
    vykreslit();
}

async function otevritFotku(i) {
    const p = fronta[0];
    const f = p && nahledy.get(p.modelkaId)?.[i];
    if (!f) return;
    let fotky = [];
    try {
        fotky = await GetFotografieModelky(p.modelkaId) || [];
    } catch { /* oznámí se níž */ }
    if (fronta[0] !== p) return;
    fotky.forEach(x => { x.jmenoModelky = modelka(x.modelkaId)?.jmeno || modelka(p.modelkaId)?.jmeno || ''; });
    const polozky = seraditAlbaProfilu(sestavitAlba(fotky)).flatMap(a => a.polozky);
    const kde = polozky.findIndex(x => x.fotky.some(q => q.id === f.id));
    if (kde < 0) return oznamit('Fotku se nepodařilo otevřít.');
    otevritLightbox(kde, false, polozky);
}

function odkrytOdhad() {
    if (!fronta[0]) return;
    odkryto = fronta[0];
    vykreslit();
}

// Enter: návrh, nebo odhad (převzatý); nejistý odhad, který ještě není vidět, nejdřív odkryje
function enter() {
    const p = fronta[0];
    if (!p) return;
    if (p.druh !== 'nesedi' && p.odhad > 0 && !odhadVidet(p)) return odkrytOdhad();
    const h = prijmout(p);
    if (h) ohodnotit(h, p.druh !== 'nesedi');
}

/**
 * Obsluha; volá ji oblibenost.js jednou. videt() = část Hodnocení je zobrazená a nic ji nepřekrývá.
 * @param {() => boolean} videt
 */
export function pripravitHodnoceni(videt) {
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        if (t.closest('[data-hod-prijmout]')) enter();
        else if (t.closest('[data-hod-nechat]')) nechat();
        else if (t.closest('[data-hod-odkryt]')) odkrytOdhad();
        else if (t.closest('[data-hod-preskocit]')) preskocit();
        else if (t.closest('[data-hod-vratit]')) vratit();
        else if (t.closest('[data-hod-fotka]')) otevritFotku(Number(t.closest('[data-hod-fotka]').dataset.hodFotka));
    });
    // Kolečko posouvá pás fotek vodorovně
    document.addEventListener('wheel', (e) => {
        const pas = /** @type {HTMLElement} */ (e.target).closest?.('[data-hod-fotky]');
        if (!pas || !kontejner?.contains(pas)) return;
        e.preventDefault();
        pas.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.5;
    }, { passive: false });
    document.addEventListener('keydown', (e) => {
        if (!videt() || e.ctrlKey || e.metaKey || e.altKey) return;
        if (/** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [role="slider"], [contenteditable]')) return;
        const srdicka = srdickaKlavesy(e);
        const akce = srdicka ? () => ohodnotit(srdicka)
            : { Enter: enter, s: preskocit, S: preskocit, n: nechat, N: nechat, Backspace: vratit }[e.key];
        if (!akce) return;
        e.preventDefault();
        akce();
    });
    // Srdíčka dané klikem (galerie.js): zobrazená modelka je ohodnocená, jde se dál
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        const p = fronta[0];
        if (ukladamSama || !(hodnoceni > 0) || p?.modelkaId !== id || !kontejner?.isConnected) return;
        hotovaPolozka(p, p.druh === 'nesedi' ? p.hodnoceni : 0);
    });
}
