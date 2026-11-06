// Akce s jednou fotkou (nebo spojeným plakátem). Stejné položky nabízí pravé tlačítko, tlačítko ⋯ na dlaždici
// i tlačítko ⋯ v prohlížeči, takže každou akci jde udělat odkudkoli a bez pravého tlačítka.
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { stav } from './stav';
import { detailView } from './prvky';
import { otevritProfilPodleId } from './cover';
import { pridatDoVyberu } from './nejlepsi';
import { obnovitCoJeVidet, smazatFotku } from './sprava';
import { SetProfilovaFotka, SetTitulniFotka } from './backend';
import { oznamit } from '../ui/oznameni';
import { lightbox, zavritLightbox } from './prohlizec';
import { kopirovatText, odkazNaDisk } from './ulozeni';
import { podobneZapnuto, ukazatPodobne } from './obsah-fotek';

// Tlačítko ⋯ na dlaždici; nabídku otevře nabidky.js
export const htmlAkciDlazdice = () =>
    '<button type="button" class="tile-more" title="Akce s fotkou (také pravým tlačítkem)" aria-label="Akce s fotkou">⋯</button>';

// polozka: položka prohlížeče; fotka: konkrétní stránka plakátu, jinak celá položka
export function akceFotky(polozka, fotka = null, { profil = true, odebrat = true, poOdebrani = () => {} } = {}) {
    const stranky = fotka ? [fotka] : polozka.fotky;
    const prvni = stranky[0];
    const profilOtevreny = !detailView.classList.contains('hidden');
    const vProfilu = profilOtevreny && stav.aktualniModelka?.id === polozka.modelkaId;
    // Fotka sdíleného alba v profilu další modelky (i v prohlížeči otevřeném z profilu) je titulní pro ni,
    // ne pro hlavní modelku alba
    const zProfilu = profilOtevreny && stav.aktualniModelka && stav.aktualniPolozky.includes(polozka);
    const proModelku = zProfilu ? stav.aktualniModelka.id : polozka.modelkaId;
    return [
        ...(profil && polozka.modelkaId && !vProfilu
            ? [{ text: `Otevřít profil${polozka.jmenoModelky ? ': ' + polozka.jmenoModelky : ' modelky'}`, akce: () => {
                // Profil se otevře pod prohlížečem, proto ho nejdřív zavřít
                if (!lightbox.classList.contains('hidden')) zavritLightbox();
                otevritProfilPodleId(polozka.modelkaId);
            } }] : []),
        // Titulní fotka jde nastavit z jedné fotky (ne z celého plakátu najednou)
        ...(proModelku && stranky.length === 1 ? [{ text: 'Nastavit jako titulní fotku', akce: async () => {
            if (!await SetTitulniFotka(proModelku, prvni.id)) return;
            oznamit('Titulní fotka změněna. Výřez na kartě se vrátil na výchozí.');
            if (zProfilu) otevritProfilPodleId(proModelku);
            else obnovitCoJeVidet();
        } }] : []),
        // Profilová fotka (záhlaví profilu) je oddělená od titulní (karta v galerii)
        ...(proModelku && stranky.length === 1 ? [{ text: 'Nastavit jako profilovou fotku', akce: async () => {
            if (!await SetProfilovaFotka(proModelku, prvni.id)) return;
            oznamit('Profilová fotka změněna. Titulní fotka na kartě zůstala.');
            if (zProfilu) otevritProfilPodleId(proModelku);
        } }] : []),
        { text: 'Přidat do výběru…', akce: () => pridatDoVyberu(stranky.map(f => f.id)) },
        // Obsah fotek (app/obsah-fotek.js): fotky, které vypadají podobně
        ...(podobneZapnuto() ? [{ text: 'Podobné fotky', akce: () => ukazatPodobne(prvni) }] : []),
        null,
        { text: 'Otevřít na Google Disku', akce: () => BrowserOpenURL(odkazNaDisk(prvni)) },
        { text: 'Kopírovat odkaz', akce: () => kopirovatText(odkazNaDisk(prvni)) },
        ...(odebrat && stranky.length === 1
            ? [{ text: polozka.fotky.length > 1 ? 'Odebrat tuto stránku' : 'Odebrat fotku', akce: () => { poOdebrani(); smazatFotku(prvni); }, nebezpecne: true }] : []),
    ];
}
