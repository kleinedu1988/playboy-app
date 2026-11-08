// Postřehy ve Statistikách (docs/NAVRH-POSTREHY.md): krátké české věty o tom, co je ve sbírce průkazné.
// Krok 1 – trend u grafu v čase: test na úrovni modelek (údaj Kendallovo τ_b rok × hodnota, podíl Cochran–Armitage),
// velikost změny z prvního a posledního desetiletí s dost modelkami. Postřeh se ukáže, jen když test projde
// a změna je prakticky podstatná (práh grafu, u podílu 10 procentních bodů) – raději žádný postřeh než šum.
// Bez DOM; hodnoty se počítají ze stejných sloupců jako graf (lib/statistika.js má testy proti SciPy).
import { cochranArmitage, kendallTauB, median, theilSen, wilson } from './statistika.js';

export const ALFA = 0.05;
export const MIN_LET = 10;          // let s aspoň jednou modelkou se známým údajem
export const MIN_MODELEK = 60;      // modelek se známým údajem v celé řadě
export const MIN_V_OBDOBI = 10;     // modelek v desetiletí, aby šlo do věty
export const MIN_V_ROCE = 5;        // modelek v roce, aby se rok počítal do tempa (Theil–Sen)
export const PRAH_PODILU = 10;      // procentních bodů

const cislo = (n, desetinna = 0) => Number(n.toFixed(desetinna)).toLocaleString('cs-CZ', { maximumFractionDigits: desetinna });

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
