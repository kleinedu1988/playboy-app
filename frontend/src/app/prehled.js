// Přehled sbírky: co chybí doplnit a akce v buňkách tabulek
import { GetPrehled, SetNetykaSe, SetNetykaSeAlba, SetStavVydani } from './backend';
import { MESICE, VYCHOZI_EDICE, esc, nazevAlba, nazevVydani, udajChybi } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { searchInput, stats } from './prvky';
import { prepnoutRezim, ukazatPohled } from './navigace';
import { nacistGalerii } from './galerie';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { nastavitEdiciKalendare } from './kalendar';
import { otevritCoverModal } from './cover';
import { otevritModelModal, ukazatZalozku } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold } from './formular-alba';

// Přehled sbírky: kolik čeho je a co ještě chybí doplnit.
// Každá modelka a každé vydání má jeden řádek, sloupce říkají, co u nich chybí.
// Údaje modelky, které přehled hlídá, po skupinách shodných se záložkami formuláře: [vlastnost, název, pole formuláře].
// Další jména a poznámka se nehlídají, většina modelek je mít nemusí.
export const SKUPINY_UDAJU = [
    { nazev: 'Základní údaje', zalozka: 0, udaje: [
        ['narozeniDatum', 'datum narození', 'inputNarozeniDatum'],
        ['narozeniMisto', 'místo narození', 'inputNarozeniMisto'],
        ['narodnost', 'národnost', 'inputNarodnost'],
        ['etnicita', 'etnicita', 'inputEtnicita'],
    ] },
    { nazev: 'Vzhled a míry', zalozka: 1, udaje: [
        ['vyskaCm', 'výška', 'inputVyska'],
        ['vahaKg', 'váha', 'inputVaha'],
        ['vlasyBarva', 'barva vlasů', 'inputVlasy'],
        ['ociBarva', 'barva očí', 'inputOci'],
        ['ochlupeni', 'ochlupení', 'selectOchlupeni'],
        ['tetovani', 'tetování', 'selectTetovani'],
        ['piercing', 'piercing', 'selectPiercing'],
        ['obvodHrudnikCm', 'hrudník', 'inputHrudnik'],
        ['obvodPasCm', 'pas', 'inputPas'],
        ['obvodBokyCm', 'boky', 'inputBoky'],
        ['velikostPrsou', 'velikost prsou', 'inputVelikost'],
        ['prsaTyp', 'typ prsou', 'selectPrsaTyp'],
    ] },
    { nazev: 'Zařazení', zalozka: 2, udaje: [
        ['role', 'role', 'inputRole'],
        ['tags', 'tagy', 'inputTags'],
    ] },
];
// Klíč „netýká se" podle záložky formuláře
export const KLICE_SKUPIN = ['zakladni', 'vzhled', 'zarazeni'];

export async function nacistPrehled() {
    const moje = ++stav.cisloNacteni;
    const [p, seznamModelek] = await Promise.all([GetPrehled(stav.prehledSkryte), vsechnyModelky()]);
    if (moje !== stav.cisloNacteni) return;
    stav.prehledModelky = new Map(seznamModelek.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const dlazdice = (cislo, popis) => `<div class="stat-tile"><strong>${cislo}</strong><span>${popis}</span></div>`;
    const ano = '<td class="ok" title="V pořádku">&#10003;</td>';
    // Buňka s chybějícím údajem je zároveň tlačítko, které ho nabídne doplnit
    const chybi = (akce, napoveda, klic = akce) => `<td class="chybi" data-akce="${akce}" data-klic="${klic}" title="${napoveda} (pravým tlačítkem: netýká se)">chybí</td>`;
    // Údaj označený „netýká se": nesleduje se; pravým tlačítkem jde označení zrušit
    const netyka = klic => `<td class="netyka" data-klic="${klic}" data-netyka="1" title="Netýká se – pravým tlačítkem jde znovu sledovat">—</td>`;
    const netykaModelky = id => new Set((stav.prehledModelky.get(id)?.netykaSe || '').split(',').filter(Boolean));
    const NAPOVEDY = {
        titulni: 'Doplnit titulní fotku',
        centerfold: 'Přidat centerfold',
        hodnoceni: 'Otevřít profil a ohodnotit',
    };
    const zbytek = (pocet) => pocet > stav.prehledLimit ? `<p class="stat-note">Zobrazeno ${stav.prehledLimit} z ${pocet}. <button class="link" data-vice>Zobrazit dalších ${Math.min(60, pocet - stav.prehledLimit)}</button></p>` : '';

    // Modelky: co chybí přímo u nich a kolik jejich alb nemá text nebo vydání
    const modelky = new Map();
    const radek = (m) => {
        if (!modelky.has(m.modelkaId)) modelky.set(m.modelkaId, { id: m.modelkaId, jmeno: m.jmeno, chybi: new Set(), bezPopisu: [], bezVydani: [], netyka: netykaModelky(m.modelkaId) });
        return modelky.get(m.modelkaId);
    };
    /** @type {[string, any[]][]} */ ([['titulni', p.bezTitulni], ['centerfold', p.bezCenterfoldu], ['hodnoceni', p.bezHodnoceni]])
        .forEach(([co, seznam]) => seznam.forEach(m => radek(m).chybi.add(co)));
    // Údaje z formuláře: které v každé skupině chybí
    stav.prehledModelky.forEach(m => {
        const netykaSe = netykaModelky(m.id);
        const chybejici = SKUPINY_UDAJU.map((s, i) => netykaSe.has(KLICE_SKUPIN[i]) && !stav.prehledSkryte ? [] : s.udaje.filter(([vlastnost]) => udajChybi(m, vlastnost)));
        if (chybejici.some(skupina => skupina.length)) radek({ modelkaId: m.id, jmeno: m.jmeno }).udaje = chybejici;
    });
    p.albaBezPopisu.forEach(a => radek(a).bezPopisu.push(a));
    p.albaBezVydani.forEach(a => radek(a).bezVydani.push(a));
    stav.prehledAlba = new Map([...modelky].map(([id, m]) => [id, { popis: m.bezPopisu, vydani: m.bezVydani }]));

    const vaha = m => [...m.chybi].filter(k => !m.netyka.has(k)).length
        + (m.bezPopisu.some(a => !a.netykaSe) ? 1 : 0) + (m.bezVydani.some(a => !a.netykaSe) ? 1 : 0)
        + (m.udaje || []).reduce((soucet, skupina, i) => soucet + (m.netyka.has(KLICE_SKUPIN[i]) ? 0 : skupina.length), 0);
    // Skupina údajů: počet chybějících, v nápovědě jejich výčet; klik otevře formulář na první z nich
    const skupina = (m, i) => {
        if (m.netyka.has(KLICE_SKUPIN[i])) return netyka(KLICE_SKUPIN[i]);
        const chybejici = m.udaje?.[i] || [];
        if (!chybejici.length) return ano;
        const vse = chybejici.length === SKUPINY_UDAJU[i].udaje.length;
        return `<td class="chybi" data-akce="udaje" data-klic="${KLICE_SKUPIN[i]}" data-zalozka="${SKUPINY_UDAJU[i].zalozka}" data-pole="${chybejici[0][2]}"
            title="Chybí: ${esc(chybejici.map(u => u[1]).join(', '))}">${vse ? 'chybí vše' : `chybí ${chybejici.length} z ${SKUPINY_UDAJU[i].udaje.length}`}</td>`;
    };
    // Bez skrytých jen modelky, kterým něco opravdu chybí
    const radkyModelek = [...modelky.values()].filter(m => stav.prehledSkryte || vaha(m) > 0)
        .sort((a, b) => vaha(b) - vaha(a) || a.jmeno.localeCompare(b.jmeno, 'cs'));
    stav.prehledPoradi = radkyModelek.map(m => m.id);
    stav.prehledRadky = radkyModelek;
    const alba = (seznam, akce) => {
        const aktivni = seznam.filter(a => !a.netykaSe);
        if (aktivni.length) return `<td class="chybi" data-akce="${akce}" data-klic="${akce === 'popis' ? 'text' : 'vydani'}" title="Doplnit: ${esc(aktivni.map(a => nazevAlba(a.album, a.typ)).join(', '))} (pravým tlačítkem: netýká se)">${aktivni.length}</td>`;
        return seznam.length ? netyka(akce === 'popis' ? 'text' : 'vydani') : ano;
    };
    const bunkaModelky = (m, klic) => m.netyka.has(klic) ? netyka(klic) : m.chybi.has(klic) ? chybi(klic, NAPOVEDY[klic]) : ano;

    // Vydání, kterým chybí cover nebo centerfold
    const vydani = new Map();
    p.vydaniBezCoveru.forEach(v => vydani.set(v, { cover: true }));
    p.vydaniBezCenterfoldu.forEach(v => vydani.set(v, { ...vydani.get(v), centerfold: true }));
    const radkyVydani = [...vydani].sort(([a], [b]) => b.localeCompare(a));

    stats.innerHTML = `
        <div class="stat-tiles">
            ${dlazdice(p.modelek, 'modelek')}
            ${dlazdice(p.alb, 'alb')}
            ${dlazdice(p.fotek, 'fotek')}
            ${dlazdice(p.hodnocenychFotek, 'fotek se srdíčky')}
            ${dlazdice(p.coveru, 'coverů')}
            ${dlazdice(p.vydani, 'vydání')}
        </div>

        <section class="stat-section">
            <h3>Modelky <span>${p.modelek - radkyModelek.filter(m => vaha(m) > 0).length} z ${p.modelek} má vše vyplněné</span>
                <button class="link stat-toggle" data-skryte>${stav.prehledSkryte ? 'Skrýt údaje „netýká se“' : 'Zobrazit i údaje „netýká se“'}</button></h3>
            ${radkyModelek.length ? `
            <table class="stat-table">
                <thead><tr>
                    <th>Modelka</th><th>Titulní fotka</th>${SKUPINY_UDAJU.map(s => `<th title="${esc(s.udaje.map(u => u[1]).join(', '))}">${s.nazev}</th>`).join('')}<th>Centerfold</th><th>Hodnocení</th>
                    <th title="Počet alb bez průvodního textu">Alba bez textu</th><th title="Počet alb bez přiřazeného vydání">Alba bez vydání</th>
                </tr></thead>
                <tbody>
                    ${radkyModelek.slice(0, stav.prehledLimit).map(m => `
                        <tr data-modelka="${m.id}" title="Otevřít profil">
                            <th>${esc(m.jmeno)}</th>
                            ${bunkaModelky(m, 'titulni')}
                            ${SKUPINY_UDAJU.map((s, i) => skupina(m, i)).join('')}
                            ${bunkaModelky(m, 'centerfold')}${bunkaModelky(m, 'hodnoceni')}
                            ${alba(m.bezPopisu, 'popis')}${alba(m.bezVydani, 'vydani')}
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(radkyModelek.length)}` : ''}
        </section>

        <section class="stat-section">
            <h3>Vydání <span>${p.vydani - radkyVydani.length} z ${p.vydani} má cover i centerfold</span></h3>
            ${radkyVydani.length ? `
            <table class="stat-table stat-table-narrow">
                <thead><tr><th>Vydání</th><th>Cover</th><th>Centerfold</th></tr></thead>
                <tbody>
                    ${radkyVydani.slice(0, stav.prehledLimit).map(([v, co]) => `
                        <tr data-vydani="${esc(v)}" title="Otevřít vydání">
                            <th>${esc(nazevVydani(v))}</th>${co.cover ? chybi('cover', 'Přidat cover') : ano}${co.centerfold ? chybi('centerfold', 'Přidat centerfold') : ano}
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(radkyVydani.length)}` : ''}
        </section>

        ${p.rocniky.length ? `
        <section class="stat-section">
            <h3>Ročníky <span>které měsíce ve sbírce jsou</span></h3>
            <div class="stat-years">
                ${p.rocniky.map(r => `
                    <button class="stat-year" data-rocnik="${r.rok}" data-edice="${esc(r.edice)}" title="Zobrazit ročník ${r.rok} (${esc(r.edice)}) v kalendáři">
                        <strong>${r.rok}${r.edice !== VYCHOZI_EDICE ? ` <em>${esc(r.edice)}</em>` : ''}</strong><span>${r.vydani} z 12</span>
                        <span class="stat-months">${r.mesice.map((je, i) => `<i class="${je ? 'on' : ''}" title="${MESICE[i]}${je ? '' : ' – chybí'}"></i>`).join('')}</span>
                    </button>`).join('')}
            </div>
        </section>` : ''}

        ${p.podezrele.length ? `
        <section class="stat-section">
            <h3>Ke kontrole <span>údaje, které vypadají jako chyba při zadávání</span></h3>
            <table class="stat-table stat-table-text">
                <thead><tr><th>Modelka</th><th>Co zkontrolovat</th></tr></thead>
                <tbody>
                    ${p.podezrele.slice(0, stav.prehledLimit).map(u => `
                        <tr data-modelka="${u.modelkaId}" title="Otevřít profil">
                            <th>${esc(u.jmeno)}</th><td class="stat-text">${esc(u.popis)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(p.podezrele.length)}
        </section>` : ''}
    `;
}

// „Netýká se" u buňky: modelka (centerfold neměla, údaj nejde zjistit) nebo všechna alba v buňce
export async function oznacitNetykaSe(bunka, netyka) {
    const radek = bunka.closest('tr');
    // U vydání je „netýká se" stav čísla „nezajímá mě"; zrušit ho jde na stránce vydání nebo v kalendáři
    if (radek.dataset.vydani) {
        await SetStavVydani(radek.dataset.vydani, netyka ? 'nezajima' : '');
        if (!stats.classList.contains('hidden')) nacistPrehled();
        return;
    }
    const modelkaId = parseInt(radek.dataset.modelka);
    const klic = bunka.dataset.klic;
    if (klic === 'text' || klic === 'vydani') {
        const alba = stav.prehledAlba.get(modelkaId)?.[klic === 'text' ? 'popis' : 'vydani'] || [];
        for (const a of alba) await SetNetykaSeAlba(a.modelkaId, a.album, a.typ, klic, netyka);
    } else {
        await SetNetykaSe(modelkaId, klic, netyka);
    }
    if (!stats.classList.contains('hidden')) nacistPrehled();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Přepínač skrytých údajů a další stránka tabulek
    stats.addEventListener('click', (e) => {
        if (e.target.closest('[data-skryte]')) {
            stav.prehledSkryte = !stav.prehledSkryte;
            nacistPrehled();
        } else if (e.target.closest('[data-vice]')) {
            stav.prehledLimit += 60;
            nacistPrehled();
        }
    });

    // Klik na ročník ho ukáže v kalendáři
    stats.addEventListener('click', (e) => {
        const dlazdice = e.target.closest('[data-rocnik]');
        if (!dlazdice) return;
        nastavitEdiciKalendare(dlazdice.dataset.edice);
        prepnoutRezim('kalendar');
        searchInput.value = dlazdice.dataset.rocnik;
        nacistGalerii(dlazdice.dataset.rocnik);
    });

    // Klik na buňku „chybí" otevře rovnou místo, kde se údaj doplňuje; klik jinam do řádku otevírá profil nebo vydání
    stats.addEventListener('click', async (e) => {
        const bunka = e.target.closest('td[data-akce]');
        if (!bunka) return;
        e.stopPropagation();
        const radek = bunka.closest('tr');
        const akce = bunka.dataset.akce;

        if (radek.dataset.vydani) {
            // Vydání je dané, u centerfoldu se vybírá jen modelka
            if (akce === 'cover') otevritCoverModal(null, radek.dataset.vydani);
            else pridatCenterfold(radek.dataset.vydani);
            return;
        }

        const modelka = stav.prehledModelky.get(parseInt(radek.dataset.modelka));
        if (!modelka) return;
        // Fronta pro „Uložit a další": modelky z tabulky, kterým chybí právě tento údaj, zafixované při otevření
        const frontaPro = klic => stav.prehledRadky.filter(r => !r.netyka.has(klic)
            && (klic === 'titulni' ? r.chybi.has('titulni') : (r.udaje?.[KLICE_SKUPIN.indexOf(klic)] || []).length > 0)).map(r => r.id);
        if (akce === 'titulni') {
            otevritModelModal(modelka, { zalozka: 0, klic: 'titulni', ids: frontaPro('titulni') });
            document.getElementById('inputDriveID').focus();
        } else if (akce === 'udaje') {
            // Formulář se otevře na záložce skupiny, s kurzorem v prvním chybějícím poli
            otevritModelModal(modelka, { zalozka: parseInt(bunka.dataset.zalozka), klic: bunka.dataset.klic, ids: frontaPro(bunka.dataset.klic) });
            ukazatZalozku(parseInt(bunka.dataset.zalozka));
            document.getElementById(bunka.dataset.pole).focus();
        } else if (akce === 'centerfold') {
            otevritAlbumModal(modelka, null, { typ: 'Centerfold' });
            document.getElementById('selectAlbumMesic').focus();
        } else if (akce === 'hodnoceni') {
            otevritDetailModelky(modelka);
        } else {
            // První album, kterému text nebo vydání chybí, se otevře k úpravě v profilu modelky
            const cil = stav.prehledAlba.get(modelka.id)?.[akce][0];
            await otevritDetailModelky(modelka);
            await nacistFotkyModelky(modelka.id);
            const album = cil && stav.aktualniAlba.find(a => a.album === cil.album && a.typ === cil.typ);
            if (!album) return;
            otevritAlbumModal(modelka, album);
            document.getElementById(akce === 'popis' ? 'inputAlbumPopis' : 'selectAlbumMesic').focus();
        }
    });
}
