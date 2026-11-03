import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rozbalitFrontu } from '../src/lib/fronta.js';

test('rozbalitFrontu vrátí fotky s údaji alba a adresou ze šablony', () => {
    const fotky = rozbalitFrontu({
        sablona: 'https://x/{id}=w{id}',
        fotky: [{ id: 1, albumId: 7, driveId: 'abc', rotace: 90 }, { id: 2, albumId: 7, driveId: 'def', hodnoceni: 3 }],
        alba: { 7: { modelkaId: 5, jmenoModelky: 'Bára', album: 'Léto', typ: 'Pictorial', vydani: '1990-05', spojit: true, popis: 'p', dalsiModelky: [{ id: 6, jmeno: 'Eva' }] } },
    });
    assert.equal(fotky.length, 2);
    assert.deepEqual(fotky[0], { id: 1, modelkaId: 5, jmenoModelky: 'Bára', album: 'Léto', typ: 'Pictorial', vydani: '1990-05', spojit: true, popis: 'p', fotograf: '', datumAlba: '', dalsiModelky: [{ id: 6, jmeno: 'Eva' }], albumId: 7, driveId: 'abc', url: 'https://x/abc=wabc', rotace: 90, hodnoceni: 0, poradi: 0, pridano: '' });
    assert.equal(fotky[1].hodnoceni, 3);
    assert.equal(fotky[1].rotace, 0);
    assert.deepEqual(rozbalitFrontu(null), []);
});
