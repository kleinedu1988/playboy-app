// Výkonové testy (0.02.047): nejlepší čas z několika běhů po zahřátí. Souběžně běžící testovací soubory, GC a JIT
// jednotlivé měření občas protáhnou na násobek; nejlepší běh ukazuje, kolik výpočet opravdu stojí. Pomalý
// algoritmus (třeba O(n²) místo O(n log n)) je pomalý v každém běhu, takže ho test dál odhalí.
/** @template T @param {() => T} fn @param {number} [opakovani] @returns {{ ms: number, vysledek: T }} */
export function nejlepsiCas(fn, opakovani = 5) {
    let vysledek = fn();
    let ms = Infinity;
    for (let i = 0; i < opakovani; i++) {
        const t0 = performance.now();
        vysledek = fn();
        ms = Math.min(ms, performance.now() - t0);
    }
    return { ms, vysledek };
}
