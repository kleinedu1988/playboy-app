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

const mistaText = n => `${n} ${n === 1 ? 'místo' : n >= 2 && n <= 4 ? 'místa' : 'míst'}`;

// Trend modelky: posun v pořadí oblíbenosti proti snímku před trendDni dny ({ smer, znak, text }), nebo null
// (trend zatím není nebo je menší než min míst; na kartě se ukazuje jen výrazný)
export function trendModelky(modelka, min = 1) {
    const zmena = Number(modelka?.zmenaPoradi) || 0;
    const dni = Number(modelka?.trendDni) || 0;
    if (!dni || !zmena || Math.abs(zmena) < min) return null;
    const kdy = dni === 1 ? 'než včera' : `než před ${dni} dny`;
    const kratce = `${Math.abs(zmena)} ${dni === 1 ? 'od včera' : `za ${dni} dní`}`;
    return zmena > 0
        ? { smer: 'nahoru', znak: '▲', text: `o ${mistaText(zmena)} výš ${kdy}`, kratce }
        : { smer: 'dolu', znak: '▼', text: `o ${mistaText(-zmena)} níž ${kdy}`, kratce };
}

// Řádek pod srdíčky v profilu: „12. v oblíbenosti · ▲ o 3 místa výš než před 30 dny“; bez pořadí prázdný
export function textPoradiProfilu(modelka) {
    if (!(Number(modelka?.poradi) > 0)) return null;
    return { poradi: `${modelka.poradi}. v oblíbenosti`, trend: trendModelky(modelka) };
}

// Řazení fotek podle srdíček, se stejnými srdíčky podle oblíbenosti modelky (oblibenost: Map id → oblíbenost)
export const porovnatFotkyPodleSrdicek = oblibenost => (x, y) =>
    (y.hodnoceni || 0) - (x.hodnoceni || 0) || (oblibenost.get(y.modelkaId) || 0) - (oblibenost.get(x.modelkaId) || 0);

// Věta o zájmu v pořadí: od kdy si program všímá otevírání profilů a prohlížení fotek a kolik zájem váží
export function textVahyZajmu({ vahaZajmu = 0, zajemNaucen = false, porovnaniZajmu = 0, zajemDni = 0 } = {}) {
    const vaha = (Number(vahaZajmu) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 3 });
    if (!zajemDni && !zajemNaucen) {
        return 'Pořadí uvnitř srdíček posouvá i zájem: jak často otevíráš profil a jak dlouho prohlížíš fotky (čerstvý zájem víc).';
    }
    return zajemNaucen
        ? `Zájem (profil a fotky, poslední měsíce víc) posouvá sílu až o ${vaha} srdíčka na stupeň, naučeno z ${porovnaniZajmu} porovnání.`
        : `Zájem (profil a fotky, poslední měsíce víc) posouvá sílu až o ${vaha} srdíčka na stupeň (výchozí, naučí se z porovnání modelek se stejnými srdíčky).`;
}

// Stoupající a klesající v pořadí (posun aspoň o 3 místa a 3 % délky pořadí), nejvýš po pěti
export function stoupajiKlesaji(poradi, kolik = 5) {
    const prah = Math.max(3, Math.floor(poradi.length * 3 / 100));
    const stoupaji = poradi.filter(p => (p.zmenaPoradi || 0) >= prah).sort((a, b) => b.zmenaPoradi - a.zmenaPoradi).slice(0, kolik);
    const klesaji = poradi.filter(p => (p.zmenaPoradi || 0) <= -prah).sort((a, b) => a.zmenaPoradi - b.zmenaPoradi).slice(0, kolik);
    return { stoupaji, klesaji };
}
