// Přehled: stránka Sbírka (úvod, Údržba, Sháním CZ, Statistiky, Porovnat, Hodnotit fotky, Pořadí)
import { GetKalendar, GetPrehled, GetStavyVydani, SetStavVydani } from './backend';
import { nacistOblibenost, nastavitCastOblibenosti, nastavitNejlepsiVOblibenosti, obnovitHlavuHodnoceni, ukazatStrankuOblibenosti } from './oblibenost';
import { nacistNejlepsi } from './nejlepsi';
import { nacistGalerii } from './galerie';
import { zrusitHledani } from './naseptavac';
import { esc, nazevVydani } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { best, calendar, covers, gallery, searchInput, stats, wall } from './prvky';
import { prepnoutRezim, ukazatPohled, zvyraznitRezim } from './navigace';
import { otevritDetailModelky } from './profil';
import { nabidkaCisla } from './kalendar';
import { nacistStatistiky } from './statistiky';
import { htmlShanim, htmlUvodu, shanenaCisla, textShanim } from './prehled-uvod';
import { otevritVydani } from './vydani';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { oznamit } from '../ui/oznameni';
import { nastavitHtml, otevreneOkno } from '../ui/dom';
import { obnovitVolby } from '../ui/volby';
import { nacistNavrhy } from './navrhy';
import { nacistUceni } from './uceni';
import * as udrzba from './udrzba';
import { pohledSlavy } from './sin-slavy';
import { htmlPilulek, pripravitPasy } from '../ui/pas';

// Přehled sbírky: úvod (hlavní čísla, mapy edic, co zbývá doplnit), Údržba (udrzba.js), Sháním CZ, Statistiky
// a hodnocení (Porovnat, Hodnotit fotky, Pořadí).
// Načtení se při opakování zapisuje na místo: části se přepíšou jen při změně, Údržba po skupinách,
// takže se stránka neposune a fokus zůstane.

const CASTI_VSE = [['uvod', 'Mapa čísel'], ['udrzba', 'Údržba'], ['oblibenost', 'Oblíbenost'], ['shanim', 'Sháním CZ'], ['statistiky', 'Statistiky']];
const casti = () => CASTI_VSE;
const pocetVCasti = { udrzba: 0, shanim: 0 };

// Části Modelek v navigační kapsli (#pasStranky): Profily, Galerie
export function htmlPasuModelek(pohled) {
    const pilulky = [
        { klic: 'profily', nazev: 'Profily', titulek: 'Všechny modelky v databázi, profily a alba', zvolena: pohled === gallery },
        { klic: 'galerie', nazev: 'Galerie', titulek: 'Nejlépe hodnocené modelky, čísla, centerfoldy a fotky', zvolena: pohled === best },
    ];
    return `<nav class="slava-pohledy" role="tablist" aria-label="Části modelek">${htmlPilulek(pilulky, 'cast-modelek-pas')}</nav>`;
}

// Hodnocení má části v liště své hlavičky (oblibenost.js), Síň slávy je vlastní sekce: v kapsli nic
export function htmlPasuHodnoceni() {
    return '';
}

// Pilulky podčástí pro Čísla v kontextové liště (#pasStranky): Obálky, Kalendář, Centerfoldy
export function htmlPasuCisel(pohled) {
    const pilulky = [
        { klic: 'covery', nazev: 'Obálky', titulek: 'Obálky čísel časopisu po ročnících', zvolena: pohled === covers },
        { klic: 'kalendar', nazev: 'Kalendář', titulek: 'Kalendář vydání časopisu a speciálů', zvolena: pohled === calendar },
        { klic: 'centerfoldy', nazev: 'Centerfoldy', titulek: 'Stěna rozkládacích plakátů (centerfoldů)', zvolena: pohled === wall },
    ];
    return `<nav class="slava-pohledy" role="tablist" aria-label="Části čísel">${htmlPilulek(pilulky, 'cast-cisel-pas')}</nav>`;
}

// Části Sbírky v navigační kapsli (#pasStranky): Úvod, Údržba, Sháním CZ, Statistiky
export function htmlPasuSbirky() {
    // Sbírka je jedna stránka: části (Údržba, Mapa čísel, Sháním CZ, Statistiky) jsou v její hlavičce (udrzba.js)
    return '';
}
// Obnoví části otevřené sekce (#pasStranky) a přesune je v navigační kapsli hned za zvolenou sekci (Modelky, Čísla,
// Hodnocení, Sbírka); na profilu a stránce čísla jsou skryté
export function obnovitPasHlavicky(pohled) {
    const misto = document.getElementById('pasStranky');
    if (!misto) return;
    const fokusVPasu = misto.contains(document.activeElement);
    let html = '';
    if (pohled === gallery || pohled === best) {
        html = htmlPasuModelek(pohled);
    } else if (pohled === covers || pohled === calendar || pohled === wall) {
        html = htmlPasuCisel(pohled);
    } else if (pohled === stats) {
        html = stav.prehledSekce === 'oblibenost' ? htmlPasuHodnoceni() : htmlPasuSbirky();
    }
    nastavitHtml(misto, html);
    misto.classList.toggle('hidden', !html);
    const kapsle = document.getElementById('viewToggle');
    const selektor = pohled === gallery || pohled === best ? '[data-rezim="modelky"]'
        : pohled === covers || pohled === calendar || pohled === wall ? '[data-rezim="covery"]'
            : `[data-sekce="${stav.prehledSekce !== 'oblibenost' ? 'sbirka' : stav.oblibenostCast === 'slava' ? 'slava' : 'hodnoceni'}"]`;
    const zvolena = kapsle?.querySelector(selektor);
    if (zvolena && html && misto.previousElementSibling !== zvolena) zvolena.after(misto);
    kapsle?.classList.toggle('rozbalena', Boolean(html));
    if (fokusVPasu && !misto.contains(document.activeElement)) /** @type {HTMLElement | null} */ (misto.querySelector('[role="tab"][aria-selected="true"]'))?.focus({ preventScroll: true });
}

// Která volba v liště pod záložkami patří ukázané části: skrytý řádek štítků s data-volby-casti (ui/volby.js)
function klicVoleb() {
    // Otevřený panel Sbírky má volby v kapsli nahoře (graf Statistik, Kopírovat seznam u Sháním CZ)
    if (stav.prehledSekce !== 'oblibenost' && stav.sbirkaPanel === 'statistiky') return 'statistiky';
    if (stav.prehledSekce !== 'oblibenost' && stav.sbirkaPanel === 'cisla') return 'shanim';
    if (stav.prehledSekce !== 'oblibenost') return stav.prehledSekce;
    // Prohlížeč fronty nehodnocených fotek má vlastní stavovou lištu (postup, Vrátit; galerie-hodnoceni.js)
    if (stav.oblibenostCast === 'hodnoceni' && stav.hodnoceniPohled === 'fotky' && stav.lbJenNehodnocene) return 'hodnoceni-fotky-lb';
    if (stav.oblibenostCast === 'hodnoceni' && stav.hodnoceniPohled === 'fotky' && stav.lbPruvodce) return 'hodnoceni-fotky-pruvodce';
    return stav.oblibenostCast === 'slava' ? `slava-${pohledSlavy()}` : `hodnoceni-${stav.hodnoceniPohled}`;
}

// Sbírka: Údržba je obsah stránky, Mapa čísel se Sháním CZ, Statistiky a Učení jsou ve výsuvném panelu vpravo
// (jako Údaje u profilu modelky); panel ukazuje to, co říká data-panel na .prehled-obsah
const PANELY_SBIRKY = [['cisla', 'Čísla a sháním'], ['statistiky', 'Statistiky'], ['uceni', 'Učení']];
// Dřívější části Sbírky (pilulky, mapa sekcí, odkazy) → panel
const PANEL_CASTI = { uvod: 'cisla', shanim: 'cisla', statistiky: 'statistiky' };
const KOSTRA = `
        <div class="prehled-obsah">
            <section class="stat-section" data-sekce="udrzba"></section>
            <section class="stat-section" data-sekce="oblibenost"></section>
            <aside class="sbirka-panel" aria-label="Panel Sbírky">
                <div class="sbp-hlava">
                    <nav class="sbp-zalozky" role="tablist" aria-label="Panel Sbírky">${PANELY_SBIRKY.map(([klic, nazev]) => `<button type="button" role="tab" data-sbirka-panel="${klic}">${nazev}</button>`).join('')}</nav>
                    <button type="button" class="sbp-zavrit" data-sbirka-panel-zavrit title="Zavřít panel (Esc)" aria-label="Zavřít panel">&times;</button>
                </div>
                <div class="sbp-telo">
                    <section class="stat-section" data-sekce="shanim"></section>
                    <section class="stat-section" data-sekce="uvod"></section>
                    <!-- Statistiky se počítají až při prvním zobrazení panelu -->
                    <section class="stat-section stat-statistiky" data-sekce="statistiky"><p class="prazdno-male">Počítám statistiky…</p></section>
                    <div class="sbp-uceni" data-sbirka-uceni></div>
                </div>
            </aside>
        </div>`;

// Otevře, přepne nebo zavře panel Sbírky (klic '' = zavřít; stejný klíč znovu = zavřít); pamatuje se
export function nastavitPanelSbirky(klic) {
    stav.sbirkaPanel = klic === stav.sbirkaPanel ? '' : klic;
    try {
        localStorage.setItem('sbirkaPanel', stav.sbirkaPanel);
        if (stav.sbirkaPanel) localStorage.setItem('sbirkaPanelPosledni', stav.sbirkaPanel);
    } catch { /* jen se nezapamatuje */ }
    zobrazitPanelSbirky();
    obnovitCasti();
}
function zobrazitPanelSbirky() {
    const obsah = /** @type {HTMLElement | null} */ (stats.querySelector('.prehled-obsah'));
    if (!obsah) return;
    obsah.dataset.panel = stav.prehledSekce === 'oblibenost' ? '' : stav.sbirkaPanel;
    obsah.querySelectorAll('[data-sbirka-panel]').forEach(b => b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.sbirkaPanel === stav.sbirkaPanel)));
    if (stav.sbirkaPanel === 'statistiky') nacistStatistiky(obsah.querySelector('[data-sekce="statistiky"]'));
}

export async function nacistPrehled() {
    const moje = ++stav.cisloNacteni;
    const [p, seznamModelek, kalendar, stavy] = await Promise.all([GetPrehled(stav.prehledSkryte), vsechnyModelky(),
        GetKalendar().then(k => k || []), GetStavyVydani().then(s => s || []),
        nacistNavrhy(), nacistUceni()]);
    if (moje !== stav.cisloNacteni) return;
    stav.prehledModelky = new Map(seznamModelek.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const model = udrzba.nastavitData({ p, stavy });
    // Počty k nabídce částí u tlačítka Přehled
    pocetVCasti.udrzba = model.pocty.vse;
    pocetVCasti.shanim = shanenaCisla(stavy).length;
    if (!casti().some(([klic]) => klic === stav.prehledSekce)) stav.prehledSekce = 'udrzba';

    let obsah = /** @type {HTMLElement} */ (stats.querySelector('.prehled-obsah'));
    if (!obsah) {
        stats.innerHTML = KOSTRA;
        obsah = stats.querySelector('.prehled-obsah');
    }
    obsah.dataset.sekceUkazana = stav.prehledSekce;
    const uvod = obsah.querySelector('[data-sekce="uvod"]');
    // Úplnost a čísla sbírky jsou v hlavičce Sbírky (udrzba.js); Mapa čísel nemá volby ani text ve stavové liště
    nastavitHtml(uvod, '<div class="volby-v-liste" data-volby-casti="uvod"></div>' + htmlUvodu({ kalendar, stavy, modelky: seznamModelek }));
    nastavitHtml(obsah.querySelector('[data-sekce="shanim"]'), htmlShanim(stavy, seznamModelek));
    udrzba.vykreslit();
    const sekceStatistik = obsah.querySelector('[data-sekce="statistiky"]');
    if (stav.sbirkaPanel !== 'statistiky') {
        // Statistiky se při příštím otevření panelu spočítají znovu (bez smazané značky by nacistStatistiky skončilo hned)
        sekceStatistik.innerHTML = '<p class="prazdno-male">Počítám statistiky…</p>';
        delete sekceStatistik.dataset.nacteno;
    }
    zobrazitPanelSbirky();
    obnovitCasti();
    if (stav.prehledSekce === 'oblibenost') nacistOblibenost(obsah.querySelector('[data-sekce="oblibenost"]'));
}

// Seznam modelek kolem odkazu na profil (pořadí, Top 10, karta úvodu): šipky ‹ › v profilu jím pak listují
const SEZNAM_PROFILU = 'ol, ul, .ob-karta, .uvod-karta, .slava-obsah';
function seznamOkolo(odkaz) {
    const kontejner = odkaz.closest(SEZNAM_PROFILU);
    if (!kontejner) return null;
    return [...new Set([...kontejner.querySelectorAll('[data-otevrit-modelku]')].map(p => Number(/** @type {HTMLElement} */ (p).dataset.otevritModelku)))];
}


// Obnoví pilulky podčástí (#pasStranky), volby (#volbyPrehledu) a v horní liště tlačítko otevřené záložky
function obnovitCasti() {
    stats.dataset.volbyCasti = klicVoleb();
    // Část se může dovykreslit, až když je otevřený profil: lišta pak patří profilu
    if (stav.rezim === 'prehled' && !stats.classList.contains('hidden')) {
        obnovitPasHlavicky(stats);
        obnovitVolby(stats);
        udrzba.obnovitHlavuSbirky();
        obnovitHlavuHodnoceni();
        zvyraznitRezim();
        nastavitHledani();
    } else if (stav.rezim === 'nejlepsi' && !best.classList.contains('hidden')) {
        obnovitPasHlavicky(best);
    }
}

// V Souhrnu Údržby hlavní hledání filtruje frontu (ukáže její hledání), jinde na stránkách Přehledu najde modelku
let hledaniFronty = false;
function nastavitHledani() {
    const fronta = udrzba.hledaniVeFronte();
    searchInput.placeholder = fronta ? 'Hledat ve frontě Údržby…' : 'Najít modelku…';
    searchInput.title = fronta ? 'Údržba: jméno modelky nebo číslo; ↓ skočí do fronty, Esc hledání zruší. Do hledání skočíš klávesami Ctrl+F nebo /.'
        : 'Jméno modelky, číslo nebo článek; Enter otevře první výsledek. Do hledání skočíš klávesami Ctrl+F.';
    if (fronta && document.activeElement !== searchInput) searchInput.value = stav.udrzbaHledat;
    else if (!fronta && hledaniFronty) searchInput.value = '';
    hledaniFronty = fronta;
}

// Tlačítko v liště: Hodnocení a Síň slávy (Oblíbenost), nebo Sbírka na naposledy zvolené části (úvod, Údržba,
// Sháním CZ, Statistiky). Nastaví, co ukáže následující načtení Přehledu (jedno, s čerstvými daty). naMiste: Přehled
// je vidět; mezi Hodnocením a Síní slávy se přepne bez nového načtení a vrátí true (načítat už se nemá).
export function zvolitCastPrehledu(cast, naMiste = false) {
    let klic = 'oblibenost';
    if (cast !== 'oblibenost') {
        // Sbírka se otevírá v Údržbě (hlavní obsah); Mapa čísel, Sháním a Statistiky jsou z hlavičky Sbírky
        klic = 'udrzba';
    }
    if (naMiste) {
        zrusitHledani();
        searchInput.value = '';
        if (klic === 'oblibenost' && stav.prehledSekce === 'oblibenost' && ukazatStrankuOblibenosti(stav.oblibenostCast)) {
            obnovitCasti();
            return true;
        }
    }
    stav.prehledSekce = klic;
    try { localStorage.setItem('prehledSekce', klic); } catch { /* jen se nezapamatuje */ }
    return false;
}

// Zvolená část Přehledu se zapamatuje; když je Přehled otevřený, přepne se bez nového načtení
function ukazatCast(klic) {
    stav.prehledSekce = klic;
    try {
        localStorage.setItem('prehledSekce', klic);
        if (klic !== 'oblibenost') localStorage.setItem('prehledSekceSpravy', klic);
    } catch { /* jen se nezapamatuje */ }
    const obsah = stats.querySelector('.prehled-obsah');
    if (!obsah) return;
    obsah.dataset.sekceUkazana = klic;
    obnovitCasti();
    if (klic === 'statistiky') nacistStatistiky(stats.querySelector('[data-sekce="statistiky"]'));
    if (klic === 'oblibenost') nacistOblibenost(stats.querySelector('[data-sekce="oblibenost"]'));
    document.querySelector('main').scrollTop = 0;
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    udrzba.pripravit(nacistPrehled);
    pripravitPasy();
    // Oblíbenost změnila svou stránku (Hodnocení, Síň slávy): v liště se rozsvítí její tlačítko
    document.addEventListener('volby-prehledu', obnovitCasti);
    // Panel Sbírky: tlačítka v hlavičce Sbírky (udrzba.js), záložky a × v panelu, klávesa I, Esc
    document.addEventListener('panel-sbirky', e => nastavitPanelSbirky(/** @type {CustomEvent} */ (e).detail || ''));
    stats.addEventListener('click', (e) => {
        const zalozka = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-sbirka-panel]'));
        if (zalozka) {
            if (zalozka.dataset.sbirkaPanel !== stav.sbirkaPanel) nastavitPanelSbirky(zalozka.dataset.sbirkaPanel);
        }
        else if (/** @type {HTMLElement} */ (e.target).closest('[data-sbirka-panel-zavrit]')) nastavitPanelSbirky('');
    });
    document.addEventListener('keydown', (e) => {
        const veSbirce = stav.rezim === 'prehled' && stav.prehledSekce === 'udrzba' && !stats.classList.contains('hidden');
        if (!veSbirce || e.ctrlKey || e.altKey || e.metaKey || otevreneOkno() || /** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [contenteditable]')) return;
        if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
            e.preventDefault();
            let posledni = 'cisla';
            try { posledni = localStorage.getItem('sbirkaPanelPosledni') || 'cisla'; } catch { /* výchozí */ }
            nastavitPanelSbirky(stav.sbirkaPanel ? '' : posledni);
        } else if (e.key === 'Escape' && stav.sbirkaPanel && !document.querySelector('.context-menu:not(.hidden), .volby-panel:not(.hidden)')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            nastavitPanelSbirky('');
        }
    }, true);
    // Části Sbírky (Úvod, Údržba, Sháním CZ, Statistiky, Porovnat, Hodnotit fotky, Pořadí), Modelek (Profily, Galerie, Síň slávy)
    // a Čísel (Obálky, Kalendář, Centerfoldy) se přepínají pilulkami v kontextové liště (#pasStranky)
    document.addEventListener('click', (e) => {
        // Klik na pilulku Sbírky
        const volba = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-zobrazeni-prehledu]'));
        if (volba) {
            const klic = volba.dataset.zobrazeniPrehledu;
            if (['porovnat', 'fotky', 'poradi'].includes(klic)) {
                nastavitNejlepsiVOblibenosti(false);
                nastavitCastOblibenosti(klic);
                if (stav.rezim !== 'prehled' || stav.prehledSekce !== 'oblibenost' || stats.classList.contains('hidden')) {
                    stav.rezim = 'prehled';
                    stav.prehledSekce = 'oblibenost';
                    try {
                        localStorage.setItem('posledniRezim', 'prehled');
                        localStorage.setItem('prehledSekce', 'oblibenost');
                    } catch { /* výchozí */ }
                    zrusitHledani();
                    searchInput.value = '';
                    zvyraznitRezim();
                    nacistPrehled();
                } else {
                    ukazatStrankuOblibenosti(klic);
                }
            } else if (PANEL_CASTI[klic]) {
                // Mapa čísel, Sháním CZ a Statistiky jsou panel Sbírky: otevře se nad Údržbou
                const panel = PANEL_CASTI[klic];
                if (stav.rezim === 'prehled' && stav.prehledSekce === 'udrzba' && !stats.classList.contains('hidden')) {
                    if (stav.sbirkaPanel !== panel) nastavitPanelSbirky(panel);
                } else {
                    stav.sbirkaPanel = panel;
                    try { localStorage.setItem('sbirkaPanel', panel); } catch { /* jen se nezapamatuje */ }
                    volba.dataset.zobrazeniPrehledu = 'udrzba';
                    volba.click();
                    volba.dataset.zobrazeniPrehledu = klic;
                }
            } else if (klic) {
                nastavitNejlepsiVOblibenosti(false);
                if (stav.rezim !== 'prehled' || stats.classList.contains('hidden')) {
                    stav.rezim = 'prehled';
                    stav.prehledSekce = klic;
                    try {
                        localStorage.setItem('posledniRezim', 'prehled');
                        localStorage.setItem('prehledSekce', klic);
                        localStorage.setItem('prehledSekceSpravy', klic);
                    } catch { /* výchozí */ }
                    zrusitHledani();
                    searchInput.value = '';
                    zvyraznitRezim();
                    nacistPrehled();
                } else if (klic !== stav.prehledSekce) {
                    ukazatCast(klic);
                }
            }
            return;
        }

        // Klik na pilulku Modelek (Profily, Galerie, Síň slávy)
        const castMod = /** @type {HTMLElement} */ (e.target).closest?.('[data-cast-modelek-pas]');
        if (castMod) {
            const klic = castMod.dataset.castModelekPas;
            if (klic === 'profily') {
                if (stav.rezim === 'modelky' && !gallery.classList.contains('hidden')) {
                    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                prepnoutRezim('modelky');
                nacistGalerii(searchInput.value);
            } else if (klic === 'galerie') {
                if (stav.rezim === 'nejlepsi' && !best.classList.contains('hidden')) {
                    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                nastavitNejlepsiVOblibenosti(true);
                prepnoutRezim('nejlepsi');
                nacistNejlepsi();
            } else if (klic === 'slava') {
                if (stav.rezim === 'prehled' && stav.prehledSekce === 'oblibenost' && stav.oblibenostCast === 'slava' && !stats.classList.contains('hidden')) {
                    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
                nastavitNejlepsiVOblibenosti(false);
                nastavitCastOblibenosti('slava');
                stav.rezim = 'prehled';
                stav.prehledSekce = 'oblibenost';
                try {
                    localStorage.setItem('posledniRezim', 'prehled');
                    localStorage.setItem('prehledSekce', 'oblibenost');
                } catch { /* výchozí */ }
                zrusitHledani();
                searchInput.value = '';
                zvyraznitRezim();
                nacistPrehled();
            }
            return;
        }

        // Klik na pilulku Čísel (Obálky, Kalendář, Centerfoldy)
        const castCis = /** @type {HTMLElement} */ (e.target).closest?.('[data-cast-cisel-pas]');
        if (castCis) {
            const klic = castCis.dataset.castCiselPas;
            if (klic === stav.rezim && !document.querySelector('.hlavni-lista')?.classList.contains('podstranka')) {
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            prepnoutRezim(klic);
            nacistGalerii(searchInput.value);
            return;
        }
    });
    try { stav.prehledSekce = localStorage.getItem('prehledSekce') || 'udrzba'; } catch { /* Údržba */ }
    try { stav.sbirkaPanel = localStorage.getItem('sbirkaPanel') || ''; } catch { /* zavřený */ }
    // Dřívější části Sbírky jsou panel vpravo nad Údržbou
    if (PANEL_CASTI[stav.prehledSekce]) {
        stav.sbirkaPanel = PANEL_CASTI[stav.prehledSekce];
        stav.prehledSekce = 'udrzba';
    }
    // Dřívější záložky údržby (Souhrn, Modelky, Čísla, Ke kontrole) jsou teď jedna Údržba
    if (['souhrn', 'modelky', 'vydani', 'kontrola'].includes(stav.prehledSekce)) stav.prehledSekce = 'udrzba';
    // Řádek souhrnu na úvodu otevře Údržbu na daném údaji, odkaz „Údržba →“ v posledním režimu (bez nového načtení)
    stats.addEventListener('click', (e) => {
        // Odkaz do Oblíbenosti funguje jako tlačítko stránky v liště; s hodnotou otevře danou část (čekající → Porovnávání)
        const doOblibenosti = e.target.closest('[data-otevrit-oblibenost]');
        if (doOblibenosti) {
            if (doOblibenosti.dataset.otevritOblibenost) nastavitCastOblibenosti(doOblibenosti.dataset.otevritOblibenost);
            otevritOblibenost();
            return;
        }
        const cast = e.target.closest('[data-sekce-prehledu]');
        if (!cast) return;
        if (cast.dataset.udrzbaFiltr) udrzba.otevritNaFiltru(cast.dataset.udrzbaFiltr);
        ukazatCast(cast.dataset.sekcePrehledu);
    });

    // Mapa sbírky: číslo s daty se otevře, prázdné nabídne přidání; pravé tlačítko nabídne i stav čísla.
    // Naposledy přidaná modelka otevře profil, číslo v seznamu Sháním nabídne „mám výtisk“.
    const nabidkaCislaPrehledu = (klic, x, y) => nabidkaCisla(klic, x, y, { poZmene: nacistPrehled });
    stats.addEventListener('click', (e) => {
        const cislo = e.target.closest('[data-cislo]');
        // Srdíčka na kartě (Síň slávy) hodnotí, profil neotevírají
        // …ani „Vyzvat o trůn“ na kartě sezóny (souboj, sin-slavy.js)
        const modelka = e.target.closest('.hearts, [data-sezona-vyzvat]') ? null : e.target.closest('[data-otevrit-modelku]');
        const shanene = e.target.closest('[data-shanim]');
        if (cislo) {
            if (cislo.hasAttribute('data-ma-data')) otevritVydani(cislo.dataset.cislo);
            else nabidkaCislaPrehledu(cislo.dataset.cislo, e.clientX, e.clientY);
        } else if (modelka) {
            const m = stav.prehledModelky.get(parseInt(modelka.dataset.otevritModelku));
            if (m) otevritDetailModelky(m, { seznam: seznamOkolo(modelka) });
        } else if (shanene) {
            const klic = shanene.dataset.shanim;
            const r = shanene.getBoundingClientRect();
            otevritKontextovouNabidku(r.left, r.bottom + 4, [
                { text: 'Mám výtisk', akce: async () => { await SetStavVydani(klic, 'mam'); nacistPrehled(); } },
                { text: 'Už nesháním', akce: async () => { await SetStavVydani(klic, ''); nacistPrehled(); } },
                null,
                { text: `Otevřít ${nazevVydani(klic)}`, akce: () => otevritVydani(klic) },
            ]);
        } else if (e.target.closest('[data-kopirovat-shanim]')) {
            GetStavyVydani().then(stavy => navigator.clipboard.writeText(textShanim(stavy || [])))
                .then(() => oznamit('Seznam sháněných čísel je ve schránce.'), () => oznamit('Seznam se nepodařilo zkopírovat.'));
        }
    });
    stats.addEventListener('contextmenu', (e) => {
        const cislo = e.target.closest('[data-cislo]');
        if (!cislo) return;
        e.preventDefault();
        e.stopPropagation();
        // Klávesa nabídky nemá souřadnice myši: nabídka se ukáže u políčka
        const r = cislo.getBoundingClientRect();
        nabidkaCislaPrehledu(cislo.dataset.cislo, e.clientX || r.left + 8, e.clientY || r.bottom + 4);
    }, true);

    // Mapa edice je pro Tab jedno místo; šipky se v ní pohybují po měsících (←→) a rocích (↑↓), Home a End
    // skočí na první a poslední číslo, Enter číslo otevře, klávesa nabídky nabídne stav
    stats.addEventListener('keydown', (e) => {
        const policko = e.target.closest?.('.uvod-rok i');
        const posun = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 }[e.key];
        if (!policko || (posun === undefined && e.key !== 'Home' && e.key !== 'End')) return;
        const vsechna = [...policko.closest('.uvod-mapa').querySelectorAll('.uvod-rok i')];
        const cisla = vsechna.filter(i => i.hasAttribute('data-cislo'));
        const kde = vsechna.indexOf(policko);
        // Měsíce mimo řadu edice (bez čísla) se přeskakují; o rok nahoru nebo dolů na takový měsíc se nejde
        let cil = e.key === 'Home' ? cisla[0] : e.key === 'End' ? cisla.at(-1) : null;
        if (posun !== undefined) {
            let i = kde + posun;
            if (Math.abs(posun) === 1) while (vsechna[i] && !vsechna[i].hasAttribute('data-cislo')) i += posun;
            cil = vsechna[i]?.hasAttribute('data-cislo') ? vsechna[i] : null;
        }
        if (!cil) { e.preventDefault(); return; }
        e.preventDefault();
        policko.tabIndex = -1;
        cil.tabIndex = 0;
        cil.focus();
    });
}

// Otevře Oblíbenost na části zvolené dřív (nastavitCastOblibenosti)
export function otevritOblibenost() {
    stav.rezim = 'prehled';
    stav.prehledSekce = 'oblibenost';
    zvyraznitRezim();
    nacistPrehled();
}
