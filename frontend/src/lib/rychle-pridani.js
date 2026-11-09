// Rychlé okno Nová modelka (Ctrl+Shift+N): odhady z čísla prvního výskytu. Národnost = nejčastější národnost
// modelek se stejnou edicí v okolí roku (jen když je zřetelně nejčastější), obvyklý věk = medián věku v prvním
// čísle u modelek z okolí roku; pole Narození přijme datum, rok, nebo věk v čísle (z něj rok narození).
import { platneDatum, rozlozitVydani } from './format.js';

export const OKOLI_LET = 10;
export const MIN_MODELEK_ODHADU = 5;
export const MIN_PODIL_NARODNOSTI = 0.6;

// První číslo modelky (nejstarší vydání v časopise) jako { rok, mesic, edice } nebo null
function prvniCislo(m) {
    const vydani = (m.vydani || []).map(rozlozitVydani).filter(Boolean).sort((a, b) => a.rok.localeCompare(b.rok) || a.mesic.localeCompare(b.mesic));
    return vydani[0] || null;
}

const vOkoli = (c, edice, rok) => c && (!edice || c.edice === edice) && (!rok || Math.abs(parseInt(c.rok) - rok) <= OKOLI_LET);

// { narodnost, podil, pocet } nebo null
export function odhadNarodnosti(modelky, edice, rok = 0) {
    const pocty = new Map();
    let celkem = 0;
    for (const m of modelky || []) {
        const n = String(m.narodnost || '').trim();
        if (!n || !vOkoli(prvniCislo(m), edice, rok)) continue;
        pocty.set(n, (pocty.get(n) || 0) + 1);
        celkem++;
    }
    if (celkem < MIN_MODELEK_ODHADU) return null;
    const [narodnost, pocet] = [...pocty].sort((a, b) => b[1] - a[1])[0];
    const podil = pocet / celkem;
    return podil >= MIN_PODIL_NARODNOSTI ? { narodnost, podil, pocet: celkem } : null;
}

// Medián věku v prvním čísle (celé roky) u modelek z okolí roku; null bez dost dat
export function obvyklyVek(modelky, edice, rok) {
    const veky = [];
    for (const m of modelky || []) {
        const c = prvniCislo(m), n = /^(\d{4})(?:-(\d{2}))?/.exec(m.narozeniDatum || '');
        if (!n || !vOkoli(c, edice, rok)) continue;
        const vek = parseInt(c.rok) - parseInt(n[1]) - (n[2] && /^\d{2}$/.test(c.mesic) && parseInt(c.mesic) < parseInt(n[2]) ? 1 : 0);
        if (vek > 14 && vek < 70) veky.push(vek);
    }
    if (veky.length < MIN_MODELEK_ODHADU) return null;
    veky.sort((a, b) => a - b);
    return veky[Math.floor((veky.length - 1) / 2)];
}

// Text pole Narození: { datum } (k uložení, '' = nic), { datum, vek } z věku v čísle, nebo { chyba }
export function prevestNarozeni(text, rokCisla = 0) {
    const t = String(text || '').trim();
    if (!t) return { datum: '' };
    const vek = /^(\d{1,2})(?:\s*(?:let|roků|r\.?))?$/i.exec(t);
    if (vek) {
        const n = parseInt(vek[1]);
        if (!rokCisla) return { chyba: 'Věk jde převést na rok narození jen s rokem prvního výskytu.' };
        if (n < 15 || n > 70) return { chyba: 'Věk v čísle má být mezi 15 a 70 lety.' };
        return { datum: String(rokCisla - n), vek: n };
    }
    return platneDatum(t) ? { datum: t } : { chyba: 'Datum zadej jako RRRR-MM-DD, RRRR-MM nebo rok, případně věk v čísle.' };
}
