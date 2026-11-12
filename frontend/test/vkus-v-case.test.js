import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radaPodilu, srdickaPoMesicich, vkusVCase } from '../src/lib/vkus-v-case.js';

// 40 blond a 40 černovlásek; dřív vyhrávaly černovlásky, za poslední rok blondýnky
function data({ posun = true } = {}) {
    const modelky = Array.from({ length: 80 }, (_, i) => ({ id: i + 1, jmeno: `M${i}`, vlasyBarva: i < 40 ? 'blond' : 'černá', vydani: ['1990-01'], role: '' }));
    const porovnani = [];
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let d = 0; d < 700; d++) {
        const den = new Date(Date.UTC(2024, 0, 1) + d * 864e5).toISOString().slice(0, 10);
        const blond = 1 + Math.floor(rnd() * 40), cerna = 41 + Math.floor(rnd() * 40);
        const letos = d >= 700 - 365;
        const blondVyhraje = rnd() < (posun ? (letos ? 0.7 : 0.35) : 0.5);
        porovnani.push(blondVyhraje ? { den, vitez: blond, porazena: cerna } : { den, vitez: cerna, porazena: blond });
    }
    return { modelky, porovnani };
}

test('vkus v čase: průkazný posun k blondýnkám', () => {
    const { modelky, porovnani } = data();
    const v = vkusVCase({ porovnani }, modelky);
    const blond = v.postrehy.find(p => p.klic === 'blond');
    assert.ok(blond?.kladny, JSON.stringify(v.postrehy));
    assert.match(blond.text, /víc líbí blondýnky/);
    const cerne = v.postrehy.find(p => p.klic === 'cerne');
    assert.ok(cerne && !cerne.kladny);
    assert.match(cerne.text, /méně než dřív/);
    const rada = radaPodilu(v.radky.find(r => r.klic === 'blond'), v.mesice);
    assert.equal(rada.length, v.mesice.length);
    assert.ok(rada.at(-1).podil > rada[0].podil);
});

test('vkus v čase: bez posunu žádná věta', () => {
    const { modelky, porovnani } = data({ posun: false });
    assert.deepEqual(vkusVCase({ porovnani }, modelky).postrehy, []);
    assert.deepEqual(vkusVCase({ porovnani: [] }, modelky).postrehy, []);
});

test('srdíčka po měsících', () => {
    const s = srdickaPoMesicich([{ den: '2026-01-03', modelka: 1, pred: 0, po: 4 }, { den: '2026-01-09', modelka: 2, pred: 0, po: 3 },
        { den: '2026-02-01', modelka: 1, pred: 4, po: 4.5 }, { den: '2026-02-02', modelka: 2, pred: 3, po: 2 }]);
    assert.deepEqual(s.map(r => [r.mesic, r.nove, r.pridano, r.ubrano, r.prumerNovych]), [['2026-01', 2, 0, 0, 3.5], ['2026-02', 0, 1, 1, null]]);
});

test('vkus v čase: časopis jako vlastnost (0.02.070)', () => {
    const { modelky, porovnani } = data();
    // Blondýnky jsou z Penthouse: posun k nim je i posun k Penthouse
    modelky.forEach(m => { if (m.vlasyBarva === 'blond') m.vydani = ['1990-01@PH']; });
    const v = vkusVCase({ porovnani }, modelky);
    const ph = v.postrehy.find(p => p.klic === 'casopis:PH');
    assert.ok(ph?.kladny, JSON.stringify(v.postrehy));
    assert.match(ph.text, /víc líbí modelky Penthouse/);
    // Sbírka jen z Playboye vlastnost časopisu nemá
    assert.ok(!vkusVCase({ porovnani }, data().modelky).radky.some(r => r.klic.startsWith('casopis:')));
});
