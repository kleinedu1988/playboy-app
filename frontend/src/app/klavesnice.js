// Ovládání klávesnicí: dlaždice a karty jdou zaměřit Tabem a otevřít Enterem, okna a prohlížeč drží fokus
// uvnitř a po zavření ho vrátí tam, odkud se otevřely
import { otevritNabidku } from './nabidky';

// Co jde zaměřit a otevřít: karta modelky, dlaždice fotky, plakát, centerfold na stěně, cover
// a v Přehledu políčko mapy edice a řádek tabulky Vývoj v čase
const AKTIVOVATELNE = '.card, .photo-item[data-index], .poster[data-index], .wall-item, .cislo, .uvod-rok i[data-cislo], [data-vyvoj-radek]';
const FOKUSOVATELNE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Okno nebo prohlížeč, který je právě nahoře
function horniVrstva() {
    // Přehled zkratek leží nad vším ostatním
    return document.querySelector('#zkratky:not(.hidden) .zkratky')
        || [...document.querySelectorAll('.modal-overlay:not(.hidden)')].pop()
        || document.querySelector('#lightbox:not(.hidden)');
}

const viditelne = koren => [...koren.querySelectorAll(FOKUSOVATELNE)].filter(p => p.offsetParent || p === document.activeElement);

export function pripravit() {
    document.addEventListener('keydown', (e) => {
        // Zaměřená dlaždice: Enter a mezerník ji otevřou (s Ctrl nebo Shift přidají do výběru)
        const prvek = e.target.closest?.(AKTIVOVATELNE);
        if (prvek && prvek === e.target && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            prvek.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey }));
            return;
        }
        // Zaměřená karta nebo dlaždice fotky: 1–5 srdíčka, 0 je zruší (jako v prohlížeči)
        const sSrdicky = prvek === e.target && /^[0-5]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && prvek.querySelector(':scope > * .hearts, :scope > .hearts');
        if (sSrdicky) {
            e.preventDefault();
            const soucasne = sSrdicky.querySelectorAll('.heart.on').length;
            // Klik na současné hodnocení ho ruší; 0 tedy klikne na současné, stejné číslo nedělá nic
            const hodnota = e.key === '0' ? soucasne : parseInt(e.key) === soucasne ? 0 : parseInt(e.key);
            if (hodnota) sSrdicky.querySelector(`.heart[data-hodnota="${hodnota}"]`)?.click();
            return;
        }
        // Tab nevyjde z otevřeného okna ani z prohlížeče
        if (e.key !== 'Tab') return;
        const vrstva = horniVrstva();
        if (!vrstva) return;
        const prvky = viditelne(vrstva);
        if (!prvky.length) return;
        const kde = prvky.indexOf(document.activeElement);
        if (kde === -1 || (e.shiftKey && kde === 0) || (!e.shiftKey && kde === prvky.length - 1)) {
            e.preventDefault();
            (e.shiftKey ? prvky.at(-1) : prvky[0]).focus();
        }
    });

    // Klávesa nabídky a Shift+F10 vyvolají událost contextmenu bez souřadnic myši: nabídka se ukáže u prvku
    document.addEventListener('contextmenu', (e) => {
        // Políčko mapy edice má vlastní nabídku čísla (prehled.js)
        if (e.clientX || e.clientY || e.target.closest('input, textarea, select, .uvod-rok i[data-cislo]')) return;
        const prvek = e.target.closest?.(AKTIVOVATELNE) || e.target;
        if (!(prvek instanceof Element)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const r = prvek.getBoundingClientRect();
        otevritNabidku(prvek, r.left + 8, r.top + 8);
    }, true);

    // Otevřené okno dostane fokus, zavřené ho vrátí prvku, ze kterého se otevřelo
    const predOtevrenim = new Map();
    const pozorovatel = new MutationObserver((zmeny) => {
        for (const zmena of zmeny) {
            const vrstva = /** @type {Element} */ (zmena.target);
            const otevrena = !vrstva.classList.contains('hidden');
            if (otevrena && !predOtevrenim.has(vrstva)) {
                predOtevrenim.set(vrstva, document.activeElement);
                requestAnimationFrame(() => {
                    if (!vrstva.contains(document.activeElement)) viditelne(vrstva)[0]?.focus({ preventScroll: true });
                });
            } else if (!otevrena && predOtevrenim.has(vrstva)) {
                const kam = predOtevrenim.get(vrstva);
                predOtevrenim.delete(vrstva);
                if (kam?.isConnected && !horniVrstva()) kam.focus({ preventScroll: true });
            }
        }
    });
    document.querySelectorAll('.modal-overlay, #lightbox').forEach(v => pozorovatel.observe(v, { attributes: true, attributeFilter: ['class'] }));
}
