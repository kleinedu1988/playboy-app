// Hero banner nahoře na Profilech (filmový styl jako záhlaví profilu modelky): doporučená modelka – tip „Mohlo by se
// ti líbit“ (odhad vkusu s důvodem), nebo některá z tvého Top 10 – s velkou fotkou, jménem, srdíčky a akcemi Otevřít
// profil, Další tip a Dnešní výběr. Tipy se střídají (Další tip ↻, další spuštění začne dalším). Karty pod ním
// zůstávají čisté; při rolování banner odjede nahoru.
import { GetMohloByTeLibit, GetProfilovaFotka } from './backend';
import { vsechnyModelky } from './mezipamet';
import { esc, obrazek } from '../lib/format';
import { adresaTitulni, VELIKOST_ZAHLAVI } from './obrazky';
import { stylVyrezu } from './navigace';
import { otevritProfilPodleId } from './cover';
import { otevritDnesniVyber, dnesVoleb } from './dnesni-vyber';

const KLIC_TIPU = 'profilyHeroTip';
let tipy = null; // [{ id, nadtitulek, duvod }]

async function nacistTipy() {
    const modelky = await vsechnyModelky().catch(() => []);
    const podleId = new Map(modelky.map(m => [m.id, m]));
    let mohlo = [];
    try { mohlo = await GetMohloByTeLibit(12) || []; } catch { mohlo = []; }
    const tipyVkusu = mohlo.filter(t => podleId.get(t.modelkaId)?.coverUrl).map(t => ({
        id: t.modelkaId, nadtitulek: 'Mohlo by se ti líbit', duvod: t.duvod || '',
    }));
    const top = modelky.filter(m => m.poradi > 0 && m.poradi <= 10 && m.coverUrl).sort((a, b) => a.poradi - b.poradi).map(m => ({
        id: m.id, nadtitulek: `Tvoje Top 10 · ${m.poradi}. místo`, duvod: '',
    }));
    // Střídavě tip a modelka z Top 10
    const v = [];
    for (let i = 0; i < Math.max(tipyVkusu.length, top.length); i++) {
        if (tipyVkusu[i]) v.push(tipyVkusu[i]);
        if (top[i]) v.push(top[i]);
    }
    return { seznam: v, podleId };
}

function indexTipu(n) {
    try { return Math.abs(parseInt(localStorage.getItem(KLIC_TIPU) || '0', 10) || 0) % Math.max(n, 1); } catch { return 0; }
}
function posunoutTip(n) {
    try { localStorage.setItem(KLIC_TIPU, String((indexTipu(n) + 1) % Math.max(n, 1))); } catch { /* jen teď */ }
}

// Vykreslí banner do místa (section.profily-hero v galerii)
export async function naplnitHero(misto) {
    if (!misto) return;
    if (!tipy) tipy = await nacistTipy();
    const { seznam, podleId } = tipy;
    if (!seznam.length || !misto.isConnected) {
        misto.remove();
        return;
    }
    const tip = seznam[indexTipu(seznam.length)];
    const m = podleId.get(tip.id);
    if (!m) return misto.remove();
    let adresa = adresaTitulni(m, true);
    let styl = stylVyrezu(m);
    try {
        const p = await GetProfilovaFotka(m.id);
        if (p?.url) {
            adresa = obrazek(p.url, VELIKOST_ZAHLAVI);
            styl = stylVyrezu(p);
        }
    } catch { /* fotka karty */ }
    if (!misto.isConnected) return;
    const srdicka = m.hodnoceni > 0 ? '♥'.repeat(Math.round(m.hodnoceni)) : m.odhadHodnoceni ? `odhad ${String(m.odhadHodnoceni).replace('.', ',')} ♥` : '';
    const voleb = dnesVoleb();
    misto.innerHTML = `
        <div class="ph-rozmazane" style="background-image:url('${esc(adresa).replace(/'/g, '%27')}')"></div>
        <div class="ph-ram"><img src="${esc(adresa)}" alt="" style="${esc(styl)}" draggable="false" /></div>
        <div class="ph-prekryv"></div>
        <div class="ph-obsah">
            <div class="ph-nadtitulek">${esc(tip.nadtitulek)}</div>
            <h2>${esc(m.jmeno)}</h2>
            ${srdicka ? `<div class="ph-srdicka">${esc(srdicka)}</div>` : ''}
            ${tip.duvod ? `<p class="ph-duvod">${esc(tip.duvod)}</p>` : ''}
            <div class="ph-akce">
                <button type="button" class="ph-tlacitko hlavni" data-ph-profil="${m.id}">Otevřít profil</button>
                ${seznam.length > 1 ? '<button type="button" class="ph-tlacitko" data-ph-dalsi title="Další doporučená modelka">Další tip ↻</button>' : ''}
                <button type="button" class="ph-tlacitko" data-otevrit-vkus title="Co z tvých srdíček vyplývá o tvém vkusu">✨ Ideální modelka</button>
                <button type="button" class="ph-tlacitko" data-ph-vyber title="10 × nejlepší ze 4 (~2 minuty)">🎯 Dnešní výběr${voleb ? ` ${Math.min(voleb, 10)}/10` : ''}</button>
            </div>
        </div>`;
    misto.onclick = (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const profil = /** @type {HTMLElement | null} */ (cil.closest('[data-ph-profil]'));
        if (profil) return otevritProfilPodleId(parseInt(profil.dataset.phProfil, 10));
        if (cil.closest('[data-ph-dalsi]')) {
            posunoutTip(seznam.length);
            return naplnitHero(misto);
        }
        if (cil.closest('[data-ph-vyber]')) otevritDnesniVyber();
    };
}

// Po změně dat (srdíčka, porovnání) se tipy načtou znovu
export function zapomenoutTipy() {
    tipy = null;
}
