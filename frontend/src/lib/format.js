// Čisté funkce pro texty a data: nesahají na stránku ani na backend, proto jdou testovat samostatně

export const MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

// Edice časopisu; výchozí (US) se do vydání nepíše, ostatní mají příponu: 2009-11-CZ
export const EDICE = ['US', 'CZ'];
export const VYCHOZI_EDICE = 'US';

// „2009-11-CZ" → { rok: '2009', mesic: '11', edice: 'CZ' }; ročník bez měsíce má mesic ''; neplatné → null
export function rozlozitVydani(text) {
    const casti = /^(\d{4})(?:-(0[1-9]|1[0-2]))?(?:-([A-Z]{2}))?$/.exec(text || '');
    return casti ? { rok: casti[1], mesic: casti[2] || '', edice: casti[3] || VYCHOZI_EDICE } : null;
}

export function slozitVydani(rok, mesic, edice) {
    if (!rok) return '';
    return [rok, mesic, edice && edice !== VYCHOZI_EDICE ? edice : ''].filter(Boolean).join('-');
}

// Vydání pro zobrazení: „Listopad 2009", „2012", u jiné než výchozí edice „Listopad 2009 · CZ"
export function nazevVydani(vydani) {
    const v = rozlozitVydani(vydani);
    if (!v) return vydani;
    return (v.mesic ? `${MESICE[parseInt(v.mesic) - 1]} ${v.rok}` : v.rok) + (v.edice !== VYCHOZI_EDICE ? ` · ${v.edice}` : '');
}

// Adresa obrázku v požadované velikosti; šablonu adresy (s {velikost}) skládá backend
export function obrazek(adresa, velikost) {
    return String(adresa || '').replace('{velikost}', velikost);
}

// Album centerfoldu a coveru je uložené jako vydání časopisu; zobrazuje se jako vydání
export function nazevAlba(album, typ) {
    return (typ === 'Centerfold' || typ === 'Cover') && rozlozitVydani(album)?.mesic ? nazevVydani(album) : album;
}

// Ošetření textu vkládaného do HTML
export function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

// RRRR-MM-DD -> D. M. RRRR
export function formatDatum(datum) {
    const casti = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum || '');
    return casti ? `${parseInt(casti[3])}. ${parseInt(casti[2])}. ${casti[1]}` : (datum || '');
}

// Text pro porovnávání: malá písmena bez diakritiky
// Písmena, která se na základní tvar nerozkládají sama (stejně jako v Go)
const ZVLASTNI_PISMENA = { 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'þ': 'th', 'ı': 'i' };
export const bezDiakritiky = text => String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[łøđßæœþı]/g, z => ZVLASTNI_PISMENA[z]);
export const sjednotit = text => bezDiakritiky(text).trim();

// Věk v letech k danému vydání (RRRR-MM), pokud je známé datum narození
export function vekPriVydani(narozeni, vydani) {
    const n = /^(\d{4})-(\d{2})/.exec(narozeni || '');
    const v = /^(\d{4})-(\d{2})/.exec(vydani || '');
    if (!n || !v) return '';
    const vek = parseInt(v[1]) - parseInt(n[1]) - (parseInt(v[2]) < parseInt(n[2]) ? 1 : 0);
    return vek > 0 && vek < 120 ? `${vek} let` : '';
}

// U tetování a piercingu je „ne" (0) vyplněná hodnota, nevyplněno je -1; u ostatních čísel nula znamená prázdné
export function udajChybi(modelka, vlastnost) {
    const hodnota = modelka[vlastnost];
    if (vlastnost === 'tetovani' || vlastnost === 'piercing') return hodnota !== 0 && hodnota !== 1;
    return !hodnota;
}

// Míry z amerických zdrojů. Samotné číslo se bere v centimetrech či kilogramech; null = nerozpoznáno.
// Výška: 5'7", 5′7″, 5 ft 7 in, 170 cm
export function prevestVysku(text) {
    const t = String(text || '').trim().replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t));
    const cm = /^(\d+(?:\.\d+)?)\s*cm$/i.exec(t);
    if (cm) return Math.round(parseFloat(cm[1]));
    const stopy = /^(\d)\s*(?:'|′|ft|feet)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″|''|in|inch|inches)?)?$/i.exec(t);
    if (stopy) return Math.round((parseInt(stopy[1]) * 12 + parseFloat(stopy[2] || 0)) * 2.54);
    return null;
}

// Váha: 115 lbs, 115 lb, 52 kg
export function prevestVahu(text) {
    const t = String(text || '').trim().replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t));
    const kg = /^(\d+(?:\.\d+)?)\s*kg$/i.exec(t);
    if (kg) return Math.round(parseFloat(kg[1]));
    const libry = /^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)$/i.exec(t);
    if (libry) return Math.round(parseFloat(libry[1]) * 0.45359);
    return null;
}

// Míry „34B-24-34" nebo „86-61-86": obvody v centimetrech a velikost prsou.
// Hrudník pod 60 znamená, že jsou všechny tři v palcích.
export function rozlozitMiry(text) {
    const m = /^(\d{2,3})\s*([A-K]{1,3})?\s*[-–/x]\s*(\d{2,3})\s*[-–/x]\s*(\d{2,3})$/i.exec(String(text || '').trim());
    if (!m) return null;
    const palce = parseInt(m[1]) < 60;
    const naCm = n => palce ? Math.round(parseInt(n) * 2.54) : parseInt(n);
    return { hrudnik: naCm(m[1]), pas: naCm(m[3]), boky: naCm(m[4]), velikost: m[2] ? `${m[1]}${m[2].toUpperCase()}` : '' };
}
