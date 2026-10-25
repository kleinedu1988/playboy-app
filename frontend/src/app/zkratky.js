// Přehled klávesových zkratek (klávesa ?): skleněný panel uprostřed okna nad ztmavenou stránkou. V prohlížeči fotek
// a ve čtečce stran (i v režimech Údržby) jde jejich část první a je zvýrazněná. Celá nápověda
// se otevře tlačítkem v patičce.
import { otevritNapovedu } from './napoveda';
import { lightbox } from './prohlizec';
import { stav } from './stav';

const k = (...klavesy) => klavesy.map(x => `<kbd>${x}</kbd>`).join('');
const nebo = '<span class="zkratky-nebo">/</span>';

const CASTI = [
    { klic: 'vse', nazev: 'Kdekoli', radky: [
        [k('Ctrl', 'F'), 'Hledat'],
        [k('?'), 'Klávesové zkratky'],
        [k('Esc'), 'Zavřít okno, zpět'],
        [k('Ctrl', 'Enter'), 'Uložit modelku (i v Doplnit modelku), použít text v editoru'],
        [`${k('Tab')}${nebo}${k('Enter')}`, 'Procházet a otevřít karty'],
        [`${k('1')}–${k('5')}${nebo}${k('0')}`, 'Srdíčka zaměřené karty nebo fotky, zrušit'],
        [`${k('3')} ${k('3')}`, 'U modelky stejná číslice znovu přidá půlku (3½; u pětky 4½)'],
        [k('←', '→'), 'Zaměřená srdíčka modelky po půlce (profil, Oblíbenost)'],
        [k('←', '↑', '→', '↓'), 'Pohyb v mapě edice (Přehled)'],
        [`${k('Shift', 'F10')}`, 'Nabídka akcí (jako pravé tlačítko)'],
    ] },
    { klic: 'hledani', nazev: 'Výsledky hledání', radky: [
        [k('↑', '↓'), 'Vybrat'],
        [k('Enter'), 'Otevřít'],
        [k('Esc'), 'Zavřít výsledky'],
    ] },
    { klic: 'profil', nazev: 'Profil modelky', radky: [
        [k('←', '→'), 'Předchozí a další modelka'],
        [`${k('Alt', '←')}${nebo}${k('Esc')}`, 'Zpět'],
    ] },
    { klic: 'udrzba-udaje', nazev: 'Údržba – Po údajích', radky: [
        [k('Enter'), 'Uložit řádek a jít na další'],
        [k('Tab'), 'Přeskočit na další pole'],
        [k('Esc'), 'Vrátit hodnotu řádku'],
        [`${k('Delete')}${nebo}${k('Ctrl', 'Delete')}`, 'Netýká se (v prázdném poli; V pořádku u kontroly, jde vrátit)'],
        [`${k('1')}–${k('5')}`, 'Srdíčka v řádku hodnocení (stejná znovu = půlka, ← → po půlce)'],
    ] },
    { klic: 'udrzba-modelky', nazev: 'Údržba – Po modelkách', radky: [
        [k('Enter'), 'Další pole na kartě'],
        [k('Ctrl', 'Enter'), 'Uložit změny a otevřít další modelku'],
        [`${k('PageDown')}${nebo}${k('Alt', '→')}`, 'Další ve frontě (přeskočit)'],
        [`${k('PageUp')}${nebo}${k('Alt', '←')}`, 'Předchozí ve frontě'],
        [k('Esc'), 'Vrátit hodnotu pole'],
        [`${k('1')}–${k('5')}`, 'Srdíčka, když je zaměřené hodnocení (stejná znovu = půlka)'],
    ] },
    { klic: 'oblibenost', nazev: 'Oblíbenost – porovnávání', radky: [
        [k('←'), 'Líbí se mi víc levá'],
        [k('→'), 'Líbí se mi víc pravá'],
        [`${k('↓')}${nebo}${k('Mezerník')}`, 'Obě stejně (remíza)'],
        [k('S'), 'Přeskočit dvojici'],
        [k('Backspace'), 'Vrátit poslední porovnání'],
    ] },
    { klic: 'udrzba-souhrn', nazev: 'Údržba – Souhrn', radky: [
        [k('↑', '↓'), 'Předchozí a další řádek (i položky rozbalené skupiny)'],
        [k('→', '←'), 'Rozbalit a sbalit skupinu'],
        [k('Enter'), 'Hlavní akce: doplnit, opravit, přijmout návrh'],
        [k('Delete'), 'Netýká se, V pořádku, Odmítnout (jde vrátit)'],
        [k('E'), 'Upravit návrh ve formuláři'],
        [k('S'), 'Vyřídit modelku v režimu Po modelkách'],
        [`${k('Ctrl', 'F')}${nebo}${k('/')}`, 'Hledat modelku nebo číslo'],
    ] },
    { klic: 'vyber', nazev: 'Výběr fotek', radky: [
        [`${k('Ctrl')} + klik`, 'Přidat do výběru'],
        [`${k('Shift')} + klik`, 'Vybrat úsek'],
        [k('Ctrl', 'A'), 'Vybrat vše'],
        [k('Delete'), 'Odebrat vybrané (jde vrátit)'],
        [k('Esc'), 'Zrušit výběr'],
    ] },
    { klic: 'prohlizec', nazev: 'Prohlížeč fotek', radky: [
        [k('←', '→'), 'Listovat'],
        [k('↑', '↓'), 'Skok na další album'],
        [k('Mezerník'), 'Slideshow'],
        [k('S'), 'Zamíchat'],
        [k('F'), 'Rozložit plakát přes okno'],
        [k('R'), 'Otočit'],
        [`${k('1')}–${k('5')}`, 'Srdíčka'],
        [k('0'), 'Zrušit srdíčka'],
        [k('Esc'), 'Zavřít'],
    ] },
    { klic: 'ctecka', nazev: 'Čtečka stran', radky: [
        [`${k('←', '→')}${nebo}${k('Mezerník')}`, 'Listovat'],
        [k('Home', 'End'), 'První a poslední strana'],
        [`${k('1')}${nebo}${k('2')}`, 'Jedna strana a dvojstrana'],
        [k('Esc'), 'Zavřít'],
    ] },
];

let panel = null;
let fokusPredOtevrenim = null;

function pripravitPanel() {
    panel = document.createElement('div');
    panel.id = 'zkratky';
    panel.className = 'zkratky-zavoj hidden';
    panel.innerHTML = `
        <div class="zkratky" role="dialog" aria-modal="true" aria-labelledby="zkratkyNadpis" tabindex="-1">
            <h3 id="zkratkyNadpis">Klávesové zkratky</h3>
            <div class="zkratky-casti"></div>
            <div class="zkratky-pata">
                <span>${k('?')} nebo ${k('Esc')} zavře</span>
                <button type="button" class="link" data-cela-napoveda>Celá nápověda →</button>
            </div>
        </div>`;
    document.body.append(panel);
    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-cela-napoveda]')) {
            zavritZkratky();
            otevritNapovedu();
        } else if (!e.target.closest('.zkratky')) zavritZkratky();
    });
}

export function otevritZkratky() {
    if (!panel) pripravitPanel();
    // Část toho, co je právě otevřené, jde první a je zvýrazněná
    const ctecka = document.getElementById('ctecka');
    const prehledVidet = stav.rezim === 'prehled' && !document.getElementById('stats')?.classList.contains('hidden');
    const udrzba = prehledVidet && stav.prehledSekce === 'udrzba';
    const aktivni = !lightbox.classList.contains('hidden') ? 'prohlizec' : ctecka && !ctecka.classList.contains('hidden') ? 'ctecka'
        : udrzba ? `udrzba-${stav.udrzbaRezim}` : prehledVidet && stav.prehledSekce === 'oblibenost' ? 'oblibenost' : '';
    const casti = aktivni ? [CASTI.find(c => c.klic === aktivni), ...CASTI.filter(c => c.klic !== aktivni)] : CASTI;
    panel.querySelector('.zkratky-casti').innerHTML = casti.map(c => `
        <section class="${c.klic === aktivni ? 'aktivni' : ''}">
            <h4>${c.nazev}</h4>
            <dl>${c.radky.map(([klavesy, popis]) => `<dt>${klavesy}</dt><dd>${popis}</dd>`).join('')}</dl>
        </section>`).join('');
    panel.classList.remove('hidden');
    // Fokus do panelu: Enter ani mezerník nesmí kliknout na tlačítko pod ním, Tab zůstává v panelu
    fokusPredOtevrenim = document.activeElement;
    panel.querySelector('.zkratky').focus({ preventScroll: true });
}

export function zavritZkratky() {
    if (!panel || panel.classList.contains('hidden')) return;
    panel.classList.add('hidden');
    if (fokusPredOtevrenim?.isConnected) fokusPredOtevrenim.focus({ preventScroll: true });
    fokusPredOtevrenim = null;
}

const otevreno = () => panel && !panel.classList.contains('hidden');

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // ? otevře a zavře přehled (ne při psaní a nad okny kromě čtečky stran); Esc ho zavře a dál nejde
    document.addEventListener('keydown', (e) => {
        if (otevreno()) {
            // Žádná klávesa nepatří stránce pod panelem (listování, srdíčka, Esc filtrů); obsluha zkratek je
            // registrovaná první, takže zastaví i ostatní obsluhy na dokumentu. Tab a Enter na tlačítku
            // „Celá nápověda“ zůstávají panelu.
            if (e.key === 'Tab') return;
            e.stopImmediatePropagation();
            if (e.key === 'Escape' || e.key === '?') {
                e.preventDefault();
                zavritZkratky();
            } else if (!(e.target.closest?.('.zkratky button') && (e.key === 'Enter' || e.key === ' '))) {
                e.preventDefault();
            }
            return;
        }
        if (e.key !== '?' || stav.zamceno || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input, textarea, select')
            || document.querySelector('.modal-overlay:not(.hidden):not(#ctecka)')) return;
        e.preventDefault();
        e.stopPropagation();
        otevritZkratky();
    }, true);
}
