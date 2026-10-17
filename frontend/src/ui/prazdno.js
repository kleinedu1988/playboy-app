// Prázdný stav stránky: vějíř tří skleněných karet (přední s růžovým nádechem a ikonou fotky), tenký nadpis,
// jedna věta a případně tlačítko akce. Tlačítko nese data-prazdno-akce, obsluhu si přidá stránka.
import { esc } from '../lib/format';

const IKONA_FOTKY = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8.5"/></svg>';

export function htmlPrazdna(nadpis, text, tlacitko = '') {
    return `
        <div class="prazdno">
            <div class="prazdno-vejir" aria-hidden="true"><i></i><i></i><i>${IKONA_FOTKY}</i></div>
            <h4>${esc(nadpis)}</h4>
            <p>${esc(text)}</p>
            ${tlacitko ? `<button type="button" class="prazdno-tlacitko" data-prazdno-akce><span aria-hidden="true">+</span> ${esc(tlacitko)}</button>` : ''}
        </div>`;
}
