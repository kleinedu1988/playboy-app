import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pokrokDne, pridatDen, serieDni, vybratSkupiny } from '../src/lib/udrzba-dnes.js';

test('pokrokDne: nový den začíná nulou, úbytek je pokrok, přibyté úkoly ho nesnižují', () => {
    let p = pokrokDne(null, '2026-11-10', 100);
    assert.deepEqual(p, { den: '2026-11-10', zacatek: 100, vyrizeno: 0 });
    p = pokrokDne(p, '2026-11-10', 93);
    assert.equal(p.vyrizeno, 7);
    p = pokrokDne(p, '2026-11-10', 98); // přidaná modelka s 5 úkoly
    assert.equal(p.vyrizeno, 7);
    p = pokrokDne(p, '2026-11-10', 95);
    assert.equal(p.vyrizeno, 10);
    assert.equal(pokrokDne(p, '2026-11-11', 95).vyrizeno, 0);
});

test('serieDni: dny v řadě do dneška nebo včerejška', () => {
    assert.equal(serieDni(['2026-11-08', '2026-11-09', '2026-11-10'], '2026-11-10'), 3);
    assert.equal(serieDni(['2026-11-08', '2026-11-09'], '2026-11-10'), 2);
    assert.equal(serieDni(['2026-11-07', '2026-11-09'], '2026-11-11'), 0);
    assert.equal(serieDni(['2026-10-31', '2026-11-01'], '2026-11-01'), 2);
    assert.deepEqual(pridatDen(['2026-11-09'], '2026-11-10'), ['2026-11-09', '2026-11-10']);
});

test('vybratSkupiny: od nejvyšší priority do cíle, rychlé dávky nejvýš polovinu', () => {
    const skupiny = [{ klic: 'a', priorita: 1, aktivnich: 10 }, { klic: 'b', priorita: 5, aktivnich: 12 }, { klic: 'c', priorita: 3, aktivnich: 10 }, { klic: 'd', priorita: 9, aktivnich: 0 }];
    assert.deepEqual(vybratSkupiny(skupiny, 0, 30).map(s => s.klic), ['b', 'c', 'a']);
    assert.deepEqual(vybratSkupiny(skupiny, 100, 30).map(s => s.klic), ['b', 'c']);
});
