// Dnešní výběr (oblibenost_ctverice.go): krátká denní dávka porovnávání po čtveřicích – „Která se ti líbí nejvíc?“.
// Jedna volba zapíše tři porovnání, deset voleb (~2 minuty) zpřesní pořadí asi jako třicet soubojů dvojic. Po
// spuštění nabídne dávku nenápadná kartička vpravo dole (jednou denně, křížek ji na dnes schová); po dávce shrnutí,
// kdo se v pořadí posunul, a volba pokračovat. Klávesy: 1–4 vybere, Backspace vrátí poslední volbu, Esc skončí.
import { GetCtvericeKPorovnani, GetLakadloPorovnani, GetNahledyModelek, GetPoradiModelek, PorovnatCtverici, VratitCtverici } from './backend';
import { vsechnyModelky } from './mezipamet';
import { otevritProfilPodleId } from './cover';
import { esc, obrazek } from '../lib/format';
import { dnesniPocet } from '../lib/srdicka';
import { VELIKOST_NAHLEDU } from './obrazky';

const DAVKA = 10;
const FOTEK = 3;
const KLIC_DNES = 'dnesniVyber';
const KLIC_SCHOVANO = 'dnesniVyberSchovano';
const KLIC_POROVNANI = 'porovnaniDnes'; // počítadlo porovnání a série v Hodnocení (app/oblibenost.js)

const dnes = () => new Date().toISOString().slice(0, 10);
function nacist(klic) {
    try { return JSON.parse(localStorage.getItem(klic) || 'null'); } catch { return null; }
}
function ulozit(klic, hodnota) {
    try { localStorage.setItem(klic, JSON.stringify(hodnota)); } catch { /* jen pro toto spuštění */ }
}
export const dnesVoleb = () => dnesniPocet(nacist(KLIC_DNES), dnes());
function pricist(volby, porovnani) {
    ulozit(KLIC_DNES, { datum: dnes(), pocet: Math.max(0, dnesVoleb() + volby) });
    ulozit(KLIC_POROVNANI, { datum: dnes(), pocet: Math.max(0, dnesniPocet(nacist(KLIC_POROVNANI), dnes()) + porovnani) });
}

/** @type {{ modelky: number[], duvod: string }[]} */
let fronta = [];
/** @type {{ modelky: number[], vitezka: number }[]} */
let historie = [];
let okno = null;
let jmena = new Map();
const nahledy = new Map();
let poradiPred = new Map();
let voleb = 0;
let zamek = false;

async function doplnit() {
    if (fronta.length >= 3) return;
    let nove = [];
    try { nove = await GetCtvericeKPorovnani(DAVKA) || []; } catch { nove = []; }
    fronta.push(...nove);
    const ids = [...new Set(nove.flatMap(c => c.modelky))].filter(id => !nahledy.has(id));
    if (ids.length) {
        try {
            const n = await GetNahledyModelek(ids, FOTEK) || {};
            ids.forEach(id => nahledy.set(id, n[id] || []));
        } catch { ids.forEach(id => nahledy.set(id, [])); }
        try {
            const p = await GetPoradiModelek(ids) || {};
            ids.forEach(id => { if (!poradiPred.has(id)) poradiPred.set(id, p[id] || 0); });
        } catch { /* shrnutí bez nich */ }
    }
}

function htmlKarty(id, i) {
    const m = jmena.get(id);
    const fotky = nahledy.get(id) || [];
    const hlavni = fotky[0] ? `<img src="${esc(obrazek(fotky[0].url, 'w600'))}" alt="" draggable="false" />` : '<div class="dv-bez-fotky">Bez fotky</div>';
    const male = fotky.slice(1, FOTEK).map(f => `<img src="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" alt="" draggable="false" />`).join('');
    const srdicka = m?.hodnoceni > 0 ? '♥'.repeat(Math.round(m.hodnoceni)) : (m?.odhadHodnoceni ? `odhad ${String(m.odhadHodnoceni).replace('.', ',')}` : 'bez srdíček');
    return `<button type="button" class="dv-karta" data-dv-vyber="${id}" aria-keyshortcuts="${i + 1}">
        <span class="dv-fotka">${hlavni}<kbd>${i + 1}</kbd></span>
        ${male ? `<span class="dv-male">${male}</span>` : ''}
        <span class="dv-jmeno">${esc(m?.jmeno || '')}</span>
        <span class="dv-srdicka">${esc(srdicka)}</span>
    </button>`;
}

function vykreslit() {
    if (!okno) return;
    const c = fronta[0];
    const postup = `<span class="dv-postup"><i style="width:${Math.round((voleb % DAVKA || (voleb ? DAVKA : 0)) / DAVKA * 100)}%"></i></span>`;
    const hlava = `<div class="dv-hlava"><b>Dnešní výběr</b><span>Která se ti líbí nejvíc?</span>${postup}<span class="dv-pocet">${voleb} / ${Math.ceil(Math.max(voleb, 1) / DAVKA) * DAVKA}</span>
        ${historie.length ? '<button type="button" class="dv-tlacitko" data-dv-vratit title="Vrátit poslední volbu (Backspace)">↶ Vrátit</button>' : ''}
        <button type="button" class="dv-zavrit" data-dv-konec title="Skončit (Esc)" aria-label="Skončit">×</button></div>`;
    if (!c) {
        okno.innerHTML = `${hlava}<div class="dv-prazdno">Teď není co porovnávat – pořadí je rozhodnuté. Zkus to zase zítra.</div>`;
        return;
    }
    okno.innerHTML = `${hlava}<div class="dv-karty">${c.modelky.map(htmlKarty).join('')}</div><p class="dv-duvod">${esc(c.duvod)}</p>`;
}

async function shrnuti() {
    const ids = [...new Set(historie.flatMap(h => h.modelky))];
    let po = {};
    try { po = await GetPoradiModelek(ids) || {}; } catch { po = {}; }
    const posuny = ids.map(id => ({ id, pred: poradiPred.get(id) || 0, po: po[id] || 0 }))
        .filter(p => p.po > 0 && p.pred !== p.po)
        .map(p => ({ ...p, zmena: (p.pred || 9999) - p.po }))
        .sort((a, b) => Math.abs(b.zmena) - Math.abs(a.zmena)).slice(0, 6);
    const radky = posuny.map(p => `<li><button type="button" class="dv-odkaz" data-dv-profil="${p.id}">${esc(jmena.get(p.id)?.jmeno || '')}</button>
        <span class="${p.zmena > 0 ? 'nahoru' : 'dolu'}">${p.zmena > 0 ? '↑' : '↓'} ${p.pred ? `${p.pred}. → ` : ''}${p.po}. místo</span></li>`).join('');
    okno.innerHTML = `<div class="dv-hlava"><b>Hotovo – ${voleb} ${voleb === 1 ? 'volba' : voleb < 5 ? 'volby' : 'voleb'}</b>
        <span>${historie.length * 3} porovnání pro tvé pořadí</span>
        <button type="button" class="dv-zavrit" data-dv-konec aria-label="Zavřít">×</button></div>
        <div class="dv-shrnuti">${radky ? `<p>Co se změnilo:</p><ul>${radky}</ul>` : '<p>Pořadí se zpřesnilo, na místech v něm se zatím nic nepohnulo.</p>'}
        <div class="dv-akce"><button type="button" class="dv-tlacitko hlavni" data-dv-dalsi>Dalších ${DAVKA}</button>
        <button type="button" class="dv-tlacitko" data-dv-konec>Hotovo</button></div></div>`;
}

async function vybrat(id) {
    const c = fronta[0];
    if (!c || zamek || !c.modelky.includes(id)) return;
    zamek = true;
    okno.querySelector(`[data-dv-vyber="${id}"]`)?.classList.add('vybrana');
    let ok = false;
    try { ok = await PorovnatCtverici(c.modelky, id); } catch { ok = false; }
    zamek = false;
    if (!ok) return;
    fronta.shift();
    historie.push({ modelky: c.modelky, vitezka: id });
    voleb++;
    pricist(1, c.modelky.length - 1);
    if (voleb % DAVKA === 0) return shrnuti();
    vykreslit();
    doplnit().then(() => { if (fronta.length && okno && !okno.querySelector('.dv-karty')) vykreslit(); });
}

async function vratit() {
    const h = historie.pop();
    if (!h || zamek) return;
    zamek = true;
    try { await VratitCtverici(h.modelky, h.vitezka); } catch { /* zůstane */ }
    zamek = false;
    fronta.unshift({ modelky: h.modelky, duvod: 'Vrácená volba – vyber znovu' });
    voleb = Math.max(0, voleb - 1);
    pricist(-1, -(h.modelky.length - 1));
    vykreslit();
}

function zavrit() {
    document.removeEventListener('keydown', klavesa, true);
    okno?.parentElement?.remove();
    okno = null;
}

function klavesa(e) {
    if (!okno) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (historie.length && okno.querySelector('.dv-karty')) shrnuti();
        else zavrit();
        return;
    }
    if (e.key === 'Backspace') {
        e.preventDefault();
        vratit();
        return;
    }
    const n = parseInt(e.key, 10);
    const c = fronta[0];
    if (n >= 1 && c && n <= c.modelky.length && okno.querySelector('.dv-karty')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        vybrat(c.modelky[n - 1]);
    }
}

// Otevře dnešní výběr (kartička po spuštění, nabídka ⋯)
export async function otevritDnesniVyber() {
    schovatKarticku();
    if (okno) return;
    const pozadi = document.createElement('div');
    pozadi.className = 'dv-pozadi';
    pozadi.innerHTML = '<div class="dv-okno" role="dialog" aria-label="Dnešní výběr"><div class="dv-prazdno">Připravuji čtveřice…</div></div>';
    document.body.append(pozadi);
    okno = pozadi.querySelector('.dv-okno');
    historie = [];
    voleb = 0;
    poradiPred = new Map();
    document.addEventListener('keydown', klavesa, true);
    okno.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const karta = /** @type {HTMLElement | null} */ (cil.closest('[data-dv-vyber]'));
        if (karta) return vybrat(parseInt(karta.dataset.dvVyber, 10));
        if (cil.closest('[data-dv-vratit]')) return vratit();
        if (cil.closest('[data-dv-dalsi]')) {
            historie = [];
            vykreslit();
            return doplnit().then(vykreslit);
        }
        const profil = /** @type {HTMLElement | null} */ (cil.closest('[data-dv-profil]'));
        if (profil) {
            zavrit();
            return otevritProfilPodleId(parseInt(profil.dataset.dvProfil, 10));
        }
        if (cil.closest('[data-dv-konec]')) zavrit();
    });
    jmena = new Map((await vsechnyModelky().catch(() => [])).map(m => [m.id, m]));
    fronta = fronta.filter(c => c.modelky.every(id => jmena.has(id)));
    await doplnit();
    vykreslit();
}

// --- Kartička po spuštění ---

function schovatKarticku() {
    document.querySelector('.dv-karticka')?.remove();
}

// Po úvodu: když dnes ještě nebyla dávka hotová a kartička se dnes neschovala, nabídne dnešní výběr
export async function nabidnoutPoSpusteni() {
    if (dnesVoleb() >= DAVKA || nacist(KLIC_SCHOVANO) === dnes()) return;
    let lakadlo = '';
    try { lakadlo = await GetLakadloPorovnani() || ''; } catch { return; }
    if (!lakadlo || document.querySelector('.dv-karticka')) return;
    const hotovo = dnesVoleb();
    const k = document.createElement('div');
    k.className = 'dv-karticka';
    k.setAttribute('role', 'dialog');
    k.setAttribute('aria-label', 'Dnešní výběr');
    k.innerHTML = `<button type="button" class="dv-zavrit" aria-label="Dnes už nenabízet" title="Dnes už nenabízet">×</button>
        <b>Dnešní výběr</b><span class="dv-meta">${hotovo ? `${hotovo} z ${DAVKA} hotovo · ` : ''}${DAVKA} × nejlepší ze 4 · asi 2 minuty</span>
        <p>${esc(lakadlo)}</p>
        <button type="button" class="dv-tlacitko hlavni">${hotovo ? 'Pokračovat' : 'Začít'}</button>`;
    k.querySelector('.dv-zavrit').addEventListener('click', () => {
        ulozit(KLIC_SCHOVANO, dnes());
        schovatKarticku();
    });
    k.querySelector('.dv-tlacitko').addEventListener('click', otevritDnesniVyber);
    document.body.append(k);
}
