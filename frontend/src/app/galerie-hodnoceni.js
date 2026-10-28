// Galerie (Oblíbenost › Galerie): prohlížení všech nehodnocených fotek napříč modelkami jedna po druhé s hodnocením.
// Fotku, která dostane srdíčka, fronta vynechá (hodnocené se v Galerii neobjevují) a jde se na další. Fronta je
// zamíchaná, nebo po modelkách (lib/hodnoceni.js). 1–5 ohodnotí a jde dál, ←/→ listuje, S přeskočí (pamatuje se
// i po zavření a jde na konec), mezerník spustí nebo zastaví promítání (fotka se po chvíli sama posune, nic se
// nehodnotí), Backspace vrátí poslední hodnocení. Fotky dodává GetNehodnoceneFotky; srdíčka zapisuje SetHodnoceniFotek.
import { GetNehodnoceneFotky, SetHodnoceniFotek } from './backend';
import { esc, sklonovat } from '../lib/format';
import { frontaFotek, pridatPreskocenou, srdickaKlavesy } from '../lib/hodnoceni';
import { adresaFotkyVysky } from './porovnani-pasy';
import { nastavitHtml } from '../ui/dom';
import { htmlPrazdna } from '../ui/prazdno';
import { oznamit } from '../ui/oznameni';

const KLIC_PRESKOCENYCH = 'galeriePreskocene';
const KLIC_RAZENI = 'galerieRazeni';
const KLIC_INTERVALU = 'galerieInterval';
const INTERVALY = [3, 5, 8, 12];
const NAHLEDU = 8;

let kontejner = null;
let fronta = []; // nehodnocené fotky; zobrazená je fronta[index]
let index = 0;
let celkem = 0; // nehodnocených při načtení
let ohodnoceno = []; // [{ fotka, index }] ohodnocené v tomto sezení (Vrátit)
let promitani = 0; // časovač promítání
let nacteno = false;

const cist = (klic, vychozi) => { try { return localStorage.getItem(klic) || vychozi; } catch { return vychozi; } };
const zapsat = (klic, hodnota) => { try { localStorage.setItem(klic, hodnota); } catch { /* jen pro toto spuštění */ } };
const preskocene = () => { try { return JSON.parse(cist(KLIC_PRESKOCENYCH, '[]')); } catch { return []; } };
const razeni = () => cist(KLIC_RAZENI, 'nahodne');
const interval = () => Number(cist(KLIC_INTERVALU, '5')) || 5;

// Výška fotky v pixelech obrazovky → velikost z Disku (stupně, ať se dlaždice cachují)
const velikostFotky = () => {
    const px = (kontejner?.querySelector('.gh-fotka')?.clientHeight || 900) * (window.devicePixelRatio || 1);
    return [800, 1200, 1600].find(s => px <= s * 1.05) || 2000;
};

export async function nacistGalerii(prvek) {
    kontejner = prvek;
    // Fronta se sestaví poprvé a po vyčerpání; přepnutí sem a zpět ji nezahodí (hodnocené jinde se vynechají při
    // příštím sestavení)
    if (!nacteno || index >= fronta.length) await sestavitFrontu();
    vykreslit();
}

async function sestavitFrontu() {
    let fotky = [];
    try {
        fotky = await GetNehodnoceneFotky() || [];
    } catch {
        nastavitHtml(kontejner, '<p class="ob-info">Nehodnocené fotky se nepodařilo načíst.</p>');
        return;
    }
    fronta = frontaFotek(fotky, { razeni: razeni(), seed: Date.now() % 100000, preskocene: preskocene() });
    celkem = fronta.length;
    index = 0;
    nacteno = true;
}

const aktualni = () => fronta[index];

function htmlNahledu() {
    const dalsi = fronta.slice(index + 1, index + 1 + NAHLEDU);
    return dalsi.map((f, i) => `<button type="button" class="gh-nahled" data-gh-skok="${index + 1 + i}" title="${esc(`${f.jmenoModelky} · ${f.album}`)}"><img src="${esc(adresaFotkyVysky(f, 200))}" alt="" draggable="false" loading="lazy" /></button>`).join('');
}

function vykreslit() {
    if (!kontejner) return;
    const f = aktualni();
    if (!f) {
        zastavitPromitani();
        nastavitHtml(kontejner, htmlPrazdna(celkem ? 'Všechny fotky jsou ohodnocené' : 'Žádné nehodnocené fotky',
            celkem ? `V tomhle kole ohodnoceno: ${sklonovat(ohodnoceno.length, 'fotka', 'fotky', 'fotek')}. Nové nehodnocené fotky se tu objeví, až je přidáš.` : 'Každá fotka modelek už má srdíčka. Nové fotky se tu objeví, až je přidáš.', { ikona: 'hvezda' }));
        return;
    }
    const zbyva = fronta.length - index;
    const rot = (Number(f.rotace) || 0) % 360;
    const srdicka = [1, 2, 3, 4, 5].map(h => `<button type="button" class="gh-srdce" data-gh-srdicka="${h}" title="${h} ♥ (klávesa ${h}) – uložit a dál" aria-label="${h} srdíček">♥\uFE0E</button>`).join('');
    nastavitHtml(kontejner, `
        <div class="gh-lista">
            <span class="gh-pocet"><b>${esc(sklonovat(zbyva, 'nehodnocená fotka', 'nehodnocené fotky', 'nehodnocených fotek'))}</b>${ohodnoceno.length ? ` · ohodnoceno ${ohodnoceno.length}` : ''}</span>
            <span class="gh-volby">
                <span class="gh-razeni" role="group" aria-label="Pořadí">
                    <button type="button" class="chip ${razeni() === 'nahodne' ? 'active' : ''}" data-gh-razeni="nahodne" title="Fotky všech modelek zamíchané">Náhodně</button>
                    <button type="button" class="chip ${razeni() === 'modelky' ? 'active' : ''}" data-gh-razeni="modelky" title="Fotky jedné modelky pohromadě, modelky v náhodném pořadí">Po modelkách</button>
                </span>
                <button type="button" class="chip gh-promitani ${promitani ? 'active' : ''}" data-gh-promitani title="Promítání: fotka se po chvíli sama posune (mezerník)">${promitani ? '⏸ Zastavit' : '▶ Promítat'}</button>
                <button type="button" class="chip" data-gh-interval title="Jak dlouho je fotka vidět při promítání">${interval()} s</button>
            </span>
        </div>
        <div class="gh-jeviste">
            <button type="button" class="gh-sipka" data-gh-predchozi title="Předchozí (←)" ${index ? '' : 'disabled'}>‹</button>
            <div class="gh-fotka" data-rot="${rot}"><img src="${esc(adresaFotkyVysky(f, velikostFotky()))}" alt="${esc(f.jmenoModelky)}" draggable="false" /></div>
            <button type="button" class="gh-sipka" data-gh-dalsi title="Další (→)" ${index + 1 < fronta.length ? '' : 'disabled'}>›</button>
        </div>
        <div class="gh-pod">
            <div class="gh-popis">
                <button type="button" class="link gh-jmeno" data-otevrit-modelku="${f.modelkaId}" title="Otevřít profil">${esc(f.jmenoModelky)}</button>
                <small>${esc([f.album, f.typ !== 'Pictorial' ? f.typ : '', f.fotograf].filter(Boolean).join(' · '))}</small>
            </div>
            <div class="gh-srdicka" role="group" aria-label="Srdíčka fotky">${srdicka}</div>
            <div class="gh-akce">
                <button type="button" class="link" data-gh-preskocit title="Přeskočit (S) – fotka půjde na konec">Přeskočit</button>
                ${ohodnoceno.length ? '<button type="button" class="link" data-gh-vratit title="Vrátit poslední hodnocení (Backspace)">↶ Vrátit</button>' : ''}
            </div>
        </div>
        <div class="gh-nahledy">${htmlNahledu()}</div>
        <p class="gh-napoveda"><kbd>1</kbd>–<kbd>5</kbd> srdíčka a další · <kbd>←</kbd> <kbd>→</kbd> listovat · <kbd>S</kbd> přeskočit · mezerník promítání · <kbd>⌫</kbd> vrátit</p>`);
    prednacist();
}

// Další dvě fotky dopředu, ať přechod nečeká na síť
function prednacist() {
    const v = velikostFotky();
    fronta.slice(index + 1, index + 3).forEach(f => { new Image().src = adresaFotkyVysky(f, v); });
}

function posunout(o) {
    const novy = index + o;
    if (novy < 0 || novy >= fronta.length) return;
    index = novy;
    vykreslit();
    restartovatPromitani();
}

async function ohodnotit(h) {
    const f = aktualni();
    if (!f) return;
    // Hned dál (zápis běží na pozadí); hodnocená z fronty vypadne
    fronta.splice(index, 1);
    ohodnoceno.push({ fotka: f, index });
    vykreslit();
    restartovatPromitani();
    if (!await SetHodnoceniFotek([f.id], h).catch(() => false)) {
        oznamit('Srdíčka fotky se nepodařilo uložit.');
        vratitDoFronty(ohodnoceno.pop());
    }
}

function vratitDoFronty(zaznam) {
    if (!zaznam) return;
    const kam = Math.min(zaznam.index, fronta.length);
    fronta.splice(kam, 0, zaznam.fotka);
    index = kam;
    vykreslit();
}

async function vratit() {
    const zaznam = ohodnoceno.pop();
    if (!zaznam) return;
    vratitDoFronty(zaznam);
    zastavitPromitani();
    if (!await SetHodnoceniFotek([zaznam.fotka.id], 0).catch(() => false)) oznamit('Hodnocení se nepodařilo vrátit.');
}

function preskocit() {
    const f = aktualni();
    if (!f) return;
    zapsat(KLIC_PRESKOCENYCH, JSON.stringify(pridatPreskocenou(preskocene(), f.id)));
    fronta.splice(index, 1);
    fronta.push(f);
    vykreslit();
    restartovatPromitani();
}

function zmenitRazeni(nove) {
    if (nove === razeni()) return;
    zapsat(KLIC_RAZENI, nove);
    nacteno = false;
    nacistGalerii(kontejner);
}

// ——— Promítání ———

function zastavitPromitani() {
    clearInterval(promitani);
    promitani = 0;
}

function restartovatPromitani() {
    if (!promitani) return;
    clearInterval(promitani);
    promitani = window.setInterval(krokPromitani, interval() * 1000);
}

function krokPromitani() {
    // Galerie už není vidět (jiná část nebo stránka): promítání skončí
    if (!kontejner?.isConnected || !kontejner.offsetParent) return zastavitPromitani();
    // Bez hodnocení: další fotka; na konci fronty promítání skončí
    if (index + 1 >= fronta.length) {
        zastavitPromitani();
        vykreslit();
        return;
    }
    index++;
    vykreslit();
}

function prepnoutPromitani() {
    if (promitani) zastavitPromitani();
    else promitani = window.setInterval(krokPromitani, interval() * 1000);
    vykreslit();
}

function zmenitInterval() {
    const ted = interval();
    zapsat(KLIC_INTERVALU, String(INTERVALY[(INTERVALY.indexOf(ted) + 1) % INTERVALY.length]));
    restartovatPromitani();
    vykreslit();
}

/**
 * Obsluha; volá ji oblibenost.js jednou. videt() = Galerie je zobrazená a nic ji nepřekrývá.
 * @param {() => boolean} videt
 */
export function pripravitGalerii(videt) {
    document.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (!kontejner?.contains(t)) return;
        const srdicka = t.closest('[data-gh-srdicka]');
        const skok = t.closest('[data-gh-skok]');
        const razeniVolba = t.closest('[data-gh-razeni]');
        if (srdicka) ohodnotit(Number(/** @type {HTMLElement} */ (srdicka).dataset.ghSrdicka));
        else if (skok) posunout(Number(/** @type {HTMLElement} */ (skok).dataset.ghSkok) - index);
        else if (razeniVolba) zmenitRazeni(/** @type {HTMLElement} */ (razeniVolba).dataset.ghRazeni);
        else if (t.closest('[data-gh-predchozi]')) posunout(-1);
        else if (t.closest('[data-gh-dalsi]')) posunout(1);
        else if (t.closest('[data-gh-preskocit]')) preskocit();
        else if (t.closest('[data-gh-vratit]')) vratit();
        else if (t.closest('[data-gh-promitani]')) prepnoutPromitani();
        else if (t.closest('[data-gh-interval]')) zmenitInterval();
    });
    document.addEventListener('keydown', (e) => {
        if (!videt()) {
            // Mimo Galerii promítání nepokračuje
            if (promitani && !kontejner?.isConnected) zastavitPromitani();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const cil = /** @type {HTMLElement} */ (e.target);
        if (cil.closest?.('input, textarea, select, [role="slider"], [contenteditable]')) return;
        // Na zaměřeném tlačítku dělají mezerník a Enter to, co tlačítko
        if ((e.key === ' ' || e.key === 'Enter') && cil.closest?.('button') && kontejner?.contains(cil)) return;
        const h = srdickaKlavesy(e);
        const akce = h ? () => ohodnotit(h)
            : { ArrowLeft: () => posunout(-1), ArrowRight: () => posunout(1), s: preskocit, S: preskocit, ' ': prepnoutPromitani, Backspace: vratit }[e.key];
        if (!akce) return;
        e.preventDefault();
        akce();
    });
}

// Odchod z Galerie zastaví promítání (volá oblibenost.js při přepnutí části)
export function opustitGalerii() {
    if (promitani) zastavitPromitani();
}
