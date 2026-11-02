// Výběr více fotek v profilu a lišta hromadných akcí
import { jednou, oznamit } from '../ui/oznameni';
import { OdebratFotky, PresunoutFotky, SetHodnoceniFotek, OdebratZVyberu } from './backend';
import { nazevAlba } from '../lib/format';
import { stav } from './stav';
import { best, detailView, issueView, searchInput } from './prvky';
import { nacistFotkyModelky, rozbalitKliknute } from './profil';
import { obnovitStranku } from './vydani';
import { nacistNejlepsi, pridatDoVyberu } from './nejlepsi';
import { lbOhodnotit, lbOtocit, lbPrepnoutRozlozeni, lbPrepnoutSlideshow, lbSkokAlba, lbVratitHodnoceni, lbZamichat, lbZobrazit, lightbox, otevritLightbox } from './prohlizec';
import { nabidnoutVraceni } from './sprava';
import { vybratHodnotu } from './ulozeni';
import { otevreneOkno } from '../ui/dom';
import { otevritPanelTagu, zavritPanelTagu } from './tagy-fotek';
import { klavesaTagovani } from './tagovani';

// Výběr více fotek v profilu, na stránce vydání, ročníku a fotografa a v Nejlepších: Ctrl (Cmd) + klik přidá
// nebo odebere fotku, Shift + klik vybere úsek, Ctrl+A vybere vše, Delete vybrané odebere
export const selectionBar = document.getElementById('selectionBar');

const DLAZDICE = '.photo-item[data-index], .poster[data-index]';

// Pohled, ve kterém se dá vybírat: kde jsou dlaždice, jejich položky a jak pohled po změně obnovit
function kontextVyberu() {
    if (!detailView.classList.contains('hidden')) {
        return { koren: document.getElementById('photosGrid'), polozky: stav.aktualniPolozky, presun: true, obnovit: () => nacistFotkyModelky(stav.aktualniModelka.id) };
    }
    if (!issueView.classList.contains('hidden')) return { koren: issueView, polozky: stav.vydaniPolozky, presun: false, obnovit: obnovitStranku };
    if (!best.classList.contains('hidden')) return { koren: best, polozky: stav.nejlepsiPolozky, presun: false, vyber: stav.nejlepsiVyber, obnovit: () => nacistNejlepsi(searchInput.value) };
    return null;
}

export const vybraneDlazdice = () => [...document.querySelectorAll('.photo-item.vybrana, .poster.vybrana')];

// Fotky vybraných dlaždic (u plakátu všechny stránky)
function vybraneFotky() {
    const kontext = kontextVyberu();
    if (!kontext) return [];
    return vybraneDlazdice().flatMap(d => kontext.polozky[parseInt(d.dataset.index)]?.fotky || []);
}

const pocetVybranych = document.getElementById('selectionCount');
const tlacitkoPresunout = selectionBar.querySelector('[data-vyber="presunout"]');
const tlacitkoOdebrat = /** @type {HTMLElement} */ (selectionBar.querySelector('[data-vyber="odebrat"]'));

export function aktualizovatVyber() {
    const pocet = vybraneDlazdice().length;
    const kontext = kontextVyberu();
    selectionBar.classList.toggle('hidden', pocet === 0);
    pocetVybranych.textContent = `Vybráno: ${pocet}`;
    tlacitkoPresunout.classList.toggle('hidden', !kontext?.presun);
    // Tlačítko má ikonu; co odebrání udělá, říká nápověda
    tlacitkoOdebrat.title = kontext?.vyber ? 'Odebrat z výběru (Delete)' : 'Odebrat (Delete)';
}

export function zrusitVyber() {
    zavritPanelTagu();
    vybraneDlazdice().forEach(d => d.classList.remove('vybrana'));
    stav.posledniVybrana = null;
    aktualizovatVyber();
    nastavitRezimVyberu(false);
}

// Režim výběru v profilu (⋯ › Vybrat fotky): klik fotku vybere jako Ctrl+klik, dlaždice mají kroužky; Esc ho ukončí
export const rezimVyberu = () => document.body.classList.contains('rezim-vyberu');
export function nastavitRezimVyberu(zapnout) {
    document.body.classList.toggle('rezim-vyberu', zapnout);
}

// Všechny viditelné dlaždice pohledu; vrací false, když v pohledu vybírat nejde
export function vybratVse() {
    const kontext = kontextVyberu();
    if (!kontext) return false;
    kontext.koren.querySelectorAll(DLAZDICE).forEach(d => { if (d.offsetParent) d.classList.add('vybrana'); });
    aktualizovatVyber();
    return true;
}

export function vybratKliknutim(e) {
    const kontext = kontextVyberu();
    const dlazdice = kontext && e.target.closest(DLAZDICE);
    const rezim = rezimVyberu() && !detailView.classList.contains('hidden');
    if (!dlazdice || !kontext.koren.contains(dlazdice) || !(e.ctrlKey || e.metaKey || e.shiftKey || rezim)) return false;
    // V režimu výběru otevírá ⋯ na dlaždici nabídku a srdíčka hodnotí jako jindy
    if (rezim && !(e.ctrlKey || e.metaKey || e.shiftKey) && e.target.closest('.hearts, .tile-more, [data-nabidka], button')) return false;
    if (e.shiftKey && stav.posledniVybrana && stav.posledniVybrana.parentElement === dlazdice.parentElement) {
        const vsechny = [...dlazdice.parentElement.children].filter(d => d.offsetParent && d.matches(DLAZDICE));
        const [od, po] = [vsechny.indexOf(stav.posledniVybrana), vsechny.indexOf(dlazdice)].sort((x, y) => x - y);
        vsechny.slice(od, po + 1).forEach(d => d.classList.add('vybrana'));
    } else {
        dlazdice.classList.toggle('vybrana');
    }
    stav.posledniVybrana = dlazdice;
    aktualizovatVyber();
    return true;
}

// Odebrání vybraných fotek; Vrátit je vrátí i s výběry a dalšími modelkami alba
async function odebratVybrane() {
    const kontext = kontextVyberu();
    const ids = vybraneFotky().map(f => f.id);
    if (!kontext || !ids.length) return;
    // Ve vlastním výběru (Nejlepší) se fotky odebírají jen z výběru, ve sbírce zůstanou
    if (kontext.vyber) {
        if (!await OdebratZVyberu(kontext.vyber, ids)) return;
        zrusitVyber();
        kontext.obnovit();
        oznamit(`Z výběru odebráno fotek: ${ids.length}. Ve sbírce zůstaly.`);
        return;
    }
    const obnova = await OdebratFotky(ids) || [];
    if (!obnova.length) return;
    zrusitVyber();
    kontext.obnovit();
    nabidnoutVraceni(`Odebráno fotek: ${ids.length}. Soubory na Google Disku zůstaly.`, obnova);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    selectionBar.addEventListener('click', jednou(async (e) => {
        const kontext = kontextVyberu();
        const ids = vybraneFotky().map(f => f.id);
        const hodnoceni = e.target.closest('[data-vyber-hodnoceni]')?.dataset.vyberHodnoceni;
        const akce = e.target.closest('[data-vyber]')?.dataset.vyber;
        if (akce === 'zrusit') {
            zrusitVyber();
            return;
        }
        if (akce === 'vse') {
            vybratVse();
            return;
        }
        // Tagy: panel nad lištou, výběr zůstane (tagy se ukládají hned po kliku)
        if (akce === 'tagy') {
            if (ids.length) otevritPanelTagu(ids, /** @type {HTMLElement} */ (e.target.closest('[data-vyber]')));
            return;
        }
        if (!kontext || !ids.length) return;

        if (hodnoceni) {
            await SetHodnoceniFotek(ids, parseInt(hodnoceni));
            oznamit(`Ohodnoceno fotek: ${ids.length}.`);
        } else if (akce === 'odebrat') {
            await odebratVybrane();
            return;
        } else if (akce === 'dovyberu') {
            if (!await pridatDoVyberu(ids)) return;
        } else if (akce === 'presunout' && kontext.presun) {
            // Cílem je album otevřené modelky, nebo nové album; nové je pictorial
            const alba = stav.aktualniAlba.filter(a => a.modelkaId === stav.aktualniModelka.id);
            const nazev = await vybratHodnotu({ nadpis: 'Přesunout do alba', text: 'Vyber album ze seznamu, nebo napiš název nového alba.', popisek: 'Album', moznosti: alba.map(a => nazevAlba(a.album, a.typ)), tlacitko: 'Přesunout' });
            if (!nazev) return;
            const cil = alba.find(a => nazevAlba(a.album, a.typ) === nazev || a.album === nazev);
            const v = await PresunoutFotky(ids, stav.aktualniModelka.id, cil ? cil.album : nazev, cil ? cil.typ : 'Pictorial');
            oznamit(`Přesunuto fotek: ${v.presunuto}.` + (v.duplicitni ? ` V cílovém albu už bylo: ${v.duplicitni} – zůstaly na místě.` : ''));
        } else {
            return;
        }
        zrusitVyber();
        kontext.obnovit();
    }));

    // Ctrl+A vybere všechny fotky pohledu, Delete vybrané odebere (obojí ne při psaní ani nad oknem)
    document.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, select') || otevreneOkno() || !lightbox.classList.contains('hidden')) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            if (vybratVse()) e.preventDefault();
        } else if (e.key === 'Delete' && vybraneDlazdice().length) {
            e.preventDefault();
            odebratVybrane();
        } else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.altKey && !e.metaKey && vybraneDlazdice().length) {
            // T otevře (nebo zavře) panel tagů vybraných fotek
            e.preventDefault();
            /** @type {HTMLElement | null} */ (selectionBar.querySelector('[data-vyber="tagy"]'))?.click();
        }
    });

    detailView.addEventListener('click', (e) => {
        if (vybratKliknutim(e)) return;
        if (e.target.closest('[data-vydani], .hearts') || rozbalitKliknute(e)) return;
        const polozka = e.target.closest('[data-index]');
        if (polozka) otevritLightbox(parseInt(polozka.dataset.index));
    });

    document.addEventListener('keydown', (e) => {
        // Klávesy prohlížeče neplatí při psaní do pole ani nad otevřeným oknem
        if (lightbox.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey
            || e.target.closest('input, textarea, select') || otevreneOkno()) return;
        // Tagování má vlastní klávesy (Z, O, M, P, V, H, Enter, 1–5, „.“, Backspace)
        if (klavesaTagovani(e)) {
            e.preventDefault();
            return;
        }
        const klavesa = e.key.toLowerCase();
        if (klavesa === 'arrowright') lbZobrazit(stav.lbIndex + 1);
        else if (klavesa === 'arrowleft') lbZobrazit(stav.lbIndex - 1);
        else if (klavesa === 'arrowdown' || klavesa === 'pagedown') lbSkokAlba(1);
        else if (klavesa === 'arrowup' || klavesa === 'pageup') lbSkokAlba(-1);
        // Podržená číslice se neopakuje (jinak by ohodnotila celou frontu nehodnocených)
        else if (/^[1-5]$/.test(klavesa)) { if (!e.repeat) lbOhodnotit(parseInt(klavesa)); }
        else if (klavesa === '0') { if (!e.repeat && !stav.lbJenNehodnocene) lbOhodnotit(stav.lbPolozky[stav.lbIndex].hodnoceni); }
        else if (klavesa === 'backspace' && stav.lbJenNehodnocene) lbVratitHodnoceni();
        else if (klavesa === ' ') lbPrepnoutSlideshow();
        else if (klavesa === 'f') lbPrepnoutRozlozeni();
        else if (klavesa === 'r') lbOtocit();
        else if (klavesa === 's') lbZamichat();
        else return;
        e.preventDefault();
    });
}
