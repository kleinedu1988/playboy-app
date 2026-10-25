// Srdíčka modelky po půlkách: řada deseti půlek (levá půlka srdíčka = x,5, pravá = celé), aby najetí myší
// ukázalo přesně, co klik nastaví, jen styly (sourozenci za kurzorem zůstanou obrysem). Tvar kreslí maska SVG
// v style.css (.hearts-pul). Obal je pro čtečky posuvník (role slider, „3,5 srdíčka“); klávesy řeší
// klavesaSrdicekModelky – kliknou na půlku s novou hodnotou, takže klávesnice i myš jdou stejnou cestou.
import { formatSrdicek, hodnotaPoKlavese, naPulky, textSrdicek } from '../lib/srdicka';

const PULKY = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);

/**
 * @param {number} hodnoceni současné hodnocení (0–5 po půlkách)
 * @param {string} atribut atributy obalu (data-hodnoceni="id" a podobně)
 * @param {{ tabem?: boolean, posuvnik?: boolean, popis?: string, atributPulky?: string, tridy?: string }} [volby]
 *   tabem: obal je zastávkou Tabu (profil); posuvnik: obal nese roli slider (jinak ji má rodič, třeba řádek Údržby);
 *   atributPulky: data atribut s hodnotou na půlce (výchozí data-hodnota)
 */
export function htmlSrdicekModelky(hodnoceni, atribut = '', { tabem = true, posuvnik = true, popis = 'Hodnocení', atributPulky = 'data-hodnota', tridy = '' } = {}) {
    const h = naPulky(hodnoceni);
    const pulky = PULKY.map(v => `<button type="button" class="heart pulka ${v % 1 ? 'l' : 'p'} ${v <= h ? 'on' : ''}" ${atributPulky}="${v}"
        tabindex="-1" aria-hidden="true" title="${v === h ? 'Zrušit hodnocení' : `Ohodnotit ${formatSrdicek(v)} z 5`}"></button>`).join('');
    // Na kartě (bez Tabu) srdíčka hodnotí zaměřená karta klávesami; čtečce stačí hodnota jako obrázek
    const role = !posuvnik ? '' : tabem
        ? `role="slider" tabindex="0" aria-label="${popis}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${h}" aria-valuetext="${textSrdicek(h)}"`
        : `role="img" aria-label="${popis}: ${textSrdicek(h)}" aria-valuenow="${h}"`;
    return `<span class="hearts hearts-pul ${h ? 'rated' : ''} ${tridy}" ${atribut} ${role}>${pulky}</span>`;
}

// Současná hodnota řady (aria-valuenow, u řady bez role podle zapnutých půlek)
export function hodnotaRady(rada) {
    const ulozena = rada?.getAttribute('aria-valuenow');
    if (ulozena !== null && ulozena !== undefined) return naPulky(ulozena);
    return rada ? rada.querySelectorAll('.pulka.on').length / 2 : 0;
}

// Nová hodnota na místě: jen třídy a atributy, obsah se nemění (WebKitGTK by jinak mohl ztratit klik)
export function obnovitSrdickaModelky(rada, hodnoceni) {
    if (!rada) return;
    const h = naPulky(hodnoceni);
    rada.classList.toggle('rated', h > 0);
    rada.querySelectorAll('.pulka').forEach((b, i) => {
        const v = PULKY[i];
        b.classList.toggle('on', v <= h);
        b.title = v === h ? 'Zrušit hodnocení' : `Ohodnotit ${formatSrdicek(v)} z 5`;
    });
    if (rada.hasAttribute('aria-valuenow')) rada.setAttribute('aria-valuenow', String(h));
    if (rada.hasAttribute('aria-valuetext')) rada.setAttribute('aria-valuetext', textSrdicek(h));
    if (rada.getAttribute('role') === 'img') rada.setAttribute('aria-label', `${rada.getAttribute('aria-label').split(':')[0]}: ${textSrdicek(h)}`);
}

// Klávesa nad řadou srdíček modelky (zaměřená řada nebo karta): klikne na půlku s novou hodnotou, k nule na
// současnou (klik na současné hodnocení ho ruší). Vrací true, když klávesu zpracovala.
export function klavesaSrdicekModelky(e, rada, { sipky = true } = {}) {
    if (!rada || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (!sipky && /^(Arrow|Home|End)/.test(e.key)) return false;
    const soucasna = hodnotaRady(rada);
    const nova = hodnotaPoKlavese(soucasna, e.key);
    if (nova === null) return false;
    e.preventDefault();
    if (nova !== soucasna) {
        const atribut = rada.querySelector('.pulka')?.getAttributeNames().find(a => a.startsWith('data-')) || 'data-hodnota';
        /** @type {HTMLElement} */ (rada.querySelector(`.pulka[${atribut}="${nova || soucasna}"]`))?.click();
    }
    return true;
}
