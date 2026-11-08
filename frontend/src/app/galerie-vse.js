// Galerie všech fotek napříč modelkami (Modelky › Galerie › Všechny fotky; galerie_fotek.go GetGalerieFotek):
// jedna mozaika po stránkách a ovládací panel vpravo (jako panel Údaje v profilu modelky) s řazením a filtry –
// srdíčka fotky, typ alba, desetiletí a tagy, u každé hodnoty počet fotek, které zbudou. Výchozí řazení „Co se ti
// asi líbí“: tvoje srdíčka a u nehodnocených odhad z obsahu fotek, promíchané napříč alby. Dotaz i otevřený panel
// se pamatují. Text hledání v hlavičce omezuje galerii (jméno modelky, album, fotograf).
import { GetGalerieFotek } from './backend';
import { esc, sklonovat } from '../lib/format';
import { stav } from './stav';
import { best } from './prvky';
import { katalogTagu } from './tagy-fotek';
import { nacitatPostupne } from './obrazky';
import { htmlNicNenalezeno } from '../ui/prazdno';

const STRANKA = 300;
const KLIC_DOTAZU = 'galerieDotaz';
const KLIC_PANELU = 'galeriePanel';
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

const panelOtevreny = () => { try { return localStorage.getItem(KLIC_PANELU) !== '0'; } catch { return true; } };
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
    best.classList.toggle('panel-otevreny', panelOtevreny());
    const filtry = pocetFiltru();
    seznam.innerHTML = `
        <div class="best-toolbar">${htmlNastroju}
            <span>${esc(sklonovat(celkem, 'fotka', 'fotky', 'fotek'))}${filtry ? ` · ${sklonovat(filtry, 'filtr', 'filtry', 'filtrů')}` : ''}</span>
            <button type="button" class="btn btn-secondary btn-small" data-gv-panel aria-pressed="${panelOtevreny()}" title="Řazení a filtry galerie">☰ Řazení a filtry</button>
            ${polozky.length ? '<button class="btn btn-secondary btn-small" data-nejlepsi-slideshow>Spustit slideshow</button>' : ''}</div>
        ${polozky.length ? '<div class="nejlepsi-mozaika gv-mozaika"></div><button type="button" class="link nejlepsi-dalsi hidden" data-gv-dalsi></button>'
            : htmlNicNenalezeno(filtry || text ? 'Filtrům ani hledání neodpovídá žádná fotka.' : 'Ve sbírce zatím nejsou fotky.')}
        <aside class="galerie-panel" aria-label="Řazení a filtry galerie"></aside>`;
    pripojit(polozky, 0);
    sledovatKonec();
    vykreslitPanel();
    // V prohlížeči se další stránka dotáhne, než dojde na konec načtené části
    stav.lbDotahnout = null;
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
    best.classList.remove('galerie-vse', 'panel-otevreny');
}

async function vykreslitPanel() {
    const panel = document.querySelector('#bestList .galerie-panel');
    if (!panel) return;
    const katalog = await katalogTagu();
    const nazevTagu = new Map(katalog.flatMap(sk => sk.tagy.map(t => [t.klic, t.nazev])));
    const volba = (skupina, hodnota, nazev, pocet, zapnuto, titulek = '') =>
        `<button type="button" class="gv-volba ${zapnuto ? 'on' : ''}" data-gv="${skupina}" data-hodnota="${esc(hodnota)}" aria-pressed="${zapnuto}"${titulek ? ` title="${esc(titulek)}"` : ''}>${esc(nazev)}${pocet !== undefined ? `<small>${pocet}</small>` : ''}</button>`;
    const typy = Object.entries(fasety.typy || {}).sort((a, b) => b[1] - a[1]);
    const dekady = Object.entries(fasety.dekady || {}).sort((a, b) => a[0].localeCompare(b[0]));
    const tagy = katalog.map(sk => ({ sk, tagy: sk.tagy.filter(t => (fasety.tagy || {})[t.klic] || dotaz.tagy.includes(t.klic)) })).filter(x => x.tagy.length);
    panel.innerHTML = `
        <div class="gv-hlava"><b>Řazení a filtry</b>${pocetFiltru() ? '<button type="button" class="link" data-gv-zrusit>zrušit filtry</button>' : ''}</div>
        <section><h4>Řazení</h4><div class="gv-volby">${RAZENI.map(([k, n, t]) => volba('razeni', k, n, undefined, dotaz.razeni === k, t)).join('')}</div></section>
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
            const otevrit = !panelOtevreny();
            try { localStorage.setItem(KLIC_PANELU, otevrit ? '1' : '0'); } catch { /* jen teď */ }
            best.classList.toggle('panel-otevreny', otevrit);
            cil.closest('[data-gv-panel]')?.setAttribute('aria-pressed', String(otevrit));
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
