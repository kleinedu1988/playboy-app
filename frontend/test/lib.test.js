import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nazevAlba, esc, formatDatum, sjednotit, vekPriVydani, udajChybi } from '../src/lib/format.js';
import { sestavitAlba, zacatkyAlb, novePoradi } from '../src/lib/alba.js';

test('názvy a formáty', () => {
    assert.equal(nazevAlba('2009-11', 'Centerfold'), 'Listopad 2009');
    assert.equal(nazevAlba('2009-11', 'Pictorial'), '2009-11');
    assert.equal(formatDatum('1988-12-08'), '8. 12. 1988');
    assert.equal(formatDatum('1991'), '1991');
    assert.equal(esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
    assert.equal(sjednotit('  Zoë Ödegaard '), 'zoe odegaard');
    assert.equal(vekPriVydani('1988-12-08', '2009-11'), '20 let');
    assert.equal(vekPriVydani('1988', '2009-11'), '');
});

test('tetování „ne" je vyplněný údaj, nula u výšky ne', () => {
    assert.equal(udajChybi({ tetovani: 0 }, 'tetovani'), false);
    assert.equal(udajChybi({ tetovani: -1 }, 'tetovani'), true);
    assert.equal(udajChybi({ vyskaCm: 0 }, 'vyskaCm'), true);
});

const fotka = (id, album, typ, dalsi = {}) => ({ id, modelkaId: 1, album, typ, rotace: 0, ...dalsi });

test('alba: centerfold první, srdíčka řadí, ruční pořadí má přednost', () => {
    const alba = sestavitAlba([
        fotka(1, 'A', 'Pictorial'), fotka(2, 'A', 'Pictorial', { hodnoceni: 5 }),
        fotka(3, '2009-11', 'Centerfold', { spojit: true }), fotka(4, '2009-11', 'Centerfold', { spojit: true }),
    ]);
    assert.deepEqual(alba.map(a => a.typ), ['Centerfold', 'Pictorial']);
    assert.equal(alba[0].polozky.length, 1);
    assert.deepEqual(alba[1].polozky.map(p => p.fotky[0].id), [2, 1]);

    const rucni = sestavitAlba([fotka(1, 'A', 'Pictorial', { poradi: 1 }), fotka(2, 'A', 'Pictorial', { poradi: 2, hodnoceni: 5 })]);
    assert.deepEqual(rucni[0].polozky.map(p => p.fotky[0].id), [1, 2]);
});

test('začátky alb a nové pořadí po přetažení', () => {
    const polozky = sestavitAlba([fotka(1, 'A', 'Pictorial'), fotka(2, 'A', 'Pictorial'), fotka(3, 'B', 'Pictorial')]).flatMap(a => a.polozky);
    assert.deepEqual(zacatkyAlb(polozky), [0, 2]);
    assert.deepEqual(novePoradi([1, 2, 3, 4], 4, 2, true), [1, 4, 2, 3]);
    assert.deepEqual(novePoradi([1, 2, 3, 4], 1, 3, false), [2, 3, 1, 4]);
});

test('skloňování počtu', async () => {
    const { sklonovat } = await import('../src/lib/format.js');
    assert.equal(sklonovat(0, 'fotka', 'fotky', 'fotek'), '0 fotek');
    assert.equal(sklonovat(1, 'fotka', 'fotky', 'fotek'), '1 fotka');
    assert.equal(sklonovat(3, 'fotka', 'fotky', 'fotek'), '3 fotky');
    assert.equal(sklonovat(5, 'fotka', 'fotky', 'fotek'), '5 fotek');
    assert.equal(sklonovat(12, 'rok', 'roky', 'roků'), '12 roků');
});
