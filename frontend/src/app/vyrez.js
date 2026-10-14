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
    const info = card.querySelector('.card-info');
    const puvodniInfo = info.innerHTML;
    const vyrez = { coverZoom: modelka.coverZoom, coverX: modelka.coverX, coverY: modelka.coverY };

    card.classList.add('editing');
    info.innerHTML = `
        <p class="crop-hint">Tažením posuň, kolečkem přibliž</p>
        <input type="range" class="crop-zoom" min="1" max="4" step="0.01" title="Přiblížení" />
        <div class="crop-actions">
            <button type="button" class="btn btn-secondary btn-small" data-akce="reset">Výchozí</button>
            <button type="button" class="btn btn-secondary btn-small" data-akce="zrusit">Zrušit</button>
            <button type="button" class="btn btn-primary btn-small" data-akce="ulozit">Uložit</button>
        </div>
    `;
    const posuvnik = info.querySelector('.crop-zoom');

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
    posuvnik.addEventListener('input', () => {
        vyrez.coverZoom = parseFloat(posuvnik.value);
        vykreslit();
    });

    let naAkci = null;
    const ukoncit = () => {
        info.removeEventListener('click', naAkci);
        ram.removeEventListener('pointerdown', naStisk);
        ram.removeEventListener('pointermove', naPohyb);
        ram.removeEventListener('pointerup', naUvolneni);
        ram.removeEventListener('pointercancel', naUvolneni);
        ram.removeEventListener('wheel', naKolecko);
        card.classList.remove('editing');
        info.innerHTML = puvodniInfo;
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
    info.addEventListener('click', naAkci);
}

// Stejná modelka se nemá omylem založit dvakrát; vrací, zda se má pokračovat
export async function neniDuplicitni(modelka) {
    const jmena = m => [m.jmeno, ...(m.dalsiJmena || '').split(',')].map(sjednotit).filter(Boolean);
    const nova = jmena(modelka);
    const stejna = (await vsechnyModelky()).find(m => jmena(m).some(j => nova.includes(j)));
    return !stejna || potvrdit('Modelka už existuje', `V databázi už je modelka „${stejna.jmeno}" se stejným jménem nebo pseudonymem. Opravdu přidat další?`, 'Přesto přidat');
}