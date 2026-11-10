// Odkazy [[…]] v textech sbírky (zminky.go dělá totéž na straně Go): [[Jméno modelky]], [[06/1995]] (i [[1995-06]],
// [[06/1995 DE]], jiný časopis [[09/1985@PH]], [[09/1985 UK@PH]], [[1985-09@PH]]), [[Fotograf]], volitelně
// s popiskem [[cíl|popisek]]
import { MESICE, bezDiakritiky, nazevVydani, rozlozitVydani } from './format.js';

export const VZOR_ODKAZU = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;

const jednoduse = t => bezDiakritiky(String(t || '')).toLowerCase().replace(/\s+/g, ' ').trim();

// Klíč vydání z odkazu („06/1995“ → „1995-06“, „06/1995 DE“ → „1995-06-DE“, „09/1985 UK@PH“ → „1985-09-UK@PH“);
// '' = není číslo
export function vydaniZOdkazu(text) {
    const t = String(text || '').trim();
    let rok, mesic, edice, casopis;
    let s = /^(\d{1,2})\s*\/\s*(\d{4})(?:[\s-]+([A-Za-z]{2}))?(?:\s*@\s*([A-Za-z]{2}))?$/.exec(t);
    if (s) {
        const m = parseInt(s[1]);
        if (m < 1 || m > 12) return '';
        [rok, mesic, edice, casopis] = [s[2], String(m).padStart(2, '0'), s[3], s[4]];
    } else if ((s = /^(\d{4})-(\d{2}|S\d{2})(?:-([A-Za-z]{2}))?(?:@([A-Za-z]{2}))?$/.exec(t))) {
        [rok, mesic, edice, casopis] = [s[1], s[2], s[3], s[4]];
        const m = parseInt(mesic);
        if (!mesic.startsWith('S') && (m < 1 || m > 12)) return '';
    } else return '';
    edice = (edice || '').toUpperCase();
    casopis = (casopis || '').toUpperCase();
    return `${rok}-${mesic}${!edice || edice === 'US' ? '' : `-${edice}`}${!casopis || casopis === 'PB' ? '' : `@${casopis}`}`;
}

// Zápis čísla v odkazu: „1995-06“ → „06/1995“, „1995-06-DE“ → „06/1995 DE“ (speciál zůstane jako klíč)
export function odkazNaVydani(vydani) {
    const c = rozlozitVydani(vydani);
    if (!c || !/^\d{2}$/.test(c.mesic)) return vydani;
    return `${c.mesic}/${c.rok}${c.zeme !== 'US' ? ` ${c.zeme}` : ''}${c.casopis !== 'PB' ? `@${c.casopis}` : ''}`;
}

/**
 * Cíl odkazu: číslo, modelka sbírky (jméno nebo další jméno bez diakritiky), fotograf, jinak hledání
 * @returns {{ druh: 'vydani', vydani: string } | { druh: 'modelka', id: number } | { druh: 'fotograf', jmeno: string } | { druh: 'hledat', text: string }}
 */
export function cilOdkazu(text, modelky = [], fotografove = []) {
    const vydani = vydaniZOdkazu(text);
    if (vydani) return { druh: 'vydani', vydani };
    const j = jednoduse(text);
    const m = modelky.find(x => jednoduse(x.jmeno) === j)
        || modelky.find(x => String(x.dalsiJmena || '').split(',').some(d => jednoduse(d) === j && j));
    if (m) return { druh: 'modelka', id: m.id };
    const f = fotografove.find(x => jednoduse(x) === j);
    if (f) return { druh: 'fotograf', jmeno: f };
    return { druh: 'hledat', text: String(text || '').trim() };
}

/**
 * Návrhy pro našeptávač po „[[“: modelky, čísla (podle „06/1995“, „1995“, „červen 1995“) a fotografové
 * @returns {{ text: string, popis: string, druh: string }[]}
 */
export function navrhyOdkazu(slovo, { modelky = [], vydani = [], fotografove = [] } = {}, nejvic = 8) {
    const s = jednoduse(slovo);
    if (!s) return modelky.slice(0, nejvic).map(m => ({ text: m.jmeno, popis: 'modelka', druh: 'modelka' }));
    const v = [];
    const zacina = t => jednoduse(t).split(/[\s-]+/).some(cast => cast.startsWith(s)) || jednoduse(t).startsWith(s);
    for (const m of modelky) {
        if (zacina(m.jmeno)) v.push({ text: m.jmeno, popis: 'modelka', druh: 'modelka', p: jednoduse(m.jmeno).startsWith(s) ? 0 : 1 });
        else if (String(m.dalsiJmena || '').split(',').some(d => d.trim() && zacina(d))) v.push({ text: m.jmeno, popis: `modelka (${m.dalsiJmena})`, druh: 'modelka', p: 2 });
    }
    if (/\d/.test(s) || MESICE.some(m => jednoduse(m).startsWith(s.split(' ')[0]))) {
        for (const klic of vydani) {
            const zapis = odkazNaVydani(klic);
            const nazev = nazevVydani(klic);
            if (jednoduse(zapis).startsWith(s) || jednoduse(klic).startsWith(s) || jednoduse(nazev).includes(s) || (s.length === 4 && klic.startsWith(s)))
                v.push({ text: zapis, popis: `číslo ${nazev}`, druh: 'vydani', p: 3 });
        }
    }
    for (const f of fotografove) if (zacina(f)) v.push({ text: f, popis: 'fotograf', druh: 'fotograf', p: 4 });
    return v.sort((a, b) => a.p - b.p || a.text.localeCompare(b.text, 'cs')).slice(0, nejvic).map(({ text, popis, druh }) => ({ text, popis, druh }));
}
