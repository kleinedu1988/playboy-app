import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { benjaminiHochberg, cochranArmitage, fisher, kendallTauB, mannWhitney, median, normalniChvost, poradi, theilSen, wilson } from '../src/lib/statistika.js';

// Referenční hodnoty ze SciPy (testdata/statistika-pripady.py)
const pripady = JSON.parse(readFileSync(new URL('../../testdata/statistika-pripady.json', import.meta.url), 'utf8'));

// Relativní shoda (u velmi malých p) nebo absolutní u hodnot blízko nuly
const blizko = (skutecne, ocekavane, zprava, tolerance = 1e-6) =>
    assert.ok(Math.abs(skutecne - ocekavane) <= tolerance * Math.max(1e-12, Math.abs(ocekavane)) || Math.abs(skutecne - ocekavane) < 1e-12,
        `${zprava}: ${skutecne} ≠ ${ocekavane}`);

test('normální chvost souhlasí se SciPy i v daleké části', () => {
    for (const { z, p } of pripady.normalniChvost) blizko(normalniChvost(z), p, `z = ${z}`);
});

test('pořadí se shodami dostávají průměrné pořadí', () => {
    for (const { hodnoty, poradi: ocekavane } of pripady.poradi) assert.deepEqual(poradi(hodnoty), ocekavane);
});

test('Kendallovo τ_b a p souhlasí se SciPy (shody, 1 500 modelek)', () => {
    for (const { nazev, x, y, tau, p } of pripady.kendall) {
        const v = kendallTauB(x, y);
        blizko(v.tau, tau, `${nazev} τ`);
        blizko(v.p, p, `${nazev} p`);
    }
    assert.equal(kendallTauB([1, 2, 3], [5, 5, 5]), null, 'konstantní řada nemá τ');
});

test('Kendallovo τ_b na 5 000 bodech do 30 ms (po zahřátí)', () => {
    const x = Array.from({ length: 5000 }, (_, i) => 1950 + (i * 7919) % 75);
    const y = x.map((r, i) => 160 + (r - 1950) * 0.1 + ((i * 104729) % 17));
    kendallTauB(x, y);
    const t = performance.now();
    kendallTauB(x, y);
    assert.ok(performance.now() - t < 30);
});

test('Cochranův–Armitageův test souhlasí s N·r² (R prop.trend.test)', () => {
    for (const { nazev, skupiny, z, p } of pripady.cochranArmitage) {
        const v = cochranArmitage(skupiny);
        blizko(v.z, z, `${nazev} z`);
        blizko(v.p, p, `${nazev} p`);
    }
    assert.equal(cochranArmitage([{ x: 1, n: 5, ano: 0 }, { x: 2, n: 5, ano: 0 }]), null, 'bez žádného ano není test');
});

test('Theilův–Senův sklon a medián', () => {
    for (const { x, y, sklon } of pripady.theilSen) blizko(theilSen(x, y), sklon, `sklon ${x}`);
    assert.equal(median([]), null);
    assert.equal(median([3, 1, 2, 10]), 2.5);
});

test('Wilsonův interval souhlasí se SciPy', () => {
    for (const { ano, n, dolni, horni } of pripady.wilson) {
        const v = wilson(ano, n);
        blizko(v.dolni, dolni, `${ano}/${n} dolní`);
        blizko(v.horni, horni, `${ano}/${n} horní`);
    }
    assert.equal(wilson(0, 0), null);
});

test('Mann–Whitney, Fisher a Benjamini–Hochberg souhlasí se SciPy', () => {
    for (const { a, b, u, p } of pripady.mannWhitney) {
        const v = mannWhitney(a, b);
        // SciPy vrací U první skupiny
        blizko(v.u, u, `U ${a.length}×${b.length}`);
        blizko(v.p, p, `p ${a.length}×${b.length}`);
    }
    for (const { tabulka: [[a, b], [c, d]], p } of pripady.fisher) blizko(fisher(a, b, c, d), p, `Fisher ${a},${b},${c},${d}`);
    for (const { p, q } of pripady.bh) benjaminiHochberg(p).forEach((x, i) => blizko(x, q[i], `BH ${p}`));
});
