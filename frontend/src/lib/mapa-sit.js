// Mapa sbírky 2 (ROADMAP 1.53, návrh docs/NAVRH-NEURONOVA-SIT.md): míra zachování sousedů a lehký autoenkodér.
// Autoenkodér D → 12 (tanh) → 2 → 12 (tanh) → D se učí po epochách (Adam, minidávky, pevné semínko), aby šel
// pouštět na pozadí bez zaseknutí okna; mapa ho použije jen tehdy, když zachová sousedy o MIN_ZLEPSENI lépe než PCA.

export const MIN_ZLEPSENI = 0.05;

// Deterministický generátor (mulberry32)
export function generator(seme = 1) {
    let a = seme >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Indexy k nejbližších bodů (bez sebe) podle vzdálenosti, kterou vrací vzd(j)
function nejblizsi(n, i, k, vzd) {
    // Vzestupně seřazené vzdálenosti délky k; nový bod se vloží na místo (k je malé)
    const dist = new Float64Array(k).fill(Infinity), idx = new Int32Array(k).fill(-1);
    for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const d = vzd(j);
        if (d >= dist[k - 1]) continue;
        let p = k - 1;
        while (p > 0 && dist[p - 1] > d) { dist[p] = dist[p - 1]; idx[p] = idx[p - 1]; p--; }
        dist[p] = d;
        idx[p] = j;
    }
    return Array.from(idx).filter(j => j >= 0);
}

// Vzorek bodů a jejich sousedé v prostoru příznaků (spočítá se jednou, porovnává se s ním každá mapa)
export function sousedePriznaku(matice, n, D, volby = {}) {
    const ref = zacitSousedePriznaku(n, volby);
    while (!pokracovatSousede(ref, matice, n, D));
    return ref;
}

// Totéž po kouscích (na pozadí): zacit…, pak pokracovat… s rozpočtem v ms, dokud nevrátí true
export function zacitSousedePriznaku(n, { k = 10, vzorek = 150, seme = 7 } = {}) {
    const rnd = generator(seme);
    const indexy = n <= vzorek ? [...Array(n).keys()] : [...new Set(Array.from({ length: vzorek * 2 }, () => Math.floor(rnd() * n)))].slice(0, vzorek);
    return { k: Math.min(k, n - 1), indexy, sousede: [] };
}
export function pokracovatSousede(ref, matice, n, D, rozpocet = Infinity) {
    const konec = performance.now() + rozpocet;
    // Vzdálenosti ke všem bodům v jednom průchodu (bez volání funkce na každý pár)
    const vzd = new Float64Array(n);
    while (ref.sousede.length < ref.indexy.length) {
        const i = ref.indexy[ref.sousede.length];
        const a = i * D;
        for (let j = 0; j < n; j++) {
            let s = 0;
            const b = j * D;
            for (let c = 0; c < D; c++) { const r = matice[a + c] - matice[b + c]; s += r * r; }
            vzd[j] = s;
        }
        ref.sousede.push(nejblizsi(n, i, ref.k, j => vzd[j]));
        if (performance.now() >= konec) break;
    }
    return ref.sousede.length >= ref.indexy.length;
}

// Podíl sousedů z prostoru příznaků, kteří jsou sousedy i na mapě (0..1)
export function zachovaniSousedu(ref, x, y) {
    if (!ref.indexy.length || ref.k < 1) return 0;
    let shod = 0;
    const n = x.length;
    ref.indexy.forEach((i, s) => {
        const naMape = new Set(nejblizsi(n, i, ref.k, j => (x[j] - x[i]) ** 2 + (y[j] - y[i]) ** 2));
        for (const j of ref.sousede[s]) if (naMape.has(j)) shod++;
    });
    return shod / (ref.indexy.length * ref.k);
}

// Autoenkodér učený po epochách: const ae = new Autoenkoder(matice, n, D); while (!ae.krok()); ae.kody()
export class Autoenkoder {
    constructor(matice, n, D, { skryta = 12, epochy = 40, davka = 64, uceni = 0.01, seme = 11 } = {}) {
        this.matice = matice;
        this.n = n;
        this.D = D;
        this.H = skryta;
        this.epochy = epochy;
        this.davka = davka;
        this.uceni = uceni;
        this.epocha = 0;
        this.t = 0;
        this.pozice = 0; // první řádek další minidávky v epoše
        this.soucet = 0;
        this.rnd = generator(seme);
        const vahy = (a, b) => Float64Array.from({ length: a * b }, () => (this.rnd() * 2 - 1) * Math.sqrt(6 / (a + b)));
        // Vrstvy: W1 D×H, W2 H×2, W3 2×H, W4 H×D (+ posuny)
        this.p = { W1: vahy(D, skryta), b1: new Float64Array(skryta), W2: vahy(skryta, 2), b2: new Float64Array(2),
            W3: vahy(2, skryta), b3: new Float64Array(skryta), W4: vahy(skryta, D), b4: new Float64Array(D) };
        this.m = Object.fromEntries(Object.entries(this.p).map(([k, v]) => [k, new Float64Array(v.length)]));
        this.v = Object.fromEntries(Object.entries(this.p).map(([k, v]) => [k, new Float64Array(v.length)]));
        this.poradi = [...Array(n).keys()];
        this.ztrata = Infinity;
    }

    // Dopředný průchod jednoho řádku; vrací mezivýsledky
    dopredu(i) {
        const { matice, D, H, p } = this;
        const x = matice.subarray(i * D, i * D + D);
        const h1 = new Float64Array(H);
        for (let a = 0; a < H; a++) {
            let s = p.b1[a];
            for (let c = 0; c < D; c++) s += x[c] * p.W1[c * H + a];
            h1[a] = Math.tanh(s);
        }
        const z = new Float64Array(2);
        for (let b = 0; b < 2; b++) {
            let s = p.b2[b];
            for (let a = 0; a < H; a++) s += h1[a] * p.W2[a * 2 + b];
            z[b] = s;
        }
        const h3 = new Float64Array(H);
        for (let a = 0; a < H; a++) h3[a] = Math.tanh(p.b3[a] + z[0] * p.W3[a] + z[1] * p.W3[H + a]);
        return { x, h1, z, h3 };
    }

    // Učení po kouscích: minidávky, dokud nevyprší rozpočet (ms; Infinity = celá epocha); true = učení skončilo
    krok(rozpocet = Infinity) {
        if (this.epocha >= this.epochy) return true;
        const { D, H, p, n } = this;
        const konecCasu = performance.now() + rozpocet;
        if (this.pozice === 0) {
            // Zamíchání pořadí na začátku epochy
            for (let i = n - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [this.poradi[i], this.poradi[j]] = [this.poradi[j], this.poradi[i]]; }
            this.soucet = 0;
        }
        let celkem = this.soucet;
        for (let zac = this.pozice; zac < n; zac += this.davka) {
            const g = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, new Float64Array(v.length)]));
            const konec = Math.min(n, zac + this.davka);
            for (let q = zac; q < konec; q++) {
                const { x, h1, z, h3 } = this.dopredu(this.poradi[q]);
                // Výstup a chyba (MSE)
                const dy = new Float64Array(D);
                for (let c = 0; c < D; c++) {
                    let s = p.b4[c];
                    for (let a = 0; a < H; a++) s += h3[a] * p.W4[a * D + c];
                    const r = s - x[c];
                    celkem += r * r;
                    dy[c] = 2 * r / D;
                }
                const dh3 = new Float64Array(H);
                for (let a = 0; a < H; a++) {
                    let s = 0;
                    for (let c = 0; c < D; c++) { g.W4[a * D + c] += h3[a] * dy[c]; s += p.W4[a * D + c] * dy[c]; }
                    dh3[a] = s * (1 - h3[a] * h3[a]);
                }
                for (let c = 0; c < D; c++) g.b4[c] += dy[c];
                const dz = new Float64Array(2);
                for (let a = 0; a < H; a++) {
                    g.W3[a] += z[0] * dh3[a]; g.W3[H + a] += z[1] * dh3[a]; g.b3[a] += dh3[a];
                    dz[0] += p.W3[a] * dh3[a]; dz[1] += p.W3[H + a] * dh3[a];
                }
                const dh1 = new Float64Array(H);
                for (let a = 0; a < H; a++) {
                    g.W2[a * 2] += h1[a] * dz[0]; g.W2[a * 2 + 1] += h1[a] * dz[1];
                    dh1[a] = (p.W2[a * 2] * dz[0] + p.W2[a * 2 + 1] * dz[1]) * (1 - h1[a] * h1[a]);
                }
                g.b2[0] += dz[0]; g.b2[1] += dz[1];
                for (let a = 0; a < H; a++) {
                    g.b1[a] += dh1[a];
                    if (dh1[a] === 0) continue;
                    for (let c = 0; c < D; c++) g.W1[c * H + a] += x[c] * dh1[a];
                }
            }
            this.adam(g, konec - zac);
            if (konec < n && performance.now() >= konecCasu) {
                this.pozice = konec;
                this.soucet = celkem;
                return false;
            }
        }
        this.pozice = 0;
        this.ztrata = celkem / (n * D);
        this.epocha++;
        return this.epocha >= this.epochy;
    }

    // Adam s L2 (1e-4)
    adam(g, pocet) {
        this.t++;
        const b1 = 0.9, b2 = 0.999, eps = 1e-8, l2 = 1e-4;
        const k1 = 1 - b1 ** this.t, k2 = 1 - b2 ** this.t;
        for (const klic of Object.keys(this.p)) {
            const w = this.p[klic], gr = g[klic], m = this.m[klic], v = this.v[klic];
            for (let i = 0; i < w.length; i++) {
                const d = gr[i] / pocet + l2 * w[i];
                m[i] = b1 * m[i] + (1 - b1) * d;
                v[i] = b2 * v[i] + (1 - b2) * d * d;
                w[i] -= this.uceni * (m[i] / k1) / (Math.sqrt(v[i] / k2) + eps);
            }
        }
    }

    // 2-D kódy všech řádků
    kody() {
        const x = new Float64Array(this.n), y = new Float64Array(this.n);
        for (let i = 0; i < this.n; i++) { const { z } = this.dopredu(i); x[i] = z[0]; y[i] = z[1]; }
        return { x, y };
    }
}
