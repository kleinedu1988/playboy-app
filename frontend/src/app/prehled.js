// Přehled sbírky: co chybí doplnit a akce v buňkách tabulek
import { GetKalendar, GetPrehled, GetStavyVydani, SetNetykaSe, SetNetykaSeAlba, SetStavVydani } from './backend';
import { esc, nazevAlba, nazevVydani, udajChybi } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { searchInput, stats } from './prvky';
import { ukazatPohled } from './navigace';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { oznacitCislo, pridatKVydani } from './kalendar';
import { otevritCoverModal } from './cover';
import { otevritModelModal, ukazatZalozku } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold } from './formular-alba';
import { BEZ_FOTKY, adresaTitulni } from './obrazky';
import { otevritDoplneni } from './doplneni';
import { nacistStatistiky } from './statistiky';
import { htmlShanim, htmlUvodu, shanenaCisla, textShanim } from './prehled-uvod';
import { otevritVydani } from './vydani';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { oznamit } from '../ui/oznameni';

// Části údržby (co doplnit a opravit) jsou v menu jedna položka „Údržba“ s vlastními záložkami nahoře
const UDRZBA = new Set(['souhrn', 'modelky', 'vydani', 'kontrola']);
const polozkaMenu = sekce => UDRZBA.has(sekce) ? 'udrzba' : sekce;

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

// Ikony menu v levém panelu Přehledu
const IKONA = obsah => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${obsah}</svg>`;
const IKONY_CASTI = {
    uvod: IKONA('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    udrzba: IKONA('<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.4-.4-2.6z"/>'),
    shanim: IKONA('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>'),
    statistiky: IKONA('<path d="M5 20V11M12 20V5M19 20v-7"/>'),
};

export async function nacistPrehled() {
    const moje = ++stav.cisloNacteni;
    const [p, seznamModelek, kalendar, stavy] = await Promise.all([GetPrehled(stav.prehledSkryte), vsechnyModelky(),
        GetKalendar().then(k => k || []), GetStavyVydani().then(s => s || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.prehledModelky = new Map(seznamModelek.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const ano = '<td class="ok" title="V pořádku">&#10003;</td>';
    // Buňka s chybějícím údajem je zároveň tlačítko, které ho nabídne doplnit
    const chybi = (akce, napoveda, klic = akce) => `<td class="chybi" data-akce="${akce}" data-klic="${klic}" title="${napoveda} (pravým tlačítkem: netýká se)">chybí</td>`;
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
    // Údaj na kartě modelky: název a co chybí; klik ho nabídne doplnit, pravým tlačítkem „netýká se“
    const udaj = (nazev, hodnota, atributy, napoveda) => `<button class="prehled-udaj" ${atributy} title="${esc(napoveda)} (pravým tlačítkem: netýká se)">${nazev} <b>${hodnota}</b></button>`;
    const udajNetyka = (nazev, klic) => `<span class="prehled-udaj netyka" data-klic="${klic}" data-netyka="1" title="Netýká se – pravým tlačítkem jde znovu sledovat">${nazev} <b>—</b></span>`;
    // Skupina údajů: počet chybějících, v nápovědě jejich výčet; klik otevře formulář na první z nich
    const skupina = (m, i) => {
        const s = SKUPINY_UDAJU[i];
        if (m.netyka.has(KLICE_SKUPIN[i])) return stav.prehledSkryte ? udajNetyka(s.nazev, KLICE_SKUPIN[i]) : '';
        const chybejici = m.udaje?.[i] || [];
        if (!chybejici.length) return '';
        return udaj(s.nazev, chybejici.length === s.udaje.length ? 'vše' : `${chybejici.length} z ${s.udaje.length}`,
            `data-akce="udaje" data-klic="${KLICE_SKUPIN[i]}" data-zalozka="${s.zalozka}" data-pole="${chybejici[0][2]}"`,
            `Chybí: ${chybejici.map(u => u[1]).join(', ')}`);
    };
    const alba = (m, seznam, akce) => {
        const nazev = akce === 'popis' ? 'Alba bez textu' : 'Alba bez vydání';
        const klic = akce === 'popis' ? 'text' : 'vydani';
        const aktivni = seznam.filter(a => !a.netykaSe);
        if (aktivni.length) return udaj(nazev, aktivni.length, `data-akce="${akce}" data-klic="${klic}"`, `Doplnit: ${aktivni.map(a => nazevAlba(a.album, a.typ)).join(', ')}`);
        return seznam.length && stav.prehledSkryte ? udajNetyka(nazev, klic) : '';
    };
    const NAZVY = { titulni: 'Titulní fotka', centerfold: 'Centerfold', hodnoceni: 'Hodnocení' };
    const jednoduchy = (m, klic) => m.netyka.has(klic) ? (stav.prehledSkryte ? udajNetyka(NAZVY[klic], klic) : '')
        : m.chybi.has(klic) ? udaj(NAZVY[klic], '✕', `data-akce="${klic}" data-klic="${klic}"`, NAPOVEDY[klic]) : '';
    // Vyplněnost modelky: podíl sledovaných údajů, které nechybí (bez údajů „netýká se“)
    const vyplneno = m => {
        const celkem = ['titulni', 'centerfold', 'hodnoceni', 'text', 'vydani'].filter(k => !m.netyka.has(k)).length
            + SKUPINY_UDAJU.reduce((soucet, s, i) => soucet + (m.netyka.has(KLICE_SKUPIN[i]) ? 0 : s.udaje.length), 0);
        return celkem ? Math.max(0, Math.round((1 - vaha(m) / celkem) * 100)) : 100;
    };
    const kartaModelky = m => {
        const modelka = stav.prehledModelky.get(m.id);
        const procent = vyplneno(m);
        return `
            <div class="prehled-modelka" data-modelka="${m.id}" title="Doplnit, co chybí">
                <img src="${esc(modelka ? adresaTitulni(modelka) : BEZ_FOTKY)}" alt="" loading="lazy" draggable="false" />
                <div class="prehled-modelka-telo">
                    <h4>${esc(m.jmeno)}</h4>
                    <div class="prehled-modelka-pruh"><div><i style="width:${procent}%"></i></div>${procent} %</div>
                    <div class="prehled-udaje">
                        ${jednoduchy(m, 'titulni')}${SKUPINY_UDAJU.map((_, i) => skupina(m, i)).join('')}
                        ${jednoduchy(m, 'centerfold')}${jednoduchy(m, 'hodnoceni')}
                        ${alba(m, m.bezPopisu, 'popis')}${alba(m, m.bezVydani, 'vydani')}
                    </div>
                </div>
            </div>`;
    };
    // Bez skrytých jen modelky, kterým něco opravdu chybí
    const radkyModelek = [...modelky.values()].filter(m => stav.prehledSkryte || vaha(m) > 0)
        .sort((a, b) => vaha(b) - vaha(a) || a.jmeno.localeCompare(b.jmeno, 'cs'));
    radkyModelek.forEach(m => { m.vaha = vaha(m); m.vyplneno = vyplneno(m); });
    stav.prehledPoradi = radkyModelek.map(m => m.id);
    stav.prehledRadky = radkyModelek;

    // Vydání, kterým chybí cover nebo centerfold
    const vydani = new Map();
    p.vydaniBezCoveru.forEach(v => vydani.set(v, { cover: true }));
    p.vydaniBezCenterfoldu.forEach(v => vydani.set(v, { ...vydani.get(v), centerfold: true }));
    const radkyVydani = [...vydani].sort(([a], [b]) => b.localeCompare(a));

    // Levý panel: čísla sbírky, menu částí a vyplněnost; vpravo vždy jedna část (Souhrn, Modelky, Vydání…)
    const modelekSChybou = radkyModelek.filter(m => vaha(m) > 0).length;
    const aktivnich = seznam => seznam.filter(x => !x.netykaSe).length;
    const kUdrzbe = [
        ['Modelky bez titulní fotky', aktivnich(p.bezTitulni), 'modelky'],
        ['Modelky bez centerfoldu', aktivnich(p.bezCenterfoldu), 'modelky'],
        ['Modelky bez hodnocení', aktivnich(p.bezHodnoceni), 'modelky'],
        ['Alba bez textu', aktivnich(p.albaBezPopisu), 'modelky'],
        ['Alba bez vydání', aktivnich(p.albaBezVydani), 'modelky'],
        ['Čísla bez coveru', p.vydaniBezCoveru.length, 'vydani'],
        ['Čísla bez centerfoldu', p.vydaniBezCenterfoldu.length, 'vydani'],
        ['Údaje ke kontrole', p.podezrele.length, 'kontrola'],
    ].filter(([, pocet]) => pocet).map(([popis, pocet, sekce]) => ({ popis, pocet, sekce })).sort((a, b) => b.pocet - a.pocet);
    const shanim = shanenaCisla(stavy).length;
    const casti = [
        ['uvod', 'Přehled', ''],
        ['udrzba', 'Údržba', modelekSChybou + radkyVydani.length + p.podezrele.length],
        ['shanim', 'Sháním CZ', shanim, true],
        ['statistiky', 'Statistiky', ''],
    ];
    const zname = ['uvod', 'shanim', 'statistiky', 'souhrn', 'modelky', 'vydani', ...(p.podezrele.length ? ['kontrola'] : [])];
    if (!zname.includes(stav.prehledSekce)) stav.prehledSekce = 'uvod';
    // Záložky údržby nad každou její částí
    const zalozkyUdrzby = `<nav class="udrzba-zalozky">${[
        ['souhrn', 'Souhrn', ''], ['modelky', 'Modelky', modelekSChybou], ['vydani', 'Čísla', radkyVydani.length],
        ...(p.podezrele.length ? [['kontrola', 'Ke kontrole', p.podezrele.length]] : []),
    ].map(([klic, nazev, pocet]) => `<button type="button" class="${klic === stav.prehledSekce ? 'active' : ''}" data-sekce-prehledu="${klic}">${nazev}${pocet ? ` <span>${pocet}</span>` : ''}</button>`).join('')}</nav>`;
    // Souhrn: pokrok sbírky po položkách (pruh, kolik z kolika) a kolik zbývá doplnit; klik otevře část, kde se doplňuje
    const radekSouhrnu = (popis, chybi, celkem, sekce, akce = 'doplnit') => {
        const hotovo = Math.max(0, celkem - chybi);
        const procent = celkem ? Math.round(hotovo / celkem * 100) : 100;
        return `<button class="prehled-souhrn-radek ${chybi ? '' : 'hotovo'}" data-sekce-prehledu="${sekce}">
            <span>${popis}</span>
            ${celkem ? `<div class="prehled-souhrn-pruh"><i style="width:${procent}%"></i></div><small>${hotovo} z ${celkem}</small>` : '<div></div><small></small>'}
            <b>${chybi ? `${akce} ${chybi}` : 'hotovo'}</b></button>`;
    };

    stats.innerHTML = `
        <aside class="profile-side prehled-panel">
            <h2>Sbírka</h2>
            <nav class="prehled-menu">
                ${casti.map(([klic, nazev, pocet, neutralni]) => `<button class="${klic === polozkaMenu(stav.prehledSekce) ? 'active' : ''}" data-sekce-prehledu="${klic}">
                    ${IKONY_CASTI[klic]}${nazev}${pocet !== '' ? `<b class="${pocet && !neutralni ? 'chybi' : ''}">${pocet}</b>` : ''}</button>`).join('')}
            </nav>
        </aside>
        <div class="prehled-obsah" data-sekce-ukazana="${stav.prehledSekce}">
            <section class="stat-section" data-sekce="uvod">${htmlUvodu({ p, kalendar, stavy, modelky: seznamModelek, ukoly: kUdrzbe, kUdrzbe: modelekSChybou + radkyVydani.length + p.podezrele.length, modelekUplnych: p.modelek - modelekSChybou })}</section>
            <section class="stat-section" data-sekce="shanim">${htmlShanim(stavy)}</section>
            <section class="stat-section" data-sekce="souhrn">
                ${zalozkyUdrzby}
                <h3>Co zbývá doplnit</h3>
                <div class="prehled-souhrn">
                    ${radekSouhrnu('Modelky s titulní fotkou', aktivnich(p.bezTitulni), p.modelek, 'modelky')}
                    ${radekSouhrnu('Modelky s centerfoldem', aktivnich(p.bezCenterfoldu), p.modelek, 'modelky')}
                    ${radekSouhrnu('Modelky s hodnocením', aktivnich(p.bezHodnoceni), p.modelek, 'modelky')}
                    ${radekSouhrnu('Alba s textem', aktivnich(p.albaBezPopisu), p.alb, 'modelky')}
                    ${radekSouhrnu('Alba s vydáním', aktivnich(p.albaBezVydani), p.alb, 'modelky')}
                    ${radekSouhrnu('Vydání s coverem', p.vydaniBezCoveru.length, p.vydani, 'vydani')}
                    ${radekSouhrnu('Vydání s centerfoldem', p.vydaniBezCenterfoldu.length, p.vydani, 'vydani')}
                    ${p.podezrele.length ? radekSouhrnu('Údaje ke kontrole', p.podezrele.length, 0, 'kontrola', 'zkontrolovat') : ''}
                </div>
            </section>

        <section class="stat-section" data-sekce="modelky">
            ${zalozkyUdrzby}
            <h3>Modelky <span>${p.modelek - radkyModelek.filter(m => vaha(m) > 0).length} z ${p.modelek} má vše vyplněné</span>
                <button class="link stat-toggle" data-skryte>${stav.prehledSkryte ? 'Skrýt údaje „netýká se“' : 'Zobrazit i údaje „netýká se“'}</button></h3>
            ${radkyModelek.length ? `
            <div class="prehled-modelky">${radkyModelek.slice(0, stav.prehledLimit).map(kartaModelky).join('')}</div>${zbytek(radkyModelek.length)}` : ''}
        </section>

        <section class="stat-section" data-sekce="vydani">
            ${zalozkyUdrzby}
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

        ${p.podezrele.length ? `
        <section class="stat-section" data-sekce="kontrola">
            ${zalozkyUdrzby}
            <h3>Ke kontrole <span>údaje, které vypadají jako chyba při zadávání</span></h3>
            <div class="prehled-kontrola">
                ${p.podezrele.slice(0, stav.prehledLimit).map(u => {
                    const modelka = stav.prehledModelky.get(u.modelkaId);
                    return `<div class="prehled-kontrola-radek" data-modelka="${u.modelkaId}" title="Otevřít profil">
                        <img src="${esc(modelka ? adresaTitulni(modelka) : BEZ_FOTKY)}" alt="" loading="lazy" draggable="false" />
                        <strong>${esc(u.jmeno)}</strong><span>${esc(u.popis)}</span>
                        <button type="button" class="btn btn-secondary btn-small" data-opravit="${esc(u.popis)}">Opravit</button>
                    </div>`;
                }).join('')}
            </div>${zbytek(p.podezrele.length)}
        </section>` : ''}

        <!-- Statistiky se počítají až při prvním zobrazení oddílu -->
        <section class="stat-section stat-statistiky" data-sekce="statistiky"><p class="stat-prazdne">Počítám statistiky…</p></section>
        </div>
    `;
    if (stav.prehledSekce === 'statistiky') nacistStatistiky(stats.querySelector('[data-sekce="statistiky"]'));
}

// „Netýká se" u buňky: modelka (centerfold neměla, údaj nejde zjistit) nebo všechna alba v buňce
export async function oznacitNetykaSe(bunka, netyka) {
    const radek = bunka.closest('[data-modelka], [data-vydani]');
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
    try { stav.prehledSekce = localStorage.getItem('prehledSekce') || 'uvod'; } catch { /* úvod */ }
    // Části v levém panelu, přepínač skrytých údajů a další stránka tabulek
    stats.addEventListener('click', (e) => {
        const cast = e.target.closest('[data-sekce-prehledu]');
        const karta = e.target.closest('.prehled-modelka');
        const opravit = e.target.closest('[data-opravit]');
        if (opravit) {
            // Album s jednou fotkou se opravuje v profilu, ostatní (jméno, datum) ve formuláři modelky
            e.stopPropagation();
            const modelka = stav.prehledModelky.get(parseInt(opravit.closest('[data-modelka]').dataset.modelka));
            if (!modelka) return;
            if (opravit.dataset.opravit.startsWith('album')) otevritDetailModelky(modelka);
            else otevritModelModal(modelka);
        } else if (karta && !e.target.closest('[data-akce]')) {
            // Klik na kartu modelky (mimo konkrétní údaj) otevře okno se vším, co jí chybí
            e.stopPropagation();
            otevritDoplneni(parseInt(karta.dataset.modelka));
        } else if (cast) {
            // Přepnutí části jen v zobrazené stránce, bez nového načtení; Údržba otevře svůj souhrn
            stav.prehledSekce = cast.dataset.sekcePrehledu === 'udrzba' ? 'souhrn' : cast.dataset.sekcePrehledu;
            try { localStorage.setItem('prehledSekce', stav.prehledSekce); } catch { /* jen se nezapamatuje */ }
            stats.querySelector('.prehled-obsah').dataset.sekceUkazana = stav.prehledSekce;
            stats.querySelectorAll('.prehled-menu [data-sekce-prehledu]').forEach(b => b.classList.toggle('active', b.dataset.sekcePrehledu === polozkaMenu(stav.prehledSekce)));
            stats.querySelectorAll('.udrzba-zalozky [data-sekce-prehledu]').forEach(b => b.classList.toggle('active', b.dataset.sekcePrehledu === stav.prehledSekce));
            if (stav.prehledSekce === 'statistiky') nacistStatistiky(stats.querySelector('[data-sekce="statistiky"]'));
            document.querySelector('main').scrollTop = 0;
        } else if (e.target.closest('[data-skryte]')) {
            stav.prehledSkryte = !stav.prehledSkryte;
            nacistPrehled();
        } else if (e.target.closest('[data-vice]')) {
            stav.prehledLimit += 60;
            nacistPrehled();
        }
    });

    // Mapa sbírky: číslo s daty se otevře, prázdné nabídne přidání; pravé tlačítko nabídne i stav čísla.
    // Naposledy přidaná modelka otevře profil, číslo v seznamu Sháním nabídne „mám výtisk“.
    const nabidkaCisla = (klic, x, y, sOtevrenim) => otevritKontextovouNabidku(x, y, [
        ...(sOtevrenim ? [{ text: `Otevřít ${nazevVydani(klic)}`, akce: () => otevritVydani(klic) }, null] : []),
        ...pridatKVydani(klic), null,
        ...oznacitCislo(klic).map(polozka => ({ ...polozka, akce: async () => { await polozka.akce(); nacistPrehled(); } })),
    ]);
    stats.addEventListener('click', (e) => {
        const cislo = e.target.closest('[data-cislo]');
        const modelka = e.target.closest('[data-otevrit-modelku]');
        const shanene = e.target.closest('[data-shanim]');
        if (cislo) {
            if (cislo.hasAttribute('data-ma-data')) otevritVydani(cislo.dataset.cislo);
            else nabidkaCisla(cislo.dataset.cislo, e.clientX, e.clientY, false);
        } else if (modelka) {
            const m = stav.prehledModelky.get(parseInt(modelka.dataset.otevritModelku));
            if (m) otevritDetailModelky(m);
        } else if (shanene) {
            const klic = shanene.dataset.shanim;
            const r = shanene.getBoundingClientRect();
            otevritKontextovouNabidku(r.left, r.bottom + 4, [
                { text: 'Mám výtisk', akce: async () => { await SetStavVydani(klic, 'mam'); nacistPrehled(); } },
                { text: 'Už nesháním', akce: async () => { await SetStavVydani(klic, ''); nacistPrehled(); } },
                null,
                { text: `Otevřít ${nazevVydani(klic)}`, akce: () => otevritVydani(klic) },
            ]);
        } else if (e.target.closest('[data-kopirovat-shanim]')) {
            GetStavyVydani().then(stavy => navigator.clipboard.writeText(textShanim(stavy || [])))
                .then(() => oznamit('Seznam shánených čísel je ve schránce.'), () => oznamit('Seznam se nepodařilo zkopírovat.'));
        }
    });
    stats.addEventListener('contextmenu', (e) => {
        const cislo = e.target.closest('[data-cislo]');
        if (!cislo) return;
        e.preventDefault();
        e.stopPropagation();
        nabidkaCisla(cislo.dataset.cislo, e.clientX, e.clientY, cislo.hasAttribute('data-ma-data'));
    }, true);

    // Klik na buňku „chybí" otevře rovnou místo, kde se údaj doplňuje; klik jinam do řádku otevírá profil nebo vydání
    stats.addEventListener('click', async (e) => {
        const bunka = e.target.closest('[data-akce]');
        if (!bunka) return;
        e.stopPropagation();
        const radek = bunka.closest('[data-modelka], [data-vydani]');
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
