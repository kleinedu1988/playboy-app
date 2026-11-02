// Hodnocení (Oblíbenost) se třemi pohledy v liště kompaktní hlavičky (Porovnat · Hodnotit · Pořadí); Síň slávy je
// vlastní sekce (sin-slavy.js). Živý stav (dnešní postup, série, Vrátit, počty, klávesy) je ve stavové liště.
//   - Porovnat „Která se ti líbí víc?“: dvě nezávislé galerie nad sebou (porovnani-pasy.js); pás pod myší je
//     aktivní – kolečko a ← → listují, Tab přepne, Enter nebo „♥ Tahle“ vybere, ↓ nebo mezerník remíza,
//     Backspace vrátí poslední, S přeskočí, 1–5 srdíčka fotce. Dvojice volí backend: stejné a sousední úrovně,
//     nehodnocené proti modelce se srdíčky jejich odhadu, souboje o úroveň a modelky, kterým nesedí srdíčka.
//     Mezi pásy štítek s důvodem a místy obou modelek v pořadí.
//   - Hodnotit: nehodnocené fotky v prohlížeči a modelky bez srdíček (galerie-hodnoceni.js).
//   - Pořadí podle síly (Bradley–Terry v backendu, předpoklad ze srdíček, skóre fotek a zájmu) s úrovněmi
//     Top 10 / 20 / 50 / 100; modelka, která podmínky vyšší úrovně ještě nesplňuje, čeká pod hranicí („⏳ čeká na
//     Top 10 (5/8 porovnání)“). Pohledy Celé pořadí · Čekají (souboje o úroveň) · Nesedí (srdíčka proti
//     porovnání). Tipy, Trendy a Jak počítám jsou v panelu vpravo (I).
// Zvolená část a pohled se pamatují (oblibenostCast, hodnoceniPohled); dřívější části převádí prevestCastOblibenosti.
// Srdíčka ve stránce obsluhuje galerie.js (data-hodnoceni, modelky z stav.prehledModelky), profil otevírá
// prehled.js (data-otevrit-modelku).
import { prohlizetBezZajmu } from './zajem';
import { GetDvojiceKPorovnani, GetFotografieModelky, GetMohloByTeLibit, GetNahledyModelek, GetNavrhSrdicek, GetOblibenost, GetSezona, GetSoubojeModelky, PorovnatModelky, SetHodnoceni, VratitPorovnani } from './backend';
import { esc, sklonovat } from '../lib/format';
import { dnesniPocet, idDvojice, klicNavrhu, kratceSrdicka, pruhySily, skryteNavrhy, skrytNavrh, textModeluVkusu, textSrdicek, vetaNesouladu, zKolika, znakySrdicek } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, bublinaCekani, nadpisSouboje, nazevUrovne, odkazyHodnoceni, okoliDvojice, poctyCekajicich, posunMista, postupDne, prevestCastOblibenosti, seskupitPodleUrovni, stitekObhajoby, stoupajiKlesaji, textCekajicich, textCekani, textPravidelUrovni, textSkoreFotek, textVahyZajmu, urovenModelky, vysledekOvereni, vysledekRozhodnuti } from '../lib/oblibenost';
import { stav } from './stav';
import { stats } from './prvky';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { stylVyrezu } from './navigace';
import { adresaFotkyPasu, aktivniPas, fotekNaObrazovce, klavesaPasu, pripravitPasy, sledovatPomerFotek, vykreslitPasy } from './porovnani-pasy';
import { lightbox, otevritLightbox } from './prohlizec';
import { seraditAlbaProfilu } from './profil';
import { sestavitAlba } from '../lib/alba';
import { duvodyOdhadu, htmlSrdicka } from './galerie';
import { obnovitSrdickaModelky } from '../ui/srdicka';
import { jeVidet, nastavitHtml, nastavitText, otevreneOkno } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';
import { nacistSinSlavy, obnovitHlavuSlavy, pripravitSinSlavy } from './sin-slavy';
import { hodnotitFotky, nacistGalerii, nacistPocetNehodnocenych, nastavitPohledHodnotit, nastavitRazeniFotek, pocetModelekBezSrdicek, pocetNepotagovanych, pohledHodnotit, pocetNehodnocenych, pripravitGalerii, razeniFotek } from './galerie-hodnoceni';
import { textZbyva } from '../lib/slava';

const DVOJIC_NAJEDNOU = 8;
const PORADI_NAJEDNOU = 25;
const TRENDU = 3; // stoupají a klesají: kolik z každého
let mistaPred = new Map(); // místa v pořadí před posledním přepočtem (posun v pruhu Dvojice v pořadí)
const TIPU = 12;
const PRECHOD_MS = 170;

let koren = null;
let fronta = []; // dvojice na řadě [{ a, b, duvod, druh }]; první je zobrazená
const historie = []; // porovnané dvojice pro Vrátit (s výsledkem: d.vysledek)
let sezonaVolby = null; // probíhající sezóna (GetSezona) pro stavovou lištu: kdo vede a kolik zbývá
let zaneprazdneno = false;
let poradiLimit = 25; // kolik řádků pořadí je ukázaných (Zobrazit dalších 100)
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

let vOblibenostiNejlepsi = false;
export const posledniCastOblibenosti = () => vOblibenostiNejlepsi ? 'nejlepsi' : (stav.oblibenostCast === 'slava' ? 'slava' : stav.hodnoceniPohled);
export function nastavitNejlepsiVOblibenosti(zapnout = true) {
    vOblibenostiNejlepsi = zapnout;
}

// Část Oblíbenosti nebo pohled Hodnocení, který otevře příští zobrazení (např. pořadí z profilu modelky): 'hodnoceni',
// 'slava', pohled ('porovnat', 'fotky', 'poradi') i dřívější části ('porovnani', 'galerie' – prevestCastOblibenosti)
export function nastavitCastOblibenosti(klic) {
    vOblibenostiNejlepsi = false;
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
    obnovitPanelHodnoceni();
    if (stav.oblibenostCast === 'slava' && cast('slava')) nacistSinSlavy(cast('slava'));
    if (stav.oblibenostCast === 'hodnoceni' && stav.hodnoceniPohled === 'fotky' && cast('galerie')) nacistGalerii(cast('galerie'));
    // Pořadí se mezitím přepočítalo: složí se teď; při odchodu z něj se ukázaný počet řádků vrátí na začátek
    if (poradiVidet() && poradiZastarale) vykreslitPoradi();
    if (!poradiVidet()) poradiLimit = PORADI_NAJEDNOU;
    vykreslitHlavu();
    document.querySelector('main').scrollTop = 0;
}

const nastavitZobrazeni = () => { const hd = cast('cast-hodnoceni'); if (hd) hd.dataset.hdZobrazeno = stav.hodnoceniPohled; };

// Panel Hodnocení vpravo (I): tipy, trendy a jak se počítá pořadí – jako Údaje u profilu a panel Sbírky
const PANELY_HODNOCENI = [['tipy', 'Tipy'], ['trendy', 'Trendy'], ['jak', 'Jak počítám']];
// Pořadí: úroveň, ve které je seznam právě odrolovaný (svítí ve skocích v hlavičce)
let urovenNaObrazovce = null;

// Hodnocení: tři pohledy (Porovnat, Fotky, Pořadí) a Síň slávy; přepínání částí je v liště (#pasStranky)
const KOSTRA = `
    <div class="ob-cast hd" data-ob-cast-hodnoceni>
    <div class="hd-pohled ob-porovnani" data-hd="porovnat" data-ob-porovnani>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-porovnat" data-ob-volby-porovnat></div>
        <div class="ob-serie hidden" data-ob-serie aria-live="polite"></div>
        <div class="ob-dvojice-obal">
            <div class="ob-dvojice" data-ob-dvojice aria-live="polite"></div>
            <div class="ob-sev hidden" data-ob-sev></div>
        </div>
    </div>
    <div class="hd-pohled gh" data-hd="fotky" data-ob-galerie></div>
    <div class="hd-pohled" data-hd="poradi" data-ob-cast-poradi>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-poradi" data-ob-volby-poradi></div>
        <div class="ob-karta hz-poradi" data-ob-sekce-poradi>
            <div data-ob-poradi></div>
        </div>
    </div>
    <aside class="sbirka-panel hd-panel" aria-label="Panel Hodnocení">
        <div class="sbp-hlava">
            <nav class="sbp-zalozky" role="tablist" aria-label="Panel Hodnocení">${PANELY_HODNOCENI.map(([klic, nazev]) => `<button type="button" role="tab" data-hd-panel="${klic}">${nazev}</button>`).join('')}</nav>
            <button type="button" class="sbp-zavrit" data-hd-panel-zavrit title="Zavřít panel (Esc)" aria-label="Zavřít panel">&times;</button>
        </div>
        <div class="sbp-telo">
            <div class="hdp-cast" data-hdp="tipy">
                <h4>Mohlo by se ti líbit <small>odhad podle tvého vkusu</small></h4>
                <div data-ob-tipy></div>
            </div>
            <div class="hdp-cast hz-trendy" data-hdp="trendy" data-ob-trendy></div>
            <div class="hdp-cast hdp-jak" data-hdp="jak">
                <h4>Model vkusu</h4>
                <p class="ob-info" data-ob-info></p>
                <h4>Zájem</h4>
                <p class="ob-vaha" data-ob-vaha></p>
                <h4>Úrovně Top 10 / 20 / 50 / 100</h4>
                <p class="ob-pravidla" data-ob-pravidla></p>
            </div>
        </div>
    </aside>
    </div>
    <div class="ob-cast" data-ob-cast-slava><div data-ob-slava></div></div>`;

const cast = klic => koren?.querySelector(`[data-ob-${klic}]`);

// ——— Načtení ———

export async function nacistOblibenost(sekce) {
    koren = sekce;
    // Modelky se mohly mezitím smazat nebo skrýt: jejich dvojice z fronty i historie zmizí
    const plati = d => modelka(d.a) && modelka(d.b);
    fronta = fronta.filter(plati);
    historie.splice(0, historie.length, ...historie.filter(plati));
    if (!koren.querySelector('[data-ob-porovnani]')) {
        koren.innerHTML = KOSTRA;
        pripravitPasy(cast('dvojice'), otevritFotku);
    }
    koren.dataset.obCast = stav.oblibenostCast;
    nastavitZobrazeni();
    obnovitPanelHodnoceni();
    vykreslitHlavu();
    if (stav.oblibenostCast === 'slava') nacistSinSlavy(cast('slava'));
    // Seznam fotek jen ve Fotkách; jinde stačí počet nehodnocených (hlavička, pilulka) z jednoho dotazu
    else if (stav.hodnoceniPohled === 'fotky') nacistGalerii(cast('galerie'));
    else nacistPocetNehodnocenych();
    // Srdíčka fotek se mohla mezitím změnit; fotky se načtou znovu (backend je má v paměti se snímkem sbírky)
    nahledy.clear();
    vykreslitHlavu();
    await Promise.all([obnovitPrehled(), fronta.length ? null : doplnitFrontu()]);
    vykreslitDvojici();
}

// Pořadí, tipy a věta o modelu vkusu (po porovnáních se obnoví jen občas, je to přepočet celé sbírky). Přepočty
// se neprolínají: když jeden běží, další se poznamená a spustí jednou po něm (starší výsledek nepřepíše novější)
let prehledBezi = null;
let prehledZnovu = false;
function obnovitPrehled() {
    if (prehledBezi) {
        prehledZnovu = true;
        return prehledBezi;
    }
    prehledBezi = (async () => {
        do {
            prehledZnovu = false;
            await obnovitPrehledJednou();
        } while (prehledZnovu);
    })().finally(() => { prehledBezi = null; });
    return prehledBezi;
}

async function obnovitPrehledJednou() {
    porovnanoOdObnoveni = 0;
    const porovnane = [...porovnaneOdObnoveni];
    porovnaneOdObnoveni.clear();
    // Místa před přepočtem: pruh Dvojice v pořadí ukáže posun ▲▼
    mistaPred = new Map((data.oblibenost?.poradi || []).map(p => [p.modelkaId, p.poradi]));
    const predtim = new Map((data.oblibenost?.poradi || []).map(p => [p.modelkaId, { uroven: urovenModelky(p).uroven, obhajoba: Number(p.obhajoba?.uroven) || 0, vyzyvatelka: Number(p.obhajoba?.vyzyvatelka) || 0 }]));
    try {
        const [oblibenost, tipy, sezona] = await Promise.all([GetOblibenost(), GetMohloByTeLibit(TIPU), GetSezona().catch(() => null)]);
        data = { oblibenost, tipy: tipy || [] };
        sezonaVolby = sezona;
    } catch {
        nastavitText(cast('info'), 'Oblíbenost se nepodařilo načíst.');
        // Bez dat by Pořadí zůstalo prázdné bez vysvětlení
        if (!data.oblibenost) nastavitHtml(cast('poradi'), htmlPrazdna('Pořadí se nepodařilo načíst', 'Zkus Hodnocení otevřít znovu.', { ikona: 'hvezda' }));
        return;
    }
    oznamitPostup(porovnane, predtim);
    [...(data.oblibenost?.poradi || []), ...data.tipy].forEach(p => { if (p.duvod && p.odhad) duvodyOdhadu.set(p.modelkaId, p.duvod); });
    if (!koren?.isConnected) return;
    nastavitText(cast('info'), textModeluVkusu(data.oblibenost || {}));
    vykreslitPoradi();
    vykreslitSev(fronta[0]);
    vykreslitTipy();
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


// Věta a tlačítka návrhu; nesoulad = položka nesouladu (hodnocená), jinak nehodnocená { porovnani, vyhry }
function htmlNavrhu(id, navrh, nesoulad, nehodnocena = null) {
    const m = modelka(id);
    // U nesouladu srdíčka, ke kterým se vztahuje (backend), ne místní – po změně jinde by klíč „Nechat“ nesedl
    const srdicka = nesoulad ? Number(nesoulad.hodnoceni) || 0 : m.hodnoceni || 0;
    const klic = klicNavrhu(id, srdicka, navrh);
    navrhy.set(klic, { id, navrh });
    const jmeno = `<button type="button" class="link" data-otevrit-modelku="${id}">${esc(m.jmeno)}</button>`;
    // Ověření porovnáním jen u modelky, která nečeká na úroveň ani ji neobhajuje (jinak by backend dal souboje o úroveň)
    const p = polozkaPoradi(id);
    const overit = nesoulad && !p?.ceka && !p?.obhajoba;
    const veta = nesoulad
        ? `${jmeno} (${kratceSrdicka(srdicka)} ♥) ${vetaNesouladu(nesoulad)} – možná jí patří <b>${kratceSrdicka(navrh)} ♥</b>`
        : `Nehodnocená ${jmeno} vychází po ${nehodnocena.porovnani} porovnáních (výhry ${String(nehodnocena.vyhry).replace('.', ',')}) na <b>${kratceSrdicka(navrh)} ♥</b>`;
    return { klic, html: `<span>${veta}</span>
        <button type="button" class="btn btn-primary btn-small" data-ob-navrh-ano="${klic}">Dát jí ${kratceSrdicka(navrh)} ♥</button>
        <button type="button" class="link" data-ob-navrh-ne="${klic}">Nechat</button>${overit ? `
        <button type="button" class="link" data-ob-rozhodnout="${id}" title="Čtyři porovnání s modelkami z úrovně, kam podle nesouladu patří – pak bude jasné, jestli srdíčka změnit">⚔ Ověřit porovnáním</button>` : ''}` };
}

// Po porovnání: návrh pro jednu z modelek dvojice, když ho backend má a nebyl odmítnut
async function ukazatNavrhPoPorovnani(d) {
    zobrazitNavrhPodPasy(null);
    const moje = ++cisloNavrhu;
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
    // Skrytí (Vrátit, Přeskočit, nová série) zneplatní i návrh, na který se ještě čeká
    if (!navrh) cisloNavrhu++;
    navrhPodPasy = navrh?.klic || '';
    // Návrh ukazuje stavová lišta (♥ Cecílii dát 3½? Ano · Ne)
    vykreslitHlavu();
}

const viditelneNesoulady = () => {
    const skryte = skryteNavrhy();
    return (data.oblibenost?.nesedi || []).filter(n => modelka(n.modelkaId) && !skryte.has(klicNavrhu(n.modelkaId, n.hodnoceni, n.navrh)));
};

// Modelky, o jejichž úrovni rozhodnou souboje: čekají na potvrzení, nebo obhajují místo (pořadí z backendu)
const rozhodujici = () => (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId) && (p.ceka || p.obhajoba));


// Srdíčka modelky z návrhu: uloží se a ukážou všude, kde modelka je (karty, profil, Hodnotit › Modelky přes
// událost hodnoceni-modelky); false = nepodařilo se
async function ulozitSrdicka(id, hodnoceni) {
    let ok = false;
    try { ok = await SetHodnoceni(id, hodnoceni); } catch { /* false */ }
    if (!ok) return false;
    [modelka(id), stav.aktualniModelka, ...stav.nacteneModelky].forEach(x => { if (x?.id === id) x.hodnoceni = hodnoceni; });
    document.querySelectorAll(`.hearts-pul[data-hodnoceni="${id}"]`).forEach(r => obnovitSrdickaModelky(/** @type {HTMLElement} */ (r), hodnoceni));
    document.querySelectorAll(`.odhad-chip[data-odhad="${id}"]`).forEach(c => c.classList.toggle('hidden', hodnoceni > 0));
    document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id, hodnoceni } }));
    return true;
}

// „Dát jí“: srdíčka se uloží a ukážou všude, kde modelka je; návrh zmizí pod pásy i z Nesedí se srdíčky
async function prijmoutNavrh(klic) {
    const n = navrhy.get(klic);
    if (!n) return;
    if (!await ulozitSrdicka(n.id, n.navrh)) return oznamit('Hodnocení se nepodařilo uložit.');
    const m = modelka(n.id);
    if (navrhPodPasy === klic) zobrazitNavrhPodPasy(null);
    if (data.oblibenost) data.oblibenost.nesedi = (data.oblibenost.nesedi || []).filter(x => x.modelkaId !== n.id);
    vykreslitPoradi();
    oznamit(`${m?.jmeno || 'Modelka'} má teď ${textSrdicek(n.navrh)}.`);
    obnovitPrehled();
}

function odmitnoutNavrh(klic) {
    skrytNavrh(klic);
    if (navrhPodPasy === klic) zobrazitNavrhPodPasy(null);
    vykreslitPoradi();
    vykreslitHlavu();
}

// Klíč dvojice bez ohledu na pořadí (backend strany A/B prohazuje)
const klicDvojice = d => [d.a, d.b].sort((x, y) => x - y).join('-');

// Doplnění fronty; souběžná volání (rychlé volby) sdílejí jedno načtení
let doplnovani = null;
function doplnitFrontu() {
    doplnovani ??= doplnitFrontuJednou().finally(() => { doplnovani = null; });
    return doplnovani;
}

async function doplnitFrontuJednou() {
    let nove = [];
    try {
        nove = (await GetDvojiceKPorovnani(DVOJIC_NAJEDNOU, '') || []).map(idDvojice);
    } catch { /* prázdná fronta ukáže prázdný stav */ }
    const videne = new Set(fronta.map(klicDvojice));
    fronta.push(...nove.filter(d => d.a && d.b && d.a !== d.b && modelka(d.a) && modelka(d.b) && !videne.has(klicDvojice(d))));
    // Seznamy fotek celé fronty jedním voláním; zobrazená dvojice pak pásy doplní (ne uprostřed přechodu)
    nacistNahledy(fronta.flatMap(d => [d.a, d.b])).then(() => {
        prednacist();
        if (fronta[0] && !cast('dvojice')?.classList.contains('odchazi')) vykreslitDvojici();
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

// ——— Hlavička Hodnocení (jeden panel v hlavičce okna jako Sbírka a profil modelky) ———
// Kruh „dnes“, čísla, okénka Top 10 a Sezóna (proklik do Síně slávy), akce, přepínače panelu a lišta: části
// Porovnat · Fotky · Pořadí · Síň slávy a vpravo pohledy zvolené části. Po odrolování jeden řádek a lišta.
let hlava = null;
const hlavaVidet = () => Boolean(koren?.isConnected) && !stats.classList.contains('hidden') && stav.rezim === 'prehled'
    && stav.prehledSekce === 'oblibenost' && stav.oblibenostCast === 'hodnoceni';

function htmlHlavyHodnoceni() {
    const { fotek } = poctyOblibenosti();
    const poradi = (data.oblibenost?.poradi || []).filter(x => modelka(x.modelkaId));
    const cekajici = rozhodujici();
    const casti = [['porovnat', 'Porovnat'], ['fotky', 'Hodnotit'], ['poradi', 'Pořadí']];
    const htmlCasti = `<div class="sh-filtry" role="tablist" aria-label="Části hodnocení">${casti.map(([klic, nazev]) =>
        `<button type="button" role="tab" class="sh-filtr ${klic === stav.hodnoceniPohled ? 'on' : ''}" aria-selected="${klic === stav.hodnoceniPohled}" data-zobrazeni-prehledu="${klic}">${nazev}</button>`).join('')}<button type="button" role="tab" class="sh-filtr" aria-selected="false" data-cast-modelek-pas="slava">Síň slávy</button></div>`;
    const htmlPanelu = PANELY_HODNOCENI.map(([klic, nazev]) => `<button type="button" class="volba ${stav.hodnoceniPanel === klic ? 'zapnuto' : ''}" data-hd-panel="${klic}" aria-pressed="${stav.hodnoceniPanel === klic}" title="Panel vpravo (I)">${nazev}</button>`).join('');
    const htmlRozhodnout = cekajici.length
        ? `<button type="button" class="volba akcent" data-hd-akce="rozhodnout" title="${esc(`Souboje, které rozhodnou úroveň – ${modelka(cekajici[0].modelkaId).jmeno} první`)}"><b>⚔ Rozhodnout ${cekajici.length}</b></button><span class="sh-oddelovac" aria-hidden="true"></span>`
        : '';
    const tlacitkoPohledu = (klic, nazev, zvoleny, atribut) =>
        `<button type="button" class="${klic === zvoleny ? 'on' : ''}" ${atribut}="${klic}" aria-pressed="${klic === zvoleny}">${nazev}</button>`;
    // Hodnotit: přepínač Fotky / Modelky (počty v něm), u fotek Hodnotit, Promítat a řazení
    if (stav.hodnoceniPohled === 'fotky') {
        const co = pohledHodnotit();
        const nModelek = pocetModelekBezSrdicek();
        const titulky = { fotky: 'Fotky bez srdíček', modelky: 'Modelky bez srdíček', tagy: 'Fotky bez tagů (tagování pro tematické sezóny)' };
        const prepinac = [['fotky', 'Fotky', fotek], ['modelky', 'Modelky', nModelek], ['tagy', 'Tagy', pocetNepotagovanych()]].map(([klic, nazev, n]) =>
            `<button type="button" class="${klic === co ? 'on' : ''}" data-hd-hodnotit="${klic}" aria-pressed="${klic === co}" title="${esc(titulky[klic])}">${nazev}${Number(n) > 0 ? ` <small>${n}</small>` : ''}</button>`).join('');
        const akceFotek = co === 'fotky' ? '<button type="button" class="volba akcent" data-hd-akce="fotky" title="Začít hodnotit (Enter)"><b>♥ Hodnotit ↵</b></button><button type="button" class="volba" data-hd-akce="promitat" title="Promítat nehodnocené (mezerník)"><b>▶ Promítat</b></button><span class="sh-oddelovac" aria-hidden="true"></span>' : '';
        const razeni = [['nahodne', 'Náhodně'], ['modelky', 'Po modelkách']].map(([klic, nazev]) => tlacitkoPohledu(klic, nazev, razeniFotek(), 'data-hd-razeni')).join('');
        return `<div class="sh-lista">${htmlCasti}
            <div class="sh-akce hd-kompakt-akce">${akceFotek}${htmlPanelu}</div>
            <div class="sh-pohledy" role="group" aria-label="Co hodnotit">${prepinac}</div>
            ${co === 'fotky' ? `<div class="sh-pohledy" role="group" aria-label="Pořadí fotek">${razeni}</div>` : ''}
        </div>`;
    }
    // Pořadí: vpravo skoky na úroveň (zvýrazněná je ta, ve které je seznam právě odrolovaný)
    if (stav.hodnoceniPohled === 'poradi') {
        const skoky = seskupitPodleUrovni(poradi).map(sk => sk.uroven).map((u, i) =>
            `<button type="button" class="${u === urovenNaObrazovce ? 'on' : ''}" data-hd-uroven="${u}" title="${esc(u ? `Skočit na ${nazevUrovne(u)}` : 'Skočit na modelky mimo Top 100')}">${u ? (i === 0 ? nazevUrovne(u) : String(u)) : 'Mimo'}</button>`).join('');
        return `<div class="sh-lista">${htmlCasti}
            <div class="sh-akce hd-kompakt-akce">${htmlRozhodnout}${htmlPanelu}</div>
            ${skoky ? `<div class="sh-pohledy" role="group" aria-label="Skok na úroveň">${skoky}</div>` : ''}
        </div>`;
    }
    // Porovnat: jen lišta (pásy mají celou výšku); dnešní postup a sezóna jsou ve stavové liště
    return `<div class="sh-lista">${htmlCasti}
            <div class="sh-akce hd-kompakt-akce">${htmlRozhodnout}${htmlPanelu}</div>
        </div>`;
}

export function obnovitHlavuHodnoceni() {
    obnovitHlavuSlavy();
    if (!hlava) return;
    const videt = hlavaVidet();
    hlava.classList.toggle('hidden', !videt);
    if (!videt) return;
    nastavitHtml(hlava, htmlHlavyHodnoceni());
}

// Panel vpravo: '' zavře, stejný klíč znovu zavře; pamatuje se otevřený i naposledy otevřený (pro I)
function nastavitPanelHodnoceni(klic) {
    stav.hodnoceniPanel = klic === stav.hodnoceniPanel ? '' : klic;
    try {
        localStorage.setItem('hodnoceniPanel', stav.hodnoceniPanel);
        if (stav.hodnoceniPanel) localStorage.setItem('hodnoceniPanelPosledni', stav.hodnoceniPanel);
    } catch { /* jen pro toto spuštění */ }
    obnovitPanelHodnoceni();
    obnovitHlavuHodnoceni();
}

function obnovitPanelHodnoceni() {
    const hd = cast('cast-hodnoceni');
    if (!hd) return;
    hd.dataset.hdPanel = stav.hodnoceniPanel;
    hd.querySelectorAll('.hd-panel [data-hd-panel]').forEach(b => b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.hdPanel === stav.hodnoceniPanel)));
}

// Skok na úroveň (Top 10 · 20 · 50 · 100 · Mimo): úroveň za ukázanými řádky se nejdřív doplní
function skocitNaUroven(uroven) {
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const sk = seskupitPodleUrovni(poradi).find(x => x.uroven === uroven);
    const prvni = sk ? poradi.indexOf(sk.polozky[0]) : -1;
    if (prvni >= poradiLimit) {
        poradiLimit = prvni + PORADI_NAJEDNOU;
        vykreslitPoradi();
    }
    cast('poradi')?.querySelector(`.ob-uroven[data-uroven="${uroven}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// Která úroveň je nahoře v okně (poslední oddělovač nad horní hranou obsahu)
function sledovatUroven() {
    const main = document.querySelector('main');
    const hranice = (main?.getBoundingClientRect().top || 0) + 40;
    let nyni = null;
    cast('poradi')?.querySelectorAll('.ob-uroven').forEach(o => {
        if (o.getBoundingClientRect().top <= hranice) nyni = Number(/** @type {HTMLElement} */ (o).dataset.uroven);
    });
    if (nyni === null) nyni = Number(/** @type {HTMLElement | null} */ (cast('poradi')?.querySelector('.ob-uroven'))?.dataset.uroven ?? 10);
    if (nyni === urovenNaObrazovce) return;
    urovenNaObrazovce = nyni;
    hlava?.querySelectorAll('[data-hd-uroven]').forEach(b => {
        const on = Number(/** @type {HTMLElement} */ (b).dataset.hdUroven) === nyni;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
    });
}

function pripravitHlavuHodnoceni() {
    hlava = document.createElement('div');
    hlava.id = 'hodnoceniHlava';
    hlava.className = 'sbirka-hlava hodnoceni-hlava kompaktni hidden';
    document.getElementById('albumNav')?.before(hlava);
    hlava.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const akce = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-akce]'))?.dataset.hdAkce;
        const panel = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-panel]'));
        const uroven = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-uroven]'));
        const razeni = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-razeni]'));
        const hodnotit = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-hodnotit]'));
        if (hodnotit) {
            nastavitPohledHodnotit(hodnotit.dataset.hdHodnotit);
            obnovitHlavuHodnoceni();
        }
        else if (panel) nastavitPanelHodnoceni(panel.dataset.hdPanel);
        else if (uroven) skocitNaUroven(Number(uroven.dataset.hdUroven));
        else if (razeni) nastavitRazeniFotek(razeni.dataset.hdRazeni);
        else if (akce === 'rozhodnout') {
            const prvni = rozhodujici()[0];
            if (prvni) rozhodnoutTed(prvni.modelkaId);
        } else if (akce === 'fotky' || akce === 'promitat') {
            if (stav.hodnoceniPohled !== 'fotky') ukazatCastOblibenosti('fotky');
            hodnotitFotky(akce === 'promitat');
        }
    });
    // Pořadí: skok na úroveň v hlavičce svítí podle toho, kde je seznam odrolovaný
    const main = document.querySelector('main');
    let naplanovano = false;
    main?.addEventListener('scroll', () => {
        if (naplanovano || hlava.classList.contains('hidden') || !poradiVidet()) return;
        naplanovano = true;
        requestAnimationFrame(() => {
            naplanovano = false;
            sledovatUroven();
        });
    }, { passive: true });
}

// ——— Vykreslení ———

function poctyOblibenosti() {
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const cekaji = poctyCekajicich(poradi);
    // Z viditelného pořadí (backendový počet zahrnuje i skryté modelky)
    const nCekaji = cekaji.reduce((s, [, n]) => s + n, 0);
    const nesouladu = viditelneNesoulady().length;
    const fotek = Math.max(0, pocetNehodnocenych());
    return {
        cekaji, nCekaji, nesouladu, fotek,
        pocty: {
            porovnat: [nCekaji, nCekaji ? `${textCekajicich(cekaji, nCekaji)} – dvojice, které to rozhodnou, jsou v porovnávání napřed` : 'Která se ti líbí víc? Dvě modelky nad sebou'],
            fotky: [fotek, fotek ? `${sklonovat(fotek, 'nehodnocená fotka', 'nehodnocené fotky', 'nehodnocených fotek')} – dávej jim srdíčka v prohlížeči` : 'Nehodnocené fotky v prohlížeči'],
            poradi: [nesouladu, nesouladu ? `${sklonovat(nesouladu, 'modelce', 'modelkám', 'modelkám')} podle porovnání nesedí srdíčka` : 'Pořadí podle síly s úrovněmi Top 10 / 20 / 50 / 100'],
        },
    };
}

// Stavová lišta Porovnat (skrytý řádek voleb, ui/volby.js ho zrcadlí): vlevo ukazatel dne „▰▰▱ Dnes 4 z 10“ a kdo vede
// sezónu; vpravo potvrzení volby (4 s „✓ Bára > Cecílie“, pak „↶ Vrátit“), návrh srdíček (Ano · Ne), odkaz na to, co
// čeká jinde, a klikatelné klávesy. data-stav-priorita říká, co v užším okně zmizí dřív (3 první, 1 nikdy).
const POTVRZENI_MS = 4000;
let casVolby = 0;
let casovacPotvrzeni = 0;
function vykreslitVolbyPorovnat() {
    const misto = cast('volby-porovnat');
    if (!misto) return;
    const p = postupDne(porovnaniDnes);
    const { cekaji, nCekaji, nesouladu, fotek, pocty } = poctyOblibenosti();
    const krestni = id => String(modelka(id)?.jmeno || '?').split(' ')[0];
    const odkaz = odkazyHodnoceni({ pohled: 'porovnat', cekaji, celkem: nCekaji, nesouladu, fotek })[0];
    const htmlOdkazu = odkaz
        ? `<button type="button" data-hd-pohled="${odkaz.pohled}" data-stav-priorita="3" title="${esc(pocty[odkaz.pohled][1])}">${esc(odkaz.text)} · ${esc(odkaz.akce)} →</button>`
        : '';
    // Poslední volba: hned po ní potvrzení, po pár sekundách Vrátit (klik jde na skryté tlačítko → obsluha data-ob-vratit)
    const posledni = historie[historie.length - 1];
    let htmlVratit = '';
    if (posledni) {
        const text = posledni.vysledek === 'b' ? `${krestni(posledni.b)} > ${krestni(posledni.a)}`
            : `${krestni(posledni.a)} ${posledni.vysledek === 'remiza' ? '=' : '>'} ${krestni(posledni.b)}`;
        const cerstve = Date.now() - casVolby < POTVRZENI_MS;
        htmlVratit = `<button type="button" data-ob-vratit data-stav-priorita="1" data-stav-trida="${cerstve ? 'stav-potvrzeni' : 'stav-akce'}" title="Vrátit poslední porovnání (Backspace)">${esc(cerstve ? `✓ ${text} · ↶` : `↶ Vrátit: ${text}`)}</button>`;
    }
    // Návrh srdíček po porovnání (dřív pod pásy, mimo obrazovku)
    const n = navrhPodPasy && navrhy.get(navrhPodPasy);
    const htmlNavrh = n && modelka(n.id)
        ? `<button type="button" data-ob-navrh-ano="${esc(navrhPodPasy)}" data-stav-priorita="1" data-stav-trida="stav-navrh" title="Uloží srdíčka modelce">♥ ${esc(krestni(n.id))}: dát ${esc(kratceSrdicka(n.navrh))}? Ano</button><button type="button" data-ob-navrh-ne="${esc(navrhPodPasy)}" data-stav-priorita="1" data-stav-trida="stav-akce">Ne</button>`
        : '';
    const klavesy = fronta[0] ? [['data-ob-tahle', '↵', 'Tahle', 'Líbí se mi víc modelka aktivního pásu (Enter)'], ['data-ob-volba="remiza"', '↓', 'Stejně', 'Obě stejně (↓ nebo mezerník)'],
        ['data-ob-preskocit', 'S', 'Přeskočit', 'Přeskočit dvojici (S)']]
        .map(([atr, kl, nazev, tit]) => `<button type="button" ${atr} data-stav-klavesa="${kl}" data-stav-priorita="2" title="${esc(tit)}">${nazev}</button>`).join('') : '';
    const vede = sezonaVolby?.poradi?.find(b => b.misto === 1 && modelka(b.modelkaId));
    const sezona = sezonaVolby?.dni && vede ? `<span class="stav-sezona"> · ♛ ${esc(krestni(vede.modelkaId))} vede sezónu, ${esc(textZbyva(sezonaVolby.den, sezonaVolby.dni).replace(/^zbývá /, ''))}</span>` : '';
    // Deset dílků k další desítce (cíl dne roste po desítkách)
    const dilky = Array.from({ length: 10 }, (_, i) => `<i class="${i < p.hotovo - (p.cil - 10) ? 'on' : ''}"></i>`).join('');
    // Série dní v řadě (backend počítá z historie; dnešní první porovnání ji prodlouží hned, bez přepočtu)
    const o = data.oblibenost;
    const dnesVSerii = Boolean(o?.serieDnes) || porovnaniDnes > 0;
    const delkaSerie = (Number(o?.serieDni) || 0) + (porovnaniDnes > 0 && !o?.serieDnes ? 1 : 0);
    const serie = delkaSerie >= 2 && dnesVSerii ? `<span class="stav-serie" title="Dní v řadě, kdy jsi porovnával"> · 🔥 ${esc(sklonovat(delkaSerie, 'den', 'dny', 'dní'))} v řadě</span>`
        : delkaSerie >= 1 && !dnesVSerii ? `<span class="stav-serie ohrozena" title="Dnes ještě žádné porovnání – jedno sérii prodlouží"> · 🔥 ${esc(sklonovat(delkaSerie, 'den', 'dny', 'dní'))} v řadě – dnes ji prodluž</span>` : '';
    const titulek = p.hotovo ? `Dnes ${sklonovat(p.hotovo, 'porovnání', 'porovnání', 'porovnání')} – do ${p.cil} zbývá ${p.zbyva}` : 'Dnes zatím žádné porovnání';
    nastavitHtml(misto, `${htmlVratit}${htmlNavrh}${htmlOdkazu}${klavesy}<span data-stav-html title="${esc(titulek)}"><span class="stav-dilky" aria-hidden="true">${dilky}</span>Dnes ${p.hotovo} z ${p.cil}${serie}${sezona}</span>`);
}

// Po volbě: potvrzení v liště a po POTVRZENI_MS přepnutí na Vrátit
function potvrditVolbu() {
    casVolby = Date.now();
    clearTimeout(casovacPotvrzeni);
    casovacPotvrzeni = setTimeout(() => vykreslitHlavu(), POTVRZENI_MS + 50);
}


// Štítek na švu mezi pásy: druh dvojice (souboj o úroveň, ověření) nebo zkrácený důvod a místa obou modelek
// v pořadí („⚔ O postup do Top 10 · 10. Marta ↔ 11. Anna ⏳“); celý důvod a okolí v pořadí v bublině
function vykreslitSev(d) {
    const misto = cast('sev');
    if (!misto) return;
    misto.classList.toggle('hidden', !d);
    if (!d) return nastavitHtml(misto, '');
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const okoli = okoliDvojice(poradi, d.a, d.b);
    const krestni = id => String(modelka(id)?.jmeno || '').split(' ')[0];
    const strany = okoli.filter(x => x.typ === 'radek' && x.strana);
    const mista = strany.map(x => {
        const posun = posunMista(mistaPred.get(x.p.modelkaId), x.misto);
        return `<span class="ob-sev-misto"><small>${x.misto}.</small> ${esc(krestni(x.p.modelkaId))}${x.p.ceka ? ' ⏳' : ''}${posun ? `<i class="trend ${posun.smer}">${posun.text}</i>` : ''}</span>`;
    }).join('<span class="ob-sev-oddel" aria-hidden="true">↔</span>');
    const souboj = nadpisSouboje(d, polozkaPoradi(d.a) || modelka(d.a), polozkaPoradi(d.b) || modelka(d.b));
    const okoliText = okoli.filter(x => x.typ === 'radek').map(x => `${x.misto}. ${modelka(x.p.modelkaId)?.jmeno || ''}${x.p.ceka ? ` (čeká na ${nazevUrovne(x.p.ceka.uroven)})` : ''}`).join('\n');
    misto.title = [d.duvod, okoliText].filter(Boolean).join('\n\n');
    misto.classList.toggle('souboj', Boolean(souboj));
    nastavitHtml(misto, `${souboj ? `<b>⚔ ${esc(souboj)}</b>` : d.duvod ? `<span class="ob-sev-duvod">${esc(d.duvod)}</span>` : ''}${mista ? `${souboj || d.duvod ? '<span class="ob-sev-tecka" aria-hidden="true">·</span>' : ''}${mista}` : ''}`);
}

// Obnoví počty v pilulkách Oblíbenosti (#pasStranky) a volby pohledu Porovnat (#volbyPrehledu)
// Hlavičku, kapsli a stavovou lištu obnoví prehled.js po události volby-prehledu; víc změn v jednom snímku jedna obnova
let hlavaNaplanovana = false;
function vykreslitHlavu() {
    vykreslitVolbyPorovnat();
    obnovitStavPoradi();
    if (hlavaNaplanovana) return;
    hlavaNaplanovana = true;
    requestAnimationFrame(() => {
        hlavaNaplanovana = false;
        document.dispatchEvent(new CustomEvent('volby-prehledu'));
    });
}

function vykreslitDvojici() {
    const misto = cast('dvojice');
    if (!misto) return;
    vykreslitSerii();
    const d = fronta[0];
    vykreslitSev(d);
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

// Stavová lišta Pořadí: vlevo počet, čekající a nesoulady, vpravo odkaz na to, co čeká (zrcadlí se ze skrytého tlačítka)
function htmlStavuPoradi(poradi) {
    if (!poradi.length) return '';
    const { nesouladu } = poctyOblibenosti();
    // Stejně jako štítky v řádcích: čekající na potvrzení i obhajující
    const nRozhoduje = rozhodujici().length;
    const v = vybranaPoradi ? poradi.find(p => p.modelkaId === vybranaPoradi) : null;
    const m = v && modelka(v.modelkaId);
    let vlevo;
    if (m) {
        // Vybraná modelka: co v řádku není (síla, nejistota, počet porovnání, co jí chybí do úrovně)
        const drzitelka = v.ceka?.drzitelka ? modelka(v.ceka.drzitelka)?.jmeno || '' : '';
        const ceka = textCekani(v.ceka, drzitelka);
        const casti = [`${v.poradi}. <b>${esc(m.jmeno)}</b>`, m.hodnoceni ? `${esc(kratceSrdicka(m.hodnoceni))} ♥` : 'bez srdíček',
            `síla ${esc(cislo(v.sila))} ± ${esc(cislo(v.nejistota))}`, esc(sklonovat(v.porovnani || 0, 'porovnání', 'porovnání', 'porovnání'))];
        if (ceka) casti.push(esc(ceka));
        vlevo = `<span data-stav-html>${casti.join(' · ')}</span>`;
    } else {
        const casti = [sklonovat(poradi.length, 'modelka', 'modelky', 'modelek')];
        if (nRozhoduje) casti.push(`${nRozhoduje} ${nRozhoduje === 1 ? 'čeká' : nRozhoduje < 5 ? 'čekají' : 'čeká'}`);
        if (nesouladu) casti.push(`${nesouladu} nesedí`);
        vlevo = `<span>${esc(casti.join(' · '))}</span>`;
    }
    const tlacitko = (atribut, text, priorita, klavesa = '', titulek = '') => `<button type="button" ${atribut} data-stav-priorita="${priorita}"${klavesa ? ` data-stav-klavesa="${klavesa}"` : ''}${titulek ? ` title="${esc(titulek)}"` : ''}>${text}</button>`;
    const vpravo = [
        nRozhoduje ? tlacitko('data-por-dalsi="ceka"', '⏳ Další čekající ↓', 2, '', 'Vybrat další modelku, která čeká na úroveň nebo ji obhajuje') : '',
        nesouladu ? tlacitko('data-por-dalsi="nesedi"', '≠ Další nesedí ↓', 2, '', 'Vybrat další modelku, které nesedí srdíčka') : '',
        tlacitko('data-por-klavesa="dolu"', 'Vybrat', 3, '↑↓', 'Šipky vyberou modelku, písmena skočí na jméno'),
        m ? tlacitko('data-por-klavesa="profil"', 'Profil', 2, '↵', 'Otevřít profil vybrané modelky (Enter)') : '',
        m && (v.ceka || v.obhajoba) ? tlacitko('data-por-klavesa="rozhodnout"', 'Rozhodnout', 1, 'R', 'Souboje, které rozhodnou její úroveň (R)') : '',
    ].join('');
    return vpravo + vlevo;
}

// ——— Výběr v Pořadí: šipky, písmena (skok na jméno), Enter profil, R Rozhodnout ———
let vybranaPoradi = 0;
function vybratVPoradi(id, posunout = true) {
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const kde = poradi.findIndex(p => p.modelkaId === id);
    if (kde < 0) return;
    // Modelka za ukázanými řádky: seznam se doplní
    if (kde >= poradiLimit) {
        poradiLimit = kde + PORADI_NAJEDNOU;
        vybranaPoradi = id;
        vykreslitPoradi();
    }
    vybranaPoradi = id;
    cast('poradi')?.querySelectorAll('li.vybrana').forEach(li => li.classList.remove('vybrana'));
    const li = cast('poradi')?.querySelector(`li[data-poradi-modelka="${id}"]`);
    li?.classList.add('vybrana');
    if (posunout) li?.scrollIntoView({ block: 'nearest' });
    vykreslitHlavu();
}

// Posun výběru o krok, nebo na další modelku, která splňuje podmínku (čeká, nesedí); dokola
function posunoutVyber(krok, podminka = null) {
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    if (!poradi.length) return;
    const ted = poradi.findIndex(p => p.modelkaId === vybranaPoradi);
    if (!podminka) {
        const dalsi = ted < 0 ? 0 : Math.min(poradi.length - 1, Math.max(0, ted + krok));
        return vybratVPoradi(poradi[dalsi].modelkaId);
    }
    for (let i = 1; i <= poradi.length; i++) {
        const p = poradi[(Math.max(ted, -1) + i + poradi.length) % poradi.length];
        if (!podminka(p)) continue;
        vybratVPoradi(p.modelkaId, false);
        cast('poradi')?.querySelector(`li[data-poradi-modelka="${p.modelkaId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
    }
}

const nesedi = p => viditelneNesoulady().some(n => n.modelkaId === p.modelkaId);
const rozhoduje = p => Boolean(p.ceka || p.obhajoba);

// Písmena skočí na jméno (bez ohledu na diakritiku), víc písmen rychle za sebou upřesní
let hledanePoradi = '';
let casovacHledani = 0;
const bezDiakritiky = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function skocitNaJmeno(znak) {
    clearTimeout(casovacHledani);
    hledanePoradi += bezDiakritiky(znak);
    casovacHledani = setTimeout(() => { hledanePoradi = ''; }, 900);
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const p = poradi.find(x => bezDiakritiky(modelka(x.modelkaId).jmeno).startsWith(hledanePoradi))
        || poradi.find(x => bezDiakritiky(modelka(x.modelkaId).jmeno).split(' ').some(slovo => slovo.startsWith(hledanePoradi)));
    if (p) vybratVPoradi(p.modelkaId);
}

function akcePoradi(klic) {
    const v = (data.oblibenost?.poradi || []).find(p => p.modelkaId === vybranaPoradi);
    if (klic === 'dolu') posunoutVyber(1);
    else if (klic === 'nahoru') posunoutVyber(-1);
    else if (klic === 'profil' && v) /** @type {HTMLElement | null} */ (cast('poradi')?.querySelector(`li[data-poradi-modelka="${v.modelkaId}"] .ob-radek`))?.click();
    else if (klic === 'rozhodnout' && v && rozhoduje(v)) rozhodnoutTed(v.modelkaId);
}

// Stavová lišta Pořadí (skrytý řádek voleb): obnoví se s hlavičkou, i po Dát jí a Nechat
function obnovitStavPoradi() {
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    nastavitHtml(cast('volby-poradi'), htmlStavuPoradi(poradi));
}

// Seznam pořadí se skládá, jen když je vidět (u velké sbírky tisíce řádků); jinak se jen poznamená a složí se
// po přepnutí na Pořadí. Ukazuje se po stovkách.
const PORADI_DALSICH = 100;
let poradiZastarale = false;
const poradiVidet = () => stav.oblibenostCast === 'hodnoceni' && stav.hodnoceniPohled === 'poradi';

function vykreslitPoradi() {
    const o = data.oblibenost;
    const poradi = (o?.poradi || []).filter(p => modelka(p.modelkaId));
    // Panel (Jak počítám, Trendy) je vidět ve všech pohledech
    nastavitText(cast('vaha'), o && poradi.length ? textVahyZajmu(o) : '');
    vykreslitTrendy(poradi, o);
    nastavitText(cast('pravidla'), poradi.length ? textPravidelUrovni(o?.urovne) : '');
    vykreslitHlavu();
    if (!poradiVidet()) {
        poradiZastarale = true;
        return;
    }
    poradiZastarale = false;
    // Pořadí dávají srdíčka už bez porovnání; prázdné je jen bez hodnocených modelek
    if (!poradi.length) {
        nastavitHtml(cast('poradi'), htmlPrazdna('Pořadí vznikne z porovnávání', 'Po pár porovnáních tu uvidíš, které modelky máš nejradši – jemněji, než ukážou srdíčka.', { ikona: 'hvezda' }));
        return;
    }
    const ukazat = poradi.slice(0, poradiLimit);
    const pruhy = pruhySily(poradi);
    // Nesoulady srdíček podle modelky: štítek v řádku s Dát a Nechat
    const nesoulady = new Map(viditelneNesoulady().map(n => [n.modelkaId, n]));
    // Řádek modelky na jednu linku: místo, náhled, jméno se srdíčky (fotky, zájem), trend, pruh síly, počet porovnání
    // jen když jich je málo; vpravo štítek čekání nebo obhajoby s Rozhodnout, nebo nesoulad s Dát / Nechat. i = index
    // v celém pořadí (pruhy síly)
    const radek = (p, i) => {
        const m = modelka(p.modelkaId);
        const { sirka, nejistota } = pruhy[i];
        const fotky = textSkoreFotek(p.skoreFotek);
        const popis = `${m.jmeno}: ${p.duvod || sklonovat(p.porovnani || 0, 'porovnání', 'porovnání', 'porovnání')} · síla ${cislo(p.sila)} ± ${cislo(p.nejistota)}`;
        const drzitelka = p.ceka?.drzitelka ? modelka(p.ceka.drzitelka)?.jmeno || '' : '';
        const ceka = textCekani(p.ceka, drzitelka);
        const obhajoba = stitekObhajoby(p.obhajoba, p.obhajoba ? modelka(p.obhajoba.vyzyvatelka)?.jmeno || '' : '');
        const n = nesoulady.get(p.modelkaId);
        let stitky = '';
        if (ceka || obhajoba) {
            // Čekající: kam patří podle síly a co jí chybí (bublina)
            const podleSily = ceka && p.mistoPodleSily > 0 && p.mistoPodleSily !== p.poradi ? ` Podle síly patří na ${p.mistoPodleSily}. místo.` : '';
            stitky = `${ceka ? `<span class="ob-chip ob-chip-ceka" title="${esc(bublinaCekani(p.ceka, p.mistoPodleSily, drzitelka) + podleSily)}">${p.ceka.drzitelka ? '⚔' : '⏳'} ${esc(ceka)}</span>`
                : `<span class="ob-chip ob-chip-ceka" title="${esc(obhajoba.title)}">🛡 ${esc(obhajoba.text)}</span>`}
                <button type="button" class="link ob-rozhodnout" data-ob-rozhodnout="${m.id}" title="${esc(`Spustí hned souboje, které ${m.jmeno} chybí${obhajoba ? ' k obhajobě' : ' do potvrzení'}, za sebou s ukazatelem postupu`)}">⚔ Rozhodnout</button>`;
        }
        if (n) {
            const klic = klicNavrhu(n.modelkaId, Number(n.hodnoceni) || 0, n.navrh);
            navrhy.set(klic, { id: n.modelkaId, navrh: n.navrh });
            stitky += `<span class="ob-chip ob-chip-nesedi" title="${esc(`${m.jmeno} ${vetaNesouladu(n)} – možná jí patří ${kratceSrdicka(n.navrh)} ♥`)}">≠ ${esc(kratceSrdicka(n.hodnoceni))} → ${esc(kratceSrdicka(n.navrh))} ♥</span>
                <button type="button" class="link ob-dat" data-ob-navrh-ano="${klic}" title="Dát jí ${esc(kratceSrdicka(n.navrh))} ♥">Dát</button>
                <button type="button" class="link ob-nechat" data-ob-navrh-ne="${klic}" title="Nechat srdíčka, jak jsou">Nechat</button>`;
        }
        const trend = p.zmenaPoradi && o.trendDni
            ? `<span class="trend ${p.zmenaPoradi > 0 ? 'nahoru' : 'dolu'}" title="${esc(`${p.zmenaPoradi > 0 ? 'Stoupla' : 'Klesla'} o ${sklonovat(Math.abs(p.zmenaPoradi), 'místo', 'místa', 'míst')} za ${o.trendDni} dní`)}">${p.zmenaPoradi > 0 ? '▲' : '▼'}${Math.abs(p.zmenaPoradi)}</span>` : '';
        const srdicka = m.hodnoceni ? `<i>${znakySrdicek(m.hodnoceni)}</i>` : p.jenOdhad
            ? '<span class="ob-odhad-fotek" title="Zatím bez srdíček a porovnání – místo v pořadí je jen odhad podle tvého vkusu (údaje modelky a srdíčka fotek)">odhad</span>' : '<span class="ob-bez">bez srdíček</span>';
        const tridy = [p.jenOdhad ? 'ob-z-fotek' : '', ceka || obhajoba ? 'ob-ceka-radek' : '', n ? 'ob-nesedi-radek' : '', p.modelkaId === vybranaPoradi ? 'vybrana' : ''].filter(Boolean).join(' ');
        return `<li class="${tridy}" data-poradi-modelka="${m.id}"><button type="button" class="ob-radek" data-otevrit-modelku="${m.id}" title="${esc(popis)}">
            <span class="ob-misto">${p.poradi || i + 1}.</span>
            <img data-src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />
            <span class="ob-jmeno-radku"><b>${esc(m.jmeno)}</b>${srdicka}${fotky ? `<span class="ob-fotky" title="${esc(`Skóre fotek z ${sklonovat(p.albFotek, 'alba', 'alb', 'alb')} a ${sklonovat(p.fotekHodnocenych, 'hodnocené fotky', 'hodnocených fotek', 'hodnocených fotek')}`)}">${fotky}</span>` : ''}${p.zajem >= 0.05 ? '<span class="ob-zajem" title="Často otevíráš její profil nebo prohlížíš fotky – posouvá ji to v pořadí uvnitř srdíček">zájem</span>' : ''}</span>
            <span class="ob-trend-sloupec">${trend}</span>
            <span class="ob-pruh" aria-hidden="true"><i style="width:${sirka}%"></i>${nejistota ? `<b style="left:${Math.max(0, sirka - nejistota)}%; width:${Math.min(100, sirka + nejistota) - Math.max(0, sirka - nejistota)}%"></b>` : ''}</span>
            <small class="ob-pocet ${(p.porovnani || 0) < 6 ? 'malo' : ''}" title="${esc(sklonovat(p.porovnani || 0, 'porovnání', 'porovnání', 'porovnání'))}">${(p.porovnani || 0) < 6 ? `jen ${p.porovnani || 0}×` : ''}</small>
        </button><span class="ob-r-stitky">${stitky}</span></li>`;
    };
    // Oddělovače úseků (Top 10 · Top 20 · Top 50 · Top 100 · Mimo) s počtem potvrzených v úseku celého pořadí
    const potvrzenych = new Map(seskupitPodleUrovni(poradi).map(sk => [sk.uroven, sk]));
    const oddelovac = uroven => {
        const sk = potvrzenych.get(uroven);
        const pocet = uroven ? sk?.potvrzenych || 0 : sk?.polozky.length || 0;
        return `<li class="ob-uroven" data-uroven="${uroven}"><span>${uroven ? nazevUrovne(uroven) : 'Mimo Top 100'}</span><small>${!pocet ? 'zatím žádná potvrzená'
            : uroven ? `${sklonovat(pocet, 'potvrzená', 'potvrzené', 'potvrzených')}${pocet < sk.polozky.length ? ` z ${sk.polozky.length}` : ''}` : sklonovat(pocet, 'modelka', 'modelky', 'modelek')}</small></li>`;
    };
    let i = 0;
    nastavitHtml(cast('poradi'), `<ol class="ob-poradi">${seskupitPodleUrovni(ukazat).map(sk =>
        oddelovac(sk.uroven) + sk.polozky.map(p => radek(p, i++)).join('')).join('')}</ol>
        ${ukazat.length < poradi.length ? `<button type="button" class="link ob-vse" data-ob-poradi-vse>Zobrazit dalších ${Math.min(PORADI_DALSICH, poradi.length - ukazat.length)} (z ${poradi.length})</button>` : ''}`);
    nacitatPostupne(cast('poradi'));
}

const cislo = n => (Number(n) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 2 });

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
    nacitatPostupne(cast('trendy'), { root: null }); // panel je fixed: hlídá se vůči oknu
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
    nacitatPostupne(cast('tipy'), { root: null });
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
    d.vysledek = vysledek;
    historie.push(d);
    potvrditVolbu();
    porovnaneOdObnoveni.add(d.a).add(d.b);
    porovnaniDnes++;
    ulozDnes(porovnaniDnes);
    vykreslitHlavu();
    ukazatNavrhPoPorovnani(d);
    await dalsi(d);
    // Souboj na hranici úrovně se přepočte hned (úrovně a štítky v pásech ukážou výsledek), jinak po pěti porovnáních;
    // poslední souboj série „Rozhodnout teď“ přepočte a vyhodnotí dokončení série
    if (serie && !serie.vysledek && !zbyvaSerie()) dokoncitSerii();
    else if (++porovnanoOdObnoveni >= 5 || d.druh === 'souboj' || d.druh === 'overeni') obnovitPrehled();
}

// Další dvojice s krátkým přechodem: vybraná se rozzáří, obě zmizí, nové se objeví
async function dalsi(hotova) {
    const dvojice = cast('dvojice');
    dvojice.classList.add('odchazi');
    // Jen zobrazená dvojice: fronta se mohla mezitím přepsat (Rozhodnout teď, Vyzvat o trůn)
    fronta = fronta.filter(x => x !== hotova);
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
    const d = fronta[0];
    if (!d || zaneprazdneno) return;
    zaneprazdneno = true;
    zobrazitNavrhPodPasy(null);
    await dalsi(d);
    if (serie && !serie.vysledek && !zbyvaSerie()) dokoncitSerii();
}

async function vratit() {
    const posledni = historie[historie.length - 1];
    if (zaneprazdneno || !posledni) return;
    zaneprazdneno = true;
    let ok = false;
    try {
        ok = await VratitPorovnani(posledni.a, posledni.b);
    } catch { /* oznámí se níž */ }
    zaneprazdneno = false;
    if (!ok) {
        // Poslední uložené porovnání je jiné (zapomenutá oblíbenost, jiné okno): stará historie neplatí
        historie.length = 0;
        vykreslitHlavu();
        return oznamit('Poslední porovnání se nepodařilo vrátit.');
    }
    const vracena = historie.pop();
    fronta.unshift(vracena);
    // Vrácený souboj série ji znovu otevře
    if (serie?.dvojice.has(vracena)) serie.vysledek = null;
    porovnaniDnes = Math.max(0, porovnaniDnes - 1);
    ulozDnes(porovnaniDnes);
    vykreslitHlavu();
    zobrazitNavrhPodPasy(null);
    vykreslitDvojici();
    obnovitPrehled();
}

// ——— Rozhodnout teď ———
// Souboj o trůn sezóny (Síň slávy › Sezóna, „Vyzvat o trůn“): dvojice vyzyvatelky s vedoucí jde do Porovnat jako
// první; stejná dvojice čekající ve frontě se nezopakuje
export function soubojOTrun(vyzyvatelka, vudkyne) {
    if (!modelka(vyzyvatelka) || !modelka(vudkyne)) return;
    const d = { a: vyzyvatelka, b: vudkyne, duvod: 'Souboj o trůn sezóny', druh: 'sezona' };
    const ista = x => (x.a === d.a && x.b === d.b) || (x.a === d.b && x.b === d.a);
    fronta = [d, ...fronta.filter(x => !ista(x))];
    zobrazitNavrhPodPasy(null);
    ukazatCastOblibenosti('porovnat');
    vykreslitDvojici();
    nacistNahledy([d.a, d.b]).then(() => { if (fronta[0] === d) vykreslitDvojici(); });
}

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
    const vSerii = new Set(dvojice.map(klicDvojice));
    fronta = [...dvojice, ...fronta.filter(d => !vSerii.has(klicDvojice(d)))];
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
    // Během přepočtu se souboj vrátil (Vrátit): série ještě není hotová
    if (zbyvaSerie()) return vykreslitSerii();
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
    if (!await ulozitSrdicka(s.id, navrh)) return oznamit('Hodnocení se nepodařilo uložit.');
    const m = modelka(s.id);
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

    try { stav.hodnoceniPanel = localStorage.getItem('hodnoceniPanel') || ''; } catch { /* zavřený */ }
    if (!PANELY_HODNOCENI.some(([klic]) => klic === stav.hodnoceniPanel)) stav.hodnoceniPanel = '';
    pripravitHlavuHodnoceni();
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
            // Odkaz do Pořadí je upozornění na nesoulad: po přepnutí skočí na první řádek, kterému nesedí srdíčka
            const naNesoulad = pohled === 'poradi';
            if (pohled !== stav.hodnoceniPohled) ukazatCastOblibenosti(pohled);
            if (naNesoulad) cast('poradi')?.querySelector('li.ob-nesedi-radek')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        else if (e.target.closest('[data-hd-panel-zavrit]')) nastavitPanelHodnoceni('');
        else if (e.target.closest('.hd-panel [data-hd-panel]')) {
            const klic = e.target.closest('[data-hd-panel]').dataset.hdPanel;
            if (klic !== stav.hodnoceniPanel) nastavitPanelHodnoceni(klic);
        }
        else if (e.target.closest('[data-ob-preskocit]')) preskocit();
        else if (e.target.closest('[data-ob-tahle]')) vybrat(aktivniPas());
        else if (e.target.closest('[data-ob-vratit]')) vratit();
        else if (e.target.closest('[data-ob-navrh-ano]')) prijmoutNavrh(e.target.closest('[data-ob-navrh-ano]').dataset.obNavrhAno);
        else if (e.target.closest('[data-ob-navrh-ne]')) odmitnoutNavrh(e.target.closest('[data-ob-navrh-ne]').dataset.obNavrhNe);
        else if (e.target.closest('[data-ob-poradi-vse]')) { poradiLimit += PORADI_DALSICH; vykreslitPoradi(); }
        else if (e.target.closest('[data-por-dalsi]')) posunoutVyber(1, e.target.closest('[data-por-dalsi]').dataset.porDalsi === 'ceka' ? rozhoduje : nesedi);
        else if (e.target.closest('[data-por-klavesa]')) akcePoradi(e.target.closest('[data-por-klavesa]').dataset.porKlavesa);
        else if (e.target.closest('[data-ob-porovnavat]')) ukazatCastOblibenosti('porovnat');
    });

    // Pořadí: ↑↓ vybírají, Enter otevře profil vybrané, R Rozhodnout, písmena skočí na jméno; najetí myší vybere
    document.addEventListener('keydown', (e) => {
        if (!hlavaVidet() || !poradiVidet() || e.ctrlKey || e.altKey || e.metaKey || stav.zamceno || otevreneOkno() || jeVidet('lightbox')) return;
        const cil = /** @type {HTMLElement} */ (e.target);
        if (cil.closest?.('input, textarea, select, [contenteditable], [role="slider"]')) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') akcePoradi(e.key === 'ArrowDown' ? 'dolu' : 'nahoru');
        else if (e.key === 'Enter' && vybranaPoradi && !cil.closest?.('button, a')) akcePoradi('profil');
        else if ((e.key === 'r' || e.key === 'R') && vybranaPoradi) akcePoradi('rozhodnout');
        else if (e.key.length === 1 && /\p{L}/u.test(e.key) && e.key.toLowerCase() !== 'i') skocitNaJmeno(e.key);
        else return;
        e.preventDefault();
    });
    stats.addEventListener('mouseover', (e) => {
        const li = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('.ob-poradi li[data-poradi-modelka]'));
        if (li && Number(li.dataset.poradiModelka) !== vybranaPoradi && poradiVidet()) vybratVPoradi(Number(li.dataset.poradiModelka), false);
    });

    // Panel Hodnocení: I otevře naposledy otevřený (nebo zavře), Esc zavře
    document.addEventListener('keydown', (e) => {
        if (!hlavaVidet() || e.ctrlKey || e.altKey || e.metaKey || stav.zamceno || otevreneOkno() || jeVidet('lightbox')
            || /** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [contenteditable]')) return;
        if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
            e.preventDefault();
            let posledni = 'tipy';
            try { posledni = localStorage.getItem('hodnoceniPanelPosledni') || 'tipy'; } catch { /* výchozí */ }
            nastavitPanelHodnoceni(stav.hodnoceniPanel ? '' : posledni);
        } else if (e.key === 'Escape' && stav.hodnoceniPanel && !document.querySelector('.context-menu:not(.hidden), .volby-panel:not(.hidden)')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            nastavitPanelHodnoceni('');
        }
    }, true);

    // Klávesy porovnání, když je Oblíbenost vidět a nepíše se ani nehodnotí srdíčky (zaměřená srdíčka mají šipky)
    document.addEventListener('keydown', (e) => {
        if (!videt() || stav.oblibenostCast !== 'hodnoceni' || stav.hodnoceniPohled !== 'porovnat' || !fronta[0] && e.key !== 'Backspace' || e.ctrlKey || e.metaKey || e.altKey || stav.zamceno) return;
        if (e.target.closest?.('input, textarea, select, [role="slider"], [contenteditable]')) return;
        if (otevreneOkno() || jeVidet('lightbox') || jeVidet('zkratky') || jeVidet('contextMenu')) return;
        // Na zaměřeném tlačítku v Oblíbenosti dělají mezerník a Enter to, co tlačítko (jinde, třeba v liště, je mezerník remíza)
        if (e.key === 'Enter' && e.target.closest?.('button, a, [role="tab"]')) return;
        if (e.key === ' ' && e.target.closest?.('button') && koren.contains(e.target)) return;
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

    // Srdíčka změněná kdekoli: tip se ztlumí jako ohodnocený, nesoulad modelky zmizí z Nesedí (patřil ke starým
    // srdíčkům), počty se obnoví hned a pořadí po chvíli přepočtem (víc změn za sebou jeden přepočet)
    let casovacPrepoctu = 0;
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        koren?.querySelector(`[data-tip-modelky="${id}"]`)?.classList.toggle('ohodnoceno', hodnoceni > 0);
        if (!data.oblibenost) return;
        data.oblibenost.nesedi = (data.oblibenost.nesedi || []).filter(x => x.modelkaId !== id);
        vykreslitPoradi();
        vykreslitHlavu();
        clearTimeout(casovacPrepoctu);
        casovacPrepoctu = setTimeout(() => { if (koren?.isConnected) obnovitPrehled(); }, 2000);
    });
}
