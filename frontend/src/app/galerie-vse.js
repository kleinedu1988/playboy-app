// Galerie všech fotek napříč modelkami (Modelky › Galerie › Všechny fotky; galerie_fotek.go GetGalerieFotek):
// nahoře hero banner s fotkou z čela výběru, pod ním široká lišta (zobrazit, řazení, ☰ Filtry, štítky filtrů)
// a rozbalovací pás filtrů – srdíčka fotky, typ alba, desetiletí a tagy, u každé hodnoty počet fotek, které zbudou;
// pak mozaika po stránkách. Výchozí řazení „Co se ti
// asi líbí“: tvoje srdíčka a u nehodnocených odhad z obsahu fotek, promíchané napříč alby. Dotaz i otevřený panel
// se pamatují. Text hledání v hlavičce omezuje galerii (jméno modelky, album, fotograf).
import { GetGalerieFotek } from './backend';
import { esc, nazevAlba, nazevVydani, obrazek, sklonovat } from '../lib/format';
import { stav } from './stav';
import { best } from './prvky';
import { katalogTagu } from './tagy-fotek';
import { VELIKOST_PLAKATU, nacitatPostupne } from './obrazky';
import { htmlNicNenalezeno } from '../ui/prazdno';
import { otevritLightbox } from './prohlizec';
import { otevritProfilPodleId } from './cover';
import { podobneZapnuto, ukazatPodobne } from './obsah-fotek';

const STRANKA = 300;
const KLIC_DOTAZU = 'galerieDotaz';
const KLIC_PANELU = 'galerieFiltryOtevrene';
const SEMINKO = Date.now() % 100000;

const RAZENI = [['libi', 'Co se ti asi líbí', 'Tvoje srdíčka, u nehodnocených odhad z obsahu fotek; promíchané napříč alby'],
    ['hodnota', 'Nejlepší', 'Srdíčka fotky × oblíbenost modelky'], ['nove', 'Nejnovější', 'Naposledy přidané'], ['nahodne', 'Náhodně', '']];
const SRDICKA = [['', 'Všechny'], ['3', '♥ 3+'], ['4', '♥ 4+'], ['5', '♥ 5'], ['0', 'Bez srdíček']];

/** @type {{ razeni: string, srdicka: string, typy: string[], tagy: string[], dekady: string[] }} */
let dotaz = { razeni: 'libi', srdicka: '', typy: [], tagy: [], dekady: [] };
try { dotaz = { ...dotaz, ...JSON.parse(localStorage.getItem(KLIC_DOTAZU) || '{}') }; } catch { /* výchozí */ }
let text = '';
let celkem = 0;
let fasety = { srdicka: {}, typy: {}, tagy: {}, dekady: {} };
let nacitani = null;
let pozorovatel = null;
let vykreslitDlazdici = (_p, _i) => '';
let poVykresleni = () => {};

// Široký pás filtrů pod lištou (rozbalí ☰ Filtry); pamatuje se, výchozí zavřený
const filtryOtevrene = () => { try { return localStorage.getItem(KLIC_PANELU) === '1'; } catch { return false; } };
let nazvyTagu = new Map();
function ulozitDotaz() {
    try { localStorage.setItem(KLIC_DOTAZU, JSON.stringify(dotaz)); } catch { /* jen pro toto spuštění */ }
}
const pocetFiltru = () => (dotaz.srdicka ? 1 : 0) + dotaz.typy.length + dotaz.tagy.length + dotaz.dekady.length;

const polozka = f => ({ fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni });

async function nacistStranku(od) {
    const s = await GetGalerieFotek({ ...dotaz, modelka: 0, text, seminko: SEMINKO, od, kolik: STRANKA });
    celkem = s?.celkem || 0;
    fasety = s?.fasety || fasety;
    return (s?.fotky || []).map(polozka);
}

// Mozaika galerie všech fotek; dlazdice a pripravit dodá nejlepsi.js (stejné dlaždice jako Nejlepší)
export async function nacistVsechnyFotky(hledani, { htmlNastroju, dlazdice, pripravit }) {
    vykreslitDlazdici = dlazdice;
    poVykresleni = pripravit;
    text = hledani || '';
    const moje = ++stav.cisloNacteni;
    const polozky = await nacistStranku(0).catch(() => []);
    if (moje !== stav.cisloNacteni) return;
    stav.nejlepsiPolozky = polozky;
    const seznam = document.getElementById('bestList');
    best.classList.add('galerie-vse');
    const filtry = pocetFiltru();
    const razeni = RAZENI.map(([k, n, t]) => `<button class="chip ${dotaz.razeni === k ? 'active' : ''}" data-gv="razeni" data-hodnota="${k}"${t ? ` title="${esc(t)}"` : ''}>${esc(n)}</button>`).join('');
    // Hero banner jen bez hledání (výsledky hledání hned nahoře)
    const hero = polozky.length && !text.trim() ? '<section class="profily-hero gv-hero" aria-label="Fotka z galerie"></section>' : '';
    seznam.innerHTML = `${hero}
        <div class="gallery-toolbar profily-lista gv-lista">
            <div class="pl-razeni" role="group" aria-label="Zobrazit">${htmlNastroju}</div>
            <span class="gv-oddelovac" aria-hidden="true"></span>
            <div class="pl-razeni" role="group" aria-label="Řazení">${razeni}</div>
            <button type="button" class="pl-filtry ${filtry ? 'zapnuto' : ''}" data-gv-panel aria-expanded="${filtryOtevrene()}">☰ Filtry${filtry ? ` <small>${filtry}</small>` : ''}</button>
            ${htmlStitku()}
            <span class="pl-pocet">${esc(sklonovat(celkem, 'fotka', 'fotky', 'fotek'))}</span>
            ${polozky.length ? '<button type="button" class="pl-filtry" data-nejlepsi-slideshow title="Spustit slideshow">▶ Slideshow</button>' : ''}
        </div>
        <div class="gv-filtry ${filtryOtevrene() ? '' : 'hidden'}"></div>
        ${polozky.length ? '<div class="nejlepsi-mozaika gv-mozaika"></div><button type="button" class="link nejlepsi-dalsi hidden" data-gv-dalsi></button>'
            : htmlNicNenalezeno(filtry || text ? 'Filtrům ani hledání neodpovídá žádná fotka.' : 'Ve sbírce zatím nejsou fotky.')}`;
    pripojit(polozky, 0);
    sledovatKonec();
    vykreslitPanel();
    if (hero) naplnitHeroGalerie(seznam.querySelector('.gv-hero'));
    // V prohlížeči se další stránka dotáhne, než dojde na konec načtené části
    stav.lbDotahnout = null;
}

// Štítky zapnutých filtrů s křížkem (v liště)
function htmlStitku() {
    const srd = SRDICKA.find(([k]) => k === dotaz.srdicka && k);
    const stitky = [
        ...(srd ? [['srdicka', dotaz.srdicka, srd[1]]] : []),
        ...dotaz.typy.map(t => ['typy', t, t]),
        ...dotaz.dekady.map(d => ['dekady', d, `${d.slice(2)}. léta`]),
        ...dotaz.tagy.map(t => ['tagy', t, nazvyTagu.get(t) || t]),
    ];
    return stitky.map(([sk, h, n]) => `<span class="pl-stitek"><button type="button" data-gv-panel>${esc(n)}</button><button type="button" data-gv="${sk}" data-hodnota="${esc(h)}" aria-label="Zrušit filtr" title="Zrušit filtr">×</button></span>`).join('');
}

// Hero: jedna z fotek z čela výběru (střídá se, Další ↻), s modelkou a albem
const KLIC_HERO = 'galerieHeroTip';
async function naplnitHeroGalerie(misto) {
    const kandidati = stav.nejlepsiPolozky.slice(0, 30);
    if (!misto || !kandidati.length) return;
    let i = 0;
    try { i = (parseInt(localStorage.getItem(KLIC_HERO) || '0', 10) || 0) % kandidati.length; } catch { /* první */ }
    const p = kandidati[i];
    const f = p.fotky[0];
    const adresa = obrazek(f.url, VELIKOST_PLAKATU);
    const odkud = [nazevAlba(p.album, p.typ), f.vydani && f.vydani !== p.album ? nazevVydani(f.vydani) : ''].filter(Boolean).join(' · ');
    const srdicka = f.hodnoceni > 0 ? '♥'.repeat(f.hodnoceni) : '';
    misto.innerHTML = `
        <div class="ph-rozmazane" style="background-image:url('${esc(adresa).replace(/'/g, '%27')}')"></div>
        <div class="ph-ram"><img src="${esc(adresa)}" alt="" draggable="false" /></div>
        <div class="ph-prekryv"></div>
        <div class="ph-obsah">
            <div class="ph-nadtitulek">${esc(RAZENI.find(([k]) => k === dotaz.razeni)?.[1] || 'Galerie')}</div>
            <h2>${esc(p.jmenoModelky || '')}</h2>
            ${srdicka ? `<div class="ph-srdicka">${srdicka}</div>` : ''}
            ${odkud ? `<p class="ph-duvod">${esc(odkud)}</p>` : ''}
            <div class="ph-akce">
                <button type="button" class="ph-tlacitko hlavni" data-gvh-otevrit="${i}">Otevřít fotku</button>
                ${p.modelkaId ? `<button type="button" class="ph-tlacitko" data-gvh-profil="${p.modelkaId}">Profil modelky</button>` : ''}
                ${podobneZapnuto() ? `<button type="button" class="ph-tlacitko" data-gvh-podobne="${i}">Podobné fotky</button>` : ''}
                ${kandidati.length > 1 ? '<button type="button" class="ph-tlacitko" data-gvh-dalsi title="Další fotka">Další ↻</button>' : ''}
            </div>
        </div>`;
    misto.onclick = (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const otevrit = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-otevrit]'));
        if (otevrit) return otevritLightbox(parseInt(otevrit.dataset.gvhOtevrit, 10), false, stav.nejlepsiPolozky);
        const profil = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-profil]'));
        if (profil) return otevritProfilPodleId(parseInt(profil.dataset.gvhProfil, 10));
        const podobne = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-podobne]'));
        if (podobne) return ukazatPodobne(stav.nejlepsiPolozky[parseInt(podobne.dataset.gvhPodobne, 10)].fotky[0]);
        if (cil.closest('[data-gvh-dalsi]')) {
            try { localStorage.setItem(KLIC_HERO, String((i + 1) % kandidati.length)); } catch { /* jen teď */ }
            naplnitHeroGalerie(misto);
        }
    };
}

function pripojit(polozky, od) {
    const mozaika = document.querySelector('#bestList .gv-mozaika');
    if (!mozaika) return;
    mozaika.insertAdjacentHTML('beforeend', polozky.map((p, i) => vykreslitDlazdici(p, od + i)).join(''));
    poVykresleni();
    nacitatPostupne(document.getElementById('bestList'));
    const dalsi = /** @type {HTMLElement | null} */ (document.querySelector('#bestList [data-gv-dalsi]'));
    if (dalsi) {
        const zbyva = celkem - stav.nejlepsiPolozky.length;
        dalsi.classList.toggle('hidden', zbyva <= 0);
        dalsi.textContent = `Zobrazit další fotky (${zbyva})`;
    }
}

export async function nacistDalsi() {
    if (nacitani || stav.nejlepsiPolozky.length >= celkem) return nacitani;
    const od = stav.nejlepsiPolozky.length;
    nacitani = nacistStranku(od).then((nove) => {
        stav.nejlepsiPolozky = stav.nejlepsiPolozky.concat(nove);
        pripojit(nove, od);
    }).catch(() => {}).finally(() => { nacitani = null; });
    return nacitani;
}

function sledovatKonec() {
    pozorovatel?.disconnect();
    const konec = document.querySelector('#bestList [data-gv-dalsi]');
    if (!konec) return;
    pozorovatel = new IntersectionObserver(z => { if (z.some(x => x.isIntersecting)) nacistDalsi(); },
        { root: document.querySelector('main'), rootMargin: '0px 0px 2400px 0px' });
    pozorovatel.observe(konec);
}

export function prestatSledovatGalerii() {
    pozorovatel?.disconnect();
    pozorovatel = null;
    best.classList.remove('galerie-vse');
}

async function vykreslitPanel() {
    const panel = document.querySelector('#bestList .gv-filtry');
    if (!panel) return;
    const katalog = await katalogTagu();
    nazvyTagu = new Map(katalog.flatMap(sk => sk.tagy.map(t => [t.klic, t.nazev])));
    const nazevTagu = nazvyTagu;
    const volba = (skupina, hodnota, nazev, pocet, zapnuto, titulek = '') =>
        `<button type="button" class="gv-volba ${zapnuto ? 'on' : ''}" data-gv="${skupina}" data-hodnota="${esc(hodnota)}" aria-pressed="${zapnuto}"${titulek ? ` title="${esc(titulek)}"` : ''}>${esc(nazev)}${pocet !== undefined ? `<small>${pocet}</small>` : ''}</button>`;
    const typy = Object.entries(fasety.typy || {}).sort((a, b) => b[1] - a[1]);
    const dekady = Object.entries(fasety.dekady || {}).sort((a, b) => a[0].localeCompare(b[0]));
    const tagy = katalog.map(sk => ({ sk, tagy: sk.tagy.filter(t => (fasety.tagy || {})[t.klic] || dotaz.tagy.includes(t.klic)) })).filter(x => x.tagy.length);
    panel.innerHTML = `
        ${pocetFiltru() ? '<button type="button" class="link gv-zrusit" data-gv-zrusit>zrušit všechny filtry</button>' : ''}
        <section><h4>Srdíčka fotky</h4><div class="gv-volby">${SRDICKA.map(([k, n]) => volba('srdicka', k, n, k ? (fasety.srdicka || {})[k] || 0 : undefined, dotaz.srdicka === k)).join('')}</div></section>
        ${typy.length ? `<section><h4>Typ alba</h4><div class="gv-volby">${typy.map(([k, p]) => volba('typy', k, k, p, dotaz.typy.includes(k))).join('')}</div></section>` : ''}
        ${dekady.length ? `<section><h4>Období</h4><div class="gv-volby">${dekady.map(([k, p]) => volba('dekady', k, `${k.slice(2)}. léta`, p, dotaz.dekady.includes(k))).join('')}</div></section>` : ''}
        ${tagy.length ? `<section><h4>Tagy</h4>${tagy.map(x => `<div class="gv-podnadpis">${esc(x.sk.nazev)}</div><div class="gv-volby">${x.tagy.map(t => volba('tagy', t.klic, nazevTagu.get(t.klic) || t.klic, (fasety.tagy || {})[t.klic] || 0, dotaz.tagy.includes(t.klic))).join('')}</div>`).join('')}</section>` : ''}`;
}

// Obsluha panelu a stránkování; nacistZnovu = načíst galerii znovu (nejlepsi.js, s textem hledání)
export function pripravitGalerii(nacistZnovu) {
    best.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        if (cil.closest('[data-gv-panel]')) {
            const otevrit = !filtryOtevrene();
            try { localStorage.setItem(KLIC_PANELU, otevrit ? '1' : '0'); } catch { /* jen teď */ }
            document.querySelector('#bestList .gv-filtry')?.classList.toggle('hidden', !otevrit);
            document.querySelector('#bestList [data-gv-panel].pl-filtry')?.setAttribute('aria-expanded', String(otevrit));
            return;
        }
        if (cil.closest('[data-gv-dalsi]')) {
            nacistDalsi();
            return;
        }
        if (cil.closest('[data-gv-zrusit]')) {
            dotaz = { ...dotaz, srdicka: '', typy: [], tagy: [], dekady: [] };
            ulozitDotaz();
            nacistZnovu();
            return;
        }
        const v = /** @type {HTMLElement | null} */ (cil.closest('[data-gv]'));
        if (!v) return;
        const skupina = v.dataset.gv;
        const hodnota = v.dataset.hodnota;
        if (skupina === 'razeni' || skupina === 'srdicka') dotaz[skupina] = hodnota;
        else {
            const seznam = dotaz[skupina];
            dotaz[skupina] = seznam.includes(hodnota) ? seznam.filter(x => x !== hodnota) : [...seznam, hodnota];
        }
        ulozitDotaz();
        nacistZnovu();
    });
}
