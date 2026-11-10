// Chytré výběry ⚡ (chytre_vybery.go): uložené podmínky nad modelkami (text hledání a panel Filtry) nebo nad fotkami
// (Galerie fotek: řazení, srdíčka, typy, tagy, desetiletí, kolekce a text hledání). Výběr je živý – počet a náhled se
// počítají z aktuálních dat. Čipy ⚡ se vykreslují do míst [data-cv-druh] (lišta Modelek, volby Galerie fotek, panel
// kolekcí) a karta do [data-cv-prehled] v Přehledu; místa plní MutationObserver, takže pohledy jen vloží značku.
// Klik na čip výběr zapne, ✎ otevře okno: název, popis, převzetí aktuálních podmínek, zmrazení, smazání.
import { GetChytreVybery, GetObsahChytrehoVyberu, OznacitVyberVideny, SmazatChytryVyber, UlozitChytryVyber, ZmrazitChytryVyber } from './backend';
import { stranyVyberu } from '../lib/casopis';
import { otevritStrany } from './casopis';
import { otevritDnesniVyber } from './dnesni-vyber';
import { esc, obrazek, sklonovat } from '../lib/format';
import { nazevZDotazu } from '../lib/historie-hledani';
import { prevest, rozpoznat } from '../lib/hledani-dotaz';
import { stav } from './stav';
import { searchInput } from './prvky';
import { nastavitViditelnostHledani, prepnoutRezim, zapamatovatMisto } from './navigace';
import { nastavitFiltrModelek, textFiltru } from './filtr-modelek';
import { lzeUlozitGalerii, nastavitPodminkyGalerie, podminkyGalerie } from './galerie-vse';
import { nacistGalerii } from './galerie';
import { nacistNejlepsi } from './nejlepsi';
import { adresaTitulni } from './obrazky';
import { vsechnyModelky } from './mezipamet';
import { poZmeneDat } from './udalosti';
import { oznamit } from '../ui/oznameni';
import { potvrdit } from './formular-modelky';
import { drzetFokus } from '../ui/dom';

/** @typedef {{ id: string, nazev: string, popis?: string, druh: 'fotky' | 'modelky', zapis?: string, text?: string, filtr?: string, galerie?: any, nazevKolekce?: string, vytvoreno?: string, pocet?: number, fotky?: any[], modelky?: number[] }} Vyber */

const NAZVY_DRUHU = { modelky: 'modelek', fotky: 'fotek' };
const SRDICKA = { 3: '♥ 3+', 4: '♥ 4+', 5: '♥ 5', 0: 'Bez srdíček' };
const RAZENI = { hodnota: 'Nejlepší', nove: 'Nejnovější', nahodne: 'Náhodně' };

/** @type {Promise<Vyber[]> | null} */
let nacteni = null;
const nacist = () => {
    if (!nacteni) {
        nacteni = GetChytreVybery('').then(v => /** @type {Vyber[]} */ (v || []));
        nacteni.catch(() => { nacteni = null; });
    }
    return nacteni;
};
function obnovit() {
    nacteni = null;
    document.querySelectorAll('[data-cv-druh], [data-cv-prehled]').forEach(m => m.removeAttribute('data-cv-hotovo'));
    naplnitVse();
}

// Aktuální podmínky pohledu (text hledání je zápis uživatele, vyhodnocuje se převedený)
/** @returns {any} */
function aktualni(druh) {
    const zapis = searchInput.value.trim();
    const zaklad = { druh, zapis, text: prevest(zapis).trim() };
    return druh === 'modelky' ? { ...zaklad, filtr: textFiltru() } : { ...zaklad, galerie: podminkyGalerie() };
}
const stejnePole = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);
function shoda(v, a) {
    if (v.druh !== a.druh || (v.text || '') !== a.text) return false;
    if (v.druh === 'modelky') return (v.filtr || '') === a.filtr;
    const g = v.galerie || {}, h = a.galerie;
    return (g.razeni || 'libi') === (h.razeni || 'libi') && (g.srdicka || '') === h.srdicka && (g.kolekce || '') === h.kolekce
        && stejnePole(g.typy, h.typy) && stejnePole(g.tagy, h.tagy) && stejnePole(g.dekady, h.dekady);
}
const lzeUlozit = druh => {
    const a = aktualni(druh);
    return Boolean(a.text || (druh === 'modelky' ? a.filtr : lzeUlozitGalerii()));
};

// Podmínky slovy (čipy hledání, filtr, galerie)
export function popisPodminek(v) {
    const casti = [];
    if (v.filtr) casti.push(...rozpoznat(v.filtr).map(c => c.popis));
    if (v.zapis || v.text) {
        const z = v.zapis || v.text;
        const rozpoznane = rozpoznat(z);
        casti.push(...rozpoznane.map(c => c.popis));
        let zbytek = z;
        for (const c of [...rozpoznane].reverse()) zbytek = zbytek.slice(0, c.od) + zbytek.slice(c.do);
        if (zbytek.trim()) casti.push(`„${zbytek.trim().replace(/\s+/g, ' ')}“`);
    }
    const g = v.galerie || {};
    if (v.druh === 'fotky') {
        if (v.nazevKolekce || g.kolekce) casti.push(`Kolekce: ${v.nazevKolekce || g.kolekce}`);
        if (g.srdicka) casti.push(SRDICKA[g.srdicka] || `♥ ${g.srdicka}`);
        casti.push(...(g.typy || []), ...(g.dekady || []).map(d => `${String(d).slice(2)}. léta`), ...(g.tagy || []).map(t => `#${t}`));
        if (g.razeni && RAZENI[g.razeni]) casti.push(`Řazení: ${RAZENI[g.razeni]}`);
    }
    return casti;
}

// Zapne výběr: přepne do Modelek nebo Galerie fotek a nastaví podmínky
export async function pouzit(v) {
    zapamatovatMisto({});
    if (v.druh === 'modelky') {
        if (stav.rezim !== 'modelky') prepnoutRezim('modelky');
        searchInput.value = v.zapis || v.text || '';
        nastavitViditelnostHledani(Boolean(searchInput.value));
        nastavitFiltrModelek(v.filtr || '');
        await nacistGalerii(searchInput.value);
    } else {
        stav.nejlepsiVyber = 0;
        stav.nejlepsiMin = 0;
        try { localStorage.setItem('nejlepsiMin', '0'); } catch { /* jen se nezapamatuje */ }
        nastavitPodminkyGalerie(v.galerie, v.nazevKolekce);
        if (stav.rezim !== 'nejlepsi') prepnoutRezim('nejlepsi');
        searchInput.value = v.zapis || v.text || '';
        nastavitViditelnostHledani(Boolean(searchInput.value));
        await nacistNejlepsi(searchInput.value);
    }
    document.querySelector('main')?.scrollTo({ top: 0 });
    oznacitVideny(v);
}

// Otevřený výběr: co v něm teď je, je viděné; přírůstek od minula se jednou řekne
function oznacitVideny(v) {
    if (!v.nove) return;
    const fotky = v.druh === 'fotky';
    oznamit(`Ve výběru „${v.nazev}“ ${sklonovat(v.nove, fotky ? 'přibyla fotka' : 'přibyla modelka', fotky ? 'přibyly fotky' : 'přibyly modelky', fotky ? 'přibylo fotek' : 'přibylo modelek')} od minula.`);
    OznacitVyberVideny(v.id).then(obnovit).catch(() => {});
}

const NEJVIC_STRAN = 200;
// Výběr jako časopis nebo prezentace (modelky: titulní fotka a údaje, fotky: celé strany)
async function otevritJakoCasopis(v, prezentace = false) {
    const [obsah, katalog] = await Promise.all([GetObsahChytrehoVyberu(v.id, NEJVIC_STRAN), vsechnyModelky()]);
    const podleId = new Map(katalog.map(m => [m.id, m]));
    const strany = stranyVyberu({ nazev: v.nazev, modelky: (obsah?.modelky || []).map(id => podleId.get(id)), fotky: obsah?.fotky || [],
        obrazek: u => obrazek(u, 'w2000') });
    if (!strany.length) return oznamit(`Ve výběru „${v.nazev}“ zatím nejsou ${v.druh === 'fotky' ? 'fotky' : 'modelky s titulní fotkou'}.`);
    await otevritStrany(strany, `⚡ ${v.nazev}`, { prezentace });
    if ((obsah?.pocet || 0) > NEJVIC_STRAN) oznamit(`Ukazuji prvních ${NEJVIC_STRAN} z ${obsah.pocet.toLocaleString('cs-CZ')}.`);
    oznacitVideny(v);
}

// ——— Čipy a karta v Přehledu ———

function htmlCipu(vybery, druh, velke) {
    const a = aktualni(druh);
    const cipy = vybery.filter(v => v.druh === druh).map(v => {
        const titulek = [v.popis, popisPodminek(v).join(' · ')].filter(Boolean).join('\n');
        const nove = v.nove ? `<em class="cv-nove" title="Přibylo od posledního otevření">+${v.nove.toLocaleString('cs-CZ')}</em>` : '';
        return `<span class="pl-stitek cv-cip ${shoda(v, a) ? 'on' : ''}"><button type="button" data-cv-pouzit="${esc(v.id)}" title="${esc(titulek)}">⚡ ${esc(v.nazev)}<small>${(v.pocet || 0).toLocaleString('cs-CZ')}</small>${nove}</button><button type="button" data-cv-upravit="${esc(v.id)}" aria-label="Upravit chytrý výběr" title="Upravit, zmrazit nebo smazat">✎</button></span>`;
    }).join('');
    const ulozit = `<button type="button" class="link cv-ulozit" data-cv-ulozit="${druh}" ${lzeUlozit(druh) ? '' : `disabled title="Nejdřív zadej hledání${druh === 'modelky' ? ' nebo filtr' : ', filtry, kolekci nebo řazení'}"`}>⚡ Uložit jako chytrý výběr…</button>`;
    if (velke && !cipy) return `<span class="gv-k-prazdne">Zatím žádné – nastav hledání, filtry, kolekci nebo řazení a ulož je jako chytrý výběr; nové fotky, které podmínkám vyhoví, v něm budou samy.</span>${ulozit}`;
    return cipy + ulozit;
}

async function htmlPrehledu(vybery) {
    if (!vybery.length) return '';
    const modelky = new Map((await vsechnyModelky()).map(m => [m.id, m]));
    const nahledy = v => (v.druh === 'fotky' ? (v.fotky || []).map(f => obrazek(f.url || '', 'w200')) : (v.modelky || []).map(id => modelky.get(id)).filter(Boolean).map(m => adresaTitulni(m)))
        .slice(0, 4).map(u => `<img src="${esc(u)}" alt="" loading="lazy" draggable="false" />`).join('');
    return `<h4>Chytré výběry ⚡<small>živé výběry – nové modelky a fotky se v nich objeví samy</small></h4>
        <div class="cv-dlazdice">${vybery.map(v => `<button type="button" class="cv-dlazdice-polozka" data-cv-pouzit="${esc(v.id)}" title="${esc(popisPodminek(v).join(' · '))}">
            <span class="cv-nahledy ${v.druh}">${nahledy(v) || '<span class="cv-bez">⚡</span>'}</span>
            <b>⚡ ${esc(v.nazev)}${v.nove ? ` <em class="cv-nove">+${v.nove.toLocaleString('cs-CZ')} od minula</em>` : ''}</b><small>${esc(sklonovat(v.pocet || 0, v.druh === 'fotky' ? 'fotka' : 'modelka', v.druh === 'fotky' ? 'fotky' : 'modelky', v.druh === 'fotky' ? 'fotek' : 'modelek'))}${v.popis ? ` · ${esc(v.popis)}` : ''}</small></button>`).join('')}</div>`;
}

async function naplnitVse() {
    const mista = [...document.querySelectorAll('[data-cv-druh]:not([data-cv-hotovo]), [data-cv-prehled]:not([data-cv-hotovo])')];
    if (!mista.length) return;
    mista.forEach(m => m.setAttribute('data-cv-hotovo', ''));
    const vybery = await nacist().catch(() => []);
    for (const m of mista) {
        if (!m.isConnected) continue;
        const el = /** @type {HTMLElement} */ (m);
        if (el.dataset.cvPrehled !== undefined) {
            el.innerHTML = await htmlPrehledu(vybery);
            el.hidden = !vybery.length;
        } else {
            el.innerHTML = htmlCipu(vybery, el.dataset.cvDruh, el.hasAttribute('data-cv-velke'));
        }
    }
}

// Po změně podmínek (psaní, filtr) se čipy přebarví a tlačítko Uložit zapne/vypne bez nového načtení
let casovacOznaceni = 0;
function preznacit() {
    clearTimeout(casovacOznaceni);
    casovacOznaceni = window.setTimeout(() => {
        document.querySelectorAll('[data-cv-druh][data-cv-hotovo]').forEach(m => m.removeAttribute('data-cv-hotovo'));
        naplnitVse();
    }, 200);
}

// ——— Okno ———

let okno = null;
/** @type {{ v: Vyber | null, druh: string }} */
let upravovany = { v: null, druh: 'modelky' };

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'chytryVyberModal';
    okno.innerHTML = `<div class="modal-card modal-narrow" role="dialog" aria-modal="true" aria-labelledby="cvNadpis">
        <div class="modal-header"><h3 id="cvNadpis"></h3><button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <form data-cv-form>
            <p class="pass-hint" data-cv-uvod></p>
            <div class="form-group"><label for="cvNazev">Název</label><input type="text" id="cvNazev" maxlength="60" required autocomplete="off" /></div>
            <div class="form-group"><label for="cvPopis">Popis <small>(nepovinný)</small></label><input type="text" id="cvPopis" maxlength="200" autocomplete="off" /></div>
            <div class="cv-podminky" data-cv-podminky></div>
            <label class="cv-prevzit" data-cv-prevzit-misto hidden><input type="checkbox" data-cv-prevzit /> Převzít aktuální podmínky <span data-cv-aktualni></span></label>
            <div class="cv-dalsi" data-cv-dalsi hidden>
                <button type="button" class="btn btn-secondary btn-small" data-cv-casopis title="Projít výběr v režimu čtení">Jako časopis</button>
                <button type="button" class="btn btn-secondary btn-small" data-cv-prezentace title="Režim čtení s automatickým listováním">Prezentace</button>
                <button type="button" class="btn btn-secondary btn-small" data-cv-dnesni title="Porovnávání po čtveřicích jen z modelek výběru">Dnešní výběr</button>
                <button type="button" class="btn btn-secondary btn-small" data-cv-zmrazit></button>
                <button type="button" class="btn btn-secondary btn-small cv-smazat" data-cv-smazat>Smazat</button>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
                <button type="submit" class="btn btn-primary">Uložit</button>
            </div>
        </form></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    const prevzit = /** @type {HTMLInputElement} */ (okno.querySelector('[data-cv-prevzit]'));
    prevzit.addEventListener('change', () => vykreslitPodminky());
    okno.querySelector('[data-cv-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nazev = /** @type {HTMLInputElement} */ (okno.querySelector('#cvNazev')).value.trim();
        if (!nazev) return;
        const popis = /** @type {HTMLInputElement} */ (okno.querySelector('#cvPopis')).value.trim();
        const zaklad = upravovany.v && !prevzit.checked ? upravovany.v : { ...(upravovany.v || {}), ...aktualni(upravovany.druh) };
        const ulozeny = await UlozitChytryVyber(/** @type {any} */ ({ ...zaklad, id: upravovany.v?.id || '', nazev, popis }));
        if (!ulozeny?.id) {
            oznamit(`Chytrý výběr ${NAZVY_DRUHU[upravovany.druh]} s názvem „${nazev}“ už existuje, zvol jiný název.`);
            return;
        }
        okno.classList.add('hidden');
        oznamit(upravovany.v ? `Chytrý výběr „${nazev}“ je upravený.` : `Chytrý výběr „${nazev}“ je uložený. Nové ${upravovany.druh === 'fotky' ? 'fotky' : 'modelky'}, které podmínkám vyhoví, v něm budou samy.`);
        obnovit();
    });
    okno.querySelector('[data-cv-smazat]').addEventListener('click', async () => {
        const v = upravovany.v;
        if (!v || !await potvrdit('Smazat chytrý výběr?', `„${v.nazev}“ zmizí; ${v.druh === 'fotky' ? 'fotky' : 'modelky'} ani jejich údaje se nezmění.`, 'Smazat', { nebezpecne: true })) return;
        await SmazatChytryVyber(v.id);
        okno.classList.add('hidden');
        obnovit();
    });
    okno.querySelector('[data-cv-casopis]').addEventListener('click', () => { const v = upravovany.v; if (v) { okno.classList.add('hidden'); otevritJakoCasopis(v); } });
    okno.querySelector('[data-cv-prezentace]').addEventListener('click', () => { const v = upravovany.v; if (v) { okno.classList.add('hidden'); otevritJakoCasopis(v, true); } });
    okno.querySelector('[data-cv-dnesni]').addEventListener('click', () => {
        const v = upravovany.v;
        if (!v) return;
        if ((v.pocet || 0) < 4) return oznamit('Na Dnešní výběr musí mít výběr aspoň 4 modelky.');
        okno.classList.add('hidden');
        otevritDnesniVyber(`vyber:${v.id}`);
    });
    okno.querySelector('[data-cv-zmrazit]').addEventListener('click', async () => {
        const v = upravovany.v;
        if (!v) return;
        const fotky = v.druh === 'fotky';
        if (!await potvrdit('Zmrazit do běžného výběru?', fotky
            ? `${sklonovat(v.pocet || 0, 'fotka', 'fotky', 'fotek')} se přidá do výběru „${v.nazev}“ v Nejlepších. Ten se pak už sám nemění; chytrý výběr zůstane.`
            : `${sklonovat(v.pocet || 0, 'modelka', 'modelky', 'modelek')} dostane tag „${v.nazev}“. Tag se pak už sám nemění; chytrý výběr zůstane.`, 'Zmrazit')) return;
        const z = await ZmrazitChytryVyber(v.id);
        okno.classList.add('hidden');
        oznamit(fotky ? `Do výběru „${v.nazev}“ ${sklonovat(z.pocet, 'přibyla fotka', 'přibyly fotky', 'přibylo fotek')}.`
            : `Tag „${z.tag || v.nazev}“ ${sklonovat(z.pocet, 'dostala modelka', 'dostaly modelky', 'dostalo modelek')}.`);
    });
}

function vykreslitPodminky() {
    const prevzit = /** @type {HTMLInputElement} */ (okno.querySelector('[data-cv-prevzit]'));
    const v = upravovany.v && !prevzit.checked ? upravovany.v : aktualni(upravovany.druh);
    const casti = popisPodminek(v);
    okno.querySelector('[data-cv-podminky]').innerHTML = `<span class="cv-podminky-nadpis">Podmínky</span>${casti.length ? casti.map(c => `<span class="hc-cip">${esc(c)}</span>`).join('') : '<span class="cv-zadne">žádné – všechny položky</span>'}`;
}

function otevritOkno(druh, v = null) {
    if (!okno) vytvoritOkno();
    upravovany = { v, druh };
    okno.querySelector('#cvNadpis').textContent = v ? `⚡ ${v.nazev}` : `⚡ Nový chytrý výběr ${NAZVY_DRUHU[druh]}`;
    okno.querySelector('[data-cv-uvod]').textContent = v
        ? `${sklonovat(v.pocet || 0, druh === 'fotky' ? 'fotka' : 'modelka', druh === 'fotky' ? 'fotky' : 'modelky', druh === 'fotky' ? 'fotek' : 'modelek')} teď odpovídá podmínkám.${v.vytvoreno ? ` Uloženo ${new Date(v.vytvoreno.replace(' ', 'T')).toLocaleDateString('cs-CZ')}.` : ''}`
        : `Uloží se podmínky, ne ${druh === 'fotky' ? 'fotky' : 'modelky'}: výběr se sám doplní o každou novou ${druh === 'fotky' ? 'fotku' : 'modelku'}, která jim vyhoví.`;
    /** @type {HTMLInputElement} */ (okno.querySelector('#cvNazev')).value = v?.nazev || '';
    /** @type {HTMLInputElement} */ (okno.querySelector('#cvPopis')).value = v?.popis || '';
    const prevzit = /** @type {HTMLInputElement} */ (okno.querySelector('[data-cv-prevzit]'));
    prevzit.checked = false;
    const lzePrevzit = Boolean(v) && lzeUlozit(druh) && !shoda(v, aktualni(druh)) && ((druh === 'modelky') === (stav.rezim === 'modelky'));
    /** @type {HTMLElement} */ (okno.querySelector('[data-cv-prevzit-misto]')).hidden = !lzePrevzit;
    okno.querySelector('[data-cv-aktualni]').textContent = lzePrevzit ? `(${popisPodminek(aktualni(druh)).join(' · ') || 'bez podmínek'})` : '';
    /** @type {HTMLElement} */ (okno.querySelector('[data-cv-dalsi]')).hidden = !v;
    okno.querySelector('[data-cv-zmrazit]').textContent = druh === 'fotky' ? 'Zmrazit do běžného výběru' : 'Zmrazit do tagu';
    /** @type {HTMLElement} */ (okno.querySelector('[data-cv-dnesni]')).hidden = druh !== 'modelky';
    vykreslitPodminky();
    okno.classList.remove('hidden');
    /** @type {HTMLInputElement} */ (okno.querySelector('#cvNazev')).focus();
}

// Dotaz z historie hledání jednou zkratkou (Ctrl+S v našeptávači) jako chytrý výběr modelek
export async function ulozitDotaz(zapis) {
    const z = String(zapis || '').trim();
    if (!z) return;
    const vybery = await nacist().catch(() => []);
    const nazev = nazevZDotazu(z, vybery.filter(v => v.druh === 'modelky').map(v => v.nazev));
    const v = await UlozitChytryVyber(/** @type {any} */ ({ id: '', nazev, druh: 'modelky', zapis: z, text: prevest(z).trim(), filtr: '' })).catch(() => null);
    if (!v?.id) return oznamit('Dotaz se nepodařilo uložit jako chytrý výběr.');
    obnovit();
    oznamit(`Dotaz je uložený jako chytrý výběr ⚡ „${nazev}“.`, { text: 'Upravit', akce: () => otevritOkno('modelky', /** @type {Vyber} */ (v)) });
}

export function pripravit() {
    new MutationObserver(() => {
        if (document.querySelector('[data-cv-druh]:not([data-cv-hotovo]), [data-cv-prehled]:not([data-cv-hotovo])')) naplnitVse();
    }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    poZmeneDat(obnovit);
    searchInput.addEventListener('input', preznacit);
    document.addEventListener('filtr-modelek', preznacit);
    document.addEventListener('click', async (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const pouzitBtn = /** @type {HTMLElement | null} */ (cil.closest('[data-cv-pouzit]'));
        const upravitBtn = /** @type {HTMLElement | null} */ (cil.closest('[data-cv-upravit]'));
        const ulozitBtn = /** @type {HTMLElement | null} */ (cil.closest('[data-cv-ulozit]'));
        if (!pouzitBtn && !upravitBtn && !ulozitBtn) return;
        e.stopPropagation();
        if (ulozitBtn) return otevritOkno(ulozitBtn.dataset.cvUlozit);
        const vybery = await nacist();
        const v = vybery.find(x => x.id === (pouzitBtn || upravitBtn).dataset[pouzitBtn ? 'cvPouzit' : 'cvUpravit']);
        if (!v) return;
        if (upravitBtn) otevritOkno(v.druh, v);
        else pouzit(v);
    }, true);
}
