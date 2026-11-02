import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cislice, cisloKlavesy, jakoMinula, novyStav, potvrdit, tlumene, viditelneKroky, zadna, zodpovezeneSkupiny, zpet } from '../src/lib/pruvodce.js';

const m = (klic, skupina, vylucna = false) => ({ klic, nazev: klic, skupina, vylucna });
const krok = (klic, typ, povinny, moznosti, x = {}) => ({ klic, nazev: klic, typ, povinny, nula: povinny ? '' : 'žádná', moznosti, preskocit: null, tlumit: [], predvyplnit: [], skupiny: [...new Set(moznosti.map(o => o.skupina))], ...x });
const KROKY = [
    krok('zaber', 'jeden', true, ['portret', 'poprsi', 'postava'].map(t => m(t, 'zaber', true))),
    krok('prostredi', 'jeden', false, ['studio', 'plaz'].map(t => m(t, 'prostredi', true)), { predvyplnit: ['studio', 'plaz'] }),
    krok('telo', 'vice', false, [m('prsa', 'partie'), m('vagina', 'partie'), m('podpatky', 'obleceni')], {
        preskocit: { tagy: ['portret'], ne: false }, tlumit: [{ moznosti: ['vagina'], kdyz: { tagy: ['postava'], ne: true } }], predvyplnit: ['podpatky'] }),
    krok('styl', 'vice', false, [m('cernobila', 'barevnost', true), m('tonovana', 'barevnost', true), m('low_key', 'svetlo', true)]),
    { klic: 'srdicka', nazev: 'Srdíčka', typ: 'srdicka', povinny: true, nula: '', moznosti: [], preskocit: null, tlumit: [], predvyplnit: [], skupiny: [] },
];

test('výlučný krok: číslice vybere a pokračuje, povinný bez výběru nepustí', () => {
    const s = novyStav(KROKY);
    assert.equal(potvrdit(KROKY, s), 'chybi');
    assert.equal(zadna(KROKY, s), '');
    assert.equal(cislice(KROKY, s, 3), 'dal');
    assert.equal(s.krok, 1);
    assert.ok(s.vybrane.has('postava'));
});

test('předvyplnění podle alba jen u kroků bez tagu; Enter ho převezme', () => {
    const s = novyStav(KROKY, ['postava'], ['plaz', 'podpatky', 'prsa']);
    assert.deepEqual([...s.navrh].sort(), ['plaz', 'podpatky']);
    cislice(KROKY, s, 3); // záběr postava
    assert.equal(potvrdit(KROKY, s), 'dal'); // prostředí z alba
    assert.ok(s.vybrane.has('plaz') && !s.navrh.has('plaz'));
    const jen = novyStav(KROKY, ['studio'], ['plaz']);
    assert.ok(jen.vybrane.has('studio') && !jen.vybrane.has('plaz'));
});

test('přeskočený krok, ztlumená možnost, vícenásobný výběr a výlučnost uvnitř kroku', () => {
    const s = novyStav(KROKY);
    cislice(KROKY, s, 1); // portrét → Tělo se přeskočí
    zadna(KROKY, s); // prostředí žádné
    assert.equal(KROKY[s.krok].klic, 'styl');
    assert.deepEqual(viditelneKroky(KROKY, s.vybrane), [0, 1, 3, 4]);
    const t = novyStav(KROKY);
    cislice(KROKY, t, 2); // poprsí
    potvrdit(KROKY, t);
    assert.ok(tlumene(KROKY[2], t.vybrane).has('vagina'));
    assert.equal(cislice(KROKY, t, 2), '');
    assert.equal(cislice(KROKY, t, 1), 'zmena');
    assert.equal(cislice(KROKY, t, 3), 'zmena');
    assert.equal(cislice(KROKY, t, 1), 'zmena'); // znovu = odebrat
    assert.equal(potvrdit(KROKY, t), 'dal');
    assert.ok(!t.vybrane.has('prsa') && t.vybrane.has('podpatky'));
    cislice(KROKY, t, 1);
    cislice(KROKY, t, 2); // tónovaná nahradí černobílou
    cislice(KROKY, t, 3);
    assert.ok(!t.vybrane.has('cernobila') && t.vybrane.has('tonovana') && t.vybrane.has('low_key'));
    potvrdit(KROKY, t);
    assert.equal(cislice(KROKY, t, 6), '');
    assert.equal(cislice(KROKY, t, 4), 'hotovo');
    assert.equal(t.hodnoceni, 4);
    assert.deepEqual(zodpovezeneSkupiny(KROKY, t).sort(), ['barevnost', 'obleceni', 'partie', 'prostredi', 'svetlo', 'zaber']);
});

test('zpět přes přeskočený krok a jako minulá', () => {
    const s = novyStav(KROKY);
    cislice(KROKY, s, 1);
    zadna(KROKY, s);
    assert.ok(zpet(KROKY, s));
    assert.equal(s.krok, 1);
    assert.ok(zpet(KROKY, s));
    assert.equal(zpet(KROKY, s), false);
    const t = novyStav(KROKY);
    jakoMinula(KROKY, t, ['portret', 'studio', 'cernobila', 'prsa']);
    assert.equal(KROKY[t.krok].klic, 'srdicka');
    assert.ok(t.vybrane.has('portret') && t.vybrane.has('cernobila'));
    assert.ok(!t.potvrzene.has('telo')); // u portrétu přeskočený
});

test('číslice podle fyzické klávesy', () => {
    assert.equal(cisloKlavesy({ code: 'Digit3', key: 'š' }), 3);
    assert.equal(cisloKlavesy({ code: 'Numpad7', key: '7' }), 7);
    assert.equal(cisloKlavesy({ code: 'Numpad0', key: '0' }), 0);
    assert.equal(cisloKlavesy({ code: 'KeyA', key: 'a' }), null);
});
