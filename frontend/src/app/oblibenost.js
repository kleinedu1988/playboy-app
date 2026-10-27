// Oblíbenost v Přehledu ve dvou částech, které se přepínají volbou pod hledáním (jako části Přehledu):
//   - Porovnávání „Která se ti líbí víc?“: dvě nezávislé galerie nad sebou, nahoře jedna modelka, dole druhá, vlevo
//     titulní fotka se jménem a srdíčky, vedle pás fotek (porovnani-pasy.js); pás pod myší je aktivní – kolečko a ← →
//     listují, Tab přepne, Enter nebo „♥ Tahle“ vybere, ↓ nebo mezerník remíza, Backspace vrátí poslední, S přeskočí,
//     1–5 srdíčka fotce. Okruh dvojic je také pod hledáním.
//   - Pořadí podle síly (Bradley–Terry v backendu, předpoklad ze srdíček, skóre fotek a zájmu) s trendem a vedle něj
//     Mohlo by se ti líbit: nehodnocené s odhadem z modelu vkusu a věta o jeho přesnosti.
// Srdíčka ve stránce obsluhuje galerie.js (data-hodnoceni, modelky z stav.prehledModelky), profil otevírá
// prehled.js (data-otevrit-modelku).
import { GetDvojiceKPorovnani, GetMohloByTeLibit, GetNahledyModelek, GetOblibenost, PorovnatModelky, SetHodnoceni, VratitPorovnani } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { dnesniPocet, idDvojice, kratceSrdicka, navrhPoPorovnani, pruhySily, textModeluVkusu, textSrdicek, znakySrdicek } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, stoupajiKlesaji, textSkoreFotek, textVahyFotek, textVahyZajmu } from '../lib/oblibenost';
import { stav } from './stav';
import { stats } from './prvky';
import { VELIKOST_PLAKATU_MALA, adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { klavesaPasu, pripravitPasy, vykreslitPasy } from './porovnani-pasy';
import { duvodyOdhadu, htmlSrdicka } from './galerie';
import { obnovitSrdickaModelky } from '../ui/srdicka';
import { jeVidet, nastavitHtml, nastavitText, otevreneOkno } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';

const OKRUHY = [['stejne', 'Stejné srdíčko', 'Dvojice se stejným počtem srdíček – zpřesní pořadí uvnitř úrovně'],
    ['', 'Všechny', 'Dvojice napříč sbírkou, které model vkusu nejvíc pomohou'],
    ['nehodnocene', 'I nehodnocené', 'Přimíchá i modelky bez srdíček']];
// Části Oblíbenosti (volba pod hledáním) a jejich ikony v liště (ui/volby.js)
export const CASTI_OBLIBENOSTI = [['porovnani', 'Porovnávání'], ['poradi', 'Pořadí']];
const DVOJIC_NAJEDNOU = 8;
const PORADI_NAJEDNOU = 25;
const TIPU = 12;
const PRECHOD_MS = 170;

let koren = null;
let fronta = []; // dvojice na řadě [{ a, b, duvod }]; první je zobrazená
const historie = []; // porovnané dvojice pro Vrátit
let zaneprazdneno = false;
let posledniNavrh = null;
let poradiVse = false;
let data = { oblibenost: null, tipy: [] };
let porovnanoOdObnoveni = 0;

// Nejlepší fotky modelek pro galerii obou (id modelky → [{ id, url, album, typ, hodnoceni, rotace }]) a rozpracovaná
// načtení; fronta je má načtené dopředu, galerie se pak otevře hned
const nahledy = new Map();
const nacitaniNahledu = new Map();

const modelka = id => stav.prehledModelky.get(id);
const dnes = () => new Date().toISOString().slice(0, 10);
function nactiDnes() {
    try { return dnesniPocet(JSON.parse(localStorage.getItem('porovnaniDnes') || 'null'), dnes()); } catch { return 0; }
}
function ulozDnes(pocet) {
    try { localStorage.setItem('porovnaniDnes', JSON.stringify({ datum: dnes(), pocet })); } catch { /* jen pro toto spuštění */ }
}
let porovnaniDnes = nactiDnes();

const okruh = () => stav.oblibenostOkruh;
const videt = () => !!koren?.isConnected && stav.rezim === 'prehled' && stav.prehledSekce === 'oblibenost' && !stats.classList.contains('hidden');

// Volby Oblíbenosti do lišty pod hledáním (prehled.js je vloží místo částí Přehledu): část a u porovnávání okruh dvojic
export const htmlVolebOblibenosti = () => `<div class="prehled-casti volby-v-liste">${CASTI_OBLIBENOSTI.map(([klic, nazev]) =>
    `<button class="chip ${klic === stav.oblibenostCast ? 'active' : ''}" data-zobrazeni-oblibenosti="${klic}">${nazev}</button>`).join('')}${stav.oblibenostCast === 'porovnani'
    ? OKRUHY.map(([klic, nazev, popis]) => `<button class="chip ${klic === okruh() ? 'active' : ''}" data-okruh-oblibenosti="${klic}" title="${popis}">${nazev}</button>`).join('') : ''}</div>`;

// Část Oblíbenosti, kterou otevře příští zobrazení (např. pořadí z profilu modelky)
export function nastavitCastOblibenosti(klic) {
    if (!CASTI_OBLIBENOSTI.some(([k]) => k === klic)) return;
    stav.oblibenostCast = klic;
    try { localStorage.setItem('oblibenostCast', klic); } catch { /* jen pro toto spuštění */ }
}

function ukazatCastOblibenosti(klic) {
    nastavitCastOblibenosti(klic);
    if (koren) koren.dataset.obCast = stav.oblibenostCast;
    // Lišta pod hledáním se obnoví v prehled.js (volby části a okruh)
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    document.querySelector('main').scrollTop = 0;
}

const KOSTRA = `
    <div class="ob-cast ob-porovnani" data-ob-porovnani>
        <div class="ob-dvojice" data-ob-dvojice aria-live="polite"></div>
        <div class="ob-ovladani" data-ob-ovladani>
            <span class="ob-napoveda">kolečko nebo <kbd>←</kbd> <kbd>→</kbd> listuje pásem pod myší · <kbd>Tab</kbd> přepne · <kbd>Enter</kbd> nebo ♥ Tahle vybere · <kbd>1</kbd>–<kbd>5</kbd> srdíčka fotce · klik zvětší</span>
            <button type="button" class="btn btn-secondary btn-small" data-ob-volba="remiza" title="Obě stejně (↓ nebo mezerník)"><kbd>↓</kbd> Stejně</button>
            <span class="oddelovac"></span>
            <button type="button" class="link" data-ob-preskocit title="Přeskočit dvojici (S)">Přeskočit <kbd>S</kbd></button>
            <button type="button" class="link" data-ob-vratit title="Vrátit poslední porovnání (Backspace)">Vrátit <kbd>⌫</kbd></button>
            <span class="ob-dnes" data-ob-dnes></span>
        </div>
        <p class="ob-duvod" data-ob-duvod></p>
        <div class="ob-navrh" data-ob-navrh aria-live="polite"></div>
    </div>
    <div class="ob-cast" data-ob-cast-poradi>
        <p class="ob-info" data-ob-info></p>
        <div class="ob-dva-sloupce">
            <div class="ob-karta">
                <h4>Pořadí <small data-ob-pocet-poradi></small></h4>
                <p class="ob-vaha" data-ob-vaha></p>
                <p class="ob-trendy" data-ob-trendy></p>
                <div data-ob-poradi></div>
            </div>
            <div class="ob-karta">
                <h4>Mohlo by se ti líbit <small>odhad podle tvého vkusu</small></h4>
                <div data-ob-tipy></div>
            </div>
        </div>
    </div>`;

const cast = klic => koren?.querySelector(`[data-ob-${klic}]`);

// ——— Načtení ———

export async function nacistOblibenost(sekce) {
    koren = sekce;
    if (!koren.querySelector('[data-ob-porovnani]')) {
        koren.innerHTML = KOSTRA;
        pripravitPasy(cast('dvojice'));
    }
    koren.dataset.obCast = stav.oblibenostCast;
    // Srdíčka fotek se mohla mezitím změnit; fotky se načtou znovu (backend je má v paměti se snímkem sbírky)
    nahledy.clear();
    vykreslitDnes();
    await Promise.all([obnovitPrehled(), fronta.length ? null : doplnitFrontu()]);
    vykreslitDvojici();
}

// Pořadí, tipy a věta o modelu vkusu (po porovnáních se obnoví jen občas, je to přepočet celé sbírky)
async function obnovitPrehled() {
    porovnanoOdObnoveni = 0;
    try {
        const [oblibenost, tipy] = await Promise.all([GetOblibenost(), GetMohloByTeLibit(TIPU)]);
        data = { oblibenost, tipy: tipy || [] };
    } catch {
        nastavitText(cast('info'), 'Oblíbenost se nepodařilo načíst.');
        return;
    }
    [...(data.oblibenost?.poradi || []), ...data.tipy].forEach(p => { if (p.duvod && p.odhad) duvodyOdhadu.set(p.modelkaId, p.duvod); });
    if (!koren?.isConnected) return;
    nastavitText(cast('info'), textModeluVkusu(data.oblibenost || {}));
    vykreslitPoradi();
    vykreslitTipy();
}

async function doplnitFrontu() {
    let nove = [];
    try {
        nove = (await GetDvojiceKPorovnani(DVOJIC_NAJEDNOU, okruh()) || []).map(idDvojice);
    } catch { /* prázdná fronta ukáže prázdný stav */ }
    const videne = new Set(fronta.map(d => `${d.a}-${d.b}`));
    fronta.push(...nove.filter(d => d.a && d.b && d.a !== d.b && modelka(d.a) && modelka(d.b) && !videne.has(`${d.a}-${d.b}`)));
    // Seznamy fotek celé fronty jedním voláním; zobrazená dvojice pak pásy doplní
    nacistNahledy(fronta.flatMap(d => [d.a, d.b])).then(() => {
        prednacist();
        if (fronta[0]) vykreslitDvojici();
    });
}

// První fotky pásů další dvojice se načtou dopředu, přechod pak nebliká
function prednacist() {
    fronta.slice(1, 2).forEach(d => [d.a, d.b].forEach(id => (nahledy.get(id) || []).slice(0, 5)
        .forEach(f => { new Image().src = obrazek(f.url, VELIKOST_PLAKATU_MALA); })));
}

// Fotky modelek, které ještě nejsou načtené; čeká i na rozpracovaná načtení týchž modelek
async function nacistNahledy(ids) {
    const chybi = [...new Set(ids)].filter(id => id && !nahledy.has(id) && !nacitaniNahledu.has(id));
    if (chybi.length) {
        const nacteni = GetNahledyModelek(chybi, NAHLEDU_V_POROVNANI)
            .then(vysledek => chybi.forEach(id => nahledy.set(id, vysledek?.[id] || [])))
            .catch(() => chybi.forEach(id => nahledy.set(id, [])))
            .finally(() => chybi.forEach(id => nacitaniNahledu.delete(id)));
        chybi.forEach(id => nacitaniNahledu.set(id, nacteni));
    }
    await Promise.all([...new Set(ids)].map(id => nacitaniNahledu.get(id)).filter(Boolean));
}

// ——— Vykreslení ———

function vykreslitDnes() {
    nastavitText(cast('dnes'), porovnaniDnes ? `dnes ${porovnaniDnes} porovnání` : 'dnes zatím žádné porovnání');
}

function vykreslitDvojici() {
    const misto = cast('dvojice');
    if (!misto) return;
    const d = fronta[0];
    cast('ovladani').classList.toggle('hidden', !d);
    nastavitText(cast('duvod'), d?.duvod || '');
    if (!d) {
        const malo = (data.oblibenost?.modelek || 0) < 2 && okruh() !== 'nehodnocene';
        delete misto.dataset.pasy;
        nastavitHtml(misto, malo
            ? htmlPrazdna('Zatím není co porovnávat', 'Porovnávání potřebuje aspoň dvě modelky se srdíčky. Ohodnoť pár modelek nebo zapni „I nehodnocené“.', { ikona: 'srdce' })
            : htmlPrazdna('Dvojice došly', okruh() === 'stejne' ? 'Na stejné úrovni srdíček teď není co porovnat. Zkus Všechny.' : 'Pro tenhle okruh teď nemám další dvojice.', { ikona: 'srdce' })
                + (okruh() !== '' ? '<p class="ob-prazdne-akce"><button type="button" class="btn btn-secondary btn-small" data-okruh-oblibenosti="">Porovnávat všechny</button></p>' : ''));
        return;
    }
    const [a, b] = [modelka(d.a), modelka(d.b)];
    misto.dataset.pasy = '';
    vykreslitPasy(misto, {
        a: { modelka: a, fotky: nahledy.get(d.a) || null, celkem: a.pocetFotek || 0 },
        b: { modelka: b, fotky: nahledy.get(d.b) || null, celkem: b.pocetFotek || 0 },
    });
    cast('vratit')?.toggleAttribute('disabled', !historie.length);
    if (!nahledy.has(d.a) || !nahledy.has(d.b)) nacistNahledy([d.a, d.b]).then(() => { if (fronta[0] === d) vykreslitDvojici(); });
}

function vykreslitPoradi() {
    const o = data.oblibenost;
    const poradi = (o?.poradi || []).filter(p => modelka(p.modelkaId));
    nastavitText(cast('pocet-poradi'), poradi.length ? sklonovat(poradi.length, 'modelka', 'modelky', 'modelek') : '');
    nastavitText(cast('vaha'), o && poradi.length ? `${textVahyFotek(o)} ${textVahyZajmu(o)}` : '');
    // Stoupají / klesají proti snímku pořadí před trendDni dny (historii si program vede sám, jednou denně)
    const { stoupaji, klesaji } = stoupajiKlesaji(poradi);
    const jmena = (seznam, smer, znak) => seznam.map(p => `<button type="button" class="link" data-otevrit-modelku="${p.modelkaId}">${esc(modelka(p.modelkaId).jmeno)}</button> <span class="trend ${smer}">${znak}${Math.abs(p.zmenaPoradi)}</span>`).join(', ');
    nastavitHtml(cast('trendy'), o?.trendDni && (stoupaji.length || klesaji.length)
        ? [stoupaji.length ? `Stoupají: ${jmena(stoupaji, 'nahoru', '▲')}` : '', klesaji.length ? `Klesají: ${jmena(klesaji, 'dolu', '▼')}` : ''].filter(Boolean).join(' · ')
            + ` <small>(${o.trendDni === 1 ? 'od včerejška' : `za ${o.trendDni} dní`})</small>` : '');
    // Pořadí dávají srdíčka a fotky už bez porovnání; prázdné je jen bez hodnocených modelek i fotek
    if (!poradi.length) {
        nastavitHtml(cast('poradi'), htmlPrazdna('Pořadí vznikne z porovnávání', 'Po pár volbách nahoře tu uvidíš, které modelky máš nejradši – jemněji, než ukážou srdíčka.', { ikona: 'hvezda' }));
        return;
    }
    const ukazat = poradiVse ? poradi : poradi.slice(0, PORADI_NAJEDNOU);
    const pruhy = pruhySily(poradi);
    nastavitHtml(cast('poradi'), `<ol class="ob-poradi">${ukazat.map((p, i) => {
        const m = modelka(p.modelkaId);
        const { sirka, nejistota } = pruhy[i];
        const fotky = textSkoreFotek(p.skoreFotek);
        const popis = `${m.jmeno}: ${p.duvod || sklonovat(p.porovnani || 0, 'porovnání', 'porovnání', 'porovnání')} · síla ${cislo(p.sila)} ± ${cislo(p.nejistota)}`;
        return `<li class="${p.odhadZFotek ? 'ob-z-fotek' : ''}"><button type="button" class="ob-radek" data-otevrit-modelku="${m.id}" title="${esc(popis)}">
            <span class="ob-misto">${p.poradi || i + 1}.</span>
            <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
            <span class="ob-jmeno-radku">${esc(m.jmeno)}<small>${m.hodnoceni ? `<i>${znakySrdicek(m.hodnoceni)}</i>` : p.odhadZFotek ? '<span class="ob-odhad-fotek" title="Zatím bez srdíček a porovnání – místo v pořadí je jen odhad podle srdíček jejích fotek">odhad z fotek</span>' : 'bez srdíček'}${fotky ? ` · <span class="ob-fotky" title="${esc(`Skóre fotek z ${sklonovat(p.albFotek, 'alba', 'alb', 'alb')} a ${sklonovat(p.fotekHodnocenych, 'hodnocené fotky', 'hodnocených fotek', 'hodnocených fotek')}`)}">${fotky}</span>` : ''}${p.zmenaPoradi && o.trendDni ? ` · <span class="trend ${p.zmenaPoradi > 0 ? 'nahoru' : 'dolu'}" title="${esc(`${p.zmenaPoradi > 0 ? 'Stoupla' : 'Klesla'} o ${sklonovat(Math.abs(p.zmenaPoradi), 'místo', 'místa', 'míst')} za ${o.trendDni} dní`)}">${p.zmenaPoradi > 0 ? '▲' : '▼'}${Math.abs(p.zmenaPoradi)}</span>` : ''}${p.zajem >= 0.05 ? ' · <span class="ob-zajem" title="Často otevíráš její profil nebo prohlížíš fotky – posouvá ji to v pořadí uvnitř srdíček">zájem</span>' : ''}</small></span>
            <span class="ob-pruh" aria-hidden="true"><i style="width:${sirka}%"></i>${nejistota ? `<b style="left:${Math.max(0, sirka - nejistota)}%; width:${Math.min(100, sirka + nejistota) - Math.max(0, sirka - nejistota)}%"></b>` : ''}</span>
            <small class="ob-pocet">${p.porovnani || 0}×</small>
        </button></li>`;
    }).join('')}</ol>
        ${ukazat.length < poradi.length ? `<button type="button" class="link ob-vse" data-ob-poradi-vse>Zobrazit všech ${poradi.length}</button>` : ''}`);
    nacitatPostupne(cast('poradi'));
}

const cislo = n => (Number(n) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 2 });

function vykreslitTipy() {
    const tipy = data.tipy.filter(p => modelka(p.modelkaId));
    if (!tipy.length) {
        nastavitHtml(cast('tipy'), htmlPrazdna('Zatím bez tipů', 'Model vkusu potřebuje víc hodnocených modelek. Až jich bude dost, ukáže tu nehodnocené, které by se ti mohly líbit.', { ikona: 'srdce' }));
        return;
    }
    nastavitHtml(cast('tipy'), `<div class="ob-tipy">${tipy.map(p => {
        const m = modelka(p.modelkaId);
        return `<div class="ob-tip ${m.hodnoceni ? 'ohodnoceno' : ''}" data-tip-modelky="${m.id}">
            <button type="button" class="ob-tip-foto" data-otevrit-modelku="${m.id}" title="Otevřít profil" aria-label="${esc(m.jmeno)} – otevřít profil">
                <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
                <span class="odhad-chip" data-odhad="${m.id}" title="${esc(`Odhad podle tvého vkusu: ${textSrdicek(p.odhad)}`)}">odhad ${kratceSrdicka(p.odhad)}</span>
            </button>
            <button type="button" class="ob-jmeno" data-otevrit-modelku="${m.id}">${esc(m.jmeno)}</button>
            ${p.duvod ? `<small class="ob-tip-duvod">${esc(p.duvod)}</small>` : ''}
            ${htmlSrdicka(m)}
        </div>`;
    }).join('')}</div>`);
    nacitatPostupne(cast('tipy'));
}

// ——— Porovnání ———

async function vybrat(vysledek) {
    const d = fronta[0];
    if (!d || zaneprazdneno) return;
    zaneprazdneno = true;
    const dvojice = cast('dvojice');
    dvojice.dataset.vybrano = vysledek;
    let ok = false;
    try {
        ok = await PorovnatModelky(d.a, d.b, vysledek);
    } catch { /* oznámí se níž */ }
    if (!ok) {
        delete dvojice.dataset.vybrano;
        zaneprazdneno = false;
        oznamit('Porovnání se nepodařilo uložit.');
        return;
    }
    historie.push(d);
    porovnaniDnes++;
    ulozDnes(porovnaniDnes);
    vykreslitDnes();
    ukazatNavrh(navrhPoPorovnani(modelka(d.a), modelka(d.b), vysledek), d);
    await dalsi();
    if (++porovnanoOdObnoveni >= 5) obnovitPrehled();
}

// Další dvojice s krátkým přechodem: vybraná se rozzáří, obě zmizí, nové se objeví
async function dalsi() {
    const dvojice = cast('dvojice');
    dvojice.classList.add('odchazi');
    fronta.shift();
    const doplneni = fronta.length < 3 ? doplnitFrontu() : null;
    await new Promise(r => setTimeout(r, PRECHOD_MS));
    if (!fronta.length) await doplneni;
    delete dvojice.dataset.vybrano;
    vykreslitDvojici();
    dvojice.classList.remove('odchazi');
    zaneprazdneno = false;
    prednacist();
}

function preskocit() {
    if (!fronta[0] || zaneprazdneno) return;
    zaneprazdneno = true;
    ukazatNavrh(null);
    dalsi();
}

async function vratit() {
    if (zaneprazdneno || !historie.length) return;
    zaneprazdneno = true;
    let ok = false;
    try {
        ok = await VratitPorovnani();
    } catch { /* oznámí se níž */ }
    zaneprazdneno = false;
    if (!ok) return oznamit('Poslední porovnání se nepodařilo vrátit.');
    fronta.unshift(historie.pop());
    porovnaniDnes = Math.max(0, porovnaniDnes - 1);
    ulozDnes(porovnaniDnes);
    vykreslitDnes();
    ukazatNavrh(null);
    vykreslitDvojici();
    obnovitPrehled();
}

// Po volbě, která hodně odporuje srdíčkům, nenápadná nabídka srovnat je (vítězka dostane srdíčka poražené)
function ukazatNavrh(navrh, d = null) {
    posledniNavrh = navrh && d ? { id: navrh.modelka === 'a' ? d.a : d.b, hodnoceni: navrh.hodnoceni } : null;
    const misto = cast('navrh');
    if (!posledniNavrh) return nastavitHtml(misto, '');
    const vitezka = modelka(posledniNavrh.id), porazena = modelka(navrh.modelka === 'a' ? d.b : d.a);
    nastavitHtml(misto, `<span>Vybraná <b>${esc(vitezka.jmeno)}</b> má ${textSrdicek(vitezka.hodnoceni)}, ${esc(porazena.jmeno)} ${textSrdicek(porazena.hodnoceni)}.</span>
        <button type="button" class="btn btn-primary btn-small" data-ob-navrh-ano>Dát jí ${kratceSrdicka(posledniNavrh.hodnoceni)} ♥</button>
        <button type="button" class="link" data-ob-navrh-ne>Nechat</button>`);
}

async function prijmoutNavrh() {
    const n = posledniNavrh;
    if (!n) return;
    ukazatNavrh(null);
    if (!await SetHodnoceni(n.id, n.hodnoceni)) return oznamit('Hodnocení se nepodařilo uložit.');
    const m = modelka(n.id);
    if (m) m.hodnoceni = n.hodnoceni;
    [stav.aktualniModelka, ...stav.nacteneModelky].forEach(x => { if (x?.id === n.id) x.hodnoceni = n.hodnoceni; });
    document.querySelectorAll(`.hearts-pul[data-hodnoceni="${n.id}"]`).forEach(r => obnovitSrdickaModelky(r, n.hodnoceni));
    oznamit(`${m?.jmeno || 'Modelka'} má teď ${textSrdicek(n.hodnoceni)}.`);
}

function zmenitOkruh(klic) {
    if (klic === okruh()) return;
    stav.oblibenostOkruh = klic;
    try { localStorage.setItem('oblibenostOkruh', klic); } catch { /* jen pro toto spuštění */ }
    fronta = [];
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    doplnitFrontu().then(vykreslitDvojici);
}

// ——— Události ———

export function pripravit() {
    try { stav.oblibenostOkruh = localStorage.getItem('oblibenostOkruh') ?? ''; } catch { /* všechny */ }
    if (!OKRUHY.some(([klic]) => klic === stav.oblibenostOkruh)) stav.oblibenostOkruh = '';
    try { stav.oblibenostCast = localStorage.getItem('oblibenostCast') || 'porovnani'; } catch { /* porovnávání */ }
    // Dřívější samostatná část tipů je teď v Pořadí
    if (stav.oblibenostCast === 'tipy') stav.oblibenostCast = 'poradi';
    if (!CASTI_OBLIBENOSTI.some(([klic]) => klic === stav.oblibenostCast)) stav.oblibenostCast = 'porovnani';

    // Volby v liště pod hledáním: část Oblíbenosti a okruh dvojic (skryté štítky v obsahu Přehledu)
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        const castVolba = t.closest?.('[data-zobrazeni-oblibenosti]');
        const okruhVolba = t.closest?.('[data-okruh-oblibenosti]');
        if (castVolba && castVolba.dataset.zobrazeniOblibenosti !== stav.oblibenostCast) ukazatCastOblibenosti(castVolba.dataset.zobrazeniOblibenosti);
        else if (okruhVolba) zmenitOkruh(okruhVolba.dataset.okruhOblibenosti);
    });

    stats.addEventListener('click', (e) => {
        if (!koren?.contains(e.target)) return;
        const volba = e.target.closest('[data-ob-volba]')?.dataset.obVolba;
        if (volba) vybrat(volba);
        else if (e.target.closest('[data-ob-preskocit]')) preskocit();
        else if (e.target.closest('[data-ob-vratit]')) vratit();
        else if (e.target.closest('[data-ob-navrh-ano]')) prijmoutNavrh();
        else if (e.target.closest('[data-ob-navrh-ne]')) ukazatNavrh(null);
        else if (e.target.closest('[data-ob-poradi-vse]')) { poradiVse = true; vykreslitPoradi(); }
    });

    // Klávesy porovnání, když je Oblíbenost vidět a nepíše se ani nehodnotí srdíčky (zaměřená srdíčka mají šipky)
    document.addEventListener('keydown', (e) => {
        if (!videt() || stav.oblibenostCast !== 'porovnani' || !fronta[0] && e.key !== 'Backspace' || e.ctrlKey || e.metaKey || e.altKey || stav.zamceno) return;
        if (e.target.closest?.('input, textarea, select, [role="slider"], [contenteditable]')) return;
        if (otevreneOkno() || jeVidet('lightbox') || jeVidet('zkratky') || jeVidet('contextMenu')) return;
        // Na zaměřeném tlačítku v Oblíbenosti dělají mezerník a Enter to, co tlačítko (jinde, třeba v liště, je mezerník remíza)
        if ((e.key === ' ' || e.key === 'Enter') && e.target.closest?.('button') && koren.contains(e.target)) return;
        const akce = (!zaneprazdneno && klavesaPasu(e, vybrat))
            || { ArrowDown: () => vybrat('remiza'), ' ': () => vybrat('remiza'), Backspace: vratit, s: preskocit, S: preskocit }[e.key];
        if (!akce) return;
        e.preventDefault();
        akce();
    });

    // Srdíčka změněná kdekoli: tip se ztlumí jako ohodnocený, pořadí ukáže nová srdíčka při příštím obnovení
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        koren?.querySelector(`[data-tip-modelky="${id}"]`)?.classList.toggle('ohodnoceno', hodnoceni > 0);
    });
}
