import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cilOdkazu, navrhyOdkazu, odkazNaVydani, vydaniZOdkazu } from '../src/lib/odkazy.js';
import { formatMarkdown } from '../src/lib/format.js';

const modelky = [{ id: 1, jmeno: 'Anna Testová', dalsiJmena: 'Anička, Ann T.' }, { id: 2, jmeno: 'Bára Další', dalsiJmena: '' }];

test('Číslo z odkazu ve všech zápisech, zpět jako MM/RRRR', () => {
    for (const [text, v] of [['06/1995', '1995-06'], ['6/1995', '1995-06'], ['06/1995 DE', '1995-06-DE'], ['1995-06', '1995-06'],
        ['1995-06-cz', '1995-06-CZ'], ['1995-S01', '1995-S01'], ['13/1995', ''], ['1995', ''], ['Anna', '']]) assert.equal(vydaniZOdkazu(text), v, text);
    assert.equal(odkazNaVydani('1995-06'), '06/1995');
    assert.equal(odkazNaVydani('1995-06-DE'), '06/1995 DE');
    assert.equal(odkazNaVydani('1995-S01'), '1995-S01');
});

test('Cíl odkazu: číslo, modelka i přes další jméno bez diakritiky, fotograf, jinak hledání', () => {
    assert.deepEqual(cilOdkazu('06/1995', modelky), { druh: 'vydani', vydani: '1995-06' });
    assert.deepEqual(cilOdkazu('anna testova', modelky), { druh: 'modelka', id: 1 });
    assert.deepEqual(cilOdkazu('Anicka', modelky), { druh: 'modelka', id: 1 });
    assert.deepEqual(cilOdkazu('Pompeo Posar', modelky, ['Pompeo Posar']), { druh: 'fotograf', jmeno: 'Pompeo Posar' });
    assert.deepEqual(cilOdkazu('Někdo', modelky), { druh: 'hledat', text: 'Někdo' });
});

test('Našeptávač: modelky podle začátku jména i příjmení, čísla podle roku, fotografové', () => {
    const data = { modelky, vydani: ['1995-07', '1995-06', '1994-06'], fotografove: ['Arny Freytag'] };
    assert.deepEqual(navrhyOdkazu('dal', data).map(n => n.text), ['Bára Další']);
    assert.deepEqual(navrhyOdkazu('anic', data).map(n => n.text), ['Anna Testová']);
    assert.deepEqual(navrhyOdkazu('1995', data).map(n => n.text), ['06/1995', '07/1995']);
    assert.deepEqual(navrhyOdkazu('06/', data).map(n => n.text), ['06/1994', '06/1995']);
    assert.deepEqual(navrhyOdkazu('arn', data).map(n => n.druh), ['fotograf']);
    assert.equal(navrhyOdkazu('', data).length, 2);
});

test('Odkaz v textu je klikací a chráněný před dalším formátováním', () => {
    const html = formatMarkdown('Byla v **[[06/1995]]**, viz [[snake_case_x|_x_]].');
    assert.match(html, /<strong><button type="button" class="wiki-odkaz" data-wiki="06\/1995">06\/1995<\/button><\/strong>/);
    assert.match(html, /data-wiki="snake_case_x">_x_<\/button>/);
});
