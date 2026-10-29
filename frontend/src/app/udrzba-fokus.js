// Údržba „Po modelkách“: jedna modelka (nebo číslo) velká se všemi úkoly k vyřízení na místě a vpravo fronta
// „Na řadě“ s jedním výběrem filtru (Vše, Návrhy, Ke kontrole, oblasti, jednotlivé údaje). Chybějící údaj má pole
// stejného druhu jako formulář modelky (kopie z doplneni.js), nález kontroly pole s hodnotou k opravě, návrh pole
// s navrženou hodnotou a ✓/✕; co na místě nejde (text a vydání alba, cover, centerfold), otevře své okno.
// Enter jde na další pole, „Uložit a další“ (Ctrl+Enter) zapíše jen změněná pole (udrzba-zapis.js, srdíčka
// SetHodnoceni) a otevře další položku; ✓, ✕, Netýká se a V pořádku se ukládají hned. Karta se přestaví jen při
// změně úkolů a rozepsané hodnoty přitom zůstanou.
import { SetHodnoceni } from './backend';
import { esc, nazevAlba, sklonovat } from '../lib/format';
import { OBLASTI_FILTRU, filtrovatUdrzbu, hodnotaNavrhu, procent, souhrnFronty, textAkce, ukolyFokusu } from '../lib/udrzba';
import { stav } from './stav';
import { kopiePole, prevestPole } from './doplneni';
import { naplnitNapovedu, potvrdit } from './formular-modelky';
import { chybaPoli, hodnotaModelky, hodnotaNavrhuPole, ulozitNavrh, ulozitPoleModelky, vlastnostPole } from './udrzba-zapis';
import { jeVidet, nastavitHtml, otevreneOkno, srovnatSeznam } from '../ui/dom';
import { htmlSrdicekModelky, obnovitSrdickaModelky } from '../ui/srdicka';
import { hodnotaPoKlavese, textSrdicek } from '../lib/srdicka';
import { oznamit } from '../ui/oznameni';
import * as navrhy from './navrhy';
import * as uceni from './uceni';
import { htmlPrazdna } from '../ui/prazdno';

// Fronta vpravo ukáže kousek před kartou a tolik za ní (delší fronta je jen počet)
const PRED = 2;
const ZA = 40;

// Co Údržba (udrzba.js) půjčuje: model, údaje po údajích, akce položek, načtení a vykreslení skupiny
let api = {
    model: () => null, poUdajich: () => null, hlavniAkce: async (_x, _s, _album) => {}, odlozit: async (_x, _s, _ano) => {}, nacist: async () => {},
    obrazek: (_s, _trida) => '', podtitulek: (_s) => '', modelka: (_s) => null, viditelna: () => false,
};

let kontejner = null; // [data-ud="fokus"]
let otevreno = false;
let klic = ''; // skupina na kartě
let skupina = null; // poslední známá podoba skupiny (karta zůstane, i když už ve frontě není)
let poradi = 0; // místo karty ve frontě při posledním vykreslení
let podpis = ''; // úkoly na kartě; karta se přestaví jen při jeho změně
let ukoly = [];
let hodnoceni = { puvodni: 0, nove: 0 };
let ukladam = false;

const velke = t => t.charAt(0).toUpperCase() + t.slice(1);
const cast = jmeno => /** @type {HTMLElement} */ (kontejner?.querySelector(`[data-uf="${jmeno}"]`));

// Skupiny ve frontě podle filtru: oblast nebo údaj (u:klíč, modelky, kterým údaj chybí); jen ty, které mají
// něco k vyřízení. Karta pak ukáže všechny úkoly skupiny, filtr vybírá jen pořadí modelek.
function frontaFiltru(filtr) {
    const model = api.model();
    if (!model) return [];
    if (filtr.startsWith('u:')) {
        const radky = api.poUdajich()?.udaje.get(filtr.slice(2))?.radky || [];
        const klice = new Set(radky.map(r => r.skupina.klic));
        return model.skupiny.filter(s => klice.has(s.klic) && s.aktivnich).map(s => ({ skupina: s, polozky: s.polozky }));
    }
    return filtrovatUdrzbu(model, { filtr, razeni: stav.udrzbaRazeni }).filter(v => v.polozky.some(x => !x.netyka));
}
const fronta = () => frontaFiltru(stav.udrzbaFiltrModelek);

export const otevreny = () => otevreno;

export function pripravit(funkce) {
    api = funkce;
    // Klávesy: Ctrl+Enter uloží a otevře další, Enter jde na další pole, PageUp/PageDown a Alt+←/→ předchozí
    // a další, Esc vrátí hodnotu zaměřeného pole. Zachytává se předem, aby Esc nezavřel nic jiného a Alt+← nešlo
    // „zpět“; otevřené okno, nabídka a přehled zkratek mají přednost.
    document.addEventListener('keydown', (e) => {
        if (!otevreno || !api.viditelna() || stav.zamceno) return;
        if (otevreneOkno() || jeVidet('lightbox') || jeVidet('zkratky') || jeVidet('contextMenu')) return;
        const cil = /** @type {HTMLElement} */ (e.target);
        const vKarte = cast('karta')?.contains(cil);
        let akce = null;
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Opuštění pole nejdřív převede rozepsanou míru (událost change)
            akce = () => { /** @type {HTMLElement} */ (document.activeElement)?.blur(); ulozitADalsi(); };
        } else if (e.key === 'Enter' && vKarte && !e.altKey && !e.shiftKey && cil.matches('input:not(.kategorie-jina), select')) akce = () => dalsiPole(cil);
        else if (e.key === 'Escape' && vKarte && cil.matches('[data-pole]')) akce = () => vratitPole(/** @type {HTMLInputElement} */ (cil));
        else if (/^([0-5]|ArrowLeft|ArrowRight)$/.test(e.key) && cil.matches('[data-uf-hodnoceni]') && !e.ctrlKey && !e.altKey && !e.metaKey) akce = () => srdickaKlavesou(e.key);
        else if ((e.key === 'PageDown' && !e.altKey) || (e.altKey && e.key === 'ArrowRight')) akce = () => prejit(1);
        else if ((e.key === 'PageUp' && !e.altKey) || (e.altKey && e.key === 'ArrowLeft')) akce = () => prejit(-1);
        if (!akce) return;
        e.preventDefault();
        e.stopPropagation();
        akce();
    }, true);
}

// Otevření (přepnutí na Po modelkách, S nebo ⋯ v Souhrnu): na zadané skupině, jinak na té, kde se skončilo,
// jinak na první ve frontě; zamerit = kurzor do prvního pole (ne při pouhém vykreslení po načtení Přehledu)
export function otevrit(prvek, klicSkupiny = '', { zamerit = true } = {}) {
    kontejner = prvek;
    if (!kontejner.querySelector('[data-uf="karta"]')) postavitKostru();
    if (!otevreno) naplnitNapovedu();
    otevreno = true;
    kontejner.classList.remove('hidden');
    const f = fronta();
    const cil = klicSkupiny || (f.some(v => v.skupina.klic === klic) ? klic : f[0]?.skupina.klic || '');
    if (cil !== klic || !podpis) nastavitSkupinu(cil);
    vykreslit();
    if (klicSkupiny) {
        // Karta nahoru do okna
        const oblast = document.querySelector('main');
        oblast.scrollTop += kontejner.getBoundingClientRect().top - oblast.getBoundingClientRect().top - 8;
    }
    if (zamerit) zameritPrvni();
}

function nastavitSkupinu(klicSkupiny) {
    klic = klicSkupiny;
    podpis = '';
    hodnoceni = { puvodni: 0, nove: 0 };
}

// Odchod z režimu (přepnutí na jiný režim); u rozepsaných změn se zeptá. Vrací, zda se zavřel.
export async function zavrit({ bezDotazu = false } = {}) {
    if (!otevreno) return true;
    if (!bezDotazu && !await zahoditZmeny()) return false;
    otevreno = false;
    kontejner.classList.add('hidden');
    podpis = '';
    return true;
}

const zahoditZmeny = async () => !rozepsano()
    || potvrdit('Zahodit změny?', 'Rozepsané údaje na kartě se neuloží.', 'Zahodit', { nebezpecne: true });

function postavitKostru() {
    kontejner.innerHTML = `
        <div class="uf-mrizka">
            <section class="uf-karta" data-uf="karta" aria-label="Úkoly modelky"></section>
            <aside class="uf-fronta" data-uf="obal-fronty" aria-label="Na řadě">
                <select class="ud-vyber" data-uf="filtr" data-uf-filtr aria-label="Které modelky ve frontě"></select>
                <button type="button" class="uf-fronta-hlava" data-uf-prepnout aria-expanded="false"><span>Na řadě</span><b data-uf="pocet"></b></button>
                <div class="uf-fronta-seznam" data-uf="fronta" role="list"></div>
                <p class="uf-fronta-pata" data-uf="pata-fronty"></p>
            </aside>
        </div>`;
    kontejner.addEventListener('click', klik);
    kontejner.addEventListener('change', (e) => {
        const prvek = /** @type {HTMLInputElement} */ (e.target);
        if (prvek.dataset?.pole) prevestPole(cast('karta'), prvek);
        if (prvek.matches?.('[data-uf-filtr]')) zmenitFiltr(prvek.value);
    });
}

// ——— Vykreslení ———

// Výběr filtru fronty s počty modelek: oblasti Údržby a pod nimi jednotlivé údaje z Po údajích
function htmlFiltru() {
    const model = api.model();
    const pocet = filtr => frontaFiltru(filtr).length;
    const volba = (hodnota, nazev, n) => `<option value="${esc(hodnota)}" ${hodnota === stav.udrzbaFiltrModelek ? 'selected' : ''}>${esc(nazev)} (${n})</option>`;
    const oblasti = OBLASTI_FILTRU.map(o => {
        const volby = o.filtry.filter(([k]) => k === 'vse' || model.pocty[k] || k === stav.udrzbaFiltrModelek).map(([k, nazev]) => volba(k, nazev, k === 'vse' ? model.pocty.vse : pocet(k)));
        return o.nazev === 'Fronta' ? volby.join('') : volby.length ? `<optgroup label="${o.nazev}">${volby.join('')}</optgroup>` : '';
    }).join('');
    // Jednotlivé údaje modelek (ostatní mají vlastní oblast výš)
    const udaje = [...(api.poUdajich()?.udaje.values() || [])].filter(u => u.pocet && u.druh === 'pole');
    return oblasti + (udaje.length ? `<optgroup label="Údaj">${udaje.map(u => volba(`u:${u.klic}`, u.nazev, new Set(u.radky.map(r => r.skupina.klic)).size)).join('')}</optgroup>` : '');
}

// Po každé změně dat (a filtru): fronta na místě, karta jen při změně úkolů
export function vykreslit() {
    if (!otevreno || !kontejner || !api.model()) return;
    const f = fronta();
    const i = f.findIndex(v => v.skupina.klic === klic);
    if (i >= 0) {
        poradi = i;
        skupina = f[i].skupina;
    } else {
        const vModelu = api.model().skupiny.find(s => s.klic === klic);
        if (vModelu) skupina = vModelu;
        else if (skupina?.klic !== klic) skupina = null;
    }
    // Karta ukazuje všechny nevyřízené úkoly skupiny (i mimo filtr); skupina mimo model už nic nemá
    const vModelu = skupina && api.model().skupiny.find(s => s.klic === skupina.klic);
    const nove = vModelu ? ukolyFokusu(vModelu.polozky, vlastnostPole) : [];
    const novyPodpis = `${klic}#${nove.map(u => u.klic).join(',')}`;
    if (novyPodpis !== podpis) {
        ukoly = nove;
        prestavetKartu();
        podpis = novyPodpis;
    }
    // Výběr filtru se nepřepisuje, když je otevřený nebo zaměřený (WebKitGTK by výběr zavřel)
    const filtr = cast('filtr');
    if (document.activeElement !== filtr) nastavitHtml(filtr, htmlFiltru());
    vykreslitFrontu(f, i);
}

function zmenitFiltr(filtr) {
    stav.udrzbaFiltrModelek = filtr;
    const f = fronta();
    // Karta zůstane, když ve frontě je; jinak první modelka nového výběru
    if (!f.some(v => v.skupina.klic === klic) && f[0] && !rozepsano()) nastavitSkupinu(f[0].skupina.klic);
    vykreslit();
}

function vykreslitFrontu(f, i) {
    const od = Math.max(0, (i >= 0 ? i : poradi) - PRED);
    const ukazat = f.slice(od, od + PRED + ZA + 1);
    srovnatSeznam(cast('fronta'), ukazat.map(({ skupina: s }) => {
        const aktivni = s.polozky.filter(x => !x.netyka).length;
        return { klic: s.klic, html: `<button type="button" class="uf-polozka ${s.klic === klic ? 'on' : ''}" data-klic="${esc(s.klic)}" data-uf-skok="${esc(s.klic)}" role="listitem"
            ${s.klic === klic ? 'aria-current="true"' : ''} title="${esc(`${s.jmeno}: ${sklonovat(aktivni, 'úkol', 'úkoly', 'úkolů')}`)}">
            ${api.obrazek(s)}<span class="uf-polozka-text"><b>${esc(s.jmeno)}</b><small>${esc(souhrnFronty(s.polozky))}</small></span><span class="uf-pocet">${aktivni}</span></button>` };
    }));
    cast('pocet').textContent = String(f.length);
    const zbyva = f.length - od - ukazat.length;
    cast('pata-fronty').textContent = zbyva > 0 ? `… a ${sklonovat(zbyva, 'další', 'další', 'dalších')}` : f.length ? '' : 'Ve výběru už nic nezbývá.';
    // Karta ve frontě do viditelné části seznamu (jen seznam, stránka se neposune)
    const seznam = cast('fronta');
    const aktualni = /** @type {HTMLElement} */ (seznam.querySelector('.uf-polozka.on'));
    if (aktualni && seznam.scrollHeight > seznam.clientHeight) {
        const horni = aktualni.offsetTop - seznam.offsetTop;
        if (horni < seznam.scrollTop || horni + aktualni.offsetHeight > seznam.scrollTop + seznam.clientHeight) seznam.scrollTop = Math.max(0, horni - 60);
    }
}

// Karta: hlavička s fotkou, úkoly a patička. Rozepsané hodnoty (a jejich původní hodnoty) zůstanou, když jde
// o tutéž skupinu; fokus zůstane v poli, nebo přejde na úkol, který nastoupil na místo vyřízeného.
function prestavetKartu() {
    const karta = cast('karta');
    const tataz = podpis.startsWith(`${klic}#`);
    const zachovane = new Map(tataz ? [...karta.querySelectorAll('[data-pole]')].map(p => [/** @type {HTMLElement} */ (p).dataset.pole,
        { hodnota: /** @type {HTMLInputElement} */ (p).value, puvodni: /** @type {HTMLElement} */ (p).dataset.puvodni }]) : []);
    const aktivni = /** @type {HTMLElement} */ (document.activeElement);
    const fokusVKarte = karta.contains(aktivni);
    const fokusPole = fokusVKarte ? aktivni.closest('[data-pole]')?.getAttribute('data-pole') : null;
    const fokusUkol = fokusVKarte ? [...karta.querySelectorAll('[data-ukol]')].indexOf(aktivni.closest('[data-ukol]')) : -1;
    if (!tataz) hodnoceni = { puvodni: 0, nove: 0 };

    const s = skupina;
    const modelka = s ? api.modelka(s) : null;
    if (!s) {
        karta.innerHTML = htmlPrazdna('Hotovo', 'Ve výběru už nic nezbývá – vyber jiný filtr, nebo přepni na Souhrn.', { ikona: 'hvezda' });
        return;
    }
    karta.innerHTML = `
        <header class="uf-hlava">
            ${api.obrazek(s, 'uf-foto')}
            <div class="uf-jmeno"><h4>${esc(s.jmeno)}</h4>
                <small>${[api.podtitulek(s), ukoly.length ? sklonovat(ukoly.length, 'úkol', 'úkoly', 'úkolů') : 'vše vyřízeno'].filter(Boolean).map(esc).join(' · ')}</small></div>
            <div class="uf-navigace">
                <button type="button" class="ud-nastroj" data-uf-predchozi title="Předchozí ve frontě (PageUp, Alt+←)">← Zpět</button>
                <button type="button" class="ud-nastroj" data-uf-preskocit title="Další ve frontě bez uložení (PageDown, Alt+→)">Přeskočit</button>
            </div>
        </header>
        <div class="uf-ukoly"></div>
        <footer class="uf-pata">
            <span class="ud-klavesy"><kbd>Enter</kbd> další pole <kbd>Ctrl+Enter</kbd> uložit a další modelka <kbd>Esc</kbd> vrátí hodnotu</span>
            <button type="button" class="btn btn-primary" data-uf-ulozit>${ukoly.length ? 'Uložit a další →' : 'Další →'}</button>
        </footer>`;
    const seznam = karta.querySelector('.uf-ukoly');
    if (!ukoly.length) seznam.innerHTML = '<p class="uf-hotovo">✓ Tady je vše vyřízené.</p>';
    ukoly.forEach(u => seznam.append(prvekUkolu(u, s, modelka, zachovane)));
    karta.querySelectorAll('[data-pole]').forEach(p => {
        const prvek = /** @type {HTMLInputElement} */ (p);
        prvek.dataset.puvodni = zachovane.get(prvek.dataset.pole)?.puvodni ?? prvek.value;
    });
    obnovitSrdicka();
    if (!fokusVKarte) return;
    const pole = fokusPole && /** @type {HTMLElement} */ (karta.querySelector(`[data-pole="${CSS.escape(fokusPole)}"]`));
    if (pole) pole.focus({ preventScroll: true });
    else {
        const radky = [...karta.querySelectorAll('[data-ukol]')];
        const radek = radky[Math.min(Math.max(fokusUkol, 0), radky.length - 1)];
        /** @type {HTMLElement} */ (radek?.querySelector('input:not([type="hidden"]), select, [data-uf-hodnoceni], button') || karta.querySelector('[data-uf-ulozit]'))?.focus({ preventScroll: true });
    }
}

// Nápověda uvnitř pole vpravo (důvod nálezu, jistota návrhu); pole se odsune, aby text nepřekryl
export function pridatNapovedu(obal, text, trida = '', title = '') {
    if (!text) return;
    obal.classList.add('ud-vstup');
    const napoveda = document.createElement('small');
    napoveda.className = `ud-napoveda ${trida}`;
    napoveda.textContent = text;
    if (title) obal.title = title;
    obal.append(napoveda);
    const pole = /** @type {HTMLElement} */ (obal.querySelector('input:not([type="hidden"]), select'));
    if (pole) pole.style.paddingRight = `${Math.min(text.length, 46) * 6.3 + 24}px`;
}

// Řádek úkolu: štítek, pole nebo text, akce
function prvekUkolu(u, s, modelka, zachovane) {
    const x = u.polozka;
    const radek = document.createElement('div');
    radek.className = `uf-ukol ${u.druh}`;
    radek.dataset.ukol = u.klic;
    const predpona = u.druh === 'kontrola' ? '⚠ ' : u.druh === 'navrh' ? '✦ ' : '';
    const akce = [];
    let obsah = '';
    /** @type {HTMLElement | null} */
    let pole = null;
    const vstup = (vychozi) => {
        pole = kopiePole(u.inputId, u.popis, { predpona: 'uf', hodnota: zachovane.get(u.inputId)?.hodnota ?? vychozi });
        pole.classList.add('uf-pole');
        // Hodnota, se kterou se karta otevřela (návrh, nález, prázdné): Esc ji vrátí, změna proti ní se ukládá
        /** @type {HTMLElement} */ (pole.querySelector('[data-pole]')).dataset.vychozi = vychozi;
        return pole;
    };
    if (u.druh === 'pole') {
        vstup('');
        // „Netýká se“ platí pro celou část formuláře (tak ho ukládá backend), proto jen u jejího prvního pole
        if (u.prvniVeSkupine) akce.push(`<button type="button" class="nv-tlacitko" data-uf-akce="odlozit" title="${esc(`Přestat hlídat celou část „${x.pole}“ (${sklonovat(x.chybejici.length, 'údaj', 'údaje', 'údajů')})`)}">Netýká se</button>`);
    } else if (u.druh === 'titulni') {
        /** @type {HTMLInputElement} */ (vstup('').querySelector('input')).placeholder = 'Vlož odkaz z Google Disku…';
        akce.push('<button type="button" class="nv-tlacitko" data-uf-akce="odlozit">Netýká se</button>');
    } else if (u.druh === 'hodnoceni') {
        obsah = `<div class="ud-vstup uf-srdicka-obal" data-uf-hodnoceni tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${hodnoceni.nove}"
            aria-valuetext="${textSrdicek(hodnoceni.nove)}" aria-label="Hodnocení (klávesy 1–5, stejná znovu přidá půlku)">
            ${htmlSrdicekModelky(hodnoceni.nove, '', { posuvnik: false, atributPulky: 'data-uf-srdce', tridy: 'uf-srdicka' })}
            <small class="ud-napoveda tlumena">1–5, znovu ½</small></div>`;
        akce.push('<button type="button" class="nv-tlacitko" data-uf-akce="odlozit">Netýká se</button>');
    } else if (u.druh === 'kontrola') {
        if (u.inputId) pridatNapovedu(vstup(hodnotaModelky(modelka, u.inputId)), x.hodnota, 'kontrola', x.hodnota);
        else {
            obsah = `<p class="uf-text">${esc(x.hodnota)}</p>`;
            akce.push(`<button type="button" class="nv-tlacitko" data-uf-akce="hlavni" title="Otevřít, kde se údaj opravuje">Opravit…</button>`);
        }
        const dalsi = [x.duvod, x.zdroj && uceni.popisZdroje(x.zdroj)].filter(Boolean).join(' · ');
        if (dalsi) obsah += `<small class="uf-zprava">${esc(dalsi)}</small>`;
        akce.push('<button type="button" class="nv-tlacitko" data-uf-akce="odlozit" title="Údaj je pravdivý – kontrola se z toho poučí">V pořádku</button>');
    } else if (u.druh === 'navrh') {
        const n = x.navrh;
        const text = `návrh ${procent(x.jistota)} %`;
        const vysvetleni = [x.album, x.duvod, x.zdrojPopis && `✦ ${x.zdrojPopis}`].filter(Boolean).join(' · ');
        if (u.inputId) pridatNapovedu(vstup(hodnotaNavrhuPole(modelka, n)), text, 'navrh', vysvetleni);
        else obsah = `<p class="uf-text"><b>${esc(hodnotaNavrhu(n))}</b> <small class="uf-navrh">${esc(text)}</small></p>`;
        if (vysvetleni) obsah += `<small class="uf-zprava">${esc(vysvetleni)}</small>`;
        akce.push(`<button type="button" class="nv-tlacitko nv-prijmout uf-ano" data-uf-akce="prijmout" title="${u.inputId ? 'Uložit hodnotu z pole (změněná se zapamatuje jako oprava)' : 'Přijmout návrh'}" aria-label="Přijmout">✓</button>`,
            '<button type="button" class="nv-tlacitko uf-ne" data-uf-akce="odmitnout" title="Odmítnout tuto hodnotu" aria-label="Odmítnout">✕</button>');
        if (!u.inputId) akce.push('<button type="button" class="nv-tlacitko" data-uf-akce="upravit">Upravit…</button>');
    } else {
        // Album, cover, centerfold: otevře se okno; alba každé zvlášť
        obsah = `<p class="uf-text">${esc(x.hodnota)}</p>${x.duvod ? `<small class="uf-zprava">${esc(x.duvod)}</small>` : ''}`;
        const alba = (x.alba || []).filter(a => !a.netykaSe).slice(0, 4);
        if (alba.length) alba.forEach((a, i) => akce.push(`<button type="button" class="nv-tlacitko nv-prijmout" data-uf-album="${i}" title="Otevřít album v profilu modelky">✎ ${esc(nazevAlba(a.album, a.typ))}</button>`));
        else akce.push(`<button type="button" class="nv-tlacitko nv-prijmout" data-uf-akce="hlavni">${esc(textAkce(x, s))}…</button>`);
        akce.push(`<button type="button" class="nv-tlacitko" data-uf-akce="odlozit">${s.druh === 'vydani' ? 'Nezajímá mě' : 'Netýká se'}</button>`);
    }
    radek.innerHTML = `<span class="uf-stitek">${predpona}${esc(velke(u.popis))}</span><div class="uf-obsah">${obsah}</div><div class="uf-akce">${akce.join('')}</div>`;
    if (pole) radek.querySelector('.uf-obsah').prepend(pole);
    return radek;
}

function obnovitSrdicka() {
    const obal = cast('karta')?.querySelector('[data-uf-hodnoceni]');
    if (!obal) return;
    obnovitSrdickaModelky(obal.querySelector('.hearts'), hodnoceni.nove);
    obal.setAttribute('aria-valuenow', String(hodnoceni.nove));
    obal.setAttribute('aria-valuetext', textSrdicek(hodnoceni.nove));
}

// Srdíčka klikem na půlku (stejná hodnota podruhé je zruší)
function nastavitSrdicka(n) {
    hodnoceni.nove = hodnoceni.nove === n ? 0 : n;
    obnovitSrdicka();
}

// Srdíčka klávesou: 1–5 celá, stejná číslice znovu přidá půlku, 0 zruší, ←/→ po půlce (lib/srdicka.js)
function srdickaKlavesou(klavesa) {
    hodnoceni.nove = hodnotaPoKlavese(hodnoceni.nove, klavesa) ?? hodnoceni.nove;
    obnovitSrdicka();
}

const FOKUSOVATELNE_UKOLU = 'input:not([type="hidden"]):not(.kategorie-jina), select, [data-uf-hodnoceni], .kategorie-vyber .chip, button';

function zameritPrvni() {
    const karta = cast('karta');
    /** @type {HTMLElement} */ (karta?.querySelector(`.uf-ukoly :is(${FOKUSOVATELNE_UKOLU})`) || karta?.querySelector('[data-uf-ulozit]'))?.focus({ preventScroll: true });
}

// Enter: na první prvek dalšího úkolu, za posledním na „Uložit a další“
function dalsiPole(prvek) {
    if (prvek.dataset.pole) prevestPole(cast('karta'), prvek);
    const radky = [...cast('karta').querySelectorAll('[data-ukol]')];
    const dalsi = radky.slice(radky.indexOf(prvek.closest('[data-ukol]')) + 1).map(r => r.querySelector(FOKUSOVATELNE_UKOLU)).find(Boolean);
    /** @type {HTMLElement} */ (dalsi || cast('karta').querySelector('[data-uf-ulozit]'))?.focus();
}

// Esc: pole zpět na hodnotu, se kterou se karta otevřela (návrh, nález, prázdné)
function vratitPole(prvek) {
    prvek.value = prvek.dataset.vychozi ?? '';
}

// ——— Změny a ukládání ———

const zmenenaPole = () => /** @type {HTMLInputElement[]} */ ([...(cast('karta')?.querySelectorAll('[data-pole]') || [])])
    .filter(p => p.value.trim() !== (p.dataset.puvodni ?? '').trim());
const rozepsano = () => otevreno && (zmenenaPole().length > 0 || hodnoceni.nove !== hodnoceni.puvodni);
const ukolPole = prvek => ukoly.find(u => u.inputId && u.inputId === prvek.dataset.pole);
const zameritNaKarte = pole => /** @type {HTMLElement} */ (cast('karta')?.querySelector(`[data-pole="${pole}"]`))?.focus();

// Uložení karty: změněná pole a srdíčka; vrací, zda se povedlo (bez změn true)
async function ulozitKartu() {
    const s = skupina;
    if (!s || s.druh !== 'modelka') return true;
    const zmenena = zmenenaPole();
    const srdicka = hodnoceni.nove !== hodnoceni.puvodni;
    if (!zmenena.length && !srdicka) return true;
    const chyba = chybaPoli(zmenena);
    if (chyba) {
        oznamit(chyba);
        return false;
    }
    if (zmenena.length && !await ulozitPoleModelky(s.id, zmenena, { navrh: p => ukolPole(p)?.druh === 'navrh' ? ukolPole(p).polozka.navrh : null, zamerit: zameritNaKarte })) return false;
    if (srdicka) {
        let ok = false;
        try {
            ok = await SetHodnoceni(s.id, hodnoceni.nove);
        } catch { /* oznámí se níž */ }
        if (!ok) {
            oznamit('Hodnocení se nepodařilo uložit.');
            return false;
        }
        const m = stav.prehledModelky.get(s.id);
        if (m) m.hodnoceni = hodnoceni.nove;
        hodnoceni.puvodni = hodnoceni.nove;
    }
    oznamit(`${s.jmeno}: uloženo.`);
    return true;
}

// Klíč skupiny o krok dál nebo zpět ve frontě; karta, která už ve frontě není, uvolnila své místo další
function klicVedle(smer) {
    const f = fronta();
    const i = f.findIndex(v => v.skupina.klic === klic);
    if (i >= 0) return f[i + smer]?.skupina.klic || '';
    return (smer > 0 ? f[Math.min(poradi, f.length - 1)] : f[poradi - 1])?.skupina.klic || '';
}

// Na jinou skupinu (Zpět, Přeskočit, klik ve frontě); u rozepsaných změn se zeptá
async function prejit(cil) {
    const novy = typeof cil === 'number' ? klicVedle(cil) : cil;
    if (!novy || novy === klic) {
        if (typeof cil === 'number') oznamit(cil > 0 ? 'Dál už ve frontě nic není.' : 'Tohle je začátek fronty.');
        return;
    }
    if (!await zahoditZmeny()) return;
    nastavitSkupinu(novy);
    vykreslit();
    zameritPrvni();
}

async function ulozitADalsi() {
    if (ukladam) return;
    ukladam = true;
    try {
        const zmena = rozepsano();
        if (!await ulozitKartu()) return;
        const dalsi = klicVedle(1);
        // Nové načtení srovná frontu s backendem (kontrola se přepočítá, přijaté návrhy zmizí)
        if (zmena) await api.nacist();
        if (!otevreno) return;
        if (!dalsi) {
            oznamit('To byla poslední položka ve frontě.');
            return;
        }
        nastavitSkupinu(dalsi);
        vykreslit();
        zameritPrvni();
    } finally {
        ukladam = false;
    }
}

function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const radek = /** @type {HTMLElement} */ (cil.closest('[data-ukol]'));
    const u = radek && ukoly.find(x => x.klic === radek.dataset.ukol);
    const s = skupina;
    if (cil.closest('[data-uf-ulozit]')) ulozitADalsi();
    else if (cil.closest('[data-uf-predchozi]')) prejit(-1);
    else if (cil.closest('[data-uf-preskocit]')) prejit(1);
    else if (cil.closest('[data-uf-skok]')) prejit(/** @type {HTMLElement} */ (cil.closest('[data-uf-skok]')).dataset.ufSkok);
    else if (cil.closest('[data-uf-prepnout]')) {
        const obal = cast('obal-fronty');
        obal.classList.toggle('otevrena');
        cil.closest('[data-uf-prepnout]').setAttribute('aria-expanded', String(obal.classList.contains('otevrena')));
    } else if (cil.closest('[data-uf-srdce]') && u) {
        nastavitSrdicka(Number(/** @type {HTMLElement} */ (cil.closest('[data-uf-srdce]')).dataset.ufSrdce));
    } else if (cil.closest('[data-uf-album]') && u) {
        const alba = (u.polozka.alba || []).filter(a => !a.netykaSe);
        api.hlavniAkce(u.polozka, s, alba[Number(/** @type {HTMLElement} */ (cil.closest('[data-uf-album]')).dataset.ufAlbum)]);
    } else if (cil.closest('[data-uf-akce]') && u) {
        const akce = /** @type {HTMLElement} */ (cil.closest('[data-uf-akce]')).dataset.ufAkce;
        if (akce === 'odlozit') api.odlozit(u.polozka, s, true);
        else if (akce === 'hlavni') api.hlavniAkce(u.polozka, s);
        else if (akce === 'prijmout') ulozitNavrh(u.polozka.navrh, /** @type {HTMLInputElement} */ (radek.querySelector('[data-pole]')), s.jmeno, { zamerit: zameritNaKarte });
        else if (akce === 'odmitnout') navrhy.odmitnout(u.polozka.navrh);
        else if (akce === 'upravit') navrhy.upravit(u.polozka.navrh);
    }
}
