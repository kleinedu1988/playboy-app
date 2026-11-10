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

test('hero stěny: centerfold dne napřed, jen zvolený časopis, bez otočených (0.02.025)', async () => {
    const { poradiCenterfolduHero } = await import('../src/lib/hero-obalek.js');
    const { naSteneCenterfoldu } = await import('../src/lib/format.js');
    const fotky = [
        { album: '1985-11@PH', modelkaId: 1, url: 'a', hodnoceni: 2 },
        { album: '1985-11@PH', modelkaId: 1, url: 'a2', hodnoceni: 4 },
        { album: '1987-03@PH', modelkaId: 2, url: 'b', hodnoceni: 5 },
        { album: '1988-04@PH', modelkaId: 3, url: 'c', hodnoceni: 5, rotace: 90 },
        { album: '1986-11', modelkaId: 4, url: 'd', hodnoceni: 5 },
    ];
    const listopad = new Date(2026, 10, 10);
    const ph = poradiCenterfolduHero(fotky, a => naSteneCenterfoldu(a, 'c:PH'), listopad);
    assert.deepEqual(ph.map(f => [f.album, f.url, f.vyroci]), [['1985-11@PH', 'a2', true], ['1987-03@PH', 'b', false]]);
    assert.deepEqual(poradiCenterfolduHero(fotky, a => naSteneCenterfoldu(a, 'vse'), listopad).map(f => f.url), ['d']);
});
