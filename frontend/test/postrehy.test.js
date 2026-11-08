import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obdobi, postrehRady, predlozkaZ, trendRady, zlomyRady } from '../src/lib/postrehy.js';

// Deterministický generátor (mulberry32) a normální rozdělení (Box–Muller)
function generator(seminko) {
    let a = seminko >>> 0;
    const nahoda = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normalni = () => Math.sqrt(-2 * Math.log(1 - nahoda())) * Math.cos(2 * Math.PI * nahoda());
    return { nahoda, normalni };
}

const VYSKA = { druh: 'udaj', nazev: 'Výška', jednotka: 'cm', prah: 2, rod: 'f' };
const SILIKON = { druh: 'podil', nazev: 'Silikonová prsa', sKym: 'se silikonovými prsy' };

// Řada let od..do, v každém roce n modelek s hodnotou z funkce (rok, náhoda)
function rada(od, doRoku, pocet, hodnota) {
    return Array.from({ length: doRoku - od + 1 }, (_, i) => ({
        rok: od + i, polozky: Array.from({ length: pocet(od + i) }, () => ({ hodnota: hodnota(od + i) })),
    }));
}

test('předložka z / ze podle výslovnosti čísla', () => {
    assert.equal(predlozkaZ(168), 'ze');
    assert.equal(predlozkaZ(7), 'ze');
    assert.equal(predlozkaZ(17), 'ze');
    assert.equal(predlozkaZ(64), 'ze');
    assert.equal(predlozkaZ(72), 'ze');
    assert.equal(predlozkaZ(24), 'z');
    assert.equal(predlozkaZ(8), 'z');
    assert.equal(predlozkaZ(0.72), 'z');
    assert.equal(predlozkaZ(250), 'z');
    assert.equal(predlozkaZ(600), 'ze');
});

test('období: desetiletí slovy jen celé a před rokem 2000', () => {
    assert.deepEqual(obdobi([1960, 1961, 1969]), { veta: 'v 60. letech', popisek: '60. léta' });
    assert.deepEqual(obdobi([1953, 1959]), { veta: 'v letech 1953–1959', popisek: '1953–1959' });
    assert.deepEqual(obdobi([2010, 2019]), { veta: 'v letech 2010–2019', popisek: '2010–2019' });
    assert.deepEqual(obdobi([2025]), { veta: 'v roce 2025', popisek: '2025' });
});

test('zasazený růst výšky se najde a věta má hodnoty období', () => {
    const { normalni } = generator(1);
    const sloupce = rada(1960, 2019, () => 20, rok => Math.round(166 + (rok - 1960) * 0.12 + normalni() * 4));
    const t = trendRady(VYSKA, sloupce);
    assert.ok(t, 'trend se má ukázat');
    assert.equal(t.smer, 1);
    assert.match(t.veta, /^Výška průkazně roste: ze 16\d cm v 60\. letech na 17\d cm v letech 2010–2019\.$/);
    assert.match(t.podrobnosti, /Kendallovo τ = 0,\d\d přes 1\s200 modelek, p < 0,001/);
    assert.match(t.podrobnosti, /Tempo asi \+1,\d cm za 10 let/);
    assert.match(t.podrobnosti, /polovina modelek 16\d–17\d cm/);
});

test('zasazený růst podílu: věta o podílu, ve výběru, s intervalem v bublině', () => {
    const { nahoda } = generator(2);
    const sloupce = rada(1980, 2009, () => 25, rok => nahoda() < (rok < 1995 ? 0.1 : 0.45));
    const t = trendRady(SILIKON, sloupce, { vyber: true, kontext: 'Známé u 750 z 900 modelek.' });
    assert.ok(t);
    assert.match(t.veta, /^Podíl modelek se silikonovými prsy ve výběru průkazně roste: z \d+ % v 80\. letech na \d+ % v letech 2000–2009\.$/);
    assert.match(t.podrobnosti, /80\. léta: \d+ % \(\d+–\d+ %, 250 modelek\)/);
    assert.match(t.podrobnosti, /Cochranův–Armitageův test přes 750 modelek, p < 0,001\. Známé u 750 z 900 modelek\.$/);
});

test('klesající trend a desetinná místa (poměr pas : boky)', () => {
    const { normalni } = generator(3);
    const whr = { druh: 'udaj', nazev: 'Poměr pas : boky', jednotka: '', desetinna: 2, prah: 0.02 };
    const t = trendRady(whr, rada(1970, 2009, () => 15, rok => 0.72 - (rok - 1970) * 0.001 + normalni() * 0.02));
    assert.ok(t);
    assert.equal(t.smer, -1);
    assert.match(t.veta, /^Poměr pas : boky průkazně klesá: z 0,7\d v 70\. letech na 0,\d\d v letech 2000–2009\.$/);
    assert.match(t.podrobnosti, /polovina modelek 0,\d\d–0,\d\d \(/, 'vždy dvě desetinná místa');
});

test('průkazný, ale nepodstatný rozdíl (pod prahem) se neukáže', () => {
    const { normalni } = generator(4);
    // +1 cm za 60 let na 6 000 modelkách: test projde, změna je pod prahem 2 cm
    const t = trendRady(VYSKA, rada(1960, 2019, () => 100, rok => 168 + (rok - 1960) / 60 + normalni() * 3));
    assert.equal(t, null);
});

test('málo dat: méně než 10 let nebo 60 modelek → bez postřehu', () => {
    const silne = rok => 160 + (rok - 2000) * 2;
    assert.equal(trendRady(VYSKA, rada(2000, 2008, () => 30, silne)), null, '9 let');
    assert.equal(trendRady(VYSKA, rada(2000, 2019, () => 2, silne)), null, '40 modelek');
    assert.equal(trendRady({ druh: 'pocet' }, rada(2000, 2019, () => 9, () => true)), null, 'počty se netestují');
});

test('nulová simulace: bez trendu se postřeh ukáže nejvýš u 5 % řad', () => {
    const { nahoda, normalni } = generator(5);
    let ukazano = 0;
    for (let i = 0; i < 200; i++) {
        const pocet = () => 3 + Math.floor(nahoda() * 20);
        const t = i % 2
            ? trendRady(VYSKA, rada(1960, 2019, pocet, () => Math.round(170 + normalni() * 5)))
            : trendRady(SILIKON, rada(1960, 2019, pocet, () => nahoda() < 0.3));
        if (t) ukazano++;
    }
    assert.ok(ukazano <= 10, `ukázáno ${ukazano} z 200`);
    console.log(`nulová simulace: ${ukazano} z 200`);
});

test('výpočet na 5 000 modelkách do 30 ms', () => {
    const { normalni } = generator(6);
    const sloupce = rada(1953, 2025, () => 69, rok => Math.round(166 + (rok - 1953) * 0.08 + normalni() * 5));
    trendRady(VYSKA, sloupce);
    const t0 = performance.now();
    trendRady(VYSKA, sloupce);
    assert.ok(performance.now() - t0 < 30);
});

test('zasazený zlom podílu 10 % → 45 % v roce 1995 se najde (1993–1997) s úrovněmi ±5 bodů', () => {
    const { nahoda } = generator(10);
    const sloupce = rada(1970, 2005, () => 30, rok => nahoda() < (rok < 1995 ? 0.1 : 0.45));
    const { zlomy, useky } = zlomyRady(SILIKON, sloupce);
    assert.equal(zlomy.length, 1);
    assert.ok(Math.abs(zlomy[0].rok - 1995) <= 2, `zlom ${zlomy[0].rok}`);
    assert.ok(Math.abs(useky[0].hodnota - 10) <= 5 && Math.abs(useky[1].hodnota - 45) <= 5, useky.map(u => u.hodnota).join(' / '));
    const p = postrehRady(SILIKON, sloupce);
    assert.equal(p.druh, 'zlom');
    assert.match(p.veta, /^Od roku 199\d podíl modelek se silikonovými prsy průkazně vzrostl: z \d+ % v letech 1970–199\d na \d+ % v letech 199\d–2005\.$/);
    assert.match(p.podrobnosti, /Zlom 199\d: Fisherův test sousedních období p < 0,001\./);
});

test('zlom má přednost před trendem; rod slovesa a BMI velkými písmeny', () => {
    const { normalni } = generator(11);
    const skok = rok => Math.round(167 + (rok >= 1990 ? 5 : 0) + normalni() * 4);
    const p = postrehRady(VYSKA, rada(1960, 2019, () => 20, skok), { vyber: true });
    assert.equal(p.druh, 'zlom');
    assert.match(p.veta, /^Od roku 19(8[89]|9[0-2]) výška ve výběru průkazně vzrostla: ze 16\d cm v letech 1960–19\d\d na 17\d cm v letech 19\d\d–2019\.$/);
    const bmi = { druh: 'udaj', nazev: 'BMI', jednotka: 'kg/m²', desetinna: 1, prah: 0.5, rod: 'n' };
    const pb = postrehRady(bmi, rada(1960, 2019, () => 20, rok => Math.round((19.5 - (rok >= 1990 ? 1.2 : 0) + normalni() * 1.2) * 10) / 10));
    assert.match(pb.veta, /^Od roku 19\d\d BMI průkazně kleslo: z 19,\d kg\/m² v letech 1960–19\d\d na 18,\d kg\/m² v letech 19\d\d–2019\.$/);
});

test('dva zlomy (nahoru a zpět) se oba najdou a bublina zmíní opravu', () => {
    const { normalni } = generator(12);
    const p = postrehRady(VYSKA, rada(1960, 2019, () => 25, rok => Math.round(168 + (rok >= 1980 && rok < 2000 ? 5 : 0) + normalni() * 4)));
    assert.equal(p.zlomy.length, 2, p.zlomy.map(z => z.rok).join(', '));
    assert.match(p.podrobnosti, /po opravě na 2 zlomy/);
});

test('řídká data: 3 modelky v roce 1960 nevytvoří zlom; řada bez dat nic nespadne', () => {
    const { normalni } = generator(13);
    const sloupce = rada(1960, 2019, rok => (rok === 1960 ? 3 : 15), rok => Math.round((rok === 1960 ? 185 : 170) + normalni() * 4));
    assert.equal(zlomyRady(VYSKA, sloupce).zlomy.length, 0);
    assert.deepEqual(zlomyRady(VYSKA, rada(1960, 1980, () => 0, () => 0)).zlomy, []);
    assert.equal(postrehRady(VYSKA, []), null);
});

test('nulová simulace zlomů: falešný zlom nejvýš u 5 % ze 200 řad', () => {
    const { nahoda, normalni } = generator(14);
    let falesne = 0;
    for (let i = 0; i < 200; i++) {
        const pocet = () => 1 + Math.floor(nahoda() * [8, 25, 60][i % 3]);
        const sloupce = i % 2
            ? rada(1960, 1960 + 30 + (i % 41), pocet, () => Math.round(170 + normalni() * 5))
            : rada(1960, 1960 + 30 + (i % 41), pocet, () => nahoda() < 0.3);
        if (zlomyRady(i % 2 ? VYSKA : SILIKON, sloupce).zlomy.length) falesne++;
    }
    console.log(`nulová simulace zlomů: ${falesne} z 200`);
    assert.ok(falesne <= 10, `falešných ${falesne} z 200`);
});

test('zlomy na 5 000 modelkách do 30 ms', () => {
    const { normalni } = generator(15);
    const sloupce = rada(1953, 2025, () => 69, rok => Math.round(166 + (rok > 1990 ? 3 : 0) + normalni() * 5));
    postrehRady(VYSKA, sloupce);
    const t0 = performance.now();
    postrehRady(VYSKA, sloupce);
    const ms = performance.now() - t0;
    assert.ok(ms < 30, `${ms.toFixed(1)} ms`);
});
