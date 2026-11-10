import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRIBLIZENI, platnyVzhled, vychozi } from '../src/ui/vzhled.js';

test('platnyVzhled: bez uložených voleb výchozí', () => {
    assert.deepEqual(platnyVzhled(null), vychozi());
    assert.deepEqual(platnyVzhled('nesmysl'), vychozi());
});

test('platnyVzhled: přiblížení jen v rozsahu a zaokrouhlené na desetiny', () => {
    assert.equal(platnyVzhled({ priblizeni: 1.3 }).priblizeni, 1.3);
    assert.equal(platnyVzhled({ priblizeni: 1.2999999 }).priblizeni, 1.3);
    assert.equal(platnyVzhled({ priblizeni: PRIBLIZENI.max + 0.5 }).priblizeni, 1);
    assert.equal(platnyVzhled({ priblizeni: 0.5 }).priblizeni, 1);
    assert.equal(platnyVzhled({ priblizeni: 'x' }).priblizeni, 1);
});

test('platnyVzhled: neplatné hodnoty se vrátí na výchozí, platné zůstanou', () => {
    const v = platnyVzhled({ hustota: 'kompaktni', karty: { modelky: 'l', fotky: 'xl', steny: 's' }, karta: { srdicka: false, rok: 'ano', fotek: true } });
    assert.equal(v.hustota, 'kompaktni');
    assert.deepEqual(v.karty, { modelky: 'l', fotky: 'm', steny: 's' });
    assert.deepEqual(v.karta, { srdicka: false, rok: false, fotek: true });
    assert.equal(platnyVzhled({ hustota: 'jina' }).hustota, 'pohodlna');
});

test('platnyVzhled 1.50: pohyb, prohlížeč, start a záhlaví jen z povolených hodnot', () => {
    const v = platnyVzhled({ pohyb: 'zadny', prohlizec: { pozadi: 'rozmazane', ovladani: 'nikdy', pas: true }, start: 'posledni', zahlavi: 'nizke' });
    assert.equal(v.pohyb, 'zadny');
    assert.deepEqual(v.prohlizec, { pozadi: 'rozmazane', ovladani: 'pohyb', pas: true });
    assert.equal(v.start, 'posledni');
    assert.equal(v.zahlavi, 'vysoke');
});

test('platnyVzhled 1.50: pořadí karet Přehledu bez cizích a dvojitých, chybějící na konec', () => {
    const v = platnyVzhled({ prehled: { poradi: ['naposledy', 'xx', 'cz', 'naposledy'], skryte: ['us', 'xx'] } });
    assert.deepEqual(v.prehled.poradi, ['naposledy', 'cz', 'us', 'vybery', 'objevit']);
    assert.deepEqual(v.prehled.skryte, ['us']);
});

test('karty Mapy čísel jiných časopisů (0.02.017): uložené pořadí, nové řady za americkou edicí', async () => {
    const { platnyVzhled, poradiKaret } = await import('../src/ui/vzhled.js');
    const v = platnyVzhled({ prehled: { poradi: ['rada:PH/US', 'cz', 'rada:xx', 'us'], skryte: ['rada:HU/US', 'rada:x'] } });
    assert.deepEqual(v.prehled.poradi, ['rada:PH/US', 'cz', 'us', 'vybery', 'objevit', 'naposledy']);
    assert.deepEqual(v.prehled.skryte, ['rada:HU/US']);
    assert.deepEqual(poradiKaret(v.prehled.poradi, ['rada:PH/US', 'rada:PH/UK', 'rada:HU/US']),
        ['rada:PH/US', 'cz', 'us', 'rada:PH/UK', 'rada:HU/US', 'vybery', 'objevit', 'naposledy']);
    assert.deepEqual(poradiKaret(['cz', 'us', 'vybery'], []), ['cz', 'us', 'vybery']);
});
