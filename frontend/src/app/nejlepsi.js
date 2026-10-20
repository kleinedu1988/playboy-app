// Nejlepší fotky a vlastní výběry
import { GetFotkyVyberu, GetNejlepsiFotky, GetVybery, PrejmenovatVyber, PridatDoVyberu, SmazatVyber, VyberPodleNazvu } from './backend';
import { oznamit } from '../ui/oznameni';
import { bezDiakritiky, esc, nazevAlba, obrazek, poleFotky, rozlozitDotaz, sjednotit, sklonovat, vyhovujeHledani } from '../lib/format';
import { stav } from './stav';
import { vybratKliknutim } from './vyber';
import { best, searchInput } from './prvky';
import { listaNejlepsich } from './listy';
import { historie, prepnoutRezim, ukazatPohled } from './navigace';
import { htmlSrdickaFotky, nacistGalerii } from './galerie';
import { VELIKOST_NAHLEDU, nacitatPostupne } from './obrazky';
import { htmlAkciDlazdice } from './akce-fotky';
import { otevritLightbox } from './prohlizec';
import { potvrdit } from './formular-modelky';
import { vybratHodnotu } from './ulozeni';
import { prevestNaVolby } from '../ui/volby';
import { htmlNicNenalezeno, htmlPrazdna } from '../ui/prazdno';

// Přidání fotek do vlastního výběru (existujícího, nebo nového podle napsaného názvu)
export async function pridatDoVyberu(ids) {
    const vybery = await GetVybery() || [];
    const nazev = await vybratHodnotu({ nadpis: 'Přidat do výběru', text: 'Vyber výběr ze seznamu, nebo napiš název nového. Výběry se prohlížejí v přehledu Nejlepší.', popisek: 'Výběr', moznosti: vybery.map(v => v.nazev), tlacitko: 'Přidat' });
    if (!nazev) return false;
    const id = await VyberPodleNazvu(nazev);
    if (!id) return false;
    const pridano = await PridatDoVyberu(id, ids);
    oznamit(`Do výběru „${nazev}“ přidáno fotek: ${pridano}.` + (pridano < ids.length ? ` Už v něm bylo: ${ids.length - pridano}.` : ''),
        { text: 'Otevřít výběr', akce: () => { stav.nejlepsiVyber = id; prepnoutRezim('nejlepsi'); historie.length = 0; nacistGalerii(''); } });
    return true;
}

export async function nacistNejlepsi(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const [fotky, vybery] = zMezipameti && stav.nejlepsiData ? [stav.nejlepsiData, stav.vyberyData]
        : await Promise.all([(stav.nejlepsiVyber ? GetFotkyVyberu(stav.nejlepsiVyber) : GetNejlepsiFotky(stav.nejlepsiMin)).then(f => f || []), GetVybery().then(v => v || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.nejlepsiData = fotky;
    stav.vyberyData = vybery;
    const vyber = vybery.find(v => v.id === stav.nejlepsiVyber);
    if (stav.nejlepsiVyber && !vyber) stav.nejlepsiVyber = 0;
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(best);

    const tokeny = rozlozitDotaz(dotaz);
    const vyhovuje = f => vyhovujeHledani([
        f.jmenoModelky,
        f.album,
        nazevAlba(f.album, f.typ),
        f.fotograf || '',
        f.popis || '',
    ], tokeny, poleFotky(f));
    stav.nejlepsiPolozky = fotky.filter(vyhovuje).map(f => ({
        fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni,
    })).sort((x, y) => y.hodnoceni - x.hodnoceni);

    // Úrovně srdíček (od nejvyšší): každá je oddíl mozaiky se značkou části pro lištu nahoře
    const urovne = new Map();
    stav.nejlepsiPolozky.forEach(p => urovne.set(p.hodnoceni, (urovne.get(p.hodnoceni) || 0) + 1));

    const prah = [3, 4, 5].map(n => `<button class="chip ${!stav.nejlepsiVyber && n === stav.nejlepsiMin ? 'active' : ''}" data-nejlepsi-min="${n}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('')
        + vybery.map(v => `<button class="chip ${v.id === stav.nejlepsiVyber ? 'active' : ''}" data-vyber-id="${v.id}" title="Vlastní výběr">${esc(v.nazev)}<span>${v.pocet}</span></button>`).join('')
        + (vyber ? '<button class="link" data-vyber-akce="prejmenovat">přejmenovat</button><button class="link" data-vyber-akce="smazat">smazat výběr</button>' : '');
    document.getElementById('bestList').innerHTML = `
        <div class="best-toolbar">${prah}<span>${sklonovat(stav.nejlepsiPolozky.length, 'fotka', 'fotky', 'fotek')}</span>
            ${stav.nejlepsiPolozky.length ? '<button class="btn btn-secondary btn-small" data-nejlepsi-slideshow>Spustit slideshow</button>' : ''}</div>
        ${stav.nejlepsiPolozky.length ? [...urovne.keys()].map(h => `
            <section class="nejlepsi-uroven" data-uroven="${h}" data-cast="srdicka-${h}">
                <div class="nejlepsi-mozaika"></div>
                <button type="button" class="link nejlepsi-dalsi hidden" data-nejlepsi-dalsi="${h}"></button>
            </section>`).join('')
            : fotky.length || tokeny.length ? htmlNicNenalezeno('Hledání neodpovídá žádná fotka.')
            : vyber ? htmlPrazdna('Výběr je prázdný', 'Fotky se do něj přidávají odkudkoli: tlačítkem ⋯ na fotce, v prohlížeči nebo u vybraných fotek „Přidat do výběru…“.', { ikona: 'hvezda' })
            : htmlPrazdna(`Zatím žádné fotky s ♥ ${stav.nejlepsiMin}${stav.nejlepsiMin < 5 ? '+' : ''}`, 'Fotky se hodnotí srdíčky na dlaždici nebo v prohlížeči klávesami 1–5.', { ikona: 'srdce' })}
    `;
    prevestNaVolby(document.querySelector('#bestList .best-toolbar'));
    // Mozaika se vykresluje po dávkách; po překreslení téhož přehledu (srdíčko, odebrání) zůstane v každé úrovni
    // vykresleno aspoň tolik jako předtím, aby stránka neuskočila
    const klic = [stav.nejlepsiVyber, stav.nejlepsiMin, dotaz].join('|');
    const predtim = klic === klicVykresleni ? urovneVykresleni : new Map();
    klicVykresleni = klic;
    urovneVykresleni = new Map();
    let od = 0;
    urovne.forEach((pocet, h) => { urovneVykresleni.set(h, { od, pocet, vykresleno: 0 }); od += pocet; });
    sledovatKonce();
    urovneVykresleni.forEach((u, h, mapa) => {
        const prvni = h === mapa.keys().next().value;
        vykreslitUroven(h, Math.max(predtim.get(h)?.vykresleno || 0, prvni ? DAVKA : 0));
    });
    listaNejlepsich.naplnit([...urovne].map(([h, pocet]) => ({ klic: `srdicka-${h}`, nazev: h ? '♥'.repeat(h) : 'bez srdíček', pocet })));
    listaNejlepsich.sledovat();
}

// Poměr stran fotek (podle id) z minulého vykreslení: mozaika pak při překreslení neposkakuje
const pomeryFotek = new Map();

// Mozaika s desítkami tisíc fotek by se vykreslovala desítky sekund a zahltila stránku. Každá úroveň srdíček
// se proto vykresluje po dávkách: další dávka se přidá, když se konec úrovně blíží k oknu odspodu (asi tři
// obrazovky předem). Konec úrovně nad oknem (po skoku v liště a rolování nahoru) se sám nedoplňuje, obsah by
// pod ním poskočil; ukazuje tlačítko „Zobrazit další“. Skok na úroveň v liště vykreslí její první dávku.
const DAVKA = 300;
let urovneVykresleni = new Map();
let klicVykresleni = '';
let pozorovatelKoncu = null;
// Během plynulého skoku v liště se konce úrovní, kolem kterých stránka jede, nedoplňují (cíl by utíkal dolů)
let pozastavitDo = 0;

function vykreslitUroven(h, pocet) {
    const u = urovneVykresleni.get(h);
    const oddil = document.querySelector(`#bestList .nejlepsi-uroven[data-uroven="${h}"]`);
    if (!u || !oddil) return;
    const cil = Math.min(pocet, u.pocet);
    if (cil > u.vykresleno) {
        oddil.querySelector('.nejlepsi-mozaika').insertAdjacentHTML('beforeend', stav.nejlepsiPolozky.slice(u.od + u.vykresleno, u.od + cil)
            .map((p, i) => htmlDlazdiceMozaiky(p, u.od + u.vykresleno + i)).join(''));
        u.vykresleno = cil;
        pripravitMozaiku();
        nacitatPostupne(document.getElementById('bestList'));
    }
    const dalsi = oddil.querySelector('.nejlepsi-dalsi');
    const zbyva = u.pocet - u.vykresleno;
    dalsi.classList.toggle('hidden', zbyva <= 0);
    dalsi.textContent = `Zobrazit další fotky (${zbyva})`;
    // Konec úrovně se hlídá znovu: když je po dávce pořád blízko okna, přijde hned další
    if (zbyva > 0 && pozorovatelKoncu) {
        pozorovatelKoncu.unobserve(dalsi);
        pozorovatelKoncu.observe(dalsi);
    }
}

function sledovatKonce() {
    pozorovatelKoncu?.disconnect();
    const hlavni = document.querySelector('main');
    pozorovatelKoncu = new IntersectionObserver(zaznamy => zaznamy.forEach(z => {
        const okno = hlavni.getBoundingClientRect();
        // Jen konec pod horní polovinou okna (blíží se odspodu); konec nad oknem čeká na tlačítko
        if (performance.now() < pozastavitDo) return;
        if (z.isIntersecting && z.boundingClientRect.top > okno.top + okno.height / 2) {
            const h = parseInt(/** @type {HTMLElement} */ (z.target).dataset.nejlepsiDalsi);
            vykreslitUroven(h, urovneVykresleni.get(h).vykresleno + DAVKA);
        }
    }), { root: hlavni, rootMargin: '0px 0px 2700px 0px' });
}

// Lišta úrovní srdíček: úroveň bez vykreslených fotek dostane před skokem první dávku
listaNejlepsich.dovykreslit = (klic) => {
    const h = parseInt(String(klic).replace('srdicka-', ''));
    const u = urovneVykresleni.get(h);
    if (u && u.vykresleno < DAVKA) vykreslitUroven(h, DAVKA);
    pozastavitDo = performance.now() + 1500;
    // Po doběhnutí skoku se konce úrovní posoudí znovu (ten pod oknem se doplní, ten nad ním ne)
    setTimeout(() => document.querySelectorAll('#bestList .nejlepsi-dalsi:not(.hidden)').forEach(b => {
        pozorovatelKoncu?.unobserve(b);
        pozorovatelKoncu?.observe(b);
    }), 1600);
};

// Dlaždice mozaiky: řady stejné výšky, šířka podle poměru stran fotky; srdíčka v rohu, jméno a původ po najetí
function htmlDlazdiceMozaiky(p, index) {
    const f = p.fotky[0];
    const album = nazevAlba(p.album, p.typ);
    const odkud = album.includes(p.typ) ? album : [p.typ, album].filter(Boolean).join(' · ');
    return `
        <div class="photo-item" data-index="${index}" data-foto-id="${f.id}" tabindex="0"
            style="--pomer: ${pomeryFotek.get(f.id) || 0.75}">
            <img data-src="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" decoding="async" draggable="false" />
            ${htmlSrdickaFotky(p, index)}
            <div class="nejlepsi-popis">
                ${p.modelkaId ? `<button class="link" data-modelka="${p.modelkaId}" title="Otevřít profil">${esc(p.jmenoModelky)}</button>` : ''}
                <small>${esc(odkud)}</small>
            </div>
            ${htmlAkciDlazdice()}
        </div>`;
}

function pripravitMozaiku() {
    document.querySelectorAll('#bestList .nejlepsi-mozaika .photo-item:not([data-pripraveno])').forEach(dlazdice => {
        dlazdice.dataset.pripraveno = '1';
        const img = dlazdice.querySelector('img');
        const nastavit = () => {
            if (!img.naturalWidth) return;
            const pomer = img.naturalWidth / img.naturalHeight;
            pomeryFotek.set(parseInt(dlazdice.dataset.fotoId), pomer);
            dlazdice.style.setProperty('--pomer', String(pomer));
        };
        // Obrázek bez adresy (postupné načítání ho ještě nenačetlo) je „complete“, ale bez rozměrů
        if (img.complete && img.naturalWidth) nastavit();
        else img.addEventListener('load', nastavit, { once: true });
    });
}

export async function upravitVyber(akce) {
    const vyber = stav.vyberyData.find(v => v.id === stav.nejlepsiVyber);
    if (!vyber) return;
    if (akce === 'prejmenovat') {
        const nazev = await vybratHodnotu({ nadpis: 'Přejmenovat výběr', popisek: 'Název', tlacitko: 'Přejmenovat', vychozi: vyber.nazev });
        if (nazev && !await PrejmenovatVyber(vyber.id, nazev)) oznamit('Výběr s tímto názvem už existuje.');
    } else if (await potvrdit('Smazat výběr', `Smazat výběr „${vyber.nazev}“? Fotky ve sbírce zůstanou, zmizí jen tento výběr.`, 'Smazat', { nebezpecne: true })) {
        await SmazatVyber(vyber.id);
        stav.nejlepsiVyber = 0;
    }
    nacistNejlepsi(searchInput.value);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.nejlepsiMin = parseInt(localStorage.getItem('nejlepsiMin')) || 4; } catch { /* výchozí 4 */ }

    best.addEventListener('click', (e) => {
        const dalsi = e.target.closest('[data-nejlepsi-dalsi]');
        if (dalsi) {
            const h = parseInt(dalsi.dataset.nejlepsiDalsi);
            vykreslitUroven(h, urovneVykresleni.get(h).vykresleno + DAVKA);
            return;
        }
        const vyberChip = e.target.closest('[data-vyber-id]');
        if (vyberChip) {
            const id = parseInt(vyberChip.dataset.vyberId);
            stav.nejlepsiVyber = id === stav.nejlepsiVyber ? 0 : id;
            nacistNejlepsi(searchInput.value);
            return;
        }
        const akceVyberu = e.target.closest('[data-vyber-akce]')?.dataset.vyberAkce;
        if (akceVyberu) {
            upravitVyber(akceVyberu);
            return;
        }
        const prah = e.target.closest('[data-nejlepsi-min]');
        if (prah) {
            stav.nejlepsiVyber = 0;
            stav.nejlepsiMin = parseInt(prah.dataset.nejlepsiMin);
            try { localStorage.setItem('nejlepsiMin', String(stav.nejlepsiMin)); } catch { /* jen se nezapamatuje */ }
            nacistNejlepsi(searchInput.value);
            return;
        }
        if (e.target.closest('[data-nejlepsi-slideshow]')) {
            otevritLightbox(0, true, stav.nejlepsiPolozky);
            return;
        }
        if (vybratKliknutim(e) || e.target.closest('.hearts, [data-modelka]')) return;
        const dlazdice = e.target.closest('[data-index]');
        if (dlazdice) otevritLightbox(parseInt(dlazdice.dataset.index), false, stav.nejlepsiPolozky);
    });
}
