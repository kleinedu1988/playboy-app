// Oblíbenost v Přehledu: porovnávání dvojic („Která se ti líbí víc?“), pořadí podle síly z porovnání
// (Bradley–Terry v backendu), „Mohlo by se ti líbit“ s odhadem hodnocení z modelu vkusu a věta o jeho přesnosti.
// Klávesy porovnání: ← / → vybere, ↓ nebo mezerník remíza, Backspace vrátí poslední, S přeskočí; klik na fotku vybere.
// Srdíčka ve stránce obsluhuje galerie.js (data-hodnoceni, modelky z stav.prehledModelky), profil otevírá
// prehled.js (data-otevrit-modelku).
import { GetDvojiceKPorovnani, GetMohloByTeLibit, GetOblibenost, PorovnatModelky, SetHodnoceni, VratitPorovnani } from './backend';
import { esc, sklonovat } from '../lib/format';
import { dnesniPocet, idDvojice, kratceSrdicka, navrhPoPorovnani, pruhySily, textModeluVkusu, textSrdicek, znakySrdicek } from '../lib/srdicka';
import { stav } from './stav';
import { stats } from './prvky';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { duvodyOdhadu, htmlSrdicka } from './galerie';
import { obnovitSrdickaModelky } from '../ui/srdicka';
import { jeVidet, nastavitHtml, nastavitText, otevreneOkno } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';

const OKRUHY = [['stejne', 'Stejné srdíčko', 'Dvojice se stejným počtem srdíček – zpřesní pořadí uvnitř úrovně'],
    ['', 'Všechny', 'Dvojice napříč sbírkou, které model vkusu nejvíc pomohou'],
    ['nehodnocene', 'I nehodnocené', 'Přimíchá i modelky bez srdíček']];
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

const KOSTRA = `
    <p class="ob-info" data-ob-info></p>
    <div class="ob-karta" data-ob-porovnani>
        <div class="ob-hlava">
            <h4>Která se ti líbí víc?</h4>
            <div class="ob-okruh" role="group" aria-label="Které dvojice porovnávat" data-ob-okruh></div>
            <span class="ob-dnes" data-ob-dnes></span>
        </div>
        <div class="ob-dvojice" data-ob-dvojice aria-live="polite"></div>
        <div class="ob-ovladani" data-ob-ovladani>
            <button type="button" class="btn btn-secondary btn-small" data-ob-volba="a" title="Vybrat levou (←)"><kbd>←</kbd> Levá</button>
            <button type="button" class="btn btn-secondary btn-small" data-ob-volba="remiza" title="Obě stejně (↓ nebo mezerník)"><kbd>↓</kbd> Stejně</button>
            <button type="button" class="btn btn-secondary btn-small" data-ob-volba="b" title="Vybrat pravou (→)">Pravá <kbd>→</kbd></button>
            <span class="oddelovac"></span>
            <button type="button" class="link" data-ob-preskocit title="Přeskočit dvojici (S)">Přeskočit <kbd>S</kbd></button>
            <button type="button" class="link" data-ob-vratit title="Vrátit poslední porovnání (Backspace)">Vrátit <kbd>⌫</kbd></button>
        </div>
        <div class="ob-navrh" data-ob-navrh aria-live="polite"></div>
    </div>
    <div class="ob-dva-sloupce">
        <div class="ob-karta">
            <h4>Pořadí <small data-ob-pocet-poradi></small></h4>
            <div data-ob-poradi></div>
        </div>
        <div class="ob-karta">
            <h4>Mohlo by se ti líbit <small>odhad podle tvého vkusu</small></h4>
            <div data-ob-tipy></div>
        </div>
    </div>`;

const cast = klic => koren?.querySelector(`[data-ob-${klic}]`);

// ——— Načtení ———

export async function nacistOblibenost(sekce) {
    koren = sekce;
    if (!koren.querySelector('[data-ob-porovnani]')) koren.innerHTML = KOSTRA;
    vykreslitOkruh();
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
    prednacist();
}

// Fotky další dvojice se načtou dopředu, přechod pak nebliká
function prednacist() {
    fronta.slice(1, 3).forEach(d => [d.a, d.b].forEach(id => { new Image().src = adresaTitulni(modelka(id), true); }));
}

// ——— Vykreslení ———

function vykreslitOkruh() {
    nastavitHtml(cast('okruh'), OKRUHY.map(([klic, nazev, popis]) =>
        `<button type="button" class="chip ${klic === okruh() ? 'active' : ''}" data-ob-okruh-volba="${klic}" aria-pressed="${klic === okruh()}" title="${popis}">${nazev}</button>`).join(''));
}

function vykreslitDnes() {
    nastavitText(cast('dnes'), porovnaniDnes ? `dnes ${porovnaniDnes} porovnání` : 'dnes zatím žádné porovnání');
}

const htmlStrany = (strana, m) => `
    <div class="ob-strana" data-strana="${strana}">
        <button type="button" class="ob-foto" data-ob-volba="${strana}" title="${strana === 'a' ? 'Tahle (←)' : 'Tahle (→)'}" aria-label="Vybrat ${esc(m.jmeno)}">
            <img src="${esc(adresaTitulni(m, true))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
        </button>
        <div class="ob-popis">
            <button type="button" class="ob-jmeno" data-otevrit-modelku="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>
            ${htmlSrdicka(m)}
        </div>
    </div>`;

function vykreslitDvojici() {
    const misto = cast('dvojice');
    if (!misto) return;
    const d = fronta[0];
    cast('ovladani').classList.toggle('hidden', !d);
    if (!d) {
        const malo = (data.oblibenost?.modelek || 0) < 2 && okruh() !== 'nehodnocene';
        nastavitHtml(misto, malo
            ? htmlPrazdna('Zatím není co porovnávat', 'Porovnávání potřebuje aspoň dvě modelky se srdíčky. Ohodnoť pár modelek nebo zapni „I nehodnocené“.', { ikona: 'srdce' })
            : htmlPrazdna('Dvojice došly', okruh() === 'stejne' ? 'Na stejné úrovni srdíček teď není co porovnat. Zkus Všechny.' : 'Pro tenhle okruh teď nemám další dvojice.', { ikona: 'srdce' })
                + (okruh() !== '' ? '<p class="ob-prazdne-akce"><button type="button" class="btn btn-secondary btn-small" data-ob-okruh-volba="">Porovnávat všechny</button></p>' : ''));
        return;
    }
    const [a, b] = [modelka(d.a), modelka(d.b)];
    nastavitHtml(misto, `${htmlStrany('a', a)}<span class="ob-nebo" aria-hidden="true">nebo</span>${htmlStrany('b', b)}
        ${d.duvod ? `<p class="ob-duvod">${esc(d.duvod)}</p>` : ''}`);
    cast('vratit')?.toggleAttribute('disabled', !historie.length);
}

function vykreslitPoradi() {
    const o = data.oblibenost;
    const poradi = (o?.poradi || []).filter(p => modelka(p.modelkaId));
    nastavitText(cast('pocet-poradi'), poradi.length ? sklonovat(poradi.length, 'modelka', 'modelky', 'modelek') : '');
    if (!o?.porovnani || !poradi.length) {
        nastavitHtml(cast('poradi'), htmlPrazdna('Pořadí vznikne z porovnávání', 'Po pár volbách nahoře tu uvidíš, které modelky máš nejradši – jemněji, než ukážou srdíčka.', { ikona: 'hvezda' }));
        return;
    }
    const ukazat = poradiVse ? poradi : poradi.slice(0, PORADI_NAJEDNOU);
    const pruhy = pruhySily(poradi);
    nastavitHtml(cast('poradi'), `<ol class="ob-poradi">${ukazat.map((p, i) => {
        const m = modelka(p.modelkaId);
        const { sirka, nejistota } = pruhy[i];
        return `<li><button type="button" class="ob-radek" data-otevrit-modelku="${m.id}" title="${esc(`${m.jmeno} · síla ${cislo(p.sila)} ± ${cislo(p.nejistota)} · ${sklonovat(p.porovnani || 0, 'porovnání', 'porovnání', 'porovnání')}`)}">
            <span class="ob-misto">${p.poradi || i + 1}.</span>
            <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
            <span class="ob-jmeno-radku">${esc(m.jmeno)}<small>${m.hodnoceni ? `<i>${znakySrdicek(m.hodnoceni)}</i>` : 'bez srdíček'}</small></span>
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
    vykreslitOkruh();
    doplnitFrontu().then(vykreslitDvojici);
}

// ——— Události ———

export function pripravit() {
    try { stav.oblibenostOkruh = localStorage.getItem('oblibenostOkruh') ?? ''; } catch { /* všechny */ }
    if (!OKRUHY.some(([klic]) => klic === stav.oblibenostOkruh)) stav.oblibenostOkruh = '';

    stats.addEventListener('click', (e) => {
        if (!koren?.contains(e.target)) return;
        const volba = e.target.closest('[data-ob-volba]')?.dataset.obVolba;
        const okruhVolba = e.target.closest('[data-ob-okruh-volba]');
        if (volba) vybrat(volba);
        else if (okruhVolba) zmenitOkruh(okruhVolba.dataset.obOkruhVolba);
        else if (e.target.closest('[data-ob-preskocit]')) preskocit();
        else if (e.target.closest('[data-ob-vratit]')) vratit();
        else if (e.target.closest('[data-ob-navrh-ano]')) prijmoutNavrh();
        else if (e.target.closest('[data-ob-navrh-ne]')) ukazatNavrh(null);
        else if (e.target.closest('[data-ob-poradi-vse]')) { poradiVse = true; vykreslitPoradi(); }
    });

    // Klávesy porovnání, když je Oblíbenost vidět a nepíše se ani nehodnotí srdíčky (zaměřená srdíčka mají šipky)
    document.addEventListener('keydown', (e) => {
        if (!videt() || !fronta[0] && e.key !== 'Backspace' || e.ctrlKey || e.metaKey || e.altKey || stav.zamceno) return;
        if (e.target.closest?.('input, textarea, select, [role="slider"], [contenteditable]')) return;
        if (otevreneOkno() || jeVidet('lightbox') || jeVidet('zkratky') || jeVidet('contextMenu')) return;
        // Odrolováno k pořadí: šipky a mezerník zase posouvají stránku
        const karta = cast('porovnani').getBoundingClientRect();
        if (karta.bottom < 120 || karta.top > innerHeight - 120) return;
        // Na zaměřeném tlačítku v Oblíbenosti dělá mezerník to, co tlačítko (jinde, třeba na přepínači v hlavičce, je remíza)
        if (e.key === ' ' && e.target.closest?.('button') && koren.contains(e.target)) return;
        const akce = { ArrowLeft: () => vybrat('a'), ArrowRight: () => vybrat('b'), ArrowDown: () => vybrat('remiza'), ' ': () => vybrat('remiza'),
            Backspace: vratit, s: preskocit, S: preskocit }[e.key];
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
