// Filtr Modelek: panel pod tlačítkem Filtry v kapsli voleb vpravo nahoře. Vlevo seznam filtrů (Srdíčka, Edice, Kategorie,
// Vlasy, Rok vydání…), vpravo editor zvoleného: je / není, zaškrtávání hodnot s počtem modelek, které zbudou, u čísel
// předvolby a rozsah od–do. Podmínky jsou model filtru (lib/filtr.js, lib/dimenze.js); do backendu jdou jako příkazy
// dotazu spolu s textem hledání (galerie.js, dotazModelek), hledání samo zůstává obyčejným polem. Filtr se pamatuje.
import { bezDiakritiky, esc, sklonovat } from '../lib/format';
import { fasety, parsovat, serializovat, vyhodnotit } from '../lib/filtr';
import { DIMENZE_MODELEK, textyModelky } from '../lib/dimenze';
import { vsechnyModelky } from './mezipamet';
import { searchInput } from './prvky';
import { stav } from './stav';

const KLIC_ULOZENI = 'filtrModelek';
let podminky = []; // { klic, negace, hodnoty[], vyraz }
const aktivni = () => stav.rezim === 'modelky';
const dimenze = klic => DIMENZE_MODELEK.find(d => d.klic === klic);
const textPodminky = p => serializovat({ podminky: [p], volne: [] });

// Uložený filtr; verze 0.99.99 ho měla v textu hledání (hledaniModelek): příkazy z něj se převezmou jednou
try {
    const ulozeny = localStorage.getItem(KLIC_ULOZENI) ?? localStorage.getItem('hledaniModelek') ?? '';
    podminky = parsovat(ulozeny, DIMENZE_MODELEK).podminky;
    localStorage.removeItem('hledaniModelek');
} catch { /* bez úložiště začne bez filtru */ }

// Příkazy filtru, které se k textu hledání přidají v dotazu galerie
export const dotazFiltru = () => (aktivni() ? podminky.map(textPodminky).join(' ') : '');
export const pocetFiltru = () => (aktivni() ? podminky.length : 0);

function zmeneno() {
    try { localStorage.setItem(KLIC_ULOZENI, podminky.map(textPodminky).join(' ')); } catch { /* jen pro toto spuštění */ }
    document.dispatchEvent(new CustomEvent('filtr-modelek'));
    vykreslitPanel();
}

// Popis hodnot podmínky pro štítek a seznam filtrů
function popisSrdicek(vyraz) {
    const v = String(vyraz).replace(/\s/g, '');
    if (v === '0') return 'bez ♥';
    const op = /^(>=|>|<=|<|=)?(\d+(?:[.,]\d+)?)$/.exec(v);
    if (op) return `${op[1] && op[1] !== '>=' ? op[1] : ''}♥ ${op[2].replace('.', ',')}${op[1] === '>=' ? '+' : ''}`;
    return `♥ ${v.replace('..', '–')}`;
}
function popisHodnot(p) {
    const d = dimenze(p.klic);
    if (d?.typ === 'srdicka') return popisSrdicek(p.vyraz);
    if (d?.typ === 'cislo') return p.vyraz.replace('..', '–');
    return p.hodnoty.join(', ');
}

// Štítky do stavové lišty: popis, zrušení, úprava (otevře panel na tomto filtru)
export function stitkyFiltru() {
    if (!aktivni()) return [];
    return podminky.map(p => ({
        text: `${dimenze(p.klic)?.nazev || p.klic}${p.negace ? ' ≠' : ':'} ${popisHodnot(p)}`,
        zrusit: () => {
            podminky = podminky.filter(x => x !== p);
            zmeneno();
        },
        upravit: () => otevritPanelFiltru(null, p.klic),
    }));
}

export function zrusitFiltrModelek() {
    if (!podminky.length) return false;
    podminky = [];
    zmeneno();
    return true;
}

// ——— Panel ———

const PREDVOLBY = {
    rok: [['1950..1959', '50. léta'], ['1960..1969', '60. léta'], ['1970..1979', '70. léta'], ['1980..1989', '80. léta'], ['1990..1999', '90. léta'], ['2000..2009', '2000–2009'], ['2010..2029', 'od 2010']],
    narozena: [['1930..1949', '1930–1949'], ['1950..1959', '50. léta'], ['1960..1969', '60. léta'], ['1970..1979', '70. léta'], ['1980..1989', '80. léta'], ['1990..2010', 'od 1990']],
    vyska: [['<165', 'do 164 cm'], ['165..174', '165–174 cm'], ['>=175', 'od 175 cm']],
    vaha: [['<50', 'do 49 kg'], ['50..59', '50–59 kg'], ['>=60', 'od 60 kg']],
};
const SRDICKA = [['>=1', '♥ 1+'], ['>=2', '♥ 2+'], ['>=3', '♥ 3+'], ['>=3,5', '♥ 3½+'], ['>=4', '♥ 4+'], ['>=4,5', '♥ 4½+'], ['5', '♥ 5'], ['0', 'Bez ♥']];

let panel = null;
let kotvaPanelu = null;
const stavPanelu = { klic: 'hodnoceni', negace: false, hledat: '', hledatFokus: false };

// Připnutý panel (pamatuje se): ukotvený vpravo vedle karet Profilů jako panel Údaje v profilu, nezavírá se klikem
// mimo a otevře se sám, kdykoli jsou Profily vidět (obnovitPripnutyPanel)
const KLIC_PRIPNUTI = 'filtrModelekPripnuty';
const pripnuty = () => { try { return localStorage.getItem(KLIC_PRIPNUTI) === '1'; } catch { return false; } };
function nastavitPripnuti(ano) {
    try { localStorage.setItem(KLIC_PRIPNUTI, ano ? '1' : '0'); } catch { /* jen teď */ }
    panel?.classList.toggle('pripnuty', ano);
    document.getElementById('app')?.classList.toggle('filtr-pripnuty', ano && Boolean(panel));
    if (ano) document.removeEventListener('pointerdown', klikMimo, true);
    else if (panel) document.addEventListener('pointerdown', klikMimo, true);
    umistit();
}

// Po vykreslení Profilů: připnutý panel otevřít, otevřený obnovit (počty podle hledání)
export function obnovitPripnutyPanel() {
    if (!aktivni()) return;
    if (panel) vykreslitPanel();
    else if (pripnuty()) otevritPanelFiltru();
}

export function zavritPanelFiltru() {
    panel?.remove();
    panel = null;
    document.getElementById('app')?.classList.remove('filtr-pripnuty');
    kotvaPanelu?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', klikMimo, true);
}
function klikMimo(e) {
    if (panel && !panel.contains(e.target) && !(kotvaPanelu && kotvaPanelu.contains(e.target))) zavritPanelFiltru();
}

// Otevře (nebo zavře) panel pod tlačítkem Filtry; klic = rovnou tento filtr (štítek ve stavové liště)
export async function otevritPanelFiltru(kotva = null, klic = null) {
    if (panel && !klic) return zavritPanelFiltru();
    const tlacitko = kotva || /** @type {HTMLElement | null} */ (document.querySelector('#volbyPrehledu .volba.filtry'));
    if (klic) {
        stavPanelu.klic = klic;
        stavPanelu.negace = podminky.find(p => p.klic === klic)?.negace || false;
        stavPanelu.hledat = '';
    }
    if (!panel) {
        panel = document.createElement('div');
        panel.className = 'filtr-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Filtry modelek');
        document.getElementById('app').append(panel);
        panel.addEventListener('click', naKlik);
        panel.addEventListener('input', naVstup);
        panel.addEventListener('change', naZmenu);
        panel.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || pripnuty()) return;
            e.stopPropagation();
            zavritPanelFiltru();
            kotvaPanelu?.focus();
        });
        if (!pripnuty()) document.addEventListener('pointerdown', klikMimo, true);
        panel.classList.toggle('pripnuty', pripnuty());
        document.getElementById('app')?.classList.toggle('filtr-pripnuty', pripnuty());
    }
    kotvaPanelu = tlacitko;
    kotvaPanelu?.setAttribute('aria-expanded', 'true');
    await vykreslitPanel();
    umistit();
    /** @type {HTMLElement | null} */ (panel?.querySelector('.fp-filtr.zvoleny'))?.focus({ preventScroll: true });
}

function umistit() {
    if (!panel) return;
    if (pripnuty()) {
        panel.style.left = '';
        panel.style.top = '';
        return;
    }
    const r = (kotvaPanelu?.isConnected ? kotvaPanelu : document.getElementById('volbyPrehledu')).getBoundingClientRect();
    const sirka = panel.offsetWidth;
    panel.style.left = `${Math.max(8, Math.min(r.right - sirka, window.innerWidth - sirka - 8))}px`;
    panel.style.top = `${r.bottom + 8}px`;
}

async function vykreslitPanel() {
    if (!panel) return;
    const modelky = await vsechnyModelky();
    if (!panel) return;
    // Počty s textem hledání a ostatními filtry; hledání může obsahovat i příkazy (vlasy:blond)
    const hledani = parsovat(searchInput.value, DIMENZE_MODELEK);
    const filtr = { podminky: [...podminky, ...hledani.podminky], volne: hledani.volne };
    const zbude = modelky.filter(m => vyhodnotit(m, filtr, DIMENZE_MODELEK, textyModelky)).length;

    const seznam = DIMENZE_MODELEK.map(d => {
        const zapnute = podminky.filter(p => p.klic === d.klic);
        const souhrn = zapnute.map(p => `${p.negace ? '≠ ' : ''}${popisHodnot(p)}`).join(' · ');
        return `<button type="button" class="fp-filtr ${d.klic === stavPanelu.klic ? 'zvoleny' : ''} ${zapnute.length ? 'zapnuto' : ''}" data-fp-filtr="${d.klic}">
            <span>${esc(d.nazev)}</span>${souhrn ? `<small>${esc(souhrn)}</small>` : ''}</button>`;
    }).join('');

    panel.innerHTML = `<div class="fp-telo">
            <nav class="fp-seznam" aria-label="Filtry">${seznam}</nav>
            <div class="fp-editor">${htmlEditoru(modelky, filtr)}</div>
        </div>
        <div class="fp-pata">
            <span>${esc(`Zobrazí se ${sklonovat(zbude, 'modelka', 'modelky', 'modelek')}`)}</span>
            ${podminky.length ? `<button type="button" class="link" data-fp-zrusit-vse>Zrušit filtry (${podminky.length})</button>` : ''}
            <button type="button" class="link" data-fp-pripnout title="${pripnuty() ? 'Panel se zase bude otevírat jen tlačítkem Filtry' : 'Panel zůstane otevřený vpravo vedle karet'}">${pripnuty() ? 'Odepnout' : 'Připnout vedle karet'}</button>
        </div>`;
    const pole = /** @type {HTMLInputElement | null} */ (panel.querySelector('[data-fe-hledat]'));
    if (pole && stavPanelu.hledatFokus) {
        pole.focus();
        pole.setSelectionRange(pole.value.length, pole.value.length);
    }
}

function htmlEditoru(modelky, filtr) {
    const klic = stavPanelu.klic;
    const d = dimenze(klic);
    const p = podminky.find(x => x.klic === klic && x.negace === stavPanelu.negace);
    const hlava = `<div class="fe-hlava"><h6>${esc(d.nazev)}</h6>
        <div class="fe-je" role="group" aria-label="Je nebo není"><button type="button" class="${stavPanelu.negace ? '' : 'on'}" data-fe-je="0">je</button><button type="button" class="${stavPanelu.negace ? 'on' : ''}" data-fe-je="1">není</button></div></div>`;
    let telo = '';
    if (d.typ === 'srdicka' || d.typ === 'anone' || (d.typ === 'cislo' && PREDVOLBY[klic])) {
        const volby = d.typ === 'srdicka' ? SRDICKA : d.typ === 'anone' ? [['ano', 'Ano'], ['ne', 'Ne']] : PREDVOLBY[klic];
        const zvolena = p ? (d.typ === 'anone' ? p.hodnoty[0] : p.vyraz) : '';
        telo += `<div class="fe-volby">${volby.map(([v, n]) => `<button type="button" class="${zvolena && bezDiakritiky(zvolena) === bezDiakritiky(v) ? 'on' : ''}" data-fe-vyraz="${esc(v)}">${esc(n)}</button>`).join('')}</div>`;
    }
    if (d.typ === 'cislo') {
        const r = /^(\d+)\.\.(\d+)$/.exec(p?.vyraz || '') || /^>=(\d+)$/.exec(p?.vyraz || '');
        telo += `<div class="fe-rozsah"><input type="number" inputmode="numeric" data-fe-od placeholder="od" value="${r ? esc(r[1]) : ''}" /><span>–</span><input type="number" inputmode="numeric" data-fe-do placeholder="do" value="${r && r[2] ? esc(r[2]) : ''}" /></div>`;
    }
    if (d.typ === 'text') {
        // Počty bez podmínky tohoto filtru (fasety): kolik modelek by s hodnotou zbylo
        const pocty = fasety(modelky, filtr, DIMENZE_MODELEK, textyModelky, klic);
        const zvolene = new Set((p?.hodnoty || []).map(bezDiakritiky));
        const hledane = bezDiakritiky(stavPanelu.hledat);
        const hodnoty = [...(p?.hodnoty || []).filter(h => !pocty.some(x => bezDiakritiky(x.hodnota) === bezDiakritiky(h))).map(h => ({ hodnota: h, pocet: 0 })), ...pocty]
            .filter(x => zvolene.has(bezDiakritiky(x.hodnota)) || !hledane || bezDiakritiky(x.hodnota).includes(hledane)).slice(0, 60);
        telo += `${pocty.length > 8 ? `<input type="search" class="fe-hledat" data-fe-hledat placeholder="Hledat hodnotu…" value="${esc(stavPanelu.hledat)}" />` : ''}
            <div class="fe-seznam" role="listbox" aria-multiselectable="true">${hodnoty.map(x => {
                const on = zvolene.has(bezDiakritiky(x.hodnota));
                return `<button type="button" role="option" aria-selected="${on}" class="${on ? 'on' : ''} ${x.pocet ? '' : 'nula'}" data-fe-hodnota="${esc(x.hodnota)}"><span class="fe-box" aria-hidden="true"></span>${esc(x.hodnota)}<small>${x.pocet}</small></button>`;
            }).join('') || '<p class="fe-prazdne">Žádná hodnota</p>'}</div>`;
    }
    return hlava + telo + (p ? `<button type="button" class="link fe-zrusit" data-fe-zrusit>Zrušit filtr ${esc(d.nazev)}</button>` : '');
}

function nastavit(hodnoty) {
    const klic = stavPanelu.klic;
    podminky = podminky.filter(p => !(p.klic === klic && p.negace === stavPanelu.negace));
    if (hodnoty) podminky.push({ klic, negace: stavPanelu.negace, ...hodnoty });
    zmeneno();
}

function naKlik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const filtr = /** @type {HTMLElement | null} */ (cil.closest('[data-fp-filtr]'));
    const je = /** @type {HTMLElement | null} */ (cil.closest('[data-fe-je]'));
    const vyraz = /** @type {HTMLElement | null} */ (cil.closest('[data-fe-vyraz]'));
    const hodnota = /** @type {HTMLElement | null} */ (cil.closest('[data-fe-hodnota]'));
    const d = dimenze(stavPanelu.klic);
    const p = podminky.find(x => x.klic === stavPanelu.klic && x.negace === stavPanelu.negace);
    stavPanelu.hledatFokus = false;
    if (filtr) {
        stavPanelu.klic = filtr.dataset.fpFiltr;
        stavPanelu.negace = podminky.find(x => x.klic === stavPanelu.klic)?.negace || false;
        stavPanelu.hledat = '';
        vykreslitPanel();
    } else if (je) {
        // Přepnutí je / není přenese stávající podmínku na druhou stranu
        const nova = je.dataset.feJe === '1';
        if (nova === stavPanelu.negace) return;
        if (p) podminky = podminky.filter(x => x !== p);
        stavPanelu.negace = nova;
        if (p) nastavit({ hodnoty: p.hodnoty, vyraz: p.vyraz });
        else vykreslitPanel();
    } else if (vyraz) {
        const v = vyraz.dataset.feVyraz;
        if (d.typ === 'anone') nastavit(p?.hodnoty[0] === v ? null : { hodnoty: [v], vyraz: v });
        else nastavit(p?.vyraz === v ? null : { hodnoty: [], vyraz: v });
    } else if (hodnota) {
        const v = hodnota.dataset.feHodnota;
        const hodnoty = (p?.hodnoty || []).filter(h => bezDiakritiky(h) !== bezDiakritiky(v));
        if (hodnoty.length === (p?.hodnoty || []).length) hodnoty.push(v);
        nastavit(hodnoty.length ? { hodnoty, vyraz: hodnoty.join(',') } : null);
    } else if (cil.closest('[data-fe-zrusit]')) {
        nastavit(null);
    } else if (cil.closest('[data-fp-zrusit-vse]')) {
        zrusitFiltrModelek();
    } else if (cil.closest('[data-fp-pripnout]')) {
        nastavitPripnuti(!pripnuty());
        vykreslitPanel();
    }
}

function naVstup(e) {
    const cil = /** @type {HTMLInputElement} */ (e.target);
    if (!cil.matches('[data-fe-hledat]')) return;
    stavPanelu.hledat = cil.value;
    stavPanelu.hledatFokus = true;
    vykreslitPanel();
}

function naZmenu(e) {
    const cil = /** @type {HTMLInputElement} */ (e.target);
    if (!cil.matches('[data-fe-od], [data-fe-do]')) return;
    const od = /** @type {HTMLInputElement} */ (panel.querySelector('[data-fe-od]')).value.trim();
    const po = /** @type {HTMLInputElement} */ (panel.querySelector('[data-fe-do]')).value.trim();
    nastavit(od && po ? { hodnoty: [], vyraz: `${od}..${po}` } : od ? { hodnoty: [], vyraz: `>=${od}` } : po ? { hodnoty: [], vyraz: `<=${po}` } : null);
}

window.addEventListener('resize', umistit);
