// Kapesní katalog offline (ROADMAP 1.47): okno z nabídky ⋯ › Zálohy a data. Volba rozsahu (celá sbírka / česká
// edice / sháněná čísla) s počty a velikostí před uložením; Uložit do složky… vytvoří složku s index.html
// a náhledy z mezipaměti (kapesni_katalog.go), kterou jde nahrát do telefonu a otevřít v prohlížeči bez sítě.
import { GetNahledyKatalogu, GetPodkladyKatalogu, UlozitKatalog } from './backend';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { esc, sklonovat } from '../lib/format';
import { ROZSAHY, htmlKatalogu, polozkyKatalogu, souhrnKatalogu } from '../lib/kapesni-katalog';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import { velikost } from './zdravi';

let okno = null;
/** @type {any[] | null} */
let podklady = null;
let rozsah = 'vse';
let pozadavek = 0;

const dnes = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'kapesniKatalogModal';
    okno.innerHTML = `<div class="modal-card kk-karta" role="dialog" aria-modal="true" aria-labelledby="kkNadpis">
        <div class="modal-header"><h3 id="kkNadpis">Kapesní katalog</h3><button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <p class="pass-hint">Jedna stránka s čísly, Playmate a stavem výtisku do telefonu – funguje v prohlížeči i bez připojení. Plné fotky se nekopírují, jen malé náhledy obálek.</p>
        <div class="kk-rozsahy" role="radiogroup" aria-label="Co do katalogu" data-kk-rozsahy></div>
        <p class="kk-velikost" data-kk-velikost aria-live="polite"></p>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-zavrit>Zavřít</button>
            <button type="button" class="btn btn-primary" data-kk-ulozit disabled>Uložit do složky…</button>
        </div></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('change', (e) => {
        const t = /** @type {HTMLInputElement} */ (e.target);
        if (t.name !== 'kkRozsah') return;
        rozsah = t.value;
        try { localStorage.setItem('katalogRozsah', rozsah); } catch { /* jen se nezapamatuje */ }
        odhadnout();
    });
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest('[data-kk-ulozit]')) ulozit();
        else if (t.closest('[data-zavrit]')) okno.classList.add('hidden');
    });
}

const polozky = (r = rozsah) => polozkyKatalogu(podklady || [], r, dnes());

function vykreslitRozsahy() {
    okno.querySelector('[data-kk-rozsahy]').innerHTML = ROZSAHY.map(([klic, nazev, popis]) => {
        const s = souhrnKatalogu(polozky(klic));
        const casti = [s.mam && `${s.mam} mám`, s.shanim && `${s.shanim} sháním`, s.chybi && `${s.chybi} chybí`].filter(Boolean).join(' · ');
        return `<label class="kk-rozsah"><input type="radio" name="kkRozsah" value="${klic}"${klic === rozsah ? ' checked' : ''} />
            <span><b>${esc(nazev)}</b> <small>${sklonovat(s.cisel, 'číslo', 'čísla', 'čísel')}${casti ? ` · ${esc(casti)}` : ''}</small><br><small>${esc(popis)}</small></span></label>`;
    }).join('');
}

async function odhadnout() {
    const cislo = ++pozadavek;
    const p = polozky();
    const misto = okno.querySelector('[data-kk-velikost]');
    const tlacitko = /** @type {HTMLButtonElement} */ (okno.querySelector('[data-kk-ulozit]'));
    tlacitko.disabled = !p.length;
    if (!p.length) {
        misto.textContent = 'V tomto rozsahu není žádné číslo.';
        return;
    }
    misto.textContent = 'Počítám velikost…';
    const n = await GetNahledyKatalogu(p.map(x => x.f).filter(Boolean)).catch(() => null);
    if (cislo !== pozadavek) return;
    const html = htmlKatalogu(p, { vytvoreno: '', rozsah }).length;
    misto.innerHTML = n
        ? `Asi <b>${esc(velikost(n.bajtu + html))}</b> · ${sklonovat(n.ulozenych, 'náhled', 'náhledy', 'náhledů')} obálek${n.chybi ? ` · ${n.chybi} bez uloženého náhledu (v katalogu jen prázdný rámeček; pomůže ⋯ › Stáhnout náhledy celé sbírky)` : ''}`
        : '';
}

async function ulozit() {
    const p = polozky();
    if (!p.length) return;
    const vytvoreno = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const v = await UlozitKatalog(htmlKatalogu(p, { vytvoreno, rozsah }), p.map(x => x.f).filter(Boolean)).catch(e => ({ slozka: '', nahledu: 0, chybi: 0, bajtu: 0, chyba: String(e) }));
    if (v?.chyba) return oznamit(`Katalog se nepodařilo uložit: ${v.chyba}`);
    if (!v?.slozka) return;
    okno.classList.add('hidden');
    oznamit(`Katalog uložen (${sklonovat(p.length, 'číslo', 'čísla', 'čísel')}, ${velikost(v.bajtu)}) do ${v.slozka}. Celou složku nahraj do telefonu a otevři index.html.`,
        { text: 'Otevřít složku', akce: () => BrowserOpenURL('file://' + v.slozka) });
}

export async function otevritKapesniKatalog() {
    if (!okno) vytvoritOkno();
    try { rozsah = localStorage.getItem('katalogRozsah') || 'vse'; } catch { rozsah = 'vse'; }
    if (!ROZSAHY.some(([k]) => k === rozsah)) rozsah = 'vse';
    okno.classList.remove('hidden');
    okno.querySelector('[data-kk-rozsahy]').innerHTML = '<p class="pass-hint">Načítám čísla…</p>';
    okno.querySelector('[data-kk-velikost]').textContent = '';
    podklady = await GetPodkladyKatalogu().catch(() => []) || [];
    if (okno.classList.contains('hidden')) return;
    vykreslitRozsahy();
    odhadnout();
    /** @type {HTMLElement | null} */ (okno.querySelector('input[name="kkRozsah"]:checked'))?.focus();
}
