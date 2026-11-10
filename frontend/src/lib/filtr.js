// Model filtru: jeden zápis pro text hledání i pro štítky a panel filtrů. Filtr = { podminky, volne }:
// podmínka { klic, negace, hodnoty[], vyraz } patří jedné dimenzi (lib/dimenze.js), mezi podmínkami platí A,
// mezi hodnotami jedné podmínky NEBO (čárka); volne = slova bez příkazu (hledají se ve všech textech položky).
// Text ↔ filtr jde oběma směry (parsovat, serializovat); stejné dotazy najdou totéž jako backend (hledani.go,
// testy nad testdata/hledani-shoda.json).
import { bezDiakritiky, filtrHodnoceni, rozlozitDotaz, vyhovujeHledani, vyhovujeSrdickum } from './format.js';

const najitDimenzi = (dimenze, klic) => dimenze.find(d => d.klic === klic || d.aliasy?.includes(klic));

// Text dotazu → filtr. Příkaz, který dimenze neznají, zůstane volným slovem (hledá se jako text, jako v backendu).
export function parsovat(text, dimenze) {
    return rozdelitTokeny(rozlozitDotaz(text), dimenze);
}
function rozdelitTokeny(tokeny, dimenze) {
    const podminky = [];
    const volne = [];
    for (const t of tokeny) {
        const d = t.klic && !t.skupina && najitDimenzi(dimenze, t.klic);
        if (d) podminky.push({ klic: d.klic, negace: t.negace, hodnoty: t.surove, vyraz: t.surove.join(',') });
        else volne.push(t);
    }
    return { podminky, volne };
}

// Filtr → text dotazu (hodnota s mezerou nebo čárkou v uvozovkách)
const doTextu = h => /[\s,":]/.test(h) ? `"${h.replace(/"/g, '')}"` : h;
export function serializovat({ podminky = [], volne = [] }) {
    const casti = podminky.map(p => `${p.negace ? '-' : ''}${p.klic}:${p.vyraz && !p.hodnoty?.length ? p.vyraz : p.hodnoty.map(doTextu).join(',')}`);
    for (const t of volne) casti.push(t.skupina ? t.text : `${t.negace ? '-' : ''}${t.klic ? `${t.klic}:` : ''}${doTextu(t.hodnota)}`);
    return casti.join(' ');
}

// Číselná podmínka jako v backendu: >=175, <1970, 170..180, 170-180, 1975 (přesně), seznam 1975,1980; null = není číselná.
// Rok kratší než čtyři číslice (rok:197) je začátek roku a rozsah roků jen se čtyřmístnými mezemi – obojí se hledá jako text.
export function ciselnyVyraz(vyraz, rok = false) {
    const v = String(vyraz || '').replace(/\s+/g, '');
    const op = /^(>=|<=|==|>|<|=)(\d+)$/.exec(v);
    if (op) return [{ op: op[1] === '==' ? '=' : op[1], od: Number(op[2]) }];
    const rozsah = /^(\d+)(?:\.\.|-)(\d+)$/.exec(v);
    if (rozsah) {
        if (rok && !/^\d{4}(?:\.\.|-)\d{4}$/.test(v)) return null;
        const [od, po] = [Number(rozsah[1]), Number(rozsah[2])].sort((x, y) => x - y);
        return [{ op: '..', od, do: po }];
    }
    const cisla = v.split(',').filter(Boolean);
    if (!cisla.length || !cisla.every(c => /^\d+$/.test(c)) || (rok && cisla.some(c => c.length < 4))) return null;
    return cisla.map(c => ({ op: '=', od: Number(c) }));
}
const vyhovujeCislu = (n, filtry) => filtry.some(({ op, od, do: po }) => op === '>=' ? n >= od : op === '<=' ? n <= od
    : op === '>' ? n > od : op === '<' ? n < od : op === '..' ? n >= od && n <= po : n === od);

// Splňuje položka podmínku? (bez negace)
function splnuje(polozka, p, d) {
    const hodnoty = d.hodnoty(polozka);
    if (d.typ === 'srdicka') {
        const filtry = filtrHodnoceni(p.vyraz);
        const n = Math.round(Number(hodnoty[0] || 0) * 2);
        return filtry ? vyhovujeSrdickum(n, filtry) : false;
    }
    if (d.typ === 'cislo') {
        const filtry = ciselnyVyraz(p.vyraz, d.rok);
        if (filtry) return hodnoty.some(h => vyhovujeCislu(Number(h), filtry));
    }
    // Text (i nečíselný výraz v číselné dimenzi a ano/ne): část textu bez diakritiky, NEBO přes hodnoty
    const texty = hodnoty.map(h => bezDiakritiky(h));
    return p.hodnoty.some(v => texty.some(t => t.includes(bezDiakritiky(v))));
}

// Vyhovuje položka filtru? krome = klíč dimenze, která se vynechá (počty u jejích hodnot, fasety)
// pole(položka) = údaje pro cílená volná slova, která nejsou dimenzí (pas:<=60, bmi:<18,5 – lib/format.js poleCiselModelky)
export function vyhodnotit(polozka, filtr, dimenze, texty, krome = '', pole = null) {
    for (const p of filtr.podminky) {
        if (p.klic === krome) continue;
        const d = najitDimenzi(dimenze, p.klic);
        if (!d) continue;
        if (splnuje(polozka, p, d) === p.negace) return false;
    }
    const volne = filtr.volne.filter(t => !t.skupina);
    // Skupina (a | b, závorky): každá alternativa je vlastní filtr se stejnými dimenzemi
    for (const t of filtr.volne) {
        if (!t.skupina) continue;
        const shoda = t.skupina.some(alt => vyhodnotit(polozka, rozdelitTokeny(alt, dimenze), dimenze, texty, krome, pole));
        if (shoda === t.negace) return false;
    }
    return !volne.length || vyhovujeHledani(texty(polozka), volne, pole ? pole(polozka) : {});
}

// Počty u hodnot jedné dimenze (fasety): kolik položek by zůstalo s ostatními podmínkami, kdyby se vybrala tato
// hodnota. Seřazeno od nejčastější; hodnoty se slučují bez ohledu na velikost písmen a diakritiku.
export function fasety(polozky, filtr, dimenze, texty, klic, pole = null) {
    const d = najitDimenzi(dimenze, klic);
    if (!d) return [];
    const pocty = new Map();
    for (const polozka of polozky) {
        if (!vyhodnotit(polozka, filtr, dimenze, texty, d.klic, pole)) continue;
        for (const h of new Set(d.hodnoty(polozka))) {
            const k = bezDiakritiky(h);
            const z = pocty.get(k) || { hodnota: h, pocet: 0 };
            z.pocet++;
            pocty.set(k, z);
        }
    }
    return [...pocty.values()].sort((a, b) => b.pocet - a.pocet || a.hodnota.localeCompare(b.hodnota, 'cs'));
}
