import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rozlozitVydani, slozitVydani, nazevVydani, nazevAlba, prevestVysku, prevestVahu, rozlozitMiry } from '../src/lib/format.js';

test('vydání jiného časopisu: klíč s @, řada a zpětné složení (0.02.002)', () => {
    assert.deepEqual(rozlozitVydani('1985-09@PH'), { rok: '1985', mesic: '09', edice: 'PH/US', zeme: 'US', casopis: 'PH' });
    assert.deepEqual(rozlozitVydani('1986-03-UK@PH'), { rok: '1986', mesic: '03', edice: 'PH/UK', zeme: 'UK', casopis: 'PH' });
    assert.deepEqual(rozlozitVydani('1985-S01@HU'), { rok: '1985', mesic: 'S01', edice: 'HU/US', zeme: 'US', casopis: 'HU' });
    assert.deepEqual(rozlozitVydani('1985@PH'), { rok: '1985', mesic: '', edice: 'PH/US', zeme: 'US', casopis: 'PH' });
    for (const spatne of ['1985-09@PB', '1985-09@ph', '1985-09@P', '1985-09-@PH', '1985-13@PH']) assert.equal(rozlozitVydani(spatne), null, spatne);
    for (const klic of ['1985-09@PH', '1986-03-UK@PH', '1985-S01@HU', '1985@PH', '1985-UK@PH', '2009-11-CZ', '2009-11', '2012', '1995-S01-CZ']) {
        const v = rozlozitVydani(klic);
        assert.equal(slozitVydani(v.rok, v.mesic, v.edice), klic, klic);
    }
    assert.equal(slozitVydani('1985', '09', 'PH/US'), '1985-09@PH');
    assert.equal(slozitVydani('1985', '', 'PH/UK'), '1985-UK@PH');
    assert.equal(nazevVydani('1985-09@PH'), 'Září 1985 · PH');
    assert.equal(nazevVydani('1986-03-UK@PH'), 'Březen 1986 · PH UK');
    // Playboy beze změny
    assert.equal(nazevVydani('2009-11'), 'Listopad 2009');
    assert.equal(nazevVydani('2009-11-CZ'), 'Listopad 2009 · CZ');
});

test('vydání s edicí', () => {
    assert.deepEqual(rozlozitVydani('2009-11-CZ'), { rok: '2009', mesic: '11', edice: 'CZ', zeme: 'CZ', casopis: 'PB' });
    assert.deepEqual(rozlozitVydani('2012'), { rok: '2012', mesic: '', edice: 'US', zeme: 'US', casopis: 'PB' });
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

test('diakritika jako v Go včetně písmen, která se nerozkládají', async () => {
    const { bezDiakritiky } = await import('../src/lib/format.js');
    assert.equal(bezDiakritiky('Łucja Øster Straße'), 'lucja oster strasse');
    assert.equal(bezDiakritiky('Zoë Émilie'), 'zoe emilie');
});
