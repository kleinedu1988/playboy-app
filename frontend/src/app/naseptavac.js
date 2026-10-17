// Rychlé výsledky pod hledáním odkudkoli: příkazy vyhledávání, hodnoty filtrů, modelky, články a čísla
import { GetKalendar, HledatClanky } from './backend';
import { PRIKAZY, bezDiakritiky, esc, nazevVydani, obrazek, odpovidaTextFuzzy, rozlozitDotaz, sjednotit, sklonovat, vyhovujeHledani } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { searchInput } from './prvky';
import { VELIKOST_NAHLEDU, adresaTitulni } from './obrazky';
import { otevritDetailModelky } from './profil';
import { otevritVydani } from './vydani';
import { otevritClanek } from './clanky';

const naseptavac = document.getElementById('naseptavac');
const zavoj = document.getElementById('naseptavacZavoj');
const NEJVIC_MODELEK = 5;
const NEJVIC_CLANKU = 6;
const NEJVIC_CISEL = 5;

let cisloHledani = 0;
let casovac = 0;
let polozky = [];
let vybrana = -1;
// Kalendář (náhledy obálek čísel) se načte při prvním hledání a obnoví při každém novém zaměření pole
let kalendar = null;

// Zjištění aktivního slova před textovým kurzorem
function ziskatAktivniSlovo() {
    const hodnota = searchInput.value;
    const pozice = searchInput.selectionStart ?? hodnota.length;
    const textPred = hodnota.slice(0, pozice);
    const i = textPred.lastIndexOf(' ');
    const zacatek = i >= 0 ? i + 1 : 0;
    const konecMezera = hodnota.indexOf(' ', pozice);
    const konec = konecMezera >= 0 ? konecMezera : hodnota.length;
    return {
        slovo: hodnota.slice(zacatek, konec),
        slovoPred: hodnota.slice(zacatek, pozice),
        zacatek,
        konec,
    };
}

// Nahrazení aktivního slova vybraným příkazem nebo hodnotou
function nahraditAktivniSlovo(novyText, hotovo = false) {
    const { zacatek, konec } = ziskatAktivniSlovo();
    const hodnota = searchInput.value;
    const vkladany = hotovo ? `${novyText} ` : novyText;
    searchInput.value = hodnota.slice(0, zacatek) + vkladany + hodnota.slice(konec);
    const novaPozice = zacatek + vkladany.length;
    searchInput.focus();
    searchInput.setSelectionRange(novaPozice, novaPozice);
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    hledat();
}

function ziskatMoznostiPrikazu(slovoPred) {
    const neg = (slovoPred.startsWith('-') || slovoPred.startsWith('!')) ? slovoPred[0] : '';
    const ciste = bezDiakritiky(neg ? slovoPred.slice(1) : slovoPred).toLowerCase();
    if (!ciste) return [];
    return PRIKAZY.filter(p => bezDiakritiky(p.klic).startsWith(ciste)).slice(0, 6).map(p => ({
        prikaz: `${neg}${p.klic}`,
        popis: p.popis,
    }));
}

function ziskatMoznostiHodnot(klic, filtr, modelky) {
    const f = bezDiakritiky(filtr).toLowerCase();
    const vysledky = [];
    if (klic === 'vlasy') {
        const cetnosti = new Map();
        modelky.forEach(m => {
            const v = (m.vlasyBarva || '').trim();
            if (v) cetnosti.set(v, (cetnosti.get(v) || 0) + 1);
        });
        for (const [hodnota, pocet] of [...cetnosti.entries()].sort((a, b) => b[1] - a[1])) {
            if (!f || bezDiakritiky(hodnota).toLowerCase().includes(f)) {
                vysledky.push({ hodnota: hodnota.toLowerCase(), popis: `${pocet} ${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}` });
            }
        }
    } else if (klic === 'tag' || klic === 'tagy') {
        const cetnosti = new Map();
        modelky.forEach(m => {
            (m.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
                cetnosti.set(t, (cetnosti.get(t) || 0) + 1);
            });
        });
        for (const [hodnota, pocet] of [...cetnosti.entries()].sort((a, b) => b[1] - a[1])) {
            if (!f || bezDiakritiky(hodnota).toLowerCase().includes(f)) {
                vysledky.push({ hodnota: hodnota.toLowerCase(), popis: `${pocet} ${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}` });
            }
        }
    } else if (klic === 'edice') {
        ['US', 'CZ'].filter(e => !f || e.toLowerCase().includes(f)).forEach(e => {
            vysledky.push({ hodnota: e, popis: `Edice ${e}` });
        });
    } else if (klic === 'tetovani' || klic === 'piercing') {
        ['ano', 'ne'].filter(v => !f || v.includes(f)).forEach(v => {
            vysledky.push({ hodnota: v, popis: v === 'ano' ? 'Má' : 'Nemá' });
        });
    } else if (klic === 'role') {
        const cetnosti = new Map();
        modelky.forEach(m => {
            const r = (m.role || '').trim();
            if (r) cetnosti.set(r, (cetnosti.get(r) || 0) + 1);
        });
        for (const [hodnota, pocet] of [...cetnosti.entries()].sort((a, b) => b[1] - a[1])) {
            if (!f || bezDiakritiky(hodnota).toLowerCase().includes(f)) {
                vysledky.push({ hodnota: hodnota.toLowerCase(), popis: `${pocet} ${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}` });
            }
        }
    } else if (klic === 'narodnost') {
        const cetnosti = new Map();
        modelky.forEach(m => {
            const n = (m.narodnost || '').trim();
            if (n) cetnosti.set(n, (cetnosti.get(n) || 0) + 1);
        });
        for (const [hodnota, pocet] of [...cetnosti.entries()].sort((a, b) => b[1] - a[1])) {
            if (!f || bezDiakritiky(hodnota).toLowerCase().includes(f)) {
                vysledky.push({ hodnota: hodnota.toLowerCase(), popis: `${pocet} ${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}` });
            }
        }
    } else if (klic === 'oci') {
        const cetnosti = new Map();
        modelky.forEach(m => {
            const o = (m.ociBarva || '').trim();
            if (o) cetnosti.set(o, (cetnosti.get(o) || 0) + 1);
        });
        for (const [hodnota, pocet] of [...cetnosti.entries()].sort((a, b) => b[1] - a[1])) {
            if (!f || bezDiakritiky(hodnota).toLowerCase().includes(f)) {
                vysledky.push({ hodnota: hodnota.toLowerCase(), popis: `${pocet} ${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}` });
            }
        }
    } else if (klic === 'hodnoceni' || klic === 'srdicka') {
        ['>=4', '5', '>=3', '>=1'].filter(h => !f || h.includes(f)).forEach(h => {
            vysledky.push({ hodnota: h, popis: `Hodnocení ${h}` });
        });
    } else if (klic === 'rok') {
        ['1970..1979', '1980..1989', '1990..1999', '2000..2009', '>=2010'].filter(r => !f || r.includes(f)).forEach(r => {
            vysledky.push({ hodnota: r, popis: `Dekáda ${r}` });
        });
    }
    return vysledky.slice(0, 6);
}

// Zvýraznění slov dotazu v textu bez ohledu na diakritiku a velikost písmen
export function zvyraznit(text, slova) {
    const znaky = [...String(text || '')];
    const zjednodusene = znaky.map(z => bezDiakritiky(z));
    const oznacit = new Array(znaky.length).fill(false);
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

export function zavritNaseptavac() {
    naseptavac.classList.add('hidden');
    zavoj.classList.add('hidden');
    naseptavac.innerHTML = '';
    polozky = [];
    vybrana = -1;
}

async function hledat() {
    const dotaz = searchInput.value;
    const trimDotaz = dotaz.trim();
    const moje = ++cisloHledani;

    if (!trimDotaz || searchInput.disabled) return zavritNaseptavac();

    const { slovoPred } = ziskatAktivniSlovo();
    const negPrefix = (slovoPred.startsWith('-') || slovoPred.startsWith('!')) ? slovoPred[0] : '';
    const cisteSlovo = negPrefix ? slovoPred.slice(1) : slovoPred;
    const idxDvojtecka = cisteSlovo.indexOf(':');

    let moznostiPrikazu = [];
    let moznostiHodnot = [];
    let klicHodnot = '';

    kalendar ||= GetKalendar().then(k => k || []);
    const [modelky, clanky, cisla] = await Promise.all([
        vsechnyModelky(),
        trimDotaz.length >= 2 ? HledatClanky(trimDotaz).then(c => c || []) : Promise.resolve([]),
        kalendar,
    ]);
    if (moje !== cisloHledani || document.activeElement !== searchInput) return;

    if (idxDvojtecka >= 0) {
        klicHodnot = cisteSlovo.slice(0, idxDvojtecka).toLowerCase();
        const filtrHodnoty = cisteSlovo.slice(idxDvojtecka + 1);
        moznostiHodnot = ziskatMoznostiHodnot(klicHodnot, filtrHodnoty, modelky);
    } else if (cisteSlovo.length >= 1) {
        moznostiPrikazu = ziskatMoznostiPrikazu(slovoPred);
    }

    const tokeny = rozlozitDotaz(trimDotaz);
    const slova = tokeny.filter(t => !t.negace).flatMap(t => t.varianty);

    const obalka = new Map(cisla.map(k => [k.vydani, k.nahled]));
    const textModelky = m => [
        m.jmeno,
        m.dalsiJmena,
        m.role,
        m.narodnost,
        m.vlasyBarva,
        m.tags,
        m.poznamka,
        m.vystoupeni,
        m.pictorialVydani,
        ...(m.vydani || []),
        ...(m.obalky || []),
    ].filter(Boolean).join(' ');

    let nalezeneModelky = [];
    let nalezenaCisla = [];
    let nalezeneClanky = [];

    // Pokud uživatel nepíše cílený filtr s dvojtečkou a dotaz má alespoň 2 znaky, prohledáme i modelky, články a čísla
    if (!idxDvojtecka && trimDotaz.length >= 2) {
        nalezeneModelky = modelky
            .filter(m => vyhovujeHledani([textModelky(m)], tokeny) || slova.some(s => odpovidaTextFuzzy(m.jmeno + ' ' + (m.dalsiJmena || ''), s)))
            .sort((a, b) => {
                const aJmeno = vyhovujeHledani([a.jmeno, a.dalsiJmena], tokeny) || slova.some(s => odpovidaTextFuzzy(a.jmeno, s));
                const bJmeno = vyhovujeHledani([b.jmeno, b.dalsiJmena], tokeny) || slova.some(s => odpovidaTextFuzzy(b.jmeno, s));
                if (aJmeno !== bJmeno) return aJmeno ? -1 : 1;
                return a.jmeno.localeCompare(b.jmeno);
            })
            .slice(0, NEJVIC_MODELEK);

        nalezenaCisla = cisla
            .filter(k => vyhovujeHledani([nazevVydani(k.vydani), k.vydani, k.modelka || ''], tokeny))
            .sort((a, b) => b.vydani.localeCompare(a.vydani)).slice(0, NEJVIC_CISEL);

        nalezeneClanky = clanky.slice(0, NEJVIC_CLANKU);
    }

    const nahled = (url, tvar = '') => `<span class="naseptavac-nahled ${tvar}">${url ? `<img src="${esc(url)}" alt="" draggable="false" />` : ''}</span>`;
    const skupina = (nazev, pocet, html) => pocet ? `<h5>${nazev} · ${pocet}</h5>${html}` : '';
    polozky = [];
    const polozka = (akce, obsah) => {
        polozky.push(akce);
        return `<button type="button" class="naseptavac-polozka" data-polozka="${polozky.length - 1}" role="option">${obsah}</button>`;
    };

    const detailModelky = m => {
        const casti = [
            m.role,
            m.vlasyBarva,
            m.narodnost,
            m.vydani[0] ? nazevVydani(m.vydani[0]) : '',
        ].filter(Boolean);
        return zvyraznit(casti.join(' · '), slova);
    };

    const html = [
        skupina('Příkazy vyhledávání', moznostiPrikazu.length, moznostiPrikazu.map(p => polozka(() => nahraditAktivniSlovo(p.prikaz, false), `
            <span class="naseptavac-nahled-ikona">⌨</span>
            <span class="naseptavac-text">
                <span class="naseptavac-nazev"><code class="naseptavac-kod">${esc(p.prikaz)}</code></span>
                <span class="naseptavac-kde">${esc(p.popis)}</span>
            </span>`)).join('')),
        skupina(`Možnosti filtru ${klicHodnot}`, moznostiHodnot.length, moznostiHodnot.map(h => polozka(() => nahraditAktivniSlovo(`${negPrefix}${klicHodnot}:${h.hodnota}`, true), `
            <span class="naseptavac-nahled-ikona">🏷</span>
            <span class="naseptavac-text">
                <span class="naseptavac-nazev"><code class="naseptavac-kod">${esc(negPrefix + klicHodnot + ':' + h.hodnota)}</code></span>
                <span class="naseptavac-kde">${esc(h.popis)}</span>
            </span>`)).join('')),
        skupina('Modelky', nalezeneModelky.length, nalezeneModelky.map(m => polozka(() => otevritDetailModelky(m), `
            ${nahled(adresaTitulni(m), 'kulaty')}
            <span class="naseptavac-text">
                <span class="naseptavac-nazev">${zvyraznit(m.jmeno, slova)}</span>
                <span class="naseptavac-kde">${detailModelky(m)}</span>
            </span>`)).join('')),
        skupina('Články', nalezeneClanky.length, nalezeneClanky.map(c => polozka(() => otevritClanek(c.vydani, c.id), `
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
    if (!html) {
        zavritNaseptavac();
        return;
    }
    naseptavac.innerHTML = `${html}<div class="naseptavac-pata">↑↓ vybrat · Enter vložit/otevřít · Esc zavřít</div>`;
    naseptavac.classList.remove('hidden');
    zavoj.classList.remove('hidden');
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
    akce();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    searchInput.addEventListener('input', () => {
        clearTimeout(casovac);
        casovac = setTimeout(hledat, 120);
    });
    searchInput.addEventListener('focus', () => {
        kalendar = null;
        if (searchInput.value.trim().length >= 1) hledat();
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
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (vybrana >= 0) {
                otevrit(vybrana);
            } else {
                zavritNaseptavac();
                searchInput.blur();
            }
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
