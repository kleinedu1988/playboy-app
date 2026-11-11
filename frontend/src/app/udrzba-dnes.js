// Údržba › Dnes (ROADMAP 1.51): krátká dávka toho nejcennějšího napříč režimy místo přepínání mezi nimi.
// Nahoře pokrok dne (kolik úkolů dnes ubylo, cíl asi 30 ≈ 15 minut) a série dní; pod tím nejcennější modelky
// a čísla z fronty (otevřou se Po modelkách) a rychlé dávky z ostatních režimů s počty; dole panel Na pozadí
// se všemi výpočty (náhledy, obsah fotek, otisky, otočení, kvalita, průchod webem) – průběh, spuštění a zastavení.
// Výpočty pokroku a výběru jsou v lib/udrzba-dnes.js; pokrok a dny se pamatují v okně (localStorage).
import {
    GetNavrhyZWebu, GetOtoceneFotky, GetSlabeFotky, GetStavKvality, GetStavObsahu, GetStavOtisku, GetStavOtoceni, GetStavPruchoduWebem,
    GetStavStahovaniNahledu, GetTitulniBezVyrezu, PozastavitOtisky, PrerusitKontroluKvality, PrerusitKontroluOtoceni, PrerusitPruchodWebem,
    SpustitKontroluKvality, SpustitKontroluOtoceni, SpustitOtisky, SpustitStahovaniNahledu, ZapnoutObsah, ZastavitObsah, ZastavitStahovaniNahledu,
} from './backend';
import { esc, sklonovat } from '../lib/format';
import { CIL_DNE, DAVKA, pokrokDne, pridatDen, serieDni, vybratSkupiny } from '../lib/udrzba-dnes';
import { nastavitHtml } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

const STARY_PRUCHOD_DNI = 60;

/** @type {{ viditelna: () => boolean, model: () => any, otevritSkupinu: (klic: string) => void, rezim: (r: string) => void, popisSkupiny: (s: any) => string }} */
let api = { viditelna: () => false, model: () => null, otevritSkupinu: () => {}, rezim: () => {}, popisSkupiny: () => '' };
let kontejner = null;
/** @type {Record<string, number | null>} */
let pocty = { otocene: null, lepsi: null, vyrezy: null, web: null };
/** @type {Record<string, any>} */
let ulohy = {};
let casovac = null;
let zastarale = true;

const dnes = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const cist = (klic, vychozi) => { try { return JSON.parse(localStorage.getItem(klic) || 'null') ?? vychozi; } catch { return vychozi; } };
const zapsat = (klic, hodnota) => { try { localStorage.setItem(klic, JSON.stringify(hodnota)); } catch { /* jen se nezapamatuje */ } };

export function pripravit(funkce) {
    api = { ...api, ...funkce };
}

export function zastarat() {
    zastarale = true;
    if (kontejner && api.viditelna()) nacist();
}

export function zobrazit(prvek) {
    kontejner = prvek;
    if (!kontejner.dataset.udDnesObsluha) {
        kontejner.dataset.udDnesObsluha = '1';
        kontejner.addEventListener('click', klik);
    }
    vykreslit();
    if (zastarale) nacist();
    else nacistUlohy();
}

async function nacist() {
    zastarale = false;
    const [o, s, v, w] = await Promise.all([
        GetOtoceneFotky().catch(() => null), GetSlabeFotky().catch(() => null), GetTitulniBezVyrezu().catch(() => null), GetNavrhyZWebu().catch(() => null),
    ]);
    pocty = { otocene: o ? o.length : null, lepsi: s ? s.filter(x => x.lepsi).length : null, vyrezy: v ? v.length : null, web: w ? w.length : null };
    await nacistUlohy();
}

async function nacistUlohy() {
    const [nahledy, obsah, otisky, otoceni, kvalita, web] = await Promise.all([
        GetStavStahovaniNahledu(), GetStavObsahu(), GetStavOtisku(), GetStavOtoceni(), GetStavKvality(), GetStavPruchoduWebem(),
    ].map(p => p.catch(() => null)));
    ulohy = { nahledy, obsah, otisky, otoceni, kvalita, web };
    vykreslit();
    clearTimeout(casovac);
    const bezi = Object.values(ulohy).some(u => u?.bezi || ['stahovani', 'vypocet'].includes(u?.faze));
    if (bezi) casovac = setTimeout(() => { if (api.viditelna() && kontejner?.isConnected) nacistUlohy(); }, 3000);
}

function htmlPokroku(model) {
    const otevrenych = model.ukolu;
    const p = pokrokDne(cist('udrzbaDnes', null), dnes(), otevrenych);
    zapsat('udrzbaDnes', p);
    let dny = cist('udrzbaDny', []);
    if (p.vyrizeno > 0 && !dny.includes(p.den)) zapsat('udrzbaDny', dny = pridatDen(dny, p.den));
    const serie = serieDni(dny, p.den);
    const procento = Math.min(100, Math.round(p.vyrizeno / CIL_DNE * 100));
    return `<section class="ud-karta udd-pokrok" aria-label="Pokrok dne">
        <div class="udd-cisla"><b>${p.vyrizeno}</b><span>z ${CIL_DNE} úkolů dnes${p.vyrizeno >= CIL_DNE ? ' · hotovo na dnešek ✓' : ' · asi 15 minut práce'}</span></div>
        <span class="udd-pruh" style="--hotovo:${procento}%" role="progressbar" aria-valuemin="0" aria-valuemax="${CIL_DNE}" aria-valuenow="${Math.min(p.vyrizeno, CIL_DNE)}"></span>
        <p class="udd-serie">${serie ? `Série: ${sklonovat(serie, 'den', 'dny', 'dní')} v řadě` : 'Série začne prvním vyřízeným úkolem.'} · ve frontě ${sklonovat(otevrenych, 'otevřený úkol', 'otevřené úkoly', 'otevřených úkolů').replace(/^\d+/, otevrenych.toLocaleString('cs-CZ'))}</p>
    </section>`;
}

// Rychlé dávky z ostatních režimů: [klíč počtu, režim, text, popis]
const DAVKY = [
    ['otocene', 'fotky', 'Otočené fotky', 'otočit jedním klikem'],
    ['lepsi', 'fotky', 'Vyměnit za lepší', 'slabá fotka má ve sbírce lepší stejnou'],
    ['web', 'web', 'Z webu', 'přijmout nebo odmítnout rozdíl'],
    ['vyrezy', 'fotky', 'Výřezy titulních fotek', 'navrhnout výřez z postavy'],
];

function htmlUkolu(model) {
    const davky = DAVKY.filter(([k]) => pocty[k]);
    const rychlych = davky.reduce((s, [k]) => s + Math.min(DAVKA, pocty[k] || 0), 0);
    const skupiny = /** @type {any[]} */ (vybratSkupiny(model.skupiny, rychlych));
    const radky = skupiny.map(s => `<li><button type="button" class="udd-ukol" data-udd-skupina="${esc(s.klic)}">
            <b>${esc(s.jmeno)}</b><span>${esc(api.popisSkupiny(s))}</span><small>${sklonovat(s.aktivnich, 'úkol', 'úkoly', 'úkolů')}</small></button></li>`).join('');
    const htmlDavek = davky.map(([k, rezim, nazev, popis]) => `<button type="button" class="udd-davka" data-udd-rezim="${rezim}">
            <b>${pocty[k]}</b><span>${esc(nazev)}</span><small>${esc(popis)}</small></button>`).join('');
    if (!radky && !htmlDavek) return '<section class="ud-karta udd-ukoly"><p class="prazdno-male">Na dnešek není co dělat – fronta je prázdná.</p></section>';
    return `<section class="ud-karta udd-ukoly" aria-label="Dnešní dávka">
        ${radky ? `<h4>Nejcennější ve frontě <small>otevře se Po modelkách</small></h4><ol class="udd-seznam">${radky}</ol>` : ''}
        ${htmlDavek ? `<h4>Rychlé dávky</h4><div class="udd-davky">${htmlDavek}</div>` : ''}
    </section>`;
}

const procent = (h, c) => (c ? Math.floor(h / c * 100) : 0);
function radekUlohy(klic, nazev, { bezi, text, spustit = '', zastavit = '' }) {
    return `<li class="udd-uloha${bezi ? ' bezi' : ''}"><span class="udd-nazev">${esc(nazev)}</span><span class="udd-text">${text}</span>
        ${bezi && zastavit ? `<button type="button" class="btn btn-secondary btn-small" data-udd-zastavit="${klic}">${esc(zastavit)}</button>` : ''}
        ${!bezi && spustit ? `<button type="button" class="btn btn-secondary btn-small" data-udd-spustit="${klic}">${esc(spustit)}</button>` : ''}</li>`;
}

function htmlUloh() {
    const { nahledy, obsah, otisky, otoceni, kvalita, web } = ulohy;
    const cislo = n => (n || 0).toLocaleString('cs-CZ');
    const r = [];
    if (nahledy) r.push(radekUlohy('nahledy', 'Náhledy na disk', nahledy.bezi
        ? { bezi: true, text: `${cislo(nahledy.hotovo)} z ${cislo(nahledy.celkem)} (${procent(nahledy.hotovo, nahledy.celkem)} %)`, zastavit: 'Pozastavit' }
        : { bezi: false, text: 'stojí', spustit: 'Stáhnout chybějící' }));
    if (obsah) {
        const bezi = ['stahovani', 'vypocet'].includes(obsah.faze);
        r.push(radekUlohy('obsah', 'Obsah fotek', bezi
            ? { bezi, text: obsah.faze === 'stahovani' ? 'stahuje model' : `vektory ${cislo(obsah.hotovo)} z ${cislo(obsah.celkem)}`, zastavit: 'Pozastavit' }
            : { bezi, text: obsah.vektoru ? `${cislo(obsah.hotovo)} z ${cislo(obsah.celkem)} fotek má vektor` : 'vypnutý (Nastavení › Obsah fotek)', spustit: obsah.vektoru && obsah.hotovo < obsah.celkem ? 'Dopočítat' : '' }));
    }
    if (otisky) r.push(radekUlohy('otisky', 'Otisky (stejné fotky)', otisky.bezi
        ? { bezi: true, text: `${cislo(otisky.hotovo)} z ${cislo(otisky.celkem)}`, zastavit: 'Pozastavit' }
        : { bezi: false, text: `${cislo(otisky.hotovo)} z ${cislo(otisky.celkem)} fotek`, spustit: otisky.hotovo + otisky.chybne < otisky.celkem ? 'Dopočítat' : '' }));
    if (otoceni) r.push(radekUlohy('otoceni', 'Otočení', otoceni.bezi
        ? { bezi: true, text: `${cislo(otoceni.hotovo)} z ${cislo(otoceni.celkem)}`, zastavit: 'Přerušit' }
        : { bezi: false, text: otoceni.zapnuto ? `zkontrolováno ${cislo(otoceni.zkontrolovano)} z ${cislo(otoceni.fotek)}` : 'potřebuje Obsah fotek', spustit: otoceni.zapnuto && otoceni.zkontrolovano < otoceni.fotek ? 'Zkontrolovat zbylé' : '' }));
    if (kvalita) r.push(radekUlohy('kvalita', 'Kvalita fotek', kvalita.bezi
        ? { bezi: true, text: `${cislo(kvalita.hotovo)} z ${cislo(kvalita.celkem)}`, zastavit: 'Přerušit' }
        : { bezi: false, text: `změřeno ${cislo(kvalita.zkontrolovano)} z ${cislo(kvalita.fotek)}`, spustit: kvalita.mozna && kvalita.zkontrolovano < kvalita.fotek ? 'Změřit zbylé' : '' }));
    let pripominka = '';
    if (web) {
        const konec = web.konec ? new Date(web.konec.replace(' ', 'T')) : null;
        const dni = konec && !isNaN(+konec) ? Math.floor((Date.now() - +konec) / 86400000) : null;
        r.push(radekUlohy('web', 'Průchod webem', web.bezi
            ? { bezi: true, text: `${cislo(web.hotovo)} z ${cislo(web.celkem)}${web.aktualni ? ` · ${esc(web.aktualni)}` : ''}`, zastavit: 'Přerušit' }
            : { bezi: false, text: dni === null ? 'ještě neproběhl' : `naposledy před ${sklonovat(dni, 'dnem', 'dny', 'dny')}`, spustit: '' }));
        if (!web.bezi && (dni === null || dni >= STARY_PRUCHOD_DNI)) {
            pripominka = `<p class="udd-pripominka">${dni === null ? 'Průchod sbírkou proti webu ještě neproběhl.' : `Průchod webem je starý ${dni} dní.`} Spustíš ho v režimu <button type="button" class="link" data-udd-rezim="web">Z webu</button>.</p>`;
        }
    }
    return `<section class="ud-karta udd-pozadi" aria-label="Na pozadí"><h4>Na pozadí</h4>${pripominka}<ul class="udd-ulohy">${r.join('')}</ul></section>`;
}

export function vykreslit() {
    if (!kontejner) return;
    const model = api.model();
    if (!model) {
        nastavitHtml(kontejner, '<p class="prazdno-male">Načítám…</p>');
        return;
    }
    nastavitHtml(kontejner, `<div class="udd">${htmlPokroku(model)}${htmlUkolu(model)}${htmlUloh()}</div>`);
}

const SPUSTIT = {
    nahledy: () => SpustitStahovaniNahledu(), obsah: () => ZapnoutObsah(), otisky: () => SpustitOtisky(),
    otoceni: () => SpustitKontroluOtoceni(), kvalita: () => SpustitKontroluKvality(),
};
const ZASTAVIT = {
    nahledy: () => ZastavitStahovaniNahledu(), obsah: () => ZastavitObsah(), otisky: () => PozastavitOtisky(),
    otoceni: () => PrerusitKontroluOtoceni(), kvalita: () => PrerusitKontroluKvality(), web: () => PrerusitPruchodWebem(),
};

async function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const b = /** @type {HTMLElement | null} */ (cil.closest('[data-udd-skupina], [data-udd-rezim], [data-udd-spustit], [data-udd-zastavit]'));
    if (!b) return;
    if (b.dataset.uddSkupina) api.otevritSkupinu(b.dataset.uddSkupina);
    else if (b.dataset.uddRezim) api.rezim(b.dataset.uddRezim);
    else if (b.dataset.uddSpustit) {
        const ok = await SPUSTIT[b.dataset.uddSpustit]?.().catch(() => false);
        if (ok === false) oznamit('Nejde spustit: už běží, nebo není co dělat.');
        await nacistUlohy();
    } else if (b.dataset.uddZastavit) {
        await ZASTAVIT[b.dataset.uddZastavit]?.().catch(() => {});
        await nacistUlohy();
    }
}
