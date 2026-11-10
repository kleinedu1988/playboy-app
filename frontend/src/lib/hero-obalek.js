// Hero Obálek (0.02.024): které obálky zvolené řady střídat nahoře a kolik obálek řadě chybí. Vstupem jsou fotky
// coverů (GetCovery: { album | vydani, url, hodnoceni }) a čísla řady z kalendáře.
import { ciselRocniku, cisloNevyslo, rozlozitVydani } from './format.js';

const vydaniFotky = f => f.vydani || f.album || '';

/**
 * Obálky řady v pořadí pro hero: napřed čísla z dnešního měsíce dřívějších let (výročí), pak ostatní; uvnitř obou
 * skupin nejvýš hodnocené, při shodě novější. Jedno číslo jednou (jeho nejlépe hodnocený cover).
 * @param {any[]} covery @param {string} rada @param {Date} [dnes]
 * @returns {{ vydani: string, url: string, hodnoceni: number, vyroci: boolean }[]}
 */
export function poradiObalekHero(covery, rada, dnes = new Date()) {
    const mesic = String(dnes.getMonth() + 1).padStart(2, '0');
    const podleCisla = new Map();
    for (const f of covery) {
        const vydani = vydaniFotky(f);
        const v = rozlozitVydani(vydani);
        if (!v || v.edice !== rada || !f.url) continue;
        const dosud = podleCisla.get(vydani);
        if (!dosud || (f.hodnoceni || 0) > dosud.hodnoceni) {
            podleCisla.set(vydani, { vydani, url: f.url, hodnoceni: f.hodnoceni || 0, vyroci: v.mesic === mesic && parseInt(v.rok, 10) < dnes.getFullYear() });
        }
    }
    return [...podleCisla.values()].sort((a, b) => Number(b.vyroci) - Number(a.vyroci) || b.hodnoceni - a.hodnoceni || b.vydani.localeCompare(a.vydani));
}

/**
 * Počty obálek řady: měsíční čísla s coverem a kolik coverů chybí v ročnících, ze kterých sbírka něco má
 * @param {{ vydani: string, cover?: boolean }[]} cisla čísla řady z kalendáře
 * @param {string} rada
 */
export function poctyObalek(cisla, rada) {
    const mesicni = cisla.filter(k => /^\d\d$/.test(rozlozitVydani(k.vydani)?.mesic || '') && !cisloNevyslo(k.vydani));
    const sCoverem = mesicni.filter(k => k.cover).length;
    const roky = [...new Set(mesicni.map(k => parseInt(k.vydani.slice(0, 4), 10)))];
    const vysla = roky.reduce((s, r) => s + ciselRocniku(r, rada), 0);
    return { sCoverem, chybi: Math.max(0, vysla - sCoverem), rocniku: roky.length };
}
