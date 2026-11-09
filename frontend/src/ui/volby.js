// Volby přehledu v horní liště pod hledáním: řazení (ikona ⇅ a hodnota ▾), povinné volby jako rozbalovací tlačítka
// (Edice: US ▾, ♥ 4+ ▾), tlačítko Filtry s počtem zapnutých filtrů a panelem všech filtrů, zapnuté filtry jako štítky
// s × a nakonec počet položek. Přehled vykreslí do obsahu obyčejný řádek štítků (.chip s data atributem); ten se skryje
// a volba v liště nebo panelu na skrytý štítek jen klikne, takže obsluha přehledu se nemění.
import { esc } from '../lib/format';
import { otevritKontextovouNabidku, zavritKontextovouNabidku } from './nabidka';
import { otevritPanelFiltru, pocetFiltru, stitkyFiltru, zrusitFiltrModelek } from '../app/filtr-modelek';

const POPISKY = {
    razeniGalerie: 'Řazení',
    razeniSteny: 'Řazení',
    minHodnoceni: 'Srdíčka',
    stenaMin: 'Srdíčka',
    nejlepsiMin: 'Zobrazit',
    vyberId: 'Výběr',
    edice: 'Edice',
    ediceCisel: 'Edice',
    ediceModelek: 'Edice',
    ediceSteny: 'Edice',
    zobrazeniCisel: 'Zobrazení',
    roleModelek: 'Kategorie',
    vyskytModelek: 'Výskyt',
    zobrazitCisla: 'Zobrazit',
    udRezim: 'Režim Údržby',
    kronikaFiltr: 'Události',
    filtrFotografa: 'Alba',
    spGrafVolba: 'Graf',
    spDruhVolba: 'Výskyt',
    spEdiceVolba: 'Edice',
    spVyber: 'Výběr',
    udRazeniVolba: 'Řazení',
    udSkryte: 'Vyřízené',
    slavaPohled: 'Pohled',
};

const RAZENI = new Set(['razeniGalerie', 'razeniSteny', 'udRazeniVolba']);
// Zobrazení Čísel (Obálky / Kalendář): rozbalovací volba s ikonou zvolené hodnoty, jako řazení
// Pohledy zvolené části (Síň slávy › Top 10 … Sezóna, Údržba › Po údajích … Souhrn) nejsou volby: kreslí se do
// záhlaví stránky (hlavaStranky). Obálky / Kalendář jsou části Čísel přímo v kapsli, ve volbách nejsou.
const PODMENU = new Set(['slavaPohled']);
// Pohledy Údržby jsou v hlavičce Sbírky (app/udrzba.js, obnovitHlavuSbirky)
const MIMO_VOLBY = new Set(['zobrazeniCisel', 'udRezim']);
const ZOBRAZENI = new Set(['zobrazeniCisel', 'udRezim', 'filtrFotografa', 'slavaPohled']);

// Filtr, který se dá vypnout: bez zvoleného štítku ukazuje výchozí stav a nabídka má položku pro návrat na vše
const VYPINATELNE = new Set(['minHodnoceni', 'stenaMin', 'vyberId', 'spVyber', 'udSkryte']);

// Výběr v Nejlepších mění, odkud fotky jsou, a má vlastní akce (přejmenovat, smazat): zůstává samostatným tlačítkem
const SAMOSTATNE = new Set(['vyberId']);

const IKONA_RAZENI = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>';
const IKONA_FILTRU = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const IKONY_ZOBRAZENI = {
    // Části Modelek (pilulky v kapsli): karta s portrétem, mřížka fotek; Čísla: rozložený plakát (centerfold)
    'Profily': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="10" r="3"/><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/></svg>',
    'Galerie': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    'Centerfoldy': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5 9 4l6 1.5L21 4v14.5L15 20l-6-1.5L3 20z"/><path d="M9 4v14.5M15 5.5V20"/></svg>',
    'Obálky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="3.5" width="7" height="10" rx="1.5"/><rect x="13" y="3.5" width="7" height="10" rx="1.5"/><rect x="4" y="15.5" width="7" height="5" rx="1.5"/><rect x="13" y="15.5" width="7" height="5" rx="1.5"/></svg>',
    'Kalendář': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    // Části Sbírky (pilulky v obsahu Přehledu)
    'Úvod': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5 12 4.5l8 7"/><path d="M6 10v9.5h4.5V15h3v4.5H18V10"/></svg>',
    'Údržba': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/></svg>',
    // Dvě srdíčka vedle sebe: porovnávání, která víc
    'Oblíbenost': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M8 18s-5.5-3.3-5.5-7.4A3 3 0 0 1 8 9a3 3 0 0 1 5.5 1.6c0 4.1-5.5 7.4-5.5 7.4z"/><path d="M15.2 6.6A3 3 0 0 1 21.5 8c0 3.2-3.3 5.9-4.8 6.9"/></svg>',
    // Zobrazení částí v liště pod hledáním: pořadí fotek v Hodnocení, rozsah pořadí a režimy Údržby
    'Celé pořadí': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h11M9 10h11M9 15h11M9 20h11M4 5h.01M4 10h.01M4 15h.01M4 20h.01"/></svg>',
    'Náhodně': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7h3.2c2.4 0 3.6 1.2 5.3 5s2.9 5 5.3 5h3.2M3.5 17h3.2c1.2 0 2.1-.3 2.9-1M14.4 8c.8-.7 1.7-1 2.9-1h3.2M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5"/></svg>',
    'Po modelkách': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.8-4 3.6-6.2 7-6.2s6.2 2.2 7 6.2"/></svg>',
    'Po údajích': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9 4v16"/></svg>',
    'Souhrn': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.5 6.5l1.5 1.5 2.5-2.5M3.5 12l1.5 1.5L7.5 11M3.5 17.5 5 19l2.5-2.5"/></svg>',
    'Sháním CZ': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/></svg>',
    // Část Oblíbenosti Hodnocení: srdíčko z půlky vyplněné (srdíčka, porovnání i pořadí v jednom)
    'Hodnocení': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.35-9.2-8.6C1.4 8.6 3 5 6.5 5c2 0 3.6 1.2 5.5 3.2C13.9 6.2 15.5 5 17.5 5 21 5 22.6 8.6 21.2 11.4 19 15.65 12 20 12 20z"/><path d="M12 20s-7-4.35-9.2-8.6C1.4 8.6 3 5 6.5 5c2 0 3.6 1.2 5.5 3.2V20z" fill="currentColor" stroke="none"/></svg>',
    // Pohledy Hodnocení (pilulky v obsahu, oblibenost.js): dva pásy fotek nad sebou, fotka se srdíčkem, žebříček
    'Porovnat': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/></svg>',
    'Fotky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 16.5s-3.5-2.1-3.5-4.6a1.9 1.9 0 0 1 3.5-1 1.9 1.9 0 0 1 3.5 1c0 2.5-3.5 4.6-3.5 4.6z"/></svg>',
    'Pořadí': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h8M9 18h5"/><path d="M4 5v3M3.5 12h1.5l-1.5 2h1.5M3.5 17.5h1.5v2h-1.5"/></svg>',
    // Pohár: síň slávy
    'Síň slávy': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.3 10.5M17 6h2.5v1.5a3 3 0 0 1-2.8 3"/><path d="M12 14v3M8.5 20h7M9.5 17h5"/></svg>',
    // Pohledy Síně slávy (pilulky pásu): korunka, vavřín, medaile na stuze, vlajka rekordu, kronika (svitek)
    'Top 10': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17.5 3 7.5l5 4 4-6 4 6 5-4-1 10z"/><path d="M4.5 20.5h15"/></svg>',
    'Legendy': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20c-4.5-1-7.5-5-7-10.5M12 20c4.5-1 7.5-5 7-10.5"/><path d="M5.5 13.5c1.5.2 2.8-.4 3.3-1.6M4.8 9.6c1.4.6 2.8.3 3.6-.7M18.5 13.5c-1.5.2-2.8-.4-3.3-1.6M19.2 9.6c-1.4.6-2.8.3-3.6-.7"/><path d="M12 6.5l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z"/></svg>',
    'Odznaky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 3.5h7L13.5 9h-3z"/><circle cx="12" cy="14.5" r="5.5"/><path d="M12 12v5M10 14.5h4"/></svg>',
    'Rekordy': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 21V4"/><path d="M5.5 4.5h12l-2.5 4 2.5 4h-12"/></svg>',
    // Sezóna: kalendář s korunkou
    'Sezóna': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="6" width="17" height="14" rx="2.5"/><path d="M3.5 10.5h17M8 4v4M16 4v4"/><path d="M9 16.5l1-3 2 1.5 2-1.5 1 3z"/></svg>',
    'Kronika': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h11a2 2 0 0 1 2 2v1.5h-4"/><path d="M16 7.5V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-1.5H12V18a2 2 0 0 0 2 2"/><path d="M7 4a2 2 0 0 0-2 2v10.5M8.5 9h4M8.5 12.5h4"/></svg>',
    'Nejlepší': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z"/></svg>',
    'Statistiky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
};
// Ikona volby podle názvu (i pro pilulky v obsahu, ať vypadají jako volby v liště); neznámý název nic
export const ikonaZobrazeni = nazev => IKONY_ZOBRAZENI[nazev] || '';
const TITULKY_ZOBRAZENI = { zobrazeniCisel: 'Zobrazení čísel', udRezim: 'Režim Údržby', filtrFotografa: 'Alba fotografa', slavaPohled: 'Pohledy síně slávy' };
const IKONA_PREHRAT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';

// Panel filtrů zůstává otevřený i po změně filtru (přehled se překreslí a panel se naplní znovu)
let panelOtevren = false;
// „Zrušit filtry“ ruší filtry po jednom: po každém překreslení přehledu se zruší další zapnutý. Platí jen pro
// přehled, ve kterém se začalo (rodič řádku voleb), a nejvýš 3 s; přepnutí jinam nebo nezdařené načtení ho ukončí.
let rusitVse = null;
const RUSENI_NEJDELE = 3000;
const zacitRuseni = (lista) => { rusitVse = { kde: lista?.parentElement, do: Date.now() + RUSENI_NEJDELE }; };
let aktualniLista = null;
let tlacitkoFiltru = null;

const misto = () => document.getElementById('volbyPrehledu');
// Stavová lišta dole (počet, zapnuté filtry, stav a upozornění zvolené části); kapsle voleb nahoře má jen ovládání
const stavVlevo = /** @type {HTMLDivElement} */ (document.querySelector('#stavovaLista .stav-vlevo'));
const stavVpravo = /** @type {HTMLDivElement} */ (document.querySelector('#stavovaLista .stav-vpravo'));

// Text štítku bez počtu (výběr má počet v <span>)
const textStitku = (stitek) => (stitek.childNodes[0]?.textContent || stitek.textContent).trim();

// Řádek voleb přehledu se v obsahu skryje a jeho volby se ukážou v liště
export function prevestNaVolby(lista) {
    if (!lista) return;
    lista.classList.add('volby-v-liste');
    ukazatVolby(lista);
}

// Po přepnutí pohledu: volby nově ukázaného přehledu, nebo prázdné místo (profil, vydání). Přehled má řádků víc
// (každá část svůj) a v data-volby-casti říká, který patří ukázané části (prehled.js).
export function obnovitVolby(pohled) {
    rusitVse = null;
    const cast = pohled.dataset.volbyCasti;
    ukazatVolby(cast === undefined ? pohled.querySelector('.volby-v-liste') : pohled.querySelector(`.volby-v-liste[data-volby-casti="${CSS.escape(cast)}"]`));
}

// Skupina štítků jednoho druhu (řazení, srdíčka, edice…) a co s ní lišta dělá
function popsatSkupinu(klic, stitky) {
    const zvoleny = stitky.find(s => s.classList.contains('active'));
    const vychoziVse = stitky.find(s => Object.values(s.dataset)[0] === 'vse');
    const vypinatelny = VYPINATELNE.has(klic);
    const zapnuto = (vypinatelny && Boolean(zvoleny)) || Boolean(vychoziVse && zvoleny && zvoleny !== vychoziVse);
    const druh = ZOBRAZENI.has(klic) ? 'zobrazeni' : RAZENI.has(klic) ? 'razeni' : SAMOSTATNE.has(klic) ? 'samostatne' : vypinatelny || vychoziVse ? 'filtr' : 'povinne';
    return {
        klic, stitky, zvoleny, vypinatelny, zapnuto, druh,
        // Filtr s vypínáním nemá štítek „vše“: v nabídce i v panelu se doplní
        volby: vypinatelny ? [{ text: klic === 'vyberId' ? 'Vše podle srdíček' : 'Vše', zvolena: !zvoleny, akce: () => zvoleny?.click() }, ...stitky.map(st => volbaStitku(st, zvoleny))]
            : stitky.map(st => volbaStitku(st, zvoleny)),
        zrusit: vypinatelny ? () => zvoleny?.click() : vychoziVse ? () => vychoziVse.click() : null,
    };
}

const volbaStitku = (stitek, zvoleny) => ({
    text: textStitku(stitek).replace(/^vše$/, 'Vše'),
    pocet: stitek.querySelector('span')?.textContent.trim() || '',
    zvolena: stitek === zvoleny,
    akce: () => stitek.click(),
});

const hodnota = s => s.zvoleny ? textStitku(s.zvoleny) : 'vše';

// Záhlaví části s vlastními pohledy (Síň slávy, Údržba): nahoře na stránce štítek sekce, nadpis části, popis
// a vpravo kapsle pohledů. Řádek voleb nese štítek a nadpis (data-stitek, data-nadpis); popis je úvodní věta
// pohledu (.stranka-uvod), která se v obsahu pak neopakuje. Záhlaví se skládá znovu s každými volbami.
function hlavaStranky(lista) {
    const kontejner = lista.parentElement;
    let hlava = /** @type {HTMLElement | null} */ (kontejner.querySelector(':scope > .stranka-hlava'));
    if (!hlava) {
        hlava = document.createElement('header');
        hlava.className = 'stranka-hlava';
        kontejner.prepend(hlava);
    }
    const uvod = kontejner.querySelector('.stranka-uvod');
    hlava.innerHTML = `<div class="stranka-titul">
            ${lista.dataset.stitek ? `<div class="stranka-stitek">${esc(lista.dataset.stitek)}</div>` : ''}
            <h2 class="stranka-nadpis">${esc(lista.dataset.nadpis || '')}</h2>
            ${uvod ? `<p class="stranka-popis">${uvod.innerHTML}</p>` : ''}
        </div>
        <div class="stranka-pohledy" role="group"></div>`;
    return /** @type {HTMLDivElement} */ (hlava.querySelector('.stranka-pohledy'));
}

function ukazatVolby(lista) {
    const cil = misto();
    const podmenu = document.getElementById('podmenu');
    if (podmenu) {
        podmenu.innerHTML = '';
        podmenu.classList.add('hidden');
    }
    // Volby se skládají znovu: fokus zůstane na stejné volbě (podle textu, jinak na stejném místě)
    const aktivni = /** @type {HTMLElement | null} */ (cil.contains(document.activeElement) ? document.activeElement : null);
    const fokus = aktivni && { text: aktivni.textContent.trim(), poradi: [...cil.querySelectorAll('button')].indexOf(/** @type {HTMLButtonElement} */ (aktivni)) };
    cil.innerHTML = '';
    stavVlevo.replaceChildren();
    stavVpravo.replaceChildren();
    cil.classList.toggle('hidden', !lista);
    tlacitkoFiltru = null;
    if (!lista) {
        rusitVse = null;
        zavritPanel();
        return nastavitPocet();
    }

    // Volby a tlačítka jsou v jednom plovoucím panelu s dělicími čarami, počet na jeho konci
    const panel = document.createElement('div');
    panel.className = 'volby-skupina';
    cil.append(panel);

    const podleKlice = new Map();
    lista.querySelectorAll('.chip').forEach(stitek => {
        const klic = Object.keys(stitek.dataset)[0];
        if (!POPISKY[klic] || MIMO_VOLBY.has(klic)) return;
        if (!podleKlice.has(klic)) podleKlice.set(klic, []);
        podleKlice.get(klic).push(stitek);
    });
    const skupiny = [...podleKlice].map(([klic, stitky]) => popsatSkupinu(klic, stitky));
    const filtry = skupiny.filter(s => s.druh === 'filtr');
    const zapnute = filtry.filter(s => s.zapnuto);
    // Odkazy v řádku (přejmenovat a smazat výběr) patří do nabídky výběru, jinak poslední volby
    const odkazy = [...lista.querySelectorAll('button.link')];
    const sOdkazy = skupiny.find(s => s.druh === 'samostatne') || skupiny.filter(s => s.druh !== 'filtr').at(-1);

    aktualniLista = lista;
    if (rusitVse) {
        const pokracovat = rusitVse.kde === lista.parentElement && Date.now() < rusitVse.do && zapnute.length;
        if (pokracovat) setTimeout(() => zapnute[0].zrusit());
        else rusitVse = null;
    }

    const pridatTlacitko = (html, trida = '', kam = panel) => {
        const tlacitko = document.createElement('button');
        tlacitko.type = 'button';
        tlacitko.className = `volba ${trida}`.trim();
        tlacitko.innerHTML = html;
        kam.append(tlacitko);
        return tlacitko;
    };

    const nabidka = (s, tlacitko) => {
        const polozky = s.volby.map(v => ({ text: `${v.zvolena ? '✓ ' : ''}${v.text}${v.pocet ? ` (${v.pocet})` : ''}`, akce: v.akce }));
        if (s === sOdkazy && odkazy.length) {
            polozky.push(null, ...odkazy.map(o => ({ text: o.textContent.trim().replace(/^./, z => z.toUpperCase()), akce: () => o.click() })));
        }
        const r = tlacitko.getBoundingClientRect();
        otevritKontextovouNabidku(r.left, r.bottom + 4, polozky);
    };

    // × u zapnuté volby (nebo Shift+klik, prostřední tlačítko) ji zruší, jinak klik otevře nabídku nebo panel
    const zrusitelne = (tlacitko, s, otevrit) => {
        tlacitko.addEventListener('click', (e) => {
            e.stopPropagation();
            if (s.zapnuto && s.zrusit && (e.shiftKey || e.target.closest('.volba-zrusit'))) return s.zrusit();
            otevrit();
        });
        if (s.zapnuto && s.zrusit) {
            tlacitko.addEventListener('auxclick', (e) => {
                if (e.button !== 1) return;
                e.stopPropagation();
                e.preventDefault();
                s.zrusit();
            });
        }
    };
    const krizek = '<em class="volba-zrusit" title="Zrušit filtr" aria-label="Zrušit filtr">&times;</em>';

    // Přepínač zobrazení (Obálky / Kalendář): všechny možnosti vedle sebe, zvolená
    // zvýrazněná, klik přepne rovnou (bez nabídky)
    const pridatPrepinac = (s, kam = panel) => {
        const prepinac = document.createElement('div');
        prepinac.className = 'volba-prepinac';
        prepinac.setAttribute('role', 'radiogroup');
        prepinac.setAttribute('aria-label', TITULKY_ZOBRAZENI[s.klic] || POPISKY[s.klic]);
        s.volby.forEach(v => {
            const tlacitko = document.createElement('button');
            tlacitko.type = 'button';
            tlacitko.className = `prepinac-volba ${v.zvolena ? 'aktivni' : ''}`.trim();
            tlacitko.setAttribute('role', 'radio');
            tlacitko.setAttribute('aria-checked', String(v.zvolena));
            // Do skupiny vede Tab na zvolenou možnost, mezi možnostmi šipky (jako u pilulek pásu)
            tlacitko.tabIndex = v.zvolena ? 0 : -1;
            tlacitko.title = v.text;
            tlacitko.innerHTML = `${IKONY_ZOBRAZENI[v.text] || ''}<span>${esc(v.text)}</span>${v.pocet ? `<small>${esc(v.pocet)}</small>` : ''}`;
            tlacitko.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!v.zvolena) v.akce();
            });
            prepinac.append(tlacitko);
        });
        prepinac.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            const i = s.volby.findIndex(v => v.zvolena);
            const n = s.volby.length;
            const nova = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
            e.preventDefault();
            e.stopPropagation();
            if (nova !== i) s.volby[nova].akce();
        });
        kam.append(prepinac);
    };

    // Povinná volba bez zvolené hodnoty (srdíčka v Nejlepších, když je zvolený výběr) se neukazuje
    skupiny.filter(s => s.druh !== 'filtr' && (s.druh !== 'povinne' || s.zvoleny)).forEach(s => {
        let tlacitko;
        if (s.druh === 'zobrazeni') {
            if (PODMENU.has(s.klic)) {
                const pohledy = hlavaStranky(lista);
                pridatPrepinac(s, pohledy);
                pohledy.setAttribute('aria-label', TITULKY_ZOBRAZENI[s.klic] || POPISKY[s.klic]);
            } else pridatPrepinac(s);
            return;
        } else if (s.druh === 'razeni') {
            tlacitko = pridatTlacitko(`${IKONA_RAZENI}<b>${esc(hodnota(s))}</b> <i aria-hidden="true">▾</i>`, 'razeni');
            tlacitko.title = 'Řazení';
        } else if (s.druh === 'samostatne') {
            tlacitko = pridatTlacitko(s.zvoleny
                ? `<b>${esc(hodnota(s))}</b> ${krizek} <i aria-hidden="true">▾</i>`
                : `<span class="nazev">${POPISKY[s.klic]}</span> <i aria-hidden="true">▾</i>`, s.zapnuto ? 'zapnuto' : '');
            tlacitko.title = POPISKY[s.klic];
        } else {
            tlacitko = pridatTlacitko(`<span>${POPISKY[s.klic]}:</span> <b>${esc(hodnota(s))}</b> <i aria-hidden="true">▾</i>`);
        }
        tlacitko.setAttribute('aria-haspopup', 'menu');
        zrusitelne(tlacitko, s, () => nabidka(s, tlacitko));
    });

    if (filtry.length) {
        tlacitkoFiltru = pridatTlacitko(`${IKONA_FILTRU}<b>Filtry</b>${zapnute.length ? `<span class="volby-odznak">${zapnute.length}</span>` : ''} <i aria-hidden="true">▾</i>`, 'filtry');
        tlacitkoFiltru.setAttribute('aria-haspopup', 'dialog');
        tlacitkoFiltru.setAttribute('aria-expanded', String(panelOtevren));
        tlacitkoFiltru.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panelOtevren) zavritPanel();
            else otevritPanel();
        });
        // Zapnuté filtry jako štítky ve stavové liště: klik otevře panel, × filtr zruší
        zapnute.forEach(s => {
            const stitek = pridatTlacitko(`${esc(hodnota(s))} ${krizek}`, 'volba-stitek', stavVlevo);
            stitek.title = `${POPISKY[s.klic]}: ${hodnota(s)} – klik otevře Filtry, × filtr zruší`;
            zrusitelne(stitek, s, () => otevritPanel());
        });

    }

    // Modelky: Filtry otevřou panel filtru Modelek (app/filtr-modelek.js) – srdíčka, edice, kategorie, vlasy, roky…
    if (lista.hasAttribute('data-filtry-stitky')) {
        const n = pocetFiltru();
        const tlacitko = pridatTlacitko(`${IKONA_FILTRU}<b>Filtry</b>${n ? `<span class="volby-odznak">${n}</span>` : ''} <i aria-hidden="true">▾</i>`, 'filtry');
        tlacitko.title = 'Filtry: srdíčka, edice, kategorie, vlasy, národnost, roky, výška…';
        tlacitko.setAttribute('aria-haspopup', 'dialog');
        tlacitko.setAttribute('aria-expanded', 'false');
        tlacitko.addEventListener('click', (e) => {
            e.stopPropagation();
            otevritPanelFiltru(tlacitko);
        });
    }

    // Text v hledání, který přehled omezuje (navigace.js, obnovitViditelnostHledani), je ve stavové liště také štítkem:
    // klik skočí do pole, × text smaže. „Zrušit filtry“ ruší filtry i takové hledání.
    const hledani = /** @type {HTMLInputElement | null} */ (document.getElementById('searchInput'));
    const hledaniFiltruje = Boolean(hledani?.value.trim()) && Boolean(document.getElementById('hledaniRadek')?.classList.contains('filtruje'));
    // Štítky filtru Modelek (app/tokeny.js) každý zvlášť: klik otevře jeho editor, × ho zruší
    const stitkyModelek = stitkyFiltru();
    stitkyModelek.forEach(st => {
        const stitek = pridatTlacitko(`${esc(st.text)} ${krizek}`, 'volba-stitek', stavVlevo);
        stitek.title = `${st.text} – klik upraví, × zruší`;
        stitek.addEventListener('click', (e) => {
            if (/** @type {HTMLElement} */ (e.target).closest('.volba-zrusit')) st.zrusit();
            else st.upravit();
        });
    });
    const volnyText = hledani?.value.trim();
    if (hledaniFiltruje && volnyText) {
        const stitek = pridatTlacitko(`<span class="stav-lupa" aria-hidden="true">⌕</span>${esc(volnyText)} ${krizek}`, 'volba-stitek stav-hledani', stavVlevo);
        stitek.title = 'Hledání omezuje přehled – klik skočí do pole, × hledání smaže';
        stitek.addEventListener('click', (e) => {
            if (/** @type {HTMLElement} */ (e.target).closest('.volba-zrusit')) {
                hledani.value = '';
                hledani.dispatchEvent(new Event('input'));
            } else {
                hledani.focus();
            }
        });
    }
    if (zapnute.length || stitkyModelek.length || hledaniFiltruje) {
        const zrusit = document.createElement('button');
        zrusit.type = 'button';
        zrusit.className = 'link stav-zrusit';
        zrusit.textContent = zapnute.length + stitkyModelek.length + (volnyText ? 1 : 0) > 1 ? 'Zrušit filtry' : 'Zrušit filtr';
        zrusit.addEventListener('click', () => zrusitHledaniAFiltry());
        stavVlevo.append(zrusit);
    }

    // Další tlačítka řádku: slideshow jako ikona ▶ v kapsli, ostatní (upozornění s odkazem: „2 modelkám nesedí
    // srdíčka · Pořadí →“) vpravo ve stavové liště; klik na ně klikne na původní
    // data-stav-klavesa: klikatelná klávesa („↵ Tahle“), data-stav-trida: vzhled (potvrzení, akce, návrh),
    // data-stav-priorita: co v užším okně zmizí dřív (3 první, 1 nikdy; style.css)
    lista.querySelectorAll('button:not(.chip):not(.link)').forEach(puvodni => {
        const el = /** @type {HTMLElement} */ (puvodni);
        const popis = el.textContent.trim();
        const slideshow = /slideshow/i.test(popis);
        const klavesa = el.dataset.stavKlavesa;
        const trida = slideshow ? 'akce ikona' : klavesa ? 'stav-klavesa' : el.dataset.stavTrida || 'stav-odkaz';
        const html = slideshow ? IKONA_PREHRAT : klavesa ? `<kbd>${esc(klavesa)}</kbd><span>${esc(popis)}</span>` : esc(popis);
        const tlacitko = pridatTlacitko(html, trida, slideshow ? panel : stavVpravo);
        tlacitko.title = el.title || popis;
        tlacitko.setAttribute('aria-label', popis);
        if (el.dataset.stavPriorita) tlacitko.dataset.priorita = el.dataset.stavPriorita;
        tlacitko.addEventListener('click', () => el.click());
    });

    // Klávesová nápověda části (data-stav-napoveda, úseky oddělené „ · “) vpravo za odkazy; v úzkém okně jen první úsek
    const napoveda = lista.dataset.stavNapoveda;
    if (napoveda) {
        const obal = document.createElement('span');
        obal.className = 'stav-napoveda';
        napoveda.split(' · ').forEach(usek => {
            const kus = document.createElement('span');
            kus.textContent = usek;
            obal.append(kus);
        });
        stavVpravo.append(obal);
    }

    // Počet a stav části (22 modelek, Dnes 0 z 10, 79 % doplněno) je první ve stavové liště a v nápovědě zvolené sekce
    const spany = [...lista.querySelectorAll(':scope > span:not([hidden])')].filter(s => s.textContent.trim());
    const posledni = /** @type {HTMLElement | undefined} */ (spany.pop());
    const pocet = posledni?.textContent.trim().replace(/\s+/g, ' ');
    if (posledni) {
        const pocitadlo = document.createElement('span');
        pocitadlo.className = 'stav-pocet';
        // data-stav-html: stav se značkami (ukazatel dne v Porovnat), jinak jen text
        if (posledni.hasAttribute('data-stav-html')) pocitadlo.innerHTML = posledni.innerHTML;
        else pocitadlo.textContent = pocet;
        if (posledni.title) pocitadlo.title = posledni.title;
        stavVlevo.prepend(pocitadlo);
    }

    if (!panel.childElementCount) panel.remove();
    // Bez voleb (jen podmenu) se prázdná kapsle neukazuje
    cil.classList.toggle('hidden', !cil.querySelector('.volby-skupina'));
    nastavitPocet(pocet);

    aktualniFiltry = { filtry, zapnute, pocet };
    if (panelOtevren && filtry.length) vykreslitPanel();
    else zavritPanel();
    if (fokus) {
        const tlacitka = [...cil.querySelectorAll('button')];
        (tlacitka.find(b => b.textContent.trim() === fokus.text) || tlacitka[Math.min(fokus.poradi, tlacitka.length - 1)])?.focus({ preventScroll: true });
    }
}

// Panel filtrů pod tlačítkem Filtry: každý filtr jako řádek pilulek, dole počet a Zrušit filtry
let aktualniFiltry = { filtry: [], zapnute: [], pocet: '' };
let panelFiltru = null;

function pripravitPanel() {
    if (panelFiltru) return;
    panelFiltru = document.createElement('div');
    panelFiltru.id = 'volbyPanel';
    panelFiltru.className = 'volby-panel hidden';
    panelFiltru.setAttribute('role', 'dialog');
    panelFiltru.setAttribute('aria-label', 'Filtry');
    document.body.append(panelFiltru);

    panelFiltru.addEventListener('click', (e) => {
        const volba = e.target.closest('[data-filtr]');
        if (volba) {
            const [i, j] = volba.dataset.filtr.split(':').map(Number);
            const v = aktualniFiltry.filtry[i]?.volby[j];
            if (v && !v.zvolena) v.akce();
        } else if (e.target.closest('[data-zrusit-filtry]')) {
            zrusitFiltry();
        }
    });
    // Klik mimo panel a tlačítko Filtry panel zavře; Esc také (a dál nejde, nezavře profil ani číslo)
    document.addEventListener('mousedown', (e) => {
        if (panelOtevren && !panelFiltru.contains(e.target) && !tlacitkoFiltru?.contains(e.target)) zavritPanel();
    }, true);
    // Tab zůstává v panelu (dokola), jako v okně
    panelFiltru.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const tlacitka = [...panelFiltru.querySelectorAll('button:not(:disabled)')];
        const kde = tlacitka.indexOf(document.activeElement);
        if (e.shiftKey ? kde <= 0 : kde === tlacitka.length - 1) {
            e.preventDefault();
            tlacitka[e.shiftKey ? tlacitka.length - 1 : 0]?.focus();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!panelOtevren || e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        zavritPanel();
        tlacitkoFiltru?.focus();
    }, true);
    window.addEventListener('resize', () => panelOtevren && umistitPanel());
}

function otevritPanel() {
    pripravitPanel();
    zavritKontextovouNabidku();
    panelOtevren = true;
    tlacitkoFiltru?.setAttribute('aria-expanded', 'true');
    vykreslitPanel();
    // Fokus do panelu na zvolenou volbu prvního filtru, aby šel ovládat klávesnicí
    panelFiltru.querySelector('button.active, button')?.focus({ preventScroll: true });
}

function zavritPanel() {
    panelOtevren = false;
    tlacitkoFiltru?.setAttribute('aria-expanded', 'false');
    panelFiltru?.classList.add('hidden');
}

function vykreslitPanel() {
    const { filtry, zapnute, pocet } = aktualniFiltry;
    // Po překreslení zůstane fokus na stejné volbě (výběr Enterem jinak fokus ztratí)
    const fokus = panelFiltru.contains(document.activeElement) ? document.activeElement.dataset.filtr || 'zrusit' : null;
    panelFiltru.innerHTML = filtry.map((s, i) => `
        <h6>${POPISKY[s.klic]}</h6>
        <div class="volby-panel-rada">${s.volby.map((v, j) => `
            <button type="button" class="${v.zvolena ? 'active' : ''}" data-filtr="${i}:${j}" aria-pressed="${v.zvolena}">${esc(v.text)}${v.pocet ? `<span>${esc(v.pocet)}</span>` : ''}</button>`).join('')}
        </div>`).join('') + `
        <div class="volby-panel-pata"><span>${esc(pocet || '')}</span>
            <button type="button" class="link" data-zrusit-filtry ${zapnute.length ? '' : 'disabled'}>Zrušit filtry</button></div>`;
    panelFiltru.classList.remove('hidden');
    umistitPanel();
    if (fokus) (panelFiltru.querySelector(`[data-filtr="${fokus}"]`) || panelFiltru.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
}

// Panel uprostřed pod lištou voleb (stejně jako hledání nad ní), celý v okně
function umistitPanel() {
    const lista = misto().querySelector('.volby-skupina');
    if (!lista) return;
    const r = lista.getBoundingClientRect();
    const sirka = panelFiltru.offsetWidth;
    const levo = Math.min(Math.max(8, r.left + r.width / 2 - sirka / 2), window.innerWidth - sirka - 8);
    panelFiltru.style.left = `${levo}px`;
    panelFiltru.style.top = `${r.bottom + 10}px`;
}

function nastavitPocet(pocet = '') {
    document.querySelectorAll('.navbar [data-rezim]').forEach(b => {
        b.dataset.titulek ??= b.title;
        b.title = b.classList.contains('active') && pocet ? `${b.dataset.titulek} · ${pocet}` : b.dataset.titulek;
    });
    prizpusobitListu();
}

// Záložky v horním řádku a pilulky pod-částí v kontextové liště mají ikonu a název; když je v řádku těsno,
// nezvolené ukážou jen ikonu (název je v bublině) a zvolená má název vždy.
const ODSTUP_V_LISTE = 16;
const prekryvaji = (a, b) => a.width && b.width && a.right + ODSTUP_V_LISTE > b.left && b.right + ODSTUP_V_LISTE > a.left
    && a.bottom > b.top && b.bottom > a.top;
// Úprava se odloží na další snímek: při jedné navigaci ji žádá víc míst (záložka, volby, počet) a každé měření
// vynutí přepočet rozvržení
let cekaUprava = false;
export function prizpusobitListu() {
    if (cekaUprava) return;
    cekaUprava = true;
    requestAnimationFrame(() => {
        cekaUprava = false;
        upravitListu();
    });
}

function upravitListu() {
    const titulek = document.querySelector('.titulek-okna');
    const vlevo = document.getElementById('viewToggle');
    // Soused záložek vpravo: kapsle voleb, když je vidět, jinak tlačítka okna
    const volby = misto();
    const vpravo = volby && !volby.classList.contains('hidden') ? volby : titulek?.querySelector('.window-controls');
    if (titulek && vlevo && vpravo) {
        titulek.classList.remove('bez-nazvu-vlevo');
        const l = vlevo.getBoundingClientRect();
        const p = vpravo.getBoundingClientRect();
        if (p.top >= l.bottom - 2 || prekryvaji(l, p)) titulek.classList.add('bez-nazvu-vlevo');
    }
    const lista = document.querySelector('.hlavni-lista');
    const pas = document.getElementById('pasStranky');
    const akce = lista?.querySelector('.nav-akce');
    if (!lista || !pas || !akce) return;
    lista.classList.remove('bez-nazvu-pasu');
    if (pas.classList.contains('hidden')) return;
    const rPas = pas.getBoundingClientRect();
    const rAkce = akce.getBoundingClientRect();
    if (rAkce.top > rPas.top + 8 || prekryvaji(rPas, rAkce)) {
        lista.classList.add('bez-nazvu-pasu');
    }
}

// Stav stránky bez voleb (profil: 56 fotek · 14 alb) vlevo ve stavové liště; volby ji při přepnutí pohledu vyprázdní
export function nastavitStav(text) {
    stavVlevo.replaceChildren();
    if (!text) return;
    const pocitadlo = document.createElement('span');
    pocitadlo.className = 'stav-pocet';
    pocitadlo.textContent = text;
    stavVlevo.append(pocitadlo);
}

// Zrušení všech zapnutých filtrů (Zrušit filtry ve stavové liště a v panelu Filtry): postupně jeden po druhém
function zrusitFiltry() {
    if (!aktualniFiltry?.zapnute.length) return;
    if (aktualniLista && !aktualniLista.dispatchEvent(new CustomEvent('zrusit-filtry', { bubbles: true, cancelable: true }))) return;
    zacitRuseni(aktualniLista);
    aktualniFiltry.zapnute[0].zrusit();
}

// Tlačítko „Zrušit hledání a filtry“ v prázdném stavu: smaže text hledání a zruší zapnuté filtry
export function zrusitHledaniAFiltry() {
    const hledani = /** @type {HTMLInputElement | null} */ (document.getElementById('searchInput'));
    const meloHledani = Boolean(hledani?.value);
    if (hledani && meloHledani) hledani.value = '';
    // Filtr Modelek z panelu Filtry se zruší i s hledáním jedním načtením
    const filtrModelek = zrusitFiltrModelek();
    if (aktualniLista && !aktualniLista.dispatchEvent(new CustomEvent('zrusit-filtry', { bubbles: true, cancelable: true }))) return;
    if (hledani && meloHledani && !filtrModelek) hledani.dispatchEvent(new Event('input'));
    if (!aktualniFiltry.zapnute.length) return;
    zacitRuseni(aktualniLista);
    aktualniFiltry.zapnute[0].zrusit();
}
