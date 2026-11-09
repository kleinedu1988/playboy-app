// Čipy chytrého hledání pod polem hledání: každá rozpoznaná podmínka textu (blond → Vlasy: blond, výška > 175 →
// Výška > 175 cm, 90. léta → 1990–1999, 4*+ → ♥ 4+, i ručně psané příkazy vlasy:blond) má čip, × ji z textu
// odebere a hledání se hned obnoví. Rozpoznávání je v lib/hledani-dotaz.js.
import { rozpoznat, odebrat } from '../lib/hledani-dotaz';
import { esc } from '../lib/format';
import { searchInput } from './prvky';

let prvek = null;
let casti = [];
let posledniText = null;

function vykreslit() {
    const text = searchInput.value;
    if (text === posledniText) return;
    posledniText = text;
    casti = rozpoznat(text);
    prvek.hidden = !casti.length;
    prvek.innerHTML = casti.map((c, i) => `<span class="hc-cip hc-${esc(c.druh)}${c.prikaz.startsWith('-') ? ' hc-ne' : ''}" title="${esc(`${c.text} → ${c.prikaz}`)}">
            ${esc(c.popis)}<button type="button" data-hc-odebrat="${i}" aria-label="Odebrat ${esc(c.popis)}">×</button></span>`).join('');
}

export function pripravit() {
    prvek = document.getElementById('hledaniCipy');
    if (!prvek) return;
    // Text hledání mění i kód (smazání, přepnutí pohledu, návrat v historii) bez události input: hlídá se setter
    const popis = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(searchInput, 'value', {
        configurable: true,
        get() { return popis.get.call(this); },
        set(hodnota) { popis.set.call(this, hodnota); queueMicrotask(vykreslit); },
    });
    searchInput.addEventListener('input', vykreslit);
    // mousedown: fokus zůstane v poli (našeptávač se nezavře)
    prvek.addEventListener('mousedown', e => { if (/** @type {HTMLElement} */ (e.target).closest('[data-hc-odebrat]')) e.preventDefault(); });
    prvek.addEventListener('click', (e) => {
        const tlacitko = /** @type {HTMLElement} */ (e.target).closest('[data-hc-odebrat]');
        const cast = tlacitko && casti[Number(/** @type {HTMLElement} */ (tlacitko).dataset.hcOdebrat)];
        if (!cast) return;
        searchInput.value = odebrat(searchInput.value, cast);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    vykreslit();
}
