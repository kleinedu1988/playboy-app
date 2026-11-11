// Přehledná Sbírka (0.02.052): stránka ze stavu a stav pro stránku
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REZIMY_UKOLU, STRANKY_SBIRKY, nazevStrankySbirky, stavStrankySbirky, strankaSbirky } from '../src/lib/stranky-sbirky.js';

test('čtyři stránky v pořadí lišty', () => {
    assert.deepEqual(STRANKY_SBIRKY.map(s => s.nazev), ['Přehled', 'Úkoly', 'Čísla a sháním', 'Učení']);
    assert.ok(!REZIMY_UKOLU.some(([k]) => k === 'dnes'), 'Dnes je Přehled, ne režim úkolů');
});

test('stránka ze stavu: panel má přednost, Dnes je Přehled, ostatní režimy Úkoly', () => {
    assert.equal(strankaSbirky({ sbirkaPanel: 'cisla', udrzbaRezim: 'udaje' }), 'cisla');
    assert.equal(strankaSbirky({ sbirkaPanel: 'uceni', udrzbaRezim: 'dnes' }), 'uceni');
    assert.equal(strankaSbirky({ sbirkaPanel: '', udrzbaRezim: 'dnes' }), 'prehled');
    assert.equal(strankaSbirky({ sbirkaPanel: '', udrzbaRezim: 'web' }), 'ukoly');
    assert.equal(strankaSbirky({}), 'prehled');
});

test('stav pro stránku: Úkoly v naposledy použitém režimu, pod panelem Přehled', () => {
    assert.deepEqual(stavStrankySbirky('ukoly', { udrzbaRezim: 'dnes' }, 'stejne'), { sbirkaPanel: '', udrzbaRezim: 'stejne' });
    assert.deepEqual(stavStrankySbirky('ukoly', { udrzbaRezim: 'dnes' }, ''), { sbirkaPanel: '', udrzbaRezim: 'udaje' });
    assert.deepEqual(stavStrankySbirky('ukoly', { udrzbaRezim: 'web' }, 'stejne'), { sbirkaPanel: '', udrzbaRezim: 'web' });
    assert.deepEqual(stavStrankySbirky('prehled', { udrzbaRezim: 'web' }), { sbirkaPanel: '', udrzbaRezim: 'dnes' });
    assert.deepEqual(stavStrankySbirky('cisla', { udrzbaRezim: 'web' }), { sbirkaPanel: 'cisla', udrzbaRezim: 'dnes' });
    for (const s of STRANKY_SBIRKY) assert.equal(strankaSbirky(stavStrankySbirky(s.klic, { udrzbaRezim: 'dnes' })), s.klic);
    assert.equal(nazevStrankySbirky('neznama'), 'Přehled');
});
