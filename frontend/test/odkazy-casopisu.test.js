import { test } from 'node:test';
import assert from 'node:assert/strict';
import { odkazCasopisu, popisOdkazuCasopisu, rozpoznatAdresu } from '../src/lib/odkazy-casopisu.js';

test('Odkaz z webu časopisu: časopis, rok, měsíc a titul z adresy', () => {
    const r = rozpoznatAdresu('https://penthousemagazine.com/2019-pet-of-the-year-gianna-dior/');
    assert.deepEqual([r.rada, r.rok, r.mesic, r.titul, r.vydani], ['PH/US', '2019', '', 'roku', '2019@PH']);
    const m = rozpoznatAdresu('https://www.penthouse.com/pets/pet-of-the-month-june-2002-victoria/');
    assert.deepEqual([m.rada, m.rok, m.mesic, m.titul, m.vydani], ['PH/US', '2002', '06', 'mesice', '2002-06@PH']);
    // May jako měsíc i jako slovo v adrese
    assert.equal(rozpoznatAdresu('https://hustler.com/honey-of-the-month/may-1990')?.vydani, '1990-05@HU');
    assert.equal(rozpoznatAdresu('https://www.playboy.com/read/playmate-1994-10')?.vydani, '1994-10');
    assert.equal(rozpoznatAdresu('https://playboy.cz/modelky/2015/03/jana')?.vydani, '2015-03-CZ');
    assert.equal(rozpoznatAdresu('https://www.magazine-empire.com/PENT_1969.htm')?.vydani, '1969@PH');
    // Bez roku jen časopis
    const p = rozpoznatAdresu('https://penthouse.com/pets/brooke-tilli/');
    assert.deepEqual([p.rada, p.vydani], ['PH/US', '']);
});

test('Jiné weby a Disk se nerozpoznají; v textu první odkaz časopisu', () => {
    assert.equal(rozpoznatAdresu('https://drive.google.com/file/d/abc/view'), null);
    assert.equal(rozpoznatAdresu('https://en.wikipedia.org/wiki/Penthouse_(magazine)'), null);
    assert.equal(rozpoznatAdresu('https://notpenthouse.com/2019'), null);
    assert.equal(rozpoznatAdresu('není adresa'), null);
    const t = 'https://drive.google.com/file/d/abc/view\nhttps://www.penthouse.com/pets/pet-of-the-month-june-2002-victoria/, další';
    assert.equal(odkazCasopisu(t)?.vydani, '2002-06@PH');
    assert.equal(odkazCasopisu('https://drive.google.com/file/d/abc/view'), null);
});

test('Popis odkazu pro oznámení', () => {
    assert.equal(popisOdkazuCasopisu(rozpoznatAdresu('https://www.penthouse.com/pets/pet-of-the-month-june-2002-victoria/')), 'Penthouse, červen 2002');
    assert.equal(popisOdkazuCasopisu(rozpoznatAdresu('https://www.playboy.com/read/playmate-1994-10')), 'Playboy, říjen 1994');
    assert.equal(popisOdkazuCasopisu(rozpoznatAdresu('https://penthousemagazine.com/2019-pet-of-the-year-gianna-dior/')), 'Penthouse, 2019');
    assert.equal(popisOdkazuCasopisu(rozpoznatAdresu('https://penthouse.com/pets/brooke-tilli/')), 'Penthouse');
});
