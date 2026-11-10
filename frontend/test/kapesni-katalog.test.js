import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlKatalogu, polozkyKatalogu, souhrnKatalogu } from '../src/lib/kapesni-katalog.js';

const podklady = [
    { vydani: '1995-06', driveId: 'A1', playmate: ['Anna'], obalka: [], dalsi: ['Bára'], stav: '', nazev: '', naObalce: '' },
    { vydani: '2011-08-CZ', driveId: 'C2', playmate: ['Cecílie'], obalka: ['Cecílie'], dalsi: [], stav: 'mam', nazev: '', naObalce: 'Dana <script>' },
    { vydani: '2011-10-CZ', driveId: '', playmate: [], obalka: [], dalsi: [], stav: 'shanim', nazev: '', naObalce: '' },
];

test('rozsahy katalogu: česká edice i s chybějícími čísly do dneška, sháněná jen označená', () => {
    const cz = polozkyKatalogu(podklady, 'cz', '2011-12');
    assert.deepEqual(cz.map(p => [p.v, p.s]), [['2011-07-CZ', 'chybí'], ['2011-08-CZ', 'mám'], ['2011-09-CZ', 'chybí'], ['2011-10-CZ', 'sháním'], ['2011-11-CZ', 'chybí'], ['2011-12-CZ', 'chybí']]);
    // Playmate na obálce se neopakuje, jméno z „na obálce“ přibude
    assert.deepEqual(cz[1].ob, ['Dana <script>']);
    const vse = polozkyKatalogu(podklady, 'vse', '2011-08');
    assert.deepEqual(vse.map(p => p.v), ['2011-07-CZ', '2011-08-CZ', '2011-10-CZ', '1995-06']);
    assert.equal(vse[3].s, '');
    assert.deepEqual(vse[3].da, ['Bára']);
    assert.deepEqual(polozkyKatalogu(podklady, 'shanim', '2011-12').map(p => p.v), ['2011-10-CZ']);
    assert.deepEqual(souhrnKatalogu(cz), { cisel: 6, mam: 1, shanim: 1, chybi: 4 });
});

test('stránka katalogu je samostatná a data v ní nic neuzavřou', () => {
    const html = htmlKatalogu(polozkyKatalogu(podklady, 'vse', '2011-08'), { vytvoreno: '10. 11. 2026', rozsah: 'vse' });
    assert.match(html, /^<!doctype html>/);
    assert.doesNotMatch(html, /(src|href)="https?:/);
    assert.ok(!html.includes('Dana <script>'));
    const json = /<script type="application\/json" id="data">(.*?)<\/script>/s.exec(html)[1];
    assert.equal(JSON.parse(json)[1].ob[0], 'Dana <script>');
    assert.match(html, /Celá sbírka · 4 čísla/);
    // Skript stránky je platný JavaScript
    const skript = /<script>\n([\s\S]*?)<\/script>/.exec(html)[1];
    assert.doesNotThrow(() => new Function(skript));
});
