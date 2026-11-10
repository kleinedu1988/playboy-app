// Karta Objevit v Přehledu (ROADMAP 1.53, objevit.go): modelky bez srdíček s nejvyšším odhadem a nehodnocená alba,
// která by se ti podle obsahu fotek měla líbit, s důvodem. Karta je značka [data-objevit], plní ji MutationObserver
// (jako chytré výběry), klik otevře profil.
import { GetObjevit } from './backend';
import { esc, obrazek } from '../lib/format';
import { textSrdicek } from '../lib/srdicka';
import { adresaTitulni } from './obrazky';
import { vsechnyModelky } from './mezipamet';
import { otevritProfilPodleId } from './cover';
import { poZmeneDat } from './udalosti';

const POCET = 6;
let nacteni = null;

async function html() {
    nacteni ||= GetObjevit(POCET).catch(() => null);
    const [o, katalog] = await Promise.all([nacteni, vsechnyModelky()]);
    if (!o || (!o.modelky.length && !o.alba.length)) return '';
    const podleId = new Map(katalog.map(m => [m.id, m]));
    const srdicka = x => textSrdicek(Math.round(x * 2) / 2);
    const modelky = o.modelky.map(t => {
        const m = podleId.get(t.modelkaId);
        return `<button type="button" data-objevit-modelku="${t.modelkaId}" title="${esc(t.duvod)}">${m ? `<img src="${esc(adresaTitulni(m))}" alt="" loading="lazy" draggable="false" />` : ''}<span>${esc(t.jmeno)}<small>${esc(t.duvod.split(/[;:]/)[0])}</small></span><b>~${esc(srdicka(t.odhad))}</b></button>`;
    }).join('');
    const alba = o.alba.map(t => `<button type="button" data-objevit-modelku="${t.modelkaId}" title="${esc(`${t.duvod} · ${t.fotek} fotek`)}"><img src="${esc(obrazek(t.nahled, 'w200'))}" alt="" loading="lazy" draggable="false" /><span>${esc(t.album || t.typ)}<small>${esc([t.jmeno, `${t.fotek} fotek bez srdíček`].filter(Boolean).join(' · '))}</small></span><b>~${esc(srdicka(t.odhad))}</b></button>`).join('');
    return `<h4>Objevit<small>nehodnocené, které se ti podle vkusu a podobných modelek nejspíš budou líbit</small></h4>
        <div class="ob-sloupce">${modelky ? `<div class="ob-seznam"><h5>Modelky</h5>${modelky}</div>` : ''}${alba ? `<div class="ob-seznam"><h5>Alba</h5>${alba}</div>` : ''}</div>`;
}

async function naplnit() {
    const mista = [...document.querySelectorAll('[data-objevit]:not([data-objevit-hotovo])')];
    if (!mista.length) return;
    mista.forEach(m => m.setAttribute('data-objevit-hotovo', ''));
    const obsah = await html();
    for (const m of mista) {
        if (!m.isConnected) continue;
        m.innerHTML = obsah;
        /** @type {HTMLElement} */ (m).hidden = !obsah;
    }
}

export function pripravit() {
    new MutationObserver(() => {
        if (document.querySelector('[data-objevit]:not([data-objevit-hotovo])')) naplnit();
    }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    poZmeneDat(() => { nacteni = null; document.querySelectorAll('[data-objevit]').forEach(m => m.removeAttribute('data-objevit-hotovo')); naplnit(); });
    document.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-objevit-modelku]'));
        if (b && Number(b.dataset.objevitModelku) > 0) otevritProfilPodleId(Number(b.dataset.objevitModelku));
    });
}
