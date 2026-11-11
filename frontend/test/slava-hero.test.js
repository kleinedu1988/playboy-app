import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hlavniModelkaSlavy } from '../src/lib/slava.js';

test('hero Síně slávy se zvoleným časopisem nikdy prázdný (0.02.044)', () => {
    const modelky = [{ id: 1, jmeno: 'Ulla', poradi: 294, hodnoceni: 0 }, { id: 2, jmeno: 'Heide', poradi: 120, hodnoceni: 3 }, { id: 3, jmeno: 'Ilse' }];
    assert.deepEqual(hlavniModelkaSlavy([{ modelkaId: 2, misto: 7 }, { modelkaId: 1, misto: 4 }], modelky), { modelkaId: 1, druh: 'top', misto: 4 });
    assert.deepEqual(hlavniModelkaSlavy([{ modelkaId: 1, misto: 1 }], modelky), { modelkaId: 1, druh: 'jednicka', misto: 1 });
    assert.deepEqual(hlavniModelkaSlavy([], modelky), { modelkaId: 2, druh: 'poradi', misto: 120 });
    assert.deepEqual(hlavniModelkaSlavy([], [{ id: 3, jmeno: 'Ilse' }, { id: 4, jmeno: 'Anna', hodnoceni: 2 }]), { modelkaId: 4, druh: 'hodnoceni', misto: 0 });
    assert.equal(hlavniModelkaSlavy([], []), null);
});
