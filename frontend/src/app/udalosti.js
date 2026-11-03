// Sběrnice změn: moduly si tu registrují, co mají zahodit, když se data v databázi změní
const posluchaci = [];

// rozsah: 'vse' (výchozí) nebo 'hodnoceni' – zápis změnil jen hodnocení (srdíčka, souboje, tagy, ověření souborů)
/** @param {(rozsah: 'vse' | 'hodnoceni') => void} fn */
export function poZmeneDat(fn) {
    posluchaci.push(fn);
}

/** @param {'vse' | 'hodnoceni'} [rozsah] */
export function ohlasitZmenuDat(rozsah = 'vse') {
    for (const fn of posluchaci) fn(rozsah);
}
