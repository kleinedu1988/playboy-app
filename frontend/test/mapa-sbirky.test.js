// Testy mapy sbírky (frontend/src/lib/mapa-sbirky.js) podle docs/NAVRH-SITE.md §2.9.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    bodVMnohouhelniku,
    gowerPodobnost,
    pripravitPriznakyMapy,
    procrustes2D,
    skupinaVlasu,
    uplnostModelky,
    vypocitatMapuSbirky,
} from '../src/lib/mapa-sbirky.js';

function vytvorModelku(id, prepis = {}) {
    return {
        id,
        jmeno: `Modelka ${id}`,
        vyskaCm: 170,
        vahaKg: 54,
        obvodHrudnikCm: 89,
        obvodPasCm: 60,
        obvodBokyCm: 89,
        narozeniDatum: '1973-04-12',
        vydani: ['1995-06'],
        centerfoldy: ['1995-06'],
        obalky: [],
        onlineAlba: [],
        narodnost: 'USA',
        vlasyBarva: 'Blond',
        ociBarva: 'Modré',
        role: 'Playmate měsíce',
        prsaTyp: 'Přírodní',
        ochlupeni: 'Zastřižené',
        tetovani: 0,
        piercing: 0,
        hodnoceni: 4,
        ...prepis,
    };
}

test('skupinaVlasu a uplnostModelky: sjednocení barev vlasů a počítání vyplněných údajů', () => {
    assert.equal(skupinaVlasu('Honey Blonde'), 'Blond');
    assert.equal(skupinaVlasu('Dark Brown'), 'Hnědé');
    assert.equal(skupinaVlasu('Hnědá'), 'Hnědé');
    assert.equal(skupinaVlasu('Black'), 'Černé');
    assert.equal(skupinaVlasu('Auburn / Red'), 'Zrzavé');
    assert.equal(skupinaVlasu(''), '');

    const plna = vytvorModelku(1);
    assert.equal(uplnostModelky(plna), 10);

    const prazdna = vytvorModelku(2, {
        vyskaCm: 0, vahaKg: 0, obvodHrudnikCm: 0, obvodPasCm: 0, obvodBokyCm: 0,
        narozeniDatum: '', narodnost: '', vlasyBarva: '', ociBarva: '', prsaTyp: '', tetovani: -1,
    });
    assert.equal(uplnostModelky(prazdna), 1);
});

test('vypocitatMapuSbirky: syntetická sbírka se 3 skupinami je v 2D zřetelně oddělená a deterministická', () => {
    const modelky = [];
    let id = 1;
    // Skupina A: 60. léta, drobnější tmavovlásky v časopise
    for (let i = 0; i < 20; i++) {
        modelky.push(vytvorModelku(id++, {
            jmeno: `Šedesátá ${i}`,
            vyskaCm: 162 + (i % 3),
            vahaKg: 49 + (i % 3),
            obvodHrudnikCm: 88 + (i % 2),
            obvodPasCm: 56 + (i % 2),
            obvodBokyCm: 88 + (i % 2),
            narozeniDatum: `194${i % 9}-03-10`,
            vydani: [`196${i % 9}-05`],
            centerfoldy: [`196${i % 9}-05`],
            vlasyBarva: 'Hnědé',
            ociBarva: 'Hnědé',
            role: 'Playmate měsíce',
            prsaTyp: 'Přírodní',
            ochlupeni: 'Přírodní',
            tetovani: 0,
            piercing: 0,
        }));
    }
    // Skupina B: 90. léta, vysoké blondýnky v časopise
    for (let i = 0; i < 20; i++) {
        modelky.push(vytvorModelku(id++, {
            jmeno: `Devadesátá ${i}`,
            vyskaCm: 176 + (i % 3),
            vahaKg: 57 + (i % 3),
            obvodHrudnikCm: 92 + (i % 2),
            obvodPasCm: 60 + (i % 2),
            obvodBokyCm: 91 + (i % 2),
            narozeniDatum: `197${i % 9}-04-15`,
            vydani: [`199${i % 9}-08`],
            centerfoldy: [`199${i % 9}-08`],
            obalky: [`199${i % 9}-08`],
            vlasyBarva: 'Blond',
            ociBarva: 'Modré',
            role: 'Playmate měsíce, Modelka obálky',
            prsaTyp: 'Silikonová',
            ochlupeni: 'Oholené',
            tetovani: 0,
            piercing: 0,
        }));
    }
    // Skupina C: 2010+, online modelky s tetováním a piercingem
    for (let i = 0; i < 20; i++) {
        modelky.push(vytvorModelku(id++, {
            jmeno: `Online ${i}`,
            vyskaCm: 168 + (i % 3),
            vahaKg: 52 + (i % 3),
            obvodHrudnikCm: 85 + (i % 2),
            obvodPasCm: 61 + (i % 2),
            obvodBokyCm: 89 + (i % 2),
            narozeniDatum: `199${i % 9}-07-20`,
            vydani: [],
            centerfoldy: [],
            onlineAlba: [`201${i % 9}-03`],
            vlasyBarva: 'Černé',
            ociBarva: 'Zelené',
            role: 'Cyber Girl, Online',
            prsaTyp: 'Přírodní',
            ochlupeni: 'Oholené',
            tetovani: 1,
            piercing: 1,
        }));
    }

    const mapa1 = vypocitatMapuSbirky(modelky);
    const mapa2 = vypocitatMapuSbirky(modelky);
    assert.equal(mapa1.body.length, 60);

    // Determinismus: opakované spuštění dá na bit stejné souřadnice
    for (let i = 0; i < 60; i++) {
        assert.equal(mapa1.body[i].x, mapa2.body[i].x);
        assert.equal(mapa1.body[i].y, mapa2.body[i].y);
    }

    // Orientace os: 60. léta vlevo (menší X než 2010+), vysoké modelky nahoře
    const stred = (od, doIdx) => {
        const vyrez = mapa1.body.slice(od, doIdx);
        return {
            x: vyrez.reduce((s, b) => s + b.x, 0) / vyrez.length,
            y: vyrez.reduce((s, b) => s + b.y, 0) / vyrez.length,
        };
    };
    const cA = stred(0, 20);
    const cB = stred(20, 40);
    const cC = stred(40, 60);

    assert.ok(cA.x < cC.x, `60. léta (${cA.x}) mají být vlevo od 2010+ (${cC.x})`);
    const vzdAB = Math.hypot(cA.x - cB.x, cA.y - cB.y);
    const vzdBC = Math.hypot(cB.x - cC.x, cB.y - cC.y);
    const vzdAC = Math.hypot(cA.x - cC.x, cA.y - cC.y);
    assert.ok(vzdAB > 0.35 && vzdBC > 0.35 && vzdAC > 0.35, 'Těžiště skupin musí být od sebe zřetelně oddělená');
});

test('vypocitatMapuSbirky: chybějící údaje nevytvoří umělý ostrov daleko od shodné modelky', () => {
    const modelky = [];
    for (let i = 1; i <= 40; i++) {
        modelky.push(vytvorModelku(i, {
            vyskaCm: 160 + (i % 18),
            vahaKg: 48 + (i % 14),
            obvodHrudnikCm: 84 + (i % 12),
            obvodPasCm: 56 + (i % 10),
            obvodBokyCm: 85 + (i % 12),
            vydani: [`${1970 + i}-06`],
            vlasyBarva: i % 2 === 0 ? 'Blond' : 'Hnědé',
        }));
    }
    const zaklad = modelky[20];
    const uplna = vytvorModelku(101, {
        ...zaklad,
        id: 101,
        vyskaCm: 168,
        vahaKg: 54,
        obvodHrudnikCm: 89,
        obvodPasCm: 60,
        obvodBokyCm: 90,
    });
    const castecna = vytvorModelku(102, {
        ...uplna,
        id: 102,
        vahaKg: 0,
        obvodPasCm: 0,
    });
    const mapa = vypocitatMapuSbirky([...modelky, uplna, castecna]);
    const bUplna = mapa.body.find(b => b.id === 101);
    const bCastecna = mapa.body.find(b => b.id === 102);

    const vzdalenost = Math.hypot(bUplna.x - bCastecna.x, bUplna.y - bCastecna.y);
    assert.ok(vzdalenost < 0.15, `Vzdálenost při chybějících mediánových údajích (${vzdalenost}) má být malá`);
});

test('procrustes2D: uzavřené zarovnání otočených, zrcadlených a posunutých bodů s chybou < 1e-9', () => {
    const stareX = [-0.8, -0.3, 0.1, 0.5, 0.9, -0.4, 0.2];
    const stareY = [-0.6, 0.4, -0.2, 0.7, -0.5, 0.8, 0.1];
    const uhel = 0.73;
    const cos = Math.cos(uhel), sin = Math.sin(uhel);
    const noveX = stareX.map((x, i) => 1.25 * (cos * (-x) - sin * stareY[i]) + 0.4);
    const noveY = stareY.map((y, i) => 1.25 * (sin * (-stareX[i]) + cos * y) - 0.3);

    const { x, y, posun } = procrustes2D(noveX, noveY, stareX, stareY);
    for (let i = 0; i < stareX.length; i++) {
        assert.ok(Math.abs(x[i] - stareX[i]) < 1e-9, `Chyba X[${i}]: ${Math.abs(x[i] - stareX[i])}`);
        assert.ok(Math.abs(y[i] - stareY[i]) < 1e-9, `Chyba Y[${i}]: ${Math.abs(y[i] - stareY[i])}`);
    }
    assert.ok(posun < 1e-7);
});

test('gowerPodobnost a bodVMnohouhelniku: vysvětlení podobnosti a výběr lasem', () => {
    const m1 = vytvorModelku(1, { jmeno: 'A', vyskaCm: 175, vydani: ['1994-05'], vlasyBarva: 'Blond' });
    const m2 = vytvorModelku(2, { jmeno: 'B', vyskaCm: 176, vydani: ['1995-07'], vlasyBarva: 'Blond' });
    const m3 = vytvorModelku(3, { jmeno: 'C', vyskaCm: 158, vydani: ['1962-01'], vlasyBarva: 'Černé', ociBarva: 'Hnědé' });
    const priprava = pripravitPriznakyMapy([m1, m2, m3]);

    const pod12 = gowerPodobnost(priprava.zaklad[0], priprava.zaklad[1]);
    const pod13 = gowerPodobnost(priprava.zaklad[0], priprava.zaklad[2]);
    assert.ok(pod12.podobnost > pod13.podobnost);
    assert.ok(pod12.duvody.length > 0);

    const ctverec = [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }];
    assert.equal(bodVMnohouhelniku(0, 0, ctverec), true);
    assert.equal(bodVMnohouhelniku(0.8, 0, ctverec), false);
});

test('vypocitatMapuSbirky: výkon pro 500 modelek', () => {
    const modelky = Array.from({ length: 500 }, (_, i) => vytvorModelku(i + 1, {
        vyskaCm: 158 + (i % 22),
        vahaKg: 47 + (i % 18),
        obvodHrudnikCm: 82 + (i % 16),
        obvodPasCm: 55 + (i % 12),
        obvodBokyCm: 84 + (i % 14),
        vydani: [`${1955 + (i % 68)}-0${1 + (i % 9)}`],
        vlasyBarva: ['Blond', 'Hnědé', 'Černé', 'Zrzavé'][i % 4],
        ociBarva: ['Modré', 'Hnědé', 'Zelené', 'Šedé'][i % 4],
        narodnost: ['USA', 'Kanada', 'Velká Británie', 'Česko'][i % 4],
    }));
    const t0 = performance.now();
    const res = vypocitatMapuSbirky(modelky);
    const trvani = performance.now() - t0;
    assert.equal(res.body.length, 500);
    assert.ok(trvani < 500, `Výpočet mapy pro 500 modelek trval ${trvani.toFixed(1)} ms`);
});
