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

// Stálá náhodná hodnota pro klíč a semínko (0–1): pořadí podle ní se nemění, když z fronty položky ubudou
export function nahodaKlice(klic, seed = 1) {
    let t = (Math.imul(Number(klic) || 0, 0x9e3779b1) ^ Math.imul(seed >>> 0, 0x85ebca6b)) >>> 0;
    t = Math.imul(t ^ (t >>> 16), 0x7feb352d);
    t = Math.imul(t ^ (t >>> 15), 0x846ca68b);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

// Klíč položky prohlížeče (fotka, nebo spojený plakát): id první fotky
const klicPolozky = p => p?.fotky?.[0]?.id ?? p?.id ?? 0;

/**
 * Fronta položek prohlížeče (fotka, nebo spojený plakát): razeni 'nahodne' = vše zamíchané, 'modelky' = modelky
 * v náhodném pořadí a položky každé pohromadě (po albech, jak přišly). Pořadí je stálé pro dané semínko i po
 * vyřazení ohodnocených položek (řadí se podle nahodaKlice, ne mícháním), takže se na frontu dá navázat.
 * @param {any[]} polozky
 * @param {{ razeni?: string, seed?: number }} [volby]
 */
export function frontaFotek(polozky, { razeni = 'nahodne', seed = 1 } = {}) {
    const podle = (klic) => (x, y) => nahodaKlice(klic(x), seed) - nahodaKlice(klic(y), seed) || klic(x) - klic(y);
    if (razeni !== 'modelky') return [...(polozky || [])].sort(podle(klicPolozky));
    const podleModelky = new Map();
    (polozky || []).forEach(p => {
        if (!podleModelky.has(p.modelkaId)) podleModelky.set(p.modelkaId, []);
        podleModelky.get(p.modelkaId).push(p);
    });
    return [...podleModelky.keys()].sort(podle(id => id)).flatMap(id => podleModelky.get(id));
}
