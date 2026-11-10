// Režim čtení: číslo nebo profil modelky jako časopis přes celou obrazovku (strany sestaví lib/casopis.js).
// Ovládání: šipky, mezerník (Shift+mezerník zpět), PageUp/PageDown, Home/End, P prezentace, Esc zavře; klik do levé
// třetiny listuje zpět, jinam dál. Lišta a kurzor zmizí, když se myš nehýbe. Prezentace listuje po 3 / 5 / 10 s
// s prolínáním a pomalým přiblížením fotky (Ken Burns) k místu výřezu portrétu; při omezeném pohybu bez něj.
import { GetClanky, GetClankyModelky, GetVydani, GetVydaniInfo } from './backend';
import { WindowFullscreen, WindowIsFullscreen, WindowUnfullscreen } from '../../wailsjs/runtime/runtime';
import { esc, formatMarkdown, nazevVydani, obrazek } from '../lib/format';
import { INTERVALY, platnyInterval, stranyCisla, stranyProfilu } from '../lib/casopis';
import { sestavitAlba } from '../lib/alba';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { oznamit } from '../ui/oznameni';
import { omezitPohyb } from '../ui/vzhled';

const VELIKOST_STRANY = 'w2000';
const PROLNUTI_MS = 700;

let okno = null;
/** @type {import('../lib/casopis').Strana[]} */
let strany = [];
let index = 0;
let nazev = '';
let interval = 5;
let bezi = false;
let casovacPrezentace = 0;
let casovacKlidu = 0;
let bylaCelaObrazovka = false;

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.id = 'casopis';
    okno.className = 'casopis hidden';
    okno.tabIndex = -1;
    okno.setAttribute('role', 'dialog');
    okno.setAttribute('aria-label', 'Režim čtení');
    okno.innerHTML = `
        <div class="cs-scena" aria-live="polite"></div>
        <div class="cs-lista">
            <span class="cs-nazev"></span>
            <span class="cs-oddil"></span>
            <span class="cs-pocet"></span>
            <span class="cs-ovladani">
                <button type="button" class="cs-tlacitko" data-cs-krok="-1" title="Předchozí (←)" aria-label="Předchozí">‹</button>
                <button type="button" class="cs-tlacitko" data-cs-krok="1" title="Další (→, mezerník)" aria-label="Další">›</button>
                <button type="button" class="cs-tlacitko cs-prezentace" data-cs-prezentace title="Prezentace (P)"></button>
                <span class="cs-intervaly" role="group" aria-label="Interval prezentace">${INTERVALY.filter(Boolean).map(s => `<button type="button" class="cs-tlacitko" data-cs-interval="${s}">${s} s</button>`).join('')}</span>
                <button type="button" class="cs-tlacitko" data-cs-zavrit title="Zavřít (Esc)" aria-label="Zavřít">×</button>
            </span>
        </div>
        <div class="cs-postup"><span></span></div>`;
    document.body.append(okno);
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const krokBtn = /** @type {HTMLElement | null} */ (t.closest('[data-cs-krok]'));
        const int = /** @type {HTMLElement | null} */ (t.closest('[data-cs-interval]'));
        if (t.closest('[data-cs-zavrit]')) zavrit();
        else if (krokBtn) krok(parseInt(krokBtn.dataset.csKrok), true);
        else if (t.closest('[data-cs-prezentace]')) prepnoutPrezentaci();
        else if (int) nastavitInterval(parseInt(int.dataset.csInterval));
        else if (t.closest('.cs-scena')) krok(e.clientX < window.innerWidth / 3 ? -1 : 1, true);
    });
    okno.addEventListener('mousemove', probudit);
    document.addEventListener('keydown', (e) => {
        if (okno.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
        const kroky = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
        if (e.key === ' ') krok(e.shiftKey ? -1 : 1, true);
        else if (e.key in kroky) krok(kroky[e.key], true);
        else if (e.key === 'Home') prejit(0, true);
        else if (e.key === 'End') prejit(strany.length - 1, true);
        else if (e.key === 'p' || e.key === 'P') prepnoutPrezentaci();
        else if (e.key === 'Escape') zavrit();
        else return;
        e.preventDefault();
        e.stopPropagation();
    }, true);
}

// Myš se pohnula: lišta a kurzor se ukážou a po chvíli klidu zase zmizí
function probudit() {
    okno.classList.remove('klid');
    clearTimeout(casovacKlidu);
    casovacKlidu = window.setTimeout(() => okno.classList.add('klid'), 2200);
}

function htmlFotek(s, kenBurns) {
    if (!s.fotky.length) return '';
    const x = s.vyrez?.x ?? 50, y = s.vyrez?.y ?? 35;
    // Ken Burns jen v prezentaci; střídavě přiblížení a oddálení
    const kb = kenBurns ? ` kb${index % 2 ? ' kb-ven' : ''}" style="--kb-x: ${x}%; --kb-y: ${y}%; --kb-t: ${interval + PROLNUTI_MS / 1000}s` : '';
    return `<div class="cs-fotky${s.fotky.length > 1 ? ' vic' : ''}${kb}">${s.fotky.map(f => {
        const otocena = f.rotace % 180 !== 0;
        return `<img src="${esc(obrazek(f.url, VELIKOST_STRANY))}" alt="" draggable="false"${f.rotace ? ` class="${otocena ? 'otocena' : ''}" style="transform: rotate(${f.rotace}deg)"` : ''}${s.vyrez && !f.rotace ? ` style="object-position: ${x}% ${y}%"` : ''} />`;
    }).join('')}</div>`;
}

function htmlStrany(s) {
    const kb = bezi && !omezitPohyb();
    const udaje = s.udaje?.length ? `<dl class="cs-udaje">${s.udaje.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
    switch (s.druh) {
        case 'obalka':
            return `<div class="cs-obalka">${htmlFotek(s, kb)}<div class="cs-titulek"><b>${esc(s.nadpis)}</b>${s.popisek ? `<span>${esc(s.popisek)}</span>` : ''}</div></div>`;
        case 'uvod':
            return `<div class="cs-dvoustrana">
                <div class="cs-sloupec">
                    ${s.nadtitulek ? `<div class="cs-nadtitulek">${esc(s.nadtitulek)}</div>` : ''}
                    <h1>${esc(s.nadpis)}</h1>${udaje}
                    ${s.text ? `<div class="cs-text">${formatMarkdown(s.text)}</div>` : ''}
                    ${s.popisek ? `<div class="cs-popisek">${esc(s.popisek)}</div>` : ''}
                </div>
                <div class="cs-obraz">${htmlFotek(s, kb)}</div></div>`;
        case 'clanek':
            return `<article class="cs-clanek">
                <div class="cs-nadtitulek">${esc(s.nadtitulek)}${s.pokracovani ? ' · pokračování' : ''}</div>
                ${s.pokracovani ? `<h2>${esc(s.nadpis)}</h2>` : `<h1>${esc(s.nadpis)}</h1>`}
                ${s.autor ? `<div class="cs-autor">${esc(s.autor)}</div>` : ''}
                <div class="cs-sloupce clanek-text">${formatMarkdown(s.text, { perex: s.perex, mluvci: true }) || '<p class="cs-popisek">Článek zatím nemá text.</p>'}</div></article>`;
        default:
            return `<div class="cs-cela">${htmlFotek(s, kb)}${s.popisek ? `<div class="cs-popisek">${esc(s.popisek)}</div>` : ''}</div>`;
    }
}

// Obrázky následující strany se načtou předem, aby přechod nečekal
function nacistPredem(i) {
    strany[i]?.fotky.forEach(f => { new Image().src = obrazek(f.url, VELIKOST_STRANY); });
}

function vykreslit() {
    const s = strany[index];
    const scena = okno.querySelector('.cs-scena');
    const nova = document.createElement('section');
    nova.className = `cs-strana cs-${s.druh}-strana`;
    nova.innerHTML = htmlStrany(s);
    scena.querySelectorAll('.cs-strana:not(.odchazi)').forEach(stara => {
        stara.classList.add('odchazi');
        setTimeout(() => stara.remove(), PROLNUTI_MS);
    });
    scena.append(nova);
    requestAnimationFrame(() => nova.classList.add('vidi'));
    okno.querySelector('.cs-oddil').textContent = s.oddil || '';
    okno.querySelector('.cs-pocet').textContent = `${index + 1} / ${strany.length}`;
    /** @type {HTMLElement} */ (okno.querySelector('.cs-postup span')).style.width = `${((index + 1) / strany.length) * 100}%`;
    okno.querySelector('[data-cs-krok="-1"]').toggleAttribute('disabled', index === 0);
    okno.querySelector('[data-cs-krok="1"]').toggleAttribute('disabled', index === strany.length - 1);
    nacistPredem(index + 1);
}

function obnovitOvladani() {
    const tlacitko = okno.querySelector('[data-cs-prezentace]');
    tlacitko.textContent = bezi ? '❚❚ Pozastavit' : '▶ Prezentace';
    tlacitko.setAttribute('aria-pressed', String(bezi));
    okno.querySelectorAll('[data-cs-interval]').forEach(b => b.classList.toggle('active', parseInt(/** @type {HTMLElement} */ (b).dataset.csInterval) === interval));
}

function naplanovat() {
    clearTimeout(casovacPrezentace);
    if (!bezi) return;
    casovacPrezentace = window.setTimeout(() => {
        if (index >= strany.length - 1) {
            bezi = false;
            obnovitOvladani();
            okno.classList.remove('klid');
            return;
        }
        prejit(index + 1, false);
    }, interval * 1000);
}

function prejit(novy, rucne) {
    novy = Math.max(0, Math.min(strany.length - 1, novy));
    if (novy === index && okno.querySelector('.cs-strana')) return;
    index = novy;
    vykreslit();
    // Ruční krok v prezentaci odpočítává interval znovu
    if (bezi || !rucne) naplanovat();
}

const krok = (smer, rucne) => prejit(index + smer, rucne);

function prepnoutPrezentaci() {
    bezi = !bezi;
    if (bezi && index >= strany.length - 1) index = -1;
    obnovitOvladani();
    if (bezi) {
        okno.classList.add('klid');
        if (index < 0) prejit(0, false);
        else {
            // Aktuální strana dostane Ken Burns hned
            vykreslit();
            naplanovat();
        }
    } else clearTimeout(casovacPrezentace);
}

function nastavitInterval(s) {
    interval = platnyInterval(s) || 5;
    try { localStorage.setItem('casopisInterval', String(interval)); } catch { /* jen se nezapamatuje */ }
    obnovitOvladani();
    if (bezi) naplanovat();
    else prepnoutPrezentaci();
}

async function otevrit(noveStrany, titul) {
    if (!noveStrany.length) return oznamit('Není co prohlížet – zatím tu nejsou fotky ani texty.');
    if (!okno) vytvoritOkno();
    strany = noveStrany;
    nazev = titul;
    index = 0;
    bezi = false;
    try { interval = platnyInterval(localStorage.getItem('casopisInterval')) || 5; } catch { interval = 5; }
    okno.querySelector('.cs-nazev').textContent = nazev;
    okno.querySelector('.cs-scena').innerHTML = '';
    obnovitOvladani();
    okno.classList.remove('hidden');
    document.body.classList.add('casopis-otevren');
    vykreslit();
    probudit();
    okno.focus();
    bylaCelaObrazovka = await WindowIsFullscreen().catch(() => true);
    if (!bylaCelaObrazovka) WindowFullscreen();
}

function zavrit() {
    bezi = false;
    clearTimeout(casovacPrezentace);
    clearTimeout(casovacKlidu);
    okno.classList.add('hidden');
    document.body.classList.remove('casopis-otevren');
    okno.querySelector('.cs-scena').innerHTML = '';
    if (!bylaCelaObrazovka) WindowUnfullscreen();
}

export async function otevritCislo(vydani = stav.aktualniVydani) {
    if (!vydani) return;
    const [fotky, info, clanky, modelky] = await Promise.all([GetVydani(vydani).then(f => f || []), GetVydaniInfo(vydani).catch(() => null),
        GetClanky(vydani).then(c => c || []), vsechnyModelky()]);
    otevrit(stranyCisla({ vydani, alba: sestavitAlba(fotky), clanky, modelky, info }), `Playboy · ${nazevVydani(vydani)}`);
}

export async function otevritProfil(modelka = stav.aktualniModelka) {
    if (!modelka) return;
    const clanky = await GetClankyModelky(modelka.id).catch(() => []) || [];
    const alba = stav.aktualniModelka?.id === modelka.id ? stav.aktualniAlba || [] : [];
    otevrit(stranyProfilu({ modelka, titulni: modelka.coverUrl ? obrazek(modelka.coverUrl, VELIKOST_STRANY) : '', alba, clanky }), modelka.jmeno);
}

// Libovolné strany (Rok ve sbírce): stejné okno, ovládání i prezentace
export function otevritStrany(noveStrany, titul) {
    return otevrit(noveStrany, titul);
}

export function pripravit() {
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest?.('[data-casopis-cisla]')) otevritCislo();
        else if (t.closest?.('#casopisBtn')) otevritProfil();
    });
}
