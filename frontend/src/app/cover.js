// Okno coveru a otevření profilu ze stěny
import { nazevVydani, obrazek, paskaCisla, rozlozitVydani, slozitVydani } from '../lib/format';
import { jednou, oznamit } from '../ui/oznameni';
import { AddCover, UpdateCover } from './backend';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { issueView, searchInput, stats, wall } from './prvky';
import { historie, jeOdkazNaSlozku, odkazJeVPoradku, oznamitVlozeni, prepinacRezimu, prepnoutRezim, zobrazeniCisel } from './navigace';
import { zvolitCastPrehledu } from './prehled';
import { nastavitCastOblibenosti, posledniCastOblibenosti } from './oblibenost';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { obnovitStranku } from './vydani';
import { otevritLightbox } from './prohlizec';
import { pripojitVyberSpecialu } from './specialy';
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
        const main = document.querySelector('main');
        // Zvolená záložka na přehledu jen vrátí stránku nahoru (bez nového načtení); z profilu nebo čísla vede zpět
        // na přehled
        if (tlacitko.classList.contains('active') && !prepinacRezimu.classList.contains('podstranka')) {
            main.scrollTo({ top: 0, behavior: 'smooth' });
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
            const naPrehledu = stav.rezim === 'prehled' && !stats.classList.contains('hidden');
            zvolitCastPrehledu('sprava', naPrehledu);
            prepnoutRezim('prehled');
            nacistGalerii(searchInput.value);
        }
    });

    // Ctrl+1 až Ctrl+7: přehledy a stránky v liště zleva doprava (Modelky … Sbírka), jako klik na ně. Číslo podle
    // klávesy, ne znaku: na české klávesnici je na „1“ znak „+“ (číslice jsou se Shiftem). Držení se neopakuje.
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const cislo = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1] || (/^[1-9]$/.test(e.key) ? e.key : '');
        if (!cislo) return;
        if (stav.zamceno || otevreneOkno() || jeVidet('lightbox')) return;
        const tlacitko = /** @type {HTMLElement | undefined} */ (prepinacRezimu.querySelectorAll('[data-rezim]')[Number(cislo) - 1]);
        if (!tlacitko) return;
        e.preventDefault();
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
