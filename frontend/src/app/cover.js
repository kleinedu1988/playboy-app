// Okno coveru a otevření profilu ze stěny
import { nazevVydani, obrazek, paskaCisla, rozlozitVydani, slozitVydani } from '../lib/format';
import { jednou, oznamit } from '../ui/oznameni';
import { AddCover, UpdateCover } from './backend';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { issueView, searchInput, stats, wall } from './prvky';
import { historie, jeOdkazNaSlozku, odkazJeVPoradku, oznamitVlozeni, prepinacRezimu, prepnoutRezim, zobrazeniCisel } from './navigace';
import { zvolitCastPrehledu } from './prehled';
import { nastavitCastOblibenosti, nastavitNejlepsiVOblibenosti, posledniCastOblibenosti } from './oblibenost';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { obnovitStranku } from './vydani';
import { otevritLightbox } from './prohlizec';
import { pripojitVyberSpecialu } from './specialy';
import { nastavitPohledSlavy, pohledSlavy } from './sin-slavy';
import { zavritOkno } from './ulozeni';
import { VELIKOST_PLAKATU_MALA, adresyOdkazu } from './obrazky';
import { jeVidet, otevreneOkno } from '../ui/dom';

// Speciály zvoleného roku a edice mají vlastní výběr vedle měsíců
let obnovitSpecialyCoveru = (_vybrat) => {};

// Číslo coveru: řádné měsíční, nebo speciál; viditelný je jen jeden výběr a jen ten je povinný
function nastavitCisloCoveru(cislo) {
    const special = cislo === 'special';
    document.querySelectorAll('[data-cislo-coveru]').forEach(b => {
        b.classList.toggle('active', b.dataset.cisloCoveru === cislo);
        b.setAttribute('aria-pressed', String(b.dataset.cisloCoveru === cislo));
    });
    const mesic = /** @type {HTMLSelectElement} */ (document.getElementById('selectCoverMesic'));
    const vyberSpecialu = /** @type {HTMLSelectElement} */ (document.getElementById('selectCoverSpecial'));
    mesic.classList.toggle('hidden', special);
    vyberSpecialu.classList.toggle('hidden', !special);
    mesic.required = !special;
    vyberSpecialu.required = special;
    const popisek = /** @type {HTMLLabelElement} */ (document.getElementById('coverMesicLabel'));
    popisek.textContent = special ? 'Speciál' : 'Měsíc';
    popisek.htmlFor = special ? 'selectCoverSpecial' : 'selectCoverMesic';
    ukazatCisloCoveru();
}
const vyberCislaCoveru = () => /** @type {HTMLSelectElement} */ (document.getElementById(
    document.getElementById('selectCoverSpecial').classList.contains('hidden') ? 'selectCoverMesic' : 'selectCoverSpecial'));

// Náhled vlevo: název čísla a páska jako na obálce v Číslech; u speciálu bez roku nápověda, kde se speciály vezmou
function ukazatCisloCoveru() {
    const rok = /** @type {HTMLInputElement} */ (document.getElementById('inputCoverRok')).value;
    const special = !document.getElementById('selectCoverSpecial').classList.contains('hidden');
    const vydani = /^\d{4}$/.test(rok) ? slozitVydani(rok, vyberCislaCoveru().value, document.getElementById('selectCoverEdice').value) : '';
    const uplne = Boolean(rozlozitVydani(vydani)?.mesic);
    document.getElementById('coverNahledNazev').textContent = uplne ? nazevVydani(vydani) : special ? 'Vyber rok a speciál' : 'Vyber měsíc a rok';
    const paska = document.getElementById('coverNahledPaska');
    paska.textContent = uplne ? paskaCisla(vydani) : '';
    paska.classList.toggle('hidden', !uplne);
    document.getElementById('coverSpecialInfo').textContent = special && !/^\d{4}$/.test(rok) ? 'Speciály roku se nabídnou po zadání roku.' : '';
}

// Obrázek náhledu; bez adresy zástupný text. Nenačtený obrázek nahradí „Nenačteno“ společná obsluha v obrazky.js
function ukazatObalkuCoveru(adresa) {
    const img = /** @type {HTMLImageElement} */ (document.getElementById('coverNahledObrazek'));
    if (adresa) {
        if (img.getAttribute('src') !== adresa) img.src = adresa;
    } else {
        img.removeAttribute('src');
    }
    img.classList.toggle('hidden', !adresa);
    document.getElementById('coverNahledPrazdny').classList.toggle('hidden', Boolean(adresa));
}

// Náhled z vloženého odkazu; bez odkazu u úpravy zůstane původní obálka
let puvodniObalka = '';
let poradiNahledu = 0;
async function nahledOdkazuCoveru() {
    const poradi = ++poradiNahledu;
    const [adresa] = await adresyOdkazu(/** @type {HTMLInputElement} */ (document.getElementById('inputCoverLink')).value, VELIKOST_PLAKATU_MALA);
    if (poradi === poradiNahledu) ukazatObalkuCoveru(adresa || puvodniObalka);
}

// Formulář coveru slouží pro přidání (polozka = null) i úpravu vydání
export const coverModal = document.getElementById('coverModal');

export function otevritCoverModal(polozka = null, predvyplnitVydani = '') {
    stav.editovanyCover = polozka;
    document.getElementById('coverForm').reset();
    document.getElementById('coverModalTitle').textContent = polozka ? 'Upravit cover' : 'Přidat cover';
    document.getElementById('coverLinkLabel').textContent = polozka
        ? 'Nový odkaz z Google Disku (nepovinné, jinak zůstane původní obrázek)'
        : 'Odkaz na cover z Google Disku';
    document.getElementById('inputCoverLink').required = !polozka;

    const vydani = rozlozitVydani(polozka ? polozka.album : predvyplnitVydani);
    if (vydani?.mesic) document.getElementById('inputCoverRok').value = vydani.rok;
    // Bez předvyplněného vydání se nabídne edice zobrazená v kalendáři
    document.getElementById('selectCoverEdice').value = vydani?.edice || stav.kalendarEdice;
    const special = Boolean(vydani?.mesic?.startsWith('S'));
    obnovitSpecialyCoveru(special ? vydani.mesic : '');
    document.getElementById('selectCoverMesic').value = special ? '' : vydani?.mesic || '';
    nastavitCisloCoveru(special ? 'special' : 'mesic');
    puvodniObalka = polozka?.fotky?.[0]?.url ? obrazek(polozka.fotky[0].url, VELIKOST_PLAKATU_MALA) : '';
    poradiNahledu++;
    ukazatObalkuCoveru(puvodniObalka);
    coverModal.classList.remove('hidden');
    // S předvyplněným vydáním zbývá jen vložit odkaz
    (vydani && !polozka ? document.getElementById('inputCoverLink') : vyberCislaCoveru()).focus();
}

export async function otevritProfilPodleId(modelkaId) {
    const modelka = (await vsechnyModelky()).find(m => m.id === modelkaId);
    if (modelka) otevritDetailModelky(modelka);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    obnovitSpecialyCoveru = pripojitVyberSpecialu('selectCoverSpecial', 'inputCoverRok', 'selectCoverEdice');
    document.getElementById('coverForm').addEventListener('click', (e) => {
        const cislo = /** @type {HTMLElement} */ (e.target).closest('[data-cislo-coveru]');
        if (cislo) nastavitCisloCoveru(cislo.dataset.cisloCoveru);
    });
    ['input', 'change'].forEach(udalost => document.getElementById('coverForm').addEventListener(udalost, (e) => {
        if (/** @type {HTMLElement} */ (e.target).id !== 'inputCoverLink') ukazatCisloCoveru();
    }));
    document.getElementById('inputCoverLink').addEventListener('input', nahledOdkazuCoveru);

    document.getElementById('closeCoverModalBtn').onclick = () => zavritOkno(coverModal);

    document.getElementById('coverForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const vydani = slozitVydani(document.getElementById('inputCoverRok').value, vyberCislaCoveru().value, document.getElementById('selectCoverEdice').value);
        const odkaz = document.getElementById('inputCoverLink').value;
        if (jeOdkazNaSlozku(odkaz)) return;

        if (stav.editovanyCover) {
            if (!await odkazJeVPoradku(odkaz)) return;
            if (!await UpdateCover(stav.editovanyCover.fotky[0].id, vydani, odkaz)) {
                oznamit('Cover se nepodařilo uložit do databáze.');
                return;
            }
        } else {
            oznamitVlozeni(await AddCover(vydani, odkaz), 'coverů');
        }
        coverModal.classList.add('hidden');
        // Cover se přidává z přehledu coverů, z kalendáře, z přehledu sbírky a ze stránky vydání
        if (!issueView.classList.contains('hidden')) obnovitStranku();
        else nacistGalerii(searchInput.value);
    });

    wall.addEventListener('click', (e) => {
        const polozka = e.target.closest('.wall-item');
        if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, stav.stenaPolozky);
    });

    prepinacRezimu.addEventListener('click', (e) => {
        const tlacitko = e.target.closest('[data-rezim]');
        if (!tlacitko) return;
        // Zvolená sekce na přehledu otevře nabídku všech sekcí i s jejich částmi (skok rovnou na část); z profilu nebo
        // čísla vede zpět na přehled
        if (tlacitko.classList.contains('active') && !prepinacRezimu.classList.contains('podstranka')) {
            // Klik nesmí dojít k dokumentu, který nabídky klikem mimo ně zavírá (nabidky.js)
            e.stopPropagation();
            otevritNabidkuSekci(tlacitko);
            return;
        }
        // Přepnutí přehledu začíná novou historii; Čísla v naposledy zvoleném zobrazení
        historie.length = 0;
        const rezim = tlacitko.dataset.rezim;
        if (rezim === 'modelky') {
            prepnoutRezim('modelky');
            nacistGalerii(searchInput.value);
        } else if (rezim === 'covery') {
            prepnoutRezim(zobrazeniCisel() === 'kalendar' ? 'kalendar' : 'covery');
            nacistGalerii(searchInput.value);
        } else if (rezim === 'prehled') {
            // Hodnocení (Oblíbenost: Porovnat, Fotky, Pořadí, Síň slávy) nebo Sbírka, každá na naposledy zvolené části
            const naPrehledu = stav.rezim === 'prehled' && !stats.classList.contains('hidden');
            // Síň slávy je vlastní sekce (uvnitř část Oblíbenosti 'slava'): otevře ji obsluha její pilulky
            if (tlacitko.dataset.sekce === 'slava') return otevritCast('cast-modelek-pas', 'slava');
            nastavitNejlepsiVOblibenosti(false);
            if (tlacitko.dataset.sekce === 'hodnoceni' && stav.oblibenostCast === 'slava') nastavitCastOblibenosti(stav.hodnoceniPohled);
            if (zvolitCastPrehledu(tlacitko.dataset.sekce === 'hodnoceni' ? 'oblibenost' : 'sprava', naPrehledu)) return;
            prepnoutRezim('prehled');
            nacistGalerii(searchInput.value);
        }
    });

    // Ctrl+1 až Ctrl+5: přehledy a stránky v liště zleva doprava (Modelky … Sbírka), jako klik na ně. Číslo podle
    // klávesy, ne znaku: na české klávesnici je na „1“ znak „+“ (číslice jsou se Shiftem). Držení se neopakuje.
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const cislo = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1] || (/^[1-9]$/.test(e.key) ? e.key : '');
        if (!cislo) return;
        if (stav.zamceno || otevreneOkno() || jeVidet('lightbox')) return;
        const tlacitko = /** @type {HTMLElement | undefined} */ (prepinacRezimu.querySelectorAll('[data-rezim]')[Number(cislo) - 1]);
        if (!tlacitko) return;
        e.preventDefault();
        // Zkratka zvolené sekce nabídku sekcí neotevírá
        if (tlacitko.classList.contains('active') && !prepinacRezimu.classList.contains('podstranka')) return;
        if (!e.repeat) tlacitko.click();
    });

    // Volba Zobrazení v Číslech (Obálky / Kalendář): přepne přehled a zůstane na stejném roce
    document.addEventListener('click', async (e) => {
        const volba = /** @type {HTMLElement} */ (e.target).closest?.('[data-zobrazeni-cisel]');
        if (!volba) return;
        const cil = volba.dataset.zobrazeniCisel === 'kalendar' ? 'kalendar' : 'covery';
        if (cil === stav.rezim) return;
        const rok = viditelnyRok();
        historie.length = 0;
        prepnoutRezim(cil);
        await nacistGalerii(searchInput.value);
        if (rok) skocitNaRok(rok);
    });
}

// Rok na začátku viditelné části Čísel (Obálky: oddíl ročníku, Kalendář: řádek roku)
function viditelnyRok() {
    const hore = document.querySelector('main').getBoundingClientRect().top + 40;
    const oddily = [...document.querySelectorAll('#covers .rocnik-cisel[data-cast], #calendar .cal-year[data-rok]')].filter(o => /** @type {HTMLElement} */ (o).offsetParent);
    const oddil = /** @type {HTMLElement} */ (oddily.find(o => o.getBoundingClientRect().bottom > hore));
    return oddil ? parseInt(oddil.dataset.rok || oddil.dataset.cast) : 0;
}

// Posun na rok (nebo nejbližší, který v zobrazení je)
function skocitNaRok(rok) {
    const oddily = [...document.querySelectorAll('#covers .rocnik-cisel[data-cast], #calendar .cal-year[data-rok]')]
        .map(o => /** @type {HTMLElement} */ (o)).filter(o => o.offsetParent);
    const nejblizsi = oddily.sort((a, b) => Math.abs(parseInt(a.dataset.rok || a.dataset.cast) - rok) - Math.abs(parseInt(b.dataset.rok || b.dataset.cast) - rok))[0];
    nejblizsi?.scrollIntoView({ block: 'start' });
}

// Nabídka sekcí (klik na zvolenou sekci v navigační kapsli): všechny sekce a jejich části. Část se otevře stejně jako
// klikem na její pilulku: dočasné tlačítko s jejím atributem obslouží obsluha pilulek (document)
const CASTI_SEKCI = {
    modelky: [['cast-modelek-pas', 'profily', 'Profily'], ['cast-modelek-pas', 'galerie', 'Galerie']],
    covery: [['cast-cisel-pas', 'covery', 'Obálky'], ['cast-cisel-pas', 'kalendar', 'Kalendář'], ['cast-cisel-pas', 'centerfoldy', 'Centerfoldy']],
    hodnoceni: [['zobrazeni-prehledu', 'porovnat', 'Porovnat'], ['zobrazeni-prehledu', 'fotky', 'Hodnotit'], ['zobrazeni-prehledu', 'poradi', 'Pořadí']],
    slava: [['cast-modelek-pas', 'slava', 'Síň slávy']],
    sbirka: [['zobrazeni-prehledu', 'udrzba', 'Údržba'], ['zobrazeni-prehledu', 'uvod', 'Mapa čísel'], ['zobrazeni-prehledu', 'shanim', 'Sháním CZ'], ['zobrazeni-prehledu', 'statistiky', 'Statistiky']],
};
function otevritCast(atribut, klic) {
    const b = document.createElement('button');
    b.hidden = true;
    b.setAttribute(`data-${atribut}`, klic);
    document.body.append(b);
    b.click();
    b.remove();
}
// Pohledy částí, které je mají (třetí úroveň): v mapě sekcí pod svou částí; otevřou část rovnou na tom pohledu
const POHLEDY_CASTI = {
    slava: { atribut: 'sl-pohled', pohledy: [['top', 'Top 10'], ['legendy', 'Legendy'], ['odznaky', 'Odznaky'], ['rekordy', 'Rekordy'], ['kronika', 'Kronika'], ['sezona', 'Sezóna']], aktualni: () => pohledSlavy(), nastavit: k => nastavitPohledSlavy(k) },
    udrzba: { atribut: 'ud-rezim', pohledy: [['udaje', 'Po údajích'], ['modelky', 'Po modelkách'], ['souhrn', 'Souhrn']], aktualni: () => stav.udrzbaRezim, nastavit: (k) => { stav.udrzbaRezim = k; try { localStorage.setItem('udrzbaRezim', k); } catch { /* jen pro toto spuštění */ } } },
};

// Po otevření části přepne pohled jejím přepínačem, jakmile se přepínač objeví (nejvýš asi 2 s)
function dokliknoutPohled(atribut, pohled, pokus = 0) {
    // Přepínač je v liště voleb, nebo v liště hlavičky sekce (Síň slávy)
    const stitek = /** @type {HTMLElement | null} */ (document.querySelector(`#stats .volby-v-liste [data-${atribut}="${pohled}"], .sbirka-hlava:not(.hidden) [data-${atribut}="${pohled}"]`));
    if (stitek) {
        if (!stitek.classList.contains('active') && !stitek.classList.contains('on')) stitek.click();
        return;
    }
    if (pokus < 20) setTimeout(() => dokliknoutPohled(atribut, pohled, pokus + 1), 100);
}

// Mapa sekcí (klik na zvolenou sekci v navigační kapsli): všechny sekce, jejich části a pohledy částí najednou
// ve skleněném panelu; zvolené místo plnou růžovou. Esc, klik mimo nebo volba ji zavře.
let mapa = null;
function zavritMapu() {
    mapa?.remove();
    mapa = null;
    document.removeEventListener('pointerdown', klikMimoMapu, true);
}
function klikMimoMapu(e) {
    if (mapa && !mapa.contains(e.target) && !e.target.closest?.('#viewToggle')) zavritMapu();
}
function otevritNabidkuSekci(tlacitko) {
    if (mapa) return zavritMapu();
    const zvolena = document.querySelector('#pasStranky [role="tab"][aria-selected="true"]');
    const sloupce = [...prepinacRezimu.querySelectorAll('#viewToggle [data-rezim]')].map((b) => {
        const sekce = /** @type {HTMLElement} */ (b);
        const klic = sekce.dataset.sekce || sekce.dataset.rezim;
        const aktivniSekce = sekce.classList.contains('active');
        const nazev = sekce.querySelector('span')?.textContent.trim() || '';
        const casti = (CASTI_SEKCI[klic] || []).map(([atribut, cast, nazevCasti]) => {
            // Sbírka nemá pilulky částí (jedna stránka s hlavičkou): zvolenou část říká stav Přehledu
            const je = aktivniSekce && (zvolena ? zvolena.getAttribute(`data-${atribut}`) === cast : klic === 'sbirka' && stav.prehledSekce === cast);
            const p = POHLEDY_CASTI[cast];
            const pohledy = p ? `<div class="mapa-pohledy">${p.pohledy.map(([k, n]) =>
                `<button type="button" class="${je && p.aktualni() === k ? 'zvolena' : ''}" data-mapa-cast="${atribut}:${cast}" data-mapa-pohled="${k}">${n}</button>`).join('')}</div>` : '';
            return `<button type="button" class="mapa-cast ${je ? (p ? 'v-ni' : 'zvolena') : ''}" data-mapa-cast="${atribut}:${cast}">${nazevCasti}</button>${pohledy}`;
        }).join('');
        return `<div class="mapa-sloupec"><h4 class="${aktivniSekce ? 'zvolena' : ''}">${nazev}</h4>${casti}</div>`;
    }).join('');
    mapa = document.createElement('div');
    mapa.className = 'mapa-sekci';
    mapa.setAttribute('role', 'dialog');
    mapa.setAttribute('aria-label', 'Mapa sekcí');
    mapa.innerHTML = `<div class="mapa-mrizka">${sloupce}</div><p class="mapa-tip">Klik na zvolenou sekci otevře tuto mapu · Ctrl+1–5 sekce · Esc zavře</p>`;
    const r = tlacitko.getBoundingClientRect();
    mapa.style.left = `${Math.max(8, r.left)}px`;
    mapa.style.top = `${r.bottom + 8}px`;
    document.getElementById('app').append(mapa);
    mapa.addEventListener('click', (e) => {
        const volba = /** @type {HTMLElement | null} */ (e.target.closest('[data-mapa-cast]'));
        if (!volba) return;
        const [atribut, cast] = volba.dataset.mapaCast.split(':');
        const pohled = volba.dataset.mapaPohled;
        const p = POHLEDY_CASTI[cast];
        zavritMapu();
        const naMiste = (zvolena ? zvolena.getAttribute(`data-${atribut}`) === cast
            : atribut === 'zobrazeni-prehledu' && stav.rezim === 'prehled' && stav.prehledSekce === cast) && document.querySelector('#viewToggle .active');
        if (pohled && p && naMiste) {
            // Už otevřená část: přepne pohled jejím přepínačem v záhlaví stránky
            /** @type {HTMLElement | null} */ (document.querySelector(`.volby-v-liste [data-${p.atribut}="${pohled}"], .sbirka-hlava:not(.hidden) [data-${p.atribut}="${pohled}"]`))?.click();
            return;
        }
        if (pohled && p) p.nastavit(pohled);
        if (!naMiste) otevritCast(atribut, cast);
        // Pohled, který potřebuje vlastní spuštění (Údržba › Po modelkách), se po načtení části přepne jejím přepínačem
        if (pohled && p) dokliknoutPohled(p.atribut, pohled);
    });
    mapa.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        zavritMapu();
        tlacitko.focus();
    });
    document.addEventListener('pointerdown', klikMimoMapu, true);
    /** @type {HTMLElement | null} */ (mapa.querySelector('.zvolena, .v-ni, button'))?.focus();
}
