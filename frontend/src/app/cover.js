// Okno coveru a otevření profilu ze stěny
import { rozlozitVydani, slozitVydani } from '../lib/format';
import { jednou, oznamit } from '../ui/oznameni';
import { AddCover, UpdateCover } from './backend';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { issueView, searchInput, wall } from './prvky';
import { historie, jeOdkazNaSlozku, odkazJeVPoradku, oznamitVlozeni, prepnoutRezim, viewToggle } from './navigace';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { obnovitStranku } from './vydani';
import { otevritLightbox } from './prohlizec';
import { pripojitVyberSpecialu } from './specialy';
import { zavritOkno } from './ulozeni';

// Výběr měsíce nabízí i speciály zvoleného roku
let obnovitSpecialyCoveru = (_vybrat) => {};

// Formulář coveru slouží pro přidání (polozka = null) i úpravu vydání
export const coverModal = document.getElementById('coverModal');

export function otevritCoverModal(polozka = null, predvyplnitVydani = '') {
    stav.editovanyCover = polozka;
    document.getElementById('coverForm').reset();
    document.getElementById('coverModalTitle').textContent = polozka ? 'Upravit cover' : 'Přidat cover';
    document.getElementById('coverLinkLabel').textContent = polozka
        ? 'Nový odkaz z Google Disku (nepovinné, jinak zůstane původní obrázek)'
        : 'Odkaz na cover z Google Disku';
    document.getElementById('inputCoverLink').required = !polozka;

    const vydani = rozlozitVydani(polozka ? polozka.album : predvyplnitVydani);
    if (vydani?.mesic) document.getElementById('inputCoverRok').value = vydani.rok;
    // Bez předvyplněného vydání se nabídne edice zobrazená v kalendáři
    document.getElementById('selectCoverEdice').value = vydani?.edice || stav.kalendarEdice;
    obnovitSpecialyCoveru(vydani?.mesic || '');
    coverModal.classList.remove('hidden');
    // S předvyplněným vydáním zbývá jen vložit odkaz
    document.getElementById(vydani && !polozka ? 'inputCoverLink' : 'selectCoverMesic').focus();
}

export async function otevritProfilPodleId(modelkaId) {
    const modelka = (await vsechnyModelky()).find(m => m.id === modelkaId);
    if (modelka) otevritDetailModelky(modelka);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    obnovitSpecialyCoveru = pripojitVyberSpecialu('selectCoverMesic', 'inputCoverRok', 'selectCoverEdice');

    document.getElementById('closeCoverModalBtn').onclick = () => zavritOkno(coverModal);

    document.getElementById('coverForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const vydani = slozitVydani(document.getElementById('inputCoverRok').value, document.getElementById('selectCoverMesic').value, document.getElementById('selectCoverEdice').value);
        const odkaz = document.getElementById('inputCoverLink').value;
        if (jeOdkazNaSlozku(odkaz)) return;

        if (stav.editovanyCover) {
            if (!await odkazJeVPoradku(odkaz)) return;
            if (!await UpdateCover(stav.editovanyCover.fotky[0].id, vydani, odkaz)) {
                oznamit('Cover se nepodařilo uložit do databáze.');
                return;
            }
        } else {
            oznamitVlozeni(await AddCover(vydani, odkaz), 'coverů');
        }
        coverModal.classList.add('hidden');
        // Cover se přidává z přehledu coverů, z kalendáře, z přehledu sbírky a ze stránky vydání
        if (!issueView.classList.contains('hidden')) obnovitStranku();
        else nacistGalerii(searchInput.value);
    });

    wall.addEventListener('click', (e) => {
        const polozka = e.target.closest('.wall-item');
        if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, stav.stenaPolozky);
    });

    viewToggle.addEventListener('click', (e) => {
        const tlacitko = e.target.closest('[data-rezim]');
        if (!tlacitko) return;
        // Přepnutí přehledu začíná novou historii
        historie.length = 0;
        prepnoutRezim(tlacitko.dataset.rezim);
        nacistGalerii(searchInput.value);
    });
}
