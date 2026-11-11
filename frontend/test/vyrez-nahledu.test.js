// Chytrý výřez náhledů (0.02.050): object-position ořezaného náhledu podle rámečků postavy a obličeje
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssPolohy, polohaNahledu } from '../src/lib/vyrez-nahledu.js';

test('bez rámečku a neplatné poměry: střed', () => {
    assert.deepEqual(polohaNahledu(null, 0.75, 0.75), { x: 50, y: 50 });
    assert.deepEqual(polohaNahledu({ postava: [0, 0, 1, 1] }, 0, 0.75), { x: 50, y: 50 });
    assert.equal(cssPolohy({ x: 50, y: 50 }), '');
    assert.equal(cssPolohy({ x: 20, y: 0 }), '20% 0%');
});

test('fotka na výšku ve čtvercové dlaždici: hlava nahoře se neusekne', () => {
    // Postava od 10 % do 95 % výšky, obličej 10–20 %; ve čtverci je vidět 75 % výšky
    const v = polohaNahledu({ postava: [0.3, 0.1, 0.7, 0.95], oblicej: [0.45, 0.1, 0.55, 0.2] }, 0.75, 1);
    assert.equal(v.x, 50, 'vodorovně se nic neořezává');
    assert.ok(v.y < 10, `obličej nahoře, y = ${v.y}`);
    // Okno [y·(1−f), +f] obsahuje celý obličej
    const zacatek = (v.y / 100) * 0.25;
    assert.ok(zacatek <= 0.1 && zacatek + 0.75 >= 0.2);
});

test('fotka na šířku v dlaždici 3:4: obličej vlevo zůstane v okně', () => {
    // Ležící postava přes celou šířku, obličej vlevo (10–20 %); dlaždice 3:4 ukáže 56 % šířky
    const pomer = 4 / 3, ram = 3 / 4, f = ram / pomer;
    const v = polohaNahledu({ postava: [0.05, 0.3, 0.95, 0.7], oblicej: [0.1, 0.35, 0.2, 0.5] }, pomer, ram);
    const zacatek = (v.x / 100) * (1 - f);
    assert.ok(zacatek <= 0.1 && zacatek + f >= 0.2, `obličej v okně, x = ${v.x}`);
    assert.equal(v.y, 50, 'svisle se nic neořezává');
});

test('postava se vejde: na střed okna; posun se omezí na okraj obrázku', () => {
    const v = polohaNahledu({ postava: [0.75, 0.2, 0.95, 0.8] }, 4 / 3, 1);
    // Okno 75 % šířky, postava 75–95 % → okno až k pravému okraji
    assert.equal(v.x, 100);
    const vlevo = polohaNahledu({ postava: [0.0, 0.2, 0.1, 0.8] }, 4 / 3, 1);
    assert.equal(vlevo.x, 0);
});

test('hero (0.02.051): fotka na šířku – postava vpravo od textu, svislá fotka – obličej níž než v dlaždici', () => {
    // Fotka 3:2 v banneru 4:1: vodorovně se nic neořízne, svisle je vidět 37,5 % výšky
    const v = { postava: [0.3, 0.1, 0.6, 0.95], oblicej: [0.4, 0.1, 0.5, 0.25] };
    const dl = polohaNahledu(v, 1.5, 4, 'dlazdice'), hero = polohaNahledu(v, 1.5, 4, 'hero');
    assert.ok(hero.y <= dl.y, `v heru víc místa nad obličejem: ${hero.y} vs ${dl.y}`);
    const f = 1.5 / 4, zacatek = (hero.y / 100) * (1 - f);
    assert.ok(zacatek <= 0.1 && zacatek + f >= 0.25, 'obličej celý v okně');
    // Panorama 3:1 v banneru 2:1 → hero posune okno doleva (postava vpravo od textu)
    const s = { postava: [0.1, 0.2, 0.9, 0.9], oblicej: [0.45, 0.2, 0.55, 0.35] };
    const d1 = polohaNahledu(s, 3, 2, 'dlazdice'), h1 = polohaNahledu(s, 3, 2, 'hero');
    assert.ok(h1.x < d1.x, `obličej v heru vpravo od středu: ${h1.x} vs ${d1.x}`);
    // Úzký rám hera vedle textu (Kalendář, Centerfoldy: 3:4) se chová jako dlaždice
    assert.deepEqual(polohaNahledu(v, 2 / 3, 3 / 4, 'hero'), polohaNahledu(v, 2 / 3, 3 / 4, 'dlazdice'));
});

test('ID souboru z adresy obrázku', async () => {
    const { idZAdresy } = await import('../src/lib/vyrez-nahledu.js');
    assert.equal(idZAdresy('/nahled/1AbC_def-GHIjkl/{velikost}'), '1AbC_def-GHIjkl');
    assert.equal(idZAdresy('https://lh3.googleusercontent.com/d/1AbC_def-GHIjkl={velikost}'), '1AbC_def-GHIjkl');
    assert.equal(idZAdresy(''), '');
});
