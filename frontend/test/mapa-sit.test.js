import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Autoenkoder, generator, sousedePriznaku, zachovaniSousedu } from '../src/lib/mapa-sit.js';

// Dva shluky v 6-D: dobrá mapa je oddělí a zachová sousedy
function data(n = 120) {
    const rnd = generator(3);
    const D = 6, m = new Float64Array(n * D);
    for (let i = 0; i < n; i++) for (let c = 0; c < D; c++) m[i * D + c] = (i < n / 2 ? 1 : -1) * (c < 3 ? 1 : 0) + (rnd() - 0.5) * 0.3;
    return { m, n, D };
}

test('zachování sousedů: projekce na první souřadnici je lepší než náhoda', () => {
    const { m, n, D } = data();
    const ref = sousedePriznaku(m, n, D, { k: 5, vzorek: 40 });
    const x = Float64Array.from({ length: n }, (_, i) => m[i * D]), y = Float64Array.from({ length: n }, (_, i) => m[i * D + 1]);
    const rnd = generator(9);
    const nahoda = zachovaniSousedu(ref, Float64Array.from({ length: n }, rnd), Float64Array.from({ length: n }, rnd));
    assert.ok(zachovaniSousedu(ref, x, y) > nahoda);
});

test('autoenkodér: deterministický a ztráta klesá', () => {
    const { m, n, D } = data();
    const uc = () => { const ae = new Autoenkoder(m, n, D, { epochy: 15, seme: 5 }); ae.krok(); const prvni = ae.ztrata; while (!ae.krok()); return { prvni, ae }; };
    const a = uc(), b = uc();
    assert.ok(a.ae.ztrata < a.prvni, `${a.ae.ztrata} < ${a.prvni}`);
    assert.deepEqual(Array.from(a.ae.kody().x), Array.from(b.ae.kody().x));
    // Shluky se na mapě oddělí (průměry kódů v x nebo y se liší)
    const { x, y } = a.ae.kody();
    const prumer = (arr, od, po) => arr.slice(od, po).reduce((s, v) => s + v, 0) / (po - od);
    const rozdil = Math.max(Math.abs(prumer(x, 0, n / 2) - prumer(x, n / 2, n)), Math.abs(prumer(y, 0, n / 2) - prumer(y, n / 2, n)));
    assert.ok(rozdil > 0.3, String(rozdil));
});

test('autoenkodér po kouscích dá totéž co po celých epochách', () => {
    const { m, n, D } = data(200);
    const cele = new Autoenkoder(m, n, D, { epochy: 3, davka: 16 });
    while (!cele.krok());
    const kousky = new Autoenkoder(m, n, D, { epochy: 3, davka: 16 });
    let kroku = 0;
    while (!kousky.krok(0)) kroku++;
    assert.ok(kroku > 3);
    assert.deepEqual(Array.from(kousky.kody().x), Array.from(cele.kody().x));
});
