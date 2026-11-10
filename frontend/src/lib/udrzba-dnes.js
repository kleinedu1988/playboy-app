// Dnes v Údržbě (app/udrzba-dnes.js, ROADMAP 1.51): výpočty bez okna – pokrok dne z počtu otevřených úkolů,
// série dní s prací a výběr dnešní dávky („15 minut práce“ ≈ 30 úkolů) napříč frontou a ostatními režimy.

export const CIL_DNE = 30;

/**
 * Pokrok dne: kolik úkolů ubylo od prvního otevření Údržby dnes. Přibyté úkoly (nové modelky) pokrok nesnižují:
 * začátek se posune nahoru, když je otevřených víc než na začátku.
 * @param {{ den?: string, zacatek?: number, vyrizeno?: number } | null} ulozeny
 * @param {string} dnes RRRR-MM-DD
 * @param {number} otevrenych
 */
export function pokrokDne(ulozeny, dnes, otevrenych) {
    if (!ulozeny || ulozeny.den !== dnes || !Number.isFinite(ulozeny.zacatek)) return { den: dnes, zacatek: otevrenych, vyrizeno: 0 };
    const drive = Math.max(0, ulozeny.vyrizeno || 0);
    // Ubylo od posledního zápisu: k dřívějšímu pokroku; přibylo: nový začátek, pokrok zůstává
    const zacatek = Math.max(ulozeny.zacatek, otevrenych + drive);
    return { den: dnes, zacatek, vyrizeno: Math.max(drive, zacatek - otevrenych) };
}

const posunDne = (den, o) => {
    const d = new Date(`${den}T12:00:00`);
    d.setDate(d.getDate() + o);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Série dní v řadě s aspoň jedním vyřízeným úkolem, končící dneškem (nebo včerejškem, když dnes ještě nic)
 * @param {string[]} dny
 * @param {string} dnes
 */
export function serieDni(dny, dnes) {
    const mnozina = new Set(dny);
    let den = mnozina.has(dnes) ? dnes : posunDne(dnes, -1);
    let serie = 0;
    while (mnozina.has(den)) {
        serie++;
        den = posunDne(den, -1);
    }
    return serie;
}

/** Dny s prací: přidá dnešek a nechá posledních 400 */
export function pridatDen(dny, dnes) {
    return [...new Set([...(dny || []), dnes])].sort().slice(-400);
}

/**
 * Dnešní dávka: nejcennější skupiny fronty (modelka nebo číslo s otevřenými úkoly) tak, aby s rychlými dávkami
 * z ostatních režimů (otočené, výměny za lepší, výřezy, Z webu, stejné fotky – každá počítaná nejvýš po DAVCE)
 * vyšlo asi CIL_DNE úkolů. Skupina se počítá podle počtu otevřených položek.
 * @template {{ klic: string, priorita: number, aktivnich: number }} T
 * @param {T[]} skupiny seřazené podle priority
 * @param {number} rychlych úkolů v rychlých dávkách
 * @param {number} cil
 */
export function vybratSkupiny(skupiny, rychlych = 0, cil = CIL_DNE) {
    /** @type {T[]} */
    const vybrane = [];
    let ukolu = Math.min(rychlych, Math.floor(cil / 2));
    for (const s of [...skupiny].filter(s => s.aktivnich > 0).sort((a, b) => b.priorita - a.priorita)) {
        if (ukolu >= cil) break;
        vybrane.push(s);
        ukolu += s.aktivnich;
    }
    return vybrane;
}

// Rychlá dávka z režimu se do dne počítá nejvýš tolika úkoly
export const DAVKA = 6;
