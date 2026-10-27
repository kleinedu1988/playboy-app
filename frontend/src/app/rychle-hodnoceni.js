// Rychlé hodnocení (Oblíbenost › Hodnocení): nehodnocené modelky jedna po druhé – vlevo velká titulní fotka se jménem,
// odhadem modelu vkusu a srdíčky, vpravo pás jejích nejlepších fotek (stejný vzhled jako v Porovnávání). Enter přijme
// odhad, 1–5 dá srdíčka (půlky klikem na srdíčka), S přeskočí, Backspace vrátí poslední. Fronta: tipy modelu vkusu
// (nejvyšší odhad napřed, s důvodem), pak ostatní nehodnocené (lib/hodnoceni.js). Po každých pěti hodnoceních se
// odhady zbylých obnoví – model vkusu se z nových srdíček učí.
// Srdíčka obsluhuje galerie.js (data-hodnoceni) a ohlásí je událostí hodnoceni-modelky; profil otevírá prehled.js.
import { GetFotografieModelky, GetMohloByTeLibit, GetNahledyModelek, SetHodnoceni } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { frontaHodnoceni, srdickaKlavesy } from '../lib/hodnoceni';
import { kratceSrdicka, textSrdicek } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, popisNahledu } from '../lib/oblibenost';
import { sestavitAlba } from '../lib/alba';
import { stav } from './stav';
import { vsechnyModelky } from './mezipamet';
import { VELIKOST_NAHLEDU, adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { htmlSrdicka } from './galerie';
import { otevritLightbox } from './prohlizec';
import { seraditAlbaProfilu } from './profil';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';

const OBNOVIT_PO = 5;

let kontejner = null;
let fronta = []; // [{ id, odhad, duvod }]; první je zobrazená
const historie = []; // ohodnocené v tomto sezení (Vrátit)
let hotovo = 0;
let odObnoveni = 0;
let zaneprazdneno = false;
let ukladamSama = false; // vlastní zápis srdíček (událost hodnoceni-modelky se pak neřeší podruhé)
const nahledy = new Map();

const modelka = id => stav.prehledModelky.get(id);

export async function nacistHodnoceni(prvek) {
    kontejner = prvek;
    // Fronta se sestaví jen poprvé nebo když došla (přepnutí sem a zpět ji nezahodí)
    if (!fronta.length) await sestavitFrontu();
    vykreslit();
}

async function sestavitFrontu() {
    const [modelky, tipy] = await Promise.all([vsechnyModelky(), GetMohloByTeLibit(200).catch(() => [])]);
    fronta = frontaHodnoceni(modelky, tipy).filter(x => modelka(x.id));
}

// Po pár hodnoceních: nové odhady pro zbytek fronty (pořadí zůstává, ať se modelky nepřehazují pod rukama)
async function obnovitOdhady() {
    odObnoveni = 0;
    try {
        const [modelky, tipy] = await Promise.all([vsechnyModelky(), GetMohloByTeLibit(200)]);
        const nove = new Map(frontaHodnoceni(modelky, tipy).map(x => [x.id, x]));
        fronta.forEach((x, i) => { if (i > 0 && nove.has(x.id)) Object.assign(x, nove.get(x.id)); });
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

// ——— Vykreslení ———

function vykreslit() {
    if (!kontejner) return;
    const x = fronta[0];
    const m = x && modelka(x.id);
    if (!m) {
        nastavitHtml(kontejner, `${htmlPruhu()}${htmlPrazdna(hotovo ? 'Hotovo' : 'Všechny modelky mají srdíčka',
            hotovo ? `Ohodnoceno ${sklonovat(hotovo, 'modelka', 'modelky', 'modelek')}. Nehodnocená už žádná nezbývá.` : 'Nehodnocená modelka žádná není.', { ikona: 'srdce' })}`);
        return;
    }
    const fotky = nahledy.get(x.id);
    const odhad = x.odhad > 0
        ? `<p class="hod-odhad"><b>odhad ${esc(kratceSrdicka(x.odhad))}</b>${x.duvod ? `<small>${esc(x.duvod)}</small>` : '<small>podle tvého vkusu</small>'}</p>`
        : '<p class="hod-odhad"><small>Odhad zatím není – model vkusu o ní ještě nic neví.</small></p>';
    nastavitHtml(kontejner, `${htmlPruhu()}
        <section class="pas hod-pas">
            <div class="pas-profil hod-profil">
                <img src="${esc(adresaTitulni(m, true))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
                <div class="pas-popis">
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
        ${odhad}
        <div class="hod-ovladani">
            ${x.odhad > 0 ? `<button type="button" class="btn btn-primary btn-small" data-hod-prijmout title="Dát jí odhad (Enter)"><kbd>Enter</kbd> Dát ${esc(textSrdicek(x.odhad))}</button>` : ''}
            <span class="hod-klavesy"><kbd>1</kbd>–<kbd>5</kbd> srdíčka · půlky klikem na srdíčka</span>
            <span class="oddelovac"></span>
            <button type="button" class="link" data-hod-preskocit title="Přeskočit (S)">Přeskočit <kbd>S</kbd></button>
            <button type="button" class="link" data-hod-vratit title="Vrátit poslední hodnocení (Backspace)" ${historie.length ? '' : 'disabled'}>Vrátit <kbd>⌫</kbd></button>
        </div>`);
    const pas = kontejner.querySelector('[data-hod-fotky]');
    if (pas) nacitatPostupne(pas, { root: pas, rootMargin: '0px 100% 0px 25%' });
    if (!fotky) nacistFotky(x.id).then(() => { if (fronta[0] === x) vykreslit(); });
    // Další modelka dopředu (fotky i titulka), přechod pak nebliká
    const dalsi = fronta[1];
    if (dalsi) {
        nacistFotky(dalsi.id);
        const md = modelka(dalsi.id);
        if (md) new Image().src = adresaTitulni(md, true);
    }
}

// „Rychlé hodnocení · zbývá 37 bez srdíček · ohodnoceno 5“ s ukazatelem
function htmlPruhu() {
    const celkem = hotovo + fronta.length;
    return `<div class="hod-pruh"><span><b>Rychlé hodnocení</b> · ${fronta.length ? `zbývá ${sklonovat(fronta.length, 'modelka', 'modelky', 'modelek')} bez srdíček` : 'nic nezbývá'}${hotovo ? ` · ohodnoceno ${hotovo}` : ''}</span>
        <span class="ob-serie-postup" aria-hidden="true"><i style="width:${celkem ? Math.round(100 * hotovo / celkem) : 0}%"></i></span></div>`;
}

// ——— Akce ———

async function ohodnotit(hodnoceni) {
    const x = fronta[0];
    if (!x || zaneprazdneno || !(hodnoceni > 0)) return;
    zaneprazdneno = true;
    let ok = false;
    ukladamSama = true;
    try {
        ok = await SetHodnoceni(x.id, hodnoceni);
    } catch { /* oznámí se níž */ }
    if (ok) {
        const m = modelka(x.id);
        if (m) m.hodnoceni = hodnoceni;
        document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id: x.id, hodnoceni } }));
    }
    ukladamSama = false;
    zaneprazdneno = false;
    if (!ok) return oznamit('Hodnocení se nepodařilo uložit.');
    ohodnocena(x);
}

// Modelka ohodnocená (tady nebo klikem na srdíčka): do historie a další na řadu
function ohodnocena(x) {
    historie.push(x);
    fronta.shift();
    hotovo++;
    if (++odObnoveni >= OBNOVIT_PO) obnovitOdhady().then(vykreslit);
    vykreslit();
}

function preskocit() {
    if (!fronta.length || zaneprazdneno) return;
    fronta.push(fronta.shift());
    vykreslit();
}

async function vratit() {
    const x = historie.at(-1);
    if (!x || zaneprazdneno) return;
    zaneprazdneno = true;
    let ok = false;
    ukladamSama = true;
    try {
        ok = await SetHodnoceni(x.id, 0);
    } catch { /* oznámí se níž */ }
    if (ok) {
        const m = modelka(x.id);
        if (m) m.hodnoceni = 0;
        document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id: x.id, hodnoceni: 0 } }));
    }
    ukladamSama = false;
    zaneprazdneno = false;
    if (!ok) return oznamit('Hodnocení se nepodařilo vrátit.');
    historie.pop();
    hotovo = Math.max(0, hotovo - 1);
    fronta.unshift(x);
    vykreslit();
}

async function otevritFotku(i) {
    const x = fronta[0];
    const f = x && nahledy.get(x.id)?.[i];
    if (!f) return;
    let fotky = [];
    try {
        fotky = await GetFotografieModelky(x.id) || [];
    } catch { /* oznámí se níž */ }
    if (fronta[0] !== x) return;
    fotky.forEach(p => { p.jmenoModelky = modelka(p.modelkaId)?.jmeno || modelka(x.id)?.jmeno || ''; });
    const polozky = seraditAlbaProfilu(sestavitAlba(fotky)).flatMap(a => a.polozky);
    const kde = polozky.findIndex(p => p.fotky.some(q => q.id === f.id));
    if (kde < 0) return oznamit('Fotku se nepodařilo otevřít.');
    otevritLightbox(kde, false, polozky);
}

/**
 * Obsluha; volá ji oblibenost.js jednou. videt() = část Hodnocení je zobrazená a nic ji nepřekrývá.
 * @param {() => boolean} videt
 */
export function pripravitHodnoceni(videt) {
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        if (t.closest('[data-hod-prijmout]')) ohodnotit(fronta[0]?.odhad || 0);
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
            : { Enter: () => ohodnotit(fronta[0]?.odhad || 0), s: preskocit, S: preskocit, Backspace: vratit }[e.key];
        if (!akce) return;
        e.preventDefault();
        akce();
    });
    // Srdíčka dané klikem (galerie.js): zobrazená modelka je ohodnocená, jde se dál
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        if (ukladamSama || !(hodnoceni > 0) || fronta[0]?.id !== id || !kontejner?.isConnected) return;
        ohodnocena(fronta[0]);
    });
}
