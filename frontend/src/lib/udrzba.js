// Údržba sbírky bez stránky: z dat Přehledu (GetPrehled), modelek, nálezů kontroly a návrhů doplnění sestaví
// jednu frontu skupin (modelka nebo číslo) s položkami (chybějící údaj, nález kontroly, návrh), spočítá jejich
// prioritu, pokrok sbírky po oblastech a počty pro filtry; pro režim Po údajích ji přeskládá po jednotlivých údajích.
// Jen čisté funkce – testuje je test/udrzba.test.js.
import { VYCHOZI_EDICE, kategorieModelky, nazevAlba, nazevVydani, popisKategorie, rozlozitVydani, sjednotit, sklonovat, udajChybi } from './format.js';

// Údaje modelky, které Údržba hlídá, po skupinách shodných s částmi formuláře: [vlastnost, název, pole formuláře].
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
// Klíč „netýká se“ podle skupiny údajů (části formuláře)
export const KLICE_SKUPIN = ['zakladni', 'vzhled', 'zarazeni'];
// Pole mimo hlídané skupiny, na která míří nálezy kontroly
const ZALOZKY_POLI = { inputDalsiJmena: 0, inputUmrtiDatum: 0, inputJmeno: 0 };
const NAZVY_POLI = { inputDalsiJmena: 'další jména', inputUmrtiDatum: 'datum úmrtí', inputJmeno: 'jméno' };
export const zalozkaPole = pole => SKUPINY_UDAJU.find(s => s.udaje.some(u => u[2] === pole))?.zalozka ?? ZALOZKY_POLI[pole] ?? 0;
// Název údaje podle pole formuláře (štítek nálezu kontroly)
export const nazevPoleFormulare = pole => SKUPINY_UDAJU.flatMap(s => s.udaje).find(u => u[2] === pole)?.[1] || NAZVY_POLI[pole] || '';

// Filtry fronty po oblastech (boční seznam v Údržbě): [klíč, název, popis do nápovědy]. Počet u filtru je počet
// modelek a čísel, u Kontroly a Návrhů počet položek.
export const OBLASTI_FILTRU = [
    { nazev: 'Fronta', filtry: [
        ['vse', 'Vše', 'Nahoře to, co sbírce přinese nejvíc: Playmate bez data narození, titulní fotky, údaje ke kontrole'],
        ['navrhy', '✦ Návrhy', 'Odhadnuto z tvé sbírky; nejjistější a nejcennější první'],
        ['kontrola', '⚠ Ke kontrole', 'Údaje, které vypadají jako překlep; když je údaj pravdivý, dej „V pořádku“ – kontrola se z toho učí'],
    ] },
    { nazev: 'Modelky', filtry: [['titulni', 'Titulní fotka', ''], ['centerfold', 'Centerfold', ''], ['hodnoceni', 'Hodnocení', ''], ['udaje', 'Údaje', 'Chybějící údaje modelek po částech formuláře']] },
    { nazev: 'Alba', filtry: [['text', 'Texty', 'Alba bez průvodního textu'], ['alba', 'Vydání', 'Alba bez čísla, ve kterém vyšla']] },
    { nazev: 'Čísla', filtry: [['cover', 'Cover', 'Čísla bez obálky'], ['cfcisla', 'Centerfold', 'Čísla bez centerfoldu']] },
];
export const FILTRY = OBLASTI_FILTRU.flatMap(o => o.filtry.map(([klic, nazev]) => [klic, nazev]));
// Filtry, u kterých se počítají jednotlivé položky (každá je samostatné rozhodnutí)
const POCET_POLOZEK = new Set(['kontrola', 'navrhy']);

// Návrhy doplnění: hranice jistoty – od 90 % „jisté“ (jde přijmout hromadně), od 70 % „pravděpodobné“, níž „odhad“
export const MEZ_JISTE = 0.9;
export const MEZ_PRAVDEPODOBNE = 0.7;
export const procent = j => Math.round(Math.max(0, Math.min(1, j || 0)) * 100);
export const slovoJistoty = j => j >= MEZ_JISTE ? 'jisté' : j >= MEZ_PRAVDEPODOBNE ? 'pravděpodobné' : 'odhad';
export const tridaJistoty = j => j >= MEZ_JISTE ? 'jiste' : j >= MEZ_PRAVDEPODOBNE ? 'pravdepodobne' : 'odhad';
// Návrh je určený modelkou, albem, polem a navrženou hodnotou: odmítnutí platí jen pro tu hodnotu,
// takže po něm může přijít návrh jiné hodnoty téhož pole
export const idNavrhu = n => [n.modelkaId, n.album, n.typ, n.klic || n.pole, n.hodnota].join('|');
export const nazevNavrhu = n => n.popis || n.pole;
// Vydání alba se ukazuje jako název čísla („Červenec 1976“), ostatní hodnoty tak, jak se uloží
export const hodnotaNavrhu = n => (n.pole === 'vydani' || n.pole === 'vydaniAlba') && rozlozitVydani(n.hodnota) ? nazevVydani(n.hodnota) : String(n.hodnota ?? '');

// Oprava návrhu po „Upravit…“: text uložené hodnoty pro ZaznamenatOpravu, nebo null, když není co zaznamenat.
// Prázdné pole (u čísla 0) oprava není – údaj zůstal nevyplněný. Jiný zápis téže hodnoty („Ceska“ → „Česká“)
// oprava je: učení si zapamatuje, jak uživatel hodnotu píše. Kategorie se k zapsaným přidávají, stačí, že v nich je.
export function opravaNavrhu(navrzena, inputId, ulozena) {
    const text = String(ulozena ?? '').trim();
    const navrh = String(navrzena ?? '').trim();
    if (!text || ulozena === 0) return null;
    if (inputId === 'inputRole') return sjednotit(text).split(/\s*,\s*/).includes(sjednotit(navrh)) ? null : text;
    return text === navrh ? null : text;
}

export const pocetAlb = n => `${n} ${n === 1 ? 'album' : n < 5 ? 'alba' : 'alb'}`;
const vyctem = (seznam, max = 3) => seznam.length <= max ? seznam.join(', ') : `${seznam.slice(0, max).join(', ')} a ${seznam.length - max} další`;

// Váha chybějícího údaje modelky pro prioritu: datum narození je u Playmate nejcennější (věk při centerfoldu)
const VAHY_UDAJU = { narozeniDatum: 5, narozeniMisto: 2, narodnost: 2.5, etnicita: 1.2, vyskaCm: 2, vahaKg: 1, role: 3, tags: 0.4 };
// Váha skupiny chybějících údajů: nejcennější údaj a čtvrtina ostatních (dvanáct drobností nepřebije datum narození Playmate)
function vahaUdaju(chybejici, playmate) {
    const vahy = chybejici.map(u => u[0] === 'narozeniDatum' && playmate ? 10 : VAHY_UDAJU[u[0]] ?? 1).sort((a, b) => b - a);
    return (vahy[0] || 0) + 0.25 * vahy.slice(1).reduce((soucet, v) => soucet + v, 0);
}
const VAHY_UKOLU = { titulni: 8, centerfold: 5, hodnoceni: 2, text: 1.5, vydani: 3, cover: 5, cfcisla: 6 };
const VAHA_NALEZU = 9;
// Úroveň priority pro štítek u položky
export const urovenPriority = p => p >= 12 ? 'vysoka' : p >= 5 ? 'stredni' : 'nizka';
export const NAZVY_PRIORIT = { vysoka: 'vysoká priorita', stredni: 'střední priorita', nizka: 'nízká priorita' };

export const jePlaymate = m => Boolean((m?.centerfoldy || []).length) || /playmate/i.test(m?.role || '');
// Jak moc na modelce ve sbírce záleží: Playmate a modelky obálky víc, srdíčka trochu
export function vyznamModelky(m) {
    if (!m) return 1;
    return 1 + (jePlaymate(m) ? 0.8 : 0) + ((m.obalky || []).length ? 0.3 : 0) + Math.max(0, m.hodnoceni || 0) * 0.08;
}

// Pod jménem v řádku: kategorie a první číslo modelky
export function podtitulek(modelka) {
    if (!modelka) return '';
    const prvni = [...(modelka.vydani || [])].sort()[0];
    return [kategorieModelky(modelka).map(popisKategorie).join(', '), prvni && nazevVydani(prvni)].filter(Boolean).join(' · ');
}

const aktivnich = seznam => (seznam || []).filter(x => !x.netykaSe).length;
const netykaSeModelky = m => new Set((m?.netykaSe || '').split(',').filter(Boolean));

/**
 * Sestaví Údržbu.
 * @param {object} vstup
 * @param {any} vstup.p výsledek GetPrehled
 * @param {any[]} vstup.modelky všechny modelky
 * @param {any[]} [vstup.navrhy] návrhy doplnění (i odmítnuté)
 * @param {boolean} [vstup.skryte] zobrazit i „netýká se“ a „V pořádku“
 * @param {boolean} [vstup.odmitnute] zobrazit i odmítnuté návrhy
 * @param {string} [vstup.razeni] 'priorita' | 'chybi' | 'jmeno'
 */
export function sestavitUdrzbu({ p, modelky, navrhy = [], skryte = false, odmitnute = false, razeni = 'priorita' }) {
    const podleId = new Map(modelky.map(m => [m.id, m]));
    const netykaPodleId = new Map(modelky.map(m => [m.id, netykaSeModelky(m)]));
    const netyka = id => netykaPodleId.get(id) || new Set();

    // Modelky: co chybí přímo u nich a kolik jejich alb nemá text nebo vydání (řádky pro Doplnit modelku a „Uložit a další“)
    const radky = new Map();
    const radek = (id, jmeno) => {
        if (!radky.has(id)) radky.set(id, { id, jmeno: podleId.get(id)?.jmeno || jmeno, chybi: new Set(), bezPopisu: [], bezVydani: [], netyka: netyka(id), udaje: null });
        return radky.get(id);
    };
    /** @type {[string, any[]][]} */ ([['titulni', p.bezTitulni], ['centerfold', p.bezCenterfoldu], ['hodnoceni', p.bezHodnoceni]])
        .forEach(([co, seznam]) => (seznam || []).forEach(m => radek(m.modelkaId, m.jmeno).chybi.add(co)));
    // Vyplněnost údajů napříč sbírkou (pokrok) a chybějící údaje po skupinách u každé modelky
    let udajuCelkem = 0, udajuVyplneno = 0;
    modelky.forEach(m => {
        const nt = netyka(m.id);
        const chybejici = SKUPINY_UDAJU.map((s, i) => {
            const chybi = s.udaje.filter(([vlastnost]) => udajChybi(m, vlastnost));
            if (!nt.has(KLICE_SKUPIN[i])) {
                udajuCelkem += s.udaje.length;
                udajuVyplneno += s.udaje.length - chybi.length;
            }
            return nt.has(KLICE_SKUPIN[i]) && !skryte ? [] : chybi;
        });
        if (chybejici.some(sk => sk.length)) radek(m.id, m.jmeno).udaje = chybejici;
    });
    (p.albaBezPopisu || []).forEach(a => radek(a.modelkaId, a.jmeno).bezPopisu.push(a));
    (p.albaBezVydani || []).forEach(a => radek(a.modelkaId, a.jmeno).bezVydani.push(a));

    const vaha = r => [...r.chybi].filter(k => !r.netyka.has(k)).length
        + (r.bezPopisu.some(a => !a.netykaSe) ? 1 : 0) + (r.bezVydani.some(a => !a.netykaSe) ? 1 : 0)
        + (r.udaje || []).reduce((soucet, sk, i) => soucet + (r.netyka.has(KLICE_SKUPIN[i]) ? 0 : sk.length), 0);
    // Vyplněnost modelky: podíl sledovaných údajů, které nechybí (bez údajů „netýká se“)
    const vyplneno = r => {
        const celkem = ['titulni', 'centerfold', 'hodnoceni', 'text', 'vydani'].filter(k => !r.netyka.has(k)).length
            + SKUPINY_UDAJU.reduce((soucet, s, i) => soucet + (r.netyka.has(KLICE_SKUPIN[i]) ? 0 : s.udaje.length), 0);
        return celkem ? Math.max(0, Math.round((1 - r.vaha / celkem) * 100)) : 100;
    };
    radky.forEach(r => { r.vaha = vaha(r); r.vyplneno = vyplneno(r); });

    // Nálezy kontroly a návrhy po modelkách
    const kontrola = new Map();
    (p.podezrele || []).forEach(u => { if (skryte || !u.netykaSe) kontrola.set(u.modelkaId, [...(kontrola.get(u.modelkaId) || []), u]); });
    const navrhyModelek = new Map();
    navrhy.forEach(n => { if (odmitnute || !n.odmitnuto) navrhyModelek.set(n.modelkaId, [...(navrhyModelek.get(n.modelkaId) || []), n]); });

    /** @type {any[]} */
    const skupiny = [];
    const idModelek = new Set([...radky.keys(), ...kontrola.keys(), ...navrhyModelek.keys()]);
    idModelek.forEach(id => {
        const m = podleId.get(id);
        const r = radky.get(id);
        const klicSkupiny = `m:${id}`;
        const vyznam = vyznamModelky(m);
        const playmate = jePlaymate(m);
        const polozky = [];
        const pridat = (polozka, vahaPolozky) => {
            if (polozka.netyka && !skryte) return;
            polozka.klic = `${klicSkupiny}|${polozka.id}`;
            polozka.priorita = polozka.netyka ? 0 : Math.round(vahaPolozky * vyznam * 10) / 10;
            polozka.uroven = urovenPriority(polozka.priorita);
            polozky.push(polozka);
        };
        if (r) {
            const nt = r.netyka;
            if (r.chybi.has('titulni')) pridat({ id: 'titulni', druh: 'ukol', filtr: 'titulni', akce: 'titulni', netykaKlic: 'titulni', pole: 'titulní fotka', hodnota: 'chybí titulní fotka',
                duvod: 'Bez ní je modelka v galerii a ve vyhledávání jen prázdná dlaždice', netyka: nt.has('titulni') }, VAHY_UKOLU.titulni);
            if (r.chybi.has('centerfold')) pridat({ id: 'centerfold', druh: 'ukol', filtr: 'centerfold', akce: 'centerfold', netykaKlic: 'centerfold', pole: 'centerfold', hodnota: 'chybí album Centerfold',
                duvod: 'Bez centerfoldu chybí na stěně centerfoldů i v kalendáři', netyka: nt.has('centerfold') }, VAHY_UKOLU.centerfold);
            SKUPINY_UDAJU.forEach((s, i) => {
                const klic = KLICE_SKUPIN[i];
                const chybejici = r.udaje?.[i] || [];
                const nazev = s.nazev.toLowerCase();
                if (!chybejici.length) {
                    if (nt.has(klic)) pridat({ id: `udaje:${klic}`, druh: 'ukol', filtr: 'udaje', akce: 'udaje', netykaKlic: klic, skupinaUdaju: i, chybejici: [], pole: nazev, hodnota: nazev, netyka: true }, 0);
                    return;
                }
                const nazvy = chybejici.map(u => u[1]);
                const bezNarozeni = playmate && chybejici.some(u => u[0] === 'narozeniDatum');
                pridat({ id: `udaje:${klic}`, druh: 'ukol', filtr: 'udaje', akce: 'udaje', netykaKlic: klic, skupinaUdaju: i, chybejici,
                    pole: nazev, hodnota: chybejici.length === s.udaje.length ? `chybí vše (${s.udaje.length})` : `chybí ${vyctem(nazvy, 4)}`,
                    souhrn: chybejici.length === s.udaje.length ? `${nazev} – vše` : chybejici.length <= 3 ? nazvy.join(', ') : `${nazev} (${chybejici.length} z ${s.udaje.length})`,
                    duvod: bezNarozeni ? 'Playmate bez data narození – nejde spočítat věk při centerfoldu' : '',
                    netyka: nt.has(klic) }, vahaUdaju(chybejici, playmate));
            });
            if (r.chybi.has('hodnoceni')) pridat({ id: 'hodnoceni', druh: 'ukol', filtr: 'hodnoceni', akce: 'hodnoceni', netykaKlic: 'hodnoceni', pole: 'hodnocení', hodnota: 'bez srdíček',
                duvod: 'Srdíčka řadí galerii a vybírají Nejlepší', netyka: nt.has('hodnoceni') }, VAHY_UKOLU.hodnoceni);
            // Alba: počet těch, která text nebo vydání opravdu potřebují
            [['text', 'popis', r.bezPopisu, 'bez textu', 'Průvodní text alba se ukazuje v profilu a na stránce čísla'],
                ['alba', 'vydani', r.bezVydani, 'bez vydání', 'Album bez čísla chybí v kalendáři i na stránce čísla']].forEach(([filtr, akce, seznam, popis, duvod]) => {
                const klic = akce === 'popis' ? 'text' : 'vydani';
                const aktivni = seznam.filter(a => !a.netykaSe);
                const alba = aktivni.length ? aktivni : seznam;
                if (!alba.length) return;
                pridat({ id: klic, druh: 'ukol', filtr, akce, netykaKlic: klic, alba, pole: `${pocetAlb(alba.length)} ${popis}`,
                    hodnota: vyctem(alba.map(a => nazevAlba(a.album, a.typ))), duvod, netyka: !aktivni.length }, VAHY_UKOLU[klic] + Math.min(aktivni.length, 5) * 0.3);
            });
        }
        (kontrola.get(id) || []).forEach(u => {
            const nazev = nazevPoleFormulare(u.pole);
            pridat({ id: `k:${[u.klic, u.album, u.typ, u.pole, u.popis].join('/')}`, druh: 'kontrola', filtr: 'kontrola', akce: 'opravit', nalez: u,
                pole: nazev || (u.album ? 'album' : 'údaj'), hodnota: u.popis, duvod: u.album ? `Album ${nazevAlba(u.album, u.typ)}` : '',
                zdroj: u.zdroj || '', netyka: Boolean(u.netykaSe) }, VAHA_NALEZU);
        });
        (navrhyModelek.get(id) || []).forEach(n => {
            pridat({ id: `n:${idNavrhu(n)}`, druh: 'navrh', filtr: 'navrhy', akce: 'prijmout', navrh: n, pole: nazevNavrhu(n), hodnota: hodnotaNavrhu(n),
                duvod: n.duvod || '', album: n.album ? `${nazevAlba(n.album, n.typ)} · ${n.typ}` : '', jistota: n.jistota || 0,
                zdroj: n.zdroj || '', zdrojPopis: n.zdrojPopis || '', netyka: Boolean(n.odmitnuto) }, 3 + 5 * (n.jistota || 0));
        });
        if (!polozky.length) return;
        skupiny.push({ klic: klicSkupiny, druh: 'modelka', id, jmeno: m?.jmeno || r?.jmeno || kontrola.get(id)?.[0]?.jmeno || navrhyModelek.get(id)?.[0]?.jmeno || '',
            playmate, vyplneno: r ? r.vyplneno : 100, polozky });
    });

    // Čísla, kterým chybí cover nebo centerfold
    const vydani = new Map();
    (p.vydaniBezCoveru || []).forEach(v => vydani.set(v, { cover: true }));
    (p.vydaniBezCenterfoldu || []).forEach(v => vydani.set(v, { ...vydani.get(v), centerfold: true }));
    vydani.forEach((co, v) => {
        const klicSkupiny = `v:${v}`;
        const polozky = [];
        const cislo = (id, filtr, pole, hodnota, duvod) => polozky.push({ id, klic: `${klicSkupiny}|${id}`, druh: 'ukol', filtr, akce: id, pole, hodnota, duvod, netyka: false,
            priorita: VAHY_UKOLU[filtr], uroven: urovenPriority(VAHY_UKOLU[filtr]) });
        if (co.cover) cislo('cover', 'cover', 'cover', 'chybí obálka čísla', 'Bez coveru je číslo v Číslech a v kalendáři prázdné');
        if (co.centerfold) cislo('centerfold', 'cfcisla', 'centerfold', 'chybí centerfold čísla', 'Číslo nemá Playmate – přidej jí centerfold');
        skupiny.push({ klic: klicSkupiny, druh: 'vydani', vydani: v, jmeno: nazevVydani(v), podtitulek: `číslo · ${rozlozitVydani(v)?.edice || VYCHOZI_EDICE}`, polozky });
    });

    // Priorita skupiny: nejcennější položka a k tomu zlomek ostatních (víc práce na jednom místě se vyplatí)
    skupiny.forEach(s => {
        s.polozky.sort((a, b) => Number(a.netyka) - Number(b.netyka) || b.priorita - a.priorita);
        const aktivni = s.polozky.filter(x => !x.netyka);
        s.aktivnich = aktivni.length;
        s.priorita = aktivni.length ? aktivni[0].priorita + 0.2 * aktivni.slice(1).reduce((soucet, x) => soucet + x.priorita, 0) : 0;
        s.uroven = urovenPriority(s.priorita);
        s.hledani = sjednotit(`${s.jmeno} ${s.druh === 'vydani' ? s.vydani : ''}`);
    });
    const podleJmena = (a, b) => a.jmeno.localeCompare(b.jmeno, 'cs');
    const poradi = {
        priorita: (a, b) => b.priorita - a.priorita || podleJmena(a, b),
        chybi: (a, b) => b.aktivnich - a.aktivnich || (radky.get(b.id)?.vaha || 0) - (radky.get(a.id)?.vaha || 0) || podleJmena(a, b),
        jmeno: podleJmena,
    };
    skupiny.sort(poradi[razeni] || poradi.priorita);

    // Počty k filtrům v jednom průchodu
    const pocty = Object.fromEntries(FILTRY.map(([klic]) => [klic, 0]));
    skupiny.forEach(s => {
        const filtry = new Set();
        s.polozky.forEach(x => {
            if (x.netyka) return;
            filtry.add(x.filtr);
            if (POCET_POLOZEK.has(x.filtr)) pocty[x.filtr]++;
        });
        if (filtry.size) pocty.vse++;
        filtry.forEach(f => { if (!POCET_POLOZEK.has(f)) pocty[f]++; });
    });

    // Pokrok sbírky po oblastech: kolik z kolika je hotovo; klik na řádek otevře filtr
    const oblast = (skupina, klic, nazev, chybi, celkem, filtr, jednotka = '') => ({ skupina, klic, nazev, hotovo: Math.max(0, celkem - chybi), celkem, chybi, filtr, jednotka });
    const pokrok = [
        oblast('Modelky', 'titulni', 'Titulní fotka', aktivnich(p.bezTitulni), p.modelek, 'titulni'),
        oblast('Modelky', 'centerfold', 'Centerfold', aktivnich(p.bezCenterfoldu), p.modelek, 'centerfold'),
        oblast('Modelky', 'hodnoceni', 'Hodnocení', aktivnich(p.bezHodnoceni), p.modelek, 'hodnoceni'),
        oblast('Modelky', 'udaje', 'Údaje', udajuCelkem - udajuVyplneno, udajuCelkem, 'udaje', 'údajů'),
        oblast('Alba', 'text', 'Texty alb', aktivnich(p.albaBezPopisu), p.alb, 'text'),
        oblast('Alba', 'alba', 'Vydání alb', aktivnich(p.albaBezVydani), p.alb - (p.albOnline || 0), 'alba'),
        oblast('Čísla', 'cover', 'Cover', (p.vydaniBezCoveru || []).length, p.vydani, 'cover'),
        oblast('Čísla', 'cfcisla', 'Centerfold', (p.vydaniBezCenterfoldu || []).length, p.vydani, 'cfcisla'),
    ];
    const sCelkem = pokrok.filter(o => o.celkem > 0);
    const uplnost = sCelkem.length ? Math.round(sCelkem.reduce((soucet, o) => soucet + o.hotovo / o.celkem, 0) / sCelkem.length * 100) : 100;

    // Modelky v pořadí fronty (Doplnit modelku → „Uložit a další“); jen ty, kterým něco opravdu chybí
    const radkyModelek = skupiny.filter(s => s.druh === 'modelka' && radky.has(s.id) && (skryte || radky.get(s.id).vaha > 0)).map(s => radky.get(s.id));
    const podleKlice = new Map();
    skupiny.forEach(s => s.polozky.forEach(x => podleKlice.set(x.klic, { polozka: x, skupina: s })));
    const kKontrole = aktivnich(p.podezrele);
    return {
        skupiny, pocty, pokrok, uplnost, podleKlice, radkyModelek,
        alba: new Map([...radky].map(([id, r]) => [id, { popis: r.bezPopisu, vydani: r.bezVydani }])),
        modelekSChybou: [...radky.values()].filter(r => r.vaha > 0).length,
        // Vyřízené položky ve frontě (jen s „Vyřízené“, jinak je model nemá)
        vyrizenych: skupiny.reduce((soucet, s) => soucet + s.polozky.length - s.aktivnich, 0),
        kKontrole,
        navrhu: navrhy.filter(n => !n.odmitnuto).length,
        odmitnutych: navrhy.filter(n => n.odmitnuto).length,
    };
}

// Položky skupiny, které filtr (a zdroj) ukazuje
export function viditelnePolozky(skupina, { filtr = 'vse', zdroj = '' } = {}) {
    return skupina.polozky.filter(x => (filtr === 'vse' || x.filtr === filtr) && (!zdroj || x.zdroj === zdroj));
}

// Skupiny pro filtr, zdroj a hledání (jméno modelky nebo číslo; více slov zužuje); vrací [{ skupina, polozky, priorita }].
// Ve filtru se podle priority řadí jen podle položek, které filtr ukazuje (návrhy podle návrhů, ne podle titulní fotky).
export function filtrovatUdrzbu(model, { filtr = 'vse', zdroj = '', hledat = '', razeni = 'priorita' } = {}) {
    const slova = sjednotit(hledat).split(/\s+/).filter(Boolean);
    const vysledek = [];
    for (const skupina of model.skupiny) {
        if (slova.length && !slova.every(s => skupina.hledani.includes(s))) continue;
        const polozky = viditelnePolozky(skupina, { filtr, zdroj });
        if (!polozky.length) continue;
        const aktivni = polozky.filter(x => !x.netyka);
        const priorita = aktivni.length ? aktivni[0].priorita + 0.2 * aktivni.slice(1).reduce((soucet, x) => soucet + x.priorita, 0) : 0;
        vysledek.push({ skupina, polozky, priorita });
    }
    if (razeni === 'priorita' && (filtr !== 'vse' || zdroj)) vysledek.sort((a, b) => b.priorita - a.priorita);
    return vysledek;
}

// Hlavní akce položky slovy (tlačítko v řádku, nabídka)
export const textAkce = (x, s) => x.druh === 'navrh' ? 'Přijmout' : x.druh === 'kontrola' ? 'Opravit'
    : s.druh === 'vydani' ? (x.id === 'cover' ? 'Přidat cover' : 'Přidat centerfold') : 'Doplnit';

const velke = t => t.charAt(0).toUpperCase() + t.slice(1);
// Text štítku jedné položky v řádku fronty
export const textStitku = x => x.druh === 'navrh' ? `✦ ${velke(x.pole)}: ${x.hodnota} · ${procent(x.jistota)} %`
    : x.druh === 'kontrola' ? `⚠ ${x.hodnota}` : (x.souhrn || x.pole);

// Štítky sbaleného řádku, nejvýš tři: po druzích (nálezy, návrhy, chybějící) s počtem; druh s jedinou položkou
// (u nejvýš dvou druhů) a skupina s jedním druhem a nejvýš dvěma položkami ukáže položky samotné.
// Vrací [{ druh, text, polozka? }] – polozka je klíč, když štítek patří jedné položce.
/** @returns {{ druh: string, text: string, polozka?: string }[]} */
export function stitkySkupiny(polozky) {
    const aktivni = polozky.filter(x => !x.netyka);
    if (!aktivni.length) return polozky.length ? [{ druh: 'netyka', text: `${polozky.length} vyřízeno` }] : [];
    const druhy = /** @type {[string, any[]][]} */ (['kontrola', 'navrh', 'ukol'].map(d => [d, aktivni.filter(x => x.druh === d)])).filter(([, seznam]) => seznam.length);
    const jednotlive = druhy.length === 1 && aktivni.length <= 2;
    return druhy.flatMap(([druh, seznam]) => jednotlive || (seznam.length === 1 && druhy.length <= 2)
        ? seznam.map(x => /** @type {{ druh: string, text: string, polozka?: string }} */ ({ druh, text: textStitku(x), polozka: x.klic }))
        : [{ druh, text: druh === 'kontrola' ? `⚠ ${seznam.length} ke kontrole` : druh === 'navrh' ? `✦ ${sklonovat(seznam.length, 'návrh', 'návrhy', 'návrhů')}` : `${seznam.length} chybí` }]);
}

// Krátký souhrn skupiny do fronty „Na řadě“: „⚠ výška · ✦ národnost · 5 chybí“
export function souhrnFronty(polozky) {
    const aktivni = polozky.filter(x => !x.netyka);
    const pole = druh => [...new Set(aktivni.filter(x => x.druh === druh).map(x => x.pole))].join(', ');
    const ukoly = aktivni.filter(x => x.druh === 'ukol');
    return [pole('kontrola') && `⚠ ${pole('kontrola')}`, pole('navrh') && `✦ ${pole('navrh')}`,
        ukoly.length && (ukoly.length <= 2 ? ukoly.map(x => x.souhrn || x.pole).join(', ') : `${ukoly.length} chybí`)].filter(Boolean).join(' · ');
}

/**
 * Úkoly karty Po modelkách pro nevyřízené položky jedné skupiny, v pořadí priority. Chybějící údaje se rozpadnou
 * na jednotlivá pole; pole, pro které je návrh, se doplňuje návrhem. Druh úkolu: 'pole' (prázdné pole formuláře),
 * 'titulni' (odkaz na Disk), 'hodnoceni' (srdíčka), 'kontrola' a 'navrh' (s polem, když údaj jde upravit na místě),
 * 'okno' (album, cover, centerfold – otevře se okno). Jeden údaj má nejvýš jedno pole (další nález téhož údaje je bez něj).
 * @param {any[]} polozky položky skupiny (z filtrovatUdrzbu)
 * @param {(inputId: string) => string | undefined} vlastnostPole vlastnost modelky podle pole formuláře
 */
export function ukolyFokusu(polozky, vlastnostPole) {
    const aktivni = polozky.filter(x => !x.netyka);
    const sNavrhem = new Set(aktivni.filter(x => x.druh === 'navrh' && !x.navrh.album).map(x => x.navrh.inputId));
    const sPolem = new Set();
    const ukoly = [];
    // Údaj, který jde upravit na místě: pole formuláře s vlastností modelky, zatím bez pole v jiném úkolu
    const naMiste = (inputId, album) => {
        const vlastnost = !album && inputId && !sPolem.has(inputId) ? vlastnostPole(inputId) || '' : '';
        if (vlastnost) sPolem.add(inputId);
        return vlastnost ? { inputId, vlastnost } : { inputId: '', vlastnost: '' };
    };
    aktivni.forEach(x => {
        if (x.akce === 'udaje') {
            let prvni = true;
            x.chybejici.forEach(([vlastnost, popis, inputId]) => {
                if (sNavrhem.has(inputId) || sPolem.has(inputId)) return;
                sPolem.add(inputId);
                ukoly.push({ klic: `${x.klic}|${inputId}`, druh: 'pole', polozka: x, inputId, vlastnost, popis, prvniVeSkupine: prvni });
                prvni = false;
            });
        } else if (x.akce === 'titulni') {
            ukoly.push({ klic: x.klic, druh: 'titulni', polozka: x, ...naMiste('inputDriveID', ''), popis: 'titulní fotka' });
        } else if (x.akce === 'hodnoceni') {
            ukoly.push({ klic: x.klic, druh: 'hodnoceni', polozka: x, inputId: '', vlastnost: 'hodnoceni', popis: 'hodnocení' });
        } else if (x.druh === 'kontrola') {
            ukoly.push({ klic: x.klic, druh: 'kontrola', polozka: x, ...naMiste(x.nalez.pole, x.nalez.album), popis: x.pole });
        } else if (x.druh === 'navrh') {
            ukoly.push({ klic: x.klic, druh: 'navrh', polozka: x, ...naMiste(x.navrh.inputId, x.navrh.album), popis: x.pole });
        } else {
            ukoly.push({ klic: x.klic, druh: 'okno', polozka: x, inputId: '', vlastnost: '', popis: x.pole });
        }
    });
    return ukoly;
}

// ——— Po údajích: jeden údaj, všechny modelky (alba, čísla), kterým chybí ———

// Oblasti seznamu údajů vlevo
export const OBLASTI_UDAJU = [['kontrola', 'Ke kontrole'], ['udaje', 'Údaje modelek'], ['fotky', 'Fotky a alba'], ['cisla', 'Čísla']];
// Údaje v pevném pořadí podle toho, co sbírce přinesou nejvíc; pořadí se při práci nemění, aby seznam neskákal.
// druh: 'pole' (pole formuláře modelky, vlastnosti ze SKUPINY_UDAJU), 'kontrola', 'hodnoceni', 'titulni' (odkaz z Disku),
// 'vydaniAlba' (RRRR-MM), 'textAlba' (editor textu), 'okno' (centerfold, cover – otevře své okno), 'navrh' (jiné návrhy).
// Výška s váhou a obvody jdou spolu (míry se píšou dohromady, 34B-24-34). bez = „N modelek bez …“, jednotka = koho řádek je.
const MODELKY = ['modelka', 'modelky', 'modelek'];
const ALBA = ['album', 'alba', 'alb'];
const CISLA = ['číslo', 'čísla', 'čísel'];
export const UDAJE = [
    { klic: 'kontrola', oblast: 'kontrola', nazev: 'Ke kontrole', druh: 'kontrola', bez: 'ke kontrole', jednotka: ['nález', 'nálezy', 'nálezů'] },
    { klic: 'narozeniDatum', oblast: 'udaje', druh: 'pole', vlastnosti: ['narozeniDatum'], bez: 'bez data narození' },
    { klic: 'narodnost', oblast: 'udaje', druh: 'pole', vlastnosti: ['narodnost'], bez: 'bez národnosti' },
    { klic: 'narozeniMisto', oblast: 'udaje', druh: 'pole', vlastnosti: ['narozeniMisto'], bez: 'bez místa narození' },
    { klic: 'vyskaVaha', oblast: 'udaje', nazev: 'Výška a váha', druh: 'pole', vlastnosti: ['vyskaCm', 'vahaKg'], bez: 'bez výšky nebo váhy' },
    { klic: 'role', oblast: 'udaje', druh: 'pole', vlastnosti: ['role'], bez: 'bez kategorie' },
    { klic: 'etnicita', oblast: 'udaje', druh: 'pole', vlastnosti: ['etnicita'], bez: 'bez etnicity' },
    { klic: 'vlasyBarva', oblast: 'udaje', druh: 'pole', vlastnosti: ['vlasyBarva'], bez: 'bez barvy vlasů' },
    { klic: 'ociBarva', oblast: 'udaje', druh: 'pole', vlastnosti: ['ociBarva'], bez: 'bez barvy očí' },
    { klic: 'miry', oblast: 'udaje', nazev: 'Míry', druh: 'pole', vlastnosti: ['obvodHrudnikCm', 'obvodPasCm', 'obvodBokyCm'], bez: 'bez měr' },
    { klic: 'velikostPrsou', oblast: 'udaje', druh: 'pole', vlastnosti: ['velikostPrsou'], bez: 'bez velikosti prsou' },
    { klic: 'prsaTyp', oblast: 'udaje', druh: 'pole', vlastnosti: ['prsaTyp'], bez: 'bez typu prsou' },
    { klic: 'ochlupeni', oblast: 'udaje', druh: 'pole', vlastnosti: ['ochlupeni'], bez: 'bez údaje o ochlupení' },
    { klic: 'tetovani', oblast: 'udaje', druh: 'pole', vlastnosti: ['tetovani'], bez: 'bez údaje o tetování' },
    { klic: 'piercing', oblast: 'udaje', druh: 'pole', vlastnosti: ['piercing'], bez: 'bez údaje o piercingu' },
    { klic: 'tags', oblast: 'udaje', druh: 'pole', vlastnosti: ['tags'], bez: 'bez tagů' },
    { klic: 'hodnoceni', oblast: 'udaje', nazev: 'Hodnocení', druh: 'hodnoceni', bez: 'bez srdíček' },
    { klic: 'titulni', oblast: 'fotky', nazev: 'Titulní fotka', druh: 'titulni', bez: 'bez titulní fotky' },
    { klic: 'centerfold', oblast: 'fotky', nazev: 'Centerfold', druh: 'okno', bez: 'bez centerfoldu' },
    { klic: 'vydaniAlb', oblast: 'fotky', nazev: 'Vydání alb', druh: 'vydaniAlba', bez: 'bez čísla, ve kterém vyšla', jednotka: ALBA },
    { klic: 'textAlb', oblast: 'fotky', nazev: 'Texty alb', druh: 'textAlba', bez: 'bez průvodního textu', jednotka: ALBA },
    { klic: 'navrhyAlb', oblast: 'fotky', nazev: 'Další návrhy', druh: 'navrh', bez: 'k potvrzení (fotograf, datum alba…)', jednotka: ['návrh', 'návrhy', 'návrhů'] },
    { klic: 'cover', oblast: 'cisla', nazev: 'Cover', druh: 'okno', bez: 'bez obálky', jednotka: CISLA },
    { klic: 'cfcisla', oblast: 'cisla', nazev: 'Centerfold', druh: 'okno', bez: 'bez centerfoldu', jednotka: CISLA },
].map(u => {
    // Pole formuláře údaje ([vlastnost, popis, pole formuláře]) a název podle SKUPINY_UDAJU
    const pole = (u.vlastnosti || []).map(v => SKUPINY_UDAJU.flatMap(s => s.udaje).find(x => x[0] === v));
    return { jednotka: MODELKY, ...u, pole, nazev: u.nazev || velke(pole[0][1]) };
});
const UDAJ_VLASTNOSTI = new Map(UDAJE.flatMap(u => (u.vlastnosti || []).map(v => [v, u.klic])));
const UDAJ_POLE = new Map(UDAJE.flatMap(u => u.pole.map(p => [p[2], u.klic])));
const jeVydaniAlba = n => n.pole === 'vydani' || n.pole === 'vydaniAlba';

/**
 * Údaje pro „Po údajích“ z modelu Údržby (stejné položky, takže počty sedí s ostatními režimy). Řádek je modelka
 * (u alb album, u čísel číslo, u kontroly nález) s tím, co mu u údaje chybí, a návrhy pro jeho pole. Vyřízené
 * položky („netýká se“, odmítnuté) se přeskakují. Řádky jdou v pořadí fronty (priorita), prázdné údaje se vynechají.
 * Vrací { oblasti: [{ klic, nazev, udaje }], udaje: Map(klíč → údaj s radky, pocet, navrhu) }.
 */
export function sestavitPoUdajich(model) {
    const radky = new Map(UDAJE.map(u => [u.klic, []]));
    for (const s of model.skupiny) {
        const uSkupiny = new Map(); // řádek údaje u této skupiny (alba podle názvu)
        const radek = (udaj, klic, dalsi) => {
            const k = `${udaj}|${s.klic}${klic ? `|${klic}` : ''}`;
            if (!uSkupiny.has(k)) {
                const r = { klic: k, udaj, skupina: s, chybejici: [], navrhy: [], ...dalsi };
                uSkupiny.set(k, r);
                radky.get(udaj).push(r);
            }
            return uSkupiny.get(k);
        };
        const aktivni = s.polozky.filter(x => !x.netyka);
        for (const x of aktivni) {
            if (x.akce === 'udaje') {
                x.chybejici.forEach(u => {
                    const udaj = UDAJ_VLASTNOSTI.get(u[0]);
                    if (udaj) radek(udaj, '', { polozka: x }).chybejici.push(u);
                });
            } else if (x.druh === 'kontrola') radek('kontrola', x.id, { polozka: x, nalez: x.nalez });
            else if (s.druh === 'vydani') radek(x.filtr === 'cover' ? 'cover' : 'cfcisla', '', { polozka: x });
            else if (x.akce === 'titulni' || x.akce === 'centerfold' || x.akce === 'hodnoceni') radek(x.akce, '', { polozka: x });
            else if (x.akce === 'popis' || x.akce === 'vydani') {
                x.alba.filter(a => !a.netykaSe).forEach(a => radek(x.akce === 'popis' ? 'textAlb' : 'vydaniAlb', `${a.album}|${a.typ}`, { polozka: x, album: a }));
            }
        }
        // Návrh patří k řádku svého pole (u kategorie, která se k zapsaným přidává, i když údaj nechybí),
        // vydání alba k řádku alba, ostatní (fotograf, datum alba) do Dalších návrhů
        aktivni.filter(x => x.druh === 'navrh').forEach(x => {
            const n = x.navrh;
            const udaj = !n.album && UDAJ_POLE.get(n.inputId);
            if (udaj) radek(udaj, '', { polozka: x }).navrhy.push(x);
            else if (n.album && jeVydaniAlba(n)) radek('vydaniAlb', `${n.album}|${n.typ}`, { polozka: x, album: { modelkaId: n.modelkaId, jmeno: n.jmeno, album: n.album, typ: n.typ } }).navrhy.push(x);
            else radek('navrhyAlb', x.id, { polozka: x }).navrhy.push(x);
        });
    }
    const udaje = new Map(UDAJE.map(u => {
        const r = radky.get(u.klic);
        return [u.klic, { ...u, radky: r, pocet: r.length, navrhu: r.reduce((soucet, x) => soucet + x.navrhy.length, 0) }];
    }));
    const oblasti = OBLASTI_UDAJU.map(([klic, nazev]) => ({ klic, nazev, udaje: [...udaje.values()].filter(u => u.oblast === klic && u.pocet) })).filter(o => o.udaje.length);
    return { oblasti, udaje };
}

// Název Ke kontrole podle polí nálezů („⚠ Výška, věk, míry“); víc než tři pole jen počtem
export function nazevKontroly(udaj) {
    const pole = [...new Set(udaj.radky.map(r => r.polozka.pole))];
    return pole.length && pole.length <= 3 ? velke(pole.join(', ')) : udaj.nazev;
}

// Další řádek po `od` ve směru `smer`, který ještě není hotový (uložený, odložený); '' když už žádný není
export function dalsiRadek(klice, hotove, od, smer = 1) {
    for (let i = klice.indexOf(od) + smer; i >= 0 && i < klice.length; i += smer) {
        if (!hotove.has(klice[i])) return klice[i];
    }
    return '';
}

// První údaj seznamu, který má co doplnit (výchozí výběr, když zvolený údaj zmizel); '' když nic
export const prvniUdaj = poUdajich => poUdajich.oblasti[0]?.udaje[0]?.klic || '';

// Filtr Údržby na úvodu Přehledu („Co zbývá doplnit“) → údaj v Po údajích
const UDAJ_FILTRU = { titulni: 'titulni', centerfold: 'centerfold', hodnoceni: 'hodnoceni', text: 'textAlb', alba: 'vydaniAlb', cover: 'cover', cfcisla: 'cfcisla', kontrola: 'kontrola' };
export function udajFiltru(poUdajich, filtr) {
    const zname = (klic) => poUdajich.udaje.get(klic)?.pocet ? klic : '';
    if (UDAJ_FILTRU[filtr]) return zname(UDAJ_FILTRU[filtr]);
    const vOblasti = [...poUdajich.udaje.values()].filter(u => u.pocet && (filtr === 'udaje' ? u.oblast === 'udaje' && u.druh === 'pole' : filtr === 'navrhy' ? u.navrhu : false));
    // Návrhy: údaj s nejvíc návrhy
    if (filtr === 'navrhy') vOblasti.sort((a, b) => b.navrhu - a.navrhu);
    return vOblasti[0]?.klic || '';
}

// Zdroje položek ve filtru (návrhy, nálezy kontroly): [{ zdroj, popis, pocet }] od nejčastějšího
export function zdrojePolozek(model, filtr) {
    const zdroje = new Map();
    model.skupiny.forEach(s => s.polozky.forEach(x => {
        if (x.netyka || x.filtr !== filtr || !x.zdroj) return;
        const z = zdroje.get(x.zdroj) || { zdroj: x.zdroj, popis: x.zdrojPopis || x.zdroj, pocet: 0 };
        z.pocet++;
        zdroje.set(x.zdroj, z);
    }));
    return [...zdroje.values()].sort((a, b) => b.pocet - a.pocet || a.popis.localeCompare(b.popis, 'cs'));
}
