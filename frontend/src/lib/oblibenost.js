// Čistá logika části Oblíbenost (app/oblibenost.js): náhledy alb v porovnání, klávesy náhledů a texty složek
// pořadí (srdíčka, skóre fotek, porovnání). Bez stránky, aby šla testovat.

// Kolik náhledů fotek má každá modelka pod velkou fotkou v porovnání
export const NAHLEDU_V_POROVNANI = 8;

// Klávesa náhledů v porovnání (obě strany najednou, levá i pravá stejná pozice, aby se porovnávala n-tá nejlepší
// fotka s n-tou nejlepší):
//   1–8  ukáže velký n-tý náhled (číslice hlavní řady i numerické klávesnice; podle e.code, takže funguje i
//        v české klávesnici, kde hlavní řada píše ě š č…),
//   0    vrátí titulní fotky,
//   ↑    další náhled (po posledním zase titulní), Shift+↑ předchozí.
// Šipky ← → ↓, mezerník, S a Backspace zůstávají volbě. Vrací { index } (−1 = titulní), { posun } nebo null.
export function klavesaNahledu({ key = '', code = '', shiftKey = false } = {}) {
    const cislice = /^(?:Digit|Numpad)([0-9])$/.exec(code)?.[1] ?? (/^[0-9]$/.test(key) ? key : null);
    if (cislice !== null) {
        const n = Number(cislice);
        if (n === 0) return { index: -1 };
        return n <= NAHLEDU_V_POROVNANI ? { index: n - 1 } : null;
    }
    if (key === 'ArrowUp') return { posun: shiftKey ? -1 : 1 };
    return null;
}

// Další náhled při listování: −1 je titulní fotka, pak 0 … pocet − 1 a zase titulní
export function posunoutNahled(soucasny, pocet, posun) {
    if (pocet <= 0) return -1;
    const delka = pocet + 1;
    return ((soucasny + 1 + posun) % delka + delka) % delka - 1;
}

// Náhled k zobrazení na straně s daným počtem náhledů: index za koncem řady (modelka má méně fotek) ukáže titulní
export const nahledNaStrane = (index, pocet) => index >= 0 && index < pocet ? index : -1;

const cislo1 = n => (Number(n) || 0).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Skóre fotek v řádku pořadí: „fotky 4,3“; bez hodnocených fotek prázdné
export const textSkoreFotek = skore => Number(skore) > 0 ? `fotky ${cislo1(skore)}` : '';

// Popisek náhledu: „Album · ♥♥♥♥ · 3. náhled“
export function popisNahledu(nahled, index) {
    const srdicka = nahled?.hodnoceni > 0 ? '♥'.repeat(Math.min(5, nahled.hodnoceni)) : 'bez srdíček';
    return [nahled?.album, srdicka, `${index + 1}. náhled`].filter(Boolean).join(' · ');
}

// Věta o váze fotek v pořadí: naučená z porovnání, nebo výchozí
export function textVahyFotek({ vahaFotek = 0, vahaNaucena = false, porovnaniVahy = 0, zlepseniFotek = 0 } = {}) {
    const procenta = `${Math.round(Math.max(0, Math.min(1, Number(vahaFotek) || 0)) * 100)} %`;
    if (!vahaNaucena) {
        return `Skóre fotek váží v pořadí ${procenta} (výchozí). Naučí se z porovnání modelek se stejnými srdíčky${porovnaniVahy ? ` – zatím ${porovnaniVahy}, potřeba aspoň 10` : ''}.`;
    }
    const zlepseni = Math.round((Number(zlepseniFotek) || 0) * 100);
    const predpoved = zlepseni > 0 ? `, předpověď porovnání je díky fotkám o ${zlepseni} % lepší`
        : zlepseni < 0 ? ', fotky zatím porovnání nepředpovídají' : '';
    return `Skóre fotek váží v pořadí ${procenta}, naučeno podle ${porovnaniVahy} porovnání modelek se stejnými srdíčky${predpoved}.`;
}
