// Okno účtu Google (0.02.074): přihlašovací okno ve stylu programu – vlevo panel s burgundským přechodem
// (akcentní barva → pozadí), zlatým názvem programu a přihlášením, vpravo velká fotka oblíbené modelky s popiskem
// dole. V úzkém okně je fotka přes celé okno a panel na ní průhlednou kartou. Heslo program nikdy nevidí –
// přihlášení probíhá v systémovém prohlížeči (google_ucet.go). Se zámkem sbírky se fotka neukazuje.
import { GetProfilovaFotka, GetUcetGoogle, OdhlasitGoogle, PreskocitPrihlaseniGoogle, PrihlasitGoogle, ZrusitPrihlaseniGoogle } from './backend';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { esc, formatDatum, kategorieModelky, nazevVydani, obrazek } from '../lib/format';
import { VELIKOST_TITULNI, VELIKOST_ZAHLAVI } from './obrazky';
import { idZAdresy } from './vyrez-nahledu';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { oznamit } from '../ui/oznameni';

/** @type {HTMLElement | null} */
let okno = null;
/** @type {any} */
let ucet = null;
let chyba = '';
let fotka = null; // { url, popisek, jmeno }

const KLIC_G = `<svg class="ucet-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;
const KLIC = `<svg class="ucet-klic" viewBox="0 0 64 24" aria-hidden="true"><circle cx="10" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M17 12h41M46 12v7M53 12v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

// Fotka oblíbené modelky: náhodně z nejlépe hodnocených s profilovou fotkou; popisek „Playmate měsíce · Červen 1985“
// Fotky, které se nenačetly (soubor nedostupný): zkusí se další kandidátka
const nenactene = new Set();
async function vybratFotku() {
    if (stav.maZamek) return null;
    let modelky = [];
    try { modelky = await vsechnyModelky(); } catch { return null; }
    const hodnocene = modelky.filter(m => m.hodnoceni > 0).sort((a, b) => b.hodnoceni - a.hodnoceni);
    const nej = hodnocene.filter(m => m.hodnoceni >= (hodnocene[0]?.hodnoceni || 0) - 0.5);
    const kandidatky = (nej.length ? nej : modelky).slice().sort(() => Math.random() - 0.5).slice(0, 8);
    for (const m of kandidatky) {
        let f = null;
        try { f = await GetProfilovaFotka(m.id); } catch { /* další */ }
        if (!f?.url || nenactene.has(f.url)) continue;
        const titul = kategorieModelky(m).map(k => k.nazev)[0] || '';
        const cislo = (m.centerfoldy || [])[0] || (m.vydani || [])[0] || '';
        const kdy = cislo ? nazevVydani(cislo).replace(/\s*·\s*Playboy$/, '') : '';
        return { url: f.url, nahled: obrazek(f.url, VELIKOST_TITULNI), plna: obrazek(f.url, VELIKOST_ZAHLAVI), id: idZAdresy(f.url) || idZAdresy(obrazek(f.url, VELIKOST_TITULNI)), jmeno: m.jmeno, popisek: [titul, kdy].filter(Boolean).join(' · ') };
    }
    return null;
}

function htmlTela() {
    if (!ucet) return '<p class="ucet-text">Načítám…</p>';
    if (ucet.probiha) {
        return `<div class="ucet-ceka"><span class="ucet-tocka" aria-hidden="true"></span>Čekám na přihlášení v prohlížeči…</div>
            <p class="ucet-text">Dokonči přihlášení v okně prohlížeče, které se otevřelo. Heslo zadáváš jen Googlu.</p>
            <button type="button" class="ucet-odkaz" data-ucet="zrusit">Zrušit</button>`;
    }
    if (ucet.prihlasen) {
        const pismeno = (ucet.jmeno || ucet.email || '?').trim()[0].toUpperCase();
        return `<div class="ucet-kdo"><span class="ucet-avatar" aria-hidden="true">${esc(pismeno)}</span>
                <span><b>${esc(ucet.jmeno || ucet.email)}</b>${ucet.jmeno && ucet.email ? `<small>${esc(ucet.email)}</small>` : ''}</span></div>
            ${ucet.prihlaseno ? `<p class="ucet-text">Přihlášeno ${esc(formatDatum(ucet.prihlaseno.slice(0, 10)))}.</p>` : ''}
            <button type="button" class="ucet-hlavni" data-ucet="pokracovat">Pokračovat</button>
            <button type="button" class="ucet-odkaz" data-ucet="odhlasit">Odhlásit</button>`;
    }
    const nastaveni = ucet.nastaveno ? '' : `<div class="ucet-pozn"><b>Chybí přihlašovací údaje programu.</b> V Google Cloud Console vytvoř
            OAuth klienta typu <i>Desktop app</i>, stáhni jeho JSON a ulož ho jako<code>${esc(ucet.cestaKlienta)}</code>
            <button type="button" class="ucet-odkaz" data-ucet="slozka">Otevřít složku</button></div>`;
    return `<button type="button" class="ucet-hlavni" data-ucet="prihlasit"${ucet.nastaveno ? '' : ' disabled'}>${KLIC_G}Přihlásit přes Google</button>
        <button type="button" class="ucet-odkaz" data-ucet="bez">Pokračovat bez přihlášení</button>
        ${nastaveni}
        <p class="ucet-drobne">Program uvidí jen soubory, které sám vytvoří (zálohy), a svou skrytou složku na Disku –
            k fotkám sbírky přístup nedostane. Přihlášení je nepovinné.</p>`;
}

function vykreslit() {
    if (!okno) return;
    okno.querySelector('[data-ucet-telo]').innerHTML = `${chyba ? `<p class="ucet-chyba" role="alert">${esc(chyba)}</p>` : ''}${htmlTela()}`;
    const misto = okno.querySelector('.ucet-foto');
    misto.innerHTML = fotka
        // Chytrý výřez (app/vyrez-nahledu.js): obličej v horní části rámu; výřez záhlaví profilu je pro široký banner
        ? `<img src="${esc(fotka.nahled)}" alt="" draggable="false"${fotka.id ? ` data-vyrez="${esc(fotka.id)}"` : ''}/>
            <div class="ucet-popisek">${esc([fotka.popisek, fotka.jmeno].filter(Boolean).join(' — '))}</div>`
        : '';
    okno.classList.toggle('bez-fotky', !fotka);
    misto.querySelector('img')?.addEventListener('error', () => zkusitDalsiFotku(), { once: true });
}

let pokusu = 0;
async function zkusitDalsiFotku() {
    if (!okno || !fotka) return;
    nenactene.add(fotka.url);
    fotka = ++pokusu < 3 ? await vybratFotku() : null;
    vykreslit();
}

async function obnovit() {
    try { ucet = await GetUcetGoogle(); } catch { ucet = null; }
    vykreslit();
}

export function zavrit() {
    if (!okno) return;
    okno.remove();
    okno = null;
    document.removeEventListener('keydown', klavesa, true);
}

function klavesa(/** @type {KeyboardEvent} */ e) {
    if (e.key === 'Escape' && okno) {
        e.stopPropagation();
        e.preventDefault();
        if (ucet?.probiha) ZrusitPrihlaseniGoogle();
        zavrit();
    }
}

async function akce(/** @type {string} */ co) {
    chyba = '';
    switch (co) {
        case 'prihlasit': {
            ucet = { ...ucet, probiha: true };
            vykreslit();
            const z = await PrihlasitGoogle().catch(e => String(e));
            if (!okno) return;
            chyba = z || '';
            await obnovit();
            if (!z) oznamit(`Přihlášeno ke Googlu${ucet?.email ? ` jako ${ucet.email}` : ''}.`);
            return;
        }
        case 'zrusit': return ZrusitPrihlaseniGoogle();
        case 'odhlasit':
            await OdhlasitGoogle();
            oznamit('Odhlášeno z Googlu.');
            return obnovit();
        case 'bez':
            await PreskocitPrihlaseniGoogle();
            return zavrit();
        case 'pokracovat': return zavrit();
        case 'slozka': return BrowserOpenURL(`file://${ucet.slozkaKlienta}`);
    }
}

// Otevře okno účtu (z ⋯ › Nastavení › Účet Google, nebo při startu)
export async function otevrit() {
    if (okno) return;
    chyba = '';
    pokusu = 0;
    okno = document.createElement('div');
    okno.className = 'ucet';
    okno.setAttribute('role', 'dialog');
    okno.setAttribute('aria-modal', 'true');
    okno.setAttribute('aria-label', 'Účet Google');
    okno.innerHTML = `<div class="ucet-foto"></div>
        <section class="ucet-panel">
            <button type="button" class="ucet-zavrit" data-ucet="pokracovat" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
            <div class="ucet-obsah">
                <img class="ucet-ikona" src="./uvod.png" alt="" draggable="false"/>
                <div class="ucet-znacka">Pinup Katalog</div>
                <h2 class="ucet-nadpis">${KLIC}<span>Účet Google</span></h2>
                <div data-ucet-telo></div>
            </div>
        </section>`;
    okno.addEventListener('click', e => {
        const b = /** @type {HTMLElement} */ (e.target).closest('[data-ucet]');
        if (b && !(/** @type {HTMLButtonElement} */ (b).disabled)) akce(/** @type {HTMLElement} */ (b).dataset.ucet);
    });
    document.addEventListener('keydown', klavesa, true);
    document.body.appendChild(okno);
    vykreslit();
    await obnovit();
    okno?.querySelector('.ucet-hlavni:not([disabled])')?.focus();
    fotka = await vybratFotku();
    vykreslit();
    // Ostrá fotka záhlaví nahradí náhled, až se načte
    if (fotka) {
        const plna = new Image();
        const cil = fotka;
        plna.onload = () => { const img = okno?.querySelector('.ucet-foto img'); if (img && fotka === cil) img.src = cil.plna; };
        plna.src = cil.plna;
    }
}

// Po startu: okno se ukáže samo, jen když program přihlašovací údaje má, uživatel není přihlášený a nezvolil
// „Pokračovat bez přihlášení“
export async function nabidnoutPoStartu() {
    let u = null;
    try { u = await GetUcetGoogle(); } catch { return; }
    if (u.nastaveno && !u.prihlasen && !u.preskoceno) otevrit();
}
