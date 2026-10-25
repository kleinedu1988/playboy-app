// Výběrová okna, ukládání formulářů a hledání
import { esc, jeOnline, obdobiCyberGirl, platneDatum, prevestVahu, prevestVysku, sjednotit, slozitVydani, udajChybi } from '../lib/format';
import { AddBulkPhotos, AddModelka, SetDatumAlba, SetPopisAlba, SetVydaniAlba, UpdateAlbum, UpdateModelka } from './backend';
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
import { nacistPrehled } from './prehled';
import { SKUPINY_UDAJU } from '../lib/udrzba';
import { poUlozeniAlba, poUlozeniModelky } from './uceni';
import { otevritProfilPodleId } from './cover';
import { albumModal, modelModal } from './okno';
import { neniDuplicitni } from './vyrez';
import { deleteModal, otevritModelModal, poleModelky, potvrdit, ukazatZalozku, zameritPole, zavritDeleteModal } from './formular-modelky';
import { obnovitNahledAlba, vybratNeboZalozitModelku } from './formular-alba';

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
// Okna s formulářem: Esc, křížek nebo Zrušit se u rozepsaných změn zeptá (i článek a číslo, kde jde o dlouhý text)
const oknaSFormularem = () => [document.getElementById('textModal'), modelModal, albumModal, document.getElementById('coverModal'), document.getElementById('clanekModal'), document.getElementById('issueModal'), document.getElementById('quickModal'), document.getElementById('doplnitModal')];

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
        // Návrh upravený v „Upravit…“ a uložený s jinou hodnotou si zapamatuje učení
        if (stav.editovanaModelka) poUlozeniModelky(modelka);
        // Doplňování v řadě: další modelka z tabulky Přehledu, na stejné záložce a v prvním chybějícím poli
        if (e.submitter?.id === 'modelNextBtn' && stav.frontaDoplnovani) {
            const fronta = stav.frontaDoplnovani;
            const dalsiId = fronta.ids[fronta.ids.indexOf(stav.editovanaModelka.id) + 1];
            const dalsi = dalsiId && (await vsechnyModelky()).find(m => m.id === dalsiId);
            if (dalsi) {
                otevritModelModal(dalsi, fronta);
                ukazatZalozku(fronta.zalozka);
                const skupina = SKUPINY_UDAJU.find(sk => sk.zalozka === fronta.zalozka);
                // Fronta z Přehledu zaměří první chybějící údaj ve skupině
                const prvni = fronta.klic === 'titulni' ? ['', '', 'inputDriveID'] : skupina?.udaje.find(([vlastnost]) => udajChybi(dalsi, vlastnost));
                zameritPole(prvni ? prvni[2] : 'inputJmeno');
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
        // Online album k číslu nepatří: vydání se nebere, místo něj datum nafocení; album „Nikde“ nemá ani jedno
        const online = jeOnline(typ);
        const cyberGirl = online && typ !== 'Pictorial online' ? typ : '';
        const bezCisla = document.getElementById('albumVydaniGroup').classList.contains('hidden');
        const rok = bezCisla ? '' : document.getElementById('inputAlbumRok').value;
        // Měsíc, nebo speciál – podle toho, který výběr je vidět
        const vyberCisla = document.getElementById('selectAlbumSpecial').classList.contains('hidden') ? 'selectAlbumMesic' : 'selectAlbumSpecial';
        const mesic = bezCisla ? '' : document.getElementById(vyberCisla).value;
        // Pictorialu stačí ročník, měsíc bez roku ale nedává smysl
        if (mesic && !rok) {
            oznamit('K měsíci vydání chybí rok.');
            return;
        }
        // Datum nafocení smí být neúplné (jen rok nebo rok a měsíc), ale jen v tomto tvaru
        const datum = online ? document.getElementById('inputAlbumDatum').value.trim() : '';
        if (!platneDatum(datum)) {
            document.getElementById('inputAlbumDatum').focus();
            oznamit('Datum nafocení napiš jako RRRR-MM-DD, RRRR-MM nebo jen rok RRRR.');
            return;
        }
        if (cyberGirl && !obdobiCyberGirl(cyberGirl, datum)) {
            document.getElementById('inputAlbumDatum').focus();
            oznamit(cyberGirl.endsWith('týdne')
                ? 'Cyber Girl of the Week potřebuje celé datum RRRR-MM-DD, aby šel spočítat týden.'
                : 'Cyber Girl of the Month potřebuje datum aspoň RRRR-MM, aby byl znát měsíc.');
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
        if (typ !== 'Centerfold' && !online && (stav.editovaneAlbum || vydani)) {
            await SetVydaniAlba(modelka.id, album, typ, vydani);
        }
        // Datum nafocení online alba; prázdné pole ho maže jen při úpravě alba
        if (online && (stav.editovaneAlbum || datum)) {
            await SetDatumAlba(modelka.id, album, typ, datum);
        }
        // Při přidávání fotek do existujícího alba prázdná pole jeho text nemažou
        const popis = document.getElementById('inputAlbumPopis').value;
        const fotograf = document.getElementById('inputAlbumFotograf').value;
        if (stav.editovaneAlbum || popis.trim() || fotograf.trim()) {
            await SetPopisAlba(modelka.id, album, typ, popis, fotograf);
        }
        if (stav.editovaneAlbum) poUlozeniAlba(modelka.id, stav.editovaneAlbum.album, stav.editovaneAlbum.typ, { vydani, fotograf, popis });

        if (e.submitter?.name === 'dalsi' && !stav.editovaneAlbum) {
            // Další album téže modelky: modelka, typ, fotograf a vydání zůstávají, vyprázdní se jen název, odkazy a text
            ['inputAlbumName', 'inputBulkLinks', 'inputAlbumPopis'].forEach(id => { document.getElementById(id).value = ''; });
            obnovitNahledAlba();
            delete albumModal.dataset.zmeneno;
            document.getElementById(typ === 'Centerfold' ? 'inputBulkLinks' : 'inputAlbumName').focus();
        } else {
            albumModal.classList.add('hidden');
            document.getElementById('addAlbumForm').reset();
        }
        obnovitPoUlozeniAlba(modelka);
    });

    // ✕ v hledání: smaže text a hledání se obnoví jako po ručním smazání
    document.getElementById('searchClearBtn').addEventListener('click', (e) => {
        e.preventDefault();
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });

    // Ctrl+F skočí do hledání odkudkoli kromě otevřeného okna, prohlížeče a zamčeného programu
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'f') return;
        if (stav.zamceno || searchInput.disabled || document.querySelector('.modal-overlay:not(.hidden), #lightbox:not(.hidden)')) return;
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
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
