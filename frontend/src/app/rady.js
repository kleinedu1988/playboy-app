// Volba „Časopis a edice“ v oknech alba a coveru (0.02.005): hodnota je řada („US“, „CZ“, „PH/UK“, lib/format.js),
// takže ji slozitVydani složí do klíče čísla a výběr speciálů (specialy.js) s ní pracuje jako dřív s edicí.
// Naposledy uložená řada se pamatuje a nové album nebo cover ji nabídne.
import { esc, moznostiRad, nazevRady } from '../lib/format';
import { stav } from './stav';

const KLIC = 'posledniRadaCisla';

/** Naplní výběr řad a vybere hodnotu; řadu, která v nabídce není (smazaný časopis), přidá */
export function nastavitRadu(vyber, rada) {
    const moznosti = moznostiRad();
    if (rada && !moznosti.some(m => m.hodnota === rada)) moznosti.push({ hodnota: rada, nazev: nazevRady(rada) });
    vyber.innerHTML = moznosti.map(m => `<option value="${esc(m.hodnota)}">${esc(m.nazev)}</option>`).join('');
    vyber.value = rada && moznosti.some(m => m.hodnota === rada) ? rada : moznosti[0]?.hodnota || 'US';
}

/** Řada pro nové album nebo cover: naposledy uložená, jinak edice zobrazená v kalendáři */
export function vychoziRada() {
    try {
        const ulozena = localStorage.getItem(KLIC);
        if (ulozena && moznostiRad().some(m => m.hodnota === ulozena)) return ulozena;
    } catch { /* bez paměti */ }
    return stav.kalendarEdice;
}

// Kalendář a Obálky podle časopisu (0.02.016): zobrazená řada je stav.kalendarEdice („US“, „CZ“, „PH/US“…);
// platnost a název řady jsou v lib/format.js (platnaRadaKalendare, nazevVolbyRady)
export { nazevVolbyRady, platnaRadaKalendare } from '../lib/format';

/** Štítky řad pro volbu „Časopis a edice“ v Kalendáři a Obálkách (atribut: data-edice / data-edice-cisel) */
export function htmlStitkuRad(atribut) {
    const moznosti = moznostiRad();
    if (!moznosti.some(m => m.hodnota === stav.kalendarEdice)) moznosti.push({ hodnota: stav.kalendarEdice, nazev: nazevRady(stav.kalendarEdice) });
    return moznosti.map(m => `<button class="chip ${m.hodnota === stav.kalendarEdice ? 'active' : ''}" ${atribut}="${esc(m.hodnota)}">${esc(m.nazev)}</button>`).join('');
}

export function zapamatovatRadu(rada) {
    try { localStorage.setItem(KLIC, rada); } catch { /* jen pro toto spuštění */ }
}
