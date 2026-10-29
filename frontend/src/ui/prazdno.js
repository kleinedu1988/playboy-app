// Prázdný stav stránky: vějíř tří skleněných karet (přední s růžovým nádechem a ikonou), tenký nadpis, jedna věta
// a případně tlačítko akce. Tlačítko nese data-prazdno-akce s názvem akce; akce dodá nastavitAkcePrazdna.
import { esc } from '../lib/format';

const CESTY = {
    foto: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    hledani: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
    srdce: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
    kalendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    hvezda: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
};

const ikona = nazev => `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CESTY[nazev] || CESTY.foto}</svg>`;

// Prázdný celý pohled nebo část stránky (Top 10, Sháním CZ, Statistiky…). tlacitko = { text, akce } (akce je název
// z nastavitAkcePrazdna); odkaz = HTML odkazu pod větou, který obslouží stránka sama; ikona = klíč z CESTY
export function htmlPrazdna(nadpis, text, { tlacitko = null, odkaz = '', ikona: nazevIkony = 'foto' } = {}) {
    return `
        <div class="prazdno">
            <div class="prazdno-vejir" aria-hidden="true"><i></i><i></i><i>${ikona(nazevIkony)}</i></div>
            <h4>${esc(nadpis)}</h4>
            <p>${esc(text)}</p>
            ${odkaz}
            ${tlacitko ? `<button type="button" class="prazdno-tlacitko" data-prazdno-akce="${esc(tlacitko.akce)}">${tlacitko.akce.startsWith('pridat') ? '<span aria-hidden="true">+</span> ' : ''}${esc(tlacitko.text)}</button>` : ''}
        </div>`;
}

// Prázdná karta nebo seznam uvnitř stránky (Stoupají, filtr kroniky bez událostí, „Počítám…“): jedna tichá věta.
// html smí obsahovat odkaz (volající ho escapuje sám)
export const htmlPrazdnaMala = (html, znacka = 'p') => `<${znacka} class="prazdno-male">${html}</${znacka}>`;

// Hledání nic nenašlo: lupa a tlačítko, které zruší hledání i filtry
export const htmlNicNenalezeno = (text) => htmlPrazdna('Nic nenalezeno', text, { ikona: 'hledani', tlacitko: { text: 'Zrušit hledání a filtry', akce: 'zrusit' } });

// Akce tlačítek prázdného stavu (název → funkce); klik se obsluhuje pro celé okno
export function nastavitAkcePrazdna(akce) {
    document.addEventListener('click', (e) => {
        const tlacitko = e.target.closest('[data-prazdno-akce]');
        if (tlacitko) akce[tlacitko.dataset.prazdnoAkce]?.(e);
    });
}
