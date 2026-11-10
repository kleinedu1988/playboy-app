// Tagy fotek z pevného seznamu (tagy_fotek.go): panel nad lištou výběru fotek. Skupiny jako řady pilulek; pilulka
// svítí, když tag mají všechny vybrané fotky, napůl, když jen některé. Klik tag přidá všem (ve výlučné skupině
// nahradí dosavadní hodnotu), u tagu, který mají všechny, ho odebere. Esc nebo klik mimo panel zavře.
import { GetKatalogTagu, GetTagyFotek, SetTagyFotek } from './backend';
import { esc } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { naCss } from '../ui/vzhled';

let katalog = null;
export async function katalogTagu() {
    if (!katalog) {
        try { katalog = await GetKatalogTagu() || []; } catch { katalog = []; }
    }
    return katalog;
}

let panel = null;
let ids = [];
let tagy = {}; // id fotky → [tagy]

function zavrit() {
    panel?.remove();
    panel = null;
    document.removeEventListener('pointerdown', klikMimo, true);
    document.removeEventListener('keydown', klavesa, true);
}

function klikMimo(e) {
    if (panel && !panel.contains(e.target) && !e.target.closest?.('[data-vyber="tagy"]')) zavrit();
}

function klavesa(e) {
    if (e.key !== 'Escape' || !panel) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    zavrit();
}

// Kolik vybraných fotek tag má
const pocetSTagem = tag => ids.filter(id => (tagy[id] || []).includes(tag)).length;

function vykreslit() {
    if (!panel) return;
    panel.innerHTML = `<div class="tp-hlava"><b>Tagy</b><small>${ids.length === 1 ? '1 fotka' : `${ids.length} vybraných fotek`}</small>
            <button type="button" class="tp-zavrit" data-tp-zavrit aria-label="Zavřít" title="Zavřít (Esc)">&times;</button></div>
        ${katalog.map(sk => `<div class="tp-skupina"><span class="tp-nazev">${esc(sk.nazev)}${sk.vylucna ? '' : ' <small>víc</small>'}</span>
            <div class="tp-tagy">${sk.tagy.map(t => {
        const n = pocetSTagem(t.klic);
        const stavTagu = n === ids.length ? 'on' : n ? 'castecne' : '';
        return `<button type="button" class="tp-tag ${stavTagu}" data-tp-tag="${esc(t.klic)}" aria-pressed="${n === ids.length}" title="${esc(n && n < ids.length ? `${t.nazev}: má ${n} z ${ids.length}` : t.nazev)}">${esc(t.nazev)}</button>`;
    }).join('')}</div></div>`).join('')}`;
}

/**
 * Otevře panel tagů pro fotky (id) nad prvkem kotva; další otevření ho zavře.
 * @param {number[]} fotky
 * @param {HTMLElement} kotva
 */
export async function otevritPanelTagu(fotky, kotva) {
    if (panel) return zavrit();
    if (!fotky.length) return;
    await katalogTagu();
    ids = fotky;
    try { tagy = await GetTagyFotek(ids) || {}; } catch { tagy = {}; }
    panel = document.createElement('div');
    panel.className = 'tagy-panel plovouci-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Tagy vybraných fotek');
    document.getElementById('app').append(panel);
    vykreslit();
    const r = kotva.getBoundingClientRect();
    panel.style.left = `${naCss(Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, r.left + r.width / 2 - panel.offsetWidth / 2)))}px`;
    panel.style.bottom = `${window.innerHeight - r.top + 10}px`;
    panel.addEventListener('click', async (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        if (cil.closest('[data-tp-zavrit]')) return zavrit();
        const tag = /** @type {HTMLElement | null} */ (cil.closest('[data-tp-tag]'))?.dataset.tpTag;
        if (!tag) return;
        const vsechny = pocetSTagem(tag) === ids.length;
        let ok = false;
        try { ok = await SetTagyFotek(ids, vsechny ? [] : [tag], vsechny ? [tag] : []); } catch { /* oznámí se níž */ }
        if (!ok) return oznamit('Tagy se nepodařilo uložit.');
        try { tagy = await GetTagyFotek(ids) || {}; } catch { /* zůstane poslední stav */ }
        vykreslit();
        document.dispatchEvent(new CustomEvent('tagy-fotek', { detail: { ids } }));
    });
    document.addEventListener('pointerdown', klikMimo, true);
    document.addEventListener('keydown', klavesa, true);
}

export const panelTaguOtevren = () => Boolean(panel);
export const zavritPanelTagu = zavrit;
