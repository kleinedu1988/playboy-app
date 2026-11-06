// Časopis (1.3.0): číslo složené z dat sbírky jako tištěný časopis přes celé okno. Obálka, obsah, články
// (dlouhý text pokračuje na dalších stranách), pictorialy, datový list modelky a centerfold přes dvojstranu.
// Strany mají pevnou velikost (STRANA_SIRKA × STRANA_VYSKA), dvojstrana se zvětší podle okna jako fotka
// v prohlížeči. Nic se neukládá: časopis se pokaždé sestaví z alb, článků a údajů modelek.
import { esc, formatDatum, formatMarkdown, nazevVydani, obrazek } from '../lib/format';
import { sestavitAlba } from '../lib/alba';
import { GetClanky, GetVydani, GetVydaniInfo } from './backend';
import { vsechnyModelky } from './mezipamet';
import { otevreneOkno } from '../ui/dom';

const STRANA_SIRKA = 600;
const STRANA_VYSKA = 800;
const VELIKOST_STRANY = 'w1600';
const VELIKOST_NAHLEDU_STRANY = 'w200';

const casopis = /** @type {HTMLElement} */ (document.getElementById('casopis'));
const stul = /** @type {HTMLElement} */ (document.getElementById('casopisStul'));
const pas = /** @type {HTMLElement} */ (document.getElementById('casopisPas'));

/**
 * Strana časopisu: html obsahu, třída podle druhu, foto pro náhled v pásu; centerfold zabírá dvojstranu
 * @typedef {{ druh: string, html: string, foto?: string, nazev?: string }} Strana
 */

/** @type {Strana[]} */
let strany = [];
/** @type {number[][]} */
let dvojstrany = [];
let aktualni = 0;
let nazevCisla = '';

// Dvojstrany: obálka samostatně vpravo, dál dvojice sudá (vlevo) + lichá (vpravo) jako v tištěném čísle
function sestavitDvojstrany() {
    dvojstrany = [[0]];
    for (let i = 1; i < strany.length; i += 2) dvojstrany.push(i + 1 < strany.length ? [i, i + 1] : [i]);
}

const cisloStrany = i => i + 1;

// ---------- Sestavení obsahu čísla ----------

// Pořadí částí: články podle strany; pictorial modelky, o které je článek, hned za ním; centerfold
// s datovým listem doprostřed čísla; ostatní pictorialy za centerfold
function poradiCasti(clanky, pictorialy, centerfoldy) {
    const seStranou = clanky.filter(c => c.strana > 0).sort((a, b) => a.strana - b.strana);
    const bezStrany = clanky.filter(c => !(c.strana > 0));
    const pouzite = new Set();
    /** @type {{ druh: string, data: any }[]} */
    const casti = [];
    for (const c of [...seStranou, ...bezStrany]) {
        casti.push({ druh: 'clanek', data: c });
        const pict = c.modelkaId && pictorialy.find(a => a.modelkaId === c.modelkaId && !pouzite.has(a));
        if (pict) {
            pouzite.add(pict);
            casti.push({ druh: 'pictorial', data: pict });
        }
    }
    const zbyle = pictorialy.filter(a => !pouzite.has(a)).map(a => ({ druh: 'pictorial', data: a }));
    const stred = Math.ceil(casti.length / 2);
    const cf = centerfoldy.map(a => ({ druh: 'centerfold', data: a }));
    casti.splice(stred, 0, ...cf, ...zbyle);
    return casti;
}

// ---------- Šablony stran ----------

const zahlaviStrany = (vlevo, vpravo) =>
    `<div class="cas-zahlavi"><span>${esc(vlevo)}</span><span>${esc(vpravo)}</span></div>`;

function stranaObalky(cover, info, vydani, cfModelka) {
    if (cover) {
        return { druh: 'obalka', foto: cover, nazev: 'Obálka',
            html: `<img class="cas-foto-plna" src="${esc(obrazek(cover, VELIKOST_STRANY))}" alt="" draggable="false" />` };
    }
    // Bez coveru typografická obálka: titul, datum a modelka na obálce
    const naObalce = info.jmenoObalky || info.naObalce || cfModelka || '';
    return { druh: 'obalka obalka-text', nazev: 'Obálka', html: `
        <div class="cas-titul">PLAYBOY</div>
        <div class="cas-titul-datum">${esc(nazevVydani(vydani))}</div>
        ${naObalce ? `<div class="cas-titul-modelka">${esc(naObalce)}</div>` : ''}` };
}

function stranaObsahu(polozky, vydani) {
    return { druh: 'obsah', nazev: 'Obsah', html: `
        ${zahlaviStrany('Playboy', nazevVydani(vydani))}
        <h2 class="cas-obsah-nadpis">Obsah</h2>
        <ol class="cas-obsah">${polozky.map(p => `
            <li data-na-stranu="${p.index}"><span class="cas-obsah-strana">${cisloStrany(p.index)}</span>
                <span class="cas-obsah-text"><span class="cas-obsah-rubrika">${esc(p.rubrika)}</span>${esc(p.nazev)}</span></li>`).join('')}
        </ol>` };
}

function stranaPlakatu() {
    return { druh: 'vypln', nazev: '', html: `<div class="cas-vypln"><span>PLAYBOY</span><small>${esc(nazevCisla)}</small></div>` };
}

// Datový list modelky (centerfold): údaje ze sbírky a titulní fotka
function stranaDatovehoListu(modelka) {
    const radky = [
        ['Jméno', modelka.jmeno],
        ['Narozena', [formatDatum(modelka.narozeniDatum), modelka.narozeniMisto].filter(Boolean).join(', ')],
        ['Národnost', modelka.narodnost],
        ['Výška', modelka.vyskaCm ? `${modelka.vyskaCm} cm` : ''],
        ['Váha', modelka.vahaKg ? `${modelka.vahaKg} kg` : ''],
        ['Míry', modelka.miry],
        ['Vlasy', modelka.vlasyBarva],
        ['Oči', modelka.ociBarva],
    ].filter(([, h]) => h);
    const foto = modelka.coverUrl ? obrazek(modelka.coverUrl, 'w800') : '';
    return { druh: 'datovy-list', foto: modelka.coverUrl || '', nazev: `Údaje: ${modelka.jmeno}`, html: `
        ${zahlaviStrany('Playmate', modelka.jmeno)}
        <h2 class="cas-list-nadpis">Údaje modelky</h2>
        ${foto ? `<img class="cas-list-foto" src="${esc(foto)}" alt="" draggable="false" />` : ''}
        <dl class="cas-list">${radky.map(([n, h]) => `<div><dt>${esc(n)}</dt><dd>${esc(h)}</dd></div>`).join('')}</dl>
        ${modelka.poznamka ? `<div class="cas-list-text">${formatMarkdown(modelka.poznamka)}</div>` : ''}` };
}

function stranyPictorialu(album) {
    const fotky = album.polozky.map(p => p.fotky[0]?.url).filter(Boolean);
    if (!fotky.length) return [];
    const nadpis = album.typ === 'Centerfold' ? album.jmenoModelky : album.album;
    /** @type {Strana[]} */
    const vysledek = [{ druh: 'pictorial-otvirak', foto: fotky[0], nazev: nadpis, html: `
        <img class="cas-foto-plna" src="${esc(obrazek(fotky[0], VELIKOST_STRANY))}" alt="" draggable="false" />
        <div class="cas-otvirak-text">
            <div class="cas-otvirak-rubrika">${esc(album.typ === 'Centerfold' ? 'Playmate' : 'Pictorial')}</div>
            <h2>${esc(nadpis)}</h2>
            ${album.jmenoModelky && album.jmenoModelky !== nadpis ? `<div class="cas-otvirak-modelka">${esc(album.jmenoModelky)}</div>` : ''}
            ${album.fotograf ? `<div class="cas-otvirak-foto">Foto: ${esc(album.fotograf)}</div>` : ''}
        </div>` }];
    let zbyle = fotky.slice(1);
    if (album.popis) {
        vysledek.push({ druh: 'pictorial-text', foto: zbyle[0], nazev: nadpis, html: `
            ${zahlaviStrany(album.typ === 'Centerfold' ? 'Playmate' : 'Pictorial', nadpis)}
            <div class="cas-pictorial-text">${formatMarkdown(album.popis)}</div>
            ${zbyle[0] ? `<img class="cas-pictorial-foto" src="${esc(obrazek(zbyle[0], VELIKOST_STRANY))}" alt="" draggable="false" />` : ''}` });
        zbyle = zbyle.slice(1);
    }
    for (const url of zbyle) {
        vysledek.push({ druh: 'foto', foto: url, nazev: nadpis,
            html: `<img class="cas-foto-plna" src="${esc(obrazek(url, VELIKOST_STRANY))}" alt="" loading="lazy" draggable="false" />` });
    }
    return vysledek;
}

// Centerfold přes dvojstranu: dvě strany, levá nese obrázek přes obě (pravá je jen místo)
function stranyCenterfoldu(album) {
    const polozka = album.polozky[0];
    if (!polozka?.fotky.length) return [];
    const rot = polozka.rotace || 0;
    const fotky = polozka.fotky.map(f => `<img src="${esc(obrazek(f.url, VELIKOST_STRANY))}" alt="" draggable="false" />`).join('');
    return [
        { druh: 'centerfold', foto: polozka.fotky[0].url, nazev: `Centerfold: ${album.jmenoModelky}`,
            html: `<div class="cas-cf-plocha" data-rot="${rot}"><div class="cas-centerfold-plakat">${fotky}</div></div>` },
        { druh: 'centerfold-prava', foto: polozka.fotky[0].url, nazev: `Centerfold: ${album.jmenoModelky}`, html: '' },
    ];
}

// ---------- Článek: sazba do sloupců a dělení na strany ----------

// Měřicí strana mimo obrazovku se stejnými rozměry a styly jako skutečná (v těle stránky: okno časopisu
// je při sestavování ještě skryté a skrytý prvek nemá rozměry)
function merici() {
    let m = document.getElementById('casopisMereni');
    if (!m) {
        m = document.createElement('div');
        m.id = 'casopisMereni';
        m.className = 'casopis-mereni';
        m.setAttribute('aria-hidden', 'true');
        document.body.append(m);
    }
    return m;
}

// Rozdělí text článku na strany: první strana s rubrikou, titulkem a autorem, další jen se záhlavím.
// Bloky (odstavce, nadpisy, seznamy) se plní do dvou sloupců, dokud se vejdou; odstavec, který se nevejde,
// se rozdělí po slovech.
function stranyClanku(clanek) {
    const prvni = `
        <div class="cas-clanek-hlava">
            <div class="cas-clanek-rubrika">${esc(clanek.rubrika || 'Článek')}</div>
            <h2 class="cas-clanek-titulek">${esc(clanek.nazev)}</h2>
            ${clanek.autor || clanek.druh === 'shrnuti' ? `<div class="cas-clanek-autor">${esc([clanek.autor ? `Text: ${clanek.autor}` : '', clanek.druh === 'shrnuti' ? 'shrnutí' : ''].filter(Boolean).join(' · '))}</div>` : ''}
        </div>`;
    const zahlavi = zahlaviStrany(clanek.rubrika || 'Článek', clanek.nazev);
    const sablona = document.createElement('div');
    sablona.innerHTML = formatMarkdown(clanek.text || '') || '<p><em>Text článku zatím není přepsaný.</em></p>';
    // Fronta bloků k sazbě; rozdělený odstavec vrátí svůj zbytek na začátek fronty
    const fronta = /** @type {HTMLElement[]} */ ([...sablona.children]);

    const m = merici();
    /** @type {Strana[]} */
    const vysledek = [];
    while (fronta.length) {
        const jePrvni = vysledek.length === 0;
        m.innerHTML = `<div class="${tridaStrany(`clanek${jePrvni ? ' clanek-prvni' : ''}`)}">${jePrvni ? prvni : zahlavi}<div class="cas-sloupce"></div></div>`;
        const sloupce = /** @type {HTMLElement} */ (m.querySelector('.cas-sloupce'));
        const preteka = () => sloupce.scrollWidth > sloupce.clientWidth + 1 || sloupce.scrollHeight > sloupce.clientHeight + 1;
        let vlozeno = 0;
        while (fronta.length) {
            const blok = fronta[0];
            sloupce.append(blok);
            if (!preteka()) {
                fronta.shift();
                vlozeno++;
                continue;
            }
            blok.remove();
            // Prostý odstavec se rozdělí po slovech; formátovaný blok jde celý na další stranu
            const slova = blok.tagName === 'P' && blok.children.length === 0 ? (blok.textContent || '').trim().split(/\s+/) : [];
            if (slova.length > 8) {
                const zkusebni = /** @type {HTMLElement} */ (blok.cloneNode(false));
                const vejdeSe = n => {
                    zkusebni.textContent = slova.slice(0, n).join(' ');
                    sloupce.append(zkusebni);
                    const ok = !preteka();
                    zkusebni.remove();
                    return ok;
                };
                let dole = 0;
                let nahore = slova.length - 1;
                while (dole < nahore) {
                    const stred = Math.ceil((dole + nahore) / 2);
                    if (vejdeSe(stred)) dole = stred;
                    else nahore = stred - 1;
                }
                if (dole >= 4) {
                    zkusebni.textContent = slova.slice(0, dole).join(' ');
                    sloupce.append(zkusebni);
                    const zbytek = /** @type {HTMLElement} */ (blok.cloneNode(false));
                    zbytek.textContent = slova.slice(dole).join(' ');
                    zbytek.classList.add('cas-pokracovani');
                    fronta[0] = zbytek;
                    vlozeno++;
                }
            }
            // Blok větší než celá prázdná strana se vloží i tak, jinak by sazba nepokročila
            if (!vlozeno) sloupce.append(/** @type {HTMLElement} */ (fronta.shift()));
            break;
        }
        vysledek.push({ druh: `clanek${jePrvni ? ' clanek-prvni' : ''}`, nazev: clanek.nazev,
            html: /** @type {HTMLElement} */ (m.firstElementChild).innerHTML });
    }
    m.innerHTML = '';
    return vysledek;
}

// ---------- Vykreslení ----------

// Třída strany podle druhu má předponu cas-s-, aby se nepletla s prvky uvnitř strany
const tridaStrany = druh => `cas-strana ${druh.split(' ').map(d => `cas-s-${d}`).join(' ')}`;
const htmlStrany = (i, strana) => `<div class="${tridaStrany(strana.druh)}" data-strana="${i}">${strana.html}
    ${strana.druh.startsWith('obalka') || strana.druh.startsWith('centerfold') || !i ? '' : `<span class="cas-cislo">${cisloStrany(i)}</span>`}</div>`;

function prizpusobit() {
    const plocha = /** @type {HTMLElement} */ (stul.parentElement);
    const dvojice = dvojstrany[aktualni]?.length === 2 || aktualni > 0;
    const sirka = dvojice ? STRANA_SIRKA * 2 : STRANA_SIRKA;
    const dostupnaSirka = plocha.clientWidth - 2 * 70;
    const dostupnaVyska = plocha.clientHeight - 24;
    const meritko = Math.max(0.2, Math.min(dostupnaSirka / sirka, dostupnaVyska / STRANA_VYSKA));
    stul.style.width = `${sirka}px`;
    stul.style.height = `${STRANA_VYSKA}px`;
    stul.style.setProperty('--cas-meritko', String(meritko));
}

function vykreslit() {
    const indexy = dvojstrany[aktualni];
    const centerfold = strany[indexy[0]]?.druh === 'centerfold';
    // Obálka vpravo samostatně; poslední lichá strana vlevo
    const jenPrava = aktualni === 0;
    stul.className = `casopis-stul ${jenPrava ? 'jen-prava' : indexy.length === 1 ? 'jen-leva' : 'dve'}${centerfold ? ' s-centerfoldem' : ''}`;
    stul.innerHTML = indexy.map(i => htmlStrany(i, strany[i])).join('') + (indexy.length === 2 ? '<div class="cas-hrbet"></div>' : '');
    const popis = indexy.map(cisloStrany);
    document.getElementById('casopisStrany').textContent =
        `${popis.length > 1 ? `strany ${popis[0]}–${popis[1]}` : `strana ${popis[0]}`} z ${strany.length}`;
    pas.querySelectorAll('[data-dvojstrana]').forEach(b => b.classList.toggle('active', parseInt(/** @type {HTMLElement} */ (b).dataset.dvojstrana) === aktualni));
    pas.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    casopis.querySelector('[data-krok-casopisu="-1"]').toggleAttribute('disabled', aktualni === 0);
    casopis.querySelector('[data-krok-casopisu="1"]').toggleAttribute('disabled', aktualni === dvojstrany.length - 1);
    prizpusobit();
}

function vykreslitPas() {
    pas.innerHTML = dvojstrany.map((s, k) => {
        const foto = s.map(i => strany[i].foto).find(Boolean);
        const popis = s.map(cisloStrany).join('–');
        const nazev = s.map(i => strany[i].nazev).find(Boolean) || '';
        return `<button type="button" data-dvojstrana="${k}" title="${esc(`${popis}${nazev ? ` · ${nazev}` : ''}`)}">
            ${foto ? `<img src="${esc(obrazek(foto, VELIKOST_NAHLEDU_STRANY))}" alt="" loading="lazy" draggable="false" />` : '<span class="cas-pas-text">Aa</span>'}
            <small>${popis}</small></button>`;
    }).join('');
}

function prejit(novy) {
    const cil = Math.min(dvojstrany.length - 1, Math.max(0, novy));
    if (cil === aktualni) return;
    aktualni = cil;
    vykreslit();
}

// ---------- Otevření ----------

export async function otevritCasopis(vydani) {
    const [fotky, info, clanky, modelky] = await Promise.all([
        GetVydani(vydani).then(f => f || []), GetVydaniInfo(vydani), GetClanky(vydani).then(c => c || []), vsechnyModelky()]);
    const alba = sestavitAlba(fotky);
    const cover = alba.find(a => a.typ === 'Cover')?.polozky[0]?.fotky[0]?.url || '';
    const centerfoldy = alba.filter(a => a.typ === 'Centerfold');
    const pictorialy = alba.filter(a => a.typ !== 'Cover' && a.typ !== 'Centerfold');
    const podleId = new Map((modelky || []).map(m => [m.id, m]));
    nazevCisla = nazevVydani(vydani);

    // Nejdřív obsahová část (stránky za obsahem), obsah se doplní podle toho, kde části začínají
    /** @type {Strana[]} */
    const telo = [];
    const polozkyObsahu = [];
    const ZACATEK = 2;
    for (const cast of poradiCasti(clanky, pictorialy, centerfoldy)) {
        if (cast.druh === 'clanek') {
            polozkyObsahu.push({ index: ZACATEK + telo.length, rubrika: cast.data.rubrika || 'Článek', nazev: cast.data.nazev });
            telo.push(...stranyClanku(cast.data));
        } else if (cast.druh === 'pictorial') {
            polozkyObsahu.push({ index: ZACATEK + telo.length, rubrika: 'Pictorial', nazev: cast.data.album });
            telo.push(...stranyPictorialu(cast.data));
        } else {
            const modelka = podleId.get(cast.data.modelkaId);
            polozkyObsahu.push({ index: ZACATEK + telo.length, rubrika: 'Playmate', nazev: cast.data.jmenoModelky });
            if (modelka) telo.push(stranaDatovehoListu(modelka));
            // Centerfold musí začít vlevo (sudé pořadí strany = lichý index od obálky)
            if ((ZACATEK + telo.length) % 2 === 0) telo.push(stranaPlakatu());
            telo.push(...stranyCenterfoldu(cast.data));
            // Další fotky centerfoldového alba jako pictorial
            if (cast.data.polozky.length > 1) telo.push(...stranyPictorialu({ ...cast.data, polozky: cast.data.polozky.slice(1), popis: '' }));
        }
    }

    const cfModelka = centerfoldy[0]?.jmenoModelky || '';
    strany = [stranaObalky(cover, info, vydani, cfModelka), stranaObsahu(polozkyObsahu, vydani), ...telo];
    sestavitDvojstrany();
    aktualni = 0;
    document.getElementById('casopisNazev').textContent = `Playboy · ${nazevCisla}`;
    casopis.classList.remove('hidden');
    vykreslitPas();
    vykreslit();
    casopis.focus();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    casopis.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const sipka = /** @type {HTMLElement | null} */ (cil.closest('[data-krok-casopisu]'));
        const dvojstrana = /** @type {HTMLElement | null} */ (cil.closest('[data-dvojstrana]'));
        const naStranu = /** @type {HTMLElement | null} */ (cil.closest('[data-na-stranu]'));
        if (sipka) prejit(aktualni + parseInt(sipka.dataset.krokCasopisu));
        else if (dvojstrana) prejit(parseInt(dvojstrana.dataset.dvojstrana));
        else if (naStranu) {
            const index = parseInt(naStranu.dataset.naStranu);
            prejit(dvojstrany.findIndex(s => s.includes(index)));
        } else if (cil.closest('#casopisStul')) {
            // Klik na stranu listuje: levá polovina zpět, pravá dál
            const r = stul.getBoundingClientRect();
            prejit(aktualni + (/** @type {MouseEvent} */ (e).clientX < r.left + r.width / 2 ? -1 : 1));
        }
    });

    document.addEventListener('keydown', (e) => {
        if (casopis.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
        if (otevreneOkno('casopis')) return;
        const kroky = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1, ' ': 1, Home: -Infinity, End: Infinity };
        if (e.key in kroky) {
            e.preventDefault();
            e.stopPropagation();
            const k = kroky[e.key];
            if (k === -Infinity) prejit(0);
            else if (k === Infinity) prejit(dvojstrany.length - 1);
            else prejit(aktualni + (e.shiftKey && e.key === ' ' ? -1 : k));
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            casopis.classList.add('hidden');
        }
    }, true);

    window.addEventListener('resize', () => { if (!casopis.classList.contains('hidden')) prizpusobit(); });
}
