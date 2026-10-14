// Sběrnice změn: moduly si tu registrují, co mají zahodit, když se data v databázi změní
const posluchaci = [];

export function poZmeneDat(fn) {
    posluchaci.push(fn);
}

export function ohlasitZmenuDat() {
    for (const fn of posluchaci) fn();
}
