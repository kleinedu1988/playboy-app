// Akce s jednou fotkou (nebo spojeným plakátem). Stejné položky nabízí pravé tlačítko, tlačítko ⋯ na dlaždici
// i tlačítko ⋯ v prohlížeči, takže každou akci jde udělat odkudkoli a bez pravého tlačítka.
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { stav } from './stav';
import { detailView } from './prvky';
import { otevritProfilPodleId } from './cover';
import { pridatDoVyberu } from './nejlepsi';
import { smazatFotku } from './sprava';
import { kopirovatText, odkazNaDisk } from './ulozeni';

// Tlačítko ⋯ na dlaždici; nabídku otevře nabidky.js
export const htmlAkciDlazdice = () =>
    '<button type="button" class="tile-more" title="Akce s fotkou (také pravým tlačítkem)" aria-label="Akce s fotkou">⋯</button>';

// polozka: položka prohlížeče; fotka: konkrétní stránka plakátu, jinak celá položka
export function akceFotky(polozka, fotka = null, { profil = true, odebrat = true, poOdebrani = () => {} } = {}) {
    const stranky = fotka ? [fotka] : polozka.fotky;
    const prvni = stranky[0];
    const vProfilu = !detailView.classList.contains('hidden') && stav.aktualniModelka?.id === polozka.modelkaId;
    return [
        ...(profil && polozka.modelkaId && !vProfilu
            ? [{ text: `Otevřít profil${polozka.jmenoModelky ? ': ' + polozka.jmenoModelky : ' modelky'}`, akce: () => otevritProfilPodleId(polozka.modelkaId) }] : []),
        { text: 'Přidat do výběru…', akce: () => pridatDoVyberu(stranky.map(f => f.id)) },
        { text: 'Otevřít na Google Disku', akce: () => BrowserOpenURL(odkazNaDisk(prvni)) },
        { text: 'Kopírovat odkaz', akce: () => kopirovatText(odkazNaDisk(prvni)) },
        ...(odebrat && stranky.length === 1
            ? [{ text: polozka.fotky.length > 1 ? 'Odebrat tuto stránku' : 'Odebrat fotku', akce: () => { poOdebrani(); smazatFotku(prvni); } }] : []),
    ];
}
