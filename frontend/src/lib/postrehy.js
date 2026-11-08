// Postřehy ve Statistikách (docs/NAVRH-POSTREHY.md): krátké české věty o tom, co je ve sbírce průkazné.
// Krok 1 – trend u grafu v čase: test na úrovni modelek (údaj Kendallovo τ_b rok × hodnota, podíl Cochran–Armitage),
// velikost změny z prvního a posledního desetiletí s dost modelkami. Postřeh se ukáže, jen když test projde
// a změna je prakticky podstatná (práh grafu, u podílu 10 procentních bodů) – raději žádný postřeh než šum.
// Bez DOM; hodnoty se počítají ze stejných sloupců jako graf (lib/statistika.js má testy proti SciPy).
import { benjaminiHochberg, cochranArmitage, fisher, kendallTauB, mannWhitney, median, theilSen, wilson } from './statistika.js';

export const ALFA = 0.05;
export const MIN_LET = 10;          // let s aspoň jednou modelkou se známým údajem
export const MIN_MODELEK = 60;      // modelek se známým údajem v celé řadě
export const MIN_V_OBDOBI = 10;     // modelek v desetiletí, aby šlo do věty
export const MIN_V_ROCE = 5;        // modelek v roce, aby se rok počítal do tempa (Theil–Sen)
export const PRAH_PODILU = 10;      // procentních bodů

// Pevný počet desetinných míst („0,70“, „18,0“), aby hodnoty v jedné větě a bublině měly stejný tvar
const cislo = (n, desetinna = 0) => Number(n.toFixed(desetinna)).toLocaleString('cs-CZ', { minimumFractionDigits: desetinna, maximumFractionDigits: desetinna });

// Předložka „z“ nebo „ze“ před číslem podle toho, jak se vysloví („ze 168“, „ze 7“, „z 24“)
export function predlozkaZ(n) {
    let i = Math.floor(Math.abs(n));
    while (i >= 1000) {
        if (i < 2000) return 'z';
        i = Math.floor(i / 1000);
    }
    if (i >= 100) return [1, 6, 7].includes(Math.floor(i / 100)) ? 'ze' : 'z';
    if (i >= 20) return [6, 7].includes(Math.floor(i / 10)) ? 'ze' : 'z';
    return [6, 7, 16, 17].includes(i) ? 'ze' : 'z';
}

// Období z let s daty v desetiletí: věta („v 60. letech“, „v letech 2010–2019“, „v roce 2025“) a popisek do bublin
export function obdobi(roky) {
    const od = roky[0], doRoku = roky.at(-1), dekada = Math.floor(od / 10) * 10;
    if (od === doRoku) return { veta: `v roce ${od}`, popisek: String(od) };
    if (dekada < 2000 && od === dekada && doRoku === dekada + 9) return { veta: `v ${dekada % 100}. letech`, popisek: `${dekada % 100}. léta` };
    return { veta: `v letech ${od}–${doRoku}`, popisek: `${od}–${doRoku}` };
}

const procentniBody = n => {
    const a = Math.abs(n);
    return `${a === 1 ? 'procentní bod' : a >= 2 && a <= 4 ? 'procentní body' : 'procentních bodů'}`;
};
const modelek = n => `${cislo(n)} ${n === 1 ? 'modelka' : n >= 2 && n <= 4 ? 'modelky' : 'modelek'}`;
const textP = p => p < 0.001 ? 'p < 0,001' : `p = ${cislo(p, 3)}`;

// Trend řady v čase. def: { druh: 'udaj' | 'podil', nazev, jednotka?, desetinna?, prah? (údaj), sKym? (podíl,
// „s tetováním“) }; sloupce: [{ rok, polozky: [{ hodnota }] }] (údaj číslo, podíl true/false).
// volby.vyber: věta řekne „ve výběru“; volby.kontext: věta na konec bublin (edice, druh výskytu, známé údaje).
// Vrací { smer: 1 | -1, veta, podrobnosti, test, od, do } nebo null, když trend není průkazný nebo podstatný.
export function trendRady(def, sloupce, { vyber = false, kontext = '' } = {}) {
    if (def.druh !== 'udaj' && def.druh !== 'podil') return null;
    const sDaty = sloupce.filter(s => s.polozky.length);
    const n = sDaty.reduce((s, x) => s + x.polozky.length, 0);
    if (sDaty.length < MIN_LET || n < MIN_MODELEK) return null;

    const podil = def.druh === 'podil';
    let test;
    if (podil) {
        test = cochranArmitage(sDaty.map(s => ({ x: s.rok, n: s.polozky.length, ano: s.polozky.filter(p => p.hodnota).length })));
    } else {
        const x = [], y = [];
        sDaty.forEach(s => s.polozky.forEach(p => { x.push(s.rok); y.push(p.hodnota); }));
        test = kendallTauB(x, y);
    }
    if (!test || !(test.p <= ALFA)) return null;

    // Úrovně v prvním a posledním desetiletí s dost modelkami
    const dekady = new Map();
    sDaty.forEach(s => {
        const d = Math.floor(s.rok / 10) * 10;
        if (!dekady.has(d)) dekady.set(d, { roky: [], polozky: [] });
        dekady.get(d).roky.push(s.rok);
        dekady.get(d).polozky.push(...s.polozky);
    });
    const dost = [...dekady.values()].filter(d => d.polozky.length >= MIN_V_OBDOBI);
    if (dost.length < 2) return null;
    const uroven = d => {
        const k = d.polozky.length;
        if (podil) {
            const ano = d.polozky.filter(p => p.hodnota).length, ci = wilson(ano, k);
            return { ...obdobi(d.roky), n: k, hodnota: ano / k * 100, dolni: ci.dolni * 100, horni: ci.horni * 100 };
        }
        const h = Float64Array.from(d.polozky, p => p.hodnota).sort();
        const q = f => { const poz = f * (k - 1), i = Math.floor(poz); return h[i] + ((h[Math.ceil(poz)] ?? h[i]) - h[i]) * (poz - i); };
        return { ...obdobi(d.roky), n: k, hodnota: q(0.5), dolni: q(0.25), horni: q(0.75) };
    };
    const od = uroven(dost[0]), doU = uroven(dost.at(-1));
    const smer = Math.sign(test.z);
    const zmena = doU.hodnota - od.hodnota;
    const prah = podil ? PRAH_PODILU : def.prah ?? 0;
    if (Math.sign(zmena) !== smer || Math.abs(zmena) < prah) return null;

    const des = podil ? 0 : def.desetinna ?? 0;
    const jednotka = podil ? ' %' : def.jednotka ? ` ${def.jednotka}` : '';
    const hodnota = v => `${cislo(v, des)}${jednotka}`;
    const sloveso = smer > 0 ? 'roste' : 'klesá';
    const podmet = podil ? `Podíl modelek ${def.sKym}` : def.nazev;
    const veta = `${podmet}${vyber ? ' ve výběru' : ''} průkazně ${sloveso}: ${predlozkaZ(Number(od.hodnota.toFixed(des)))} ${hodnota(od.hodnota)} ${od.veta} na ${hodnota(doU.hodnota)} ${doU.veta}.`;

    // Bublina: úrovně obou období, tempo za 10 let z ročních hodnot (Theil–Sen) a test
    const popisUrovne = u => podil
        ? `${u.popisek}: ${hodnota(u.hodnota)} (${cislo(u.dolni)}–${cislo(u.horni)} %, ${modelek(u.n)})`
        : `${u.popisek}: ${hodnota(u.hodnota)}, polovina modelek ${cislo(u.dolni, des)}–${hodnota(u.horni)} (${modelek(u.n)})`;
    const roky = sDaty.filter(s => s.polozky.length >= MIN_V_ROCE);
    const sklon = roky.length >= 3 ? theilSen(roky.map(s => s.rok), roky.map(s => podil
        ? s.polozky.filter(p => p.hodnota).length / s.polozky.length * 100
        : median(s.polozky.map(p => p.hodnota)))) : null;
    const za10 = sklon === null ? null : sklon * 10;
    const tempo = za10 === null || Number(za10.toFixed(podil ? 0 : Math.max(1, des))) === 0 ? ''
        : podil ? ` Tempo asi ${za10 > 0 ? '+' : '−'}${cislo(Math.abs(za10))} ${procentniBody(Math.round(za10))} za 10 let.`
        : ` Tempo asi ${za10 > 0 ? '+' : '−'}${cislo(Math.abs(za10), Math.max(1, des))}${jednotka} za 10 let.`;
    const nazevTestu = podil ? 'Cochranův–Armitageův test' : `Kendallovo τ = ${cislo(test.tau, 2)}`;
    const podrobnosti = `${popisUrovne(od)}. ${popisUrovne(doU)}.${tempo} ${nazevTestu} přes ${modelek(test.n)}, ${textP(test.p)}.${kontext ? ` ${kontext}` : ''}`;
    return { smer, veta, podrobnosti, test, od, do: doU };
}

// ── Krok 2: zlomy ─────────────────────────────────────────────────────────────────────────────────────────────────
// Optimální rozdělení řady let na úseky (úplné dynamické programování): náklad úseku u podílu binomická deviance,
// u údaje L1 odchylka od mediánu úseku (Laplaceova deviance, měřítko z celé řady); pokuta β = c · ln N za každý
// zlom. Úsek má aspoň 5 let a 30 modelek, zlomy nejvýš 3. Každý zlom se pak ověří testem sousedních úseků
// (Mann–Whitney / Fisher, oprava BH přes zlomy řady) a prahem podstatnosti; neprůkazný se zahodí a úseky sloučí.
export const MIN_USEK_LET = 5;
export const MIN_USEK_MODELEK = 30;
export const MAX_ZLOMU = 3;
// c v pokutě β = c · ln N, nakalibrované simulací řad bez zlomu (30–70 let, 1–80 modelek ročně): falešný zlom
// po ověření asi u 2 % řad; skok výšky o 3 cm nebo podílu o 15 bodů se při 25 modelkách ročně najde v 99 a 92 %
export const POKUTA = { udaj: 2.5, podil: 1.5 };

// Řada bez prázdných let na začátku a na konci
const oriznout = sloupce => {
    const a = sloupce.findIndex(s => s.polozky.length), b = sloupce.findLastIndex(s => s.polozky.length);
    return a < 0 ? [] : sloupce.slice(a, b + 1);
};

// Nejlepší rozdělení řady na 1…MAX_ZLOMU+1 úseků; vrací indexy začátků úseků kromě prvního (zlomy)
export function rozdelitRadu(def, rada, c = POKUTA[def.druh]) {
    const T = rada.length, podil = def.druh === 'podil';
    const pn = new Float64Array(T + 1);
    rada.forEach((s, t) => { pn[t + 1] = pn[t] + s.polozky.length; });
    const N = pn[T];
    if (T < 2 * MIN_USEK_LET || N < 2 * MIN_USEK_MODELEK) return [];
    let naklad;
    if (podil) {
        const pa = new Float64Array(T + 1);
        rada.forEach((s, t) => { pa[t + 1] = pa[t] + s.polozky.filter(p => p.hodnota).length; });
        const xlnx = (x, n) => x > 0 ? x * Math.log(x / n) : 0;
        naklad = (a, b) => {
            const n = pn[b + 1] - pn[a], ano = pa[b + 1] - pa[a];
            return -2 * (xlnx(ano, n) + xlnx(n - ano, n));
        };
    } else {
        // Hodnoty v přihrádkách po kroku zobrazení (1 cm, 0,1 BMI, 0,01 poměru); kumulativní počty po letech
        const krok = 10 ** -(def.desetinna ?? 0);
        const prihradky = [...new Set(rada.flatMap(s => s.polozky.map(p => Math.round(p.hodnota / krok))))].sort((x, y) => x - y);
        const K = prihradky.length, index = new Map(prihradky.map((h, i) => [h, i]));
        const P = new Float64Array((T + 1) * K);
        rada.forEach((s, t) => {
            P.set(P.subarray(t * K, (t + 1) * K), (t + 1) * K);
            s.polozky.forEach(p => { P[(t + 1) * K + index.get(Math.round(p.hodnota / krok))]++; });
        });
        const pocty = new Float64Array(K);
        const odchylka = (a, b) => {
            let n = 0;
            for (let k = 0; k < K; k++) { pocty[k] = P[(b + 1) * K + k] - P[a * K + k]; n += pocty[k]; }
            let kum = 0, m = 0;
            while (kum + pocty[m] < n / 2) kum += pocty[m++];
            let s = 0;
            for (let k = 0; k < K; k++) s += pocty[k] * Math.abs(prihradky[k] - prihradky[m]);
            return s;
        };
        const meritko = odchylka(0, T - 1) / N;
        if (!meritko) return [];
        naklad = (a, b) => 2 * odchylka(a, b) / meritko;
    }
    const platny = (a, b) => b - a + 1 >= MIN_USEK_LET && pn[b + 1] - pn[a] >= MIN_USEK_MODELEK;
    const beta = c * Math.log(N);
    // nejlepsi[k][j] = nejmenší náklad prvních j+1 let v k+1 úsecích; odkud[k][j] = začátek posledního úseku
    const nejlepsi = [], odkud = [];
    nejlepsi[0] = Array.from({ length: T }, (_, j) => platny(0, j) ? naklad(0, j) : Infinity);
    odkud[0] = new Array(T).fill(0);
    for (let k = 1; k <= MAX_ZLOMU; k++) {
        nejlepsi[k] = new Array(T).fill(Infinity);
        odkud[k] = new Array(T).fill(-1);
        for (let j = 0; j < T; j++) {
            for (let i = 1; i <= j; i++) {
                if (nejlepsi[k - 1][i - 1] === Infinity || !platny(i, j)) continue;
                const v = nejlepsi[k - 1][i - 1] + naklad(i, j);
                if (v < nejlepsi[k][j]) { nejlepsi[k][j] = v; odkud[k][j] = i; }
            }
        }
    }
    let kNej = 0;
    for (let k = 1; k <= MAX_ZLOMU; k++) if (nejlepsi[k][T - 1] + beta * k < nejlepsi[kNej][T - 1] + beta * kNej) kNej = k;
    const zlomy = [];
    for (let k = kNej, j = T - 1; k > 0; k--) {
        const i = odkud[k][j];
        zlomy.unshift(i);
        j = i - 1;
    }
    return zlomy;
}

// Úroveň úseku: podíl s Wilsonovým intervalem, nebo medián s prostřední polovinou modelek
function urovenUseku(def, rada, a, b) {
    const polozky = rada.slice(a, b + 1).flatMap(s => s.polozky);
    const roky = rada.slice(a, b + 1).filter(s => s.polozky.length).map(s => s.rok);
    const k = polozky.length, zaklad = { ...obdobi(roky), a, b, odRoku: rada[a].rok, doRoku: rada[b].rok, n: k, polozky };
    if (def.druh === 'podil') {
        const ano = polozky.filter(p => p.hodnota).length, ci = wilson(ano, k);
        return { ...zaklad, ano, hodnota: ano / k * 100, dolni: ci.dolni * 100, horni: ci.horni * 100 };
    }
    const h = Float64Array.from(polozky, p => p.hodnota).sort();
    const q = f => { const poz = f * (k - 1), i = Math.floor(poz); return h[i] + ((h[Math.ceil(poz)] ?? h[i]) - h[i]) * (poz - i); };
    return { ...zaklad, ano: 0, hodnota: q(0.5), dolni: q(0.25), horni: q(0.75) };
}

// Zlomy řady ověřené testem a prahem: { useky, zlomy: [{ rok, p, q, zmena }] }; bez zlomu zlomy prázdné
export function zlomyRady(def, sloupce, c = POKUTA[def.druh]) {
    const rada = oriznout(sloupce);
    if (!rada.length) return { useky: [], zlomy: [], rada };
    let zacatky = rozdelitRadu(def, rada, c);
    const prah = def.druh === 'podil' ? PRAH_PODILU : def.prah ?? 0;
    for (;;) {
        const meze = [0, ...zacatky, rada.length];
        const useky = meze.slice(0, -1).map((a, i) => urovenUseku(def, rada, a, meze[i + 1] - 1));
        const p = useky.slice(1).map((u, i) => {
            const v = useky[i];
            return def.druh === 'podil'
                ? fisher(v.ano, v.n - v.ano, u.ano, u.n - u.ano)
                : mannWhitney(v.polozky.map(x => x.hodnota), u.polozky.map(x => x.hodnota))?.p ?? 1;
        });
        const q = benjaminiHochberg(p);
        const zlomy = zacatky.map((z, i) => ({ rok: rada[z].rok, p: p[i], q: q[i], zmena: useky[i + 1].hodnota - useky[i].hodnota }));
        const spatne = zlomy.map((z, i) => ({ i, z })).filter(({ z }) => !(z.q <= ALFA) || Math.abs(z.zmena) < prah);
        if (!spatne.length) return { useky: useky.map(({ polozky, ...u }) => u), zlomy, rada };
        // Zahodí se nejslabší neprůkazný zlom (největší q, při shodě nejmenší změna) a ověří se znovu
        const nejhorsi = spatne.sort((x, y) => y.z.q - x.z.q || Math.abs(x.z.zmena) - Math.abs(y.z.zmena))[0];
        zacatky = zacatky.filter((_, i) => i !== nejhorsi.i);
    }
}

// Podmět věty o zlomu malým písmenem („výška“, „BMI“, „podíl modelek s tetováním“) a sloveso v minulém čase podle rodu
const podmetMale = def => def.druh === 'podil' ? `podíl modelek ${def.sKym}`
    : /^\p{Lu}\p{Ll}/u.test(def.nazev) ? def.nazev[0].toLowerCase() + def.nazev.slice(1) : def.nazev;
const minule = (def, smer) => {
    const koncovka = def.druh === 'podil' ? '' : { f: 'a', n: 'o' }[def.rod] ?? '';
    return `${smer > 0 ? 'vzrostl' : 'klesl'}${koncovka}`;
};

// Postřeh řady v čase: průkazný zlom má přednost před trendem (říká víc – kdy a o kolik), jinak trend.
// Vrací { druh: 'zlom' | 'trend', smer, veta, podrobnosti, useky?, zlomy? } nebo null.
export function postrehRady(def, sloupce, { vyber = false, kontext = '' } = {}) {
    if (def.druh !== 'udaj' && def.druh !== 'podil') return null;
    const { useky, zlomy } = zlomyRady(def, sloupce);
    if (!zlomy.length) {
        const t = trendRady(def, sloupce, { vyber, kontext });
        return t && { druh: 'trend', ...t };
    }
    const podil = def.druh === 'podil';
    const des = podil ? 0 : def.desetinna ?? 0;
    const jednotka = podil ? ' %' : def.jednotka ? ` ${def.jednotka}` : '';
    const hodnota = v => `${cislo(v, des)}${jednotka}`;
    // Ve větě nejvýraznější zlom (změna vzhledem k prahu podstatnosti)
    const i = zlomy.reduce((nej, z, k) => Math.abs(z.zmena) > Math.abs(zlomy[nej].zmena) ? k : nej, 0);
    const pred = useky[i], po = useky[i + 1], smer = Math.sign(zlomy[i].zmena);
    const veta = `Od roku ${zlomy[i].rok} ${podmetMale(def)}${vyber ? ' ve výběru' : ''} průkazně ${minule(def, smer)}: `
        + `${predlozkaZ(Number(pred.hodnota.toFixed(des)))} ${hodnota(pred.hodnota)} ${pred.veta} na ${hodnota(po.hodnota)} ${po.veta}.`;
    const popisUseku = u => podil
        ? `${u.popisek}: ${hodnota(u.hodnota)} (${cislo(u.dolni)}–${cislo(u.horni)} %, ${modelek(u.n)})`
        : `${u.popisek}: ${hodnota(u.hodnota)}, polovina modelek ${cislo(u.dolni, des)}–${hodnota(u.horni)} (${modelek(u.n)})`;
    const test = podil ? 'Fisherův test' : 'Mannův–Whitneyův test';
    const oprava = zlomy.length > 1 ? `, po opravě na ${zlomy.length} zlomy` : '';
    const overeni = zlomy.map(z => `Zlom ${z.rok}: ${test} sousedních období${oprava} ${textP(z.q)}.`).join(' ');
    const podrobnosti = `${useky.map(popisUseku).join('. ')}. ${overeni}${kontext ? ` ${kontext}` : ''}`;
    return { druh: 'zlom', smer, veta, podrobnosti, useky, zlomy };
}
