// Řady čísel (Pinup Katalog 0.02.014): od kdy do kdy časopis v dané edici vycházel měsíčně a která čísla v tom
// období nevyšla. Klíč je řada jako v rozlozitVydani: „US“ a „CZ“ u Playboye, „PH/US“, „PH/UK“, „HU/US“ u jiných
// časopisů (přidá 0.02.015). Měsíc mimo řadu se v kalendáři, ročníku a mapě edice neukazuje jako chybějící
// a nedá se přidat ani označit; řada, která tu není, se bere jako bez omezení.
// od / do: první a poslední měsíční číslo (RRRR-MM, do '' = vychází dál), nevysla: měsíce v období, kdy číslo
// nevyšlo (RRRR-MM), zdroj: odkud údaje jsou.
// Jen data, bez importů (načítá je format.js).

/** @typedef {{ od: string, do: string, nevysla: string[], zdroj: string }} RadaCisel */

/** @type {Record<string, RadaCisel>} */
export const RADY_CISEL = {
    // Americký Playboy: od 12/1953 (první číslo, Marilyn Monroe) do 03/2020 (Spring 2020, poslední pravidelné
    // číslo); od 2025 vychází jen jako ročenka a čtvrtletník a ta čísla se evidují jako speciály. Číslo z března
    // 1955 nevyšlo.
    US: { od: '1953-12', do: '2020-03', nevysla: ['1955-03'], zdroj: 'převzato z Playboy Database (format.js do 0.02.013)' },
    // Česká edice od 07/2011
    CZ: { od: '2011-07', do: '', nevysla: [], zdroj: 'převzato z Playboy Database (format.js do 0.02.013)' },
};
