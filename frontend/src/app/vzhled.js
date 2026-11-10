// Okno Vzhled (⋯ › Vzhled…, ROADMAP 1.49–1.50): přiblížení, hustota, velikost karet po pohledech, co ukazuje karta
// modelky, pohyb, prohlížeč fotek, sekce po startu, záhlaví profilu a karty Mapy čísel, s živým náhledem (změna se projeví hned) a tlačítkem Výchozí. Ctrl + plus / minus / 0 mění přiblížení
// odkudkoli. Volby drží ui/vzhled.js.
import { KARTA_RADY, PRIBLIZENI, POHLEDY_KARET, poradiKaret, vychozi, vzhled, zmenit } from '../ui/vzhled';
import { nazevVolbyRady } from '../lib/format';
import { radyJinychCasopisu } from './prehled-uvod';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';

let okno = null;

const POPISY_POHLEDU = { modelky: 'Karty modelek', fotky: 'Všechny fotky', steny: 'Centerfoldy' };
const POPISY_VELIKOSTI = { s: 'Malé', m: 'Střední', l: 'Velké' };
const procenta = p => `${Math.round(p * 100)} %`;
const POPISY_KARET_PREHLEDU = { cz: 'Česká edice', us: 'Americká edice', vybery: 'Chytré výběry', objevit: 'Objevit', naposledy: 'Naposledy přidané' };
// Karty map jiných časopisů (0.02.017): „Penthouse US“; ukáže se jen, když sbírka má číslo té řady
const popisKarty = k => POPISY_KARET_PREHLEDU[k] || (k.startsWith(KARTA_RADY) ? nazevVolbyRady(k.slice(KARTA_RADY.length)) : k);
// Všechny karty v pořadí: uložené a mapy řad z tabulky časopisů, které v pořadí ještě nejsou
const vsechnyKarty = () => poradiKaret(vzhled().prehled.poradi, radyJinychCasopisu().map(r => KARTA_RADY + r));
// Pořadí tlačítek sekcí v hlavní nabídce (#viewToggle): Modelky, Čísla, Hodnocení, Sbírka
const SEKCE_STARTU = { modelky: 0, cisla: 1, sbirka: 3 };

function htmlObsahu() {
    const v = vzhled();
    const karty = vsechnyKarty();
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
            <label><input type="checkbox" data-vz-karta="fotek"${v.karta.fotek ? ' checked' : ''} /> počet fotek</label></div></div>
        <h4 class="vz-oddil">Pohyb a prohlížeč fotek</h4>
        <div class="vz-radek"><span class="vz-popis">Pohyb a efekty</span><div class="vz-volby" role="group" aria-label="Pohyb a efekty">
            ${prepinac('data-vz-pohyb', [['plny', 'Plné'], ['omezeny', 'Omezené'], ['zadny', 'Žádné']], v.pohyb)}</div></div>
        <div class="vz-radek"><span class="vz-popis">Pozadí prohlížeče</span><div class="vz-volby" role="group" aria-label="Pozadí prohlížeče">
            ${prepinac('data-vz-pozadi', [['tmave', 'Tmavé'], ['cerne', 'Černé'], ['rozmazane', 'Rozmazaná fotka']], v.prohlizec.pozadi)}</div></div>
        <div class="vz-radek"><span class="vz-popis">Ovládání a údaje fotky</span><div class="vz-volby" role="group" aria-label="Ovládání a údaje fotky">
            ${prepinac('data-vz-ovladani', [['pohyb', 'Po pohybu myši'], ['trvale', 'Trvale']], v.prohlizec.ovladani)}</div></div>
        <div class="vz-radek"><span class="vz-popis">Filmový pás</span><div class="vz-volby">
            <label><input type="checkbox" data-vz-pas${v.prohlizec.pas ? ' checked' : ''} /> náhledy okolních fotek dole</label></div></div>
        <h4 class="vz-oddil">Start, Sbírka a profil</h4>
        <div class="vz-radek"><span class="vz-popis">Po startu otevřít</span><div class="vz-volby" role="group" aria-label="Po startu otevřít">
            ${prepinac('data-vz-start', [['modelky', 'Modelky'], ['cisla', 'Čísla'], ['sbirka', 'Sbírku'], ['posledni', 'Poslední sekci']], v.start)}</div></div>
        <div class="vz-radek"><span class="vz-popis">Záhlaví profilu</span><div class="vz-volby" role="group" aria-label="Záhlaví profilu">
            ${prepinac('data-vz-zahlavi', [['vysoke', 'Vysoké, svine se'], ['pevne', 'Vysoké stále'], ['pruh', 'Jen pruh']], v.zahlavi)}</div></div>
        <div class="vz-radek"><span class="vz-popis">Karty Mapy čísel<br><small>Sbírka › Mapa čísel</small></span><ol class="vz-karty-prehledu">
            ${karty.map((k, i) => `<li><label><input type="checkbox" data-vz-prehled-karta="${k}"${v.prehled.skryte.includes(k) ? '' : ' checked'} /> ${popisKarty(k)}</label>
                <button type="button" data-vz-posun="${k}" data-smer="-1" aria-label="${popisKarty(k)} výš"${i === 0 ? ' disabled' : ''}>↑</button>
                <button type="button" data-vz-posun="${k}" data-smer="1" aria-label="${popisKarty(k)} níž"${i === karty.length - 1 ? ' disabled' : ''}>↓</button></li>`).join('')}</ol></div>`;
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
        else if (t.matches('[data-vz-pas]')) zmenit({ prohlizec: { pas: t.checked } });
        else if (t.dataset.vzPrehledKarta) {
            const skryte = vzhled().prehled.skryte.filter(k => k !== t.dataset.vzPrehledKarta);
            zmenit({ prehled: { skryte: t.checked ? skryte : [...skryte, t.dataset.vzPrehledKarta] } });
        }
    });
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const b = /** @type {HTMLElement | null} */ (t.closest('button'));
        if (!b) return;
        if (b.dataset.vzHustota) zmenit({ hustota: /** @type {any} */ (b.dataset.vzHustota) });
        else if (b.dataset.vzKarty) zmenit({ karty: { [b.dataset.vzKarty]: b.dataset.vzVelikost } });
        else if (b.dataset.vzPohyb) zmenit({ pohyb: b.dataset.vzPohyb });
        else if (b.dataset.vzPozadi) zmenit({ prohlizec: { pozadi: b.dataset.vzPozadi } });
        else if (b.dataset.vzOvladani) zmenit({ prohlizec: { ovladani: b.dataset.vzOvladani } });
        else if (b.dataset.vzStart) zmenit({ start: b.dataset.vzStart });
        else if (b.dataset.vzZahlavi) zmenit({ zahlavi: b.dataset.vzZahlavi });
        else if (b.dataset.vzPosun) {
            const poradi = vsechnyKarty();
            const i = poradi.indexOf(b.dataset.vzPosun), j = i + Number(b.dataset.smer);
            if (j < 0 || j >= poradi.length) return;
            [poradi[i], poradi[j]] = [poradi[j], poradi[i]];
            zmenit({ prehled: { poradi } });
        }
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

// Sekce po startu (volá main.js po úvodu); „Poslední sekci“ si pamatuje klik v hlavní nabídce
export function otevritSekciPoStartu() {
    const start = vzhled().start;
    let index = SEKCE_STARTU[start] ?? 0;
    if (start === 'posledni') try { index = Number(localStorage.getItem('posledniSekce')) || 0; } catch { index = 0; }
    if (!index) return;
    /** @type {HTMLElement | undefined} */ (document.querySelectorAll('#viewToggle [data-rezim]')[index])?.click();
}

export function pripravit() {
    document.getElementById('viewToggle')?.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement} */ (e.target).closest('[data-rezim]');
        if (!b) return;
        const index = [...document.querySelectorAll('#viewToggle [data-rezim]')].indexOf(b);
        try { if (index >= 0) localStorage.setItem('posledniSekce', String(index)); } catch { /* jen se nezapamatuje */ }
    });

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
