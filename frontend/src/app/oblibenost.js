// Oblíbenost v Přehledu ve dvou stránkách, každá má vlastní tlačítko vpravo v liště: Hodnocení
// a Síň slávy (sin-slavy.js). Hodnocení má nahoře jednu hlavičku jako Síň slávy: pilulky pohledů Porovnat · Fotky ·
// Pořadí s počty (čekající na potvrzení, nehodnocené fotky, nesoulady srdíček) a vpravo dnešní počet porovnání
// s odkazy na to, co čeká v jiném pohledu („⏳ 3 čekají na Top 10 · Porovnat →“). Pohledy:
//   - Porovnat „Která se ti líbí víc?“: dvě nezávislé galerie nad sebou, nahoře jedna modelka, dole druhá, vlevo
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
//   - Fotky: nehodnocené fotky napříč modelkami v prohlížeči (galerie-hodnoceni.js).
// Zvolená část a pohled se pamatují (oblibenostCast, hodnoceniPohled); dřívější části převádí prevestCastOblibenosti.
// Srdíčka ve stránce obsluhuje galerie.js (data-hodnoceni, modelky z stav.prehledModelky), profil otevírá
// prehled.js (data-otevrit-modelku).
import { prohlizetBezZajmu } from './zajem';
import { GetDvojiceKPorovnani, GetFotografieModelky, GetMohloByTeLibit, GetNahledyModelek, GetNavrhSrdicek, GetOblibenost, GetSoubojeModelky, PorovnatModelky, SetHodnoceni, VratitPorovnani } from './backend';
import { esc, sklonovat } from '../lib/format';
import { dnesniPocet, idDvojice, klicNavrhu, kratceSrdicka, pruhySily, skryteNavrhy, skrytNavrh, textModeluVkusu, textSrdicek, vetaNesouladu, zKolika, znakySrdicek } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, POHLEDY_HODNOCENI, bublinaCekani, nadpisSouboje, nazevUrovne, odkazyHodnoceni, okoliDvojice, poctyCekajicich, posunMista, postupDne, prevestCastOblibenosti, seskupitPodleUrovni, stitekObhajoby, stoupajiKlesaji, textCekajicich, textCekani, textPravidelUrovni, textSkoreFotek, textVahyZajmu, urovenModelky, vysledekOvereni, vysledekRozhodnuti } from '../lib/oblibenost';
import { stav } from './stav';
import { stats } from './prvky';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { adresaFotkyPasu, fotekNaObrazovce, klavesaPasu, pripravitPasy, sledovatPomerFotek, vykreslitPasy } from './porovnani-pasy';
import { lightbox, otevritLightbox } from './prohlizec';
import { seraditAlbaProfilu } from './profil';
import { sestavitAlba } from '../lib/alba';
import { duvodyOdhadu, htmlSrdicka } from './galerie';
import { obnovitSrdickaModelky } from '../ui/srdicka';
import { jeVidet, nastavitHtml, nastavitText, otevreneOkno } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';
import { nacistSinSlavy, pripravitSinSlavy } from './sin-slavy';
import { nacistGalerii, pocetNehodnocenych, pripravitGalerii } from './galerie-hodnoceni';
import { htmlPilulek } from '../ui/pas';

const DVOJIC_NAJEDNOU = 8;
const PORADI_NAJEDNOU = 25;
const ROZHODNUTI_NAJEDNOU = 6; // řádků v Čeká na rozhodnutí před „Zobrazit všech“
const TOP_KOMPAKTNE = 10; // Pořadí ukáže napřed jen Top 10, celé po rozbalení
const TRENDU = 3; // stoupají a klesají: kolik z každého
let poradiRozbaleno = false;
let mistaPred = new Map(); // místa v pořadí před posledním přepočtem (posun v pruhu Dvojice v pořadí)
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
// „Rozhodnout teď“: série soubojů jedné modelky na začátku fronty (dvojice = objekty ve frontě), úroveň, o kterou jde,
// jestli ji modelka obhajovala, a po dokončení výsledek { ok, text }
/** @type {{ id: number, uroven: number, obhajovala: boolean, nesoulad: { hodnoceni: number, navrh: number } | null, dvojice: Set<object>, celkem: number, vysledek: { ok: boolean, text: string, navrh?: number } | null, konci: boolean } | null} */
let serie = null;

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

// Část Oblíbenosti nebo pohled Hodnocení, který otevře příští zobrazení (např. pořadí z profilu modelky): 'hodnoceni',
// 'slava', pohled ('porovnat', 'fotky', 'poradi') i dřívější části ('porovnani', 'galerie' – prevestCastOblibenosti)
export function nastavitCastOblibenosti(klic) {
    const { cast: c, pohled } = prevestCastOblibenosti(klic, stav.hodnoceniPohled);
    stav.oblibenostCast = c;
    stav.hodnoceniPohled = pohled;
    try {
        localStorage.setItem('oblibenostCast', c);
        localStorage.setItem('hodnoceniPohled', pohled);
    } catch { /* jen pro toto spuštění */ }
}

// Stránka Hodnocení nebo Síň slávy z lišty, když je Oblíbenost už načtená (bez nového načtení); false = není načtená
export function ukazatStrankuOblibenosti(klic) {
    if (!koren?.isConnected) return false;
    ukazatCastOblibenosti(klic);
    return true;
}

// Ukáže zvolenou část a pohled (bez nového načtení); Síň slávy a Fotky se při ukázání načtou
function ukazatCastOblibenosti(klic) {
    nastavitCastOblibenosti(klic);
    if (!koren) return;
    koren.dataset.obCast = stav.oblibenostCast;
    nastavitZobrazeni();
    if (stav.oblibenostCast === 'slava' && cast('slava')) nacistSinSlavy(cast('slava'));
    if (stav.oblibenostCast === 'hodnoceni' && stav.hodnoceniPohled === 'fotky' && cast('galerie')) nacistGalerii(cast('galerie'));
    vykreslitHlavu();
    // V liště se rozsvítí tlačítko stránky (prehled.js)
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    document.querySelector('main').scrollTop = 0;
}

const nastavitZobrazeni = () => { const hd = cast('cast-hodnoceni'); if (hd) hd.dataset.hdZobrazeno = stav.hodnoceniPohled; };

// Hodnocení: hlavička (pilulky pohledů, souhrn s odkazy) a tři pohledy, vidět je jen zvolený (data-hd-zobrazeno)
const KOSTRA = `
    <div class="ob-cast hd" data-ob-cast-hodnoceni>
    <div class="plovouci-pas">
        <nav class="slava-pohledy" role="tablist" aria-label="Pohledy hodnocení" data-ob-pohledy></nav>
        <div class="hd-souhrn pas-info">
            <span class="hd-dnes" data-ob-dnes></span>
            <span class="hd-odkazy" data-ob-odkazy></span>
        </div>
    </div>
    <div class="hd-pohled ob-porovnani" data-hd="porovnat" data-ob-porovnani>
        <div class="ob-hlavicka">
            <p class="ob-duvod" data-ob-duvod><span class="ob-souboj hidden" data-ob-souboj></span><span data-ob-duvod-text></span></p>
            <p class="ob-v-poradi" data-ob-v-poradi aria-label="Dvojice v pořadí"></p>
        </div>
        <div class="ob-serie hidden" data-ob-serie aria-live="polite"></div>
        <div class="ob-dvojice-obal">
            <div class="ob-dvojice" data-ob-dvojice aria-live="polite"></div>
        </div>
        <div class="ob-ovladani" data-ob-ovladani>
            <button type="button" class="btn btn-secondary btn-small" data-ob-vratit title="Vrátit poslední porovnání (Backspace)"><kbd>⌫</kbd> Vrátit</button>
            <button type="button" class="btn btn-secondary btn-small" data-ob-volba="remiza" title="Obě stejně (↓ nebo mezerník)"><kbd>↓</kbd> Obě stejně</button>
            <button type="button" class="btn btn-secondary btn-small" data-ob-preskocit title="Přeskočit dvojici (S)"><kbd>S</kbd> Přeskočit</button>
            <span class="ob-klavesy" tabindex="0" aria-label="Klávesy">⌨ Klávesy
                <span class="ob-klavesy-pomoc" role="tooltip">
                    <span><kbd>Enter</kbd> nebo <b>♥ Tahle</b> – líbí se mi víc modelka v aktivním pásu</span>
                    <span><kbd>Tab</kbd> přepne aktivní pás · pás pod myší je aktivní</span>
                    <span>kolečko nebo <kbd>←</kbd> <kbd>→</kbd> listuje pásem</span>
                    <span><kbd>1</kbd>–<kbd>5</kbd> srdíčka zvýrazněné fotce · klik otevře prohlížeč</span>
                    <span><kbd>↓</kbd> nebo mezerník obě stejně · <kbd>S</kbd> přeskočit · <kbd>⌫</kbd> vrátit</span>
                </span>
            </span>
        </div>
        <div class="ob-navrh" data-ob-navrh aria-live="polite"></div>
    </div>
    <div class="hd-pohled gh" data-hd="fotky" data-ob-galerie></div>
    <div class="hd-pohled" data-hd="poradi" data-ob-cast-poradi>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-poradi" data-ob-volby-poradi></div>
        <div class="ob-karta hz-rozhodnout" data-ob-rozhodnuti></div>
        <div class="hz-sloupce">
            <div class="ob-karta hz-poradi" data-ob-sekce-poradi>
                <h4>Pořadí</h4>
                <p class="ob-vaha" data-ob-vaha></p>
                <div data-ob-top></div>
                <div class="hz-cele" data-ob-poradi></div>
                <p class="ob-pravidla" data-ob-pravidla></p>
            </div>
            <div class="hz-bok">
                <div class="ob-karta hz-trendy" data-ob-trendy></div>
                <div class="ob-karta">
                    <h4>Mohlo by se ti líbit <small>odhad podle tvého vkusu</small></h4>
                    <p class="ob-info" data-ob-info></p>
                    <div data-ob-tipy></div>
                </div>
            </div>
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
    nastavitZobrazeni();
    vykreslitHlavu();
    if (stav.oblibenostCast === 'slava') nacistSinSlavy(cast('slava'));
    // Fotky se načtou i ve skrytém pohledu: pilulka Fotky ukáže počet nehodnocených
    else nacistGalerii(cast('galerie'));
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
    // Místa před přepočtem: pruh Dvojice v pořadí ukáže posun ▲▼
    mistaPred = new Map((data.oblibenost?.poradi || []).map(p => [p.modelkaId, p.poradi]));
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
    vykreslitVPoradi(fronta[0]);
    vykreslitTipy();
    vykreslitRozhodnuti();
    vykreslitHlavu();
    // Pásy zobrazené dvojice ukážou skóre fotek (mění se jen to, co se změnilo)
    if (fronta[0]) vykreslitDvojici();
}

// Porovnaná modelka, která se po přepočtu potvrdila ve vyšší úrovni, dostane krátké oznámení (souboje a dvojice
// o potvrzení mají viditelný výsledek); držitelka, která obhajovala, buď místo obhájila, nebo vypadla. Jen při
// obnovení po porovnání, ne při prvním načtení.
function oznamitPostup(porovnane, predtim) {
    // Konec série „Rozhodnout teď“ řekne výsledek sám nad pásy
    if (!porovnane.length || !predtim.size || serie?.konci) return;
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

// Zobrazené návrhy podle klíče (pro „Dát jí“): { id, navrh }
const navrhy = new Map();
let navrhPodPasy = ''; // klíč návrhu zobrazeného pod pásy
let cisloNavrhu = 0;

const NESOULADU_NAJEDNOU = 8;
let nesouladyVse = false;

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
        <button type="button" class="link" data-ob-navrh-ne="${klic}">Nechat</button>${nesoulad ? `
        <button type="button" class="link" data-ob-rozhodnout="${id}" title="Čtyři porovnání s modelkami z úrovně, kam podle nesouladu patří – pak bude jasné, jestli srdíčka změnit">⚔ Ověřit porovnáním</button>` : ''}` };
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

// Modelky, o jejichž úrovni rozhodnou souboje: čekají na potvrzení, nebo obhajují místo (pořadí z backendu)
const rozhodujici = () => (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId) && (p.ceka || p.obhajoba));

// Čeká na rozhodnutí (nahoře v Pořadí): souboje o úrovně (⚔ Rozhodnout teď) a srdíčka, která nesedí (Dát jí,
// Nechat, Ověřit porovnáním) – co je potřeba udělat, na jednom místě
function vykreslitRozhodnuti() {
    const nesoulady = viditelneNesoulady();
    const cekajici = rozhodujici();
    const vse = cekajici.length + nesoulady.length;
    const karta = cast('rozhodnuti');
    karta?.classList.toggle('hidden', !vse);
    if (!vse) return nastavitHtml(karta, '');
    // Napřed souboje (rozhodnou úroveň), pak nesoulady; zkráceně prvních pár
    let zbyva = nesouladyVse ? Infinity : ROZHODNUTI_NAJEDNOU;
    const ukazatCekajici = cekajici.slice(0, zbyva);
    zbyva -= ukazatCekajici.length;
    const ukazatNesoulady = nesoulady.slice(0, Math.max(0, zbyva));
    const radekCekajici = p => {
        const m = modelka(p.modelkaId);
        const drzitelka = p.ceka?.drzitelka ? modelka(p.ceka.drzitelka)?.jmeno || '' : '';
        const obhajoba = !p.ceka && stitekObhajoby(p.obhajoba, p.obhajoba ? modelka(p.obhajoba.vyzyvatelka)?.jmeno || '' : '');
        const text = p.ceka ? textCekani(p.ceka, drzitelka) : obhajoba?.text || '';
        const title = p.ceka ? bublinaCekani(p.ceka, p.mistoPodleSily, drzitelka) : obhajoba?.title || '';
        return `<li>
            <span class="hz-r-ikona" aria-hidden="true">${p.ceka?.drzitelka ? '⚔' : p.ceka ? '⏳' : '🛡'}</span>
            <div class="hz-r-obsah">
                <span><button type="button" class="link" data-otevrit-modelku="${m.id}">${esc(m.jmeno)}</button>
                    <small class="hz-r-misto">${p.poradi || ''}.</small> <span class="hz-r-text" title="${esc(title)}">${esc(text)}</span></span>
                <button type="button" class="btn btn-secondary btn-small hz-r-rozhodnout" data-ob-rozhodnout="${m.id}" title="${esc(`Spustí hned souboje, které ${m.jmeno} chybí${p.ceka ? ' do potvrzení' : ' k obhajobě'}, za sebou s ukazatelem postupu`)}">⚔ Rozhodnout teď</button>
            </div>
        </li>`;
    };
    const radekNesouladu = n => `<li>
            <span class="hz-r-ikona trend ${n.smer === 'mene' ? 'dolu' : 'nahoru'}" aria-hidden="true">${n.smer === 'mene' ? '▼' : '▲'}</span>
            <div class="hz-r-obsah">${htmlNavrhu(n.modelkaId, n.navrh, n).html}</div>
        </li>`;
    nastavitHtml(karta, `<h4>Čeká na rozhodnutí <small>${esc([cekajici.length ? sklonovat(cekajici.length, 'souboj o úroveň', 'souboje o úroveň', 'soubojů o úroveň') : '',
        nesoulady.length ? `${nesoulady.length} nesedí se srdíčky` : ''].filter(Boolean).join(' · '))}</small></h4>
        ${ukazatCekajici.length ? `<h5 class="hz-r-skupina">Souboje o úroveň</h5><ul class="hz-r-seznam">${ukazatCekajici.map(radekCekajici).join('')}</ul>` : ''}
        ${ukazatNesoulady.length ? `<h5 class="hz-r-skupina">Nesedí se srdíčky <small>podle porovnání s modelkami s jinými srdíčky</small></h5><ul class="hz-r-seznam">${ukazatNesoulady.map(radekNesouladu).join('')}</ul>` : ''}
        ${ukazatCekajici.length + ukazatNesoulady.length < vse ? `<button type="button" class="link ob-vse" data-ob-nesedi-vse>Zobrazit všech ${vse}</button>` : ''}`);
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
    vykreslitRozhodnuti();
    oznamit(`${m?.jmeno || 'Modelka'} má teď ${textSrdicek(n.navrh)}.`);
    obnovitPrehled();
}

function odmitnoutNavrh(klic) {
    skrytNavrh(klic);
    if (navrhPodPasy === klic) zobrazitNavrhPodPasy(null);
    vykreslitRozhodnuti();
    vykreslitHlavu();
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

// Hotovo dnes: počet porovnání a pruh k příští desítce
function vykreslitDnes() {
    const p = postupDne(porovnaniDnes);
    nastavitHtml(cast('dnes'), `<span class="pas-kapsle hd-postup" title="${esc(p.hotovo ? `Dnes ${sklonovat(p.hotovo, 'porovnání', 'porovnání', 'porovnání')} – do ${p.cil} zbývá ${p.zbyva}` : 'Dnes zatím žádné porovnání')}">Dnes <b>${p.hotovo}</b> z ${p.cil}
        <span class="ob-postup-pruh" aria-hidden="true"><i style="width:${p.procent}%"></i></span></span>`);
}

// Dvojice v pořadí: místa obou modelek a jejich sousedek (zvýrazněné), úroveň, posun po posledním přepočtu
function vykreslitVPoradi(d) {
    const misto = cast('v-poradi');
    if (!misto) return;
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const okoli = d ? okoliDvojice(poradi, d.a, d.b) : [];
    if (!okoli.length) return nastavitHtml(misto, '');
    const krestni = jmeno => String(jmeno || '').split(' ')[0];
    nastavitHtml(misto, okoli.map(x => {
        if (x.typ === 'mezera') return '<span class="ob-vp-mezera" aria-hidden="true">…</span>';
        if (x.typ === 'uroven') return `<span class="ob-vp-uroven">${esc(x.uroven ? nazevUrovne(x.uroven) : 'Mimo Top 100')}</span>`;
        const m = modelka(x.p.modelkaId);
        const posun = x.strana ? posunMista(mistaPred.get(x.p.modelkaId), x.misto) : null;
        const ceka = x.p.ceka ? ` · čeká na ${nazevUrovne(x.p.ceka.uroven)}` : '';
        return `<span class="ob-vp-misto ${x.strana ? `dvojice ${x.strana}` : ''}" title="${esc(`${x.misto}. ${m.jmeno}${ceka}`)}"><small>${x.misto}.</small>${esc(krestni(m.jmeno))}${x.p.ceka && x.strana ? ' ⏳' : ''}${posun ? `<i class="trend ${posun.smer}">${posun.text}</i>` : ''}</span>`;
    }).join(''));
}

// Hlavička Hodnocení: pilulky pohledů s počty a odkazy na to, co čeká jinde (lib/oblibenost.js, odkazyHodnoceni)
function vykreslitHlavu() {
    const misto = cast('pohledy');
    if (!misto) return;
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const cekaji = poctyCekajicich(poradi);
    const nCekaji = Number(data.oblibenost?.cekajicich) || cekaji.reduce((s, [, n]) => s + n, 0);
    const nesouladu = viditelneNesoulady().length;
    const fotek = Math.max(0, pocetNehodnocenych());
    const pocty = {
        porovnat: [nCekaji, nCekaji ? `${textCekajicich(cekaji, nCekaji)} – dvojice, které to rozhodnou, jsou v porovnávání napřed` : 'Která se ti líbí víc? Dvě modelky nad sebou'],
        fotky: [fotek, fotek ? `${sklonovat(fotek, 'nehodnocená fotka', 'nehodnocené fotky', 'nehodnocených fotek')} – dávej jim srdíčka v prohlížeči` : 'Nehodnocené fotky v prohlížeči'],
        poradi: [nesouladu, nesouladu ? `${sklonovat(nesouladu, 'modelce', 'modelkám', 'modelkám')} podle porovnání nesedí srdíčka` : 'Pořadí podle síly s úrovněmi Top 10 / 20 / 50 / 100'],
    };
    const zvoleny = stav.hodnoceniPohled;
    nastavitHtml(misto, htmlPilulek(POHLEDY_HODNOCENI.map(([klic, nazev]) => ({ klic, nazev, pocet: pocty[klic][0], titulek: pocty[klic][1], zvolena: klic === zvoleny })), 'hd-pohled'));
    // V pásu vpravo jen nejdůležitější odkaz (pás má mít nejvýš dvě informace: dnešek a co čeká)
    nastavitHtml(cast('odkazy'), odkazyHodnoceni({ pohled: zvoleny, cekaji, celkem: nCekaji, nesouladu, fotek }).slice(0, 1)
        .map(o => `<button type="button" class="pas-kapsle" data-hd-pohled="${o.pohled}" title="${esc(pocty[o.pohled][1])}"><span>${esc(o.text)}</span><b class="pas-akce">${esc(o.akce)} →</b></button>`).join(''));
}

function vykreslitDvojici() {
    const misto = cast('dvojice');
    if (!misto) return;
    vykreslitSerii();
    const d = fronta[0];
    cast('ovladani').classList.toggle('hidden', !d);
    nastavitText(cast('duvod-text'), d?.duvod || '');
    vykreslitVPoradi(d);
    // Souboj o místo na hranici úrovně: štítek nad švem pásů (nic neposouvá) a zvýrazněný důvod
    const souboj = d ? nadpisSouboje(d, polozkaPoradi(d.a) || modelka(d.a), polozkaPoradi(d.b) || modelka(d.b)) : '';
    nastavitText(cast('souboj'), souboj ? `⚔ ${souboj}` : '');
    cast('duvod').classList.toggle('hidden', !d);
    cast('souboj').classList.toggle('hidden', !souboj);
    cast('duvod').classList.toggle('souboj', !!souboj);
    if (!d) {
        const malo = (data.oblibenost?.hodnocenych || 0) < 2;
        delete misto.dataset.pasy;
        nastavitHtml(misto, malo
            ? htmlPrazdna('Zatím není co porovnávat', 'Porovnávání potřebuje aspoň dvě modelky se srdíčky. Ohodnoť pár modelek v galerii nebo v profilu.', { ikona: 'srdce' })
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
    prohlizetBezZajmu();
    otevritLightbox(kde, false, polozky);
}

function vykreslitPoradi() {
    const o = data.oblibenost;
    const poradi = (o?.poradi || []).filter(p => modelka(p.modelkaId));
    nastavitText(cast('vaha'), o && poradi.length ? textVahyZajmu(o) : '');
    // Napřed kompaktně Top 10, celé pořadí s úrovněmi po přepnutí v liště pod hledáním (Top 10 / Celé pořadí)
    cast('sekce-poradi')?.classList.toggle('rozbaleno', poradiRozbaleno);
    const lzeRozbalit = poradi.length > TOP_KOMPAKTNE || poradi.some(p => p.ceka || p.obhajoba);
    nastavitHtml(cast('volby-poradi'), (lzeRozbalit ? [['top', 'Top 10', !poradiRozbaleno], ['vse', 'Celé pořadí', poradiRozbaleno]]
        .map(([klic, nazev, on]) => `<button type="button" class="chip ${on ? 'active' : ''}" data-poradi-rozsah="${klic}">${nazev}</button>`).join('') : '')
        + (poradi.length ? `<span>${esc(sklonovat(poradi.length, 'modelka', 'modelky', 'modelek'))}</span>` : ''));
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    vykreslitTrendy(poradi, o);
    // Čekající na potvrzení úrovně ukazuje hlavička Hodnocení (odkaz do Porovnávání, kde jsou dvojice o potvrzení
    // napřed); pravidla úrovní nenápadně pod seznamem
    nastavitText(cast('pravidla'), poradi.length ? textPravidelUrovni(o?.urovne) : '');
    // Pořadí dávají srdíčka už bez porovnání; prázdné je jen bez hodnocených modelek
    if (!poradi.length) {
        nastavitHtml(cast('top'), htmlPrazdna('Pořadí vznikne z porovnávání', 'Po pár porovnáních tu uvidíš, které modelky máš nejradši – jemněji, než ukážou srdíčka.', { ikona: 'hvezda' }));
        nastavitHtml(cast('poradi'), '');
        return;
    }
    vykreslitTop(poradi, o);
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
        // Rozhodnout teď: odkaz hned za štítkem čekání nebo obhajoby pod jménem
        const akce = ceka || obhajoba
            ? `<button type="button" class="link ob-rozhodnout" data-ob-rozhodnout="${m.id}" title="${esc(`Spustí hned souboje, které ${m.jmeno} chybí${obhajoba ? ' k obhajobě' : ' do potvrzení'}, za sebou s ukazatelem postupu – na konci je jasné, jak to dopadlo`)}">⚔ Rozhodnout teď</button>` : '';
        return `<li class="${[p.jenOdhad ? 'ob-z-fotek' : '', ceka || obhajoba ? 'ob-ceka-radek' : ''].filter(Boolean).join(' ')}"><button type="button" class="ob-radek" data-otevrit-modelku="${m.id}" title="${esc(popis)}">
            <span class="ob-misto">${p.poradi || i + 1}.</span>
            <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
            <span class="ob-jmeno-radku">${esc(m.jmeno)}<small>${m.hodnoceni ? `<i>${znakySrdicek(m.hodnoceni)}</i>` : p.jenOdhad
                ? '<span class="ob-odhad-fotek" title="Zatím bez srdíček a porovnání – místo v pořadí je jen odhad podle tvého vkusu (údaje modelky a srdíčka fotek)">odhad</span>' : 'bez srdíček'}${fotky ? ` · <span class="ob-fotky" title="${esc(`Skóre fotek z ${sklonovat(p.albFotek, 'alba', 'alb', 'alb')} a ${sklonovat(p.fotekHodnocenych, 'hodnocené fotky', 'hodnocených fotek', 'hodnocených fotek')}`)}">${fotky}</span>` : ''}${p.zmenaPoradi && o.trendDni ? ` · <span class="trend ${p.zmenaPoradi > 0 ? 'nahoru' : 'dolu'}" title="${esc(`${p.zmenaPoradi > 0 ? 'Stoupla' : 'Klesla'} o ${sklonovat(Math.abs(p.zmenaPoradi), 'místo', 'místa', 'míst')} za ${o.trendDni} dní`)}">${p.zmenaPoradi > 0 ? '▲' : '▼'}${Math.abs(p.zmenaPoradi)}</span>` : ''}${p.zajem >= 0.05 ? ' · <span class="ob-zajem" title="Často otevíráš její profil nebo prohlížíš fotky – posouvá ji to v pořadí uvnitř srdíček">zájem</span>' : ''}</small></span>
            <span class="ob-pruh" aria-hidden="true"><i style="width:${sirka}%"></i>${nejistota ? `<b style="left:${Math.max(0, sirka - nejistota)}%; width:${Math.min(100, sirka + nejistota) - Math.max(0, sirka - nejistota)}%"></b>` : ''}</span>
            <small class="ob-pocet">${p.porovnani || 0}×</small>
        </button>${stitekCekani ? `<div class="ob-ceka-pod">${stitekCekani}${akce}</div>` : ''}</li>`;
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

// Kompaktní Top 10: dva sloupce řádků (místo, náhled, jméno se srdíčky, trend); čekající na potvrzení úrovně
// tlumeně s ⏳
function vykreslitTop(poradi, o) {
    const misto = cast('top');
    nastavitHtml(misto, `<ol class="hz-top">${poradi.slice(0, TOP_KOMPAKTNE).map((p, i) => {
        const m = modelka(p.modelkaId);
        const trend = p.zmenaPoradi && o?.trendDni ? `<span class="trend ${p.zmenaPoradi > 0 ? 'nahoru' : 'dolu'}">${p.zmenaPoradi > 0 ? '▲' : '▼'}${Math.abs(p.zmenaPoradi)}</span>` : '';
        const ceka = p.ceka ? textCekani(p.ceka) : '';
        return `<li><button type="button" class="hz-top-radek ${ceka ? 'ceka' : ''}" data-otevrit-modelku="${m.id}" title="${esc(ceka ? `${m.jmeno}: ${ceka}` : m.jmeno)}">
            <span class="hz-top-misto">${p.poradi || i + 1}</span>
            <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
            <span class="hz-top-jmeno">${esc(m.jmeno)}<small>${m.hodnoceni ? `<i>${znakySrdicek(m.hodnoceni)}</i>` : 'bez srdíček'}${ceka ? ' · ⏳ čeká' : ''}</small></span>
            ${trend}
        </button></li>`;
    }).join('')}</ol>`);
    nacitatPostupne(misto);
}

// Stoupají / klesají proti snímku pořadí před trendDni dny (historii si program vede sám, jednou denně), s fotkami
function vykreslitTrendy(poradi, o) {
    const { stoupaji, klesaji } = stoupajiKlesaji(poradi, TRENDU);
    const kdy = o?.trendDni === 1 ? 'od včerejška' : `za ${o?.trendDni} dní`;
    const seznam = (polozky, smer, znak) => `<ul class="hz-trend">${polozky.map(p => {
        const m = modelka(p.modelkaId);
        return `<li><button type="button" data-otevrit-modelku="${m.id}">
            <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
            <span>${esc(m.jmeno)}<small>${p.poradi}. místo</small></span>
            <span class="trend ${smer}">${znak} ${Math.abs(p.zmenaPoradi)}</span>
        </button></li>`;
    }).join('')}</ul>`;
    const ma = o?.trendDni && (stoupaji.length || klesaji.length);
    nastavitHtml(cast('trendy'), `<h4>Stoupají a klesají${o?.trendDni ? ` <small>${kdy}</small>` : ''}</h4>
        ${ma ? `${stoupaji.length ? seznam(stoupaji, 'nahoru', '▲') : ''}${klesaji.length ? seznam(klesaji, 'dolu', '▼') : ''}`
            : `<p class="hz-tichy">${o?.trendDni ? `Nikdo se výrazně nepohnul ${kdy}.` : 'Trend se ukáže za pár dní: program si každý den pamatuje pořadí.'}</p>`}`);
    nacitatPostupne(cast('trendy'));
}

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
    // Souboj na hranici úrovně se přepočte hned (úrovně a štítky v pásech ukážou výsledek), jinak po pěti porovnáních;
    // poslední souboj série „Rozhodnout teď“ přepočte a vyhodnotí dokončení série
    if (serie && !serie.vysledek && !zbyvaSerie()) dokoncitSerii();
    else if (++porovnanoOdObnoveni >= 5 || d.druh === 'souboj' || d.druh === 'overeni') obnovitPrehled();
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

async function preskocit() {
    if (!fronta[0] || zaneprazdneno) return;
    zaneprazdneno = true;
    zobrazitNavrhPodPasy(null);
    await dalsi();
    if (serie && !serie.vysledek && !zbyvaSerie()) dokoncitSerii();
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
    const vracena = historie.pop();
    fronta.unshift(vracena);
    // Vrácený souboj série ji znovu otevře
    if (serie?.dvojice.has(vracena)) serie.vysledek = null;
    porovnaniDnes = Math.max(0, porovnaniDnes - 1);
    ulozDnes(porovnaniDnes);
    vykreslitDnes();
    zobrazitNavrhPodPasy(null);
    vykreslitDvojici();
    obnovitPrehled();
}

// ——— Rozhodnout teď ———
// Tlačítko u čekající nebo obhajující modelky v Pořadí: souboje, které jí chybí (GetSoubojeModelky), jdou hned za
// sebou na začátek fronty s ukazatelem postupu; po posledním se pořadí přepočte a nad pásy je, jak to dopadlo

const zbyvaSerie = () => serie ? fronta.filter(d => serie.dvojice.has(d)).length : 0;

async function rozhodnoutTed(id) {
    let dvojice = [];
    try {
        dvojice = (await GetSoubojeModelky(id) || []).map(idDvojice).filter(d => modelka(d.a) && modelka(d.b));
    } catch { /* oznámí se níž */ }
    const jmeno = modelka(id)?.jmeno || 'Modelka';
    if (!dvojice.length) return oznamit(`${jmeno} teď nemá nové souboje – vhodné dvojice proběhly nedávno, nebo ji nejdřív musí zařadit pár běžných porovnání.`);
    const p = polozkaPoradi(id);
    // Ověření srdíček (nesoulad): dvojice s druhem „overeni“
    const ns = dvojice[0].druh === 'overeni' ? (data.oblibenost?.nesedi || []).find(n => n.modelkaId === id) : null;
    serie = { id, uroven: Number(p?.obhajoba?.uroven || p?.ceka?.uroven) || 0, obhajovala: !!p?.obhajoba, nesoulad: ns ? { hodnoceni: ns.hodnoceni, navrh: ns.navrh } : null,
        dvojice: new Set(dvojice), celkem: dvojice.length, vysledek: null, konci: false };
    // Stejná dvojice už čekající ve frontě (v jakémkoli pořadí) se nezopakuje
    const klic = d => [d.a, d.b].sort((x, y) => x - y).join('-');
    const vSerii = new Set(dvojice.map(klic));
    fronta = [...dvojice, ...fronta.filter(d => !vSerii.has(klic(d)))];
    zobrazitNavrhPodPasy(null);
    ukazatCastOblibenosti('porovnat');
    vykreslitSerii();
    vykreslitDvojici();
    nacistNahledy(dvojice.flatMap(d => [d.a, d.b])).then(() => { if (fronta[0] && serie?.dvojice.has(fronta[0])) vykreslitDvojici(); });
}

async function dokoncitSerii() {
    const s = serie;
    if (!s) return;
    s.konci = true;
    vykreslitSerii();
    await obnovitPrehled();
    if (serie !== s) return;
    s.konci = false;
    s.vysledek = s.nesoulad
        ? vysledekOvereni({ jmeno: modelka(s.id)?.jmeno, hodnoceni: s.nesoulad.hodnoceni, ted: (data.oblibenost?.nesedi || []).find(n => n.modelkaId === s.id) })
        : vysledekRozhodnuti({ jmeno: modelka(s.id)?.jmeno, uroven: s.uroven, obhajovala: s.obhajovala, ted: polozkaPoradi(s.id) });
    vykreslitSerii();
}

// Výsledek ověření potvrdil nesoulad: navržená srdíčka jedním klikem
async function prijmoutNavrhSerie() {
    const s = serie;
    const navrh = s?.vysledek?.navrh;
    if (!navrh) return;
    if (!await SetHodnoceni(s.id, navrh)) return oznamit('Hodnocení se nepodařilo uložit.');
    const m = modelka(s.id);
    if (m) m.hodnoceni = navrh;
    oznamit(`${m?.jmeno || 'Modelka'} má teď ${textSrdicek(navrh)}.`);
    ukoncitSerii();
    obnovitPrehled();
}

function ukoncitSerii() {
    if (!serie) return;
    const s = serie;
    serie = null;
    const prvni = fronta[0];
    fronta = fronta.filter(d => !s.dvojice.has(d));
    vykreslitSerii();
    if (fronta[0] !== prvni) vykreslitDvojici();
    if (!fronta.length) doplnitFrontu();
}

// Pruh nad pásy: „⚔ Rozhodnout teď: Anna o Top 10 · souboj 2 ze 4“ s ukazatelem, po dokončení výsledek
function vykreslitSerii() {
    const misto = cast('serie');
    if (!misto) return;
    misto.classList.toggle('hidden', !serie);
    if (!serie) return nastavitHtml(misto, '');
    const jmeno = esc(modelka(serie.id)?.jmeno || 'Modelka');
    const cil = serie.uroven ? nazevUrovne(serie.uroven) : 'místo';
    if (serie.vysledek) {
        misto.dataset.vysledek = serie.vysledek.ok ? 'ano' : 'ne';
        return nastavitHtml(misto, `<span class="ob-serie-text">${serie.vysledek.ok ? '✓' : '·'} ${esc(serie.vysledek.text)}</span>
            ${serie.vysledek.navrh ? `<button type="button" class="btn btn-primary btn-small" data-ob-serie-navrh>Dát jí ${esc(kratceSrdicka(serie.vysledek.navrh))} ♥</button>` : ''}
            <button type="button" class="link" data-ob-serie-poradi>Zpět na Pořadí</button>
            <button type="button" class="link" data-ob-serie-konec>Pokračovat v porovnávání</button>`);
    }
    delete misto.dataset.vysledek;
    const hotovo = serie.celkem - zbyvaSerie();
    nastavitHtml(misto, `<span class="ob-serie-text">⚔ ${serie.nesoulad ? `Ověřit srdíčka: <b>${jmeno}</b> (${esc(kratceSrdicka(serie.nesoulad.hodnoceni))} ♥)` : `Rozhodnout teď: <b>${jmeno}</b> ${serie.obhajovala ? 'obhajuje' : 'o'} ${esc(cil)}`}
            · ${serie.konci ? 'vyhodnocuji…' : `souboj ${Math.min(hotovo + 1, serie.celkem)} ${zKolika(serie.celkem)}`}</span>
        <span class="ob-serie-postup" aria-hidden="true"><i style="width:${Math.round(100 * hotovo / serie.celkem)}%"></i></span>
        <button type="button" class="link" data-ob-serie-konec title="Vrátit se k běžnému mixu dvojic">Ukončit</button>`);
}

// ——— Události ———

export function pripravit() {
    // Uložená část a pohled; dřívější části (Porovnávání, Galerie, Pořadí, tipy, staré Hodnocení) jsou teď pohledy
    // Hodnocení a převedou se jednou natrvalo
    let ulozena = null;
    try {
        ulozena = localStorage.getItem('oblibenostCast');
        stav.hodnoceniPohled = localStorage.getItem('hodnoceniPohled') || '';
    } catch { /* výchozí */ }
    nastavitCastOblibenosti(ulozena);

    pripravitSinSlavy();
    sledovatPomerFotek();
    // Nový počet nehodnocených fotek ukáže pilulka Fotky a odkazy v hlavičce
    pripravitGalerii(vykreslitHlavu);

    stats.addEventListener('click', (e) => {
        if (!koren?.contains(e.target)) return;
        const volba = e.target.closest('[data-ob-volba]')?.dataset.obVolba;
        if (volba) vybrat(volba);
        else if (e.target.closest('[data-ob-rozhodnout]')) rozhodnoutTed(Number(e.target.closest('[data-ob-rozhodnout]').dataset.obRozhodnout));
        else if (e.target.closest('[data-ob-serie-konec]')) ukoncitSerii();
        else if (e.target.closest('[data-ob-serie-navrh]')) prijmoutNavrhSerie();
        else if (e.target.closest('[data-ob-serie-poradi]')) { ukoncitSerii(); ukazatCastOblibenosti('poradi'); }
        else if (e.target.closest('[data-hd-pohled]')) {
            const pohled = e.target.closest('[data-hd-pohled]').dataset.hdPohled;
            if (pohled !== stav.hodnoceniPohled) ukazatCastOblibenosti(pohled);
        }
        else if (e.target.closest('[data-ob-preskocit]')) preskocit();
        else if (e.target.closest('[data-ob-vratit]')) vratit();
        else if (e.target.closest('[data-ob-navrh-ano]')) prijmoutNavrh(e.target.closest('[data-ob-navrh-ano]').dataset.obNavrhAno);
        else if (e.target.closest('[data-ob-navrh-ne]')) odmitnoutNavrh(e.target.closest('[data-ob-navrh-ne]').dataset.obNavrhNe);
        else if (e.target.closest('[data-ob-poradi-vse]')) { poradiVse = true; vykreslitPoradi(); }
        else if (e.target.closest('[data-poradi-rozsah]')) { poradiRozbaleno = e.target.closest('[data-poradi-rozsah]').dataset.poradiRozsah === 'vse'; vykreslitPoradi(); }
        else if (e.target.closest('[data-ob-porovnavat]')) ukazatCastOblibenosti('porovnat');
        else if (e.target.closest('[data-ob-nesedi-vse]')) { nesouladyVse = true; vykreslitRozhodnuti(); }
    });

    // Klávesy porovnání, když je Oblíbenost vidět a nepíše se ani nehodnotí srdíčky (zaměřená srdíčka mají šipky)
    document.addEventListener('keydown', (e) => {
        if (!videt() || stav.oblibenostCast !== 'hodnoceni' || stav.hodnoceniPohled !== 'porovnat' || !fronta[0] && e.key !== 'Backspace' || e.ctrlKey || e.metaKey || e.altKey || stav.zamceno) return;
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
