import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platnyInterval, rozdelitText, stranyCisla, stranyProfilu } from '../src/lib/casopis.js';
import { sestavitAlba } from '../src/lib/alba.js';

let id = 0;
const fotka = (modelkaId, jmenoModelky, album, typ, vydani, extra = {}) => ({ id: ++id, modelkaId, jmenoModelky, album, typ, vydani, url: `u${id}/{velikost}`, rotace: 0, ...extra });
const fotky = [
    fotka(0, '', '1995-06', 'Cover', '1995-06'),
    fotka(1, 'Anna', '1995-06', 'Centerfold', '1995-06', { popis: 'Anna z Texasu.', fotograf: 'Arny Freytag' }),
    fotka(1, 'Anna', '1995-06', 'Centerfold', '1995-06'),
    fotka(1, 'Anna', '1995-06', 'Centerfold', '1995-06'),
    fotka(2, 'Bára', 'Léto', 'Pictorial', '1995-06'),
    fotka(2, 'Bára', 'Léto', 'Pictorial', '1995-06'),
];

test('Kritérium hotovo: číslo od obálky po poslední fotku, každá fotka právě jednou', () => {
    const alba = sestavitAlba(fotky);
    const clanky = [{ id: 1, nazev: 'Rozhovor', rubrika: 'Interview', autor: 'X', strana: 60, text: 'A\n\nB', skenyUrl: ['s1'] },
        { id: 2, nazev: 'Úvodník', strana: 3, text: '' }];
    const modelky = [{ id: 1, jmeno: 'Anna', narozeniDatum: '1970-05-04', vyskaCm: 173, obvodHrudnikCm: 86, obvodPasCm: 61, obvodBokyCm: 89 }];
    const s = stranyCisla({ vydani: '1995-06', alba, clanky, modelky, info: { naObalce: 'Anna' } });
    assert.deepEqual(s.map(x => x.druh), ['obalka', 'uvod', 'uvod', 'clanek', 'clanek', 'foto', 'foto', 'foto', 'foto']);
    assert.deepEqual(s.map(x => x.oddil), ['Obálka', 'Playmate měsíce', 'Další modelky', 'Články', 'Články', 'Články', 'Fotky', 'Fotky', 'Fotky']);
    assert.equal(s[1].nadpis, 'Anna');
    assert.deepEqual(s[1].udaje.find(([k]) => k === 'Míry'), ['Míry', '86-61-89']);
    assert.equal(s[1].popisek, 'Foto Arny Freytag');
    assert.equal(s[3].nadpis, 'Úvodník');
    // Všechny fotky čísla (bez skenu článku) právě jednou
    const urls = s.filter(x => x.oddil !== 'Články').flatMap(x => x.fotky.map(f => f.url)).sort();
    assert.deepEqual(urls, fotky.map(f => f.url).sort());
});

test('Profil: úvod s výřezem titulní, články, alba s úvodem a fotkami', () => {
    const alba = sestavitAlba(fotky.filter(f => f.modelkaId === 1));
    const s = stranyProfilu({ modelka: { id: 1, jmeno: 'Anna', poznamka: 'Text', coverX: 40, coverY: 20 }, titulni: 't', alba, clanky: [{ nazev: 'Rozhovor', text: 'x' }] });
    assert.deepEqual(s.map(x => x.druh), ['uvod', 'clanek', 'uvod', 'foto', 'foto']);
    assert.deepEqual(s[0].vyrez, { x: 40, y: 20 });
    assert.equal(s[0].fotky[0].url, 't');
});

test('Dlouhý text se dělí po odstavcích, interval jen 3 / 5 / 10 s', () => {
    const odstavec = 'x'.repeat(700);
    assert.equal(rozdelitText([odstavec, odstavec, odstavec].join('\n\n')).length, 2);
    assert.deepEqual(rozdelitText(''), []);
    assert.deepEqual([3, 5, 10, 7, '5', null].map(platnyInterval), [3, 5, 10, 0, 5, 0]);
});
