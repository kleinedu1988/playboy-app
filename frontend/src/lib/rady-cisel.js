// Řady čísel (Pinup Katalog 0.02.014): od kdy do kdy časopis v dané edici vycházel měsíčně a která čísla v tom
// období nevyšla. Klíč je řada jako v rozlozitVydani: „US“ a „CZ“ u Playboye, „PH/US“, „PH/UK“, „HU/US“ u jiných
// časopisů (od 0.02.015). Měsíc mimo řadu se v kalendáři, ročníku a mapě edice neukazuje jako chybějící
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

    // Penthouse (0.02.015). Konec řady je zapsaný spíš později než dřív: měsíc mimo řadu nejde v kalendáři přidat,
    // kdežto navíc ukázaná díra nevadí. Údaje ověřené 10. 11. 2026.
    // Americký: první číslo 09/1969, měsíčně do 2018. Od 2009 jen 11 čísel ročně, od 2017 10 – které měsíce
    // chyběly, zdroj neuvádí, proto nejsou v nevysla. 2019–2023 jednou za dva měsíce (poslední tištěné číslo
    // červenec–srpen 2023); ta čísla se zapisují prvním měsícem a v řadě už nejsou.
    'PH/US': { od: '1969-09', do: '2018-12', nevysla: [], zdroj: 'https://en.wikipedia.org/wiki/Penthouse_(magazine)' },
    // Britský: první číslo 03/1965, zanikl 1999 (stránka uvádí i konec PH.UK koncem 1998); krátké obnovení
    // 2001–2006 v řadě není.
    'PH/UK': { od: '1965-03', do: '1999-12', nevysla: [], zdroj: 'https://en.wikipedia.org/wiki/Penthouse_(magazine)' },

    // Hustler: první číslo 07/1974, měsíčník; konec tisku ani vynechaná čísla zdroj neuvádí.
    'HU/US': { od: '1974-07', do: '', nevysla: [], zdroj: 'https://en.wikipedia.org/wiki/Hustler_(magazine)' },
};
