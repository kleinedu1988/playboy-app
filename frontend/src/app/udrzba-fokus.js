// Soustředěný režim Údržby: jedna modelka (nebo číslo) velká se všemi úkoly k vyřízení na místě a vpravo fronta
// „Na řadě“ podle filtru a řazení seznamu. Chybějící údaj má pole stejného druhu jako formulář modelky (kopie
// z doplneni.js), nález kontroly pole s hodnotou k opravě, návrh pole s navrženou hodnotou a ✓/✕; co na místě
// nejde (text a vydání alba, cover, centerfold), otevře své okno. „Uložit a další“ zapíše jen změněná pole
// (UpdateModelka s celou modelkou, srdíčka SetHodnoceni) a otevře další položku; ✓, ✕, Netýká se a V pořádku
// se ukládají hned. Karta se přestaví jen při změně úkolů a rozepsané hodnoty přitom zůstanou.
import { SetHodnoceni, UpdateModelka } from './backend';
import { esc, nazevAlba, platneDatum, sklonovat } from '../lib/format';
import { hodnotaNavrhu, procent, souhrnFronty, textAkce, ukolyFokusu } from '../lib/udrzba';
import { stav } from './stav';
import { vsechnyModelky } from './mezipamet';
import { odkazJeVPoradku } from './navigace';
import { kopiePole, prevestPole, zapsatPole } from './doplneni';
import { naplnitNapovedu, poleModelky, potvrdit } from './formular-modelky';
import { srovnatSeznam } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import * as navrhy from './navrhy';
import * as uceni from './uceni';

// Fronta vpravo ukáže kousek před kartou a tolik za ní (delší fronta je jen počet)
const PRED = 2;
const ZA = 40;

// Co Údržba (udrzba.js) půjčuje: model, výběr, akce položek, načtení a vykreslení skupiny
let api = {
    model: () => null, vyber: () => [], hlavniAkce: async (_x, _s, _album) => {}, odlozit: async (_x, _s, _ano) => {}, nacist: async () => {},
    poZmene: (_klic) => {}, obrazek: (_s, _trida) => '', podtitulek: (_s) => '', modelka: (_s) => null, viditelna: () => false, poZavreni: () => {},
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

const vlastnostPole = id => poleModelky.find(p => p[1] === id)?.[0];
const typPole = id => poleModelky.find(p => p[1] === id)?.[2] || 'text';
const velke = t => t.charAt(0).toUpperCase() + t.slice(1);
const cast = jmeno => /** @type {HTMLElement} */ (kontejner?.querySelector(`[data-uf="${jmeno}"]`));
// Skupiny výběru, které mají něco k vyřízení (vyřízené se v soustředěném režimu přeskakují)
const fronta = () => api.vyber().filter(v => v.polozky.some(x => !x.netyka));

export const otevreny = () => otevreno;

export function pripravit(funkce) {
    api = funkce;
    // Klávesy: Ctrl+Enter uloží a otevře další, PageUp/PageDown a Alt+←/→ předchozí a další, Esc zpět na seznam.
    // Zachytává se předem, aby Esc nezavřel nic jiného a Alt+← nešlo „zpět“; otevřené okno, nabídka a přehled
    // zkratek mají přednost.
    document.addEventListener('keydown', (e) => {
        if (!otevreno || !api.viditelna() || stav.zamceno) return;
        if (document.querySelector('.modal-overlay:not(.hidden), #lightbox:not(.hidden), #zkratky:not(.hidden), #contextMenu:not(.hidden)')) return;
        let akce = null;
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Opuštění pole nejdřív převede rozepsanou míru (událost change)
            akce = () => { /** @type {HTMLElement} */ (document.activeElement)?.blur(); ulozitADalsi(); };
        } else if (e.key === 'Escape') akce = () => zavrit();
        else if ((e.key === 'PageDown' && !e.altKey) || (e.altKey && e.key === 'ArrowRight')) akce = () => prejit(1);
        else if ((e.key === 'PageUp' && !e.altKey) || (e.altKey && e.key === 'ArrowLeft')) akce = () => prejit(-1);
        if (!akce) return;
        e.preventDefault();
        e.stopPropagation();
        akce();
    }, true);
}

// Otevření na skupině (Začít postupně, ⋯ řádku, klávesa S)
export function otevrit(prvek, klicSkupiny) {
    kontejner = prvek;
    if (!kontejner.querySelector('[data-uf="karta"]')) postavitKostru();
    if (!otevreno) naplnitNapovedu();
    otevreno = true;
    stav.udrzbaFokus = true;
    kontejner.classList.remove('hidden');
    nastavitSkupinu(klicSkupiny);
    vykreslit();
    // Karta nahoru do okna a kurzor do prvního pole
    const oblast = document.querySelector('main');
    oblast.scrollTop += kontejner.getBoundingClientRect().top - oblast.getBoundingClientRect().top - 8;
    zameritPrvni();
}

function nastavitSkupinu(klicSkupiny) {
    klic = klicSkupiny;
    podpis = '';
    hodnoceni = { puvodni: 0, nove: 0 };
}

// Zpět na seznam (Esc, „← Seznam“); u rozepsaných změn se zeptá
export async function zavrit({ bezDotazu = false } = {}) {
    if (!otevreno) return;
    if (!bezDotazu && !await zahoditZmeny()) return;
    otevreno = false;
    stav.udrzbaFokus = false;
    kontejner.classList.add('hidden');
    podpis = '';
    api.poZavreni();
}

const zahoditZmeny = async () => !rozepsano()
    || potvrdit('Zahodit změny?', 'Rozepsané údaje na kartě se neuloží.', 'Zahodit', { nebezpecne: true });

function postavitKostru() {
    kontejner.innerHTML = `
        <div class="uf-lista">
            <button type="button" class="ud-nastroj" data-uf-zpet title="Zpět na seznam (Esc)">← Seznam</button>
            <span data-uf="popis"></span>
        </div>
        <div class="uf-mrizka">
            <section class="uf-karta" data-uf="karta" aria-label="Úkoly na kartě"></section>
            <aside class="uf-fronta" data-uf="obal-fronty" aria-label="Na řadě">
                <button type="button" class="uf-fronta-hlava" data-uf-prepnout aria-expanded="false"><span>Na řadě</span><b data-uf="pocet"></b></button>
                <div class="uf-fronta-seznam" data-uf="fronta" role="list"></div>
                <p class="uf-fronta-pata" data-uf="pata-fronty"></p>
            </aside>
        </div>`;
    kontejner.addEventListener('click', klik);
    kontejner.addEventListener('change', (e) => {
        const prvek = /** @type {HTMLInputElement} */ (e.target);
        if (prvek.dataset?.pole) prevestPole(cast('karta'), prvek);
    });
}

// ——— Vykreslení ———

// Po každé změně dat (a filtru): fronta na místě, karta jen při změně úkolů
export function vykreslit() {
    if (!otevreno || !kontejner) return;
    const f = fronta();
    const i = f.findIndex(v => v.skupina.klic === klic);
    if (i >= 0) {
        poradi = i;
        skupina = f[i].skupina;
    } else if (!skupina || skupina.klic !== klic) {
        skupina = api.model()?.skupiny.find(s => s.klic === klic) || null;
    }
    const nove = i >= 0 ? ukolyFokusu(f[i].polozky, vlastnostPole) : [];
    const novyPodpis = `${klic}#${nove.map(u => u.klic).join(',')}`;
    if (novyPodpis !== podpis) {
        ukoly = nove;
        prestavetKartu();
        podpis = novyPodpis;
    }
    vykreslitFrontu(f, i);
    const filtr = document.querySelector(`.ud-bok [data-udrzba-filtr="${stav.udrzbaFiltr}"] span`)?.textContent || '';
    cast('popis').textContent = `Soustředěný režim${filtr && stav.udrzbaFiltr !== 'vse' ? ` · ${filtr}` : ''}${stav.udrzbaHledat ? ` · hledání „${stav.udrzbaHledat}“` : ''}`
        + (i >= 0 ? ` · ${i + 1} z ${f.length}` : '');
}

function vykreslitFrontu(f, i) {
    const od = Math.max(0, (i >= 0 ? i : poradi) - PRED);
    const ukazat = f.slice(od, od + PRED + ZA + 1);
    srovnatSeznam(cast('fronta'), ukazat.map(({ skupina: s, polozky }) => {
        const aktivni = polozky.filter(x => !x.netyka).length;
        return { klic: s.klic, html: `<button type="button" class="uf-polozka ${s.klic === klic ? 'on' : ''}" data-klic="${esc(s.klic)}" data-uf-skok="${esc(s.klic)}" role="listitem"
            ${s.klic === klic ? 'aria-current="true"' : ''} title="${esc(`${s.jmeno}: ${sklonovat(aktivni, 'úkol', 'úkoly', 'úkolů')}`)}">
            ${api.obrazek(s)}<span class="uf-polozka-text"><b>${esc(s.jmeno)}</b><small>${esc(souhrnFronty(polozky))}</small></span><span class="uf-pocet">${aktivni}</span></button>` };
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
        karta.innerHTML = '<p class="uf-prazdne">Ve výběru už nic nezbývá.</p>';
        return;
    }
    karta.innerHTML = `
        <header class="uf-hlava">
            ${api.obrazek(s, 'uf-foto')}
            <div class="uf-jmeno"><h4>${esc(s.jmeno)}</h4>
                <small>${[api.podtitulek(s), ukoly.length ? sklonovat(ukoly.length, 'úkol', 'úkoly', 'úkolů') : 'vše vyřízeno'].filter(Boolean).map(esc).join(' · ')}</small></div>
            <div class="uf-navigace">
                <button type="button" class="ud-nastroj" data-uf-predchozi title="Předchozí ve frontě (PageUp, Alt+←)">← Předchozí</button>
                <button type="button" class="ud-nastroj" data-uf-preskocit title="Další ve frontě bez uložení (PageDown, Alt+→)">Přeskočit</button>
            </div>
        </header>
        <div class="uf-ukoly"></div>
        <footer class="uf-pata">
            <span>Ctrl+Enter uloží a otevře další · Esc zpět na seznam</span>
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
        /** @type {HTMLElement} */ (radek?.querySelector('input:not([type="hidden"]), select, button') || karta.querySelector('[data-uf-ulozit]'))?.focus({ preventScroll: true });
    }
}

// Hodnota údaje modelky do pole (nula číselného pole je prázdné pole, výběr ano/ne potřebuje i nulu)
function hodnotaModelky(modelka, vlastnost, inputId) {
    const v = modelka?.[vlastnost];
    if (document.getElementById(inputId)?.tagName === 'SELECT') return v === undefined || v === null ? '' : String(v);
    if (typPole(inputId) === 'cislo') return v ? String(v) : '';
    return String(v ?? '');
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
        obsah = `<div class="hearts uf-srdicka" role="group" aria-label="Hodnocení">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="heart" data-uf-srdce="${n}" title="${n} z 5" aria-label="${n} z 5"></button>`).join('')}</div>`;
        akce.push('<button type="button" class="nv-tlacitko" data-uf-akce="odlozit">Netýká se</button>');
    } else if (u.druh === 'kontrola') {
        if (u.inputId) vstup(hodnotaModelky(modelka, u.vlastnost, u.inputId));
        else {
            obsah = `<p class="uf-text">${esc(x.hodnota)}</p>`;
            akce.push(`<button type="button" class="nv-tlacitko" data-uf-akce="hlavni" title="Otevřít, kde se údaj opravuje">Opravit…</button>`);
        }
        obsah += `<small class="uf-zprava">${esc([u.inputId ? x.hodnota : '', x.duvod, x.zdroj && uceni.popisZdroje(x.zdroj)].filter(Boolean).join(' · '))}</small>`;
        akce.push('<button type="button" class="nv-tlacitko" data-uf-akce="odlozit" title="Údaj je pravdivý – kontrola se z toho poučí">V pořádku</button>');
    } else if (u.druh === 'navrh') {
        const n = x.navrh;
        if (u.inputId) vstup(String(n.hodnota ?? ''));
        else obsah = `<p class="uf-text"><b>${esc(hodnotaNavrhu(n))}</b></p>`;
        obsah += `<small class="uf-navrh">${esc([x.album, `návrh ${procent(x.jistota)} %${x.duvod ? ` – ${x.duvod}` : ''}`].filter(Boolean).join(' · '))}</small>`;
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
    cast('karta')?.querySelectorAll('[data-uf-srdce]').forEach(b => {
        const n = Number(/** @type {HTMLElement} */ (b).dataset.ufSrdce);
        b.classList.toggle('on', n <= hodnoceni.nove);
        b.setAttribute('aria-pressed', String(n <= hodnoceni.nove));
    });
}

function zameritPrvni() {
    const karta = cast('karta');
    /** @type {HTMLElement} */ (karta?.querySelector('.uf-ukoly input:not([type="hidden"]), .uf-ukoly select, .uf-ukoly .kategorie-vyber .chip, .uf-ukoly button') || karta?.querySelector('[data-uf-ulozit]'))?.focus({ preventScroll: true });
}

// ——— Změny a ukládání ———

const zmenenaPole = () => /** @type {HTMLInputElement[]} */ ([...(cast('karta')?.querySelectorAll('[data-pole]') || [])])
    .filter(p => p.value.trim() !== (p.dataset.puvodni ?? '').trim());
const rozepsano = () => otevreno && (zmenenaPole().length > 0 || hodnoceni.nove !== hodnoceni.puvodni);
const ukolPole = prvek => ukoly.find(u => u.inputId && u.inputId === prvek.dataset.pole);

// Změněná pole do modelky: stejné převody a kontroly jako formulář modelky, jedno UpdateModelka s celou modelkou.
// Návrh uložený s jinou hodnotou si zapamatuje učení. Vrací, zda se povedlo.
async function ulozitPole(prvky) {
    const s = skupina;
    const mistni = stav.prehledModelky.get(s.id) || (await vsechnyModelky()).find(m => m.id === s.id);
    if (!mistni) return false;
    const modelka = { ...mistni };
    zapsatPole(prvky, modelka, { prazdne: true });
    const chyba = (pole, text) => {
        /** @type {HTMLElement} */ (cast('karta').querySelector(`[data-pole="${pole}"]`))?.focus();
        oznamit(text);
        return false;
    };
    for (const [vlastnost, pole, nazev] of [['narozeniDatum', 'inputNarozeniDatum', 'narození'], ['umrtiDatum', 'inputUmrtiDatum', 'úmrtí']]) {
        if (!platneDatum(modelka[vlastnost])) return chyba(pole, `Datum ${nazev} napiš jako RRRR-MM-DD, RRRR-MM nebo jen rok RRRR.`);
    }
    if (modelka.narozeniDatum && modelka.umrtiDatum && modelka.umrtiDatum.slice(0, modelka.narozeniDatum.length) < modelka.narozeniDatum.slice(0, modelka.umrtiDatum.length)) {
        return chyba('inputUmrtiDatum', 'Datum úmrtí je před datem narození.');
    }
    if (prvky.some(p => p.dataset.pole === 'inputDriveID') && !await odkazJeVPoradku(modelka.coverId)) return chyba('inputDriveID', 'Titulní fotka: odkaz se neuložil.');
    let ok = false;
    try {
        ok = await UpdateModelka(modelka);
    } catch { /* oznámí se níž */ }
    if (!ok) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return false;
    }
    prvky.forEach(p => {
        const u = ukolPole(p);
        if (u?.druh === 'navrh') uceni.zaznamenatOpravuNavrhu(u.polozka.navrh, modelka[u.vlastnost]);
        p.dataset.puvodni = p.value;
    });
    // Místní data Přehledu: fronta se přepočítá hned, bez čekání na nové načtení
    Object.assign(mistni, modelka);
    return true;
}

// Uložení karty: změněná pole a srdíčka; vrací, zda se povedlo (bez změn true)
async function ulozitKartu() {
    const s = skupina;
    if (!s || s.druh !== 'modelka') return true;
    const zmenena = zmenenaPole();
    const srdicka = hodnoceni.nove !== hodnoceni.puvodni;
    if (!zmenena.length && !srdicka) return true;
    if (zmenena.length && !await ulozitPole(zmenena)) return false;
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

// Na jinou skupinu (Předchozí, Přeskočit, klik ve frontě); u rozepsaných změn se zeptá
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

// ✓ u návrhu: nezměněná hodnota se přijme (PrijmoutNavrh), změněná se uloží jako údaj a zapamatuje jako oprava
async function prijmoutNavrh(u, radek) {
    const n = u.polozka.navrh;
    const pole = /** @type {HTMLInputElement} */ (radek.querySelector('[data-pole]'));
    if (!pole || pole.value.trim() === String(n.hodnota ?? '').trim()) return navrhy.prijmout(n);
    if (!pole.value.trim()) {
        oznamit('Pole je prázdné: napiš hodnotu, nebo návrh odmítni (✕).');
        pole.focus();
        return;
    }
    if (!await ulozitPole([pole])) return;
    oznamit(`Uloženo s opravou: ${n.popis || n.pole} „${pole.value.trim()}“ – ${skupina.jmeno}.`);
    // Opravený návrh backend už nenabídne; z fronty zmizí hned (karta se přestaví, ostatní rozepsané zůstane)
    navrhy.odebratOpraveny(n);
}

function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const radek = /** @type {HTMLElement} */ (cil.closest('[data-ukol]'));
    const u = radek && ukoly.find(x => x.klic === radek.dataset.ukol);
    const s = skupina;
    if (cil.closest('[data-uf-zpet]')) zavrit();
    else if (cil.closest('[data-uf-ulozit]')) ulozitADalsi();
    else if (cil.closest('[data-uf-predchozi]')) prejit(-1);
    else if (cil.closest('[data-uf-preskocit]')) prejit(1);
    else if (cil.closest('[data-uf-skok]')) prejit(/** @type {HTMLElement} */ (cil.closest('[data-uf-skok]')).dataset.ufSkok);
    else if (cil.closest('[data-uf-prepnout]')) {
        const obal = cast('obal-fronty');
        obal.classList.toggle('otevrena');
        cil.closest('[data-uf-prepnout]').setAttribute('aria-expanded', String(obal.classList.contains('otevrena')));
    } else if (cil.closest('[data-uf-srdce]') && u) {
        const n = Number(/** @type {HTMLElement} */ (cil.closest('[data-uf-srdce]')).dataset.ufSrdce);
        hodnoceni.nove = hodnoceni.nove === n ? 0 : n;
        obnovitSrdicka();
    } else if (cil.closest('[data-uf-album]') && u) {
        const alba = (u.polozka.alba || []).filter(a => !a.netykaSe);
        api.hlavniAkce(u.polozka, s, alba[Number(/** @type {HTMLElement} */ (cil.closest('[data-uf-album]')).dataset.ufAlbum)]);
    } else if (cil.closest('[data-uf-akce]') && u) {
        const akce = /** @type {HTMLElement} */ (cil.closest('[data-uf-akce]')).dataset.ufAkce;
        if (akce === 'odlozit') api.odlozit(u.polozka, s, true);
        else if (akce === 'hlavni') api.hlavniAkce(u.polozka, s);
        else if (akce === 'prijmout') prijmoutNavrh(u, radek);
        else if (akce === 'odmitnout') navrhy.odmitnout(u.polozka.navrh);
        else if (akce === 'upravit') navrhy.upravit(u.polozka.navrh);
    }
}
