// Úprava výřezu náhledu fotky (0.02.058): okno s celou fotkou, bodem zájmu (táhnout nebo kliknout) a přiblížením;
// vedle živé náhledy ve třech tvarech rámu (dlaždice, čtverec, široký pás). Uloží ruční výřez (SetRucniVyrez,
// platí pro soubor ve všech albech) nebo vrátí automatický. Otevírá se z nabídky fotky (akce-fotky.js) a z Údržby.
import { GetVyrezyFotek, SetRucniVyrez, SmazatRucniVyrez } from './backend';
import { cssPolohy, polohaNahledu, priblizeniNahledu } from '../lib/vyrez-nahledu';
import { obrazek } from '../lib/format';
import { VELIKOST_TITULNI } from './obrazky';
import { obnovitVyrez } from './vyrez-nahledu';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

/** @type {HTMLElement | null} */
let okno = null;
let cil = { id: '', bod: [0.5, 0.5], zoom: 1, rucni: false, poUlozeni: () => {} };
let tazeni = false;

// Rámy náhledů: [třída, poměr šířka/výška, popis]
/** @type {Array<[string, number, string]>} */
const RAMY = [['dlazdice', 3 / 4, 'Dlaždice'], ['ctverec', 1, 'Čtverec'], ['pas', 16 / 9, 'Široký pás']];

// Výchozí bod: ruční, jinak obličej, jinak střed postavy, jinak střed fotky
export function vychoziBod(v) {
    if (v?.bod?.length === 2) return { bod: [v.bod[0], v.bod[1]], zoom: v.zoom || 1, rucni: true };
    const r = v?.oblicej?.length === 4 ? v.oblicej : v?.postava?.length === 4 ? v.postava : null;
    return { bod: r ? [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2] : [0.5, 0.5], zoom: 1, rucni: false };
}

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'vyrezFotkyModal';
    okno.innerHTML = `<div class="modal-card vf-karta" role="dialog" aria-modal="true" aria-labelledby="vfNadpis">
        <div class="modal-header"><h3 id="vfNadpis">Výřez náhledu</h3><button class="close-btn" data-vf-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <p class="vf-napoveda">Klikni nebo táhni na místo, které má být v náhledech vidět (obvykle obličej). Výřez platí pro fotku ve všech albech a pohledech.</p>
        <div class="vf-telo">
            <div class="vf-fotka" data-vf-plocha><img alt="" draggable="false" /><span class="vf-bod" aria-hidden="true"></span></div>
            <div class="vf-nahledy">${RAMY.map(([k, pomer, popis]) => `<figure class="vf-ram vf-${k}" style="aspect-ratio:${pomer}"><img alt="" draggable="false" /><figcaption>${popis}</figcaption></figure>`).join('')}
                <label class="vf-zoom">Přiblížení <input type="range" min="1" max="4" step="0.05" data-vf-zoom /><span data-vf-zoom-text></span></label>
            </div>
        </div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-vf-auto title="Smazat ruční výřez; náhledy se zase řídí detektorem postavy">Automaticky</button>
            <span class="vf-mezera"></span>
            <button type="button" class="btn btn-secondary" data-vf-zavrit>Zrušit</button>
            <button type="button" class="btn btn-primary" data-vf-ulozit>Uložit výřez</button>
        </div></div>`;
    document.getElementById('app').append(okno);
    drzetFokus(okno);
    const plocha = /** @type {HTMLElement} */ (okno.querySelector('[data-vf-plocha]'));
    const nastavitZUdalosti = (/** @type {PointerEvent} */ e) => {
        const img = /** @type {HTMLImageElement} */ (plocha.querySelector('img'));
        const r = img.getBoundingClientRect();
        if (!r.width || !r.height) return;
        cil.bod = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
        vykreslit();
    };
    plocha.addEventListener('pointerdown', (e) => {
        tazeni = true;
        plocha.setPointerCapture(e.pointerId);
        nastavitZUdalosti(e);
    });
    plocha.addEventListener('pointermove', (e) => { if (tazeni) nastavitZUdalosti(e); });
    ['pointerup', 'pointercancel'].forEach(t => plocha.addEventListener(t, () => { tazeni = false; }));
    okno.addEventListener('input', (e) => {
        const t = /** @type {HTMLInputElement} */ (e.target);
        if (t.matches('[data-vf-zoom]')) {
            cil.zoom = Number(t.value) || 1;
            vykreslit();
        }
    });
    okno.addEventListener('click', async (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest('[data-vf-zavrit]') || t === okno) return zavrit();
        if (t.closest('[data-vf-ulozit]')) {
            const ok = await SetRucniVyrez(cil.id, Math.round(cil.bod[0] * 1000) / 10, Math.round(cil.bod[1] * 1000) / 10, cil.zoom);
            if (!ok) return oznamit('Výřez se nepodařilo uložit.');
            hotovo('Výřez náhledu uložen.');
        } else if (t.closest('[data-vf-auto]')) {
            if (!await SmazatRucniVyrez(cil.id)) return oznamit('Výřez se nepodařilo vrátit.');
            hotovo('Náhledy se zase řídí automatickým výřezem.');
        }
    });
    okno.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            zavrit();
        } else if (e.key === 'Enter' && !(/** @type {HTMLElement} */ (e.target)).closest('button')) {
            /** @type {HTMLElement} */ (okno.querySelector('[data-vf-ulozit]')).click();
        }
    });
    // Přepočet náhledů, až se načte obrázek (poměr stran)
    okno.querySelectorAll('img').forEach(img => img.addEventListener('load', vykreslit));
}

function hotovo(text) {
    obnovitVyrez(cil.id);
    const po = cil.poUlozeni;
    zavrit();
    oznamit(text);
    po();
}

function zavrit() {
    okno?.classList.add('hidden');
    tazeni = false;
}

function vykreslit() {
    if (!okno) return;
    const hlavni = /** @type {HTMLImageElement} */ (okno.querySelector('[data-vf-plocha] img'));
    const bod = /** @type {HTMLElement} */ (okno.querySelector('.vf-bod'));
    bod.style.left = `${cil.bod[0] * 100}%`;
    bod.style.top = `${cil.bod[1] * 100}%`;
    const posuvnik = /** @type {HTMLInputElement} */ (okno.querySelector('[data-vf-zoom]'));
    posuvnik.value = String(cil.zoom);
    /** @type {HTMLElement} */ (okno.querySelector('[data-vf-zoom-text]')).textContent = `${cil.zoom.toFixed(2).replace('.', ',')}×`;
    /** @type {HTMLElement} */ (okno.querySelector('[data-vf-auto]')).hidden = !cil.rucni;
    const pomer = hlavni.naturalWidth && hlavni.naturalHeight ? hlavni.naturalWidth / hlavni.naturalHeight : 0;
    if (!pomer) return;
    const v = { bod: cil.bod, zoom: cil.zoom };
    okno.querySelectorAll('.vf-ram').forEach((ram, i) => {
        const img = /** @type {HTMLImageElement} */ (ram.querySelector('img'));
        const pomerRamu = RAMY[i][1];
        img.style.objectPosition = cssPolohy(polohaNahledu(v, pomer, pomerRamu));
        const p = priblizeniNahledu(v, pomer, pomerRamu);
        img.style.scale = p ? String(p.zoom) : '';
        img.style.transformOrigin = p ? p.origin : '';
    });
}

/**
 * Otevře úpravu výřezu fotky
 * @param {{ driveId?: string, url?: string }} fotka @param {{ poUlozeni?: () => void }} [volby]
 */
export async function upravitVyrezFotky(fotka, { poUlozeni = () => {} } = {}) {
    if (!fotka?.driveId || !fotka.url) return;
    if (!okno) vytvoritOkno();
    const [v] = (await GetVyrezyFotek([fotka.driveId]).catch(() => null)) || [];
    cil = { id: fotka.driveId, ...vychoziBod(v), poUlozeni };
    const adresa = obrazek(fotka.url, VELIKOST_TITULNI);
    okno.querySelectorAll('img').forEach(img => { if (/** @type {HTMLImageElement} */ (img).src !== adresa) /** @type {HTMLImageElement} */ (img).src = adresa; });
    // Nahoru přes ostatní okna (i prohlížeč fotek)
    document.getElementById('app').append(okno);
    okno.classList.remove('hidden');
    vykreslit();
    /** @type {HTMLElement} */ (okno.querySelector('[data-vf-ulozit]')).focus();
}
