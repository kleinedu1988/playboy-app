import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predLety, uplnostRocniku, vybratRocnik } from '../src/lib/hero-kalendare.js';

const mapa = (zaznamy) => new Map(zaznamy.map(([k, v]) => [k, { cover: true, centerfold: true, pictorial: true, nahled: 'x', ...v }]));

test('hero Kalendáře: ročník výročí napřed, Další ročník dokola (0.02.023)', () => {
    const v = mapa([['1985-11', {}], ['1985-03', {}], ['1990-11', {}], ['2001-05', {}]]);
    const listopad = new Date(2026, 10, 10);
    assert.deepEqual(vybratRocnik(v, 'US', listopad), { rok: 1990, vyroci: '1990-11', pocet: 3 });
    assert.deepEqual(vybratRocnik(v, 'US', listopad, 1), { rok: 1985, vyroci: '1985-11', pocet: 3 });
    assert.deepEqual(vybratRocnik(v, 'US', listopad, 2), { rok: 2001, vyroci: '', pocet: 3 });
    assert.equal(vybratRocnik(v, 'US', listopad, 3).rok, 1990);
    assert.equal(vybratRocnik(new Map(), 'US'), null);
    // Řada jiného časopisu
    const ph = mapa([['1985-11@PH', {}]]);
    assert.equal(vybratRocnik(ph, 'PH/US', listopad).vyroci, '1985-11@PH');
});

test('hero Kalendáře: úplnost ročníku', () => {
    const v = mapa([['1985-01', {}], ['1985-02', { pictorial: false }], ['1985-03', { cover: false }]]);
    const u = uplnostRocniku(v, 1985, 'US');
    assert.deepEqual([u.cisel, u.mame, u.cover, u.centerfold, u.pictorial, u.kompletni, u.chybi.length], [12, 3, 2, 3, 2, 1, 9]);
    assert.equal(u.chybi[0], '1985-04');
    // 1955-03 nevyšlo: ročník 1955 má 11 čísel
    assert.equal(uplnostRocniku(new Map(), 1955, 'US').chybi.includes('1955-03'), false);
    assert.deepEqual([predLety(1), predLety(41)], ['před rokem', 'před 41 lety']);
});
