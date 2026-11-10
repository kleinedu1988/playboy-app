import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cislaRoku, denCesky, dokonceneRocniky, nejaktivnejsiMesic, noveModelky, protiLoni, stranyRoku } from '../src/lib/rok-ve-sbirce.js';

const mesice = (cisla) => Array.from({ length: 12 }, (_, i) => ({ fotek: cisla[i] || 0, alb: 0, modelek: 0, dnu: cisla[i] ? 1 : 0 }));

test('nové modelky roku: jen přidané v roce, nejlépe hodnocené a s víc fotkami první', () => {
    const m = [
        { id: 1, jmeno: 'A', pridano: '2025-02-01 10:00:00', hodnoceni: 3, pocetFotek: 10 },
        { id: 2, jmeno: 'B', pridano: '2025-05-01 10:00:00', hodnoceni: 5, pocetFotek: 2 },
        { id: 3, jmeno: 'C', pridano: '2025-06-01 10:00:00', hodnoceni: 3, pocetFotek: 30 },
        { id: 4, jmeno: 'D', pridano: '2024-12-31 23:00:00', hodnoceni: 5 },
        { id: 5, jmeno: 'E', pridano: '' },
    ];
    assert.deepEqual(noveModelky(m, 2025).map(x => x.jmeno), ['B', 'C', 'A']);
});

test('dokončený ročník: všechny vyšlé měsíce s centerfoldem a poslední přibyl v roce', () => {
    const cf = (jmeno, vydani, pridano) => ({ jmeno, centerfoldy: [vydani], pridano });
    // US 1980 celý, poslední (prosinec) přidán 2025; US 1981 bez prosince; 1955 nevyšel březen (11 čísel)
    const m = [];
    for (let i = 1; i <= 12; i++) m.push(cf(`U${i}`, `1980-${String(i).padStart(2, '0')}`, i === 12 ? '2025-07-01 10:00:00' : '2023-01-01 10:00:00'));
    for (let i = 1; i <= 11; i++) m.push(cf(`V${i}`, `1981-${String(i).padStart(2, '0')}`, '2025-01-01 10:00:00'));
    for (let i = 1; i <= 12; i++) if (i !== 3) m.push(cf(`W${i}`, `1955-${String(i).padStart(2, '0')}`, '2025-03-01 10:00:00'));
    // Druhá Playmate stejného měsíce přidaná později ročník nedokončí znovu
    m.push(cf('Dvojče', '1980-12', '2026-01-01 10:00:00'));
    const r = dokonceneRocniky(m, 2025);
    assert.deepEqual(r.map(x => [x.edice, x.rocnik, x.cisel, x.posledni]), [['US', 1955, 11, 'W1'], ['US', 1980, 12, 'U12']]);
    assert.deepEqual(dokonceneRocniky(m, 2026), []);
});

test('nejaktivnější měsíc, srovnání s loňskem a den česky', () => {
    assert.equal(nejaktivnejsiMesic(mesice([0, 5, 9, 9])), 2);
    assert.equal(nejaktivnejsiMesic(mesice([])), -1);
    assert.equal(protiLoni(120, 100), 'o 20 % víc než loni');
    assert.equal(protiLoni(50, 100), 'o 50 % méně než loni');
    assert.equal(protiLoni(10, 10), 'stejně jako loni');
    assert.equal(protiLoni(10, 0), '');
    assert.equal(denCesky('2025-03-07'), '7. března');
});

test('strany roku: obálka s nejlepší fotkou, čísla, nové modelky s fotkou, nejlepší fotky, dokončeno', () => {
    const data = {
        rok: 2025, fotek: 40, alb: 4, cisel: 3, dnuPrace: 12, souboju: 0, fotek5: 2, fotekLoni: 20, zapisu: 0,
        mesice: mesice([0, 0, 30, 10]), serie: { dni: 3, od: '2025-03-01', do: '2025-03-03' },
        nejlepsi: [{ url: 'f1/{velikost}', rotace: 0, hodnoceni: 5, jmeno: 'B', vydani: '1980-12' }, { url: 'f2/{velikost}', rotace: 90, hodnoceni: 4, jmeno: 'A', album: 'Pláž' }],
        sezony: [{ nazev: 'Březen 2025', favoritka: 2, milacek: 0 }], novaCisla: [],
    };
    const nove = [{ id: 2, jmeno: 'B', coverUrl: 'c2/{velikost}', pocetFotek: 3 }, { id: 1, jmeno: 'A' }];
    const s = stranyRoku({ data, nove, rocniky: [{ edice: 'US', rocnik: 1980, cisel: 12, posledni: 'B' }], jmenaSezon: new Map([[2, 'B']]) });
    assert.deepEqual(s.map(x => x.druh), ['obalka', 'uvod', 'uvod', 'foto', 'clanek']);
    assert.equal(s[0].nadpis, 'Rok 2025 ve sbírce');
    assert.equal(s[0].fotky[0].url, 'f1/{velikost}');
    assert.deepEqual(s[1].udaje.map(([k]) => k), ['Modelek', 'Alb', 'Fotek', 'Čísel', 'Dní práce']);
    assert.match(s[1].text, /o 100 % víc než loni/);
    assert.match(s[1].text, /březen/);
    assert.match(s[1].text, /3 dny v řadě/);
    assert.equal(s[2].nadpis, 'B');
    assert.deepEqual(s[3].fotky, [{ url: 'f2/{velikost}', rotace: 90 }]);
    assert.match(s[4].text, /Ročník \*\*1980\*\*/);
    assert.match(s[4].text, /Favoritka \*\*B\*\*/);
    assert.deepEqual(cislaRoku({ ...data, alb: 0 }, []).map(([k]) => k), ['Fotek', 'Čísel', 'Dní práce']);
});
