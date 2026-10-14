// Galerie modelek, srdíčka, filtr hodnocení a krokování mezi modelkami
import { GetModelky, SetHodnoceni, SetHodnoceniFotek } from './backend';
import { contextMenu } from '../ui/nabidka';
import { bezDiakritiky, esc, RAZENI_GALERIE, castGalerie, seraditModelky, sklonovat } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { otevritRychlePridani } from './formular-modelky';
import { importovatData, otevritHeslo } from './sprava';
import { otevritNapovedu } from './napoveda';
import { detailView, gallery, searchInput } from './prvky';
import { listaGalerie } from './listy';
import { adresaTitulni } from './obrazky';
import { prepnoutRezim, stylVyrezu, ukazatPohled, zapamatovatMisto } from './navigace';
import { MODELEK_PRO_PISMENA, otevritDetailModelky } from './profil';
import { nacistCovery, nacistStenu } from './stena';
import { nacistKalendar } from './kalendar';
import { nacistPrehled } from './prehled';
import { nacistNejlepsi } from './nejlepsi';
import { lightbox } from './prohlizec';
import { vybraneDlazdice } from './vyber';
import { prevestNaVolby } from '../ui/volby';

// Hodnocení 1–5 srdíček; klik na N-té nastaví N, klik na současné hodnocení ho zruší
export function htmlSrdicek(hodnoceni, atribut) {
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="heart ${n <= hodnoceni ? 'on' : ''}" data-hodnota="${n}"
            title="${n === hodnoceni ? 'Zrušit hodnocení' : `Ohodnotit ${n} z 5`}"></button>`).join('');
    return `<span class="hearts ${hodnoceni ? 'rated' : ''}" ${atribut}>${srdicka}</span>`;
}

export function htmlSrdicka(modelka) {
    return htmlSrdicek(modelka.hodnoceni, `data-hodnoceni="${modelka.id}"`);
}

// Srdíčka fotky; index míří do seznamu položek právě zobrazeného pohledu
export function htmlSrdickaFotky(polozka, index) {
    return htmlSrdicek(polozka.hodnoceni, `data-hodnoceni-fotky="${index}"`);
}

export async function ohodnotitPolozku(polozka, zvoleno) {
    const nove = zvoleno === polozka.hodnoceni ? 0 : zvoleno;
    if (!await SetHodnoceniFotek(polozka.fotky.map(f => f.id), nove)) return false;
    polozka.hodnoceni = nove;
    polozka.fotky.forEach(f => { f.hodnoceni = nove; });
    return true;
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

// Řádek voleb nad kartami (řazení a filtr srdíček), stejně jako u stěny centerfoldů a nejlepších fotek
function htmlNastroju(pocet) {
    const razeni = Object.entries(RAZENI_GALERIE).map(([klic, r]) => `
        <button class="chip ${klic === stav.razeniGalerie ? 'active' : ''}" data-razeni-galerie="${klic}" title="Řadit ${r.nazev}">${r.popisek}</button>`).join('');
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="chip ${n === stav.minHodnoceni ? 'active' : ''}" data-min-hodnoceni="${n}"
            title="${n === stav.minHodnoceni ? 'Zobrazit všechny modelky' : `Jen modelky s hodnocením ${n}${n < 5 ? ' a více' : ''}`}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('');
    return `<div class="gallery-toolbar">${razeni}<span class="oddelovac"></span>${srdicka}
        <span>${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}</span></div>`;
}

// Předchozí a další modelka v pořadí, v jakém jsou v galerii
export async function krokModelky(smer) {
    if (!stav.aktualniModelka) return;
    let seznam = stav.nacteneModelky;
    if (!seznam.some(m => m.id === stav.aktualniModelka.id)) {
        seznam = stav.nacteneModelky = await vsechnyModelky();
    }
    const index = seznam.findIndex(m => m.id === stav.aktualniModelka.id);
    if (index < 0 || seznam.length < 2) return;
    // Listování mezi modelkami historii neplní, Zpět vede tam, odkud se do profilů přišlo
    otevritDetailModelky(seznam[(index + smer + seznam.length) % seznam.length], { bezHistorie: true });
}

// Klik na údaj v profilu vyhledá všechny modelky se stejnou hodnotou
export function hledatHodnotu(hodnota) {
    stav.minHodnoceni = 0;
    zapamatovatMisto({});
    prepnoutRezim('modelky');
    searchInput.value = hodnota;
    nacistGalerii(hodnota);
}

// Načtení Hlavní Galerie
// zMezipameti = jen přefiltrovat data načtená minule (psaní do hledání), nenačítat je znovu z databáze
export async function nacistGalerii(dotaz = '', zMezipameti = false) {
    if (stav.rezim === 'centerfoldy') return nacistStenu(dotaz, zMezipameti);
    if (stav.rezim === 'covery') return nacistCovery(dotaz, zMezipameti);
    if (stav.rezim === 'kalendar') return nacistKalendar(dotaz, zMezipameti);
    if (stav.rezim === 'prehled') return nacistPrehled();
    if (stav.rezim === 'nejlepsi') return nacistNejlepsi(dotaz, zMezipameti);

    const moje = ++stav.cisloNacteni;
    const vsechny = await GetModelky(dotaz) || [];
    if (moje !== stav.cisloNacteni) return;
    // Zvolené řazení (stabilní: při shodě zůstává pořadí podle jména z backendu). Se zapnutým filtrem ♡
    // jdou při řazení podle jména nejlépe hodnocené první.
    const modelky = seraditModelky(vsechny.filter(m => m.hodnoceni >= stav.minHodnoceni), stav.razeniGalerie);
    if (stav.minHodnoceni && stav.razeniGalerie === 'jmeno') modelky.sort((a, b) => b.hodnoceni - a.hodnoceni);
    stav.nacteneModelky = modelky;
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(gallery);

    // Prázdná sbírka: úvod s prvními kroky místo prázdné galerie
    if (vsechny.length === 0 && !dotaz.trim()) {
        listaGalerie.naplnit([]);
        gallery.innerHTML = HTML_UVODU;
        return;
    }
    if (modelky.length === 0) {
        listaGalerie.naplnit([]);
        gallery.innerHTML = htmlNastroju(0) + `<div class="empty-state">${
            stav.minHodnoceni ? `Žádná modelka nemá hodnocení ${stav.minHodnoceni}${stav.minHodnoceni < 5 ? ' nebo vyšší' : ''}. Hodnotí se srdíčky na kartě nebo v profilu.`
            : dotaz.trim() ? 'Hledání neodpovídá žádná modelka.'
            : 'Zatím žádné modelky. Přidej první tlačítkem + nahoře.'}</div>`;
        prevestNaVolby(gallery.querySelector('.gallery-toolbar'));
        return;
    }

    gallery.innerHTML = htmlNastroju(modelky.length) + modelky.map(m => `
        <div class="card" data-id="${m.id}" tabindex="0" aria-label="${esc(m.jmeno)}">
            <div class="card-image-wrap">
                <img src="${esc(adresaTitulni(m))}" alt="${esc(m.jmeno)}" style="${stylVyrezu(m)}" draggable="false" loading="lazy" />
                ${htmlSrdicka(m)}
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}</h3>
            </div>
        </div>
    `).join('');
    prevestNaVolby(gallery.querySelector('.gallery-toolbar'));

    // Lišta částí: písmena, měsíce přidání nebo desetiletí; první karta každé části je cíl skoku.
    // Při řazení podle jména se zapnutým ♡ jsou karty seřazené podle srdíček a části nedávají smysl.
    if (!(stav.minHodnoceni && stav.razeniGalerie === 'jmeno') && modelky.length >= MODELEK_PRO_PISMENA) {
        const casti = new Map();
        const podleId = new Map(modelky.map(m => [m.id, m]));
        modelky.forEach(m => { const c = castGalerie(m, stav.razeniGalerie); casti.set(c, (casti.get(c) || 0) + 1); });
        const videna = new Set();
        gallery.querySelectorAll('.card').forEach(karta => {
            const c = castGalerie(podleId.get(parseInt(karta.dataset.id)), stav.razeniGalerie);
            if (!videna.has(c)) {
                videna.add(c);
                karta.dataset.cast = c;
            }
        });
        listaGalerie.naplnit([...casti].map(([c, pocet]) => ({ klic: c, nazev: c, pocet })));
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

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Tlačítka úvodu prázdné sbírky
    gallery.addEventListener('click', (e) => {
        const akce = e.target.closest('[data-uvod]')?.dataset.uvod;
        if (akce === 'modelka') otevritRychlePridani();
        else if (akce === 'import') importovatData();
        else if (akce === 'heslo') otevritHeslo();
        else if (akce === 'napoveda') otevritNapovedu();

        // Řádek voleb nad kartami
        const razeni = e.target.closest('[data-razeni-galerie]')?.dataset.razeniGalerie;
        const minimum = e.target.closest('[data-min-hodnoceni]')?.dataset.minHodnoceni;
        if (razeni) {
            stav.razeniGalerie = razeni;
            try { localStorage.setItem('razeniGalerie', razeni); } catch { /* jen pro toto spuštění */ }
            nacistGalerii(searchInput.value);
        } else if (minimum) {
            // Klik na zvolený filtr ho zruší
            stav.minHodnoceni = Number(minimum) === stav.minHodnoceni ? 0 : Number(minimum);
            nacistGalerii(searchInput.value);
        }
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

    // Srdíčka na kartě i v profilu
    document.querySelector('main').addEventListener('click', async (e) => {
        const srdicko = e.target.closest('.hearts .heart');
        if (!srdicko) return;
        const rada = srdicko.closest('.hearts');
        const id = parseInt(rada.dataset.hodnoceni);
        const modelka = [stav.aktualniModelka, ...stav.nacteneModelky].find(m => m && m.id === id);
        if (!modelka) return;

        const zvoleno = parseInt(srdicko.dataset.hodnota);
        const nove = zvoleno === modelka.hodnoceni ? 0 : zvoleno;
        if (!await SetHodnoceni(id, nove)) return;

        // Tatáž modelka může být načtená v galerii i otevřená v profilu
        [stav.aktualniModelka, ...stav.nacteneModelky].filter(m => m && m.id === id).forEach(m => { m.hodnoceni = nove; });
        nahraditSrdicka(rada, htmlSrdicka(modelka), srdicko.dataset.hodnota);
        if (stav.minHodnoceni && !gallery.classList.contains('hidden')) nacistGalerii(searchInput.value);
    });

    try {
        const ulozene = localStorage.getItem('razeniGalerie');
        if (RAZENI_GALERIE[ulozene]) stav.razeniGalerie = ulozene;
    } catch { /* výchozí řazení podle jména */ }
    document.getElementById('prevModelBtn').onclick = () => krokModelky(-1);

    document.getElementById('nextModelBtn').onclick = () => krokModelky(1);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        // Alt + šipka je Zpět, s Ctrl a ve výběru fotek se šipkami nelistuje
        const zamestnano = detailView.classList.contains('hidden')
            || e.altKey || e.ctrlKey || e.metaKey
            || !lightbox.classList.contains('hidden')
            || !contextMenu.classList.contains('hidden')
            || document.querySelector('.modal-overlay:not(.hidden)')
            || vybraneDlazdice().length
            || e.target.closest('input, textarea, select');
        if (!zamestnano) krokModelky(e.key === 'ArrowRight' ? 1 : -1);
    });
}
