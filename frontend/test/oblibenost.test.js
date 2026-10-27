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
    assert.deepEqual(textPoradiProfilu({ poradi: 12, zmenaPoradi: 0, trendDni: 30 }), { poradi: '12. v oblíbenosti', uroven: '', ceka: '', obhajuje: '', trend: null });

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

test('úrovně oblíbenosti: úroveň modelky, čekání, bublina a podmínky z backendu', async () => {
    const { UROVNE, urovenMista, urovenModelky, chybiKUrovni, textCekani, bublinaCekani, textPravidelUrovni, textPoradiProfilu } = await import('../src/lib/oblibenost.js');
    assert.deepEqual(UROVNE, [10, 20, 50, 100]);
    assert.deepEqual([1, 10, 11, 20, 21, 50, 51, 100, 101, 0].map(urovenMista), [10, 10, 20, 20, 50, 50, 100, 100, 0, 0]);

    // Modelka z GetModelky i položka pořadí dají totéž; čekání na stejnou nebo nižší úroveň se nepočítá
    assert.deepEqual(urovenModelky({ urovenTop: 20, cekaNaTop: 10 }), { uroven: 20, ceka: 10 });
    assert.deepEqual(urovenModelky({ uroven: 20, ceka: { uroven: 10 } }), { uroven: 20, ceka: 10 });
    assert.deepEqual(urovenModelky({ urovenTop: 10, cekaNaTop: 10 }), { uroven: 10, ceka: 0 });
    assert.deepEqual(urovenModelky({ urovenTop: 0, cekaNaTop: 100 }), { uroven: 0, ceka: 100 });
    assert.deepEqual(urovenModelky({}), { uroven: 0, ceka: 0 });

    const ceka = { uroven: 10, porovnani: 5, potrebaPorovnani: 8, nejistota: 0.42, maxNejistota: 0.3, potrebaVyhry: true, maVyhru: false };
    assert.deepEqual(chybiKUrovni(ceka), ['ještě 3 porovnání (má 5 z 8)', 'jistější místo: nejistota 0,42, potřeba nejvýš 0,3', 'výhra nad modelkou z top 20']);
    assert.deepEqual(chybiKUrovni({ ...ceka, porovnani: 9, nejistota: 0.2, maVyhru: true }), []);
    assert.deepEqual(chybiKUrovni(null), []);
    assert.equal(textCekani(ceka), 'čeká na Top 10 (5/8 porovnání)');
    assert.equal(textCekani({ ...ceka, porovnani: 8 }), 'čeká na Top 10 (nejistota 0,42)');
    assert.equal(textCekani({ ...ceka, porovnani: 8, nejistota: 0.25 }), 'čeká na Top 10 (chybí výhra nad top 20)');
    assert.equal(textCekani({ ...ceka, porovnani: 8, nejistota: 0.25, maVyhru: true }), 'čeká na Top 10');
    assert.equal(textCekani({ uroven: 0 }), '');
    assert.equal(textCekani(undefined), '');

    const bublina = bublinaCekani(ceka, 4);
    assert.match(bublina, /^Podle síly patří na 4\. místo – do Top 10\./);
    assert.match(bublina, /• ještě 3 porovnání \(má 5 z 8\)\n• jistější místo/);
    assert.match(bublina, /těsně pod hranicí/);
    assert.match(bublinaCekani({ ...ceka, porovnani: 8, nejistota: 0.1, maVyhru: true }), /Podmínky už splňuje/);
    assert.match(bublinaCekani(ceka), /^Podle síly patří do Top 10\./);

    // Prahy se berou z backendu (tady doladěné jinak než výchozí), od nejnižší úrovně
    const urovne = [
        { uroven: 10, potrebaPorovnani: 9, maxNejistota: 0.25, potrebaVyhry: true, potvrzenych: 10 },
        { uroven: 100, potrebaPorovnani: 2, maxNejistota: 0, potrebaVyhry: false, potvrzenych: 40 },
        { uroven: 50, potrebaPorovnani: 4, maxNejistota: 0.5, potrebaVyhry: false, potvrzenych: 30 },
    ];
    assert.equal(textPravidelUrovni(urovne), 'Úrovně potvrzuje počet porovnání a jistota místa – Top 100: 2 porovnání · Top 50: 4 porovnání, nejistota ≤ 0,5 · Top 10: 9 porovnání, nejistota ≤ 0,25, výhra nad modelkou z top 20. Modelka, která je ještě nesplňuje, čeká těsně pod hranicí. Potvrzená v Top 10, 20 nebo 50 o místo nepřijde jen proto, že ji silou předstihla jiná: obhajuje ho, dokud s ní neprohraje v souboji.');
    assert.equal(textPravidelUrovni([]), '');
    assert.equal(textPravidelUrovni(undefined), '');

    assert.deepEqual(textPoradiProfilu({ poradi: 3, urovenTop: 10, zmenaPoradi: 0 }), { poradi: '3. v oblíbenosti', uroven: 'Top 10', ceka: '', obhajuje: '', trend: null });
    assert.deepEqual(textPoradiProfilu({ poradi: 11, urovenTop: 20, cekaNaTop: 10 }), { poradi: '11. v oblíbenosti', uroven: '', ceka: 'čeká na Top 10', obhajuje: '', trend: null });
    assert.equal(textPoradiProfilu({ poradi: 140, urovenTop: 0 }).uroven, '');
});

test('úrovně oblíbenosti: seskupení pořadí, čekající a nadpis souboje', async () => {
    const { seskupitPodleUrovni, poctyCekajicich, textCekajicich, nadpisSouboje } = await import('../src/lib/oblibenost.js');
    const poradi = [
        { modelkaId: 1, poradi: 1, uroven: 10 }, { modelkaId: 2, poradi: 2, uroven: 10 },
        { modelkaId: 3, poradi: 3, uroven: 20, ceka: { uroven: 10 } }, { modelkaId: 4, poradi: 4, uroven: 20 },
        { modelkaId: 5, poradi: 5, uroven: 0 },
    ];
    // Úseky podle místa; nepotvrzená na místě v top 10 (úroveň nesplňuje) se nepočítá mezi potvrzené
    assert.deepEqual(seskupitPodleUrovni(poradi).map(s => [s.uroven, s.polozky.map(p => p.modelkaId), s.potvrzenych]), [[10, [1, 2, 3, 4, 5], 2]]);
    const dlouhe = Array.from({ length: 12 }, (_, i) => ({ modelkaId: i + 1, poradi: i + 1, uroven: i < 3 ? 10 : i === 11 ? 20 : 0 }));
    assert.deepEqual(seskupitPodleUrovni(dlouhe).map(s => [s.uroven, s.polozky.length, s.potvrzenych]), [[10, 10, 3], [20, 2, 1]]);
    // Bez úrovní z backendu: podle potvrzeného místa
    const bezUrovni = Array.from({ length: 22 }, (_, i) => ({ modelkaId: i + 1, poradi: i + 1 }));
    assert.deepEqual(seskupitPodleUrovni(bezUrovni).map(s => [s.uroven, s.polozky.length]), [[10, 10], [20, 10], [50, 2]]);
    assert.deepEqual(seskupitPodleUrovni([]), []);

    const pocty = poctyCekajicich([...poradi, { cekaNaTop: 50 }, { urovenTop: 100, cekaNaTop: 50 }, { cekaNaTop: 0 }]);
    assert.deepEqual(pocty, [[10, 1], [50, 2]]);
    assert.equal(textCekajicich(pocty), '3 čekají na potvrzení (1 na Top 10, 2 na Top 50)');
    assert.equal(textCekajicich([[10, 1]]), '1 čeká na potvrzení (1 na Top 10)');
    assert.equal(textCekajicich([], 6), '6 čeká na potvrzení');
    assert.equal(textCekajicich([]), '');

    assert.equal(nadpisSouboje({ druh: '', duvod: 'Stejná úroveň srdíček' }), '');
    assert.equal(nadpisSouboje({ druh: 'souboj', duvod: 'Souboj o top 10: Anna (11.) proti Báře (10.)' }), 'Souboj o Top 10');
    assert.equal(nadpisSouboje({ druh: 'souboj', duvod: 'Anna čeká na potvrzení do top 10 (5/8 porovnání): proti Báře (10.)' }), 'O postup do Top 10');
    assert.equal(nadpisSouboje({ druh: 'souboj', duvod: 'Obhajoba top 20: Bára (20.) brání místo, Anna (21.) ji silou předstihla – rozhodne jejich souboj' }), 'Obhajoba Top 20');

    assert.equal(nadpisSouboje({ druh: 'souboj', duvod: 'Na hranici' }, { cekaNaTop: 50 }, { urovenTop: 50 }), 'Souboj o Top 50');
    assert.equal(nadpisSouboje({ druh: 'souboj', duvod: '' }), 'Souboj o místo');
});

test('štítek úrovně z položky pořadí i z modelky', async () => {
    const { stitekUrovne } = await import('../src/lib/oblibenost.js');
    assert.equal(stitekUrovne({}), null);
    assert.deepEqual(stitekUrovne({ urovenTop: 10 }), { text: 'Top 10', ceka: false, title: 'Potvrzená v Top 10 oblíbenosti' });
    const m = stitekUrovne({ urovenTop: 20, cekaNaTop: 10 });
    assert.equal(m.text, 'čeká na Top 10');
    assert.equal(m.ceka, true);
    const p = stitekUrovne({ uroven: 20, mistoPodleSily: 4, ceka: { uroven: 10, porovnani: 5, potrebaPorovnani: 8, nejistota: 0.2, maxNejistota: 0.3, potrebaVyhry: true, maVyhru: true } });
    assert.equal(p.text, 'čeká na Top 10 (5/8 porovnání)');
    assert.match(p.title, /4\. místo – do Top 10[\s\S]*ještě 3 porovnání/);
});

test('obhajoba místa: štítky držitelky a vyzyvatelky', async () => {
    const { textCekani, bublinaCekani, stitekObhajoby, stitekUrovne, textPoradiProfilu } = await import('../src/lib/oblibenost.js');
    const ceka = { uroven: 10, porovnani: 12, potrebaPorovnani: 10, nejistota: 0.2, maxNejistota: 0.3, potrebaVyhry: true, maVyhru: true, drzitelka: 7 };
    assert.equal(textCekani(ceka, 'Bára'), 'čeká na souboj o Top 10 (místo brání Bára)');
    assert.equal(textCekani(ceka), 'čeká na souboj o Top 10');
    assert.match(bublinaCekani(ceka, 9, 'Bára'), /patří na 9\. místo – do Top 10 a podmínky splňuje\.\nMísto ale obhajuje Bára/);
    assert.equal(stitekObhajoby(null), null);
    const s = stitekObhajoby({ uroven: 10, vyzyvatelka: 3 }, 'Anna');
    assert.equal(s.text, 'obhajuje Top 10');
    assert.match(s.title, /^Anna ji silou předstihla\. Místo v Top 10 jí ale zůstává, dokud s ní neprohraje/);
    assert.equal(stitekUrovne({ uroven: 10, obhajoba: { uroven: 10, vyzyvatelka: 3 } }).text, 'Top 10 · obhajuje');
    assert.equal(stitekUrovne({ urovenTop: 20, obhajujeTop: 20 }).text, 'Top 20 · obhajuje');
    assert.equal(textPoradiProfilu({ poradi: 10, urovenTop: 10, obhajujeTop: 10 }).obhajuje, 'obhajuje');
});

test('síň slávy: texty kroniky, rekordů, dní a profilu', async () => {
    const { textDni, datumKroniky, mesicKroniky, textUdalosti, textRekordu, kronikaPoMesicich, textSlavyProfilu } = await import('../src/lib/slava.js');
    assert.equal(textDni(0), 'od dneška');
    assert.equal(textDni(0, true), 'od začátku kroniky');
    assert.equal(textDni(1), '1 den');
    assert.equal(textDni(3, true), 'aspoň 3 dny');
    assert.equal(textDni(12), '12 dní');
    assert.equal(datumKroniky('2026-07-28 20:15:00'), '28. 7. 2026');
    assert.equal(mesicKroniky('2026-10-01 08:00:00'), 'říjen 2026');
    assert.equal(datumKroniky(''), '');
    const jmena = { 1: 'Anna', 2: 'Bára' };
    const jmeno = id => jmena[id] || '';
    assert.equal(textUdalosti({ druh: 'vstup', modelkaId: 1, misto: 7, souperka: 2 }, jmeno).text, 'Anna vstoupila do Top 10 na 7. místo · rozhodla výhra, soupeřka Bára');
    assert.equal(textUdalosti({ druh: 'vystup', modelkaId: 2, misto: 11, souperka: 1 }, jmeno).text, 'Bára vypadla z Top 10 · vytlačila ji Anna');
    assert.equal(textUdalosti({ druh: 'obhajoba', modelkaId: 2, misto: 9, souperka: 1 }, jmeno).text, 'Bára obhájila místo v Top 10 · vyzyvatelka Anna');
    assert.equal(textUdalosti({ druh: 'jednicka', modelkaId: 1, misto: 1, souperka: 2 }, jmeno).text, 'Nová jednička: Anna · předtím Bára');
    assert.equal(textUdalosti({ druh: 'jednicka', modelkaId: 1, misto: 1, souperka: 0 }, jmeno).text, 'Jednička: Anna');
    assert.equal(textUdalosti({ druh: 'vstup', modelkaId: 9, misto: 3, souperka: 0 }, jmeno).text, 'Modelka vstoupila do Top 10 na 3. místo');
    assert.deepEqual(textRekordu({ druh: 'nejdele', hodnota: 92, odZacatku: true, trva: true }), { nazev: 'Nejdéle v Top 10', hodnota: 'aspoň 92 dní', popis: 'celkem, a pořád v ní je' });
    assert.equal(textRekordu({ druh: 'rychlost', hodnota: 11 }).hodnota, '11 porovnání');
    assert.equal(textRekordu({ druh: 'obhajoby', hodnota: 3 }).hodnota, '3×');
    const skupiny = kronikaPoMesicich([{ cas: '2026-10-27 10:00:00' }, { cas: '2026-10-02 10:00:00' }, { cas: '2026-09-30 10:00:00' }]);
    assert.deepEqual(skupiny.map(s => [s.mesic, s.udalosti.length]), [['říjen 2026', 2], ['září 2026', 1]]);
    assert.equal(textSlavyProfilu({ modelkaId: 0 }), '');
    assert.equal(textSlavyProfilu({ modelkaId: 3, pobytu: 2, vTop: true, dniTed: 30, dniCelkem: 90, dniNaPrvnim: 12, obhajob: 2, nejlepsiMisto: 1 }),
        'V Top 10 30 dní · celkem 90 dní · na 1. místě 12 dní · 2× obhájila · nejlépe 1.');
    assert.equal(textSlavyProfilu({ modelkaId: 3, pobytu: 1, vTop: false, dniCelkem: 40, odZacatku: true, nejlepsiMisto: 4 }), 'V Top 10 byla aspoň 40 dní · nejlépe 4.');
});
