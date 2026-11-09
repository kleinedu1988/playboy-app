// Mapa sbírky ve Statistikách (docs/NAVRH-SITE.md, oddíl 2):
// Každá modelka je bod v rovině (x, y ∈ [−1, 1]), blízké body znamenají podobné údaje.
// Vstupem jsou robustní z-skóre postavy, období prvního výskytu, barva vlasů a očí, národnost, kategorie
// a tělesné příznaky (hodnocení srdíčky ani etnicita nejsou vstupem mapy).
// Pevná orientace os (starší období vlevo, vyšší postava nahoře), Procrustovo zarovnání, Gowerova podobnost
// se společnými rysy a test bodu v mnohoúhelníku pro laso.
import { kategorieModelky, rozlozitVydani, sjednotit } from './format.js';

// První rok výskytu a věk modelky v tom čísle (nebo online albu)
function prvniRokAVek(m) {
    let nejVydani = '';
    for (const v of [...(m.vydani || []), ...(m.centerfoldy || []), ...(m.obalky || [])]) {
        const c = rozlozitVydani(v);
        if (!c) continue;
        const klic = `${c.rok}-${c.mesic}`;
        if (!nejVydani || klic < nejVydani) nejVydani = klic;
    }
    if (!nejVydani) {
        for (const d of m.onlineAlba || []) {
            if (/^\d{4}/.test(d) && (!nejVydani || d < nejVydani)) nejVydani = d;
        }
    }
    if (!nejVydani) return { rok: null, vek: null };
    const rok = parseInt(nejVydani.slice(0, 4), 10);
    let vek = null;
    const nar = /^(\d{4})(?:-(\d{2}))?/.exec(m.narozeniDatum || '');
    const vyd = /^(\d{4})(?:-(\d{2}))?/.exec(nejVydani);
    if (nar && vyd) {
        const v = parseInt(vyd[1], 10) - parseInt(nar[1], 10) - (vyd[2] && nar[2] && parseInt(vyd[2], 10) < parseInt(nar[2], 10) ? 1 : 0);
        if (v > 12 && v < 80) vek = v;
    }
    return { rok: Number.isFinite(rok) ? rok : null, vek };
}

// Kvantil seřazeného Float64Array
function kvantilSerazenych(s, q) {
    if (!s.length) return 0;
    const poz = q * (s.length - 1), d = Math.floor(poz), h = Math.ceil(poz);
    return s[d] + (s[h] - s[d]) * (poz - d);
}

// Robustní odhad středu (medián) a asymetrické odchylky pod a nad mediánem (škálovaný MAD)
function robustniStat(hodnoty, minSigma = 1) {
    if (hodnoty.length < 5) return { med: 0, sOd: minSigma, sDo: minSigma, platne: false };
    const s = new Float64Array(hodnoty.length);
    for (let i = 0; i < hodnoty.length; i++) s[i] = hodnoty[i];
    s.sort();
    const med = kvantilSerazenych(s, 0.5);
    const pod = [], nad = [];
    for (let i = 0; i < s.length; i++) {
        if (s[i] <= med) pod.push(med - s[i]);
        if (s[i] >= med) nad.push(s[i] - med);
    }
    const mad = pole => {
        if (!pole.length) return minSigma;
        const a = new Float64Array(pole.length);
        for (let i = 0; i < pole.length; i++) a[i] = pole[i];
        a.sort();
        return Math.max(minSigma, kvantilSerazenych(a, 0.5) * 1.4826);
    };
    return { med, sOd: mad(pod), sDo: mad(nad), platne: true };
}

// Kanonická skupina barvy vlasů
export function skupinaVlasu(vlasyBarva) {
    const t = sjednotit(String(vlasyBarva || '').trim());
    if (!t) return '';
    if (t.includes('blond') || t.includes('plav')) return 'Blond';
    if (t.includes('hned') || t.includes('brown') || t.includes('brunet') || t.includes('kastan')) return 'Hnědé';
    if (t.includes('cern') || t.includes('black') || t.includes('tmav')) return 'Černé';
    if (t.includes('zrz') || t.includes('red') || t.includes('auburn') || t.includes('rud') || t.includes('med')) return 'Zrzavé';
    return 'Jiné';
}

// Kanonická skupina barvy očí
function skupinaOci(ociBarva) {
    const t = sjednotit(String(ociBarva || '').trim());
    if (!t) return '';
    if (t.includes('modr') || t.includes('blue')) return 'Modré';
    if (t.includes('hned') || t.includes('brown') || t.includes('hazel') || t.includes('orisk') || t.includes('tmav')) return 'Hnědé';
    if (t.includes('zelen') || t.includes('green')) return 'Zelené';
    if (t.includes('sed') || t.includes('grey') || t.includes('gray')) return 'Šedé';
    return 'Jiné';
}

// Počet vyplněných klíčových údajů modelky (0..10)
export function uplnostModelky(m, rok = null) {
    let u = 0;
    if (rok || prvniRokAVek(m).rok) u++;
    if (m.narozeniDatum) u++;
    if (m.narodnost) u++;
    if (m.vyskaCm > 0) u++;
    if (m.vahaKg > 0) u++;
    if (m.obvodHrudnikCm > 0 && m.obvodPasCm > 0 && m.obvodBokyCm > 0) u++;
    if (m.vlasyBarva) u++;
    if (m.ociBarva) u++;
    if (m.prsaTyp) u++;
    if (m.tetovani === 0 || m.tetovani === 1) u++;
    return u;
}

// Příprava matic příznaků (N × D) a pomocných údajů modelek pro Mapu sbírky
export function pripravitPriznakyMapy(modelky) {
    const n = modelky.length;
    const zaklad = modelky.map(m => {
        const { rok, vek } = m._rok !== undefined ? { rok: m._rok, vek: m._vek ?? null } : prvniRokAVek(m);
        const vyska = m.vyskaCm > 0 ? m.vyskaCm : null;
        const vaha = m.vahaKg > 0 ? m.vahaKg : null;
        const hrudnik = m.obvodHrudnikCm > 0 ? m.obvodHrudnikCm : null;
        const pas = m.obvodPasCm > 0 ? m.obvodPasCm : null;
        const boky = m.obvodBokyCm > 0 ? m.obvodBokyCm : null;
        const bmi = vyska && vaha ? vaha / ((vyska / 100) ** 2) : null;
        const whr = pas && boky ? pas / boky : null;
        const vlasy = skupinaVlasu(m.vlasyBarva);
        const oci = skupinaOci(m.ociBarva);
        const narodnost = String(m.narodnost || '').trim();
        const kat = kategorieModelky(m).map(k => k.nazev);
        const uplnost = uplnostModelky(m, rok);
        return { m, rok, vek, vyska, vaha, hrudnik, pas, boky, bmi, whr, vlasy, oci, narodnost, kat, uplnost };
    });

    /** @type {Array<[string, number]>} */
    const klicePostavy = [
        ['vyska', 2], ['vaha', 2], ['bmi', 0.5], ['hrudnik', 2], ['pas', 2], ['boky', 2], ['whr', 0.02], ['vek', 1.5],
    ];
    const statPostavy = klicePostavy.map(([klic, minS]) => {
        const hod = [];
        for (let i = 0; i < n; i++) {
            const v = zaklad[i][klic];
            if (v !== null && Number.isFinite(v)) hod.push(v);
        }
        return robustniStat(hod, minS);
    });

    // Nejčastějších 10 národností (s aspoň 3 modelkami)
    const poctyNar = new Map();
    for (const z of zaklad) if (z.narodnost) poctyNar.set(z.narodnost, (poctyNar.get(z.narodnost) || 0) + 1);
    const hlavniNarodnosti = [...poctyNar.entries()]
        .filter(([, c]) => c >= 3)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs'))
        .slice(0, 10)
        .map(([k]) => k);

    const dekady = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
    const barvyVlasu = ['Blond', 'Hnědé', 'Černé', 'Zrzavé', 'Jiné'];
    const barvyOci = ['Modré', 'Hnědé', 'Zelené', 'Šedé', 'Jiné'];
    const nazvyKat = [
        'Playmate měsíce', 'Playmate roku', 'Cyber Girl', 'Coed', 'Muse',
        'Celebrita', 'Modelka obálky', 'Jen ve speciálu', 'Creator', 'Online',
    ];

    // Složení vektoru: 8 z-skóre postavy + 8 masek + 1 spojitý rok + 8 dekád + 5 vlasů + 5 očí + (10+1) národností + 7 kategorií + 4 binární
    const D = 8 + 8 + 1 + dekady.length + barvyVlasu.length + barvyOci.length + hlavniNarodnosti.length + 1 + nazvyKat.length + 4;
    const matice = new Float64Array(n * D);

    const vahaPostavy = Math.sqrt(3 / 8);
    const vahaMasky = Math.sqrt(0.15 / 8);
    const vahaRoku = Math.sqrt(1.2);
    const vahaDekady = Math.sqrt(0.8);
    const vahaVlasu = Math.sqrt(1.6);
    const vahaOci = Math.sqrt(0.8);
    const vahaNar = Math.sqrt(0.9);
    const vahaKat = Math.sqrt(1.4 / nazvyKat.length);
    const vahaBin = Math.sqrt(0.6 / 4);

    for (let i = 0; i < n; i++) {
        const z = zaklad[i];
        let pos = i * D;
        for (let j = 0; j < 8; j++) {
            const klic = klicePostavy[j][0];
            const val = z[klic];
            const st = statPostavy[j];
            if (val !== null && Number.isFinite(val) && st.platne) {
                const zSkore = val < st.med ? (val - st.med) / st.sOd : (val - st.med) / st.sDo;
                matice[pos + j] = Math.max(-3, Math.min(3, zSkore)) / 3 * vahaPostavy;
                matice[pos + 8 + j] = 0;
            } else {
                matice[pos + j] = 0;
                matice[pos + 8 + j] = vahaMasky;
            }
        }
        pos += 16;
        if (z.rok !== null) {
            matice[pos] = Math.max(-2, Math.min(2, (z.rok - 1990) / 22)) / 2 * vahaRoku;
            const dIdx = dekady.indexOf(Math.floor(z.rok / 10) * 10);
            if (dIdx >= 0) matice[pos + 1 + dIdx] = vahaDekady;
        }
        pos += 1 + dekady.length;
        const vIdx = barvyVlasu.indexOf(z.vlasy);
        if (vIdx >= 0) matice[pos + vIdx] = vahaVlasu;
        pos += barvyVlasu.length;
        const oIdx = barvyOci.indexOf(z.oci);
        if (oIdx >= 0) matice[pos + oIdx] = vahaOci;
        pos += barvyOci.length;
        if (z.narodnost) {
            const nIdx = hlavniNarodnosti.indexOf(z.narodnost);
            matice[pos + (nIdx >= 0 ? nIdx : hlavniNarodnosti.length)] = vahaNar;
        }
        pos += hlavniNarodnosti.length + 1;
        for (let k = 0; k < nazvyKat.length; k++) {
            if (z.kat.includes(nazvyKat[k])) matice[pos + k] = vahaKat;
        }
        pos += nazvyKat.length;
        const prsa = String(z.m.prsaTyp || '').trim();
        matice[pos] = prsa === 'Silikonová' ? vahaBin : prsa === 'Přírodní' ? -vahaBin : 0;
        const ochl = String(z.m.ochlupeni || '').trim();
        matice[pos + 1] = ochl === 'Oholené' ? vahaBin : ochl ? -vahaBin : 0;
        matice[pos + 2] = z.m.tetovani === 1 ? vahaBin : z.m.tetovani === 0 ? -vahaBin : 0;
        matice[pos + 3] = z.m.piercing === 1 ? vahaBin : z.m.piercing === 0 ? -vahaBin : 0;
    }

    // Vycentrování sloupců matice
    for (let j = 0; j < D; j++) {
        let soucet = 0;
        for (let i = 0; i < n; i++) soucet += matice[i * D + j];
        const prumer = soucet / Math.max(1, n);
        for (let i = 0; i < n; i++) matice[i * D + j] -= prumer;
    }

    return { zaklad, matice, n, D, statPostavy, hlavniNarodnosti };
}

// Gowerova podobnost (0..1, 1 = shodné) a lidsky čitelné společné rysy dvou modelek
export function gowerPodobnost(z1, z2) {
    let soucet = 0, vaha = 0;
    const duvody = [];
    const pridatCislo = (v1, v2, rozsah, w, formatDuvodu) => {
        if (v1 === null || v2 === null) return;
        const shoda = Math.max(0, 1 - Math.abs(v1 - v2) / rozsah);
        soucet += w * shoda;
        vaha += w;
        if (shoda >= 0.85 && formatDuvodu) duvody.push({ shoda, text: formatDuvodu(v1, v2) });
    };
    pridatCislo(z1.vyska, z2.vyska, 25, 1.2, v1 => `${Math.round(v1)} cm`);
    pridatCislo(z1.vaha, z2.vaha, 22, 1.0, v1 => `${Math.round(v1)} kg`);
    pridatCislo(z1.pas, z2.pas, 18, 1.0, null);
    pridatCislo(z1.hrudnik, z2.hrudnik, 22, 0.8, null);
    pridatCislo(z1.boky, z2.boky, 20, 0.8, null);
    if (z1.hrudnik && z2.hrudnik && z1.pas && z2.pas && z1.boky && z2.boky) {
        if (Math.abs(z1.hrudnik - z2.hrudnik) <= 3 && Math.abs(z1.pas - z2.pas) <= 3 && Math.abs(z1.boky - z2.boky) <= 3) {
            duvody.push({ shoda: 0.95, text: `${Math.round(z1.hrudnik)}-${Math.round(z1.pas)}-${Math.round(z1.boky)}` });
        }
    }
    pridatCislo(z1.rok, z2.rok, 50, 2.0, r1 => `${Math.floor(r1 / 10) * 10}. léta`);
    if (z1.vlasy && z2.vlasy) {
        vaha += 1.8;
        if (z1.vlasy === z2.vlasy) { soucet += 1.8; duvody.push({ shoda: 0.9, text: `${z1.vlasy.toLowerCase()} vlasy` }); }
    }
    if (z1.oci && z2.oci) {
        vaha += 0.9;
        if (z1.oci === z2.oci) { soucet += 0.9; duvody.push({ shoda: 0.8, text: `${z1.oci.toLowerCase()} oči` }); }
    }
    if (z1.narodnost && z2.narodnost) {
        vaha += 1.0;
        if (z1.narodnost === z2.narodnost) { soucet += 1.0; duvody.push({ shoda: 0.85, text: z1.narodnost }); }
    }
    pridatCislo(z1.vek, z2.vek, 18, 0.7, v1 => `${Math.round(v1)} let v 1. čísle`);
    const spolKat = z1.kat.filter(k => z2.kat.includes(k));
    const sjednoceniKat = new Set([...z1.kat, ...z2.kat]).size;
    if (sjednoceniKat > 0) {
        const jacc = spolKat.length / sjednoceniKat;
        soucet += 1.4 * jacc;
        vaha += 1.4;
        if (spolKat.length) duvody.push({ shoda: 0.75 + 0.2 * jacc, text: spolKat[0] });
    }
    const prsa1 = String(z1.m.prsaTyp || '').trim(), prsa2 = String(z2.m.prsaTyp || '').trim();
    if (prsa1 && prsa2) {
        vaha += 0.4;
        if (prsa1 === prsa2) {
            soucet += 0.4;
            if (prsa1 === 'Silikonová') duvody.push({ shoda: 0.72, text: 'silikonová prsa' });
        }
    }
    if ((z1.m.tetovani === 0 || z1.m.tetovani === 1) && (z2.m.tetovani === 0 || z2.m.tetovani === 1)) {
        vaha += 0.3;
        if (z1.m.tetovani === z2.m.tetovani) {
            soucet += 0.3;
            if (z1.m.tetovani === 1) duvody.push({ shoda: 0.74, text: 'tetování' });
        }
    }
    const podobnost = vaha > 0 ? soucet / vaha : 0;
    duvody.sort((a, b) => b.shoda - a.shoda);
    return { podobnost, duvody: duvody.slice(0, 3).map(d => d.text) };
}

// Mocninná metoda s Hotellingovou deflací pro nalezení K hlavních komponent kovarianční matice D × D
function pcaOsy(matice, n, D, pocetOs = 2) {
    const kov = new Float64Array(D * D);
    for (let i = 0; i < n; i++) {
        const radek = i * D;
        for (let a = 0; a < D; a++) {
            const va = matice[radek + a];
            if (va === 0) continue;
            const aD = a * D;
            for (let b = a; b < D; b++) kov[aD + b] += va * matice[radek + b];
        }
    }
    for (let a = 0; a < D; a++) {
        for (let b = a; b < D; b++) {
            const v = kov[a * D + b] / Math.max(1, n);
            kov[a * D + b] = v;
            kov[b * D + a] = v;
        }
    }

    const vlastniVektor = (mat, pocatek) => {
        let v = Float64Array.from(pocatek);
        const w = new Float64Array(D);
        for (let iter = 0; iter < 80; iter++) {
            let norma = 0;
            for (let a = 0; a < D; a++) {
                let s = 0;
                const aD = a * D;
                for (let b = 0; b < D; b++) s += mat[aD + b] * v[b];
                w[a] = s;
                norma += s * s;
            }
            norma = Math.sqrt(norma) || 1;
            let zmena = 0;
            for (let a = 0; a < D; a++) {
                const novy = w[a] / norma;
                zmena += (novy - v[a]) ** 2;
                v[a] = novy;
            }
            if (zmena < 1e-18) break;
        }
        let lambda = 0;
        for (let a = 0; a < D; a++) {
            let s = 0;
            for (let b = 0; b < D; b++) s += mat[a * D + b] * v[b];
            lambda += v[a] * s;
        }
        return { v, lambda };
    };

    const k = Math.min(pocetOs, D);
    const vektory = [];
    const kovPrac = new Float64Array(kov);
    for (let c = 0; c < k; c++) {
        const poc = new Float64Array(D);
        const prvocislo = 7 + c * 4;
        const mod = 13 + c * 2;
        for (let j = 0; j < D; j++) poc[j] = ((j * prvocislo + 3 + c) % mod) - (mod >> 1);
        const { v, lambda } = vlastniVektor(kovPrac, poc);
        vektory.push(v);
        if (c + 1 < k) {
            for (let a = 0; a < D; a++) {
                const lv = lambda * v[a];
                for (let b = 0; b < D; b++) kovPrac[a * D + b] -= lv * v[b];
            }
        }
    }
    return vektory;
}

function pcaDveOsy(matice, n, D) {
    const [v1, v2] = pcaOsy(matice, n, D, 2);
    const x = new Float64Array(n), y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const radek = i * D;
        let sx = 0, sy = 0;
        for (let j = 0; j < D; j++) {
            const val = matice[radek + j];
            sx += val * v1[j];
            sy += val * v2[j];
        }
        x[i] = sx;
        y[i] = sy;
    }
    return { x, y };
}

// 8-D jednotkově normovaný kód příznaků pro kosinovou podobnost (doplněk Gowerovy podobnosti u řídkých údajů).
// Vedle směru vrací i jistotu 0..1 podle délky vektoru před normováním: modelka s málo údaji leží blízko středu
// (chybějící údaje jsou nuly po vycentrování) a její směr je skoro náhodný, takže kosinu u ní nelze věřit.
function spocitatKod8(matice, n, D) {
    const osy = pcaOsy(matice, n, D, 8);
    const k = osy.length;
    const kod8 = new Float64Array(n * 8);
    const normy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const radek = i * D;
        const cil = i * 8;
        let norma = 0;
        for (let c = 0; c < k; c++) {
            const v = osy[c];
            let s = 0;
            for (let j = 0; j < D; j++) s += matice[radek + j] * v[j];
            kod8[cil + c] = s;
            norma += s * s;
        }
        norma = Math.sqrt(norma);
        normy[i] = norma;
        for (let c = 0; c < k; c++) kod8[cil + c] /= norma || 1;
    }
    const serazene = Array.from(normy).sort((a, b) => a - b);
    const median = serazene[Math.floor(n / 2)] || 1;
    const jistota = new Float64Array(n);
    for (let i = 0; i < n; i++) jistota[i] = Math.min(1, normy[i] / median);
    return { kod8, jistota };
}

let cachePodobnosti = { modelky: null, zaklad: null, kod8: null, jistota: null };

// Seznam modelek chodí z mezipaměti pokaždé jako nová kopie pole (slice), ale se stejnými objekty;
// po změně dat přijdou nové objekty. Proto se porovnávají prvky, ne samotné pole.
function stejneModelky(a, b) {
    if (!a || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

function dataProPodobnost(modelky) {
    if (cachePodobnosti.zaklad && stejneModelky(cachePodobnosti.modelky, modelky)) return cachePodobnosti;
    const { zaklad, matice, n, D } = pripravitPriznakyMapy(modelky);
    const { kod8, jistota } = spocitatKod8(matice, n, D);
    cachePodobnosti = { modelky: modelky.slice(), zaklad, kod8, jistota };
    return cachePodobnosti;
}

// Zkrácené jméno fotografa do důvodu („Stephen Wayda“ → „S. Wayda“)
const kratkeJmeno = j => {
    const casti = String(j).trim().split(/\s+/);
    return casti.length > 1 ? `${casti[0][0]}. ${casti.slice(1).join(' ')}` : casti[0];
};

// Kolik z podobnosti dá režim „Na fotkách“ fotkám (zbytek údaje) a o kolik zvedne podobnost společný fotograf
const VAHA_FOTEK = 0.65;
const BONUS_FOTOGRAFA = 0.04;

// Nejpodobnější modelky k zadané modelce: směs Gowerovy podobnosti a 8-D kódu a lidsky čitelné důvody (společný
// fotograf napřed, pak rysy z Gowera). obsah = GetPodobnostObsahu (podobnost středů fotek a společní fotografové,
// null bez něj); rezim 'fotky' přimíchá vizuální příbuznost z fotek (VAHA_FOTEK, kosinus středů přeškálovaný na
// rozpětí mezi kandidáty) a ukáže jen modelky, u kterých je spočítaná; 'udaje' jen údaje.
export function podobneModelky(modelkaId, modelky, { pocet = 5, obsah = null, rezim = 'udaje' } = {}) {
    if (!modelky || modelky.length < 2) return [];
    const { zaklad, kod8, jistota } = dataProPodobnost(modelky);
    const idx = zaklad.findIndex(z => z.m.id === modelkaId);
    if (idx < 0) return [];
    const z1 = zaklad[idx];
    const c1 = idx * 8;
    const naFotkach = obsah?.naFotkach || {};
    const fotografove = obsah?.fotografove || {};
    const sFotkami = rezim === 'fotky' && Object.keys(naFotkach).length > 0;
    // Kosinus středů fotek bývá u všech modelek vysoko (podobné focení); rozhoduje poloha mezi kandidáty
    let minF = Infinity, maxF = -Infinity;
    if (sFotkami) {
        for (const h of Object.values(naFotkach)) {
            if (h < minF) minF = h;
            if (h > maxF) maxF = h;
        }
    }
    const rozpetiF = maxF - minF || 1;
    const vysledky = [];
    for (let j = 0; j < zaklad.length; j++) {
        if (j === idx) continue;
        const z2 = zaklad[j];
        const foto = naFotkach[z2.m.id];
        if (sFotkami && foto === undefined) continue;
        const { podobnost: gower, duvody } = gowerPodobnost(z1, z2);
        const c2 = j * 8;
        let dot = 0;
        for (let k = 0; k < 8; k++) dot += kod8[c1 + k] * kod8[c2 + k];
        const kos = Math.max(0, Math.min(1, (dot + 1) / 2));
        // U modelek s málo vyplněnými údaji (< 4) má větší váhu 8-D kód, jinak převažuje Gowerova podobnost;
        // váha kódu se ještě násobí jistotou slabšího z obou vektorů (u modelek blízko středu je kosinus šum)
        const vahaGower = z1.uplnost >= 4 && z2.uplnost >= 4 ? 0.75 : 0.4;
        const vahaKodu = (1 - vahaGower) * Math.min(jistota[idx], jistota[j]);
        let celkova = (vahaGower * gower + vahaKodu * kos) / (vahaGower + vahaKodu);
        const spolecni = fotografove[z2.m.id] || [];
        if (spolecni.length) celkova = Math.min(1, celkova + BONUS_FOTOGRAFA);
        const fotoNorm = foto === undefined ? null : (foto - minF) / rozpetiF;
        if (sFotkami) celkova = (1 - VAHA_FOTEK) * celkova + VAHA_FOTEK * fotoNorm;
        const textyDuvodu = [
            ...(sFotkami && fotoNorm >= 0.75 ? ['podobné fotky'] : []),
            ...(spolecni.length ? [`foto ${spolecni.slice(0, 2).map(kratkeJmeno).join(', ')}`] : []),
            ...duvody,
        ];
        vysledky.push({
            id: z2.m.id,
            m: z2.m,
            podobnost: celkova,
            naFotkach: foto ?? null,
            duvody: [...new Set(textyDuvodu)].slice(0, 3),
        });
    }
    vysledky.sort((a, b) => b.podobnost - a.podobnost || (b.m.hodnoceni || 0) - (a.m.hodnoceni || 0) || a.id - b.id);
    return vysledky.slice(0, pocet);
}

// Pevná orientace os: starší období vlevo (x roste s rokem), vyšší postava nahoře (y roste s výškou)
// a škálování 1.–99. percentilu na [−1, 1]
function orientovatASkalovat(x, y, zaklad) {
    const n = x.length;
    if (!n) return;
    let korRokX = 0, korRokY = 0, korVyskaY = 0;
    for (let i = 0; i < n; i++) {
        const rok = zaklad[i].rok;
        if (rok !== null) {
            korRokX += x[i] * (rok - 1990);
            korRokY += y[i] * (rok - 1990);
        }
        if (zaklad[i].vyska !== null) korVyskaY += y[i] * (zaklad[i].vyska - 170);
    }
    // Pokud druhá osa koreluje s rokem výrazně víc než první, prohodíme osy, aby čas běžel vodorovně
    if (Math.abs(korRokY) > Math.abs(korRokX) * 1.25) {
        for (let i = 0; i < n; i++) { const t = x[i]; x[i] = y[i]; y[i] = t; }
        korRokX = korRokY;
        korVyskaY = 0;
        for (let i = 0; i < n; i++) if (zaklad[i].vyska !== null) korVyskaY += y[i] * (zaklad[i].vyska - 170);
    }
    if (korRokX < 0) for (let i = 0; i < n; i++) x[i] = -x[i];
    if (korVyskaY < 0) for (let i = 0; i < n; i++) y[i] = -y[i];

    const skalovatOsu = osa => {
        const ser = new Float64Array(osa).sort();
        const p01 = kvantilSerazenych(ser, 0.01), p99 = kvantilSerazenych(ser, 0.99);
        const stred = (p01 + p99) / 2, polovina = Math.max(1e-6, (p99 - p01) / 2);
        for (let i = 0; i < n; i++) {
            osa[i] = Math.max(-1.12, Math.min(1.12, (osa[i] - stred) / polovina));
        }
    };
    skalovatOsu(x);
    skalovatOsu(y);
}

// Ortogonální Procrustovo zarovnání 2-D bodů (noveX, noveY) na referenční (stareX, stareY).
// Vrací { x, y, posun } (posun je medián posunu bodů v % průměru mapy).
export function procrustes2D(noveX, noveY, stareX, stareY) {
    const n = noveX.length;
    if (!n || stareX.length !== n) return { x: Float64Array.from(noveX), y: Float64Array.from(noveY), posun: 0 };
    let mx1 = 0, my1 = 0, mx2 = 0, my2 = 0;
    for (let i = 0; i < n; i++) {
        mx1 += noveX[i]; my1 += noveY[i];
        mx2 += stareX[i]; my2 += stareY[i];
    }
    mx1 /= n; my1 /= n; mx2 /= n; my2 /= n;

    // Kovariance X1^T X2 (2 × 2) a normy
    let a = 0, b = 0, c = 0, d = 0, norma1 = 0, norma2 = 0;
    for (let i = 0; i < n; i++) {
        const x1 = noveX[i] - mx1, y1 = noveY[i] - my1;
        const x2 = stareX[i] - mx2, y2 = stareY[i] - my2;
        a += x1 * x2; b += x1 * y2;
        c += y1 * x2; d += y1 * y2;
        norma1 += x1 * x1 + y1 * y1;
        norma2 += x2 * x2 + y2 * y2;
    }
    if (norma1 < 1e-12) return { x: Float64Array.from(noveX), y: Float64Array.from(noveY), posun: 0 };

    // Vyzkoušíme čisté otočení (det = +1) i otočení se zrcadlením (det = −1) a vybereme menší chybu
    const kandidati = [1, -1].map(zrcadlo => {
        const ca = a, cb = b, cc = zrcadlo * c, cd = zrcadlo * d;
        const p = ca + cd, q = cb - cc;
        const r = Math.hypot(p, q) || 1;
        const cos = p / r, sin = q / r;
        // Matice R = [[cos, sin], [−zrcadlo·sin, zrcadlo·cos]]
        const r00 = cos, r01 = sin, r10 = -zrcadlo * sin, r11 = zrcadlo * cos;
        const stopa = a * r00 + b * r01 + c * r10 + d * r11;
        const meritko = stopa / norma1;
        let chyba = 0;
        const xVys = new Float64Array(n), yVys = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const x1 = noveX[i] - mx1, y1 = noveY[i] - my1;
            const rx = meritko * (x1 * r00 + y1 * r10) + mx2;
            const ry = meritko * (x1 * r01 + y1 * r11) + my2;
            xVys[i] = rx;
            yVys[i] = ry;
            chyba += (rx - stareX[i]) ** 2 + (ry - stareY[i]) ** 2;
        }
        return { x: xVys, y: yVys, chyba };
    });
    const nej = kandidati[0].chyba <= kandidati[1].chyba ? kandidati[0] : kandidati[1];
    const vzdalenosti = new Float64Array(n);
    for (let i = 0; i < n; i++) vzdalenosti[i] = Math.hypot(nej.x[i] - stareX[i], nej.y[i] - stareY[i]);
    vzdalenosti.sort();
    // Průměr mapy [−1, 1] × [−1, 1] je 2; medián posunu v % průměru mapy
    const posun = kvantilSerazenych(vzdalenosti, 0.5) / 2 * 100;
    return { x: nej.x, y: nej.y, posun };
}

// Test, zda bod (x, y) leží uvnitř mnohoúhelníku [{ x, y }, ...] (paprsková metoda)
export function bodVMnohouhelniku(x, y, polygon) {
    if (!polygon || polygon.length < 3) return false;
    let uvnitr = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const protina = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
        if (protina) uvnitr = !uvnitr;
    }
    return uvnitr;
}

// Výpočet celé Mapy sbírky: 2-D souřadnice, sousedé na mapě, zachování sousedů a popisky bodů
export function vypocitatMapuSbirky(modelky, { predchozi = null } = {}) {
    const n = modelky.length;
    if (!n) return { body: [], model: 'pca', zachovaniSousedu: 0, posun: 0 };
    const { zaklad, matice, D } = pripravitPriznakyMapy(modelky);
    let { x, y } = pcaDveOsy(matice, n, D);
    orientovatASkalovat(x, y, zaklad);

    let posun = 0;
    if (predchozi && predchozi.size >= 10) {
        const spolIdx = [], sx = [], sy = [], nx = [], ny = [];
        for (let i = 0; i < n; i++) {
            const st = predchozi.get(modelky[i].id);
            if (!st) continue;
            spolIdx.push(i);
            sx.push(st.x); sy.push(st.y);
            nx.push(x[i]); ny.push(y[i]);
        }
        if (spolIdx.length >= 10) {
            const zar = procrustes2D(nx, ny, sx, sy);
            posun = zar.posun;
        }
    }

    // Pro každý bod najdeme 2 nejbližší sousedy na mapě a spočítáme míru zachování sousedů na vzorku
    const body = zaklad.map((z, i) => {
        const xi = x[i], yi = y[i];
        let nej1 = -1, nej2 = -1, d1 = Infinity, d2 = Infinity;
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const d = (x[j] - xi) ** 2 + (y[j] - yi) ** 2;
            if (d < d1) { d2 = d1; nej2 = nej1; d1 = d; nej1 = j; }
            else if (d < d2) { d2 = d; nej2 = j; }
        }
        const sousede = [nej1, nej2].filter(j => j >= 0).map(j => zaklad[j].m.jmeno);
        const casti = [];
        if (z.rok) casti.push(String(z.rok));
        if (z.vyska) casti.push(`${Math.round(z.vyska)} cm`);
        if (z.hrudnik && z.pas && z.boky) casti.push(`${Math.round(z.hrudnik)}-${Math.round(z.pas)}-${Math.round(z.boky)}`);
        if (z.vlasy && z.vlasy !== 'Jiné') casti.push(`${z.vlasy.toLowerCase()} vlasy`);
        const dekada = z.rok ? `${Math.floor(z.rok / 10) * 10}. léta` : 'Neurčeno';
        return {
            id: z.m.id,
            m: z.m,
            x: xi,
            y: yi,
            rok: z.rok,
            dekada,
            vlasy: z.vlasy || 'Neurčeno',
            narodnost: z.narodnost || 'Neurčeno',
            kategorie: z.kat[0] || 'Ostatní',
            hodnoceni: z.m.hodnoceni || 0,
            uplnost: z.uplnost,
            maloUdaju: z.uplnost < 5,
            sousede,
            popisUdaju: casti.join(' · '),
        };
    });

    return { body, model: 'pca', posun };
}
