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

// Hlavička: v horním řádku (.titulek-okna) je pět hlavních záložek (#viewToggle), vpravo oddělená kapsle voleb
// (#volbyPrehledu) a tlačítka okna (.window-controls); ve druhém řádku (.hlavni-lista) jsou drobečky (.logo), pilulky
// podčástí (#pasStranky) a vpravo přepínač lupy (#searchToggleBtn) s akcemi (#addBtn, #menuBtn); ve třetím řádku
// (#hledaniRadek) je uprostřed kapsle hledat (.nav-controls, #searchInput)
test('sjednocená hlavička s přepínačem lupy a řádkem hledání uprostřed', () => {
    const zdroj = readFileSync(new URL('../src/sablona.js', import.meta.url), 'utf8');
    const titulek = zdroj.match(/<div class="titulek-okna">([\s\S]*)<div class="hlavni-lista">/);
    assert.ok(titulek, '.titulek-okna před .hlavni-lista');
    const zalozky = [...titulek[1].matchAll(/data-rezim="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(zalozky, ['modelky', 'covery', 'centerfoldy', 'prehled', 'prehled']);
    assert.match(titulek[1], /id="volbyPrehledu"/);
    assert.ok(titulek[1].indexOf('id="volbyPrehledu"') > titulek[1].indexOf('</nav>'), 'volby až za záložkami');
    assert.match(titulek[1], /id="winCloseBtn"/);

    const lista = zdroj.match(/<div class="hlavni-lista">([\s\S]*)<div id="hledaniRadek"/);
    assert.ok(lista, '.hlavni-lista před #hledaniRadek');
    assert.match(lista[1], /class="logo hidden"/);
    assert.match(lista[1], /id="pasStranky"/);
    assert.doesNotMatch(lista[1], /id="volbyPrehledu"/);
    assert.match(lista[1], /id="searchToggleBtn"/);
    assert.match(lista[1], /id="addBtn"/);
    assert.match(lista[1], /id="menuBtn"/);

    const hledani = zdroj.match(/<div id="hledaniRadek" class="hledani-radek hidden">([\s\S]*?)<\/header>/);
    assert.ok(hledani, '#hledaniRadek v hlavičce');
    assert.match(hledani[1], /id="searchInput"/);

    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const blok = css.match(/\.window-controls\s*\{([^}]*)\}/);
    assert.ok(blok && /margin-left:\s*auto\s*;/.test(blok[1]), '.window-controls musí mít margin-left: auto');
});
