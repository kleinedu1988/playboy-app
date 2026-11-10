// Okno Časopisy (⋯ › Časopisy…, Pinup Katalog 0.02.013): seznam časopisů z tabulky (casopisy.go) a formulář
// pro nový časopis nebo úpravu: název, barva, edice (země vydání), titul modelky měsíce a roku. Zkratka se po
// založení nemění (je v klíčích čísel). Smazat jde jen časopis bez čísel ve sbírce, Playboy ne; edici, která
// má čísla, backend nedovolí ubrat. Po uložení se registr časopisů načte znovu (volba „Časopis a edice“).
import { GetCasopisy, SmazatCasopis, UlozitCasopis } from './backend';
import { nacistSpecialy } from './mezipamet';
import { ohlasitZmenuDat } from './udalosti';
import { VYCHOZI_CASOPIS, esc } from '../lib/format';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

let okno = null;
/** @type {any[]} */
let casopisy = [];
// Upravovaný časopis (klíč), 'novy' = zakládá se, null = formulář zavřený
let upravovany = null;

const BARVA_NOVEHO = '#26a69a';

function htmlSeznamu() {
    return `<ul class="sc-seznam">${casopisy.map(c => `<li>
        <span class="sc-barva" style="background:${esc(c.barva || 'transparent')}" aria-hidden="true"></span>
        <span class="sc-nazev"><b>${esc(c.nazev)}</b> <small>${esc(c.klic)} · ${esc((c.edice || []).join(', '))}</small>
            <small class="sc-tituly">${esc([c.modelkaMesice, c.modelkaRoku].filter(Boolean).join(' · ') || 'bez titulu modelky')}</small></span>
        <button type="button" class="btn btn-secondary btn-small" data-sc-upravit="${esc(c.klic)}">Upravit</button>
        ${c.klic === VYCHOZI_CASOPIS ? '' : `<button type="button" class="btn btn-secondary btn-small" data-sc-smazat="${esc(c.klic)}" aria-label="Smazat ${esc(c.nazev)}">Smazat</button>`}
    </li>`).join('')}</ul>
    ${upravovany ? '' : '<button type="button" class="btn btn-secondary" data-sc-novy>+ Nový časopis</button>'}`;
}

function htmlFormulare() {
    if (!upravovany) return '';
    const novy = upravovany === 'novy';
    const c = novy ? { klic: '', nazev: '', barva: BARVA_NOVEHO, edice: ['US'], modelkaMesice: '', modelkaRoku: '' } : casopisy.find(x => x.klic === upravovany);
    if (!c) return '';
    const playboy = c.klic === VYCHOZI_CASOPIS;
    return `<form class="sc-formular" data-sc-formular>
        <h4 class="vz-oddil">${novy ? 'Nový časopis' : `Upravit ${esc(c.nazev)}`}</h4>
        <div class="form-row sc-radek">
            <div class="form-group"><label for="scNazev">Název</label><input id="scNazev" name="nazev" required value="${esc(c.nazev)}" autocomplete="off" /></div>
            <div class="form-group sc-klic"><label for="scKlic">Zkratka</label><input id="scKlic" name="klic" required maxlength="2" value="${esc(c.klic)}"
                ${novy ? '' : 'readonly title="Zkratka je v klíčích čísel (1985-09@PH), po založení se nemění"'} placeholder="OU" autocomplete="off" /></div>
            <div class="form-group sc-klic"><label for="scBarva">Barva</label><input id="scBarva" name="barva" type="color" value="${esc(c.barva || BARVA_NOVEHO)}" /></div>
        </div>
        <div class="form-group"><label for="scEdice">Edice (země vydání)</label><input id="scEdice" name="edice" value="${esc((c.edice || []).join(', '))}"
            ${playboy ? 'readonly title="Edice Playboye (US, CZ) určuje program"' : ''} placeholder="US, UK" autocomplete="off" />
            <small class="pass-hint">${playboy ? 'Edice Playboye určuje program.' : 'Zkratky zemí oddělené čárkou. Číslo edice US se píše bez přípony (1985-09@PH), ostatní s ní (1986-03-UK@PH).'}</small></div>
        <div class="form-row sc-radek">
            <div class="form-group"><label for="scMesice">Modelka měsíce</label><input id="scMesice" name="modelkaMesice" value="${esc(c.modelkaMesice || '')}" placeholder="Pet of the Month" autocomplete="off" /></div>
            <div class="form-group"><label for="scRoku">Modelka roku</label><input id="scRoku" name="modelkaRoku" value="${esc(c.modelkaRoku || '')}" placeholder="Pet of the Year" autocomplete="off" /></div>
        </div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-sc-zrusit>Zrušit</button>
            <button type="submit" class="btn btn-primary">${novy ? 'Přidat časopis' : 'Uložit'}</button>
        </div>
    </form>`;
}

async function vykreslit(fokus = '') {
    casopisy = await GetCasopisy().catch(() => []) || [];
    okno.querySelector('[data-sc-obsah]').innerHTML = htmlSeznamu() + htmlFormulare();
    /** @type {HTMLElement | null} */ (fokus ? okno.querySelector(fokus) : null)?.focus();
}

// Po uložení nebo smazání: registr časopisů (volby „Časopis a edice“, názvy čísel) a pohledy se načtou znovu
async function poZmene(zprava) {
    upravovany = null;
    ohlasitZmenuDat();
    await nacistSpecialy();
    await vykreslit('[data-sc-novy]');
    oznamit(zprava);
}

async function ulozit(formular) {
    const d = new FormData(formular);
    const hodnota = k => String(d.get(k) || '').trim();
    const novy = upravovany === 'novy';
    const casopis = {
        klic: hodnota('klic').toUpperCase(), nazev: hodnota('nazev'), barva: hodnota('barva'),
        edice: hodnota('edice').split(/[,\s]+/).filter(Boolean), modelkaMesice: hodnota('modelkaMesice'), modelkaRoku: hodnota('modelkaRoku'), poradi: 0,
    };
    const chyba = await UlozitCasopis(/** @type {any} */ (casopis), novy).catch(() => 'Časopis se nepodařilo uložit.');
    if (chyba) return oznamit(chyba);
    await poZmene(novy ? `Časopis ${casopis.nazev} přidán; v okně alba je ve volbě Časopis a edice.` : `Časopis ${casopis.nazev} uložen.`);
}

async function smazat(klic) {
    const c = casopisy.find(x => x.klic === klic);
    if (!c || !confirm(`Smazat časopis ${c.nazev}? Smazat jde jen časopis, který nemá ve sbírce žádné číslo.`)) return;
    const chyba = await SmazatCasopis(klic).catch(() => 'Časopis se nepodařilo smazat.');
    if (chyba) return oznamit(chyba);
    await poZmene(`Časopis ${c.nazev} smazán.`);
}

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'casopisyModal';
    okno.innerHTML = `<div class="modal-card vz-karta sc-karta" role="dialog" aria-modal="true" aria-labelledby="scNadpis">
        <div class="modal-header"><h3 id="scNadpis">Časopisy</h3><button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <div data-sc-obsah></div>
        <p class="pass-hint">Časopisy nabízí volba „Časopis a edice“ v okně alba, coveru a rychlého přidání. Titul modelky
            měsíce a roku se píše v profilu, kategoriích a typech alb (Pet of the Month).</p>
    </div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('submit', (e) => {
        e.preventDefault();
        ulozit(/** @type {HTMLFormElement} */ (e.target));
    });
    okno.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement} */ (e.target).closest('button');
        if (!b) return;
        if (b.matches('[data-zavrit]')) {
            upravovany = null;
            okno.classList.add('hidden');
        } else if (b.matches('[data-sc-novy]')) {
            upravovany = 'novy';
            vykreslit('#scNazev');
        } else if (b.dataset.scUpravit) {
            upravovany = b.dataset.scUpravit;
            vykreslit('#scNazev');
        } else if (b.matches('[data-sc-zrusit]')) {
            upravovany = null;
            vykreslit('[data-sc-novy]');
        } else if (b.dataset.scSmazat) smazat(b.dataset.scSmazat);
    });
}

export async function otevritCasopisy() {
    if (!okno) vytvoritOkno();
    upravovany = null;
    await vykreslit();
    okno.classList.remove('hidden');
    /** @type {HTMLElement | null} */ (okno.querySelector('[data-sc-novy]'))?.focus();
}
