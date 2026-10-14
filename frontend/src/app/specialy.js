// Speciály v oknech alba a coveru: ve výběru měsíce je skupina „Speciály“ s čísly zvoleného roku a edice
// a položka „Nový speciál…“, která speciál založí
import { oznamit } from '../ui/oznameni';
import { ZalozitSpecial } from './backend';
import { rozlozitVydani, specialyRoku } from '../lib/format';
import { nacistSpecialy } from './mezipamet';
import { vybratHodnotu } from './ulozeni';

// Napojí výběr měsíce na pole roku a edice; vrací funkci, která skupinu speciálů obnoví a vybere hodnotu
export function pripojitVyberSpecialu(idMesice, idRoku, idEdice) {
    const mesic = document.getElementById(idMesice);
    const rok = document.getElementById(idRoku);
    const edice = document.getElementById(idEdice);

    const obnovit = (vybrat = mesic.value) => {
        mesic.querySelector('optgroup[data-specialy]')?.remove();
        if (/^\d{4}$/.test(rok.value)) {
            const skupina = document.createElement('optgroup');
            skupina.label = 'Speciály';
            skupina.dataset.specialy = '1';
            for (const s of specialyRoku(rok.value, edice.value)) skupina.append(new Option(s.nazev, rozlozitVydani(s.vydani).mesic));
            skupina.append(new Option('Nový speciál…', 'novy'));
            mesic.append(skupina);
        }
        mesic.value = [...mesic.options].some(o => o.value === vybrat) ? vybrat : '';
    };
    // Speciál patří ke konkrétnímu roku a edici; měsíc zůstává vybraný i po jejich změně
    const poZmene = () => obnovit(mesic.value.startsWith('S') ? '' : mesic.value);
    rok.addEventListener('input', poZmene);
    edice.addEventListener('change', poZmene);

    mesic.addEventListener('change', async () => {
        if (mesic.value !== 'novy') return;
        mesic.value = '';
        const klic = await zalozitSpecial(rok.value, edice.value);
        if (klic) obnovit(rozlozitVydani(klic).mesic);
    });
    return obnovit;
}

// Založení speciálu s dotazem na název; vrací jeho klíč, nebo null
export async function zalozitSpecial(rok, edice) {
    const nazev = await vybratHodnotu({
        nadpis: `Nový speciál ${rok}${edice !== 'US' ? ' · ' + edice : ''}`,
        text: 'Zvláštní číslo mimo měsíční řadu, např. Playmate Review, Lingerie, Calendar.',
        popisek: 'Název speciálu',
        tlacitko: 'Založit',
    });
    if (!nazev) return null;
    const klic = await ZalozitSpecial(parseInt(rok), edice, nazev);
    if (!klic) {
        oznamit('Speciál se nepodařilo založit.');
        return null;
    }
    await nacistSpecialy();
    return klic;
}
