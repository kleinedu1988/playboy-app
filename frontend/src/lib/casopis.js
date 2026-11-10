// Režim čtení (app/casopis.js): pořadí stran čísla nebo profilu modelky jako v časopise. Strany jsou jen data,
// HTML z nich dělá app/casopis.js.
//   obalka  – cover čísla
//   uvod    – dvoustrana: vlevo nadpis, údaje a text, vpravo fotka (Playmate, modelka pictorialu, profil, album)
//   clanek  – text článku (dlouhý se dělí na víc stran po odstavcích)
//   foto    – fotka přes celou stranu (spojený centerfold jako víc fotek vedle sebe)
import { formatDatum, nazevAlba, nazevVydani, titulCisla } from './format.js';

/** @typedef {{ url: string, rotace: number }} FotoStrany */
/** @typedef {{ druh: 'obalka' | 'uvod' | 'clanek' | 'foto', oddil: string, fotky: FotoStrany[], nadpis?: string, nadtitulek?: string,
 *   udaje?: [string, string][], text?: string, autor?: string, perex?: boolean, pokracovani?: boolean, popisek?: string, vyrez?: { x: number, y: number } }} Strana */

const DELKA_STRANY = 1600;

const fotkyPolozky = p => (p?.fotky || []).map(f => ({ url: f.url, rotace: p.rotace || f.rotace || 0 }));

// Text po odstavcích do kusů nejvýš ~delka znaků (odstavec delší než strana zůstane celý)
export function rozdelitText(text, delka = DELKA_STRANY) {
    const odstavce = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(o => o.trim()).filter(Boolean);
    const kusy = [];
    let kus = '';
    for (const o of odstavce) {
        if (kus && kus.length + o.length > delka) {
            kusy.push(kus);
            kus = '';
        }
        kus = kus ? `${kus}\n\n${o}` : o;
    }
    if (kus) kusy.push(kus);
    return kusy;
}

// Údaje modelky pro úvodní stranu
export function udajeModelky(m) {
    if (!m) return [];
    const miry = m.obvodHrudnikCm && m.obvodPasCm && m.obvodBokyCm ? `${m.obvodHrudnikCm}-${m.obvodPasCm}-${m.obvodBokyCm}` : m.miry;
    return /** @type {[string, string][]} */ ([
        ['Narozena', [m.narozeniDatum ? formatDatum(m.narozeniDatum) : '', m.narozeniMisto].filter(Boolean).join(', ')],
        ['Národnost', m.narodnost],
        ['Výška', m.vyskaCm ? `${m.vyskaCm} cm` : ''],
        ['Míry', miry],
        ['Vlasy', m.vlasyBarva],
        ['Oči', m.ociBarva],
    ].filter(([, v]) => v));
}

function stranyClanku(c, oddil) {
    const kusy = rozdelitText(c.text);
    /** @type {Strana[]} */
    const strany = kusy.map((text, i) => ({ druh: 'clanek', oddil, fotky: [], nadpis: c.nazev, nadtitulek: c.rubrika || 'Článek', autor: i ? '' : c.autor || '',
        text, perex: i === 0, pokracovani: i > 0 }));
    if (!strany.length) strany.push({ druh: 'clanek', oddil, fotky: [], nadpis: c.nazev, nadtitulek: c.rubrika || 'Článek', autor: c.autor || '', text: '', perex: false, pokracovani: false });
    (c.skenyUrl || []).forEach((url, i) => strany.push({ druh: 'foto', oddil, fotky: [{ url, rotace: 0 }], popisek: `${c.nazev} · sken ${i + 1}` }));
    return strany;
}

/**
 * Číslo: obálka → Playmate měsíce → další modelky → rozhovor a články → fotky
 * @param {{ vydani: string, alba: any[], clanky?: any[], modelky?: any[], info?: any }} data alba ze sestavitAlba
 * @returns {Strana[]}
 */
export function stranyCisla({ vydani, alba, clanky = [], modelky = [], info = null }) {
    const podleId = new Map(modelky.map(m => [m.id, m]));
    const covery = alba.filter(a => a.typ === 'Cover');
    const centerfoldy = alba.filter(a => a.typ === 'Centerfold');
    const ostatni = alba.filter(a => a.typ !== 'Cover' && a.typ !== 'Centerfold');
    const nazev = nazevVydani(vydani);
    /** @type {Strana[]} */
    const strany = [];
    const pouzite = new Set();
    for (const a of covery) for (const p of a.polozky) {
        pouzite.add(p);
        strany.push({ druh: 'obalka', oddil: 'Obálka', fotky: fotkyPolozky(p), nadpis: nazev, popisek: info?.jmenoObalky || info?.naObalce || a.jmenoModelky || '' });
    }
    const uvod = (a, nadtitulek, oddil) => {
        const p = a.polozky[0];
        if (p) pouzite.add(p);
        const m = podleId.get(a.modelkaId);
        strany.push({ druh: 'uvod', oddil, fotky: fotkyPolozky(p), nadtitulek, nadpis: a.jmenoModelky || m?.jmeno || nazevAlba(a.album, a.typ),
            udaje: udajeModelky(m), text: a.popis || '', popisek: a.fotograf ? `Foto ${a.fotograf}` : '' });
    };
    centerfoldy.forEach(a => uvod(a, `${titulCisla(vydani)} · ${nazev}`, titulCisla(vydani)));
    ostatni.forEach(a => uvod(a, a.typ === 'Pictorial' ? 'Pictorial' : a.typ, 'Další modelky'));
    [...clanky].sort((x, y) => (x.strana || 999) - (y.strana || 999)).forEach(c => strany.push(...stranyClanku(c, 'Články')));
    for (const a of [...covery, ...centerfoldy, ...ostatni]) for (const p of a.polozky) {
        if (pouzite.has(p)) continue;
        strany.push({ druh: 'foto', oddil: 'Fotky', fotky: fotkyPolozky(p), popisek: `${a.jmenoModelky || ''} · ${a.typ}`.replace(/^ · /, '') });
    }
    return strany;
}

/**
 * Profil modelky: úvod (titulní fotka, údaje, poznámka) → články o ní → každé album (úvod alba a jeho fotky)
 * @param {{ modelka: any, titulni?: string, alba: any[], clanky?: any[] }} data
 * @returns {Strana[]}
 */
export function stranyProfilu({ modelka, titulni = '', alba, clanky = [] }) {
    /** @type {Strana[]} */
    const strany = [{ druh: 'uvod', oddil: modelka.jmeno, fotky: titulni ? [{ url: titulni, rotace: 0 }] : fotkyPolozky(alba[0]?.polozky[0]),
        nadtitulek: 'Profil', nadpis: modelka.jmeno, udaje: udajeModelky(modelka), text: modelka.poznamka || '',
        vyrez: { x: modelka.coverX ?? 50, y: modelka.coverY ?? 50 } }];
    clanky.forEach(c => strany.push(...stranyClanku(c, 'Články')));
    for (const a of alba) {
        const [prvni, ...dalsi] = a.polozky;
        if (!prvni) continue;
        const kde = [a.vydani ? nazevVydani(a.vydani) : '', a.fotograf ? `Foto ${a.fotograf}` : ''].filter(Boolean).join(' · ');
        strany.push({ druh: 'uvod', oddil: nazevAlba(a.album, a.typ), fotky: fotkyPolozky(prvni), nadtitulek: a.typ, nadpis: nazevAlba(a.album, a.typ),
            udaje: [], text: a.popis || '', popisek: kde });
        dalsi.forEach(p => strany.push({ druh: 'foto', oddil: nazevAlba(a.album, a.typ), fotky: fotkyPolozky(p), popisek: nazevAlba(a.album, a.typ) }));
    }
    return strany;
}

// Interval prezentace: 3 / 5 / 10 s, jinak vypnuto (0)
export const INTERVALY = [0, 3, 5, 10];
export const platnyInterval = s => (INTERVALY.includes(Number(s)) ? Number(s) : 0);

// Chytrý výběr jako časopis (1.52): modelka = úvodní strana s titulní fotkou a údaji, fotka = celá strana.
// obrazek(url) = adresa velké fotky
export function stranyVyberu({ nazev, modelky = [], fotky = [], obrazek = u => u }) {
    /** @type {Strana[]} */
    const strany = [];
    for (const m of modelky) {
        if (!m?.coverUrl) continue;
        strany.push({ druh: 'uvod', oddil: nazev, fotky: [{ url: obrazek(m.coverUrl), rotace: 0 }], nadtitulek: nazev, nadpis: m.jmeno,
            udaje: udajeModelky(m), text: '', vyrez: { x: m.coverX ?? 50, y: m.coverY ?? 50 } });
    }
    for (const f of fotky) {
        if (!f?.url) continue;
        strany.push({ druh: 'foto', oddil: nazev, fotky: [{ url: obrazek(f.url), rotace: f.rotace || 0 }], popisek: f.jmenoModelky || '' });
    }
    return strany;
}
