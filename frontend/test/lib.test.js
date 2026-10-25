import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nazevAlba, esc, formatDatum, platneDatum, sjednotit, vekPriVydani, udajChybi, cisloNevyslo, ciselRocniku, rozlozitKategorie, slozitKategorie, kategorieModelky, popisKategorie, paskaOnline, vyskytModelky } from '../src/lib/format.js';
import { sestavitAlba, zacatkyAlb, novePoradi } from '../src/lib/alba.js';

test('názvy a formáty', () => {
    assert.equal(nazevAlba('2009-11', 'Centerfold'), 'Listopad 2009');
    assert.equal(nazevAlba('2009-11', 'Pictorial'), '2009-11');
    assert.equal(formatDatum('1988-12-08'), '8. 12. 1988');
    assert.equal(formatDatum('1991'), '1991');
    assert.equal(esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
    assert.equal(sjednotit('  Zoë Ödegaard '), 'zoe odegaard');
    assert.equal(vekPriVydani('1988-12-08', '2009-11'), '20 let');
    assert.equal(vekPriVydani('1988', '2009-11'), '');
});

test('tetování „ne" je vyplněný údaj, nula u výšky ne', () => {
    assert.equal(udajChybi({ tetovani: 0 }, 'tetovani'), false);
    assert.equal(udajChybi({ tetovani: -1 }, 'tetovani'), true);
    assert.equal(udajChybi({ vyskaCm: 0 }, 'vyskaCm'), true);
});

const fotka = (id, album, typ, dalsi = {}) => ({ id, modelkaId: 1, album, typ, rotace: 0, ...dalsi });

test('alba: centerfold první, srdíčka řadí, ruční pořadí má přednost', () => {
    const alba = sestavitAlba([
        fotka(1, 'A', 'Pictorial'), fotka(2, 'A', 'Pictorial', { hodnoceni: 5 }),
        fotka(3, '2009-11', 'Centerfold', { spojit: true }), fotka(4, '2009-11', 'Centerfold', { spojit: true }),
    ]);
    assert.deepEqual(alba.map(a => a.typ), ['Centerfold', 'Pictorial']);
    assert.equal(alba[0].polozky.length, 1);
    assert.deepEqual(alba[1].polozky.map(p => p.fotky[0].id), [2, 1]);

    const rucni = sestavitAlba([fotka(1, 'A', 'Pictorial', { poradi: 1 }), fotka(2, 'A', 'Pictorial', { poradi: 2, hodnoceni: 5 })]);
    assert.deepEqual(rucni[0].polozky.map(p => p.fotky[0].id), [1, 2]);
});

test('začátky alb a nové pořadí po přetažení', () => {
    const polozky = sestavitAlba([fotka(1, 'A', 'Pictorial'), fotka(2, 'A', 'Pictorial'), fotka(3, 'B', 'Pictorial')]).flatMap(a => a.polozky);
    assert.deepEqual(zacatkyAlb(polozky), [0, 2]);
    assert.deepEqual(novePoradi([1, 2, 3, 4], 4, 2, true), [1, 4, 2, 3]);
    assert.deepEqual(novePoradi([1, 2, 3, 4], 1, 3, false), [2, 3, 1, 4]);
});

test('skloňování počtu', async () => {
    const { sklonovat } = await import('../src/lib/format.js');
    assert.equal(sklonovat(0, 'fotka', 'fotky', 'fotek'), '0 fotek');
    assert.equal(sklonovat(1, 'fotka', 'fotky', 'fotek'), '1 fotka');
    assert.equal(sklonovat(3, 'fotka', 'fotky', 'fotek'), '3 fotky');
    assert.equal(sklonovat(5, 'fotka', 'fotky', 'fotek'), '5 fotek');
    assert.equal(sklonovat(12, 'rok', 'roky', 'roků'), '12 roků');
});

test('řazení galerie a části lišty', async () => {
    const { seraditModelky, castGalerie, prvniRok } = await import('../src/lib/format.js');
    const modelky = [
        { id: 1, jmeno: 'Anna', pridano: '2026-01-05 10:00:00', vydani: ['1994-05-CZ', '1990-02'], hodnoceni: 3, pocetFotek: 15 },
        { id: 2, jmeno: 'Bára', pridano: '2026-10-14 09:00:00', vydani: [], hodnoceni: 5, pocetFotek: 55 },
        { id: 3, jmeno: 'Čeňka', pridano: '', vydani: ['1975-07'], hodnoceni: 0, pocetFotek: 25 },
    ];
    assert.deepEqual(seraditModelky(modelky, 'jmeno').map(m => m.id), [1, 2, 3]);
    assert.deepEqual(seraditModelky(modelky, 'pridano').map(m => m.id), [2, 1, 3]);
    assert.deepEqual(seraditModelky(modelky, 'rok').map(m => m.id), [3, 1, 2]);
    assert.deepEqual(seraditModelky(modelky, 'hodnoceni').map(m => m.id), [2, 1, 3]);
    assert.deepEqual(seraditModelky(modelky, 'fotky').map(m => m.id), [2, 3, 1]);
    assert.equal(prvniRok(modelky[0]), 1990);
    assert.equal(castGalerie(modelky[0], 'rok'), '1990s');
    assert.equal(castGalerie(modelky[1], 'rok'), 'Bez vydání');
    assert.equal(castGalerie(modelky[1], 'pridano'), 'Říjen 2026');
    assert.equal(castGalerie(modelky[2], 'pridano'), 'Bez data');
    assert.equal(castGalerie(modelky[2], 'jmeno'), 'C');
    assert.equal(castGalerie(modelky[0], 'hodnoceni'), '♥♥♥');
    assert.equal(castGalerie(modelky[2], 'hodnoceni'), 'Bez srdíček');
    assert.equal(castGalerie(modelky[0], 'fotky'), '1–19 fotek');
    assert.equal(castGalerie(modelky[1], 'fotky'), '50+ fotek');
    assert.equal(castGalerie(modelky[2], 'fotky'), '20–49 fotek');
});

test('speciály: klíč, název a speciály roku', async () => {
    const { rozlozitVydani, slozitVydani, nazevVydani, nastavitNazvySpecialu, specialyRoku, jeSpecial } = await import('../src/lib/format.js');
    assert.deepEqual(rozlozitVydani('1995-S01-CZ'), { rok: '1995', mesic: 'S01', edice: 'CZ' });
    assert.equal(slozitVydani('1995', 'S02', 'US'), '1995-S02');
    assert.equal(jeSpecial('1995-S02'), true);
    assert.equal(jeSpecial('1995-02'), false);
    assert.equal(nazevVydani('1995-S01'), 'Speciál 1 1995');
    nastavitNazvySpecialu([{ vydani: '1995-S01', nazev: 'Playmate Review' }, { vydani: '1995-S01-CZ', nazev: 'Léto' }, { vydani: '1996-S01', nazev: 'Lingerie' }]);
    assert.equal(nazevVydani('1995-S01'), 'Playmate Review 1995');
    assert.equal(nazevVydani('1995-S01-CZ'), 'Léto 1995 · CZ');
    assert.deepEqual(specialyRoku('1995', 'US'), [{ vydani: '1995-S01', nazev: 'Playmate Review' }]);
    assert.deepEqual(specialyRoku(1995, 'CZ').map(s => s.nazev), ['Léto']);
    nastavitNazvySpecialu([]);
});

test('páska čísla s edicí i bez edice', async () => {
    const { paskaCisla } = await import('../src/lib/format.js');
    assert.equal(paskaCisla('1995-04'), 'Dub 95');
    assert.equal(paskaCisla('1995-04-CZ'), 'Dub 95 · CZ');
    assert.equal(paskaCisla('1995-S01'), 'Speciál 95');
    assert.equal(paskaCisla('1995-S01-CZ'), 'Speciál 95 · CZ');
    assert.equal(paskaCisla('1995'), 'Ročník 95');
    assert.equal(paskaCisla('1995-DE'), 'Ročník 95 · DE');
    assert.equal(paskaCisla(''), '');
    assert.equal(paskaCisla('neplatne'), '');
});

test('novinky z changelogu', async () => {
    const { porovnatVerze, novinkyMezi, telaNaHtml } = await import('../src/lib/changelog.js');
    const text = `# Changelog\n\nÚvod.\n\n## [0.14.0] – nevydáno\n\nNápověda.\n\n### Přidáno\n- Okno \`?\`\n  s nápovědou.\n\n## [0.13.0] – 2026-10-14\n\n- Speciály.\n\n## [0.12.0] – 2026-10-14\n\n- Import.\n`;
    assert.ok(porovnatVerze('0.14.0-dev', '0.13.0') > 0);
    assert.equal(porovnatVerze('0.13.0', '0.13.0'), 0);
    assert.deepEqual(novinkyMezi(text, '0.12.0', '0.14.0-dev').map(v => v.verze), ['0.14.0', '0.13.0']);
    assert.deepEqual(novinkyMezi(text, '', '0.12.0').map(v => v.verze), ['0.12.0']);
    const html = telaNaHtml(novinkyMezi(text, '0.13.0', '0.14.0'));
    assert.ok(html.includes('<h5>Přidáno</h5>') && html.includes('<li>Okno <code>?</code> s nápovědou.</li>') && html.includes('<p>Nápověda.</p>'));
    assert.ok(telaNaHtml(novinkyMezi(text, '0.12.0', '0.13.0')).includes('14. 10. 2026'));
});

test('porovnání předběžných verzí', async () => {
    const { porovnatVerze, novinkyMezi } = await import('../src/lib/changelog.js');
    assert.ok(porovnatVerze('1.0.0-alpha.2', '1.0.0-alpha.1') > 0);
    assert.ok(porovnatVerze('1.0.0-beta.1', '1.0.0-alpha.9') > 0);
    assert.ok(porovnatVerze('1.0.0', '1.0.0-rc.1') > 0);
    assert.ok(porovnatVerze('1.0.0-alpha.1', '0.14.3') > 0);
    assert.equal(porovnatVerze('0.14.3-dev', '0.14.3'), 0);
    const text = '## [1.0.0-alpha.2] – 2026-11-01\n\n- B\n\n## [1.0.0-alpha.1] – 2026-10-20\n\n- A\n';
    assert.deepEqual(novinkyMezi(text, '1.0.0-alpha.1', '1.0.0-alpha.2').map(v => v.verze), ['1.0.0-alpha.2']);
});

test('neúplná data modelky', () => {
    assert.equal(formatDatum('1975-03'), 'březen 1975');
    assert.equal(formatDatum('1975'), '1975');
    for (const d of ['', '1975', '1975-03', '1975-03-09']) assert.equal(platneDatum(d), true, d);
    for (const d of ['1975-13', '75', '9. 3. 1975', '1975-3']) assert.equal(platneDatum(d), false, d);
    assert.equal(vekPriVydani('1950-08', '2001-07'), '50 let');
});

test('markdown v řádku: tučné, kurzíva, kód, přeškrtnutí', async () => {
    const { markdownVRadku } = await import('../src/lib/format.js');
    assert.equal(markdownVRadku(''), '');
    assert.equal(markdownVRadku('Obyčejný text'), 'Obyčejný text');
    assert.equal(markdownVRadku('**tučné**'), '<strong>tučné</strong>');
    assert.equal(markdownVRadku('__tučné__'), '<strong>tučné</strong>');
    assert.equal(markdownVRadku('*kurzíva*'), '<em>kurzíva</em>');
    assert.equal(markdownVRadku('_kurzíva_'), '<em>kurzíva</em>');
    assert.equal(markdownVRadku('promenna_s_podtrzitky'), 'promenna_s_podtrzitky');
    assert.equal(markdownVRadku('***tučná kurzíva***'), '<strong><em>tučná kurzíva</em></strong>');
    assert.equal(markdownVRadku('___tučná kurzíva___'), '<strong><em>tučná kurzíva</em></strong>');
    assert.equal(markdownVRadku('`kód`'), '<code>kód</code>');
    assert.equal(markdownVRadku('`**není tučné**`'), '<code>**není tučné**</code>');
    assert.equal(markdownVRadku('~~přeškrtnuto~~'), '<del>přeškrtnuto</del>');
    assert.equal(markdownVRadku('Text s **tučným** a *kurzívou* i `kódem`.'), 'Text s <strong>tučným</strong> a <em>kurzívou</em> i <code>kódem</code>.');
    assert.equal(markdownVRadku('**tučné s *kurzívou* uvnitř**'), '<strong>tučné s <em>kurzívou</em> uvnitř</strong>');
    assert.equal(markdownVRadku('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
});

test('formátování markdown bloků: odstavce, odrážky, citace, nadpisy, perex a mluvčí', async () => {
    const { formatMarkdown } = await import('../src/lib/format.js');
    assert.equal(formatMarkdown(''), '');
    assert.equal(formatMarkdown('Jeden odstavec'), '<p>Jeden odstavec</p>');
    assert.equal(formatMarkdown('Řádek 1\nŘádek 2'), '<p>Řádek 1<br>Řádek 2</p>');
    assert.equal(formatMarkdown('Odstavec 1\n\nOdstavec 2'), '<p>Odstavec 1</p><p>Odstavec 2</p>');

    // Odrážkový seznam s hvězdičkami i pomlčkami
    const odrazky = formatMarkdown('* První bod s **tučným**\n* Druhý bod s *kurzívou*\n- Třetí bod');
    assert.equal(odrazky, '<ul><li>První bod s <strong>tučným</strong></li><li>Druhý bod s <em>kurzívou</em></li><li>Třetí bod</li></ul>');

    // Číslovaný seznam
    const cisla = formatMarkdown('1. První krok\n2. Druhý krok');
    assert.equal(cisla, '<ol><li>První krok</li><li>Druhý krok</li></ol>');

    // Citace
    const citace = formatMarkdown('> První řádek citátu\n> Druhý řádek citátu');
    assert.equal(citace, '<blockquote>První řádek citátu<br>Druhý řádek citátu</blockquote>');

    // Nadpisy
    const nadpisy = formatMarkdown('# Hlavní\n## Podnadpis\n### Sekce');
    assert.equal(nadpisy, '<h3>Hlavní</h3><h4>Podnadpis</h4><h5>Sekce</h5>');

    // Článek s perexem a mluvčím
    const clanek = formatMarkdown('Úvodní perex článku s **důrazem**.\n\nPLAYBOY: Jak jste začínala?\nMODELKA: Byla to náhoda.', { perex: true, mluvci: true });
    assert.equal(clanek, '<p class="clanek-perex">Úvodní perex článku s <strong>důrazem</strong>.</p><p><strong>PLAYBOY:</strong> Jak jste začínala?<br><strong>MODELKA:</strong> Byla to náhoda.</p>');
});

test('víceslovné vyhledávání a shoda slov napříč údaji', async () => {
    const { bezDiakritiky, sjednotit } = await import('../src/lib/format.js');
    const slova = sjednotit('Pamela 1990').split(/\s+/).filter(Boolean);
    const polozka1 = ['Pamela Anderson', '1990-02', 'Únor 1990'];
    const polozka2 = ['Pamela Anderson', '1995-04', 'Duben 1995'];
    const polozka3 = ['Anna Nicole Smith', '1990-05', 'Květen 1990'];

    const vyhovuje = polozka => slova.every(s => polozka.some(t => bezDiakritiky(t).includes(s)));
    assert.equal(vyhovuje(polozka1), true);
    assert.equal(vyhovuje(polozka2), false);
    assert.equal(vyhovuje(polozka3), false);
});

test('pokročilá syntaxe vyhledávání: negace, operátory, rozsahy, OR a neuzavřené uvozovky', async () => {
    const { rozlozitDotaz, vyhovujeHledani } = await import('../src/lib/format.js');

    // Tolerance neuzavřených uvozovek a parsování
    const tNeuzavrene = rozlozitDotaz('fotograf:"arny');
    assert.equal(tNeuzavrene.length, 1);
    assert.equal(tNeuzavrene[0].klic, 'fotograf');
    assert.equal(tNeuzavrene[0].hodnota, 'arny');
    assert.equal(tNeuzavrene[0].negace, false);

    // Negace a vícenásobné hodnoty (OR přes čárku)
    const tKomplex = rozlozitDotaz('-tag:playmate vlasy:blond,zrzava -usa');
    assert.equal(tKomplex.length, 3);
    assert.deepEqual(tKomplex[0], { negace: true, klic: 'tag', hodnota: 'playmate', varianty: ['playmate'] });
    assert.deepEqual(tKomplex[1], { negace: false, klic: 'vlasy', hodnota: 'blond,zrzava', varianty: ['blond', 'zrzava'] });
    assert.deepEqual(tKomplex[2], { negace: true, klic: '', hodnota: 'usa', varianty: ['usa'] });

    // vyhovujeHledani: shoda s negací a OR
    const polozkaBlond = ['Pamela Anderson', 'blond', 'Kanada'];
    const polozkaZrzava = ['Alyssa', 'zrzavá', 'Kanada'];
    const polozkaBruneta = ['Carmen', 'hnědá', 'USA'];

    const dotazOr = rozlozitDotaz('blond,zrzava -usa');
    assert.equal(vyhovujeHledani(polozkaBlond, dotazOr), true);
    assert.equal(vyhovujeHledani(polozkaZrzava, dotazOr), true);
    assert.equal(vyhovujeHledani(polozkaBruneta, dotazOr), false);

    // vyhovujeHledani: rozsahy a operátory let
    const tRozsah = rozlozitDotaz('rok:1970..1979');
    assert.equal(vyhovujeHledani(['1975-05', 'Květen 1975'], tRozsah), true);
    assert.equal(vyhovujeHledani(['1985-05', 'Květen 1985'], tRozsah), false);

    const tPomlcka = rozlozitDotaz('rok:1970-1979');
    assert.equal(vyhovujeHledani(['1972-10'], tPomlcka), true);
    assert.equal(vyhovujeHledani(['1969-12'], tPomlcka), false);

    const tOperator = rozlozitDotaz('rok:>=1990');
    assert.equal(vyhovujeHledani(['1992-01'], tOperator), true);
    assert.equal(vyhovujeHledani(['1989-12'], tOperator), false);

    // Tolerance mezery za dvojtečkou (vlasy: blond, fotograf: "arny freytag", rok: >= 1990, vlasy: blond, zrzava)
    const tMezera = rozlozitDotaz('vlasy: blond -tag: playmate fotograf: "Arny Freytag"');
    assert.equal(tMezera.length, 3);
    assert.deepEqual(tMezera[0], { negace: false, klic: 'vlasy', hodnota: 'blond', varianty: ['blond'] });
    assert.deepEqual(tMezera[1], { negace: true, klic: 'tag', hodnota: 'playmate', varianty: ['playmate'] });
    assert.deepEqual(tMezera[2], { negace: false, klic: 'fotograf', hodnota: 'arny freytag', varianty: ['arny freytag'] });

    const tMezeraOr = rozlozitDotaz('vlasy: blond, zrzava');
    assert.equal(tMezeraOr.length, 1);
    assert.deepEqual(tMezeraOr[0].varianty, ['blond', 'zrzava']);

    const tMezeraOp = rozlozitDotaz('rok: >= 1990');
    assert.equal(vyhovujeHledani(['1992-01'], tMezeraOp), true);
    assert.equal(vyhovujeHledani(['1989-12'], tMezeraOp), false);

    assert.deepEqual(rozlozitDotaz('vlasy:'), []);
    assert.deepEqual(rozlozitDotaz('vlasy: '), []);
});

test('fuzzy matching Levenshtein a podpora našeptávání syntaxe', async () => {
    const { odpovidaTextFuzzy, vzdalenostLevenshtein, vyhovujeHledani, rozlozitDotaz, PRIKAZY } = await import('../src/lib/format.js');

    // Levenshteinova vzdálenost
    assert.equal(vzdalenostLevenshtein('pamela', 'pamella'), 1);
    assert.equal(vzdalenostLevenshtein('freytag', 'freitag'), 1);
    assert.equal(vzdalenostLevenshtein('freytag', 'fraetag'), 2);
    assert.equal(vzdalenostLevenshtein('bob', 'eva'), 3);

    // odpovidaTextFuzzy
    assert.equal(odpovidaTextFuzzy('Pamela Anderson', 'Pamella'), true);
    assert.equal(odpovidaTextFuzzy('Arny Freytag', 'Freitag'), true);
    assert.equal(odpovidaTextFuzzy('Arny Freytag', 'arni fraetag'), true);
    assert.equal(odpovidaTextFuzzy('Anna Bílá', 'Bob'), false);

    // vyhovujeHledani s fuzzy tolerancí
    const tPamella = rozlozitDotaz('Pamella');
    assert.equal(vyhovujeHledani(['Pamela Anderson', 'modelka'], tPamella), true);
    assert.equal(vyhovujeHledani(['Carmen Electra', 'modelka'], tPamella), false);

    // Příkazy našeptávače
    assert.ok(PRIKAZY.some(p => p.klic === 'vlasy:'));
    assert.ok(PRIKAZY.some(p => p.klic === 'vydani:'));
    assert.ok(PRIKAZY.some(p => p.klic === 'vyska:'));
    assert.ok(PRIKAZY.some(p => p.klic === 'tag:'));
});




test('číslo, které nevyšlo (US březen 1955)', () => {
    assert.equal(cisloNevyslo('1955-03'), true);
    assert.equal(cisloNevyslo('2015-03-CZ'), false);
    assert.equal(cisloNevyslo('1955-04'), false);
    assert.equal(ciselRocniku(1955, 'US'), 11);
    assert.equal(ciselRocniku(2015, 'CZ'), 12);
    assert.equal(ciselRocniku('1956', 'US'), 12);
});

test('měsíční řady edic', () => {
    assert.equal(cisloNevyslo('1953-11'), true);
    assert.equal(cisloNevyslo('1953-12'), false);
    assert.equal(cisloNevyslo('2020-03'), false);
    assert.equal(cisloNevyslo('2020-04'), true);
    assert.equal(cisloNevyslo('2025-02'), true);
    assert.equal(cisloNevyslo('2025-S01'), false);
    assert.equal(cisloNevyslo('2011-06-CZ'), true);
    assert.equal(cisloNevyslo('2011-07-CZ'), false);
    assert.equal(cisloNevyslo('2026-05-CZ'), false);
    assert.equal(cisloNevyslo('1975'), false);
    assert.equal(ciselRocniku(1953, 'US'), 1);
    assert.equal(ciselRocniku(2020, 'US'), 3);
    assert.equal(ciselRocniku(2022, 'US'), 0);
    assert.equal(ciselRocniku(2011, 'CZ'), 6);
});

test('kategorie modelek', () => {
    const text = t => slozitKategorie(rozlozitKategorie(t));
    // Sjednocení názvů, anglické názvy, úroveň a rok
    assert.equal(text('pmoy 1998, celebrity'), 'Playmate roku 1998, Celebrita');
    assert.equal(text('Cybergirl of the Month 2005'), 'Cyber Girl měsíce 2005');
    assert.equal(text('cyber girl týdne; Coed of the Week'), 'Cyber Girl týdne, Coed týdne');
    assert.equal(text('Playmate'), 'Playmate měsíce');
    assert.equal(text('Cover'), 'Modelka obálky');
    // Neznámá hodnota zůstane, stejná kategorie dvakrát jen jednou
    assert.equal(text('Modelka, Muse, muses'), 'Modelka, Muse');
    assert.equal(text(''), '');
    assert.deepEqual(rozlozitKategorie('Modelka')[0], { nazev: 'Modelka', detail: '', zbytek: '', vlastni: true });
    // Odvozené kategorie z centerfoldu a obálky, pořadí podle seznamu, vlastní na konci
    const m = { role: 'Vlastní, Celebrita', centerfoldy: ['1995-03'], obalky: ['1996-01'] };
    assert.deepEqual(kategorieModelky(m).map(popisKategorie), ['Playmate měsíce', 'Celebrita', 'Modelka obálky', 'Vlastní']);
    assert.equal(kategorieModelky(m)[0].odvozena, true);
    // Online album = Cyber Girl, jen když není zapsaná jiná online kategorie
    assert.deepEqual(kategorieModelky({ role: '', onlineAlba: ['2004-06'] }).map(popisKategorie), ['Cyber Girl']);
    assert.deepEqual(kategorieModelky({ role: 'Coed', onlineAlba: ['2004-06'] }).map(popisKategorie), ['Coed']);
    assert.deepEqual(kategorieModelky({ role: 'Online', onlineAlba: ['2004-06-12'], cyberGirl: 'týdne' }).map(popisKategorie), ['Cyber Girl týdne', 'Online']);
    assert.deepEqual(kategorieModelky({ role: '', onlineAlba: ['2004-09'], cyberGirl: 'měsíce' }).map(popisKategorie), ['Cyber Girl měsíce']);
    // Páska bez data: Cyber Girl má přednost před Online, ostatní online kategorie zatím jako Online
    assert.equal(paskaOnline({ role: '', onlineAlba: ['2004-06'] }), 'Cyber Girl');
    assert.equal(paskaOnline({ role: 'Online, Cyber Girl měsíce', onlineAlba: ['2004'] }), 'Cyber Girl');
    assert.equal(paskaOnline({ role: 'Online', onlineAlba: ['2004'] }), 'Online');
    assert.equal(paskaOnline({ role: 'Muse', onlineAlba: [''] }), 'Online');
    // Údržba: kategorie chybí, jen když není zapsaná ani odvozená
    assert.equal(udajChybi({ role: '', centerfoldy: [], obalky: [] }, 'role'), true);
    assert.equal(udajChybi({ role: '', centerfoldy: ['1995-03'], obalky: [] }, 'role'), false);
});

test('počet souborů Disku ve vloženém textu', async () => {
    const { pocetOdkazuDisku } = await import('../src/lib/format.js');
    const id = 'A'.repeat(28), id2 = 'B'.repeat(28);
    assert.equal(pocetOdkazuDisku(`https://drive.google.com/file/d/${id}/view\nhttps://drive.google.com/open?id=${id2} ${id}`), 2);
    assert.equal(pocetOdkazuDisku('bez odkazu'), 0);
});

test('soubory Disku ve vloženém textu v pořadí výskytu', async () => {
    const { idOdkazuDisku } = await import('../src/lib/format.js');
    const id = 'A'.repeat(28), id2 = 'B'.repeat(28);
    assert.deepEqual(idOdkazuDisku(`${id2}\nhttps://drive.google.com/file/d/${id}/view?usp=sharing ${id2}`), [id, id2]);
    assert.deepEqual(idOdkazuDisku(''), []);
});

test('výskyt modelky: časopis, jen online, neurčeno', () => {
    assert.equal(vyskytModelky({ vydani: ['1995-03'] }), 'casopis');
    assert.equal(vyskytModelky({ obalky: ['1996-S01-CZ'] }), 'casopis');
    // Ročník bez měsíce (Cybergirl of the Year 2012) není číslo časopisu
    assert.equal(vyskytModelky({ vydani: ['2012'], role: 'Cybergirl of the Year 2012' }), 'online');
    assert.equal(vyskytModelky({ role: 'Muse' }), 'online');
    assert.equal(vyskytModelky({ role: 'Playboy Plus' }), 'online');
    assert.equal(vyskytModelky({ role: 'Cyber Girl', centerfoldy: ['2005-03'] }), 'casopis');
    assert.equal(vyskytModelky({ role: 'Celebrita' }), '');
    assert.equal(vyskytModelky({}), '');
});

test('cílené hledání: rok a vydání s měsícem nejsou rozsah', async () => {
    const { vyhovujeHledani, poleCisla, rozlozitDotaz: rozlozitHledani } = await import('../src/lib/format.js');
    const ma = (dotaz, vydani) => vyhovujeHledani([vydani], rozlozitHledani(dotaz), poleCisla(vydani));
    assert.equal(ma('vydani:1975-01', '1975-01'), true);
    assert.equal(ma('vydani:1975-01', '1980-05'), false);
    assert.equal(ma('rok:1975-01', '1975-01'), true);
    assert.equal(ma('rok:1975-01', '1960-02'), false);
    assert.equal(ma('rok:1970-1979', '1975-01'), true);
    assert.equal(ma('rok:1970-1979', '1980-01'), false);
});

test('online album: výskyt jen online, nadpis s datem nafocení a hledání nafoceno:', async () => {
    const { rozlozitDotaz, vyhovujeHledani, poleFotky, popisTypuAlba, TYP_ONLINE, PRIKAZY } = await import('../src/lib/format.js');
    // Online album stačí i bez online kategorie (stejně jako vyskyt:online v app.go), číslo časopisu má přednost
    assert.equal(vyskytModelky({ onlineAlba: ['2004-06'] }), 'online');
    assert.equal(vyskytModelky({ onlineAlba: [''] }), 'online');
    assert.equal(vyskytModelky({ onlineAlba: ['2004-06'], vydani: ['2012'] }), 'online');
    assert.equal(vyskytModelky({ onlineAlba: ['2004-06'], centerfoldy: ['2005-03'] }), 'casopis');
    assert.equal(vyskytModelky({ onlineAlba: [] }), '');

    assert.equal(popisTypuAlba(TYP_ONLINE, '2004-06'), 'Pictorial online · nafoceno červen 2004');
    assert.equal(popisTypuAlba(TYP_ONLINE, '2004-06-15'), 'Pictorial online · nafoceno 15. 6. 2004');
    assert.equal(popisTypuAlba(TYP_ONLINE, ''), 'Pictorial online');
    // Cyber Girl týdne: týden podle ISO 8601 z celého data
    const { tydenRoku, TYP_CG_TYDNE } = await import('../src/lib/format.js');
    assert.deepEqual(tydenRoku('2004-06-12'), { tyden: 24, rok: 2004 });
    assert.deepEqual(tydenRoku('2005-01-01'), { tyden: 53, rok: 2004 });
    assert.deepEqual(tydenRoku('2007-12-31'), { tyden: 1, rok: 2008 });
    assert.deepEqual(tydenRoku('2004-01-05'), { tyden: 2, rok: 2004 });
    assert.equal(tydenRoku('2004-06'), null);
    assert.equal(popisTypuAlba(TYP_CG_TYDNE, '2004-06-12'), 'Cyber Girl týdne · 24. týden 2004 (nafoceno 12. 6. 2004)');
    assert.equal(popisTypuAlba(TYP_CG_TYDNE, '2004'), 'Cyber Girl týdne · nafoceno 2004');
    assert.equal(popisTypuAlba('Cyber Girl měsíce', '2004-09'), 'Cyber Girl měsíce · září 2004');
    assert.equal(popisTypuAlba('Cyber Girl měsíce', '2004-09-03'), 'Cyber Girl měsíce · září 2004 (nafoceno 3. 9. 2004)');
    assert.equal(popisTypuAlba('Pictorial', '2004'), 'Pictorial');

    // nafoceno: je předpona data (rok nebo měsíc), čárka = nebo; pohled bez data alba slovo nic neomezuje
    const fotka = poleFotky({ jmenoModelky: 'Anna', album: 'Web', typ: TYP_ONLINE, vydani: '', datumAlba: '2004-06-15' });
    const najde = dotaz => vyhovujeHledani(['Anna'], rozlozitDotaz(dotaz), fotka);
    assert.ok(najde('nafoceno:2004'));
    assert.ok(najde('nafoceno:2004-06'));
    assert.ok(najde('nafoceno:2003,2004'));
    assert.ok(!najde('nafoceno:2005'));
    assert.ok(!najde('nafoceno:06'));
    assert.ok(!najde('-nafoceno:2004'));
    assert.ok(vyhovujeHledani(['Anna'], rozlozitDotaz('nafoceno:2004'), { jmeno: 'Anna' }));
    assert.ok(PRIKAZY.some(p => p.klic === 'nafoceno:'));
});
