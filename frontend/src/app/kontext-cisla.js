// Kontext čísla v profilu modelky: štítky čísel (v albech i v údajích) dostanou malý náhled obálky a po najetí
// (nebo zaměření klávesnicí) bublinu – obálka, Playmate měsíce, další modelky v čísle a přechod na předchozí
// a následující číslo téže edice. Bublina leží v <main>, takže klik na číslo či modelku obslouží prohlizec.js.
import { GetKalendar } from './backend';
import { esc, nazevVydani, obrazek, titulCisla } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { modelkyVCisle, sousedniCisla } from '../lib/kontext-cisla';
import { VELIKOST_NAHLEDU } from './obrazky';
import { naCss } from '../ui/vzhled';

/** @type {Promise<any[]> | null} */
let kalendar = null;
let bublina = null;
let casovac = 0;
let aktualniStitek = null;

function nacistKalendar() {
    kalendar ||= GetKalendar().then(k => k || []).catch(() => { kalendar = null; return []; });
    return kalendar;
}

// Náhled obálky u štítků čísel v profilu (jen jednou na štítek)
async function doplnitObalky() {
    const stitky = [...document.querySelectorAll('#detailView .chip[data-vydani]:not([data-obalka])')];
    if (!stitky.length) return;
    stitky.forEach(s => s.setAttribute('data-obalka', ''));
    const podleVydani = new Map((await nacistKalendar()).map(k => [k.vydani, k]));
    for (const s of stitky) {
        const k = podleVydani.get(/** @type {HTMLElement} */ (s).dataset.vydani);
        if (k?.nahled && s.isConnected) s.insertAdjacentHTML('afterbegin', `<img class="stitek-obalka" src="${esc(obrazek(k.nahled, 'w100'))}" alt="" draggable="false" loading="lazy" />`);
    }
}

function zavritBublinu() {
    clearTimeout(casovac);
    aktualniStitek = null;
    bublina?.classList.add('hidden');
}

async function ukazatBublinu(stitek) {
    const vydani = stitek.dataset.vydani;
    const [seznam, modelky] = await Promise.all([nacistKalendar(), vsechnyModelky()]);
    if (aktualniStitek !== stitek || !stitek.isConnected) return;
    const k = seznam.find(x => x.vydani === vydani);
    const idProfilu = stav.aktualniModelka?.id || 0;
    const ostatni = modelkyVCisle(modelky, vydani, idProfilu);
    const { predchozi, dalsi } = sousedniCisla(seznam, vydani);
    if (!bublina) {
        bublina = document.createElement('div');
        bublina.className = 'bublina-cisla hidden';
        bublina.setAttribute('role', 'tooltip');
        bublina.addEventListener('mouseenter', () => clearTimeout(casovac));
        bublina.addEventListener('mouseleave', () => { casovac = window.setTimeout(zavritBublinu, 250); });
        bublina.addEventListener('click', () => zavritBublinu());
        document.querySelector('main').append(bublina);
    }
    const playmate = k?.modelka ? `<div class="bc-radek"><span>${esc(titulCisla(vydani, 'kratky'))}</span><b>${esc(k.modelka)}</b></div>` : '';
    const dalsiModelky = ostatni.length
        ? `<div class="bc-radek"><span>V čísle</span><span class="bc-modelky">${ostatni.slice(0, 8).map(m => `<button class="chip" data-modelka="${m.id}" title="${esc(m.role.join(', '))}">${esc(m.jmeno)}</button>`).join(' ')}${ostatni.length > 8 ? ` <small>+${ostatni.length - 8}</small>` : ''}</span></div>` : '';
    const krok = (v, sipka, popis) => v
        ? `<button class="volba" data-vydani="${esc(v)}" title="${popis}: ${esc(nazevVydani(v))}">${sipka === '‹' ? `‹ ${esc(nazevVydani(v))}` : `${esc(nazevVydani(v))} ›`}</button>` : '<span></span>';
    bublina.innerHTML = `
        ${k?.nahled ? `<img class="bc-obalka" src="${esc(obrazek(k.nahled, VELIKOST_NAHLEDU))}" alt="" draggable="false" />` : ''}
        <div class="bc-text">
            <button class="bc-nazev" data-vydani="${esc(vydani)}">${esc(nazevVydani(vydani))}</button>
            ${playmate}${dalsiModelky}
            ${!k ? '<small class="bc-pozn">Číslo nemá ve sbírce cover ani centerfold.</small>' : ''}
            <div class="bc-kroky">${krok(predchozi, '‹', 'Předchozí číslo')}${krok(dalsi, '›', 'Následující číslo')}</div>
        </div>`;
    bublina.classList.remove('hidden');
    // Pod štítkem, při kraji okna nad ním / posunutá doleva
    const r = stitek.getBoundingClientRect();
    const b = bublina.getBoundingClientRect();
    const vlevo = Math.max(8, Math.min(r.left, window.innerWidth - b.width - 8));
    const nahore = r.bottom + 6 + b.height > window.innerHeight ? Math.max(8, r.top - 6 - b.height) : r.bottom + 6;
    bublina.style.left = `${naCss(vlevo)}px`;
    bublina.style.top = `${naCss(nahore)}px`;
}

function naplanovat(stitek) {
    clearTimeout(casovac);
    if (aktualniStitek === stitek && !bublina?.classList.contains('hidden')) return;
    aktualniStitek = stitek;
    casovac = window.setTimeout(() => ukazatBublinu(stitek), 400);
}

export function pripravit() {
    const profil = document.getElementById('detailView');
    if (!profil) return;
    new MutationObserver(() => {
        // Nový profil: kalendář se načte znovu (mohly přibýt covery), bublina z minula zmizí
        if (!document.querySelector('#detailView .chip[data-vydani]:not([data-obalka])')) return;
        kalendar = null;
        zavritBublinu();
        doplnitObalky();
    }).observe(profil, { childList: true, subtree: true });
    const stitekZ = (/** @type {Event} */ e) => /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('#detailView [data-vydani]'));
    profil.addEventListener('mouseover', (e) => {
        const s = stitekZ(e);
        if (s) naplanovat(s);
    });
    profil.addEventListener('mouseout', (e) => {
        const s = stitekZ(e);
        if (s && !s.contains(/** @type {Node} */ (e.relatedTarget))) {
            clearTimeout(casovac);
            casovac = window.setTimeout(zavritBublinu, 250);
        }
    });
    profil.addEventListener('focusin', (e) => {
        const s = stitekZ(e);
        if (s) naplanovat(s);
    });
    profil.addEventListener('focusout', () => { casovac = window.setTimeout(zavritBublinu, 250); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zavritBublinu(); });
    document.querySelector('main').addEventListener('scroll', zavritBublinu, { passive: true });
    document.addEventListener('click', (e) => {
        if (!/** @type {HTMLElement} */ (e.target).closest?.('.bublina-cisla')) zavritBublinu();
    });
}
