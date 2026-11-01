import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shoda = JSON.parse(readFileSync(new URL('../../testdata/hledani-shoda.json', import.meta.url), 'utf8'));

test('model filtru najde totéž co backend (testdata/hledani-shoda.json)', async () => {
    const { parsovat, vyhodnotit } = await import('../src/lib/filtr.js');
    const { DIMENZE_MODELEK, textyModelky } = await import('../src/lib/dimenze.js');
    for (const { dotaz, najde } of shoda.dotazy) {
        const filtr = parsovat(dotaz, DIMENZE_MODELEK);
        const nalezene = shoda.modelky.filter(m => vyhodnotit(m, filtr, DIMENZE_MODELEK, textyModelky)).map(m => m.id);
        assert.deepEqual(nalezene, najde, dotaz);
    }
});

test('model filtru: text ↔ filtr a počty u hodnot', async () => {
    const { parsovat, serializovat, fasety, ciselnyVyraz } = await import('../src/lib/filtr.js');
    const { DIMENZE_MODELEK, textyModelky } = await import('../src/lib/dimenze.js');
    const f = parsovat('vlasy:"strawberry blond",zrzavá -narodnost:usa rok:1980..1999 Anna', DIMENZE_MODELEK);
    assert.equal(f.podminky.length, 3);
    assert.equal(f.volne.length, 1);
    assert.equal(serializovat(f), 'vlasy:"strawberry blond",zrzava -narodnost:usa rok:1980..1999 anna');
    assert.deepEqual(parsovat(serializovat(f), DIMENZE_MODELEK).podminky, f.podminky);
    // Počty vlasů s ostatními podmínkami (narodnost USA), bez podmínky na vlasy
    const usa = parsovat('narodnost:usa vlasy:cerna', DIMENZE_MODELEK);
    assert.deepEqual(fasety(shoda.modelky, usa, DIMENZE_MODELEK, textyModelky, 'vlasy').map(x => [x.hodnota, x.pocet]), [['blond', 1], ['černá', 1]]);
    assert.deepEqual(fasety(shoda.modelky, parsovat('', DIMENZE_MODELEK), DIMENZE_MODELEK, textyModelky, 'edice').map(x => [x.hodnota, x.pocet]), [['US', 4], ['CZ', 2]]);
    assert.deepEqual(ciselnyVyraz('1975-01', true), null);
    assert.deepEqual(ciselnyVyraz('>=170'), [{ op: '>=', od: 170 }]);
});
