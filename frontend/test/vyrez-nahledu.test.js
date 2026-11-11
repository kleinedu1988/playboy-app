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
