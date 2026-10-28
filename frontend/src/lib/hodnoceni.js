// Galerie (Oblíbenost › Galerie): pořadí nehodnocených fotek napříč modelkami pro prohlížeč. Jen čisté funkce;
// fotky posílá backend (GetNehodnoceneFotky, seřazené podle modelky a alba).

// Opakovatelné zamíchání (semínko): Fisher–Yates s generátorem mulberry32; vrací kopii
export function zamichat(seznam, seed = 1) {
    let a = seed >>> 0;
    const nahoda = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const v = [...(seznam || [])];
    for (let i = v.length - 1; i > 0; i--) {
        const j = Math.floor(nahoda() * (i + 1));
        [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
}

/**
 * Fronta položek prohlížeče (fotka, nebo spojený plakát): razeni 'nahodne' = vše zamíchané, 'modelky' = modelky
 * v náhodném pořadí a položky každé pohromadě (po albech, jak přišly).
 * @param {any[]} polozky
 * @param {{ razeni?: string, seed?: number }} [volby]
 */
export function frontaFotek(polozky, { razeni = 'nahodne', seed = 1 } = {}) {
    if (razeni !== 'modelky') return zamichat(polozky, seed);
    const podleModelky = new Map();
    (polozky || []).forEach(p => {
        if (!podleModelky.has(p.modelkaId)) podleModelky.set(p.modelkaId, []);
        podleModelky.get(p.modelkaId).push(p);
    });
    return zamichat([...podleModelky.keys()], seed).flatMap(id => podleModelky.get(id));
}
