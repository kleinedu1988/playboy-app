// Nápověda (nabídka ⋯ a tlačítko v přehledu zkratek, který otevře klávesa ?) a „Co je nového“: po aktualizaci se jednou ukáže, co přibylo od verze,
// kterou uživatel viděl naposledy. Novinky se berou z CHANGELOG.md vloženého při sestavení programu.
import changelog from '../../../CHANGELOG.md?raw';
import { GetVerze } from './backend';
import { novinkyMezi, telaNaHtml } from '../lib/changelog';
import { sklonovat } from '../lib/format';

export const helpModal = document.getElementById('helpModal');
export const newsModal = document.getElementById('newsModal');

export function otevritNapovedu() {
    helpModal.classList.remove('hidden');
    helpModal.querySelector('.napoveda').scrollTop = 0;
}

// Kolik nejnovějších verzí je v „Co je nového“ vidět celých
const NAHORE = 3;

// Novinky od verze „od" (bez ní posledních pět verzí) po současnou
export async function otevritNovinky(od = '') {
    const verze = await GetVerze();
    let novinky = novinkyMezi(changelog, od, verze);
    if (!od) novinky = novinky.slice(0, 5);
    document.getElementById('newsModalTitle').textContent = od ? `Co je nového od verze ${od}` : `Co je nového · verze ${verze}`;
    // Po skoku přes mnoho verzí jsou celé jen tři nejnovější, starší jsou ve sbaleném oddílu
    const starsi = novinky.length > NAHORE + 2 ? novinky.slice(NAHORE) : [];
    document.getElementById('newsModalBody').innerHTML = (telaNaHtml(novinky.slice(0, novinky.length - starsi.length)) || '<p>Žádné novinky.</p>')
        + (starsi.length ? `<details class="novinky-starsi"><summary>Starší změny – ${sklonovat(starsi.length, 'verze', 'verze', 'verzí')} (${starsi.at(-1).verze} až ${starsi[0].verze})</summary>${telaNaHtml(starsi)}</details>` : '');
    newsModal.classList.remove('hidden');
    newsModal.querySelector('.napoveda').scrollTop = 0;
}

// Po startu: když je verze novější než naposledy viděná, ukáže novinky; při prvním spuštění jen zapamatuje
export async function ukazatNovinkyPoAktualizaci() {
    const verze = await GetVerze();
    let videna = null;
    try { videna = localStorage.getItem('videnaVerze'); } catch { return; }
    try { localStorage.setItem('videnaVerze', verze); } catch { /* příště znovu */ }
    if (videna && videna !== verze && novinkyMezi(changelog, videna, verze).length) otevritNovinky(videna);
}

export function pripravit() {
    document.getElementById('helpNewsBtn').onclick = () => {
        helpModal.classList.add('hidden');
        otevritNovinky();
    };
}
