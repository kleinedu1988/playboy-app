// Pásy fotek v porovnání (Oblíbenost): dvě nezávislé galerie nad sebou – nahoře modelka A, dole B. Vlevo titulní
// fotka se jménem, srdíčky a „♥ Tahle“, hned vedle vodorovný pás jejích nejlepších fotek (nejlepší fotka každého
// alba napřed, GetNahledyModelek).
// Pás pod myší je aktivní (Tab ho přepne): kolečko a ← → listují jím, 1–5 dá srdíčka zvýrazněné fotce, 0 je zruší,
// Enter vybere jeho modelku. Klik na fotku otevře běžný prohlížeč fotek (jako u alb) – otevírá ho oblibenost.js.
// Obsah pásu se při změně jen doplní nebo přepíše přes nastavitHtml a zvýraznění mění jen třídy, nic pod kurzorem
// zbytečně nemizí (WebKitGTK by mohl ztratit klik).
// Výkon: fotky se načítají postupně, až se v pásu přiblíží (asi šířka pásu dopředu), ve velikosti podle výšky pásu
// (w400 na běžném monitoru); pás se znovu sestaví jen při jiných fotkách, změna srdíček přepíše jen štítek;
// zvýraznění mění dvě fotky, ne všechny.
import { SetHodnoceniFotek } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { popisNahledu, stitekUrovne, textSkoreFotek } from '../lib/oblibenost';
import { VELIKOST_NAHLEDU, VELIKOST_PLAKATU_MALA, VELIKOST_TITULNI, adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { htmlSrdicka } from './galerie';
import { nastavitHtml, nastavitText } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

const KOSTER = 6; // prázdných míst v pásu, dokud se fotky načítají

let koren = null;
let data = null; // { a: { modelka, fotky (null = načítá se), celkem }, b: … }
let aktivni = 'a';
const index = { a: 0, b: 0 };
const zvyraznena = { a: null, b: null }; // zvýrazněná fotka (prvek) každého pásu
const sestaveno = { a: '', b: '' }; // čím je pás sestavený (velikost a čísla fotek); jiné fotky = nové sestavení
let velikost = VELIKOST_NAHLEDU;
let fotekNaSirku = 6; // kolik fotek se vejde do pásu (přednačtení další dvojice)

// Velikost fotek podle výšky pásu: šířka fotky 3 : 4 v pixelech obrazovky
function urcitVelikost(pas) {
    const vyska = pas.clientHeight;
    if (!vyska) return;
    const sirka = vyska * 0.75 * (window.devicePixelRatio || 1);
    velikost = sirka <= 420 ? VELIKOST_NAHLEDU : sirka <= 620 ? VELIKOST_PLAKATU_MALA : VELIKOST_TITULNI;
    fotekNaSirku = Math.max(3, Math.ceil(pas.clientWidth / (vyska * 0.75 + 8)) + 1);
}

// Adresa fotky v pásu (i pro přednačtení první fotek další dvojice v oblibenost.js)
export const adresaFotkyPasu = f => obrazek(f.url, velikost);
export const fotekNaObrazovce = () => fotekNaSirku;

const srdickaFotky = h => h > 0 ? `♥${h}` : 'bez ♥';
const polovina = strana => koren?.querySelector(`[data-pas-strana="${strana}"]`);

// Titulní fotka vlevo od pásu: jméno (otevře profil), srdíčka modelky, úroveň oblíbenosti („Top 10“, „⏳ čeká na Top 10
// (5/8 porovnání)“ – z položky pořadí, jinak z modelky), počet fotek a pozice v pásu, „♥ Tahle“
function htmlProfilu(strana) {
    const { modelka: m, fotky, celkem, skore } = data[strana];
    const info = !fotky ? '' : fotky.length < celkem ? `${fotky.length} nejlepších z ${celkem}` : sklonovat(fotky.length, 'fotka', 'fotky', 'fotek');
    const skoreFotek = skore?.skoreFotek > 0
        ? `<span class="pas-skore" title="${esc(`Skóre fotek z ${sklonovat(skore.albFotek, 'alba', 'alb', 'alb')} a ${sklonovat(skore.fotekHodnocenych, 'hodnocené fotky', 'hodnocených fotek', 'hodnocených fotek')} (každé album jeden hlas, rozhodují jeho nejlepší fotky)`)}">${esc(textSkoreFotek(skore.skoreFotek))}</span>` : '';
    const u = stitekUrovne(skore || m);
    const uroven = u ? `<span class="pas-uroven ${u.ceka ? 'ceka' : ''}" title="${esc(u.title)}">${u.ceka ? '⏳ ' : ''}${esc(u.text)}</span>` : '';
    return `
        <img src="${esc(adresaTitulni(m, true))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
        <button type="button" class="pas-vybrat" data-ob-volba="${strana}" title="Líbí se mi víc ${esc(m.jmeno)} (Enter v aktivním pásu)">♥ Tahle</button>
        <div class="pas-popis">
            <button type="button" class="pas-jmeno" data-otevrit-modelku="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>
            ${htmlSrdicka(m)}
            ${uroven}
            ${skoreFotek}
            <small><span>${info}</span><span data-pas-pozice></span></small>
        </div>`;
}

function htmlFotek(strana) {
    const { fotky } = data[strana];
    if (!fotky) return Array.from({ length: KOSTER }, () => '<span class="pas-fotka kostra"></span>').join('');
    if (!fotky.length) return '<p class="pas-prazdne">Modelka zatím nemá fotky v albech.</p>';
    // První fotky dostanou adresu hned, ostatní až se v pásu přiblíží (nacitatPostupne)
    return fotky.map((f, i) => `
        <button type="button" class="pas-fotka" data-pas-fotka="${i}" aria-label="${esc(popisNahledu(f, i))} – otevřít v prohlížeči">
            <img ${i < fotekNaSirku ? 'src' : 'data-src'}="${esc(adresaFotkyPasu(f))}" alt="" data-rot="${Number(f.rotace) || 0}" draggable="false" decoding="async" />
            <span class="pas-srd" data-pas-srd>${srdickaFotky(f.hodnoceni)}</span>
            ${f.album ? `<span class="pas-album">${esc(f.album)}</span>` : ''}
        </button>`).join('');
}

/**
 * Pásy dvojice do místa; volá se při nové dvojici i po načtení fotek (stejná dvojice zachová polohu pásů).
 * @param {HTMLElement} misto
 * @param {{ a: { modelka: any, fotky: any[]|null, celkem: number, skore?: any }, b: { modelka: any, fotky: any[]|null, celkem: number, skore?: any } }} strany
 */
export function vykreslitPasy(misto, strany) {
    const nova = !data || koren !== misto || data.a.modelka.id !== strany.a.modelka.id || data.b.modelka.id !== strany.b.modelka.id;
    koren = misto;
    data = strany;
    if (nova) {
        index.a = index.b = 0;
        nastavitHtml(misto, ['a', 'b'].map(strana => `
            <section class="pas" data-pas-strana="${strana}">
                <div class="pas-profil" data-pas-profil></div>
                <div class="pas-fotky" data-pas-fotky></div>
            </section>`).join(''));
    }
    for (const strana of ['a', 'b']) {
        const pul = polovina(strana);
        nastavitHtml(pul.querySelector('[data-pas-profil]'), htmlProfilu(strana));
        const pas = pul.querySelector('[data-pas-fotky]');
        if (strana === 'a') urcitVelikost(pas);
        const fotky = data[strana].fotky;
        const klic = fotky ? `${velikost}|${fotky.map(f => f.id).join(',')}` : '';
        if (nova || klic !== sestaveno[strana]) {
            // Jiné fotky (nová dvojice, dorazily, jiná velikost): pás se sestaví znovu
            sestaveno[strana] = klic;
            zvyraznena[strana] = null;
            nastavitHtml(pas, htmlFotek(strana));
            if (nova) pas.scrollLeft = 0;
            nacitatPostupne(pas, { root: pas, rootMargin: '0px 100% 0px 25%' });
        } else {
            // Stejné fotky: jen štítky srdíček, které se změnily
            fotky?.forEach((f, i) => nastavitText(pas.children[i]?.querySelector('[data-pas-srd]'), srdickaFotky(f.hodnoceni)));
        }
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
    // Mění se jen dosud a nově zvýrazněná fotka (pohyb myši po pásu volá tohle při každém přejetí)
    const fotka = pul.querySelector('[data-pas-fotky]')?.children[index[strana]];
    if (fotka !== zvyraznena[strana]) {
        zvyraznena[strana]?.classList.remove('aktivni');
        fotka?.classList.add('aktivni');
        zvyraznena[strana] = fotka || null;
        nastavitText(pul.querySelector('[data-pas-pozice]'), ` · ${index[strana] + 1}. fotka`);
    }
    if (posunout) fotka?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}

function krok(strana, smer) {
    const n = data?.[strana].fotky?.length;
    if (!n) return;
    oznacit(strana, (index[strana] + smer + n) % n);
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
    if (i >= 0) nastavitText(polovina(strana)?.querySelector('[data-pas-fotky]')?.children[i]?.querySelector('[data-pas-srd]'), srdickaFotky(hodnoceni));
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

/**
 * Obsluha myši v místě pásů; volá se jednou. otevritFotku(strana, fotka) otevře prohlížeč na kliknuté fotce.
 * @param {HTMLElement} misto
 * @param {(strana: string, fotka: any) => void} otevritFotku
 */
export function pripravitPasy(misto, otevritFotku) {
    misto.addEventListener('click', (e) => {
        const fotka = /** @type {HTMLElement} */ (e.target).closest('[data-pas-fotka]');
        if (!fotka || !data) return;
        const strana = fotka.closest('[data-pas-strana]').dataset.pasStrana;
        oznacit(strana, Number(fotka.dataset.pasFotka), false);
        const f = data[strana].fotky?.[index[strana]];
        if (f) otevritFotku(strana, f);
    });
    // Pás pod myší je aktivní, fotka pod myší zvýrazněná (srdíčka 1–5 jdou jí)
    misto.addEventListener('mouseover', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const pul = t.closest('[data-pas-strana]');
        if (!pul || !data) return;
        if (pul.dataset.pasStrana !== aktivni) aktivovat(pul.dataset.pasStrana);
        const fotka = t.closest('[data-pas-fotka]');
        if (fotka && fotka !== zvyraznena[aktivni]) oznacit(aktivni, Number(fotka.dataset.pasFotka), false);
    });
    // Kolečko posouvá pás pod myší vodorovně
    misto.addEventListener('wheel', (e) => {
        const pas = /** @type {HTMLElement} */ (e.target).closest?.('[data-pas-fotky]');
        if (!pas) return;
        e.preventDefault();
        pas.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.5;
    }, { passive: false });
}
