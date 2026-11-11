// Údržba v Přehledu: co sbírce chybí nebo co je potřeba zkontrolovat, ve třech režimech pod jednořádkovou
// hlavičkou (úplnost, počty, přepínač). „Po údajích“ (udrzba-udaje.js): jeden údaj, všechny modelky, kterým chybí,
// píše se rovnou do řádků. „Po modelkách“ (udrzba-fokus.js): jedna modelka se všemi úkoly na kartě a vpravo
// fronta. „Souhrn“ (tady): pokrok sbírky po oblastech, panel učení a celá fronta skupin (modelka nebo číslo)
// s bočním seznamem filtrů, hledáním, řazením a hromadnými akcemi; sbalený řádek ukáže jen souhrn (nejvýš tři
// štítky a hlavní akci), rozbalený jednotlivé položky – chybějící údaj, nález kontroly, návrh – s jejich akcemi.
// Data a priority počítá lib/udrzba.js; tady je vykreslení na místě (mění se jen skupiny, které se změnily,
// stránka se neposune a fokus zůstane), klávesnice, nabídky a akce.
import { GetStavyVydani, SetNetykaSe, SetNetykaSeAlba, SetStavVydani } from './backend';
import { esc, nazevVydani, sklonovat } from '../lib/format';
import { MEZ_JISTE, NAZVY_PRIORIT, OBLASTI_FILTRU, SKUPINY_UDAJU, filtrovatUdrzbu, podtitulek, procent, sestavitPoUdajich, souhrnFronty, sestavitUdrzbu, slovoJistoty, stitkySkupiny, textAkce, idCileSlouceni, tridaJistoty, udajFiltru, zalozkaPole, zdrojePolozek } from '../lib/udrzba';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { searchInput, stats } from './prvky';
import { nastavitViditelnostHledani } from './navigace';
import { jeVidet, nastavitHtml, otevreneOkno, srovnatSeznam } from '../ui/dom';
import { BEZ_FOTKY, adresaTitulni } from './obrazky';
import { nacistFotkyModelky, otevritDetailModelky } from './profil';
import { otevritCoverModal } from './cover';
import { otevritModelModal, ukazatZalozku, zameritPole } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold } from './formular-alba';
import { otevritDoplneni } from './doplneni';
import { otevritVydani } from './vydani';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { oznamit } from '../ui/oznameni';
import * as navrhy from './navrhy';
import * as uceni from './uceni';
import * as fokus from './udrzba-fokus';
import * as poUdajich from './udrzba-udaje';
import * as stejne from './udrzba-stejne';
import * as zWebu from './udrzba-web';
import * as fotkyUd from './udrzba-fotky';
import * as dnesUd from './udrzba-dnes';
import { exportovatData, importovatData, prejmenovatVeSbirce, sloucitModelku, zkontrolovatSoubory } from './sprava';
import * as zdravi from './zdravi';
import { otevritRychlePridani } from './formular-modelky';
import { potvrditRozdil } from '../ui/hromadne';
import { REZIMY_UKOLU, STRANKY_SBIRKY, strankaSbirky } from '../lib/stranky-sbirky';

// Skupin na stránku; další se přidají při doscrollování na konec (nebo tlačítkem)
const STRANKA = 60;
const IKONA = obsah => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${obsah}</svg>`;
const IKONA_CISLA = IKONA('<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>');
const IKONA_HLEDANI = IKONA('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>');
const IKONA_HOTOVO = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>';

// Odložení položky podle druhu: [akce, vrácení, stav odložené]
const ODLOZENI = {
    ukol: ['Netýká se', 'Znovu sledovat', 'netýká se'],
    kontrola: ['V pořádku', 'Znovu kontrolovat', 'v pořádku'],
    navrh: ['Odmítnout', 'Znovu nabízet', 'odmítnuto'],
    cislo: ['Nezajímá mě', 'Znovu sledovat', 'nezajímá mě'],
};
const druhOdlozeni = (x, s) => s.druh === 'vydani' ? 'cislo' : x.druh;
// Režimy Údržby: Dnes je stránka Přehled, ostatní jsou režimy stránky Úkoly (lib/stranky-sbirky.js)
const REZIMY = [
    ['dnes', 'Přehled', 'Jak je sbírka doplněná, krátká dávka toho nejcennějšího (asi 30 úkolů ≈ 15 minut), pokrok dne a co běží na pozadí'],
    ...REZIMY_UKOLU,
];
const KOSTRA = `
    <div class="ud" data-ud-kostra>
        <!-- Režim (Po údajích, Po modelkách, Souhrn) je zobrazení v liště pod hledáním, jako Obálky / Kalendář u Čísel -->
        <div class="volby-v-liste" data-volby-casti="udrzba" data-ud="rezimy" data-stitek="Sbírka" data-nadpis="Údržba"></div>
        <div class="ud-dnes hidden" data-ud="dnes"></div>
        <div class="ud-rezim-obsah hidden" data-ud="udaje"></div>
        <div class="ud-fokus hidden" data-ud="fokus"></div>
        <div class="ud-stejne hidden" data-ud="stejne"></div>
        <div class="ud-web hidden" data-ud="web"></div>
        <div class="ud-fotky hidden" data-ud="fotky"></div>
        <div class="ud-souhrn hidden" data-ud="souhrn">
        <div class="ud-hlava">
            <section class="ud-karta ud-pokrok" data-ud="pokrok" aria-label="Pokrok sbírky"></section>
            <section class="ud-karta ud-uceni hidden" data-ud="uceni" aria-label="Co se program naučil"></section>
        </div>
        <section class="ud-karta ud-zdravi" data-ud="zdravi" aria-label="Zdraví sbírky"></section>
        <div class="ud-telo" data-ud="seznam">
            <nav class="ud-bok" data-ud="bok" aria-label="Co ukázat"></nav>
            <div class="ud-hlavni">
                <!-- Hledání ve frontě je hlavní hledání nahoře, řazení a Vyřízené jsou pod ním (ui/volby.js) -->
                <div class="ud-nastroje">
                    <div class="ud-uzke" data-ud="uzke"></div>
                    <button type="button" class="ud-nastroj" data-ud-hromadne aria-haspopup="menu" title="Rozbalit nebo sbalit vše, hromadné akce pro celý výběr, přejmenovat fotografa nebo tag v celé sbírce">⋯ Hromadně</button>
                </div>
                <div data-ud="lista"></div>
                <div class="ud-fronta" data-ud="fronta" role="tree" aria-label="Fronta údržby"></div>
                <div data-ud="pata"></div>
                <div class="ud-konec" data-ud-konec aria-hidden="true"></div>
            </div>
        </div>
        </div>
    </div>`;

let data = null; // { p, stavy } z posledního načtení Přehledu
let model = null; // sestavitUdrzbu
let udaje = null; // sestavitPoUdajich (Po údajích, výběr údaje v Po modelkách)
let nacist = async () => {}; // celé načtení Přehledu (prehled.js)
let uceniRozbaleno = false;
// Rozbalení skupin: výchozí podle filtru (Kontrola a Návrhy rozbalené), přepnuté skupiny a „rozbalit/sbalit vše“
const prepnute = new Map();
const vseRozbaleno = new Map();
const vychoziRozbaleni = filtr => vseRozbaleno.get(filtr) ?? (filtr === 'navrhy' || filtr === 'kontrola');
const jeRozbalena = klic => vychoziRozbaleni(stav.udrzbaFiltr) !== Boolean(prepnute.get(stav.udrzbaFiltr)?.has(klic));
// Aktivní řádek pro klávesnici (jediný s tabindex 0)
let aktivniRadek = '';

const sekce = () => /** @type {HTMLElement} */ (stats.querySelector('[data-sekce="udrzba"]'));
const cast = jmeno => /** @type {HTMLElement} */ (sekce()?.querySelector(`[data-ud="${jmeno}"]`));
const oblast = () => document.querySelector('main');
const udrzbaVidet = () => !stats.classList.contains('hidden') && stav.prehledSekce === 'udrzba';
const vSouhrnu = () => stav.udrzbaRezim === 'souhrn';
const modelkaSkupiny = s => s.druh === 'modelka' ? stav.prehledModelky.get(s.id) : null;
// Podtitulek modelky (kategorie, první číslo) se počítá až pro vykreslenou skupinu; modelky se po načtení mění celé
const podtitulky = new WeakMap();
function podtitulekSkupiny(s) {
    const m = modelkaSkupiny(s);
    if (!m) return s.podtitulek || '';
    if (!podtitulky.has(m)) podtitulky.set(m, podtitulek(m));
    return podtitulky.get(m);
}

// Data z načtení Přehledu; přepočítá frontu (a řádky pro Doplnit modelku a „Uložit a další“)
export function nastavitData({ p, stavy }) {
    data = { p, stavy };
    // Sbírka se mohla změnit (smazané nebo přesunuté fotky): Stejné fotky se načtou znovu, až budou vidět
    stejne.zastarat();
    zWebu.zastarat();
    fotkyUd.zastarat();
    dnesUd.zastarat();
    return prepocitat();
}

function prepocitat() {
    model = sestavitUdrzbu({ p: data.p, modelky: [...stav.prehledModelky.values()], navrhy: navrhy.seznamNavrhu(),
        skryte: stav.prehledSkryte, odmitnute: stav.prehledSkryte, razeni: stav.udrzbaRazeni });
    udaje = sestavitPoUdajich(model);
    stav.prehledRadky = model.radkyModelek;
    stav.prehledPoradi = model.radkyModelek.map(r => r.id);
    stav.prehledAlba = model.alba;
    return model;
}

// Fronta pro „Uložit a další“: modelky z údržby, kterým chybí právě tento údaj, zafixované při otevření
const frontaPro = klic => stav.prehledRadky.filter(r => !r.netyka.has(klic)
    && (klic === 'titulni' ? r.chybi.has('titulni') : (r.udaje?.[['zakladni', 'vzhled', 'zarazeni'].indexOf(klic)] || []).length > 0)).map(r => r.id);

// ——— Vykreslení ———

// Úkoly se všude počítají stejně: jednotlivé otevřené položky; řádků fronty (modelek a čísel) je méně
const cislo0 = (/** @type {number} */ n) => (n || 0).toLocaleString('cs-CZ');
export const popisUkolu = () => (model ? `${cislo0(model.ukolu)} ${sklonovat(model.ukolu, 'úkol', 'úkoly', 'úkolů').replace(/^\S+ /, '')} u ${model.sUkoly.toLocaleString('cs-CZ')} ${model.sUkoly === 1 ? 'modelky nebo čísla' : 'modelek a čísel'}` : '');
export const pocetUkolu = () => model?.ukolu || 0;

// Stav Údržby vpravo v plovoucím pásu Sbírky (prehled.js): úplnost a počty, stejné ve všech režimech
export function htmlStavu() {
    if (!model) return '';
    const casti = [sklonovat(model.ukolu, 'úkol', 'úkoly', 'úkolů').replace(/^\d+/, `<b>${cislo0(model.ukolu)}</b>`)];
    if (model.kKontrole) casti.push(`<b>${model.kKontrole}</b> ke kontrole`);
    if (model.navrhu) casti.push(sklonovat(model.navrhu, 'návrh', 'návrhy', 'návrhů').replace(/^(\d+)/, '<b>$1</b>'));
    return `<span class="pas-kapsle pas-info" title="Sbírka doplněná na ${model.uplnost} % (průměr oblastí v Souhrnu)"><b>${model.uplnost} %</b> doplněno · ${casti.join(' · ')}</span>`;
}

function htmlPokroku() {
    const skupiny = new Map();
    model.pokrok.forEach(o => skupiny.set(o.skupina, [...(skupiny.get(o.skupina) || []), o]));
    return `
        <div class="ud-celek" style="--p:${model.uplnost}" title="Průměr všech oblastí vpravo">
            <b>${model.uplnost} %</b><span>sbírky<br>doplněno</span></div>
        <div class="ud-oblasti">${[...skupiny].map(([nazev, oblasti]) => `
            <div class="ud-oblast"><h5>${nazev}</h5>${oblasti.map(o => {
                const p = o.celkem ? Math.round(o.hotovo / o.celkem * 100) : 100;
                return `<button type="button" class="ud-oblast-radek ${o.chybi ? '' : 'hotovo'} ${o.filtr === stav.udrzbaFiltr ? 'on' : ''}" data-udrzba-filtr="${o.filtr}"
                    title="${esc(`${o.hotovo} z ${o.celkem}${o.jednotka ? ` ${o.jednotka}` : ''}${o.chybi ? ` · chybí ${o.chybi}` : ' · hotovo'} – klik ukáže jen tyto úkoly`)}">
                    <span>${o.nazev}</span><i><b style="width:${p}%"></b></i><small>${o.chybi ? `${p} %` : '✓'}</small></button>`;
            }).join('')}</div>`).join('')}
            ${model.kKontrole || model.navrhu ? `<div class="ud-oblast ud-oblast-dalsi">
                ${model.kKontrole ? `<button type="button" class="ud-oblast-radek" data-udrzba-filtr="kontrola"><span>Ke kontrole</span><em>${model.kKontrole}</em></button>` : ''}
                ${model.navrhu ? `<button type="button" class="ud-oblast-radek" data-udrzba-filtr="navrhy"><span>Návrhy doplnění</span><em>${model.navrhu}</em></button>` : ''}
            </div>` : ''}
        </div>`;
}

export function obrazekSkupiny(s, trida = '') {
    if (s.druh === 'vydani') return `<span class="ud-obalka ${trida}">${IKONA_CISLA}</span>`;
    const m = modelkaSkupiny(s);
    return `<img class="${trida}" src="${esc(m ? adresaTitulni(m, trida === 'uf-foto') : BEZ_FOTKY)}" alt="" loading="lazy" draggable="false" />`;
}

// Zdroje návrhů nebo nálezů pod aktivním filtrem (Návrhy, Ke kontrole)
function zdrojeFiltru() {
    const filtr = stav.udrzbaFiltr;
    if (filtr !== 'navrhy' && filtr !== 'kontrola') return [];
    return zdrojePolozek(model, filtr).map(z => ({ ...z, popis: filtr === 'kontrola' ? uceni.popisZdroje(z.zdroj) : z.popis }));
}

// Boční seznam filtrů po oblastech; pod aktivním filtrem jeho zdroje (Vyřízené jsou filtr pod hledáním)
function htmlBoku() {
    const filtr = stav.udrzbaFiltr;
    const zdroje = zdrojeFiltru();
    const htmlZdroju = zdroje.length > 1 || stav.udrzbaZdroj ? `<div class="ud-bok-zdroje" role="group" aria-label="Zdroj">
        ${[{ zdroj: '', popis: 'Všechny zdroje', pocet: model.pocty[filtr] }, ...zdroje].map(z => `<button type="button" class="ud-bok-radek ud-bok-zdroj ${z.zdroj === stav.udrzbaZdroj ? 'on' : ''}"
            data-ud-zdroj="${esc(z.zdroj)}" aria-pressed="${z.zdroj === stav.udrzbaZdroj}"><span>${esc(z.popis)}</span><b>${z.pocet}</b></button>`).join('')}</div>` : '';
    return OBLASTI_FILTRU.map(o => `<h5>${o.nazev}</h5>${o.filtry.map(([klic, nazev, popis]) => {
        const pocet = model.pocty[klic];
        return `<button type="button" class="ud-bok-radek ${klic === filtr ? 'on' : ''} ${pocet ? '' : 'prazdny'}" data-udrzba-filtr="${klic}" aria-pressed="${klic === filtr}"${popis ? ` title="${esc(popis)}"` : ''}>
            <span>${nazev}</span><b>${pocet || (klic === 'vse' ? 0 : '✓')}</b></button>${klic === filtr ? htmlZdroju : ''}`;
    }).join('')}`).join('');
}

// V úzkém okně místo bočního seznamu výběr filtru (a zdroje)
function htmlUzke() {
    const filtr = stav.udrzbaFiltr;
    const zdroje = zdrojeFiltru();
    return `<select data-ud-vyber-filtru aria-label="Co ukázat">${OBLASTI_FILTRU.map(o => `<optgroup label="${o.nazev}">${o.filtry.map(([klic, nazev]) =>
        `<option value="${klic}" ${klic === filtr ? 'selected' : ''}>${nazev} (${model.pocty[klic]})</option>`).join('')}</optgroup>`).join('')}</select>
        ${zdroje.length > 1 || stav.udrzbaZdroj ? `<select data-ud-vyber-zdroje aria-label="Zdroj"><option value="">Všechny zdroje</option>${zdroje.map(z =>
        `<option value="${esc(z.zdroj)}" ${z.zdroj === stav.udrzbaZdroj ? 'selected' : ''}>${esc(z.popis)} (${z.pocet})</option>`).join('')}</select>` : ''}`;
}

// Pod lištou jen výsledek hledání
function htmlListy(vybrane) {
    if (!stav.udrzbaHledat) return '';
    return `<div class="ud-lista"><span>Hledání „${esc(stav.udrzbaHledat)}“: ${sklonovat(vybrane.length, 'výsledek', 'výsledky', 'výsledků')} · <button type="button" class="link" data-ud-zrusit-hledani>zrušit</button></span></div>`;
}

function htmlPolozky(x, s) {
    const druh = druhOdlozeni(x, s);
    const [odlozit, vratit, odlozeno] = ODLOZENI[druh];
    let meta = '';
    if (x.druh === 'navrh') {
        const p = procent(x.jistota);
        const trida = tridaJistoty(x.jistota);
        meta = `<span class="nv-jistota ${trida}" title="Jistota ${p} %: ${navrhy.VYSVETLENI_JISTOTY[trida]}"><i><b style="width:${p}%"></b></i><span>${p} %</span> ${slovoJistoty(x.jistota)}</span>`;
    } else if (x.druh === 'kontrola') {
        meta = x.zdroj ? `<span class="ud-zdroj" title="Odkud nález pochází">${esc(uceni.popisZdroje(x.zdroj))}</span>` : '';
    } else if (!x.netyka) {
        meta = `<span class="ud-priorita ${x.uroven}">${NAZVY_PRIORIT[x.uroven]}</span>`;
    }
    const duvod = [x.album, x.zdrojPopis && `✦ ${x.zdrojPopis}`, x.duvod].filter(Boolean).join(' · ');
    const akce = x.netyka
        ? `<span class="nv-stav">${odlozeno}</span><button type="button" class="nv-tlacitko" data-ud-akce="vratit" tabindex="-1" title="${vratit}">Vrátit</button>`
        : `<button type="button" class="nv-tlacitko nv-prijmout" data-ud-akce="hlavni" tabindex="-1" title="${textAkce(x, s)} (Enter)">${textAkce(x, s)}</button>
           ${x.druh === 'navrh' ? '<button type="button" class="nv-tlacitko" data-ud-akce="upravit" tabindex="-1" title="Otevřít formulář s předvyplněnou hodnotou (E)">Upravit…</button>' : ''}
           <button type="button" class="nv-tlacitko nv-odmitnout" data-ud-akce="odlozit" tabindex="-1" title="${odlozit} (Delete)">${odlozit}</button>`;
    return `<div class="ud-polozka ${x.druh} ${x.netyka ? 'netyka' : ''}" data-radek="${esc(x.klic)}" data-polozka="${esc(x.klic)}" tabindex="-1" role="treeitem" aria-level="2"
        aria-label="${esc(`${x.pole}: ${x.hodnota}${x.netyka ? `, ${odlozeno}` : x.druh === 'navrh' ? `, ${procent(x.jistota)} %` : ''}`)}">
        <span class="ud-pole">${x.druh === 'kontrola' ? '⚠ ' : x.druh === 'navrh' ? '✦ ' : ''}${esc(x.pole)}</span>
        <div class="ud-obsah"><strong class="ud-hodnota">${esc(x.hodnota)}</strong>${duvod ? `<small class="ud-duvod">${esc(duvod)}</small>` : ''}</div>
        <div class="ud-meta">${meta}</div>
        <div class="ud-akce">${akce}<button type="button" class="ud-vice" data-ud-vice tabindex="-1" title="Další akce" aria-label="Další akce">⋯</button></div>
    </div>`;
}

// Štítek souhrnu v řádku: štítek jedné položky ji otevře, štítek s počtem jen popisuje (klik rozbalí řádek)
function htmlStitku(st) {
    const kratky = st.text.length > 48 ? `${st.text.slice(0, 46)}…` : st.text;
    return st.polozka
        ? `<button type="button" class="ud-chip ${st.druh}" data-polozka="${esc(st.polozka)}" tabindex="-1" title="${esc(`${st.text} – klik otevře, pravým tlačítkem další akce`)}">${esc(kratky)}</button>`
        : `<span class="ud-chip ${st.druh}" title="${esc(`${st.text} – rozbal řádek pro jednotlivé položky`)}">${esc(kratky)}</span>`;
}

// Skupina záměrně nemá data-modelka ani data-vydani: obecná obsluha odkazů v main (prohlizec.js) by každým
// klikem do řádku otevřela profil nebo číslo
function htmlSkupiny(s, polozky) {
    const rozbalena = jeRozbalena(s.klic);
    const hlavni = polozky.find(x => !x.netyka);
    const aktivnich = polozky.filter(x => !x.netyka).length;
    return `<section class="ud-skupina ${rozbalena ? 'rozbalena' : ''} ${hlavni ? '' : 'vyrizena'}" data-klic="${esc(s.klic)}">
        <div class="ud-radek ud-hlavicka" data-radek="${esc(s.klic)}" tabindex="-1" role="treeitem" aria-level="1" aria-expanded="${rozbalena}"
            aria-label="${esc(`${s.jmeno}: ${aktivnich ? sklonovat(aktivnich, 'položka', 'položky', 'položek') : 'vyřízeno'}`)}">
            <button type="button" class="ud-sipka" data-ud-rozbalit tabindex="-1" title="${rozbalena ? 'Sbalit (←)' : 'Rozbalit (→)'}" aria-hidden="true"></button>
            ${obrazekSkupiny(s)}
            <div class="ud-jmeno"><button type="button" class="ud-odkaz" data-ud-otevrit tabindex="-1" title="${s.druh === 'vydani' ? 'Otevřít číslo' : 'Otevřít profil'}"><strong>${esc(s.jmeno)}</strong></button>
                <small>${s.uroven === 'vysoka' && hlavni ? '<i class="ud-tecka vysoka" aria-hidden="true"></i>' : ''}${esc(podtitulekSkupiny(s))}</small></div>
            <div class="ud-chybi">${stitkySkupiny(polozky).map(htmlStitku).join('')}</div>
            <div class="ud-akce">${hlavni ? `<button type="button" class="ud-doplnit" data-polozka="${esc(hlavni.klic)}" data-ud-akce="hlavni" tabindex="-1" title="${esc(`${textAkce(hlavni, s)}: ${hlavni.pole}`)}">${textAkce(hlavni, s)}</button>` : ''}
                <button type="button" class="ud-vice" data-ud-vice tabindex="-1" title="Další akce" aria-label="Další akce">⋯</button></div>
        </div>
        ${rozbalena ? `<div class="ud-polozky" role="group">${polozky.map(x => htmlPolozky(x, s)).join('')}</div>` : ''}
    </section>`;
}

function htmlPaty(vybrane, ukazano) {
    if (vybrane.length > ukazano) {
        return `<p class="stat-note ud-dalsi">Zobrazeno ${ukazano} z ${vybrane.length}. <button type="button" class="link" data-ud-dalsi>Zobrazit dalších ${Math.min(STRANKA, vybrane.length - ukazano)}</button></p>`;
    }
    if (vybrane.length) return '';
    if (stav.udrzbaHledat) return `<div class="nv-prazdne">${IKONA_HLEDANI}<p>Nic neodpovídá hledání „${esc(stav.udrzbaHledat)}“. <button type="button" class="link" data-ud-zrusit-hledani>Zrušit hledání</button></p></div>`;
    if (stav.udrzbaFiltr === 'navrhy') {
        return `<div class="nv-prazdne"><span class="nv-hvezda" aria-hidden="true">✦</span><p>${navrhy.navrhyNedostupne() ? 'Návrhy teď nejde načíst.'
            : navrhy.maNavrhy() ? 'Všechny návrhy jsou odmítnuté. Zapni „Vyřízené“ a vrať, co chceš znovu nabízet.'
                : 'Teď není co navrhnout. Program navrhuje chybějící údaje, které umí odvodit z ostatních modelek ve sbírce (třeba národnost z místa narození nebo velikost prsou z měr). Čím víc údajů je vyplněno, tím víc toho navrhne.'}</p></div>`;
    }
    return `<div class="ud-hotovo">${IKONA_HOTOVO}<p>${model.pocty.vse ? 'V tomhle filtru nic nezbývá.' : 'Vše je doplněné a zkontrolované.'}</p></div>`;
}

// Položky skupin ve výběru (filtr, zdroj, hledání)
const vyber = () => filtrovatUdrzbu(model, { filtr: stav.udrzbaFiltr, zdroj: stav.udrzbaZdroj, hledat: stav.udrzbaHledat, razeni: stav.udrzbaRazeni });
const navrhyVyberu = vybrane => vybrane.flatMap(v => v.polozky).filter(x => x.druh === 'navrh' && !x.netyka).map(x => x.navrh);

// Kostra se vytvoří jednou; části se pak přepisují jen při změně (ui/dom.js), fronta po skupinách
function zajistitKostru() {
    const s = sekce();
    if (!s) return null;
    if (!s.querySelector('[data-ud-kostra]')) {
        s.innerHTML = KOSTRA;
        pozorovatKonec(s.querySelector('[data-ud-konec]'));
    }
    return s;
}

// ——— Hlavička Sbírky (jeden panel v hlavičce okna jako u profilu modelky) ———
// Kruh doplnění, klíčová čísla, oblasti (Modelky / Alba / Čísla), řádek akcí a lišta: filtry fronty a pohledy Údržby.
// Po odrolování se panel plynule zmenší na jeden řádek a lišta zůstane pod ním.
let hlava = null;
function htmlHlavySbirky() {
    const p = data?.p || {};
    const skupiny = new Map();
    model.pokrok.forEach(o => skupiny.set(o.skupina, [...(skupiny.get(o.skupina) || []), o]));
    const oblasti = [...skupiny].map(([nazev, seznam]) => {
        const sObsahem = seznam.filter(o => o.celkem > 0);
        const procento = sObsahem.length ? Math.round(sObsahem.reduce((x, o) => x + o.hotovo / o.celkem, 0) / sObsahem.length * 100) : 100;
        const chybi = seznam.reduce((x, o) => x + o.chybi, 0);
        return `<div class="sh-oblast" title="${esc(seznam.map(o => `${o.nazev}: ${o.hotovo} z ${o.celkem}`).join('\n'))}">
            <span>${nazev}</span><b>${procento} %</b><i><em style="width:${procento}%"></em></i><small>${chybi ? `${chybi} chybí` : 'hotovo'}</small></div>`;
    }).join('');
    const cislo = (n, a, b, c) => `<span><b>${(n || 0).toLocaleString('cs-CZ')}</b> ${sklonovat(n || 0, a, b, c).replace(/^\S+ /, '')}</span>`;
    const filtr = stav.udrzbaFiltr;
    // V jedné řadě s oblastí v názvu, aby se Centerfold modelek a čísel nepletl
    const NAZVY_V_LISTE = { text: 'Texty alb', alba: 'Vydání alb', cover: 'Cover čísel', cfcisla: 'Centerfold čísel' };
    const vUdrzbe = true;
    const stranka = strankaSbirky(stav);
    const pilulky = vUdrzbe && vSouhrnu() ? OBLASTI_FILTRU.flatMap(o => o.filtry).filter(([klic]) => klic === 'vse' || klic === filtr || model.pocty[klic])
        .map(([klic, nazev, popis]) => `<button type="button" class="sh-filtr ${klic === filtr ? 'on' : ''}" data-sh-filtr="${klic}"${(klic === 'vse' ? `Řádky fronty: ${popisUkolu()}` : popis) ? ` title="${esc(klic === 'vse' ? `Řádky fronty: ${popisUkolu()}` : popis)}"` : ''}>${esc(NAZVY_V_LISTE[klic] || nazev)}<small>${model.pocty[klic] || 0}</small></button>`).join('') : '';
    return `<div class="sh-obsah">
            <div class="sh-kruh" style="--p:${model.uplnost}" title="Sbírka doplněná na ${model.uplnost} % (průměr oblastí)"><b>${model.uplnost} %</b><small>doplněno</small></div>
            <div class="sh-identita"><h2>Sbírka</h2>
                <div class="sh-cisla">${cislo(p.modelek, 'modelka', 'modelky', 'modelek')}${cislo(p.alb, 'album', 'alba', 'alb')}${cislo(p.fotek, 'fotka', 'fotky', 'fotek')}${cislo(p.vydani, 'číslo', 'čísla', 'čísel')}
                    <button type="button" class="sh-ukoly" data-sbirka-stranka="ukoly" title="${esc(popisUkolu())} – otevřít Úkoly"><b>${cislo0(model.ukolu)}</b> ${sklonovat(model.ukolu, 'úkol', 'úkoly', 'úkolů').replace(/^\S+ /, '')}</button></div></div>
            <div class="sh-oblasti">${oblasti}</div>
        </div>
        <div class="sh-akce">
            <nav class="sh-stranky" role="tablist" aria-label="Stránky Sbírky">${STRANKY_SBIRKY.map(x =>
                `<button type="button" role="tab" class="${x.klic === stranka ? 'on' : ''}" aria-selected="${x.klic === stranka}" data-sbirka-stranka="${x.klic}" title="${esc(x.klic === 'ukoly' ? `${x.popis}\n${popisUkolu()}` : x.popis)}">${esc(x.nazev)}${x.klic === 'ukoly' && model.ukolu ? ` <small>${cislo0(model.ukolu)}</small>` : ''}</button>`).join('')}</nav>
            <button type="button" class="volba sh-akce-tl" data-sh-akce="nabidka" aria-haspopup="menu" title="Přidat, importovat, exportovat, zkontrolovat soubory"><b>Akce</b> <i aria-hidden="true">▾</i></button>
        </div>
        ${stranka === 'ukoly' ? `<div class="sh-lista">
            <div class="sh-pohledy" role="group" aria-label="Režim úkolů">${REZIMY_UKOLU.map(([klic, nazev, popis]) =>
                `<button type="button" class="${klic === stav.udrzbaRezim ? 'on' : ''}" data-sh-rezim="${klic}" title="${esc(popis)}">${esc(nazev)}</button>`).join('')}</div>
            <div class="sh-filtry" role="group" aria-label="Co ukázat ve frontě">${pilulky}${htmlZdrojuHlavy(vUdrzbe)}</div>
        </div>` : ''}`;
}

// Zdroje návrhů nebo nálezů (u filtru Návrhy a Ke kontrole) jako menší pilulky za filtry
function htmlZdrojuHlavy(vUdrzbe) {
    const zdroje = vUdrzbe && vSouhrnu() ? zdrojeFiltru() : [];
    if (!(zdroje.length > 1 || stav.udrzbaZdroj)) return '';
    return `<span class="sh-zdroje" role="group" aria-label="Zdroj">${[{ zdroj: '', popis: 'Všechny zdroje', pocet: model.pocty[stav.udrzbaFiltr] }, ...zdroje].map(z =>
        `<button type="button" class="sh-zdroj ${z.zdroj === stav.udrzbaZdroj ? 'on' : ''}" data-sh-zdroj="${esc(z.zdroj)}" aria-pressed="${z.zdroj === stav.udrzbaZdroj}">${esc(z.popis)}<small>${z.pocet}</small></button>`).join('')}</span>`;
}

// Hlavička je vidět v celé Sbírce (Údržba, Mapa čísel, Sháním CZ); volá se po vykreslení Údržby
// a po každém přepnutí pohledu nebo části (navigace.js, prehled.js)
const sbirkaVidet = () => !stats.classList.contains('hidden') && stav.rezim === 'prehled' && stav.prehledSekce !== 'oblibenost';
export function obnovitHlavuSbirky() {
    if (!hlava) return;
    const videt = sbirkaVidet() && Boolean(model);
    hlava.classList.toggle('hidden', !videt);
    if (!videt) {
        document.querySelector('.navbar')?.classList.remove('sbirka-svinuta');
        return;
    }
    nastavitHtml(hlava, htmlHlavySbirky());
}

function pripravitHlavuSbirky() {
    hlava = document.createElement('div');
    hlava.id = 'sbirkaHlava';
    hlava.className = 'sbirka-hlava hidden';
    document.getElementById('albumNav')?.before(hlava);
    hlava.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const filtr = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-filtr]'));
        const rezim = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-rezim]'));
        const akce = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-akce]'));
        const zdroj = /** @type {HTMLElement | null} */ (cil.closest('[data-sh-zdroj]'));
        if (filtr) nastavitFiltr(filtr.dataset.shFiltr);
        else if (zdroj) nastavitFiltr(stav.udrzbaFiltr, zdroj.dataset.shZdroj);
        else if (rezim) nastavitRezim(rezim.dataset.shRezim);
        // Stránky Sbírky (data-sbirka-stranka) přepíná prehled.js obsluhou na dokumentu
        else if (akce?.dataset.shAkce === 'nabidka') {
            e.stopPropagation();
            const r = akce.getBoundingClientRect();
            otevritKontextovouNabidku(r.left, r.bottom + 6, [
                { text: 'Přidat modelku…', akce: otevritRychlePridani },
                { text: 'Přidat centerfold…', akce: () => pridatCenterfold() },
                { text: 'Přidat cover…', akce: () => otevritCoverModal() },
                null,
                { text: 'Importovat…', akce: importovatData },
                { text: 'Exportovat…', akce: exportovatData },
                { text: 'Zkontrolovat soubory', akce: zkontrolovatSoubory },
            ]);
        }
    });
    const navbar = document.querySelector('.navbar');
    oblast().addEventListener('scroll', () => {
        if (hlava.classList.contains('hidden')) return;
        const odrolovano = oblast().scrollTop;
        if (odrolovano > 60) navbar.classList.add('sbirka-svinuta');
        else if (odrolovano < 20) navbar.classList.remove('sbirka-svinuta');
    }, { passive: true });
}

// Celá Údržba (po načtení Přehledu a po změně dat): hlavička a zvolený režim
export function vykreslit() {
    if (!model || !zajistitKostru()) return;
    obnovitHlavuSbirky();
    nastavitHtml(cast('rezimy'), htmlVoleb());
    ['dnes', 'udaje', 'fokus', 'stejne', 'fotky', 'web', 'souhrn'].forEach(jmeno => cast(jmeno).classList.toggle('hidden', jmeno !== { dnes: 'dnes', udaje: 'udaje', modelky: 'fokus', stejne: 'stejne', fotky: 'fotky', web: 'web', souhrn: 'souhrn' }[stav.udrzbaRezim]));
    if (stav.udrzbaRezim === 'dnes') {
        dnesUd.zobrazit(cast('dnes'));
    } else if (stav.udrzbaRezim === 'udaje') {
        poUdajich.zobrazit(cast('udaje'));
        poUdajich.vykreslit();
    } else if (stav.udrzbaRezim === 'modelky') {
        if (!fokus.otevreny()) fokus.otevrit(cast('fokus'), '', { zamerit: false });
        else fokus.vykreslit();
    } else if (stav.udrzbaRezim === 'stejne') {
        stejne.zobrazit(cast('stejne'));
    } else if (stav.udrzbaRezim === 'fotky') {
        fotkyUd.zobrazit(cast('fotky'));
    } else if (stav.udrzbaRezim === 'web') {
        zWebu.zobrazit(cast('web'));
    } else {
        nastavitHtml(cast('pokrok'), htmlPokroku());
        zdravi.vykreslit(cast('zdravi'), { vse: model.ukolu, kKontrole: model.kKontrole, navrhu: model.navrhu });
        const htmlU = uceni.htmlUceni({ rozbaleno: uceniRozbaleno, zdroj: stav.udrzbaFiltr === 'navrhy' ? stav.udrzbaZdroj : '' });
        cast('uceni').classList.toggle('hidden', !htmlU);
        cast('pokrok').parentElement.classList.toggle('bez-uceni', !htmlU);
        nastavitHtml(cast('uceni'), htmlU);
        vykreslitSeznam();
    }
    vykreslitStrankuUceni();
    // Volba režimu v liště pod hledáním (prehled.js)
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
}

// Stránka Sbírka › Učení (co se program naučil): plní se při každém vykreslení Údržby, v jakémkoli režimu
// (dřív jen ve Frontě – z Přehledu byla stránka prázdná)
function vykreslitStrankuUceni() {
    const misto = /** @type {HTMLElement | null} */ (stats.querySelector('[data-sbirka-uceni]'));
    if (!misto) return;
    const htmlU = uceni.htmlUceni({ rozbaleno: uceniRozbaleno, zdroj: stav.udrzbaFiltr === 'navrhy' ? stav.udrzbaZdroj : '' });
    nastavitHtml(misto, htmlU || '<p class="prazdno-male">Program se zatím nic nenaučil. Každé přijetí, odmítnutí a oprava návrhu zpřesní další návrhy.</p>');
}

// Volby pod hledáním (skrytý řádek štítků, ui/volby.js): režim; v Souhrnu i řazení fronty a filtr Vyřízené
const RAZENI_FRONTY = [['priorita', 'podle priority'], ['chybi', 'nejvíc chybí'], ['oblibenost', 'oblíbené napřed'], ['jmeno', 'podle jména']];
function htmlVoleb() {
    const stitek = (atribut, klic, nazev, zvoleny, titulek = '') => `<button type="button" class="chip ${zvoleny ? 'active' : ''}" ${atribut}="${klic}"${titulek ? ` title="${esc(titulek)}"` : ''}>${esc(nazev)}</button>`;
    const rezimy = REZIMY.map(([klic, nazev, popis]) => stitek('data-ud-rezim', klic, nazev, klic === stav.udrzbaRezim, popis));
    // Srdíčka modelek nejsou úkol Údržby: odkaz do Hodnocení › Hodnotit › Modelky (vpravo ve stavové liště)
    const bezSrdicek = (data?.p?.bezHodnoceni || []).length;
    const odkaz = bezSrdicek ? `<button type="button" data-ud-hodnotit-modelky data-stav-priorita="3" title="Hodnocení › Hodnotit › Modelky">♥ ${esc(sklonovat(bezSrdicek, 'modelka', 'modelky', 'modelek'))} bez srdíček · Hodnotit →</button>` : '';
    // Úplnost a počty jsou v hlavičce Sbírky, stavová lišta je neopakuje
    if (!vSouhrnu()) return rezimy.join('') + odkaz;
    return [...rezimy,
        ...RAZENI_FRONTY.map(([klic, nazev]) => stitek('data-ud-razeni-volba', klic, nazev, klic === stav.udrzbaRazeni)),
        stitek('data-ud-skryte', '1', `Vyřízené${stav.prehledSkryte && model.vyrizenych ? ` (${model.vyrizenych})` : ''}`, stav.prehledSkryte,
            'Ukázat i položky označené „netýká se“, „v pořádku“ a odmítnuté návrhy, aby šly vrátit'), odkaz].join('');
}

// Hledání ve frontě Souhrnu je hlavní hledání nahoře (ulozeni.js, naseptavac.js); ostatní režimy hledají modelku
export const hledaniVeFronte = () => udrzbaVidet() && vSouhrnu();
let casovacFronty = null;
export function hledatVeFronte(text) {
    clearTimeout(casovacFronty);
    casovacFronty = setTimeout(() => {
        if (stav.udrzbaHledat === text.trim()) return;
        stav.udrzbaHledat = text.trim();
        stav.prehledLimit = STRANKA;
        vykreslitSeznam();
    }, 120);
}

// Přepnutí režimu (zapamatuje se); z Po modelkách s rozepsanými změnami se nejdřív zeptá.
// klicSkupiny: Po modelkách rovnou na této skupině (S nebo ⋯ v Souhrnu).
export async function nastavitRezim(rezim, klicSkupiny = '') {
    if (!REZIMY.some(([k]) => k === rezim)) return;
    if (rezim !== stav.udrzbaRezim && stav.udrzbaRezim === 'modelky' && !await fokus.zavrit()) return;
    stav.udrzbaRezim = rezim;
    try {
        localStorage.setItem('udrzbaRezim', rezim);
        // Stránka Úkoly se příště otevře v naposledy použitém režimu úkolů (lib/stranky-sbirky.js)
        if (rezim !== 'dnes') localStorage.setItem('udrzbaRezimUkolu', rezim);
    } catch { /* jen se nezapamatuje */ }
    if (!model) return;
    if (rezim === 'modelky') {
        cast('fokus').classList.remove('hidden');
        fokus.otevrit(cast('fokus'), klicSkupiny);
    }
    vykreslit();
}

// Boční seznam, lišta a fronta (filtr, hledání, řazení, rozbalení); fronta se mění po skupinách
function vykreslitSeznam() {
    if (!model || !zajistitKostru() || !vSouhrnu()) return;
    // Zdroj, který ve filtru už nic nemá, se zruší
    if (stav.udrzbaZdroj && !zdrojePolozek(model, stav.udrzbaFiltr).some(z => z.zdroj === stav.udrzbaZdroj)) stav.udrzbaZdroj = '';
    const vybrane = vyber();
    const ukazat = vybrane.slice(0, stav.prehledLimit);
    const html = {
        bok: htmlBoku(), uzke: htmlUzke(), lista: htmlListy(vybrane), pata: htmlPaty(vybrane, ukazat.length),
        fronta: ukazat.map(({ skupina, polozky }) => ({ klic: skupina.klic, html: htmlSkupiny(skupina, polozky) })),
    };
    // Nejdřív se přečte poloha (stránka je ještě beze změn, čtení nevynutí rozvržení navíc), pak se zapisuje
    zachovatPolohu(() => {
        ['bok', 'uzke', 'lista', 'pata'].forEach(jmeno => nastavitHtml(cast(jmeno), html[jmeno]));
        srovnatSeznam(cast('fronta'), html.fronta);
    });
}

// Překreslení bez skoku: kotvou je zaměřený řádek, jinak první viditelný; fokus zůstane na řádku se stejným
// klíčem, a když zmizel (vyřízený), na řádku, který nastoupil na jeho místo
function zachovatPolohu(fn, fokusKlic = null) {
    const fronta = cast('fronta');
    const radky = () => /** @type {HTMLElement[]} */ ([...fronta.querySelectorAll('[data-radek]')]);
    const aktivni = /** @type {HTMLElement} */ (document.activeElement);
    const vFronte = fronta.contains(aktivni);
    const fokusRadek = vFronte ? /** @type {HTMLElement} */ (aktivni.closest('[data-radek]')) : null;
    const pred = radky();
    const kde = fokusRadek ? pred.indexOf(fokusRadek) : -1;
    // Vyřízená položka předá fokus další položce ve skupině (nebo její hlavičce), i když se skupina přesunula
    const skupinaFokusu = fokusRadek?.closest('.ud-skupina')?.dataset.klic;
    const kdeVeSkupine = fokusRadek ? [...fokusRadek.closest('.ud-skupina').querySelectorAll('[data-radek]')].indexOf(fokusRadek) : -1;
    const horni = oblast().getBoundingClientRect().top + 60;
    const kotva = fokusRadek || pred.find(r => r.getBoundingClientRect().bottom > horni);
    const kotvaKlic = kotva?.dataset.radek;
    const kotvaY = kotva?.getBoundingClientRect().top;
    fn();
    const najit = klic => klic && /** @type {HTMLElement} */ (fronta.querySelector(`[data-radek="${CSS.escape(klic)}"]`));
    const nova = najit(kotvaKlic);
    if (nova) oblast().scrollTop += nova.getBoundingClientRect().top - kotvaY;
    const po = radky();
    if ((vFronte || fokusKlic) && !fronta.contains(document.activeElement)) {
        const skupina = skupinaFokusu && fronta.querySelector(`.ud-skupina[data-klic="${CSS.escape(skupinaFokusu)}"]`);
        const veSkupine = skupina ? [...skupina.querySelectorAll('[data-radek]')] : [];
        const cil = najit(fokusKlic ?? fokusRadek?.dataset.radek) || veSkupine[Math.min(kdeVeSkupine, veSkupine.length - 1)]
            || po[Math.min(Math.max(kde, 0), po.length - 1)];
        if (cil) {
            aktivniRadek = cil.dataset.radek;
            cil.focus({ preventScroll: true });
        }
    }
    obnovitTabIndex(po);
}

// Do fronty vede Tab jen jednou: aktivní řádek má tabindex 0, ostatní -1 (šipky chodí po řádcích)
function obnovitTabIndex(radky = [...cast('fronta').querySelectorAll('[data-radek]')]) {
    const cil = radky.find(r => /** @type {HTMLElement} */ (r).dataset.radek === aktivniRadek) || radky[0];
    radky.forEach(r => { if (r !== cil && r.getAttribute('tabindex') === '0') r.setAttribute('tabindex', '-1'); });
    cil?.setAttribute('tabindex', '0');
}

// Po akci: přepočet z místních dat, překreslení na místě a po chvíli klidu nové načtení z backendu.
// Akce dobíhá asynchronně (backend); když mezitím uživatel drží tlačítko myši na další položce, překreslí se až po
// puštění a kliknutí – WebKitGTK by klik zahodil, kdyby se řádek pod kurzorem vyměnil mezi stisknutím a puštěním.
let odlozenePrekresleni = null;
function poZmene(fokusKlic = null) {
    if (!model) return;
    prepocitat();
    if (mysDole) {
        odlozenePrekresleni = { fokusKlic };
        naplanovatNacteni();
        return;
    }
    prekreslitPoZmene(fokusKlic);
    naplanovatNacteni();
}

function prekreslitPoZmene(fokusKlic) {
    if (!model) return;
    if (sekce()?.querySelector('[data-ud-kostra]')) {
        vykreslit();
        // Fokus, který zmizel s překresleným tlačítkem (akce z nabídky nebo oznámení), se vrátí na řádek
        const aktivni = document.activeElement;
        if (fokusKlic && udrzbaVidet() && vSouhrnu() && (!aktivni || aktivni === document.body)) {
            const klic = model.podleKlice.has(fokusKlic) ? fokusKlic : [...model.podleKlice.keys()].find(k => k.endsWith(`|n:${fokusKlic}`));
            if (klic) zachovatPolohu(() => {}, klic);
        }
    }
}

// Puštění tlačítka myši (i mimo okno nebo zrušené stisknutí): odložené překreslení až po události click
function pustitMys() {
    mysDole = false;
    if (!odlozenePrekresleni) return;
    setTimeout(() => {
        const odlozene = odlozenePrekresleni;
        odlozenePrekresleni = null;
        if (odlozene && !mysDole) prekreslitPoZmene(odlozene.fokusKlic);
        else if (odlozene) odlozenePrekresleni = odlozene;
    });
}

let casovacNacteni = null;
let mysDole = false;
function naplanovatNacteni() {
    clearTimeout(casovacNacteni);
    casovacNacteni = setTimeout(() => {
        if (stats.classList.contains('hidden') || otevreneOkno()) return;
        // Načtení nesmí vyměnit tlačítko mezi stisknutím a puštěním myši (WebKitGTK by klik zahodil)
        if (mysDole) return naplanovatNacteni();
        nacist();
    }, 1500);
}

// Stránkování: konec fronty ve viditelné části přidá další skupiny
let pozorovatel = null;
function pozorovatKonec(prvek) {
    if (typeof IntersectionObserver === 'undefined') return;
    pozorovatel?.disconnect();
    pozorovatel = new IntersectionObserver((zaznamy) => {
        if (!zaznamy.some(z => z.isIntersecting) || !udrzbaVidet() || !model) return;
        if (vyber().length > stav.prehledLimit) {
            stav.prehledLimit += STRANKA;
            vykreslitSeznam();
        }
    }, { root: oblast(), rootMargin: '0px 0px 600px 0px' });
    pozorovatel.observe(prvek);
}

// Řádek „Co zbývá doplnit“ na úvodu Přehledu: údaj v Po údajích, když k filtru patří; Souhrn zůstane s filtrem
export function otevritNaFiltru(filtr) {
    if (filtr === 'vse' || !model) return;
    const klic = udajFiltru(udaje, filtr);
    if (klic && stav.udrzbaRezim !== 'souhrn') {
        poUdajich.ukazatUdaj(klic);
        nastavitRezim('udaje');
    } else nastavitFiltr(filtr);
}

// Filtr fronty v Souhrnu (boční seznam, pokrok)
export function nastavitFiltr(filtr, zdroj = '') {
    stav.udrzbaFiltr = filtr;
    stav.udrzbaZdroj = zdroj;
    stav.prehledLimit = STRANKA;
    if (!model) return;
    vykreslit();
}

// ——— Akce ———

const najitPolozku = klic => model?.podleKlice.get(klic);

// Hlavní akce položky (Doplnit, Opravit, Přijmout, Přidat cover…); u alb jde zvolit album (Po modelkách)
async function hlavniAkce(x, s, zvoleneAlbum = null) {
    if (s.druh === 'vydani') {
        // Vydání je dané, u centerfoldu se vybírá jen modelka
        if (x.id === 'cover') otevritCoverModal(null, s.vydani);
        else pridatCenterfold(s.vydani);
        return;
    }
    const modelka = modelkaSkupiny(s);
    if (!modelka) return;
    if (x.akce === 'prijmout') return navrhy.prijmout(x.navrh);
    if (x.akce === 'titulni') {
        otevritModelModal(modelka, { zalozka: 0, klic: 'titulni', ids: frontaPro('titulni') });
        document.getElementById('inputDriveID').focus();
    } else if (x.akce === 'udaje') {
        // Formulář se otevře na části skupiny, s kurzorem v prvním chybějícím poli
        const zalozka = SKUPINY_UDAJU[x.skupinaUdaju].zalozka;
        otevritModelModal(modelka, { zalozka, klic: x.netykaKlic, ids: frontaPro(x.netykaKlic) });
        ukazatZalozku(zalozka);
        if (x.chybejici[0]) zameritPole(x.chybejici[0][2]);
    } else if (x.akce === 'centerfold') {
        otevritAlbumModal(modelka, null, { typ: 'Centerfold' });
        document.getElementById('selectAlbumMesic').focus();
    } else if (x.akce === 'hodnoceni') {
        otevritDetailModelky(modelka);
    } else if (x.akce === 'opravit') {
        // Kandidát na sloučení (0.02.033): náhled sloučení této modelky do starší („… jako X (id N)“)
        const cilSlouceni = idCileSlouceni(x.nalez);
        if (cilSlouceni) {
            const cil = (await vsechnyModelky()).find(m => m.id === cilSlouceni);
            if (cil) return sloucitModelku(cil, modelka);
        }
        // Údaj se opraví ve formuláři modelky (část a pole nálezu), alba a fotky v profilu
        const pole = x.nalez.pole;
        if (!pole) return otevritDetailModelky(modelka);
        otevritModelModal(modelka);
        ukazatZalozku(zalozkaPole(pole));
        zameritPole(pole);
    } else {
        // První album, kterému text nebo vydání chybí, se otevře k úpravě v profilu modelky
        const cil = zvoleneAlbum || x.alba.find(a => !a.netykaSe) || x.alba[0];
        await otevritDetailModelky(modelka);
        await nacistFotkyModelky(modelka.id);
        const album = cil && stav.aktualniAlba.find(a => a.album === cil.album && a.typ === cil.typ);
        if (!album) return;
        otevritAlbumModal(modelka, album);
        document.getElementById(x.akce === 'popis' ? 'inputAlbumPopis' : 'selectAlbumMesic').focus();
    }
}

// Zápis odložení do backendu a do místních dat (přepočet bez čekání na nové načtení); vrací, zda se povedlo
async function zapsatOdlozeni(x, s, ano) {
    if (s.druh === 'vydani') {
        // Číslo, které mám nebo sháním, nesmí přijít o svůj stav kvůli chybějícímu coveru
        const soucasny = ((await GetStavyVydani()) || []).find(st => st.vydani === s.vydani)?.stav;
        if (ano && (soucasny === 'mam' || soucasny === 'shanim')) {
            oznamit(`${nazevVydani(s.vydani)} je označené „${soucasny === 'mam' ? 'mám výtisk' : 'sháním'}“; „nezajímá mě“ by ten stav přepsalo, proto zůstává.`);
            return null;
        }
        if (!await SetStavVydani(s.vydani, ano ? 'nezajima' : '')) return false;
        if (ano) {
            data.p.vydaniBezCoveru = (data.p.vydaniBezCoveru || []).filter(v => v !== s.vydani);
            data.p.vydaniBezCenterfoldu = (data.p.vydaniBezCenterfoldu || []).filter(v => v !== s.vydani);
        }
        return true;
    }
    // Místní data se změní jen podle toho, co backend opravdu uložil (jinak by položka zmizela a po načtení se vrátila)
    if (x.druh === 'kontrola') {
        const u = x.nalez;
        // Nález u alba: „V pořádku“ patří tomu albu, jinak modelce
        const ok = u.album ? await SetNetykaSeAlba(u.modelkaId, u.album, u.typ, u.klic, ano) : await SetNetykaSe(u.modelkaId, u.klic, ano);
        if (!ok) return false;
        u.netykaSe = ano;
        return true;
    }
    if (x.netykaKlic === 'text' || x.netykaKlic === 'vydani') {
        let vse = true;
        for (const a of x.alba) {
            if (await SetNetykaSeAlba(a.modelkaId, a.album, a.typ, x.netykaKlic, ano)) a.netykaSe = ano;
            else vse = false;
        }
        return vse;
    }
    if (!await SetNetykaSe(s.id, x.netykaKlic, ano)) return false;
    const m = stav.prehledModelky.get(s.id);
    if (m) {
        const klice = new Set((m.netykaSe || '').split(',').filter(Boolean));
        if (ano) klice.add(x.netykaKlic);
        else klice.delete(x.netykaKlic);
        m.netykaSe = [...klice].join(',');
    }
    return true;
}

// Netýká se / V pořádku / Odmítnout / Nezajímá mě (ano = true), nebo vrácení (ano = false); jde vrátit z oznámení.
// tise: bez oznámení (Po údajích oznamuje samo); vrací, zda se povedlo (null = nic se nestalo, oznámí se proč).
async function odlozit(x, s, ano = true, { tise = false } = {}) {
    if (x.druh === 'navrh') return ano ? navrhy.odmitnout(x.navrh) : navrhy.vratitOdmitnuti([x.navrh]);
    const [akce, vratit] = ODLOZENI[druhOdlozeni(x, s)];
    let ok = false;
    try {
        ok = await zapsatOdlozeni(x, s, ano);
    } catch { /* oznámí se níž */ }
    if (ok === null) return null;
    if (!ok) {
        if (!tise) oznamit(ano ? `${akce} se nepodařilo uložit.` : 'Nepodařilo se vrátit.');
        // Část se mohla uložit (víc alb najednou): fronta se srovná podle backendu
        naplanovatNacteni();
        return false;
    }
    if (s.druh === 'vydani' && !ano) {
        // Vrácené číslo se do fronty dostane jen novým načtením
        await nacist();
        return true;
    }
    poZmene(x.klic);
    if (tise) return true;
    if (ano) oznamit(`${akce}: ${s.jmeno} – ${x.pole}.`, { text: 'Vrátit', akce: () => odlozit(x, s, false) });
    else oznamit(`${vratit}: ${s.jmeno} – ${x.pole}.`);
    return true;
}

// Hromadné akce pro výběr (filtr, zdroj, hledání) – vždy pro všechny položky výběru, i nezobrazené
function hromadneAkce() {
    if (!model) return [];
    const filtr = stav.udrzbaFiltr;
    const vybrane = vyber();
    const polozky = vybrane.flatMap(v => v.polozky.filter(x => !x.netyka).map(x => ({ x, s: v.skupina })));
    if (!polozky.length) return [];
    const akce = [];
    const navrhyV = navrhyVyberu(vybrane);
    if (navrhyV.length) {
        const jiste = navrhyV.filter(n => n.jistota >= MEZ_JISTE);
        if (jiste.length) akce.push({ text: `Přijmout jisté návrhy (≥ 90 %) · ${jiste.length}`, akce: () => navrhy.prijmoutVice(jiste, 'Přijmout jisté návrhy (≥ 90 %)?') });
        if (filtr === 'navrhy') {
            akce.push({ text: `Přijmout všechny návrhy výběru · ${navrhyV.length}`, akce: () => navrhy.prijmoutVice(navrhyV) });
            akce.push({ text: `Odmítnout všechny návrhy výběru · ${navrhyV.length}`, akce: () => navrhy.odmitnoutVice(navrhyV), nebezpecne: true });
        }
    }
    if (filtr !== 'vse' && filtr !== 'navrhy') {
        const druh = druhOdlozeni(polozky[0].x, polozky[0].s);
        const [nazev] = ODLOZENI[druh];
        const skupin = new Set(polozky.map(p => p.s.klic)).size;
        akce.push({ text: `${nazev} – ${druh === 'kontrola' ? `všem nálezům výběru · ${polozky.length}` : `celému výběru · ${skupin}`}`, akce: () => odlozitVse(polozky), nebezpecne: true });
    }
    return akce;
}

async function odlozitVse(polozky) {
    const { x, s } = polozky[0];
    const druh = druhOdlozeni(x, s);
    const [nazev, vratit] = ODLOZENI[druh];
    const skupin = new Set(polozky.map(p => p.s.klic)).size;
    const kde = druh === 'cislo' ? sklonovat(skupin, 'čísla', 'čísel', 'čísel') : sklonovat(skupin, 'modelky', 'modelek', 'modelek');
    const vysvetleni = {
        ukol: 'Tyto údaje se v Údržbě přestanou hlídat.',
        kontrola: 'Nálezy se přestanou hlásit a kontrola se z toho poučí.',
        cislo: 'Čísla dostanou stav „nezajímá mě“; čísla označená „mám výtisk“ nebo „sháním“ zůstanou, jak jsou.',
    }[druh];
    if (!await potvrditRozdil({
        nadpis: `${nazev} – ${polozky.length} ${polozky.length === 1 ? 'položka' : polozky.length < 5 ? 'položky' : 'položek'}`,
        souhrn: `Týká se ${kde} ve výběru${stav.udrzbaHledat ? ` (hledání „${stav.udrzbaHledat}“)` : ''}. ${vysvetleni}`,
        radky: polozky.map(({ x, s }) => ({ kdo: s.jmeno, co: x.pole, pred: druh === 'kontrola' ? 'hlášeno ke kontrole' : druh === 'cislo' ? 'sledované' : 'chybí', po: ODLOZENI[druh][2] })),
        tlacitko: `${nazev} (${polozky.length})`,
        poznamka: `Nic se nezmění, dokud nepotvrdíš. Vrátit to jde hned v oznámení, nebo později přes „Vyřízené“ → „${vratit}“.`,
    })) return;
    const hotove = [];
    for (const p of polozky) {
        try {
            if (await zapsatOdlozeni(p.x, p.s, true)) hotove.push(p);
        } catch { /* zůstane ve frontě */ }
    }
    poZmene();
    oznamit(`${nazev}: ${hotove.length} z ${polozky.length}.`, hotove.length ? { text: 'Vrátit', akce: async () => {
        for (const p of hotove) await zapsatOdlozeni(p.x, p.s, false).catch(() => false);
        await nacist();
        oznamit(`Vráceno ${hotove.length}.`);
    } } : null);
}

// Nabídka řádku, štítku nebo skupiny (⋯, pravé tlačítko, klávesa nabídky); vrací, zda nabídku obsloužila
export function nabidkaUdrzby(cil, x, y) {
    if (!model || !cil.closest?.('[data-sekce="udrzba"]')) return false;
    const prvekPolozky = cil.closest('[data-polozka]:not(.ud-doplnit)');
    const prvekSkupiny = cil.closest('.ud-skupina');
    if (!prvekPolozky && !prvekSkupiny) return false;
    const nalez = prvekPolozky ? najitPolozku(prvekPolozky.dataset.polozka) : null;
    const s = nalez?.skupina || model.skupiny.find(sk => sk.klic === prvekSkupiny.dataset.klic);
    if (!s) return true;
    const modelka = modelkaSkupiny(s);
    const soustredeny = s.polozky.some(p => !p.netyka) ? [{ text: 'Vyřídit po modelkách (S)', akce: () => nastavitRezim('modelky', s.klic) }] : [];
    const otevrit = s.druh === 'vydani' ? [...soustredeny, { text: `Otevřít ${nazevVydani(s.vydani)}`, akce: () => otevritVydani(s.vydani) }]
        : modelka ? [
            ...soustredeny,
            ...(stav.prehledRadky.some(r => r.id === modelka.id) ? [{ text: 'Doplnit vše v jednom okně', akce: () => otevritDoplneni(modelka.id) }] : []),
            { text: 'Upravit modelku…', akce: () => otevritModelModal(modelka) },
            { text: 'Otevřít profil', akce: () => otevritDetailModelky(modelka) },
        ] : [];
    let polozky;
    if (nalez) {
        const p = nalez.polozka;
        const [akce, vratit] = ODLOZENI[druhOdlozeni(p, s)];
        polozky = p.druh === 'navrh' ? navrhy.polozkyNabidky(p.navrh)
            : p.netyka ? [{ text: `${vratit}: ${p.pole}`, akce: () => odlozit(p, s, false) }]
                : [{ text: `${textAkce(p, s)}: ${p.pole}`, akce: () => hlavniAkce(p, s) }, { text: `${akce} – ${p.pole}`, akce: () => odlozit(p, s, true) }];
        polozky = [...polozky, null, ...otevrit];
    } else {
        const zkratit = t => t.length > 60 ? `${t.slice(0, 58)}…` : t;
        const navrhuModelky = s.polozky.filter(p => p.druh === 'navrh' && !p.netyka).length;
        polozky = [
            ...s.polozky.filter(p => p.druh !== 'navrh').map(p => {
                const [akce, vratit] = ODLOZENI[druhOdlozeni(p, s)];
                return p.netyka ? { text: `${vratit}: ${zkratit(p.pole)}`, akce: () => odlozit(p, s, false) }
                    : { text: `${akce}: ${zkratit(p.druh === 'kontrola' ? p.hodnota : p.pole)}`, akce: () => odlozit(p, s, true) };
            }),
            ...(navrhuModelky > 1 ? [{ text: `Přijmout návrhy u modelky (${navrhuModelky})`, akce: () => navrhy.prijmoutUModelky(s.id) }] : []),
            null, ...otevrit,
        ];
    }
    otevritKontextovouNabidku(x, y, polozky.filter((p, i, a) => p || (i > 0 && a[i - 1])));
    return true;
}

// Rozbalit nebo sbalit všechny skupiny filtru (nabídka Hromadně)
function rozbalitVse() {
    const f = stav.udrzbaFiltr;
    const vse = vychoziRozbaleni(f) && !prepnute.get(f)?.size;
    vseRozbaleno.set(f, !vse);
    prepnute.delete(f);
    vykreslitSeznam();
}

function prepnoutSkupinu(klic, rozbalit = null) {
    const filtr = stav.udrzbaFiltr;
    if (rozbalit !== null && jeRozbalena(klic) === rozbalit) return;
    if (!prepnute.has(filtr)) prepnute.set(filtr, new Set());
    const set = prepnute.get(filtr);
    if (set.has(klic)) set.delete(klic);
    else set.add(klic);
    aktivniRadek = klic;
    vykreslitSeznam();
    /** @type {HTMLElement} */ (cast('fronta').querySelector(`[data-radek="${CSS.escape(klic)}"]`))?.focus({ preventScroll: true });
}

// Obsluha událostí; volá ji prehled.js (nacistPrehled = celé načtení Přehledu)
export function pripravit(nacistPrehled) {
    nacist = nacistPrehled;
    navrhy.nastavitObnoveni(poZmene);
    uceni.pripravit();
    const spolecne = { model: () => model, poUdajich: () => udaje, hlavniAkce, odlozit, obrazek: obrazekSkupiny, podtitulek: podtitulekSkupiny, modelka: modelkaSkupiny };
    fokus.pripravit({ ...spolecne, nacist: () => nacist(), viditelna: () => udrzbaVidet() && stav.udrzbaRezim === 'modelky' });
    poUdajich.pripravit({ ...spolecne, viditelna: () => udrzbaVidet() && stav.udrzbaRezim === 'udaje',
        // Vyřízené v datech Přehledu (titulní fotka, srdíčka, alba) hned, bez čekání na nové načtení
        vyrizeno: (seznam = '', jeTo = (_x) => false) => {
            if (seznam && data) data.p[seznam] = (data.p[seznam] || []).filter(x => !jeTo(x));
            poZmene();
        } });
    // Upozornění na stejné fotky po vložení (ulozeni.js): Sbírka › Údržba v režimu Stejné fotky
    document.addEventListener('otevrit-rezim-udrzby', (e) => {
        const rezim = /** @type {CustomEvent} */ (e).detail;
        const tlacitko = document.createElement('button');
        tlacitko.hidden = true;
        tlacitko.dataset.zobrazeniPrehledu = 'udrzba';
        document.body.append(tlacitko);
        tlacitko.click();
        tlacitko.remove();
        nastavitRezim(rezim);
    });
    stejne.pripravit({ viditelna: () => udrzbaVidet() && stav.udrzbaRezim === 'stejne', poZmene: () => nacist() });
    fotkyUd.pripravit({ viditelna: () => udrzbaVidet() && stav.udrzbaRezim === 'fotky', poZmene: () => nacist() });
    dnesUd.pripravit({
        viditelna: () => udrzbaVidet() && stav.udrzbaRezim === 'dnes',
        model: () => model,
        otevritSkupinu: klic => nastavitRezim('modelky', klic),
        rezim: r => nastavitRezim(r),
        popisSkupiny: s => souhrnFronty(s.polozky),
    });
    zWebu.pripravit({ viditelna: () => udrzbaVidet() && stav.udrzbaRezim === 'web', poZmene: () => nacist() });
    try { stav.udrzbaRazeni = localStorage.getItem('udrzbaRazeni') || 'priorita'; } catch { /* výchozí */ }
    try { stav.udrzbaRezim = localStorage.getItem('udrzbaRezim') || 'dnes'; } catch { /* Dnes */ }
    if (!REZIMY.some(([k]) => k === stav.udrzbaRezim)) stav.udrzbaRezim = 'dnes';

    pripravitHlavuSbirky();
    stats.addEventListener('pointerdown', () => { mysDole = true; });
    document.addEventListener('pointerup', pustitMys);
    // Puštění mimo okno pointerup nepošle; bez toho by se načtení i překreslení odkládaly donekonečna
    document.addEventListener('pointercancel', pustitMys);
    window.addEventListener('blur', pustitMys);

    stats.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        if (!cil.closest('[data-sekce="udrzba"], [data-sbirka-uceni]')) return;
        const radek = /** @type {HTMLElement} */ (cil.closest('[data-radek]'));
        if (radek) {
            aktivniRadek = radek.dataset.radek;
            obnovitTabIndex();
        }
        const prvek = /** @type {HTMLElement} */ (cil.closest('[data-polozka]'));
        const nalez = prvek ? najitPolozku(prvek.dataset.polozka) : null;
        const filtr = cil.closest('[data-udrzba-filtr]');
        const zdroj = cil.closest('[data-ud-zdroj]');
        const zdrojUceni = cil.closest('[data-uceni-zdroj]');
        // Nabídka se otevírá klikem: událost nesmí dojít k dokumentu, který nabídky klikem mimo ně zavírá (nabidky.js)
        if (cil.closest('[data-ud-vice], [data-ud-hromadne]')) e.stopPropagation();
        const rezim = /** @type {HTMLElement} */ (cil.closest('[data-ud-rezim]'));
        if (rezim) {
            nastavitRezim(rezim.dataset.udRezim);
            return;
        }
        const razeni = /** @type {HTMLElement} */ (cil.closest('[data-ud-razeni-volba]'));
        if (razeni) {
            stav.udrzbaRazeni = razeni.dataset.udRazeniVolba;
            try { localStorage.setItem('udrzbaRazeni', stav.udrzbaRazeni); } catch { /* jen se nezapamatuje */ }
            prepocitat();
            vykreslit();
            return;
        }
        // Odkaz do Hodnocení › Hodnotit › Modelky: pohled se zapamatuje, část otevře obsluha pilulek (prehled.js)
        if (cil.closest('[data-ud-hodnotit-modelky]')) {
            try { localStorage.setItem('hodnotitPohled2', 'modelky'); } catch { /* jen se nezapamatuje */ }
            const b = document.createElement('button');
            b.hidden = true;
            b.dataset.zobrazeniPrehledu = 'fotky';
            document.body.append(b);
            b.click();
            b.remove();
            return;
        }
                if (cil.closest('[data-ud-skryte]')) {
            stav.prehledSkryte = !stav.prehledSkryte;
            nacist();
            return;
        }
        // Režimy Po údajích a Po modelkách mají vlastní obsluhu
        if (!cil.closest('[data-ud="souhrn"]')) return;
        if (cil.closest('[data-ud-vice]')) {
            const r = cil.closest('[data-ud-vice]').getBoundingClientRect();
            nabidkaUdrzby(cil, r.right - 240, r.bottom + 4);
        } else if (filtr) {
            nastavitFiltr(/** @type {HTMLElement} */ (filtr).dataset.udrzbaFiltr);
            /** @type {HTMLElement} */ (cast('bok').querySelector('[data-udrzba-filtr].on'))?.focus({ preventScroll: true });
        } else if (zdroj) {
            stav.udrzbaZdroj = /** @type {HTMLElement} */ (zdroj).dataset.udZdroj;
            stav.prehledLimit = STRANKA;
            vykreslit();
        } else if (zdrojUceni) {
            const klic = /** @type {HTMLElement} */ (zdrojUceni).dataset.uceniZdroj;
            nastavitFiltr('navrhy', stav.udrzbaFiltr === 'navrhy' && stav.udrzbaZdroj === klic ? '' : klic);
        } else if (cil.closest('[data-uceni-rozbalit]')) {
            uceniRozbaleno = !uceniRozbaleno;
            vykreslit();
        } else if (cil.closest('[data-uceni-zapomenout]')) {
            uceni.zapomenout().then(ok => { if (ok) nacist(); });
        } else if (cil.closest('[data-ud-hromadne]')) {
            const r = cil.closest('[data-ud-hromadne]').getBoundingClientRect();
            const vse = vychoziRozbaleni(stav.udrzbaFiltr) && !prepnute.get(stav.udrzbaFiltr)?.size;
            const akce = hromadneAkce();
            otevritKontextovouNabidku(Math.max(8, r.right - 300), r.bottom + 4, [
                { text: vse ? 'Sbalit vše' : 'Rozbalit vše', akce: rozbalitVse },
                ...(akce.length ? [null, ...akce] : []),
                // Úpravy napříč celou sbírkou (dřív v hlavní nabídce › Nastavení)
                { nadpis: 'Napříč sbírkou' },
                { text: 'Přejmenovat fotografa…', akce: () => prejmenovatVeSbirce('fotograf') },
                { text: 'Přejmenovat tag…', akce: () => prejmenovatVeSbirce('tag') },
            ]);
        } else if (cil.closest('[data-ud-dalsi]')) {
            stav.prehledLimit += STRANKA;
            vykreslitSeznam();
        } else if (cil.closest('[data-ud-zrusit-hledani]')) {
            searchInput.value = '';
            stav.udrzbaHledat = '';
            vykreslitSeznam();
            searchInput.focus();
        } else if (cil.closest('[data-ud-otevrit]')) {
            const s = model.skupiny.find(sk => sk.klic === cil.closest('.ud-skupina')?.dataset.klic);
            if (s?.druh === 'vydani') otevritVydani(s.vydani);
            else if (s && modelkaSkupiny(s)) otevritDetailModelky(modelkaSkupiny(s));
        } else if (nalez) {
            const akce = /** @type {HTMLElement} */ (cil.closest('[data-ud-akce]'))?.dataset.udAkce || 'hlavni';
            const { polozka: x, skupina: s } = nalez;
            if (akce === 'upravit') navrhy.upravit(x.navrh);
            else if (akce === 'odlozit') odlozit(x, s, true);
            else if (akce === 'vratit' || (x.netyka && akce === 'hlavni')) odlozit(x, s, false);
            else hlavniAkce(x, s);
        } else if (cil.closest('.ud-hlavicka') && !cil.closest('button')) {
            prepnoutSkupinu(radek.dataset.radek);
        } else if (cil.closest('[data-ud-rozbalit]')) {
            prepnoutSkupinu(radek.dataset.radek);
        }
    });

    stats.addEventListener('change', (e) => {
        const vyberRazeni = /** @type {HTMLSelectElement} */ (e.target);
        // Úzké okno: výběr filtru a zdroje místo bočního seznamu
        if (vyberRazeni.matches?.('[data-ud-vyber-filtru]')) return nastavitFiltr(vyberRazeni.value);
        if (vyberRazeni.matches?.('[data-ud-vyber-zdroje]')) return nastavitFiltr(stav.udrzbaFiltr, vyberRazeni.value);
    });

    // / skočí do hledání nahoře (v Souhrnu hledá ve frontě; Ctrl+F tam vede všude). ↓ nebo Enter z hledání skočí do
    // fronty
    document.addEventListener('keydown', (e) => {
        if (!hledaniVeFronte() || stav.zamceno || otevreneOkno() || jeVidet('lightbox')) return;
        const pise = /** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select');
        if (e.key === '/' && !pise && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            nastavitViditelnostHledani(true, { zamerit: true });
        } else if (e.target === searchInput && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            e.preventDefault();
            /** @type {HTMLElement} */ (cast('fronta').querySelector('[data-radek]'))?.focus();
        }
    });

    // Klávesnice ve frontě Souhrnu: ↑↓ řádky, Home/End, PageUp/PageDown, → rozbalí, ← sbalí, Enter hlavní akce,
    // mezerník rozbalí skupinu, Delete odloží položku (Netýká se, V pořádku, Odmítnout), E upraví návrh,
    // S otevře skupinu v režimu Po modelkách
    stats.addEventListener('keydown', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const radek = cil.closest?.('[data-radek]');
        if (!radek || radek !== cil || !cast('fronta')?.contains(radek) || e.ctrlKey || e.altKey || e.metaKey) return;
        const radky = /** @type {HTMLElement[]} */ ([...cast('fronta').querySelectorAll('[data-radek]')]);
        const kde = radky.indexOf(/** @type {HTMLElement} */ (radek));
        const jit = i => {
            const cilovy = radky[Math.max(0, Math.min(radky.length - 1, i))];
            if (!cilovy) return;
            aktivniRadek = cilovy.dataset.radek;
            obnovitTabIndex(radky);
            cilovy.focus();
        };
        const hlavicka = radek.classList.contains('ud-hlavicka');
        const klicSkupiny = radek.closest('.ud-skupina').dataset.klic;
        const nalez = hlavicka ? null : najitPolozku(radek.dataset.polozka);
        const s = nalez?.skupina || model.skupiny.find(sk => sk.klic === klicSkupiny);
        const posun = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[e.key];
        if (posun) {
            e.preventDefault();
            jit(kde + posun);
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            jit(e.key === 'Home' ? 0 : radky.length - 1);
        } else if (e.key === 'ArrowRight' && hlavicka) {
            e.preventDefault();
            if (!jeRozbalena(klicSkupiny)) prepnoutSkupinu(klicSkupiny, true);
            else jit(kde + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (!hlavicka) jit(radky.indexOf(radek.closest('.ud-skupina').querySelector('.ud-hlavicka')));
            else if (jeRozbalena(klicSkupiny)) prepnoutSkupinu(klicSkupiny, false);
        } else if (e.key === ' ' && hlavicka) {
            e.preventDefault();
            prepnoutSkupinu(klicSkupiny);
        } else if (e.key === 'Enter' && s) {
            e.preventDefault();
            const x = nalez?.polozka || s.polozky.find(p => !p.netyka && viditelnaVeFiltru(p));
            if (!x) return;
            if (x.netyka) odlozit(x, s, false);
            else hlavniAkce(x, s);
        } else if (e.key === 'Delete' && nalez && !nalez.polozka.netyka) {
            e.preventDefault();
            odlozit(nalez.polozka, s, true);
        } else if (e.key === 'Delete' && hlavicka && s) {
            // Skupina s jedinou položkou ve filtru ji odloží; víc položek se odkládá po jedné
            e.preventDefault();
            const aktivni = s.polozky.filter(p => !p.netyka && viditelnaVeFiltru(p));
            if (aktivni.length === 1) odlozit(aktivni[0], s, true);
            else if (aktivni.length > 1) oznamit('Skupina má víc položek: rozbal ji (→) a odlož je jednotlivě, nebo použij ⋯.');
        } else if ((e.key === 'e' || e.key === 'E') && nalez?.polozka.druh === 'navrh' && !nalez.polozka.netyka) {
            e.preventDefault();
            navrhy.upravit(nalez.polozka.navrh);
        } else if ((e.key === 's' || e.key === 'S') && s?.polozky.some(p => !p.netyka)) {
            e.preventDefault();
            nastavitRezim('modelky', s.klic);
        }
    });
}

const viditelnaVeFiltru = p => (stav.udrzbaFiltr === 'vse' || p.filtr === stav.udrzbaFiltr) && (!stav.udrzbaZdroj || p.zdroj === stav.udrzbaZdroj);
