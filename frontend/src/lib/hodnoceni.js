// Galerie (Oblíbenost › Galerie): fronta nehodnocených fotek napříč modelkami pro prohlížení s hodnocením, paměť
// přeskočených a klávesy. Jen čisté funkce; fotky posílá backend (GetNehodnoceneFotky, seřazené podle modelky a alba).

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
 * Fronta fotek: razeni 'nahodne' = všechny fotky zamíchané, 'modelky' = modelky v náhodném pořadí a fotky každé
 * pohromadě po albech (jak je poslal backend). Přeskočené (id v pořadí přeskočení) jdou na konec.
 * @param {any[]} fotky
 * @param {{ razeni?: string, seed?: number, preskocene?: number[] }} [volby]
 */
export function frontaFotek(fotky, { razeni = 'nahodne', seed = 1, preskocene = [] } = {}) {
    let v;
    if (razeni === 'modelky') {
        const podleModelky = new Map();
        (fotky || []).forEach(f => {
            if (!podleModelky.has(f.modelkaId)) podleModelky.set(f.modelkaId, []);
            podleModelky.get(f.modelkaId).push(f);
        });
        v = zamichat([...podleModelky.keys()], seed).flatMap(id => podleModelky.get(id));
    } else {
        v = zamichat(fotky, seed);
    }
    const poradiPreskoku = new Map((preskocene || []).map((id, i) => [id, i]));
    return [
        ...v.filter(f => !poradiPreskoku.has(f.id)),
        ...v.filter(f => poradiPreskoku.has(f.id)).sort((a, b) => poradiPreskoku.get(a.id) - poradiPreskoku.get(b.id)),
    ];
}

// Paměť přeskočených: přidá id na konec (bez opakování), nejvýš posledních 2000
export const pridatPreskocenou = (preskocene, id) => [...(preskocene || []).filter(x => x !== id), id].slice(-2000);

// Srdíčka z klávesy: 1–5 nad písmeny i na numerické klávesnici (podle polohy klávesy, takže i v české klávesnici bez
// Shiftu); jinak 0
export function srdickaKlavesy(e) {
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(String(e?.code || ''));
    return m ? Number(m[1]) : 0;
}
