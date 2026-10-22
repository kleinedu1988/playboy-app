// Přehled sbírky: co chybí doplnit a akce v buňkách tabulek
import { GetKalendar, GetPrehled, GetStatistiky, GetStavyVydani, SetNetykaSe, SetNetykaSeAlba, SetStavVydani } from './backend';
import { VYCHOZI_EDICE, esc, kategorieModelky, nazevAlba, nazevVydani, popisKategorie, rozlozitVydani, udajChybi } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { searchInput, stats } from './prvky';
import { ukazatPohled } from './navigace';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { nabidkaCisla } from './kalendar';
import { otevritCoverModal } from './cover';
import { otevritModelModal, ukazatZalozku, zameritPole } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold } from './formular-alba';
import { BEZ_FOTKY, adresaTitulni } from './obrazky';
import { otevritDoplneni } from './doplneni';
import { nacistStatistiky } from './statistiky';
import { htmlGrafuDekad, htmlShanim, htmlUvodu, shanenaCisla, textShanim } from './prehled-uvod';
import { otevritVydani } from './vydani';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { oznamit } from '../ui/oznameni';
import { prevestNaVolby } from '../ui/volby';

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
        ['role', 'kategorie', 'inputRole'],
        ['tags', 'tagy', 'inputTags'],
    ] },
];
// Klíč „netýká se" podle záložky formuláře
export const KLICE_SKUPIN = ['zakladni', 'vzhled', 'zarazeni'];

const aktivnich = seznam => seznam.filter(x => !x.netykaSe).length;
// Nález kontroly: oprava v poli formuláře (pole), jinak v profilu; „V pořádku“ se ukládá u modelky, u nálezu alba u alba
const atributyNalezu = u => `data-opravit="${esc(u.pole)}" data-klic="${esc(u.klic)}" data-album="${esc(u.album)}" data-typ="${esc(u.typ)}"`;
const ZALOZKY_POLI = { inputDalsiJmena: 0, inputUmrtiDatum: 0 };
const zalozkaPole = pole => SKUPINY_UDAJU.find(s => s.udaje.some(u => u[2] === pole))?.zalozka ?? ZALOZKY_POLI[pole] ?? 0;

// Ikony částí Přehledu (u volby v horní liště)
const IKONA = obsah => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${obsah}</svg>`;
const IKONA_CASTI = obsah => IKONA(obsah).replace('width="16" height="16"', 'width="14" height="14"');
const IKONY_CASTI = {
    uvod: IKONA_CASTI('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
    udrzba: IKONA_CASTI('<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.4-.4-2.6z"/>'),
    shanim: IKONA_CASTI('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>'),
    statistiky: IKONA_CASTI('<path d="M5 20V11M12 20V5M19 20v-7"/>'),
};

// Filtry fronty v Údržbě: [klíč, název]; filtr bez úkolů se neukazuje
const FILTRY_UDRZBY = [
    ['vse', 'Vše'], ['titulni', 'Titulní fotka'], ['centerfold', 'Centerfold'], ['hodnoceni', 'Hodnocení'], ['udaje', 'Údaje'],
    ['text', 'Texty alb'], ['alba', 'Vydání alb'], ['cover', 'Cover čísel'], ['cfcisla', 'Centerfold čísel'], ['kontrola', 'Kontrola'],
];
// Co se doplňuje postupně („Uložit a další“), do textu tlačítka
const NAZVY_FRONT = { titulni: 'titulní fotky', zakladni: 'základní údaje', vzhled: 'vzhled a míry', zarazeni: 'zařazení' };
const NAZVY_UKOLU = { titulni: 'titulní fotka', centerfold: 'centerfold', hodnoceni: 'hodnocení' };
const NAPOVEDY = { titulni: 'Doplnit titulní fotku', centerfold: 'Přidat centerfold', hodnoceni: 'Otevřít profil a ohodnotit' };
const pocetAlb = n => `${n} ${n === 1 ? 'album' : n < 5 ? 'alba' : 'alb'}`;
let prekreslitUdrzbu = () => {};

// Úkoly modelky ve frontě údržby (štítky na řádku); „netýká se“ jen se zobrazenými skrytými
function ukolyModelky(m) {
    const ukoly = [];
    const pridat = (filtr, klic, text, atributy, napoveda, akce = klic) => {
        if (m.netyka.has(klic)) { if (stav.prehledSkryte) ukoly.push({ filtr, klic, text, netyka: true }); }
        else ukoly.push({ filtr, klic, akce, text, atributy, napoveda });
    };
    if (m.chybi.has('titulni')) pridat('titulni', 'titulni', NAZVY_UKOLU.titulni, 'data-akce="titulni" data-klic="titulni"', NAPOVEDY.titulni);
    if (m.chybi.has('centerfold')) pridat('centerfold', 'centerfold', NAZVY_UKOLU.centerfold, 'data-akce="centerfold" data-klic="centerfold"', NAPOVEDY.centerfold);
    SKUPINY_UDAJU.forEach((s, i) => {
        const chybejici = m.udaje?.[i] || [];
        const klic = KLICE_SKUPIN[i];
        if (!chybejici.length && !m.netyka.has(klic)) return;
        if (!chybejici.length && m.netyka.has(klic)) { if (stav.prehledSkryte) ukoly.push({ filtr: 'udaje', klic, text: s.nazev.toLowerCase(), netyka: true }); return; }
        const text = chybejici.length === s.udaje.length ? `${s.nazev.toLowerCase()} – vše`
            : chybejici.length <= 3 ? chybejici.map(u => u[1]).join(', ') : `${s.nazev.toLowerCase()} (${chybejici.length} z ${s.udaje.length})`;
        pridat('udaje', klic, text, `data-akce="udaje" data-klic="${klic}" data-zalozka="${s.zalozka}" data-pole="${chybejici[0][2]}"`,
            `Chybí: ${chybejici.map(u => u[1]).join(', ')}`, 'udaje');
    });
    if (m.chybi.has('hodnoceni')) pridat('hodnoceni', 'hodnoceni', NAZVY_UKOLU.hodnoceni, 'data-akce="hodnoceni" data-klic="hodnoceni"', NAPOVEDY.hodnoceni);
    // Alba: ukazuje se počet těch, která text nebo vydání opravdu potřebují
    [['text', 'popis', m.bezPopisu, 'bez textu'], ['alba', 'vydani', m.bezVydani, 'bez vydání']].forEach(([filtr, akce, seznam, popis]) => {
        const klic = akce === 'popis' ? 'text' : 'vydani';
        const aktivni = seznam.filter(a => !a.netykaSe);
        if (aktivni.length) ukoly.push({ filtr, klic, akce, text: `${pocetAlb(aktivni.length)} ${popis}`, atributy: `data-akce="${akce}" data-klic="${klic}"`,
            napoveda: `Doplnit: ${aktivni.map(a => nazevAlba(a.album, a.typ)).join(', ')}` });
        else if (seznam.length && stav.prehledSkryte) ukoly.push({ filtr, klic, text: `${pocetAlb(seznam.length)} ${popis}`, netyka: true });
    });
    return ukoly;
}

// Pod jménem v řádku: kategorie a první číslo modelky
function podtitulek(modelka) {
    if (!modelka) return '';
    const prvni = [...(modelka.vydani || [])].sort()[0];
    return [kategorieModelky(modelka).map(popisKategorie).join(', '), prvni && nazevVydani(prvni)].filter(Boolean).join(' · ');
}

// Fronta pro „Uložit a další": modelky z údržby, kterým chybí právě tento údaj, zafixované při otevření
const frontaPro = klic => stav.prehledRadky.filter(r => !r.netyka.has(klic)
    && (klic === 'titulni' ? r.chybi.has('titulni') : (r.udaje?.[KLICE_SKUPIN.indexOf(klic)] || []).length > 0)).map(r => r.id);

export async function nacistPrehled() {
    const moje = ++stav.cisloNacteni;
    const [p, seznamModelek, kalendar, stavy] = await Promise.all([GetPrehled(stav.prehledSkryte), vsechnyModelky(),
        GetKalendar().then(k => k || []), GetStavyVydani().then(s => s || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.prehledModelky = new Map(seznamModelek.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const netykaModelky = id => new Set((stav.prehledModelky.get(id)?.netykaSe || '').split(',').filter(Boolean));

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
    // Vyplněnost modelky: podíl sledovaných údajů, které nechybí (bez údajů „netýká se“)
    const vyplneno = m => {
        const celkem = ['titulni', 'centerfold', 'hodnoceni', 'text', 'vydani'].filter(k => !m.netyka.has(k)).length
            + SKUPINY_UDAJU.reduce((soucet, s, i) => soucet + (m.netyka.has(KLICE_SKUPIN[i]) ? 0 : s.udaje.length), 0);
        return celkem ? Math.max(0, Math.round((1 - vaha(m) / celkem) * 100)) : 100;
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

    // Části: v liště nahoře volba, pod ní vždy jedna část (Přehled, Údržba, Sháním, Statistiky)
    const modelekSChybou = radkyModelek.filter(m => vaha(m) > 0).length;
    const shanim = shanenaCisla(stavy).length;
    // Údaje ke kontrole (kontrola.go) po modelkách; nález označený „V pořádku“ se nepočítá
    const kontrola = new Map();
    p.podezrele.forEach(u => kontrola.set(u.modelkaId, [...(kontrola.get(u.modelkaId) || []), u]));
    const kKontrole = aktivnich(p.podezrele);
    const ukolu = modelekSChybou + radkyVydani.length + kKontrole;
    const casti = [
        ['uvod', 'Přehled', ''],
        ['udrzba', 'Údržba', ukolu],
        ['shanim', 'Sháním CZ', shanim],
        ['statistiky', 'Statistiky', ''],
    ];
    if (!['uvod', 'udrzba', 'shanim', 'statistiky'].includes(stav.prehledSekce)) stav.prehledSekce = 'uvod';
    // Pokrok sbírky po položkách (pruh, kolik z kolika) a kolik zbývá doplnit; klik otevře Údržbu s filtrem na tu položku
    const radekSouhrnu = (popis, chybi, celkem, filtr, akce = 'doplnit') => {
        const hotovo = Math.max(0, celkem - chybi);
        const procent = celkem ? Math.round(hotovo / celkem * 100) : 100;
        return `<button class="prehled-souhrn-radek ${chybi ? '' : 'hotovo'}" data-sekce-prehledu="udrzba" data-udrzba-filtr="${filtr}">
            <span>${popis}</span>
            ${celkem ? `<div class="prehled-souhrn-pruh"><i style="width:${procent}%"></i></div><small>${hotovo} z ${celkem}</small>` : '<div></div><small></small>'}
            <b>${chybi ? `${akce} ${chybi}` : 'hotovo'}</b></button>`;
    };
    const radkySouhrnu = `<div class="prehled-souhrn">
                    ${radekSouhrnu('Modelky s titulní fotkou', aktivnich(p.bezTitulni), p.modelek, 'titulni')}
                    ${radekSouhrnu('Modelky s centerfoldem', aktivnich(p.bezCenterfoldu), p.modelek, 'centerfold')}
                    ${radekSouhrnu('Modelky s hodnocením', aktivnich(p.bezHodnoceni), p.modelek, 'hodnoceni')}
                    ${radekSouhrnu('Alba s textem', aktivnich(p.albaBezPopisu), p.alb, 'text')}
                    ${radekSouhrnu('Alba s vydáním', aktivnich(p.albaBezVydani), p.alb, 'alba')}
                    ${radekSouhrnu('Čísla s coverem', p.vydaniBezCoveru.length, p.vydani, 'cover')}
                    ${radekSouhrnu('Čísla s centerfoldem', p.vydaniBezCenterfoldu.length, p.vydani, 'cfcisla')}
                    ${kKontrole ? radekSouhrnu('Údaje ke kontrole', kKontrole, 0, 'kontrola', 'zkontrolovat') : ''}
    </div>`;

    // Údržba: jedna fronta úkolů (modelky, čísla, údaje ke kontrole) seřazená podle toho, kolik toho chybí
    const modelekBezUdaju = radkyModelek.filter(m => (m.udaje || []).some((s, i) => s.length && !m.netyka.has(KLICE_SKUPIN[i]))).length;
    const fronta = /** @type {any[]} */ ([
        ...radkyModelek.map(m => ({ druh: 'modelka', m, vaha: m.vaha, ukoly: ukolyModelky(m) })),
        ...radkyVydani.map(([v, co]) => ({ druh: 'vydani', v, vaha: (co.cover ? 1 : 0) + (co.centerfold ? 1 : 0), ukoly: [
            ...(co.cover ? [{ filtr: 'cover', text: 'cover', atributy: 'data-akce="cover" data-klic="cover"', napoveda: 'Přidat cover' }] : []),
            ...(co.centerfold ? [{ filtr: 'cfcisla', text: 'centerfold', atributy: 'data-akce="centerfold" data-klic="centerfold"', napoveda: 'Přidat centerfold' }] : []),
        ] })),
        ...[...kontrola.values()].map(nalezy => ({ druh: 'kontrola', u: nalezy[0], vaha: aktivnich(nalezy), ukoly: nalezy.map(u => ({
            filtr: 'kontrola', text: u.popis, atributy: atributyNalezu(u), napoveda: u.pole ? 'Opravit ve formuláři' : 'Opravit v profilu', opravit: true, netyka: u.netykaSe })) })),
    ]).sort((a, b) => b.vaha - a.vaha);
    const pocetFiltru = filtr => fronta.filter(r => r.ukoly.some(u => u.filtr === filtr && !u.netyka)).length;
    const htmlUdrzby = () => {
        const filtr = stav.udrzbaFiltr;
        const radky = fronta.filter(r => filtr === 'vse' || r.ukoly.some(u => u.filtr === filtr));
        const prvniUkol = r => r.ukoly.find(u => !u.netyka && (filtr === 'vse' || u.filtr === filtr));
        const cil = r => r.druh === 'vydani' ? `data-vydani="${esc(r.v)}"` : `data-modelka="${r.druh === 'modelka' ? r.m.id : r.u.modelkaId}"`;
        // Doplňovat postupně jde jen tam, kde má formulář „Uložit a další“ (titulní fotka a údaje)
        const prvni = radky.find(prvniUkol);
        const ukol = prvni && prvniUkol(prvni);
        const klicFronty = ukol?.akce === 'titulni' ? 'titulni' : ukol?.akce === 'udaje' ? ukol.klic : '';
        const postupne = klicFronty ? `<button type="button" class="btn btn-primary btn-small ud-postupne" ${cil(prvni)} ${ukol.atributy}>Doplňovat ${NAZVY_FRONT[klicFronty]} postupně (${frontaPro(klicFronty).length}) →</button>` : '';
        const ukazat = radky.slice(0, stav.prehledLimit);
        return `
            <h3>Údržba <span>co doplnit a opravit · ${ukolu} ${ukolu === 1 ? 'úkol' : ukolu > 1 && ukolu < 5 ? 'úkoly' : 'úkolů'}</span></h3>
            <div class="ud-souhrn">${[
                ['Titulní fotka', aktivnich(p.bezTitulni), p.modelek], ['Centerfold', aktivnich(p.bezCenterfoldu), p.modelek],
                ['Hodnocení', aktivnich(p.bezHodnoceni), p.modelek], ['Údaje modelek', modelekBezUdaju, p.modelek],
                ['Texty alb', aktivnich(p.albaBezPopisu), p.alb], ['Vydání alb', aktivnich(p.albaBezVydani), p.alb],
                ['Cover čísel', p.vydaniBezCoveru.length, p.vydani], ['Centerfold čísel', p.vydaniBezCenterfoldu.length, p.vydani],
            ].map(([nazev, chybi, celkem]) => {
                const hotovo = Math.max(0, celkem - chybi);
                return `<div>${nazev}<i><b style="width:${celkem ? Math.round(hotovo / celkem * 100) : 100}%"></b></i><span>${hotovo} z ${celkem}</span></div>`;
            }).join('')}</div>
            <div class="ud-filtry" role="group" aria-label="Co ukázat">${FILTRY_UDRZBY.map(([klic, nazev]) => {
                // Řádky jen s úkoly „netýká se“ (při zobrazených skrytých) se do počtu nepočítají
                const pocet = klic === 'vse' ? fronta.filter(r => r.ukoly.some(u => !u.netyka)).length : pocetFiltru(klic);
                if (!pocet && klic !== filtr) return '';
                return `<button type="button" class="${klic === filtr ? 'on' : ''}" aria-pressed="${klic === filtr}" data-udrzba-filtr="${klic}">${nazev}<b>${pocet}</b></button>`;
            }).join('')}</div>
            <div class="ud-lista">Seřazeno podle toho, kolik toho chybí · <button class="link" data-skryte>${stav.prehledSkryte ? 'skrýt „netýká se“' : 'zobrazit i „netýká se“'}</button>${postupne}</div>
            ${ukazat.length ? `<div class="ud-fronta">${ukazat.map(r => {
                const hlavni = prvniUkol(r);
                const obrazek = r.druh === 'vydani' ? `<span class="ud-obalka">${IKONA('<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>')}</span>`
                    : `<img src="${esc(stav.prehledModelky.get(r.m?.id ?? r.u.modelkaId) ? adresaTitulni(stav.prehledModelky.get(r.m?.id ?? r.u.modelkaId)) : BEZ_FOTKY)}" alt="" loading="lazy" draggable="false" />`;
                const nazev = r.druh === 'vydani' ? nazevVydani(r.v) : r.druh === 'modelka' ? r.m.jmeno : r.u.jmeno;
                return `<div class="ud-radek" ${cil(r)}>
                    ${obrazek}
                    <div class="ud-jmeno"><strong>${esc(nazev)}</strong><small>${esc(r.druh === 'vydani' ? `číslo · ${rozlozitVydani(r.v)?.edice || VYCHOZI_EDICE}` : r.druh === 'kontrola' ? 'ke kontrole' : podtitulek(stav.prehledModelky.get(r.m.id)))}</small></div>
                    <div class="ud-chybi">${r.ukoly.map(u => u.netyka
                        ? (u.opravit ? `<span class="ud-chip netyka" ${u.atributy} data-netyka="1" title="V pořádku – pravým tlačítkem jde znovu kontrolovat">${esc(u.text)} ✓</span>`
                            : `<span class="ud-chip netyka" data-klic="${u.klic}" data-netyka="1" title="Netýká se – pravým tlačítkem jde znovu sledovat">${esc(u.text)} –</span>`)
                        : u.opravit ? `<button type="button" class="ud-chip ${u === hlavni ? 'hlavni' : ''}" ${u.atributy} title="${esc(u.napoveda)} (pravým tlačítkem: v pořádku)">${esc(u.text)}</button>`
                        : `<button type="button" class="ud-chip ${u === hlavni ? 'hlavni' : ''}" ${u.atributy} title="${esc(u.napoveda)} (pravým tlačítkem: netýká se)">${esc(u.text)}</button>`).join('')}</div>
                    <div class="ud-akce">
                        ${hlavni ? `<button type="button" class="ud-doplnit" ${hlavni.atributy} title="${esc(hlavni.napoveda)}">${hlavni.opravit ? 'Opravit' : 'Doplnit'}</button>` : ''}
                        <button type="button" class="ud-vice" data-ud-vice title="Netýká se, další akce" aria-label="Další akce">⋯</button>
                    </div>
                </div>`;
            }).join('')}</div>${radky.length > stav.prehledLimit ? `<p class="stat-note">Zobrazeno ${stav.prehledLimit} z ${radky.length}. <button class="link" data-vice>Zobrazit dalších ${Math.min(60, radky.length - stav.prehledLimit)}</button></p>` : ''}`
                : `<p class="stat-prazdne">${fronta.length ? 'V tomhle filtru nic nezbývá.' : 'Vše je doplněné.'}</p>`}`;
    };
    stats.innerHTML = `
        <div class="prehled-casti">${casti.map(([klic, nazev, pocet]) => `<button class="chip ${klic === stav.prehledSekce ? 'active' : ''}" data-sekce-prehledu="${klic}">${nazev}${pocet ? `<span>${pocet}</span>` : ''}${IKONY_CASTI[klic]}</button>`).join('')}</div>
        <div class="prehled-obsah" data-sekce-ukazana="${stav.prehledSekce}">
            <section class="stat-section" data-sekce="uvod">${htmlUvodu({ p, kalendar, stavy, modelky: seznamModelek, souhrn: radkySouhrnu, kUdrzbe: ukolu, modelekUplnych: p.modelek - modelekSChybou })}</section>
            <section class="stat-section" data-sekce="shanim">${htmlShanim(stavy)}</section>
            <section class="stat-section" data-sekce="udrzba">${htmlUdrzby()}</section>
            <!-- Statistiky se počítají až při prvním zobrazení oddílu -->
            <section class="stat-section stat-statistiky" data-sekce="statistiky"><p class="stat-prazdne">Počítám statistiky…</p></section>
        </div>
    `;    // Části (Přehled, Údržba, Sháním CZ, Statistiky) jako rozbalovací volba v horní liště, jako zobrazení Čísel
    prevestNaVolby(stats.querySelector('.prehled-casti'));

    prekreslitUdrzbu = () => { stats.querySelector('[data-sekce="udrzba"]').innerHTML = htmlUdrzby(); };
    if (stav.prehledSekce === 'statistiky') nacistStatistiky(stats.querySelector('[data-sekce="statistiky"]'));
    // Graf desetiletí na úvodu se dopočítá zvlášť (statistiky se počítají z celé sbírky)
    const grafDekad = stats.querySelector('[data-graf-dekad]');
    GetStatistiky().then(s => { if (grafDekad.isConnected) grafDekad.querySelector('.stat-prazdne').outerHTML = htmlGrafuDekad(s); });
}

// „Netýká se" u buňky: modelka (centerfold neměla, údaj nejde zjistit) nebo všechna alba v buňce
export async function oznacitNetykaSe(bunka, netyka) {
    const radek = bunka.closest('[data-modelka], [data-vydani]');
    // U vydání je „netýká se" stav čísla „nezajímá mě"; zrušit ho jde na stránce vydání nebo v kalendáři
    if (radek.dataset.vydani) {
        // Číslo, které mám nebo sháním, nesmí přijít o svůj stav kvůli chybějícímu coveru
        const soucasny = (await GetStavyVydani() || []).find(s => s.vydani === radek.dataset.vydani)?.stav;
        if (netyka && (soucasny === 'mam' || soucasny === 'shanim')) {
            oznamit(`${nazevVydani(radek.dataset.vydani)} je označené „${soucasny === 'mam' ? 'mám výtisk' : 'sháním'}“; „netýká se“ by ten stav přepsalo, proto zůstává.`);
            return;
        }
        await SetStavVydani(radek.dataset.vydani, netyka ? 'nezajima' : '');
        if (!stats.classList.contains('hidden')) nacistPrehled();
        return;
    }
    const modelkaId = parseInt(radek.dataset.modelka);
    const klic = bunka.dataset.klic;
    if (bunka.dataset.album) {
        // Nález kontroly u alba: „V pořádku“ patří tomu albu
        await SetNetykaSeAlba(modelkaId, bunka.dataset.album, bunka.dataset.typ, klic, netyka);
    } else if (klic === 'text' || klic === 'vydani') {
        const alba = stav.prehledAlba.get(modelkaId)?.[klic === 'text' ? 'popis' : 'vydani'] || [];
        for (const a of alba) await SetNetykaSeAlba(a.modelkaId, a.album, a.typ, klic, netyka);
    } else {
        await SetNetykaSe(modelkaId, klic, netyka);
    }
    if (!stats.classList.contains('hidden')) nacistPrehled();
}

const zkratit = text => text.length > 60 ? `${text.slice(0, 58)}…` : text;

// Nabídka ⋯ na řádku údržby: „netýká se“ pro každý úkol a další akce
function nabidkaRadku(tlacitko) {
    const radek = tlacitko.closest('.ud-radek');
    const r = tlacitko.getBoundingClientRect();
    const ukoly = [...radek.querySelectorAll('.ud-chybi button[data-klic]')];
    let polozky;
    if (radek.dataset.vydani) {
        polozky = [
            ...(ukoly.length ? [{ text: 'Netýká se – číslo mě nezajímá', akce: () => oznacitNetykaSe(ukoly[0], true) }, null] : []),
            { text: `Otevřít ${nazevVydani(radek.dataset.vydani)}`, akce: () => otevritVydani(radek.dataset.vydani) },
        ];
    } else {
        const modelka = stav.prehledModelky.get(parseInt(radek.dataset.modelka));
        if (!modelka) return;
        const netyka = [...radek.querySelectorAll('.ud-chybi [data-netyka]')];
        polozky = [
            // Nález kontroly (má data-opravit) je „V pořádku“, chybějící údaj „Netýká se“
            ...ukoly.map(u => ({ text: `${u.hasAttribute('data-opravit') ? 'V pořádku' : 'Netýká se'}: ${zkratit(u.textContent)}`, akce: () => oznacitNetykaSe(u, true) })),
            ...netyka.map(u => ({ text: `${u.hasAttribute('data-opravit') ? 'Znovu kontrolovat' : 'Znovu sledovat'}: ${zkratit(u.textContent.replace(/ [–✓]$/, ''))}`, akce: () => oznacitNetykaSe(u, false) })),
            ...(ukoly.length || netyka.length ? [null] : []),
            ...(stav.prehledRadky.some(x => x.id === modelka.id) ? [{ text: 'Doplnit vše v jednom okně', akce: () => otevritDoplneni(modelka.id) }] : []),
            { text: 'Otevřít profil', akce: () => otevritDetailModelky(modelka) },
        ];
    }
    otevritKontextovouNabidku(r.right - 220, r.bottom + 4, polozky);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.prehledSekce = localStorage.getItem('prehledSekce') || 'uvod'; } catch { /* úvod */ }
    // Dřívější záložky údržby (Souhrn, Modelky, Čísla, Ke kontrole) jsou teď jedna Údržba
    if (['souhrn', 'modelky', 'vydani', 'kontrola'].includes(stav.prehledSekce)) stav.prehledSekce = 'udrzba';
    // Části v levém panelu, filtry a ⋯ ve frontě údržby, přepínač skrytých údajů a další stránka
    stats.addEventListener('click', (e) => {
        const cast = e.target.closest('[data-sekce-prehledu]');
        const filtr = e.target.closest('[data-udrzba-filtr]');
        const opravit = e.target.closest('[data-opravit]');
        const vice = e.target.closest('[data-ud-vice]');
        if (opravit) {
            // Údaj se opraví ve formuláři modelky (záložka a pole nálezu), alba a fotky v profilu
            e.stopPropagation();
            const modelka = stav.prehledModelky.get(parseInt(opravit.closest('[data-modelka]').dataset.modelka));
            if (!modelka) return;
            const pole = opravit.dataset.opravit;
            if (!pole) {
                otevritDetailModelky(modelka);
                return;
            }
            otevritModelModal(modelka);
            ukazatZalozku(zalozkaPole(pole));
            zameritPole(pole);
        } else if (vice) {
            e.stopPropagation();
            nabidkaRadku(vice);
        } else if (cast) {
            // Přepnutí části jen v zobrazené stránce, bez nového načtení; řádek souhrnu otevře Údržbu s filtrem
            stav.prehledSekce = cast.dataset.sekcePrehledu;
            try { localStorage.setItem('prehledSekce', stav.prehledSekce); } catch { /* jen se nezapamatuje */ }
            if (cast.dataset.udrzbaFiltr) {
                stav.udrzbaFiltr = cast.dataset.udrzbaFiltr;
                stav.prehledLimit = 60;
                prekreslitUdrzbu();
            }
            stats.querySelector('.prehled-obsah').dataset.sekceUkazana = stav.prehledSekce;
            const casti = stats.querySelector('.prehled-casti');
            casti.querySelectorAll('[data-sekce-prehledu]').forEach(b => b.classList.toggle('active', b.dataset.sekcePrehledu === stav.prehledSekce));
            prevestNaVolby(casti);
            if (stav.prehledSekce === 'statistiky') nacistStatistiky(stats.querySelector('[data-sekce="statistiky"]'));
            document.querySelector('main').scrollTop = 0;
        } else if (filtr) {
            stav.udrzbaFiltr = filtr.dataset.udrzbaFiltr;
            stav.prehledLimit = 60;
            prekreslitUdrzbu();
            stats.querySelector(`.ud-filtry [data-udrzba-filtr="${stav.udrzbaFiltr}"]`)?.focus();
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
    const nabidkaCislaPrehledu = (klic, x, y) => nabidkaCisla(klic, x, y, { poZmene: nacistPrehled });
    stats.addEventListener('click', (e) => {
        const cislo = e.target.closest('[data-cislo]');
        const modelka = e.target.closest('[data-otevrit-modelku]');
        const shanene = e.target.closest('[data-shanim]');
        if (cislo) {
            if (cislo.hasAttribute('data-ma-data')) otevritVydani(cislo.dataset.cislo);
            else nabidkaCislaPrehledu(cislo.dataset.cislo, e.clientX, e.clientY);
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
                .then(() => oznamit('Seznam sháněných čísel je ve schránce.'), () => oznamit('Seznam se nepodařilo zkopírovat.'));
        }
    });
    stats.addEventListener('contextmenu', (e) => {
        const cislo = e.target.closest('[data-cislo]');
        if (!cislo) return;
        e.preventDefault();
        e.stopPropagation();
        // Klávesa nabídky nemá souřadnice myši: nabídka se ukáže u políčka
        const r = cislo.getBoundingClientRect();
        nabidkaCislaPrehledu(cislo.dataset.cislo, e.clientX || r.left + 8, e.clientY || r.bottom + 4);
    }, true);

    // Mapa edice je pro Tab jedno místo; šipky se v ní pohybují po měsících (←→) a rocích (↑↓), Home a End
    // skočí na první a poslední číslo, Enter číslo otevře, klávesa nabídky nabídne stav
    stats.addEventListener('keydown', (e) => {
        const policko = e.target.closest?.('.uvod-rok i');
        const posun = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12 }[e.key];
        if (!policko || (posun === undefined && e.key !== 'Home' && e.key !== 'End')) return;
        const vsechna = [...policko.closest('.uvod-mapa').querySelectorAll('.uvod-rok i')];
        const cisla = vsechna.filter(i => i.hasAttribute('data-cislo'));
        const kde = vsechna.indexOf(policko);
        // Měsíce mimo řadu edice (bez čísla) se přeskakují; o rok nahoru nebo dolů na takový měsíc se nejde
        let cil = e.key === 'Home' ? cisla[0] : e.key === 'End' ? cisla.at(-1) : null;
        if (posun !== undefined) {
            let i = kde + posun;
            if (Math.abs(posun) === 1) while (vsechna[i] && !vsechna[i].hasAttribute('data-cislo')) i += posun;
            cil = vsechna[i]?.hasAttribute('data-cislo') ? vsechna[i] : null;
        }
        if (!cil) { e.preventDefault(); return; }
        e.preventDefault();
        policko.tabIndex = -1;
        cil.tabIndex = 0;
        cil.focus();
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
        if (akce === 'titulni') {
            otevritModelModal(modelka, { zalozka: 0, klic: 'titulni', ids: frontaPro('titulni') });
            document.getElementById('inputDriveID').focus();
        } else if (akce === 'udaje') {
            // Formulář se otevře na záložce skupiny, s kurzorem v prvním chybějícím poli
            otevritModelModal(modelka, { zalozka: parseInt(bunka.dataset.zalozka), klic: bunka.dataset.klic, ids: frontaPro(bunka.dataset.klic) });
            ukazatZalozku(parseInt(bunka.dataset.zalozka));
            zameritPole(bunka.dataset.pole);
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
