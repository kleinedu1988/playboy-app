// Články čísla: čtení (text s perexem, citáty a zvýrazněnými otázkami, skeny stran) a okno pro úpravu
import { jednou, oznamit } from '../ui/oznameni';
import { AddClanek, DeleteClanek, GetClankyModelky, UpdateClanek } from './backend';
import { esc, formatMarkdown, nazevVydani, obrazek, pocetOdkazuDisku, sjednotit, sklonovat } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { VELIKOST_NAHLEDU, adresyOdkazu } from './obrazky';
import { potvrdit } from './formular-modelky';
import { upravitText } from '../ui/editor-textu';
import { obnovitStranku, otevritVydani, ukazatClanek } from './vydani';

// Rubriky, které nabízí okno článku; vlastní rubrika jde dopsat
export const RUBRIKY = ['Úvodník', 'Playboy Interview', '20 otázek', 'Článek', 'Povídka', 'Móda', 'Humor', 'Advisor', 'Pictorial', 'Centerfold'];
const NAZVY_DRUHU = { prepis: 'přepis', shrnuti: 'shrnutí' };

const clanekModal = document.getElementById('clanekModal');
// Záhlaví článku: rubrika · strana · druh textu (stejné na stránce čísla i v náhledu okna)
const zahlaviClanku = c => [c.rubrika || 'Článek', c.strana ? `strana ${c.strana}` : '', NAZVY_DRUHU[c.druh] || ''].filter(Boolean).join(' · ');

// Text článku: odstavce oddělené prázdným řádkem, první je perex; podpora markdownu; „> “ citát; „SLOVO:“ na začátku zvýrazní mluvčího
export function htmlTextuClanku(text) {
    return formatMarkdown(text, { perex: true, mluvci: true });
}

// Článek jako oddíl stránky čísla; články jdou pod sebou podle stran (jako alba v galerii modelky)
export function htmlClanku(c) {
    const zahlavi = zahlaviClanku(c);
    return `
        <article class="clanek" data-cast="clanek-${c.id}" data-id-clanku="${c.id}">
            <div class="clanek-rubrika">${esc(zahlavi)}<button type="button" class="clanek-upravit" data-upravit-clanek="${c.id}" title="Upravit článek">✎ upravit</button></div>
            <h1>${esc(c.nazev)}</h1>
            ${c.autor || c.jmenoModelky ? `<div class="clanek-autor">${esc(c.autor)}${c.autor && c.jmenoModelky ? ' · ' : ''}${c.jmenoModelky
                ? `<button class="link" data-modelka="${c.modelkaId}" title="Otevřít profil modelky">${esc(c.jmenoModelky)}</button>` : ''}</div>` : ''}
            <div class="clanek-linka"></div>
            <div class="clanek-text">${htmlTextuClanku(c.text) || '<p class="empty-state">Článek zatím nemá text. Doplň ho tlačítkem upravit.</p>'}</div>
            ${c.skenyUrl?.length ? `
                <div class="clanek-skeny-nadpis">Skeny stran</div>
                <div class="clanek-skeny">${c.skenyUrl.map((url, i) => `<button type="button" data-sken="${i}" title="Otevřít sken"><img src="${esc(obrazek(url, VELIKOST_NAHLEDU))}" alt="" loading="lazy" draggable="false" /></button>`).join('')}</div>` : ''}
        </article>`;
}

// Tenký proužek s obsahem a ukazatelem přečteného nad články; vidět jen v úzkém okně
export const htmlProuzku = polozky => `
    <nav class="clanek-prouzek">
        ${polozky.map(p => `<button type="button" ${p.atribut}>${p.strana ? `<b>${p.strana}</b>` : ''}${esc(p.nazev)}</button>`).join('')}
        <span class="clanek-precteno"><i></i></span>
    </nav>`;

// Články modelky jako poslední blok údajů v levém panelu profilu (údaje o modelce jsou důležitější);
// klik otevře číslo na tomto článku
export async function doplnitClankyModelky(modelka) {
    const clanky = await GetClankyModelky(modelka.id) || [];
    if (!clanky.length || stav.aktualniModelka?.id !== modelka.id) return;
    const hlavicka = document.getElementById('modelHeader');
    let udaje = hlavicka.querySelector('.udaje-modelky');
    if (!udaje) {
        udaje = document.createElement('div');
        udaje.className = 'udaje-modelky';
        hlavicka.querySelector('.profile-tags').after(udaje);
    }
    udaje.insertAdjacentHTML('beforeend', `<section class="udaje-blok udaje-clanky"><h4>Články</h4>
        ${clanky.map(c => `<button type="button" class="profil-clanek" data-clanek-cisla="${esc(c.vydani)}" data-id="${c.id}" title="Otevřít článek v čísle">
            <span class="profil-clanek-rubrika">${esc(c.rubrika || 'Článek')}</span>
            <span class="profil-clanek-nazev">${esc(c.nazev)}</span>
            <span class="profil-clanek-kde">${esc([nazevVydani(c.vydani), c.strana ? `strana ${c.strana}` : ''].filter(Boolean).join(' · '))}</span>
        </button>`).join('')}</section>`);
}

// Otevření čísla rovnou na článku (z profilu modelky a z hledání)
export async function otevritClanek(vydani, id) {
    await otevritVydani(vydani);
    if (stav.aktualniVydani === vydani) ukazatClanek(id, false);
}

// Okno článku: nový (clanek = null) nebo úprava; vydání je dané stránkou čísla
export async function otevritEditorClanku(clanek, vydani) {
    stav.editovanyClanek = clanek || { id: 0, vydani };
    const hodnota = (id, v) => { /** @type {HTMLInputElement} */ (document.getElementById(id)).value = v ?? ''; };
    document.getElementById('clanekModalTitle').textContent = clanek ? 'Upravit článek' : 'Nový článek';
    document.getElementById('clanekModalCislo').textContent = nazevVydani(vydani);
    hodnota('inputClanekRubrika', clanek?.rubrika);
    hodnota('inputClanekAutor', clanek?.autor);
    hodnota('inputClanekStrana', clanek?.strana || '');
    hodnota('inputClanekNazev', clanek?.nazev);
    hodnota('inputClanekModelka', clanek?.jmenoModelky);
    hodnota('selectClanekDruh', clanek?.druh);
    hodnota('inputClanekText', clanek?.text);
    hodnota('inputClanekSkeny', clanek?.skenyOdkazy);
    ukazatTextClanku();
    ukazatZahlaviClanku();
    ukazatSkenyClanku();
    document.getElementById('clanekSmazatBtn').classList.toggle('hidden', !clanek);

    // Našeptávání: rubriky (obvyklé i už použité), autoři čísla a jména modelek
    const rubriky = new Map([...RUBRIKY, ...stav.vydaniClanky.map(c => c.rubrika)].filter(Boolean).map(r => [sjednotit(r), r]));
    document.getElementById('seznamRubrik').innerHTML = [...rubriky.values()].map(r => `<option value="${esc(r)}"></option>`).join('');
    const autori = new Set(stav.vydaniClanky.map(c => c.autor).filter(Boolean));
    document.getElementById('seznamAutoru').innerHTML = [...autori].map(a => `<option value="${esc(a)}"></option>`).join('');
    const modelky = await vsechnyModelky();
    document.getElementById('seznamModelekClanku').innerHTML = modelky.map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');
    jmenaModelek = new Set(modelky.map(m => sjednotit(m.jmeno)));
    ukazatModelkuClanku();

    clanekModal.classList.remove('hidden');
    document.getElementById(clanek ? 'clanekTextBtn' : 'inputClanekRubrika').focus();
}

// Náhled textu v okně článku (stejné formátování jako při čtení)
function ukazatTextClanku() {
    const text = /** @type {HTMLTextAreaElement} */ (document.getElementById('inputClanekText')).value;
    document.getElementById('clanekTextNahled').innerHTML = text.trim() ? htmlTextuClanku(text) : '<span class="text-nahled-prazdny">Napsat text článku…</span>';
}

// Jména modelek ve sbírce pro nápovědu pod polem Modelka
let jmenaModelek = new Set();

const hodnotaPole = id => /** @type {HTMLInputElement} */ (document.getElementById(id)).value.trim();

function ukazatZahlaviClanku() {
    const strana = hodnotaPole('inputClanekStrana');
    document.getElementById('clanekNahledZahlavi').textContent = zahlaviClanku({
        rubrika: hodnotaPole('inputClanekRubrika'),
        strana: /^\d+$/.test(strana) ? strana : '',
        druh: hodnotaPole('selectClanekDruh'),
    });
}

// Jméno, které ve sbírce není, se neuloží; řekne se to hned u pole
function ukazatModelkuClanku() {
    const jmeno = hodnotaPole('inputClanekModelka');
    document.getElementById('clanekModelkaInfo').textContent = !jmeno ? ''
        : jmenaModelek.has(sjednotit(jmeno)) ? 'Článek bude v profilu modelky.' : 'Ve sbírce není – vyber jméno z nabídky, nebo pole nech prázdné.';
}

// Počet skenů a jejich náhledy z vložených odkazů
let poradiSkenu = 0;
async function ukazatSkenyClanku() {
    const poradi = ++poradiSkenu;
    const text = hodnotaPole('inputClanekSkeny');
    const pocet = pocetOdkazuDisku(text);
    document.getElementById('clanekSkenyInfo').textContent = pocet ? sklonovat(pocet, 'sken', 'skeny', 'skenů') : text ? 'V textu není odkaz na soubor z Disku.' : '';
    const adresy = await adresyOdkazu(text, VELIKOST_NAHLEDU);
    if (poradi !== poradiSkenu) return;
    document.getElementById('clanekSkenyNahled').innerHTML = adresy.map((a, i) => `<img src="${esc(a)}" alt="Strana ${i + 1}" loading="lazy" draggable="false" />`).join('');
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    ['inputClanekRubrika', 'inputClanekStrana', 'selectClanekDruh'].forEach(id => document.getElementById(id).addEventListener('input', ukazatZahlaviClanku));
    document.getElementById('selectClanekDruh').addEventListener('change', ukazatZahlaviClanku);
    document.getElementById('inputClanekModelka').addEventListener('input', ukazatModelkuClanku);
    document.getElementById('inputClanekSkeny').addEventListener('input', ukazatSkenyClanku);

    document.getElementById('clanekTextBtn').addEventListener('click', async () => {
        const pole = /** @type {HTMLTextAreaElement} */ (document.getElementById('inputClanekText'));
        const text = await upravitText({
            nadpis: document.getElementById('inputClanekNazev').value.trim() || 'Text článku',
            text: pole.value,
            zastupny: 'První odstavec je perex…',
            mluvci: true,
            napoveda: 'Formátování se ukazuje rovnou; značky se objeví, jen když je v místě kurzor. První odstavec je perex, „PLAYBOY:“ na začátku řádku zvýrazní mluvčího. Ctrl+B tučné, Ctrl+I kurzíva, Ctrl+Enter použije text.',
        });
        if (text === null || text === pole.value) return;
        pole.value = text;
        pole.dispatchEvent(new Event('input', { bubbles: true }));
        ukazatTextClanku();
    });

    document.getElementById('modelHeader').addEventListener('click', (e) => {
        const clanek = e.target.closest('[data-clanek-cisla]');
        if (clanek) otevritClanek(clanek.dataset.clanekCisla, parseInt(clanek.dataset.id));
    });

    document.getElementById('clanekForm').onsubmit = jednou(async (e) => {
        e.preventDefault();
        const pole = id => /** @type {HTMLInputElement} */ (document.getElementById(id)).value.trim();
        const nazev = pole('inputClanekNazev');
        if (!nazev) {
            document.getElementById('inputClanekNazev').focus();
            oznamit('Vyplň název článku.');
            return;
        }
        const strana = pole('inputClanekStrana');
        if (strana && !/^\d+$/.test(strana)) {
            document.getElementById('inputClanekStrana').focus();
            oznamit('Strana je číslo, například 27.');
            return;
        }
        // Modelka podle jména; jméno, které ve sbírce není, se neuloží
        const jmeno = pole('inputClanekModelka');
        const modelka = jmeno ? (await vsechnyModelky()).find(m => sjednotit(m.jmeno) === sjednotit(jmeno)) : null;
        if (jmeno && !modelka) {
            document.getElementById('inputClanekModelka').focus();
            oznamit(`Modelka „${jmeno}“ ve sbírce není. Vyber jméno z nabídky, nebo pole nech prázdné.`);
            return;
        }
        const clanek = {
            ...stav.editovanyClanek,
            rubrika: pole('inputClanekRubrika'),
            autor: pole('inputClanekAutor'),
            strana: parseInt(strana) || 0,
            nazev,
            modelkaId: modelka?.id || 0,
            druh: pole('selectClanekDruh'),
            text: /** @type {HTMLTextAreaElement} */ (document.getElementById('inputClanekText')).value.trim(),
            skenyOdkazy: pole('inputClanekSkeny'),
        };
        let id = clanek.id;
        if (id) {
            if (!await UpdateClanek(/** @type {any} */ (clanek))) {
                oznamit('Článek se nepodařilo uložit.');
                return;
            }
        } else {
            id = await AddClanek(/** @type {any} */ (clanek));
            if (!id) {
                oznamit('Článek se nepodařilo uložit.');
                return;
            }
        }
        clanekModal.classList.add('hidden');
        // Na uložený článek se stránka posune
        await obnovitStranku();
        ukazatClanek(id);
    });

    document.getElementById('clanekSmazatBtn').onclick = async () => {
        const c = stav.editovanyClanek;
        if (!c?.id) return;
        // Potvrzení se ukáže nad oknem článku; po zrušení zůstane článek i s rozepsanými změnami
        if (!await potvrdit('Smazat článek', `Opravdu smazat článek „${c.nazev}“? Text článku se smaže, skeny na Disku zůstanou.`, 'Smazat', { nebezpecne: true })) {
            return;
        }
        clanekModal.classList.add('hidden');
        if (!await DeleteClanek(c.id)) {
            oznamit('Článek se nepodařilo smazat.');
            return;
        }
        clanekModal.classList.add('hidden');
        obnovitStranku();
    };
}
