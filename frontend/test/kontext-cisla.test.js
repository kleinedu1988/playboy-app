import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelkyVCisle, sousedniCisla } from '../src/lib/kontext-cisla.js';

const kalendar = ['1995-02', '1995-01', '1994-12', '1995-S01', '1995', '1995-01-DE', '1995-03'].map(vydani => ({ vydani }));

test('Sousední čísla: jen měsíční čísla téže edice, chronologicky', () => {
    assert.deepEqual(sousedniCisla(kalendar, '1995-01'), { predchozi: '1994-12', dalsi: '1995-02' });
    assert.deepEqual(sousedniCisla(kalendar, '1995-03'), { predchozi: '1995-02', dalsi: '' });
    assert.deepEqual(sousedniCisla(kalendar, '1995-01-DE'), { predchozi: '', dalsi: '' });
    // Číslo, které v kalendáři není, se zařadí mezi ostatní
    assert.deepEqual(sousedniCisla(kalendar, '1995-04'), { predchozi: '1995-03', dalsi: '' });
    assert.deepEqual(sousedniCisla(kalendar, 'nesmysl'), { predchozi: '', dalsi: '' });
});

test('Modelky v čísle: role, Playmate napřed, bez modelky profilu', () => {
    const modelky = [
        { id: 1, jmeno: 'Anna', vydani: ['1995-01'], obalky: [], pictorialVydani: '' },
        { id: 2, jmeno: 'Bára', vydani: [], obalky: ['1995-01'], pictorialVydani: '1994-06\n1995-01' },
        { id: 3, jmeno: 'Cecílie', vydani: ['1995-01'], obalky: ['1995-01'], pictorialVydani: '' },
        { id: 4, jmeno: 'Dana', vydani: ['1995-02'], obalky: null, pictorialVydani: null },
    ];
    assert.deepEqual(modelkyVCisle(modelky, '1995-01', 1), [
        { id: 3, jmeno: 'Cecílie', role: ['centerfold', 'obálka'] },
        { id: 2, jmeno: 'Bára', role: ['obálka', 'pictorial'] },
    ]);
    assert.equal(modelkyVCisle(modelky, '1995-03').length, 0);
});
