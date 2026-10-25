// Zápis údajů z Údržby na místě (Po údajích i Po modelkách): kopie polí formuláře modelky (doplneni.js) do modelky
// se stejnými převody a kontrolami jako formulář, jedno UpdateModelka s celou modelkou. Návrh uložený s jinou
// hodnotou si zapamatuje učení (ZaznamenatOpravu), nezměněný se přijme (PrijmoutNavrh).
import { UpdateModelka } from './backend';
import { platneDatum } from '../lib/format';
import { stav } from './stav';
import { vsechnyModelky } from './mezipamet';
import { odkazJeVPoradku } from './navigace';
import { zapsatPole } from './doplneni';
import { poleModelky } from './formular-modelky';
import { oznamit } from '../ui/oznameni';
import * as navrhy from './navrhy';
import * as uceni from './uceni';

export const vlastnostPole = id => poleModelky.find(p => p[1] === id)?.[0];
const typPole = id => poleModelky.find(p => p[1] === id)?.[2] || 'text';

// Hodnota údaje modelky do pole (nula číselného pole je prázdné pole, výběr ano/ne potřebuje i nulu)
export function hodnotaModelky(modelka, inputId) {
    const v = modelka?.[vlastnostPole(inputId)];
    if (document.getElementById(inputId)?.tagName === 'SELECT') return v === undefined || v === null ? '' : String(v);
    if (typPole(inputId) === 'cislo') return v ? String(v) : '';
    return String(v ?? '');
}

// Hodnota pole s návrhem: kategorie se k zapsaným přidává (jako při přijetí návrhu), ostatní se nahradí
export function hodnotaNavrhuPole(modelka, n) {
    const soucasna = hodnotaModelky(modelka, n.inputId).trim();
    return n.inputId === 'inputRole' && soucasna ? `${soucasna.replace(/[,;]+$/, '')}, ${n.hodnota}` : String(n.hodnota ?? '');
}

// Kontrola polí před uložením bez backendu (datum); vrací chybu slovy, nebo ''
export function chybaPoli(prvky) {
    const datum = prvky.find(p => (p.dataset.pole === 'inputNarozeniDatum' || p.dataset.pole === 'inputUmrtiDatum') && !platneDatum(p.value));
    return datum ? `Datum ${datum.dataset.pole === 'inputUmrtiDatum' ? 'úmrtí' : 'narození'} napiš jako RRRR-MM-DD, RRRR-MM nebo jen rok RRRR.` : '';
}

/**
 * Změněná pole do modelky; vrací, zda se povedlo. navrh(prvek) = návrh, který pole doplňovalo (oprava se zapamatuje).
 * @param {number} modelkaId
 * @param {HTMLInputElement[]} prvky
 * @param {{ navrh?: (prvek: HTMLInputElement) => any, zamerit?: (pole: string) => void }} [moznosti]
 */
export async function ulozitPoleModelky(modelkaId, prvky, { navrh = () => null, zamerit = () => {} } = {}) {
    const mistni = stav.prehledModelky.get(modelkaId) || (await vsechnyModelky()).find(m => m.id === modelkaId);
    if (!mistni) return false;
    const modelka = { ...mistni };
    zapsatPole(prvky, modelka, { prazdne: true });
    const velikost = prvky.find(p => p.dataset.velikost)?.dataset.velikost;
    if (velikost && !modelka.velikostPrsou) modelka.velikostPrsou = velikost;
    const chyba = (pole, text) => {
        zamerit(pole);
        oznamit(text);
        return false;
    };
    for (const [vlastnost, pole, nazev] of [['narozeniDatum', 'inputNarozeniDatum', 'narození'], ['umrtiDatum', 'inputUmrtiDatum', 'úmrtí']]) {
        if (!platneDatum(modelka[vlastnost])) return chyba(pole, `Datum ${nazev} napiš jako RRRR-MM-DD, RRRR-MM nebo jen rok RRRR.`);
    }
    if (modelka.narozeniDatum && modelka.umrtiDatum && modelka.umrtiDatum.slice(0, modelka.narozeniDatum.length) < modelka.narozeniDatum.slice(0, modelka.umrtiDatum.length)) {
        return chyba('inputUmrtiDatum', 'Datum úmrtí je před datem narození.');
    }
    if (prvky.some(p => p.dataset.pole === 'inputDriveID') && !await odkazJeVPoradku(modelka.coverId)) return chyba('inputDriveID', 'Titulní fotka: odkaz se neuložil.');
    let ok = false;
    try {
        ok = await UpdateModelka(modelka);
    } catch { /* oznámí se níž */ }
    if (!ok) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return false;
    }
    prvky.forEach(p => {
        const n = navrh(p);
        if (n) uceni.zaznamenatOpravuNavrhu(n, modelka[vlastnostPole(p.dataset.pole)]);
        p.dataset.puvodni = p.value;
    });
    // Místní data Přehledu: fronta se přepočítá hned, bez čekání na nové načtení
    Object.assign(mistni, modelka);
    return true;
}

// Návrh v poli: nezměněná hodnota se přijme (PrijmoutNavrh), změněná se uloží jako údaj a zapamatuje jako oprava.
// Vrací, zda se uložilo (prázdné pole nic neuloží).
export async function ulozitNavrh(n, pole, jmeno, { zamerit = (_pole) => {} } = {}) {
    const modelka = stav.prehledModelky.get(n.modelkaId);
    if (!pole || pole.value.trim() === hodnotaNavrhuPole(modelka, n).trim()) return navrhy.prijmout(n);
    if (!pole.value.trim()) {
        oznamit('Pole je prázdné: napiš hodnotu, nebo návrh odmítni.');
        zamerit(n.inputId);
        return false;
    }
    if (!await ulozitPoleModelky(n.modelkaId, [pole], { navrh: () => n, zamerit })) return false;
    oznamit(`Uloženo s opravou: ${n.popis || n.pole} „${pole.value.trim()}“ – ${jmeno}.`);
    // Opravený návrh backend už nenabídne; z fronty zmizí hned
    navrhy.odebratOpraveny(n);
    return true;
}
