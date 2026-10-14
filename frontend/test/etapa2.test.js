import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rozlozitVydani, slozitVydani, nazevVydani, nazevAlba, prevestVysku, prevestVahu, rozlozitMiry } from '../src/lib/format.js';

test('vydání s edicí', () => {
    assert.deepEqual(rozlozitVydani('2009-11-CZ'), { rok: '2009', mesic: '11', edice: 'CZ' });
    assert.deepEqual(rozlozitVydani('2012'), { rok: '2012', mesic: '', edice: 'US' });
    assert.equal(rozlozitVydani('2009-13'), null);
    assert.equal(slozitVydani('2009', '11', 'US'), '2009-11');
    assert.equal(slozitVydani('2012', '', 'CZ'), '2012-CZ');
    assert.equal(slozitVydani('', '11', 'CZ'), '');
    assert.equal(nazevVydani('2009-11-CZ'), 'Listopad 2009 · CZ');
    assert.equal(nazevVydani('2012'), '2012');
    assert.equal(nazevAlba('2009-11-CZ', 'Centerfold'), 'Listopad 2009 · CZ');
    assert.equal(nazevAlba('2012-CZ', 'Centerfold'), '2012-CZ');
});

test('převod měr', () => {
    assert.equal(prevestVysku('5\'7"'), 170);
    assert.equal(prevestVysku('5′ 7″'), 170);
    assert.equal(prevestVysku('5 ft 7 in'), 170);
    assert.equal(prevestVysku('170'), 170);
    assert.equal(prevestVysku('170 cm'), 170);
    assert.equal(prevestVysku('vysoká'), null);
    assert.equal(prevestVahu('115 lbs'), 52);
    assert.equal(prevestVahu('52'), 52);
    assert.equal(prevestVahu('52 kg'), 52);
    assert.deepEqual(rozlozitMiry('34B-24-34'), { hrudnik: 86, pas: 61, boky: 86, velikost: '34B' });
    assert.deepEqual(rozlozitMiry('86-58-86'), { hrudnik: 86, pas: 58, boky: 86, velikost: '' });
    assert.equal(rozlozitMiry('34B'), null);
});
