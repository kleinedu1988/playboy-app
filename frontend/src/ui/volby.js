// Volby přehledu (řazení, filtr srdíček, výběr, edice) jako rozbalovací tlačítka „Řazení: A–Z ▾“ nad obsahem.
// Přehled vykreslí obyčejné štítky (.chip s data atributem), tady se seskupí podle atributu do tlačítek
// s nabídkou. Štítky zůstanou skryté v řádku: položka nabídky na ně klikne, takže obsluha přehledu se nemění.
import { otevritKontextovouNabidku } from './nabidka';

const POPISKY = {
    razeniGalerie: 'Řazení',
    razeniSteny: 'Řazení',
    minHodnoceni: 'Srdíčka',
    nejlepsiMin: 'Srdíčka',
    vyberId: 'Výběr',
    edice: 'Edice',
};

// Filtr, který se dá vypnout: bez zvoleného štítku ukazuje „vše“ a nabídka má položku Vše
const VYPINATELNE = new Set(['minHodnoceni']);

// Text štítku bez počtu (výběr má počet v <span>)
const textStitku = (stitek) => (stitek.childNodes[0]?.textContent || stitek.textContent).trim();

export function prevestNaVolby(lista) {
    if (!lista) return;
    const skupiny = new Map();
    lista.querySelectorAll('.chip').forEach(stitek => {
        const klic = Object.keys(stitek.dataset)[0];
        if (!POPISKY[klic]) return;
        if (!skupiny.has(klic)) skupiny.set(klic, []);
        skupiny.get(klic).push(stitek);
    });
    if (!skupiny.size) return;

    const skryte = document.createElement('span');
    skryte.hidden = true;
    skupiny.forEach((stitky, klic) => {
        const zvoleny = stitky.find(s => s.classList.contains('active'));
        const tlacitko = document.createElement('button');
        tlacitko.type = 'button';
        tlacitko.className = 'volba';
        tlacitko.classList.toggle('zapnuto', VYPINATELNE.has(klic) && Boolean(zvoleny));
        tlacitko.setAttribute('aria-haspopup', 'menu');
        const hodnota = zvoleny ? textStitku(zvoleny) : VYPINATELNE.has(klic) ? 'vše' : '—';
        tlacitko.innerHTML = `<span>${POPISKY[klic]}:</span> <b></b> <i aria-hidden="true">▾</i>`;
        tlacitko.querySelector('b').textContent = hodnota;
        tlacitko.addEventListener('click', (e) => {
            e.stopPropagation();
            const polozky = stitky.map(s => ({ text: `${s === zvoleny ? '✓ ' : ''}${s.textContent.trim()}`, akce: () => s.click() }));
            // Vypnutí filtru: klik na zvolený štítek ho zruší
            if (VYPINATELNE.has(klic)) polozky.unshift({ text: `${zvoleny ? '' : '✓ '}Vše`, akce: () => zvoleny?.click() });
            const r = tlacitko.getBoundingClientRect();
            otevritKontextovouNabidku(r.left, r.bottom + 4, polozky);
        });
        stitky[0].before(tlacitko);
        skryte.append(...stitky);
    });
    lista.querySelectorAll('.oddelovac').forEach(o => o.remove());
    lista.append(skryte);
}
