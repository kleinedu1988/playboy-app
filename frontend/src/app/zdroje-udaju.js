// Doplnit z webu (zdroje_udaju.go): údaje modelky z Wikidat, Wikipedie (seznam Playmate měsíce) a Boobpedie,
// převedené do podoby sbírky. Okno ukáže jen údaje, které se od sbírky liší: řádek = údaj, volba = ponechat nebo
// hodnota z některého zdroje. Prázdný údaj má předvolený první návrh, vyplněný „ponechat“; nic se nezapíše bez
// Uložit. K odkazům modelky přibudou zdroje, ze kterých se něco převzalo.
import { NajitUdajeModelky, UlozitUdajeZeZdroju } from './backend';
import { esc, nazvyTitulu } from '../lib/format';
import { stav } from './stav';
import { oznamit } from '../ui/oznameni';
import { drzetFokus } from '../ui/dom';
import { otevritProfilPodleId } from './cover';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

const NAZVY_ZDROJU = { wikidata: 'Wikidata', wikipedie: 'Wikipedie', boobpedia: 'Boobpedia' };
const STAVY = { nalezeno: '✓', nenalezeno: '–', jina: '≠', chyba: '⚠' };

let okno = null;
/** @type {any} */
let nalez = null;

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'zdrojeUdajuModal';
    okno.innerHTML = `<div class="modal-card zu-karta" role="dialog" aria-modal="true" aria-labelledby="zuNadpis">
        <div class="modal-header"><h3 id="zuNadpis">Doplnit z webu</h3><button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <form data-zu-form>
            <div data-zu-obsah></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
                <button type="submit" class="btn btn-primary" data-zu-ulozit disabled>Uložit zvolené</button>
            </div>
        </form></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('change', obnovitTlacitko);
    okno.addEventListener('click', (e) => {
        const odkaz = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-zu-odkaz]'));
        if (odkaz) BrowserOpenURL(odkaz.dataset.zuOdkaz);
    });
    okno.querySelector('[data-zu-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { hodnoty, odkazy } = zvolene();
        if (!Object.keys(hodnoty).length) return;
        const id = nalez.modelkaId;
        if (!await UlozitUdajeZeZdroju(id, hodnoty, odkazy)) {
            oznamit('Údaje se nepodařilo uložit – zkontroluj je v okně Upravit.');
            return;
        }
        okno.classList.add('hidden');
        oznamit(`Doplněno ${Object.keys(hodnoty).length} ${Object.keys(hodnoty).length === 1 ? 'údaj' : Object.keys(hodnoty).length < 5 ? 'údaje' : 'údajů'}; zdroj je v odkazech modelky.`);
        if (stav.aktualniModelka?.id === id) otevritProfilPodleId(id);
    });
}

// Zvolené hodnoty a odkazy na zdroje, ze kterých jsou
function zvolene() {
    /** @type {Record<string, string>} */
    const hodnoty = {};
    const zdroje = new Set();
    okno.querySelectorAll('input[type=radio]:checked').forEach((/** @type {HTMLInputElement} */ r) => {
        if (!r.dataset.zdroj) return;
        hodnoty[r.name.replace(/^zu-/, '')] = r.value;
        zdroje.add(r.dataset.zdroj);
    });
    const odkazy = (nalez?.zdroje || []).filter(z => zdroje.has(z.klic) && z.url).map(z => z.url);
    return { hodnoty, odkazy };
}

function obnovitTlacitko() {
    const n = Object.keys(zvolene().hodnoty).length;
    const tlacitko = /** @type {HTMLButtonElement} */ (okno.querySelector('[data-zu-ulozit]'));
    tlacitko.disabled = !n;
    tlacitko.textContent = n ? `Uložit zvolené (${n})` : 'Uložit zvolené';
}

function htmlNalezu(n) {
    const zdroje = n.zdroje.map(z => `<li class="zu-zdroj zu-${z.stav}"><span class="zu-stav" title="${esc(z.stav)}">${STAVY[z.stav] || ''}</span>
        <b>${esc(z.nazev)}</b> ${z.url ? `<button type="button" class="link" data-zu-odkaz="${esc(z.url)}" title="${esc(z.url)}">otevřít</button>` : ''}<small>${esc(z.poznamka || '')}</small></li>`).join('');
    const radky = n.pole.map(p => {
        // Tituly z ocenění (0.02.065) se k stávajícím přidávají, proto je předvolený návrh
        const tituly = p.klic === 'tituly';
        const ukazat = (/** @type {string} */ h) => esc(tituly ? nazvyTitulu(h) : h);
        const predvolba = p.stavajici && !tituly ? -1 : 0;
        const volba = (hodnota, popis, i, zdroj = '') => `<label class="zu-volba"><input type="radio" name="zu-${esc(p.klic)}" value="${esc(hodnota)}"${zdroj ? ` data-zdroj="${esc(zdroj)}"` : ''}${i === predvolba ? ' checked' : ''} />
            <span>${popis}</span></label>`;
        return `<tr><th scope="row">${esc(p.nazev)}</th>
            <td>${volba(p.stavajici, p.stavajici ? `<span class="zu-hodnota">${ukazat(p.stavajici)}</span><small>${tituly ? 'jen tyto' : 'ponechat'}</small>` : '<small>nevyplněno – ponechat</small>', -1)}</td>
            <td>${p.navrhy.map((h, i) => volba(h.hodnota, `<span class="zu-hodnota">${tituly ? '+ ' : ''}${ukazat(h.hodnota)}</span><small>${esc(NAZVY_ZDROJU[h.zdroj] || h.zdroj)}</small>`, i, h.zdroj)).join('')}</td></tr>`;
    }).join('');
    const souhlasi = n.souhlasi?.length ? `<p class="zu-souhlasi">Se zdroji souhlasí: ${esc(n.souhlasi.join(', '))}.</p>` : '';
    const nic = !n.pole.length ? `<p class="zu-nic">${n.zdroje.some(z => z.stav === 'nalezeno') ? 'Zdroje nemají nic, co by ve sbírce chybělo nebo se lišilo.' : 'Žádný zdroj tuto modelku nenašel. Pomůže odkaz na Wikipedii, Wikidata nebo Boobpedii v jejích odkazech (Upravit).'}</p>` : '';
    return `<ul class="zu-zdroje">${zdroje}</ul>
        ${radky ? `<table class="zu-tabulka"><thead><tr><th>Údaj</th><th>Ve sbírce</th><th>Ze zdrojů</th></tr></thead><tbody>${radky}</tbody></table>` : ''}
        ${nic}${souhlasi}
        <p class="pass-hint">Hodnoty jsou převedené do podoby sbírky (cm, kg, evropská velikost prsou, česky). Zkontroluj je – zdroje se mohou plést i mezi sebou.</p>`;
}

export async function otevritDoplneniZWebu(modelka = stav.aktualniModelka) {
    if (!modelka) return;
    if (!okno) vytvoritOkno();
    nalez = null;
    okno.querySelector('#zuNadpis').textContent = `Doplnit z webu – ${modelka.jmeno}`;
    okno.querySelector('[data-zu-obsah]').innerHTML = '<p class="zu-nacita">Hledám ve Wikidatech, na Wikipedii a v Boobpedii…</p>';
    obnovitTlacitko();
    okno.classList.remove('hidden');
    const n = await NajitUdajeModelky(modelka.id).catch(() => null);
    if (okno.classList.contains('hidden')) return;
    if (!n) {
        okno.querySelector('[data-zu-obsah]').innerHTML = '<p class="zu-nic">Hledání se nepovedlo – je počítač připojený k internetu?</p>';
        return;
    }
    nalez = n;
    okno.querySelector('[data-zu-obsah]').innerHTML = htmlNalezu(n);
    obnovitTlacitko();
    /** @type {HTMLElement | null} */ (okno.querySelector('input[type=radio]:checked'))?.focus();
}

export function pripravit() {
    document.getElementById('doplnitZWebuBtn')?.addEventListener('click', () => otevritDoplneniZWebu());
}
