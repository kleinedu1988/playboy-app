import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAHLEDU_V_POROVNANI, popisNahledu, textSkoreFotek, textVahyFotek } from '../src/lib/oblibenost.js';

test('galerie obou ukáže nejvýš 24 nejlepších fotek (strop GetNahledyModelek)', () => {
    assert.equal(NAHLEDU_V_POROVNANI, 24);
});

test('texty skóre fotek, popisku náhledu a váhy fotek', () => {
    assert.equal(textSkoreFotek(4.26), 'fotky 4,3');
    assert.equal(textSkoreFotek(4), 'fotky 4,0');
    assert.equal(textSkoreFotek(0), '');
    assert.equal(popisNahledu({ album: 'Pictorial', hodnoceni: 4 }, 0), 'Pictorial · ♥♥♥♥ · 1. fotka');
    assert.equal(popisNahledu({ album: '', hodnoceni: 0 }, 2), 'bez srdíček · 3. fotka');
    assert.equal(textVahyFotek({ vahaFotek: 0.3 }), 'Skóre fotek váží v pořadí 30 % (výchozí). Naučí se z porovnání modelek se stejnými srdíčky.');
    assert.match(textVahyFotek({ vahaFotek: 0.3, porovnaniVahy: 4 }), /zatím 4, potřeba aspoň 10/);
    assert.equal(textVahyFotek({ vahaFotek: 0.62, vahaNaucena: true, porovnaniVahy: 120, zlepseniFotek: 0.12 }),
        'Skóre fotek váží v pořadí 62 %, naučeno podle 120 porovnání modelek se stejnými srdíčky, předpověď porovnání je díky fotkám o 12 % lepší.');
    assert.match(textVahyFotek({ vahaFotek: 0.05, vahaNaucena: true, porovnaniVahy: 30, zlepseniFotek: -0.02 }), /fotky zatím porovnání nepředpovídají/);
});

test('trend modelky, řádek pořadí v profilu a řazení fotek podle oblíbenosti', async () => {
    const { trendModelky, textPoradiProfilu, porovnatFotkyPodleSrdicek, stoupajiKlesaji, textVahyZajmu } = await import('../src/lib/oblibenost.js');
    assert.equal(trendModelky({ zmenaPoradi: 3, trendDni: 0 }), null, 'bez historie není trend');
    assert.equal(trendModelky({ zmenaPoradi: 2, trendDni: 30 }, 3), null, 'na kartě jen výrazný');
    assert.deepEqual(trendModelky({ zmenaPoradi: 3, trendDni: 30 }), { smer: 'nahoru', znak: '▲', text: 'o 3 místa výš než před 30 dny', kratce: '3 za 30 dní' });
    assert.equal(trendModelky({ zmenaPoradi: -1, trendDni: 1 }).text, 'o 1 místo níž než včera');
    assert.equal(trendModelky({ zmenaPoradi: -7, trendDni: 8 }).text, 'o 7 míst níž než před 8 dny');
    assert.equal(textPoradiProfilu({ poradi: 0 }), null);
    assert.deepEqual(textPoradiProfilu({ poradi: 12, zmenaPoradi: 0, trendDni: 30 }), { poradi: '12. v oblíbenosti', trend: null });

    const ob = new Map([[1, 4.3], [2, 4.1], [3, 3.2]]);
    const fotky = [{ id: 'a', modelkaId: 2, hodnoceni: 5 }, { id: 'b', modelkaId: 3, hodnoceni: 4 }, { id: 'c', modelkaId: 1, hodnoceni: 5 }, { id: 'd', modelkaId: 9, hodnoceni: 4 }];
    assert.deepEqual([...fotky].sort(porovnatFotkyPodleSrdicek(ob)).map(f => f.id), ['c', 'a', 'b', 'd']);

    const poradi = Array.from({ length: 10 }, (_, i) => ({ modelkaId: i + 1, zmenaPoradi: [5, -4, 2, 3, 0, -3, 0, 0, 7, -1][i] }));
    const { stoupaji, klesaji } = stoupajiKlesaji(poradi);
    assert.deepEqual(stoupaji.map(p => p.modelkaId), [9, 1, 4]);
    assert.deepEqual(klesaji.map(p => p.modelkaId), [2, 6]);

    assert.match(textVahyZajmu({}), /zájem/);
    assert.match(textVahyZajmu({ vahaZajmu: 0.15, zajemNaucen: true, porovnaniZajmu: 24, zajemDni: 40 }), /0,15 srdíčka.*24 porovnání/);
});
