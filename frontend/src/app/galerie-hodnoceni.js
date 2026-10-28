// Galerie (Oblíbenost › Galerie): všechny nehodnocené fotky napříč modelkami v běžném prohlížeči fotek. Panel ukáže,
// kolik fotek zbývá, a otevře prohlížeč (listování, nebo promítání) se všemi nehodnocenými – zamíchanými, nebo po
// modelkách (lib/hodnoceni.js). V prohlížeči 1–5 fotku ohodnotí a ta z něj hned vypadne (otevritLightbox
// s jenNehodnocene), takže se hodnocené v Galerii neobjevují. Fotky dodává GetNehodnoceneFotky.
import { GetNehodnoceneFotky } from './backend';
import { esc, sklonovat } from '../lib/format';
import { frontaFotek } from '../lib/hodnoceni';
import { sestavitAlba } from '../lib/alba';
import { adresaFotkyVysky } from './porovnani-pasy';
import { otevritLightbox } from './prohlizec';
import { prohlizetBezZajmu } from './zajem';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';

const KLIC_RAZENI = 'galerieRazeni';
const UKAZEK = 12;

let kontejner = null;
let polozky = []; // nehodnocené položky prohlížeče (fotka, nebo spojený plakát) v pořadí ukázky
let nacita = false;

const razeni = () => { try { return localStorage.getItem(KLIC_RAZENI) || 'nahodne'; } catch { return 'nahodne'; } };

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
}

function vykreslit(fotek) {
    if (!kontejner) return;
    if (!polozky.length) {
        nastavitHtml(kontejner, htmlPrazdna('Všechny fotky jsou ohodnocené', 'Nové nehodnocené fotky se tu objeví, až je přidáš.', { ikona: 'hvezda' }));
        return;
    }
    const modelek = new Set(polozky.map(p => p.modelkaId)).size;
    nastavitHtml(kontejner, `
        <div class="ob-karta gh-panel">
            <div class="gh-uvod">
                <h4>${esc(sklonovat(fotek, 'nehodnocená fotka', 'nehodnocené fotky', 'nehodnocených fotek'))} <small>${esc(sklonovat(modelek, 'modelka', 'modelky', 'modelek'))}</small></h4>
                <p>Prohlížej je v běžném prohlížeči fotek a dávej srdíčka klávesami <kbd>1</kbd>–<kbd>5</kbd>: ohodnocená fotka zmizí a hned je tu další. Šipky listují, mezerník spustí promítání, <kbd>Esc</kbd> skončí.</p>
            </div>
            <div class="gh-ovladani">
                <span class="gh-razeni" role="group" aria-label="Pořadí">
                    <button type="button" class="chip ${razeni() === 'nahodne' ? 'active' : ''}" data-gh-razeni="nahodne" title="Fotky všech modelek zamíchané">Náhodně</button>
                    <button type="button" class="chip ${razeni() === 'modelky' ? 'active' : ''}" data-gh-razeni="modelky" title="Fotky jedné modelky pohromadě, modelky v náhodném pořadí">Po modelkách</button>
                </span>
                <button type="button" class="btn btn-primary" data-gh-prohlizet>Prohlížet a hodnotit</button>
                <button type="button" class="btn" data-gh-promitat title="Prohlížeč s promítáním – fotky se samy střídají, srdíčka jde dávat kdykoli">▶ Promítat</button>
            </div>
        </div>
        <div class="gh-ukazky">${polozky.slice(0, UKAZEK).map((p, i) => `<button type="button" class="gh-ukazka" data-gh-ukazka="${i}" title="${esc(`${p.jmenoModelky} · ${p.album}`)}"><img src="${esc(adresaFotkyVysky(p.fotky[0], 400))}" alt="" draggable="false" loading="lazy" /></button>`).join('')}</div>`);
}

function otevrit(index = 0, promitat = false) {
    if (!polozky.length) return;
    prohlizetBezZajmu();
    // Prohlížeč dostane vlastní kopii: ohodnocené z ní vypadávají, po zavření se seznam načte znovu
    otevritLightbox(index, promitat, [...polozky], { jenNehodnocene: true, poZavreni: () => { if (kontejner?.isConnected) nacistGalerii(kontejner); } });
}

// Obsluha; volá ji oblibenost.js jednou
export function pripravitGalerii() {
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        const volba = /** @type {HTMLElement | null} */ (t.closest('[data-gh-razeni]'));
        const ukazka = /** @type {HTMLElement | null} */ (t.closest('[data-gh-ukazka]'));
        if (volba && volba.dataset.ghRazeni !== razeni()) {
            try { localStorage.setItem(KLIC_RAZENI, volba.dataset.ghRazeni); } catch { /* jen pro toto spuštění */ }
            nacistGalerii(kontejner);
        } else if (ukazka) otevrit(Number(ukazka.dataset.ghUkazka));
        else if (t.closest('[data-gh-prohlizet]')) otevrit();
        else if (t.closest('[data-gh-promitat]')) otevrit(0, true);
    });
}
