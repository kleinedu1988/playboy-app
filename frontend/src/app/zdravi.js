// Karta Zdraví sbírky v Údržbě › Souhrn (zdravi_sbirky.go): zálohy, export mimo počítač s jemnou připomínkou,
// kontrola souborů na Disku, mezipaměti a obsah fotek a úkoly kontroly sbírky na jednom místě
import { GetZdraviSbirky } from './backend';
import { esc, formatDatum, sklonovat } from '../lib/format';
import { exportovatData, otevritZalohy, zkontrolovatSoubory } from './sprava';

const PLATNOST_MS = 60_000;
/** @type {any} */
let data = null;
let nacteno = 0;
/** @type {Promise<any> | null} */
let nacita = null;

export const velikost = b => {
    if (!b) return '0 MB';
    if (b >= 1073741824) return `${(b / 1073741824).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} GB`;
    return `${Math.max(0.1, b / 1048576).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} MB`;
};

// „dnes“, „včera“, „před 5 dny“ podle data RRRR-MM-DD
export function predDny(datum, dnes = new Date()) {
    if (!datum) return '';
    const d = new Date(`${datum.slice(0, 10)}T00:00:00`);
    const dny = Math.round((new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate()).getTime() - d.getTime()) / 86400000);
    if (dny <= 0) return 'dnes';
    if (dny === 1) return 'včera';
    return `před ${dny} dny`;
}

const NAZVY_FAZI = { vypnuto: 'model nestažený', stahuje: 'stahuje model', pocita: 'počítá', pripraveno: 'připraveno', chyba: 'chyba' };

function htmlKarty(z, ukoly) {
    const dlazdice = (nadpis, obsah, akce = '', trida = '') => `<div class="zd-dlazdice ${trida}"><h5>${nadpis}</h5>${obsah}${akce ? `<div class="zd-akce">${akce}</div>` : ''}</div>`;
    const radek = (text) => `<p>${text}</p>`;
    const zalohy = z.posledniZaloha
        ? radek(`Poslední <b>${esc(predDny(z.posledniZaloha))}</b> v ${esc(z.posledniZaloha.slice(11, 16))}`) + radek(`${sklonovat(z.pocetZaloh, 'záloha', 'zálohy', 'záloh')} · ${velikost(z.velikostZaloh)}`)
        : radek('Zatím žádná – vzniká jednou denně při spuštění.');
    const export_ = z.posledniExport
        ? radek(`Naposledy <b>${esc(predDny(z.posledniExport))}</b>`) + radek(`od té doby ${sklonovat(z.zmenOdExportu, 'změna', 'změny', 'změn')}`)
        : radek('<b>Ještě nikdy</b>');
    const pripominka = z.pripomenoutExport
        ? `<p class="zd-pripominka">Zálohy jsou jen na tomto počítači. Export do souboru je ${z.posledniExport ? 'starší než 14 dní' : 'zatím žádný'} a od té doby přibylo ${sklonovat(z.zmenOdExportu, 'změna', 'změny', 'změn')} – ulož si ho třeba na flashku nebo do cloudu.</p>` : '';
    const kontrola = z.posledniKontrola
        ? radek(`Naposledy <b>${esc(predDny(z.posledniKontrola))}</b> (${esc(formatDatum(z.posledniKontrola))})`) + radek(`ověřeno ${z.overenych.toLocaleString('cs-CZ')} z ${z.fotek.toLocaleString('cs-CZ')} fotek`)
            + (z.nedostupnych ? radek(`<b class="zd-pozor">${sklonovat(z.nedostupnych, 'nedostupná', 'nedostupné', 'nedostupných')}</b>`) : '')
        : radek('Soubory na Disku se zatím neověřovaly.');
    const obsah = z.obsah || {};
    const mezipamet = radek(`Náhledy ${velikost(z.velikostNahledu)} · prohlížeč ${velikost(z.velikostWebu)}`) + radek(`Databáze ${velikost(z.velikostDatabaze)}`)
        + radek(`Obsah fotek: ${esc(NAZVY_FAZI[obsah.faze] || obsah.faze || '–')}${obsah.celkem ? ` · ${obsah.hotovo.toLocaleString('cs-CZ')} z ${obsah.celkem.toLocaleString('cs-CZ')}` : ''}${z.velikostObsahu ? ` · ${velikost(z.velikostObsahu)}` : ''}`);
    const nalezy = radek(ukoly.vse ? `<b>${sklonovat(ukoly.vse, 'úkol', 'úkoly', 'úkolů').replace(/^\d+/, ukoly.vse.toLocaleString('cs-CZ'))}</b> k doplnění` : 'Nic k doplnění')
        + (ukoly.kKontrole ? radek(`${ukoly.kKontrole} ke kontrole`) : '') + (ukoly.navrhu ? radek(sklonovat(ukoly.navrhu, 'návrh', 'návrhy', 'návrhů')) : '');
    return `<h4>Zdraví sbírky</h4><div class="zd-mrizka">
        ${dlazdice('Zálohy', zalohy, '<button type="button" class="link" data-zd="zalohy">Zálohy…</button>')}
        ${dlazdice('Export do souboru', export_ + pripominka, '<button type="button" class="link" data-zd="export">Exportovat…</button>', z.pripomenoutExport ? 'upozorneni' : '')}
        ${dlazdice('Soubory na Disku', kontrola, '<button type="button" class="link" data-zd="kontrola">Zkontrolovat</button>', z.nedostupnych ? 'upozorneni' : '')}
        ${dlazdice('Mezipaměť a modely', mezipamet)}
        ${dlazdice('Kontrola sbírky', nalezy)}
    </div>`;
}

/**
 * Vykreslí kartu; data drží minutu (Údržba se překresluje po každé změně), pak se načtou znovu
 * @param {HTMLElement | null} misto
 * @param {{ vse: number, kKontrole: number, navrhu: number }} ukoly
 */
export async function vykreslit(misto, ukoly) {
    if (!misto) return;
    if (data) misto.innerHTML = htmlKarty(data, ukoly);
    if (data && Date.now() - nacteno < PLATNOST_MS) return;
    nacita ||= GetZdraviSbirky().finally(() => { nacita = null; });
    const z = await nacita.catch(() => null);
    if (!z || !misto.isConnected) return;
    data = z;
    nacteno = Date.now();
    misto.innerHTML = htmlKarty(z, ukoly);
}

// Po exportu, záloze nebo kontrole souborů se data načtou znovu
export function zneplatnit() {
    nacteno = 0;
}

export function pripravit() {
    document.addEventListener('click', async (e) => {
        const akce = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-zd]'));
        if (!akce) return;
        zneplatnit();
        if (akce.dataset.zd === 'zalohy') otevritZalohy();
        else if (akce.dataset.zd === 'export') exportovatData();
        else if (akce.dataset.zd === 'kontrola') zkontrolovatSoubory();
    });
}
