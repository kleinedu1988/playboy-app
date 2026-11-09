import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obvyklyVek, odhadNarodnosti, prevestNarozeni } from '../src/lib/rychle-pridani.js';

const modelka = (vydani, narodnost, narozeniDatum = '') => ({ vydani: [vydani], narodnost, narozeniDatum });

test('Odhad národnosti: nejčastější v edici a okolí roku, jen když je zřetelná', () => {
    const cz = Array.from({ length: 6 }, (_, i) => modelka(`2015-0${i + 1}-CZ`, i < 5 ? 'Česká' : 'Slovenská'));
    const us = Array.from({ length: 6 }, (_, i) => modelka(`1990-0${i + 1}`, 'USA'));
    const odhad = odhadNarodnosti([...cz, ...us], 'CZ', 2016);
    assert.equal(odhad.narodnost, 'Česká');
    assert.equal(odhad.pocet, 6);
    assert.equal(odhadNarodnosti([...cz, ...us], 'US', 1992).narodnost, 'USA');
    assert.equal(odhadNarodnosti([...cz, ...us], 'US', 2015), null);       // v okolí roku nic
    assert.equal(odhadNarodnosti(cz.slice(0, 4), 'CZ', 2015), null);        // málo modelek
    const pul = [...cz.slice(0, 3), ...Array.from({ length: 3 }, (_, i) => modelka(`2015-0${i + 1}-CZ`, 'Slovenská'))];
    assert.equal(odhadNarodnosti(pul, 'CZ', 2015), null);                   // není zřetelně nejčastější
});

test('Obvyklý věk v prvním čísle (medián, s měsícem narození)', () => {
    const m = [modelka('1990-05', 'USA', '1968-03-01'), modelka('1991-01', 'USA', '1970-06'), modelka('1992-07', 'USA', '1970'),
        modelka('1993-02', 'USA', '1971-01-01'), modelka('1994-03', 'USA', '1970-01')];
    // Věky 22, 20, 22, 22, 24
    assert.equal(obvyklyVek(m, 'US', 1992), 22);
    assert.equal(obvyklyVek(m.slice(0, 3), 'US', 1992), null);
});

test('Pole narození: datum, rok, věk v čísle a chyby', () => {
    assert.deepEqual(prevestNarozeni('', 1995), { datum: '' });
    assert.deepEqual(prevestNarozeni('1974-05-02', 1995), { datum: '1974-05-02' });
    assert.deepEqual(prevestNarozeni('1974', 0), { datum: '1974' });
    assert.deepEqual(prevestNarozeni('22', 1995), { datum: '1973', vek: 22 });
    assert.deepEqual(prevestNarozeni('22 let', 1995), { datum: '1973', vek: 22 });
    assert.ok(prevestNarozeni('22', 0).chyba);
    assert.ok(prevestNarozeni('9', 1995).chyba);
    assert.ok(prevestNarozeni('2. května', 1995).chyba);
});
