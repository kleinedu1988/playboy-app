// Upozornění na novou verzi (ROADMAP 1.48, aktualizace.go): minutu po startu se v klidu zeptá, jestli ve vlastním
// klonu programu není novější verze (backend kontroluje nejvýš jednou denně). Novější verzi oznámí nenápadně
// – jednou za den – s „Co je nového“: změny z CHANGELOG.md nové verze a příkaz k aktualizaci. Nic neinstaluje.
// V ⋯ › Nápověda: Zkontrolovat novou verzi a vypnutí hlídání.
import { GetChangelogNoveVerze, GetNovaVerze, GetVerze, NastavitKontroluVerze, ZkontrolovatNovouVerzi } from './backend';
import { ClipboardSetText } from '../../wailsjs/runtime/runtime';
import { novinkyMezi, telaNaHtml } from '../lib/changelog';
import { esc } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { newsModal } from './napoveda';
import { stav } from './stav';

const PO_STARTU_MS = 60_000;
let zapnuto = true;

const dnes = () => new Date().toISOString().slice(0, 10);

/** @param {any} n */
export async function otevritNovouVerzi(n) {
    const [verze, changelog] = await Promise.all([GetVerze(), GetChangelogNoveVerze().catch(() => '')]);
    const novinky = novinkyMezi(changelog || '', verze, n.verze);
    document.getElementById('newsModalTitle').textContent = `Nová verze ${n.verze}`;
    document.getElementById('newsModalBody').innerHTML = `<div class="nv-aktualizace">
            <p>Teď máš verzi ${esc(verze)}. Aktualizace se nestáhne ani nenainstaluje sama: zavři program a v terminálu spusť</p>
            <pre class="nv-prikaz"><code>${esc(n.prikaz)}</code></pre>
            <button type="button" class="btn btn-secondary btn-small" data-nv-kopirovat>Kopírovat příkaz</button>
            <p class="pass-hint">Databáze se při prvním startu nové verze sama upraví (předtím se uloží záloha).</p>
        </div>${telaNaHtml(novinky) || '<p>Změny nové verze se nepodařilo načíst.</p>'}`;
    newsModal.querySelector('[data-nv-kopirovat]')?.addEventListener('click', async () => {
        const ok = await ClipboardSetText(n.prikaz).catch(() => false);
        oznamit(ok ? 'Příkaz zkopírován.' : 'Příkaz se nepodařilo zkopírovat.');
    });
    newsModal.classList.remove('hidden');
    /** @type {HTMLElement} */ (newsModal.querySelector('.napoveda')).scrollTop = 0;
}

/** @param {any} n */
function oznamitNovou(n) {
    oznamit(`Je k dispozici nová verze ${n.verze}.`, { text: 'Co je nového', akce: () => otevritNovouVerzi(n) });
}

// Po startu: nejvýš jedno oznámení denně pro tutéž verzi
export function naplanovatPoStartu() {
    GetNovaVerze().then(n => { zapnuto = n.zapnuto; }).catch(() => {});
    setTimeout(async () => {
        if (stav.zamceno || !zapnuto) return;
        const n = await ZkontrolovatNovouVerzi(false).catch(() => null);
        if (!n?.novejsi) return;
        const klic = `${n.verze}|${dnes()}`;
        try {
            if (localStorage.getItem('oznamenaVerze') === klic) return;
            localStorage.setItem('oznamenaVerze', klic);
        } catch { /* oznámí se i příště */ }
        oznamitNovou(n);
    }, PO_STARTU_MS);
}

async function zkontrolovatTed() {
    oznamit('Hledám novou verzi…');
    const n = await ZkontrolovatNovouVerzi(true).catch(() => null);
    if (!n) return oznamit('Kontrola se nepovedla.');
    if (!n.mozna) return oznamit('Program neví, ze které složky s gitem byl sestavený. Nainstaluj ho přes ./instalovat.sh ve složce programu.');
    if (n.chyba) return oznamit(n.chyba);
    if (n.novejsi) return oznamitNovou(n);
    oznamit(`Máš nejnovější verzi (${await GetVerze()}).`);
}

async function prepnout() {
    if (!await NastavitKontroluVerze(!zapnuto)) return oznamit('Nastavení se nepodařilo uložit.');
    zapnuto = !zapnuto;
    oznamit(zapnuto ? 'Program jednou denně zkontroluje, jestli nevyšla nová verze.' : 'Hledání nové verze vypnuto; zkontrolovat jde dál ručně z nabídky ⋯.');
}

// Položky nabídky ⋯ (oddíl Nápověda)
export function polozkyNabidky() {
    return [
        { text: 'Zkontrolovat novou verzi', akce: zkontrolovatTed },
        { text: `${zapnuto ? '✓ ' : ''}Hledat novou verzi každý den`, akce: prepnout },
    ];
}
