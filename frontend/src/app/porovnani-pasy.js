// Pásy fotek v porovnání (Oblíbenost): dvě nezávislé galerie nad sebou místo titulních fotek – nahoře modelka A,
// dole B. Každá je vodorovný pás jejích nejlepších fotek (nejlepší fotka každého alba napřed, GetNahledyModelek).
// Pás pod myší je aktivní (Tab ho přepne): kolečko a ← → listují jím, 1–5 dá srdíčka zvýrazněné fotce, 0 je zruší,
// Enter vybere jeho modelku. Klik na fotku ji zvětší přes celé okno (← → listují dál, Esc nebo klik vrátí);
// zvětšení je okno (modal-overlay v #app), takže klávesy obsluhuje samo.
// Obsah pásu se při změně jen doplní nebo přepíše přes nastavitHtml a zvýraznění mění jen třídy, nic pod kurzorem
// zbytečně nemizí (WebKitGTK by mohl ztratit klik).
import { SetHodnoceniFotek } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { znakySrdicek } from '../lib/srdicka';
import { popisNahledu } from '../lib/oblibenost';
import { VELIKOST_PLAKATU, VELIKOST_PLAKATU_MALA } from './obrazky';
import { nastavitHtml, nastavitText } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

const KOSTER = 6; // prázdných míst v pásu, dokud se fotky načítají

let koren = null;
let data = null; // { a: { modelka, fotky (null = načítá se), celkem }, b: … }
let aktivni = 'a';
const index = { a: 0, b: 0 };
let zvetseni = null; // okno zvětšené fotky
let zoom = null; // strana zvětšené fotky, null = zavřeno

const srdickaFotky = h => h > 0 ? `♥${h}` : 'bez ♥';
const polovina = strana => koren?.querySelector(`[data-pas-strana="${strana}"]`);

function htmlHlavy(strana) {
    const { modelka: m, fotky, celkem } = data[strana];
    const info = !fotky ? '' : fotky.length < celkem ? `${fotky.length} nejlepších z ${sklonovat(celkem, 'fotky', 'fotek', 'fotek')}` : sklonovat(fotky.length, 'fotka', 'fotky', 'fotek');
    return `
        <button type="button" class="pas-jmeno" data-otevrit-modelku="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>
        <span class="pas-srdicka">${m.hodnoceni ? znakySrdicek(m.hodnoceni) : 'bez srdíček'}</span>
        <span class="pas-info">${info}</span>
        <span class="pas-pozice" data-pas-pozice></span>
        <button type="button" class="pas-vybrat" data-ob-volba="${strana}" title="Líbí se mi víc ${esc(m.jmeno)} (Enter v aktivním pásu)">♥ Tahle</button>`;
}

function htmlFotek(strana) {
    const { fotky } = data[strana];
    if (!fotky) return Array.from({ length: KOSTER }, () => '<span class="pas-fotka kostra"></span>').join('');
    if (!fotky.length) return '<p class="pas-prazdne">Modelka zatím nemá fotky v albech.</p>';
    return fotky.map((f, i) => `
        <button type="button" class="pas-fotka" data-pas-fotka="${i}" aria-label="${esc(popisNahledu(f, i))} – zvětšit">
            <img src="${esc(obrazek(f.url, VELIKOST_PLAKATU_MALA))}" alt="" data-rot="${Number(f.rotace) || 0}" draggable="false" decoding="async" />
            <span class="pas-srd" data-pas-srd>${srdickaFotky(f.hodnoceni)}</span>
            ${f.album ? `<span class="pas-album">${esc(f.album)}</span>` : ''}
        </button>`).join('');
}

/**
 * Pásy dvojice do místa; volá se při nové dvojici i po načtení fotek (stejná dvojice zachová polohu pásů).
 * @param {HTMLElement} misto
 * @param {{ a: { modelka: any, fotky: any[]|null, celkem: number }, b: { modelka: any, fotky: any[]|null, celkem: number } }} strany
 */
export function vykreslitPasy(misto, strany) {
    const nova = !data || koren !== misto || data.a.modelka.id !== strany.a.modelka.id || data.b.modelka.id !== strany.b.modelka.id;
    koren = misto;
    data = strany;
    if (nova) {
        index.a = index.b = 0;
        nastavitHtml(misto, ['a', 'b'].map(strana => `
            <section class="pas" data-pas-strana="${strana}">
                <header class="pas-hlava" data-pas-hlava></header>
                <div class="pas-fotky" data-pas-fotky></div>
            </section>`).join(''));
    }
    for (const strana of ['a', 'b']) {
        const pul = polovina(strana);
        nastavitHtml(pul.querySelector('[data-pas-hlava]'), htmlHlavy(strana));
        const pas = pul.querySelector('[data-pas-fotky]');
        nastavitHtml(pas, htmlFotek(strana));
        if (nova) pas.scrollLeft = 0;
        oznacit(strana, index[strana], false);
    }
    aktivovat(aktivni);
}

// Aktivní pás (myš, Tab); posunout = dojet k jeho zvýrazněné fotce
function aktivovat(strana, posunout = false) {
    aktivni = strana;
    if (koren) koren.dataset.aktivni = strana;
    if (posunout) oznacit(strana, index[strana]);
}

function oznacit(strana, i, posunout = true) {
    const fotky = data?.[strana].fotky;
    const pul = polovina(strana);
    if (!fotky?.length || !pul) return nastavitText(pul?.querySelector('[data-pas-pozice]'), '');
    index[strana] = Math.min(Math.max(i, 0), fotky.length - 1);
    pul.querySelectorAll('[data-pas-fotka]').forEach(b => b.classList.toggle('aktivni', Number(/** @type {HTMLElement} */ (b).dataset.pasFotka) === index[strana]));
    nastavitText(pul.querySelector('[data-pas-pozice]'), `${index[strana] + 1} / ${fotky.length}`);
    if (posunout) pul.querySelector(`[data-pas-fotka="${index[strana]}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}

function krok(strana, smer) {
    const n = data?.[strana].fotky?.length;
    if (!n) return;
    oznacit(strana, (index[strana] + smer + n) % n);
    if (zoom) ukazatZoom();
}

async function ohodnotit(strana, hodnoceni) {
    const f = data?.[strana].fotky?.[index[strana]];
    if (!f) return;
    let ok = false;
    try {
        ok = await SetHodnoceniFotek([f.id], hodnoceni);
    } catch { /* oznámí se níž */ }
    if (!ok) return oznamit('Srdíčka fotky se nepodařilo uložit.');
    f.hodnoceni = hodnoceni;
    const i = data?.[strana].fotky?.indexOf(f) ?? -1;
    const stitek = i >= 0 ? polovina(strana)?.querySelector(`[data-pas-fotka="${i}"] [data-pas-srd]`) : null;
    if (stitek) nastavitText(stitek, srdickaFotky(hodnoceni));
    if (zoom === strana) ukazatZoom();
}

// ——— Zvětšení fotky ———

function vytvoritZvetseni() {
    zvetseni = document.createElement('div');
    zvetseni.className = 'modal-overlay pas-zvetseni hidden';
    zvetseni.tabIndex = -1;
    zvetseni.setAttribute('role', 'dialog');
    zvetseni.setAttribute('aria-label', 'Zvětšená fotka');
    zvetseni.innerHTML = '<img alt="" draggable="false" /><span class="pas-zvetseni-popis"></span>';
    document.getElementById('app').appendChild(zvetseni);
    zvetseni.addEventListener('click', zavritZoom);
    zvetseni.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const akce = { Escape: zavritZoom, Enter: zavritZoom, ' ': zavritZoom, ArrowLeft: () => krok(zoom, -1), ArrowRight: () => krok(zoom, 1) }[e.key]
            || (/^[0-5]$/.test(e.key) ? () => ohodnotit(zoom, Number(e.key)) : null);
        if (!akce) return;
        e.preventDefault();
        e.stopPropagation();
        akce();
    });
}

function otevritZoom(strana) {
    if (!zvetseni) vytvoritZvetseni();
    zoom = strana;
    zvetseni.classList.remove('hidden');
    ukazatZoom();
    zvetseni.focus({ preventScroll: true });
}

function ukazatZoom() {
    const f = data?.[zoom]?.fotky?.[index[zoom]];
    if (!f) return zavritZoom();
    const img = /** @type {HTMLImageElement} */ (zvetseni.querySelector('img'));
    // Hned obrázek z pásu (je v mezipaměti), ostřejší po načtení
    img.src = obrazek(f.url, VELIKOST_PLAKATU_MALA);
    img.dataset.rot = String(Number(f.rotace) || 0);
    const velky = new Image();
    velky.onload = () => { if (zoom && data?.[zoom].fotky?.[index[zoom]] === f) img.src = velky.src; };
    velky.src = obrazek(f.url, VELIKOST_PLAKATU);
    nastavitText(zvetseni.querySelector('.pas-zvetseni-popis'), `${data[zoom].modelka.jmeno} · ${popisNahledu(f, index[zoom])} · ← → listuje, Esc zpět`);
}

function zavritZoom() {
    zoom = null;
    zvetseni?.classList.add('hidden');
}

// ——— Ovládání ———

/**
 * Klávesa pro pásy z obsluhy porovnání (oblibenost.js): vrátí akci, nebo null. vybrat(strana) zapíše volbu.
 * @param {KeyboardEvent} e
 * @param {(strana: string) => void} vybrat
 */
export function klavesaPasu(e, vybrat) {
    if (!data) return null;
    return { ArrowLeft: () => krok(aktivni, -1), ArrowRight: () => krok(aktivni, 1), Tab: () => aktivovat(aktivni === 'a' ? 'b' : 'a', true),
        Enter: () => vybrat(aktivni) }[e.key]
        || (/^[0-5]$/.test(e.key) ? () => ohodnotit(aktivni, Number(e.key)) : null);
}

// Obsluha myši v místě pásů; volá se jednou
export function pripravitPasy(misto) {
    misto.addEventListener('click', (e) => {
        const fotka = /** @type {HTMLElement} */ (e.target).closest('[data-pas-fotka]');
        if (!fotka || !data) return;
        const strana = fotka.closest('[data-pas-strana]').dataset.pasStrana;
        oznacit(strana, Number(fotka.dataset.pasFotka), false);
        otevritZoom(strana);
    });
    // Pás pod myší je aktivní, fotka pod myší zvýrazněná (srdíčka 1–5 jdou jí)
    misto.addEventListener('mouseover', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const pul = t.closest('[data-pas-strana]');
        if (!pul || !data) return;
        if (pul.dataset.pasStrana !== aktivni) aktivovat(pul.dataset.pasStrana);
        const fotka = t.closest('[data-pas-fotka]');
        if (fotka) oznacit(aktivni, Number(fotka.dataset.pasFotka), false);
    });
    // Kolečko posouvá pás pod myší vodorovně
    misto.addEventListener('wheel', (e) => {
        const pas = /** @type {HTMLElement} */ (e.target).closest?.('[data-pas-fotky]');
        if (!pas) return;
        e.preventDefault();
        pas.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.5;
    }, { passive: false });
}
