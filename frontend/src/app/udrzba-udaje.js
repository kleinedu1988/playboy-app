// Údržba „Po údajích“: vlevo seznam údajů, které někde chybí (Ke kontrole, údaje modelek, fotky a alba, čísla)
// s počty a návrhy, vpravo karta zvoleného údaje s řádkem pro každou modelku (album, číslo, nález), které chybí.
// Do řádku se píše rovnou: pole stejného druhu jako formulář modelky (kopie z doplneni.js, našeptávání z hodnot
// sbírky, převody měr), srdíčka, odkaz z Disku, vydání alba; návrh je v poli předvyplněný s jistotou a důvodem.
// Enter řádek uloží a skočí na další, Esc vrátí hodnotu, Delete (v prázdném poli, nebo s Ctrl) = Netýká se.
// Uložený řádek zůstane na místě ztlumený („✓ uloženo“), aby fokus ani poloha neposkočily; karta se přestaví
// jen při změně údaje, nebo když v ní není fokus ani nic rozepsaného (počty se mění na místě vždy).
import { SetHodnoceni, SetPopisAlba, SetVydaniAlba, GetFotografieModelky } from './backend';
import { esc, nazevAlba, nazevVydani, rozlozitVydani, sklonovat } from '../lib/format';
import { sestavitAlba } from '../lib/alba';
import { SKUPINY_UDAJU, dalsiRadek, nazevKontroly, nazevPoleFormulare, prvniUdaj, procent } from '../lib/udrzba';
import { stav } from './stav';
import { kopiePole, prevestPole } from './doplneni';
import { naplnitNapovedu, potvrdit } from './formular-modelky';
import { chybaPoli, hodnotaModelky, hodnotaNavrhuPole, ulozitPoleModelky, vlastnostPole } from './udrzba-zapis';
import { pridatNapovedu } from './udrzba-fokus';
import { upravitText } from '../ui/editor-textu';
import { jeVidet, nastavitHtml, otevreneOkno } from '../ui/dom';
import { htmlSrdicekModelky, obnovitSrdickaModelky } from '../ui/srdicka';
import { hodnotaPoKlavese, textSrdicek } from '../lib/srdicka';
import { oznamit } from '../ui/oznameni';
import * as navrhy from './navrhy';
import * as uceni from './uceni';

// Co Údržba (udrzba.js) půjčuje
let api = {
    model: () => null, poUdajich: () => null, hlavniAkce: async (_x, _s) => {}, odlozit: async (_x, _s, _ano, _moznosti) => /** @type {boolean | null} */ (false),
    vyrizeno: (_seznam = '', _jeTo = (_x) => false) => {}, obrazek: (_s, _trida) => '', podtitulek: (_s) => '', modelka: (_s) => null, viditelna: () => false,
};

let kontejner = null; // [data-ud="udaje"]
let zobrazeny = ''; // údaj na kartě
let podpis = ''; // řádky na kartě; karta se přestaví jen při jeho změně
/** @type {Map<string, any>} */
let radky = new Map(); // klíč řádku → řádek z sestavitPoUdajich
const hotove = new Map(); // klíč řádku → stav ('ulozeno', 'opraveno', 'netyka', …), řádek zůstane ztlumený
const ukladane = new Set();

const cast = jmeno => /** @type {HTMLElement} */ (kontejner?.querySelector(`[data-uu="${jmeno}"]`));
const udaj = () => api.poUdajich()?.udaje.get(zobrazeny);
const prvekRadku = klic => /** @type {HTMLElement} */ (cast('radky')?.querySelector(`[data-radek="${CSS.escape(klic)}"]`));
const FOKUS_RADKU = 'input:not([type="hidden"]):not(:disabled):not(.kategorie-jina), select:not(:disabled), [data-uu-hodnoceni], .kategorie-vyber .chip, [data-uu-akce]:not([data-uu-akce="odlozit"])';

// Stav vyřízeného řádku slovy
const STAVY = { ulozeno: '✓ uloženo', opraveno: '✓ uloženo jako oprava', netyka: 'netýká se', poradku: 'v pořádku', odmitnuto: 'odmítnuto', nezajima: 'nezajímá mě' };

export function pripravit(funkce) {
    api = funkce;
    try { stav.udrzbaUdaj = localStorage.getItem('udrzbaUdaj') || ''; } catch { /* první údaj */ }
    // Klávesy v kartě se zachytávají předem: Esc nesmí zavřít nic jiného, Enter nesmí kliknout na štítek kategorie
    document.addEventListener('keydown', klavesa, true);
}

export function zobrazit(prvek) {
    kontejner = prvek;
    if (!kontejner.querySelector('[data-uu="karta"]')) postavitKostru();
    naplnitNapovedu();
}

function postavitKostru() {
    kontejner.innerHTML = `
        <div class="uu-mrizka">
            <nav class="ud-bok uu-bok" data-uu="bok" aria-label="Údaje, které chybí"></nav>
            <section class="uu-karta" data-uu="karta" aria-label="Modelky, kterým údaj chybí">
                <select class="ud-vyber uu-vyber" data-uu="vyber" data-uu-vyber aria-label="Údaj"></select>
                <header class="uu-hlava" data-uu="hlava"></header>
                <div class="uu-radky" data-uu="radky" role="list"></div>
                <footer class="uu-pata" data-uu="pata"></footer>
            </section>
        </div>`;
    kontejner.addEventListener('click', klik);
    kontejner.addEventListener('change', (e) => {
        const prvek = /** @type {HTMLInputElement} */ (e.target);
        if (prvek.matches?.('[data-uu-vyber]')) return vybratUdaj(prvek.value, { zamerit: true });
        const radek = prvek.closest?.('[data-radek]');
        if (prvek.dataset?.pole && radek) prevestPole(radek, prvek);
    });
    // Změněná hodnota návrhu se uloží jako oprava: nápověda to řekne
    kontejner.addEventListener('input', (e) => {
        const prvek = /** @type {HTMLInputElement} */ (e.target);
        const napoveda = prvek.closest?.('.ud-vstup')?.querySelector('.ud-napoveda.navrh');
        if (napoveda && prvek.dataset.navrh !== undefined) napoveda.classList.toggle('opraveno', prvek.value.trim() !== (prvek.dataset.vychozi || '').trim());
    });
}

// ——— Vykreslení ———

// Po každé změně dat: seznam údajů a hlavička na místě, řádky jen při změně údaje (nebo bez fokusu v kartě)
export function vykreslit() {
    const po = api.poUdajich();
    if (!kontejner || !po) return;
    if (!stav.udrzbaUdaj || (!po.udaje.get(stav.udrzbaUdaj)?.pocet && stav.udrzbaUdaj !== zobrazeny)) stav.udrzbaUdaj = prvniUdaj(po);
    nastavitHtml(cast('bok'), htmlBoku(po));
    const vyber = cast('vyber');
    if (document.activeElement !== vyber) nastavitHtml(vyber, htmlVyberu(po));
    const u = po.udaje.get(stav.udrzbaUdaj);
    const novyPodpis = u ? `${u.klic}#${u.radky.map(r => `${r.klic}:${r.navrhy.length}`).join(',')}` : '';
    const karta = cast('karta');
    const muzePrestavet = !karta.contains(document.activeElement) && !rozepsano() && !ukladane.size;
    if (stav.udrzbaUdaj !== zobrazeny || (novyPodpis !== podpis && muzePrestavet)) {
        prestavetRadky(u);
        podpis = novyPodpis;
    }
    nastavitHtml(cast('hlava'), htmlHlavy());
}

function htmlBoku(po) {
    return po.oblasti.map(o => `<h5>${o.nazev}</h5>${o.udaje.map(u => htmlUdaje(u)).join('')}`).join('')
        // Zobrazený údaj, který se právě dodělal, zůstane v seznamu se zaškrtnutím
        + (zobrazeny && !po.udaje.get(zobrazeny)?.pocet && po.udaje.get(zobrazeny) ? `<h5>Hotovo</h5>${htmlUdaje(po.udaje.get(zobrazeny))}` : '')
        || '<p class="uu-prazdne">Nic nechybí.</p>';
}

function htmlUdaje(u) {
    const on = u.klic === stav.udrzbaUdaj;
    const nazev = u.klic === 'kontrola' ? `⚠ ${nazevKontroly(u)}` : u.nazev;
    return `<button type="button" class="ud-bok-radek ${on ? 'on' : ''}" data-uu-udaj="${u.klic}" aria-pressed="${on}" title="${esc(`${sklonovat(u.pocet, ...u.jednotka)} ${u.bez}${u.navrhu ? ` · ${sklonovat(u.navrhu, 'návrh', 'návrhy', 'návrhů')}` : ''}`)}">
        <span>${esc(nazev)}</span>${u.navrhu ? `<em class="uu-navrhu">✦ ${u.navrhu}</em>` : ''}<b>${u.pocet || '✓'}</b></button>`;
}

// Úzké okno: místo seznamu výběr nad kartou
function htmlVyberu(po) {
    return po.oblasti.map(o => `<optgroup label="${o.nazev}">${o.udaje.map(u => `<option value="${u.klic}" ${u.klic === stav.udrzbaUdaj ? 'selected' : ''}>${esc(u.klic === 'kontrola' ? nazevKontroly(u) : u.nazev)} (${u.pocet}${u.navrhu ? ` · ✦ ${u.navrhu}` : ''})</option>`).join('')}</optgroup>`).join('');
}

// Hlavička karty: název, kolik chybí a kolik je návrhů, hromadné akce
function htmlHlavy() {
    const u = udaj();
    if (!u) return '<h4>Vše doplněno</h4><small>Ve sbírce teď nic nechybí.</small>';
    const navrhu = navrhyKPrijeti().length;
    const odlozit = { kontrola: 'V pořádku všem…', navrh: 'Odmítnout všechny…' }[u.druh] || (u.oblast === 'cisla' ? 'Nezajímá mě všem…' : 'Netýká se všem…');
    return `<div class="uu-nadpis"><h4>${esc(u.klic === 'kontrola' ? nazevKontroly(u) : u.nazev)}</h4>
            <small>${u.pocet ? `${sklonovat(u.pocet, ...u.jednotka)} ${esc(u.bez)}` : 'Hotovo'}${u.navrhu ? ` · ${sklonovat(u.navrhu, 'návrh', 'návrhy', 'návrhů')} z tvé sbírky` : ''}</small></div>
        ${u.pocet ? `<button type="button" class="ud-nastroj uu-odlozit-vse" data-uu-vse="odlozit">${odlozit}</button>` : ''}
        ${navrhu ? `<button type="button" class="ud-nastroj on" data-uu-vse="prijmout" title="Přijme návrhy v řádcích, které jsi neměnil (před uložením se zeptá)">✓ Přijmout ${sklonovat(navrhu, 'návrh', 'návrhy', 'návrhů')}</button>` : ''}`;
}

// Řádky karty od začátku (jiný údaj nebo nová data bez fokusu v kartě); vyřízené řádky zmizí
function prestavetRadky(u) {
    zobrazeny = u?.klic || '';
    hotove.clear();
    ukladane.clear();
    radky = new Map((u?.radky || []).map(r => [r.klic, r]));
    const seznam = cast('radky');
    seznam.textContent = '';
    if (!u) return;
    if (!u.radky.length) {
        seznam.innerHTML = '<p class="uu-hotovo">✓ Tady je vše doplněné.</p>';
        nastavitHtml(cast('pata'), '<span></span><button type="button" class="btn btn-primary btn-small" data-uu-dalsi-udaj>Další údaj →</button>');
        return;
    }
    const fragment = document.createDocumentFragment();
    u.radky.forEach((r, i) => fragment.append(postavitRadek(u, r, i)));
    seznam.append(fragment);
    nastavitHtml(cast('pata'), `<span class="ud-klavesy"><kbd>Enter</kbd> uloží a jde dolů <kbd>Tab</kbd> přeskočí <kbd>Esc</kbd> vrátí hodnotu <kbd>Del</kbd> ${u.druh === 'kontrola' ? 'v pořádku' : u.druh === 'navrh' ? 'odmítne' : 'netýká se'}</span>
        <span>${u.druh === 'pole' ? 'Našeptávání z hodnot ve sbírce' : ''}</span>`);
}

// Nápověda pod jménem: co pomůže údaj doplnit (místo narození k národnosti, míry k velikosti prsou)
function napovedaRadku(u, m) {
    if (!m) return '';
    const miry = m.obvodHrudnikCm ? [m.obvodHrudnikCm, m.obvodPasCm, m.obvodBokyCm].filter(Boolean).join('-') : '';
    return {
        narodnost: m.narozeniMisto && `nar. ${m.narozeniMisto}`, etnicita: [m.narodnost, m.vlasyBarva && `vlasy ${m.vlasyBarva.toLowerCase()}`].filter(Boolean).join(', '),
        narozeniMisto: m.narodnost, velikostPrsou: miry && `míry ${miry}`, prsaTyp: m.velikostPrsou && `velikost ${m.velikostPrsou}`, miry: m.velikostPrsou && `velikost ${m.velikostPrsou}`,
    }[u.klic] || '';
}

// Řádek: fotka, jméno s podtitulkem, pole na místě a odložení (Netýká se, V pořádku…)
function postavitRadek(u, r, i) {
    const s = r.skupina;
    const m = api.modelka(s);
    const prvek = document.createElement('div');
    prvek.className = `uu-radek ${u.druh}`;
    prvek.dataset.radek = r.klic;
    prvek.setAttribute('role', 'listitem');
    const pod = [r.album ? nazevAlba(r.album.album, r.album.typ) : api.podtitulek(s), u.druh === 'pole' && napovedaRadku(u, m)].filter(Boolean).join(' · ');
    const odlozit = u.druh === 'kontrola' ? 'V pořádku' : u.druh === 'navrh' ? 'Odmítnout' : s.druh === 'vydani' ? 'Nezajímá mě' : 'Netýká se';
    const skupinaUdaju = r.polozka?.akce === 'udaje' ? SKUPINY_UDAJU[r.polozka.skupinaUdaju].nazev : '';
    prvek.innerHTML = `${api.obrazek(s, 'uu-foto')}
        <div class="uu-jmeno"><strong>${esc(s.jmeno)}</strong><small>${esc(pod)}</small></div>
        <div class="uu-obsah"></div>
        <div class="uu-akce"><span class="uu-stav" aria-live="polite"></span><span class="uu-enter" aria-hidden="true"><kbd>Enter</kbd> uložit</span>
            <button type="button" class="nv-tlacitko uu-odlozit" data-uu-akce="odlozit" tabindex="-1"
                title="${esc(skupinaUdaju ? `Přestat hlídat celou část „${skupinaUdaju}“ u této modelky (Delete)` : `${odlozit} (Delete)`)}">${odlozit}</button></div>`;
    const obsah = prvek.querySelector('.uu-obsah');
    const pole = (inputId, popis, hodnota, puvodni, dalsi = {}) => {
        const obal = kopiePole(inputId, popis, { predpona: `uu${i}`, hodnota });
        obal.classList.add('uf-pole');
        const vstup = /** @type {HTMLInputElement} */ (obal.querySelector('[data-pole]'));
        vstup.dataset.vychozi = hodnota;
        vstup.dataset.puvodni = puvodni;
        Object.assign(vstup.dataset, dalsi);
        if (vstup.tagName === 'INPUT' && vstup.type !== 'hidden' && (u.pole.length > 1 || !vstup.placeholder)) vstup.placeholder = u.pole.length > 1 ? popis : `napiš ${popis}…`;
        obsah.append(obal);
        return obal;
    };
    const textNavrhu = x => `návrh ${procent(x.jistota)} %${x.duvod ? ` · ${x.duvod}` : ''}`;
    const titleNavrhu = x => [x.duvod, x.zdrojPopis && `✦ ${x.zdrojPopis}`].filter(Boolean).join(' · ');
    if (u.druh === 'pole') {
        u.pole.forEach(([, popis, inputId]) => {
            const x = r.navrhy.find(y => y.navrh.inputId === inputId);
            const puvodni = hodnotaModelky(m, inputId);
            const obal = pole(inputId, popis, x ? hodnotaNavrhuPole(m, x.navrh) : puvodni, puvodni, x ? { navrh: String(r.navrhy.indexOf(x)) } : {});
            if (x) pridatNapovedu(obal, textNavrhu(x), 'navrh', titleNavrhu(x));
        });
    } else if (u.druh === 'titulni') {
        /** @type {HTMLInputElement} */ (pole('inputDriveID', 'titulní fotka', '', '').querySelector('input')).placeholder = 'Vlož odkaz z Google Disku…';
    } else if (u.druh === 'kontrola') {
        const inputId = r.nalez.pole && !r.nalez.album && vlastnostPole(r.nalez.pole) ? r.nalez.pole : '';
        if (inputId) {
            const hodnota = hodnotaModelky(m, inputId);
            pridatNapovedu(pole(inputId, nazevPoleFormulare(inputId) || r.polozka.pole, hodnota, hodnota), r.polozka.hodnota, 'kontrola', [r.polozka.hodnota, r.polozka.duvod, r.polozka.zdroj && uceni.popisZdroje(r.polozka.zdroj)].filter(Boolean).join(' · '));
        } else {
            obsah.innerHTML = `<p class="uu-text">⚠ ${esc(r.polozka.hodnota)}${r.polozka.duvod ? ` <small>${esc(r.polozka.duvod)}</small>` : ''}</p>
                <button type="button" class="nv-tlacitko nv-prijmout" data-uu-akce="hlavni">Opravit…</button>`;
        }
    } else if (u.druh === 'hodnoceni') {
        // Srdíčka po půlkách: klik na levou půlku dá x,5 a uloží hned, klávesy jen nastaví (uloží Enter)
        obsah.innerHTML = `<div class="ud-vstup uu-srdicka" data-uu-hodnoceni data-hodnota="0" tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="5"
            aria-valuenow="0" aria-valuetext="${textSrdicek(0)}" aria-label="Hodnocení – ${esc(s.jmeno)} (klávesy 1–5, stejná znovu přidá půlku)">
            ${htmlSrdicekModelky(0, '', { posuvnik: false, atributPulky: 'data-uu-srdce' })}
            <small class="ud-napoveda tlumena">1–5, znovu ½</small></div>`;
    } else if (u.druh === 'vydaniAlba') {
        const x = r.navrhy[0];
        obsah.innerHTML = `<div class="uf-pole"><input type="text" data-uu-vydani aria-label="Vydání alba ${esc(nazevAlba(r.album.album, r.album.typ))} – ${esc(s.jmeno)}"
            placeholder="RRRR-MM nebo RRRR" autocomplete="off" value="${esc(x ? String(x.navrh.hodnota) : '')}" data-vychozi="${esc(x ? String(x.navrh.hodnota) : '')}" data-puvodni="" ${x ? 'data-navrh="0"' : ''} /></div>`;
        if (x) pridatNapovedu(/** @type {HTMLElement} */ (obsah.firstElementChild), `${textNavrhu(x)}${rozlozitVydani(x.navrh.hodnota) ? ` · ${nazevVydani(x.navrh.hodnota)}` : ''}`, 'navrh', titleNavrhu(x));
    } else if (u.druh === 'textAlba') {
        obsah.innerHTML = '<button type="button" class="nv-tlacitko nv-prijmout" data-uu-akce="text" data-editor-textu>✎ Napsat text…</button>';
    } else if (u.druh === 'navrh') {
        const x = r.navrhy[0];
        obsah.innerHTML = `<p class="uu-text"><span class="uu-pole-navrhu">${esc(x.pole)}${x.album ? ` · ${esc(x.album)}` : ''}</span> <b>${esc(x.hodnota)}</b>
            <small class="ud-napoveda navrh" title="${esc(titleNavrhu(x))}">${esc(textNavrhu(x))}</small></p>
            <button type="button" class="nv-tlacitko nv-prijmout" data-uu-akce="prijmout">✓ Přijmout</button>`;
    } else {
        // Centerfold modelky, cover a centerfold čísla: otevře se jejich okno
        const text = s.druh === 'vydani' ? (u.klic === 'cover' ? 'Přidat cover…' : 'Přidat centerfold…') : 'Přidat centerfold…';
        obsah.innerHTML = `<button type="button" class="nv-tlacitko nv-prijmout" data-uu-akce="hlavni">${text}</button>`;
    }
    return prvek;
}

// ——— Stav řádků ———

const vstupyRadku = prvek => /** @type {HTMLInputElement[]} */ ([...prvek.querySelectorAll('[data-pole], [data-uu-vydani]')]);
const zmenene = prvek => vstupyRadku(prvek).filter(p => p.value.trim() !== (p.dataset.vychozi || '').trim());
const rozepsano = () => [...(cast('radky')?.querySelectorAll('.uu-radek:not(.hotovo)') || [])].some(p => zmenene(/** @type {HTMLElement} */ (p)).length
    || /** @type {HTMLElement} */ (p.querySelector('[data-uu-hodnoceni]'))?.dataset.hodnota !== undefined && /** @type {HTMLElement} */ (p.querySelector('[data-uu-hodnoceni]')).dataset.hodnota !== '0');

// Návrhy v řádcích, které čekají a jejich pole nikdo neměnil (hromadné přijetí)
function navrhyKPrijeti() {
    const u = udaj();
    if (!u) return [];
    return u.radky.filter(r => r.navrhy.length && !hotove.has(r.klic) && !ukladane.has(r.klic)).flatMap(r => {
        const prvek = prvekRadku(r.klic);
        return prvek && zmenene(prvek).some(p => p.dataset.navrh !== undefined) ? [] : r.navrhy.map(x => x.navrh);
    });
}

// Řádek vyřízený: ztlumí se a zůstane na místě; pole se zakážou (fokus už je jinde)
function oznacit(klic, stavRadku) {
    const prvek = prvekRadku(klic);
    ukladane.delete(klic);
    if (!prvek) return;
    prvek.classList.remove('uklada', 'chyba');
    if (stavRadku) {
        hotove.set(klic, stavRadku);
        prvek.classList.add('hotovo');
        prvek.querySelectorAll('input, select, button, [data-uu-hodnoceni]').forEach(p => {
            if (p === document.activeElement) return;
            if ('disabled' in p) /** @type {HTMLInputElement} */ (p).disabled = true;
            else p.setAttribute('tabindex', '-1');
        });
    } else {
        hotove.delete(klic);
        prvek.classList.remove('hotovo');
        prvek.querySelectorAll('input, select, button').forEach(p => { /** @type {HTMLInputElement} */ (p).disabled = false; });
        prvek.querySelector('[data-uu-hodnoceni]')?.setAttribute('tabindex', '0');
    }
    /** @type {HTMLElement} */ (prvek.querySelector('.uu-stav')).textContent = stavRadku ? STAVY[stavRadku] || stavRadku : '';
}

// Na další nevyřízený řádek (Enter); za posledním na „Další údaj“
function naDalsi(klic) {
    const klice = [...cast('radky').querySelectorAll('[data-radek]')].map(p => /** @type {HTMLElement} */ (p).dataset.radek);
    const dalsi = dalsiRadek(klice, new Set([...hotove.keys(), ...ukladane]), klic);
    const cil = dalsi && /** @type {HTMLElement} */ (prvekRadku(dalsi)?.querySelector(FOKUS_RADKU));
    if (cil) {
        cil.focus();
        cil.scrollIntoView({ block: 'nearest' });
        return;
    }
    nastavitHtml(cast('pata'), `<span>Hotovo – v tomhle údaji už nic nezbývá.</span><button type="button" class="btn btn-primary btn-small" data-uu-dalsi-udaj>Další údaj →</button>`);
    /** @type {HTMLElement} */ (cast('pata').querySelector('[data-uu-dalsi-udaj]'))?.focus();
}

// Nepovedené uložení: řádek se označí a fokus se do něj vrátí, pokud mezitím uživatel nezačal psát jinde
function chybaRadku(klic) {
    const prvek = prvekRadku(klic);
    ukladane.delete(klic);
    if (!prvek) return;
    prvek.classList.remove('uklada');
    prvek.classList.add('chyba');
    const aktivni = /** @type {HTMLInputElement} */ (document.activeElement);
    const jinde = aktivni?.closest?.('[data-radek]');
    if (!jinde || (jinde !== prvek && !zmenene(/** @type {HTMLElement} */ (jinde)).length)) /** @type {HTMLElement} */ (prvek.querySelector(FOKUS_RADKU))?.focus();
}

// ——— Ukládání ———

// Enter v řádku: uloží, co se změnilo (návrh beze změny se přijme), a hned skočí na další řádek
async function ulozitRadek(klic) {
    const r = radky.get(klic);
    const prvek = prvekRadku(klic);
    const u = udaj();
    if (!r || !prvek || !u || hotove.has(klic) || ukladane.has(klic)) return naDalsi(klic);
    const s = r.skupina;
    if (u.druh === 'hodnoceni') {
        const n = Number(/** @type {HTMLElement} */ (prvek.querySelector('[data-uu-hodnoceni]')).dataset.hodnota);
        if (!n) return naDalsi(klic);
        return ulozitSrdicka(klic, n, true);
    }
    if (u.druh === 'vydaniAlba') return ulozitVydani(klic);
    const vstupy = vstupyRadku(prvek);
    const aktivni = /** @type {HTMLInputElement} */ (document.activeElement);
    if (aktivni?.dataset?.pole) prevestPole(prvek, aktivni);
    const chyba = chybaPoli(vstupy);
    if (chyba) {
        oznamit(chyba);
        return;
    }
    // Návrh, jehož pole nikdo neměnil, se přijme; ostatní změněná pole se zapíšou (návrh s jinou hodnotou jako oprava)
    const navrhPole = p => p.dataset.navrh !== undefined ? r.navrhy[Number(p.dataset.navrh)]?.navrh : null;
    const prijmout = vstupy.filter(p => navrhPole(p) && p.value.trim() && p.value.trim() === (p.dataset.vychozi || '').trim());
    const zapsat = vstupy.filter(p => !prijmout.includes(p) && p.value.trim() !== (p.dataset.puvodni || '').trim());
    if (!prijmout.length && !zapsat.length) return naDalsi(klic);
    ukladane.add(klic);
    prvek.classList.add('uklada');
    naDalsi(klic);
    let ok = true;
    for (const p of prijmout) ok = await navrhy.prijmout(navrhPole(p)) && ok;
    const opravy = zapsat.map(navrhPole).filter(Boolean);
    if (ok && zapsat.length) {
        ok = await ulozitPoleModelky(s.id, zapsat, { navrh: navrhPole, zamerit: () => /** @type {HTMLElement} */ (prvek.querySelector(FOKUS_RADKU))?.focus() });
        if (ok) opravy.forEach(n => navrhy.odebratOpraveny(n));
        // Titulní fotka je v datech Přehledu zvlášť; ostatní údaje se přepočítají z modelky
        if (ok) api.vyrizeno(u.druh === 'titulni' ? 'bezTitulni' : '', x => x.modelkaId === s.id);
    }
    if (ok) oznacit(klic, opravy.some(n => zapsat.some(p => navrhPole(p) === n && p.value.trim())) ? 'opraveno' : 'ulozeno');
    else chybaRadku(klic);
}

async function ulozitSrdicka(klic, n, dalsi) {
    const s = radky.get(klic)?.skupina;
    if (!s) return;
    ukladane.add(klic);
    prvekRadku(klic)?.classList.add('uklada');
    if (dalsi) naDalsi(klic);
    let ok = false;
    try {
        ok = await SetHodnoceni(s.id, n);
    } catch { /* oznámí se níž */ }
    if (!ok) {
        oznamit('Hodnocení se nepodařilo uložit.');
        return chybaRadku(klic);
    }
    const m = stav.prehledModelky.get(s.id);
    if (m) m.hodnoceni = n;
    api.vyrizeno('bezHodnoceni', x => x.modelkaId === s.id);
    oznacit(klic, 'ulozeno');
}

async function ulozitVydani(klic) {
    const r = radky.get(klic);
    const prvek = prvekRadku(klic);
    const vstup = /** @type {HTMLInputElement} */ (prvek.querySelector('[data-uu-vydani]'));
    const hodnota = vstup.value.trim();
    if (!hodnota) return naDalsi(klic);
    if (!rozlozitVydani(hodnota)) {
        oznamit('Vydání alba napiš jako RRRR-MM, nebo jen rok RRRR.');
        return;
    }
    const x = r.navrhy[0];
    ukladane.add(klic);
    prvek.classList.add('uklada');
    naDalsi(klic);
    let ok = false;
    const oprava = x && hodnota !== String(x.navrh.hodnota).trim();
    if (x && !oprava) ok = await navrhy.prijmout(x.navrh);
    else {
        try {
            ok = await SetVydaniAlba(r.album.modelkaId, r.album.album, r.album.typ, hodnota);
        } catch { /* oznámí se níž */ }
        if (!ok) oznamit('Vydání alba se nepodařilo uložit.');
        else if (x) {
            uceni.zaznamenatOpravuNavrhu(x.navrh, hodnota);
            navrhy.odebratOpraveny(x.navrh);
        }
    }
    if (!ok) return chybaRadku(klic);
    api.vyrizeno('albaBezVydani', stejneAlbum(r.album));
    oznacit(klic, oprava ? 'opraveno' : 'ulozeno');
}

const stejneAlbum = a => x => x.modelkaId === a.modelkaId && x.album === a.album && x.typ === a.typ;

// Text alba v editoru textu; fotograf alba zůstane (SetPopisAlba ukládá obojí)
async function napsatText(klic) {
    const r = radky.get(klic);
    if (!r) return;
    const a = r.album;
    const alba = sestavitAlba((await GetFotografieModelky(a.modelkaId)) || []);
    const album = alba.find(x => x.album === a.album && x.typ === a.typ);
    const text = await upravitText({ nadpis: `Text alba – ${nazevAlba(a.album, a.typ)} · ${r.skupina.jmeno}`, text: album?.popis || '', zastupny: 'Průvodní text alba…' });
    /** @type {HTMLElement} */ (prvekRadku(klic)?.querySelector('[data-uu-akce="text"]'))?.focus();
    if (text === null || !text.trim()) return;
    let ok = false;
    try {
        ok = await SetPopisAlba(a.modelkaId, a.album, a.typ, text, album?.fotograf || '');
    } catch { /* oznámí se níž */ }
    if (!ok) {
        oznamit('Text alba se nepodařilo uložit.');
        return;
    }
    api.vyrizeno('albaBezPopisu', stejneAlbum(a));
    oznacit(klic, 'ulozeno');
    naDalsi(klic);
}

// Položka, kterou řádek odkládá: u alba jen to jedno album
const polozkaRadku = r => r.album && r.polozka?.alba ? { ...r.polozka, alba: [r.album], pole: nazevAlba(r.album.album, r.album.typ) } : r.polozka;

// Odložení jednoho řádku bez oznámení; vrací funkci, která ho vrátí, nebo null, když se nepovedlo
async function odlozitTise(r) {
    const u = udaj();
    const x = polozkaRadku(r);
    const navrhyRadku = r.navrhy.map(y => y.navrh);
    // Řádek jen s návrhem (kategorie navíc, fotograf alba): odmítne se návrh
    if (x.druh === 'navrh' || u.druh === 'navrh') {
        const odmitnute = await navrhy.odmitnoutPotichu(navrhyRadku);
        return odmitnute.length ? { stav: 'odmitnuto', vratit: () => navrhy.vratitOdmitnuti(odmitnute) } : null;
    }
    const ok = await api.odlozit(x, r.skupina, true, { tise: true });
    if (!ok) return null;
    // Údaj, který se netýká, se už ani nenavrhuje
    const odmitnute = navrhyRadku.length ? await navrhy.odmitnoutPotichu(navrhyRadku) : [];
    return {
        stav: u.druh === 'kontrola' ? 'poradku' : r.skupina.druh === 'vydani' ? 'nezajima' : 'netyka',
        vratit: async () => {
            await api.odlozit(x, r.skupina, false, { tise: true });
            if (odmitnute.length) await navrhy.vratitOdmitnuti(odmitnute);
        },
    };
}

// Delete nebo „Netýká se“ v řádku: odloží a jde na další; Vrátit v oznámení řádek obnoví
async function odlozitRadek(klic) {
    const r = radky.get(klic);
    if (!r || hotove.has(klic) || ukladane.has(klic)) return;
    ukladane.add(klic);
    prvekRadku(klic)?.classList.add('uklada');
    const vFokusu = prvekRadku(klic)?.contains(document.activeElement);
    if (vFokusu) naDalsi(klic);
    const vysledek = await odlozitTise(r).catch(() => null);
    if (!vysledek) {
        oznamit('Nepodařilo se uložit.');
        return chybaRadku(klic);
    }
    oznacit(klic, vysledek.stav);
    const celaCast = r.polozka?.akce === 'udaje' ? ` (celá část „${SKUPINY_UDAJU[r.polozka.skupinaUdaju].nazev.toLowerCase()}“)` : '';
    oznamit(`${velke(STAVY[vysledek.stav])}: ${r.skupina.jmeno} – ${r.album ? nazevAlba(r.album.album, r.album.typ) : udaj()?.nazev.toLowerCase()}${celaCast}.`, { text: 'Vrátit', akce: async () => {
        await vysledek.vratit();
        oznacit(klic, '');
    } });
}

const velke = t => t.charAt(0).toUpperCase() + t.slice(1);

// Hromadně: přijmout návrhy v nezměněných řádcích (s potvrzením), nebo odložit všechny čekající řádky
async function prijmoutVse() {
    const u = udaj();
    const seznam = navrhyKPrijeti();
    if (!u || !seznam.length) return;
    const prijate = new Set(await navrhy.prijmoutVice(seznam, `Přijmout návrhy – ${u.nazev.toLowerCase()}?`));
    u.radky.forEach(r => {
        if (r.navrhy.length && r.navrhy.every(x => prijate.has(x.navrh))) oznacit(r.klic, 'ulozeno');
    });
}

async function odlozitVse() {
    const u = udaj();
    if (!u) return;
    const cekajici = u.radky.filter(r => !hotove.has(r.klic) && !ukladane.has(r.klic));
    if (!cekajici.length) return;
    const akce = { kontrola: 'V pořádku', navrh: 'Odmítnout' }[u.druh] || (u.oblast === 'cisla' ? 'Nezajímá mě' : 'Netýká se');
    const casti = [...new Set(cekajici.filter(r => r.polozka?.akce === 'udaje').map(r => SKUPINY_UDAJU[r.polozka.skupinaUdaju].nazev.toLowerCase()))];
    const vysvetleni = u.druh === 'kontrola' ? 'Nálezy se přestanou hlásit a kontrola se z toho poučí.'
        : u.druh === 'navrh' ? 'Tyto hodnoty se už nebudou nabízet.'
            : u.oblast === 'cisla' ? 'Čísla dostanou stav „nezajímá mě“; čísla označená „mám výtisk“ nebo „sháním“ zůstanou, jak jsou.'
                : casti.length ? `„Netýká se“ platí pro celou část formuláře (${casti.join(', ')}): u těchto modelek se přestanou hlídat všechny její údaje.`
                    : 'Tento údaj se u nich přestane hlídat.';
    if (!await potvrdit(`${akce} – ${sklonovat(cekajici.length, ...u.jednotka)}?`, `${vysvetleni} Vrátit to jde hned v oznámení, nebo později v Souhrnu přes „Vyřízené“.`,
        `${akce} (${cekajici.length})`, { nebezpecne: true })) return;
    const vraceni = [];
    for (const r of cekajici) {
        const vysledek = await odlozitTise(r).catch(() => null);
        if (!vysledek) continue;
        oznacit(r.klic, vysledek.stav);
        vraceni.push([r.klic, vysledek.vratit]);
    }
    oznamit(`${akce}: ${vraceni.length} z ${cekajici.length}.`, vraceni.length ? { text: 'Vrátit', akce: async () => {
        for (const [klic, vratit] of vraceni) {
            await vratit().catch(() => {});
            oznacit(klic, '');
        }
        oznamit(`Vráceno ${vraceni.length}.`);
    } } : null);
}

// Jiný údaj; rozepsané řádky se nejdřív zeptají
async function vybratUdaj(klic, { zamerit = false } = {}) {
    if (!klic || (klic === zobrazeny && klic === stav.udrzbaUdaj)) {
        if (zamerit) zameritPrvni();
        return;
    }
    if (rozepsano() && !await potvrdit('Zahodit rozepsané?', 'Rozepsané hodnoty v řádcích se neuloží.', 'Zahodit', { nebezpecne: true })) {
        /** @type {HTMLSelectElement} */ (cast('vyber')).value = zobrazeny;
        return;
    }
    stav.udrzbaUdaj = klic;
    try { localStorage.setItem('udrzbaUdaj', klic); } catch { /* jen se nezapamatuje */ }
    zobrazeny = '';
    vykreslit();
    if (zamerit) zameritPrvni();
}

function zameritPrvni() {
    const cil = /** @type {HTMLElement} */ (cast('radky')?.querySelector(`.uu-radek:not(.hotovo) :is(${FOKUS_RADKU})`));
    cil?.focus({ preventScroll: true });
}

// Filtr z úvodu Přehledu („Co zbývá doplnit“): údaj, který k němu patří
export function ukazatUdaj(klic) {
    if (!klic) return;
    stav.udrzbaUdaj = klic;
    try { localStorage.setItem('udrzbaUdaj', klic); } catch { /* jen se nezapamatuje */ }
}

// Esc vrátí hodnoty řádku (kategorie se postaví znovu, štítky drží vlastní stav)
function vratitRadek(klic) {
    const prvek = prvekRadku(klic);
    const r = radky.get(klic);
    if (!prvek || !r) return;
    if (prvek.querySelector('[data-pole="inputRole"]')) {
        const novy = postavitRadek(udaj(), r, [...radky.keys()].indexOf(klic));
        prvek.replaceWith(novy);
        /** @type {HTMLElement} */ (novy.querySelector(FOKUS_RADKU))?.focus();
        return;
    }
    vstupyRadku(prvek).forEach(p => {
        p.value = p.dataset.vychozi || '';
        p.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const srdicka = /** @type {HTMLElement} */ (prvek.querySelector('[data-uu-hodnoceni]'));
    if (srdicka) nastavitSrdickaRadku(srdicka, 0);
}

function nastavitSrdickaRadku(obal, n) {
    obal.dataset.hodnota = String(n);
    obal.setAttribute('aria-valuenow', String(n));
    obal.setAttribute('aria-valuetext', textSrdicek(n));
    obnovitSrdickaModelky(obal.querySelector('.hearts'), n);
}

// ——— Události ———

function klavesa(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const radek = /** @type {HTMLElement} */ (cil.closest?.('.uu-radek'));
    if (!radek || !kontejner?.contains(radek) || !api.viditelna() || stav.zamceno || e.altKey || e.metaKey) return;
    if (otevreneOkno() || jeVidet('zkratky') || jeVidet('contextMenu')) return;
    const klic = radek.dataset.radek;
    let akce = null;
    const tlacitko = cil.tagName === 'BUTTON' && !cil.closest('.kategorie-vyber');
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !tlacitko && !cil.classList.contains('kategorie-jina')) akce = () => ulozitRadek(klic);
    else if (e.key === 'Escape' && !e.ctrlKey) akce = () => vratitRadek(klic);
    else if (e.key === 'Delete' && (e.ctrlKey || tlacitko || !('value' in cil) || !String(/** @type {HTMLInputElement} */ (cil).value || '').trim())) akce = () => odlozitRadek(klic);
    else if (/^([0-5]|ArrowLeft|ArrowRight)$/.test(e.key) && cil.matches('[data-uu-hodnoceni]') && !e.ctrlKey) {
        akce = () => nastavitSrdickaRadku(cil, hodnotaPoKlavese(Number(cil.dataset.hodnota), e.key));
    }
    if (!akce) return;
    e.preventDefault();
    e.stopPropagation();
    akce();
}

function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const radek = /** @type {HTMLElement} */ (cil.closest('[data-radek]'));
    const r = radek && radky.get(radek.dataset.radek);
    const volba = /** @type {HTMLElement} */ (cil.closest('[data-uu-udaj]'));
    if (volba) return vybratUdaj(volba.dataset.uuUdaj, { zamerit: true });
    if (cil.closest('[data-uu-dalsi-udaj]')) {
        const po = api.poUdajich();
        const dalsi = [...po.udaje.values()].find(u => u.pocet && u.klic !== zobrazeny);
        return vybratUdaj(dalsi?.klic || '', { zamerit: true });
    }
    const vse = /** @type {HTMLElement} */ (cil.closest('[data-uu-vse]'));
    if (vse) return vse.dataset.uuVse === 'prijmout' ? prijmoutVse() : odlozitVse();
    if (!r || hotove.has(r.klic)) return;
    const srdce = /** @type {HTMLElement} */ (cil.closest('[data-uu-srdce]'));
    if (srdce) {
        // Klik na srdíčko uloží hned (myší není kde zmáčknout Enter)
        const obal = /** @type {HTMLElement} */ (srdce.closest('[data-uu-hodnoceni]'));
        nastavitSrdickaRadku(obal, Number(srdce.dataset.uuSrdce));
        return ulozitSrdicka(r.klic, Number(srdce.dataset.uuSrdce), false);
    }
    const akce = /** @type {HTMLElement} */ (cil.closest('[data-uu-akce]'))?.dataset.uuAkce;
    if (akce === 'odlozit') odlozitRadek(r.klic);
    else if (akce === 'hlavni') api.hlavniAkce(r.polozka, r.skupina);
    else if (akce === 'text') napsatText(r.klic);
    else if (akce === 'prijmout') {
        ukladane.add(r.klic);
        navrhy.prijmout(r.navrhy[0].navrh).then(ok => {
            if (ok) {
                oznacit(r.klic, 'ulozeno');
                naDalsi(r.klic);
            } else chybaRadku(r.klic);
        });
    }
}

