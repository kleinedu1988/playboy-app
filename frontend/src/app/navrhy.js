// Návrhy doplnění v Údržbě: chybějící údaje, které program odhadne z vlastní sbírky (národnost z místa narození,
// velikost prsou z měr, vydání alba, fotograf…). Návrh jde přijmout (rovnou se uloží), upravit ve formuláři
// s předvyplněnou hodnotou, nebo odmítnout (už se nenabízí; se „zobrazit i odmítnuté“ jde vrátit).
import { GetNavrhyDoplneni, OdmitnoutNavrh, PrijmoutNavrh, UpdateModelka } from './backend';
import { esc, nazevAlba, nazevVydani, rozlozitVydani, sklonovat } from '../lib/format';
import { stav } from './stav';
import { stats } from './prvky';
import { vsechnyModelky } from './mezipamet';
import { BEZ_FOTKY, adresaTitulni } from './obrazky';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { otevritModelModal, poleModelky, potvrdit, predvyplnitPole, ukazatZalozku, zameritPole } from './formular-modelky';
import { otevritAlbumModal, predvyplnitVydaniAlba } from './formular-alba';
import { nacistPrehled, obnovitUdrzbu, zalozkaPole } from './prehled';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { oznamit } from '../ui/oznameni';

/** @typedef {import('./backend').NavrhDoplneni} NavrhDoplneni */

// Hranice jistoty: od 90 % „jisté“ (jde přijmout hromadně), od 70 % „pravděpodobné“, níž „odhad“
export const MEZ_JISTE = 0.9;
const MEZ_PRAVDEPODOBNE = 0.7;

/** @type {NavrhDoplneni[]} */
let navrhy = [];
// Backend návrhy neumí nebo selhal: Údržba funguje dál bez nich
let nedostupne = false;
// Návrhy, které se právě ukládají (dvojí Enter nesmí přijmout dvakrát)
const zpracovavane = new Set();

const idNavrhu = n => [n.modelkaId, n.album, n.typ, n.klic || n.pole].join('|');
const najit = id => navrhy.find(n => idNavrhu(n) === id);
const aktivni = () => navrhy.filter(n => !n.odmitnuto);
const jiste = () => aktivni().filter(n => n.jistota >= MEZ_JISTE);
export const pocetNavrhu = () => aktivni().length;
export const maNavrhy = () => navrhy.length > 0;
export const pocetJistych = () => jiste().length;

const procent = j => Math.round(Math.max(0, Math.min(1, j || 0)) * 100);
const slovoJistoty = j => j >= MEZ_JISTE ? 'jisté' : j >= MEZ_PRAVDEPODOBNE ? 'pravděpodobné' : 'odhad';
const tridaJistoty = j => j >= MEZ_JISTE ? 'jiste' : j >= MEZ_PRAVDEPODOBNE ? 'pravdepodobne' : 'odhad';
const VYSVETLENI = {
    jiste: 'u podobných modelek ve sbírce to platí skoro vždy',
    pravdepodobne: 'u podobných modelek to většinou platí, stojí za kontrolu',
    odhad: 'jen odhad podle podobných modelek, raději ověř',
};
const nazevPole = n => n.popis || n.pole;
// Vydání alba se ukazuje jako název čísla („Červenec 1976“), ostatní hodnoty tak, jak se uloží
const hodnotaNavrhu = n => n.pole === 'vydani' && rozlozitVydani(n.hodnota) ? nazevVydani(n.hodnota) : n.hodnota;
const textNavrhu = n => `${nazevPole(n)} „${hodnotaNavrhu(n)}“`;
const doplneno = n => n === 1 ? 'Doplněn 1 údaj' : n > 1 && n < 5 ? `Doplněny ${n} údaje` : `Doplněno ${n} údajů`;
// Souhrn polí do potvrzení: „národnost (6), etnicita (4)“
const souhrnPoli = seznam => [...seznam.reduce((m, n) => m.set(nazevPole(n), (m.get(nazevPole(n)) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]).map(([pole, pocet]) => `${pole} (${pocet})`).join(', ');

// Načte návrhy i s odmítnutými (počet odmítnutých je u přepínače, vrácení je bez nového načtení); volá nacistPrehled
export async function nacistNavrhy() {
    try {
        navrhy = (await GetNavrhyDoplneni(true)) || [];
        nedostupne = false;
    } catch {
        navrhy = [];
        nedostupne = true;
    }
}

// Pruh u Vše: kolik návrhů čeká, klik přepne na filtr Návrhy
export function htmlUpoutavky() {
    const pocet = pocetNavrhu();
    if (!pocet) return '';
    const jistych = pocetJistych();
    return `<button type="button" class="nv-upoutavka" data-udrzba-filtr="navrhy">
        <span class="nv-hvezda" aria-hidden="true">✦</span>
        <span><b>${sklonovat(pocet, 'návrh', 'návrhy', 'návrhů')} doplnění</b> odhadnut${pocet === 1 ? 'ý' : pocet < 5 ? 'é' : 'o'} z tvé sbírky${jistych ? ` · ${jistych} ${jistych === 1 ? 'jistý' : jistych < 5 ? 'jisté' : 'jistých'}` : ''}</span>
        <span class="nv-upoutavka-akce">Projít návrhy →</span></button>`;
}

// Filtr Návrhy: lišta s hromadným přijetím a návrhy po modelkách (a albech)
export function htmlNavrhu() {
    const ukazane = navrhy.filter(n => stav.navrhyOdmitnute || !n.odmitnuto);
    const odmitnutych = navrhy.length - pocetNavrhu();
    const jistych = pocetJistych();
    const lista = `<div class="ud-lista">Odhadnuto z tvé sbírky, nejjistější první${odmitnutych || stav.navrhyOdmitnute
        ? ` · <button class="link" data-navrhy-odmitnute>${stav.navrhyOdmitnute ? 'skrýt odmítnuté' : `zobrazit i odmítnuté (${odmitnutych})`}</button>` : ''}
        ${jistych ? `<button type="button" class="btn btn-primary btn-small ud-postupne" data-navrhy-jiste title="Přijme všechny návrhy s jistotou aspoň 90 % (před uložením se zeptá)">✓ Přijmout vše jisté (≥ 90 %) · ${jistych}</button>` : ''}</div>`;
    if (!ukazane.length) {
        return `${lista}<div class="nv-prazdne"><span class="nv-hvezda" aria-hidden="true">✦</span><p>${nedostupne ? 'Návrhy teď nejde načíst.'
            : navrhy.length ? 'Všechny návrhy jsou odmítnuté. Zobraz je přes „zobrazit i odmítnuté“ a vrať, co chceš znovu nabízet.'
                : 'Teď není co navrhnout. Program navrhuje chybějící údaje, které umí odvodit z ostatních modelek ve sbírce (třeba národnost z místa narození nebo velikost prsou z měr). Čím víc údajů je vyplněno, tím víc toho navrhne.'}</p></div>`;
    }
    // Modelky v pořadí jejich nejjistějšího návrhu (backend řadí podle jistoty)
    const skupiny = new Map();
    ukazane.forEach(n => skupiny.set(n.modelkaId, [...(skupiny.get(n.modelkaId) || []), n]));
    const vsechny = [...skupiny.values()];
    const ukazat = vsechny.slice(0, stav.prehledLimit);
    return `${lista}<div class="nv-seznam">${ukazat.map(htmlSkupiny).join('')}</div>${vsechny.length > stav.prehledLimit
        ? `<p class="stat-note">Zobrazeno ${stav.prehledLimit} z ${vsechny.length} modelek. <button class="link" data-vice>Zobrazit další</button></p>` : ''}`;
}

function htmlSkupiny(seznam) {
    const id = seznam[0].modelkaId;
    const modelka = stav.prehledModelky.get(id);
    const aktivnich = seznam.filter(n => !n.odmitnuto).length;
    // Údaje modelky první, pak alba v pořadí prvního návrhu
    const casti = new Map([['', []]]);
    seznam.forEach(n => {
        const klic = n.album ? `${n.typ}|${n.album}` : '';
        casti.set(klic, [...(casti.get(klic) || []), n]);
    });
    return `<section class="nv-skupina" data-navrhy-modelka="${id}">
        <header class="nv-hlava">
            <img src="${esc(modelka ? adresaTitulni(modelka) : BEZ_FOTKY)}" alt="" loading="lazy" draggable="false" />
            <button type="button" class="ud-jmeno nv-jmeno" data-otevrit-modelku="${id}" title="Otevřít profil"><strong>${esc(modelka?.jmeno || seznam[0].jmeno)}</strong>
                <small>${aktivnich ? sklonovat(aktivnich, 'návrh', 'návrhy', 'návrhů') : 'jen odmítnuté'}</small></button>
            ${aktivnich > 1 ? `<button type="button" class="nv-vse" data-navrhy-modelky>✓ Přijmout vše u modelky · ${aktivnich}</button>` : ''}
            <button type="button" class="ud-vice" data-navrhy-vice title="Další akce" aria-label="Další akce">⋯</button>
        </header>
        ${[...casti].filter(([, radky]) => radky.length).map(([klic, radky]) => (klic
            ? `<div class="nv-album"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>${esc(nazevAlba(radky[0].album, radky[0].typ))}<small>${esc(radky[0].typ)}</small></div>` : '')
            + radky.map(htmlRadku).join('')).join('')}
    </section>`;
}

function htmlRadku(n) {
    const p = procent(n.jistota);
    const trida = tridaJistoty(n.jistota);
    return `<div class="nv-radek ${n.odmitnuto ? 'odmitnuty' : ''}" tabindex="0" data-navrh="${esc(idNavrhu(n))}"
        aria-label="${esc(`${nazevPole(n)}: ${hodnotaNavrhu(n)}, ${n.odmitnuto ? 'odmítnuto' : `${p} %, ${slovoJistoty(n.jistota)}`}`)}">
        <span class="nv-pole">${esc(nazevPole(n))}</span>
        <strong class="nv-hodnota">${esc(hodnotaNavrhu(n))}</strong>
        <span class="nv-jistota ${trida}" title="Jistota ${p} %: ${VYSVETLENI[trida]}"><i><b style="width:${p}%"></b></i><span>${p} %</span> ${slovoJistoty(n.jistota)}</span>
        ${n.duvod ? `<small class="nv-duvod">${esc(n.duvod)}</small>` : ''}
        <div class="nv-akce">${n.odmitnuto
            ? '<span class="nv-stav">odmítnuto</span><button type="button" class="nv-tlacitko" data-navrh-vratit title="Znovu nabízet (Enter)">Vrátit</button>'
            : `<button type="button" class="nv-tlacitko nv-prijmout" data-navrh-prijmout title="Přijmout a uložit (Enter)">✓ Přijmout</button>
               <button type="button" class="nv-tlacitko" data-navrh-upravit title="Otevřít formulář s předvyplněnou hodnotou">Upravit…</button>
               <button type="button" class="nv-tlacitko nv-odmitnout" data-navrh-odmitnout title="Odmítnout – už nenabízet (Delete)" aria-label="Odmítnout">✕</button>`}
            <button type="button" class="ud-vice" data-navrh-vice title="Další akce" aria-label="Další akce">⋯</button>
        </div>
    </div>`;
}

// Po přijetí nebo odmítnutí se Údržba překreslí na místě: stránka se neposune a fokus zůstane na stejném místě
// seznamu (na řádku, který nastoupil místo vyřízeného). Celý Přehled se načte znovu až po chvíli klidu,
// aby počty ostatních úkolů odpovídaly a backend mohl návrhy přepočítat.
function prekreslit(id = '') {
    const oblast = document.querySelector('main');
    const posun = oblast.scrollTop;
    const radky = [...stats.querySelectorAll('.nv-radek')];
    const kde = radky.findIndex(r => r.dataset.navrh === id);
    const sFokusem = Boolean(document.activeElement?.closest?.('.nv-seznam'));
    obnovitUdrzbu();
    oblast.scrollTop = posun;
    if (sFokusem || kde >= 0) zaostritRadek(id, kde);
    naplanovatNacteni();
}

function zaostritRadek(id, kde) {
    const nove = [...stats.querySelectorAll('.nv-radek')];
    const cil = nove.find(r => r.dataset.navrh === id) || nove[Math.min(Math.max(kde, 0), nove.length - 1)];
    /** @type {HTMLElement} */ (cil || stats.querySelector('.ud-filtry .on'))?.focus({ preventScroll: true });
}

let casovacNacteni = null;
function naplanovatNacteni() {
    clearTimeout(casovacNacteni);
    casovacNacteni = setTimeout(async () => {
        if (stats.classList.contains('hidden') || document.querySelector('.modal-overlay:not(.hidden)')) return;
        const oblast = document.querySelector('main');
        const posun = oblast.scrollTop;
        const fokus = document.activeElement?.closest?.('.nv-radek')?.dataset.navrh;
        await nacistPrehled();
        oblast.scrollTop = posun;
        if (fokus) /** @type {HTMLElement} */ (stats.querySelector(`.nv-radek[data-navrh="${CSS.escape(fokus)}"]`))?.focus({ preventScroll: true });
    }, 1500);
}

// Přijme návrhy jeden po druhém; vrací ty, které se uložily
async function ulozit(seznam) {
    const prijate = [];
    for (const n of seznam) {
        if (zpracovavane.has(n)) continue;
        zpracovavane.add(n);
        try {
            if (await PrijmoutNavrh(n)) prijate.push(n);
        } catch { /* nepřijatý zůstane v seznamu */ } finally {
            zpracovavane.delete(n);
        }
    }
    navrhy = navrhy.filter(n => !prijate.includes(n));
    return prijate;
}

// Vlastnost modelky podle pole formuláře (vrácení přijatého návrhu)
const vlastnostPole = inputId => poleModelky.find(p => p[1] === inputId)?.[0];

async function prijmout(n) {
    // Původní hodnotu údaje modelky jde po přijetí vrátit; u alba se vrácení nenabízí
    const vlastnost = !n.album && vlastnostPole(n.inputId);
    const puvodni = vlastnost ? stav.prehledModelky.get(n.modelkaId)?.[vlastnost] : undefined;
    const id = idNavrhu(n);
    if (!(await ulozit([n])).length) {
        oznamit(`Návrh se nepodařilo uložit: ${textNavrhu(n)}.`);
        return;
    }
    prekreslit(id);
    oznamit(`Doplněno: ${textNavrhu(n)} – ${n.jmeno}.`, vlastnost && puvodni !== undefined ? { text: 'Vrátit', akce: () => vratitPrijeti(n, vlastnost, puvodni) } : null);
}

async function vratitPrijeti(n, vlastnost, puvodni) {
    const modelka = (await vsechnyModelky()).find(m => m.id === n.modelkaId);
    if (!modelka || !await UpdateModelka({ ...modelka, [vlastnost]: puvodni })) {
        oznamit('Údaj se nepodařilo vrátit.');
        return;
    }
    clearTimeout(casovacNacteni);
    if (!stats.classList.contains('hidden')) await nacistPrehled();
    oznamit(`Vráceno: ${nazevPole(n)} – ${n.jmeno} má zase původní hodnotu.`);
}

async function odmitnout(seznam, odmitnout = true) {
    const zmenene = [];
    for (const n of seznam) {
        try {
            if (await OdmitnoutNavrh(n, odmitnout)) {
                n.odmitnuto = odmitnout;
                zmenene.push(n);
            }
        } catch { /* zůstane, jak byl */ }
    }
    return zmenene;
}

async function odmitnoutJeden(n) {
    const id = idNavrhu(n);
    if (!(await odmitnout([n])).length) {
        oznamit('Návrh se nepodařilo odmítnout.');
        return;
    }
    prekreslit(id);
    oznamit(`Odmítnuto: ${textNavrhu(n)}. Už se nebude nabízet.`, { text: 'Vrátit', akce: () => vratitOdmitnuti([n]) });
}

async function vratitOdmitnuti(seznam) {
    const vracene = await odmitnout(seznam, false);
    if (!vracene.length) {
        oznamit('Návrh se nepodařilo vrátit.');
        return;
    }
    prekreslit(idNavrhu(vracene[0]));
    if (vracene.length > 1 || !stav.navrhyOdmitnute) oznamit(vracene.length > 1 ? `Vráceno ${sklonovat(vracene.length, 'návrh', 'návrhy', 'návrhů')}.` : `Návrh se zase nabízí: ${textNavrhu(vracene[0])}.`);
}

async function prijmoutJiste() {
    const seznam = jiste();
    if (!seznam.length) return;
    const modelek = new Set(seznam.map(n => n.modelkaId)).size;
    if (!await potvrdit('Přijmout jisté návrhy?',
        `Uloží se ${sklonovat(seznam.length, 'údaj', 'údaje', 'údajů')} u ${sklonovat(modelek, 'modelky', 'modelek', 'modelek')} s jistotou aspoň 90 %: ${souhrnPoli(seznam)}. `
        + 'Hromadné přijetí nejde vrátit jedním krokem; jednotlivé údaje jdou opravit ve formuláři.', `Přijmout ${seznam.length}`)) return;
    const prijate = await ulozit(seznam);
    prekreslit();
    oznamit(prijate.length === seznam.length ? `${doplneno(prijate.length)}.`
        : `Doplněno ${prijate.length} z ${seznam.length}; zbytek se nepodařilo uložit a zůstal v návrzích.`);
}

async function prijmoutUModelky(modelkaId) {
    const seznam = aktivni().filter(n => n.modelkaId === modelkaId);
    if (!seznam.length) return;
    if (seznam.length === 1) return prijmout(seznam[0]);
    const odhadu = seznam.filter(n => n.jistota < MEZ_JISTE).length;
    if (!await potvrdit(`Přijmout návrhy – ${seznam[0].jmeno}?`,
        `Uloží se: ${seznam.map(n => `${textNavrhu(n)}${n.jistota < MEZ_JISTE ? ` (${slovoJistoty(n.jistota)})` : ''}`).join(', ')}.`
        + (odhadu ? ` Z toho ${odhadu === 1 ? 'jeden není jistý' : odhadu < 5 ? `${odhadu} nejsou jisté` : `${odhadu} není jistých`}.` : ''),
        `Přijmout ${seznam.length}`)) return;
    const prijate = await ulozit(seznam);
    prekreslit();
    oznamit(prijate.length === seznam.length ? `Doplněno – ${seznam[0].jmeno}: ${prijate.map(nazevPole).join(', ')}.`
        : `Doplněno ${prijate.length} z ${seznam.length}; zbytek se nepodařilo uložit.`);
}

async function odmitnoutUModelky(modelkaId) {
    const zmenene = await odmitnout(aktivni().filter(n => n.modelkaId === modelkaId));
    if (!zmenene.length) return;
    prekreslit();
    oznamit(`Odmítnuto – ${zmenene[0].jmeno}: ${sklonovat(zmenene.length, 'návrh', 'návrhy', 'návrhů')}.`, { text: 'Vrátit', akce: () => vratitOdmitnuti(zmenene) });
}

// Otevření okna vynuluje příznak změny až po svém dokončení (ulozeni.js); hodnota se proto vloží až potom,
// aby okno vědělo o změně a uživatel jen potvrdil uložením
const poOtevreni = () => new Promise(r => setTimeout(r));

// „Upravit…“: formulář modelky (nebo okno alba) na poli návrhu, s hodnotou předvyplněnou k potvrzení
async function upravit(n) {
    const modelka = stav.prehledModelky.get(n.modelkaId) || (await vsechnyModelky()).find(m => m.id === n.modelkaId);
    if (!modelka) return;
    if (!n.album) {
        if (!n.inputId || !document.getElementById(n.inputId)) {
            otevritDetailModelky(modelka);
            return;
        }
        otevritModelModal(modelka);
        ukazatZalozku(zalozkaPole(n.inputId));
        await poOtevreni();
        predvyplnitPole(n.inputId, n.hodnota);
        zameritPole(n.inputId);
        return;
    }
    // Album se upravuje v profilu modelky
    await otevritDetailModelky(modelka);
    await nacistFotkyModelky(modelka.id);
    const album = stav.aktualniAlba.find(a => a.album === n.album && a.typ === n.typ);
    if (!album) return;
    otevritAlbumModal(modelka, album);
    await poOtevreni();
    const vydani = n.pole === 'vydani' || ['selectAlbumMesic', 'selectAlbumSpecial', 'inputAlbumRok'].includes(n.inputId);
    let pole = null;
    if (vydani) pole = predvyplnitVydaniAlba(n.hodnota);
    else if (document.getElementById(n.inputId)) {
        predvyplnitPole(n.inputId, n.hodnota);
        pole = document.getElementById(n.inputId);
    }
    pole?.focus();
}

// Nabídka řádku návrhu (⋯, pravé tlačítko, klávesa nabídky) a skupiny modelky (⋯ v hlavičce)
export function nabidkaNavrhu(prvek, x, y) {
    const radek = prvek.closest('.nv-radek');
    const skupina = prvek.closest('.nv-skupina');
    if (!skupina) return;
    const modelkaId = parseInt(skupina.dataset.navrhyModelka);
    const modelka = stav.prehledModelky.get(modelkaId);
    const uModelky = aktivni().filter(n => n.modelkaId === modelkaId).length;
    const profil = modelka ? [{ text: 'Otevřít profil', akce: () => otevritDetailModelky(modelka) }] : [];
    let polozky;
    if (radek) {
        const n = najit(radek.dataset.navrh);
        if (!n) return;
        polozky = n.odmitnuto ? [{ text: 'Vrátit – znovu nabízet', akce: () => vratitOdmitnuti([n]) }, null, ...profil] : [
            { text: `Přijmout „${hodnotaNavrhu(n)}“`, akce: () => prijmout(n) },
            { text: 'Upravit…', akce: () => upravit(n) },
            { text: 'Odmítnout – už nenabízet', akce: () => odmitnoutJeden(n) },
            null,
            ...(uModelky > 1 ? [{ text: `Přijmout vše u modelky (${uModelky})`, akce: () => prijmoutUModelky(modelkaId) }] : []),
            ...profil,
        ];
    } else {
        polozky = [
            ...(uModelky ? [
                { text: `Přijmout vše u modelky (${uModelky})`, akce: () => prijmoutUModelky(modelkaId) },
                { text: `Odmítnout vše u modelky (${uModelky})`, akce: () => odmitnoutUModelky(modelkaId) },
                null,
            ] : []),
            ...(modelka ? [{ text: 'Upravit modelku…', akce: () => otevritModelModal(modelka) }] : []),
            ...profil,
        ];
    }
    otevritKontextovouNabidku(x, y, polozky);
}

// Obsluha událostí; volá ji prehled.js
export function pripravit() {
    stats.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const radek = cil.closest('.nv-radek');
        const n = radek && najit(radek.dataset.navrh);
        const vice = cil.closest('[data-navrh-vice], [data-navrhy-vice]');
        if (vice) {
            const r = vice.getBoundingClientRect();
            nabidkaNavrhu(vice, r.right - 240, r.bottom + 4);
        } else if (cil.closest('[data-navrhy-jiste]')) prijmoutJiste();
        else if (cil.closest('[data-navrhy-odmitnute]')) {
            stav.navrhyOdmitnute = !stav.navrhyOdmitnute;
            prekreslit();
            /** @type {HTMLElement} */ (stats.querySelector('[data-navrhy-odmitnute]'))?.focus();
        } else if (cil.closest('[data-navrhy-modelky]')) prijmoutUModelky(parseInt(cil.closest('.nv-skupina').dataset.navrhyModelka));
        else if (!n) return;
        else if (cil.closest('[data-navrh-prijmout]')) prijmout(n);
        else if (cil.closest('[data-navrh-upravit]')) upravit(n);
        else if (cil.closest('[data-navrh-odmitnout]')) odmitnoutJeden(n);
        else if (cil.closest('[data-navrh-vratit]')) vratitOdmitnuti([n]);
    });

    // Zaměřený řádek návrhu: Enter přijme (u odmítnutého vrátí), Delete odmítne, šipky nahoru a dolů jdou po řádcích
    stats.addEventListener('keydown', (e) => {
        const radek = /** @type {HTMLElement} */ (e.target).closest?.('.nv-radek');
        if (!radek || radek !== e.target || e.ctrlKey || e.altKey || e.metaKey) return;
        const n = najit(radek.dataset.navrh);
        if (!n) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            if (n.odmitnuto) vratitOdmitnuti([n]);
            else prijmout(n);
        } else if (e.key === 'Delete' && !n.odmitnuto) {
            e.preventDefault();
            odmitnoutJeden(n);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const radky = [...stats.querySelectorAll('.nv-radek')];
            /** @type {HTMLElement} */ (radky[radky.indexOf(radek) + (e.key === 'ArrowDown' ? 1 : -1)])?.focus();
        }
    });
}
