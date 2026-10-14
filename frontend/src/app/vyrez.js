// Úprava výřezu titulní fotky
import { obrazek, sjednotit } from '../lib/format';
import { SetCoverVyrez } from './backend';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { gallery } from './prvky';
import { VELIKOST_TITULNI } from './obrazky';
import { stylVyrezu } from './navigace';
import { potvrdit } from './formular-modelky';

// Úprava výřezu titulní fotky přímo na kartě: tažením posun, kolečkem nebo posuvníkem přiblížení
export function upravitVyrez(modelka) {
    if (stav.zrusitUpravuVyrezu) stav.zrusitUpravuVyrezu();

    const card = gallery.querySelector(`.card[data-id="${modelka.id}"]`);
    if (!card) return;
    const ram = card.querySelector('.card-image-wrap');
    const img = ram.querySelector('img');
    // Při úpravě se přibližuje až čtyřikrát, karta proto dostane větší obrázek
    if (modelka.coverUrl) img.src = obrazek(modelka.coverUrl, VELIKOST_TITULNI);
    const vyrez = { coverZoom: modelka.coverZoom, coverX: modelka.coverX, coverY: modelka.coverY };

    card.classList.add('editing');
    // Ovládání v plovoucím panelu přímo na fotce; jméno pod fotkou zůstává
    const ik = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const panel = document.createElement('div');
    panel.className = 'crop-panel';
    panel.title = 'Fotku posuň tažením, přibliž kolečkem nebo posuvníkem';
    panel.innerHTML = `
        <input type="range" class="crop-zoom" min="1" max="4" step="0.01" title="Přiblížení" />
        <div class="crop-tlacitka">
            <button type="button" class="panel-btn" data-akce="reset" title="Výchozí výřez">${ik('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>')}</button>
            <button type="button" class="panel-btn" data-akce="zrusit" title="Zrušit (Esc)">${ik('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
            <button type="button" class="panel-btn crop-ulozit" data-akce="ulozit" title="Uložit výřez">${ik('<path d="M5 12l5 5 9-10"/>')}</button>
        </div>
    `;
    // Panel leží na kartě nad fotkou, ne v rámu fotky: přiblížená fotka je samostatná vrstva a ve WebKitu
    // by panel v témže rámu překryla. Kliknutí ani tažení v panelu fotku neposouvá.
    card.append(panel);
    ['pointerdown', 'click'].forEach(typ => panel.addEventListener(typ, (e) => e.stopPropagation()));
    const posuvnik = panel.querySelector('.crop-zoom');

    const omezit = (hodnota, min, max) => Math.min(max, Math.max(min, hodnota));
    const vykreslit = () => {
        img.style.cssText = stylVyrezu(vyrez);
        posuvnik.value = vyrez.coverZoom;
    };
    vykreslit();

    // O kolik pixelů fotka po přiblížení přesahuje rám v každé ose
    const presah = () => {
        const sirka = ram.clientWidth;
        const vyska = ram.clientHeight;
        const pomer = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : sirka / vyska;
        return {
            x: Math.max(sirka, vyska * pomer) * vyrez.coverZoom - sirka,
            y: Math.max(vyska, sirka / pomer) * vyrez.coverZoom - vyska,
        };
    };

    let tazeni = null;
    const naStisk = (e) => {
        if (e.button !== 0) return;
        tazeni = { x: e.clientX, y: e.clientY };
        ram.setPointerCapture(e.pointerId);
    };
    const naPohyb = (e) => {
        if (!tazeni) return;
        const p = presah();
        if (p.x > 0) vyrez.coverX = omezit(vyrez.coverX - (e.clientX - tazeni.x) / p.x * 100, 0, 100);
        if (p.y > 0) vyrez.coverY = omezit(vyrez.coverY - (e.clientY - tazeni.y) / p.y * 100, 0, 100);
        tazeni = { x: e.clientX, y: e.clientY };
        vykreslit();
    };
    const naUvolneni = () => { tazeni = null; };
    const naKolecko = (e) => {
        e.preventDefault();
        vyrez.coverZoom = omezit(vyrez.coverZoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 4);
        vykreslit();
    };

    ram.addEventListener('pointerdown', naStisk);
    ram.addEventListener('pointermove', naPohyb);
    ram.addEventListener('pointerup', naUvolneni);
    ram.addEventListener('pointercancel', naUvolneni);
    ram.addEventListener('wheel', naKolecko, { passive: false });
    // Kolečko nad panelem také přibližuje, stránka se přitom neposouvá
    panel.addEventListener('wheel', naKolecko, { passive: false });
    posuvnik.addEventListener('input', () => {
        vyrez.coverZoom = parseFloat(posuvnik.value);
        vykreslit();
    });

    let naAkci = null;
    const ukoncit = () => {
        panel.removeEventListener('click', naAkci, true);
        ram.removeEventListener('pointerdown', naStisk);
        ram.removeEventListener('pointermove', naPohyb);
        ram.removeEventListener('pointerup', naUvolneni);
        ram.removeEventListener('pointercancel', naUvolneni);
        ram.removeEventListener('wheel', naKolecko);
        card.classList.remove('editing');
        panel.remove();
        img.style.cssText = stylVyrezu(modelka);
        stav.zrusitUpravuVyrezu = null;
    };
    stav.zrusitUpravuVyrezu = ukoncit;

    naAkci = async (e) => {
        const akce = e.target.closest('[data-akce]')?.dataset.akce;
        if (!akce) return;
        e.stopPropagation();

        if (akce === 'reset') {
            Object.assign(vyrez, { coverZoom: 1, coverX: 50, coverY: 50 });
            vykreslit();
        } else if (akce === 'zrusit') {
            ukoncit();
        } else if (akce === 'ulozit') {
            if (await SetCoverVyrez(modelka.id, vyrez.coverZoom, vyrez.coverX, vyrez.coverY)) {
                Object.assign(modelka, vyrez);
            }
            ukoncit();
        }
    };
    panel.addEventListener('click', naAkci, true);
}

// Stejná modelka se nemá omylem založit dvakrát; vrací, zda se má pokračovat
export async function neniDuplicitni(modelka) {
    const jmena = m => [m.jmeno, ...(m.dalsiJmena || '').split(',')].map(sjednotit).filter(Boolean);
    const nova = jmena(modelka);
    const stejna = (await vsechnyModelky()).find(m => jmena(m).some(j => nova.includes(j)));
    return !stejna || potvrdit('Modelka už existuje', `V databázi už je modelka „${stejna.jmeno}“ se stejným jménem nebo pseudonymem. Opravdu přidat další?`, 'Přesto přidat');
}