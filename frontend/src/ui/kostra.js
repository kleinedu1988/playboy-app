// Obrysy obsahu, dokud se nenačte: šedé karty s jemnou vlnou (při prvním otevření přehledu, v profilu jiné modelky).
// Data přepíšou obrysy celé, nic se neodstraňuje zvlášť.

// Mřížka karet 3:4 (galerie, centerfoldy, čísla, nejlepší); s popisem = proužek se jménem pod obrázkem
export function htmlKostryKaret(pocet = 12, { sPopisem = true } = {}) {
    const karta = `<div class="kostra-karta"><i></i>${sPopisem ? '<b></b>' : ''}</div>`;
    return `<div class="kostra kostra-karty" aria-hidden="true">${karta.repeat(pocet)}</div>`;
}

// Alba v profilu: nadpis alba a řada fotek, dvakrát
export function htmlKostryAlb() {
    const album = `<div class="kostra-album"><b></b><div>${'<i></i>'.repeat(5)}</div></div>`;
    return `<div class="kostra" aria-hidden="true">${album.repeat(2)}</div>`;
}
