// Přehled sbírky: úvod, Údržba, Oblíbenost, Sháním CZ a Statistiky; nabídka částí u tlačítka Přehled
import { GetKalendar, GetPrehled, GetPrehledOblibenosti, GetStatistiky, GetStavyVydani, SetStavVydani } from './backend';
import { htmlVolebOblibenosti, nacistOblibenost } from './oblibenost';
import { nazevVydani } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { stats } from './prvky';
import { ukazatPohled } from './navigace';
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

// Přehled sbírky: úvod (hlavní čísla, mapy edic, co zbývá doplnit), Údržba (udrzba.js), Sháním CZ a Statistiky.
// Načtení se při opakování zapisuje na místo: části se přepíšou jen při změně, Údržba po skupinách,
// takže se stránka neposune a fokus zůstane.

// Části Přehledu. Oblíbenost má vlastní tlačítko (graf) a pod hledáním své části (Porovnávání, Pořadí, Mohlo by se
// ti líbit, oblibenost.js); ostatní části otevírá tlačítko Přehled sbírky a přepínají se volbou pod hledáním.
// U Údržby a Sháním CZ počet z posledního načtení.
const CASTI_VSE = [['uvod', 'Přehled'], ['udrzba', 'Údržba'], ['oblibenost', 'Oblíbenost'], ['shanim', 'Sháním CZ'], ['statistiky', 'Statistiky']];
const CASTI_SPRAVY = CASTI_VSE.filter(([klic]) => klic !== 'oblibenost');
const casti = () => CASTI_VSE;
const pocetVCasti = { udrzba: 0, shanim: 0 };
// Řádek částí Přehledu: lišta pod hledáním z něj udělá volbu s ikonou, jako Obálky / Kalendář u Čísel
const htmlCasti = () => stav.prehledSekce === 'oblibenost' ? htmlVolebOblibenosti() : `<div class="prehled-casti volby-v-liste">${CASTI_SPRAVY.map(([klic, nazev]) =>
    `<button class="chip ${klic === stav.prehledSekce ? 'active' : ''}" data-zobrazeni-prehledu="${klic}">${nazev}${pocetVCasti[klic] ? `<span>${pocetVCasti[klic]}</span>` : ''}</button>`).join('')}</div>`;

const KOSTRA = `
        <div class="prehled-casti-misto"></div>
        <div class="prehled-obsah">
            <section class="stat-section" data-sekce="uvod"></section>
            <section class="stat-section" data-sekce="shanim"></section>
            <section class="stat-section" data-sekce="udrzba"></section>
            <section class="stat-section" data-sekce="oblibenost"></section>
            <!-- Statistiky se počítají až při prvním zobrazení oddílu -->
            <section class="stat-section stat-statistiky" data-sekce="statistiky"><p class="stat-prazdne">Počítám statistiky…</p></section>
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
    if (!casti().some(([klic]) => klic === stav.prehledSekce)) stav.prehledSekce = 'uvod';

    let obsah = /** @type {HTMLElement} */ (stats.querySelector('.prehled-obsah'));
    if (!obsah) {
        stats.innerHTML = KOSTRA;
        obsah = stats.querySelector('.prehled-obsah');
    }
    obsah.dataset.sekceUkazana = stav.prehledSekce;
    obnovitCasti();
    const uvod = obsah.querySelector('[data-sekce="uvod"]');
    nastavitHtml(uvod, htmlUvodu({ p, kalendar, stavy, modelky: seznamModelek, souhrn: htmlSouhrnu(model), kUdrzbe: model.pocty.vse, modelekUplnych: p.modelek - model.modelekSChybou, oblibenost }));
    nastavitHtml(obsah.querySelector('[data-sekce="shanim"]'), htmlShanim(stavy, seznamModelek));
    udrzba.vykreslit();
    const sekceStatistik = obsah.querySelector('[data-sekce="statistiky"]');
    if (stav.prehledSekce === 'statistiky') nacistStatistiky(sekceStatistik);
    else sekceStatistik.innerHTML = '<p class="stat-prazdne">Počítám statistiky…</p>';
    if (stav.prehledSekce === 'oblibenost') nacistOblibenost(obsah.querySelector('[data-sekce="oblibenost"]'));
    // Graf desetiletí na úvodu se dopočítá zvlášť (statistiky se počítají z celé sbírky); jen když se úvod přepsal
    const grafDekad = uvod.querySelector('[data-graf-dekad]');
    if (grafDekad?.querySelector('.stat-prazdne')) {
        GetStatistiky().then(s => { if (grafDekad.isConnected) grafDekad.querySelector('.stat-prazdne')?.replaceWith(...htmlNaPrvky(htmlGrafuDekad(s))); });
    }
}

const htmlNaPrvky = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html;
    return [...t.content.childNodes];
};

// Volba části v liště pod hledáním (zvolená část a počty)
function obnovitCasti() {
    const misto = stats.querySelector('.prehled-casti-misto');
    if (!misto) return;
    nastavitHtml(misto, htmlCasti());
    if (stav.rezim === 'prehled') {
        obnovitVolby(stats);
        zvyraznitTlacitka();
    }
}

// V liště svítí tlačítko otevřené části: Oblíbenost, nebo Přehled sbírky
function zvyraznitTlacitka() {
    const cast = stav.prehledSekce === 'oblibenost' ? 'oblibenost' : 'sprava';
    document.querySelectorAll('.nav-rezim[data-cast-prehledu]').forEach(b => b.classList.toggle('active', b.dataset.castPrehledu === cast));
}

// Tlačítko v liště: Oblíbenost, nebo Přehled sbírky na naposledy zvolené části (úvod, Údržba, Sháním CZ, Statistiky)
export function zvolitCastPrehledu(cast) {
    let klic = 'oblibenost';
    if (cast !== 'oblibenost') {
        try { klic = localStorage.getItem('prehledSekceSpravy') || 'uvod'; } catch { klic = 'uvod'; }
        if (!CASTI_SPRAVY.some(([k]) => k === klic)) klic = 'uvod';
    }
    if (stav.rezim === 'prehled' && stats.querySelector('.prehled-obsah')) return ukazatCast(klic);
    stav.prehledSekce = klic;
    try { localStorage.setItem('prehledSekce', klic); } catch { /* jen se nezapamatuje */ }
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
    // Oblíbenost změnila svou část nebo okruh: obnoví se volby v liště
    document.addEventListener('volby-prehledu', obnovitCasti);
    // Části Přehledu (Přehled, Údržba, Sháním CZ, Statistiky) se přepínají volbou v liště pod hledáním
    document.addEventListener('click', (e) => {
        const volba = /** @type {HTMLElement} */ (e.target).closest?.('[data-zobrazeni-prehledu]');
        if (volba && volba.dataset.zobrazeniPrehledu !== stav.prehledSekce) ukazatCast(volba.dataset.zobrazeniPrehledu);
    });
    try { stav.prehledSekce = localStorage.getItem('prehledSekce') || 'uvod'; } catch { /* úvod */ }
    // Dřívější záložky údržby (Souhrn, Modelky, Čísla, Ke kontrole) jsou teď jedna Údržba
    if (['souhrn', 'modelky', 'vydani', 'kontrola'].includes(stav.prehledSekce)) stav.prehledSekce = 'udrzba';
    // Řádek souhrnu na úvodu otevře Údržbu na daném údaji, odkaz „Údržba →“ v posledním režimu (bez nového načtení)
    stats.addEventListener('click', (e) => {
        // Odkaz do Oblíbenosti funguje jako tlačítko grafu v liště
        if (e.target.closest('[data-otevrit-oblibenost]')) {
            /** @type {HTMLElement|null} */ (document.querySelector('.nav-rezim[data-cast-prehledu="oblibenost"]'))?.click();
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
        const modelka = e.target.closest('[data-otevrit-modelku]');
        const shanene = e.target.closest('[data-shanim]');
        if (cislo) {
            if (cislo.hasAttribute('data-ma-data')) otevritVydani(cislo.dataset.cislo);
            else nabidkaCislaPrehledu(cislo.dataset.cislo, e.clientX, e.clientY);
        } else if (modelka) {
            const m = stav.prehledModelky.get(parseInt(modelka.dataset.otevritModelku));
            if (m) otevritDetailModelky(m);
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
