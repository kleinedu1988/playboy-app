// Rychlé výsledky pod hledáním odkudkoli: modelky, články (i podle textu) a čísla; šipky vybírají, Enter otevře
import { GetKalendar, HledatClanky } from './backend';
import { bezDiakritiky, esc, nazevVydani, obrazek, sjednotit } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { searchInput } from './prvky';
import { VELIKOST_NAHLEDU, adresaTitulni } from './obrazky';
import { otevritDetailModelky } from './profil';
import { otevritVydani } from './vydani';
import { otevritClanek } from './clanky';

const naseptavac = document.getElementById('naseptavac');
const NEJVIC_MODELEK = 5;
const NEJVIC_CLANKU = 6;
const NEJVIC_CISEL = 5;

let cisloHledani = 0;
let casovac = 0;
let polozky = [];
let vybrana = -1;
// Kalendář (náhledy obálek čísel) se načte při prvním hledání a obnoví při každém novém zaměření pole
let kalendar = null;

// Zvýraznění slov dotazu v textu bez ohledu na diakritiku a velikost písmen
export function zvyraznit(text, slova) {
    const znaky = [...String(text || '')];
    const zjednodusene = znaky.map(z => bezDiakritiky(z));
    const oznacit = new Array(znaky.length).fill(false);
    // Hledá se v zjednodušeném textu; každý původní znak může dát víc znaků (ß → ss)
    const spojeny = zjednodusene.join('');
    const puvodni = zjednodusene.flatMap((z, i) => [...z].map(() => i));
    slova.forEach(slovo => {
        for (let od = spojeny.indexOf(slovo); od >= 0 && slovo; od = spojeny.indexOf(slovo, od + 1)) {
            for (let k = od; k < od + slovo.length; k++) oznacit[puvodni[k]] = true;
        }
    });
    let html = '';
    let otevreno = false;
    znaky.forEach((z, i) => {
        if (oznacit[i] !== otevreno) {
            html += oznacit[i] ? '<mark>' : '</mark>';
            otevreno = oznacit[i];
        }
        html += esc(z);
    });
    return otevreno ? html + '</mark>' : html;
}

const obsahujeVse = (text, slova) => {
    const t = bezDiakritiky(text);
    return slova.every(s => t.includes(s));
};

export function zavritNaseptavac() {
    naseptavac.classList.add('hidden');
    naseptavac.innerHTML = '';
    polozky = [];
    vybrana = -1;
}

async function hledat() {
    const dotaz = searchInput.value.trim();
    const moje = ++cisloHledani;
    // Cílené hledání modelek (vlasy:blond) patří jen galerii
    if (dotaz.length < 2 || dotaz.includes(':') || searchInput.disabled) return zavritNaseptavac();
    const slova = sjednotit(dotaz).split(/\s+/).filter(Boolean);

    kalendar ||= GetKalendar().then(k => k || []);
    const [modelky, clanky, cisla] = await Promise.all([vsechnyModelky(), HledatClanky(dotaz).then(c => c || []), kalendar]);
    if (moje !== cisloHledani || document.activeElement !== searchInput) return;
    const obalka = new Map(cisla.map(k => [k.vydani, k.nahled]));

    const nalezeneModelky = modelky.filter(m => obsahujeVse(`${m.jmeno} ${m.dalsiJmena}`, slova)).slice(0, NEJVIC_MODELEK);
    const nalezenaCisla = cisla.filter(k => obsahujeVse(`${nazevVydani(k.vydani)} ${k.vydani} ${k.modelka || ''}`, slova))
        .sort((a, b) => b.vydani.localeCompare(a.vydani)).slice(0, NEJVIC_CISEL);
    const nalezeneClanky = clanky.slice(0, NEJVIC_CLANKU);

    const nahled = (url, tvar = '') => `<span class="naseptavac-nahled ${tvar}">${url ? `<img src="${esc(url)}" alt="" draggable="false" />` : ''}</span>`;
    const skupina = (nazev, pocet, html) => pocet ? `<h5>${nazev} · ${pocet}</h5>${html}` : '';
    polozky = [];
    const polozka = (akce, obsah) => {
        polozky.push(akce);
        return `<button type="button" class="naseptavac-polozka" data-polozka="${polozky.length - 1}" role="option">${obsah}</button>`;
    };

    const html = [
        skupina('Modelky', nalezeneModelky.length, nalezeneModelky.map(m => polozka(() => otevritDetailModelky(m), `
            ${nahled(adresaTitulni(m), 'kulaty')}
            <span class="naseptavac-text">
                <span class="naseptavac-nazev">${zvyraznit(m.jmeno, slova)}</span>
                <span class="naseptavac-kde">${esc([m.role, m.vydani[0] ? nazevVydani(m.vydani[0]) : ''].filter(Boolean).join(' · '))}</span>
            </span>`)).join('')),
        skupina('Články', clanky.length, nalezeneClanky.map(c => polozka(() => otevritClanek(c.vydani, c.id), `
            ${nahled(obalka.get(c.vydani) ? obrazek(obalka.get(c.vydani), VELIKOST_NAHLEDU) : '')}
            <span class="naseptavac-text">
                <span class="naseptavac-rubrika">${esc(c.rubrika || 'Článek')}</span>
                <span class="naseptavac-nazev">${zvyraznit(c.nazev, slova)} <span class="naseptavac-kde">· ${esc([nazevVydani(c.vydani), c.strana ? `strana ${c.strana}` : ''].filter(Boolean).join(' · '))}</span></span>
                ${c.ukazka ? `<span class="naseptavac-ukazka">${zvyraznit(c.ukazka, slova)}</span>` : ''}
            </span>`)).join('')),
        skupina('Čísla', nalezenaCisla.length, nalezenaCisla.map(k => polozka(() => otevritVydani(k.vydani), `
            ${nahled(k.nahled ? obrazek(k.nahled, VELIKOST_NAHLEDU) : '')}
            <span class="naseptavac-text">
                <span class="naseptavac-nazev">${zvyraznit(nazevVydani(k.vydani), slova)}</span>
                <span class="naseptavac-kde">${k.modelka ? zvyraznit(k.modelka, slova) : ''}</span>
            </span>`)).join('')),
    ].join('');

    vybrana = -1;
    naseptavac.innerHTML = html
        ? `${html}<div class="naseptavac-pata">↑↓ vybrat · Enter otevřít · Esc zavřít</div>`
        : '<div class="naseptavac-prazdno">Žádná modelka, článek ani číslo neodpovídá.</div>';
    naseptavac.classList.remove('hidden');
}

function vybrat(index) {
    vybrana = index;
    naseptavac.querySelectorAll('[data-polozka]').forEach(b => {
        const zvolena = parseInt(b.dataset.polozka) === index;
        b.classList.toggle('active', zvolena);
        b.setAttribute('aria-selected', String(zvolena));
        if (zvolena) b.scrollIntoView({ block: 'nearest' });
    });
}

function otevrit(index) {
    const akce = polozky[index];
    if (!akce) return;
    zavritNaseptavac();
    searchInput.blur();
    akce();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    searchInput.addEventListener('input', () => {
        clearTimeout(casovac);
        casovac = setTimeout(hledat, 150);
    });
    searchInput.addEventListener('focus', () => {
        kalendar = null;
        if (searchInput.value.trim().length >= 2) hledat();
    });
    searchInput.addEventListener('blur', () => {
        cisloHledani++;
        zavritNaseptavac();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (naseptavac.classList.contains('hidden')) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!polozky.length) return;
            const dolu = e.key === 'ArrowDown';
            vybrat(vybrana < 0 ? (dolu ? 0 : polozky.length - 1) : (vybrana + (dolu ? 1 : -1) + polozky.length) % polozky.length);
        } else if (e.key === 'Enter' && vybrana >= 0) {
            e.preventDefault();
            otevrit(vybrana);
        } else if (e.key === 'Escape') {
            // Esc zavře jen výsledky; profil ani stránka čísla se nezavřou
            e.stopPropagation();
            cisloHledani++;
            zavritNaseptavac();
        }
    });

    // Klik do výsledků nesmí vzít pole fokus (zavřelo by je dřív, než se klik provede)
    naseptavac.addEventListener('mousedown', e => e.preventDefault());
    naseptavac.addEventListener('click', (e) => {
        const b = e.target.closest('[data-polozka]');
        if (b) otevrit(parseInt(b.dataset.polozka));
    });
    naseptavac.addEventListener('mousemove', (e) => {
        const b = e.target.closest('[data-polozka]');
        if (b && parseInt(b.dataset.polozka) !== vybrana) vybrat(parseInt(b.dataset.polozka));
    });
}
