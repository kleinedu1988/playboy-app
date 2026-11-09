import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navrhnoutVyrazy, odebrat, prevest, rozpoznat } from '../src/lib/hledani-dotaz.js';

test('Kritérium hotovo: blond výška > 175 90. léta 4*+ → čtyři čipy a příkazy', () => {
    const t = 'blond výška > 175 90. léta 4*+';
    const casti = rozpoznat(t);
    assert.deepEqual(casti.map(c => c.popis), ['Vlasy: blond', 'Výška > 175 cm', '1990–1999', '♥ 4+']);
    assert.equal(prevest(t), 'vlasy:blond vyska:>175 rok:1990-1999 srdicka:>=4');
    assert.equal(odebrat(t, casti[1]), 'blond 90. léta 4*+');
});

test('Míry, porovnání slovy, rozsahy a desetinná čísla', () => {
    const p = t => prevest(t);
    assert.equal(p('pas <= 60'), 'pas:<=60');
    assert.equal(p('pas<=60 cm'), 'pas:<=60');
    assert.equal(p('výška 170-180'), 'vyska:170-180');
    assert.equal(p('výška 170 až 180 cm'), 'vyska:170-180');
    assert.equal(p('bmi < 18,5'), 'bmi:<18.5');
    assert.equal(p('whr ≤ 0,7'), 'whr:<=0.7');
    assert.equal(p('mladší než 21'), 'vek:<21');
    assert.equal(p('vyšší než 175 cm'), 'vyska:>175');
    assert.equal(p('věk 18-20'), 'vek:18-20');
});

test('Desetiletí, roky, edice, kategorie, srdíčka a příznaky', () => {
    const p = t => prevest(t);
    assert.equal(p('70. léta'), 'rok:1970-1979');
    assert.equal(p('90s'), 'rok:1990-1999');
    assert.equal(p('1980s'), 'rok:1980-1989');
    assert.equal(p('devadesátá léta'), 'rok:1990-1999');
    assert.equal(p('10. léta'), 'rok:2010-2019');
    assert.equal(p('1995–1999'), 'rok:1995-1999');
    assert.equal(p('česká edice'), 'edice:CZ');
    assert.equal(p('česká'), 'česká');
    assert.equal(p('pmoy'), 'kategorie:"playmate roku","playmate of the year"');
    assert.equal(p('5*'), 'srdicka:5');
    assert.equal(p('♥ 3,5+'), 'srdicka:>=3,5');
    assert.equal(p('4 srdíčka'), 'srdicka:4');
    assert.equal(p('bez tetování'), 'tetovani:ne');
    assert.equal(p('s tetováním'), 'tetovani:ano');
    assert.equal(p('-blond'), '-vlasy:blond');
    assert.equal(p('bez fotek'), 'fotek:0');
    assert.equal(p('Anna blond'), 'Anna vlasy:blond');
});

test('Ruční příkazy a uvozovky se nepřekládají, jen popíšou', () => {
    assert.equal(prevest('vlasy:blond "90. léta" vyska:>170'), 'vlasy:blond "90. léta" vyska:>170');
    const casti = rozpoznat('vyska:>170 -tag:muse');
    assert.deepEqual(casti.map(c => c.popis), ['Výška: >170', 'Ne: Tag: muse']);
    assert.deepEqual(rozpoznat(''), []);
    assert.equal(prevest('Pamela Anderson 1995'), 'Pamela Anderson 1995');
});

test('Návrhy výrazů podle psaného slova', () => {
    assert.deepEqual(navrhnoutVyrazy('vys').map(n => n.vyraz), ['výška > ', 'vyšší než ']);
    assert.ok(navrhnoutVyrazy('90').some(n => n.vyraz === '90. léta'));
    assert.deepEqual(navrhnoutVyrazy('x'), []);
});

test('Desetinná pole ve frontendu stejně jako v backendu (TestDesetinnaPole)', async () => {
    const { poleModelkyFotky, rozlozitDotaz, vyhovujeHledani, vekVPrvnimCisle } = await import('../src/lib/format.js');
    const m = { vyskaCm: 170, vahaKg: 52, obvodHrudnikCm: 90, obvodPasCm: 60, obvodBokyCm: 88, narozeniDatum: '1975-08-02',
        vydani: ['1999-01', '1997-05-CZ'], pocetFotek: 0, vlasyBarva: 'blond' };
    const pole = poleModelkyFotky(m);
    const ok = d => vyhovujeHledani([], rozlozitDotaz(d), pole);
    for (const d of ['pas:<=60', 'hrudnik:85-95', 'bmi:<18', 'bmi:17,9', 'whr:<0,7', 'vek:21', 'fotek:0', 'vlasy:blond', 'vyska:>165']) assert.ok(ok(d), d);
    for (const d of ['pas:>60', 'bmi:18', 'whr:0.6-0.65', 'vek:>21', 'fotek:>0', '-fotek:0']) assert.ok(!ok(d), d);
    assert.equal(vekVPrvnimCisle(m), 21);
    assert.ok(!vyhovujeHledani([], rozlozitDotaz('pas:<70'), poleModelkyFotky({ obvodPasCm: 0 })));
    assert.ok(vyhovujeHledani([], rozlozitDotaz(prevest('blond výška > 165 pas <= 60')), pole));
});
