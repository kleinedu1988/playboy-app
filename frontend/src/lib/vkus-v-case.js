// Můj vkus v čase (ROADMAP 1.53): jak se mění, které modelky se ti líbí. Zdrojem jsou porovnání dvojic
// (kdo vyhrál a kdy) a od 1.53 i změny srdíček. U každé vlastnosti (blond, 90. léta, vyšší postava, tetování…)
// se počítá, jak často vyhrává modelka, která ji má, proti té, která ji nemá – za poslední rok a dřív.
// Postřeh vznikne, jen když rozdíl projde Fisherovým testem po opravě Benjamini–Hochberg (jako postrehy.js)
// a je aspoň PRAH_POSUNU procentních bodů; raději žádná věta než šum.
import { benjaminiHochberg, fisher } from './statistika.js';
import { kategorieModelky, nazevCasopisu } from './format.js';
import { jineCasopisy, skupinaVlasu } from './mapa-sbirky.js';
import { ALFA } from './postrehy.js';

export const MIN_SOUBOJU = 20;   // soubojů, kde vlastnost má právě jedna z dvojice, v každém období
export const PRAH_POSUNU = 0.10; // 10 procentních bodů
export const MIN_V_MESICI = 5;   // soubojů vlastnosti v měsíci, aby měsíc šel do grafu

// Názvy předvyplněných časopisů (i bez načtených časopisů z backendu, např. v testech)
const NAZVY_CASOPISU = { PH: 'Penthouse', HU: 'Hustler' };

const prvniRok = m => (m.vydani || []).filter(v => /^\d{4}/.test(v)).map(v => Number(v.slice(0, 4))).sort((a, b) => a - b)[0] ?? null;

// Vlastnosti: klíč, název ve větě (koho se týká) a test na modelce
export function vlastnosti(modelky) {
    /** @type {{ klic: string, kdo: string, test: (m: any) => boolean }[]} */
    const v = [
        { klic: 'blond', kdo: 'blondýnky', test: m => skupinaVlasu(m.vlasyBarva) === 'Blond' },
        { klic: 'hnede', kdo: 'brunetky', test: m => skupinaVlasu(m.vlasyBarva) === 'Hnědé' },
        { klic: 'cerne', kdo: 'černovlásky', test: m => skupinaVlasu(m.vlasyBarva) === 'Černé' },
        { klic: 'zrzave', kdo: 'zrzky', test: m => skupinaVlasu(m.vlasyBarva) === 'Zrzavé' },
        { klic: 'vysoka', kdo: 'vyšší modelky (175 cm a víc)', test: m => m.vyskaCm >= 175 },
        { klic: 'drobna', kdo: 'drobnější modelky (pod 165 cm)', test: m => m.vyskaCm > 0 && m.vyskaCm < 165 },
        { klic: 'prirodni', kdo: 'modelky s přírodními prsy', test: m => m.prsaTyp === 'Přírodní' },
        { klic: 'silikon', kdo: 'modelky se silikonovými prsy', test: m => m.prsaTyp === 'Silikonová' },
        { klic: 'tetovani', kdo: 'modelky s tetováním', test: m => m.tetovani === 1 },
    ];
    for (let d = 1950; d <= 2020; d += 10) {
        v.push({ klic: `d${d}`, kdo: `modelky z ${d < 2000 ? `${String(d).slice(2)}. let` : `let ${d}–${d + 9}`}`, test: m => { const r = prvniRok(m); return r !== null && r >= d && r < d + 10; } });
    }
    // Kategorie, které má aspoň 20 modelek
    const pocty = new Map();
    for (const m of modelky) for (const k of kategorieModelky(m)) pocty.set(k.nazev, (pocty.get(k.nazev) || 0) + 1);
    for (const [nazev, n] of pocty) if (n >= 20) v.push({ klic: `kat:${nazev}`, kdo: nazev, test: m => kategorieModelky(m).some(k => k.nazev === nazev) });
    // Jiné časopisy než Playboy (0.02.070), které má aspoň 20 modelek: „modelky Penthouse“ proti ostatním
    const vCasopise = new Map();
    for (const m of modelky) for (const c of jineCasopisy(m)) vCasopise.set(c, (vCasopise.get(c) || 0) + 1);
    for (const [c, n] of vCasopise) {
        if (n >= 20) v.push({ klic: `casopis:${c}`, kdo: `modelky ${NAZVY_CASOPISU[c] || nazevCasopisu(c)}`, test: m => jineCasopisy(m).includes(c) });
    }
    return v;
}

const posunDne = (den, dni) => new Date(Date.parse(`${den}T12:00:00Z`) + dni * 864e5).toISOString().slice(0, 10);
const pct = x => `${Math.round(x * 100)} %`;

/**
 * @param {{ porovnani: { den: string, vitez: number, porazena: number }[], srdicka?: { den: string, modelka: number, pred: number, po: number }[] }} vkus
 * @param {any[]} modelky
 */
export function vkusVCase(vkus, modelky) {
    const porovnani = vkus?.porovnani || [];
    const podleId = new Map(modelky.map(m => [m.id, m]));
    const vysledek = { postrehy: [], radky: [], mesice: [], srdicka: srdickaPoMesicich(vkus?.srdicka || []), souboju: porovnani.length, hranice: '' };
    if (!porovnani.length) return vysledek;
    const konec = porovnani[porovnani.length - 1].den;
    const hranice = posunDne(konec, -365);
    vysledek.hranice = hranice;
    const mesice = [...new Set(porovnani.map(p => p.den.slice(0, 7)))].sort();
    vysledek.mesice = mesice;
    const vl = vlastnosti(modelky);
    const radky = vl.map(v => {
        // Jen souboje, kde vlastnost má právě jedna z dvojice
        const r = { klic: v.klic, kdo: v.kdo, letos: [0, 0], driv: [0, 0], poMesicich: new Map() };
        for (const p of porovnani) {
            const a = podleId.get(p.vitez), b = podleId.get(p.porazena);
            if (!a || !b) continue;
            const ma = v.test(a), mb = v.test(b);
            if (ma === mb) continue;
            const cil = p.den > hranice ? r.letos : r.driv;
            cil[ma ? 0 : 1]++;
            const mes = p.den.slice(0, 7);
            const vm = r.poMesicich.get(mes) || [0, 0];
            vm[ma ? 0 : 1]++;
            r.poMesicich.set(mes, vm);
        }
        const nL = r.letos[0] + r.letos[1], nD = r.driv[0] + r.driv[1];
        return { ...r, nL, nD, podilLetos: nL ? r.letos[0] / nL : null, podilDriv: nD ? r.driv[0] / nD : null,
            p: nL >= MIN_SOUBOJU && nD >= MIN_SOUBOJU ? fisher(r.letos[0], r.letos[1], r.driv[0], r.driv[1]) : null, q: 1 };
    });
    const testovane = radky.filter(r => r.p !== null);
    const q = benjaminiHochberg(testovane.map(r => r.p));
    testovane.forEach((r, i) => { r.q = q[i]; });
    vysledek.radky = radky.filter(r => r.nL + r.nD > 0).sort((a, b) => (b.nL + b.nD) - (a.nL + a.nD));
    vysledek.postrehy = testovane
        .filter(r => r.q < ALFA && Math.abs(r.podilLetos - r.podilDriv) >= PRAH_POSUNU)
        .sort((a, b) => Math.abs(b.podilLetos - b.podilDriv) - Math.abs(a.podilLetos - a.podilDriv))
        .map(r => ({ klic: r.klic, kladny: r.podilLetos > r.podilDriv, q: r.q,
            text: r.podilLetos > r.podilDriv
                ? `Za poslední rok se ti víc líbí ${r.kdo}: vyhrávají ${pct(r.podilLetos)} soubojů, dřív ${pct(r.podilDriv)}.`
                : `Za poslední rok se ti ${r.kdo} líbí méně než dřív: vyhrávají ${pct(r.podilLetos)} soubojů, dřív ${pct(r.podilDriv)}.` }));
    return vysledek;
}

// Podíl výher vlastnosti po měsících (jen měsíce s aspoň MIN_V_MESICI souboji)
export function radaPodilu(radek, mesice) {
    return mesice.map(m => {
        const [v, p] = radek.poMesicich.get(m) || [0, 0];
        return { mesic: m, n: v + p, podil: v + p >= MIN_V_MESICI ? v / (v + p) : null };
    });
}

// Změny srdíček po měsících: nově ohodnocené, přidaná a ubraná srdíčka u přehodnocených
export function srdickaPoMesicich(zmeny) {
    const mapa = new Map();
    for (const z of zmeny) {
        const m = z.den.slice(0, 7);
        const r = mapa.get(m) || { mesic: m, nove: 0, pridano: 0, ubrano: 0, prumerNovych: 0 };
        if (z.pred === 0 && z.po > 0) { r.nove++; r.prumerNovych += z.po; }
        else if (z.po > z.pred) r.pridano++;
        else if (z.po < z.pred) r.ubrano++;
        mapa.set(m, r);
    }
    return [...mapa.values()].sort((a, b) => a.mesic.localeCompare(b.mesic)).map(r => ({ ...r, prumerNovych: r.nove ? r.prumerNovych / r.nove : null }));
}
