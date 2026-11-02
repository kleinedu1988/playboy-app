// Fotky (Hodnocení › Fotky): všechny nehodnocené fotky napříč modelkami v běžném prohlížeči fotek. Náhledy fronty
// (klik otevře prohlížeč – listování, nebo promítání z hlavičky Hodnocení) zamíchané, nebo po modelkách
// (lib/hodnoceni.js, pořadí stálé po celé spuštění); řádek modelek otevře jen fotky jedné, pod ním Dál na řadě.
// V prohlížeči 1–5 fotku ohodnotí a ta z něj hned vypadne (otevritLightbox s jenNehodnocene). Seznam dodává
// GetNehodnoceneFotky (jen když je potřeba), počet pro hlavičku Hodnocení GetPocetNehodnocenychFotek; hodnocení
// fotek kdekoli jinde ho hned upraví (událost hodnoceni-fotek).
import { GetNehodnoceneFotky, GetNepotagovaneFotky, GetPocetNehodnocenychFotek, GetPoctyTagu, SetHodnoceni } from './backend';
import { historieTagu, nazevTagu, otagovano, vratitTagovani, vykreslitPanel, zacitTagovani } from './tagovani';
import { htmlOdhadu, htmlSrdicka } from './galerie';
import { kratceSrdicka } from '../lib/srdicka';
import { obnovitSrdickaModelky } from '../ui/srdicka';
import { oznamit } from '../ui/oznameni';
import { esc, sklonovat } from '../lib/format';
import { frontaFotek } from '../lib/hodnoceni';
import { sestavitAlba } from '../lib/alba';
import { adresaFotkyVysky } from './porovnani-pasy';
import { lbVratitHodnoceni, otevritLightbox } from './prohlizec';
import { prohlizetBezZajmu } from './zajem';
import { stav } from './stav';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { jeVidet, nastavitHtml, otevreneOkno } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';

const KLIC_RAZENI = 'galerieRazeni';
const NAHLEDU = 5; // velké náhledy v dlaždici
const MODELEK = 8;

let kontejner = null;
let polozky = []; // nehodnocené položky prohlížeče (fotka, nebo spojený plakát) v pořadí ukázky
let nacitani = null; // rozběhlé načtení seznamu (sdílí ho další volání)
let nacistZnovu = false; // během načtení se něco změnilo: načíst ještě jednou
let pocet = -1; // nehodnocených fotek z posledního načtení (-1 = ještě nenačteno)
let poZmenePoctu = (/** @type {number} */ _n) => {};

const razeni = () => { try { return localStorage.getItem(KLIC_RAZENI) || 'nahodne'; } catch { return 'nahodne'; } };
// Pořadí fotek pro lištu hlavičky Hodnocení (Náhodně / Po modelkách) a jeho změna
export const razeniFotek = razeni;
export function nastavitRazeniFotek(klic) {
    if (klic === razeni()) return;
    try { localStorage.setItem(KLIC_RAZENI, klic); } catch { /* jen pro toto spuštění */ }
    if (kontejner) nacistGalerii(kontejner);
}

// Semínko náhodného pořadí: po celé spuštění stejné, takže se na frontu dá po zavření prohlížeče navázat
const SEMINKO = Date.now() % 100000;

// Akce Hodnotit fotky / Promítat z hlavičky Hodnocení: prohlížeč na nehodnocených fotkách (počká na načtení)
export async function hodnotitFotky(promitat = false) {
    if (nacitani) await nacitani;
    otevrit(0, promitat);
}

// Jen počet nehodnocených (pilulka a hlavička, když Fotky nejsou vidět): bez načítání celého seznamu
export async function nacistPocetNehodnocenych() {
    let n = pocet;
    try { n = await GetPocetNehodnocenychFotek(); } catch { return; }
    if (n !== pocet) {
        pocet = n;
        poZmenePoctu(pocet);
    }
}

// Počet nehodnocených fotek z posledního načtení (-1, dokud se nenačetly)
export const pocetNehodnocenych = () => pocet;

// Načtení seznamu; volání během načtení se nezahodí – po doběhnutí se načte ještě jednou (stav po hodnocení)
export function nacistGalerii(prvek) {
    kontejner = prvek;
    if (nacitani) {
        nacistZnovu = true;
        return nacitani;
    }
    nacitani = (async () => {
        do {
            nacistZnovu = false;
            await nacistGaleriiJednou();
        } while (nacistZnovu);
    })().finally(() => { nacitani = null; });
    return nacitani;
}

async function nacistGaleriiJednou() {
    if (pohledHodnotit() === 'tagy') return nacistTagy();
    nacistPocetBezTagu();
    let fotky = [];
    try {
        fotky = await GetNehodnoceneFotky() || [];
    } catch {
        nastavitHtml(kontejner, '<p class="ob-info">Nehodnocené fotky se nepodařilo načíst.</p>');
        ukazatVolby();
        return;
    }
    // Položky jako v profilu (spojený plakát je jedna položka), pak stálé pořadí podle semínka
    polozky = frontaFotek(sestavitAlba(fotky).flatMap(a => a.polozky), { razeni: razeni(), seed: SEMINKO });
    vykreslit(fotky.length);
    if (pocet !== fotky.length) {
        pocet = fotky.length;
        poZmenePoctu(pocet);
    }
}

// Modelky s nejvíc nehodnocenými položkami: [{ id, jmeno, n }]
function modelkyFronty() {
    const podle = new Map();
    polozky.forEach(p => {
        const x = podle.get(p.modelkaId) || { id: p.modelkaId, jmeno: p.jmenoModelky || '', n: 0 };
        x.n++;
        podle.set(p.modelkaId, x);
    });
    return [...podle.values()].sort((a, b) => b.n - a.n || a.jmeno.localeCompare(b.jmeno, 'cs'));
}

function vykreslit(fotek) {
    if (!kontejner) return;
    if (pohledHodnotit() === 'modelky') return vykreslitModelky();
    if (pohledHodnotit() === 'tagy') return vykreslitTagy();
    if (!polozky.length) {
        nastavitHtml(kontejner, `<div class="ob-karta">${htmlPrazdna('Všechny fotky jsou ohodnocené', 'Nové nehodnocené fotky se tu objeví, až je přidáš.', { ikona: 'hvezda' })}</div>`);
        return ukazatVolby();
    }
    const modelky = modelkyFronty();
    const avatar = id => {
        const m = stav.prehledModelky.get(id);
        return m ? `<img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />` : '';
    };
    // Stavová lišta stránky: počet a klikatelné klávesy (Enter začne hodnotit, mezerník promítat); prohlížeč fronty
    // má vlastní řádek (data-gh-lb-lista, vykreslitListuProhlizece)
    nastavitHtml(kontejner, `
        <div class="volby-v-liste" data-volby-casti="hodnoceni-fotky">
            <button type="button" data-gh-start data-stav-klavesa="↵" data-stav-priorita="1" title="Začít hodnotit (Enter)">Hodnotit</button>
            <button type="button" data-gh-promitat data-stav-klavesa="Mezerník" data-stav-priorita="2" title="Promítat nehodnocené fotky (mezerník)">Promítat</button>
            <span>${esc(`${sklonovat(fotek, 'fotka', 'fotky', 'fotek')} bez srdíček · ${sklonovat(modelky.length, 'modelka', 'modelky', 'modelek')}`)}</span>
        </div>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-fotky-lb" data-gh-lb-lista
            data-stav-napoveda="1–5 srdíčka · → přeskočit · ⌫ vrátit · Esc konec"></div>
        <div class="ob-karta gh-dlazdice">
            <!-- Klik na fotku otevře prohlížeč na ní; tlačítko přes pruh začne od první -->
            <div class="gh-nahledy" aria-label="Na řadě – klik otevře prohlížeč">${polozky.slice(0, NAHLEDU).map((p, i) => `<button type="button" class="gh-nahled" data-gh-ukazka="${i}" title="${esc(`${p.jmenoModelky} · ${p.album}`)}"><img src="${esc(adresaFotkyVysky(p.fotky[0], 600))}" alt="" draggable="false" loading="lazy" /></button>`).join('')}
                <button type="button" class="gh-start" data-gh-start title="Prohlížeč na první fotce fronty (Enter)">♥ Začít hodnotit <kbd>↵</kbd></button>
            </div>
            <div class="gh-modelky" aria-label="Jen fotky jedné modelky">
                <small>Jen jedna modelka</small>
                ${modelky.slice(0, MODELEK).map(x => `<button type="button" class="gh-modelka" data-gh-modelka="${x.id}" title="${esc(`Prohlížet jen nehodnocené fotky – ${x.jmeno}`)}"><span class="gh-avatar">${avatar(x.id)}</span>${esc(x.jmeno)}<b>${x.n}</b></button>`).join('')}
                ${modelky.length > MODELEK ? `<span class="gh-dalsi">+ ${esc(sklonovat(modelky.length - MODELEK, 'další', 'další', 'dalších'))}</span>` : ''}
            </div>
        </div>
        `);
    nacitatPostupne(kontejner);
    ukazatVolby();
}

// Stavová lišta prohlížeče fronty (řádek data-gh-lb-lista; prehled.js ho vybere, když prohlížeč hodnotí): vlevo
// dílky k další desítce a „Ohodnoceno 3 · zbývá 53“, vpravo po hodnocení na chvíli „✓ ♥♥♥♥ Dana“, pak
// „↶ Vrátit: ♥♥♥♥ Dana“ (klik i ⌫), za tím klávesy
const POTVRZENI_MS = 3000;
let casovacPotvrzeni = 0;
function vykreslitListuProhlizece() {
    const misto = kontejner?.querySelector('[data-gh-lb-lista]');
    if (!misto) return;
    if (!stav.lbJenNehodnocene) {
        nastavitHtml(misto, '');
        return ukazatVolby();
    }
    const hotovo = stav.lbHistorie.length;
    const zbyva = stav.lbPolozky.length;
    const cil = (Math.floor(hotovo / 10) + 1) * 10;
    const dilky = Array.from({ length: 10 }, (_, i) => `<i class="${i < hotovo - (cil - 10) ? 'on' : ''}"></i>`).join('');
    const posledni = stav.lbHistorie[hotovo - 1];
    let vratit = '';
    if (posledni) {
        const text = `${'♥'.repeat(posledni.zvoleno)} ${String(posledni.polozka.jmenoModelky || '').split(' ')[0]}`;
        const cerstve = Date.now() - (posledni.cas || 0) < POTVRZENI_MS;
        vratit = `<button type="button" data-gh-vratit data-stav-priorita="1" data-stav-trida="${cerstve ? 'stav-potvrzeni' : 'stav-akce'}" title="Vrátit poslední hodnocení (Backspace)">${esc(cerstve ? `✓ ${text} · ↶` : `↶ Vrátit: ${text}`)}</button>`;
    }
    nastavitHtml(misto, `${vratit}<span data-stav-html title="Ohodnoceno v tomto prohlížení"><span class="stav-dilky" aria-hidden="true">${dilky}</span>Ohodnoceno ${hotovo} · zbývá ${zbyva}</span>`);
    ukazatVolby();
}

// ——— Hodnotit › Tagy: fronta fotek bez tagů po albech (tagování v prohlížeči, tagovani.js) ———
let polozkyTagu = [];
let pocetBezTagu = -1;
export const pocetNepotagovanych = () => pocetBezTagu;

async function nacistPocetBezTagu() {
    try {
        const n = (await GetPoctyTagu())?.[''] ?? -1;
        if (n !== pocetBezTagu) {
            pocetBezTagu = n;
            poZmenePoctu(pocet);
        }
    } catch { /* bez počtu */ }
}

async function nacistTagy() {
    let fotky = [];
    try { fotky = await GetNepotagovaneFotky() || []; } catch { fotky = []; }
    // Po modelkách a albech, jak přišly (série z jednoho focení za sebou); spojený plakát je jedna položka
    polozkyTagu = sestavitAlba(fotky).flatMap(a => a.polozky);
    pocetBezTagu = fotky.length;
    poZmenePoctu(pocet);
    vykreslit(pocet);
}

function vykreslitTagy() {
    if (!polozkyTagu.length) {
        nastavitHtml(kontejner, `<div class="volby-v-liste" data-volby-casti="hodnoceni-fotky"><span>Všechny fotky mají tagy</span></div>
            <div class="ob-karta">${htmlPrazdna('Všechny fotky mají tagy', 'Nové fotky bez tagů se tu objeví, až je přidáš.', { ikona: 'hvezda' })}</div>`);
        return ukazatVolby();
    }
    // Alba fronty: klik začne tagovat od jejich první fotky
    const alba = [];
    polozkyTagu.forEach((p, i) => {
        const klic = `${p.modelkaId}|${p.album}|${p.typ}`;
        const posledni = alba[alba.length - 1];
        if (posledni?.klic === klic) posledni.n++;
        else alba.push({ klic, od: i, n: 1, nazev: `${p.jmenoModelky || ''} · ${p.album}` });
    });
    nastavitHtml(kontejner, `
        <div class="volby-v-liste" data-volby-casti="hodnoceni-fotky">
            <button type="button" data-tg-start data-stav-klavesa="↵" data-stav-priorita="1" title="Začít tagovat (Enter)">Tagovat</button>
            <span>${esc(`${sklonovat(pocetBezTagu, 'fotka', 'fotky', 'fotek')} bez tagů · ${sklonovat(alba.length, 'album', 'alba', 'alb')}`)}</span>
        </div>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-fotky-tag" data-tg-lista
            data-stav-napoveda="Z záběr · O odhalení · M místo · P prsa · V vagina · H podpatky · ↵ uložit · 1–5 i srdíčka · . jako minulá · ⇧↵ celé album"></div>
        <div class="ob-karta gh-dlazdice">
            <div class="gh-nahledy" aria-label="Na řadě – klik začne tagovat od fotky">${polozkyTagu.slice(0, NAHLEDU).map((p, i) => `<button type="button" class="gh-nahled" data-tg-od="${i}" title="${esc(`${p.jmenoModelky} · ${p.album}`)}"><img src="${esc(adresaFotkyVysky(p.fotky[0], 600))}" alt="" draggable="false" loading="lazy" /></button>`).join('')}
                <button type="button" class="gh-start" data-tg-start title="Prohlížeč s panelem tagů na první fotce fronty (Enter)">🏷 Začít tagovat <kbd>↵</kbd></button>
            </div>
            <div class="gh-modelky" aria-label="Alba bez tagů">
                <small>Album</small>
                ${alba.slice(0, MODELEK).map(a => `<button type="button" class="gh-modelka" data-tg-od="${a.od}" title="Tagovat od první fotky alba">${esc(a.nazev)}<b>${a.n}</b></button>`).join('')}
                ${alba.length > MODELEK ? `<span class="gh-dalsi">+ ${esc(sklonovat(alba.length - MODELEK, 'další album', 'další alba', 'dalších alb'))}</span>` : ''}
            </div>
        </div>`);
    ukazatVolby();
}

// Tagování v prohlížeči od položky fronty; po zavření se fronta načte znovu (až doběhnou zápisy)
async function otevritTagovani(od = 0) {
    if (!polozkyTagu.length) return;
    await zacitTagovani();
    prohlizetBezZajmu();
    otevritLightbox(od, false, [...polozkyTagu], { tagovani: true, poZavreni: () => { if (kontejner?.isConnected) nacistTagy(); } });
    vykreslitPanel();
}

// Stavová lišta tagování: dílky k další desítce, „Otagováno 3 · zbývá 120“, po uložení „✓ Postava · Akt · Studio“
// a pak „↶ Vrátit“, za tím klávesy
let casovacTagu = 0;
function vykreslitListuTagovani() {
    const misto = kontejner?.querySelector('[data-tg-lista]');
    if (!misto) return;
    if (!stav.lbTagovani) {
        nastavitHtml(misto, '');
        return ukazatVolby();
    }
    const cil = (Math.floor(otagovano / 10) + 1) * 10;
    const dilky = Array.from({ length: 10 }, (_, i) => `<i class="${i < otagovano - (cil - 10) ? 'on' : ''}"></i>`).join('');
    const posledni = historieTagu[historieTagu.length - 1];
    let vratit = '';
    if (posledni) {
        const text = `${posledni.tagy.map(nazevTagu).join(' · ')}${posledni.hodnoceni ? ` ${'♥'.repeat(posledni.hodnoceni)}` : ''}${posledni.polozky.length > 1 ? ` (${posledni.polozky.length} fotek)` : ''}`;
        const cerstve = Date.now() - posledni.cas < POTVRZENI_MS;
        vratit = `<button type="button" data-tg-vratit data-stav-priorita="1" data-stav-trida="${cerstve ? 'stav-potvrzeni' : 'stav-akce'}" title="Vrátit poslední uložení (Backspace)">${esc(cerstve ? `✓ ${text} · ↶` : `↶ Vrátit: ${text}`)}</button>`;
    }
    nastavitHtml(misto, `${vratit}<span data-stav-html><span class="stav-dilky" aria-hidden="true">${dilky}</span>Otagováno ${otagovano} · zbývá ${stav.lbPolozky.length}</span>`);
    ukazatVolby();
}

// Pořadí fotek (Náhodně / Po modelkách) je volba v liště pod hledáním: skrytý řádek nahoře převezme prehled.js
const ukazatVolby = () => document.dispatchEvent(new CustomEvent('volby-prehledu'));

// ——— Hodnotit › Modelky: modelky bez srdíček (dřív úkol Údržby) ———
// Karty napřed s nejvyšším odhadem vkusu; 1–5 na zaměřených srdíčkách (stejná číslice znovu = půlka), po chvíli
// fokus přejde na další kartu. Ohodnocené zůstanou do odchodu z pohledu ztlumené. Stavová lišta: postup a Vrátit.
const KLIC_POHLEDU = 'hodnotitPohled';
const MODELEK_NAJEDNOU = 60;
const DALSI_PO_MS = 1100;
export const pohledHodnotit = () => {
    try {
        const p = localStorage.getItem(KLIC_POHLEDU);
        return p === 'modelky' || p === 'tagy' ? p : 'fotky';
    } catch { return 'fotky'; }
};
export function nastavitPohledHodnotit(klic) {
    try { localStorage.setItem(KLIC_POHLEDU, klic); } catch { /* jen pro toto spuštění */ }
    relaceModelek = { historie: [], hotove: new Set() };
    if (klic === 'tagy') return nacistTagy();
    vykreslit(pocet);
    if (klic === 'modelky') zameritDalsi(null);
}

let relaceModelek = { historie: [], hotove: new Set() };
let casovacDalsi = 0;
const bezSrdicek = () => [...stav.prehledModelky.values()].filter(m => !(m.hodnoceni > 0));
export const pocetModelekBezSrdicek = () => bezSrdicek().length;

function vykreslitModelky() {
    const hotove = relaceModelek.hotove;
    const seznam = [...stav.prehledModelky.values()].filter(m => !(m.hodnoceni > 0) || hotove.has(m.id))
        .sort((a, b) => (Number(b.odhadHodnoceni) || 0) - (Number(a.odhadHodnoceni) || 0) || (b.pocetFotek || 0) - (a.pocetFotek || 0)
            || String(a.jmeno).localeCompare(String(b.jmeno), 'cs'));
    if (!seznam.length) {
        nastavitHtml(kontejner, `<div class="volby-v-liste" data-volby-casti="hodnoceni-fotky"><span>Všechny modelky mají srdíčka</span></div>
            <div class="ob-karta">${htmlPrazdna('Všechny modelky mají srdíčka', 'Nové modelky bez srdíček se tu objeví, až je přidáš.', { ikona: 'srdce' })}</div>`);
        return ukazatVolby();
    }
    nastavitHtml(kontejner, `<div class="volby-v-liste" data-volby-casti="hodnoceni-fotky" data-hm-lista
            data-stav-napoveda="1–5 srdíčka · stejná znovu půlka · Tab další · ⌫ vrátit"></div>
        <div class="ob-karta hm-karta-obal">
            <div class="ob-tipy hm-mrizka">${seznam.slice(0, MODELEK_NAJEDNOU).map(m => `<div class="ob-tip ${hotove.has(m.id) ? 'ohodnoceno' : ''}" data-hm-modelka="${m.id}">
                <button type="button" class="ob-tip-foto" data-otevrit-modelku="${m.id}" title="Otevřít profil" aria-label="${esc(m.jmeno)} – otevřít profil">
                    <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />${htmlOdhadu(m)}
                </button>
                <button type="button" class="ob-jmeno" data-otevrit-modelku="${m.id}">${esc(m.jmeno)}</button>
                ${htmlSrdicka(m)}
            </div>`).join('')}</div>
            ${seznam.length > MODELEK_NAJEDNOU ? `<p class="hz-tichy hm-dalsi">a ${esc(sklonovat(seznam.length - MODELEK_NAJEDNOU, 'další', 'další', 'dalších'))} – ukážou se, až tyhle ohodnotíš</p>` : ''}
        </div>`);
    nacitatPostupne(kontejner);
    vykreslitListuModelek();
}

// Stavová lišta: dílky k další desítce, „Ohodnoceno 3 · zbývá 12 modelek“, potvrzení a Vrátit
function vykreslitListuModelek() {
    const misto = kontejner?.querySelector('[data-hm-lista]');
    if (!misto) return;
    const hotovo = relaceModelek.historie.length;
    const zbyva = pocetModelekBezSrdicek();
    const cil = (Math.floor(hotovo / 10) + 1) * 10;
    const dilky = Array.from({ length: 10 }, (_, i) => `<i class="${i < hotovo - (cil - 10) ? 'on' : ''}"></i>`).join('');
    const posledni = relaceModelek.historie[hotovo - 1];
    let vratit = '';
    if (posledni) {
        const m = stav.prehledModelky.get(posledni.id);
        const text = `${kratceSrdicka(m?.hodnoceni || 0)} ♥ ${String(m?.jmeno || '').split(' ')[0]}`;
        const cerstve = Date.now() - posledni.cas < POTVRZENI_MS;
        vratit = `<button type="button" data-hm-vratit data-stav-priorita="1" data-stav-trida="${cerstve ? 'stav-potvrzeni' : 'stav-akce'}" title="Vrátit poslední hodnocení (Backspace)">${esc(cerstve ? `✓ ${text} · ↶` : `↶ Vrátit: ${text}`)}</button>`;
    }
    nastavitHtml(misto, `${vratit}<span data-stav-html><span class="stav-dilky" aria-hidden="true">${dilky}</span>Ohodnoceno ${hotovo} · zbývá ${esc(sklonovat(zbyva, 'modelka', 'modelky', 'modelek'))} bez srdíček</span>`);
    ukazatVolby();
}

// Fokus na srdíčka další neohodnocené karty za danou (null = první)
function zameritDalsi(za) {
    const karty = [...(kontejner?.querySelectorAll('[data-hm-modelka]') || [])];
    const od = za ? karty.findIndex(k => k.dataset.hmModelka === String(za)) + 1 : 0;
    const dalsi = [...karty.slice(od), ...karty.slice(0, od)].find(k => !k.classList.contains('ohodnoceno'));
    const srdicka = /** @type {HTMLElement | null} */ (dalsi?.querySelector('.hearts-pul[data-hodnoceni]'));
    srdicka?.focus({ preventScroll: true });
    srdicka?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

const modelkyVidet = () => Boolean(kontejner?.isConnected && kontejner.offsetParent) && pohledHodnotit() === 'modelky'
    && stav.oblibenostCast === 'hodnoceni' && stav.hodnoceniPohled === 'fotky';

// Srdíčka modelky změněná kdekoli: v pohledu Modelky postup, potvrzení a přechod na další kartu
function poHodnoceniModelky(id, hodnoceni) {
    if (!modelkyVidet()) return;
    const karta = kontejner.querySelector(`[data-hm-modelka="${id}"]`);
    if (!karta) return;
    const h = relaceModelek.historie;
    if (hodnoceni > 0) {
        relaceModelek.hotove.add(id);
        karta.classList.add('ohodnoceno');
        // Druhá číslice téže modelky (půlka) je pořád jedno hodnocení
        if (h[h.length - 1]?.id === id) h[h.length - 1].cas = Date.now();
        else h.push({ id, cas: Date.now() });
        clearTimeout(casovacDalsi);
        casovacDalsi = setTimeout(() => {
            if (modelkyVidet() && document.activeElement?.closest?.(`[data-hm-modelka="${id}"]`)) zameritDalsi(id);
            vykreslitListuModelek();
        }, DALSI_PO_MS);
    } else {
        relaceModelek.hotove.delete(id);
        relaceModelek.historie = h.filter(x => x.id !== id);
        karta.classList.remove('ohodnoceno');
    }
    vykreslitListuModelek();
}

// Vrátit poslední hodnocení modelky (srdíčka na 0, karta zase k hodnocení)
async function vratitModelku() {
    const posledni = relaceModelek.historie[relaceModelek.historie.length - 1];
    if (!posledni) return;
    // Posun na další kartu po hodnocení už neplatí: fokus zůstane na vrácené
    clearTimeout(casovacDalsi);
    let ok = false;
    try { ok = await SetHodnoceni(posledni.id, 0); } catch { /* oznámí se níž */ }
    if (!ok) return oznamit('Hodnocení se nepodařilo vrátit.');
    [stav.aktualniModelka, stav.prehledModelky.get(posledni.id), ...stav.nacteneModelky].forEach(m => { if (m?.id === posledni.id) m.hodnoceni = 0; });
    document.querySelectorAll(`.hearts-pul[data-hodnoceni="${posledni.id}"]`).forEach(r => obnovitSrdickaModelky(/** @type {HTMLElement} */ (r), 0));
    document.querySelectorAll(`.odhad-chip[data-odhad="${posledni.id}"]`).forEach(c => c.classList.remove('hidden'));
    document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id: posledni.id, hodnoceni: 0 } }));
    /** @type {HTMLElement | null} */ (kontejner?.querySelector(`[data-hm-modelka="${posledni.id}"] .hearts-pul[data-hodnoceni]`))?.focus({ preventScroll: true });
}


function otevrit(index = 0, promitat = false, seznam = polozky) {
    if (!seznam.length) return;
    prohlizetBezZajmu();
    // Prohlížeč dostane vlastní kopii: ohodnocené z ní vypadávají, po zavření se seznam načte znovu
    otevritLightbox(index, promitat, [...seznam], { jenNehodnocene: true, poZavreni: () => { if (kontejner?.isConnected) nacistGalerii(kontejner); } });
}

// Obsluha; volá ji oblibenost.js jednou. zmenaPoctu(n) dostane nový počet nehodnocených fotek.
export function pripravitGalerii(zmenaPoctu = poZmenePoctu) {
    poZmenePoctu = zmenaPoctu;
    // Fotky ohodnocené kdekoli (prohlížeč, pásy Porovnat): počet hned, fronta bez ohodnocených; stránka se
    // překreslí, jen když prohlížeč nehodnocených neběží (po jeho zavření se načte znovu)
    document.addEventListener('hodnoceni-fotek', (e) => {
        const { ubylo } = /** @type {CustomEvent} */ (e).detail;
        if (pocet < 0) return;
        pocet = Math.max(0, pocet - ubylo);
        poZmenePoctu(pocet);
        polozky = polozky.filter(p => !p.hodnoceni);
        if (!stav.lbJenNehodnocene && kontejner?.isConnected && polozky.length) vykreslit(pocet);
    });
    // Tagování: panel skupin a stavová lišta pro zobrazenou fotku; potvrzení po chvíli přejde ve Vrátit
    document.addEventListener('lb-tagovani', () => {
        vykreslitPanel();
        vykreslitListuTagovani();
        clearTimeout(casovacTagu);
        casovacTagu = setTimeout(vykreslitListuTagovani, POTVRZENI_MS + 50);
    });
    // Prohlížeč fronty ohodnotil, vrátil, otevřel se nebo zavřel: stavová lišta (potvrzení po chvíli přejde ve Vrátit)
    document.addEventListener('lb-hodnoceni', () => {
        vykreslitListuTagovani();
        const posledni = stav.lbHistorie[stav.lbHistorie.length - 1];
        if (posledni && !posledni.cas) posledni.cas = Date.now();
        vykreslitListuProhlizece();
        clearTimeout(casovacPotvrzeni);
        if (posledni) casovacPotvrzeni = setTimeout(vykreslitListuProhlizece, POTVRZENI_MS + 50);
    });
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        const ukazka = /** @type {HTMLElement | null} */ (t.closest('[data-gh-ukazka]'));
        const jedna = /** @type {HTMLElement | null} */ (t.closest('[data-gh-modelka]'));
        const odTagu = /** @type {HTMLElement | null} */ (t.closest('[data-tg-od]'));
        if (t.closest('[data-tg-start]')) otevritTagovani(0);
        else if (odTagu) otevritTagovani(Number(odTagu.dataset.tgOd));
        else if (t.closest('[data-tg-vratit]')) vratitTagovani();
        else if (t.closest('[data-gh-start]')) otevrit(0);
        else if (t.closest('[data-gh-promitat]')) otevrit(0, true);
        else if (t.closest('[data-gh-vratit]')) lbVratitHodnoceni();
        else if (t.closest('[data-hm-vratit]')) vratitModelku();
        else if (ukazka) otevrit(Number(ukazka.dataset.ghUkazka));
        else if (jedna) otevrit(0, false, polozky.filter(p => p.modelkaId === Number(jedna.dataset.ghModelka)));
    });
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        poHodnoceniModelky(id, hodnoceni);
    });
    // Hodnotit › Modelky: Backspace vrátí poslední hodnocení, Enter skočí na první kartu bez srdíček
    document.addEventListener('keydown', (e) => {
        if (!modelkyVidet() || e.ctrlKey || e.altKey || e.metaKey || stav.zamceno || jeVidet('lightbox') || otevreneOkno()) return;
        if (/** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [contenteditable]')) return;
        if (e.key === 'Backspace') {
            e.preventDefault();
            vratitModelku();
        } else if (e.key === 'Enter' && !/** @type {HTMLElement} */ (e.target).closest?.('button, a, [role="slider"]')) {
            e.preventDefault();
            zameritDalsi(null);
        }
    });
    // Na stránce Fotky: Enter začne hodnotit, mezerník promítat (ne při psaní, nad oknem ani na tlačítku)
    document.addEventListener('keydown', (e) => {
        if (pohledHodnotit() === 'modelky') return;
        if (pohledHodnotit() === 'tagy') {
            if (e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey || e.repeat || !kontejner?.isConnected || !kontejner.offsetParent
                || !polozkyTagu.length || stav.zamceno || jeVidet('lightbox') || otevreneOkno()) return;
            if (/** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, button, a, [contenteditable]')) return;
            // Týž Enter nesmí dojít k prohlížeči (uložil by fotku bez tagů)
            e.preventDefault();
            e.stopImmediatePropagation();
            otevritTagovani(0);
            return;
        }
        if ((e.key !== 'Enter' && e.key !== ' ') || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
        if (!kontejner?.isConnected || !kontejner.offsetParent || !polozky.length || stav.zamceno || jeVidet('lightbox') || otevreneOkno()) return;
        if (/** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, button, a, [contenteditable]')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        otevrit(0, e.key === ' ');
    });
}
