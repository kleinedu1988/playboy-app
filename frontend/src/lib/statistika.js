// Statistické funkce pro postřehy ve Statistikách (lib/postrehy.js): pořadí se shodami, normální rozdělení,
// Kendallovo τ_b, Cochranův–Armitageův test trendu podílu, Theilův–Senův sklon a Wilsonův interval podílu.
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

// Součty přes skupiny shod v seřazeném poli: Σ t(t−1)/2, Σ t(t−1)(t−2), Σ t(t−1)(2t+5)
function shody(serazene, stejne) {
    let dvojice = 0, trojice = 0, rozptyl = 0;
    for (let i = 0; i < serazene.length;) {
        let j = i + 1;
        while (j < serazene.length && stejne(serazene[j], serazene[i])) j++;
        const t = j - i;
        dvojice += t * (t - 1) / 2;
        trojice += t * (t - 1) * (t - 2);
        rozptyl += t * (t - 1) * (2 * t + 5);
        i = j;
    }
    return { dvojice, trojice, rozptyl };
}

// Kendallovo τ_b mezi x a y s opravou na shody a normální aproximací (scipy.stats.kendalltau, method='asymptotic').
// Knightův algoritmus O(n log n): seřadit podle (x, y), spočítat přehození při řazení podle y.
// Vrací { tau, z, p, n } nebo null, když je některá řada konstantní nebo dvojic je méně než 3.
export function kendallTauB(x, y) {
    const n = x.length;
    if (n < 3 || y.length !== n) return null;
    const body = x.map((xi, i) => [xi, y[i]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const tx = shody(body, (a, b) => a[0] === b[0]);
    const txy = shody(body, (a, b) => a[0] === b[0] && a[1] === b[1]).dvojice;
    // Řazení slučováním podle y; přehození = počet dvojic, které jsou v opačném pořadí
    let pole = body.map(b => b[1]), pomocne = new Array(n), prehozeni = 0;
    for (let sirka = 1; sirka < n; sirka *= 2) {
        for (let zac = 0; zac < n; zac += 2 * sirka) {
            const stred = Math.min(zac + sirka, n), kon = Math.min(zac + 2 * sirka, n);
            let i = zac, j = stred, k = zac;
            while (i < stred && j < kon) {
                if (pole[j] < pole[i]) {
                    prehozeni += stred - i;
                    pomocne[k++] = pole[j++];
                } else pomocne[k++] = pole[i++];
            }
            while (i < stred) pomocne[k++] = pole[i++];
            while (j < kon) pomocne[k++] = pole[j++];
        }
        [pole, pomocne] = [pomocne, pole];
    }
    const ty = shody(pole, (a, b) => a === b);
    const n0 = n * (n - 1) / 2;
    const rozdil = n0 - tx.dvojice - ty.dvojice + txy - 2 * prehozeni;   // souhlasné − nesouhlasné
    const jmenovatel = Math.sqrt((n0 - tx.dvojice) * (n0 - ty.dvojice));
    if (!jmenovatel) return null;
    const m = n * (n - 1);
    const rozptyl = (m * (2 * n + 5) - tx.rozptyl - ty.rozptyl) / 18
        + 2 * tx.dvojice * ty.dvojice / m
        + tx.trojice * ty.trojice / (9 * m * (n - 2));
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
    const sklony = [];
    for (let i = 0; i < x.length; i++) {
        for (let j = i + 1; j < x.length; j++) if (x[j] !== x[i]) sklony.push((y[j] - y[i]) / (x[j] - x[i]));
    }
    return median(sklony);
}

// Wilsonův interval podílu ano/n (výchozí 95 %); { dolni, horni } v rozsahu 0–1, null pro n = 0
export function wilson(ano, n, z = 1.959963984540054) {
    if (!n) return null;
    const p = ano / n, z2 = z * z;
    const stred = (p + z2 / (2 * n)) / (1 + z2 / n);
    const polovina = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
    return { dolni: Math.max(0, stred - polovina), horni: Math.min(1, stred + polovina) };
}
