import './style.css';
import { GetModelky, AddModelka, UpdateModelka, DeleteModelka, DeleteVse, SetCoverVyrez, GetFotografieModelky, GetCenterfoldy, AddBulkPhotos, UpdateAlbum, DeleteAlbum, DeleteFotografie, SetRotaceFotek, SetSpojeniAlba, GetCovery, AddCover, UpdateCover, ZkontrolovatSoubory, GetVydani, SetVydaniAlba, SetPopisAlba, SetHodnoceni, SetHodnoceniFotek, SetPoradiFotek, ZrusitPoradiAlba, ExportovatDoSouboru, VybratSouborImportu, ImportovatZeSouboru, DeleteFotografieHromadne, SeznamZaloh, ObnovitZalohu, GetFotografove, GetTagy, PridatModelkuKAlbu, OdebratModelkuZAlba, PresunoutAlbum, SloucitAlba, PresunoutFotky, SloucitModelky, ObnovitFotky, PrejmenovatFotografa, PrejmenovatTag, ZkontrolovatDavku, GetKalendar, SetNetykaSe, SetNetykaSeAlba, GetSablonaObrazku, SetSablonaObrazku, GetVerze, GetNejlepsiFotky, GetAlbaFotografa, GetPrehled, MaZamek, Odemknout, NastavitHeslo, SetTitulniFotka, OveritOdkaz, VymazatMezipamet, SlozkaZaloh, StavDatabaze } from '../wailsjs/go/main/App';
import { MESICE, nazevAlba, nazevVydani, esc, formatDatum, bezDiakritiky, sjednotit, vekPriVydani, udajChybi, EDICE, VYCHOZI_EDICE, rozlozitVydani, slozitVydani, prevestVysku, prevestVahu, rozlozitMiry, obrazek } from './lib/format';
import { klicAlba, sestavitAlba, zacatkyAlb, novePoradi } from './lib/alba';
import { SABLONA_OKNA } from './sablona';
import { oznamit, jednou, pripravitOznameni } from './ui/oznameni';
import { vytvoritListu } from './ui/lista';
import { contextMenu, zavritKontextovouNabidku, otevritKontextovouNabidku, pripravitNabidku } from './ui/nabidka';
import { WindowMinimise, WindowToggleMaximise, WindowIsMaximised, WindowIsFullscreen, Quit, BrowserOpenURL, EventsOn } from '../wailsjs/runtime/runtime';

let aktualniModelka = null;
let nacteneModelky = [];
let editovanaModelka = null;
let potvrzenaAkce = null;
let zrusenaAkce = null;
let minHodnoceni = 0; // galerie ukazuje jen modelky s aspoň tolika srdíčky; 0 = všechny
let zrusitUpravuVyrezu = null;
let aktualniAlba = [];
let aktualniPolozky = [];
let stenaPolozky = [];
let rezim = 'modelky'; // přehled na hlavní stránce: 'modelky', 'centerfoldy', 'covery', 'kalendar' nebo 'prehled'
let maZamek = false;
// Pořadové číslo posledního načítání pohledu; odpověď, kterou mezitím předběhlo novější načítání, se zahodí
let cisloNacteni = 0;
let zamceno = false;
let coveryPolozky = [];
let vydaniPolozky = [];
let aktualniVydani = null;
let editovanyCover = null;
let editovaneAlbum = null;
// Modelka, ke které se ukládá okno alba; nemusí to být modelka otevřeného profilu
let modelkaAlba = null;


// Google Disk bez přípony vrací nejvýše 1600 px; =s0 je originál, =w600 úsporný náhled
const VELIKOST_NAHLEDU = 'w400';       // dlaždice fotky v albu
const VELIKOST_PLAKATU_MALA = 'w600';  // plakát na stěně, v coverech a v úzkém levém sloupci
const VELIKOST_PLAKATU = 'w1200';      // plakát v širokém sloupci stránky vydání
const VELIKOST_KARTY = 'w400';         // titulní fotka na kartě galerie
// Titulní fotka v profilu a při úpravě výřezu; rezerva pro přiblížení
const VELIKOST_TITULNI = 'w800';

// Zástupný obrázek pro modelku bez titulní fotky nebo pro fotku, která se nenačetla
const BEZ_FOTKY = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
        <rect width="300" height="400" fill="#18181c"/>
        <g fill="none" stroke="#3a3a42" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="95" y="150" width="110" height="90" rx="10"/>
            <circle cx="130" cy="182" r="10"/>
            <path d="M102 232l34-30 22 18 18-14 22 26"/>
        </g>
        <text x="150" y="275" fill="#5a5a62" font-family="sans-serif" font-size="16" text-anchor="middle">Bez fotky</text>
    </svg>`);

// Karta si vystačí s menším obrázkem, dokud výřez fotku výrazně nepřibližuje
function adresaTitulni(modelka, velka = false) {
    if (!modelka.coverUrl) return BEZ_FOTKY;
    return obrazek(modelka.coverUrl, velka || modelka.coverZoom > 1.5 ? VELIKOST_TITULNI : VELIKOST_KARTY);
}

// Fotka, která se nenačte (smazaná na Disku, bez připojení), se nahradí zástupným obrázkem
document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.src === BEZ_FOTKY || img.closest('.lightbox')) return;
    img.src = BEZ_FOTKY;
}, true);
const PLNE_ROZLISENI = 's0';


document.querySelector('#app').innerHTML = SABLONA_OKNA;
pripravitOznameni();
pripravitNabidku();

// Elementy
const gallery = document.getElementById('gallery');
const detailView = document.getElementById('detailView');
const searchInput = document.getElementById('searchInput');
const backBtn = document.getElementById('backBtn');
const wall = document.getElementById('wall');
const covers = document.getElementById('covers');
const coversList = document.getElementById('coversList');
const calList = document.getElementById('calList');
const issueView = document.getElementById('issueView');
const calendar = document.getElementById('calendar');
const stats = document.getElementById('stats');
const best = document.getElementById('best');

// Vždy je vidět jeden pohled; profil modelky a stránka vydání mají v liště tlačítko zpět místo přepínače
function ukazatPohled(pohled) {
    // Výběr fotek patří jen k otevřenému profilu
    if (pohled !== detailView) document.getElementById('selectionBar')?.classList.add('hidden');
    [gallery, wall, covers, calendar, stats, best, detailView, issueView].forEach(p => p.classList.toggle('hidden', p !== pohled));
    const podstranka = pohled === detailView || pohled === issueView;
    backBtn.classList.toggle('hidden', !podstranka);
    document.getElementById('prevModelBtn').classList.toggle('hidden', pohled !== detailView);
    document.getElementById('nextModelBtn').classList.toggle('hidden', pohled !== detailView);
    document.getElementById('favBtn').classList.toggle('hidden', pohled !== gallery);
    viewToggle.classList.toggle('hidden', podstranka);
    backBtn.innerHTML = `&larr; ${esc(popisZpet())}`;
    // Lišta písmen patří jen ke galerii modelek, lišta desetiletí jen ke stěně
    if (pohled !== gallery) document.getElementById('galleryNav')?.classList.add('hidden');
    if (pohled !== wall) document.getElementById('wallNav')?.classList.add('hidden');
}

// Historie pro Zpět: kam se vrátit a na jaké místo stránky
const historie = [];
const NAZVY_REZIMU = { modelky: 'Modelky', centerfoldy: 'Centerfoldy', covery: 'Covery', kalendar: 'Kalendář', nejlepsi: 'Nejlepší', prehled: 'Přehled' };

function popisZpet() {
    const misto = historie[historie.length - 1];
    if (misto?.typ === 'profil') return misto.modelka.jmeno;
    if (misto?.typ === 'vydani') return nazevVydani(misto.vydani);
    if (misto?.typ === 'fotograf') return misto.jmeno;
    return NAZVY_REZIMU[misto?.rezim || rezim];
}

function soucasneMisto() {
    const scroll = document.querySelector('main').scrollTop;
    if (!detailView.classList.contains('hidden')) return { typ: 'profil', modelka: aktualniModelka, scroll };
    if (!issueView.classList.contains('hidden')) return aktualniFotograf ? { typ: 'fotograf', jmeno: aktualniFotograf, scroll } : { typ: 'vydani', vydani: aktualniVydani, scroll };
    return { typ: 'prehled', rezim, scroll };
}

// Před otevřením profilu nebo vydání se zapamatuje, odkud se přišlo (ne při návratu na totéž místo)
function zapamatovatMisto(cil) {
    const misto = soucasneMisto();
    if ((misto.typ === 'profil' && cil.modelka?.id === misto.modelka?.id) || (misto.typ === 'vydani' && cil.vydani === misto.vydani)
        || (misto.typ === 'fotograf' && cil.fotograf === misto.jmeno)) return;
    historie.push(misto);
    if (historie.length > 50) historie.shift();
}

async function zpet() {
    const misto = historie.pop();
    const hlavni = document.querySelector('main');
    if (misto?.typ === 'profil') {
        await otevritDetailModelky(misto.modelka, { bezHistorie: true });
    } else if (misto?.typ === 'vydani') {
        await otevritVydani(misto.vydani, { bezHistorie: true });
    } else if (misto?.typ === 'fotograf') {
        await otevritFotografa(misto.jmeno, { bezHistorie: true });
    } else {
        if (misto) prepnoutRezim(misto.rezim);
        await nacistGalerii(searchInput.value);
    }
    // Stejné místo stránky, ze kterého se odešlo
    if (misto) requestAnimationFrame(() => { hlavni.scrollTop = misto.scroll; });
}
const viewToggle = document.getElementById('viewToggle');




// Shrnutí vložení odkazů: co se uložilo a co bylo odmítnuto
function oznamitVlozeni(v, co) {
    const casti = [`Přidáno ${co}: ${v.vlozeno}.`];
    if (v.nedostupne) casti.push(`Nefunkčních odkazů (smazané nebo nesdílené soubory): ${v.nedostupne} – neuloženy.`);
    if (v.duplicitni) casti.push(`Už uložených: ${v.duplicitni} – přeskočeny.`);
    if (v.neovereno) casti.push(`Bez ověření kvůli připojení: ${v.neovereno}.`);
    if (v.vlozeno === 0 && !v.nedostupne && !v.duplicitni) casti[0] = 'Ve vloženém textu nebyl žádný odkaz na Google Disk.';
    oznamit(casti.join(' '));
}

// Odkaz na složku Disku program neumí rozbalit na fotky; místo „nefunkčního odkazu" řekne proč
function jeOdkazNaSlozku(text) {
    if (!/\/folders\//.test(text)) return false;
    oznamit('Odkaz vede na složku Disku. Vlož odkazy na jednotlivé fotky – složku program nerozbalí.');
    return true;
}

// Odkaz, který Disk nevrací jako obrázek, se neuloží
async function odkazJeVPoradku(odkaz) {
    if (!odkaz.trim()) return true;
    if (jeOdkazNaSlozku(odkaz)) return false;
    if (await OveritOdkaz(odkaz) !== 0) return true;
    oznamit('Tento odkaz nefunguje – soubor na Google Disku je smazaný, není sdílený „kdokoli s odkazem", nebo to není obrázek.');
    return false;
}




// Výřez titulní fotky: poloha v procentech a přiblížení kolem téhož bodu
function stylVyrezu({ coverZoom, coverX, coverY }) {
    return `object-position: ${coverX}% ${coverY}%; transform-origin: ${coverX}% ${coverY}%; transform: scale(${coverZoom});`;
}


// Každý přehled si pamatuje své hledání; text z Modelek by v kalendáři filtroval roky
const hledaniPodleRezimu = {};

function prepnoutRezim(novy) {
    if (novy !== rezim) {
        hledaniPodleRezimu[rezim] = searchInput.value;
        searchInput.value = hledaniPodleRezimu[novy] || '';
    }
    rezim = novy;
    viewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.rezim === novy));
    // Při příštím spuštění se program otevře ve stejném přehledu
    try { localStorage.setItem('posledniRezim', novy); } catch { /* bez úložiště se jen nezapamatuje */ }
    document.querySelector('main').scrollTop = 0;
}

// Hodnocení 1–5 srdíček; klik na N-té nastaví N, klik na současné hodnocení ho zruší
function htmlSrdicek(hodnoceni, atribut) {
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="heart ${n <= hodnoceni ? 'on' : ''}" data-hodnota="${n}"
            title="${n === hodnoceni ? 'Zrušit hodnocení' : `Ohodnotit ${n} z 5`}"></button>`).join('');
    return `<span class="hearts ${hodnoceni ? 'rated' : ''}" ${atribut}>${srdicka}</span>`;
}

function htmlSrdicka(modelka) {
    return htmlSrdicek(modelka.hodnoceni, `data-hodnoceni="${modelka.id}"`);
}

// Srdíčka fotky; index míří do seznamu položek právě zobrazeného pohledu
function htmlSrdickaFotky(polozka, index) {
    return htmlSrdicek(polozka.hodnoceni, `data-hodnoceni-fotky="${index}"`);
}

async function ohodnotitPolozku(polozka, zvoleno) {
    const nove = zvoleno === polozka.hodnoceni ? 0 : zvoleno;
    if (!await SetHodnoceniFotek(polozka.fotky.map(f => f.id), nove)) return false;
    polozka.hodnoceni = nove;
    polozka.fotky.forEach(f => { f.hodnoceni = nove; });
    return true;
}

// Srdíčka na dlaždici fotky v profilu a na stránce vydání
document.querySelector('main').addEventListener('click', async (e) => {
    const srdicko = e.target.closest('[data-hodnoceni-fotky] .heart');
    if (!srdicko) return;
    const rada = srdicko.closest('.hearts');
    const naStranceVydani = Boolean(rada.closest('#issueView, #best'));
    const seznam = rada.closest('#best') ? nejlepsiPolozky : rada.closest('#issueView') ? vydaniPolozky : aktualniPolozky;
    const polozka = seznam[parseInt(rada.dataset.hodnoceniFotky)];
    if (!polozka || !await ohodnotitPolozku(polozka, parseInt(srdicko.dataset.hodnota))) return;

    // V profilu se fotky podle nového hodnocení hned přeřadí; stránka vydání by přitom odskočila nahoru
    if (naStranceVydani) rada.outerHTML = htmlSrdickaFotky(polozka, parseInt(rada.dataset.hodnoceniFotky));
    else nacistFotkyModelky(aktualniModelka.id);
});

// Srdíčka na kartě i v profilu
document.querySelector('main').addEventListener('click', async (e) => {
    const srdicko = e.target.closest('.hearts .heart');
    if (!srdicko) return;
    const rada = srdicko.closest('.hearts');
    const id = parseInt(rada.dataset.hodnoceni);
    const modelka = [aktualniModelka, ...nacteneModelky].find(m => m && m.id === id);
    if (!modelka) return;

    const zvoleno = parseInt(srdicko.dataset.hodnota);
    const nove = zvoleno === modelka.hodnoceni ? 0 : zvoleno;
    if (!await SetHodnoceni(id, nove)) return;

    // Tatáž modelka může být načtená v galerii i otevřená v profilu
    [aktualniModelka, ...nacteneModelky].filter(m => m && m.id === id).forEach(m => { m.hodnoceni = nove; });
    rada.outerHTML = htmlSrdicka(modelka);
    if (minHodnoceni && !gallery.classList.contains('hidden')) nacistGalerii(searchInput.value);
});

// Tlačítko v liště zvyšuje minimální hodnocení: vše -> 1+ -> … -> 5 -> vše
function vykreslitFiltrHodnoceni() {
    const tlacitko = document.getElementById('favBtn');
    tlacitko.classList.toggle('active', minHodnoceni > 0);
    tlacitko.innerHTML = minHodnoceni ? `&#9829; ${minHodnoceni}${minHodnoceni < 5 ? '+' : ''}` : '&#9825;';
    tlacitko.title = minHodnoceni
        ? `Zobrazeny modelky s hodnocením ${minHodnoceni}${minHodnoceni < 5 ? ' a více' : ''}. Klik: ${minHodnoceni < 5 ? 'přísnější' : 'zobrazit všechny'}.`
        : 'Zobrazit jen hodnocené modelky';
}

document.getElementById('favBtn').onclick = () => {
    minHodnoceni = (minHodnoceni + 1) % 6;
    nacistGalerii(searchInput.value);
};

// Předchozí a další modelka v pořadí, v jakém jsou v galerii
async function krokModelky(smer) {
    if (!aktualniModelka) return;
    let seznam = nacteneModelky;
    if (!seznam.some(m => m.id === aktualniModelka.id)) {
        seznam = nacteneModelky = await GetModelky('') || [];
    }
    const index = seznam.findIndex(m => m.id === aktualniModelka.id);
    if (index < 0 || seznam.length < 2) return;
    // Listování mezi modelkami historii neplní, Zpět vede tam, odkud se do profilů přišlo
    otevritDetailModelky(seznam[(index + smer + seznam.length) % seznam.length], { bezHistorie: true });
}
document.getElementById('prevModelBtn').onclick = () => krokModelky(-1);
document.getElementById('nextModelBtn').onclick = () => krokModelky(1);

document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const zamestnano = detailView.classList.contains('hidden')
        || !lightbox.classList.contains('hidden')
        || document.querySelector('.modal-overlay:not(.hidden)')
        || e.target.closest('input, textarea, select');
    if (!zamestnano) krokModelky(e.key === 'ArrowRight' ? 1 : -1);
});


// Klik na údaj v profilu vyhledá všechny modelky se stejnou hodnotou
function hledatHodnotu(hodnota) {
    minHodnoceni = 0;
    prepnoutRezim('modelky');
    searchInput.value = hodnota;
    nacistGalerii(hodnota);
}

// Načtení Hlavní Galerie
// zMezipameti = jen přefiltrovat data načtená minule (psaní do hledání), nenačítat je znovu z databáze
async function nacistGalerii(dotaz = '', zMezipameti = false) {
    if (rezim === 'centerfoldy') return nacistStenu(dotaz, zMezipameti);
    if (rezim === 'covery') return nacistCovery(dotaz, zMezipameti);
    if (rezim === 'kalendar') return nacistKalendar(dotaz, zMezipameti);
    if (rezim === 'prehled') return nacistPrehled();
    if (rezim === 'nejlepsi') return nacistNejlepsi(dotaz, zMezipameti);

    const moje = ++cisloNacteni;
    const vsechny = await GetModelky(dotaz) || [];
    if (moje !== cisloNacteni) return;
    const modelky = vsechny.filter(m => m.hodnoceni >= minHodnoceni);
    // Se zapnutým filtrem jdou nejlépe hodnocené první, při shodě zůstává pořadí podle jména
    if (minHodnoceni) modelky.sort((a, b) => b.hodnoceni - a.hodnoceni);
    nacteneModelky = modelky;
    vykreslitFiltrHodnoceni();
    zrusitUpravuVyrezu = null;
    ukazatPohled(gallery);

    if (modelky.length === 0) {
        listaGalerie.naplnit([]);
        gallery.innerHTML = `<div class="empty-state">${
            minHodnoceni ? `Žádná modelka nemá hodnocení ${minHodnoceni}${minHodnoceni < 5 ? ' nebo vyšší' : ''}. Hodnotí se srdíčky na kartě nebo v profilu.`
            : dotaz.trim() ? 'Hledání neodpovídá žádná modelka.'
            : 'Zatím žádné modelky. Přidej první pravým tlačítkem myši.'}</div>`;
        return;
    }

    gallery.innerHTML = modelky.map(m => `
        <div class="card" data-id="${m.id}">
            <div class="card-image-wrap">
                <img src="${esc(adresaTitulni(m))}" alt="${esc(m.jmeno)}" style="${stylVyrezu(m)}" draggable="false" loading="lazy" />
                ${htmlSrdicka(m)}
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}</h3>
            </div>
        </div>
    `).join('');

    // Lišta písmen: první karta každého písmene je část stránky; při řazení podle srdíček nedává smysl
    if (!minHodnoceni && modelky.length >= MODELEK_PRO_PISMENA) {
        const pismena = new Map();
        const pismeno = m => (/^\p{L}/u.test(bezDiakritiky(m.jmeno)) ? bezDiakritiky(m.jmeno)[0].toUpperCase() : '#');
        modelky.forEach(m => pismena.set(pismeno(m), (pismena.get(pismeno(m)) || 0) + 1));
        const videna = new Set();
        gallery.querySelectorAll('.card').forEach(karta => {
            const p = pismeno(modelky.find(m => m.id === parseInt(karta.dataset.id)));
            if (!videna.has(p)) {
                videna.add(p);
                karta.dataset.cast = p;
            }
        });
        listaGalerie.naplnit([...pismena].map(([p, pocet]) => ({ klic: p, nazev: p, pocet })));
        listaGalerie.sledovat();
    } else {
        listaGalerie.naplnit([]);
    }

    // Přidání kliku na kartu -> Otevření profilu modelky
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (card.classList.contains('editing') || e.target.closest('.hearts')) return;
            const id = parseInt(card.getAttribute('data-id'));
            const modelka = modelky.find(item => item.id === id);
            otevritDetailModelky(modelka);
        });
    });
}

// Otevření profilu modelky s fotogalerií
async function otevritDetailModelky(modelka, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ modelka });
    // Opožděná odpověď přehledu, ze kterého se sem přišlo, už profil nesmí přepsat
    cisloNacteni++;
    aktualniModelka = modelka;
    ukazatPohled(detailView);
    // Dokud nejsou načtené fotky, není jasné, zda se ukáže titulní fotka, nebo centerfold
    document.getElementById('centerfoldsSide').innerHTML = '';
    detailView.classList.add('bez-titulni');
    document.querySelector('main').scrollTop = 0;

    const anoNe = hodnota => hodnota === 1 ? 'Ano' : hodnota === 0 ? 'Ne' : '';
    const hledatelne = hodnota => hodnota
        ? `<button class="link" data-hledat="${esc(hodnota)}" title="Vyhledat modelky se stejnou hodnotou">${esc(hodnota)}</button>`
        : '';
    // Vydání se odvozují z alb a centerfoldů; starší ručně psané údaje se ukážou, jen když odvozená chybí
    const prvniVydani = modelka.vydani.find(v => rozlozitVydani(v)?.mesic) || (rozlozitVydani(modelka.vystoupeni)?.mesic ? modelka.vystoupeni : '');
    const vydani = modelka.vydani.length
        ? modelka.vydani.map(v => `<button class="chip" data-vydani="${esc(v)}" title="Otevřít vydání">${esc(nazevVydani(v))}</button>`).join(' ')
        : esc([modelka.vystoupeni, ...modelka.pictorialVydani.split('\n')].map(v => v.trim()).filter(Boolean).join(', '));

    // [popisek, hotové HTML hodnoty]; prázdné řádky se nezobrazují
    const udaje = [
        ['Narození', esc([formatDatum(modelka.narozeniDatum), modelka.narozeniMisto].filter(Boolean).join(', '))],
        ['Věk při prvním vydání', esc(vekPriVydani(modelka.narozeniDatum, prvniVydani))],
        ['Národnost', hledatelne(modelka.narodnost)],
        ['Etnicita', esc(modelka.etnicita)],
        ['Výška', modelka.vyskaCm ? `${modelka.vyskaCm} cm` : ''],
        ['Váha', modelka.vahaKg ? `${modelka.vahaKg} kg` : ''],
        ['Vlasy', hledatelne(modelka.vlasyBarva)],
        ['Oči', hledatelne(modelka.ociBarva)],
        ['Míry', esc(modelka.miry)],
        ['Prsa', esc([modelka.velikostPrsou, modelka.prsaTyp].filter(Boolean).join(', '))],
        ['Ochlupení', esc(modelka.ochlupeni)],
        ['Tetování', anoNe(modelka.tetovani)],
        ['Piercing', anoNe(modelka.piercing)],
        ['Vydání', vydani],
        ['Role', esc(modelka.role)],
    ].filter(([, hodnota]) => hodnota);

    const tagy = modelka.tags.split(',').map(t => t.trim()).filter(Boolean);
    const dalsiJmena = modelka.dalsiJmena.split(',').map(j => j.trim()).filter(Boolean);

    document.getElementById('modelHeader').innerHTML = `
        <div class="profile-cover"><img src="${esc(adresaTitulni(modelka, true))}" alt="${esc(modelka.jmeno)}" style="${stylVyrezu(modelka)}" draggable="false" /></div>
        <h2>${esc(modelka.jmeno)}</h2>
        ${htmlSrdicka(modelka)}
        ${dalsiJmena.length ? `<p class="profile-aliases">také ${esc(dalsiJmena.join(', '))}</p>` : ''}
        <div class="profile-tags">${tagy.map(t => `<button class="tag" data-hledat="${esc(t)}" title="Vyhledat modelky s tímto tagem">${esc(t)}</button>`).join('')}</div>
        <dl class="profile-info">
            ${udaje.map(([nazev, hodnota]) => `<div><dt>${nazev}</dt><dd>${hodnota}</dd></div>`).join('')}
        </dl>
        ${modelka.poznamka ? `<p class="profile-note">${esc(modelka.poznamka)}</p>` : ''}
    `;

    await nacistFotkyModelky(modelka.id);
}


// Ostatní modelky sdíleného alba (hlavní i další kromě té, jejíž profil je otevřený) jako odkazy na jejich profil
function htmlSpoluModelek(a, krome = aktualniModelka?.id) {
    const ostatni = [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky].filter(m => m.id !== krome && m.jmeno);
    return ostatni.length ? `<span class="album-spolu">s ${ostatni.map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>`).join(' ')}</span>` : '';
}

// Průvodní text alba a fotograf; delší text je zkrácený a rozbaluje se kliknutím
function htmlPopisuAlba(a) {
    if (!a.popis && !a.fotograf) return '';
    return `
        <div class="album-desc">
            ${a.popis ? `<p class="album-desc-text">${esc(a.popis)}</p>
            <button class="link album-desc-more hidden" data-rozbalit>více</button>` : ''}
            ${a.fotograf ? `<p class="album-credit">Foto: <button class="link" data-fotograf="${esc(a.fotograf)}" title="Všechna alba tohoto fotografa">${esc(a.fotograf)}</button></p>` : ''}
        </div>
    `;
}

// Tlačítko „více" má smysl jen u textu, který se do zkrácené podoby nevešel
function pripravitPopisy(pohled) {
    pohled.querySelectorAll('.album-desc-text').forEach(text => {
        text.nextElementSibling.classList.toggle('hidden', text.scrollHeight <= text.clientHeight + 1);
    });
}

document.querySelector('main').addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-rozbalit]');
    if (!tlacitko) return;
    const rozbaleno = tlacitko.previousElementSibling.classList.toggle('open');
    tlacitko.textContent = rozbaleno ? 'méně' : 'více';
});

// Plakát: jedna nebo více stránek spojených bez mezer, volitelně otočený
// line = načíst až při přiblížení k oknu (dlouhé přehledy, kde je plakátů mnoho)
function htmlPlakatu(polozka, velikost, atributy = '', line = false) {
    return `
        <div class="poster" data-rot="${polozka.rotace}" ${atributy}>
            <div class="poster-inner">
                ${polozka.fotky.map(f => `<img src="${esc(obrazek(f.url, velikost))}" data-foto-id="${f.id}" draggable="false" ${line ? 'loading="lazy"' : ''} />`).join('')}
            </div>
        </div>
    `;
}

// Po načtení stránek nastaví plakátu poměr stran a rozložení stránek
function pripravitPlakat(plakat, poZmene = () => {}) {
    const vnitrek = plakat.querySelector('.poster-inner');
    const obrazky = [...vnitrek.querySelectorAll('img')];

    const prepocitat = () => {
        if (obrazky.some(o => !o.naturalWidth)) return;
        const pomery = obrazky.map(o => o.naturalWidth / o.naturalHeight);
        // Stránky na výšku se řadí vedle sebe, stránky na šířku pod sebe
        const sloupec = obrazky.length > 1 && pomery[0] > 1;
        vnitrek.classList.toggle('column', sloupec);
        // Podíl stránky na délce plakátu; násobek drží součet nad 1, jinak by flex nevyplnil celý plakát
        obrazky.forEach((o, i) => { o.style.flex = `${(sloupec ? 1 / pomery[i] : pomery[i]) * 100} 1 0px`; });

        // Rozměr celého plakátu v pixelech zdrojových obrázků (před otočením)
        const W = sloupec ? Math.max(...obrazky.map(o => o.naturalWidth)) : null;
        const H = sloupec ? null : Math.max(...obrazky.map(o => o.naturalHeight));
        plakat._rozmer = sloupec
            ? { W, H: W * pomery.reduce((s, p) => s + 1 / p, 0) }
            : { W: H * pomery.reduce((s, p) => s + p, 0), H };

        const pomer = plakat._rozmer.W / plakat._rozmer.H;
        plakat.style.setProperty('--ar', parseInt(plakat.dataset.rot) % 180 ? 1 / pomer : pomer);
        poZmene();
    };

    obrazky.forEach(o => o.addEventListener('load', prepocitat));
    prepocitat();
}

// Načtení fotografií v detailu
async function nacistFotkyModelky(modelkaId) {
    const fotky = await GetFotografieModelky(modelkaId);
    // Při rychlém listování mezi modelkami může dorazit odpověď pro tu předchozí; její alba se nesmí ukázat
    // pod jménem jiné modelky, úpravy by pak šly na špatnou
    if (aktualniModelka?.id !== modelkaId) return;
    const photosGrid = document.getElementById('photosGrid');
    // Překreslení alb výběr ruší
    posledniVybrana = null;
    selectionBar.classList.add('hidden');

    const centerfoldsSide = document.getElementById('centerfoldsSide');
    const prazdno = '<p class="empty-state">Tato modelka zatím nemá nahraná žádná alba. Přidej je pravým tlačítkem myši.</p>';

    aktualniAlba = sestavitAlba(fotky || []);
    // Jméno hlavní modelky sdíleného alba (fotky profilu jména nenesou)
    const jmenaModelek = new Map((nacteneModelky || []).map(m => [m.id, m.jmeno]));
    jmenaModelek.set(aktualniModelka.id, aktualniModelka.jmeno);
    const neznama = aktualniAlba.filter(a => !jmenaModelek.has(a.modelkaId));
    if (neznama.length) (await GetModelky('') || []).forEach(m => jmenaModelek.set(m.id, m.jmeno));
    aktualniAlba.forEach(a => { a.jmenoModelky = jmenaModelek.get(a.modelkaId) || ''; });
    // Alba v profilu chronologicky podle vydání, bez vydání na konci v pořadí, jak přibyla;
    // ruční přeřazení fotek uvnitř alba tak pořadí alb nemění
    const klicPoradi = a => {
        const v = rozlozitVydani(a.typ === 'Centerfold' ? a.album : a.vydani);
        return v ? `0${v.rok}${v.mesic || '00'}${v.edice}` : '1';
    };
    const prvniFotka = a => Math.min(...a.fotky.map(f => f.id));
    aktualniAlba.sort((x, y) => (y.typ === 'Centerfold') - (x.typ === 'Centerfold')
        || klicPoradi(x).localeCompare(klicPoradi(y)) || prvniFotka(x) - prvniFotka(y));
    // Pořadí pro prohlížeč: nejdřív centerfoldy z levého sloupce, potom alba
    aktualniPolozky = aktualniAlba.flatMap(a => a.polozky);

    const sklonovat = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n < 5 ? dve : pet}`;

    const htmlAlba = (a) => {
        const centerfold = a.typ === 'Centerfold';
        const popis = sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek');

        return `
            <section class="album" data-album="${aktualniAlba.indexOf(a)}" data-cast="${aktualniAlba.indexOf(a)}">
                ${centerfold ? '' : `
                    <div class="album-header">
                        <h4>${esc(nazevAlba(a.album, a.typ))}</h4>
                        <span>${esc(a.typ)} · ${popis}</span>
                        ${a.vydani ? `<button class="chip" data-vydani="${esc(a.vydani)}" title="Otevřít vydání">${esc(nazevVydani(a.vydani))}</button>` : ''}
                        ${htmlSpoluModelek(a)}
                        <button class="album-more" data-nabidka-alba title="Akce alba (také pravým tlačítkem)">&#8943;</button>
                    </div>
                    ${htmlPopisuAlba(a)}
                `}
                <div class="${centerfold ? 'posters' : 'photos-grid'}" ${centerfold ? '' : atributyMrizky(a)}>
                    ${a.polozky.map(p => {
                        const index = aktualniPolozky.indexOf(p);
                        // Centerfold se zobrazuje celý jako plakát, ostatní fotky jako oříznuté dlaždice
                        return centerfold
                            ? htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index}"`)
                            : `<div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}">
                                   <img src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
                                   ${htmlSrdickaFotky(p, index)}
                               </div>`;
                    }).join('')}
                </div>
                ${centerfold ? htmlPopisuAlba(a) : ''}
            </section>
        `;
    };

    const centerfoldy = aktualniAlba.filter(a => a.typ === 'Centerfold');
    const ostatni = aktualniAlba.filter(a => a.typ !== 'Centerfold');
    centerfoldsSide.innerHTML = centerfoldy.map(htmlAlba).join('');
    detailView.classList.toggle('bez-titulni', centerfoldy.length > 0);
    photosGrid.innerHTML = ostatni.map(htmlAlba).join('') || prazdno;

    // Lišta má smysl až od dvou alb; centerfoldy jsou v levém sloupci stále vidět
    listaAlb.naplnit(ostatni.map(a => ({ klic: aktualniAlba.indexOf(a), nazev: nazevAlba(a.album, a.typ), pocet: a.fotky.length })));

    detailView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(detailView);
    zkratitAlba(detailView);
    listaAlb.sledovat();
}

// Ruční pořadí fotek: dlaždice se v albu profilu přetáhne na nové místo
let tazenaFotka = null;
let praveTazeno = false;

function zrusitZnackyVlozeni() {
    document.querySelectorAll('.vlozit-pred, .vlozit-za').forEach(d => d.classList.remove('vlozit-pred', 'vlozit-za'));
}

document.getElementById('photosGrid').addEventListener('pointerdown', (e) => {
    const dlazdice = e.target.closest('.photo-item');
    // S Ctrl nebo Shift se fotky vybírají, netahají
    if (e.button !== 0 || !dlazdice || dlazdice.classList.contains('dalsi') || e.target.closest('.hearts') || e.ctrlKey || e.metaKey || e.shiftKey) return;
    tazenaFotka = { dlazdice, x: e.clientX, y: e.clientY, tahne: false, cil: null, pred: false };
});

window.addEventListener('pointermove', (e) => {
    const t = tazenaFotka;
    if (!t) return;
    // Malý pohyb při kliknutí ještě není tažení
    if (!t.tahne) {
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8) return;
        t.tahne = true;
        t.dlazdice.classList.add('tazena');
        document.body.classList.add('razeni');
    }
    zrusitZnackyVlozeni();
    const pod = document.elementFromPoint(e.clientX, e.clientY)?.closest('.photo-item');
    // Přesouvá se jen uvnitř téhož alba
    t.cil = pod && pod !== t.dlazdice && pod.parentElement === t.dlazdice.parentElement ? pod : null;
    if (!t.cil) return;
    const obdelnik = t.cil.getBoundingClientRect();
    t.pred = e.clientX < obdelnik.left + obdelnik.width / 2;
    t.cil.classList.add(t.pred ? 'vlozit-pred' : 'vlozit-za');
});

async function dokoncitTazeniFotky(zrusit = false) {
    const t = tazenaFotka;
    tazenaFotka = null;
    if (!t || !t.tahne) return;
    zrusitZnackyVlozeni();
    t.dlazdice.classList.remove('tazena');
    document.body.classList.remove('razeni');
    // Uvolnění tlačítka po tažení nesmí fotku otevřít
    praveTazeno = true;
    setTimeout(() => { praveTazeno = false; }, 0);
    if (zrusit || !t.cil) return;

    // Výchozí je pořadí, v jakém jsou fotky právě vidět; tím se z alba stává ručně seřazené
    const album = aktualniAlba[parseInt(t.dlazdice.closest('.album').dataset.album)];
    const ids = novePoradi(album.polozky.map(p => p.fotky[0].id),
        parseInt(t.dlazdice.dataset.fotoId), parseInt(t.cil.dataset.fotoId), t.pred);

    if (!await SetPoradiFotek(ids)) return;
    if (!album.rucniPoradi) oznamit('Album má teď ruční pořadí a podle srdíček se už nepřeskupuje. Zpět: pravé tlačítko na albu → Řadit album podle srdíček.');
    nacistFotkyModelky(aktualniModelka.id);
}
window.addEventListener('pointerup', () => dokoncitTazeniFotky());
window.addEventListener('pointercancel', () => dokoncitTazeniFotky(true));
window.addEventListener('blur', () => dokoncitTazeniFotky(true));

document.getElementById('photosGrid').addEventListener('click', (e) => {
    if (!praveTazeno) return;
    e.stopPropagation();
    e.preventDefault();
}, true);

// Posun stránky spojeného plakátu o jedno místo; smer -1 = dřív, 1 = později
async function posunoutStranku(album, fotka, smer) {
    const ids = album.fotky.map(f => f.id);
    const odkud = ids.indexOf(fotka.id);
    const kam = odkud + smer;
    if (kam < 0 || kam >= ids.length) return;
    [ids[odkud], ids[kam]] = [ids[kam], ids[odkud]];
    if (await SetPoradiFotek(ids)) nacistFotkyModelky(aktualniModelka.id);
}

// Dlouhé album ukazuje jen první řádky; poslední viditelná dlaždice nese počet skrytých fotek a album rozbalí
const RADKU_NAHLEDU = 2;
const rozbalenaAlba = new Set();
const atributyMrizky = a => `data-klic="${esc(klicAlba(a))}"`;

function zkratitAlba(pohled) {
    pohled.querySelectorAll('.photos-grid').forEach(mrizka => {
        // Počet sloupců jde zjistit jen u mřížky, která je vidět
        if (!mrizka.offsetParent) return;
        const dlazdice = [...mrizka.children];
        const limit = getComputedStyle(mrizka).gridTemplateColumns.split(' ').length * RADKU_NAHLEDU;
        const zkratit = dlazdice.length > limit && !rozbalenaAlba.has(mrizka.dataset.klic);

        dlazdice.forEach((d, i) => {
            d.classList.toggle('skryta', zkratit && i >= limit);
            d.classList.toggle('dalsi', zkratit && i === limit - 1);
            if (zkratit && i === limit - 1) d.dataset.dalsich = `+${dlazdice.length - limit}`;
        });
        mrizka.classList.toggle('zkracena', zkratit);
        mrizka.classList.toggle('rozbalena', dlazdice.length > limit && !zkratit);
    });
}

function prepnoutRozbaleniAlba(mrizka, rozbalit) {
    if (rozbalit) rozbalenaAlba.add(mrizka.dataset.klic);
    else rozbalenaAlba.delete(mrizka.dataset.klic);
    zkratitAlba(mrizka.parentElement);
    listaAlb.sledovat();
}

// Klik na dlaždici s počtem skrytých fotek album rozbalí, místo aby otevřel fotku
function rozbalitKliknute(e) {
    const dlazdice = e.target.closest('.photo-item.dalsi');
    if (dlazdice) prepnoutRozbaleniAlba(dlazdice.parentElement, true);
    return Boolean(dlazdice);
}

// Lišta nad rolovanou stránkou: skáče na její části (prvky s data-cast) a zvýrazňuje tu, která je právě nahoře
const hlavniOblast = document.querySelector('main');
const listyStranky = [];

function vytvoritListuStranky(nav, pohled) {
    const casti = () => [...pohled.querySelectorAll('[data-cast]')];
    const lista = vytvoritListu(nav, (klic) => {
        const cast = casti().find(c => c.dataset.cast === klic);
        if (!cast) return;
        const posun = cast.getBoundingClientRect().top - hlavniOblast.getBoundingClientRect().top - nav.offsetHeight - 8;
        hlavniOblast.scrollTo({ top: hlavniOblast.scrollTop + posun, behavior: 'smooth' });
    });
    lista.sledovat = () => {
        // Skrytá lišta ani lišta ve skrytém pohledu se nesleduje
        if (!nav.offsetParent) return;
        const hranice = nav.getBoundingClientRect().bottom + 40;
        const vsechny = casti();
        // Na konci stránky už poslední část výš nevyjede, i tak je to ta aktuální
        const naKonci = hlavniOblast.scrollTop > 0 && hlavniOblast.scrollTop >= hlavniOblast.scrollHeight - hlavniOblast.clientHeight - 1;
        const aktualni = naKonci ? vsechny.at(-1) : vsechny.filter(c => c.getBoundingClientRect().top <= hranice).pop() || vsechny[0];
        lista.oznacit(aktualni?.dataset.cast);
    };
    listyStranky.push(lista);
    return lista;
}

const listaAlb = vytvoritListuStranky(document.getElementById('albumNav'), document.getElementById('photosGrid'));
const listaCoveru = vytvoritListuStranky(document.getElementById('coversNav'), covers);
const listaKalendare = vytvoritListuStranky(document.getElementById('calNav'), calendar);
const listaGalerie = vytvoritListuStranky(document.getElementById('galleryNav'), gallery);
const listaSteny = vytvoritListuStranky(document.getElementById('wallNav'), wall);
// Lišta písmen má smysl až u větší sbírky
const MODELEK_PRO_PISMENA = 20;

let cekaNaOznaceni = false;
hlavniOblast.addEventListener('scroll', () => {
    if (cekaNaOznaceni) return;
    cekaNaOznaceni = true;
    requestAnimationFrame(() => {
        cekaNaOznaceni = false;
        listyStranky.forEach(l => l.sledovat());
    });
}, { passive: true });

// Počet sloupců mřížky, a tím i počet fotek v náhledu, závisí na šířce okna
window.addEventListener('resize', () => {
    zkratitAlba(detailView);
    zkratitAlba(issueView);
    listyStranky.forEach(l => { l.sledovat(); l.upravitSipky(); });
});

// Stěna centerfoldů napříč všemi modelkami
let stenaData = null;

async function nacistStenu(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const fotky = zMezipameti && stenaData ? stenaData : await GetCenterfoldy() || [];
    stenaData = fotky;
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(wall);

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.jmenoModelky, f.album, nazevAlba(f.album, f.typ)].some(t => bezDiakritiky(t).includes(hledat));
    stenaPolozky = sestavitAlba(fotky.filter(vyhovuje)).flatMap(a => a.polozky);
    // Chronologicky: podle vydání (rok, měsíc, edice) jako časová osa, s lištou desetiletí
    const klicVydani = p => { const v = rozlozitVydani(p.album); return v ? `${v.rok}${v.mesic}${v.edice}` : '9999'; };
    if (stenaChronologicky) stenaPolozky.sort((x, y) => klicVydani(x).localeCompare(klicVydani(y)));
    wall.classList.toggle('chronologicky', stenaChronologicky);

    const razeni = `<div class="wall-toolbar">
        <button class="chip ${stenaChronologicky ? '' : 'active'}" data-razeni-steny="jmeno">Podle jména</button>
        <button class="chip ${stenaChronologicky ? 'active' : ''}" data-razeni-steny="vydani">Podle vydání</button></div>`;
    if (stenaPolozky.length === 0) {
        listaSteny.naplnit([]);
        wall.innerHTML = razeni + `<div class="empty-state">${fotky.length ? 'Hledání neodpovídá žádný centerfold.' : 'Zatím žádné centerfoldy. Přidej je pravým tlačítkem myši.'}</div>`;
        return;
    }

    const dekady = new Map();
    const znackaDekady = p => {
        if (!stenaChronologicky) return '';
        const rok = parseInt(rozlozitVydani(p.album)?.rok);
        if (!rok) return '';
        const dekada = Math.floor(rok / 10) * 10;
        const prvni = !dekady.has(dekada);
        dekady.set(dekada, (dekady.get(dekada) || 0) + 1);
        return prvni ? `data-cast="${dekada}"` : '';
    };
    wall.innerHTML = razeni + stenaPolozky.map((p, i) => `
        <figure class="wall-item" data-index="${i}" ${znackaDekady(p)}>
            ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
            <figcaption>
                <strong>${esc(p.jmenoModelky)}</strong>
                <span>${esc(nazevAlba(p.album, p.typ))}</span>
            </figcaption>
        </figure>
    `).join('');
    listaSteny.naplnit([...dekady].map(([dekada, pocet]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet })));
    listaSteny.sledovat();
    wall.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

let stenaChronologicky = false;
try { stenaChronologicky = localStorage.getItem('stenaChronologicky') === '1'; } catch { /* podle jména */ }

wall.addEventListener('click', (e) => {
    const razeni = e.target.closest('[data-razeni-steny]');
    if (!razeni) return;
    e.stopPropagation();
    stenaChronologicky = razeni.dataset.razeniSteny === 'vydani';
    try { localStorage.setItem('stenaChronologicky', stenaChronologicky ? '1' : ''); } catch { /* jen se nezapamatuje */ }
    nacistStenu(searchInput.value, true);
}, true);

// Covery časopisů seřazené od nejnovějšího vydání, po ročnících
let coveryData = null;

async function nacistCovery(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const [fotky, centerfoldy] = zMezipameti && coveryData ? coveryData : await Promise.all([GetCovery(), GetCenterfoldy()]);
    coveryData = [fotky, centerfoldy];
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(covers);

    // Modelka z centerfoldu téhož vydání, pokud už je v databázi
    const playmate = new Map((centerfoldy || []).map(f => [f.album, f.jmenoModelky]));

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.album, nazevAlba(f.album, f.typ), playmate.get(f.album) || ''].some(t => bezDiakritiky(t).includes(hledat));
    coveryPolozky = sestavitAlba((fotky || []).filter(vyhovuje)).flatMap(a => a.polozky);

    if (coveryPolozky.length === 0) {
        listaCoveru.naplnit([]);
        coversList.innerHTML = `<div class="empty-state">${fotky?.length ? 'Hledání neodpovídá žádný cover.' : 'Zatím žádné covery. Přidej je pravým tlačítkem myši.'}</div>`;
        return;
    }

    const rocniky = new Map();
    coveryPolozky.forEach((p, i) => {
        const rok = /^\d{4}/.exec(p.album)?.[0] || 'Ostatní';
        if (!rocniky.has(rok)) rocniky.set(rok, []);
        rocniky.get(rok).push(i);
    });

    listaCoveru.naplnit([...rocniky].map(([rok, indexy]) => ({ klic: rok, nazev: rok, pocet: indexy.length })));
    coversList.innerHTML = [...rocniky].map(([rok, indexy]) => `
        <section class="cover-year" data-cast="${esc(rok)}">
            <h3>${esc(rok)}</h3>
            <div class="covers-grid">
                ${indexy.map(i => {
                    const p = coveryPolozky[i];
                    return `
                        <figure class="cover-item" data-index="${i}">
                            ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
                            <figcaption>
                                <strong>${esc(nazevAlba(p.album, p.typ))}</strong>
                                ${playmate.has(p.album) ? `<span>Centerfold: ${esc(playmate.get(p.album))}</span>` : ''}
                            </figcaption>
                        </figure>
                    `;
                }).join('')}
            </div>
        </section>
    `).join('');
    covers.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    listaCoveru.sledovat();
}

covers.addEventListener('click', (e) => {
    const polozka = e.target.closest('.cover-item');
    if (polozka) otevritVydani(coveryPolozky[parseInt(polozka.dataset.index)].album);
});

// Stránka vydání: vlevo cover, vpravo centerfold a pictorialy všech modelek z tohoto čísla
async function otevritVydani(vydani, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ vydani });
    const moje = ++cisloNacteni;
    const fotky = await GetVydani(vydani) || [];
    if (moje !== cisloNacteni) return;
    aktualniVydani = vydani;
    aktualniFotograf = null;
    ukazatPohled(issueView);
    document.querySelector('main').scrollTop = 0;
    // Ročník (bez měsíce) má vlastní rozvržení po měsících
    if (!rozlozitVydani(vydani)?.mesic) return vykreslitRocnik(vydani, fotky);
    listaStranky.naplnit([]);

    const alba = sestavitAlba(fotky);
    const coveryVydani = alba.filter(a => a.typ === 'Cover');
    const centerfoldy = alba.filter(a => a.typ === 'Centerfold');
    const ostatni = alba.filter(a => a.typ !== 'Cover' && a.typ !== 'Centerfold');
    // Pořadí pro prohlížeč: cover, centerfold, pictorialy
    vydaniPolozky = [...coveryVydani, ...centerfoldy, ...ostatni].flatMap(a => a.polozky);
    const index = p => vydaniPolozky.indexOf(p);
    // Ročník bez měsíce sdružuje jen pictorialy; cover ani centerfold nemá
    const jenRocnik = !rozlozitVydani(vydani)?.mesic;
    const odkazNaModelku = a => [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky]
        .map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil modelky">${esc(m.jmeno)}</button>`).join(' ');
    const sklonovat = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n < 5 ? dve : pet}`;

    document.getElementById('issueSide').innerHTML = `
        <div class="posters">
            ${coveryVydani.flatMap(a => a.polozky).map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`)).join('')
                || `<div class="profile-cover"><img src="${BEZ_FOTKY}" alt="Bez coveru" draggable="false" /></div>`}
        </div>
        <h2>${jenRocnik ? 'Ročník ' : ''}${esc(nazevVydani(vydani))}</h2>
        <div class="issue-add">
            ${jenRocnik ? '' : '<button class="chip" data-pridat="cover">+ cover</button><button class="chip" data-pridat="centerfold">+ centerfold</button>'}
            <button class="chip" data-pridat="pictorial">+ pictorial</button>
        </div>
        <dl class="profile-info">
            ${jenRocnik ? '' : `
            <div><dt>Cover</dt><dd>${coveryVydani.length ? 'Ano' : 'Zatím chybí'}</dd></div>
            <div><dt>Centerfold</dt><dd>${centerfoldy.map(a => esc(a.jmenoModelky)).join(', ') || 'Zatím chybí'}</dd></div>`}
            <div><dt>Pictorialy</dt><dd>${ostatni.length}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
        </dl>
    `;

    document.getElementById('issueMain').innerHTML = [
        ...centerfoldy.map(a => `
            <section class="issue-album">
                <div class="album-header">
                    <h4>Centerfold</h4>
                    ${odkazNaModelku(a)}
                </div>
                ${htmlPopisuAlba(a)}
                <div class="posters">${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU, `data-index="${index(p)}"`)).join('')}</div>
            </section>
        `),
        ...ostatni.map(a => `
            <section class="issue-album">
                <div class="album-header">
                    <h4>${esc(a.album)}</h4>
                    <span>${esc(a.typ)} · ${sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek')}</span>
                    ${odkazNaModelku(a)}
                </div>
                ${htmlPopisuAlba(a)}
                <div class="photos-grid" ${atributyMrizky(a)}>
                    ${a.polozky.map(p => `
                        <div class="photo-item" data-index="${index(p)}">
                            <img src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
                            ${htmlSrdickaFotky(p, index(p))}
                        </div>
                    `).join('')}
                </div>
            </section>
        `),
    ].join('') || '<p class="empty-state">K tomuto vydání zatím není přiřazený žádný centerfold ani pictorial. Centerfold se přiřadí měsícem a rokem, pictorial v úpravě alba.</p>';

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
}

// Fotograf, jehož alba ukazuje stránka (jinak null a stránka ukazuje vydání)
let aktualniFotograf = null;
const listaStranky = vytvoritListuStranky(document.getElementById('issueNav'), document.getElementById('issueMain'));
const sklonovatPocet = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n > 1 && n < 5 ? dve : pet}`;

// Obnovení stránky vydání, ročníku nebo fotografa po změně
function obnovitStranku() {
    if (aktualniFotograf) otevritFotografa(aktualniFotograf, { bezHistorie: true });
    else otevritVydani(aktualniVydani, { bezHistorie: true });
}

// Dlaždice fotky na stránce vydání, ročníku, fotografa a v Nejlepších
const htmlDlazdice = (p, index) => `
    <div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}">
        <img src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" loading="lazy" draggable="false" />
        ${htmlSrdickaFotky(p, index)}
    </div>`;

// Album na stránce ročníku nebo fotografa: hlavička s modelkami, text a fotky (centerfold a cover jako plakát)
function htmlAlbaStranky(a, index, { nadpis = nazevAlba(a.album, a.typ), sVydanim = false } = {}) {
    const plakat = a.typ === 'Centerfold' || a.typ === 'Cover';
    const modelky = [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky].filter(m => m.jmeno)
        .map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil modelky">${esc(m.jmeno)}</button>`).join(' ');
    const vydani = a.typ === 'Centerfold' || a.typ === 'Cover' ? a.album : a.vydani;
    return `
        <section class="issue-album">
            <div class="album-header">
                <h4>${esc(nadpis)}</h4>
                <span>${esc(a.typ)}${plakat ? '' : ` · ${sklonovatPocet(a.fotky.length, 'fotka', 'fotky', 'fotek')}`}</span>
                ${sVydanim && vydani ? `<button class="chip" data-vydani="${esc(vydani)}" title="Otevřít vydání">${esc(nazevVydani(vydani))}</button>` : ''}
                ${modelky}
            </div>
            ${htmlPopisuAlba(a)}
            ${plakat
                ? `<div class="posters">${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`, true)).join('')}</div>`
                : `<div class="photos-grid" ${atributyMrizky(a)}>${a.polozky.map(p => htmlDlazdice(p, index(p))).join('')}</div>`}
        </section>`;
}

// Ročník: všechna čísla roku po měsících a pictorialy přiřazené jen k ročníku; lišta měsíců nahoře
function vykreslitRocnik(vydani, fotky) {
    const casti = rozlozitVydani(vydani);
    const mesic = a => rozlozitVydani(a.typ === 'Centerfold' || a.typ === 'Cover' ? a.album : a.vydani)?.mesic || '';
    const poradiTypu = { Cover: 0, Centerfold: 1 };
    const alba = sestavitAlba(fotky).sort((x, y) => (mesic(x) || '99').localeCompare(mesic(y) || '99') || (poradiTypu[x.typ] ?? 2) - (poradiTypu[y.typ] ?? 2));
    vydaniPolozky = alba.flatMap(a => a.polozky);
    const index = p => vydaniPolozky.indexOf(p);

    const podleMesicu = new Map();
    alba.forEach(a => {
        if (!podleMesicu.has(mesic(a))) podleMesicu.set(mesic(a), []);
        podleMesicu.get(mesic(a)).push(a);
    });
    const cisel = [...podleMesicu.keys()].filter(Boolean).length;
    const pocet = typ => alba.filter(a => typ === 'Pictorial' ? a.typ !== 'Cover' && a.typ !== 'Centerfold' : a.typ === typ).length;

    document.getElementById('issueSide').innerHTML = `
        <h2>Ročník ${esc(nazevVydani(vydani))}</h2>
        <div class="issue-add"><button class="chip" data-pridat="pictorial">+ pictorial</button></div>
        <dl class="profile-info">
            <div><dt>Čísel ve sbírce</dt><dd>${cisel} z 12</dd></div>
            <div><dt>Coverů</dt><dd>${pocet('Cover')}</dd></div>
            <div><dt>Centerfoldů</dt><dd>${pocet('Centerfold')}</dd></div>
            <div><dt>Pictorialů</dt><dd>${pocet('Pictorial')}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
        </dl>
    `;
    const nazevMesice = m => m ? MESICE[parseInt(m) - 1] : 'Celý ročník';
    document.getElementById('issueMain').innerHTML = [...podleMesicu].map(([m, albaMesice]) => `
        <section class="issue-month" data-cast="${m || 'rok'}">
            <h3>${esc(nazevMesice(m))}
                ${m ? `<button class="chip" data-vydani="${esc(slozitVydani(casti.rok, m, casti.edice))}" title="Otevřít číslo">Otevřít číslo</button>` : ''}</h3>
            ${albaMesice.map(a => htmlAlbaStranky(a, index, { nadpis: a.typ === 'Cover' ? 'Cover' : a.typ === 'Centerfold' ? 'Centerfold' : nazevAlba(a.album, a.typ) })).join('')}
        </section>
    `).join('') || '<p class="empty-state">Z tohoto ročníku zatím ve sbírce nic není.</p>';
    listaStranky.naplnit([...podleMesicu].map(([m, albaMesice]) => ({ klic: m || 'rok', nazev: nazevMesice(m), pocet: albaMesice.reduce((s, a) => s + a.fotky.length, 0) })));

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
    listaStranky.sledovat();
}

// Stránka fotografa: jeho alba napříč modelkami, chronologicky
async function otevritFotografa(jmeno, { bezHistorie = false } = {}) {
    if (!bezHistorie) zapamatovatMisto({ fotograf: jmeno });
    const moje = ++cisloNacteni;
    const fotky = await GetAlbaFotografa(jmeno) || [];
    if (moje !== cisloNacteni) return;
    aktualniFotograf = jmeno;
    ukazatPohled(issueView);
    document.querySelector('main').scrollTop = 0;

    const alba = sestavitAlba(fotky).sort((x, y) => {
        const v = a => (a.typ === 'Centerfold' || a.typ === 'Cover' ? a.album : a.vydani) || '9999';
        return v(x).localeCompare(v(y));
    });
    vydaniPolozky = alba.flatMap(a => a.polozky);
    const index = p => vydaniPolozky.indexOf(p);
    const modelek = new Set(alba.flatMap(a => [a.modelkaId, ...a.dalsiModelky.map(m => m.id)])).size;

    document.getElementById('issueSide').innerHTML = `
        <h2>${esc(jmeno)}</h2>
        <p class="profile-aliases">fotograf</p>
        <dl class="profile-info">
            <div><dt>Alb</dt><dd>${alba.length}</dd></div>
            <div><dt>Modelek</dt><dd>${modelek}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
        </dl>
    `;
    document.getElementById('issueMain').innerHTML = alba.map((a, i) => `<div data-cast="${i}">${htmlAlbaStranky(a, index, { sVydanim: true })}</div>`).join('')
        || '<p class="empty-state">Fotograf zatím nemá žádné album.</p>';
    listaStranky.naplnit(alba.map((a, i) => ({ klic: i, nazev: `${a.jmenoModelky} – ${nazevAlba(a.album, a.typ)}`, pocet: a.fotky.length })));

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
    listaStranky.sledovat();
}

// Přidávání přímo ze stránky vydání: vydání je předvyplněné, vybírá se jen modelka
issueView.addEventListener('click', (e) => {
    const pridat = e.target.closest('[data-pridat]')?.dataset.pridat;
    if (!pridat) return;
    e.stopPropagation();
    if (pridat === 'cover') otevritCoverModal(null, aktualniVydani);
    else if (pridat === 'centerfold') pridatCenterfold(aktualniVydani);
    else pridatPictorial(aktualniVydani);
});

issueView.addEventListener('click', (e) => {
    if (e.target.closest('[data-modelka], [data-vydani], .hearts') || rozbalitKliknute(e)) return;
    const polozka = e.target.closest('[data-index]');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, vydaniPolozky);
});

// Kalendář vydání: roky × měsíce. Prázdná políčka ukazují, co ve sbírce chybí.
const ZKRATKY_MESICU = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

let kalendarData = null;

async function nacistKalendar(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const kalendar = zMezipameti && kalendarData ? kalendarData : await GetKalendar() || [];
    kalendarData = kalendar;
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(calendar);

    // Vydání zvolené edice; pictorial přiřazený jen k ročníku nemá v kalendáři své políčko
    const vydani = new Map();
    kalendar.forEach(k => {
        const casti = rozlozitVydani(k.vydani);
        if (casti?.mesic && casti.edice === kalendarEdice) vydani.set(k.vydani, k);
    });

    const prepinacEdic = `<div class="cal-editions">${EDICE.map(e => `<button class="chip ${e === kalendarEdice ? 'active' : ''}" data-edice="${e}">${e}</button>`).join('')}</div>`;
    if (vydani.size === 0) {
        listaKalendare.naplnit([]);
        calList.innerHTML = prepinacEdic + `<div class="empty-state">V edici ${kalendarEdice} zatím nic není. Kalendář se naplní covery, centerfoldy a pictorialy, které mají měsíc a rok vydání; prázdné políčko se objeví u prvního přidaného čísla.</div>`;
        return;
    }

    const roky = [...vydani.keys()].map(v => parseInt(v.slice(0, 4)));
    const hledat = dotaz.trim();
    const rokyKalendare = [];
    for (let rok = Math.max(...roky); rok >= Math.min(...roky); rok--) {
        if (hledat && !String(rok).includes(hledat)) continue;

        let obsazeno = 0;
        const policka = ZKRATKY_MESICU.map((zkratka, i) => {
            const klic = slozitVydani(String(rok), String(i + 1).padStart(2, '0'), kalendarEdice);
            const v = vydani.get(klic);
            if (!v) {
                return `<button class="cal-cell empty" data-prazdne="${klic}" title="${nazevVydani(klic)} – chybí, klikni pro přidání"><span class="cal-month">${zkratka}</span></button>`;
            }
            obsazeno++;
            const popis = [v.cover && 'cover', v.centerfold && `centerfold: ${v.modelka}`, v.pictorial && 'pictorial'].filter(Boolean).join(', ');
            return `
                <button class="cal-cell" data-vydani="${klic}" title="${esc(nazevVydani(klic))} – ${esc(popis)}">
                    <img src="${esc(obrazek(v.nahled, 'w300'))}" loading="lazy" draggable="false" />
                    <span class="cal-month">${zkratka}</span>
                    <span class="cal-dots">
                        <i class="${v.cover ? 'on' : ''}"></i><i class="${v.centerfold ? 'on' : ''}"></i><i class="${v.pictorial ? 'on' : ''}"></i>
                    </span>
                </button>
            `;
        }).join('');
        rokyKalendare.push({ rok, obsazeno, policka });
    }

    // Souvislá řada aspoň dvou prázdných roků se sbalí do jednoho řádku (při hledání roku ne)
    const radky = [];
    const desetileti = new Map();
    const oznacitDekadu = (rok, obsazeno) => {
        const dekada = Math.floor(rok / 10) * 10;
        const prvni = !desetileti.has(dekada);
        desetileti.set(dekada, (desetileti.get(dekada) || 0) + obsazeno);
        return prvni ? `data-cast="${dekada}"` : '';
    };
    for (let i = 0; i < rokyKalendare.length; i++) {
        let konec = i;
        while (!hledat && konec + 1 < rokyKalendare.length && rokyKalendare[i].obsazeno === 0 && rokyKalendare[konec + 1].obsazeno === 0) konec++;
        const klicMezery = `${rokyKalendare[konec].rok}-${rokyKalendare[i].rok}`;
        if (konec > i && !rozbaleneMezery.has(klicMezery)) {
            const odRoku = rokyKalendare[konec].rok, doRoku = rokyKalendare[i].rok;
            radky.push(`
                <section class="cal-gap" ${oznacitDekadu(doRoku, 0)}>
                    <button class="cal-gap-btn" data-mezera="${klicMezery}" title="Rozbalit">${odRoku}–${doRoku} · ${konec - i + 1} ${konec - i + 1 < 5 ? 'roky' : 'roků'} bez jediného čísla</button>
                </section>
            `);
            i = konec;
            continue;
        }
        const { rok, obsazeno, policka } = rokyKalendare[i];
        radky.push(`
            <section class="cal-year" ${oznacitDekadu(rok, obsazeno)}>
                <div class="cal-year-label"><button class="link cal-year-link" data-vydani="${slozitVydani(String(rok), '', kalendarEdice)}" title="Celý ročník"><strong>${rok}</strong></button><span>${obsazeno} z 12</span></div>
                <div class="cal-months">${policka}</div>
            </section>
        `);
    }

    listaKalendare.naplnit([...desetileti].map(([dekada, pocet]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet })));
    calList.innerHTML = prepinacEdic + `
        <p class="cal-legend">Tečky v políčku: <i class="on"></i> cover <i class="on"></i> centerfold <i class="on"></i> pictorial. Prázdné políčko = vydání ve sbírce chybí.</p>
        ${radky.join('') || '<div class="empty-state">Hledanému roku neodpovídá žádné vydání.</div>'}
    `;
    listaKalendare.sledovat();
}

// Kalendář ukazuje jednu edici; volba se pamatuje
let kalendarEdice = VYCHOZI_EDICE;
try { kalendarEdice = EDICE.includes(localStorage.getItem('kalendarEdice')) ? localStorage.getItem('kalendarEdice') : VYCHOZI_EDICE; } catch { /* výchozí edice */ }

function nastavitEdiciKalendare(edice) {
    if (!EDICE.includes(edice)) return;
    kalendarEdice = edice;
    try { localStorage.setItem('kalendarEdice', edice); } catch { /* jen se nezapamatuje */ }
}

// Co jde přidat k jednomu vydání; nabízí prázdné políčko kalendáře i pravé tlačítko na něm
const pridatKVydani = klic => [
    { text: `Přidat cover: ${nazevVydani(klic)}`, akce: () => otevritCoverModal(null, klic) },
    { text: `Přidat centerfold: ${nazevVydani(klic)}`, akce: () => pridatCenterfold(klic) },
    { text: `Přidat pictorial: ${nazevVydani(klic)}`, akce: () => pridatPictorial(klic) },
];

// Rozbalené řady prázdných roků (klíč „od-do")
const rozbaleneMezery = new Set();

calendar.addEventListener('click', (e) => {
    const mezera = e.target.closest('[data-mezera]');
    if (mezera) {
        rozbaleneMezery.add(mezera.dataset.mezera);
        nacistKalendar(searchInput.value, true);
        return;
    }
    const edice = e.target.closest('[data-edice]');
    if (edice) {
        nastavitEdiciKalendare(edice.dataset.edice);
        nacistKalendar(searchInput.value, true);
        return;
    }
    const prazdne = e.target.closest('[data-prazdne]');
    if (!prazdne) return;
    e.stopPropagation();
    const misto = prazdne.getBoundingClientRect();
    otevritKontextovouNabidku(misto.left, misto.bottom + 4, pridatKVydani(prazdne.dataset.prazdne));
});

// Přehled sbírky: kolik čeho je a co ještě chybí doplnit.
// Každá modelka a každé vydání má jeden řádek, sloupce říkají, co u nich chybí.
// Údaje modelky, které přehled hlídá, po skupinách shodných se záložkami formuláře: [vlastnost, název, pole formuláře].
// Další jména a poznámka se nehlídají, většina modelek je mít nemusí.
const SKUPINY_UDAJU = [
    { nazev: 'Základní údaje', zalozka: 0, udaje: [
        ['narozeniDatum', 'datum narození', 'inputNarozeniDatum'],
        ['narozeniMisto', 'místo narození', 'inputNarozeniMisto'],
        ['narodnost', 'národnost', 'inputNarodnost'],
        ['etnicita', 'etnicita', 'inputEtnicita'],
    ] },
    { nazev: 'Vzhled a míry', zalozka: 1, udaje: [
        ['vyskaCm', 'výška', 'inputVyska'],
        ['vahaKg', 'váha', 'inputVaha'],
        ['vlasyBarva', 'barva vlasů', 'inputVlasy'],
        ['ociBarva', 'barva očí', 'inputOci'],
        ['ochlupeni', 'ochlupení', 'selectOchlupeni'],
        ['tetovani', 'tetování', 'selectTetovani'],
        ['piercing', 'piercing', 'selectPiercing'],
        ['obvodHrudnikCm', 'hrudník', 'inputHrudnik'],
        ['obvodPasCm', 'pas', 'inputPas'],
        ['obvodBokyCm', 'boky', 'inputBoky'],
        ['velikostPrsou', 'velikost prsou', 'inputVelikost'],
        ['prsaTyp', 'typ prsou', 'selectPrsaTyp'],
    ] },
    { nazev: 'Zařazení', zalozka: 2, udaje: [
        ['role', 'role', 'inputRole'],
        ['tags', 'tagy', 'inputTags'],
    ] },
];


// Modelky a jejich nedoplněná alba pro akce v buňkách přehledu
let prehledModelky = new Map();
let prehledAlba = new Map();
// Pořadí modelek v tabulce pro „Uložit a další"
let prehledPoradi = [];
// Zobrazit i údaje označené „netýká se" (aby šlo označení zrušit) a kolik řádků tabulek ukázat
let prehledSkryte = false;
let prehledLimit = 60;
// Klíč „netýká se" podle záložky formuláře
const KLICE_SKUPIN = ['zakladni', 'vzhled', 'zarazeni'];

async function nacistPrehled() {
    const moje = ++cisloNacteni;
    const [p, vsechnyModelky] = await Promise.all([GetPrehled(prehledSkryte), GetModelky('')]);
    if (moje !== cisloNacteni) return;
    prehledModelky = new Map((vsechnyModelky || []).map(m => [m.id, m]));
    zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const dlazdice = (cislo, popis) => `<div class="stat-tile"><strong>${cislo}</strong><span>${popis}</span></div>`;
    const ano = '<td class="ok" title="V pořádku">&#10003;</td>';
    // Buňka s chybějícím údajem je zároveň tlačítko, které ho nabídne doplnit
    const chybi = (akce, napoveda, klic = akce) => `<td class="chybi" data-akce="${akce}" data-klic="${klic}" title="${napoveda} (pravým tlačítkem: netýká se)">chybí</td>`;
    // Údaj označený „netýká se": nesleduje se; pravým tlačítkem jde označení zrušit
    const netyka = klic => `<td class="netyka" data-klic="${klic}" data-netyka="1" title="Netýká se – pravým tlačítkem jde znovu sledovat">—</td>`;
    const netykaModelky = id => new Set((prehledModelky.get(id)?.netykaSe || '').split(',').filter(Boolean));
    const NAPOVEDY = {
        titulni: 'Doplnit titulní fotku',
        centerfold: 'Přidat centerfold',
        hodnoceni: 'Otevřít profil a ohodnotit',
    };
    const zbytek = (pocet) => pocet > prehledLimit ? `<p class="stat-note">Zobrazeno ${prehledLimit} z ${pocet}. <button class="link" data-vice>Zobrazit dalších ${Math.min(60, pocet - prehledLimit)}</button></p>` : '';

    // Modelky: co chybí přímo u nich a kolik jejich alb nemá text nebo vydání
    const modelky = new Map();
    const radek = (m) => {
        if (!modelky.has(m.modelkaId)) modelky.set(m.modelkaId, { id: m.modelkaId, jmeno: m.jmeno, chybi: new Set(), bezPopisu: [], bezVydani: [], netyka: netykaModelky(m.modelkaId) });
        return modelky.get(m.modelkaId);
    };
    [['titulni', p.bezTitulni], ['centerfold', p.bezCenterfoldu], ['hodnoceni', p.bezHodnoceni]]
        .forEach(([co, seznam]) => seznam.forEach(m => radek(m).chybi.add(co)));
    // Údaje z formuláře: které v každé skupině chybí
    prehledModelky.forEach(m => {
        const netykaSe = netykaModelky(m.id);
        const chybejici = SKUPINY_UDAJU.map((s, i) => netykaSe.has(KLICE_SKUPIN[i]) && !prehledSkryte ? [] : s.udaje.filter(([vlastnost]) => udajChybi(m, vlastnost)));
        if (chybejici.some(skupina => skupina.length)) radek({ modelkaId: m.id, jmeno: m.jmeno }).udaje = chybejici;
    });
    p.albaBezPopisu.forEach(a => radek(a).bezPopisu.push(a));
    p.albaBezVydani.forEach(a => radek(a).bezVydani.push(a));
    prehledAlba = new Map([...modelky].map(([id, m]) => [id, { popis: m.bezPopisu, vydani: m.bezVydani }]));

    const vaha = m => [...m.chybi].filter(k => !m.netyka.has(k)).length
        + (m.bezPopisu.some(a => !a.netykaSe) ? 1 : 0) + (m.bezVydani.some(a => !a.netykaSe) ? 1 : 0)
        + (m.udaje || []).reduce((soucet, skupina, i) => soucet + (m.netyka.has(KLICE_SKUPIN[i]) ? 0 : skupina.length), 0);
    // Skupina údajů: počet chybějících, v nápovědě jejich výčet; klik otevře formulář na první z nich
    const skupina = (m, i) => {
        if (m.netyka.has(KLICE_SKUPIN[i])) return netyka(KLICE_SKUPIN[i]);
        const chybejici = m.udaje?.[i] || [];
        if (!chybejici.length) return ano;
        const vse = chybejici.length === SKUPINY_UDAJU[i].udaje.length;
        return `<td class="chybi" data-akce="udaje" data-klic="${KLICE_SKUPIN[i]}" data-zalozka="${SKUPINY_UDAJU[i].zalozka}" data-pole="${chybejici[0][2]}"
            title="Chybí: ${esc(chybejici.map(u => u[1]).join(', '))}">${vse ? 'chybí vše' : `chybí ${chybejici.length} z ${SKUPINY_UDAJU[i].udaje.length}`}</td>`;
    };
    // Bez skrytých jen modelky, kterým něco opravdu chybí
    const radkyModelek = [...modelky.values()].filter(m => prehledSkryte || vaha(m) > 0)
        .sort((a, b) => vaha(b) - vaha(a) || a.jmeno.localeCompare(b.jmeno, 'cs'));
    prehledPoradi = radkyModelek.map(m => m.id);
    const alba = (seznam, akce) => {
        const aktivni = seznam.filter(a => !a.netykaSe);
        if (aktivni.length) return `<td class="chybi" data-akce="${akce}" data-klic="${akce === 'popis' ? 'text' : 'vydani'}" title="Doplnit: ${esc(aktivni.map(a => nazevAlba(a.album, a.typ)).join(', '))} (pravým tlačítkem: netýká se)">${aktivni.length}</td>`;
        return seznam.length ? netyka(akce === 'popis' ? 'text' : 'vydani') : ano;
    };
    const bunkaModelky = (m, klic) => m.netyka.has(klic) ? netyka(klic) : m.chybi.has(klic) ? chybi(klic, NAPOVEDY[klic]) : ano;

    // Vydání, kterým chybí cover nebo centerfold
    const vydani = new Map();
    p.vydaniBezCoveru.forEach(v => vydani.set(v, { cover: true }));
    p.vydaniBezCenterfoldu.forEach(v => vydani.set(v, { ...vydani.get(v), centerfold: true }));
    const radkyVydani = [...vydani].sort(([a], [b]) => b.localeCompare(a));

    stats.innerHTML = `
        <div class="stat-tiles">
            ${dlazdice(p.modelek, 'modelek')}
            ${dlazdice(p.alb, 'alb')}
            ${dlazdice(p.fotek, 'fotek')}
            ${dlazdice(p.hodnocenychFotek, 'fotek se srdíčky')}
            ${dlazdice(p.coveru, 'coverů')}
            ${dlazdice(p.vydani, 'vydání')}
        </div>

        <section class="stat-section">
            <h3>Modelky <span>${p.modelek - radkyModelek.filter(m => vaha(m) > 0).length} z ${p.modelek} má vše vyplněné</span>
                <button class="link stat-toggle" data-skryte>${prehledSkryte ? 'Skrýt údaje „netýká se“' : 'Zobrazit i údaje „netýká se“'}</button></h3>
            ${radkyModelek.length ? `
            <table class="stat-table">
                <thead><tr>
                    <th>Modelka</th><th>Titulní fotka</th>${SKUPINY_UDAJU.map(s => `<th title="${esc(s.udaje.map(u => u[1]).join(', '))}">${s.nazev}</th>`).join('')}<th>Centerfold</th><th>Hodnocení</th>
                    <th title="Počet alb bez průvodního textu">Alba bez textu</th><th title="Počet alb bez přiřazeného vydání">Alba bez vydání</th>
                </tr></thead>
                <tbody>
                    ${radkyModelek.slice(0, prehledLimit).map(m => `
                        <tr data-modelka="${m.id}" title="Otevřít profil">
                            <th>${esc(m.jmeno)}</th>
                            ${bunkaModelky(m, 'titulni')}
                            ${SKUPINY_UDAJU.map((s, i) => skupina(m, i)).join('')}
                            ${bunkaModelky(m, 'centerfold')}${bunkaModelky(m, 'hodnoceni')}
                            ${alba(m.bezPopisu, 'popis')}${alba(m.bezVydani, 'vydani')}
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(radkyModelek.length)}` : ''}
        </section>

        <section class="stat-section">
            <h3>Vydání <span>${p.vydani - radkyVydani.length} z ${p.vydani} má cover i centerfold</span></h3>
            ${radkyVydani.length ? `
            <table class="stat-table stat-table-narrow">
                <thead><tr><th>Vydání</th><th>Cover</th><th>Centerfold</th></tr></thead>
                <tbody>
                    ${radkyVydani.slice(0, prehledLimit).map(([v, co]) => `
                        <tr data-vydani="${esc(v)}" title="Otevřít vydání">
                            <th>${esc(nazevVydani(v))}</th>${co.cover ? chybi('cover', 'Přidat cover') : ano}${co.centerfold ? chybi('centerfold', 'Přidat centerfold') : ano}
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(radkyVydani.length)}` : ''}
        </section>

        ${p.rocniky.length ? `
        <section class="stat-section">
            <h3>Ročníky <span>které měsíce ve sbírce jsou</span></h3>
            <div class="stat-years">
                ${p.rocniky.map(r => `
                    <button class="stat-year" data-rocnik="${r.rok}" data-edice="${esc(r.edice)}" title="Zobrazit ročník ${r.rok} (${esc(r.edice)}) v kalendáři">
                        <strong>${r.rok}${r.edice !== VYCHOZI_EDICE ? ` <em>${esc(r.edice)}</em>` : ''}</strong><span>${r.vydani} z 12</span>
                        <span class="stat-months">${r.mesice.map((je, i) => `<i class="${je ? 'on' : ''}" title="${MESICE[i]}${je ? '' : ' – chybí'}"></i>`).join('')}</span>
                    </button>`).join('')}
            </div>
        </section>` : ''}

        ${p.podezrele.length ? `
        <section class="stat-section">
            <h3>Ke kontrole <span>údaje, které vypadají jako chyba při zadávání</span></h3>
            <table class="stat-table stat-table-text">
                <thead><tr><th>Modelka</th><th>Co zkontrolovat</th></tr></thead>
                <tbody>
                    ${p.podezrele.slice(0, prehledLimit).map(u => `
                        <tr data-modelka="${u.modelkaId}" title="Otevřít profil">
                            <th>${esc(u.jmeno)}</th><td class="stat-text">${esc(u.popis)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(p.podezrele.length)}
        </section>` : ''}
    `;
}

// Přepínač skrytých údajů a další stránka tabulek
stats.addEventListener('click', (e) => {
    if (e.target.closest('[data-skryte]')) {
        prehledSkryte = !prehledSkryte;
        nacistPrehled();
    } else if (e.target.closest('[data-vice]')) {
        prehledLimit += 60;
        nacistPrehled();
    }
});

// „Netýká se" u buňky: modelka (centerfold neměla, údaj nejde zjistit) nebo všechna alba v buňce
async function oznacitNetykaSe(bunka, netyka) {
    const radek = bunka.closest('tr');
    const modelkaId = parseInt(radek.dataset.modelka);
    const klic = bunka.dataset.klic;
    if (klic === 'text' || klic === 'vydani') {
        const alba = prehledAlba.get(modelkaId)?.[klic === 'text' ? 'popis' : 'vydani'] || [];
        for (const a of alba) await SetNetykaSeAlba(a.modelkaId, a.album, a.typ, klic, netyka);
    } else {
        await SetNetykaSe(modelkaId, klic, netyka);
    }
    nacistPrehled();
}

// Klik na ročník ho ukáže v kalendáři
stats.addEventListener('click', (e) => {
    const dlazdice = e.target.closest('[data-rocnik]');
    if (!dlazdice) return;
    nastavitEdiciKalendare(dlazdice.dataset.edice);
    prepnoutRezim('kalendar');
    searchInput.value = dlazdice.dataset.rocnik;
    nacistGalerii(dlazdice.dataset.rocnik);
});

// Klik na buňku „chybí" otevře rovnou místo, kde se údaj doplňuje; klik jinam do řádku otevírá profil nebo vydání
stats.addEventListener('click', async (e) => {
    const bunka = e.target.closest('td[data-akce]');
    if (!bunka) return;
    e.stopPropagation();
    const radek = bunka.closest('tr');
    const akce = bunka.dataset.akce;

    if (radek.dataset.vydani) {
        // Vydání je dané, u centerfoldu se vybírá jen modelka
        if (akce === 'cover') otevritCoverModal(null, radek.dataset.vydani);
        else pridatCenterfold(radek.dataset.vydani);
        return;
    }

    const modelka = prehledModelky.get(parseInt(radek.dataset.modelka));
    if (!modelka) return;
    if (akce === 'titulni') {
        otevritModelModal(modelka, { zalozka: 0 });
        document.getElementById('inputDriveID').focus();
    } else if (akce === 'udaje') {
        // Formulář se otevře na záložce skupiny, s kurzorem v prvním chybějícím poli
        otevritModelModal(modelka, { zalozka: parseInt(bunka.dataset.zalozka) });
        ukazatZalozku(parseInt(bunka.dataset.zalozka));
        document.getElementById(bunka.dataset.pole).focus();
    } else if (akce === 'centerfold') {
        otevritAlbumModal(modelka, null, { typ: 'Centerfold' });
        document.getElementById('selectAlbumMesic').focus();
    } else if (akce === 'hodnoceni') {
        otevritDetailModelky(modelka);
    } else {
        // První album, kterému text nebo vydání chybí, se otevře k úpravě v profilu modelky
        const cil = prehledAlba.get(modelka.id)?.[akce][0];
        await otevritDetailModelky(modelka);
        await nacistFotkyModelky(modelka.id);
        const album = cil && aktualniAlba.find(a => a.album === cil.album && a.typ === cil.typ);
        if (!album) return;
        otevritAlbumModal(modelka, album);
        document.getElementById(akce === 'popis' ? 'inputAlbumPopis' : 'selectAlbumMesic').focus();
    }
});

// Nejlepší: fotky s aspoň N srdíčky napříč sbírkou, po modelkách; prohlížeč jde přes všechny
let nejlepsiPolozky = [];
let nejlepsiData = null;
let nejlepsiMin = 4;
try { nejlepsiMin = parseInt(localStorage.getItem('nejlepsiMin')) || 4; } catch { /* výchozí 4 */ }
const listaNejlepsich = vytvoritListuStranky(document.getElementById('bestNav'), best);

async function nacistNejlepsi(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const fotky = zMezipameti && nejlepsiData ? nejlepsiData : await GetNejlepsiFotky(nejlepsiMin) || [];
    nejlepsiData = fotky;
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(best);

    // Každá fotka zvlášť, po modelkách (covery bez modelky na konci)
    const hledat = sjednotit(dotaz);
    nejlepsiPolozky = fotky.filter(f => !hledat || bezDiakritiky(f.jmenoModelky).includes(hledat)).map(f => ({
        fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni,
    }));
    const podleModelek = new Map();
    nejlepsiPolozky.forEach((p, i) => {
        const klic = p.jmenoModelky || 'Covery';
        if (!podleModelek.has(klic)) podleModelek.set(klic, { modelkaId: p.modelkaId, indexy: [] });
        podleModelek.get(klic).indexy.push(i);
    });

    const prah = [3, 4, 5].map(n => `<button class="chip ${n === nejlepsiMin ? 'active' : ''}" data-nejlepsi-min="${n}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('');
    document.getElementById('bestList').innerHTML = `
        <div class="best-toolbar">${prah}<span>${sklonovatPocet(nejlepsiPolozky.length, 'fotka', 'fotky', 'fotek')}</span>
            ${nejlepsiPolozky.length ? '<button class="btn btn-secondary btn-small" data-nejlepsi-slideshow>Spustit slideshow</button>' : ''}</div>
        ${[...podleModelek].map(([jmeno, { modelkaId, indexy }], i) => `
            <section class="best-model" data-cast="${i}">
                <div class="album-header">
                    <h4>${modelkaId ? `<button class="link" data-modelka="${modelkaId}" title="Otevřít profil">${esc(jmeno)}</button>` : esc(jmeno)}</h4>
                    <span>${sklonovatPocet(indexy.length, 'fotka', 'fotky', 'fotek')}</span>
                </div>
                <div class="photos-grid">${indexy.map(index => htmlDlazdice(nejlepsiPolozky[index], index)).join('')}</div>
            </section>
        `).join('') || `<p class="empty-state">${fotky.length || hledat ? 'Hledání neodpovídá žádná modelka.' : `Zatím žádná fotka nemá ${nejlepsiMin} a více srdíček. Fotky se hodnotí srdíčky na dlaždici nebo v prohlížeči klávesami 1–5.`}</p>`}
    `;
    listaNejlepsich.naplnit([...podleModelek].map(([jmeno, { indexy }], i) => ({ klic: i, nazev: jmeno, pocet: indexy.length })));
    listaNejlepsich.sledovat();
}

best.addEventListener('click', (e) => {
    const prah = e.target.closest('[data-nejlepsi-min]');
    if (prah) {
        nejlepsiMin = parseInt(prah.dataset.nejlepsiMin);
        try { localStorage.setItem('nejlepsiMin', String(nejlepsiMin)); } catch { /* jen se nezapamatuje */ }
        nacistNejlepsi(searchInput.value);
        return;
    }
    if (e.target.closest('[data-nejlepsi-slideshow]')) {
        otevritLightbox(0, true, nejlepsiPolozky);
        return;
    }
    if (e.target.closest('.hearts, [data-modelka]')) return;
    const dlazdice = e.target.closest('[data-index]');
    if (dlazdice) otevritLightbox(parseInt(dlazdice.dataset.index), false, nejlepsiPolozky);
});

// Formulář coveru slouží pro přidání (polozka = null) i úpravu vydání
const coverModal = document.getElementById('coverModal');

function otevritCoverModal(polozka = null, predvyplnitVydani = '') {
    editovanyCover = polozka;
    document.getElementById('coverForm').reset();
    document.getElementById('coverModalTitle').textContent = polozka ? 'Upravit cover' : 'Přidat cover';
    document.getElementById('coverLinkLabel').textContent = polozka
        ? 'Nový odkaz z Google Disku (nepovinné, jinak zůstane původní obrázek)'
        : 'Odkaz na cover z Google Disku';
    document.getElementById('inputCoverLink').required = !polozka;

    const vydani = rozlozitVydani(polozka ? polozka.album : predvyplnitVydani);
    if (vydani?.mesic) {
        document.getElementById('inputCoverRok').value = vydani.rok;
        document.getElementById('selectCoverMesic').value = vydani.mesic;
    }
    // Bez předvyplněného vydání se nabídne edice zobrazená v kalendáři
    document.getElementById('selectCoverEdice').value = vydani?.edice || kalendarEdice;
    coverModal.classList.remove('hidden');
    // S předvyplněným vydáním zbývá jen vložit odkaz
    document.getElementById(vydani && !polozka ? 'inputCoverLink' : 'selectCoverMesic').focus();
}

document.getElementById('closeCoverModalBtn').onclick = () => coverModal.classList.add('hidden');
document.getElementById('coverForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const vydani = slozitVydani(document.getElementById('inputCoverRok').value, document.getElementById('selectCoverMesic').value, document.getElementById('selectCoverEdice').value);
    const odkaz = document.getElementById('inputCoverLink').value;
    if (jeOdkazNaSlozku(odkaz)) return;

    if (editovanyCover) {
        if (!await odkazJeVPoradku(odkaz)) return;
        if (!await UpdateCover(editovanyCover.fotky[0].id, vydani, odkaz)) {
            oznamit('Cover se nepodařilo uložit do databáze.');
            return;
        }
    } else {
        oznamitVlozeni(await AddCover(vydani, odkaz), 'coverů');
    }
    coverModal.classList.add('hidden');
    stenaData = coveryData = kalendarData = null;
    // Cover se přidává z přehledu coverů, z kalendáře, z přehledu sbírky a ze stránky vydání
    if (!issueView.classList.contains('hidden')) obnovitStranku();
    else nacistGalerii(searchInput.value);
});

async function otevritProfilPodleId(modelkaId) {
    const modelka = (await GetModelky('') || []).find(m => m.id === modelkaId);
    if (modelka) otevritDetailModelky(modelka);
}

wall.addEventListener('click', (e) => {
    const polozka = e.target.closest('.wall-item');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, stenaPolozky);
});

viewToggle.addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-rezim]');
    if (!tlacitko) return;
    // Přepnutí přehledu začíná novou historii
    historie.length = 0;
    prepnoutRezim(tlacitko.dataset.rezim);
    nacistGalerii(searchInput.value);
});

// Prohlížeč fotek: šipky vlevo a vpravo listují, nahoru a dolů (PgUp, PgDn) skáčou mezi alby,
// mezerník spouští slideshow, F rozkládá plakát, R otáčí, Esc zavírá
const lightbox = document.getElementById('lightbox');
const lbStage = document.getElementById('lbStage');
const lbProgress = document.getElementById('lbProgress');
const lbZoomBtn = document.getElementById('lbZoom');
const lbFillBtn = document.getElementById('lbFill');
// Interval slideshow v milisekundách; jde změnit v nabídce ⋯
let intervalSlideshow = 4000;
try { intervalSlideshow = parseInt(localStorage.getItem('intervalSlideshow')) || 4000; } catch { /* výchozí 4 s */ }
const LB_LISTA = 44; // výška horní lišty prohlížeče
let lbPolozky = [];
let lbIndex = 0;
let lbCasovac = null;
let lbPlakat = null;     // prvek .poster právě zobrazené položky
let lbPlne = false;      // všechny stránky jsou načtené v plném rozlišení
let lbRozlozeno = false; // plakát vyplní celé okno a posouvá se po délce
let lbPosun = 0;         // poloha rozloženého plakátu po délce (0–1)
let lbZobrazeno = { sirka: 0, presah: 0, osa: 'y' };
let lbLupa = null;       // obdélník plakátu v okamžiku zapnutí lupy
let lbTazeni = null;
let lbZmeneno = false;   // po zavření je potřeba překreslit přehled (změna otočení)

const lbOmezit = (hodnota, min, max) => Math.min(max, Math.max(min, hodnota));

// Rozměr plakátu ve zdrojových pixelech po otočení
function lbRozmer() {
    const r = lbPlakat?._rozmer;
    if (!r) return null;
    return lbPolozky[lbIndex].rotace % 180 ? { W: r.H, H: r.W } : r;
}

// Umístění plakátu: buď se vejde celý, nebo (rozložený) vyplní okno a přesahuje po délce
function lbRozvrhnout() {
    const r = lbRozmer();
    if (!r) return;
    const sw = lightbox.clientWidth;
    const sh = lightbox.clientHeight;
    const okrajX = sw > 560 ? 70 : 0;
    // Fotka, která se má vejít celá, nesmí zajíždět pod lištu alb
    const spodek = lbLista.nav.classList.contains('hidden') ? 16 : lbLista.nav.offsetHeight + 4;
    const meritko = lbRozlozeno
        ? Math.max(sw / r.W, sh / r.H)
        : Math.min((sw - 2 * okrajX) / r.W, (sh - LB_LISTA - spodek) / r.H);

    const w = r.W * meritko;
    const h = r.H * meritko;
    const presahX = Math.max(0, w - sw);
    const presahY = Math.max(0, h - sh);
    const left = presahX > 1 ? -lbPosun * presahX : (sw - w) / 2;
    const top = lbRozlozeno
        ? (presahY > 1 ? -lbPosun * presahY : (sh - h) / 2)
        : LB_LISTA + (sh - LB_LISTA - spodek - h) / 2;

    Object.assign(lbPlakat.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    lbZobrazeno = { sirka: w, presah: Math.max(presahX, presahY), osa: presahX > presahY ? 'x' : 'y' };
    lbAktualizovatTlacitka();
}

// Kolikrát jde plakát zvětšit, než se zobrazí ve skutečném rozlišení
function lbMeritkoLupy() {
    const r = lbRozmer();
    return lbPlne && r && lbZobrazeno.sirka ? r.W / lbZobrazeno.sirka : 1;
}

// Lupa je dostupná jen tehdy, když má fotka výrazně vyšší rozlišení, než v jakém je zobrazená
function lbAktualizovatTlacitka() {
    // Dokud není stažený originál, není známo, zda má fotka vyšší rozlišení; lupa ho na vyžádání načte
    const lupaDostupna = !lbPlne || lbMeritkoLupy() >= 1.15;
    lbZoomBtn.disabled = !lupaDostupna;
    lbZoomBtn.title = lupaDostupna ? 'Lupa (klik na fotku)' : 'Fotka nemá vyšší rozlišení';
    lbPlakat?.classList.toggle('zoomable', lupaDostupna);
    lbFillBtn.classList.toggle('active', lbRozlozeno);
    lightbox.classList.toggle('filled', lbRozlozeno && lbZobrazeno.presah > 1);
}

function lbPosunoutLupu(e) {
    if (!lbLupa) return;
    const x = lbOmezit((e.clientX - lbLupa.left) / lbLupa.width * 100, 0, 100);
    const y = lbOmezit((e.clientY - lbLupa.top) / lbLupa.height * 100, 0, 100);
    lbPlakat.style.transformOrigin = `${x}% ${y}%`;
}

// Velikost obrázku pro prohlížení: podle delší strany okna, po krocích, aby drobná změna okna nestahovala znovu.
// Originál (často mnohonásobně větší) se stahuje až pro lupu.
function lbVelikost(polozka) {
    const strana = Math.max(lightbox.clientWidth, lightbox.clientHeight) * (window.devicePixelRatio || 1);
    // Rozložený centerfold přesahuje okno po délce
    const cil = polozka.typ === 'Centerfold' ? strana * 2 : strana;
    return `s${Math.min(3200, Math.max(800, Math.ceil(cil / 400) * 400))}`;
}

let lbCekaNaOriginal = null; // místo, kde se má zapnout lupa, až dorazí originál

function lbNacistOriginal() {
    const plakat = lbPlakat;
    if (!plakat || plakat.dataset.original) return;
    plakat.dataset.original = '1';
    const obrazky = [...plakat.querySelectorAll('img')];
    lbPolozky[lbIndex].fotky.forEach((f, i) => {
        const plna = new Image();
        plna.onload = () => {
            if (lbPlakat !== plakat) return;
            obrazky[i].dataset.plne = '1';
            obrazky[i].src = plna.src;
        };
        plna.onerror = () => {
            if (lbPlakat !== plakat) return;
            lbCekaNaOriginal = null;
            delete plakat.dataset.original;
            lightbox.classList.remove('nacita');
            oznamit('Originál fotky se nepodařilo načíst.');
        };
        plna.src = obrazek(f.url, PLNE_ROZLISENI);
    });
}

function lbPrepnoutLupu(zapnout, e) {
    if (!lbPlakat) return;
    if (zapnout && !lbPlne) {
        // Bez události myši (tlačítko v liště) se zvětší střed okna
        lbCekaNaOriginal = e ? { clientX: e.clientX, clientY: e.clientY } : { clientX: lightbox.clientWidth / 2, clientY: lightbox.clientHeight / 2 };
        lightbox.classList.add('nacita');
        lbNacistOriginal();
        return;
    }
    if (zapnout && lbMeritkoLupy() < 1.15) return;

    if (zapnout) {
        lbPrepnoutSlideshow(false);
        lbLupa = lbPlakat.getBoundingClientRect();
        // Bez události myši (tlačítko v liště) se zvětší střed okna
        lbPosunoutLupu(e || { clientX: lightbox.clientWidth / 2, clientY: lightbox.clientHeight / 2 });
        lbPlakat.style.transform = `scale(${lbMeritkoLupy()})`;
    } else {
        lbLupa = null;
        lbPlakat.style.transform = '';
    }
    lightbox.classList.toggle('zoomed', zapnout);
}

function lbPrepnoutRozlozeni(zapnout = !lbRozlozeno) {
    lbPrepnoutLupu(false);
    lbRozlozeno = zapnout;
    lbPosun = 0;
    lbRozvrhnout();
}

async function lbOtocit() {
    const polozka = lbPolozky[lbIndex];
    if (!polozka || !lbPlakat) return;
    lbPrepnoutLupu(false);
    polozka.rotace = (polozka.rotace + 90) % 360;
    polozka.fotky.forEach(f => { f.rotace = polozka.rotace; });
    lbPlakat.dataset.rot = polozka.rotace;
    lbPosun = 0;
    lbRozvrhnout();
    lbZmeneno = true;
    await SetRotaceFotek(polozka.fotky.map(f => f.id), polozka.rotace);
}

function lbZobrazit(index) {
    const pocet = lbPolozky.length;
    if (pocet === 0) {
        zavritLightbox();
        return;
    }
    lbIndex = (index + pocet) % pocet;
    const polozka = lbPolozky[lbIndex];

    lbLupa = null;
    lbPlne = false;
    lbCekaNaOriginal = null;
    lbPosun = 0;
    lightbox.classList.remove('zoomed', 'nacita');
    // Centerfold se otevírá rovnou rozložený přes celé okno
    lbRozlozeno = polozka.typ === 'Centerfold';

    // Nejdřív náhled z mezipaměti, obrázek ve velikosti okna se doplní po načtení
    lbStage.innerHTML = htmlPlakatu(polozka, polozka.typ === 'Centerfold' ? VELIKOST_PLAKATU_MALA : VELIKOST_NAHLEDU);
    const plakat = lbStage.firstElementChild;
    lbPlakat = plakat;
    const obrazky = [...plakat.querySelectorAll('img')];

    pripravitPlakat(plakat, () => {
        if (lbPlakat !== plakat) return;
        lbPlne = obrazky.every(o => o.dataset.plne && o.complete && o.naturalWidth);
        // Lupa se po výměně za ostřejší obrázek nesmí rozhodit
        if (!lbLupa) lbRozvrhnout();
        // Lupa vyžádaná dřív, než dorazil originál, se zapne teď
        if (lbPlne && lbCekaNaOriginal) {
            const kde = lbCekaNaOriginal;
            lbCekaNaOriginal = null;
            lightbox.classList.remove('nacita');
            if (lbMeritkoLupy() >= 1.15) lbPrepnoutLupu(true, kde);
            else oznamit('Fotka nemá vyšší rozlišení, než v jakém je zobrazená.');
        }
    });

    const velikost = lbVelikost(polozka);
    polozka.fotky.forEach((f, i) => {
        const vetsi = new Image();
        vetsi.onload = () => {
            // Originál, který mezitím dorazil kvůli lupě, se menším obrázkem nepřepisuje
            if (lbPlakat !== plakat || obrazky[i].dataset.plne) return;
            obrazky[i].src = vetsi.src;
        };
        vetsi.src = obrazek(f.url, velikost);
    });

    document.getElementById('lbCaption').textContent =
        [polozka.jmenoModelky, nazevAlba(polozka.album, polozka.typ), polozka.typ].filter(Boolean).join(' · ');
    document.getElementById('lbCounter').textContent = `${lbIndex + 1} / ${pocet}`;
    lbVykreslitSrdicka();
    lbLista.oznacit(lbZacatkyAlb().filter(i => i <= lbIndex).pop());
    lbAktualizovatTlacitka();

    // Přednačtení další položky, aby listování neproblikávalo
    const dalsi = lbPolozky[(lbIndex + 1) % pocet];
    dalsi.fotky.forEach(f => { new Image().src = obrazek(f.url, lbVelikost(dalsi)); });

    if (lbCasovac) lbSpustitCasovac();
}

function lbVykreslitSrdicka() {
    document.getElementById('lbHearts').innerHTML = htmlSrdicek(lbPolozky[lbIndex].hodnoceni, '');
}

// Hodnocení právě zobrazené fotky; pořadí v přehledu se podle něj upraví po zavření prohlížeče
async function lbOhodnotit(zvoleno) {
    const polozka = lbPolozky[lbIndex];
    if (!polozka || !await ohodnotitPolozku(polozka, zvoleno)) return;
    lbZmeneno = true;
    if (lbPolozky[lbIndex] === polozka) lbVykreslitSrdicka();
}

document.getElementById('lbHearts').addEventListener('click', (e) => {
    const srdicko = e.target.closest('.heart');
    if (srdicko) lbOhodnotit(parseInt(srdicko.dataset.hodnota));
});

// Indexy prvních fotek jednotlivých alb v právě prohlíženém seznamu
function lbZacatkyAlb() {
    return zacatkyAlb(lbPolozky);
}

// Skok na první fotku předchozího nebo dalšího alba
function lbSkokAlba(smer) {
    const zacatky = lbZacatkyAlb();
    if (zacatky.length < 2) return;
    const soucasne = zacatky.filter(i => i <= lbIndex).length - 1;
    lbZobrazit(zacatky[(soucasne + smer + zacatky.length) % zacatky.length]);
}

// Lišta alb dole v prohlížeči: ukazuje, ve kterém albu listování je, a skáče na jiné
const lbLista = vytvoritListu(document.getElementById('lbNav'), klic => lbZobrazit(parseInt(klic)));

function lbNaplnitListu() {
    const zacatky = lbZacatkyAlb();
    // Kde je každá položka vlastním albem (stěna centerfoldů, covery) nebo je pořadí zamíchané, lišta nemá smysl
    const maSmysl = !lbPuvodniPoradi && zacatky.length > 1 && zacatky.length < lbPolozky.length;
    lbLista.naplnit(maSmysl ? zacatky.map((zacatek, i) => ({
        klic: zacatek,
        nazev: nazevAlba(lbPolozky[zacatek].album, lbPolozky[zacatek].typ),
        pocet: (zacatky[i + 1] ?? lbPolozky.length) - zacatek,
    })) : []);
}

function lbSpustitCasovac() {
    clearTimeout(lbCasovac);
    lbCasovac = setTimeout(() => lbZobrazit(lbIndex + 1), intervalSlideshow);
    lbProgress.style.animationDuration = `${intervalSlideshow}ms`;
    // Restart animace ukazatele průběhu
    lbProgress.classList.remove('running');
    void lbProgress.offsetWidth;
    lbProgress.classList.add('running');
}

function lbPrepnoutSlideshow(zapnout = !lbCasovac) {
    clearTimeout(lbCasovac);
    lbCasovac = null;
    lbProgress.classList.remove('running');
    if (zapnout) lbSpustitCasovac();
    document.getElementById('lbPlay').innerHTML = zapnout ? '&#10074;&#10074;' : '&#9654;';
}

// Zamíchané pořadí v prohlížeči; původní pořadí se po vypnutí vrátí
let lbPuvodniPoradi = null;

function lbZamichat() {
    const aktualni = lbPolozky[lbIndex];
    if (lbPuvodniPoradi) {
        lbPolozky = lbPuvodniPoradi;
        lbPuvodniPoradi = null;
    } else {
        lbPuvodniPoradi = lbPolozky;
        const ostatni = lbPolozky.filter(p => p !== aktualni);
        for (let i = ostatni.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ostatni[i], ostatni[j]] = [ostatni[j], ostatni[i]];
        }
        lbPolozky = [aktualni, ...ostatni];
    }
    document.getElementById('lbShuffle').classList.toggle('active', Boolean(lbPuvodniPoradi));
    lbNaplnitListu();
    lbZobrazit(lbPolozky.indexOf(aktualni));
}
document.getElementById('lbShuffle').onclick = lbZamichat;

function otevritLightbox(index, slideshow = false, polozky = aktualniPolozky) {
    if (polozky.length === 0) return;
    lbPuvodniPoradi = null;
    document.getElementById('lbShuffle').classList.remove('active');
    lbPolozky = polozky;
    lbZmeneno = false;
    lightbox.classList.remove('hidden');
    lbNaplnitListu();
    lbPrepnoutSlideshow(slideshow);
    lbZobrazit(index);
}

function zavritLightbox() {
    lbPrepnoutSlideshow(false);
    lightbox.classList.add('hidden');
    lightbox.classList.remove('zoomed', 'filled');
    lbStage.innerHTML = '';
    lbPlakat = null;
    lbLupa = null;

    // Otočení se má projevit i v přehledu pod prohlížečem
    if (lbZmeneno) {
        if (!detailView.classList.contains('hidden')) nacistFotkyModelky(aktualniModelka.id);
        else if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
        else if (!covers.classList.contains('hidden')) nacistCovery(searchInput.value);
        else if (!issueView.classList.contains('hidden')) obnovitStranku();
        else if (!best.classList.contains('hidden')) nacistNejlepsi(searchInput.value);
    }
}

document.getElementById('lbPrev').onclick = () => lbZobrazit(lbIndex - 1);
document.getElementById('lbNext').onclick = () => lbZobrazit(lbIndex + 1);
document.getElementById('lbPlay').onclick = () => lbPrepnoutSlideshow();
document.getElementById('lbRot').onclick = lbOtocit;
document.getElementById('lbClose').onclick = zavritLightbox;
lbFillBtn.onclick = () => lbPrepnoutRozlozeni();
lbZoomBtn.onclick = () => lbPrepnoutLupu(!lbLupa);

window.addEventListener('resize', () => {
    if (lightbox.classList.contains('hidden')) return;
    lbPrepnoutLupu(false);
    lbLista.upravitSipky();
    lbRozvrhnout();
});

// Rozložený plakát se posouvá tažením nebo kolečkem, lupa pohybem myši
lbStage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.target.closest('.poster')) return;
    lbTazeni = { x: e.clientX, y: e.clientY, posunuto: false };
});
window.addEventListener('pointermove', (e) => {
    if (lbLupa) {
        lbPosunoutLupu(e);
        return;
    }
    if (!lbTazeni || !lbRozlozeno || lbZobrazeno.presah <= 1) return;
    const rozdil = lbZobrazeno.osa === 'x' ? e.clientX - lbTazeni.x : e.clientY - lbTazeni.y;
    if (Math.abs(rozdil) < 4 && !lbTazeni.posunuto) return;
    lbPosun = lbOmezit(lbPosun - rozdil / lbZobrazeno.presah, 0, 1);
    lbTazeni = { x: e.clientX, y: e.clientY, posunuto: true };
    lbRozvrhnout();
});

lightbox.addEventListener('click', (e) => {
    const tazeno = lbTazeni?.posunuto;
    lbTazeni = null;
    // Tlačítko nesmí zůstat zaměřené, jinak by ho mezerník stiskl podruhé
    e.target.closest('button')?.blur();

    if (e.target.closest('.poster')) {
        // Klik na fotku přepíná lupu, konec tažení se za klik nepočítá
        if (!tazeno) lbPrepnoutLupu(!lbLupa, e);
    } else if (e.target === lightbox || e.target === lbStage) {
        zavritLightbox();
    }
});

lightbox.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (lbLupa) return;
    if (lbRozlozeno && lbZobrazeno.presah > 1) {
        lbPosun = lbOmezit(lbPosun + (e.deltaY || e.deltaX) / lbZobrazeno.presah, 0, 1);
        lbRozvrhnout();
    } else {
        // Touchpad posílá desítky událostí na jedno gesto; listuje se nejvýš jednou za čtvrt vteřiny
        if (Date.now() - lbPosledniKrokKoleckem < 250) return;
        lbPosledniKrokKoleckem = Date.now();
        lbZobrazit(lbIndex + (e.deltaY > 0 ? 1 : -1));
    }
}, { passive: false });
let lbPosledniKrokKoleckem = 0;

// Odkazy na vydání a na modelku fungují v profilu i na stránce vydání
document.querySelector('main').addEventListener('click', (e) => {
    const vydani = e.target.closest('[data-vydani]');
    const modelka = e.target.closest('[data-modelka]');
    const hodnota = e.target.closest('[data-hledat]');
    const fotograf = e.target.closest('[data-fotograf]');
    if (fotograf) otevritFotografa(fotograf.dataset.fotograf);
    else if (vydani) otevritVydani(vydani.dataset.vydani);
    else if (modelka) otevritProfilPodleId(parseInt(modelka.dataset.modelka));
    else if (hodnota) hledatHodnotu(hodnota.dataset.hledat);
});

// Výběr více fotek v profilu: Ctrl (Cmd) + klik přidá nebo odebere fotku, Shift + klik vybere úsek alba
const selectionBar = document.getElementById('selectionBar');
let posledniVybrana = null;

const vybraneDlazdice = () => [...document.querySelectorAll('#photosGrid .photo-item.vybrana')];

function aktualizovatVyber() {
    const pocet = vybraneDlazdice().length;
    selectionBar.classList.toggle('hidden', pocet === 0);
    document.getElementById('selectionCount').textContent = `Vybráno: ${pocet}`;
}

function zrusitVyber() {
    vybraneDlazdice().forEach(d => d.classList.remove('vybrana'));
    posledniVybrana = null;
    aktualizovatVyber();
}

function vybratKliknutim(e) {
    const dlazdice = e.target.closest('#photosGrid .photo-item');
    if (!dlazdice || !(e.ctrlKey || e.metaKey || e.shiftKey)) return false;
    if (e.shiftKey && posledniVybrana && posledniVybrana.parentElement === dlazdice.parentElement) {
        const vsechny = [...dlazdice.parentElement.children].filter(d => d.offsetParent);
        const [od, po] = [vsechny.indexOf(posledniVybrana), vsechny.indexOf(dlazdice)].sort((x, y) => x - y);
        vsechny.slice(od, po + 1).forEach(d => d.classList.add('vybrana'));
    } else {
        dlazdice.classList.toggle('vybrana');
    }
    posledniVybrana = dlazdice;
    aktualizovatVyber();
    return true;
}

// Vybraná fotka podle dlaždice: [fotka, album]
function fotkaDlazdice(dlazdice) {
    const album = aktualniAlba[parseInt(dlazdice.closest('.album').dataset.album)];
    return [album.fotky.find(f => f.id === parseInt(dlazdice.dataset.fotoId)), album];
}

selectionBar.addEventListener('click', jednou(async (e) => {
    const vybrane = vybraneDlazdice().map(fotkaDlazdice).filter(([f]) => f);
    const ids = vybrane.map(([f]) => f.id);
    if (!ids.length) return;
    const hodnoceni = e.target.closest('[data-vyber-hodnoceni]')?.dataset.vyberHodnoceni;
    const akce = e.target.closest('[data-vyber]')?.dataset.vyber;

    if (hodnoceni) {
        await SetHodnoceniFotek(ids, parseInt(hodnoceni));
        oznamit(`Ohodnoceno fotek: ${ids.length}.`);
    } else if (akce === 'zrusit') {
        zrusitVyber();
        return;
    } else if (akce === 'odebrat') {
        const obnova = vybrane.map(([f, album]) => obnovaFotky(f, album));
        if (!await DeleteFotografieHromadne(ids)) return;
        oznamit(`Odebráno fotek: ${ids.length}. Soubory na Google Disku zůstaly.`, { text: 'Vrátit', akce: async () => {
            await ObnovitFotky(obnova);
            nacistFotkyModelky(aktualniModelka.id);
        } });
    } else if (akce === 'presunout') {
        // Cílem je album otevřené modelky, nebo nové album; nové je pictorial
        const alba = aktualniAlba.filter(a => a.modelkaId === aktualniModelka.id);
        const nazev = await vybratHodnotu({ nadpis: 'Přesunout do alba', text: 'Vyber album ze seznamu, nebo napiš název nového alba.', popisek: 'Album', moznosti: alba.map(a => nazevAlba(a.album, a.typ)), tlacitko: 'Přesunout' });
        if (!nazev) return;
        const cil = alba.find(a => nazevAlba(a.album, a.typ) === nazev || a.album === nazev);
        const v = await PresunoutFotky(ids, aktualniModelka.id, cil ? cil.album : nazev, cil ? cil.typ : 'Pictorial');
        oznamit(`Přesunuto fotek: ${v.presunuto}.` + (v.duplicitni ? ` V cílovém albu už bylo: ${v.duplicitni} – zůstaly na místě.` : ''));
    } else {
        return;
    }
    zrusitVyber();
    nacistFotkyModelky(aktualniModelka.id);
}));

detailView.addEventListener('click', (e) => {
    if (vybratKliknutim(e)) return;
    if (e.target.closest('[data-vydani], .hearts') || rozbalitKliknute(e)) return;
    const polozka = e.target.closest('[data-index]');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index));
});

document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
    const klavesa = e.key.toLowerCase();
    if (klavesa === 'arrowright') lbZobrazit(lbIndex + 1);
    else if (klavesa === 'arrowleft') lbZobrazit(lbIndex - 1);
    else if (klavesa === 'arrowdown' || klavesa === 'pagedown') lbSkokAlba(1);
    else if (klavesa === 'arrowup' || klavesa === 'pageup') lbSkokAlba(-1);
    else if (/^[1-5]$/.test(klavesa)) lbOhodnotit(parseInt(klavesa));
    else if (klavesa === '0') lbOhodnotit(lbPolozky[lbIndex].hodnoceni);
    else if (klavesa === ' ') lbPrepnoutSlideshow();
    else if (klavesa === 'f') lbPrepnoutRozlozeni();
    else if (klavesa === 'r') lbOtocit();
    else if (klavesa === 's') lbZamichat();
    else return;
    e.preventDefault();
});

// Tlačítko Zpět
backBtn.addEventListener('click', zpet);
// Alt + šipka vlevo jako v prohlížeči
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft' && !backBtn.classList.contains('hidden')) {
        e.preventDefault();
        zpet();
    }
});

// Ovládání Modalů
const modelModal = document.getElementById('modelModal');
const albumModal = document.getElementById('albumModal');

document.getElementById('closeModalBtn').onclick = () => modelModal.classList.add('hidden');
document.getElementById('cancelModelBtn').onclick = () => modelModal.classList.add('hidden');
document.getElementById('addAlbumBtn').onclick = () => otevritAlbumModal(aktualniModelka);
document.getElementById('closeAlbumModalBtn').onclick = () => albumModal.classList.add('hidden');

// Ovládání okna (náhrada za systémovou lištu)
document.getElementById('winMinBtn').onclick = () => WindowMinimise();
document.getElementById('winMaxBtn').onclick = () => WindowToggleMaximise();
document.getElementById('winCloseBtn').onclick = () => Quit();

// Okno přes celou obrazovku má ostré rohy, zakulacení by v rozích ukazovalo plochu
async function upravitRohyOkna() {
    const cele = await WindowIsMaximised() || await WindowIsFullscreen();
    document.getElementById('app').classList.toggle('cele-okno', cele);
}
window.addEventListener('resize', () => {
    upravitRohyOkna();
    // Stav okna se někdy změní až po události změny velikosti
    setTimeout(upravitRohyOkna, 250);
});
upravitRohyOkna();
document.querySelector('.navbar').addEventListener('dblclick', (e) => {
    if (!e.target.closest('input, button')) WindowToggleMaximise();
});

// Úprava výřezu titulní fotky přímo na kartě: tažením posun, kolečkem nebo posuvníkem přiblížení
function upravitVyrez(modelka) {
    if (zrusitUpravuVyrezu) zrusitUpravuVyrezu();

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
        zrusitUpravuVyrezu = null;
    };
    zrusitUpravuVyrezu = ukoncit;

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
async function neniDuplicitni(modelka) {
    const jmena = m => [m.jmeno, ...(m.dalsiJmena || '').split(',')].map(sjednotit).filter(Boolean);
    const nova = jmena(modelka);
    const stejna = (await GetModelky('') || []).find(m => jmena(m).some(j => nova.includes(j)));
    return !stejna || potvrdit('Modelka už existuje', `V databázi už je modelka „${stejna.jmeno}" se stejným jménem nebo pseudonymem. Opravdu přidat další?`, 'Přesto přidat');
}

// Rychlé přidání: jen jméno, po uložení se rovnou otevře profil, kde se doplní fotky a údaje
const quickModal = document.getElementById('quickModal');

function otevritRychlePridani() {
    document.getElementById('quickForm').reset();
    quickModal.classList.remove('hidden');
    document.getElementById('inputQuickJmeno').focus();
}

document.getElementById('closeQuickModalBtn').onclick = () => quickModal.classList.add('hidden');
document.getElementById('quickMoreBtn').onclick = () => {
    const jmeno = document.getElementById('inputQuickJmeno').value;
    quickModal.classList.add('hidden');
    otevritModelModal(null);
    document.getElementById('inputJmeno').value = jmeno;
    oznacitVyplneneZalozky();
};
document.getElementById('quickForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const modelka = { jmeno: document.getElementById('inputQuickJmeno').value.trim(), tetovani: -1, piercing: -1 };
    if (!modelka.jmeno || !await neniDuplicitni(modelka)) return;
    if (!await AddModelka(modelka)) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return;
    }
    quickModal.classList.add('hidden');

    // Nově přidaná modelka má nejvyšší ID
    const nova = (await GetModelky('') || []).reduce((a, b) => (a && a.id > b.id ? a : b), null);
    if (nova) {
        prepnoutRezim('modelky');
        otevritDetailModelky(nova);
    }
});

// Pole formuláře modelky: [vlastnost modelky, id prvku, typ]
const poleModelky = [
    ['jmeno', 'inputJmeno', 'text'],
    ['dalsiJmena', 'inputDalsiJmena', 'text'],
    ['poznamka', 'inputPoznamka', 'text'],
    ['narozeniDatum', 'inputNarozeniDatum', 'text'],
    ['narozeniMisto', 'inputNarozeniMisto', 'text'],
    ['narodnost', 'inputNarodnost', 'text'],
    ['etnicita', 'inputEtnicita', 'text'],
    ['vyskaCm', 'inputVyska', 'cislo'],
    ['vahaKg', 'inputVaha', 'cislo'],
    ['vlasyBarva', 'inputVlasy', 'text'],
    ['ociBarva', 'inputOci', 'text'],
    ['ochlupeni', 'selectOchlupeni', 'text'],
    ['tetovani', 'selectTetovani', 'cislo'],
    ['piercing', 'selectPiercing', 'cislo'],
    ['obvodHrudnikCm', 'inputHrudnik', 'cislo'],
    ['obvodPasCm', 'inputPas', 'cislo'],
    ['obvodBokyCm', 'inputBoky', 'cislo'],
    ['velikostPrsou', 'inputVelikost', 'text'],
    ['prsaTyp', 'selectPrsaTyp', 'text'],
    ['role', 'inputRole', 'text'],
    ['tags', 'inputTags', 'text'],
    ['coverId', 'inputDriveID', 'text'],
];

// Míry z amerických zdrojů se po opuštění pole převedou na centimetry a kilogramy
document.getElementById('inputVyska').addEventListener('change', (e) => {
    const cm = prevestVysku(e.target.value);
    if (cm !== null) e.target.value = cm;
});
document.getElementById('inputVaha').addEventListener('change', (e) => {
    const kg = prevestVahu(e.target.value);
    if (kg !== null) e.target.value = kg;
});
// „34B-24-34" vložené do hrudníku nebo velikosti prsou vyplní všechny tři obvody i velikost
['inputHrudnik', 'inputVelikost'].forEach(id => document.getElementById(id).addEventListener('change', (e) => {
    const miry = rozlozitMiry(e.target.value);
    if (!miry) return;
    document.getElementById('inputHrudnik').value = miry.hrudnik;
    document.getElementById('inputPas').value = miry.pas;
    document.getElementById('inputBoky').value = miry.boky;
    if (miry.velikost) document.getElementById('inputVelikost').value = miry.velikost;
    else if (id === 'inputVelikost') document.getElementById('inputVelikost').value = '';
    oznacitVyplneneZalozky();
}));

// Formulář modelky slouží pro přidání (modelka = null) i úpravu
// fronta: doplňování z Přehledu ({ zalozka }); „Uložit a další" pak otevře další modelku z tabulky
let frontaDoplnovani = null;

function otevritModelModal(modelka, fronta = null) {
    frontaDoplnovani = fronta;
    document.getElementById('modelNextBtn').classList.toggle('hidden', !fronta);
    editovanaModelka = modelka;
    document.getElementById('addModelForm').reset();
    document.getElementById('modelModalTitle').textContent = modelka ? 'Upravit modelku' : 'Přidat novou modelku';
    document.querySelectorAll('#addModelForm option[data-puvodni]').forEach(o => o.remove());

    if (modelka) {
        poleModelky.forEach(([vlastnost, id, typ]) => {
            const prvek = document.getElementById(id);
            // Hodnota, kterou výběr nenabízí (typicky z importu), se do něj doplní; jinak by se zobrazila
            // jako prázdná a uložením by se smazala
            if (prvek.tagName === 'SELECT' && modelka[vlastnost] !== '' && ![...prvek.options].some(o => o.value === String(modelka[vlastnost]))) {
                prvek.add(new Option(String(modelka[vlastnost]), String(modelka[vlastnost])));
                prvek.lastElementChild.dataset.puvodni = '1';
            }
            // Výběr ano/ne/neuvedeno potřebuje i nulu, číselné pole nulu zobrazuje jako prázdné
            if (prvek.tagName === 'SELECT') prvek.value = String(modelka[vlastnost]);
            else if (typ === 'cislo') prvek.value = modelka[vlastnost] || '';
            else prvek.value = modelka[vlastnost];
        });
    }
    modelModal.classList.remove('hidden');
    ukazatZalozku(0);
    oznacitVyplneneZalozky();
    document.getElementById('inputJmeno').focus();
    naplnitNapovedu();
}

// Formulář modelky je rozdělený do záložek, aby se nemusel rolovat
const sekceFormulare = [...document.querySelectorAll('#addModelForm .form-section')];
const modelTabs = document.getElementById('modelTabs');
modelTabs.innerHTML = sekceFormulare.map((sekce, i) =>
    `<button type="button" data-zalozka="${i}">${esc(sekce.querySelector('h4').textContent)}<i></i></button>`).join('');

function ukazatZalozku(index) {
    sekceFormulare.forEach((sekce, i) => sekce.classList.toggle('active', i === index));
    modelTabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === index));
    document.querySelector('#modelModal .form-body').scrollTop = 0;
}

// Tečka u záložky, ve které už je něco vyplněno
function oznacitVyplneneZalozky() {
    sekceFormulare.forEach((sekce, i) => {
        const vyplneno = [...sekce.querySelectorAll('input, select, textarea')]
            .some(p => p.value.trim() && p.value !== '-1');
        modelTabs.children[i].classList.toggle('filled', vyplneno);
    });
}

modelTabs.addEventListener('click', (e) => {
    const zalozka = e.target.closest('[data-zalozka]');
    if (zalozka) ukazatZalozku(parseInt(zalozka.dataset.zalozka));
});
document.getElementById('addModelForm').addEventListener('input', oznacitVyplneneZalozky);

// Našeptávání: hodnoty už zapsané u jiných modelek, doplněné o několik obvyklých
async function naplnitNapovedu() {
    const modelky = await GetModelky('') || [];
    const seznamy = [
        ['seznamVlasy', m => m.vlasyBarva, ['Blond', 'Hnědá', 'Černá', 'Zrzavá']],
        ['seznamOci', m => m.ociBarva, ['Modrá', 'Hnědá', 'Zelená', 'Šedá']],
        ['seznamNarodnost', m => m.narodnost, []],
        ['seznamEtnicita', m => m.etnicita, []],
        ['seznamMisto', m => m.narozeniMisto, []],
        ['seznamRole', m => m.role, []],
    ];
    seznamy.forEach(([id, hodnota, obvykle]) => {
        const hodnoty = new Map();
        [...modelky.map(hodnota), ...obvykle].forEach(h => {
            if (sjednotit(h) && !hodnoty.has(sjednotit(h))) hodnoty.set(sjednotit(h), h.trim());
        });
        document.getElementById(id).innerHTML = [...hodnoty.values()]
            .sort((a, b) => a.localeCompare(b, 'cs'))
            .map(h => `<option value="${esc(h)}"></option>`).join('');
    });

    // Tagy se přidávají kliknutím, protože pole jich obsahuje víc najednou
    const tagy = new Map();
    modelky.flatMap(m => m.tags.split(',')).forEach(t => {
        if (sjednotit(t) && !tagy.has(sjednotit(t))) tagy.set(sjednotit(t), t.trim());
    });
    document.getElementById('tagyNapoveda').innerHTML = [...tagy.values()]
        .sort((a, b) => a.localeCompare(b, 'cs'))
        .map(t => `<button type="button" class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
}

document.getElementById('tagyNapoveda').addEventListener('click', (e) => {
    const tag = e.target.closest('[data-tag]')?.dataset.tag;
    if (!tag) return;
    const pole = document.getElementById('inputTags');
    const soucasne = pole.value.split(',').map(t => t.trim()).filter(Boolean);
    if (!soucasne.some(t => sjednotit(t) === sjednotit(tag))) soucasne.push(tag);
    pole.value = soucasne.join(', ');
});

const deleteModal = document.getElementById('deleteModal');

// Potvrzovací okno pro nevratné mazání; akce se provede až po potvrzení
function otevritDeleteModal(nadpis, text, akce, poDokonceni = () => nacistGalerii(searchInput.value)) {
    potvrzenaAkce = async () => {
        if (await akce() === false) oznamit('Smazání se nepodařilo, nic se nezměnilo.');
        poDokonceni();
    };
    document.getElementById('confirmDeleteBtn').textContent = 'Smazat';
    document.getElementById('deleteModalTitle').textContent = nadpis;
    document.getElementById('deleteModalText').textContent = text;
    deleteModal.classList.remove('hidden');
}

// Obecná otázka ano/ne ve stejném okně; vrací, zda uživatel potvrdil
function potvrdit(nadpis, text, popisTlacitka) {
    return new Promise((vyreseno) => {
        potvrzenaAkce = () => { zrusenaAkce = null; vyreseno(true); };
        zrusenaAkce = () => vyreseno(false);
        document.getElementById('confirmDeleteBtn').textContent = popisTlacitka;
        document.getElementById('deleteModalTitle').textContent = nadpis;
        document.getElementById('deleteModalText').textContent = text;
        deleteModal.classList.remove('hidden');
    });
}

function zavritDeleteModal() {
    zrusenaAkce?.();
    zrusenaAkce = null;
    potvrzenaAkce = null;
    deleteModal.classList.add('hidden');
}

function smazatModelku(modelka) {
    otevritDeleteModal(
        'Smazat modelku',
        `Opravdu smazat modelku „${modelka.jmeno}" včetně všech jejích fotek a alb? Před smazáním se uloží záloha.`,
        () => DeleteModelka(modelka.id)
    );
}

function smazatDatabazi() {
    otevritDeleteModal(
        'Smazat celou databázi',
        `Opravdu smazat celou databázi? Odstraní se všechny modelky, jejich fotky a alba i covery. Před smazáním se uloží záloha.`,
        async () => {
            const smazano = await DeleteVse();
            if (smazano) oznamit(`Databáze smazána. Záloha před smazáním je ve složce ${await SlozkaZaloh()}`);
            return smazano;
        }
    );
}

document.getElementById('closeDeleteModalBtn').onclick = zavritDeleteModal;
document.getElementById('cancelDeleteBtn').onclick = zavritDeleteModal;
document.getElementById('confirmDeleteBtn').onclick = jednou(async () => {
    if (!potvrzenaAkce) return;
    // Potvrzeno: zavření okna už nesmí akci ohlásit jako zrušenou
    const akce = potvrzenaAkce;
    zrusenaAkce = null;
    await akce();
    zavritDeleteModal();
});

// Formulář alba slouží pro přidání fotek (album = null) i úpravu alba ({ album, typ })
// Přidání centerfoldu ze stěny plakátů: modelka se jen vybere ze seznamu už zadaných
// Centerfold mimo profil (stěna, vydání, kalendář, přehled): modelka se vybírá v okně, vydání může být dané
function pridatCenterfold(vydani = '') {
    otevritAlbumModal(null, null, { vyberModelky: true, typ: 'Centerfold', vydani, nadpis: 'Přidat centerfold' });
}

function pridatPictorial(vydani = '') {
    otevritAlbumModal(null, null, { vyberModelky: true, typ: 'Pictorial', vydani, nadpis: 'Přidat pictorial' });
}

// Modelka podle jména z okna alba; neznámé jméno založí novou
async function vybratNeboZalozitModelku(jmeno) {
    jmeno = jmeno.trim();
    if (!jmeno) {
        oznamit('Napiš jméno modelky.');
        return null;
    }
    const najit = async () => (await GetModelky('') || []).filter(m => sjednotit(m.jmeno) === sjednotit(jmeno)).sort((a, b) => b.id - a.id)[0];
    const znama = await najit();
    if (znama) return znama;
    if (!await AddModelka({ jmeno, tetovani: -1, piercing: -1 })) {
        oznamit('Modelku se nepodařilo založit.');
        return null;
    }
    return await najit();
}

// Centerfold se místo názvu určuje měsícem a rokem vydání
function prepnoutPoleAlba() {
    const centerfold = document.getElementById('selectTyp').value === 'Centerfold';
    document.getElementById('albumNazevGroup').classList.toggle('hidden', centerfold);
    document.getElementById('albumVydaniGroup').classList.remove('hidden');
    // U pictorialu je vydání nepovinné
    // U pictorialu stačí i samotný rok
    document.getElementById('albumMesicLabel').textContent = centerfold ? 'Měsíc vydání' : 'Měsíc (nepovinné)';
    document.getElementById('albumRokLabel').textContent = centerfold ? 'Rok vydání' : 'Rok (nepovinné)';
    document.getElementById('inputAlbumName').required = !centerfold;
    document.getElementById('selectAlbumMesic').required = centerfold;
    document.getElementById('inputAlbumRok').required = centerfold;
}

document.getElementById('selectTyp').addEventListener('change', prepnoutPoleAlba);

// moznosti: vyberModelky (modelka se vybírá v okně), typ a vydani (předvyplnění), nadpis
function otevritAlbumModal(modelka, album = null, moznosti = {}) {
    modelkaAlba = modelka;
    editovaneAlbum = album;
    document.getElementById('addAlbumForm').reset();
    document.getElementById('albumModelkaGroup').classList.toggle('hidden', !moznosti.vyberModelky);
    document.getElementById('albumModelkaNova').textContent = '';
    // „Uložit a přidat další" má smysl jen při přidávání
    document.getElementById('albumNextBtn').classList.toggle('hidden', Boolean(album));
    document.getElementById('albumModalTitle').textContent = moznosti.nadpis || (album ? 'Upravit album' : 'Přidat fotky do alba');
    document.getElementById('albumSubmitBtn').textContent = album ? 'Uložit album' : 'Uložit fotky';
    document.getElementById('bulkLinksLabel').textContent = album
        ? 'Přidat další fotky – odkazy z Google Disku (nepovinné)'
        : 'Vložte odkazy z Google Disku (libovolné množství)';
    // Při úpravě alba není nutné přidávat další fotky
    document.getElementById('inputBulkLinks').required = !album;

    // S předem daným typem (centerfold, pictorial) se typ nevybírá
    document.getElementById('albumTypGroup').classList.toggle('hidden', Boolean(moznosti.typ));

    // Starší album jiného typu (např. Cover) si svůj typ při úpravě ponechá
    const vyberTypu = document.getElementById('selectTyp');
    vyberTypu.querySelectorAll('[data-puvodni]').forEach(o => o.remove());

    if (album) {
        if (![...vyberTypu.options].some(o => o.value === album.typ)) {
            vyberTypu.add(new Option(album.typ, album.typ));
            vyberTypu.lastElementChild.dataset.puvodni = '1';
        }
        vyberTypu.value = album.typ;
        document.getElementById('inputAlbumName').value = album.album;
        document.getElementById('inputAlbumFotograf').value = album.fotograf || '';
        document.getElementById('inputAlbumPopis').value = album.popis || '';

    }
    if (moznosti.typ) vyberTypu.value = moznosti.typ;
    const vydani = rozlozitVydani(album ? (album.vydani || (album.typ === 'Centerfold' ? album.album : '')) : moznosti.vydani);
    document.getElementById('inputAlbumRok').value = vydani?.rok || '';
    document.getElementById('selectAlbumMesic').value = vydani?.mesic || '';
    document.getElementById('selectAlbumEdice').value = vydani?.edice || kalendarEdice;
    prepnoutPoleAlba();

    // Našeptávání fotografů z celé sbírky, aby se stejné jméno psalo vždy stejně
    GetFotografove().then(fotografove => {
        document.getElementById('seznamFotografu').innerHTML = (fotografove || []).map(f => `<option value="${esc(f)}"></option>`).join('');
    });
    if (moznosti.vyberModelky) {
        GetModelky('').then(modelky => {
            document.getElementById('seznamModelekAlba').innerHTML = (modelky || []).map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');
        });
        document.getElementById('inputAlbumModelka').value = modelka?.jmeno || '';
    }
    albumModal.classList.remove('hidden');
    document.getElementById(moznosti.vyberModelky ? 'inputAlbumModelka' : moznosti.typ ? (moznosti.typ === 'Centerfold' ? 'selectAlbumMesic' : 'inputAlbumName') : 'selectTyp').focus();
}

// Nápověda, že napsané jméno zatím ve sbírce není a uložením vznikne nová modelka
document.getElementById('inputAlbumModelka').addEventListener('input', (e) => {
    const jmeno = sjednotit(e.target.value);
    const znama = [...document.querySelectorAll('#seznamModelekAlba option')].some(o => sjednotit(o.value) === jmeno);
    document.getElementById('albumModelkaNova').textContent = jmeno && !znama ? 'Nová modelka – uložením se založí.' : '';
});

function smazatAlbum(album, pocet) {
    otevritDeleteModal(
        'Smazat album',
        `Opravdu smazat album „${nazevAlba(album.album, album.typ)}" (${album.typ}, počet fotek: ${pocet})? Fotky na Google Disku zůstanou. Před smazáním se uloží záloha.`,
        () => DeleteAlbum(album.modelkaId, album.album, album.typ),
        () => nacistFotkyModelky(aktualniModelka.id)
    );
}

// Kontrola, že Google Disk všechny uložené soubory stále vrací
const checkModal = document.getElementById('checkModal');
let nedostupneFotky = [];
let nedostupnychPodezreleMnoho = false;

async function zkontrolovatSoubory(hotovyVysledek = null) {
    const text = document.getElementById('checkModalText');
    const seznam = document.getElementById('checkModalList');
    const odebrat = document.getElementById('checkRemoveBtn');
    text.textContent = 'Ověřuji soubory na Google Disku…';
    seznam.innerHTML = '';
    odebrat.classList.add('hidden');
    checkModal.classList.remove('hidden');

    const vysledek = hotovyVysledek || await ZkontrolovatSoubory();
    localStorage.setItem('posledniKontrola', String(Date.now()));
    const neovereno = vysledek.neovereno
        ? ` U ${vysledek.neovereno} se kontrola nepovedla (zřejmě připojení), zkus to později znovu.`
        : '';

    if (vysledek.nedostupne.length === 0) {
        text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Všechny ověřené jsou dostupné.${neovereno}`;
        return;
    }

    // Mnoho nedostupných najednou bývá výpadek nebo omezení požadavků na straně Googlu, ne smazané soubory
    nedostupnychPodezreleMnoho = vysledek.nedostupne.length >= 10 && vysledek.nedostupne.length > vysledek.zkontrolovano * 0.1;
    text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Nedostupných: ${vysledek.nedostupne.length} – na Disku jsou smazané nebo už nejsou sdílené.${neovereno}`
        + (nedostupnychPodezreleMnoho ? ' To je podezřele mnoho najednou: vypadá to spíš na výpadek nebo omezení ze strany Googlu. Zkus kontrolu později znovu, než něco odebereš.' : '');
    seznam.innerHTML = vysledek.nedostupne.map(n => {
        const kde = n.fotoId === 0
            ? `titulní fotka (změň ji přes Editovat)`
            : `${n.typ} · ${nazevAlba(n.album, n.typ)}`;
        return `<li><strong>${esc(n.jmeno || 'Cover časopisu')}</strong><span>${esc(kde)}${n.fotoId !== 0 && !n.opakovane ? ' · poprvé' : ''}</span></li>`;
    }).join('');

    // Odebrat se nabízí jen fotky nedostupné i při některé dřívější kontrole; poprvé nedostupná může být jen výpadek.
    // Titulní fotky se neodebírají, modelka by zůstala bez obrázku bez vědomí uživatele.
    nedostupneFotky = vysledek.nedostupne.filter(n => n.fotoId !== 0 && n.opakovane);
    const poprve = vysledek.nedostupne.filter(n => n.fotoId !== 0 && !n.opakovane).length;
    if (poprve) text.textContent += ` Poprvé nedostupných: ${poprve} – ověří se znovu při další kontrole, odebrat půjdou, jen když budou nedostupné i jindy.`;
    odebrat.classList.toggle('hidden', nedostupneFotky.length === 0);
    odebrat.textContent = nedostupnychPodezreleMnoho
        ? `Přesto odebrat z databáze (${nedostupneFotky.length})…`
        : `Odebrat nedostupné z databáze (${nedostupneFotky.length})`;
}

function zavritKontrolu() {
    checkModal.classList.add('hidden');
}

document.getElementById('closeCheckModalBtn').onclick = zavritKontrolu;
document.getElementById('checkCloseBtn').onclick = zavritKontrolu;
document.getElementById('checkRemoveBtn').onclick = jednou(async () => {
    if (nedostupnychPodezreleMnoho && !await potvrdit('Odebrat nedostupné fotky',
        `Opravdu odebrat ${nedostupneFotky.length} fotek z databáze? Je jich podezřele mnoho najednou; pokud jde jen o výpadek Disku, přijdeš o jejich zařazení do alb, pořadí i srdíčka. Před odebráním se uloží záloha.`, 'Přesto odebrat')) return;

    // Jedna záloha a jedno odebrání pro všechny
    if (!await DeleteFotografieHromadne(nedostupneFotky.map(n => n.fotoId))) {
        oznamit('Odebrání se nepodařilo, nic se nezměnilo.');
        return;
    }
    oznamit(`Odebráno fotek: ${nedostupneFotky.length}. Záloha před odebráním je ve složce ${await SlozkaZaloh()}`);
    nedostupneFotky = [];
    zavritKontrolu();
    if (!detailView.classList.contains('hidden')) nacistFotkyModelky(aktualniModelka.id);
    else nacistGalerii(searchInput.value);
});

// Export celé sbírky do souboru YAML, který jde upravovat v textovém editoru
async function exportovatData() {
    const cesta = await ExportovatDoSouboru();
    if (cesta) oznamit(`Sbírka je uložená v souboru ${cesta}`);
}

// Import ze souboru YAML: doplňuje a opravuje, nic nemaže
async function importovatData() {
    const cesta = await VybratSouborImportu();
    if (!cesta) return;
    const soubor = cesta.split('/').pop();
    if (!await potvrdit('Importovat sbírku', `Načíst data ze souboru „${soubor}“? Stávající modelky a alba se doplní a opraví, nové se přidají, nic se nemaže. Před importem se uloží záloha.`, 'Importovat')) return;

    const v = await ImportovatZeSouboru(cesta);
    if (v.selhalo) {
        oznamit(v.selhalo, { text: 'Rozumím', akce: () => {} });
        return;
    }
    const shrnuti = `Import hotov. Nové modelky: ${v.noveModelky}, upravené: ${v.upraveneModelky}, alba: ${v.alba}, nové fotky: ${v.noveFotky}.`;
    // Co se nepodařilo převzít, zůstane vidět, dokud to uživatel nezavře
    if (v.chyby.length) oznamit(`${shrnuti} Přeskočeno (${v.chyby.length}): ${v.chyby.slice(0, 5).join('; ')}${v.chyby.length > 5 ? '; …' : ''}`, { text: 'Rozumím', akce: () => {} });
    else oznamit(shrnuti);
    prepnoutRezim('modelky');
    nacistGalerii(searchInput.value);
}

// Heslo: nastavení, změna a zrušení. Chrání rozhraní, databáze na disku šifrovaná není.
const passModal = document.getElementById('passModal');

function otevritHeslo() {
    document.getElementById('passForm').reset();
    document.getElementById('passModalTitle').textContent = maZamek ? 'Změnit nebo zrušit heslo' : 'Nastavit heslo';
    document.getElementById('passOldGroup').classList.toggle('hidden', !maZamek);
    document.getElementById('passNewLabel').textContent = maZamek ? 'Nové heslo (prázdné zámek zruší)' : 'Nové heslo';
    passModal.classList.remove('hidden');
    document.getElementById(maZamek ? 'inputPassOld' : 'inputPassNew').focus();
}

document.getElementById('closePassModalBtn').onclick = () => passModal.classList.add('hidden');
document.getElementById('passForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const nove = document.getElementById('inputPassNew').value;
    if (nove !== document.getElementById('inputPassNew2').value) {
        oznamit('Nové heslo a jeho zopakování se liší.');
        return;
    }
    if (!nove && !maZamek) {
        oznamit('Zadej heslo, kterým se má program zamykat.');
        return;
    }
    if (!await NastavitHeslo(document.getElementById('inputPassOld').value, nove)) {
        oznamit('Stávající heslo nesouhlasí, nic se nezměnilo.');
        return;
    }
    maZamek = Boolean(nove);
    passModal.classList.add('hidden');
    oznamit(maZamek ? 'Heslo je nastavené, vyžádá se při příštím spuštění.' : 'Zámek je zrušený.');
});

// Zamčený program neukáže nic ze sbírky, dokud heslo nesouhlasí
function odemknoutPriStartu() {
    const obrazovka = document.getElementById('lockScreen');
    const pole = document.getElementById('inputLock');
    const zprava = document.getElementById('lockMsg');
    zamceno = true;
    document.getElementById('app').classList.add('zamceno');
    obrazovka.classList.remove('hidden');
    pole.focus();

    return new Promise((odemceno) => {
        document.getElementById('lockForm').onsubmit = async (e) => {
            e.preventDefault();
            zprava.textContent = 'Ověřuji…';
            if (!await Odemknout(pole.value)) {
                zprava.textContent = 'Heslo nesouhlasí.';
                pole.select();
                return;
            }
            pole.value = '';
            zamceno = false;
            document.getElementById('app').classList.remove('zamceno');
            obrazovka.classList.add('hidden');
            odemceno();
        };
    });
}

// Mezipaměť jsou jen kopie obrázků stažené z Disku; po vymazání se načtou znovu
async function vymazatMezipamet() {
    const bajty = await VymazatMezipamet();
    oznamit(`Mezipaměť obrázků vymazána (uvolněno ${(bajty / 1024 / 1024).toFixed(1)} MB). Obrázky se načtou znovu z Disku.`);
    setTimeout(() => window.location.reload(), 2500);
}

// Jednou denně na pozadí ověří, že soubory na Disku stále existují
async function kontrolaPoSpusteni() {
    const DEN = 24 * 60 * 60 * 1000;
    if (Date.now() - Number(localStorage.getItem('posledniKontrola') || 0) < DEN) return;

    // Denně jen dávka nejdéle neověřených fotek, aby Google nedostal tisíce požadavků najednou
    const vysledek = await ZkontrolovatDavku();
    // Při výpadku připojení se kontrola zopakuje při dalším spuštění
    if (vysledek.zkontrolovano > 0 && vysledek.neovereno === vysledek.zkontrolovano) return;
    localStorage.setItem('posledniKontrola', String(Date.now()));

    // Hlásí se jen soubory nedostupné opakovaně
    const opakovane = vysledek.nedostupne.filter(n => n.opakovane).length;
    if (opakovane > 0) {
        oznamit(`Souborů, které na Google Disku opakovaně nejsou dostupné: ${opakovane}.`,
            { text: 'Zobrazit', akce: () => zkontrolovatSoubory(vysledek) });
    }
}

function smazatCover(cover) {
    otevritDeleteModal(
        'Smazat cover',
        `Opravdu smazat cover vydání „${nazevAlba(cover.album, cover.typ)}"? Soubor na Google Disku zůstane.`,
        () => DeleteFotografie(cover.fotky[0].id),
        () => nacistCovery(searchInput.value)
    );
}

// Sdílené album: další modelka ho uvidí i ve svém profilu
async function pridatModelkuKAlbu(album) {
    const modelka = await vybratModelku('Přidat modelku k albu', `Album „${nazevAlba(album.album, album.typ)}“ se ukáže i v jejím profilu; fotky, srdíčka a text zůstanou společné.`,
        'Přidat', [album.modelkaId, ...album.dalsiModelky.map(m => m.id)]);
    if (!modelka) return;
    if (!await PridatModelkuKAlbu(album.modelkaId, album.album, album.typ, modelka.id)) {
        oznamit('Modelku se k albu nepodařilo přidat.');
        return;
    }
    nacistFotkyModelky(aktualniModelka.id);
}

async function presunoutAlbum(album) {
    const modelka = await vybratModelku('Přesunout album', `Album „${nazevAlba(album.album, album.typ)}“ přejde i se srdíčky, pořadím a textem k jiné modelce.`, 'Přesunout', [album.modelkaId]);
    if (!modelka) return;
    const chyba = await PresunoutAlbum(album.modelkaId, album.album, album.typ, modelka.id);
    if (chyba) {
        oznamit(chyba);
        return;
    }
    oznamit(`Album je teď u modelky ${modelka.jmeno}.`, { text: 'Otevřít její profil', akce: () => otevritProfilPodleId(modelka.id) });
    nacistFotkyModelky(aktualniModelka.id);
}

async function sloucitAlbum(album) {
    const jina = aktualniAlba.filter(a => a !== album && a.modelkaId === album.modelkaId);
    const popisAlba = a => `${nazevAlba(a.album, a.typ)} (${a.typ})`;
    const vybrane = await vybratHodnotu({
        nadpis: 'Sloučit s albem',
        text: `Fotky alba „${nazevAlba(album.album, album.typ)}“ přejdou do vybraného alba; soubory, které tam už jsou, se nezdvojí. Před sloučením se uloží záloha.`,
        popisek: 'Cílové album', moznosti: jina.map(popisAlba), tlacitko: 'Sloučit',
    });
    if (!vybrane) return;
    const cil = jina.find(a => popisAlba(a) === vybrane || sjednotit(a.album) === sjednotit(vybrane));
    if (!cil) {
        oznamit('Takové album modelka nemá. Vyber ho ze seznamu.');
        return;
    }
    const chyba = await SloucitAlba(album.modelkaId, album.album, album.typ, cil.album, cil.typ);
    if (chyba) oznamit(chyba);
    nacistFotkyModelky(aktualniModelka.id);
}

// Duplicitní modelka se sloučí do otevřené: alba přejdou, prázdné údaje se doplní
async function sloucitModelku(modelka) {
    const zdroj = await vybratModelku('Sloučit s jinou modelkou', `Vybraná modelka se sloučí do modelky ${modelka.jmeno}: její alba přejdou sem, prázdné údaje se doplní a její jméno se přidá mezi pseudonymy. Před sloučením se uloží záloha.`, 'Vybrat', [modelka.id]);
    if (!zdroj) return;
    if (!await potvrdit('Sloučit modelky', `Sloučit modelku „${zdroj.jmeno}“ do „${modelka.jmeno}“? Modelka „${zdroj.jmeno}“ pak jako samostatná zmizí.`, 'Sloučit')) return;
    const chyba = await SloucitModelky(modelka.id, zdroj.id);
    if (chyba) {
        oznamit(chyba);
        return;
    }
    oznamit(`Modelka ${zdroj.jmeno} je sloučená do ${modelka.jmeno}.`);
    otevritProfilPodleId(modelka.id);
}

// Náhodná modelka ze sbírky (ne ta, jejíž profil je zrovna otevřený)
async function nahodnaModelka() {
    const modelky = (await GetModelky('') || []).filter(m => m.id !== aktualniModelka?.id || detailView.classList.contains('hidden'));
    if (modelky.length) otevritDetailModelky(modelky[Math.floor(Math.random() * modelky.length)]);
}

async function zmenitInterval() {
    const sekundy = await vybratHodnotu({ nadpis: 'Interval slideshow', popisek: 'Sekund na fotku', moznosti: ['2', '3', '4', '6', '8', '10', '15'], tlacitko: 'Uložit', vychozi: String(intervalSlideshow / 1000) });
    const hodnota = parseFloat(String(sekundy || '').replace(',', '.'));
    if (!hodnota || hodnota < 1 || hodnota > 120) {
        if (sekundy) oznamit('Zadej počet sekund od 1 do 120.');
        return;
    }
    intervalSlideshow = Math.round(hodnota * 1000);
    try { localStorage.setItem('intervalSlideshow', String(intervalSlideshow)); } catch { /* jen se nezapamatuje */ }
    oznamit(`Slideshow ukazuje každou fotku ${hodnota} s.`);
}

// Šablona adresy obrázků: kdyby Google adresu náhledů změnil, jde ji upravit bez nové verze programu
async function zmenitSablonuObrazku() {
    const sablona = await vybratHodnotu({
        nadpis: 'Adresa obrázků',
        text: '{id} je ID souboru na Disku, {velikost} požadovaná velikost (např. w600, s0). Prázdné pole vrátí výchozí adresu.',
        popisek: 'Šablona', tlacitko: 'Uložit', vychozi: await GetSablonaObrazku(),
    });
    if (sablona === null) return;
    if (!await SetSablonaObrazku(sablona)) {
        oznamit('Šablona musí obsahovat {id}.');
        return;
    }
    window.location.reload();
}

// Hromadné přejmenování fotografa nebo tagu v celé sbírce
async function prejmenovatVeSbirce(co) {
    const fotograf = co === 'fotograf';
    const moznosti = await (fotograf ? GetFotografove() : GetTagy()) || [];
    if (!moznosti.length) {
        oznamit(fotograf ? 'Ve sbírce zatím není žádný fotograf.' : 'Ve sbírce zatím není žádný tag.');
        return;
    }
    const stary = await vybratHodnotu({ nadpis: fotograf ? 'Přejmenovat fotografa' : 'Přejmenovat tag', popisek: fotograf ? 'Fotograf' : 'Tag', moznosti, tlacitko: 'Pokračovat' });
    if (!stary) return;
    const novy = await vybratHodnotu({ nadpis: fotograf ? 'Přejmenovat fotografa' : 'Přejmenovat tag', text: `Nový zápis pro „${stary}“ v celé sbírce.`, popisek: 'Nově', tlacitko: 'Přejmenovat', vychozi: stary });
    if (!novy || novy === stary) return;
    const pocet = fotograf ? await PrejmenovatFotografa(stary, novy) : await PrejmenovatTag(stary, novy);
    oznamit(fotograf ? `Upraveno alb: ${pocet}.` : `Upraveno modelek: ${pocet}.`);
    if (!detailView.classList.contains('hidden')) otevritProfilPodleId(aktualniModelka.id);
}

// Fotka se odebere hned; oznámení nabídne vrátit ji i se srdíčky, pořadím a textem alba
async function smazatFotku(fotka, album) {
    const obnova = obnovaFotky(fotka, album);
    if (!await DeleteFotografie(fotka.id)) return;
    nacistFotkyModelky(aktualniModelka.id);
    oznamit('Fotka odebrána z alba. Soubor na Google Disku zůstal.', { text: 'Vrátit', akce: async () => {
        await ObnovitFotky([obnova]);
        nacistFotkyModelky(aktualniModelka.id);
    } });
}

// Správa sbírky: stejné položky nabízí pravé tlačítko na volném místě galerie i tlačítko ⋯ v hlavičce
function polozkySpravy() {
    return [
        { text: 'Náhodná modelka', akce: nahodnaModelka },
        { text: `Interval slideshow (${intervalSlideshow / 1000} s)…`, akce: zmenitInterval },
        null,
        { text: 'Obnovit zobrazení', akce: () => nacistGalerii(searchInput.value) },
        { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        { text: 'Vymazat mezipaměť obrázků', akce: vymazatMezipamet },
        null,
        { text: 'Obnovit ze zálohy…', akce: otevritZalohy },
        { text: 'Otevřít složku se zálohami', akce: async () => BrowserOpenURL('file://' + await SlozkaZaloh()) },
        { text: 'Exportovat sbírku (YAML)…', akce: exportovatData },
        { text: 'Importovat sbírku (YAML)…', akce: importovatData },
        null,
        { text: 'Adresa obrázků…', akce: zmenitSablonuObrazku },
        { text: 'Přejmenovat fotografa…', akce: () => prejmenovatVeSbirce('fotograf') },
        { text: 'Přejmenovat tag…', akce: () => prejmenovatVeSbirce('tag') },
        null,
        { text: maZamek ? 'Změnit nebo zrušit heslo…' : 'Nastavit heslo…', akce: otevritHeslo },
        // Nové načtení okna znovu vyžádá heslo
        ...(maZamek ? [{ text: 'Zamknout', akce: () => window.location.reload() }] : []),
        null,
        { text: 'Smazat celou databázi', akce: smazatDatabazi },
        null,
        { text: `Verze ${verzeProgramu}`, akce: () => oznamit(`Playboy Database ${verzeProgramu}. Co je v které verzi nového, popisuje CHANGELOG.md v repozitáři.`) },
    ];
}

// Verze programu pro nabídku ⋯
let verzeProgramu = '';
GetVerze().then(verze => { verzeProgramu = verze; });

// Tlačítka v hlavičce otevírají tutéž nabídku jako pravé tlačítko, jen pod sebou
function nabidkaPodTlacitkem(e, polozky) {
    e.stopPropagation();
    const misto = e.currentTarget.getBoundingClientRect();
    otevritKontextovouNabidku(misto.left, misto.bottom + 4, polozky);
}

document.getElementById('addBtn').onclick = (e) => {
    const vProfilu = !detailView.classList.contains('hidden');
    const naVydani = !issueView.classList.contains('hidden');
    nabidkaPodTlacitkem(e, [
        ...(vProfilu ? [{ text: `Přidat fotky / album: ${aktualniModelka.jmeno}`, akce: () => otevritAlbumModal(aktualniModelka) }, null] : []),
        { text: 'Přidat modelku', akce: otevritRychlePridani },
        // Centerfold a cover se po uložení vracejí do přehledu, proto se z profilu a ze stránky vydání nenabízejí
        ...(vProfilu || naVydani ? [] : [
            { text: 'Přidat centerfold', akce: pridatCenterfold },
            { text: 'Přidat cover', akce: () => otevritCoverModal() },
        ]),
    ]);
};

document.getElementById('menuBtn').onclick = (e) => {
    const vProfilu = !detailView.classList.contains('hidden');
    nabidkaPodTlacitkem(e, [
        ...(vProfilu ? [
            { text: `Upravit modelku: ${aktualniModelka.jmeno}`, akce: () => otevritModelModal(aktualniModelka) },
            { text: 'Sloučit s jinou modelkou…', akce: () => sloucitModelku(aktualniModelka) },
            { text: 'Smazat modelku', akce: () => smazatModelku(aktualniModelka) },
            null,
        ] : []),
        ...polozkySpravy(),
    ]);
};

document.getElementById('editModelBtn').onclick = () => otevritModelModal(aktualniModelka);

// Tlačítko ⋯ v hlavičce alba otevře tutéž nabídku jako pravé tlačítko na albu
document.getElementById('photosGrid').addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-nabidka-alba]');
    if (!tlacitko) return;
    e.stopPropagation();
    const misto = tlacitko.getBoundingClientRect();
    tlacitko.parentElement.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: misto.left, clientY: misto.bottom + 4 }));
});

// Obnovení ze zálohy: seznam záloh s počty, aby šlo poznat, ke které se vrátit
const NAZVY_ZALOH = {
    'denni': 'Denní záloha',
    'pred-smazanim-alba': 'Před smazáním alba',
    'pred-smazanim-modelky': 'Před smazáním modelky',
    'pred-smazanim-databaze': 'Před smazáním databáze',
    'pred-odebranim-fotek': 'Před odebráním fotek',
    'pred-importem': 'Před importem',
    'pred-obnovenim': 'Před obnovením',
    'pred-migraci': 'Před úpravou databáze',
};
const backupModal = document.getElementById('backupModal');
const casZalohy = z => `${formatDatum(z.cas.slice(0, 10))} ${z.cas.slice(11, 16)}`;

async function otevritZalohy() {
    const zalohy = await SeznamZaloh() || [];
    document.getElementById('backupModalText').textContent = zalohy.length
        ? 'Databáze se vrátí do stavu vybrané zálohy. Současný stav se předtím uloží jako další záloha, takže jde vrátit i obnovení. Heslo zůstane současné.'
        : 'Zatím není žádná záloha. Vzniká jednou denně při spuštění a před každým mazáním a importem.';
    document.getElementById('backupModalList').innerHTML = zalohy.map(z => `
        <li>
            <strong>${esc(casZalohy(z))}</strong>
            <span>${esc(NAZVY_ZALOH[z.duvod] || z.duvod)} · ${z.poskozena ? 'nejde přečíst' : `modelek ${z.modelek}, fotek ${z.fotek}`}</span>
            <button class="btn btn-secondary btn-small" data-obnovit="${esc(z.soubor)}" data-popis="${esc(casZalohy(z))}" ${z.poskozena ? 'disabled' : ''}>Obnovit</button>
        </li>`).join('');
    backupModal.classList.remove('hidden');
}

document.getElementById('backupModalList').addEventListener('click', async (e) => {
    const tlacitko = e.target.closest('[data-obnovit]');
    if (!tlacitko || tlacitko.disabled) return;
    if (!await potvrdit('Obnovit ze zálohy', `Vrátit databázi do stavu z ${tlacitko.dataset.popis}? Vše, co bylo změněno potom, zmizí; současný stav se ale předtím uloží jako záloha „Před obnovením“.`, 'Obnovit')) return;

    // Druhý klik během obnovování nesmí spustit další
    tlacitko.disabled = true;
    const chyba = await ObnovitZalohu(tlacitko.dataset.obnovit);
    if (chyba) {
        tlacitko.disabled = false;
        oznamit(chyba, { text: 'Rozumím', akce: () => {} });
        return;
    }
    backupModal.classList.add('hidden');
    stenaData = coveryData = kalendarData = null;
    prepnoutRezim('modelky');
    searchInput.value = '';
    nacistGalerii();
    oznamit(`Databáze je obnovená do stavu z ${tlacitko.dataset.popis}.`);
});

document.addEventListener('contextmenu', (e) => {
    // V textových polích a v modálních oknech vlastní nabídku nezobrazujeme
    if (e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    if (zamceno) return;

    // Buňka přehledu: označit údaj „netýká se", nebo označení zrušit
    const bunkaPrehledu = e.target.closest('#stats td[data-klic]');
    if (bunkaPrehledu) {
        const oznacena = Boolean(bunkaPrehledu.dataset.netyka);
        otevritKontextovouNabidku(e.clientX, e.clientY, oznacena
            ? [{ text: 'Znovu sledovat (týká se)', akce: () => oznacitNetykaSe(bunkaPrehledu, false) }]
            : [
                { text: 'Doplnit', akce: () => bunkaPrehledu.click() },
                { text: 'Netýká se – přestat sledovat', akce: () => oznacitNetykaSe(bunkaPrehledu, true) },
            ]);
        return;
    }
    if (e.target.closest('.modal-overlay, .lightbox')) {
        zavritKontextovouNabidku();
        return;
    }

    const card = e.target.closest('.card');
    let polozky;

    if (card) {
        const id = parseInt(card.getAttribute('data-id'));
        const modelka = nacteneModelky.find(item => item.id === id);
        if (!modelka) return;
        polozky = [
            { text: 'Editovat', akce: () => otevritModelModal(modelka) },
            { text: 'Upravit výřez titulní fotky', akce: () => upravitVyrez(modelka) },
            { text: 'Smazat', akce: () => smazatModelku(modelka) },
            { text: 'Přidat fotky / album', akce: () => otevritAlbumModal(modelka) },
        ];
    } else if (e.target.closest('.wall-item')) {
        // Centerfold na stěně plakátů
        const index = parseInt(e.target.closest('.wall-item').dataset.index);
        polozky = [
            { text: 'Otevřít centerfold', akce: () => otevritLightbox(index, false, stenaPolozky) },
            { text: 'Otevřít profil modelky', akce: () => otevritProfilPodleId(stenaPolozky[index].modelkaId) },
            { text: `Otevřít vydání ${nazevVydani(stenaPolozky[index].album)}`, akce: () => otevritVydani(stenaPolozky[index].album) },
        ];
    } else if (e.target.closest('.album')) {
        // Album v profilu modelky, případně konkrétní fotka v něm
        const album = aktualniAlba[parseInt(e.target.closest('.album').dataset.album)];
        const centerfold = album.typ === 'Centerfold';
        const prvekPolozky = e.target.closest('[data-index]');
        const prvekFotky = e.target.closest('[data-foto-id]');

        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            polozky.push({ text: centerfold ? 'Otevřít centerfold' : 'Otevřít fotku', akce: () => otevritLightbox(index) });

            const fotka = prvekFotky && album.fotky.find(f => f.id === parseInt(prvekFotky.dataset.fotoId));
            if (fotka) {
                polozky.push({
                    text: 'Nastavit jako titulní fotku',
                    akce: async () => {
                        if (!await SetTitulniFotka(aktualniModelka.id, fotka.id)) return;
                        oznamit('Titulní fotka změněna. Výřez na kartě se vrátil na výchozí.');
                        otevritProfilPodleId(aktualniModelka.id);
                    },
                });
                polozky.push({ text: album.spojit ? 'Odebrat tuto stránku' : 'Odebrat fotku', akce: () => smazatFotku(fotka, album) });
                polozky.push(
                    { text: 'Otevřít na Google Disku', akce: () => BrowserOpenURL(odkazNaDisk(fotka)) },
                    { text: 'Kopírovat odkaz', akce: () => kopirovatText(odkazNaDisk(fotka)) },
                );
                // Stránky spojeného plakátu se nedají přetáhnout, řadí se po jedné
                if (album.spojit) {
                    const misto = album.fotky.indexOf(fotka);
                    if (misto > 0) polozky.push({ text: 'Posunout stránku dřív', akce: () => posunoutStranku(album, fotka, -1) });
                    if (misto < album.fotky.length - 1) polozky.push({ text: 'Posunout stránku později', akce: () => posunoutStranku(album, fotka, 1) });
                }
            }
            polozky.push(null);
        }
        if (album.vydani) {
            polozky.push({ text: `Otevřít vydání ${nazevVydani(album.vydani)}`, akce: () => otevritVydani(album.vydani) });
        }
        if (centerfold && album.fotky.length > 1) {
            polozky.push({
                text: album.spojit ? 'Rozdělit plakát na samostatné fotky' : 'Spojit stránky do jednoho plakátu',
                akce: async () => {
                    await SetSpojeniAlba(album.modelkaId, album.album, album.typ, !album.spojit);
                    nacistFotkyModelky(aktualniModelka.id);
                },
            });
        }
        if (album.rucniPoradi && !centerfold) {
            polozky.push({
                text: 'Řadit album podle srdíček',
                akce: async () => {
                    await ZrusitPoradiAlba(album.modelkaId, album.album, album.typ);
                    nacistFotkyModelky(aktualniModelka.id);
                },
            });
        }
        const mrizka = e.target.closest('.album').querySelector('.photos-grid.zkracena, .photos-grid.rozbalena');
        if (mrizka) {
            const zkracena = mrizka.classList.contains('zkracena');
            polozky.push({ text: zkracena ? 'Rozbalit album' : 'Sbalit album', akce: () => prepnoutRozbaleniAlba(mrizka, zkracena) });
        }
        // Úpravy alba jdou vždy na jeho hlavní modelku, i když je otevřený profil další modelky
        const vlastnik = { id: album.modelkaId, jmeno: '' };
        polozky.push(
            { text: 'Spustit slideshow alba', akce: () => otevritLightbox(aktualniPolozky.indexOf(album.polozky[0]), true) },
            { text: 'Upravit album / přidat fotky', akce: () => otevritAlbumModal(vlastnik, album) },
            null,
            { text: 'Přidat další modelku k albu…', akce: () => pridatModelkuKAlbu(album) },
            ...album.dalsiModelky.map(m => ({ text: `Odebrat z alba: ${m.jmeno}`, akce: async () => {
                await OdebratModelkuZAlba(album.modelkaId, album.album, album.typ, m.id);
                nacistFotkyModelky(aktualniModelka.id);
            } })),
            { text: 'Přesunout k jiné modelce…', akce: () => presunoutAlbum(album) },
            ...(aktualniAlba.some(a => a !== album && a.modelkaId === album.modelkaId)
                ? [{ text: 'Sloučit s jiným albem…', akce: () => sloucitAlbum(album) }] : []),
            { text: 'Smazat album', akce: () => smazatAlbum(album, album.fotky.length) },
            null,
            { text: 'Upravit modelku', akce: () => otevritModelModal(aktualniModelka) }
        );
    } else if (!issueView.classList.contains('hidden')) {
        // Stránka vydání: úpravy se dělají v profilu modelky a v přehledu coverů
        const prvekPolozky = e.target.closest('[data-index]');
        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            const polozka = vydaniPolozky[index];
            polozky.push({ text: 'Otevřít fotku', akce: () => otevritLightbox(index, false, vydaniPolozky) });
            if (polozka.modelkaId) {
                polozky.push({ text: `Otevřít profil: ${polozka.jmenoModelky}`, akce: () => otevritProfilPodleId(polozka.modelkaId) });
            }
            polozky.push(null);
        }
        polozky.push(
            { text: 'Spustit slideshow vydání', akce: () => otevritLightbox(0, true, vydaniPolozky) },
            { text: 'Zpět', akce: zpet }
        );
    } else if (!detailView.classList.contains('hidden')) {
        polozky = [
            { text: 'Editovat modelku', akce: () => otevritModelModal(aktualniModelka) },
            { text: 'Přidat fotky / album', akce: () => otevritAlbumModal(aktualniModelka) },
            { text: 'Zpět', akce: zpet },
        ];
    } else if (e.target.closest('.cover-item')) {
        // Cover časopisu
        const index = parseInt(e.target.closest('.cover-item').dataset.index);
        const cover = coveryPolozky[index];
        polozky = [
            { text: 'Otevřít vydání', akce: () => otevritVydani(cover.album) },
            { text: 'Zobrazit cover', akce: () => otevritLightbox(index, false, coveryPolozky) },
            { text: 'Upravit cover', akce: () => otevritCoverModal(cover) },
            { text: 'Smazat cover', akce: () => smazatCover(cover) },
        ];
    } else if (!calendar.classList.contains('hidden')) {
        // Kalendář vydání
        const obsazene = e.target.closest('[data-vydani]');
        const prazdne = e.target.closest('[data-prazdne]');
        polozky = [];
        if (obsazene) polozky.push({ text: `Otevřít vydání ${nazevVydani(obsazene.dataset.vydani)}`, akce: () => otevritVydani(obsazene.dataset.vydani) });
        if (obsazene || prazdne) {
            const klic = (obsazene || prazdne).dataset.vydani || prazdne.dataset.prazdne;
            polozky.push(...pridatKVydani(klic), null);
        }
        polozky.push(
            { text: 'Přidat cover', akce: () => otevritCoverModal() },
            { text: 'Obnovit', akce: () => nacistGalerii(searchInput.value) }
        );
    } else if (!covers.classList.contains('hidden')) {
        // Volný prostor v přehledu coverů
        polozky = [
            { text: 'Přidat cover', akce: () => otevritCoverModal() },
            { text: 'Obnovit', akce: () => nacistGalerii(searchInput.value) },
            { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        ];
    } else if (!wall.classList.contains('hidden')) {
        // Volný prostor na stěně centerfoldů
        polozky = [
            { text: 'Přidat centerfold', akce: pridatCenterfold },
            { text: 'Obnovit', akce: () => nacistGalerii(searchInput.value) },
            { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        ];
    } else {
        polozky = [{ text: 'Přidat modelku', akce: otevritRychlePridani }, ...polozkySpravy()];
    }

    otevritKontextovouNabidku(e.clientX, e.clientY, polozky);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#contextMenu')) zavritKontextovouNabidku();
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Esc zavře nabídku, jinak se z profilu vrátí na výběr modelek
    const okno = [...document.querySelectorAll('.modal-overlay:not(.hidden)')].pop();
    if (!contextMenu.classList.contains('hidden')) {
        zavritKontextovouNabidku();
    } else if (okno) {
        zavritOkno(okno);
    } else if (vybraneDlazdice().length) {
        zrusitVyber();
    } else if (!lightbox.classList.contains('hidden')) {
        // Esc nejdřív vypne lupu, teprve potom zavře prohlížeč
        if (lbLupa) lbPrepnoutLupu(false);
        else zavritLightbox();
    } else if (zrusitUpravuVyrezu) {
        zrusitUpravuVyrezu();
    } else if ((!detailView.classList.contains('hidden') || !issueView.classList.contains('hidden')) && !document.querySelector('.modal-overlay:not(.hidden)')) {
        zpet();
    }
});
window.addEventListener('blur', zavritKontextovouNabidku);
window.addEventListener('resize', zavritKontextovouNabidku);

// Výběr nebo zadání jedné hodnoty s našeptáváním; vrací napsaný text, nebo null po zrušení
const pickModal = document.getElementById('pickModal');
let pickVyreseni = null;

function vybratHodnotu({ nadpis, text = '', popisek, moznosti = [], tlacitko = 'Pokračovat', vychozi = '' }) {
    pickVyreseni?.(null);
    document.getElementById('pickModalTitle').textContent = nadpis;
    document.getElementById('pickModalText').textContent = text;
    document.getElementById('pickModalLabel').textContent = popisek;
    document.getElementById('pickSubmitBtn').textContent = tlacitko;
    document.getElementById('seznamPick').innerHTML = moznosti.map(m => `<option value="${esc(m)}"></option>`).join('');
    const pole = document.getElementById('inputPick');
    pole.value = vychozi;
    pickModal.classList.remove('hidden');
    pole.focus();
    pole.select();
    return new Promise(vyreseno => { pickVyreseni = vyreseno; });
}

document.getElementById('pickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const hodnota = document.getElementById('inputPick').value.trim();
    if (!hodnota) return;
    pickModal.classList.add('hidden');
    pickVyreseni?.(hodnota);
    pickVyreseni = null;
});

// Modelka podle jména z výběrového okna (jiná než vynechané)
async function vybratModelku(nadpis, text, tlacitko, vynechat = []) {
    const modelky = (await GetModelky('') || []).filter(m => !vynechat.includes(m.id));
    const jmeno = await vybratHodnotu({ nadpis, text, popisek: 'Modelka', moznosti: modelky.map(m => m.jmeno), tlacitko });
    if (!jmeno) return null;
    const modelka = modelky.find(m => sjednotit(m.jmeno) === sjednotit(jmeno));
    if (!modelka) oznamit(`Modelka „${jmeno}“ ve sbírce není. Napiš jméno tak, jak ho nabízí seznam.`);
    return modelka || null;
}

// Údaje odebrané fotky, aby ji šlo tlačítkem Vrátit vrátit
const obnovaFotky = (f, album) => ({
    modelkaId: f.modelkaId, album: f.album, typ: f.typ, driveId: f.driveId, vydani: f.vydani || '', rotace: f.rotace || 0,
    spojit: Boolean(f.spojit), hodnoceni: f.hodnoceni || 0, poradi: f.poradi || 0, pridano: f.pridano || '',
    popis: album?.popis || '', fotograf: album?.fotograf || '',
});

// Odkaz na fotku na Google Disku
const odkazNaDisk = f => `https://drive.google.com/file/d/${f.driveId}/view`;

async function kopirovatText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // Bez přístupu ke schránce přes skryté pole
        const pole = document.createElement('textarea');
        pole.value = text;
        document.body.appendChild(pole);
        pole.select();
        document.execCommand('copy');
        pole.remove();
    }
    oznamit('Odkaz je zkopírovaný.');
}

// Zavření modálního okna klávesou Esc nebo tlačítkem Zrušit; potvrzovací okno přitom ohlásí zrušení
function zavritOkno(okno) {
    if (okno === deleteModal) zavritDeleteModal();
    else okno.classList.add('hidden');
    if (okno === pickModal) {
        pickVyreseni?.(null);
        pickVyreseni = null;
    }
}
document.addEventListener('click', (e) => {
    const zrusit = e.target.closest('[data-zavrit]');
    if (zrusit) zavritOkno(zrusit.closest('.modal-overlay'));
});

// Formulář: Přidat Modelku
document.getElementById('addModelForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    // Údaje, které ve formuláři nejsou (míry bez obvodů, starší textová vydání), zůstávají při úpravě původní
    const modelka = editovanaModelka
        ? { ...editovanaModelka }
        : { id: 0, miry: '', vystoupeni: '', pictorialVydani: '' };
    poleModelky.forEach(([vlastnost, id, typ]) => {
        const prvek = document.getElementById(id);
        if (typ === 'cislo') modelka[vlastnost] = parseInt(prvek.value) || 0;
        else modelka[vlastnost] = prvek.value.trim();
    });
    // Pole, které neopustil (a nepřevedlo se), se převede teď
    modelka.vyskaCm = prevestVysku(document.getElementById('inputVyska').value) ?? modelka.vyskaCm;
    modelka.vahaKg = prevestVahu(document.getElementById('inputVaha').value) ?? modelka.vahaKg;
    // Neúplné datum narození (jen rok) pole pro datum neumí zobrazit; prázdné pole ho proto nesmí smazat
    const puvodniDatum = editovanaModelka?.narozeniDatum || '';
    if (!modelka.narozeniDatum && puvodniDatum && !/^\d{4}-\d{2}-\d{2}$/.test(puvodniDatum)) modelka.narozeniDatum = puvodniDatum;

    // Jméno je jediný povinný údaj; leží na první záložce, která nemusí být zrovna vidět
    if (!modelka.jmeno) {
        ukazatZalozku(0);
        document.getElementById('inputJmeno').focus();
        oznamit('Vyplň jméno modelky.');
        return;
    }
    if (!await odkazJeVPoradku(modelka.coverId)) {
        ukazatZalozku(0);
        return;
    }

    if (!editovanaModelka && !await neniDuplicitni(modelka)) return;

    const ulozeno = editovanaModelka ? await UpdateModelka(modelka) : await AddModelka(modelka);
    if (!ulozeno) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return;
    }
    // Doplňování v řadě: další modelka z tabulky Přehledu, na stejné záložce a v prvním chybějícím poli
    if (e.submitter?.id === 'modelNextBtn' && frontaDoplnovani) {
        const fronta = frontaDoplnovani;
        const poradi = prehledPoradi;
        const dalsiId = poradi[poradi.indexOf(editovanaModelka.id) + 1];
        const dalsi = dalsiId && (await GetModelky('') || []).find(m => m.id === dalsiId);
        if (dalsi) {
            otevritModelModal(dalsi, fronta);
            ukazatZalozku(fronta.zalozka);
            const skupina = SKUPINY_UDAJU.find(sk => sk.zalozka === fronta.zalozka);
            const prvni = skupina?.udaje.find(([vlastnost]) => udajChybi(dalsi, vlastnost));
            document.getElementById(prvni ? prvni[2] : 'inputJmeno').focus();
            if (!stats.classList.contains('hidden')) nacistPrehled();
            return;
        }
        oznamit('To byla poslední modelka v tabulce.');
    }
    modelModal.classList.add('hidden');
    // Úprava z profilu se vrací do profilu, jinak do přehledu
    if (editovanaModelka && !detailView.classList.contains('hidden')) otevritProfilPodleId(editovanaModelka.id);
    else nacistGalerii(searchInput.value);
});

// Formulář: Hromadné fotky do alba
document.getElementById('addAlbumForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const typ = document.getElementById('selectTyp').value;
    const rok = document.getElementById('inputAlbumRok').value;
    const mesic = document.getElementById('selectAlbumMesic').value;
    // Pictorialu stačí ročník, měsíc bez roku ale nedává smysl
    if (mesic && !rok) {
        oznamit('K měsíci vydání chybí rok.');
        return;
    }
    const links = document.getElementById('inputBulkLinks').value;
    if (jeOdkazNaSlozku(links)) return;

    // Modelka vybraná v okně; neznámé jméno založí novou
    if (!document.getElementById('albumModelkaGroup').classList.contains('hidden')) {
        const vybrana = await vybratNeboZalozitModelku(document.getElementById('inputAlbumModelka').value);
        if (!vybrana) return;
        modelkaAlba = vybrana;
    }
    const modelka = modelkaAlba;
    const vydani = slozitVydani(rok, mesic, document.getElementById('selectAlbumEdice').value);
    const album = typ === 'Centerfold' ? vydani : document.getElementById('inputAlbumName').value.trim();

    if (editovaneAlbum && !await UpdateAlbum(modelka.id, editovaneAlbum.album, editovaneAlbum.typ, album, typ)) {
        oznamit('Album se nepodařilo uložit. Modelka už nejspíš má jiné album se stejným názvem a typem.');
        return;
    }
    if (links.trim()) {
        oznamitVlozeni(await AddBulkPhotos(modelka.id, album, typ, links), 'fotek');
    }
    // Centerfold má vydání přímo v názvu alba, ostatním se přiřazuje zvlášť
    // Při přidávání fotek do existujícího alba prázdné pole jeho vydání nemaže; zrušit ho jde jen úpravou alba
    if (typ !== 'Centerfold' && (editovaneAlbum || vydani)) {
        await SetVydaniAlba(modelka.id, album, typ, vydani);
    }
    // Při přidávání fotek do existujícího alba prázdná pole jeho text nemažou
    const popis = document.getElementById('inputAlbumPopis').value;
    const fotograf = document.getElementById('inputAlbumFotograf').value;
    if (editovaneAlbum || popis.trim() || fotograf.trim()) {
        await SetPopisAlba(modelka.id, album, typ, popis, fotograf);
    }

    if (e.submitter?.name === 'dalsi' && !editovaneAlbum) {
        // Další album téže modelky: modelka, typ, fotograf a vydání zůstávají, vyprázdní se jen název, odkazy a text
        ['inputAlbumName', 'inputBulkLinks', 'inputAlbumPopis'].forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById(typ === 'Centerfold' ? 'inputBulkLinks' : 'inputAlbumName').focus();
    } else {
        albumModal.classList.add('hidden');
        document.getElementById('addAlbumForm').reset();
    }
    obnovitPoUlozeniAlba(modelka);
});

// Po uložení alba se obnoví to, co je vidět
function obnovitPoUlozeniAlba(modelka) {
    stenaData = coveryData = kalendarData = null;
    if (!detailView.classList.contains('hidden')) {
        if (aktualniModelka?.id === modelka.id) nacistFotkyModelky(modelka.id);
    } else if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
    // Z přehledu se doplňuje centerfold; po uložení má z tabulky zmizet
    else if (!stats.classList.contains('hidden')) nacistPrehled();
    else if (!issueView.classList.contains('hidden')) obnovitStranku();
    else if (!calendar.classList.contains('hidden')) nacistKalendar(searchInput.value);
}

// Hledání se spouští až po krátké pauze v psaní; v Přehledu se nehledá
let casovacHledani = null;
searchInput.addEventListener('input', () => {
    clearTimeout(casovacHledani);
    casovacHledani = setTimeout(() => {
        if (rezim !== 'prehled') nacistGalerii(searchInput.value, true);
    }, 180);
});
// Chyby z backendu se ukazují v okně, ne jen v konzoli
EventsOn('chyba', (zprava) => oznamit(zprava));
StavDatabaze().then((chyba) => {
    if (chyba) oznamit(chyba, { text: 'Rozumím', akce: () => {} });
});

// Spuštění: nejdřív případný zámek, potom přehled, ve kterém se program naposledy zavřel
(async () => {
    maZamek = await MaZamek();
    if (maZamek) await odemknoutPriStartu();

    let posledni = null;
    try { posledni = localStorage.getItem('posledniRezim'); } catch { /* bez úložiště začne galerií */ }
    if (viewToggle.querySelector(`[data-rezim="${posledni}"]`)) prepnoutRezim(posledni);
    nacistGalerii();
    kontrolaPoSpusteni();
})();