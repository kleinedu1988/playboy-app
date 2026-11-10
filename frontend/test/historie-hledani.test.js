import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nazevZDotazu, odebratDotaz, pridatDotaz, podobneDotazy } from '../src/lib/historie-hledani.js';

test('historie hledání: nejnovější první, bez opakování, nejvýš 20', () => {
    let h = [];
    for (let i = 0; i < 25; i++) h = pridatDotaz(h, `dotaz ${i}`);
    assert.equal(h.length, 20);
    assert.equal(h[0], 'dotaz 24');
    h = pridatDotaz(h, '  Dotaz   10 ');
    assert.equal(h[0], 'Dotaz 10');
    assert.equal(h.filter(x => x.toLowerCase() === 'dotaz 10').length, 1);
    assert.deepEqual(pridatDotaz(['a b'], 'x'), ['a b']);
    assert.deepEqual(odebratDotaz(['blond', 'Zrzka'], 'zrzka'), ['blond']);
});

test('historie hledání: podobné dotazy a název výběru', () => {
    const h = ['blond výška > 175', 'zrzka', 'Blond'];
    assert.deepEqual(podobneDotazy(h, 'blond'), ['blond výška > 175']);
    assert.deepEqual(podobneDotazy(h, ''), h);
    assert.equal(nazevZDotazu('blond', ['Blond']), 'blond (2)');
    assert.equal(nazevZDotazu('blond', []), 'blond');
});
