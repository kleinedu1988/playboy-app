// Okno alba a centerfoldu
import { oznamit } from '../ui/oznameni';
import { AddModelka, DeleteAlbum, GetFotografove } from './backend';
import { esc, nazevAlba, rozlozitVydani, sjednotit } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { nacistFotkyModelky } from './profil';
import { albumModal } from './okno';
import { otevritDeleteModal } from './formular-modelky';
import { pripojitVyberSpecialu } from './specialy';

// Formulář alba slouží pro přidání fotek (album = null) i úpravu alba ({ album, typ })
// Přidání centerfoldu ze stěny plakátů: modelka se jen vybere ze seznamu už zadaných
// Centerfold mimo profil (stěna, vydání, kalendář, přehled): modelka se vybírá v okně, vydání může být dané
export function pridatCenterfold(vydani = '') {
    otevritAlbumModal(null, null, { vyberModelky: true, typ: 'Centerfold', vydani, nadpis: 'Přidat centerfold' });
}

export function pridatPictorial(vydani = '') {
    otevritAlbumModal(null, null, { vyberModelky: true, typ: 'Pictorial', vydani, nadpis: 'Přidat pictorial' });
}

// Modelka podle jména z okna alba; neznámé jméno založí novou
export async function vybratNeboZalozitModelku(jmeno) {
    jmeno = jmeno.trim();
    if (!jmeno) {
        oznamit('Napiš jméno modelky.');
        return null;
    }
    const najit = async () => (await vsechnyModelky()).filter(m => sjednotit(m.jmeno) === sjednotit(jmeno)).sort((a, b) => b.id - a.id)[0];
    const znama = await najit();
    if (znama) return znama;
    if (!await AddModelka(/** @type {import('../../wailsjs/go/models').main.Modelka} */ ({ jmeno, tetovani: -1, piercing: -1 }))) {
        oznamit('Modelku se nepodařilo založit.');
        return null;
    }
    return await najit();
}

// Výběr měsíce nabízí i speciály zvoleného roku
let obnovitSpecialyAlba = (_vybrat) => {};

// Centerfold se místo názvu určuje měsícem a rokem vydání
export function prepnoutPoleAlba() {
    const centerfold = document.getElementById('selectTyp').value === 'Centerfold';
    document.getElementById('albumNazevGroup').classList.toggle('hidden', centerfold);
    document.getElementById('albumVydaniGroup').classList.remove('hidden');
    // U pictorialu je vydání nepovinné
    // U pictorialu stačí i samotný rok
    document.getElementById('albumMesicLabel').textContent = centerfold ? 'Měsíc nebo speciál' : 'Měsíc nebo speciál (nepovinné)';
    document.getElementById('albumRokLabel').textContent = centerfold ? 'Rok vydání' : 'Rok (nepovinné)';
    document.getElementById('inputAlbumName').required = !centerfold;
    document.getElementById('selectAlbumMesic').required = centerfold;
    document.getElementById('inputAlbumRok').required = centerfold;
}

// moznosti: vyberModelky (modelka se vybírá v okně), typ a vydani (předvyplnění), nadpis
export function otevritAlbumModal(modelka, album = null, moznosti = {}) {
    stav.modelkaAlba = modelka;
    stav.editovaneAlbum = album;
    document.getElementById('addAlbumForm').reset();
    document.getElementById('albumModelkaGroup').classList.toggle('hidden', !moznosti.vyberModelky);
    document.getElementById('albumModelkaNova').textContent = '';
    // „Uložit a přidat další" má smysl jen při přidávání
    document.getElementById('albumNextBtn').classList.toggle('hidden', Boolean(album));
    document.getElementById('albumModalTitle').textContent = moznosti.nadpis || (album ? 'Upravit album' : 'Přidat fotky do alba');
    document.getElementById('albumSubmitBtn').textContent = album ? 'Uložit album' : 'Uložit fotky';
    document.getElementById('bulkLinksLabel').textContent = album
        ? 'Přidat další fotky – odkazy z Google Disku (nepovinné)'
        : 'Vložte odkazy z Google Disku (libovolné množství)';
    // Při úpravě alba není nutné přidávat další fotky
    document.getElementById('inputBulkLinks').required = !album;

    // S předem daným typem (centerfold, pictorial) se typ nevybírá
    document.getElementById('albumTypGroup').classList.toggle('hidden', Boolean(moznosti.typ));

    // Starší album jiného typu (např. Cover) si svůj typ při úpravě ponechá
    const vyberTypu = document.getElementById('selectTyp');
    vyberTypu.querySelectorAll('[data-puvodni]').forEach(o => o.remove());

    if (album) {
        if (![...vyberTypu.options].some(o => o.value === album.typ)) {
            vyberTypu.add(new Option(album.typ, album.typ));
            vyberTypu.lastElementChild.dataset.puvodni = '1';
        }
        vyberTypu.value = album.typ;
        document.getElementById('inputAlbumName').value = album.album;
        document.getElementById('inputAlbumFotograf').value = album.fotograf || '';
        document.getElementById('inputAlbumPopis').value = album.popis || '';

    }
    if (moznosti.typ) vyberTypu.value = moznosti.typ;
    const vydani = rozlozitVydani(album ? (album.vydani || (album.typ === 'Centerfold' ? album.album : '')) : moznosti.vydani);
    document.getElementById('inputAlbumRok').value = vydani?.rok || '';
    document.getElementById('selectAlbumEdice').value = vydani?.edice || stav.kalendarEdice;
    obnovitSpecialyAlba(vydani?.mesic || '');
    prepnoutPoleAlba();

    // Našeptávání fotografů z celé sbírky, aby se stejné jméno psalo vždy stejně
    GetFotografove().then(fotografove => {
        document.getElementById('seznamFotografu').innerHTML = (fotografove || []).map(f => `<option value="${esc(f)}"></option>`).join('');
    });
    if (moznosti.vyberModelky) {
        vsechnyModelky().then(modelky => {
            document.getElementById('seznamModelekAlba').innerHTML = (modelky || []).map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');
        });
        document.getElementById('inputAlbumModelka').value = modelka?.jmeno || '';
    }
    albumModal.classList.remove('hidden');
    document.getElementById(moznosti.vyberModelky ? 'inputAlbumModelka' : moznosti.typ ? (moznosti.typ === 'Centerfold' ? 'selectAlbumMesic' : 'inputAlbumName') : 'selectTyp').focus();
}

export function smazatAlbum(album, pocet) {
    otevritDeleteModal(
        'Smazat album',
        `Opravdu smazat album „${nazevAlba(album.album, album.typ)}“ (${album.typ}, počet fotek: ${pocet})?`
            + (album.dalsiModelky.length || album.modelkaId !== stav.aktualniModelka?.id
                ? ` Album je sdílené (${[album.jmenoModelky, ...album.dalsiModelky.map(m => m.jmeno)].filter(Boolean).join(', ')}) a zmizí všem.` : '')
            + ' Fotky na Google Disku zůstanou. Před smazáním se uloží záloha.',

        () => DeleteAlbum(album.modelkaId, album.album, album.typ),
        () => nacistFotkyModelky(stav.aktualniModelka.id)
    );
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    obnovitSpecialyAlba = pripojitVyberSpecialu('selectAlbumMesic', 'inputAlbumRok', 'selectAlbumEdice');

    document.getElementById('selectTyp').addEventListener('change', prepnoutPoleAlba);

    // Nápověda, že napsané jméno zatím ve sbírce není a uložením vznikne nová modelka
    document.getElementById('inputAlbumModelka').addEventListener('input', (e) => {
        const jmeno = sjednotit(e.target.value);
        const znama = [...document.querySelectorAll('#seznamModelekAlba option')].some(o => sjednotit(o.value) === jmeno);
        document.getElementById('albumModelkaNova').textContent = jmeno && !znama ? 'Nová modelka – uložením se založí.' : '';
    });
}
