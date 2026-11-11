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

test('Statistiky podle časopisu: texty a barva titulů jiných časopisů (0.02.020)', async () => {
    const { jeTitulJinehoCasopisu, maJineCasopisy, vCasopiseStatistik } = await import('../src/lib/format.js');
    const playboy = [{ vydani: ['1985-09'], obalky: ['1986-01'] }];
    const obe = [...playboy, { vydani: [], obalky: ['1987-02@PH'] }];
    assert.equal(maJineCasopisy(playboy), false);
    assert.equal(vCasopiseStatistik(playboy), 'v časopise');
    assert.equal(maJineCasopisy(obe), true);
    assert.equal(vCasopiseStatistik(obe), 'v Playboyi');
    nastavitCasopisy(CASOPISY);
    assert.deepEqual(['Pet of the Month', 'Pet of the Year', 'Playmate měsíce', 'Celebrita'].map(jeTitulJinehoCasopisu), [true, true, false, false]);
    nastavitCasopisy([]);
    assert.equal(jeTitulJinehoCasopisu('Pet of the Month'), false);
});

test('Síň slávy a Rok ve sbírce přes všechny časopisy (0.02.021)', async () => {
    const { casopisyModelky, casopisyVeSbirce, priponaRocniku } = await import('../src/lib/format.js');
    const { zuzitSinSlavy, zuzitSezonu } = await import('../src/lib/slava.js');
    const { dokonceneRocniky } = await import('../src/lib/rok-ve-sbirce.js');
    nastavitCasopisy(CASOPISY);
    const modelky = [{ id: 1, vydani: ['1985-09'] }, { id: 2, obalky: ['1987-02@PH'] }, { id: 3, vydani: ['1990-01@HU', '1991-01'] }];
    assert.deepEqual([...casopisyModelky(modelky[2])], ['HU', 'PB']);
    assert.deepEqual(casopisyVeSbirce(modelky).map(c => c.nazev), ['Playboy', 'Penthouse', 'Hustler']);
    assert.deepEqual(['US', 'CZ', 'PH/UK'].map(priponaRocniku), ['', ' CZ', ' Penthouse UK']);
    const ph = id => id === 2;
    const data = { vitrina: [{ modelkaId: 1, misto: 1 }, { modelkaId: 2, misto: 4 }], legendy: [{ modelkaId: 3 }], rekordy: [{ modelkaId: 2 }],
        odznaky: [{ modelkaId: 1 }], kronika: [{ druh: 'zacatek', modelkaId: 0 }, { druh: 'vstup', modelkaId: 2 }, { druh: 'vstup', modelkaId: 1 }] };
    const z = zuzitSinSlavy(data, ph);
    assert.deepEqual(z.vitrina, [{ modelkaId: 2, misto: 4 }]);
    assert.deepEqual([z.legendy.length, z.rekordy.length, z.odznaky.length, z.kronika.length], [0, 1, 0, 2]);
    assert.deepEqual(zuzitSezonu({ poradi: [{ modelkaId: 1 }, { modelkaId: 2 }] }, ph).poradi, [{ modelkaId: 2 }]);
    // Celý ročník Penthouse US 1985 přidaný letos
    const pets = Array.from({ length: 12 }, (_, i) => ({ jmeno: `Pet ${i + 1}`, pridano: '2026-03-01', centerfoldy: [`1985-${String(i + 1).padStart(2, '0')}@PH`] }));
    assert.deepEqual(dokonceneRocniky(pets, 2026).map(r => [r.rocnik, r.edice, r.cisel]), [[1985, 'PH/US', 12]]);
    nastavitCasopisy([]);
});

test('Údržba a texty podle časopisu (0.02.022)', async () => {
    const { titulCenterfoldu } = await import('../src/lib/udrzba.js');
    nastavitCasopisy(CASOPISY);
    assert.equal(titulCenterfoldu({ centerfoldy: ['1985-09@PH'] }), 'Pet');
    assert.equal(titulCenterfoldu({ centerfoldy: ['1985-09@PH', '1986-01'] }), 'Playmate');
    assert.equal(titulCenterfoldu({ centerfoldy: [] }), 'Playmate');
    nastavitCasopisy([]);
});

test('štítky pod jménem: časopis a rok, role z galerií, profese z Role (0.02.034)', async () => {
    const { stitkyModelky, profeseModelky, barvaCasopisu } = await import('../src/lib/format.js');
    nastavitCasopisy(CASOPISY);
    const texty = m => stitkyModelky(m).map(s => s.text);
    // Buffy Tyler: PMOTM a Model z Role se neukážou
    assert.deepEqual(texty({ role: 'PMOTM, Model', vydani: ['2000-11'], playmateMesice: true }), ['Playboy 2000', 'Playmate měsíce', 'Modelka']);
    // Ulla Lindstrom: Penthouse Pet a Centerfold z Role pryč, profese zůstanou
    assert.deepEqual(texty({ role: 'Penthouse Pet, Centerfold, Herečka, Tanečnice', vydani: ['1969-11@PH'], titulyJinde: [{ nazev: 'Pet of the Month', rok: '' }] }),
        ['Penthouse 1969', 'Pet of the Month', 'Modelka', 'Herečka', 'Tanečnice']);
    // Ali Rose: číslo bez titulu v galerii = Pictorial, online alba = Online (Cyber Girl jen z alba Cyber Girl)
    assert.deepEqual(texty({ role: 'Playboy Cybergirl, PMOTM (ZA), Modelka', vydani: ['2014-06-ZA'], onlineAlba: ['2016-09-27'] }), ['Playboy 2014', 'Pictorial', 'Online', 'Modelka']);
    assert.deepEqual(texty({ onlineAlba: ['2012-03'], cyberGirl: 'měsíce' }), ['Playboy 2012', 'Cyber Girl měsíce', 'Modelka']);
    // Víc časopisů chronologicky; modelka roku a obálka
    assert.deepEqual(texty({ vydani: ['1987-02', '1985-09@PH'], centerfoldy: ['1985-09@PH', '1987-02'], playmateRoku: '1989', obalky: ['1990-01@HU'] }),
        ['Penthouse 1985', 'Pet of the Month', 'Playboy 1987', 'Playmate měsíce', 'Playmate roku 1989', 'Hustler 1990', 'Obálka', 'Modelka']);
    assert.deepEqual(profeseModelky({ role: 'actress, Singer, porn actress, Celebrita' }), ['Modelka', 'Herečka', 'Zpěvačka', 'Pornoherečka', 'Celebrita']);
    nastavitCasopisy([]);
    assert.equal(barvaCasopisu('PH'), '');
});
