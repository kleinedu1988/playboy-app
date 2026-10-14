// Výběrová okna, ukládání formulářů a hledání
import { esc, platneDatum, prevestVahu, prevestVysku, sjednotit, slozitVydani, udajChybi } from '../lib/format';
import { AddBulkPhotos, AddModelka, SetPopisAlba, SetVydaniAlba, UpdateAlbum, UpdateModelka } from './backend';
import { jednou, oznamit } from '../ui/oznameni';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { calendar, detailView, issueView, searchInput, stats, wall } from './prvky';
import { jeOdkazNaSlozku, odkazJeVPoradku, oznamitVlozeni, prepnoutRezim, zapamatovatMisto } from './navigace';
import { nacistGalerii } from './galerie';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { nacistStenu } from './stena';
import { obnovitStranku } from './vydani';
import { nacistKalendar } from './kalendar';
import { SKUPINY_UDAJU, nacistPrehled } from './prehled';
import { otevritProfilPodleId } from './cover';
import { albumModal, modelModal } from './okno';
import { neniDuplicitni } from './vyrez';
import { deleteModal, otevritModelModal, poleModelky, potvrdit, ukazatZalozku, zavritDeleteModal } from './formular-modelky';
import { vybratNeboZalozitModelku } from './formular-alba';

// Výběr nebo zadání jedné hodnoty s našeptáváním; vrací napsaný text, nebo null po zrušení
export const pickModal = document.getElementById('pickModal');

export function vybratHodnotu({ nadpis, text = '', popisek, moznosti = [], tlacitko = 'Pokračovat', vychozi = '' }) {
    stav.pickVyreseni?.(null);
    document.getElementById('pickModalTitle').textContent = nadpis;
    document.getElementById('pickModalText').textContent = text;
    document.getElementById('pickModalLabel').textContent = popisek;
    document.getElementById('pickSubmitBtn').textContent = tlacitko;
    document.getElementById('seznamPick').innerHTML = moznosti.map(m => `<option value="${esc(m)}"></option>`).join('');
    const pole = document.getElementById('inputPick');
    pole.value = vychozi;
    pickModal.classList.remove('hidden');
    pole.focus();
    pole.select();
    return new Promise(vyreseno => { stav.pickVyreseni = vyreseno; });
}

// Modelka podle jména z výběrového okna (jiná než vynechané)
export async function vybratModelku(nadpis, text, tlacitko, vynechat = []) {
    const modelky = (await vsechnyModelky()).filter(m => !vynechat.includes(m.id));
    const jmeno = await vybratHodnotu({ nadpis, text, popisek: 'Modelka', moznosti: modelky.map(m => m.jmeno), tlacitko });
    if (!jmeno) return null;
    const modelka = modelky.find(m => sjednotit(m.jmeno) === sjednotit(jmeno));
    if (!modelka) oznamit(`Modelka „${jmeno}“ ve sbírce není. Napiš jméno tak, jak ho nabízí seznam.`);
    return modelka || null;
}

// Údaje odebrané fotky, aby ji šlo tlačítkem Vrátit vrátit
export const obnovaFotky = (f, album) => ({
    modelkaId: f.modelkaId, album: f.album, typ: f.typ, driveId: f.driveId, vydani: f.vydani || '', rotace: f.rotace || 0,
    spojit: Boolean(f.spojit), hodnoceni: f.hodnoceni || 0, poradi: f.poradi || 0, pridano: f.pridano || '',
    popis: album?.popis || '', fotograf: album?.fotograf || '',
});

// Odkaz na fotku na Google Disku
export const odkazNaDisk = f => `https://drive.google.com/file/d/${f.driveId}/view`;

export async function kopirovatText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // Bez přístupu ke schránce přes skryté pole
        const pole = document.createElement('textarea');
        pole.value = text;
        document.body.appendChild(pole);
        pole.select();
        document.execCommand('copy');
        pole.remove();
    }
    oznamit('Odkaz je zkopírovaný.');
}

// Okna s formulářem: když v nich uživatel něco změnil, zavření se nejdřív zeptá, zda změny zahodit
const oknaSFormularem = () => [modelModal, albumModal, document.getElementById('coverModal')];

async function zavritRozepsane(okno) {
    if (!await potvrdit('Zahodit změny?', 'Rozepsané údaje v okně se neuloží.', 'Zahodit', { nebezpecne: true })) return;
    okno.classList.add('hidden');
}

// Zavření modálního okna klávesou Esc, křížkem nebo tlačítkem Zrušit; potvrzovací okno přitom ohlásí zrušení
export function zavritOkno(okno) {
    if (okno === deleteModal) zavritDeleteModal();
    else if (okno.dataset.zmeneno) zavritRozepsane(okno);
    else okno.classList.add('hidden');
    if (okno === pickModal) {
        stav.pickVyreseni?.(null);
        stav.pickVyreseni = null;
    }
}

// Po uložení alba se obnoví to, co je vidět
export async function obnovitPoUlozeniAlba(modelka) {
    // Profil se překreslí vždy (album mohlo patřit jiné hlavní modelce a být jen sdílené s otevřenou), i s hlavičkou:
    // vydání a věk při prvním vydání se odvozují z alb. Místo na stránce zůstane.
    if (!detailView.classList.contains('hidden')) {
        const oblast = document.querySelector('main');
        const posun = oblast.scrollTop;
        await otevritDetailModelky(stav.aktualniModelka, { bezHistorie: true });
        oblast.scrollTop = posun;
    }
    else if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
    // Z přehledu se doplňuje centerfold; po uložení má z tabulky zmizet
    else if (!stats.classList.contains('hidden')) nacistPrehled();
    else if (!issueView.classList.contains('hidden')) obnovitStranku();
    else if (!calendar.classList.contains('hidden')) nacistKalendar(searchInput.value);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Změnu poznají jen zásahy uživatele (vyplnění formuláře při otevření události nevyvolá); otevření ji vynuluje
    oknaSFormularem().forEach(okno => {
        const zmeneno = () => { okno.dataset.zmeneno = '1'; };
        okno.addEventListener('input', zmeneno);
        okno.addEventListener('change', zmeneno);
        new MutationObserver(() => {
            if (!okno.classList.contains('hidden')) delete okno.dataset.zmeneno;
        }).observe(okno, { attributes: true, attributeFilter: ['class'] });
    });

    document.getElementById('pickForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const hodnota = document.getElementById('inputPick').value.trim();
        if (!hodnota) return;
        pickModal.classList.add('hidden');
        stav.pickVyreseni?.(hodnota);
        stav.pickVyreseni = null;
    });

    document.addEventListener('click', (e) => {
        const zrusit = e.target.closest('[data-zavrit]');
        if (zrusit) zavritOkno(zrusit.closest('.modal-overlay'));
    });

    // Formulář: Přidat Modelku
    document.getElementById('addModelForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        // Údaje, které ve formuláři nejsou (míry bez obvodů, starší textová vydání), zůstávají při úpravě původní
        const modelka = stav.editovanaModelka
            ? { ...stav.editovanaModelka }
            : { id: 0, miry: '', vystoupeni: '', pictorialVydani: '' };
        poleModelky.forEach(([vlastnost, id, typ]) => {
            const prvek = document.getElementById(id);
            if (typ === 'cislo') modelka[vlastnost] = parseInt(prvek.value) || 0;
            else modelka[vlastnost] = prvek.value.trim();
        });
        // Pole, které neopustil (a nepřevedlo se), se převede teď
        modelka.vyskaCm = prevestVysku(document.getElementById('inputVyska').value) ?? modelka.vyskaCm;
        modelka.vahaKg = prevestVahu(document.getElementById('inputVaha').value) ?? modelka.vahaKg;

        // Jméno je jediný povinný údaj; leží na první záložce, která nemusí být zrovna vidět
        if (!modelka.jmeno) {
            ukazatZalozku(0);
            document.getElementById('inputJmeno').focus();
            oznamit('Vyplň jméno modelky.');
            return;
        }
        // Data smí být neúplná (jen rok nebo rok a měsíc), ale jen v tomto tvaru
        for (const [vlastnost, id, nazev] of [['narozeniDatum', 'inputNarozeniDatum', 'narození'], ['umrtiDatum', 'inputUmrtiDatum', 'úmrtí']]) {
            if (!platneDatum(modelka[vlastnost])) {
                ukazatZalozku(0);
                document.getElementById(id).focus();
                oznamit(`Datum ${nazev} napiš jako RRRR-MM-DD, RRRR-MM nebo jen rok RRRR.`);
                return;
            }
        }
        if (modelka.narozeniDatum && modelka.umrtiDatum && modelka.umrtiDatum.slice(0, modelka.narozeniDatum.length) < modelka.narozeniDatum.slice(0, modelka.umrtiDatum.length)) {
            ukazatZalozku(0);
            document.getElementById('inputUmrtiDatum').focus();
            oznamit('Datum úmrtí je před datem narození.');
            return;
        }
        if (!await odkazJeVPoradku(modelka.coverId)) {
            ukazatZalozku(0);
            return;
        }

        if (!stav.editovanaModelka && !await neniDuplicitni(modelka)) return;

        const ulozeno = stav.editovanaModelka ? await UpdateModelka(modelka) : await AddModelka(modelka);
        if (!ulozeno) {
            oznamit('Modelku se nepodařilo uložit do databáze.');
            return;
        }
        // Doplňování v řadě: další modelka z tabulky Přehledu, na stejné záložce a v prvním chybějícím poli
        if (e.submitter?.id === 'modelNextBtn' && stav.frontaDoplnovani) {
            const fronta = stav.frontaDoplnovani;
            const dalsiId = fronta.ids[fronta.ids.indexOf(stav.editovanaModelka.id) + 1];
            const dalsi = dalsiId && (await vsechnyModelky()).find(m => m.id === dalsiId);
            if (dalsi) {
                otevritModelModal(dalsi, fronta);
                ukazatZalozku(fronta.zalozka);
                const skupina = SKUPINY_UDAJU.find(sk => sk.zalozka === fronta.zalozka);
                const prvni = fronta.klic === 'titulni' ? ['', '', 'inputDriveID'] : skupina?.udaje.find(([vlastnost]) => udajChybi(dalsi, vlastnost));
                document.getElementById(prvni ? prvni[2] : 'inputJmeno').focus();
                if (!stats.classList.contains('hidden')) nacistPrehled();
                return;
            }
            oznamit('To byla poslední modelka, které tento údaj chyběl.');
        }
        modelModal.classList.add('hidden');
        // Úprava z profilu se vrací do profilu, jinak do přehledu
        if (stav.editovanaModelka && !detailView.classList.contains('hidden')) otevritProfilPodleId(stav.editovanaModelka.id);
        else nacistGalerii(searchInput.value);
    });

    // Formulář: Hromadné fotky do alba
    document.getElementById('addAlbumForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const typ = document.getElementById('selectTyp').value;
        const rok = document.getElementById('inputAlbumRok').value;
        const mesic = document.getElementById('selectAlbumMesic').value;
        // Pictorialu stačí ročník, měsíc bez roku ale nedává smysl
        if (mesic && !rok) {
            oznamit('K měsíci vydání chybí rok.');
            return;
        }
        const links = document.getElementById('inputBulkLinks').value;
        if (jeOdkazNaSlozku(links)) return;

        // Modelka vybraná v okně; neznámé jméno založí novou
        if (!document.getElementById('albumModelkaGroup').classList.contains('hidden')) {
            const vybrana = await vybratNeboZalozitModelku(document.getElementById('inputAlbumModelka').value);
            if (!vybrana) return;
            stav.modelkaAlba = vybrana;
        }
        const modelka = stav.modelkaAlba;
        const vydani = slozitVydani(rok, mesic, document.getElementById('selectAlbumEdice').value);
        const album = typ === 'Centerfold' ? vydani : document.getElementById('inputAlbumName').value.trim();

        if (stav.editovaneAlbum && !await UpdateAlbum(modelka.id, stav.editovaneAlbum.album, stav.editovaneAlbum.typ, album, typ)) {
            oznamit('Album se nepodařilo uložit. Modelka už nejspíš má jiné album se stejným názvem a typem.');
            return;
        }
        if (links.trim()) {
            const vysledek = await AddBulkPhotos(modelka.id, album, typ, links);
            oznamitVlozeni(vysledek, 'fotek');
            // Nové album bez jediné uložené fotky: okno zůstane otevřené i s vyplněným textem, ať jde odkazy opravit
            if (!stav.editovaneAlbum && vysledek.vlozeno === 0 && !vysledek.duplicitni) return;
        }
        // Centerfold má vydání přímo v názvu alba, ostatním se přiřazuje zvlášť
        // Při přidávání fotek do existujícího alba prázdné pole jeho vydání nemaže; zrušit ho jde jen úpravou alba
        if (typ !== 'Centerfold' && (stav.editovaneAlbum || vydani)) {
            await SetVydaniAlba(modelka.id, album, typ, vydani);
        }
        // Při přidávání fotek do existujícího alba prázdná pole jeho text nemažou
        const popis = document.getElementById('inputAlbumPopis').value;
        const fotograf = document.getElementById('inputAlbumFotograf').value;
        if (stav.editovaneAlbum || popis.trim() || fotograf.trim()) {
            await SetPopisAlba(modelka.id, album, typ, popis, fotograf);
        }

        if (e.submitter?.name === 'dalsi' && !stav.editovaneAlbum) {
            // Další album téže modelky: modelka, typ, fotograf a vydání zůstávají, vyprázdní se jen název, odkazy a text
            ['inputAlbumName', 'inputBulkLinks', 'inputAlbumPopis'].forEach(id => { document.getElementById(id).value = ''; });
            document.getElementById(typ === 'Centerfold' ? 'inputBulkLinks' : 'inputAlbumName').focus();
        } else {
            albumModal.classList.add('hidden');
            document.getElementById('addAlbumForm').reset();
        }
        obnovitPoUlozeniAlba(modelka);
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(stav.casovacHledani);
        stav.casovacHledani = setTimeout(() => {
            // Z profilu nebo stránky vydání se hledají modelky; odkud se hledalo, zůstane v historii
            if (!detailView.classList.contains('hidden') || !issueView.classList.contains('hidden')) {
                const text = searchInput.value;
                zapamatovatMisto({});
                prepnoutRezim('modelky');
                searchInput.value = text;
                nacistGalerii(text);
                return;
            }
            if (stav.rezim !== 'prehled') nacistGalerii(searchInput.value, true);
        }, 180);
    });
}
