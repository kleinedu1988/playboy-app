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
import { GetDvojiceKPorovnani, GetFotografieModelky, GetMohloByTeLibit, GetNahledyModelek, GetNavrhSrdicek, GetOblibenost, GetSezona, GetSoubojeModelky, PorovnatModelky, SetHodnoceni, VratitPorovnani } from './backend';
import { esc, sklonovat } from '../lib/format';
import { dnesniPocet, idDvojice, klicNavrhu, kratceSrdicka, pruhySily, skryteNavrhy, skrytNavrh, textModeluVkusu, textSrdicek, vetaNesouladu, zKolika, znakySrdicek } from '../lib/srdicka';
import { NAHLEDU_V_POROVNANI, bublinaCekani, nadpisSouboje, nazevUrovne, odkazyHodnoceni, okoliDvojice, poctyCekajicich, posunMista, postupDne, prevestCastOblibenosti, seskupitPodleUrovni, stitekObhajoby, stoupajiKlesaji, textCekajicich, textCekani, textPravidelUrovni, textSkoreFotek, textVahyZajmu, urovenModelky, vysledekOvereni, vysledekRozhodnuti } from '../lib/oblibenost';
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
import { nacistSinSlavy, nastavitPohledSlavy, obnovitHlavuSlavy, pripravitSinSlavy } from './sin-slavy';
import { hodnotitFotky, nacistGalerii, nastavitRazeniFotek, pocetNehodnocenych, pripravitGalerii, razeniFotek } from './galerie-hodnoceni';
import { nazevSezony, textZbyva } from '../lib/slava';

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
    vykreslitHlavu();
    document.querySelector('main').scrollTop = 0;
}

const nastavitZobrazeni = () => { const hd = cast('cast-hodnoceni'); if (hd) hd.dataset.hdZobrazeno = stav.hodnoceniPohled; };

// Panel Hodnocení vpravo (I): tipy, trendy a jak se počítá pořadí – jako Údaje u profilu a panel Sbírky
const PANELY_HODNOCENI = [['tipy', 'Tipy'], ['trendy', 'Trendy'], ['jak', 'Jak počítám']];
// Pohledy Pořadí v liště hlavičky: celé pořadí, čekající na rozhodnutí úrovně, nesoulady se srdíčky
const POHLEDY_PORADI = [['vse', 'Celé pořadí'], ['cekaji', 'Čekají'], ['nesedi', 'Nesedí']];
let poradiFiltr = 'vse';

// Hodnocení: tři pohledy (Porovnat, Fotky, Pořadí) a Síň slávy; přepínání částí je v liště (#pasStranky)
const KOSTRA = `
    <div class="ob-cast hd" data-ob-cast-hodnoceni>
    <div class="hd-pohled ob-porovnani" data-hd="porovnat" data-ob-porovnani>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-porovnat" data-ob-volby-porovnat
            data-stav-napoveda="Enter tahle · ←/→ listovat · ↓ obě stejně · S přeskočit · ⌫ vrátit"></div>
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
        </div>
        <div class="ob-navrh" data-ob-navrh aria-live="polite"></div>
    </div>
    <div class="hd-pohled gh" data-hd="fotky" data-ob-galerie></div>
    <div class="hd-pohled" data-hd="poradi" data-ob-cast-poradi>
        <div class="volby-v-liste" data-volby-casti="hodnoceni-poradi" data-ob-volby-poradi></div>
        <div class="ob-karta hz-rozhodnout" data-ob-rozhodnuti></div>
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
    // Fotky se načtou i ve skrytém pohledu: pilulka Fotky ukáže počet nehodnocených
    else nacistGalerii(cast('galerie'));
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
    nastavitHtml(cast('navrh'), navrh?.html || '');
}

const viditelneNesoulady = () => {
    const skryte = skryteNavrhy();
    return (data.oblibenost?.nesedi || []).filter(n => modelka(n.modelkaId) && !skryte.has(klicNavrhu(n.modelkaId, n.hodnoceni, n.navrh)));
};

// Modelky, o jejichž úrovni rozhodnou souboje: čekají na potvrzení, nebo obhajují místo (pořadí z backendu)
const rozhodujici = () => (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId) && (p.ceka || p.obhajoba));

// Pořadí › Čekají (souboje o úroveň s Rozhodnout teď) a Pořadí › Nesedí (Dát jí, Nechat, Ověřit); v Celém pořadí
// je karta skrytá a pořadí ukazuje čekající štítkem u řádku
function vykreslitRozhodnuti() {
    const karta = cast('rozhodnuti');
    cast('sekce-poradi')?.classList.toggle('hidden', poradiFiltr !== 'vse');
    karta?.classList.toggle('hidden', poradiFiltr === 'vse');
    if (!karta || poradiFiltr === 'vse') return;
    const cekajici = poradiFiltr === 'cekaji' ? rozhodujici() : [];
    const nesoulady = poradiFiltr === 'nesedi' ? viditelneNesoulady() : [];
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
    if (poradiFiltr === 'cekaji') {
        nastavitHtml(karta, `<h4>Souboje o úroveň <small>${cekajici.length ? 'potvrdí místo v Top 10 / 20 / 50 / 100 – dvojice jsou i v Porovnat napřed' : ''}</small></h4>
            ${cekajici.length ? `<ul class="hz-r-seznam">${cekajici.map(radekCekajici).join('')}</ul>` : '<p class="hz-tichy">Nic nečeká – všechna místa v úrovních jsou potvrzená.</p>'}`);
    } else {
        nastavitHtml(karta, `<h4>Nesedí se srdíčky <small>${nesoulady.length ? 'podle porovnání s modelkami s jinými srdíčky' : ''}</small></h4>
            ${nesoulady.length ? `<ul class="hz-r-seznam">${nesoulady.map(radekNesouladu).join('')}</ul>` : '<p class="hz-tichy">Srdíčka sedí s porovnáním.</p>'}`);
    }
}

// „Dát jí“: srdíčka se uloží a ukážou všude, kde modelka je; návrh zmizí pod pásy i z Nesedí se srdíčky
async function prijmoutNavrh(klic) {
    const n = navrhy.get(klic);
    if (!n) return;
    let ok = false;
    try { ok = await SetHodnoceni(n.id, n.navrh); } catch { /* oznámí se níž */ }
    if (!ok) return oznamit('Hodnocení se nepodařilo uložit.');
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
    const p = postupDne(porovnaniDnes);
    const { nCekaji, nesouladu, fotek } = poctyOblibenosti();
    const poradi = (data.oblibenost?.poradi || []).filter(x => modelka(x.modelkaId));
    const cislo = (n, text, trida = '') => `<span${trida ? ` class="${trida}"` : ''}><b>${(n || 0).toLocaleString('cs-CZ')}</b> ${esc(text)}</span>`;
    const krestni = id => String(modelka(id)?.jmeno || '').split(' ')[0];
    const avatar = id => {
        const m = modelka(id);
        return m ? `<img src="${esc(adresaTitulni(m))}" alt="" style="${stylVyrezu(m)}" draggable="false" />` : '';
    };
    const top = poradi.slice(0, 10);
    const okenkoTop = top.length ? `<button type="button" class="sh-oblast hd-okenko" data-hd-slava="top" title="Top 10 v Síni slávy">
            <span>Top 10</span><span class="hd-avatary">${top.slice(0, 5).map(x => avatar(x.modelkaId)).join('')}</span><small>1. ${esc(krestni(top[0].modelkaId))}</small></button>` : '';
    const sz = sezonaVolby;
    const vede = sz?.poradi?.find(b => b.misto === 1 && modelka(b.modelkaId));
    const okenkoSezony = sz?.dni ? `<button type="button" class="sh-oblast hd-okenko" data-hd-slava="sezona" title="Sezóna v Síni slávy">
            <span>Sezóna ${esc(nazevSezony(sz.mesic).split(' ')[0])}</span><b>${vede ? `♛ ${esc(krestni(vede.modelkaId))}` : '—'}</b><i><em style="width:${Math.round(sz.den / sz.dni * 100)}%"></em></i><small>${esc(textZbyva(sz.den, sz.dni))}</small></button>` : '';
    const cekajici = rozhodujici();
    const akce = [
        cekajici.length ? `<button type="button" class="volba akcent" data-hd-akce="rozhodnout" title="${esc(`Souboje, které rozhodnou úroveň – ${modelka(cekajici[0].modelkaId).jmeno} první`)}"><b>⚔ Rozhodnout čekající</b></button>` : '',
        fotek ? '<button type="button" class="volba" data-hd-akce="fotky"><b>Hodnotit fotky</b></button>' : '',
        fotek ? '<button type="button" class="volba" data-hd-akce="promitat" title="Prohlížeč s promítáním nehodnocených fotek"><b>▶ Promítat</b></button>' : '',
        nesouladu ? '<button type="button" class="volba" data-hd-akce="overit" title="Modelky, kterým podle porovnání nesedí srdíčka"><b>Ověřit srdíčka</b></button>' : '',
    ].join('');
    const casti = [['porovnat', 'Porovnat'], ['fotky', 'Fotky'], ['poradi', 'Pořadí']];
    const tlacitkoPohledu = (klic, nazev, zvoleny, atribut) =>
        `<button type="button" class="${klic === zvoleny ? 'on' : ''}" ${atribut}="${klic}" aria-pressed="${klic === zvoleny}">${nazev}</button>`;
    const pohledy = stav.hodnoceniPohled === 'poradi'
        ? POHLEDY_PORADI.map(([klic, nazev]) => tlacitkoPohledu(klic, nazev, poradiFiltr, 'data-hd-poradi')).join('')
        : stav.hodnoceniPohled === 'fotky'
            ? [['nahodne', 'Náhodně'], ['modelky', 'Po modelkách']].map(([klic, nazev]) => tlacitkoPohledu(klic, nazev, razeniFotek(), 'data-hd-razeni')).join('')
            : '';
    const textCekaji = nCekaji === 1 ? 'čeká' : nCekaji < 5 ? 'čekají' : 'čeká';
    return `<div class="sh-obsah">
            <div class="sh-kruh" style="--p:${Math.min(100, Math.round(p.hotovo / p.cil * 100))}" title="${esc(`Dnes ${sklonovat(p.hotovo, 'porovnání', 'porovnání', 'porovnání')} z ${p.cil}`)}"><b>${p.hotovo}/${p.cil}</b><small>dnes</small></div>
            <div class="sh-identita"><h2>Hodnocení</h2>
                <div class="sh-cisla">${cislo(poradi.length, 'v pořadí')}${cislo(poradi.filter(x => modelka(x.modelkaId).hodnoceni > 0).length, 'se srdíčky')}${cislo(fotek, `${sklonovat(fotek, 'fotka', 'fotky', 'fotek').replace(/^\S+ /, '')} bez srdíček`)}${nCekaji ? cislo(nCekaji, textCekaji, 'sh-ukoly') : ''}</div></div>
            <div class="sh-oblasti">${okenkoTop}${okenkoSezony}</div>
        </div>
        <div class="sh-akce">
            ${akce}${akce ? '<span class="sh-oddelovac" aria-hidden="true"></span>' : ''}
            ${PANELY_HODNOCENI.map(([klic, nazev]) => `<button type="button" class="volba ${stav.hodnoceniPanel === klic ? 'zapnuto' : ''}" data-hd-panel="${klic}" aria-pressed="${stav.hodnoceniPanel === klic}" title="Panel vpravo (I)">${nazev}</button>`).join('')}
        </div>
        <div class="sh-lista">
            <div class="sh-filtry" role="tablist" aria-label="Části hodnocení">${casti.map(([klic, nazev]) =>
                `<button type="button" role="tab" class="sh-filtr ${klic === stav.hodnoceniPohled ? 'on' : ''}" aria-selected="${klic === stav.hodnoceniPohled}" data-zobrazeni-prehledu="${klic}">${nazev}</button>`).join('')}<button type="button" role="tab" class="sh-filtr" aria-selected="false" data-cast-modelek-pas="slava">Síň slávy</button></div>
            <div class="sh-pohledy" role="group" aria-label="Pohled části">${pohledy}</div>
        </div>`;
}

export function obnovitHlavuHodnoceni() {
    obnovitHlavuSlavy();
    if (!hlava) return;
    const videt = hlavaVidet();
    hlava.classList.toggle('hidden', !videt);
    if (!videt) {
        document.querySelector('.navbar')?.classList.remove('hodnoceni-svinuta');
        return;
    }
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

function nastavitPoradiFiltr(klic) {
    poradiFiltr = klic;
    vykreslitRozhodnuti();
    obnovitHlavuHodnoceni();
}

function pripravitHlavuHodnoceni() {
    hlava = document.createElement('div');
    hlava.id = 'hodnoceniHlava';
    hlava.className = 'sbirka-hlava hodnoceni-hlava hidden';
    document.getElementById('albumNav')?.before(hlava);
    hlava.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const akce = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-akce]'))?.dataset.hdAkce;
        const panel = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-panel]'));
        const slava = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-slava]'));
        const filtr = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-poradi]'));
        const razeni = /** @type {HTMLElement | null} */ (cil.closest('[data-hd-razeni]'));
        if (panel) nastavitPanelHodnoceni(panel.dataset.hdPanel);
        else if (filtr) nastavitPoradiFiltr(filtr.dataset.hdPoradi);
        else if (razeni) nastavitRazeniFotek(razeni.dataset.hdRazeni);
        else if (slava) {
            // Okénko Top 10 / Sezóna: Síň slávy na tom pohledu
            nastavitPohledSlavy(slava.dataset.hdSlava);
            /** @type {HTMLElement | null} */ (hlava.querySelector('[data-cast-modelek-pas="slava"]'))?.click();
        } else if (akce === 'rozhodnout') {
            const prvni = rozhodujici()[0];
            if (prvni) rozhodnoutTed(prvni.modelkaId);
        } else if (akce === 'fotky' || akce === 'promitat') {
            if (stav.hodnoceniPohled !== 'fotky') ukazatCastOblibenosti('fotky');
            hodnotitFotky(akce === 'promitat');
        } else if (akce === 'overit') {
            if (stav.hodnoceniPohled !== 'poradi') ukazatCastOblibenosti('poradi');
            nastavitPoradiFiltr('nesedi');
        }
    });
    const navbar = document.querySelector('.navbar');
    const main = document.querySelector('main');
    main?.addEventListener('scroll', () => {
        if (hlava.classList.contains('hidden')) return;
        if (main.scrollTop > 60) navbar.classList.add('hodnoceni-svinuta');
        else if (main.scrollTop < 20) navbar.classList.remove('hodnoceni-svinuta');
    }, { passive: true });
}

// ——— Vykreslení ———

export function poctyOblibenosti() {
    const poradi = (data.oblibenost?.poradi || []).filter(p => modelka(p.modelkaId));
    const cekaji = poctyCekajicich(poradi);
    const nCekaji = Number(data.oblibenost?.cekajicich) || cekaji.reduce((s, [, n]) => s + n, 0);
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

// Volby pohledu Porovnat v liště (#volbyPrehledu): dnešní počet porovnání a případný odkaz na čekající položku
function vykreslitVolbyPorovnat() {
    const misto = cast('volby-porovnat');
    if (!misto) return;
    const p = postupDne(porovnaniDnes);
    const { cekaji, nCekaji, nesouladu, fotek, pocty } = poctyOblibenosti();
    const odkaz = odkazyHodnoceni({ pohled: 'porovnat', cekaji, celkem: nCekaji, nesouladu, fotek })[0];
    const htmlOdkazu = odkaz
        ? `<button type="button" data-hd-pohled="${odkaz.pohled}" title="${esc(pocty[odkaz.pohled][1])}">${esc(odkaz.text)} · ${esc(odkaz.akce)} →</button>`
        : '';
    // Vrátit poslední porovnání (zrcadlí se vpravo do stavové lišty, klik jde na skryté tlačítko → obsluha data-ob-vratit)
    const posledni = historie[historie.length - 1];
    const krestni = id => String(modelka(id)?.jmeno || '?').split(' ')[0];
    const htmlVratit = posledni
        ? `<button type="button" data-ob-vratit title="Vrátit poslední porovnání (Backspace)">↶ Vrátit: ${esc(posledni.vysledek === 'b' ? `${krestni(posledni.b)} > ${krestni(posledni.a)}`
            : `${krestni(posledni.a)} ${posledni.vysledek === 'remiza' ? '=' : '>'} ${krestni(posledni.b)}`)}</button>`
        : '';
    const vede = sezonaVolby?.poradi?.find(b => b.misto === 1 && modelka(b.modelkaId));
    const textSezony = sezonaVolby?.dni ? ` · ♛ Sezóna: ${vede ? `vede ${krestni(vede.modelkaId)}` : 'nikdo nevede'}, ${textZbyva(sezonaVolby.den, sezonaVolby.dni)}` : '';
    nastavitHtml(misto, `${htmlOdkazu}${htmlVratit}<span title="${esc(p.hotovo ? `Dnes ${sklonovat(p.hotovo, 'porovnání', 'porovnání', 'porovnání')} – do ${p.cil} zbývá ${p.zbyva}` : 'Dnes zatím žádné porovnání')}">Dnes ${p.hotovo} z ${p.cil}${esc(textSezony)}</span>`);
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

// Obnoví počty v pilulkách Oblíbenosti (#pasStranky) a volby pohledu Porovnat (#volbyPrehledu)
// Hlavičku, kapsli a stavovou lištu obnoví prehled.js po události volby-prehledu; víc změn v jednom snímku jedna obnova
let hlavaNaplanovana = false;
function vykreslitHlavu() {
    vykreslitVolbyPorovnat();
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
    cast('ovladani').querySelector('[data-ob-vratit]')?.toggleAttribute('disabled', !historie.length);
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
    const { cekaji, nCekaji, nesouladu, fotek } = poctyOblibenosti();
    const casti = [sklonovat(poradi.length, 'modelka', 'modelky', 'modelek')];
    if (nCekaji) casti.push(`${nCekaji} ${nCekaji === 1 ? 'čeká' : nCekaji < 5 ? 'čekají' : 'čeká'}`);
    if (nesouladu) casti.push(`${nesouladu} nesedí`);
    const odkaz = odkazyHodnoceni({ pohled: 'poradi', cekaji, celkem: nCekaji, nesouladu, fotek })[0];
    return (odkaz ? `<button type="button" data-hd-pohled="${odkaz.pohled}">${esc(odkaz.text)} · ${esc(odkaz.akce)} →</button>` : '')
        + `<span>${esc(casti.join(' · '))}</span>`;
}

function vykreslitPoradi() {
    const o = data.oblibenost;
    const poradi = (o?.poradi || []).filter(p => modelka(p.modelkaId));
    nastavitText(cast('vaha'), o && poradi.length ? textVahyZajmu(o) : '');
    // Celé pořadí s úrovněmi (Top 10 je v Síni slávy); pohledy Celé · Čekají · Nesedí jsou v liště hlavičky
    nastavitHtml(cast('volby-poradi'), htmlStavuPoradi(poradi));
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
    vykreslitTrendy(poradi, o);
    // Čekající na potvrzení úrovně ukazuje hlavička Hodnocení (odkaz do Porovnávání, kde jsou dvojice o potvrzení
    // napřed); pravidla úrovní nenápadně pod seznamem
    nastavitText(cast('pravidla'), poradi.length ? textPravidelUrovni(o?.urovne) : '');
    // Pořadí dávají srdíčka už bez porovnání; prázdné je jen bez hodnocených modelek
    if (!poradi.length) {
        nastavitHtml(cast('poradi'), htmlPrazdna('Pořadí vznikne z porovnávání', 'Po pár porovnáních tu uvidíš, které modelky máš nejradši – jemněji, než ukážou srdíčka.', { ikona: 'hvezda' }));
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
            // Odkaz do Pořadí je upozornění na nesoulad srdíček: otevře Pořadí › Nesedí
            if (pohled === 'poradi') poradiFiltr = 'nesedi';
            if (pohled !== stav.hodnoceniPohled) ukazatCastOblibenosti(pohled);
            if (pohled === 'poradi') nastavitPoradiFiltr(poradiFiltr);
        }
        else if (e.target.closest('[data-hd-panel-zavrit]')) nastavitPanelHodnoceni('');
        else if (e.target.closest('.hd-panel [data-hd-panel]')) {
            const klic = e.target.closest('[data-hd-panel]').dataset.hdPanel;
            if (klic !== stav.hodnoceniPanel) nastavitPanelHodnoceni(klic);
        }
        else if (e.target.closest('[data-ob-preskocit]')) preskocit();
        else if (e.target.closest('[data-ob-vratit]')) vratit();
        else if (e.target.closest('[data-ob-navrh-ano]')) prijmoutNavrh(e.target.closest('[data-ob-navrh-ano]').dataset.obNavrhAno);
        else if (e.target.closest('[data-ob-navrh-ne]')) odmitnoutNavrh(e.target.closest('[data-ob-navrh-ne]').dataset.obNavrhNe);
        else if (e.target.closest('[data-ob-poradi-vse]')) { poradiVse = true; vykreslitPoradi(); }
        else if (e.target.closest('[data-ob-porovnavat]')) ukazatCastOblibenosti('porovnat');
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

    // Srdíčka změněná kdekoli: tip se ztlumí jako ohodnocený, pořadí ukáže nová srdíčka při příštím obnovení
    document.addEventListener('hodnoceni-modelky', (e) => {
        const { id, hodnoceni } = /** @type {CustomEvent} */ (e).detail;
        koren?.querySelector(`[data-tip-modelky="${id}"]`)?.classList.toggle('ohodnoceno', hodnoceni > 0);
    });
}
