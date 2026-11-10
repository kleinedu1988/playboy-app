// Tituly modelky podle časopisu (0.02.009): Playmate, Pet, Honey
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nastavitCasopisy, titulCasopisu, titulCisla } from '../src/lib/format.js';

const CASOPISY = [
    { klic: 'PB', nazev: 'Playboy', edice: ['US', 'CZ'], modelkaMesice: 'Playmate měsíce', modelkaRoku: 'Playmate roku' },
    { klic: 'PH', nazev: 'Penthouse', edice: ['US', 'UK'], modelkaMesice: 'Pet of the Month', modelkaRoku: 'Pet of the Year' },
    { klic: 'HU', nazev: 'Hustler', edice: ['US'], modelkaMesice: 'Honey of the Month', modelkaRoku: 'Honey of the Year' },
    { klic: 'OU', nazev: 'Oui', edice: ['US'], modelkaMesice: '', modelkaRoku: '' },
];

test('titul měsíce, roku a krátký pro všechny tři časopisy', () => {
    nastavitCasopisy(CASOPISY);
    assert.deepEqual(['PB', 'PH', 'HU'].map(k => [titulCasopisu(k), titulCasopisu(k, 'roku'), titulCasopisu(k, 'kratky')]), [
        ['Playmate měsíce', 'Playmate roku', 'Playmate'],
        ['Pet of the Month', 'Pet of the Year', 'Pet'],
        ['Honey of the Month', 'Honey of the Year', 'Honey'],
    ]);
    nastavitCasopisy([]);
});

test('titul podle čísla: edice i speciál, Playboy bez přípony', () => {
    nastavitCasopisy(CASOPISY);
    assert.equal(titulCisla('1985-09'), 'Playmate měsíce');
    assert.equal(titulCisla('2012-03-CZ', 'kratky'), 'Playmate');
    assert.equal(titulCisla('1985-09@PH'), 'Pet of the Month');
    assert.equal(titulCisla('1986-03-UK@PH', 'roku'), 'Pet of the Year');
    assert.equal(titulCisla('1985-S01@HU', 'kratky'), 'Honey');
    assert.equal(titulCisla('Staré album'), 'Playmate měsíce');
    nastavitCasopisy([]);
});

test('časopis bez titulu a bez načtené tabulky', () => {
    nastavitCasopisy(CASOPISY);
    assert.deepEqual([titulCisla('1980-05@OU'), titulCisla('1980-05@OU', 'roku'), titulCisla('1980-05@OU', 'kratky')], ['Modelka měsíce', 'Modelka roku', 'Modelka']);
    nastavitCasopisy([]);
    // Bez tabulky (před načtením z backendu): Playboy jako dřív, jiný časopis obecně
    assert.equal(titulCisla('1985-09', 'kratky'), 'Playmate');
    assert.equal(titulCisla('1985-09@PH'), 'Modelka měsíce');
});

test('kategorie v profilu: Pet of the Month místo Playmate měsíce, obě u modelky ze dvou časopisů', async () => {
    const { kategorieKZobrazeni } = await import('../src/lib/format.js');
    nastavitCasopisy(CASOPISY);
    const nazvy = m => kategorieKZobrazeni(m).map(k => k.nazev);
    assert.deepEqual(nazvy({ centerfoldy: ['1985-09@PH'] }), ['Pet of the Month']);
    assert.deepEqual(nazvy({ centerfoldy: ['1985-09@PH', '1987-02-UK@PH', '1990-01@HU'] }), ['Pet of the Month', 'Honey of the Month']);
    assert.deepEqual(nazvy({ centerfoldy: ['1987-02', '1985-09@PH'] }), ['Playmate měsíce', 'Pet of the Month']);
    assert.deepEqual(nazvy({ centerfoldy: ['1987-02'] }), ['Playmate měsíce']);
    // Ručně zapsaná Playmate měsíce zůstane i u modelky jen s Penthouse
    assert.ok(nazvy({ role: 'Playmate měsíce', centerfoldy: ['1985-09@PH'] }).includes('Playmate měsíce'));
    nastavitCasopisy([]);
});
