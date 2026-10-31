import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nazevSezony, slozeniBodu, textUdalosti, textZbyva, popisOdznaku } from '../src/lib/slava.js';

test('název sezóny', () => {
    assert.equal(nazevSezony('2026-11'), 'listopad 2026');
    assert.equal(nazevSezony('2026-10', true), 'X/26');
    assert.equal(nazevSezony('nesmysl'), '');
});

test('kolik zbývá do konce sezóny', () => {
    assert.equal(textZbyva(21, 30), 'zbývá 9 dní');
    assert.equal(textZbyva(29, 30), 'zbývá 1 den');
    assert.equal(textZbyva(28, 31), 'zbývá 3 dny');
    assert.equal(textZbyva(30, 30), 'poslední den');
});

test('složení bodů proti nejvyšším bodům', () => {
    assert.deepEqual(slozeniBodu({ zaSouboje: 20, zaZajem: 5 }, 40), { souboje: 0.5, zajem: 0.125 });
    assert.deepEqual(slozeniBodu({}, 0), { souboje: 0, zajem: 0 });
});

test('kronika a odznak sezóny', () => {
    const jmeno = () => 'Marta';
    assert.equal(textUdalosti({ druh: 'favoritka', modelkaId: 1, cas: '2026-10-31 23:59:59' }, jmeno).text, 'Marta je Favoritka sezóny říjen 2026');
    assert.equal(textUdalosti({ druh: 'milacek', modelkaId: 1, cas: '2026-10-31 23:59:59' }, jmeno).ikona, '♥');
    const o = popisOdznaku({ odznak: 'favoritka', stupen: 1, ziskan: true, hodnota: 2, dalsi: 3 });
    assert.equal(o.stupen, 'bronz');
    assert.match(o.zbyva, /1× vyhrát sezónu do stříbra/);
});
