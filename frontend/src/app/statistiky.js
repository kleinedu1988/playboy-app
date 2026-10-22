// Statistiky sbírky v Přehledu: jeden graf vybraný z rozvinutého seznamu, vedle něj modelky výběru.
// Grafy v čase (podle roku centerfoldu nebo měsíce přidání) mají sloupce či body jednotlivých modelek a křivku
// (klouzavý průměr nebo medián); klik na sloupec vybere rok, tažení období. Grafy rozložení (kategorie,
// národnosti…) jsou pruhy; klik vybere hodnotu. Seznam vpravo ukazuje modelky výběru (bez výběru všechny v grafu).
// Počítá se ze seznamu modelek; nejčastější fotografové jsou z backendu (GetStatistiky) a jejich modelky se
// dohledají hledáním. SVG grafSloupcu zůstává pro úvod Přehledu.
import { GetModelky, GetStatistiky } from './backend';
import { EDICE, MESICE, VYSKYT, ZKRATKY_PASKY, esc, kategorieModelky, nazevVydani, rozlozitVydani, sjednotit, sklonovat, vyskytModelky } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { otevritDetailModelky } from './profil';
import { hledatHodnotu } from './galerie';

const BARVA = '#d81b60';

const cislo = (n, desetinna = 1) => Number(n.toFixed(desetinna)).toLocaleString('cs-CZ', { maximumFractionDigits: desetinna });
const pocetModelek = n => sklonovat(n, 'modelka', 'modelky', 'modelek');
const pocetCenterfoldu = n => sklonovat(n, 'centerfold', 'centerfoldy', 'centerfoldů');

// Zaoblený jen horní konec sloupce (4 px), dno sedí na ose
const sloupec = (x, y, sirka, vyska) => vyska <= 0 ? ''
    : `M${x},${y + vyska} V${y + Math.min(4, vyska)} q0,-${Math.min(4, vyska)} ${Math.min(4, sirka / 2)},-${Math.min(4, vyska)} h${sirka - 2 * Math.min(4, sirka / 2)} q${Math.min(4, sirka / 2)},0 ${Math.min(4, sirka / 2)},${Math.min(4, vyska)} V${y + vyska}Z`;

// Svislé sloupce jedné řady v SVG (úvod Přehledu); popisek hodnoty jen u maxima, ostatní v bublině
export function grafSloupcu(polozky, { sirka = 460, vyska = 190 } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.hodnota));
    const dole = 22, nahore = 16, krok = sirka / polozky.length, sl = Math.min(30, krok * 0.58);
    const vyskaPlochy = vyska - dole - nahore;
    const mrizka = [0.5, 1].map(f => `<line class="graf-mrizka" x1="0" x2="${sirka}" y1="${nahore + vyskaPlochy * (1 - f)}" y2="${nahore + vyskaPlochy * (1 - f)}"/>`).join('');
    return `<svg class="graf" viewBox="0 0 ${sirka} ${vyska}" role="img">${mrizka}
        <line class="graf-osa" x1="0" x2="${sirka}" y1="${vyska - dole}" y2="${vyska - dole}"/>
        ${polozky.map((p, i) => {
            const v = vyskaPlochy * p.hodnota / max, x = i * krok + (krok - sl) / 2, y = vyska - dole - v;
            return `<g data-tip="${esc(p.tip)}">
                <rect class="graf-cil" x="${i * krok}" y="0" width="${krok}" height="${vyska}"/>
                <path d="${sloupec(x, y, sl, v)}" fill="${BARVA}"/>
                ${p.hodnota === max && p.hodnota ? `<text class="graf-hodnota" x="${x + sl / 2}" y="${y - 6}" text-anchor="middle">${p.hodnota}</text>` : ''}
                <text class="graf-popisek" x="${x + sl / 2}" y="${vyska - 6}" text-anchor="middle">${esc(p.popisek)}</text>
            </g>`;
        }).join('')}</svg>`;
}

// Nabídka grafů: v čase (sloupce nebo body s křivkou) a rozložení (pruhy)
const GRAFY = [
    { klic: 'cf', skupina: 'cas', nazev: 'Centerfoldy podle roku' },
    { klic: 'vek', skupina: 'cas', nazev: 'Věk v době centerfoldu', jednotka: 'let', udaj: (m, c) => c.vekPresne },
    { klic: 'vyska', skupina: 'cas', nazev: 'Výška', jednotka: 'cm', udaj: m => m.vyskaCm || null },
    { klic: 'vaha', skupina: 'cas', nazev: 'Váha', jednotka: 'kg', udaj: m => m.vahaKg || null },
    { klic: 'hrudnik', skupina: 'cas', nazev: 'Obvod hrudníku', jednotka: 'cm', udaj: m => m.obvodHrudnikCm || null },
    { klic: 'pas', skupina: 'cas', nazev: 'Obvod pasu', jednotka: 'cm', udaj: m => m.obvodPasCm || null },
    { klic: 'boky', skupina: 'cas', nazev: 'Obvod boků', jednotka: 'cm', udaj: m => m.obvodBokyCm || null },
    { klic: 'prib', skupina: 'cas', nazev: 'Přibývání sbírky' },
    { klic: 'kat', skupina: 'rozl', nazev: 'Kategorie' },
    { klic: 'nar', skupina: 'rozl', nazev: 'Národnosti' },
    { klic: 'vlasy', skupina: 'rozl', nazev: 'Barva vlasů' },
    { klic: 'oci', skupina: 'rozl', nazev: 'Barva očí' },
    { klic: 'srd', skupina: 'rozl', nazev: 'Hodnocení' },
    { klic: 'vyskyt', skupina: 'rozl', nazev: 'Výskyt (časopis / online)' },
    { klic: 'fot', skupina: 'rozl', nazev: 'Fotografové' },
];
const SKUPINY = { cas: 'V čase', rozl: 'Rozložení' };

// Stav: vybraný graf (pamatuje se), edice centerfoldů a výběr (u grafu v čase rozsah sloupců, jinak hodnota)
let data = null;                 // { s, modelky, podleId, fotografove: Map(nazev → Set id modelek) }
let graf = 'cf';
try { graf = GRAFY.some(g => g.klic === localStorage.getItem('grafStatistik')) ? localStorage.getItem('grafStatistik') : 'cf'; } catch { /* výchozí graf */ }
let edice = 'vse';
let vyber = null;                // { od, do } (indexy sloupců) nebo { hodnota }
let zobrazitVse = false;
let tah = null;                  // tažení přes sloupce: { start, predtim }
const ZOBRAZIT_NAJEDNOU = 60;

// Centerfoldy modelky s rokem, edicí a věkem modelky v době vydání
const vekVLetech = (narozeni, vydani) => {
    const n = /^(\d{4})-(\d{2})/.exec(narozeni || ''), v = /^(\d{4})-(\d{2})/.exec(vydani || '');
    if (!n || !v) return null;
    const vek = parseInt(v[1]) - parseInt(n[1]) - (parseInt(v[2]) < parseInt(n[2]) ? 1 : 0);
    return vek > 12 && vek < 80 ? vek : null;
};
const centerfoldyCache = new WeakMap();
function centerfoldyModelky(m) {
    if (!centerfoldyCache.has(m)) centerfoldyCache.set(m, (m.centerfoldy || []).map(v => {
        const casti = rozlozitVydani(v);
        return casti && { v, edice: casti.edice, rok: parseInt(casti.rok), vekPresne: vekVLetech(m.narozeniDatum, v) };
    }).filter(Boolean).sort((a, b) => a.v.localeCompare(b.v)));
    return centerfoldyCache.get(m);
}
const median = cisla => {
    const s = [...cisla].sort((a, b) => a - b), p = Math.floor(s.length / 2);
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
};

// Graf v čase: sloupce [{ popisek, nazev, polozky: [{ m, c?, hodnota? }] }] a druh (pocet, udaj)
function radaVCase(def) {
    if (def.klic === 'prib') {
        const dnes = new Date();
        const sloupce = Array.from({ length: 24 }, (_, i) => {
            const d = new Date(dnes.getFullYear(), dnes.getMonth() - 23 + i, 1);
            const klic = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return { popisek: d.getMonth() ? ZKRATKY_PASKY[d.getMonth()] : String(d.getFullYear()), nazev: `${MESICE[d.getMonth()]} ${d.getFullYear()}`,
                polozky: data.modelky.filter(m => (m.pridano || '').startsWith(klic)).map(m => ({ m })) };
        });
        return { druh: 'pocet', mesice: true, sloupce };
    }
    // Centerfoldy ve zvolené edici; údaj modelky (výška…) patří k roku jejího prvního centerfoldu
    const polozky = data.modelky.flatMap(m => {
        const cf = centerfoldyModelky(m).filter(c => edice === 'vse' || c.edice === edice);
        if (!def.udaj) return cf.map(c => ({ m, c }));
        if (def.klic === 'vek') return cf.filter(c => c.vekPresne !== null).map(c => ({ m, c, hodnota: c.vekPresne }));
        const hodnota = def.udaj(m);
        return cf.length && hodnota ? [{ m, c: cf[0], hodnota }] : [];
    });
    if (!polozky.length) return { druh: def.udaj ? 'udaj' : 'pocet', sloupce: [] };
    const roky = polozky.map(p => p.c.rok);
    const od = Math.min(...roky), doRoku = Math.max(...roky);
    const sloupce = Array.from({ length: doRoku - od + 1 }, (_, i) => ({ popisek: String(od + i), nazev: String(od + i), rok: od + i, polozky: [] }));
    polozky.forEach(p => sloupce[p.c.rok - od].polozky.push(p));
    return { druh: def.udaj ? 'udaj' : 'pocet', sloupce };
}

// Kvantil seřazených hodnot s lineární interpolací (q 0–1)
const kvantil = (serazene, q) => {
    const poz = q * (serazene.length - 1), dolni = Math.floor(poz);
    return serazene[dolni] + ((serazene[Math.ceil(poz)] ?? serazene[dolni]) - serazene[dolni]) * (poz - dolni);
};
// Údaj ve sloupci: medián a prostřední polovina modelek (null, když sloupec nemá hodnoty)
const rozsahSloupce = s => {
    if (!s.polozky.length) return null;
    const h = s.polozky.map(p => p.hodnota).sort((a, b) => a - b);
    return { median: kvantil(h, 0.5), dolni: kvantil(h, 0.25), horni: kvantil(h, 0.75) };
};

// Křivka: klouzavý průměr počtů, u údaje průměr mediánů sloupců vážený počtem modelek, přes okno ±polomer
function krivka(rada, polomer) {
    return rada.sloupce.map((_, i) => {
        const okno = rada.sloupce.slice(Math.max(0, i - polomer), i + polomer + 1);
        if (rada.druh === 'pocet') return okno.reduce((s, x) => s + x.polozky.length, 0) / okno.length;
        const n = okno.reduce((s, x) => s + x.polozky.length, 0);
        return n >= 3 ? okno.reduce((s, x) => s + (x.polozky.length ? rozsahSloupce(x).median * x.polozky.length : 0), 0) / n : null;
    });
}

// „Hezký“ krok osy (1, 2, 2,5, 5 × 10^k), aby na ose bylo asi čtyři až pět čar
const krokOsy = rozpeti => {
    const rad = 10 ** Math.floor(Math.log10(rozpeti / 4 || 1));
    return [1, 2, 2.5, 5, 10].map(k => k * rad).find(k => rozpeti / k <= 5);
};

// Graf v čase jako SVG v přesné šířce karty (písmo zůstává stejně velké); neviditelné cíle nesou bublinu a index
function htmlGrafuVCase(def, rada, sirka) {
    const { sloupce } = rada;
    if (!sloupce.length) return `<p class="stat-prazdne">${def.udaj ? `Údaj ${def.nazev.toLowerCase()} zatím u modelek s centerfoldem chybí.` : 'Zatím žádná data.'}</p>`;
    const W = Math.max(320, sirka), H = 360, L = 42, P = 10, T = 14, D = 26;
    const k = (W - L - P) / sloupce.length;
    const polomer = rada.mesice ? 1 : 3;
    const cara = sloupce.length >= 5 ? krivka(rada, polomer) : [];
    let lo = 0, hi;
    if (rada.druh === 'pocet') {
        hi = Math.max(1, ...sloupce.map(s => s.polozky.length));
    } else {
        const rozsahy = sloupce.map(rozsahSloupce).filter(Boolean);
        const min = Math.min(...rozsahy.map(r => r.dolni)), max = Math.max(...rozsahy.map(r => r.horni)), okraj = (max - min) * 0.1 || 1;
        lo = min - okraj;
        hi = max + okraj;
    }
    const krok = krokOsy(hi - lo);
    if (rada.druh === 'pocet') hi = Math.ceil(hi / krok) * krok;
    const y = h => T + (hi - h) / (hi - lo || 1) * (H - T - D);
    const x = i => L + i * k;
    const vybrano = i => !vyber || (i >= Math.min(vyber.od, vyber.do) && i <= Math.max(vyber.od, vyber.do));
    const casti = [];
    for (let h = Math.ceil(lo / krok) * krok; h <= hi + 1e-9; h += krok) {
        casti.push(`<line class="${h === 0 ? 'graf-osa' : 'graf-mrizka'}" x1="${L}" x2="${W - P}" y1="${y(h)}" y2="${y(h)}"/><text class="graf-popisek" x="${L - 8}" y="${y(h) + 4}" text-anchor="end">${cislo(h)}</text>`);
    }
    if (vyber) {
        const a = Math.min(vyber.od, vyber.do), b = Math.max(vyber.od, vyber.do);
        casti.push(`<rect class="sp-oblast" x="${x(a)}" y="${T}" width="${(b - a + 1) * k}" height="${H - T - D}" rx="4"/>`);
    }
    // Popisky osy x tak, aby mezi nimi bylo aspoň 38 px; roky na kulatých číslech
    const kazdy = [1, 2, 5, 10, 20, 50].find(n => n * k >= 38) || 50;
    sloupce.forEach((s, i) => {
        const ukazat = rada.mesice ? i % kazdy === 0 || !ZKRATKY_PASKY.includes(s.popisek) : s.rok % kazdy === 0;
        if (ukazat) casti.push(`<text class="graf-popisek" x="${x(i) + k / 2}" y="${H - 8}" text-anchor="middle">${esc(s.popisek)}</text>`);
        const tlum = vybrano(i) ? '' : 'tlum';
        if (rada.druh === 'pocet') {
            const v = s.polozky.length, sl = Math.max(1, k - (k > 8 ? 2 : 1));
            casti.push(`<path class="sp-sloupec ${tlum}" d="${sloupec(x(i) + (k - sl) / 2, y(v), sl, y(0) - y(v))}" fill="${BARVA}"/>`);
        } else if (s.polozky.length) {
            // Svislý pruh prostřední poloviny modelek a bod mediánu roku
            const r = rozsahSloupce(s), sl = Math.max(2, Math.min(10, k - 2));
            casti.push(`<rect class="sp-pasmo ${tlum}" x="${x(i) + (k - sl) / 2}" y="${y(r.horni)}" width="${sl}" height="${Math.max(2, y(r.dolni) - y(r.horni))}" rx="${Math.min(3, sl / 2)}"/>`);
            casti.push(`<circle class="sp-bod ${tlum}" cx="${x(i) + k / 2}" cy="${y(r.median)}" r="${Math.min(3.5, Math.max(2, k / 3))}" fill="${BARVA}"/>`);
        }
    });
    const body = cara.map((v, i) => v === null ? null : `${x(i) + k / 2},${y(v)}`);
    // Křivka se přeruší tam, kde nejsou data
    const useky = body.reduce((u, b) => { if (b) u.at(-1).push(b); else if (u.at(-1).length) u.push([]); return u; }, [[]]).filter(u => u.length > 1);
    useky.forEach(u => casti.push(`<polyline class="sp-krivka" points="${u.join(' ')}"/>`));
    sloupce.forEach((s, i) => {
        const n = s.polozky.length;
        const tip = rada.druh === 'pocet'
            ? `${s.nazev}: ${rada.mesice ? `${pocetModelek(n)} přidáno` : pocetCenterfoldu(n)}${cara[i] !== undefined ? ` · průměr ${cislo(cara[i])}` : ''}`
            : `${s.nazev}: ${n ? `medián ${cislo(rozsahSloupce(s).median)} ${def.jednotka}, polovina modelek ${cislo(rozsahSloupce(s).dolni)}–${cislo(rozsahSloupce(s).horni)} · ${pocetModelek(n)}` : 'bez údaje'}`;
        casti.push(`<rect class="graf-cil" data-i="${i}" data-tip="${esc(tip)}" x="${x(i)}" y="0" width="${k}" height="${H}"/>`);
    });
    return `<svg class="sp-svg" width="${W}" height="${H}" role="img" aria-label="${esc(def.nazev)}">${casti.join('')}</svg>`;
}

// Graf rozložení: položky { hodnota, nazev, test, dotaz } s počtem modelek
function polozkyRozlozeni(klic) {
    const { modelky } = data;
    const podleUdaje = (hodnota, dotaz, nejvic) => {
        const skupiny = new Map();
        modelky.forEach(m => {
            const h = String(hodnota(m) || '').trim();
            if (!h) return;
            const k = sjednotit(h);
            if (!skupiny.has(k)) skupiny.set(k, { hodnota: k, nazev: h, test: m2 => sjednotit(String(hodnota(m2) || '').trim()) === k, dotaz: `${dotaz}:"${h}"` });
        });
        return [...skupiny.values()];
    };
    let polozky = [];
    if (klic === 'kat') {
        const nazvy = new Set(modelky.flatMap(m => kategorieModelky(m).map(k => k.nazev)));
        polozky = [...nazvy].map(n => ({ hodnota: n, nazev: n, test: m => kategorieModelky(m).some(k => k.nazev === n), dotaz: `kategorie:"${n.toLowerCase()}"` }));
    } else if (klic === 'nar') polozky = podleUdaje(m => m.narodnost, 'narodnost');
    else if (klic === 'vlasy') polozky = podleUdaje(m => m.vlasyBarva, 'vlasy');
    else if (klic === 'oci') polozky = podleUdaje(m => m.ociBarva, 'oci');
    else if (klic === 'srd') {
        return [5, 4, 3, 2, 1, 0].map(n => ({ hodnota: String(n), nazev: n ? '♥'.repeat(n) : 'Bez hodnocení', test: m => (m.hodnoceni || 0) === n, dotaz: n ? `hodnoceni:${n}` : null }))
            .map(p => ({ ...p, pocet: modelky.filter(p.test).length }));
    } else if (klic === 'vyskyt') {
        return Object.entries(VYSKYT).map(([k, nazev]) => ({ hodnota: k || 'neurceno', nazev, test: m => vyskytModelky(m) === k, dotaz: `vyskyt:${k || 'neurceno'}` }))
            .map(p => ({ ...p, pocet: modelky.filter(p.test).length })).filter(p => p.pocet);
    } else if (klic === 'fot') {
        polozky = data.s.fotografove.filter(f => data.fotografove.has(f.nazev)).map(f => ({ hodnota: f.nazev, nazev: f.nazev,
            test: m => data.fotografove.get(f.nazev).has(m.id), dotaz: `fotograf:"${f.nazev}"` }));
    }
    return polozky.map(p => ({ ...p, pocet: modelky.filter(p.test).length }))
        .sort((a, b) => b.pocet - a.pocet || a.nazev.localeCompare(b.nazev, 'cs')).slice(0, 15);
}

function htmlPruhu(polozky) {
    if (!polozky.length) return `<p class="stat-prazdne">${graf === 'fot' && !data.fotografove.size ? 'Počítám fotografy…' : 'Zatím žádná data.'}</p>`;
    const max = Math.max(1, ...polozky.map(p => p.pocet));
    return `<div class="sp-pruhy">${polozky.map(p => {
        const zapnuty = vyber?.hodnota === p.hodnota;
        return `<button type="button" class="sp-pruh ${zapnuty ? 'vybrany' : vyber ? 'tlum' : ''}" data-hodnota="${esc(p.hodnota)}" aria-pressed="${zapnuty}"
            data-tip="${esc(`${p.nazev}: ${pocetModelek(p.pocet)}`)}">
            <span class="sp-nazev">${esc(p.nazev)}</span><span class="sp-draha"><i style="width:${p.pocet / max * 100}%"></i></span><span class="sp-pocet">${p.pocet}</span>
        </button>`;
    }).join('')}</div>`;
}

// Modelky výběru: [{ m, detail, poradi }] bez opakování, nadpis a dotaz pro galerii
function modelkyVyberu(def, rada, rozlozeni) {
    if (def.skupina === 'rozl') {
        const p = vyber && rozlozeni.find(x => x.hodnota === vyber.hodnota);
        const seznam = (p ? data.modelky.filter(p.test) : data.modelky)
            .sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || a.jmeno.localeCompare(b.jmeno, 'cs'))
            .map(m => ({ m, detail: kategorieModelky(m).filter(k => !k.odvozena).map(k => k.nazev)[0] || '' }));
        return { nadpis: p ? p.nazev : 'Všechny modelky', seznam, dotaz: p?.dotaz || '' };
    }
    const a = vyber ? Math.min(vyber.od, vyber.do) : 0, b = vyber ? Math.max(vyber.od, vyber.do) : rada.sloupce.length - 1;
    const videne = new Set();
    const seznam = rada.sloupce.slice(a, b + 1).flatMap(s => s.polozky).filter(p => !videne.has(p.m.id) && videne.add(p.m.id)).map(p => ({
        m: p.m,
        detail: def.klic === 'prib' ? `přidána ${p.m.pridano.slice(8, 10).replace(/^0/, '')}. ${parseInt(p.m.pridano.slice(5, 7))}. ${p.m.pridano.slice(0, 4)}`
            : def.udaj ? `${cislo(p.hodnota)} ${def.jednotka} · ${nazevVydani(p.c.v)}` : nazevVydani(p.c.v),
    }));
    if (def.klic === 'prib') seznam.reverse();
    const nadpis = !vyber || !rada.sloupce.length ? (def.klic === 'prib' ? 'Poslední dva roky' : 'Celé období')
        : a === b ? rada.sloupce[a].nazev : `${rada.sloupce[a].nazev} – ${rada.sloupce[b].nazev}`;
    return { nadpis, seznam, dotaz: '' };
}

function htmlSeznamu({ nadpis, seznam, dotaz }) {
    const ukazat = zobrazitVse ? seznam : seznam.slice(0, ZOBRAZIT_NAJEDNOU);
    return `<div class="sp-seznam-hlava"><b>${esc(nadpis)}</b><span>${pocetModelek(seznam.length)}</span>
            ${vyber ? '<button type="button" class="sp-zrusit" data-zrusit-vyber title="Zrušit výběr (Esc)" aria-label="Zrušit výběr">×</button>' : ''}</div>
        ${seznam.length ? `<div class="sp-modelky">${ukazat.map(({ m, detail }) => `
            <button type="button" class="sp-modelka" data-modelka-vyberu="${m.id}">
                <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
                <span>${esc(m.jmeno)}<small>${esc(detail)}</small></span>
                ${m.hodnoceni ? `<i>${'♥'.repeat(m.hodnoceni)}</i>` : ''}
            </button>`).join('')}
            ${ukazat.length < seznam.length ? `<button type="button" class="link sp-vse" data-vse-vyberu>Zobrazit všech ${seznam.length}</button>` : ''}</div>`
        : '<p class="stat-prazdne">Ve výběru nejsou žádné modelky.</p>'}
        ${dotaz ? `<button type="button" class="btn btn-primary btn-small sp-galerie" data-vyber-galerie="${esc(dotaz)}">Otevřít v galerii →</button>` : ''}`;
}

// Věta vpravo nad grafem
function souhrn(def, rada, rozlozeni) {
    if (def.skupina === 'rozl') return `<b>${data.modelky.length}</b> modelek · <b>${rozlozeni.length}</b> ${rozlozeni.length === 1 ? 'hodnota' : rozlozeni.length > 1 && rozlozeni.length < 5 ? 'hodnoty' : 'hodnot'}`;
    const vsechny = rada.sloupce.flatMap(s => s.polozky);
    if (!vsechny.length) return '';
    if (def.klic === 'prib') return `<b>${vsechny.length}</b> přidáno za dva roky`;
    const obdobi = `<b>${rada.sloupce[0].nazev}–${rada.sloupce.at(-1).nazev}</b>`;
    if (!def.udaj) return `<b>${vsechny.length}</b> ${pocetCenterfoldu(vsechny.length).replace(/^\d+ /, '')} · ${obdobi}`;
    return `medián <b>${cislo(median(vsechny.map(p => p.hodnota)))} ${def.jednotka}</b> · známý u ${pocetModelek(vsechny.length)} · ${obdobi}`;
}

const definice = () => GRAFY.find(g => g.klic === graf);
const ediceCenterfoldu = () => EDICE.filter(e => data.modelky.some(m => centerfoldyModelky(m).some(c => c.edice === e)));

// Kostra se vykreslí jednou (rozvinutý seznam drží fokus); části se pak překreslují zvlášť
function htmlKostry() {
    return `<h3>Statistiky sbírky</h3>
        <div class="sp-lista">
            <label class="sp-vyber-grafu">
                <select data-sp-graf-vyber aria-label="Graf">${Object.entries(SKUPINY).map(([s, nazev]) => `<optgroup label="${nazev}">${GRAFY.filter(g => g.skupina === s)
                    .map(g => `<option value="${g.klic}" ${g.klic === graf ? 'selected' : ''}>${esc(g.nazev)}</option>`).join('')}</optgroup>`).join('')}</select></label>
            <span class="sp-edice" data-sp-edice></span>
            <span class="sp-souhrn" data-sp-souhrn></span>
        </div>
        <div class="sp-telo">
            <div class="stat-karta sp-karta">
                <div class="sp-legenda" data-sp-legenda></div>
                <div class="sp-graf" data-sp-graf tabindex="0"></div>
                <p class="sp-napoveda" data-sp-napoveda></p>
            </div>
            <div class="stat-karta sp-seznam" data-sp-seznam></div>
        </div>
        ${data.modelky.length ? '' : '<p class="stat-prazdne">Statistiky se ukážou, až budou ve sbírce modelky.</p>'}`;
}

// Překreslení grafu (při tažení jen graf), případně i seznamu a lišty
let rada = null, rozlozeni = [];
function vykreslit(koren, { jenGraf = false } = {}) {
    if (!data || !koren.querySelector('[data-sp-graf]')) return;
    const def = definice();
    const misto = koren.querySelector('[data-sp-graf]');
    koren.querySelector('.graf-bublina')?.classList.add('hidden');
    if (!jenGraf) {
        rada = def.skupina === 'cas' ? radaVCase(def) : null;
        rozlozeni = def.skupina === 'rozl' ? polozkyRozlozeni(def.klic) : [];
    }
    const fokus = /** @type {HTMLElement} */ (document.activeElement)?.closest?.('[data-hodnota]')?.dataset.hodnota;
    misto.innerHTML = def.skupina === 'cas' ? htmlGrafuVCase(def, rada, misto.clientWidth) : htmlPruhu(rozlozeni);
    misto.classList.toggle('cas', def.skupina === 'cas');
    if (fokus !== undefined) /** @type {HTMLElement} */ (misto.querySelector(`[data-hodnota="${CSS.escape(fokus)}"]`))?.focus({ preventScroll: true });
    if (jenGraf) return;
    const ed = ediceCenterfoldu();
    koren.querySelector('[data-sp-edice]').innerHTML = def.skupina === 'cas' && def.klic !== 'prib' && ed.length > 1
        ? ['vse', ...ed].map(e => `<button type="button" class="${e === edice ? 'active' : ''}" aria-pressed="${e === edice}" data-sp-edice-volba="${e}">${e === 'vse' ? 'Vše' : e}</button>`).join('') : '';
    koren.querySelector('[data-sp-souhrn]').innerHTML = souhrn(def, rada, rozlozeni);
    koren.querySelector('[data-sp-legenda]').innerHTML = def.skupina === 'rozl' ? '' : rada.druh === 'pocet'
        ? `<span><i></i>${rada.mesice ? 'přidané modelky' : 'centerfoldy'}</span><span><i class="cara"></i>průměr ${rada.mesice ? '3 měsíců' : '7 let'}</span>`
        : '<span><i class="bod"></i>medián roku</span><span><i class="pasmo"></i>prostřední polovina modelek</span><span><i class="cara"></i>průměr 7 let</span>';
    koren.querySelector('[data-sp-napoveda]').textContent = def.skupina === 'cas'
        ? `Klik na sloupec vybere ${rada.mesice ? 'měsíc' : 'rok'}, tažením vyberete období. Šipky ← → posouvají výběr, se Shiftem ho rozšíří; Esc výběr zruší.`
        : 'Klik na řádek ukáže jeho modelky; další klik výběr zruší.';
    const seznam = koren.querySelector('[data-sp-seznam]');
    const fokusSeznamu = seznam.contains(document.activeElement);
    seznam.innerHTML = htmlSeznamu(modelkyVyberu(def, rada, rozlozeni));
    if (fokusSeznamu) /** @type {HTMLElement} */ (seznam.querySelector('button'))?.focus({ preventScroll: true });
    nacitatPostupne(seznam);
}

// Načtení a vykreslení do oddílu Přehledu; volá se při prvním zobrazení oddílu (výběr zůstává, dokud se nezmění data)
export async function nacistStatistiky(koren) {
    if (!koren || koren.dataset.nacteno) return;
    koren.dataset.nacteno = '1';
    const [s, modelky] = await Promise.all([GetStatistiky(), vsechnyModelky()]);
    if (!koren.isConnected) return;
    data = { s, modelky, fotografove: new Map() };
    vyber = null;
    koren.innerHTML = `${htmlKostry()}<div class="graf-bublina hidden"></div>`;
    vykreslit(koren);
    // Při změně šířky se graf v čase překreslí v nové šířce
    const misto = koren.querySelector('[data-sp-graf]');
    let sirka = misto.clientWidth;
    new ResizeObserver(() => {
        if (!misto.isConnected || misto.clientWidth === sirka) return;
        sirka = misto.clientWidth;
        if (definice().skupina === 'cas') vykreslit(koren, { jenGraf: true });
    }).observe(misto);
    // Modelky nejčastějších fotografů (z hledání), pak se graf fotografů doplní
    const vysledky = await Promise.all(s.fotografove.map(f => GetModelky(`fotograf:"${f.nazev}"`)
        .then(seznam => /** @type {[string, Set<number>]} */ ([f.nazev, new Set((seznam || []).map(m => m.id))]))));
    if (!koren.isConnected || data?.s !== s) return;
    data.fotografove = new Map(vysledky);
    if (graf === 'fot') vykreslit(koren);
}

// Index sloupce pod ukazatelem (u kraje grafu nejbližší sloupec)
function indexSloupce(misto, clientX) {
    const svg = misto.querySelector('svg');
    const cile = misto.querySelectorAll('[data-i]');
    if (!svg || !cile.length) return null;
    const x = clientX - svg.getBoundingClientRect().left;
    const prvni = /** @type {SVGRectElement} */ (cile[0]);
    const zacatek = prvni.x.baseVal.value, k = prvni.width.baseVal.value;
    return Math.max(0, Math.min(cile.length - 1, Math.floor((x - zacatek) / k)));
}

const stejny = (a, b) => a && b && a.od === b.od && a.do === b.do;

// Bublina u sloupce nebo řádku pod myší; výběr myší (klik, tažení) a klávesnicí
export function pripravit(stats) {
    stats.addEventListener('mousemove', (e) => {
        // Každá část (úvod, statistiky) má vlastní bublinu
        const bublina = e.target.closest?.('.stat-section')?.querySelector('.graf-bublina');
        if (!bublina) return;
        const cil = !tah && e.target.closest?.('[data-tip]');
        bublina.classList.toggle('hidden', !cil);
        stats.querySelectorAll('.graf g.aktivni').forEach(g => g !== cil && g.classList.remove('aktivni'));
        if (!cil) return;
        cil.classList.add('aktivni');
        bublina.textContent = cil.dataset.tip;
        const okraj = bublina.offsetParent.getBoundingClientRect();
        const x = Math.min(e.clientX - okraj.left + 14, okraj.width - bublina.offsetWidth - 8);
        bublina.style.left = `${x}px`;
        bublina.style.top = `${e.clientY - okraj.top + 16}px`;
    });
    stats.addEventListener('mouseleave', () => stats.querySelectorAll('.graf-bublina').forEach(b => b.classList.add('hidden')));

    // Tažení přes sloupce grafu v čase
    stats.addEventListener('pointerdown', (e) => {
        const misto = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf].cas'));
        if (!misto || e.button !== 0) return;
        const i = indexSloupce(misto, e.clientX);
        if (i === null) return;
        e.preventDefault();
        misto.focus({ preventScroll: true });
        misto.setPointerCapture(e.pointerId);
        tah = { start: i, predtim: vyber };
        vyber = { od: i, do: i };
        vykreslit(misto.closest('.stat-statistiky'), { jenGraf: true });
    });
    stats.addEventListener('pointermove', (e) => {
        if (!tah) return;
        const misto = /** @type {HTMLElement} */ (e.target).closest?.('[data-sp-graf]');
        const i = misto && indexSloupce(misto, e.clientX);
        if (i === null || i === undefined || i === vyber.do) return;
        vyber = { od: tah.start, do: i };
        vykreslit(misto.closest('.stat-statistiky'), { jenGraf: true });
    });
    stats.addEventListener('pointerup', (e) => {
        if (!tah) return;
        const koren = /** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky');
        // Klik na jediný vybraný sloupec výběr zruší
        if (vyber.od === vyber.do && stejny(vyber, tah.predtim)) vyber = null;
        tah = null;
        zobrazitVse = false;
        if (koren) vykreslit(koren);
    });

    stats.addEventListener('change', (e) => {
        const select = /** @type {HTMLSelectElement} */ (e.target);
        if (!select.matches('[data-sp-graf-vyber]')) return;
        graf = select.value;
        try { localStorage.setItem('grafStatistik', graf); } catch { /* jen pro toto spuštění */ }
        vyber = null;
        zobrazitVse = false;
        vykreslit(select.closest('.stat-statistiky'));
    });

    stats.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const koren = cil.closest('.stat-statistiky');
        if (!koren || !data) return;
        const modelka = cil.closest('[data-modelka-vyberu]');
        if (modelka) {
            const m = data.modelky.find(x => x.id === parseInt(modelka.dataset.modelkaVyberu));
            if (m) otevritDetailModelky(m);
            return;
        }
        const galerie = cil.closest('[data-vyber-galerie]');
        if (galerie) {
            hledatHodnotu(galerie.dataset.vyberGalerie);
            return;
        }
        const volbaEdice = cil.closest('[data-sp-edice-volba]');
        const pruh = cil.closest('.sp-pruh[data-hodnota]');
        if (cil.closest('[data-vse-vyberu]')) zobrazitVse = true;
        else if (cil.closest('[data-zrusit-vyber]')) vyber = null;
        else if (volbaEdice) {
            edice = volbaEdice.dataset.spEdiceVolba;
            vyber = null;
        } else if (pruh) vyber = vyber?.hodnota === pruh.dataset.hodnota ? null : { hodnota: pruh.dataset.hodnota };
        else return;
        if (!cil.closest('[data-vse-vyberu]')) zobrazitVse = false;
        vykreslit(koren);
        if (volbaEdice) /** @type {HTMLElement} */ (koren.querySelector(`[data-sp-edice-volba="${edice}"]`))?.focus();
    });

    // Klávesnice v grafu v čase: šipky posouvají výběr (Shift rozšiřuje), Home a End; Esc zruší výběr
    stats.addEventListener('keydown', (e) => {
        const koren = /** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky');
        if (!koren || !data) return;
        if (e.key === 'Escape') {
            if (!vyber) return;
            e.preventDefault();
            e.stopPropagation();
            vyber = null;
            vykreslit(koren);
            return;
        }
        const misto = /** @type {HTMLElement} */ (e.target).closest('[data-sp-graf].cas');
        const n = rada?.sloupce.length || 0;
        if (!misto || !n || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const ted = vyber ? vyber.do : e.key === 'ArrowLeft' ? n : -1;
        const nove = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, ted + (e.key === 'ArrowLeft' ? -1 : 1)));
        vyber = e.shiftKey && vyber ? { od: vyber.od, do: nove } : { od: nove, do: nove };
        zobrazitVse = false;
        vykreslit(koren);
    });
}
