// Galerie modelek, srdíčka, filtr hodnocení a krokování mezi modelkami
import { GetDuvodOdhadu, GetModelky, SetHodnoceni, SetHodnoceniFotek } from './backend';
import { contextMenu, otevritKontextovouNabidku } from '../ui/nabidka';
import { bezDiakritiky, esc, RAZENI_GALERIE, castGalerie, seraditModelky, sklonovat } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { poZmeneDat } from './udalosti';
import { stav } from './stav';
import { otevritRychlePridani } from './formular-modelky';
import { importovatData, otevritHeslo } from './sprava';
import { otevritNapovedu } from './napoveda';
import { detailView, gallery, searchInput } from './prvky';
import { listaGalerie } from './listy';
import { adresaTitulni, nacitatPostupne, sledovatDalsi } from './obrazky';
import { nastavitViditelnostHledani, prepnoutRezim, stylVyrezu, ukazatPohled, zapamatovatMisto } from './navigace';
import { otevritDetailModelky } from './profil';
import { nacistCovery, nacistStenu } from './stena';
import { otevritVydani } from './vydani';
import { dotazFiltru, obnovitPripnutyPanel, otevritPanelFiltru, stitkyFiltru } from './filtr-modelek';
import { naplnitHero, zapomenoutTipy } from './profily-hero';
import { nacistKalendar } from './kalendar';
import { nacistPrehled } from './prehled';
import { nacistNejlepsi } from './nejlepsi';
import { otevritStatistiky } from './statistiky-pohled';
import { lightbox } from './prohlizec';
import { trendModelky, urovenModelky } from '../lib/oblibenost';
import { vybraneDlazdice } from './vyber';
import { obnovitVolby } from '../ui/volby';
import { htmlNicNenalezeno, htmlPrazdna } from '../ui/prazdno';
import { htmlSrdicekModelky, klavesaSrdicekModelky, obnovitSrdickaModelky } from '../ui/srdicka';
import { hodnotaPoKliku, kratceSrdicka, ukazatOdhad } from '../lib/srdicka';
import { otevreneOkno } from '../ui/dom';

// Hodnocení fotky 1–5 srdíček; klik na N-té nastaví N, klik na současné hodnocení ho zruší.
// Na dlaždici (tabem = false) srdíčka nejsou v pořadí Tabu: zaměřená dlaždice se hodnotí klávesami 1–5
// a 0 (klavesnice.js), jinak by každá dlaždice přidala pět zastávek. Modelky mají srdíčka po půlkách (ui/srdicka.js).
export function htmlSrdicek(hodnoceni, atribut, tabem = true) {
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="heart ${n <= hodnoceni ? 'on' : ''}" data-hodnota="${n}" ${tabem ? '' : 'tabindex="-1"'}
            title="${n === hodnoceni ? 'Zrušit hodnocení' : `Ohodnotit ${n} z 5`}"></button>`).join('');
    return `<span class="hearts ${hodnoceni ? 'rated' : ''}" ${atribut}>${srdicka}</span>`;
}

// Srdíčka modelky po půlkách; na kartě (tabem = false) bez zastávky Tabu, hodnotí zaměřená karta klávesami
export function htmlSrdicka(modelka, tabem = true) {
    return htmlSrdicekModelky(modelka.hodnoceni, `data-hodnoceni="${modelka.id}"`, { tabem, popis: `Hodnocení – ${esc(modelka.jmeno)}` });
}

// Důvody odhadů (id modelky → věta) z posledního načtení Oblíbenosti nebo z prvního najetí na štítek, aby je
// štítek odhadu ukázal v nápovědě; změna dat je zahodí (model vkusu se přeučí)
export const duvodyOdhadu = new Map();
poZmeneDat(() => { duvodyOdhadu.clear(); zapomenoutTipy(); });

const nadpisOdhadu = duvod => `Odhad podle tvého vkusu, zatím nehodnoceno${duvod ? ` – ${duvod}` : ''}`;

// Tlumený štítek „odhad 3½“ u nehodnocené modelky: odhad modelu vkusu, ne skutečné hodnocení
// Šipka trendu oblíbenosti na kartě: jen výrazný posun (aspoň 3 místa)
export function htmlTrendu(modelka) {
    const t = trendModelky(modelka, 3);
    return t ? `<span class="trend trend-karta ${t.smer}" title="${esc(`Oblíbenost: ${t.text}`)}">${t.znak}</span>` : '';
}

// Odznak Top 10 na kartě: jen potvrzená top 10 (nejvýš deset karet v celé galerii, takže nepřeplácá); nižší úrovně
// a čekání ukazuje profil a Oblíbenost
export function htmlTopu(modelka) {
    if (urovenModelky(modelka).uroven !== 10) return '';
    return `<span class="top-karta" title="${esc(`Top 10 v oblíbenosti${modelka.poradi > 0 ? ` · ${modelka.poradi}. místo` : ''}`)}">Top 10</span>`;
}

export function htmlOdhadu(modelka, tridy = '') {
    if (!ukazatOdhad(modelka)) return '';
    return `<span class="odhad-chip ${tridy}" data-odhad="${modelka.id}" title="${esc(nadpisOdhadu(duvodyOdhadu.get(modelka.id)))}">odhad ${kratceSrdicka(modelka.odhadHodnoceni)}</span>`;
}

// Štítek odhadu bez známého důvodu si ho při najetí myší načte (nápověda se ukáže až po chvíli, do té doby je tu)
document.addEventListener('mouseover', async e => {
    const stitek = e.target instanceof Element ? e.target.closest('.odhad-chip[data-odhad]') : null;
    if (!(stitek instanceof HTMLElement) || stitek.dataset.duvodNacitan) return;
    const id = parseInt(stitek.dataset.odhad || '');
    if (!duvodyOdhadu.has(id)) {
        stitek.dataset.duvodNacitan = '1';
        const duvod = await GetDuvodOdhadu(id).catch(() => '');
        delete stitek.dataset.duvodNacitan;
        if (duvod) duvodyOdhadu.set(id, duvod);
    }
    const duvod = duvodyOdhadu.get(id);
    if (duvod && !stitek.closest('.ob-tip')) stitek.title = nadpisOdhadu(duvod);
});

// Srdíčka fotky; index míří do seznamu položek právě zobrazeného pohledu
export function htmlSrdickaFotky(polozka, index) {
    return htmlSrdicek(polozka.hodnoceni, `data-hodnoceni-fotky="${index}"`, false);
}

export async function ohodnotitPolozku(polozka, zvoleno) {
    const nove = zvoleno === polozka.hodnoceni ? 0 : zvoleno;
    const pred = polozka.fotky.map(f => Number(f.hodnoceni) || 0);
    let ok = false;
    try { ok = await SetHodnoceniFotek(polozka.fotky.map(f => f.id), nove); } catch { /* false */ }
    if (!ok) return false;
    polozka.hodnoceni = nove;
    polozka.fotky.forEach(f => { f.hodnoceni = nove; });
    oznamitHodnoceniFotek(pred, polozka.fotky.length, nove);
    return true;
}

// Změna srdíček fotek kdekoli (prohlížeč, pásy Porovnat): počet nehodnocených v Hodnocení se upraví hned
// (galerie-hodnoceni.js). pred = hodnocení fotek před změnou, nove = nové hodnocení všech
export function oznamitHodnoceniFotek(pred, pocet, nove) {
    const ubylo = pred.filter(h => !h).length - (nove ? 0 : pocet);
    if (ubylo) document.dispatchEvent(new CustomEvent('hodnoceni-fotek', { detail: { ubylo } }));
}

const HTML_UVODU = `
    <section class="uvod">
        <h2>Vítej v Playboy Database</h2>
        <p>Katalog sbírky: modelky, alba fotek, centerfoldy, covery a čísla časopisu. Fotky zůstávají na Google
            Disku, program si pamatuje jen odkazy a údaje.</p>
        <ol>
            <li><strong>Sdílej fotky na Disku</strong> jako „kdokoli s odkazem“ (u složky stačí jednou) – jinak je program neuvidí.</li>
            <li><strong>Přidej první modelku</strong> a k ní album: vložíš odkazy na fotky z Disku, klidně víc naráz.</li>
            <li>Nebo <strong>načti hotová data</strong> ze souborů YAML či Markdown (export z programu nebo vlastní poznámky).</li>
            <li>Volitelně <strong>nastav heslo</strong>, aby se sbírka ukázala až po odemčení.</li>
        </ol>
        <div class="uvod-akce">
            <button class="btn btn-primary" data-uvod="modelka">Přidat modelku</button>
            <button class="btn btn-secondary" data-uvod="import">Importovat soubory…</button>
            <button class="btn btn-secondary" data-uvod="heslo">Nastavit heslo…</button>
            <button class="btn btn-secondary" data-uvod="napoveda">Nápověda (?)</button>
        </div>
        <p class="uvod-pozn">Data jsou v ~/.local/share/playboy-app; zálohy vznikají samy denně a před každou hromadnou změnou.</p>
    </section>`;

// Široká lišta ovládání pod hero bannerem (místo úzké kapsle vpravo nahoře): řazení, Filtry (panel filtru Modelek,
// app/filtr-modelek.js) a zapnuté filtry jako štítky s křížkem, vpravo počet
function htmlNastroju(pocet, celkem) {
    const razeni = Object.entries(RAZENI_GALERIE).map(([klic, r]) => `
        <button class="chip ${klic === stav.razeniGalerie ? 'active' : ''}" data-razeni-galerie="${klic}" title="Řadit ${r.nazev}">${r.popisek}</button>`).join('');
    const stitky = stitkyFiltru().map((s, i) => `<span class="pl-stitek"><button type="button" data-pl-upravit="${i}" title="Upravit filtr">${esc(s.text)}</button><button type="button" data-pl-zrusit="${i}" aria-label="Zrušit filtr" title="Zrušit filtr">×</button></span>`).join('');
    return `<div class="gallery-toolbar profily-lista"><div class="pl-razeni" role="group" aria-label="Řazení">${razeni}</div>
        <button type="button" class="pl-filtry ${stitky ? 'zapnuto' : ''}" data-pl-filtry aria-haspopup="dialog">☰ Filtry${stitky ? ` <small>${stitkyFiltru().length}</small>` : ''}</button>
        ${stitky}
        <span class="pl-pocet">${pocet < celkem ? `${pocet} z ${sklonovat(celkem, 'modelky', 'modelek', 'modelek')}` : sklonovat(pocet, 'modelka', 'modelky', 'modelek')}</span></div>`;
}

// Předchozí a další modelka v pořadí, v jakém jsou v galerii
// Šipky ‹ › v profilu listují seznamem, ze kterého se profil otevřel (stav.seznamProfilu)
export async function krokModelky(smer) {
    const seznam = stav.seznamProfilu;
    if (!stav.aktualniModelka || !seznam) return;
    const index = seznam.indexOf(stav.aktualniModelka.id);
    if (index < 0 || seznam.length < 2) return;
    const id = seznam[(index + smer + seznam.length) % seznam.length];
    const modelka = (await vsechnyModelky()).find(m => m.id === id);
    // Listování mezi modelkami historii neplní, Zpět vede tam, odkud se do profilů přišlo
    if (modelka) otevritDetailModelky(modelka, { bezHistorie: true });
}

// Klik na údaj v profilu vyhledá všechny modelky se stejnou hodnotou
export function hledatHodnotu(hodnota) {
    zapamatovatMisto({});
    prepnoutRezim('modelky');
    nastavitViditelnostHledani(true);
    searchInput.value = hodnota;
    nacistGalerii(hodnota);
}

// Lišta písmen má smysl až u větší sbírky
const MODELEK_PRO_PISMENA = 20;

// Modelky právě vykreslených karet podle id (klik na kartu otevře profil)
let modelkyKaret = new Map();
let posledniDotazModelky = null;
let posledniVsechnyModelky = null;

poZmeneDat(() => {
    posledniDotazModelky = null;
    posledniVsechnyModelky = null;
});

// Dotaz Modelek pro backend: příkazy filtru z panelu Filtry (app/filtr-modelek.js) a text hledání
const dotazModelek = hledani => [dotazFiltru(), hledani].filter(s => s && s.trim()).join(' ');

// Načtení Hlavní Galerie
// zMezipameti = jen přefiltrovat data načtená minule (psaní do hledání, změna filtru či řazení), nenačítat je znovu z databáze
// Dokreslování galerie po dávkách (karty za prvními KARET_HNED): stav rozpracovaného vykreslení
const KARET_HNED = 200;
const KARET_V_DAVCE = 400;
/** @type {{ moje: number, modelky: any[], od: number, html: (m: any) => string } | null} */
let dokresleni = null;

function pridatDavku(vse = false) {
    const d = dokresleni;
    if (!d || d.moje !== stav.cisloNacteni) {
        dokresleni = null;
        return;
    }
    const do_ = vse ? d.modelky.length : Math.min(d.modelky.length, d.od + KARET_V_DAVCE);
    gallery.insertAdjacentHTML('beforeend', d.modelky.slice(d.od, do_).map(d.html).join(''));
    d.od = do_;
    sledovatDalsi(gallery);
    if (d.od >= d.modelky.length) dokresleni = null;
}

function naplanovatDavku() {
    if (!dokresleni) return;
    setTimeout(() => {
        pridatDavku();
        naplanovatDavku();
    }, 0);
}

// Galerie celá hned (skok v liště písmen, návrat Zpět na místo dole na stránce, fokus na kartě)
export function dokreslitGalerii() {
    if (dokresleni) pridatDavku(true);
}
// Skok v liště písmen na část, která ještě není vykreslená
listaGalerie.dovykreslit = () => dokreslitGalerii();

export async function nacistGalerii(hledani = '', zMezipameti = false) {
    const dotaz = stav.rezim === 'modelky' ? dotazModelek(hledani) : hledani;
    if (stav.rezim === 'centerfoldy') return nacistStenu(dotaz, zMezipameti);
    if (stav.rezim === 'covery') return nacistCovery(dotaz, zMezipameti);
    if (stav.rezim === 'kalendar') return nacistKalendar(dotaz, zMezipameti);
    if (stav.rezim === 'prehled') return nacistPrehled();
    if (stav.rezim === 'nejlepsi') return nacistNejlepsi(dotaz, zMezipameti);
    if (stav.rezim === 'statistiky') return otevritStatistiky();

    const moje = ++stav.cisloNacteni;
    const cistyDotaz = dotaz.trim();
    const katalog = await vsechnyModelky();
    let vsechny;
    if (!cistyDotaz) {
        vsechny = katalog;
    } else if (zMezipameti && posledniVsechnyModelky && posledniDotazModelky === dotaz) {
        vsechny = posledniVsechnyModelky;
    } else {
        vsechny = await GetModelky(dotaz).then(m => m || []);
        posledniDotazModelky = dotaz;
        posledniVsechnyModelky = vsechny;
    }
    if (moje !== stav.cisloNacteni) return;

    // Zvolené řazení (stabilní: při shodě zůstává pořadí podle jména z backendu)
    const modelky = seraditModelky(vsechny, stav.razeniGalerie);
    stav.nacteneModelky = modelky;
    modelkyKaret = new Map(modelky.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu?.();
    ukazatPohled(gallery);

    // Prázdná sbírka: úvod s prvními kroky místo prázdné galerie
    if (katalog.length === 0 && vsechny.length === 0 && !cistyDotaz) {
        listaGalerie.naplnit([]);
        gallery.innerHTML = HTML_UVODU;
        return;
    }
    if (modelky.length === 0) {
        listaGalerie.naplnit([]);
        gallery.innerHTML = htmlNastroju(0, katalog.length) + (
            cistyDotaz ? htmlNicNenalezeno('Hledání ani filtrům neodpovídá žádná modelka.')
            : htmlPrazdna('Zatím žádné modelky', 'Sbírka začíná první modelkou. Přidej ji a pak k ní vlož fotky z Google Disku.', { tlacitko: { text: 'Přidat modelku', akce: 'pridat-modelku' } }));
        obnovitVolby(gallery);
        return;
    }

    // Lišta částí: písmena, měsíce přidání, desetiletí, úrovně srdíček nebo pásma počtu fotek;
    // značku části (data-cast) dostane první karta každé části rovnou v šabloně
    const maRejstrik = modelky.length >= MODELEK_PRO_PISMENA;
    const casti = new Map();
    // Karta jen s tím podstatným: fotka, jméno, srdíčka (u nehodnocené odhad); pořadí a trendy jsou v Hodnocení
    const htmlKarty = (m) => {
        const atributCasti = '';
        const styl = stylVyrezu(m);
        return `
        <div class="card" data-id="${m.id}"${atributCasti} tabindex="0" aria-label="${esc(m.jmeno)}">
            <div class="card-image-wrap">
                <img data-src="${esc(adresaTitulni(m))}" alt=""${styl ? ` style="${styl}"` : ''} draggable="false" decoding="async" />
                ${htmlSrdicka(m, false)}
                ${htmlOdhadu(m)}
            </div>
            <div class="card-info">
                <h3 title="${esc(m.jmeno)}"><span class="jmeno-karta">${esc(m.jmeno)}</span></h3>
            </div>
        </div>
    `;
    };
    // Části lišty se spočítají předem (lišta ukazuje všechna písmena hned, i když karty ještě přibývají)
    if (maRejstrik) modelky.forEach((m) => { const c = castGalerie(m, stav.razeniGalerie); casti.set(c, (casti.get(c) || 0) + 1); });
    const prvni = new Set();
    const htmlKartyCasti = (m) => {
        if (!maRejstrik) return htmlKarty(m);
        const c = castGalerie(m, stav.razeniGalerie);
        const zacatek = !prvni.has(c);
        prvni.add(c);
        return htmlKarty(m).replace('<div class="card" data-id=', zacatek ? `<div class="card" data-cast="${esc(c)}" data-id=` : '<div class="card" data-id=');
    };
    // Po dávkách: prvních KARET_HNED karet hned (okno je zaplněné), zbytek se přidá v dávkách na pozadí – tisíce
    // karet najednou blokovaly okno stovky milisekund (start, řazení, hledání, návrat z jiné sekce)
    // Hero banner s doporučenou modelkou nad lištou (app/profily-hero.js); při hledání ne – výsledky hned nahoře
    const hero = !cistyDotaz && !hledani.trim() ? '<section class="profily-hero" aria-label="Doporučená modelka"></section>' : '';
    gallery.innerHTML = hero + htmlNastroju(modelky.length, katalog.length) + modelky.slice(0, KARET_HNED).map(htmlKartyCasti).join('');
    dokresleni = { moje, modelky, od: KARET_HNED, html: htmlKartyCasti };
    naplanovatDavku();
    obnovitVolby(gallery);
    if (hero) naplnitHero(gallery.querySelector('.profily-hero'));
    nacitatPostupne(gallery);

    if (maRejstrik) {
        listaGalerie.naplnit([...casti].map(([c, pocet]) => ({ klic: c, nazev: c, pocet })));
        listaGalerie.sledovat();
    } else {
        listaGalerie.naplnit([]);
    }
    // Připnutý panel filtrů vedle karet (app/filtr-modelek.js)
    obnovitPripnutyPanel();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Tlačítka úvodu prázdné sbírky
    // Lišta ovládání Profilů: Filtry (panel pod tlačítkem) a štítky zapnutých filtrů
    gallery.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const filtry = /** @type {HTMLElement | null} */ (cil.closest('[data-pl-filtry]'));
        if (filtry) {
            e.stopPropagation();
            otevritPanelFiltru(filtry);
            return;
        }
        const zrusit = /** @type {HTMLElement | null} */ (cil.closest('[data-pl-zrusit]'));
        if (zrusit) return stitkyFiltru()[parseInt(zrusit.dataset.plZrusit, 10)]?.zrusit();
        const upravit = /** @type {HTMLElement | null} */ (cil.closest('[data-pl-upravit]'));
        if (upravit) {
            e.stopPropagation();
            stitkyFiltru()[parseInt(upravit.dataset.plUpravit, 10)]?.upravit();
        }
    });
    gallery.addEventListener('click', (e) => {
        const akce = e.target.closest('[data-uvod]')?.dataset.uvod;
        if (akce === 'modelka') otevritRychlePridani();
        else if (akce === 'import') importovatData();
        else if (akce === 'heslo') otevritHeslo();
        else if (akce === 'napoveda') otevritNapovedu();

        // Řádek voleb nad kartami
        const razeni = e.target.closest('[data-razeni-galerie]')?.dataset.razeniGalerie;
        if (razeni) {
            stav.razeniGalerie = razeni;
            try { localStorage.setItem('razeniGalerie', razeni); } catch { /* jen pro toto spuštění */ }
            nacistGalerii(searchInput.value, true);
        }
    });

    // Změna filtru v panelu Filtry (app/filtr-modelek.js): galerie se načte znovu
    document.addEventListener('filtr-modelek', () => {
        clearTimeout(stav.casovacHledani);
        if (stav.rezim === 'modelky') nacistGalerii(searchInput.value);
    });


    // Klik na kartu otevře profil modelky (jedna obsluha pro všechny karty, ne posluchač na každé z tisíců karet)
    gallery.addEventListener('click', (e) => {
        const karta = e.target.closest('.card');
        if (!karta || karta.classList.contains('editing') || e.target.closest('.hearts')) return;
        const modelka = modelkyKaret.get(parseInt(karta.dataset.id));
        if (modelka) otevritDetailModelky(modelka);
    });

    // Nová řada srdíček místo staré; fokus zůstane na srdíčku se stejnou hodnotou (ovládání klávesnicí)
    const nahraditSrdicka = (rada, html, hodnota) => {
        const rodic = rada.parentElement;
        const meloFokus = rada.contains(document.activeElement);
        rada.outerHTML = html;
        if (meloFokus) rodic.querySelector(`.hearts .heart[data-hodnota="${hodnota}"]`)?.focus({ preventScroll: true });
    };

    // Srdíčka na dlaždici fotky v profilu a na stránce vydání
    document.querySelector('main').addEventListener('click', async (e) => {
        const srdicko = e.target.closest('[data-hodnoceni-fotky] .heart');
        if (!srdicko) return;
        const rada = srdicko.closest('.hearts');
        const seznam = rada.closest('#best') ? stav.nejlepsiPolozky : rada.closest('#issueView') ? stav.vydaniPolozky : stav.aktualniPolozky;
        const polozka = seznam[parseInt(rada.dataset.hodnoceniFotky)];
        if (!polozka || !await ohodnotitPolozku(polozka, parseInt(srdicko.dataset.hodnota))) return;

        // Mění se jen srdíčka: překreslení by fotku přeřadilo pod rukama a stránka by odskočila.
        // Podle nového hodnocení se album seřadí při příštím otevření.
        nahraditSrdicka(rada, htmlSrdickaFotky(polozka, parseInt(rada.dataset.hodnoceniFotky)), srdicko.dataset.hodnota);
    });

    // Srdíčka modelky (po půlkách) na kartě, v profilu a v Oblíbenosti. Na celém dokumentu: srdíčka v záhlaví
    // profilu jsou v hlavičce okna (pruh profilu je přesunutý do .hlavni-lista), mimo <main>
    document.addEventListener('click', async (e) => {
        const srdicko = e.target.closest('.hearts-pul[data-hodnoceni] .pulka');
        if (!srdicko) return;
        const rada = srdicko.closest('.hearts');
        const id = parseInt(rada.dataset.hodnoceni);
        const nactene = [stav.aktualniModelka, modelkyKaret.get(id), stav.prehledModelky.get(id)].filter(m => m && m.id === id);
        if (!nactene.length) return;

        const nove = hodnotaPoKliku(nactene[0].hodnoceni, srdicko.dataset.hodnota);
        if (!await SetHodnoceni(id, nove)) return;

        // Tatáž modelka může být v galerii, v profilu i v Oblíbenosti: srdíčka se přepíšou na místě (fokus
        // zůstane, takže funguje i dvojstisk 1–5 pro půlsrdíčko), odhad u ohodnocené zmizí. Galerie se překreslí
        // jen tehdy, když modelka přestala splňovat zapnutý filtr srdíček.
        nactene.forEach(m => { m.hodnoceni = nove; });
        document.querySelectorAll(`.hearts-pul[data-hodnoceni="${id}"]`).forEach(r => obnovitSrdickaModelky(r, nove));
        document.querySelectorAll(`.odhad-chip[data-odhad="${id}"]`).forEach(c => c.classList.toggle('hidden', nove > 0));
        document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id, hodnoceni: nove } }));
        // Filtr srdíček v dotazu: modelka mohla filtru přestat (nebo začít) vyhovovat
        if (!gallery.classList.contains('hidden') && /(^|\s)[-!]?(hodnoceni|srdicka):/.test(dotazModelek(searchInput.value))) {
            await nacistGalerii(searchInput.value);
        }
    });

    // Zaměřená srdíčka v profilu a v Oblíbenosti: číslice, šipky, Home a End (ui/srdicka.js); šipky tu nelistují modelkami.
    // V <main> i v hlavičce okna (srdíčka v záhlaví profilu): zastavení tam nepustí klávesu k obsluze dokumentu.
    const klavesaSrdicek = (e) => {
        const rada = e.target.closest?.('.hearts-pul[data-hodnoceni][role="slider"]');
        if (rada && rada === e.target && klavesaSrdicekModelky(e, rada)) e.stopPropagation();
    };
    document.querySelector('main').addEventListener('keydown', klavesaSrdicek);
    document.querySelector('.navbar')?.addEventListener('keydown', klavesaSrdicek);

    try {
        // Dřívější řazení „Podle oblíbenosti“ je teď součástí řazení podle srdíček
        const ulozene = localStorage.getItem('razeniGalerie') === 'oblibenost' ? 'hodnoceni' : localStorage.getItem('razeniGalerie');
        if (RAZENI_GALERIE[ulozene]) stav.razeniGalerie = ulozene;
    } catch { /* výchozí řazení podle jména */ }
    document.getElementById('prevModelBtn').onclick = () => krokModelky(-1);

    document.getElementById('nextModelBtn').onclick = () => krokModelky(1);

    // Jméno v drobečcích: nabídka modelek seznamu, ze kterého se profil otevřel (kolem právě otevřené)
    document.getElementById('drobecek').addEventListener('click', async (e) => {
        const seznam = stav.seznamProfilu;
        if (detailView.classList.contains('hidden') || !seznam || seznam.length < 2) return;
        e.stopPropagation();
        // V profilu je drobeček skrytý a jméno je v pruhu s modelkou: nabídka se otevře pod ním
        const kotva = /** @type {HTMLElement} */ (e.currentTarget).classList.contains('v-pruhu')
            ? document.querySelector('#profilPruhObsah .pruh-identita h2') || /** @type {HTMLElement} */ (e.currentTarget) : /** @type {HTMLElement} */ (e.currentTarget);
        const r = kotva.getBoundingClientRect();
        const podleId = new Map((await vsechnyModelky()).map(m => [m.id, m]));
        const index = Math.max(0, seznam.indexOf(stav.aktualniModelka?.id));
        const OKOLI = 8;
        const od = Math.max(0, Math.min(index - OKOLI, seznam.length - 2 * OKOLI - 1));
        const vyrez = seznam.slice(od, od + 2 * OKOLI + 1);
        const vse = vyrez.length === seznam.length;
        otevritKontextovouNabidku(r.left, r.bottom + 6, [
            { nadpis: vse ? `${seznam.length} modelek v seznamu` : `${od + 1}.–${od + vyrez.length}. z ${seznam.length} v seznamu` },
            ...vyrez.map((id, i) => ({
                text: `${od + i + 1}. ${podleId.get(id)?.jmeno || '?'}${id === stav.aktualniModelka?.id ? '  ✓' : ''}`,
                akce: () => { const m = podleId.get(id); if (m && id !== stav.aktualniModelka?.id) otevritDetailModelky(m, { bezHistorie: true }); },
            })),
        ]);
    });

    // Ročník v drobečcích čísla otevře stránku ročníku
    document.getElementById('rocnikBtn').addEventListener('click', (e) => {
        const klic = /** @type {HTMLElement} */ (e.currentTarget).dataset.vydani;
        if (klic) otevritVydani(klic);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        // Alt + šipka je Zpět, s Ctrl a ve výběru fotek se šipkami nelistuje
        const zamestnano = detailView.classList.contains('hidden') || e.defaultPrevented
            || e.altKey || e.ctrlKey || e.metaKey
            || !lightbox.classList.contains('hidden')
            || !contextMenu.classList.contains('hidden')
            || otevreneOkno()
            || vybraneDlazdice().length
            || e.target.closest('input, textarea, select');
        if (!zamestnano) krokModelky(e.key === 'ArrowRight' ? 1 : -1);
    });
}
