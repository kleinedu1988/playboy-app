// Galerie všech fotek napříč modelkami (Modelky › Galerie › Všechny fotky; galerie_fotek.go GetGalerieFotek):
// nahoře hero banner s fotkami z čela výběru (fotka, ne modelka), pod ním široká lišta (zobrazit, řazení, ☰ Filtry, štítky filtrů)
// a rozbalovací pás filtrů – srdíčka fotky, typ alba, desetiletí a tagy, u každé hodnoty počet fotek, které zbudou;
// pak mozaika po stránkách. Výchozí řazení „Co se ti
// asi líbí“: tvoje srdíčka a u nehodnocených odhad z obsahu fotek, promíchané napříč alby. Dotaz i otevřený panel
// se pamatují. Text hledání v hlavičce omezuje galerii (jméno modelky, album, fotograf).
import { GetGalerieFotek, GetKolekceGalerie, GetVsechnyKolekce, GetVyberyGalerie, UlozitVyberGalerie, SmazatVyberGalerie, ZaznamenatKolekci, GetStavHledaniSlovy, ZapnoutHledaniSlovy } from './backend';
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

// Kolekce (galerie_kolekce.go): řady pod bannerem a hero přes kolekce; zvolená kolekce („Zobrazit vše“) omezuje
// mozaiku (nepamatuje se – jen do dalšího přepnutí)
/** @type {{ klic: string, nazev: string, duvod: string, skupina: string, pocet: number, fotky: any[], oblibena?: boolean }[]} */
let kolekce = [];
// Zájem o kolekci (osobní pořadí řad): otevření celé kolekce, nebo fotka z řady
const zaznamenat = (klic, akce) => { if (klic) ZaznamenatKolekci(klic, akce).catch(() => {}); };
let zvolenaKolekce = { klic: '', nazev: '' };

// Panel kolekcí (▦ Kolekce v liště): uložené výběry a všechny kolekce po skupinách jako dlaždice s fotkou;
// otevřený panel se pamatuje
const KLIC_PANELU_KOLEKCI = 'galerieKolekceOtevrene';
const kolekceOtevrene = () => { try { return localStorage.getItem(KLIC_PANELU_KOLEKCI) === '1'; } catch { return false; } };
const SKUPINY_KOLEKCI = { tvoje: 'Pro tebe', cas: 'Čas', styl: 'Objevené styly', barvy: 'Barvy a světlo', obsah: 'Obsah fotek', vzhled: 'Vzhled modelek', kariera: 'Kariéra' };
const VYCHOZI_DOTAZ = { razeni: 'libi', srdicka: '', typy: [], tagy: [], dekady: [] };
/** @type {{ klic: string, nazev: string, duvod: string, skupina: string, pocet: number, fotka: any }[]} */
let vsechnyKolekce = [];
/** @type {{ nazev: string, nazevKolekce: string, dotaz: any }[]} */
let vybery = [];
let ukladaniVyberu = false;
// Výběr se dá uložit, když se liší od výchozí galerie
const lzeUlozit = () => Boolean(pocetFiltru() || zvolenaKolekce.klic || dotaz.razeni !== 'libi');

// Hledání slovy (galerie_slovy.go): text hledaný v obsahu fotek, poznaná modelka, nabídka stažení modelu
let slovy = { obsahem: false, rozpoznano: '', nabidnout: false };
let nacistGaleriiZnovu = () => {};
let casovacSlov = 0;

async function nacistStranku(od) {
    const s = await GetGalerieFotek({ ...dotaz, modelka: 0, text, seminko: SEMINKO, od, kolik: STRANKA, kolekce: zvolenaKolekce.klic });
    if (od === 0) slovy = { obsahem: Boolean(s?.obsahem), rozpoznano: s?.rozpoznano || '', nabidnout: Boolean(s?.nabidnoutSlovy) };
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
    // Řady kolekcí jen v čisté galerii (bez hledání, filtrů a zvolené kolekce)
    const cista = !text.trim() && !pocetFiltru() && !zvolenaKolekce.klic;
    const [polozky, k] = await Promise.all([nacistStranku(0).catch(() => []), cista ? GetKolekceGalerie().catch(() => []) : Promise.resolve([])]);
    if (moje !== stav.cisloNacteni) return;
    kolekce = (k || []).filter(r => r.fotky?.length);
    stav.nejlepsiPolozky = polozky;
    const seznam = document.getElementById('bestList');
    best.classList.add('galerie-vse');
    const filtry = pocetFiltru() + (zvolenaKolekce.klic ? 1 : 0);
    const razeni = RAZENI.map(([k, n, t]) => `<button class="chip ${dotaz.razeni === k ? 'active' : ''}" data-gv="razeni" data-hodnota="${k}"${t ? ` title="${esc(t)}"` : ''}>${esc(n)}</button>`).join('');
    // Hero banner jen bez hledání (výsledky hledání hned nahoře)
    const hero = polozky.length && !text.trim() ? '<section class="profily-hero gv-hero" aria-label="Fotka z galerie"></section>' : '';
    seznam.innerHTML = `${hero}
        ${cista && kolekce.length ? `<div class="gv-rady">${kolekce.map(htmlRady).join('')}</div>` : ''}
        <div class="gallery-toolbar profily-lista gv-lista">
            <div class="pl-razeni" role="group" aria-label="Zobrazit">${htmlNastroju}</div>
            <span class="gv-oddelovac" aria-hidden="true"></span>
            <div class="pl-razeni" role="group" aria-label="Řazení">${razeni}</div>
            <button type="button" class="pl-filtry ${zvolenaKolekce.klic ? 'zapnuto' : ''}" data-gv-kolekce-panel aria-expanded="${kolekceOtevrene()}" title="Všechny kolekce a uložené výběry">▦ Kolekce</button>
            <button type="button" class="pl-filtry ${filtry ? 'zapnuto' : ''}" data-gv-panel aria-expanded="${filtryOtevrene()}">☰ Filtry${filtry ? ` <small>${filtry}</small>` : ''}</button>
            ${slovy.obsahem ? `<span class="gv-slovy" title="Textu neodpovídá jméno, album ani fotograf – fotky jsou seřazené podle toho, jak obsahem odpovídají popisu">🔎 V obsahu fotek${slovy.rozpoznano ? ` · ${esc(slovy.rozpoznano)}` : ''}</span>` : ''}
            ${htmlStitku()}
            <span class="pl-pocet">${esc(sklonovat(celkem, 'fotka', 'fotky', 'fotek'))}</span>
            ${polozky.length ? '<button type="button" class="pl-filtry" data-nejlepsi-slideshow title="Spustit slideshow">▶ Slideshow</button>' : ''}
        </div>
        <div class="gv-panel-kolekci ${kolekceOtevrene() ? '' : 'hidden'}"></div>
        <div class="gv-filtry ${filtryOtevrene() ? '' : 'hidden'}"></div>
        ${polozky.length ? '<div class="nejlepsi-mozaika gv-mozaika"></div><button type="button" class="link nejlepsi-dalsi hidden" data-gv-dalsi></button>'
            : slovy.nabidnout ? htmlNabidkySlov()
                : htmlNicNenalezeno(slovy.obsahem ? `V obsahu fotek jsem k „${text.trim()}“ nic výrazného nenašel. Zkus popis, třeba „zrzavé vlasy na pláži“ nebo „v kuchyni“.`
                    : filtry || text ? 'Filtrům ani hledání neodpovídá žádná fotka.' : 'Ve sbírce zatím nejsou fotky.')}`;
    pripojit(polozky, 0);
    sledovatKonec();
    vykreslitPanel();
    if (slovy.nabidnout) sledovatStazeniSlov();
    ukladaniVyberu = false;
    if (kolekceOtevrene()) vykreslitPanelKolekci();
    if (hero) naplnitHeroGalerie(seznam.querySelector('.gv-hero'));
    // V prohlížeči se další stránka dotáhne, než dojde na konec načtené části
    stav.lbDotahnout = null;
}

// Řada kolekce: název, proč, počet, Zobrazit vše a vodorovný pás fotek se šipkami
function htmlRady(r, n) {
    const dlazdice = r.fotky.map((f, i) => `<button type="button" class="gv-dlazdice" data-gv-rada="${n}" data-gv-fotka="${i}" title="${esc(`${f.jmenoModelky || ''} · ${nazevAlba(f.album, f.typ)}`)}">
        <img src="${esc(obrazek(f.url, 'w400'))}" alt="" loading="lazy" draggable="false" />${f.hodnoceni ? `<span class="gv-srd">${'♥'.repeat(f.hodnoceni)}</span>` : ''}</button>`).join('');
    return `<section class="gv-rada">
        <div class="gv-rada-hlava"><h3>${esc(r.nazev)}</h3>${r.oblibena ? '<span class="gv-rada-oblibena" title="Tuhle kolekci často otevíráš – proto je výš">★ často otevíráš</span>' : ''}<span class="gv-rada-duvod">${esc(r.duvod)}</span>
            <button type="button" class="link gv-vse" data-gv-kolekce="${n}">Zobrazit vše (${r.pocet.toLocaleString('cs-CZ')}) ›</button></div>
        <div class="gv-rada-telo"><button type="button" class="gv-posun vlevo" data-gv-posun="-1" aria-label="Posunout zpět">‹</button>
            <div class="gv-pas-rady">${dlazdice}</div>
            <button type="button" class="gv-posun vpravo" data-gv-posun="1" aria-label="Posunout dál">›</button></div>
    </section>`;
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
    return (zvolenaKolekce.klic ? `<span class="pl-stitek"><button type="button">Kolekce: ${esc(zvolenaKolekce.nazev)}</button><button type="button" data-gv-bez-kolekce aria-label="Zrušit kolekci" title="Zpět na všechny fotky">×</button></span>` : '')
        + stitky.map(([sk, h, n]) => `<span class="pl-stitek"><button type="button" data-gv-panel>${esc(n)}</button><button type="button" data-gv="${sk}" data-hodnota="${esc(h)}" aria-label="Zrušit filtr" title="Zrušit filtr">×</button></span>`).join('');
}

// Hero: fotky z čela výběru (ne modelka) jako ve streamovacích službách – nadpis je album nebo číslo, modelka menší
// odkaz na profil, nadtitulek říká, proč tu fotka je. Banner se sám po PRODLEVA_HERO plynule prolne na další fotku;
// vpravo dole čárky (aktivní se plní průběhem), klik na čárku přepne, najetí myší rotaci zastaví.
const KLIC_HERO = 'galerieHeroTip';
const FOTEK_V_HERO = 8;
const PRODLEVA_HERO = 8000;
let casovacHero = 0;

function proc(f) {
    if (f.hodnoceni > 0) return `Tvoje ${'♥'.repeat(f.hodnoceni)}`;
    return { libi: 'Podle obsahu by se ti mohla líbit', nove: 'Nově přidaná', nahodne: 'Náhodná fotka', hodnota: 'Z nejlepších' }[dotaz.razeni] || 'Z galerie';
}

async function naplnitHeroGalerie(misto, index = null) {
    clearTimeout(casovacHero);
    // Hero přes kolekce (nejlepší fotka každé řady), bez kolekcí přes fotky z čela výběru
    const zKolekci = kolekce.length > 1;
    const kandidati = zKolekci ? kolekce.slice(0, FOTEK_V_HERO).map(r => polozka(r.fotky[0])) : stav.nejlepsiPolozky.slice(0, FOTEK_V_HERO);
    if (!misto || !misto.isConnected || !kandidati.length) return;
    let i = index ?? 0;
    if (index === null) {
        try { i = (parseInt(localStorage.getItem(KLIC_HERO) || '0', 10) || 0) % kandidati.length; } catch { /* první */ }
    }
    const p = kandidati[i];
    const f = p.fotky[0];
    const adresa = obrazek(f.url, VELIKOST_PLAKATU);
    const album = nazevAlba(p.album, p.typ);
    const vydani = f.vydani && f.vydani !== p.album ? nazevVydani(f.vydani) : '';
    const carky = kandidati.length > 1 ? kandidati.map((k, j) => `<button type="button" class="gvh-carka ${j === i ? 'on' : ''}" data-gvh-ukazat="${j}" aria-label="${esc(`Fotka ${j + 1}: ${k.jmenoModelky || ''}`)}" title="${esc(`${k.jmenoModelky || ''} · ${nazevAlba(k.album, k.typ)}`)}"><i style="animation-duration:${PRODLEVA_HERO}ms"></i></button>`).join('') : '';
    misto.innerHTML = `
        <div class="ph-rozmazane" style="background-image:url('${esc(adresa).replace(/'/g, '%27')}')"></div>
        <div class="ph-ram gvh-prolnuti"><img src="${esc(adresa)}" alt="" draggable="false" /></div>
        <div class="ph-prekryv"></div>
        <div class="ph-obsah gvh-prolnuti">
            <div class="ph-nadtitulek">${esc(zKolekci ? kolekce[i].nazev : proc(f))}</div>
            <h2 class="gvh-nadpis">${esc(album || 'Fotka')}</h2>
            <div class="gvh-modelka">${p.modelkaId ? `<button type="button" class="gvh-odkaz" data-gvh-profil="${p.modelkaId}" title="Otevřít profil modelky">${esc(p.jmenoModelky || '')}</button>` : ''}${vydani ? `<span>${esc(vydani)}</span>` : ''}</div>
            <div class="ph-akce">
                ${zKolekci ? `<button type="button" class="ph-tlacitko hlavni" data-gv-kolekce="${i}">Celá kolekce (${kolekce[i].pocet.toLocaleString('cs-CZ')})</button>` : ''}
                <button type="button" class="ph-tlacitko ${zKolekci ? '' : 'hlavni'}" data-gvh-otevrit="${i}">Otevřít fotku</button>
                ${podobneZapnuto() ? `<button type="button" class="ph-tlacitko" data-gvh-podobne="${i}">Podobné fotky</button>` : ''}
            </div>
        </div>
        ${carky ? `<div class="gvh-carky" role="group" aria-label="Fotky v banneru">
            <button type="button" class="gvh-sipka vlevo" data-gvh-ukazat="${(i - 1 + kandidati.length) % kandidati.length}" aria-label="Předchozí" title="Předchozí (←)">‹</button>
            ${carky}
            <button type="button" class="gvh-sipka vpravo" data-gvh-ukazat="${(i + 1) % kandidati.length}" aria-label="Další" title="Další (→)">›</button></div>` : ''}`;
    const ukazat = (j) => {
        try { localStorage.setItem(KLIC_HERO, String(j)); } catch { /* jen teď */ }
        naplnitHeroGalerie(misto, j);
    };
    // Automatické přepínání; najetí myší ho zastaví (i průběh v čárce), odjetí pustí znovu od začátku
    const spustit = () => {
        clearTimeout(casovacHero);
        misto.classList.remove('stoji');
        if (kandidati.length < 2 || misto.matches(':hover')) return;
        casovacHero = setTimeout(() => {
            if (!misto.isConnected) return;
            // Galerie není vidět (jiná sekce): nepřepínat, zkusit později
            if (best.classList.contains('hidden')) return spustit();
            ukazat((i + 1) % kandidati.length);
        }, PRODLEVA_HERO);
    };
    misto.onpointerenter = () => {
        clearTimeout(casovacHero);
        misto.classList.add('stoji');
    };
    // Odjetí: průběh v čárce začne znovu a časovač s ním (bez překreslení banneru)
    misto.onpointerleave = () => {
        const prubeh = /** @type {HTMLElement | null} */ (misto.querySelector('.gvh-carka.on i'));
        if (prubeh) {
            prubeh.style.animation = 'none';
            void prubeh.offsetWidth;
            prubeh.style.animation = '';
        }
        spustit();
    };
    misto.onclick = (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const otevrit = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-otevrit]'));
        if (otevrit) return otevritLightbox(parseInt(otevrit.dataset.gvhOtevrit, 10), false, kandidati);
        const profil = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-profil]'));
        if (profil) return otevritProfilPodleId(parseInt(profil.dataset.gvhProfil, 10));
        const podobne = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-podobne]'));
        if (podobne) return ukazatPodobne(kandidati[parseInt(podobne.dataset.gvhPodobne, 10)].fotky[0]);
        const carka = /** @type {HTMLElement | null} */ (cil.closest('[data-gvh-ukazat]'));
        if (carka) ukazat(parseInt(carka.dataset.gvhUkazat, 10));
    };
    spustit();
}

// Šipky ← → listují bannerem, když je nad ním myš
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const hero = document.querySelector('#bestList .gv-hero');
    if (!hero?.matches(':hover') || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const sipka = /** @type {HTMLElement | null} */ (hero.querySelector(`.gvh-sipka.${e.key === 'ArrowLeft' ? 'vlevo' : 'vpravo'}`));
    if (!sipka) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    sipka.click();
}, true);

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
    clearTimeout(casovacHero);
    clearTimeout(casovacSlov);
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

async function vykreslitPanelKolekci() {
    const panel = document.querySelector('#bestList .gv-panel-kolekci');
    if (!panel) return;
    if (!vsechnyKolekce.length) panel.innerHTML = '<p class="gv-k-nacita">Načítám kolekce…</p>';
    const [k, v] = await Promise.all([GetVsechnyKolekce().catch(() => []), GetVyberyGalerie().catch(() => [])]);
    vsechnyKolekce = k || [];
    vybery = v || [];
    if (!panel.isConnected) return;
    const skupiny = Object.entries(SKUPINY_KOLEKCI).map(([sk, nazev]) => ({ nazev, k: vsechnyKolekce.map((x, i) => ({ ...x, i })).filter(x => x.skupina === sk) })).filter(x => x.k.length);
    const dlazdice = x => `<button type="button" class="gv-k-dlazdice ${x.klic === zvolenaKolekce.klic ? 'on' : ''}" data-gv-k="${x.i}" title="${esc(x.duvod)}">
        <img src="${esc(obrazek(x.fotka?.url || '', 'w400'))}" alt="" loading="lazy" draggable="false" />
        <span class="gv-k-text"><b>${esc(x.nazev)}</b><small>${x.pocet.toLocaleString('cs-CZ')}</small></span></button>`;
    const ulozene = vybery.map((x, i) => `<span class="pl-stitek"><button type="button" data-gv-vyber="${i}" title="${esc(popisVyberu(x))}">★ ${esc(x.nazev)}</button><button type="button" data-gv-smazat-vyber="${i}" aria-label="Smazat výběr" title="Smazat uložený výběr">×</button></span>`).join('');
    const ulozit = ukladaniVyberu
        ? `<form class="gv-ulozit-form" data-gv-ulozit-form><input type="text" maxlength="60" placeholder="Název výběru" aria-label="Název výběru" required /><button type="submit" class="ph-tlacitko hlavni">Uložit</button><button type="button" class="link" data-gv-ulozit-zrusit>zrušit</button></form>`
        : `<button type="button" class="link" data-gv-ulozit ${lzeUlozit() ? '' : 'disabled title="Nejdřív zvol kolekci, filtry nebo řazení"'}>+ Uložit tento výběr</button>`;
    panel.innerHTML = `
        <section class="gv-vybery"><h4>Uložené výběry</h4><div class="gv-volby">${ulozene || '<span class="gv-k-prazdne">Zatím žádné – zvol kolekci, filtry nebo řazení a ulož si je.</span>'}${ulozit}</div></section>
        ${skupiny.map(s => `<section><h4>${esc(s.nazev)}</h4><div class="gv-k-mrizka">${s.k.map(dlazdice).join('')}</div></section>`).join('')}`;
    panel.querySelector('input')?.focus();
}

// Nabídka hledání slovy, když textu nic neodpovídá a textový model není stažený
function htmlNabidkySlov() {
    return `<div class="gv-nabidka-slov">
        <h3>Hledat „${esc(text.trim())}“ v obsahu fotek?</h3>
        <p>Textu neodpovídá žádné jméno, album ani fotograf. S hledáním slovy najdeš fotky podle toho, co je na nich – třeba „v kuchyni“, „červené auto“, „ve sněhu“ nebo „Pamela na pláži“.</p>
        <p class="gv-nabidka-pozn">Jednou se stáhne český textový model (~274 MB, po převodu zabere 65 MB) a hledání pak běží v počítači bez internetu.</p>
        <div class="gv-nabidka-akce"><button type="button" class="ph-tlacitko hlavni" data-gv-zapnout-slovy>Zapnout hledání slovy</button><span class="gv-nabidka-stav" aria-live="polite"></span></div>
    </div>`;
}

// Průběh stahování textového modelu; po dokončení načte galerii znovu
async function sledovatStazeniSlov() {
    clearTimeout(casovacSlov);
    const misto = document.querySelector('#bestList .gv-nabidka-slov');
    if (!misto) return;
    const s = await GetStavHledaniSlovy().catch(() => null);
    if (!s || !misto.isConnected) return;
    if (s.pripraveno) return nacistGaleriiZnovu();
    const stav = misto.querySelector('.gv-nabidka-stav');
    const tlacitko = /** @type {HTMLButtonElement | null} */ (misto.querySelector('[data-gv-zapnout-slovy]'));
    if (s.stahuje) {
        const mb = x => Math.round(x / 1048576);
        if (stav) stav.textContent = `Stahuji ${mb(s.stazeno)} / ${mb(s.celkem)} MB…`;
        if (tlacitko) tlacitko.disabled = true;
        casovacSlov = window.setTimeout(sledovatStazeniSlov, 1000);
    } else {
        if (stav) stav.textContent = s.chyba ? `Nepovedlo se: ${s.chyba}` : '';
        if (tlacitko) tlacitko.disabled = false;
    }
}

// Popis uloženého výběru (titulek): kolekce, srdíčka, typy, desetiletí, tagy, řazení
function popisVyberu(x) {
    const d = x.dotaz || {};
    return [x.nazevKolekce && `Kolekce: ${x.nazevKolekce}`, d.srdicka && SRDICKA.find(([k]) => k === d.srdicka)?.[1], ...(d.typy || []),
        ...(d.dekady || []).map(k => `${k.slice(2)}. léta`), ...(d.tagy || []).map(t => nazvyTagu.get(t) || t),
        d.razeni && d.razeni !== 'libi' && RAZENI.find(([k]) => k === d.razeni)?.[1]].filter(Boolean).join(' · ');
}

// Obsluha panelu a stránkování; nacistZnovu = načíst galerii znovu (nejlepsi.js, s textem hledání)
export function pripravitGalerii(nacistZnovu) {
    nacistGaleriiZnovu = nacistZnovu;
    best.addEventListener('submit', (e) => {
        const form = /** @type {HTMLElement} */ (e.target).closest('[data-gv-ulozit-form]');
        if (!form) return;
        e.preventDefault();
        const nazev = /** @type {HTMLInputElement} */ (form.querySelector('input')).value.trim();
        if (!nazev) return;
        UlozitVyberGalerie(nazev, { ...dotaz, modelka: 0, text: '', seminko: 0, od: 0, kolik: 0, kolekce: zvolenaKolekce.klic }).then(() => {
            ukladaniVyberu = false;
            vykreslitPanelKolekci();
        });
    });
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
        if (cil.closest('[data-gv-zapnout-slovy]')) {
            ZapnoutHledaniSlovy().then(() => sledovatStazeniSlov());
            return;
        }
        // Panel kolekcí: otevřít/zavřít, zvolit kolekci, uložené výběry
        if (cil.closest('[data-gv-kolekce-panel]')) {
            const otevrit = !kolekceOtevrene();
            try { localStorage.setItem(KLIC_PANELU_KOLEKCI, otevrit ? '1' : '0'); } catch { /* jen teď */ }
            document.querySelector('#bestList .gv-panel-kolekci')?.classList.toggle('hidden', !otevrit);
            document.querySelector('#bestList [data-gv-kolekce-panel]')?.setAttribute('aria-expanded', String(otevrit));
            if (otevrit) vykreslitPanelKolekci();
            return;
        }
        const k = /** @type {HTMLElement | null} */ (cil.closest('[data-gv-k]'));
        if (k) {
            const x = vsechnyKolekce[parseInt(k.dataset.gvK, 10)];
            if (!x) return;
            if (x.klic !== zvolenaKolekce.klic) zaznamenat(x.klic, 'otevreni');
            zvolenaKolekce = x.klic === zvolenaKolekce.klic ? { klic: '', nazev: '' } : { klic: x.klic, nazev: x.nazev };
            try { localStorage.setItem(KLIC_PANELU_KOLEKCI, '0'); } catch { /* jen teď */ }
            nacistZnovu();
            document.querySelector('main')?.scrollTo({ top: 0 });
            return;
        }
        const vyber = /** @type {HTMLElement | null} */ (cil.closest('[data-gv-vyber]'));
        if (vyber) {
            const x = vybery[parseInt(vyber.dataset.gvVyber, 10)];
            if (!x) return;
            const d = x.dotaz || {};
            dotaz = { ...VYCHOZI_DOTAZ, razeni: d.razeni || 'libi', srdicka: d.srdicka || '', typy: d.typy || [], tagy: d.tagy || [], dekady: d.dekady || [] };
            zvolenaKolekce = { klic: d.kolekce || '', nazev: x.nazevKolekce || '' };
            zaznamenat(zvolenaKolekce.klic, 'otevreni');
            ulozitDotaz();
            try { localStorage.setItem(KLIC_PANELU_KOLEKCI, '0'); } catch { /* jen teď */ }
            nacistZnovu();
            return;
        }
        const smazat = /** @type {HTMLElement | null} */ (cil.closest('[data-gv-smazat-vyber]'));
        if (smazat) {
            const x = vybery[parseInt(smazat.dataset.gvSmazatVyber, 10)];
            if (x) SmazatVyberGalerie(x.nazev).then(vykreslitPanelKolekci);
            return;
        }
        if (cil.closest('[data-gv-ulozit]') || cil.closest('[data-gv-ulozit-zrusit]')) {
            ukladaniVyberu = Boolean(cil.closest('[data-gv-ulozit]'));
            vykreslitPanelKolekci();
            return;
        }
        // Řady kolekcí: Zobrazit vše / Celá kolekce, fotka (prohlížeč s fotkami řady), posun pásu
        const vse = /** @type {HTMLElement | null} */ (cil.closest('[data-gv-kolekce]'));
        if (vse) {
            const r = kolekce[parseInt(vse.dataset.gvKolekce, 10)];
            if (!r) return;
            zaznamenat(r.klic, 'otevreni');
            zvolenaKolekce = { klic: r.klic, nazev: r.nazev };
            nacistZnovu();
            document.querySelector('main')?.scrollTo({ top: 0 });
            return;
        }
        if (cil.closest('[data-gv-bez-kolekce]')) {
            zvolenaKolekce = { klic: '', nazev: '' };
            nacistZnovu();
            return;
        }
        const dl = /** @type {HTMLElement | null} */ (cil.closest('[data-gv-rada]'));
        if (dl) {
            const r = kolekce[parseInt(dl.dataset.gvRada, 10)];
            if (r) {
                zaznamenat(r.klic, 'fotka');
                otevritLightbox(parseInt(dl.dataset.gvFotka, 10), false, r.fotky.map(polozka));
            }
            return;
        }
        const posun = /** @type {HTMLElement | null} */ (cil.closest('[data-gv-posun]'));
        if (posun) {
            const pas = posun.parentElement?.querySelector('.gv-pas-rady');
            pas?.scrollBy({ left: Math.sign(parseInt(posun.dataset.gvPosun, 10)) * pas.clientWidth * 0.85, behavior: 'smooth' });
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
