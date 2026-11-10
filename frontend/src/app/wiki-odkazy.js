// Odkazy [[…]] v textech (lib/odkazy.js, zminky.go): klik vede na modelku, číslo nebo fotografa (jinak hledá),
// po najetí myší vizitka; v profilu modelky a v detailu čísla sekce „Zmiňováno v…“ se všemi texty, které na ně
// odkazují; editor textu dostává návrhy pro našeptávač po napsání „[[“.
import { GetFotografove, GetKalendar, GetZminky } from './backend';
import { esc, nazevAlba, nazevVydani, obrazek, sklonovat, titulCisla } from '../lib/format';
import { cilOdkazu } from '../lib/odkazy';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { adresaTitulni, VELIKOST_NAHLEDU } from './obrazky';
import { otevritProfilPodleId } from './cover';
import { otevritFotografa, otevritVydani } from './vydani';
import { otevritClanek } from './clanky';
import { hledatHodnotu } from './galerie';
import { nastavitZdrojOdkazu } from '../ui/editor-textu';
import { naCss } from '../ui/vzhled';

/** @type {Promise<string[]> | null} */
let fotografove = null;
/** @type {Promise<any[]> | null} */
let kalendar = null;
const nacistFotografy = () => (fotografove ||= GetFotografove().then(f => f || []).catch(() => { fotografove = null; return []; }));
const nacistKalendar = () => (kalendar ||= GetKalendar().then(k => k || []).catch(() => { kalendar = null; return []; }));

async function cil(text) {
    const [modelky, foto] = await Promise.all([vsechnyModelky(), nacistFotografy()]);
    return cilOdkazu(text, modelky, foto);
}

async function otevritOdkaz(text) {
    const c = await cil(text);
    if (c.druh === 'vydani') otevritVydani(c.vydani);
    else if (c.druh === 'modelka') otevritProfilPodleId(c.id);
    else if (c.druh === 'fotograf') otevritFotografa(c.jmeno);
    else hledatHodnotu(c.text);
}

// ——— Vizitka při najetí ———

let vizitka = null;
let casovac = 0;
let nadOdkazem = null;

function zavritVizitku() {
    clearTimeout(casovac);
    nadOdkazem = null;
    vizitka?.classList.add('hidden');
}

async function ukazatVizitku(odkaz) {
    const c = await cil(odkaz.dataset.wiki);
    if (nadOdkazem !== odkaz || !odkaz.isConnected) return;
    let html = '';
    if (c.druh === 'modelka') {
        const m = (await vsechnyModelky()).find(x => x.id === c.id);
        if (!m) return;
        const udaje = [m.narozeniDatum ? `* ${m.narozeniDatum.slice(0, 4)}` : '', m.narodnost, (m.vydani || [])[0] ? `${titulCisla(m.vydani[0], 'kratky')} ${nazevVydani(m.vydani[0])}` : '']
            .filter(Boolean).join(' · ');
        html = `<img class="vz-foto" src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
            <div><b>${esc(m.jmeno)}</b>${udaje ? `<small>${esc(udaje)}</small>` : ''}<small>${sklonovat(m.pocetFotek || 0, 'fotka', 'fotky', 'fotek')}</small></div>`;
    } else if (c.druh === 'vydani') {
        const k = (await nacistKalendar()).find(x => x.vydani === c.vydani);
        html = `${k?.nahled ? `<img class="vz-foto" src="${esc(obrazek(k.nahled, VELIKOST_NAHLEDU))}" alt="" draggable="false" />` : ''}
            <div><b>${esc(nazevVydani(c.vydani))}</b>${k?.modelka ? `<small>${esc(titulCisla(c.vydani, 'kratky'))}: ${esc(k.modelka)}</small>` : ''}${!k ? '<small>Ve sbírce zatím bez coveru a centerfoldu.</small>' : ''}</div>`;
    } else if (c.druh === 'fotograf') {
        html = `<div><b>${esc(c.jmeno)}</b><small>fotograf · klik otevře jeho alba</small></div>`;
    } else {
        html = `<div><b>${esc(c.text)}</b><small>Ve sbírce není – klik ho vyhledá.</small></div>`;
    }
    if (nadOdkazem !== odkaz) return;
    if (!vizitka) {
        vizitka = document.createElement('div');
        vizitka.className = 'vizitka-odkazu hidden';
        vizitka.setAttribute('role', 'tooltip');
        document.body.append(vizitka);
    }
    vizitka.innerHTML = html;
    vizitka.classList.remove('hidden');
    const r = odkaz.getBoundingClientRect();
    const b = vizitka.getBoundingClientRect();
    vizitka.style.left = `${naCss(Math.max(8, Math.min(r.left, window.innerWidth - b.width - 8)))}px`;
    vizitka.style.top = `${naCss(r.bottom + 6 + b.height > window.innerHeight ? Math.max(8, r.top - 6 - b.height) : r.bottom + 6)}px`;
}

// ——— Zmiňováno v… ———

function htmlZminek(zminky) {
    const polozka = z => {
        let nazev, kde, atributy;
        if (z.druh === 'modelka') {
            [nazev, kde, atributy] = [z.nazev, 'poznámka modelky', `data-zminka-modelka="${z.modelkaId}"`];
        } else if (z.druh === 'album') {
            [nazev, kde, atributy] = [z.nazev || nazevAlba(z.album, z.typ), `text alba ${nazevAlba(z.album, z.typ)}`, z.modelkaId ? `data-zminka-modelka="${z.modelkaId}"` : `data-zminka-cislo="${esc(z.vydani)}"`];
        } else if (z.druh === 'clanek') {
            [nazev, kde, atributy] = [z.nazev, `článek · ${nazevVydani(z.vydani)}`, `data-zminka-clanek="${z.clanekId}" data-zminka-cislo="${esc(z.vydani)}"`];
        } else {
            [nazev, kde, atributy] = [nazevVydani(z.vydani), 'poznámka čísla', `data-zminka-cislo="${esc(z.vydani)}"`];
        }
        return `<button type="button" class="zminka" ${atributy}><span class="zminka-nazev">${esc(nazev)}</span><span class="zminka-kde">${esc(kde)}</span>
            <span class="zminka-uryvek">${esc(z.uryvek)}</span></button>`;
    };
    return `<h4>Zmiňováno v… <small>${zminky.length}</small></h4>${zminky.map(polozka).join('')}`;
}

// Sekce v profilu modelky (pod články v údajích)
export async function doplnitZminkyModelky(modelka) {
    const zminky = await GetZminky('modelka', String(modelka.id)).catch(() => []) || [];
    if (!zminky.length || stav.aktualniModelka?.id !== modelka.id) return;
    const hlavicka = document.getElementById('modelHeader');
    let udaje = hlavicka.querySelector('.udaje-modelky');
    if (!udaje) {
        udaje = document.createElement('div');
        udaje.className = 'udaje-modelky';
        (hlavicka.querySelector('.udaje-hlava') || hlavicka.querySelector('.profile-cover-ram')).after(udaje);
    }
    udaje.querySelector('.udaje-zminky')?.remove();
    udaje.insertAdjacentHTML('beforeend', `<section class="udaje-blok udaje-zminky">${htmlZminek(zminky)}</section>`);
}

// Sekce v levém panelu detailu čísla
export async function doplnitZminkyCisla(vydani) {
    const zminky = await GetZminky('vydani', vydani).catch(() => []) || [];
    const panel = document.getElementById('issueSide');
    if (!zminky.length || stav.aktualniVydani !== vydani || !panel) return;
    panel.querySelector('.zminky-cisla')?.remove();
    panel.insertAdjacentHTML('beforeend', `<section class="zminky-cisla">${htmlZminek(zminky).replace('<h4>', '<h4 class="panel-nadpis">')}</section>`);
}

export function pripravit() {
    // Klik na odkaz i na zmínku; zachytí se dřív než klik na dlaždici, plakát či kartu pod ním
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const odkaz = /** @type {HTMLElement | null} */ (t.closest?.('.wiki-odkaz'));
        const zminka = /** @type {HTMLElement | null} */ (t.closest?.('.zminka'));
        if (!odkaz && !zminka) return;
        // V náhledu editoru textu odkaz nevede pryč (okno by zůstalo otevřené pod jinou stránkou)
        if (odkaz?.closest('#textModal')) return;
        e.preventDefault();
        e.stopPropagation();
        zavritVizitku();
        if (odkaz) return void otevritOdkaz(odkaz.dataset.wiki);
        if (zminka.dataset.zminkaClanek) otevritClanek(zminka.dataset.zminkaCislo, parseInt(zminka.dataset.zminkaClanek));
        else if (zminka.dataset.zminkaModelka) otevritProfilPodleId(parseInt(zminka.dataset.zminkaModelka));
        else if (zminka.dataset.zminkaCislo) otevritVydani(zminka.dataset.zminkaCislo);
    }, true);
    document.addEventListener('mouseover', (e) => {
        const odkaz = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.wiki-odkaz'));
        if (!odkaz || odkaz === nadOdkazem) return;
        clearTimeout(casovac);
        nadOdkazem = odkaz;
        casovac = window.setTimeout(() => ukazatVizitku(odkaz), 350);
    });
    document.addEventListener('mouseout', (e) => {
        const odkaz = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.wiki-odkaz'));
        if (odkaz && !odkaz.contains(/** @type {Node} */ (e.relatedTarget))) zavritVizitku();
    });
    document.addEventListener('scroll', zavritVizitku, { capture: true, passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zavritVizitku(); });
    // Data pro našeptávač po „[[“; editor si je načte jednou za otevření okna
    nastavitZdrojOdkazu(async () => {
        fotografove = null;
        kalendar = null;
        const [modelky, foto, kal] = await Promise.all([vsechnyModelky(), nacistFotografy(), nacistKalendar()]);
        return {
            modelky: [...modelky].sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs')),
            vydani: kal.map(k => k.vydani).sort().reverse(),
            fotografove: foto,
        };
    });
}
