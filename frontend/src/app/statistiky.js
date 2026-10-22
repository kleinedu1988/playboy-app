// Statistiky sbírky v Přehledu: jeden graf vybraný z rozvinutého seznamu, vedle něj modelky výběru.
// Grafy v čase (podle roku prvního výskytu v časopise nebo měsíce přidání) ukazují počty, údaje (medián a pásmo) nebo podíly
// a přes ně křivku klouzavého průměru; klik na sloupec vybere rok, tažení období. Grafy rozložení (kategorie,
// národnosti…) jsou pruhy; klik vybere hodnotu. Výběr platí pro všechny grafy (zužuje je), seznam vpravo
// ukazuje jeho modelky (bez výběru všechny v grafu).
// Počítá se ze seznamu modelek; nejčastější fotografové jsou z backendu (GetStatistiky) a jejich modelky se
// dohledají hledáním. SVG grafSloupcu zůstává pro úvod Přehledu.
import { GetModelky, GetStatistiky } from './backend';
import { EDICE, MESICE, VYSKYT, ZKRATKY_PASKY, esc, kategorieModelky, nazevVydani, rozlozitVydani, sjednotit, sklonovat, vyskytModelky } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { otevritDetailModelky } from './profil';
import { hledatHodnotu } from './galerie';

const BARVA = '#d81b60';

const cislo = (n, desetinna = 1) => Number(n.toFixed(desetinna)).toLocaleString('cs-CZ', { maximumFractionDigits: desetinna });
const pocetModelek = n => sklonovat(n, 'modelka', 'modelky', 'modelek');

// Zaoblený jen horní konec sloupce (4 px), dno sedí na ose
const sloupec = (x, y, sirka, vyska) => vyska <= 0 ? ''
    : `M${x},${y + vyska} V${y + Math.min(4, vyska)} q0,-${Math.min(4, vyska)} ${Math.min(4, sirka / 2)},-${Math.min(4, vyska)} h${sirka - 2 * Math.min(4, sirka / 2)} q${Math.min(4, sirka / 2)},0 ${Math.min(4, sirka / 2)},${Math.min(4, vyska)} V${y + vyska}Z`;

// Svislé sloupce jedné řady v SVG (úvod Přehledu); popisek hodnoty jen u maxima, ostatní v bublině
export function grafSloupcu(polozky, { sirka = 460, vyska = 190 } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.hodnota));
    const dole = 22, nahore = 16, krok = sirka / polozky.length, sl = Math.min(30, krok * 0.58);
    const vyskaPlochy = vyska - dole - nahore;
    const mrizka = [0.5, 1].map(f => `<line class="graf-mrizka" x1="0" x2="${sirka}" y1="${nahore + vyskaPlochy * (1 - f)}" y2="${nahore + vyskaPlochy * (1 - f)}"/>`).join('');
    return `<svg class="graf" viewBox="0 0 ${sirka} ${vyska}" role="img">${mrizka}
        <line class="graf-osa" x1="0" x2="${sirka}" y1="${vyska - dole}" y2="${vyska - dole}"/>
        ${polozky.map((p, i) => {
            const v = vyskaPlochy * p.hodnota / max, x = i * krok + (krok - sl) / 2, y = vyska - dole - v;
            return `<g data-tip="${esc(p.tip)}">
                <rect class="graf-cil" x="${i * krok}" y="0" width="${krok}" height="${vyska}"/>
                <path d="${sloupec(x, y, sl, v)}" fill="${BARVA}"/>
                ${p.hodnota === max && p.hodnota ? `<text class="graf-hodnota" x="${x + sl / 2}" y="${y - 6}" text-anchor="middle">${p.hodnota}</text>` : ''}
                <text class="graf-popisek" x="${x + sl / 2}" y="${vyska - 6}" text-anchor="middle">${esc(p.popisek)}</text>
            </g>`;
        }).join('')}</svg>`;
}

// Nabídka grafů. V čase: osa „rok“ (rok prvního výskytu modelky v časopise – centerfold, obálka nebo pictorial
// u čísla – ve zvolené edici a druhu výskytu) nebo „mesic“ (měsíc přidání do sbírky);
// druh pocet (sloupce počtů), udaj (medián a prostřední polovina modelek) nebo podil (procento modelek s vlastností
// ze známých hodnot). Rozložení: pruhy hodnot.
const anoNe = h => h === 1 ? true : h === 0 ? false : null;
const zHodnot = (text, ano, ne) => {
    const t = String(text || '').trim();
    return ano.includes(t) ? true : ne.includes(t) ? false : null;
};
const GRAFY = [
    { klic: 'cf', skupina: 'pocty', osa: 'rok', druh: 'pocet', nazev: 'Modelky podle roku' },
    { klic: 'prib', skupina: 'pocty', osa: 'mesic', druh: 'pocet', nazev: 'Přibývání sbírky' },
    { klic: 'vek', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Věk při prvním výskytu', jednotka: 'let' },
    { klic: 'vyska', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Výška', jednotka: 'cm', udaj: m => m.vyskaCm || null },
    { klic: 'vaha', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Váha', jednotka: 'kg', udaj: m => m.vahaKg || null },
    { klic: 'bmi', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'BMI', jednotka: 'kg/m²',
        udaj: m => m.vyskaCm > 0 && m.vahaKg > 0 ? m.vahaKg / (m.vyskaCm / 100) ** 2 : null },
    { klic: 'hrudnik', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Obvod hrudníku', jednotka: 'cm', udaj: m => m.obvodHrudnikCm || null },
    { klic: 'pas', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Obvod pasu', jednotka: 'cm', udaj: m => m.obvodPasCm || null },
    { klic: 'boky', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Obvod boků', jednotka: 'cm', udaj: m => m.obvodBokyCm || null },
    { klic: 'whr', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Poměr pas : boky', jednotka: '', desetinna: 2,
        udaj: m => m.obvodPasCm > 0 && m.obvodBokyCm > 0 ? m.obvodPasCm / m.obvodBokyCm : null },
    { klic: 'blond', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Blond vlasy', ano: 'blond', ne: 'jiné vlasy',
        podil: m => String(m.vlasyBarva || '').trim() ? /blond|plav/.test(sjednotit(m.vlasyBarva)) : null },
    { klic: 'silikon', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Silikonová prsa', ano: 'silikonová', ne: 'přírodní',
        podil: m => zHodnot(m.prsaTyp, ['Silikonová'], ['Přírodní']) },
    { klic: 'oholene', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Oholené ochlupení', ano: 'oholené', ne: 'přírodní nebo zastřižené',
        podil: m => zHodnot(m.ochlupeni, ['Oholené'], ['Přírodní', 'Zastřižené']) },
    { klic: 'tetovani', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Tetování', ano: 's tetováním', ne: 'bez tetování', podil: m => anoNe(m.tetovani) },
    { klic: 'piercing', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Piercing', ano: 's piercingem', ne: 'bez piercingu', podil: m => anoNe(m.piercing) },
    { klic: 'kat', skupina: 'rozl', nazev: 'Kategorie' },
    { klic: 'nar', skupina: 'rozl', nazev: 'Národnosti' },
    { klic: 'vlasy', skupina: 'rozl', nazev: 'Barva vlasů' },
    { klic: 'oci', skupina: 'rozl', nazev: 'Barva očí' },
    { klic: 'srd', skupina: 'rozl', nazev: 'Hodnocení' },
    { klic: 'vyskyt', skupina: 'rozl', nazev: 'Výskyt (časopis / online)' },
    { klic: 'fot', skupina: 'rozl', nazev: 'Fotografové' },
];
const SKUPINY = { pocty: 'V čase · počty', udaje: 'V čase · údaje', podily: 'V čase · podíly', rozl: 'Rozložení' };

// Stav: vybraný graf (pamatuje se), edice a druh výskytu a výběr. Výběr jsou podmínky (klíč → { popis, test, dotaz,
// ... }) společné všem grafům: rok prvního výskytu („rok“, sdílí ho všechny grafy s osou roků), měsíc přidání
// („mesic“) a hodnota grafu rozložení (klíč grafu). Graf ukazuje jasně modelky vyhovující ostatním podmínkám,
// tlumeně celou sbírku; vlastní podmínka grafu je v něm zvýrazněná.
let data = null;                 // { s, modelky, fotografove: Map(nazev → Set id modelek) }
let graf = 'cf';
try { graf = GRAFY.some(g => g.klic === localStorage.getItem('grafStatistik')) ? localStorage.getItem('grafStatistik') : 'cf'; } catch { /* výchozí graf */ }
let edice = 'vse';
let druhVyskytu = 'vse';
const DRUHY_VYSKYTU = { vse: 'Vše', centerfold: 'Centerfold', obalka: 'Obálka', pictorial: 'Pictorial' };
const filtry = new Map();
let zobrazitVse = false;
let tah = null;                  // tažení přes sloupce: { start, predtim, a, b }
let posledniKonec = 'b';         // konec výběru, kterým naposledy hýbaly šipky se Shiftem
const ZOBRAZIT_NAJEDNOU = 60;

const definice = () => GRAFY.find(g => g.klic === graf);
const klicFiltru = def => def.osa || def.klic;
const vyhovuje = (m, krome = '') => [...filtry].every(([k, f]) => k === krome || f.test(m));

// Věk modelky v čísle (z roku a měsíce narození a vydání); null, když chybí nebo nedává smysl
const vekVLetech = (narozeni, vydani) => {
    const n = /^(\d{4})-(\d{2})/.exec(narozeni || ''), v = /^(\d{4})-(\d{2})/.exec(vydani || '');
    if (!n || !v) return null;
    const vek = parseInt(v[1]) - parseInt(n[1]) - (parseInt(v[2]) < parseInt(n[2]) ? 1 : 0);
    return vek > 12 && vek < 80 ? vek : null;
};
// Výskyty modelky v časopise (čísla jejích centerfoldů, obálek a alb) s rokem, edicí, druhy a věkem modelky
const vyskytyCache = new WeakMap();
function vyskytyModelky(m) {
    if (!vyskytyCache.has(m)) {
        const cf = new Set(m.centerfoldy || []), obalky = new Set(m.obalky || []);
        vyskytyCache.set(m, [...new Set([...(m.vydani || []), ...cf, ...obalky])].sort().map(v => {
            const casti = rozlozitVydani(v);
            if (!casti) return null;
            const druhy = new Set([cf.has(v) && 'centerfold', obalky.has(v) && 'obalka', !cf.has(v) && !obalky.has(v) && 'pictorial'].filter(Boolean));
            return { v, edice: casti.edice, rok: parseInt(casti.rok), druhy, vekPresne: vekVLetech(m.narozeniDatum, v) };
        }).filter(Boolean));
    }
    return vyskytyCache.get(m);
}
// První výskyt ve zvolené edici a druhu (nebo v těch, které platily při vzniku podmínky)
const prvniVyskyt = (m, ed = edice, druh = druhVyskytu) => vyskytyModelky(m)
    .find(c => (ed === 'vse' || c.edice === ed) && (druh === 'vse' || c.druhy.has(druh)));
const popisVyskytu = (druh = druhVyskytu) => druh === 'vse' ? 'první výskyt' : `první ${DRUHY_VYSKYTU[druh].toLowerCase()}`;
const median = cisla => {
    const s = [...cisla].sort((a, b) => a - b), p = Math.floor(s.length / 2);
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
};

// Graf v čase: sloupce [{ popisek, nazev, rok | mesic, polozky: [{ m, c?, hodnota? }] }]
function radaVCase(def) {
    if (def.osa === 'mesic') {
        const dnes = new Date();
        return Array.from({ length: 24 }, (_, i) => {
            const d = new Date(dnes.getFullYear(), dnes.getMonth() - 23 + i, 1);
            const mesic = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return { popisek: d.getMonth() ? ZKRATKY_PASKY[d.getMonth()] : String(d.getFullYear()), nazev: `${MESICE[d.getMonth()]} ${d.getFullYear()}`, mesic,
                polozky: data.modelky.filter(m => (m.pridano || '').startsWith(mesic)).map(m => ({ m })) };
        });
    }
    // Každá modelka jednou, v roce prvního výskytu (zvolená edice a druh); věk je věk v tom čísle
    const polozky = data.modelky.flatMap(m => {
        const c = prvniVyskyt(m);
        if (!c) return [];
        const hodnota = def.druh === 'pocet' ? true : def.klic === 'vek' ? c.vekPresne : def.druh === 'udaj' ? def.udaj(m) : def.podil(m);
        return hodnota === null ? [] : [{ m, c, hodnota }];
    });
    if (!polozky.length) return [];
    const roky = polozky.map(p => p.c.rok);
    const od = Math.min(...roky), doRoku = Math.max(...roky);
    const sloupce = Array.from({ length: doRoku - od + 1 }, (_, i) => ({ popisek: String(od + i), nazev: String(od + i), rok: od + i, polozky: [] }));
    polozky.forEach(p => sloupce[p.c.rok - od].polozky.push(p));
    return sloupce;
}

// Kvantil seřazených hodnot s lineární interpolací (q 0–1)
const kvantil = (serazene, q) => {
    const poz = q * (serazene.length - 1), dolni = Math.floor(poz);
    return serazene[dolni] + ((serazene[Math.ceil(poz)] ?? serazene[dolni]) - serazene[dolni]) * (poz - dolni);
};
// Údaj ve skupině položek: medián a prostřední polovina modelek (null bez hodnot)
const rozsahHodnot = polozky => {
    if (!polozky.length) return null;
    const h = polozky.map(p => p.hodnota).sort((a, b) => a - b);
    return { median: kvantil(h, 0.5), dolni: kvantil(h, 0.25), horni: kvantil(h, 0.75) };
};
// Hodnota sloupce podle druhu grafu: počet, medián (s pásmem) nebo procento (null, když nejsou data)
function hodnotaSloupce(def, polozky) {
    if (def.druh === 'pocet') return polozky.length;
    if (def.druh === 'podil') return polozky.length ? polozky.filter(p => p.hodnota).length / polozky.length * 100 : null;
    return rozsahHodnot(polozky)?.median ?? null;
}

// Křivka přes okno ±polomer sloupců: průměr počtů, podíl ze všech modelek okna, u údaje průměr mediánů
// sloupců vážený počtem modelek; u podílu a údaje jen z aspoň tří modelek
function krivka(def, skupiny, polomer) {
    return skupiny.map((_, i) => {
        const okno = skupiny.slice(Math.max(0, i - polomer), i + polomer + 1);
        const n = okno.reduce((s, x) => s + x.length, 0);
        if (def.druh === 'pocet') return n / okno.length;
        if (n < 3) return null;
        if (def.druh === 'podil') return okno.reduce((s, x) => s + x.filter(p => p.hodnota).length, 0) / n * 100;
        return okno.reduce((s, x) => s + (x.length ? rozsahHodnot(x).median * x.length : 0), 0) / n;
    });
}

// „Hezký“ krok osy (1, 2, 2,5, 5 × 10^k), aby na ose bylo asi čtyři až pět čar
const krokOsy = rozpeti => {
    const rad = 10 ** Math.floor(Math.log10(rozpeti / 4 || 1));
    return [1, 2, 2.5, 5, 10].map(k => k * rad).find(k => rozpeti / k <= 5);
};
const textHodnoty = (def, h) => def.druh === 'podil' ? `${Math.round(h)} %` : `${cislo(h, def.desetinna ?? 1)}${def.jednotka ? ` ${def.jednotka}` : ''}`;

// Rozsah vlastní podmínky grafu v čase jako indexy sloupců (při tažení dočasný)
function rozsahVyberu(def, sloupce) {
    if (tah) return { a: Math.min(tah.a, tah.b), b: Math.max(tah.a, tah.b) };
    const f = filtry.get(klicFiltru(def));
    if (!f || !sloupce.length) return null;
    const index = hodnota => sloupce.findIndex(s => (def.osa === 'rok' ? s.rok : s.mesic) === hodnota);
    const a = index(f.od), b = index(f.do);
    if (a >= 0 && b >= 0) return { a, b };
    // Rok mimo osu (jiná edice): výběr se oseká na sloupce, které graf má
    if (def.osa === 'rok') {
        const a2 = sloupce.findIndex(s => s.rok >= f.od), b2 = sloupce.findLastIndex(s => s.rok <= f.do);
        return a2 >= 0 && b2 >= a2 ? { a: a2, b: b2 } : null;
    }
    return null;
}

// Graf v čase jako SVG v přesné šířce karty (písmo zůstává stejně velké); neviditelné cíle nesou bublinu a index.
// Při výběru z jiných grafů: jasně modelky výběru, tlumeně celá sbírka a její křivka čárkovaně.
function htmlGrafuVCase(def, sloupce, sirka) {
    if (!sloupce.length) return `<p class="stat-prazdne">${def.druh === 'pocet' ? 'Zatím žádná data.' : `Údaj „${def.nazev.toLowerCase()}“ zatím u modelek s výskytem v časopise chybí.`}</p>`;
    const zuzeno = [...filtry.keys()].some(k => k !== klicFiltru(def));
    const vybrane = sloupce.map(s => zuzeno ? s.polozky.filter(p => vyhovuje(p.m, klicFiltru(def))) : s.polozky);
    const W = Math.max(320, sirka), H = 360, L = 46, P = 10, T = 14, D = 26;
    const k = (W - L - P) / sloupce.length;
    const polomer = def.osa === 'mesic' ? 1 : 3;
    const cara = sloupce.length >= 5 ? krivka(def, vybrane, polomer) : [];
    const caraCelku = zuzeno && sloupce.length >= 5 ? krivka(def, sloupce.map(s => s.polozky), polomer) : [];
    let lo = 0, hi = 100;
    if (def.druh === 'pocet') hi = Math.max(1, ...sloupce.map(s => s.polozky.length));
    else if (def.druh === 'udaj') {
        const rozsahy = [...sloupce.map(s => rozsahHodnot(s.polozky)), ...vybrane.map(rozsahHodnot)].filter(Boolean);
        const min = Math.min(...rozsahy.map(r => r.dolni)), max = Math.max(...rozsahy.map(r => r.horni)), okraj = (max - min) * 0.1 || 1;
        lo = min - okraj;
        hi = max + okraj;
    }
    // Počty jsou celá čísla: krok osy nejméně 1
    const krok = def.druh === 'podil' ? 25 : def.druh === 'pocet' ? Math.max(1, krokOsy(hi - lo)) : krokOsy(hi - lo);
    if (def.druh === 'pocet') hi = Math.ceil(hi / krok) * krok;
    const y = h => T + (hi - h) / (hi - lo || 1) * (H - T - D);
    const x = i => L + i * k;
    const rozsah = rozsahVyberu(def, sloupce);
    const mimo = i => rozsah && (i < rozsah.a || i > rozsah.b);
    const casti = [];
    for (let h = Math.ceil(lo / krok - 1e-9) * krok; h <= hi + 1e-9; h += krok) {
        casti.push(`<line class="${h === 0 ? 'graf-osa' : 'graf-mrizka'}" x1="${L}" x2="${W - P}" y1="${y(h)}" y2="${y(h)}"/><text class="graf-popisek" x="${L - 8}" y="${y(h) + 4}" text-anchor="end">${def.druh === 'podil' ? `${h} %` : cislo(h, krok < 0.1 ? 2 : krok < 1 ? 1 : 0)}</text>`);
    }
    if (rozsah) casti.push(`<rect class="sp-oblast" x="${x(rozsah.a)}" y="${T}" width="${(rozsah.b - rozsah.a + 1) * k}" height="${H - T - D}" rx="4"/>`);
    // Popisky osy x tak, aby mezi nimi bylo aspoň 38 px; roky na kulatých číslech
    const kazdy = [1, 2, 5, 10, 20, 50].find(n => n * k >= 38) || 50;
    const sl = Math.max(1, k - (k > 8 ? 2 : 1));
    sloupce.forEach((s, i) => {
        const ukazat = def.osa === 'mesic' ? i % kazdy === 0 || !ZKRATKY_PASKY.includes(s.popisek) : s.rok % kazdy === 0;
        if (ukazat) casti.push(`<text class="graf-popisek" x="${x(i) + k / 2}" y="${H - 8}" text-anchor="middle">${esc(s.popisek)}</text>`);
        const tlum = mimo(i) ? 'tlum' : '';
        if (def.druh === 'udaj') {
            // Svislý pruh prostřední poloviny modelek a bod mediánu roku
            const r = rozsahHodnot(vybrane[i]), sirkaPasma = Math.max(2, Math.min(10, k - 2));
            if (!r) return;
            casti.push(`<rect class="sp-pasmo ${tlum}" x="${x(i) + (k - sirkaPasma) / 2}" y="${y(r.horni)}" width="${sirkaPasma}" height="${Math.max(2, y(r.dolni) - y(r.horni))}" rx="${Math.min(3, sirkaPasma / 2)}"/>`);
            casti.push(`<circle class="sp-bod ${tlum}" cx="${x(i) + k / 2}" cy="${y(r.median)}" r="${Math.min(3.5, Math.max(2, k / 3))}" fill="${BARVA}"/>`);
            return;
        }
        const celek = hodnotaSloupce(def, s.polozky), vyber = hodnotaSloupce(def, vybrane[i]);
        if (zuzeno && celek) casti.push(`<path class="sp-sloupec celek" d="${sloupec(x(i) + (k - sl) / 2, y(celek), sl, y(0) - y(celek))}"/>`);
        if (vyber) casti.push(`<path class="sp-sloupec ${tlum}" d="${sloupec(x(i) + (k - sl) / 2, y(vyber), sl, y(0) - y(vyber))}" fill="${BARVA}"/>`);
    });
    // Křivka se přeruší tam, kde nejsou data
    const lomena = (rada, trida) => rada.map((v, i) => v === null ? null : `${x(i) + k / 2},${y(v)}`)
        .reduce((u, b) => { if (b) u.at(-1).push(b); else if (u.at(-1).length) u.push([]); return u; }, [[]])
        .filter(u => u.length > 1).map(u => `<polyline class="${trida}" points="${u.join(' ')}"/>`).join('');
    casti.push(lomena(caraCelku, 'sp-krivka celek'), lomena(cara, 'sp-krivka'));
    sloupce.forEach((s, i) => {
        const p = vybrane[i], n = p.length, h = hodnotaSloupce(def, p);
        const kolik = def.druh === 'pocet' ? (def.osa === 'mesic' ? `${pocetModelek(n)} přidáno` : pocetModelek(n))
            : h === null ? 'bez údaje'
            : def.druh === 'podil' ? `${def.ano} ${Math.round(h)} % (${p.filter(x => x.hodnota).length} z ${n})`
            : `medián ${textHodnoty(def, h)}, polovina modelek ${textHodnoty(def, rozsahHodnot(p).dolni)}–${textHodnoty(def, rozsahHodnot(p).horni)} · ${pocetModelek(n)}`;
        const celkem = zuzeno && def.druh === 'pocet' ? ` z ${s.polozky.length}` : '';
        casti.push(`<rect class="graf-cil" data-i="${i}" data-tip="${esc(`${s.nazev}: ${kolik}${celkem}`)}" x="${x(i)}" y="0" width="${k}" height="${H}"/>`);
    });
    return `<svg class="sp-svg" width="${W}" height="${H}" role="img" aria-label="${esc(def.nazev)}">${casti.join('')}</svg>`;
}

// Graf rozložení: položky { hodnota, nazev, test, dotaz } s počtem modelek v celé sbírce a ve výběru
function polozkyRozlozeni(klic) {
    const { modelky } = data;
    const podleUdaje = (hodnota, dotaz) => {
        const skupiny = new Map();
        modelky.forEach(m => {
            const h = String(hodnota(m) || '').trim();
            if (!h) return;
            const k = sjednotit(h);
            if (!skupiny.has(k)) skupiny.set(k, { hodnota: k, nazev: h, test: m2 => sjednotit(String(hodnota(m2) || '').trim()) === k, dotaz: `${dotaz}:"${h}"` });
        });
        return [...skupiny.values()];
    };
    let polozky = [], seradit = true;
    if (klic === 'kat') {
        const nazvy = new Set(modelky.flatMap(m => kategorieModelky(m).map(k => k.nazev)));
        polozky = [...nazvy].map(n => ({ hodnota: n, nazev: n, test: m => kategorieModelky(m).some(k => k.nazev === n), dotaz: `kategorie:"${n.toLowerCase()}"` }));
    } else if (klic === 'nar') polozky = podleUdaje(m => m.narodnost, 'narodnost');
    else if (klic === 'vlasy') polozky = podleUdaje(m => m.vlasyBarva, 'vlasy');
    else if (klic === 'oci') polozky = podleUdaje(m => m.ociBarva, 'oci');
    else if (klic === 'srd') {
        seradit = false;
        polozky = [5, 4, 3, 2, 1, 0].map(n => ({ hodnota: String(n), nazev: n ? '♥'.repeat(n) : 'Bez hodnocení', test: m => (m.hodnoceni || 0) === n, dotaz: n ? `hodnoceni:${n}` : null }));
    } else if (klic === 'vyskyt') {
        seradit = false;
        polozky = Object.entries(VYSKYT).map(([k, nazev]) => ({ hodnota: k || 'neurceno', nazev, test: m => vyskytModelky(m) === k, dotaz: `vyskyt:${k || 'neurceno'}` }));
    } else if (klic === 'fot') {
        polozky = data.s.fotografove.filter(f => data.fotografove.has(f.nazev)).map(f => ({ hodnota: f.nazev, nazev: f.nazev,
            test: m => data.fotografove.get(f.nazev).has(m.id), dotaz: `fotograf:"${f.nazev}"` }));
    }
    const vybrane = modelky.filter(m => vyhovuje(m, klic));
    const spocitane = polozky.map(p => ({ ...p, pocet: modelky.filter(p.test).length, vybrano: vybrane.filter(p.test).length })).filter(p => p.pocet);
    return seradit ? spocitane.sort((a, b) => b.pocet - a.pocet || a.nazev.localeCompare(b.nazev, 'cs')).slice(0, 15) : spocitane;
}

function htmlPruhu(def, polozky) {
    if (!polozky.length) return `<p class="stat-prazdne">${graf === 'fot' && !data.fotografove.size ? 'Počítám fotografy…' : 'Zatím žádná data.'}</p>`;
    const zuzeno = [...filtry.keys()].some(k => k !== def.klic);
    const vlastni = filtry.get(def.klic)?.hodnota;
    const max = Math.max(1, ...polozky.map(p => p.pocet));
    return `<div class="sp-pruhy">${polozky.map(p => {
        const zapnuty = vlastni === p.hodnota;
        return `<button type="button" class="sp-pruh ${zapnuty ? 'vybrany' : vlastni !== undefined ? 'tlum' : ''}" data-hodnota="${esc(p.hodnota)}" aria-pressed="${zapnuty}"
            data-tip="${esc(`${p.nazev}: ${zuzeno ? `${p.vybrano} z ${pocetModelek(p.pocet)}` : pocetModelek(p.pocet)}`)}">
            <span class="sp-nazev">${esc(p.nazev)}</span>
            <span class="sp-draha">${zuzeno ? `<i class="celek" style="width:${p.pocet / max * 100}%"></i>` : ''}<i style="width:${(zuzeno ? p.vybrano : p.pocet) / max * 100}%"></i></span>
            <span class="sp-pocet">${zuzeno ? `${p.vybrano} / ${p.pocet}` : p.pocet}</span>
        </button>`;
    }).join('')}</div>`;
}

// Modelky výběru: [{ m, detail }] bez opakování; u grafu v čase z vybraných sloupců (bez výběru ze všech)
function modelkyVyberu(def, sloupce) {
    if (!def.osa) {
        const seznam = data.modelky.filter(m => vyhovuje(m))
            .sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || a.jmeno.localeCompare(b.jmeno, 'cs'))
            .map(m => ({ m, detail: kategorieModelky(m).filter(k => !k.odvozena).map(k => k.nazev)[0] || '' }));
        return seznam;
    }
    const rozsah = rozsahVyberu(def, sloupce);
    const videne = new Set();
    const seznam = sloupce.slice(rozsah?.a ?? 0, (rozsah?.b ?? sloupce.length - 1) + 1).flatMap(s => s.polozky)
        .filter(p => vyhovuje(p.m, klicFiltru(def)) && !videne.has(p.m.id) && videne.add(p.m.id)).map(p => ({
            m: p.m,
            detail: def.osa === 'mesic' ? `přidána ${parseInt(p.m.pridano.slice(8, 10))}. ${parseInt(p.m.pridano.slice(5, 7))}. ${p.m.pridano.slice(0, 4)}`
                : def.druh === 'udaj' ? `${textHodnoty(def, p.hodnota)} · ${nazevVydani(p.c.v)}`
                : def.druh === 'podil' ? `${p.hodnota ? def.ano : def.ne} · ${nazevVydani(p.c.v)}` : nazevVydani(p.c.v),
        }));
    return def.osa === 'mesic' ? seznam.reverse() : seznam;
}

function htmlSeznamu(def, sloupce) {
    const seznam = modelkyVyberu(def, sloupce);
    const ukazat = zobrazitVse ? seznam : seznam.slice(0, ZOBRAZIT_NAJEDNOU);
    const nadpis = filtry.size ? 'Modelky výběru' : def.osa === 'mesic' ? 'Přidané za dva roky' : def.osa ? 'Celé období' : 'Všechny modelky';
    const dotazy = [...filtry.values()].map(f => f.dotaz);
    const dotaz = filtry.size && dotazy.every(Boolean) ? dotazy.join(' ') : '';
    return `<div class="sp-seznam-hlava"><b>${nadpis}</b><span>${pocetModelek(seznam.length)}</span></div>
        ${seznam.length ? `<div class="sp-modelky">${ukazat.map(({ m, detail }) => `
            <button type="button" class="sp-modelka" data-modelka-vyberu="${m.id}">
                <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
                <span>${esc(m.jmeno)}<small>${esc(detail)}</small></span>
                ${m.hodnoceni ? `<i>${'♥'.repeat(m.hodnoceni)}</i>` : ''}
            </button>`).join('')}
            ${ukazat.length < seznam.length ? `<button type="button" class="link sp-vse" data-vse-vyberu>Zobrazit všech ${seznam.length}</button>` : ''}</div>`
        : '<p class="stat-prazdne">Výběru neodpovídá žádná modelka.</p>'}
        ${dotaz ? `<button type="button" class="btn btn-primary btn-small sp-galerie" data-vyber-galerie="${esc(dotaz)}">Otevřít v galerii →</button>` : ''}`;
}

// Věta vpravo nad grafem: celek, u výběru i hodnota výběru
function souhrn(def, sloupce, rozlozeni) {
    const ve = (vyber, celkem) => filtry.size ? `<b>${vyber}</b> z ${celkem}` : `<b>${celkem}</b>`;
    if (!def.osa) return `${ve(data.modelky.filter(m => vyhovuje(m)).length, data.modelky.length)} modelek · ${rozlozeni.length} ${rozlozeni.length === 1 ? 'hodnota' : rozlozeni.length > 1 && rozlozeni.length < 5 ? 'hodnoty' : 'hodnot'}`;
    const vsechny = sloupce.flatMap(s => s.polozky);
    if (!vsechny.length) return '';
    const rozsah = rozsahVyberu(def, sloupce);
    const vybrane = sloupce.slice(rozsah?.a ?? 0, (rozsah?.b ?? sloupce.length - 1) + 1).flatMap(s => s.polozky).filter(p => vyhovuje(p.m, klicFiltru(def)));
    const obdobi = `${sloupce[0].nazev}–${sloupce.at(-1).nazev}`;
    if (def.druh === 'pocet') return def.osa === 'mesic' ? `${ve(vybrane.length, vsechny.length)} přidaných za dva roky` : `${ve(vybrane.length, vsechny.length)} modelek · ${obdobi}`;
    const hodnota = polozky => polozky.length ? textHodnoty(def, def.druh === 'podil' ? hodnotaSloupce(def, polozky) : median(polozky.map(p => p.hodnota))) : '–';
    const co = def.druh === 'podil' ? def.ano : 'medián';
    return filtry.size ? `${co} ve výběru <b>${hodnota(vybrane)}</b> (celkem ${hodnota(vsechny)}) · ${pocetModelek(vybrane.length)}`
        : `${co} <b>${hodnota(vsechny)}</b> · známé u ${pocetModelek(vsechny.length)} · ${obdobi}`;
}

const ediceVyskytu = () => EDICE.filter(e => data.modelky.some(m => vyskytyModelky(m).some(c => c.edice === e)));

// Kostra se vykreslí jednou (rozvinutý seznam drží fokus); části se pak překreslují zvlášť
function htmlKostry() {
    return `<h3>Statistiky sbírky</h3>
        <div class="sp-lista">
            <label class="sp-vyber-grafu">
                <select data-sp-graf-vyber aria-label="Graf">${Object.entries(SKUPINY).map(([s, nazev]) => `<optgroup label="${nazev}">${GRAFY.filter(g => g.skupina === s)
                    .map(g => `<option value="${g.klic}" ${g.klic === graf ? 'selected' : ''}>${esc(g.nazev)}</option>`).join('')}</optgroup>`).join('')}</select></label>
            <span class="sp-edice" data-sp-druh></span>
            <span class="sp-edice" data-sp-edice></span>
            <span class="sp-souhrn" data-sp-souhrn></span>
        </div>
        <div class="sp-filtry" data-sp-filtry></div>
        <div class="sp-telo">
            <div class="stat-karta sp-karta">
                <div class="sp-legenda" data-sp-legenda></div>
                <div class="sp-graf" data-sp-graf tabindex="0"></div>
                <p class="sp-napoveda" data-sp-napoveda></p>
            </div>
            <div class="stat-karta sp-seznam" data-sp-seznam></div>
        </div>
        ${data.modelky.length ? '' : '<p class="stat-prazdne">Statistiky se ukážou, až budou ve sbírce modelky.</p>'}`;
}

function htmlLegendy(def) {
    if (!def.osa) return '';
    const celek = [...filtry.keys()].some(k => k !== klicFiltru(def)) ? '<span><i class="celek"></i>celá sbírka</span>' : '';
    const prumer = `<span><i class="cara"></i>průměr ${def.osa === 'mesic' ? '3 měsíců' : '7 let'}</span>`;
    if (def.druh === 'udaj') return `<span><i class="bod"></i>medián roku</span><span><i class="pasmo"></i>prostřední polovina modelek</span>${prumer}`;
    return `<span><i></i>${def.druh === 'podil' ? `${def.ano} (% modelek se známým údajem)` : def.osa === 'mesic' ? 'přidané modelky' : `modelky (${popisVyskytu()})`}</span>${celek}${prumer}`;
}

// Překreslení grafu (při tažení jen graf), případně i seznamu a lišty
let sloupce = [], rozlozeni = [];
function vykreslit(koren, { jenGraf = false } = {}) {
    if (!data || !koren.querySelector('[data-sp-graf]')) return;
    const def = definice();
    const misto = koren.querySelector('[data-sp-graf]');
    koren.querySelector('.graf-bublina')?.classList.add('hidden');
    if (!jenGraf) {
        sloupce = def.osa ? radaVCase(def) : [];
        rozlozeni = def.osa ? [] : polozkyRozlozeni(def.klic);
    }
    const fokus = /** @type {HTMLElement} */ (document.activeElement)?.closest?.('[data-hodnota]')?.dataset.hodnota;
    misto.innerHTML = def.osa ? htmlGrafuVCase(def, sloupce, misto.clientWidth) : htmlPruhu(def, rozlozeni);
    misto.classList.toggle('cas', Boolean(def.osa));
    if (fokus !== undefined) /** @type {HTMLElement} */ (misto.querySelector(`[data-hodnota="${CSS.escape(fokus)}"]`))?.focus({ preventScroll: true });
    if (jenGraf) return;
    const ed = ediceVyskytu();
    koren.querySelector('[data-sp-edice]').innerHTML = def.osa === 'rok' && ed.length > 1
        ? ['vse', ...ed].map(e => `<button type="button" class="${e === edice ? 'active' : ''}" aria-pressed="${e === edice}" data-sp-edice-volba="${e}">${e === 'vse' ? 'Vše' : e}</button>`).join('') : '';
    koren.querySelector('[data-sp-druh]').innerHTML = def.osa === 'rok'
        ? Object.entries(DRUHY_VYSKYTU).map(([k, nazev]) => `<button type="button" class="${k === druhVyskytu ? 'active' : ''}" aria-pressed="${k === druhVyskytu}" data-sp-druh-volba="${k}">${nazev}</button>`).join('') : '';
    koren.querySelector('[data-sp-souhrn]').innerHTML = souhrn(def, sloupce, rozlozeni);
    koren.querySelector('[data-sp-filtry]').innerHTML = filtry.size ? `<span>Výběr:</span>${[...filtry].map(([k, f]) =>
        `<button type="button" class="chip active" data-zrusit-podminku="${esc(k)}" title="Odebrat podmínku">${esc(f.popis)} ×</button>`).join('')}
        <button type="button" class="link" data-zrusit-vyber>Zrušit výběr</button>` : '';
    koren.querySelector('[data-sp-legenda]').innerHTML = !def.osa || sloupce.length ? htmlLegendy(def) : '';
    // Modelky bez čísla (jen online, bez vydání) nemají rok; kolik jich v grafech v čase není, říká nápověda
    const bezCisla = def.osa === 'rok' ? data.modelky.filter(m => !vyskytyModelky(m).length).length : 0;
    koren.querySelector('[data-sp-napoveda]').textContent = def.osa
        ? `Klik na sloupec vybere ${def.osa === 'mesic' ? 'měsíc' : 'rok'}, tažením vyberete období. Šipky ← → posouvají výběr, se Shiftem ho rozšíří; Esc výběr zruší. Výběr platí pro všechny grafy.${bezCisla ? ` Rok je rok prvního výskytu v časopise; ${pocetModelek(bezCisla)} bez čísla (jen online nebo bez vydání) v grafech v čase není.` : ''}`
        : 'Klik na řádek vybere hodnotu, další klik ji zruší. Výběr platí pro všechny grafy: přepni graf a uvidíš jen vybrané modelky.';
    const seznam = koren.querySelector('[data-sp-seznam]');
    const fokusSeznamu = seznam.contains(document.activeElement);
    seznam.innerHTML = htmlSeznamu(def, sloupce);
    if (fokusSeznamu) /** @type {HTMLElement} */ (seznam.querySelector('button'))?.focus({ preventScroll: true });
    nacitatPostupne(seznam);
}

// Podmínka roku prvního výskytu nebo měsíce přidání ze sloupců a..b grafu v čase
function nastavitRozsah(def, a, b) {
    const [od, doS] = [sloupce[Math.min(a, b)], sloupce[Math.max(a, b)]];
    const nazev = od === doS ? od.nazev : `${od.nazev} – ${doS.nazev}`;
    if (def.osa === 'mesic') {
        filtry.set('mesic', { od: od.mesic, do: doS.mesic, popis: `přidané ${nazev}`, dotaz: null,
            test: m => (m.pridano || '').slice(0, 7) >= od.mesic && (m.pridano || '').slice(0, 7) <= doS.mesic });
        return;
    }
    const ed = edice, druh = druhVyskytu;
    filtry.set('rok', { od: od.rok, do: doS.rok, popis: `${popisVyskytu(druh)} ${nazev}${ed === 'vse' ? '' : ` · ${ed}`}`, dotaz: null,
        test: m => {
            const c = prvniVyskyt(m, ed, druh);
            return Boolean(c) && c.rok >= od.rok && c.rok <= doS.rok;
        } });
}

// Načtení a vykreslení do oddílu Přehledu; volá se při prvním zobrazení oddílu (výběr se při nových datech zruší)
export async function nacistStatistiky(koren) {
    if (!koren || koren.dataset.nacteno) return;
    koren.dataset.nacteno = '1';
    const [s, modelky] = await Promise.all([GetStatistiky(), vsechnyModelky()]);
    if (!koren.isConnected) return;
    data = { s, modelky, fotografove: new Map() };
    filtry.clear();
    koren.innerHTML = `${htmlKostry()}<div class="graf-bublina hidden"></div>`;
    vykreslit(koren);
    // Při změně šířky se graf v čase překreslí v nové šířce
    const misto = koren.querySelector('[data-sp-graf]');
    let sirka = misto.clientWidth;
    new ResizeObserver(() => {
        if (!misto.isConnected || misto.clientWidth === sirka) return;
        sirka = misto.clientWidth;
        if (definice().osa) vykreslit(koren, { jenGraf: true });
    }).observe(misto);
    // Modelky nejčastějších fotografů (z hledání), pak se graf fotografů doplní
    const vysledky = await Promise.all(s.fotografove.map(f => GetModelky(`fotograf:"${f.nazev}"`)
        .then(seznam => /** @type {[string, Set<number>]} */ ([f.nazev, new Set((seznam || []).map(m => m.id))]))));
    if (!koren.isConnected || data?.s !== s) return;
    data.fotografove = new Map(vysledky);
    if (graf === 'fot') vykreslit(koren);
}

// Index sloupce pod ukazatelem (u kraje grafu nejbližší sloupec)
function indexSloupce(misto, clientX) {
    const svg = misto.querySelector('svg');
    const cile = misto.querySelectorAll('[data-i]');
    if (!svg || !cile.length) return null;
    const x = clientX - svg.getBoundingClientRect().left;
    const prvni = /** @type {SVGRectElement} */ (cile[0]);
    const zacatek = prvni.x.baseVal.value, k = prvni.width.baseVal.value;
    return Math.max(0, Math.min(cile.length - 1, Math.floor((x - zacatek) / k)));
}

// Bublina u sloupce nebo řádku pod myší; výběr myší (klik, tažení) a klávesnicí
export function pripravit(stats) {
    stats.addEventListener('mousemove', (e) => {
        // Každá část (úvod, statistiky) má vlastní bublinu
        const bublina = e.target.closest?.('.stat-section')?.querySelector('.graf-bublina');
        if (!bublina) return;
        const cil = !tah && e.target.closest?.('[data-tip]');
        bublina.classList.toggle('hidden', !cil);
        stats.querySelectorAll('.graf g.aktivni').forEach(g => g !== cil && g.classList.remove('aktivni'));
        if (!cil) return;
        cil.classList.add('aktivni');
        bublina.textContent = cil.dataset.tip;
        const okraj = bublina.offsetParent.getBoundingClientRect();
        const x = Math.min(e.clientX - okraj.left + 14, okraj.width - bublina.offsetWidth - 8);
        bublina.style.left = `${x}px`;
        bublina.style.top = `${e.clientY - okraj.top + 16}px`;
    });
    stats.addEventListener('mouseleave', () => stats.querySelectorAll('.graf-bublina').forEach(b => b.classList.add('hidden')));

    // Tažení přes sloupce grafu v čase; podmínka se nastaví po puštění
    stats.addEventListener('pointerdown', (e) => {
        const misto = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf].cas'));
        if (!misto || e.button !== 0) return;
        const i = indexSloupce(misto, e.clientX);
        if (i === null) return;
        e.preventDefault();
        misto.focus({ preventScroll: true });
        misto.setPointerCapture(e.pointerId);
        tah = { start: i, predtim: rozsahVyberu(definice(), sloupce), a: i, b: i };
        vykreslit(misto.closest('.stat-statistiky'), { jenGraf: true });
    });
    stats.addEventListener('pointermove', (e) => {
        if (!tah) return;
        const misto = /** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf]');
        const i = misto && indexSloupce(misto, e.clientX);
        if (i === null || i === undefined || i === tah.b) return;
        tah.b = i;
        vykreslit(misto.closest('.stat-statistiky'), { jenGraf: true });
    });
    stats.addEventListener('pointerup', (e) => {
        if (!tah) return;
        const koren = /** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky');
        const { a, b, predtim } = tah;
        tah = null;
        const def = definice();
        // Klik na jediný vybraný sloupec výběr zruší
        if (a === b && predtim && predtim.a === a && predtim.b === b) filtry.delete(klicFiltru(def));
        else nastavitRozsah(def, a, b);
        zobrazitVse = false;
        if (koren) vykreslit(koren);
    });

    stats.addEventListener('change', (e) => {
        const select = /** @type {HTMLSelectElement} */ (e.target);
        if (!select.matches('[data-sp-graf-vyber]')) return;
        graf = select.value;
        try { localStorage.setItem('grafStatistik', graf); } catch { /* jen pro toto spuštění */ }
        zobrazitVse = false;
        vykreslit(select.closest('.stat-statistiky'));
    });

    stats.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const koren = cil.closest('.stat-statistiky');
        if (!koren || !data) return;
        const modelka = cil.closest('[data-modelka-vyberu]');
        if (modelka) {
            const m = data.modelky.find(x => x.id === parseInt(modelka.dataset.modelkaVyberu));
            if (m) otevritDetailModelky(m);
            return;
        }
        const galerie = cil.closest('[data-vyber-galerie]');
        if (galerie) {
            hledatHodnotu(galerie.dataset.vyberGalerie);
            return;
        }
        const volbaEdice = cil.closest('[data-sp-edice-volba]');
        const volbaDruhu = cil.closest('[data-sp-druh-volba]');
        const pruh = cil.closest('.sp-pruh[data-hodnota]');
        const podminka = cil.closest('[data-zrusit-podminku]');
        if (cil.closest('[data-vse-vyberu]')) {
            zobrazitVse = true;
            vykreslit(koren);
            return;
        }
        if (cil.closest('[data-zrusit-vyber]')) filtry.clear();
        else if (podminka) filtry.delete(podminka.dataset.zrusitPodminku);
        else if (volbaEdice || volbaDruhu) {
            // Výběr roku platí pro edici a druh výskytu, ve kterých vznikl; s jejich změnou se zruší
            if (volbaEdice) edice = volbaEdice.dataset.spEdiceVolba;
            else druhVyskytu = volbaDruhu.dataset.spDruhVolba;
            filtry.delete('rok');
        } else if (pruh) {
            const def = definice();
            const p = rozlozeni.find(x => x.hodnota === pruh.dataset.hodnota);
            if (!p) return;
            if (filtry.get(def.klic)?.hodnota === p.hodnota) filtry.delete(def.klic);
            else filtry.set(def.klic, { hodnota: p.hodnota, popis: `${def.nazev}: ${p.nazev}`, test: p.test, dotaz: p.dotaz });
        } else return;
        zobrazitVse = false;
        vykreslit(koren);
        // Fokus zůstane na přepínači edice; po odebrání podmínky přejde na graf (Esc pak dál funguje)
        if (volbaEdice) /** @type {HTMLElement} */ (koren.querySelector(`[data-sp-edice-volba="${edice}"]`))?.focus();
        else if (volbaDruhu) /** @type {HTMLElement} */ (koren.querySelector(`[data-sp-druh-volba="${druhVyskytu}"]`))?.focus();
        else if (!pruh) /** @type {HTMLElement} */ (koren.querySelector('[data-sp-graf]'))?.focus({ preventScroll: true });
    });

    // Klávesnice v grafu v čase: šipky posouvají výběr (Shift rozšiřuje), Home a End; Esc zruší celý výběr
    stats.addEventListener('keydown', (e) => {
        const koren = /** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky');
        if (!koren || !data) return;
        if (e.key === 'Escape') {
            if (!filtry.size) return;
            e.preventDefault();
            e.stopPropagation();
            filtry.clear();
            vykreslit(koren);
            return;
        }
        const misto = /** @type {HTMLElement} */ (e.target).closest('[data-sp-graf].cas');
        const n = sloupce.length;
        if (!misto || !n || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const def = definice();
        const rozsah = rozsahVyberu(def, sloupce);
        // Pohyblivý konec výběru: u rozšiřování ten, kterým se naposledy hýbalo
        const kotva = rozsah ? (posledniKonec === 'a' ? rozsah.b : rozsah.a) : null;
        const ted = rozsah ? (posledniKonec === 'a' ? rozsah.a : rozsah.b) : e.key === 'ArrowLeft' ? n : -1;
        const nove = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, ted + (e.key === 'ArrowLeft' ? -1 : 1)));
        if (e.shiftKey && rozsah) {
            posledniKonec = nove < kotva ? 'a' : 'b';
            nastavitRozsah(def, kotva, nove);
        } else {
            posledniKonec = 'b';
            nastavitRozsah(def, nove, nove);
        }
        zobrazitVse = false;
        vykreslit(koren);
    });
}
