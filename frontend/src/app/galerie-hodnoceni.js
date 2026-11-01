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
import { otevritLightbox } from './prohlizec';
import { prohlizetBezZajmu } from './zajem';
import { stav } from './stav';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';

const KLIC_RAZENI = 'galerieRazeni';
const NAHLEDU = 5; // velké náhledy v dlaždici
const UKAZEK = 16;
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
    nastavitHtml(kontejner, `
        <div class="volby-v-liste" data-volby-casti="hodnoceni-fotky"
            data-stav-napoveda="1–5 srdíčka · ←/→ listovat · mezerník promítat · Esc konec">
            <span>${esc(`${sklonovat(fotek, 'fotka', 'fotky', 'fotek')} bez srdíček · ${sklonovat(modelky.length, 'modelka', 'modelky', 'modelek')}`)}</span>
        </div>
        <div class="ob-karta gh-dlazdice">
            <!-- Prohlížet a Promítat jsou v hlavičce Hodnocení, klávesy ve stavové liště; klik na fotku otevře prohlížeč -->
            <div class="gh-nahledy" aria-label="Na řadě – klik otevře prohlížeč">${polozky.slice(0, NAHLEDU).map((p, i) => `<button type="button" class="gh-nahled" data-gh-ukazka="${i}" title="${esc(`${p.jmenoModelky} · ${p.album}`)}"><img src="${esc(adresaFotkyVysky(p.fotky[0], 600))}" alt="" draggable="false" loading="lazy" /></button>`).join('')}
</div>
            <div class="gh-modelky" aria-label="Jen fotky jedné modelky">
                <small>Jen jedna modelka</small>
                ${modelky.slice(0, MODELEK).map(x => `<button type="button" class="gh-modelka" data-gh-modelka="${x.id}" title="${esc(`Prohlížet jen nehodnocené fotky – ${x.jmeno}`)}"><span class="gh-avatar">${avatar(x.id)}</span>${esc(x.jmeno)}<b>${x.n}</b></button>`).join('')}
                ${modelky.length > MODELEK ? `<span class="gh-dalsi">+ ${esc(sklonovat(modelky.length - MODELEK, 'další', 'další', 'dalších'))}</span>` : ''}
            </div>
        </div>
        ${polozky.length > NAHLEDU ? `<div class="ob-karta">
            <h4>Dál na řadě <small>dalších ${Math.min(UKAZEK, polozky.length - NAHLEDU)} z fronty · klik otevře prohlížeč na fotce</small></h4>
            <div class="gh-ukazky">${polozky.slice(NAHLEDU, NAHLEDU + UKAZEK).map((p, j) => `<button type="button" class="gh-ukazka" data-gh-ukazka="${NAHLEDU + j}" title="${esc(`${p.jmenoModelky} · ${p.album}`)}"><img src="${esc(adresaFotkyVysky(p.fotky[0], 400))}" alt="" draggable="false" loading="lazy" /><span>${esc(p.jmenoModelky || '')}</span></button>`).join('')}</div>
        </div>` : ''}`);
    nacitatPostupne(kontejner);
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
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        const ukazka = /** @type {HTMLElement | null} */ (t.closest('[data-gh-ukazka]'));
        const jedna = /** @type {HTMLElement | null} */ (t.closest('[data-gh-modelka]'));
        if (ukazka) otevrit(Number(ukazka.dataset.ghUkazka));
        else if (jedna) otevrit(0, false, polozky.filter(p => p.modelkaId === Number(jedna.dataset.ghModelka)));
    });
}
