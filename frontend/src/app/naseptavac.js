// Rychlé výsledky pod hledáním odkudkoli: příkazy vyhledávání, hodnoty filtrů, modelky, články, čísla a fotografové
import { GetFotografove, GetKalendar, HledatClanky } from './backend';
import { PRIKAZY, bezDiakritiky, esc, kategorieModelky, nazevVydani, obrazek, paskaCisla, poleCisla, popisKategorie, rozlozitDotaz, sklonovat, vyhovujeHledani } from '../lib/format';
import { poZmeneDat } from './udalosti';
import { vsechnyModelky } from './mezipamet';
import { detailView, issueView, searchInput, stats } from './prvky';
import { stav } from './stav';
import { VELIKOST_NAHLEDU, adresaTitulni } from './obrazky';
import { otevritDetailModelky } from './profil';
import { otevritFotografa, otevritVydani } from './vydani';
import { otevritClanek } from './clanky';
import { hledaniVeFronte, hledatVeFronte } from './udrzba';
import { nacistGalerii } from './galerie';
import { nastavitViditelnostHledani, prepnoutRezim, zapamatovatMisto } from './navigace';

const naseptavac = document.getElementById('naseptavac');
const zavoj = document.getElementById('naseptavacZavoj');
const NEJVIC_MODELEK = 5;
const NEJVIC_CLANKU = 5;
const NEJVIC_CISEL = 5;
const NEJVIC_FOTOGRAFU = 5;

let cisloHledani = 0;
let casovac = 0;
let polozky = [];
let vybrana = -1;
let otevritPrvni = false; // Enter dřív, než doběhlo hledání: po vykreslení se otevře první výsledek

// Na podstránkách (profil, vydání) a na stránkách Hodnocení, Síň slávy a Sbírka hledání nefiltruje mřížku pod sebou,
// ale rovnou nachází modelku, číslo, článek nebo fotografa k otevření
const vPodstrance = () => !detailView.classList.contains('hidden') || !issueView.classList.contains('hidden');
const jenNajit = () => vPodstrance() || (stav.rezim === 'prehled' && !stats.classList.contains('hidden') && !hledaniVeFronte());

// Kalendář (náhledy obálek čísel), fotografové a prohledávané texty modelek se drží v mezipaměti do změny dat
let kalendar = null;
let fotografove = null;
let pametTextu = new WeakMap();

poZmeneDat(() => {
    kalendar = null;
    fotografove = null;
    pametTextu = new WeakMap();
});

// Zjištění aktivního slova před textovým kurzorem (toleruje i mezeru za dvojtečkou u filtru, např. „vlasy: blond“)
function ziskatAktivniSlovo() {
    const hodnota = searchInput.value;
    const pozice = searchInput.selectionStart ?? hodnota.length;
    const textPred = hodnota.slice(0, pozice);
    const shodaKlice = /(?:^|\s)((?:[-!])?[\p{L}]+:\s*\S*)$/u.exec(textPred);
    let zacatek;
    if (shodaKlice) {
        zacatek = textPred.length - shodaKlice[1].length;
    } else {
        const i = textPred.lastIndexOf(' ');
        zacatek = i >= 0 ? i + 1 : 0;
    }
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
    clearTimeout(casovac);
    hledat();
}

function ziskatMoznostiPrikazu(slovoPred) {
    const neg = (slovoPred.startsWith('-') || slovoPred.startsWith('!')) ? slovoPred[0] : '';
    const ciste = bezDiakritiky(neg ? slovoPred.slice(1) : slovoPred).toLowerCase();
    if (!ciste) return [];
    const shody = PRIKAZY.filter(p => bezDiakritiky(p.klic).startsWith(ciste) || bezDiakritiky(p.popis).toLowerCase().includes(ciste));
    shody.sort((a, b) => Number(bezDiakritiky(b.klic).startsWith(ciste)) - Number(bezDiakritiky(a.klic).startsWith(ciste)));
    return shody.slice(0, 6).map(p => ({
        prikaz: `${neg}${p.klic}`,
        popis: p.popis,
    }));
}

// Hodnoty údaje napříč modelkami s počtem modelek; hodnotyModelky(m) = hodnoty jedné modelky.
// Sjednocuje velikost písmen a řadí přednostně shody od začátku slova, poté podle četnosti.
function hodnotySPocty(modelky, hodnotyModelky, f, seradit = true) {
    const cetnosti = new Map();
    modelky.forEach(m => hodnotyModelky(m).forEach(h => {
        const klic = h.toLowerCase();
        cetnosti.set(klic, (cetnosti.get(klic) || 0) + 1);
    }));
    const polozky = [...cetnosti.entries()].filter(([hodnota]) => !f || bezDiakritiky(hodnota).includes(f));
    if (seradit) {
        polozky.sort((a, b) => {
            if (f) {
                const zacinaA = bezDiakritiky(a[0]).startsWith(f);
                const zacinaB = bezDiakritiky(b[0]).startsWith(f);
                if (zacinaA !== zacinaB) return zacinaA ? -1 : 1;
            }
            return b[1] - a[1];
        });
    }
    return polozky.map(([hodnota, pocet]) => ({ hodnota, popis: sklonovat(pocet, 'modelka', 'modelky', 'modelek') }));
}
const jednaHodnota = text => [(text || '').trim()].filter(Boolean);

function ziskatMoznostiHodnot(klic, filtr, modelky, seznamFotografu = []) {
    const f = bezDiakritiky(filtr).toLowerCase();
    const vysledky = [];
    if (klic === 'vlasy') {
        vysledky.push(...hodnotySPocty(modelky, m => jednaHodnota(m.vlasyBarva), f));
    } else if (klic === 'tag' || klic === 'tagy') {
        vysledky.push(...hodnotySPocty(modelky, m => (m.tags || '').split(',').map(t => t.trim()).filter(Boolean), f));
    } else if (klic === 'edice') {
        ['US', 'CZ'].filter(e => !f || e.toLowerCase().includes(f)).forEach(e => {
            vysledky.push({ hodnota: e, popis: `Edice ${e}` });
        });
    } else if (klic === 'vyskyt') {
        [['casopis', 'V časopise'], ['online', 'Jen online (na internetu)'], ['neurceno', 'Neurčeno']].filter(([v]) => !f || v.includes(f)).forEach(([v, popis]) => {
            vysledky.push({ hodnota: v, popis });
        });
    } else if (klic === 'tetovani' || klic === 'piercing') {
        ['ano', 'ne'].filter(v => !f || v.includes(f)).forEach(v => {
            vysledky.push({ hodnota: v, popis: v === 'ano' ? 'Má' : 'Nemá' });
        });
    } else if (klic === 'role' || klic === 'kategorie') {
        vysledky.push(...hodnotySPocty(modelky, m => kategorieModelky(m).map(k => k.nazev), f, false));
    } else if (klic === 'narodnost') {
        vysledky.push(...hodnotySPocty(modelky, m => jednaHodnota(m.narodnost), f));
    } else if (klic === 'oci') {
        vysledky.push(...hodnotySPocty(modelky, m => jednaHodnota(m.ociBarva), f));
    } else if (klic === 'etnicita') {
        vysledky.push(...hodnotySPocty(modelky, m => jednaHodnota(m.etnicita), f));
    } else if (klic === 'misto') {
        vysledky.push(...hodnotySPocty(modelky, m => jednaHodnota(m.narozeniMisto), f));
    } else if (klic === 'prsa') {
        vysledky.push(...hodnotySPocty(modelky, m => [m.velikostPrsou, m.prsaTyp].map(x => (x || '').trim()).filter(Boolean), f));
    } else if (klic === 'ochlupeni') {
        vysledky.push(...hodnotySPocty(modelky, m => jednaHodnota(m.ochlupeni), f));
    } else if (klic === 'fotograf') {
        seznamFotografu
            .filter(j => !f || bezDiakritiky(j).toLowerCase().includes(f))
            .sort((a, b) => Number(bezDiakritiky(b).toLowerCase().startsWith(f)) - Number(bezDiakritiky(a).toLowerCase().startsWith(f)))
            .forEach(j => vysledky.push({ hodnota: j, popis: 'Fotograf' }));
    } else if (klic === 'hodnoceni' || klic === 'srdicka') {
        ['5', '>=4,5', '>=4', '>=3,5', '>=3', '>=1'].filter(h => !f || h.includes(f)).forEach(h => {
            vysledky.push({ hodnota: h, popis: `Hodnocení ${h}` });
        });
    } else if (klic === 'rok' || klic === 'narozena' || klic === 'nafoceno') {
        const rozsahy = klic === 'narozena'
            ? ['1950..1959', '1960..1969', '1970..1979', '1980..1989', '1990..1999', '>=2000']
            : ['1970..1979', '1980..1989', '1990..1999', '2000..2009', '>=2010'];
        rozsahy.filter(r => !f || r.includes(f)).forEach(r => {
            vysledky.push({ hodnota: r, popis: `Období ${r}` });
        });
    } else if (klic === 'vyska') {
        ['<165', '165..175', '>175'].filter(r => !f || r.includes(f)).forEach(r => {
            vysledky.push({ hodnota: r, popis: `Výška ${r} cm` });
        });
    } else if (klic === 'vaha') {
        ['<50', '50..60', '>60'].filter(r => !f || r.includes(f)).forEach(r => {
            vysledky.push({ hodnota: r, popis: `Váha ${r} kg` });
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
    naseptavac.classList.remove('uzky');
    zavoj.classList.add('hidden');
    naseptavac.innerHTML = '';
    polozky = [];
    vybrana = -1;
}

function ziskejTextModelky(m) {
    let t = pametTextu.get(m);
    if (!t) {
        t = [
            m.jmeno,
            m.dalsiJmena,
            kategorieModelky(m).map(popisKategorie).join(' '),
            m.narodnost,
            m.etnicita,
            m.narozeniMisto,
            m.vlasyBarva,
            m.ociBarva,
            m.velikostPrsou,
            m.prsaTyp,
            m.miry,
            m.tags,
            m.poznamka,
            m.vystoupeni,
            m.pictorialVydani,
            ...(m.vydani || []),
            ...(m.obalky || []),
        ].filter(Boolean).join(' ');
        pametTextu.set(m, t);
    }
    return t;
}

async function hledat() {
    const dotaz = searchInput.value;
    const trimDotaz = dotaz.trim();
    const moje = ++cisloHledani;

    // V Souhrnu Údržby hledání filtruje frontu, výsledky pod polem by překážely
    if (!trimDotaz || searchInput.disabled || hledaniVeFronte()) return zavritNaseptavac();

    const { slovoPred } = ziskatAktivniSlovo();
    const negPrefix = (slovoPred.startsWith('-') || slovoPred.startsWith('!')) ? slovoPred[0] : '';
    const cisteSlovo = negPrefix ? slovoPred.slice(1) : slovoPred;
    const idxDvojtecka = cisteSlovo.indexOf(':');

    const tokeny = rozlozitDotaz(trimDotaz);
    const slova = tokeny.filter(t => !t.negace && !t.klic).flatMap(t => t.varianty);
    const hledatEntity = (jenNajit() || (idxDvojtecka < 0 && !tokeny.some(t => t.klic))) && trimDotaz.length >= 2;

    let moznostiPrikazu = [];
    let moznostiHodnot = [];
    let klicHodnot = '';
    let predCarkou = '';

    kalendar ||= GetKalendar().then(k => k || []).catch(() => { kalendar = null; return []; });
    fotografove ||= GetFotografove().then(f => f || []).catch(() => { fotografove = null; return []; });
    const [modelky, clanky, cisla, seznamFotografu] = await Promise.all([
        vsechnyModelky(),
        hledatEntity ? HledatClanky(trimDotaz).then(c => c || []) : Promise.resolve([]),
        kalendar,
        fotografove,
    ]);
    if (moje !== cisloHledani || document.activeElement !== searchInput) return;

    if (jenNajit()) {
        // Příkazy a filtry by tu nic neudělaly
    } else if (idxDvojtecka >= 0) {
        klicHodnot = bezDiakritiky(cisteSlovo.slice(0, idxDvojtecka)).toLowerCase();
        const zaDvojteckou = cisteSlovo.slice(idxDvojtecka + 1).trim();
        const idxCarka = zaDvojteckou.lastIndexOf(',');
        predCarkou = idxCarka >= 0 ? zaDvojteckou.slice(0, idxCarka + 1) : '';
        const filtrHodnoty = idxCarka >= 0 ? zaDvojteckou.slice(idxCarka + 1).trim() : zaDvojteckou;
        moznostiHodnot = ziskatMoznostiHodnot(klicHodnot, filtrHodnoty, modelky, seznamFotografu);
    } else if (cisteSlovo.length >= 1) {
        moznostiPrikazu = ziskatMoznostiPrikazu(slovoPred);
    }

    const obalka = new Map(cisla.map(k => [k.vydani, k.nahled]));

    let nalezeneModelky = [];
    let nalezenaCisla = [];
    let nalezeneClanky = [];
    let nalezeniFotografove = [];

    // Pokud uživatel nepíše cílený filtr s dvojtečkou a dotaz má alespoň 2 znaky, prohledáme i modelky, články, čísla a fotografy
    if (hledatEntity) {
        const cistyDotaz = bezDiakritiky(trimDotaz).toLowerCase();
        nalezeneModelky = modelky
            // Všechna slova musí platit (i vylučovaná); překlepy se tolerují jen ve jméně
            .filter(m => vyhovujeHledani([ziskejTextModelky(m)], tokeny, { jmeno: `${m.jmeno} ${m.dalsiJmena || ''}` }))
            .map(m => {
                const jmenoN = bezDiakritiky(m.jmeno).toLowerCase();
                const zacina = jmenoN.startsWith(cistyDotaz) || jmenoN.split(/\s+/).some(cast => cast.startsWith(cistyDotaz));
                const vJmene = zacina || vyhovujeHledani([m.jmeno, m.dalsiJmena], tokeny, { jmeno: `${m.jmeno} ${m.dalsiJmena || ''}` });
                return { m, zacina, vJmene };
            })
            .sort((a, b) => (a.zacina !== b.zacina ? (a.zacina ? -1 : 1)
                : a.vJmene !== b.vJmene ? (a.vJmene ? -1 : 1)
                    : (b.m.hodnoceni || 0) !== (a.m.hodnoceni || 0) ? (b.m.hodnoceni || 0) - (a.m.hodnoceni || 0)
                        : a.m.jmeno.localeCompare(b.m.jmeno)))
            .map(x => x.m)
            .slice(0, NEJVIC_MODELEK);

        nalezenaCisla = cisla
            .filter(k => vyhovujeHledani([nazevVydani(k.vydani), k.vydani, k.modelka || ''], tokeny, poleCisla(k.vydani, k.modelka || '')))
            .map(k => ({ k, vNazvu: vyhovujeHledani([nazevVydani(k.vydani), k.vydani], tokeny) }))
            .sort((a, b) => (a.vNazvu !== b.vNazvu ? (a.vNazvu ? -1 : 1) : b.k.vydani.localeCompare(a.k.vydani)))
            .map(x => x.k)
            .slice(0, NEJVIC_CISEL);

        nalezeneClanky = clanky.slice(0, NEJVIC_CLANKU);

        nalezeniFotografove = seznamFotografu
            .filter(j => vyhovujeHledani([j], tokeny, { jmeno: j }))
            .sort((a, b) => {
                const zacA = bezDiakritiky(a).toLowerCase().startsWith(cistyDotaz);
                const zacB = bezDiakritiky(b).toLowerCase().startsWith(cistyDotaz);
                return zacA !== zacB ? (zacA ? -1 : 1) : a.localeCompare(b);
            })
            .slice(0, NEJVIC_FOTOGRAFU);
    }

    const nahled = (url, tvar = '') => `<span class="naseptavac-nahled ${tvar}">${url ? `<img src="${esc(url)}" alt="" draggable="false" />` : ''}</span>`;
    polozky = [];
    let pocetSloupcu = 0;
    const vytvorSkupinu = (nazev, seznam, druh, trida, vykresliPolozku) => {
        if (!seznam.length) return '';
        const skupinaIdx = pocetSloupcu++;
        const obsah = seznam.map((prvek, radekIdx) => {
            const { akce, html } = vykresliPolozku(prvek);
            polozky.push({ akce, druh, skupina: skupinaIdx, radek: radekIdx });
            return `<button type="button" class="naseptavac-polozka" data-polozka="${polozky.length - 1}" role="option">${html}</button>`;
        }).join('');
        return `<section class="naseptavac-skupina ${trida}"><h5><span>${esc(nazev)}</span><span class="naseptavac-pocet">${seznam.length}</span></h5><div class="naseptavac-seznam">${obsah}</div></section>`;
    };

    const detailModelky = m => {
        const casti = [
            kategorieModelky(m).filter(k => !k.odvozena).map(popisKategorie).join(', '),
            m.vlasyBarva,
            m.narodnost,
            m.vydani[0] ? nazevVydani(m.vydani[0]) : '',
        ].filter(Boolean);
        return zvyraznit(casti.join(' · '), slova);
    };

    const sekce = [
        vytvorSkupinu('Příkazy vyhledávání', moznostiPrikazu, 'vlozit', 'naseptavac-prikazy', p => ({
            akce: () => nahraditAktivniSlovo(p.prikaz, false),
            html: `
            <span class="naseptavac-nahled-ikona">⌨</span>
            <span class="naseptavac-text">
                <span class="naseptavac-nazev"><code class="naseptavac-kod">${esc(p.prikaz)}</code></span>
                <span class="naseptavac-kde">${esc(p.popis)}</span>
            </span>`,
        })),
        vytvorSkupinu(`Možnosti filtru ${klicHodnot}`, moznostiHodnot, 'vlozit', 'naseptavac-prikazy', h => {
            const hodnotaText = /\s/.test(h.hodnota) ? `"${h.hodnota}"` : h.hodnota;
            const celyVyraz = `${negPrefix}${klicHodnot}:${predCarkou}${hodnotaText}`;
            return {
                akce: () => nahraditAktivniSlovo(celyVyraz, true),
                html: `
                <span class="naseptavac-nahled-ikona">🏷</span>
                <span class="naseptavac-text">
                    <span class="naseptavac-nazev"><code class="naseptavac-kod">${esc(celyVyraz)}</code></span>
                    <span class="naseptavac-kde">${esc(h.popis)}</span>
                </span>`,
            };
        }),
        vytvorSkupinu('Modelky', nalezeneModelky, 'otevrit', '', m => ({
            akce: () => otevritDetailModelky(m),
            html: `
            ${nahled(adresaTitulni(m), 'kulaty')}
            <span class="naseptavac-text">
                <span class="naseptavac-nazev">${zvyraznit(m.jmeno, slova)}</span>
                <span class="naseptavac-kde">${detailModelky(m)}</span>
            </span>`,
        })),
        vytvorSkupinu('Čísla', nalezenaCisla, 'otevrit', '', k => ({
            akce: () => otevritVydani(k.vydani),
            html: `
            ${nahled(k.nahled ? obrazek(k.nahled, VELIKOST_NAHLEDU) : '')}
            <span class="naseptavac-text">
                <span class="naseptavac-nazev">${zvyraznit(nazevVydani(k.vydani), slova)}</span>
                <span class="naseptavac-kde">${k.modelka ? zvyraznit(k.modelka, slova) : esc(paskaCisla(k.vydani))}</span>
            </span>`,
        })),
        vytvorSkupinu('Články', nalezeneClanky, 'otevrit', '', c => ({
            akce: () => otevritClanek(c.vydani, c.id),
            html: `
            ${nahled(obalka.get(c.vydani) ? obrazek(obalka.get(c.vydani), VELIKOST_NAHLEDU) : '')}
            <span class="naseptavac-text">
                <span class="naseptavac-rubrika">${esc(c.rubrika || 'Článek')}</span>
                <span class="naseptavac-nazev">${zvyraznit(c.nazev, slova)} <span class="naseptavac-kde">· ${esc([nazevVydani(c.vydani), c.strana ? `strana ${c.strana}` : ''].filter(Boolean).join(' · '))}</span></span>
                ${c.ukazka ? `<span class="naseptavac-ukazka">${zvyraznit(c.ukazka, slova)}</span>` : ''}
            </span>`,
        })),
        vytvorSkupinu('Fotografové', nalezeniFotografove, 'otevrit', '', jmeno => ({
            akce: () => otevritFotografa(jmeno),
            html: `
            <span class="naseptavac-nahled-ikona">📷</span>
            <span class="naseptavac-text">
                <span class="naseptavac-nazev">${zvyraznit(jmeno, slova)}</span>
                <span class="naseptavac-kde">Fotograf</span>
            </span>`,
        })),
    ].filter(Boolean);

    vybrana = -1;
    const prvni = otevritPrvni;
    otevritPrvni = false;
    if (!sekce.length) {
        zavritNaseptavac();
        return;
    }
    const viceSloupcu = sekce.length > 1;
    naseptavac.classList.toggle('uzky', !viceSloupcu);
    naseptavac.innerHTML = `<div class="naseptavac-mrizka">${sekce.join('')}</div><div class="naseptavac-pata">↑↓${viceSloupcu ? ' ←→' : ''} vybrat · Enter ${jenNajit() ? 'otevřít první' : 'vložit/otevřít'} · Esc zavřít</div>`;
    naseptavac.classList.remove('hidden');
    zavoj.classList.remove('hidden');
    if (prvni) otevrit(0);
}

// Přepnutí přehledu nebo stránky: staré výsledky ani rozběhnuté hledání už neplatí
export function zrusitHledani() {
    clearTimeout(casovac);
    cisloHledani++;
    otevritPrvni = false;
    zavritNaseptavac();
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
    const polozka = polozky[index];
    if (!polozka) return;
    zavritNaseptavac();
    // Otevření konkrétní modelky, čísla, článku nebo fotografa zruší čekající filtrování a schová pruh hledání,
    // aby nezakrýval nově otevřený profil nebo stránku čísla; vložení příkazu/filtru pruh ponechá otevřený
    if (polozka.druh === 'otevrit') {
        clearTimeout(stav.casovacHledani);
        if (jenNajit()) searchInput.value = '';
        searchInput.blur();
        nastavitViditelnostHledani(false);
    }
    polozka.akce();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    searchInput.addEventListener('input', () => {
        clearTimeout(casovac);
        casovac = setTimeout(hledat, 120);
    });
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 1) hledat();
    });
    // Zavření (blur, Esc) zruší i čekající hledání, jinak by se výsledky po chvíli znovu otevřely
    searchInput.addEventListener('blur', () => {
        clearTimeout(casovac);
        cisloHledani++;
        zavritNaseptavac();
    });

    searchInput.addEventListener('keydown', (e) => {
        // Esc zruší i hledání, které ještě nedoběhlo (výsledky se ještě neukázaly)
        if (e.key === 'Escape') {
            clearTimeout(casovac);
            cisloHledani++;
            otevritPrvni = false;
            if (naseptavac.classList.contains('hidden')) {
                e.stopPropagation();
                if ((jenNajit() || hledaniVeFronte()) && searchInput.value) {
                    searchInput.value = '';
                    if (hledaniVeFronte()) hledatVeFronte('');
                }
                searchInput.blur();
                nastavitViditelnostHledani(false);
                return;
            }
        }
        // Enter dřív, než se ukázaly výsledky: na stránkách Přehledu a podstránkách se otevře první, až hledání doběhne
        if (e.key === 'Enter' && naseptavac.classList.contains('hidden') && jenNajit() && searchInput.value.trim().length >= 2) {
            e.preventDefault();
            otevritPrvni = true;
            clearTimeout(casovac);
            hledat();
            return;
        }
        if (naseptavac.classList.contains('hidden')) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!polozky.length) return;
            const dolu = e.key === 'ArrowDown';
            vybrat(vybrana < 0 ? (dolu ? 0 : polozky.length - 1) : (vybrana + (dolu ? 1 : -1) + polozky.length) % polozky.length);
        } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && vybrana >= 0) {
            const aktualni = polozky[vybrana];
            const pocetSkupin = (polozky.at(-1)?.skupina ?? 0) + 1;
            if (aktualni && pocetSkupin > 1) {
                e.preventDefault();
                const smer = e.key === 'ArrowRight' ? 1 : -1;
                const cilovaSkupina = (aktualni.skupina + smer + pocetSkupin) % pocetSkupin;
                const veSkupine = polozky.map((p, idx) => ({ p, idx })).filter(x => x.p.skupina === cilovaSkupina);
                if (veSkupine.length) {
                    const cil = veSkupine[Math.min(aktualni.radek, veSkupine.length - 1)];
                    vybrat(cil.idx);
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (vybrana >= 0 || (jenNajit() && polozky.length)) {
                otevrit(Math.max(vybrana, 0));
            } else if (vPodstrance() && searchInput.value.trim()) {
                const text = searchInput.value;
                zavritNaseptavac();
                searchInput.blur();
                nastavitViditelnostHledani(false);
                zapamatovatMisto({});
                prepnoutRezim('modelky');
                searchInput.value = text;
                nacistGalerii(text);
            } else {
                zavritNaseptavac();
                searchInput.blur();
            }
        } else if (e.key === 'Escape') {
            // Esc zavře jen výsledky; profil ani stránka čísla se nezavřou
            e.stopPropagation();
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
