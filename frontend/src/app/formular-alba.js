// Okno alba a centerfoldu
import { oznamit } from '../ui/oznameni';
import { AddModelka, DeleteAlbum, GetFotografove, GetSablonaObrazku } from './backend';
import { TYP_CG_MESICE, TYP_CG_TYDNE, TYP_ONLINE, esc, formatMarkdown, jeOnline, nazevAlba, nazevVydani, obdobiCyberGirl, obrazek, odkazyDisku, popisTypuAlba, rozlozitVydani, sjednotit, sklonovat, slozitVydani } from '../lib/format';
import { upravitText } from '../ui/editor-textu';
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

// Typ alba ve dvou krocích: kde vyšlo a druh. Časopis a Nikde jsou obojí typ Pictorial, Nikde jen bez čísla.
// Typ, který nabídka nezná (starší Cover…), se nabídne jako další druh u časopisu.
const DRUHY_ALBA = {
    casopis: [['Pictorial', 'Pictorial'], ['Centerfold', 'Centerfold']],
    online: [[TYP_ONLINE, 'Pictorial'], [TYP_CG_TYDNE, 'Cyber Girl of the Week'], [TYP_CG_MESICE, 'Cyber Girl of the Month']],
    nikde: [['Pictorial', 'Pictorial bez čísla']],
};
let kdeAlba = 'casopis';
// Číslo časopisu: řádné měsíční, nebo speciál (vlastní výběr se speciály zvoleného roku a edice)
let cisloAlba = 'mesic';

const druhyAlba = kde => [...DRUHY_ALBA[kde], ...(kde === 'casopis'
    ? [...document.querySelectorAll('#selectTyp [data-puvodni]')].map(o => [o.value, o.value]) : [])];

// Volby ve skupině jsou přepínače (role radio): zvolená je zaměřitelná Tabem, ostatní jen šipkami
function oznacitVolby(volby, jeZvolena) {
    const seznam = [...volby];
    const nektera = seznam.some(jeZvolena);
    seznam.forEach((b, i) => {
        const zvolena = jeZvolena(b);
        b.classList.toggle('active', zvolena);
        b.setAttribute('aria-checked', String(zvolena));
        b.tabIndex = zvolena || (!nektera && i === 0) ? 0 : -1;
    });
}

function nastavitTypAlba(typ, kde = kdeAlba) {
    const vyberTypu = /** @type {HTMLSelectElement} */ (document.getElementById('selectTyp'));
    kdeAlba = kde;
    vyberTypu.value = typ;
    oznacitVolby(document.querySelectorAll('#albumTypGroup [data-kde]'), b => b.dataset.kde === kde);
    // Druhy se překreslí jen při změně nabídky, jinak by zaměřená volba ztratila fokus
    const druhy = document.getElementById('albumDruhy');
    const nabidka = druhyAlba(kde);
    if (druhy.dataset.nabidka !== JSON.stringify(nabidka)) {
        druhy.dataset.nabidka = JSON.stringify(nabidka);
        druhy.innerHTML = nabidka
            .map(([hodnota, popis]) => `<button type="button" role="radio" class="album-volba" data-druh="${esc(hodnota)}">${esc(popis)}</button>`).join('');
    }
    oznacitVolby(druhy.querySelectorAll('[data-druh]'), b => b.dataset.druh === typ);
    prepnoutPoleAlba();
}

// Centerfold se místo názvu určuje měsícem a rokem vydání; online album nemá vydání, ale datum nafocení;
// album „Nikde“ nemá ani jedno
export function prepnoutPoleAlba() {
    const typ = document.getElementById('selectTyp').value;
    const centerfold = typ === 'Centerfold';
    const online = jeOnline(typ);
    document.getElementById('albumNazevGroup').classList.toggle('hidden', centerfold);
    document.getElementById('albumVydaniGroup').classList.toggle('hidden', online || kdeAlba === 'nikde');
    const special = cisloAlba === 'special';
    document.getElementById('albumCisloGroup').classList.toggle('hidden', kdeAlba !== 'casopis');
    oznacitVolby(document.querySelectorAll('#albumCisloGroup [data-cislo]'), b => b.dataset.cislo === cisloAlba);
    document.getElementById('selectAlbumMesic').classList.toggle('hidden', special);
    document.getElementById('selectAlbumSpecial').classList.toggle('hidden', !special);
    document.getElementById('albumMesicLabel').htmlFor = special ? 'selectAlbumSpecial' : 'selectAlbumMesic';
    document.getElementById('albumDatumGroup').classList.toggle('hidden', !online);
    ukazatTyden();
    obnovitNahledAlba();
    // U pictorialu je vydání nepovinné
    // U pictorialu stačí i samotný rok
    document.getElementById('albumMesicLabel').textContent = (special ? 'Speciál' : 'Měsíc') + (centerfold ? '' : ' (nepovinné)');
    document.getElementById('albumRokLabel').textContent = centerfold ? 'Rok vydání' : 'Rok (nepovinné)';
    document.getElementById('inputAlbumName').required = !centerfold;
    document.getElementById('selectAlbumMesic').required = centerfold && !special;
    document.getElementById('selectAlbumSpecial').required = centerfold && special;
    document.getElementById('inputAlbumRok').required = centerfold;
}

// Náhled „V profilu bude“, počet rozpoznaných fotek v odkazech a náhled průvodního textu
export function obnovitNahledAlba() {
    const hodnota = id => /** @type {HTMLInputElement} */ (document.getElementById(id)).value.trim();
    const typ = hodnota('selectTyp');
    const sCislem = !document.getElementById('albumVydaniGroup').classList.contains('hidden');
    const vyberCisla = document.getElementById('selectAlbumSpecial').classList.contains('hidden') ? 'selectAlbumMesic' : 'selectAlbumSpecial';
    const vydani = sCislem && /^\d{4}$/.test(hodnota('inputAlbumRok')) ? slozitVydani(hodnota('inputAlbumRok'), hodnota(vyberCisla), hodnota('selectAlbumEdice')) : '';
    const datum = jeOnline(typ) ? hodnota('inputAlbumDatum') : '';
    document.getElementById('albumNahledNazev').textContent = typ === 'Centerfold' ? 'Centerfold' : hodnota('inputAlbumName') || 'Bez názvu';
    document.getElementById('albumNahledPopis').textContent = [popisTypuAlba(typ, datum), vydani && nazevVydani(vydani)].filter(Boolean).join(' · ');

    const odkazy = odkazyDisku(hodnota('inputBulkLinks'));
    const pocet = odkazy.length;
    document.getElementById('albumPocetOdkazu').textContent = pocet ? `${sklonovat(pocet, 'fotka', 'fotky', 'fotek')} v odkazech` : '';
    document.getElementById('albumNahledPocet').textContent = pocet ? (stav.editovaneAlbum ? `+ ${sklonovat(pocet, 'nová fotka', 'nové fotky', 'nových fotek')}` : sklonovat(pocet, 'fotka', 'fotky', 'fotek')) : '';
    ukazatObrazekNahledu(odkazy[0]);
    document.getElementById('albumSubmitBtn').textContent = stav.editovaneAlbum ? 'Uložit album'
        : pocet ? `Uložit ${sklonovat(pocet, 'fotku', 'fotky', 'fotek')}` : 'Uložit fotky';

    const popis = hodnota('inputAlbumPopis');
    document.getElementById('albumPopisNahled').innerHTML = popis ? formatMarkdown(popis) : '<span class="text-nahled-prazdny">Přidat průvodní text…</span>';
}

// Obrázek v náhledu: první vložená fotka, jinak první fotka upravovaného alba. Adresa náhledu z Disku se skládá
// ze šablony (backend); bez sítě nebo se šablonou, která nefunguje, zůstane prázdný rámeček.
let sablonaObrazku = null;
function ukazatObrazekNahledu(driveId) {
    const misto = document.getElementById('albumNahledObrazek');
    const fotkaAlba = stav.editovaneAlbum?.fotky?.[0]?.url || stav.editovaneAlbum?.url || '';
    const nastavit = (adresa) => {
        if (misto.dataset.adresa === adresa) return;
        misto.dataset.adresa = adresa;
        misto.classList.remove('ma-obrazek');
        misto.style.backgroundImage = '';
        if (!adresa) return;
        const img = new Image();
        img.onload = () => {
            if (misto.dataset.adresa !== adresa) return;
            misto.style.backgroundImage = `url("${adresa.replace(/"/g, '%22')}")`;
            misto.classList.add('ma-obrazek');
        };
        img.src = adresa;
    };
    if (!driveId) return nastavit(obrazek(fotkaAlba, 'w160'));
    (sablonaObrazku ??= GetSablonaObrazku().catch(() => '')).then(sablona => {
        nastavit(sablona && sablona.includes('{id}') ? obrazek(sablona.replace('{id}', driveId), 'w160') : obrazek(fotkaAlba, 'w160'));
    });
}

// Cyber Girl of the Week / Month: týden se spočítá z celého data nafocení, měsíc stačí z RRRR-MM
export function ukazatTyden() {
    const typ = document.getElementById('selectTyp').value;
    const obdobi = obdobiCyberGirl(typ, document.getElementById('inputAlbumDatum').value.trim());
    document.getElementById('albumTydenInfo').textContent = typ === TYP_CG_TYDNE ? obdobi || 'Týden se spočítá z celého data RRRR-MM-DD.'
        : typ === TYP_CG_MESICE ? obdobi || 'Měsíc se vezme z data RRRR-MM.' : '';
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
    document.getElementById('bulkLinksLabel').textContent = album ? 'Přidat další fotky (nepovinné)' : 'Odkazy na fotky z Google Disku';
    // Při úpravě alba není nutné přidávat další fotky
    document.getElementById('inputBulkLinks').required = !album;

    // S předem daným typem (centerfold, pictorial) se typ nevybírá
    document.getElementById('albumTypGroup').classList.toggle('hidden', Boolean(moznosti.typ));

    // Starší album jiného typu (např. Cover) si svůj typ při úpravě ponechá
    const vyberTypu = document.getElementById('selectTyp');
    vyberTypu.querySelectorAll('[data-puvodni]').forEach(o => o.remove());

    let typ = 'Pictorial';
    if (album) {
        if (![...vyberTypu.options].some(o => o.value === album.typ)) {
            vyberTypu.add(new Option(album.typ, album.typ));
            vyberTypu.lastElementChild.dataset.puvodni = '1';
        }
        typ = album.typ;
        document.getElementById('inputAlbumName').value = album.album;
        document.getElementById('inputAlbumFotograf').value = album.fotograf || '';
        document.getElementById('inputAlbumPopis').value = album.popis || '';
        document.getElementById('inputAlbumDatum').value = album.datumAlba || '';
    }
    if (moznosti.typ) typ = moznosti.typ;
    const vydani = rozlozitVydani(album ? (album.vydani || (album.typ === 'Centerfold' ? album.album : '')) : moznosti.vydani);
    document.getElementById('inputAlbumRok').value = vydani?.rok || '';
    document.getElementById('selectAlbumEdice').value = vydani?.edice || stav.kalendarEdice;
    cisloAlba = vydani?.mesic?.startsWith('S') ? 'special' : 'mesic';
    obnovitSpecialyAlba(cisloAlba === 'special' ? vydani.mesic : '');
    document.getElementById('selectAlbumMesic').value = cisloAlba === 'mesic' ? vydani?.mesic || '' : '';
    // Uložený pictorial bez čísla je „Nikde“, nové album začíná u časopisu
    nastavitTypAlba(typ, jeOnline(typ) ? 'online' : album && typ === 'Pictorial' && !vydani ? 'nikde' : 'casopis');

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
    const prvni = moznosti.vyberModelky ? 'inputAlbumModelka' : moznosti.typ ? (moznosti.typ === 'Centerfold' ? 'selectAlbumMesic' : 'inputAlbumName') : '';
    (prvni ? document.getElementById(prvni) : document.querySelector('#albumTypGroup [data-kde].active'))?.focus();
}

// Vydání vložené do otevřeného okna alba (návrh doplnění): album přejde do časopisu, vyplní se rok, měsíc
// nebo speciál a edice; ohlásí se jako úprava, takže stačí uložit. Vrací pole, kam patří kurzor.
export function predvyplnitVydaniAlba(vydani) {
    const v = rozlozitVydani(vydani);
    if (!v) return null;
    const typ = document.getElementById('selectTyp').value;
    cisloAlba = v.mesic.startsWith('S') ? 'special' : 'mesic';
    if (kdeAlba !== 'casopis') nastavitTypAlba(druhyAlba('casopis').some(([h]) => h === typ) ? typ : 'Pictorial', 'casopis');
    document.getElementById('inputAlbumRok').value = v.rok;
    document.getElementById('selectAlbumEdice').value = v.edice;
    obnovitSpecialyAlba(cisloAlba === 'special' ? v.mesic : '');
    document.getElementById('selectAlbumMesic').value = cisloAlba === 'mesic' ? v.mesic : '';
    prepnoutPoleAlba();
    const pole = document.getElementById(cisloAlba === 'special' ? 'selectAlbumSpecial' : v.mesic ? 'selectAlbumMesic' : 'inputAlbumRok');
    pole.dispatchEvent(new Event('input', { bubbles: true }));
    pole.dispatchEvent(new Event('change', { bubbles: true }));
    const skupina = document.getElementById('albumVydaniGroup');
    skupina.classList.remove('predvyplneno');
    void skupina.offsetWidth;
    skupina.classList.add('predvyplneno');
    return pole;
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
    obnovitSpecialyAlba = pripojitVyberSpecialu('selectAlbumSpecial', 'inputAlbumRok', 'selectAlbumEdice');

    // Šipky ve skupině voleb vyberou předchozí nebo další volbu (jako přepínače), Home a End první a poslední.
    // Platí pro všechny skupiny .album-volba v dokumentu (okno alba, coveru i čísla)
    document.addEventListener('keydown', (e) => {
        const volba = /** @type {HTMLElement} */ (e.target).closest?.('[role="radiogroup"] .album-volba, [role="group"] .album-volba');
        const posun = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!volba || (!posun && e.key !== 'Home' && e.key !== 'End') || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const skupina = volba.closest('[role="radiogroup"], [role="group"]');
        const volby = [...skupina.querySelectorAll('.album-volba')];
        const i = volby.indexOf(volba);
        const cil = e.key === 'Home' ? volby[0] : e.key === 'End' ? volby[volby.length - 1] : volby[(i + posun + volby.length) % volby.length];
        cil.click();
        /** @type {HTMLElement} */ (skupina.querySelector('.album-volba.active') || cil).focus();
    });

    // Kde vyšlo: druh zůstane, pokud ho nová volba má (Pictorial), jinak první z nabídky
    document.getElementById('albumTypGroup').addEventListener('click', (e) => {
        const kde = /** @type {HTMLElement} */ (e.target).closest('[data-kde]');
        const druh = /** @type {HTMLElement} */ (e.target).closest('[data-druh]');
        const cislo = /** @type {HTMLElement} */ (e.target).closest('[data-cislo]');
        if (kde) {
            const typ = document.getElementById('selectTyp').value;
            const druhy = druhyAlba(kde.dataset.kde);
            nastavitTypAlba(druhy.some(([h]) => h === typ) ? typ : druhy[0][0], kde.dataset.kde);
        } else if (druh) {
            nastavitTypAlba(druh.dataset.druh);
        } else if (cislo) {
            cisloAlba = cislo.dataset.cislo;
            prepnoutPoleAlba();
        }
    });
    document.getElementById('inputAlbumDatum').addEventListener('input', ukazatTyden);
    document.getElementById('addAlbumForm').addEventListener('input', obnovitNahledAlba);
    document.getElementById('addAlbumForm').addEventListener('change', obnovitNahledAlba);

    // Průvodní text ve společném okně s formátováním; změna se ohlásí jako úprava formuláře
    document.getElementById('albumPopisBtn').addEventListener('click', async () => {
        const pole = /** @type {HTMLTextAreaElement} */ (document.getElementById('inputAlbumPopis'));
        const text = await upravitText({
            nadpis: 'Průvodní text alba',
            text: pole.value,
            zastupny: 'Text, který album v časopise uvádí…',
            napoveda: 'Značky formátování se ukážou, jen když je v místě kurzor. Ctrl+B tučně, Ctrl+I kurzíva, Ctrl+Enter použije text.',
        });
        if (text === null || text === pole.value) return;
        pole.value = text;
        pole.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Nápověda, že napsané jméno zatím ve sbírce není a uložením vznikne nová modelka
    document.getElementById('inputAlbumModelka').addEventListener('input', (e) => {
        const jmeno = sjednotit(e.target.value);
        const znama = [...document.querySelectorAll('#seznamModelekAlba option')].some(o => sjednotit(o.value) === jmeno);
        document.getElementById('albumModelkaNova').textContent = jmeno && !znama ? 'Nová modelka – uložením se založí.' : '';
    });
}
