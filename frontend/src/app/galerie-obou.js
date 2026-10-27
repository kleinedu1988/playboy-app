// Galerie obou modelek z porovnání (Oblíbenost): klik na titulní fotku otevře přes celé okno dvě nezávislé galerie
// nad sebou – nahoře levá modelka, dole pravá. Každá je vodorovný pás jejích nejlepších fotek (nejlepší fotka
// každého alba napřed, GetNahledyModelek). Polovina pod myší je aktivní (Tab ji přepne): kolečko a ← → listují jejím
// pásem, 1–5 dá srdíčka zvýrazněné fotce, 0 je zruší, Enter vybere její modelku. Klik na fotku ji zvětší přes celé
// okno (← → listují dál, Esc nebo klik vrátí do galerie). „♥ Tahle“ vybere modelku, ↓ nebo „Stejně“ remízu,
// Esc zavře a vrátí k porovnání.
// Galerie je okno (modal-overlay v #app): ostatní klávesové zkratky ji obcházejí a klávesy obsluhuje sama.
import { SetHodnoceniFotek } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { znakySrdicek } from '../lib/srdicka';
import { popisNahledu } from '../lib/oblibenost';
import { VELIKOST_PLAKATU, VELIKOST_PLAKATU_MALA, adresaTitulni } from './obrazky';
import { nastavitText } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

let okno = null;
let data = null; // { a: { modelka, fotky, celkem }, b: …, vybrat }
let aktivni = 'a';
const index = { a: 0, b: 0 };
let zoom = null; // strana zvětšené fotky, null = galerie
let predtim = null; // prvek s fokusem před otevřením

const srdickaFotky = h => h > 0 ? `♥${h}` : 'bez ♥';

function htmlPoloviny(strana) {
    const { modelka: m, fotky, celkem } = data[strana];
    const info = fotky.length < celkem ? `${fotky.length} nejlepších z ${sklonovat(celkem, 'fotky', 'fotek', 'fotek')}` : sklonovat(fotky.length, 'fotka', 'fotky', 'fotek');
    return `
        <section class="go-pul" data-go-strana="${strana}">
            <header class="go-hlava">
                <img class="go-avatar" src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
                <b>${esc(m.jmeno)}</b>
                ${m.hodnoceni ? `<span class="go-srdicka">${znakySrdicek(m.hodnoceni)}</span>` : ''}
                <span class="go-info">${info}</span>
                <span class="go-pozice" data-go-pozice></span>
                <button type="button" class="go-vybrat" data-go-volba="${strana}" title="Vybrat ${esc(m.jmeno)} (Enter v této polovině)">♥ Tahle</button>
            </header>
            ${fotky.length ? `<div class="go-pas" data-go-pas>${fotky.map((f, i) => `
                <button type="button" class="go-fotka" data-go-fotka="${i}" aria-label="${esc(popisNahledu(f, i))} – zvětšit">
                    <img src="${esc(obrazek(f.url, VELIKOST_PLAKATU_MALA))}" alt="" data-rot="${Number(f.rotace) || 0}" draggable="false" decoding="async" loading="lazy" />
                    <span class="go-srd" data-go-srd>${srdickaFotky(f.hodnoceni)}</span>
                    ${f.album ? `<span class="go-album">${esc(f.album)}</span>` : ''}
                </button>`).join('')}</div>`
                : '<p class="go-prazdne">Modelka zatím nemá fotky v albech.</p>'}
        </section>`;
}

const HTML_OVLADANI = `
    <div class="go-ovladani">
        <span class="go-napoveda">kolečko nebo <kbd>←</kbd> <kbd>→</kbd> listuje polovinou pod myší · <kbd>Tab</kbd> přepne · <kbd>1</kbd>–<kbd>5</kbd> srdíčka fotce · klik zvětší</span>
        <button type="button" class="go-tlacitko" data-go-volba="remiza" title="Obě stejně (↓)"><kbd>↓</kbd> Stejně</button>
        <button type="button" class="go-tlacitko" data-go-zavrit title="Zpět k porovnání (Esc)">Zpět <kbd>Esc</kbd></button>
    </div>
    <div class="go-zoom hidden" data-go-zoom><img alt="" draggable="false" /><span class="go-zoom-popis"></span></div>`;

function vytvorit() {
    okno = document.createElement('div');
    okno.id = 'galerieObou';
    okno.className = 'modal-overlay galerie-obou hidden';
    okno.tabIndex = -1;
    okno.setAttribute('role', 'dialog');
    okno.setAttribute('aria-label', 'Fotky obou modelek');
    document.getElementById('app').appendChild(okno);

    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (zoom) return zavritZoom();
        const volba = t.closest('[data-go-volba]');
        if (volba) return vybrat(volba.dataset.goVolba);
        if (t.closest('[data-go-zavrit]')) return zavrit();
        const fotka = t.closest('[data-go-fotka]');
        if (fotka) {
            const strana = fotka.closest('[data-go-strana]').dataset.goStrana;
            oznacit(strana, Number(fotka.dataset.goFotka), false);
            otevritZoom(strana);
        }
    });
    // Polovina pod myší je aktivní, fotka pod myší zvýrazněná (srdíčka 1–5 jdou jí); mění se jen třídy
    okno.addEventListener('mouseover', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const pul = t.closest('[data-go-strana]');
        if (!pul || zoom) return;
        aktivovat(pul.dataset.goStrana);
        const fotka = t.closest('[data-go-fotka]');
        if (fotka) oznacit(pul.dataset.goStrana, Number(fotka.dataset.goFotka), false);
    });
    // Kolečko posouvá pás pod myší vodorovně
    okno.addEventListener('wheel', (e) => {
        const pas = /** @type {HTMLElement} */ (e.target).closest?.('[data-go-pas]');
        if (!pas || zoom) return;
        e.preventDefault();
        pas.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.5;
    }, { passive: false });
    okno.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        // Zaměřené tlačítko dělá Enterem a mezerníkem to, co tlačítko
        if ((e.key === 'Enter' || e.key === ' ') && /** @type {HTMLElement} */ (e.target).closest?.('button') && !zoom) return;
        const akce = klavesa(e);
        if (!akce) return;
        e.preventDefault();
        e.stopPropagation();
        akce();
    });
}

function klavesa(e) {
    if (zoom) {
        return { Escape: zavritZoom, ArrowLeft: () => krok(zoom, -1), ArrowRight: () => krok(zoom, 1), Enter: zavritZoom, ' ': zavritZoom }[e.key]
            || (/^[0-5]$/.test(e.key) ? () => ohodnotit(zoom, Number(e.key)) : null);
    }
    return { Escape: zavrit, ArrowLeft: () => krok(aktivni, -1), ArrowRight: () => krok(aktivni, 1),
        Tab: () => aktivovat(aktivni === 'a' ? 'b' : 'a', true), Enter: () => vybrat(aktivni), ArrowDown: () => vybrat('remiza') }[e.key]
        || (/^[0-5]$/.test(e.key) ? () => ohodnotit(aktivni, Number(e.key)) : null);
}

const polovina = strana => okno.querySelector(`[data-go-strana="${strana}"]`);

function aktivovat(strana, posunout = false) {
    aktivni = strana;
    okno.dataset.aktivni = strana;
    if (posunout) oznacit(strana, index[strana]);
}

// Zvýrazněná fotka strany; posunout = dojet k ní v pásu
function oznacit(strana, i, posunout = true) {
    const fotky = data[strana].fotky;
    if (!fotky.length) return;
    index[strana] = Math.min(Math.max(i, 0), fotky.length - 1);
    const pul = polovina(strana);
    pul.querySelectorAll('[data-go-fotka]').forEach(b => b.classList.toggle('aktivni', Number(/** @type {HTMLElement} */ (b).dataset.goFotka) === index[strana]));
    nastavitText(pul.querySelector('[data-go-pozice]'), `${index[strana] + 1} / ${fotky.length}`);
    if (posunout) pul.querySelector(`[data-go-fotka="${index[strana]}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}

function krok(strana, smer) {
    const n = data[strana].fotky.length;
    if (!n) return;
    oznacit(strana, (index[strana] + smer + n) % n);
    if (zoom) ukazatZoom();
}

function otevritZoom(strana) {
    zoom = strana;
    okno.querySelector('[data-go-zoom]').classList.remove('hidden');
    ukazatZoom();
}

function ukazatZoom() {
    const f = data[zoom].fotky[index[zoom]];
    const vrstva = okno.querySelector('[data-go-zoom]');
    const img = /** @type {HTMLImageElement} */ (vrstva.querySelector('img'));
    // Hned obrázek z pásu (je v mezipaměti), ostřejší po načtení
    img.src = obrazek(f.url, VELIKOST_PLAKATU_MALA);
    img.dataset.rot = String(Number(f.rotace) || 0);
    const velky = new Image();
    velky.onload = () => { if (zoom && data[zoom].fotky[index[zoom]] === f) img.src = velky.src; };
    velky.src = obrazek(f.url, VELIKOST_PLAKATU);
    nastavitText(vrstva.querySelector('.go-zoom-popis'), `${data[zoom].modelka.jmeno} · ${popisNahledu(f, index[zoom])} · ← → listuje, Esc zpět`);
}

function zavritZoom() {
    zoom = null;
    okno.querySelector('[data-go-zoom]').classList.add('hidden');
}

async function ohodnotit(strana, hodnoceni) {
    const f = data[strana].fotky[index[strana]];
    if (!f) return;
    let ok = false;
    try {
        ok = await SetHodnoceniFotek([f.id], hodnoceni);
    } catch { /* oznámí se níž */ }
    if (!ok) return oznamit('Srdíčka fotky se nepodařilo uložit.');
    f.hodnoceni = hodnoceni;
    const stitek = polovina(strana)?.querySelector(`[data-go-fotka="${data[strana].fotky.indexOf(f)}"] [data-go-srd]`);
    if (stitek) nastavitText(stitek, srdickaFotky(hodnoceni));
    if (zoom === strana) ukazatZoom();
}

function vybrat(volba) {
    const { vybrat: poVolbe } = data;
    zavrit();
    poVolbe(volba);
}

function zavrit() {
    if (!okno || okno.classList.contains('hidden')) return;
    zavritZoom();
    okno.classList.add('hidden');
    okno.innerHTML = '';
    data = null;
    if (predtim?.isConnected) predtim.focus({ preventScroll: true });
}

/**
 * Otevře galerii obou modelek.
 * @param {{ a: { modelka: any, fotky: any[], celkem: number }, b: { modelka: any, fotky: any[], celkem: number },
 *   strana?: 'a'|'b', vybrat: (volba: string) => void }} vstup
 */
export function otevritGalerii(vstup) {
    if (!okno) vytvorit();
    data = vstup;
    predtim = /** @type {HTMLElement} */ (document.activeElement);
    index.a = index.b = 0;
    zoom = null;
    okno.innerHTML = htmlPoloviny('a') + htmlPoloviny('b') + HTML_OVLADANI;
    okno.classList.remove('hidden');
    oznacit('a', 0, false);
    oznacit('b', 0, false);
    aktivovat(vstup.strana || 'a');
    okno.focus({ preventScroll: true });
}
