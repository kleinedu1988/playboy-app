// Ročník podle Wikipedie (rocnik_wikipedie.go): Playmate měsíců a Playmate roku proti sbírce. Chybějící jdou
// přidat jedna po druhé rychlým oknem Nová modelka (jméno a číslo předvyplněné), podobné jméno (překlep) jde
// s potvrzením převzít z Wikipedie. Otevírá se z kontextové nabídky roku v Kalendáři, ze stránky ročníku
// a z popisku roku v americké mapě sbírky. Penthouse (0.02.064) podle italské Wikipedie, řada „PH/US“.
import { PrijmoutJmenoZWikipedie, RocnikCasopisuPodleWikipedie } from './backend';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { MESICE, RADY_WIKIPEDIE, VYCHOZI_EDICE, esc, maRocnikWiki, nazevRady, nazevVydani } from '../lib/format';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import { otevritFrontuRychlehoPridani } from './formular-modelky';
import { otevritProfilPodleId } from './cover';
import { otevritVydani } from './vydani';

let okno = null;
let rok = 0;
// Řada ročníku: „US“ (Playboy) nebo „PH/US“ (Penthouse)
let rada = VYCHOZI_EDICE;

/** @type {any} */
let data = null;

const POPISY = {
    shoda: ['✓', 've sbírce'],
    preklep: ['≈', 'podobné jméno'],
    'jine-jmeno': ['≠', 'v čísle je jiná'],
    'jiny-mesic': ['↔', 'jiný měsíc'],
    'bez-centerfoldu': ['○', 'bez centerfoldu'],
    'bez-oceneni': ['○', 'bez alba titulu roku'],
    chybi: ['+', 'chybí'],
    nenalezeno: ['–', 'seznam měsíc nemá'],
};

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'rocnikWikiModal';
    okno.innerHTML = `<div class="modal-card rw-karta" role="dialog" aria-modal="true" aria-labelledby="rwNadpis">
        <div class="modal-header"><h3 id="rwNadpis">Ročník podle Wikipedie</h3><button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <div data-rw-obsah></div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-zavrit>Zavřít</button>
            <button type="button" class="btn btn-primary" data-rw-pridat disabled>Přidat vybrané</button>
        </div></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('change', obnovitTlacitko);
    okno.addEventListener('click', async (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const cil = /** @type {HTMLElement | null} */ (t.closest('[data-rw-akce]'));
        if (t.closest('[data-rw-pridat]')) return pridatVybrane();
        if (!cil) return;
        const radek = data.radky[parseInt(cil.dataset.i)];
        switch (cil.dataset.rwAkce) {
            case 'zdroj': return BrowserOpenURL(radek.url);
            case 'profil': zavrit(); return otevritProfilPodleId(radek.modelkaId);
            case 'cislo': zavrit(); return otevritVydani(radek.vydaniSbirky || radek.vydani);
            case 'pridat': zavrit(); return otevritFrontuRychlehoPridani([polozkaFronty(radek)]);
            case 'prejmenovat':
            case 'dalsi-jmeno': {
                const prejmenovat = cil.dataset.rwAkce === 'prejmenovat';
                if (!await PrijmoutJmenoZWikipedie(radek.modelkaId, radek.jmeno, prejmenovat)) return oznamit('Jméno se nepodařilo uložit.');
                oznamit(prejmenovat ? `${radek.jmenoSbirky} je teď ${radek.jmeno}; dosavadní jméno je mezi dalšími jmény.` : `${radek.jmeno} přidáno k dalším jménům ${radek.jmenoSbirky}.`);
                return nacist();
            }
        }
    });
}

const zavrit = () => okno.classList.add('hidden');

// Položka fronty rychlého okna: Playmate měsíce s číslem, Playmate roku jen se jménem
function polozkaFronty(r) {
    return r.mesic ? { jmeno: r.jmeno, cislo: { rok: String(rok), mesic: String(r.mesic).padStart(2, '0'), edice: rada, typ: 'Centerfold' } } : { jmeno: r.jmeno };
}

function pridatVybrane() {
    const vybrane = [...okno.querySelectorAll('input[data-rw-vyber]:checked')].map(c => data.radky[parseInt(/** @type {HTMLElement} */ (c).dataset.i)]);
    if (!vybrane.length) return;
    zavrit();
    otevritFrontuRychlehoPridani(vybrane.map(polozkaFronty));
}

function obnovitTlacitko() {
    const n = okno.querySelectorAll('input[data-rw-vyber]:checked').length;
    const b = /** @type {HTMLButtonElement} */ (okno.querySelector('[data-rw-pridat]'));
    b.disabled = !n;
    b.textContent = n ? `Přidat vybrané (${n}) jednu po druhé` : 'Přidat vybrané';
}

function htmlRadku(r, i) {
    const [znak, popis] = POPISY[r.stav] || ['', r.stav];
    const odkaz = (akce, text, titulek = '') => `<button type="button" class="link" data-rw-akce="${akce}" data-i="${i}"${titulek ? ` title="${esc(titulek)}"` : ''}>${text}</button>`;
    const kdy = r.mesic ? MESICE[r.mesic - 1] : data?.titulRoku || 'Titul roku';
    let detail = '';
    switch (r.stav) {
        case 'shoda': detail = odkaz('profil', 'profil'); break;
        case 'preklep': detail = `ve sbírce <b>${esc(r.jmenoSbirky)}</b> · ${odkaz('prejmenovat', 'přejmenovat podle Wikipedie', 'Dosavadní jméno přejde do dalších jmen')} · ${odkaz('dalsi-jmeno', 'jen přidat jako další jméno')}`; break;
        case 'jine-jmeno': detail = `ve sbírce je v čísle <b>${esc(r.jmenoSbirky)}</b> · ${odkaz('cislo', 'číslo')} · ${odkaz('pridat', 'přidat…')}`; break;
        case 'jiny-mesic': detail = `ve sbírce je v čísle ${esc(nazevVydani(r.vydaniSbirky))} · ${odkaz('profil', 'profil')}`; break;
        case 'bez-centerfoldu': case 'bez-oceneni': detail = `${odkaz('profil', 'profil')}`; break;
        case 'nenalezeno': detail = ''; break;
    }
    const vyber = r.stav === 'chybi' ? `<input type="checkbox" data-rw-vyber data-i="${i}" checked aria-label="Přidat ${esc(r.jmeno)}" />` : '';
    return `<tr class="rw-${r.stav}"><td class="rw-vyber">${vyber}</td><th scope="row">${esc(kdy)}</th>
        <td><span class="rw-znak" aria-hidden="true">${znak}</span>${r.jmeno ? esc(r.jmeno) : '<small>–</small>'}</td>
        <td><small class="rw-stav">${esc(popis)}</small> ${detail}</td>
        <td>${r.url ? odkaz('zdroj', 'Wikipedie', r.url) : ''}</td></tr>`;
}

async function nacist() {
    const obsah = okno.querySelector('[data-rw-obsah]');
    obsah.innerHTML = `<p class="pass-hint">Načítám seznam ${rada === VYCHOZI_EDICE ? 'Playmate' : 'Pets'} z Wikipedie…</p>`;
    const r = await RocnikCasopisuPodleWikipedie(rok, RADY_WIKIPEDIE[rada] || 'PB').catch(() => null);
    if (okno.classList.contains('hidden')) return;
    if (!r || r.chyba) {
        obsah.innerHTML = `<p class="pass-hint">${esc(r?.chyba || 'Wikipedie neodpovídá – je počítač připojený k internetu?')}</p>`;
        return;
    }
    data = r;
    const celkem = r.radky.filter(x => x.jmeno).length;
    const chybi = r.radky.filter(x => x.stav === 'chybi').length;
    obsah.innerHTML = `<p class="rw-souhrn"><b>${r.shod} z ${celkem}</b> ve sbírce souhlasí${chybi ? ` · ${chybi} chybí` : ''}</p>
        <table class="rw-tabulka"><tbody>${r.radky.map(htmlRadku).join('')}</tbody></table>
        <p class="pass-hint">Chybějící se přidají rychlým oknem Nová modelka jedna po druhé, s předvyplněným jménem a číslem; centerfold vznikne s vloženými fotkami. Nic se nezapíše samo.</p>`;
    obnovitTlacitko();
}

export function otevritRocnikWiki(novyRok, novaRada = VYCHOZI_EDICE) {
    rok = parseInt(novyRok) || 0;
    if (!rok || !maRocnikWiki(novaRada)) return;
    rada = novaRada;
    if (!okno) vytvoritOkno();
    okno.querySelector('#rwNadpis').textContent = `Ročník ${rok}${rada !== VYCHOZI_EDICE ? ` · ${nazevRady(rada)}` : ''} podle Wikipedie`;
    data = null;
    obnovitTlacitko();
    okno.classList.remove('hidden');
    nacist();
}

export function pripravit() {
    document.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-rocnik-wiki]'));
        if (!b) return;
        e.stopPropagation();
        otevritRocnikWiki(b.dataset.rocnikWiki, b.dataset.rocnikRada || VYCHOZI_EDICE);
    }, true);
}
