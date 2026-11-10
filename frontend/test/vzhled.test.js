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
