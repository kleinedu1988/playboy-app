import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kvantil, useky, vyhlazenaRada, wilson } from '../src/lib/krivky.js';
import { porovnatObdobi, pripravitPriznak } from '../src/lib/postrehy.js';

const blizko = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('Wilsonův interval: známé hodnoty, krajní podíly a prázdno', () => {
    const w = wilson(8, 10);
    blizko(w.dolni, 0.4902, 1e-3);
    blizko(w.horni, 0.9433, 1e-3);
    assert.equal(wilson(0, 10).dolni, 0);
    assert.ok(wilson(0, 10).horni > 0.2);
    assert.equal(wilson(10, 10).horni, 1);
    assert.equal(wilson(0, 0), null);
});

test('Kvantil s interpolací', () => {
    assert.equal(kvantil([1, 2, 3, 4], 0.5), 2.5);
    assert.equal(kvantil([1, 2, 3, 4, 5], 0.25), 2);
});

test('Vyhlazená řada: medián a kvartily okna, Wilson u podílu, mezery pod minimem', () => {
    const udaje = [[160, 170], [165], [175, 180, 185], [], [], [], [], [150]];
    const r = vyhlazenaRada('udaj', udaje, 1);
    // Okno sloupců 0–2: 160 165 170 175 180 185
    assert.deepEqual([r[1].stred, r[1].n], [172.5, 6]);
    blizko(r[1].dolni, 166.25);
    blizko(r[1].horni, 178.75);
    assert.equal(r[0], null);        // 160 170 165: jen 3 modelky
    assert.equal(r[5], null);
    const podily = vyhlazenaRada('podil', [[true, false, true], [true, true], [false]], 1);
    blizko(podily[1].stred, 4 / 6 * 100);
    assert.ok(podily[1].dolni < podily[1].stred && podily[1].horni > podily[1].stred);
    const pocty = vyhlazenaRada('pocet', [[1, 1], [1], []], 1);
    assert.equal(pocty[1].stred, 1);
    assert.equal(pocty[1].dolni, null);
});

test('Úseky řady bez mezer', () => {
    assert.deepEqual(useky([1, 2, null, 3, null, null]).map(u => u.map(([i]) => i)), [[0, 1], [3]]);
    assert.deepEqual(useky([null]), []);
});

test('Srovnání období: průkazný rozdíl jen mezi obdobími, modelky mimo se nepočítají', () => {
    // 40 modelek v A (výška 175 ± 2, polovina tetování), 40 v B (165 ± 2, tetování 10 %), 40 mimo (190)
    const vyska = [], tetovani = [], obdobi = [];
    for (let i = 0; i < 40; i++) { vyska.push(173 + (i % 5)); tetovani.push(i % 2 === 0); obdobi.push(1); }
    for (let i = 0; i < 40; i++) { vyska.push(163 + (i % 5)); tetovani.push(i % 10 === 0); obdobi.push(2); }
    for (let i = 0; i < 40; i++) { vyska.push(190); tetovani.push(true); obdobi.push(0); }
    const priznaky = [
        pripravitPriznak({ klic: 'vyska', graf: 'vyska', druh: 'udaj', nazev: 'Výška', jednotka: 'cm', prah: 2, vic: 'je o {d} vyšší', mene: 'je o {d} nižší', hodnoty: vyska }),
        pripravitPriznak({ klic: 'tetovani', graf: 'tetovani', druh: 'podil', nazev: 'Tetování', sKym: 's tetováním', hodnoty: tetovani }),
    ];
    const r = porovnatObdobi(priznaky, Int8Array.from(obdobi), { a: '70. léta', b: '90. léta' });
    assert.equal(r.maly, false);
    assert.deepEqual([r.na, r.nb], [40, 40]);
    const vyskaR = r.tabulka.find(t => t.klic === 'vyska');
    assert.deepEqual([vyskaR.a, vyskaR.b, vyskaR.na, vyskaR.nb, vyskaR.prukazny], [175, 165, 40, 40, true]);
    const vety = r.postrehy.map(p => p.veta);
    assert.ok(vety.includes('70. léta: modelka je o 10 cm vyšší (medián 175 vs 165 cm).'), vety.join(' | '));
    assert.ok(vety.some(v => v.startsWith('70. léta: víc modelek s tetováním – 50 % proti 10 %')), vety.join(' | '));
    assert.equal(porovnatObdobi(priznaky, Int8Array.from(obdobi.map((x, i) => (x === 2 && i % 8 ? 0 : x))), { a: 'A', b: 'B' }).maly, true);
});
