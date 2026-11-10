// Rok ve sbírce (app/rok-ve-sbirce.js): co se dá z modelek spočítat v okně – nové modelky roku, dokončené ročníky,
// nejaktivnější měsíc – a strany režimu čtení (lib/casopis.js) z celého přehledu. Fotky, alba, čísla, dny práce
// a nejlepší fotky počítá backend (rok_ve_sbirce.go).
import { MESICE, ciselRocniku, priponaRocniku, nazevVydani, rozlozitVydani, sklonovat } from './format.js';
import { udajeModelky } from './casopis.js';

const rokTextu = t => parseInt(String(t || '').slice(0, 4)) || 0;
const cislo = n => Number(n || 0).toLocaleString('cs-CZ');

/**
 * Modelky přidané v roce, nejlépe hodnocené první (pak s víc fotkami)
 * @param {any[]} modelky
 * @param {number} rok
 */
export function noveModelky(modelky, rok) {
    return modelky.filter(m => rokTextu(m.pridano) === rok)
        .sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || (b.pocetFotek || 0) - (a.pocetFotek || 0) || String(a.pridano).localeCompare(String(b.pridano)));
}

/**
 * Ročníky řad (Playboy US a CZ, Penthouse US…), které mají centerfold ve všech vyšlých měsících a poslední chybějící
 * modelka přibyla v roce
 * (podle data přidání modelky). Od nejstaršího ročníku.
 * @param {any[]} modelky
 * @param {number} rok
 * @returns {{ edice: string, rocnik: number, cisel: number, posledni: string }[]}
 */
export function dokonceneRocniky(modelky, rok) {
    // edice|ročník → měsíc → nejdřív přidaná modelka s centerfoldem v tom měsíci
    const rocniky = new Map();
    for (const m of modelky) {
        for (const c of m.centerfoldy || []) {
            const v = rozlozitVydani(c);
            // Všechny časopisy (0.02.021): ročník řady („PH/US“) se počítá podle jejích vyšlých čísel
            if (!v || !/^\d\d$/.test(v.mesic)) continue;
            const klic = `${v.edice}|${v.rok}`;
            if (!rocniky.has(klic)) rocniky.set(klic, new Map());
            const mesice = rocniky.get(klic);
            const pridano = String(m.pridano || '');
            const dosud = mesice.get(v.mesic);
            if (!dosud || pridano < dosud.pridano) mesice.set(v.mesic, { pridano, jmeno: m.jmeno });
        }
    }
    const vysledek = [];
    for (const [klic, mesice] of rocniky) {
        const [edice, r] = klic.split('|');
        const cisel = ciselRocniku(parseInt(r), edice);
        if (!cisel || mesice.size < cisel) continue;
        // Ročník je úplný od chvíle, kdy přibyl jeho poslední měsíc
        const posledni = [...mesice.values()].reduce((a, b) => (b.pridano > a.pridano ? b : a));
        if (rokTextu(posledni.pridano) === rok) vysledek.push({ edice, rocnik: parseInt(r), cisel, posledni: posledni.jmeno });
    }
    // Playboy US, CZ, pak řady jiných časopisů abecedně
    const poradiRady = e => (e === 'US' ? '0' : e === 'CZ' ? '1' : `2${e}`);
    return vysledek.sort((a, b) => a.rocnik - b.rocnik || poradiRady(a.edice).localeCompare(poradiRady(b.edice)));
}

/**
 * Měsíc s nejvíc prací: přidané fotky, pak modelky, pak dny práce; -1, když se v roce nic nestalo
 * @param {{ fotek: number, modelek: number, dnu: number }[]} mesice
 */
export function nejaktivnejsiMesic(mesice) {
    let nej = -1;
    mesice.forEach((m, i) => {
        if (!(m.fotek || m.modelek || m.dnu)) return;
        const n = nej >= 0 ? mesice[nej] : null;
        if (!n || m.fotek > n.fotek || (m.fotek === n.fotek && (m.modelek > n.modelek || (m.modelek === n.modelek && m.dnu > n.dnu)))) nej = i;
    });
    return nej;
}

/**
 * Srovnání s loňskem: „o 12 % víc než loni“, „stejně jako loni“; bez loňska prázdné
 * @param {number} letos
 * @param {number} loni
 */
export function protiLoni(letos, loni) {
    if (!loni) return '';
    if (letos === loni) return 'stejně jako loni';
    const p = Math.round(((letos - loni) / loni) * 100);
    if (p === 0) return 'skoro stejně jako loni';
    return p > 0 ? `o ${p} % víc než loni` : `o ${-p} % méně než loni`;
}

// Den RRRR-MM-DD česky: „3. března“
const MESICE_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export function denCesky(den) {
    const [, m, d] = String(den || '').split('-').map(Number);
    return m && d ? `${d}. ${MESICE_GEN[m - 1]}` : '';
}

/**
 * Hlavní čísla roku pro přehled i úvodní stranu časopisu
 * @param {any} data výsledek GetRokVeSbirce
 * @param {any[]} nove noveModelky
 */
export function cislaRoku(data, nove) {
    return /** @type {[string, string][]} */ ([
        ['Modelek', cislo(nove.length)],
        ['Alb', cislo(data.alb)],
        ['Fotek', cislo(data.fotek)],
        ['Čísel', cislo(data.cisel)],
        ['Dní práce', cislo(data.dnuPrace)],
        ['Soubojů', cislo(data.souboju)],
    ].filter(([, v]) => v !== '0'));
}

/**
 * Strany režimu čtení: obálka s nejlepší fotkou roku → rok v číslech → nové modelky → nejlepší fotky
 * → dokončené ročníky a sezóny
 * @param {{ data: any, nove: any[], rocniky: ReturnType<typeof dokonceneRocniky>, jmenaSezon?: Map<number, string> }} vstup
 * @returns {import('./casopis.js').Strana[]}
 */
export function stranyRoku({ data, nove, rocniky, jmenaSezon = new Map() }) {
    const rok = data.rok;
    const fotka = f => ({ url: f.url, rotace: f.rotace || 0 });
    /** @type {import('./casopis.js').Strana[]} */
    const strany = [];
    const titulni = data.nejlepsi[0] || null;
    strany.push({ druh: 'obalka', oddil: 'Obálka', fotky: titulni ? [fotka(titulni)] : [], nadpis: `Rok ${rok} ve sbírce`,
        popisek: [sklonovat(nove.length, 'nová modelka', 'nové modelky', 'nových modelek'), sklonovat(data.fotek, 'fotka', 'fotky', 'fotek')].join(' · ') });

    const nej = nejaktivnejsiMesic(data.mesice);
    const vety = [
        protiLoni(data.fotek, data.fotekLoni) && `Fotek přibylo ${protiLoni(data.fotek, data.fotekLoni)}.`,
        nej >= 0 && `Nejvíc práce: **${MESICE[nej].toLowerCase()}** (${sklonovat(data.mesice[nej].fotek, 'fotka', 'fotky', 'fotek')}).`,
        data.serie?.dni > 1 && `Nejdelší série: **${sklonovat(data.serie.dni, 'den', 'dny', 'dní')} v řadě** (${denCesky(data.serie.od)} – ${denCesky(data.serie.do)}).`,
        data.fotek5 && `Pět srdíček dostalo ${sklonovat(data.fotek5, 'nová fotka', 'nové fotky', 'nových fotek')}.`,
        rocniky.length && `Dokončené ročníky: ${rocniky.map(r => `${r.rocnik}${priponaRocniku(r.edice)}`).join(', ')}.`,
    ].filter(Boolean);
    strany.push({ druh: 'uvod', oddil: 'Rok v číslech', fotky: data.nejlepsi[1] ? [fotka(data.nejlepsi[1])] : [], nadtitulek: `Rok ${rok}`,
        nadpis: 'Rok v číslech', udaje: cislaRoku(data, nove), text: vety.join('\n\n') });

    for (const m of nove.slice(0, 6)) {
        if (!m.coverUrl) continue;
        strany.push({ druh: 'uvod', oddil: 'Nové modelky', fotky: [{ url: m.coverUrl, rotace: 0 }], nadtitulek: 'Nová ve sbírce', nadpis: m.jmeno,
            udaje: udajeModelky(m), text: '', popisek: m.pocetFotek ? sklonovat(m.pocetFotek, 'fotka', 'fotky', 'fotek') : '',
            vyrez: { x: m.coverX ?? 50, y: m.coverY ?? 50 } });
    }
    for (const f of data.nejlepsi.slice(titulni ? 1 : 0)) {
        strany.push({ druh: 'foto', oddil: 'Nejlepší fotky roku', fotky: [fotka(f)],
            popisek: [f.jmeno, f.vydani ? nazevVydani(f.vydani) : f.album, '♥'.repeat(f.hodnoceni)].filter(Boolean).join(' · ') });
    }
    const zaver = [
        ...rocniky.map(r => `- Ročník **${r.rocnik}**${priponaRocniku(r.edice)} je celý – ${sklonovat(r.cisel, 'centerfold', 'centerfoldy', 'centerfoldů')}, poslední přibyla ${r.posledni}.`),
        ...(data.sezony || []).filter(s => s.favoritka).map(s => `- ${s.nazev || s.kratky || s.klic}: Favoritka **${jmenaSezon.get(s.favoritka) || '?'}**${s.milacek && jmenaSezon.get(s.milacek) ? `, Miláček ${jmenaSezon.get(s.milacek)}` : ''}.`),
    ];
    if (zaver.length) strany.push({ druh: 'clanek', oddil: 'Dokončeno', fotky: [], nadtitulek: `Rok ${rok}`, nadpis: 'Dokončeno a vyhlášeno', autor: '', text: zaver.join('\n'), perex: false, pokracovani: false });
    return strany;
}
