// Návrhy doplnění v Údržbě: chybějící údaje, které program odhadne z vlastní sbírky (národnost z místa narození,
// velikost prsou z měr, vydání alba, fotograf…). Návrh jde přijmout (rovnou se uloží), upravit ve formuláři
// s předvyplněnou hodnotou, nebo odmítnout (tahle hodnota se už nenabízí; se „zobrazit i odmítnuté“ jde vrátit).
// Tady jsou data a akce; řádky vykresluje Údržba (udrzba.js) stejně jako ostatní položky fronty.
import { GetNavrhyDoplneni, OdmitnoutNavrh, PrijmoutNavrh, PrijmoutNavrhy, UpdateModelka } from './backend';
import { sklonovat } from '../lib/format';
import { MEZ_JISTE, hodnotaNavrhu, idNavrhu, nazevNavrhu, zalozkaPole } from '../lib/udrzba';
import { stav } from './stav';
import { vsechnyModelky } from './mezipamet';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { otevritModelModal, poleModelky, potvrdit, predvyplnitPole, ukazatZalozku, zameritPole } from './formular-modelky';
import { otevritAlbumModal, predvyplnitVydaniAlba } from './formular-alba';
import { cekatNaOpravu } from './uceni';
import { oznamit } from '../ui/oznameni';

// Návrh z backendu; zdroj a jeho popis přidává učení (do vygenerovaných typů přibudou po sloučení s backendem)
/** @typedef {import('../../wailsjs/go/models').main.NavrhDoplneni} NavrhDoplneni */

/** @type {NavrhDoplneni[]} */
let navrhy = [];
// Backend návrhy neumí nebo selhal: Údržba funguje dál bez nich
let nedostupne = false;
// Návrhy, které se právě ukládají (dvojí Enter nesmí přijmout dvakrát)
const zpracovavane = new Set();
// Co udělat po změně návrhů (Údržba se překreslí na místě); nastaví udrzba.js
let poZmene = (/** @type {string} */ _fokus) => {};
export const nastavitObnoveni = fn => { poZmene = fn; };

const aktivni = () => navrhy.filter(n => !n.odmitnuto);
export const seznamNavrhu = () => navrhy;
export const navrhyNedostupne = () => nedostupne;
export const pocetNavrhu = () => aktivni().length;
export const maNavrhy = () => navrhy.length > 0;
export const pocetJistych = () => aktivni().filter(n => n.jistota >= MEZ_JISTE).length;

const textNavrhu = n => `${nazevNavrhu(n)} „${hodnotaNavrhu(n)}“`;
const doplneno = n => n === 1 ? 'Doplněn 1 údaj' : n > 1 && n < 5 ? `Doplněny ${n} údaje` : `Doplněno ${n} údajů`;
const nNavrhu = n => sklonovat(n, 'návrh', 'návrhy', 'návrhů');
// Souhrn polí do potvrzení: „národnost (6), etnicita (4)“
const souhrnPoli = seznam => [...seznam.reduce((m, n) => m.set(nazevNavrhu(n), (m.get(nazevNavrhu(n)) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]).map(([pole, pocet]) => `${pole} (${pocet})`).join(', ');

// Načte návrhy i s odmítnutými (počet odmítnutých je u přepínače, vrácení je bez nového načtení); volá nacistPrehled
export async function nacistNavrhy() {
    try {
        navrhy = (await GetNavrhyDoplneni(true)) || [];
        nedostupne = false;
    } catch {
        navrhy = [];
        nedostupne = true;
    }
}

// Přijme návrhy; víc najednou v jedné transakci se zálohou (PrijmoutNavrhy). Vrací ty, které se uložily.
async function ulozit(seznam) {
    seznam = seznam.filter(n => !zpracovavane.has(n));
    if (!seznam.length) return [];
    seznam.forEach(n => zpracovavane.add(n));
    let prijate = [];
    try {
        if (seznam.length > 1) {
            try {
                await PrijmoutNavrhy(seznam);
            } catch { /* co se neuložilo, zůstane v seznamu */ }
            // Uložené návrhy backend už nevrací; když nejde ani načíst, nepovažuje se nic za uložené
            const zbyle = new Set(((await GetNavrhyDoplneni(true).catch(() => null)) || seznam).map(idNavrhu));
            prijate = seznam.filter(n => !zbyle.has(idNavrhu(n)));
        } else {
            try {
                if (await PrijmoutNavrh(seznam[0])) prijate = seznam;
            } catch { /* nepřijatý zůstane v seznamu */ }
        }
    } finally {
        seznam.forEach(n => zpracovavane.delete(n));
    }
    navrhy = navrhy.filter(n => !prijate.includes(n));
    prijate.forEach(zapsatMistne);
    return prijate;
}

// Přijatá hodnota do místních modelek Přehledu: Údržba se překreslí hned (bez čekání na nové načtení) a údaj
// u modelky už nesmí hlásit jako chybějící. Kategorie se k zapsaným přidává jako v backendu (zapsatNavrh).
function zapsatMistne(n) {
    const vlastnost = !n.album && vlastnostPole(n.inputId);
    const m = vlastnost && stav.prehledModelky.get(n.modelkaId);
    if (!m) return;
    if (typeof m[vlastnost] === 'number') m[vlastnost] = Number(n.hodnota) || 0;
    else if (vlastnost === 'role' && String(m.role || '').trim()) m.role = `${String(m.role).trim().replace(/[,;]+$/, '')}, ${n.hodnota}`;
    else m[vlastnost] = n.hodnota;
}

// Vlastnost modelky podle pole formuláře (vrácení přijatého návrhu)
const vlastnostPole = inputId => poleModelky.find(p => p[1] === inputId)?.[0];

export async function prijmout(n) {
    // Původní hodnotu údaje modelky jde po přijetí vrátit; u alba se vrácení nenabízí
    const vlastnost = !n.album && vlastnostPole(n.inputId);
    const puvodni = vlastnost ? stav.prehledModelky.get(n.modelkaId)?.[vlastnost] : undefined;
    if (!(await ulozit([n])).length) {
        oznamit(`Návrh se nepodařilo uložit: ${textNavrhu(n)}.`);
        return;
    }
    poZmene(idNavrhu(n));
    oznamit(`Doplněno: ${textNavrhu(n)} – ${n.jmeno}.`, vlastnost && puvodni !== undefined ? { text: 'Vrátit', akce: () => vratitPrijeti(n, vlastnost, puvodni) } : null);
}

async function vratitPrijeti(n, vlastnost, puvodni) {
    const modelka = (await vsechnyModelky()).find(m => m.id === n.modelkaId);
    if (!modelka || !await UpdateModelka({ ...modelka, [vlastnost]: puvodni })) {
        oznamit('Údaj se nepodařilo vrátit.');
        return;
    }
    // Návrh se vrátí do seznamu hned (backend ho při příštím načtení nabídne znovu)
    navrhy = [...navrhy, n];
    const m = stav.prehledModelky.get(n.modelkaId);
    if (m) m[vlastnost] = puvodni;
    poZmene(idNavrhu(n));
    oznamit(`Vráceno: ${nazevNavrhu(n)} – ${n.jmeno} má zase původní hodnotu.`);
}

// Návrh, který soustředěný režim uložil s opravenou hodnotou: backend ho už nenabídne, ze seznamu zmizí hned
export function odebratOpraveny(n) {
    navrhy = navrhy.filter(x => x !== n && idNavrhu(x) !== idNavrhu(n));
    poZmene('');
}

async function nastavitOdmitnuti(seznam, odmitnout = true) {
    const zmenene = [];
    for (const n of seznam) {
        try {
            if (await OdmitnoutNavrh(n, odmitnout)) {
                n.odmitnuto = odmitnout;
                zmenene.push(n);
            }
        } catch { /* zůstane, jak byl */ }
    }
    return zmenene;
}

export async function odmitnout(n) {
    if (!(await nastavitOdmitnuti([n])).length) {
        oznamit('Návrh se nepodařilo odmítnout.');
        return;
    }
    poZmene(idNavrhu(n));
    oznamit(`Odmítnuto: ${textNavrhu(n)}. Tahle hodnota se už nebude nabízet.`, { text: 'Vrátit', akce: () => vratitOdmitnuti([n]) });
}

export async function vratitOdmitnuti(seznam) {
    const vracene = await nastavitOdmitnuti(seznam, false);
    if (!vracene.length) {
        oznamit('Návrh se nepodařilo vrátit.');
        return;
    }
    poZmene(idNavrhu(vracene[0]));
    if (vracene.length > 1 || !stav.prehledSkryte) oznamit(vracene.length > 1 ? `Vráceno ${nNavrhu(vracene.length)}.` : `Návrh se zase nabízí: ${textNavrhu(vracene[0])}.`);
}

// Přijetí víc návrhů najednou: zeptá se, vypíše, co se doplní, a upozorní na nejisté
export async function prijmoutVice(seznam, nadpis = 'Přijmout návrhy?') {
    seznam = seznam.filter(n => !n.odmitnuto);
    if (!seznam.length) return;
    if (seznam.length === 1) return prijmout(seznam[0]);
    const modelek = new Set(seznam.map(n => n.modelkaId)).size;
    const nejistych = seznam.filter(n => n.jistota < MEZ_JISTE).length;
    if (!await potvrdit(nadpis,
        `Uloží se ${sklonovat(seznam.length, 'údaj', 'údaje', 'údajů')} u ${sklonovat(modelek, 'modelky', 'modelek', 'modelek')}: ${souhrnPoli(seznam)}.`
        + (nejistych ? ` ${nejistych === 1 ? 'Jeden z nich není jistý' : nejistych < 5 ? `${nejistych} z nich nejsou jisté` : `${nejistych} z nich není jistých`} (pod 90 %).` : '')
        + ' Před uložením se udělá záloha – celé přijetí jde vrátit přes ⋯ → Obnovit ze zálohy; jednotlivé údaje jdou opravit ve formuláři.', `Přijmout ${seznam.length}`)) return;
    const prijate = await ulozit(seznam);
    poZmene('');
    oznamit(prijate.length === seznam.length ? `${doplneno(prijate.length)}.`
        : `Doplněno ${prijate.length} z ${seznam.length}; zbytek se nepodařilo uložit a zůstal v návrzích.`);
}

export const prijmoutUModelky = modelkaId => {
    const seznam = aktivni().filter(n => n.modelkaId === modelkaId);
    return prijmoutVice(seznam, `Přijmout návrhy – ${seznam[0]?.jmeno || ''}?`);
};

// Odmítnutí víc návrhů najednou (s potvrzením od dvou výš); jde vrátit z oznámení
export async function odmitnoutVice(seznam) {
    seznam = seznam.filter(n => !n.odmitnuto);
    if (!seznam.length) return;
    if (seznam.length === 1) return odmitnout(seznam[0]);
    if (!await potvrdit('Odmítnout návrhy?', `Odmítne se ${nNavrhu(seznam.length)}: ${souhrnPoli(seznam)}. Tyhle hodnoty se už nebudou nabízet; vrátit to jde hned v oznámení nebo přes „zobrazit i odmítnuté“.`,
        `Odmítnout ${seznam.length}`, { nebezpecne: true })) return;
    const zmenene = await nastavitOdmitnuti(seznam);
    if (!zmenene.length) return;
    poZmene('');
    oznamit(`Odmítnuto ${nNavrhu(zmenene.length)}.`, { text: 'Vrátit', akce: () => vratitOdmitnuti(zmenene) });
}

// Otevření okna vynuluje příznak změny až po svém dokončení (ulozeni.js); hodnota se proto vloží až potom,
// aby okno vědělo o změně a uživatel jen potvrdil uložením
const poOtevreni = () => new Promise(r => setTimeout(r));

// „Upravit…“: formulář modelky (nebo okno alba) na poli návrhu, s hodnotou předvyplněnou k potvrzení.
// Když uživatel uloží jinou hodnotu, učení si opravu zapamatuje (uceni.js).
export async function upravit(n) {
    const modelka = stav.prehledModelky.get(n.modelkaId) || (await vsechnyModelky()).find(m => m.id === n.modelkaId);
    if (!modelka) return;
    if (!n.album) {
        if (!n.inputId || !document.getElementById(n.inputId)) {
            otevritDetailModelky(modelka);
            return;
        }
        otevritModelModal(modelka);
        ukazatZalozku(zalozkaPole(n.inputId));
        await poOtevreni();
        predvyplnitPole(n.inputId, n.hodnota);
        zameritPole(n.inputId);
        cekatNaOpravu(n);
        return;
    }
    // Album se upravuje v profilu modelky
    await otevritDetailModelky(modelka);
    await nacistFotkyModelky(modelka.id);
    const album = stav.aktualniAlba.find(a => a.album === n.album && a.typ === n.typ);
    if (!album) return;
    otevritAlbumModal(modelka, album);
    await poOtevreni();
    const vydani = n.pole === 'vydani' || n.pole === 'vydaniAlba' || ['selectAlbumMesic', 'selectAlbumSpecial', 'inputAlbumRok'].includes(n.inputId);
    let pole = null;
    if (vydani) pole = predvyplnitVydaniAlba(n.hodnota);
    else if (document.getElementById(n.inputId)) {
        predvyplnitPole(n.inputId, n.hodnota);
        pole = document.getElementById(n.inputId);
    }
    pole?.focus();
    cekatNaOpravu(n);
}

// Položky nabídky návrhu (⋯ na řádku, pravé tlačítko, klávesa nabídky)
export function polozkyNabidky(n) {
    if (n.odmitnuto) return [{ text: 'Vrátit – znovu nabízet', akce: () => vratitOdmitnuti([n]) }];
    const uModelky = aktivni().filter(x => x.modelkaId === n.modelkaId).length;
    return [
        { text: `Přijmout „${hodnotaNavrhu(n)}“`, akce: () => prijmout(n) },
        { text: 'Upravit…', akce: () => upravit(n) },
        { text: 'Odmítnout tuto hodnotu', akce: () => odmitnout(n) },
        ...(uModelky > 1 ? [null, { text: `Přijmout vše u modelky (${uModelky})`, akce: () => prijmoutUModelky(n.modelkaId) }] : []),
    ];
}

// Popis jistoty do nápovědy
export const VYSVETLENI_JISTOTY = {
    jiste: 'u podobných modelek ve sbírce to platí skoro vždy',
    pravdepodobne: 'u podobných modelek to většinou platí, stojí za kontrolu',
    odhad: 'jen odhad podle podobných modelek, raději ověř',
};
