import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dalsiKroky, filtrovatUdrzbu, idNavrhu, sestavitUdrzbu, zalozkaPole, zdrojePolozek } from '../src/lib/udrzba.js';

// Modelka se všemi hlídanými údaji; jednotlivé testy jí údaje uberou
const uplna = (id, jmeno, dalsi = {}) => ({
    id, jmeno, narozeniDatum: '1975-03-12', narozeniMisto: 'Praha', narodnost: 'Česko', etnicita: 'Bělošská', vyskaCm: 172, vahaKg: 54,
    vlasyBarva: 'Blond', ociBarva: 'Modré', ochlupeni: 'Oholená', tetovani: 0, piercing: 0, obvodHrudnikCm: 90, obvodPasCm: 60, obvodBokyCm: 90,
    velikostPrsou: 'C', prsaTyp: 'Přírodní', role: 'Celebrita', tags: 'x', vydani: [], centerfoldy: [], obalky: [], netykaSe: '', hodnoceni: 3, ...dalsi,
});
const polozka = (m, netykaSe = false) => ({ modelkaId: m.id, jmeno: m.jmeno, album: '', typ: '', netykaSe });
const prehled = (dalsi = {}) => ({ modelek: 0, alb: 10, albOnline: 0, vydani: 20, bezTitulni: [], bezCenterfoldu: [], bezHodnoceni: [], albaBezPopisu: [], albaBezVydani: [],
    vydaniBezCoveru: [], vydaniBezCenterfoldu: [], podezrele: [], ...dalsi });

test('Playmate bez data narození jde ve frontě před drobnostmi', () => {
    const playmate = uplna(1, 'Anna', { narozeniDatum: '', centerfoldy: ['1990-01'] });
    const drobnosti = uplna(2, 'Bára', { vahaKg: 0, ociBarva: '', tags: '', prsaTyp: '', ochlupeni: '' });
    const model = sestavitUdrzbu({ p: prehled({ modelek: 2 }), modelky: [drobnosti, playmate] });
    assert.deepEqual(model.skupiny.map(s => s.jmeno), ['Anna', 'Bára']);
    const ukol = model.skupiny[0].polozky[0];
    assert.equal(ukol.filtr, 'udaje');
    assert.match(ukol.duvod, /Playmate bez data narození/);
    assert.equal(model.skupiny[0].uroven, 'vysoka');
});

test('nález kontroly a návrh patří do skupiny modelky, počty filtrů', () => {
    const m = uplna(3, 'Cecílie', { narodnost: '' });
    const n = { modelkaId: 3, jmeno: 'Cecílie', album: '', typ: '', pole: 'narodnost', popis: 'národnost', hodnota: 'USA', jistota: 0.95, duvod: 'Místo narození', klic: 'navrh:narodnost', inputId: 'inputNarodnost', odmitnuto: false, zdroj: 'misto', zdrojPopis: 'Místo narození → národnost' };
    const p = prehled({ modelek: 1, podezrele: [{ modelkaId: 3, jmeno: 'Cecílie', popis: 'Výška 17 cm', klic: 'kontrola:vyska', album: '', typ: '', pole: 'inputVyska', netykaSe: false, zdroj: 'rozsah' }] });
    const model = sestavitUdrzbu({ p, modelky: [m], navrhy: [n] });
    assert.equal(model.skupiny.length, 1);
    assert.deepEqual(model.skupiny[0].polozky.map(x => x.druh).sort(), ['kontrola', 'navrh', 'ukol']);
    assert.equal(model.pocty.vse, 1);
    assert.equal(model.pocty.kontrola, 1);
    assert.equal(model.pocty.navrhy, 1);
    assert.equal(model.pocty.udaje, 1);
    const kontrola = model.skupiny[0].polozky.find(x => x.druh === 'kontrola');
    assert.equal(kontrola.pole, 'výška');
    assert.deepEqual(zdrojePolozek(model, 'navrhy'), [{ zdroj: 'misto', popis: 'Místo narození → národnost', pocet: 1 }]);
    assert.equal(filtrovatUdrzbu(model, { filtr: 'navrhy', zdroj: 'jiny' }).length, 0);
    assert.equal(filtrovatUdrzbu(model, { filtr: 'navrhy', zdroj: 'misto' })[0].polozky.length, 1);
});

test('netýká se: bez vyřízených zmizí, s nimi zůstane označené a nepočítá se', () => {
    const m = uplna(4, 'Dana', { narozeniDatum: '', narozeniMisto: '', netykaSe: 'zakladni' });
    const p = prehled({ modelek: 1 });
    assert.equal(sestavitUdrzbu({ p, modelky: [m] }).skupiny.length, 0);
    const skryte = sestavitUdrzbu({ p, modelky: [m], skryte: true });
    assert.equal(skryte.skupiny.length, 1);
    assert.equal(skryte.skupiny[0].polozky[0].netyka, true);
    assert.equal(skryte.pocty.vse, 0);
});

test('hledání podle jména bez diakritiky, čísla a kroky', () => {
    const modelky = [uplna(5, 'Šárka Nová', { tags: '' }), uplna(6, 'Eva Malá', { tags: '' })];
    const model = sestavitUdrzbu({ p: prehled({ modelek: 2, vydaniBezCoveru: ['1996-02'], vydaniBezCenterfoldu: ['1996-02'] }), modelky });
    assert.deepEqual(filtrovatUdrzbu(model, { hledat: 'sarka' }).map(v => v.skupina.jmeno), ['Šárka Nová']);
    const cislo = model.skupiny.find(s => s.druh === 'vydani');
    assert.deepEqual(cislo.polozky.map(x => x.filtr), ['cfcisla', 'cover']);
    assert.equal(model.pocty.cover, 1);
    assert.equal(dalsiKroky(model, 2).length, 2);
    // Pokrok: čísla 19 z 20 s coverem
    assert.deepEqual(model.pokrok.find(o => o.klic === 'cover'), { skupina: 'Čísla', klic: 'cover', nazev: 'Cover', hotovo: 19, celkem: 20, chybi: 1, filtr: 'cover', jednotka: '' });
});

test('návrh je určený i hodnotou (odmítnutí platí jen pro ni), pole formuláře mají část', () => {
    const n = { modelkaId: 1, album: '', typ: '', klic: 'navrh:oci', hodnota: 'Hnědé' };
    assert.notEqual(idNavrhu(n), idNavrhu({ ...n, hodnota: 'Modré' }));
    assert.equal(zalozkaPole('inputVyska'), 1);
    assert.equal(zalozkaPole('inputUmrtiDatum'), 0);
    assert.equal(zalozkaPole('inputTags'), 2);
});

test('titulní fotka a alba: položky a odložení po albech', () => {
    const m = uplna(7, 'Gábina');
    const p = prehled({ modelek: 1, bezTitulni: [polozka(m)], albaBezPopisu: [{ ...polozka(m), album: 'Pláž', typ: 'Pictorial' }, { ...polozka(m, true), album: 'Les', typ: 'Pictorial' }] });
    const model = sestavitUdrzbu({ p, modelky: [m] });
    const s = model.skupiny[0];
    assert.equal(s.polozky[0].id, 'titulni');
    const text = s.polozky.find(x => x.id === 'text');
    // Album označené „netýká se“ se nepočítá
    assert.equal(text.pole, '1 album bez textu');
    assert.equal(model.radkyModelek[0].id, 7);
});
