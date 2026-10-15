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
import { BEZ_FOTKY, adresaTitulni } from './obrazky';
import { otevritDoplneni } from './doplneni';

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
    souhrn: IKONA('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    modelky: IKONA('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
    vydani: IKONA('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8"/>'),
    rocniky: IKONA('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    kontrola: IKONA('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'),
};

export async function nacistPrehled() {
    const moje = ++stav.cisloNacteni;
    const [p, seznamModelek] = await Promise.all([GetPrehled(stav.prehledSkryte), vsechnyModelky()]);
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
    const casti = [
        ['souhrn', 'Souhrn', ''],
        ['modelky', 'Modelky', modelekSChybou],
        ['vydani', 'Vydání', radkyVydani.length],
        ...(p.rocniky.length ? [['rocniky', 'Ročníky', p.rocniky.length, true]] : []),
        ...(p.podezrele.length ? [['kontrola', 'Ke kontrole', p.podezrele.length]] : []),
    ];
    if (!casti.some(([klic]) => klic === stav.prehledSekce)) stav.prehledSekce = 'souhrn';
    const pruh = (popis, hotovo, celkem) => {
        const procent = celkem ? Math.round(hotovo / celkem * 100) : 100;
        return `<div class="prehled-pruh"><span>${popis}</span><b>${hotovo} z ${celkem}</b><div><i style="width:${procent}%"></i></div></div>`;
    };
    // Souhrn: co zbývá doplnit; klik na kartu otevře část, kde se to doplňuje
    const karta = (pocet, popis, sekce) => `<button class="prehled-karta ${pocet ? 'chybi' : ''}" data-sekce-prehledu="${sekce}">
        <strong>${pocet || '✓'}</strong><span>${popis}</span></button>`;

    stats.innerHTML = `
        <aside class="profile-side prehled-panel">
            <h2>Sbírka</h2>
            <div class="prehled-cisla">
                ${[[p.modelek, 'modelek'], [p.alb, 'alb'], [p.fotek, 'fotek'], [p.hodnocenychFotek, 'se srdíčky'], [p.coveru, 'coverů'], [p.vydani, 'vydání']]
                    .map(([cislo, popis]) => `<div><strong>${cislo}</strong><span>${popis}</span></div>`).join('')}
            </div>
            <nav class="prehled-menu">
                ${casti.map(([klic, nazev, pocet, neutralni]) => `<button class="${klic === stav.prehledSekce ? 'active' : ''}" data-sekce-prehledu="${klic}">
                    ${IKONY_CASTI[klic]}${nazev}${pocet !== '' ? `<b class="${pocet && !neutralni ? 'chybi' : ''}">${pocet}</b>` : ''}</button>`).join('')}
            </nav>
            ${pruh('Modelky s úplnými údaji', p.modelek - modelekSChybou, p.modelek)}
            ${pruh('Vydání s coverem i centerfoldem', p.vydani - radkyVydani.length, p.vydani)}
        </aside>
        <div class="prehled-obsah" data-sekce-ukazana="${stav.prehledSekce}">
            <section class="stat-section" data-sekce="souhrn">
                <h3>Co zbývá doplnit</h3>
                <div class="prehled-karty">
                    ${karta(aktivnich(p.bezTitulni), 'modelek bez titulní fotky', 'modelky')}
                    ${karta(aktivnich(p.bezCenterfoldu), 'modelek bez centerfoldu', 'modelky')}
                    ${karta(aktivnich(p.bezHodnoceni), 'modelek bez hodnocení', 'modelky')}
                    ${karta(aktivnich(p.albaBezPopisu), 'alb bez textu', 'modelky')}
                    ${karta(aktivnich(p.albaBezVydani), 'alb bez vydání', 'modelky')}
                    ${karta(p.vydaniBezCoveru.length, 'vydání bez coveru', 'vydani')}
                    ${karta(p.vydaniBezCenterfoldu.length, 'vydání bez centerfoldu', 'vydani')}
                    ${p.podezrele.length ? karta(p.podezrele.length, 'údajů ke kontrole', 'kontrola') : ''}
                </div>
            </section>

        <section class="stat-section" data-sekce="modelky">
            <h3>Modelky <span>${p.modelek - radkyModelek.filter(m => vaha(m) > 0).length} z ${p.modelek} má vše vyplněné</span>
                <button class="link stat-toggle" data-skryte>${stav.prehledSkryte ? 'Skrýt údaje „netýká se“' : 'Zobrazit i údaje „netýká se“'}</button></h3>
            ${radkyModelek.length ? `
            <div class="prehled-modelky">${radkyModelek.slice(0, stav.prehledLimit).map(kartaModelky).join('')}</div>${zbytek(radkyModelek.length)}` : ''}
        </section>

        <section class="stat-section" data-sekce="vydani">
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
        <section class="stat-section" data-sekce="rocniky">
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
        <section class="stat-section" data-sekce="kontrola">
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
        </div>
    `;
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
    try { stav.prehledSekce = localStorage.getItem('prehledSekce') || 'souhrn'; } catch { /* souhrn */ }
    // Části v levém panelu, přepínač skrytých údajů a další stránka tabulek
    stats.addEventListener('click', (e) => {
        const cast = e.target.closest('[data-sekce-prehledu]');
        const karta = e.target.closest('.prehled-modelka');
        if (karta && !e.target.closest('[data-akce]')) {
            // Klik na kartu modelky (mimo konkrétní údaj) otevře okno se vším, co jí chybí
            e.stopPropagation();
            otevritDoplneni(parseInt(karta.dataset.modelka));
        } else if (cast) {
            // Přepnutí části jen v zobrazené stránce, bez nového načtení
            stav.prehledSekce = cast.dataset.sekcePrehledu;
            try { localStorage.setItem('prehledSekce', stav.prehledSekce); } catch { /* jen se nezapamatuje */ }
            stats.querySelector('.prehled-obsah').dataset.sekceUkazana = stav.prehledSekce;
            stats.querySelectorAll('.prehled-menu [data-sekce-prehledu]').forEach(b => b.classList.toggle('active', b === cast || b.dataset.sekcePrehledu === stav.prehledSekce));
            document.querySelector('main').scrollTop = 0;
        } else if (e.target.closest('[data-skryte]')) {
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
