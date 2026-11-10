// Pohledy Playboye beze změny (0.02.007): čísla jiných časopisů do nich nepatří, dokud nebudou pohledy podle
// časopisu (0.03). Kalendář, Obálky, Mapa čísel, sousední čísla a speciály filtrují podle řady „US“ / „CZ“;
// stěna Centerfoldů, kapesní katalog a dokončené ročníky jen čísla Playboye.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDICE, ciselRocniku, cisloNevyslo, jeCisloPlayboye, naSteneCenterfoldu, nastavitNazvySpecialu, rozlozitVydani, specialyRoku } from '../src/lib/format.js';
import { polozkyKatalogu } from '../src/lib/kapesni-katalog.js';
import { dokonceneRocniky } from '../src/lib/rok-ve-sbirce.js';
import { sousedniCisla } from '../src/lib/kontext-cisla.js';

const JINE = ['1985-09@PH', '1986-03-UK@PH', '1985-S01@HU', '1985@PH', '2012-03-UK@PH'];

test('řada čísla jiného časopisu není žádná edice Playboye (Kalendář, Obálky, Mapa čísel)', () => {
    for (const klic of JINE) {
        assert.ok(!EDICE.includes(rozlozitVydani(klic).edice), klic);
        assert.equal(jeCisloPlayboye(klic), false, klic);
    }
    for (const klic of ['1985-09', '2012-03-CZ', '1995-S01', '1985']) assert.equal(jeCisloPlayboye(klic), true, klic);
    // Řada Playboye beze změny: číslo z 03/1955 nevyšlo, ročník 1955 měl 11 čísel; u jiného časopisu řada zatím není
    assert.equal(cisloNevyslo('1955-03'), true);
    assert.equal(ciselRocniku(1955, 'US'), 11);
    assert.equal(cisloNevyslo('1955-03@PH'), false);
});

test('stěna Centerfoldů jen s Playboyem i ve volbě „vše“', () => {
    assert.equal(naSteneCenterfoldu('1985-09', 'vse'), true);
    assert.equal(naSteneCenterfoldu('2012-03-CZ', 'vse'), true);
    assert.equal(naSteneCenterfoldu('2012-03-CZ', 'US'), false);
    assert.equal(naSteneCenterfoldu('Staré album', 'vse'), true);
    assert.equal(naSteneCenterfoldu('Staré album', 'US'), false);
    for (const klic of JINE) for (const e of ['vse', 'US', 'CZ']) assert.equal(naSteneCenterfoldu(klic, e), false, `${klic} ${e}`);
});

test('kapesní katalog bez čísel jiných časopisů', () => {
    const podklady = [{ vydani: '1985-09', playmate: ['A'], obalka: [], dalsi: [], stav: '', driveId: 'x' },
        { vydani: '1985-09@PH', playmate: ['Pet'], obalka: [], dalsi: [], stav: 'shanim', driveId: 'y' }];
    for (const rozsah of ['vse', 'cz', 'shanim']) {
        assert.ok(!polozkyKatalogu(podklady, rozsah, '2011-08').some(p => String(p.v).includes('@')), rozsah);
    }
    assert.ok(polozkyKatalogu(podklady, 'vse', '2011-08').some(p => p.v === '1985-09'));
});

test('dokončené ročníky jen Playboye', () => {
    const rok = new Date().getFullYear();
    const mesice = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const modelky = mesice.map((m, i) => ({ jmeno: `Pet ${i}`, pridano: `${rok}-01-0${(i % 9) + 1}`, centerfoldy: [`1985-${m}@PH`] }));
    assert.deepEqual(dokonceneRocniky(modelky, rok), []);
    const playboy = mesice.map((m, i) => ({ jmeno: `PM ${i}`, pridano: `${rok}-01-0${(i % 9) + 1}`, centerfoldy: [`1985-${m}`] }));
    assert.deepEqual(dokonceneRocniky([...modelky, ...playboy], rok).map(r => [r.edice, r.rocnik]), [['US', 1985]]);
});

test('sousední čísla a speciály zůstávají v řadě čísla', () => {
    const seznam = ['1985-08', '1985-09', '1985-10', '1985-08@PH', '1985-10@PH'].map(vydani => ({ vydani }));
    assert.deepEqual(sousedniCisla(seznam, '1985-09'), { predchozi: '1985-08', dalsi: '1985-10' });
    assert.deepEqual(sousedniCisla(seznam, '1985-09@PH'), { predchozi: '1985-08@PH', dalsi: '1985-10@PH' });
    nastavitNazvySpecialu([{ vydani: '1985-S01', nazev: 'Review' }, { vydani: '1985-S01@PH', nazev: 'Forum' }]);
    assert.deepEqual(specialyRoku(1985, 'US').map(s => s.nazev), ['Review']);
    assert.deepEqual(specialyRoku(1985, 'PH/US').map(s => s.nazev), ['Forum']);
    nastavitNazvySpecialu([]);
});
