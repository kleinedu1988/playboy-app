// Stejná data ve všech pohledech (0.02.046): tytéž modelky jako v Go testu TestStejnaDataVePohledech (vzorová sbírka
// s Playboyem, Penthouse a Hustlerem), jak je posílá snímek sbírky. Profil (štítky), karta (první číslo), Síň slávy
// (časopisy modelky) a kategorie musí ukázat stejné časopisy a tituly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { casopisyModelky, kategorieModelky, nastavitCasopisy, prvniCisloModelky, stitkyModelky } from '../src/lib/format.js';
import { maTitulModelky, titulCenterfoldu } from '../src/lib/udrzba.js';

const CASOPISY = [
    { klic: 'PB', nazev: 'Playboy', edice: ['US'], modelkaMesice: 'Playmate měsíce', modelkaRoku: 'Playmate roku' },
    { klic: 'PH', nazev: 'Penthouse', edice: ['US'], modelkaMesice: 'Pet of the Month', modelkaRoku: 'Pet of the Year' },
    { klic: 'HU', nazev: 'Hustler', edice: ['US'], modelkaMesice: 'Honey of the Month', modelkaRoku: 'Honey of the Year' },
];
const SBIRKA = {
    pb: { jmeno: 'Pb Centerfold', vydani: ['1975-01'], centerfoldy: ['1975-01'] },
    ph: { jmeno: 'Ph Pet', vydani: ['1985-09@PH'], centerfoldy: ['1985-09@PH'] },
    hu: { jmeno: 'Hu Honey', vydani: ['1990-05@HU'], titulyJinde: [{ nazev: 'Honey of the Month' }] },
    online: { jmeno: 'Jen Online', onlineAlba: ['2015-06-01'] },
    text: { jmeno: 'Text Penthouse', pictorialVydani: '1992-03@PH' },
};
// Stejné časopisy jako hledání casopis: v Go testu
const CHCI = { pb: ['PB'], ph: ['PH'], hu: ['HU'], online: ['PB'], text: ['PH'] };

test('časopisy modelky stejně v profilu, kartě a Síni slávy (0.02.046)', () => {
    nastavitCasopisy(CASOPISY);
    for (const [klic, m] of Object.entries(SBIRKA)) {
        assert.deepEqual([...casopisyModelky(m)], CHCI[klic], `Síň slávy ${m.jmeno}`);
        const stitky = stitkyModelky(m).filter(s => s.druh === 'casopis').map(s => s.text.split(' ')[0]);
        assert.deepEqual(stitky, CHCI[klic].map(c => CASOPISY.find(x => x.klic === c).nazev), `profil ${m.jmeno}`);
        assert.equal(prvniCisloModelky(m).casopis, CHCI[klic][0], `karta ${m.jmeno}`);
    }
    nastavitCasopisy([]);
});

test('tituly stejně v kategoriích, profilu a Údržbě (0.02.046)', () => {
    nastavitCasopisy(CASOPISY);
    const kat = m => kategorieModelky(m).map(k => k.nazev);
    const role = m => stitkyModelky(m).filter(s => s.druh === 'role').map(s => s.text);
    assert.ok(kat(SBIRKA.pb).includes('Playmate měsíce') && role(SBIRKA.pb).includes('Playmate měsíce'));
    assert.ok(kat(SBIRKA.ph).includes('Pet of the Month') && role(SBIRKA.ph).includes('Pet of the Month'));
    assert.ok(!kat(SBIRKA.ph).includes('Playmate měsíce'));
    assert.ok(kat(SBIRKA.hu).includes('Honey of the Month') && role(SBIRKA.hu).includes('Honey of the Month'));
    assert.equal(titulCenterfoldu(SBIRKA.ph), 'Pet');
    assert.equal(titulCenterfoldu(SBIRKA.hu), 'Honey');
    assert.deepEqual(Object.values(SBIRKA).map(maTitulModelky), [true, true, true, false, false]);
    nastavitCasopisy([]);
});
