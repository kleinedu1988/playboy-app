// Hladké křivky grafů v čase (Statistiky › Křivka a rozpětí): klouzavé okno ±polomer sloupců, ze kterého se
// hodnoty sloučí. Údaj: medián okna a pásmo prostřední poloviny (25.–75. percentil) z hodnot všech modelek okna.
// Podíl: podíl ze všech modelek okna a Wilsonův 95% interval spolehlivosti. Počet: průměr počtů okna (bez pásma).
// Okno s méně než minN modelkami (údaj, podíl) křivku přeruší.

export const Z95 = 1.959964;
export const MIN_V_OKNE = 5;

// Wilsonův interval podílu ano z n (0–1); bez modelek null
export function wilson(ano, n, z = Z95) {
    if (!n) return null;
    const p = ano / n, z2 = z * z;
    const stred = (p + z2 / (2 * n)) / (1 + z2 / n);
    const polovina = z / (1 + z2 / n) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    // Při 0 nebo n z n je krajní mez přesně 0 nebo 1 (bez zaokrouhlovací chyby)
    return { dolni: ano === 0 ? 0 : Math.max(0, stred - polovina), horni: ano === n ? 1 : Math.min(1, stred + polovina) };
}

// Kvantil seřazených čísel s lineární interpolací (q 0–1)
export function kvantil(serazene, q) {
    const poz = q * (serazene.length - 1), dolni = Math.floor(poz);
    return serazene[dolni] + ((serazene[Math.ceil(poz)] ?? serazene[dolni]) - serazene[dolni]) * (poz - dolni);
}

// skupiny: pole sloupců, každý pole hodnot (údaj: čísla, podíl: true/false, počet: cokoli – počítá se délka).
// Vrací pro každý sloupec { stred, dolni, horni, n } (podíl v procentech; u počtu dolni = horni = null) nebo null.
export function vyhlazenaRada(druh, skupiny, polomer, { minN = MIN_V_OKNE } = {}) {
    return skupiny.map((_, i) => {
        const okno = skupiny.slice(Math.max(0, i - polomer), i + polomer + 1);
        const n = okno.reduce((s, x) => s + x.length, 0);
        if (druh === 'pocet') return { stred: n / okno.length, dolni: null, horni: null, n };
        if (n < minN) return null;
        if (druh === 'podil') {
            const ano = okno.reduce((s, x) => s + x.filter(Boolean).length, 0);
            const w = wilson(ano, n);
            return { stred: ano / n * 100, dolni: w.dolni * 100, horni: w.horni * 100, n };
        }
        const serazene = okno.flat().sort((a, b) => a - b);
        return { stred: kvantil(serazene, 0.5), dolni: kvantil(serazene, 0.25), horni: kvantil(serazene, 0.75), n };
    });
}

// Souvislé úseky řady bez null (křivka i pásmo se v mezerách přeruší): pole polí [index, hodnota]
export function useky(rada) {
    const vysledek = [];
    let usek = [];
    rada.forEach((v, i) => {
        if (v === null || v === undefined) {
            if (usek.length) vysledek.push(usek);
            usek = [];
        } else usek.push([i, v]);
    });
    if (usek.length) vysledek.push(usek);
    return vysledek;
}
