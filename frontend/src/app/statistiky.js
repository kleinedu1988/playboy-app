// Statistiky sbírky v Přehledu: jeden graf vybraný z rozvinutého seznamu, vedle něj modelky výběru.
// Grafy v čase (podle roku prvního výskytu v časopise nebo měsíce přidání) ukazují počty, údaje (medián a pásmo) nebo podíly
// a přes ně křivku klouzavého průměru; klik na sloupec vybere rok, tažení období. Grafy rozložení (kategorie,
// národnosti…) jsou pruhy; klik vybere hodnotu. Výběr platí pro všechny grafy (zužuje je), seznam vpravo
// ukazuje jeho modelky (bez výběru všechny v grafu).
// Počítá se ze seznamu modelek; nejčastější fotografové jsou z backendu (GetStatistiky) a jejich modelky se
// dohledají hledáním. SVG grafSloupcu zůstává pro úvod Přehledu.
import { GetProfilovaFotka, GetStatistiky, GetVkusVCase, UlozitSouborGrafu } from './backend';
import { csv, nazevSouboru, pngGrafu } from '../lib/graf-ven';
import { oznamit } from '../ui/oznameni';
import { radaPodilu, vkusVCase } from '../lib/vkus-v-case';
import { EDICE, MESICE, jeCisloPlayboye, VYSKYT, ZKRATKY_PASKY, esc, formatDatum, obrazek, kategorieModelky, nazevVydani, rozlozitVydani, sjednotit, sklonovat, vyskytModelky } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { adresaTitulni, nacitatPostupne, VELIKOST_TITULNI, VELIKOST_ZAHLAVI } from './obrazky';
import { stylVyrezu } from './navigace';
import { otevritDetailModelky } from './profil';
import { hledatHodnotu } from './galerie';
import { naPulky, textSrdicek, znakySrdicek } from '../lib/srdicka';
import { neobvykleRoky, porovnatObdobi, postrehRady, pripravitPriznak, rozdilyVyberu, souvislosti, vybratPostrehy } from '../lib/postrehy';
import { useky, vyhlazenaRada } from '../lib/krivky';
import { bodVMnohouhelniku } from '../lib/mapa-sbirky';
import { vypocitatMapu, zapomenoutMapu, zlepsitNaPozadi } from './mapa-uceni';
import { PRAH_PLATNA, bodNaMiste, htmlPlatna, nakreslit, pripravitKresbu } from './mapa-platno';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { naCss } from '../ui/vzhled';

const BARVA = '#d81b60';
// Výroční přehled (app/rok-ve-sbirce.js poslouchá data-rok-ve-sbirce): v heru vedle akcí postřehu
const TLACITKO_ROKU = '<button type="button" class="ph-tlacitko" data-rok-ve-sbirce title="Výroční přehled: co přibylo, co se líbilo a co se dokončilo">Rok ve sbírce →</button>';

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
// ze známých hodnot). Rozložení: pruhy hodnot. Pro postřeh o trendu a zlomu (lib/postrehy.js): prah = nejmenší
// podstatná změna údaje, sKym = podíl „modelek …“ ve větě, rod = rod názvu („výška vzrostla“, „BMI kleslo“);
// pro rozdíl výběru vic / mene = věta „Výběr {…}“ s rozdílem {d} („je o 4 cm vyšší“).
const anoNe = h => h === 1 ? true : h === 0 ? false : null;
const zHodnot = (text, ano, ne) => {
    const t = String(text || '').trim();
    return ano.includes(t) ? true : ne.includes(t) ? false : null;
};
const GRAFY = [
    { klic: 'cf', skupina: 'pocty', osa: 'rok', druh: 'pocet', nazev: 'Modelky podle roku' },
    { klic: 'prib', skupina: 'pocty', osa: 'mesic', druh: 'pocet', nazev: 'Přibývání sbírky' },
    { klic: 'vek', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Věk při prvním výskytu', jednotka: 'let', prah: 1,
        vic: 'je při prvním výskytu o {d} starší', mene: 'je při prvním výskytu o {d} mladší' },
    { klic: 'vyska', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Výška', jednotka: 'cm', prah: 2, rod: 'f', vic: 'je o {d} vyšší', mene: 'je o {d} nižší',
        udaj: m => m.vyskaCm || null },
    { klic: 'vaha', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Váha', jednotka: 'kg', prah: 2, rod: 'f', vic: 'je o {d} těžší', mene: 'je o {d} lehčí',
        udaj: m => m.vahaKg || null },
    { klic: 'bmi', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'BMI', jednotka: 'kg/m²', desetinna: 1, prah: 0.5, rod: 'n',
        vic: 'má o {d} vyšší BMI', mene: 'má o {d} nižší BMI', bezJednotkyVRozdilu: true,
        udaj: m => m.vyskaCm > 0 && m.vahaKg > 0 ? m.vahaKg / (m.vyskaCm / 100) ** 2 : null },
    { klic: 'hrudnik', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Obvod hrudníku', jednotka: 'cm', prah: 2,
        vic: 'má o {d} větší obvod hrudníku', mene: 'má o {d} menší obvod hrudníku', udaj: m => m.obvodHrudnikCm || null },
    { klic: 'pas', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Obvod pasu', jednotka: 'cm', prah: 2,
        vic: 'má o {d} širší pas', mene: 'má o {d} užší pas', udaj: m => m.obvodPasCm || null },
    { klic: 'boky', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Obvod boků', jednotka: 'cm', prah: 2,
        vic: 'má o {d} širší boky', mene: 'má o {d} užší boky', udaj: m => m.obvodBokyCm || null },
    { klic: 'whr', skupina: 'udaje', osa: 'rok', druh: 'udaj', nazev: 'Poměr pas : boky', jednotka: '', desetinna: 2, prah: 0.02,
        vic: 'má o {d} vyšší poměr pas : boky', mene: 'má o {d} nižší poměr pas : boky', bezJednotkyVRozdilu: true,
        udaj: m => m.obvodPasCm > 0 && m.obvodBokyCm > 0 ? m.obvodPasCm / m.obvodBokyCm : null },
    { klic: 'blond', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Blond vlasy', ano: 'blond', ne: 'jiné vlasy', sKym: 's blond vlasy',
        podil: m => String(m.vlasyBarva || '').trim() ? /blond|plav/.test(sjednotit(m.vlasyBarva)) : null },
    { klic: 'silikon', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Silikonová prsa', ano: 'silikonová', ne: 'přírodní', sKym: 'se silikonovými prsy',
        podil: m => zHodnot(m.prsaTyp, ['Silikonová'], ['Přírodní']) },
    { klic: 'oholene', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Oholené ochlupení', ano: 'oholené', ne: 'přírodní nebo zastřižené', sKym: 's oholeným ochlupením',
        podil: m => zHodnot(m.ochlupeni, ['Oholené'], ['Přírodní', 'Zastřižené']) },
    { klic: 'tetovani', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Tetování', ano: 's tetováním', ne: 'bez tetování', sKym: 's tetováním', podil: m => anoNe(m.tetovani) },
    { klic: 'piercing', skupina: 'podily', osa: 'rok', druh: 'podil', nazev: 'Piercing', ano: 's piercingem', ne: 'bez piercingu', sKym: 's piercingem', podil: m => anoNe(m.piercing) },
    { klic: 'kat', skupina: 'rozl', nazev: 'Kategorie' },
    { klic: 'nar', skupina: 'rozl', nazev: 'Národnosti' },
    { klic: 'vlasy', skupina: 'rozl', nazev: 'Barva vlasů' },
    { klic: 'oci', skupina: 'rozl', nazev: 'Barva očí' },
    { klic: 'srd', skupina: 'rozl', nazev: 'Hodnocení' },
    { klic: 'vyskyt', skupina: 'rozl', nazev: 'Výskyt (časopis / online)' },
    { klic: 'fot', skupina: 'rozl', nazev: 'Fotografové' },
    { klic: 'mapa', skupina: 'rozl', druh: 'mapa', nazev: 'Mapa sbírky' },
    { klic: 'obdobi', skupina: 'srov', druh: 'obdobi', nazev: 'Porovnat období' },
    { klic: 'vkus', skupina: 'srov', druh: 'vkus', nazev: 'Můj vkus v čase' },
];
const SKUPINY = { pocty: 'V čase · počty', udaje: 'V čase · údaje', podily: 'V čase · podíly', rozl: 'Rozložení', srov: 'Srovnání' };

// Grafy v čase: sloupce (s klouzavým průměrem), nebo hladká křivka s pásmem (lib/krivky.js); pamatuje se
let zobrazeniCasu = 'sloupce';
try { if (localStorage.getItem('statistikyZobrazeniCasu') === 'krivka') zobrazeniCasu = 'krivka'; } catch { /* sloupce */ }

// Porovnat období: dvě období let (rok prvního výskytu ve zvolené edici a druhu); pamatují se
let obdobiSrovnani = { a: { od: 1970, do: 1979 }, b: { od: 1990, do: 1999 } };
try {
    const ulozene = JSON.parse(localStorage.getItem('statistikyObdobi') || 'null');
    if (ulozene?.a?.od && ulozene?.b?.od) obdobiSrovnani = ulozene;
} catch { /* výchozí desetiletí */ }
const ulozitObdobi = () => { try { localStorage.setItem('statistikyObdobi', JSON.stringify(obdobiSrovnani)); } catch { /* jen teď */ } };
const BARVY_MAPY = {
    obdobi: {
        nazev: 'Období',
        polozky: [
            ['1950. léta', '#7986cb'], ['1960. léta', '#64b5f6'], ['1970. léta', '#4dd0e1'],
            ['1980. léta', '#81c784'], ['1990. léta', '#ffd54f'], ['2000. léta', '#ffb74d'],
            ['2010. léta', '#ff8a65'], ['2020. léta', '#f06292'], ['Neurčeno', '#757575'],
        ],
        hodnota: b => b.dekada,
    },
    vlasy: {
        nazev: 'Barva vlasů',
        polozky: [
            ['Blond', '#ffd54f'], ['Hnědé', '#a1887f'], ['Černé', '#b0bec5'],
            ['Zrzavé', '#ff8a65'], ['Jiné', '#90a4ae'], ['Neurčeno', '#616161'],
        ],
        hodnota: b => b.vlasy,
    },
    kategorie: {
        nazev: 'Kategorie',
        polozky: [
            ['Playmate měsíce', '#f06292'], ['Playmate roku', '#ffd54f'], ['Modelka obálky', '#64b5f6'],
            ['Cyber Girl', '#81c784'], ['Celebrita', '#ba68c8'], ['Online', '#4dd0e1'], ['Ostatní', '#757575'],
        ],
        hodnota: b => b.kategorie,
    },
    srd: {
        nazev: 'Hodnocení',
        polozky: [
            ['5 ♥', '#f06292'], ['4 ♥', '#ffb74d'], ['3 ♥', '#ffd54f'],
            ['1–2 ♥', '#64b5f6'], ['Bez hodnocení', '#616161'],
        ],
        hodnota: b => b.hodnoceni >= 4.5 ? '5 ♥' : b.hodnoceni >= 3.5 ? '4 ♥' : b.hodnoceni >= 2.5 ? '3 ♥' : b.hodnoceni > 0 ? '1–2 ♥' : 'Bez hodnocení',
    },
    uplnost: {
        nazev: 'Úplnost údajů',
        polozky: [
            ['Úplné (8–10)', '#81c784'], ['Střední (5–7)', '#ffd54f'], ['Málo údajů (< 5)', '#757575'],
        ],
        hodnota: b => b.uplnost >= 8 ? 'Úplné (8–10)' : b.uplnost >= 5 ? 'Střední (5–7)' : 'Málo údajů (< 5)',
    },
};
let barvaMapy = 'obdobi';
try { if (BARVY_MAPY[localStorage.getItem('barvaMapyStatistik')]) barvaMapy = localStorage.getItem('barvaMapyStatistik'); } catch { /* výchozí barva */ }
let mapaCache = { data: null, vysledek: null };
let lasoTah = null; // aktivní tažení lasa na mapě: [{ x, y }, ...] v souřadnicích SVG
let zvyraznenaModelkaMapy = null;

// Přepne graf Statistik na Mapu sbírky a zvýrazní na ní zadanou modelku (volá profil modelky „Na mapě →“)
export function nastavitModelkuNaMape(modelkaId, koren = null) {
    graf = 'mapa';
    zvyraznenaModelkaMapy = modelkaId;
    try { localStorage.setItem('grafStatistik', graf); } catch { /* jen pro toto spuštění */ }
    if (koren && koren.dataset.nacteno) vykreslit(koren);
}

// Zvýraznění z profilu platí jen pro tu jednu návštěvu mapy; běžný vstup do Statistik ho ruší
export function zrusitModelkuNaMape() {
    zvyraznenaModelkaMapy = null;
}

// Stav: vybraný graf (pamatuje se), edice a druh výskytu a výběr. Výběr jsou podmínky (klíč → { popis, test, dotaz,
// ... }) společné všem grafům: rok prvního výskytu („rok“, sdílí ho všechny grafy s osou roků), měsíc přidání
// („mesic“) a hodnota grafu rozložení (klíč grafu). Graf ukazuje jasně modelky vyhovující ostatním podmínkám,
// tlumeně celou sbírku; vlastní podmínka grafu je v něm zvýrazněná.
let data = null;                 // { s, modelky, fotografove: Map(nazev → Set id modelek) }
let graf = 'cf';
try { graf = GRAFY.some(g => g.klic === localStorage.getItem('grafStatistik')) ? localStorage.getItem('grafStatistik') : 'cf'; } catch { /* výchozí graf */ }
let edice = 'vse';
let druhVyskytu = 'vse';
// Vše = první výskyt v časopise; Online = první online album s datem nafocení (do Vše se nepočítá)
const DRUHY_VYSKYTU = { vse: 'Vše', centerfold: 'Centerfold', obalka: 'Obálka', pictorial: 'Pictorial', online: 'Online' };
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
// Výskyty modelky v časopise (čísla jejích centerfoldů, obálek a alb) s rokem, edicí, druhy a věkem modelky;
// k nim online alba s datem nafocení (druh online, bez edice; album bez data na časové ose není)
const vyskytyCache = new WeakMap();
function vyskytyModelky(m) {
    if (!vyskytyCache.has(m)) {
        const cf = new Set(m.centerfoldy || []), obalky = new Set(m.obalky || []);
        const vCasopise = [...new Set([...(m.vydani || []), ...cf, ...obalky])].map(v => {
            const casti = rozlozitVydani(v);
            // Statistiky zatím jen Playboye (výskyty v jiných časopisech by ve volbě „vše“ posunuly první výskyt)
            if (!casti || !jeCisloPlayboye(v)) return null;
            const druhy = new Set([cf.has(v) && 'centerfold', obalky.has(v) && 'obalka', !cf.has(v) && !obalky.has(v) && 'pictorial'].filter(Boolean));
            return { v, edice: casti.edice, rok: parseInt(casti.rok), druhy, vekPresne: vekVLetech(m.narozeniDatum, v) };
        });
        const online = (m.onlineAlba || []).filter(d => /^\d{4}/.test(d))
            .map(d => ({ v: d, edice: '', rok: parseInt(d.slice(0, 4)), druhy: new Set(['online']), vekPresne: vekVLetech(m.narozeniDatum, d) }));
        vyskytyCache.set(m, [...vCasopise.filter(Boolean), ...online].sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : 0)));
    }
    return vyskytyCache.get(m);
}
// První výskyt ve zvolené edici a druhu (nebo v těch, které platily při vzniku podmínky); Vše jsou jen čísla
// časopisu, online album edici nemá
const prvniVyskyt = (m, ed = edice, druh = druhVyskytu) => vyskytyModelky(m)
    .find(c => (druh === 'vse' ? !c.druhy.has('online') : c.druhy.has(druh)) && (ed === 'vse' || c.druhy.has('online') || c.edice === ed));
// Kde modelka v čísle (nebo online) byla, v seznamu modelek výběru
const nazevVyskytu = c => c.druhy.has('online') ? `online · nafoceno ${formatDatum(c.v)}` : nazevVydani(c.v);
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
    if (!sloupce.length) return `<p class="prazdno-male">${def.druh === 'pocet' ? 'Zatím žádná data.' : `Údaj „${def.nazev.toLowerCase()}“ zatím u modelek s výskytem v časopise chybí.`}</p>`;
    const zuzeno = [...filtry.keys()].some(k => k !== klicFiltru(def));
    const vybrane = sloupce.map(s => zuzeno ? s.polozky.filter(p => vyhovuje(p.m, klicFiltru(def))) : s.polozky);
    const W = Math.max(320, sirka), H = 360, L = 46, P = 10, T = 14, D = 26;
    const k = (W - L - P) / sloupce.length;
    const polomer = def.osa === 'mesic' ? 1 : 3;
    const krivkovy = zobrazeniCasu === 'krivka';
    const hodnotyOken = rada => rada.map(p => p.map(x => x.hodnota));
    const hladka = krivkovy ? vyhlazenaRada(def.druh, hodnotyOken(vybrane), polomer) : [];
    const hladkaCelku = krivkovy && zuzeno ? vyhlazenaRada(def.druh, hodnotyOken(sloupce.map(s => s.polozky)), polomer) : [];
    const cara = !krivkovy && sloupce.length >= 5 ? krivka(def, vybrane, polomer) : [];
    const caraCelku = !krivkovy && zuzeno && sloupce.length >= 5 ? krivka(def, sloupce.map(s => s.polozky), polomer) : [];
    let lo = 0, hi = 100;
    if (def.druh === 'pocet') hi = Math.max(1, ...sloupce.map(s => s.polozky.length));
    else if (def.druh === 'udaj') {
        const rozsahy = [...sloupce.map(s => rozsahHodnot(s.polozky)), ...vybrane.map(rozsahHodnot)].filter(Boolean);
        const min = Math.min(...rozsahy.map(r => r.dolni)), max = Math.max(...rozsahy.map(r => r.horni)), okraj = (max - min) * 0.1 || 1;
        lo = min - okraj;
        hi = max + okraj;
    }
    // Křivka: osa podle křivky a pásma (oken je méně rozkolísaných než jednotlivé roky)
    if (krivkovy) {
        const body = [...hladka, ...hladkaCelku].filter(Boolean);
        if (def.druh === 'pocet') hi = Math.max(1, ...body.map(r => r.stred));
        else if (def.druh === 'udaj' && body.length) {
            const min = Math.min(...body.map(r => r.dolni)), max = Math.max(...body.map(r => r.horni)), okraj = (max - min) * 0.1 || 1;
            lo = min - okraj;
            hi = max + okraj;
        }
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
        if (krivkovy) return;
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
    if (krivkovy) {
        // Pásmo (kvartily nebo Wilsonův interval) jako plocha mezi horní a dolní hranou, přes něj křivka; počet má
        // plochu pod křivkou. Mezery v datech křivku i pásmo přeruší.
        const bod = (i, v) => `${(x(i) + k / 2).toFixed(1)},${y(Math.min(hi, Math.max(lo, v))).toFixed(1)}`;
        const htmlKrivky = (rada, trida) => useky(rada).map(u => {
            const hrana = u.map(([i, r]) => bod(i, r.stred));
            const plocha = u[0][1].dolni !== null
                ? `M${u.map(([i, r]) => bod(i, r.horni)).join('L')}L${[...u].reverse().map(([i, r]) => bod(i, r.dolni)).join('L')}Z`
                : `M${bod(u[0][0], 0)}L${hrana.join('L')}L${bod(u.at(-1)[0], 0)}Z`;
            return `<path class="sp-rozpeti ${trida}" d="${plocha}"/>${u.length > 1 ? `<polyline class="sp-krivka hladka ${trida}" points="${hrana.join(' ')}"/>`
                : `<circle class="sp-bod ${trida}" cx="${x(u[0][0]) + k / 2}" cy="${y(u[0][1].stred)}" r="3" fill="${BARVA}"/>`}`;
        }).join('');
        casti.push(htmlKrivky(hladkaCelku, 'celek'), htmlKrivky(hladka, ''));
    } else casti.push(lomena(caraCelku, 'sp-krivka celek'), lomena(cara, 'sp-krivka'));
    // Zlom: čárkovaná svislice s rokem nahoře a schodovitá úroveň období (medián nebo podíl úseku)
    if (postreh?.druh === 'zlom') {
        const index = rok => rok - sloupce[0].rok;
        postreh.useky.forEach(u => {
            const yU = y(Math.min(hi, Math.max(lo, u.hodnota)));
            casti.push(`<line class="sp-uroven" x1="${x(index(u.odRoku))}" x2="${x(index(u.doRoku) + 1)}" y1="${yU}" y2="${yU}"/>`);
        });
        postreh.zlomy.forEach(z => {
            const xz = x(index(z.rok));
            casti.push(`<line class="sp-zlom" x1="${xz}" x2="${xz}" y1="${T + 12}" y2="${H - D}"/><text class="graf-popisek sp-zlom-rok" x="${xz}" y="${T + 6}" text-anchor="middle">${z.rok}</text>`);
        });
    }
    sloupce.forEach((s, i) => {
        const p = vybrane[i], n = p.length, h = hodnotaSloupce(def, p);
        const kolik = def.druh === 'pocet' ? (def.osa === 'mesic' ? `${pocetModelek(n)} přidáno` : pocetModelek(n))
            : h === null ? 'bez údaje'
            : def.druh === 'podil' ? `${def.ano} ${Math.round(h)} % (${p.filter(x => x.hodnota).length} z ${n})`
            : `medián ${textHodnoty(def, h)}, polovina modelek ${textHodnoty(def, rozsahHodnot(p).dolni)}–${textHodnoty(def, rozsahHodnot(p).horni)} · ${pocetModelek(n)}`;
        const celkem = zuzeno && def.druh === 'pocet' ? ` z ${s.polozky.length}` : '';
        if (krivkovy) {
            const r = hladka[i];
            const okno = `${sloupce[Math.max(0, i - polomer)].nazev}–${sloupce[Math.min(sloupce.length - 1, i + polomer)].nazev}`;
            const vOkne = !r ? `málo modelek v okně ${okno}`
                : def.druh === 'pocet' ? `průměrně ${cislo(r.stred)} ${def.osa === 'mesic' ? 'přidaných za měsíc' : 'modelek za rok'} (${okno})`
                : def.druh === 'podil' ? `${def.ano} ${Math.round(r.stred)} %, 95% interval ${Math.round(r.dolni)}–${Math.round(r.horni)} % · ${pocetModelek(r.n)} v okně ${okno}`
                : `medián ${textHodnoty(def, r.stred)}, polovina modelek ${textHodnoty(def, r.dolni)}–${textHodnoty(def, r.horni)} · ${pocetModelek(r.n)} v okně ${okno}`;
            casti.push(`<rect class="graf-cil" data-i="${i}" data-tip="${esc(`${s.nazev}: ${vOkne}`)}" x="${x(i)}" y="0" width="${k}" height="${H}"/>`);
            return;
        }
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
        // Po půlkách od 5 do ½; prázdné úrovně se vynechají (pocet 0). Hledání v galerii umí jen celá srdíčka.
        polozky = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map(n => ({ hodnota: String(n), nazev: n ? znakySrdicek(n) : 'Bez hodnocení',
            test: m => naPulky(m.hodnoceni) === n, dotaz: n && n % 1 === 0 ? `hodnoceni:${n}` : null }));
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

function dataMapy() {
    if (mapaCache.data === data && mapaCache.vysledek) return mapaCache.vysledek;
    const predchozi = mapaCache.vysledek ? new Map(mapaCache.vysledek.body.map(b => [b.id, b])) : null;
    const vysledek = vypocitatMapu(data.modelky, predchozi);
    const proData = data;
    mapaCache = { data, vysledek };
    // Zachování sousedů a autoenkodér na pozadí (mapa se ukáže hned)
    zlepsitNaPozadi(data.modelky, vysledek, {
        zmena: () => prekreslitPatuMapy(),
        hotovo: (nova) => {
            if (mapaCache.data !== proData) return;
            mapaCache = { data: proData, vysledek: nova };
            if (graf === 'mapa' && !lasoTah) {
                const koren = /** @type {HTMLElement | null} */ (document.querySelector('.stat-statistiky'));
                if (koren?.isConnected) vykreslit(koren, { jenGraf: true });
            }
        },
    });
    return vysledek;
}

// Řádek pod mapou: model, posun proti minulé mapě, zachování sousedů, průběh autoenkodéru a Přepočítat od začátku
function htmlPatyMapy(v) {
    const pct = x => `${Math.round(x * 100)} %`;
    const casti = [v.model === 'autoenkoder' ? 'Model: autoenkodér' : 'Model: PCA'];
    if (v.spolecnych >= 10) casti.push(`Posun proti minulé mapě ${v.posun.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %${v.novych > 0 ? ` (nových ${v.novych})` : ''}`);
    if (v.zachovaniSousedu != null) casti.push(`Zachovaní sousedé ${pct(v.zachovaniSousedu)}`);
    if (v.uciSe) casti.push(`Zkouším autoenkodér… ${v.epocha || 0}/40`);
    else if (v.zachAe != null && v.model === 'pca') casti.push(`Autoenkodér ${pct(v.zachAe)} – nestačí, zůstává PCA`);
    return `<div class="sp-mapa-pata" title="Zachovaní sousedé: kolik z 10 nejpodobnějších modelek (podle všech údajů) je i na mapě mezi 10 nejbližšími. Autoenkodér se použije, když je aspoň o 5 bodů lepší než PCA.">${casti.map(c => `<span>${esc(c)}</span>`).join('')}<button type="button" class="link" data-sp-mapa-znovu title="Zapomenout uloženou mapu a spočítat ji znovu s pevnou orientací os">Přepočítat od začátku</button></div>`;
}
function prekreslitPatuMapy() {
    const pata = document.querySelector('.sp-graf.mapa .sp-mapa-pata');
    if (pata && mapaCache.vysledek) pata.outerHTML = htmlPatyMapy(mapaCache.vysledek);
}

// Bod mapy podle id modelky; rejstřík se staví jednou pro každý výpočet mapy
const rejstrikyMapy = new WeakMap();
function bodMapy(id) {
    const vysledek = dataMapy();
    let rejstrik = rejstrikyMapy.get(vysledek);
    if (!rejstrik) {
        rejstrik = new Map(vysledek.body.map(b => [b.id, b]));
        rejstrikyMapy.set(vysledek, rejstrik);
    }
    return rejstrik.get(id);
}

function htmlMapySbirky(sirka) {
    const vysledek = dataMapy();
    const { body } = vysledek;
    const platno = body.length > PRAH_PLATNA;
    const kresba = [];
    if (!body.length) return '<p class="prazdno-male">Zatím žádná data.</p>';
    const W = Math.max(320, sirka), H = 360, L = 18, P = 18, T = 18, D = 18;
    const sx = x => L + (x + 1.15) / 2.3 * (W - L - P);
    const sy = y => T + (1.15 - y) / 2.3 * (H - T - D);
    const barevnyRezim = BARVY_MAPY[barvaMapy] || BARVY_MAPY.obdobi;
    const mapaBarev = new Map(barevnyRezim.polozky);
    const maFiltry = filtry.size > 0;
    const r = body.length > 2000 ? 2.4 : 3.4;

    let kruhZvyraznene = '';
    const kruhy = body.map(b => {
        const cx = sx(b.x).toFixed(1), cy = sy(b.y).toFixed(1);
        const jeZvyraznena = zvyraznenaModelkaMapy === b.id;
        const jeVybrana = !maFiltry || vyhovuje(b.m) || jeZvyraznena;
        const katHodnota = barevnyRezim.hodnota(b);
        const barva = jeZvyraznena ? BARVA : (mapaBarev.get(katHodnota) || '#90a4ae');
        const tlum = jeVybrana ? '' : ' tlum';
        const polomer = jeZvyraznena ? r + 1.6 : r;
        const tip = `${b.m.jmeno}${b.popisUdaju ? ` (${b.popisUdaju})` : ''}${b.sousede.length ? ` · sousedé: ${b.sousede.join(', ')}` : ''}`;
        if (jeZvyraznena) {
            kruhZvyraznene = `<circle class="sp-mapa-zvyraznena" cx="${cx}" cy="${cy}" r="${(r + 5).toFixed(1)}" fill="none" stroke="${BARVA}" stroke-width="2" pointer-events="none"/>`;
        }
        if (platno) {
            kresba.push({ cx: +cx, cy: +cy, r: polomer, barva, dute: b.maloUdaju && !jeZvyraznena, tlum: !jeVybrana, id: b.id, tip });
            return '';
        }
        if (b.maloUdaju && !jeZvyraznena) {
            return `<circle class="sp-mapa-bod${tlum}" data-mapa-id="${b.id}" data-tip="${esc(tip)}" cx="${cx}" cy="${cy}" r="${polomer}" fill="none" stroke="${barva}" stroke-width="1.5"/>`;
        }
        return `<circle class="sp-mapa-bod${tlum}" data-mapa-id="${b.id}" data-tip="${esc(tip)}" cx="${cx}" cy="${cy}" r="${polomer}" fill="${barva}"/>`;
    }).join('');

    const lasoHtml = lasoTah && lasoTah.length >= 2
        ? `<polygon class="sp-laso" points="${lasoTah.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>`
        : '';
    if (platno) {
        pripravitKresbu(W, H, kresba);
        return htmlPlatna(W, H, `${kruhZvyraznene}${lasoHtml}`) + htmlPatyMapy(vysledek);
    }
    return `<svg class="sp-svg" width="${W}" height="${H}" data-mapa-w="${W}" data-mapa-h="${H}" role="img" aria-label="Mapa sbírky">${kruhy}${kruhZvyraznene}${lasoHtml}</svg>${htmlPatyMapy(vysledek)}`;
}

function htmlPruhu(def, polozky) {
    if (!polozky.length) return `<p class="prazdno-male">${graf === 'fot' && !data.fotografove.size ? 'Počítám fotografy…' : 'Zatím žádná data.'}</p>`;
    const zuzeno = [...filtry.keys()].some(k => k !== def.klic);
    const vlastni = filtry.get(def.klic)?.hodnota;
    const max = Math.max(1, ...polozky.map(p => p.pocet));
    return `<div class="sp-pruhy">${polozky.map(p => {
        const zapnuty = vlastni === p.hodnota;
        return `<button type="button" class="sp-pruh ${zapnuty ? 'vybrany' : vlastni !== undefined ? 'tlum' : ''}${zvyraznit === p.hodnota ? ' zvyrazneny' : ''}" data-hodnota="${esc(p.hodnota)}" aria-pressed="${zapnuty}"
            data-tip="${esc(`${p.nazev}: ${zuzeno ? `${p.vybrano} z ${pocetModelek(p.pocet)}` : pocetModelek(p.pocet)}`)}">
            <span class="sp-nazev">${esc(p.nazev)}</span>
            <span class="sp-draha">${zuzeno ? `<i class="celek" style="width:${p.pocet / max * 100}%"></i>` : ''}<i style="width:${(zuzeno ? p.vybrano : p.pocet) / max * 100}%"></i></span>
            <span class="sp-pocet">${zuzeno ? `${p.vybrano} / ${p.pocet}` : p.pocet}</span>
        </button>`;
    }).join('')}</div>`;
}

// Modelky výběru: [{ m, detail }] bez opakování; u grafu v čase z vybraných sloupců (bez výběru ze všech)
function modelkyVyberu(def, sloupce) {
    if (def.druh === 'obdobi') {
        const c = clenstviObdobi();
        return data.modelky.map((m, i) => ({ m, s: c[i] })).filter(x => x.s)
            .sort((x, y) => x.s - y.s || prvniVyskyt(x.m).v.localeCompare(prvniVyskyt(y.m).v))
            .map(({ m, s }) => ({ m, detail: `${s === 1 ? 'A' : 'B'} · ${nazevVyskytu(prvniVyskyt(m))}` }));
    }
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
                : def.druh === 'udaj' ? `${textHodnoty(def, p.hodnota)} · ${nazevVyskytu(p.c)}`
                : def.druh === 'podil' ? `${p.hodnota ? def.ano : def.ne} · ${nazevVyskytu(p.c)}` : nazevVyskytu(p.c),
        }));
    return def.osa === 'mesic' ? seznam.reverse() : seznam;
}

function htmlSeznamu(def, sloupce) {
    const seznam = modelkyVyberu(def, sloupce);
    const ukazat = zobrazitVse ? seznam : seznam.slice(0, ZOBRAZIT_NAJEDNOU);
    const nadpis = def.druh === 'obdobi' ? 'Modelky obou období' : filtry.size ? 'Modelky výběru' : def.osa === 'mesic' ? 'Přidané za dva roky' : def.osa ? 'Celé období' : 'Všechny modelky';
    const dotazy = [...filtry.values()].map(f => f.dotaz);
    const dotaz = filtry.size && dotazy.every(Boolean) ? dotazy.join(' ') : '';
    return `<div class="sp-seznam-hlava"><b>${nadpis}</b><span>${pocetModelek(seznam.length)}</span></div>
        ${seznam.length ? `<div class="sp-modelky">${ukazat.map(({ m, detail }) => `
            <button type="button" class="sp-modelka" data-modelka-vyberu="${m.id}">
                <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
                <span>${esc(m.jmeno)}<small>${esc(detail)}</small></span>
                ${m.hodnoceni ? `<i title="${textSrdicek(m.hodnoceni)}">${znakySrdicek(m.hodnoceni)}</i>` : ''}
            </button>`).join('')}
            ${ukazat.length < seznam.length ? `<button type="button" class="link sp-vse" data-vse-vyberu>Zobrazit všech ${seznam.length}</button>` : ''}</div>`
        : '<p class="prazdno-male">Výběru neodpovídá žádná modelka.</p>'}
        ${dotaz ? `<button type="button" class="btn btn-primary btn-small sp-galerie" data-vyber-galerie="${esc(dotaz)}">Otevřít v galerii →</button>` : ''}`;
}

// Věta vpravo nad grafem: celek, u výběru i hodnota výběru
function souhrn(def, sloupce, rozlozeni) {
    const ve = (vyber, celkem) => filtry.size ? `<b>${vyber}</b> z ${celkem}` : `<b>${celkem}</b>`;
    if (def.druh === 'mapa') return `${ve(data.modelky.filter(m => vyhovuje(m)).length, data.modelky.length)} modelek na mapě`;
    if (def.druh === 'vkus') return vkusData ? `<b>${(vkusData.porovnani || []).length.toLocaleString('cs-CZ')}</b> soubojů` : '';
    if (def.druh === 'obdobi') {
        const c = clenstviObdobi();
        const n = strana => c.reduce((x, y) => x + (y === strana ? 1 : 0), 0);
        return `${esc(nazevObdobi(obdobiSrovnani.a))} <b>${n(1)}</b> vs ${esc(nazevObdobi(obdobiSrovnani.b))} <b>${n(2)}</b> modelek`;
    }
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

// Postřeh pod grafem v čase podle roku (údaje a podíly): zlom, nebo trend. Ze stejných sloupců jako graf, při výběru
// jen modelky výběru (podmínka roku graf nezužuje, jen zvýrazňuje). Bez průkazného a podstatného postřehu null.
function spocitatPostreh(def, sloupce, { bezVyberu = false } = {}) {
    if (def.osa !== 'rok' || def.druh === 'pocet' || !sloupce.length) return null;
    const zuzeno = !bezVyberu && [...filtry.keys()].some(k => k !== 'rok');
    const rada = sloupce.map(s => ({ rok: s.rok, polozky: zuzeno ? s.polozky.filter(p => vyhovuje(p.m, 'rok')) : s.polozky }));
    const zname = rada.reduce((n, s) => n + s.polozky.length, 0);
    const celkem = data.modelky.filter(m => prvniVyskyt(m) && (!zuzeno || vyhovuje(m, 'rok'))).length;
    const kdy = druhVyskytu === 'online' ? 'rok nafocení prvního online alba' : `rok ${druhVyskytu === 'vse' ? 'prvního výskytu v časopise' : `prvního výskytu – ${DRUHY_VYSKYTU[druhVyskytu].toLowerCase()}`}`;
    const kontext = `Známé u ${cislo(zname, 0)} z ${pocetModelek(celkem)}${zuzeno ? ' výběru' : ''}; ${kdy}${edice === 'vse' ? '' : `, edice ${edice}`}.`;
    return postrehRady(def, rada, { vyber: zuzeno, kontext });
}
function htmlPostrehu(t) {
    if (!t) return '';
    return `<span class="sp-postreh-ikona" aria-hidden="true">${t.smer > 0 ? '↗' : '↘'}</span><span>${esc(t.veta)}</span>
        <button type="button" class="sp-postreh-info" data-tip="${esc(t.podrobnosti)}" data-tip-siroky aria-label="${esc(`Podrobnosti: ${t.podrobnosti}`)}">ⓘ</button>`;
}

// Postřehy výběru proti zbytku sbírky (lib/postrehy.js rozdilyVyberu): údaje a podíly grafů a nejčastějších 8 hodnot
// rozložení. Příznaky se připraví jednou pro data, edici a druh výskytu (věk je věk v čísle prvního výskytu).
// Podmínka výběru vyřadí příznaky, které sama určuje (výběr podle vlasů neříká nic o vlasech).
const VYLOUCENE_PODMINKOU = { vlasy: ['vlasy', 'blond'] };
const ROZLOZENI_PRO_VYBER = {
    kat: n => `z kategorie „${n}“`, nar: n => `s národností „${n}“`, vlasy: n => `s barvou vlasů „${n}“`,
    oci: n => `s barvou očí „${n}“`, srd: n => n === 'Bez hodnocení' ? 'bez hodnocení' : `s hodnocením ${n}`, vyskyt: n => `s výskytem „${n}“`,
};
let priznaky = { klic: '', seznam: [] };
function priznakyVyberu() {
    const klic = `${edice}|${druhVyskytu}`;
    if (priznaky.klic === klic && priznaky.data === data) return priznaky.seznam;
    const { modelky } = data;
    const desetileti = modelky.map(m => {
        const r = prvniVyskyt(m)?.rok;
        return r ? Math.floor(r / 10) * 10 : null;
    });
    const seznam = GRAFY.filter(g => g.druh === 'udaj' || g.druh === 'podil').map(g => pripravitPriznak({
        ...g, graf: g.klic, desetileti,
        hodnoty: modelky.map(m => g.klic === 'vek' ? prvniVyskyt(m)?.vekPresne ?? null : g.druh === 'udaj' ? g.udaj(m) : g.podil(m)),
    }));
    const znamy = { nar: m => String(m.narodnost || '').trim(), vlasy: m => String(m.vlasyBarva || '').trim(), oci: m => String(m.ociBarva || '').trim() };
    Object.entries(ROZLOZENI_PRO_VYBER).forEach(([graf, sKym]) => {
        const def = GRAFY.find(g => g.klic === graf);
        [...polozkyRozlozeni(graf)].sort((a, b) => b.pocet - a.pocet).slice(0, 8).forEach(p => seznam.push(pripravitPriznak({
            klic: `${graf}:${p.hodnota}`, graf, druh: 'podil', nazev: `${def.nazev}: ${p.nazev}`, sKym: sKym(p.nazev), desetileti,
            hodnoty: modelky.map(m => (!znamy[graf] || znamy[graf](m) ? p.test(m) : null)),
        })));
    });
    priznaky = { klic, data, seznam };
    return seznam;
}

// Panel Postřehy nad grafem: rozdíly výběru (nejvýš 5), klik přepne na graf příznaku. Bez výběru skrytý.
// Trendy a zlomy všech grafů v čase podle roku; přepočet jen při změně dat, edice, výskytu nebo podmínek mimo rok
// (podmínka roku grafy nezužuje). Mapa klíč grafu → postřeh nebo null.
let postrehyGrafu = { klic: '', data: null, mapa: new Map() };
// Celá sbírka (bez podmínek mimo rok) má mapu zvlášť: sdílí ji hero a panel bez výběru, takže se nepočítá dvakrát
let postrehySbirky = { klic: '', data: null, mapa: new Map() };
const GRAFY_POSTREHU = () => GRAFY.filter(g => g.osa === 'rok' && (g.druh === 'udaj' || g.druh === 'podil'));
function postrehyCeleSbirky() {
    const klic = `${edice}|${druhVyskytu}`;
    if (postrehySbirky.klic !== klic || postrehySbirky.data !== data) {
        postrehySbirky = { klic, data, mapa: new Map(GRAFY_POSTREHU().map(g => [g.klic, spocitatPostreh(g, radaVCase(g), { bezVyberu: true })])) };
    }
    return postrehySbirky.mapa;
}
function postrehyRad() {
    const podminky = [...filtry].filter(([k]) => k !== 'rok');
    if (!podminky.length) return postrehyCeleSbirky();
    const klic = [edice, druhVyskytu, ...podminky.map(([k, f]) => `${k}=${f.popis}`)].join('|');
    if (postrehyGrafu.klic === klic && postrehyGrafu.data === data) return postrehyGrafu.mapa;
    const mapa = new Map(GRAFY_POSTREHU().map(g => [g.klic, spocitatPostreh(g, radaVCase(g))]));
    postrehyGrafu = { klic, data, mapa };
    return mapa;
}

// Postřehy výběru do pásu hera (lib/postrehy.js vybratPostrehy): přednostně čím se výběr liší od sbírky, k tomu
// nejvýš 2 zlomy nebo trendy výběru. Postřehy, které byly vidět, drží místo (bez přeskakování při změně výběru).
let predtimVeVyberu = [];
let zvyraznit = null;            // hodnota rozložení zvýrazněná po kliku na postřeh (bez přidání podmínky)
// Modelka obohacená o přesný věk při prvním výskytu pro výpočet souvislostí
const modelkaProSouvislosti = m => ({ ...m, vek: prvniVyskyt(m)?.vekPresne ?? null });

function postrehyVyberu() {
    const kandidati = [...postrehyRad()].filter(([, p]) => p).map(([graf, p]) => ({ id: `${p.druh}:${graf}`, druh: p.druh, graf,
        druhyGraf: /** @type {string | null} */ (null), skore: p.skore,
        veta: p.veta, podrobnosti: p.podrobnosti, ikona: p.smer > 0 ? '↗' : '↘', hodnota: /** @type {string | null} */ (null), rok: /** @type {number | null} */ (null) }));
    const maska = Uint8Array.from(data.modelky, m => (vyhovuje(m) ? 1 : 0));
    const vyloucit = [...filtry.keys()].flatMap(k => VYLOUCENE_PODMINKOU[k] ?? [k]);
    const { maly, postrehy } = rozdilyVyberu(priznakyVyberu(), maska, { vyloucit });
    postrehy.forEach(p => kandidati.push({ id: `rozdil:${p.klic}`, druh: 'rozdil', graf: p.graf, druhyGraf: null, skore: p.skore, veta: p.veta,
        podrobnosti: p.podrobnosti, ikona: '≠', hodnota: p.klic.startsWith(`${p.graf}:`) ? p.klic.slice(p.graf.length + 1) : null, rok: null }));
    if (!maly) {
        const vybraneModelky = data.modelky.filter((_, i) => maska[i]).map(modelkaProSouvislosti);
        souvislosti(vybraneModelky, { vyber: true }).forEach(s => kandidati.push({
            id: s.id, druh: 'souvislost', graf: s.graf, druhyGraf: s.druhyGraf, skore: s.skore,
            veta: s.veta, podrobnosti: s.podrobnosti, ikona: '∼', hodnota: null, rok: null,
        }));
    }
    const vybrane = vybratPostrehy(kandidati, { hlavni: 'rozdil', predtim: predtimVeVyberu });
    predtimVeVyberu = vybrane.map(k => k.id);
    const zprava = maly ? 'Výběr je na postřehy příliš malý (méně než 10 modelek).'
        : !postrehy.length ? 'Výběr se od sbírky průkazně neliší.' : '';
    return { vybrane, zprava };
}

// ── Porovnat období ──────────────────────────────────────────────────────────────────────────────────────────────
// Modelky podle roku prvního výskytu (edice a druh jako u grafů v čase, ostatní podmínky výběru platí) v období A
// a B; čím se období liší, testuje lib/postrehy.js porovnatObdobi (Mann–Whitney, Fisher, Benjamini–Hochberg).
const nazevDesetileti = d => d < 2000 ? `${d % 100 || ''}${d % 100 ? '. léta' : '1900–09'}` : `${d}–${String(d + 9).slice(2)}`;
const nazevObdobi = o => o.do - o.od === 9 && o.od % 10 === 0 ? nazevDesetileti(o.od) : o.od === o.do ? String(o.od) : `${o.od}–${o.do}`;
function desetiletiSbirky() {
    const pocty = new Map();
    data.modelky.forEach(m => {
        const r = prvniVyskyt(m)?.rok;
        if (r) pocty.set(Math.floor(r / 10) * 10, (pocty.get(Math.floor(r / 10) * 10) || 0) + 1);
    });
    return [...pocty].sort((a, b) => a[0] - b[0]);
}
// Přes modelky: 1 = období A, 2 = období B, 0 = ani jedno (nebo nevyhovuje výběru)
function clenstviObdobi() {
    const { a, b } = obdobiSrovnani;
    return Int8Array.from(data.modelky, m => {
        const r = prvniVyskyt(m)?.rok;
        if (!r || !vyhovuje(m, 'rok')) return 0;
        return r >= a.od && r <= a.do ? 1 : r >= b.od && r <= b.do ? 2 : 0;
    });
}
const prekryvObdobi = () => obdobiSrovnani.a.od <= obdobiSrovnani.b.do && obdobiSrovnani.b.od <= obdobiSrovnani.a.do;
let srovnaniPamet = { klic: '', data: null, vysledek: null };
function vysledekSrovnani() {
    const { a, b } = obdobiSrovnani;
    const klic = [edice, druhVyskytu, a.od, a.do, b.od, b.do, ...[...filtry].filter(([k]) => k !== 'rok').map(([k, f]) => `${k}=${f.popis}`)].join('|');
    if (srovnaniPamet.klic === klic && srovnaniPamet.data === data) return srovnaniPamet.vysledek;
    const vyloucit = [...filtry.keys()].filter(k => k !== 'rok').flatMap(k => VYLOUCENE_PODMINKOU[k] ?? [k]);
    const vysledek = porovnatObdobi(priznakyVyberu(), clenstviObdobi(), { a: nazevObdobi(a), b: nazevObdobi(b) }, { vyloucit });
    srovnaniPamet = { klic, data, vysledek };
    return vysledek;
}
const hodnotaTabulky = (r, v) => v === null || v === undefined ? '–' : `${cislo(v, r.druh === 'podil' ? 0 : r.desetinna)}${r.jednotka ? (r.jednotka === '%' ? ' %' : ` ${r.jednotka}`) : ''}`;

// ——— Graf ven (1.53, lib/graf-ven.js): čísla zvoleného grafu jako tabulka, obrázek a tisk ———
function tabulkaGrafu(def, misto) {
    if (def.druh === 'mapa') {
        const rezim = BARVY_MAPY[barvaMapy] || BARVY_MAPY.obdobi;
        return [['Modelka', 'x', 'y', rezim.nazev, 'Ve výběru'], ...dataMapy().body.map(b => [b.m.jmeno, b.x, b.y, rezim.hodnota(b), !filtry.size || vyhovuje(b.m) ? 'ano' : 'ne'])];
    }
    if (def.druh === 'vkus') {
        if (!vkusData) return [];
        const v = vypocitanyVkus();
        const proc = x => (x === null ? null : Math.round(x * 1000) / 10);
        return [['Vlastnost', 'Dřív – výher %', 'Dřív – soubojů', 'Poslední rok – výher %', 'Poslední rok – soubojů', 'Průkazný posun'],
            ...v.radky.map(r => [r.kdo, proc(r.podilDriv), r.nD, proc(r.podilLetos), r.nL, v.postrehy.some(p => p.klic === r.klic) ? 'ano' : ''])];
    }
    if (def.druh === 'obdobi') {
        return [...misto.querySelectorAll('table tr')].map(tr => [...tr.querySelectorAll('th, td')].map(b => b.textContent.trim().replace(/\s+/g, ' ')));
    }
    if (def.osa) {
        const hlava = [def.osa === 'mesic' ? 'Měsíc' : 'Rok', 'Modelek'];
        if (def.druh === 'udaj') hlava.push(`Medián${def.jednotka ? ` (${def.jednotka})` : ''}`, '25. percentil', '75. percentil');
        if (def.druh === 'podil') hlava.push(`${def.ano} (%)`);
        return [hlava, ...sloupce.map(s => {
            const vybrane = s.polozky.filter(p => vyhovuje(p.m, klicFiltru(def)));
            const r = [s.nazev, vybrane.length];
            if (def.druh === 'udaj') { const h = rozsahHodnot(vybrane); r.push(h?.median ?? null, h?.dolni ?? null, h?.horni ?? null); }
            if (def.druh === 'podil') r.push(vybrane.length ? vybrane.filter(p => p.hodnota).length / vybrane.length * 100 : null);
            return r;
        })];
    }
    return [['Hodnota', 'Modelek', ...(filtry.size ? ['Ve výběru'] : [])], ...rozlozeni.map(p => [p.nazev, p.pocet, ...(filtry.size ? [p.vybrano] : [])])];
}

async function grafVen(koren, jak) {
    const def = definice();
    const misto = /** @type {HTMLElement} */ (koren.querySelector('[data-sp-graf]'));
    const nazev = def.nazev + (filtry.size ? ' – výběr' : '');
    if (jak === 'tisk') {
        document.body.classList.add('tisk-grafu');
        const konec = () => { document.body.classList.remove('tisk-grafu'); window.removeEventListener('afterprint', konec); };
        window.addEventListener('afterprint', konec);
        try { window.print(); } catch { konec(); oznamit('Tisk se nepodařilo otevřít.'); }
        return;
    }
    let obsah = null;
    if (jak === 'csv') {
        const radky = tabulkaGrafu(def, misto);
        if (radky.length < 2) return oznamit('Tento graf zatím nemá čísla k uložení.');
        obsah = csv(radky);
    } else {
        const pozadi = getComputedStyle(koren.querySelector('.sp-karta') || document.body).backgroundColor;
        obsah = await pngGrafu(misto, pozadi && pozadi !== 'rgba(0, 0, 0, 0)' ? pozadi : '#141416').catch(() => null);
        if (!obsah) return oznamit('Tento pohled nemá obrázek grafu – ulož ho jako CSV nebo vytiskni.');
    }
    const cesta = await UlozitSouborGrafu(nazevSouboru(nazev, jak), obsah).catch(() => '');
    if (cesta) oznamit(`Uloženo: ${cesta}`);
}

// ——— Můj vkus v čase (1.53, lib/vkus-v-case.js): porovnání dvojic a změny srdíček po měsících ———
let vkusData = null;          // z backendu; null = ještě nenačteno
let vkusNacita = false;
let vkusPamet = { data: null, vkus: null, v: null };
const BARVY_VKUSU = [BARVA, '#64b5f6', '#ffd54f'];

function vypocitanyVkus() {
    if (vkusPamet.data === data && vkusPamet.vkus === vkusData) return vkusPamet.v;
    const v = vkusVCase(vkusData, data.modelky);
    vkusPamet = { data, vkus: vkusData, v };
    return v;
}

function htmlVkusu(sirka) {
    if (!vkusData) {
        if (!vkusNacita) {
            vkusNacita = true;
            GetVkusVCase().then(v => { vkusData = v || { porovnani: [], srdicka: [] }; }).catch(() => { vkusData = { porovnani: [], srdicka: [] }; })
                .finally(() => {
                    vkusNacita = false;
                    const koren = /** @type {HTMLElement | null} */ (document.querySelector('.stat-statistiky'));
                    if (graf === 'vkus' && koren?.isConnected) vykreslit(koren);
                });
        }
        return '<p class="prazdno-male">Načítám historii porovnání…</p>';
    }
    const v = vypocitanyVkus();
    if (v.souboju < 40) {
        return `<p class="prazdno-male">Zatím ${v.souboju} porovnání – vkus v čase potřebuje aspoň 40 soubojů v Hodnocení › Porovnat (nebo v Dnešním výběru), nejlépe rozložených přes víc než rok.</p>${htmlSrdicekVCase(v)}`;
    }
    const postrehy = v.postrehy.length
        ? `<ul class="vk-postrehy">${v.postrehy.map(p => `<li class="${p.kladny ? 'vk-vic' : 'vk-mene'}">${esc(p.text)}</li>`).join('')}</ul>`
        : `<p class="vk-nic">Žádný průkazný posun: za poslední rok vyhrávají modelky se stejnými vlastnostmi jako dřív (porovnáno ${v.radky.filter(r => r.p !== null).length} vlastností, ${v.souboju.toLocaleString('cs-CZ')} soubojů).</p>`;
    // Graf: podíl výher po měsících – průkazné posuny, jinak nejčastější vlastnosti
    const kGrafu = [...v.postrehy.map(p => v.radky.find(r => r.klic === p.klic)), ...v.radky].filter((r, i, a) => r && a.indexOf(r) === i).slice(0, 3);
    const W = Math.max(320, sirka), H = 200, L = 34, P = 10, T = 10, D = 22;
    const n = v.mesice.length;
    const sx = i => L + (n <= 1 ? 0.5 : i / (n - 1)) * (W - L - P);
    const sy = p => T + (1 - p) * (H - T - D);
    const iHranice = v.mesice.findIndex(m => m > v.hranice.slice(0, 7));
    const cary = kGrafu.map((r, k) => {
        const body = radaPodilu(r, v.mesice).map((b, i) => (b.podil === null ? '' : `${sx(i).toFixed(1)},${sy(b.podil).toFixed(1)}`)).filter(Boolean);
        return body.length ? `<polyline fill="none" stroke="${BARVY_VKUSU[k]}" stroke-width="2" points="${body.join(' ')}"/>` : '';
    }).join('');
    const popisky = [0, 0.5, 1].map(p => `<text x="${L - 6}" y="${sy(p) + 4}" text-anchor="end" class="sp-osa-text">${p * 100} %</text>`).join('');
    const mesicePopis = n ? `<text x="${sx(0)}" y="${H - 6}" class="sp-osa-text">${esc(v.mesice[0])}</text><text x="${sx(n - 1)}" y="${H - 6}" text-anchor="end" class="sp-osa-text">${esc(v.mesice[n - 1])}</text>` : '';
    const hranice = iHranice > 0 ? `<line x1="${sx(iHranice)}" x2="${sx(iHranice)}" y1="${T}" y2="${H - D}" class="vk-hranice"/><text x="${sx(iHranice) + 4}" y="${T + 10}" class="sp-osa-text">poslední rok</text>` : '';
    const svg = `<svg class="sp-svg" width="${W}" height="${H}" role="img" aria-label="Podíl vyhraných soubojů po měsících">
        <line x1="${L}" x2="${W - P}" y1="${sy(0.5)}" y2="${sy(0.5)}" class="vk-pulka"/>${hranice}${popisky}${mesicePopis}${cary}</svg>
        <div class="vk-legenda">${kGrafu.map((r, k) => `<span><i style="background:${BARVY_VKUSU[k]}"></i>${esc(r.kdo)}</span>`).join('')}<span class="vk-pozn">podíl vyhraných soubojů proti modelkám bez té vlastnosti, měsíce s aspoň 5 souboji</span></div>`;
    const proc = x => (x === null ? '–' : `${Math.round(x * 100)} %`);
    const tabulka = `<table class="vk-tabulka"><thead><tr><th>Vlastnost</th><th>Dřív</th><th>Poslední rok</th><th>Posun</th></tr></thead><tbody>${v.radky.slice(0, 12).map(r => {
        const posun = r.podilLetos !== null && r.podilDriv !== null ? Math.round((r.podilLetos - r.podilDriv) * 100) : null;
        const pruk = v.postrehy.some(p => p.klic === r.klic);
        return `<tr class="${pruk ? 'vk-prukazne' : ''}"><td>${esc(r.kdo)}</td><td>${proc(r.podilDriv)} <small>${r.nD}</small></td><td>${proc(r.podilLetos)} <small>${r.nL}</small></td><td>${posun === null ? '–' : `${posun > 0 ? '+' : posun < 0 ? '−' : ''}${Math.abs(posun)} b.`}${pruk ? ' ✦' : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
    return `${postrehy}${svg}${tabulka}${htmlSrdicekVCase(v)}`;
}

function htmlSrdicekVCase(v) {
    if (!v.srdicka.length) return '<p class="vk-pozn">Změny srdíček modelek se zapisují od verze 1.53 – časem tu bude i jejich vývoj po měsících.</p>';
    const posledni = v.srdicka.slice(-12).reverse();
    const pul = x => (x === null ? '–' : x.toLocaleString('cs-CZ', { maximumFractionDigits: 1 }));
    return `<h5 class="vk-nadpis">Srdíčka po měsících</h5><table class="vk-tabulka"><thead><tr><th>Měsíc</th><th>Nově ohodnocené</th><th>Průměr nových ♥</th><th>Přidáno</th><th>Ubráno</th></tr></thead><tbody>${posledni.map(r => `<tr><td>${esc(r.mesic)}</td><td>${r.nove}</td><td>${pul(r.prumerNovych)}</td><td>${r.pridano}</td><td>${r.ubrano}</td></tr>`).join('')}</tbody></table>`;
}

function htmlObdobi() {
    const desetileti = desetiletiSbirky();
    if (!desetileti.length) return '<p class="prazdno-male">Zatím žádná data: srovnání potřebuje modelky s rokem prvního výskytu.</p>';
    const [min, max] = [desetileti[0][0], desetileti.at(-1)[0] + 9];
    const clenstvi = clenstviObdobi();
    const pocet = strana => clenstvi.reduce((n, x) => n + (x === strana ? 1 : 0), 0);
    const strana = (klic, cislo) => {
        const o = obdobiSrovnani[klic];
        return `<fieldset class="so-obdobi so-${klic}"><legend><b>${klic.toUpperCase()}</b> ${esc(nazevObdobi(o))}<small>${pocetModelek(pocet(cislo))}</small></legend>
            <div class="so-desetileti">${desetileti.map(([d, n]) => `<button type="button" class="chip ${o.od === d && o.do === d + 9 ? 'active' : ''}" data-so-desetileti="${klic}:${d}" title="${esc(pocetModelek(n))}">${esc(nazevDesetileti(d))}</button>`).join('')}</div>
            <div class="so-roky"><label>od <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${o.od}" data-so-od="${klic}" aria-label="Období ${klic.toUpperCase()} od roku"></label>
            <label>do <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${o.do}" data-so-do="${klic}" aria-label="Období ${klic.toUpperCase()} do roku"></label></div>
        </fieldset>`;
    };
    let vysledek;
    if (prekryvObdobi()) vysledek = '<p class="so-zprava">Období se překrývají. Vyber dvě období, která nemají společný rok.</p>';
    else {
        const r = vysledekSrovnani();
        if (r.maly) vysledek = `<p class="so-zprava">Na srovnání je potřeba aspoň 10 modelek v každém období (${esc(nazevObdobi(obdobiSrovnani.a))}: ${r.na}, ${esc(nazevObdobi(obdobiSrovnani.b))}: ${r.nb}).</p>`;
        else {
            const prukazne = r.postrehy.length;
            const radky = [...r.tabulka].sort((x, y) => Number(y.prukazny) - Number(x.prukazny) || x.q - y.q).map(t => `
                <tr class="${t.prukazny ? 'prukazny' : ''}"><th scope="row"><button type="button" class="link" data-sp-graf-volba="${esc(t.graf)}"${t.klic.startsWith(`${t.graf}:`) ? ` data-sp-zvyraznit="${esc(t.klic.slice(t.graf.length + 1))}"` : ''}>${esc(t.nazev)}</button></th>
                <td>${hodnotaTabulky(t, t.a)}<small>${t.na}</small></td><td>${hodnotaTabulky(t, t.b)}<small>${t.nb}</small></td>
                <td class="so-q" title="q po opravě Benjamini–Hochberg">${t.prukazny ? '✓ ' : ''}${t.q < 0.001 ? '< 0,001' : cislo(t.q, 3)}</td></tr>`).join('');
            vysledek = `<div class="so-shrnuti"><h3>${prukazne ? `Průkazné rozdíly: ${prukazne} z ${r.testu} testů` : `Období se průkazně neliší (${r.testu} testů)`}</h3>
                ${prukazne ? `<ul class="so-postrehy">${r.postrehy.map(p => `<li><span class="sp-postreh-ikona" aria-hidden="true">${p.smer > 0 ? '↗' : '↘'}</span><span>${esc(p.veta)}</span>
                    <button type="button" class="sp-postreh-info" data-tip="${esc(p.podrobnosti)}" data-tip-siroky aria-label="${esc(`Podrobnosti: ${p.podrobnosti}`)}">ⓘ</button></li>`).join('')}</ul>` : ''}</div>
                <details class="so-tabulka"><summary>Všechny porovnané údaje</summary><table>
                    <thead><tr><th scope="col">Údaj</th><th scope="col">${esc(nazevObdobi(obdobiSrovnani.a))}</th><th scope="col">${esc(nazevObdobi(obdobiSrovnani.b))}</th><th scope="col">q</th></tr></thead>
                    <tbody>${radky}</tbody></table>
                    <p class="sp-napoveda">Údaje: medián (Mannův–Whitneyův test), podíly: procento modelek se známým údajem (Fisherův test); malé číslo je počet modelek. q je p-hodnota po opravě na počet testů; ✓ = průkazný (q ≤ 0,05) a zároveň podstatný rozdíl.</p></details>`;
        }
    }
    return `<div class="so">${strana('a', 1)}<span class="so-vs" aria-hidden="true">vs</span>${strana('b', 2)}</div>${vysledek}`;
}

const ediceVyskytu = () => EDICE.filter(e => data.modelky.some(m => vyskytyModelky(m).some(c => c.edice === e)));

// Kostra se vykreslí jednou; části se pak překreslují zvlášť. Volby (graf, výskyt, edice, výběr a souhrn) jsou
// v liště pod hledáním: skrytý řádek štítků převezme ui/volby.js (přes prehled.js)
function htmlKostry() {
    return `<div class="volby-v-liste" data-volby-casti="statistiky" data-sp-volby></div>
        <div class="sp-telo">
            <div class="stat-karta sp-karta">
                <div class="sp-ven" role="group" aria-label="Graf ven"><button type="button" class="link" data-sp-ven="png" title="Uložit graf jako obrázek PNG">PNG</button><button type="button" class="link" data-sp-ven="csv" title="Uložit čísla grafu jako tabulku CSV (otevře ji Excel i LibreOffice)">CSV</button><button type="button" class="link" data-sp-ven="tisk" title="Vytisknout graf nebo ho uložit do PDF">Tisk</button></div>
                <div class="sp-legenda" data-sp-legenda></div>
                <div class="sp-graf" data-sp-graf tabindex="0"></div>
                <p class="sp-postreh" data-sp-postreh hidden></p>
                <p class="sp-napoveda" data-sp-napoveda></p>
            </div>
            <div class="stat-karta sp-seznam" data-sp-seznam></div>
        </div>
        ${data.modelky.length ? '' : htmlPrazdna('Statistiky zatím nejsou', 'Statistiky se ukážou, až budou ve sbírce modelky.', { ikona: 'foto' })}`;
}

function htmlLegendy(def) {
    if (def.druh === 'vkus') return '';
    if (def.druh === 'mapa') {
        const rezim = BARVY_MAPY[barvaMapy] || BARVY_MAPY.obdobi;
        const aktivniKat = filtry.get('mapa')?.hodnota || '';
        return `${rezim.polozky.map(([nazev, barva]) => {
            const klicKat = `${barvaMapy}:${nazev}`;
            const zapnuto = aktivniKat === klicKat;
            return `<button type="button" class="sp-legenda-volba${zapnuto ? ' aktivni' : ''}" data-sp-mapa-kategorie="${esc(nazev)}" aria-pressed="${zapnuto}" title="Kliknutím vyfiltrovat na mapě"><i class="bod" style="background:${barva}"></i>${esc(nazev)}</button>`;
        }).join('')}<span><i class="krouzek"></i>málo údajů</span>`;
    }
    if (!def.osa) return '';
    const prepinac = `<span class="sp-zobrazeni" role="group" aria-label="Zobrazení grafu">${[['sloupce', 'Sloupce'], ['krivka', 'Křivka a rozpětí']].map(([k, nazev]) =>
        `<button type="button" data-sp-zobrazeni="${k}" aria-pressed="${zobrazeniCasu === k}" class="${zobrazeniCasu === k ? 'on' : ''}">${nazev}</button>`).join('')}</span>`;
    const celek = [...filtry.keys()].some(k => k !== klicFiltru(def)) ? '<span><i class="celek"></i>celá sbírka</span>' : '';
    if (zobrazeniCasu === 'krivka') {
        const okno = def.osa === 'mesic' ? '3 měsíců' : '7 let';
        const uroven = postreh?.druh === 'zlom' ? '<span><i class="uroven"></i>úroveň období</span>' : '';
        if (def.druh === 'udaj') return `${prepinac}<span><i class="cara"></i>medián v okně ${okno}</span><span><i class="pasmo"></i>prostřední polovina (25.–75. percentil)</span>${celek}${uroven}`;
        if (def.druh === 'podil') return `${prepinac}<span><i class="cara"></i>${esc(def.ano)} v okně ${okno}</span><span><i class="pasmo"></i>95% interval spolehlivosti</span>${celek}${uroven}`;
        return `${prepinac}<span><i class="cara"></i>průměr ${okno}</span>${celek}`;
    }
    const prumer = `<span><i class="cara"></i>průměr ${def.osa === 'mesic' ? '3 měsíců' : '7 let'}</span>`;
    const uroven = postreh?.druh === 'zlom' ? '<span><i class="uroven"></i>úroveň období</span>' : '';
    if (def.druh === 'udaj') return `${prepinac}<span><i class="bod"></i>medián roku</span><span><i class="pasmo"></i>prostřední polovina modelek</span>${prumer}${uroven}`;
    return `${prepinac}<span><i></i>${def.druh === 'podil' ? `${def.ano} (% modelek se známým údajem)` : def.osa === 'mesic' ? 'přidané modelky' : `modelky (${popisVyskytu()})`}</span>${celek}${prumer}${uroven}`;
}

// Překreslení grafu (při tažení jen graf), případně i seznamu a lišty
let sloupce = [], rozlozeni = [];
let postreh = null;              // postřeh zobrazeného grafu (zlom kreslí graf: svislice a úrovně období)
function vykreslit(koren, { jenGraf = false } = {}) {
    if (!data || !koren.querySelector('[data-sp-graf]')) return;
    const def = definice();
    const misto = koren.querySelector('[data-sp-graf]');
    koren.querySelector('.graf-bublina')?.classList.add('hidden');
    if (!jenGraf) {
        sloupce = def.osa ? radaVCase(def) : [];
        postreh = def.osa === 'rok' ? postrehyRad().get(def.klic) ?? null : null;
        rozlozeni = def.osa || def.druh === 'mapa' || def.druh === 'obdobi' || def.druh === 'vkus' ? [] : polozkyRozlozeni(def.klic);
    }
    const fokus = /** @type {HTMLElement} */ (document.activeElement)?.closest?.('[data-hodnota]')?.dataset.hodnota;
    const aktivni = /** @type {HTMLElement} */ (document.activeElement);
    const fokusPole = misto.contains(aktivni) && (aktivni.dataset?.soOd ? `[data-so-od="${aktivni.dataset.soOd}"]` : aktivni.dataset?.soDo ? `[data-so-do="${aktivni.dataset.soDo}"]` : '');
    misto.innerHTML = def.druh === 'obdobi' ? htmlObdobi()
        : def.druh === 'vkus' ? htmlVkusu(misto.clientWidth)
        : def.druh === 'mapa'
        ? htmlMapySbirky(misto.clientWidth)
        : def.osa ? htmlGrafuVCase(def, sloupce, misto.clientWidth) : htmlPruhu(def, rozlozeni);
    misto.classList.toggle('cas', Boolean(def.osa));
    misto.classList.toggle('mapa', def.druh === 'mapa');
    if (def.druh === 'mapa') nakreslit(misto);
    if (fokus !== undefined) /** @type {HTMLElement} */ (misto.querySelector(`[data-hodnota="${CSS.escape(fokus)}"]`))?.focus({ preventScroll: true });
    if (fokusPole) /** @type {HTMLElement} */ (misto.querySelector(fokusPole))?.focus({ preventScroll: true });
    misto.classList.toggle('obdobi', def.druh === 'obdobi');
    if (jenGraf) return;
    // Volby pod hledáním: Graf ▾ (skupiny za sebou), filtry Výskyt a Edice (u grafů v čase), barva mapy, výběr z grafu jako
    // zapnutý filtr (× ho zruší) a na konci souhrn
    const ed = ediceVyskytu();
    const stitek = (atribut, klic, nazev, zvoleny) => `<button type="button" class="chip ${zvoleny ? 'active' : ''}" data-${atribut}="${esc(klic)}">${esc(nazev)}</button>`;
    nastavitHtml(koren.querySelector('[data-sp-volby]'), [
        ...Object.keys(SKUPINY).flatMap(s => GRAFY.filter(g => g.skupina === s).map(g => stitek('sp-graf-volba', g.klic, g.nazev, g.klic === graf))),
        ...(def.osa === 'rok' || def.druh === 'obdobi' ? Object.entries(DRUHY_VYSKYTU).map(([k, nazev]) => stitek('sp-druh-volba', k, nazev === 'Vše' ? 'vše' : nazev, k === druhVyskytu)) : []),
        ...((def.osa === 'rok' || def.druh === 'obdobi') && ed.length > 1 ? ['vse', ...ed].map(e => stitek('sp-edice-volba', e, e === 'vse' ? 'vše' : e, e === edice)) : []),
        ...(def.druh === 'mapa' ? Object.entries(BARVY_MAPY).map(([k, b]) => stitek('sp-mapa-barva', k, b.nazev, k === barvaMapy)) : []),
        filtry.size ? `<button type="button" class="chip active" data-sp-vyber="1" data-zrusit-vyber>${esc([...filtry.values()].map(f => f.popis).join(' · '))}</button>` : '',
        `<span>${souhrn(def, sloupce, rozlozeni).replace(/<[^>]+>/g, '')}</span>`,
    ].join(''));
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    koren.querySelector('[data-sp-legenda]').innerHTML = !def.osa || sloupce.length ? htmlLegendy(def) : '';
    const mistoPostrehu = koren.querySelector('[data-sp-postreh]'), htmlP = htmlPostrehu(postreh);
    mistoPostrehu.innerHTML = htmlP;
    mistoPostrehu.hidden = !htmlP;
    // Modelky bez čísla (jen online, bez vydání) nemají rok; kolik jich v grafech v čase není, říká nápověda.
    // U druhu Online jsou to modelky bez online alba s datem nafocení.
    const online = druhVyskytu === 'online';
    const bezCisla = def.osa === 'rok' ? data.modelky.filter(m => !vyskytyModelky(m).some(c => c.druhy.has('online') === online)).length : 0;
    const neni = bezCisla >= 2 && bezCisla <= 4 ? 'nejsou' : 'není';
    koren.querySelector('[data-sp-napoveda]').textContent = def.druh === 'vkus'
        ? 'Z porovnání v Hodnocení: u každé vlastnosti se počítá, jak často vyhraje modelka, která ji má, proti modelce bez ní – za posledních 12 měsíců a dřív. Věta se ukáže, jen když posun projde testem (Fisher s opravou na počet vlastností) a je aspoň 10 procentních bodů. Seznam pod grafem jsou všechny modelky.'
        : def.druh === 'obdobi'
        ? 'Vyber dvě období (desetiletí, nebo vlastní roky od–do). Modelky se řadí podle roku prvního výskytu ve zvolené edici a druhu; ostatní podmínky výběru platí. Rozdíl je průkazný, když vydrží opravu na počet testů a je i podstatně velký. Klik na údaj v tabulce otevře jeho graf.'
        : def.druh === 'mapa'
        ? 'Jak číst mapu: Blízké body znamenají modelky s podobnými údaji (postava, období, vzhled, kategorie); osy nemají jednotky. Klik na bod otevře profil, tažením myší vybereš oblast (laso) pro ostatní grafy; Esc výběr zruší.'
        : def.osa
        ? `Klik na sloupec vybere ${def.osa === 'mesic' ? 'měsíc' : 'rok'}, tažení myší období. Šipky ← → posouvají výběr, se Shiftem ho rozšíří; Esc výběr zruší. Výběr platí pro všechny grafy.${!bezCisla ? ''
            : online ? ` Rok je rok nafocení prvního online alba; ${pocetModelek(bezCisla)} bez online alba s datem v grafech v čase ${neni}.`
            : ` Rok je rok prvního výskytu v časopise; ${pocetModelek(bezCisla)} bez čísla (jen online nebo bez vydání) v grafech v čase ${neni}.`}`
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
    // Výběr zůstává (návrat Zpět ze seznamu modelek do Statistik); ruší ho uživatel nebo změna edice či výskytu
    // Modelky nejčastějších fotografů (backend je hledá stejně jako „fotograf:"…"“ v Modelkách)
    data = { s, modelky, fotografove: new Map(Object.entries(s.modelkyFotografu || {}).map(([jmeno, ids]) => [jmeno, new Set(ids)])) };
    koren.innerHTML = `${htmlKostry()}<div class="graf-bublina hidden"></div>`;
    vykreslit(koren);
    // Při změně šířky se graf v čase překreslí v nové šířce
    const misto = koren.querySelector('[data-sp-graf]');
    let sirka = misto.clientWidth;
    koren._pozorovatelSirky?.disconnect();
    const pozorovatel = new ResizeObserver(() => {
        if (!misto.isConnected || misto.clientWidth === sirka) return;
        sirka = misto.clientWidth;
        if (definice().osa || definice().druh === 'mapa') vykreslit(koren, { jenGraf: true });
    });
    pozorovatel.observe(misto);
    koren._pozorovatelSirky = pozorovatel;
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
        // Mapa na plátně: bod pod myší najde mřížka, bublina čte data-tip z vrstvy nad plátnem
        if (e.target.classList?.contains('sp-mapa-vrstva')) {
            const bod = !lasoTah && bodNaMiste(e.target, e.clientX, e.clientY);
            if (bod) e.target.dataset.tip = bod.tip; else delete e.target.dataset.tip;
            e.target.style.cursor = bod ? 'pointer' : '';
        }
        const cil = !tah && !lasoTah && e.target.closest?.('[data-tip]');
        bublina.classList.toggle('hidden', !cil);
        stats.querySelectorAll('.graf g.aktivni').forEach(g => g !== cil && g.classList.remove('aktivni'));
        if (!cil) return;
        cil.classList.add('aktivni');
        bublina.textContent = cil.dataset.tip;
        bublina.classList.toggle('siroka', 'tipSiroky' in cil.dataset);
        const okraj = bublina.offsetParent.getBoundingClientRect();
        const x = Math.min(e.clientX - okraj.left + 14, okraj.width - bublina.offsetWidth - 8);
        bublina.style.left = `${naCss(x)}px`;
        bublina.style.top = `${naCss(e.clientY - okraj.top + 16)}px`;
    });
    stats.addEventListener('mouseleave', () => stats.querySelectorAll('.graf-bublina').forEach(b => b.classList.add('hidden')));

    // Tažení přes sloupce grafu v čase nebo laso na mapě sbírky; podmínka se nastaví po puštění
    stats.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const cil = /** @type {HTMLElement} */ (e.target);
        const mistoMapa = /** @type {HTMLElement | null} */ (cil.closest?.('[data-sp-graf].mapa'));
        if (mistoMapa) {
            const svg = mistoMapa.querySelector('svg');
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const bodCil = /** @type {HTMLElement | null} */ (cil.closest?.('[data-mapa-id]'));
            const bodPlatna = bodCil ? null : bodNaMiste(svg, e.clientX, e.clientY);
            e.preventDefault();
            mistoMapa.focus({ preventScroll: true });
            mistoMapa.setPointerCapture(e.pointerId);
            lasoTah = [{
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                cilId: bodCil ? parseInt(bodCil.dataset.mapaId, 10) : bodPlatna ? bodPlatna.id : null,
                posunuto: false,
            }];
            return;
        }
        const misto = /** @type {HTMLElement} */ (cil.closest?.('[data-sp-graf].cas'));
        if (!misto) return;
        const i = indexSloupce(misto, e.clientX);
        if (i === null) return;
        e.preventDefault();
        misto.focus({ preventScroll: true });
        misto.setPointerCapture(e.pointerId);
        tah = { start: i, predtim: rozsahVyberu(definice(), sloupce), a: i, b: i };
        vykreslit(misto.closest('.stat-statistiky'), { jenGraf: true });
    });
    stats.addEventListener('pointermove', (e) => {
        if (lasoTah) {
            const mistoMapa = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf].mapa'));
            const svg = mistoMapa?.querySelector('svg');
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const nx = e.clientX - rect.left, ny = e.clientY - rect.top;
            const start = lasoTah[0];
            if (!start.posunuto && Math.hypot(nx - start.x, ny - start.y) >= 5) start.posunuto = true;
            const posledni = lasoTah[lasoTah.length - 1];
            if (Math.hypot(nx - posledni.x, ny - posledni.y) < 3) return;
            lasoTah.push({ x: nx, y: ny });
            let polyEl = svg.querySelector('.sp-laso');
            if (!polyEl) {
                polyEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polyEl.setAttribute('class', 'sp-laso');
                svg.appendChild(polyEl);
            }
            polyEl.setAttribute('points', lasoTah.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
            return;
        }
        if (!tah) return;
        const misto = /** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf]');
        const i = misto && indexSloupce(misto, e.clientX);
        if (i === null || i === undefined || i === tah.b) return;
        tah.b = i;
        vykreslit(misto.closest('.stat-statistiky'), { jenGraf: true });
    });
    stats.addEventListener('pointerup', (e) => {
        if (lasoTah) {
            const koren = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky'));
            const mistoMapa = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf].mapa'));
            const svg = /** @type {HTMLElement | null} */ (mistoMapa?.querySelector('svg'));
            const bodyTahu = lasoTah;
            lasoTah = null;
            if (!bodyTahu[0].posunuto) {
                if (bodyTahu[0].cilId && data) {
                    const m = data.modelky.find(x => x.id === bodyTahu[0].cilId);
                    if (m) otevritDetailModelky(m);
                    return;
                }
                if (filtry.has('mapa')) {
                    filtry.delete('mapa');
                    zobrazitVse = false;
                    if (koren) vykreslit(koren);
                }
                return;
            }
            if (svg && bodyTahu.length >= 3 && data) {
                const W = parseFloat(svg.dataset.mapaW || '320'), H = parseFloat(svg.dataset.mapaH || '360');
                const L = 18, P = 18, T = 18, D = 18;
                const poly = bodyTahu.map(p => ({
                    x: (p.x - L) / (W - L - P) * 2.3 - 1.15,
                    y: 1.15 - (p.y - T) / (H - T - D) * 2.3,
                }));
                const vybraneIds = new Set(
                    dataMapy().body.filter(b => bodVMnohouhelniku(b.x, b.y, poly)).map(b => b.id)
                );
                if (vybraneIds.size > 0) {
                    filtry.set('mapa', {
                        popis: `Výběr na mapě (${pocetModelek(vybraneIds.size)})`,
                        test: m => vybraneIds.has(m.id),
                        dotaz: null,
                    });
                } else {
                    filtry.delete('mapa');
                }
                zobrazitVse = false;
            }
            if (koren) vykreslit(koren);
            return;
        }
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

    // Přerušené tažení (ztráta zachycení ukazatele, systémové gesto) vrátí výběr, jaký byl před tažením
    ['pointercancel', 'lostpointercapture'].forEach(udalost => stats.addEventListener(udalost, (e) => {
        if (!tah && !lasoTah) return;
        tah = null;
        lasoTah = null;
        const koren = /** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky');
        if (koren) vykreslit(koren, { jenGraf: true });
    }));

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
        // Sloupce / Křivka a rozpětí u grafů v čase
        const volbaZobrazeni = /** @type {HTMLElement | null} */ (cil.closest('[data-sp-zobrazeni]'));
        if (volbaZobrazeni) {
            zobrazeniCasu = volbaZobrazeni.dataset.spZobrazeni === 'krivka' ? 'krivka' : 'sloupce';
            try { localStorage.setItem('statistikyZobrazeniCasu', zobrazeniCasu); } catch { /* jen pro toto spuštění */ }
            vykreslit(koren);
            return;
        }
        // Porovnat období: předvolba desetiletí
        const volbaDesetileti = /** @type {HTMLElement | null} */ (cil.closest('[data-so-desetileti]'));
        if (volbaDesetileti) {
            const [klic, d] = volbaDesetileti.dataset.soDesetileti.split(':');
            obdobiSrovnani = { ...obdobiSrovnani, [klic]: { od: Number(d), do: Number(d) + 9 } };
            ulozitObdobi();
            zobrazitVse = false;
            vykreslit(koren);
            return;
        }
        // Graf zvolený v liště pod hledáním (Graf ▾)
        const volbaGrafu = /** @type {HTMLElement | null} */ (cil.closest('[data-sp-graf-volba]'));
        if (volbaGrafu) {
            graf = volbaGrafu.dataset.spGrafVolba;
            zvyraznenaModelkaMapy = null;
            zvyraznit = volbaGrafu.dataset.spZvyraznit ?? null;
            try { localStorage.setItem('grafStatistik', graf); } catch { /* jen pro toto spuštění */ }
            zobrazitVse = false;
            vykreslit(koren);
            return;
        }
        const ven = /** @type {HTMLElement | null} */ (cil.closest('[data-sp-ven]'));
        if (ven) {
            grafVen(koren, ven.dataset.spVen);
            return;
        }
        if (cil.closest('[data-sp-mapa-znovu]')) {
            zapomenoutMapu();
            mapaCache = { data: null, vysledek: null };
            vykreslit(koren, { jenGraf: true });
            return;
        }
        const volbaBarvyMapy = /** @type {HTMLElement | null} */ (cil.closest('[data-sp-mapa-barva]'));
        if (volbaBarvyMapy) {
            barvaMapy = volbaBarvyMapy.dataset.spMapaBarva;
            try { localStorage.setItem('barvaMapyStatistik', barvaMapy); } catch { /* jen pro toto spuštění */ }
            vykreslit(koren);
            return;
        }
        const volbaKatMapy = /** @type {HTMLElement | null} */ (cil.closest('[data-sp-mapa-kategorie]'));
        if (volbaKatMapy) {
            const nazevKat = volbaKatMapy.dataset.spMapaKategorie;
            const klicKat = `${barvaMapy}:${nazevKat}`;
            if (filtry.get('mapa')?.hodnota === klicKat) {
                filtry.delete('mapa');
            } else {
                const rezim = BARVY_MAPY[barvaMapy] || BARVY_MAPY.obdobi;
                // Test se ptá aktuální mapy (po změně dat i nově přidané modelky), ne seznamu z doby kliknutí
                filtry.set('mapa', {
                    hodnota: klicKat,
                    popis: `${rezim.nazev}: ${nazevKat}`,
                    test: m => {
                        const bod = bodMapy(m.id);
                        return !!bod && rezim.hodnota(bod) === nazevKat;
                    },
                    dotaz: null,
                });
            }
            zobrazitVse = false;
            vykreslit(koren);
            return;
        }
        const volbaEdice = cil.closest('[data-sp-edice-volba]');
        const volbaDruhu = cil.closest('[data-sp-druh-volba]');
        const pruh = cil.closest('.sp-pruh[data-hodnota]');
        if (cil.closest('[data-vse-vyberu]')) {
            zobrazitVse = true;
            vykreslit(koren);
            return;
        }
        if (cil.closest('[data-zrusit-vyber]')) {
            filtry.clear();
            zvyraznenaModelkaMapy = null;
        } else if (volbaEdice || volbaDruhu) {
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
    });

    // Klávesnice v grafu v čase: šipky posouvají výběr (Shift rozšiřuje), Home a End; Esc zruší celý výběr
    // Porovnat období: vlastní roky od–do (po potvrzení pole); obrácené pořadí se prohodí
    stats.addEventListener('change', (e) => {
        const pole = /** @type {HTMLInputElement} */ (e.target);
        const klic = pole.dataset?.soOd || pole.dataset?.soDo;
        const koren = pole.closest?.('.stat-statistiky');
        if (!klic || !koren || !data) return;
        const rok = parseInt(pole.value, 10);
        if (!Number.isFinite(rok)) { vykreslit(koren); return; }
        const o = { ...obdobiSrovnani[klic], [pole.dataset.soOd ? 'od' : 'do']: rok };
        obdobiSrovnani = { ...obdobiSrovnani, [klic]: { od: Math.min(o.od, o.do), do: Math.max(o.od, o.do) } };
        ulozitObdobi();
        zobrazitVse = false;
        vykreslit(koren);
    });

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

// ── Hero Statistik (Modelky › Statistiky, app/statistiky-pohled.js) ──────────────────────────────────────────────
// Nejsilnější postřehy celé sbírky (bez výběru) se střídají jako u tipů v Profilech (Další postřeh ↻, další otevření
// začne dalším): název grafu, velká změna („1 % → 35 %“), věta postřehu a na pozadí nejlépe hodnocená modelka
// z období po změně, která danou vlastnost má (u podílu, který roste, modelka s ní; u údaje kterákoli se známým údajem).
const KLIC_HERO = 'statistikyHeroPostreh';
const indexHero = n => { try { return Math.abs(parseInt(localStorage.getItem(KLIC_HERO) || '0', 10) || 0) % Math.max(n, 1); } catch { return 0; } };
const nastavitIndexHero = i => { try { localStorage.setItem(KLIC_HERO, String(i)); } catch { /* jen teď */ } };

function postrehyHero() {
    const mapa = postrehyCeleSbirky();
    const kandidati = [];
    for (const g of GRAFY_POSTREHU()) {
        const p = mapa.get(g.klic);
        if (p) kandidati.push({ ...p, id: `${p.druh}:${g.klic}`, graf: g.klic, def: g });
        const r = neobvykleRoky(g, radaVCase(g), { useky: p?.useky })[0];
        if (r) kandidati.push({ ...r, def: g });
    }
    const vsechnyProSouv = data.modelky.map(modelkaProSouvislosti);
    for (const s of souvislosti(vsechnyProSouv)) {
        const g = GRAFY.find(x => x.klic === s.graf) || GRAFY[0];
        kandidati.push({ ...s, def: g });
    }
    return vybratPostrehy(kandidati);
}

// Modelka na fotku hera: první výskyt v období po změně (nebo ve vybočujícím roce), s titulní fotkou a s vlastností postřehu; nejvýš hodnocená
function modelkaHero(p) {
    const poradi = (a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || (a.poradi || 999) - (b.poradi || 999) || a.id - b.id;
    const def = p.def;
    const vlastnost = m => def.druh === 'podil' ? def.podil(m) === (p.smer > 0)
        : (def.klic === 'vek' ? prvniVyskyt(m)?.vekPresne : def.udaj?.(m)) !== null;
    if (p.druh === 'rok' && p.rok) {
        const vRoce = data.modelky.filter(m => prvniVyskyt(m)?.rok === p.rok && m.coverUrl);
        return vRoce.filter(vlastnost).sort(poradi)[0] || vRoce.sort(poradi)[0] || null;
    }
    if (p.druh === 'souvislost' || !p.hero?.po) {
        const sFotkou = data.modelky.filter(m => m.coverUrl);
        return sFotkou.filter(vlastnost).sort(poradi)[0] || sFotkou.sort(poradi)[0] || null;
    }
    const { odRoku, doRoku } = p.hero.po;
    const vObdobi = data.modelky.filter(m => {
        const c = prvniVyskyt(m);
        return c && c.rok >= odRoku && c.rok <= doRoku && m.coverUrl;
    });
    return vObdobi.filter(vlastnost).sort(poradi)[0] || vObdobi.sort(poradi)[0] || null;
}

// Fotka hera: nejdřív náhled (bývá v mezipaměti), plné rozlišení záhlaví (3840 px, poprvé ze sítě) se vymění až
// po načtení (nahraditFotkuHero) – úvod ani přepnutí na Statistiky na velkou fotku nečekají
async function fotkaHero(m) {
    let nahled = adresaTitulni(m, true), plna = '', styl = stylVyrezu(m);
    try {
        const f = await GetProfilovaFotka(m.id);
        if (f?.url) { nahled = obrazek(f.url, VELIKOST_TITULNI); plna = obrazek(f.url, VELIKOST_ZAHLAVI); styl = stylVyrezu(f); }
    } catch { /* fotka karty */ }
    return { plna, nahled, html: `<div class="ph-ram"><img src="${esc(nahled)}" alt="" style="${esc(styl)}" draggable="false" /></div>
        <div class="ph-prekryv"></div>` };
}
function nahraditFotkuHero(misto, plna) {
    const img = /** @type {HTMLImageElement | null} */ (misto.querySelector('.ph-ram img'));
    if (!plna || !img || img.getAttribute('src') === plna) return;
    const nahled = img.getAttribute('src');
    const velka = new Image();
    velka.decoding = 'async';
    // Mezitím mohl přijít jiný postřeh (jiná fotka)
    velka.onload = () => { if (img.isConnected && img.getAttribute('src') === nahled) img.src = plna; };
    velka.src = plna;
}

// Pás karet pod scénou hera. Bez výběru všechny postřehy sbírky (zvolený je zvýrazněný, klik ho dá do hera);
// s výběrem čím se výběr liší od sbírky a jeho zlomy či trendy (klik přepne graf, hodnotu rozložení zvýrazní).
function htmlPasuHero(seznam, i) {
    if (filtry.size) {
        const { vybrane, zprava } = postrehyVyberu();
        const popis = [...filtry.values()].map(f => f.popis).join(' · ');
        return `<div class="sh-pas-hlava"><b>Výběr</b><span>${esc(popis)}</span><span>· čím se liší od sbírky</span></div>
            ${zprava ? `<p class="sh-pas-prazdno">${zprava}</p>` : ''}
            <div class="sh-karty">${vybrane.map(p => `<button type="button" class="sh-karta" data-sh-graf="${esc(p.graf)}"${p.hodnota ? ` data-sh-zvyraznit="${esc(p.hodnota)}"` : ''}
                data-tip="${esc(p.podrobnosti)}" data-tip-siroky aria-description="${esc(p.podrobnosti)}">
                <span class="sh-karta-graf"><i aria-hidden="true">${p.ikona}</i>${esc(GRAFY.find(g => g.klic === p.graf)?.nazev || '')}</span>
                <span class="sh-karta-veta">${esc(p.veta)}</span></button>`).join('')}</div>`;
    }
    if (seznam.length < 2) return '';
    const ikonaKarty = p => p.druh === 'rok' ? '◆' : p.druh === 'souvislost' ? '∼' : p.smer > 0 ? '↗' : '↘';
    return `<div class="sh-pas-hlava"><b>Postřehy sbírky</b><span>co je ve sbírce průkazné · klik ukáže postřeh nahoře</span></div>
        <div class="sh-karty">${seznam.map((p, k) => `<button type="button" class="sh-karta${k === i ? ' zvolena' : ''}" data-sh-index="${k}" aria-pressed="${k === i}"
            data-tip="${esc(p.podrobnosti)}" data-tip-siroky aria-description="${esc(p.podrobnosti)}">
            <span class="sh-karta-graf"><i aria-hidden="true">${ikonaKarty(p)}</i>${esc(p.def.nazev)}</span>
            <span class="sh-karta-zmena">${esc(p.hero.text)}</span>
            <span class="sh-karta-veta">${esc(p.veta)}</span></button>`).join('')}</div>`;
}
function obnovitPasHero(misto, stavHero = heroPostrehy) {
    const pas = misto.querySelector('[data-sh-pas]');
    if (!pas || !stavHero) return;
    const html = htmlPasuHero(stavHero.seznam, stavHero.index);
    pas.innerHTML = html;
    pas.hidden = !html;
}

// Přepne graf pod herem (a případně zvýrazní hodnotu rozložení nebo vybere rok) a posune na něj
function ukazatGraf(misto, klicGrafu, hodnota = null, rok = null) {
    const koren = /** @type {HTMLElement | null} */ (misto.parentElement?.querySelector('.stat-statistiky'));
    graf = klicGrafu;
    zvyraznit = hodnota;
    try { localStorage.setItem('grafStatistik', graf); } catch { /* jen pro toto spuštění */ }
    if (koren) {
        if (rok) {
            const def = definice();
            sloupce = def.osa ? radaVCase(def) : [];
            const idx = sloupce.findIndex(s => s.rok === rok);
            if (idx >= 0) nastavitRozsah(def, idx, idx);
        }
        vykreslit(koren);
        koren.querySelector('.sp-telo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

let volaniHero = 0;       // pořadí naplnění hera: dokreslí jen poslední
let heroPostrehy = null;   // { data, klic, seznam, index } – pro data, edici a výskyt, ve kterých se spočítaly
export async function naplnitHeroStatistik(misto, { znovu = false, jenPriZmene = false } = {}) {
    if (!misto || !data) return;
    const klic = `${edice}|${druhVyskytu}`;
    // Po překreslení grafu (změna výběru) se obnoví jen pás karet; scéna s fotkou se mění při změně edice, výskytu
    // nebo dat (jinak by fotka poblikávala). První naplnění dělá otevření pohledu.
    if (jenPriZmene && !heroPostrehy) return;
    if (jenPriZmene && heroPostrehy.data === data && heroPostrehy.klic === klic) return obnovitPasHero(misto);
    if (znovu || !heroPostrehy || heroPostrehy.data !== data || heroPostrehy.klic !== klic) heroPostrehy = { data, klic, seznam: postrehyHero(), index: 0 };
    // Během čekání na fotku mohlo přijít novější naplnění (nová data, jiný postřeh): staré pak nic nevykreslí
    const stavHero = heroPostrehy;
    const volani = ++volaniHero;
    const prekonano = () => !misto.isConnected || heroPostrehy !== stavHero || volani !== volaniHero;
    const seznam = stavHero.seznam;
    const pas = '<div class="sh-pas" data-sh-pas hidden></div>';
    if (!seznam.length) {
        // Bez průkazného postřehu: sbírka v číslech s nejlépe hodnocenou modelkou
        const m = [...data.modelky].filter(x => x.coverUrl).sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || a.id - b.id)[0];
        const roky = data.modelky.map(x => prvniVyskyt(x)?.rok).filter(Boolean);
        if (!m) return misto.remove();
        const foto = await fotkaHero(m);
        if (prekonano()) return;
        misto.innerHTML = `<div class="ph-rozmazane" style="background-image:url('${esc(foto.nahled).replace(/'/g, '%27')}')"></div>
            <div class="sh-scena">${foto.html}<div class="ph-obsah"><div class="ph-nadtitulek">Statistiky sbírky</div><h2>Tvoje sbírka</h2>
            <div class="sh-zmena">${pocetModelek(data.modelky.length)}${roky.length ? ` · ${Math.min(...roky)}–${Math.max(...roky)}` : ''}</div>
            <p class="ph-duvod">Zatím tu není nic průkazného – postřehy se ukážou, až bude víc modelek se známými údaji.</p>
            <div class="ph-akce">${TLACITKO_ROKU}</div></div></div>${pas}`;
        nahraditFotkuHero(misto, foto.plna);
    } else {
        const i = indexHero(seznam.length), p = seznam[i];
        stavHero.index = i;
        const m = modelkaHero(p);
        const foto = m ? await fotkaHero(m) : { html: '', plna: '', nahled: '' };
        if (prekonano()) return;
        misto.innerHTML = `${foto.nahled ? `<div class="ph-rozmazane" style="background-image:url('${esc(foto.nahled).replace(/'/g, '%27')}')"></div>` : ''}
            <div class="sh-scena">${foto.html}
                <div class="ph-obsah">
                    <div class="ph-nadtitulek">Postřeh sbírky${seznam.length > 1 ? ` · ${i + 1} z ${seznam.length}` : ''}</div>
                    <h2>${esc(p.def.nazev)}</h2>
                    <div class="sh-zmena">${esc(p.hero.text)}</div>
                    <p class="ph-duvod">${esc(p.veta)}</p>
                    <div class="ph-akce">
                        <button type="button" class="ph-tlacitko hlavni" data-sh-graf="${esc(p.graf)}"${p.rok ? ` data-sh-rok="${p.rok}"` : ''}>Ukázat v grafu</button>
                        ${m ? `<button type="button" class="ph-tlacitko" data-sh-modelka="${m.id}" title="Na fotce – otevřít profil">${esc(m.jmeno)} →</button>` : ''}
                        ${TLACITKO_ROKU}
                    </div>
                </div>
            </div>${pas}`;
        nahraditFotkuHero(misto, foto.plna);
    }
    obnovitPasHero(misto, stavHero);
    misto.onclick = (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const tlGraf = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-graf]'));
        if (tlGraf) return ukazatGraf(misto, tlGraf.dataset.shGraf, tlGraf.dataset.shZvyraznit ?? null, tlGraf.dataset.shRok ? parseInt(tlGraf.dataset.shRok, 10) : null);
        const karta = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-index]'));
        if (karta) {
            const k = parseInt(karta.dataset.shIndex, 10);
            if (k === heroPostrehy?.index) return;
            nastavitIndexHero(k);
            naplnitHeroStatistik(misto);
            return;
        }
        const tlModelka = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-modelka]'));
        if (tlModelka) {
            const mm = data.modelky.find(x => x.id === parseInt(tlModelka.dataset.shModelka, 10));
            if (mm) otevritDetailModelky(mm);
        }
    };
}

// Při další návštěvě se Statistiky spočítají z čerstvých dat (výběr zůstává)
export function zapomenoutStatistiky(koren) {
    if (koren) delete koren.dataset.nacteno;
    heroPostrehy = null;
    mapaCache = { data: null, vysledek: null };
    vkusData = null;
}
