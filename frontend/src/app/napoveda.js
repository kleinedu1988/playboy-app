// Nápověda (klávesa ? a nabídka ⋯) a „Co je nového“: po aktualizaci se jednou ukáže, co přibylo od verze,
// kterou uživatel viděl naposledy. Novinky se berou z CHANGELOG.md vloženého při sestavení programu.
import changelog from '../../../CHANGELOG.md?raw';
import { GetVerze } from './backend';
import { novinkyMezi, telaNaHtml } from '../lib/changelog';
import { lightbox } from './prohlizec';
import { stav } from './stav';

export const helpModal = document.getElementById('helpModal');
export const newsModal = document.getElementById('newsModal');

export function otevritNapovedu() {
    helpModal.classList.remove('hidden');
    helpModal.querySelector('.napoveda').scrollTop = 0;
}

// Novinky od verze „od" (bez ní posledních pět verzí) po současnou
export async function otevritNovinky(od = '') {
    const verze = await GetVerze();
    let novinky = novinkyMezi(changelog, od, verze);
    if (!od) novinky = novinky.slice(0, 5);
    document.getElementById('newsModalTitle').textContent = od ? `Co je nového od verze ${od}` : `Co je nového · verze ${verze}`;
    document.getElementById('newsModalBody').innerHTML = telaNaHtml(novinky) || '<p>Žádné novinky.</p>';
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
    // Klávesa ? otevře nápovědu (ne při psaní, nad oknem ani v prohlížeči)
    document.addEventListener('keydown', (e) => {
        if (e.key !== '?' || stav.zamceno || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input, textarea, select')
            || document.querySelector('.modal-overlay:not(.hidden)') || !lightbox.classList.contains('hidden')) return;
        e.preventDefault();
        otevritNapovedu();
    });
    document.getElementById('helpNewsBtn').onclick = () => {
        helpModal.classList.add('hidden');
        otevritNovinky();
    };
}
