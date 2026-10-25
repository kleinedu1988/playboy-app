// Učení v Údržbě: panel „Co se program naučil“ (zdroje návrhů s přesností, přijaté, odmítnuté a opravené návrhy,
// velikost souboru, „Zapomenout naučené“) a zápis opravy, když uživatel návrh v „Upravit…“ uloží s jinou hodnotou.
// Učení je samostatný soubor vedle databáze; sbírky se nedotýká. Když ho backend nemá, panel se neukáže.
import { GetStavUceni, ZapomenoutUceni, ZaznamenatOpravu } from './backend';
import { esc, sklonovat } from '../lib/format';
import { opravaNavrhu, procent, tridaJistoty } from '../lib/udrzba';
import { albumModal, modelModal } from './okno';
import { poleModelky, potvrdit } from './formular-modelky';
import { oznamit } from '../ui/oznameni';

// Typy podle backendu (uceni.go); po sloučení se nahradí main.StavUceni a main.ZdrojUceni z wailsjs/go/models
/** @typedef {import('../../wailsjs/go/models').main.ZdrojUceni} ZdrojUceni */
/** @typedef {import('../../wailsjs/go/models').main.StavUceni} StavUceni */

/** @type {StavUceni | null} */
let stavUceni = null;

// Zdroj nálezu kontroly nebo návrhu slovy: popis z učení, jinak známé zdroje kontroly, jinak klíč
const ZDROJE_KONTROLY = {
    jmeno: 'stejné jméno', 'narozeni-budoucnost': 'narození v budoucnosti', 'narozeni-po-vydani': 'narození po vydání',
    vek: 'věk při vydání', 'umrti-budoucnost': 'úmrtí v budoucnosti', 'umrti-pred-narozenim': 'úmrtí před narozením',
    'umrti-pred-vydanim': 'úmrtí před vydáním', vyska: 'výška', vaha: 'váha', bmi: 'BMI', miry: 'míry', 'miry-pas': 'pas a boky',
    'pmoy-bez-centerfoldu': 'Playmate roku bez centerfoldu', 'pmoy-rok': 'rok Playmate roku', cislo: 'dva centerfoldy v čísle',
    dvojice: 'stejná fotka ve dvou albech', neobvykle: 'neobvyklá kombinace údajů', 'podobne-jmeno': 'podobná jména',
    album: 'album s jednou fotkou', 'vydani-alba': 'vydání alba',
};
export const popisZdroje = zdroj => stavUceni?.zdroje?.find(z => z.zdroj === zdroj)?.popis || ZDROJE_KONTROLY[zdroj] || zdroj;

export async function nacistUceni() {
    try {
        stavUceni = (await GetStavUceni()) || null;
    } catch {
        stavUceni = null;
    }
}

const velikostSouboru = b => b >= 1048576 ? `${(b / 1048576).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} MB`
    : b >= 1024 ? `${Math.round(b / 1024).toLocaleString('cs-CZ')} kB` : `${b || 0} B`;
function kdy(text) {
    // „RRRR-MM-DD HH:MM:SS“ s mezerou starší JavaScriptCore (WebKitGTK) nepřečte, s „T“ ano (místní čas)
    const d = text ? new Date(String(text).replace(' ', 'T')) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Panel do hlavičky Údržby; prázdný řetězec, když backend učení nemá. rozbaleno = ukázat všechny zdroje.
export function htmlUceni({ rozbaleno = false, zdroj = '' } = {}) {
    const s = stavUceni;
    if (!s) return '';
    const rozhodnuti = (s.prijato || 0) + (s.odmitnuto || 0) + (s.opraveno || 0);
    const zdroje = [...(s.zdroje || [])].sort((a, b) => Number(b.aktivni) - Number(a.aktivni) || b.navrhu - a.navrhu);
    const ukazat = rozbaleno ? zdroje : zdroje.slice(0, 4);
    const naposledy = kdy(s.naposledy);
    return `
        <h4><span class="nv-hvezda" aria-hidden="true">✦</span> Co se program naučil
            <small>${rozhodnuti ? `z ${sklonovat(rozhodnuti, 'tvého rozhodnutí', 'tvých rozhodnutí', 'tvých rozhodnutí')}` : 'zatím nic'}${naposledy ? ` · naposledy ${naposledy}` : ''}</small></h4>
        <div class="uc-cisla">
            <div><b>${s.prijato || 0}</b><span>přijato</span></div>
            <div><b>${s.odmitnuto || 0}</b><span>odmítnuto</span></div>
            <div><b>${s.opraveno || 0}</b><span>opraveno</span></div>
            <div><b>${rozhodnuti ? `${Math.round((s.prijato || 0) / rozhodnuti * 100)} %` : '–'}</b><span>přijatých návrhů</span></div>
        </div>
        ${zdroje.length ? `<ul class="uc-zdroje">${ukazat.map(z => {
            const p = procent(z.presnost);
            return `<li><button type="button" class="uc-zdroj ${z.aktivni ? '' : 'neaktivni'} ${z.zdroj === zdroj ? 'on' : ''}" data-uceni-zdroj="${esc(z.zdroj)}"
                    title="${esc(`${z.popis}: přesnost ${p} % (${z.prijato} přijato, ${z.odmitnuto} odmítnuto z ${z.navrhu} návrhů)${z.aktivni ? ' – klik ukáže jeho návrhy' : ' – zdroj se teď nepoužívá'}`)}">
                <span class="uc-nazev">${esc(z.popis)}${z.aktivni ? '' : ' <em>neaktivní</em>'}</span>
                <span class="nv-jistota ${tridaJistoty(z.presnost)}"><i><b style="width:${p}%"></b></i><span>${p} %</span></span>
                <small>${z.prijato} ✓ · ${z.odmitnuto} ✕ z ${z.navrhu}</small></button></li>`;
        }).join('')}</ul>${zdroje.length > 4 ? `<button type="button" class="link uc-vice" data-uceni-rozbalit>${rozbaleno ? 'Méně zdrojů' : `Všechny zdroje (${zdroje.length})`}</button>` : ''}`
            : '<p class="uc-prazdne">Každé přijetí, odmítnutí a oprava návrhu zpřesní další návrhy.</p>'}
        <div class="uc-pata">
            <span title="${esc(s.soubor || '')}">Soubor učení · ${velikostSouboru(s.velikost)}${s.udalosti ? ` · ${sklonovat(s.udalosti, 'záznam', 'záznamy', 'záznamů')}` : ''}</span>
            ${rozhodnuti || s.udalosti ? '<button type="button" class="link uc-zapomenout" data-uceni-zapomenout>Zapomenout naučené…</button>' : ''}
        </div>`;
}

// „Zapomenout naučené“: smaže jen soubor učení, sbírka zůstane
export async function zapomenout() {
    if (!await potvrdit('Zapomenout naučené?',
        'Program zapomene, které návrhy jsi přijal, odmítl nebo opravil, a návrhy bude zase počítat jen z údajů ve sbírce. '
        + 'Sbírka se nemění: modelky, alba, fotky ani žádný vyplněný údaj se nesmažou. Odmítnuté hodnoty se mohou znovu nabídnout.',
        'Zapomenout', { nebezpecne: true })) return false;
    let ok = false;
    try {
        ok = await ZapomenoutUceni();
    } catch { /* oznámí se níž */ }
    oznamit(ok ? 'Naučené je zapomenuté. Sbírka zůstala beze změny.' : 'Naučené se nepodařilo zapomenout.');
    return ok;
}

// Oprava návrhu: „Upravit…“ si zapamatuje návrh; po uložení formuláře se hodnota porovná s navrženou
/** @type {null | { modelkaId: number, album: string, typ: string, pole: string, inputId: string, hodnota: string }} */
let cekajici = null;

export function cekatNaOpravu(n) {
    cekajici = { modelkaId: n.modelkaId, album: n.album || '', typ: n.typ || '', pole: n.pole, inputId: n.inputId || '', hodnota: String(n.hodnota ?? '') };
}

function zaznamenat(c, nova) {
    const text = opravaNavrhu(c.hodnota, c.inputId, nova);
    if (text !== null) ZaznamenatOpravu(c.modelkaId, c.pole, c.hodnota, text).catch(() => false);
}

// Návrh, který soustředěný režim Údržby uložil s jinou hodnotou (opravený na místě), stejně jako po „Upravit…“
export function zaznamenatOpravuNavrhu(n, nova) {
    zaznamenat({ hodnota: String(n.hodnota ?? ''), inputId: n.inputId || '', modelkaId: n.modelkaId, pole: n.pole }, nova);
}

// Volá ulozeni.js po uložení modelky
export function poUlozeniModelky(modelka) {
    const c = cekajici;
    if (!c || c.album || c.modelkaId !== modelka.id) return;
    cekajici = null;
    const vlastnost = poleModelky.find(p => p[1] === c.inputId)?.[0];
    if (vlastnost) zaznamenat(c, modelka[vlastnost]);
}

// Volá ulozeni.js po uložení upravovaného alba; hodnoty = { vydani, fotograf, popis }
export function poUlozeniAlba(modelkaId, album, typ, hodnoty) {
    const c = cekajici;
    if (!c || !c.album || c.modelkaId !== modelkaId || c.album !== album || c.typ !== typ) return;
    cekajici = null;
    const vydani = c.pole === 'vydani' || c.pole === 'vydaniAlba' || ['selectAlbumMesic', 'selectAlbumSpecial', 'inputAlbumRok'].includes(c.inputId);
    zaznamenat(c, vydani ? hodnoty.vydani : c.inputId === 'inputAlbumFotograf' ? hodnoty.fotograf : c.inputId === 'inputAlbumPopis' ? hodnoty.popis
        : /** @type {HTMLInputElement} */ (document.getElementById(c.inputId))?.value);
}

// Zavřené okno (uložené i zrušené) čekající opravu zahodí; uložení ji zpracuje dřív, než se okno zavře
export function pripravit() {
    [modelModal, albumModal].forEach(okno => new MutationObserver(() => {
        if (okno.classList.contains('hidden')) cekajici = null;
    }).observe(okno, { attributes: true, attributeFilter: ['class'] }));
}
