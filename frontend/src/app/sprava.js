// Kontrola Disku, export a import, heslo, zálohy a nabídka ⋯
import { DeleteFotografie, DeleteFotografieHromadne, ExportovatDoSouboru, GetFotografove, GetSablonaObrazku, GetTagy, GetVerze, ImportovatSoubory, NastavitHeslo, ObnovitFotky, ObnovitZalohu, OdebratFotky, Odemknout, PrejmenovatFotografa, PrejmenovatTag, PresunoutAlbum, PridatModelkuKAlbu, SetSablonaObrazku, SeznamZaloh, SloucitAlba, SloucitModelky, SlozkaZaloh, VybratSouboryImportu, VymazatMezipamet, ZkontrolovatDavku, ZkontrolovatSoubory } from './backend';
import { esc, formatDatum, nazevAlba, sjednotit } from '../lib/format';
import { jednou, oznamit } from '../ui/oznameni';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { otevritNapovedu, otevritNovinky } from './napoveda';
import { otevritZkratky } from './zkratky';
import { detailView, issueView, searchInput } from './prvky';
import { prepnoutRezim } from './navigace';
import { nacistGalerii } from './galerie';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { nacistCovery } from './stena';
import { obnovitStranku } from './vydani';
import { otevritCoverModal, otevritProfilPodleId } from './cover';
import { otevritDeleteModal, otevritModelModal, otevritRychlePridani, potvrdit, smazatDatabazi, smazatModelku } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold } from './formular-alba';
import { vybratHodnotu, vybratModelku } from './ulozeni';
import { nastavitAkcePrazdna } from '../ui/prazdno';
import { zrusitHledaniAFiltry } from '../ui/volby';

// Kontrola, že Google Disk všechny uložené soubory stále vrací
export const checkModal = document.getElementById('checkModal');

export async function zkontrolovatSoubory(hotovyVysledek = null) {
    const text = document.getElementById('checkModalText');
    const seznam = document.getElementById('checkModalList');
    const odebrat = document.getElementById('checkRemoveBtn');
    text.textContent = 'Ověřuji soubory na Google Disku…';
    seznam.innerHTML = '';
    odebrat.classList.add('hidden');
    checkModal.classList.remove('hidden');

    const vysledek = hotovyVysledek || await ZkontrolovatSoubory();
    localStorage.setItem('posledniKontrola', String(Date.now()));
    const neovereno = vysledek.neovereno
        ? ` U ${vysledek.neovereno} se kontrola nepovedla (zřejmě připojení), zkus to později znovu.`
        : '';

    if (vysledek.nedostupne.length === 0) {
        text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Všechny ověřené jsou dostupné.${neovereno}`;
        return;
    }

    // Mnoho nedostupných najednou bývá výpadek nebo omezení požadavků na straně Googlu, ne smazané soubory
    stav.nedostupnychPodezreleMnoho = vysledek.nedostupne.length >= 10 && vysledek.nedostupne.length > vysledek.zkontrolovano * 0.1;
    text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Nedostupných: ${vysledek.nedostupne.length} – na Disku jsou smazané nebo už nejsou sdílené.${neovereno}`
        + (stav.nedostupnychPodezreleMnoho ? ' To je podezřele mnoho najednou: vypadá to spíš na výpadek nebo omezení ze strany Googlu. Zkus kontrolu později znovu, než něco odebereš.' : '');
    seznam.innerHTML = vysledek.nedostupne.map(n => {
        const kde = n.fotoId === 0
            ? `titulní fotka (změň ji přes Upravit modelku)`
            : `${n.typ} · ${nazevAlba(n.album, n.typ)}`;
        return `<li><strong>${esc(n.jmeno || 'Cover časopisu')}</strong><span>${esc(kde)}${n.fotoId !== 0 && !n.opakovane ? ' · poprvé' : ''}</span></li>`;
    }).join('');

    // Odebrat se nabízí jen fotky nedostupné i při některé dřívější kontrole; poprvé nedostupná může být jen výpadek.
    // Titulní fotky se neodebírají, modelka by zůstala bez obrázku bez vědomí uživatele.
    stav.nedostupneFotky = vysledek.nedostupne.filter(n => n.fotoId !== 0 && n.opakovane);
    const poprve = vysledek.nedostupne.filter(n => n.fotoId !== 0 && !n.opakovane).length;
    if (poprve) text.textContent += ` Poprvé nedostupných: ${poprve} – ověří se znovu při další kontrole, odebrat půjdou, jen když budou nedostupné i jindy.`;
    odebrat.classList.toggle('hidden', stav.nedostupneFotky.length === 0);
    odebrat.textContent = stav.nedostupnychPodezreleMnoho
        ? `Přesto odebrat z databáze (${stav.nedostupneFotky.length})…`
        : `Odebrat nedostupné z databáze (${stav.nedostupneFotky.length})`;
}

export function zavritKontrolu() {
    checkModal.classList.add('hidden');
}

// Export celé sbírky do souboru YAML, který jde upravovat v textovém editoru
export async function exportovatData() {
    const cesta = await ExportovatDoSouboru();
    if (cesta) oznamit(`Sbírka je uložená v souboru ${cesta}`);
}

// Import ze souboru YAML: doplňuje a opravuje; smaže jen údaje s hodnotou „-“, modelky, alba ani fotky nemaže
export async function importovatData() {
    // Jeden nebo více souborů YAML či Markdown; načtou se jako jeden celek
    const cesty = await VybratSouboryImportu() || [];
    if (!cesty.length) return;
    const nazvy = cesty.map(c => c.split('/').pop());
    const co = nazvy.length === 1 ? `ze souboru „${nazvy[0]}“` : `ze souborů (${nazvy.length}): ${nazvy.slice(0, 3).join(', ')}${nazvy.length > 3 ? ', …' : ''}`;
    if (!await potvrdit('Importovat do sbírky', `Načíst data ${co}? Stávající modelky a alba se doplní a opraví, nové se přidají. Smažou se jen údaje, které mají v souboru hodnotu „-“; modelky, alba ani fotky se nemažou. Před importem se uloží záloha.`, 'Importovat')) return;

    const v = await ImportovatSoubory(cesty);
    if (v.selhalo) {
        oznamit(v.selhalo, { text: 'Rozumím', akce: () => {} });
        return;
    }
    const shrnuti = `Import hotov. Nové modelky: ${v.noveModelky}, upravené: ${v.upraveneModelky}, alba: ${v.alba}, nové fotky: ${v.noveFotky}.`;
    const vypis = (seznam) => `${seznam.slice(0, 5).join('; ')}${seznam.length > 5 ? '; …' : ''}`;
    const opravy = v.opravy || [];
    // Co se nepodařilo převzít nebo co se opravilo (překlepy v klíčích), zůstane vidět, dokud to uživatel nezavře
    const podrobnosti = [
        v.chyby.length ? `Přeskočeno (${v.chyby.length}): ${vypis(v.chyby)}` : '',
        opravy.length ? `Klíče v souboru (${opravy.length}): ${vypis(opravy)}` : '',
    ].filter(Boolean).join(' ');
    if (podrobnosti) oznamit(`${shrnuti} ${podrobnosti}`, { text: 'Rozumím', akce: () => {} });
    else oznamit(shrnuti);
    prepnoutRezim('modelky');
    nacistGalerii(searchInput.value);
}

// Heslo: nastavení, změna a zrušení. Chrání rozhraní, databáze na disku šifrovaná není.
export const passModal = document.getElementById('passModal');

export function otevritHeslo() {
    document.getElementById('passForm').reset();
    document.getElementById('passModalTitle').textContent = stav.maZamek ? 'Změnit nebo zrušit heslo' : 'Nastavit heslo';
    document.getElementById('passOldGroup').classList.toggle('hidden', !stav.maZamek);
    document.getElementById('passNewLabel').textContent = stav.maZamek ? 'Nové heslo (prázdné zámek zruší)' : 'Nové heslo';
    passModal.classList.remove('hidden');
    document.getElementById(stav.maZamek ? 'inputPassOld' : 'inputPassNew').focus();
}

// Zamčený program neukáže nic ze sbírky, dokud heslo nesouhlasí
export function odemknoutPriStartu() {
    const obrazovka = document.getElementById('lockScreen');
    const pole = document.getElementById('inputLock');
    const zprava = document.getElementById('lockMsg');
    stav.zamceno = true;
    document.getElementById('app').classList.add('zamceno');
    obrazovka.classList.remove('hidden');
    pole.focus();

    return new Promise((odemceno) => {
        document.getElementById('lockForm').onsubmit = async (e) => {
            e.preventDefault();
            zprava.textContent = 'Ověřuji…';
            if (!await Odemknout(pole.value)) {
                zprava.textContent = 'Heslo nesouhlasí.';
                pole.select();
                return;
            }
            pole.value = '';
            stav.zamceno = false;
            document.getElementById('app').classList.remove('zamceno');
            obrazovka.classList.add('hidden');
            odemceno();
        };
    });
}

// Mezipaměť jsou jen kopie obrázků stažené z Disku; po vymazání se načtou znovu
export async function vymazatMezipamet() {
    const bajty = await VymazatMezipamet();
    oznamit(`Mezipaměť obrázků vymazána (uvolněno ${(bajty / 1024 / 1024).toFixed(1)} MB). Obrázky se načtou znovu z Disku.`);
    setTimeout(() => window.location.reload(), 2500);
}

// Jednou denně na pozadí ověří, že soubory na Disku stále existují
export async function kontrolaPoSpusteni() {
    const DEN = 24 * 60 * 60 * 1000;
    if (Date.now() - Number(localStorage.getItem('posledniKontrola') || 0) < DEN) return;

    // Denně jen dávka nejdéle neověřených fotek, aby Google nedostal tisíce požadavků najednou
    const vysledek = await ZkontrolovatDavku();
    // Při výpadku připojení se kontrola zopakuje při dalším spuštění
    if (vysledek.zkontrolovano > 0 && vysledek.neovereno === vysledek.zkontrolovano) return;
    localStorage.setItem('posledniKontrola', String(Date.now()));

    // Hlásí se jen soubory nedostupné opakovaně
    const opakovane = vysledek.nedostupne.filter(n => n.opakovane).length;
    if (opakovane > 0) {
        oznamit(`Souborů, které na Google Disku opakovaně nejsou dostupné: ${opakovane}.`,
            { text: 'Zobrazit', akce: () => zkontrolovatSoubory(vysledek) });
    }
}

export function smazatCover(cover) {
    otevritDeleteModal(
        'Smazat cover',
        `Opravdu smazat cover vydání „${nazevAlba(cover.album, cover.typ)}“? Soubor na Google Disku zůstane.`,
        () => DeleteFotografie(cover.fotky[0].id),
        () => nacistCovery(searchInput.value)
    );
}

// Sdílené album: další modelka ho uvidí i ve svém profilu
export async function pridatModelkuKAlbu(album) {
    const modelka = await vybratModelku('Přidat modelku k albu', `Album „${nazevAlba(album.album, album.typ)}“ se ukáže i v jejím profilu; fotky, srdíčka a text zůstanou společné.`,
        'Přidat', [album.modelkaId, ...album.dalsiModelky.map(m => m.id)]);
    if (!modelka) return;
    if (!await PridatModelkuKAlbu(album.modelkaId, album.album, album.typ, modelka.id)) {
        oznamit('Modelku se k albu nepodařilo přidat.');
        return;
    }
    nacistFotkyModelky(stav.aktualniModelka.id);
}

export async function presunoutAlbum(album) {
    const modelka = await vybratModelku('Přesunout album', `Album „${nazevAlba(album.album, album.typ)}“ přejde i se srdíčky, pořadím a textem k jiné modelce.`, 'Přesunout', [album.modelkaId]);
    if (!modelka) return;
    const chyba = await PresunoutAlbum(album.modelkaId, album.album, album.typ, modelka.id);
    if (chyba) {
        oznamit(chyba);
        return;
    }
    oznamit(`Album je teď u modelky ${modelka.jmeno}.`, { text: 'Otevřít její profil', akce: () => otevritProfilPodleId(modelka.id) });
    nacistFotkyModelky(stav.aktualniModelka.id);
}

export async function sloucitAlbum(album) {
    const jina = stav.aktualniAlba.filter(a => a !== album && a.modelkaId === album.modelkaId);
    const popisAlba = a => `${nazevAlba(a.album, a.typ)} (${a.typ})`;
    const vybrane = await vybratHodnotu({
        nadpis: 'Sloučit s albem',
        text: `Fotky alba „${nazevAlba(album.album, album.typ)}“ přejdou do vybraného alba; soubory, které tam už jsou, se nezdvojí. Před sloučením se uloží záloha.`,
        popisek: 'Cílové album', moznosti: jina.map(popisAlba), tlacitko: 'Sloučit',
    });
    if (!vybrane) return;
    const cil = jina.find(a => popisAlba(a) === vybrane || sjednotit(a.album) === sjednotit(vybrane));
    if (!cil) {
        oznamit('Takové album modelka nemá. Vyber ho ze seznamu.');
        return;
    }
    const chyba = await SloucitAlba(album.modelkaId, album.album, album.typ, cil.album, cil.typ);
    if (chyba) oznamit(chyba);
    nacistFotkyModelky(stav.aktualniModelka.id);
}

// Duplicitní modelka se sloučí do otevřené: alba přejdou, prázdné údaje se doplní
export async function sloucitModelku(modelka) {
    const zdroj = await vybratModelku('Sloučit s jinou modelkou', `Vybraná modelka se sloučí do modelky ${modelka.jmeno}: její alba přejdou sem, prázdné údaje se doplní a její jméno se přidá mezi pseudonymy. Před sloučením se uloží záloha.`, 'Vybrat', [modelka.id]);
    if (!zdroj) return;
    if (!await potvrdit('Sloučit modelky', `Sloučit modelku „${zdroj.jmeno}“ do „${modelka.jmeno}“? Modelka „${zdroj.jmeno}“ pak jako samostatná zmizí.`, 'Sloučit', { nebezpecne: true })) return;
    const chyba = await SloucitModelky(modelka.id, zdroj.id);
    if (chyba) {
        oznamit(chyba);
        return;
    }
    oznamit(`Modelka ${zdroj.jmeno} je sloučená do ${modelka.jmeno}.`);
    otevritProfilPodleId(modelka.id);
}

// Náhodná modelka ze sbírky (ne ta, jejíž profil je zrovna otevřený)
export async function nahodnaModelka() {
    const modelky = (await vsechnyModelky()).filter(m => m.id !== stav.aktualniModelka?.id || detailView.classList.contains('hidden'));
    if (modelky.length) otevritDetailModelky(modelky[Math.floor(Math.random() * modelky.length)]);
}

export async function zmenitInterval() {
    const sekundy = await vybratHodnotu({ nadpis: 'Interval slideshow', popisek: 'Sekund na fotku', moznosti: ['2', '3', '4', '6', '8', '10', '15'], tlacitko: 'Uložit', vychozi: String(stav.intervalSlideshow / 1000) });
    const hodnota = parseFloat(String(sekundy || '').replace(',', '.'));
    if (!hodnota || hodnota < 1 || hodnota > 120) {
        if (sekundy) oznamit('Zadej počet sekund od 1 do 120.');
        return;
    }
    stav.intervalSlideshow = Math.round(hodnota * 1000);
    try { localStorage.setItem('intervalSlideshow', String(stav.intervalSlideshow)); } catch { /* jen se nezapamatuje */ }
    oznamit(`Slideshow ukazuje každou fotku ${hodnota} s.`);
}

// Šablona adresy obrázků: kdyby Google adresu náhledů změnil, jde ji upravit bez nové verze programu
export async function zmenitSablonuObrazku() {
    const sablona = await vybratHodnotu({
        nadpis: 'Adresa obrázků',
        text: '{id} je ID souboru na Disku, {velikost} požadovaná velikost (např. w600, s0). Prázdné pole vrátí výchozí adresu.',
        popisek: 'Šablona', tlacitko: 'Uložit', vychozi: await GetSablonaObrazku(),
    });
    if (sablona === null) return;
    const chyba = await SetSablonaObrazku(sablona);
    if (chyba) {
        oznamit(chyba);
        return;
    }
    window.location.reload();
}

// Hromadné přejmenování fotografa nebo tagu v celé sbírce
export async function prejmenovatVeSbirce(co) {
    const fotograf = co === 'fotograf';
    const moznosti = await (fotograf ? GetFotografove() : GetTagy()) || [];
    if (!moznosti.length) {
        oznamit(fotograf ? 'Ve sbírce zatím není žádný fotograf.' : 'Ve sbírce zatím není žádný tag.');
        return;
    }
    const stary = await vybratHodnotu({ nadpis: fotograf ? 'Přejmenovat fotografa' : 'Přejmenovat tag', popisek: fotograf ? 'Fotograf' : 'Tag', moznosti, tlacitko: 'Pokračovat' });
    if (!stary) return;
    const novy = await vybratHodnotu({ nadpis: fotograf ? 'Přejmenovat fotografa' : 'Přejmenovat tag', text: `Nový zápis pro „${stary}“ v celé sbírce.`, popisek: 'Nově', tlacitko: 'Přejmenovat', vychozi: stary });
    if (!novy || novy === stary) return;
    const pocet = fotograf ? await PrejmenovatFotografa(stary, novy) : await PrejmenovatTag(stary, novy);
    oznamit(fotograf ? `Upraveno alb: ${pocet}.` : `Upraveno modelek: ${pocet}.`);
    if (!detailView.classList.contains('hidden')) otevritProfilPodleId(stav.aktualniModelka.id);
}

// Fotka se odebere hned; oznámení nabídne vrátit ji i se srdíčky, pořadím a textem alba
export async function smazatFotku(fotka, album) {
    const obnova = await OdebratFotky([fotka.id]) || [];
    if (!obnova.length) return;
    obnovitCoJeVidet();
    nabidnoutVraceni('Fotka odebrána z alba. Soubor na Google Disku zůstal.', obnova);
}

// Oznámení s tlačítkem Vrátit; obnova přichází z backendu i s výběry a dalšími modelkami alba
export function nabidnoutVraceni(text, obnova) {
    oznamit(text, { text: 'Vrátit', akce: async () => {
        await ObnovitFotky(obnova);
        obnovitCoJeVidet();
    } });
}

// Překreslí pohled, který je právě vidět (po změně, která se ho mohla týkat)
export function obnovitCoJeVidet() {
    if (!detailView.classList.contains('hidden')) nacistFotkyModelky(stav.aktualniModelka.id);
    else if (!issueView.classList.contains('hidden')) obnovitStranku();
    else nacistGalerii(searchInput.value);
}

// Správa sbírky: stejné položky nabízí pravé tlačítko na volném místě galerie i tlačítko ⋯ v hlavičce
export function polozkySpravy() {
    return [
        { nadpis: 'Prohlížení' },
        { text: 'Náhodná modelka', akce: nahodnaModelka },
        { text: `Interval slideshow (${stav.intervalSlideshow / 1000} s)…`, akce: zmenitInterval },
        { nadpis: 'Soubory a mezipaměť' },
        { text: 'Obnovit zobrazení', akce: () => nacistGalerii(searchInput.value) },
        { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        { text: 'Vymazat mezipaměť obrázků', akce: vymazatMezipamet },
        { nadpis: 'Zálohy a data' },
        { text: 'Obnovit ze zálohy…', akce: otevritZalohy },
        { text: 'Otevřít složku se zálohami', akce: async () => BrowserOpenURL('file://' + await SlozkaZaloh()) },
        { text: 'Exportovat sbírku (YAML)…', akce: exportovatData },
        { text: 'Importovat (YAML nebo Markdown)…', akce: importovatData },
        { nadpis: 'Nastavení' },
        { text: 'Adresa obrázků…', akce: zmenitSablonuObrazku },
        { text: 'Přejmenovat fotografa…', akce: () => prejmenovatVeSbirce('fotograf') },
        { text: 'Přejmenovat tag…', akce: () => prejmenovatVeSbirce('tag') },
        { text: stav.maZamek ? 'Změnit nebo zrušit heslo…' : 'Nastavit heslo…', akce: otevritHeslo },
        // Nové načtení okna znovu vyžádá heslo
        ...(stav.maZamek ? [{ text: 'Zamknout', akce: () => window.location.reload() }] : []),
        null,
        { text: 'Smazat celou databázi', akce: smazatDatabazi, nebezpecne: true },
        { nadpis: 'Nápověda' },
        { text: 'Nápověda', akce: otevritNapovedu },
        { text: 'Klávesové zkratky (?)', akce: otevritZkratky },
        { text: `Co je nového · verze ${stav.verzeProgramu}`, akce: () => otevritNovinky() },
    ];
}

// Tlačítka v hlavičce otevírají tutéž nabídku jako pravé tlačítko, jen pod sebou
export function nabidkaPodTlacitkem(e, polozky) {
    e.stopPropagation();
    const misto = e.currentTarget.getBoundingClientRect();
    otevritKontextovouNabidku(misto.left, misto.bottom + 4, polozky);
}

// Obnovení ze zálohy: seznam záloh s počty, aby šlo poznat, ke které se vrátit
export const NAZVY_ZALOH = {
    'denni': 'Denní záloha',
    'pred-smazanim-alba': 'Před smazáním alba',
    'pred-smazanim-modelky': 'Před smazáním modelky',
    'pred-smazanim-databaze': 'Před smazáním databáze',
    'pred-odebranim-fotek': 'Před odebráním fotek',
    'pred-importem': 'Před importem',
    'pred-obnovenim': 'Před obnovením',
    'pred-migraci': 'Před úpravou databáze',
    'pred-sloucenim': 'Před sloučením alb',
    'pred-sloucenim-modelek': 'Před sloučením modelek',
};
export const backupModal = document.getElementById('backupModal');
export const casZalohy = z => `${formatDatum(z.cas.slice(0, 10))} ${z.cas.slice(11, 16)}`;

export async function otevritZalohy() {
    const zalohy = await SeznamZaloh() || [];
    document.getElementById('backupModalText').textContent = zalohy.length
        ? 'Databáze se vrátí do stavu vybrané zálohy. Současný stav se předtím uloží jako další záloha, takže jde vrátit i obnovení. Heslo zůstane současné.'
        : 'Zatím není žádná záloha. Vzniká jednou denně při spuštění a před každou hromadnou změnou.';
    document.getElementById('backupModalList').innerHTML = zalohy.map(z => `
        <li>
            <strong>${esc(casZalohy(z))}</strong>
            <span>${esc(NAZVY_ZALOH[z.duvod] || z.duvod)} · ${z.poskozena ? 'nejde přečíst' : `modelek ${z.modelek}, fotek ${z.fotek}`}</span>
            <button class="btn btn-secondary btn-small" data-obnovit="${esc(z.soubor)}" data-popis="${esc(casZalohy(z))}" ${z.poskozena ? 'disabled' : ''}>Obnovit</button>
        </li>`).join('');
    backupModal.classList.remove('hidden');
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('closeCheckModalBtn').onclick = zavritKontrolu;

    document.getElementById('checkCloseBtn').onclick = zavritKontrolu;

    document.getElementById('checkRemoveBtn').onclick = jednou(async () => {
        if (stav.nedostupnychPodezreleMnoho && !await potvrdit('Odebrat nedostupné fotky',
            `Opravdu odebrat ${stav.nedostupneFotky.length} fotek z databáze? Je jich podezřele mnoho najednou; pokud jde jen o výpadek Disku, přijdeš o jejich zařazení do alb, pořadí i srdíčka. Před odebráním se uloží záloha.`, 'Přesto odebrat', { nebezpecne: true })) return;

        // Jedna záloha a jedno odebrání pro všechny
        if (!await DeleteFotografieHromadne(stav.nedostupneFotky.map(n => n.fotoId))) {
            oznamit('Odebrání se nepodařilo, nic se nezměnilo.');
            return;
        }
        oznamit(`Odebráno fotek: ${stav.nedostupneFotky.length}. Záloha před odebráním je ve složce ${await SlozkaZaloh()}`);
        stav.nedostupneFotky = [];
        zavritKontrolu();
        if (!detailView.classList.contains('hidden')) nacistFotkyModelky(stav.aktualniModelka.id);
        else nacistGalerii(searchInput.value);
    });

    document.getElementById('closePassModalBtn').onclick = () => passModal.classList.add('hidden');

    document.getElementById('passForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const nove = document.getElementById('inputPassNew').value;
        if (nove !== document.getElementById('inputPassNew2').value) {
            oznamit('Nové heslo a jeho zopakování se liší.');
            return;
        }
        if (!nove && !stav.maZamek) {
            oznamit('Zadej heslo, kterým se má program zamykat.');
            return;
        }
        if (!await NastavitHeslo(document.getElementById('inputPassOld').value, nove)) {
            oznamit('Stávající heslo nesouhlasí, nic se nezměnilo.');
            return;
        }
        stav.maZamek = Boolean(nove);
        passModal.classList.add('hidden');
        oznamit(stav.maZamek ? 'Heslo je nastavené, vyžádá se při příštím spuštění.' : 'Zámek je zrušený.');
    });

    GetVerze().then(verze => { stav.verzeProgramu = verze; });

    // Tlačítka v prázdných stavech stránek: Přidat… otevře nabídku + nahoře, ostatní jdou rovnou do okna.
    // Nabídka se otevře až po doběhnutí kliku, jinak by ji týž klik hned zavřel jako klik mimo ni.
    nastavitAkcePrazdna({
        pridat: () => setTimeout(() => document.getElementById('addBtn').click()),
        'pridat-modelku': () => otevritRychlePridani(),
        'pridat-album': () => otevritAlbumModal(stav.aktualniModelka),
        zrusit: () => zrusitHledaniAFiltry(),
    });

    document.getElementById('addBtn').onclick = (e) => {
        const vProfilu = !detailView.classList.contains('hidden');
        const naVydani = !issueView.classList.contains('hidden');
        nabidkaPodTlacitkem(e, [
            ...(vProfilu ? [{ text: `Přidat fotky nebo album… (${stav.aktualniModelka.jmeno})`, akce: () => otevritAlbumModal(stav.aktualniModelka) }, null] : []),
            { text: 'Přidat modelku…', akce: otevritRychlePridani },
            // Centerfold a cover se po uložení vracejí do přehledu, proto se z profilu a ze stránky vydání nenabízejí
            ...(vProfilu || naVydani ? [] : [
                { text: 'Přidat centerfold…', akce: pridatCenterfold },
                { text: 'Přidat cover…', akce: () => otevritCoverModal() },
            ]),
        ]);
    };

    document.getElementById('menuBtn').onclick = (e) => {
        const vProfilu = !detailView.classList.contains('hidden');
        nabidkaPodTlacitkem(e, [
            ...(vProfilu ? [
                { nadpis: stav.aktualniModelka.jmeno },
                { text: 'Upravit modelku…', akce: () => otevritModelModal(stav.aktualniModelka) },
                { text: 'Sloučit s jinou modelkou…', akce: () => sloucitModelku(stav.aktualniModelka) },
                { text: 'Smazat modelku', akce: () => smazatModelku(stav.aktualniModelka), nebezpecne: true },
                null,
            ] : []),
            ...polozkySpravy(),
        ]);
    };

    document.getElementById('editModelBtn').onclick = () => otevritModelModal(stav.aktualniModelka);

    // Tlačítko ⋯ v hlavičce alba otevře tutéž nabídku jako pravé tlačítko na albu
    document.getElementById('photosGrid').addEventListener('click', (e) => {
        const tlacitko = e.target.closest('[data-nabidka-alba]');
        if (!tlacitko) return;
        e.stopPropagation();
        const misto = tlacitko.getBoundingClientRect();
        tlacitko.parentElement.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: misto.left, clientY: misto.bottom + 4 }));
    });

    document.getElementById('backupModalList').addEventListener('click', async (e) => {
        const tlacitko = e.target.closest('[data-obnovit]');
        if (!tlacitko || tlacitko.disabled) return;
        if (!await potvrdit('Obnovit ze zálohy', `Vrátit databázi do stavu z ${tlacitko.dataset.popis}? Vše, co bylo změněno potom, zmizí; současný stav se ale předtím uloží jako záloha „Před obnovením“.`, 'Obnovit', { nebezpecne: true })) return;

        // Druhý klik během obnovování nesmí spustit další
        tlacitko.disabled = true;
        const chyba = await ObnovitZalohu(tlacitko.dataset.obnovit);
        if (chyba) {
            tlacitko.disabled = false;
            oznamit(chyba, { text: 'Rozumím', akce: () => {} });
            return;
        }
        backupModal.classList.add('hidden');
        prepnoutRezim('modelky');
        searchInput.value = '';
        nacistGalerii();
        oznamit(`Databáze je obnovená do stavu z ${tlacitko.dataset.popis}.`);
    });
}
