import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poctyObalek, poradiObalekHero } from '../src/lib/hero-obalek.js';

test('hero Obálek: výročí napřed, pak hodnocení, jen zvolená řada (0.02.024)', () => {
    const covery = [
        { album: '1985-11', url: 'a', hodnoceni: 3 },
        { album: '1985-11', url: 'a2', hodnoceni: 5 },
        { album: '1990-02', url: 'b', hodnoceni: 4 },
        { album: '1991-03', url: 'c', hodnoceni: 4 },
        { album: '1988-11@PH', url: 'd', hodnoceni: 5 },
        { album: '2026-11', url: 'e', hodnoceni: 1 },
    ];
    const listopad = new Date(2026, 10, 10);
    assert.deepEqual(poradiObalekHero(covery, 'US', listopad).map(o => [o.vydani, o.url, o.vyroci]),
        [['1985-11', 'a2', true], ['1991-03', 'c', false], ['1990-02', 'b', false], ['2026-11', 'e', false]]);
    assert.deepEqual(poradiObalekHero(covery, 'PH/US', listopad).map(o => o.vydani), ['1988-11@PH']);
    assert.deepEqual(poradiObalekHero([], 'US'), []);
});

test('hero Obálek: počty obálek a chybějících v rozpracovaných ročnících', () => {
    const cisla = [{ vydani: '1985-01', cover: true }, { vydani: '1985-02', cover: false }, { vydani: '1986-05', cover: true }, { vydani: '1986-S01', cover: true }];
    assert.deepEqual(poctyObalek(cisla, 'US'), { sCoverem: 2, chybi: 22, rocniku: 2 });
});
