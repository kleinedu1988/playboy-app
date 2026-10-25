import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILTRY, OBLASTI_FILTRU, UDAJE, dalsiRadek, filtrovatUdrzbu, idNavrhu, opravaNavrhu, nazevKontroly, prvniUdaj, sestavitPoUdajich, sestavitUdrzbu, souhrnFronty, stitkySkupiny, textAkce, udajFiltru, ukolyFokusu, zalozkaPole, zdrojePolozek } from '../src/lib/udrzba.js';

// Modelka se všemi hlídanými údaji; jednotlivé testy jí údaje uberou
const uplna = (id, jmeno, dalsi = {}) => ({
    id, jmeno, narozeniDatum: '1975-03-12', narozeniMisto: 'Praha', narodnost: 'Česko', etnicita: 'Bělošská', vyskaCm: 172, vahaKg: 54,
    vlasyBarva: 'Blond', ociBarva: 'Modré', ochlupeni: 'Oholená', tetovani: 0, piercing: 0, obvodHrudnikCm: 90, obvodPasCm: 60, obvodBokyCm: 90,
    velikostPrsou: 'C', prsaTyp: 'Přírodní', role: 'Celebrita', tags: 'x', vydani: [], centerfoldy: [], obalky: [], netykaSe: '', hodnoceni: 3, ...dalsi,
});
const polozka = (m, netykaSe = false) => ({ modelkaId: m.id, jmeno: m.jmeno, album: '', typ: '', netykaSe });
const prehled = (dalsi = {}) => ({ modelek: 0, alb: 10, albOnline: 0, vydani: 20, bezTitulni: [], bezCenterfoldu: [], bezHodnoceni: [], albaBezPopisu: [], albaBezVydani: [],
    vydaniBezCoveru: [], vydaniBezCenterfoldu: [], podezrele: [], ...dalsi });

test('Playmate bez data narození jde ve frontě před drobnostmi', () => {
    const playmate = uplna(1, 'Anna', { narozeniDatum: '', centerfoldy: ['1990-01'] });
    const drobnosti = uplna(2, 'Bára', { vahaKg: 0, ociBarva: '', tags: '', prsaTyp: '', ochlupeni: '' });
    const model = sestavitUdrzbu({ p: prehled({ modelek: 2 }), modelky: [drobnosti, playmate] });
    assert.deepEqual(model.skupiny.map(s => s.jmeno), ['Anna', 'Bára']);
    const ukol = model.skupiny[0].polozky[0];
    assert.equal(ukol.filtr, 'udaje');
    assert.match(ukol.duvod, /Playmate bez data narození/);
    assert.equal(model.skupiny[0].uroven, 'vysoka');
});

test('nález kontroly a návrh patří do skupiny modelky, počty filtrů', () => {
    const m = uplna(3, 'Cecílie', { narodnost: '' });
    const n = { modelkaId: 3, jmeno: 'Cecílie', album: '', typ: '', pole: 'narodnost', popis: 'národnost', hodnota: 'USA', jistota: 0.95, duvod: 'Místo narození', klic: 'navrh:narodnost', inputId: 'inputNarodnost', odmitnuto: false, zdroj: 'misto', zdrojPopis: 'Místo narození → národnost' };
    const p = prehled({ modelek: 1, podezrele: [{ modelkaId: 3, jmeno: 'Cecílie', popis: 'Výška 17 cm', klic: 'kontrola:vyska', album: '', typ: '', pole: 'inputVyska', netykaSe: false, zdroj: 'rozsah' }] });
    const model = sestavitUdrzbu({ p, modelky: [m], navrhy: [n] });
    assert.equal(model.skupiny.length, 1);
    assert.deepEqual(model.skupiny[0].polozky.map(x => x.druh).sort(), ['kontrola', 'navrh', 'ukol']);
    assert.equal(model.pocty.vse, 1);
    assert.equal(model.pocty.kontrola, 1);
    assert.equal(model.pocty.navrhy, 1);
    assert.equal(model.pocty.udaje, 1);
    const kontrola = model.skupiny[0].polozky.find(x => x.druh === 'kontrola');
    assert.equal(kontrola.pole, 'výška');
    assert.deepEqual(zdrojePolozek(model, 'navrhy'), [{ zdroj: 'misto', popis: 'Místo narození → národnost', pocet: 1 }]);
    assert.equal(filtrovatUdrzbu(model, { filtr: 'navrhy', zdroj: 'jiny' }).length, 0);
    assert.equal(filtrovatUdrzbu(model, { filtr: 'navrhy', zdroj: 'misto' })[0].polozky.length, 1);
});

test('netýká se: bez vyřízených zmizí, s nimi zůstane označené a nepočítá se', () => {
    const m = uplna(4, 'Dana', { narozeniDatum: '', narozeniMisto: '', netykaSe: 'zakladni' });
    const p = prehled({ modelek: 1 });
    assert.equal(sestavitUdrzbu({ p, modelky: [m] }).skupiny.length, 0);
    const skryte = sestavitUdrzbu({ p, modelky: [m], skryte: true });
    assert.equal(skryte.skupiny.length, 1);
    assert.equal(skryte.skupiny[0].polozky[0].netyka, true);
    assert.equal(skryte.pocty.vse, 0);
});

test('hledání podle jména bez diakritiky, čísla a kroky', () => {
    const modelky = [uplna(5, 'Šárka Nová', { tags: '' }), uplna(6, 'Eva Malá', { tags: '' })];
    const model = sestavitUdrzbu({ p: prehled({ modelek: 2, vydaniBezCoveru: ['1996-02'], vydaniBezCenterfoldu: ['1996-02'] }), modelky });
    assert.deepEqual(filtrovatUdrzbu(model, { hledat: 'sarka' }).map(v => v.skupina.jmeno), ['Šárka Nová']);
    const cislo = model.skupiny.find(s => s.druh === 'vydani');
    assert.deepEqual(cislo.polozky.map(x => x.filtr), ['cfcisla', 'cover']);
    assert.equal(model.pocty.cover, 1);
    // Pokrok: čísla 19 z 20 s coverem
    assert.deepEqual(model.pokrok.find(o => o.klic === 'cover'), { skupina: 'Čísla', klic: 'cover', nazev: 'Cover', hotovo: 19, celkem: 20, chybi: 1, filtr: 'cover', jednotka: '' });
});

test('návrh je určený i hodnotou (odmítnutí platí jen pro ni), pole formuláře mají část', () => {
    const n = { modelkaId: 1, album: '', typ: '', klic: 'navrh:oci', hodnota: 'Hnědé' };
    assert.notEqual(idNavrhu(n), idNavrhu({ ...n, hodnota: 'Modré' }));
    assert.equal(zalozkaPole('inputVyska'), 1);
    assert.equal(zalozkaPole('inputUmrtiDatum'), 0);
    assert.equal(zalozkaPole('inputTags'), 2);
});

test('titulní fotka a alba: položky a odložení po albech', () => {
    const m = uplna(7, 'Gábina');
    const p = prehled({ modelek: 1, bezTitulni: [polozka(m)], albaBezPopisu: [{ ...polozka(m), album: 'Pláž', typ: 'Pictorial' }, { ...polozka(m, true), album: 'Les', typ: 'Pictorial' }] });
    const model = sestavitUdrzbu({ p, modelky: [m] });
    const s = model.skupiny[0];
    assert.equal(s.polozky[0].id, 'titulni');
    const text = s.polozky.find(x => x.id === 'text');
    // Album označené „netýká se“ se nepočítá
    assert.equal(text.pole, '1 album bez textu');
    assert.equal(model.radkyModelek[0].id, 7);
});

test('oprava návrhu: prázdné pole a nula nejsou oprava, jiný zápis ano, kategorie stačí obsažená', () => {
    assert.equal(opravaNavrhu('34', 'inputHrudnik', 0), null);
    assert.equal(opravaNavrhu('34', 'inputHrudnik', 34), null);
    assert.equal(opravaNavrhu('34', 'inputHrudnik', 36), '36');
    assert.equal(opravaNavrhu('USA', 'inputNarodnost', '  '), null);
    assert.equal(opravaNavrhu('USA', 'inputNarodnost', ' USA '), null);
    assert.equal(opravaNavrhu('Ceska', 'inputNarodnost', 'Česká'), 'Česká');
    assert.equal(opravaNavrhu('USA', 'inputNarodnost', 'Kanada'), 'Kanada');
    assert.equal(opravaNavrhu('Playmate roku 1990', 'inputRole', 'Celebrita, playmate roku 1990'), null);
    assert.equal(opravaNavrhu('Playmate roku 1990', 'inputRole', 'Celebrita, Playmate roku 1991'), 'Celebrita, Playmate roku 1991');
});

// Modelka se dvěma nálezy, návrhem a chybějícími údaji (vzor z návrhu Údržby)
function slozita() {
    const m = uplna(8, 'Hana', { narodnost: '', narozeniDatum: '', hodnoceni: 0 });
    const n = { modelkaId: 8, jmeno: 'Hana', album: '', typ: '', pole: 'narodnost', popis: 'národnost', hodnota: 'USA', jistota: 0.95, duvod: 'Místo narození Texas',
        klic: 'navrh:narodnost', inputId: 'inputNarodnost', odmitnuto: false, zdroj: 'misto', zdrojPopis: '' };
    const nalez = (klic, pole, popis) => ({ modelkaId: 8, jmeno: 'Hana', popis, klic, album: '', typ: '', pole, netykaSe: false, zdroj: 'rozsah' });
    const p = prehled({ modelek: 1, bezTitulni: [polozka(m)], bezHodnoceni: [polozka(m)],
        podezrele: [nalez('kontrola:vyska', 'inputVyska', 'Výška 17 cm vypadá jako chyba'), nalez('kontrola:jmeno', '', 'Skoro stejné jméno')] });
    return sestavitUdrzbu({ p, modelky: [m], navrhy: [n] });
}
const VLASTNOSTI = { inputVyska: 'vyskaCm', inputNarodnost: 'narodnost', inputNarozeniDatum: 'narozeniDatum', inputDriveID: 'coverId' };

test('filtry po oblastech: plochý seznam pro počty, Fronta první', () => {
    assert.deepEqual(OBLASTI_FILTRU.map(o => o.nazev), ['Fronta', 'Modelky', 'Alba', 'Čísla']);
    assert.equal(FILTRY.length, 11);
    assert.deepEqual(FILTRY[0], ['vse', 'Vše']);
});

test('štítky řádku: nejvýš tři po druzích, jediná položka sama sebou', () => {
    const model = slozita();
    const s = model.skupiny[0];
    const stitky = stitkySkupiny(s.polozky);
    assert.deepEqual(stitky.map(x => x.text), ['⚠ 2 ke kontrole', '✦ 1 návrh', '3 chybí']);
    assert.ok(stitky.every(x => !x.polozka));
    // Jen návrh a chybějící: návrh je vidět celý (s jistotou), chybějící jako počet
    const bezKontroly = s.polozky.filter(x => x.druh !== 'kontrola');
    assert.deepEqual(stitkySkupiny(bezKontroly).map(x => x.text), ['✦ Národnost: USA · 95 %', '3 chybí']);
    assert.equal(stitkySkupiny(bezKontroly)[0].polozka, bezKontroly.find(x => x.druh === 'navrh').klic);
    // Dva chybějící úkoly: oba samostatně
    const dva = s.polozky.filter(x => x.druh === 'ukol').slice(0, 2);
    assert.equal(stitkySkupiny(dva).length, 2);
    assert.ok(stitkySkupiny(dva).every(x => x.polozka));
    assert.deepEqual(stitkySkupiny(dva.map(x => ({ ...x, netyka: true }))), [{ druh: 'netyka', text: '2 vyřízeno' }]);
});

test('souhrn do fronty a text akce', () => {
    const model = slozita();
    const s = model.skupiny[0];
    assert.equal(souhrnFronty(s.polozky), '⚠ výška, údaj · ✦ národnost · 3 chybí');
    const navrh = s.polozky.find(x => x.druh === 'navrh');
    assert.equal(textAkce(navrh, s), 'Přijmout');
    const cislo = { druh: 'vydani' };
    assert.equal(textAkce({ druh: 'ukol', id: 'cover' }, cislo), 'Přidat cover');
});

test('úkoly soustředěného režimu: pole po jednom, návrh místo prázdného pole, nález s polem jen jednou', () => {
    const model = slozita();
    const ukoly = ukolyFokusu(model.skupiny[0].polozky, id => VLASTNOSTI[id]);
    const podleDruhu = druh => ukoly.filter(u => u.druh === druh);
    // Národnost má návrh: doplňuje se jím, prázdné pole národnosti není
    assert.equal(podleDruhu('navrh')[0].inputId, 'inputNarodnost');
    assert.ok(!podleDruhu('pole').some(u => u.inputId === 'inputNarodnost'));
    assert.deepEqual(podleDruhu('pole').map(u => u.inputId), ['inputNarozeniDatum']);
    assert.equal(podleDruhu('pole')[0].prvniVeSkupine, true);
    // Nález výšky jde opravit na místě, nález jména ne (nemá pole)
    assert.deepEqual(podleDruhu('kontrola').map(u => u.inputId), ['inputVyska', '']);
    assert.equal(podleDruhu('titulni')[0].vlastnost, 'coverId');
    assert.equal(podleDruhu('hodnoceni').length, 1);
    // Číslo: vše v okně
    const cisla = sestavitUdrzbu({ p: prehled({ vydaniBezCoveru: ['1990-01'] }), modelky: [] });
    assert.deepEqual(ukolyFokusu(cisla.skupiny[0].polozky, () => '').map(u => u.druh), ['okno']);
});

test('Po údajích: pevné pořadí údajů, každý hlídaný údaj modelky má své místo', () => {
    assert.deepEqual(UDAJE.slice(0, 5).map(u => u.klic), ['kontrola', 'narozeniDatum', 'narodnost', 'narozeniMisto', 'vyskaVaha']);
    assert.equal(UDAJE.find(u => u.klic === 'narodnost').nazev, 'Národnost');
    assert.deepEqual(UDAJE.find(u => u.klic === 'miry').pole.map(p => p[2]), ['inputHrudnik', 'inputPas', 'inputBoky']);
    // Každá vlastnost ze SKUPINY_UDAJU je právě v jednom údaji
    const vlastnosti = UDAJE.flatMap(u => u.vlastnosti || []);
    assert.equal(new Set(vlastnosti).size, vlastnosti.length);
    assert.equal(vlastnosti.length, 18);
});

test('Po údajích: řádky po modelkách, návrh u svého pole, výška s váhou spolu, alba a čísla po jednom', () => {
    const model = slozita();
    const po = sestavitPoUdajich(model);
    const udaj = k => po.udaje.get(k);
    assert.deepEqual(udaj('narodnost').radky.map(r => r.skupina.jmeno), ['Hana']);
    assert.equal(udaj('narodnost').navrhu, 1);
    assert.equal(udaj('narodnost').radky[0].navrhy[0].navrh.hodnota, 'USA');
    assert.equal(udaj('narozeniDatum').navrhu, 0);
    assert.equal(udaj('kontrola').pocet, 2);
    assert.equal(nazevKontroly(udaj('kontrola')), 'Výška, údaj');
    assert.equal(udaj('titulni').pocet, 1);
    assert.equal(udaj('hodnoceni').pocet, 1);
    // Prázdné údaje v seznamu nejsou; Ke kontrole jde první
    assert.deepEqual(po.oblasti.map(o => o.klic), ['kontrola', 'udaje', 'fotky']);
    assert.ok(po.oblasti.every(o => o.udaje.every(u => u.pocet)));
    assert.equal(prvniUdaj(po), 'kontrola');

    const m = uplna(9, 'Ivana', { vyskaCm: 0, vahaKg: 0 });
    const p = prehled({ modelek: 1, albaBezVydani: [{ ...polozka(m), album: 'Pláž', typ: 'Pictorial' }, { ...polozka(m), album: 'Les', typ: 'Pictorial' }, { ...polozka(m, true), album: 'Hory', typ: 'Pictorial' }],
        vydaniBezCoveru: ['1990-01'] });
    const navrhAlba = { modelkaId: 9, jmeno: 'Ivana', album: 'Les', typ: 'Pictorial', pole: 'vydaniAlba', popis: 'Vydání alba', hodnota: '1990-01', jistota: 0.92, klic: 'nv-vydaniAlba', inputId: 'inputAlbumRok', odmitnuto: false };
    const fotograf = { ...navrhAlba, pole: 'fotografAlba', popis: 'Fotograf alba', hodnota: 'Pompeo Posar', inputId: 'inputAlbumFotograf', klic: 'nv-fotografAlba' };
    const po2 = sestavitPoUdajich(sestavitUdrzbu({ p, modelky: [m], navrhy: [navrhAlba, fotograf] }));
    assert.equal(po2.udaje.get('vyskaVaha').pocet, 1);
    assert.deepEqual(po2.udaje.get('vyskaVaha').radky[0].chybejici.map(u => u[0]), ['vyskaCm', 'vahaKg']);
    // Album „netýká se“ chybí, návrh vydání patří k řádku svého alba
    const alba = po2.udaje.get('vydaniAlb').radky;
    assert.deepEqual(alba.map(r => r.album.album), ['Pláž', 'Les']);
    assert.equal(alba[1].navrhy.length, 1);
    assert.equal(po2.udaje.get('navrhyAlb').pocet, 1);
    assert.equal(po2.udaje.get('cover').radky[0].skupina.vydani, '1990-01');
});

test('Po údajích: odmítnutý návrh a „netýká se“ se nepočítají, filtr z úvodu vede na údaj', () => {
    const m = uplna(10, 'Jana', { narodnost: '', etnicita: '' });
    const n = { modelkaId: 10, jmeno: 'Jana', album: '', typ: '', pole: 'narodnost', popis: 'národnost', hodnota: 'USA', jistota: 0.9, klic: 'nv-narodnost', inputId: 'inputNarodnost', odmitnuto: true };
    const po = sestavitPoUdajich(sestavitUdrzbu({ p: prehled({ modelek: 1 }), modelky: [m], navrhy: [n] }));
    assert.equal(po.udaje.get('narodnost').pocet, 1);
    assert.equal(po.udaje.get('narodnost').navrhu, 0);
    const netyka = sestavitPoUdajich(sestavitUdrzbu({ p: prehled({ modelek: 1 }), modelky: [{ ...m, netykaSe: 'zakladni' }], skryte: true }));
    assert.equal(netyka.udaje.get('narodnost').pocet, 0);
    assert.equal(udajFiltru(po, 'udaje'), 'narodnost');
    assert.equal(udajFiltru(po, 'cover'), '');
    assert.equal(udajFiltru(sestavitPoUdajich(slozita()), 'navrhy'), 'narodnost');
});

test('další řádek: přeskočí hotové, na konci nic', () => {
    const klice = ['a', 'b', 'c', 'd'];
    assert.equal(dalsiRadek(klice, new Set(), 'a'), 'b');
    assert.equal(dalsiRadek(klice, new Set(['b', 'c']), 'a'), 'd');
    assert.equal(dalsiRadek(klice, new Set(['d']), 'c'), '');
    assert.equal(dalsiRadek(klice, new Set(['b']), 'c', -1), 'a');
    // Neznámý řádek (zmizel): od začátku
    assert.equal(dalsiRadek(klice, new Set(), 'x'), 'a');
});
