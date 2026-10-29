// Fotky (Oblíbenost › Hodnocení › Fotky): všechny nehodnocené fotky napříč modelkami v běžném prohlížeči fotek.
// Karta nahoře řekne, kolik fotek zbývá, a otevře prohlížeč (listování, nebo promítání) se všemi nehodnocenými –
// zamíchanými, nebo po modelkách (lib/hodnoceni.js); řádek modelek s nejvíc nehodnocenými otevře jen fotky jedné.
// Pod kartou ukázka fronty. V prohlížeči 1–5 fotku ohodnotí a ta z něj hned vypadne (otevritLightbox
// s jenNehodnocene), takže se hodnocené ve Fotkách neobjevují. Fotky dodává GetNehodnoceneFotky; počet hlásí
// hlavičce Hodnocení (pilulka Fotky) i tehdy, když je pohled skrytý.
import { GetNehodnoceneFotky } from './backend';
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
let nacita = false;
let pocet = -1; // nehodnocených fotek z posledního načtení (-1 = ještě nenačteno)
let poZmenePoctu = (/** @type {number} */ _n) => {};

const razeni = () => { try { return localStorage.getItem(KLIC_RAZENI) || 'nahodne'; } catch { return 'nahodne'; } };

// Počet nehodnocených fotek z posledního načtení (-1, dokud se nenačetly)
export const pocetNehodnocenych = () => pocet;

export async function nacistGalerii(prvek) {
    kontejner = prvek;
    if (nacita) return;
    nacita = true;
    let fotky = [];
    try {
        fotky = await GetNehodnoceneFotky() || [];
    } catch {
        nastavitHtml(kontejner, '<p class="ob-info">Nehodnocené fotky se nepodařilo načíst.</p>');
        return;
    } finally {
        nacita = false;
    }
    // Položky jako v profilu (spojený plakát je jedna položka), pak zamíchat
    polozky = frontaFotek(sestavitAlba(fotky).flatMap(a => a.polozky), { razeni: razeni(), seed: Date.now() % 100000 });
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
        return;
    }
    const modelky = modelkyFronty();
    const avatar = id => {
        const m = stav.prehledModelky.get(id);
        return m ? `<img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />` : '';
    };
    nastavitHtml(kontejner, `
        <div class="ob-karta gh-panel gh-dlazdice">
            <div class="gh-nahledy" aria-label="Na řadě">${polozky.slice(0, NAHLEDU).map((p, i) => `<button type="button" class="gh-nahled" data-gh-ukazka="${i}" title="${esc(`${p.jmenoModelky} · ${p.album}`)}"><img src="${esc(adresaFotkyVysky(p.fotky[0], 600))}" alt="" draggable="false" loading="lazy" /></button>`).join('')}
                <span class="gh-nahledy-stitek">${razeni() === 'modelky' ? 'Po modelkách' : 'Zamíchané'}</span></div>
            <div class="gh-text">
                <h3>Hodnotit fotky <small>Fotky bez srdíček v prohlížeči</small></h3>
                <p class="gh-popis">Dávej srdíčka klávesami <kbd>1</kbd>–<kbd>5</kbd>: ohodnocená fotka zmizí a hned je tu další. Šipky listují, mezerník spustí promítání, <kbd>Esc</kbd> skončí.</p>
                <ul class="gh-cisla">
                    <li><b>${fotek}</b><span>${esc(sklonovat(fotek, 'nehodnocená fotka', 'nehodnocené fotky', 'nehodnocených fotek').replace(/^\d+ /, ''))}</span></li>
                    <li><b>${modelky.length}</b><span>${esc(sklonovat(modelky.length, 'modelka', 'modelky', 'modelek').replace(/^\d+ /, ''))}</span></li>
                    <li class="gh-razeni" role="group" aria-label="Pořadí fotek">
                        <button type="button" class="chip ${razeni() === 'nahodne' ? 'active' : ''}" data-gh-razeni="nahodne" title="Fotky všech modelek zamíchané">Náhodně</button>
                        <button type="button" class="chip ${razeni() === 'modelky' ? 'active' : ''}" data-gh-razeni="modelky" title="Fotky jedné modelky pohromadě, modelky v náhodném pořadí">Po modelkách</button>
                    </li>
                </ul>
                <div class="gh-ovladani">
                    <button type="button" class="btn btn-primary" data-gh-prohlizet>Prohlížet a hodnotit</button>
                    <button type="button" class="btn btn-secondary" data-gh-promitat title="Prohlížeč s promítáním – fotky se samy střídají, srdíčka jde dávat kdykoli">▶ Promítat</button>
                </div>
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
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        const volba = /** @type {HTMLElement | null} */ (t.closest('[data-gh-razeni]'));
        const ukazka = /** @type {HTMLElement | null} */ (t.closest('[data-gh-ukazka]'));
        const jedna = /** @type {HTMLElement | null} */ (t.closest('[data-gh-modelka]'));
        if (volba && volba.dataset.ghRazeni !== razeni()) {
            try { localStorage.setItem(KLIC_RAZENI, volba.dataset.ghRazeni); } catch { /* jen pro toto spuštění */ }
            nacistGalerii(kontejner);
        } else if (ukazka) otevrit(Number(ukazka.dataset.ghUkazka));
        else if (jedna) otevrit(0, false, polozky.filter(p => p.modelkaId === Number(jedna.dataset.ghModelka)));
        else if (t.closest('[data-gh-prohlizet]')) otevrit();
        else if (t.closest('[data-gh-promitat]')) otevrit(0, true);
    });
}
