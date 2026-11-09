// Statistické funkce pro postřehy ve Statistikách (lib/postrehy.js): pořadí se shodami, normální rozdělení,
// Kendallovo τ_b, Spearmanovo ρ, Cochranův–Armitageův test trendu podílu, Theilův–Senův sklon a Wilsonův interval podílu,
// Mannův–Whitneyův a Fisherův test a Benjaminiho–Hochbergova oprava.
// Bez DOM a bez závislostí; hodnoty hlídá frontend/test/statistika.test.js proti SciPy (testdata/statistika-pripady.json).

const ODMOCNINA_PI = Math.sqrt(Math.PI);

// Doplňková chybová funkce erfc(x) s relativní přesností ~1e-13: do 3 Taylorova řada erf, dál řetězový zlomek
export function erfc(x) {
    if (x < 0) return 2 - erfc(-x);
    if (x < 3) {
        // erf(x) = 2/√π · Σ (−1)^n x^(2n+1) / (n! (2n+1))
        let clen = x, soucet = x;
        for (let n = 1; n < 200; n++) {
            clen *= -x * x / n;
            const pridat = clen / (2 * n + 1);
            soucet += pridat;
            if (Math.abs(pridat) < 1e-17 * Math.abs(soucet)) break;
        }
        return 1 - 2 / ODMOCNINA_PI * soucet;
    }
    // erfc(x) = e^(−x²)/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + …)))) – Lentzův algoritmus
    const male = 1e-300;
    let f = x, c = x, d = 0;
    for (let k = 1; k < 500; k++) {
        const a = k / 2;
        d = x + a * d;
        d = Math.abs(d) < male ? male : d;
        c = x + a / c;
        c = Math.abs(c) < male ? male : c;
        d = 1 / d;
        const delta = c * d;
        f *= delta;
        if (Math.abs(delta - 1) < 1e-16) break;
    }
    return Math.exp(-x * x) / ODMOCNINA_PI / f;
}

// Pravděpodobnost, že normované normální rozdělení přesáhne z (horní chvost)
export const normalniChvost = z => 0.5 * erfc(z / Math.SQRT2);
// Oboustranná p-hodnota ze z-skóre
export const pOboustranne = z => Math.min(1, 2 * normalniChvost(Math.abs(z)));

// Pořadí hodnot 1…n, shody dostanou průměrné pořadí (jako scipy.stats.rankdata)
export function poradi(hodnoty) {
    const idx = hodnoty.map((_, i) => i).sort((a, b) => hodnoty[a] - hodnoty[b]);
    const vysledek = new Array(hodnoty.length);
    for (let i = 0; i < idx.length;) {
        let j = i;
        while (j + 1 < idx.length && hodnoty[idx[j + 1]] === hodnoty[idx[i]]) j++;
        const prumer = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) vysledek[idx[k]] = prumer;
        i = j + 1;
    }
    return vysledek;
}

// Součty přes skupiny shod v seřazeném poli a zhuštění unikátních hodnot na začátek pole
function shodyAUnikatni(s) {
    let dvojice = 0, trojice = 0, rozptyl = 0, K = 0;
    const n = s.length;
    for (let i = 0; i < n;) {
        const v = s[i];
        let j = i + 1;
        while (j < n && s[j] === v) j++;
        const t = j - i;
        if (t > 1) {
            dvojice += t * (t - 1) / 2;
            trojice += t * (t - 1) * (t - 2);
            rozptyl += t * (t - 1) * (2 * t + 5);
        }
        s[K++] = v;
        i = j;
    }
    return { dvojice, trojice, rozptyl, K };
}

// Převede číselnou řadu v na celočíselná pořadí 0…K−1 se započtením shod (dvojice, trojice, rozptyl).
// Pokud jsou hodnoty celočíselné násobky 0,01 v malém rozsahu (roky, míry, BMI, WHR), použije přímé O(n) přihrádky
// bez řazení a binárního vyhledávání; jinak seřadí Float64Array v O(n log n).
function stlacitHodnoty(v) {
    const n = v.length;
    const r = new Int32Array(n);
    let min = Infinity, max = -Infinity, presne = true;
    for (let i = 0; i < n; i++) {
        const s = v[i] * 100, zaokr = Math.round(s);
        if (Math.abs(s - zaokr) > 1e-5) { presne = false; break; }
        r[i] = zaokr;
        if (zaokr < min) min = zaokr;
        if (zaokr > max) max = zaokr;
    }
    if (presne && max - min <= 16384) {
        const rozsah = max - min + 1;
        if (rozsah < 2) return null;
        const pocty = new Int32Array(rozsah);
        for (let i = 0; i < n; i++) {
            const idx = r[i] - min;
            r[i] = idx;
            pocty[idx]++;
        }
        let dvojice = 0, trojice = 0, rozptyl = 0, K = 0;
        for (let d = 0; d < rozsah; d++) {
            const t = pocty[d];
            if (!t) continue;
            if (t > 1) {
                dvojice += t * (t - 1) / 2;
                trojice += t * (t - 1) * (t - 2);
                rozptyl += t * (t - 1) * (2 * t + 5);
            }
            pocty[d] = K++;
        }
        if (K < 2) return null;
        for (let i = 0; i < n; i++) r[i] = pocty[r[i]];
        return { r, K, dvojice, trojice, rozptyl };
    }
    const sv = new Float64Array(n);
    for (let i = 0; i < n; i++) sv[i] = v[i];
    sv.sort();
    const tv = shodyAUnikatni(sv), K = tv.K;
    if (K < 2) return null;
    for (let i = 0; i < n; i++) {
        const val = v[i];
        let lo = 0, hi = K - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (sv[mid] < val) lo = mid + 1; else hi = mid;
        }
        r[i] = lo;
    }
    return { r, K, dvojice: tv.dvojice, trojice: tv.trojice, rozptyl: tv.rozptyl };
}

// Kendallovo τ_b mezi x a y s opravou na shody a normální aproximací (scipy.stats.kendalltau, method='asymptotic').
// Knightův algoritmus: seskupit podle x, spočítat přehození v y pomocí Fenwickova stromu.
// Vrací { tau, z, p, n } nebo null, když je některá řada konstantní nebo dvojic je méně než 3.
export function kendallTauB(x, y) {
    const n = x.length;
    if (n < 3 || y.length !== n) return null;
    const ty = stlacitHodnoty(y);
    if (!ty) return null;
    const ry = ty.r, Ky = ty.K;

    let serazenoX = true;
    for (let i = 1; i < n; i++) {
        if (x[i] < x[i - 1]) { serazenoX = false; break; }
    }

    let txDvojice = 0, txTrojice = 0, txRozptyl = 0, txy = 0, prehozeni = 0;
    const bit = new Int32Array(Ky + 1);
    const pocetY = new Int32Array(Ky);

    if (serazenoX) {
        let Kx = 0;
        for (let i = 0; i < n;) {
            const vx = x[i];
            let j = i + 1;
            while (j < n && x[j] === vx) j++;
            const t = j - i;
            Kx++;
            if (t > 1) {
                txDvojice += t * (t - 1) / 2;
                txTrojice += t * (t - 1) * (t - 2);
                txRozptyl += t * (t - 1) * (2 * t + 5);
                for (let k = i; k < j; k++) {
                    const r = ry[k];
                    txy += pocetY[r]++;
                    let mensiNeboRovno = 0;
                    for (let idx = r + 1; idx > 0; idx &= idx - 1) mensiNeboRovno += bit[idx];
                    prehozeni += i - mensiNeboRovno;
                }
                for (let k = i; k < j; k++) {
                    const r = ry[k];
                    pocetY[r] = 0;
                    for (let idx = r + 1; idx <= Ky; idx += idx & -idx) bit[idx]++;
                }
            } else {
                const r = ry[i];
                let mensiNeboRovno = 0;
                for (let idx = r + 1; idx > 0; idx &= idx - 1) mensiNeboRovno += bit[idx];
                prehozeni += i - mensiNeboRovno;
                for (let idx = r + 1; idx <= Ky; idx += idx & -idx) bit[idx]++;
            }
            i = j;
        }
        if (Kx < 2) return null;
    } else {
        const sx = stlacitHodnoty(x);
        if (!sx) return null;
        const rx = sx.r, Kx = sx.K;
        txDvojice = sx.dvojice; txTrojice = sx.trojice; txRozptyl = sx.rozptyl;
        const poctyX = new Int32Array(Kx + 1);
        for (let i = 0; i < n; i++) poctyX[rx[i] + 1]++;
        for (let g = 1; g <= Kx; g++) poctyX[g] += poctyX[g - 1];
        const hranice = new Int32Array(poctyX);
        const ryPodleX = new Int32Array(n);
        for (let i = 0; i < n; i++) ryPodleX[poctyX[rx[i]]++] = ry[i];
        for (let g = 0; g < Kx; g++) {
            const i = hranice[g], j = hranice[g + 1], t = j - i;
            if (t > 1) {
                for (let k = i; k < j; k++) {
                    const r = ryPodleX[k];
                    txy += pocetY[r]++;
                    let mensiNeboRovno = 0;
                    for (let idx = r + 1; idx > 0; idx &= idx - 1) mensiNeboRovno += bit[idx];
                    prehozeni += i - mensiNeboRovno;
                }
                for (let k = i; k < j; k++) {
                    const r = ryPodleX[k];
                    pocetY[r] = 0;
                    for (let idx = r + 1; idx <= Ky; idx += idx & -idx) bit[idx]++;
                }
            } else if (t === 1) {
                const r = ryPodleX[i];
                let mensiNeboRovno = 0;
                for (let idx = r + 1; idx > 0; idx &= idx - 1) mensiNeboRovno += bit[idx];
                prehozeni += i - mensiNeboRovno;
                for (let idx = r + 1; idx <= Ky; idx += idx & -idx) bit[idx]++;
            }
        }
    }
    const n0 = n * (n - 1) / 2;
    const rozdil = n0 - txDvojice - ty.dvojice + txy - 2 * prehozeni;   // souhlasné − nesouhlasné
    const jmenovatel = Math.sqrt((n0 - txDvojice) * (n0 - ty.dvojice));
    if (!jmenovatel) return null;
    const m = n * (n - 1);
    const rozptyl = (m * (2 * n + 5) - txRozptyl - ty.rozptyl) / 18
        + 2 * txDvojice * ty.dvojice / m
        + txTrojice * ty.trojice / (9 * m * (n - 2));
    const z = rozdil / Math.sqrt(rozptyl);
    return { tau: rozdil / jmenovatel, z, p: pOboustranne(z), n };
}

// Cochranův–Armitageův test trendu podílu přes skupiny se skóre (rok): skupiny [{ x, n, ano }].
// z² je totéž co χ² v R prop.trend.test. Vrací { z, p, n, podil } nebo null bez rozptylu.
export function cochranArmitage(skupiny) {
    const platne = skupiny.filter(s => s.n > 0);
    const N = platne.reduce((s, g) => s + g.n, 0);
    const R = platne.reduce((s, g) => s + g.ano, 0);
    if (!N || !R || R === N) return null;
    const p = R / N;
    const xPrumer = platne.reduce((s, g) => s + g.n * g.x, 0) / N;
    const T = platne.reduce((s, g) => s + g.ano * (g.x - xPrumer), 0);
    const sxx = platne.reduce((s, g) => s + g.n * (g.x - xPrumer) ** 2, 0);
    if (!sxx) return null;
    const z = T / Math.sqrt(p * (1 - p) * sxx);
    return { z, p: pOboustranne(z), n: N, podil: p };
}

// Medián čísel (prázdné pole → null)
export function median(cisla) {
    if (!cisla.length) return null;
    const s = Float64Array.from(cisla).sort(), p = s.length >> 1;
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
}

// Theilův–Senův sklon: medián sklonů všech dvojic bodů s různým x (jako scipy.stats.theilslopes)
export function theilSen(x, y) {
    const m = x.length;
    if (m < 2) return null;
    const sklony = new Float64Array(m * (m - 1) / 2);
    let k = 0;
    for (let i = 0; i < m; i++) {
        const xi = x[i], yi = y[i];
        for (let j = i + 1; j < m; j++) if (x[j] !== xi) sklony[k++] = (y[j] - yi) / (x[j] - xi);
    }
    if (!k) return null;
    const s = sklony.subarray(0, k).sort(), p = k >> 1;
    return k % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
}

// Wilsonův interval podílu ano/n (výchozí 95 %); { dolni, horni } v rozsahu 0–1, null pro n = 0
export function wilson(ano, n, z = 1.959963984540054) {
    if (!n) return null;
    const p = ano / n, z2 = z * z;
    const stred = (p + z2 / (2 * n)) / (1 + z2 / n);
    const polovina = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
    return { dolni: Math.max(0, stred - polovina), horni: Math.min(1, stred + polovina) };
}

// Mannův–Whitneyův test dvou skupin: normální aproximace s opravou na shody a na spojitost (scipy.stats.mannwhitneyu
// method='asymptotic', R wilcox.test(correct=TRUE, exact=FALSE)). U je pro první skupinu. Vrací { u, z, p } nebo null.
export function mannWhitney(a, b, serazene = false) {
    const n1 = a.length, n2 = b.length, n = n1 + n2;
    if (!n1 || !n2) return null;
    // Obě skupiny seřazené zvlášť a sloučené po skupinách shod: průměrné pořadí, součet pořadí první skupiny, shody
    const sa = serazene ? a : Float64Array.from(a).sort(), sb = serazene ? b : Float64Array.from(b).sort();
    let i = 0, j = 0, pred = 0, r1 = 0, shodyT = 0;
    while (i < n1 || j < n2) {
        const v = j >= n2 || (i < n1 && sa[i] <= sb[j]) ? sa[i] : sb[j];
        let ca = 0, cb = 0;
        while (i < n1 && sa[i] === v) { i++; ca++; }
        while (j < n2 && sb[j] === v) { j++; cb++; }
        const t = ca + cb;
        r1 += ca * (pred + (t + 1) / 2);
        shodyT += t * t * t - t;
        pred += t;
    }
    const u = r1 - n1 * (n1 + 1) / 2;
    const rozptyl = n1 * n2 / 12 * ((n + 1) - shodyT / (n * (n - 1)));
    if (!(rozptyl > 0)) return null;
    const odchylka = u - n1 * n2 / 2;
    const z = Math.sign(odchylka) * Math.max(0, Math.abs(odchylka) - 0.5) / Math.sqrt(rozptyl);
    return { u, z, p: pOboustranne(z) };
}

// ln(k!) pro k = 0…n (tabulka se rozšiřuje podle potřeby)
const lnFakt = [0];
function lnFaktorial(k) {
    for (let i = lnFakt.length; i <= k; i++) lnFakt[i] = lnFakt[i - 1] + Math.log(i);
    return lnFakt[k];
}

// Fisherův přesný test tabulky 2×2 [[a, b], [c, d]], oboustranný (součet pravděpodobností tabulek nejvýš tak
// pravděpodobných jako pozorovaná, s relativní tolerancí 1e-7 jako R a SciPy)
export function fisher(a, b, c, d) {
    const r1 = a + b, r2 = c + d, s1 = a + c, n = r1 + r2;
    if (!r1 || !r2 || !s1 || s1 === n) return 1;
    const zaklad = lnFaktorial(r1) + lnFaktorial(r2) + lnFaktorial(s1) + lnFaktorial(n - s1) - lnFaktorial(n);
    const lnP = x => zaklad - lnFaktorial(x) - lnFaktorial(r1 - x) - lnFaktorial(s1 - x) - lnFaktorial(r2 - s1 + x);
    const pozorovana = lnP(a);
    let p = 0;
    for (let x = Math.max(0, s1 - r2); x <= Math.min(r1, s1); x++) {
        const l = lnP(x);
        if (l <= pozorovana + 1e-7) p += Math.exp(l);
    }
    return Math.min(1, p);
}

// Benjaminiho–Hochbergova oprava: upravené p (q) ve stejném pořadí jako vstup (R p.adjust(method="BH"))
export function benjaminiHochberg(p) {
    const m = p.length, idx = p.map((_, i) => i).sort((x, y) => p[y] - p[x]);
    const q = new Array(m);
    let min = 1;
    idx.forEach((i, k) => {
        min = Math.min(min, p[i] * m / (m - k));
        q[i] = min;
    });
    return q;
}

// Lanczosova aproximace ln Γ(z) s přesností ~1e-15 pro z > 0
const LANCZOS_KOEF = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
function lnGamma(z) {
    let x = LANCZOS_KOEF[0];
    for (let i = 1; i < LANCZOS_KOEF.length; i++) x += LANCZOS_KOEF[i] / (z + i - 1);
    const t = z + 6.5;
    return 0.5 * Math.log(2 * Math.PI) + (z - 0.5) * Math.log(t) - t + Math.log(x);
}

// Řetězový zlomek pro neúplnou beta funkci I_x(a, b) (Lentzův algoritmus)
function betaZlomek(x, a, b) {
    const male = 1e-300, qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < male) d = male;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < male) d = male;
        c = 1 + aa / c; if (Math.abs(c) < male) c = male;
        d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < male) d = male;
        c = 1 + aa / c; if (Math.abs(c) < male) c = male;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
}

// Regularizovaná neúplná beta funkce I_x(a, b)
function neupBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const pred = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2)
        ? pred * betaZlomek(x, a, b) / a
        : 1 - pred * betaZlomek(1 - x, b, a) / b;
}

// Oboustranná p-hodnota Studentova t-rozdělení se stupni volnosti df = n - 2
function studentOboustranne(t, df) {
    if (!Number.isFinite(t)) return 0;
    if (t === 0) return 1;
    const x = df / (df + t * t);
    return Math.min(1, Math.max(0, neupBeta(x, df / 2, 0.5)));
}

// Spearmanova pořadová korelace ρ se shodami (průměrná pořadí) a oboustranná p-hodnota přes Studentovo t
// (shodné se scipy.stats.spearmanr). Vrací { rho, p } nebo null, pokud má řada < 3 body nebo nulový rozptyl.
export function spearman(x, y, predpoctene = false) {
    const n = x.length;
    if (n < 3 || y.length !== n) return null;
    const rx = predpoctene ? x : poradi(x);
    const ry = predpoctene ? y : poradi(y);
    const stred = (n + 1) / 2;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
        const dx = rx[i] - stred, dy = ry[i] - stred;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    if (!(sxx > 0 && syy > 0)) return null;
    const rho = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
    if (Math.abs(rho) >= 1) return { rho: Math.sign(rho), p: 0 };
    const t = rho * Math.sqrt((n - 2) / ((1 - rho) * (1 + rho)));
    return { rho, p: studentOboustranne(t, n - 2) };
}
