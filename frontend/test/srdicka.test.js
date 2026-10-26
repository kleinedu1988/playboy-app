import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dnesniPocet, formatSrdicek, hodnotaPoKlavese, hodnotaPoKliku, hodnotaZPozice, idDvojice, kratceSrdicka, naPulky, navrhPoPorovnani,
    porovnatOblibenost, procentaPresnosti, pruhySily, textModeluVkusu, textSrdicek, ukazatOdhad, vyhovujeMinimu, znakySrdicek } from '../src/lib/srdicka.js';
import { castGalerie, seraditModelky } from '../src/lib/format.js';

test('srdíčka po půlkách: zaokrouhlení a české zápisy', () => {
    assert.equal(naPulky(3.4), 3.5);
    assert.equal(naPulky(7), 5);
    assert.equal(naPulky(-1), 0);
    assert.equal(naPulky('x'), 0);
    assert.equal(formatSrdicek(3.5), '3,5');
    assert.equal(formatSrdicek(4), '4');
    assert.equal(textSrdicek(0), 'bez srdíček');
    assert.equal(textSrdicek(1), '1 srdíčko');
    assert.equal(textSrdicek(3), '3 srdíčka');
    assert.equal(textSrdicek(3.5), '3,5 srdíčka');
    assert.equal(textSrdicek(5), '5 srdíček');
    assert.equal(textSrdicek(0.5), '0,5 srdíčka');
    assert.equal(kratceSrdicka(3.5), '3½');
    assert.equal(kratceSrdicka(0.5), '½');
    assert.equal(kratceSrdicka(4), '4');
    assert.equal(znakySrdicek(2.5), '♥♥½');
    assert.equal(znakySrdicek(0), '');
});

test('klik na půlku a místo kliku v srdíčku', () => {
    assert.equal(hodnotaPoKliku(3, 3.5), 3.5);
    assert.equal(hodnotaPoKliku(3.5, '3.5'), 0, 'klik na současnou hodnotu ji zruší');
    assert.equal(hodnotaPoKliku(0, 1), 1);
    assert.equal(hodnotaZPozice(4, 0.2), 3.5, 'levá půlka čtvrtého srdíčka');
    assert.equal(hodnotaZPozice(4, 0.7), 4);
    assert.equal(hodnotaZPozice(1, 0), 0.5);
});

test('klávesy: číslice, stejná znovu přidá půlku, šipky po půlce', () => {
    assert.equal(hodnotaPoKlavese(0, '3'), 3);
    assert.equal(hodnotaPoKlavese(3, '3'), 3.5);
    assert.equal(hodnotaPoKlavese(3.5, '3'), 3);
    assert.equal(hodnotaPoKlavese(2.5, '3'), 3);
    assert.equal(hodnotaPoKlavese(5, '5'), 4.5, 'pětka podruhé ubere půlku');
    assert.equal(hodnotaPoKlavese(4.5, '5'), 5);
    assert.equal(hodnotaPoKlavese(4, '0'), 0);
    assert.equal(hodnotaPoKlavese(3, 'ArrowRight'), 3.5);
    assert.equal(hodnotaPoKlavese(5, 'ArrowRight'), 5);
    assert.equal(hodnotaPoKlavese(0, 'ArrowLeft'), 0);
    assert.equal(hodnotaPoKlavese(2, 'End'), 5);
    assert.equal(hodnotaPoKlavese(2, 'a'), null);
    assert.equal(hodnotaPoKlavese(2, '6'), null);
});

test('filtr srdíček a řazení podle oblíbenosti', () => {
    assert.equal(vyhovujeMinimu(3.5, 3), true, '3+ zahrnuje 3,5');
    assert.equal(vyhovujeMinimu(2.5, 3), false);
    assert.equal(vyhovujeMinimu(0, -1), true);
    assert.equal(vyhovujeMinimu(0.5, -1), false);
    assert.equal(vyhovujeMinimu(0, 0), true);
    const m = [{ id: 1, oblibenost: 1, hodnoceni: 3 }, { id: 2, oblibenost: 2, hodnoceni: 2 }, { id: 3, oblibenost: 1, hodnoceni: 4.5 }, { id: 4, hodnoceni: 5 }];
    assert.deepEqual([...m].sort(porovnatOblibenost).map(x => x.id), [4, 3, 1, 2], 'napřed srdíčka');
    const stejna = [{ id: 1, oblibenost: 4.1, hodnoceni: 4 }, { id: 2, oblibenost: 4.3, hodnoceni: 4 }, { id: 3, oblibenost: 3.9, hodnoceni: 0 }, { id: 4, hodnoceni: 0 }, { id: 5, oblibenost: 4.6, hodnoceni: 4.5 }];
    assert.deepEqual(seraditModelky(stejna, 'hodnoceni').map(x => x.id), [5, 2, 1, 3, 4], 'se stejnými srdíčky podle oblíbenosti, nehodnocené na konci podle odhadu');
    assert.equal(castGalerie({ hodnoceni: 3.5 }, 'hodnoceni'), '♥♥♥½');
    assert.equal(castGalerie({ hodnoceni: 0 }, 'hodnoceni'), 'Bez srdíček');
});

test('odhad jen u nehodnocené, návrh po porovnání jen při velkém rozporu', () => {
    assert.equal(ukazatOdhad({ hodnoceni: 0, odhadHodnoceni: 3.5 }), true);
    assert.equal(ukazatOdhad({ hodnoceni: 2, odhadHodnoceni: 3.5 }), false);
    assert.equal(ukazatOdhad({ hodnoceni: 0, odhadHodnoceni: 0 }), false);
    assert.deepEqual(navrhPoPorovnani({ hodnoceni: 2.5 }, { hodnoceni: 4 }, 'a'), { modelka: 'a', hodnoceni: 4 });
    assert.equal(navrhPoPorovnani({ hodnoceni: 3.5 }, { hodnoceni: 4 }, 'a'), null, 'půlka rozdílu nevadí');
    assert.equal(navrhPoPorovnani({ hodnoceni: 2 }, { hodnoceni: 4 }, 'remiza'), null);
    assert.equal(navrhPoPorovnani({ hodnoceni: 0 }, { hodnoceni: 4 }, 'a'), null, 'nehodnocené se nenabízí');
    assert.deepEqual(navrhPoPorovnani({ hodnoceni: 5 }, { hodnoceni: 2 }, 'b'), { modelka: 'b', hodnoceni: 5 });
});

test('Oblíbenost: věta o modelu, dvojice, dnešní počet a pruhy síly', () => {
    assert.equal(procentaPresnosti(0.724), '72 %');
    assert.equal(textModeluVkusu({ presnost: 0.72, modelek: 380, porovnani: 140 }),
        'Model vkusu odhaduje tvé hodnocení s přesností 72 % podle 380 hodnocených modelek a 140 porovnání.');
    assert.match(textModeluVkusu({ presnost: 0, modelek: 1, porovnani: 0 }), /teprve učí: zatím má 1 hodnocené modelky/);
    assert.deepEqual(idDvojice({ a: 3, b: 7, duvod: 'x' }), { a: 3, b: 7, duvod: 'x' });
    assert.deepEqual(idDvojice({ a: { id: 3 }, b: { id: 7 } }), { a: 3, b: 7, duvod: '' });
    assert.equal(dnesniPocet({ datum: '2026-10-25', pocet: 12 }, '2026-10-25'), 12);
    assert.equal(dnesniPocet({ datum: '2026-10-24', pocet: 12 }, '2026-10-25'), 0);
    assert.equal(dnesniPocet(null, '2026-10-25'), 0);
    const p = pruhySily([{ sila: 2, nejistota: 0.5 }, { sila: 0, nejistota: 0 }, { sila: 1, nejistota: 0.2 }]);
    assert.deepEqual(p.map(x => x.sirka), [100, 4, 50]);
    assert.deepEqual(p.map(x => x.nejistota), [25, 0, 10]);
    assert.deepEqual(pruhySily([{ sila: 1, nejistota: 0 }]).map(x => x.sirka), [100]);
});
