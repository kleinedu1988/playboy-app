// Hromadné akce Údržby jednotně (ROADMAP 1.51.1): stejná lišta výběru ve všech režimech („Zobrazeno N“ a akce
// nad zobrazenými) a před provedením okno s rozdílem nanečisto – u každé položky co se změní z čeho na co.
// Provedení i Vrácení dělá volající (oznámení s Vrátit), tady je jen podoba a potvrzení.
import { esc, sklonovat } from '../lib/format';
import { drzetFokus } from './dom';

const NEJVIC_RADKU = 300;

/**
 * Lišta výběru nad seznamem
 * @param {{ pocet: number, jednotky?: [string, string, string], popis?: string, akce: { text: string, atribut: string, hlavni?: boolean, titulek?: string }[] }} o
 */
export function htmlListyVyberu({ pocet, jednotky = ['položka', 'položky', 'položek'], popis = '', akce }) {
    const tlacitka = akce.filter(Boolean).map(a => `<button type="button" class="btn ${a.hlavni ? 'btn-primary' : 'btn-secondary'} btn-small" ${a.atribut}${a.titulek ? ` title="${esc(a.titulek)}"` : ''}>${esc(a.text)}</button>`).join('');
    return `<div class="hv-lista" role="toolbar" aria-label="Hromadně">
        <span class="hv-pocet">Zobrazeno <b>${sklonovat(pocet, ...jednotky)}</b>${popis ? ` · ${esc(popis)}` : ''}</span>
        <span class="hv-akce">${tlacitka}</span></div>`;
}

let okno = null;
let vyresit = null;

function zavrit(vysledek) {
    okno?.classList.add('hidden');
    const r = vyresit;
    vyresit = null;
    r?.(vysledek);
}

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'hromadneModal';
    okno.innerHTML = `<div class="modal-card hv-karta" role="dialog" aria-modal="true" aria-labelledby="hvNadpis">
        <div class="modal-header"><h3 id="hvNadpis"></h3><button class="close-btn" data-hv-zrusit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <p class="hv-souhrn" data-hv-souhrn></p>
        <div class="hv-rozdil" data-hv-rozdil></div>
        <p class="pass-hint" data-hv-poznamka></p>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-hv-zrusit>Zrušit</button>
            <button type="button" class="btn btn-primary" data-hv-provest></button>
        </div></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest('[data-hv-provest]')) zavrit(true);
        else if (t.closest('[data-hv-zrusit]') || t === okno) zavrit(false);
    });
    okno.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); zavrit(false); }
    });
}

/**
 * Rozdíl nanečisto a potvrzení; true = provést
 * @param {{ nadpis: string, souhrn: string, radky: { kdo: string, co: string, pred: string, po: string }[], tlacitko: string, poznamka?: string }} o
 * @returns {Promise<boolean>}
 */
export function potvrditRozdil({ nadpis, souhrn, radky, tlacitko, poznamka = 'Nic se nezmění, dokud nepotvrdíš. Potom jde všechno vrátit tlačítkem Vrátit v oznámení.' }) {
    if (!okno) vytvoritOkno();
    if (vyresit) zavrit(false);
    okno.querySelector('#hvNadpis').textContent = nadpis;
    okno.querySelector('[data-hv-souhrn]').textContent = souhrn;
    okno.querySelector('[data-hv-poznamka]').textContent = poznamka;
    okno.querySelector('[data-hv-provest]').textContent = tlacitko;
    const ukazane = radky.slice(0, NEJVIC_RADKU);
    okno.querySelector('[data-hv-rozdil]').innerHTML = `<table class="hv-tabulka"><thead><tr><th>Kde</th><th>Co</th><th>Teď</th><th></th><th>Potom</th></tr></thead><tbody>
        ${ukazane.map(r => `<tr><td>${esc(r.kdo)}</td><td>${esc(r.co)}</td><td class="hv-pred">${esc(r.pred || '—')}</td><td aria-hidden="true">→</td><td class="hv-po">${esc(r.po || '—')}</td></tr>`).join('')}
        </tbody></table>${radky.length > ukazane.length ? `<p class="pass-hint">… a ${sklonovat(radky.length - ukazane.length, 'další', 'další', 'dalších')}.</p>` : ''}`;
    okno.classList.remove('hidden');
    /** @type {HTMLElement} */ (okno.querySelector('[data-hv-provest]')).focus();
    return new Promise(r => { vyresit = r; });
}
