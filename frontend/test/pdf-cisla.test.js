import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dalsiLupa, dalsiZobrazeni, meritkoZobrazeni, stranyZobrazeni } from '../src/lib/pdf-cisla.js';

test('PDF čísla: dvoustrany jako v časopise, listování a lupa (0.02.035)', () => {
    assert.deepEqual(stranyZobrazeni(1, 200, true), [1]);
    assert.deepEqual(stranyZobrazeni(2, 200, true), [2, 3]);
    assert.deepEqual(stranyZobrazeni(3, 200, true), [2, 3]);
    assert.deepEqual(stranyZobrazeni(200, 200, true), [200]);
    assert.deepEqual(stranyZobrazeni(201, 200, false), [200]);
    assert.deepEqual(stranyZobrazeni(5, 0, true), []);
    assert.equal(dalsiZobrazeni(1, 200, true, 1), 2);
    assert.equal(dalsiZobrazeni(2, 200, true, 1), 4);
    assert.equal(dalsiZobrazeni(4, 200, true, -1), 2);
    assert.equal(dalsiZobrazeni(2, 200, true, -1), 1);
    assert.equal(dalsiZobrazeni(1, 200, true, -1), 1);
    assert.equal(dalsiZobrazeni(200, 200, true, 1), 200);
    assert.equal(dalsiZobrazeni(7, 10, false, 1), 8);
    // Dvě strany 600×800 do plochy 1000×800: šířka rozhoduje (1000 / 1200)
    assert.equal(meritkoZobrazeni([{ sirka: 600, vyska: 800 }, { sirka: 600, vyska: 800 }], 1000, 800), 1000 / 1200);
    assert.equal(meritkoZobrazeni([{ sirka: 600, vyska: 800 }], 1000, 400, 2), 1);
    assert.equal(dalsiLupa(1, 1), 1.25);
    assert.equal(dalsiLupa(1, -1), 0.75);
    assert.equal(dalsiLupa(4, 1), 4);
    assert.equal(dalsiLupa(0.5, -1), 0.5);
});
