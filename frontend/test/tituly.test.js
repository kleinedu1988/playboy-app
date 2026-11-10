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
    const { kategorieModelky } = await import('../src/lib/format.js');
    nastavitCasopisy(CASOPISY);
    const nazvy = m => kategorieModelky(m).map(k => k.nazev);
    assert.deepEqual(nazvy({ centerfoldy: ['1985-09@PH'] }), ['Pet of the Month']);
    assert.deepEqual(nazvy({ centerfoldy: ['1985-09@PH', '1987-02-UK@PH', '1990-01@HU'] }), ['Pet of the Month', 'Honey of the Month']);
    assert.deepEqual(nazvy({ centerfoldy: ['1987-02', '1985-09@PH'] }), ['Playmate měsíce', 'Pet of the Month']);
    assert.deepEqual(nazvy({ centerfoldy: ['1987-02'] }), ['Playmate měsíce']);
    // Ručně zapsaná Playmate měsíce zůstane i u modelky jen s Penthouse
    assert.ok(nazvy({ role: 'Playmate měsíce', centerfoldy: ['1985-09@PH'] }).includes('Playmate měsíce'));
    nastavitCasopisy([]);
});

test('typy alb podle časopisu: Pet of the Month v okně alba a v popisu alba', async () => {
    const { popisDruhuCasopisu, popisTypuAlba, TYP_PM_MESICE, TYP_PM_ROKU } = await import('../src/lib/format.js');
    nastavitCasopisy(CASOPISY);
    assert.deepEqual([popisDruhuCasopisu(TYP_PM_MESICE), popisDruhuCasopisu(TYP_PM_ROKU, 'PB')], ['Playmate of the Month', 'Playmate of the Year']);
    assert.deepEqual([popisDruhuCasopisu(TYP_PM_MESICE, 'PH'), popisDruhuCasopisu(TYP_PM_ROKU, 'PH')], ['Pet of the Month', 'Pet of the Year']);
    assert.equal(popisDruhuCasopisu(TYP_PM_MESICE, 'HU'), 'Honey of the Month');
    assert.equal(popisDruhuCasopisu('Pictorial', 'PH'), 'Pictorial');
    assert.equal(popisTypuAlba(TYP_PM_MESICE, '', '1985-09'), 'Pictorial Playmate měsíce');
    assert.equal(popisTypuAlba(TYP_PM_MESICE, ''), 'Pictorial Playmate měsíce');
    assert.equal(popisTypuAlba(TYP_PM_ROKU, '', '1986-S01-UK@PH'), 'Pictorial Pet of the Year');
    nastavitCasopisy([]);
});

test('kategorie z pictorialů jiných časopisů (backend titulyJinde) a jejich pořadí', async () => {
    const { kategorieModelky, odvozeneKategorie } = await import('../src/lib/format.js');
    nastavitCasopisy(CASOPISY);
    // Pictorial Pet of the Month a Pet of the Year 1986 (bez centerfoldu): žádná Playmate
    const pet = { centerfoldy: [], playmateMesice: false, playmateRoku: '', titulyJinde: [{ nazev: 'Pet of the Month' }, { nazev: 'Pet of the Year', rok: '1986' }] };
    assert.deepEqual(odvozeneKategorie(pet), ['Pet of the Month', 'Pet of the Year']);
    assert.deepEqual(kategorieModelky(pet).map(k => [k.nazev, k.detail]), [['Pet of the Month', ''], ['Pet of the Year', '1986']]);
    // Playmate roku i Pet: tituly Playboye první, Modelka obálky za nimi
    const obe = { centerfoldy: ['1985-09'], playmateRoku: '1986', obalky: ['1986-06'], titulyJinde: [{ nazev: 'Pet of the Month' }] };
    assert.deepEqual(kategorieModelky(obe).map(k => k.nazev), ['Playmate měsíce', 'Playmate roku', 'Pet of the Month', 'Modelka obálky']);
    nastavitCasopisy([]);
});

test('Kalendář podle časopisu: platné řady a jejich názvy (0.02.016)', async () => {
    const { platnaRadaKalendare, nazevVolbyRady } = await import('../src/lib/format.js');
    // Před načtením časopisů platí každá řada ve správném tvaru (uložená volba z minula se nezahodí)
    assert.deepEqual(['US', 'CZ', 'PH/US', 'xx', 'PH-US', ''].map(platnaRadaKalendare), [true, true, true, false, false, false]);
    nastavitCasopisy(CASOPISY);
    assert.deepEqual(['US', 'PH/UK', 'HU/US', 'HU/UK', 'OU/US'].map(platnaRadaKalendare), [true, true, true, false, true]);
    assert.deepEqual(['US', 'CZ', 'PH/UK'].map(nazevVolbyRady), ['Playboy US', 'Playboy CZ', 'Penthouse UK']);
    nastavitCasopisy([]);
});

test('stěna Centerfoldů podle časopisu (0.02.018)', async () => {
    const { moznostiSteny, naSteneCenterfoldu } = await import('../src/lib/format.js');
    // Bez tabulky časopisů jen Playboy
    assert.deepEqual(moznostiSteny().map(m => m.hodnota), ['vse', 'US', 'CZ']);
    nastavitCasopisy(CASOPISY);
    assert.deepEqual(moznostiSteny().map(m => [m.hodnota, m.nazev]), [
        ['vse', 'Playboy'], ['US', 'Playboy US'], ['CZ', 'Playboy CZ'],
        ['c:PH', 'Penthouse'], ['PH/US', 'Penthouse US'], ['PH/UK', 'Penthouse UK'],
        ['c:HU', 'Hustler'], ['c:OU', 'Oui'], ['vsechny', 'Všechny časopisy'],
    ]);
    const alba = ['1985-09', '2012-03-CZ', '1985-09@PH', '1986-03-UK@PH', '1990-01@HU', 'Staré album'];
    const na = volba => alba.filter(a => naSteneCenterfoldu(a, volba));
    assert.deepEqual(na('vse'), ['1985-09', '2012-03-CZ', 'Staré album']);
    assert.deepEqual(na('c:PH'), ['1985-09@PH', '1986-03-UK@PH']);
    assert.deepEqual(na('PH/UK'), ['1986-03-UK@PH']);
    assert.deepEqual(na('US'), ['1985-09']);
    assert.deepEqual(na('vsechny'), alba);
    nastavitCasopisy([]);
});

test('hledání casopis: v pohledech čísel a fotek, zkratky ph / hu / pb (0.02.019)', async () => {
    const { poleCisla, poleFotky, rozlozitDotaz, vyhovujeHledani } = await import('../src/lib/format.js');
    const { prevest, rozpoznat } = await import('../src/lib/hledani-dotaz.js');
    nastavitCasopisy(CASOPISY);
    assert.equal(poleCisla('1985-09@PH').casopis, 'Penthouse PH');
    assert.equal(poleCisla('1985-09').casopis, 'Playboy PB');
    assert.equal(poleFotky({ album: '1990-01@HU' }).casopis, 'Hustler HU');
    const najde = (dotaz, vydani) => vyhovujeHledani([vydani], rozlozitDotaz(prevest(dotaz)), poleCisla(vydani));
    assert.deepEqual(['casopis:penthouse', 'ph', 'penthouse 1985', 'pb', '-casopis:ph'].map(d => najde(d, '1985-09@PH')), [true, true, true, false, false]);
    assert.deepEqual(['casopis:playboy', 'pb', 'hustler'].map(d => najde(d, '1985-09')), [true, true, false]);
    assert.equal(prevest('ph 80. léta'), 'casopis:ph rok:1980-1989');
    assert.deepEqual(rozpoznat('hustler').map(c => c.popis), ['Časopis: Hustler']);
    // Samotné slovo playboy zůstává textem
    assert.equal(prevest('playboy'), 'playboy');
    nastavitCasopisy([]);
});
