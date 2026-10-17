// Přehled klávesových zkratek (klávesa ?): skleněný panel uprostřed okna nad ztmavenou stránkou. V prohlížeči fotek
// a ve čtečce stran jde jejich část první a je zvýrazněná. Celá nápověda se otevře tlačítkem v patičce.
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
        [`${k('Tab')}${nebo}${k('Enter')}`, 'Procházet a otevřít karty'],
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

function pripravitPanel() {
    panel = document.createElement('div');
    panel.id = 'zkratky';
    panel.className = 'zkratky-zavoj hidden';
    panel.innerHTML = `
        <div class="zkratky" role="dialog" aria-modal="true" aria-labelledby="zkratkyNadpis">
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
    const aktivni = !lightbox.classList.contains('hidden') ? 'prohlizec' : ctecka && !ctecka.classList.contains('hidden') ? 'ctecka' : '';
    const casti = aktivni ? [CASTI.find(c => c.klic === aktivni), ...CASTI.filter(c => c.klic !== aktivni)] : CASTI;
    panel.querySelector('.zkratky-casti').innerHTML = casti.map(c => `
        <section class="${c.klic === aktivni ? 'aktivni' : ''}">
            <h4>${c.nazev}</h4>
            <dl>${c.radky.map(([klavesy, popis]) => `<dt>${klavesy}</dt><dd>${popis}</dd>`).join('')}</dl>
        </section>`).join('');
    panel.classList.remove('hidden');
}

export function zavritZkratky() {
    panel?.classList.add('hidden');
}

const otevreno = () => panel && !panel.classList.contains('hidden');

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // ? otevře a zavře přehled (ne při psaní a nad okny kromě čtečky stran); Esc ho zavře a dál nejde
    document.addEventListener('keydown', (e) => {
        if (otevreno()) {
            if (e.key === 'Escape' || e.key === '?') {
                e.preventDefault();
                e.stopPropagation();
                zavritZkratky();
            } else if (e.key !== 'Tab') {
                // Ostatní klávesy nepatří stránce pod panelem (listování, srdíčka…)
                e.stopPropagation();
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
