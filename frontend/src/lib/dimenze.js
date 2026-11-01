// Rozměry filtru (dimenze): co se dá u položky filtrovat, jak se jmenuje příkaz v hledání a jaké hodnoty položka má.
// Používá je model filtru (lib/filtr.js) pro vyhodnocení, počty u hodnot (fasety) a štítky. Klíče a aliasy odpovídají
// příkazům hledání v backendu (hledani.go, klicePoleHledani), aby text dotazu znamenal všude totéž.
import { kategorieModelky, rozlozitVydani, vyskytModelky } from './format.js';

// typ: 'text' (hledá se část textu: vlasy:blond najde i „strawberry blond“), 'cislo' (porovnání a rozsahy),
// 'srdicka' (po polovinách), 'anone' (ano / ne); hodnoty(m) = hodnoty položky k zobrazení (fasety, štítky)
const VYSKYT_SLOVA = { casopis: 'časopis', online: 'online', '': 'neurčeno' };
const seznam = text => String(text || '').split(',').map(s => s.trim()).filter(Boolean);
const edice = cisla => [...new Set(cisla.map(v => rozlozitVydani(v)?.edice).filter(Boolean))];
const roky = cisla => [...new Set(cisla.map(v => String(v || '').slice(0, 4)).filter(r => /^\d{4}$/.test(r)))];
const anoNe = h => h === 1 ? ['ano'] : h === 0 ? ['ne'] : [];

export const DIMENZE_MODELEK = [
    { klic: 'hodnoceni', aliasy: ['srdicka'], nazev: 'Srdíčka', typ: 'srdicka', hodnoty: m => m.hodnoceni > 0 ? [String(m.hodnoceni)] : [] },
    { klic: 'edice', nazev: 'Edice', typ: 'text', hodnoty: m => edice([...(m.vydani || []), ...(m.obalky || [])]) },
    { klic: 'kategorie', aliasy: ['role'], nazev: 'Kategorie', typ: 'text', hodnoty: m => kategorieModelky(m).map(k => k.nazev) },
    // Slova jako v backendu (hledani.go, vyskytKHledani), aby vyskyt:časopis našel totéž v galerii i v počtech
    { klic: 'vyskyt', nazev: 'Výskyt', typ: 'text', hodnoty: m => [VYSKYT_SLOVA[vyskytModelky(m)]] },
    { klic: 'vlasy', nazev: 'Vlasy', typ: 'text', hodnoty: m => [m.vlasyBarva].filter(Boolean) },
    { klic: 'oci', nazev: 'Oči', typ: 'text', hodnoty: m => [m.ociBarva].filter(Boolean) },
    { klic: 'narodnost', nazev: 'Národnost', typ: 'text', hodnoty: m => [m.narodnost].filter(Boolean) },
    { klic: 'tag', aliasy: ['tagy'], nazev: 'Tagy', typ: 'text', hodnoty: m => seznam(m.tags) },
    { klic: 'rok', nazev: 'Rok vydání', typ: 'cislo', rok: true, hodnoty: m => roky(m.vydani || []) },
    { klic: 'narozena', nazev: 'Rok narození', typ: 'cislo', rok: true, hodnoty: m => roky([m.narozeniDatum]) },
    { klic: 'vyska', nazev: 'Výška', typ: 'cislo', hodnoty: m => m.vyskaCm > 0 ? [String(m.vyskaCm)] : [] },
    { klic: 'vaha', nazev: 'Váha', typ: 'cislo', hodnoty: m => m.vahaKg > 0 ? [String(m.vahaKg)] : [] },
    { klic: 'tetovani', nazev: 'Tetování', typ: 'anone', hodnoty: m => anoNe(m.tetovani) },
    { klic: 'piercing', nazev: 'Piercing', typ: 'anone', hodnoty: m => anoNe(m.piercing) },
];

// Volný text dotazu (bez příkazu) se hledá ve jménu, pseudonymech a v hodnotách všech dimenzí
export const textyModelky = m => [m.jmeno, m.dalsiJmena, ...DIMENZE_MODELEK.flatMap(d => d.hodnoty(m))];
