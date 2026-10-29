import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// otevreneOkno() (ui/dom.js) hledá otevřená okna jen mezi přímými potomky #app: všechna okna (.modal-overlay)
// proto musí být v kostře okna na nejvyšší úrovni, ne vnořená do jiného prvku
test('okna jsou přímo v kostře okna', () => {
    const zdroj = readFileSync(new URL('../src/sablona.js', import.meta.url), 'utf8');
    const sablona = zdroj.slice(zdroj.indexOf('SABLONA_OKNA = `') + 16).replace(/<!--[\s\S]*?-->/g, '');
    const prazdne = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon']);
    let hloubka = 0;
    const okna = [];
    for (const [, konec, znacka, atributy, sama] of sablona.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
        if (konec) { hloubka--; continue; }
        if (/class="modal-overlay[ "]/.test(atributy)) okna.push([/id="([^"]+)"/.exec(atributy)?.[1], hloubka]);
        if (!sama && !prazdne.has(znacka.toLowerCase())) hloubka++;
    }
    assert.ok(okna.length >= 10, `nalezeno oken: ${okna.length}`);
    assert.deepEqual(okna.filter(([, h]) => h !== 0), [], 'vnořená okna');
});

// .logo v řádku okna má omezenou max-width, aby nezasahovalo pod hledání uprostřed; tlačítka okna proto musí mít
// margin-left: auto, jinak se posunou hned za .logo pod pole hledání
test('tlačítka okna v hlavičce drží u pravého okraje', () => {
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const blok = css.match(/\.window-controls\s*\{([^}]*)\}/);
    assert.ok(blok && /margin-left:\s*auto\s*;/.test(blok[1]), '.window-controls musí mít margin-left: auto');
});
