// Řady čísel jako data (0.02.014): Playboy se chová přesně jako před převodem
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RADY_EDIC, ciselRocniku, cisloNevyslo, slozitVydani } from '../src/lib/format.js';
import { RADY_CISEL } from '../src/lib/rady-cisel.js';

// Původní pravidlo z format.js před 0.02.014
function puvodne(rok, mesic, edice) {
    const rady = { US: { od: '1953-12', do: '2020-03' }, CZ: { od: '2011-07', do: '' } };
    const klic = slozitVydani(String(rok), mesic, edice);
    if (klic === '1955-03') return true;
    const rada = rady[edice], m = `${rok}-${mesic}`;
    return m < rada.od || Boolean(rada.do && m > rada.do);
}

test('každý měsíc 1950–2030 v obou edicích Playboye stejně jako dřív', () => {
    for (const edice of ['US', 'CZ']) for (let rok = 1950; rok <= 2030; rok++) for (let i = 1; i <= 12; i++) {
        const mesic = String(i).padStart(2, '0');
        assert.equal(cisloNevyslo(slozitVydani(String(rok), mesic, edice)), puvodne(rok, mesic, edice), `${rok}-${mesic} ${edice}`);
    }
    assert.deepEqual([ciselRocniku(1953, 'US'), ciselRocniku(1955, 'US'), ciselRocniku(2020, 'US'), ciselRocniku(2011, 'CZ'), ciselRocniku(2015, 'CZ')], [1, 11, 3, 6, 12]);
    assert.deepEqual(RADY_EDIC, { US: { od: '1953-12', do: '2020-03' }, CZ: { od: '2011-07', do: '' } });
});

test('speciál, ročník a řada bez dat nejsou „nevyšlo“', () => {
    assert.equal(cisloNevyslo('1950-S01'), false);
    assert.equal(cisloNevyslo('1950'), false);
    assert.equal(cisloNevyslo('1950-01@PH'), false);
});

test('data řad mají správný tvar', () => {
    for (const [rada, d] of Object.entries(RADY_CISEL)) {
        assert.match(rada, /^([A-Z]{2}|[A-Z]{2}\/[A-Z]{2})$/);
        assert.match(d.od, /^\d{4}-\d{2}$/, rada);
        assert.match(d.do, /^(\d{4}-\d{2})?$/, rada);
        assert.ok(d.nevysla.every(m => /^\d{4}-\d{2}$/.test(m) && m >= d.od && (!d.do || m <= d.do)), rada);
        assert.ok(d.zdroj, rada);
    }
});
