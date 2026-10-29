// Přehled: stránka Sbírka (úvod, Údržba, Sháním CZ, Statistiky, Porovnat, Hodnotit fotky, Pořadí)
import { GetKalendar, GetPrehled, GetPrehledOblibenosti, GetStatistiky, GetStavyVydani, SetStavVydani } from './backend';
import { htmlPasuOblibenosti, nacistOblibenost, nastavitCastOblibenosti, nastavitNejlepsiVOblibenosti, poctyOblibenosti, ukazatStrankuOblibenosti } from './oblibenost';
import { nacistNejlepsi } from './nejlepsi';
import { nacistGalerii } from './galerie';
import { zrusitHledani } from './naseptavac';
import { esc, nazevVydani, sklonovat } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { best, calendar, covers, gallery, searchInput, stats, wall } from './prvky';
import { prepnoutRezim, ukazatPohled, zvyraznitRezim } from './navigace';
import { otevritDetailModelky } from './profil';
import { nabidkaCisla } from './kalendar';
import { nacistStatistiky } from './statistiky';
import { htmlGrafuDekad, htmlShanim, htmlUvodu, shanenaCisla, textShanim } from './prehled-uvod';
import { otevritVydani } from './vydani';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { oznamit } from '../ui/oznameni';
import { nastavitHtml } from '../ui/dom';
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

const CASTI_VSE = [['uvod', 'Úvod'], ['udrzba', 'Údržba'], ['oblibenost', 'Oblíbenost'], ['shanim', 'Sháním CZ'], ['statistiky', 'Statistiky']];
const CASTI_SPRAVY = CASTI_VSE.filter(([klic]) => klic !== 'oblibenost');
const casti = () => CASTI_VSE;
const pocetVCasti = { udrzba: 0, shanim: 0 };
let stavSbirky = null; // { uplnost, ukolu } z posledního načtení

// Pilulky podčástí pro Modelky v kontextové liště (#pasStranky): Profily, Galerie, Síň slávy
export function htmlPasuModelek(pohled) {
    const jeSlava = pohled === stats && stav.prehledSekce === 'oblibenost' && stav.oblibenostCast === 'slava';
    const pilulky = [
        { klic: 'profily', nazev: 'Profily', titulek: 'Všechny modelky v databázi, profily a alba', zvolena: pohled === gallery },
        { klic: 'galerie', nazev: 'Galerie', titulek: 'Nejlépe hodnocené modelky, čísla, centerfoldy a fotky', zvolena: pohled === best },
        { klic: 'slava', nazev: 'Síň slávy', titulek: 'Nejlepší desítka, legendy, odznaky, rekordy a kronika', zvolena: jeSlava },
    ];
    return `<nav class="slava-pohledy" role="tablist" aria-label="Části modelek">${htmlPilulek(pilulky, 'cast-modelek-pas')}</nav>`;
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

// Pilulky podčástí pro Sbírku v kontextové liště (#pasStranky): Úvod, Údržba, Sháním CZ, Statistiky, Porovnat, Hodnotit fotky, Pořadí
export function htmlPasuSbirky() {
    const { pocty } = poctyOblibenosti();
    const vOblibenosti = stav.prehledSekce === 'oblibenost' && stav.oblibenostCast === 'hodnoceni';
    const pilulky = [
        { klic: 'uvod', nazev: 'Úvod', titulek: 'Přehled a stav sbírky', zvolena: stav.prehledSekce === 'uvod' },
        { klic: 'udrzba', nazev: 'Údržba', pocet: pocetVCasti.udrzba, titulek: 'Chybějící a neúplné údaje k doplnění', zvolena: stav.prehledSekce === 'udrzba' },
        { klic: 'shanim', nazev: 'Sháním CZ', pocet: pocetVCasti.shanim, titulek: 'Chybějící čísla CZ edice', zvolena: stav.prehledSekce === 'shanim' },
        { klic: 'statistiky', nazev: 'Statistiky', titulek: 'Statistiky a grafy sbírky', zvolena: stav.prehledSekce === 'statistiky' },
        { klic: 'porovnat', nazev: 'Porovnat', pocet: pocty.porovnat[0], titulek: pocty.porovnat[1], zvolena: vOblibenosti && stav.hodnoceniPohled === 'porovnat' },
        { klic: 'fotky', nazev: 'Hodnotit fotky', pocet: pocty.fotky[0], titulek: pocty.fotky[1], zvolena: vOblibenosti && stav.hodnoceniPohled === 'fotky' },
        { klic: 'poradi', nazev: 'Pořadí', pocet: pocty.poradi[0], titulek: pocty.poradi[1], zvolena: vOblibenosti && stav.hodnoceniPohled === 'poradi' },
    ];
    return `<nav class="slava-pohledy" role="tablist" aria-label="Části sbírky">${htmlPilulek(pilulky, 'zobrazeni-prehledu')}</nav>`;
}

// Obnoví pilulky podčástí (#pasStranky) v kontextové liště pro otevřenou hlavní sekci (Modelky, Čísla, Sbírka)
export function obnovitPasHlavicky(pohled) {
    const misto = document.getElementById('pasStranky');
    if (!misto) return;
    const fokusVPasu = misto.contains(document.activeElement);
    let html = '';
    if (pohled === gallery || pohled === best || (pohled === stats && stav.prehledSekce === 'oblibenost' && stav.oblibenostCast === 'slava')) {
        html = htmlPasuModelek(pohled);
    } else if (pohled === covers || pohled === calendar || pohled === wall) {
        html = htmlPasuCisel(pohled);
    } else if (pohled === stats) {
        html = htmlPasuSbirky();
    }
    nastavitHtml(misto, html);
    misto.classList.toggle('hidden', !html);
    if (fokusVPasu && !misto.contains(document.activeElement)) /** @type {HTMLElement | null} */ (misto.querySelector('[role="tab"][aria-selected="true"]'))?.focus({ preventScroll: true });
}

// Která volba v liště pod záložkami patří ukázané části: skrytý řádek štítků s data-volby-casti (ui/volby.js)
function klicVoleb() {
    if (stav.prehledSekce !== 'oblibenost') return stav.prehledSekce;
    return stav.oblibenostCast === 'slava' ? `slava-${pohledSlavy()}` : `hodnoceni-${stav.hodnoceniPohled}`;
}

const KOSTRA = `
        <div class="prehled-obsah">
            <section class="stat-section" data-sekce="uvod"></section>
            <section class="stat-section" data-sekce="shanim"></section>
            <section class="stat-section" data-sekce="udrzba"></section>
            <section class="stat-section" data-sekce="oblibenost"></section>
            <!-- Statistiky se počítají až při prvním zobrazení oddílu -->
            <section class="stat-section stat-statistiky" data-sekce="statistiky"><p class="prazdno-male">Počítám statistiky…</p></section>
        </div>`;

// Pokrok sbírky po položkách na úvodu (pruh, kolik z kolika); klik otevře Údržbu s filtrem na tu položku
function htmlSouhrnu(model) {
    const radek = (popis, chybi, celkem, filtr, akce = 'doplnit') => {
        const hotovo = Math.max(0, celkem - chybi);
        const procent = celkem ? Math.round(hotovo / celkem * 100) : 100;
        return `<button class="prehled-souhrn-radek ${chybi ? '' : 'hotovo'}" data-sekce-prehledu="udrzba" data-udrzba-filtr="${filtr}">
            <span>${popis}</span>
            ${celkem ? `<div class="prehled-souhrn-pruh"><i style="width:${procent}%"></i></div><small>${hotovo} z ${celkem}</small>` : '<div></div><small></small>'}
            <b>${chybi ? `${akce} ${chybi}` : 'hotovo'}</b></button>`;
    };
    const POPISY = { titulni: 'Modelky s titulní fotkou', centerfold: 'Modelky s centerfoldem', hodnoceni: 'Modelky s hodnocením', udaje: 'Vyplněné údaje modelek',
        text: 'Alba s textem', alba: 'Alba s vydáním', cover: 'Čísla s coverem', cfcisla: 'Čísla s centerfoldem' };
    return `<div class="prehled-souhrn">
        ${model.pokrok.map(o => radek(POPISY[o.klic] || o.nazev, o.chybi, o.celkem, o.filtr)).join('')}
        ${model.kKontrole ? radek('Údaje ke kontrole', model.kKontrole, 0, 'kontrola', 'zkontrolovat') : ''}
        ${model.navrhu ? radek('Návrhy doplnění ze sbírky', model.navrhu, 0, 'navrhy', 'projít') : ''}
    </div>`;
}

export async function nacistPrehled() {
    const moje = ++stav.cisloNacteni;
    const [p, seznamModelek, kalendar, stavy, oblibenost] = await Promise.all([GetPrehled(stav.prehledSkryte), vsechnyModelky(),
        GetKalendar().then(k => k || []), GetStavyVydani().then(s => s || []),
        GetPrehledOblibenosti().catch(() => null), nacistNavrhy(), nacistUceni()]);
    if (moje !== stav.cisloNacteni) return;
    stav.prehledModelky = new Map(seznamModelek.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const model = udrzba.nastavitData({ p, stavy });
    // Počty k nabídce částí u tlačítka Přehled
    pocetVCasti.udrzba = model.pocty.vse;
    pocetVCasti.shanim = shanenaCisla(stavy).length;
    stavSbirky = { uplnost: model.uplnost, ukolu: model.pocty.vse };
    if (!casti().some(([klic]) => klic === stav.prehledSekce)) stav.prehledSekce = 'uvod';

    let obsah = /** @type {HTMLElement} */ (stats.querySelector('.prehled-obsah'));
    if (!obsah) {
        stats.innerHTML = KOSTRA;
        obsah = stats.querySelector('.prehled-obsah');
    }
    obsah.dataset.sekceUkazana = stav.prehledSekce;
    const uvod = obsah.querySelector('[data-sekce="uvod"]');
    const volbyUvodu = `<div class="volby-v-liste" data-volby-casti="uvod">${stavSbirky ? `<span>${stavSbirky.uplnost} % sbírky doplněno${stavSbirky.ukolu ? ` · ${sklonovat(stavSbirky.ukolu, 'úkol', 'úkoly', 'úkolů')}` : ''}</span>` : ''}</div>`;
    nastavitHtml(uvod, volbyUvodu + htmlUvodu({ p, kalendar, stavy, modelky: seznamModelek, souhrn: htmlSouhrnu(model), kUdrzbe: model.pocty.vse, modelekUplnych: p.modelek - model.modelekSChybou, oblibenost }));
    nastavitHtml(obsah.querySelector('[data-sekce="shanim"]'), htmlShanim(stavy, seznamModelek));
    udrzba.vykreslit();
    obnovitCasti();
    const sekceStatistik = obsah.querySelector('[data-sekce="statistiky"]');
    if (stav.prehledSekce === 'statistiky') nacistStatistiky(sekceStatistik);
    else sekceStatistik.innerHTML = '<p class="prazdno-male">Počítám statistiky…</p>';
    if (stav.prehledSekce === 'oblibenost') nacistOblibenost(obsah.querySelector('[data-sekce="oblibenost"]'));
    // Graf desetiletí na úvodu se dopočítá zvlášť (statistiky se počítají z celé sbírky); jen když se úvod přepsal
    const grafDekad = uvod.querySelector('[data-graf-dekad]');
    if (grafDekad?.querySelector('.prazdno-male')) {
        GetStatistiky().then(s => { if (grafDekad.isConnected) grafDekad.querySelector('.prazdno-male')?.replaceWith(...htmlNaPrvky(htmlGrafuDekad(s))); });
    }
}

// Seznam modelek kolem odkazu na profil (pořadí, Top 10, karta úvodu): šipky ‹ › v profilu jím pak listují
const SEZNAM_PROFILU = 'ol, ul, .ob-karta, .uvod-karta, .slava-obsah';
function seznamOkolo(odkaz) {
    const kontejner = odkaz.closest(SEZNAM_PROFILU);
    if (!kontejner) return null;
    return [...new Set([...kontejner.querySelectorAll('[data-otevrit-modelku]')].map(p => Number(/** @type {HTMLElement} */ (p).dataset.otevritModelku)))];
}

const htmlNaPrvky = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html;
    return [...t.content.childNodes];
};

// Obnoví pilulky podčástí (#pasStranky), volby (#volbyPrehledu) a v horní liště tlačítko otevřené záložky
function obnovitCasti() {
    stats.dataset.volbyCasti = klicVoleb();
    // Část se může dovykreslit, až když je otevřený profil: lišta pak patří profilu
    if (stav.rezim === 'prehled' && !stats.classList.contains('hidden')) {
        obnovitPasHlavicky(stats);
        obnovitVolby(stats);
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
        try { klic = localStorage.getItem('prehledSekceSpravy') || 'uvod'; } catch { klic = 'uvod'; }
        if (!CASTI_SPRAVY.some(([k]) => k === klic)) klic = 'uvod';
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
    // Části Sbírky (Úvod, Údržba, Sháním CZ, Statistiky, Porovnat, Hodnotit fotky, Pořadí), Modelek (Profily, Galerie, Síň slávy)
    // a Čísel (Obálky, Kalendář, Centerfoldy) se přepínají pilulkami v kontextové liště (#pasStranky)
    document.addEventListener('click', (e) => {
        // Klik na pilulku Sbírky
        const volba = /** @type {HTMLElement} */ (e.target).closest?.('[data-zobrazeni-prehledu]');
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
    try { stav.prehledSekce = localStorage.getItem('prehledSekce') || 'uvod'; } catch { /* úvod */ }
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
        const modelka = e.target.closest('.hearts') ? null : e.target.closest('[data-otevrit-modelku]');
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
