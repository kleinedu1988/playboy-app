// Okno Vzhled (⋯ › Vzhled…, ROADMAP 1.49): přiblížení, hustota, velikost karet po pohledech a co ukazuje karta
// modelky, s živým náhledem (změna se projeví hned) a tlačítkem Výchozí. Ctrl + plus / minus / 0 mění přiblížení
// odkudkoli. Volby drží ui/vzhled.js.
import { PRIBLIZENI, POHLEDY_KARET, vychozi, vzhled, zmenit } from '../ui/vzhled';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

let okno = null;

const POPISY_POHLEDU = { modelky: 'Karty modelek', fotky: 'Všechny fotky', steny: 'Centerfoldy' };
const POPISY_VELIKOSTI = { s: 'Malé', m: 'Střední', l: 'Velké' };
const procenta = p => `${Math.round(p * 100)} %`;

function htmlObsahu() {
    const v = vzhled();
    const prepinac = (atribut, hodnoty, zvolena) => hodnoty.map(([k, text]) =>
        `<button type="button" ${atribut}="${k}" aria-pressed="${k === zvolena}">${text}</button>`).join('');
    return `
        <div class="vz-radek"><span class="vz-popis">Přiblížení</span><div class="vz-volby">
            <input type="range" min="${PRIBLIZENI.min}" max="${PRIBLIZENI.max}" step="${PRIBLIZENI.krok}" value="${v.priblizeni}" data-vz-priblizeni aria-label="Přiblížení" />
            <span class="vz-hodnota" data-vz-procenta>${procenta(v.priblizeni)}</span></div></div>
        <div class="vz-radek"><span class="vz-popis">Hustota</span><div class="vz-volby" role="group" aria-label="Hustota">
            ${prepinac('data-vz-hustota', [['pohodlna', 'Pohodlná'], ['kompaktni', 'Kompaktní']], v.hustota)}</div></div>
        ${POHLEDY_KARET.map(p => `<div class="vz-radek"><span class="vz-popis">${POPISY_POHLEDU[p]}</span><div class="vz-volby" role="group" aria-label="${POPISY_POHLEDU[p]}">
            ${prepinac(`data-vz-karty="${p}" data-vz-velikost`, Object.entries(POPISY_VELIKOSTI), v.karty[p])}</div></div>`).join('')}
        <div class="vz-radek"><span class="vz-popis">Na kartě modelky</span><div class="vz-volby">
            <label><input type="checkbox" data-vz-karta="srdicka"${v.karta.srdicka ? ' checked' : ''} /> srdíčka</label>
            <label><input type="checkbox" data-vz-karta="rok"${v.karta.rok ? ' checked' : ''} /> rok prvního čísla</label>
            <label><input type="checkbox" data-vz-karta="fotek"${v.karta.fotek ? ' checked' : ''} /> počet fotek</label></div></div>`;
}

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'vzhledModal';
    okno.innerHTML = `<div class="modal-card vz-karta" role="dialog" aria-modal="true" aria-labelledby="vzNadpis">
        <div class="modal-header"><h3 id="vzNadpis">Vzhled</h3><button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <div data-vz-obsah></div>
        <p class="pass-hint">Změny platí hned. Přiblížení mění i <kbd>Ctrl</kbd>+<kbd>+</kbd> a <kbd>Ctrl</kbd>+<kbd>-</kbd> (na české klávesnici plus a minus na numerické části) a <kbd>Ctrl</kbd>+<kbd>0</kbd> vrátí 100 %.</p>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-vz-vychozi>Výchozí</button>
            <button type="button" class="btn btn-primary" data-zavrit>Hotovo</button>
        </div></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('input', (e) => {
        const t = /** @type {HTMLInputElement} */ (e.target);
        if (!t.matches('[data-vz-priblizeni]')) return;
        const v = zmenit({ priblizeni: Number(t.value) });
        okno.querySelector('[data-vz-procenta]').textContent = procenta(v.priblizeni);
    });
    okno.addEventListener('change', (e) => {
        const t = /** @type {HTMLInputElement} */ (e.target);
        if (t.dataset.vzKarta) zmenit({ karta: { [t.dataset.vzKarta]: t.checked } });
    });
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const b = /** @type {HTMLElement | null} */ (t.closest('button'));
        if (!b) return;
        if (b.dataset.vzHustota) zmenit({ hustota: /** @type {any} */ (b.dataset.vzHustota) });
        else if (b.dataset.vzKarty) zmenit({ karty: { [b.dataset.vzKarty]: b.dataset.vzVelikost } });
        else if (b.matches('[data-vz-vychozi]')) zmenit(vychozi());
        else if (b.matches('[data-zavrit]')) return okno.classList.add('hidden');
        else return;
        vykreslit(b);
    });
}

// Překreslí volby a vrátí fokus na stejné tlačítko
function vykreslit(fokus = null) {
    const selektor = fokus ? [...fokus.attributes].filter(a => a.name.startsWith('data-vz')).map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : '';
    okno.querySelector('[data-vz-obsah]').innerHTML = htmlObsahu();
    if (selektor) /** @type {HTMLElement | null} */ (okno.querySelector(selektor))?.focus();
}

export function otevritVzhled() {
    if (!okno) vytvoritOkno();
    vykreslit();
    okno.classList.remove('hidden');
    /** @type {HTMLElement | null} */ (okno.querySelector('[data-vz-priblizeni]'))?.focus();
}

function zmenitPriblizeni(smer) {
    const p = smer === 0 ? 1 : Math.round((vzhled().priblizeni + smer * PRIBLIZENI.krok) * 10) / 10;
    const v = zmenit({ priblizeni: Math.min(PRIBLIZENI.max, Math.max(PRIBLIZENI.min, p)) });
    oznamit(`Přiblížení ${procenta(v.priblizeni)}`);
    if (okno && !okno.classList.contains('hidden')) vykreslit();
}

export function pripravit() {
    // Ctrl + plus / minus / 0. Klávesy číslic 1–9 patří přepínání sekcí (Ctrl+1…, app/cover.js) – na české klávesnici
    // je „+“ na klávese 1, proto tam přiblíží numerická plus nebo „=“; nula je podle klávesy (na české je na ní „é“)
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const cislice = /^Digit[1-9]$/.test(e.code);
        const smer = e.code === 'NumpadAdd' || (!cislice && (e.key === '+' || e.key === '=')) ? 1
            : e.code === 'NumpadSubtract' || (!cislice && e.key === '-') ? -1
            : e.code === 'Digit0' || e.code === 'Numpad0' ? 0 : null;
        if (smer === null) return;
        e.preventDefault();
        zmenitPriblizeni(smer);
    });
}
