// Fotky (Hodnocení › Fotky): všechny nehodnocené fotky napříč modelkami v běžném prohlížeči fotek. Náhledy fronty
// (klik otevře prohlížeč – listování, nebo promítání z hlavičky Hodnocení) zamíchané, nebo po modelkách
// (lib/hodnoceni.js, pořadí stálé po celé spuštění); řádek modelek otevře jen fotky jedné, pod ním Dál na řadě.
// V prohlížeči 1–5 fotku ohodnotí a ta z něj hned vypadne (otevritLightbox s jenNehodnocene). Seznam dodává
// GetNehodnoceneFotky (jen když je potřeba), počet pro hlavičku Hodnocení GetPocetNehodnocenychFotek; hodnocení
// fotek kdekoli jinde ho hned upraví (událost hodnoceni-fotek).
import { GetNehodnoceneFotky, GetPocetNehodnocenychFotek } from './backend';
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

// Pořadí fotek (Náhodně / Po modelkách) je volba v liště pod hledáním: skrytý řádek nahoře převezme prehled.js
const ukazatVolby = () => document.dispatchEvent(new CustomEvent('volby-prehledu'));

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
    // Prohlížeč fronty ohodnotil, vrátil, otevřel se nebo zavřel: stavová lišta (potvrzení po chvíli přejde ve Vrátit)
    document.addEventListener('lb-hodnoceni', () => {
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
        if (t.closest('[data-gh-start]')) otevrit(0);
        else if (t.closest('[data-gh-promitat]')) otevrit(0, true);
        else if (t.closest('[data-gh-vratit]')) lbVratitHodnoceni();
        else if (ukazka) otevrit(Number(ukazka.dataset.ghUkazka));
        else if (jedna) otevrit(0, false, polozky.filter(p => p.modelkaId === Number(jedna.dataset.ghModelka)));
    });
    // Na stránce Fotky: Enter začne hodnotit, mezerník promítat (ne při psaní, nad oknem ani na tlačítku)
    document.addEventListener('keydown', (e) => {
        if ((e.key !== 'Enter' && e.key !== ' ') || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
        if (!kontejner?.isConnected || !kontejner.offsetParent || !polozky.length || stav.zamceno || jeVidet('lightbox') || otevreneOkno()) return;
        if (/** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, button, a, [contenteditable]')) return;
        e.preventDefault();
        otevrit(0, e.key === ' ');
    });
}
