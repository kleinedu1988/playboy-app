// Oblíbenost v Přehledu ve dvou částech, které se přepínají volbou pod hledáním (jako části Přehledu):
//   - Porovnávání „Která se ti líbí víc?“: dvě nezávislé galerie nad sebou, nahoře jedna modelka, dole druhá, vlevo
//     titulní fotka se jménem a srdíčky, vedle pás fotek (porovnani-pasy.js); pás pod myší je aktivní – kolečko a ← →
//     listují, Tab přepne, Enter nebo „♥ Tahle“ vybere, ↓ nebo mezerník remíza, Backspace vrátí poslední, S přeskočí,
//     1–5 srdíčka fotce. Dvojice volí backend sám: stejné a sousední úrovně, asi třetina nehodnocených proti modelce
//     se srdíčky jejich odhadu a častěji modelky, kterým nesedí srdíčka.
//     Souboj o místo na hranici úrovně (dvojice s druhem „souboj“) má nad švem pásů štítek „Souboj o Top 10“.
//   - Pořadí podle síly (Bradley–Terry v backendu, předpoklad ze srdíček, skóre fotek a zájmu) s trendem a vedle něj
//     Mohlo by se ti líbit: nehodnocené s odhadem z modelu vkusu a věta o jeho přesnosti. Nad nimi „Nesedí se
//     srdíčky“: modelky, které podle porovnání s jinými úrovněmi patří o půl srdíčka výš nebo níž.
//     Pořadí je potvrzené: dělí ho úrovně Top 10 / 20 / 50 / 100 (oddělovače) a modelka, která podmínky vyšší úrovně
//     ještě nesplňuje (porovnání, nejistota, výhra nad top 20 – prahy posílá backend), čeká těsně pod hranicí se
//     štítkem „⏳ čeká na Top 10 (5/8 porovnání)“.
// Srdíčka ve stránce obsluhuje galerie.js (data-hodnoceni, modelky z stav.prehledModelky), profil otevírá
// prehled.js (data-otevrit-modelku).
import { GetDvojiceKPorovnani, GetFotografieModelky, GetMohloByTeLibit, GetNahledyModelek, GetNavrhSrdicek, GetOblibenost, PorovnatModelky, SetHodnoceni, VratitPorovnani } from './backend';
import { esc, sklonovat } from '../lib/format';
import { dnesniPocet, idDvojice, kratceSrdicka, pruhySily, textModeluVkusu, textSrdicek, znakySrdicek } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, bublinaCekani, nadpisSouboje, nazevUrovne, poctyCekajicich, seskupitPodleUrovni, stitekObhajoby, stoupajiKlesaji, textCekajicich, textCekani, textPravidelUrovni, textSkoreFotek, textVahyFotek, textVahyZajmu, urovenModelky } from '../lib/oblibenost';
import { stav } from './stav';
import { stats } from './prvky';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { adresaFotkyPasu, fotekNaObrazovce, klavesaPasu, pripravitPasy, vykreslitPasy } from './porovnani-pasy';
import { lightbox, otevritLightbox } from './prohlizec';
import { seraditAlbaProfilu } from './profil';
import { sestavitAlba } from '../lib/alba';
import { duvodyOdhadu, htmlSrdicka } from './galerie';
import { obnovitSrdickaModelky } from '../ui/srdicka';
import { jeVidet, nastavitHtml, nastavitText, otevreneOkno } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';
import { nacistSinSlavy, pripravitSinSlavy } from './sin-slavy';

// Části Oblíbenosti (volba pod hledáním) a jejich ikony v liště (ui/volby.js)
export const CASTI_OBLIBENOSTI = [['porovnani', 'Porovnávání'], ['poradi', 'Pořadí'], ['slava', 'Síň slávy']];
const DVOJIC_NAJEDNOU = 8;
const PORADI_NAJEDNOU = 25;
const TIPU = 12;
const PRECHOD_MS = 170;

let koren = null;
let fronta = []; // dvojice na řadě [{ a, b, duvod, druh }]; první je zobrazená
const historie = []; // porovnané dvojice pro Vrátit
let zaneprazdneno = false;
let poradiVse = false;
let data = { oblibenost: null, tipy: [] };
let porovnanoOdObnoveni = 0;
const porovnaneOdObnoveni = new Set(); // modelky porovnané od posledního obnovení (oznámení o postupu do úrovně)

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

const videt = () => !!koren?.isConnected && stav.rezim === 'prehled' && stav.prehledSekce === 'oblibenost' && !stats.classList.contains('hidden');

// Volby Oblíbenosti do lišty pod hledáním (prehled.js je vloží místo částí Přehledu): Porovnávání, Pořadí
export const htmlVolebOblibenosti = () => `<div class="prehled-casti volby-v-liste">${CASTI_OBLIBENOSTI.map(([klic, nazev]) =>
    `<button class="chip ${klic === stav.oblibenostCast ? 'active' : ''}" data-zobrazeni-oblibenosti="${klic}">${nazev}</button>`).join('')}</div>`;

// Část Oblíbenosti, kterou otevře příští zobrazení (např. pořadí z profilu modelky)
export function nastavitCastOblibenosti(klic) {
    if (!CASTI_OBLIBENOSTI.some(([k]) => k === klic)) return;
    stav.oblibenostCast = klic;
    try { localStorage.setItem('oblibenostCast', klic); } catch { /* jen pro toto spuštění */ }
}

function ukazatCastOblibenosti(klic) {
    nastavitCastOblibenosti(klic);
    if (koren) koren.dataset.obCast = stav.oblibenostCast;
    if (stav.oblibenostCast === 'slava' && cast('slava')) nacistSinSlavy(cast('slava'));
    // Lišta pod hledáním se obnoví v prehled.js
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    document.querySelector('main').scrollTop = 0;
}

const KOSTRA = `
    <div class="ob-cast ob-porovnani" data-ob-porovnani>
        <div class="ob-dvojice-obal">
            <div class="ob-dvojice" data-ob-dvojice aria-live="polite"></div>
            <span class="ob-souboj hidden" data-ob-souboj aria-live="polite"></span>
        </div>
        <div class="ob-ovladani" data-ob-ovladani>
            <span class="ob-napoveda">kolečko nebo <kbd>←</kbd> <kbd>→</kbd> listuje pásem pod myší · <kbd>Tab</kbd> přepne · <kbd>Enter</kbd> nebo ♥ Tahle vybere · <kbd>1</kbd>–<kbd>5</kbd> srdíčka fotce · klik otevře prohlížeč</span>
            <button type="button" class="btn btn-secondary btn-small" data-ob-volba="remiza" title="Obě stejně (↓ nebo mezerník)"><kbd>↓</kbd> Stejně</button>
            <span class="oddelovac"></span>
            <button type="button" class="link" data-ob-preskocit title="Přeskočit dvojici (S)">Přeskočit <kbd>S</kbd></button>
            <button type="button" class="link" data-ob-vratit title="Vrátit poslední porovnání (Backspace)">Vrátit <kbd>⌫</kbd></button>
            <button type="button" class="link ob-nesedi-odkaz hidden" data-ob-nesedi-odkaz title="Modelky, kterým podle porovnání nesedí srdíčka – otevře Pořadí"></button>
            <span class="ob-dnes" data-ob-dnes></span>
        </div>
        <p class="ob-duvod" data-ob-duvod></p>
        <div class="ob-navrh" data-ob-navrh aria-live="polite"></div>
    </div>
    <div class="ob-cast" data-ob-cast-poradi>
        <p class="ob-info" data-ob-info></p>
        <div class="ob-karta ob-nesedi" data-ob-nesedi></div>
        <div class="ob-dva-sloupce">
            <div class="ob-karta">
                <h4>Pořadí <small data-ob-pocet-poradi></small></h4>
                <p class="ob-vaha" data-ob-vaha></p>
                <p class="ob-trendy" data-ob-trendy></p>
                <p class="ob-cekaji" data-ob-cekaji></p>
                <div data-ob-poradi></div>
                <p class="ob-pravidla" data-ob-pravidla></p>
            </div>
            <div class="ob-karta">
                <h4>Mohlo by se ti líbit <small>odhad podle tvého vkusu</small></h4>
                <div data-ob-tipy></div>
            </div>
        </div>
    </div>
    <div class="ob-cast" data-ob-cast-slava><div data-ob-slava></div></div>`;

const cast = klic => koren?.querySelector(`[data-ob-${klic}]`);

// ——— Načtení ———

export async function nacistOblibenost(sekce) {
    koren = sekce;
    if (!koren.querySelector('[data-ob-porovnani]')) {
        koren.innerHTML = KOSTRA;
        pripravitPasy(cast('dvojice'), otevritFotku);
    }
    koren.dataset.obCast = stav.oblibenostCast;
    if (stav.oblibenostCast === 'slava') nacistSinSlavy(cast('slava'));
    // Srdíčka fotek se mohla mezitím změnit; fotky se načtou znovu (backend je má v paměti se snímkem sbírky)
    nahledy.clear();
    vykreslitDnes();
    await Promise.all([obnovitPrehled(), fronta.length ? null : doplnitFrontu()]);
    vykreslitDvojici();
}

// Pořadí, tipy a věta o modelu vkusu (po porovnáních se obnoví jen občas, je to přepočet celé sbírky)
async function obnovitPrehled() {
    porovnanoOdObnoveni = 0;
    const porovnane = [...porovnaneOdObnoveni];
    porovnaneOdObnoveni.clear();
    const predtim = new Map((data.oblibenost?.poradi || []).map(p => [p.modelkaId, { uroven: urovenModelky(p).uroven, obhajoba: Number(p.obhajoba?.uroven) || 0, vyzyvatelka: Number(p.obhajoba?.vyzyvatelka) || 0 }]));
    try {
        const [oblibenost, tipy] = await Promise.all([GetOblibenost(), GetMohloByTeLibit(TIPU)]);
        data = { oblibenost, tipy: tipy || [] };
    } catch {
        nastavitText(cast('info'), 'Oblíbenost se nepodařilo načíst.');
        return;
    }
    oznamitPostup(porovnane, predtim);
    [...(data.oblibenost?.poradi || []), ...data.tipy].forEach(p => { if (p.duvod && p.odhad) duvodyOdhadu.set(p.modelkaId, p.duvod); });
    if (!koren?.isConnected) return;
    nastavitText(cast('info'), textModeluVkusu(data.oblibenost || {}));
    vykreslitPoradi();
    vykreslitTipy();
    vykreslitNesedi();
    // Pásy zobrazené dvojice ukážou skóre fotek (mění se jen to, co se změnilo)
    if (fronta[0]) vykreslitDvojici();
}

// Porovnaná modelka, která se po přepočtu potvrdila ve vyšší úrovni, dostane krátké oznámení (souboje a dvojice
// o potvrzení mají viditelný výsledek); držitelka, která obhajovala, buď místo obhájila, nebo vypadla. Jen při
// obnovení po porovnání, ne při prvním načtení.
function oznamitPostup(porovnane, predtim) {
    if (!porovnane.length || !predtim.size) return;
    const ted = new Map((data.oblibenost?.poradi || []).map(p => [p.modelkaId, urovenModelky(p).uroven]));
    const zmeny = porovnane.filter(id => modelka(id)).map(id => ({ id, pred: predtim.get(id)?.uroven || 0, obhajoba: predtim.get(id)?.obhajoba || 0, vyzyvatelka: predtim.get(id)?.vyzyvatelka || 0, po: ted.get(id) || 0 }));
    const postup = zmeny.filter(x => x.po && (!x.pred || x.po < x.pred)).sort((x, y) => x.po - y.po)[0];
    const vypadla = zmeny.find(x => x.obhajoba && (!x.po || x.po > x.obhajoba));
    // Obhájila jen po souboji s vyzyvatelkou (ne po jiné dvojici)
    const obhajila = zmeny.find(x => x.obhajoba && x.po && x.po <= x.obhajoba && porovnane.includes(x.vyzyvatelka));
    if (postup) {
        const vytlacila = vypadla ? ` a vytlačila ${modelka(vypadla.id).jmeno}` : '';
        oznamit(`${modelka(postup.id).jmeno} je teď potvrzená v ${nazevUrovne(postup.po)}${vytlacila}.`);
    } else if (vypadla) oznamit(`${modelka(vypadla.id).jmeno} prohrála souboj a vypadla z ${nazevUrovne(vypadla.obhajoba)}.`);
    else if (obhajila) oznamit(`${modelka(obhajila.id).jmeno} obhájila ${nazevUrovne(obhajila.obhajoba)}.`);
}

// ——— Návrhy srdíček ———
// Srdíčka navrhuje jen backend (oblibenost.go, navrhSrdicek): nehodnocené úroveň, na kterou po pár porovnáních
// vychází, hodnocené nesoulad se srdíčky (porovnání s jinými úrovněmi, srdíčka fotek). Návrh pod pásy po porovnání
// (GetNavrhSrdicek) i v „Nesedí se srdíčky“ v Pořadí (GetOblibenost().nesedi) má stejnou větu, „Dát jí“ i „Nechat“.
// „Nechat“ se pamatuje pro modelku, její srdíčka a návrh (po změně srdíček se může ukázat znovu).

const klicNavrhu = (id, hodnoceni, navrh) => `${id}:${hodnoceni}:${navrh}`;
function skryteNavrhy() {
    try { return new Set(JSON.parse(localStorage.getItem('oblibenostNesediSkryte') || '[]')); } catch { return new Set(); }
}
// Zobrazené návrhy podle klíče (pro „Dát jí“): { id, navrh }
const navrhy = new Map();
let navrhPodPasy = ''; // klíč návrhu zobrazeného pod pásy
let cisloNavrhu = 0;

const NESOULADU_NAJEDNOU = 8;
let nesouladyVse = false;
const cislo1 = n => (Number(n) || 0).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// „3 ze 4“, „2 z 5“: ze před čísly, která se vyslovují se skupinou souhlásek (dvou, tří, čtyř, šesti, sedmi, dvanácti…)
const zKolika = n => `${/^(?:[23467]|1[2-467])/.test(String(n)) ? 'ze' : 'z'} ${n}`;

// Proč nesoulad: porovnání, fotky, nebo obojí
function vetaNesouladu(n) {
    const porovnani = n.smer === 'mene'
        ? `prohrála ${n.vysledky} ${zKolika(n.porovnani)} porovnání s modelkami s méně srdíčky`
        : `vyhrála ${n.vysledky} ${zKolika(n.porovnani)} porovnání s modelkami s víc srdíčky`;
    const fotky = `má fotky za ${cislo1(n.skoreFotek)} (${sklonovat(n.albFotek, 'album', 'alba', 'alb')}, ${sklonovat(n.fotekHodnocenych, 'hodnocená', 'hodnocené', 'hodnocených')})`;
    return n.zdroj === 'fotky' ? fotky : n.zdroj === 'oba' ? `${porovnani} a ${fotky}` : porovnani;
}

// Věta a tlačítka návrhu; nesoulad = položka nesouladu (hodnocená), jinak nehodnocená { porovnani, vyhry }
function htmlNavrhu(id, navrh, nesoulad, nehodnocena = null) {
    const m = modelka(id);
    const klic = klicNavrhu(id, m.hodnoceni || 0, navrh);
    navrhy.set(klic, { id, navrh });
    const jmeno = `<button type="button" class="link" data-otevrit-modelku="${id}">${esc(m.jmeno)}</button>`;
    const veta = nesoulad
        ? `${jmeno} (${kratceSrdicka(m.hodnoceni)} ♥) ${vetaNesouladu(nesoulad)} – možná jí patří <b>${kratceSrdicka(navrh)} ♥</b>`
        : `Nehodnocená ${jmeno} vychází po ${nehodnocena.porovnani} porovnáních (výhry ${String(nehodnocena.vyhry).replace('.', ',')}) na <b>${kratceSrdicka(navrh)} ♥</b>`;
    return { klic, html: `<span>${veta}</span>
        <button type="button" class="btn btn-primary btn-small" data-ob-navrh-ano="${klic}">Dát jí ${kratceSrdicka(navrh)} ♥</button>
        <button type="button" class="link" data-ob-navrh-ne="${klic}">Nechat</button>` };
}

// Po porovnání: návrh pro jednu z modelek dvojice, když ho backend má a nebyl odmítnut
async function ukazatNavrhPoPorovnani(d) {
    const moje = ++cisloNavrhu;
    zobrazitNavrhPodPasy(null);
    for (const id of [d.a, d.b]) {
        let n = null;
        try {
            n = await GetNavrhSrdicek(id);
        } catch { /* bez návrhu */ }
        if (moje !== cisloNavrhu) return;
        if (!n?.hodnoceni || !modelka(id)) continue;
        const navrh = htmlNavrhu(id, n.hodnoceni, n.nesoulad || null, n);
        if (skryteNavrhy().has(navrh.klic)) continue;
        return zobrazitNavrhPodPasy(navrh);
    }
}

function zobrazitNavrhPodPasy(navrh) {
    navrhPodPasy = navrh?.klic || '';
    nastavitHtml(cast('navrh'), navrh?.html || '');
}

const viditelneNesoulady = () => {
    const skryte = skryteNavrhy();
    return (data.oblibenost?.nesedi || []).filter(n => modelka(n.modelkaId) && !skryte.has(klicNavrhu(n.modelkaId, n.hodnoceni, n.navrh)));
};

function vykreslitNesedi() {
    const vsechny = viditelneNesoulady();
    const seznam = nesouladyVse ? vsechny : vsechny.slice(0, NESOULADU_NAJEDNOU);
    const odkaz = cast('nesedi-odkaz');
    odkaz?.classList.toggle('hidden', !seznam.length);
    nastavitText(odkaz, vsechny.length ? `Nesedí se srdíčky (${vsechny.length}) →` : '');
    nastavitHtml(cast('nesedi'), seznam.length ? `<h4>Nesedí se srdíčky <small>podle porovnání s jinými úrovněmi a srdíček fotek</small></h4>
        <ul class="ob-nesedi-seznam">${seznam.map(n => `<li>
                <span class="trend ${n.smer === 'mene' ? 'dolu' : 'nahoru'}">${n.smer === 'mene' ? '▼' : '▲'}</span>
                ${htmlNavrhu(n.modelkaId, n.navrh, n).html}
            </li>`).join('')}</ul>
        ${seznam.length < vsechny.length ? `<button type="button" class="link ob-vse" data-ob-nesedi-vse>Zobrazit všech ${vsechny.length}</button>` : ''}` : '');
}

// „Dát jí“: srdíčka se uloží a ukážou všude, kde modelka je; návrh zmizí pod pásy i z Nesedí se srdíčky
async function prijmoutNavrh(klic) {
    const n = navrhy.get(klic);
    if (!n) return;
    if (!await SetHodnoceni(n.id, n.navrh)) return oznamit('Hodnocení se nepodařilo uložit.');
    const m = modelka(n.id);
    if (m) m.hodnoceni = n.navrh;
    [stav.aktualniModelka, ...stav.nacteneModelky].forEach(x => { if (x?.id === n.id) x.hodnoceni = n.navrh; });
    document.querySelectorAll(`.hearts-pul[data-hodnoceni="${n.id}"]`).forEach(r => obnovitSrdickaModelky(r, n.navrh));
    if (navrhPodPasy === klic) zobrazitNavrhPodPasy(null);
    if (data.oblibenost) data.oblibenost.nesedi = (data.oblibenost.nesedi || []).filter(x => x.modelkaId !== n.id);
    vykreslitNesedi();
    oznamit(`${m?.jmeno || 'Modelka'} má teď ${textSrdicek(n.navrh)}.`);
    obnovitPrehled();
}

function odmitnoutNavrh(klic) {
    const skryte = skryteNavrhy();
    skryte.add(klic);
    try { localStorage.setItem('oblibenostNesediSkryte', JSON.stringify([...skryte].slice(-300))); } catch { /* jen pro toto spuštění */ }
    if (navrhPodPasy === klic) zobrazitNavrhPodPasy(null);
    vykreslitNesedi();
}

async function doplnitFrontu() {
    let nove = [];
    try {
        nove = (await GetDvojiceKPorovnani(DVOJIC_NAJEDNOU, '') || []).map(idDvojice);
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
    fronta.slice(1, 2).forEach(d => [d.a, d.b].forEach(id => (nahledy.get(id) || []).slice(0, fotekNaObrazovce())
        .forEach(f => { new Image().src = adresaFotkyPasu(f); })));
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
    // Souboj o místo na hranici úrovně: štítek nad švem pásů (nic neposouvá) a zvýrazněný důvod
    const souboj = d ? nadpisSouboje(d, polozkaPoradi(d.a) || modelka(d.a), polozkaPoradi(d.b) || modelka(d.b)) : '';
    nastavitText(cast('souboj'), souboj ? `⚔ ${souboj}` : '');
    cast('souboj').classList.toggle('hidden', !souboj);
    cast('duvod').classList.toggle('souboj', !!souboj);
    if (!d) {
        const malo = (data.oblibenost?.hodnocenych || 0) < 2;
        delete misto.dataset.pasy;
        nastavitHtml(misto, malo
            ? htmlPrazdna('Zatím není co porovnávat', 'Porovnávání potřebuje aspoň dvě modelky se srdíčky. Ohodnoť pár modelek.', { ikona: 'srdce' })
            : htmlPrazdna('Dvojice došly', 'Teď nemám další dvojice, které by pořadí něco řekly. Zkus to po pár nových hodnoceních.', { ikona: 'srdce' }));
        return;
    }
    const [a, b] = [modelka(d.a), modelka(d.b)];
    misto.dataset.pasy = '';
    // Skóre fotek a úroveň z pořadí (Oblíbenost je počítá v backendu), u modelky bez hodnocených fotek nic
    vykreslitPasy(misto, {
        a: { modelka: a, fotky: nahledy.get(d.a) || null, celkem: a.pocetFotek || 0, skore: polozkaPoradi(d.a) },
        b: { modelka: b, fotky: nahledy.get(d.b) || null, celkem: b.pocetFotek || 0, skore: polozkaPoradi(d.b) },
    });
    cast('vratit')?.toggleAttribute('disabled', !historie.length);
    if (!nahledy.has(d.a) || !nahledy.has(d.b)) nacistNahledy([d.a, d.b]).then(() => { if (fronta[0] === d) vykreslitDvojici(); });
}

// Položka pořadí modelky (skóre fotek, úroveň, čekání), nebo null
const polozkaPoradi = id => (data.oblibenost?.poradi || []).find(p => p.modelkaId === id) || null;

// Běžný prohlížeč fotek (jako u alb) na fotce z pásu mezi všemi fotkami modelky (pořadí alb jako v profilu); po
// zavření zůstane porovnání a fotky té modelky se načtou znovu (srdíčka fotek se mohla změnit)
let otevrenoZPorovnani = 0;
async function otevritFotku(strana, fotka) {
    const d = fronta[0];
    if (!d) return;
    const id = strana === 'a' ? d.a : d.b;
    let fotky = [];
    try {
        fotky = await GetFotografieModelky(id) || [];
    } catch { /* oznámí se níž */ }
    if (fronta[0] !== d || !videt()) return;
    // Fotky profilu jména nenesou; u sdíleného alba je hlavní modelkou jiná
    fotky.forEach(f => { f.jmenoModelky = modelka(f.modelkaId)?.jmeno || modelka(id)?.jmeno || ''; });
    const polozky = seraditAlbaProfilu(sestavitAlba(fotky)).flatMap(a => a.polozky);
    const kde = polozky.findIndex(p => p.fotky.some(f => f.id === fotka.id));
    if (kde < 0) return oznamit('Fotku se nepodařilo otevřít.');
    otevrenoZPorovnani = id;
    otevritLightbox(kde, false, polozky);
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
    // Čekající na potvrzení úrovně: kolik a kam, odkaz do Porovnávání (dvojice o potvrzení jsou tam napřed);
    // pravidla úrovní nenápadně pod seznamem
    const cekaji = textCekajicich(poctyCekajicich(poradi), o?.cekajicich);
    nastavitHtml(cast('cekaji'), cekaji ? `⏳ ${esc(cekaji)} · <button type="button" class="link" data-ob-porovnavat title="Dvojice o potvrzení a souboje na hranicích úrovní nabízí Porovnávání">Porovnávat →</button>` : '');
    nastavitText(cast('pravidla'), poradi.length ? textPravidelUrovni(o?.urovne) : '');
    // Pořadí dávají srdíčka a fotky už bez porovnání; prázdné je jen bez hodnocených modelek i fotek
    if (!poradi.length) {
        nastavitHtml(cast('poradi'), htmlPrazdna('Pořadí vznikne z porovnávání', 'Po pár volbách nahoře tu uvidíš, které modelky máš nejradši – jemněji, než ukážou srdíčka.', { ikona: 'hvezda' }));
        return;
    }
    const ukazat = poradiVse ? poradi : poradi.slice(0, PORADI_NAJEDNOU);
    const pruhy = pruhySily(poradi);
    // Řádek modelky; i = index v celém pořadí (pruhy síly)
    const radek = (p, i) => {
        const m = modelka(p.modelkaId);
        const { sirka, nejistota } = pruhy[i];
        const fotky = textSkoreFotek(p.skoreFotek);
        const popis = `${m.jmeno}: ${p.duvod || sklonovat(p.porovnani || 0, 'porovnání', 'porovnání', 'porovnání')} · síla ${cislo(p.sila)} ± ${cislo(p.nejistota)}`;
        const drzitelka = p.ceka?.drzitelka ? modelka(p.ceka.drzitelka)?.jmeno || '' : '';
        const ceka = textCekani(p.ceka, drzitelka);
        const obhajoba = stitekObhajoby(p.obhajoba, p.obhajoba ? modelka(p.obhajoba.vyzyvatelka)?.jmeno || '' : '');
        // Čekající: kam patří podle síly a co jí chybí (bublina); „podle síly 4.“ jen když se místo liší
        const podleSily = ceka && p.mistoPodleSily > 0 && p.mistoPodleSily !== p.poradi ? ` · podle\u00a0síly\u00a0${p.mistoPodleSily}.` : '';
        // Vlastní řádek pod srdíčky, aby se štítek v úzkém sloupci neusekl
        const stitekCekani = ceka ? `<small class="ob-ceka" title="${esc(bublinaCekani(p.ceka, p.mistoPodleSily, drzitelka))}">${p.ceka.drzitelka ? '⚔' : '⏳'} ${esc(ceka)}${podleSily}</small>`
            : obhajoba ? `<small class="ob-ceka ob-obhajuje" title="${esc(obhajoba.title)}">🛡 ${esc(obhajoba.text)}</small>` : '';
        return `<li class="${[p.jenOdhad ? 'ob-z-fotek' : '', ceka ? 'ob-ceka-radek' : ''].filter(Boolean).join(' ')}"><button type="button" class="ob-radek" data-otevrit-modelku="${m.id}" title="${esc(popis)}">
            <span class="ob-misto">${p.poradi || i + 1}.</span>
            <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
            <span class="ob-jmeno-radku">${esc(m.jmeno)}<small>${m.hodnoceni ? `<i>${znakySrdicek(m.hodnoceni)}</i>` : p.jenOdhad ? (p.zdrojOdhadu === 'vkus'
                ? '<span class="ob-odhad-fotek" title="Zatím bez srdíček a porovnání – místo v pořadí je jen odhad podle tvého vkusu (údaje modelky a srdíčka fotek)">odhad</span>'
                : '<span class="ob-odhad-fotek" title="Zatím bez srdíček a porovnání – místo v pořadí je jen odhad podle srdíček jejích fotek">odhad z fotek</span>') : 'bez srdíček'}${fotky ? ` · <span class="ob-fotky" title="${esc(`Skóre fotek z ${sklonovat(p.albFotek, 'alba', 'alb', 'alb')} a ${sklonovat(p.fotekHodnocenych, 'hodnocené fotky', 'hodnocených fotek', 'hodnocených fotek')}`)}">${fotky}</span>` : ''}${p.zmenaPoradi && o.trendDni ? ` · <span class="trend ${p.zmenaPoradi > 0 ? 'nahoru' : 'dolu'}" title="${esc(`${p.zmenaPoradi > 0 ? 'Stoupla' : 'Klesla'} o ${sklonovat(Math.abs(p.zmenaPoradi), 'místo', 'místa', 'míst')} za ${o.trendDni} dní`)}">${p.zmenaPoradi > 0 ? '▲' : '▼'}${Math.abs(p.zmenaPoradi)}</span>` : ''}${p.zajem >= 0.05 ? ' · <span class="ob-zajem" title="Často otevíráš její profil nebo prohlížíš fotky – posouvá ji to v pořadí uvnitř srdíček">zájem</span>' : ''}</small>${stitekCekani}</span>
            <span class="ob-pruh" aria-hidden="true"><i style="width:${sirka}%"></i>${nejistota ? `<b style="left:${Math.max(0, sirka - nejistota)}%; width:${Math.min(100, sirka + nejistota) - Math.max(0, sirka - nejistota)}%"></b>` : ''}</span>
            <small class="ob-pocet">${p.porovnani || 0}×</small>
        </button></li>`;
    };
    // Oddělovače úseků (Top 10 · Top 20 · Top 50 · Top 100 · Mimo) s počtem potvrzených v úseku celého pořadí
    const potvrzenych = new Map(seskupitPodleUrovni(poradi).map(sk => [sk.uroven, sk]));
    const oddelovac = uroven => {
        const sk = potvrzenych.get(uroven);
        const pocet = uroven ? sk?.potvrzenych || 0 : sk?.polozky.length || 0;
        return `<li class="ob-uroven"><span>${uroven ? nazevUrovne(uroven) : 'Mimo Top 100'}</span><small>${!pocet ? 'zatím žádná potvrzená'
            : uroven ? `${sklonovat(pocet, 'potvrzená', 'potvrzené', 'potvrzených')}${pocet < sk.polozky.length ? ` z ${sk.polozky.length}` : ''}` : sklonovat(pocet, 'modelka', 'modelky', 'modelek')}</small></li>`;
    };
    let i = 0;
    nastavitHtml(cast('poradi'), `<ol class="ob-poradi">${seskupitPodleUrovni(ukazat).map(sk =>
        oddelovac(sk.uroven) + sk.polozky.map(p => radek(p, i++)).join('')).join('')}</ol>
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
    porovnaneOdObnoveni.add(d.a).add(d.b);
    porovnaniDnes++;
    ulozDnes(porovnaniDnes);
    vykreslitDnes();
    ukazatNavrhPoPorovnani(d);
    await dalsi();
    // Souboj na hranici úrovně se přepočte hned (úrovně a štítky v pásech ukážou výsledek), jinak po pěti porovnáních
    if (++porovnanoOdObnoveni >= 5 || d.druh === 'souboj') obnovitPrehled();
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
    zobrazitNavrhPodPasy(null);
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
    zobrazitNavrhPodPasy(null);
    vykreslitDvojici();
    obnovitPrehled();
}

// ——— Události ———

export function pripravit() {
    try { stav.oblibenostCast = localStorage.getItem('oblibenostCast') || 'porovnani'; } catch { /* porovnávání */ }
    // Dřívější samostatná část tipů je teď v Pořadí
    if (stav.oblibenostCast === 'tipy') stav.oblibenostCast = 'poradi';
    if (!CASTI_OBLIBENOSTI.some(([klic]) => klic === stav.oblibenostCast)) stav.oblibenostCast = 'porovnani';

    pripravitSinSlavy();
    // Volba části v liště pod hledáním (skrytý štítek v obsahu Přehledu)
    document.addEventListener('click', (e) => {
        const castVolba = /** @type {HTMLElement} */ (e.target).closest?.('[data-zobrazeni-oblibenosti]');
        if (castVolba && castVolba.dataset.zobrazeniOblibenosti !== stav.oblibenostCast) ukazatCastOblibenosti(castVolba.dataset.zobrazeniOblibenosti);
    });

    stats.addEventListener('click', (e) => {
        if (!koren?.contains(e.target)) return;
        const volba = e.target.closest('[data-ob-volba]')?.dataset.obVolba;
        if (volba) vybrat(volba);
        else if (e.target.closest('[data-ob-preskocit]')) preskocit();
        else if (e.target.closest('[data-ob-vratit]')) vratit();
        else if (e.target.closest('[data-ob-navrh-ano]')) prijmoutNavrh(e.target.closest('[data-ob-navrh-ano]').dataset.obNavrhAno);
        else if (e.target.closest('[data-ob-navrh-ne]')) odmitnoutNavrh(e.target.closest('[data-ob-navrh-ne]').dataset.obNavrhNe);
        else if (e.target.closest('[data-ob-poradi-vse]')) { poradiVse = true; vykreslitPoradi(); }
        else if (e.target.closest('[data-ob-nesedi-odkaz]')) ukazatCastOblibenosti('poradi');
        else if (e.target.closest('[data-ob-porovnavat]')) ukazatCastOblibenosti('porovnani');
        else if (e.target.closest('[data-ob-nesedi-vse]')) { nesouladyVse = true; vykreslitNesedi(); }
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

    // Po zavření prohlížeče otevřeného z pásu se fotky té modelky načtou znovu (srdíčka fotek se mohla změnit)
    new MutationObserver(() => {
        if (!otevrenoZPorovnani || !lightbox.classList.contains('hidden')) return;
        const id = otevrenoZPorovnani;
        otevrenoZPorovnani = 0;
        nahledy.delete(id);
        nacistNahledy([id]).then(() => { if (fronta[0] && (fronta[0].a === id || fronta[0].b === id)) vykreslitDvojici(); });
    }).observe(lightbox, { attributes: true, attributeFilter: ['class'] });

    // Srdíčka změněná kdekoli: tip se ztlumí jako ohodnocený, pořadí ukáže nová srdíčka při příštím obnovení
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        koren?.querySelector(`[data-tip-modelky="${id}"]`)?.classList.toggle('ohodnoceno', hodnoceni > 0);
    });
}
