// Postřehy ve Statistikách (docs/NAVRH-POSTREHY.md): krátké české věty o tom, co je ve sbírce průkazné.
// Krok 1 – trend u grafu v čase: test na úrovni modelek (údaj Kendallovo τ_b rok × hodnota, podíl Cochran–Armitage),
// velikost změny z prvního a posledního desetiletí s dost modelkami. Postřeh se ukáže, jen když test projde
// a změna je prakticky podstatná (práh grafu, u podílu 10 procentních bodů) – raději žádný postřeh než šum.
// Bez DOM; hodnoty se počítají ze stejných sloupců jako graf (lib/statistika.js má testy proti SciPy).
import { benjaminiHochberg, cochranArmitage, fisher, kendallTauB, mannWhitney, median, pOboustranne, poradi, theilSen, wilson } from './statistika.js';

export const ALFA = 0.05;
export const MIN_LET = 10;          // let s aspoň jednou modelkou se známým údajem
export const MIN_MODELEK = 60;      // modelek se známým údajem v celé řadě
export const MIN_V_OBDOBI = 10;     // modelek v desetiletí, aby šlo do věty
export const MIN_V_ROCE = 5;        // modelek v roce, aby se rok počítal do tempa (Theil–Sen)
export const PRAH_PODILU = 10;      // procentních bodů

// Pevný počet desetinných míst („0,70“, „18,0“), aby hodnoty v jedné větě a bublině měly stejný tvar
const formatyCisel = new Map();
const cislo = (n, desetinna = 0) => {
    let fmt = formatyCisel.get(desetinna);
    if (!fmt) {
        fmt = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: desetinna, maximumFractionDigits: desetinna });
        formatyCisel.set(desetinna, fmt);
    }
    return fmt.format(Number(n.toFixed(desetinna))).replace('-', '−');
};

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

// Velikost rozdílu dvou skupin položek a síla 0–1 pro řazení postřehů: údaj Cliffovo δ (síla |δ| / 0,5),
// podíl Cohenovo h (síla |h| / 0,8). Jistota z p (nebo q po opravě): −log₁₀ p / 4, nejvýš 1.
export function velikostRozdilu(druh, a, b) {
    if (druh === 'podil') {
        const pa = a.filter(x => x.hodnota).length / a.length, pb = b.filter(x => x.hodnota).length / b.length;
        return 2 * Math.asin(Math.sqrt(pb)) - 2 * Math.asin(Math.sqrt(pa));
    }
    const v = mannWhitney(b.map(x => x.hodnota), a.map(x => x.hodnota));
    return v ? 2 * v.u / (a.length * b.length) - 1 : 0;
}
export const skorePostrehu = (druh, velikost, p) =>
    Math.min(1, Math.abs(velikost) / (druh === 'podil' ? 0.8 : 0.5)) * Math.min(1, -Math.log10(Math.max(p, 1e-300)) / 4);

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
        const x = new Float64Array(n), y = new Float64Array(n);
        let pos = 0;
        for (let i = 0; i < sDaty.length; i++) {
            const rok = sDaty[i].rok, pol = sDaty[i].polozky;
            for (let j = 0; j < pol.length; j++) {
                x[pos] = rok;
                y[pos++] = pol[j].hodnota;
            }
        }
        test = kendallTauB(x, y);
    }
    if (!test || !(test.p <= ALFA)) return null;

    // Úrovně v prvním a posledním desetiletí s dost modelkami
    const dekady = new Map();
    for (let i = 0; i < sDaty.length; i++) {
        const s = sDaty[i], d = Math.floor(s.rok / 10) * 10;
        let zaznam = dekady.get(d);
        if (!zaznam) {
            zaznam = { roky: [], sloupce: [], n: 0 };
            dekady.set(d, zaznam);
        }
        zaznam.roky.push(s.rok);
        zaznam.sloupce.push(s.polozky);
        zaznam.n += s.polozky.length;
    }
    const dost = [...dekady.values()].filter(d => d.n >= MIN_V_OBDOBI);
    if (dost.length < 2) return null;
    const uroven = d => {
        const k = d.n;
        if (podil) {
            let ano = 0;
            for (const pol of d.sloupce) for (let i = 0; i < pol.length; i++) if (pol[i].hodnota) ano++;
            const ci = wilson(ano, k);
            return { zaklad: { ...obdobi(d.roky), n: k, hodnota: ano / k * 100, dolni: ci.dolni * 100, horni: ci.horni * 100 }, ano };
        }
        const h = new Float64Array(k);
        let pos = 0;
        for (const pol of d.sloupce) for (let i = 0; i < pol.length; i++) h[pos++] = pol[i].hodnota;
        h.sort();
        const q = f => { const poz = f * (k - 1), i = Math.floor(poz); return h[i] + ((h[Math.ceil(poz)] ?? h[i]) - h[i]) * (poz - i); };
        return { zaklad: { ...obdobi(d.roky), n: k, hodnota: q(0.5), dolni: q(0.25), horni: q(0.75) }, serazene: h };
    };
    const uOd = uroven(dost[0]), uDo = uroven(dost.at(-1));
    const od = { ...uOd.zaklad, odRoku: dost[0].roky[0], doRoku: dost[0].roky.at(-1) };
    const doU = { ...uDo.zaklad, odRoku: dost.at(-1).roky[0], doRoku: dost.at(-1).roky.at(-1) };
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
        : median(Float64Array.from(s.polozky, p => p.hodnota)))) : null;
    const za10 = sklon === null ? null : sklon * 10;
    const tempo = za10 === null || Number(za10.toFixed(podil ? 0 : Math.max(1, des))) === 0 ? ''
        : podil ? ` Tempo asi ${za10 > 0 ? '+' : '−'}${cislo(Math.abs(za10))} ${procentniBody(Math.round(za10))} za 10 let.`
        : ` Tempo asi ${za10 > 0 ? '+' : '−'}${cislo(Math.abs(za10), Math.max(1, des))}${jednotka} za 10 let.`;
    const nazevTestu = podil ? 'Cochranův–Armitageův test' : `Kendallovo τ = ${cislo(test.tau, 2)}`;
    const podrobnosti = `${popisUrovne(od)}. ${popisUrovne(doU)}.${tempo} ${nazevTestu} přes ${modelek(test.n)}, ${textP(test.p)}.${kontext ? ` ${kontext}` : ''}`;
    const velikost = podil
        ? 2 * Math.asin(Math.sqrt(uDo.ano / doU.n)) - 2 * Math.asin(Math.sqrt(uOd.ano / od.n))
        : (() => { const v = mannWhitney(uDo.serazene, uOd.serazene, true); return v ? 2 * v.u / (od.n * doU.n) - 1 : 0; })();
    const skore = skorePostrehu(def.druh, velikost, test.p);
    return { smer, veta, podrobnosti, test, od, do: doU, skore,
        hero: { pred: od, po: doU, text: `${podil ? hodnota(od.hodnota) : cislo(od.hodnota, des)} → ${hodnota(doU.hodnota)}` } };
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
        const vse = new Float64Array(N);
        let pos = 0;
        for (let t = 0; t < T; t++) {
            const pol = rada[t].polozky;
            for (let i = 0; i < pol.length; i++) vse[pos++] = Math.round(pol[i].hodnota / krok);
        }
        const serazeneVse = Float64Array.from(vse).sort();
        let K = 0;
        for (let i = 0; i < N; i++) {
            if (i === 0 || serazeneVse[i] !== serazeneVse[i - 1]) serazeneVse[K++] = serazeneVse[i];
        }
        const prihradky = serazeneVse.subarray(0, K);
        // Dvojrozměrné kumulativní součty (roky × přihrádky): CP = počet a CS = součet hodnot v letech před t
        // s přihrádkou ≤ k. Medián úseku najde binární vyhledávání, L1 odchylka od něj vyjde v konstantním čase.
        const CP = new Float64Array((T + 1) * K), CS = new Float64Array((T + 1) * K), rok = new Float64Array(K);
        pos = 0;
        for (let t = 0; t < T; t++) {
            rok.fill(0);
            const delka = rada[t].polozky.length;
            for (let i = 0; i < delka; i++) {
                const val = vse[pos++];
                let lo = 0, hi = K - 1;
                while (lo < hi) {
                    const mid = (lo + hi) >> 1;
                    if (prihradky[mid] < val) lo = mid + 1; else hi = mid;
                }
                rok[lo]++;
            }
            let c = 0, v = 0;
            const radekPred = t * K, radek = (t + 1) * K;
            for (let k = 0; k < K; k++) {
                c += rok[k];
                v += rok[k] * prihradky[k];
                CP[radek + k] = CP[radekPred + k] + c;
                CS[radek + k] = CS[radekPred + k] + v;
            }
        }
        const odchylka = (a, b) => {
            const rA = a * K, rB = (b + 1) * K;
            const n = CP[rB + K - 1] - CP[rA + K - 1];
            const pul = n / 2;
            // Nejmenší přihrádka m s kumulativním počtem ≥ n/2 (dolní medián)
            let lo = 0, hi = K - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (CP[rB + mid] - CP[rA + mid] >= pul) hi = mid; else lo = mid + 1;
            }
            const vm = prihradky[lo], cm = CP[rB + lo] - CP[rA + lo], sm = CS[rB + lo] - CS[rA + lo];
            const sCelkem = CS[rB + K - 1] - CS[rA + K - 1];
            return vm * cm - sm + (sCelkem - sm) - vm * (n - cm);
        };
        const meritko = odchylka(0, T - 1) / N;
        if (!meritko) return [];
        naklad = (a, b) => 2 * odchylka(a, b) / meritko;
    }
    // Náklad každého úseku se spočítá jednou (dynamické programování se na něj ptá pro každý počet zlomů)
    const spocitano = new Float64Array(T * T).fill(NaN), nakladUseku = naklad;
    naklad = (a, b) => {
        const k = a * T + b;
        if (Number.isNaN(spocitano[k])) spocitano[k] = nakladUseku(a, b);
        return spocitano[k];
    };
    const platny = (a, b) => b - a + 1 >= MIN_USEK_LET && pn[b + 1] - pn[a] >= MIN_USEK_MODELEK;
    const beta = c * Math.log(N);
    // nejlepsi[k][j] = nejmenší náklad prvních j+1 let v k+1 úsecích; odkud[k][j] = začátek posledního úseku
    const nejlepsi = [], odkud = [];
    nejlepsi[0] = Float64Array.from({ length: T }, (_, j) => platny(0, j) ? naklad(0, j) : Infinity);
    odkud[0] = new Int32Array(T);
    for (let k = 1; k <= MAX_ZLOMU; k++) {
        const nejK = new Float64Array(T).fill(Infinity), nejPred = nejlepsi[k - 1];
        const odkK = new Int32Array(T).fill(-1);
        nejlepsi[k] = nejK;
        odkud[k] = odkK;
        for (let j = (k + 1) * MIN_USEK_LET - 1; j < T; j++) {
            const maxI = j - MIN_USEK_LET + 1;
            for (let i = k * MIN_USEK_LET; i <= maxI; i++) {
                const pred = nejPred[i - 1];
                if (pred === Infinity || pn[j + 1] - pn[i] < MIN_USEK_MODELEK) continue;
                const v = pred + naklad(i, j);
                if (v < nejK[j]) { nejK[j] = v; odkK[j] = i; }
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
        return { ...zaklad, ano, serazene: new Float64Array(0), hodnota: ano / k * 100, dolni: ci.dolni * 100, horni: ci.horni * 100 };
    }
    const h = Float64Array.from(polozky, p => p.hodnota).sort();
    const q = f => { const poz = f * (k - 1), i = Math.floor(poz); return h[i] + ((h[Math.ceil(poz)] ?? h[i]) - h[i]) * (poz - i); };
    return { ...zaklad, ano: 0, serazene: h, hodnota: q(0.5), dolni: q(0.25), horni: q(0.75) };
}

// Zlomy řady ověřené testem a prahem: { useky, zlomy: [{ rok, p, q, zmena }] }; bez zlomu zlomy prázdné
export function zlomyRady(def, sloupce, c = POKUTA[def.druh]) {
    const rada = oriznout(sloupce);
    if (!rada.length) return { useky: [], zlomy: [], rada };
    let zacatky = rozdelitRadu(def, rada, c);
    const prah = def.druh === 'podil' ? PRAH_PODILU : def.prah ?? 0;
    for (;;) {
        if (!zacatky.length) return { useky: [], zlomy: [], rada };
        const meze = [0, ...zacatky, rada.length];
        const useky = meze.slice(0, -1).map((a, i) => urovenUseku(def, rada, a, meze[i + 1] - 1));
        const testy = useky.slice(1).map((u, i) => {
            const v = useky[i];
            if (def.druh === 'podil') {
                return {
                    p: fisher(v.ano, v.n - v.ano, u.ano, u.n - u.ano),
                    velikost: 2 * Math.asin(Math.sqrt(u.ano / u.n)) - 2 * Math.asin(Math.sqrt(v.ano / v.n)),
                };
            }
            const mw = mannWhitney(u.serazene, v.serazene, true);
            return {
                p: mw?.p ?? 1,
                velikost: mw ? 2 * mw.u / (v.n * u.n) - 1 : 0,
            };
        });
        const p = testy.map(t => t.p);
        const q = benjaminiHochberg(p);
        const zlomy = zacatky.map((z, i) => ({ rok: rada[z].rok, p: p[i], q: q[i], zmena: useky[i + 1].hodnota - useky[i].hodnota,
            velikost: testy[i].velikost }));
        const spatne = zlomy.map((z, i) => ({ i, z })).filter(({ z }) => !(z.q <= ALFA) || Math.abs(z.zmena) < prah);
        if (!spatne.length) return { useky: useky.map(({ polozky, serazene, ...u }) => u), zlomy, rada };
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
    return { druh: 'zlom', smer, veta, podrobnosti, useky, zlomy, skore: skorePostrehu(def.druh, zlomy[i].velikost, zlomy[i].q),
        hero: { pred, po, text: `${podil ? hodnota(pred.hodnota) : cislo(pred.hodnota, des)} → ${hodnota(po.hodnota)}` } };
}

// ── Krok 3: výběr proti sbírce ────────────────────────────────────────────────────────────────────────────────────
// Výběr se testuje proti zbytku sbírky (nezávislé skupiny), ve větě se ale ukazuje hodnota celé sbírky jako v souhrnu
// („60 vs 64 cm“). Údaj: Mannův–Whitneyův test z předem spočítaných pořadí, velikost Cliffovo δ; podíl a hodnota
// rozložení: Fisherův test, velikost Cohenovo h. Oprava BH přes všechny testy jednoho výběru. Postřeh = q ≤ 0,05
// a podstatný rozdíl (|δ| ≥ 0,2 a rozdíl mediánů ≥ práh; |h| ≥ 0,2 a ≥ 10 procentních bodů).
export const MIN_VYBER = 10;        // modelek se známým údajem ve výběru i ve zbytku
export const MIN_ANO = 5;           // u podílu „ano“ v obou skupinách dohromady
export const MIN_DELTA = 0.2;
export const MIN_H = 0.2;

// Předpočet příznaku přes celou sbírku (jednou po načtení dat nebo změně edice či výskytu): u údaje známé indexy,
// pořadí se shodami, oprava rozptylu na shody a pořadí podle hodnoty; u podílu jen hodnoty.
// priznak: { klic, druh: 'udaj' | 'podil', hodnoty: (number | boolean | null)[], ... text pro větu }
export function pripravitPriznak(priznak) {
    const { hodnoty } = priznak;
    const zname = [];
    hodnoty.forEach((h, i) => { if (h !== null && h !== undefined) zname.push(i); });
    if (priznak.druh === 'podil') return { ...priznak, zname, ano: zname.filter(i => hodnoty[i]).length };
    const cisla = zname.map(i => /** @type {number} */ (hodnoty[i]));
    const r = poradi(cisla);
    const poradiModelky = new Float64Array(hodnoty.length);
    zname.forEach((i, k) => { poradiModelky[i] = r[k]; });
    const serazene = zname.map((i, k) => k).sort((a, b) => cisla[a] - cisla[b]).map(k => zname[k]);
    let shodyT = 0;
    for (let k = 0; k < serazene.length;) {
        let j = k + 1;
        while (j < serazene.length && hodnoty[serazene[j]] === hodnoty[serazene[k]]) j++;
        const t = j - k;
        shodyT += t * t * t - t;
        k = j;
    }
    return { ...priznak, zname, poradiModelky, serazene, shodyT };
}

// Kvantil hodnot modelek v pořadí podle hodnoty, které splňují podmínku (lineární interpolace jako v grafu)
function kvantilMaskou(p, f, vzit, n) {
    if (!n) return null;
    const poz = f * (n - 1), dolni = Math.floor(poz), horni = Math.ceil(poz);
    let k = 0, a = null, b = null;
    for (const i of p.serazene) {
        if (!vzit(i)) continue;
        if (k === dolni) a = p.hodnoty[i];
        if (k === horni) { b = p.hodnoty[i]; break; }
        k++;
    }
    return a + (b - a) * (poz - dolni);
}

const silaSlovy = (velikost, meze) => velikost < meze[0] ? 'malý' : velikost < meze[1] ? 'střední' : 'velký';

// Porovnání výběru (maska Uint8Array přes modelky) se zbytkem sbírky pro připravené příznaky.
// vyloucit: klíče příznaků, které určuje sám výběr (podmínka vlasů vyřadí vlasy i blond).
// Vrací { maly: true } pro výběr pod MIN_VYBER modelek, jinak { postrehy: [...] } seřazené podle skóre síla × jistota.
export function rozdilyVyberu(priznaky, maska, { vyloucit = [] } = {}) {
    const vybrano = maska.reduce((s, x) => s + x, 0);
    if (vybrano < MIN_VYBER) return { maly: true, postrehy: [] };
    const kandidati = [];
    for (const p of priznaky) {
        if (vyloucit.includes(p.klic) || vyloucit.includes(p.graf)) continue;
        if (p.druh === 'podil') {
            let n1 = 0, a1 = 0;
            for (const i of p.zname) if (maska[i]) { n1++; if (p.hodnoty[i]) a1++; }
            const n2 = p.zname.length - n1, a2 = p.ano - a1;
            if (n1 < MIN_VYBER || n2 < MIN_VYBER || p.ano < MIN_ANO) continue;
            const v = a1 / n1, z = a2 / n2, celek = p.ano / p.zname.length;
            const h = 2 * Math.asin(Math.sqrt(v)) - 2 * Math.asin(Math.sqrt(z));
            kandidati.push({ p, n1, n2, a1, a2, v: v * 100, zbytek: z * 100, celek: celek * 100, velikost: h,
                pVal: fisher(a1, n1 - a1, a2, n2 - a2),
                podstatny: Math.abs(h) >= MIN_H && Math.abs(v - z) * 100 >= PRAH_PODILU && Math.round(Math.abs(v - celek) * 100) >= 1 });
        } else {
            let n1 = 0, r1 = 0;
            for (const i of p.zname) if (maska[i]) { n1++; r1 += p.poradiModelky[i]; }
            const n2 = p.zname.length - n1, n = n1 + n2;
            if (n1 < MIN_VYBER || n2 < MIN_VYBER) continue;
            const u = r1 - n1 * (n1 + 1) / 2;
            const rozptyl = n1 * n2 / 12 * ((n + 1) - p.shodyT / (n * (n - 1)));
            if (!(rozptyl > 0)) continue;
            const odchylka = u - n1 * n2 / 2;
            const z = Math.sign(odchylka) * Math.max(0, Math.abs(odchylka) - 0.5) / Math.sqrt(rozptyl);
            const vMaska = i => maska[i] === 1, zMaska = i => maska[i] !== 1, vse = () => true;
            const v = kvantilMaskou(p, 0.5, vMaska, n1), zb = kvantilMaskou(p, 0.5, zMaska, n2), celek = kvantilMaskou(p, 0.5, vse, n);
            const delta = 2 * u / (n1 * n2) - 1;
            const des = p.desetinna ?? 0;
            kandidati.push({ p, n1, n2, v, zbytek: zb, celek, velikost: delta, pVal: pOboustranne(z),
                dolni: kvantilMaskou(p, 0.25, vMaska, n1), horni: kvantilMaskou(p, 0.75, vMaska, n1),
                celekDolni: kvantilMaskou(p, 0.25, vse, n), celekHorni: kvantilMaskou(p, 0.75, vse, n),
                podstatny: Math.abs(delta) >= MIN_DELTA && Math.abs(v - zb) >= (p.prah ?? 0)
                    && Number(Math.abs(v - celek).toFixed(des)) > 0 && Math.sign(v - celek) === Math.sign(delta) });
        }
    }
    const q = benjaminiHochberg(kandidati.map(k => k.pVal));
    const testu = kandidati.length;
    const postrehy = kandidati.map((k, i) => ({ ...k, q: q[i] }))
        .filter(k => k.q <= ALFA && k.podstatny)
        .map(k => {
            const sila = k.p.druh === 'podil' ? Math.min(1, Math.abs(k.velikost) / 0.8) : Math.min(1, Math.abs(k.velikost) / 0.5);
            const jistota = Math.min(1, -Math.log10(Math.max(k.q, 1e-300)) / 4);
            return { klic: k.p.klic, graf: k.p.graf, skore: sila * jistota, q: k.q, ...textVyberu(k, testu) };
        })
        .sort((a, b) => b.skore - a.skore || a.q - b.q);
    return { maly: false, postrehy, testu };
}

const roky = n => `${n === 1 ? 'rok' : n >= 2 && n <= 4 ? 'roky' : 'let'}`;

// Věta a bublina rozdílu výběru. Text příznaku: údaj { nazev, jednotka, desetinna, vic: 'je o {d} vyšší',
// mene: 'je o {d} nižší', bezJednotkyVRozdilu? }, podíl { nazev, sKym: 's tetováním' }
function textVyberu(k, testu) {
    const p = k.p, des = p.druh === 'podil' ? 0 : p.desetinna ?? 0;
    const jednotka = p.druh === 'podil' ? ' %' : p.jednotka ? ` ${p.jednotka}` : '';
    const hodnota = v => `${cislo(v, des)}${jednotka}`;
    const oprava = `po opravě na ${testu} ${testu >= 2 && testu <= 4 ? 'testy' : 'testů'} ${textP(k.q)}`;
    if (p.druh === 'podil') {
        const vic = k.v > k.celek;
        return {
            smer: vic ? 1 : -1,
            veta: `Ve výběru je ${vic ? 'víc' : 'méně'} modelek ${p.sKym}: ${hodnota(k.v)} (celkem ${hodnota(k.celek)}).`,
            podrobnosti: `${p.nazev}: výběr ${hodnota(k.v)} (${k.a1} z ${modelek(k.n1)}), celá sbírka ${hodnota(k.celek)}, zbytek ${hodnota(k.zbytek)} (${k.a2} z ${modelek(k.n2)}). `
                + `Fisherův test, ${oprava}; velikost rozdílu: ${silaSlovy(Math.abs(k.velikost), [0.5, 0.8])} (h = ${cislo(k.velikost, 2)}).`,
        };
    }
    const vic = k.v > k.celek;
    const d = Number(Math.abs(k.v - k.celek).toFixed(des));
    const textD = p.jednotka === 'let' ? `${cislo(d, des)} ${roky(d)}` : p.bezJednotkyVRozdilu ? cislo(d, des) : `${cislo(d, des)}${jednotka}`;
    const sablona = (vic ? p.vic : p.mene).replace('{d}', textD);
    return {
        smer: vic ? 1 : -1,
        veta: `Výběr ${sablona} (${cislo(k.v, des)} vs ${hodnota(k.celek)}).`,
        podrobnosti: `${p.nazev}: medián výběru ${hodnota(k.v)} (polovina ${cislo(k.dolni, des)}–${hodnota(k.horni)}), celé sbírky ${hodnota(k.celek)} `
            + `(${cislo(k.celekDolni, des)}–${hodnota(k.celekHorni)}), zbytku ${hodnota(k.zbytek)}. Známé u ${modelek(k.n1)} výběru. `
            + `Mannův–Whitneyův test, ${oprava}; velikost rozdílu: ${silaSlovy(Math.abs(k.velikost), [0.33, 0.47])} (δ = ${cislo(k.velikost, 2)}).`,
    };
}

// ── Krok 4: panel napříč grafy ────────────────────────────────────────────────────────────────────────────────────
// Kandidáti { id, druh: 'rozdil' | 'zlom' | 'trend', graf, skore, ... } ze všech grafů. Nejvýš 5; ze skupiny příbuzných
// příznaků jen nejsilnější (a každý graf jednou); druhy mimo hlavní nejvýš 2 (s výběrem jsou hlavní rozdíly výběru).
// Bez blikání: postřeh, který byl vidět a je dál mezi prvními 7, zůstane na svém místě.
export const NEJVYS_V_PANELU = 5;
export const DRZET_DO = 7;
export const NEJVYS_VEDLEJSICH = 2;
export const PRIBUZNE = [['pas', 'whr', 'bmi'], ['vyska', 'vaha', 'bmi'], ['vlasy', 'blond'], ['pas', 'boky', 'whr']];
const pribuzne = (a, b) => a === b || PRIBUZNE.some(sk => sk.includes(a) && sk.includes(b));

export function vybratPostrehy(kandidati, { hlavni = null, predtim = [] } = {}) {
    const serazeni = [...kandidati].sort((a, b) => Number(b.druh === hlavni) - Number(a.druh === hlavni) || b.skore - a.skore || a.id.localeCompare(b.id));
    const poradi = [];
    let vedlejsich = 0;
    for (const k of serazeni) {
        if (poradi.some(x => pribuzne(x.graf, k.graf))) continue;
        if (hlavni && k.druh !== hlavni) {
            if (vedlejsich >= NEJVYS_VEDLEJSICH) continue;
            vedlejsich++;
        }
        poradi.push(k);
    }
    const drzet = new Map(poradi.slice(0, DRZET_DO).map(k => [k.id, k]));
    const panel = new Array(NEJVYS_V_PANELU).fill(null);
    // Dřív viditelné zůstanou na svém místě, zbytek se doplní podle pořadí
    predtim.forEach((id, i) => { if (i < NEJVYS_V_PANELU && drzet.has(id)) panel[i] = drzet.get(id); });
    const pouzite = new Set(panel.filter(Boolean).map(k => k.id));
    const zbytek = poradi.filter(k => !pouzite.has(k.id));
    for (let i = 0; i < NEJVYS_V_PANELU && zbytek.length; i++) if (!panel[i]) panel[i] = zbytek.shift();
    return panel.filter(Boolean);
}
